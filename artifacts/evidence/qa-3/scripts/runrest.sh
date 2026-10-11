#!/bin/sh
# remaining probe parts, run serially without waiting for load < 12 (load stayed 13 to 30 from other agents); uptime logged per part
cd "$(dirname "$0")"
for part in keyboard,errors,numbers tickets rm nav axe; do
  echo "== $part start $(uptime)"
  node probe3.mjs $part 2>&1 | tail -5
  echo "== $part end $(uptime)"
done
