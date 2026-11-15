// Test rig only. Starts a throwaway PostgreSQL from the `embedded-postgres` package, which is NOT a dependency of
// this project: it is loaded from a folder outside the repo.
//
//   node pg-start.mjs <moduleDir> <dataDir>
//     moduleDir  the folder that contains node_modules/embedded-postgres
//     dataDir    where the database files go (created when missing)
//   env: PG_PORT (required), PG_USER, PG_PASSWORD, PG_DATABASE
//
// Prints "PG READY" when the database accepts connections. Stops the database on SIGTERM / SIGINT.
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";

const [moduleDir, dataDir] = process.argv.slice(2);
const port = Number(process.env.PG_PORT);
if (!moduleDir || !dataDir || !Number.isInteger(port)) {
  console.error("usage: PG_PORT=<port> node pg-start.mjs <moduleDir> <dataDir>");
  process.exit(2);
}

const require = createRequire(path.join(path.resolve(moduleDir), "package.json"));
const EmbeddedPostgres = require("embedded-postgres").default;
const pg = new EmbeddedPostgres({
  databaseDir: path.resolve(dataDir),
  user: process.env.PG_USER ?? "riguser",
  password: process.env.PG_PASSWORD ?? randomBytes(16).toString("hex"), // the rig always passes its own
  port,
  persistent: true, // the rig script removes the data folder itself
});

// A signal may arrive at any moment, also while the database is still starting: wait for the start to settle,
// then stop it, so no postgres process is left behind.
let starting = Promise.resolve();
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  try {
    await starting.catch(() => {});
    await pg.stop();
  } catch (e) {
    console.error("pg stop:", String(e?.message ?? e));
  } finally {
    process.exit(0);
  }
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

starting = (async () => {
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  await pg.createDatabase(process.env.PG_DATABASE ?? "tarmoq_e2e");
})();
try {
  await starting;
} catch (e) {
  console.error("pg start failed:", String(e?.message ?? e));
  if (!stopping) {
    try {
      await pg.stop();
    } catch {
      /* it never started */
    }
    process.exit(1);
  }
}
if (!stopping) console.log("PG READY");
setInterval(() => {}, 1 << 30); // stay alive until a signal arrives
