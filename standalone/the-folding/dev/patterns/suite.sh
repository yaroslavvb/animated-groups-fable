#!/bin/bash
# dev/patterns/suite.sh — the WHOLE suite (test/ and lab22x/test/) on the mini, on a copy of THIS workspace as it is now
# (tools/test-all.mjs sends src/, test/ and tools/ only, so it cannot run the lab's tests). Nothing heavy runs on this Mac.
#   bash dev/patterns/suite.sh                              everything (about a minute)
#   bash dev/patterns/suite.sh test/pattern.test.js         some files (paths relative to the workspace; globs in quotes)
# Prints the last lines of node's report and exits with the suite's code. Each run has its own copy, removed afterwards.
set -uo pipefail
W="$(cd "$(dirname "$0")/../.." && pwd)"
TAG="run-$$-$(date +%s)"
R="drive.unsynced/artifacts/the-folding-suite/$TAG"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 mini)
"${SSH[@]}" "mkdir -p ~/$R" || { echo "suite.sh: the mini does not answer" >&2; exit 3; }
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'qa' --exclude 'dist' --exclude 'tools/.mini-pool.json' \
  -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/" "mini:$R/" || { echo "suite.sh: rsync failed" >&2; exit 3; }
# lab22x/dist is read by a test of the lab: keep it (the exclude above is anchored nowhere, so send it explicitly)
if [ -d "$W/lab22x/dist" ]; then rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/lab22x/dist/" "mini:$R/lab22x/dist/" || true; fi
if [ -d "$W/dist" ]; then rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/dist/" "mini:$R/dist/" || true; fi
ARGS=""
if [ "$#" -eq 0 ]; then ARGS="'test/**/*.test.js' 'lab22x/test/*.test.js'"; else for a in "$@"; do ARGS="$ARGS '$a'"; done; fi
"${SSH[@]}" "cd ~/$R && NODE=''; for n in \"\$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node\" /opt/homebrew/bin/node /usr/local/bin/node; do if [ -x \"\$n\" ] && \"\$n\" --version >/dev/null 2>&1; then NODE=\"\$n\"; break; fi; done; \
  \"\$NODE\" --test --test-reporter=tap --test-concurrency=${SUITE_WORKERS:-6} $ARGS > report.txt 2>&1; code=\$?; grep -n '^not ok\\|^# \\(tests\\|pass\\|fail\\|cancelled\\|skipped\\|duration_ms\\)' report.txt | tail -n 40; if [ \$code -ne 0 ]; then echo '--- first failures ---'; grep -n -B2 -A28 '^not ok' report.txt | head -n ${SUITE_LINES:-160}; fi; cd ~; rm -rf ~/$R; exit \$code"
code=$?
echo "suite.sh: exit $code"
exit $code
