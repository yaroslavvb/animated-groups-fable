#!/bin/bash
# dev/patterns/scratch-review-webkit/wk.sh — run wk.mjs (lib.mjs's review) in WebKit on the M5 and bring its pictures and
# report back to OUT/review-webkit/webkit[-quick]/. QUICK=1 in front: two patterns, two groups, no phone and no timing.
set -eu
HOST=m5
HERE=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/dev/patterns/scratch-review-webkit
REMOTE=/tmp/folding-review-webkit
NODE='~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
SUFFIX=""
if [ "${QUICK:-0}" = "1" ]; then SUFFIX="-quick"; fi
OUT="/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit/webkit$SUFFIX"
mkdir -p "$OUT"
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" "mkdir -p $REMOTE/out"
scp -q -o ConnectTimeout=15 "$HERE/stage/index.html" "$HERE/lib.mjs" "$HERE/wk.mjs" "$HOST:$REMOTE/"
STATUS=0
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" "QUICK=${QUICK:-0} $NODE $REMOTE/wk.mjs" || STATUS=$?
scp -q -o ConnectTimeout=15 "$HOST:$REMOTE/out/*" "$OUT/" || STATUS=$?
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" "rm -r /tmp/folding-review-webkit"
ls "$OUT" | wc -l
exit $STATUS
