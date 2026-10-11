#!/bin/sh
# load-guarded sequential probe runs (P01-QA-005): wait up to 25 min for 1-min load < 12, then run each part; uptime logged
cd "$(dirname "$0")"
for part in "$@"; do
  i=0; until [ $(uptime | sed 's/.*averages: //' | cut -d' ' -f1 | cut -d. -f1) -lt 12 ] || [ $i -ge 25 ]; do sleep 60; i=$((i+1)); done
  echo "== $part start (waited ${i} min) $(uptime)"
  node probe4.mjs $part 2>&1 | grep -v "^geom\|^rm " | tail -80
  echo "== $part end $(uptime)"
done
