/* The designer's camera, and the exact silhouettes of the things it draws.
 *
 * The designer shows one period of the spacetime box: the plane spread out
 * below, time running up the page. World coordinates are (x, y, z) with x, y
 * cartesian in the plane and z = t * height, t measured in periods.
 *
 * The camera is a PERSPECTIVE one — an eye at a finite distance from a target
 * it orbits about. The view used to be orthographic, on the argument that
 * non-overlap is an equal-time condition on horizontal distances and that a
 * projection which shrinks the far side of the box makes two balls at the same
 * separation look different. That trade has gone the other way. Nothing on this
 * page is ever measured off the picture: legality is decided in world
 * coordinates by collide.js and reported by the contact markers and the status
 * lines, which is where a reader who wants a number goes. What the picture has
 * to do is read as a SOLID BOX, and under a parallel projection it does not —
 * the near wall and the far wall are the same size, so the reader supplies the
 * depth by guessing, and guesses wrong about which of two tubes is in front.
 * Converging edges settle that at a glance.
 *
 * Orbit angles are yaw and pitch, and the three screen axes are orthonormal:
 *
 *   R (screen right)   = ( cos yaw,       sin yaw,      0  )
 *   U (screen up)      = ( sin yaw sp,   -cos yaw sp,   cp )
 *   D (target -> eye)  = (-sin yaw cp,    cos yaw cp,   sp )
 *
 * with sp = sin(pitch), cp = cos(pitch). The eye and the focal length are
 *
 *   eye = target + dist * D          f = (viewport height / 2) / tan(fov / 2)
 *
 * and a world point P projects by
 *
 *   v  = P - eye,   Xc = v.R,   Yc = v.U,   Zc = -(v.D)      // depth in front
 *   screenX = centre[0] + f * Xc / Zc
 *   screenY = centre[1] - f * Yc / Zc                        // screen y is down
 *   depth   = -Zc = v.D                                      // larger = NEARER
 *
 * There is no near-plane clipping in this file and none is needed: `dist` is
 * clamped so that the eye stays outside a sphere holding everything the page
 * draws (see setBound), which makes Zc > 0 for every point of it. project()
 * still returns null at or behind the eye rather than the ghost the formula
 * would give, because a caller can always reach past that sphere — a symmetry
 * line runs a cell beyond the block, and a billiard can be dragged eight cells
 * out — and every caller skips what it cannot place.
 *
 * Pitch is clamped at the BOTTOM only. At 0 the horizontal plane is edge-on: it
 * is a line, every disk is a needle, and there is nothing to place a billiard
 * on, so the view stops short of it.
 *
 * 90 used to be shut out on the matching argument — that the time axis vanishes
 * and the animation is a wallpaper again — and that argument was wrong. Straight
 * down is not a degenerate view, it is the view the animation is SEEN in: the
 * plane is shown whole and undistorted, and the reader who wants to know where
 * the balls are in the cell wants exactly it. Nothing in this file minds. The
 * basis stays orthonormal (R and U span the plane, D is straight up), no
 * quantity here is divided by cos(pitch), and the one thing that can fail —
 * unproject meeting a slice along the horizon — cannot happen at the top, where
 * every pixel's ray runs dead against the slices. What vanishes is the time
 * axis, which is the reader's business and not this file's; the top of the drag
 * is now exactly 90, so pulling past it lands there rather than near it.
 *
 * ORTHOGRAPHIC is an option and not a second camera. `ortho` keeps the basis,
 * the eye and the orbit and replaces only the divide by the depth with a single
 * scale,
 *
 *   s = f / dist                                     // pixels per world unit
 *   screenX = centre[0] + s * Xc,  screenY = centre[1] - s * Yc
 *
 * chosen so that a point at the TARGET's depth does not move when the reader
 * ticks the box: the two projections agree on the middle of the block and
 * differ only in what they do to its near and far halves. Everything else — the
 * dolly, the distance the link carries, the depth used for the painter's order
 * — means the same thing in both, and `dist` keeps its floor even though a
 * parallel projection has no near plane to be pushed through, so that the wheel
 * has the same range either way.
 *
 * The reason to want it back is the one the switch to perspective gave up: an
 * equal-time non-overlap condition is about horizontal DISTANCES, and only a
 * parallel projection draws two equal separations equally wherever they sit in
 * the box. A reader comparing gaps by eye should tick it; a reader trying to
 * see which tube is in front should not. Under it there is no eye to be in
 * front of, so project() never refuses a point and the symmetry lines that run
 * a cell past the block are drawn whole.
 */
"use strict";
import { LIMITS } from "./urlstate.js?v=48";

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
const MIN_PITCH = 8 * DEG;
/* Math.PI / 2 and not 90 * DEG: the clamp is what a drag lands on when it is
 * pulled past the top, so it had better be the vertical itself and not an ulp
 * short of it. */
const MAX_PITCH = Math.PI / 2;
const DEFAULT_FOV = 40 * DEG;

/* How much further from the target than the bounding radius the eye is held.
 * Six percent is enough to keep Zc off zero without stopping the reader getting
 * close enough for the perspective to be worth having. */
const EYE_MARGIN = 1.06;

/* Below this the point is the eye itself, and f/Zc is not a number. */
const MIN_Z = 1e-9;

const clampPitch = (p) => Math.min(MAX_PITCH, Math.max(MIN_PITCH, p));

export class Camera {
  constructor(opts) {
    const o = opts || {};
    this._yaw = o.yaw === undefined ? 0.6 : o.yaw;
    this._pitch = clampPitch(o.pitch === undefined ? 0.5 : o.pitch);
    this.height = o.height === undefined ? 1 : o.height;
    /* Set once, at construction: a field of view that changed under the reader
     * would move everything on screen for no reason they could name. */
    this.fov = o.fov === undefined ? DEFAULT_FOV : o.fov;
    /* Parallel projection. A plain field and not an accessor: both the focal
     * length and the parallel scale are in the cached frame, so flipping it
     * changes which one is read and invalidates nothing. */
    this.ortho = !!o.ortho;
    this.target = o.target ? [o.target[0], o.target[1], o.target[2]] : [0, 0, 0.5];
    this.centre = o.centre ? [o.centre[0], o.centre[1]] : [0, 0];
    this.vh = o.vh === undefined ? 600 : o.vh;
    this._bound = o.bound === undefined ? 1 : o.bound;
    this._F = null;
    this._dist = 0;
    this.dist = o.dist === undefined ? this.minDist * 6 : o.dist;
  }

  /* The orbit angles, the distance and the target are accessors because the
   * basis and the eye are cached: assigning to any of them has to drop that
   * cache, and callers assign to them by name. */
  get yaw() { return this._yaw; }
  set yaw(v) { this._yaw = v % TWO_PI; this._F = null; }

  get pitch() { return this._pitch; }
  set pitch(v) { this._pitch = clampPitch(v); this._F = null; }

  get dist() { return this._dist; }
  set dist(v) {
    const lo = this.minDist;
    // !(v > lo) rather than v < lo, so a NaN out of some ratio lands on the
    // floor instead of poisoning every projection that follows
    this._dist = !(v > lo) ? lo : Math.min(LIMITS.dist.max, v);
    this._F = null;
  }

  /* The eye is never allowed inside the sphere of radius `bound` about the
   * target. That is the whole of this file's answer to near-plane clipping. */
  get minDist() { return this._bound * EYE_MARGIN; }
  setBound(r) {
    this._bound = r > 1e-3 ? r : 1e-3;
    this.dist = this._dist;              // the floor may have risen under it
  }

  lookAt(p) {
    this.target = [p[0], p[1], p[2]];
    this._F = null;
  }

  /* The canvas, in CSS pixels: the principal point is its centre, and the
   * height is what fov turns into a focal length. Panning the principal point
   * to frame the box instead would be an off-axis projection — still correct,
   * but it shears the cell in a way that reads as a mistake. The box is framed
   * by AIMING at it, which is what lookAt is for. */
  viewport(w, h) {
    this.centre = [w / 2, h / 2];
    this.vh = h;
    this._F = null;
  }

  get f() { return this._frame().f; }

  /* The camera basis, the eye and the focal length, recomputed only when one of
   * them has been invalidated. A redraw projects tens of thousands of points and
   * four trig calls apiece was the single largest cost in this file. */
  _frame() {
    let F = this._F;
    if (F) return F;
    const cy = Math.cos(this._yaw), sy = Math.sin(this._yaw);
    const cp = Math.cos(this._pitch), sp = Math.sin(this._pitch);
    const dx = -sy * cp, dy = cy * cp, dz = sp;
    const f = (this.vh / 2) / Math.tan(this.fov / 2);
    F = this._F = {
      rx: cy, ry: sy,                              // R has no z component
      ux: sy * sp, uy: -cy * sp, uz: cp,
      dx, dy, dz,
      ex: this.target[0] + this._dist * dx,
      ey: this.target[1] + this._dist * dy,
      ez: this.target[2] * this.height + this._dist * dz,
      f,
      s: f / this._dist,               // ortho: pixels per world unit, everywhere
    };
    return F;
  }

  /* Screen pixels for a spacetime point, or null if it is at or behind the eye
   * — never the mirrored ghost that f * Xc / Zc gives for negative Zc. Under
   * ortho there is no such point and the answer is never null. */
  project(p) {
    const F = this._frame();
    const vx = p[0] - F.ex, vy = p[1] - F.ey, vz = p[2] * this.height - F.ez;
    let k = F.s;
    if (!this.ortho) {
      const zc = -(vx * F.dx + vy * F.dy + vz * F.dz);
      if (!(zc > MIN_Z)) return null;
      k = F.f / zc;
    }
    return [this.centre[0] + k * (vx * F.rx + vy * F.ry),
            this.centre[1] - k * (vx * F.ux + vy * F.uy + vz * F.uz)];
  }

  /* project() without the array, into out[k], out[k + 1]; false if it is not in
   * front. Every rim of every ball goes through here — thousands of points a
   * redraw — and the pair of little arrays the tidy form allocates is the most
   * expensive thing about one of them. */
  projectInto(x, y, t, out, k) {
    const F = this._frame();
    const vx = x - F.ex, vy = y - F.ey, vz = t * this.height - F.ez;
    let s = F.s;
    if (!this.ortho) {
      const zc = -(vx * F.dx + vy * F.dy + vz * F.dz);
      if (!(zc > MIN_Z)) return false;
      s = F.f / zc;
    }
    out[k] = this.centre[0] + s * (vx * F.rx + vy * F.ry);
    out[k + 1] = this.centre[1] - s * (vx * F.ux + vy * F.uy + vz * F.uz);
    return true;
  }

  /* Painter's order: larger is NEARER the viewer, which is the convention every
   * sort in app.js is written against. */
  depth(p) {
    const F = this._frame();
    return (p[0] - F.ex) * F.dx + (p[1] - F.ey) * F.dy +
           (p[2] * this.height - F.ez) * F.dz;
  }

  /* Pixels per world unit AT p. Under perspective this is a property of the
   * point and not of the camera alone, which is why there is no longer a
   * once-a-frame ellipse for the balls. Zero at or behind the eye. */
  scaleAt(p) {
    const F = this._frame();
    if (this.ortho) return F.s;
    const zc = -((p[0] - F.ex) * F.dx + (p[1] - F.ey) * F.dy +
                 (p[2] * this.height - F.ez) * F.dz);
    return zc > MIN_Z ? F.f / zc : 0;
  }

  /* The line of sight through a pixel, as eye + s * dir. dir is scaled so that
   * s is exactly the negated depth: depth(eye + s * dir) = -s. That makes "the
   * first thing this ray meets" and "the nearest thing the painter drew" the
   * same comparison, which is what picking needs. */
  ray(sx, sy) {
    const F = this._frame();
    /* Under ortho every ray runs along -D and it is the ORIGIN that the pixel
     * moves, across the plane through the eye; the scaling of dir is the same
     * promise, since R and U are perpendicular to D. */
    if (this.ortho) {
      const a = (sx - this.centre[0]) / F.s;
      const b = (this.centre[1] - sy) / F.s;
      return {
        ox: F.ex + a * F.rx + b * F.ux,
        oy: F.ey + a * F.ry + b * F.uy,
        oz: F.ez + b * F.uz,                       // R has no z component
        dx: -F.dx, dy: -F.dy, dz: -F.dz,
      };
    }
    const a = (sx - this.centre[0]) / F.f;
    const b = (this.centre[1] - sy) / F.f;
    return {
      ox: F.ex, oy: F.ey, oz: F.ez,
      dx: a * F.rx + b * F.ux - F.dx,
      dy: a * F.ry + b * F.uy - F.dy,
      dz: b * F.uz - F.dz,
    };
  }

  /* The point of the t-slice that lands on this pixel — the eye ray met with
   * the plane z = t * height.
   *
   * Under perspective it can FAIL, which the orthographic closed form could
   * not. The ray is parallel to the slice along one row of pixels (the
   * horizon), and it meets slices above the eye only behind the eye, for pixels
   * below that row. Both return null: the answer the algebra offers in the
   * second case is the real point reflected through the camera, and handing
   * that to a drag would throw the billiard to the far side of the plane.
   *
   * Under ortho neither case exists. The rays are all parallel to -D, which the
   * pitch clamp keeps off the horizontal, so every one of them meets every
   * slice exactly once; the meeting may be behind the plane through the eye and
   * that is of no consequence to a projection with no eye in it, so the sign of
   * s is not looked at. */
  unproject(sx, sy, t) {
    const R = this.ray(sx, sy);
    if (Math.abs(R.dz) < 1e-12) return null;
    const s = (t * this.height - R.oz) / R.dz;
    if (!this.ortho && !(s > 0)) return null;
    return [R.ox + s * R.dx, R.oy + s * R.dy];
  }

  orbit(dyaw, dpitch) {
    this._yaw = (this._yaw + dyaw) % TWO_PI;
    this._pitch = clampPitch(this._pitch + dpitch);
    this._F = null;
  }

  /* The wheel moves the EYE, which is what a reader expects of a 3D view. The
   * floor is the eye-outside-the-box clamp; the ceiling is the URL's, because a
   * view the hash cannot hold is a view the reader cannot share, and a Copy
   * link that quietly hands over a different framing is worse than a wheel that
   * stops turning. */
  dolly(f) {
    this.dist = this._dist * f;
  }
}

/* ---- silhouettes --------------------------------------------------------- */

/* Samples per projected rim. The inscribed n-gon falls short of the circle by
 * 1 - cos(pi/n) of the radius, so the count that keeps that under a third of a
 * pixel depends on how big the ball IS on screen — under the old orthographic
 * camera one ellipse served every ball at once and 64 samples was free, and now
 * every disk has its own image. Almost every clone is a few pixels across, and
 * a design on an 18-op group is a few thousand of these a redraw, so following
 * the size is the whole of the performance story. */
const MIN_RIM = 8;
const MAX_RIM = 64;
const RIM_SAG = 0.4;

/* Scratch for one segment's two rims, their sort and their hull. A redraw asks
 * for thousands of silhouettes and each of them wants a few small arrays; on
 * this path the allocation costs more than the arithmetic, so there is one of
 * each and they are reused. The consequence is that the buffer a call hands
 * back is only good until the NEXT call — every caller here copies or draws it
 * before asking for another. */
const RIM = new Float64Array(4 * MAX_RIM);
const ORD = new Int32Array(4 * MAX_RIM);
const TMP = new Int32Array(4 * MAX_RIM);
const HULL = new Int32Array(4 * MAX_RIM);

function rimCount(rPx) {
  /* acos(1 - x) ~ sqrt(2x) from below, so pi / sqrt(2 SAG / rPx) errs upward —
   * the safe direction, and two square roots cheaper than an arc cosine. */
  const n = rPx > RIM_SAG ? Math.ceil(Math.PI / Math.sqrt(2 * RIM_SAG / rPx)) : 0;
  return n < MIN_RIM ? MIN_RIM : n > MAX_RIM ? MAX_RIM : n;
}

/* cos and sin of the sample angles, per count. A redraw uses two or three
 * counts and would otherwise pay for tens of thousands of trig calls. */
const circles = new Map();
function unitCircle(n) {
  let c = circles.get(n);
  if (c) return c;
  c = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TWO_PI;
    c[2 * i] = Math.cos(a);
    c[2 * i + 1] = Math.sin(a);
  }
  circles.set(n, c);
  return c;
}

/* The rim of the horizontal disk of radius r about p, projected into out at
 * offset k. False if any of it is not in front of the eye. */
function rimInto(cam, p, r, n, out, k) {
  const c = unitCircle(n);
  for (let i = 0; i < n; i++) {
    if (!cam.projectInto(p[0] + r * c[2 * i], p[1] + r * c[2 * i + 1], p[2],
                         out, k + 2 * i)) return false;
  }
  return true;
}

/* The silhouette of the ball swept from spacetime point a to b, as a flat
 * buffer of the two rims and the indices of their convex hull.
 *
 * The swept solid is the union of the horizontal disks along the segment, and
 * for two disks of EQUAL radius that union is exactly the convex hull of the
 * two of them — the cross-section at any height is one disk, translated. A
 * projective map is injective and convexity-preserving on the half-space in
 * front of the eye, so the image of that hull is the hull of the image, and the
 * silhouette is still the convex hull of the two projected rims. Perspective
 * costs only the SHORTCUT a parallel projection allows: there the two ellipses
 * are translated copies of one polygon, so their hull could be stitched from
 * the two of them without a sort. Under perspective they are not, so this is a
 * real hull — paid for by sampling the small rims coarsely. It is used in both
 * modes rather than kept as a special case for one: the sort is a few hundred
 * nanoseconds on eight to sixty-four points, and a second silhouette routine
 * that only the ticked box exercised would be the one with the bug in it. */
function tubeHull(cam, a, b, r) {
  const n = rimCount(r * Math.max(cam.scaleAt(a), cam.scaleAt(b)));
  if (!rimInto(cam, a, r, n, RIM, 0)) return 0;
  if (!rimInto(cam, b, r, n, RIM, 2 * n)) return 0;
  return hullInto(RIM, 2 * n);          // vertices of HULL, into RIM
}

/* The silhouette as screen points, or null when the segment reaches past the
 * eye and there is nothing honest to draw. */
export function tubeSegmentHull(cam, a, b, r) {
  const m = tubeHull(cam, a, b, r);
  if (!m) return null;
  const out = [];
  for (let i = 0; i < m; i++) {
    const k = 2 * HULL[i];
    out.push([RIM[k], RIM[k + 1]]);
  }
  return out;
}

/* The same silhouette as a Path2D — what a redraw actually wants, thousands of
 * times over, and the array of points is the most expensive thing about one. */
export function tubeSegmentPath(cam, a, b, r) {
  const m = tubeHull(cam, a, b, r);
  if (!m) return null;
  const path = new Path2D();
  for (let i = 0; i < m; i++) {
    const k = 2 * HULL[i];
    if (i) path.lineTo(RIM[k], RIM[k + 1]);
    else path.moveTo(RIM[k], RIM[k + 1]);
  }
  path.closePath();
  return path;
}

const before = (p, u, v) =>
  p[2 * u] < p[2 * v] || (p[2 * u] === p[2 * v] && p[2 * u + 1] < p[2 * v + 1]);

const cross = (p, o, a, b) =>
  (p[2 * a] - p[2 * o]) * (p[2 * b + 1] - p[2 * o + 1]) -
  (p[2 * a + 1] - p[2 * o + 1]) * (p[2 * b] - p[2 * o]);

/* Andrew's monotone chain over a flat [x, y, ...] buffer of n points, leaving
 * the hull in HULL as indices into it and returning how many — counter-
 * clockwise in a y-up reading of the plane. Collinear points are dropped, so a
 * degenerate tube — a segment that projects to nothing, two coincident ends —
 * still yields a sane polygon. */
function hullInto(p, n) {
  for (let i = 0; i < n; i++) ORD[i] = i;
  sortInto(p, n);
  if (n < 3) {
    for (let i = 0; i < n; i++) HULL[i] = ORD[i];
    return n;
  }
  let m = 0;
  for (let pass = 0; pass < 2; pass++) {
    const start = m;
    for (let i = 0; i < n; i++) {
      const j = ORD[pass ? n - 1 - i : i];
      while (m - start >= 2 && cross(p, HULL[m - 2], HULL[m - 1], j) <= 0) m--;
      HULL[m++] = j;
    }
    m--;                          // the last of each chain opens the other one
  }
  return m;
}

/* ORD, sorted by (x, y). A bottom-up merge sort rather than Array#sort: the
 * built-in wants an array to sort and a closure to compare with, and both of
 * those are allocations on a path that runs thousands of times a redraw. */
function sortInto(p, n) {
  let src = ORD, dst = TMP;
  for (let w = 1; w < n; w *= 2) {
    for (let i = 0; i < n; i += 2 * w) {
      let a = i, b = Math.min(i + w, n), k = i;
      const aEnd = b, bEnd = Math.min(i + 2 * w, n);
      while (a < aEnd && b < bEnd) dst[k++] = before(p, src[b], src[a]) ? src[b++] : src[a++];
      while (a < aEnd) dst[k++] = src[a++];
      while (b < bEnd) dst[k++] = src[b++];
    }
    const t = src; src = dst; dst = t;
  }
  if (src !== ORD) for (let i = 0; i < n; i++) ORD[i] = src[i];
}

/* ---- picking ------------------------------------------------------------- */

/* Picking a world-tube.
 *
 * `pts` is the loop as [{t, x, y}] in CARTESIAN coordinates, sorted by t and
 * closed: the last segment runs back to pts[0] at t = 1. The pixel is an eye
 * RAY, and the tube is a stack of horizontal disks, so the ray meets the tube
 * exactly when its position ON SOME TIME SLICE is within r of the path's centre
 * on that slice.
 *
 * That test is still a QUADRATIC, not a search. Along the ray z is affine in
 * the parameter s, so s is affine in t; t is affine along a segment, and so is
 * the centre — so the ray-to-centre offset is affine in the segment parameter
 * and its squared length is a quadratic in it. The hit set on a segment is one
 * interval, found by the quadratic formula, intersected — under perspective —
 * with the half-line that lies in FRONT of the eye (s > 0), since a slice above
 * the eye is met behind it. A parallel projection has no such half-line: the
 * whole line is looked along, and the intersection is skipped.
 *
 * Which hit wins is settled by s, and no depth sort is needed to find it: the
 * ray's own parameter IS the depth order, negated, so the answer is the hit
 * with the SMALLEST s over all segments. (Under the old camera that was the
 * largest t, which is the same thing seen from a camera that always looked
 * down.) `height` must be the box height the camera was given; it is a
 * parameter because the box, not the camera, owns it.
 *
 * The returned `depth` is where the RAY ENTERS the tube — the quantity that
 * decides which of two tubes under the cursor is in front — on the same scale
 * as cam.depth(), so the two can be compared. It is deliberately not the depth
 * of the returned (x, y, t), which is the path's CENTRE at the hit time and so
 * sits up to r behind the surface the viewer clicked on.
 */
export function pickTube(cam, sx, sy, pts, r, height) {
  const n = pts.length;
  if (!n) return null;
  const h = height === undefined ? cam.height : height;
  const R = cam.ray(sx, sy);
  // one row of pixels looks along the slices and meets none of them; a second
  // method for a line of measure zero is not worth having
  if (Math.abs(R.dz) < 1e-12 || !(h > 0)) return null;
  let best = null;
  for (let k = 0; k < n; k++) {
    const p0 = pts[k];
    const p1 = k + 1 < n ? pts[k + 1] : { t: 1, x: pts[0].x, y: pts[0].y };
    const dt = p1.t - p0.t;
    if (!(dt > 0)) continue;
    // where the ray crosses each end's slice, and how far the tube's centre is
    // from it there
    const sa = (p0.t * h - R.oz) / R.dz;
    const sb = (p1.t * h - R.oz) / R.dz;
    const ax = R.ox + sa * R.dx - p0.x, ay = R.oy + sa * R.dy - p0.y;
    const bx = R.ox + sb * R.dx - p1.x, by = R.oy + sb * R.dy - p1.y;
    const ux = bx - ax, uy = by - ay;
    // |(a) + m(u)|^2 = r^2
    const A = ux * ux + uy * uy;
    const B = 2 * (ax * ux + ay * uy);
    const C = ax * ax + ay * ay - r * r;
    let m0, m1;
    if (A < 1e-18) {
      if (C > 0) continue;                            // parallel and outside
      m0 = 0; m1 = 1;
    } else {
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      m0 = (-B - sq) / (2 * A);
      m1 = (-B + sq) / (2 * A);
    }
    m0 = Math.max(0, m0);
    m1 = Math.min(1, m1);
    // and under perspective only the part in front of the eye; s is affine in m
    const ds = sb - sa;
    if (!cam.ortho) {
      if (ds > 0) m0 = Math.max(m0, -sa / ds);
      else m1 = Math.min(m1, -sa / ds);
    }
    if (m0 > m1) continue;
    const m = ds > 0 ? m0 : m1;                       // the ray enters here
    const depth = -(sa + m * ds);
    if (best === null || depth > best.depth) {
      best = {
        t: p0.t + m * dt,
        x: p0.x + m * (p1.x - p0.x),
        y: p0.y + m * (p1.y - p0.y),
        segIndex: k,
        depth,
      };
    }
  }
  return best;
}

/* Is the pixel within `px` of the projection of spacetime point p? Used for
 * the breakpoint handles, which are drawn at a fixed pixel size and so are
 * picked at one too. A point behind the eye is not drawn and is not picked. */
export function pickPoint(cam, sx, sy, p, px) {
  const q = cam.project(p);
  if (!q) return false;
  return Math.hypot(q[0] - sx, q[1] - sy) <= px;
}
