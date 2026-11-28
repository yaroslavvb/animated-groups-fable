// surface-pane.js — the Surface pane of PQRS pillows: what draws the two pillows (SPEC 1.4, 3.4).
// Seeded from the prototype of Fri 27 Nov 2026 (proto/infra3d/surface-pane.js; maps/infra3d.md says why and has its
// measurements); added since: showFrame, turn, the page's look (LOOK), `chart`.
//
// The pane is The Folding's renderer AS IT IS (standalone/the-folding/src/render3d.js: its WebGL2 passes, its
// turntable, its labels), imported, not copied. This file is the thin layer between a mesh as the embedding
// prototypes give it and what that renderer takes:
//   · the mesh comes CLOSED and MERGED, with the pillow of each TRIANGLE and (for the print) a chart point for each
//     CORNER; the renderer wants its tint and its paper point per VERTEX, constant over a triangle. setMesh splits the
//     vertices once (along the waist, along a seal, along the chart's seam) and setPositions scatters the positions
//     through that split on every frame;
//   · curves and marks can be given by VERTEX IDS, so they ride the mesh and follow a pillow that is moved apart;
//   · picking: a tap on a mark or on a curve (the renderer has none: only project());
//   · each pillow can be offset rigidly (the exploded state) without the caller touching its positions;
//   · home is the pane's own view: two quick taps on nothing, Home and 0 glide there (the renderer's own reset goes
//     to az 0 / el 55), and two quick taps that pick something leave the view alone;
//   · the wheel: it turns the view (the default) or zooms; and a wheel that is scrolling the PAGE is left to the page.
//
//   const pane = createSurfacePane(canvas, { labelLayer, view, opacity, printFront, printBack, front, back, sides, tint, tintMix, reach, wheel, fast, chart, look });
//
// THE PAGE'S TWO CALLS (the rest is what they are made of):
//   pane.showFrame(frame, { uv, orders, labels, keepChart, immediate, render })
//       frame = surface-model's sm.frame(j), whole: { version, positions, triangles, pillow, corners, curves, marks, frame }.
//       A new mesh is laid (setMesh) only when frame.version or the chart changed; else the positions alone move.
//       Curves and marks ride the mesh by their vertex ids and take the page's look (LOOK): the loop ink 1.8 px,
//       'seal0' blue 3 px, 'seal1' orange 3 px; marks of pair 0 blue and larger, of pair 1 orange and smaller, labelled
//       `P3` (the mark's id and its order: from mark.label, or opts.labels[id], or opts.orders[mark.feature]).
//       uv: the chart point of every corner (print3d's chartOf(frame.corners)); null: no print; left out: the pane's
//       own `chart` option is asked (createSurfacePane(canvas, { chart: p3.chartOf })), or, without one, the chart
//       shown last is kept while the version is the same (a page that skips a bake while dragging keeps both).
//       The camera's frame (frame.frame = { center, radius }) is taken when it changes: at once the first time, eased after.
//   pane.turn(rotation, seconds = 0.5, { inverse, shift })
//       the solid is SHOWN turned by `rotation` (3 x 3, row-major 9 numbers or three rows; about the origin) and eased
//       back to how the model has it over `seconds`; at once (no turn) under reduced motion. After a flip the model is
//       already in its new pose: hand the rotation that carries the NEW pose back onto the old one, i.e. the inverse
//       of surface-model's `turn` (old pose -> new pose), and its `shift` (new pose = turn · old pose + shift):
//           const r = sm.flip(...);   pane.turn(r.turn, 0.5, { inverse: true, shift: r.shift });
//       The first frame then shows the solid exactly where it was (shown = rotation · (x - shift)), and it turns and
//       slides to the new pose. Without `shift` the turn is about the origin alone. Everything turns: mesh, curves, marks.
//
//   pane.setMesh({ positions, triangles, pillow?, uv? })     a new topology (and its positions)
//       positions  Float32Array | Float64Array | number[] (3 n)
//       triangles  3 m vertex ids, counter-clockwise seen from OUTSIDE
//       pillow     m numbers, 0 | 1: which pillow a triangle belongs to (none: all 0)
//       uv         6 m numbers: the chart point of every corner (triangle t, corner c at 2 (3 t + c)); none: no print
//   pane.setPositions(positions)                             the same topology, new positions: every frame of a drag
//   pane.setOffsets([[x, y, z], [x, y, z]])                  added to pillow 0 / 1 and to what rides them (exploded state)
//   pane.setPrint({ size, data, range, origin, e1, e2 } | null)   a signed-distance texture of the chart cell
//       origin + s e1 + t e2 (0 <= s, t < 1), as render3d.js mode 3 takes it (it repeats in s and in t)
//   pane.setCurves([{ id, chain | points, pillow?, closed, color, width, xray, alpha, dashed, pick }])
//       chain: vertex ids (the curve rides the mesh)   |   points: Float32Array(3 k) in the world (it does not)
//   pane.setMarks([{ id, vertex | p, pillow?, label, color, labelColor, size, shape, xray, pick }])
//   pane.setFrame({ center, radius }, immediate)             what the camera keeps in view (the paper's thickness, `puff`, is a share of this radius)
//   pane.setView({ az, el, zoom })   pane.getView() -> { az, el, zoom, q }
//   pane.markAt(id) -> [x, y, front] | null   where a mark is drawn now (css px in the canvas), turn and all
//   pane.turning, pane.charted       a turn is in flight; the frame shown has a chart (showFrame)
//   pane.onPick(cb) -> off           cb({ kind: 'mark' | 'curve', id, x, y, distance, pointerType })   (x, y: css px in the canvas)
//   pane.onView(cb) -> off           the camera moved
//   pane.render()                    draw now (after the setters, once a frame)
//   pane.resize()   pane.destroy()   pane.ok   pane.R (the renderer: R.stats, R.project)
//
// In the page this file sits at standalone/pqrs-pillows/src/, so the import below is the real one.

import { createRenderer } from '../../the-folding/src/render3d.js';
import { PART_RGB, INK_RGB } from './colors.js';

const INK = INK_RGB;
/**
 * The page's look. A curve takes the colour of its PARTITION (colors.js: PQ|RS blue, PR|QS vermillion, PS|QR purple),
 * whichever card is active; a seal is drawn bold, a loop thin. The four cone points are ink dots of one size: a pair
 * is shown by the seal that joins it.
 */
export const LOOK = {
  parts: PART_RGB,
  seal: { width: 3, xray: 0.3 },
  loop: { width: 1.3, alpha: 0.75, xray: 0.1 },
  mark: { color: INK, size: 9, labelColor: '' },
};

const DEFAULTS = {
  view: { az: 70, el: 14, zoom: 1 },              // (az 0 looks along the first seal: 70 shows it across the screen; state.js DEFAULT_UI says why)
  opacity: 0.96,                                   // printed paper, not glass (The Folding's PRINT_OPACITY)
  front: [0.56, 0.80, 0.77], back: [0.93, 0.85, 0.63],
  printFront: ['#9ad5cc', '#4fa397'], printBack: ['#f5e6c6', '#d8bd85'],
  // How pillow 1 is told from pillow 0, with the renderer's shader as it is:
  //   'tint'   the same paper, mixed `tintMix` of the way toward `tint` (the renderer's "ghost" tint: print and both sides kept)
  //   'paper'  its triangles wound the other way: its OUTSIDE is drawn in the back's colours (sand), its inside in the front's
  sides: 'tint',
  tint: INK, tintMix: 0.11,                        // the second pillow slightly shaded: ink at 0.11 (as Twist of 2222's solid)
  reach: { mark: 30, curve: 16, finger: 6 },       // css px: how near a tap must be; a finger gets `finger` more
  wheel: 'turn',                                   // 'turn': a wheel without ctrl turns the view (his note of 21 Nov 2026); 'zoom': The Folding's own
  chart: null,                                     // (corners, frame) -> uv: print3d's chartOf, asked by showFrame when no uv is handed over
  // The paper's thickness: every vertex is drawn this share of the frame's radius OUTSIDE its place, along the mesh's
  // own outward normal there. Two sheets that lie exactly on each other (the flat solid of 2222 at Twist 0, a (2, 2)
  // pillow's folded rim) then stand 2 * puff apart instead of fighting for the same depth: without it the renderer
  // shows whichever sheet it drew last, the far sheet's BACK (sand) on half of the 2222 solid (seen, 27 Nov). 0: off.
  puff: 0.0015,
};

const to9 = (M) => (M && M.length === 9 ? Array.from(M, Number) : M && M.length === 3 && M[0] && M[0].length === 3 ? [...M[0], ...M[1], ...M[2]].map(Number) : null);
/** The axis and angle of a rotation matrix (row-major 9). */
function axisAngle(M) {
  const c = Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2)), angle = Math.acos(c);
  let x = M[7] - M[5], y = M[2] - M[6], z = M[3] - M[1], l = Math.hypot(x, y, z);
  if (l < 1e-6) {                                  // no turn, or a half turn: the axis from the symmetric part
    if (angle < 1) return { axis: [0, 0, 1], angle: 0 };
    x = Math.sqrt(Math.max(0, (M[0] + 1) / 2)); y = Math.sqrt(Math.max(0, (M[4] + 1) / 2)); z = Math.sqrt(Math.max(0, (M[8] + 1) / 2));
    if (x >= y && x >= z) { y = M[1] < 0 ? -y : y; z = M[2] < 0 ? -z : z; } else if (y >= z) { x = M[1] < 0 ? -x : x; z = M[5] < 0 ? -z : z; } else { x = M[2] < 0 ? -x : x; y = M[5] < 0 ? -y : y; }
    l = Math.hypot(x, y, z) || 1;
  }
  return { axis: [x / l, y / l, z / l], angle };
}
function rotationOf(axis, angle) {
  const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}

export function createSurfacePane(canvas, opts = {}) {
  const O = { ...DEFAULTS, ...opts, reach: { ...DEFAULTS.reach, ...(opts.reach || {}) } };
  const look = { ...LOOK, ...(opts.look || {}) };
  const labelLayer = O.labelLayer || null;
  const R = createRenderer(canvas, { labelLayer, fast: !!O.fast });   // fast: the renderer's knob for a GPU that cannot keep up
  R.setStyle({ front: O.front, back: O.back, printFront: O.printFront, printBack: O.printBack, opacity: O.opacity, ghost: O.tint, ghostMix: O.tintMix });
  R.setView(O.view);

  // ---- the mesh, split for the renderer ----
  let nSrc = 0, nR = 0;
  let src = new Uint32Array(0), pil = new Uint8Array(0), P = new Float32Array(0);
  let first = new Int32Array(0);                   // first[2 v + pillow] = a render vertex of source vertex v on that pillow (-1: none)
  let lastPos = null;
  const off = [[0, 0, 0], [0, 0, 0]];
  let srcTri = new Uint32Array(0), nrm = new Float32Array(0), frameR = 1;   // for the paper's thickness (puff)
  let Q = null;                                    // the turn the solid is shown with (row-major 9), or null: as the model has it
  let Qs = null;                                   // ... and the shift taken off before it (shown = Q (x - Qs)); null: none
  let hold = false;                                // showFrame: curves and marks are laid once, at its end

  function setMesh({ positions, triangles, pillow = null, uv = null }) {
    nSrc = (positions.length / 3) | 0;
    const m = (triangles.length / 3) | 0, paper = O.sides === 'paper';
    first = new Int32Array(2 * nSrc).fill(-1);
    // One render vertex for each (vertex, pillow) and, with a chart, for each chart point it has there. The render
    // vertices of one (vertex, pillow) are chained through `next` (nearly always one; two on a seal or the chart's seam).
    const srcL = [], pilL = [], uvL = [], next = [], idx = new Uint32Array(3 * m);
    for (let t = 0; t < m; t++) {
      const p = pillow ? (pillow[t] ? 1 : 0) : 0;
      for (let c = 0; c < 3; c++) {
        const v = triangles[3 * t + c], slot = 2 * v + p;
        let k = first[slot];
        if (uv) {
          const a = uv[2 * (3 * t + c)], b = uv[2 * (3 * t + c) + 1];
          while (k >= 0 && (Math.abs(uvL[2 * k] - a) > 1e-6 || Math.abs(uvL[2 * k + 1] - b) > 1e-6)) k = next[k];
          if (k < 0) { k = srcL.length; srcL.push(v); pilL.push(p); uvL.push(a, b); next.push(first[slot]); first[slot] = k; }
        } else if (k < 0) { k = srcL.length; first[slot] = k; srcL.push(v); pilL.push(p); }
        // sides 'paper': pillow 1 is wound the other way round, so the renderer shows its outside in the BACK's colours
        idx[3 * t + (paper && p === 1 && c > 0 ? 3 - c : c)] = k;
      }
    }
    nR = srcL.length;
    src = Uint32Array.from(srcL); pil = Uint8Array.from(pilL); P = new Float32Array(3 * nR);
    srcTri = Uint32Array.from(triangles); nrm = new Float32Array(3 * nSrc);
    scatter(positions);
    R.setSurface({ positions: P, indices: idx, tint: paper ? undefined : pil, uv: uv ? Float32Array.from(uvL) : undefined });
    place();
    return { vertices: nR, triangles: m, split: nR - nSrc };
  }
  /** The mesh's outward unit normal at every source vertex (triangles are counter-clockwise seen from outside), times the paper's thickness. */
  function thicken(positions) {
    const eps = O.puff > 0 ? O.puff * frameR : 0;
    if (!(eps > 0)) { if (nrm.length) nrm.fill(0); return; }
    nrm.fill(0);
    for (let t = 0; t + 2 < srcTri.length; t += 3) {
      const a = 3 * srcTri[t], b = 3 * srcTri[t + 1], c = 3 * srcTri[t + 2];
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz; nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz; nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
    }
    for (let v = 0; v + 2 < nrm.length; v += 3) {
      const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]), k = l > 1e-20 ? eps / l : 0;
      nrm[v] *= k; nrm[v + 1] *= k; nrm[v + 2] *= k;
    }
  }
  function scatter(positions) {
    lastPos = positions;
    thicken(positions);
    const o0 = off[0], o1 = off[1], m = Q;
    for (let k = 0, q = 0; k < nR; k++, q += 3) {
      const s = 3 * src[k], o = pil[k] ? o1 : o0;
      const x = positions[s] + o[0] + nrm[s], y = positions[s + 1] + o[1] + nrm[s + 1], z = positions[s + 2] + o[2] + nrm[s + 2];
      if (m) {
        const a = Qs ? x - Qs[0] : x, b = Qs ? y - Qs[1] : y, c = Qs ? z - Qs[2] : z;
        P[q] = m[0] * a + m[1] * b + m[2] * c; P[q + 1] = m[3] * a + m[4] * b + m[5] * c; P[q + 2] = m[6] * a + m[7] * b + m[8] * c;
      } else { P[q] = x; P[q + 1] = y; P[q + 2] = z; }
    }
  }
  function setPositions(positions) {
    if (!nR || positions.length < 3 * nSrc) return;
    scatter(positions);
    R.updatePositions(P);
    place();
  }
  function setOffsets(o) {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) off[i][j] = o && o[i] ? +o[i][j] || 0 : 0;
    if (lastPos && nR) { scatter(lastPos); R.updatePositions(P); place(); }
  }
  /** Where source vertex v is, as pillow p has it (p undefined: wherever it is, unshifted). */
  function vertexPoint(v, p, out, o) {
    const s = 3 * v, d = p === 0 || p === 1 ? off[p] : null;
    out[o] = lastPos[s] + (d ? d[0] : 0) + nrm[s]; out[o + 1] = lastPos[s + 1] + (d ? d[1] : 0) + nrm[s + 1]; out[o + 2] = lastPos[s + 2] + (d ? d[2] : 0) + nrm[s + 2];
    if (Q) turned(out, o);
  }
  function turned(a, o) {
    const x = Qs ? a[o] - Qs[0] : a[o], y = Qs ? a[o + 1] - Qs[1] : a[o + 1], z = Qs ? a[o + 2] - Qs[2] : a[o + 2];
    a[o] = Q[0] * x + Q[1] * y + Q[2] * z; a[o + 1] = Q[3] * x + Q[4] * y + Q[5] * z; a[o + 2] = Q[6] * x + Q[7] * y + Q[8] * z;
  }

  // ---- the print ----
  function setPrint(pr) {
    if (!pr) { R.setStyle({ print: null }); return; }
    const { e1, e2, origin } = pr, d = e1[0] * e2[1] - e1[1] * e2[0];
    R.setStyle({ print: { mode: 3, A: [e1[0], e1[1], e2[0], e2[1]], I: [e2[1] / d, -e2[0] / d, -e1[1] / d, e1[0] / d], O: [origin[0], origin[1], pr.range], tex: { size: pr.size, data: pr.data, range: pr.range } } });
  }

  // ---- curves and marks: kept as given, laid on the current positions by place() ----
  let curves = [], marks = [], laid = [], labelLooks = [];
  function setCurves(list) { curves = (list || []).filter(Boolean); place(); }
  function setMarks(list) { marks = (list || []).filter(Boolean); place(); }
  function place() {
    if (hold) return;
    if (!lastPos && (curves.some((c) => c.chain) || marks.some((k) => k.vertex != null))) return;
    const lines = [];
    laid = [];
    for (const c of curves) {
      let pts = c.points;
      if (c.chain) { pts = new Float32Array(3 * c.chain.length); for (let i = 0; i < c.chain.length; i++) vertexPoint(c.chain[i], c.pillow, pts, 3 * i); }
      else if (pts && Q) { pts = Float32Array.from(pts); for (let i = 0; i + 2 < pts.length; i += 3) turned(pts, i); }
      if (!pts || pts.length < 3) continue;
      lines.push({ points: pts, color: c.color, width: c.width == null ? 3.6 : c.width, alpha: c.alpha == null ? 1 : c.alpha, xray: c.xray == null ? 0.3 : c.xray, loop: !!c.closed, dashed: !!c.dashed });
      if (c.pick) laid.push({ kind: 'curve', id: c.id, pts, closed: !!c.closed });
    }
    const ms = [], tmp = [0, 0, 0];
    labelLooks = [];
    for (const k of marks) {
      let p = k.p;
      if (k.vertex != null) { vertexPoint(k.vertex, k.pillow, tmp, 0); p = tmp.slice(); }
      else if (p && Q) { p = [p[0], p[1], p[2]]; turned(p, 0); }
      if (!p) continue;
      ms.push({ p, color: k.color, size: k.size == null ? 10 : k.size, shape: k.shape || 'dot', label: k.label, xray: k.xray == null ? 0.45 : k.xray });
      if (k.label != null && k.label !== '') labelLooks.push(k.labelColor || '');
      if (k.pick) laid.push({ kind: 'mark', id: k.id, p });
    }
    R.setLines(lines);
    R.setMarkers(ms);
  }
  /** Where a mark is on the screen now, turn and all: [css x, css y, in front of the eye] in the canvas, or null. */
  function markAt(id) {
    const k = marks.find((m) => m.id === id);
    if (!k) return null;
    let p = k.p ? [k.p[0], k.p[1], k.p[2]] : null;
    if (k.vertex != null) { if (!lastPos) return null; p = [0, 0, 0]; vertexPoint(k.vertex, k.pillow, p, 0); } else if (p && Q) turned(p, 0);
    return p ? R.project(p) : null;
  }
  /** A label takes its mark's colour: the renderer writes them all in ink, one span a labelled mark, in the marks' order. */
  function styleLabels() {
    if (!labelLayer) return;
    const els = labelLayer.querySelectorAll('.r3d-label');
    for (let i = 0; i < els.length; i++) { const c = labelLooks[i] || ''; if (els[i].style.color !== c) els[i].style.color = c; }
  }
  function render() { R.render(); styleLabels(); }

  // ---- a frame of the surface model, whole ----
  const shown = { version: undefined, cornersVersion: undefined, uv: null, frameKey: '' };
  const sameChart = (a, b) => {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };
  function showFrame(f, o = {}) {
    if (!f || !f.positions || !f.triangles) return null;
    const same = shown.version !== undefined && shown.version === f.version;
    let uv = o.uv;
    if (uv === undefined) {
      // the pane's own chart: asked anew when the corners changed (surface-model's cornersVersion, where the frame has one)
      const still = same && f.cornersVersion !== undefined && f.cornersVersion === shown.cornersVersion;
      if (typeof O.chart === 'function' && f.corners && !((o.keepChart || still) && same)) uv = O.chart(f.corners, f);
      else uv = same ? shown.uv : null;
    }
    if (uv && uv.length !== 2 * f.triangles.length) uv = null;      // not this mesh's chart: no print rather than a wrong one
    const fresh = !same || !sameChart(uv, shown.uv);
    let info = null;
    if (f.frame && f.frame.radius > 0) frameR = f.frame.radius;      // (before the mesh is laid: the paper's thickness goes by it)
    hold = true;
    try {
      if (fresh) info = setMesh({ positions: f.positions, triangles: f.triangles, pillow: f.pillow || null, uv });
      else setPositions(f.positions);
      shown.version = f.version; shown.cornersVersion = f.cornersVersion; shown.uv = uv ? (fresh ? Float32Array.from(uv) : shown.uv) : null;
      curves = (f.curves || []).filter((c) => c && (c.chain || c.points)).map((c) => {
        const color = look.parts[c.part] || INK, st = c.id === 'loop' ? look.loop : look.seal;
        return { color, ...st, ...c };
      });
      const labels = o.labels, orders = o.orders || f.orders;
      marks = (f.marks || []).filter(Boolean).map((k) => {
        let label = k.label;
        if (label == null) label = typeof labels === 'function' ? labels(k) : labels && labels[k.id] != null ? labels[k.id] : orders && orders[k.feature] != null ? String(k.id) + orders[k.feature] : k.id;
        return { ...look.mark, ...k, label };
      });
    } finally { hold = false; }
    place();
    if (f.frame && f.frame.center) {
      const key = [f.frame.center[0], f.frame.center[1], f.frame.center[2], f.frame.radius].join(',');
      if (key !== shown.frameKey) { R.setFrame({ center: Array.from(f.frame.center), radius: f.frame.radius }, o.immediate == null ? shown.frameKey === '' : !!o.immediate); shown.frameKey = key; }
    }
    if (o.render !== false) render();
    return { fresh, ...(info || {}) };
  }

  // ---- the turn after a flip: the solid shown turned by a rotation that eases to none ----
  let turnRaf = 0;
  function relay() { if (lastPos && nR) { scatter(lastPos); R.updatePositions(P); } place(); render(); }
  function stopTurn() { if (turnRaf) { cancelAnimationFrame(turnRaf); turnRaf = 0; } }
  function turn(rotation, seconds = 0.5, o = {}) {
    stopTurn();
    const rest = () => { if (Q || Qs) { Q = null; Qs = null; relay(); } return false; };
    let M = to9(rotation);
    if (!M || M.some((x) => !Number.isFinite(x))) return rest();
    if (o.inverse) M = [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
    const sh = o.shift && o.shift.length === 3 && o.shift.every((x) => Number.isFinite(+x)) ? [+o.shift[0], +o.shift[1], +o.shift[2]] : null;
    const { axis, angle } = axisAngle(M), far = sh ? Math.hypot(sh[0], sh[1], sh[2]) : 0;
    if ((!(angle > 1e-6) && !(far > 1e-9)) || !(seconds > 0) || R.reducedMotion) return rest();   // nothing to turn, or no motion wanted: the new pose at once
    const t0 = performance.now();
    const at = (e) => { Q = rotationOf(axis, angle * (1 - e)); Qs = sh ? [sh[0] * (1 - e), sh[1] * (1 - e), sh[2] * (1 - e)] : null; };
    at(0); relay();                                // now, in this task: no frame shows the new pose unturned
    const step = (now) => {
      const u = Math.min(1, Math.max(0, (now - t0) / (1000 * seconds))), e = u * u * (3 - 2 * u);
      if (u < 1) at(e); else { Q = null; Qs = null; }
      turnRaf = u < 1 ? requestAnimationFrame(step) : 0;
      relay();
    };
    turnRaf = requestAnimationFrame(step);
    return true;
  }

  // ---- picking: the nearest mark within reach, else the nearest curve within reach (screen distance, css px) ----
  function pickAt(x, y, pointerType = 'mouse') {
    const extra = pointerType === 'mouse' ? 0 : O.reach.finger;
    let best = null, bd = O.reach.mark + extra;
    for (const it of laid) {
      if (it.kind !== 'mark') continue;
      const q = R.project(it.p), d = Math.hypot(q[0] - x, q[1] - y);
      if (d < bd) { bd = d; best = { kind: 'mark', id: it.id, distance: d }; }
    }
    if (best) return best;
    bd = O.reach.curve + extra;
    for (const it of laid) {
      if (it.kind !== 'curve') continue;
      const pts = it.pts, k = (pts.length / 3) | 0, n = it.closed ? k : k - 1;
      let a = R.project([pts[0], pts[1], pts[2]]);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % k, b = R.project([pts[3 * j], pts[3 * j + 1], pts[3 * j + 2]]);
        const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
        const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / l2)) : 0;
        const d = Math.hypot(a[0] + u * ex - x, a[1] + u * ey - y);
        if (d < bd) { bd = d; best = { kind: 'curve', id: it.id, distance: d, at: (i + u) / n }; }
        a = b;
      }
    }
    return best;
  }
  // ---- home: the pane's own view. The renderer's reset (two quick taps, Home, 0) goes to ITS default, az 0 / el 55
  // (render3d.js DEFAULT_AZ, DEFAULT_EL), which is not this pane's; so the same gestures are watched here, after the
  // renderer has had them, and the view is taken to O.view instead.
  let homeRaf = 0;
  const stopHome = () => { if (homeRaf) { cancelAnimationFrame(homeRaf); homeRaf = 0; } };
  function goHome() {
    stopHome();
    const h = O.view;
    if (R.reducedMotion) { R.setView({ az: h.az, el: h.el, zoom: h.zoom || 1 }); render(); return; }   // (the renderer has jumped to its default: jump on)
    const v0 = R.getView();
    R.setView({ az: v0.az, el: v0.el });           // stops the renderer's own glide before it has moved
    let dAz = h.az - v0.az; dAz -= 360 * Math.round(dAz / 360);
    const z0 = v0.zoom, z1 = h.zoom || 1, t0 = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - t0) / 350), e = u * u * (3 - 2 * u);
      R.setView({ az: v0.az + dAz * e, el: v0.el + (h.el - v0.el) * e, zoom: z0 * Math.pow(z1 / z0, e) });
      render();
      homeRaf = u < 1 ? requestAnimationFrame(step) : 0;
    };
    homeRaf = requestAnimationFrame(step);
  }

  const pickers = new Set();
  let down = null, pointers = 0, lastTap = null;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function onDown(e) {
    pointers++;
    stopHome();
    latched = false; until = 0;                    // a press on the pane: the wheel is the pane's again
    if (e.pointerType === 'mouse' && e.button !== 0) { down = null; return; }
    // (the renderer's own pointerdown has stopped every glide and coast: the view stands still for the length of a tap)
    down = pointers === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, view: R.getView() } : null;   // a second finger: no tap
    if (pointers > 1) lastTap = null;
  }
  function onMove(e) {
    if (down && down.id === e.pointerId) { if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > (e.pointerType === 'mouse' ? 4 : 10)) down.moved = true; return; }
    if (e.pointerType === 'mouse' && !e.buttons) { const [x, y] = local(e); canvas.style.cursor = pickAt(x, y, 'mouse') ? 'pointer' : 'grab'; }
  }
  function onUp(e) {
    pointers = Math.max(0, pointers - 1);
    const d = down;
    if (!d || d.id !== e.pointerId) return;
    down = null;
    const now = performance.now();
    if (e.type !== 'pointerup' || d.moved || now - d.t > 600) { lastTap = null; return; }
    // the renderer's own rule for "two quick taps" (render3d.js onPointerUp): each tap under 320 ms, the second
    // within 380 ms and 36 px of the first
    const quick = now - d.t < 320, second = quick && lastTap && now - lastTap.t < 380 && Math.hypot(d.x - lastTap.x, d.y - lastTap.y) < 36;
    lastTap = quick && !second ? { t: now, x: d.x, y: d.y } : null;
    // On a second quick tap the renderer has just begun its reset: a glide that has not moved yet, or, with reduced
    // motion, a JUMP to its default view that is already made. Either way the view goes back to what it was when the
    // finger came down, BEFORE anything is picked (the pick projects through the camera), and no frame shows the jump.
    if (second) R.setView({ az: d.view.az, el: d.view.el, zoom: d.view.zoom });
    const [x, y] = local(e), hit = pickAt(x, y, e.pointerType);
    if (hit) {                                     // a tap that picked something is not half of a reset
      if (second) render();
      for (const cb of pickers) { try { cb({ ...hit, x, y, pointerType: e.pointerType }); } catch (err) { console.error(err); } }
    } else if (second) goHome();
  }
  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Home' || e.key === '0') goHome();
  }
  // ---- the wheel. The Folding's renderer reads every wheel event as zoom, so a trackpad's two-finger swipe zooms and
  // never turns: what he reported on the Classification of Surfaces page on Sat 21 Nov 2026, where turning.js then
  // made any wheel without ctrl TURN the view (and so it is on Two features, two handles and Twist of 2222). With
  // wheel: 'turn' the same rule is laid over the renderer here: on the way down (capture, on the canvas's parent), so
  // the renderer never sees a turning wheel; a pinch (ctrl + wheel in Chrome and Firefox, Safari's gesture events)
  // still zooms. wheel: 'zoom' leaves the renderer's own wheel (The Folding's: every wheel zooms).
  //
  // In BOTH modes a wheel that began as a scroll of the PAGE goes on scrolling the page when the pane slides under the
  // pointer, and never reaches the renderer: the latch of turning.js as it is since Fri 27 Nov 2026 14:12 (commit
  // 4b7093bb, "Fix Debug scroll hijacking"): a scroll of the window, or a wheel anywhere but on the canvas, latches;
  // while latched a wheel on the canvas is left to the page; the latch lets go once 450 ms have passed AND the pointer
  // has moved more than 6 px on the canvas, or at a pointerdown on it. The Folding's own page does not scroll, so its
  // renderer has no such guard: left alone on a page that scrolls it zooms while the page scrolls (measured).
  const host = canvas.parentElement, HOLD = 450;
  let latched = false, until = 0, lastX = NaN, lastY = NaN, scrollX = NaN, scrollY = NaN;
  const markScroll = () => { latched = true; until = performance.now() + HOLD; scrollX = lastX; scrollY = lastY; };
  const onDocWheel = (e) => { if (e.target !== canvas) markScroll(); };
  const onDocMove = (e) => {
    const moved = !Number.isFinite(scrollX) || Math.hypot(e.clientX - scrollX, e.clientY - scrollY) > 6;
    lastX = e.clientX; lastY = e.clientY;
    if (latched && moved && performance.now() > until && e.target === canvas) latched = false;
  };
  function onWheel(e) {
    if (e.target !== canvas || e.ctrlKey) return;
    // A wheel that cannot be cancelled has ALREADY scrolled the page (the browser scrolled first, the pane slid under
    // the pointer, and only then was the event handed to what lies there now): it is the page's, whatever the latch
    // says, and it is kept from the renderer, which would zoom on it. (Seen in Chrome with a wheel on the heading.)
    if (!e.cancelable) { markScroll(); e.stopPropagation(); return; }
    if (latched) { until = performance.now() + HOLD; e.stopPropagation(); return; }
    if (O.wheel !== 'turn') return;                // 'zoom': on to the renderer, which zooms
    e.preventDefault(); e.stopPropagation();
    let dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 30; dy *= 30; } else if (e.deltaMode === 2) { dx *= 300; dy *= 300; }
    dx = Math.max(-240, Math.min(240, dx)); dy = Math.max(-240, Math.min(240, dy));
    if ((!dx && !dy) || down) return;              // (a button is down as well: the drag has the view)
    stopHome();
    const b = canvas.getBoundingClientRect(), v = R.getView();
    const k = (Math.min(0.011, Math.max(0.0045, Math.PI / (0.85 * Math.max(1, Math.min(b.width, b.height))))) * 180) / Math.PI;   // degrees per px: the renderer's own drag
    R.setView({ az: v.az + dx * k, el: Math.max(-90, Math.min(90, v.el - dy * k)) });
    render();
  }
  const turning = !!host;                          // (the guard against a hijacked page scroll is on in both modes)
  if (turning) {
    host.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.addEventListener('scroll', markScroll, { passive: true });
    document.addEventListener('wheel', onDocWheel, { capture: true, passive: true });
    document.addEventListener('pointermove', onDocMove, { capture: true, passive: true });
  }

  // (after createRenderer, so the renderer's own listeners on the canvas have run when these do)
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('keydown', onKey);

  function destroy() {
    stopHome(); stopTurn();
    if (turning) {
      host.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('scroll', markScroll);
      document.removeEventListener('wheel', onDocWheel, { capture: true });
      document.removeEventListener('pointermove', onDocMove, { capture: true });
    }
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('keydown', onKey);
    pickers.clear();
    R.dispose();
  }

  return {
    ok: R.ok, R,
    setMesh, setPositions, setOffsets, setPrint, setCurves, setMarks, render,
    showFrame, turn, markAt,
    get turning() { return !!turnRaf; },
    get charted() { return !!shown.uv; },          // a chart is laid (the print can show)
    setFrame: (f, immediate) => { if (f && f.radius > 0) frameR = f.radius; return R.setFrame(f, immediate); },
    setView: (v) => R.setView(v),
    getView: () => R.getView(),
    resetView: goHome,
    onPick(cb) { pickers.add(cb); return () => pickers.delete(cb); },
    onView: (cb) => R.onChange(cb),
    pickAt,
    resize: () => R.resize(),
    destroy,
  };
}
