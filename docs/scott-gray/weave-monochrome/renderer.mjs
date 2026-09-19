// Weave Monochrome: a woven rotating wave in black and white only.
//
// The saved orbit wallpaper:g11:459f00246aed5414 ("Woven rotating wave · (3,1)",
// branch g96-diversity-p4-rotating-woven31-f0p00395) is a Gray–Scott rotating
// wave on a square lattice: 128 frames of a 48×48 periodic lattice over one
// period T = 352.037, planar U then V, x fastest, float32 little-endian.
// F = 0.00395, k = 0.02, Du = 0.16, Dv = 0.08, L = 256, dx = 16/3.
//
// The page draws the sign of
//
//     w(x, t) = U(x, t) − U(−x, t),
//
// white where the pattern exceeds its own half-turn image and black where it
// falls short, with the zero contour anti-aliased over about one device pixel.
// The half turn is taken about the lattice origin, which the home view puts at
// the screen centre.
//
// On THIS orbit the following hold bit-exactly on the saved samples (checked in
// ../tests/weave-monochrome.test.mjs, max abs error 0.0), in node coordinates
// where 48 nodes = one lattice length:
//
//     U(−x, t)            = U(x, t + T/2)      half turn about the origin
//     U(x + (24, 0),  t)  = U(x, t + T/2)      slide half a cell along x
//     U(x + (0, 24),  t)  = U(x, t + T/2)      slide half a cell along y
//     U(x + (24, 24), t)  = U(x, t)            the field's own shortest repeat
//     U(R x, t)           = U(x, t + 3T/4)     R: (x, y) → (−y, x)
//     U(y + 12, x + 12, t) = U(x, y, t)        the glide the source page marks Y
//
// So three rules that look different are literally the same function here:
// w = U(x,t) − U(−x,t) = U(x,t) − U(x,t+T/2) = U(x,t) − U(x + ½L eₓ, t). V
// satisfies the same identities, and ?rule=v draws the V-channel twill instead.
//
// Read off the colour law (all exact, for any reconstruction filter, since each
// side is the same expression):
//
//   SWAP   slide half a cell along x, or along y; wait T/2; half turn about the
//          origin; quarter turn + 3T/4.
//   KEEP   slide half a cell along BOTH axes; quarter turn + T/4; the glide Y
//          (reflect in the diagonal through the centre, slide a quarter cell
//          along it).
//
// That is a proper two-colour (antisymmetry) spacetime group: 32 colour-
// preserving and 32 colour-swapping operations modulo the lattice. Plume
// Monochrome's sibling orbit gives 12 + 12 — the extra ones here are all
// translations, and they are exactly what makes this picture a weave.
//
// Reconstruction, unchanged from ../plume-monochrome/: every saved frame is
// spectrally (Dirichlet-kernel) upsampled to 96×96 on load and the half-turn
// difference is taken there — the doubled grid is closed under the half turn and
// trigonometric interpolation commutes with it, so w is band-limited and exact.
// Each displayed frame is then reconstructed in two cheap steps: the CPU blends
// the four nearest saved frames with periodic Catmull–Rom weights into one 96×96
// texture, and the GPU reconstructs every device pixel from it with periodic
// bicubic Catmull–Rom: nine bilinear fetches where float textures filter,
// sixteen point fetches otherwise.
export const ORBIT_ID = 'wallpaper:g11:459f00246aed5414';
export const FIELD_SHA256 = '459f00246aed541414bbe7d3d092ca2e66e4b3e417ccb5d3d8efaa37abbe78d7';
export const PERIOD = 352.03733234417444;
export const INITIAL_PHASE = 0; // The minimum-boundary, crispest-twill frame.
export const LOOP_SECONDS = 8; // The source's speed=1: one period per 8 s.
// Source desktop canvas: 760 CSS pixels across 2 simulation lattice lengths
// (framing=simulation&tiles=2). Two lattice lengths show about twelve strands
// (5.9 black/white bands per lattice length), which is where the over-and-under
// of the weave reads best: at one length only six fit and it reads as a chunky
// checkerboard, and much past four the notches stop being legible and it turns
// into houndstooth.
export const TILE_PIXELS = 760 / 2;
// So the home framing holds the source's 2 lattice lengths across the shorter
// side while that side is at most 760 CSS px, and keeps TILE_PIXELS beyond it —
// but never lets the picture get finer than 4 lattice lengths across the shorter
// side, which is what a 4K screen at device ratio 1 would otherwise do (ten
// repeats across, about forty strands). Between 760 and 1520 px the framing is
// the source's own; past 1520 it grows with the screen instead of multiplying
// the repeats.
export const scaleFor = (width, height) => {
  const shorter = Math.min(width, height);
  return Math.min(Math.max(TILE_PIXELS, shorter / 4), shorter / 2);
};
// Lattice coordinates at the screen centre (tiles/2): the lattice origin, one
// repeat away. It is the centre of the half turn that swaps the colours, the
// colour 4-fold, and a point the glide axis y = x runs through — w vanishes
// there exactly at every phase, so a black/white pivot sits at the screen centre.
export const CENTER = [1, 1];
export const MIN_SCALE = 24; // CSS pixels per lattice length; pages raise it to keep a texel per device pixel.
export const MAX_SCALE = 8000;
export const GRID_SIZE = 48;
export const FRAMES = 128;
export const UPSAMPLE = 2;
export const TEXTURE_SIZE = GRID_SIZE * UPSAMPLE;
export const FIELD_BYTES = FRAMES * 2 * GRID_SIZE * GRID_SIZE * 4;
// Which channel the half-turn difference is taken of. 'u' is the shipped rule;
// 'v' (?rule=v) is the alternate. It is not a second picture: V's twill is the
// same animation offset in time. sign(w_V(x, t)) = sign(w_U(x, t − 51/128 T)) on
// 97 % of the drawn samples, and the strands are the same width (8.07 nodes
// against 8.09). Compared at the *same* phase the two sign fields agree on only
// 21 % of samples, which is the anti-correlation a naive reading would call a
// different picture; it is a 0.4-period phase shift seen head on.
export const RULES = ['u', 'v'];
// The lag, in saved frames, at which the V rule reproduces the U rule.
export const V_LAG = 51;
// The lattice is square, so a turn settles onto a quarter of one.
export const TURN_STEP = Math.PI / 2;

// Shutter integration ("temporal anti-aliasing"). A display shows a frame for a
// whole frame interval, but the drawn frame is one instant, so anything that
// moves several pixels per frame — the twill's own boundaries, or the whole
// picture under a drag or a glide — arrives as a row of hard steps instead of a
// smear: the sample-and-hold judder that shows up on a fast motion and a 60 Hz
// screen. Each displayed frame is therefore integrated over a shutter of
// SHUTTER × the frame interval centred on the frame's own instant, as
// TAA_LAYERS equally spaced sub-samples whose *colours* are averaged. Each
// sub-sample carries both its own phase and its own view, so a pan, a zoom, a
// turn and the animation are all integrated by the same three taps. Averaging
// the field instead would only move the sharp black/white contour; averaging the
// colours lets the contour sweep across the pixels it crossed during the
// shutter, exactly as a camera would record it — and on a two-tone picture that
// is the whole of the anti-aliasing there is.
// A shutter of exactly one frame interval is the anti-aliasing filter the
// sampling calls for: consecutive frames' sub-samples then tile the timeline
// evenly, so the animation is drawn at TAA_LAYERS × the frame rate and box
// filtered down to it, and nothing between two displayed frames is left out.
// SHUTTER = 0.5 is the film convention (a 180° shutter), sharper but only half
// sampled; ?shutter= dials it, and 0 turns the integration off.
// The default is 0.3 of a frame interval — crisper than the full box filter, as
// on ../gyre/ and ../trefoil/; ?shutter=1 restores the full filter.
export const TAA_LAYERS = 3; // Up to 27 texture taps per pixel; ?taa= overrides.
export const MAX_TAA_LAYERS = 5;
export const SHUTTER = 0.3;
// The shutter costs an extra sampling of the field per sub-sample, so it is
// spent only where it can do something. MOTION_PIXELS is how wide the smear has
// to be before it is worth drawing — in CSS pixels, counting both the pattern's
// own boundaries and the view's motion — and a shutter of SHUTTER frame
// intervals smears a picture travelling `travel` pixels a frame over
// `travel × SHUTTER` of them. So the gate is on the smear, not on the travel:
// the picture must move MOTION_PIXELS / SHUTTER = 2.5 CSS px a frame at the
// shipped 0.3 shutter, and 0.75 px a frame at the full box filter ?shutter=1.
// The pattern's own motion reaches 2.5 px a frame at about 2670 CSS px per
// lattice length — against 800 px per lattice length with ?shutter=1 — so at the
// home framing (380 px per lattice length, 0.36 px a frame) the shutter is for
// the view's motion: a drag, a glide, a pinch.
// ?motion= dials it (0 keeps the shutter on whenever anything moves at all).
export const MOTION_PIXELS = 0.75;
// And the other end: a handful of sub-samples reconstructs a smear only while
// they overlap. Past about SMEAR_PIXELS apart they read as that many copies of
// the picture rather than one blur — which is what a hard fling at a hundred
// pixels a frame would produce. So the view's contribution to the shutter is
// integrated up to SMEAR_PIXELS × the sub-samples and no further: a very fast
// throw keeps some of its judder rather than turning into a comb. The pattern's
// own motion never reaches that width (7.5 px a frame at the deepest zoom, a
// 2.3 px smear), so this bounds panning and flinging only.
export const SMEAR_PIXELS = 6;
// How fast the black/white contour sweeps, in lattice lengths per period. Two
// independent measurements on the band-limited field bracket it: counting colour
// changes per point per period against boundary crossings per lattice length
// gives 0.32 on the 96-texel reconstruction grid and 0.54 at 192 nodes and 256
// instants, while the contour's own normal speed |∂w/∂t| / |∇w|, averaged over
// the neighbourhood of the contour, gives 0.37 (rms 0.61). The spread is real —
// the contour is pinned and motionless along the colour-reversing mirror lines
// and quick between them — so this is a round number in the middle of it, used
// only to decide whether the shutter is worth paying for. It turns a framing
// (CSS pixels per lattice length) into the on-screen speed of the picture's own
// motion.
export const BOUNDARY_SPEED = 0.45;
export const FALLBACK_INTERVAL = 1000 / 60; // ms, until the display's cadence is known.

export const wrap = value => value - Math.floor(value);
const mod = (value, n) => ((value % n) + n) % n;

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = layers => `
precision highp float;
precision highp int;
// Layer i of the array holds w at sub-sample i of the shutter. The view is per
// sub-sample too — uCenter[i], uScale[i], uRotation[i] — so a pan, a zoom or a
// turn is integrated exactly as the phase is. With one layer they hold the
// frame's own view and the draw is identical to one from a viewer with no
// shutter at all.
uniform highp sampler2DArray uFrame;
uniform int uLayers;
uniform vec2 uResolution;
uniform vec2 uCssSize;
uniform vec2 uCenter[${layers}];
uniform vec2 uRotation[${layers}]; // (cos, sin) of the screen-to-lattice rotation, the inverse of the view's turn
uniform float uScale[${layers}];
out vec4 color;
const float N = ${TEXTURE_SIZE}.0;
// Node i of the periodic lattice is texel i, centred at (i + 0.5) / N; the
// texture repeats, so no wrapping arithmetic is needed.
#ifdef TAPS9
float field(vec2 q, float layer) {
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
// sub-sample's own view, in lattice coordinates. Lattice x runs right and y runs
// down at angle 0, as on the source page.
vec2 latticeAt(vec2 screen, int i) {
  vec2 o = screen * uCssSize / uScale[i];
  return uCenter[i] + vec2(uRotation[i].x * o.x - uRotation[i].y * o.y, uRotation[i].y * o.x + uRotation[i].x * o.y);
}
void main() {
  vec2 screen = gl_FragCoord.xy / uResolution - .5;
  screen.y = -screen.y; // Lattice y grows downward on screen, as on the source page.
  float value = field(latticeAt(screen, 0), 0.0);
  // The edge softening is measured on the first sub-sample alone: screen-space
  // derivatives are only defined in uniform control flow, and over a shutter of
  // one frame interval the sub-samples differ by a fraction of a pixel of
  // gradient — the shutter only ever moves the picture by about a pixel, which
  // is the width this softening spans in the first place.
  float e = max(0.5 * fwidth(value), 1e-7);
  // Average the colours over the shutter, never the field: the field's average
  // still has one sharp contour, only displaced, while the colours' average
  // carries the contour across every pixel it swept.
  float sum = smoothstep(-e, e, value);
  for (int i = 1; i < uLayers; i++) sum += smoothstep(-e, e, field(latticeAt(screen, i), float(i)));
  color = vec4(vec3(sum / float(uLayers)), 1.0);
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

/** The drawn field w(x, t) = C(x, t) − C(−x, t) for every saved frame, as one
 * x-fastest volume (x, y, frame), where C is the U channel (rule 'u') or the V
 * channel (rule 'v'). Each frame is spectrally doubled first: the doubled grid
 * is closed under the half turn, and trigonometric interpolation commutes with
 * it, so the difference is taken on band-limited samples and is exact. */
export function signedVolume(planar, rule = 'u') {
  if (!RULES.includes(rule)) throw new Error(`Unknown rule: ${rule}`);
  const count = GRID_SIZE * GRID_SIZE, plane = TEXTURE_SIZE * TEXTURE_SIZE, n = TEXTURE_SIZE;
  const channel = RULES.indexOf(rule);
  const kernel = halfSampleKernel(GRID_SIZE), volume = new Float32Array(plane * FRAMES);
  for (let k = 0; k < FRAMES; k++) {
    const base = (k * 2 + channel) * count;
    const frame = upsample2(planar.subarray(base, base + count), GRID_SIZE, kernel);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      volume[k * plane + y * n + x] = frame[y * n + x] - frame[((n - y) % n) * n + (n - x) % n];
    }
  }
  return volume;
}

/** Catmull–Rom weights for a fractional position t in [0, 1). */
export const cubicWeights = t => [-.5*t + t*t - .5*t*t*t, 1 - 2.5*t*t + 1.5*t*t*t, .5*t + 2*t*t - 1.5*t*t*t, -.5*t*t + .5*t*t*t];

/** The field at one phase: periodic Catmull–Rom over the four nearest saved
 * frames, written into `out` (one TEXTURE_SIZE² plane). */
export function frameAt(volume, phase, out = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE)) {
  const plane = TEXTURE_SIZE * TEXTURE_SIZE, t = wrap(phase) * FRAMES, k = Math.floor(t);
  const [w0, w1, w2, w3] = cubicWeights(t - k);
  const a = mod(k - 1, FRAMES) * plane, b = mod(k, FRAMES) * plane, c = mod(k + 1, FRAMES) * plane, d = mod(k + 2, FRAMES) * plane;
  for (let i = 0; i < plane; i++) out[i] = w0 * volume[a + i] + w1 * volume[b + i] + w2 * volume[c + i] + w3 * volume[d + i];
  return out;
}

/** The shutter's layers as one volume, layer after layer, ready for
 * texSubImage3D: layer j is `frameAt(volume, phases[j])`. */
export function framesAt(volume, phases, out = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * phases.length)) {
  const plane = TEXTURE_SIZE * TEXTURE_SIZE;
  for (const [j, phase] of phases.entries()) frameAt(volume, phase, out.subarray(j * plane, (j + 1) * plane));
  return out;
}

/** Periodic bicubic Catmull–Rom of one plane at lattice point (x, y) in units of
 * the lattice length: the CPU twin of the shader's `field`. */
export function bicubic(plane, [x, y]) {
  const n = TEXTURE_SIZE, px = wrap(x) * n, py = wrap(y) * n;
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

/** The change from view `a` to view `b`: the lattice offset of the screen centre
 * (taken the shorter way round the periodic plane, so a pan across the wrap
 * reads as the small step it is), the log of the zoom, and the turn. */
export function viewDelta(a, b) {
  const dx = b.center[0] - a.center[0], dy = b.center[1] - a.center[1];
  return {center: [dx - Math.round(dx), dy - Math.round(dy)], zoom: Math.log(b.scale / a.scale), angle: wrapAngle(b.angle - a.angle)};
}
export const NO_MOTION = {center: [0, 0], zoom: 0, angle: 0};

/** How far a step moves the picture on screen, in CSS pixels: the pan at the
 * screen centre, plus what the turn and the zoom do at the corner of a
 * `width` × `height` canvas showing `scale` pixels per lattice length. The
 * lattice is square, so a lattice offset is already a plane offset. */
export function viewMotion(step, scale, width, height) {
  const radius = 0.5 * Math.hypot(width, height);
  return scale * Math.hypot(step.center[0], step.center[1]) + radius * (Math.abs(step.angle) + Math.abs(step.zoom));
}

/** How far the pattern's own boundaries travel on screen in `ms`, at `scale`
 * CSS pixels per lattice length: the judder the shutter exists for, when the
 * view itself is still. */
export const patternMotion = (scale, ms) => scale * BOUNDARY_SPEED * ms / (1000 * LOOP_SECONDS);

/** Angles are kept in (−π, π]. */
export const wrapAngle = angle => { const a = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI)); return a <= -Math.PI ? a + 2 * Math.PI : a; };
/** Snaps an angle to the nearest quarter turn when within `tolerance` (4° by
 * default), since the lattice is square. */
export function snapAngle(angle, tolerance = Math.PI / 45) {
  const quarter = Math.round(angle / TURN_STEP) * TURN_STEP;
  return Math.abs(wrapAngle(angle - quarter)) <= tolerance ? wrapAngle(quarter) : angle;
}

/** The viewport: which lattice point sits at the screen centre, how many CSS
 * pixels one lattice length spans, and how far the pattern is turned on screen
 * (radians, clockwise positive since screen y runs down). Lattice x runs right
 * and y runs down at angle 0, the pattern repeats every lattice length, and the
 * centre is kept wrapped into [0, 1)² so panning never loses precision.
 * `tilePixels` is either a fixed scale or a function of the canvas CSS size that
 * applies until the viewer zooms. */
export function createView({tilePixels = scaleFor, center = CENTER, angle = 0, minScale = MIN_SCALE, maxScale = MAX_SCALE, overshoot = 1} = {}) {
  if (!(minScale > 0 && maxScale >= minScale)) throw new Error('The zoom limits must be positive and ordered.');
  if (!Number.isFinite(angle)) throw new Error('The angle must be finite.');
  if (!(overshoot >= 1)) throw new Error('The elastic overshoot must be at least 1.');
  const fallback = typeof tilePixels === 'function' ? tilePixels : () => tilePixels;
  // Every hand-made change to the zoom stops dead at a limit. Only a glide may
  // pass one — by `overshoot`, for the moment it takes to spring back — so that
  // a fling arriving at the end of the zoom range says so elastically instead
  // of hitting a wall. Nothing that ends a gesture leaves the view out there.
  const clamp = (scale, elastic = false) => elastic
    ? Math.min(maxScale * overshoot, Math.max(minScale / overshoot, scale))
    : Math.min(maxScale, Math.max(minScale, scale));
  const initialScale = typeof tilePixels === 'number' ? clamp(tilePixels) : null;
  const home = [wrap(center[0]), wrap(center[1])], homeAngle = wrapAngle(angle);
  let userScale = initialScale, turn = homeAngle;
  const current = [...home];
  // Screen offset (CSS pixels, y down) to lattice offset at the current scale and angle.
  const toLattice = (dx, dy, s) => { const c = Math.cos(turn), n = Math.sin(turn); return [(c * dx + n * dy) / s, (-n * dx + c * dy) / s]; };
  const view = {
    get center() { return [...current]; },
    get angle() { return turn; },
    get minScale() { return minScale; },
    get maxScale() { return maxScale; },
    get overshoot() { return overshoot; },
    get zoomed() { return userScale !== initialScale; },
    scale(width, height) { return userScale ?? clamp(fallback(width, height)); },
    isHome() { return userScale === initialScale && turn === homeAngle && current[0] === home[0] && current[1] === home[1]; },
    reset() { userScale = initialScale; turn = homeAngle; current[0] = home[0]; current[1] = home[1]; },
    latticeAt([x, y], width, height) {
      const [dx, dy] = toLattice(x - width / 2, y - height / 2, view.scale(width, height));
      return [current[0] + dx, current[1] + dy];
    },
    /** Shows lattice point `lattice` at CSS pixel `point`, optionally at a new
     * scale and angle. `elastic` lets a glide stretch a zoom limit; see clamp. */
    pin(lattice, [x, y], width, height, {scale, angle, elastic = false} = {}) {
      if (scale !== undefined) userScale = clamp(scale, elastic);
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
    zoomAt(factor, point, width, height, {elastic = false} = {}) {
      view.pin(view.latticeAt(point, width, height), point, width, height, {scale: view.scale(width, height) * factor, elastic});
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
 * with it settles instead of flickering between the two states.
 *
 * `probeSoon()` asks for one lower-resolution trial at the next window (at most
 * every 30 s), used when a touch begins because phones raise their refresh rate
 * under a finger; it never touches the shutter. */
export function createGovernor({enabled = true, step = 0.85, floor = 0.5, window = 45, display = null} = {}) {
  let quality = 1, last = null, changed = 0, probe = null, ceiling = 1, ceilingUntil = 0, blockedUntil = 0, wanted = false, lastRequest = -Infinity;
  let shutter = true, shutterWait = 20000, shutterUntil = 0, shutterSince = -Infinity, clean = 0;
  if (display !== null && !(display >= 4 && display <= 200)) display = null;
  const deltas = [];
  const revert = now => { quality = probe.quality; probe = null; blockedUntil = now + 4000; changed = now; };
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
      if (last !== null) { const dt = now - last; if (dt > 2 && dt < 200) deltas.push(dt); }
      last = now;
      if (deltas.length < window) return;
      const sorted = deltas.slice().sort((a, b) => a - b);
      const fast = sorted[Math.floor(sorted.length * 0.2)];
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      deltas.length = 0;
      display = Math.max(4, display === null ? fast : Math.min(display, fast));
      if (probe) {
        if (mean < 0.85 * probe.mean) { probe = null; } // The lower resolution paid off: keep it.
        else if (probe.steps < 2 && quality > floor) { quality = Math.max(floor, quality * step); probe.steps++; changed = now; return; }
        else { display = Math.max(display, mean); revert(now); return; }
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

/** A WebGL 2 renderer for the saved orbit on `canvas`. Options: `rule` ('u' or
 * 'v'), `view` (from createView; one is created from `tilePixels`/`center`
 * otherwise), `pixelRatio` (pins the device pixel ratio and disables adaptive
 * resolution), `adaptive` (default true), `display` (the display's frame
 * interval in ms, if measured), `taa` (shutter sub-samples per displayed frame,
 * 1 to MAX_TAA_LAYERS; 1 turns the shutter off), `shutter` (the shutter's share
 * of a frame interval) and `motion` (how far the picture must move on screen
 * between frames, in CSS pixels, before the shutter is worth its cost; 0 keeps
 * it on for any motion at all). */
export function createRenderer(canvas, planar, {tilePixels = scaleFor, center = CENTER, rule = 'u', view = createView({tilePixels, center}), pixelRatio = null, adaptive = true, display = null, taa = TAA_LAYERS, shutter = SHUTTER, motion = MOTION_PIXELS} = {}) {
  if (!RULES.includes(rule)) throw new Error(`Unknown rule: ${rule}`);
  if (planar.length !== FIELD_BYTES / 4 || !planar.every(Number.isFinite)) {
    throw new Error('The pattern data is incomplete. Please reload.');
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
  const program = gl.createProgram();
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, `#version 300 es\n${linear ? '#define TAPS9\n' : ''}${fragment(maxLayers)}`)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not start the WebGL renderer.');
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.useProgram(program);
  const volume = signedVolume(planar, rule);
  const plane = TEXTURE_SIZE * TEXTURE_SIZE;
  const frame = new Float32Array(plane * maxLayers);
  // Two textures alternate so an upload never waits for the previous draw. Each
  // holds one layer per shutter sub-sample; the wrap is on the lattice axes
  // only, the third coordinate being the layer.
  const textures = [0, 1].map(() => {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R32F, TEXTURE_SIZE, TEXTURE_SIZE, maxLayers, 0, gl.RED, gl.FLOAT, framesAt(volume, shutterPhases(0, maxLayers), frame));
    return texture;
  });
  if (gl.getError() !== gl.NO_ERROR) throw new Error('The GPU rejected the pattern texture.');
  let textureIndex = 0, lastPhase = null, lastLayers = 0, lastMoving = null, layers = 1;
  let lastView = null, lastDrawTime = null, travel = 0, lastSize = null;
  // The per-sub-sample view, uploaded as three small uniform arrays.
  const centers = new Float32Array(2 * maxLayers), rotations = new Float32Array(2 * maxLayers), scales = new Float32Array(maxLayers);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.uniform1i(gl.getUniformLocation(program, 'uFrame'), 0);
  const layerLocation = gl.getUniformLocation(program, 'uLayers');
  gl.uniform1i(layerLocation, 1);
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const cssSize = gl.getUniformLocation(program, 'uCssSize');
  const centerLocation = gl.getUniformLocation(program, 'uCenter[0]');
  const rotationLocation = gl.getUniformLocation(program, 'uRotation[0]');
  const scaleLocation = gl.getUniformLocation(program, 'uScale[0]');
  const maxSize = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
  const governor = createGovernor({enabled: adaptive && pixelRatio === null, display});
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  return {
    view, rule,
    /** Texture fetches per pixel in the last draw, the shutter included. */
    get taps() { return (linear ? 9 : 16) * layers; },
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
      // A canvas that changed size is a relayout, not a motion. The framing
      // follows the shorter side (scaleFor), so a window resize, a rotated
      // phone, entering or leaving fullscreen, or an offline exporter setting a
      // new viewport all move the picture by a lot in one draw without anything
      // having travelled — and a smear across that step is a blurred frame with
      // no motion behind it. (That is exactly how a 1080 × 1080 export resized
      // to a 1200 × 630 card came out six times softer than the page.) The
      // reading resumes on the next draw, which has two draws at one size to
      // difference.
      const resized = lastSize === null || lastSize[0] !== width || lastSize[1] !== height;
      lastSize = [width, height];
      let step = paced && lastView && !resized ? viewDelta(lastView, here) : NO_MOTION;
      let viewPixels = viewMotion(step, scale, width, height);
      const patternPixels = moving ? patternMotion(scale, interval) : 0;
      // A jump — a reset, a new framing, a tab coming back — is not a motion
      // either, and must not be smeared across the screen.
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
      // is spent only where it can do something: where the smear it would draw
      // — `travel × shutter` CSS pixels — is at least `motion` wide, and never
      // on a viewer the governor has had to slow down: frame rate is not traded
      // for blur. A picture standing still is never integrated, whatever
      // `?motion=0` asks for: there is nothing there to smear.
      layers = maxLayers > 1 && shutter > 0 && governor.shutter && travel > 0 && travel * shutter >= motion ? maxLayers : 1;
      const p = wrap(phase);
      if (p !== lastPhase || layers !== lastLayers || moving !== lastMoving) {
        textureIndex ^= 1; gl.bindTexture(gl.TEXTURE_2D_ARRAY, textures[textureIndex]);
        // With the phase still — a drag, a glide, a paused page — every layer
        // holds the same instant and only the view varies across the shutter.
        const phases = moving ? shutterPhases(p, layers, interval, shutter) : new Array(layers).fill(p);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE, layers, gl.RED, gl.FLOAT, framesAt(volume, phases, frame));
        if (layers !== lastLayers) gl.uniform1i(layerLocation, layers);
        lastPhase = p; lastLayers = layers; lastMoving = moving;
      }
      // Each sub-sample reads the view it had at its own instant of the
      // shutter; with one layer that is exactly the frame's own view.
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
    dispose() { for (const texture of textures) gl.deleteTexture(texture); gl.deleteProgram(program); gl.deleteVertexArray(vao); },
  };
}
