#!/bin/bash
# round 5: global + local searches for 3*3 and 4*2 with the round-5 penalties (run on the mini, one at a time)
cd "$(dirname "$0")/../.."
W='{"bareHinge":6,"wiggle":1.5,"loop":0.5}'
for id in '3*3' '4*2'; do
  /opt/homebrew/bin/node lab/search.mjs --id "$id" --init lab/r5/init-a.json --samples 500 --top 6 --iters 700 --h 0.022 --pts 4 --all 1 --seed 3 --w "$W"
done
