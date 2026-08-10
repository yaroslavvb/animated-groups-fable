/* 1+1D "chronofrieze" renderer: a strip of animated motifs.
 * Spec: { ops: [{m: +-1, s: +-1, v: float, tau: float}], cent: null | [vx, tau] }
 * m = spatial sign (mirror), s = time sign, v = spatial fractional translation,
 * tau = time fractional translation. Lattice = Z (spacing `cell` px) + optional
 * centering (vx, tau).
 */
"use strict";
import { drawMotif } from "./renderer.js?v=14";

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

export class StripAnimation {
  constructor(canvas, spec, opts = {}) {
    this.canvas = canvas;
    this.spec = spec;
    this.cellOverride = opts.cell || null;  // explicit px-per-cell (tests only)
    this.cell = this.cellOverride || 88;    // else derived per draw from width
    this.period = opts.period || 4000;
    this.running = false;
    this.t0 = null;
    this.phase = 0;
    this.userPaused = false;
    this.onTick = null;
    this._frame = this._frame.bind(this);
    this.specCheck = verifyStripSpec(spec);
    if (!this.specCheck.ok) {
      console.error("Strip spec fails group axioms:", this.specCheck.errors, spec);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.t0 = null;   // _frame resumes from this.phase
    this._raf = requestAnimationFrame(this._frame);
  }
  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }
  getPhase() { return this.phase; }
  setPhase(t) {
    this.phase = ((t % 1) + 1) % 1;
    this.t0 = null;
    if (!this.running) {
      this.draw(this.phase);
      if (this.onTick) this.onTick(this.phase);
    }
  }

  _frame(ts) {
    if (!this.running) return;
    if (this.t0 === null) this.t0 = ts - this.phase * this.period;
    this.phase = (((ts - this.t0) / this.period) % 1 + 1) % 1;
    this.draw(this.phase);
    if (this.onTick) this.onTick(this.phase);
    this._raf = requestAnimationFrame(this._frame);
  }

  draw(t) {
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
    // number of cells on every strip; sparse cells (one site) get more
    if (!this.cellOverride) {
      const f1 = x => ((x % 1) + 1) % 1;
      const sites = new Set();
      for (const o of this.spec.ops) {
        sites.add(o.m + "|" + Math.round(f1(o.v) * 1e6));
        if (this.spec.cent) {
          sites.add(o.m + "|" + Math.round(f1(o.v + this.spec.cent[0]) * 1e6));
        }
      }
      const repeats = sites.size <= 1 ? 7 : sites.size <= 2 ? 5 : 4;
      this.cell = w / repeats;
    }
    const r = Math.min(0.30 * this.cell, 0.34 * h);
    const base = 0.27;  // generic offset within the cell
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
    for (const layer of ["body", "tail", "hands"]) {
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
    ctx.restore();
  }
}

/* The 13 groups, generators in the spec format (from the enumeration). */
export const CHRONOFRIEZE = [
  { name: "P1", ops: [{ m: 1, s: 1, v: 0, tau: 0 }], cent: null,
    blurb: "translations only — a marching band of identical clocks" },
  { name: "P2", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: -1, s: -1, v: 0, tau: 0 }], cent: null,
    blurb: "2-fold space-time rotation: flip space AND run time backwards" },
  { name: "Pm_x", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: -1, s: 1, v: 0, tau: 0 }], cent: null,
    blurb: "spatial mirror, clocks in phase" },
  { name: "Pg_x", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: -1, s: 1, v: 0, tau: 0.5 }], cent: null,
    blurb: "time glide: mirror + half-period delay" },
  { name: "Pm_t", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: 1, s: -1, v: 0, tau: 0 }], cent: null,
    blurb: "time mirror: the loop is a palindrome" },
  { name: "Pg_t", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: 1, s: -1, v: 0.5, tau: 0 }], cent: null,
    blurb: "glide time-reversal: played backwards = shifted half a cell" },
  { name: "P2m_xm_t", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: -1, s: 1, v: 0, tau: 0 },
                            { m: 1, s: -1, v: 0, tau: 0 }, { m: -1, s: -1, v: 0, tau: 0 }], cent: null,
    blurb: "mirror + palindrome (and their product, the 2-fold)" },
  { name: "P2g_xg_t", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: -1, s: 1, v: 0, tau: 0.5 },
                            { m: 1, s: -1, v: 0.5, tau: 0 }, { m: -1, s: -1, v: 0.5, tau: 0.5 }], cent: null,
    blurb: "both glides; only the 2-fold survives undisplaced" },
  { name: "P2m_xg_t", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: -1, s: 1, v: 0, tau: 0 },
                            { m: 1, s: -1, v: 0.5, tau: 0 }, { m: -1, s: -1, v: 0.5, tau: 0 }], cent: null,
    blurb: "mirror + glide time-reversal" },
  { name: "P2g_xm_t", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: -1, s: 1, v: 0, tau: 0.5 },
                            { m: 1, s: -1, v: 0, tau: 0 }, { m: -1, s: -1, v: 0, tau: 0.5 }], cent: null,
    blurb: "time glide + palindrome" },
  { name: "Cm_x", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: -1, s: 1, v: 0, tau: 0 }], cent: [0.5, 0.5],
    blurb: "centred: neighbours run half a period out of phase; mirror survives" },
  { name: "Cm_t", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: 1, s: -1, v: 0, tau: 0 }], cent: [0.5, 0.5],
    blurb: "centred palindrome" },
  { name: "C2m_xm_t", ops: [{ m: 1, s: 1, v: 0, tau: 0 }, { m: -1, s: 1, v: 0, tau: 0 },
                            { m: 1, s: -1, v: 0, tau: 0 }, { m: -1, s: -1, v: 0, tau: 0 }], cent: [0.5, 0.5],
    blurb: "centred, mirror and palindrome together" },
];
