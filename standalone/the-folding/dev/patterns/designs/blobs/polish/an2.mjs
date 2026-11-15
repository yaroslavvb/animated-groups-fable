// polish/an2.mjs — the lab's numbers (lab/measure.mjs analyse) for an entry of SEVERAL strokes (one blob of each per
// tile, e.g. a big comma and a small one per chamber of a kaleidoscope), with the numbers of every stroke's own blob.
// polish-soft, 14 Nov 2026.
import { solve, labelTorus, strokeBeads, spine } from '../design.js';
import { nearest, spineShape } from '../lab/measure.mjs';

/** The narrowest place of the region { !site } (lab/measure.mjs narrowest, which that file does not export). */
function narrowest(site, near, fld, h) {
  const { N1, N2, a1x, a1y, a2x, a2y } = fld, { di, dj, dist } = near;
  let w = Infinity;
  for (let j = 0; j < N2; j++) for (let i = 0; i < N1; i++) {
    const p = j * N1 + i;
    if (site[p]) continue;
    for (const [si, sj] of [[1, 0], [0, 1]]) {
      const q = ((j + sj) % N2) * N1 + ((i + si) % N1);
      if (site[q]) continue;
      const ei = si + di[q] - di[p], ej = sj + dj[q] - dj[p];
      const sep = Math.hypot(ei * a1x + ej * a2x, ei * a1y + ej * a2y);
      if (sep > 3 * h && sep >= 0.8 * (dist[p] + dist[q])) w = Math.min(w, sep - 0.9 * h);
    }
  }
  return w;
}

/**
 * The narrowest light channel between two DIFFERENT copies (blobs, or lattice translates of one blob): narrowest() of
 * the light region, counting only the places where the two banks belong to different copies. The light channel inside
 * one blob's own curl does not count here (it is a choice of the design, not two marks running into each other).
 */
function copyGap(dark, near, fld, h, L) {
  const { N1, N2, a1x, a1y, a2x, a2y } = fld, { di, dj, dist } = near;
  const bank = (i, j, p) => {                 // the dark sample nearest p: [root, lattice offset I, J] of its copy
    const I = i + di[p], J = j + dj[p], s = (((J % N2) + N2) % N2) * N1 + (((I % N1) + N1) % N1);
    const root = L.find(s), Ri = root % N1, Rj = (root - Ri) / N1;     // s sits at (Ri + dx[s], Rj + dy[s]) in its copy of the root
    return [root, Math.round((I - Ri - L.dx[s]) / N1), Math.round((J - Rj - L.dy[s]) / N2)];
  };
  let w = Infinity;
  copyGap.at = null;
  for (let j = 0; j < N2; j++) for (let i = 0; i < N1; i++) {
    const p = j * N1 + i;
    if (dark[p] || di[p] > 20000) continue;
    for (const [si, sj] of [[1, 0], [0, 1]]) {
      const q = ((j + sj) % N2) * N1 + ((i + si) % N1);
      if (dark[q]) continue;
      const ei = si + di[q] - di[p], ej = sj + dj[q] - dj[p];
      const sep = Math.hypot(ei * a1x + ej * a2x, ei * a1y + ej * a2y);
      if (!(sep > 3 * h && sep >= 0.8 * (dist[p] + dist[q]) && sep - 0.9 * h < w)) continue;
      const A = bank(i, j, p), B = bank(i + si, j + sj, q);
      if (A[0] === B[0] && A[1] === B[1] && A[2] === B[2]) continue;
      w = sep - 0.9 * h;
      copyGap.at = [i * a1x + j * a2x, i * a1y + j * a2y];
    }
  }
  return w;
}

const asArray = (st) => (Array.isArray(st) ? st : [st]);

/**
 * How sharply the spine of a stroke bends for its width: the largest (turning per unit length) x (the stroke's radius
 * there) along it. Over about 0.8 the inside of the bend pinches: an L or a V, not a comma. (The radius as
 * design.js strokeBeads has it.)
 */
export function bendOf(st, n = 96) {
  const S = spine(st, n), { rh, th = 0, q = 1 } = st, r0 = st.r0 ?? rh, rt = st.rt ?? 0.03;
  const radius = (t) => {
    if (t < th) { const z = t / th, f0 = (r0 - rt) / (rh - rt); return rt + (rh - rt) * (f0 + (1 - f0) * z * z * (3 - 2 * z)); }
    const w = Math.min(1, (t - th) / (1 - th));
    return rt + (rh - rt) * (1 - Math.pow(w, q));
  };
  let most = 0;
  const ds = S.len / n, skip = Math.ceil((1.3 * Math.max(r0, rh)) / ds);       // a bend inside the round head does not show
  for (let i = Math.max(2, skip); i < n - 1; i++) {
    // the turning over two steps either side (a little smoothing)
    const a0 = Math.atan2(S.y[i] - S.y[i - 2], S.x[i] - S.x[i - 2]), a1 = Math.atan2(S.y[i + 2 > n ? n : i + 2] - S.y[i], S.x[i + 2 > n ? n : i + 2] - S.x[i]);
    const turn = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)));
    most = Math.max(most, (turn / (2 * ds)) * radius(i / n));
  }
  return most;
}

/**
 * { cover, wanted, valid, marks, want, merged, bare, solid, gap, thin, bareAt, solidAt, dCentre, blobs: [{ share, asym,
 * solid, length, turn, wiggle, found }] } — `blobs[k]` is the blob under the fattest bead of stroke k; `merged` counts
 * strokes whose blob is (a copy of) an earlier stroke's; dCentre: the distance from the frame's origin (a rotation
 * centre of the group, when it has one) to the nearest dark place.
 */
export function analyse2(group, stroke, opts = {}) {
  const h = opts.h || 0.02, t0 = performance.now(), strokes = asArray(stroke), K = strokes.length;
  const S = solve(group, stroke, { h, cover: opts.cover, settle: false });
  const { F, fld } = S, { N1, N2, a1x, a1y, a2x, a2y } = fld, n = N1 * N2;
  let L = S.L, c = S.c, cv = S.cover;
  const good = (M) => M.comps.every((k) => !k.wraps && k.stab === 1);
  if (!good(L)) {
    let lo = 0.08, hi = cv;
    for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (good(labelTorus(fld, S.levelAt(mid), F))) lo = mid; else hi = mid; }
    cv = lo; c = S.levelAt(cv); L = labelTorus(fld, c, F);
    if (opts.quick) return { cover: cv, wanted: S.wanted, valid: false, marks: 1, want: K, merged: K, bare: 1, solid: 0, gap: 0, thin: 0, dCentre: 0, blobs: [], quick: true };
  }
  const valid = good(L);
  const dark = new Uint8Array(n), light = new Uint8Array(n);
  for (let p = 0; p < n; p++) { dark[p] = L.par[p] >= 0 ? 1 : 0; light[p] = 1 - dark[p]; }
  const toDark = nearest(dark, fld), toLight = nearest(light, fld);
  let bare = 0, solid = 0, bareAt = 0, solidAt = 0, soft = 0;
  const tau = opts.tau ?? 0.19;
  for (let p = 0; p < n; p++) {
    if (dark[p]) { if (toLight.dist[p] > solid) { solid = toLight.dist[p]; solidAt = p; } }
    else {
      if (toDark.dist[p] > bare) { bare = toDark.dist[p]; bareAt = p; }
      if (toDark.dist[p] > tau) soft += (toDark.dist[p] - tau) * (toDark.dist[p] - tau);
    }
  }
  // a smooth stand-in for the bare disc (it moves with every white place over tau, not only with the widest one)
  const softBare = (100 * soft) / n;
  const atF = (p) => { const i = p % N1, j = (p - i) / N1; return [i * a1x + j * a2x, i * a1y + j * a2y]; };
  const sampleOf = (x, y) => { const I = Math.round((N1 * (x * F.E2[1] - y * F.E2[0])) / fld.det), J = Math.round((N2 * (F.E1[0] * y - F.E1[1] * x)) / fld.det); return [(((J % N2) + N2) % N2) * N1 + (((I % N1) + N1) % N1), I, J]; };
  const gap = narrowest(dark, toDark, fld, h), thin = narrowest(light, toLight, fld, h), cgap = copyGap(dark, toDark, fld, h, L);
  const [p0] = sampleOf(0, 0), dCentre = dark[p0] ? 0 : toDark.dist[p0];
  const blobs = [], seen = new Map();
  let merged = 0;
  for (let k = 0; k < K; k++) {
    const st = strokes[k], beads = strokeBeads(st), nb = beads.length / 4;
    const hb = 4 * Math.min(nb - 1, 1 + Math.round((st.th || 0) * (nb - 2)));
    const [hp, Ih, Jh] = sampleOf(beads[hb], beads[hb + 1]);
    const sw = spineShape(st);
    // where the tail ends: its distance from the frame's origin (a rotation centre of the group, when it has one)
    const extra = (st.lobes ? st.lobes.length : 0) + (st.eye ? 1 : 0), o = beads.length - 4 * (extra + 1);
    const tip = Math.hypot(beads[o], beads[o + 1]);
    const b = { found: false, share: 0, asym: 0, solid: 0, length: 0, turn: sw.turn, wiggle: sw.wiggle, bend: bendOf(st), tip };
    blobs.push(b);
    if (L.par[hp] < 0) continue;
    const root = L.find(hp), comp = L.byRoot.get(root);
    if (seen.has(comp.orbit)) { merged++; continue; }
    seen.set(comp.orbit, k);
    b.found = true;
    const hx0 = L.dx[hp], hy0 = L.dy[hp], pts = [], cells = new Set();
    let mx = 0, my = 0, fat = 0;
    for (let p = 0; p < n; p++) {
      if (L.par[p] < 0 || L.find(p) !== root) continue;
      const I = Ih + L.dx[p] - hx0, J = Jh + L.dy[p] - hy0, x = I * a1x + J * a2x, y = I * a1y + J * a2y;
      pts.push([x, y]); cells.add((I + 4096) * 8192 + (J + 4096));
      mx += x; my += y;
      fat = Math.max(fat, toLight.dist[p]);
    }
    mx /= pts.length; my /= pts.length;
    const has = (x, y) => { const I = Math.round((N1 * (x * F.E2[1] - y * F.E2[0])) / fld.det), J = Math.round((N2 * (F.E1[0] * y - F.E1[1] * x)) / fld.det); return cells.has((I + 4096) * 8192 + (J + 4096)); };
    let most = 0;
    for (let q = -1; q < 24; q++) {
      let hit = 0;
      if (q < 0) { for (const v of pts) if (has(2 * mx - v[0], 2 * my - v[1])) hit++; }
      else {
        const co = Math.cos((2 * Math.PI * q) / 24), si = Math.sin((2 * Math.PI * q) / 24);
        for (const v of pts) { const dx = v[0] - mx, dy = v[1] - my; if (has(mx + co * dx + si * dy, my + si * dx - co * dy)) hit++; }
      }
      most = Math.max(most, hit / pts.length);
    }
    let len = 0;
    for (let i = 0; i < pts.length; i += 7) for (let j = i + 7; j < pts.length; j += 7) len = Math.max(len, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
    b.asym = 1 - most; b.share = (pts.length * Math.abs(fld.det)) / (N1 * N2); b.solid = 2 * fat; b.length = len; b.at = [mx, my];
  }
  return { cover: cv, wanted: S.wanted, valid, marks: L.orbits, want: K, merged, bare: 2 * bare, solid: 2 * solid, gap, thin, cgap,
    bareAt: atF(bareAt), solidAt: atF(solidAt), cgapAt: copyGap.at, dCentre, blobs, level: c, softBare, ms: performance.now() - t0 };
}

/** One number, smaller is better (the terms of lab/measure.mjs score, per blob where they are about one blob). */
export function score2(m, W = {}) {
  const w = { bare: 1, gap: 8, gapWant: 0.1, thin: 6, thinWant: 0.05, solid: 3, solidMax: 0.66, head: 3, headWant: 0.42, head2: 2, head2Want: 0.2,
    cover: 6, marks: 2, merged: 3, asym: 3, asymWant: 0.28, ratioLo: 0.2, ratioHi: 0.55, ratio: 3, wiggle: 1.5, wiggleFree: 0.2,
    loop: 0.5, turnMax: 3.4, bareHinge: 6, bareMax: 0.42, centre: 0, centreWant: 0.12, softBare: 0, curv: 0, bendMax: 0.75, turnMax2: 9, ...W };
  let s = w.bare * m.bare;
  s += w.softBare * (m.softBare || 0);
  s += (w.cgap || 0) * Math.max(0, (w.cgapWant ?? 0.06) - (m.cgap ?? 1));                   // two copies running into each other
  s += w.gap * Math.max(0, w.gapWant - m.gap);
  s += w.thin * Math.max(0, w.thinWant - m.thin);
  s += w.solid * Math.max(0, m.solid - w.solidMax);
  s += w.cover * Math.max(0, m.wanted - m.cover);
  s += w.marks * Math.abs(m.marks - m.want);
  s += w.merged * m.merged;
  s += w.bareHinge * Math.max(0, m.bare - w.bareMax);
  s += w.centre * Math.max(0, w.centreWant - (m.dCentre ?? 1));
  const B = m.blobs || [];
  B.forEach((b, k) => {
    if (!b.found) { s += 2; return; }
    s += w.asym * Math.max(0, w.asymWant - b.asym);
    s += w.wiggle * Math.max(0, b.wiggle - w.wiggleFree);
    s += w.loop * Math.max(0, b.turn - (k === 0 ? w.turnMax : Math.min(w.turnMax, w.turnMax2)));
    s += w.curv * Math.max(0, (b.bend || 0) - w.bendMax);
    if (k === 0) s += (w.tip || 0) * Math.max(0, (w.tipWant ?? 0.5) - (b.tip ?? 9));        // the big comma's tail stays off the origin
    if (k === 0) s += (w.len || 0) * Math.max(0, b.length - (w.lenMax ?? 9));               // a compact comma, not a swoosh
    if (k === 0) s += (w.curl || 0) * Math.max(0, (w.curlWant ?? 0) - b.turn);               // a spine that curls, not a straight swoosh
    if (k === 0) s += w.head * Math.max(0, w.headWant - b.solid);
    else s += w.head2 * Math.max(0, w.head2Want - b.solid);
  });
  if (B.length > 1 && B[0].found && B[1].found && B[0].share > 0) {
    const r = B[1].share / B[0].share;
    s += w.ratio * (Math.max(0, w.ratioLo - r) + Math.max(0, r - w.ratioHi));
  }
  if (!m.valid) s += 5;
  return s;
}
