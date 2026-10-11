#!/bin/sh
# P01-QA-008: serial probe parts, no load guard (coordinator: --workers 1 without waiting); uptime per part. RES selects the results file.
cd "$(dirname "$0")"
for part in "$@"; do
  echo "== $part start $(uptime)"
  node probe7.mjs $part 2>&1 | grep -v "^geom\|^rm " | tail -80
  echo "== $part end $(uptime)"
done
