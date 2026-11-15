#!/bin/bash
# sheets.sh (fixer, 13 Nov 2026) — the three built-in patterns before (HEAD cd06b92, the git-archive export the app
# reviewer made in review-app/head) and after (the workspace now), one sheet of all 17 groups at a time, in the mini's
# Chrome (dev/recut/sheet.mjs, one browser at a time), pixel by pixel; then the round's baselines (_baseline/) against
# the workspace. Output: OUT/fixer/sheets/.
#   bash dev/patterns/scratch-fixer/sheets.sh
set -u
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer/sheets
WS=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
HD=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-app/head/standalone/the-folding
BL=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/_baseline
DIFF=$WS/dev/patterns/scratch-fixer/pngdiff.mjs
LABELS='o,2222,**,xx,*x,333,22x,22*,*2222,2*22,442,632,3*3,*333,4*2,*442,*632,-'
mkdir -p "$OUT"
for spec in "checker 0" "checker 0.6" "rings 0" "rings 0.6" "rings 1" "comma 0" "comma 0.6"; do
  set -- $spec
  pat=$1; t=$2; tag="$pat-t$(echo "$t" | tr -d '.')"
  (cd "$WS" && FOLDING_BROWSER=mini node dev/recut/sheet.mjs --t "$t" --pat "$pat" --out "$OUT/$tag.png" 2>&1 | tail -1)
  (cd "$HD" && FOLDING_BROWSER=mini node dev/recut/sheet.mjs --t "$t" --pat "$pat" --out "$OUT/head-$tag.png" 2>&1 | tail -1)
  echo "== $tag: HEAD against the workspace"
  node "$DIFF" "$OUT/head-$tag.png" "$OUT/$tag.png" --out "$OUT/diff-$tag.png" --grid 3x6 --cell 388x261 --origin 10x10 --labels "$LABELS"
done
echo "== the baselines (15:41) against the workspace and against HEAD"
for b in checker-t0 comma-t06 rings-t1; do
  echo "-- $b"; node "$DIFF" "$BL/$b.png" "$OUT/$b.png"; node "$DIFF" "$BL/$b.png" "$OUT/head-$b.png"
done
