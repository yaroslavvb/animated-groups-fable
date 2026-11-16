// What src/render3d.js does by itself (SPEC 8, contract C4), checked in node: createRenderer runs on a stand-in
// canvas, WebGL2 context (every call accepted, nothing drawn), DOM and clock, with animation frames stepped by hand.
//   26  prefers-reduced-motion: no momentum, no glides, no springs, followed live (round-3 finding 26)
//   25  a lost WebGL context: labels hidden, a one-line message, a clean restore (finding 25)
//   43  the canvas's role, role description and a label that names the keys (finding 43)
//   fill the surface's tint is two bits (ghost, fill) and setStyle({ fill }) reaches the shader (the big comma, 10 Nov 2026)
// The pictures themselves are checked in a browser: dev/renderer-r3-checks.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, viewFromAzEl, __test as T } from '../src/render3d.js';
import { MOTIF_FILL_3D, SURFACE_GHOST } from '../src/palette.js';

// ---- stand-ins ------------------------------------------------------------------------------------------------
class FakeEl {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.style = {}; this.children = []; this.parentElement = null;
    this.attrs = new Map(); this.ls = new Map(); this.textContent = ''; this.className = '';
    this.offsetLeft = 0; this.offsetTop = 0; this.offsetWidth = 12; this.offsetHeight = 13;   // a label's size
    this.clientWidth = 0; this.clientHeight = 0; this.clientLeft = 0; this.clientTop = 0;
  }
  appendChild(c) { if (c.parentElement) c.remove(); this.children.push(c); c.parentElement = this; return c; }
  remove() { const p = this.parentElement; if (p) { p.children.splice(p.children.indexOf(this), 1); this.parentElement = null; } }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  addEventListener(t, f) { if (!this.ls.has(t)) this.ls.set(t, []); this.ls.get(t).push(f); }
  removeEventListener(t, f) { const a = this.ls.get(t); if (a && a.includes(f)) a.splice(a.indexOf(f), 1); }
  fire(type, props = {}) {
    const e = { type, cancelable: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
    for (const f of [...(this.ls.get(type) || [])]) f(e);
    return e;
  }
  getBoundingClientRect() { return { left: 0, top: 0, x: 0, y: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight }; }
  setPointerCapture() {}
  releasePointerCapture() {}
}

/** A WebGL2 context that accepts every call. gl._lost(true) makes isContextLost() say so; gl._failCompile(true) fails shaders. */
function fakeGL() {
  let lost = false, failCompile = false, next = 0x1000;
  const consts = new Map();
  const special = {
    getShaderParameter: () => !failCompile, getProgramParameter: (p, pname) => (pname === proxy.ACTIVE_UNIFORMS ? 0 : true),
    getParameter: (p) => (p === proxy.STENCIL_BITS ? 8 : 0), isContextLost: () => lost,
    getShaderInfoLog: () => 'stand-in', getProgramInfoLog: () => 'stand-in', getActiveUniform: () => null,
    _lost: (v) => { lost = v; }, _failCompile: (v) => { failCompile = v; },
  };
  const proxy = new Proxy({}, {
    get(t, k) {
      if (k in special) return special[k];
      if (typeof k === 'string' && /^[A-Z][A-Z0-9_]*$/.test(k)) { if (!consts.has(k)) consts.set(k, next++); return consts.get(k); }
      if (k === 'then') return undefined;
      return () => ({});
    },
  });
  return proxy;
}

let clock = 1000;
const frames = new Map();
let frameId = 1;
/** Fresh globals: a clock, animation frames run by step(), window.matchMedia with a prefers-reduced-motion query. */
function installGlobals({ reduce = false } = {}) {
  clock = 1000; frames.clear();
  Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true, writable: true });
  globalThis.requestAnimationFrame = (cb) => { const id = frameId++; frames.set(id, cb); return id; };
  globalThis.cancelAnimationFrame = (id) => { frames.delete(id); };
  const query = {
    matches: reduce, ls: new Set(),
    addEventListener(t, f) { if (t === 'change') this.ls.add(f); }, removeEventListener(t, f) { this.ls.delete(f); },
    set(v) { this.matches = v; for (const f of [...this.ls]) f({ matches: v }); },
  };
  globalThis.window = {
    devicePixelRatio: 2, addEventListener() {}, removeEventListener() {},
    matchMedia: (q) => (/prefers-reduced-motion:\s*reduce/.test(q) ? query : { matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  globalThis.document = { createElement: (t) => new FakeEl(t), getElementById: () => null, head: new FakeEl('head'), documentElement: new FakeEl('html') };
  return query;
}
/** Advance the clock by ms and run the animation frames that were asked for. */
function step(ms = 16) {
  clock += ms;
  const due = [...frames.values()];
  frames.clear();
  for (const cb of due) cb(clock);
}
function steps(n, ms = 16) { for (let i = 0; i < n; i++) step(ms); }

/** A pane holding a 600 x 500 css px canvas and its label layer, a renderer on it, and a small scene. */
function makeScene(opts = {}, { canvasAttrs = {} } = {}) {
  const gl = fakeGL();
  const pane = new FakeEl('section'), canvas = new FakeEl('canvas'), layer = new FakeEl('div');
  for (const [k, v] of Object.entries(canvasAttrs)) canvas.setAttribute(k, v);
  Object.assign(canvas, { clientWidth: 600, clientHeight: 500, offsetLeft: 10, offsetTop: 20, offsetWidth: 600, offsetHeight: 500, width: 300, height: 150 });
  canvas.getContext = (type) => (type === 'webgl2' ? gl : null);
  Object.assign(layer, { clientWidth: 600, clientHeight: 500 });
  pane.appendChild(canvas); pane.appendChild(layer);
  const R = createRenderer(canvas, { labelLayer: layer, ...opts });
  // a flat square of two triangles, a line across it, two labelled markers
  R.setSurface({ positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
  R.setLines([{ points: new Float32Array([-1, 0, 0, 1, 0, 0]), color: [0, 0, 0], width: 4 }]);
  R.setMarkers([{ p: [-0.5, -0.5, 0], color: [0, 0, 0], size: 11, label: '3' }, { p: [0.5, 0.5, 0], color: [0, 0, 0], size: 11, label: '3' }]);
  R.setFrame({ center: [0, 0, 0], radius: 1.5 }, true);
  R.render();
  return { R, gl, pane, canvas, layer };
}
/** The angle (degrees) of the rotation between two orientations; stable near 0 (acos of a dot product is not). */
function angleDeg(a, b) {
  const s = Math.sign(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) || 1;
  const d = Math.hypot(a[0] - s * b[0], a[1] - s * b[1], a[2] - s * b[2], a[3] - s * b[3]);
  const p = Math.hypot(a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2], a[3] + s * b[3]);
  return 4 * Math.atan2(d, p) * 180 / Math.PI;
}
const shownLabels = (layer) => layer.children.filter((e) => e.className === 'r3d-label' && e.style.display !== 'none').map((e) => e.textContent);
/** A quick drag across the canvas (8 moves, 8 ms apart) and its release; returns the view at the release. */
function flick(R, canvas, dx = 24) {
  canvas.fire('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 200, clientY: 250 });
  for (let i = 1; i <= 8; i++) { clock += 8; canvas.fire('pointermove', { pointerId: 1, clientX: 200 + dx * i, clientY: 250 + 2 * i }); }
  const q = R.getView().q;
  clock += 4;
  canvas.fire('pointerup', { pointerId: 1, clientX: 200 + dx * 8, clientY: 266 });
  return q;
}

// ---- 43 -------------------------------------------------------------------------------------------------------
test('43: the 3D canvas is an application with the role description "3D view" and a label that names its keys', () => {
  installGlobals();
  const { canvas } = makeScene();
  assert.equal(canvas.getAttribute('role'), 'application');
  assert.equal(canvas.getAttribute('aria-roledescription'), '3D view');
  const label = canvas.getAttribute('aria-label');
  for (const words of ['arrow keys', 'turn', 'scroll', 'pinch', '+', 'zoom', 'double-tap', '0', 'Home', 'reset']) assert.ok(label.includes(words), `the label names "${words}": ${label}`);
  assert.equal(canvas.tabIndex, 0, 'it takes the keyboard focus');
  // what the page set itself is kept
  const own = makeScene({}, { canvasAttrs: { role: 'img', 'aria-label': 'Own label', 'aria-roledescription': 'model' } }).canvas;
  assert.deepEqual([own.getAttribute('role'), own.getAttribute('aria-label'), own.getAttribute('aria-roledescription')], ['img', 'Own label', 'model']);
});

// ---- 26 -------------------------------------------------------------------------------------------------------
test('26: without reduced motion the view keeps its momentum, glides home and springs into a zoom (as before)', () => {
  installGlobals({ reduce: false });
  const { R, canvas } = makeScene();
  assert.equal(R.reducedMotion, false);
  const q = flick(R, canvas);
  steps(30);
  assert.ok(angleDeg(q, R.getView().q) > 5, 'a flick coasts on after the release: ' + angleDeg(q, R.getView().q));
  R.setView({ az: 40, el: 20 });
  R.resetView();
  assert.ok(angleDeg(R.getView().q, viewFromAzEl().q) > 10, 'reset view glides');
  steps(40);
  assert.ok(angleDeg(R.getView().q, viewFromAzEl().q) < 1e-6, '... home in 0.35 s');
  const p0 = R.project([1, 1, 0]);
  canvas.fire('wheel', { deltaY: -240, deltaMode: 0 });
  step();
  const p1 = R.project([1, 1, 0]);
  steps(60);
  const p2 = R.project([1, 1, 0]);
  assert.ok(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) > 1, 'the zoom springs over several frames');
  assert.ok(Math.hypot(p2[0] - p0[0], p2[1] - p0[1]) > 10);
});

test('26: with prefers-reduced-motion nothing moves by itself: no momentum, no glides, no springs', () => {
  installGlobals({ reduce: true });
  const { R, canvas } = makeScene();
  assert.equal(R.reducedMotion, true);
  // a flick stops with the hand
  const q = flick(R, canvas);
  assert.ok(angleDeg(q, viewFromAzEl().q) > 5, 'the drag itself turned the view');
  steps(30);
  assert.ok(angleDeg(q, R.getView().q) < 1e-9, 'no momentum after the release');
  // reset view (also a double-tap, 0, Home) is there at once
  R.setView({ az: 40, el: 20 });
  R.resetView();
  assert.ok(angleDeg(R.getView().q, viewFromAzEl().q) < 1e-9, 'reset view jumps home');
  canvas.fire('keydown', { key: 'Home' });
  assert.ok(angleDeg(R.getView().q, viewFromAzEl().q) < 1e-9);
  // a wheel notch: the zoom has its new value at once and keeps it (no spring)
  canvas.fire('wheel', { deltaY: -240, deltaMode: 0 });
  const z1 = R.project([1, 1, 0]);
  assert.ok(R.getView().zoom > 1.2, 'the wheel zoomed: ' + R.getView().zoom);
  steps(60);
  const z2 = R.project([1, 1, 0]);
  assert.ok(Math.hypot(z2[0] - z1[0], z2[1] - z1[1]) < 1e-9, 'no spring after it');
  // and stops at its limit, without an elastic overshoot
  for (let i = 0; i < 20; i++) canvas.fire('wheel', { deltaY: -240, deltaMode: 0 });
  const zMax = R.project([1, 1, 0]);
  steps(30);
  assert.ok(Math.hypot(R.project([1, 1, 0])[0] - zMax[0], R.project([1, 1, 0])[1] - zMax[1]) < 1e-9, 'held at the limit');
  assert.ok(Math.abs(R.getView().zoom - 3.2) < 1e-9, 'the limit: ' + R.getView().zoom);
  const atMax = R.getView();
  R.setView({ zoom: 3.2 });
  const ref = R.project([1, 1, 0]);
  assert.ok(Math.hypot(ref[0] - zMax[0], ref[1] - zMax[1]) < 1e-9, 'shown exactly at the limit, not past it');
  R.setView(atMax);
  // an arrow key turns by its whole step at once
  const k0 = R.getView().q;
  canvas.fire('keydown', { key: 'ArrowRight' });
  assert.ok(Math.abs(angleDeg(k0, R.getView().q) - 9) < 1e-6, 'an arrow key turns 9 degrees at once: ' + angleDeg(k0, R.getView().q));
  steps(20);
  assert.ok(Math.abs(angleDeg(k0, R.getView().q) - 9) < 1e-6, '... and no more');
  // the camera frame is taken at once (the fold moving the frame does not glide behind it)
  R.setFrame({ center: [0.8, 0, 0], radius: 1.5 });
  const c = R.project([0.8, 0, 0]);
  assert.ok(Math.abs(c[0] - 300) < 1e-3 && Math.abs(c[1] - 250) < 1e-3, 'the new frame centre is in the middle at once: ' + c);
});

test('26: the preference is followed live, and turning it on stops what is moving', () => {
  const query = installGlobals({ reduce: false });
  const { R, canvas } = makeScene();
  flick(R, canvas);
  steps(2);
  const mid = R.getView().q;
  steps(2);
  assert.ok(angleDeg(mid, R.getView().q) > 0.5, 'coasting');
  query.set(true);
  assert.equal(R.reducedMotion, true);
  const stopped = R.getView().q;
  steps(30);
  assert.ok(angleDeg(stopped, R.getView().q) < 1e-9, 'the coast stops at once');
  // a reset glide under way when the preference comes on is put at its end
  query.set(false);
  R.setView({ az: 60, el: 10 });
  R.resetView();
  steps(3);
  assert.ok(angleDeg(R.getView().q, viewFromAzEl().q) > 1, 'gliding');
  query.set(true);
  assert.ok(angleDeg(R.getView().q, viewFromAzEl().q) < 1e-9, 'the glide ends at once');
  // and back: momentum again
  query.set(false);
  assert.equal(R.reducedMotion, false);
  const q = flick(R, canvas);
  steps(30);
  assert.ok(angleDeg(q, R.getView().q) > 5, 'momentum is back');
  // an explicit option wins over the query (and does not listen to it)
  assert.equal(makeScene({ reducedMotion: true }).R.reducedMotion, true);
  query.set(true);
  assert.equal(makeScene({ reducedMotion: false }).R.reducedMotion, false);
  assert.equal(query.ls.size, 1, 'only the renderer that follows the query listens to it');
  R.dispose();
  assert.equal(query.ls.size, 0, 'dispose lets go of it');
});

test('26: with reduced motion a label that must leave its spot jumps there (it glides otherwise)', () => {
  for (const reduce of [false, true]) {
    installGlobals({ reduce });
    const { R, layer } = makeScene();
    R.setMarkers([{ p: [0, 0, 0], color: [0, 0, 0], size: 11, label: '6' }]);
    R.setLines([]);
    R.render();
    const el = layer.children.find((e) => e.className === 'r3d-label' && e.textContent === '6');
    assert.ok(el && el._cand >= 0, 'placed');
    const spot = el._cand;
    // a bold line from the marker straight through the label's spot: the world direction in the plane z = 0 whose
    // image on the screen points at the spot, out to 60 px
    const ang = spot * Math.PI / 4, m = R.project([0, 0, 0]);
    let best = null;
    for (let k = 0; k < 720; k++) {
      const a = k * Math.PI / 360, p = R.project([0.1 * Math.cos(a), 0.1 * Math.sin(a), 0]);
      const err = Math.abs(Math.atan2(-(p[1] - m[1]), p[0] - m[0]) - (ang > Math.PI ? ang - 2 * Math.PI : ang));
      if (!best || err < best.err) best = { a, err };
    }
    let lo = [0, 0], hi = [2 * Math.cos(best.a), 2 * Math.sin(best.a)];
    const dist = (p) => { const s = R.project([p[0], p[1], 0]); return Math.hypot(s[0] - m[0], s[1] - m[1]); };
    for (let i = 0; i < 60; i++) { const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]; if (dist(mid) < 60) lo = mid; else hi = mid; }
    const s = R.project([lo[0], lo[1], 0]);
    assert.ok(Math.hypot(s[0] - m[0] - 60 * Math.cos(ang), s[1] - m[1] + 60 * Math.sin(ang)) < 2, 'the line points at the label');
    R.setLines([{ points: new Float32Array([0, 0, 0, lo[0], lo[1], 0]), color: [0, 0, 0], width: 6 }]);
    let moved = false, glided = false;
    for (let i = 0; i < 12; i++) { step(16); R.render(); if (el._cand !== spot) moved = true; if (el._gt >= 0) glided = true; }
    assert.ok(moved, 'the label left the line');
    assert.equal(glided, !reduce, reduce ? 'it jumped' : 'it glided');
  }
});

// ---- 25 -------------------------------------------------------------------------------------------------------
test('25: a lost context hides the labels and shows a one-line message over the canvas; a restore brings back the new state', () => {
  installGlobals();
  const { R, gl, pane, canvas, layer } = makeScene();
  assert.deepEqual(shownLabels(layer), ['3', '3']);
  gl._lost(true);
  const e = canvas.fire('webglcontextlost');
  assert.ok(e.defaultPrevented, 'the browser is asked to restore the context');
  assert.equal(R.lost, true);
  assert.deepEqual(shownLabels(layer), [], 'no label floats over the empty pane');
  const notes = pane.children.filter((c) => c.className === 'r3d-message');
  assert.equal(notes.length, 1);
  const note = notes[0];
  assert.equal(note.getAttribute('role'), 'status', 'announced to a screen reader (the label layer is aria-hidden)');
  assert.equal(note.textContent, 'The 3D view paused: the browser reset its graphics.');
  assert.ok(!/\n/.test(note.textContent) && note.textContent.length < 70, 'one line');
  assert.equal(note.style.left, '10px'); assert.equal(note.style.width, '600px');
  assert.equal(note.style.top, Math.round(20 + 0.42 * 500) + 'px', 'across the canvas, a little above its middle');
  assert.ok(/pointer-events:none/.test(note.style.cssText), 'click-through');
  // the app goes on while the context is lost (a group change): nothing is drawn, no label appears
  R.setMarkers([{ p: [0.2, 0.2, 0], color: [0, 0, 0], size: 12, shape: 'ring', label: '∗6' }]);
  R.updatePositions(new Float32Array([-1, -1, 0.1, 1, -1, 0, 1, 1, 0, -1, 1, 0]));
  R.render();
  steps(10);
  assert.deepEqual(shownLabels(layer), []);
  assert.equal(pane.children.filter((c) => c.className === 'r3d-message').length, 1, 'still one message');
  // the canvas changes size while lost: the message follows it
  Object.assign(canvas, { offsetWidth: 390, offsetHeight: 300 });
  R.resize();
  assert.equal(note.style.width, '390px');
  // restored: the message goes, the labels of the new state come back
  gl._lost(false);
  canvas.fire('webglcontextrestored');
  assert.equal(R.lost, false);
  assert.equal(pane.children.filter((c) => c.className === 'r3d-message').length, 0, 'the message is gone');
  assert.deepEqual(shownLabels(layer), ['∗6']);
  // a second loss shows the message again; dispose removes it
  gl._lost(true);
  canvas.fire('webglcontextlost');
  assert.equal(pane.children.filter((c) => c.className === 'r3d-message').length, 1);
  R.dispose();
  assert.equal(pane.children.filter((c) => c.className === 'r3d-message').length, 0, 'dispose takes the message away');
});

test('25: when the restored context cannot be set up again, the message stays and nothing is drawn', () => {
  installGlobals();
  const { R, gl, pane, canvas, layer } = makeScene();
  gl._lost(true);
  canvas.fire('webglcontextlost');
  gl._lost(false); gl._failCompile(true);
  const err = console.error;
  console.error = () => {};
  try { canvas.fire('webglcontextrestored'); } finally { console.error = err; }
  assert.equal(R.lost, true);
  assert.equal(pane.children.filter((c) => c.className === 'r3d-message').length, 1);
  R.render();
  assert.deepEqual(shownLabels(layer), []);
});

// ---- the fill (10 Nov 2026) -----------------------------------------------------------------------------------
/**
 * fakeGL that also knows the uniforms of its programs (read from the shader sources) and records what is set:
 * gl._set = [{ name, v }] for uniform3fv, gl._buffers = the Uint8Array data handed to bufferData.
 */
function recordingGL() {
  const base = fakeGL(), shaders = new Map(), progs = new Map(), set = [], buffers = [];
  let id = 0;
  const uniformsOf = (p) => {
    const names = [];
    for (const src of progs.get(p) || []) {
      for (const m of src.matchAll(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+([^;]+);/g)) for (const nm of m[1].split(',')) names.push(nm.trim().replace(/\[.*$/, ''));
    }
    return [...new Set(names)];
  };
  const extra = {
    createShader: () => ({ id: ++id }),
    shaderSource: (sh, src) => { shaders.set(sh, src); },
    createProgram: () => { const p = { id: ++id }; progs.set(p, []); return p; },
    attachShader: (p, sh) => { progs.get(p).push(shaders.get(sh) || ''); },
    getProgramParameter: (p, pname) => (pname === base.ACTIVE_UNIFORMS ? uniformsOf(p).length : true),
    getActiveUniform: (p, i) => ({ name: uniformsOf(p)[i] }),
    getUniformLocation: (p, name) => ({ name }),
    uniform3fv: (loc, v) => { set.push({ name: loc && loc.name, v: Array.from(v) }); },
    bufferData: (target, data) => { if (data instanceof Uint8Array) buffers.push(Array.from(data)); },
    _set: set, _buffers: buffers,
  };
  return new Proxy({}, { get(t, k) { return k in extra ? extra[k] : base[k]; } });
}

test('fill: the surface shader reads the tint as two bits, ghost (bit 0) and fill (bit 1, uFill), on both sides', () => {
  const fs = T.SURF_FS;
  assert.match(fs, /uniform vec3 uFront, uBack, uGhost, uFill;/);
  assert.match(fs, /float tq = floor\(vTint \+ 0\.5\);/, 'the tint is constant over a triangle; read it as an integer');
  // (13 Nov 2026: the base colour is front / back, or the print's two tones there; the ghost colour is then mixed in by
  // bit 0 times uGhostMix, 1 by default — the same colour as before for a surface without a print)
  assert.match(fs, /vec3 base = gl_FrontFacing \? uFront : uBack;/, 'the base colour: the side the eye sees');
  assert.match(fs, /mix\(base, uGhost, mod\(tq, 2\.0\) \* uGhostMix\)/, 'bit 0: the ghost colour');
  assert.match(fs, /mix\(base, uFill, step\(1\.5, tq\)\)/, 'bit 1: the fill colour, whichever side is seen');
  assert.doesNotMatch(fs, /clamp\(vTint/, 'no longer one bit');
});

test('fill: setSurface passes the two-bit tint on; setStyle({ fill }) reaches the shader as uFill, MOTIF_FILL_3D by default', () => {
  installGlobals();
  const gl = recordingGL();
  const pane = new FakeEl('section'), canvas = new FakeEl('canvas'), layer = new FakeEl('div');
  Object.assign(canvas, { clientWidth: 600, clientHeight: 500, offsetLeft: 0, offsetTop: 0, offsetWidth: 600, offsetHeight: 500, width: 300, height: 150 });
  canvas.getContext = (type) => (type === 'webgl2' ? gl : null);
  pane.appendChild(canvas); pane.appendChild(layer);
  const R = createRenderer(canvas, { labelLayer: layer });
  R.setSurface({ positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), tint: Uint8Array.of(0, 1, 2, 3) });
  R.setFrame({ center: [0, 0, 0], radius: 1.5 }, true);
  R.render();
  assert.ok(gl._buffers.some((b) => b.join() === '0,1,2,3'), 'the tint reaches the GPU unchanged (0 plain, 1 ghost, 2 fill, 3 both)');
  const last = (name) => { const u = gl._set.filter((x) => x.name === name); return u.length ? u[u.length - 1].v : null; };
  const near = (a, b) => a && a.length === 3 && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  assert.ok(near(last('uFill'), MOTIF_FILL_3D), 'the default fill: ' + last('uFill'));
  assert.ok(near(last('uGhost'), SURFACE_GHOST), 'the ghost colour is its own');
  R.setStyle({ fill: [0.1, 0.2, 0.3] }); R.render();
  assert.ok(near(last('uFill'), [0.1, 0.2, 0.3]), 'setStyle({ fill })');
  R.setStyle({ fill: '#336699' }); R.render();
  assert.ok(near(last('uFill'), [0x33 / 255, 0x66 / 255, 0x99 / 255]), 'as #rrggbb too');
  R.setStyle({ fill: [NaN, 0, 0] }); R.setStyle({ ghost: [0.5, 0.5, 0.5] }); R.render();
  assert.ok(near(last('uFill'), [0x33 / 255, 0x66 / 255, 0x99 / 255]), 'a malformed colour is ignored; another style key leaves the fill alone');
  R.dispose();
});

// ---- the shape print (mode 3: a signed-distance texture; 13 Nov 2026) --------------------------------------------
// How the renderer keeps the texture: uploaded when the field is another one, never on a colour change, deleted when
// replaced or no longer wanted, brought back after a lost context. (What is drawn with it: test/render3d.test.js for
// the shader's formulas, dev/patterns/tex-demo.mjs for a GPU.)

/**
 * recordingGL that also keeps the textures. gl._tex = { log, live, draws, vec, EXT, uploads() }:
 *   log    ['store', pname, value] | ['image', texture id, w, h] | ['mips', id] | ['delete', id], in order
 *   live   the textures that exist; a texture is { id, image: { level, internal, w, h, border, format, type, data }, params: Map, mips }
 *   draws  for every drawElements: { tex (bound then), unit, pat (uPat as last set), sampler (uPatT) }
 *   vec    the last value of every uniform set with uniform1i / uniform3f / uniform3fv / uniform4fv, by name
 */
function textureGL({ maxTex = 4096, aniso = 16 } = {}) {
  const base = recordingGL(), log = [], live = new Set(), vec = new Map(), draws = [];
  const EXT = { TEXTURE_MAX_ANISOTROPY_EXT: 0x84FE, MAX_TEXTURE_MAX_ANISOTROPY_EXT: 0x84FF };
  let ids = 0, bound = null, unit = null;
  const extra = {
    createTexture: () => { const t = { id: ++ids, params: new Map(), image: null, mips: 0 }; live.add(t); return t; },
    deleteTexture: (t) => { live.delete(t); log.push(['delete', t.id]); if (bound === t) bound = null; },
    activeTexture: (u) => { unit = u; },
    bindTexture: (target, t) => { bound = t; },
    pixelStorei: (k, v) => { log.push(['store', k, v]); },
    texImage2D: (target, level, internal, w, h, border, format, type, data) => { bound.image = { level, internal, w, h, border, format, type, data }; bound.mips = 0; log.push(['image', bound.id, w, h]); },
    texParameteri: (target, k, v) => { bound.params.set(k, v); },
    texParameterf: (target, k, v) => { bound.params.set(k, v); },
    generateMipmap: () => { bound.mips++; log.push(['mips', bound.id]); },
    getExtension: (name) => (name === 'EXT_texture_filter_anisotropic' && aniso ? EXT : null),
    getParameter: (p) => (p === base.STENCIL_BITS ? 8 : p === base.MAX_TEXTURE_SIZE ? maxTex : p === EXT.MAX_TEXTURE_MAX_ANISOTROPY_EXT ? aniso : 0),
    uniform1i: (loc, v) => { if (loc && loc.name) vec.set(loc.name, v); },
    uniform3f: (loc, x, y, z) => { if (loc && loc.name) vec.set(loc.name, [x, y, z]); },
    uniform3fv: (loc, v) => { if (loc && loc.name) vec.set(loc.name, Array.from(v)); base.uniform3fv(loc, v); },
    uniform4fv: (loc, v) => { if (loc && loc.name) vec.set(loc.name, Array.from(v)); },
    drawElements: () => { draws.push({ tex: bound, unit, pat: vec.get('uPat'), sampler: vec.get('uPatT') }); },
    _tex: { log, live, vec, draws, EXT, uploads: () => log.filter((e) => e[0] === 'image' && e[2] > 1).length },
  };
  return new Proxy({}, { get(t, k) { return k in extra ? extra[k] : base[k]; } });
}
/** A square sheet with paper coordinates on a renderer over textureGL. X = gl._tex; last() = the colour pass of the last frame. */
function printScene(glOpts) {
  installGlobals();
  const gl = textureGL(glOpts);
  const pane = new FakeEl('section'), canvas = new FakeEl('canvas'), layer = new FakeEl('div');
  Object.assign(canvas, { clientWidth: 600, clientHeight: 500, offsetLeft: 0, offsetTop: 0, offsetWidth: 600, offsetHeight: 500, width: 300, height: 150 });
  canvas.getContext = (type) => (type === 'webgl2' ? gl : null);
  pane.appendChild(canvas); pane.appendChild(layer);
  const R = createRenderer(canvas, { labelLayer: layer });
  const quad = { positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
  const uv = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
  R.setSurface({ ...quad, uv });
  R.setFrame({ center: [0, 0, 0], radius: 1.5 }, true);
  const X = gl._tex;
  return { R, gl, canvas, quad, uv, X, last: () => X.draws[X.draws.length - 1] };
}
/** A shape print as pattern.js hands it over: a field of size x size texels, all `fill`. */
const shapeOf = (size = 16, fill = 200) => ({ mode: 3, L: new Float32Array(9), A: Float32Array.of(0.8, 0, 0.28, 0.64), I: Float32Array.of(1.25, -0.546875, 0, 1.5625), O: Float32Array.of(0.1, -0.05, 0.05), tex: { size, data: new Uint8Array(size * size).fill(fill), range: 0.05 } });
/** Run fn with console.warn collected instead of printed. */
function quiet(fn) { const w = console.warn, said = []; console.warn = (...a) => { said.push(a.join(' ')); }; try { fn(said); } finally { console.warn = w; } return said; }

test('shape print: the field goes to the GPU as it is — R8, a byte a texel, repeating, trilinear, anisotropic, with its mip levels — and is bound when the sheet is drawn', () => {
  const { R, gl, X, last } = printScene();
  R.render();
  assert.equal(last().pat, 0, 'no print yet');
  assert.ok(last().tex && last().tex.image.w === 1 && last().tex.image.data[0] === 255, 'a 1 x 1 stand-in is bound meanwhile: the sampler never lacks a texture');
  assert.equal(X.uploads(), 0);
  const P = shapeOf(16);
  R.setStyle({ print: P });
  assert.equal(X.uploads(), 0, 'setStyle itself touches no GL (it may be called while the context is lost)');
  R.render();
  assert.equal(X.uploads(), 1); assert.equal(R.stats.printUploads, 1);
  const d = last(), t = d.tex, im = t.image;
  assert.equal(d.pat, 3, 'uPat = 3'); assert.equal(d.sampler, 0, 'the sampler reads unit 0'); assert.equal(d.unit, gl.TEXTURE0);
  assert.deepEqual([im.level, im.w, im.h, im.border], [0, 16, 16, 0]);
  assert.deepEqual([im.internal, im.format, im.type], [gl.R8, gl.RED, gl.UNSIGNED_BYTE], 'one channel of 8 bits');
  assert.equal(im.data, P.tex.data, 'the caller\'s array, as it is');
  // one byte a texel and rows of any length: UNPACK_ALIGNMENT 1 (4 would skew every row of a size that is no multiple of 4);
  // not flipped: row j is t = (j + 0.5) / size
  const at = X.log.findIndex((e) => e[0] === 'image' && e[1] === t.id);
  const stored = (k) => { for (let i = at; i >= 0; i--) if (X.log[i][0] === 'store' && X.log[i][1] === k) return X.log[i][2]; return undefined; };
  assert.equal(stored(gl.UNPACK_ALIGNMENT), 1); assert.equal(stored(gl.UNPACK_FLIP_Y_WEBGL), false); assert.equal(stored(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), false);
  assert.equal(t.params.get(gl.TEXTURE_WRAP_S), gl.REPEAT); assert.equal(t.params.get(gl.TEXTURE_WRAP_T), gl.REPEAT);
  assert.equal(t.params.get(gl.TEXTURE_MIN_FILTER), gl.LINEAR_MIPMAP_LINEAR); assert.equal(t.params.get(gl.TEXTURE_MAG_FILTER), gl.LINEAR);
  assert.equal(t.params.get(X.EXT.TEXTURE_MAX_ANISOTROPY_EXT), 16, 'anisotropic, up to 16');
  assert.equal(t.mips, 1, 'mip levels generated after the upload');
  assert.ok(X.log.findIndex((e) => e[0] === 'mips' && e[1] === t.id) > at);
  // the uniforms of mode 3: the rows of the inverse basis, the origin and the range
  const close = (a, b) => a && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  assert.ok(close(X.vec.get('uPatI'), [1.25, -0.546875, 0, 1.5625]), 'uPatI: ' + X.vec.get('uPatI'));
  assert.ok(close(X.vec.get('uPatO'), [0.1, -0.05, 0.05]), 'uPatO = (origin, range): ' + X.vec.get('uPatO'));
  // a GPU with less anisotropy gets what it has; one without the extension is not asked
  const few = printScene({ aniso: 4 });
  few.R.setStyle({ print: shapeOf(16) }); few.R.render();
  assert.equal(few.last().tex.params.get(few.X.EXT.TEXTURE_MAX_ANISOTROPY_EXT), 4);
  const none = printScene({ aniso: 0 });
  none.R.setStyle({ print: shapeOf(16) }); none.R.render();
  assert.equal(none.last().pat, 3); assert.equal(none.last().tex.params.has(none.X.EXT.TEXTURE_MAX_ANISOTROPY_EXT), false);
  // a size that is no multiple of 4 (and no power of two) is taken as well
  const odd = printScene();
  odd.R.setStyle({ print: shapeOf(37) }); odd.R.render();
  assert.deepEqual([odd.last().pat, odd.last().tex.image.w, odd.last().tex.image.h], [3, 37, 37]);
});

test('shape print: the same field on every colour change costs nothing; another field replaces the texture; without a shape print there is none', () => {
  const { R, X, last } = printScene();
  const P = shapeOf(16);
  // a fold turns the paper over: setStyle on every frame, with the print's uniforms built afresh round the same tex
  for (let k = 0; k < 30; k++) {
    R.setStyle({ print: { ...P, I: Float32Array.from(P.I), O: Float32Array.from(P.O) }, printFront: [[k / 30, 0.5, 0.5], [0.1, 0.1, 0.1]], printBack: [[0.9, 0.8, k / 30], [0.4, 0.3, 0.2]], opacity: 0.96 });
    R.render();
    assert.equal(last().pat, 3);
  }
  assert.equal(X.uploads(), 1, 'one upload for 30 colour changes'); assert.equal(R.stats.printUploads, 1);
  assert.equal(X.log.filter((e) => e[0] === 'delete').length, 0);
  const first = last().tex;
  // a new wrapper round the same data array is still the same field
  R.setStyle({ print: { ...P, tex: { size: 16, data: P.tex.data, range: 0.05 } } }); R.render();
  assert.equal(X.uploads(), 1); assert.equal(last().tex, first);
  // another field: the old texture is deleted, the new one uploaded
  const P2 = shapeOf(32, 60);
  R.setStyle({ print: P2 }); R.render();
  assert.equal(X.uploads(), 2); assert.equal(R.stats.printUploads, 2);
  assert.deepEqual(X.log.filter((e) => e[0] === 'delete'), [['delete', first.id]], 'the texture before it is deleted');
  assert.ok(!X.live.has(first) && last().tex !== first && last().tex.image.data === P2.tex.data && last().tex.image.w === 32);
  assert.equal(X.live.size, 2, 'the stand-in and the print\'s: nothing piles up');
  // the same array read as a smaller field is another field
  R.setStyle({ print: { ...P2, tex: { size: 16, data: P2.tex.data, range: 0.05 } } }); R.render();
  assert.equal(X.uploads(), 3); assert.equal(last().tex.image.w, 16); assert.equal(X.live.size, 2);
  const third = last().tex;
  // a checkerboard (mode 1) instead: the shape print's texture is let go, the stand-in is bound
  R.setStyle({ print: { mode: 1, L: Float32Array.of(1, 2, 0.25, 3, 4, 0.5, 0, 0, 0.5), A: new Float32Array(4), I: new Float32Array(4), O: new Float32Array(3) } }); R.render();
  assert.equal(last().pat, 1); assert.equal(last().tex.image.w, 1);
  assert.ok(!X.live.has(third), 'deleted'); assert.equal(X.live.size, 1);
  assert.deepEqual(X.vec.get('uPatL0'), [1, 2, 0.25]); assert.deepEqual(X.vec.get('uPatL1'), [3, 4, 0.5]); assert.deepEqual(X.vec.get('uPatL2'), [0, 0, 0.5]);
  // rings (mode 2), no print, a mode the renderer does not know: as before
  R.setStyle({ print: { mode: 2, L: new Float32Array(9), A: Float32Array.of(1, 0, 0, 1), I: Float32Array.of(1, 0, 0, 1), O: Float32Array.of(0, 0, 8) } }); R.render();
  assert.equal(last().pat, 2); assert.deepEqual(X.vec.get('uPatO'), [0, 0, 8]); assert.equal(last().tex.image.w, 1);
  R.setStyle({ print: null }); R.render();
  assert.equal(last().pat, 0);
  R.setStyle({ print: { mode: 4, L: new Float32Array(9), A: new Float32Array(4), I: new Float32Array(4), O: new Float32Array(3) } }); R.render();
  assert.equal(last().pat, 0);
  R.setStyle({ print: { mode: 1, L: Float32Array.of(NaN, 2, 0.25, 3, 4, 0.5, 0, 0, 0.5), A: new Float32Array(4), I: new Float32Array(4), O: new Float32Array(3) } }); R.render();
  assert.equal(last().pat, 0, 'a malformed print of mode 1 is no print, as before');
  assert.equal(X.uploads(), 3);
  // back to the shape print: uploaded again; dispose deletes it and the stand-in
  R.setStyle({ print: P }); R.render();
  assert.equal(X.uploads(), 4); assert.equal(last().pat, 3); assert.equal(X.live.size, 2);
  R.dispose();
  assert.equal(X.live.size, 0, 'dispose leaves no texture behind');
});

test('shape print: a lost context brings the texture back with everything else, from the array that was handed over', () => {
  const { R, gl, canvas, X, last } = printScene();
  const P = shapeOf(16);
  R.setStyle({ print: P }); R.render();
  assert.equal(X.uploads(), 1);
  gl._lost(true);
  canvas.fire('webglcontextlost');
  assert.equal(R.lost, true);
  const drawn = X.draws.length;
  // the app goes on while the context is gone: the paper turns over, the same print is handed over again
  R.setStyle({ print: { ...P }, printFront: [[0.2, 0.3, 0.4], [0.1, 0.1, 0.1]] }); R.render();
  assert.equal(X.draws.length, drawn, 'nothing is drawn');
  assert.equal(X.uploads(), 1, 'and nothing uploaded');
  gl._lost(false);
  canvas.fire('webglcontextrestored');
  assert.equal(R.lost, false);
  assert.ok(X.draws.length > drawn, 'the restore draws by itself');
  assert.equal(X.uploads(), 2, 'the field is uploaded again, once'); assert.equal(R.stats.printUploads, 2);
  assert.equal(last().pat, 3);
  assert.ok(last().tex.image.data === P.tex.data && last().tex.image.w === 16 && last().tex.mips === 1);
  assert.equal(last().tex.params.get(gl.TEXTURE_MIN_FILTER), gl.LINEAR_MIPMAP_LINEAR);
  assert.equal(X.log.filter((e) => e[0] === 'delete').length, 0, 'the textures of the lost context are not touched');
  R.render(); R.render();
  assert.equal(X.uploads(), 2);
  // a print set WHILE the context is lost comes up at the restore too
  const P2 = shapeOf(8, 30);
  gl._lost(true); canvas.fire('webglcontextlost');
  R.setStyle({ print: P2 });
  gl._lost(false); canvas.fire('webglcontextrestored');
  assert.equal(X.uploads(), 3); assert.equal(last().tex.image.data, P2.tex.data);
});

test('shape print: a field the GPU cannot hold, a malformed print, a sheet without paper coordinates — no print, never a broken one', () => {
  // 1. more texels than the GPU takes: the sheet is drawn plain, with one warning, and no upload is tried
  const small = printScene({ maxTex: 80 });
  const big = shapeOf(96);
  const said = quiet(() => { small.R.setStyle({ print: big }); for (let k = 0; k < 5; k++) small.R.render(); });
  assert.equal(small.last().pat, 0, 'no print'); assert.equal(small.last().tex.image.w, 1, 'the stand-in is bound');
  assert.equal(small.X.uploads(), 0); assert.equal(small.R.stats.printUploads, 0);
  assert.equal(said.length, 1, 'said once, not every frame: ' + said.join(' | '));
  assert.match(said[0], /96 x 96.*80/);
  small.R.setStyle({ print: shapeOf(64) }); small.R.render();
  assert.equal(small.last().pat, 3, 'a field that fits is drawn');
  // 2. malformed: left out, with a warning that says why (once for each reason)
  const { R, X, last, quad, uv } = printScene();
  const good = shapeOf(16);
  R.setStyle({ print: good }); R.render();
  assert.equal(last().pat, 3);
  const cases = [
    [{ mode: 3 }, /finite/],
    [{ ...good, tex: null }, /no tex/],
    [{ ...good, tex: { size: 16, data: new Uint8Array(100), range: 0.05 } }, /holds 100 texels.*needs 256/],
    [{ ...good, tex: { size: 16.5, data: good.tex.data, range: 0.05 } }, /tex\.size/],
    [{ ...good, tex: { size: 16, data: new Float32Array(256), range: 0.05 } }, /Uint8Array/],
    [{ ...good, O: Float32Array.of(0, 0, 0), tex: { size: 16, data: good.tex.data } }, /range/],
    [{ ...good, I: Float32Array.of(1, 0, NaN, 1) }, /finite/],
  ];
  for (const [P, why] of cases) {
    R.setStyle({ print: good }); R.render();
    const w = quiet(() => { R.setStyle({ print: P }); R.setStyle({ print: P }); R.render(); });
    assert.equal(last().pat, 0, 'left out: ' + why);
    assert.ok(w.length <= 1, 'at most one warning');
    if (w.length) { assert.match(w[0], /render3d\.setStyle: a shape print \(mode 3\) is left out/); assert.match(w[0], why); }
  }
  // 3. a surface without paper coordinates carries no print (as for modes 1 and 2); the field stays for the next one
  R.setStyle({ print: good }); R.render();
  const ups = X.uploads();
  R.setSurface(quad); R.render();
  assert.equal(last().pat, 0, 'no uv, no print');
  R.setSurface({ ...quad, uv }); R.render();
  assert.equal(last().pat, 3); assert.equal(X.uploads(), ups, 'the texture was kept meanwhile');
  // a non-finite paper coordinate: no print either (it would poison a triangle)
  R.setSurface({ ...quad, uv: Float32Array.of(-1, -1, 1, NaN, 1, 1, -1, 1) }); R.render();
  assert.equal(last().pat, 0);
});

// ---- the turntable (15 Nov 2026, the owner: "use a fixed turntable mode for rotation UI") -----------------------
// The paper lies on a table that turns about its normal (z); the eye has an azimuth and an elevation, and the view
// never rolls: the screen's x axis stays level, z up-screen. Here: real pointer, key and gesture sequences on the
// stand-in canvas (600 x 500 css px).

/** The view as a turntable: az, el (degrees); level = |z of the screen's x axis| (0 when upright); up = z of the
 *  screen's y axis (>= 0: z never points down-screen); inStep = degrees between q and viewFromAzEl(az, el). */
function upright(R) {
  const v = R.getView(), M = T.qToMat3(v.q, new Array(9));
  return { az: v.az, el: v.el, zoom: v.zoom, level: Math.abs(M[2]), up: M[5], inStep: angleDeg(v.q, viewFromAzEl(v.az, v.el).q) };
}
/** A drag along pts (client px) with one pointer, a move every dt ms; released still (no flick) unless flick. */
function drag(canvas, pts, { id = 1, type = 'mouse', dt = 16, flick: thrown = false } = {}) {
  canvas.fire('pointerdown', { pointerId: id, pointerType: type, button: 0, clientX: pts[0][0], clientY: pts[0][1] });
  for (let i = 1; i < pts.length; i++) { clock += dt; canvas.fire('pointermove', { pointerId: id, clientX: pts[i][0], clientY: pts[i][1] }); }
  clock += thrown ? 4 : 200;
  canvas.fire('pointerup', { pointerId: id, clientX: pts[pts.length - 1][0], clientY: pts[pts.length - 1][1] });
}
/** A straight drag by (dx, dy) in n moves. */
const line = (x0, y0, dx, dy, n = 10) => Array.from({ length: n + 1 }, (_, i) => [x0 + (dx * i) / n, y0 + (dy * i) / n]);
/** Two fingers: the second turns about the first by `deg` (clockwise on screen > 0: client y points down), in n moves. */
function twist(canvas, deg, n = 6) {
  const a = [300, 250], r = 100;
  canvas.fire('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: a[0], clientY: a[1] });
  canvas.fire('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: a[0] + r, clientY: a[1] });
  for (let i = 1; i <= n; i++) {
    const th = (deg * i / n) * Math.PI / 180;
    clock += 16;
    canvas.fire('pointermove', { pointerId: 2, clientX: a[0] + r * Math.cos(th), clientY: a[1] + r * Math.sin(th) });
  }
  clock += 200;
  canvas.fire('pointerup', { pointerId: 2, clientX: a[0] + r * Math.cos(deg * Math.PI / 180), clientY: a[1] + r * Math.sin(deg * Math.PI / 180) });
  canvas.fire('pointerup', { pointerId: 1, clientX: a[0], clientY: a[1] });
}
/** The screen angle (degrees, client y down: clockwise > 0) of the projected segment from world point a to b. */
function screenAngle(R, a, b) { const p = R.project(a), q = R.project(b); return Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI; }
const turnDiff = (a, b) => { let d = b - a; d -= 360 * Math.round(d / 360); return d; };

test('turntable: whatever the hand does — drags in every direction, flicks and their coasting, twists, keys, resets — the view never rolls', () => {
  installGlobals({ reduce: false });
  const { R, canvas } = makeScene();
  let s = 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  let checks = 0, worst = { level: 0, inStep: 0, up: 1 };
  const check = (what) => {
    const u = upright(R);
    worst.level = Math.max(worst.level, u.level); worst.inStep = Math.max(worst.inStep, u.inStep); worst.up = Math.min(worst.up, u.up);
    assert.ok(u.level < 1e-9 && u.up >= -1e-12 && u.inStep < 1e-6 && u.el >= -90 && u.el <= 90 && u.az > -180 - 1e-9 && u.az <= 180 + 1e-9,
      `${what}: ${JSON.stringify(u)}`);
    checks++;
  };
  for (let k = 0; k < 160; k++) {
    const a = rnd(), x = 100 + 400 * rnd(), y = 100 + 300 * rnd(), ang = 2 * Math.PI * rnd(), len = 30 + 600 * rnd();
    if (a < 0.4) drag(canvas, line(x, y, len * Math.cos(ang), len * Math.sin(ang), 12));
    else if (a < 0.6) { drag(canvas, line(x, y, 0.3 * len * Math.cos(ang), 0.3 * len * Math.sin(ang), 8), { dt: 8, flick: true }); for (let i = 0; i < 12; i++) { step(); check(`coasting after flick ${k}`); } }
    else if (a < 0.75) twist(canvas, 120 * rnd() - 60);
    else if (a < 0.85) {
      canvas.fire('gesturestart', {}); canvas.fire('gesturechange', { scale: 1, rotation: 90 * rnd() - 45 }); canvas.fire('gestureend', {});
    } else if (a < 0.97) { canvas.fire('keydown', { key: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][Math.floor(4 * rnd())] }); for (let i = 0; i < 8; i++) { step(); check(`key ${k}`); } }
    else { R.resetView(); for (let i = 0; i < 6; i++) { step(); check(`reset glide ${k}`); } }
    check(`action ${k}`);
    steps(3);
  }
  assert.ok(checks > 400, `${checks} checks`);
  assert.ok(worst.level < 1e-12, 'the screen\'s x axis stays level: ' + worst.level);
});

test('turntable: a closed path of the hand brings the view back exactly (a free trackball does not: it rolls)', () => {
  installGlobals({ reduce: true });                  // (no momentum: the view is what the hand did)
  const { R, canvas } = makeScene();
  const s = Math.PI / (0.85 * 500);                  // the renderer's sensitivity on this canvas (rad / css px)
  // the loops stay inside the tilt limits (el 55 ± 25 degrees here)
  const loops = [
    [[80, 0], [0, 50], [-80, 0], [0, -50]],          // a square: right, down, left, up
    [[60, 40], [-30, 20], [-90, -10], [60, -50]],    // a quadrilateral
    [[150, -30], [-40, 60], [-110, -30]],            // a triangle
  ];
  for (const sides of loops) {
    R.resetView(true);
    const q0 = R.getView().q;
    let x = 300, y = 250;
    let free = viewFromAzEl().q.slice();             // the old free trackball, side by side: q <- (dy s, dx s, 0) o q
    for (const [dx, dy] of sides) {
      drag(canvas, line(x, y, dx, dy, 20));
      for (let i = 1; i <= 20; i++) { const ex = dx / 20, ey = dy / 20, a = Math.hypot(ey * s, ex * s); free = T.qNormalize(T.qMul(T.qAxisAngle(ey * s, ex * s, 0, a), free)); }
      x += dx; y += dy;
    }
    assert.ok(angleDeg(q0, R.getView().q) < 1e-9, `the turntable is back where it was: ${angleDeg(q0, R.getView().q)}`);
    assert.ok(angleDeg(viewFromAzEl().q, free) > 1, `(control: the free trackball is ${angleDeg(viewFromAzEl().q, free).toFixed(2)} degrees off after the same loop)`);
  }
});

test('turntable: a drag across turns the table (the near side goes with the finger), a drag down raises the eye; each alone', () => {
  installGlobals({ reduce: true });
  const { R, canvas } = makeScene();
  const s = Math.PI / (0.85 * 500), near = [0, -1, 0];
  const n0 = R.project(near);
  drag(canvas, line(200, 250, 100, 0));
  let u = upright(R);
  assert.ok(Math.abs(u.el - 55) < 1e-9, `across: the tilt is untouched (${u.el})`);
  assert.ok(Math.abs(u.az - (-100 * s * 180 / Math.PI)) < 1e-9, `across: the table turned by 100 px of sensitivity, the near side to the right (${u.az})`);
  const n1 = R.project(near);
  assert.ok(n1[0] > n0[0] + 20, `the near side went right with the finger: ${n0[0].toFixed(1)} -> ${n1[0].toFixed(1)}`);
  drag(canvas, line(300, 200, 0, 50));
  const v = upright(R);
  assert.ok(Math.abs(v.az - u.az) < 1e-9, 'down: the turn is untouched');
  assert.ok(Math.abs(v.el - (55 + 50 * s * 180 / Math.PI)) < 1e-9, `down: the eye rose (${v.el})`);
  assert.ok(R.project(near)[1] > n1[1] + 5, 'the near side went down with the finger');
  // a drag up lowers the eye, also below the paper
  drag(canvas, line(300, 400, 0, -300));
  u = upright(R);
  assert.ok(u.el < 0 && Math.abs(u.az - v.az) < 1e-9, `up: the eye went below the paper (${u.el})`);
  // seen from below, the near side still goes with the finger across
  const b0 = R.project(near);
  drag(canvas, line(200, 250, 60, 0));
  assert.ok(R.project(near)[0] > b0[0] + 10, 'from below too');
});

test('turntable: the tilt stops at straight down and straight up — never over the top; a flick against the limit coasts round, not over', () => {
  installGlobals({ reduce: false });
  const { R, canvas } = makeScene();
  drag(canvas, line(300, 10, 0, 1500, 30));
  let u = upright(R);
  assert.equal(u.el, 90, 'held at straight down');
  assert.ok(Math.abs(u.az) < 1e-9, 'a vertical drag never turns the table');
  const q90 = R.getView().q;
  drag(canvas, line(300, 100, 0, 300));
  assert.ok(angleDeg(q90, R.getView().q) < 1e-12, 'dragging on past the limit does nothing');
  // looking straight down, a drag across turns the picture about the line of sight (the table turns under the eye)
  const a0 = screenAngle(R, [0, 0, 0], [1, 0, 0]);
  drag(canvas, line(200, 250, 100, 0));
  u = upright(R);
  assert.equal(u.el, 90);
  assert.ok(Math.abs(Math.abs(turnDiff(a0, screenAngle(R, [0, 0, 0], [1, 0, 0]))) - 100 * Math.PI / (0.85 * 500) * 180 / Math.PI) < 1e-4, 'the picture turned by the table\'s turn (float32 projection)');
  // a vertical flick coasts in the tilt too (an early build stopped the tilt's coast after one frame), and stops
  // dead at the limit
  R.setView({ az: 0, el: 0 });
  drag(canvas, line(300, 200, 0, 48, 6), { dt: 8, flick: true });
  const fl = upright(R);
  steps(4);
  const fl4 = upright(R);
  assert.ok(fl4.el > fl.el + 2 && Math.abs(fl4.az) < 1e-12, `the tilt coasts on after a vertical flick: ${fl.el.toFixed(2)} -> ${fl4.el.toFixed(2)}`);
  steps(4);
  assert.ok(upright(R).el > fl4.el, '... and on');
  steps(60);
  const rest = upright(R).el;
  steps(10);
  assert.ok(rest > fl4.el && upright(R).el === rest, 'then rests');
  drag(canvas, line(300, 100, 0, 1500, 30));
  // a diagonal flick into the limit: the tilt stays at the limit, the turn coasts on after the release
  drag(canvas, line(200, 200, 160, 120, 8), { dt: 8, flick: true });
  const atRelease = upright(R);
  steps(30);
  u = upright(R);
  assert.equal(u.el, 90, 'still at the limit after the coast');
  assert.ok(Math.abs(turnDiff(atRelease.az, u.az)) > 3, `the turn coasted on: ${atRelease.az.toFixed(2)} -> ${u.az.toFixed(2)}`);
  drag(canvas, line(300, 490, 0, -3000, 40));
  u = upright(R);
  assert.equal(u.el, -90, 'held at straight up from below');
  assert.ok(u.level < 1e-12);
});

test('turntable: two fingers twist the table, the picture following the fingers — from above and from below; the tilt and the zoom are left alone', () => {
  installGlobals({ reduce: true });
  const { R, canvas } = makeScene();
  twist(canvas, 30);
  let u = upright(R);
  assert.ok(Math.abs(u.el - 55) < 1e-9 && Math.abs(u.zoom - 1) < 1e-9, 'a twist neither tilts nor zooms');
  assert.ok(Math.abs(u.az - 30) < 1e-6, `a clockwise twist of 30 degrees turns the table 30 degrees (${u.az})`);
  assert.ok(u.level < 1e-12, 'and does not roll');
  for (const el of [90, -90]) {
    R.setView({ az: 0, el });
    const a0 = screenAngle(R, [0, 0, 0], [1, 0, 0]);
    twist(canvas, 30);
    const d = turnDiff(a0, screenAngle(R, [0, 0, 0], [1, 0, 0]));
    // (the projection is float32: a micro-degree)
    assert.ok(Math.abs(d - 30) < 1e-4, `looking straight ${el > 0 ? 'down' : 'up'}, the picture turns with the fingers: ${d}`);
    twist(canvas, -45);
    assert.ok(Math.abs(turnDiff(a0, screenAngle(R, [0, 0, 0], [1, 0, 0])) + 15) < 1e-4, '... back the other way');
    // (the table itself, exactly: seen from below, a clockwise twist turns it the other way round its axis)
    assert.ok(Math.abs(turnDiff(0, upright(R).az) - (el > 0 ? -15 : 15)) < 1e-9, `the table itself: ${upright(R).az}`);
  }
});

test('turntable: Safari\'s trackpad rotation turns the table and its pinch zooms, at the same time; nothing rolls', () => {
  installGlobals({ reduce: true });
  const { R, canvas } = makeScene();
  canvas.fire('gesturestart', {});
  canvas.fire('gesturechange', { scale: 1, rotation: 12 });
  canvas.fire('gesturechange', { scale: 1.5, rotation: 20 });
  canvas.fire('gestureend', {});
  const u = upright(R);
  assert.ok(Math.abs(u.az - 20) < 1e-6 && Math.abs(u.el - 55) < 1e-9, `turned 20 degrees, not tilted: ${JSON.stringify(u)}`);
  assert.ok(Math.abs(u.zoom - 1.5) < 1e-6, 'zoomed 1.5x');
  assert.ok(u.level < 1e-12);
});

test('turntable: the arrow keys turn the table and tilt it by 9 degrees; the tilt is held at its limits; a key with momentum totals its step', () => {
  installGlobals({ reduce: true });
  const { R, canvas } = makeScene();
  const key = (k) => canvas.fire('keydown', { key: k });
  key('ArrowLeft');
  assert.ok(Math.abs(upright(R).az - 9) < 1e-9 && Math.abs(upright(R).el - 55) < 1e-9, 'left: the near side to the left (az + 9)');
  key('ArrowRight'); key('ArrowRight');
  assert.ok(Math.abs(upright(R).az + 9) < 1e-9, 'right: back and on');
  key('ArrowDown');
  assert.ok(Math.abs(upright(R).el - 64) < 1e-9 && Math.abs(upright(R).az + 9) < 1e-9, 'down: the eye rises (as a drag down)');
  key('ArrowUp'); key('ArrowUp');
  assert.ok(Math.abs(upright(R).el - 46) < 1e-9, 'up: it sinks');
  R.setView({ az: 0, el: 85 });
  key('ArrowDown');
  assert.equal(upright(R).el, 90, 'held at straight down');
  key('ArrowDown');
  assert.equal(upright(R).el, 90);
  R.setView({ az: 0, el: -85 });
  key('ArrowUp');
  assert.equal(upright(R).el, -90, 'held at straight up');
  // with momentum: the turn glides in and totals the step
  const query = installGlobals({ reduce: false });
  const m = makeScene();
  m.canvas.fire('keydown', { key: 'ArrowLeft' });
  steps(60);
  assert.ok(Math.abs(upright(m.R).az - 9) < 1e-6 && Math.abs(upright(m.R).el - 55) < 1e-9, `glided 9 degrees: ${JSON.stringify(upright(m.R))}`);
  // a second key after the first has come to rest moves by its own step only (the glide that ended leaves nothing
  // behind: an early build re-applied the last speck of the first glide, 0.14 degrees, found in a real Chrome)
  m.canvas.fire('keydown', { key: 'ArrowDown' });
  steps(60);
  assert.ok(Math.abs(upright(m.R).az - 9) < 1e-9 && Math.abs(upright(m.R).el - 64) < 1e-6, `then down: only the tilt moved: ${JSON.stringify(upright(m.R))}`);
  m.R.setView({ az: 0, el: 86 });
  m.canvas.fire('keydown', { key: 'ArrowDown' });
  steps(60);
  assert.equal(upright(m.R).el, 90, 'the gliding tilt stops at the limit');
  assert.ok(query.ls.size >= 1);
});

test('turntable: getView gives az / el; setView takes them, wrapped and held, over a q beside them; a q alone is set upright, keeping its eye; straight down keeps its turn', () => {
  installGlobals({ reduce: true });
  const { R } = makeScene();
  R.setView({ az: 30, el: 90 });
  assert.deepEqual([R.getView().az, R.getView().el].map((x) => Math.round(x * 1e9) / 1e9), [30, 90], 'looking straight down, the turn is kept as az (no roll)');
  R.setView({ az: -200, el: 120, zoom: 2 });
  let u = upright(R);
  assert.ok(Math.abs(u.az - 160) < 1e-9 && u.el === 90 && Math.abs(u.zoom - 2) < 1e-9, `wrapped and held: ${JSON.stringify(u)}`);
  R.setView({ zoom: 1.3 });
  assert.ok(Math.abs(upright(R).az - 160) < 1e-9 && Math.abs(upright(R).zoom - 1.3) < 1e-9, 'a zoom alone leaves the turntable where it is');
  // a q that rolled (the free trackball's, an old link's): the eye's place is kept, the roll dropped
  const h = 25 * Math.PI / 360, rolled = T.qMul([0, 0, Math.sin(h), Math.cos(h)], viewFromAzEl(40, 20).q);
  R.setView({ q: rolled });
  u = upright(R);
  assert.ok(Math.abs(u.az - 40) < 1e-9 && Math.abs(u.el - 20) < 1e-9 && u.level < 1e-12, `upright, the eye kept: ${JSON.stringify(u)}`);
  // straight down / up, from a q: the turn is read off the screen's x axis
  for (const [az, el] of [[123, 90], [-60, -90], [10, 89.99999], [-170, -89.9999999]]) {
    R.setView({ q: viewFromAzEl(az, el).q });
    u = upright(R);
    assert.ok(Math.abs(turnDiff(az, u.az)) < 1e-6 && Math.abs(u.el - el) < 1e-6, `${az} / ${el}: ${JSON.stringify(u)}`);
  }
  R.setView({ q: viewFromAzEl(10, 10).q, az: 50, el: 30 });
  assert.ok(Math.abs(upright(R).az - 50) < 1e-9 && Math.abs(upright(R).el - 30) < 1e-9, 'az / el win over a q beside them');
  // what getView gives, setView takes back exactly (the 22x lab passes views from card to card)
  R.setView({ az: 77.7, el: -33.3, zoom: 2.2 });
  const v = R.getView();
  R.resetView(true);
  R.setView(v);
  assert.ok(angleDeg(v.q, R.getView().q) < 1e-12 && Math.abs(R.getView().zoom - 2.2) < 1e-12, 'getView -> setView: the same view');
  R.resetView(true);
  R.setView({ q: v.q, zoom: v.zoom });
  assert.ok(angleDeg(v.q, R.getView().q) < 1e-9, '... and from its q alone');
});

test('turntable: reset glides home along the table and the tilt, never through a roll, and lands exactly', () => {
  installGlobals({ reduce: false });
  const { R } = makeScene();
  R.setView({ az: 170, el: -70, zoom: 2 });
  R.resetView();
  let prev = upright(R);
  for (let i = 0; i < 40; i++) {
    step();
    const u = upright(R);
    assert.ok(u.level < 1e-12 && u.inStep < 1e-6, 'upright all the way');
    assert.ok(u.az <= prev.az + 1e-9 && u.az >= -1e-9 && u.el >= prev.el - 1e-9 && u.el <= 55 + 1e-9, `monotone, the shorter way round (170 -> 0): ${prev.az.toFixed(2)} -> ${u.az.toFixed(2)}, ${prev.el.toFixed(2)} -> ${u.el.toFixed(2)}`);
    prev = u;
  }
  assert.ok(angleDeg(R.getView().q, viewFromAzEl().q) < 1e-9 && Math.abs(R.getView().zoom - 1) < 1e-9, 'home');
  // from the other side the table turns the other way
  R.setView({ az: -150, el: 10 });
  R.resetView();
  step(); step();
  assert.ok(upright(R).az > -150 && upright(R).az < 0, 'up from -150');
});
