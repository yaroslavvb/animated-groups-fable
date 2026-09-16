// The saved orbit wallpaper:g6:731aa45654d4d690 is a Gray–Scott rotating wave:
// 128 frames of a 48×48 periodic lattice over one period. Every frame is
// spectrally (Dirichlet-kernel) upsampled to 96×96 on load, then the GPU
// reconstructs each device pixel with periodic Catmull–Rom interpolation in
// x, y and time. Against the exact band-limited reconstruction of the saved
// samples this differs by under 0.4 of one 8-bit colour level; the original
// page's bilinear playback differs by up to 9 levels.
export const INITIAL_PHASE = 0;
export const LOOP_SECONDS = 8; // The source's speed=1: one period per 8 s.
// Source desktop canvas: 760 CSS pixels across 2 simulation lattice lengths
// (framing=simulation&tiles=2). This scale is kept through resizing and
// fullscreen; larger screens reveal more repeats. Screens narrower than the
// source canvas keep two repeats across their shorter side instead.
export const TILE_PIXELS = 760 / 2;
export const scaleFor = (width, height) => Math.min(TILE_PIXELS, Math.min(width, height) / 2);
export const CENTER = [1, 1]; // Lattice coordinates at the screen centre (tiles/2).
export const GRID_SIZE = 48;
export const FRAMES = 128;
export const UPSAMPLE = 2;
export const TEXTURE_SIZE = GRID_SIZE * UPSAMPLE;
export const FIELD_BYTES = FRAMES * 2 * GRID_SIZE * GRID_SIZE * 4;
// record.ranges.u of the saved orbit: the same normalisation as the source page.
export const VALUE_RANGE = [0.059269435703754425, 0.3834811747074127];
// Plume shows U with the ember palette. Plume Monochrome shows the sign of
// w(x,t) = U(x,t) − U(−x,t), the part of U that the half-turn reverses: white
// where U exceeds its half-turn image, black where it falls short. Because the
// orbit satisfies U(−x,t) = U(x,t+T/2) and U(Rx,t+T/4) = U(x,t) for the
// quarter-turn R, the monochrome animation is exactly reproduced by a quarter
// turn with a quarter-period shift, and exactly colour-reversed by a half
// turn, by a half-period shift, or by a quarter turn with a three-quarter
// period shift.
export const STYLES = ['ember', 'monochrome'];

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
uniform highp sampler3D uField;
uniform vec2 uResolution;
uniform vec2 uCssSize;
uniform vec2 uCenter;
uniform float uTilePixels;
uniform float uPhase;
uniform vec2 uValueRange;
uniform int uStyle;
out vec4 color;
const int N = ${TEXTURE_SIZE};
const int M = ${FRAMES};
float node(ivec2 p, int k) {
  return texelFetch(uField, ivec3(((p % N) + N) % N, ((k % M) + M) % M), 0).r;
}
vec4 cubicWeights(float t) {
  float t2 = t*t, t3 = t2*t;
  return vec4(-.5*t + t2 - .5*t3, 1.0 - 2.5*t2 + 1.5*t3,
              .5*t + 2.0*t2 - 1.5*t3, -.5*t2 + .5*t3);
}
float field(vec2 q, float phase) {
  // Periodic Catmull–Rom reconstruction in space and time, across repeat
  // boundaries and across the end of the period.
  vec2 p = fract(q) * float(N);
  float t = fract(phase) * float(M);
  ivec2 base = ivec2(floor(p));
  int frame = int(floor(t));
  vec4 wx = cubicWeights(fract(p.x)), wy = cubicWeights(fract(p.y)), wt = cubicWeights(fract(t));
  float value = 0.0;
  for (int k = 0; k < 4; k++) {
    float plane = 0.0;
    for (int j = 0; j < 4; j++) {
      float row = 0.0;
      for (int i = 0; i < 4; i++) row += wx[i] * node(base + ivec2(i-1, j-1), frame + k - 1);
      plane += wy[j] * row;
    }
    value += wt[k] * plane;
  }
  return value;
}
vec3 ember(float t) {
  // Continuous interpolation of the source's exact ember colour stops.
  if (t < .22) return mix(vec3(18,9,39),vec3(65,12,94),t/.22);
  if (t < .43) return mix(vec3(65,12,94),vec3(99,25,116),(t-.22)/.21);
  if (t < .58) return mix(vec3(99,25,116),vec3(171,45,90),(t-.43)/.15);
  if (t < .69) return mix(vec3(171,45,90),vec3(240,111,32),(t-.58)/.11);
  if (t < .78) return mix(vec3(240,111,32),vec3(252,181,42),(t-.69)/.09);
  if (t < .89) return mix(vec3(252,181,42),vec3(253,219,94),(t-.78)/.11);
  return mix(vec3(253,219,94),vec3(252,242,158),(t-.89)/.11);
}
void main() {
  vec2 screen = gl_FragCoord.xy / uResolution - .5;
  screen.y = -screen.y; // Lattice y grows downward on screen, as on the source page.
  vec2 q = uCenter + screen * uCssSize / uTilePixels;
  float value = field(q, uPhase);
  if (uStyle == 1) {
    // Black and white only, with the zero contour anti-aliased over one pixel.
    float edge = max(0.5 * fwidth(value), 1e-7);
    color = vec4(vec3(smoothstep(-edge, edge, value)), 1.0);
    return;
  }
  float t = clamp((value - uValueRange.x) / uValueRange.y, 0.0, 1.0);
  // Sub-byte, stationary dither reduces banding without animation noise.
  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056,.00583715)))) - .5;
  color = vec4((ember(t) + dither) / 255.0, 1.0);
}`;

/** Half-sample Dirichlet kernel: the periodic band-limited interpolant of N
 * even samples evaluated midway between nodes. The Nyquist bin contributes
 * cos(π(m+½)) = 0 there, so its usual half/half split is exact. */
export function halfSampleKernel(n) {
  const kernel = new Float64Array(n);
  for (let m = 0; m < n; m++) {
    const theta = Math.PI * (m + .5) / n;
    kernel[m] = Math.sin((n - 1) * theta) / (n * Math.sin(theta));
  }
  return kernel;
}

/** Doubles a periodic n×n grid (row-major, x fastest) by exact trigonometric
 * interpolation. Existing samples are kept; new samples are the band-limited
 * values midway between them. */
export function upsample2(source, n, kernel = halfSampleKernel(n)) {
  const n2 = 2 * n, rows = new Float64Array(n * n2), out = new Float32Array(n2 * n2);
  for (let y = 0; y < n; y++) {
    const row = y * n, target = y * n2;
    for (let x = 0; x < n; x++) {
      rows[target + 2*x] = source[row + x];
      let sum = 0;
      for (let m = 0; m < n; m++) sum += kernel[m] * source[row + (((x - m) % n) + n) % n];
      rows[target + 2*x + 1] = sum;
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n2; x++) {
      out[2*y*n2 + x] = rows[y*n2 + x];
      let sum = 0;
      for (let m = 0; m < n; m++) sum += kernel[m] * rows[((((y - m) % n) + n) % n) * n2 + x];
      out[(2*y + 1)*n2 + x] = sum;
    }
  }
  return out;
}

/** The U channel of every saved frame, spectrally doubled, as one x-fastest
 * volume (x, y, frame) ready for a 3D texture. For the monochrome style the
 * volume holds U(x,t) − U(−x,t) instead; the doubled grid is closed under the
 * half-turn, and trigonometric interpolation commutes with it. */
export function upsampledVolume(planar, style = 'ember') {
  if (!STYLES.includes(style)) throw new Error(`Unknown style: ${style}`);
  const count = GRID_SIZE * GRID_SIZE, plane = TEXTURE_SIZE * TEXTURE_SIZE, n = TEXTURE_SIZE;
  const kernel = halfSampleKernel(GRID_SIZE), volume = new Float32Array(plane * FRAMES);
  for (let k = 0; k < FRAMES; k++) {
    const frame = upsample2(planar.subarray(k * 2 * count, k * 2 * count + count), GRID_SIZE, kernel);
    if (style === 'monochrome') {
      const turned = new Float32Array(plane);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) turned[y * n + x] = frame[y * n + x] - frame[((n - y) % n) * n + (n - x) % n];
      volume.set(turned, k * plane);
    } else volume.set(frame, k * plane);
  }
  return volume;
}

/** `tilePixels` is CSS pixels per lattice length: a number, or a function of
 * the canvas CSS width and height evaluated on every draw. */
export function createRenderer(canvas, planar, {tilePixels = scaleFor, center = CENTER, style = 'ember'} = {}) {
  if (!STYLES.includes(style)) throw new Error(`Unknown style: ${style}`);
  if (planar.length !== FIELD_BYTES / 4 || !planar.every(Number.isFinite)) {
    throw new Error('The pattern data is incomplete. Please reload.');
  }
  const scale = typeof tilePixels === 'function' ? tilePixels : () => tilePixels;
  if (!(scale(1000, 1000) > 0) || !Number.isFinite(scale(1000, 1000))) throw new Error('The scale must be a positive number of pixels per lattice length.');
  const gl = canvas.getContext('webgl2', {alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance'});
  if (!gl) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or open this page in a recent browser.');
  if (gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) < Math.max(TEXTURE_SIZE, FRAMES)) throw new Error('This GPU cannot hold the animation volume.');
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
      throw new Error(`Could not start the animation: ${message}`);
    }
    return shader;
  }
  const program = gl.createProgram();
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not start the WebGL renderer.');
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.useProgram(program);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R32F, TEXTURE_SIZE, TEXTURE_SIZE, FRAMES, 0, gl.RED, gl.FLOAT, upsampledVolume(planar, style));
  if (gl.getError() !== gl.NO_ERROR) throw new Error('The GPU rejected the animation volume.');
  gl.uniform1i(gl.getUniformLocation(program, 'uField'), 0);
  gl.uniform2f(gl.getUniformLocation(program, 'uCenter'), center[0], center[1]);
  gl.uniform2f(gl.getUniformLocation(program, 'uValueRange'), VALUE_RANGE[0], VALUE_RANGE[1] - VALUE_RANGE[0]);
  gl.uniform1i(gl.getUniformLocation(program, 'uStyle'), STYLES.indexOf(style));
  const tileLocation = gl.getUniformLocation(program, 'uTilePixels');
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const cssSize = gl.getUniformLocation(program, 'uCssSize');
  const phaseLocation = gl.getUniformLocation(program, 'uPhase');
  const maxSize = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  return {
    style,
    draw(phase) {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      gl.uniform1f(tileLocation, scale(width, height));
      // Native device pixels, with hardware limits and a 32-megapixel ceiling.
      const ratio = Math.min(devicePixelRatio || 1, maxSize / width, maxSize / height, Math.sqrt(33554432 / (width * height)));
      const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(resolution, w, h); gl.uniform2f(cssSize, width, height);
      gl.uniform1f(phaseLocation, ((phase % 1) + 1) % 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() { gl.deleteTexture(texture); gl.deleteProgram(program); gl.deleteVertexArray(vao); },
  };
}
