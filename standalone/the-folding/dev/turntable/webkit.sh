#!/bin/bash
# dev/turntable/webkit.sh — run dev/turntable/webkit.mjs in WebKit on the M5 on the built page. From the mini:
#     bash dev/turntable/webkit.sh [host]        (host: an ssh name with Playwright's WebKit; default m5)
# It builds nothing: run `node build.mjs` first.
set -eu
HOST="${1:-m5}"
HERE="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE=/tmp/folding-turntable-webkit
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" "mkdir -p $REMOTE"
scp -q -o ConnectTimeout=15 "$HERE/dist/index.html" "$HERE/dev/turntable/webkit.mjs" "$HOST:$REMOTE/"
STATUS=0
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" "~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node $REMOTE/webkit.mjs $REMOTE" || STATUS=$?
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" "rm -r /tmp/folding-turntable-webkit"
exit $STATUS
