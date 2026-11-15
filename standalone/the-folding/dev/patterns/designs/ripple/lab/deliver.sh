#!/bin/bash
# designs/ripple/lab/deliver.sh — the standard picture set of dev/patterns/README.md for this design, fresh, one browser
# tool at a time (Chrome on the mini). Run from anywhere:  bash dev/patterns/designs/ripple/lab/deliver.sh
set -u
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/ripple
D=designs/ripple/design.js
cd "$W" || exit 1
export FOLDING_BROWSER=mini
run() { echo "== $*"; node "$@" 2>&1 | grep -v '^ROWS' | tail -4; }
run dev/patterns/proto.mjs --design $D --out $OUT/sheet.png --json $OUT/rows.json
run dev/patterns/proto.mjs --design $D --out $OUT/zoom.png --zoom 1.8
run dev/patterns/proto.mjs --design $D --out $OUT/back.png --side back --zoom 1.8
run dev/patterns/app-sheet.mjs --design $D --t 0 --out $OUT/app-t0.png --json $OUT/app-t0.json
run dev/patterns/app-sheet.mjs --design $D --t 0.6 --out $OUT/app-t06.png --json $OUT/app-t06.json
run dev/patterns/app-sheet.mjs --design $D --t 1 --out $OUT/app-t1.png --json $OUT/app-t1.json
run dev/patterns/app-sheet.mjs --design $D --t 0.6 --ids 'o,2222,xx,*x,22x,333,442' --view 180/40/1 --out $OUT/app-back.png
run dev/patterns/app-sheet.mjs --design $D --phone --t 0.6 --ids 'o,*x,22x,333,*632' --out $OUT/app-phone.png
run dev/patterns/app-sheet.mjs --design $D --ids 'xx,22x' --preset 1 --t 0.25 --out $OUT/app-recut.png
run dev/patterns/app-sheet.mjs --design $D --ids '2222,*442,333' --tile 0.5 --out $OUT/app-tile.png
echo done
