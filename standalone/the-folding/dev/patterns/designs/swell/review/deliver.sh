#!/bin/bash
# review/deliver.sh flat|app1|app2 — the standard picture set of dev/patterns/README.md for Swell, one browser tool at a
# time (FOLDING_BROWSER=mini), into OUT/swell/. Prints one line per picture.
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/swell
P="$W/dev/patterns"
DS=designs/swell/design.js
export FOLDING_BROWSER=mini
run() { echo "== $1"; shift; node "$@" 2>&1 | grep -E 'WROTE|ERROR|rule|problem|overlap|FAIL|warn' | head -8; }
case "$1" in
  flat)
    run sheet "$P/proto.mjs" --design $DS --out "$O/sheet.png" --json "$O/rows.json"
    run zoom "$P/proto.mjs" --design $DS --zoom 1.8 --out "$O/zoom.png"
    run back "$P/proto.mjs" --design $DS --side back --zoom 1.8 --out "$O/back.png"
    ;;
  app1)
    run app-t0 "$P/app-sheet.mjs" --design $DS --t 0 --out "$O/app-t0.png" --json "$O/app-t0.json"
    run app-t06 "$P/app-sheet.mjs" --design $DS --t 0.6 --out "$O/app-t06.png" --json "$O/app-t06.json"
    run app-t1 "$P/app-sheet.mjs" --design $DS --t 1 --out "$O/app-t1.png" --json "$O/app-t1.json"
    ;;
  app2)
    run app-back "$P/app-sheet.mjs" --design $DS --t 0.6 --ids 'o,2222,xx,*x,22x,333,442' --view 180/40/1 --out "$O/app-back.png"
    run app-phone "$P/app-sheet.mjs" --design $DS --phone --t 0.6 --ids 'o,*x,22x,333,*632' --out "$O/app-phone.png"
    run app-recut "$P/app-sheet.mjs" --design $DS --ids 'xx,22x' --preset 1 --t 0.25 --out "$O/app-recut.png"
    run app-tile "$P/app-sheet.mjs" --design $DS --ids '2222,*442,333' --tile 0.5 --out "$O/app-tile.png"
    ;;
  *) echo "usage: deliver.sh flat|app1|app2"; exit 2 ;;
esac
