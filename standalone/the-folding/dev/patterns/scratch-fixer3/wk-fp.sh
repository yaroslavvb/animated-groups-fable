#!/bin/bash
# dev/patterns/scratch-fixer3/wk-fp.sh — the fixer (15 Nov 2026): every print's motif in WebKit on the M5, on the BUILT page
# (dist/index.html as it is now), to OUT/fixer3/fp/fp-webkit.json, and the warmer there (warm-webkit.json); after the WebKit reviewer's wk-bg.sh (the M5 drops off
# the tailnet now and then: wait for it, start the job detached there, wait for its done-file, fetch, clean up).
#   bash dev/patterns/scratch-fixer3/wk-fp.sh          (run it with run_in_background)
set -u
HOST=m5
W=/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding
HERE="$W/dev/patterns/scratch-fixer3/wk"
OUT=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer3/fp
STAGE=/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer3/wk-stage
REMOTE=/tmp/folding-fixer3-fp
SSH="ssh -o ConnectTimeout=10 -o BatchMode=yes -o ServerAliveInterval=10 -o ServerAliveCountMax=3"
mkdir -p "$OUT" "$STAGE"
cp "$W/dist/index.html" "$STAGE/index.html"
say() { echo "$(date +%H:%M:%S) $*"; }
up() { $SSH "$HOST" true 2>/dev/null; }
wait_up() { for i in $(seq 1 60); do if up; then return 0; fi; sleep 20; done; return 1; }
wait_up || { say "the M5 never answered"; exit 2; }
for i in 1 2 3 4 5; do
  if $SSH "$HOST" "rm -rf $REMOTE; mkdir -p $REMOTE/out" && scp -q -o ConnectTimeout=10 "$STAGE/index.html" "$HERE/fp-lib.mjs" "$HERE/wk-fp.mjs" "$HERE/wk-warm.mjs" "$HERE/run-remote.sh" "$HOST:$REMOTE/"; then break; fi
  say "copy failed, waiting"; wait_up || exit 2
done
for i in 1 2 3 4 5; do
  if $SSH "$HOST" "nohup bash $REMOTE/run-remote.sh $REMOTE > /dev/null 2>&1 < /dev/null &"; then break; fi
  say "start failed, waiting"; wait_up || exit 2
done
say "started on the M5"
for i in $(seq 1 120); do
  sleep 10
  if $SSH "$HOST" "test -f $REMOTE/done" 2>/dev/null; then break; fi
done
for i in 1 2 3 4 5; do
  if scp -q -o ConnectTimeout=10 "$HOST:$REMOTE/run.log" "$HOST:$REMOTE/done" "$OUT/" && scp -q -o ConnectTimeout=10 "$HOST:$REMOTE/out/*" "$OUT/"; then break; fi
  say "fetch failed, waiting"; wait_up || exit 2
done
$SSH "$HOST" "rm -r ${REMOTE:?}" || say "could not remove $REMOTE on the M5"
say "exit status of the job: $(cat "$OUT/done" 2>/dev/null)"
cat "$OUT/run.log"
