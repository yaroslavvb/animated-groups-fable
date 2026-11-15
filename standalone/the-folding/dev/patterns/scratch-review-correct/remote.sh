#!/bin/bash
# scratch (review-correct, 15 Nov 2026): run a command on a lab box in a throwaway copy of the workspace as it is now,
# through run_remote (capped memory and time). Whatever the command writes to ../out (beside the copy) comes back to
# OUT/review-correct/; the copy is removed. Nothing heavy runs on the Intel.
#   bash dev/patterns/scratch-review-correct/remote.sh <command ...>      (run in the copy's root, e.g. node dev/...mjs)
#   RC_HOST=aifoundry2 bash ...                                          (another box; default aifoundry1)
set -uo pipefail
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-correct
H="${RC_HOST:-aifoundry1}"
TAG="rc-$$-$(date +%s)"
RD="review-correct/$TAG"
RS='ssh -o BatchMode=yes -o ConnectTimeout=10'
mkdir -p "$OUT"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$H" "mkdir -p ~/$RD/W ~/$RD/out" || { echo "remote.sh: $H does not answer" >&2; exit 3; }
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'qa' --exclude 'tools/.mini-pool.json' -e "$RS" "$W/" "$H:$RD/W/" || { echo "remote.sh: rsync failed" >&2; exit 3; }
/Users/yaroslavvb/git0/flush-util/run_remote --host "$H" --max-gb 6 --timeout "${RC_TIMEOUT:-900}" --cd "$RD/W" -- "$@"
code=$?
rsync -a -e "$RS" "$H:$RD/out/" "$OUT/" || echo "remote.sh: nothing copied back" >&2
ssh -o BatchMode=yes -o ConnectTimeout=10 "$H" "rm -rf ~/$RD"
echo "remote.sh: exit $code (on $H)"
exit $code
