#!/usr/bin/env bash
# How fast do the public pages answer? curl only, nothing to install, reads only (GET).
#
#   bash scripts/perf/measure.sh                       # the live site, 5 runs per page
#   bash scripts/perf/measure.sh http://127.0.0.1:3000 8
#
# "wait" is what the SERVER spent: time to first byte minus the time spent connecting and doing TLS. That is the number
# this project can change; connect/TLS depend on the distance between you and the server (Tashkent <-> Frankfurt is
# about 0.2 s per round trip) and are printed separately so they do not hide a real change.
#
# For a COLD start (the free Render instance asleep): leave the site alone for 16 minutes, then run it with 1 run and
# read the first line. It is the only way to see the wake-up time; later runs are warm.
set -euo pipefail

BASE="${1:-https://tarmoq-uz.onrender.com}"
RUNS="${2:-5}"
PAGES=(/api/health / /search /login /robots.txt)

printf 'target: %s   runs per page: %s   (seconds)\n' "$BASE" "$RUNS"
printf '%-14s %8s %8s %8s %8s %8s\n' page "wait min" "wait med" "wait max" "total med" "bytes"

for path in "${PAGES[@]}"; do
  waits=(); totals=(); size=0
  for ((i = 1; i <= RUNS; i++)); do
    # %{time_appconnect} is 0 for plain http, which is right: there is no TLS to subtract.
    line=$(curl -s -o /dev/null -H 'Accept-Encoding: gzip' -m 120 \
      -w '%{time_starttransfer} %{time_connect} %{time_appconnect} %{time_total} %{size_download}' "$BASE$path" || echo "0 0 0 0 0")
    read -r ttfb conn tls total bytes <<<"$line"
    ready=$(awk -v c="$conn" -v t="$tls" 'BEGIN { print (t > c ? t : c) }')
    waits+=("$(awk -v a="$ttfb" -v b="$ready" 'BEGIN { printf "%.3f", a - b }')")
    totals+=("$total"); size="$bytes"
  done
  stats() { printf '%s\n' "$@" | sort -n | awk '{ v[NR] = $1 } END { printf "%.3f %.3f %.3f", v[1], v[int((NR + 1) / 2)], v[NR] }'; }
  read -r wmin wmed wmax <<<"$(stats "${waits[@]}")"
  read -r _ tmed _ <<<"$(stats "${totals[@]}")"
  printf '%-14s %8s %8s %8s %8s %8s\n' "$path" "$wmin" "$wmed" "$wmax" "$tmed" "$size"
done
