#!/bin/bash
# dev/recut/webkit-layout.sh — run the layout checks in WebKit on the M5 (see webkit-layout.mjs). From the mini:
#     bash dev/recut/webkit-layout.sh [host]          (host: an ssh name with Playwright's WebKit; default m5)
# It builds nothing: run `node build.mjs` first, the checks run on dist/index.html.
set -eu
HOST="${1:-m5}"
HERE="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE=/tmp/folding-webkit-layout
STAGE="$(mktemp -d)"
cd "$HERE"
node --input-type=module -e "
import { GROUPS } from './src/groups.js';
import { groupFeatures } from './src/app.js';
import fs from 'node:fs';
fs.writeFileSync(process.argv[1], JSON.stringify(GROUPS.map((g) => ({ id: g.id, features: groupFeatures(g).join(' ') }))));
" "$STAGE/cases.json"
cp dist/index.html test/shell-layout.lib.js dev/recut/webkit-layout.mjs "$STAGE/"
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" "mkdir -p $REMOTE"
scp -q -o ConnectTimeout=15 "$STAGE/index.html" "$STAGE/shell-layout.lib.js" "$STAGE/webkit-layout.mjs" "$STAGE/cases.json" "$HOST:$REMOTE/"
STATUS=0
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" "~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node $REMOTE/webkit-layout.mjs $REMOTE" || STATUS=$?
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" "rm -r /tmp/folding-webkit-layout"
rm -r "${STAGE:?}"
exit $STATUS
