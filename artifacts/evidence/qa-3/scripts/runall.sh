#!/bin/sh
# load-guarded sequential probe runs (P01-QA-004)
cd "$(dirname "$0")"
for part in geom tags,labels,chip tickets rm nav axe keyboard,errors,numbers; do
  i=0; until [ $(uptime | sed 's/.*averages: //' | cut -d' ' -f1 | cut -d. -f1) -lt 12 ] || [ $i -ge 25 ]; do sleep 60; i=$((i+1)); done
  echo "== $part start $(uptime)"
  node probe3.mjs $part 2>&1 | tail -5
  echo "== $part end $(uptime)"
done
