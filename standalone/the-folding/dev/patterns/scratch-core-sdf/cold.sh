#!/bin/bash
# scratch-core-sdf/cold.sh — the first bake of a fresh process: the module as it is against the experiments named as
# arguments (files of this folder), three rounds at 1024 and one at 512.
#   bash dev/patterns/scratch-core-sdf/cold.sh sdf-split.js sdf-split2.js
cd "$(dirname "$0")/../../.." || exit 1
for k in 1 2 3; do
  node dev/patterns/scratch-core-sdf/cold.mjs 1024 ../../../src/sdf.js
  for m in "$@"; do node dev/patterns/scratch-core-sdf/cold.mjs 1024 "./$m"; done
done
node dev/patterns/scratch-core-sdf/cold.mjs 512 ../../../src/sdf.js
for m in "$@"; do node dev/patterns/scratch-core-sdf/cold.mjs 512 "./$m"; done
