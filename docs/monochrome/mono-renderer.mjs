// One two-colour renderer for the whole Monochrome category: both lattices, any
// N, M and period, and any of the catalog's six rules.
//
// `../scott-gray/weave-monochrome/renderer.mjs` is the base and is kept verbatim
// in behaviour — `createView`, `createGovernor`, `shutterOffsets`/`shutterPhases`,
// `viewDelta`/`viewMotion`/`patternMotion`, `snapAngle`, `cubicWeights`,
// `halfSampleKernel`, `upsample2`, `frameAt`/`framesAt`, `bicubic`, both `field()`
// fetchers, the `draw()` body, the shutter gate and the governor. Five things
// that were constants there are arguments here:
//
//   1 · N, M, the loop and the frame count      — template substitutions, as in
//       `../colour/colour-renderer.mjs`; the program is rebuilt per entry anyway.
//   2 · the lattice — a `mat2 A_INV` emitted from the entry's own lattice, the
//       identity for the square one and [[1, −1/√3], [0, −2/√3]] for the
//       triangular one, which is the exact inverse of `toPlane` in
//       `colour-renderer.mjs`. So a hexagonal Monochrome page draws the same
//       geometry as Gyre and Trefoil, and `snapAngle` settles on a sixth of a
//       turn there and a quarter here.
//   3 · the rule — `ruleVolume()` builds w for a spatial involution
//       (an integer matrix and a whole-node translation), for the universal
//       half-period shift, or for the threshold control.
//   4 · two tones from a uniform pair, plus the `uRamp` path of
//       `colour-renderer.mjs`, so Appearance can show the ember field the rule
//       is reading.
//   5 · the framing — Weave's own `scaleFor` with its hard-coded 2 and 4
//       replaced by the entry's `tiles` and `2 × tiles`.
//
// Whatever the rule, it produces ONE R32F volume, so the fragment shader is the
// Weave shader unchanged: one `field()` fetch, `e = max(0.5*fwidth(w), 1e-7)`,
// `smoothstep(−e, e, w)`, and the colours — never the field — averaged over the
// shutter. That is the exactness argument the Weave README makes, and it
// survives verbatim.
//
// Nothing here knows about the catalog: the caller passes numbers.

export const LOOP_SECONDS = 8;        // One period per 8 s, as on every sibling page.
export const MIN_SCALE = 24;          // CSS pixels per lattice length; pages raise it to keep a texel per device pixel.
export const MAX_SCALE = 8000;
export const TAA_LAYERS = 3;
export const MAX_TAA_LAYERS = 5;
export const SHUTTER = 0.3;           // Of a frame interval, centred on the frame's own instant.
export const MOTION_PIXELS = 0.75;    // How wide the smear must be before the shutter is worth its cost.
export const SMEAR_PIXELS = 6;        // …and how far apart its sub-samples may drift before they read as copies.
export const BOUNDARY_SPEED = 0.45;   // Lattice lengths per period the black/white contour sweeps, unless the entry says.
export const FALLBACK_INTERVAL = 1000 / 60;
export const TILE_PIXELS = 380;       // CSS pixels per lattice length at the home framing, as on both shipped pages.
export const SQRT3 = Math.sqrt(3);
/** White and near-black: the two inks the catalog's own thumbnails are drawn in. */
export const INK = ['#ffffff', '#111111'];
/** How wide the drawn strand should be, in CSS pixels, when the catalog does not
 * carry a framing of its own — the builder's own target, inside the 20–60 band
 * the two shipped pages sit in (the Weave at 32, the Plume at 37). */
export const STRAND_PIXELS = 34;

export const wrap = value => value - Math.floor(value);
const mod = (value, n) => ((value % n) + n) % n;
const f = value => {
  const text = Number(value).toPrecision(17);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
};

// ---- the two lattices ------------------------------------------------------

/** Lattice coordinates (u, v) mean the point u·a1 + v·a2, and the screen runs x
 * right, y DOWN — the convention of every viewer in this repository and of the
 * catalog builder.
 *
 *   square       a1 = (1, 0)   a2 = (0, 1)
 *   triangular   a1 = (1, 0)   a2 = (−1/2, −√3/2)
 */
export const LATTICES = Object.freeze({
  square: {
    id: 'square',
    toPlane: ([u, v]) => [u, v],
    fromPlane: ([x, y]) => [x, y],
    /** Column-major, as GLSL's mat2 constructor takes it. */
    aInv: [1, 0, 0, 1],
    turnStep: Math.PI / 2,
    name: 'square',
  },
  triangular: {
    id: 'triangular',
    toPlane: ([u, v]) => [u - v / 2, -SQRT3 * v / 2],
    fromPlane: ([x, y]) => [x - y / SQRT3, -2 * y / SQRT3],
    aInv: [1, 0, -1 / SQRT3, -2 / SQRT3],
    turnStep: Math.PI / 3,
    name: 'triangular',
  },
});
export const latticeOf = name => LATTICES[name] ?? LATTICES.square;

// ---- the rules -------------------------------------------------------------

/** The six rule kinds the catalog emits, and what each one does to the field.
 * `motion` says whether the rule carries a spatial operation at all, which is
 * what the page's step-2 prose and the mark layer key off. */
export const RULE_KINDS = Object.freeze({
  'half-turn': {motion: true, note: 'w(x, t) = U(x, t) − U(2p − x, t)'},
  mirror: {motion: true, note: 'w(x, t) = U(x, t) − U(m x, t)'},
  glide: {motion: true, note: 'w(x, t) = U(x, t) − U(g x, t)'},
  'half-shift': {motion: true, note: 'w(x, t) = U(x, t) − U(x + h, t)'},
  'half-period': {motion: false, note: 'w(x, t) = U(x, t) − U(x, t + T/2)'},
  threshold: {motion: false, note: 'w(x, t) = U(x, t) − median U'},
});

/** One channel of the saved orbit as an x-fastest volume (x, y, frame).
 * `planar` is the site's one field layout: M frames of `channels` planar N×N
 * channels, x fastest. */
export function channelVolume(planar, N, M, channel = 0, channels = 2) {
  const count = N * N, out = new Float32Array(count * M);
  for (let k = 0; k < M; k++) {
    const at = (channels * k + channel) * count;
    out.set(planar.subarray(at, at + count), k * count);
  }
  return out;
}

/** The median of a channel volume, which is what the threshold rule subtracts.
 * The builder takes `numpy.median` of the whole chosen channel, so this is the
 * average of the two middle samples on an even count — not a nearest-rank
 * quantile, which would differ by a whole node band on a flat orbit. */
export function medianOf(values) {
  const sorted = Float64Array.from(values).sort();
  const n = sorted.length;
  if (!n) return 0;
  return n % 2 ? sorted[(n - 1) / 2] : 0.5 * (sorted[n / 2 - 1] + sorted[n / 2]);
}

/** w on the SAVED node grid, for one rule.
 *
 * Every spatial operation the catalog publishes is `x ↦ S x + v` with S an
 * integer matrix in lattice coordinates and v a whole number of nodes, so the
 * node grid is closed under it and the difference is exact integer indexing —
 * no interpolation enters. (The doubling below is therefore about the drawn
 * contour's reconstruction, not about closure: trigonometric interpolation
 * commutes with every lattice automorphism, so doubling w and differencing the
 * doubled field give the same samples.) */
export function nodeVolume(channel, {N, M, kind, S = [[1, 0], [0, 1]], v = [0, 0], median = null}) {
  const count = N * N, out = new Float32Array(count * M);
  if (kind === 'half-period') {
    if (M % 2) throw new Error('The half-period rule needs an even frame count.');
    const half = M / 2;
    for (let k = 0; k < M; k++) {
      const a = k * count, b = mod(k + half, M) * count;
      for (let i = 0; i < count; i++) out[a + i] = channel[a + i] - channel[b + i];
    }
    return out;
  }
  if (kind === 'threshold') {
    const level = median ?? medianOf(channel);
    for (let i = 0; i < out.length; i++) out[i] = channel[i] - level;
    return out;
  }
  // x ↦ S x + v, in node indices; the sampled node of (x, y) is
  // (S00 x + S01 y + v0, S10 x + S11 y + v1) mod N — the builder's `gather`.
  const map = new Int32Array(count);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const qx = mod(S[0][0] * x + S[0][1] * y + v[0], N);
      const qy = mod(S[1][0] * x + S[1][1] * y + v[1], N);
      map[y * N + x] = qy * N + qx;
    }
  }
  for (let k = 0; k < M; k++) {
    const base = k * count;
    for (let i = 0; i < count; i++) out[base + i] = channel[base + i] - channel[base + map[i]];
  }
  return out;
}

/** Half-sample Dirichlet kernel: the periodic band-limited interpolant of n even
 * samples evaluated midway between nodes. Verbatim from the Weave. */
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
 * values midway between them. Verbatim from the Weave. */
export function upsample2(source, n, kernel = halfSampleKernel(n), out = new Float32Array(4 * n * n), rows = new Float64Array(2 * n * n)) {
  const n2 = 2 * n;
  for (let y = 0; y < n; y++) {
    const row = y * n, target = y * n2;
    for (let x = 0; x < n; x++) {
      rows[target + 2 * x] = source[row + x];
      let sum = 0;
      for (let m = 0; m < n; m++) sum += kernel[m] * source[row + mod(x - m, n)];
      rows[target + 2 * x + 1] = sum;
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n2; x++) {
      out[2 * y * n2 + x] = rows[y * n2 + x];
      let sum = 0;
      for (let m = 0; m < n; m++) sum += kernel[m] * rows[mod(y - m, n) * n2 + x];
      out[(2 * y + 1) * n2 + x] = sum;
    }
  }
  return out;
}

/** The drawn volume: w for every saved frame on the spectrally doubled grid, as
 * one x-fastest (x, y, frame) array of 2N × 2N × M floats. */
export function ruleVolume(planar, {N, M, channels = 2, channel = 0, kind, S, v, median = null}) {
  if (!Number.isInteger(N) || N < 4 || !Number.isInteger(M) || M < 4) throw new Error('Invalid grid or frame count.');
  if (planar.length !== channels * N * N * M) throw new Error('The pattern data is incomplete. Please reload.');
  if (!RULE_KINDS[kind]) throw new Error(`Unknown rule ${kind}.`);
  const source = channelVolume(planar, N, M, channel, channels);
  const nodes = nodeVolume(source, {N, M, kind, S, v, median});
  const n2 = 2 * N, plane = n2 * n2, count = N * N;
  const kernel = halfSampleKernel(N);
  const out = new Float32Array(plane * M), scratch = new Float64Array(2 * count);
  const frame = new Float32Array(plane);
  for (let k = 0; k < M; k++) {
    upsample2(nodes.subarray(k * count, (k + 1) * count), N, kernel, frame, scratch);
    out.set(frame, k * plane);
  }
  return out;
}

/** One raw channel of the orbit on the same doubled grid, for the Appearance
 * selector: the wave itself, drawn through the ember ramp with the same camera
 * and the same shutter as the two-tone picture. */
export function channelDisplayVolume(planar, {N, M, channels = 2, channel = 0}) {
  const source = channelVolume(planar, N, M, channel, channels);
  const n2 = 2 * N, plane = n2 * n2, count = N * N;
  const kernel = halfSampleKernel(N);
  const out = new Float32Array(plane * M), scratch = new Float64Array(2 * count);
  const frame = new Float32Array(plane);
  for (let k = 0; k < M; k++) {
    upsample2(source.subarray(k * count, (k + 1) * count), N, kernel, frame, scratch);
    out.set(frame, k * plane);
  }
  return out;
}

/** The smallest and largest value of a volume — what the display range prints
 * and what the ember ramp is stretched over. */
export function rangeOf(values) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < values.length; i++) { const x = values[i]; if (x < lo) lo = x; if (x > hi) hi = x; }
  return Number.isFinite(lo) ? [lo, hi] : [0, 1];
}

// ---- the shader ------------------------------------------------------------

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = (layers, textureSize, aInv) => `
precision highp float;
precision highp int;
// Layer i of the array holds w at sub-sample i of the shutter. The view is per
// sub-sample too — uCenter[i], uScale[i], uRotation[i] — so a pan, a zoom, a
// turn and the animation are integrated by the same taps. With one layer they
// hold the frame's own view and the draw is identical to a viewer with no
// shutter at all.
uniform highp sampler2DArray uFrame;
uniform sampler2D uRamp;
uniform int uLayers;
uniform int uMode;        // 0 two tones, 1 the raw channel through a ramp
uniform float uLow, uSpan;
uniform vec2 uResolution;
uniform vec2 uCssSize;
uniform vec2 uCenter[${layers}];
uniform vec2 uRotation[${layers}]; // (cos, sin) of the screen-to-plane rotation
uniform float uScale[${layers}];
uniform vec3 uInk0;       // white: where w > 0
uniform vec3 uInk1;       // black: where w < 0
out vec4 color;
const float N = ${f(textureSize)};
// Plane (x right, y down) to lattice coordinates: the identity on the square
// lattice, and the exact inverse of a1 = (1, 0), a2 = (−1/2, −√3/2) on the
// triangular one.
const mat2 A_INV = mat2(${f(aInv[0])}, ${f(aInv[1])}, ${f(aInv[2])}, ${f(aInv[3])});
// Node i of the periodic lattice is texel i, centred at (i + 0.5) / N; the
// texture repeats, so no wrapping arithmetic is needed.
#ifdef TAPS9
float field(vec2 q, float layer) {
  // Catmull–Rom from nine bilinear fetches: the two positive inner weights of
  // each axis share one linearly filtered fetch (Sigg & Hadwiger).
  vec2 p = fract(q) * N;
  vec2 base = floor(p), fr = p - base, c = base + 0.5;
  vec2 w0 = fr * (-0.5 + fr * (1.0 - 0.5 * fr));
  vec2 w1 = 1.0 + fr * fr * (-2.5 + 1.5 * fr);
  vec2 w2 = fr * (0.5 + fr * (2.0 - 1.5 * fr));
  vec2 w3 = fr * fr * (-0.5 + 0.5 * fr);
  vec2 w12 = w1 + w2;
  vec2 t0 = (c - 1.0) / N, t12 = (c + w2 / w12) / N, t3 = (c + 2.0) / N;
  return (texture(uFrame, vec3(t0.x, t0.y, layer)).r * w0.x + texture(uFrame, vec3(t12.x, t0.y, layer)).r * w12.x + texture(uFrame, vec3(t3.x, t0.y, layer)).r * w3.x) * w0.y
       + (texture(uFrame, vec3(t0.x, t12.y, layer)).r * w0.x + texture(uFrame, vec3(t12.x, t12.y, layer)).r * w12.x + texture(uFrame, vec3(t3.x, t12.y, layer)).r * w3.x) * w12.y
       + (texture(uFrame, vec3(t0.x, t3.y, layer)).r * w0.x + texture(uFrame, vec3(t12.x, t3.y, layer)).r * w12.x + texture(uFrame, vec3(t3.x, t3.y, layer)).r * w3.x) * w3.y;
}
#else
vec4 cubicWeights(float t) {
  float t2 = t*t, t3 = t2*t;
  return vec4(-.5*t + t2 - .5*t3, 1.0 - 2.5*t2 + 1.5*t3,
              .5*t + 2.0*t2 - 1.5*t3, -.5*t2 + .5*t3);
}
float field(vec2 q, float layer) {
  // Catmull–Rom from sixteen point fetches.
  vec2 p = fract(q) * N;
  vec2 base = floor(p);
  vec4 wx = cubicWeights(p.x - base.x), wy = cubicWeights(p.y - base.y);
  float value = 0.0;
  for (int j = 0; j < 4; j++) {
    float row = 0.0;
    for (int i = 0; i < 4; i++) row += wx[i] * texture(uFrame, vec3((base + vec2(float(i) - 0.5, float(j) - 0.5)) / N, layer)).r;
    value += wy[j] * row;
  }
  return value;
}
#endif
// Where sub-sample i of the shutter reads: the screen point through that
// sub-sample's own view, in lattice coordinates.
vec2 latticeAt(vec2 screen, int i) {
  vec2 o = screen * uCssSize / uScale[i];
  vec2 p = vec2(uRotation[i].x * o.x - uRotation[i].y * o.y, uRotation[i].y * o.x + uRotation[i].x * o.y);
  return uCenter[i] + A_INV * p;
}
// The raw channel, for the Appearance selector: the same camera and the same
// shutter, through a one-dimensional ramp instead of the two inks. On a
// two-tone page it is the single most useful control there is — it shows the
// wave the rule is reading.
vec3 ramp(float value) {
  return texture(uRamp, vec2(clamp((value - uLow) / uSpan, 0.0, 1.0), 0.5)).rgb;
}
void main() {
  vec2 screen = gl_FragCoord.xy / uResolution - .5;
  screen.y = -screen.y; // Lattice y grows downward on screen, as on the source pages.
  float value = field(latticeAt(screen, 0), 0.0);
  if (uMode == 1) {
    vec3 sum = ramp(value);
    for (int i = 1; i < uLayers; i++) sum += ramp(field(latticeAt(screen, i), float(i)));
    color = vec4(sum / float(uLayers), 1.0);
    return;
  }
  // The edge softening is measured on the first sub-sample alone: screen-space
  // derivatives are only defined in uniform control flow, and over a shutter of
  // one frame interval the sub-samples differ by a fraction of a pixel of
  // gradient — which is the width this softening spans in the first place.
  float e = max(0.5 * fwidth(value), 1e-7);
  // Average the colours over the shutter, never the field: the field's average
  // still has one sharp contour, only displaced, while the colours' average
  // carries the contour across every pixel it swept — exactly as a camera
  // would record it. On a two-tone picture that is the whole of the
  // anti-aliasing there is.
  float sum = smoothstep(-e, e, value);
  for (int i = 1; i < uLayers; i++) sum += smoothstep(-e, e, field(latticeAt(screen, i), float(i)));
  float s = sum / float(uLayers);
  color = vec4(mix(uInk1, uInk0, s), 1.0);
}`;

// ---- the CPU twin ----------------------------------------------------------

/** Catmull–Rom weights for a fractional position t in [0, 1). */
export const cubicWeights = t => [-.5 * t + t * t - .5 * t * t * t, 1 - 2.5 * t * t + 1.5 * t * t * t, .5 * t + 2 * t * t - 1.5 * t * t * t, -.5 * t * t + .5 * t * t * t];

/** The field at one phase: periodic Catmull–Rom over the four nearest saved
 * frames, written into `out` (one textureSize² plane). */
export function frameAt(volume, textureSize, frames, phase, out = new Float32Array(textureSize * textureSize)) {
  const plane = textureSize * textureSize, t = wrap(phase) * frames, k = Math.floor(t);
  const [w0, w1, w2, w3] = cubicWeights(t - k);
  const a = mod(k - 1, frames) * plane, b = mod(k, frames) * plane;
  const c = mod(k + 1, frames) * plane, d = mod(k + 2, frames) * plane;
  for (let i = 0; i < plane; i++) out[i] = w0 * volume[a + i] + w1 * volume[b + i] + w2 * volume[c + i] + w3 * volume[d + i];
  return out;
}

/** The shutter's layers as one volume, layer after layer, ready for
 * texSubImage3D: layer j is `frameAt(volume, phases[j])`. */
export function framesAt(volume, textureSize, frames, phases, out) {
  const plane = textureSize * textureSize;
  for (const [j, phase] of phases.entries()) frameAt(volume, textureSize, frames, phase, out.subarray(j * plane, (j + 1) * plane));
  return out;
}

/** Periodic bicubic Catmull–Rom of one plane at lattice point (u, v) in units of
 * the lattice length: the CPU twin of the shader's `field`. */
export function bicubic(plane, textureSize, [u, v]) {
  const n = textureSize, px = wrap(u) * n, py = wrap(v) * n;
  const bx = Math.floor(px), by = Math.floor(py);
  const wx = cubicWeights(px - bx), wy = cubicWeights(py - by);
  let value = 0;
  for (let j = 0; j < 4; j++) {
    const row = mod(by + j - 1, n) * n;
    for (let i = 0; i < 4; i++) value += wx[i] * wy[j] * plane[row + mod(bx + i - 1, n)];
  }
  return value;
}

/** Where the `count` sub-samples of the shutter sit, as shares of a frame
 * interval either side of the frame's own instant: −shutter/2 … +shutter/2,
 * equally spaced and averaging to 0. */
export function shutterOffsets(count = 1, shutter = SHUTTER) {
  const n = Math.max(1, Math.round(count));
  return Array.from({length: n}, (_, j) => shutter * ((j + 0.5) / n - 0.5));
}

/** The phases of the `layers` shutter samples of a frame displayed at `phase`. */
export function shutterPhases(phase, layers = 1, displayMs = FALLBACK_INTERVAL, shutter = SHUTTER, loopSeconds = LOOP_SECONDS) {
  const frame = displayMs / (1000 * loopSeconds);
  return shutterOffsets(layers, shutter).map(offset => wrap(phase + offset * frame));
}

// ---- the camera ------------------------------------------------------------

/** The change from view `a` to view `b`: the lattice offset of the screen centre
 * (taken the shorter way round the periodic plane), the log of the zoom, and the
 * turn. */
export function viewDelta(a, b) {
  const du = b.center[0] - a.center[0], dv = b.center[1] - a.center[1];
  return {center: [du - Math.round(du), dv - Math.round(dv)], zoom: Math.log(b.scale / a.scale), angle: wrapAngle(b.angle - a.angle)};
}
export const NO_MOTION = {center: [0, 0], zoom: 0, angle: 0};

/** How far a step moves the picture on screen, in CSS pixels. The Weave took
 * `hypot` of the LATTICE offset, which is only right for an orthonormal basis;
 * the plane offset is what actually moves, and on the triangular lattice the two
 * differ by up to a factor of two. */
export function viewMotion(step, scale, width, height, lattice = LATTICES.square) {
  const [dx, dy] = lattice.toPlane(step.center);
  const radius = 0.5 * Math.hypot(width, height);
  return scale * Math.hypot(dx, dy) + radius * (Math.abs(step.angle) + Math.abs(step.zoom));
}

/** How far the pattern's own boundaries travel on screen in `ms`, at `scale`
 * CSS pixels per lattice length: the judder the shutter exists for. */
export const patternMotion = (scale, ms, loopSeconds = LOOP_SECONDS, speed = BOUNDARY_SPEED) =>
  scale * speed * ms / (1000 * loopSeconds);

/** Angles are kept in (−π, π]. */
export const wrapAngle = angle => { const a = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI)); return a <= -Math.PI ? a + 2 * Math.PI : a; };
/** Snaps an angle to the nearest allowed turn when within `tolerance` (4° by
 * default): a quarter on the square lattice, a sixth on the triangular one. */
export function snapAngle(angle, turnStep = Math.PI / 2, tolerance = Math.PI / 45) {
  const step = Math.round(angle / turnStep) * turnStep;
  return Math.abs(wrapAngle(angle - step)) <= tolerance ? wrapAngle(step) : angle;
}

/** How many lattice lengths across the shorter side read best for a picture
 * whose strand is `strandNodes` wide on an N-node grid. The catalog's own
 * `view.tiles` wins wherever it carries one; this is the fallback, and it is the
 * measurement §0.3 of the design asks for: the drawn strand should land in the
 * 20–60 CSS px band both shipped pages sit in. */
export function tilesFor({strandCells, strandNodes, N, box = TILE_PIXELS, target = STRAND_PIXELS, choices = [1, 2, 3, 4, 5, 6, 7, 8]} = {}) {
  const cells = Number.isFinite(strandCells) ? strandCells : (strandNodes > 0 && N > 0 ? strandNodes / N : 0);
  if (!(cells > 0)) return 2;
  let best = null;
  for (const tiles of choices) {
    const px = box / tiles * cells;
    const score = Math.abs(Math.log(px / target));
    if (!best || score < best.score) best = {tiles, score};
  }
  return best.tiles;
}

/** The home framing: Weave's own `scaleFor` with its hard-coded 2 and 4 replaced
 * by `tiles` and `2 × tiles`. The home view holds `tiles` lattice lengths across
 * the shorter side while that side is at most `tiles × TILE_PIXELS`, keeps
 * TILE_PIXELS per length beyond it, and never lets the picture get finer than
 * `2 × tiles` lengths across — the 4K cap the Weave learned the hard way. */
export const scaleFor = (tiles = 2, tilePixels = TILE_PIXELS) => (width, height) => {
  const shorter = Math.min(width, height);
  return Math.min(Math.max(tilePixels, shorter / (2 * tiles)), shorter / tiles);
};

/** The viewport: which lattice point sits at the screen centre, how many CSS
 * pixels one lattice length spans, and how far the pattern is turned on screen
 * (radians, clockwise positive since screen y runs down). Verbatim from the
 * standalone viewers, with the screen-to-lattice map taken from the lattice
 * rather than assumed square, and `fix()` from `../colour/colour-renderer.mjs`. */
export function createView({tilePixels = scaleFor(2), center = [0, 0], angle = 0, minScale = MIN_SCALE, maxScale = MAX_SCALE, overshoot = 1, lattice = LATTICES.square} = {}) {
  if (!(minScale > 0 && maxScale >= minScale)) throw new Error('The zoom limits must be positive and ordered.');
  if (!Number.isFinite(angle)) throw new Error('The angle must be finite.');
  if (!(overshoot >= 1)) throw new Error('The elastic overshoot must be at least 1.');
  const fallback = typeof tilePixels === 'function' ? tilePixels : () => tilePixels;
  // Every hand-made change to the zoom stops dead at a limit. Only a glide may
  // pass one — by `overshoot`, for the moment it takes to spring back.
  const clamp = (scale, elastic = false) => elastic
    ? Math.min(maxScale * overshoot, Math.max(minScale / overshoot, scale))
    : Math.min(maxScale, Math.max(minScale, scale));
  const initialScale = typeof tilePixels === 'number' ? clamp(tilePixels) : null;
  const home = [wrap(center[0]), wrap(center[1])], homeAngle = wrapAngle(angle);
  let userScale = initialScale, turn = homeAngle;
  const current = [...home];
  const toLattice = (dx, dy, s) => {
    const c = Math.cos(turn), n = Math.sin(turn);
    return lattice.fromPlane([(c * dx + n * dy) / s, (-n * dx + c * dy) / s]);
  };
  const view = {
    lattice,
    get center() { return [...current]; },
    get angle() { return turn; },
    get minScale() { return minScale; },
    get maxScale() { return maxScale; },
    get overshoot() { return overshoot; },
    get home() { return [...home]; },
    get zoomed() { return userScale !== initialScale; },
    scale(width, height) { return userScale ?? clamp(fallback(width, height)); },
    isHome() { return userScale === initialScale && turn === homeAngle && current[0] === home[0] && current[1] === home[1]; },
    reset() { userScale = initialScale; turn = homeAngle; current[0] = home[0]; current[1] = home[1]; },
    latticeAt([x, y], width, height) {
      const [dx, dy] = toLattice(x - width / 2, y - height / 2, view.scale(width, height));
      return [current[0] + dx, current[1] + dy];
    },
    pin(lattice2, [x, y], width, height, {scale, angle: nextAngle, elastic = false} = {}) {
      if (scale !== undefined) userScale = clamp(scale, elastic);
      if (nextAngle !== undefined) turn = wrapAngle(nextAngle);
      const [dx, dy] = toLattice(x - width / 2, y - height / 2, view.scale(width, height));
      current[0] = wrap(lattice2[0] - dx);
      current[1] = wrap(lattice2[1] - dy);
    },
    panBy(dx, dy, width, height) {
      const [lx, ly] = toLattice(dx, dy, view.scale(width, height));
      current[0] = wrap(current[0] - lx);
      current[1] = wrap(current[1] - ly);
    },
    zoomAt(factor, point, width, height, {elastic = false} = {}) {
      view.pin(view.latticeAt(point, width, height), point, width, height, {scale: view.scale(width, height) * factor, elastic});
    },
    rotateAt(delta, point, width, height) {
      view.pin(view.latticeAt(point, width, height), point, width, height, {angle: turn + delta});
    },
    /** The fixed "simulation width" frame: the entry's home centre, no turn, and
     * exactly `tiles` lattice lengths across the shorter side of the canvas. */
    fix(tiles, width, height) {
      userScale = clamp(Math.min(width, height) / Math.max(1, tiles));
      turn = 0; current[0] = home[0]; current[1] = home[1];
    },
    snapshot() { return {center: [...current], scale: userScale, angle: turn}; },
    restore({center: [x, y], scale, angle: nextAngle = 0}) {
      current[0] = wrap(x); current[1] = wrap(y);
      userScale = scale === null || scale === undefined ? null : clamp(scale);
      turn = wrapAngle(nextAngle);
    },
  };
  return view;
}

/** Keeps continuous playback at the display's cadence by giving up, in order,
 * the shutter and then render resolution. Verbatim from the standalone viewers:
 * the shutter is a rung of its own above the resolution ladder, nothing found to
 * be late is offered again straight away, and the shutter comes back only at
 * full resolution after two clean windows. */
export function createGovernor({enabled = true, step = 0.85, floor = 0.5, window = 45, display = null} = {}) {
  let quality = 1, last = null, changed = 0, probe = null, ceiling = 1, ceilingUntil = 0, blockedUntil = 0, wanted = false, lastRequest = -Infinity;
  let shutter = true, shutterWait = 20000, shutterUntil = 0, shutterSince = -Infinity, clean = 0;
  if (display !== null && !(display >= 4 && display <= 200)) display = null;
  const deltas = [];
  const revert = now => { quality = probe.quality; probe = null; blockedUntil = now + 4000; changed = now; };
  return {
    get quality() { return quality; },
    get display() { return display; },
    get enabled() { return enabled; },
    get shutter() { return shutter; },
    probeSoon(now) { if (enabled && now - lastRequest >= 30000) { wanted = true; lastRequest = now; } },
    tick(now, continuous, shuttered = false) {
      if (!enabled) return;
      if (!continuous) { if (probe) revert(now); last = null; deltas.length = 0; return; }
      if (last !== null) { const dt = now - last; if (dt > 2 && dt < 200) deltas.push(dt); }
      last = now;
      if (deltas.length < window) return;
      const sorted = deltas.slice().sort((a, b) => a - b);
      const fast = sorted[Math.floor(sorted.length * 0.2)];
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      deltas.length = 0;
      display = Math.max(4, display === null ? fast : Math.min(display, fast));
      if (probe) {
        if (mean < 0.85 * probe.mean) { probe = null; }
        else if (probe.steps < 2 && quality > floor) { quality = Math.max(floor, quality * step); probe.steps++; changed = now; return; }
        else { display = Math.max(display, mean); revert(now); return; }
      }
      const late = mean > 1.35 * display;
      clean = late || mean > 1.1 * display ? 0 : clean + 1;
      if (late && shutter && shuttered) {
        shutter = false;
        shutterWait = now - shutterSince > 60000 ? 20000 : Math.min(600000, shutterWait * 2);
        shutterUntil = now + shutterWait; clean = 0; changed = now;
        return;
      }
      if ((late || wanted) && quality > floor && now >= blockedUntil) {
        wanted = false;
        if (late) { ceiling = quality * step; ceilingUntil = now + 20000; }
        probe = {quality, mean, steps: 1};
        quality = Math.max(floor, quality * step); changed = now;
      } else if (!late && quality < 1 && now - changed > 2500 && mean <= 1.1 * display) {
        wanted = false;
        const next = Math.min(1, quality / step);
        if (next <= ceiling || now > ceilingUntil) { quality = next; changed = now; }
      } else wanted = false;
      if (!shutter && !probe && quality >= 1 && clean >= 2 && now >= shutterUntil) { shutter = true; shutterSince = now; clean = 0; }
    },
  };
}

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

/** The field ramps of `../scott-gray/render.mjs`, as a 256-entry lookup. */
const RAMPS = {
  ember: [[0, 18, 9, 39], [.22, 65, 12, 94], [.43, 99, 25, 116], [.58, 171, 45, 90], [.69, 240, 111, 32], [.78, 252, 181, 42], [.89, 253, 219, 94], [1, 252, 242, 158]],
  concentration: [[0, 18, 18, 24], [1, 245, 245, 251]],
};
export function rampBytes(name) {
  const stops = RAMPS[name] ?? RAMPS.ember, out = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let j = 1;
    while (j < stops.length - 1 && stops[j][0] < v) j++;
    const a = stops[j - 1], b = stops[j], t = (v - a[0]) / (b[0] - a[0]);
    for (let k = 0; k < 3; k++) out[4 * i + k] = Math.round(a[k + 1] + (b[k + 1] - a[k + 1]) * t);
    out[4 * i + 3] = 255;
  }
  return out;
}

/** A WebGL 2 two-colour renderer for one catalog picture on `canvas`.
 *
 * `volume` is `ruleVolume()`'s output — 2N × 2N × M floats of w. Everything else
 * matches the standalone viewers' options: `pixelRatio` pins the device pixel
 * ratio and turns adaptive resolution off, `taa` is the shutter's sub-samples
 * per displayed frame, `shutter` its share of a frame interval, `motion` how far
 * the picture must move before the shutter is worth its cost. */
export function createMonoRenderer(canvas, source, {
  N, M, view, loopSeconds = LOOP_SECONDS, ink = INK, mode = 'mono', range = null, rampName = 'ember',
  boundarySpeed = BOUNDARY_SPEED, pixelRatio = null, adaptive = true, display = null,
  taa = TAA_LAYERS, shutter = SHUTTER, motion = MOTION_PIXELS,
} = {}) {
  const textureSize = 2 * N, plane = textureSize * textureSize;
  let volume = source;
  if (!Number.isInteger(N) || N < 4 || !Number.isInteger(M) || M < 4) throw new Error('Invalid grid or frame count.');
  if (volume.length !== plane * M) throw new Error('The drawn volume does not match the grid.');
  if (!(Array.isArray(ink) && ink.length === 2 && ink.every(c => /^#[0-9a-f]{6}$/i.test(c)))) throw new Error('The two inks must be hex colours.');
  if (pixelRatio !== null && !(pixelRatio > 0 && Number.isFinite(pixelRatio))) throw new Error('The pixel ratio must be a positive number.');
  const maxLayers = Math.min(MAX_TAA_LAYERS, Math.max(1, Math.round(Number(taa) || 1)));
  if (!(shutter >= 0 && shutter <= 2)) throw new Error('The shutter must be between 0 and 2 frame intervals.');
  if (!(motion >= 0 && Number.isFinite(motion))) throw new Error('The motion threshold must be a finite number of pixels.');
  const lattice = view?.lattice ?? LATTICES.square;
  const gl = canvas.getContext('webgl2', {alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance'});
  if (!gl) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or open this page in a recent browser.');
  const linear = !!gl.getExtension('OES_texture_float_linear');
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
  const shaders = [
    compile(gl.VERTEX_SHADER, vertex),
    compile(gl.FRAGMENT_SHADER, `#version 300 es\n${linear ? '#define TAPS9\n' : ''}${fragment(maxLayers, textureSize, lattice.aInv)}`),
  ];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not start the WebGL renderer.');
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.useProgram(program);
  const frame = new Float32Array(plane * maxLayers);
  // Two textures alternate so an upload never waits for the previous draw.
  const textures = [0, 1].map(() => {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R32F, textureSize, textureSize, maxLayers, 0, gl.RED, gl.FLOAT,
      framesAt(volume, textureSize, M, shutterPhases(0, maxLayers, FALLBACK_INTERVAL, shutter, loopSeconds), frame));
    return texture;
  });
  const rampTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rampTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rampBytes(rampName));
  gl.activeTexture(gl.TEXTURE0);
  if (gl.getError() !== gl.NO_ERROR) throw new Error('The GPU rejected the pattern texture.');
  let textureIndex = 0, lastPhase = null, lastLayers = 0, lastMoving = null, layers = 1;
  let lastView = null, lastDrawTime = null, travel = 0, lastSize = null, dirty = false;
  const centers = new Float32Array(2 * maxLayers), rotations = new Float32Array(2 * maxLayers), scales = new Float32Array(maxLayers);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.uniform1i(gl.getUniformLocation(program, 'uFrame'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uRamp'), 1);
  const layerLocation = gl.getUniformLocation(program, 'uLayers');
  const modeLocation = gl.getUniformLocation(program, 'uMode');
  const lowLocation = gl.getUniformLocation(program, 'uLow');
  const spanLocation = gl.getUniformLocation(program, 'uSpan');
  gl.uniform1i(layerLocation, 1);
  gl.uniform3fv(gl.getUniformLocation(program, 'uInk0'), rgb(ink[0]));
  gl.uniform3fv(gl.getUniformLocation(program, 'uInk1'), rgb(ink[1]));
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const cssSize = gl.getUniformLocation(program, 'uCssSize');
  const centerLocation = gl.getUniformLocation(program, 'uCenter[0]');
  const rotationLocation = gl.getUniformLocation(program, 'uRotation[0]');
  const scaleLocation = gl.getUniformLocation(program, 'uScale[0]');
  const maxSize = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
  const governor = createGovernor({enabled: adaptive && pixelRatio === null, display});
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  const applyMode = () => {
    const low = range ? range[0] : 0, span = range ? Math.max(1e-9, range[1] - range[0]) : 1;
    gl.uniform1i(modeLocation, mode === 'mono' ? 0 : 1);
    gl.uniform1f(lowLocation, low); gl.uniform1f(spanLocation, span);
  };
  applyMode();

  return {
    view, ink, config: {N, M, textureSize, loopSeconds},
    /** Texture fetches per pixel in the last draw, the shutter included. */
    get taps() { return (linear ? 9 : 16) * layers; },
    get quality() { return governor.quality; },
    get display() { return governor.display; },
    get layers() { return layers; },
    get maxLayers() { return maxLayers; },
    get shutter() { return shutter; },
    get motionThreshold() { return motion; },
    get travel() { return travel; },
    get backend() { return linear ? 'WebGL playback' : 'WebGL playback (point taps)'; },
    /** Switches between the two inks and a raw channel through a ramp.
     *
     * `nextVolume` is what the ramp draws: pass the picture's own w to see the
     * difference field, or a channel of the orbit — upsampled to the same
     * 2N × 2N × M shape — to see the wave the rule is reading, which on a
     * two-tone page is the single most useful control there is. Passing nothing
     * keeps whatever is uploaded. */
    setAppearance(nextMode, nextRange, nextRamp = 'ember', nextVolume = null) {
      if (nextVolume) {
        if (nextVolume.length !== plane * M) throw new Error('The appearance volume does not match the grid.');
        volume = nextVolume;
      }
      mode = nextMode; range = nextRange;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rampTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rampBytes(nextRamp));
      gl.activeTexture(gl.TEXTURE0);
      applyMode(); dirty = true;
    },
    /** Call when a touch begins: the governor then tries a lower resolution
     * once, in case the display sped up. */
    touched() { governor.probeSoon(performance.now()); },
    draw(phase, {continuous = false, moving = continuous, time = null} = {}) {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!(width > 0 && height > 0)) return;
      const now = time ?? performance.now();
      governor.tick(now, continuous, lastLayers > 1);
      const ratio = Math.min((pixelRatio ?? devicePixelRatio ?? 1) * governor.quality, maxSize / width, maxSize / height, Math.sqrt(33554432 / (width * height)));
      const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      const scale = view.scale(width, height), [cx, cy] = view.center, angle = view.angle;
      const here = {center: [cx, cy], scale, angle};
      const gap = lastDrawTime === null ? 0 : now - lastDrawTime;
      const paced = gap > 2 && gap < 250;
      const interval = paced ? gap : governor.display ?? FALLBACK_INTERVAL;
      // A canvas that changed size is a relayout, not a motion: the framing
      // follows the shorter side, so a resize, a rotated phone or an offline
      // exporter moves the picture a long way in one draw with nothing having
      // travelled, and a smear across that step is a blurred frame with no
      // motion behind it.
      const resized = lastSize === null || lastSize[0] !== width || lastSize[1] !== height;
      lastSize = [width, height];
      let step = paced && lastView && !resized ? viewDelta(lastView, here) : NO_MOTION;
      let viewPixels = viewMotion(step, scale, width, height, lattice);
      const patternPixels = moving ? patternMotion(scale, interval, loopSeconds, boundarySpeed) : 0;
      // A jump — a reset, a new framing, a tab coming back — is not a motion.
      if (viewPixels > 0.25 * Math.min(width, height)) { step = NO_MOTION; viewPixels = 0; }
      // Nor may the view's smear outrun the sub-samples that have to draw it.
      const room = SMEAR_PIXELS * maxLayers;
      if (viewPixels * shutter > room) {
        const keep = room / (viewPixels * shutter);
        step = {center: [step.center[0] * keep, step.center[1] * keep], zoom: step.zoom * keep, angle: step.angle * keep};
      }
      travel = viewPixels + patternPixels;
      lastView = here; lastDrawTime = now;
      layers = maxLayers > 1 && shutter > 0 && governor.shutter && travel > 0 && travel * shutter >= motion ? maxLayers : 1;
      const p = wrap(phase);
      if (dirty || p !== lastPhase || layers !== lastLayers || moving !== lastMoving) {
        textureIndex ^= 1; gl.bindTexture(gl.TEXTURE_2D_ARRAY, textures[textureIndex]);
        const phases = moving ? shutterPhases(p, layers, interval, shutter, loopSeconds) : new Array(layers).fill(p);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, textureSize, textureSize, layers, gl.RED, gl.FLOAT, framesAt(volume, textureSize, M, phases, frame));
        if (layers !== lastLayers) gl.uniform1i(layerLocation, layers);
        lastPhase = p; lastLayers = layers; lastMoving = moving; dirty = false;
      }
      for (const [j, offset] of shutterOffsets(layers, shutter).entries()) {
        centers[2 * j] = cx + step.center[0] * offset;
        centers[2 * j + 1] = cy + step.center[1] * offset;
        scales[j] = scale * Math.exp(step.zoom * offset);
        const turn = angle + step.angle * offset;
        rotations[2 * j] = Math.cos(turn); rotations[2 * j + 1] = -Math.sin(turn); // screen-to-lattice turns the other way
      }
      gl.uniform2f(resolution, w, h); gl.uniform2f(cssSize, width, height);
      gl.uniform2fv(centerLocation, centers.subarray(0, 2 * layers));
      gl.uniform1fv(scaleLocation, scales.subarray(0, layers));
      gl.uniform2fv(rotationLocation, rotations.subarray(0, 2 * layers));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() { for (const texture of textures) gl.deleteTexture(texture); gl.deleteTexture(rampTexture); gl.deleteProgram(program); gl.deleteVertexArray(vao); },
  };
}
