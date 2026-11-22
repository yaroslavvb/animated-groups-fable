// Studio — the page: a film you edit while it plays.
//
// studio-core.mjs knows the group and the arithmetic, studio-gl.mjs draws a
// frame; this file is everything a hand touches.  The design is plain data
// (the same object a link carries); every change goes through edit(), which
// is what gives undo, the address bar and the "this layer cancels" flags one
// place to hang.

import {
  TAU, buildGroup, toCart, toLat, describeElement, rotationCentres, fractionGlyph,
  SHAPES, SHAPE_INDEX, shapeDef, shapeSymmetry, shapeBound, sdShape,
  MOVES, newMove, stateAt, pivotAt, compileFrame, hitTest, layerVanishes, inkAt,
  normaliseDesign, normaliseLayer, encodeDesign, decodeDesign, layerLabel,
} from './studio-core.mjs';
import { Renderer, PALETTES } from './studio-gl.mjs';
import { PRESETS, randomDesign, censusFilm } from './studio-presets.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const main = $('main.studio');
const params = new URLSearchParams(location.search);
const DEFAULT_CLASS = 'g95-n2-3';
const ACCENT = '#3b6ea5';
const mod1 = (x) => x - Math.floor(x);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** replaceChildren that takes what h() takes: nested lists, and nothing for null. */
function fill(el, ...children) {
  el.replaceChildren(...children.flat(3).filter((child) => child !== null && child !== undefined && child !== false)
    .map((child) => (child instanceof Node ? child : document.createTextNode(String(child)))));
  return el;
}

// What the census does not say about a class, said by hand where it is known.
const KNOWN = {
  'g95-n2-3': {
    lede: 'p4 · film g95, ²4²4¹2 (P4₂), in two inks. The half of it that keeps the inks is g96, ⁴4⁴4²2 (P4₁); read as a magnetic group it is P_c4₁.',
    rules: [
      ['keep', 'A quarter turn ↺ together with a quarter of the loop: the same picture.'],
      ['swap', 'A half turn on its own, or half the loop on its own: black and white change places.'],
    ],
    after: 'So nothing can stand still: every point is white for exactly half the loop.',
    links: [['../#p4/g95/g95-n2-3', 'this class in the census'], ['../../correspondence-p4.html#g95', 'g95'], ['../../correspondence-p4.html#g96', 'g96'], ['https://plume-monochrome.pages.dev/', 'Plume Monochrome, a film of this class']],
  },
};

const state = {
  census: null,
  group: null,
  classId: DEFAULT_CLASS,
  design: null,
  sel: null,                    // id of the selected layer
  grab: { j: 0, m: [0, 0] },    // which copy of it carries the handles
  hover: null,
  t: 0,
  playing: true,
  hold: false,                  // a handle is being dragged: time waits
  scrubbing: false,
  view: { cx: 0, cy: 0, span: 2.6 },
  show: { sym: true, outlines: 'sel' },
  undo: [],
  redo: [],
  vanish: new Map(),
  frame: null,
  handles: [],
  needsDraw: true,
  stripDirty: true,
  stripAt: 0,
  qualityCap: 1024,
  slow: 0,
  fast: 0,
  recording: null,
  grey: false,
  hoverText: '',
  centres: [],
  message: '',
  messageUntil: 0,
};

let uid = 0;
const adopt = (design) => { for (const layer of design.L) layer.id = ++uid; return design; };
const layerById = (id) => state.design.L.find((layer) => layer.id === id) || null;
const selected = () => (state.sel === null ? null : layerById(state.sel));
const snapshot = () => JSON.stringify(state.design, (key, value) => (key === 'id' ? undefined : value));

const canvas = $('#film');
const overlay = $('#overlay');
const ctx = overlay.getContext('2d');
const viewport = $('#viewport');
const hud = $('#hud');
let renderer = null;

// ------------------------------------------------------------- the model --

let pending = null;             // the design before the gesture in progress

/** Call before the first change of a gesture (a drag, a slider being pulled). */
function beginEdit() {
  if (pending === null) pending = snapshot();
}

/** Call when the gesture ends: one undo step, the address, the flags. */
function commitEdit({ structure = true, always = false } = {}) {
  if (pending === null) return;
  const before = pending;
  pending = null;
  if (before === snapshot()) { if (always) afterChange({ structure }); return; }
  state.undo.push(before);
  if (state.undo.length > 120) state.undo.shift();
  state.redo.length = 0;
  afterChange({ structure });
}

/** A change that is one step on its own. */
function edit(change, options) {
  beginEdit();
  change();
  commitEdit(options);
}

/**
 * After a change has been made.  `structure: false` says the controls in the
 * inspector are still the right ones and need only re-read their values: a
 * slider that has just been let go keeps the keyboard.
 */
function afterChange({ structure = true } = {}) {
  refreshVanish();
  writeAddress();
  state.needsDraw = true;
  state.stripDirty = true;
  renderLayers();
  if (structure) renderInspector(); else syncInspector();
  syncButtons();
  $('#empty').hidden = state.design.L.length > 0;
}

function touch() {
  state.needsDraw = true;
  state.stripDirty = true;
}

function restore(text) {
  const keepIndex = state.design ? state.design.L.findIndex((layer) => layer.id === state.sel) : -1;
  state.design = adopt(normaliseDesign(JSON.parse(text), state.classId));
  state.sel = keepIndex >= 0 && state.design.L[keepIndex] ? state.design.L[keepIndex].id : null;
  syncDesignControls();
  afterChange();
}

function undo() {
  commitEdit();
  if (!state.undo.length) return;
  state.redo.push(snapshot());
  restore(state.undo.pop());
  say('Undone');
}

function redo() {
  commitEdit();
  if (!state.redo.length) return;
  state.undo.push(snapshot());
  restore(state.redo.pop());
  say('Redone');
}

function loadDesign(raw, { name } = {}) {
  beginEdit();
  state.design = adopt(normaliseDesign(raw, state.classId));
  state.design.cls = state.classId;
  state.sel = null;
  syncDesignControls();
  commitEdit({ always: true });
  if (name) say(name);
}

function refreshVanish() {
  state.vanish = new Map();
  for (const layer of state.design.L) {
    if (layer.off) continue;
    let gone = false;
    try { gone = layerVanishes(layer, state.group); } catch { gone = false; }
    state.vanish.set(layer.id, gone);
  }
  state.grey = findGrey();
}

/** Is any of the film grey?  A few hundred points say, well enough for a hint. */
function findGrey() {
  if (!state.design.L.some((layer) => !layer.off)) return false;
  let seed = 9176;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let a = 0; a < 5; a++) {
    const frame = compileFrame(state.design, state.group, (a + 0.37) / 5);
    for (let b = 0; b < 60; b++) {
      const [X, Y] = toCart(state.group, [rnd(), rnd()]);
      if (inkAt(frame, X, Y).ink === 0) return true;
    }
  }
  return false;
}

let addressTimer = 0;
function writeAddress() {
  clearTimeout(addressTimer);
  addressTimer = setTimeout(() => {
    const search = state.classId === DEFAULT_CLASS ? '' : `?class=${state.classId}`;
    history.replaceState(null, '', `${location.pathname}${search}#d=${encodeDesign(state.design)}`);
  }, 250);
}

function say(text, ms = 1800) {
  state.message = text;
  state.messageUntil = performance.now() + ms;
  state.needsDraw = true;
}

// ----------------------------------------------------------------- views --

function viewMetrics() {
  const w = canvas.width, hgt = canvas.height;
  return { w, h: hgt, upp: state.view.span / Math.max(1, Math.min(w, hgt)), dpr: canvas.width / Math.max(1, canvas.clientWidth) };
}
const toScreen = (vm, X, Y) => [(X - state.view.cx) / vm.upp + vm.w / 2, vm.h / 2 - (Y - state.view.cy) / vm.upp];
const toWorld = (vm, sx, sy) => [state.view.cx + (sx - vm.w / 2) * vm.upp, state.view.cy - (sy - vm.h / 2) * vm.upp];

function eventPoint(event) {
  const rect = overlay.getBoundingClientRect();
  const k = overlay.width / Math.max(1, rect.width);
  return [(event.clientX - rect.left) * k, (event.clientY - rect.top) * k];
}

function homeView() {
  const g = state.group;
  state.view = { cx: 0, cy: 0, span: 2.6 * Math.max(Math.hypot(g.basis[0][0], g.basis[0][1]), Math.hypot(g.basis[1][0], g.basis[1][1])) };
  state.needsDraw = true;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(viewport.clientWidth * dpr)), hgt = Math.max(2, Math.round(viewport.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== hgt) {
    canvas.width = w; canvas.height = hgt;
    overlay.width = w; overlay.height = hgt;
    state.needsDraw = true;
  }
}

// ------------------------------------------------------------ the copies --

/** A point of the seed's own frame, seen through copy (j, m). */
function copyToWorld(j, m, p) {
  const el = state.group.elements[j];
  const shift = toCart(state.group, m);
  return [el.Mc[0][0] * p[0] + el.Mc[0][1] * p[1] + el.vc[0] + shift[0], el.Mc[1][0] * p[0] + el.Mc[1][1] * p[1] + el.vc[1] + shift[1]];
}

/** The inverse: where in the seed's frame a point seen in copy (j, m) lies. */
function worldToSeed(j, m, X) {
  const el = state.group.elements[j];
  const shift = toCart(state.group, m);
  const dx = X[0] - el.vc[0] - shift[0], dy = X[1] - el.vc[1] - shift[1];
  return [el.Mc[0][0] * dx + el.Mc[1][0] * dy, el.Mc[0][1] * dx + el.Mc[1][1] * dy];
}

/** Carry a displacement from the screen's frame into the seed's. */
function deltaToSeed(j, d) {
  const el = state.group.elements[j];
  return [el.Mc[0][0] * d[0] + el.Mc[1][0] * d[1], el.Mc[0][1] * d[0] + el.Mc[1][1] * d[1]];
}

const seedTime = (j) => state.t - state.group.elements[j].tau;

/** Aim the handles at the copy of the selection nearest the middle of the view. */
function grabNearest(layer) {
  if (!layer || layer.k !== 's') return;
  const st = stateAt(layer, state.t, state.group);
  const lat = toLat(state.group, [state.view.cx - st.x, state.view.cy - st.y]);
  state.grab = { j: 0, m: [Math.round(lat[0]), Math.round(lat[1])] };
}

function select(id, grab) {
  state.sel = id;
  const layer = selected();
  if (grab) state.grab = grab; else grabNearest(layer);
  renderLayers();
  renderInspector();
  state.needsDraw = true;
}

// --------------------------------------------------------------- outlines --

const outlineCache = new Map();

/** The zero set of a shape's distance, as a path in its own frame. */
function outlinePath(layer) {
  const key = `${layer.sh}|${layer.r}|${layer.a}|${layer.n}|${layer.q}`;
  let path = outlineCache.get(key);
  if (path) return path;
  const type = SHAPE_INDEX.get(layer.sh) ?? 0;
  const b = shapeBound(layer) * 1.06, N = 72, step = (2 * b) / N;
  const value = new Float64Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) value[j * (N + 1) + i] = sdShape(type, -b + i * step, -b + j * step, layer.r, layer.a, layer.n, layer.q);
  }
  path = new Path2D();
  const lerp = (x0, y0, v0, x1, y1, v1) => { const f = v0 / (v0 - v1); return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]; };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x0 = -b + i * step, y0 = -b + j * step, x1 = x0 + step, y1 = y0 + step;
      const v00 = value[j * (N + 1) + i], v10 = value[j * (N + 1) + i + 1];
      const v01 = value[(j + 1) * (N + 1) + i], v11 = value[(j + 1) * (N + 1) + i + 1];
      const pts = [];
      if ((v00 < 0) !== (v10 < 0)) pts.push(lerp(x0, y0, v00, x1, y0, v10));
      if ((v10 < 0) !== (v11 < 0)) pts.push(lerp(x1, y0, v10, x1, y1, v11));
      if ((v01 < 0) !== (v11 < 0)) pts.push(lerp(x0, y1, v01, x1, y1, v11));
      if ((v00 < 0) !== (v01 < 0)) pts.push(lerp(x0, y0, v00, x0, y1, v01));
      for (let k = 0; k + 1 < pts.length; k += 2) { path.moveTo(pts[k][0], pts[k][1]); path.lineTo(pts[k + 1][0], pts[k + 1][1]); }
    }
  }
  if (outlineCache.size > 60) outlineCache.clear();
  outlineCache.set(key, path);
  return path;
}

const iconCache = new Map();
function shapeIcon(id, size = 26) {
  const key = `${id}|${size}`;
  if (iconCache.has(key)) {
    const copy = h('canvas', { width: size * 2, height: size * 2, class: 'icon' });
    copy.getContext('2d').drawImage(iconCache.get(key), 0, 0);
    return copy;
  }
  const def = shapeDef(id), type = SHAPE_INDEX.get(def.id);
  const px = size * 2, c = h('canvas', { width: px, height: px, class: 'icon' });
  const g = c.getContext('2d'), image = g.createImageData(px, px);
  const a = def.a ? def.a[2] : 0.5, n = def.n ? def.n[2] : 5, q = def.q ? def.q[2] : 0;
  const r = id === 'box' || id === 'cross' ? 0.62 : 0.86, soft = 2.4 / px;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const d = sdShape(type, (x + 0.5) / px * 2 - 1, 1 - (y + 0.5) / px * 2, r, a, n, q);
      image.data.set([31, 36, 48, Math.round(255 * clamp(0.5 - d / soft, 0, 1))], 4 * (y * px + x));
    }
  }
  g.putImageData(image, 0, 0);
  iconCache.set(key, c);
  return shapeIcon(id, size);
}

function waveIcon() {
  const c = h('canvas', { width: 52, height: 52, class: 'icon' }), g = c.getContext('2d');
  g.strokeStyle = '#1f2430'; g.lineWidth = 4; g.lineCap = 'round';
  for (const y of [15, 27, 39]) {
    g.beginPath();
    for (let x = 5; x <= 47; x++) g[x === 5 ? 'moveTo' : 'lineTo'](x, y + 4 * Math.sin((x - 5) / 42 * TAU * 1.5));
    g.stroke();
  }
  return c;
}

// ------------------------------------------------------------ the overlay --

function visibleTranslates(vm, ox, oy, reach) {
  const out = [];
  const pad = reach + 0.02;
  const corners = [[-vm.w / 2, -vm.h / 2], [vm.w / 2, -vm.h / 2], [-vm.w / 2, vm.h / 2], [vm.w / 2, vm.h / 2]].map(([sx, sy]) => toLat(state.group, [state.view.cx + sx * vm.upp - ox, state.view.cy + sy * vm.upp - oy]));
  const padL = pad / state.group.hmin;
  const lo0 = Math.ceil(Math.min(...corners.map((c) => c[0])) - padL), hi0 = Math.floor(Math.max(...corners.map((c) => c[0])) + padL);
  const lo1 = Math.ceil(Math.min(...corners.map((c) => c[1])) - padL), hi1 = Math.floor(Math.max(...corners.map((c) => c[1])) + padL);
  if ((hi0 - lo0 + 1) * (hi1 - lo1 + 1) > 400) return out;
  for (let a = lo0; a <= hi0; a++) for (let b = lo1; b <= hi1; b++) out.push([a, b]);
  return out;
}

function strokeBoth(width, colour, alpha = 1) {
  ctx.lineWidth = width * 2.6;
  ctx.strokeStyle = `rgba(255,255,255,${0.75 * alpha})`;
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCopyOutline(vm, shape, copy, m, width, colour, alpha) {
  if (copy.scale < 0.02) return;
  const shift = toCart(state.group, m);
  const ox = copy.ox + shift[0], oy = copy.oy + shift[1], s = copy.scale;
  ctx.save();
  ctx.setTransform(s * copy.q00 / vm.upp, -s * copy.q01 / vm.upp, s * copy.q10 / vm.upp, -s * copy.q11 / vm.upp,
    (ox - state.view.cx) / vm.upp + vm.w / 2, vm.h / 2 - (oy - state.view.cy) / vm.upp);
  const path = outlinePath(shape.layer);
  const unit = vm.upp / s;
  ctx.lineWidth = width * 2.6 * unit; ctx.strokeStyle = `rgba(255,255,255,${0.75 * alpha})`; ctx.stroke(path);
  ctx.lineWidth = width * unit; ctx.strokeStyle = colour; ctx.globalAlpha = alpha; ctx.stroke(path);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSymmetry(vm) {
  const g = state.group, dpr = vm.dpr;
  const corners = [[0, 0], [vm.w, 0], [0, vm.h], [vm.w, vm.h]].map(([sx, sy]) => toLat(g, toWorld(vm, sx, sy)));
  const lo0 = Math.floor(Math.min(...corners.map((c) => c[0]))) - 1, hi0 = Math.ceil(Math.max(...corners.map((c) => c[0]))) + 1;
  const lo1 = Math.floor(Math.min(...corners.map((c) => c[1]))) - 1, hi1 = Math.ceil(Math.max(...corners.map((c) => c[1]))) + 1;
  if ((hi0 - lo0) * (hi1 - lo1) > 900) return;
  // the lattice, drawn through the half-way lines so the origin's cell is whole
  ctx.beginPath();
  for (let a = lo0; a <= hi0; a++) {
    const p = toScreen(vm, ...toCart(g, [a + 0.5, lo1])), q = toScreen(vm, ...toCart(g, [a + 0.5, hi1]));
    ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
  }
  for (let b = lo1; b <= hi1; b++) {
    const p = toScreen(vm, ...toCart(g, [lo0, b + 0.5])), q = toScreen(vm, ...toCart(g, [hi0, b + 0.5]));
    ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
  }
  ctx.setLineDash([5 * dpr, 5 * dpr]);
  strokeBoth(1 * dpr, ACCENT, 0.75);
  ctx.setLineDash([]);
  const r = clamp(0.028 / vm.upp, 5 * dpr, 11 * dpr);
  for (const centre of state.centres) {
    for (let a = lo0; a <= hi0; a++) {
      for (let b = lo1; b <= hi1; b++) {
        const [sx, sy] = toScreen(vm, ...toCart(g, [centre.c[0] + a, centre.c[1] + b]));
        if (sx < -20 || sy < -20 || sx > vm.w + 20 || sy > vm.h + 20) continue;
        drawCentre(sx, sy, r, centre, dpr);
      }
    }
  }
}

function centrePath(sx, sy, r, order) {
  ctx.beginPath();
  if (order === 2) ctx.ellipse(sx, sy, r, r * 0.52, 0, 0, TAU);
  else {
    for (let k = 0; k < order; k++) {
      const a = -Math.PI / 2 + (order === 4 ? Math.PI / 4 : 0) + k * TAU / order;
      ctx[k ? 'lineTo' : 'moveTo'](sx + r * 1.12 * Math.cos(a), sy + r * 1.12 * Math.sin(a));
    }
    ctx.closePath();
  }
}

// A mark says what the turns about its point cost.  Solid: the turn is free.
// Hollow: it costs time.  Half and half: some turn here is free and swaps inks.
function drawCentre(sx, sy, r, centre, dpr) {
  centrePath(sx, sy, r + 2.2 * dpr, centre.order);
  ctx.fillStyle = '#fff';
  ctx.fill();
  centrePath(sx, sy, r, centre.order);
  ctx.fillStyle = centre.kind === 'static' ? '#1f2430' : '#fff';
  ctx.fill();
  if (centre.kind === 'anti') {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#1f2430';
    ctx.fillRect(sx, sy - 2 * r, 2 * r, 4 * r);
    ctx.restore();
    centrePath(sx, sy, r, centre.order);
  }
  ctx.lineWidth = 1.4 * dpr;
  ctx.strokeStyle = '#1f2430';
  ctx.stroke();
}

function dot(x, y, r, fill, stroke = '#fff', width = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawOverlay(frame) {
  const vm = viewMetrics(), dpr = vm.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  state.handles = [];
  if (state.recording) return;
  if (state.show.sym) drawSymmetry(vm);
  const sel = selected();
  if (state.show.outlines !== 'none') {
    for (const shape of frame.shapes) {
      const mine = sel && shape.layer.id === sel.id;
      if (!mine && state.show.outlines !== 'all') continue;
      const reach = shapeBound(shape.layer) * 2;
      for (const copy of shape.copies) {
        for (const m of visibleTranslates(vm, copy.ox, copy.oy, reach)) {
          const held = mine && copy.j === state.grab.j && m[0] === state.grab.m[0] && m[1] === state.grab.m[1];
          if (held) continue;
          drawCopyOutline(vm, shape, copy, m, (mine ? 1.2 : 1) * dpr, mine ? ACCENT : '#7b8496', mine ? 0.8 : 0.7);
        }
      }
    }
  }
  if (state.hover && (!sel || state.hover.shape.layer.id !== sel.id || state.hover.copy.j !== state.grab.j
    || state.hover.m[0] !== state.grab.m[0] || state.hover.m[1] !== state.grab.m[1])) {
    drawCopyOutline(vm, state.hover.shape, state.hover.copy, state.hover.m, 1.6 * dpr, '#e0913c', 1);
  }
  if (sel && sel.k === 's' && !sel.off) drawHandles(vm, frame, sel);
}

function drawHandles(vm, frame, layer) {
  const dpr = vm.dpr, g = state.group, { j, m } = state.grab;
  const shape = frame.shapes.find((s) => s.layer.id === layer.id);
  const copy = shape ? shape.copies.find((c) => c.j === j) : null;
  const t = seedTime(j);
  const st = stateAt(layer, t, g);
  const moves = layer.mv || [];
  const travels = moves.some((mv) => mv.m === 'o' || mv.m === 'w');
  const S = (p) => toScreen(vm, ...copyToWorld(j, m, p));
  // where the centre goes in a loop
  if (travels) {
    ctx.beginPath();
    for (let k = 0; k <= 120; k++) {
      const s = stateAt(layer, k / 120, g), p = S([s.x, s.y]);
      ctx[k ? 'lineTo' : 'moveTo'](p[0], p[1]);
    }
    ctx.setLineDash([3 * dpr, 4 * dpr]);
    strokeBoth(1.2 * dpr, ACCENT, 0.9);
    ctx.setLineDash([]);
  }
  if (copy) drawCopyOutline(vm, shape, copy, m, 2 * dpr, ACCENT, 1);
  const hr = 5.5 * dpr;
  moves.forEach((mv, index) => {
    const pivot = pivotAt(layer, t, g, index);
    if (mv.m === 'o') {
      const c = Math.cos(TAU * mv.tilt), s = Math.sin(TAU * mv.tilt);
      const end = [pivot[0] + mv.r * c, pivot[1] + mv.r * s];
      const a = S(pivot), b = S(end);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      strokeBoth(1 * dpr, ACCENT, 0.8);
      dot(b[0], b[1], hr, '#fff', ACCENT, 2 * dpr);
      state.handles.push({ kind: 'orbit', index, x: b[0], y: b[1], tip: 'the orbit: drag to set its radius and direction' });
    } else if (mv.m === 'w') {
      const pts = mv.pts.map((p) => S([pivot[0] + p[0], pivot[1] + p[1]]));
      ctx.beginPath();
      pts.forEach((p, k) => ctx[k ? 'lineTo' : 'moveTo'](p[0], p[1]));
      ctx.closePath();
      strokeBoth(1 * dpr, ACCENT, 0.5);
      pts.forEach((p, k) => {
        const next = pts[(k + 1) % pts.length];
        if (pts.length < 24) {
          const mid = [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2];
          dot(mid[0], mid[1], 3.2 * dpr, ACCENT, '#fff', 1.2 * dpr);
          state.handles.push({ kind: 'pathadd', index, k, x: mid[0], y: mid[1], tip: 'drag to add a point to the path' });
        }
      });
      pts.forEach((p, k) => {
        dot(p[0], p[1], hr, k === 0 ? ACCENT : '#fff', k === 0 ? '#fff' : ACCENT, 2 * dpr);
        state.handles.push({ kind: 'path', index, k, x: p[0], y: p[1], tip: 'a point of the path: drag it; double-click removes it' });
      });
    }
  });
  if (travels) {
    const p = S(pivotAt(layer, t, g, moves.findIndex((mv) => mv.m === 'o' || mv.m === 'w')));
    ctx.beginPath();
    ctx.moveTo(p[0] - 7 * dpr, p[1]); ctx.lineTo(p[0] + 7 * dpr, p[1]);
    ctx.moveTo(p[0], p[1] - 7 * dpr); ctx.lineTo(p[0], p[1] + 7 * dpr);
    strokeBoth(1.6 * dpr, ACCENT, 1);
    state.handles.push({ kind: 'pivot', x: p[0], y: p[1], tip: 'where the motion is anchored: drag to move all of it' });
  }
  if (copy) {
    const c = Math.cos(st.ang), s = Math.sin(st.ang), rad = layer.r * st.scale;
    const centre = S([st.x, st.y]), knob = S([st.x + rad * c, st.y + rad * s]);
    ctx.beginPath(); ctx.moveTo(centre[0], centre[1]); ctx.lineTo(knob[0], knob[1]);
    strokeBoth(1 * dpr, ACCENT, 0.7);
    dot(centre[0], centre[1], 2.6 * dpr, ACCENT, '#fff', 1.2 * dpr);
    ctx.beginPath();
    ctx.rect(knob[0] - hr, knob[1] - hr, 2 * hr, 2 * hr);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2 * dpr; ctx.strokeStyle = ACCENT; ctx.stroke();
    state.handles.push({ kind: 'size', x: knob[0], y: knob[1], tip: 'size and angle: drag (Shift keeps the angle)' });
  }
}

// --------------------------------------------------------------- pointers --

const pointers = new Map();
let drag = null;
let pinch = null;

function handleAt(px, py, slack) {
  let best = null;
  for (const hnd of state.handles) {
    const d = Math.hypot(hnd.x - px, hnd.y - py);
    if (d <= slack && (!best || d < best.d)) best = { ...hnd, d };
  }
  return best;
}

function specialPoints() {
  return state.centres.map((c) => c.c);
}

/** Pull an anchor onto a rotation centre when it is dropped next to one. */
function snapAnchor(at, vm, enabled) {
  if (!enabled) return { at, snapped: false };
  const slack = 9 * vm.dpr * vm.upp;
  let best = null;
  for (const p of specialPoints()) {
    const d0 = at[0] - p[0], d1 = at[1] - p[1];
    const near = [p[0] + Math.round(d0), p[1] + Math.round(d1)];
    const gap = toCart(state.group, [at[0] - near[0], at[1] - near[1]]);
    const dist = Math.hypot(gap[0], gap[1]);
    if (dist < slack && (!best || dist < best.dist)) best = { dist, at: near };
  }
  return best ? { at: best.at, snapped: true } : { at, snapped: false };
}

overlay.addEventListener('pointerdown', (event) => {
  if (event.button > 0) return;
  overlay.setPointerCapture(event.pointerId);
  const [px, py] = eventPoint(event);
  pointers.set(event.pointerId, [px, py]);
  const vm = viewMetrics();
  if (pointers.size === 2) {
    if (drag && drag.kind !== 'pan') commitEdit();
    drag = null; state.hold = false;
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), span: state.view.span, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    return;
  }
  const slack = (event.pointerType === 'touch' ? 18 : 9) * vm.dpr;
  const world = toWorld(vm, px, py);
  const layer = selected();
  const hnd = layer ? handleAt(px, py, slack) : null;
  if (hnd) {
    beginEdit();
    if (hnd.kind === 'pathadd') {
      const mv = layer.mv[hnd.index];
      const seedPoint = worldToSeed(state.grab.j, state.grab.m, world);
      const pivot = pivotAt(layer, seedTime(state.grab.j), state.group, hnd.index);
      mv.pts.splice(hnd.k + 1, 0, [seedPoint[0] - pivot[0], seedPoint[1] - pivot[1]]);
      drag = { kind: 'path', index: hnd.index, k: hnd.k + 1, moved: true };
    } else if (hnd.kind === 'pivot') {
      drag = { kind: 'body', start: world, at0: layer.at.slice(), moved: false, j: state.grab.j };
    } else drag = { ...hnd, moved: false };
    state.hold = drag.kind !== 'body';
    return;
  }
  const hit = state.frame ? hitTest(state.frame, world[0], world[1], 5 * vm.dpr * vm.upp) : null;
  if (hit) {
    if (state.sel !== hit.shape.layer.id || state.grab.j !== hit.copy.j || state.grab.m[0] !== hit.m[0] || state.grab.m[1] !== hit.m[1]) {
      select(hit.shape.layer.id, { j: hit.copy.j, m: hit.m });
    }
    beginEdit();
    drag = { kind: 'body', start: world, at0: hit.shape.layer.at.slice(), moved: false, j: hit.copy.j };
    return;
  }
  drag = { kind: 'pan', sx: px, sy: py, cx: state.view.cx, cy: state.view.cy, moved: false };
  overlay.classList.add('panning');
});

overlay.addEventListener('pointermove', (event) => {
  const [px, py] = eventPoint(event);
  const vm = viewMetrics();
  if (pointers.has(event.pointerId)) pointers.set(event.pointerId, [px, py]);
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const before = toWorld(vm, pinch.mid[0], pinch.mid[1]);
    state.view.span = clamp(pinch.span * pinch.dist / Math.max(dist, 1), 0.25, 14);
    const vm2 = viewMetrics(), after = toWorld(vm2, mid[0], mid[1]);
    state.view.cx += before[0] - after[0]; state.view.cy += before[1] - after[1];
    pinch.mid = mid; pinch.span = state.view.span; pinch.dist = dist;
    state.needsDraw = true;
    return;
  }
  if (!drag) { hoverAt(px, py, vm, event); return; }
  const world = toWorld(vm, px, py);
  const layer = selected();
  if (drag.kind === 'pan') {
    if (Math.hypot(px - drag.sx, py - drag.sy) > 4 * vm.dpr) drag.moved = true;
    state.view.cx = drag.cx - (px - drag.sx) * vm.upp;
    state.view.cy = drag.cy + (py - drag.sy) * vm.upp;
    state.needsDraw = true;
    return;
  }
  if (!layer) return;
  const { j, m } = state.grab;
  if (drag.kind === 'body') {
    const d = [world[0] - drag.start[0], world[1] - drag.start[1]];
    if (!drag.moved && Math.hypot(d[0], d[1]) < 4 * vm.dpr * vm.upp) return;
    drag.moved = true;
    const ds = toLat(state.group, deltaToSeed(drag.j, d));
    const snap = snapAnchor([drag.at0[0] + ds[0], drag.at0[1] + ds[1]], vm, !event.altKey);
    layer.at = snap.at;
    hud.textContent = snap.snapped ? 'on a rotation centre (Alt: no snapping)' : `at (${layer.at[0].toFixed(3)}, ${layer.at[1].toFixed(3)})`;
    syncInspector();
  } else if (drag.kind === 'size') {
    const t = seedTime(j), st = stateAt(layer, t, state.group);
    const p = worldToSeed(j, m, world), v = [p[0] - st.x, p[1] - st.y];
    layer.r = clamp(Math.hypot(v[0], v[1]) / Math.max(st.scale, 0.05), 0.01, 0.9);
    if (!event.shiftKey) layer.th = mod1(layer.th + (Math.atan2(v[1], v[0]) - st.ang) / TAU);
    drag.moved = true;
    hud.textContent = `size ${layer.r.toFixed(3)} · angle ${Math.round(layer.th * 360)}°`;
    syncInspector();
  } else if (drag.kind === 'orbit') {
    const mv = layer.mv[drag.index];
    const pivot = pivotAt(layer, seedTime(j), state.group, drag.index);
    const p = worldToSeed(j, m, world), v = [p[0] - pivot[0], p[1] - pivot[1]];
    mv.r = clamp(Math.hypot(v[0], v[1]), 0, 1.5);
    let tilt = mod1(Math.atan2(v[1], v[0]) / TAU);
    if (!event.altKey) { const q = Math.round(tilt * 24) / 24; if (Math.abs(q - tilt) < 0.008) tilt = mod1(q); }
    mv.tilt = tilt;
    drag.moved = true;
    hud.textContent = `orbit radius ${mv.r.toFixed(3)} · direction ${Math.round(mv.tilt * 360)}°`;
    syncInspector();
  } else if (drag.kind === 'path') {
    const mv = layer.mv[drag.index];
    const pivot = pivotAt(layer, seedTime(j), state.group, drag.index);
    const p = worldToSeed(j, m, world);
    mv.pts[drag.k] = [p[0] - pivot[0], p[1] - pivot[1]];
    drag.moved = true;
  }
  touch();
});

function endPointer(event) {
  pointers.delete(event.pointerId);
  if (pinch && pointers.size < 2) { pinch = null; drag = null; return; }
  if (!drag) return;
  const was = drag;
  drag = null;
  state.hold = false;
  overlay.classList.remove('panning');
  if (was.kind === 'pan') {
    if (!was.moved && state.sel !== null) select(null);
    return;
  }
  commitEdit();
  renderInspector();
  state.needsDraw = true;
}
overlay.addEventListener('pointerup', endPointer);
overlay.addEventListener('pointercancel', endPointer);

function hoverAt(px, py, vm, event) {
  const slack = (event.pointerType === 'touch' ? 18 : 9) * vm.dpr;
  const hnd = selected() ? handleAt(px, py, slack) : null;
  let hover = null;
  if (!hnd && state.frame) {
    const world = toWorld(vm, px, py);
    hover = hitTest(state.frame, world[0], world[1], 4 * vm.dpr * vm.upp);
  }
  overlay.classList.toggle('over-handle', Boolean(hnd));
  overlay.classList.toggle('over-shape', Boolean(hover) && !hnd);
  const changed = (hover ? `${hover.shape.layer.id}|${hover.copy.j}|${hover.m}` : '') !== (state.hover ? `${state.hover.shape.layer.id}|${state.hover.copy.j}|${state.hover.m}` : '');
  state.hover = hover;
  if (hnd) state.hoverText = hnd.tip;
  else if (hover) {
    const el = state.group.elements[hover.copy.j];
    const what = hover.copy.j === 0 ? 'the shape itself' : `a copy: ${describeElement(el)}`;
    state.hoverText = `${layerLabel(hover.shape.layer)} — ${what}`;
  } else state.hoverText = '';
  if (changed || hnd) state.needsDraw = true;
  refreshHud();
}
overlay.addEventListener('pointerleave', () => { state.hover = null; state.hoverText = ''; state.needsDraw = true; refreshHud(); });

overlay.addEventListener('wheel', (event) => {
  event.preventDefault();
  const vm = viewMetrics(), [px, py] = eventPoint(event);
  const before = toWorld(vm, px, py);
  const factor = Math.exp(clamp(event.deltaY, -120, 120) * (event.ctrlKey ? 0.012 : 0.0022));
  state.view.span = clamp(state.view.span * factor, 0.25, 14);
  const after = toWorld(viewMetrics(), px, py);
  state.view.cx += before[0] - after[0]; state.view.cy += before[1] - after[1];
  state.needsDraw = true;
}, { passive: false });

overlay.addEventListener('dblclick', (event) => {
  const vm = viewMetrics(), [px, py] = eventPoint(event);
  const layer = selected();
  const hnd = layer ? handleAt(px, py, 9 * vm.dpr) : null;
  if (hnd && hnd.kind === 'path') {
    const mv = layer.mv[hnd.index];
    if (mv.pts.length > 2) edit(() => { mv.pts.splice(hnd.k, 1); });
    return;
  }
  const world = toWorld(vm, px, py);
  if (state.frame && hitTest(state.frame, world[0], world[1], 4 * vm.dpr * vm.upp)) return;
  addShape(toLat(state.group, world));
});

// ----------------------------------------------------------------- adding --

function hasGround() {
  return state.design.L.some((layer) => !layer.off && (layer.k === 'w' || layer.role === 'f'));
}

function addShape(at) {
  const vm = viewMetrics();
  const where = at || toLat(state.group, [state.view.cx + 0.11 * vm.upp * vm.w, state.view.cy + 0.07 * vm.upp * vm.h]);
  const ground = hasGround();
  const layer = normaliseLayer({
    k: 's', role: ground ? 's' : 'f', sh: 'disc', r: ground ? 0.09 : 0.11, h: ground ? 0.004 : 0.03,
    at: [Math.round(where[0] * 100) / 100, Math.round(where[1] * 100) / 100],
    mv: [{ m: 'o', r: 0.12, e: 1, tilt: 0, k: 1, ph: 0 }],
  });
  edit(() => { layer.id = ++uid; state.design.L.push(layer); });
  select(layer.id);
  say(ground ? 'A stamp, circling. Drag it; change it on the right.' : 'A flood, circling. Drag it; change it on the right.', 2600);
}

function addWave() {
  const used = new Set(state.design.L.filter((l) => l.k === 'w').map((l) => `${l.p}`));
  const p = [[1, 0], [1, 1], [2, 1], [2, 0], [3, 1]].find((cand) => !used.has(`${cand}`)) || [1, 2];
  const layer = normaliseLayer({ k: 'w', p, nu: 1, amp: 0.15, ph: 0 });
  edit(() => { layer.id = ++uid; state.design.L.push(layer); });
  select(layer.id);
}

function removeLayer(id) {
  edit(() => { state.design.L = state.design.L.filter((layer) => layer.id !== id); });
  if (state.sel === id) select(null);
}

function duplicateLayer(id) {
  const source = layerById(id);
  if (!source) return;
  const copy = normaliseLayer(JSON.parse(JSON.stringify(source)));
  if (copy.k === 's') copy.at = [copy.at[0] + 0.08, copy.at[1] + 0.05];
  else copy.ph = mod1(copy.ph + 0.25);
  edit(() => { copy.id = ++uid; state.design.L.splice(state.design.L.indexOf(source) + 1, 0, copy); });
  select(copy.id);
}

// ------------------------------------------------------------- the layers --

const ROLE_NAME = { f: 'flood', s: 'stamp', i: 'invert' };

function renderLayers() {
  const list = $('#layers');
  list.replaceChildren(...state.design.L.map((layer) => {
    const li = h('li', {
      class: `${layer.id === state.sel ? 'sel' : ''} ${layer.off ? 'hidden-layer' : ''}`.trim(),
      tabindex: 0, 'aria-current': layer.id === state.sel ? 'true' : null,
      onclick: () => select(layer.id),
      onkeydown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(layer.id); } },
    },
    layer.k === 'w' ? waveIcon() : shapeIcon(layer.sh),
    h('span', { class: 'name', text: layerLabel(layer) }),
    state.vanish.get(layer.id) ? h('span', { class: 'flag', title: 'the group cancels this layer: see the note in its settings', text: 'cancels' }) : null,
    h('span', { class: 'role', text: layer.k === 'w' ? 'wave' : ROLE_NAME[layer.role] }),
    h('button', { type: 'button', title: layer.off ? 'show' : 'hide', 'aria-label': layer.off ? 'Show layer' : 'Hide layer', text: layer.off ? '○' : '●',
      onclick: (event) => { event.stopPropagation(); edit(() => { if (layer.off) delete layer.off; else layer.off = 1; }); } }),
    h('button', { type: 'button', title: 'duplicate (D)', 'aria-label': 'Duplicate layer', text: '⧉', onclick: (event) => { event.stopPropagation(); duplicateLayer(layer.id); } }),
    h('button', { type: 'button', title: 'remove (Delete)', 'aria-label': 'Remove layer', text: '✕', onclick: (event) => { event.stopPropagation(); removeLayer(layer.id); } }));
    return li;
  }));
  const n = state.design.L.length;
  $('#layers-hint').textContent = n === 0 ? 'No layers yet.'
    : !hasGround() ? 'Only stamps and inverters so far: the grey is ground nothing has claimed. A flood or a wave fills it.'
      : state.grey ? 'The grey is ground where a white copy and a black one are exactly equally near, so neither has it. Another flood, or a faint wave, settles it.'
        : '';
}

// ---------------------------------------------------------- the inspector --

const live = [];                // functions that re-read the design into the controls

function syncInspector() { for (const fn of live) fn(); }

function field(label, control, output) {
  return h('label', { class: output ? 'field' : 'field two' }, h('span', { text: label }), control, output);
}

function slider(label, get, set, { min, max, step = 0.001, fmt = (v) => v.toFixed(2), log = false, title } = {}) {
  const toPos = (v) => (log ? Math.log(v / min) / Math.log(max / min) : v);
  const fromPos = (p) => (log ? min * (max / min) ** p : p);
  const input = h('input', { type: 'range', min: log ? 0 : min, max: log ? 1 : max, step: log ? 0.001 : step, title });
  const out = h('output');
  const read = () => { const v = get(); input.value = String(toPos(clamp(v, min, max))); out.textContent = fmt(v); };
  input.addEventListener('input', () => { beginEdit(); set(fromPos(Number(input.value))); out.textContent = fmt(get()); touch(); });
  input.addEventListener('change', () => { commitEdit({ structure: false }); });
  read();
  live.push(read);
  return field(label, input, out);
}

function choice(label, options, get, set) {
  const select_ = h('select', {}, options.map(([value, text]) => h('option', { value: String(value), text })));
  const read = () => { select_.value = String(get()); };
  select_.addEventListener('change', () => { edit(() => set(select_.value), { structure: false }); });
  read();
  live.push(read);
  return field(label, select_);
}

function segmented(options, get, set) {
  const wrap = h('div', { class: 'seg', role: 'group' });
  const buttons = options.map(([value, text, title]) => h('button', { type: 'button', text, title, onclick: () => { if (get() !== value) edit(() => set(value)); } }));
  wrap.append(...buttons);
  const read = () => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === get())));
  read();
  live.push(read);
  return wrap;
}

const RATE_ODD = [[-3, '3 ↻'], [-2, '2 ↻'], [-1, '1 ↻'], [1, '1 ↺'], [2, '2 ↺'], [3, '3 ↺']];
const RATE_PLAIN = [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];
const turns = (v) => `${Math.round(v * 360)}°`;

function spinRates(layer) {
  const sym = shapeSymmetry(layer);
  const set = new Set([1, 2, 3]);
  if (sym > 1) { set.add(1 / sym); if (sym % 2 === 0) set.add(0.5); if (sym >= 4) set.add(2 / sym); }
  const list = [...set].sort((a, b) => a - b);
  const name = (v) => (Number.isInteger(v) ? String(v) : Math.abs(v - 0.5) < 1e-9 ? '½' : Math.abs(v - 0.25) < 1e-9 ? '¼' : Math.abs(v - 1 / 3) < 1e-9 ? '⅓' : Math.abs(v - 2 / 3) < 1e-9 ? '⅔' : v.toFixed(3).replace(/0+$/, ''));
  return [...list.slice().reverse().map((v) => [-v, `${name(v)} ↻`]), ...list.map((v) => [v, `${name(v)} ↺`])];
}

const ROLE_NOTE = {
  f: 'Flood: each copy claims the ground nearer to it than to any copy in the other ink.',
  s: 'Stamp: the copies sit on top as themselves; where a white and a black one overlap, the deeper keeps the ground.',
  i: 'Invert: whatever lies under a copy changes ink.',
};

const VANISH_NOTE = {
  wave: 'The group cancels this wave: its copies add up to nothing. Give it an odd number of turns per loop, or another direction.',
  shape: 'The group cancels this layer: every white copy lies exactly on a black one. A shape must move with an odd rate somewhere (a motion that repeats every half loop meets its own negative), and a shape that sits on a rotation centre must not look the same after that centre’s turn.',
};

/** The note that a layer is cancelled; it comes and goes as the sliders move. */
function warning(layer, text) {
  const box = h('p', { class: 'warn', text, role: 'note' });
  const read = () => { box.hidden = !state.vanish.get(layer.id); };
  read();
  live.push(read);
  return box;
}

function moveCard(layer, mv, index) {
  const def = MOVES.find((d) => d.id === mv.m);
  const body = [];
  if (mv.m === 'o') {
    body.push(slider('radius', () => mv.r, (v) => { mv.r = v; }, { min: 0, max: 0.75, fmt: (v) => v.toFixed(3) }));
    body.push(slider('roundness', () => mv.e, (v) => { mv.e = Math.abs(v) < 0.04 ? 0 : v; }, { min: -1, max: 1, step: 0.01, fmt: (v) => (v === 0 ? 'line' : Math.abs(v) === 1 ? 'circle' : v.toFixed(2)), title: '1: a circle; 0: to and fro along a line; negative: the other way round' }));
    body.push(slider('direction', () => mv.tilt, (v) => { mv.tilt = v; }, { min: 0, max: 1, step: 1 / 360, fmt: turns }));
    body.push(choice('laps a loop', RATE_ODD, () => mv.k, (v) => { mv.k = Number(v); }));
    body.push(slider('start', () => mv.ph, (v) => { mv.ph = v; }, { min: 0, max: 1, step: 1 / 96, fmt: (v) => v.toFixed(2), title: 'where on the orbit it is when the loop starts' }));
  } else if (mv.m === 'w') {
    body.push(h('p', { class: 'hint', text: `${mv.pts.length} points. Drag them on the film; drag a small dot to add one; double-click a point to remove it.` }));
    body.push(choice('laps a loop', RATE_ODD, () => mv.k, (v) => { mv.k = Number(v); }));
    body.push(slider('pause', () => mv.ease, (v) => { mv.ease = v; }, { min: 0, max: 1, step: 0.01, fmt: (v) => v.toFixed(2), title: '0: steady speed; 1: slows to a stop at every point' }));
    body.push(slider('start', () => mv.ph, (v) => { mv.ph = v; }, { min: 0, max: 1, step: 1 / 96, fmt: (v) => v.toFixed(2) }));
  } else if (mv.m === 's') {
    const rates = spinRates(layer);
    if (!rates.some(([v]) => Math.abs(v - mv.k) < 1e-9)) rates.push([mv.k, `${mv.k}`]);
    body.push(choice('turns a loop', rates.map(([v, text]) => [v, text]), () => mv.k, (v) => { mv.k = Number(v); }));
    if (shapeSymmetry(layer) === 0) body.push(h('p', { class: 'hint', text: 'A round shape looks the same however it is turned.' }));
  } else if (mv.m === 'r') {
    body.push(slider('swing', () => mv.amp, (v) => { mv.amp = v; }, { min: 0, max: 0.5, step: 1 / 360, fmt: (v) => `±${Math.round(v * 360)}°` }));
    body.push(choice('times a loop', RATE_PLAIN, () => mv.k, (v) => { mv.k = Number(v); }));
    body.push(slider('start', () => mv.ph, (v) => { mv.ph = v; }, { min: 0, max: 1, step: 1 / 96, fmt: (v) => v.toFixed(2) }));
  } else if (mv.m === 'p') {
    body.push(slider('amount', () => mv.amt, (v) => { mv.amt = v; }, { min: 0, max: 0.95, step: 0.01, fmt: (v) => `±${Math.round(v * 100)}%` }));
    body.push(choice('times a loop', RATE_PLAIN, () => mv.k, (v) => { mv.k = Number(v); }));
    body.push(slider('start', () => mv.ph, (v) => { mv.ph = v; }, { min: 0, max: 1, step: 1 / 96, fmt: (v) => v.toFixed(2) }));
  } else if (mv.m === 'b') {
    body.push(slider('appears at', () => mv.on, (v) => { mv.on = v; }, { min: 0, max: 1, step: 1 / 96, fmt: (v) => v.toFixed(2) }));
    body.push(slider('stays for', () => mv.dur, (v) => { mv.dur = v; }, { min: 0.04, max: 1, step: 0.01, fmt: (v) => v.toFixed(2), title: 'the share of the loop it is there' }));
    body.push(choice('times a loop', RATE_PLAIN, () => mv.k, (v) => { mv.k = Number(v); }));
  }
  return h('div', { class: 'move' },
    h('div', { class: 'move-head' }, h('b', { text: def.label }),
      h('button', { type: 'button', title: 'remove this motion', 'aria-label': `Remove ${def.label}`, text: '✕', onclick: () => { edit(() => { layer.mv.splice(index, 1); }); } })),
    body);
}

const FOCUSABLE = 'button, input, select';

function renderInspector() {
  const box = $('#inspector');
  // a rebuilt inspector should not take the keyboard away from where it was
  const before = [...box.querySelectorAll(FOCUSABLE)];
  const at = before.indexOf(document.activeElement);
  const tag = at >= 0 ? before[at].tagName : '';
  buildInspector(box);
  if (at >= 0) {
    const after = [...box.querySelectorAll(FOCUSABLE)];
    if (after[at] && after[at].tagName === tag) after[at].focus({ preventScroll: true });
  }
}

function buildInspector(box) {
  live.length = 0;
  const layer = selected();
  if (!layer) {
    fill(box, 
      h('h2', { text: 'Nothing selected' }),
      h('p', { class: 'hint', text: 'Click a shape on the film, or a layer above. Any copy will do: the group’s copies are all handles on the same shape.' }),
    );
    return;
  }
  if (layer.k === 'w') {
    fill(box, 
      h('h3', {}, waveIcon(), 'Wave'),
      warning(layer, VANISH_NOTE.wave),
      h('p', { class: 'role-note', text: 'A plane wave and the copies the group makes of it, added to the ground.' }),
      slider('crests in x', () => layer.p[0], (v) => { layer.p[0] = Math.round(v); }, { min: -4, max: 4, step: 1, fmt: (v) => String(Math.round(v)), title: 'crests per cell along the first lattice direction' }),
      slider('crests in y', () => layer.p[1], (v) => { layer.p[1] = Math.round(v); }, { min: -4, max: 4, step: 1, fmt: (v) => String(Math.round(v)), title: 'crests per cell along the second lattice direction' }),
      choice('beats a loop', [[-5, '5, backwards'], [-3, '3, backwards'], [-2, '2, backwards'], [-1, '1, backwards'], [1, '1'], [2, '2'], [3, '3'], [5, '5']], () => layer.nu, (v) => { layer.nu = Number(v); }),
      slider('strength', () => layer.amp, (v) => { layer.amp = v; }, { min: 0, max: 0.6, step: 0.005, fmt: (v) => v.toFixed(3), title: 'against a flood, about how far it pushes an outline' }),
      slider('start', () => layer.ph, (v) => { layer.ph = v; }, { min: 0, max: 1, step: 1 / 96, fmt: (v) => v.toFixed(2) }),
    );
    return;
  }
  const def = shapeDef(layer.sh);
  const extra = [];
  if (def.n) extra.push(slider(def.n[3], () => layer.n, (v) => { layer.n = Math.round(v); }, { min: def.n[0], max: def.n[1], step: 1, fmt: (v) => String(Math.round(v)) }));
  if (def.a) extra.push(slider(def.a[3], () => layer.a, (v) => { layer.a = v; }, { min: def.a[0], max: def.a[1], step: 0.005, fmt: (v) => v.toFixed(2) }));
  if (def.q) extra.push(slider(def.q[3], () => layer.q, (v) => { layer.q = v; }, { min: def.q[0], max: def.q[1], step: 0.01, fmt: (v) => v.toFixed(2) }));
  const note = h('p', { class: 'role-note', text: ROLE_NOTE[layer.role] });
  live.push(() => { note.textContent = ROLE_NOTE[layer.role]; });
  const number = (get, set, title) => {
    const input = h('input', { type: 'number', step: 0.01, title });
    const read = () => { if (document.activeElement !== input) input.value = String(Math.round(get() * 1000) / 1000); };
    input.addEventListener('change', () => { const v = Number(input.value); if (Number.isFinite(v)) edit(() => set(v)); });
    read(); live.push(read);
    return input;
  };
  const centreButtons = state.centres.slice().sort((a, b) => b.order - a.order || a.c[0] - b.c[0] || a.c[1] - b.c[1]).map((centre) => h('button', {
    type: 'button', title: `a ${centre.order}-fold centre`, text: `${centre.order}: (${fractionGlyph(centre.c[0])}, ${fractionGlyph(centre.c[1])})`,
    onclick: () => edit(() => { layer.at = centre.c.slice(); }),
  }));
  fill(box, 
    h('h3', {}, shapeIcon(layer.sh), layerLabel(layer)),
    warning(layer, VANISH_NOTE.shape),
    segmented([['f', 'Flood'], ['s', 'Stamp'], ['i', 'Invert']], () => layer.role, (v) => { layer.role = v; if (v !== 'f' && layer.h > 0.03) layer.h = 0.004; if (v === 'f' && layer.h < 0.01) layer.h = 0.03; }),
    note,
    layer.role === 'i' ? null : field('ink', segmented([[0, 'starts white'], [1, 'starts black']], () => layer.ink, (v) => { layer.ink = v; })),
    h('h4', { text: 'Shape' }),
    h('div', { class: 'shape-grid' }, SHAPES.map((s) => {
      const button = h('button', { type: 'button', title: s.label, 'aria-label': s.label, onclick: () => { if (layer.sh !== s.id) edit(() => { Object.assign(layer, normaliseLayer({ ...layer, sh: s.id, a: undefined, n: undefined, q: undefined }), { id: layer.id }); }); } }, shapeIcon(s.id));
      button.setAttribute('aria-pressed', String(s.id === layer.sh));
      return button;
    })),
    slider('size', () => layer.r, (v) => { layer.r = v; }, { min: 0.01, max: 0.6, fmt: (v) => v.toFixed(3) }),
    extra,
    slider('angle', () => layer.th, (v) => { layer.th = v; }, { min: 0, max: 1, step: 1 / 360, fmt: turns }),
    layer.role === 'i' ? null : slider('edge', () => layer.h, (v) => { layer.h = v; }, { min: 0.002, max: 0.25, log: true, fmt: (v) => (v < 0.006 ? 'crisp' : v.toFixed(3)), title: layer.role === 'f' ? 'crisp: straight frontiers between copies; soft: they round off and merge' : 'soft: copies in the same ink merge like drops' }),
    h('h4', { text: 'Place' }),
    field('at', h('span', { class: 'pair' }, number(() => layer.at[0], (v) => { layer.at[0] = v; }, 'along the first lattice direction, in cells'), number(() => layer.at[1], (v) => { layer.at[1] = v; }, 'along the second'))),
    field('centres', h('span', { class: 'pair' }, centreButtons)),
    h('h4', { text: 'Motion' }),
    (layer.mv || []).map((mv, index) => moveCard(layer, mv, index)),
    (layer.mv || []).length === 0 ? h('p', { class: 'hint', text: 'It stands still, and in this class nothing may: add a motion.' }) : null,
    h('div', { class: 'add-moves' }, MOVES.map((d) => h('button', { type: 'button', title: d.hint, text: `+ ${d.label}`, onclick: () => { edit(() => { layer.mv.push(newMove(d.id)); }); } }))),
  );
}

// ---------------------------------------------------------- the group card --

function renderGroupCard() {
  const g = state.group, known = KNOWN[g.id];
  const ops = g.elements.slice(1).map((el) => ({ text: describeElement(el), s: el.s }));
  const steps = [];
  if (g.u[0]) steps.push('a step along the first lattice direction swaps the inks');
  if (g.u[1]) steps.push('a step along the second lattice direction swaps the inks');
  const sigma = Object.entries(g.cls.col).map(([name, value]) => `${name} ↦ ${value}`).join(', ');
  const card = $('#group-card');
  fill(card, 
    h('p', { class: 'sig', text: `${g.id}` }),
    h('p', { class: 'sub', text: known ? known.lede : `${g.film.family} · film ${g.gid}, ${g.film.signature} (${g.film.sgName}), in two inks. σ: ${sigma}; one period ↦ ${g.cls.ct}.` }),
    known ? h('ul', {}, known.rules.map(([kind, text]) => h('li', {}, h('i', { class: kind }), h('span', { text })))) : null,
    known ? h('p', { class: 'sub', style: 'margin-top:0.4rem', text: known.after }) : null,
    h('details', { open: known ? null : true },
      h('summary', { text: `What the group does to a shape: ${ops.length} cop${ops.length === 1 ? 'y' : 'ies'} a cell` }),
      h('ul', { class: 'ops' }, ops.map((op) => h('li', {}, h('i', { class: op.s ? 'swap' : 'keep' }), h('span', { text: op.text }))), steps.map((text) => h('li', {}, h('i', { class: 'swap' }), h('span', { text })))),
    ),
    h('p', { class: 'links' }, (known ? known.links : [[`../#${g.film.family}/${g.gid}/${g.id}`, 'this class in the census']]).flatMap(([href, text], i) => [i ? ' · ' : '', h('a', { href, text })])),
  );
  $('#class-chip').textContent = g.id;
  const note = [];
  if (g.m === 2) note.push('Four frames on: the negative.');
  const turn = g.elements.find((el) => el.det > 0 && !el.isIdentity && el.s === 0 && el.tau > 0 && Math.abs(el.tau * 8 - Math.round(el.tau * 8)) < 1e-9);
  const quarter = g.elements.find((el) => el.s === 0 && Math.abs(el.tau - 0.25) < 1e-9 && el.det > 0 && Math.abs(el.Mc[0][0]) < 1e-9);
  if (quarter) note.unshift('Two frames on: the same picture, a quarter turn round.');
  else if (turn) note.unshift(`${Math.round(turn.tau * 8)} frame${Math.round(turn.tau * 8) === 1 ? '' : 's'} on: the same picture, ${describeElement(turn).split(' · ')[0]}.`);
  $('#strip-note').textContent = note.join(' ');
  fill($('#how'), 
    h('p', { text: 'A design is a list of shapes, each with a motion that closes after one loop, and of waves. The group makes copies of each: one for every operation above, in every cell. A copy is the shape as it was a little earlier, turned or shifted, and in the other ink when the operation swaps inks.' }),
    h('p', { text: 'Floods and waves make the ground. Among the floods every point goes to the nearest copy, so black and white always share the plane half and half; a soft edge rounds the frontiers. A wave is added to that contest and bends it.' }),
    h('p', { text: 'Stamps sit on the ground as themselves, and inverters swap the inks under them. Whatever you draw, the film has exactly the symmetry of the class: the copies are made by the group, not fitted to it.' }),
    h('p', { text: 'A layer the group forces to nothing is flagged “cancels”. That is the group’s selection rule at work, the same one that says which waves a crystal may carry. The same rule, in part, leaves grey: ground where a white copy and a black one are exactly equally near belongs to neither.' }),
  );
}

// ------------------------------------------------------------- transport --

const stripFrames = [];
const STRIP_LABELS = ['0', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

function buildStrip() {
  const strip = $('#strip');
  strip.replaceChildren();
  stripFrames.length = 0;
  for (let k = 0; k < 8; k++) {
    const c = h('canvas', { width: 128, height: 128 });
    const button = h('button', { type: 'button', title: `go to ${STRIP_LABELS[k]} of the loop`, 'aria-label': `Frame at ${STRIP_LABELS[k]} of the loop`, onclick: () => { state.t = k / 8; setPlaying(false); state.needsDraw = true; } }, c, h('span', { text: STRIP_LABELS[k] }));
    strip.append(button);
    stripFrames.push({ canvas: c, ctx: c.getContext('2d'), button });
  }
}

function drawStrip() {
  const size = 128;
  if (canvas.width < size || canvas.height < size) return;
  const g = state.group;
  const edge = Math.max(Math.hypot(g.basis[0][0], g.basis[0][1]), Math.hypot(g.basis[1][0], g.basis[1][1]));
  const view = { cx: 0, cy: 0, upp: 2 * edge / size };
  stripFrames.forEach((slot, k) => {
    renderer.render(compileFrame(state.design, g, k / 8), view, { port: [0, 0, size, size], quality: cellQuality(view.upp, 512), palette: state.design.pal });
    slot.ctx.drawImage(canvas, 0, canvas.height - size, size, size, 0, 0, size, size);
  });
  state.stripDirty = false;
}

/**
 * How many texels the cell texture should have across: as many as the device
 * pixels it will be spread over, and no more.  A finer texture would be read
 * with gaps between the samples, which shows as speckle wherever the field is
 * steep.
 */
function cellQuality(upp, cap) {
  const cells = state.group.u[0] || state.group.u[1] ? 2 : 1;
  const want = cells * state.group.hmin / upp;
  return clamp(Math.ceil(want / 32) * 32, 64, cap);
}

function setPlaying(on) {
  state.playing = on;
  const button = $('#play');
  button.textContent = on ? '❚❚' : '▶';
  button.setAttribute('aria-label', on ? 'Pause' : 'Play');
  button.setAttribute('aria-pressed', String(on));
  state.needsDraw = true;
}

function syncDesignControls() {
  const loop = $('#loop');
  if (![...loop.options].some((o) => Number(o.value) === state.design.loop)) loop.append(h('option', { value: String(state.design.loop), text: `${state.design.loop} s` }));
  loop.value = String(state.design.loop);
  $('#palette').value = PALETTES[state.design.pal] ? state.design.pal : 'bw';
}

function syncButtons() {
  $('#undo').disabled = state.undo.length === 0;
  $('#redo').disabled = state.redo.length === 0;
}

function refreshHud() {
  const now = performance.now();
  let text = '';
  if (state.recording) text = `Recording the loop… ${Math.round(state.recording.progress * 100)}%`;
  else if (state.message && now < state.messageUntil) text = state.message;
  else if (state.hoverText) text = state.hoverText;
  // while a shape or a handle is dragged the line says what the drag is doing
  if (!drag || drag.kind === 'pan') hud.textContent = text;
}

// ------------------------------------------------------------------ frame --

let last = performance.now();

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(100, now - last);
  last = now;
  if (!state.design || !renderer) return;
  resize();
  const advancing = state.playing && !state.hold && !state.scrubbing;
  if (advancing) {
    state.t = mod1(state.t + dt / (1000 * state.design.loop));
    // let a slow machine have a coarser cell rather than a slower film
    if (dt > 30) { state.slow += 1; state.fast = 0; } else if (dt < 19) { state.fast += 1; state.slow = Math.max(0, state.slow - 1); }
    if (state.slow > 24 && state.qualityCap > 256) { state.qualityCap = Math.max(256, state.qualityCap - 128); state.slow = 0; }
    if (state.fast > 240 && state.qualityCap < 1024) { state.qualityCap += 128; state.fast = 0; }
  }
  if (state.recording) stepRecording();
  if (state.message && now > state.messageUntil) { state.message = ''; refreshHud(); }
  if (!advancing && !state.needsDraw && !state.stripDirty) return;
  const frame = compileFrame(state.design, state.group, state.t);
  state.frame = frame;
  if (state.stripDirty && (now - state.stripAt > 300 || !advancing) && !drag && !state.recording) { drawStrip(); state.stripAt = now; }
  const vm = viewMetrics();
  const quality = cellQuality(vm.upp, advancing || drag ? state.qualityCap : 2048);
  renderer.render(frame, { cx: state.view.cx, cy: state.view.cy, upp: vm.upp }, { quality, palette: state.design.pal });
  drawOverlay(frame);
  state.needsDraw = false;
  if (!state.scrubbing) $('#scrub').value = String(Math.round(state.t * 1000));
  $('#clock').textContent = state.t.toFixed(3);
  const near = Math.round(state.t * 8) % 8;
  stripFrames.forEach((slot, k) => slot.button.classList.toggle('now', !state.playing && k === near && Math.abs(state.t * 8 - Math.round(state.t * 8)) < 1e-6));
  refreshHud();
}

// ----------------------------------------------------------------- export --

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function exportPng() {
  const frame = compileFrame(state.design, state.group, state.t);
  const vm = viewMetrics();
  renderer.render(frame, { cx: state.view.cx, cy: state.view.cy, upp: vm.upp }, { quality: cellQuality(vm.upp, 2048), palette: state.design.pal });
  canvas.toBlob((blob) => { if (blob) download(blob, `studio-${state.classId}.png`); state.needsDraw = true; }, 'image/png');
}

function exportVideo() {
  if (state.recording) return;
  const type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!type || !canvas.captureStream) { say('This browser cannot record the canvas.', 3200); return; }
  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8e6 });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    download(new Blob(chunks, { type }), `studio-${state.classId}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`);
    state.recording = null;
    state.needsDraw = true;
    say('Saved one loop.');
  };
  state.t = 0;
  setPlaying(true);
  state.recording = { recorder, start: performance.now(), progress: 0 };
  recorder.start();
}

function stepRecording() {
  const rec = state.recording;
  rec.progress = (performance.now() - rec.start) / (1000 * state.design.loop);
  if (rec.progress >= 1 && rec.recorder.state === 'recording') rec.recorder.stop();
}

function exportJson() {
  const text = JSON.stringify(JSON.parse(snapshot()), null, 1);
  download(new Blob([text], { type: 'application/json' }), `studio-${state.classId}.json`);
}

// ---------------------------------------------------------------- dialogs --

function openDesigns() {
  const box = $('#designs');
  const entries = [
    ...PRESETS.map((p) => ({ name: p.name, blurb: p.blurb, design: p.design })),
    { name: 'Census film', blurb: 'The film this class has on the Shubnikov page, as the waves it is made of. Each is a layer you can change.', design: censusFilm(state.group.cls) },
    { name: 'Blank', blurb: 'Nothing yet.', design: { L: [] } },
  ];
  const size = 220;
  fill(box, ...entries.map((entry) => {
    const c = h('canvas', { width: size, height: size });
    const design = normaliseDesign(entry.design, state.classId);
    const button = h('button', { type: 'button', onclick: () => { $('#designs-dialog').close(); loadDesign(entry.design, { name: entry.name }); homeView(); } }, c, h('b', { text: entry.name }), h('span', { text: entry.blurb }));
    button.dataset.name = entry.name;
    c._design = design;
    return button;
  }));
  $('#designs-dialog').showModal();
  requestAnimationFrame(() => {
    const g = state.group, edge = Math.max(Math.hypot(g.basis[0][0], g.basis[0][1]), Math.hypot(g.basis[1][0], g.basis[1][1]));
    if (canvas.width < size || canvas.height < size) return;
    for (const c of box.querySelectorAll('canvas')) {
      const upp = 2.2 * edge / size;
      renderer.render(compileFrame(c._design, g, 0.06), { cx: 0, cy: 0, upp }, { port: [0, 0, size, size], quality: cellQuality(upp, 512), palette: 'bw' });
      c.getContext('2d').drawImage(canvas, 0, canvas.height - size, size, size, 0, 0, size, size);
    }
    state.needsDraw = true;
  });
}

function openClasses() {
  const select_ = $('#class-select');
  if (!select_.options.length) {
    const byFamily = new Map();
    for (const cls of state.census.classes) {
      if (cls.n !== 2) continue;
      const film = state.census.films[cls.gid];
      if (!byFamily.has(film.family)) byFamily.set(film.family, []);
      byFamily.get(film.family).push([cls, film]);
    }
    for (const family of state.census.order) {
      const list = byFamily.get(family);
      if (!list) continue;
      const group = h('optgroup', { label: `${family} — ${state.census.families[family].orbifold}` });
      for (const [cls, film] of list) group.append(h('option', { value: cls.id, text: `${cls.id}   ${film.signature}${cls.ct ? '   (the clock swaps inks)' : ''}` }));
      select_.append(group);
    }
    select_.addEventListener('change', () => { setClass(select_.value); });
  }
  select_.value = state.classId;
  $('#class-note').textContent = 'The address keeps the class, so a link opens the same film.';
  $('#class-dialog').showModal();
}

function setClass(id) {
  let group;
  try { group = buildGroup(state.census, id); } catch (error) { say(String(error.message || error), 3000); return; }
  state.group = group;
  state.classId = id;
  state.centres = rotationCentres(group);
  state.design.cls = id;
  state.sel = null;
  outlineCache.clear();
  renderGroupCard();
  homeView();
  afterChange();
  say(`Now in ${id}.`);
}

// -------------------------------------------------------------------- keys --

function nudge(dx, dy) {
  const layer = selected();
  if (!layer || layer.k !== 's') return false;
  const d = toLat(state.group, deltaToSeed(state.grab.j, [dx, dy]));
  edit(() => { layer.at = [layer.at[0] + d[0], layer.at[1] + d[1]]; });
  return true;
}

document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    if (!(target instanceof HTMLInputElement && target.type === 'range' && event.key === ' ')) return;
  }
  if (document.querySelector('dialog[open]')) return;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (mod && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
  if (mod && key === 'y') { event.preventDefault(); redo(); return; }
  if (mod || event.altKey && !key.startsWith('Arrow')) return;
  if (key === ' ') { if (target instanceof HTMLButtonElement) return; event.preventDefault(); setPlaying(!state.playing); return; }
  if (key === 'Escape') { if (state.sel !== null) select(null); return; }
  if ((key === 'Delete' || key === 'Backspace') && state.sel !== null) { event.preventDefault(); removeLayer(state.sel); return; }
  if (key === 'd' && state.sel !== null) { duplicateLayer(state.sel); return; }
  if (key === 'n') { addShape(); return; }
  if (key === 'r') { $('#random').click(); return; }
  if (key === '0') { homeView(); return; }
  if (key === 'f') { $('#fullscreen').click(); return; }
  if (key.startsWith('Arrow')) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[key];
    if (event.altKey && nudge(dir[0] * step, dir[1] * step)) { event.preventDefault(); return; }
    if (dir[0] && !event.altKey) {
      event.preventDefault();
      setPlaying(false);
      state.t = mod1(Math.round(state.t * 96 + dir[0] * (event.shiftKey ? 12 : 1)) / 96);
      state.needsDraw = true;
    }
  }
});

// ------------------------------------------------------------------- wiring --

function wire() {
  $('#play').addEventListener('click', () => setPlaying(!state.playing));
  const scrub = $('#scrub');
  scrub.addEventListener('input', () => { state.scrubbing = true; state.t = mod1(Number(scrub.value) / 1000); state.needsDraw = true; });
  scrub.addEventListener('change', () => { state.scrubbing = false; });
  scrub.addEventListener('pointerup', () => { state.scrubbing = false; });
  $('#loop').addEventListener('change', (event) => { edit(() => { state.design.loop = Number(event.target.value); }); });
  const palette = $('#palette');
  palette.replaceChildren(...Object.entries(PALETTES).map(([id, p]) => h('option', { value: id, text: p.label })));
  palette.addEventListener('change', () => { edit(() => { state.design.pal = palette.value; }); });
  $('#show-sym').addEventListener('change', (event) => { state.show.sym = event.target.checked; state.needsDraw = true; });
  $('#show-outlines').addEventListener('change', (event) => { state.show.outlines = event.target.value; state.needsDraw = true; });
  $('#fit').addEventListener('click', homeView);
  $('#fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (viewport.requestFullscreen) viewport.requestFullscreen().catch(() => say('Fullscreen is not available here.'));
    else say('Fullscreen is not available here.');
  });
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#add-shape').addEventListener('click', () => addShape());
  $('#add-wave').addEventListener('click', addWave);
  $('#empty-add').addEventListener('click', () => addShape());
  $('#empty-designs').addEventListener('click', openDesigns);
  $('#presets').addEventListener('click', openDesigns);
  $('#class-chip').addEventListener('click', openClasses);
  let seed = (Date.now() % 100000) | 0;
  $('#random').addEventListener('click', () => { seed += 1; loadDesign(randomDesign(seed), { name: `Random design ${seed}` }); });
  $('#copy-link').addEventListener('click', async () => {
    commitEdit();
    clearTimeout(addressTimer);
    const search = state.classId === DEFAULT_CLASS ? '' : `?class=${state.classId}`;
    history.replaceState(null, '', `${location.pathname}${search}#d=${encodeDesign(state.design)}`);
    try { await navigator.clipboard.writeText(location.href); say('Link copied: it holds the whole design.'); } catch { say('The address bar holds the whole design: copy it from there.', 3200); }
  });
  const menu = $('#export-menu'), exportButton = $('#export');
  const closeMenu = () => { menu.hidden = true; exportButton.setAttribute('aria-expanded', 'false'); };
  exportButton.addEventListener('click', () => {
    if (!menu.hidden) { closeMenu(); return; }
    const rect = exportButton.getBoundingClientRect();
    menu.hidden = false;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))}px`;
    exportButton.setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('pointerdown', (event) => { if (!menu.hidden && !menu.contains(event.target) && event.target !== exportButton) closeMenu(); });
  menu.addEventListener('click', (event) => {
    const kind = event.target instanceof HTMLElement ? event.target.dataset.export : null;
    if (!kind) return;
    closeMenu();
    if (kind === 'png') exportPng(); else if (kind === 'video') exportVideo(); else exportJson();
  });
  for (const dialog of document.querySelectorAll('dialog.studio-dialog')) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => { state.needsDraw = true; });
  }
  // a design saved as JSON comes back by being dropped on the film
  viewport.addEventListener('dragover', (event) => { event.preventDefault(); });
  viewport.addEventListener('drop', async (event) => {
    event.preventDefault();
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (!file) return;
    try { loadDesign(JSON.parse(await file.text()), { name: `Opened ${file.name}` }); } catch { say('That file is not a design.', 3000); }
  });
  window.addEventListener('resize', () => { state.needsDraw = true; });
  document.addEventListener('fullscreenchange', () => { state.needsDraw = true; });
  window.addEventListener('hashchange', () => {
    const design = designFromAddress();
    if (design && encodeDesign(normaliseDesign(design, state.classId)) !== encodeDesign(state.design)) loadDesign(design);
  });
}

function designFromAddress() {
  const hash = location.hash.replace(/^#/, '');
  const at = new URLSearchParams(hash);
  if (at.get('d')) {
    try { return decodeDesign(at.get('d'), state.classId); } catch (error) { console.warn('studio: the link does not hold a design', error); }
  }
  if (at.get('p')) {
    if (at.get('p') === 'census') return censusFilm(state.group.cls);
    const preset = PRESETS.find((p) => p.id === at.get('p'));
    if (preset) return preset.design;
  }
  return null;
}

async function start() {
  try {
    renderer = new Renderer(canvas, { forceDirect: params.get('renderer') === 'direct' });
  } catch (error) {
    const box = $('#fallback');
    box.hidden = false;
    box.textContent = 'The Studio draws with WebGL 2, which this browser does not offer.';
    main.setAttribute('aria-busy', 'false');
    return;
  }
  const response = await fetch(main.dataset.census);
  if (!response.ok) throw new Error(`census: HTTP ${response.status}`);
  state.census = await response.json();
  // the address names the class; failing that, a design remembers the one it was drawn in
  let remembered = null;
  try {
    const code = new URLSearchParams(location.hash.replace(/^#/, '')).get('d');
    if (code) remembered = decodeDesign(code, DEFAULT_CLASS).cls;
  } catch { remembered = null; }
  const wanted = params.get('class') || remembered || DEFAULT_CLASS;
  try { state.group = buildGroup(state.census, wanted); state.classId = wanted; } catch (error) {
    console.warn(`studio: ${error.message}; opening ${DEFAULT_CLASS}`);
    state.group = buildGroup(state.census, DEFAULT_CLASS);
    state.classId = DEFAULT_CLASS;
  }
  state.centres = rotationCentres(state.group);
  const fromAddress = designFromAddress();
  state.design = adopt(normaliseDesign(fromAddress || PRESETS[0].design, state.classId));
  state.design.cls = state.classId;
  if (params.get('t') !== null) { state.t = mod1(Number(params.get('t')) || 0); state.playing = false; }
  if (params.get('paused') === '1') state.playing = false;
  renderer.onRestored = () => { state.needsDraw = true; state.stripDirty = true; };
  wire();
  buildStrip();
  renderGroupCard();
  syncDesignControls();
  setPlaying(state.playing);
  resize();
  homeView();
  refreshVanish();
  renderLayers();
  renderInspector();
  syncButtons();
  $('#empty').hidden = state.design.L.length > 0;
  requestAnimationFrame(tick);
  requestAnimationFrame(() => requestAnimationFrame(() => { main.setAttribute('aria-busy', 'false'); }));
  if (!fromAddress) say('Two commas, and the copies the group makes of them. Drag one.', 7000);
  // what the tests, and a curious reader at the console, can hold on to
  window.__studio = {
    state, renderer,
    frame: () => compileFrame(state.design, state.group, state.t),
    inkAt: (X, Y, t = state.t) => inkAt(compileFrame(state.design, state.group, t), X, Y),
    toScreen: (X, Y) => { const vm = viewMetrics(); const [sx, sy] = toScreen(vm, X, Y); return [sx / vm.dpr, sy / vm.dpr]; },
    toWorld: (cssX, cssY) => { const vm = viewMetrics(); return toWorld(vm, cssX * vm.dpr, cssY * vm.dpr); },
    load: (raw) => loadDesign(raw),
    select, setPlaying, setClass, encode: () => encodeDesign(state.design),
  };
}

start().catch((error) => {
  console.error(error);
  const box = $('#fallback');
  box.hidden = false;
  box.textContent = `The Studio could not start: ${error.message || error}`;
  main.setAttribute('aria-busy', 'false');
});
