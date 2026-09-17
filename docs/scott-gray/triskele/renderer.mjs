// Triskele: a three-colour rotating wave on the triangular lattice.
//
// The saved orbit wallpaper:g225:8fcde9bc1178d93d (= wallpaper:g247:8fcde9…,
// "Interwoven sixth-cycle wave") is a Gray–Scott rotating wave on a hexagonal
// lattice: 96 frames of a 66×66 periodic lattice over one period T, planar U
// then V, x fastest, float32 little-endian. On the saved samples it satisfies,
// bit for bit,
//
//     U(R x, t + 2T/3) = U(x, t),          R = the 120° turn about the origin,
//
// and the whole sixfold family U(R60^j x, t + j·5T/6) = U(x, t). Rewritten, the
// 120° turn is a pure time shift of the field:
//
//     U(R x, t) = U(x, t + T/3).
//
// So the three values U(x, t), U(Rx, t), U(R²x, t) are the same point of the
// plane at the three instants t, t + T/3, t + 2T/3, and the colouring
//
//     colour(x, t) = argmax over k in {0,1,2} of U(R^k x, t)
//
// only needs one sampling position per pixel with three time channels. The
// texture holds those three channels; the fragment shader reconstructs them
// with a Catmull–Rom kernel symmetrised over the three turns, so both the
// 120° turn and the T/3 shift permute the three reconstructed values exactly
// (see the note on `SYMMETRISED` below), not merely to interpolation accuracy.
export const ORBIT_ID = 'wallpaper:g225:8fcde9bc1178d93d';
export const FIELD_SHA256 = '8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c';
export const INITIAL_PHASE = 0;
export const LOOP_SECONDS = 8; // One period per 8 s, as on ../plume/ and ../ember/.
export const GRID_SIZE = 66;
export const FRAMES = 96;
export const THIRD = FRAMES / 3; // 32 saved frames: T/3 is an exact frame count.
export const FIELD_BYTES = FRAMES * 2 * GRID_SIZE * GRID_SIZE * 4;
// Home framing: one lattice length across 380 CSS pixels, as on ../plume/.
export const TILE_PIXELS = 380;
export const scaleFor = (width, height) => Math.min(TILE_PIXELS, Math.min(width, height) / 2);
// Lattice coordinates at the screen centre. The origin is a sixfold centre of
// the orbit and a threefold colour-cycling centre of the picture.
export const CENTER = [0, 0];
export const MIN_SCALE = 24; // CSS pixels per lattice length; pages raise it to keep a texel per device pixel.
export const MAX_SCALE = 8000;
// Shutter integration ("temporal anti-aliasing"). A display shows a frame for a
// whole frame interval, but the drawn frame is one instant, so anything that
// moves several pixels per frame — the pattern's own boundaries, or the whole
// picture under a drag or a glide — arrives as a row of hard steps instead of a
// smear: the sample-and-hold judder that shows up on a fast motion and a 60 Hz
// screen. Each displayed frame is therefore integrated over a shutter of
// SHUTTER × the frame interval centred on the frame's own instant, as
// TAA_LAYERS equally spaced sub-samples whose *colours* are averaged. Each
// sub-sample carries both its own phase and its own view, so a pan, a zoom, a
// turn and the animation are all integrated by the same three taps. Averaging
// the field instead would only move the sharp boundary; averaging the colours
// lets the boundary sweep across the pixels it crossed during the shutter,
// exactly as a camera would record it.
// A shutter of exactly one frame interval is the anti-aliasing filter the
// sampling calls for: consecutive frames' sub-samples then tile the timeline
// evenly, so the animation is drawn at TAA_LAYERS × the frame rate and box
// filtered down to it, and nothing between two displayed frames is left out.
// SHUTTER = 0.5 is the film convention (a 180° shutter), sharper but only half
// sampled; ?shutter= dials it, and 0 turns the integration off.
// The symmetrised kernel below is run per sub-sample, so every layer obeys the
// two colour-cycling identities exactly and the shutter only ever blends
// pictures that already do.
export const TAA_LAYERS = 3; // Up to 81 texture taps per pixel; ?taa= overrides.
export const MAX_TAA_LAYERS = 5;
// The default is 0.3 of a frame interval — crisper than the full box filter, at
// the user's request (17 September 2026: "decrease it by 70%"); ?shutter=1
// restores the full filter.
export const SHUTTER = 0.3;
// The shutter costs two extra samplings of the field per pixel — and here each
// sampling is three turned readings — so it is spent only where it can do
// something. MOTION_PIXELS is how far the picture must travel on screen between
// one displayed frame and the next, in CSS pixels, counting both the pattern's
// own boundaries and the view's motion, before the integration switches on.
// Below about one pixel a frame there is nothing to integrate: measured on this
// page, the home framing moves 0.33 px a frame.
// ?motion= dials it (0 keeps the shutter on whenever anything moves).
export const MOTION_PIXELS = 0.75;
// And the other end: a handful of sub-samples reconstructs a smear only while
// they overlap. Past about SMEAR_PIXELS apart they read as that many copies of
// the picture rather than one blur — which is what a hard fling at a hundred
// pixels a frame would produce. So the view's contribution to the shutter is
// integrated up to SMEAR_PIXELS × the sub-samples and no further: a very fast
// throw keeps some of its judder rather than turning into a comb. The pattern's
// own motion never reaches that width (7 px a frame at the deepest zoom), so
// this bounds panning and flinging only.
export const SMEAR_PIXELS = 6;
// How fast this colouring's boundaries sweep, in lattice lengths per period,
// measured from the saved nodes: 3.00 colour changes per node per period over
// 66 × 0.1076 = 7.10 boundary crossings per lattice length. It turns a framing
// (CSS pixels per lattice length) into the on-screen speed of the picture's own
// motion.
export const BOUNDARY_SPEED = 0.42;
export const FALLBACK_INTERVAL = 1000 / 60; // ms, until the display's cadence is known.
export const SQRT3 = Math.sqrt(3);
// Terracotta, teal, sand. Every pair stays at least 24 CIELAB units apart in
// normal vision and in simulated protanopia, deuteranopia and tritanopia, and
// the three carry comparable weight: the symmetry gives each exactly a third of
// the plane, so no colour may read as the background of the others.
export const PALETTE = ['#c9563e', '#57979a', '#e2be68'];

export const wrap = value => value - Math.floor(value);
const mod = (value, n) => ((value % n) + n) % n;

/** Lattice basis of the triangular lattice, in plane coordinates (x right,
 * y down on screen, so physical y points up): a1 = (1, 0), a2 = (−1/2, −√3/2).
 * `toPlane` and `fromPlane` are inverse to each other. */
export const toPlane = ([u, v]) => [u - v / 2, -SQRT3 * v / 2];
export const fromPlane = ([x, y]) => [x - y / SQRT3, -2 * y / SQRT3];
/** The 120° turn about the lattice origin is an integer matrix in lattice
 * coordinates, so it maps every lattice grid to itself: R(u, v) = (−v, u − v). */
export const turn120 = ([u, v]) => [-v, u - v];
export const turn240 = ([u, v]) => [v - u, -u];

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = layers => `
precision highp float;
precision highp int;
// Layer i of the array holds the three time channels at sub-sample i of the
// shutter; every layer carries the same kernel, so the colours it names are the
// same three colours. The view is per sub-sample too — uCenter[i], uScale[i],
// uRotation[i] — so a pan, a zoom or a turn is integrated exactly as the phase
// is. With one layer they hold the frame's own view and the draw is identical
// to one from a viewer with no shutter at all.
//
// One shader is compiled per layer count the viewer can draw at, and the
// one-layer one carries no loop at all: a loop whose trip count only the
// uniform knows is not free even when it runs zero times — on a software GPU
// the same draw measured 14.2 ms with it and 12.3 ms without, so a viewer whose
// shutter is switched off would have paid a fifth of a frame for a feature it
// was not using. See \`build\` in createRenderer.
uniform highp sampler2DArray uFrame;
${layers > 1 ? 'uniform int uLayers;\n' : ''}uniform vec2 uResolution;
uniform vec2 uCssSize;
uniform vec2 uCenter[${layers}];
uniform vec2 uRotation[${layers}]; // (cos, sin) of the screen-to-plane rotation, the inverse of the view's turn
uniform float uScale[${layers}];
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
out vec4 color;
const float N = ${GRID_SIZE}.0;
const float SQRT3 = 1.7320508075688772;
// Node (i, j) of the periodic lattice is texel (i, j), centred at
// (i + 0.5) / N; the texture repeats, so no wrapping arithmetic is needed.
#ifdef TAPS9
vec3 field(vec2 q, float layer) {
  // Catmull–Rom from nine bilinear fetches: the two positive inner weights of
  // each axis share one linearly filtered fetch (Sigg & Hadwiger).
  vec2 p = fract(q) * N;
  vec2 base = floor(p), f = p - base, c = base + 0.5;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (c - 1.0) / N, t12 = (c + w2 / w12) / N, t3 = (c + 2.0) / N;
  return (texture(uFrame, vec3(t0.x, t0.y, layer)).rgb * w0.x + texture(uFrame, vec3(t12.x, t0.y, layer)).rgb * w12.x + texture(uFrame, vec3(t3.x, t0.y, layer)).rgb * w3.x) * w0.y
       + (texture(uFrame, vec3(t0.x, t12.y, layer)).rgb * w0.x + texture(uFrame, vec3(t12.x, t12.y, layer)).rgb * w12.x + texture(uFrame, vec3(t3.x, t12.y, layer)).rgb * w3.x) * w12.y
       + (texture(uFrame, vec3(t0.x, t3.y, layer)).rgb * w0.x + texture(uFrame, vec3(t12.x, t3.y, layer)).rgb * w12.x + texture(uFrame, vec3(t3.x, t3.y, layer)).rgb * w3.x) * w3.y;
}
#else
vec4 cubicWeights(float t) {
  float t2 = t*t, t3 = t2*t;
  return vec4(-.5*t + t2 - .5*t3, 1.0 - 2.5*t2 + 1.5*t3,
              .5*t + 2.0*t2 - 1.5*t3, -.5*t2 + .5*t3);
}
vec3 field(vec2 q, float layer) {
  // Catmull–Rom from sixteen point fetches.
  vec2 p = fract(q) * N;
  vec2 base = floor(p);
  vec4 wx = cubicWeights(p.x - base.x), wy = cubicWeights(p.y - base.y);
  vec3 value = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    vec3 row = vec3(0.0);
    for (int i = 0; i < 4; i++) row += wx[i] * texture(uFrame, vec3((base + vec2(float(i) - 0.5, float(j) - 0.5)) / N, layer)).rgb;
    value += wy[j] * row;
  }
  return value;
}
#endif
// Channel k of the texture is U(x, t + k T/3) = U(R^k x, t) on the lattice
// nodes. Reconstructing channel k at x alone would inherit the Catmull–Rom
// kernel's orientation, which the 120° turn does not preserve. Averaging the
// three turned readings instead,
//
//     w_k(x) = (1/3) sum over j of  field(R^-j x)[k + j],
//
// gives w_k(R x) = w_(k+1)(x) and, because a T/3 shift renames channel k as
// channel k+1, the same cyclic renaming in time — both identities exactly, at
// every point, for the values the shader actually compares.
#define SYMMETRISED 1
// The three symmetrised values at one lattice point, read from one layer of the
// shutter. Every sub-sample runs this identical kernel, so each of the pictures
// the shutter averages obeys both identities exactly; the shutter can only
// blend colours that the rule already assigned.
vec3 weights(vec2 q, float layer) {
  vec2 q1 = vec2(q.y - q.x, -q.x); // R^-1 q
  vec2 q2 = vec2(-q.y, q.x - q.y); // R^-2 q = R q
  vec3 a = field(q, layer), b = field(q1, layer), c = field(q2, layer);
  return (a + b.gbr + c.brg) / 3.0;
}
// Anti-aliased argmax: each colour's weight is how far it leads the better of
// the other two, softened over about one device pixel of the same margin.
vec3 paint(vec3 w, float e) {
  vec3 lead = w - vec3(max(w.y, w.z), max(w.z, w.x), max(w.x, w.y));
  vec3 s = smoothstep(vec3(-e), vec3(e), lead);
  float total = s.x + s.y + s.z;
  s = total > 1e-6 ? s / total : vec3(1.0 / 3.0);
  return s.x * uColor0 + s.y * uColor1 + s.z * uColor2;
}
// Where sub-sample i of the shutter reads: the screen point through that
// sub-sample's own view, in lattice coordinates on the 120° basis
// a1 = (1, 0), a2 = (−1/2, −√3/2).
vec2 latticeAt(vec2 screen, int i) {
  vec2 o = screen * uCssSize / uScale[i];
  vec2 p = vec2(uRotation[i].x * o.x - uRotation[i].y * o.y, uRotation[i].y * o.x + uRotation[i].x * o.y);
  return uCenter[i] + vec2(p.x - p.y / SQRT3, -2.0 * p.y / SQRT3);
}
void main() {
  vec2 screen = gl_FragCoord.xy / uResolution - .5;
  screen.y = -screen.y; // CSS y runs down; the plane below uses the same sense.
  vec3 w = weights(latticeAt(screen, 0), 0.0);
  // The edge softening is measured on the first sub-sample alone: screen-space
  // derivatives are only defined in uniform control flow, and over a shutter of
  // one frame interval the sub-samples differ by a fraction of a pixel of
  // gradient — the shutter only ever moves the picture by about a pixel, which
  // is the width this softening spans in the first place.
  float e = max(0.5 * max(max(fwidth(w.x - w.y), fwidth(w.y - w.z)), fwidth(w.z - w.x)), 1e-8);
  // Average the colours over the shutter, never the field: the field's average
  // still has one sharp boundary, only displaced, while the colours' average
  // carries the boundary across every pixel it swept.
  vec3 sum = paint(w, e);
${layers > 1 ? `  for (int i = 1; i < uLayers; i++) sum += paint(weights(latticeAt(screen, i), float(i)), e);
  color = vec4(sum / float(uLayers), 1.0);` : `  color = vec4(sum, 1.0); // one layer: the average of one colour is that colour`}
}`;

/** The U channel of every saved frame, as one x-fastest volume (x, y, frame).
 * The V channel of the saved orbit is not displayed. */
export function uVolume(planar) {
  const count = GRID_SIZE * GRID_SIZE, volume = new Float32Array(count * FRAMES);
  for (let k = 0; k < FRAMES; k++) volume.set(planar.subarray(k * 2 * count, k * 2 * count + count), k * count);
  return volume;
}

/** Catmull–Rom weights for a fractional position t in [0, 1). */
export const cubicWeights = t => [-.5*t + t*t - .5*t*t*t, 1 - 2.5*t*t + 1.5*t*t*t, .5*t + 2*t*t - 1.5*t*t*t, -.5*t*t + .5*t*t*t];

/** One RGBA texture plane for phase `phase`: channel k is the field at phase
 * `phase + k/3`, each blended from the four nearest saved frames with periodic
 * Catmull–Rom weights. T/3 is exactly THIRD saved frames, so the three channels
 * share one set of weights and a shift of T/3 renames channel k as channel
 * k + 1 exactly. */
export function frameAt(volume, phase, out = new Float32Array(4 * GRID_SIZE * GRID_SIZE)) {
  const count = GRID_SIZE * GRID_SIZE, t = wrap(phase) * FRAMES, k = Math.floor(t);
  const [w0, w1, w2, w3] = cubicWeights(t - k);
  for (let channel = 0; channel < 3; channel++) {
    const base = k + channel * THIRD;
    const a = mod(base - 1, FRAMES) * count, b = mod(base, FRAMES) * count;
    const c = mod(base + 1, FRAMES) * count, d = mod(base + 2, FRAMES) * count;
    for (let i = 0; i < count; i++) {
      out[4 * i + channel] = w0 * volume[a + i] + w1 * volume[b + i] + w2 * volume[c + i] + w3 * volume[d + i];
    }
  }
  for (let i = 0; i < count; i++) out[4 * i + 3] = 1;
  return out;
}

/** Where the `count` sub-samples of the shutter sit, as shares of a frame
 * interval either side of the frame's own instant: −shutter/2 … +shutter/2,
 * equally spaced and averaging to 0. One sub-sample sits exactly on the frame,
 * which is why a viewer with the shutter off draws what it always drew. */
export function shutterOffsets(count = 1, shutter = SHUTTER) {
  const n = Math.max(1, Math.round(count));
  return Array.from({length: n}, (_, j) => shutter * ((j + 0.5) / n - 0.5));
}

/** The phases of the `layers` shutter samples of a frame displayed at `phase`,
 * filling a shutter of `shutter` × the frame interval `displayMs` centred on
 * `phase`. */
export function shutterPhases(phase, layers = 1, displayMs = FALLBACK_INTERVAL, shutter = SHUTTER) {
  const frame = displayMs / (1000 * LOOP_SECONDS);
  return shutterOffsets(layers, shutter).map(offset => wrap(phase + offset * frame));
}

/** The change from view `a` to view `b`: the lattice offset of the screen
 * centre (taken the shorter way round the periodic plane, so a pan across the
 * wrap reads as the small step it is), the log of the zoom, and the turn. */
export function viewDelta(a, b) {
  const du = b.center[0] - a.center[0], dv = b.center[1] - a.center[1];
  return {center: [du - Math.round(du), dv - Math.round(dv)], zoom: Math.log(b.scale / a.scale), angle: wrapAngle(b.angle - a.angle)};
}
export const NO_MOTION = {center: [0, 0], zoom: 0, angle: 0};

/** How far a step moves the picture on screen, in CSS pixels: the pan at the
 * screen centre, plus what the turn and the zoom do at the corner of a
 * `width` × `height` canvas showing `scale` pixels per lattice length. */
export function viewMotion(step, scale, width, height) {
  const [dx, dy] = toPlane(step.center);
  const radius = 0.5 * Math.hypot(width, height);
  return scale * Math.hypot(dx, dy) + radius * (Math.abs(step.angle) + Math.abs(step.zoom));
}

/** How far the pattern's own boundaries travel on screen in `ms`, at `scale`
 * CSS pixels per lattice length: the judder the shutter exists for, when the
 * view itself is still. */
export const patternMotion = (scale, ms) => scale * BOUNDARY_SPEED * ms / (1000 * LOOP_SECONDS);

/** The shutter's layers as one RGBA volume, layer after layer, ready for
 * texSubImage3D: layer j is `frameAt(volume, phases[j])`. */
export function framesAt(volume, phases, out = new Float32Array(4 * GRID_SIZE * GRID_SIZE * phases.length)) {
  const plane = 4 * GRID_SIZE * GRID_SIZE;
  for (const [j, phase] of phases.entries()) frameAt(volume, phase, out.subarray(j * plane, (j + 1) * plane));
  return out;
}

/** The three reconstructed values at lattice point (u, v), the CPU twin of the
 * shader's symmetrised Catmull–Rom. `plane` is one RGBA frame from frameAt. */
export function valuesAt(plane, [u, v]) {
  const points = [[u, v], turn240([u, v]), turn120([u, v])];
  const out = [0, 0, 0];
  for (let j = 0; j < 3; j++) {
    const rgb = bicubicRGB(plane, points[j]);
    for (let k = 0; k < 3; k++) out[k] += rgb[(k + j) % 3] / 3;
  }
  return out;
}

/** Periodic bicubic Catmull–Rom of one RGBA plane at lattice point (u, v). */
export function bicubicRGB(plane, [u, v]) {
  const n = GRID_SIZE, x = wrap(u) * n, y = wrap(v) * n;
  const bx = Math.floor(x), by = Math.floor(y);
  const wx = cubicWeights(x - bx), wy = cubicWeights(y - by), out = [0, 0, 0];
  for (let j = 0; j < 4; j++) {
    const row = mod(by + j - 1, n) * n;
    for (let i = 0; i < 4; i++) {
      const index = 4 * (row + mod(bx + i - 1, n)), weight = wx[i] * wy[j];
      for (let k = 0; k < 3; k++) out[k] += weight * plane[index + k];
    }
  }
  return out;
}

/** The colour index at a lattice point: 0, 1 or 2. */
export const colourAt = (plane, point) => {
  const [a, b, c] = valuesAt(plane, point);
  return a >= b && a >= c ? 0 : b >= c ? 1 : 2;
};

/** Angles are kept in (−π, π]. */
export const wrapAngle = angle => { const a = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI)); return a <= -Math.PI ? a + 2 * Math.PI : a; };
/** Snaps an angle to the nearest sixth of a turn when within `tolerance` (4° by
 * default), since the lattice is triangular. */
export function snapAngle(angle, tolerance = Math.PI / 45) {
  const sixth = Math.round(angle / (Math.PI / 3)) * (Math.PI / 3);
  return Math.abs(wrapAngle(angle - sixth)) <= tolerance ? wrapAngle(sixth) : angle;
}

/** The viewport: which lattice point sits at the screen centre, how many CSS
 * pixels one lattice length spans, and how far the pattern is turned on screen
 * (radians, clockwise positive since screen y runs down). The centre is kept in
 * lattice coordinates wrapped into [0, 1)², so panning never loses precision
 * however far it goes. `tilePixels` is either a fixed scale or a function of the
 * canvas CSS size that applies until the viewer zooms. */
export function createView({tilePixels = scaleFor, center = CENTER, angle = 0, minScale = MIN_SCALE, maxScale = MAX_SCALE} = {}) {
  if (!(minScale > 0 && maxScale >= minScale)) throw new Error('The zoom limits must be positive and ordered.');
  if (!Number.isFinite(angle)) throw new Error('The angle must be finite.');
  const fallback = typeof tilePixels === 'function' ? tilePixels : () => tilePixels;
  const clamp = scale => Math.min(maxScale, Math.max(minScale, scale));
  const initialScale = typeof tilePixels === 'number' ? clamp(tilePixels) : null;
  const home = [wrap(center[0]), wrap(center[1])], homeAngle = wrapAngle(angle);
  let userScale = initialScale, turn = homeAngle;
  const current = [...home];
  // Screen offset (CSS pixels, y down) to lattice offset at the current scale and angle.
  const toLattice = (dx, dy, s) => {
    const c = Math.cos(turn), n = Math.sin(turn);
    return fromPlane([(c * dx + n * dy) / s, (-n * dx + c * dy) / s]);
  };
  const view = {
    get center() { return [...current]; },
    get angle() { return turn; },
    get minScale() { return minScale; },
    get maxScale() { return maxScale; },
    get zoomed() { return userScale !== initialScale; },
    scale(width, height) { return userScale ?? clamp(fallback(width, height)); },
    isHome() { return userScale === initialScale && turn === homeAngle && current[0] === home[0] && current[1] === home[1]; },
    reset() { userScale = initialScale; turn = homeAngle; current[0] = home[0]; current[1] = home[1]; },
    latticeAt([x, y], width, height) {
      const [dx, dy] = toLattice(x - width / 2, y - height / 2, view.scale(width, height));
      return [current[0] + dx, current[1] + dy];
    },
    /** Shows lattice point `lattice` at CSS pixel `point`, optionally at a new scale and angle. */
    pin(lattice, [x, y], width, height, {scale, angle} = {}) {
      if (scale !== undefined) userScale = clamp(scale);
      if (angle !== undefined) turn = wrapAngle(angle);
      const [dx, dy] = toLattice(x - width / 2, y - height / 2, view.scale(width, height));
      current[0] = wrap(lattice[0] - dx);
      current[1] = wrap(lattice[1] - dy);
    },
    panBy(dx, dy, width, height) {
      const [lx, ly] = toLattice(dx, dy, view.scale(width, height));
      current[0] = wrap(current[0] - lx);
      current[1] = wrap(current[1] - ly);
    },
    zoomAt(factor, point, width, height) {
      view.pin(view.latticeAt(point, width, height), point, width, height, {scale: view.scale(width, height) * factor});
    },
    rotateAt(delta, point, width, height) {
      view.pin(view.latticeAt(point, width, height), point, width, height, {angle: turn + delta});
    },
    snapshot() { return {center: [...current], scale: userScale, angle: turn}; },
    restore({center: [x, y], scale, angle = 0}) { current[0] = wrap(x); current[1] = wrap(y); userScale = scale === null ? null : clamp(scale); turn = wrapAngle(angle); },
  };
  return view;
}

/** Keeps continuous playback at the display's cadence by giving up, in order,
 * the shutter and then render resolution. `display` seeds the display's frame
 * interval in ms (measured from idle animation frames before rendering starts).
 *
 * The shutter is the first thing to go, and it is a rung of its own *above* the
 * resolution ladder rather than something hung on the quality factor: motion
 * blur must never cost frames, and a cost step sitting on the value the
 * governor moves up and down would make the governor oscillate between the two
 * sides of it for ever. Only if frames are still late with one sub-sample does
 * the quality factor drop, a step at a time, each step kept only if the cadence
 * actually improves — so a display that simply runs at 60 Hz is not mistaken
 * for a slow GPU, and a probe that continuous drawing abandons is reverted.
 *
 * Nothing that was found to be late is offered again straight away: the
 * resolution may not climb back to a level already measured as too slow until
 * its 20 s cooling-off expires, and the shutter comes back only at full
 * resolution, after two clean windows, and after a wait that doubles every time
 * it has to be dropped again soon after — so a GPU that cannot hold the cadence
 * with it settles instead of flickering between the two states. A probe that
 * did not pay for itself doubles its own wait the same way, and is believed:
 * the cadence it measured becomes the display's, since a frame rate the pixel
 * count could not change is not the pixel count's fault.
 *
 * `display` is only ever taken from idle frames. If it was never measured the
 * governor assumes an ordinary 60 Hz screen rather than adopting the cadence of
 * a page already struggling — a page that draws at 5 fps must not conclude that
 * its display refreshes at 5 Hz, since it would then have nothing to give up.
 *
 * `probeSoon()` asks for one lower-resolution trial at the next window (at most
 * every 30 s), used when a touch begins because phones raise their refresh rate
 * under a finger; it never touches the shutter. */
export function createGovernor({enabled = true, step = 0.85, floor = 0.5, window = 45, display = null} = {}) {
  let quality = 1, last = null, changed = 0, probe = null, ceiling = 1, ceilingUntil = 0, blockedUntil = 0, wanted = false, lastRequest = -Infinity;
  let shutter = true, shutterWait = 20000, shutterUntil = 0, shutterSince = -Infinity, clean = 0, probeWait = 4000;
  if (display !== null && !(display >= 4 && display <= 200)) display = null;
  const deltas = [];
  const revert = now => { quality = probe.quality; probe = null; blockedUntil = now + probeWait; changed = now; };
  const governor = {
    get quality() { return quality; },
    get display() { return display; },
    get enabled() { return enabled; },
    /** Whether the shutter may run. False once frames have read late with it. */
    get shutter() { return shutter; },
    probeSoon(now) { if (enabled && now - lastRequest >= 30000) { wanted = true; lastRequest = now; } },
    /** `shuttered` says whether the frames of this window actually used the
     * shutter — there is no point blaming it for lateness it did not cause. */
    tick(now, continuous, shuttered = false) {
      if (!enabled) return;
      if (!continuous) { if (probe) revert(now); last = null; deltas.length = 0; return; }
      // A page drawing at 5 fps produces 200 ms intervals, and a window made
      // only of intervals shorter than that would never fill on the very GPU
      // the governor exists for. Only a gap long enough to be a hidden tab
      // coming back — not a slow frame — is thrown away.
      if (last !== null) { const dt = now - last; if (dt > 2 && dt < 1000) deltas.push(dt); }
      last = now;
      if (deltas.length < window) return;
      const sorted = deltas.slice().sort((a, b) => a - b);
      const fast = sorted[Math.floor(sorted.length * 0.2)];
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      deltas.length = 0;
      // An unmeasured display is never seeded from a cadence measured under
      // load: these intervals are what this page manages, not what the screen
      // can show, and adopting them would make a page stuck at 5 fps decide
      // that 5 fps *is* the refresh rate and give up nothing to recover. So it
      // starts from the ordinary 60 Hz assumption instead, and a failed probe
      // below raises it if the display really is slower.
      display = Math.max(4, display === null ? Math.min(fast, FALLBACK_INTERVAL) : Math.min(display, fast));
      if (probe) {
        if (mean < 0.85 * probe.mean) { probe = null; probeWait = 4000; } // The lower resolution paid off: keep it.
        else if (probe.steps < 2 && quality > floor) { quality = Math.max(floor, quality * step); probe.steps++; changed = now; return; }
        else {
          // Lowering the resolution did not help, so this cadence belongs to
          // the display or to the rest of the frame, not to the pixel count:
          // believe it — including the cadence at the level being reverted to,
          // or the same level reads as late again the moment it is restored —
          // and wait longer before trying the same thing again.
          display = Math.max(display, mean, probe.mean);
          revert(now);
          probeWait = Math.min(120000, 2 * probeWait);
          return;
        }
      }
      const late = mean > 1.35 * display;
      clean = late || mean > 1.1 * display ? 0 : clean + 1;
      // Rung one: the shutter, at full resolution.
      if (late && shutter && shuttered) {
        shutter = false;
        shutterWait = now - shutterSince > 60000 ? 20000 : Math.min(600000, shutterWait * 2);
        shutterUntil = now + shutterWait; clean = 0; changed = now;
        return;
      }
      // Rung two: the render resolution.
      if ((late || wanted) && quality > floor && now >= blockedUntil) {
        wanted = false;
        // The level that was late is itself out of bounds for the climb back,
        // not merely the levels above it.
        if (late) { ceiling = quality * step; ceilingUntil = now + 20000; }
        probe = {quality, mean, steps: 1};
        quality = Math.max(floor, quality * step); changed = now;
      } else if (!late && quality < 1 && now - changed > 2500 && mean <= 1.1 * display) {
        wanted = false;
        const next = Math.min(1, quality / step);
        if (next <= ceiling || now > ceilingUntil) { quality = next; changed = now; }
      } else wanted = false;
      // Resolution first, then motion blur: the shutter returns only at full
      // quality, after two clean windows, and once its own wait has expired.
      if (!shutter && !probe && quality >= 1 && clean >= 2 && now >= shutterUntil) { shutter = true; shutterSince = now; clean = 0; }
    },
  };
  return governor;
}

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

/** A WebGL 2 renderer for the saved orbit on `canvas`. Options: `view` (from
 * createView; one is created from `tilePixels`/`center` otherwise), `palette`
 * (three CSS hex colours), `pixelRatio` (pins the device pixel ratio and
 * disables adaptive resolution), `adaptive` (default true), `display` (the
 * display's frame interval in ms, if measured), `taa` (shutter sub-samples per
 * displayed frame, 1 to MAX_TAA_LAYERS; 1 turns the shutter off), `shutter`
 * (the shutter's share of a frame interval) and `motion` (how far the picture
 * must move on screen between frames, in CSS pixels, before the shutter is
 * worth its cost; 0 keeps it on for any motion at all). */
export function createRenderer(canvas, planar, {tilePixels = scaleFor, center = CENTER, view = createView({tilePixels, center}), palette = PALETTE, pixelRatio = null, adaptive = true, display = null, taa = TAA_LAYERS, shutter = SHUTTER, motion = MOTION_PIXELS} = {}) {
  if (planar.length !== FIELD_BYTES / 4 || !planar.every(Number.isFinite)) {
    throw new Error('The pattern data is incomplete. Please reload.');
  }
  if (!(Array.isArray(palette) && palette.length === 3 && palette.every(c => /^#[0-9a-f]{6}$/i.test(c)))) {
    throw new Error('The palette needs three hex colours.');
  }
  if (pixelRatio !== null && !(pixelRatio > 0 && Number.isFinite(pixelRatio))) throw new Error('The pixel ratio must be a positive number.');
  const maxLayers = Math.min(MAX_TAA_LAYERS, Math.max(1, Math.round(Number(taa) || 1)));
  if (!(shutter >= 0 && shutter <= 2)) throw new Error('The shutter must be between 0 and 2 frame intervals.');
  if (!(motion >= 0 && Number.isFinite(motion))) throw new Error('The motion threshold must be a finite number of pixels.');
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
  /** One program per layer count the draw can use, with its uniform locations
   * and the constants that never change. */
  function build(layers) {
    const program = gl.createProgram();
    const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, `#version 300 es\n${linear ? '#define TAPS9\n' : ''}${fragment(layers)}`)];
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not start the WebGL renderer.');
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uFrame'), 0);
    for (const [index, hex] of palette.entries()) gl.uniform3fv(gl.getUniformLocation(program, `uColor${index}`), rgb(hex));
    return {
      program, layers,
      count: gl.getUniformLocation(program, 'uLayers'), // absent from the one-layer shader
      resolution: gl.getUniformLocation(program, 'uResolution'),
      cssSize: gl.getUniformLocation(program, 'uCssSize'),
      center: gl.getUniformLocation(program, 'uCenter[0]'),
      rotation: gl.getUniformLocation(program, 'uRotation[0]'),
      scale: gl.getUniformLocation(program, 'uScale[0]'),
    };
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  // Two programs, not one with a switched-off loop: a draw with the shutter
  // gated off then costs exactly what a viewer built without a shutter costs,
  // down to the last bit of the picture and the last percent of the frame time.
  // They share the one texture array, so nothing about the upload changes.
  const single = build(1);
  const multi = maxLayers > 1 ? build(maxLayers) : single;
  let active = single;
  gl.useProgram(active.program);
  const volume = uVolume(planar);
  const plane = 4 * GRID_SIZE * GRID_SIZE;
  const frame = new Float32Array(plane * maxLayers);
  // Two textures alternate so an upload never waits for the previous draw. Each
  // holds one layer per shutter sub-sample; the wrap is on the lattice axes only,
  // the third coordinate being the layer.
  const textures = [0, 1].map(() => {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA32F, GRID_SIZE, GRID_SIZE, maxLayers, 0, gl.RGBA, gl.FLOAT, framesAt(volume, shutterPhases(0, maxLayers), frame));
    return texture;
  });
  if (gl.getError() !== gl.NO_ERROR) throw new Error('The GPU rejected the pattern texture.');
  let textureIndex = 0, lastPhase = null, lastLayers = 0, lastMoving = null, layers = 1;
  let lastView = null, lastDrawTime = null, travel = 0;
  // The per-sub-sample view, uploaded as three small uniform arrays.
  const centers = new Float32Array(2 * maxLayers), rotations = new Float32Array(2 * maxLayers), scales = new Float32Array(maxLayers);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  const maxSize = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
  const governor = createGovernor({enabled: adaptive && pixelRatio === null, display});
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  return {
    view, palette,
    /** Texture fetches per pixel in the last draw, the shutter included: three
     * turned readings of the symmetrised kernel, once per sub-sample. */
    get taps() { return (linear ? 9 : 16) * 3 * layers; },
    get quality() { return governor.quality; },
    get display() { return governor.display; },
    /** The shutter sub-samples the last draw used, and the most this viewer may use. */
    get layers() { return layers; },
    get maxLayers() { return maxLayers; },
    get shutter() { return shutter; },
    get motionThreshold() { return motion; },
    /** How far the picture travelled on screen in the last drawn frame, in CSS
     * pixels: what the shutter's decision is made on. */
    get travel() { return travel; },
    /** Call when a touch begins: the governor then tries a lower resolution once, in case the display sped up. */
    touched() { governor.probeSoon(performance.now()); },
    /** Draws the pattern at `phase`. Pass continuous=true from an animation
     * loop so the adaptive resolution can read the frame cadence, `moving` when
     * the phase is advancing, and the frame's animation-frame timestamp as
     * `time` — it is far steadier than the clock read inside the callback, so
     * the cadence it measures is the display's and not the main thread's
     * jitter. The view's own motion is measured here, from one draw to the
     * next, so panning and gliding are integrated whether the phase moves or
     * not. */
    draw(phase, {continuous = false, moving = continuous, time = null} = {}) {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!(width > 0 && height > 0)) return;
      const now = time ?? performance.now();
      governor.tick(now, continuous, lastLayers > 1);
      // Native device pixels (times the quality factor), with hardware limits and a 32-megapixel ceiling.
      const ratio = Math.min((pixelRatio ?? devicePixelRatio ?? 1) * governor.quality, maxSize / width, maxSize / height, Math.sqrt(33554432 / (width * height)));
      const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      const scale = view.scale(width, height), [cx, cy] = view.center, angle = view.angle;
      const here = {center: [cx, cy], scale, angle};
      // How long this frame will be on screen, and how far the picture moves in
      // that time: the view's own step since the last draw plus the pattern's
      // own boundaries, if the phase is advancing. The gap between draws is the
      // honest frame interval — if frames are being dropped, the picture is on
      // screen for longer and moves further, and the shutter should cover it.
      const gap = lastDrawTime === null ? 0 : now - lastDrawTime;
      const paced = gap > 2 && gap < 250;
      const interval = paced ? gap : governor.display ?? FALLBACK_INTERVAL;
      let step = paced && lastView ? viewDelta(lastView, here) : NO_MOTION;
      let viewPixels = viewMotion(step, scale, width, height);
      const patternPixels = moving ? patternMotion(scale, interval) : 0;
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
      // The shutter costs a sampling of the field per extra sub-sample, so it
      // is spent only where it can do something: on a picture actually moving
      // more than `motion` CSS pixels a frame, and never on a viewer the
      // governor has had to slow down — frame rate is not traded for blur.
      // `travel > 0` is the first condition and not a consequence of the last:
      // with ?motion=0 — "integrate whenever anything moves at all" — a picture
      // that is not moving at all would otherwise satisfy `0 >= 0` and pay for
      // three sub-samples of the same instant of the same view.
      // The gate reads the motion itself, not the smear (travel × shutter): a
      // narrower shutter blurs less but should switch on in the same places.
      layers = maxLayers > 1 && shutter > 0 && governor.shutter && travel > 0 && travel >= motion ? maxLayers : 1;
      if (layers !== active.layers) {
        active = layers > 1 ? multi : single;
        gl.useProgram(active.program);
        if (active.count) gl.uniform1i(active.count, layers);
      }
      const p = wrap(phase);
      if (p !== lastPhase || layers !== lastLayers || moving !== lastMoving) {
        textureIndex ^= 1; gl.bindTexture(gl.TEXTURE_2D_ARRAY, textures[textureIndex]);
        // With the phase still — a drag, a glide, a paused page — every layer
        // holds the same instant and only the view varies across the shutter.
        const phases = moving ? shutterPhases(p, layers, interval, shutter) : new Array(layers).fill(p);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, GRID_SIZE, GRID_SIZE, layers, gl.RGBA, gl.FLOAT, framesAt(volume, phases, frame));
        lastPhase = p; lastLayers = layers; lastMoving = moving;
      }
      // Each sub-sample reads the view it had at its own instant of the
      // shutter; with one layer that is exactly the frame's own view.
      for (const [j, offset] of shutterOffsets(layers, shutter).entries()) {
        centers[2 * j] = cx + step.center[0] * offset;
        centers[2 * j + 1] = cy + step.center[1] * offset;
        scales[j] = scale * Math.exp(step.zoom * offset);
        const turn = angle + step.angle * offset;
        rotations[2 * j] = Math.cos(turn); rotations[2 * j + 1] = -Math.sin(turn); // screen-to-plane turns the other way
      }
      gl.uniform2f(active.resolution, w, h); gl.uniform2f(active.cssSize, width, height);
      gl.uniform2fv(active.center, centers.subarray(0, 2 * layers));
      gl.uniform1fv(active.scale, scales.subarray(0, layers));
      gl.uniform2fv(active.rotation, rotations.subarray(0, 2 * layers));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      for (const texture of textures) gl.deleteTexture(texture);
      for (const shader of new Set([single, multi])) gl.deleteProgram(shader.program);
      gl.deleteVertexArray(vao);
    },
  };
}
