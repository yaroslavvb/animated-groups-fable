// vec.js — the few 3-vector helpers the geometry needs. Vectors are plain arrays [x, y, z].

export function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
export function addScaled(a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }
export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function len(a) { return Math.hypot(a[0], a[1], a[2]); }
export function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

/** Great-circle interpolation of two unit vectors. */
export function slerp(a, b, t) {
  const c = Math.min(1, Math.max(-1, dot(a, b)));
  const th = Math.acos(c);
  if (th < 1e-6) return norm(lerp(a, b, t));
  const s = Math.sin(th), ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
  return [ka * a[0] + kb * b[0], ka * a[1] + kb * b[1], ka * a[2] + kb * b[2]];
}

/** Rotate v about the unit axis k by angle a (Rodrigues). */
export function rotate(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), d = dot(k, v), x = cross(k, v);
  return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)];
}

export const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10));
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 before a, 1 after b, smooth in between. */
export const ramp = (x, a, b) => smooth((x - a) / (b - a));
