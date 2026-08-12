/* The designer's camera, and the exact silhouettes of the things it draws.
 *
 * The designer shows one period of the spacetime box: the plane spread out
 * below, time running up the page. World coordinates are (x, y, z) with x, y
 * cartesian in the plane and z = t * height, t measured in periods. The view
 * is ORTHOGRAPHIC — parallel, no perspective — for two reasons that matter to
 * what the page is for. Non-overlap is an equal-time condition on horizontal
 * distances, so a projection that shrinks the far side of the box would make
 * two balls at the same separation look different; and an affine projection
 * turns "the silhouette of a swept ball" from a hard surface-of-revolution
 * problem into the convex hull of two ellipses, exactly — and the hull of two
 * translated copies of one polygon is a stitch, not a sort (see `stitch`).
 *
 *   xv =  x*cos(yaw) + y*sin(yaw)
 *   yv = -x*sin(yaw) + y*cos(yaw)
 *   screenX = centre[0] +  xv*zoom
 *   screenY = centre[1] + (yv*sin(pitch) - z*cos(pitch)) * zoom
 *   depth   = yv*cos(pitch) + z*sin(pitch)          // larger = nearer viewer
 *
 * Screen y runs DOWN, so the -z term is what puts later time higher up the
 * page. Pitch is clamped away from both ends: at 0 the horizontal plane is a
 * line and every disk is a needle, at 90 the time axis vanishes and the film
 * is a wallpaper again.
 */
"use strict";
import { LIMITS } from "./urlstate.js?v=40";

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
const MIN_PITCH = 8 * DEG;
const MAX_PITCH = 85 * DEG;

/* Samples per end-ellipse in a tube silhouette. The hull of an n-gon
 * inscribed in an ellipse falls short of the curve by 1 - cos(pi/n) of the
 * semi-axis, so 64 samples is 1.2e-3 — under a pixel for any ball drawn
 * smaller than about 800 px across, which no view of a whole cell ever is.
 * Going finer costs hull time on every segment of every seed, every frame. */
const ELLIPSE_SAMPLES = 64;

const clampPitch = (p) => Math.min(MAX_PITCH, Math.max(MIN_PITCH, p));

export class Camera {
  constructor(opts) {
    const o = opts || {};
    this.yaw = o.yaw === undefined ? 0.6 : o.yaw;
    this.pitch = clampPitch(o.pitch === undefined ? 0.5 : o.pitch);
    this.zoom = o.zoom === undefined ? 100 : o.zoom;
    this.height = o.height === undefined ? 1 : o.height;
    this.centre = o.centre ? [o.centre[0], o.centre[1]] : [0, 0];
  }

  project(p) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const xv = p[0] * cy + p[1] * sy;
    const yv = -p[0] * sy + p[1] * cy;
    const z = p[2] * this.height;
    return [this.centre[0] + xv * this.zoom,
            this.centre[1] + (yv * sp - z * cp) * this.zoom];
  }

  depth(p) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const yv = -p[0] * sy + p[1] * cy;
    return yv * Math.cos(this.pitch) + p[2] * this.height * Math.sin(this.pitch);
  }

  /* The point of the t-slice that lands on this pixel. Solvable in closed
   * form because fixing t fixes z, and what is left is a rotation followed by
   * a scaling of the second axis — invertible exactly while sin(pitch) != 0,
   * which the pitch clamp guarantees. */
  unproject(sx, sy, t) {
    const cy = Math.cos(this.yaw), sry = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const z = t * this.height;
    const xv = (sx - this.centre[0]) / this.zoom;
    const yv = ((sy - this.centre[1]) / this.zoom + z * cp) / sp;
    return [xv * cy - yv * sry, xv * sry + yv * cy];
  }

  /* A HORIZONTAL disk of cartesian radius r projects to an ellipse — the
   * image of a circle under the affine map A below, whose singular values are
   * the semi-axes and whose left singular vectors give the axis directions.
   * Depends only on the camera, so a frame computes it once and translates it
   * to each ball. */
  diskAxes(r) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const sp = Math.sin(this.pitch), k = this.zoom;
    const e = svd2(cy * k, sy * k, -sy * sp * k, cy * sp * k);
    return { rx: e.s1 * r, ry: e.s2 * r, rot: e.rot };
  }

  orbit(dyaw, dpitch) {
    this.yaw = (this.yaw + dyaw) % TWO_PI;
    this.pitch = clampPitch(this.pitch + dpitch);
  }

  /* The ceiling is the URL's, not the renderer's: a view the hash cannot hold
   * is a view the reader cannot share, and a Copy link that quietly hands over
   * a different zoom is worse than a wheel that stops turning. */
  zoomBy(f) {
    this.zoom = Math.min(LIMITS.zoom.max, Math.max(1e-6, this.zoom * f));
  }
}

/* Semi-axes and orientation of the image of the unit circle under
 * [[a,b],[c,d]] — the 2x2 SVD in closed form (Blinn's construction). The
 * smaller singular value comes out signed when the map flips orientation;
 * only its magnitude is an axis length. */
function svd2(a, b, c, d) {
  const e = (a + d) / 2, f = (a - d) / 2;
  const g = (c + b) / 2, h = (c - b) / 2;
  const q = Math.hypot(e, h), r = Math.hypot(f, g);
  return {
    s1: q + r,
    s2: Math.abs(q - r),
    rot: (Math.atan2(h, e) + Math.atan2(g, f)) / 2,
  };
}

/* The unit circle's image, as offsets from the ellipse centre, CCW.
 *
 * Memoised on the axes: a frame draws thousands of segments and every one of
 * them has the same camera and the same ball radius, so this is computed once
 * per frame rather than once per segment. */
let offsetCache = null;

function ellipseOffsets(ax) {
  if (offsetCache && offsetCache.rx === ax.rx && offsetCache.ry === ax.ry &&
      offsetCache.rot === ax.rot) return offsetCache.off;
  const c = Math.cos(ax.rot), s = Math.sin(ax.rot);
  const out = [];
  for (let i = 0; i < ELLIPSE_SAMPLES; i++) {
    const a = (i / ELLIPSE_SAMPLES) * TWO_PI;
    const u = ax.rx * Math.cos(a), v = ax.ry * Math.sin(a);
    out.push([u * c - v * s, u * s + v * c]);
  }
  offsetCache = { rx: ax.rx, ry: ax.ry, rot: ax.rot, off: out };
  return out;
}

/* The silhouette of the ball swept from spacetime point a to b, as screen
 * points. The swept solid is the union of the horizontal disks along the
 * segment; the projection is affine, so that union's image is the convex hull
 * of the images of the two end disks — no near-silhouette to solve for, no
 * tessellation of a curved surface. The only approximation left is the
 * sampling of each end ellipse (ELLIPSE_SAMPLES). */
export function tubeSegmentHull(cam, a, b, r) {
  const off = ellipseOffsets(cam.diskAxes(r));
  const pa = cam.project(a), pb = cam.project(b);
  const out = [];
  if (walkHull(off, pa, pb, (x, y) => out.push([x, y]))) return out;
  const pts = [];
  for (let i = 0; i < off.length; i++) {
    pts.push([pa[0] + off[i][0], pa[1] + off[i][1]]);
    pts.push([pb[0] + off[i][0], pb[1] + off[i][1]]);
  }
  return convexHull(pts);
}

/* The hull of two TRANSLATED COPIES of one convex polygon, without sorting —
 * emitted point by point, so a caller that wants a Path2D need not build an
 * array of points first. False means it declined; the caller sorts instead.
 *
 * Support functions add under translation: in direction n the further copy wins,
 * and which copy that is depends only on the sign of <d, n> for d the offset
 * between them. A vertex's supporting directions are the cone between its two
 * edge normals, and for a CCW polygon <d, n_i> is cross(d, e_i) — so the copies
 * split at the two edges where that cross product changes sign, and the two
 * straddling vertices belong to both. The answer is one pass over the edges and
 * one pass over the output.
 *
 * That leaves the hull the sorted construction would give (verified: relative
 * area agreement 9e-15 over 2000 random cameras) at a fourteenth of the cost,
 * which matters because a design on an 18-op group is a few thousand of these
 * per redraw. It declines when the ellipse has degenerated far enough that its
 * edges no longer turn monotonely, which the pitch clamp should prevent but
 * which is not worth assuming. */
function walkHull(off, pa, pb, emit) {
  const n = off.length;
  const dx = pb[0] - pa[0], dy = pb[1] - pa[1];
  if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) {
    for (let i = 0; i < n; i++) emit(pa[0] + off[i][0], pa[1] + off[i][1]);
    return true;
  }
  const side = (i) => {
    const j = i + 1 === n ? 0 : i + 1;
    return dx * (off[j][1] - off[i][1]) - dy * (off[j][0] - off[i][0]) > 0;
  };
  let s0 = -1, s1 = -1, prev = side(n - 1), changes = 0;
  for (let i = 0; i < n; i++) {
    const s = side(i);
    if (s === prev) continue;
    prev = s;
    if (++changes > 2) return false;
    if (s0 < 0) s0 = i; else s1 = i;
  }
  if (s1 < 0) return false;
  const near = side(s0) ? pb : pa, far = near === pb ? pa : pb;
  for (let i = s0; ; i = i + 1 === n ? 0 : i + 1) {
    emit(near[0] + off[i][0], near[1] + off[i][1]);
    if (i === s1) break;
  }
  for (let i = s1; ; i = i + 1 === n ? 0 : i + 1) {
    emit(far[0] + off[i][0], far[1] + off[i][1]);
    if (i === s0) break;
  }
  return true;
}

/* The same silhouette as a Path2D. It walks the hull straight into the path
 * rather than by way of tubeSegmentHull, because a redraw builds thousands of
 * these and the intermediate array of points is the most expensive thing about
 * one of them. */
export function tubeSegmentPath(cam, a, b, r) {
  const off = ellipseOffsets(cam.diskAxes(r));
  const pa = cam.project(a), pb = cam.project(b);
  const path = new Path2D();
  let first = true;
  const ok = walkHull(off, pa, pb, (x, y) => {
    if (first) { path.moveTo(x, y); first = false; } else path.lineTo(x, y);
  });
  if (!ok) {
    const hull = tubeSegmentHull(cam, a, b, r);
    for (let i = 0; i < hull.length; i++) {
      if (i) path.lineTo(hull[i][0], hull[i][1]);
      else path.moveTo(hull[i][0], hull[i][1]);
    }
  }
  path.closePath();
  return path;
}

/* Andrew's monotone chain, counter-clockwise in a y-up reading of the plane.
 * Collinear points are dropped, so a degenerate tube (a segment that projects
 * to nothing, or two coincident ends) still yields a sane polygon. */
function convexHull(pts) {
  const p = pts.slice().sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (src) => {
    const out = [];
    for (const q of src) {
      while (out.length >= 2 &&
             cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  const lower = half(p);
  const upper = half(p.slice().reverse());
  return lower.concat(upper);
}

/* Picking a world-tube.
 *
 * `pts` is the loop as [{t, x, y}] in CARTESIAN coordinates, sorted by t and
 * closed: the last segment runs back to pts[0] at t = 1. Under an orthographic
 * camera the pixel (sx, sy) is a whole ray, and the tube is a stack of
 * horizontal disks, so the ray meets the tube exactly when the mouse's
 * position ON SOME TIME SLICE is within r of the path's centre on that slice.
 *
 * That test is a QUADRATIC, not a search: unproject is affine in t, t is
 * affine along a segment, and so is the centre — so the mouse-to-centre offset
 * is affine in the segment parameter and its squared length is a quadratic.
 * The hit set on a segment is therefore one interval, found by the quadratic
 * formula.
 *
 * Which hit is nearest the viewer is settled by t alone: along the ray,
 * d(depth)/dt = height/sin(pitch) > 0, so later time is always nearer. So the
 * answer is the hit with the LARGEST t, and no depth sorting is needed to find
 * it. (`height` must be the same box height the camera was given; it is a
 * parameter because the box, not the camera, owns it.)
 *
 * The returned `depth` is where the RAY ENTERS the tube — the quantity that
 * decides which of two tubes under the cursor is in front. It is deliberately
 * not the depth of the returned (x, y, t), which is the path's CENTRE at the
 * hit time and so sits up to r behind the surface the viewer clicked on.
 */
export function pickTube(cam, sx, sy, pts, r, height) {
  const n = pts.length;
  if (!n) return null;
  const h = height === undefined ? cam.height : height;
  const forward = h > 0;              // else time is not a depth order
  let best = null;
  for (let k = 0; k < n; k++) {
    const p0 = pts[k];
    const p1 = k + 1 < n ? pts[k + 1] : { t: 1, x: pts[0].x, y: pts[0].y };
    const dt = p1.t - p0.t;
    if (!(dt > 0)) continue;
    const m0 = cam.unproject(sx, sy, p0.t), m1 = cam.unproject(sx, sy, p1.t);
    const ax = m0[0] - p0.x, ay = m0[1] - p0.y;      // offset at s = 0
    const bx = m1[0] - p1.x, by = m1[1] - p1.y;      // offset at s = 1
    const ux = bx - ax, uy = by - ay;
    // |(a) + s(u)|^2 = r^2
    const A = ux * ux + uy * uy;
    const B = 2 * (ax * ux + ay * uy);
    const C = ax * ax + ay * ay - r * r;
    let s0, s1;
    if (A < 1e-18) {
      if (C > 0) continue;                            // parallel and outside
      s0 = 0; s1 = 1;
    } else {
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      s0 = (-B - sq) / (2 * A);
      s1 = (-B + sq) / (2 * A);
    }
    s0 = Math.max(0, s0);
    s1 = Math.min(1, s1);
    if (s0 > s1) continue;
    const s = forward ? s1 : s0;
    const t = p0.t + s * dt;
    if (best === null || (forward ? t > best.t : t < best.t)) {
      const x = p0.x + s * (p1.x - p0.x);
      const y = p0.y + s * (p1.y - p0.y);
      const m = cam.unproject(sx, sy, t);
      best = { t, x, y, segIndex: k, depth: cam.depth([m[0], m[1], t]) };
    }
  }
  return best;
}

/* Is the pixel within `px` of the projection of spacetime point p? Used for
 * the breakpoint handles, which are drawn at a fixed pixel size and so are
 * picked at one too. */
export function pickPoint(cam, sx, sy, p, px) {
  const q = cam.project(p);
  return Math.hypot(q[0] - sx, q[1] - sy) <= px;
}
