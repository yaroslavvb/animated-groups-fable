#!/bin/bash
# scratch (review-correct): one design through moved-sweep.mjs, 8 moved copies of each group (far side; cwd = the copy)
cd "$(dirname "$0")/../../.." || exit 1
node dev/patterns/scratch-review-correct/moved-sweep.mjs "$1" 8 > "../out/moved-$1.txt" 2>&1
echo "done $1 exit $?"
