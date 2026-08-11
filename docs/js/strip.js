/* 1+1D "chronofrieze" renderer: a strip of animated motifs.
 * Spec: { ops: [{m: +-1, s: +-1, v: float, tau: float}], cent: null | [vx, tau] }
 * m = spatial sign (mirror), s = time sign, v = spatial fractional translation,
 * tau = time fractional translation. Lattice = Z (spacing `cell` px) + optional
 * centering (vx, tau).
 */
"use strict";
import { drawMotif, drawPhaseRing } from "./renderer.js?v=29";
import { Playback } from "./playback.js?v=29";
import { stripTimeSymmetry } from "./phases.js?v=29";

/* 1+1D group verification: ops (m, s, v, tau) act as
 * (x,t) -> (m x + v, s t + tau); with an optional centring translation the
 * rep set is ops ∪ ops∘cent, verified as a group modulo Z x Z. */
export function verifyStripSpec(spec) {
  const frac = x => ((x % 1) + 1) % 1;
  const reps = [];
  for (const o of spec.ops) {
    reps.push({ m: o.m, s: o.s, v: o.v, tau: o.tau });
    if (spec.cent) {
      reps.push({ m: o.m, s: o.s, v: o.v + spec.cent[0], tau: o.tau + spec.cent[1] });
    }
  }
  const key = g => `${g.m}|${g.s}|${frac(g.v).toFixed(6)}|${frac(g.tau).toFixed(6)}`;
  const keys = new Set(reps.map(key));
  const errors = [];
  if (!keys.has(key({ m: 1, s: 1, v: 0, tau: 0 }))) errors.push("identity missing");
  for (const g of reps) {
    const gi = { m: g.m, s: g.s, v: -g.m * g.v, tau: -g.s * g.tau };
    if (!keys.has(key(gi))) errors.push(`inverse missing for ${key(g)}`);
    for (const h of reps) {
      const gh = { m: g.m * h.m, s: g.s * h.s, v: g.m * h.v + g.v, tau: g.s * h.tau + g.tau };
      if (!keys.has(key(gh))) errors.push(`closure fails: ${key(g)} * ${key(h)}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

const f1 = x => ((x % 1) + 1) % 1;

/* The DISTINCT SPATIAL actions (m, v mod 1). A reversal partner — same
 * mirror, same translation, opposite time direction — occupies the same site
 * by construction, and the renderer superimposes the two clocks there on
 * purpose; it must not be counted as a second copy, nor as a collision. */
function spatialCopies(spec) {
  const seen = new Map();
  const put = (m, v) => {
    const k = m + "|" + Math.round(f1(v) * 1e6);
    if (!seen.has(k)) seen.set(k, { m, v });
  };
  for (const o of spec.ops) {
    put(o.m, o.v);
    if (spec.cent) put(o.m, o.v + spec.cent[0]);
  }
  return [...seen.values()];
}

/* The offset maximising the closest distance between copies; {base, gap} with
 * gap in cells. Two DIFFERENT spatial copies landing on one point score a gap
 * of zero and so can never win — which is the whole point: a base of ½ makes
 * a mirror pair coincide, and an objective that merely counted distinct
 * positions would happily choose it and draw two motifs on top of each other. */
function bestBase(spec) {
  const copies = spatialCopies(spec);
  let best = { base: 0.27, gap: -1 };
  for (let i = 1; i <= 480; i++) {
    const base = i / 960;             // half a cell covers every distinct offset
    const p = copies.map(c => f1(c.m * base + c.v)).sort((a, b) => a - b);
    let gap = 1;
    for (let k = 0; k < p.length; k++) {
      const d = k + 1 < p.length ? p[k + 1] - p[k] : 1 - p[p.length - 1] + p[0];
      if (d < gap) gap = d;
    }
    // ties (a group with a single copy per cell constrains nothing) go to a
    // generic-looking offset rather than to whichever the scan reached first
    if (gap > best.gap + 1e-9 ||
        (gap > best.gap - 1e-9 &&
         Math.abs(base - 0.27) < Math.abs(best.base - 0.27))) {
      best = { base, gap };
    }
  }
  return best;
}

export class StripAnimation extends Playback {
  constructor(canvas, spec, opts = {}) {
    super(opts);   // playback state, paused until the viewer presses play
    this.canvas = canvas;
    this.spec = spec;
    this.cellOverride = opts.cell || null;  // explicit px-per-cell (tests only)
    this.cell = this.cellOverride || 88;    // else derived per draw from width
    this.showPhase = opts.showPhase !== false;
    this.timeSym = stripTimeSymmetry(spec);
    this.beats = this.timeSym.n;
    // 1-D analogue of optimize_bases.py: place the motif so its copies are as
    // far apart as they can be. A fixed offset puts the two copies of a
    // centred group (v and v + 1/2, mirrored) almost on top of each other,
    // which with the phase ring is not a pattern but a smudge.
    const layout = bestBase(spec);
    this.base = layout.base;
    this.minGap = layout.gap;      // closest pair, in cells — sizes the motif
    this.specCheck = verifyStripSpec(spec);
    if (!this.specCheck.ok) {
      console.error("Strip spec fails group axioms:", this.specCheck.errors, spec);
    }
  }

  drawFrame(t) {
    const canvas = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 110;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#faf9f6";
    ctx.fillRect(0, 0, w, h);
    if (!this.specCheck.ok) {
      ctx.fillStyle = "#b03030";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("spec fails group verification — see console", w / 2, h / 2);
      ctx.restore();
      return;
    }
    ctx.translate(w / 2, h / 2);

    // uniform repeat count (mirrors FilmGroupAnimation): show the same
    // number of COPIES on every strip, so the spacing between motifs is the
    // same whether a cell holds one of them or four
    const nCopies = spatialCopies(this.spec).length;
    if (!this.cellOverride) {
      let c = (nCopies * w) / 7;         // target ~7 visible copies
      c = Math.max(c, w / 7);
      c = Math.min(c, w / 2.2);
      this.cell = c;
    }
    // size the motif by the CLOSEST pair, exactly as the 2+1D renderer does:
    // the phase ring at 0.82 r is the outermost part, and 2*0.82*0.52 < 1
    // keeps two neighbours' rings clear of one another
    const r = Math.min(0.52 * this.minGap * this.cell, 0.34 * h);
    const base = this.base;
    const copies = [];
    for (const op of this.spec.ops) {
      copies.push([op.m, op.v, op.s, op.tau]);
      if (this.spec.cent) {
        copies.push([op.m, op.v + this.spec.cent[0],
                     op.s, op.tau + this.spec.cent[1]]);
      }
    }
    const span = Math.ceil(w / 2 / this.cell) + 1;
    // layered drawing: order-independent painting; coincident copies
    // (e.g. a palindrome's forward/backward pair) superimpose both clocks
    for (const layer of ["body", "fill"]) {
      for (const [m, v, s, tau] of copies) {
        for (let k = -span; k <= span; k++) {
          const x = (m * base + v + k) * this.cell;
          if (x < -w / 2 - r || x > w / 2 + r) continue;
          const theta = s * (t - tau);
          ctx.save();
          ctx.translate(x, 0);
          ctx.scale(m, 1);   // spatial mirror flips the motif
          drawMotif(ctx, theta, r, null, layer);
          ctx.restore();
        }
      }
    }
    // the phase readout: translated to each copy but never mirrored with it,
    // so one interval of the period is one arc everywhere (renderer.js)
    if (this.showPhase) {
      for (const [m, v, s, tau] of copies) {
        for (let k = -span; k <= span; k++) {
          const x = (m * base + v + k) * this.cell;
          if (x < -w / 2 - r || x > w / 2 + r) continue;
          ctx.save();
          ctx.translate(x, 0);
          drawPhaseRing(ctx, s * (t - tau), r, this.beats, s);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }
}
