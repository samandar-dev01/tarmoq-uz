// The decision part of scripts/boot.mjs, kept free of any database or file access so it can be tested on its own
// (tests/unit/bootPlan.test.ts).

/**
 * What the container has to do before the app starts.
 *
 * @param {object} state
 * @param {string[]} state.migrationDirs   migration folders in the code (prisma/migrations/*)
 * @param {string[]} state.applied         names of migrations the database has finished
 * @param {boolean} state.hasFailed        the database holds a migration that started and neither finished nor was rolled back
 * @param {string|null} state.storedHash   fingerprint of constraints.sql that was applied last time (null: never recorded)
 * @param {string} state.currentHash       fingerprint of constraints.sql in this build
 * @returns {{ migrate: boolean, constraints: boolean, reason: string }}
 */
export function planBoot({ migrationDirs, applied, hasFailed, storedHash, currentHash }) {
  // A half-done migration is not something to be clever about: run the normal command so it reports it, exactly as before.
  if (hasFailed) return { migrate: true, constraints: true, reason: "a migration is recorded as failed" };

  const done = new Set(applied);
  const pending = migrationDirs.filter((name) => !done.has(name));
  // New migrations may create tables, and every table must be locked down by constraints.sql, so it runs after them.
  if (pending.length > 0) return { migrate: true, constraints: true, reason: `${pending.length} migration(s) to apply: ${pending.join(", ")}` };

  if (storedHash !== currentHash) {
    return { migrate: false, constraints: true, reason: storedHash === null ? "constraints.sql has no recorded fingerprint yet" : "constraints.sql changed" };
  }
  return { migrate: false, constraints: false, reason: "database is up to date" };
}
