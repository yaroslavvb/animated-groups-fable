// draw.js — the edges round a rim: coloured arcs with arrowheads, placed by FRACTIONS of a turn so that they can
// slide smoothly round a rim whose mesh has only n samples.
//
// A ring is a function sample -> vertex index of the scene (n samples, closed). A fraction f (in turns, any real)
// names the point f * n samples along it, between two samples if need be.

import { sub, scale, norm, dot, addScaled, len } from '../geo/vec.js';

const mod = (a, n) => ((a % n) + n) % n;

export function fracPoint(scene, ring, n, f) {
  const x = mod(f, 1) * n, j = Math.floor(x), w = x - j;
  const a = scene.point(ring(j % n));
  if (w < 1e-6) return a;
  const b = scene.point(ring((j + 1) % n));
  return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
}

/** The polyline along the ring from fraction f0 to f1 (f1 > f0, less than a turn apart... a full turn is fine). */
export function arcPoints(scene, ring, n, f0, f1) {
  const pts = [...fracPoint(scene, ring, n, f0)];
  const j0 = Math.floor(f0 * n + 1e-9) + 1, j1 = Math.ceil(f1 * n - 1e-9) - 1;
  for (let j = j0; j <= j1; j++) { const p = scene.point(ring(mod(j, n))); pts.push(p[0], p[1], p[2]); }
  pts.push(...fracPoint(scene, ring, n, f1));
  return Float32Array.from(pts);
}

/** The middle of the ring's samples (the "inside" an arrowhead's barbs are measured from). */
export function ringCentre(scene, ring, n) {
  const c = [0, 0, 0];
  for (let j = 0; j < n; j++) { const q = scene.point(ring(j)); c[0] += q[0] / n; c[1] += q[1] / n; c[2] += q[2] / n; }
  return c;
}

/** An arrowhead at fraction f pointing along the ring (sense +1: toward larger fractions). Null where there is no room. */
export function arrowAt(scene, ring, n, f, sense, size, centre) {
  const p = fracPoint(scene, ring, n, f), a = fracPoint(scene, ring, n, f - 0.6 / n), b = fracPoint(scene, ring, n, f + 0.6 / n);
  let t = sub(b, a);
  if (len(t) < 1e-7) return null;
  t = scale(norm(t), sense);
  let side = sub(p, centre || ringCentre(scene, ring, n));
  side = sub(side, scale(t, dot(side, t)));
  if (len(side) < 1e-6) return null;
  side = norm(side);
  const tip = addScaled(p, t, 0.55 * size), back = addScaled(p, t, -0.45 * size);
  return Float32Array.from([...addScaled(back, side, 0.5 * size), ...tip, ...addScaled(back, side, -0.5 * size)]);
}

/**
 * Lines for a word laid round a ring.
 *   edges   [{ id, s, f0, f1, color }]: s = +1 the arrow runs toward larger fractions, -1 the other way, 0 a free edge
 *   opts    { width, size, alpha(), hot() -> id | null }: the hot zip is drawn bolder
 */
export function wordLines(scene, ring, n, edges, { width = 2.6, size = 0.1, alpha = null, hot = null, arrows = null } = {}) {
  const out = [], a = alpha ? alpha() : 1;
  if (a <= 0.01) return out;
  const centre = ringCentre(scene, ring, n), h = hot ? hot() : null, aa = arrows ? arrows() : 1;
  for (const e of edges) {
    if (!(e.f1 - e.f0 > 1e-4)) continue;
    const isHot = h !== null && e.id === h;
    const w = e.s ? (isHot ? width + 2.2 : width) : width - 0.6;
    out.push({ points: arcPoints(scene, ring, n, e.f0, e.f1), color: e.color, width: w, alpha: a, xray: 0.4 });
    if (e.s && aa > 0.01) {
      const span = (e.f1 - e.f0) * n;                       // in samples: a short arc gets a smaller arrowhead
      const ch = arrowAt(scene, ring, n, (e.f0 + e.f1) / 2, e.s, Math.min(size, 0.02 + 0.028 * span) * (isHot ? 1.25 : 1), centre);
      if (ch) out.push({ points: ch, color: e.color, width: w + 0.4, alpha: a * aa, xray: 0.4 });
    }
  }
  return out;
}

/** A word laid evenly: edge k on [phase + k / m, phase + (k + 1) / m]. */
export function evenly(word, phase = 0) {
  const m = word.length;
  return word.map((e, k) => [phase + k / m, phase + (k + 1) / m]);
}
