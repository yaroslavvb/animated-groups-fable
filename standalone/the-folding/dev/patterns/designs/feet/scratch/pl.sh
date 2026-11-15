#!/bin/bash
# scratch: the plane round the default tile, locally, with the worst bare and solid discs marked: pl.sh <name> <ids> [variant] [per]
# writes OUT/feet/<name>.svg.png
set -euo pipefail
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/feet
cd "$W"
node dev/patterns/designs/feet/scratch/plane.mjs --ids "$2" --out "$OUT/$1.svg" --variant "${3:-}" --per "${4:-44}"
qlmanage -t -s 1600 -o "$OUT" "$OUT/$1.svg" >/dev/null 2>&1
ls "$OUT/$1.svg.png"
