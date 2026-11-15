#!/bin/bash
# scratch: the motifs of some groups, drawn locally (no browser): look.sh <name> <ids> [variant]
# writes OUT/feet/<name>.svg.png
set -euo pipefail
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/feet
cd "$W"
node dev/patterns/designs/feet/scratch/svg.mjs --ids "$2" --out "$OUT/$1.svg" --variant "${3:-}"
qlmanage -t -s 1600 -o "$OUT" "$OUT/$1.svg" >/dev/null 2>&1
ls -la "$OUT/$1.svg.png"
