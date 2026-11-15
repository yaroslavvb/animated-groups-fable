#!/bin/bash
# dev/patterns/scratch-review-webkit/run-remote.sh — runs ON THE M5 (wk-bg.sh copies it there and starts it with nohup):
#   bash run-remote.sh <review|gate> <folder>    writes <folder>/run.log, then <folder>/done (the job's exit status)
JOB="$1"
DIR="$2"
NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
cd "$DIR" || exit 1
if [ "$JOB" = gate ]; then
  "$NODE" "$DIR/webkit-layout.mjs" "$DIR" > "$DIR/run.log" 2>&1
elif [ "$JOB" = fp ]; then
  "$NODE" "$DIR/wk-fp.mjs" > "$DIR/run.log" 2>&1
elif [ "$JOB" = tile ]; then
  "$NODE" "$DIR/wk-tile.mjs" > "$DIR/run.log" 2>&1
else
  "$NODE" "$DIR/wk.mjs" > "$DIR/run.log" 2>&1
fi
echo $? > "$DIR/done"
