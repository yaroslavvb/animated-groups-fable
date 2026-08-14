/* Static renderer for COLOURED plane crystals (data/colored.json).
 *
 * A coloured crystal is a wallpaper group Gamma with an index-k subgroup H:
 * the motif copy placed by g gets the colour of the coset gH.  The spec
 * emitted by enumerate/enumerate_colored.py lists one op per (point matrix,
 * translation offset) modulo the COLOUR-PERIOD cell L0 — the sublattice of
 * translations fixing every colour — so tiling the plane by L0 with those
 * ops paints the complete colouring:
 *
 *   spec = { basis,             // spatial lattice basis, cartesian columns
 *            cell,              // L0 basis, integer lattice coordinates
 *            k,                 // number of colours
 *            ops: [{M, v, color}],
 *            base,              // motif base point (lattice coords)
 *            minDist }          // min orbit distance, cartesian units
 *
 * Drawing conventions follow renderer.js/colored.js: the comma body (an
 * asymmetric, handed motif — rotated copies look rotated, reflected copies
 * look reflected), flat fills from the Okabe–Ito palette (the same palette
 * xu-correspondence.json uses for clock phases, so a cyclic colouring here
 * matches its clockwork twin's plates), paper background in both themes.
 */
"use strict";
import { bodyPath } from "./renderer.js?v=44";

export const OKABE = ["#0072B2", "#E69F00", "#009E73",
                      "#CC79A7", "#56B4E9", "#D55E00"];

const PAPER = "#faf9f6";
const INK = "rgba(30,36,48,0.55)";
const PACK = 0.45;       // fraction of nearest-neighbour distance occupied
                         // (renderer.js uses 0.52 with the phase ring at
                         // 0.82r; these plates have no ring, so pack less)
const CELLS = 4;         // Z^2 repeats across the short side, before floors
const MOTIF_FLOOR_PX = 11;

export function paintColoredCrystal(canvas, spec, opts = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 220, h = canvas.clientHeight || 220;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);

  const B = spec.basis;
  let cell = Math.max(Math.min(w, h) / CELLS, 24);
  // motif radius from the enumerator's exact minimum orbit distance
  let motifR = PACK * spec.minDist * cell;
  if (motifR < MOTIF_FLOOR_PX) {
    cell *= MOTIF_FLOOR_PX / motifR;
    motifR = MOTIF_FLOOR_PX;
  }
  // cartesian pixel basis (y flipped for the screen)
  const b1 = [B[0][0] * cell, -B[0][1] * cell];
  const b2 = [B[1][0] * cell, -B[1][1] * cell];
  const det = b1[0] * b2[1] - b2[0] * b1[1];
  const Bi = [[b2[1] / det, -b2[0] / det], [-b1[1] / det, b1[0] / det]];

  // colour-period cell in pixels, and the tiling range that covers the view
  const c1 = [spec.cell[0][0] * b1[0] + spec.cell[0][1] * b2[0],
              spec.cell[0][0] * b1[1] + spec.cell[0][1] * b2[1]];
  const c2 = [spec.cell[1][0] * b1[0] + spec.cell[1][1] * b2[0],
              spec.cell[1][0] * b1[1] + spec.cell[1][1] * b2[1]];
  const span = Math.max(Math.hypot(...c1), Math.hypot(...c2), 1);
  const reach = Math.ceil((Math.hypot(w, h) / 2 + 3 * motifR) /
                          Math.min(Math.hypot(...c1), Math.hypot(...c2))) + 1;

  const base = spec.base || [0.31, 0.17];
  const palette = opts.palette || OKABE;
  ctx.lineWidth = Math.max(0.6, 0.05 * motifR);
  for (const op of spec.ops) {
    const M = op.M;
    // position of this copy's base point, lattice coords
    const px0 = M[0][0] * base[0] + M[0][1] * base[1] + op.v[0];
    const py0 = M[1][0] * base[0] + M[1][1] * base[1] + op.v[1];
    // pixel transform of the copy's point action: T = Bpix M Bpix^{-1}
    const BA = [[b1[0] * M[0][0] + b2[0] * M[1][0], b1[0] * M[0][1] + b2[0] * M[1][1]],
                [b1[1] * M[0][0] + b2[1] * M[1][0], b1[1] * M[0][1] + b2[1] * M[1][1]]];
    const T = [[BA[0][0] * Bi[0][0] + BA[0][1] * Bi[1][0], BA[0][0] * Bi[0][1] + BA[0][1] * Bi[1][1]],
               [BA[1][0] * Bi[0][0] + BA[1][1] * Bi[1][0], BA[1][0] * Bi[0][1] + BA[1][1] * Bi[1][1]]];
    const fill = palette[op.color % palette.length];
    for (let m1 = -reach; m1 <= reach; m1++) {
      for (let m2 = -reach; m2 <= reach; m2++) {
        const lx = px0 + m1 * spec.cell[0][0] + m2 * spec.cell[1][0];
        const ly = py0 + m1 * spec.cell[0][1] + m2 * spec.cell[1][1];
        const px = lx * b1[0] + ly * b2[0];
        const py = lx * b1[1] + ly * b2[1];
        if (px < -w / 2 - 2 * motifR || px > w / 2 + 2 * motifR ||
            py < -h / 2 - 2 * motifR || py > h / 2 + 2 * motifR) continue;
        ctx.save();
        ctx.translate(px, py);
        ctx.transform(T[0][0], T[1][0], T[0][1], T[1][1], 0, 0);
        bodyPath(ctx, motifR);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/* Verify a colored spec before painting: the listed ops must be coset
 * representatives of a group modulo the colour-period lattice L0 (closure;
 * the colour assignments themselves are computed and verified exactly by
 * enumerate/enumerate_colored.py).  Cheap: |ops| is at most a few dozen. */
export function verifyColoredSpec(spec) {
  const inL0 = (x, y) => {
    const [a, b] = spec.cell[0], [c, d] = spec.cell[1];
    const det = a * d - b * c;
    const u = (x * d - y * c) / det, v = (-x * b + y * a) / det;
    return Math.abs(u - Math.round(u)) < 1e-6 &&
           Math.abs(v - Math.round(v)) < 1e-6;
  };
  const lookup = (M, vx, vy) => {
    for (const op of spec.ops) {
      if (op.M[0][0] !== M[0][0] || op.M[0][1] !== M[0][1] ||
          op.M[1][0] !== M[1][0] || op.M[1][1] !== M[1][1]) continue;
      if (inL0(op.v[0] - vx, op.v[1] - vy)) return op;
    }
    return null;
  };
  const errors = [];
  for (const g of spec.ops) {
    for (const hOp of spec.ops) {
      const M = [[g.M[0][0] * hOp.M[0][0] + g.M[0][1] * hOp.M[1][0],
                  g.M[0][0] * hOp.M[0][1] + g.M[0][1] * hOp.M[1][1]],
                 [g.M[1][0] * hOp.M[0][0] + g.M[1][1] * hOp.M[1][0],
                  g.M[1][0] * hOp.M[0][1] + g.M[1][1] * hOp.M[1][1]]];
      const vx = g.M[0][0] * hOp.v[0] + g.M[0][1] * hOp.v[1] + g.v[0];
      const vy = g.M[1][0] * hOp.v[0] + g.M[1][1] * hOp.v[1] + g.v[1];
      if (!lookup(M, vx, vy)) errors.push("closure fails");
    }
  }
  return { ok: errors.length === 0, errors };
}
