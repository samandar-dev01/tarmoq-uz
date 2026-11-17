// Runs before the server starts (Dockerfile CMD): makes sure the database has every migration and the lock-down rules.
//
// It used to be `npx prisma migrate deploy && npm run db:constraints` on EVERY start. On the free Render plan the container
// is stopped after 15 idle minutes and started again by the next visitor, so every wake-up paid for two Prisma CLI runs
// (each loads a large program and a separate engine on a very slow CPU) before the site could answer, although nothing had
// changed. Now it first asks the database one cheap question, and only runs those commands when there is work to do:
//   - a migration in the code the database has not applied yet            -> migrate deploy, then constraints
//   - prisma/constraints.sql is different from the one applied last time  -> constraints only
//   - neither                                                             -> nothing, the server starts at once
// What was applied is remembered as a comment on Prisma's own `_prisma_migrations` table (no new table to protect).
//
// Safe by design: if ANYTHING in the check fails (no database yet, a permission, an odd state), it falls back to the old
// full run, so the worst case is the old speed, never a skipped migration. A failing migrate or constraints step still
// stops the start with a non-zero exit, as before.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { planBoot } from "./bootPlan.mjs";

const MIGRATIONS_DIR = "prisma/migrations";
const CONSTRAINTS_FILE = "prisma/constraints.sql";
const STAMP_PREFIX = "constraints-sha256:";

const seconds = (since) => ((Date.now() - since) / 1000).toFixed(1);
const log = (message) => console.log(`[boot] ${message}`);

/** The Prisma command line, started directly with this Node (no `npx`, no `npm run`: each costs seconds on the free CPU). */
function prismaCli(args) {
  let entry;
  try {
    entry = createRequire(import.meta.url).resolve("prisma/build/index.js");
  } catch {
    return spawnSync("npx", ["prisma", ...args], { stdio: "inherit" });
  }
  return spawnSync(process.execPath, [entry, ...args], { stdio: "inherit" });
}

function run(label, args) {
  const started = Date.now();
  log(`${label} ...`);
  const ok = prismaCli(args).status === 0;
  log(`${label}: ${ok ? "ok" : "FAILED"} in ${seconds(started)}s`);
  return ok;
}

const migrate = () => run("prisma migrate deploy", ["migrate", "deploy"]);
const constraints = () => run("database constraints", ["db", "execute", "--file", CONSTRAINTS_FILE, "--schema", "prisma/schema.prisma"]);

/** Same limit as src/lib/db.ts, but one connection is all this short script needs. */
function limitedUrl(url) {
  if (/[?&]connection_limit=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

async function openDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // @prisma/client is CommonJS: depending on how Node reads it, the class is a named export or on `default`.
  const mod = await import("@prisma/client");
  const PrismaClient = mod.PrismaClient ?? mod.default?.PrismaClient;
  // log: [] because the first start on an empty database reads a table that is not there yet, which Prisma would print as an error.
  return new PrismaClient({ datasourceUrl: limitedUrl(url), log: [] });
}

const currentHash = createHash("sha256").update(readFileSync(CONSTRAINTS_FILE)).digest("hex");

async function readState(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT migration_name, (finished_at IS NOT NULL) AS finished, (rolled_back_at IS NOT NULL) AS rolled_back FROM "_prisma_migrations"`,
  );
  const comment = await prisma.$queryRawUnsafe(`SELECT obj_description('"_prisma_migrations"'::regclass, 'pg_class') AS note`);
  const note = comment[0]?.note ?? "";
  return {
    migrationDirs: readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name),
    applied: rows.filter((r) => r.finished && !r.rolled_back).map((r) => r.migration_name),
    hasFailed: rows.some((r) => !r.finished && !r.rolled_back),
    storedHash: note.startsWith(STAMP_PREFIX) ? note.slice(STAMP_PREFIX.length) : null,
    currentHash,
  };
}

/** Remembers that this constraints.sql has been applied. Never fatal: if it fails, the next start simply runs it again. */
async function stamp(prisma) {
  try {
    await prisma.$executeRawUnsafe(`COMMENT ON TABLE "_prisma_migrations" IS '${STAMP_PREFIX}${currentHash}'`);
  } catch (error) {
    log(`could not record the constraints fingerprint (it will run again next start): ${error?.message ?? error}`);
  }
}

async function main() {
  const started = Date.now();
  let prisma = null;
  let plan;
  try {
    prisma = await openDatabase();
    plan = planBoot(await readState(prisma));
    log(`${plan.migrate || plan.constraints ? "work to do" : "nothing to do"}: ${plan.reason} (checked in ${seconds(started)}s)`);
  } catch (error) {
    // No database yet, or something unexpected: do exactly what the container always did.
    const why = String(error?.message ?? error).split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "unknown";
    log(`could not tell what is applied (${why}); running everything, as before`);
    plan = { migrate: true, constraints: true, reason: "check failed" };
  }

  let ok = true;
  if (plan.migrate) ok = migrate();
  if (ok && plan.constraints) ok = constraints();
  if (ok && plan.constraints) {
    try {
      prisma ??= await openDatabase();
      await stamp(prisma);
    } catch (error) {
      log(`could not open the database to record the fingerprint: ${error?.message ?? error}`);
    }
  }
  await prisma?.$disconnect().catch(() => {});
  log(`done in ${seconds(started)}s${ok ? "" : " (FAILED)"}`);
  process.exit(ok ? 0 : 1);
}

main();
