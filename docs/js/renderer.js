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
import { verifySpec, orbitPlacements } from "./orbit.js?v=27";
import { Playback } from "./playback.js?v=27";
import { filmTimeSymmetry, beatOf } from "./phases.js?v=27";

const TWO_PI = Math.PI * 2;

/* Translation repeats shown across a diagram's short side. CELLS is the
 * target — the range wallpaper plates conventionally use — and MIN_CELLS the
 * floor a dense group may be relaxed to when its motifs would otherwise be
 * too small to read (see _setupGeometry). */
const CELLS = 4;
const MIN_CELLS = 3;

/* Hard ceiling on how many motifs may appear across a diagram, whatever its
 * width and however many copies the group puts in a cell. */
const MAX_COLUMNS = 18;

/* The motif is a THICK COMMA — a shape with no symmetry of its own, so a
 * rotated copy reads as rotated and a reflected copy reads as reflected. Its
 * clock is a NON-ROTATIONAL, injective phase channel: a sweep line crosses
 * the comma, colouring it in and then out again (see drawMotif).
 *
 * Rationale: any rotating clock element interacts with the pattern's own
 * rotational symmetries — the k-th copy of an n-fold screw adds k·2π/n to a
 * hand's apparent angle, which can alias phases entirely (a long line of
 * bugs). A sweep cannot be rotated: the map theta -> coloured region is
 * injective on [0,1), so two copies at different internal times ALWAYS look
 * different in a frozen frame; and the sweep is locked to the comma's local
 * axis, so a rotated copy shows a visibly rotated sweep. Orientation and
 * phase are fully orthogonal channels. Reversal copies run the sweep the
 * other way. Colors are static; only the boundary moves, and it moves
 * continuously through t = 0, so a looping film has no visible seam.
 *
 * The comma carries the CONTINUOUS phase; the ring around it (drawPhaseRing)
 * carries the DISCRETE one — which of the group's N time intervals the copy
 * is in. See phases.js. */

/* Comma outline: five cubic segments traced clockwise on screen (y down) —
 * the outer flank of the tail from the head's right down to the tip, the
 * inner flank back up to the head, then the head's own circle. Hand-tuned in
 * loose coordinates and normalised below, once, to sit centred inside radius
 * COMMA_R with the ring clear of it. */
const COMMA_R = 0.64;      // comma circumradius, in units of the motif radius
/* The tail is long and curls well past the head's axis on purpose: that is
 * the whole chirality signal, and it has to survive down to a 30 px thumbnail
 * where a stubbier comma reads the same as its mirror image. */
const RAW = [
  [[0.40, -0.30], [0.52, 0.18], [0.32, 0.56], [-0.52, 0.74]],
  [[-0.52, 0.74], [-0.10, 0.52], [0.18, 0.26], [0.06, 0.02]],
  [[0.06, 0.02], [-0.14, 0.02], [-0.40, -0.10], [-0.40, -0.30]],
  [[-0.40, -0.30], [-0.40, -0.54], [-0.22, -0.68], [0.00, -0.68]],
  [[0.00, -0.68], [0.24, -0.68], [0.40, -0.54], [0.40, -0.30]],
];

/* recentre on the outline's bounding box and scale to circumradius COMMA_R,
 * so the shape's extent is a known constant the layout can budget for */
const COMMA = (() => {
  const pts = [];
  for (const [p0, p1, p2, p3] of RAW) {
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, m = 1 - t;
      pts.push([
        m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
        m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
  }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const k = COMMA_R / Math.max(...pts.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  const segs = RAW.map(seg => seg.map(p => [(p[0] - cx) * k, (p[1] - cy) * k]));
  const yy = pts.map(p => (p[1] - cy) * k);
  return { segs, top: Math.min(...yy), bot: Math.max(...yy) };
})();

/* the comma spans local y in [BODY_TOP, BODY_BOT] (canvas y-down local
 * coords): fill level 0 leaves it empty, level 1 fills it to the brim */
const BODY_TOP = COMMA.top;
const BODY_BOT = COMMA.bot;

export function bodyPath(ctx, r) {
  const s = COMMA.segs;
  ctx.beginPath();
  ctx.moveTo(s[0][0][0] * r, s[0][0][1] * r);
  for (const [, p1, p2, p3] of s) {
    ctx.bezierCurveTo(p1[0] * r, p1[1] * r, p2[0] * r, p2[1] * r,
                      p3[0] * r, p3[1] * r);
  }
  ctx.closePath();
}

/* ---------------------------------------------------------------- motif */
// The motif must have NO accidental symmetry: chiral, asymmetric. Rendering
// is LAYERED ("body" | "fill", or "all"): frames draw every placement's body
// before any fill, so painting is order-independent — copies sharing a site
// (a reversal partner has the same spatial part) show the union of their
// coloured regions, which does not depend on who painted first.
export function drawMotif(ctx, theta, r, colors, layer = "all") {
  // theta = internal time in periods (any real); r = motif radius (px)
  const c = colors || MOTIF_COLORS;
  const ph = ((theta % 1) + 1) % 1;
  /* CONTINUOUS ONE-WAY WIPE. A sweep line crosses the comma from base to brim
   * once in each half of the period, always travelling the same way. In the
   * first half the colour lies BEHIND the line (the comma fills); in the
   * second half it lies AHEAD of it (the comma empties, the boundary still
   * rising). The painted region is continuous across both handovers — full at
   * t = 1/2, empty at t = 0 = 1 — so the loop never jumps. And because the two
   * halves colour opposite sides of the line, the picture still determines the
   * phase uniquely: the channel stays injective on [0,1), which is what keeps
   * the copies around a screw centre distinguishable. */
  const rising = ph < 0.5;
  const p = (ph * 2) % 1;                                  // sweep position
  const yLine = (BODY_BOT - p * (BODY_BOT - BODY_TOP)) * r;
  const yTop = (BODY_TOP - 0.2) * r, yBot = (BODY_BOT + 0.2) * r;
  ctx.save();

  if (layer === "all" || layer === "body") {
    // the empty comma: light body + outline; static
    bodyPath(ctx, r);
    ctx.fillStyle = c.body;
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, 0.045 * r);
    ctx.strokeStyle = c.outline;
    ctx.stroke();
  }

  if (layer === "all" || layer === "fill") {
    ctx.save();
    bodyPath(ctx, r);
    ctx.clip();
    ctx.fillStyle = c.fill;
    if (rising) ctx.fillRect(-1.2 * r, yLine, 2.4 * r, yBot - yLine);
    else ctx.fillRect(-1.2 * r, yTop, 2.4 * r, yLine - yTop);
    ctx.restore();
  }

  ctx.restore();
}

/* ----------------------------------------------------------- phase ring */
/* The discrete phase readout: N arcs, one per interval of the period, with
 * the copy's current interval lit. Sector k occupies turns [k/N, (k+1)/N)
 * measured CLOCKWISE FROM 12 O'CLOCK IN SCREEN COORDINATES — the ring is
 * never rotated or reflected with its copy. That is deliberate and is the
 * whole point: the same interval is then the same arc on every copy, so the
 * staircase of phases around a screw centre is legible at a glance instead of
 * having to be mentally un-rotated. The ring is therefore an annotation, not
 * part of the pattern: the pattern proper (comma + fill) is exactly
 * equivariant, and the pixel-level invariance checks switch the ring off
 * (orbit.js verifyFrames, enumerate/gifs.py render_frame).
 *
 * The lit arc ends in an ARROWHEAD giving the copy's DIRECTION OF TIME: its
 * internal clock is theta = s (t - tau), so d(theta)/dt = s, and the head
 * points the way the lit arc is about to move — clockwise where the copy is
 * filling, anticlockwise where a time reversal has it draining. This is the
 * one thing a frozen frame genuinely cannot show, which is why it is drawn
 * rather than left to the motion; note it is a velocity, so it is invariant
 * under the forward-time subgroup only. Under a time-reversing element the
 * film must also be played backwards — and playing a film backwards reverses
 * every arrow in it, so the symmetry still holds where it is claimed to. */
const RING_MID = 0.76;    // ring centreline, in units of the motif radius
const RING_W = 0.12;      // ring stroke width; the ring's outer edge at
                          // 0.82 r is the motif's whole footprint, which
                          // _setupGeometry keeps clear of its neighbours

/* below this the ring is fewer pixels across than its own stroke and reads as
 * a smudge, so the densest groups on the smallest thumbnails simply do not
 * get one; the comma's fill still carries the phase there */
const RING_MIN_PX = 6.5;

/* the arrowhead needs a few pixels of its own before it stops being a blot */
const ARROW_MIN_PX = 9;
const HEAD_LEN = 1.7;     // arrowhead length, in ring stroke widths
const HEAD_HALF = 1.15;   // half its base width, likewise

export function drawPhaseRing(ctx, theta, r, n, dir, colors) {
  if (r < RING_MIN_PX) return;
  const c = colors || MOTIF_COLORS;
  // A group with a single interval is always in interval 0, so sector 0 is
  // lit and carries the arrowhead like any other: every diagram on the site
  // then shows the direction the loop runs, and the absence of an arrow means
  // "too small to draw one", never "this group is special". Such a ring is
  // held back to the unlit weight so a constant is reported, not shouted.
  const solo = n === 1;
  const lit = n > 1 ? beatOf(theta, n) : 0;
  const gap = Math.min(0.125 / n, 0.022) * TWO_PI;   // ~1/8 of a sector
  const R = RING_MID * r;
  const lw = Math.max(1.1, RING_W * r);
  const s = dir < 0 ? -1 : 1;
  ctx.save();
  ctx.lineWidth = lw;
  ctx.lineCap = "butt";
  for (let k = 0; k < n; k++) {
    let a0 = -Math.PI / 2 + (k / n) * TWO_PI + gap;
    let a1 = -Math.PI / 2 + ((k + 1) / n) * TWO_PI - gap;
    // the unlit arcs only have to show where the intervals are; they are held
    // well back so the ring reads as a readout on the pattern, not as pattern
    ctx.globalAlpha = solo ? 0.55 : (k === lit ? 1 : 0.4);
    ctx.strokeStyle = (k === lit && !solo) ? c.beatOn : c.beatOff;
    const head = k === lit && r >= ARROW_MIN_PX
      ? Math.min((HEAD_LEN * lw) / R, 0.4 * (a1 - a0)) : 0;
    // the head is carved OUT of the lit arc, never added past it, so the arc
    // plus its point still fits inside the interval it is reporting
    if (head > 0) { if (s > 0) a1 -= head; else a0 += head; }
    ctx.beginPath();
    ctx.arc(0, 0, R, a0, a1);
    ctx.stroke();
    if (head > 0) {
      const base = s > 0 ? a1 : a0, tip = base + s * head;
      const at = (ang, rad) => [rad * Math.cos(ang), rad * Math.sin(ang)];
      const [bx1, by1] = at(base, R - HEAD_HALF * lw);
      const [bx2, by2] = at(base, R + HEAD_HALF * lw);
      const [tx, ty] = at(tip, R);
      ctx.beginPath();
      ctx.moveTo(bx1, by1);
      ctx.lineTo(bx2, by2);
      ctx.lineTo(tx, ty);
      ctx.closePath();
      ctx.fillStyle = solo ? c.beatOff : c.beatOn;
      ctx.fill();
    }
  }
  ctx.restore();
}

export const MOTIF_COLORS = {
  body: "#dbe6f2",
  outline: "#7d93ab",
  fill: "#3b6ea5",
  beatOn: "#c0392b",
  beatOff: "#b3aa96",
};

/* --------------------------------------------------------- group drawing */
export class FilmGroupAnimation extends Playback {
  constructor(canvas, spec, opts = {}) {
    super(opts);   // playback state, paused until the viewer presses play
    this.canvas = canvas;
    this.spec = spec;
    this.cellOverride = opts.cell || null; // explicit px-per-cell (tests only)
    this.cell = this.cellOverride || 64;   // else derived in _setupGeometry
    // the phase ring needs a few more pixels than the bare comma did
    this.minMotifPx = opts.minMotifPx || 13;  // upscale cell if motifs smaller
    this.showOverlay = opts.showOverlay || false;
    this.showPhase = opts.showPhase !== false;   // the phase-ring readout
    // the group's time structure: N intervals, and the marks the scrub bar
    // offers as jump targets (controls.js)
    this.timeSym = filmTimeSymmetry(spec);
    this.beats = this.timeSym.n;
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

  /* copies per cell, counted by distinct SPATIAL action: a reversal partner
   * shares its site with its forward twin and is drawn superimposed on it */
  _nSites() {
    if (this._nSitesCache === undefined) {
      const f = x => ((x % 1) + 1) % 1;
      this._nSitesCache = new Set(this.spec.ops.map(op =>
        op.M.flat().join(",") + "|" +
        op.v.map(x => Math.round(f(x) * 1e6)).join(","))).size;
    }
    return this._nSitesCache;
  }

  _setupGeometry() {
    const dpr = window.devicePixelRatio || 1;
    const canvas = this.canvas;
    const w = canvas.clientWidth || 220, h = canvas.clientHeight || 220;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    this.w = w; this.h = h; this.dpr = dpr;
    // UNIFORM CELL SPACING: size the cell so the diagram shows a fixed number
    // of translation repeats across the canvas's SHORT side, exactly as the
    // standard wallpaper plates do (MathWorld's show three to five unit cells
    // in each direction). Tying the cell to the short side keeps the spacing
    // ISOTROPIC: a wide canvas shows more columns instead of a stretched
    // cell, which is what previously left a couple of rows adrift in a sea of
    // background.
    // `_cellFor(k)` is the cell size that fits k repeats on the short side;
    // the dense-cell rescale below is capped with it, because a diagram
    // showing a cell and a half has stopped being a wallpaper.
    const B0 = this.spec.basis;
    // the cell's own extent along each axis, in units of `cell`, so a
    // non-square basis (centred rectangular, hexagonal) still shows CELLS
    // repeats rather than that many multiples of a stretched vector
    const minS = Math.min(w, h);
    const hs = minS === h ? Math.max(Math.abs(B0[0][1]), Math.abs(B0[1][1]))
                          : Math.max(Math.abs(B0[0][0]), Math.abs(B0[1][0]));
    this._cellFor = k => Math.max(minS / (k * (hs || 1)), 24);
    // How many MOTIFS a given cell puts across the canvas. A cell is one
    // repeat of the lattice but holds `nSites` copies, so on a dense group the
    // repeat count above says nothing about how crowded the picture actually
    // looks; this counts the copies. The array is close to isotropic by
    // construction (optimize_aspect.py), so the mean spacing sqrt(area per
    // copy) is the column pitch.
    const bdet0 = Math.abs(B0[0][0] * B0[1][1] - B0[0][1] * B0[1][0]) || 1;
    this._columnsAt = (cell) =>
      w / Math.sqrt(bdet0 * cell * cell / this._nSites());
    // both adjustments below re-enter this method; neither may have its work
    // undone by the initial rule running again
    if (!this.cellOverride && !this._rescaled && !this._capped) {
      this.cell = this._cellFor(CELLS);
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
    // The phase ring is the motif's outermost part, at 0.82 r, so the copies
    // fill 2*0.82*0.55 = 0.90 of the distance to their nearest neighbour:
    // packed like a wallpaper plate, with a tenth of the spacing left as a
    // gap so no two rings ever touch (touching would make paint order — which
    // is not equivariant — visible). The first term caps a lone motif in a
    // sparse cell, where nothing else limits its size.
    this.motifR = Math.min(0.40 * Math.min(l1, l2), 0.52 * minD) *
                  (this.spec.motifScale || 1);
    // Dense groups: a cell holding a dozen sites — and mirror-related sites
    // sit close together by construction — gives motifs too small to read a
    // clock on, so the cell is scaled up. But only as far as MIN_CELLS
    // repeats: past that the diagram stops showing the lattice, which is the
    // failure the CELLS rule above exists to prevent. Below that bound the
    // motif simply is small; the group is dense.
    const minPx = this.minMotifPx || 13;
    if (!this._rescaled && !this.cellOverride &&
        this.motifR > 0 && this.motifR < minPx) {
      this._rescaled = true;
      // never below what is already set: the column cap may have got here
      // first, and its ceiling is the one that must survive
      this.cell = Math.max(this.cell,
                           Math.min(this.cell * (minPx / this.motifR),
                                    this._cellFor(MIN_CELLS)));
      this._setupGeometry();
      return;
    }
    // COLUMN CAP, applied last and unconditionally so that it always holds: a
    // wide canvas over a group with a dozen copies per cell would otherwise
    // run to thirty motifs across, which reads as texture rather than as a
    // pattern one can follow copy by copy. Everything above only ever raises
    // the cell, and so does this, so the three rules do not fight.
    if (!this._capped && !this.cellOverride) {
      const cols = this._columnsAt(this.cell);
      if (cols > MAX_COLUMNS) {
        this._capped = true;
        this.cell *= cols / MAX_COLUMNS;
        this._setupGeometry();
        return;
      }
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
    for (const layer of ["body", "fill"]) {
      for (const [pl, px, py, Mpx] of visible) {
        const theta = pl.s * (t - pl.tau);
        ctx.save();
        ctx.translate(px, py);
        ctx.transform(Mpx[0][0], Mpx[1][0], Mpx[0][1], Mpx[1][1], 0, 0);
        drawMotif(ctx, theta, this.motifR, null, layer);
        ctx.restore();
      }
    }
    // the phase readout, in SCREEN coordinates: translated to the copy but
    // never rotated or reflected by it, so one interval is one arc everywhere
    if (this.showPhase) {
      for (const [pl, px, py] of visible) {
        ctx.save();
        ctx.translate(px, py);
        drawPhaseRing(ctx, pl.s * (t - pl.tau), this.motifR, this.beats, pl.s);
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
