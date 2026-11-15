#!/bin/bash
# bash dev/standard-set.sh — the standard pictures of dev/patterns/README.md for design.js, one browser run after another
# (Chrome on the mini), into ~/drive.unsynced/artifacts/the-folding-patterns/tomoe/. Prints each run's verdict lines.
set -uo pipefail
W="$(cd "$(dirname "$0")/../../../../.." && pwd)"
OUT="$HOME/drive.unsynced/artifacts/the-folding-patterns/tomoe"
D=designs/tomoe/design.js
cd "$W" || exit 3
export FOLDING_BROWSER=mini
run() { local name="$1"; shift; echo "== $name"; node "$@" 2>&1 | grep -E "RULES|THIN|FAIL|ERROR|WARN|WROTE|ROWS" | cut -c1-400; echo "   exit ${PIPESTATUS[0]}"; }
run sheet dev/patterns/proto.mjs --design "$D" --out "$OUT/sheet.png" --json "$OUT/rows.json"
run zoom dev/patterns/proto.mjs --design "$D" --out "$OUT/zoom.png" --zoom 1.8 --measure 0
run back dev/patterns/proto.mjs --design "$D" --out "$OUT/back.png" --side back --zoom 1.8 --measure 0
run app-t0 dev/patterns/app-sheet.mjs --design "$D" --t 0 --out "$OUT/app-t0.png" --json "$OUT/polish/app-t0.json"
run app-t06 dev/patterns/app-sheet.mjs --design "$D" --t 0.6 --out "$OUT/app-t06.png" --json "$OUT/polish/app-t06.json"
run app-t1 dev/patterns/app-sheet.mjs --design "$D" --t 1 --out "$OUT/app-t1.png" --json "$OUT/polish/app-t1.json"
run app-back dev/patterns/app-sheet.mjs --design "$D" --t 0.6 --ids 'o,2222,xx,*x,22x,333,442' --view 180/40/1 --out "$OUT/app-back.png"
run app-phone dev/patterns/app-sheet.mjs --design "$D" --phone --t 0.6 --ids 'o,*x,22x,333,*632' --out "$OUT/app-phone.png"
run app-recut dev/patterns/app-sheet.mjs --design "$D" --ids 'xx,22x' --preset 1 --t 0.25 --out "$OUT/app-recut.png"
run app-tile dev/patterns/app-sheet.mjs --design "$D" --ids '2222,*442,333' --tile 0.5 --out "$OUT/app-tile.png"
echo "== done"
