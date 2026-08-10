/* 1+1D "chronofrieze" renderer: a strip of animated motifs.
 * Spec: { ops: [{m: +-1, s: +-1, v: float, tau: float}], cent: null | [vx, tau] }
 * m = spatial sign (mirror), s = time sign, v = spatial fractional translation,
 * tau = time fractional translation. Lattice = Z (spacing `cell` px) + optional
 * centering (vx, tau).
 */
"use strict";
import { drawMotif } from "./renderer.js";

export class StripAnimation {
  constructor(canvas, spec, opts = {}) {
    this.canvas = canvas;
    this.spec = spec;
    this.cell = opts.cell || 88;
    this.period = opts.period || 4000;
    this.running = false;
    this.t0 = null;
    this.phase = 0;
    this.userPaused = false;
    this.onTick = null;
    this._frame = this._frame.bind(this);
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
    ctx.translate(w / 2, h / 2);

    const r = 0.30 * this.cell;
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
    for (const [m, v, s, tau] of copies) {
      for (let k = -span; k <= span; k++) {
        const x = (m * base + v + k) * this.cell;
        if (x < -w / 2 - r || x > w / 2 + r) continue;
        const theta = s * (t - tau);
        ctx.save();
        ctx.translate(x, 0);
        ctx.scale(m, 1);   // spatial mirror flips the motif
        drawMotif(ctx, theta, r);
        ctx.restore();
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
