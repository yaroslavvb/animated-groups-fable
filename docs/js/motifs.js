/* Motif prototypes: candidate shapes and candidate phase channels, side by
 * side, each one running inside a real spacetime group and each one measured.
 *
 * A motif on this site has to do two jobs at once, and they pull apart:
 *
 *   ORIENTATION.  A rotated copy must look rotated and a reflected copy must
 *   look reflected, so the shape needs no symmetry of its own — chiral, and
 *   chiral in a way that survives a 30-pixel thumbnail.
 *
 *   PHASE.  A copy's internal time must be readable from a FROZEN frame, so
 *   the phase channel has to be injective on [0,1): no two instants of the
 *   loop may draw the same picture. It must also be continuous through t = 0,
 *   or the loop shows a seam, and it must not be a rotation — a turning marker
 *   inside a pattern with rotational symmetry aliases against the pattern and
 *   becomes unreadable, which is why the site's first motif was thrown away.
 *
 * Every candidate below is a (shape, channel) pair, and the two axes are
 * separable: any shape can carry any channel. The measurements under each
 * card are computed here, from the pixels, not asserted:
 *
 *   handedness   how far the motif is from its own mirror image
 *   rotation     the WORST similarity to itself turned by 60/90/120/180° —
 *                low is good, high means it will alias against a gyration
 *   phase        the smallest difference between any two distinct instants —
 *                zero means a frozen frame cannot tell them apart
 *   seam         the jump across t = 0 — near zero is good
 *
 * All four are normalised so 0 is "identical" and 1 is "no overlap at all".
 */
"use strict";
import { Playback } from "./playback.js?v=43";
import { attachStage } from "./stage.js?v=43";
import { attachControls } from "./controls.js?v=43";
import { filmTimeSymmetry } from "./phases.js?v=43";
import { orbitPlacements } from "./orbit.js?v=43";
import { leadHtml } from "./catalog-names.js?v=43";

const INK = "#1f2430";
const GROUND = "#faf9f6";
const BLUE = "#2f6fae";
const PALE = "#cfe0ef";
const TWO_PI = Math.PI * 2;

/* ------------------------------------------------------------------ shapes */
/* Each shape is closed sub-polylines in a local frame, y DOWN, normalised to
 * circumradius 0.64 so every candidate occupies the same budget and the cards
 * are honestly comparable. Sub-path 2 onward are holes (drawn even-odd). */

function normalise(subs, R = 0.64) {
  const all = subs.flat();
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const k = R / Math.max(...all.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  const out = subs.map(s => s.map(p => [(p[0] - cx) * k, (p[1] - cy) * k]));
  const fy = out.flat().map(p => p[1]);
  const fx = out.flat().map(p => p[0]);
  return { subs: out, top: Math.min(...fy), bot: Math.max(...fy),
           left: Math.min(...fx), right: Math.max(...fx) };
}

/* sample a cubic bezier chain into a polyline, for shapes drawn as curves */
function bez(chain, n = 18) {
  const pts = [];
  for (const [p0, p1, p2, p3] of chain) {
    for (let i = 0; i < n; i++) {
      const t = i / n, m = 1 - t;
      pts.push([
        m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t ** 3 * p3[0],
        m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t ** 3 * p3[1],
      ]);
    }
  }
  return pts;
}

/* the incumbent: the site's comma, same control points as renderer.js */
const COMMA = normalise([bez([
  [[0.40, -0.30], [0.52, 0.18], [0.32, 0.56], [-0.52, 0.74]],
  [[-0.52, 0.74], [-0.10, 0.52], [0.18, 0.26], [0.06, 0.02]],
  [[0.06, 0.02], [-0.14, 0.02], [-0.40, -0.10], [-0.40, -0.30]],
  [[-0.40, -0.30], [-0.40, -0.54], [-0.22, -0.68], [0.00, -0.68]],
  [[0.00, -0.68], [0.24, -0.68], [0.40, -0.54], [0.40, -0.30]],
])]);

/* A blocky R. The letter is the classic asymmetric test glyph — it has no
 * symmetry at all, and unlike a comma its mirror image is a shape a reader
 * already knows is wrong, which is the whole point of a handedness marker. */
const R_OUTER = [
  [-0.46, -0.70], [0.14, -0.70], [0.34, -0.60], [0.42, -0.40], [0.42, -0.22],
  [0.34, -0.04], [0.18, 0.04], [0.48, 0.70], [0.14, 0.70], [-0.10, 0.10],
  [-0.16, 0.10], [-0.16, 0.70], [-0.46, 0.70],
];
const R_HOLE = [
  [-0.16, -0.44], [0.08, -0.44], [0.16, -0.38], [0.16, -0.28],
  [0.08, -0.22], [-0.16, -0.22],
];
const R = normalise([R_OUTER, R_HOLE]);

/* a flag: pole down the left, banner streaming right */
const FLAG = normalise([[
  [-0.44, -0.72], [-0.30, -0.72], [-0.30, -0.30], [0.46, -0.52], [0.46, 0.02],
  [-0.30, 0.24], [-0.30, 0.74], [-0.44, 0.74],
]]);

/* a scalene triangle with one corner cut: three unequal sides and a bevel, so
 * no reflection and no rotation can fix it */
const TRI = normalise([[
  [-0.62, 0.44], [0.10, -0.66], [0.30, -0.52], [0.62, 0.20], [0.34, 0.44],
]]);

/* an L-tromino with a bitten corner — the polyomino reading of handedness */
const ELL = normalise([[
  [-0.40, -0.68], [0.02, -0.68], [0.02, 0.20], [0.44, 0.20], [0.44, 0.52],
  [0.20, 0.68], [-0.40, 0.68],
]]);

/* a spiral arm, thickening outward */
const SPIRAL = normalise([(() => {
  const outer = [], inner = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, a = -1.9 + u * 4.4, rr = 0.12 + u * 0.62;
    const w = 0.045 + u * 0.10;
    outer.push([Math.cos(a) * (rr + w), Math.sin(a) * (rr + w)]);
    inner.push([Math.cos(a) * (rr - w), Math.sin(a) * (rr - w)]);
  }
  return outer.concat(inner.reverse());
})()]);

const DISC = normalise([(() => {
  const p = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TWO_PI;
    p.push([Math.cos(a) * 0.64, Math.sin(a) * 0.64]);
  }
  return p;
})()]);

/* ------------------------------------------------------------ path drawing */
function tracePath(ctx, shape, r, k = 1) {
  ctx.beginPath();
  for (const sub of shape.subs) {
    ctx.moveTo(sub[0][0] * r * k, sub[0][1] * r * k);
    for (let i = 1; i < sub.length; i++) ctx.lineTo(sub[i][0] * r * k, sub[i][1] * r * k);
    ctx.closePath();
  }
}

/* cumulative arc length of the OUTER sub-path, for the channels that send a
 * marker travelling round the boundary */
function outline(shape) {
  const p = shape.subs[0];
  const cum = [0];
  for (let i = 1; i <= p.length; i++) {
    const a = p[i - 1], b = p[i % p.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { p, cum, total: cum[cum.length - 1] };
}

function alongOutline(o, u) {
  const d = ((u % 1) + 1) % 1 * o.total;
  let i = 1;
  while (i < o.cum.length && o.cum[i] < d) i++;
  const a = o.p[i - 1], b = o.p[i % o.p.length];
  const f = (d - o.cum[i - 1]) / Math.max(o.cum[i] - o.cum[i - 1], 1e-9);
  return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
}

/* -------------------------------------------------------------- channels */
/* Each channel paints `shape` at phase ph. They share one contract: the
 * painted picture must vary continuously with ph, agree at ph = 0 and ph = 1,
 * and — where it can — differ at every pair of distinct ph. */

/* the site's incumbent: a sweep line crosses the shape base to brim once in
 * each half period, always travelling the same way; the colour is behind it
 * going up and ahead of it coming back */
function chWipe(ctx, shape, r, ph) {
  tracePath(ctx, shape, r);
  ctx.fillStyle = GROUND; ctx.fill("evenodd");
  ctx.save();
  ctx.clip("evenodd");
  const rising = ph < 0.5, p = (ph * 2) % 1;
  const yLine = (shape.bot - p * (shape.bot - shape.top)) * r;
  ctx.fillStyle = BLUE;
  if (rising) ctx.fillRect(-2 * r, yLine, 4 * r, shape.bot * r - yLine + 2);
  else ctx.fillRect(-2 * r, shape.top * r - 2, 4 * r, yLine - shape.top * r + 2);
  ctx.restore();
  outlineStroke(ctx, shape, r);
}

/* size alone: grows over the first half, shrinks back over the second */
function chScale(ctx, shape, r, ph) {
  const k = 0.42 + 0.58 * (ph < 0.5 ? ph * 2 : 2 - ph * 2);
  tracePath(ctx, shape, r, k);
  ctx.fillStyle = BLUE; ctx.fill("evenodd");
  ctx.lineWidth = Math.max(1, r * 0.055); ctx.strokeStyle = INK;
  ctx.stroke();
}

/* size AND wipe: the pair that makes growing legible. Size says how far from
 * the half-period you are, the wipe says which side of it */
function chScaleWipe(ctx, shape, r, ph) {
  const k = 0.46 + 0.54 * (ph < 0.5 ? ph * 2 : 2 - ph * 2);
  tracePath(ctx, shape, r, k);
  ctx.fillStyle = GROUND; ctx.fill("evenodd");
  ctx.save(); ctx.clip("evenodd");
  ctx.fillStyle = BLUE;
  const rising = ph < 0.5, u = (ph * 2) % 1;
  const yLine = (shape.bot - u * (shape.bot - shape.top)) * r * k;
  if (rising) ctx.fillRect(-2 * r, yLine, 4 * r, shape.bot * r * k - yLine + 2);
  else ctx.fillRect(-2 * r, shape.top * r * k - 2, 4 * r,
                    yLine - shape.top * r * k + 2);
  ctx.restore();
  tracePath(ctx, shape, r, k);
  ctx.lineWidth = Math.max(1, r * 0.055); ctx.strokeStyle = INK; ctx.stroke();
}

/* the pen draws the outline, then rubs it out in the same direction */
function chStroke(ctx, shape, r, ph) {
  tracePath(ctx, shape, r);
  ctx.fillStyle = PALE; ctx.fill("evenodd");
  const o = outline(shape);
  const drawn = ph < 0.5 ? ph * 2 : 1;
  const gone = ph < 0.5 ? 0 : (ph - 0.5) * 2;
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.strokeStyle = BLUE;
  ctx.lineCap = "round";
  ctx.beginPath();
  const n = 96;
  let started = false;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    if (u < gone || u > drawn) { started = false; continue; }
    const q = alongOutline(o, u);
    if (!started) { ctx.moveTo(q[0] * r, q[1] * r); started = true; }
    else ctx.lineTo(q[0] * r, q[1] * r);
  }
  ctx.stroke();
  outlineStroke(ctx, shape, r, 0.045);
}

/* a bead runs once round the boundary — the shape itself never moves, so
 * nothing here can be mistaken for the pattern turning */
function chBead(ctx, shape, r, ph) {
  tracePath(ctx, shape, r);
  ctx.fillStyle = PALE; ctx.fill("evenodd");
  outlineStroke(ctx, shape, r);
  const q = alongOutline(outline(shape), ph);
  ctx.beginPath();
  ctx.arc(q[0] * r, q[1] * r, Math.max(1.6, r * 0.15), 0, TWO_PI);
  ctx.fillStyle = BLUE; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.04); ctx.strokeStyle = INK; ctx.stroke();
}

/* the fill grows from the centre, then is eaten away from the centre — the
 * channel the billiards use, where the motif has to stay a disc */
function chRadial(ctx, shape, r, ph) {
  tracePath(ctx, shape, r);
  ctx.fillStyle = GROUND; ctx.fill("evenodd");
  ctx.save(); ctx.clip("evenodd");
  if (ph < 0.5) {
    ctx.beginPath(); ctx.arc(0, 0, r * 1.3 * ph * 2, 0, TWO_PI);
    ctx.fillStyle = BLUE; ctx.fill();
  } else {
    ctx.fillStyle = BLUE; ctx.fillRect(-2 * r, -2 * r, 4 * r, 4 * r);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.3 * (ph * 2 - 1), 0, TWO_PI);
    ctx.fillStyle = GROUND; ctx.fill();
  }
  ctx.restore();
  outlineStroke(ctx, shape, r);
}

/* the shape unfurls along its own long axis: a wedge of it is revealed from
 * one end, then swallowed from the same end */
function chUnfurl(ctx, shape, r, ph) {
  tracePath(ctx, shape, r);
  ctx.fillStyle = GROUND; ctx.fill("evenodd");
  ctx.save(); ctx.clip("evenodd");
  const x0 = shape.left * r, x1 = shape.right * r;
  const rising = ph < 0.5, u = (ph * 2) % 1;
  const xLine = x0 + (x1 - x0) * u;
  ctx.fillStyle = BLUE;
  if (rising) ctx.fillRect(x0 - 2, -2 * r, xLine - x0 + 2, 4 * r);
  else ctx.fillRect(xLine, -2 * r, x1 - xLine + 2, 4 * r);
  ctx.restore();
  outlineStroke(ctx, shape, r);
}

/* an arm that extends and retracts along the boundary — length is the clock */
function chExtend(ctx, shape, r, ph) {
  tracePath(ctx, shape, r);
  ctx.fillStyle = GROUND; ctx.fill("evenodd");
  outlineStroke(ctx, shape, r);
  const o = outline(shape);
  const len = ph < 0.5 ? ph * 2 : 2 - ph * 2;
  ctx.beginPath();
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const q = alongOutline(o, (i / n) * len);
    if (i) ctx.lineTo(q[0] * r, q[1] * r); else ctx.moveTo(q[0] * r, q[1] * r);
  }
  ctx.lineWidth = Math.max(1.6, r * 0.13);
  ctx.strokeStyle = ph < 0.5 ? BLUE : "#c0392b";
  ctx.lineCap = "round";
  ctx.stroke();
}

function outlineStroke(ctx, shape, r, w = 0.055) {
  tracePath(ctx, shape, r);
  ctx.lineWidth = Math.max(1, r * w);
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/* ------------------------------------------------------------- candidates */
export const MOTIFS = [
  { id: "comma-wipe", name: "Comma · one-way wipe", shape: COMMA, ch: chWipe,
    note: "The motif the site ships. Chiral by its curled tail, and the sweep " +
          "is locked to the comma's own axis, so orientation and phase read " +
          "as separate channels." },
  { id: "R-scale", name: "R · growing and shrinking", shape: R, ch: chScale,
    note: "The letter grows to full size at the half period and shrinks back. " +
          "Size is the most legible channel there is at thumbnail scale — but " +
          "it is a there-and-back, so it cannot be injective on its own." },
  { id: "R-scalewipe", name: "R · grow with a wipe", shape: R, ch: chScaleWipe,
    note: "The same growth, with a one-way fill riding on it. Size says how " +
          "far from the half period a copy is; the fill says which side of it. " +
          "Two weak channels making one strong one." },
  { id: "R-wipe", name: "R · one-way wipe", shape: R, ch: chWipe,
    note: "The shipped channel on the letter instead of the comma. The R's " +
          "counter and leg break the sweep line into pieces, which is extra " +
          "information at large size and clutter at small." },
  { id: "R-stroke", name: "R · drawn and undrawn", shape: R, ch: chStroke,
    note: "A pen travels the letter's outline, then rubs it out from the same " +
          "end. Reads as handwriting; the danger is that at small size the " +
          "half-drawn letter stops looking like an R at all." },
  { id: "R-bead", name: "R · bead on the outline", shape: R, ch: chBead,
    note: "The letter never changes; a bead runs once round its edge. Nothing " +
          "about the glyph moves, so no part of the phase channel can be " +
          "mistaken for the pattern itself turning." },
  { id: "flag-unfurl", name: "Flag · unfurling", shape: FLAG, ch: chUnfurl,
    note: "A pole with a banner, filled from the pole outward and then " +
          "swallowed from the same side. The pole gives an unambiguous axis " +
          "to read the reflection against." },
  { id: "tri-bead", name: "Scalene triangle · bead", shape: TRI, ch: chBead,
    note: "Three unequal sides and a bevelled corner: no rotation and no " +
          "reflection fixes it, and it stays legible smaller than any letter." },
  { id: "ell-wipe", name: "L-polyomino · wipe", shape: ELL, ch: chWipe,
    note: "The polyomino reading of handedness — an L and its mirror are the " +
          "textbook example of two shapes no turn can identify. Flat edges " +
          "make the sweep line read exactly." },
  { id: "spiral-extend", name: "Spiral arm · extending", shape: SPIRAL, ch: chExtend,
    note: "The arm draws itself outward and retracts. A spiral is chiral by " +
          "construction, but it is also the shape most likely to read as a " +
          "rotation when it is small — see its rotation score." },
  { id: "disc-radial", name: "Disc · radial fill", shape: DISC, ch: chRadial,
    note: "The billiards motif. Perfectly readable phase and zero handedness: " +
          "a round motif tells you nothing about orientation, which is why it " +
          "only works where the balls' own motion carries that." },
  { id: "comma-bead", name: "Comma · bead on the outline", shape: COMMA, ch: chBead,
    note: "The shipped shape with the least intrusive channel. Compare its " +
          "phase score against the wipe's: a bead is a smaller signal, and " +
          "the measurement says how much smaller." },
  { id: "flag-stroke", name: "Flag · drawn and undrawn", shape: FLAG, ch: chStroke,
    note: "Stroke order on a shape with a long straight spine. The pen's " +
          "position along the pole is readable even when the banner is not." },
  { id: "tri-unfurl", name: "Triangle · unfurling", shape: TRI, ch: chUnfurl,
    note: "The wipe turned on its side, across a shape with no vertical edges: " +
          "the filled region's boundary changes length as it travels, so the " +
          "phase is legible from the silhouette as well as the fill." },
];

/* ------------------------------------------------------------ measurement */
/* Rasterise the motif into a small offscreen canvas and compare pictures.
 * Distance is mean absolute difference over the alpha-weighted ink, scaled so
 * 0 is identical and 1 is disjoint. Crude on purpose: it is exactly what the
 * eye does at thumbnail size. */
const M = 48;
const GROUND_RGB = [250, 249, 246];

function stamp(motif, ph, { mirror = false, turn = 0 } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = M;
  const x = c.getContext("2d");
  // an OPAQUE ground: comparing against transparent black would let the empty
  // margin dominate every measurement and flatten all fourteen scores to zero
  x.fillStyle = GROUND;
  x.fillRect(0, 0, M, M);
  x.translate(M / 2, M / 2);
  if (turn) x.rotate(turn);
  if (mirror) x.scale(-1, 1);
  motif.ch(x, motif.shape, M * 0.40, ((ph % 1) + 1) % 1);
  return x.getImageData(0, 0, M, M).data;
}

const inked = (d, i) =>
  Math.abs(d[i] - GROUND_RGB[0]) + Math.abs(d[i + 1] - GROUND_RGB[1]) +
  Math.abs(d[i + 2] - GROUND_RGB[2]) > 24;

/* Mean absolute difference over the UNION of the two footprints. Normalising
 * by the ink rather than by the canvas is what makes the number mean what the
 * eye means: two motifs that differ everywhere they are drawn score near 1,
 * whatever fraction of the frame they happen to occupy. */
function dist(a, b) {
  let s = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (!inked(a, i) && !inked(b, i)) continue;
    for (let k = 0; k < 3; k++) s += Math.abs(a[i + k] - b[i + k]);
    n += 3;
  }
  return n ? s / n / 255 : 0;
}

export function measure(motif) {
  const P = 16;
  const frames = [];
  for (let i = 0; i < P; i++) frames.push(stamp(motif, i / P));

  // only pairs at least an eighth of a period apart: adjacent samples of a
  // continuous channel are close BY DESIGN, and folding them in would score
  // smoothness rather than the thing at issue — whether a frozen frame can
  // confuse two instants a reader would call different
  const GAP = Math.round(P / 8);
  let phase = Infinity;
  for (let i = 0; i < P; i++) {
    for (let j = i + 1; j < P; j++) {
      if (Math.min(j - i, P - (j - i)) < GAP) continue;
      phase = Math.min(phase, dist(frames[i], frames[j]));
    }
  }
  const hand = dist(frames[4], stamp(motif, 4 / P, { mirror: true }));
  let rot = 0;
  for (const t of [TWO_PI / 6, TWO_PI / 4, TWO_PI / 3, TWO_PI / 2]) {
    rot = Math.max(rot, 1 - dist(frames[4], stamp(motif, 4 / P, { turn: t })));
  }
  const seam = dist(stamp(motif, 0.999), frames[0]);
  return { phase, hand, rot, seam };
}

/* --------------------------------------------------------------- the animation */
function latToPix(A, b1, b2) {
  const B = [[b1[0], b2[0]], [b1[1], b2[1]]];
  const d = B[0][0] * B[1][1] - B[0][1] * B[1][0];
  const Bi = [[B[1][1] / d, -B[0][1] / d], [-B[1][0] / d, B[0][0] / d]];
  const BA = [[B[0][0] * A[0][0] + B[0][1] * A[1][0], B[0][0] * A[0][1] + B[0][1] * A[1][1]],
              [B[1][0] * A[0][0] + B[1][1] * A[1][0], B[1][0] * A[0][1] + B[1][1] * A[1][1]]];
  return [[BA[0][0] * Bi[0][0] + BA[0][1] * Bi[1][0], BA[0][0] * Bi[0][1] + BA[0][1] * Bi[1][1]],
          [BA[1][0] * Bi[0][0] + BA[1][1] * Bi[1][0], BA[1][0] * Bi[0][1] + BA[1][1] * Bi[1][1]]];
}

export class MotifFilm extends Playback {
  constructor(canvas, spec, motif, opts = {}) {
    super({ period: opts.period || 5200 });
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.spec = spec;
    this.motif = motif;
    this.cells = opts.cells || 2.6;
    this.timeSym = filmTimeSymmetry(spec);
  }

  setMotif(m) { this.motif = m; if (!this.running) this.drawStatic(); }

  drawFrame(t) {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 220;
    if (this.canvas.width !== Math.round(w * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, w, h);

    const B = this.spec.basis;
    const cell = Math.min(w, h) / this.cells;
    const b1 = [B[0][0] * cell, -B[0][1] * cell];
    const b2 = [B[1][0] * cell, -B[1][1] * cell];
    const R = cell * 0.30;
    const span = Math.ceil(this.cells) + 2;
    const places = orbitPlacements(this.spec, -span, span, -span, span);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    for (const pl of places) {
      const px = pl.pos[0] * b1[0] + pl.pos[1] * b2[0];
      const py = pl.pos[0] * b1[1] + pl.pos[1] * b2[1];
      if (px < -w / 2 - 2 * R || px > w / 2 + 2 * R ||
          py < -h / 2 - 2 * R || py > h / 2 + 2 * R) continue;
      const Mp = latToPix(pl.A, b1, b2);
      ctx.save();
      ctx.translate(px, py);
      ctx.transform(Mp[0][0], Mp[1][0], Mp[0][1], Mp[1][1], 0, 0);
      this.motif.ch(ctx, this.motif.shape, R, ((pl.s * (t - pl.tau)) % 1 + 1) % 1);
      ctx.restore();
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------- page */
const data = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
const byId = new Map(data.groups.map(g => [g.id, g]));

/* The test groups. A motif that survives a sixfold screw and a mirror pair has
 * nothing left to fear; p1 is the control, where any shape looks fine. */
const TESTS = [
  { id: "g248", why: "sixfold time screw — the hardest case for anything that turns" },
  { id: "g235", why: "threefold gyration plus a time-glide mirror: handedness on trial" },
  { id: "g6", why: "half-turns only, clock of order 2" },
  { id: "g1", why: "translations only — the control" },
];

const sel = document.getElementById("group-pick");
const grid = document.getElementById("grid");
const animations = [];

for (const t of TESTS) {
  const g = byId.get(t.id);
  const b = document.createElement("button");
  b.type = "button";
  b.className = "gpick";
  b.innerHTML = `<span class="sym">${leadHtml(g)}</span>` +
                `<span class="why">${t.why}</span>`;
  b.addEventListener("click", () => {
    for (const o of sel.children) o.classList.toggle("on", o === b);
    for (const f of animations) { f.spec = g.render; f.drawStatic(); }
  });
  sel.append(b);
}
sel.firstChild.classList.add("on");

for (const m of MOTIFS) {
  const card = document.createElement("section");
  card.className = "mcard";
  const head = document.createElement("h3");
  head.textContent = m.name;
  const canvas = document.createElement("canvas");
  const body = document.createElement("div");
  body.className = "mbody";
  const note = document.createElement("p");
  note.className = "mnote";
  note.textContent = m.note;
  card.append(head, canvas, body, note);
  grid.append(card);                      // attach before measuring/constructing

  const anim = new MotifFilm(canvas, byId.get(TESTS[0].id).render, m);
  animations.push(anim);
  attachStage(anim, canvas);
  attachControls(anim, body);

  const s = measure(m);
  const bar = (label, v, good, hint) => {
    const pct = Math.max(0, Math.min(1, v));
    return `<div class="score ${good ? "ok" : "bad"}" title="${hint}">` +
           `<span class="lab">${label}</span>` +
           `<span class="track"><span style="width:${(pct * 100).toFixed(0)}%"></span></span>` +
           `<span class="num">${v.toFixed(2)}</span></div>`;
  };
  const scores = document.createElement("div");
  scores.className = "scores";
  scores.innerHTML =
    bar("handedness", s.hand, s.hand > 0.10,
        "distance from the mirror image — higher is better") +
    bar("phase", s.phase, s.phase > 0.02,
        "smallest difference between two instants of the loop — higher is better") +
    bar("rotation", s.rot, s.rot < 0.90,
        "worst similarity to itself turned by 60/90/120/180° — LOWER is better") +
    bar("seam", s.seam, s.seam < 0.02,
        "jump across t = 0 — LOWER is better");
  card.insertBefore(scores, note);
}
