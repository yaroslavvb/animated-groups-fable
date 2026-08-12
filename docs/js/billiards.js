/* Billiards: a live ball film, drawn from a solved trajectory set.
 *
 * Everywhere else on the site a motif is a drawn glyph whose only internal
 * state is a phase. Here the motif is three BALLS ON SOLVED TRAJECTORIES —
 * closed polylines p_i, straight between breakpoints, with
 *
 *      p_i(t + 1) = p_i(t) + L_i        L_i a lattice vector
 *
 * so the film loops although no ball ends where it began. The orbit fill is
 * the usual one with a time offset: clone (M | v | tau) draws the motif at
 * internal time t - tau, which is why a ball can meet a copy of itself
 * running a third of a period behind. The trajectories were solved as one
 * periodic system rather than simulated forward — see enumerate/solve_baseline.py.
 *
 * The data file carries the group (basis and the 18 clone reps), the polylines,
 * and the ball radius. Nothing here knows which group it is; swap the JSON and
 * the page animates a different one.
 */
"use strict";
import { Playback } from "./playback.js?v=36";
import { attachStage } from "./stage.js?v=36";
import { attachControls } from "./controls.js?v=36";
import { filmTimeSymmetry } from "./phases.js?v=36";
import { drawBall, GROUND } from "./ball.js?v=38";
import { elements } from "./designer/symmetry.js?v=38";

/* the GIF's palette, so the page and the exported film are the same picture */
const AXIS = "#8a8578";

const TWO_PI = Math.PI * 2;

const inv2 = (M) => {
  const d = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]];
};
const apply = (M, u) => [M[0][0] * u[0] + M[0][1] * u[1],
                         M[1][0] * u[0] + M[1][1] * u[1]];
const frac = (x) => ((x % 1) + 1) % 1;

export class BallFilm extends Playback {
  constructor(canvas, data, opts = {}) {
    super({ period: opts.period || 7200 });
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.B = data.basis;                  // rows: the two lattice vectors
    this.Binv = inv2(data.basis);
    this.ops = data.ops;
    this.radius = data.radius;
    // How much of the plane to show, in lattice units across the SHORT side.
    // One cell already holds 54 balls, so a view of two or three cells is a
    // rich pattern and anything wider is a texture: the reader is being asked
    // to find a 3-centre and follow a single ball around it, and neither is
    // possible at eight pixels a ball.
    this.cells = opts.cells || 1.45;
    this.showAxes = false;
    this.timeSym = filmTimeSymmetry({ ops: data.ops });

    // each ball as (breakpoint times in periods, positions, drift), with the
    // closing point p(0) + L appended so one interpolation covers the loop
    this.balls = data.balls.map((b) => {
      const ts = b.breaks.map((k) => k[0] / data.S).concat([1]);
      const ps = b.breaks.map((k) => [k[1], k[2]]);
      ps.push([ps[0][0] + b.drift[0], ps[0][1] + b.drift[1]]);
      return { ts, ps, L: b.drift };
    });
    this.colours = this.balls.map((_, i) =>
      `hsl(${((i / this.balls.length + 0.05) % 1) * 360} 60% 48%)`);

    this._w = this._h = 0;
  }

  /* ------------------------------------------------------------ geometry */
  /* ball i's lattice position at time s, in periods; s may be negative or
   * past 1, and every whole period costs one drift vector */
  posAt(i, s) {
    const b = this.balls[i];
    const k = Math.floor(s);
    const u = s - k;
    const ts = b.ts;
    let j = 0;
    while (j + 2 < ts.length && ts[j + 1] <= u) j++;
    const f = (u - ts[j]) / (ts[j + 1] - ts[j]);
    const a = b.ps[j], c = b.ps[j + 1];
    return [a[0] + f * (c[0] - a[0]) + k * b.L[0],
            a[1] + f * (c[1] - a[1]) + k * b.L[1]];
  }

  cart(u) {
    return [u[0] * this.B[0][0] + u[1] * this.B[1][0],
            u[0] * this.B[0][1] + u[1] * this.B[1][1]];
  }

  _fit() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 700;
    const h = this.canvas.clientHeight || 460;
    if (w !== this._w || h !== this._h ||
        this.canvas.width !== Math.round(w * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this._w = w;
      this._h = h;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.px = Math.min(w, h) / this.cells;       // pixels per unit length
    // how many lattice steps reach the corners of the view
    const hx = w / 2 / this.px, hy = h / 2 / this.px;
    let span = 0;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const u = apply([[this.Binv[0][0], this.Binv[1][0]],
                         [this.Binv[0][1], this.Binv[1][1]]], [sx * hx, sy * hy]);
        span = Math.max(span, Math.abs(u[0]), Math.abs(u[1]));
      }
    }
    this.span = Math.ceil(span) + 1;
    this.R = this.radius * this.px;
    return { w, h };
  }

  scr(p, w, h) { return [w / 2 + p[0] * this.px, h / 2 - p[1] * this.px]; }

  /* ------------------------------------------------------------- drawing */
  drawFrame(t) {
    const { w, h } = this._fit();
    const ctx = this.ctx;
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, w, h);
    if (this.showAxes) this._axes(ctx, w, h);

    // only six distinct time offsets, so six path evaluations per ball
    const seen = new Map();
    const at = (tau) => {
      let v = seen.get(tau);
      if (!v) {
        v = this.balls.map((_, i) => this.posAt(i, t - tau));
        seen.set(tau, v);
      }
      return v;
    };

    const pad = 2 * this.R + 4;
    for (const op of this.ops) {
      const here = at(op.tau);
      const ph = frac(t - op.tau);
      for (let i = 0; i < this.balls.length; i++) {
        const u = apply(op.M, here[i]);
        u[0] += op.v[0];
        u[1] += op.v[1];
        for (let m1 = -this.span; m1 <= this.span; m1++) {
          for (let m2 = -this.span; m2 <= this.span; m2++) {
            const p = this.cart([u[0] + m1, u[1] + m2]);
            const [x, y] = this.scr(p, w, h);
            if (x < -pad || x > w + pad || y < -pad || y > h + pad) continue;
            drawBall(ctx, x, y, this.R, ph, this.colours[i]);
          }
        }
      }
    }
  }


  /* The symmetry elements depend only on the group and how far the view
   * reaches, so they are computed once per span rather than every frame. */
  _elements() {
    if (!this._els || this._els.span !== this.span) {
      this._els = { span: this.span, ...elements(this.ops, this.span) };
    }
    return this._els;
  }

  _axes(ctx, w, h) {
    const { pts, lns } = this._elements();
    const reach = 3 * (this.span + 1);
    ctx.save();
    ctx.strokeStyle = AXIS;
    for (const ln of lns) {
      ctx.lineWidth = ln.glide ? 1.3 : 1.9;
      ctx.setLineDash(ln.glide ? [7, 5] : []);
      const p = this.scr(this.cart([ln.base[0] - reach * ln.d[0],
                                    ln.base[1] - reach * ln.d[1]]), w, h);
      const q = this.scr(this.cart([ln.base[0] + reach * ln.d[0],
                                    ln.base[1] + reach * ln.d[1]]), w, h);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = AXIS;
    ctx.lineWidth = 1.6;
    for (const { c, free } of pts) {
      const [x, y] = this.scr(this.cart(c), w, h);
      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
      const r = 7;
      // clear the lines out from under the marker: three mirrors meet at some
      // of these points, and a filled triangle sitting in the crossing reads
      // as a thickening of the lines rather than as a mark of its own
      ctx.beginPath();
      ctx.arc(x, y, r + 2.5, 0, TWO_PI);
      ctx.fillStyle = GROUND;
      ctx.fill();
      ctx.fillStyle = AXIS;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + k * TWO_PI / 3;
        ctx[k ? "lineTo" : "moveTo"](x + r * Math.cos(a), y + r * Math.sin(a));
      }
      ctx.closePath();
      // filled: a symmetry of every single frame. hollow: a symmetry only of
      // the film, because turning about it also runs the clock on.
      if (free) ctx.fill();
      else { ctx.fillStyle = GROUND; ctx.fill(); ctx.fillStyle = AXIS; ctx.stroke(); }
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ page */
const data = await (await fetch("data/billiards-g235.json", { cache: "no-cache" }))
  .json();

const host = document.getElementById("film");
const canvas = document.createElement("canvas");
canvas.className = "ballfilm";
host.append(canvas);                       // attach BEFORE measuring
const anim = new BallFilm(canvas, data);
attachStage(anim, canvas);
attachControls(anim, host);

// one switch: draw the group's own fixed-point sets over the pattern
const opts = document.createElement("div");
opts.className = "film-opts";
const wrap = document.createElement("label");
wrap.htmlFor = "opt-axes";
wrap.title = "mirror lines (solid), glide lines (dashed) and 3-centres " +
             "(triangles, filled where the rotation costs no time)";
const box = document.createElement("input");
box.type = "checkbox";
box.id = "opt-axes";
box.addEventListener("change", () => {
  anim.showAxes = box.checked;
  if (!anim.running) anim.drawStatic();
});
wrap.append(box, document.createTextNode(" symmetry axes"));
opts.append(wrap);
host.append(opts);

// the one caption line, filled from the data file
const count = document.getElementById("d-balls");
if (count) {
  count.textContent = `${data.balls.length} balls, ` +
                      `${data.ops.length} copies of each`;
  count.title = `clock of order ${data.clockOrder}; closest approach ` +
                `${data.clearanceRatio.toFixed(3)} ball diameters; symmetry ` +
                `residual ${data.symmetryResidual.toExponential(1)}`;
}
