#!/bin/bash
# lab/r3/standard-set.sh — the standard set of pictures of the design (dev/patterns/README.md), one browser tool at a
# time on the mini's Chrome pool, into OUT = ~/drive.unsynced/artifacts/the-folding-patterns/paisley/. Logs to OUT/polish/set-*.txt.
#   bash dev/patterns/designs/paisley/lab/r3/standard-set.sh [proto|app|all]
set -u
W="$(cd "$(dirname "$0")/../../../../../.." && pwd)"
OUT="$HOME/drive.unsynced/artifacts/the-folding-patterns/paisley"
D="designs/paisley/design.js"
cd "$W" || exit 2
what="${1:-all}"
export FOLDING_BROWSER=mini
run() { local name="$1"; shift; echo "== $name"; timeout 600 node "$@" > "$OUT/polish/set-$name.txt" 2>&1; local c=$?; tail -n 3 "$OUT/polish/set-$name.txt" | cut -c1-300; echo "   exit $c"; }
if [ "$what" = proto ] || [ "$what" = all ]; then
  run sheet dev/patterns/proto.mjs --design "$D" --out "$OUT/sheet.png" --json "$OUT/rows.json"
  run zoom dev/patterns/proto.mjs --design "$D" --out "$OUT/zoom.png" --zoom 1.8 --measure 0
  run back dev/patterns/proto.mjs --design "$D" --out "$OUT/back.png" --side back --zoom 1.8 --measure 0
fi
if [ "$what" = app ] || [ "$what" = all ]; then
  run app-t0 dev/patterns/app-sheet.mjs --design "$D" --t 0 --out "$OUT/app-t0.png"
  run app-t06 dev/patterns/app-sheet.mjs --design "$D" --t 0.6 --out "$OUT/app-t06.png" --json "$OUT/app-t06.json"
  run app-t1 dev/patterns/app-sheet.mjs --design "$D" --t 1 --out "$OUT/app-t1.png"
  run app-back dev/patterns/app-sheet.mjs --design "$D" --t 0.6 --ids 'o,2222,xx,*x,22x,333,442' --view 180/40/1 --out "$OUT/app-back.png"
  run app-phone dev/patterns/app-sheet.mjs --design "$D" --phone --t 0.6 --ids 'o,*x,22x,333,*632' --out "$OUT/app-phone.png"
  run app-recut dev/patterns/app-sheet.mjs --design "$D" --ids 'xx,22x' --preset 1 --t 0.25 --out "$OUT/app-recut.png"
  run app-tile dev/patterns/app-sheet.mjs --design "$D" --ids '2222,*442,333' --tile 0.5 --out "$OUT/app-tile.png"
fi
