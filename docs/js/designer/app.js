/* The designer: one period of spacetime, with the group doing the rest.
 *
 * The reader places a ball and drags its path around; the group fills the plane
 * with copies, and the page says at once whether any two of them ever collide.
 * Everything on the page is one of four questions:
 *
 *   WHAT DID I DRAW      the 3D box — the fundamental cell on the floor, time
 *                        running up, each ball a world-tube.
 *   WHAT DOES IT LOOK    the preview, playing, always.
 *   IS IT LEGAL          the contact markers and the status lines. Non-overlap
 *                        is an EQUAL-TIME condition, so two tubes that cross in
 *                        the picture have not necessarily touched; only the
 *                        markers know, and they are drawn last so nothing hides
 *                        them.
 *   WHY THERE            the generator list, and the symmetry diagram.
 *
 * The 3D view is cached in an offscreen layer and only redrawn when something
 * changes, because a design on an 18-op group at two rings of neighbours is a
 * few thousand tube segments and that is not a per-frame cost. What IS drawn
 * every frame is the time plane, which follows the preview, so the two views
 * always agree about which instant is on screen.
 */
"use strict";
import { xuLabel } from "../labels.js?v=41";
import { Camera, tubeSegmentPath, pickTube, pickPoint } from "./geom.js?v=41";
import { scan } from "./collide.js?v=41";
import { encode, decode, LIMITS } from "./urlstate.js?v=41";
import { loadGroups, Design, PALETTE, nearSkip, cart, latticeOf } from "./model.js?v=41";
import { elements } from "./symmetry.js?v=41";
import { generate } from "./random.js?v=41";
import { Preview } from "./preview.js?v=41";

/* The drawing surface is the site's printed-plate ground in both colour
 * schemes: the design is a picture of the same thing the billiards page shows,
 * and it should not change colour with the reader's system settings. */
const GROUND = "#faf9f6";
const INK = "#464c58";
const CELL = "#c9c4b4";
const CELL_FAR = "#e2ded1";
const AXIS = "#8a8578";
const TOUCH = "#e0913c";
const OVER = "#c0392b";
const PICK = "#3b6ea5";

const BOX_H = 1;             // world height of one period
const PICK_PX = 8;           // how near a handle counts as on it
const HANDLE = 4.5;          // half-side of a handle square, px
const DRAG_SLOP = 4;         // px of movement that still counts as a click

const TWO_PI = Math.PI * 2;
const frac = (x) => ((x % 1) + 1) % 1;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/* Toward the ground rather than transparent: clone tubes have to read as
 * fainter, and painter's algorithm on translucent overlapping solids reads as
 * mud. Opaque tints keep the back-to-front order meaning what it says. */
const mixCache = new Map();
function mix(hex, other, f) {
  const key = `${hex}${other}${f}`;
  let out = mixCache.get(key);
  if (out) return out;
  const a = parseInt(hex.slice(1), 16), b = parseInt(other.slice(1), 16);
  const ch = (s) => Math.round((((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f));
  out = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  mixCache.set(key, out);
  return out;
}

/* A time offset is a whole multiple of 1/N; say so, rather than 0.667. */
function fracLabel(tau, N) {
  const k = Math.round(frac(tau) * N);
  if (k % N === 0) return "0";
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(k, N);
  return `${k / d}/${N / d}`;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

/* ------------------------------------------------------------------ state */

const groups = await loadGroups("data/designer-groups.json");

/* A link names its group by POSITION in urlstate's frozen list. If the data
 * file ever gains a group that the list does not, encode() has no index for it
 * and silently writes the first one instead — a link certified by its own
 * checksum, carrying the wrong group. Cheap to notice, so notice it. */
const unlisted = groups.groups.filter((g) => !LIMITS.groups.includes(g.id));
if (unlisted.length) {
  console.error("designer: groups missing from the link format:",
                unlisted.map((g) => g.id).join(", "));
}

/* An empty box on a 333 group. The page used to open on two billiards already
 * placed, which meant the reader's first act was to work out what somebody else
 * had done rather than to put something down; a blank canvas is the tool
 * offering itself. A group still has to be chosen for there to be a box at all. */
const DEFAULT = { g: "g226", r: 0.06, span: 1, seeds: [] };

const el = (id) => document.getElementById(id);
const canvas = el("view");
const ctx = canvas.getContext("2d");
const layer = document.createElement("canvas");
const lctx = layer.getContext("2d");

let restored = location.hash.length > 1 ? decode(location.hash) : null;
let design;
try {
  design = Design.fromState(restored || DEFAULT, groups);
} catch (err) {
  restored = null;
  design = Design.fromState(DEFAULT, groups);
}
if (location.hash.length > 1 && !restored) {
  showNote("that link could not be read, so this is the default design");
}

const cam = new Camera({
  yaw: restored ? restored.view.yaw : 0.62,
  pitch: restored ? restored.view.pitch : 0.62,
  dist: restored && restored.view.dist > 0 ? restored.view.dist : undefined,
  height: BOX_H,
});
/* A link written before the box had a perspective camera carries a ZOOM in
 * pixels per world unit. The same apparent size is dist = f/zoom, and f is not
 * known until the canvas has been measured, so the conversion waits for the
 * first frame. */
let pendingZoom = restored && restored.view.zoom > 1 ? restored.view.zoom : 0;
/* Whether the camera is still the one the page chose. A fitted view belongs to
 * the canvas it was fitted to, so while the reader has not touched it a resize
 * re-fits rather than leaving a framing chosen for a different box — the
 * failure that puts a phone-width viewport inside a single tube. Once the
 * reader has orbited or dollied, the view is theirs and the resize leaves it
 * alone; the Fit button is how it comes back. */
let camTouched = !!(restored && (restored.view.dist > 0 || pendingZoom));
let fitPending = !camTouched;

let paint = 0;                 // the colour the next billiard is placed in
let showSym = false;
let sel = null;                // {seed} or {seed, k}
let hover = null;
let contacts = { events: [], worst: null, anyTouch: false, anyOverlap: false };
let drawn = [];                // the clones inside the display span
let dirty = true;
let W = 0, H = 0, dpr = 1;

const undoStack = [], redoStack = [];

/* ------------------------------------------------------------ the preview */

const preview = new Preview(el("preview"), design);
preview.onTick = (t) => {
  el("scrub").value = String(Math.round(t * 1000));
  el("clock").textContent = t.toFixed(2);
};
preview.onRunChange((p) => {
  el("play").textContent = p.playRequested ? "❚❚" : "▶";
  el("play").setAttribute("aria-label", p.playRequested ? "pause" : "play");
});

/* ------------------------------------------------------------- the change */

/* Every edit ends here. The orbit fill, the collision scan and the URL are all
 * downstream of the design and none of them is worth updating twice. */
function afterChange() {
  drawn = design.clones({ span: design.span });
  // the group's cell and the display span are what the camera aims at and keeps
  // clear of, so they are settled here rather than rediscovered every redraw
  frameBox();

  const seeds = design.seedPaths();
  const diameter = 2 * design.radius;
  /* What is legal must not depend on how much of it is being looked at, so the
   * scan reads design.scanClones() — every clone that can come near a seed,
   * wherever the design has wandered to — and not the block on screen. A reach
   * of one diameter keeps the status line able to say how much room a clear
   * design has; nearSkip then throws away the pairs within that set that are
   * still a cell apart. */
  const near = design.scanClones({ diameter });
  contacts = scan(seeds, near, diameter,
                  { reach: diameter, skip: nearSkip(seeds, near, 2 * diameter) });

  // a selection can outlive what it pointed at (undo, Generate, a delete)
  if (sel && !design.seeds[sel.seed]) sel = null;
  if (sel && sel.k !== undefined && !design.seeds[sel.seed].pts[sel.k]) sel = null;
  hover = null;

  showStatus();
  writeHash();
  if (!preview.running) preview.drawStatic();
  dirty = true;
}

/* An undo step is the state BEFORE the edit, and identical states are not
 * steps — a slider dragged through forty values is one thing that happened. */
function push() {
  const snap = design.snapshot();
  const last = undoStack[undoStack.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(snap)) return;
  undoStack.push(snap);
  if (undoStack.length > 80) undoStack.shift();
  redoStack.length = 0;
  syncUndo();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(design.snapshot());
  design.restore(undoStack.pop(), groups);
  syncControls();
  afterChange();
  syncUndo();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(design.snapshot());
  design.restore(redoStack.pop(), groups);
  syncControls();
  afterChange();
  syncUndo();
}

function syncUndo() {
  el("undo").disabled = !undoStack.length;
  el("redo").disabled = !redoStack.length;
}

/* ------------------------------------------------------------- the camera */

/* What the camera turns about, and how close it may come. The target is the
 * centre of the base cell half a period up — the middle of the box — so that an
 * orbit turns around what the reader is looking at rather than around the world
 * origin, which is a corner of it. The bound is the radius of a sphere holding
 * the whole drawn block; geom keeps the eye outside it, and that is what lets it
 * project without clipping. Both depend on the group and the span and on nothing
 * the reader does with the mouse. */
function frameBox() {
  const B = design.group.basis;
  const span = design.span;
  const c = cart(B, [0.5, 0.5]);
  cam.lookAt([c[0], c[1], 0.5]);
  let rr = 0;
  for (const u of [[-span, -span], [span + 1, -span],
                   [span + 1, span + 1], [-span, span + 1]]) {
    const p = cart(B, u);
    rr = Math.max(rr, Math.hypot(p[0] - c[0], p[1] - c[1]));
  }
  cam.setBound(Math.hypot(rr, 0.5 * BOX_H));
}

/* Fit the BASE cell and a margin, not the whole display span: at two rings the
 * outer cells are context and the cell being designed in is the subject.
 *
 * Under perspective there is no closed form — apparent size goes as f/dist only
 * for a point at the target's depth, and the box has depth. So it is solved as
 * a fixed point instead: measure how much too big the box is on screen, push
 * the eye back by that factor, repeat. The error in the ratio is second order,
 * so it converges geometrically and three passes are past the pixel. */
function fitView() {
  if (!W || !H) return;
  frameBox();
  cam.dist = cam.minDist * 6;          // far enough out that every corner is in front
  for (let i = 0; i < 4; i++) {
    const b = boxBox();
    if (!b) break;
    const k = Math.max(b.w / (0.92 * W), b.h / (0.92 * H));
    if (!(k > 0)) break;
    cam.dist = cam.dist * k;
  }
}

/* The screen bounding box of the cell and its margin, or null if any corner of
 * it has fallen behind the eye — which the dist clamp prevents, and which would
 * make the measurement meaningless if it ever did not. */
function boxBox() {
  const B = design.group.basis;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const u of [[-0.55, -0.55], [1.55, -0.55], [1.55, 1.55], [-0.55, 1.55]]) {
    const p = cart(B, u);
    for (const t of [0, 1]) {
      const s = cam.project([p[0], p[1], t]);
      if (!s) return null;
      x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]);
      y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]);
    }
  }
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}

/* ------------------------------------------------------------ the drawing */

/* The loop as spacetime segments, the closing one included: a stationary ball
 * (one breakpoint) is a single vertical segment, which is exactly what its
 * world-tube is. */
function loopSegments(pts) {
  const out = [];
  if (pts.length === 1) {
    const p = pts[0];
    out.push([[p.x, p.y, 0], [p.x, p.y, 1]]);
    return out;
  }
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k];
    const b = k + 1 < pts.length ? pts[k + 1] : { t: 1, x: pts[0].x, y: pts[0].y };
    out.push([[a.x, a.y, a.t], [b.x, b.y, b.t]]);
  }
  return out;
}

function drawLayer() {
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lctx.fillStyle = GROUND;
  lctx.fillRect(0, 0, W, H);
  drawBox(lctx, false);
  if (showSym) drawSymmetry(lctx, false);
  drawTubes(lctx);
  // the axes go over the top: an axis is a line THROUGH the box, and one drawn
  // under a hundred tubes is a line through nothing
  if (showSym) drawSymmetry(lctx, true);
  /* The box again, faintly, over the top. Sorting its edges into the tube
   * order would be the correct painting and is not worth it: what matters is
   * that the cell being designed in stays findable inside a plane full of
   * copies, and a ghosted edge says "behind this" perfectly well. */
  drawBox(lctx, true);
  drawMarkers(lctx);
  drawHandles(lctx);
}

function drawBox(g, over) {
  g.save();
  if (over) g.globalAlpha = 0.5;
  const B = design.group.basis;
  const corners = design.cellCorners();
  const span = design.span;
  // false when a corner is behind the eye and the outline would be nonsense
  const cellPath = (m1, m2, t) => {
    const d = cart(B, [m1, m2]);
    const s = [];
    for (const c of corners) {
      const q = cam.project([c[0] + d[0], c[1] + d[1], t]);
      if (!q) return false;
      s.push(q);
    }
    g.beginPath();
    s.forEach((q, i) => g[i ? "lineTo" : "moveTo"](q[0], q[1]));
    g.closePath();
    return true;
  };
  g.lineWidth = 1;
  g.strokeStyle = CELL_FAR;
  if (!over) {
    for (let m1 = -span; m1 <= span; m1++) {
      for (let m2 = -span; m2 <= span; m2++) {
        if (!m1 && !m2) continue;
        if (cellPath(m1, m2, 0)) g.stroke();
      }
    }
  }
  // the box itself: floor, four uprights, and the lid, which is the floor again
  g.strokeStyle = CELL;
  g.lineWidth = 1.4;
  if (cellPath(0, 0, 0)) g.stroke();
  if (cellPath(0, 0, 1)) g.stroke();
  g.beginPath();
  for (const c of corners) {
    const a = cam.project([c[0], c[1], 0]);
    const b = cam.project([c[0], c[1], 1]);
    if (!a || !b) continue;
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
  }
  g.stroke();
  g.restore();
}

const EMPTY = [];

/* The fixed-point sets depend on the group and the span and on nothing else, so
 * they survive every edit and every orbit of the camera; recomputing them is
 * several milliseconds on the 18-op groups and a redraw asks for them twice. */
let symCache = null;
function symElements() {
  const span = design.span;
  if (symCache && symCache.g === design.group.id && symCache.span === span) {
    return symCache.el;
  }
  symCache = { g: design.group.id, span, el: elements(design.group.ops, span) };
  return symCache.el;
}

/* The group's own fixed-point sets, drawn into the box rather than onto the
 * floor: a rotation centre is an AXIS in spacetime, and a rotation that costs
 * time is a screw about it. Filled marker: the turn costs nothing, so it is a
 * symmetry of every frozen frame. Hollow: only of the animation.
 *
 * Two passes. `over` is false for what belongs on the ground — the mirror and
 * glide lines, and a marker at every centre in the block — and true for what
 * belongs in the air: the shaft of each axis in the BASE cell and its time
 * offset. Every cell repeats the same axes, so labelling them all is a thicket.
 *
 * The markers are drawn in BOTH passes. On a 16- or 18-op group a marker left
 * on the floor is behind a hundred tubes and the diagram is a diagram of
 * nothing; drawn again over the top, slightly transparent, it reads as what it
 * is — a place in the plane, seen through the animation standing above it. */
function drawSymmetry(g, over) {
  const B = design.group.basis;
  const N = design.group.n;
  const span = design.span;
  const { pts, lns } = symElements();

  g.save();
  g.strokeStyle = AXIS;
  // long enough to cross the block they belong to and no longer: a mirror is an
  // infinite line, and eighteen of them drawn to the canvas edge are a hatching
  const reach = span + 1.2;
  g.globalAlpha = 0.6;
  for (const ln of over ? EMPTY : lns) {
    g.lineWidth = ln.glide ? 1.1 : 1.7;
    g.setLineDash(ln.glide ? [6, 4] : []);
    const a = cam.project([...cart(B, [ln.base[0] - reach * ln.d[0],
                                       ln.base[1] - reach * ln.d[1]]), 0]);
    const b = cam.project([...cart(B, [ln.base[0] + reach * ln.d[0],
                                       ln.base[1] + reach * ln.d[1]]), 0]);
    // a mirror runs a cell past the block the camera is kept clear of, so an
    // end of one can be behind the eye when the reader dollies right in
    if (!a || !b) continue;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }
  g.setLineDash([]);
  g.globalAlpha = 1;

  g.font = "10px system-ui, sans-serif";
  g.textAlign = "left";
  g.textBaseline = "middle";
  for (const p of pts) {
    if (p.c[0] < -span || p.c[0] > span + 1 || p.c[1] < -span || p.c[1] > span + 1) continue;
    const q = cart(B, p.c);
    const foot = cam.project([q[0], q[1], 0]);
    if (!foot) continue;
    const home = p.c[0] > -0.02 && p.c[0] < 1.02 && p.c[1] > -0.02 && p.c[1] < 1.02;
    if (over) {
      // the second pass is dimmer: it is being read through the animation
      g.globalAlpha = 0.72;
      marker(g, foot, p);
      const top = home ? cam.project([q[0], q[1], 1]) : null;
      if (!top) { g.globalAlpha = 1; continue; }
      g.strokeStyle = AXIS;
      g.globalAlpha = 0.35;
      g.lineWidth = p.free ? 1.4 : 1;
      g.setLineDash(p.free ? [] : [3, 3]);
      g.beginPath();
      g.moveTo(foot[0], foot[1]);
      g.lineTo(top[0], top[1]);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
      g.fillStyle = AXIS;
      g.fillText(fracLabel(p.tau, N), top[0] + 5, top[1] - 1);
      continue;
    }
    marker(g, foot, p);
  }
  g.restore();
}

/* A rotation centre, on the floor. Filled: the turn costs no time, so it is a
 * symmetry of every frozen frame as well as of the animation. */
function marker(g, foot, p) {
  const r = 6;
  g.beginPath();
  g.arc(foot[0], foot[1], r + 2.5, 0, TWO_PI);
  g.fillStyle = GROUND;
  g.fill();
  g.beginPath();
  if (p.order === 2) {
    // a 2-fold has no polygon: the book draws it as a lens, and a two-sided
    // one would be a line segment
    g.ellipse(foot[0], foot[1], r, r * 0.5, 0, 0, TWO_PI);
  } else {
    for (let k = 0; k < p.order; k++) {
      const a = -Math.PI / 2 + k * TWO_PI / p.order;
      g[k ? "lineTo" : "moveTo"](foot[0] + r * Math.cos(a), foot[1] + r * Math.sin(a));
    }
    g.closePath();
  }
  g.lineWidth = 1.5;
  g.strokeStyle = AXIS;
  g.fillStyle = p.free ? AXIS : GROUND;
  g.fill();
  if (!p.free) g.stroke();
}

/* Above this many silhouettes a redraw is slow enough to feel, so a drag drops
 * to the base cell and the full picture comes back when the pointer does. */
const FAST_SEGMENTS = 2200;
let lastSegs = 0;

function drawTubes(g) {
  const r = design.radius;
  const items = [];
  // the orbit fills the plane, so most of what the display span holds is off
  // the edge of the canvas; the silhouette is the expensive part, so decide
  // before building it
  const ring = drag && lastSegs > FAST_SEGMENTS ? 0 : design.span;
  for (const c of drawn) {
    if (Math.abs(c.m[0]) > ring || Math.abs(c.m[1]) > ring) continue;
    const isSeed = c.identity;
    const hi = isSeed && ((sel && sel.seed === c.seedIndex) ||
                          (hover && hover.seed === c.seedIndex));
    for (const [a, b] of loopSegments(c.path.pts)) {
      const sa = cam.project(a), sb = cam.project(b);
      if (!sa || !sb) continue;           // reaches past the eye; see geom.js
      // how big the ball is on screen is now a property of WHERE it is, so the
      // margin the cull has to leave is measured per segment
      const pad = r * Math.max(cam.scaleAt(a), cam.scaleAt(b)) + 2;
      if (Math.max(sa[0], sb[0]) < -pad || Math.min(sa[0], sb[0]) > W + pad ||
          Math.max(sa[1], sb[1]) < -pad || Math.min(sa[1], sb[1]) > H + pad) continue;
      /* Built here, painted below, and the two must not interleave: a Path2D
       * raised between two paints costs fifteen times one raised before them. */
      const path = tubeSegmentPath(cam, a, b, r);
      if (!path) continue;
      items.push({ path, c, isSeed, hi,
                   d: cam.depth([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
                                 (a[2] + b[2]) / 2]) });
    }
  }
  if (ring === design.span) lastSegs = items.length;
  items.sort((p, q) => p.d - q.d);
  for (const it of items) {
    const path = it.path;
    if (it.isSeed) {
      g.fillStyle = it.c.color;
      g.strokeStyle = it.hi ? PICK : INK;
      g.lineWidth = it.hi ? 2 : 1;
    } else {
      g.fillStyle = mix(it.c.color, GROUND, 0.72);
      g.strokeStyle = mix(it.c.color, GROUND, 0.42);
      g.lineWidth = 0.8;
    }
    g.fill(path);
    g.stroke(path);
  }
}

/* Contact markers, unsorted and last: a marker hidden behind the very tube it
 * is complaining about would be worse than useless. */
function drawMarkers(g) {
  g.save();
  for (const e of contacts.events) {
    if (e.kind === "clear") continue;
    const p = cam.project([e.x, e.y, e.t]);
    if (!p) continue;
    const over = e.kind === "overlap";
    g.strokeStyle = over ? OVER : TOUCH;
    g.globalAlpha = over ? Math.min(1, 0.55 + e.depth) : 0.85;
    g.lineWidth = over ? 1.6 + 2.4 * Math.min(1, e.depth) : 1.4;
    g.beginPath();
    g.arc(p[0], p[1], 5.5, 0, TWO_PI);
    g.stroke();
  }
  g.restore();
}

function drawHandles(g) {
  const B = design.group.basis;
  design.seeds.forEach((s, i) => {
    s.pts.forEach((p, k) => {
      const q = cart(B, p.u);
      const c = cam.project([q[0], q[1], p.t]);
      if (!c) return;
      const on = sel && sel.seed === i && sel.k === k;
      const hot = hover && hover.kind === "point" && hover.seed === i && hover.k === k;
      const h = HANDLE + (on || hot ? 1.5 : 0);
      g.beginPath();
      g.rect(c[0] - h, c[1] - h, 2 * h, 2 * h);
      // the anchor is the loop's t = 0 and does not move in time or vanish;
      // solid says "this one is the ground the rest hangs from"
      g.fillStyle = k === 0 ? INK : GROUND;
      g.fill();
      g.lineWidth = on ? 2.2 : 1.2;
      g.strokeStyle = on ? PICK : INK;
      g.stroke();
    });
  });
}

/* The instant the preview is showing, as a slice through the box. Drawn every
 * frame, over the cached layer — it is the only thing that moves. */
function drawPlane(t) {
  const s = [];
  for (const c of design.cellCorners()) {
    const q = cam.project([c[0], c[1], t]);
    if (!q) return;
    s.push(q);
  }
  ctx.beginPath();
  s.forEach((q, i) => ctx[i ? "lineTo" : "moveTo"](q[0], q[1]));
  ctx.closePath();
  ctx.fillStyle = "rgba(59,110,165,0.09)";
  ctx.fill();
  ctx.strokeStyle = "rgba(59,110,165,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function frame() {
  window.__frames = (window.__frames || 0) + 1;
  try {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const d = window.devicePixelRatio || 1;
  if (w !== W || h !== H || d !== dpr) {
    W = w; H = h; dpr = d;
    canvas.width = layer.width = Math.round(W * dpr);
    canvas.height = layer.height = Math.round(H * dpr);
    // the focal length is half the canvas height over tan(fov/2), so the camera
    // has to be told before anything asks it to project or to convert a zoom
    cam.viewport(W, H);
    if (pendingZoom) { cam.dist = cam.f / pendingZoom; pendingZoom = 0; }
    // the fit is part of the view, and the view is part of the link
    if (fitPending || !camTouched) { fitView(); fitPending = false; writeHash(); }
    dirty = true;
  }
  if (dirty) { drawLayer(); dirty = false; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(layer, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPlane(preview.getPhase());
  } catch (err) { window.__frameErr = String(err && err.stack || err); }
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------- the mouse */

function at(e) {
  const b = canvas.getBoundingClientRect();
  return [e.clientX - b.left, e.clientY - b.top];
}

/* What is under the pixel. Handles win over tubes whatever the depth — they are
 * drawn on top and they are the gesture the tool is for; between tubes the
 * winner is the one the ray enters first (geom.pickTube's own depth). */
function pick(sx, sy) {
  const B = design.group.basis;
  let best = null;
  design.seeds.forEach((s, i) => {
    s.pts.forEach((p, k) => {
      const q = cart(B, p.u);
      const w = [q[0], q[1], p.t];
      if (!pickPoint(cam, sx, sy, w, PICK_PX)) return;
      const d = cam.depth(w);
      if (!best || d > best.depth) best = { kind: "point", seed: i, k, t: p.t, depth: d };
    });
  });
  if (best) return best;
  for (const c of drawn) {
    const h = pickTube(cam, sx, sy, c.path.pts, design.radius, BOX_H);
    if (h && (!best || h.depth > best.depth)) {
      // a clone shows its seed at internal time t - tau, so this is where the
      // click lands on the SEED's loop — which is the loop that can be edited
      best = { kind: "tube", seed: c.seedIndex, t: frac(h.t - c.tau),
               depth: h.depth, clone: c };
    }
  }
  return best;
}

let drag = null;

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const [sx, sy] = at(e);
  const hit = pick(sx, sy);
  if (hit && hit.kind === "point") {
    push();
    sel = { seed: hit.seed, k: hit.k };
    drag = { kind: "point", seed: hit.seed, k: hit.k, t: hit.t };
  } else if (hit && hit.kind === "tube" && e.shiftKey) {
    push();
    const k = design.addBreak(hit.seed, hit.t);
    sel = { seed: hit.seed, k };
    afterChange();
    drag = { kind: "point", seed: hit.seed, k, t: design.seeds[hit.seed].pts[k].t };
  } else {
    if (hit) sel = { seed: hit.seed };
    // pressing anywhere still orbits; an empty press that never moves places
    drag = { kind: "orbit", x: sx, y: sy, moved: 0, empty: !hit };
  }
  dirty = true;
});

canvas.addEventListener("pointermove", (e) => {
  const [sx, sy] = at(e);
  if (!drag) {
    const h = pick(sx, sy);
    const same = (a, b) => (!a && !b) ||
      (a && b && a.kind === b.kind && a.seed === b.seed && a.k === b.k);
    if (!same(h, hover)) { hover = h; dirty = true; }
    canvas.style.cursor = !h ? "crosshair"
      : h.kind === "point" ? "grab"
      : e.shiftKey ? "copy" : "pointer";
    return;
  }
  if (drag.kind === "orbit") {
    drag.moved += Math.abs(sx - drag.x) + Math.abs(sy - drag.y);
    cam.orbit((sx - drag.x) * 0.008, (sy - drag.y) * 0.006);
    if (drag.moved > DRAG_SLOP) camTouched = true;
    drag.x = sx; drag.y = sy;
    writeHash();
    dirty = true;
    return;
  }
  // the core gesture: the breakpoint moves in ITS OWN time slice. Time is what
  // it is; only the position in the plane is being dragged.
  const w = cam.unproject(sx, sy, drag.t);
  /* The pixel need not meet that slice at all: along the horizon the ray runs
   * parallel to it, and below the horizon a slice above the eye is met only
   * behind the camera. The handle then stays where it was — a drag that gives
   * up for a moment is a drag; one that jumps to the far side of the plane and
   * back is a bug. */
  if (!w) return;
  const u = latticeOf(design.group.basis, w);
  design.movePoint(drag.seed, drag.k, [clamp(u[0], -8, 8), clamp(u[1], -8, 8)]);
  afterChange();
});

canvas.addEventListener("pointerup", (e) => {
  const [sx, sy] = at(e);
  if (drag && drag.kind === "orbit" && drag.empty && drag.moved < DRAG_SLOP) {
    // a click whose ray misses the floor entirely places nothing; there is no
    // point of the floor it could mean
    const w = cam.unproject(sx, sy, 0);
    if (w) {
      push();
      const u = latticeOf(design.group.basis, w);
      const i = design.addSeed([clamp(u[0], -8, 8), clamp(u[1], -8, 8)], paint);
      sel = { seed: i, k: 0 };
      afterChange();
    }
  }
  drag = null;
  dirty = true;         // the drag may have been drawing a reduced picture
  canvas.releasePointerCapture(e.pointerId);
});

/* The wheel moves the eye in and out. Wheel down is away, which is the sign
 * every 3D view uses and the same direction the old zoom went. */
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  cam.dolly(Math.exp(e.deltaY * 0.0015));
  camTouched = true;
  writeHash();
  dirty = true;
}, { passive: false });

document.addEventListener("keydown", (e) => {
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
  const key = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && key === "z") {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
    return;
  }
  if (e.key === "Escape") { sel = null; dirty = true; return; }
  /* The group's beats are the instants worth stopping on — a design on an
   * N-colour clock is read at k/N — so the arrows step between them rather
   * than by some frame count the animation does not have. */
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    preview.stepMark(e.key === "ArrowRight" ? 1 : -1, 1 / 24);
    return;
  }
  if (e.key !== "Backspace" && e.key !== "Delete") return;
  if (!sel) return;
  e.preventDefault();
  push();
  if (sel.k !== undefined && sel.k > 0) {
    design.removeBreak(sel.seed, sel.k);
    sel = { seed: sel.seed };
  } else {
    design.removeSeed(sel.seed);
    sel = null;
  }
  afterChange();
});

/* -------------------------------------------------------------- the panel */

function showNote(text) {
  const n = el("note");
  n.textContent = text;
  n.hidden = false;
  clearTimeout(showNote._t);
  showNote._t = setTimeout(() => { n.hidden = true; }, 6000);
}

function showStatus() {
  const diameter = 2 * design.radius;
  const w = contacts.worst;
  const gap = el("st-gap");
  // an empty box is not "clear" — there is nothing yet for anything to clear
  gap.textContent = !design.seeds.length ? "—"
    : w ? `${(w.d / diameter).toFixed(2)}×` : "clear (> 2×)";
  gap.className = !w ? "" : w.kind === "overlap" ? "bad" : w.kind === "touch" ? "warn" : "";
  const touch = contacts.events.filter((e) => e.kind === "touch").length;
  const over = contacts.events.filter((e) => e.kind === "overlap").length;
  el("st-touch").textContent = String(touch);
  el("st-touch").className = touch ? "warn" : "";
  el("st-over").textContent = String(over);
  el("st-over").className = over ? "bad" : "";
}

let hashTimer = null, lastHash = "";
function writeHash(now) {
  clearTimeout(hashTimer);
  const run = () => {
    const s = design.toState();
    s.view = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
    const h = "#" + encode(s);
    if (h === lastHash && location.hash === h) return;
    lastHash = h;
    // replaceState, never push: a design tool must not fill the back button
    history.replaceState(null, "", h);
  };
  if (now) run(); else hashTimer = setTimeout(run, 180);
}

window.addEventListener("hashchange", () => {
  if (location.hash === lastHash) return;
  const st = decode(location.hash);
  if (!st) {
    showNote("that link could not be read");
    // and the address must not be left holding it: Copy link reads the address
    writeHash(true);
    return;
  }
  try {
    design.restore({ group: st.g, radius: st.r, span: st.span, seeds: st.seeds },
                   groups);
  } catch (err) { return; }
  cam.yaw = st.view.yaw;
  cam.pitch = st.view.pitch;
  // an old link's zoom, in pixels per world unit, is this distance — the canvas
  // has been measured by now, so it can be converted on the spot
  if (st.view.dist > 0) cam.dist = st.view.dist;
  else if (st.view.zoom > 1) cam.dist = cam.f / st.view.zoom;
  syncControls();
  afterChange();
});

/* ---- group selector ---- */

function buildGroups() {
  const host = el("groups");
  const parts = [];
  // The orders come from the data, not from a literal. This list read
  // [3, 4, 6] and so hid every clock-order-2 group — thirty-six of the
  // fifty-one, g6 among them — which made the menu look like a claim that
  // they are not clockwork groups at all.
  for (const n of groups.orders) {
    parts.push(`<p class="head">${n} colours</p>`);
    const list = groups.byColors.get(n);
    const seen = [];
    for (const g of list) if (!seen.includes(g.parentOrbifold)) seen.push(g.parentOrbifold);
    for (const orb of seen) {
      parts.push(`<p class="sub">${esc(orb)} <span>${esc(list.find((g) =>
        g.parentOrbifold === orb).parentHm)}</span></p>`);
      for (const g of list.filter((x) => x.parentOrbifold === orb)) {
        // the signature is the name; two groups in a chiral pair share it, so
        // the id has to be on the row as well or the choice is ambiguous
        parts.push(
          `<div class="grow"><button type="button" class="grp" data-g="${g.id}">` +
          `<span class="sig">${g.signatureHtml}</span>` +
          `<span class="fab">${g.fableHtml}</span>` +
          `<span class="par">${xuLabel(g.id)}</span></button>` +
          `<a class="ext" href="${esc(g.correspondenceUrl)}" target="_blank" ` +
          `rel="noopener" title="this group in the correspondence table">↗</a></div>`);
      }
    }
  }
  host.innerHTML = parts.join("");
  host.addEventListener("click", (e) => {
    const b = e.target.closest("button.grp");
    if (!b) return;
    const g = groups.byId.get(b.dataset.g);
    if (!g || g === design.group) return;
    push();
    design.setGroup(g);          // the seeds stay; the orbit is refilled
    syncControls();
    afterChange();
  });
}

function buildSwatches() {
  el("swatches").innerHTML = PALETTE.map((c, i) =>
    `<button type="button" data-c="${i}" style="background:${c}" ` +
    `aria-label="colour ${i + 1}"></button>`).join("");
  el("swatches").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    paint = +b.dataset.c;
    if (sel) {
      push();
      design.setSeedColor(sel.seed, paint);
      afterChange();
    }
    syncControls();
  });
}

/* "about centre E", "axis direction A": letters from the correspondence table's
 * own figure, which is not this page. The symmetry diagram here labels a centre
 * by its time offset and nothing else, so a letter the reader cannot look up is
 * worse than no letter — and on g137 the same generator is "about centre E" at
 * one power and "about centre B" at another, which reads as an error. */
const unlettered = (s) => String(s)
  .replace(/ about centre [A-Z]\b/, "")
  .replace(/ \(axis direction [A-Z]\)/, "");

function renderGens() {
  const g = design.group;
  const ops = (g.geometricOps || []).map((o) => {
    const tag = o.power === "1" ? o.generator : `${o.generator}<sup>${esc(o.power)}</sup>`;
    return `<li><span class="tag">${tag}</span>` +
           `<span class="k">${esc(unlettered(o.operation))}</span>` +
           `<span class="ts">${esc(o.timeShift)}</span></li>`;
  }).join("");
  const alg = (g.generators || []).map((x) =>
    `<li><code>${esc(x.expr)}</code>${x.note ? `<span>${esc(x.note)}</span>` : ""}</li>`
  ).join("");
  el("gens").innerHTML =
    `<ul class="ops">${ops}</ul>` +
    `<details><summary>the algebra</summary><ul class="alg">${alg}</ul></details>`;
}

/* Whatever the design says, the controls say. Called after anything that can
 * change the design out from under them: undo, a pasted link, Generate. */
function syncControls() {
  for (const b of document.querySelectorAll("button.grp")) {
    b.setAttribute("aria-pressed", String(b.dataset.g === design.group.id));
  }
  for (const b of el("swatches").children) {
    b.setAttribute("aria-pressed", String(+b.dataset.c === paint));
  }
  for (const b of el("span").children) {
    b.setAttribute("aria-pressed", String(+b.dataset.span === design.span));
  }
  el("radius").value = String(design.radius);
  el("radius-out").textContent = design.radius.toFixed(3);
  // the scrub bar's ticks are the group's beats, so they change with the group
  el("marks").innerHTML = preview.syncGroup().marks
    .map((m) => `<option value="${Math.round(m.t * 1000)}" label="${esc(m.label)}">`)
    .join("");
  renderGens();
}

/* ---- settings ---- */

el("radius").addEventListener("pointerdown", push);
el("radius").addEventListener("keydown", push);
el("radius").addEventListener("input", (e) => {
  design.setRadius(+e.target.value);
  el("radius-out").textContent = design.radius.toFixed(3);
  afterChange();
});

el("span").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  push();
  design.setSpan(+b.dataset.span);
  syncControls();
  afterChange();
});

el("sym").addEventListener("change", (e) => {
  showSym = e.target.checked;
  dirty = true;
});

/* ---- preview transport ---- */

el("play").addEventListener("click", () => preview.toggle());
el("scrub").addEventListener("input", (e) => {
  preview.pause();
  preview.setPhase(+e.target.value / 1000);
});

/* ---- random ---- */

el("generate").addEventListener("click", () => {
  const btn = el("generate");
  btn.disabled = true;
  el("r-report").textContent = "searching…";
  /* Let the button repaint before the search takes the thread. A timer and not
   * requestAnimationFrame: a page in a background tab paints nothing, and a
   * Generate that waits for the reader to come back and look at it is a bug. */
  setTimeout(() => {
    push();
    const rep = generate(design, {
      count: clamp(+el("r-count").value | 0, 1, 8),
      breaks: clamp(+el("r-breaks").value | 0, 0, 5),
      radius: clamp(+el("r-radius").value, 0.02, 0.14),
    });
    const gap = isFinite(rep.minGapRatio)
      ? `<b>${rep.minGapRatio.toFixed(2)}</b> diameters`
      : "more than <b>2</b> diameters";
    el("r-report").innerHTML =
      `${rep.ok ? "clear" : "crowded"} — closest approach ${gap}` +
      // the group, not the search, is what a crowded answer is about: the dense
      // groups put eighteen copies of every ball in one cell and no shape fits
      (rep.ok ? "" : ` — ${rep.count} billiards fit here near r = ` +
                     `<b>${rep.fits.toFixed(3)}</b>`) + `<br>` +
      `${rep.count} billiards · ${rep.tries} anchor draws · ` +
      `${rep.attempts} shape${rep.attempts === 1 ? "" : "s"} · ` +
      `${rep.iterations} relaxations · ${Math.round(rep.ms)} ms`;
    syncControls();
    afterChange();
    btn.disabled = false;
  }, 30);
});

/* ---- toolbar ---- */

el("copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    showNote("link copied — it carries the whole design");
  } catch (err) {
    showNote("could not reach the clipboard; the address bar has the link");
  }
});
/* The one control that cannot be reached by any other gesture: on a touch
 * device there is no wheel, and an over-zoomed or resized view is otherwise
 * only recoverable by reloading without the hash. */
el("fit").addEventListener("click", () => {
  fitView();
  camTouched = false;
  writeHash();
  dirty = true;
});
el("undo").addEventListener("click", undo);
el("redo").addEventListener("click", redo);

/* ---------------------------------------------------------------- go */

window.__probe = () => {
  const lp = lctx.getImageData(100, 100, 1, 1).data;
  const cp = ctx.getImageData(100, 100, 1, 1).data;
  return { W, H, dist: cam.dist, minDist: cam.minDist, f: cam.f, yaw: cam.yaw,
           pitch: cam.pitch, target: cam.target, segs: lastSegs,
           layerPx: [...lp], canvasPx: [...cp], frames: window.__frames };
};
window.__perf = (n) => {
  n = n || 20;
  drawLayer();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) drawLayer();
  return (performance.now() - t0) / n;
};
window.__segs = () => lastSegs;

buildGroups();
buildSwatches();
el("r-radius").value = String(design.radius);
syncControls();
syncUndo();
afterChange();
preview.play();
requestAnimationFrame(frame);
