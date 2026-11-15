# Production-style end-to-end run

`npm run test:e2e` tests the app in development mode (`next dev`). This rig tests what is actually deployed: a real
`next build`, started with `next start`, against a fresh throwaway PostgreSQL, with the Playwright suite pointed at it.
Nothing here touches the live site, the live database or your `.env` values.

## Run it

```bash
PG_MODULE_DIR=/path/to/pg-folder npm run test:e2e:prod                                   # whole suite, once
PG_MODULE_DIR=/path/to/pg-folder RIG_RUNS=2 npm run test:e2e:prod                        # whole suite, twice (see "First run")
PG_MODULE_DIR=/path/to/pg-folder npm run test:e2e:prod -- tests/e2e/health.spec.ts       # one spec
PG_MODULE_DIR=/path/to/pg-folder RIG_BASE_PORT=4000 npm run test:e2e:prod                # a second rig, side by side
```

Anything after `--` is handed to `playwright test` unchanged. The exit code is Playwright's (with `RIG_RUNS=2`, the
last failing run's), returned after the cleanup.

## What it needs

- `node_modules` already installed in the repo (the rig never runs `npm install`), and Playwright's Chromium.
- `PG_MODULE_DIR`: a folder **outside the repo** that contains `node_modules/embedded-postgres`. That package is a
  self-contained PostgreSQL; it is deliberately not a project dependency. The rig stops with a clear message when the
  folder is missing and never installs it for you.
- `bash`, `lsof`, Node 20.9 or newer.
- Free ports (see below). The rig refuses to start when one is taken; it never stops a process it did not start.
- No `next dev` running in the same folder: `npm run build` rewrites `.next`.

## What it does

1. Starts a fresh, empty database (`pg-start.mjs`) with a random password.
2. Sets the environment itself: every variable from `.env.example`, with a random `AUTH_SECRET` made up for the run,
   `PAYMENT_PROVIDER=sandbox`, `STORAGE_DRIVER=local`, uploads in the rig's scratch folder, and everything else
   (Telegram, S3, manual-payment card, payout key) blank. Exported variables win over a local `.env`, so yours is not used.
3. `prisma migrate deploy`, `npm run db:constraints`, `npm run db:seed`.
4. `npm run build`, then `next start` on the app port.
5. Starts `forwarder.mjs` on the base port and waits for `/api/health`.
6. `playwright test -c playwright.prod.config.ts` (no `webServer`, `E2E_BASE_URL` required, one worker).
7. Cleanup, always, also after a failure or Ctrl+C.

**Demo accounts.** `prisma/seed.ts` creates them only when `NODE_ENV` is not `production` (or `SEED_DEMO=true`). The rig
leaves `NODE_ENV` unset for the seed step and sets `SEED_DEMO=false` and `SEED_DEMO_PASSWORD=Demo12345!`, so the seed
runs as it does in development: `admin@demo.test`, `client@demo.test` and the demo creators get the password
`Demo12345!`, which is the one the tests sign in with. `next build` and `next start` set `NODE_ENV=production` themselves.

**Why the forwarder.** A production build ignores `RATE_LIMIT_DISABLED`, and the suite registers many accounts from
one machine. The forwarder gives every request its own made-up address in `X-Forwarded-For`, so the real, switched-on
rate limiter sees many visitors. It is a test tool only.

## First run

Every run starts from an empty database, and `admin.spec.ts` › "admin can hide and restore a review" skips itself
until a review exists; the review is written later in the same run by `client-journey.spec.ts`. So one pass shows
one extra skip. To see that test run, use `RIG_RUNS=2`: the suite runs twice against the same database and the second
pass has the review. (`manual-payments.spec.ts` always skips here: it needs `PAYMENT_PROVIDER=manual`.)

## Ports

| | Port | With the default `RIG_BASE_PORT=3000` |
|---|---|---|
| Forwarder (what the tests open) | base | 3000 |
| App (`next start`) | base + 300 | 3300 |
| PostgreSQL | 54000 + (base % 1000) | 54000 |

Two rigs with different base ports can run at the same time **from two checkouts** (for example two git worktrees).
In one folder they would share `.next` and `test-results`.

## Scratch folder and cleanup

Database files, uploads and logs go to a new folder under the system temp directory, or to `RIG_SCRATCH_DIR` when set.
On exit the rig stops the forwarder, the app and the database, removes the database and uploads folders, prints what
it stopped and removed, and reports whether each port is free again. Its own temp folder is removed after a green
run; after a failure (or with `RIG_SCRATCH_DIR`) the logs are kept and their path is printed: `postgres.log`,
`migrate.log`, `constraints.log`, `seed.log`, `build.log`, `app.log`, `forwarder.log`.

## Files

- `run.sh`: the whole run.
- `pg-start.mjs`: starts the throwaway database (`PG_PORT`, data folder and module folder as arguments).
- `forwarder.mjs`: the forwarder (`FWD_PORT`, `UPSTREAM_PORT`).
- `../../playwright.prod.config.ts`: the Playwright config the rig uses.
