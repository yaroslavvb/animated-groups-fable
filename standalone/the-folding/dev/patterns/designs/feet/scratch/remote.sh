#!/bin/bash
# scratch: run a node script of this workspace on the mini (a copy of the workspace as it is now), so nothing heavy runs
# on this Mac. Modelled on dev/patterns/suite.sh.
#   bash dev/patterns/designs/feet/scratch/remote.sh dev/patterns/designs/feet/scratch/verify.mjs [args]
set -uo pipefail
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
TAG="feet-$$-$(date +%s)"
R="drive.unsynced/artifacts/the-folding-suite/$TAG"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 mini)
"${SSH[@]}" "mkdir -p ~/$R" || { echo "remote.sh: the mini does not answer" >&2; exit 3; }
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'qa' --exclude 'dist' --exclude 'lab22x' --exclude 'notes' --exclude 'tools/.mini-pool.json' \
  -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/" "mini:$R/" || { echo "remote.sh: rsync failed" >&2; exit 3; }
ARGS=""
for a in "$@"; do ARGS="$ARGS '$a'"; done
"${SSH[@]}" "cd ~/$R && NODE=''; for n in \"\$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node\" /opt/homebrew/bin/node /usr/local/bin/node; do if [ -x \"\$n\" ] && \"\$n\" --version >/dev/null 2>&1; then NODE=\"\$n\"; break; fi; done; \"\$NODE\" $ARGS; code=\$?; cd ~; rm -rf ~/${R:?}; exit \$code"
code=$?
echo "remote.sh: exit $code"
exit $code
