#!/bin/bash
# dev/patterns/scratch-fixer3/plant-sharp.sh — the fixer (15 Nov 2026): the sharp check made to read one side of an outline
# only (the dark side: the review's P7c; the light side: its mirror), each in a copy of src/ and test/ in the scratchpad,
# then test/pattern.test.js on the copy: both must fail it. Nothing in the workspace is touched.
#   bash dev/patterns/scratch-fixer3/plant-sharp.sh
set -u
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
S=/Users/yaroslavvb/.ctmp/claude-501/-Users-yaroslavvb-git-animated-groups-fable/cc3b1316-130e-516c-9006-dc6da49f820b/scratchpad/plant-sharp
for side in dark light; do
  rm -rf "${S:?}/$side"
  mkdir -p "$S/$side"
  cp -R "$W/src" "$W/test" "$W/package.json" "$S/$side/"
  node -e '
    const fs = require("fs"), f = process.argv[1], side = process.argv[2];
    const from = "      if (!keeps(x + nx, y + ny) || !keeps(x - nx, y - ny)) return false;";
    const to = side === "dark" ? "      if (!keeps(x + nx, y + ny)) return false;" : "      if (!keeps(x - nx, y - ny)) return false;";
    const t = fs.readFileSync(f, "utf8");
    if (t.split(from).length !== 2) { console.log("NOT PLANTED"); process.exit(2); }
    fs.writeFileSync(f, t.replace(from, to));
  ' "$S/$side/src/pattern.js" "$side" || continue
  (cd "$S/$side" && node --test --test-reporter=tap test/pattern.test.js > report.txt 2>&1)
  echo "$side side only: $(grep -c '^not ok' "$S/$side/report.txt") failing test(s): $(grep '^not ok' "$S/$side/report.txt" | cut -c1-120)"
  rm -rf "${S:?}/$side"
done
