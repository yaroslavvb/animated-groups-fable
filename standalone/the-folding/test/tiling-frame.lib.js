// test/tiling-frame.lib.js — what the plane DRAWS during the replication step, read back from the drawing calls of a
// recording canvas and checked against the group itself (groups.js contains / elementsNear), not against replicate.js's
// own plan. Ported (final fix, 10 Nov 2026; finding 11) from the tests-math verifier's dev/v4-tests-math-tiling-lib.mjs;
// used by test/plane-tiling-cover.test.js and test/plane-tiling.test.js. Not a test file itself (no .test.js).
// The verifier's notes follow.
//
// read back from the drawing calls (a recording canvas in node, or the real canvas's calls in Chrome), checked against
// the group itself (groups.js contains / elementsNear), not against replicate.js's own plan.
//
// From one frame's calls:
//   ring     the tile as drawn (drawTile's ACCENT_SOFT fill: the first one of the frame that is not a card's tint), css -> world
//   copies   every subpath of the copies' outline strokes (FAINT): each must be A(ring) for ONE affine A (residual), and
//            A must be an isometry, an element of the group (contains) and one of the window's tiles (tileCopies =
//            elementsNear around the window); no element twice
//   cards    every subpath of a white paper fill (drawCard): A(ring) or A(reversed ring); either an element of the group
//            (a settling card: it lies on its own tile) or h o m_i(s) for an element h near it and a side pairing g_i of
//            the tile with s in [0, 1] — the motion family of the step re-derived here from classify(g_i): a turn about
//            g_i's centre by s theta (theta in (-pi, pi], a half-turn +pi), a slide s v, a flip seen from above (the
//            normal component scaled by cos(pi s)) plus s dist along the glide axis
//   cover    sampled points of the window (world): how many drawn copy outlines hold each (exactly 1 at the end)
import { contains, elementsNear } from '../src/groups.js';
import { classify, inverse, compose } from '../src/geom.js';
import { tileCopies } from '../src/plane.js';

export const STYLE = {
  tile: /^rgba\(\s*15,\s*118,\s*110,\s*0\.14\s*\)$/,
  outline: /^rgba\(\s*138,\s*138,\s*147,/,
  paper: /^rgba\(\s*255,\s*255,\s*255,\s*([0-9.e-]+)\s*\)$/,
};

/** A recording 2D context for node: every fill / stroke / clip with the subpaths (css px) and the styles. */
export function recordingCanvas(w, h) {
  const DEFAULTS = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, font: '10px sans-serif', textBaseline: 'alphabetic', textAlign: 'start' };
  const rec = { calls: [], on: true };
  let state = { ...DEFAULTS }, path = [], cur = null;
  const stack = [];
  const ctx = new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 6.2 });
      if (prop === 'save') return () => stack.push({ ...state });
      if (prop === 'restore') return () => { if (stack.length) state = stack.pop(); };
      if (prop === 'beginPath') return () => { path = []; cur = null; };
      if (prop === 'moveTo') return (x, y) => { cur = [[x, y]]; path.push(cur); };
      if (prop === 'lineTo') return (x, y) => { if (!cur) { cur = [[x, y]]; path.push(cur); } else cur.push([x, y]); };
      if (prop === 'closePath') return () => { if (cur) { cur.closed = true; cur = null; } };
      if (prop === 'arc' || prop === 'arcTo' || prop === 'ellipse' || prop === 'quadraticCurveTo' || prop === 'bezierCurveTo' || prop === 'rect') {
        return () => { if (!cur) { cur = []; path.push(cur); } cur.curved = true; };
      }
      if (prop === 'fill' || prop === 'stroke' || prop === 'clip') {
        return () => { if (rec.on) rec.calls.push({ op: prop, fillStyle: String(state.fillStyle), strokeStyle: String(state.strokeStyle), alpha: state.globalAlpha, sub: path.map((s) => { const c = s.slice(); c.closed = !!s.closed; c.curved = !!s.curved; return c; }) }); };
      }
      if (prop in state) return state[prop];
      return () => {};
    },
    set(t, prop, v) { state[prop] = v; return true; },
  });
  const canvas = {
    width: w, height: h, clientWidth: w, clientHeight: h, style: {}, attrs: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] || (this.listeners[type] = [])).push(fn); },
    removeEventListener(type, fn) { const l = this.listeners[type]; if (l) this.listeners[type] = l.filter((f) => f !== fn); },
    setPointerCapture() {}, releasePointerCapture() {},
    setAttribute(k, v) { this.attrs[k] = String(v); }, hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; },
  };
  /** Hand an event to the plane's listeners (pointerdown / pointermove / pointerup with clientX, clientY, pointerId). */
  const dispatch = (type, e) => { for (const f of canvas.listeners[type] || []) f({ type, pointerType: 'mouse', button: 0, isPrimary: true, pointerId: 1, preventDefault() {}, ...e }); };
  return { canvas, rec, dispatch };
}

const lin = (A, x, y) => [A.a * x + A.b * y + A.tx, A.c * x + A.d * y + A.ty];

/** The affine A with A(src[i]) = dst[i] for the three indices: { a, b, c, d, tx, ty }. */
function affine3(src, dst, i0, i1, i2) {
  const [x0, y0] = src[i0], [x1, y1] = src[i1], [x2, y2] = src[i2];
  const ux = x1 - x0, uy = y1 - y0, vx = x2 - x0, vy = y2 - y0, D = ux * vy - uy * vx;
  const [X0, Y0] = dst[i0], [X1, Y1] = dst[i1], [X2, Y2] = dst[i2];
  const UX = X1 - X0, UY = Y1 - Y0, VX = X2 - X0, VY = Y2 - Y0;
  // L [u v] = [U V]  ->  L = [U V] [u v]^-1
  const ia = vy / D, ib = -vx / D, ic = -uy / D, id = ux / D;
  const a = UX * ia + VX * ic, b = UX * ib + VX * id, c = UY * ia + VY * ic, d = UY * ib + VY * id;
  return { a, b, c, d, tx: X0 - a * x0 - b * y0, ty: Y0 - c * x0 - d * y0 };
}
/** Three well-spread indices of a polygon. */
export function spread(P) {
  let i1 = 0, best = -1;
  for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]); if (d > best) { best = d; i1 = i; } }
  let i2 = 0; best = -1;
  const ux = P[i1][0] - P[0][0], uy = P[i1][1] - P[0][1];
  for (let i = 0; i < P.length; i++) { const d = Math.abs(ux * (P[i][1] - P[0][1]) - uy * (P[i][0] - P[0][0])); if (d > best) { best = d; i2 = i; } }
  return [0, i1, i2];
}
/** Fit dst = A(src) (same order, or reversed when `either`): { A, res (max distance), reversed } or null. */
export function fitAffine(src, dst, idx, either = false) {
  if (src.length !== dst.length) return null;
  const n = src.length;
  const tryOrder = (rev) => {
    const D = rev ? dst.map((_, k) => dst[n - 1 - k]) : dst;
    const A = affine3(src, D, idx[0], idx[1], idx[2]);
    let res = 0;
    for (let k = 0; k < n; k++) { const p = lin(A, src[k][0], src[k][1]); const e = Math.hypot(p[0] - D[k][0], p[1] - D[k][1]); if (!(e <= res)) res = e; }
    return { A, res, reversed: rev };
  };
  const f = tryOrder(false);
  if (!either) return f;
  const r = tryOrder(true);
  return r.res < f.res ? r : f;
}
const isoErr = (A) => Math.max(Math.abs(A.a * A.a + A.c * A.c - 1), Math.abs(A.b * A.b + A.d * A.d - 1), Math.abs(A.a * A.b + A.c * A.d));
export const keyOf = (g) => { const r = (v) => Math.round(v * 1e5) || 0; return [g.a, g.b, g.c, g.d, g.tx, g.ty].map(r).join(','); };
const near6 = (g, h, eps) => Math.abs(g.a - h.a) < eps && Math.abs(g.b - h.b) < eps && Math.abs(g.c - h.c) < eps && Math.abs(g.d - h.d) < eps && Math.abs(g.tx - h.tx) < eps && Math.abs(g.ty - h.ty) < eps;
function singular(A) {
  // singular values of [[a b][c d]]
  const s1 = A.a * A.a + A.b * A.b + A.c * A.c + A.d * A.d, dt = Math.abs(A.a * A.d - A.b * A.c);
  const q = Math.sqrt(Math.max(0, s1 * s1 / 4 - dt * dt));
  return [Math.sqrt(s1 / 2 + q), Math.sqrt(Math.max(0, s1 / 2 - q))];
}

/** The motions of the side pairings (re-derived from classify, apart from replicate.js). */
export function sidePairings(domain) {
  return domain.edges.map((e, i) => {
    const c = classify(e.g);
    const m = { i, g: e.g, type: c.type };
    if (c.type === 'translation') m.v = c.vec;
    else if (c.type === 'rotation') { let th = c.angle; if (th > Math.PI - 1e-6 || th < -Math.PI + 1e-6) th = Math.PI; m.theta = th; m.c = c.center; }
    else if (c.type === 'reflection' || c.type === 'glide') { m.p = c.point; m.u = c.dir; m.dist = c.type === 'glide' ? c.dist : 0; }
    return m;
  });
}
/** If B = m(s) for the side pairing motion m and some s in [0, 1]: { s, err } else null. */
function matchMotion(B, m, size) {
  if (m.type === 'translation') {
    if (isoErr(B) > 1e-9 || Math.abs(B.a - 1) > 1e-9 || Math.abs(B.d - 1) > 1e-9) return null;
    const v = m.v, L = v[0] * v[0] + v[1] * v[1], s = (B.tx * v[0] + B.ty * v[1]) / L;
    const err = Math.hypot(B.tx - s * v[0], B.ty - s * v[1]) / size;
    return s >= -1e-9 && s <= 1 + 1e-9 && err < 1e-8 ? { s, err } : null;
  }
  if (m.type === 'rotation') {
    if (isoErr(B) > 1e-9 || B.a * B.d - B.b * B.c < 0) return null;
    const phi = Math.atan2(B.c, B.a);
    // the centre stays: B(c) = c
    const q = lin(B, m.c[0], m.c[1]), err = Math.hypot(q[0] - m.c[0], q[1] - m.c[1]) / size;
    if (err > 1e-8) return null;
    let s = phi / m.theta;
    if (Math.abs(phi) < 1e-12) s = 0;
    if (Math.abs(Math.abs(m.theta) - Math.PI) < 1e-9 && Math.abs(Math.abs(phi) - Math.PI) < 1e-9) s = 1;
    return s >= -1e-9 && s <= 1 + 1e-9 ? { s, err } : null;
  }
  if (m.type === 'reflection' || m.type === 'glide') {
    const [ux, uy] = m.u, nx = -uy, ny = ux;
    // B linear = u u^T + k n n^T, k in [-1, 1]
    const k = B.a * nx * nx + B.b * nx * ny + B.c * ny * nx + B.d * ny * ny;
    const a = ux * ux + k * nx * nx, b = ux * uy + k * nx * ny, c = uy * ux + k * ny * nx, d = uy * uy + k * ny * ny;
    const le = Math.max(Math.abs(a - B.a), Math.abs(b - B.b), Math.abs(c - B.c), Math.abs(d - B.d));
    if (le > 1e-9 || k > 1 + 1e-9 || k < -1 - 1e-9) return null;
    const s = Math.acos(Math.max(-1, Math.min(1, k))) / Math.PI;
    const [px, py] = m.p;
    const tx = px - a * px - b * py + s * m.dist * ux, ty = py - c * px - d * py + s * m.dist * uy;
    const err = Math.hypot(tx - B.tx, ty - B.ty) / size;
    return err < 1e-8 ? { s, err } : null;
  }
  return null;
}

/** The order of the rotation centre (x, y) in the group: the largest n with the rotation by 2 pi / n about it in G. */
export function centreOrderOf(group, x, y) {
  for (const n of [6, 4, 3, 2]) {
    const t = (2 * Math.PI) / n, c = Math.cos(t), s = Math.sin(t);
    const R = { a: c, b: -s, c: s, d: c, tx: x - c * x + s * y, ty: y - s * x - c * y };
    if (contains(group, R, 1e-6)) return n;
  }
  return 1;
}
function angleWords(theta) {
  const f = Math.abs(theta) / Math.PI;
  for (const [v, t] of [[1, 'π'], [1 / 2, 'π/2'], [2 / 3, '2π/3'], [1 / 3, 'π/3']]) if (Math.abs(f - v) < 1e-9) return t;
  return `${(f * 180).toFixed(0)}°`;
}
/**
 * What the words of a phase should say, derived from the cards that move in it (their side pairings as drawn):
 * { long, kinds } — long: the first layer's words ("rotations by ±2π/3 about a 3-fold centre", "half-turn about a
 * 2-fold centre", "reflection in a mirror", "glide reflections", "translations"), kinds: the set of the kinds alone
 * without number or sense ("rotation by 2π/3", "half-turn", "reflection", "glide reflection", "translation").
 */
export function expectedWords(motions, group) {
  const kinds = new Map();
  for (const m of motions) {
    let key = m.type, base = m.type === 'glide' ? 'glide reflection' : m.type;
    if (m.type === 'rotation') {
      const n = centreOrderOf(group, m.centre[0], m.centre[1]), half = Math.abs(Math.abs(m.theta) - Math.PI) < 1e-9;
      key += ':' + n + ':' + angleWords(m.theta); m.order = n; m.half = half;
      base = half ? 'half-turn' : `rotation by ${angleWords(m.theta)}`;
    }
    if (!kinds.has(key)) kinds.set(key, { m, base, count: 0, senses: new Set(), places: new Set() });
    const e = kinds.get(key);
    e.count++;
    if (m.type === 'rotation') { e.senses.add(m.sense); e.places.add(Math.round(m.centre[0] * 1e5) + ',' + Math.round(m.centre[1] * 1e5)); }
    else e.places.add(m.line || 'v');
  }
  const rank = (e) => (e.m.type === 'reflection' ? 0 : e.m.type === 'rotation' ? 1 + (12 - e.m.order) / 100 + Math.abs(e.m.theta) / 1000 : e.m.type === 'glide' ? 2 : 3);
  const list = [...kinds.values()].sort((a, b) => rank(a) - rank(b));
  const text = (e) => {
    const many = e.count > 1, spots = e.places.size > 1, m = e.m;
    if (m.type === 'translation') return many ? 'translations' : 'translation';
    if (m.type === 'glide') return many ? 'glide reflections' : 'glide reflection';
    if (m.type === 'reflection') return spots ? 'reflections in mirrors' : many ? 'reflections in a mirror' : 'reflection in a mirror';
    const where = spots ? `about ${m.order}-fold centres` : `about a ${m.order}-fold centre`;
    if (m.half) return (many ? 'half-turns ' : 'half-turn ') + where;
    const pm = e.senses.has(1) && e.senses.has(-1) ? '±' : e.senses.has(-1) ? '−' : '';
    return `${many ? 'rotations' : 'rotation'} by ${pm}${angleWords(m.theta)} ${where}`;
  };
  return { long: list.map(text).join(', '), kinds: new Set(list.map((e) => e.base)) };
}
/** The kinds a caption names, without number or sense. */
export function captionKinds(caption) {
  // (the first later layer glosses itself: "layer 2 (words of length 2 in the side pairings) · ...")
  const body = caption.replace(/^layer \d+( \([^)]*\))?( of \d+)?( · )?/, '');
  if (!body) return null;
  return new Set(body.split(', ').map((w) => w.replace(/ about .*$/, '').replace(/ in (a mirror|mirrors)$/, '').replace(/^rotations/, 'rotation').replace(/^half-turns/, 'half-turn')
    .replace(/^reflections/, 'reflection').replace(/^glide reflections/, 'glide reflection').replace(/^translations/, 'translation').replace(/by [±−]/, 'by ')));
}

/** Point in polygon (even-odd), and the distance to its boundary. */
function pip(P, x, y) {
  let inside = false, dmin = Infinity;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    const ux = xi - xj, uy = yi - yj, L = ux * ux + uy * uy;
    let s = L > 0 ? ((x - xj) * ux + (y - yj) * uy) / L : 0;
    s = Math.max(0, Math.min(1, s));
    const d = Math.hypot(xj + s * ux - x, yj + s * uy - y);
    if (d < dmin) dmin = d;
  }
  return { inside, d: dmin };
}

/**
 * Analyse one frame. view = { W, H, cx, cy, s } (css px per unit; the window's centre in the world, as drawn).
 * ctx = { group, domain, sides, rnd, points, phase } -> a report.
 */
export function analyseFrame(calls, view, ctx) {
  const { group, domain } = ctx, size = Math.sqrt(group.domainArea);
  const W2 = (p) => [view.cx + (p[0] - view.W / 2) / view.s, view.cy - (p[1] - view.H / 2) / view.s];
  const out = { problems: [], copies: 0, cards: 0, cardsOnTile: 0, cardsMoving: 0, cover: null, keys: [] };
  // the tile: drawTile's ACCENT_SOFT fill. A card's tint is the same colour at full strength, and since 13 Nov 2026 the
  // cards that turn over are drawn before the tile (they pass under the paper); each card's tint follows its paper fill
  // on the same path, so the tile is the first such fill whose path no paper fill has drawn
  const papers = new Set();
  let tileCall = null;
  for (const c of calls) {
    if (c.op !== 'fill') continue;
    const st = c.fillStyle.replace(/\s/g, '');
    if (STYLE.paper.test(st)) { for (const sp of c.sub) papers.add(JSON.stringify(sp)); continue; }
    if (STYLE.tile.test(st) && !(c.sub.length === 1 && papers.has(JSON.stringify(c.sub[0])))) { tileCall = c; break; }
  }
  if (!tileCall || tileCall.sub.length !== 1) { out.problems.push('no tile fill'); return out; }
  const ring = tileCall.sub[0].map(W2);
  const idx = spread(ring);
  const seedA = domain.seedActual;
  let rt = 0;
  for (const p of ring) rt = Math.max(rt, Math.hypot(p[0] - seedA[0], p[1] - seedA[1]));
  const want = tileCopies(group, seedA, rt, view.cx, view.cy, view.W / (2 * view.s), view.H / (2 * view.s));
  const wantKeys = new Map(want.map((g) => [keyOf(g), g]));
  // ---- the copies' outlines
  const polys = [], seen = new Map();
  let worstRes = 0, worstIso = 0;
  for (const c of calls) {
    if (c.op !== 'stroke' || !STYLE.outline.test(c.strokeStyle.replace(/\s/g, ''))) continue;
    for (const sp of c.sub) {
      if (sp.curved) { out.problems.push('a curved subpath in the outlines'); continue; }
      const S = sp.map(W2);
      const f = fitAffine(ring, S, idx, false);
      if (!f) { out.problems.push(`an outline of ${S.length} points (the ring has ${ring.length})`); continue; }
      worstRes = Math.max(worstRes, f.res / size); worstIso = Math.max(worstIso, isoErr(f.A));
      if (f.res > 1e-7 * size) out.problems.push(`an outline is not an affine image of the tile (residual ${(f.res / size).toExponential(2)})`);
      if (isoErr(f.A) > 1e-7) out.problems.push(`an outline is not an isometric image (${isoErr(f.A).toExponential(2)})`);
      if (!contains(group, f.A, 1e-6)) out.problems.push(`an outline is g(D) for g NOT in the group: ${JSON.stringify(f.A)}`);
      const k = keyOf(f.A);
      if (!wantKeys.has(k)) {
        // tolerant match
        const hit = want.find((g) => near6(g, f.A, 1e-6));
        if (!hit) out.problems.push(`an outline's element is not among the window's tiles (elementsNear): ${k}`);
      }
      if (seen.has(k)) out.problems.push(`the element ${k} is outlined twice`);
      seen.set(k, f.A);
      polys.push(S);
    }
  }
  out.copies = polys.length; out.keys = [...seen.keys()];
  out.worstRes = worstRes; out.worstIso = worstIso;
  // ---- the cards
  let worstCard = 0;
  for (const c of calls) {
    if (c.op !== 'fill') continue;
    const m = STYLE.paper.exec(c.fillStyle.replace(/\s/g, ''));
    if (!m) continue;
    for (const sp of c.sub) {
      if (sp.curved) continue;
      const S = sp.map(W2);
      const f = fitAffine(ring, S, idx, true);
      out.cards++;
      if (!f || f.res > 1e-7 * size) { out.problems.push(`a card is not an affine image of the tile (${f ? (f.res / size).toExponential(2) : 'size'})`); continue; }
      worstCard = Math.max(worstCard, f.res / size);
      const A = f.A, [s1, s2] = singular(A);
      if (Math.abs(s1 - 1) > 1e-7 || s2 > 1 + 1e-7) { out.problems.push(`a card is stretched: singular values ${s1}, ${s2}`); continue; }
      if (isoErr(A) < 1e-8 && contains(group, A, 1e-6)) {
        out.cardsOnTile++;
        if (!want.find((g) => near6(g, A, 1e-6))) {
          // a tile that does not meet the window: fine only if the card is off the canvas (a moving card about to land
          // off screen is drawn too: plane.js renderTiling draws every moving card)
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const p of sp) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
          const visible = x1 > 0 && x0 < view.W && y1 > 0 && y0 < view.H;
          if (visible) out.problems.push('a VISIBLE card on a tile that is not a tile of the window');
          else out.offCanvasCards = (out.offCanvasCards || 0) + 1;
        }
        continue;
      }
      // in motion: A = h o m_i(s) for an element h near the card and a side pairing g_i
      let cxm = 0, cym = 0;
      for (const p of S) { cxm += p[0] / S.length; cym += p[1] / S.length; }
      const hs = elementsNear(group, cxm, cym, 3 * rt + 3 * size, seedA[0], seedA[1]);
      // every decomposition A = h o m_i(s): a motion read backwards is one too (h m_i(s) = (h g_i) m_j(1 - s) for the
      // partner j), so the one whose h has landed is the parent; a parent outside the window is fine too
      const all = [];
      for (const h of hs) {
        const B = compose(inverse(h), A);
        for (const sp2 of ctx.sides) { const r = matchMotion(B, sp2, size); if (r) all.push({ h, i: sp2.i, ...r }); }
      }
      const landed = (h) => { if (seen.has(keyOf(h))) return 'landed'; const w = want.find((g) => near6(g, h, 1e-6)); return w ? (seen.has(keyOf(w)) ? 'landed' : 'missing') : 'outside'; };
      for (const f2 of all) f2.parent = landed(f2.h);
      const found = all.find((f2) => f2.parent === 'landed') || all.find((f2) => f2.parent === 'outside') || all[0] || null;
      if (!found) out.problems.push(`a moving card is no h o m_i(s) of a side pairing (A = ${JSON.stringify(A)})`);
      else {
        out.cardsMoving++;
        // the parent h(D) must be there: landed (outlined in this frame), or a tile that does not meet the window
        if (found.parent === 'missing') out.problems.push(`a card leaves a parent tile of the window that has not landed (s = ${found.s.toFixed(4)}; ${all.length} readings)`);
        if (found.parent === 'outside') out.offWindowParents = (out.offWindowParents || 0) + 1;
        const sp2 = ctx.sides[found.i], h = found.h, dh = h.a * h.d - h.b * h.c;
        const mo = { type: sp2.type, s: found.s, i: found.i };
        if (sp2.type === 'rotation') { mo.theta = sp2.theta; mo.centre = lin(h, sp2.c[0], sp2.c[1]); mo.sense = Math.sign(sp2.theta) * Math.sign(dh); }
        if (sp2.type === 'reflection' || sp2.type === 'glide') {
          const p = lin(h, sp2.p[0], sp2.p[1]);
          let ux = h.a * sp2.u[0] + h.b * sp2.u[1], uy = h.c * sp2.u[0] + h.d * sp2.u[1];
          if (ux < -1e-9 || (Math.abs(ux) <= 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
          mo.line = Math.round(Math.atan2(uy, ux) * 1e5) + '|' + Math.round((p[0] * -uy + p[1] * ux) * 1e5);
        }
        (out.motions || (out.motions = [])).push(mo);
      }
    }
  }
  out.worstCard = worstCard;
  // ---- the cover: how many outlined copies hold each sampled point
  if (ctx.points) {
    const bb = polys.map((P) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return [x0, y0, x1, y1]; });
    const hist = new Map();
    let onEdge = 0;
    for (let k = 0; k < ctx.points; k++) {
      const x = view.cx + (ctx.rnd() - 0.5) * view.W / view.s, y = view.cy + (ctx.rnd() - 0.5) * view.H / view.s;
      let n = 0, edge = false;
      for (let j = 0; j < polys.length; j++) {
        const b = bb[j];
        if (x < b[0] - 1e-9 || x > b[2] + 1e-9 || y < b[1] - 1e-9 || y > b[3] + 1e-9) continue;
        const r = pip(polys[j], x, y);
        if (r.d < 1e-7 * size) edge = true;
        if (r.inside) n++;
      }
      if (edge) { onEdge++; continue; }
      hist.set(n, (hist.get(n) || 0) + 1);
    }
    out.cover = { hist: Object.fromEntries([...hist.entries()].sort((a, b) => a[0] - b[0])), onEdge, points: ctx.points };
  }
  out.want = want.length;
  return out;
}
