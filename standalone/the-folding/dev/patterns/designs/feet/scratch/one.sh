#!/bin/bash
# scratch: one motif per group, large, with its frame: one.sh <name> <ids> [design path]  -> OUT/feet/<name>.png
set -euo pipefail
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/feet
cd "$W"
if [ -n "${3:-}" ]; then
  node dev/patterns/designs/feet/scratch/one.mjs --ids "$2" --out "$OUT/$1.svg" --design "$3"
else
  node dev/patterns/designs/feet/scratch/one.mjs --ids "$2" --out "$OUT/$1.svg"
fi
qlmanage -t -s 1680 -o "$OUT" "$OUT/$1.svg" >/dev/null 2>&1
mv -f "$OUT/$1.svg.png" "$OUT/$1.png"
ls "$OUT/$1.png"
