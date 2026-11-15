#!/bin/bash
# lab/r2/final-checks.sh — the node checks of the delivered design, one after another, outputs kept in OUT/paisley/r2/:
# the table (ev.mjs), the same without presets, turned/scaled/shifted groups (validate-moved.mjs), determinism.
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
O=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/paisley/r2
L=dev/patterns/designs/paisley/lab
node $L/r2/ev.mjs > $O/final-ev.txt 2>&1; tail -1 $O/final-ev.txt
node $L/r2/ev.mjs --bare 1 > $O/final-ev-nopresets.txt 2>&1; tail -1 $O/final-ev-nopresets.txt
node $L/validate-moved.mjs > $O/final-moved.txt 2>&1; tail -1 $O/final-moved.txt
node $L/determinism.mjs 2>&1 | tail -1
