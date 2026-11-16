// pattern.js — the pattern pane of the Symmetries tab: a 2D canvas that draws one repeating pattern in the geometry
// it lives in, and lets you slide it about by the motions of that geometry.
//
//   sphere            seen from far away (orthographic): a ball; a drag turns it, the point you took stays under the finger
//   plane             as it is; a drag slides it
//   hyperbolic plane  the Poincare disc (angles true, straight lines drawn as arcs square to the rim); a drag slides
//                     the pattern along a hyperbolic line, so every tile can be brought to the middle
//
// What is drawn, tile by tile (orbifold.js tiles()):
//   the tile itself     teal where the symmetry keeps the pattern's sense, sand where it is a mirror image (the two
//                       sides of the paper of the 3D pane: folding the pattern up turns every sand tile over)
//   a comma             the motif: it has no symmetry of its own, so the pattern has exactly the tile's
//   red lines           mirrors (one colour of the book's signature: what reflects)        dashed: a glide's axis
//   blue / red marks    gyration points (blue) and the points where mirrors cross (red): a lens for order 2, then
//                       a triangle, a square, a pentagon ... as crystallographers draw them
// One tile is outlined: the one the surface in the other pane is folded from. Its glued edges carry arrows and
// letters (the same letters tab 3 uses when it zips this tile up).
//
//   const P = createPattern(canvas);
//   P.set({ D, A, binding, tokens })    a new pattern (the view starts over)
//   P.select(i | null)                  bring out what the i-th character of the signature stands for
//   P.resetView()   P.draw()   P.state()   for the tests

import { mul, apply, I3 } from './geom.js';
import { tiles as makeTiles } from './orbifold.js';

const TAU = 2 * Math.PI;
export const BLUE = [0, 0.447, 0.698], RED = [0.835, 0.369, 0];
const DARK = [0.08, 0.09, 0.12], FRONT = [0.5, 0.79, 0.75], BACK = [0.93, 0.85, 0.63];
const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

/** The comma, in units of the room the tile leaves round its point: an outline that curls counter-clockwise from its head. */
function comma(n) {
  const rho = 0.42, a0 = 2.3, sweep = 3.5, w0 = 0.22, outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + sweep * t, w = 0.03 + (w0 - 0.03) * Math.pow(1 - t, 0.85);
    outer.push([(rho + w) * Math.cos(a), (rho + w) * Math.sin(a)]);
    inner.push([(rho - w) * Math.cos(a), (rho - w) * Math.sin(a)]);
  }
  const head = [], k = Math.max(2, Math.round(n / 3)), c = [rho * Math.cos(a0), rho * Math.sin(a0)], rad = [Math.cos(a0), Math.sin(a0)], back = [Math.sin(a0), -Math.cos(a0)];
  for (let i = 1; i < k; i++) { const b = Math.PI * (1 - i / k); head.push([c[0] + w0 * (Math.cos(b) * rad[0] + Math.sin(b) * back[0]), c[1] + w0 * (Math.cos(b) * rad[1] + Math.sin(b) * back[1])]); }
  return outer.concat(inner.reverse(), head);
}
const COMMA = [comma(12), comma(5)];

export function createPattern(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let model = null, G = null, V = I3.slice(), base = I3.slice(), sel = null, quick = false;
  let budget = 1500, cache = new Map(), motif = [[], []], reach = 1, area = 1, stats = { tiles: 0, drawn: 0 };
  let raf = 0;

  function size() {
    const r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);      // 2 is sharp enough, and a 3x phone fills 2.25 times fewer pixels
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === W && h === H && d === dpr) return;
    W = w; H = h; dpr = d;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  // what a unit of the geometry is on the screen, and where its origin goes
  const lay = () => {
    const half = Math.min(W, H) / 2;
    // on the plane: a tile is about as large on a phone as on a desk, so a small pane shows fewer of them
    if (G.kind === 'E') return { cx: W / 2, cy: H / 2, R: half / (Math.max(2.1, Math.min(3.1, half / 88)) * Math.sqrt(area)), half };
    return { cx: W / 2, cy: H / 2, R: half * 0.94, half };
  };
  /** Under a pointer: the point of the geometry (in view coordinates). */
  function unproject(x, y) {
    const L = lay(), u = (x - L.cx) / L.R, v = -(y - L.cy) / L.R, d2 = u * u + v * v;
    if (G.kind === 'E') return [u, v, 1];
    if (G.kind === 'S') { if (d2 >= 1) { const l = Math.sqrt(d2); return [u / l, v / l, 0]; } return [u, v, Math.sqrt(1 - d2)]; }
    const m = Math.min(1, 0.93 / Math.sqrt(d2 || 1e-12)), a = u * m, b = v * m, q = a * a + b * b;     // not too near the rim: the slide stays gentle
    return [(2 * a) / (1 - q), (2 * b) / (1 - q), (1 + q) / (1 - q)];
  }

  function firstView() {
    base = I3.slice();
    if (G.kind === 'S') {
      // the tile's own middle faces the eye, tipped a little so that no mirror hides on the rim
      const a = -0.42, b = 0.34, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const Rx = [1, 0, 0, 0, ca, -sa, 0, sa, ca], Ry = [cb, 0, sb, 0, 1, 0, -sb, 0, cb];
      V = mul(mul(Rx, Ry), G.translate(model.D.face || model.D.at, G.origin));
    } else V = G.translate(model.D.at, G.origin);
  }
  /** Keep the tile nearest the middle of the view the one the list of tiles is centred on (the pattern does not move). */
  function recentre(V0) {
    if (G.kind === 'S') return V0;
    const { D, A } = model, far = (M) => { const p = apply(M, D.at); return p[0] * p[0] + p[1] * p[1]; };
    for (let guard = 0; guard < 400; guard++) {
      let best = -1, bd = far(V) - 1e-9;
      for (let i = 0; i < D.n; i++) { const d = far(mul(V, A.maps[i])); if (d < bd) { bd = d; best = i; } }
      if (best < 0) break;
      const h = A.maps[best], hi = A.maps[D.edges[best].mirror ? best : D.edges[best].to];     // the neighbour's own way back
      V = mul(V, h); base = mul(hi, base);
      if (V0) V0 = mul(V0, h);
    }
    V = G.fix(V); base = G.fix(base);
    return V0 ? G.fix(V0) : V0;
  }

  function tileList() {
    const { D, A } = model;
    let radius = Infinity, max = 4200;
    if (G.kind === 'E') { const L = lay(); radius = (Math.hypot(W, H) / 2) / L.R + reach; }
    if (G.kind === 'H') radius = 4.25 + 2 * reach;       // the middle of the view is within `reach` of the first tile
    const key = G.kind + ':' + radius.toFixed(2) + ':' + max;
    if (!cache.has(key)) { if (cache.size > 3) cache.clear(); cache.set(key, makeTiles(D, A, { radius, max })); }
    const all = cache.get(key);
    // while the hand moves, on the hyperbolic plane: only the nearest tiles, as many as were drawn in time last time
    return quick && G.kind === 'H' && all.length > budget ? all.slice(0, budget) : all;
  }

  // ---- drawing
  function draw() {
    raf = 0;
    if (!model) return;
    const t0 = performance.now();
    size();
    const { D, A, binding } = model, kind = G.kind, L = lay(), { cx, cy, R } = L;
    const n = D.n, list = tileList();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (kind !== 'E') { ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip(); }

    const X = (p) => (kind === 'H' ? cx + (R * p[0]) / (1 + p[2]) : cx + R * p[0]);
    const Y = (p) => (kind === 'H' ? cy - (R * p[1]) / (1 + p[2]) : cy - R * p[1]);
    const lerp = (a, b, t) => G.norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    // a small shape that need not be convex (the comma): on the sphere, whatever of it is behind the ball is pressed
    // onto the rim (the exact cut below pairs each way out with the next way in, which is only right for a convex tile)
    const blob = (path, pts) => {
      if (kind !== 'S') { path.moveTo(X(pts[0]), Y(pts[0])); for (let i = 1; i < pts.length; i++) path.lineTo(X(pts[i]), Y(pts[i])); path.closePath(); return; }
      let front = 0;
      for (const p of pts) if (p[2] >= 0) front++;
      if (front < 3) return;
      pts.forEach((p, i) => {
        let x = p[0], y = p[1];
        if (p[2] < 0) { const l = Math.hypot(x, y) || 1; x /= l; y /= l; }
        if (i) path.lineTo(cx + R * x, cy - R * y); else path.moveTo(cx + R * x, cy - R * y);
      });
      path.closePath();
    };
    // a closed CONVEX outline given by points of the geometry, added to a path (on the sphere: only what faces the eye)
    const closed = (path, pts, flip) => {
      const m = pts.length;
      if (kind !== 'S') { path.moveTo(X(pts[0]), Y(pts[0])); for (let i = 1; i < m; i++) path.lineTo(X(pts[i]), Y(pts[i])); path.closePath(); return; }
      let any = false, all = true;
      for (const p of pts) { if (p[2] >= 0) any = true; else all = false; }
      if (!any) return;
      if (all) { path.moveTo(X(pts[0]), Y(pts[0])); for (let i = 1; i < m; i++) path.lineTo(X(pts[i]), Y(pts[i])); path.closePath(); return; }
      const rim = (a, b) => { const t = a[2] / (a[2] - b[2]), x = a[0] + t * (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]), l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
      let i0 = 0;
      while (!(pts[(i0 + m - 1) % m][2] < 0 && pts[i0][2] >= 0)) i0++;
      const e0 = rim(pts[(i0 + m - 1) % m], pts[i0]);
      path.moveTo(cx + R * e0[0], cy - R * e0[1]);
      let out = null;
      for (let k = 0; k < m; k++) {
        const p = pts[(i0 + k) % m], q = pts[(i0 + k + 1) % m];
        if (p[2] >= 0) {
          if (out) { const e = rim(pts[(i0 + k + m - 1) % m], p); path.arc(cx, cy, R, -Math.atan2(out[1], out[0]), -Math.atan2(e[1], e[0]), !flip); out = null; }
          path.lineTo(cx + R * p[0], cy - R * p[1]);
          if (q[2] < 0) { out = rim(q, p); path.lineTo(cx + R * out[0], cy - R * out[1]); }
        }
      }
      if (out) path.arc(cx, cy, R, -Math.atan2(out[1], out[0]), -Math.atan2(e0[1], e0[0]), !flip);
      path.closePath();
    };
    // an open line: a -> b along the geometry's straight line, in `steps` pieces (on the sphere: the visible part)
    const line = (path, a, b, steps) => {
      let on = false;
      for (let s = 0; s <= steps; s++) {
        const p = s === 0 ? a : s === steps ? b : lerp(a, b, s / steps);
        if (kind === 'S' && p[2] < 0) { on = false; continue; }
        if (!on) { path.moveTo(X(p), Y(p)); on = true; } else path.lineTo(X(p), Y(p));
      }
    };
    const stepsFor = (a, b) => {
      if (kind === 'E') return 1;
      if (kind === 'S') return Math.max(2, Math.ceil(G.dist(a, b) / 0.11));
      return Math.max(1, Math.min(12, Math.ceil(Math.hypot(X(a) - X(b), Y(a) - Y(b)) / 9)));
    };

    // which corner class, star, glide the selected character stands for
    const pick = sel !== null && binding[sel] ? binding[sel] : null;
    const dim = pick ? 0.38 : 1;
    const fill = [new Path2D(), new Path2D()], edge = [0, 1, 2].map(() => new Path2D()), commas = new Path2D();
    const mirrors = A.stars.map(() => [0, 1, 2].map(() => new Path2D())), glides = A.glides.map(() => [0, 1, 2].map(() => new Path2D()));
    const marks = A.classes.map(() => new Path2D());
    const starOf = new Array(n).fill(-1);
    A.stars.forEach((s, k) => s.edges.forEach((e) => { starOf[e] = k; }));
    // the corner classes that get a mark, and from which corner each is drawn
    const marked = A.classes.filter((c) => c.n > 1).map((c) => {
      const v = c.verts[0];
      let toward = null;
      if (c.kind === 'corner') { const en = c.ends[0]; toward = en.side === 'start' ? (en.e + 1) % n : en.e; }
      return { c, v, toward };
    });
    let drawn = 0;
    const P = new Array(n);
    for (const t of list) {
      const M = mul(V, t.M), c = apply(M, D.at);
      const ppu = kind === 'H' ? R / (1 + c[2]) : R, px = D.clear * ppu;
      for (let i = 0; i < n; i++) P[i] = apply(M, D.verts[i]);
      if (kind === 'S') { let vis = c[2] > 0; for (let i = 0; i < n && !vis; i++) if (P[i][2] > 0) vis = true; if (!vis) continue; }
      if (kind === 'E') { let inView = false; const m = reach * R + 4; if (X(c) > -m && X(c) < W + m && Y(c) > -m && Y(c) < H + m) inView = true; if (!inView) continue; }
      if (kind === 'H' && px < 0.35) continue;
      drawn++;
      const b = px >= 20 ? 0 : px >= 7 ? 1 : 2;
      // the outline, edge by edge
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = P[i], q = P[(i + 1) % n], st = stepsFor(a, q);
        pts.push(a);
        for (let s = 1; s < st; s++) pts.push(lerp(a, q, s / st));
      }
      closed(fill[t.flip ? 1 : 0], pts, t.flip);
      closed(edge[b], pts, t.flip);
      for (let i = 0; i < n; i++) if (starOf[i] >= 0) line(mirrors[starOf[i]][b], P[i], P[(i + 1) % n], stepsFor(P[i], P[(i + 1) % n]));
      A.glides.forEach((g, k) => { if (g.seg) { const a = apply(M, g.seg[0]), q = apply(M, g.seg[1]); line(glides[k][b], a, q, kind === 'E' ? 1 : Math.max(2, stepsFor(a, q))); } });
      if (px >= 2.4) { const src = motif[px >= 9 ? 0 : 1]; blob(commas, src.map((m) => apply(M, m))); }
      if (px >= 4.5) for (const mk of marked) {
        const p = P[mk.v];
        if (kind === 'S' && p[2] < 0.05) continue;
        const to = mk.toward === null ? c : P[mk.toward], q = lerp(p, to, 0.06);
        const ang = Math.atan2(Y(q) - Y(p), X(q) - X(p)), on = pick && pick.t === 'd' && pick.cls === mk.c.id;
        const r = Math.min(on ? 9.5 : 6.5, (on ? 0.34 : 0.24) * px), x = X(p), y = Y(p), path = marks[mk.c.id];
        if (r < 1.1) continue;
        if (mk.c.n === 2) { const ux = Math.cos(ang), uy = Math.sin(ang), a1 = 1.25 * r, w = 0.95 * r; path.moveTo(x + a1 * ux, y + a1 * uy); path.quadraticCurveTo(x - w * uy, y + w * ux, x - a1 * ux, y - a1 * uy); path.quadraticCurveTo(x + w * uy, y - w * ux, x + a1 * ux, y + a1 * uy); path.closePath(); }
        else { const m = mk.c.n, rr = r * (m === 3 ? 1.25 : 1.08); for (let k = 0; k < m; k++) { const a = ang + (TAU * k) / m, qx = x + rr * Math.cos(a), qy = y + rr * Math.sin(a); if (k) path.lineTo(qx, qy); else path.moveTo(qx, qy); } path.closePath(); }
      }
    }
    stats = { tiles: list.length, drawn };

    ctx.fillStyle = css(FRONT); ctx.fill(fill[0]);
    ctx.fillStyle = css(BACK); ctx.fill(fill[1]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    [[0.9, 0.2], [0.7, 0.16], [0.5, 0.12]].forEach(([w, a], b) => { ctx.lineWidth = w; ctx.strokeStyle = css(DARK, a); ctx.stroke(edge[b]); });
    ctx.fillStyle = css(DARK, 0.6); ctx.fill(commas);
    // mirrors and glide axes: red
    const widths = [2.1, 1.4, 0.8];
    A.stars.forEach((s, k) => {
      // chosen: bold. One of its corners chosen: left at full strength, since that corner is where these mirrors cross
      const on = pick && pick.t === '*' && pick.star === k, near = pick && pick.t === 'd' && pick.role === 'corner' && pick.star === k;
      ctx.strokeStyle = css(RED, on || near || !pick ? 1 : dim);
      mirrors[k].forEach((p, b) => { ctx.lineWidth = widths[b] * (on ? 1.7 : 1); ctx.stroke(p); });
    });
    A.glides.forEach((g, k) => {
      const on = pick && pick.t === 'x' && pick.k % A.glides.length === k;
      ctx.strokeStyle = css(RED, on || !pick ? 1 : dim);
      glides[k].forEach((p, b) => { ctx.lineWidth = widths[b] * (on ? 1.7 : 1); ctx.setLineDash([widths[b] * 3.2, widths[b] * 3]); ctx.stroke(p); });
      ctx.setLineDash([]);
    });
    // the marked points: blue inside the surface (gyrations), red on a mirror
    for (const mk of marked) {
      const on = pick && pick.t === 'd' && pick.cls === mk.c.id, col = mk.c.kind === 'cone' ? BLUE : RED;
      ctx.fillStyle = css(col, on || !pick ? 1 : dim);
      ctx.fill(marks[mk.c.id]);
      ctx.lineWidth = on ? 1.6 : 1; ctx.strokeStyle = `rgba(255,255,255,${on || !pick ? 0.95 : 0.5})`;
      ctx.stroke(marks[mk.c.id]);
    }

    // ---- the tile the surface is folded from
    {
      const M = mul(V, base), Q = D.verts.map((v) => apply(M, v)), c = apply(M, D.at);
      const ppu = kind === 'H' ? R / (1 + c[2]) : R, px = D.clear * ppu;
      const visible = kind !== 'S' || c[2] > -0.2;
      if (visible && px > 3) {
        const flip = M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]) < 0;
        const pts = [];
        for (let i = 0; i < n; i++) { const a = Q[i], q = Q[(i + 1) % n], st = stepsFor(a, q); pts.push(a); for (let s = 1; s < st; s++) pts.push(lerp(a, q, s / st)); }
        const out = new Path2D();
        closed(out, pts, flip);
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill(out);
        ctx.lineWidth = 2.6; ctx.strokeStyle = css(DARK, 0.95); ctx.stroke(out);
        // mirrors of the tile on top of its outline, in red
        for (let i = 0; i < n; i++) if (starOf[i] >= 0) { const p = new Path2D(); line(p, Q[i], Q[(i + 1) % n], stepsFor(Q[i], Q[(i + 1) % n])); const on = pick && pick.t === '*' && pick.star === starOf[i]; ctx.strokeStyle = css(RED, on || !pick ? 1 : 0.6); ctx.lineWidth = on ? 4.4 : 3; ctx.stroke(p); }
        // glued edges: an arrow in the middle, and the zip's letter beside it
        ctx.font = '600 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < n; i++) {
          const e = D.edges[i];
          if (e.mirror) continue;
          const a = Q[i], q = Q[(i + 1) % n], mid = lerp(a, q, 0.5), m2 = lerp(a, q, 0.56);
          if (kind === 'S' && mid[2] < 0.02) continue;
          const lenPx = Math.hypot(X(a) - X(q), Y(a) - Y(q));
          if (lenPx < 16) continue;
          let dx = X(m2) - X(mid), dy = Y(m2) - Y(mid);
          const l = Math.hypot(dx, dy) || 1;
          dx /= l; dy /= l;
          const along = e.to > i || e.rev ? 1 : -1;        // a ... a^-1: the second arrow runs against the outline
          const tx = dx * along, ty = dy * along, s = Math.min(8, lenPx / 4), x = X(mid), y = Y(mid);
          ctx.beginPath(); ctx.moveTo(x - tx * s - ty * s * 0.75, y - ty * s + tx * s * 0.75); ctx.lineTo(x + tx * s * 0.7, y + ty * s * 0.7); ctx.lineTo(x - tx * s + ty * s * 0.75, y - ty * s - tx * s * 0.75);
          ctx.lineWidth = 2.4; ctx.strokeStyle = css(DARK, 1); ctx.stroke();
          if (lenPx >= 30) {
            // the letter sits inside the tile: toward the tile's own middle
            let ix = X(c) - x, iy = Y(c) - y; const il = Math.hypot(ix, iy) || 1; ix /= il; iy /= il;
            let nx = -dy, ny = dx; if (nx * ix + ny * iy < 0) { nx = -nx; ny = -ny; }
            const lx = x + nx * 13, ly = y + ny * 13;
            ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.strokeText(A.letter[i], lx, ly);
            ctx.fillStyle = css(DARK, 1); ctx.fillText(A.letter[i], lx, ly);
          }
        }
        // a wonder-ring chosen: its two wanderings, out of the tile across one glued edge and across the other
        if (pick && pick.t === 'o') {
          const turns = A.pairs.filter((p) => !p.rev).slice(2 * pick.k, 2 * pick.k + 2);
          ctx.strokeStyle = css(BLUE, 1); ctx.lineWidth = 2.6; ctx.setLineDash([2, 6]);
          for (const pr of turns) for (const i of [pr.i, pr.j]) {
            const mid = lerp(Q[i], Q[(i + 1) % n], 0.5), far = apply(mul(M, A.maps[i]), D.at), p = new Path2D();
            line(p, c, mid, Math.max(2, stepsFor(c, mid))); line(p, mid, far, Math.max(2, stepsFor(mid, far)));
            ctx.stroke(p);
          }
          ctx.setLineDash([]);
        }
      }
    }
    ctx.restore();
    // the edge of the world: the ball's limb, the disc's rim
    if (kind !== 'E') {
      if (kind === 'S') {
        const g = ctx.createRadialGradient(cx - 0.3 * R, cy - 0.35 * R, 0.1 * R, cx, cy, R);
        g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(10,20,30,0.3)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = 1.2; ctx.strokeStyle = css(DARK, 0.55); ctx.stroke();
    }
    // a moving hand wants some 25 frames a second: fewer tiles next time if this took longer, more if there was time to spare
    if (quick && kind === 'H') { const ms = performance.now() - t0; budget = Math.round(Math.max(350, Math.min(2200, budget * Math.max(0.6, Math.min(1.3, 34 / Math.max(1, ms)))))); }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

  // ---- sliding the pattern about
  let drag = null, lastTap = 0, settle = 0;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => {
    if (!model || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const [x, y] = local(e);
    drag = { id: e.pointerId, p0: unproject(x, y), V0: V.slice(), x, y, moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer: no capture, the drag still works */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const [x, y] = local(e);
    if (Math.hypot(x - drag.x, y - drag.y) > 3) drag.moved = true;
    if (!drag.moved) return;
    const p = unproject(x, y);
    V = G.fix(mul(G.translate(drag.p0, p), drag.V0));
    drag.V0 = recentre(drag.V0);
    // a very long stroke: start afresh from here, so that no huge slide has to be undone by a huge view
    if (G.kind === 'H' && G.dist(drag.p0, p) > 2.6) { drag.p0 = p; drag.V0 = V.slice(); }
    quick = true; clearTimeout(settle);
    schedule();
  });
  const up = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const was = drag;
    drag = null;
    if (!was.moved) {
      const now = performance.now();
      if (now - lastTap < 320) { api.resetView(); lastTap = 0; } else lastTap = now;
      return;
    }
    settle = setTimeout(() => { quick = false; schedule(); }, 140);     // the far rim is filled in once the hand is still
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('keydown', (e) => {
    if (!model) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (e.key === '0' || e.key === 'Home') { api.resetView(); e.preventDefault(); return; }
    if (!d) return;
    e.preventDefault();
    const step = G.kind === 'E' ? 0.5 * Math.sqrt(area) : G.kind === 'S' ? 0.2 : 0.35;
    V = G.fix(mul(G.translate(G.origin, G.polar(step, Math.atan2(d[1], d[0]))), V));
    recentre(null);
    schedule();
  });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (model) schedule(); }).observe(canvas);

  const api = {
    set(m) {
      model = m; G = m.D.G; sel = null; quick = false;
      cache = new Map();
      reach = Math.max(...m.D.verts.map((v) => G.dist(v, m.D.at)));
      area = Math.abs(G.area(m.D.verts)) || 1;
      const T = G.translate(G.origin, m.D.at);
      const room = Math.min(m.D.clear, G.kind === 'E' ? Infinity : 0.8);          // a comma of a size one can take in, even in a very large tile
      motif = COMMA.map((pts) => pts.map(([x, y]) => apply(T, G.polar(room * Math.hypot(x, y), Math.atan2(y, x)))));
      size(); firstView(); draw();
    },
    select(i) { sel = i; schedule(); },
    resetView() { if (!model) return; firstView(); quick = false; schedule(); },
    draw, redraw: schedule,
    state: () => ({ kind: G && G.kind, ...stats, V: V.slice(), base: base.slice(), sel }),
  };
  return api;
}
