#!/bin/bash
# dev/patterns/scratch-fixer3/wk/run-remote.sh — runs ON THE M5 (wk-fp.sh copies it there and starts it with nohup):
#   bash run-remote.sh <folder>      wk-fp.mjs, then wk-warm.mjs, on <folder>/index.html; writes <folder>/run.log, then
#                                    <folder>/done (the first job's exit status, then the second's)
DIR="$1"
NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
cd "$DIR" || exit 1
"$NODE" "$DIR/wk-fp.mjs" > "$DIR/run.log" 2>&1
A=$?
"$NODE" "$DIR/wk-warm.mjs" >> "$DIR/run.log" 2>&1
echo "$A $?" > "$DIR/done"
