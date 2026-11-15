#!/bin/bash
# review/lab.sh <out-name> [lab.mjs options...] — the node lab sheet (no browser) into OUT/swell/review/<out-name>.png,
# one summary line per group. Run from anywhere.
D=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/dev/patterns/designs/swell
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/swell/review
name="$1"; shift
cd "$D/lab" || exit 1
node lab.mjs "$@" --out "$OUT/$name.png" 2>&1 | node "$D/review/sum.mjs"
