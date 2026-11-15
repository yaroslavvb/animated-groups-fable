#!/bin/bash
# dev/patterns/scratch-review-webkit/wk-bg.sh — a WebKit job on the M5 when the M5 can be reached (it drops off the
# tailnet now and then): wait for it, copy, start the job DETACHED there (a dropped ssh does not kill it), wait for its
# done-file, fetch what it wrote to OUT/review-webkit/webkit-<job>/, clean up. Run with run_in_background.
#   bash wk-bg.sh review    wk.mjs: lib.mjs's review on the staged build (stage/index.html)
#   bash wk-bg.sh gate      dev/recut/webkit-layout.mjs, the layout gate, on the files in gate/ (made by gate-prep.mjs)
set -u
JOB="${1:-review}"
HOST=m5
HERE=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/dev/patterns/scratch-review-webkit
REMOTE="/tmp/folding-review-webkit-$JOB"
OUT="/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit/webkit-$JOB"
SSH="ssh -o ConnectTimeout=10 -o BatchMode=yes -o ServerAliveInterval=10 -o ServerAliveCountMax=3"
mkdir -p "$OUT"
say() { echo "$(date +%H:%M:%S) $*"; }
up() { $SSH "$HOST" true 2>/dev/null; }
wait_up() { for i in $(seq 1 120); do if up; then return 0; fi; sleep 20; done; return 1; }
if [ "$JOB" = gate ]; then FILES="$HERE/gate/index.html $HERE/gate/shell-layout.lib.js $HERE/gate/webkit-layout.mjs $HERE/gate/cases.json $HERE/run-remote.sh"
elif [ "$JOB" = fp ]; then FILES="$HERE/stage/index.html $HERE/fp-lib.mjs $HERE/wk-fp.mjs $HERE/run-remote.sh"
elif [ "$JOB" = tile ]; then FILES="$HERE/stage/index.html $HERE/tile-lib.mjs $HERE/wk-tile.mjs $HERE/run-remote.sh"
else FILES="$HERE/stage/index.html $HERE/lib.mjs $HERE/wk.mjs $HERE/run-remote.sh"; fi

wait_up || { say "the M5 never answered"; exit 2; }
say "the M5 answers; copying"
for i in 1 2 3 4 5; do
  if $SSH "$HOST" "mkdir -p $REMOTE/out" && scp -q -o ConnectTimeout=10 $FILES "$HOST:$REMOTE/"; then break; fi
  say "copy failed, waiting"; wait_up || exit 2
done
for i in 1 2 3 4 5; do
  if $SSH "$HOST" "nohup bash $REMOTE/run-remote.sh $JOB $REMOTE > /dev/null 2>&1 < /dev/null &"; then break; fi
  say "start failed, waiting"; wait_up || exit 2
done
say "started $JOB on the M5"
for i in $(seq 1 240); do
  sleep 15
  if $SSH "$HOST" "test -f $REMOTE/done" 2>/dev/null; then break; fi
done
say "done-file seen (or gave up); fetching"
for i in 1 2 3 4 5; do
  if scp -q -o ConnectTimeout=10 "$HOST:$REMOTE/run.log" "$HOST:$REMOTE/done" "$OUT/"; then
    if [ "$JOB" = gate ] || scp -q -o ConnectTimeout=10 "$HOST:$REMOTE/out/*" "$OUT/"; then break; fi
  fi
  say "fetch failed, waiting"; wait_up || exit 2
done
$SSH "$HOST" "rm -r ${REMOTE:?}" || say "could not remove $REMOTE on the M5"
say "fetched: $(ls "$OUT" | wc -l) files; exit status of the job: $(cat "$OUT/done" 2>/dev/null)"
cat "$OUT/run.log"
