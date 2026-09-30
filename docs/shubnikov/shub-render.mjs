// Drawing one class of the Shubnikov census.
//
// The picture of a class is the phase sector of a sum of plane waves:
// shub-field.mjs turns the census entry into a list of waves, this file turns
// that list into pixels.  There is exactly one WebGL2 context for the whole
// page — an offscreen canvas that every card borrows in turn.  Per card per
// frame: upload the waves at time t, draw one full-screen triangle into a
// square viewport at the bottom-left of the shared canvas, then `drawImage`
// that square into the card's own 2D canvas.  A hundred small GL canvases
// would exhaust the browser's context limit; one does not.
//
// A CPU twin renders the same picture from psi()/sector() at modest
// resolution, for machines without WebGL2 and for `?renderer=cpu` tests.

import { psi, sector, greys } from './shub-field.mjs';

export const MAX_WAVES = 72;

// The two views.  "Greys": n inks evenly spaced in lightness, colour 0 darkest.
// "One colour": colour 0 near-black, every other colour near-white, so what is
// left black is exactly one colour class — a set whose symmetry group is the
// kernel of sigma.
const ONE_DARK = [0x11, 0x11, 0x11];
const ONE_LIGHT = [0xf4, 0xf4, 0xf2];

/** The n inks of a view, as [r, g, b] bytes, colour 0 first. */
export function inkBytes(n, view = 'greys') {
  if (view === 'one') {
    const out = [ONE_DARK.slice()];
    for (let k = 1; k < n; k++) out.push(ONE_LIGHT.slice());
    return out;
  }
  return greys(n).map((g) => [g, g, g]);
}

export const inkCss = (rgb) => `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;

const VERTEX = `#version 300 es
void main() {
  // one triangle that covers the clip square, from gl_VertexID alone
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 uWaves[${MAX_WAVES}];   // (p0, p1, Re b, Im b) at the current time
uniform int uCount;
uniform int uN;
uniform vec3 uInk[6];
uniform mat2 uToLattice;             // lattice coordinates from Cartesian
uniform float uWidth;                // Cartesian width of the square shown
uniform float uSize;                 // viewport edge, device pixels
out vec4 color;
const float TAU = 6.283185307179586;

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;        // GL's y runs up, and so does ours
  vec2 lat = uToLattice * ((uv - 0.5) * uWidth);
  vec2 z = vec2(0.0);
  for (int i = 0; i < uCount; i++) {
    vec4 w = uWaves[i];
    float a = TAU * (w.x * lat.x + w.y * lat.y);
    float c = cos(a), s = sin(a);
    z += vec2(w.z * c - w.w * s, w.z * s + w.w * c);
  }
  // Reading k is how far Psi points into the middle of sector k; the largest
  // reading is exactly floor(n * turn(arg Psi)).  Argmax rather than a
  // floor() of the angle, so the boundaries can be anti-aliased symmetrically
  // and every colour law survives the softening.
  //
  // The readings are taken from Psi/|Psi|, not from Psi.  Only the direction
  // decides the colour, and dividing the magnitude out keeps fwidth() a
  // measure of how fast the *phase* turns: on the raw projections it also
  // grows with |Psi|, which smeared whole regions of an n = 6 card into a
  // continuous ramp instead of softening a one-pixel edge.
  float rd[6], fw[6];
  float nf = float(uN);
  vec2 dir = z / max(length(z), 1e-6);
  for (int k = 0; k < 6; k++) {
    float th = TAU * (float(k) + 0.5) / nf;
    rd[k] = dir.x * cos(th) + dir.y * sin(th);
    fw[k] = fwidth(rd[k]);            // uniform control flow: constant bounds
  }
  vec3 sum = vec3(0.0);
  float tot = 0.0;
  for (int k = 0; k < 6; k++) {
    if (k >= uN) break;
    float best = -1e30, bestfw = 0.0;
    for (int j = 0; j < 6; j++) {
      if (j >= uN) break;
      if (j != k && rd[j] > best) { best = rd[j]; bestfw = fw[j]; }
    }
    float e = max(0.5 * (fw[k] + bestfw), 1e-7);
    float s = smoothstep(-e, e, rd[k] - best);
    sum += s * uInk[k];
    tot += s;
  }
  color = vec4(tot > 1e-6 ? sum / tot : uInk[0], 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader: ${log}`);
  }
  return shader;
}

class GLRenderer {
  constructor(gl) {
    this.kind = 'webgl';
    this.gl = gl;
    this.canvas = gl.canvas;
    this.lost = false;
    // A GPU-process crash, a driver reset or a long spell in a background tab
    // takes the context away.  Without this every later draw is a silent
    // no-op and the whole page goes black for the rest of the session.
    this.onLost = null;         // the page swaps in the CPU twin
    this.onRestored = null;     // ...and asks for every card again
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();   // ask for a restore rather than a dead context
      this.lost = true;
      console.warn('shubnikov: the WebGL context was lost');
      if (this.onLost) this.onLost();
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.build();
      this.lost = false;
      if (this.onRestored) this.onRestored();
    });
    this.build();
    this.size = 0;
  }

  /** Compile the program and set the fixed state; re-run after a restore. */
  build() {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`link: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    this.u = {};
    // array uniforms are addressed by their first element
    const names = { uWaves: 'uWaves[0]', uInk: 'uInk[0]' };
    for (const name of ['uWaves', 'uCount', 'uN', 'uInk', 'uToLattice', 'uWidth', 'uSize']) {
      this.u[name] = gl.getUniformLocation(program, names[name] || name);
    }
    this.vao = gl.createVertexArray();
    this.waves = new Float32Array(MAX_WAVES * 4);
    this.inks = new Float32Array(18);
    gl.useProgram(program);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  // The shared canvas only ever grows; a card draws into a square at its
  // bottom-left corner and copies that square out.
  ensure(size) {
    if (this.canvas.width < size || this.canvas.height < size) {
      const edge = Math.max(size, this.canvas.width, this.canvas.height);
      this.canvas.width = edge;
      this.canvas.height = edge;
    }
  }

  /** Draw one class into `ctx` (a 2D context whose canvas is size x size). */
  draw(ctx, { field, slice, toLattice, width, n, view, size }) {
    const gl = this.gl;
    if (this.lost) return;
    this.ensure(size);
    // The CPU twin sums every wave, so truncating here would quietly draw a
    // different picture on the two paths.  Today's census tops out at exactly
    // MAX_WAVES; say so loudly if a wider ring ever ships.
    if (field.count > MAX_WAVES && !GLRenderer.warned) {
      GLRenderer.warned = true;
      console.error(`shubnikov: ${field.count} waves is more than the shader's `
        + `${MAX_WAVES}; the picture is truncated. Raise MAX_WAVES in shub-render.mjs.`);
    }
    const count = Math.min(field.count, MAX_WAVES);
    this.waves.set(slice.subarray(0, count * 4));
    const inks = inkBytes(n, view);
    for (let k = 0; k < 6; k++) {
      const rgb = inks[Math.min(k, inks.length - 1)];
      this.inks[3 * k] = rgb[0] / 255;
      this.inks[3 * k + 1] = rgb[1] / 255;
      this.inks[3 * k + 2] = rgb[2] / 255;
    }
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, size, size);
    gl.uniform4fv(this.u.uWaves, this.waves);
    gl.uniform1i(this.u.uCount, count);
    gl.uniform1i(this.u.uN, n);
    gl.uniform3fv(this.u.uInk, this.inks);
    // GLSL packs a mat2 by columns; toLattice is written by rows.
    gl.uniformMatrix2fv(this.u.uToLattice, false, new Float32Array([
      toLattice[0][0], toLattice[1][0], toLattice[0][1], toLattice[1][1],
    ]));
    gl.uniform1f(this.u.uWidth, width);
    gl.uniform1f(this.u.uSize, size);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.drawImage(this.canvas, 0, this.canvas.height - size, size, size, 0, 0, size, size);
  }
}

// The CPU twin: the same picture, evaluated point by point with psi(), at a
// resolution that keeps a whole grid of cards interactive.  No anti-aliasing —
// the sector boundaries are hard — so it is a fallback, not a match.
//
// Every pixel costs a pass over up to 72 plane waves, so the edge is the whole
// budget.  A card is normally held well under this by the size/3 below; the
// cap is what keeps a retina card and the 900-pixel viewer affordable.
class CPURenderer {
  constructor(maxEdge = 96) {
    this.kind = 'cpu';
    this.maxEdge = maxEdge;
    this.canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(maxEdge, maxEdge)
      : Object.assign(document.createElement('canvas'), { width: maxEdge, height: maxEdge });
    this.ctx = this.canvas.getContext('2d');
    this.image = null;
  }

  draw(ctx, { field, toLattice, width, n, view, size, t }) {
    const edge = Math.max(16, Math.min(this.maxEdge, Math.round(size / 3)));
    if (!this.image || this.image.width !== edge) {
      this.image = this.ctx.createImageData(edge, edge);
    }
    const data = this.image.data;
    const inks = inkBytes(n, view);
    for (let row = 0; row < edge; row++) {
      // ImageData row 0 is the top; Cartesian y runs up.
      const cy = (0.5 - (row + 0.5) / edge) * width;
      for (let col = 0; col < edge; col++) {
        const cx = ((col + 0.5) / edge - 0.5) * width;
        const x0 = toLattice[0][0] * cx + toLattice[0][1] * cy;
        const x1 = toLattice[1][0] * cx + toLattice[1][1] * cy;
        const [re, im] = psi(field, x0, x1, t);
        const rgb = inks[sector(re, im, n)];
        const at = 4 * (row * edge + col);
        data[at] = rgb[0]; data[at + 1] = rgb[1]; data[at + 2] = rgb[2]; data[at + 3] = 255;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.canvas, 0, 0, edge, edge, 0, 0, size, size);
  }
}

/** One renderer for the page.  Returns a GL renderer when WebGL2 works. */
export function createRenderer({ prefer = 'auto' } = {}) {
  if (prefer !== 'cpu') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const gl = canvas.getContext('webgl2', {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false,
        powerPreference: 'low-power', failIfMajorPerformanceCaveat: false,
      });
      if (gl) return new GLRenderer(gl);
    } catch (error) {
      console.warn('shubnikov: WebGL2 unavailable, falling back to the CPU renderer', error);
    }
  }
  return new CPURenderer();
}
