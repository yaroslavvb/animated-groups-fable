#!/bin/bash
# lab/r2/sweep.sh — a few knob sets through ev.mjs, the worst line of each (one node run per set, run one after another).
#   bash dev/patterns/designs/paisley/lab/r2/sweep.sh '<json1>' '<json2>' ...
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
for k in "$@"; do
  echo "== $k"
  node dev/patterns/designs/paisley/lab/r2/ev.mjs --knobs "$k" 2>&1 | grep -E '^(\*632|\*442|\*333|\*2222|\*x|2\*22|worst)' | cut -c1-70
done
