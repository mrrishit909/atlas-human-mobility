#!/bin/sh
# remaining probe parts, serial, no load guard (coordinator instruction: load stayed 15 to 30 for hours); uptime logged per part
cd "$(dirname "$0")"
for part in "$@"; do
  echo "== $part start $(uptime)"
  node probe4.mjs $part 2>&1 | grep -v "^geom\|^rm " | tail -60
  echo "== $part end $(uptime)"
done
