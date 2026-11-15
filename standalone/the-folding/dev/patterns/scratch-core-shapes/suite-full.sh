#!/bin/bash
# scratch (core-shapes): dev/patterns/suite.sh for a few files, but printing node's whole report without the stack traces
# (the diagnostics of a test are lines "# ..."), on the mini, on a copy of the workspace as it is now.
#   bash dev/patterns/scratch-core-shapes/suite-full.sh test/shapes.test.js
set -uo pipefail
W="$(cd "$(dirname "$0")/../../.." && pwd)"
TAG="run-full-$$-$(date +%s)"
R="drive.unsynced/artifacts/the-folding-suite/$TAG"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 mini)
"${SSH[@]}" "mkdir -p ~/$R" || { echo "the mini does not answer" >&2; exit 3; }
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'qa' --exclude 'dist' --exclude 'tools/.mini-pool.json' \
  -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/" "mini:$R/" || { echo "rsync failed" >&2; exit 3; }
ARGS=""
for a in "$@"; do ARGS="$ARGS '$a'"; done
"${SSH[@]}" "cd ~/$R && NODE=''; for n in \"\$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node\" /opt/homebrew/bin/node /usr/local/bin/node; do if [ -x \"\$n\" ] && \"\$n\" --version >/dev/null 2>&1; then NODE=\"\$n\"; break; fi; done; \
  \"\$NODE\" --version; \"\$NODE\" --test --test-reporter=tap $ARGS > report.txt 2>&1; code=\$?; grep -v '^      \\|^    at \\|^  stack\\|^  type\\|^  ---\\|^  \\.\\.\\.\\|^  location\\|^  failureType' report.txt | head -n ${FULL_LINES:-400}; cd ~; rm -rf ~/$R; exit \$code"
code=$?
echo "suite-full.sh: exit $code"
exit $code
