// src/patterns/comma.js — the Comma as a PRINT (14 Nov 2026, the pattern round). The owner's page comment 88289462 of
// 13 Nov 2026: "I want to reuse the two different shades from "checkerboard" pattern for all patterns". Until then the
// selector's Comma was the picture from before the prints, one comma per tile on a translucent sheet; now it is printed
// like every other pattern of the selector: the orbit of the page's own comma (src/motif.js motifFor: one big comma per
// tile, placed by the table groupdata/motif.js) on the checkerboard's two-sided paper, front teal and back sand, two
// tones each (src/shapes.js, src/pattern.js).
//
// The print's copy of the outline is the comma of motif.js — the same unit comma (commaOutline, sampled the same way),
// the same centre, turn and scale — but for the end of its tail. The unit comma's tail is a horn between the unit
// circle (its back) and the hollow's circle, which touch at its tip: the last 26 to 57 texels of its outline are
// thinner than the 3D view's distance texture holds (src/shapes.js thinParts at 1.5 texels; a texel is 1/1024 of the
// texture's cell), so the 3D view cut the tip short or broke it into specks while the plane drew it whole. Here the
// tail is at least w = TIP_TEXELS texels thick to its end, and round there:
//   * a point of the hollow lies t(f) = 1 - |H(f)| inside the unit circle (the tail is that thick there); it is moved
//     toward the comma's centre until it lies T(f) = (t^4 + w^4)^(1/4) inside it: T = w at the tip, T = t (to a part in
//     ten thousand) where the tail is 3 w thick or more;
//   * a half circle of diameter w closes the tail, from the tip (0, 1) round to (0, 1 - w).
// Nothing moves by more than w: 0.003 to 0.007 tile sizes, a fraction of a pixel in the plane. The copies keep FILL_GAP
// (0.07 tile sizes) apart less that. Under no print (the sheet: src/pattern.js SHEET_PATTERN) the plane and the sheet
// draw the comma of motif.js itself, as before.
//
//   meta                          { key: 'comma', label: 'Comma', hint }
//   find(group)                   -> { shapes: [{ pts }], info: { at, radius, angle, scale, tip, source, from? } }
//   bluntComma(w, outline?)       -> [[x, y], ...]: the unit comma with its tail kept w thick (w in units of its radius)
//   TIP_TEXELS                    2 (TEXELS_APART: what the texture keeps between two copies, it keeps across the tail)
//
// motif.js places the comma from a table of the page's 17 groups (where in the default tile, how large, which way), so
// it has no place for any other group: a turned, scaled, shifted or mirrored COPY of a page group (the same id, its
// lattice and centre carried by a similarity) gets that group's comma carried along with it (info.from: the page's group;
// the review of 15 Nov 2026: motifFor threw for a copy without presets, and shrank the comma of one that kept them).
// Any other group is motif.js's to place, as before (it throws for one without presets: printFor then shows the sheet).

import { motifFor, DRAWN_OUTLINE } from '../motif.js';
import { texelPitch } from '../shapes.js';
import { BY_ID } from '../groups.js';

export const meta = { key: 'comma', label: 'Comma', hint: 'one big comma per tile, on the paper: front teal, back sand' };

/** The tail of the print's comma is at least this many texels of the 3D texture thick, to its round end. */
export const TIP_TEXELS = 2;
/** Points on the half circle that closes the tail (its two ends included: the tip, and where the hollow starts). */
const CAP_POINTS = 8;

/**
 * The unit comma of src/motif.js commaOutline — a closed, counter-clockwise outline in the unit disc: its back the right
 * half of the unit circle, from the bottom (0, -1) up to the tip (0, 1); the hollow, the right half of the circle of
 * radius 1 - head round (0, head); the head, the left half of the circle of radius head round (0, head - 1) — with its
 * tail kept at least `w` thick (in units of the comma's radius) and closed by a half circle of diameter w (see the top
 * of the file). Sampled as commaOutline samples it (`outline`: head, nBack, nHollow, nHead), with CAP_POINTS - 1 more
 * points on the half circle. [[x, y], ...], no repeated last point. w = 0 gives commaOutline's own points.
 */
export function bluntComma(w, { head = DRAWN_OUTLINE.head, nBack = DRAWN_OUTLINE.nBack, nHollow = DRAWN_OUTLINE.nHollow, nHead = DRAWN_OUTLINE.nHead } = {}) {
  if (!(w >= 0) || !(w < 0.5)) throw new RangeError(`bluntComma: the tail's width is 0 or more and under half the comma's radius (got ${w})`);
  const a = 1 - head, b = head, pts = [];
  // the back: the right half of the unit circle, from the bottom up to (but without) the tip
  for (let i = 0; i < nBack; i++) { const f = -Math.PI / 2 + (Math.PI * i) / nBack; pts.push([Math.cos(f), Math.sin(f)]); }
  // the round end: from the tip (0, 1) to the left and round to (0, 1 - w), where the hollow starts (that point is the
  // hollow's first)
  if (w > 0) for (let k = 0; k < CAP_POINTS - 1; k++) { const th = Math.PI / 2 + (Math.PI * k) / (CAP_POINTS - 1); pts.push([(w / 2) * Math.cos(th), 1 - w / 2 + (w / 2) * Math.sin(th)]); }
  // the hollow, from the tip down to (0, 1 - 2a): each point moved toward the centre until it lies T(f) inside the circle
  for (let i = 0; i < nHollow; i++) {
    const f = (Math.PI * i) / nHollow, x = a * Math.sin(f), y = 1 - a + a * Math.cos(f), r = Math.hypot(x, y);
    const t = 1 - r, T = w > 0 ? Math.pow(t ** 4 + w ** 4, 0.25) : t;
    pts.push(r > 0 ? [(x / r) * (1 - T), (y / r) * (1 - T)] : [x, y]);
  }
  // the head: the left half of its circle, from (0, 2b - 1) down to the bottom
  for (let i = 0; i < nHead; i++) { const f = (Math.PI * i) / nHead; pts.push([-b * Math.sin(f), -1 + b + b * Math.cos(f)]); }
  return pts;
}

/**
 * The page's group of which `group` is a copy carried by a similarity x -> M x + v (turned, scaled, shifted, perhaps
 * mirrored): { base, M: [a, b, c, d] (rows), v }, or null — `group` is a page group itself, its id is none of theirs, or
 * its lattice is not the page group's carried by a similarity. M comes from the lattices ([e1 e2] = M [e1' e2']), v
 * from the centres.
 */
export function pageCopy(group) {
  const base = group && BY_ID[group.id];
  if (!base || base === group || !group.e1 || !group.e2 || !group.center) return null;
  const B = [base.e1[0], base.e2[0], base.e1[1], base.e2[1]], dB = B[0] * B[3] - B[1] * B[2];
  const G = [group.e1[0], group.e2[0], group.e1[1], group.e2[1]];
  const Bi = [B[3] / dB, -B[1] / dB, -B[2] / dB, B[0] / dB];
  const M = [G[0] * Bi[0] + G[1] * Bi[2], G[0] * Bi[1] + G[1] * Bi[3], G[2] * Bi[0] + G[3] * Bi[2], G[2] * Bi[1] + G[3] * Bi[3]];
  // a similarity: its columns of one length, at right angles
  const c1 = Math.hypot(M[0], M[2]), c2 = Math.hypot(M[1], M[3]);
  if (!(c1 > 0) || Math.abs(c1 - c2) > 1e-9 * c1 || Math.abs(M[0] * M[1] + M[2] * M[3]) > 1e-9 * c1 * c1) return null;
  const v = [group.center[0] - M[0] * base.center[0] - M[1] * base.center[1], group.center[1] - M[2] * base.center[0] - M[3] * base.center[1]];
  return { base, M, v };
}

/**
 * The motif of the Comma print of a group: motifFor(group)'s comma (its centre, turn and scale [across, along]) drawn
 * from bluntComma with w = TIP_TEXELS texels of the print's texture (texelPitch of the group's lattice), counted against
 * the smaller of the two scales; for a copy of a page group (pageCopy), that group's comma carried along. The same group
 * gives the same motif (motifFor is cached per group).
 */
export function find(group) {
  const copy = pageCopy(group);
  if (copy) {
    const { base, M, v } = copy, r = find(base), I = r.info, s = Math.hypot(M[0], M[2]);
    const map = (p) => [M[0] * p[0] + M[1] * p[1] + v[0], M[2] * p[0] + M[3] * p[1] + v[1]];
    return {
      shapes: r.shapes.map((sh) => ({ ...sh, pts: sh.pts.map(map) })),
      info: { at: map(I.at), radius: s * I.radius, angle: Math.atan2(M[2] * Math.cos(I.angle) + M[3] * Math.sin(I.angle), M[0] * Math.cos(I.angle) + M[1] * Math.sin(I.angle)), scale: [s * I.scale[0], s * I.scale[1]], tip: s * I.tip, source: I.source, from: base.id },
    };
  }
  const m = motifFor(group), sx = m.scale[0], sy = m.scale[1], s = Math.min(sx, sy);
  const tip = TIP_TEXELS * texelPitch(group), w = tip / s;
  const ca = Math.cos(m.angle), sa = Math.sin(m.angle), ax = m.at[0], ay = m.at[1];
  const pts = bluntComma(w).map(([x, y]) => { const X = sx * x, Y = sy * y; return [ax + ca * X - sa * Y, ay + sa * X + ca * Y]; });
  return { shapes: [{ pts }], info: { at: [ax, ay], radius: m.radius, angle: m.angle, scale: [sx, sy], tip, source: m.info && m.info.source } };
}
