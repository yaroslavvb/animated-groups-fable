// render3d.js — the 3D pane of The Folding (SPEC §5.8): a translucent thin-plastic surface whose far side and
// interior stay readable, with bold edge lines that shine through it. WebGL2, no libraries.
//
//   const R = createRenderer(canvas, { labelLayer });
//   R.setSurface({ positions: Float32Array(3n), indices: Uint32Array(3m), tint?: Uint8Array(n) })
//   R.updatePositions(Float32Array(3n))        same topology, new positions (every animation frame)
//   R.setLines([{ points: Float32Array(3k), color: [r,g,b], width /*css px*/, alpha = 1, dashed = false, xray = 0.35, loop = false }])
//   R.setMarkers([{ p: [x,y,z], color: [r,g,b], size /*css px*/, shape: 'dot'|'ring'|'square', label? }])
//   R.setFrame({ center: [x,y,z], radius }, immediate = false)    what must stay in view; eased
//   R.setStyle({ front, back, ghost, fill, opacity, background })  colours as [r,g,b] in 0..1 (or '#rrggbb'); background null = transparent
//
// The surface's tint (setSurface) is two bits per vertex (constant over each triangle): bit 0 = ghost (a kaleidoscope
// star's secondary tiles, SPEC 5.7: tint 1), bit 1 = fill (the pattern's comma filled into the sheet, motif.js
// motifTintMesh: tint 2, or 3 on a ghost tile). The colour of a triangle is front / back (by the side the eye sees),
// then ghost where bit 0 is set, then fill where bit 1 is set, on both sides alike; lighting and translucency as for
// every other part of the sheet. Default fill colour: palette.js MOTIF_FILL_3D.
//   R.render()                                 draw now
//   R.onChange(cb)                             cb() after the camera moved (once per drawn frame); returns an unsubscribe function
//   R.project([x,y,z]) -> [cssX, cssY, visible]   css px from the canvas's top left; visible = in front of the eye and inside the canvas
//   R.getView() -> { q: [x,y,z,w], zoom }      R.setView(v)      R.resetView()
//   R.resize()                                 R.dispose()
//
// Conventions. World: the plane is z = 0, x right, y up, +z toward the viewer. The triangles of the surface are
// counter-clockwise seen from +z in the flat tile; that side is the FRONT (style.front), the other the BACK.
// The view is an orientation quaternion q (world -> camera space; camera space has x right, y up, z toward the eye)
// and a zoom factor (1 = the frame sphere just fits; 0.5 … 3.2). Nothing but resetView() / setView() and the person's
// own dragging changes them: setSurface, updatePositions, setFrame and resize never touch the orientation.
//
// Calling pattern. The data setters copy what they are given (the arrays can be reused at once) and never draw;
// call R.render() after them — once per animation frame. If nobody does, the renderer draws by itself on the next
// frame, and it always redraws by itself while the camera moves (drag, momentum, zoom, eased frame, reset glide).
// The canvas is sized from its CSS box (a ResizeObserver watches it). devicePixelRatio is capped at 2, and a
// drawing buffer never exceeds 2.4 million pixels (only canvases beyond about 775 x 775 css px at dpr 2 notice).
//
// How a frame is drawn:
//   A  depth-only pass of the surface                         -> depth of the NEAREST sheet at every pixel
//   B  colour, every fragment BEHIND the nearest sheet        triangles sorted back to front on the CPU (centroid depth)
//   C  colour, the nearest sheet itself                       exact per pixel, whatever the sort says
//   D  lines: where hidden behind the nearest sheet with alpha * xray, then where visible with full alpha; markers likewise.
// Because of C the top sheet is always right: along a self-intersection line, where two sheets nearly touch, on a
// flap lying on the sheet below. So one or two overlapping sheets are exact per pixel. With exactly THREE, the two
// behind the top one are put in order per pixel too whenever they face opposite ways — a sheet folded back on
// itself, the usual way two sheets come to lie almost on top of each other (the stencil buffer counts the sheets
// and remembers which way the farthest one faces; see drawNow; those extra passes run only while a coarse probe
// on the CPU finds three sheets somewhere in the picture). Only from four sheets on does the order of the
// hidden ones rest on the CPU sort alone. That sort can be wrong, faintly (it is seen through the top sheet),
// where hidden sheets nearly coincide and their triangles do not line up — dev/render-demo.html?shape=zigzag&crossed=1
// shows it. Mesh advice for the fold modules:
//   · layers stacked on purpose: give every layer the same triangulation (the mirror image of the base cell's, as
//     a kaleidoscope lifts it), so that stacked triangles coincide; then the stack sorts exactly;
//   · flat pieces that must look flat: do not share vertices across a sharp crease (normals are smooth across
//     shared vertices; the shader falls back to the face normal when the two disagree by more than ~20-35 degrees);
//   · the 16-bit depth key and the centroid sort like small triangles: a triangle should not span the whole scene.
// Lines and markers are pulled toward the eye by about their own width before the hidden / visible test, so a line
// lying ON a sheet is visible, and so is one lying a hair's breadth under it. Every pixel of a line is tested at the
// depth of the nearest point of its centre line (continuous along the polyline), so a line lying along a folded edge
// does not turn bold and grey segment by segment.
//
// Additions to the SPEC (all optional):
//   viewFromAzEl(azDeg, elDeg, zoom = 1) -> view;  R.setView also takes { az, el, zoom? } in degrees.
//     az = 0, el = 55 is the default view; el = 90 looks straight down the z axis with +y up-screen;
//     the camera sits at azimuth az, measured from the -y direction, counter-clockwise seen from +z.
//   R.resetView(immediate = false)   glides (0.35 s) unless immediate.  Keys on the focused canvas: arrows turn,
//     + / - zoom, Home or 0 resets. Two fingers: pinch zooms, twist rolls about the line of sight.
//   line.dash = [on, off] in WORLD units overrides the default dash pattern. Dashes are painted on the surface:
//     their length is a world length (period = 0.055 x the frame radius given by the first or the last immediate
//     setFrame, i.e. about 2.5 % of the smaller canvas side at zoom 1); it does not crawl while the camera or the
//     frame moves, and it grows with the zoom.
//   marker.alpha (default 1), marker.xray (default 0.45).
//   A label sits in one of eight spots round its marker, chosen every frame so that it covers as little of the lines
//     (and of the other markers and labels) as it can, preferably on the side facing away from the centre of the
//     frame, always inside the canvas; it keeps its spot until another is clearly better (hysteresis) and glides to
//     the new one in 0.16 s. (See chooseLabelSpots. Cost per frame: about 0.1 ms for the app's scenes, about 1 ms
//     for 10 labels crowded by 40 polylines of 100 segments each; R.stats.labelsMs has the last frame's.)
//   R.stats = { triangles, vertices, segments, normalsMs, sortMs, probeMs, labelsMs, cpuMs, frames, threeSheets }
//     the last drawn frame: its CPU costs in ms (normals, sort, layer probe, labels, everything), and whether the
//     passes for three overlapping sheets ran
//   R.ok (false when WebGL2 is unavailable: every method is then a harmless no-op), R.canvas, R.gl
//   createRenderer(canvas, { labelLayer, fast: true })   never run the passes for three sheets (3 passes over the
//     surface instead of 5 while three sheets are in view): a knob for a GPU that cannot keep up
//   Labels are <span class="r3d-label"> children of labelLayer (restyle them with CSS; the defaults have zero specificity).
//
// Handled by the renderer itself (SPEC 8, contract C4):
//   Reduced motion. While the page asks for it (prefers-reduced-motion: reduce, followed live), nothing moves by
//     itself: no momentum after a drag or a key, the reset (button, double-tap, 0 / Home) and the eased camera frame
//     jump straight to their end, the zoom takes its value at once (no spring, no elastic overshoot at its limits),
//     an arrow key turns the view by its whole step at once, and a label moving to another spot jumps there. What the
//     caller animates (the fold's playback) is the caller's. createRenderer(canvas, { reducedMotion: true | false })
//     overrides the media query; R.reducedMotion says which applies.
//   Lost WebGL context. While the browser has taken the context away, the marker labels are hidden and a one-line
//     message (role="status", class "r3d-message") lies over the canvas, in the canvas's parent element; when the
//     context comes back, everything is uploaded again and drawn, the message goes and the labels return. R.lost.
//   Accessibility. Unless the page set them already, the canvas gets role="application", aria-roledescription="3D view"
//     and an aria-label that names the keys (arrows turn, + and - zoom, 0 or Home resets) besides the gestures.

import { SURFACE_FRONT, SURFACE_BACK, SURFACE_GHOST, SURFACE_OPACITY, MOTIF_FILL_3D, GROUND, INK, MUTED, hexToRgb } from './palette.js';

const DEG = Math.PI / 180;
const FOV_Y = 28 * DEG;            // vertical field of view
const DEFAULT_AZ = 0, DEFAULT_EL = 55;
const FIT_MARGIN = 1.1;            // the frame sphere fills 1/1.1 of the smaller canvas dimension at zoom 1
const ZOOM_MIN = 0.5, ZOOM_MAX = 3.2;
const ZOOM_OVER = Math.log(1.05);  // how far past a zoom limit the picture can be pushed before it springs back
const ZOOM_W0 = 24, ZOOM_ZETA = 0.75;   // zoom spring: natural frequency (rad/s), damping ratio (slight overshoot)
const SPIN_TAU = 0.13;             // s; rotation momentum is gone (5 %) after 3 tau ~ 0.4 s
const FRAME_TAU = 0.16;            // s; easing of setFrame
const RESET_DUR = 0.35;            // s; resetView glide
const MAX_DPR = 2;
const MAX_PIXELS = 2.4e6;          // drawing-buffer budget (reached only by canvases beyond ~775 x 775 css px at dpr 2)
const LINE_STRIDE = 22;            // floats per line segment instance
const MARKER_STRIDE = 10;          // floats per marker instance
const DASH_PERIOD = 0.055;         // default dash period, in units of the reference frame radius
const MARKER_XRAY = 0.45;
const ARIA_LABEL = 'Fold in 3D. Drag or arrow keys to turn; scroll, pinch, + or − to zoom; double-tap, 0 or Home to reset.';
const LOST_TEXT = 'The 3D view paused: the browser reset its graphics.';

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers (no DOM, no GL) — exported at the bottom as __test for test/render3d.test.js.

function qMul(a, b, out = [0, 0, 0, 1]) {   // a∘b: apply b first, then a
  const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}
function qAxisAngle(x, y, z, ang, out = [0, 0, 0, 1]) {
  const l = Math.hypot(x, y, z);
  if (!(l > 0) || !Number.isFinite(ang)) { out[0] = out[1] = out[2] = 0; out[3] = 1; return out; }
  const s = Math.sin(ang / 2) / l;
  out[0] = x * s; out[1] = y * s; out[2] = z * s; out[3] = Math.cos(ang / 2);
  return out;
}
function qNormalize(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!(l > 0) || !Number.isFinite(l)) { q[0] = q[1] = q[2] = 0; q[3] = 1; return q; }
  q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
  return q;
}
function qSlerp(a, b, t, out = [0, 0, 0, 1]) {
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let c = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (c < 0) { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let ka, kb;
  if (c > 0.9995) { ka = 1 - t; kb = t; } else {
    const th = Math.acos(c), s = Math.sin(th);
    ka = Math.sin((1 - t) * th) / s; kb = Math.sin(t * th) / s;
  }
  out[0] = ka * a[0] + kb * bx; out[1] = ka * a[1] + kb * by; out[2] = ka * a[2] + kb * bz; out[3] = ka * a[3] + kb * bw;
  return qNormalize(out);
}
/** Rotation matrix of the unit quaternion q, row-major into out[0..8]. */
function qToMat3(q, out) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  out[0] = 1 - 2 * (y * y + z * z); out[1] = 2 * (x * y - w * z); out[2] = 2 * (x * z + w * y);
  out[3] = 2 * (x * y + w * z); out[4] = 1 - 2 * (x * x + z * z); out[5] = 2 * (y * z - w * x);
  out[6] = 2 * (x * z - w * y); out[7] = 2 * (y * z + w * x); out[8] = 1 - 2 * (x * x + y * y);
  return out;
}

/**
 * The view that looks at the scene from azimuth az and elevation el (degrees): the eye sits in the direction
 * (sin az · cos el, −cos az · cos el, sin el) from the frame centre, with the z axis up-screen.
 * az = 0, el = 55 is the default; el = 90 is the plan view (+x right, +y up).
 */
export function viewFromAzEl(azDeg = DEFAULT_AZ, elDeg = DEFAULT_EL, zoom = 1) {
  const qz = qAxisAngle(0, 0, 1, -azDeg * DEG);
  const qx = qAxisAngle(1, 0, 0, (elDeg - 90) * DEG);
  return { q: qNormalize(qMul(qx, qz)), zoom };
}

/**
 * Camera matrices (column-major Float32Array(16), as WebGL wants them) for orientation q, zoom, the frame sphere
 * and the canvas aspect ratio. Fills and returns `out`.
 */
function cameraMatrices(q, zoom, center, radius, aspect, out) {
  const rot = qToMat3(q, out.rot);
  const half = FOV_Y / 2;
  const fitHalf = Math.min(half, Math.atan(Math.tan(half) * aspect));
  const dist = radius * FIT_MARGIN / Math.sin(fitHalf) / zoom;
  const near = Math.max(dist - 4 * radius, dist * 0.04), far = dist + 4 * radius;
  const cx = center[0], cy = center[1], cz = center[2];
  const v = out.view;
  v[0] = rot[0]; v[1] = rot[3]; v[2] = rot[6]; v[3] = 0;
  v[4] = rot[1]; v[5] = rot[4]; v[6] = rot[7]; v[7] = 0;
  v[8] = rot[2]; v[9] = rot[5]; v[10] = rot[8]; v[11] = 0;
  v[12] = -(rot[0] * cx + rot[1] * cy + rot[2] * cz);
  v[13] = -(rot[3] * cx + rot[4] * cy + rot[5] * cz);
  v[14] = -(rot[6] * cx + rot[7] * cy + rot[8] * cz) - dist;
  v[15] = 1;
  const f = 1 / Math.tan(half), p = out.proj;
  p.fill(0);
  p[0] = f / aspect; p[5] = f; p[10] = (far + near) / (near - far); p[11] = -1; p[14] = 2 * far * near / (near - far);
  const pv = out.pv;   // proj * view (proj is sparse)
  for (let c = 0; c < 4; c++) {
    const x = v[4 * c], y = v[4 * c + 1], z = v[4 * c + 2], w = v[4 * c + 3];
    pv[4 * c] = p[0] * x; pv[4 * c + 1] = p[5] * y; pv[4 * c + 2] = p[10] * z + p[14] * w; pv[4 * c + 3] = -z;
  }
  out.dist = dist; out.near = near; out.far = far;
  return out;
}
function makeCamera() {
  return { rot: new Float64Array(9), view: new Float32Array(16), proj: new Float32Array(16), pv: new Float32Array(16), dist: 1, near: 0.1, far: 10 };
}

/** Area-weighted vertex normals (not normalised: the vertex shader does that). */
function accumulateNormals(pos, tri, m, nrm) {
  nrm.fill(0);
  for (let j = 0, e = 3 * m; j < e; j += 3) {
    const a = 3 * tri[j], b = 3 * tri[j + 1], c = 3 * tri[j + 2];
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const ux = pos[b] - ax, uy = pos[b + 1] - ay, uz = pos[b + 2] - az;
    const vx = pos[c] - ax, vy = pos[c + 1] - ay, vz = pos[c + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz;
    nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz;
    nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
  }
  return nrm;
}

function makeSortScratch(n, m) {
  return { vdep: new Float32Array(n), tdep: new Float32Array(m), key: new Uint16Array(m), count: new Uint32Array(65537) };
}
/**
 * Triangles in back-to-front order along the direction (zx, zy, zz) (= the camera-space z axis in world
 * coordinates; larger = nearer the eye). One 16-bit counting sort on the centroid depth: O(n + m), stable.
 */
function sortTriangles(pos, n, tri, m, zx, zy, zz, s, out) {
  const vdep = s.vdep, tdep = s.tdep, key = s.key, count = s.count;
  for (let i = 0, j = 0; i < n; i++, j += 3) vdep[i] = zx * pos[j] + zy * pos[j + 1] + zz * pos[j + 2];
  let lo = Infinity, hi = -Infinity;
  for (let t = 0, j = 0; t < m; t++, j += 3) {
    const d = vdep[tri[j]] + vdep[tri[j + 1]] + vdep[tri[j + 2]];
    tdep[t] = d;
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  const scale = hi > lo ? 65535 / (hi - lo) : 0;
  count.fill(0);
  for (let t = 0; t < m; t++) {
    const k = ((tdep[t] - lo) * scale) | 0;   // NaN -> 0
    key[t] = k;
    count[k + 1]++;
  }
  for (let i = 0; i < 65536; i++) count[i + 1] += count[i];
  for (let t = 0, j = 0; t < m; t++, j += 3) {
    const p = 3 * count[key[t]]++;
    out[p] = tri[j]; out[p + 1] = tri[j + 1]; out[p + 2] = tri[j + 2];
  }
  return out;
}

const PROBE = 32;                  // the layer probe looks through PROBE x PROBE points of the canvas
function makeProbeScratch(n) {
  return { gx: new Float32Array(n), gy: new Float32Array(n), cnt: new Uint8Array(PROBE * PROBE) };
}
/**
 * How many of the PROBE x PROBE probe points of the canvas look through exactly `want` sheets of the surface?
 * (pv: the proj * view matrix.) A coarse CPU rasteriser: every triangle is tested against the probe points inside
 * its bounding box only, so the cost is O(n + m). The points sit off the grid lines by irrational-looking
 * fractions, so that no regular mesh has its edges running through them.
 */
function probeSheets(pos, n, tri, m, pv, want, s) {
  const gx = s.gx, gy = s.gy, cnt = s.cnt, S = PROBE, half = 0.5 * S;
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    const x = pos[j], y = pos[j + 1], z = pos[j + 2];
    const w = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
    if (w > 1e-9) {
      gx[i] = ((pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / w + 1) * half - 0.6373;    // probe point i sits at gx = i
      gy[i] = ((pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / w + 1) * half - 0.2911;
    } else gx[i] = NaN;
  }
  cnt.fill(0);
  for (let j = 0, e = 3 * m; j < e; j += 3) {
    const a = tri[j], b = tri[j + 1], c = tri[j + 2];
    const ax = gx[a], bx = gx[b], cx = gx[c];
    let x0 = Math.ceil(Math.min(ax, bx, cx)), x1 = Math.floor(Math.max(ax, bx, cx));
    if (!(x1 >= x0)) continue;                     // no probe column in its bounding box (or a vertex behind the eye: NaN)
    const ay = gy[a], by = gy[b], cy = gy[c];
    let y0 = Math.ceil(Math.min(ay, by, cy)), y1 = Math.floor(Math.max(ay, by, cy));
    if (!(y1 >= y0)) continue;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 >= S) x1 = S - 1; if (y1 >= S) y1 = S - 1;
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const e0 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
        const e1 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
        const e2 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
        if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) cnt[py * S + px]++;
      }
    }
  }
  let hits = 0;
  for (let i = 0; i < S * S; i++) if (cnt[i] === want) hits++;
  return hits;
}

/** x inside [lo, hi] is returned as is; outside, it saturates smoothly at most `over` beyond the limit. */
function softLimit(x, lo, hi, over) {
  if (x > hi) return hi + over * (1 - Math.exp(-(x - hi) / over));
  if (x < lo) return lo - over * (1 - Math.exp(-(lo - x) / over));
  return x;
}

/**
 * Pack polylines into per-segment instances: prev(3) a(3) b(3) next(3) rgba(4) [width, xray, sA, sB] [dashOn, dashPeriod].
 * prev === a / next === b marks a free end (round cap); otherwise the joint is shared out between the two segments.
 * sA, sB: arc length (world) at the two ends. Consecutive duplicate points and non-finite points are dropped.
 *   dashUnit   reference length for the default dash pattern (the frame radius)
 *   pxWorld    world length of one css px at zoom 1 (to keep dashes longer than the line is wide)
 * state = { data: Float32Array, pts: Float32Array, cum: Float32Array } is grown as needed; returns the segment count.
 */
function packLines(lines, dashUnit, pxWorld, state) {
  let cap = 0, longest = 0;
  for (const L of lines) {
    const k = L && L.points ? (L.points.length / 3) | 0 : 0;
    cap += k; if (k > longest) longest = k;
  }
  if (state.data.length < cap * LINE_STRIDE) state.data = new Float32Array(Math.max(cap * LINE_STRIDE, state.data.length * 2));
  if (state.pts.length < longest * 3) { state.pts = new Float32Array(longest * 3 * 2); state.cum = new Float32Array(longest * 2 + 1); }
  const data = state.data, P = state.pts, cum = state.cum;
  let o = 0;
  for (const L of lines) {
    if (!L || !L.points) continue;
    const src = L.points, n = (src.length / 3) | 0;
    const width = L.width == null ? 3 : +L.width, alpha = L.alpha == null ? 1 : +L.alpha;
    if (!(n > 0) || !(width > 0) || !(alpha > 0)) continue;
    const col = L.color || INK_RGB, xray = L.xray == null ? 0.35 : +L.xray;
    // distinct, finite points and cumulative length
    let k = 0;
    for (let i = 0, j = 0; i < n; i++, j += 3) {
      const x = src[j], y = src[j + 1], z = src[j + 2];
      if (!Number.isFinite(x + y + z)) continue;
      if (k > 0) {
        const dx = x - P[3 * k - 3], dy = y - P[3 * k - 2], dz = z - P[3 * k - 1], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1e-20) continue;
        cum[k] = cum[k - 1] + Math.sqrt(d2);
      } else cum[0] = 0;
      P[3 * k] = x; P[3 * k + 1] = y; P[3 * k + 2] = z; k++;
    }
    if (k === 0) continue;
    let loop = !!L.loop && k >= 3, total = cum[k - 1];
    if (loop) {
      const dx = P[0] - P[3 * k - 3], dy = P[1] - P[3 * k - 2], dz = P[2] - P[3 * k - 1], d = Math.hypot(dx, dy, dz);
      if (d < 1e-10) { k--; total = cum[k]; loop = k >= 3; } else total += d;   // a repeated closing point
    }
    let on = 0, period = 0;
    if (L.dashed || L.dash) {
      const wWorld = width * pxWorld;
      if (L.dash && L.dash[0] > 0 && L.dash[1] > 0) { period = L.dash[0] + L.dash[1]; on = L.dash[0] - wWorld; } else {
        period = Math.max(DASH_PERIOD * dashUnit, 3.2 * wWorld); on = 0.55 * period - wWorld;
      }
      if (loop && total > 0) { const f = total / Math.max(1, Math.round(total / period)) / period; period *= f; on *= f; }  // a whole number of dashes
      on = Math.max(on, 0.02 * period);
      if (!(period > 0)) { on = 0; period = 0; }
    }
    const segs = k === 1 ? 1 : (loop ? k : k - 1);
    for (let i = 0; i < segs; i++) {
      const ia = i, ib = k === 1 ? 0 : (i + 1) % k;
      const ip = loop ? (i - 1 + k) % k : (i > 0 ? i - 1 : ia);
      const inx = loop ? (i + 2) % k : (i + 2 < k ? i + 2 : ib);
      data[o] = P[3 * ip]; data[o + 1] = P[3 * ip + 1]; data[o + 2] = P[3 * ip + 2];
      data[o + 3] = P[3 * ia]; data[o + 4] = P[3 * ia + 1]; data[o + 5] = P[3 * ia + 2];
      data[o + 6] = P[3 * ib]; data[o + 7] = P[3 * ib + 1]; data[o + 8] = P[3 * ib + 2];
      data[o + 9] = P[3 * inx]; data[o + 10] = P[3 * inx + 1]; data[o + 11] = P[3 * inx + 2];
      data[o + 12] = col[0]; data[o + 13] = col[1]; data[o + 14] = col[2]; data[o + 15] = alpha;
      data[o + 16] = width; data[o + 17] = xray; data[o + 18] = cum[i]; data[o + 19] = ib === 0 && k > 1 ? total : (k === 1 ? 0 : cum[ib]);
      data[o + 20] = on; data[o + 21] = period;
      o += LINE_STRIDE;
    }
  }
  return o / LINE_STRIDE;
}

// ---- marker labels (pure; screen space: css px from the canvas's top left, y down) ----
//
// A label sits in one of eight spots round its marker — east, north-east, north, … counter-clockwise on the screen
// (spot k at the angle k·45°) — with its box LABEL_GAP px clear of the marker's rim. Every spot is scored:
//   · lines: 2 · Σ alpha · width · ∫ K along the line (dashed lines × 0.6), where K = 1 at points within the line's
//     half width + the label's halo (LABEL_PAD) of the text box, then drops to 0.3 within 1.5 px and to 0 at
//     LABEL_CLEAR px further: a bold edge straight across a label costs about its area, one across a corner about
//     0.4 of it, one passing close by a little (a label likes some room); the score changes continuously as a line
//     slides toward the label;
//   · the area of the (haloed) box over other markers × 3, over the labels placed before it × 3, outside the
//     canvas (less LABEL_MARGIN) × 8;
//   · a preference for the side facing away from the centre of the frame on the screen: up to a quarter of the
//     box's area for the side facing the centre (it fades out for a marker near that centre);
//   · a faint preference for the usual places of a label (upper right first), which only breaks ties.
// The lowest score wins, with hysteresis: a label leaves its spot only for one better by 13 % of its area plus
// 10 % of the old spot's score — a bold line reaching its box moves it, a line passing by or a turn of the view
// that leaves it sideways does not (only facing the centre does) — and only once it has wanted to move for 50 ms
// (LABEL_WAIT: a line sweeping across it in a few frames is let by, not chased round the marker), so it does not
// flicker or hop to and fro while the view turns or the shape moves. The renderer forgets the old spot (chooses
// afresh, at once) when the label is new or comes back into view, when its marker jumped by more than 12 % of the
// canvas, when the view turned by more than 20° at once, or after a pause of 250 ms.
const LABEL_GAP = 3;               // css px between a marker's rim and its label's box
const LABEL_PAD = 2;               // the label's halo: a line this close to the text box counts as covering it
const LABEL_CLEAR = 6;             // ... and its weight falls to 0 over this many px more
const LABEL_NEAR = 0.3;            // (first steeply, to this, within 1.5 px)
const LABEL_MARGIN = 2;            // css px a label keeps from the edges of the canvas
const LABEL_GLIDE = 0.16;          // s: a label that changes its spot glides there round its marker
const LABEL_WAIT = 50;             // ms a label must have wanted another spot before it moves (fresh choices: at once)
const LABEL_SPOTS = 8;
const LABEL_TIE = [1, 0, 3, 4, 5, 7, 6, 2];   // rank of the spots E NE N NW W SW S SE when everything else is equal
const LABEL_W = { lines: 2, markers: 3, labels: 3, outside: 8, away: 0.25, tie: 0.004, keepArea: 0.13, keepScore: 0.1, wait: LABEL_WAIT };

/**
 * The top left corner (out[0], out[1]) of a w x h label round a marker of radius r at (mx, my), at the angle `ang`
 * (radians, counter-clockwise from east on the screen). At the eight spots (multiples of 45°) the box's nearest
 * point lies exactly r + LABEL_GAP from the marker's centre — its corner on the diagonals, the middle of its side
 * on the axes; in between it moves continuously (a label gliding to another spot goes round the marker).
 */
function labelBox(mx, my, r, w, h, ang, out) {
  const ux = Math.cos(ang), uy = -Math.sin(ang), d = r + LABEL_GAP;
  const sx = Math.max(-1, Math.min(1, ux * Math.SQRT2)), sy = Math.max(-1, Math.min(1, uy * Math.SQRT2));
  out[0] = mx + d * ux - 0.5 * w * (1 - sx);
  out[1] = my + d * uy - 0.5 * h * (1 - sy);
  return out;
}

/** Length of the part of the segment (ax, ay)–(bx, by) that lies in the box [x0, x1] x [y0, y1] (Liang–Barsky). */
function clipLength(ax, ay, bx, by, x0, y0, x1, y1) {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  if (dx === 0) { if (ax < x0 || ax > x1) return 0; } else {
    let ta = (x0 - ax) / dx, tb = (x1 - ax) / dx;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (!(t1 > t0)) return 0;
  }
  if (dy === 0) { if (ay < y0 || ay > y1) return 0; } else {
    let ta = (y0 - ay) / dy, tb = (y1 - ay) / dy;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (!(t1 > t0)) return 0;
  }
  return (t1 - t0) * Math.sqrt(dx * dx + dy * dy);
}

/**
 * K at the point (px, py): 1 within e of the box [x0, x1] x [y0, y1] (the stroke is on the label or its halo), then
 * falling steeply to LABEL_NEAR within 1.5 px and on to 0 at e + c: a line close by counts, but far less than one on
 * the label. Continuous.
 */
function coverKernel(px, py, x0, y0, x1, y1, e, c) {
  const qx = x0 - px > 0 ? x0 - px : (px - x1 > 0 ? px - x1 : 0), qy = y0 - py > 0 ? y0 - py : (py - y1 > 0 ? py - y1 : 0);
  const d2 = qx * qx + qy * qy, eo = e + c;
  if (d2 <= e * e) return 1;
  if (d2 >= eo * eo) return 0;
  const d = Math.sqrt(d2) - e;
  return d < 1.5 ? 1 - (1 - LABEL_NEAR) * d / 1.5 : LABEL_NEAR * (c - d) / (c - 1.5);
}
/**
 * How much of a line covers a label: ∫ K along the segment (ax, ay)–(bx, by), K = coverKernel. Simpson's rule
 * over the part of the segment within e + c of the box: continuous in the segment's position, and exact where K is
 * constant or linear along it (a line parallel to a side). A segment of length 0 (a dot) counts as 2e long.
 */
function lineCover(ax, ay, bx, by, x0, y0, x1, y1, e, c) {
  const eo = e + c, dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return 2 * e * coverKernel(ax, ay, x0, y0, x1, y1, e, c);
  let t0 = 0, t1 = 1;                                  // the part within e + c (Liang–Barsky)
  if (dx === 0) { if (ax < x0 - eo || ax > x1 + eo) return 0; } else {
    let ta = (x0 - eo - ax) / dx, tb = (x1 + eo - ax) / dx;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (!(t1 > t0)) return 0;
  }
  if (dy === 0) { if (ay < y0 - eo || ay > y1 + eo) return 0; } else {
    let ta = (y0 - eo - ay) / dy, tb = (y1 + eo - ay) / dy;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (!(t1 > t0)) return 0;
  }
  const tm = 0.5 * (t0 + t1);
  const sum = coverKernel(ax + t0 * dx, ay + t0 * dy, x0, y0, x1, y1, e, c) + 4 * coverKernel(ax + tm * dx, ay + tm * dy, x0, y0, x1, y1, e, c) +
    coverKernel(ax + t1 * dx, ay + t1 * dy, x0, y0, x1, y1, e, c);
  return sum / 6 * (t1 - t0) * Math.sqrt(dx * dx + dy * dy);
}

function overlapArea(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
  const w = Math.min(ax1, bx1) - Math.max(ax0, bx0), h = Math.min(ay1, by1) - Math.max(ay0, by0);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The packed line segments (packLines' data, `count` of them) on a W x H css-px canvas seen through pv (proj * view):
 * out.segs gets [ax, ay, bx, by, hw, weight] per segment — the ends in css px, hw = half the width, weight = alpha
 * (× 0.6 for a dashed line). A segment with an end behind the eye is left out. Returns the number written.
 */
function projectSegments(data, count, pv, W, H, out) {
  if (!out.segs || out.segs.length < 6 * count) out.segs = new Float32Array(Math.max(6 * count, out.segs ? 2 * out.segs.length : 0));
  const s = out.segs;
  let k = 0;
  for (let i = 0, o = 0; i < count; i++, o += LINE_STRIDE) {
    const ax = data[o + 3], ay = data[o + 4], az = data[o + 5], bx = data[o + 6], by = data[o + 7], bz = data[o + 8];
    const aw = pv[3] * ax + pv[7] * ay + pv[11] * az + pv[15], bw = pv[3] * bx + pv[7] * by + pv[11] * bz + pv[15];
    if (!(aw > 1e-6 && bw > 1e-6)) continue;
    s[k] = ((pv[0] * ax + pv[4] * ay + pv[8] * az + pv[12]) / aw * 0.5 + 0.5) * W;
    s[k + 1] = (0.5 - (pv[1] * ax + pv[5] * ay + pv[9] * az + pv[13]) / aw * 0.5) * H;
    s[k + 2] = ((pv[0] * bx + pv[4] * by + pv[8] * bz + pv[12]) / bw * 0.5 + 0.5) * W;
    s[k + 3] = (0.5 - (pv[1] * bx + pv[5] * by + pv[9] * bz + pv[13]) / bw * 0.5) * H;
    s[k + 4] = 0.5 * data[o + 16];
    s[k + 5] = data[o + 15] * (data[o + 21] > 0 ? 0.6 : 1);
    if (!Number.isFinite(s[k] + s[k + 1] + s[k + 2] + s[k + 3])) continue;
    k += 6;
  }
  return k / 6;
}

function makeLabelScratch() {
  return { segs: new Float32Array(0), near: new Int32Array(64), box: [0, 0], sc: new Float64Array(LABEL_SPOTS) };
}

/**
 * Choose the spot of every label (see the comment above LABEL_GAP), in order: each one avoids those before it.
 *   items[i] = { x, y, r, w, h, mark, prev, fresh }   its marker's centre and radius and the label's size (css px),
 *              mark = the index of its own marker in `marks`, prev = the spot it had (-1: none), fresh = choose
 *              without hysteresis.  Sets .cand (the spot, 0..7), .score, .box = [x0, y0, x1, y1] (unclamped) and
 *              .scores (the eight scores; NaN for those not computed because the label kept its spot early).
 *              .wish (ms) is when the label began to want another spot (-1: it does not); keep it for the next call.
 *   segs, nSegs    projectSegments' output        marks, nMarks: [x, y, r] per marker on the screen (r <= 0: not shown)
 *   W, H           the canvas (css px)            cx, cy: the centre of the frame on the screen
 *   now            the time in ms (for LABEL_WAIT)
 */
function chooseLabelSpots(items, nItems, segs, nSegs, marks, nMarks, W, H, cx, cy, scratch, now = 0) {
  const box = scratch.box, sc = scratch.sc, P = LABEL_PAD, C = LABEL_CLEAR, Wt = LABEL_W;
  const fade = 0.1 * Math.min(W, H);
  if (scratch.near.length < nSegs) scratch.near = new Int32Array(Math.max(nSegs, 2 * scratch.near.length));
  const near = scratch.near;
  for (let i = 0; i < nItems; i++) {
    const it = items[i], w = it.w, h = it.h, A = w * h, d = it.r + LABEL_GAP;
    // the segments that can reach one of the eight boxes
    const rx = d + w + P + C, ry = d + h + P + C;
    let nn = 0;
    for (let s = 0, o = 0; s < nSegs; s++, o += 6) {
      const ax = segs[o], ay = segs[o + 1], bx = segs[o + 2], by = segs[o + 3], e = segs[o + 4];
      if ((ax < bx ? ax : bx) - e > it.x + rx || (ax > bx ? ax : bx) + e < it.x - rx ||
        (ay < by ? ay : by) - e > it.y + ry || (ay > by ? ay : by) + e < it.y - ry || !(segs[o + 5] > 0)) continue;
      near[nn++] = o;
    }
    // away from the centre of the frame
    let ox = it.x - cx, oy = it.y - cy;
    const ol = Math.sqrt(ox * ox + oy * oy);
    const u = fade > 0 ? Math.min(1, ol / fade) : 1, f = u * u * (3 - 2 * u);
    if (ol > 0) { ox /= ol; oy /= ol; }
    // The spot it has is scored first: every term of a score is >= 0, so when that score is below the hysteresis
    // margin no other spot can beat it by the margin, and the label stays without scoring the other seven.
    const p = it.prev, keep = !it.fresh && p >= 0 && p < LABEL_SPOTS;
    const scores = it.scores || (it.scores = new Float64Array(LABEL_SPOTS));
    scores.fill(NaN);
    let best = 0, bestScore = Infinity, pScore = Infinity;
    for (let q = keep ? -1 : 0; q < LABEL_SPOTS; q++) {
      const k = q < 0 ? p : q;
      if (q >= 0 && keep && k === p) continue;
      const ang = k * Math.PI / 4;
      labelBox(it.x, it.y, it.r, w, h, ang, box);
      const x0 = box[0], y0 = box[1], x1 = x0 + w, y1 = y0 + h;
      let s = Wt.outside * (A - overlapArea(x0, y0, x1, y1, LABEL_MARGIN, LABEL_MARGIN, W - LABEL_MARGIN, H - LABEL_MARGIN));
      for (let j = 0; j < nn; j++) {
        const o = near[j], hw = segs[o + 4], e = hw + P, eo = e + C;
        const ax = segs[o], ay = segs[o + 1], bx = segs[o + 2], by = segs[o + 3];
        if ((ax < bx ? ax : bx) > x1 + eo || (ax > bx ? ax : bx) < x0 - eo || (ay < by ? ay : by) > y1 + eo || (ay > by ? ay : by) < y0 - eo) continue;
        s += Wt.lines * segs[o + 5] * 2 * hw * lineCover(ax, ay, bx, by, x0, y0, x1, y1, e, C);
      }
      const px0 = x0 - P, py0 = y0 - P, px1 = x1 + P, py1 = y1 + P;
      for (let m = 0; m < nMarks; m++) {
        const mr = marks[3 * m + 2] + 1;
        if (m === it.mark || !(mr > 1)) continue;
        s += Wt.markers * overlapArea(px0, py0, px1, py1, marks[3 * m] - mr, marks[3 * m + 1] - mr, marks[3 * m] + mr, marks[3 * m + 1] + mr);
      }
      for (let l = 0; l < i; l++) { const b = items[l].box; s += Wt.labels * overlapArea(px0, py0, px1, py1, b[0], b[1], b[2], b[3]); }
      s += A * (Wt.away * f * 0.5 * (1 - (Math.cos(ang) * ox - Math.sin(ang) * oy)) + Wt.tie * LABEL_TIE[k]);
      sc[k] = s; scores[k] = s;
      if (s < bestScore) { bestScore = s; best = k; }
      if (q < 0) { pScore = s; if (s * (1 - Wt.keepScore) < Wt.keepArea * A) break; }
    }
    // Hysteresis, and patience: a label that wants to move does so only once it has wanted to for LABEL_WAIT ms,
    // so a line that sweeps across it quickly (an edge passing during a fold) is let by instead of being chased.
    if (keep && best !== p) {
      if (pScore - bestScore < Wt.keepArea * A + Wt.keepScore * pScore) { best = p; it.wish = -1; } else {
        if (!(it.wish >= 0) || !(now >= it.wish)) it.wish = now;
        if (now - it.wish < Wt.wait) best = p; else it.wish = -1;
      }
    } else it.wish = -1;
    it.cand = best; it.score = sc[best];
    labelBox(it.x, it.y, it.r, w, h, best * Math.PI / 4, box);
    if (!it.box) it.box = [0, 0, 0, 0];
    it.box[0] = box[0]; it.box[1] = box[1]; it.box[2] = box[0] + w; it.box[3] = box[1] + h;
  }
  return items;
}

function toRgb(c, fallback) {
  if (typeof c === 'string') { try { const v = hexToRgb(c); if (v.every(Number.isFinite)) return v; } catch (e) { /* fall through */ } return fallback; }
  if (c && c.length >= 3 && Number.isFinite(c[0] + c[1] + c[2])) return [+c[0], +c[1], +c[2]];
  return fallback;
}
const INK_RGB = hexToRgb(INK);

// ---------------------------------------------------------------------------------------------------------------
// Shaders

const SURF_VS = `#version 300 es
invariant gl_Position;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in float aTint;
uniform mat4 uProj, uView;
out vec3 vN;
out vec3 vV;
out float vTint;
void main() {
  vec4 mv = uView * vec4(aPos, 1.0);
  float l = length(aNrm);
  vN = mat3(uView) * (l > 0.0 ? aNrm / l : vec3(0.0, 0.0, 1.0));
  vV = -mv.xyz;
  vTint = aTint;
  gl_Position = uProj * mv;
}`;

// The passes that only write depth and stencil: the same positions (invariant), nothing to shade.
const DEPTH_VS = `#version 300 es
invariant gl_Position;
layout(location=0) in vec3 aPos;
uniform mat4 uProj, uView;
void main() {
  vec4 mv = uView * vec4(aPos, 1.0);
  gl_Position = uProj * mv;
}`;
const DEPTH_FS = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(0.0); }`;
// One triangle that covers the canvas (to rewrite the stencil buffer in one go).
const FULL_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Thin plastic: two-sided, soft light fixed to the camera, a small highlight, and an opacity that rises toward
// grazing angles (a sheet seen edge-on is a longer path through the material).
const SURF_FS = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vV;
in float vTint;
uniform vec3 uFront, uBack, uGhost, uFill;
uniform float uOpacity;
out vec4 o;
void main() {
  vec3 v = normalize(vV);
  float nl = length(vN);                            // < 1 where the vertex normals of this triangle disagree
  vec3 n = nl > 0.0 ? vN / nl : v;
  if (dot(n, v) < 0.0) n = -n;                      // light the side that faces the eye
  // The true normal of this triangle (it always faces the eye). Where the smooth vertex normal cannot be trusted
  // — it strays more than ~20-35 degrees from the triangle's own normal, or the vertex normals cancel each other:
  // a sharp crease between flat pieces that share vertices, a sheet folded flat on itself — the triangle's own
  // normal takes over, so creased meshes are shaded flat instead of as if they were round.
  vec3 f = cross(dFdx(vV), dFdy(vV));
  float fl = length(f);
  if (fl > 0.0) { f /= fl; n = normalize(mix(f, n, smoothstep(0.82, 0.94, dot(n, f)) * smoothstep(0.75, 0.93, nl))); }
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  // tint = ghost + 2 fill (see the top of the file): bit 0 the star's secondary tiles, bit 1 the comma's fill
  float tq = floor(vTint + 0.5);
  vec3 base = mix(gl_FrontFacing ? uFront : uBack, uGhost, mod(tq, 2.0));
  base = mix(base, uFill, step(1.5, tq));
  const vec3 L = vec3(-0.3665, 0.5864, 0.7224);     // key light, up and to the left of the eye
  float dif = 0.5 + 0.5 * dot(n, L);
  float graze = pow(1.0 - ndv, 2.2);
  vec3 col = base * (0.74 + 0.30 * dif) * (1.0 - 0.32 * graze);
  float spec = pow(max(dot(n, normalize(L + v)), 0.0), 70.0) * 0.17;
  float a = clamp(uOpacity + (0.97 - uOpacity) * graze + 0.5 * spec, 0.0, 1.0);
  col = min(col + spec, vec3(1.0));
  o = vec4(col * a, a);
}`;

// A polyline is drawn as one screen-space quad per segment. The fragment shader measures the distance to the
// segment (round caps, anti-aliased) and gives every pixel around a joint to exactly one of the two segments that
// meet there, so a translucent (x-ray, faded) line has no beads where its segments overlap.
const LINE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;   // x: 0 = end A, 1 = end B; y: -1 | +1 side
layout(location=1) in vec3 aPrev;
layout(location=2) in vec3 aA;
layout(location=3) in vec3 aB;
layout(location=4) in vec3 aNext;
layout(location=5) in vec4 aColor;
layout(location=6) in vec4 aParam;    // width (css px), xray, arc length at A, at B
layout(location=7) in vec2 aDash;     // on, period (world); period <= 0: solid
uniform mat4 uPV;
uniform vec2 uViewport;               // drawing-buffer px
uniform float uDpr;
uniform float uNear;                  // smallest clip-space w handled
uniform vec3 uBias;                   // proj[2][2], view-space bias per px of half width per unit w, constant bias
flat out vec4 vJ;                     // the two ends on screen (px)
flat out vec4 vT;                     // joint directions at A and at B (zero vector: free end)
flat out vec2 vR;                     // radius round each joint inside which the two segments share the pixels out
flat out vec4 vCol;
flat out vec4 vW;                     // half width (px), xray, arc length at A, at B
flat out vec2 vDash;
flat out vec2 vZ;                     // the (biased) depth of the two ends, NDC
vec2 toScreen(vec4 c) { return (c.xy / max(c.w, uNear) * 0.5 + 0.5) * uViewport; }
float biasedDepth(vec4 c, float hw) {
  float delta = min(uBias.y * hw * c.w + uBias.z, 0.5 * c.w);   // toward the eye, in view-space units
  return (c.z + uBias.x * delta) / (c.w - delta);
}
void main() {
  vec4 ca = uPV * vec4(aA, 1.0), cb = uPV * vec4(aB, 1.0);
  float sA = aParam.z, sB = aParam.w;
  vJ = vec4(0.0); vT = vec4(0.0); vR = vec2(0.0); vCol = aColor; vW = vec4(0.0); vDash = aDash; vZ = vec2(0.0);
  if (ca.w < uNear && cb.w < uNear) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (ca.w < uNear) { float t = (uNear - ca.w) / (cb.w - ca.w); ca = mix(ca, cb, t); sA = mix(sA, sB, t); }
  else if (cb.w < uNear) { float t = (uNear - cb.w) / (ca.w - cb.w); cb = mix(cb, ca, t); sB = mix(sB, sA, t); }
  vec2 sa = toScreen(ca), sb = toScreen(cb);
  vec2 sp = toScreen(uPV * vec4(aPrev, 1.0)), sn = toScreen(uPV * vec4(aNext, 1.0));
  const float E = 1e-3;
  float hw = max(aParam.x * uDpr * 0.5, 0.0);
  float lab = length(sb - sa), lp = length(sa - sp), ln = length(sn - sb);
  vec2 d = lab > E ? (sb - sa) / lab : vec2(1.0, 0.0);
  // At a joint the two strokes overlap out to hw / cos(turn / 2) from the joint: the inner corner. Inside that
  // radius the line through the joint that bisects the turn decides which segment owns a pixel. (Both segments
  // compute the same numbers from the same three points, so every pixel has exactly one owner.)
  vec2 tA = vec2(0.0), tB = vec2(0.0), rc = vec2(0.0);
  if (lp > E && lab > E) { vec2 t = (sa - sp) / lp + d; float tl = length(t); if (tl > 1e-2) { tA = t / tl; rc.x = hw / max(0.5 * tl, 0.3) + 1.0; } }
  if (ln > E && lab > E) { vec2 t = d + (sn - sb) / ln; float tl = length(t); if (tl > 1e-2) { tB = t / tl; rc.y = hw / max(0.5 * tl, 0.3) + 1.0; } }
  float ext = hw + 1.5;
  vec2 pos = mix(sa, sb, aCorner.x) + d * ((aCorner.x * 2.0 - 1.0) * ext) + vec2(-d.y, d.x) * (aCorner.y * ext);
  float zA = biasedDepth(ca, hw), zB = biasedDepth(cb, hw);
  gl_Position = vec4(pos / uViewport * 2.0 - 1.0, aCorner.x < 0.5 ? zA : zB, 1.0);
  vJ = vec4(sa, sb); vT = vec4(tA, tB); vR = rc; vW = vec4(hw, aParam.y, sA, sB); vZ = vec2(zA, zB);
}`;

const LINE_FS = `#version 300 es
precision highp float;
flat in vec4 vJ;
flat in vec4 vT;
flat in vec2 vR;
flat in vec4 vCol;
flat in vec4 vW;
flat in vec2 vDash;
flat in vec2 vZ;
uniform float uHidden;
out vec4 o;
void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 qa = p - vJ.xy, qb = p - vJ.zw;
  float hw = vW.x;
  vec2 ab = vJ.zw - vJ.xy;
  float len = length(ab);
  vec2 d = len > 1e-3 ? ab / len : vec2(1.0, 0.0);
  float along = dot(qa, d), across = dot(qa, vec2(-d.y, d.x));
  // The depth test (hidden pass: GREATER, visible pass: LEQUAL) sees every pixel of the stroke at the depth of the
  // nearest point of the segment's centre line — the line's own depth, continuous from segment to segment — not at
  // the depth of the camera-facing quad under it. That quad runs past both ends by its half width plus 1.5 px, so
  // its depth at an end missed the end's depth by a share of the segment's depth step, with the opposite sign on
  // the other side of every joint: a sawtooth along the line. Where a line lies on a sheet at the edge of being
  // hidden (along the folded edge of a stack), it decided visible / hidden segment by segment: a black-and-grey
  // zipper (round-3 finding 24).
  gl_FragDepth = 0.5 + 0.5 * mix(vZ.x, vZ.y, clamp(along / max(len, 1e-3), 0.0, 1.0));
  bool joinA = vR.x > 0.0, joinB = vR.y > 0.0;
  if (joinA && dot(qa, vT.xy) <= 0.0 && dot(qa, qa) < vR.x * vR.x) discard;
  if (joinB && dot(qb, vT.zw) > 0.0 && dot(qb, qb) < vR.y * vR.y) discard;
  float dist = length(vec2(along - clamp(along, 0.0, len), across));
  if (vDash.y > 0.0) {
    float pxPerS = max(len, 1e-3) / max(vW.w - vW.z, 1e-9);
    float al = along;                                // the pattern runs on past a joint, but not past a free end
    if (!joinA) al = max(al, 0.0);
    if (!joinB) al = min(al, len);
    float m = mod(vW.z + al / pxPerS, vDash.y);
    float gap = m <= vDash.x ? 0.0 : min(m - vDash.x, vDash.y - m);
    dist = max(dist, length(vec2(gap * pxPerS + abs(along - al), across)));
  }
  float alpha = vCol.a * clamp(hw + 0.5 - dist, 0.0, 1.0) * mix(1.0, vW.y, uHidden);
  if (alpha < 0.003) discard;
  o = vec4(vCol.rgb * alpha, alpha);
}`;

const MARK_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;   // -1..1
layout(location=1) in vec3 aP;
layout(location=2) in vec4 aCol;      // rgb, alpha
layout(location=3) in vec3 aShape;    // size (css px), shape (0 dot, 1 ring, 2 square), xray
uniform mat4 uPV;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uNear;
uniform vec3 uBias;
flat out vec2 vC;
flat out vec4 vCol;
flat out vec3 vS;                     // radius (px), shape, xray
void main() {
  vec4 c = uPV * vec4(aP, 1.0);
  vC = vec2(0.0); vCol = aCol; vS = vec3(0.0);
  if (c.w < uNear) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float r = aShape.x * uDpr * 0.5;
  vec2 s = (c.xy / c.w * 0.5 + 0.5) * uViewport;
  float delta = min(uBias.y * r * c.w + uBias.z, 0.5 * c.w);
  float z = (c.z + uBias.x * delta) / (c.w - delta);
  gl_Position = vec4((s + aCorner * (r + 2.0)) / uViewport * 2.0 - 1.0, z, 1.0);
  vC = s; vS = vec3(r, aShape.y, aShape.z);
}`;

const MARK_FS = `#version 300 es
precision highp float;
flat in vec2 vC;
flat in vec4 vCol;
flat in vec3 vS;
uniform float uHidden;
uniform float uDpr;
out vec4 o;
void main() {
  vec2 q = gl_FragCoord.xy - vC;
  float r = vS.x;
  bool square = vS.y > 1.5, ring = vS.y > 0.5 && !square;
  float d = square ? max(abs(q.x), abs(q.y)) : length(q);
  float R = square ? 0.86 * r : r;
  float cov = clamp(R + 0.5 - d, 0.0, 1.0);
  vec3 col;
  if (ring) {                                       // white disc with a coloured rim
    float sw = max(1.6 * uDpr, 0.36 * r);
    col = mix(vCol.rgb, vec3(1.0), clamp(R - sw + 0.5 - d, 0.0, 1.0));
  } else {                                          // coloured disc or square with a thin white rim
    float rim = max(uDpr, 0.17 * r);
    col = mix(vec3(1.0), vCol.rgb, clamp(R - rim + 0.5 - d, 0.0, 1.0));
  }
  float alpha = vCol.a * cov * mix(1.0, vS.z, uHidden);
  if (alpha < 0.003) discard;
  o = vec4(col * alpha, alpha);
}`;

const LABEL_STYLE_ID = 'r3d-label-style';
// The white halo (text-shadow) is what keeps a label legible where it lies over the comma's dark teal fill or across
// its thin outline: 8.6:1 against 3.2:1 without it, for the worst label of the app (2222 at az 120, el 20; measured in
// Chrome, dev/fill-fix/label-contrast.mjs, 10 Nov 2026). test/render3d.test.js keeps it.
const LABEL_STYLE = ':where(.r3d-label){font:600 13px/1 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
  'color:#1a1a1f;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 5px #fff;letter-spacing:0}';

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('render3d: shader does not compile: ' + log);
  }
  return s;
}
function makeProgram(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc), fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('render3d: program does not link: ' + gl.getProgramInfoLog(prog));
  const u = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(prog, i); if (info) u[info.name] = gl.getUniformLocation(prog, info.name); }
  return { prog, u };
}

// ---------------------------------------------------------------------------------------------------------------

function stubRenderer(canvas, labelLayer) {
  if (labelLayer && typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.className = 'r3d-message';
    el.style.cssText = 'position:absolute;left:0;right:0;top:40%;text-align:center;font:14px system-ui,sans-serif;color:#52514a;padding:0 16px';
    el.textContent = 'This view needs WebGL 2, which this browser does not provide.';
    labelLayer.appendChild(el);
  }
  const view = viewFromAzEl();
  const nop = () => {};
  return {
    ok: false, canvas, gl: null, stats: { triangles: 0, vertices: 0, segments: 0, normalsMs: 0, sortMs: 0, probeMs: 0, labelsMs: 0, cpuMs: 0, frames: 0, threeSheets: false },
    setSurface: nop, updatePositions: nop, setLines: nop, setMarkers: nop, setFrame: nop, setStyle: nop, render: nop,
    onChange: () => nop, project: () => [0, 0, false], getView: () => ({ q: view.q.slice(), zoom: view.zoom }),
    setView: nop, resetView: nop, resize: nop, dispose: nop, reducedMotion: false, lost: false,
  };
}

/**
 * Create the renderer on `canvas`. `labelLayer` is an element lying over the canvas (positioned; it need not have
 * the same box); marker labels are placed in it, and it is made click-through.
 * `fast: true` never runs the passes that order three overlapping sheets exactly (3 passes over the surface instead of 5).
 * `reducedMotion`: 'auto' follows the media query prefers-reduced-motion; true / false override it.
 */
export function createRenderer(canvas, { labelLayer = null, fast = false, reducedMotion = 'auto' } = {}) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: true, preserveDrawingBuffer: false });
  } catch (e) { gl = null; }
  if (!gl) return stubRenderer(canvas, labelLayer);

  // ---- state that survives a lost context (everything is re-uploaded from here) ----
  const style = { front: SURFACE_FRONT.slice(), back: SURFACE_BACK.slice(), ghost: SURFACE_GHOST.slice(), fill: MOTIF_FILL_3D.slice(), opacity: SURFACE_OPACITY, background: hexToRgb(GROUND) };
  const surf = { n: 0, m: 0, pos: new Float32Array(0), nrm: new Float32Array(0), tri: new Uint32Array(0), sorted: new Uint32Array(0),
    tint: null, scratch: null, probe: null, posDirty: false, sortDirty: false, topoDirty: false };
  const lineState = { data: new Float32Array(0), pts: new Float32Array(0), cum: new Float32Array(1), count: 0, dirty: false };
  const markState = { data: new Float32Array(0), count: 0, dirty: false, list: [] };
  const def = viewFromAzEl();
  const cam = {
    q: def.q.slice(),
    zl: 0, zlVel: 0, zlRaw: 0,             // log zoom: shown, its velocity, the (unclamped) target
    wheelAt: -1e9,                         // time of the last wheel / gesture input (the elastic limit releases after it)
    omega: [0, 0, 0], spinning: false,     // rotation momentum (rad/s, camera space)
    center: [0, 0, 0], radius: 1, tCenter: [0, 0, 0], tRadius: 1, framed: false, easing: false,
    glide: null,                           // resetView animation {q0, q1, z0, z1, t}
  };
  let dashUnit = 0;                        // reference frame radius for default dashes (first / immediate setFrame)
  const M = makeCamera();
  let cssW = 0, cssH = 0, dpr = 1, layerDX = 0, layerDY = 0;
  let camVersion = 1, emittedVersion = 0, matVersion = 0;
  const listeners = new Set();
  const stats = { triangles: 0, vertices: 0, segments: 0, normalsMs: 0, sortMs: 0, probeMs: 0, labelsMs: 0, cpuMs: 0, frames: 0, threeSheets: false };
  let lost = false, disposed = false, inDraw = false;
  let rafId = 0, lastUserRender = -1e9, lastTick = -1e9, needsDraw = false, lastAdvance = 0;
  let threeHold = 0;                       // > 0 while the passes for three overlapping sheets are switched on
  const labelEls = [];
  const lz = Math.log;
  const ZL_MIN = lz(ZOOM_MIN), ZL_MAX = lz(ZOOM_MAX);
  // reduced motion: `still` while it applies (see the top of the file)
  let motionQuery = null;
  if (reducedMotion === 'auto' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try { motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { motionQuery = null; }
  }
  let still = reducedMotion === true || (reducedMotion === 'auto' && !!(motionQuery && motionQuery.matches));

  // ---- GL objects ----
  let G = null;
  function initGL() {
    const surfP = makeProgram(gl, SURF_VS, SURF_FS), depthP = makeProgram(gl, DEPTH_VS, DEPTH_FS);
    const lineP = makeProgram(gl, LINE_VS, LINE_FS), markP = makeProgram(gl, MARK_VS, MARK_FS);
    const g = { surfP, depthP, lineP, markP };
    // surface
    g.surfVao = gl.createVertexArray();
    g.posBuf = gl.createBuffer(); g.nrmBuf = gl.createBuffer(); g.tintBuf = gl.createBuffer(); g.idxBuf = gl.createBuffer();
    gl.bindVertexArray(g.surfVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.posBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.nrmBuf); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.tintBuf); gl.vertexAttribPointer(2, 1, gl.UNSIGNED_BYTE, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.idxBuf);
    // lines
    g.cornerBuf = gl.createBuffer();
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.cornerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
    g.lineVao = gl.createVertexArray(); g.lineBuf = gl.createBuffer();
    gl.bindVertexArray(g.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.cornerBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.lineBuf);
    const LS = LINE_STRIDE * 4;
    [[1, 3, 0], [2, 3, 12], [3, 3, 24], [4, 3, 36], [5, 4, 48], [6, 4, 64], [7, 2, 80]].forEach(([loc, size, off]) => {
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, LS, off); gl.vertexAttribDivisor(loc, 1);
    });
    // markers
    g.quadBuf = gl.createBuffer();
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    g.markVao = gl.createVertexArray(); g.markBuf = gl.createBuffer();
    gl.bindVertexArray(g.markVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.quadBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.markBuf);
    const MS = MARKER_STRIDE * 4;
    [[1, 3, 0], [2, 4, 12], [3, 3, 28]].forEach(([loc, size, off]) => {
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, MS, off); gl.vertexAttribDivisor(loc, 1);
    });
    gl.bindVertexArray(null);
    g.stencil = !fast && gl.getParameter(gl.STENCIL_BITS) >= 8;
    if (g.stencil) { g.fullP = makeProgram(gl, FULL_VS, DEPTH_FS); g.fullVao = gl.createVertexArray(); }
    G = g;
    // everything has to be uploaded again
    surf.topoDirty = surf.n > 0; surf.posDirty = surf.n > 0; surf.sortDirty = surf.n > 0;
    lineState.dirty = true; markState.dirty = true;
  }

  // ---- camera ----
  function touchCamera() { camVersion++; surf.sortDirty = true; }
  function updateMatrices() {
    if (matVersion === camVersion) return;
    matVersion = camVersion;
    const aspect = cssW > 0 && cssH > 0 ? cssW / cssH : 1;
    cameraMatrices(cam.q, Math.exp(cam.zl), cam.center, Math.max(cam.radius, 1e-9), aspect, M);
  }
  function rotateBy(rx, ry, rz) {            // rotation vector (axis * angle) in camera space
    const ang = Math.hypot(rx, ry, rz);
    if (!(ang > 0)) return;
    qNormalize(qMul(qAxisAngle(rx, ry, rz, ang), cam.q, cam.q));
    touchCamera();
  }
  function zoomTarget() { return softLimit(cam.zlRaw, ZL_MIN, ZL_MAX, ZOOM_OVER); }
  function isAnimating() {
    return !!cam.glide || cam.spinning || cam.easing || Math.abs(cam.zl - zoomTarget()) > 1e-5 || Math.abs(cam.zlVel) > 1e-4 ||
      cam.zlRaw > ZL_MAX || cam.zlRaw < ZL_MIN;
  }
  /** Reduced motion: whatever is moving by itself (reset glide, momentum, zoom spring, eased frame, a gliding label) is put at its end. */
  function settleMotion() {
    const g = cam.glide;
    if (g) { cam.q = g.q1.slice(); cam.zlRaw = g.z1; cam.glide = null; }
    cam.spinning = false; cam.omega[0] = cam.omega[1] = cam.omega[2] = 0;
    cam.zlRaw = Math.min(ZL_MAX, Math.max(ZL_MIN, cam.zlRaw)); cam.zl = cam.zlRaw; cam.zlVel = 0;
    if (cam.easing) { cam.center = cam.tCenter.slice(); cam.radius = cam.tRadius; cam.easing = false; }
    for (const el of labelEls) if (el._gt >= 0) { el._gt = -1; el._ang = el._g1; }
    touchCamera(); invalidate();
  }
  function onMotionPreference() {
    const s = !!(motionQuery && motionQuery.matches);
    if (s === still) return;
    still = s;
    if (still) settleMotion();
  }
  /** Advance every camera animation to time `now` (ms). */
  function advance(now) {
    let dt = (now - lastAdvance) / 1000;
    lastAdvance = now;
    if (!(dt > 0)) return;
    if (dt > 0.05) dt = 0.05;
    let moved = false;
    if (cam.glide) {
      const g = cam.glide;
      g.t = Math.min(1, g.t + dt / RESET_DUR);
      const u = g.t * g.t * (3 - 2 * g.t);
      qSlerp(g.q0, g.q1, u, cam.q);
      cam.zl = cam.zlRaw = g.z0 + (g.z1 - g.z0) * u; cam.zlVel = 0;
      if (g.t >= 1) cam.glide = null;
      moved = true;
    } else {
      if (cam.spinning && !input.dragging) {
        const o = cam.omega, k = Math.exp(-dt / SPIN_TAU);
        let step = SPIN_TAU * (1 - k);              // exact integral of the decaying spin: the same glide at any frame rate
        if (Math.hypot(o[0], o[1], o[2]) * k < 0.02) { step = SPIN_TAU; cam.spinning = false; }   // the (invisible) rest at once
        rotateBy(o[0] * step, o[1] * step, o[2] * step);
        o[0] *= k; o[1] *= k; o[2] *= k;
        moved = true;
      }
      // the elastic zoom limit lets go once the wheel / pinch has stopped
      if ((cam.zlRaw > ZL_MAX || cam.zlRaw < ZL_MIN) && !input.pinching && now - cam.wheelAt > 140) cam.zlRaw = Math.min(ZL_MAX, Math.max(ZL_MIN, cam.zlRaw));
      const target = zoomTarget();
      if (input.pinching) { cam.zl = target; }     // fingers hold the zoom directly
      else if (still) { if (cam.zl !== target || cam.zlVel) { cam.zl = target; cam.zlVel = 0; moved = true; } }   // no spring
      else if (Math.abs(cam.zl - target) > 1e-5 || Math.abs(cam.zlVel) > 1e-4) {
        const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
        for (let i = 0; i < steps; i++) {
          cam.zlVel += (-ZOOM_W0 * ZOOM_W0 * (cam.zl - target) - 2 * ZOOM_ZETA * ZOOM_W0 * cam.zlVel) * h;
          cam.zl += cam.zlVel * h;
        }
        if (Math.abs(cam.zl - target) <= 1e-5 && Math.abs(cam.zlVel) <= 1e-4) { cam.zl = target; cam.zlVel = 0; }
        moved = true;
      }
    }
    if (cam.easing) {
      const k = 1 - Math.exp(-dt / FRAME_TAU);
      let err = 0;
      for (let i = 0; i < 3; i++) { cam.center[i] += (cam.tCenter[i] - cam.center[i]) * k; err = Math.max(err, Math.abs(cam.tCenter[i] - cam.center[i])); }
      cam.radius += (cam.tRadius - cam.radius) * k;
      err = Math.max(err, Math.abs(cam.tRadius - cam.radius));
      if (err < 2e-4 * cam.tRadius) { cam.center = cam.tCenter.slice(); cam.radius = cam.tRadius; cam.easing = false; }
      moved = true;
    }
    if (moved) { touchCamera(); needsDraw = true; }
  }

  // ---- frame loop ----
  function schedule() { if (!rafId && !lost && !disposed) rafId = requestAnimationFrame(tick); }
  function invalidate() { needsDraw = true; schedule(); }
  function tick() {
    rafId = 0;
    const now = performance.now();
    const interval = Math.min(100, now - lastTick);    // one display frame, as this machine is delivering them
    lastTick = now;
    advance(now);
    // While the caller renders every frame anyway (an animation is playing), leave the drawing to it: its
    // render() also advances the camera, so nothing is drawn twice in one frame. Take over one frame after it stops.
    if (needsDraw && now - lastUserRender > Math.max(24, 1.6 * interval)) drawNow();
    else if (lab.gliding) positionLabels(now);         // a label on its way to another spot (nothing else moves)
    if (needsDraw || isAnimating() || lab.gliding) schedule();
  }

  // ---- drawing ----
  function upload(target, buf, data, length) {
    gl.bindBuffer(target, buf);
    gl.bufferData(target, data, gl.DYNAMIC_DRAW, 0, length);   // re-specify: no stall on buffers still in flight
  }
  function drawNow() {
    if (lost || disposed || inDraw || !G) return;
    needsDraw = false;
    if (!cssW || !cssH || !canvas.width || !canvas.height) return;
    inDraw = true;
    const t0 = performance.now();
    try {
      updateMatrices();
      if (camVersion !== emittedVersion) {
        emittedVersion = camVersion;
        for (const cb of listeners) { try { cb(); } catch (e) { console.error(e); } }
        updateMatrices();
      }
      let tn = 0, ts = 0, tp = 0;
      const m = surf.m, n = surf.n;
      if (m) {
        if (surf.topoDirty) {
          gl.bindVertexArray(G.surfVao);
          gl.bindBuffer(gl.ARRAY_BUFFER, G.tintBuf);
          if (surf.tint) { gl.bufferData(gl.ARRAY_BUFFER, surf.tint, gl.STATIC_DRAW); gl.enableVertexAttribArray(2); }
          else { gl.disableVertexAttribArray(2); gl.vertexAttrib1f(2, 0); }
          gl.bindVertexArray(null);
          surf.topoDirty = false;
        }
        if (surf.posDirty) {
          const a = performance.now();
          accumulateNormals(surf.pos, surf.tri, m, surf.nrm);
          tn = performance.now() - a;
          upload(gl.ARRAY_BUFFER, G.posBuf, surf.pos, 3 * n);
          upload(gl.ARRAY_BUFFER, G.nrmBuf, surf.nrm, 3 * n);
          surf.posDirty = false; surf.sortDirty = true;
        }
        if (surf.sortDirty) {
          const a = performance.now(), r = M.rot;
          sortTriangles(surf.pos, n, surf.tri, m, r[6], r[7], r[8], surf.scratch, surf.sorted);
          ts = performance.now() - a;
          gl.bindVertexArray(G.surfVao);
          upload(gl.ELEMENT_ARRAY_BUFFER, G.idxBuf, surf.sorted, 3 * m);
          surf.sortDirty = false;
          if (G.stencil) {
            // Does any part of the picture show exactly three sheets? Only then are the extra passes worth their
            // fill. (Kept on for a while after the last sighting, so they do not flicker on and off.)
            const b = performance.now();
            if (probeSheets(surf.pos, n, surf.tri, m, M.pv, 3, surf.probe) > 0) threeHold = 40; else if (threeHold > 0) threeHold--;
            tp = performance.now() - b;
          }
        }
      }
      if (lineState.dirty) { if (lineState.count) upload(gl.ARRAY_BUFFER, G.lineBuf, lineState.data, lineState.count * LINE_STRIDE); lineState.dirty = false; }
      if (markState.dirty) { if (markState.count) upload(gl.ARRAY_BUFFER, G.markBuf, markState.data, markState.count * MARKER_STRIDE); markState.dirty = false; }

      const W = canvas.width, H = canvas.height, bg = style.background;
      gl.viewport(0, 0, W, H);
      gl.colorMask(true, true, true, true); gl.depthMask(true); gl.stencilMask(0xFF);
      if (bg) gl.clearColor(bg[0], bg[1], bg[2], 1); else gl.clearColor(0, 0, 0, 0);
      gl.clearDepth(1); gl.clearStencil(0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.STENCIL_TEST);
      gl.enable(gl.DEPTH_TEST);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);     // premultiplied alpha everywhere
      if (m) {
        const drawSurface = () => gl.drawElements(gl.TRIANGLES, 3 * m, gl.UNSIGNED_INT, 0);
        const three = G.stencil && threeHold > 0;       // three overlapping sheets somewhere: put them in exact order
        gl.bindVertexArray(G.surfVao);
        // ---- passes without colour (a minimal shader: same positions, nothing to shade) ----
        gl.useProgram(G.depthP.prog);
        gl.uniformMatrix4fv(G.depthP.u.uProj, false, M.proj); gl.uniformMatrix4fv(G.depthP.u.uView, false, M.view);
        gl.disable(gl.BLEND); gl.colorMask(false, false, false, false);
        if (three) {
          // F: which way the FARTHEST sheet faces, into stencil bit 7. (The last fragment to pass GREATER is the
          // farthest; front faces set the bit, back faces clear it. WebGL wants one reference value for both
          // faces, hence two operations and not two references.) Its depth is thrown away again.
          gl.enable(gl.STENCIL_TEST);
          gl.clearDepth(0); gl.clear(gl.DEPTH_BUFFER_BIT);
          gl.depthFunc(gl.GREATER);
          gl.stencilMask(0x80); gl.stencilFunc(gl.ALWAYS, 0x80, 0xFF);
          gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.REPLACE); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.ZERO);
          drawSurface();
          gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
          // ... and A also counts the sheets over every sample, into stencil bits 0-6
          gl.stencilMask(0x7F); gl.stencilFunc(gl.ALWAYS, 0, 0xFF); gl.stencilOp(gl.KEEP, gl.INCR, gl.INCR);
        }
        // A: depth of the nearest sheet
        gl.depthFunc(gl.LESS);
        drawSurface();
        if (three) {
          // Z: forget everything except where there are exactly three sheets (one triangle over the whole canvas).
          // Afterwards the stencil reads 0 (not three sheets), 0x03 (three; the farthest shows its back) or
          // 0x83 (three; the farthest shows its front).
          gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
          gl.stencilMask(0xFF); gl.stencilFunc(gl.NOTEQUAL, 3, 0x7F); gl.stencilOp(gl.KEEP, gl.ZERO, gl.ZERO);
          gl.useProgram(G.fullP.prog); gl.bindVertexArray(G.fullVao);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.enable(gl.DEPTH_TEST); gl.bindVertexArray(G.surfVao);
          gl.stencilMask(0); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        }
        // ---- colour ----
        const u = G.surfP.u;
        gl.useProgram(G.surfP.prog);
        gl.uniformMatrix4fv(u.uProj, false, M.proj); gl.uniformMatrix4fv(u.uView, false, M.view);
        gl.uniform3fv(u.uFront, style.front); gl.uniform3fv(u.uBack, style.back); gl.uniform3fv(u.uGhost, style.ghost);
        gl.uniform3fv(u.uFill, style.fill);
        gl.uniform1f(u.uOpacity, style.opacity);
        // B: everything behind the nearest sheet, back to front. B and C split the fragments at "two depth steps
        // behind the nearest sheet" instead of at exact equality with it, so a GPU whose depths are not
        // bit-identical from pass to pass still puts every fragment of the nearest sheet into C and nowhere else.
        gl.colorMask(true, true, true, true); gl.depthMask(false); gl.enable(gl.BLEND); gl.depthFunc(gl.GREATER);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, -2);
        if (three) {
          // Where there are exactly three sheets, two lie behind the nearest one. This draw takes, there, only the
          // faces turned the way the farthest sheet is turned; the next draw takes the faces turned the other way.
          // When the two hidden sheets face opposite ways — a sheet folded back on itself, which is how two sheets
          // usually come to lie almost on top of each other — that is their true order, per pixel, with no help
          // from the sort. (When they face the same way both fall into this draw, in sorted order; and everywhere
          // else this draw is simply the sorted pass.)   Stencil & 0x81: 0 not three, 0x01 / 0x81 three, back / front.
          gl.stencilFuncSeparate(gl.FRONT, gl.NOTEQUAL, 0x01, 0x81); gl.stencilFuncSeparate(gl.BACK, gl.GEQUAL, 0x01, 0x81);
          drawSurface();
          gl.stencilFuncSeparate(gl.FRONT, gl.EQUAL, 0x01, 0x81); gl.stencilFuncSeparate(gl.BACK, gl.LESS, 0x01, 0x81);
          drawSurface();
          gl.disable(gl.STENCIL_TEST); gl.stencilMask(0xFF);
        } else drawSurface();
        // C: the nearest sheet, exact per pixel
        gl.depthFunc(gl.LEQUAL);
        drawSurface();
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
      gl.depthMask(false); gl.enable(gl.BLEND);
      // one device px at distance w covers w * pxW world units
      const pxW = 2 * Math.tan(FOV_Y / 2) / H;
      const biasConst = 0.003 * cam.radius;
      if (lineState.count) {
        const u = G.lineP.u;
        gl.useProgram(G.lineP.prog);
        gl.uniformMatrix4fv(u.uPV, false, M.pv); gl.uniform2f(u.uViewport, W, H); gl.uniform1f(u.uDpr, dpr);
        gl.uniform1f(u.uNear, M.near * 0.5); gl.uniform3f(u.uBias, M.proj[10], 2.2 * pxW, biasConst);
        gl.bindVertexArray(G.lineVao);
        gl.depthFunc(gl.GREATER); gl.uniform1f(u.uHidden, 1);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, lineState.count);
        gl.depthFunc(gl.LEQUAL); gl.uniform1f(u.uHidden, 0);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, lineState.count);
      }
      if (markState.count) {
        const u = G.markP.u;
        gl.useProgram(G.markP.prog);
        gl.uniformMatrix4fv(u.uPV, false, M.pv); gl.uniform2f(u.uViewport, W, H); gl.uniform1f(u.uDpr, dpr);
        // a marker is pulled further toward the eye than a line, so that a sheet rising through it (a cone point
        // on a seam, a point on a double line) does not cut it in half
        gl.uniform1f(u.uNear, M.near * 0.5); gl.uniform3f(u.uBias, M.proj[10], 3.0 * pxW, 2 * biasConst);
        gl.bindVertexArray(G.markVao);
        gl.depthFunc(gl.GREATER); gl.uniform1f(u.uHidden, 1);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, markState.count);
        gl.depthFunc(gl.LEQUAL); gl.uniform1f(u.uHidden, 0);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, markState.count);
      }
      gl.bindVertexArray(null);
      gl.depthMask(true); gl.depthFunc(gl.LESS);
      placeLabels();
      stats.triangles = m; stats.vertices = n; stats.segments = lineState.count;
      stats.threeSheets = !!(m && G.stencil && threeHold > 0); stats.probeMs = tp;
      stats.normalsMs = tn; stats.sortMs = ts; stats.cpuMs = performance.now() - t0; stats.frames++;
    } finally { inDraw = false; }
  }

  // ---- labels ----
  function ensureLabelStyle() {
    if (typeof document === 'undefined' || document.getElementById(LABEL_STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = LABEL_STYLE_ID; st.textContent = LABEL_STYLE;
    (document.head || document.documentElement).appendChild(st);
  }
  // Every label element remembers: _text, its measured size _w x _h (0: measure again) and the size last used
  // _lw x _lh, its spot _cand (-1: none, choose afresh), the angle it is drawn at (_ang; while it glides to another
  // spot: from _g0 to _g1, started at _gt, else _gt = -1), its marker on the screen (_mx, _my, radius _r), since when
  // it has wanted another spot (_wish, ms; -1: it does not) and, for QA, its spot's score _score and all eight _scores.
  const lab = { scratch: makeLabelScratch(), marks: new Float32Array(0), items: [], lastTime: -1e9, lastQ: [0, 0, 0, 1], gliding: false };
  function labelEl(i) {
    let el = labelEls[i];
    if (!el) {
      el = document.createElement('span');
      el.className = 'r3d-label';
      el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;user-select:none;-webkit-user-select:none;will-change:transform';
      Object.assign(el, { _text: null, _tf: '', _shown: true, _w: 0, _h: 0, _lw: 0, _lh: 0, _cand: -1, _ang: 0, _g0: 0, _g1: 0, _gt: -1, _mx: 0, _my: 0, _r: 0, _wish: -1 });
      labelLayer.appendChild(el);
      labelEls[i] = el;
    }
    return el;
  }
  function hideLabel(el) {
    if (el._shown) { el.style.display = 'none'; el._shown = false; }
    el._cand = -1; el._gt = -1;                      // when it comes back, its spot is chosen afresh
  }
  function shownAngle(el, now) {
    if (el._gt < 0) return el._ang;
    const u = (now - el._gt) / (1000 * LABEL_GLIDE);
    if (u >= 1) { el._gt = -1; el._ang = el._g1; return el._ang; }
    const s = u <= 0 ? 0 : u * u * (3 - 2 * u);
    return el._g0 + (el._g1 - el._g0) * s;
  }
  /** Choose the spots of the labels for the frame just drawn (see chooseLabelSpots) and put the labels there. */
  function placeLabels() {
    if (!labelLayer) return;
    const t0 = performance.now();
    const list = markState.list, nm = list.length, items = lab.items;
    if (lab.marks.length < 3 * nm) lab.marks = new Float32Array(3 * nm + 12);
    const marks = lab.marks;
    let used = 0, n = 0;
    for (let i = 0; i < nm; i++) {
      const mk = list[i], pr = project(mk.p);
      marks[3 * i] = pr[0]; marks[3 * i + 1] = pr[1]; marks[3 * i + 2] = pr[2] ? 0.5 * mk.size : 0;
      if (mk.label == null || mk.label === '') continue;
      const el = labelEl(used++);
      const text = String(mk.label);
      if (el._text !== text) { el.textContent = text; el._text = text; el._w = 0; el._cand = -1; el._gt = -1; }
      if (!pr[2]) { hideLabel(el); continue; }
      if (!el._shown) { el.style.display = ''; el._shown = true; el._cand = -1; el._gt = -1; }
      const it = items[n] || (items[n] = { box: [0, 0, 0, 0] });
      it.el = el; it.x = pr[0]; it.y = pr[1]; it.r = 0.5 * mk.size; it.mark = i;
      n++;
    }
    for (let i = used; i < labelEls.length; i++) hideLabel(labelEls[i]);
    if (n) {
      // the size of a label is measured once per text (one layout for all the new ones); until the layer is laid
      // out it is estimated from the default font
      for (let i = 0; i < n; i++) {
        const it = items[i], el = it.el;
        if (!(el._w > 0)) { const w = el.offsetWidth, h = el.offsetHeight; if (w > 0 && h > 0) { el._w = w; el._h = h; } }
        it.w = el._w > 0 ? el._w : 8.5 * el._text.length + 1; it.h = el._h > 0 ? el._h : 13;
      }
      const nSegs = projectSegments(lineState.data, lineState.count, M.pv, cssW, cssH, lab.scratch);
      const c = project(cam.center), q = cam.q, p = lab.lastQ;
      const dot = Math.min(1, Math.abs(q[0] * p[0] + q[1] * p[1] + q[2] * p[2] + q[3] * p[3]));
      const afresh = t0 - lab.lastTime > 250 || 2 * Math.acos(dot) > 20 * DEG, jump = 0.12 * Math.min(cssW, cssH);
      for (let i = 0; i < n; i++) {
        const it = items[i], el = it.el;
        it.prev = el._cand; it.wish = el._wish;
        it.fresh = afresh || el._cand < 0 || Math.hypot(it.x - el._mx, it.y - el._my) > jump;
      }
      chooseLabelSpots(items, n, lab.scratch.segs, nSegs, marks, nm, cssW, cssH, c[0], c[1], lab.scratch, t0);
      for (let i = 0; i < n; i++) {
        const it = items[i], el = it.el;
        el._mx = it.x; el._my = it.y; el._r = it.r; el._lw = it.w; el._lh = it.h; el._score = it.score; el._wish = it.wish;
        (el._scores || (el._scores = new Float64Array(LABEL_SPOTS))).set(it.scores);
        if (it.cand === el._cand) continue;
        const target = it.cand * Math.PI / 4;
        if (it.fresh || still) { el._ang = target; el._gt = -1; } else {   // glide round the marker, the shorter way
          const a = shownAngle(el, t0);
          let turn = target - a;
          turn -= 2 * Math.PI * Math.round(turn / (2 * Math.PI));
          el._g0 = a; el._g1 = a + turn; el._gt = t0;
        }
        el._cand = it.cand;
      }
      lab.lastTime = t0;
      p[0] = q[0]; p[1] = q[1]; p[2] = q[2]; p[3] = q[3];
    }
    positionLabels(t0);
    stats.labelsMs = performance.now() - t0;
  }
  /** Put every shown label at its spot (or on its way there), inside the canvas. */
  function positionLabels(now) {
    let gliding = false;
    const box = lab.scratch.box;
    for (let i = 0; i < labelEls.length; i++) {
      const el = labelEls[i];
      if (!el._shown || el._cand < 0) continue;
      const ang = shownAngle(el, now);
      if (el._gt >= 0) gliding = true;
      labelBox(el._mx, el._my, el._r, el._lw, el._lh, ang, box);
      const x = Math.max(LABEL_MARGIN, Math.min(cssW - LABEL_MARGIN - el._lw, box[0]));
      const y = Math.max(LABEL_MARGIN, Math.min(cssH - LABEL_MARGIN - el._lh, box[1]));
      const tf = `translate(${(x + layerDX).toFixed(1)}px,${(y + layerDY).toFixed(1)}px)`;
      if (el._tf !== tf) { el.style.transform = tf; el._tf = tf; }
    }
    lab.gliding = gliding;
    if (gliding) schedule();
  }

  function project(p) {
    updateMatrices();
    const v = M.pv, x = p[0], y = p[1], z = p[2];
    const cx = v[0] * x + v[4] * y + v[8] * z + v[12], cy = v[1] * x + v[5] * y + v[9] * z + v[13], cw = v[3] * x + v[7] * y + v[11] * z + v[15];
    if (!(cw > 1e-9)) return [0, 0, false];
    const nx = cx / cw, ny = cy / cw;
    return [(nx * 0.5 + 0.5) * cssW, (0.5 - ny * 0.5) * cssH, nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1];
  }

  // ---- public data setters ----
  function setSurface(s) {
    const positions = s && s.positions, indices = s && s.indices;
    const n = positions ? (positions.length / 3) | 0 : 0, m = indices ? (indices.length / 3) | 0 : 0;
    if (!n || !m) { surf.n = surf.m = 0; surf.tint = null; invalidate(); return; }
    if (surf.pos.length !== 3 * n) { surf.pos = new Float32Array(3 * n); surf.nrm = new Float32Array(3 * n); }
    surf.pos.set(positions.length === 3 * n ? positions : positions.subarray(0, 3 * n));
    if (surf.tri.length !== 3 * m) { surf.tri = new Uint32Array(3 * m); surf.sorted = new Uint32Array(3 * m); }
    let bad = false;
    for (let i = 0; i < 3 * m; i++) { const v = indices[i]; if (!(v < n)) bad = true; surf.tri[i] = v < n ? v : 0; }
    if (bad) console.warn('render3d.setSurface: an index is out of range');
    if (!surf.scratch || surf.scratch.vdep.length !== n || surf.scratch.tdep.length !== m) surf.scratch = makeSortScratch(n, m);
    if (!surf.probe || surf.probe.gx.length !== n) surf.probe = makeProbeScratch(n);
    surf.tint = s.tint && s.tint.length >= n ? Uint8Array.from(s.tint.length === n ? s.tint : s.tint.subarray(0, n)) : null;
    surf.n = n; surf.m = m;
    surf.topoDirty = surf.posDirty = surf.sortDirty = true;
    invalidate();
  }
  function updatePositions(positions) {
    if (!surf.n) return;
    if (!positions || positions.length < 3 * surf.n) { console.warn('render3d.updatePositions: expected ' + 3 * surf.n + ' numbers'); return; }
    surf.pos.set(positions.length === 3 * surf.n ? positions : positions.subarray(0, 3 * surf.n));
    surf.posDirty = true;
    invalidate();
  }
  function setLines(lines) {
    const ref = dashUnit || cam.tRadius || 1;
    const minDim = Math.min(cssW, cssH) || 500;
    lineState.count = packLines(lines || [], ref, ref / (0.45 * minDim), lineState);
    lineState.dirty = true;
    invalidate();
  }
  function setMarkers(markers) {
    const list = [];
    for (const mk of markers || []) {
      if (!mk || !mk.p || !Number.isFinite(mk.p[0] + mk.p[1] + mk.p[2])) continue;
      list.push({ p: [+mk.p[0], +mk.p[1], +mk.p[2]], color: toRgb(mk.color, INK_RGB), size: mk.size > 0 ? +mk.size : 10,
        shape: mk.shape === 'ring' ? 1 : mk.shape === 'square' ? 2 : 0, label: mk.label,
        alpha: mk.alpha == null ? 1 : +mk.alpha, xray: mk.xray == null ? MARKER_XRAY : +mk.xray });
    }
    if (markState.data.length < list.length * MARKER_STRIDE) markState.data = new Float32Array(Math.max(list.length * MARKER_STRIDE, 2 * markState.data.length));
    const d = markState.data;
    list.forEach((mk, i) => {
      const o = i * MARKER_STRIDE;
      d[o] = mk.p[0]; d[o + 1] = mk.p[1]; d[o + 2] = mk.p[2];
      d[o + 3] = mk.color[0]; d[o + 4] = mk.color[1]; d[o + 5] = mk.color[2]; d[o + 6] = mk.alpha;
      d[o + 7] = mk.size; d[o + 8] = mk.shape; d[o + 9] = mk.xray;
    });
    markState.list = list; markState.count = list.length; markState.dirty = true;
    if (labelLayer && list.some((mk) => mk.label != null && mk.label !== '')) ensureLabelStyle();
    invalidate();
  }
  function setFrame(f, immediate = false) {
    if (!f || !f.center || !(f.radius > 0) || !Number.isFinite(f.center[0] + f.center[1] + f.center[2] + f.radius)) return;
    const c = [+f.center[0], +f.center[1], +f.center[2]], r = +f.radius;
    const same = cam.framed && Math.abs(r - cam.tRadius) < 1e-9 * r && Math.hypot(c[0] - cam.tCenter[0], c[1] - cam.tCenter[1], c[2] - cam.tCenter[2]) < 1e-9 * r;
    cam.tCenter = c; cam.tRadius = r;
    if (immediate || !cam.framed) {
      cam.center = c.slice(); cam.radius = r; cam.easing = false; cam.framed = true;
      dashUnit = r;
      touchCamera(); invalidate();
    } else if (still) {                    // reduced motion: the frame is taken at once (the dashes keep their length)
      if (!same || cam.easing) { cam.center = c.slice(); cam.radius = r; cam.easing = false; touchCamera(); invalidate(); }
    } else if (!same || cam.easing) {
      cam.easing = true;
      if (!lastAdvance || performance.now() - lastAdvance > 100) lastAdvance = performance.now();
      schedule();
    }
  }
  function setStyle(s) {
    if (!s) return;
    if (s.front !== undefined) style.front = toRgb(s.front, style.front);
    if (s.back !== undefined) style.back = toRgb(s.back, style.back);
    if (s.ghost !== undefined) style.ghost = toRgb(s.ghost, style.ghost);
    if (s.fill !== undefined) style.fill = toRgb(s.fill, style.fill);
    if (s.opacity !== undefined && Number.isFinite(+s.opacity)) style.opacity = Math.min(1, Math.max(0, +s.opacity));
    if (s.background !== undefined) style.background = s.background === null || s.background === 'transparent' ? null : toRgb(s.background, style.background);
    invalidate();
  }

  // ---- view ----
  function stopMotion() { cam.glide = null; cam.spinning = false; cam.omega[0] = cam.omega[1] = cam.omega[2] = 0; }
  function getView() { return { q: cam.q.slice(), zoom: Math.exp(Math.min(ZL_MAX, Math.max(ZL_MIN, cam.zlRaw))) }; }
  function setView(v) {
    if (!v) return;
    stopMotion();
    let q = null;
    if (v.q && v.q.length === 4 && Number.isFinite(v.q[0] + v.q[1] + v.q[2] + v.q[3])) q = [+v.q[0], +v.q[1], +v.q[2], +v.q[3]];
    else if (Number.isFinite(v.az) || Number.isFinite(v.el)) q = viewFromAzEl(Number.isFinite(v.az) ? v.az : DEFAULT_AZ, Number.isFinite(v.el) ? v.el : DEFAULT_EL).q;
    if (q) cam.q = qNormalize(q);
    if (v.zoom > 0 && Number.isFinite(+v.zoom)) { cam.zl = cam.zlRaw = Math.min(ZL_MAX, Math.max(ZL_MIN, lz(+v.zoom))); cam.zlVel = 0; }
    touchCamera(); invalidate();
  }
  function resetView(immediate = false) {
    stopMotion();
    if (immediate || still) { cam.q = def.q.slice(); cam.zl = cam.zlRaw = 0; cam.zlVel = 0; touchCamera(); invalidate(); return; }
    cam.glide = { q0: cam.q.slice(), q1: def.q.slice(), z0: cam.zl, z1: 0, t: 0 };
    lastAdvance = performance.now();
    invalidate();
  }

  // ---- size ----
  function resize() {
    if (disposed) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    let ratio = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, MAX_DPR);
    // a very large canvas gets fewer device pixels per css px (never fewer than one): the fill rate of an
    // integrated GPU, with 4x multisampling, is the limit there
    if (w * h * ratio * ratio > MAX_PIXELS) ratio = Math.max(1, Math.sqrt(MAX_PIXELS / (w * h)));
    const W = Math.max(1, Math.round(w * ratio)), H = Math.max(1, Math.round(h * ratio));
    const sized = canvas.width !== W || canvas.height !== H;
    if (sized) { canvas.width = W; canvas.height = H; }
    if (labelLayer) {
      const a = canvas.getBoundingClientRect(), b = labelLayer.getBoundingClientRect();
      layerDX = a.left - b.left - labelLayer.clientLeft; layerDY = a.top - b.top - labelLayer.clientTop;
    }
    placeLost();
    if (sized || w !== cssW || h !== cssH || ratio !== dpr) {
      cssW = w; cssH = h; dpr = ratio;
      for (const el of labelEls) el._w = 0;          // measure the labels again (the page's CSS may size them by the window)
      touchCamera();
      // setting the size clears the canvas: draw again in this very task, so no empty frame is ever shown
      if (stats.frames > 0) drawNow(); else invalidate();
    }
  }

  // ---- input ----
  const input = { dragging: false, pinching: false, pointers: new Map(), hist: [], tap: null, lastTap: null, pinch: null, gesture: null };
  function sensitivity() {
    const s = Math.PI / (0.85 * Math.max(1, Math.min(cssW, cssH)));
    return Math.min(0.011, Math.max(0.0045, s));       // radians per css px
  }
  function pushHist(t, rx, ry, rz) {
    const h = input.hist;
    h.push([t, rx, ry, rz]);
    while (h.length > 16 || (h.length > 1 && t - h[0][0] > 110)) h.shift();
  }
  function releaseSpin(t) {
    const h = input.hist;
    if (still || h.length < 2 || t - h[h.length - 1][0] > 70) return;     // reduced motion: the view stops with the hand
    let sx = 0, sy = 0, sz = 0;
    for (let i = 1; i < h.length; i++) { sx += h[i][1]; sy += h[i][2]; sz += h[i][3]; }
    const dt = Math.max(h[h.length - 1][0] - h[0][0], 8) / 1000;
    let ox = sx / dt, oy = sy / dt, oz = sz / dt;
    const sp = Math.hypot(ox, oy, oz);
    if (sp < 0.25) return;
    if (sp > 14) { const k = 14 / sp; ox *= k; oy *= k; oz *= k; }
    cam.omega[0] = ox; cam.omega[1] = oy; cam.omega[2] = oz; cam.spinning = true;
    lastAdvance = performance.now();
    schedule();
  }
  function pinchState() {
    const it = input.pointers.values(), a = it.next().value, b = it.next().value;
    return { dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), ang: Math.atan2(b.y - a.y, b.x - a.x), t: performance.now(), vel: 0 };
  }
  function zoomBy(dl, now) {               // add dl to the log zoom target; elastic beyond the limits
    cam.wheelAt = now; cam.glide = null;
    if (still) {                           // reduced motion: the zoom is set at once, and stops at its limits
      cam.zl = cam.zlRaw = Math.min(ZL_MAX, Math.max(ZL_MIN, cam.zlRaw + dl)); cam.zlVel = 0;
      touchCamera(); invalidate();
      return;
    }
    cam.zlRaw = Math.min(ZL_MAX + 0.6, Math.max(ZL_MIN - 0.6, cam.zlRaw + dl));
    if (!lastAdvance || now - lastAdvance > 100) lastAdvance = now;
    invalidate();
  }
  function endPinch(now) {                 // the zoom glides on a little in the direction the fingers were moving
    const p = input.pinch;
    input.pinching = false; input.pinch = null;
    if (!p) return;
    const v = !still && now - p.t < 80 ? Math.max(-3, Math.min(3, p.vel)) : 0;
    cam.zlVel = v; cam.zlRaw += 0.05 * v;
    cam.wheelAt = now - 200;               // release the elastic limit at once
  }
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (input.pointers.size >= 2) return;
    // No preventDefault here: the browser's own mousedown default gives the canvas keyboard focus without
    // drawing a focus ring (a scripted focus() would draw one). Scrolling is already off through touch-action.
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    input.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = performance.now();
    if (input.pointers.size === 1) {
      stopMotion();
      input.dragging = true; input.hist.length = 0;
      input.tap = { t: now, x: e.clientX, y: e.clientY, moved: false, type: e.pointerType };
      canvas.style.cursor = 'grabbing';
    } else {
      input.tap = null; input.lastTap = null; input.hist.length = 0;
      input.pinching = true; input.pinch = pinchState();
    }
  }
  function onPointerMove(e) {
    const p = input.pointers.get(e.pointerId);
    if (!p) return;
    const now = performance.now();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (input.pointers.size === 1) {
      const tap = input.tap;
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > (tap.type === 'mouse' ? 4 : 10)) tap.moved = true;
      if (dx || dy) {
        const s = sensitivity(), rx = dy * s, ry = dx * s;
        rotateBy(rx, ry, 0);
        pushHist(now, rx, ry, 0);
        invalidate();
      }
    } else if (input.pointers.size === 2 && input.pinch) {
      const prev = input.pinch, cur = pinchState();
      const dl = Math.log(cur.dist / prev.dist);
      let da = cur.ang - prev.ang;
      if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
      const dt = Math.max(1, cur.t - prev.t) / 1000;
      cur.vel = 0.6 * prev.vel + 0.4 * (dl / dt);
      input.pinch = cur;
      zoomBy(dl, now);
      if (da) { rotateBy(0, 0, -da); pushHist(now, 0, 0, -da); }   // twist turns the picture about the line of sight
      cam.zl = zoomTarget(); cam.zlVel = 0; touchCamera();
    }
    e.preventDefault();
  }
  function onPointerUp(e) {
    if (!input.pointers.has(e.pointerId)) return;
    input.pointers.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const now = performance.now();
    if (input.pointers.size === 1) {            // one finger of a pinch lifted: the other goes on turning
      endPinch(now);
      input.hist.length = 0;
      lastAdvance = now; schedule();
    } else if (input.pointers.size === 0) {
      endPinch(now);
      const wasDrag = input.dragging;
      input.dragging = false;
      canvas.style.cursor = 'grab';
      const tap = input.tap;
      input.tap = null;
      if (e.type === 'pointerup' && tap && !tap.moved && now - tap.t < 320) {
        const last = input.lastTap;
        if (last && now - last.t < 380 && Math.hypot(tap.x - last.x, tap.y - last.y) < 36) { input.lastTap = null; resetView(); return; }
        input.lastTap = { t: now, x: tap.x, y: tap.y };
      } else if (wasDrag && e.type === 'pointerup') releaseSpin(now);
      lastAdvance = performance.now(); schedule();
    }
  }
  function onWheel(e) {
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 30; else if (e.deltaMode === 2) d *= 300;
    d = Math.max(-240, Math.min(240, d));
    zoomBy(-d * (e.ctrlKey ? 0.011 : 0.0016), performance.now());   // ctrl+wheel = trackpad pinch in Chrome / Firefox
  }
  function onKeyDown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = 9 * DEG;
    let rx = 0, ry = 0;
    if (e.key === 'ArrowLeft') ry = -step; else if (e.key === 'ArrowRight') ry = step;
    else if (e.key === 'ArrowUp') rx = -step; else if (e.key === 'ArrowDown') rx = step;
    else if (e.key === '+' || e.key === '=') { zoomBy(Math.log(1.2), performance.now() - 200); e.preventDefault(); return; }
    else if (e.key === '-' || e.key === '_') { zoomBy(-Math.log(1.2), performance.now() - 200); e.preventDefault(); return; }
    else if (e.key === 'Home' || e.key === '0') { resetView(); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    cam.glide = null;
    if (still) { rotateBy(rx, ry, 0); invalidate(); return; }     // reduced motion: the whole step at once
    // an impulse of momentum: the turn glides in and totals `step`
    cam.omega[0] += rx / SPIN_TAU; cam.omega[1] += ry / SPIN_TAU;
    const sp = Math.hypot(cam.omega[0], cam.omega[1], cam.omega[2]);
    if (sp > 9) { const k = 9 / sp; cam.omega[0] *= k; cam.omega[1] *= k; cam.omega[2] *= k; }
    cam.spinning = true;
    if (!rafId) lastAdvance = performance.now();
    schedule();
  }
  // Safari sends trackpad pinch and rotate as gesture events; magnify and rotate may arrive as separate streams,
  // so each has its own accumulator and a field at its neutral value is left alone.
  function onGestureStart(e) { e.preventDefault(); input.gesture = { scale: 1, rot: 0 }; stopMotion(); }
  function onGestureChange(e) {
    e.preventDefault();
    if (input.pointers.size >= 2) return;        // touch pinch is already handled through pointer events
    const g = input.gesture || (input.gesture = { scale: 1, rot: 0 });
    const now = performance.now();
    if (e.scale > 0 && e.scale !== 1) { zoomBy(Math.log(e.scale / g.scale), now); g.scale = e.scale; }
    if (Number.isFinite(e.rotation) && e.rotation !== 0) { rotateBy(0, 0, -(e.rotation - g.rot) * DEG); g.rot = e.rotation; invalidate(); }
  }
  function onGestureEnd(e) { e.preventDefault(); input.gesture = null; cam.wheelAt = performance.now() - 200; schedule(); }
  function onTouchMove(e) { if (e.cancelable) e.preventDefault(); }      // belt and braces: a drag never scrolls the page
  // While the context is lost nothing can be drawn: the canvas shows nothing, so the labels go too (they would float
  // in an empty pane, and stay those of the shape shown before), and a one-line message says why.
  let lostNote = null;
  function showLost() {
    for (const el of labelEls) hideLabel(el);
    lab.gliding = false;
    if (lostNote || typeof document === 'undefined') return;
    const host = canvas.parentElement || labelLayer;
    if (!host) return;
    const el = document.createElement('p');
    el.className = 'r3d-message';
    el.setAttribute('role', 'status');
    el.textContent = LOST_TEXT;
    el.style.cssText = 'position:absolute;margin:0;padding:0 16px;box-sizing:border-box;text-align:center;pointer-events:none;' +
      `font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:${MUTED}`;
    host.appendChild(el);
    lostNote = el;
    placeLost();
  }
  function placeLost() {                   // across the canvas, a little above its middle
    const el = lostNote;
    if (!el) return;
    if (el.parentElement === canvas.parentElement) {
      el.style.left = canvas.offsetLeft + 'px'; el.style.width = canvas.offsetWidth + 'px';
      el.style.top = Math.round(canvas.offsetTop + 0.42 * canvas.offsetHeight) + 'px';
    } else { el.style.left = '0'; el.style.right = '0'; el.style.top = '42%'; }
  }
  function hideLost() { if (lostNote) { lostNote.remove(); lostNote = null; } }
  function onContextLost(e) {
    e.preventDefault();
    lost = true; G = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    showLost();
  }
  function onContextRestored() {
    lost = false;
    try { initGL(); } catch (err) { console.error(err); lost = true; return; }
    hideLost();
    stats.frames = 0;
    resize();
    drawNow();
  }

  const bound = [];
  function listen(target, type, fn, opts) { target.addEventListener(type, fn, opts); bound.push([target, type, fn, opts]); }
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.webkitUserSelect = 'none';
  canvas.style.webkitTouchCallout = 'none';
  canvas.style.webkitTapHighlightColor = 'transparent';
  canvas.style.cursor = 'grab';
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  // role application: a screen reader hands the arrow keys to the canvas (as for the plane view)
  if (!canvas.hasAttribute('role')) canvas.setAttribute('role', 'application');
  if (!canvas.hasAttribute('aria-roledescription')) canvas.setAttribute('aria-roledescription', '3D view');
  if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', ARIA_LABEL);
  if (labelLayer) labelLayer.style.pointerEvents = 'none';
  listen(canvas, 'pointerdown', onPointerDown);
  listen(canvas, 'pointermove', onPointerMove);
  listen(canvas, 'pointerup', onPointerUp);
  listen(canvas, 'pointercancel', onPointerUp);
  listen(canvas, 'lostpointercapture', onPointerUp);
  listen(canvas, 'wheel', onWheel, { passive: false });
  listen(canvas, 'keydown', onKeyDown);
  listen(canvas, 'touchmove', onTouchMove, { passive: false });
  listen(canvas, 'gesturestart', onGestureStart, { passive: false });
  listen(canvas, 'gesturechange', onGestureChange, { passive: false });
  listen(canvas, 'gestureend', onGestureEnd, { passive: false });
  listen(canvas, 'webglcontextlost', onContextLost);
  listen(canvas, 'webglcontextrestored', onContextRestored);
  if (typeof window !== 'undefined') listen(window, 'resize', resize);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => resize()); ro.observe(canvas); }
  if (motionQuery) {
    if (typeof motionQuery.addEventListener === 'function') listen(motionQuery, 'change', onMotionPreference);
    else if (typeof motionQuery.addListener === 'function') motionQuery.addListener(onMotionPreference);   // Safari < 14
  }

  initGL();
  resize();

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (ro) ro.disconnect();
    for (const [t, type, fn, opts] of bound) t.removeEventListener(type, fn, opts);
    if (motionQuery && typeof motionQuery.addEventListener !== 'function' && typeof motionQuery.removeListener === 'function') motionQuery.removeListener(onMotionPreference);
    hideLost();
    for (const el of labelEls) el.remove();
    labelEls.length = 0; listeners.clear();
    if (G && !lost) {
      for (const k of ['posBuf', 'nrmBuf', 'tintBuf', 'idxBuf', 'cornerBuf', 'lineBuf', 'quadBuf', 'markBuf']) gl.deleteBuffer(G[k]);
      for (const k of ['surfVao', 'lineVao', 'markVao', 'fullVao']) if (G[k]) gl.deleteVertexArray(G[k]);
      for (const k of ['surfP', 'depthP', 'lineP', 'markP', 'fullP']) if (G[k]) gl.deleteProgram(G[k].prog);
    }
    G = null;
  }

  return {
    ok: true, canvas, gl, stats,
    setSurface, updatePositions, setLines, setMarkers, setFrame, setStyle,
    render() {
      if (lost || disposed) return;
      const now = performance.now();
      lastUserRender = now;
      advance(now);
      drawNow();
      if (isAnimating()) schedule();
    },
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    project(p) { const r = project(p); return r; },
    getView, setView, resetView, resize, dispose,
    get reducedMotion() { return still; },
    get lost() { return lost; },
  };
}

export const __test = { qMul, qAxisAngle, qNormalize, qSlerp, qToMat3, cameraMatrices, makeCamera, accumulateNormals, makeSortScratch,
  makeProbeScratch, probeSheets, PROBE, LINE_VS, LINE_FS, SURF_VS, SURF_FS,
  sortTriangles, softLimit, packLines, LINE_STRIDE, FOV_Y, FIT_MARGIN, ZOOM_MIN, ZOOM_MAX,
  labelBox, clipLength, lineCover, projectSegments, chooseLabelSpots, makeLabelScratch, LABEL_GAP, LABEL_PAD, LABEL_CLEAR, LABEL_MARGIN, LABEL_W, LABEL_SPOTS, LABEL_WAIT,
  LABEL_STYLE };
