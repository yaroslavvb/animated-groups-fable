#!/bin/bash
# readme-check.sh (fixer, 13 Nov 2026) — every command line of dev/patterns/README.md, as written, for the demo design
# (OUT = OUT/fixer/readme), one browser at a time; prints each command's exit code and its last lines.
#   bash dev/patterns/scratch-fixer/readme-check.sh
set -u
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer/readme
mkdir -p "$O"
D=designs/demo/design.js
run() { echo "== $*"; FOLDING_BROWSER=mini "$@" > "$O/last.txt" 2>&1; c=$?; grep -E 'WROTE|FAILED|ERROR|GROUPS|usage' "$O/last.txt" | tail -3; echo "exit $c"; }
run node dev/patterns/proto.mjs --design $D --out $O/sheet.png --json $O/rows.json
run node dev/patterns/proto.mjs --design $D --out $O/close.png --ids '333,*x,*632' --px 520 --cols 3
run node dev/patterns/proto.mjs --design $D --out $O/zoom.png --zoom 1.8
run node dev/patterns/proto.mjs --design $D --out $O/back.png --side back --zoom 1.8
run node dev/patterns/proto.mjs --design $D --out $O/fast.png --measure 0
run node dev/patterns/app-sheet.mjs --design $D --t 0 --out $O/app-t0.png
run node dev/patterns/app-sheet.mjs --design $D --t 1 --out $O/app-t1.png
run node dev/patterns/app-sheet.mjs --design $D --t 0.6 --ids 'o,2222,xx,*x,22x,333,442' --view 180/40/1 --out $O/app-back.png
run node dev/patterns/app-sheet.mjs --design $D --phone --t 0.6 --ids 'o,*x,22x,333,*632' --out $O/app-phone.png
run node dev/patterns/app-sheet.mjs --design $D --ids 'xx,22x' --preset 1 --t 0.25 --out $O/app-recut.png
run node dev/patterns/app-sheet.mjs --design $D --ids '2222,*442,333' --tile 0.5 --out $O/app-tile.png
run node dev/patterns/app-sheet.mjs --design $D --ids 'o,*x,22x' --t 0.6 --dpr 2 --clip fold --json $O/app-fold.json --out $O/app-fold.png
run node dev/patterns/app-sheet.mjs --pat checker --ids 'o,333' --t 0.6 --out $O/app-checker.png
run node dev/patterns/app-sheet.mjs --pat demo --designs demo,stress --ids 'o,*632' --t 0.6 --out $O/app-pat-demo.png
echo done
