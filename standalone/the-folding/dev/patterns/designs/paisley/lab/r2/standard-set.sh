#!/bin/bash
# lab/r2/standard-set.sh — the standard set of dev/patterns/README.md for designs/paisley/design.js, one tool after
# another (one browser at a time, Chrome of the mini's pool), into ~/drive.unsynced/artifacts/the-folding-patterns/paisley/.
#   bash dev/patterns/designs/paisley/lab/r2/standard-set.sh
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/paisley
D=designs/paisley/design.js
export FOLDING_BROWSER=mini
run() { echo "== $*"; node "$@" 2>&1 | grep -v '^ROWS' | tail -4; }
run dev/patterns/proto.mjs --design $D --out $O/sheet.png --json $O/rows.json
run dev/patterns/proto.mjs --design $D --zoom 1.8 --out $O/zoom.png
run dev/patterns/proto.mjs --design $D --side back --zoom 1.8 --out $O/back.png
run dev/patterns/app-sheet.mjs --design $D --t 0 --out $O/app-t0.png
run dev/patterns/app-sheet.mjs --design $D --t 0.6 --out $O/app-t06.png --json $O/app-t06.json
run dev/patterns/app-sheet.mjs --design $D --t 1 --out $O/app-t1.png
run dev/patterns/app-sheet.mjs --design $D --t 0.6 --ids 'o,2222,xx,*x,22x,333,442' --view 180/40/1 --out $O/app-back.png
run dev/patterns/app-sheet.mjs --design $D --phone --t 0.6 --ids 'o,*x,22x,333,*632' --out $O/app-phone.png
run dev/patterns/app-sheet.mjs --design $D --ids 'xx,22x' --preset 1 --t 0.25 --out $O/app-recut.png
run dev/patterns/app-sheet.mjs --design $D --ids '2222,*442,333' --tile 0.5 --out $O/app-tile.png
echo done
