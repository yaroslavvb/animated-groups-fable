/* Film-group renderer.
 *
 * A film group acts on spacetime by  g:(x,t) -> (Rx + v, s t + tau)  with R a
 * 2x2 spatial matrix (in lattice coordinates), s = +-1, tau a fraction of the
 * time period. The pattern is the orbit of one animated motif ("worldtube").
 * The spatial slice of copy g at global time t is the motif rendered at
 * internal time  s*(t - tau), placed by the spatial part (R|v).
 *
 * Group spec (from catalog.json):
 *   basis: [[a1x,a1y],[a2x,a2y]]  spatial lattice basis, cartesian
 *   ops: [ {M:[[..],[..]], v:[f,f], s:+-1, tau:f}, ... ]  point-op coset reps
 *        including centering reps (v, tau in lattice/period coordinates)
 * All fractions are plain floats mod 1.
 */
"use strict";
import { verifySpec, orbitPlacements } from "./orbit.js?v=15";

const TWO_PI = Math.PI * 2;

/* The motif clock is a NON-ROTATIONAL, injective phase channel: the body
 * fills like a vessel, fill level = theta mod 1.
 *
 * Rationale: any rotating clock element interacts with the pattern's own
 * rotational symmetries — the k-th copy of an n-fold screw adds k·2π/n to a
 * hand's apparent angle, which can alias phases entirely (a long line of
 * bugs). A fill level cannot be rotated: the map theta -> level is injective
 * on [0,1), so two copies at different internal times ALWAYS look different
 * in a frozen frame; and the fill line is locked to the body's local axis,
 * so a rotated copy shows a visibly rotated fill line. Orientation and phase
 * are fully orthogonal channels. Reversal copies drain instead of filling.
 * Colors are static; only the fill boundary moves. */

/* body spans local y in [BODY_TOP, BODY_BOT] (canvas y-down local coords) */
const BODY_TOP = -0.85;
const BODY_BOT = 0.5;

function bodyPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(-0.15 * r, -0.5 * r);
  ctx.bezierCurveTo(0.65 * r, -0.55 * r, 0.55 * r, 0.28 * r, 0.05 * r, 0.42 * r);
  ctx.bezierCurveTo(-0.28 * r, 0.5 * r, -0.42 * r, 0.12 * r, -0.15 * r, -0.5 * r);
  ctx.closePath();
  // beak joins the vessel so the last sixth of the fill climbs the spout
  ctx.moveTo(-0.15 * r, -0.5 * r);
  ctx.lineTo(0.1 * r, -0.85 * r);
  ctx.lineTo(0.22 * r, -0.45 * r);
  ctx.closePath();
}

/* ---------------------------------------------------------------- motif */
// The motif must have NO accidental symmetry: chiral, asymmetric. Rendering
// is LAYERED ("body" | "tail" | "hands", or "all" — kept names: body =
// vessel outline, tail = liquid fill, hands = fill-line marker): frames draw
// every placement's layer together, so painting is order-independent and
// copies sharing a site (reversal partners) superimpose both fill lines.
export function drawMotif(ctx, theta, r, colors, layer = "all") {
  // theta = internal time in periods (any real); r = motif radius (px)
  const c = colors || MOTIF_COLORS;
  const ph = ((theta % 1) + 1) % 1;       // fill level, injective in theta
  const yLevel = (BODY_BOT - ph * (BODY_BOT - BODY_TOP)) * r;
  ctx.save();

  if (layer === "all" || layer === "body") {
    // empty vessel: light body + outline; static
    bodyPath(ctx, r);
    ctx.fillStyle = c.body;
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, 0.045 * r);
    ctx.strokeStyle = c.outline;
    ctx.stroke();
  }

  if (layer === "all" || layer === "tail") {
    // the liquid: dark fill from the bottom up to yLevel, clipped to the body
    ctx.save();
    bodyPath(ctx, r);
    ctx.clip();
    ctx.fillStyle = c.fill;
    ctx.fillRect(-1.1 * r, yLevel, 2.2 * r, (BODY_BOT + 0.1) * r - yLevel + 0.1 * r);
    ctx.restore();
  }

  if (layer === "all" || layer === "hands") {
    // fill-line marker: a bright segment at the liquid surface (clipped),
    // readable even at small sizes; coincident copies show several lines
    ctx.save();
    bodyPath(ctx, r);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-1.1 * r, yLevel);
    ctx.lineTo(1.1 * r, yLevel);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = Math.max(1.2, 0.09 * r);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

export const MOTIF_COLORS = {
  body: "#dbe6f2",
  outline: "#7d93ab",
  fill: "#3b6ea5",
  line: "#c0392b",
};

/* --------------------------------------------------------- group drawing */
export class FilmGroupAnimation {
  constructor(canvas, spec, opts = {}) {
    this.canvas = canvas;
    this.spec = spec;
    this.cellOverride = opts.cell || null; // explicit px-per-cell (tests only)
    this.cell = this.cellOverride || 64;   // else derived in _setupGeometry
    this.minMotifPx = opts.minMotifPx || 9;  // upscale cell if motifs smaller
    this.period = opts.period || 4000;    // ms per time period
    this.showOverlay = opts.showOverlay || false;
    this.running = false;
    this.t0 = null;
    this.phase = 0;          // current time in periods, [0,1)
    this.userPaused = false; // set by controls; visibility autostart respects it
    this.onTick = null;      // callback(phase) for control widgets
    this._frame = this._frame.bind(this);
    // GROUP-ACTION GATE: verify the spec is a genuine group of spacetime
    // operations before anything is drawn; a broken spec renders an error
    // banner, never a silently wrong pattern.
    this.specCheck = verifySpec(spec);
    if (!this.specCheck.ok) {
      console.error("Film-group spec fails group axioms:",
                    this.specCheck.errors, spec);
    }
    this._setupGeometry();
  }

  _setupGeometry() {
    const dpr = window.devicePixelRatio || 1;
    const canvas = this.canvas;
    const w = canvas.clientWidth || 220, h = canvas.clientHeight || 220;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    this.w = w; this.h = h; this.dpr = dpr;
    // UNIFORM REPEAT COUNT: size the cell so the pattern shows the same
    // number of translation repeats along the canvas's short side on every
    // diagram — enough to see the symmetry, no more. Cells with only one or
    // two distinct sites (e.g. p1, centred p1) get extra repeats so the
    // lattice is still evident; very dense cells slightly fewer so each
    // clock stays legible. Reversal partners share a spatial site and are
    // drawn superimposed, so sites are counted by distinct spatial part.
    if (!this.cellOverride && !this._rescaled) {
      const f1 = x => ((x % 1) + 1) % 1;
      const key = op => op.M.flat().join(",") + "|" +
        op.v.map(x => Math.round(f1(x) * 1e6)).join(",");
      const nSites = new Set(this.spec.ops.map(key)).size;
      const repeats = nSites <= 1 ? 5 : nSites <= 2 ? 4 : nSites <= 6 ? 3 : 2.0;
      this.cell = Math.max(24, Math.min(w, h) / repeats);
    }
    const B = this.spec.basis;
    const s = this.cell;
    // cartesian pixel basis (y flipped for screen)
    this.b1 = [B[0][0] * s, -B[0][1] * s];
    this.b2 = [B[1][0] * s, -B[1][1] * s];
    // Motif radius from the MINIMUM distance between orbit points: stamps
    // must never overlap, otherwise paint order (not equivariant!) would
    // break exact invariance of the rendered frame.
    const l1 = Math.hypot(...this.b1), l2 = Math.hypot(...this.b2);
    // site coordinates reduced mod 1 so the {0,1} shift window covers all
    // relative lattice offsets (M*base can land outside the unit cell)
    const frac = x => ((x % 1) + 1) % 1;
    const sites = [];
    const base = this.spec.base || [0.31, 0.17];
    for (const op of this.spec.ops) {
      const bx = frac(op.M[0][0] * base[0] + op.M[0][1] * base[1] + op.v[0]);
      const by = frac(op.M[1][0] * base[0] + op.M[1][1] * base[1] + op.v[1]);
      for (const m1 of [0, 1]) for (const m2 of [0, 1]) {
        sites.push([bx + m1, by + m2]);
      }
    }
    let minD = Math.min(l1, l2);
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        const dx = (sites[i][0] - sites[j][0]) * this.b1[0] +
                   (sites[i][1] - sites[j][1]) * this.b2[0];
        const dy = (sites[i][0] - sites[j][0]) * this.b1[1] +
                   (sites[i][1] - sites[j][1]) * this.b2[1];
        const d = Math.hypot(dx, dy);
        if (d > 1e-6 && d < minD) minD = d;
      }
    }
    // motif footprint (ring + satellite) reaches ~0.85 r: keep 2*0.85 r < minD
    this.motifR = Math.min(0.30 * Math.min(l1, l2), 0.60 * minD) *
                  (this.spec.motifScale || 1);
    // dense groups: enforce a minimum on-screen motif size by scaling the
    // cell up (fewer repeats shown, but a legible clock)
    const minPx = this.minMotifPx || 9;
    if (!this._rescaled && this.motifR > 0 && this.motifR < minPx) {
      this._rescaled = true;
      this.cell *= minPx / this.motifR;
      this._setupGeometry();
      return;
    }
    // window of lattice translations covering the canvas (+margin)
    const inv = invert2([[this.b1[0], this.b2[0]], [this.b1[1], this.b2[1]]]);
    const corners = [[0, 0], [w, 0], [0, h], [w, h]];
    let m1min = 1e9, m1max = -1e9, m2min = 1e9, m2max = -1e9;
    const cx = w / 2, cy = h / 2;
    for (const [px, py] of corners) {
      const u = px - cx, vv = py - cy;
      const m1 = inv[0][0] * u + inv[0][1] * vv;
      const m2 = inv[1][0] * u + inv[1][1] * vv;
      m1min = Math.min(m1min, m1); m1max = Math.max(m1max, m1);
      m2min = Math.min(m2min, m2); m2max = Math.max(m2max, m2);
    }
    const pad = 1.6;
    this.m1range = [Math.floor(m1min - pad), Math.ceil(m1max + pad)];
    this.m2range = [Math.floor(m2min - pad), Math.ceil(m2max + pad)];
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
    this.t0 = null;   // if running, next frame re-anchors to the new phase
    if (!this.running) {
      this.drawFrame(this.phase);
      if (this.onTick) this.onTick(this.phase);
    }
  }

  _frame(ts) {
    if (!this.running) return;
    if (this.t0 === null) this.t0 = ts - this.phase * this.period;
    this.phase = (((ts - this.t0) / this.period) % 1 + 1) % 1;
    this.drawFrame(this.phase);
    if (this.onTick) this.onTick(this.phase);
    this._raf = requestAnimationFrame(this._frame);
  }

  drawFrame(t) {
    const ctx = this.canvas.getContext("2d");
    const { w, h, dpr } = this;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.spec.bg || "#faf9f6";
    ctx.fillRect(0, 0, w, h);

    if (!this.specCheck.ok) {
      // never render a pattern from a non-group spec
      ctx.fillStyle = "#b03030";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("spec fails group verification — see console",
                   w / 2, h / 2);
      ctx.restore();
      return;
    }

    ctx.translate(w / 2, h / 2);

    // THE INTERMEDIATE STEP: the frame is drawn from the explicit orbit of
    // the base motif under the group elements — invariance by construction.
    // Drawing is layered (bodies, tails, hands) so that painting is
    // order-independent: coincident copies (reversal partners share a site)
    // superimpose both clocks instead of occluding one another.
    const placements = orbitPlacements(
      this.spec, this.m1range[0], this.m1range[1],
      this.m2range[0], this.m2range[1]);
    const visible = [];
    for (const pl of placements) {
      const px = pl.pos[0] * this.b1[0] + pl.pos[1] * this.b2[0];
      const py = pl.pos[0] * this.b1[1] + pl.pos[1] * this.b2[1];
      if (px < -this.w / 2 - this.motifR * 3 || px > this.w / 2 + this.motifR * 3 ||
          py < -this.h / 2 - this.motifR * 3 || py > this.h / 2 + this.motifR * 3) continue;
      visible.push([pl, px, py, latToPix(pl.A, this.b1, this.b2)]);
    }
    for (const layer of ["body", "tail", "hands"]) {
      for (const [pl, px, py, Mpx] of visible) {
        const theta = pl.s * (t - pl.tau);
        ctx.save();
        ctx.translate(px, py);
        ctx.transform(Mpx[0][0], Mpx[1][0], Mpx[0][1], Mpx[1][1], 0, 0);
        drawMotif(ctx, theta, this.motifR, null, layer);
        ctx.restore();
      }
    }
    if (this.showOverlay && this.spec.overlay) drawOverlay(ctx, this);
    ctx.restore();
  }
}

/* Convert a lattice-coordinate matrix M to pixel coordinates:
 * Mpix = B M B^{-1} where B = [b1 b2] columns. */
function latToPix(M, b1, b2) {
  const B = [[b1[0], b2[0]], [b1[1], b2[1]]];
  const Binv = invert2(B);
  const MB = [[M[0][0], M[0][1]], [M[1][0], M[1][1]]];
  return mul2(mul2(B, MB), Binv);
}

function mul2(A, B) {
  return [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
  ];
}

function invert2(A) {
  const d = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  return [[A[1][1] / d, -A[0][1] / d], [-A[1][0] / d, A[0][0] / d]];
}

/* ------------------------------------------------- symmetry-element overlay */
function drawOverlay(ctx, anim) {
  const ov = anim.spec.overlay;
  const { b1, b2 } = anim;
  const toPix = (lx, ly) => [lx * b1[0] + ly * b2[0], lx * b1[1] + ly * b2[1]];
  if (!ov) return;
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (let m1 = anim.m1range[0]; m1 <= anim.m1range[1]; m1++) {
    for (let m2 = anim.m2range[0]; m2 <= anim.m2range[1]; m2++) {
      for (const c of ov.centers || []) {
        const [px, py] = toPix(c.p[0] + m1, c.p[1] + m2);
        drawCenterMarker(ctx, px, py, c.n, c.phase);
      }
      for (const L of ov.lines || []) {
        const [x1, y1] = toPix(L.p1[0] + m1, L.p1[1] + m2);
        const [x2, y2] = toPix(L.p2[0] + m1, L.p2[1] + m2);
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = L.reversal ? "#8e44ad" : "#2c3e50";
        ctx.setLineDash(L.glide ? [5, 4] : []);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  ctx.restore();
}

function drawCenterMarker(ctx, x, y, n, phase) {
  const r = 5;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k / n) * TWO_PI;
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  // fill hue encodes the time-screw phase: gray = 0, warm = fractional
  ctx.fillStyle = phase ? `hsl(${Math.round(360 * phase)}, 70%, 55%)` : "#5d6d7e";
  ctx.fill();
  ctx.strokeStyle = "#2c3e50";
  ctx.lineWidth = 1;
  ctx.stroke();
}
