#!/bin/bash
# The far side of dev/remote.sh (run on aifoundry1 from the home folder): every line of ~/tomoe-search/jobs.txt is one
# `node` call in the design folder, [parallel] at a time.
set -uo pipefail
cd "$HOME/tomoe-search/W/dev/patterns/designs/tomoe" || exit 3
mkdir -p dev/out
xargs -P "${1:-8}" -L 1 node < "$HOME/tomoe-search/jobs.txt"
