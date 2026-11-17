// tabs/zip.js — the "Zippers" tab: the four things a zipper can make (pp. 94-95), on a patch of sheet.
// One hole or two, arrows opposite or the same: cap, crosscap, handle, cross-handle. The scrubber zips and unzips.

import { Scene } from '../geo/scene.js';
import { flatPatch } from '../geo/layouts.js';
import { addCap, addCrosscapFeature, addTube } from '../geo/features.js';
import { THEME } from '../theme.js';
import { M } from '../mathbank.js';

const KINDS = {
  cap: { name: 'a cap: nothing new', sym: null, view: { az: -18, el: 52 } },
  crosscap: { name: 'a crosscap', sym: 'sym:x', view: { az: -24, el: 34 } },
  handle: { name: 'a handle', sym: 'sym:o', view: { az: -20, el: 34 } },
  crosshandle: { name: 'a cross-handle', sym: 'sym:X', view: { az: -24, el: 24 } },
};

export function createZipTab(ctx) {
  const { stage, timeline, badge } = ctx;
  const picks = [...document.querySelectorAll('.pick')];
  let kind = 'cap', t = 0;

  function build() {
    const two = kind === 'handle' || kind === 'crosshandle';
    const L = flatPatch(two ? 2 : 1);
    const scene = new Scene();
    const progress = () => t;
    if (kind === 'cap') addCap(scene, L, 0, { progress });
    else if (kind === 'crosscap') addCrosscapFeature(scene, L, 0, { progress });
    else addTube(scene, L, 0, 1, { cross: kind === 'crosshandle', progress });
    const outline = Float32Array.from(L.outline.flat());
    scene.addLines(() => ({ points: outline, color: THEME.soft, width: 1.3, loop: true, xray: 0.6 }));
    stage.setScene(scene, L.frame);
  }
  function showBadge() {
    const K = KINDS[kind];
    badge.innerHTML = t >= 0.999 ? `${K.sym ? `<span class="badge-sym">${M(K.sym)}</span>` : ''}<span class="badge-name">${K.name}</span>` : '';
  }
  function setKind(k, keepT = false) {
    if (!KINDS[k]) return;
    kind = k;
    if (!keepT) { t = 0; timeline.set(0); }
    for (const b of picks) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
    build();
    stage.R.setView(KINDS[kind].view);
    stage.R.render();
    showBadge();
    ctx.changed();
  }
  for (const b of picks) b.addEventListener('click', () => setKind(b.dataset.kind));

  return {
    enter() { timeline.setDuration(3.4); timeline.set(t); setKind(kind, true); },
    leave() { timeline.stop(); },
    setT(v) { t = v; stage.refresh(); showBadge(); },
    when() { return 'zip:' + kind; },
    get() { return { kind, t }; },
    set(s) { if (s.kind && KINDS[s.kind]) kind = s.kind; if (Number.isFinite(s.t)) t = Math.min(1, Math.max(0, s.t)); },
    setKind,
  };
}
