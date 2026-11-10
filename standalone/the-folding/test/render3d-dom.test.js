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
  assert.match(fs, /mix\(gl_FrontFacing \? uFront : uBack, uGhost, mod\(tq, 2\.0\)\)/, 'bit 0: the ghost colour');
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
