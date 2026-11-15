#!/bin/bash
# dev/remote.sh — run one of this folder's node tools on the mini, on a copy of src/, kit.js and this design's folder
# (nothing heavy runs on this Mac).   bash remote.sh tune2.mjs --ids 442,333 ...
# The tool's output comes back on stdout; what it wrote into dev/out/ is copied back into this folder's dev/out/.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
W="$(cd "$HERE/../../../../.." && pwd)"
R="drive.unsynced/artifacts/the-folding-suite/hook-tune"
SSHOPT='ssh -o BatchMode=yes -o ConnectTimeout=10'
ssh -o BatchMode=yes -o ConnectTimeout=10 mini "mkdir -p ~/$R/src ~/$R/dev/patterns/designs/hook/dev/out" || { echo "remote.sh: the mini does not answer" >&2; exit 3; }
rsync -a --delete -e "$SSHOPT" "$W/src/" "mini:$R/src/" || exit 3
rsync -a -e "$SSHOPT" "$W/dev/patterns/kit.js" "mini:$R/dev/patterns/kit.js" || exit 3
rsync -a -e "$SSHOPT" "$W/dev/patterns/designs/hook/" "mini:$R/dev/patterns/designs/hook/" || exit 3
TOOL="$1"; shift
ARGS=""; for a in "$@"; do ARGS="$ARGS '$a'"; done
ssh -o BatchMode=yes -o ConnectTimeout=10 mini "cd ~/$R/dev/patterns/designs/hook/dev && nice -n 5 /opt/homebrew/bin/node $TOOL $ARGS"
code=$?
mkdir -p "$HERE/out"
rsync -a -e "$SSHOPT" "mini:$R/dev/patterns/designs/hook/dev/out/" "$HERE/out/" || true
echo "remote.sh: exit $code"
exit $code
