#!/usr/bin/env bash
# Production-style end-to-end run: a fresh throwaway database, a real `next build` + `next start`, a forwarder in
# front, then the Playwright suite. See scripts/e2e-prod/README.md.
#
#   PG_MODULE_DIR=/path/with/node_modules bash scripts/e2e-prod/run.sh [playwright args, e.g. tests/e2e/health.spec.ts]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

BASE_PORT="${RIG_BASE_PORT:-3000}"
RUNS="${RIG_RUNS:-1}"
case "$BASE_PORT" in ''|*[!0-9]*) echo "rig: RIG_BASE_PORT must be a number" >&2; exit 2 ;; esac
case "$RUNS" in ''|*[!0-9]*|0) echo "rig: RIG_RUNS must be 1 or more" >&2; exit 2 ;; esac
FWD_PORT="$BASE_PORT"
APP_PORT=$((BASE_PORT + 300))
PG_PORT=$((54000 + BASE_PORT % 1000))

if [ -z "${PG_MODULE_DIR:-}" ] || [ ! -d "$PG_MODULE_DIR/node_modules/embedded-postgres" ]; then
  cat >&2 <<MSG
rig: PG_MODULE_DIR is missing or wrong.
     Set it to a folder that contains node_modules/embedded-postgres (kept OUTSIDE this repo, it is not a
     project dependency). This script never installs anything.
MSG
  exit 2
fi
PG_MODULE_DIR="$(cd "$PG_MODULE_DIR" && pwd)"
[ -d node_modules ] || { echo "rig: node_modules is missing in $ROOT (run npm install yourself first)" >&2; exit 2; }

port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
for p in "$FWD_PORT" "$APP_PORT" "$PG_PORT"; do
  if port_busy "$p"; then
    echo "rig: port $p is already in use. Stop what is using it, or pick another RIG_BASE_PORT." >&2
    exit 2
  fi
done

# Scratch folder: database files, uploads and logs. A folder the rig made itself is removed after a green run.
OWN_SCRATCH=0
if [ -n "${RIG_SCRATCH_DIR:-}" ]; then
  mkdir -p "$RIG_SCRATCH_DIR"
  SCRATCH="$(cd "$RIG_SCRATCH_DIR" && pwd)"
else
  SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/tarmoq-e2e-prod.XXXXXX")"
  OWN_SCRATCH=1
fi
PGDATA="$SCRATCH/pgdata-$BASE_PORT"
UPLOADS="$SCRATCH/uploads-$BASE_PORT"
LOGS="$SCRATCH/logs-$BASE_PORT"
rm -rf "$PGDATA" "$UPLOADS" "$LOGS"
mkdir -p "$UPLOADS" "$LOGS"

PG_PID="" APP_PID="" FWD_PID=""
RESULT=1

stop_proc() { # name pid seconds-to-wait
  local name="$1" pid="$2" wait_s="$3" i=0 kids k
  [ -n "$pid" ] || return 0
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "rig cleanup: $name (pid $pid) had already exited"
    wait "$pid" 2>/dev/null || true
    return 0
  fi
  kids="$(pgrep -P "$pid" 2>/dev/null || true)" # noted first: the children are reparented once the parent is gone
  kill -TERM "$pid" 2>/dev/null || true # the script stops its own children (the database does so on SIGTERM)
  while kill -0 "$pid" 2>/dev/null && [ "$i" -lt $((wait_s * 5)) ]; do sleep 0.2; i=$((i + 1)); done
  if kill -0 "$pid" 2>/dev/null; then
    pkill -KILL -P "$pid" 2>/dev/null || true
    kill -KILL "$pid" 2>/dev/null || true
    echo "rig cleanup: $name (pid $pid) did not stop in ${wait_s}s, killed"
  else
    echo "rig cleanup: stopped $name (pid $pid)"
  fi
  wait "$pid" 2>/dev/null || true
  for k in $kids; do # anything it left behind
    if kill -0 "$k" 2>/dev/null; then
      kill -TERM "$k" 2>/dev/null || true
      sleep 1
      kill -0 "$k" 2>/dev/null && kill -KILL "$k" 2>/dev/null
      echo "rig cleanup: stopped leftover child $k of $name"
    fi
  done
  return 0
}

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  set +e
  echo
  stop_proc "forwarder :$FWD_PORT" "$FWD_PID" 5
  stop_proc "app :$APP_PORT" "$APP_PID" 10
  stop_proc "postgres :$PG_PORT" "$PG_PID" 20
  # If the database outlived its starter script, the pid file inside OUR data folder names it. Only a process that is
  # really a postgres is touched, so a recycled pid can never hit something else.
  if [ -f "$PGDATA/postmaster.pid" ]; then
    local pm; pm="$(head -n 1 "$PGDATA/postmaster.pid" 2>/dev/null)"
    case "$pm" in ''|*[!0-9]*) ;; *)
      if kill -0 "$pm" 2>/dev/null && ps -p "$pm" -o command= 2>/dev/null | grep -q "postgres"; then
        kill -INT "$pm" 2>/dev/null
        for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pm" 2>/dev/null || break; sleep 0.5; done
        kill -0 "$pm" 2>/dev/null && kill -KILL "$pm" 2>/dev/null
        echo "rig cleanup: stopped leftover postgres (pid $pm)"
      fi ;;
    esac
  fi
  rm -rf "$PGDATA" "$UPLOADS"
  echo "rig cleanup: removed database folder $PGDATA"
  echo "rig cleanup: removed uploads folder $UPLOADS"
  if [ "$OWN_SCRATCH" -eq 1 ] && [ "$code" -eq 0 ]; then
    rm -rf "$SCRATCH"
    echo "rig cleanup: removed scratch folder $SCRATCH"
  else
    echo "rig cleanup: logs kept in $LOGS"
  fi
  for p in "$FWD_PORT" "$APP_PORT" "$PG_PORT"; do
    if port_busy "$p"; then echo "rig cleanup: WARNING port $p is still in use"; else echo "rig cleanup: port $p is free"; fi
  done
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

wait_for_line() { # file text pid seconds
  local file="$1" text="$2" pid="$3" secs="$4" i=0
  while [ "$i" -lt $((secs * 5)) ]; do
    grep -q "$text" "$file" 2>/dev/null && return 0
    kill -0 "$pid" 2>/dev/null || return 1
    sleep 0.2; i=$((i + 1))
  done
  return 1
}

# ---- Environment for the app. Secrets are made up for this run and never printed. ----
rand() { node -e 'process.stdout.write(require("node:crypto").randomBytes(Number(process.argv[1])).toString("hex"))' "$1"; }
export PG_PORT PG_USER="riguser" PG_DATABASE="tarmoq_e2e"
PG_PASSWORD="$(rand 16)"; export PG_PASSWORD
export DATABASE_URL="postgresql://$PG_USER:$PG_PASSWORD@127.0.0.1:$PG_PORT/$PG_DATABASE?schema=public"
export DIRECT_URL="$DATABASE_URL"
AUTH_SECRET="$(rand 48)"; export AUTH_SECRET
export SESSION_MAX_AGE_DAYS=7
export APP_URL="http://localhost:$FWD_PORT"
export E2E_BASE_URL="$APP_URL"
export PAYMENT_PROVIDER="sandbox"
export MANUAL_PAY_CARD="" MANUAL_PAY_HOLDER="" MANUAL_PAY_BANK="" PAYOUT_ENCRYPTION_KEY=""
export TELEGRAM_BOT_TOKEN="" TELEGRAM_CHAT_ID=""
export STORAGE_DRIVER="local" LOCAL_UPLOAD_DIR="$UPLOADS" MAX_UPLOAD_MB=100
export S3_ENDPOINT="" S3_REGION="" S3_BUCKET="" S3_RECEIPTS_BUCKET="" S3_ACCESS_KEY_ID="" S3_SECRET_ACCESS_KEY=""
export SEED_DEMO=false SEED_DEMO_PASSWORD='Demo12345!'
export RATE_LIMIT_DISABLED=false # a production build ignores it anyway; the forwarder is what lets the suite through
export NEXT_TELEMETRY_DISABLED=1
# NODE_ENV stays unset on purpose: `next build` and `next start` set "production" themselves, and the seed
# (prisma/seed.ts) creates the demo accounts only when NODE_ENV is NOT "production".
unset NODE_ENV RENDER_EXTERNAL_URL PORT

echo "rig: forwarder :$FWD_PORT -> app :$APP_PORT, postgres :$PG_PORT, scratch $SCRATCH"

echo "rig: starting a fresh database"
node "$HERE/pg-start.mjs" "$PG_MODULE_DIR" "$PGDATA" >"$LOGS/postgres.log" 2>&1 &
PG_PID=$!
wait_for_line "$LOGS/postgres.log" "PG READY" "$PG_PID" 120 || { echo "rig: the database did not start, see $LOGS/postgres.log" >&2; exit 1; }

echo "rig: migrations, constraints, seed"
npx --no-install prisma migrate deploy >"$LOGS/migrate.log" 2>&1 || { tail -n 30 "$LOGS/migrate.log" >&2; exit 1; }
npm run --silent db:constraints >"$LOGS/constraints.log" 2>&1 || { tail -n 30 "$LOGS/constraints.log" >&2; exit 1; }
npm run --silent db:seed >"$LOGS/seed.log" 2>&1 || { tail -n 30 "$LOGS/seed.log" >&2; exit 1; }
grep -q "Seed complete" "$LOGS/seed.log" || { echo "rig: the seed did not create the demo accounts, see $LOGS/seed.log" >&2; exit 1; }

echo "rig: npm run build"
npm run build >"$LOGS/build.log" 2>&1 || { tail -n 40 "$LOGS/build.log" >&2; exit 1; }

echo "rig: next start on :$APP_PORT"
node node_modules/next/dist/bin/next start -p "$APP_PORT" -H 127.0.0.1 >"$LOGS/app.log" 2>&1 &
APP_PID=$!
FWD_PORT="$FWD_PORT" UPSTREAM_PORT="$APP_PORT" node "$HERE/forwarder.mjs" >"$LOGS/forwarder.log" 2>&1 &
FWD_PID=$!
wait_for_line "$LOGS/forwarder.log" "FWD READY" "$FWD_PID" 20 || { echo "rig: the forwarder did not start, see $LOGS/forwarder.log" >&2; exit 1; }

ready=0
for _ in $(seq 1 150); do
  kill -0 "$APP_PID" 2>/dev/null || break
  if node -e 'fetch(process.argv[1]).then(async (r) => process.exit(r.ok && (await r.json()).status === "ok" ? 0 : 1)).catch(() => process.exit(1))' "http://127.0.0.1:$FWD_PORT/api/health"; then ready=1; break; fi
  sleep 0.4
done
[ "$ready" -eq 1 ] || { echo "rig: the app did not answer on /api/health, see $LOGS/app.log" >&2; tail -n 30 "$LOGS/app.log" >&2; exit 1; }

RESULT=0
for run in $(seq 1 "$RUNS"); do
  echo "rig: playwright, run $run of $RUNS"
  set +e
  npx --no-install playwright test -c playwright.prod.config.ts "$@"
  rc=$?
  set -e
  echo "rig: run $run finished with exit code $rc"
  [ "$rc" -eq 0 ] || RESULT=$rc
done
exit "$RESULT"
