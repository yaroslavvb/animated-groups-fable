// view.js — the pattern pane: a 2D canvas that draws an atlas unrolled, in the geometry it lives in, and lets you
// slide it about. After the Classification of Surfaces page's pattern.js (its projections, its marks, its glide of a
// released drag), for an atlas of several atoms and with the decomposition drawn over the pattern.
//
//   sphere            seen from far away: a ball; a drag turns it
//   plane             as it is; a drag slides it
//   hyperbolic plane  the Poincare disc; a drag slides the pattern along a hyperbolic line
//
// What is drawn: the ground in one tone; the print (print.js) in a darker one; mirrors red, glide axes dashed red;
// cone points blue and corners red, as crystallographers draw them.
//
// The cuts are NOT drawn (his rule, Fri 27 Nov 2026: "instead of cutting on the geodesic, you're just rearranging
// the corners ... I don't think we need the actual cut"; and on The real 2222 the same day: "Instead of drawing the
// isolated cut ... highlight the pairs of vertices which are being separated. So use different colors and
// different sizes"). A cut is shown by what it parts: while it is pointed at, the special points on one side of it
// are drawn larger and filled in its colour, those on the other side larger and ringed in it. Only a cut that parts
// no special points (a handle's loop, a crosscap, a mirror) is drawn as its line, since it has nothing else to show.
// setCuts(true) draws every cut and the seams of the pieces as the first version of the page did (a cuff solid, an
// arc dashed, the one pointed at heavier), and then a click on a cut flips it.
//
//   const V = createView(canvas, { onHover(cutId | null), onPick(cutId) });
//   V.show(scene)                    a new pattern; the view starts over
//   V.update(scene, { cut })         the same decomposition with other numbers: what is in the middle stays put,
//                                    and the cut being moved keeps its line when it is the middle piece's own
//   V.replace(scene, carry, ghost)   another decomposition of the SAME pattern (a flip): nothing moves; with the cuts
//                                    drawn, those that went fade out as the new ones fade in
//   scene = { atlas, shapes, cuts: { id: { color, type } }, sides: { id: { markKey: 0 | 1 } | null }, area }

import { mul, apply, I3, invOf, geomOf } from './h2.js';
import { walk } from './atlas.js';
import { PRINT_FRONT, hexToRgb } from '../../classification-of-surfaces/src/vendor/the-folding/palette.js';

const TAU = 2 * Math.PI;
const BLUE = [0, 0.447, 0.698], RED = [0.835, 0.369, 0], DARK = [0.08, 0.09, 0.12];
const FRONT = hexToRgb(PRINT_FRONT[0]), INK = hexToRgb(PRINT_FRONT[1]);
const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
const det = (M) => M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
const FADE_MS = 320;

export function createView(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0;
  let scene = null, G = null, kind = 'H', V = I3.slice(), home = 0, vRev = false;
  let tiles = null, tilesKey = '', quick = false, budget = 1500, hover = null, showCuts = false, bare = false, stats = { tiles: 0, drawn: 0 };
  let ghost = null;              // { scene, V, home, cuts: [ids], t0 }: the overlay of the decomposition before a flip
  let fresh = null;              // { cuts: Set, t0 }: the cuts a flip made, fading in
  let hits = [];                 // the cuts on the screen: [cutId, x0, y0, x1, y1]
  const calm = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function size() {
    const r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === W && h === H && d === dpr) return;
    W = w; H = h; dpr = d;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  const lay = () => {
    const half = Math.min(W, H) / 2;
    if (kind === 'E') return { cx: W / 2, cy: H / 2, R: half / (Math.max(2.1, Math.min(3.1, half / 88)) * Math.sqrt(scene.area || 4)), half };
    return { cx: W / 2, cy: H / 2, R: half * 0.94, half };
  };
  function unproject(x, y) {
    const L = lay(), u = (x - L.cx) / L.R, v = -(y - L.cy) / L.R, d2 = u * u + v * v;
    if (kind === 'E') return [u, v, 1];
    if (kind === 'S') { if (d2 >= 1) { const l = Math.sqrt(d2); return [u / l, v / l, 0]; } return [u, v, Math.sqrt(1 - d2)]; }
    const m = Math.min(1, 0.93 / Math.sqrt(d2 || 1e-12)), a = u * m, b = v * m, q = a * a + b * b;
    return [(2 * a) / (1 - q), (2 * b) / (1 - q), (1 + q) / (1 - q)];
  }
  const hand = () => (vRev ? -1 : 1);

  function firstView() {
    const A = scene.atlas;
    home = 0; vRev = false;
    if (kind === 'S') {
      const a = -0.42, b = 0.34, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const Rx = [1, 0, 0, 0, ca, -sa, 0, sa, ca], Ry = [cb, 0, sb, 0, 1, 0, -sb, 0, cb];
      V = mul(mul(Rx, Ry), G.translate(A.face || A.atoms[0].at, G.origin));
      return;
    }
    // the middle of the decomposition in the middle of the pane: the atom with the most cuts round it, one that has
    // a special point of its own before one that has none (the special points are what the cuts move about)
    let best = 0, bn = -1;
    A.atoms.forEach((a, i) => { const n = a.sides.filter((s) => s.cut != null).length + (a.marks && a.marks.some((m) => m.which === undefined) ? 1.2 : 0) + (a.twin ? 0 : 0.5); if (n > bn) { bn = n; best = i; } });
    home = best;
    V = G.translate(A.atoms[home].at, G.origin);
    recentre();
  }
  /** Keep the tile nearest the middle of the view the one the tiles are counted from (the pattern does not move). */
  function recentre() {
    if (kind === 'S' || !scene) return;
    const A = scene.atlas, far = (M, atom) => { const p = apply(M, A.atoms[atom].at); return p[0] * p[0] + p[1] * p[1]; };
    for (let guard = 0; guard < 400; guard++) {
      let best = null, bd = far(V, home) - 1e-9;
      for (const side of A.atoms[home].sides) for (const nb of side.nbrs) { const d = far(mul(V, nb.T), nb.atom); if (d < bd) { bd = d; best = nb; } }
      if (!best) break;
      V = mul(V, best.T); home = best.atom;
      if (best.flip) vRev = !vRev;
    }
    V = G.fix(V, hand());
  }
  function tileList() {
    const A = scene.atlas;
    let radius = Infinity, max = 4200;
    if (kind === 'E') { const L = lay(); radius = Math.hypot(W, H) / 2 / L.R + 2 * A.reach; }
    if (kind === 'H') radius = 5 + 2 * A.reach;
    const key = scene.stamp + ':' + home + ':' + radius.toFixed(2);
    if (tilesKey !== key) { tiles = walk(A, home, { radius, max, ms: quick ? 120 : 700 }); tilesKey = key; }
    return quick && kind === 'H' && tiles.length > budget ? tiles.slice(0, budget) : tiles;
  }

  // ---- drawing
  function draw() {
    raf = 0;
    if (!scene) return;
    const t0 = now();
    size();
    const L = lay(), { cx, cy, R } = L, A = scene.atlas;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (kind !== 'E') { ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip(); }
    ctx.fillStyle = css(FRONT); ctx.fillRect(0, 0, W, H);

    const X = (p) => (kind === 'H' ? cx + (R * p[0]) / (1 + p[2]) : cx + R * p[0]);
    const Y = (p) => (kind === 'H' ? cy - (R * p[1]) / (1 + p[2]) : cy - R * p[1]);
    const lerp = (a, b, t) => G.norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    const blob = (path, pts) => {
      if (kind !== 'S') { path.moveTo(X(pts[0]), Y(pts[0])); for (let i = 1; i < pts.length; i++) path.lineTo(X(pts[i]), Y(pts[i])); path.closePath(); return; }
      let front = 0;
      for (const p of pts) if (p[2] >= 0) front++;
      if (front < 3) return;
      pts.forEach((p, i) => { let x = p[0], y = p[1]; if (p[2] < 0) { const l = Math.hypot(x, y) || 1; x /= l; y /= l; } if (i) path.lineTo(cx + R * x, cy - R * y); else path.moveTo(cx + R * x, cy - R * y); });
      path.closePath();
    };
    const stepsFor = (a, b) => {
      if (kind === 'E') return 1;
      if (kind === 'S') return Math.max(2, Math.ceil(G.dist(a, b) / 0.11));
      return Math.max(1, Math.min(14, Math.ceil(Math.hypot(X(a) - X(b), Y(a) - Y(b)) / 8)));
    };
    /** An open line a -> b, added to a path; with `keep`, its pieces on the screen are noted for pointing at. */
    const line = (path, a, b, keep) => {
      const steps = stepsFor(a, b);
      let on = false, px = 0, py = 0;
      for (let s = 0; s <= steps; s++) {
        const p = s === 0 ? a : s === steps ? b : lerp(a, b, s / steps);
        if (kind === 'S' && p[2] < 0) { on = false; continue; }
        const x = X(p), y = Y(p);
        if (!on) { path.moveTo(x, y); on = true; } else { path.lineTo(x, y); if (keep != null) hits.push([keep, px, py, x, y]); }
        px = x; py = y;
      }
    };

    /** Everything of one scene, drawn from its tiles. what: { print, overlay, cutsOnly: Set | null, alpha } */
    const paint = (sc, Vm, list, what) => {
      const At = sc.atlas, ink = new Path2D(), seamP = [new Path2D(), new Path2D()], mirrors = [0, 1, 2].map(() => new Path2D()), glides = [0, 1, 2].map(() => new Path2D());
      const cutP = new Map(), marks = new Map(), seen = new Set();
      // what the cut pointed at parts, if it parts anything: the marks of its two sides are drawn apart
      const parted = !what.cutsOnly && hover != null && sc.sides ? sc.sides[hover] || null : null;
      const cutPath = (id, b) => { if (!cutP.has(id)) cutP.set(id, [new Path2D(), new Path2D(), new Path2D()]); return cutP.get(id)[b]; };
      let drawn = 0;
      for (const t of list) {
        const atom = At.atoms[t.atom], M = mul(Vm, t.M), c = apply(M, atom.at);
        if (!(Number.isFinite(c[0]) && Number.isFinite(c[2]))) continue;
        const ppu = kind === 'H' ? R / (1 + c[2]) : R, px = atom.clear * ppu, n = atom.verts.length;
        if (kind === 'S') { let vis = c[2] > 0; const Pq = atom.verts.map((v) => apply(M, v)); for (let i = 0; i < n && !vis; i++) if (Pq[i][2] > 0) vis = true; if (!vis) continue; }
        if (kind === 'E') { const m = atom.reach * R + 4; if (!(X(c) > -m && X(c) < W + m && Y(c) > -m && Y(c) < H + m)) continue; }
        if (kind === 'H') { const near = Math.acosh(Math.max(1, c[2])) - atom.reach; if (near > 5 || (px < 0.35 && near > 4)) continue; }
        drawn++;
        const b = px >= 20 ? 0 : px >= 7 ? 1 : 2, P = atom.verts.map((v) => apply(M, v));
        if (what.print) {
          const shapes = sc.shapes ? sc.shapes[t.atom] : atom.shapes;
          if (shapes) for (const sh of shapes) {
            // how large a comma is on the screen is asked where the comma is, not where its atom's middle is: after a
            // flip a comma can lie far from the middle of the long piece it is now tied to, and must look the same
            let sp = ppu;
            if (kind === 'H' && sh.c) { const q = apply(M, sh.c); if (q[2] > 0) sp = R / (1 + q[2]); }
            const spx = (sh.size || atom.clear) * sp;
            if (spx < (sh.size ? 1.6 : sh.min * 0.9)) continue;
            const skip = spx >= 16 ? 1 : spx >= 6 ? 2 : 4, pts = [];
            for (let i = 0; i < sh.pts.length; i += skip) pts.push(apply(M, sh.pts[i]));
            blob(ink, pts);
          }
        }
        if (!what.overlay) continue;
        for (let i = 0; i < n; i++) {
          const s = atom.sides[i];
          if (s.mirror && !what.cutsOnly) line(mirrors[b], P[i], P[(i + 1) % n]);
          // a cut's line: all of them when the cuts are shown; else only the one pointed at, and only if it parts nothing
          const drawn = what.cutsOnly ? what.cutsOnly.has(s.cut) : showCuts || (s.cut === hover && !parted);
          if (s.cut != null && s.primary && drawn) line(cutPath(s.cut, b), P[i], P[(i + 1) % n], what.hit && showCuts && px >= 5 ? s.cut : null);
        }
        if (showCuts && px >= 3) for (const sm of atom.seams) line(seamP[px >= 12 ? 0 : 1], apply(M, sm[0]), apply(M, sm[1]));
        if (atom.glides && !what.cutsOnly) for (const g of atom.glides) line(glides[b], apply(M, g[0]), apply(M, g[1]));
        if (px >= 4.5 && !what.cutsOnly) for (const mk of atom.marks) {
          const p = apply(M, mk.pt);
          if (kind === 'S' && p[2] < 0.05) continue;
          const x = X(p), y = Y(p), key = Math.round(x * 2) + ':' + Math.round(y * 2);
          if (seen.has(key)) continue;
          seen.add(key);
          const q = lerp(p, apply(M, mk.dir), 0.06), ang = Math.atan2(Y(q) - y, X(q) - x), mpx = kind === 'H' ? Math.min(px, 2.4 * (R / (1 + p[2])) * At.clear) : px;
          const side = parted ? parted[mk.which === undefined ? mk.part + ':' + mk.end : mk.part + ':' + mk.end + ':' + mk.which] : undefined;
          const r = Math.min(6.5, 0.24 * Math.max(mpx, px * 0.6)) * (side === undefined ? 1 : 1.7);
          if (r < 1.1) continue;
          const id = (mk.kind === 'cone' ? 'c' : 'k') + (r >= 4 ? 0 : 1) + (side === undefined ? '' : side ? 'B' : 'A');
          if (!marks.has(id)) marks.set(id, new Path2D());
          const path = marks.get(id);
          if (mk.n === 2) { const ux = Math.cos(ang), uy = Math.sin(ang), a1 = 1.25 * r, w = 0.95 * r; path.moveTo(x + a1 * ux, y + a1 * uy); path.quadraticCurveTo(x - w * uy, y + w * ux, x - a1 * ux, y - a1 * uy); path.quadraticCurveTo(x + w * uy, y - w * ux, x + a1 * ux, y + a1 * uy); path.closePath(); }
          else { const m = mk.n, rr = r * (m === 3 ? 1.25 : 1.08); for (let k = 0; k < m; k++) { const a = ang + (TAU * k) / m, qx = x + rr * Math.cos(a), qy = y + rr * Math.sin(a); if (k) path.lineTo(qx, qy); else path.moveTo(qx, qy); } path.closePath(); }
        }
      }
      const alpha = what.alpha == null ? 1 : what.alpha;
      if (what.print) { ctx.globalAlpha = what.inkAlpha == null ? 1 : what.inkAlpha; ctx.fillStyle = css(INK); ctx.fill(ink); ctx.globalAlpha = 1; }
      if (!what.overlay) return drawn;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (showCuts) { const sa = what.seamAlpha == null ? alpha : what.seamAlpha; ctx.strokeStyle = css(DARK, 0.5 * sa); ctx.lineWidth = 1.1; ctx.stroke(seamP[0]); ctx.strokeStyle = css(DARK, 0.3 * sa); ctx.lineWidth = 0.7; ctx.stroke(seamP[1]); }
      const widths = [2.1, 1.4, 0.8];
      if (!what.cutsOnly) {
        ctx.strokeStyle = css(RED, 1);
        mirrors.forEach((p, b) => { ctx.lineWidth = widths[b]; ctx.stroke(p); });
        glides.forEach((p, b) => { ctx.lineWidth = widths[b]; ctx.setLineDash([widths[b] * 3.2, widths[b] * 3]); ctx.stroke(p); });
        ctx.setLineDash([]);
      }
      // the cuts: white under each colour, so that it reads the same over the ground and over the print
      const cw = [3.2, 2.2, 1.2];
      for (const [id, paths] of cutP) {
        const st = (sc.cuts && sc.cuts[id]) || { color: '#e69f00', type: 'cuff' }, on = hover === id, k = on ? 1.75 : 1;
        const a = alpha * (what.cutAlpha ? what.cutAlpha(id) : 1);
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        paths.forEach((p, b) => { ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = (cw[b] + 2.2) * k; ctx.stroke(p); });
        paths.forEach((p, b) => { ctx.setLineDash(st.type === 'arc' ? [cw[b] * 2.2 * k, cw[b] * 2.4 * k] : []); ctx.lineCap = st.type === 'arc' ? 'butt' : 'round'; ctx.strokeStyle = st.color; ctx.lineWidth = cw[b] * k; ctx.stroke(p); });
        ctx.setLineDash([]); ctx.lineCap = 'round'; ctx.globalAlpha = 1;
      }
      // the special points: as crystallographers draw them, or, for the two sides of the cut pointed at, one side
      // filled in the cut's colour and the other ringed in it
      const tint = parted && sc.cuts && sc.cuts[hover] ? sc.cuts[hover].color : null;
      for (const [id, path] of [...marks].sort((a, b) => a[0].length - b[0].length)) {
        const side = id[2];
        if (side === 'A' && tint) { ctx.fillStyle = tint; ctx.fill(path); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.4; ctx.stroke(path); continue; }
        if (side === 'B' && tint) { ctx.fillStyle = 'rgba(255,255,255,0.97)'; ctx.fill(path); ctx.strokeStyle = tint; ctx.lineWidth = id[1] === '0' ? 2.6 : 1.6; ctx.stroke(path); continue; }
        ctx.fillStyle = css(id[0] === 'c' ? BLUE : RED, 1); ctx.fill(path);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = id[1] === '0' ? 1 : 0.5; ctx.stroke(path);
      }
      return drawn;
    };

    hits = [];
    const list = tileList(), tnow = now();
    let fadeIn = 1;
    if (fresh) { fadeIn = calm ? 1 : Math.min(1, (tnow - fresh.t0) / FADE_MS); if (fadeIn >= 1) fresh = null; }
    if (ghost) { const k = calm ? 1 : Math.min(1, (tnow - ghost.t0) / FADE_MS); if (k >= 1) ghost = null; else ghost.k = k; }
    const drawn = paint(scene, V, list, { print: true, overlay: !bare, hit: true, seamAlpha: ghost ? fadeIn : 1, cutAlpha: fresh ? (id) => (fresh.cuts.has(id) ? fadeIn : 1) : null });
    if (ghost && !bare) {
      const gl = ghost.tiles || (ghost.tiles = walk(ghost.scene.atlas, ghost.home, { radius: kind === 'H' ? 5 + 2 * ghost.scene.atlas.reach : kind === 'E' ? Math.hypot(W, H) / 2 / R + 2 * ghost.scene.atlas.reach : Infinity, max: 2500, ms: 200 }));
      paint(ghost.scene, ghost.V, gl, { print: false, overlay: true, cutsOnly: ghost.cuts, alpha: 1 - ghost.k });
    }
    stats = { tiles: list.length, drawn };
    ctx.restore();
    if (kind !== 'E') {
      if (kind === 'S') {
        const g = ctx.createRadialGradient(cx - 0.3 * R, cy - 0.35 * R, 0.1 * R, cx, cy, R);
        g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(10,20,30,0.3)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = 1.2; ctx.strokeStyle = css(DARK, 0.55); ctx.stroke();
    }
    if (quick && kind === 'H') { const ms = now() - t0; budget = Math.round(Math.max(300, Math.min(2400, budget * Math.max(0.6, Math.min(1.3, 30 / Math.max(1, ms)))))); }
    if (ghost || fresh) schedule();
  }
  const schedule = () => { if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(draw); };

  /** The cut that passes within r px of a point of the canvas, or null. */
  function cutAt(x, y, r) {
    let best = null, bd = r;
    for (const h of hits) {
      const vx = h[3] - h[1], vy = h[4] - h[2], t = Math.max(0, Math.min(1, ((x - h[1]) * vx + (y - h[2]) * vy) / (vx * vx + vy * vy || 1)));
      const d = Math.hypot(x - h[1] - t * vx, y - h[2] - t * vy);
      if (d < bd) { bd = d; best = h[0]; }
    }
    return best;
  }

  // ---- sliding the pattern about
  let drag = null, lastTap = 0, still = 0, coast = 0, panned = 0;        // panned: how often the person has moved the view
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const FADE = 200, MIN_SPEED = 0.12, MAX_SPEED = 2.5;
  const stopCoast = () => { if (coast) { cancelAnimationFrame(coast); coast = 0; } };
  const settle = () => { clearTimeout(still); still = setTimeout(() => { quick = false; schedule(); }, 150); };
  function release(was, t) {
    const pts = was.trail;
    if (calm || !pts || pts.length < 2) return false;
    const last = pts[pts.length - 1];
    if (t - last.t > 70) return false;
    let first = last;
    for (let i = pts.length - 2; i >= 0 && last.t - pts[i].t <= 90; i--) first = pts[i];
    const dt = last.t - first.t;
    if (dt < 8) return false;
    let vx = (last.x - first.x) / dt, vy = (last.y - first.y) / dt;
    const s = Math.hypot(vx, vy);
    if (s < MIN_SPEED) return false;
    if (s > MAX_SPEED) { vx *= MAX_SPEED / s; vy *= MAX_SPEED / s; }
    const x = last.x, y = last.y;
    let prev = now();
    const step = (tn) => {
      coast = 0;
      if (!scene) return;
      const dt2 = Math.min(50, Math.max(0, tn - prev)), k = Math.exp(-dt2 / FADE);
      prev = tn;
      const dx = vx * FADE * (1 - k), dy = vy * FADE * (1 - k);
      vx *= k; vy *= k;
      if (dx || dy) { V = G.fix(mul(G.translate(unproject(x, y), unproject(x + dx, y + dy)), V), hand()); recentre(); }
      if (Math.hypot(vx, vy) > 0.02) { quick = true; schedule(); coast = requestAnimationFrame(step); return; }
      settle(); schedule();
    };
    coast = requestAnimationFrame(step);
    return true;
  }
  canvas.addEventListener('pointerdown', (e) => {
    stopCoast();
    if (!scene || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const [x, y] = local(e);
    drag = { id: e.pointerId, p0: unproject(x, y), V0: V.slice(), home0: home, rev0: vRev, x, y, moved: false, trail: [{ x, y, t: now() }] };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    if (!drag) { if (scene && showCuts && e.pointerType === 'mouse') { const c = cutAt(x, y, 8); if (c !== hover) { hover = c; canvas.style.cursor = c ? 'pointer' : ''; if (opts.onHover) opts.onHover(c); schedule(); } } return; }
    if (drag.id !== e.pointerId) return;
    const t = now();
    drag.trail.push({ x, y, t });
    while (drag.trail.length > 2 && t - drag.trail[0].t > 120) drag.trail.shift();
    if (Math.hypot(x - drag.x, y - drag.y) > 3 && !drag.moved) { drag.moved = true; panned++; }
    if (!drag.moved) return;
    const p = unproject(x, y);
    // from where the drag began: the view then, moved; the tile the tiles are counted from is found afresh
    V = G.fix(mul(G.translate(drag.p0, p), drag.V0), drag.rev0 ? -1 : 1); home = drag.home0; vRev = drag.rev0;
    recentre();
    if (kind === 'H' && G.dist(drag.p0, p) > 2.6) { drag.p0 = p; drag.V0 = V.slice(); drag.home0 = home; drag.rev0 = vRev; }
    quick = true; clearTimeout(still);
    schedule();
  });
  const up = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const was = drag;
    drag = null;
    if (!was.moved) {
      const mouse = e.pointerType === 'mouse', c = showCuts ? cutAt(was.x, was.y, mouse ? 8 : 18) : null, t = now();
      if (c) {
        // a mouse has pointed at the cut already (it is drawn heavier); a finger points with one tap and flips with
        // the next, so that a touch meant to slide the pattern never cuts it another way
        if (mouse || hover === c) { if (opts.onPick) opts.onPick(c); } else { hover = c; if (opts.onHover) opts.onHover(c); schedule(); }
        lastTap = 0;
        return;
      }
      if (!mouse && hover && showCuts) { hover = null; if (opts.onHover) opts.onHover(null); schedule(); }
      if (t - lastTap < 320) { api.resetView(); lastTap = 0; } else lastTap = t;
      return;
    }
    if (e.type === 'pointerup' && release(was, now())) return;
    settle();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', (e) => { if (showCuts && e.pointerType === 'mouse' && !drag && hover) { hover = null; canvas.style.cursor = ''; if (opts.onHover) opts.onHover(null); schedule(); } });
  canvas.addEventListener('wheel', (e) => {
    if (!scene || e.ctrlKey) return;
    e.preventDefault();
    stopCoast();
    let dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 30; dy *= 30; } else if (e.deltaMode === 2) { dx *= 300; dy *= 300; }
    dx = Math.max(-240, Math.min(240, dx)); dy = Math.max(-240, Math.min(240, dy));
    if (!dx && !dy) return;
    const [x, y] = local(e);
    V = G.fix(mul(G.translate(unproject(x, y), unproject(x - dx, y - dy)), V), hand());
    recentre();
    panned++;
    quick = true; settle(); schedule();
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    if (!scene) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (e.key === '0' || e.key === 'Home') { api.resetView(); e.preventDefault(); return; }
    if (!d) return;
    e.preventDefault();
    stopCoast();
    const step = kind === 'E' ? 0.5 * Math.sqrt(scene.area || 4) : kind === 'S' ? 0.2 : 0.35;
    V = G.fix(mul(G.translate(G.origin, G.polar(step, Math.atan2(d[1], d[0]))), V), hand());
    recentre();
    panned++;
    schedule();
  });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (scene) { tilesKey = ''; schedule(); } }).observe(canvas);

  let stampN = 0;
  const adopt = (sc) => { scene = sc; scene.stamp = ++stampN; G = geomOf(sc.atlas.kind); kind = sc.atlas.kind; tilesKey = ''; };
  const api = {
    /** A new pattern: the view starts over. */
    show(sc) { stopCoast(); ghost = null; fresh = null; hover = null; adopt(sc); size(); firstView(); quick = false; draw(); },
    clear() { stopCoast(); scene = null; ghost = null; fresh = null; size(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); },
    /**
     * The same decomposition with other numbers. The atom in the middle of the view keeps its place: if `cut` is one
     * of its piece's own, that cut's reference frame stays where it is (so a twist slides the far side past, and a
     * length keeps the cut's line); otherwise the atom's own middle and the way to its first corner.
     */
    update(sc, { cut = null, fast = false } = {}) {
      if (!scene) return api.show(sc);
      const old = scene.atlas, inv = invOf(old.kind), oa = old.atoms[home], na = sc.atlas.atoms[home];
      if (!oa || !na || sc.atlas.kind !== old.kind || oa.verts.length !== na.verts.length) return api.show(sc);
      let Fo = null, Fn = null;
      if (cut != null) { const i = oa.sides.findIndex((sd) => sd.cut === cut && sd.axis); if (i >= 0 && na.sides[i] && na.sides[i].axis) { Fo = oa.sides[i].axis; Fn = na.sides[i].axis; } }
      if (!Fo) { Fo = G.frame(oa.at, oa.verts[0]); Fn = G.frame(na.at, na.verts[0]); }
      V = G.fix(mul(mul(V, Fo), inv(Fn)), hand());
      adopt(sc);
      recentre();
      if (fast) { quick = true; settle(); }
      schedule();
    },
    /**
     * Another decomposition of the same pattern. carry(atomId) -> { atom, M }: the old atom's chart lies in the new
     * atom's chart by M. Nothing moves; the old cuts in `gone` fade out and the new ones in `made` fade in.
     */
    replace(sc, carry, { gone = [], made = [] } = {}) {
      if (!scene) return api.show(sc);
      const before = { scene, V: V.slice(), home, cuts: new Set(gone), t0: now(), k: 0 };
      const c = carry(home), inv = invOf(scene.atlas.kind);
      if (!c) return api.show(sc);
      V = mul(V, inv(c.M)); home = c.atom;
      if (det(c.M) < 0) vRev = !vRev;
      adopt(sc);
      recentre();
      ghost = showCuts && gone.length ? before : null;
      fresh = showCuts && made.length ? { cuts: new Set(made), t0: now() } : null;
      quick = false;
      schedule();
    },
    setHover(id) { if (hover !== id) { hover = id; schedule(); } },
    /** The cuts and the seams of the pieces drawn as lines (and a cut on the pattern then takes a click), or not. */
    setCuts(on) { showCuts = !!on; if (!showCuts) { ghost = null; fresh = null; canvas.style.cursor = ''; } schedule(); },
    /** The print alone, without the cuts, the seams and the marks: what a flip must leave exactly as it was (the checks compare it). */
    setBare(on) { bare = !!on; schedule(); },
    resetView() { stopCoast(); if (!scene) return; firstView(); panned++; quick = false; schedule(); },
    /** The view as it is, to come back to (Undo of a slider): where the tiles are counted from and how, and how often the person has moved the view. */
    snap: () => ({ V: V.slice(), home, vRev, panned }),
    /** A scene shown exactly as a snap of it had it. */
    restore(sc, snap) {
      if (!scene || !snap || !sc.atlas.atoms[snap.home] || sc.atlas.kind !== kind) return api.show(sc);
      stopCoast();
      V = snap.V.slice(); home = snap.home; vRev = snap.vRev;
      adopt(sc);
      quick = false;
      schedule();
    },
    draw, redraw: schedule,
    /** Where a point of the home atom's chart is on the screen (for the tests), and the view itself. */
    project(p) { const L = lay(), q = apply(V, p); return kind === 'H' ? [L.cx + (L.R * q[0]) / (1 + q[2]), L.cy - (L.R * q[1]) / (1 + q[2])] : [L.cx + L.R * q[0], L.cy - L.R * q[1]]; },
    state: () => ({ kind, home, V: V.slice(), ...stats, hits: hits.length, hover, cuts: showCuts, fading: !!(ghost || fresh) }),
    cutAt,
  };
  return api;
}
