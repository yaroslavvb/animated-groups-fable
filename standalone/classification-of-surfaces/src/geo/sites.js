// sites.js — a SITE is a place on a body where a feature (hole, crosscap, tube foot) is built, with a local chart:
// local (x, y) are coordinates on the bare sheet around the site, z is the height above it (outward).
//
//   site.toWorld(x, y, z, out, k)   writes the world point into out[k .. k + 2]
//   site.point(x, y, z)             the same as a new array
//   site.blend(a, b, w)             a point of the bare sheet between the sheet points a and b (w in 0..1)
//   site.n, site.e1, site.e2        the frame at the site: outward normal and the two tangent axes (e2 = n x e1)
//   site.origin                     the world point of the site itself
//
// Two kinds: a flat sheet (the patch of the Zippers tab) and a sphere (the tidy surfaces). On the sphere the chart is
// azimuthal-equidistant about the site: a circle of radius r in the chart is a true small circle of the sphere,
// which is what lets a tube foot or a crosscap sit on a round rim wherever the site is.

import { cross, dot, norm, sub, scale, lerp, slerp, addScaled } from './vec.js';

export function flatSite(o = [0, 0, 0], e1 = [1, 0, 0], e2 = [0, 1, 0]) {
  const n = cross(e1, e2);
  return {
    kind: 'flat', o, e1, e2, n, origin: o.slice(),
    toWorld(x, y, z, out, k) {
      out[k] = o[0] + x * e1[0] + y * e2[0] + z * n[0];
      out[k + 1] = o[1] + x * e1[1] + y * e2[1] + z * n[1];
      out[k + 2] = o[2] + x * e1[2] + y * e2[2] + z * n[2];
    },
    point(x, y, z) { const out = [0, 0, 0]; this.toWorld(x, y, z, out, 0); return out; },
    blend(a, b, w) { return lerp(a, b, w); },
  };
}

export function sphereSite(c, R, n, e1hint) {
  n = norm(n);
  const e1 = norm(sub(e1hint, scale(n, dot(e1hint, n))));
  const e2 = cross(n, e1);
  return {
    kind: 'sphere', c, R, n, e1, e2, origin: addScaled(c, n, R),
    toWorld(x, y, z, out, k) {
      const rho = Math.hypot(x, y), a = rho / R, ca = Math.cos(a), sa = rho > 1e-12 ? Math.sin(a) / rho : 1 / R, r = R + z;
      const tx = x * sa, ty = y * sa;
      out[k] = c[0] + r * (ca * n[0] + tx * e1[0] + ty * e2[0]);
      out[k + 1] = c[1] + r * (ca * n[1] + tx * e1[1] + ty * e2[1]);
      out[k + 2] = c[2] + r * (ca * n[2] + tx * e1[2] + ty * e2[2]);
    },
    point(x, y, z) { const out = [0, 0, 0]; this.toWorld(x, y, z, out, 0); return out; },
    blend(a, b, w) { return addScaled(c, slerp(norm(sub(a, c)), norm(sub(b, c)), w), R); },
  };
}
