// folds/bottle.js — xx (pg): the classic Klein bottle, folded so that no paper passes through paper.
// 14 Nov 2026, the owner, looking at the figure-8 bottle of folds/roll.js at t = 1: "I expected to see a Klein bottle
// and only one surface; however, if I look through it, I see two surfaces, so this visualization is confusing to me."
// (The figure 8 is one surface, but its two lobes read as two tori fused along a circle.) This module replaces it for
// the fold type 'klein' (src/folds/index.js); the figure 8 stays in folds/roll.js, used by no group.
//
// ---------------------------------------------------------------------------------------------------------------
// THE SHAPE: one tube. A wide body; at its top a shoulder and a narrow neck; the neck hooks over to the side, comes
// down beside the body and goes in through the body's side wall; inside, it runs back to the axis and down to the base,
// where the wall of the body turns in (a round rim) and becomes that inner neck. The surface passes through itself
// along one closed curve, where the neck goes through the wall (the "saddle").
//
// THE CUT. The group's default tile (the Rectangle: b across the glide axes, A along them) is laid on the bottle so
// that its two glide-sewn edges are the two sides of that curve: one end of the tube ends ON the wall from outside,
// the other ON the wall from inside. So the paper never has to pass through paper: the two rims MEET on the wall and
// are sewn through it. (Every other cut is first re-cut into this one: src/folds/recut.js.)
//
// THE MOTION, three moves, each a bend with growing curvature:
//   1 flap   the end of the tile that becomes the inner neck folds up and over the sheet, about the line that becomes
//            the base's rim (a rounded fold: the U of the rim);
//   2 roll   the sheet, doubled where the flap lies on it, rolls up across the glide axes about an axis that comes down
//            from far above: a wedge of a surface of revolution that closes into a tube with a tube inside it (the blue
//            seam closes along both). The part beyond the flap narrows into the neck while it rolls;
//   3 hook   the neck curls over to the side and round to the wall, and inside the body the inner neck leans over to
//            the same place: the two rims meet on the wall (the orange seam closes through it).
//
// ---------------------------------------------------------------------------------------------------------------
// THE MAP. Coordinates of a plane point in the anchored frame: xi across (0 on the glide axis nearest the anchor),
// eta along (0 at the anchor). The tile's own rows eta = const are carried to circles:
//     P(xi, eta) = c(eta) + [mu xi sinc(th) - z(eta) sin(th)] N(eta) + [mu xi cosc(th) + z(eta) cos(th)] e_z,
//     th = 2 pi a xi / b,
// i.e. the row is an arc of the circle of radius h - z about a horizontal axis at height h = mu b / (2 pi a) above its
// own lowest point (c, z): a flat row for a = 0 (h infinite), a full circle for a = 1 (h = the body's radius). Every
// row turns through the same angle th, so the rolled sheet is a wedge of revolution and both layers close together.
// The row's lowest points form the "keel" (c(eta), z(eta)); it is built from pieces along eta, each a straight run or
// an arc, by three angles that grow with the three moves:
//     pitch psi   in the vertical plane: 0 on the sheet, -pi f on the flap, turning through the U in between;
//                 also the gentle ramp of the shoulder (the neck's rows rise by the gap g = Rb - rn while they roll);
//     heading phi in the horizontal plane: h times the bottle's (the hook: pi; the arcs to the wall: beta each way);
//     and the keel runs at speed sig along eta, 1 -> sigF while the sheet rolls (a gentle stretch: the bottle is a
//     little longer than the tile). The flap move is an isometry, the hook only bends the closed tube.
// At t = 0 this is the identity. At t = 1 the two rims (eta = -A/2, A/2) are the same curve with opposite frames
// (N(A/2) = -N(-A/2)), so P(-xi, eta + A) = P(xi, eta): the map is invariant under the glide and under xi -> xi + b,
// and every tile closes exactly. The pieces' lengths are solved so that the keel closes (shape()).
//
// THE RIMS ON THE WALL. A row is a plane circle, but the curve where the neck meets the wall is a saddle. Near each
// rim the rows are therefore sheared along the neck (which is straight there): eta -> eta + w chi(eta) D(th) / sig,
// D(th) = the distance along the neck from the plane circle to the wall. At t = 1 (w = 1) the two rims lie on the
// wall, point for point.
//
// OTHER TILES (the direct fold of a dragged or wavy cut; the app shows the re-cut instead). The tile is pulled back
// next to the anchor by the element of the group nearest its seed, g: (xi, eta) -> (+-xi + k b, eta + m A); rows beyond
// a rim follow the straight run of the neck and are drawn over to their true place, the other end of the tube, as the
// rims close (they pass through the wall there: this is the one-sheet motion that the re-cut avoids); the way back is
// a slide, with a half turn about the glide axis when g turns the tile over.
//
// Exports
//   default createFold(group, domain, mesh, opts) -> Fold (SPEC 5.3: mesh, stops, duration, at(t); opts.anchor, SPEC 7)
//       and type 'klein', params, times, schedule(t), stage(t), doubleLine(t), anchor, anchorImage
//   bottleShape(b, A, P?)      the solved shape (lengths in world units)
//   SHAPE, TUNE                the proportions (in units of b) and the timing

import { classify, det } from '../geom.js';
import { buildMesh } from '../mesh.js';
import { rollDensity, sinc, cosc } from './roll.js';

const PI = Math.PI, TAU = 2 * PI;

/** Proportions, in units of b (the translation across the glide axes = the tube's girth on the paper). */
export const SHAPE = {
  Rb: 0.2,        // the body's radius                      (the paper is stretched 2 pi Rb = 1.26 across on the body)
  rn: 0.094,      // the neck's radius, inside and outside  (squeezed to 0.59 across)
  hook: 0.167,    // the radius of the hook's centre line
  beta: 75,       // degrees between the neck and the bottle's axis where the neck meets the wall
  sw: 0.045,      // the neck runs straight this far on either side of the wall
  Lin: 0.028,     // the inner neck's straight run above the base
  Lbody: 0.37,    // the body's cylinder
  Lsh: 0.27,      // the shoulder (length of its profile)
  Ln1: 0.017,     // the neck's straight run above the shoulder
};

/** Timing (shares of the fold) and the mesh. */
export const TUNE = {
  duration: 7,
  tF: 0.33,       // the flap has landed
  tR: 0.61,       // the tube has closed
  ov: 0.08,       // each move starts this long before the one before it ends
  ramp: 0.15,     // the time a move takes to pick up speed or to brake
  shear: 0.16,    // the rows within this share of A of a rim are sheared onto the wall
  side: 1,        // +1: the neck hooks toward +across
  density: 104,
};

const clamp01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0);
const S5 = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * q * (q * (q * 6 - 15) + 10));
const dS5 = (q) => (q <= 0 || q >= 1 ? 0 : 30 * q * q * (q - 1) * (q - 1));
/** Integral of the velocity ramp 3y^2 - 2y^3 (0 before 0; slope 1 after 1). */
const ramp = (y) => (y <= 0 ? 0 : y >= 1 ? y - 0.5 : y * y * y * (1 - y / 2));
/** 0 -> 1 on [0, 1]: picks up speed over the first fi, brakes over the last fo, constant speed between. C2. */
function ease(x, fi, fo) {
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  const up = fi > 0 ? fi * ramp(x / fi) : x, down = fo > 0 ? fo * ramp((x - 1 + fo) / fo) : 0;
  return (up - down) / (1 - (fi + fo) / 2);
}

/** Unit vector along (x, y), rounding dust removed so that axis-parallel stays exact. */
function unit(x, y) {
  const l = Math.hypot(x, y);
  let ux = x / l, uy = y / l;
  if (Math.abs(ux) < 1e-12) { ux = 0; uy = uy < 0 ? -1 : 1; }
  if (Math.abs(uy) < 1e-12) { uy = 0; ux = ux < 0 ? -1 : 1; }
  return [ux, uy];
}
/** The direction of a LINE as a unit vector with a fixed sense: pointing right, or straight up. */
function lineDir(x, y) {
  const u = unit(x, y);
  return u[0] < 0 || (u[0] === 0 && u[1] < 0) ? [-u[0], -u[1]] : u;
}
/** Length of the shortest lattice vector parallel to the unit vector (ux, uy). */
function latticePeriod(group, ux, uy) {
  const { e1, e2 } = group;
  let best = Infinity;
  for (let m = -6; m <= 6; m++) for (let n = -6; n <= 6; n++) {
    if (!m && !n) continue;
    const x = m * e1[0] + n * e2[0], y = m * e1[1] + n * e2[1], l = Math.hypot(x, y);
    if (Math.abs(x * uy - y * ux) < 1e-9 * l && l < best) best = l;
  }
  return best;
}
function findGlide(group) {
  for (const r of group.reps) {
    if (det(r) > 0) continue;
    const c = classify(r);
    if (c.type === 'glide') return c;
  }
  throw new Error(`bottle fold: group ${group.id} has no glide among its coset representatives`);
}
function anchorOf(a) {
  if (!a || typeof a === 'string' || !(a.length >= 2)) return null;
  const x = Number(a[0]), y = Number(a[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

const NSH = 48;                      // nodes of the shoulder's table
/**
 * The shoulder's keel: the rows rise by `rise` over the paper length `len` (a smooth ramp), the keel running at speed
 * `sig`. Fills tab (2 * (NSH + 1)): the way along the heading up to node i, and its slope there. Returns the whole way.
 */
function shoulderTable(rise, len, sig, tab) {
  const k = rise / len, f = (u) => { const d = k * dS5(u); const q = sig * sig - d * d; return q > 0 ? Math.sqrt(q) : 0; };
  let acc = 0, f0 = f(0);
  tab[0] = 0; tab[1] = f0 * len;
  for (let i = 0; i < NSH; i++) {
    const u0 = i / NSH, u1 = (i + 1) / NSH, fm = f(0.5 * (u0 + u1)), f1 = f(u1);
    acc += (len / NSH / 6) * (f0 + 4 * fm + f1);
    tab[2 * (i + 1)] = acc; tab[2 * (i + 1) + 1] = f1 * len;
    f0 = f1;
  }
  return acc;
}
/** The table at u in [0, 1] (cubic through the nodes and their slopes). */
function shoulderAt(tab, u) {
  if (u <= 0) return 0;
  if (u >= 1) return tab[2 * NSH];
  const x = u * NSH, i = Math.min(NSH - 1, Math.floor(x)), t = x - i, t2 = t * t, t3 = t2 * t, h = 1 / NSH;
  const y0 = tab[2 * i], m0 = tab[2 * i + 1] * h, y1 = tab[2 * i + 2], m1 = tab[2 * i + 3] * h;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
}

// The pieces of the keel, from the rim inside the body (eta = -A/2) to the rim outside (eta = A/2).
const P_INW = 0, P_INARC = 1, P_INAX = 2, P_U = 3, P_BODY = 4, P_SH = 5, P_N1 = 6, P_HOOK = 7, P_DOWN = 8, P_OUTARC = 9, P_OUTW = 10, NP = 11;
const NAMES = ['inner neck at the wall', 'inner neck, the arc', 'inner neck on the axis', 'the rim of the base', 'body', 'shoulder', 'neck', 'hook', 'neck coming down', 'the arc to the wall', 'neck at the wall'];

/**
 * The bottle for a tile b across and A along: every length in world units.
 * -> { b, A, Rb, rn, g, hook, beta, sw, rho2, rho3, L3, names, L: [the pieces' lengths on the bottle], Q, sigma (= Q / A),
 *      len: [the pieces' lengths on the paper], eta: [NP + 1 boundaries], turn: [heading turned in each piece],
 *      mu1 (the body's stretch across), ref (the row that is held, in the body), box [x0, y0, x1, y1] (closed, keel frame) }
 */
export function bottleShape(b, A, P = SHAPE) {
  const Rb = P.Rb * b, rn = P.rn * b, hook = P.hook * b, sw = P.sw * b, beta = (P.beta * PI) / 180;
  const g = Rb - rn, sb = Math.sin(beta), cb = Math.cos(beta);
  if (!(g > 0 && rn > 0)) throw new Error('bottle: the neck must be narrower than the body');
  // across: the neck leaves the hook at 2 hook from the axis and must reach the wall (Rb) and then the axis (0)
  const rho2 = (2 * hook - Rb - sw * sb) / (1 - cb), rho3 = (Rb - sw * sb) / (1 - cb);
  if (!(rho2 > 1.08 * rn && rho3 > 1.08 * rn)) throw new Error(`bottle: an arc of the neck is tighter than the neck is wide (${rho2.toFixed(3)}, ${rho3.toFixed(3)} against ${rn.toFixed(3)})`);
  if (!(2 * hook > Rb + rn)) throw new Error('bottle: the hook does not clear the body');
  const Lin = P.Lin * b, Lbody = P.Lbody * b, Lsh = P.Lsh * b, Ln1 = P.Ln1 * b;
  if (!(g * 1.875 < 0.97 * Lsh)) throw new Error('bottle: the shoulder is too short for the step it has to climb');
  // along: both ways from the base's rim to the wall must come to the same height
  const LshAx = shoulderTable(g, Lsh, 1, new Float64Array(2 * (NSH + 1)));
  const L3 = Lbody + LshAx + Ln1 - rho2 * sb - Lin - rho3 * sb - 2 * sw * cb;
  if (!(L3 >= 0)) throw new Error('bottle: the neck cannot come down to where it meets the wall (make the body longer)');
  // the neck must meet the wall on the body's cylinder
  const wallY = Lin + rho3 * sb + sw * cb;
  let foot = 0;                                                  // how far along the body the curve on the wall reaches
  for (let i = 0; i < 360; i++) {
    const th = (TAU * i) / 360, c = rn * Math.cos(th), D = (Rb - rn * Math.sin(th) * cb - Math.sqrt(Rb * Rb - c * c)) / sb;
    foot = Math.max(foot, Math.abs(-D * cb + rn * Math.sin(th) * sb));
  }
  foot += 0.012 * b;
  if (!(wallY + foot < Lbody && wallY - foot > 0)) throw new Error('bottle: the neck does not meet the wall on the cylinder of the body');
  const L = new Float64Array(NP), turn = new Float64Array(NP);
  L[P_INW] = sw; L[P_INARC] = rho3 * beta; L[P_INAX] = Lin; L[P_U] = (PI * g) / 2; L[P_BODY] = Lbody; L[P_SH] = Lsh;
  L[P_N1] = Ln1; L[P_HOOK] = PI * hook; L[P_DOWN] = L3; L[P_OUTARC] = rho2 * beta; L[P_OUTW] = sw;
  turn[P_INARC] = -beta; turn[P_HOOK] = PI; turn[P_OUTARC] = beta;
  let Q = 0;
  for (let i = 0; i < NP; i++) Q += L[i];
  const sigma = Q / A;
  if (!(sigma > 0.8 && sigma < 1.45)) throw new Error(`bottle: the tile is ${sigma < 1 ? 'too long' : 'too short'} for this bottle (stretch ${sigma.toFixed(2)})`);
  const len = new Float64Array(NP), eta = new Float64Array(NP + 1);
  eta[0] = -A / 2;
  for (let i = 0; i < NP; i++) { len[i] = L[i] / sigma; eta[i + 1] = eta[i] + len[i]; }
  eta[NP] = A / 2;
  const ref = 0.5 * (eta[P_BODY] + eta[P_BODY + 1]);
  // the closed bottle in the keel's frame (X across, Y along, the held row at Y = ref): its box
  const yBase = ref - 0.5 * Lbody, top = yBase + Lbody + LshAx + Ln1 + hook + rn;
  const box = [-Rb, yBase - g / 2, 2 * hook + rn, top];
  return { b, A, Rb, rn, g, hook, beta, sw, rho2, rho3, L3, LshAx, L, Q, sigma, len, eta, turn, mu1: (TAU * Rb) / b, ref, box, wallY, names: NAMES };
}

const shapes = new Map();
function shapeFor(b, A) {
  const key = b.toFixed(9) + '/' + A.toFixed(9);
  let s = shapes.get(key);
  if (!s) { s = bottleShape(b, A); shapes.set(key, s); }
  return s;
}

/** The stage parameters at t: f (flap), a (roll), h (hook), each 0 -> 1, C2 in t; the moves overlap by T.ov. */
function schedule(T, t, out) {
  t = clamp01(t);
  const a0 = T.tF - T.ov, h0 = T.tR - T.ov;
  out.f = ease(t / T.tF, 0, T.ramp / T.tF);
  out.a = ease((t - a0) / (T.tR - a0), T.ramp / (T.tR - a0), T.ramp / (T.tR - a0));
  out.h = ease((t - h0) / (1 - h0), T.ramp / (1 - h0), 0);
  return out;
}

/**
 * The keel at given stage parameters: for every piece its state at its lower end (position, height, heading, pitch)
 * and the rates of heading and pitch along it. K is reused.
 */
function buildKeel(S, st, K) {
  const { f, a, h } = st;
  const az = S5(a);
  const sig = 1 + (S.sigma - 1) * az;                           // the stretch along comes with the roll: the hook only bends
  K.sig = sig;
  K.mu = 1 + (S.mu1 - 1) * az;                                  // ... and the stretch across
  K.w = S5(h);
  const flap = -PI * f;
  // rates per paper length
  for (let i = 0; i < NP; i++) { K.kphi[i] = (h * S.turn[i]) / S.len[i]; K.kpsi[i] = 0; }
  K.kpsi[P_U] = -flap / S.len[P_U];                             // from -pi f (inner end) to 0
  shoulderTable(az * S.g, S.len[P_SH], sig, K.sh);
  K.shRise = az * S.g;
  // the held row: in the middle of the body, heading 0, on the floor
  const refS = S.ref - S.eta[P_BODY];
  K.x0[P_BODY] = 0; K.y0[P_BODY] = S.ref - sig * refS; K.z0[P_BODY] = 0; K.ph0[P_BODY] = 0; K.ps0[P_BODY] = 0;
  // forward: body -> rim outside
  for (let i = P_BODY; i < NP - 1; i++) {
    keelAt(S, K, i, S.len[i], K.tmp);
    K.x0[i + 1] = K.tmp[0]; K.y0[i + 1] = K.tmp[1]; K.z0[i + 1] = K.tmp[2]; K.ph0[i + 1] = K.tmp[3]; K.ps0[i + 1] = 0;
  }
  // backward: body -> rim inside. A piece's lower end from its upper end: the same arc, run backward. The pitch is 0
  // at the upper end of the U and -pi f from its lower end on (the flap)
  let ux = K.x0[P_BODY], uy = K.y0[P_BODY], uz = 0, uph = 0;
  for (let i = P_BODY - 1; i >= 0; i--) {
    const l = S.len[i], upperPitch = i === P_U ? 0 : flap;
    arcRun(uph, K.kphi[i], upperPitch, K.kpsi[i], sig, -l, K.tmp);
    ux += K.tmp[0]; uy += K.tmp[1]; uz += K.tmp[2]; uph -= K.kphi[i] * l;
    K.x0[i] = ux; K.y0[i] = uy; K.z0[i] = uz; K.ph0[i] = uph; K.ps0[i] = flap;
  }
  return K;
}

/**
 * A run of the keel from a base state by the paper length s (either sign): heading ph + kph s', pitch ps + kps s'
 * (only one of the two rates is not 0 in any piece). out = [dx, dy, dz].
 */
function arcRun(ph, kph, ps, kps, sig, s, out) {
  let along, dz;
  if (kps !== 0) {
    const q = kps * s, sc = sinc(q), cc = cosc(q), cp = Math.cos(ps), sp = Math.sin(ps);
    along = sig * s * (cp * sc - sp * cc); dz = sig * s * (sp * sc + cp * cc);
    out[0] = along * Math.sin(ph); out[1] = along * Math.cos(ph); out[2] = dz;
    return out;
  }
  const cp = Math.cos(ps), q = kph * s, sc = sinc(q), cc = cosc(q), sph = Math.sin(ph), cph = Math.cos(ph), l = sig * s * cp;
  out[0] = l * (sph * sc + cph * cc); out[1] = l * (cph * sc - sph * cc); out[2] = sig * s * Math.sin(ps);
  return out;
}

/** The keel in piece i at the paper length s from its lower end (s may run past the ends of the first and last piece): out = [x, y, z, heading]. */
function keelAt(S, K, i, s, out) {
  if (i === P_SH) {
    const u = s / S.len[i];
    out[0] = K.x0[i]; out[1] = K.y0[i] + shoulderAt(K.sh, u); out[2] = K.z0[i] + K.shRise * S5(u); out[3] = 0;
    return out;
  }
  arcRun(K.ph0[i], K.kphi[i], K.ps0[i], K.kpsi[i], K.sig, s, out);
  out[0] += K.x0[i]; out[1] += K.y0[i]; out[2] += K.z0[i]; out[3] = K.ph0[i] + K.kphi[i] * s;
  return out;
}

function newKeel() {
  const A = () => new Float64Array(NP);
  return { sig: 1, mu: 1, w: 0, kphi: A(), kpsi: A(), x0: A(), y0: A(), z0: A(), ph0: A(), ps0: A(), sh: new Float64Array(2 * (NSH + 1)), shRise: 0, tmp: [0, 0, 0, 0] };
}

function identityMap(x, y, cell, out) { out[0] = x; out[1] = y; out[2] = 0; return out; }

export default function createFold(group, domain, mesh, opts = {}) {
  const T = opts && opts.tune ? { ...TUNE, ...opts.tune } : TUNE, side = T.side < 0 ? -1 : 1;
  // the mesh: fine enough for a round tube (as the roll folds)
  const want = opts && opts.density !== undefined ? opts.density : rollDensity(group);
  if (!mesh || !mesh.tri) mesh = buildMesh(group, domain, want ? { density: want } : {});
  const gl = findGlide(group);
  const [ax, ay] = lineDir(gl.dir[0], gl.dir[1]);                // along the glide axes: the tube
  const sx = side * ay, sy = -side * ax;                         // across them: rolled; the neck hooks toward +across
  const A = Math.abs(gl.dist), b = latticePeriod(group, sx, sy);
  const sRef = gl.point[0] * sx + gl.point[1] * sy;              // glide axes: across = sRef + k b / 2
  const S = shapeFor(b, A);

  // THE ANCHOR: the glide axis nearest it is the tube's keel line, its place along is eta = 0
  const p = domain.seedActual || domain.seed, an = anchorOf(opts && opts.anchor) || p;
  const anS = an[0] * sx + an[1] * sy, anA = an[0] * ax + an[1] * ay;
  const sAxis = sRef + (b / 2) * Math.round((anS - sRef) / (b / 2) - 1e-9);   // ties: the lower one
  const O = [sAxis * sx + anA * ax, sAxis * sy + anA * ay];
  // the element of the group that carries the anchored frame's tile to the tile next to the seed:
  // (xi, eta) -> ((-1)^m xi + k b, eta + m A)
  const pS = p[0] * sx + p[1] * sy - sAxis, pA = p[0] * ax + p[1] * ay - anA;
  const m = Math.round(pA / A - 1e-9), kk = Math.round(pS / b - 1e-9), flip = (m & 1) !== 0;
  const moved = m !== 0 || kk !== 0;
  const vS = kk * b, vA = m * A;
  // the pulled-back seed's place across: the sheet is rolled about its own middle (as the torus is), and the closed
  // tube then turns about its core, by at most half a turn, until the keel line is underneath
  const xiC = (flip ? -1 : 1) * (pS - vS), coreTurn = (TAU * xiC) / b;

  // the closed bottle is centred on the anchor: the held row drifts there while the tile folds
  const Dx = -0.5 * (S.box[0] + S.box[2]), Dy = -0.5 * (S.box[1] + S.box[3]);
  const shear = clamp01(T.shear) * A, sinB = Math.sin(S.beta), cosB = Math.cos(S.beta);
  /** How far along the neck the wall lies from the plane circle of a rim, at the angle th round the neck (outside frame). */
  const saddle = (th) => { const c = S.rn * Math.cos(th); return (S.Rb - S.rn * Math.sin(th) * cosB - Math.sqrt(S.Rb * S.Rb - c * c)) / sinB; };
  const etaLo = S.eta[0], etaHi = S.eta[NP];

  /** The map of the anchored frame at t: (xi, eta) -> out (keel frame X across, Y along, Z up; before the drift). */
  function frameMap(t) {
    const st = schedule(T, t, { f: 0, a: 0, h: 0 }), K = buildKeel(S, st, newKeel());
    const a = st.a, mu = K.mu, kth = (TAU * a) / b, kth1 = TAU / b, w = K.w, sig = K.sig, row = [0, 0, 0, 0];
    const drift = S5(0.5 * (st.a + st.h)), dx = Dx * drift, dy = Dy * drift;   // the sheet lies still while the flap folds
    // a sheet rolled about its own middle stands beside the keel line by xiC; once the tube has closed (a = 1: the
    // core is Rb above the floor) it rolls over to it, turning about its core
    const roll = xiC !== 0 && t > T.tR ? S5((t - T.tR) / (1 - T.tR)) : 0, del = coreTurn * roll, beside = xiC * (1 - roll);
    const cd = Math.cos(del), sd = Math.sin(del), core = S.Rb;
    /** A point of the base strip (eta within the rims, or a little past them along the straight neck). */
    const base = (xi, eta, out) => {
      // the rows near a rim are sheared onto the wall
      let e = eta;
      if (w > 0) {
        const dA = (etaHi - eta) / shear, dB = (eta - etaLo) / shear;
        if (dA < 1 && dA > -1) e += (w * (1 - S5(Math.abs(dA))) * saddle(kth1 * xi)) / sig;
        else if (dB < 1 && dB > -1) e += (w * (1 - S5(Math.abs(dB))) * saddle(-kth1 * xi)) / sig;
      }
      let i = 0;
      while (i < NP - 1 && e >= S.eta[i + 1]) i++;
      keelAt(S, K, i, e - S.eta[i], row);
      const x = xi - xiC, th = kth * x, sn = Math.sin(th), cs = Math.cos(th), z = row[2], ph = row[3];
      let q = mu * x * sinc(th) - z * sn, up = mu * x * cosc(th) + z * cs;
      if (del !== 0) { const v = up - core, q2 = q * cd - v * sd; up = core + v * cd + q * sd; q = q2; }
      q += beside;
      const nx = Math.cos(ph), ny = -Math.sin(ph);
      out[0] = row[0] + q * nx + dx; out[1] = row[1] + q * ny + dy; out[2] = up;
      return out;
    };
    // rows beyond a rim (another tile's): along the straight neck at first, drawn to their true place — the row of
    // the tube they are the glide image of — as the rims close. G: the gaps still open between the rims on the way
    const tau = S5(st.h), B = [0, 0, 0], R1 = [0, 0, 0], R2 = [0, 0, 0];
    return (xi, eta, out) => {
      const m = Math.floor((eta - etaLo) / A);
      if (m === 0 || eta === etaHi) return base(xi, eta, out);
      base(xi, eta, out);
      if (tau === 0) return out;
      const odd = (m & 1) !== 0;
      base(odd ? -xi : xi, eta - m * A, B);
      let gx = 0, gy = 0, gz = 0;
      for (let j = 1, n = Math.abs(m); j <= n; j++) {
        // crossing the j-th rim on the way: from the rim on this side to its partner on the other
        const sNear = (j & 1) ? xi : -xi, sFar = -sNear;
        if (m > 0) { base(sFar, etaLo, R1); base(sNear, etaHi, R2); } else { base(sFar, etaHi, R1); base(sNear, etaLo, R2); }
        gx += R1[0] - R2[0]; gy += R1[1] - R2[1]; gz += R1[2] - R2[2];
      }
      out[0] += tau * (B[0] - out[0] - gx); out[1] += tau * (B[1] - out[1] - gy); out[2] += tau * (B[2] - out[2] - gz);
      return out;
    };
  }

  /** The map of the plane at t. */
  function at(t) {
    if (!(t > 0)) return identityMap;
    const tt = t >= 1 ? 1 : t, F = frameMap(tt), o = [0, 0, 0];
    if (!moved) {
      return (x, y, cell, out) => {
        F(x * sx + y * sy - sAxis, x * ax + y * ay - anA, o);
        out[0] = O[0] + o[0] * sx + o[1] * ax; out[1] = O[1] + o[0] * sy + o[1] * ay; out[2] = o[2];
        return out;
      };
    }
    // the tile next to the seed is g of the anchored one: fold g^-1 x, and come back by a slide (and, when g turns
    // the tile over, a half turn about the keel line, lifted so that nothing dips under the plane)
    const u = S5(tt), back = 1 - u, turn = flip ? PI * back : 0, ct = Math.cos(turn), sn = Math.sin(turn);
    const lift = flip ? 0.55 * b * Math.sin(turn) : 0, bS = back * vS, bA = back * vA;
    return (x, y, cell, out) => {
      let xi = x * sx + y * sy - sAxis - vS, eta = x * ax + y * ay - anA - vA;
      if (flip) xi = -xi;
      F(xi, eta, o);
      let X = o[0], Z = o[2];
      if (flip) { const zz = Z - lift, X2 = X * ct - zz * sn; Z = lift + X * sn + zz * ct; X = X2; }
      X += bS; const Y = o[1] + bA;
      out[0] = O[0] + X * sx + Y * ax; out[1] = O[1] + X * sy + Y * ay; out[2] = Z;
      return out;
    };
  }

  // the lines of the tile that land on the curve where the bottle passes through itself: along = anchor +- A/2 (mod A)
  let rimLines = null;
  const findRimLines = () => {
    const warp = domain.warp, tmp = [0, 0], size = domain.size || Math.sqrt(group.domainArea);
    const inside = (x, y) => { if (warp && warp.inv) { warp.inv(x, y, tmp); return domain.contains(tmp[0], tmp[1], 1e-9); } return domain.contains(x, y, 1e-9); };
    const lines = [], reach = A + b, N = Math.ceil((2 * reach * 48) / size);
    const k0 = Math.round(pA / A - 0.5);
    for (let k = k0 - 2; k <= k0 + 3; k++) {
      const off = (k + 0.5) * A;                                 // along, from the anchor
      const px = (s) => O[0] + off * ax + (pS + s) * sx, py = (s) => O[1] + off * ay + (pS + s) * sy;
      const edge = (sIn, sOut) => { for (let it = 0; it < 30; it++) { const mid = (sIn + sOut) / 2; if (inside(px(mid), py(mid))) sIn = mid; else sOut = mid; } return sIn; };
      let run = [], prevIn = false, prevS = -reach;
      for (let i = 0; i <= N + 1; i++) {
        const s = -reach + (2 * reach * i) / N, isIn = i <= N && inside(px(s), py(s));
        if (isIn && !prevIn && i > 0) { const e = edge(s, prevS); run.push(px(e), py(e)); }
        if (isIn) run.push(px(s), py(s));
        if (!isIn && prevIn) {
          const e = edge(prevS, s); run.push(px(e), py(e));
          if (run.length >= 4) lines.push(Float64Array.from(run));
          run = [];
        }
        prevIn = isIn; prevS = s;
      }
    }
    return lines;
  };

  const C = [O[0], O[1]];
  return {
    mesh, type: 'klein', duration: T.duration, anchor: anchorOf(opts && opts.anchor),
    // the copy of the anchor the tile is folded onto: g(anchor)
    anchorImage: anchorOf(opts && opts.anchor) ? [O[0] + ((flip ? -1 : 1) * (anS - sAxis) + vS) * sx + vA * ax, O[1] + ((flip ? -1 : 1) * (anS - sAxis) + vS) * sy + vA * ay] : null,
    stops: [{ t: 0, label: 'flat' }, { t: T.tF, label: 'folded over' }, { t: T.tR, label: 'tube in a tube' }, { t: 1, label: 'Klein bottle' }],
    times: { flap: T.tF, tube: T.tR, overlap: T.ov },
    params: {
      axis: [ax, ay], across: [sx, sy], glide: A, period: b, bodyRadius: S.Rb, neckRadius: S.rn, hookRadius: S.hook, beta: S.beta,
      stretch: S.sigma, stretchAcross: [(TAU * S.rn) / b, S.mu1], flip, moved, center: [C[0], C[1], S.Rb], shape: S,
      // the closed body's axis (a line along `axis` through this point) and where along it the wall is a cylinder
      wall: { point: [O[0] + Dx * sx, O[1] + Dx * sy, S.Rb], radius: S.Rb, from: S.ref - 0.5 * S.L[P_BODY] + Dy, to: S.ref + 0.5 * S.L[P_BODY] + Dy },
    },
    schedule(t) { return schedule(T, t, { f: 0, a: 0, h: 0 }); },
    /** Which move is under way at t, in words. */
    stage(t) {
      const u = clamp01(t);
      if (u <= 0) return { stage: 'flat', text: '' };
      if (u < T.tF - 0.5 * T.ov) return { stage: 'flap', text: 'one end folds over: it will be the neck inside' };
      if (u < T.tR - 0.5 * T.ov) return { stage: 'roll', text: 'the doubled sheet rolls up: a tube inside a tube' };
      if (u < 1) return { stage: 'hook', text: 'the neck hooks round to meet its other end through the wall' };
      return { stage: 'closed', text: 'the two ends are sewn through the wall' };
    },
    at,
    /** The lines of the tile that become the curve where the bottle passes through itself, at t (3D polylines). */
    doubleLine(t) {
      if (!rimLines) rimLines = findRimLines();
      const F = at(t), o = [0, 0, 0];
      return rimLines.map((ln) => {
        const pts = new Float32Array((ln.length / 2) * 3);
        for (let i = 0, j = 0; i < ln.length; i += 2, j += 3) { F(ln[i], ln[i + 1], 0, o); pts[j] = o[0]; pts[j + 1] = o[1]; pts[j + 2] = o[2]; }
        return pts;
      });
    },
  };
}
