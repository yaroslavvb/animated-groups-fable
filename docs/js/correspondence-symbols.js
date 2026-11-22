/* Animated figures for correspondence-symbols.html.
 *
 * Every mark on a correspondence plate stands for one symmetry of a polar
 * crystal: an isometry of the plane across the polar axis together with a rise
 * along it.  Each card on the page names one mark (data-symbol) and this
 * module draws two linked views of what the operation does:
 *
 *   crystal   one period of the crystal, polar axis up, in parallel projection
 *             (drag to turn it);
 *   plate     the same scene seen down the axis, which is the colour plate:
 *             colour = height (drag the ringed tile to move the motif).
 *
 * The tiles are the copies of one motif under the operation and the lattice
 * period; the dark-outlined tile is carried by the operation from one copy to
 * the next.  The geometry (orbit, motion) is in pure functions so that
 * tools/check_symbol_guide.mjs can test it without a browser.
 */

const TAU = Math.PI * 2;

/* The plates' colour order: one colour per height class. */
export const PALETTE = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#D55E00", "#56B4E9"];
const INK = "#74213f";        // the plates' generator ink
const PLATE = "#f7f4ec";      // the plates' ground
const DARK = "#1f2430";

/* World units.  One lattice period along the polar axis is ZS tall. */
const ZS = 1.75;
const TILE = 0.34;
/* The motif: a chiral tile with an eye, so a reflection shows. */
const TILE_POLY = [
  [-0.95, -0.5], [0.3, -0.86], [1.0, -0.16], [0.28, 0.08], [0.56, 0.8], [-0.62, 0.72],
].map(([u, v]) => [u * TILE, v * TILE]);
const EYE = [0.36 * TILE, -0.4 * TILE];
const GLYPH_K = 1 / 60;       // world units per plate unit of the symbol geometry

const AXIS_FLOOR = 1.6;       // radius of the round floor under an axis
const AXIS_REACH = 1.18;      // how far from the axis the motif may be dragged
const PLANE_FLOOR = { x: 1.5, y: 2.0 };
const PLANE_HALF = 0.85;      // b/2: half the repeat along the plane's line
const SHIFT_FLOOR = { x: 2.15, y: 1.4 };
const SHIFT = [1.06, 0.28];   // the lattice translation of the translation card
const MARGIN = 0.4;           // keeps tiles on the floor
const REPEAT_ALPHA = 0.5;     // the copies at height c, where the crystal repeats

const FRACTION_GLYPHS = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾", "1/6": "⅙", "5/6": "⅚",
};

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function mod(a, n) {
  return ((a % n) + n) % n;
}

/** "¼" for 1/4, "0" for 0, "1" for a whole period. */
export function fractionLabel(num, den) {
  if (num === 0) return "0";
  if (num === den) return "1";
  const g = gcd(num, den);
  const key = `${num / g}/${den / g}`;
  return FRACTION_GLYPHS[key] || key;
}

/** "c/4", "2c/3", "0": a rise written as a multiple of the period c. */
export function riseLabel(num, den) {
  if (num === 0) return "0";
  const g = gcd(num, den);
  const [p, q] = [num / g, den / g];
  if (q === 1) return p === 1 ? "c" : `${p}c`;
  return `${p === 1 ? "" : p}c/${q}`;
}

/* --- the operations --------------------------------------------------------
 * Heights are exact: a numerator over the denominator D of the symbol.
 *   axis    turn by 360°/n about the origin, rise m/n
 *   plane   reflection in the plane x = 0, then `slide` half-repeats along y
 *           and a rise of rise/D
 *   shift   a lattice translation across the axis, no rise
 */
export function specFor(id) {
  if (id === "translation") {
    return { id, kind: "shift", D: 1, rise: 0, levels: 1 };
  }
  const axis = /^rotation-(\d)-(\d)$/.exec(id || "");
  if (axis) {
    const n = Number(axis[1]);
    const m = Number(axis[2]);
    return { id, kind: "axis", n, m, D: n, rise: m, levels: m ? n / gcd(n, m) : 1 };
  }
  const plane = {
    "plane-m": [0, 0, 1],
    "plane-axial": [1, 0, 1],
    "plane-c": [0, 1, 2],
    "plane-n": [1, 1, 2],
    "plane-d": [1, 1, 4],
  }[id];
  if (plane) {
    return { id, kind: "plane", slide: plane[0], rise: plane[1], D: plane[2], levels: plane[2] };
  }
  return null;
}

/** The rise numerator of one step taken in the sense `dir` (+1 counter-clockwise). */
export function riseOf(spec, dir = 1) {
  if (spec.kind !== "axis") return spec.rise;
  return dir > 0 ? spec.m : mod(-spec.m, spec.n);
}

/** The sense of turn a screw's figure starts with: the one that rises less,
 *  which is also how the plates' legends describe the mark (a 3_2 axis as a
 *  clockwise colour rotation).  Counter-clockwise on a tie. */
export function defaultSense(spec) {
  return spec.kind === "axis" && 2 * spec.m > spec.n ? -1 : 1;
}

export function levelOf(spec, h) {
  return (mod(h, spec.D) * spec.levels) / spec.D;
}

export function defaultSeed(spec) {
  const turn = (a) => [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a)];
  if (spec.kind === "axis") {
    const a = -0.72;
    return { x: 0.98 * Math.cos(a), y: 0.98 * Math.sin(a), m: turn(0.35) };
  }
  if (spec.kind === "plane") return { x: 0.74, y: -1.3, m: turn(0.5) };
  return { x: -1.6, y: -0.46, m: turn(0.2) };
}

export function clampSeed(spec, seed) {
  let { x, y } = seed;
  if (spec.kind === "axis") {
    const r = Math.hypot(x, y);
    if (r > AXIS_REACH) [x, y] = [(x * AXIS_REACH) / r, (y * AXIS_REACH) / r];
  } else {
    const floor = spec.kind === "plane" ? PLANE_FLOOR : SHIFT_FLOOR;
    x = Math.max(-(floor.x - MARGIN), Math.min(floor.x - MARGIN, x));
    y = Math.max(-(floor.y - MARGIN), Math.min(floor.y - MARGIN, y));
  }
  return { ...seed, x, y };
}

/** The steps k of the motif that fit on the floor (rows only). */
export function stepRange(spec, seed) {
  if (spec.kind === "axis") return [0, spec.n - 1];
  if (spec.kind === "plane") {
    if (!spec.slide) return [0, 1];
    const limit = PLANE_FLOOR.y - MARGIN + 1e-9;
    return [Math.ceil((-limit - seed.y) / PLANE_HALF), Math.floor((limit - seed.y) / PLANE_HALF)];
  }
  const lo = [];
  const hi = [];
  for (const [value, step, limit] of [
    [seed.x, SHIFT[0], SHIFT_FLOOR.x - MARGIN + 1e-9],
    [seed.y, SHIFT[1], SHIFT_FLOOR.y - MARGIN + 1e-9],
  ]) {
    lo.push(Math.ceil((-limit - value) / step));
    hi.push(Math.floor((limit - value) / step));
  }
  return [Math.max(...lo), Math.min(...hi)];
}

/** g^k applied to the seed: where it is, how it is turned, and its height
 *  as a numerator h over D, reduced into one period. */
export function basePose(spec, seed, k, dir = 1) {
  const [a, b, c, d] = seed.m;
  if (spec.kind === "axis") {
    const t = (dir * k * TAU) / spec.n;
    const [cs, sn] = [Math.cos(t), Math.sin(t)];
    return {
      x: cs * seed.x - sn * seed.y,
      y: sn * seed.x + cs * seed.y,
      m: [cs * a - sn * c, cs * b - sn * d, sn * a + cs * c, sn * b + cs * d],
      h: mod(k * riseOf(spec, dir), spec.D),
    };
  }
  if (spec.kind === "plane") {
    const q = mod(k, 2) ? -1 : 1;
    return {
      x: q * seed.x,
      y: seed.y + k * spec.slide * PLANE_HALF,
      m: [q * a, q * b, c, d],
      h: mod(k * spec.rise, spec.D),
    };
  }
  return { x: seed.x + k * SHIFT[0], y: seed.y + k * SHIFT[1], m: seed.m, h: 0 };
}

/** Every copy of the motif drawn in the figure: the orbit of the seed under
 *  the operation and the lattice, inside one period (the copies at height 0
 *  appear again at height 1, where the crystal repeats). */
export function staticCopies(spec, seed) {
  const copies = [];
  const add = (pose) => {
    const level = levelOf(spec, pose.h);
    copies.push({ ...pose, z: pose.h / spec.D, level, top: false });
    if (pose.h === 0) copies.push({ ...pose, z: 1, level, top: true });
  };
  if (spec.kind === "plane" && !spec.slide) {
    // The reflection has order two in the picture; the row is the lattice.
    const limit = PLANE_FLOOR.y - MARGIN + 1e-9;
    const repeat = 2 * PLANE_HALF;
    const from = Math.ceil((-limit - seed.y) / repeat);
    const to = Math.floor((limit - seed.y) / repeat);
    for (let j = from; j <= to; j += 1) {
      for (const k of [0, 1]) {
        const pose = basePose(spec, seed, k);
        add({ ...pose, y: pose.y + j * repeat });
      }
    }
    return copies;
  }
  const [from, to] = stepRange(spec, seed);
  for (let k = from; k <= to; k += 1) add(basePose(spec, seed, k));
  return copies;
}

function ease(t) {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

/** The motif part-way through one application of the operation, starting from
 *  `base`: u runs from 0 (at base) to 1 (at the next copy).  A reflection is
 *  shown by squashing the tile through its plane and a glide by the shift that
 *  follows; `ghost` is the bare mirror image, which a glide plane leaves empty.
 *  `lift` is the part of the rise done so far (0..1). */
export function stepMotion(spec, base, u, dir = 1) {
  const [a, b, c, d] = base.m;
  const z0 = base.h / spec.D;
  if (spec.kind === "axis") {
    const e = ease(u);
    const t = (dir * e * TAU) / spec.n;
    const [cs, sn] = [Math.cos(t), Math.sin(t)];
    return {
      x: cs * base.x - sn * base.y,
      y: sn * base.x + cs * base.y,
      m: [cs * a - sn * c, cs * b - sn * d, sn * a + cs * c, sn * b + cs * d],
      z: z0 + (e * riseOf(spec, dir)) / spec.D,
      lift: e,
      ghost: null,
    };
  }
  if (spec.kind === "plane") {
    const shifted = spec.slide || spec.rise;
    const flip = shifted ? ease(u / 0.44) : ease(u);
    const go = shifted ? ease((u - 0.56) / 0.44) : 0;
    const q = 1 - 2 * flip;
    const ghost = shifted && u > 0.4
      ? { x: -base.x, y: base.y, z: z0, m: [-a, -b, c, d], alpha: Math.min(1, (u - 0.4) / 0.06) * (1 - 0.75 * go) }
      : null;
    return {
      x: q * base.x,
      y: base.y + go * spec.slide * PLANE_HALF,
      m: [q * a, q * b, c, d],
      z: z0 + (go * spec.rise) / spec.D,
      lift: go,
      ghost,
    };
  }
  const e = ease(u);
  return { x: base.x + e * SHIFT[0], y: base.y + e * SHIFT[1], m: base.m, z: z0, lift: 0, ghost: null };
}

/** The thin guide lines: the continuous motion the copies lie on. */
export function rails(spec, seed, dir = 1) {
  const lines = [];
  if (spec.kind !== "axis") return lines;
  const r = Math.hypot(seed.x, seed.y);
  if (r < 0.08) return lines;
  const start = Math.atan2(seed.y, seed.x);
  const { n, m } = spec;
  if (!m) {
    for (const z of [0, 1]) {
      const ring = [];
      for (let i = 0; i <= 72; i += 1) {
        const t = start + (i * TAU) / 72;
        ring.push([r * Math.cos(t), r * Math.sin(t), z]);
      }
      lines.push(ring);
    }
    return lines;
  }
  // Follow the gentler of the two senses of turn (the chosen one on a tie).
  let sense = dir;
  let rise = riseOf(spec, dir);
  if (2 * rise > n) {
    sense = -dir;
    rise = n - rise;
  }
  for (let k = 0; k < n; k += 1) {
    if (mod(k * m, n) !== 0) continue;
    const helix = [];
    const samples = Math.max(24, Math.round((72 * n) / rise / n) * 2);
    for (let i = 0; i <= samples; i += 1) {
      const z = i / samples;
      const t = start + (k * TAU) / n + (sense * TAU * z) / rise;
      helix.push([r * Math.cos(t), r * Math.sin(t), z]);
    }
    lines.push(helix);
  }
  return lines;
}

/* --- colour ---------------------------------------------------------------- */
function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mix(hexA, hexB, t) {
  const [a, b] = [rgb(hexA), rgb(hexB)];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function shade(hex, t) {
  return mix(hex, "#000000", t);
}

function tint(hex, alpha) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* --- a view: parallel projection of the scene onto a canvas ---------------- */
class View {
  constructor(canvas, mode) {
    this.canvas = canvas;
    this.mode = mode;                 // "crystal" | "plate"
    this.ctx = canvas.getContext("2d");
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
  }

  /** Match the backing store to the laid-out size; true when it changed. */
  resize() {
    // the drawing surface is the box inside the border
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    if (w === this.w && h === this.h && dpr === this.dpr) return false;
    [this.w, this.h, this.dpr] = [w, h, dpr];
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    return true;
  }

  /** Fit the floor and one period into the canvas for this camera. */
  frame(spec, yaw, pitch) {
    const floor = spec.kind === "axis" ? null : spec.kind === "plane" ? PLANE_FLOOR : SHIFT_FLOOR;
    this.cosY = Math.cos(yaw);
    this.sinY = Math.sin(yaw);
    this.sp = Math.sin(pitch);
    this.cp = Math.cos(pitch);
    const pad = this.mode === "plate" ? 8 : 14;
    const availW = this.w - 2 * pad;
    const availH = this.h - 2 * pad;
    let halfW;
    let halfD;
    if (this.mode === "plate") {
      halfW = floor ? floor.x : AXIS_FLOOR;
      halfD = floor ? floor.y : AXIS_FLOOR;
    } else {
      // The bound does not depend on the yaw, so turning never rescales.
      halfW = floor ? Math.hypot(floor.x, floor.y) : AXIS_FLOOR;
      halfD = halfW;
    }
    const tall = 2 * halfD * this.sp + ZS * this.cp;
    this.s = Math.min(availW / (2 * halfW), availH / tall);
    this.cx = this.w / 2;
    this.cy = pad + (availH - this.s * tall) / 2 + this.s * (halfD * this.sp + ZS * this.cp);
    this.floor = floor;
  }

  /** World point to canvas pixels, with its depth (larger is farther). */
  project(x, y, z) {
    const xr = x * this.cosY - y * this.sinY;
    const yr = x * this.sinY + y * this.cosY;
    return [
      this.cx + this.s * xr,
      this.cy - this.s * (yr * this.sp + z * ZS * this.cp),
      yr * this.cp - z * ZS * this.sp,
    ];
  }

  /** The affine map of the horizontal plane at height z, as canvas matrix. */
  floorMatrix(z) {
    const { s, cosY, sinY, sp, cp } = this;
    return [s * cosY, -s * sinY * sp, -s * sinY, -s * cosY * sp, this.cx, this.cy - s * z * ZS * cp];
  }
}

function tilePath(ctx, view, pose, z, lift = 0) {
  ctx.beginPath();
  TILE_POLY.forEach(([u, v], i) => {
    const [X, Y] = view.project(pose.x + pose.m[0] * u + pose.m[1] * v, pose.y + pose.m[2] * u + pose.m[3] * v, z);
    if (i) ctx.lineTo(X, Y + lift);
    else ctx.moveTo(X, Y + lift);
  });
  ctx.closePath();
}

function drawTile(ctx, view, pose, z, fill, options = {}) {
  const { alpha = 1, bold = false, slab = true } = options;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  if (slab && view.cp > 0.05) {
    // a hint of thickness: the same outline a few pixels lower, darker
    tilePath(ctx, view, pose, z, 2.5 * view.cp);
    ctx.fillStyle = shade(fill, 0.38);
    ctx.fill();
    ctx.strokeStyle = shade(fill, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  tilePath(ctx, view, pose, z);
  if (bold) {
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 5.5;
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = bold ? "#0c0e13" : DARK;
  ctx.lineWidth = bold ? 2.4 : 1.1;
  ctx.stroke();
  const [ex, ey] = view.project(
    pose.x + pose.m[0] * EYE[0] + pose.m[1] * EYE[1],
    pose.y + pose.m[2] * EYE[0] + pose.m[3] * EYE[1],
    z,
  );
  const r = Math.max(1.5, view.s * 0.03);
  ctx.beginPath();
  ctx.ellipse(ex, ey, r, r * (0.4 + 0.6 * view.sp), 0, 0, TAU);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = DARK;
  ctx.stroke();
  ctx.restore();
}

function polyline(ctx, points) {
  ctx.beginPath();
  points.forEach(([X, Y], i) => (i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)));
}

const PLANE_DASH = {
  "plane-m": { width: 2.2, dash: [] },
  "plane-axial": { width: 2.2, dash: [12, 8] },
  "plane-c": { width: 3.4, dash: [0, 8] },
  "plane-n": { width: 2.2, dash: [12, 6.5, 0, 6.5] },
  "plane-d": { width: 2.2, dash: [12, 6.5, 0, 6.5] },
};

/** The mark itself, lying on the floor where the plate has it. */
function drawMark(ctx, view, figure) {
  const { spec } = figure;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (spec.kind === "axis") {
    const [a, b, c, d, e, f] = view.floorMatrix(0);
    const dpr = view.dpr;
    ctx.setTransform(dpr * a, dpr * b, dpr * c, dpr * d, dpr * e, dpr * f);
    ctx.scale(GLYPH_K, -GLYPH_K);
    ctx.lineWidth = 5 / (view.s * GLYPH_K);
    ctx.strokeStyle = PLATE;
    ctx.stroke(figure.glyph);
    ctx.fillStyle = INK;
    ctx.fill(figure.glyph, "nonzero");
    ctx.restore();
    return;
  }
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  if (spec.kind === "plane") {
    const reach = PLANE_FLOOR.y - 0.1;
    const style = PLANE_DASH[spec.id];
    const [x0, y0] = view.project(0, -reach, 0);
    const [x1, y1] = view.project(0, reach, 0);
    ctx.lineWidth = style.width;
    ctx.setLineDash(style.dash);
    polyline(ctx, [[x0, y0], [x1, y1]]);
    ctx.stroke();
    ctx.setLineDash([]);
    const k = GLYPH_K;
    const at = (x, y) => view.project(x, y, 0).slice(0, 2);
    if (spec.id === "plane-axial" || spec.id === "plane-n") {
      // the half arrow of the plates: which way the generator steps
      ctx.lineWidth = 2.1;
      ctx.strokeStyle = PLATE;
      ctx.lineWidth = 5.2;
      polyline(ctx, [at(0, -17 * k), at(0, 17 * k)]);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.1;
      polyline(ctx, [at(0, -17 * k), at(0, 17 * k)]);
      ctx.stroke();
      polyline(ctx, [at(0, 17 * k), at(0, 2 * k), at(9 * k, 2 * k)]);
      ctx.closePath();
      ctx.fill();
    }
    if (spec.id === "plane-d") {
      ctx.lineWidth = 2.35;
      for (const y of [-0.42, 0.42]) {
        polyline(ctx, [at(-4.2 * k, y - 5 * k), at(0, y + 5 * k), at(4.2 * k, y - 5 * k)]);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }
  // translation: the open arrow, laid beside the row it carries along
  const { seed } = figure.state;
  const length = Math.hypot(SHIFT[0], SHIFT[1]);
  const [ux, uy] = [SHIFT[0] / length, SHIFT[1] / length];
  const [ox, oy] = [seed.x + 0.62 * uy, seed.y - 0.62 * ux];
  const at = (t, side) => view.project(ox + t * ux - side * uy, oy + t * uy + side * ux, 0).slice(0, 2);
  ctx.lineWidth = 2.2;
  polyline(ctx, [at(0, 0), at(length, 0)]);
  ctx.stroke();
  polyline(ctx, [at(length - 0.2, 0.1), at(length, 0), at(length - 0.2, -0.1)]);
  ctx.stroke();
  ctx.restore();
}

function drawFloor(ctx, view, figure) {
  const { spec } = figure;
  const plate = view.mode === "plate";
  ctx.save();
  if (spec.kind === "axis") {
    const [X, Y] = view.project(0, 0, 0);
    const [rx, ry] = [view.s * AXIS_FLOOR, view.s * AXIS_FLOOR * view.sp];
    if (!plate) {
      ctx.beginPath();
      ctx.ellipse(X, Y + 4 * view.cp, rx, ry, 0, 0, TAU);
      ctx.fillStyle = "#e3ddcd";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(X, Y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = PLATE;
    ctx.fill();
    ctx.strokeStyle = "#d3ccba";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!plate && view.cp > 0.04) {
      // one period: a dashed ring where the crystal repeats, and the sides
      const top = view.project(0, 0, 1)[1];
      ctx.strokeStyle = "#c6c8cd";
      ctx.beginPath();
      ctx.moveTo(X - rx, Y);
      ctx.lineTo(X - rx, top);
      ctx.moveTo(X + rx, Y);
      ctx.lineTo(X + rx, top);
      ctx.stroke();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#a9adb5";
      ctx.beginPath();
      ctx.ellipse(X, top, rx, ry, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const floor = view.floor;
  const corners = [[-floor.x, -floor.y], [floor.x, -floor.y], [floor.x, floor.y], [-floor.x, floor.y]];
  const ring = (z, lift = 0) => corners.map(([x, y]) => {
    const [X, Y] = view.project(x, y, z);
    return [X, Y + lift];
  });
  if (!plate) {
    polyline(ctx, ring(0, 4 * view.cp));
    ctx.closePath();
    ctx.fillStyle = "#e3ddcd";
    ctx.fill();
  }
  polyline(ctx, ring(0));
  ctx.closePath();
  ctx.fillStyle = PLATE;
  ctx.fill();
  ctx.strokeStyle = "#d3ccba";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (!plate && view.cp > 0.04) {
    const [low, high] = [ring(0), ring(1)];
    ctx.strokeStyle = "#c6c8cd";
    ctx.beginPath();
    low.forEach(([X, Y], i) => {
      ctx.moveTo(X, Y);
      ctx.lineTo(high[i][0], high[i][1]);
    });
    ctx.stroke();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#a9adb5";
    polyline(ctx, high);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

/** Every tile that moves in this frame.  Normally that is the one tracked
 *  tile; with `everything` it is every copy, so the whole crystal is seen to
 *  land on itself.  Each mover has its pose part-way through the step, the
 *  heights at which it shows inside the period box, and its colour. */
export function movers(spec, state) {
  const { seed, dir, u } = state;
  const list = [];
  const rise = riseOf(spec, dir);
  const add = (base, tracked, presence) => {
    const pose = stepMotion(spec, base, u, dir);
    const from = PALETTE[levelOf(spec, base.h)];
    const to = PALETTE[levelOf(spec, base.h + rise)];
    // the colour is the height: it changes as the tile passes half-way up
    const colour = mix(from, to, ease((pose.lift - 0.42) / 0.16));
    const images = [];
    for (const j of [-1, 0, 1]) {
      const z = pose.z + j;
      if (z < -1e-6 || z > 1.12) continue;
      let fade = z > 1 ? Math.max(0, 1 - (z - 1) / 0.12) : 1;
      // an image that started below the floor comes up through it
      if (base.h / spec.D + j < -1e-6) fade *= Math.min(1, z / 0.1);
      images.push({ z, alpha: fade * presence });
    }
    list.push({ base, pose, colour, images, tracked, presence });
  };
  const tracked = basePose(spec, seed, state.k, dir);
  add(tracked, true, state.presence);
  if (!state.everything) return list;

  if (spec.kind === "axis") {
    for (let k = 0; k < spec.n; k += 1) {
      if (k !== mod(state.k, spec.n)) add(basePose(spec, seed, k, dir), false, 1);
    }
    return list;
  }
  if (spec.kind === "plane" && !spec.slide) {
    for (const copy of staticCopies(spec, seed)) {
      if (copy.top) continue;
      if (Math.abs(copy.y - tracked.y) < 1e-9 && Math.abs(copy.x - tracked.x) < 1e-9) continue;
      add(copy, false, 1);
    }
    return list;
  }
  // a row: one more tile comes in at the near end as the last one leaves
  const [from, to] = stepRange(spec, seed);
  for (let k = from - 1; k <= to; k += 1) {
    if (k === state.k) continue;
    const base = basePose(spec, seed, k, dir);
    const pose = stepMotion(spec, base, u, dir);
    add(base, false, onFloor(spec, pose));
  }
  // the tracked tile fades with the floor too while it leaves
  list[0].presence = Math.min(list[0].presence, onFloor(spec, list[0].pose));
  for (const image of list[0].images) image.alpha = Math.min(image.alpha, list[0].presence);
  return list;
}

/** 1 on the floor, falling to 0 a little way beyond the last copy of a row. */
function onFloor(spec, pose) {
  const floor = spec.kind === "plane" ? PLANE_FLOOR : SHIFT_FLOOR;
  const over = Math.max(
    Math.abs(pose.x) - (floor.x - MARGIN),
    Math.abs(pose.y) - (floor.y - MARGIN),
    0,
  );
  return Math.max(0, 1 - over / 0.5);
}

/** Draw one view of a figure from its current state. */
function render(view, figure) {
  const { spec, state } = figure;
  const { ctx } = view;
  const plate = view.mode === "plate";
  const yaw = plate ? 0 : state.yaw;
  const pitch = plate ? Math.PI / 2 : state.pitch;
  view.frame(spec, yaw, pitch);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const seed = state.seed;
  const copies = staticCopies(spec, seed);
  const moving = movers(spec, state);
  const everything = state.everything;
  const flat = plate || view.cp < 0.04;      // seen straight down the axis

  drawFloor(ctx, view, figure);

  /* footprints: what the plate keeps of the tiles above the floor.  When
     every tile moves they also mark the places the tiles come back to. */
  if (!plate || everything) {
    const seen = new Set();
    for (const copy of copies) {
      const key = `${copy.x.toFixed(3)},${copy.y.toFixed(3)}`;
      if (seen.has(key)) continue;
      if (copy.z < 1e-6 && !everything) continue;
      if (flat && !everything) continue;
      seen.add(key);
      tilePath(ctx, view, copy, 0);
      ctx.fillStyle = tint(PALETTE[copy.level], plate ? 0.16 : 0.22);
      ctx.fill();
    }
    if (!flat) {
      for (const mover of moving) {
        if (mover.presence <= 0 || mover.pose.z < 1e-6 || !mover.tracked) continue;
        tilePath(ctx, view, mover.pose, 0);
        ctx.fillStyle = `rgba(31,36,48,${0.2 * mover.presence})`;
        ctx.fill();
      }
    }
  }
  if (!plate) drawMark(ctx, view, figure);

  /* painter's list: far things first */
  const items = [];
  const side = (x) => {
    // for a plane: which face of the sheet the thing is on, far face first
    if (spec.kind !== "plane" || plate) return 0;
    if (Math.abs(x) < 1e-3) return 1;
    return x * -view.sinY > 0 ? 2 : -1;
  };
  const push = (x, y, z, draw, bias = 0) => {
    const depth = view.project(x, y, z)[2];
    items.push({ group: side(x), depth: depth + bias, draw });
  };

  if (!plate) {
    for (const line of rails(spec, seed, state.dir)) {
      for (let i = 1; i < line.length; i += 1) {
        const [p, q] = [line[i - 1], line[i]];
        push((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, () => {
          const [a, b] = [view.project(...p), view.project(...q)];
          ctx.strokeStyle = "#b4b7be";
          ctx.lineWidth = 1.3;
          polyline(ctx, [a, b]);
          ctx.stroke();
        }, 0.02);
      }
    }
    const stem = (pose, z, alpha) => {
      if (z < 0.02 || alpha <= 0) return;
      push(pose.x, pose.y, z / 2, () => {
        const [a, b] = [view.project(pose.x, pose.y, 0), view.project(pose.x, pose.y, z)];
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "rgba(31,36,48,0.38)";
        ctx.lineWidth = 1;
        polyline(ctx, [a, b]);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(a[0], a[1], 1.6, 0, TAU);
        ctx.fillStyle = "rgba(31,36,48,0.5)";
        ctx.fill();
        ctx.restore();
      }, 0.01);
    };
    if (!everything) for (const copy of copies) stem(copy, copy.z, copy.top ? REPEAT_ALPHA : 1);
    for (const mover of moving) {
      for (const image of mover.images) stem(mover.pose, image.z, image.alpha);
    }

    // the element itself: an axis with a bead at every height, or a sheet
    const ruler = (x, y) => {
      const count = 24;
      for (let i = 0; i < count; i += 1) {
        const [z0, z1] = [(i / count) * 1.1 - 0.04, ((i + 1) / count) * 1.1 - 0.04];
        push(x, y, (z0 + z1) / 2, () => {
          polyline(ctx, [view.project(x, y, z0), view.project(x, y, z1)]);
          ctx.strokeStyle = INK;
          ctx.lineWidth = spec.kind === "axis" ? 2.2 : 1.4;
          ctx.stroke();
        });
      }
      if (view.cp < 0.3) return;
      for (let level = 0; level <= spec.levels; level += 1) {
        const z = level / spec.levels;
        push(x, y, z, () => {
          const [X, Y] = view.project(x, y, z);
          ctx.beginPath();
          ctx.arc(X, Y, 4.2, 0, TAU);
          ctx.fillStyle = PALETTE[level % spec.levels];
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.font = "600 11px ui-sans-serif, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          const text = fractionLabel(level, spec.levels);
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.strokeText(text, X + 8, Y);
          ctx.fillStyle = DARK;
          ctx.fillText(text, X + 8, Y);
        }, -0.02);
      }
    };
    if (spec.kind === "axis") ruler(0, 0);
    if (spec.kind === "plane") {
      const reach = PLANE_FLOOR.y - 0.1;
      items.push({
        group: 1,
        depth: 0,
        draw: () => {
          polyline(ctx, [[0, -reach, 0], [0, reach, 0], [0, reach, 1], [0, -reach, 1]].map((p) => view.project(...p)));
          ctx.closePath();
          ctx.fillStyle = tint(INK, 0.075);
          ctx.fill();
          ctx.strokeStyle = tint(INK, 0.4);
          ctx.lineWidth = 1;
          ctx.stroke();
        },
      });
      ruler(0, view.cosY >= 0 ? -reach : reach);
    }
    if (spec.kind === "shift") ruler(-SHIFT_FLOOR.x, SHIFT_FLOOR.y);
  }

  if (!everything) {
    for (const copy of copies) {
      if (plate && copy.top) continue;        // the same footprint as the tile it repeats
      push(copy.x, copy.y, copy.z, () => {
        drawTile(ctx, view, copy, copy.z, PALETTE[copy.level], { slab: !plate, alpha: copy.top ? REPEAT_ALPHA : 1 });
      });
    }
  }
  // On the plate the moving tiles are an annotation: always on top.
  const lifted = plate ? -100 : 0;
  for (const mover of moving) {
    const { pose } = mover;
    if (pose.ghost && mover.presence > 0 && mover.tracked) {
      const ghost = pose.ghost;
      push(ghost.x, ghost.y, ghost.z, () => {
        ctx.save();
        ctx.globalAlpha = ghost.alpha * mover.presence;
        ctx.setLineDash([4, 4]);
        tilePath(ctx, view, ghost, ghost.z);
        ctx.strokeStyle = DARK;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }, -0.03 + lifted);
    }
    const images = plate ? mover.images.slice(0, 1) : mover.images;
    for (const image of images) {
      const alpha = plate ? mover.presence : image.alpha;
      if (alpha <= 0) continue;
      push(pose.x, pose.y, image.z, () => {
        drawTile(ctx, view, pose, image.z, mover.colour, { alpha, bold: mover.tracked, slab: !plate });
      }, (mover.tracked ? -0.04 : 0) + lifted + (plate && mover.tracked ? -100 : 0));
    }
  }
  items.sort((p, q) => p.group - q.group || q.depth - p.depth);
  for (const item of items) item.draw();
  if (plate) drawMark(ctx, view, figure);

  /* the path of this step, on top */
  const lead = moving[0];
  if (lead.presence > 0 && state.u < 1) {
    const samples = [];
    for (let i = 0; i <= 28; i += 1) {
      const pose = stepMotion(spec, lead.base, i / 28, state.dir);
      samples.push([pose.x, pose.y, pose.z]);
    }
    for (const image of lead.images) {
      const shift = image.z - lead.pose.z;
      const points = samples
        .map(([x, y, z]) => [x, y, z + shift])
        .filter(([, , z]) => plate || (z >= -1e-6 && z <= 1.12))
        .map((p) => view.project(...p));
      if (points.length < 2) continue;
      const [tip, before] = [points[points.length - 1], points[points.length - 2]];
      if (Math.hypot(tip[0] - points[0][0], tip[1] - points[0][1]) < 6) continue;
      ctx.save();
      ctx.globalAlpha = 0.72 * (plate ? lead.presence : image.alpha);
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([2, 4]);
      polyline(ctx, points);
      ctx.stroke();
      ctx.setLineDash([]);
      const angle = Math.atan2(tip[1] - before[1], tip[0] - before[0]);
      ctx.translate(tip[0], tip[1]);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(-8, 4);
      ctx.lineTo(-8, -4);
      ctx.closePath();
      ctx.fillStyle = DARK;
      ctx.fill();
      ctx.restore();
      if (plate) break;
    }
  }

  if (plate) {
    /* heights beside the tiles, as the Tables print them, and the grab ring */
    if (spec.levels > 1) {
      ctx.font = "650 12px ui-sans-serif, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const seen = new Set();
      for (const copy of copies) {
        const key = `${copy.x.toFixed(3)},${copy.y.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let [dx, dy] = spec.kind === "axis" ? [copy.x, copy.y] : [copy.x, 0];
        const length = Math.hypot(dx, dy);
        [dx, dy] = length > 0.05 ? [dx / length, dy / length] : [0.7, 0.7];
        const [X, Y] = view.project(copy.x + dx * 0.5, copy.y + dy * 0.5, 0);
        const text = fractionLabel(copy.h, spec.D);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = PLATE;
        ctx.strokeText(text, X, Y);
        ctx.fillStyle = shade(PALETTE[copy.level], 0.35);
        ctx.fillText(text, X, Y);
      }
    }
    const [X, Y] = view.project(seed.x, seed.y, 0);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(31,36,48,0.55)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(X, Y, view.s * 0.47, 0, TAU);
    ctx.stroke();
    ctx.restore();
    figure.seedAt = [X, Y];
  }
}

/* --- one figure: state, controls, pointer handling ------------------------- */
const figures = new Set();
let ticking = false;
let last = 0;
const reducedMotion = typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const DURATIONS = { axis: 1500, plane: 2300, mirror: 1300, shift: 1300, hold: 620, fade: 320 };

function defaultCamera(spec) {
  if (spec.kind === "axis") return { yaw: -0.3, pitch: 0.5 };
  if (spec.kind === "plane") return { yaw: 0.62, pitch: 0.5 };
  return { yaw: -0.36, pitch: 0.52 };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function build(host) {
  const spec = specFor(host.dataset.symbol);
  if (!spec) return null;
  const name = host.dataset.symbolName || "this symbol";
  const camera = defaultCamera(spec);
  const figure = {
    host,
    spec,
    glyph: spec.kind === "axis" ? new Path2D(host.dataset.glyphPath || "") : null,
    state: {
      seed: defaultSeed(spec),
      k: 0,
      u: 0,
      dir: defaultSense(spec),
      phase: "hold",
      clock: 0,
      presence: 1,
      playing: !reducedMotion,
      once: false,
      yaw: camera.yaw,
      pitch: camera.pitch,
      glide: null,
      topView: false,
      everything: false,
    },
    visible: false,
    dirty: true,
    seedAt: [0, 0],
  };

  host.textContent = "";
  const views = element("div", "symbol-views");

  const crystal = element("div", "symbol-view symbol-view--crystal");
  crystal.append(element("p", "symbol-view-title", "In the crystal"));
  const crystalCanvas = element("canvas", "symbol-canvas");
  crystalCanvas.setAttribute("role", "img");
  crystalCanvas.setAttribute("aria-label",
    `One period of a crystal, polar axis vertical: the copies of a tile under ${name}, and one tile carried from copy to copy.`);
  crystal.append(crystalCanvas);
  // On a touch screen an up-and-down swipe scrolls the page, so only the
  // sideways part of a drag turns the crystal.
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  crystal.append(element("p", "symbol-view-hint", coarse ? "Drag sideways to turn." : "Drag to turn."));

  const plate = element("div", "symbol-view symbol-view--plate");
  plate.append(element("p", "symbol-view-title", "On the plate"));
  const wrap = element("div", "symbol-plate-wrap");
  const plateCanvas = element("canvas", "symbol-canvas");
  plateCanvas.setAttribute("role", "img");
  plateCanvas.setAttribute("aria-label",
    `The same tiles seen down the polar axis, coloured by height, with the mark of ${name}.`);
  const handle = element("button", "symbol-seed");
  handle.type = "button";
  handle.setAttribute("aria-label", "The motif. Drag it, or use the arrow keys, to move it; every copy follows.");
  wrap.append(plateCanvas, handle);
  plate.append(wrap);
  plate.append(element("p", "symbol-view-hint", "Drag the ringed tile."));

  views.append(crystal, plate);

  const controls = element("div", "symbol-controls");
  const play = element("button", "symbol-button symbol-button--play");
  play.type = "button";
  const step = element("button", "symbol-button", "Step");
  step.type = "button";
  step.title = "Apply the operation once";
  const look = element("button", "symbol-button", "Look down the axis");
  look.type = "button";
  look.setAttribute("aria-pressed", "false");
  controls.append(play, step);

  let senses = null;
  if (spec.kind === "axis" && spec.m) {
    senses = element("span", "symbol-senses");
    senses.setAttribute("role", "group");
    senses.setAttribute("aria-label", "Sense of the turn");
    for (const dir of [1, -1]) {
      const button = element("button", "symbol-button symbol-sense");
      button.type = "button";
      button.dataset.dir = String(dir);
      const arrow = element("span", "symbol-sense-arrow", dir > 0 ? "↺" : "↻");
      arrow.setAttribute("aria-hidden", "true");
      button.append(arrow, ` rises ${riseLabel(riseOf(spec, dir), spec.D)}`);
      button.setAttribute("aria-label",
        `${dir > 0 ? "Counter-clockwise" : "Clockwise"} turn, rising ${riseLabel(riseOf(spec, dir), spec.D)}`);
      button.setAttribute("aria-pressed", String(dir === defaultSense(spec)));
      senses.append(button);
    }
    controls.append(senses);
  }
  const all = element("button", "symbol-button", "Move every tile");
  all.type = "button";
  all.title = "Carry every copy at once: the crystal lands on itself";
  all.setAttribute("aria-pressed", "false");
  controls.append(look, all);

  const legend = element("p", "symbol-legend");
  legend.append(element("span", "symbol-legend-label", spec.levels > 1 ? "Colour is height:" : "One height, one colour:"));
  for (let level = 0; level < spec.levels; level += 1) {
    const item = element("span", "symbol-legend-item");
    const swatch = element("i", "symbol-legend-swatch");
    swatch.style.background = PALETTE[level];
    item.append(swatch, spec.levels > 1 ? riseLabel(level, spec.levels) : "0");
    legend.append(item);
  }

  host.append(views, controls, legend);

  figure.views = [new View(crystalCanvas, "crystal"), new View(plateCanvas, "plate")];
  const { state } = figure;
  const touch = () => {
    figure.dirty = true;
    wake();
  };
  figure.refresh = touch;   // for the browser checks: repaint after setting state

  const syncPlay = () => {
    play.textContent = state.playing ? "Pause" : "Play";
  };
  syncPlay();
  play.addEventListener("click", () => {
    state.playing = !state.playing;
    state.once = false;
    syncPlay();
    touch();
  });
  step.addEventListener("click", () => {
    state.playing = false;
    state.once = true;
    if (state.phase === "hold") state.clock = DURATIONS.hold;
    syncPlay();
    touch();
  });
  senses?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-dir]") : null;
    if (!button) return;
    const dir = Number(button.dataset.dir);
    if (dir === state.dir) return;
    // keep the moving tile on the copy it has just reached
    const at = state.u >= 1 ? state.k + 1 : state.k;
    state.k = mod(-at, spec.n);
    state.dir = dir;
    state.u = 0;
    state.phase = "hold";
    state.clock = 0;
    for (const other of senses.querySelectorAll("[data-dir]")) {
      other.setAttribute("aria-pressed", String(Number(other.dataset.dir) === dir));
    }
    touch();
  });
  all.addEventListener("click", () => {
    state.everything = !state.everything;
    all.setAttribute("aria-pressed", String(state.everything));
    touch();
  });
  look.addEventListener("click", () => {
    state.topView = !state.topView;
    const target = state.topView ? { yaw: 0, pitch: Math.PI / 2 } : defaultCamera(spec);
    // turn the short way round
    let from = state.yaw % TAU;
    if (from - target.yaw > Math.PI) from -= TAU;
    if (from - target.yaw < -Math.PI) from += TAU;
    state.glide = { from: { yaw: from, pitch: state.pitch }, to: target, t: 0 };
    look.textContent = state.topView ? "Back to the side view" : "Look down the axis";
    look.setAttribute("aria-pressed", String(state.topView));
    touch();
  });

  /* turning the crystal */
  let turning = null;
  crystalCanvas.addEventListener("pointerdown", (event) => {
    if (event.button) return;
    turning = { x: event.clientX, y: event.clientY, yaw: state.yaw, pitch: state.pitch };
    state.glide = null;
    crystalCanvas.setPointerCapture(event.pointerId);
    crystalCanvas.classList.add("is-turning");
  });
  crystalCanvas.addEventListener("pointermove", (event) => {
    if (!turning) return;
    state.yaw = turning.yaw + (event.clientX - turning.x) * 0.009;
    state.pitch = Math.max(0.1, Math.min(Math.PI / 2, turning.pitch + (event.clientY - turning.y) * 0.007));
    touch();
  });
  const release = () => {
    turning = null;
    crystalCanvas.classList.remove("is-turning");
  };
  crystalCanvas.addEventListener("pointerup", release);
  crystalCanvas.addEventListener("pointercancel", release);

  /* moving the motif on the plate */
  const moveSeed = (x, y) => {
    state.seed = clampSeed(spec, { ...state.seed, x, y });
    const [from, to] = stepRange(spec, state.seed);
    if (spec.kind !== "axis" && !(spec.kind === "plane" && !spec.slide)) {
      state.k = Math.max(from, Math.min(to, state.k));
    }
    touch();
  };
  let dragging = null;
  handle.addEventListener("pointerdown", (event) => {
    if (event.button) return;
    dragging = { x: event.clientX, y: event.clientY, seed: state.seed };
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("is-dragging");
    event.preventDefault();
  });
  handle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const scale = figure.views[1].s || 1;
    moveSeed(
      dragging.seed.x + (event.clientX - dragging.x) / scale,
      dragging.seed.y - (event.clientY - dragging.y) / scale,
    );
  });
  const drop = () => {
    dragging = null;
    handle.classList.remove("is-dragging");
  };
  handle.addEventListener("pointerup", drop);
  handle.addEventListener("pointercancel", drop);
  handle.addEventListener("keydown", (event) => {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const stride = event.shiftKey ? 0.2 : 0.06;
    moveSeed(state.seed.x + move[0] * stride, state.seed.y + move[1] * stride);
  });
  figure.handle = handle;

  const resized = new ResizeObserver(touch);
  resized.observe(crystalCanvas);
  resized.observe(plateCanvas);
  return figure;
}

function advance(figure, dt) {
  const { spec, state } = figure;
  let changed = false;
  if (state.glide) {
    const g = state.glide;
    g.t = Math.min(1, g.t + dt / (reducedMotion ? 1 : 900));
    const e = ease(g.t);
    state.yaw = g.from.yaw + (g.to.yaw - g.from.yaw) * e;
    state.pitch = g.from.pitch + (g.to.pitch - g.from.pitch) * e;
    if (g.t >= 1) state.glide = null;
    changed = true;
  }
  if (!state.playing && !state.once) return changed;

  const row = spec.kind === "shift" || (spec.kind === "plane" && spec.slide);
  const [from, to] = stepRange(spec, state.seed);
  const duration = spec.kind === "axis"
    ? DURATIONS.axis * (2 * riseOf(spec, state.dir) > spec.n ? 1.25 : 1)
    : spec.kind === "shift" ? DURATIONS.shift
      : spec.slide || spec.rise ? DURATIONS.plane : DURATIONS.mirror;

  if (state.phase === "move") {
    state.u = Math.min(1, state.u + dt / duration);
    if (state.u >= 1) {
      state.phase = "hold";
      state.clock = 0;
      if (state.once) {
        // a single step ends resting on the new copy
        state.once = false;
        state.k += 1;
        state.u = 0;
        if (spec.kind === "axis") state.k = mod(state.k, spec.n);
        if (spec.kind === "plane" && !spec.slide) state.k = mod(state.k, 2 * spec.D);
      }
    }
    return true;
  }
  if (state.phase === "hold") {
    state.clock += dt;
    if (state.clock < DURATIONS.hold) return changed;
    if (state.u >= 1) {
      state.k += 1;
      state.u = 0;
      if (spec.kind === "axis") state.k = mod(state.k, spec.n);
      if (spec.kind === "plane" && !spec.slide) state.k = mod(state.k, 2 * spec.D);
    }
    if (row && state.k >= to) {
      state.phase = "leave";
      state.clock = 0;
      return true;
    }
    state.phase = "move";
    return true;
  }
  // a row ends at the edge of the floor: fade out there, start again at the other end
  state.clock += dt;
  const t = Math.min(1, state.clock / DURATIONS.fade);
  if (state.phase === "leave") {
    state.presence = 1 - t;
    if (t >= 1) {
      state.k = from;
      state.phase = "enter";
      state.clock = 0;
    }
  } else {
    state.presence = t;
    if (t >= 1) {
      state.presence = 1;
      state.phase = "hold";
      state.clock = DURATIONS.hold * 0.5;
    }
  }
  return true;
}

function paint(figure) {
  for (const view of figure.views) {
    view.resize();
    render(view, figure);
  }
  const plateCanvas = figure.views[1].canvas;
  const [X, Y] = [figure.seedAt[0] + plateCanvas.clientLeft, figure.seedAt[1] + plateCanvas.clientTop];
  figure.handle.style.transform = `translate(${X}px, ${Y}px) translate(-50%, -50%)`;
  const size = Math.max(44, figure.views[1].s * 0.94);
  figure.handle.style.width = `${size}px`;
  figure.handle.style.height = `${size}px`;
  figure.dirty = false;
}

function frame(now) {
  // keep to real time down to ten frames a second; never jump after a stall
  const dt = Math.min(100, now - last || 16);
  last = now;
  let busy = false;
  for (const figure of figures) {
    if (!figure.visible) continue;
    const moved = advance(figure, dt);
    if (moved || figure.dirty) paint(figure);
    const { state } = figure;
    if (state.playing || state.once || state.glide) busy = true;
  }
  if (busy) {
    requestAnimationFrame(frame);
  } else {
    ticking = false;
  }
}

function wake() {
  if (ticking) return;
  ticking = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

function start() {
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const figure = entry.target.symbolFigure;
      if (!figure) continue;
      figure.visible = entry.isIntersecting;
      if (figure.visible) {
        figure.dirty = true;
        wake();
      }
    }
  }, { rootMargin: "120px 0px" });
  for (const host of document.querySelectorAll("[data-symbol-figure]")) {
    const figure = build(host);
    if (!figure) continue;
    host.symbolFigure = figure;
    figures.add(figure);
    paint(figure);            // a first frame even before it scrolls into view
    watcher.observe(host);
  }
  document.documentElement.classList.add("symbol-figures-ready");
  // A link such as #rotation-6-3 from a plate's visual index: go straight to
  // the card.  The site scrolls smoothly, which from the top of this long page
  // is a second and a half of cards flying past; and the figures have only
  // now taken their room.  (Not on a reload or a return, where the browser
  // restores the reader's own position.)
  const arrival = performance.getEntriesByType?.("navigation")[0]?.type || "navigate";
  if (location.hash.length > 1 && arrival === "navigate") {
    let target = null;
    try {
      target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    } catch {
      target = null;
    }
    try {
      target?.scrollIntoView({ behavior: "instant", block: "start" });
    } catch {
      target?.scrollIntoView();   // a browser without "instant"
    }
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
