// Studio — drawing a frame.
//
// The field of studio-core.mjs, written again as a fragment shader.  A frame is
// drawn in two passes:
//
//   cell    the four fields over one lattice cell, into a half-float texture.
//           This is where the work is: every texel walks every copy of every
//           shape.
//   screen  the texture tiled over the view, each field thresholded at zero
//           with an edge one device pixel soft, and the four put together.
//
// The film is periodic, so the cell pass costs the same however much plane the
// view shows, and panning and zooming cost nothing; and because the texture
// holds fields rather than the finished picture, every outline is drawn from
// interpolated values and stays sharp when the cell is magnified.
//
// Where a float texture cannot be rendered to, the same shader draws straight
// to the screen instead (`direct`), slower and exactly the same picture.

import { SHAPES, GLASS, STAMP_FLOOR, INVERT_CAP } from './studio-core.mjs?v=studio-v2';

const DATA_W = 64;
const DATA_H = 64;
const STORE = 256;            // see CELL_FRAGMENT

export const PALETTES = {
  bw: { label: 'Black & white', ink: ['#000000', '#ffffff'] },
  paper: { label: 'Ink & paper', ink: ['#15161a', '#f4f1e8'] },
  blueprint: { label: 'Blueprint', ink: ['#12305c', '#f3f0e6'] },
  ember: { label: 'Ember', ink: ['#1a0d08', '#f2a33a'] },
  moss: { label: 'Moss', ink: ['#14261c', '#e4e8c9'] },
  plum: { label: 'Plum', ink: ['#2a1238', '#f2d9c4'] },
};

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// The shape table in the same order as SHAPES in studio-core.mjs.
const FIELD = `
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uData;
uniform ivec4 uCount;        // floods, stamps, inverters, wave terms
uniform int uWaveStart;
uniform mat2 uP;             // lattice -> Cartesian
uniform mat2 uPinv;
uniform vec2 uU;             // colour shift of the two lattice steps
uniform vec4 uSafe;
uniform vec2 uH;             // mean softness: floods, stamps

const float TAU = 6.283185307179586;
const float PI = 3.141592653589793;
const float NONE = -1e30;

vec4 T(int i) { return texelFetch(uData, ivec2(i % ${DATA_W}, i / ${DATA_W}), 0); }

float sdBox(vec2 p, vec2 h, float rad) {
  vec2 d = abs(p) - (h - rad);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - rad;
}

float sdShape(int type, vec2 p, float r, float a, float n, float q) {
  if (type == 0) return length(p) - r;
  if (type == 1) {
    vec2 b = vec2(r, r * a);
    float k1 = length(p / b), k2 = length(p / (b * b));
    return k2 < 1e-9 ? -b.y : k1 * (k1 - 1.0) / k2;
  }
  if (type == 2) {
    float w = r * a, L = r - w;
    return length(vec2(max(abs(p.x) - L, 0.0), p.y)) - w;
  }
  if (type == 3) return sdBox(p, vec2(r, r * a), q * min(r, r * a));
  if (type == 4) {
    float an = PI / n, ca = cos(an), sa = sin(an);
    float rr = 0.8 * q * r * ca, ri = r - rr / ca;
    float m = 2.0 * an;
    float bn = atan(p.x, p.y); bn = bn - m * floor(bn / m) - an;
    float len = length(p);
    vec2 s = vec2(len * cos(bn) - ri * ca, len * abs(sin(bn)) - ri * sa);
    s.y += clamp(-s.y, 0.0, ri * sa);
    return length(s) * (s.x > 0.0 ? 1.0 : -1.0) - rr;
  }
  if (type == 5) {
    float an = PI / n, m = 2.0 * an;
    float rr = 0.35 * q * r * a, ro = r - rr;
    float bn = atan(p.x, p.y) + an; bn = bn - m * floor(bn / m) - an;
    float len = length(p);
    vec2 s = vec2(len * cos(bn), len * abs(sin(bn)));
    vec2 ba = vec2(ro * a * cos(an) - ro, ro * a * sin(an));
    vec2 pa = s - vec2(ro, 0.0);
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float sg = ba.x * pa.y - ba.y * pa.x;
    return length(pa - ba * h) * (sg > 0.0 ? -1.0 : 1.0) - rr;
  }
  if (type == 6) {
    float th = r * a;
    return abs(length(p) - (r - 0.5 * th)) - 0.5 * th;
  }
  if (type == 7) {
    float r1 = r * a, r2 = r - r1;
    float big = length(p) - r;
    float head = length(p - vec2(0.0, r - r1)) - r1;
    float hole = length(p + vec2(0.0, r1)) - r2;
    bool inside = max(min(max(big, -p.x), head), -hole) < 0.0;
    float top = length(p - vec2(0.0, r)), mid = length(p - vec2(0.0, r - 2.0 * r1)), bottom = length(p + vec2(0.0, r));
    float d = min(min(
      p.x >= 0.0 ? abs(big) : min(top, bottom),
      p.x <= 0.0 ? abs(head) : min(top, mid)),
      p.x >= 0.0 ? abs(hole) : min(mid, bottom));
    return inside ? -d : d;
  }
  if (type == 8) {
    float dd = 2.0 * r * a, py = abs(p.y);
    float aa = 0.5 * dd, bb = sqrt(max(r * r - aa * aa, 0.0));
    if (dd * (p.x * bb - py * aa) > dd * dd * max(bb - py, 0.0)) return length(vec2(p.x - aa, py - bb));
    return max(length(vec2(p.x, py)) - r, r - length(vec2(p.x - dd, py)));
  }
  if (type == 9) {
    float w = r * a, rad = q * w;
    return min(sdBox(p, vec2(r, w), rad), sdBox(p, vec2(w, r), rad));
  }
  if (type == 10) {
    float al = PI * a; vec2 sc = vec2(sin(al), cos(al));
    float rb = r * (0.06 + 0.3 * q), ra = r - rb;
    vec2 s = vec2(abs(p.x), p.y);
    float d = sc.y * s.x > sc.x * s.y ? length(s - sc * ra) : abs(length(s) - ra);
    return d - rb;
  }
  if (type == 11) {
    float al = PI * a; vec2 sc = vec2(sin(al), cos(al));
    vec2 s = vec2(abs(p.x), p.y);
    float l = length(s) - r;
    float m = length(s - sc * clamp(dot(s, sc), 0.0, r));
    return max(l, m * (sc.y * s.x - sc.x * s.y > 0.0 ? 1.0 : -1.0));
  }
  return length(p) - r;
}

void lse(inout vec2 acc, float e) {
  if (e > acc.x) { acc.y = acc.y * exp(acc.x - e) + 1.0; acc.x = e; }
  else acc.y += exp(e - acc.x);
}
float lseValue(vec2 acc) { return acc.y > 0.0 ? acc.x + log(acc.y) : NONE; }

// (G, A, S, I): see studio-core.mjs
vec4 field(vec2 lat) {
  vec2 X = uP * lat;
  vec2 fp = vec2(NONE, 0.0), fq = fp;
  vec2 sp = vec2(${STAMP_FLOOR.toFixed(1)}, 1.0), sq = sp;
  bool anyFlood = false;
  int idx = 0;
  int nFS = uCount.x + uCount.y;
  for (int L = 0; L < nFS; L++) {
    vec4 h0 = T(idx), h1 = T(idx + 1);
    int type = int(h0.x + 0.5);
    int mode = int(h1.z + 0.5), nc = int(h1.w + 0.5);
    bool flood = L < uCount.x;
    float R2 = uSafe[mode], R1 = 0.8 * R2;
    int lo = mode == 1 ? 0 : -1, hi = mode == 3 ? 1 : 0;
    for (int c = 0; c < nc; c++) {
      vec4 ca = T(idx + 2 + 3 * c), cb = T(idx + 3 + 3 * c), cc = T(idx + 4 + 3 * c);
      vec2 dl = uPinv * (X - ca.xy);
      vec2 fl = mode == 2 ? floor(dl) : floor(dl + 0.5);
      vec2 d0 = dl - fl;
      for (int i = lo; i <= hi; i++) {
        for (int j = lo; j <= hi; j++) {
          vec2 ij = vec2(float(i), float(j));
          vec2 cxy = uP * (d0 + ij);
          float e = cc.x;
          if (flood) {
            float rr = length(cxy);
            if (rr >= R2) continue;
            if (rr > R1) { float s = (R2 - rr) / (R2 - R1); e += log(s * s * (3.0 - 2.0 * s)); }
          }
          vec2 loc = vec2(cb.x * cxy.x + cb.y * cxy.y, cb.z * cxy.x + cb.w * cxy.y);
          e -= sdShape(type, loc, h0.y * ca.z, h0.z, h0.w, h1.x) * h1.y;
          bool white = mod(ca.w + dot(uU, fl - ij), 2.0) < 0.5;
          if (flood) { anyFlood = true; if (white) lse(fp, e); else lse(fq, e); }
          else { if (white) lse(sp, e); else lse(sq, e); }
        }
      }
    }
    idx += 2 + 3 * nc;
  }
  float G = 0.0;
  if (anyFlood) G = uH.x * (lseValue(fp) - lseValue(fq));
  for (int w = 0; w < uCount.w; w++) {
    vec4 tw = T(uWaveStart + w);
    G += tw.z * cos(TAU * dot(tw.xy, lat) + tw.w);
  }
  G = clamp(G, -60.0, 60.0);
  float Lp = lseValue(sp), Lq = lseValue(sq);
  float S = uH.y * (Lp - Lq);
  float A = uH.y * (max(Lp, Lq) + log(1.0 + exp(-abs(Lp - Lq))));
  float I = ${INVERT_CAP.toFixed(4)};
  for (int L = 0; L < uCount.z; L++) {
    vec4 h0 = T(idx), h1 = T(idx + 1);
    int type = int(h0.x + 0.5);
    int mode = int(h1.z + 0.5), nc = int(h1.w + 0.5);
    int lo = mode == 1 ? 0 : -1, hi = mode == 3 ? 1 : 0;
    float d = ${INVERT_CAP.toFixed(4)};
    for (int c = 0; c < nc; c++) {
      vec4 ca = T(idx + 2 + 3 * c), cb = T(idx + 3 + 3 * c);
      vec2 dl = uPinv * (X - ca.xy);
      vec2 d0 = dl - (mode == 2 ? floor(dl) : floor(dl + 0.5));
      for (int i = lo; i <= hi; i++) {
        for (int j = lo; j <= hi; j++) {
          vec2 cxy = uP * (d0 + vec2(float(i), float(j)));
          vec2 loc = vec2(cb.x * cxy.x + cb.y * cxy.y, cb.z * cxy.x + cb.w * cxy.y);
          d = min(d, sdShape(type, loc, h0.y * ca.z, h0.z, h0.w, h1.x));
        }
      }
    }
    idx += 2 + 3 * nc;
    I = (d < 0.0 ? -1.0 : 1.0) * (I < 0.0 ? -1.0 : 1.0) * min(abs(I), abs(d));
  }
  return vec4(G, A, S, I);
}
`;

const SHADE = `
uniform vec3 uInk0;
uniform vec3 uInk1;
// The sign of a field, softened over one device pixel along that field alone.
// The softening reads the field's slope, and a slope says "an outline is near"
// only if the field is close to linear.  Where copies tie, it is not: it falls
// away exponentially without ever changing sign.  So the caller says, from the
// neighbouring samples, whether the sign really does change (soft).
float edge(float f, bool soft) {
  if (!soft) return f > 0.0 ? 1.0 : f < 0.0 ? -1.0 : 0.0;
  return clamp(f / max(0.75 * fwidth(f), ${GLASS.toExponential()}), -1.0, 1.0);
}
// 1 where a field has a sign, 0 where it is zero up to rounding (white and
// black copies equally near: the group has cancelled them there).  In such a
// place the field falls away a factor e in about one softness, so a ramp over
// that factor is a crisp edge.
float inked(float f) { return clamp(log(max(abs(f), 1e-30) / ${GLASS.toExponential()}), 0.0, 1.0); }
vec4 shade(vec4 c, bvec4 soft) {
  float v = edge(c.x, soft.x) * inked(c.x);            // the ground; undecided ground stays grey
  float cover = 0.5 + 0.5 * edge(c.y, soft.y);
  v = mix(v, edge(c.z, soft.z), cover * inked(c.z));   // a stamp with no ink is glass
  v *= edge(c.w, soft.w);
  return vec4(mix(uInk0, uInk1, 0.5 + 0.5 * v), 1.0);
}
`;

const CELL_FRAGMENT = `#version 300 es
${FIELD}
uniform float uCellSize;     // texels across the texture
uniform float uCells;        // lattice cells across the texture
out vec4 color;
void main() {
  // scaled, so that the smallest value that matters is an ordinary half-float
  color = ${STORE.toFixed(1)} * field(gl_FragCoord.xy / uCellSize * uCells);
}`;

const SCREEN_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uCell;
uniform float uCells;
uniform mat2 uPinv;
uniform vec4 uView;          // centre x, centre y, units per device pixel, -
uniform vec4 uPort;          // viewport x, y, width, height
${SHADE}
out vec4 color;
void main() {
  vec2 X = uView.xy + (gl_FragCoord.xy - uPort.xy - 0.5 * uPort.zw) * uView.z;
  vec2 uv = (uPinv * X) / uCells;
  // half a pixel each way, in texture coordinates: does a field change sign here?
  vec2 dx = uPinv * vec2(0.5 * uView.z, 0.0) / uCells, dy = uPinv * vec2(0.0, 0.5 * uView.z) / uCells;
  vec4 c = texture(uCell, uv);
  vec4 c1 = texture(uCell, uv + dx + dy), c2 = texture(uCell, uv + dx - dy);
  vec4 c3 = texture(uCell, uv - dx + dy), c4 = texture(uCell, uv - dx - dy);
  vec4 lo = min(min(min(c1, c2), min(c3, c4)), c), hi = max(max(max(c1, c2), max(c3, c4)), c);
  bvec4 soft = bvec4(lo.x < 0.0 && hi.x > 0.0, lo.y < 0.0 && hi.y > 0.0, lo.z < 0.0 && hi.z > 0.0, lo.w < 0.0 && hi.w > 0.0);
  color = shade(c / ${STORE.toFixed(1)}, soft);
}`;

const DIRECT_FRAGMENT = `#version 300 es
${FIELD}
uniform vec4 uView;
uniform vec4 uPort;
${SHADE}
out vec4 color;
void main() {
  vec2 X = uView.xy + (gl_FragCoord.xy - uPort.xy - 0.5 * uPort.zw) * uView.z;
  vec2 lat = uPinv * X;
  // one evaluation a pixel: every sign is softened by its slope
  color = shade(field(lat - 2.0 * floor(lat * 0.5)), bvec4(true));
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`studio shader: ${log}`);
  }
  return shader;
}

function link(gl, fragment, names) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`studio link: ${gl.getProgramInfoLog(program)}`);
  }
  const u = {};
  for (const name of names) u[name] = gl.getUniformLocation(program, name);
  return { program, u };
}

const FIELD_UNIFORMS = ['uData', 'uCount', 'uWaveStart', 'uP', 'uPinv', 'uU', 'uSafe', 'uH'];

/** Pack a compiled frame into the data texture's floats. */
export function packFrame(frame, out) {
  const type = (shape) => shape.type;
  let at = 0;
  const put = (a, b, c, d) => { out[at++] = a; out[at++] = b; out[at++] = c; out[at++] = d; };
  const counts = [0, 0, 0, 0];
  const limit = out.length - 8;
  for (const shape of frame.shapes) {
    if (at + 4 * (2 + 3 * shape.copies.length) > limit) break;
    counts[shape.role === 'f' ? 0 : shape.role === 's' ? 1 : 2] += 1;
    put(type(shape), shape.r, shape.a, shape.n);
    put(shape.q, 1 / shape.h, shape.mode, shape.copies.length);
    for (const copy of shape.copies) {
      put(copy.ox, copy.oy, copy.scale, copy.ink);
      put(copy.q00, copy.q01, copy.q10, copy.q11);
      put(copy.lnp, 0, 0, 0);
    }
  }
  const waveStart = at / 4;
  for (const wave of frame.waves) {
    for (const term of wave.terms) {
      if (at > limit) break;
      put(term.q0, term.q1, term.amp, term.phase);
      counts[3] += 1;
    }
  }
  return { counts, waveStart };
}

export class Renderer {
  constructor(canvas, { forceDirect = false } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('This page needs WebGL 2.');
    this.gl = gl;
    this.forceDirect = forceDirect;
    this.data = new Float32Array(DATA_W * DATA_H * 4);
    this.lost = false;
    this.onRestored = null;
    canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => {
      this.build();
      this.lost = false;
      if (this.onRestored) this.onRestored();
    });
    this.build();
  }

  build() {
    const gl = this.gl;
    const floatTarget = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    this.mode = floatTarget && !this.forceDirect ? 'cell' : 'direct';
    this.vao = gl.createVertexArray();
    this.dataTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dataTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, DATA_W, DATA_H, 0, gl.RGBA, gl.FLOAT, this.data);
    for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, key, value);
    this.direct = link(gl, DIRECT_FRAGMENT, [...FIELD_UNIFORMS, 'uView', 'uPort', 'uInk0', 'uInk1']);
    this.cellSize = 0;
    if (this.mode === 'cell') {
      this.cell = link(gl, CELL_FRAGMENT, [...FIELD_UNIFORMS, 'uCellSize', 'uCells']);
      this.screen = link(gl, SCREEN_FRAGMENT, ['uCell', 'uCells', 'uPinv', 'uView', 'uPort', 'uInk0', 'uInk1']);
      this.cellTex = gl.createTexture();
      this.fbo = gl.createFramebuffer();
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
  }

  ensureCell(size) {
    const gl = this.gl;
    if (this.cellSize === size) return true;
    gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.cellTex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { this.mode = 'direct'; return false; }
    this.cellSize = size;
    return true;
  }

  setFieldUniforms(prog, frame, packed) {
    const gl = this.gl, g = frame.group;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTex);
    gl.uniform1i(prog.u.uData, 0);
    gl.uniform4i(prog.u.uCount, packed.counts[0], packed.counts[1], packed.counts[2], packed.counts[3]);
    gl.uniform1i(prog.u.uWaveStart, packed.waveStart);
    // GLSL packs a mat2 by columns
    gl.uniformMatrix2fv(prog.u.uP, false, [g.P[0][0], g.P[1][0], g.P[0][1], g.P[1][1]]);
    gl.uniformMatrix2fv(prog.u.uPinv, false, [g.Pinv[0][0], g.Pinv[1][0], g.Pinv[0][1], g.Pinv[1][1]]);
    gl.uniform2f(prog.u.uU, g.u[0], g.u[1]);
    gl.uniform4f(prog.u.uSafe, g.safe[0], g.safe[1], g.safe[2], g.safe[3]);
    gl.uniform2f(prog.u.uH, frame.hFlood, frame.hStamp);
  }

  /**
   * Draw a compiled frame.
   *   view     { cx, cy, upp }  Cartesian centre and units per device pixel
   *   port     [x, y, w, h]     where on the canvas, device pixels, y up
   *   quality  the cell texture's edge, texels (ignored when drawing direct)
   */
  render(frame, view, { port, quality = 512, palette = 'bw' } = {}) {
    const gl = this.gl;
    if (this.lost) return;
    const g = frame.group;
    const rect = port || [0, 0, this.canvas.width, this.canvas.height];
    const packed = packFrame(frame, this.data);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, DATA_W, DATA_H, gl.RGBA, gl.FLOAT, this.data);
    const inks = (PALETTES[palette] || PALETTES.bw).ink.map(hexToRgb);
    const cells = g.u[0] || g.u[1] ? 2 : 1;
    let prog;
    if (this.mode === 'cell' && this.ensureCell(quality)) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, quality, quality);
      gl.useProgram(this.cell.program);
      this.setFieldUniforms(this.cell, frame, packed);
      gl.uniform1f(this.cell.u.uCellSize, quality);
      gl.uniform1f(this.cell.u.uCells, cells);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      prog = this.screen;
      gl.useProgram(prog.program);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
      gl.uniform1i(prog.u.uCell, 1);
      gl.uniform1f(prog.u.uCells, cells);
      gl.uniformMatrix2fv(prog.u.uPinv, false, [g.Pinv[0][0], g.Pinv[1][0], g.Pinv[0][1], g.Pinv[1][1]]);
    } else {
      prog = this.direct;
      gl.useProgram(prog.program);
      this.setFieldUniforms(prog, frame, packed);
    }
    gl.viewport(rect[0], rect[1], rect[2], rect[3]);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect[0], rect[1], rect[2], rect[3]);
    gl.uniform4f(prog.u.uView, view.cx, view.cy, view.upp, 0);
    gl.uniform4f(prog.u.uPort, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform3f(prog.u.uInk0, inks[0][0], inks[0][1], inks[0][2]);
    gl.uniform3f(prog.u.uInk1, inks[1][0], inks[1][1], inks[1][2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
  }

  /** RGBA bytes of a rectangle of the canvas just drawn (tests, thumbnails). */
  read(x, y, w, h) {
    const gl = this.gl;
    const out = new Uint8Array(w * h * 4);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }
}

// keep the shader's shape table honest
if (SHAPES.length !== 12) throw new Error('studio-gl: the shader knows 12 shapes; SHAPES has changed');
