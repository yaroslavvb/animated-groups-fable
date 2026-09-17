// Trefoil: three colours whose 3-cycle is free and whose *swaps* are welded to
// a half-turn and half a period.
//
// The saved orbit wallpaper:g225:8fcde9bc1178d93d (= wallpaper:g247:8fcde9…,
// "Interwoven sixth-cycle wave") is a Gray–Scott rotating wave on a hexagonal
// lattice: 96 frames of a 66×66 periodic lattice over one period T, planar U
// then V, x fastest, float32 little-endian. It is the very field ../triskele/
// and ../gyre/ paint, byte for byte — only the rule that colours it differs.
//
// Let b = (1/3, 2/3) in lattice coordinates: the step from one class of
// threefold centres of the lattice L to the next. 3b = a₁ + 2a₂ lies in L, so
// L′ = L + ℤb is the index-3 triangular superlattice of *all* threefold
// centres, 1/√3 as long and turned 30°. Paint each point by whichever of its
// three L′-translates leads, all at the same instant:
//
//     colour(x, t) = argmax over k in {0, 1, 2} of U(x + k b, t).
//
// Three positions, ONE channel, ONE phase — no time offsets between the
// samples (../gyre/ reads three different phases; this rule does not).
//
// Two laws follow, of completely different character:
//
//     colour(x + b, t)     = colour(x, t) − 1   (mod 3)     purely spatial
//     colour(−x, t + T/2)  = −colour(x, t)      (mod 3)     ENTANGLED
//
// The first is immediate, since 3b ∈ L rotates the compared list one place.
// The second uses the field's own half-period half-turn, U(−x, t + T/2) =
// U(x, t): it *reverses* the list, giving the transposition that fixes colour 0
// and exchanges 1 and 2. None of its three parts is a symmetry — measured over
// all 418 176 saved node-frames, a half-turn at any centre with any recolouring
// reaches 0.494447, a T/2 shift with any translation and any recolouring the
// same 0.494447, the half-turn with T/2 but no recolouring exactly 1/3, and with
// either of the other two swaps exactly 0.
//
// The colour group is therefore S₃ = AGL(1, 3), which is NOT cyclic — and a
// non-cyclic colour group forces some non-identity recolouring to be purely
// spatial (see README, §"The theorem"). Here that is the 3-cycle; the
// transpositions are entangled, and provably cannot be had without a time
// shift: no operation of the lattice, at any centre, with any time shift the
// colour-preserving subgroup can absorb, realises a swap better than 0.540375.
//
// The texture is one 66×66 R32F plane per shutter sub-sample — the rule needs a
// single instant, so a single channel is the whole of it — and the fragment
// shader makes three bicubic fetches per sub-sample, at q, q + b and q + 2b.
export const ORBIT_ID = 'wallpaper:g225:8fcde9bc1178d93d';
export const FIELD_SHA256 = '8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c';
export const INITIAL_PHASE = 0;
export const LOOP_SECONDS = 8; // One period per 8 s, as on ../plume/, ../gyre/ and ../ember/.
export const GRID_SIZE = 66;
export const FRAMES = 96;
export const HALF = FRAMES / 2;   // 48 saved frames: T/2 is an exact frame count,
export const THIRD = FRAMES / 3;  // 32,
export const SIXTH = FRAMES / 6;  // and 16 — so every law below is exact in time.
export const FIELD_BYTES = FRAMES * 2 * GRID_SIZE * GRID_SIZE * 4;
export const SQRT3 = Math.sqrt(3);
// Home framing. The visible motif repeats on the FINER lattice L′ = L + ℤb,
// which is 1/√3 of a lattice length of L, so a motif of 380 CSS pixels — the
// apparent size every sibling page uses — is 380√3 ≈ 658 CSS pixels per lattice
// length of L, which is the unit `scale` is measured in throughout.
export const MOTIF_PIXELS = 380;
export const TILE_PIXELS = MOTIF_PIXELS * SQRT3;
export const scaleFor = (width, height) => SQRT3 * Math.min(MOTIF_PIXELS, Math.min(width, height) / 2);
// Lattice coordinates at the screen centre: the lattice origin, which is a
// threefold centre of the field, a threefold centre of the picture AND the
// half-turn centre of the entangled law. The colour there is never terracotta —
// colour 0 is the fixed point of the swap, so a terracotta origin would have to
// stay terracotta for ever — and it alternates teal and sand every half period.
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
// The default is 0.3 of a frame interval — crisper than the full box filter, at
// the user's request (17 September 2026); ?shutter=1 restores the full filter.
// Every sub-sample runs the identical kernel, so each of them obeys every law
// above exactly: the shutter averages three pictures each of which is symmetric,
// and cannot perturb the symmetry.
export const TAA_LAYERS = 3; // Up to 81 texture taps per pixel; ?taa= overrides.
export const MAX_TAA_LAYERS = 5;
export const SHUTTER = 0.3;
// The shutter costs two extra samplings of the field per pixel, so it is spent
// only where it can do something. MOTION_PIXELS is how wide the smear has to be
// before it is worth drawing — in CSS pixels, counting both the pattern's own
// boundaries and the view's motion — and a shutter of SHUTTER frame intervals
// smears a picture travelling `travel` pixels a frame over `travel × SHUTTER` of
// them. So the gate is on the smear, not on the travel: the picture must move
// MOTION_PIXELS / SHUTTER = 2.5 CSS px a frame at the shipped 0.3 shutter, and
// 0.75 px a frame at the full box filter `?shutter=1`. The pattern's own motion
// reaches 2.5 px a frame at about 2730 CSS px per lattice length (1575 px per
// motif) — against 818 px per lattice length with `?shutter=1` — so at ordinary
// framings the shutter is for the view's motion: a drag, a glide, a pinch.
// ?motion= dials it (0 keeps the shutter on whenever anything moves at all).
export const MOTION_PIXELS = 0.75;
// And the other end: a handful of sub-samples reconstructs a smear only while
// they overlap. Past about SMEAR_PIXELS apart they read as that many copies of
// the picture rather than one blur — which is what a hard fling at a hundred
// pixels a frame would produce. So the view's contribution to the shutter is
// integrated up to SMEAR_PIXELS × the sub-samples and no further: a very fast
// throw keeps some of its judder rather than turning into a comb. The pattern's
// own motion never reaches that width, so this bounds panning and gliding only.
export const SMEAR_PIXELS = 6;
// How fast the pattern's colour boundaries sweep, in lattice lengths per period,
// measured from the saved nodes: 2.946 colour changes per node per period over
// 66 × 0.1013 = 6.69 boundary crossings per lattice length. It turns a framing
// (CSS pixels per lattice length) into the on-screen speed of the picture's own
// motion. Unlike ../gyre/, this colouring has no degenerate neighbourhood
// anywhere — the three samples are always |b| = 1/√3 apart — so the figure holds
// across the whole zoom ladder instead of being an average over a flat disc and
// a fast rim.
export const BOUNDARY_SPEED = 0.44;
export const FALLBACK_INTERVAL = 1000 / 60; // ms, until the display's cadence is known.
// Terracotta, teal, sand. Every pair stays at least 24 CIELAB units apart in
// normal vision and in simulated protanopia, deuteranopia and tritanopia, and
// the three carry comparable weight: here the symmetry gives each exactly a
// third of EVERY frame, so no colour may read as the background of the others.
export const PALETTE = ['#c9563e', '#57979a', '#e2be68'];

export const wrap = value => value - Math.floor(value);
const mod = (value, n) => ((value % n) + n) % n;

/** Lattice basis of the triangular lattice, in plane coordinates (x right,
 * y down on screen, so physical y points up): a1 = (1, 0), a2 = (−1/2, −√3/2).
 * `toPlane` and `fromPlane` are inverse to each other. */
export const toPlane = ([u, v]) => [u - v / 2, -SQRT3 * v / 2];
export const fromPlane = ([x, y]) => [x - y / SQRT3, -2 * y / SQRT3];
/** The turns about the lattice origin are integer matrices in lattice
 * coordinates, so each maps every lattice grid to itself: R(u, v) = (−v, u − v)
 * is the 120° turn (anticlockwise as the picture is drawn), S = R² the 240° one
 * and H = R³ the half-turn. */
export const turn120 = ([u, v]) => [-v, u - v];
export const turn240 = ([u, v]) => [v - u, -u];
export const halfTurn = ([u, v]) => [-u, -v];
/** b, the offset between the three sampled positions: from one class of
 * threefold centres of L to the next. 3b = a1 + 2a2 is a lattice vector, and b
 * is a whole 22 and 44 of the 66 nodes, so every claim about the colouring can
 * be checked in exact integer arithmetic on the saved samples. R120 b ≡ b and
 * R180 b = −b modulo L, which is exactly why the turns act on the three colours
 * by ±1 and the colour group is Z3 ⋊ {±1} = S3. */
export const OFFSET = [1 / 3, 2 / 3];
export const OFFSET_NODES = [GRID_SIZE / 3, 2 * GRID_SIZE / 3];
/** The k-th sampled position at lattice point q: q + k b. */
export const offsetBy = ([u, v], k = 1) => [u + k * OFFSET[0], v + k * OFFSET[1]];

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = layers => `
precision highp float;
precision highp int;
// Layer i of the array holds the field at sub-sample i of the shutter — one
// number per node, since the rule reads a single instant. The view is per
// sub-sample too — uCenter[i], uScale[i], uRotation[i] — so a pan, a zoom or a
// turn is integrated exactly as the phase is. With one layer they hold the
// frame's own view and the draw is identical to one from a viewer with no
// shutter at all.
uniform highp sampler2DArray uFrame;
uniform int uLayers;
uniform vec2 uResolution;
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
// The three numbers the colouring compares at lattice point q, all at the SAME
// instant: the field at q, q + b and q + 2b, where b = (1/3, 2/3) steps from one
// threefold centre of the lattice to the next.
//
//     value_k(x) = field(x + k b),      colour = argmax_k value_k.
//
// Since 3b is a lattice vector and the texture wraps, the list compared at
// x + b is the list compared at x rotated one place: colour(x + b) = colour(x)
// − 1, with no time shift and for any reconstruction filter. The positions are
// built one from the last so that both sides of that law evaluate the same
// float expressions.
const vec2 B = vec2(0.33333333333333333, 0.66666666666666667);
vec3 weights(vec2 q, float layer) {
  vec2 q1 = q + B, q2 = q1 + B;
  return vec3(field(q, layer), field(q1, layer), field(q2, layer));
}
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
  for (int i = 1; i < uLayers; i++) sum += paint(weights(latticeAt(screen, i), float(i)), e);
  color = vec4(sum / float(uLayers), 1.0);
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

/** One texture plane for phase `phase`: the field at that one instant, blended
 * from the four nearest saved frames with periodic Catmull–Rom weights. The
 * rule compares three *positions* at a single instant, so one number per node
 * is the whole of what the shader needs — where ../gyre/ has to carry three
 * phases in three channels, this page uploads a quarter as many bytes. */
export function frameAt(volume, phase, out = new Float32Array(GRID_SIZE * GRID_SIZE)) {
  const count = GRID_SIZE * GRID_SIZE, t = wrap(phase) * FRAMES, k = Math.floor(t);
  const [w0, w1, w2, w3] = cubicWeights(t - k);
  const a = mod(k - 1, FRAMES) * count, b = mod(k, FRAMES) * count;
  const c = mod(k + 1, FRAMES) * count, d = mod(k + 2, FRAMES) * count;
  for (let i = 0; i < count; i++) {
    out[i] = w0 * volume[a + i] + w1 * volume[b + i] + w2 * volume[c + i] + w3 * volume[d + i];
  }
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

/** The shutter's layers as one volume, layer after layer, ready for
 * texSubImage3D: layer j is `frameAt(volume, phases[j])`. */
export function framesAt(volume, phases, out = new Float32Array(GRID_SIZE * GRID_SIZE * phases.length)) {
  const plane = GRID_SIZE * GRID_SIZE;
  for (const [j, phase] of phases.entries()) frameAt(volume, phase, out.subarray(j * plane, (j + 1) * plane));
  return out;
}

/** The three values the colouring compares at lattice point (u, v), the CPU
 * twin of the shader's `weights`: the field at (u, v), at (u, v) + b and at
 * (u, v) + 2b, all in the same `plane` — one instant, three positions. */
export function valuesAt(plane, [u, v]) {
  const out = [0, 0, 0];
  let point = [u, v];
  for (let k = 0; k < 3; k++) { out[k] = bicubic(plane, point); point = offsetBy(point); }
  return out;
}

/** Periodic bicubic Catmull–Rom of one plane at lattice point (u, v). */
export function bicubic(plane, [u, v]) {
  const n = GRID_SIZE, x = wrap(u) * n, y = wrap(v) * n;
  const bx = Math.floor(x), by = Math.floor(y);
  const wx = cubicWeights(x - bx), wy = cubicWeights(y - by);
  let out = 0;
  for (let j = 0; j < 4; j++) {
    const row = mod(by + j - 1, n) * n;
    for (let i = 0; i < 4; i++) out += wx[i] * wy[j] * plane[row + mod(bx + i - 1, n)];
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
 * default). The picture's own point group really is C6 — the six rotations
 * about the origin are all symmetries, three of them keeping the colours and
 * three swapping a pair — so a sixth is exactly the right step to snap to. */
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
    get overshoot() { return overshoot; },
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
  const program = gl.createProgram();
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, `#version 300 es\n${linear ? '#define TAPS9\n' : ''}${fragment(maxLayers)}`)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not start the WebGL renderer.');
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.useProgram(program);
  const volume = uVolume(planar);
  const plane = GRID_SIZE * GRID_SIZE;
  const frame = new Float32Array(plane * maxLayers);
  // Two textures alternate so an upload never waits for the previous draw. Each
  // holds one layer per shutter sub-sample — a single float per node, since the
  // rule reads one instant — and wraps on the lattice axes, the third
  // coordinate being the layer.
  const textures = [0, 1].map(() => {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R32F, GRID_SIZE, GRID_SIZE, maxLayers, 0, gl.RED, gl.FLOAT, framesAt(volume, shutterPhases(0, maxLayers), frame));
    return texture;
  });
  if (gl.getError() !== gl.NO_ERROR) throw new Error('The GPU rejected the pattern texture.');
  let textureIndex = 0, lastPhase = null, lastLayers = 0, lastMoving = null, layers = 1;
  let lastView = null, lastDrawTime = null, travel = 0;
  // The per-sub-sample view, uploaded as three small uniform arrays.
  const centers = new Float32Array(2 * maxLayers), rotations = new Float32Array(2 * maxLayers), scales = new Float32Array(maxLayers);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.uniform1i(gl.getUniformLocation(program, 'uFrame'), 0);
  const layerLocation = gl.getUniformLocation(program, 'uLayers');
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
  return {
    view, palette,
    /** Texture fetches per pixel in the last draw, the shutter included. */
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
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, GRID_SIZE, GRID_SIZE, layers, gl.RED, gl.FLOAT, framesAt(volume, phases, frame));
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
        rotations[2 * j] = Math.cos(turn); rotations[2 * j + 1] = -Math.sin(turn); // screen-to-plane turns the other way
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
