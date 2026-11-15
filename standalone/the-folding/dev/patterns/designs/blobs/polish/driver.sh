#!/bin/bash
# polish/driver.sh — runs on the lab box (sent by polish/remote.sh): every line of jobs.txt, at most PS_PAR (12) at a
# time, from the blobs folder of the copy; job n's stdout goes to out/n.txt, its stderr to out/n.err.
cd "$(dirname "$0")"
ROOT="$(pwd)"
export PATH="$HOME/.local/bin:$PATH"
awk 'NF { n++; print n "\t" $0 }' jobs.txt > jobs.numbered
run_one() {
  local n="${1%%$'\t'*}" cmd="${1#*$'\t'}"
  (cd "$ROOT/W/dev/patterns/designs/blobs" && eval "$cmd") > "$ROOT/out/$n.txt" 2> "$ROOT/out/$n.err"
  echo "job $n exit $?"
}
export -f run_one
export ROOT
xargs -P "${PS_PAR:-12}" -d '\n' -I{} bash -c 'run_one "$1"' _ {} < jobs.numbered
