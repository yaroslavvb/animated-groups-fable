#!/bin/bash
# scratch (review-correct): one pattern through extrasym.mjs over all 17 groups (far side; cwd = the copy)
cd "$(dirname "$0")/../../.." || exit 1
node dev/patterns/scratch-review-correct/extrasym.mjs "$1" --json > "../out/sym-$1.txt" 2>&1
echo "done $1 exit $?"
