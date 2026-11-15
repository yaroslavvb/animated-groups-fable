#!/bin/bash
# lab/r2/sweep2.sh — knob sets through ev.mjs: per set the bare / dark of every group on one line, and the worst line.
#   bash dev/patterns/designs/paisley/lab/r2/sweep2.sh '<json1>' '<json2>' ...
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
for k in "$@"; do
  echo "== $k"
  node dev/patterns/designs/paisley/lab/r2/ev.mjs --knobs "$k" 2>&1 | awk '/^worst/ {print; next} {d=""; b=""; t=""; for(i=1;i<=NF;i++){ if($i=="dark") d=$(i+1); if($i=="bare") b=$(i+1); if ($i ~ /ms$/) t=$i } printf "%s %s/%s %s | ", $1, b, d, t } END {print ""}'
done
