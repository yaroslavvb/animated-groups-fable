#!/bin/bash
# scratch (core-shapes): run mutate.mjs on the mini, in a throwaway copy of the workspace as it is now.
set -uo pipefail
W="$(cd "$(dirname "$0")/../../.." && pwd)"
TAG="run-mut-$$-$(date +%s)"
R="drive.unsynced/artifacts/the-folding-suite/$TAG"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 mini)
"${SSH[@]}" "mkdir -p ~/$R" || { echo "the mini does not answer" >&2; exit 3; }
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'qa' --exclude 'dist' --exclude 'tools/.mini-pool.json' \
  -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/" "mini:$R/" || { echo "rsync failed" >&2; exit 3; }
"${SSH[@]}" "cd ~/$R && NODE=''; for n in \"\$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node\" /opt/homebrew/bin/node /usr/local/bin/node; do if [ -x \"\$n\" ] && \"\$n\" --version >/dev/null 2>&1; then NODE=\"\$n\"; break; fi; done; \
  \"\$NODE\" dev/patterns/scratch-core-shapes/mutate.mjs; code=\$?; cd ~; rm -rf ~/$R; exit \$code"
code=$?
echo "mutate.sh: exit $code"
exit $code
