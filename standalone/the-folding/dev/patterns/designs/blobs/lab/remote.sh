#!/bin/bash
# lab/remote.sh <out file> <script under lab/> [args...] — copy what the lab needs to a lab box and run the script there
# under run_remote (capped memory and time, nice 19); its stdout goes to <out file>, its stderr to the terminal.
#   bash lab/remote.sh /path/out.json search-all.mjs --seeds 2 --samples 600
# Nothing heavy runs on this Mac. BLOBS_HOST picks the box (default aifoundry1).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
W="$(cd "$HERE/../../../../.." && pwd)"
HOST="${BLOBS_HOST:-aifoundry1}"
R="blobs-lab"
OUT="$1"; shift
SCRIPT="$1"; shift
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" "mkdir -p $R/src $R/dev/patterns/designs/blobs" || { echo "remote.sh: $HOST does not answer" >&2; exit 3; }
rsync -a --delete -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/src/" "$HOST:$R/src/" || exit 3
rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/package.json" "$HOST:$R/package.json" || exit 3
rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$W/dev/patterns/kit.js" "$HOST:$R/dev/patterns/kit.js" || exit 3
rsync -a --delete -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' "$HERE/../" "$HOST:$R/dev/patterns/designs/blobs/" || exit 3
mkdir -p "$(dirname "$OUT")"
"$HOME/git0/flush-util/run_remote" --host "$HOST" --max-gb "${BLOBS_GB:-6}" --timeout "${BLOBS_TIMEOUT:-1500}" --cd "$R" -- \
  /home/yaroslavvb/.local/bin/node "dev/patterns/designs/blobs/lab/$SCRIPT" "$@" > "$OUT"
code=$?
echo "remote.sh: exit $code, $(wc -c < "$OUT") bytes in $OUT"
exit $code
