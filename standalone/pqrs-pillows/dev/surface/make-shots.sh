#!/bin/bash
# make-shots.sh: render every scene-*.json beside this file to shot-*.png (one browser at a time).
HERE="$(cd "$(dirname "$0")" && pwd)"
SHOT=/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/common/shot.mjs
for f in "$HERE"/scene-${1:-}*.json; do
  name="$(basename "$f" .json)"
  node "$SHOT" "$f" "$HERE/shot-${name#scene-}.png" ${2:---cell 1500x420 --width 1540} 2>&1 | tail -1
done
