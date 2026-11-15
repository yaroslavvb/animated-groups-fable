#!/bin/bash
# scratch (review-correct): on the far side (cwd = the copy), moved-sweep.mjs for the three designs, three at a time
cd "$(dirname "$0")/../../.." || exit 1
mkdir -p ../out
printf '%s\n' paisley soft tomoe | xargs -P 3 -n 1 bash dev/patterns/scratch-review-correct/one-moved.sh
cat ../out/moved-*.txt
