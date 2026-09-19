// The Colour category's renderer: `../scott-gray/gyre/renderer.mjs` and
// `../scott-gray/trefoil/renderer.mjs` folded into one, with N, M, the period,
// the home framing and the *colouring* made arguments.
//
// The two originals are about ninety per cent the same file. Everything that is
// shared is kept here verbatim in behaviour — `createView`, `createGovernor`,
// `shutterOffsets`/`shutterPhases`, `viewDelta`/`viewMotion`/`patternMotion`,
// `snapAngle`, `cubicWeights`, `uVolume`, the vertex shader, the two `field()`
// fetchers (nine bilinear taps with OES_texture_float_linear, sixteen point
// taps without), `paint()`, `latticeAt()` and the whole `draw()` body, shutter
// gate and all. What differs between the two pages is isolated in a **colouring
// descriptor**:
//
//   * the texture layout           — RGBA32F with three phase channels (Gyre)
//                                    or R32F with one (Trefoil);
//   * the GLSL body of `weights()` — where the three compared samples are read;
//   * the CPU twin `frameAt`/`valuesAt` — the same thing in JavaScript, which
//     the tests render with and compare against the GPU.
//
// `const float N`, the offset constants and the `field()` return type are
// template substitutions, so the program is rebuilt per entry — which it must
// be anyway, since N differs from entry to entry.
//
// Nothing here knows about the catalog: the caller passes numbers.

export const LOOP_SECONDS = 8;        // One period per 8 s, as on every sibling page.
export const MOTIF_PIXELS = 380;      // The apparent size of one motif at the home framing.
export const MIN_SCALE = 24;          // CSS pixels per lattice length; pages raise it to keep a texel per device pixel.
export const MAX_SCALE = 8000;
export const TAA_LAYERS = 3;          // Up to 81 texture taps per pixel.
export const MAX_TAA_LAYERS = 5;
export const SHUTTER = 0.3;           // Of a frame interval, centred on the frame's own instant.
export const MOTION_PIXELS = 0.75;    // How wide the smear must be before the shutter is worth its cost.
export const SMEAR_PIXELS = 6;        // …and how far apart its sub-samples may drift before they read as copies.
export const BOUNDARY_SPEED = 0.43;   // Lattice lengths per period the colour boundaries sweep.
export const FALLBACK_INTERVAL = 1000 / 60;
export const SQRT3 = Math.sqrt(3);
/** Terracotta, teal, sand. Every pair stays at least 24 CIELAB units apart in
 * normal vision and in simulated protanopia, deuteranopia and tritanopia, and
 * the three carry comparable weight: the symmetry gives each a third of the
 * plane, so no colour may read as the background of the others. */
export const PALETTE = ['#c9563e', '#57979a', '#e2be68'];

export const wrap = value => value - Math.floor(value);
const mod = (value, n) => ((value % n) + n) % n;
const f = value => {
  const text = Number(value).toPrecision(17);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
};

/** Lattice basis of the triangular lattice, in plane coordinates (x right, y
 * down on screen, so physical y points up): a1 = (1, 0), a2 = (−1/2, −√3/2). */
export const toPlane = ([u, v]) => [u - v / 2, -SQRT3 * v / 2];
export const fromPlane = ([x, y]) => [x - y / SQRT3, -2 * y / SQRT3];
/** S(u, v) = (v − u, −u) is the 240° turn about the lattice origin — `R240` in
 * the catalog's op table, and the turn the Gyre rule is built on. */
export const turn240 = ([u, v]) => [v - u, -u];

// ---- the colouring descriptors ---------------------------------------------

/** Gyre: value k is the field at phase φ + k/3, read at g^k q, where
 * g(q) = S q + w. The texture therefore carries three phases as three channels
 * and the shader makes three fetches at three positions, one channel each.
 * A third of a period renames channel k as channel k + 1 exactly (T/3 is a
 * whole M/3 saved frames), and g^k(g q) = g^(k+1) q, so the two sides of
 * colour(g x, t + T/3) = colour(x, t) − 1 are literally the same texture
 * fetch: the law is exact for any reconstruction filter. */
const gyre = {
  kind: 'gyre',
  planes: 4, internalFormat: 'RGBA32F', format: 'RGBA', fieldType: 'vec3', read: '.rgb',
  /** `w` is the translation part of g, in lattice coordinates (the catalog's
   * whole node vector divided by N). */
  constants: ({w}) => `const vec2 W = vec2(${f(w[0])}, ${f(w[1])});`,
  weights: `vec3 weights(vec2 q, float layer) {
  // Built one from the last rather than from closed forms, so that the two
  // sides of the colour law evaluate the same float expressions.
  vec2 q1 = vec2(q.y - q.x + W.x, -q.x + W.y);    // g q
  vec2 q2 = vec2(q1.y - q1.x + W.x, -q1.x + W.y); // g² q
  return vec3(field(q, layer).r, field(q1, layer).g, field(q2, layer).b);
}`,
  sample: 'field(q, layer).r',
  step: ([u, v], {w}) => [v - u + w[0], -u + w[1]],
  /** One RGBA plane for `phase`: channel k is the field at phase + k/3, each
   * blended from the four nearest saved frames with periodic Catmull–Rom
   * weights. The three channels share one set of weights, so a shift of T/3
   * renames channel k as channel k + 1 exactly. */
  frameAt(volume, {N, M}, phase, out) {
    const count = N * N, t = wrap(phase) * M, k = Math.floor(t), third = M / 3;
    const [w0, w1, w2, w3] = cubicWeights(t - k);
    for (let channel = 0; channel < 3; channel++) {
      const base = k + channel * third;
      const a = mod(base - 1, M) * count, b = mod(base, M) * count;
      const c = mod(base + 1, M) * count, d = mod(base + 2, M) * count;
      for (let i = 0; i < count; i++) {
        out[4 * i + channel] = w0 * volume[a + i] + w1 * volume[b + i] + w2 * volume[c + i] + w3 * volume[d + i];
      }
    }
    for (let i = 0; i < count; i++) out[4 * i + 3] = 1;
    return out;
  },
  valuesAt(plane, {N}, params, point) {
    const out = [0, 0, 0];
    let q = point;
    for (let k = 0; k < 3; k++) { out[k] = bicubic(plane, N, q, 4, k); q = gyre.step(q, params); }
    return out;
  },
  value: (plane, {N}, point) => bicubic(plane, N, point, 4, 0),
};

/** Trefoil: the three compared samples are q, q + b and q + 2b, all at the SAME
 * instant, so one number per node is the whole of what the shader needs. Since
 * 3b is a lattice vector and the texture wraps, the list compared at q + b is
 * the list compared at q rotated one place. */
const trefoil = {
  kind: 'trefoil',
  planes: 1, internalFormat: 'R32F', format: 'RED', fieldType: 'float', read: '.r',
  constants: ({b}) => `const vec2 B = vec2(${f(b[0])}, ${f(b[1])});`,
  weights: `vec3 weights(vec2 q, float layer) {
  vec2 q1 = q + B, q2 = q1 + B;
  return vec3(field(q, layer), field(q1, layer), field(q2, layer));
}`,
  sample: 'field(q, layer)',
  step: ([u, v], {b}) => [u + b[0], v + b[1]],
  frameAt(volume, {N, M}, phase, out) {
    const count = N * N, t = wrap(phase) * M, k = Math.floor(t);
    const [w0, w1, w2, w3] = cubicWeights(t - k);
    const a = mod(k - 1, M) * count, b = mod(k, M) * count;
    const c = mod(k + 1, M) * count, d = mod(k + 2, M) * count;
    for (let i = 0; i < count; i++) out[i] = w0 * volume[a + i] + w1 * volume[b + i] + w2 * volume[c + i] + w3 * volume[d + i];
    return out;
  },
  valuesAt(plane, {N}, params, point) {
    const out = [0, 0, 0];
    let q = point;
    for (let k = 0; k < 3; k++) { out[k] = bicubic(plane, N, q, 1, 0); q = trefoil.step(q, params); }
    return out;
  },
  value: (plane, {N}, point) => bicubic(plane, N, point, 1, 0),
};

export const DESCRIPTORS = Object.freeze({gyre, trefoil});

/** The colouring parameters the shader and the CPU twin need, read off one
 * catalog entry — and nothing else. */
export function colouringParams(entry) {
  if (entry.kind === 'gyre') return {kind: 'gyre', w: [entry.colouring.w[0] / entry.N, entry.colouring.w[1] / entry.N], centre: entry.colouring.p};
  return {kind: 'trefoil', b: [entry.colouring.b[0], entry.colouring.b[1]], centre: [0, 0]};
}

/** Home framing. Trefoil's visible motif repeats on the finer lattice
 * L′ = L + ℤb, which is 1/√3 of a lattice length of L, so a motif of
 * MOTIF_PIXELS is √3 × that many pixels per lattice length. */
export const homeScaleFor = kind => (width, height) =>
  (kind === 'trefoil' ? SQRT3 : 1) * Math.min(MOTIF_PIXELS, Math.min(width, height) / 2);

// ---- the shader ------------------------------------------------------------

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = (layers, N, descriptor, params) => `
precision highp float;
precision highp int;
// Layer i of the array holds the field at sub-sample i of the shutter. The view
// is per sub-sample too — uCenter[i], uScale[i], uRotation[i] — so a pan, a zoom
// or a turn is integrated exactly as the phase is. With one layer they hold the
// frame's own view and the draw is identical to one from a viewer with no
// shutter at all.
uniform highp sampler2DArray uFrame;
uniform sampler2D uRamp;
uniform int uLayers;
uniform int uMode;          // 0 three colours, 1 the raw channel through a ramp
uniform float uLow, uSpan;
uniform vec2 uResolution;
uniform vec2 uCssSize;
uniform vec2 uCenter[${layers}];
uniform vec2 uRotation[${layers}]; // (cos, sin) of the screen-to-plane rotation
uniform float uScale[${layers}];
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
out vec4 color;
const float N = ${f(N)};
const float SQRT3 = 1.7320508075688772;
// Node (i, j) of the periodic lattice is texel (i, j), centred at
// (i + 0.5) / N; the texture repeats, so no wrapping arithmetic is needed.
#ifdef TAPS9
${descriptor.fieldType} field(vec2 q, float layer) {
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
  return (texture(uFrame, vec3(t0.x, t0.y, layer))${descriptor.read} * w0.x + texture(uFrame, vec3(t12.x, t0.y, layer))${descriptor.read} * w12.x + texture(uFrame, vec3(t3.x, t0.y, layer))${descriptor.read} * w3.x) * w0.y
       + (texture(uFrame, vec3(t0.x, t12.y, layer))${descriptor.read} * w0.x + texture(uFrame, vec3(t12.x, t12.y, layer))${descriptor.read} * w12.x + texture(uFrame, vec3(t3.x, t12.y, layer))${descriptor.read} * w3.x) * w12.y
       + (texture(uFrame, vec3(t0.x, t3.y, layer))${descriptor.read} * w0.x + texture(uFrame, vec3(t12.x, t3.y, layer))${descriptor.read} * w12.x + texture(uFrame, vec3(t3.x, t3.y, layer))${descriptor.read} * w3.x) * w3.y;
}
#else
vec4 cubicWeights(float t) {
  float t2 = t*t, t3 = t2*t;
  return vec4(-.5*t + t2 - .5*t3, 1.0 - 2.5*t2 + 1.5*t3,
              .5*t + 2.0*t2 - 1.5*t3, -.5*t2 + .5*t3);
}
${descriptor.fieldType} field(vec2 q, float layer) {
  // Catmull–Rom from sixteen point fetches.
  vec2 p = fract(q) * N;
  vec2 base = floor(p);
  vec4 wx = cubicWeights(p.x - base.x), wy = cubicWeights(p.y - base.y);
  ${descriptor.fieldType} value = ${descriptor.fieldType}(0.0);
  for (int j = 0; j < 4; j++) {
    ${descriptor.fieldType} row = ${descriptor.fieldType}(0.0);
    for (int i = 0; i < 4; i++) row += wx[i] * texture(uFrame, vec3((base + vec2(float(i) - 0.5, float(j) - 0.5)) / N, layer))${descriptor.read};
    value += wy[j] * row;
  }
  return value;
}
#endif
${descriptor.constants(params)}
${descriptor.weights}
// Anti-aliased argmax: each colour's weight is how far it leads the better of
// the other two, softened over about one device pixel of the same margin. It is
// symmetric in the three values, so it carries every colour law exactly.
vec3 paint(vec3 w, float e) {
  vec3 lead = w - vec3(max(w.y, w.z), max(w.z, w.x), max(w.x, w.y));
  vec3 s = smoothstep(vec3(-e), vec3(e), lead);
  float total = s.x + s.y + s.z;
  s = total > 1e-6 ? s / total : vec3(1.0 / 3.0);
  return s.x * uColor0 + s.y * uColor1 + s.z * uColor2;
}
// The raw field, for the Appearance selector: the same camera and the same
// shutter, through a one-dimensional ramp instead of the colouring. It is here
// so a reader can see the wave the colouring is reading.
vec3 ramp(vec2 q, float layer) {
  float value = ${descriptor.sample};
  return texture(uRamp, vec2(clamp((value - uLow) / uSpan, 0.0, 1.0), 0.5)).rgb;
}
// Where sub-sample i of the shutter reads: the screen point through that
// sub-sample's own view, in lattice coordinates on the 120° basis.
vec2 latticeAt(vec2 screen, int i) {
  vec2 o = screen * uCssSize / uScale[i];
  vec2 p = vec2(uRotation[i].x * o.x - uRotation[i].y * o.y, uRotation[i].y * o.x + uRotation[i].x * o.y);
  return uCenter[i] + vec2(p.x - p.y / SQRT3, -2.0 * p.y / SQRT3);
}
void main() {
  vec2 screen = gl_FragCoord.xy / uResolution - .5;
  screen.y = -screen.y; // CSS y runs down; the plane below uses the same sense.
  if (uMode == 1) {
    vec3 sum = ramp(latticeAt(screen, 0), 0.0);
    for (int i = 1; i < uLayers; i++) sum += ramp(latticeAt(screen, i), float(i));
    color = vec4(sum / float(uLayers), 1.0);
    return;
  }
  vec3 w = weights(latticeAt(screen, 0), 0.0);
  // The edge softening is measured on the first sub-sample alone: screen-space
  // derivatives are only defined in uniform control flow, and over a shutter of
  // one frame interval the sub-samples differ by a fraction of a pixel.
  float e = max(0.5 * max(max(fwidth(w.x - w.y), fwidth(w.y - w.z)), fwidth(w.z - w.x)), 1e-8);
  // Average the colours over the shutter, never the field: the field's average
  // still has one sharp boundary, only displaced, while the colours' average
  // carries the boundary across every pixel it swept.
  vec3 sum = paint(w, e);
  for (int i = 1; i < uLayers; i++) sum += paint(weights(latticeAt(screen, i), float(i)), e);
  color = vec4(sum / float(uLayers), 1.0);
}`;

// ---- the CPU twin ----------------------------------------------------------

/** One channel of every saved frame, as one x-fastest volume (x, y, frame).
 * `planar` is the saved orbit: M frames of `channels` planar N×N channels, x
 * fastest — the site's one field layout. */
export function uVolume(planar, N, M, channel = 0, channels = 2) {
  const count = N * N, volume = new Float32Array(count * M);
  for (let k = 0; k < M; k++) {
    const at = (channels * k + channel) * count;
    volume.set(planar.subarray(at, at + count), k * count);
  }
  return volume;
}

/** Catmull–Rom weights for a fractional position t in [0, 1). */
export const cubicWeights = t => [-.5*t + t*t - .5*t*t*t, 1 - 2.5*t*t + 1.5*t*t*t, .5*t + 2*t*t - 1.5*t*t*t, -.5*t*t + .5*t*t*t];

/** Periodic bicubic Catmull–Rom of one interleaved plane at lattice point
 * (u, v): `stride` values per node, component `component`. */
export function bicubic(plane, N, [u, v], stride = 1, component = 0) {
  const x = wrap(u) * N, y = wrap(v) * N;
  const bx = Math.floor(x), by = Math.floor(y);
  const wx = cubicWeights(x - bx), wy = cubicWeights(y - by);
  let out = 0;
  for (let j = 0; j < 4; j++) {
    const row = mod(by + j - 1, N) * N;
    for (let i = 0; i < 4; i++) out += wx[i] * wy[j] * plane[stride * (row + mod(bx + i - 1, N)) + component];
  }
  return out;
}

/** The plane the shader would upload for `phase`. */
export function frameAt(descriptor, volume, config, phase, out = new Float32Array(descriptor.planes * config.N * config.N)) {
  return descriptor.frameAt(volume, config, phase, out);
}

/** The three values the colouring compares at a lattice point — the CPU twin of
 * the shader's `weights`. */
export const valuesAt = (descriptor, plane, config, params, point) => descriptor.valuesAt(plane, config, params, point);

/** The colour index at a lattice point: 0, 1 or 2. */
export function colourAt(descriptor, plane, config, params, point) {
  const [a, b, c] = descriptor.valuesAt(plane, config, params, point);
  return a >= b && a >= c ? 0 : b >= c ? 1 : 2;
}

/** The shutter's layers as one volume, layer after layer, ready for
 * texSubImage3D: layer j is `frameAt(volume, phases[j])`. */
export function framesAt(descriptor, volume, config, phases, out) {
  const plane = descriptor.planes * config.N * config.N;
  for (const [j, phase] of phases.entries()) descriptor.frameAt(volume, config, phase, out.subarray(j * plane, (j + 1) * plane));
  return out;
}

/** Where the `count` sub-samples of the shutter sit, as shares of a frame
 * interval either side of the frame's own instant. One sub-sample sits exactly
 * on the frame, which is why a viewer with the shutter off draws what it always
 * drew. */
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

/** The change from view `a` to view `b`: the lattice offset of the screen
 * centre (taken the shorter way round the periodic plane), the log of the zoom,
 * and the turn. */
export function viewDelta(a, b) {
  const du = b.center[0] - a.center[0], dv = b.center[1] - a.center[1];
  return {center: [du - Math.round(du), dv - Math.round(dv)], zoom: Math.log(b.scale / a.scale), angle: wrapAngle(b.angle - a.angle)};
}
export const NO_MOTION = {center: [0, 0], zoom: 0, angle: 0};

/** How far a step moves the picture on screen, in CSS pixels. */
export function viewMotion(step, scale, width, height) {
  const [dx, dy] = toPlane(step.center);
  const radius = 0.5 * Math.hypot(width, height);
  return scale * Math.hypot(dx, dy) + radius * (Math.abs(step.angle) + Math.abs(step.zoom));
}

/** How far the pattern's own boundaries travel on screen in `ms`. */
export const patternMotion = (scale, ms, loopSeconds = LOOP_SECONDS) => scale * BOUNDARY_SPEED * ms / (1000 * loopSeconds);

/** Angles are kept in (−π, π]. */
export const wrapAngle = angle => { const a = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI)); return a <= -Math.PI ? a + 2 * Math.PI : a; };
/** Snaps an angle to the nearest sixth of a turn when within `tolerance` (4° by
 * default), since the lattice is triangular. */
export function snapAngle(angle, tolerance = Math.PI / 45) {
  const sixth = Math.round(angle / (Math.PI / 3)) * (Math.PI / 3);
  return Math.abs(wrapAngle(angle - sixth)) <= tolerance ? wrapAngle(sixth) : angle;
}

/** The viewport: which lattice point sits at the screen centre, how many CSS
 * pixels one lattice length spans, and how far the pattern is turned on screen.
 * Verbatim from the standalone viewers. */
export function createView({tilePixels, center = [0, 0], angle = 0, minScale = MIN_SCALE, maxScale = MAX_SCALE, overshoot = 1} = {}) {
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
    return fromPlane([(c * dx + n * dy) / s, (-n * dx + c * dy) / s]);
  };
  const view = {
    get center() { return [...current]; },
    get angle() { return turn; },
    get minScale() { return minScale; },
    get maxScale() { return maxScale; },
    get home() { return [...home]; },
    get zoomed() { return userScale !== initialScale; },
    scale(width, height) { return userScale ?? clamp(fallback(width, height)); },
    isHome() { return userScale === initialScale && turn === homeAngle && current[0] === home[0] && current[1] === home[1]; },
    reset() { userScale = initialScale; turn = homeAngle; current[0] = home[0]; current[1] = home[1]; },
    latticeAt([x, y], width, height) {
      const [dx, dy] = toLattice(x - width / 2, y - height / 2, view.scale(width, height));
      return [current[0] + dx, current[1] + dy];
    },
    get overshoot() { return overshoot; },
    pin(lattice, [x, y], width, height, {scale, angle: nextAngle, elastic = false} = {}) {
      if (scale !== undefined) userScale = clamp(scale, elastic);
      if (nextAngle !== undefined) turn = wrapAngle(nextAngle);
      const [dx, dy] = toLattice(x - width / 2, y - height / 2, view.scale(width, height));
      current[0] = wrap(lattice[0] - dx);
      current[1] = wrap(lattice[1] - dy);
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
    restore({center: [x, y], scale, angle: nextAngle = 0}) { current[0] = wrap(x); current[1] = wrap(y); userScale = scale === null || scale === undefined ? null : clamp(scale); turn = wrapAngle(nextAngle); },
  };
  return view;
}

/** Keeps continuous playback at the display's cadence by giving up, in order,
 * the shutter and then render resolution. Verbatim from the standalone viewers:
 * the shutter is a rung of its own above the resolution ladder, nothing that was
 * found to be late is offered again straight away, and the shutter returns only
 * at full resolution after two clean windows. */
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

/** A WebGL 2 renderer for one catalog entry's colouring on `canvas`.
 *
 * `config` is `{N, M, period, loopSeconds}`; `colouring` names a descriptor and
 * carries its parameters; `planar` is the saved orbit, M frames of two N×N
 * channels. Everything else matches the standalone viewers' options. */
export function createColourRenderer(canvas, planar, {
  config, colouring, view, palette = PALETTE, channel = 0, mode = 'colour', range = null,
  pixelRatio = null, adaptive = true, display = null, taa = TAA_LAYERS, shutter = SHUTTER, motion = MOTION_PIXELS,
} = {}) {
  const {N, M} = config, loopSeconds = config.loopSeconds ?? LOOP_SECONDS, channels = config.channels ?? 2;
  const descriptor = DESCRIPTORS[colouring?.kind];
  if (!descriptor) throw new Error('Unknown colouring.');
  if (!Number.isInteger(N) || N < 4 || !Number.isInteger(M) || M < 6) throw new Error('Invalid grid or frame count.');
  if (planar.length !== channels * N * N * M) throw new Error('The pattern data is incomplete. Please reload.');
  if (!(Array.isArray(palette) && palette.length === 3 && palette.every(c => /^#[0-9a-f]{6}$/i.test(c)))) throw new Error('The palette needs three hex colours.');
  if (pixelRatio !== null && !(pixelRatio > 0 && Number.isFinite(pixelRatio))) throw new Error('The pixel ratio must be a positive number.');
  const maxLayers = Math.min(MAX_TAA_LAYERS, Math.max(1, Math.round(Number(taa) || 1)));
  if (!(shutter >= 0 && shutter <= 2)) throw new Error('The shutter must be between 0 and 2 frame intervals.');
  if (!(motion >= 0 && Number.isFinite(motion))) throw new Error('The motion threshold must be a finite number of pixels.');
  const gl = canvas.getContext('webgl2', {alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance'});
  if (!gl) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or open this page in a recent browser.');
  const linear = !!gl.getExtension('OES_texture_float_linear');
  const colour = !!gl.getExtension('EXT_color_buffer_float');
  void colour;
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
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, `#version 300 es\n${linear ? '#define TAPS9\n' : ''}${fragment(maxLayers, N, descriptor, colouring)}`)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not start the WebGL renderer.');
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.useProgram(program);
  let volume = uVolume(planar, N, M, channel, channels);
  const plane = descriptor.planes * N * N;
  const frame = new Float32Array(plane * maxLayers);
  // Two textures alternate so an upload never waits for the previous draw.
  const textures = [0, 1].map(() => {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl[descriptor.internalFormat], N, N, maxLayers, 0, gl[descriptor.format], gl.FLOAT,
      framesAt(descriptor, volume, config, shutterPhases(0, maxLayers, FALLBACK_INTERVAL, shutter, loopSeconds), frame));
    return texture;
  });
  const rampTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rampTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rampBytes('ember'));
  gl.activeTexture(gl.TEXTURE0);
  if (gl.getError() !== gl.NO_ERROR) throw new Error('The GPU rejected the pattern texture.');
  let textureIndex = 0, lastPhase = null, lastLayers = 0, lastMoving = null, layers = 1;
  let lastView = null, lastDrawTime = null, travel = 0, dirty = false;
  const centers = new Float32Array(2 * maxLayers), rotations = new Float32Array(2 * maxLayers), scales = new Float32Array(maxLayers);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.uniform1i(gl.getUniformLocation(program, 'uFrame'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uRamp'), 1);
  const layerLocation = gl.getUniformLocation(program, 'uLayers');
  const modeLocation = gl.getUniformLocation(program, 'uMode');
  const lowLocation = gl.getUniformLocation(program, 'uLow');
  const spanLocation = gl.getUniformLocation(program, 'uSpan');
  gl.uniform1i(layerLocation, 1);
  for (const [index, hex] of palette.entries()) gl.uniform3fv(gl.getUniformLocation(program, `uColor${index}`), rgb(hex));
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
    gl.uniform1i(modeLocation, mode === 'colour' ? 0 : 1);
    gl.uniform1f(lowLocation, low); gl.uniform1f(spanLocation, span);
  };
  applyMode();

  return {
    view, palette, descriptor, config,
    get taps() { return (linear ? 9 : 16) * 3 * layers; },
    get quality() { return governor.quality; },
    get display() { return governor.display; },
    get layers() { return layers; },
    get maxLayers() { return maxLayers; },
    get shutter() { return shutter; },
    get motionThreshold() { return motion; },
    get travel() { return travel; },
    get backend() { return linear ? 'WebGL playback' : 'WebGL playback (point taps)'; },
    /** Switches between the three colours and the raw field, and which channel
     * the raw field shows. A channel change rebuilds the volume; a mode change
     * is one uniform. */
    setAppearance(nextMode, nextChannel, nextRange, rampName = 'ember') {
      if (nextChannel !== channel) {
        channel = nextChannel;
        volume = uVolume(planar, N, M, channel, channels);
        dirty = true;
      }
      mode = nextMode; range = nextRange;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rampTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rampBytes(rampName));
      gl.activeTexture(gl.TEXTURE0);
      applyMode();
    },
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
      let step = paced && lastView ? viewDelta(lastView, here) : NO_MOTION;
      let viewPixels = viewMotion(step, scale, width, height);
      const patternPixels = moving ? patternMotion(scale, interval, loopSeconds) : 0;
      // A jump — a reset, a new framing, a resize, a tab coming back — is not a
      // motion, and must not be smeared across the screen.
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
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, N, N, layers, gl[descriptor.format], gl.FLOAT, framesAt(descriptor, volume, config, phases, frame));
        if (layers !== lastLayers) gl.uniform1i(layerLocation, layers);
        lastPhase = p; lastLayers = layers; lastMoving = moving; dirty = false;
      }
      for (const [j, offset] of shutterOffsets(layers, shutter).entries()) {
        centers[2 * j] = cx + step.center[0] * offset;
        centers[2 * j + 1] = cy + step.center[1] * offset;
        scales[j] = scale * Math.exp(step.zoom * offset);
        const turn = angle + step.angle * offset;
        rotations[2 * j] = Math.cos(turn); rotations[2 * j + 1] = -Math.sin(turn);
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
