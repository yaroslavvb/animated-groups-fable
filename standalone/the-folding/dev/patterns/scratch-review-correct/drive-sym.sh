#!/bin/bash
# scratch (review-correct): on the far side (cwd = the copy of the workspace), extrasym.mjs for the four shape patterns,
# four at a time, each into ../out/sym-<key>.txt
cd "$(dirname "$0")/../../.." || exit 1
mkdir -p ../out
node --version
printf '%s\n' paisley soft tomoe comma | xargs -P 4 -n 1 bash dev/patterns/scratch-review-correct/one-sym.sh
ls -la ../out
