/* Orbit construction and symmetry verification for film-group animations.
 *
 * A render spec lists coset representatives ops = {M, v, s, tau} of a film
 * group modulo integer lattice translations and integer time translations.
 * The animation is DEFINED as the orbit of one motif worldtube under these
 * elements: this module builds that orbit explicitly and verifies, before
 * anything is drawn, that the listed elements really form a group modulo
 * (Z^2 x Z) — identity, inverses, closure. If they do, invariance of the
 * rendered animation under every listed operation (spatial part composed
 * with the time action t -> s t + tau) holds by construction; if they do
 * not, the renderer refuses to draw and shows an error instead.
 *
 * verifyFrames() additionally checks invariance at the pixel level: it
 * renders F(t0), applies a group element to the canvas, and compares with
 * F(s t0 + tau) — "apply the indicated symmetry and see the same film".
 */
"use strict";

const EPS = 1e-9;

function frac(x) {
  return ((x % 1) + 1) % 1;
}

function matMul2(A, B) {
  return [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
  ];
}

function matVec2(A, v) {
  return [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
}

/* Compose film-group elements g1∘g2 acting as
 * (x,t) -> (M x + v, s t + tau). */
export function compose(g1, g2) {
  return {
    M: matMul2(g1.M, g2.M),
    v: [
      g1.M[0][0] * g2.v[0] + g1.M[0][1] * g2.v[1] + g1.v[0],
      g1.M[1][0] * g2.v[0] + g1.M[1][1] * g2.v[1] + g1.v[1],
    ],
    s: g1.s * g2.s,
    tau: g1.s * g2.tau + g1.tau,
  };
}

export function inverse(g) {
  const det = g.M[0][0] * g.M[1][1] - g.M[0][1] * g.M[1][0];
  const Mi = [[g.M[1][1] / det, -g.M[0][1] / det],
              [-g.M[1][0] / det, g.M[0][0] / det]];
  const vi = matVec2(Mi, g.v).map(x => -x);
  return { M: Mi, v: vi, s: g.s, tau: -g.s * g.tau };
}

function opKey(g) {
  // key modulo integer lattice translations and integer time translations
  const m = g.M.flat().map(x => Math.round(x));
  const v = g.v.map(x => Math.round(frac(x) * 1e6) / 1e6).map(x => x === 1 ? 0 : x);
  const tau = (() => { const f = Math.round(frac(g.tau) * 1e6) / 1e6; return f === 1 ? 0 : f; })();
  return `${m.join(",")}|${v.join(",")}|${g.s}|${tau}`;
}

/* Verify that spec.ops are coset representatives of a group modulo
 * Z^2 x Z: identity present, closed under composition and inverse.
 * Returns {ok, errors}. */
export function verifySpec(spec) {
  const errors = [];
  const ops = spec.ops.map(o => ({ M: o.M, v: o.v.slice(), s: o.s, tau: o.tau }));
  const keys = new Set(ops.map(opKey));
  if (keys.size !== ops.length) {
    errors.push("duplicate operations in spec");
  }
  const idKey = opKey({ M: [[1, 0], [0, 1]], v: [0, 0], s: 1, tau: 0 });
  if (!keys.has(idKey)) {
    errors.push("identity operation missing");
  }
  for (const g of ops) {
    const gi = inverse(g);
    if (!keys.has(opKey(gi))) {
      errors.push(`inverse missing for ${opKey(g)}`);
    }
    for (const h of ops) {
      const gh = compose(g, h);
      if (!keys.has(opKey(gh))) {
        errors.push(`closure fails: ${opKey(g)} * ${opKey(h)} = ${opKey(gh)} not in spec`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/* The intermediate construction step: the explicit orbit of the base motif.
 * Returns placements [{A, pos, s, tau}] with A the spatial matrix and pos
 * the lattice-coordinate position of the copy's base point, covering the
 * lattice window [m1lo..m1hi] x [m2lo..m2hi]. The renderer must draw
 * EXACTLY these placements: motif slice at internal time s*(t - tau),
 * spatially transformed by A at pos. */
export function orbitPlacements(spec, m1lo, m1hi, m2lo, m2hi) {
  const base = spec.base || [0.31, 0.17];
  const out = [];
  for (const op of spec.ops) {
    const bx = op.M[0][0] * base[0] + op.M[0][1] * base[1] + op.v[0];
    const by = op.M[1][0] * base[0] + op.M[1][1] * base[1] + op.v[1];
    for (let m1 = m1lo; m1 <= m1hi; m1++) {
      for (let m2 = m2lo; m2 <= m2hi; m2++) {
        out.push({ A: op.M, pos: [bx + m1, by + m2], s: op.s, tau: op.tau });
      }
    }
  }
  return out;
}

/* Pixel-level invariance check: for each listed op g, compare the frame at
 * t0 with the frame at g's time-image, spatially transformed by g. Renders
 * into offscreen canvases via anim.drawFrame. Returns worst mismatch stats.
 * `anim` must expose drawFrame(t) drawing into anim.canvas at its current
 * geometry, with the origin at the canvas centre (renderer convention). */
export function verifyFrames(makeAnim, spec, opts = {}) {
  const size = opts.size || 240;
  const t0 = opts.t0 !== undefined ? opts.t0 : 0.137;
  const tol = opts.tol !== undefined ? opts.tol : 18;   // mean |diff| per px
  const results = [];
  const cvA = document.createElement("canvas");
  cvA.width = cvA.height = size;
  cvA.style.width = cvA.style.height = size + "px";
  const animA = makeAnim(cvA);
  const cvB = document.createElement("canvas");
  cvB.width = cvB.height = size;
  cvB.style.width = cvB.style.height = size + "px";
  const animB = makeAnim(cvB);
  // The phase ring is a screen-space annotation, deliberately not rotated
  // with its copy (renderer.js), so it is switched off here: invariance is
  // asserted of the pattern proper — the comma bodies and their fill.
  animA.showPhase = animB.showPhase = false;
  const B = spec.basis;
  const cell = animA.cell;

  for (const op of spec.ops) {
    // frame at t0
    animA.drawFrame(t0);
    // frame at the op's time image, then apply the op's spatial part to it
    const t1 = frac(op.s * t0 + op.tau);
    animB.drawFrame(t1);
    // spatial pixel map of op: x -> Mpix x (about canvas centre); pure
    // fractional translations shift by v in pixels
    const b1 = [B[0][0] * cell, -B[0][1] * cell];
    const b2 = [B[1][0] * cell, -B[1][1] * cell];
    const Bpix = [[b1[0], b2[0]], [b1[1], b2[1]]];
    const det = Bpix[0][0] * Bpix[1][1] - Bpix[0][1] * Bpix[1][0];
    const Binv = [[Bpix[1][1] / det, -Bpix[0][1] / det],
                  [-Bpix[1][0] / det, Bpix[0][0] / det]];
    const Mpix = matMul2(matMul2(Bpix, op.M), Binv);
    const vpix = matVec2(Bpix, op.v);
    // Invariance is F(t0)(q) = F(t1)(op(q)); with canvas semantics
    // dest = C(src), displaying F(t1)∘op needs C = op^{-1} (pixel form)
    const dpx = Mpix[0][0] * Mpix[1][1] - Mpix[0][1] * Mpix[1][0];
    const Mi = [[Mpix[1][1] / dpx, -Mpix[0][1] / dpx],
                [-Mpix[1][0] / dpx, Mpix[0][0] / dpx]];
    const vi = matVec2(Mi, vpix).map(x => -x);
    const cvT = document.createElement("canvas");
    cvT.width = cvT.height = size;
    const ctxT = cvT.getContext("2d");
    ctxT.translate(size / 2, size / 2);
    ctxT.transform(Mi[0][0], Mi[1][0], Mi[0][1], Mi[1][1], vi[0], vi[1]);
    ctxT.translate(-size / 2, -size / 2);
    ctxT.drawImage(cvB, 0, 0, size, size);
    // compare central region (edges differ by window clipping)
    const ctxA = cvA.getContext("2d");
    const R = Math.floor(size * 0.3);
    const dA = ctxA.getImageData(size / 2 - R, size / 2 - R, 2 * R, 2 * R).data;
    const dT = ctxT.getImageData(size / 2 - R, size / 2 - R, 2 * R, 2 * R).data;
    let sum = 0, n = 0;
    for (let i = 0; i < dA.length; i += 4) {
      sum += Math.abs(dA[i] - dT[i]) + Math.abs(dA[i + 1] - dT[i + 1]) +
             Math.abs(dA[i + 2] - dT[i + 2]);
      n++;
    }
    const mean = sum / n / 3;
    results.push({ op: opKey(op), meanDiff: mean, pass: mean < tol });
  }
  return { pass: results.every(r => r.pass), results };
}
