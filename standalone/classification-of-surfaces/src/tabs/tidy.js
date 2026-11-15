// tabs/tidy.js — tab 2, "Tidy surfaces": a sphere with holes, handles, crosscaps and cross-handles (p. 96), built
// with four steppers. Each new piece is zipped on in front of you. The two trades of pp. 101-102 turn every tidy
// surface into one of the two normal forms of Theorem 8.2; the three numbers of p. 102 tell the forms apart.

import { Scene, crossProfile } from '../geo/scene.js';
import { ball, neighbourPairs } from '../geo/layouts.js';
import { addEmpty, addHole, addCrosscapFeature, addTube, ZIP_COLORS } from '../geo/features.js';
import { SIZES } from '../geo/layouts.js';
import { ramp, smooth, norm, dot } from '../geo/vec.js';
import { M, num, symbol } from '../mathbank.js';

const SITES = 12;
const NEED = { star: 1, x: 1, o: 2, X: 2 };
const NAMES = { star: ['hole', 'holes'], o: ['handle', 'handles'], x: ['crosscap', 'crosscaps'], X: ['cross-handle', 'cross-handles'] };

export function countsOf(features) {
  const c = { o: 0, star: 0, x: 0, X: 0 };
  for (const f of features) c[f.type]++;
  return c;
}
export const chiOf = (c) => 2 - 2 * c.o - c.star - c.x - 2 * c.X;
export function describe(c) {
  const parts = [];
  for (const k of ['o', 'star', 'x', 'X']) if (c[k]) parts.push(`${c[k]} ${NAMES[k][c[k] === 1 ? 0 : 1]}`);
  return parts.length ? 'a sphere with ' + parts.join(', ') : 'a sphere';
}

export function createTidyTab(ctx) {
  const { stage, badge } = ctx;
  const L = ball({ n: 40, look: 'vertex' });
  // Site 0 and the five sites round it are the tightest cluster of six: pieces go there first, so that they can be
  // seen together; the view then turns to face what is on the ball (lookAtPieces).
  const ORDER = L.sites.map((s, i) => i);
  const MATCH = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]];
  const PAIRS = MATCH.concat(neighbourPairs(L).filter(([a, b]) => !MATCH.some(([c, d]) => c === a && d === b)));
  let features = [];          // { type, sites: [..], p }   p: 0 just born .. 1 zipped on
  let cancel = null, busy = false, seq = 0;
  const steppers = [...document.querySelectorAll('#steppers .stepper')];
  const tradeX = document.getElementById('trade-X'), tradeO = document.getElementById('trade-o');

  const used = () => new Set(features.flatMap((f) => f.sites));
  const free = () => SITES - used().size;
  function place(type, taken = used()) {
    if (NEED[type] === 2) { for (const [a, b] of PAIRS) if (!taken.has(a) && !taken.has(b)) return [a, b]; return null; }
    for (const s of ORDER) if (!taken.has(s)) return [s];
    return null;
  }
  /** Put every feature somewhere again: tubes first (they need two neighbouring sites), then the rest. */
  function repack(order = null) {
    const taken = new Set();
    const list = features.slice().sort((a, b) => NEED[b.type] - NEED[a.type]);
    for (const f of list) {
      let s = null;
      if (order && NEED[f.type] === 1) { for (const c of order) if (!taken.has(c)) { s = [c]; break; } }
      else if (order) { const ps = PAIRS.slice().sort((p, q) => order.indexOf(p[0]) + order.indexOf(p[1]) - order.indexOf(q[0]) - order.indexOf(q[1])); for (const [a, b] of ps) if (!taken.has(a) && !taken.has(b)) { s = [a, b]; break; } }
      if (!s) s = place(f.type, taken);
      if (!s) return false;
      f.sites = s; s.forEach((x) => taken.add(x));
    }
    return true;
  }

  function build() {
    const scene = new Scene(), at = new Map();
    for (const f of features) f.sites.forEach((s) => at.set(s, f));
    const done = new Set();
    for (let s = 0; s < SITES; s++) {
      const f = at.get(s);
      if (!f) { addEmpty(scene, L, s); continue; }
      if (done.has(f)) continue;
      done.add(f);
      const open = () => ramp(f.p, 0, 0.22);
      const prog = () => Math.max(0, (f.p - 0.22) / 0.78);
      if (f.type === 'star') addHole(scene, L, s, { r: () => SIZES.hole * 1.1 * smooth(f.p) });
      else if (f.type === 'x') addCrosscapFeature(scene, L, s, { progress: prog, open, color: ZIP_COLORS[0], axis: 0.6 });
      else addTube(scene, L, f.sites[0], f.sites[1], { cross: f.type === 'X', progress: prog, open, color: ZIP_COLORS[0], arrowB: () => (f.walking ? 0 : 1) });
    }
    stage.setScene(scene, { center: L.frame.center, radius: 1.6 * (L.R || 1) }, false);      // room round the ball: handles stay clear of the badge
  }
  /** Turn the view to face the middle of the pieces (a little from above), unless the person is turning it. */
  function lookAtPieces(seconds = 0.7) {
    const m = [0, 0, 0.0001];
    for (const f of features) for (const s of f.sites) { const n = L.sites[s].site.n; m[0] += n[0]; m[1] += n[1]; m[2] += n[2]; }
    const l = Math.hypot(m[0], m[1], m[2]);
    if (!features.length || l < 0.35) return;
    const d = norm([m[0] / l, m[1] / l, m[2] / l + 0.3]);
    stage.lookFrom(d, seconds);
  }

  function readout() {
    const c = countsOf(features);
    for (const st of steppers) {
      const k = st.dataset.f;
      st.querySelector('.st-val').textContent = String(c[k]);
      st.querySelector('[data-d="-1"]').disabled = c[k] === 0;
      st.querySelector('[data-d="1"]').disabled = free() < NEED[k];
    }
    badge.innerHTML = `${features.length ? `<span class="badge-sym">${symbol(c)}</span>` : ''}<span class="badge-name">${describe(c)}</span>`;
    document.getElementById('fact-chi').innerHTML = `${M('chi')} ${M('eq')} ${num(chiOf(c))}`;
    document.getElementById('fact-b').innerHTML = num(c.star);
    document.getElementById('fact-sides').textContent = c.x + c.X > 0 ? 'one' : 'two';
    tradeX.hidden = c.X === 0;
    tradeO.hidden = !(c.o > 0 && c.x > 0);
    ctx.changed();
  }

  function settle() { if (cancel) { cancel(); cancel = null; } stage.extraLines = null; for (const f of features) { f.p = 1; f.walking = false; } busy = false; seq++; }

  function grow(f, seconds, after) {
    busy = true;
    const mine = ++seq;
    cancel = stage.animate(seconds, (u) => { f.p = u; }, () => { cancel = null; busy = false; if (mine === seq && after) after(); });
  }

  function add(type, sites = null, animate = true) {
    settle();
    if (free() < NEED[type]) return false;
    let s = sites || place(type);
    const f = { type, sites: s || [], p: animate ? 0 : 1 };
    features.push(f);
    if (!s && !repack()) { features.pop(); return false; }
    build(); readout(); lookAtPieces();
    if (animate) grow(f, type === 'star' ? 0.5 : type === 'x' ? 1.7 : 2.1);
    return true;
  }
  function remove(type) {
    settle();
    const i = features.map((f) => f.type).lastIndexOf(type);
    if (i < 0) return;
    features.splice(i, 1);
    build(); readout();
  }
  function setAll(c, animate = false) {
    settle();
    features = [];
    for (const k of ['o', 'X', 'x', 'star']) for (let i = 0; i < (c[k] || 0); i++) features.push({ type: k, sites: [], p: 1 });
    if (!repack()) features = [];
    build(); readout(); lookAtPieces();
  }

  // The trades. A cross-handle unzips into its two holes and each is zipped again as a crosscap (Figure 8.10 says
  // why that is the same surface: tab 3 lets you do it). A handle beside a crosscap: one of its holes takes a walk
  // through the crosscap and comes back reversed, so the handle is a cross-handle, which is two crosscaps.
  function trade(from) {
    settle();
    const f = features.filter((x) => x.type === from).pop();
    if (!f) return;
    if (from === 'o') { walk(f); return; }
    busy = true;
    const mine = ++seq;
    cancel = stage.animate(0.9, (u) => { f.p = 1 - 0.78 * u; }, () => {
      cancel = null;
      if (mine !== seq) return;
      const [a, b] = f.sites;
      features.splice(features.indexOf(f), 1);
      const n1 = { type: 'x', sites: [a], p: 0.22 }, n2 = { type: 'x', sites: [b], p: 0.22 };
      features.push(n1, n2);
      build(); readout();
      cancel = stage.animate(1.5, (u) => { n1.p = n2.p = 0.22 + 0.78 * u; }, () => { cancel = null; busy = false; });
    });
  }

  // Figure 8.11. The handle unzips into its two holes; the rim of the one nearer the crosscap, arrow and all, goes
  // straight through the crosscap and home round it. On the far side of the crossing left and right have changed
  // places, so it comes home with its arrow the other way: the two holes now say "cross-handle", and are zipped so.
  const AXIS = 0.6;                    // the crosscaps of this tab are built with their lobes along this chart angle
  function ringAt(C, thetaIn, Db, u) {
    const R = L.R || 1, rc = SIZES.rc * R, H = SIZES.H * R, k = SIZES.k * R, out = rc + 0.12 * R, l0 = 0.13 * R;
    const L1 = Db + out, L2 = Math.PI * out, L3 = Db - out, s = u * (L1 + L2 + L3);
    const eps = (SIZES.rt + SIZES.f) * R * (1 - 0.5 * (ramp(u, 0, 0.14) - ramp(u, 0.86, 1)));
    let st = 0, phi = thetaIn, mode = 0;       // mode 0: on the straight line through the crosscap (st signed); 1: beyond it
    if (s < L1) st = Db - s;
    else if (s < L1 + L2) { mode = 1; st = -out; phi = thetaIn + (s - L1) / out; }
    else { mode = 1; st = -(out + (s - L1 - L2)); phi = thetaIn + Math.PI; }
    const pts = [], N = 40, buf = [0, 0, 0];
    for (let i = 0; i <= N; i++) {
      const al = (2 * Math.PI * i) / N, sp = st + eps * Math.cos(al), rho = Math.abs(sp);
      const th = phi + (sp < 0 ? Math.PI : 0) + (eps * Math.sin(al)) / Math.max(R * Math.sin(Math.min(rho / R, Math.PI / 2)), l0);
      const t = rho / rc, z = t < 1 ? Math.pow(1 - t * t, 1.6) * (H + k * crossProfile(th - AXIS)) : 0;
      C.toWorld(rho * Math.cos(th), rho * Math.sin(th), z, buf, 0);
      pts.push(buf[0], buf[1], buf[2]);
    }
    return { pts, eps, mode };
  }
  function walk(f) {
    const caps = features.filter((x) => x.type === 'x');
    if (!caps.length) return;
    const n = (s) => L.sites[s].site.n;
    // the crosscap and the hole of the handle that are nearest to each other; that hole must be the handle's second
    let best = null;
    for (const c of caps) for (const s of f.sites) { const d = dot(n(c.sites[0]), n(s)); if (!best || d > best.d) best = { d, c: c.sites[0], s }; }
    if (f.sites[0] === best.s) f.sites = [f.sites[1], f.sites[0]];
    build();
    const C = L.sites[best.c].site, nb = n(best.s), R = L.R || 1;
    const thetaIn = Math.atan2(dot(nb, C.e2), dot(nb, C.e1)), Db = R * Math.acos(Math.max(-1, Math.min(1, dot(nb, C.n))));
    busy = true;
    const mine = ++seq, color = ZIP_COLORS[0];
    const done = () => { stage.extraLines = null; f.walking = false; };
    cancel = stage.animate(0.9, (u) => { f.p = 1 - 0.78 * u; }, () => {
      if (mine !== seq) return;
      let w = 0;
      f.walking = true;
      stage.extraLines = () => {
        const { pts, eps } = ringAt(C, thetaIn, Db, smooth(w));
        const N = pts.length / 3 - 1, i = Math.round(N / 4), P = (j) => [pts[3 * j], pts[3 * j + 1], pts[3 * j + 2]];
        // the arrow: the handle's second hole carries its arrow clockwise seen from outside, i.e. against the ring's own sense
        const p = P(i), a = P(i + 1), b = P(i - 1), tl = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1, t = [(b[0] - a[0]) / tl, (b[1] - a[1]) / tl, (b[2] - a[2]) / tl];
        const c0 = [0, 0, 0]; for (let j = 0; j < N; j++) { const q = P(j); c0[0] += q[0] / N; c0[1] += q[1] / N; c0[2] += q[2] / N; }
        let sd = [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]]; const sl = Math.hypot(sd[0], sd[1], sd[2]) || 1; sd = sd.map((x) => x / sl);
        const sz = 0.45 * eps, tip = p.map((x, q) => x + 0.55 * sz * t[q]), back = p.map((x, q) => x - 0.45 * sz * t[q]);
        return [
          { points: Float32Array.from(pts), color, width: 3, xray: 0.5 },
          { points: Float32Array.from([...back.map((x, q) => x + 0.5 * sz * sd[q]), ...tip, ...back.map((x, q) => x - 0.5 * sz * sd[q])]), color, width: 3.2, xray: 0.5 },
        ];
      };
      cancel = stage.animate(3.4, (u) => { w = u; }, () => {
        if (mine !== seq) { done(); return; }
        done();
        f.type = 'X';
        build(); readout();
        cancel = stage.animate(1.9, (u) => { f.p = 0.22 + 0.78 * u; }, () => { cancel = null; busy = false; });
      });
    });
  }

  for (const st of steppers) for (const b of st.querySelectorAll('.st-btn')) {
    b.addEventListener('click', () => { if (b.dataset.d === '1') add(st.dataset.f); else remove(st.dataset.f); });
  }
  tradeX.addEventListener('click', () => trade('X'));
  tradeO.addEventListener('click', () => trade('o'));
  document.getElementById('tidy-book').addEventListener('click', () => setAll({ o: 3, star: 2, x: 1 }));
  document.getElementById('tidy-clear').addEventListener('click', () => setAll({}));

  const parse = (k) => {
    const c = { o: 0, star: 0, x: 0, X: 0 }, map = { o: 'o', '*': 'star', x: 'x', X: 'X' };
    for (const ch of String(k || '')) if (map[ch]) c[map[ch]]++;
    return c;
  };

  return {
    enter() { stage.R.setView({ az: 0, el: 55, zoom: 1 }); build(); readout(); lookAtPieces(0); },
    leave() { settle(); },
    when() {
      const c = countsOf(features);
      if (c.X > 0) return 'tidy:X';
      if (c.o > 0 && c.x > 0) return 'tidy:ox';
      return features.length ? 'tidy:done' : 'tidy:any';
    },
    get() { const c = countsOf(features); return { k: 'o'.repeat(c.o) + '*'.repeat(c.star) + 'x'.repeat(c.x) + 'X'.repeat(c.X) || undefined }; },
    set(s) { if (s.k !== undefined) { const c = parse(s.k); features = []; for (const k of ['o', 'X', 'x', 'star']) for (let i = 0; i < c[k]; i++) features.push({ type: k, sites: [], p: 1 }); if (!repack()) features = []; } },
    add, remove, setAll, trade, counts: () => countsOf(features), isBusy: () => busy, layout: L,
  };
}
