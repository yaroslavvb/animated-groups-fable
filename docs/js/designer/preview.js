/* The little film: the design as it will actually be seen.
 *
 * The 3D box is a way of EDITING a film; this is the film. Seen from above with
 * time running, it is the same picture the billiards page shows, drawn the same
 * way — a ball wearing its own clock, the colour growing out of the centre over
 * the first half of the period and eaten away from the centre over the second,
 * so a dot is a ball just starting and a thin ring one nearly done. (Radial and
 * not rotational: a turning marker inside a pattern with rotational symmetry
 * cannot be read at all.)
 *
 * It holds no copy of the design. Every frame samples Design.clones() afresh,
 * which is cached in the model and dropped by every edit, so dragging a
 * breakpoint changes the film under the reader's hand with nothing to rebuild
 * and no notification to forget to send.
 *
 * This is the one animation on the site that plays without being asked. The
 * rule elsewhere is that the reader has to ask; here the reader is the author,
 * and opening a design tool IS the asking.
 */
"use strict";
import { Playback } from "../playback.js?v=39";
import { filmTimeSymmetry } from "../phases.js?v=39";
import { pathAt } from "./model.js?v=39";
import { drawBall, GROUND } from "../ball.js?v=39";

const CELL = "#d9d5c8";
const TWO_PI = Math.PI * 2;

/* Lattice units across the short side of the square. A little over one cell:
 * enough that the pattern reads as a pattern and not as a single motif, and
 * little enough that a ball is still a ball. */
const CELLS = 1.75;


export class Preview extends Playback {
  constructor(canvas, design, opts = {}) {
    super({ period: opts.period || 6000 });
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.design = design;
    this._w = this._h = 0;
    this.syncGroup();
  }

  /* The instants the group itself distinguishes — k/N for a clock of order N.
   * They are what the arrow keys step between and what the scrub bar ticks:
   * on a page where the reader is DESIGNING against an N-colour clock, landing
   * exactly on a beat is the one scrub position that matters. */
  syncGroup() {
    this._symGroup = this.design.group;
    this.timeSym = filmTimeSymmetry({ ops: this.design.group.ops });
    return this.timeSym;
  }

  _fit() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 260;
    const h = this.canvas.clientHeight || 260;
    if (w !== this._w || h !== this._h ||
        this.canvas.width !== Math.round(w * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this._w = w;
      this._h = h;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.px = Math.min(w, h) / CELLS;
    const B = this.design.group.basis;
    // centre the view on the middle of the cell, not on its corner: the corner
    // is where the interesting fixed points are and they belong in the picture
    this.o = [(B[0][0] + B[1][0]) / 2, (B[0][1] + B[1][1]) / 2];
    return { w, h };
  }

  scr(p, w, h) {
    return [w / 2 + (p[0] - this.o[0]) * this.px,
            h / 2 - (p[1] - this.o[1]) * this.px];
  }

  drawFrame(t) {
    const { w, h } = this._fit();
    const ctx = this.ctx;
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, w, h);

    const B = this.design.group.basis;
    ctx.strokeStyle = CELL;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) {
      const u = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]][k];
      const p = this.scr([u[0] * B[0][0] + u[1] * B[1][0],
                          u[0] * B[0][1] + u[1] * B[1][1]], w, h);
      ctx[k ? "lineTo" : "moveTo"](p[0], p[1]);
    }
    ctx.stroke();

    const R = this.design.radius * this.px;
    const pad = R + 2;
    /* Which of the group's copies reach this window is a question about the
     * DESIGN, not a constant: a billiard whose loop leaves the base cell is put
     * back into view by a translation the size of its own excursion, and a
     * window fixed at two rings of cells simply omits those balls from the
     * film. So the model is asked for what is near the view, not for a block. */
    const seen = this.design.viewClones(
      Math.hypot(w, h) / 2 / this.px + this.design.radius, this.o);
    for (const c of seen) {
      const p = pathAt(c.path, t);
      const [x, y] = this.scr(p, w, h);
      if (x < -pad || x > w + pad || y < -pad || y > h + pad) continue;
      drawBall(ctx, x, y, R, t - c.tau, c.color);
    }
  }

}
