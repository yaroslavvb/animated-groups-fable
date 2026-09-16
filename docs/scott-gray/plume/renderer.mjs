// The saved orbit wallpaper:g6:731aa45654d4d690 is a Gray–Scott rotating wave:
// 128 frames of a 48×48 periodic lattice over one period. Every frame is
// spectrally (Dirichlet-kernel) upsampled to 96×96 on load. Each displayed
// frame is then reconstructed in two cheap steps: the CPU blends the four
// nearest saved frames with periodic Catmull–Rom weights into one 96×96
// texture (37 thousand multiply-adds), and the GPU reconstructs every device
// pixel from that texture with periodic bicubic Catmull–Rom interpolation:
// nine bilinear fetches where float textures filter, sixteen point fetches
// otherwise. Against the exact band-limited reconstruction of the saved
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
export const MIN_SCALE = 24; // CSS pixels per lattice length; pages raise it to keep a texel per device pixel.
export const MAX_SCALE = 8000;
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

export const wrap = value => value - Math.floor(value);

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = `
precision highp float;
precision highp int;
uniform highp sampler2D uFrame;
uniform vec2 uResolution;
uniform vec2 uCssSize;
uniform vec2 uCenter;
uniform vec2 uRotation; // (cos, sin) of the screen-to-lattice rotation, the inverse of the view's turn
uniform float uScale;
uniform vec2 uValueRange;
uniform int uStyle;
out vec4 color;
const float N = ${TEXTURE_SIZE}.0;
// Node i of the periodic lattice is texel i, centred at (i + 0.5) / N; the
// texture repeats, so no wrapping arithmetic is needed.
#ifdef TAPS9
float field(vec2 q) {
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
  return (texture(uFrame, vec2(t0.x, t0.y)).r * w0.x + texture(uFrame, vec2(t12.x, t0.y)).r * w12.x + texture(uFrame, vec2(t3.x, t0.y)).r * w3.x) * w0.y
       + (texture(uFrame, vec2(t0.x, t12.y)).r * w0.x + texture(uFrame, vec2(t12.x, t12.y)).r * w12.x + texture(uFrame, vec2(t3.x, t12.y)).r * w3.x) * w12.y
       + (texture(uFrame, vec2(t0.x, t3.y)).r * w0.x + texture(uFrame, vec2(t12.x, t3.y)).r * w12.x + texture(uFrame, vec2(t3.x, t3.y)).r * w3.x) * w3.y;
}
#else
vec4 cubicWeights(float t) {
  float t2 = t*t, t3 = t2*t;
  return vec4(-.5*t + t2 - .5*t3, 1.0 - 2.5*t2 + 1.5*t3,
              .5*t + 2.0*t2 - 1.5*t3, -.5*t2 + .5*t3);
}
float field(vec2 q) {
  // Catmull–Rom from sixteen point fetches.
  vec2 p = fract(q) * N;
  vec2 base = floor(p);
  vec4 wx = cubicWeights(p.x - base.x), wy = cubicWeights(p.y - base.y);
  float value = 0.0;
  for (int j = 0; j < 4; j++) {
    float row = 0.0;
    for (int i = 0; i < 4; i++) row += wx[i] * texture(uFrame, (base + vec2(float(i) - 0.5, float(j) - 0.5)) / N).r;
    value += wy[j] * row;
  }
  return value;
}
#endif
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
  vec2 o = screen * uCssSize / uScale;
  vec2 q = uCenter + vec2(uRotation.x * o.x - uRotation.y * o.y, uRotation.y * o.x + uRotation.x * o.y);
  float value = field(q);
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
 * volume (x, y, frame). For the monochrome style the volume holds
 * U(x,t) − U(−x,t) instead; the doubled grid is closed under the half-turn,
 * and trigonometric interpolation commutes with it. */
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

/** Catmull–Rom weights for a fractional position t in [0, 1). */
export const cubicWeights = t => [-.5*t + t*t - .5*t*t*t, 1 - 2.5*t*t + 1.5*t*t*t, .5*t + 2*t*t - 1.5*t*t*t, -.5*t*t + .5*t*t*t];

/** The field at one phase: periodic Catmull–Rom over the four nearest saved
 * frames, written into `out` (one TEXTURE_SIZE² plane). */
export function frameAt(volume, phase, out = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE)) {
  const plane = TEXTURE_SIZE * TEXTURE_SIZE, t = wrap(phase) * FRAMES, k = Math.floor(t);
  const [w0, w1, w2, w3] = cubicWeights(t - k);
  const a = ((k - 1) % FRAMES + FRAMES) % FRAMES * plane, b = k % FRAMES * plane, c = (k + 1) % FRAMES * plane, d = (k + 2) % FRAMES * plane;
  for (let i = 0; i < plane; i++) out[i] = w0 * volume[a + i] + w1 * volume[b + i] + w2 * volume[c + i] + w3 * volume[d + i];
  return out;
}

/** Angles are kept in (−π, π]. */
export const wrapAngle = angle => { const a = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI)); return a <= -Math.PI ? a + 2 * Math.PI : a; };
/** Snaps an angle to the nearest quarter turn when within `tolerance` (4° by default), since the lattice is square. */
export function snapAngle(angle, tolerance = Math.PI / 45) {
  const quarter = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  return Math.abs(wrapAngle(angle - quarter)) <= tolerance ? wrapAngle(quarter) : angle;
}

/** The viewport: which lattice point sits at the screen centre, how many CSS
 * pixels one lattice length spans, and how far the pattern is turned on
 * screen (radians, clockwise positive since screen y runs down). Lattice x
 * runs right and y runs down at angle 0, the pattern repeats every lattice
 * length, and the centre is kept wrapped into [0, 1)² so panning never loses
 * precision. `tilePixels` is either a fixed scale or a function of the canvas
 * CSS size that applies until the viewer zooms. */
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
  const toLattice = (dx, dy, s) => { const c = Math.cos(turn), n = Math.sin(turn); return [(c * dx + n * dy) / s, (-n * dx + c * dy) / s]; };
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

/** Keeps continuous playback at the display's cadence by trading render
 * resolution. `display` seeds the display's frame interval in ms (measured
 * from idle animation frames before rendering starts). When frames arrive
 * late it lowers the quality factor a step at a time and keeps each step only
 * if the cadence actually improves, so a display that simply runs at 60 Hz is
 * not mistaken for a slow GPU; a probe that continuous drawing abandons is
 * reverted. `probeSoon()` asks for one such trial at the next window (at most
 * every 30 s), used when a touch begins because phones raise their refresh
 * rate under a finger. Quality climbs back once frames stay on time. */
export function createGovernor({enabled = true, step = 0.85, floor = 0.5, window = 45, display = null} = {}) {
  let quality = 1, last = null, changed = 0, probe = null, ceiling = 1, ceilingUntil = 0, blockedUntil = 0, wanted = false, lastRequest = -Infinity;
  if (display !== null && !(display >= 4 && display <= 200)) display = null;
  const deltas = [];
  const revert = now => { quality = probe.quality; probe = null; blockedUntil = now + 4000; changed = now; };
  const governor = {
    get quality() { return quality; },
    get display() { return display; },
    get enabled() { return enabled; },
    probeSoon(now) { if (enabled && now - lastRequest >= 30000) { wanted = true; lastRequest = now; } },
    tick(now, continuous) {
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
      if ((late || wanted) && quality > floor && now >= blockedUntil) {
        wanted = false;
        if (late) { ceiling = quality; ceilingUntil = now + 20000; }
        probe = {quality, mean, steps: 1};
        quality = Math.max(floor, quality * step); changed = now;
      } else if (!late && quality < 1 && now - changed > 2500 && mean <= 1.1 * display) {
        wanted = false;
        const next = Math.min(1, quality / step);
        if (next <= ceiling || now > ceilingUntil) { quality = next; changed = now; }
      } else wanted = false;
    },
  };
  return governor;
}

/** A WebGL 2 renderer for the saved orbit on `canvas`. Options: `style`
 * ('ember' or 'monochrome'), `view` (from createView; one is created from
 * `tilePixels`/`center` otherwise), `pixelRatio` (pins the device pixel ratio
 * and disables adaptive resolution), `adaptive` (default true) and `display`
 * (the display's frame interval in ms, if measured). */
export function createRenderer(canvas, planar, {tilePixels = scaleFor, center = CENTER, style = 'ember', view = createView({tilePixels, center}), pixelRatio = null, adaptive = true, display = null} = {}) {
  if (!STYLES.includes(style)) throw new Error(`Unknown style: ${style}`);
  if (planar.length !== FIELD_BYTES / 4 || !planar.every(Number.isFinite)) {
    throw new Error('The pattern data is incomplete. Please reload.');
  }
  if (pixelRatio !== null && !(pixelRatio > 0 && Number.isFinite(pixelRatio))) throw new Error('The pixel ratio must be a positive number.');
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
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, `#version 300 es\n${linear ? '#define TAPS9\n' : ''}${fragment}`)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not start the WebGL renderer.');
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.useProgram(program);
  const volume = upsampledVolume(planar, style);
  const frame = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
  // Two textures alternate so an upload never waits for the previous draw.
  const textures = [0, 1].map(() => {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, TEXTURE_SIZE, TEXTURE_SIZE, 0, gl.RED, gl.FLOAT, frameAt(volume, 0, frame));
    return texture;
  });
  if (gl.getError() !== gl.NO_ERROR) throw new Error('The GPU rejected the pattern texture.');
  let textureIndex = 0, lastPhase = 0;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.uniform1i(gl.getUniformLocation(program, 'uFrame'), 0);
  gl.uniform2f(gl.getUniformLocation(program, 'uValueRange'), VALUE_RANGE[0], VALUE_RANGE[1] - VALUE_RANGE[0]);
  gl.uniform1i(gl.getUniformLocation(program, 'uStyle'), STYLES.indexOf(style));
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const cssSize = gl.getUniformLocation(program, 'uCssSize');
  const centerLocation = gl.getUniformLocation(program, 'uCenter');
  const rotationLocation = gl.getUniformLocation(program, 'uRotation');
  const scaleLocation = gl.getUniformLocation(program, 'uScale');
  const maxSize = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
  const governor = createGovernor({enabled: adaptive && pixelRatio === null, display});
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  return {
    style, view, taps: linear ? 9 : 16,
    get quality() { return governor.quality; },
    get display() { return governor.display; },
    /** Call when a touch begins: the governor then tries a lower resolution once, in case the display sped up. */
    touched() { governor.probeSoon(performance.now()); },
    /** Draws the pattern at `phase`. Pass continuous=true from an animation
     * loop so the adaptive resolution can read the frame cadence. */
    draw(phase, {continuous = false} = {}) {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!(width > 0 && height > 0)) return;
      governor.tick(performance.now(), continuous);
      // Native device pixels (times the quality factor), with hardware limits and a 32-megapixel ceiling.
      const ratio = Math.min((pixelRatio ?? devicePixelRatio ?? 1) * governor.quality, maxSize / width, maxSize / height, Math.sqrt(33554432 / (width * height)));
      const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      const p = wrap(phase);
      if (p !== lastPhase) {
        textureIndex ^= 1; gl.bindTexture(gl.TEXTURE_2D, textures[textureIndex]);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE, gl.RED, gl.FLOAT, frameAt(volume, p, frame));
        lastPhase = p;
      }
      const [cx, cy] = view.center, angle = view.angle;
      gl.uniform2f(resolution, w, h); gl.uniform2f(cssSize, width, height);
      gl.uniform2f(centerLocation, cx, cy); gl.uniform1f(scaleLocation, view.scale(width, height));
      gl.uniform2f(rotationLocation, Math.cos(angle), -Math.sin(angle)); // screen-to-lattice turns the other way
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() { for (const texture of textures) gl.deleteTexture(texture); gl.deleteProgram(program); gl.deleteVertexArray(vao); },
  };
}
