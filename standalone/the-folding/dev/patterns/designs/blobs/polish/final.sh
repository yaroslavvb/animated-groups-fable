#!/bin/bash
# polish/final.sh — the standard set of pictures (dev/patterns/README.md) of the finished design, one browser run at a
# time on the mini's pool, into OUT/blobs. polish-soft, 14 Nov 2026.
set -uo pipefail
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/blobs
D=designs/blobs/design.js
cd "$W" || exit 2
export FOLDING_BROWSER=mini
run() { echo "== $*"; node "$@" 2>&1 | grep -v '^ROWS ' | tail -n 12; }
run dev/patterns/proto.mjs --design $D --out $OUT/sheet.png --json $OUT/rows.json
run dev/patterns/proto.mjs --design $D --out $OUT/zoom.png --zoom 1.8 --measure 0
run dev/patterns/proto.mjs --design $D --out $OUT/back.png --side back --zoom 1.8 --measure 0
run dev/patterns/app-sheet.mjs --design $D --t 0 --out $OUT/app-t0.png --json $OUT/app-t0.json
run dev/patterns/app-sheet.mjs --design $D --t 0.6 --out $OUT/app-t06.png --json $OUT/app-t06.json
run dev/patterns/app-sheet.mjs --design $D --t 1 --out $OUT/app-t1.png --json $OUT/app-t1.json
run dev/patterns/app-sheet.mjs --design $D --t 0.6 --ids 'o,2222,xx,*x,22x,333,442' --view 180/40/1 --out $OUT/app-back.png
run dev/patterns/app-sheet.mjs --design $D --phone --t 0.6 --ids 'o,*x,22x,333,*632' --out $OUT/app-phone.png
run dev/patterns/app-sheet.mjs --design $D --ids 'xx,22x' --preset 1 --t 0.25 --out $OUT/app-recut.png
run dev/patterns/app-sheet.mjs --design $D --ids '2222,*442,333' --tile 0.5 --out $OUT/app-tile.png
echo "final.sh done"
