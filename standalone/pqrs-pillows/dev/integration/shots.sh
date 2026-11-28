#!/bin/bash
# shots.sh — the integrator's pictures of site/index.html, one headless Chrome at a time, through the shared
# page-shot.mjs.  bash dev/integration/shots.sh [name-filter]
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="file://$(cd "$HERE/../.." && pwd)/site/index.html"
SHOT=/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/common/page-shot.mjs
OUT="$HERE/shots"
ONLY="${1:-}"
mkdir -p "$OUT"

# name | hash | eval (may be empty)
WAIT='await new Promise(r=>setTimeout(r,1800));'
INFO='const s=window.__pqrs.surface(), st=window.__pqrs.state(); return { hash: st.hash, key: st.key, on: s.on, started: s.started, error: s.error, fails: s.fails, stats: s.stats && { mean: +(100*s.stats.strainMean).toFixed(2), worst: +(100*s.stats.strainMax).toFixed(2) }, shown: window.__pqrs.shown().map(c=>c.L+" @ "+c.tw).join(" | ") };'
shoot() {
  local name="$1" hash="$2" pre="$3"
  if [ -n "$ONLY" ] && [[ "$name" != *"$ONLY"* ]]; then return; fi
  local ev="(async()=>{ $pre $WAIT $INFO })()"
  echo "== $name  $hash"
  node "$SHOT" "$SITE$hash" "$OUT/desk-$name.png" --size 1280x900 --wait 2200 --eval "$ev"
  node "$SHOT" "$SITE$hash" "$OUT/phone-$name.png" --phone --full --wait 2200 --eval "$ev"
}

shoot 3333 '#k=3333' ''
shoot 2345 '#k=2345' ''
shoot 2223 '#k=2223' ''
shoot 2222 '#k=2222' ''
shoot 3333-tw02 '#k=3333' 'window.__pqrs.set({ tw: 0.2 });'
shoot 3333-j1 '#k=3333&j=1' ''
shoot 3333-j2 '#k=3333&j=2' ''
shoot 3333-card2 '#k=3333' "window.__pqrs.activate('02|13');"
shoot 3333-card3 '#k=3333' "window.__pqrs.activate('03|12');"
echo done
