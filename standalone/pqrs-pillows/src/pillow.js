// pillow.mjs — the geometry of ONE PILLOW {p, q, L} and of two pillows joined along their loop, with meshes.
//
// A pillow {p, q, L} is a sphere with two cone points P (angle 2 pi / p), Q (angle 2 pi / q) and one geodesic
// boundary loop (the cuff) of length L, of curvature -1. {2, 2, L} has no area in curvature -1 (a doubled segment);
// in curvature 0 it is the flat pocket of 2222, of any height.
//
// Pure: no DOM, no imports. Formulas, derivations and numeric checks: NOTES.md. The checks: check.mjs.
//
// Three charts are used, all "Fermi": (s, theta), theta the arclength along a geodesic line, s the signed
// distance from it; metric ds^2 + cosh^2(s) dtheta^2 (flat: ds^2 + dtheta^2).
//   pillow chart     the line is the pillow's cuff, the pillow is 0 <= s <= roof(theta), P at theta = 0,
//                    Q at theta = L/2, theta read mod L, and (roof(theta), theta) ~ (roof(theta), -theta)
//   orbifold chart   the line is the waist; {P, Q} on s < 0, {R, S} on s > 0; P's foot at theta = -cuff/4,
//                    Q's at +cuff/4, R's at -cuff/4 + tw cuff, S's at +cuff/4 + tw cuff
//                    (this is the engine's frame before its recentring: handles.js fourConeCentered)
//   crown            the surface of revolution r = (L / 2 pi) cosh s in R^3 on which the chart is an isometry
//
// THE ENGINE'S L. Functions that take `orders` take the engine's state numbers (L, tw): L is the length of the
// cut, except for 2222, where the engine's L is the distance |AB| = half the cut. `cuffOf(orders, L)` is the
// loop's length either way. Functions that take (p, q, L) take the loop's length.

const PI = Math.PI, TAU = 2 * Math.PI;
const { sinh, cosh, tanh, asinh, acosh, atanh, sqrt, sin, cos, abs, floor, max, min, hypot, atan2, asin, acos } = Math;

/** x brought into (-period/2, period/2]. */
export const wrapSym = (x, period) => x - period * Math.ceil(x / period - 0.5);

// =====================================================================================================
// 1. The half-pillow: the quadrilateral c1 P Q c2, right angles at c1, c2 on the cuff, |c1 c2| = a = L/2,
//    angle al = pi/p at P and be = pi/q at Q. Six data: al, be, a (corners) and d = |PQ|, hP = |c1 P|, hQ = |c2 Q|.
// =====================================================================================================

/** The six data from the three corner data, for any angles 0 < al, be < pi (not only pi / whole number). */
export function sixFromCorners(al, be, a) {
  const ca = cos(al), sa = sin(al), cb = cos(be), sb = sin(be), cha = cosh(a), sha = sinh(a);
  const hP = asinh((cb + ca * cha) / (sa * sha));                // F4 of math-general.md (engine: hgt)
  const hQ = asinh((ca + cb * cha) / (sb * sha));
  const sh2 = sinh(a / 2), c2 = cos((al + be) / 2);
  const d = 2 * asinh(sqrt((sh2 * sh2 + c2 * c2) / (sa * sb)));  // F3 in the half-argument form (engine: pairDistance)
  return { al, be, a, d, hP, hQ };
}

/**
 * The numbers of the pillow {p, q, L} (curvature -1): heights hP, hQ, seal d, the least distance m from the cuff
 * to the seal, where along the cuff it is attained (uP from P's foot, uQ from Q's), where along the seal
 * (dP from P, dQ from Q), the area. Orders are numbers >= 2; (2, 2) is degenerate: everything on the cuff.
 */
export function halfPillow(p, q, L) {
  const al = PI / p, be = PI / q, a = L / 2;
  const degenerate = p === 2 && q === 2;
  if (degenerate) return { p, q, L, al, be, a, hP: 0, hQ: 0, d: a, m: 0, uP: 0, uQ: a, dP: 0, dQ: a, area: 0, degenerate, flat: false };
  const six = sixFromCorners(al, be, a);
  const ca = p === 2 ? 0 : cos(al), cb = q === 2 ? 0 : cos(be), cha = cosh(a), sha = sinh(a);
  const shm = sqrt(ca * ca + cb * cb + 2 * ca * cb * cha) / sha;                // sinh m
  const m = asinh(shm);
  const uP = asinh(ca / shm), uQ = asinh(cb / shm);                            // uP + uQ = a
  const dP = p === 2 ? 0 : atanh(ca / tanh(six.hP)), dQ = q === 2 ? 0 : atanh(cb / tanh(six.hQ));   // dP + dQ = d (F7)
  return { p, q, L, al, be, a, hP: six.hP, hQ: six.hQ, d: six.d, m, uP, uQ, dP, dQ, area: 2 * (PI - al - be), degenerate, flat: false };
}

/**
 * The pillow {p, q, L}: halfPillow's numbers and
 *   roof(theta)       the distance along the perpendicular at theta from the cuff to the seal PQ; even, period L
 *   roofPrime(theta)  its derivative; odd; at 0 and L/2 the one-sided value from inside [0, L/2]
 *   roofAt(x)         roof for 0 <= x <= L/2 (no wrapping: the fast path)
 *   areaUnder(x1, x2) the area between the perpendiculars at x1 <= x2 in [0, L/2], under the roof
 */
export function pillow(p, q, L) {
  const hp = halfPillow(p, q, L), { a, hP, hQ, m, uP } = hp;
  if (hp.degenerate) return { ...hp, roof: () => 0, roofPrime: () => 0, roofAt: () => 0, areaUnder: () => 0 };
  const tP = tanh(hP), tQ = tanh(hQ), isha = 1 / sinh(a), shm = sinh(m);
  const tanhRoof = (x) => (tP * sinh(a - x) + tQ * sinh(x)) * isha;
  const roofAt = (x) => (x <= 0 ? hP : x >= a ? hQ : atanh(tanhRoof(x)));
  const roof = (theta) => roofAt(abs(wrapSym(theta, L)));
  const roofPrime = (theta) => {
    const w = wrapSym(theta, L), x = abs(w), v = tanhRoof(x);
    const dv = (tQ * cosh(x) - tP * cosh(a - x)) * isha / (1 - v * v);
    return w < 0 ? -dv : dv;
  };
  const areaUnder = (x1, x2) => asin(shm * sinh(x2 - uP)) - asin(shm * sinh(x1 - uP));
  return { ...hp, roof, roofPrime, roofAt, areaUnder };
}

/** The flat pocket {2, 2, cuff} of height `height` (curvature 0): a cylinder of circumference cuff pressed flat at one end. */
export function flatPillow(cuff, height) {
  const a = cuff / 2;
  return {
    p: 2, q: 2, L: cuff, al: PI / 2, be: PI / 2, a, hP: height, hQ: height, d: a, m: height, uP: 0, uQ: a, dP: 0, dQ: a,
    area: cuff * height, degenerate: false, flat: true,
    roof: () => height, roofPrime: () => 0, roofAt: () => height, areaUnder: (x1, x2) => height * (x2 - x1),
  };
}

// ---- any three of the six data --------------------------------------------------------------------

/** All real roots x of X cosh x - Y sinh x = Z. */
function hypRoots(X, Y, Z) {
  if (abs(X) > abs(Y)) {                       // = R cosh(x - phi), R cosh phi = X, R sinh phi = Y
    const R = Math.sign(X) * sqrt(X * X - Y * Y), phi = atanh(Y / X), c = Z / R;
    if (!(c >= 1)) return [];
    const w = acosh(c);
    return w > 0 ? [phi + w, phi - w] : [phi];
  }
  if (abs(X) < abs(Y)) {                       // = -R sinh(x - phi), R cosh phi = Y, R sinh phi = X
    const R = Math.sign(Y) * sqrt(Y * Y - X * X), phi = atanh(X / Y);
    return [phi - asinh(Z / R)];
  }
  if (X === 0 || !(Z / X > 0)) return [];
  return [X === Y ? -Math.log(Z / X) : Math.log(Z / X)];
}
/** All roots b in (0, pi) of X sin b - Y cos b = Z. */
function trigRoots(X, Y, Z) {
  const R = hypot(X, Y), phi = atan2(Y, X), c = Z / R;
  if (!(abs(c) <= 1)) return [];
  const w = asin(c), out = [];
  for (const b0 of [phi + w, phi + PI - w]) {
    const b = b0 - TAU * floor(b0 / TAU);
    if (b > 0 && b < PI && !out.some((o) => abs(o - b) < 1e-12)) out.push(b);
  }
  return out;
}
function cornersFromSides(d, hP, hQ) {         // SSS
  const cha = (cosh(d) + sinh(hP) * sinh(hQ)) / (cosh(hP) * cosh(hQ));
  if (!(cha >= 1)) return [];
  const cA = (cosh(d) * sinh(hP) - sinh(hQ)) / (sinh(d) * cosh(hP)), cB = (cosh(d) * sinh(hQ) - sinh(hP)) / (sinh(d) * cosh(hQ));
  if (!(abs(cA) <= 1 && abs(cB) <= 1)) return [];
  return [[acos(cA), acos(cB), acosh(cha)]];
}
/** Candidate corner triples (al, be, a) for the twelve patterns that are not mirror images of another; else null. */
function cornerCandidates(g) {
  const { al, be, a, d, hP, hQ } = g, D = (x) => x !== undefined;
  const pos = (x) => x > 0;
  if (D(al) && D(be) && D(a)) return [[al, be, a]];                                                          // corners
  if (D(d) && D(hP) && D(hQ)) return cornersFromSides(d, hP, hQ);                                              // SSS
  if (D(a) && D(hP) && D(hQ)) return cornersFromSides(acosh(cosh(hP) * cosh(hQ) * cosh(a) - sinh(hP) * sinh(hQ)), hP, hQ);   // SAS at the cuff
  if (D(al) && D(d) && D(hP)) { const sh = cosh(d) * sinh(hP) - sinh(d) * cosh(hP) * cos(al); return sh > 0 ? cornersFromSides(d, hP, asinh(sh)) : []; }   // SAS at P
  if (D(al) && D(be) && D(d)) { const c = cosh(d) * sin(al) * sin(be) - cos(al) * cos(be); return c > 1 ? [[al, be, acosh(c)]] : []; }   // ASA on the seal (F1)
  if (D(al) && D(a) && D(hP)) { const c = sin(al) * sinh(a) * sinh(hP) - cos(al) * cosh(a); return abs(c) < 1 ? [[al, acos(c), a]] : []; }   // ASA on P's leg
  if (D(al) && D(be) && D(hQ)) return hypRoots(-cos(be), -sin(be) * sinh(hQ), cos(al)).filter(pos).map((x) => [al, be, x]);   // AAS
  if (D(al) && D(a) && D(hQ)) return trigRoots(sinh(a) * sinh(hQ), cosh(a), cos(al)).map((b) => [al, b, a]);                  // AAS
  if (D(al) && D(a) && D(d)) return trigRoots(sin(al) * cosh(d), cos(al), cosh(a)).map((b) => [al, b, a]);                    // AAS
  if (D(al) && D(hP) && D(hQ)) return hypRoots(sinh(hP), cosh(hP) * cos(al), sinh(hQ)).filter(pos).flatMap((x) => cornersFromSides(x, hP, hQ));   // SSA: 0, 1 or 2
  if (D(be) && D(d) && D(hP)) return hypRoots(-sinh(d) * cos(be), -cosh(d), sinh(hP)).filter(pos).flatMap((x) => cornersFromSides(d, hP, x));    // SSA: unique
  if (D(a) && D(d) && D(hP)) return hypRoots(cosh(hP) * cosh(a), sinh(hP), cosh(d)).filter(pos).flatMap((x) => cornersFromSides(d, hP, x));      // SSA: 0, 1 or 2
  return null;
}
/**
 * Any three of the six data { al, be, a, d, hP, hQ } of a half-pillow of curvature -1 -> every half-pillow with
 * them: an array (possibly empty, possibly two) of { al, be, a, d, hP, hQ, p, q, L, acute }.
 * `acute` marks the solutions with al, be <= pi/2, the only ones a pillow with cone orders >= 2 can use.
 */
export function solveHalfPillow(given, { tol = 1e-7 } = {}) {
  const KEYS = ['al', 'be', 'a', 'd', 'hP', 'hQ'];
  const keys = KEYS.filter((k) => given[k] !== undefined);
  if (keys.length !== 3) throw new Error('solveHalfPillow: give exactly three of al, be, a, d, hP, hQ');
  const mirror = (g) => ({ al: g.be, be: g.al, a: g.a, d: g.d, hP: g.hQ, hQ: g.hP });
  let cands = cornerCandidates(given), flipped = false;
  if (cands === null) { cands = cornerCandidates(mirror(given)); flipped = true; }
  if (cands === null) throw new Error('solveHalfPillow: unknown pattern');
  const out = [];
  for (const [al0, be0, a] of cands) {
    const [al, be] = flipped ? [be0, al0] : [al0, be0];
    if (!(a > 0 && al > 0 && al < PI && be > 0 && be < PI)) continue;
    const six = sixFromCorners(al, be, a);
    if (!(six.hP >= -tol && six.hQ >= -tol)) continue;                 // both corners on the pillow's side of the cuff
    if (!keys.every((k) => abs(six[k] - given[k]) <= tol * max(1, abs(given[k])))) continue;
    if (out.some((o) => abs(o.al - al) + abs(o.be - be) + abs(o.a - a) < 1e-9)) continue;
    out.push({ ...six, p: PI / al, q: PI / be, L: 2 * a, acute: al <= PI / 2 + 1e-12 && be <= PI / 2 + 1e-12 });
  }
  return out;
}
/**
 * The flat half-pocket is a rectangle a by h: al = be = pi/2, d = a, hP = hQ = h. Three of the six data fix it
 * only if they hold a width (a or d) AND a height (hP or hQ). Returns { a, h } with `undefined` for what is free.
 */
export function solveFlatHalfPillow(given) {
  const a = given.a ?? given.d, h = given.hP ?? given.hQ;
  return { a, h, determined: a !== undefined && h !== undefined };
}

// =====================================================================================================
// 2. Fermi coordinates about a line
// =====================================================================================================

/** The hyperboloid point (x, y, z), x^2 + y^2 - z^2 = -1, of Fermi coordinates (s, theta) about the x axis: the engine's offH. */
export function fermiToHyperboloid(s, theta, out = [0, 0, 0]) {
  const cs = cosh(s);
  out[0] = sinh(theta) * cs; out[1] = sinh(s); out[2] = cosh(theta) * cs;
  return out;
}
/** Exact hyperbolic distance between (s1, th1) and (s2, th2) of ONE Fermi chart (s signed). Stable for near points. */
export function dFermi(s1, th1, s2, th2) {
  const u = sinh((th1 - th2) / 2), v = sinh((s1 - s2) / 2);
  return 2 * asinh(sqrt(cosh(s1) * cosh(s2) * u * u + v * v));
}
/** The same for two points given as [s, theta] or { s, theta }. */
export function distFermi(a, b) {
  return dFermi(a.s ?? a[0], a.theta ?? a[1], b.s ?? b[0], b.theta ?? b[1]);
}

// =====================================================================================================
// 3. The crown: the surface of revolution r(s) = rho cosh s, rho = L / 2 pi, z'(s) = sqrt(1 - rho^2 sinh^2 s)
// =====================================================================================================

/** Carlson's R_F(x, y, z) by duplication (DLMF 19.36.1); at most one argument may be 0. */
export function carlsonRF(x, y, z) {
  const A0 = (x + y + z) / 3;
  let A = A0, p4 = 1;
  const Q = 400 * max(abs(A0 - x), abs(A0 - y), abs(A0 - z));
  while (p4 * Q > abs(A)) {
    const sx = sqrt(x), sy = sqrt(y), sz = sqrt(z), lam = sx * sy + sy * sz + sz * sx;
    A = (A + lam) / 4; x = (x + lam) / 4; y = (y + lam) / 4; z = (z + lam) / 4; p4 /= 4;
  }
  const X = 1 - x / A, Y = 1 - y / A, Z = -X - Y, E2 = X * Y - Z * Z, E3 = X * Y * Z;
  return (1 - E2 / 10 + E3 / 14 + (E2 * E2) / 24 - (3 * E2 * E3) / 44) / sqrt(A);
}
/** Carlson's R_D(x, y, z) by duplication (DLMF 19.36.2); z > 0, at most one of x, y may be 0. */
export function carlsonRD(x, y, z) {
  const A0 = (x + y + 3 * z) / 5;
  let A = A0, p4 = 1, sum = 0;
  const Q = 600 * max(abs(A0 - x), abs(A0 - y), abs(A0 - z));
  while (p4 * Q > abs(A)) {
    const sx = sqrt(x), sy = sqrt(y), sz = sqrt(z), lam = sx * sy + sy * sz + sz * sx;
    sum += p4 / (sz * (z + lam));
    A = (A + lam) / 4; x = (x + lam) / 4; y = (y + lam) / 4; z = (z + lam) / 4; p4 /= 4;
  }
  const X = 1 - x / A, Y = 1 - y / A, Z = -(X + Y) / 3, XY = X * Y, Z2 = Z * Z;
  const E2 = XY - 6 * Z2, E3 = (3 * XY - 8 * Z2) * Z, E4 = 3 * (XY - Z2) * Z2, E5 = XY * Z2 * Z;
  return (p4 * (1 - (3 * E2) / 14 + E3 / 6 + (9 * E2 * E2) / 88 - (3 * E4) / 22 - (9 * E2 * E3) / 52 + (3 * E5) / 26)) / (A * sqrt(A)) + 3 * sum;
}

/** The rim of the crown of a loop of length L: the last s at which it exists, arsinh(2 pi / L). */
export const sMax = (L) => asinh(TAU / L);

/** z(s) = integral_0^s sqrt(1 - rho^2 sinh^2 t) dt for 0 <= s <= arsinh(1 / rho), as Carlson integrals (exact). */
export function crownZ0(rho, s) {
  const U = sinh(s), U2 = U * U, w = max(0, 1 - rho * rho * U2);
  return U * carlsonRF(1, w, 1 + U2) - ((rho * rho * U2 * U) / 3) * carlsonRD(w, 1 + U2, 1);
}

/**
 * The meridian of the crown of a loop of length L, with the fallback past the rim.
 * Up to sEdge = arsinh(sqrt(1 - minSlope^2) / rho) it is exact. Past it the meridian goes on straight, at unit
 * speed, with the slope it has there (dz/ds = minSlope; 0: a flat flange at the rim's height), so meridians keep
 * their length and parallels come out too short by the factor `stretch(s)` < 1.
 * Returns { rho, sMax, sEdge, rEdge, zEdge, minSlope, rz(s, out) -> out = [r, z], stretch(s) } for s >= 0.
 */
export function crownProfile(L, minSlope = 0) {
  const rho = L / TAU, kap = sqrt(1 - minSlope * minSlope);
  const sEdge = asinh(kap / rho), rEdge = rho * cosh(sEdge), zEdge = crownZ0(rho, sEdge);
  const rz = (s, out = [0, 0]) => {
    if (s <= sEdge) { out[0] = rho * cosh(s); out[1] = crownZ0(rho, s); }
    else { out[0] = rEdge + kap * (s - sEdge); out[1] = zEdge + minSlope * (s - sEdge); }
    return out;
  };
  const stretch = (s) => (s <= sEdge ? 1 : (rEdge + kap * (s - sEdge)) / (rho * cosh(s)));
  return { L, rho, sMax: asinh(1 / rho), sEdge, rEdge, zEdge, minSlope, rz, stretch };
}
let lastProfile = null;
const profileFor = (L, minSlope) => (lastProfile && lastProfile.L === L && lastProfile.minSlope === minSlope ? lastProfile : (lastProfile = crownProfile(L, minSlope)));

/** Height z of the crown at distance s >= 0 from the loop (exact up to the rim, the fallback past it). */
export function crownZ(L, s, minSlope = 0) {
  return profileFor(L, minSlope).rz(abs(s))[1] * (s < 0 ? -1 : 1);
}

/**
 * The point of R^3 of the chart point (s, theta) on the crown of a loop of length L:
 *   (r cos phi, r sin phi, side * z(s)),  phi = 2 pi theta / L,  r = (L / 2 pi) cosh s.
 * s is the distance from the loop into the pillow (z is odd in s, so a signed s with side = 1 works as well);
 * side = +1 the crown above the waist, -1 the crown below. Seen from outside, theta runs to the right and
 * s upwards: (theta, s) -> the surface keeps orientation, so a print is not mirrored.
 */
export function crownPoint(L, s, theta, side = 1, out = [0, 0, 0], minSlope = 0) {
  const pr = profileFor(L, minSlope), as = abs(s), ph = (TAU * theta) / L;
  let r, z;
  if (as <= pr.sEdge) { r = pr.rho * cosh(as); z = crownZ0(pr.rho, as); }
  else { r = pr.rEdge + sqrt(1 - minSlope * minSlope) * (as - pr.sEdge); z = pr.zEdge + minSlope * (as - pr.sEdge); }
  out[0] = r * cos(ph); out[1] = r * sin(ph); out[2] = (s < 0 ? -side : side) * z;
  return out;
}
/** The flat sibling: a cylinder of circumference cuff. */
export function tubePoint(cuff, s, theta, side = 1, out = [0, 0, 0]) {
  const ph = (TAU * theta) / cuff, r = cuff / TAU;
  out[0] = r * cos(ph); out[1] = r * sin(ph); out[2] = side * s;
  return out;
}

// =====================================================================================================
// 4. Two pillows on one surface: the engine's (orders, L, tw)
// =====================================================================================================

/** True for 2222, the one flat case. */
export const isFlat = (orders) => orders[0] === 2 && orders[1] === 2 && orders[2] === 2 && orders[3] === 2;
/** The loop's length from the engine's L: L itself, except 2 L for 2222 (the engine's L is |AB| there). */
export const cuffOf = (orders, L) => (isFlat(orders) ? 2 * L : L);

/**
 * The two pillows of the engine's state (orders = [p, q, r, s], L, tw) and where they sit in the orbifold chart.
 * {P, Q} = pillow `lower` on s < 0, {R, S} = pillow `upper` on s > 0. The twist slides the upper pillow by
 * tw * cuff along the waist towards +theta: on the crown, a turn of `turn` = 2 pi tw, counter-clockwise seen
 * from above (from the upper pillow's side).
 * 2222: cuff = 2 L, the rows are 1 / L apart (area 2), the cut at the fraction `cut` of the way (the engine: 1/2).
 */
export function orbifold(orders, L, tw = 0, { cut = 0.5 } = {}) {
  const [p, q, r, s] = orders, flat = isFlat(orders), cuff = flat ? 2 * L : L;
  const lower = flat ? flatPillow(cuff, cut / L) : pillow(p, q, L);
  const upper = flat ? flatPillow(cuff, (1 - cut) / L) : pillow(r, s, L);
  const thP = -cuff / 4, thR = thP + tw * cuff;
  return {
    kind: flat ? 'E' : 'H', orders: orders.slice(0, 4), L, tw, cuff, turn: TAU * tw, lower, upper,
    thP, thQ: thP + cuff / 2, thR, thS: thR + cuff / 2,
    sP: -lower.hP, sQ: -lower.hQ, sR: upper.hP, sS: upper.hQ,
  };
}

/**
 * Where P, Q, R, S are: in the orbifold chart (s, theta), and on the crowns in R^3.
 * Returns { kind, cuff, turn, names: 'PQRS', s[4], theta[4], azimuth[4], xyz[4], inside[4], sMax, points: { P, Q, R, S } }.
 * `inside[i]`: the cone point lies within the rim, so its crown point is exact.
 * In the engine's pair frame the same points are Pmat * fermiToHyperboloid(s, theta) (hyperbolic) and
 * (theta, s + cut / L) (2222).
 */
export function conePositions(orders, L, tw = 0, opts = {}) {
  const g = opts.frame || orbifold(orders, L, tw, opts), flat = g.kind === 'E', minSlope = opts.minSlope || 0;
  const s = [g.sP, g.sQ, g.sR, g.sS], theta = [g.thP, g.thQ, g.thR, g.thS];
  const rim = flat ? Infinity : sMax(g.cuff);
  const xyz = s.map((si, i) => (flat ? tubePoint(g.cuff, si, theta[i]) : crownPoint(g.cuff, si, theta[i], 1, [0, 0, 0], minSlope)));
  const azimuth = theta.map((t) => (TAU * t) / g.cuff), inside = s.map((si) => abs(si) <= rim), points = {};
  for (let i = 0; i < 4; i++) points['PQRS'[i]] = { order: g.orders[i], s: s[i], theta: theta[i], azimuth: azimuth[i], xyz: xyz[i], inside: inside[i] };
  return { kind: g.kind, cuff: g.cuff, turn: g.turn, names: 'PQRS', s, theta, azimuth, xyz, inside, sMax: rim, points };
}

/** The hyperboloid point X turned by `ang` (counter-clockwise) about the hyperboloid point C. */
export function rotateAbout(X, C, ang, out = [0, 0, 0]) {
  const d = X[2] * C[2] - X[0] * C[0] - X[1] * C[1], c = cos(ang), sn = sin(ang);        // cosh of their distance
  const kx = C[1] * X[2] - C[2] * X[1], ky = C[2] * X[0] - C[0] * X[2], kz = C[1] * X[0] - C[0] * X[1];   // the Lorentz cross product C x X
  const x = d * C[0] + c * (X[0] - d * C[0]) + sn * kx, y = d * C[1] + c * (X[1] - d * C[1]) + sn * ky, z = d * C[2] + c * (X[2] - d * C[2]) + sn * kz;
  out[0] = x; out[1] = y; out[2] = z;
  return out;
}

/**
 * The charts' inverse: which point of which pillow is a point of the plane?
 *   g   orbifold(orders, L, tw) (a mesh's `frame`)
 *   X   hyperbolic: a hyperboloid point [x, y, z] in the orbifold chart's frame, the waist being the x axis
 *       (from the engine's pair frame: invH(Pmat) * point); 2222: a plane point [theta, s]
 * Walks through the tiling: across the waist when X is on its other side, along the waist by whole loops, and
 * across a seal by the turn about the pillow's first cone point that carries one copy of the seal onto the other.
 * Returns { k, sigma, thetaLocal, steps }: pillow k (0 = {P, Q}, 1 = {R, S}), its chart point; null if not found
 * within maxSteps turns (far points need many: each turn crosses one seal).
 */
export function toPillow(g, X, maxSteps = 400) {
  const flat = g.kind === 'E', cuff = g.cuff, P = [X[0], X[1], flat ? 1 : X[2]], C = [0, 0, 0];
  for (let step = 0; step <= maxSteps; step++) {
    let s, th;
    if (flat) { th = P[0]; s = P[1]; } else {
      const n = sqrt(max(1e-300, P[2] * P[2] - P[0] * P[0] - P[1] * P[1]));              // keep it on the hyperboloid
      P[0] /= n; P[1] /= n; P[2] /= n;
      s = asinh(P[1]); th = atanh(P[0] / P[2]);
    }
    let k = s < 0 ? 0 : 1, pl = k === 0 ? g.lower : g.upper;
    if (pl.degenerate) {
      if (abs(s) > 1e-13) {                      // a (2, 2) pair has no inside: fold through it, a half turn about its first point (on the waist)
        rotateAbout(P, fermiToHyperboloid(0, k === 0 ? g.thP : g.thR, C), PI, P);
        continue;
      }
      k = 1 - k; pl = k === 0 ? g.lower : g.upper; s = 0;
    }
    const base = k === 0 ? g.thP : g.thR, side = k === 0 ? -1 : 1, sig = side * s, thl = wrapSym(side * (th - base), cuff);
    const h = pl.roofAt(abs(thl));
    if (sig <= h * (1 + 1e-12) + 1e-14) return { k, sigma: min(max(sig, 0), h), thetaLocal: thl, steps: step };
    const thC = th - side * thl, turn = ((thl > 0 ? -1 : 1) * TAU) / g.orders[k === 0 ? 0 : 2];
    if (flat) { P[0] = 2 * thC - th; P[1] = 2 * side * pl.hP - s; }                       // a half turn
    else rotateAbout(P, fermiToHyperboloid(side * pl.hP, thC, C), turn, P);
  }
  return null;
}

/**
 * 2222 only: the three distances between cone points on the flat orbifold, which are the edge lengths of the closed
 * solid (the disphenoid of Twist of 2222: opposite edges equal). { PQ = RS, PR = QS, PS = QR } for the engine's
 * (L = |AB|, tw). Each is the shortest vector of one class mod 2 of the cone-point lattice Z (L, 0) + Z (2 L tw, 1 / L).
 */
export function flatTipDistances(L, tw) {
  const sl = 2 * L * tw, w = 1 / L, best = [Infinity, Infinity, Infinity];          // classes (1,0), (0,1), (1,1)
  const nMax = Math.ceil(sqrt(L ** 4 + 1)) + 1;                                      // a shortest vector has |n| w <= sqrt(L^2 + w^2)
  for (let n = -nMax; n <= nMax; n++) {
    const m0 = Math.round((-n * sl) / L);
    for (let m = m0 - 3; m <= m0 + 3; m++) {
      const cls = (m & 1) + 2 * (n & 1);
      if (cls === 0) continue;
      const len = hypot(m * L + n * sl, n * w);
      if (len < best[cls - 1]) best[cls - 1] = len;
    }
  }
  return { PQ: best[0], PR: best[1], PS: best[2], RS: best[0], QS: best[1], QR: best[2] };
}

// =====================================================================================================
// 5. Meshes
// =====================================================================================================
//
// A pillow's grid: nTheta columns round the cuff (column j at pillow-chart theta' = j cuff / nTheta, read in
// (-cuff/2, cuff/2]; column 0 is P's meridian, column nTheta/2 is Q's), nS + 1 rows at s = (i / nS) roof(theta').
// Row nS is the roof: its columns j and nTheta - j are ONE vertex (the seal), so the seal is a chain of
// nTheta/2 + 1 vertices from P to Q. Diagonals run towards the nearer cone point (each cone point has 4 triangles).
// "Open" vertices keep the two sides of a seal apart (the crown before it is closed); "closed" vertices are the
// surface's. Every triangle is listed counter-clockwise in (theta, s), which is counter-clockwise seen from outside.
//
// Two pillows: the waist ring belongs to the lower pillow, unless the upper one is a (2, 2) pair (then the ring is
// that pair's seal, folded, and belongs to the upper one). The other pillow starts at its row 1, and the band
// between the ring and that row is the ZIPPER STRIP: 2 nTheta triangles whose connectivity is the Delaunay stitch
// of two rings offset by tw * nTheta cells. Its triangles and its 2 nTheta cross edges come LAST in the arrays, so a
// change of twist rewrites only those (setTwist).

const topoCache = new Map();

function buildTopology(N, nS, specs, withStrip) {
  const key = `${N}/${nS}/${specs.map((sp) => `${+sp.deg}${sp.rowMin}`).join(',')}/${+withStrip}`;
  const hit = topoCache.get(key);
  if (hit) return hit;
  const H = N >> 1, Q4 = N >> 2, parts = [];
  let bo = 0, bc = 0;
  for (let k = 0; k < specs.length; k++) {
    const { deg, rowMin } = specs[k], roofRow = deg ? 0 : nS, nRows = roofRow - rowMin + 1;
    const pt = { k, deg, rowMin, roofRow, nRows, baseOpen: bo, baseClosed: bc, nOpen: nRows * N, nClosed: (nRows - 1) * N + H + 1 };
    bo += pt.nOpen; bc += pt.nClosed; parts.push(pt);
  }
  const nOpen = bo, nClosed = bc;
  const oi = (pt, i, j) => pt.baseOpen + (i - pt.rowMin) * N + j;
  const closedOf = new Uint32Array(nOpen), oPillow = new Uint8Array(nOpen);
  const copies = new Uint8Array(nClosed), firstOpen = new Uint32Array(nClosed).fill(0xffffffff);
  for (const pt of parts) for (let i = pt.rowMin; i <= pt.roofRow; i++) for (let j = 0; j < N; j++) {
    const o = oi(pt, i, j);
    const c = i === pt.roofRow ? pt.baseClosed + (pt.nRows - 1) * N + (j <= H ? j : N - j) : pt.baseClosed + (i - pt.rowMin) * N + j;
    closedOf[o] = c; oPillow[o] = pt.k; copies[c]++;
    if (firstOpen[c] === 0xffffffff) firstOpen[c] = o;
  }
  let nTriParts = 0;
  for (const pt of parts) { pt.triBase = nTriParts; nTriParts += 2 * N * (pt.roofRow - pt.rowMin); }
  const nTri = nTriParts + (withStrip ? 2 * N : 0);
  const triO = new Uint32Array(3 * nTri), triPillow = new Uint8Array(nTri);
  let t = 0;
  const tri = (a, b, c, k) => { triO[3 * t] = a; triO[3 * t + 1] = b; triO[3 * t + 2] = c; triPillow[t] = k; t++; };
  for (const pt of parts) for (let i = pt.rowMin; i < pt.roofRow; i++) for (let j = 0; j < N; j++) {
    const j1 = (j + 1) % N, v00 = oi(pt, i, j), v01 = oi(pt, i, j1), v10 = oi(pt, i + 1, j), v11 = oi(pt, i + 1, j1);
    const jm = j < H ? j : N - 1 - j;                 // the mirror cell on the theta' >= 0 half
    const back = (j < H) === (jm < Q4);               // the diagonal v01–v10 ("\"), else v00–v11 ("/"): towards the nearer cone point
    if (back) { tri(v00, v01, v10, pt.k); tri(v01, v11, v10, pt.k); } else { tri(v00, v01, v11, pt.k); tri(v00, v11, v10, pt.k); }
  }
  // the strip's two rings, each in the order of increasing orbifold-chart theta
  let stripB = null, stripT = null, owner = 0;
  if (withStrip) {
    owner = parts[1].deg ? 1 : 0;
    const rB = owner === 0 ? 0 : 1, rT = owner === 0 ? 1 : 0;
    stripB = new Uint32Array(N); stripT = new Uint32Array(N);
    for (let i = 0; i < N; i++) { stripB[i] = oi(parts[0], rB, (N - i) % N); stripT[i] = oi(parts[1], rT, i); }
    for (let k = nTriParts; k < nTri; k++) triPillow[k] = 1 - owner;
  }
  // edges: those of the pillows' own triangles and of the strip's two rings first, the strip's cross edges last
  const seen = new Set(), eC = [], eO = [];
  const addEdge = (oa, ob) => {
    const ca = closedOf[oa], cb = closedOf[ob];
    if (ca === cb) return;
    const k2 = ca < cb ? ca * nClosed + cb : cb * nClosed + ca;
    if (!seen.has(k2)) { seen.add(k2); eC.push(ca, cb); eO.push(oa, ob); }
  };
  for (let k = 0; k < nTriParts; k++) { const a = triO[3 * k], b = triO[3 * k + 1], c = triO[3 * k + 2]; addEdge(a, b); addEdge(b, c); addEdge(c, a); }
  if (withStrip) for (let i = 0; i < N; i++) { addEdge(stripB[i], stripB[(i + 1) % N]); addEdge(stripT[i], stripT[(i + 1) % N]); }
  else for (const pt of parts) if (pt.deg) for (let j = 0; j < N; j++) addEdge(oi(pt, 0, j), oi(pt, 0, (j + 1) % N));
  const nFixedEdges = eC.length >> 1, nEdge = nFixedEdges + (withStrip ? 2 * N : 0);
  const edgeC = new Uint32Array(2 * nEdge), edgeO = new Uint32Array(2 * nEdge);
  edgeC.set(eC); edgeO.set(eO);
  const topo = { key, N, nS, H, parts, nOpen, nClosed, nTri, nTriParts, nEdge, nFixedEdges, closedOf, oPillow, copies, firstOpen, triO, triPillow, edgeC, edgeO, stripB, stripT, owner, withStrip, oi };
  topoCache.set(key, topo);
  return topo;
}

function allocMesh(topo) {
  const { nOpen, nClosed, nTri, nEdge, N, H, parts } = topo;
  const triC = new Uint32Array(3 * nTri);
  for (let k = 0; k < 3 * topo.nTriParts; k++) triC[k] = topo.closedOf[topo.triO[k]];
  const seals = parts.map((pt) => {
    const chain = new Uint32Array(H + 1), openA = new Uint32Array(H + 1), openB = new Uint32Array(H + 1);
    for (let k = 0; k <= H; k++) { openA[k] = topo.oi(pt, pt.roofRow, k); openB[k] = topo.oi(pt, pt.roofRow, (N - k) % N); chain[k] = topo.closedOf[openA[k]]; }
    return { pillow: pt.k, chain, openA, openB, a: new Float64Array(3 * (H + 1)), b: new Float64Array(3 * (H + 1)) };
  });
  return {
    kind: 'H', orders: null, L: 0, tw: 0, cuff: 0, turn: 0, nTheta: N, nS: topo.nS,
    nVertices: nClosed, nTriangles: nTri, nEdges: nEdge,
    positions: new Float64Array(3 * nClosed),
    triangles: triC, triPillow: topo.triPillow.slice(),
    edges: topo.edgeC.slice(), restLength: new Float64Array(nEdge),
    s: new Float64Array(nClosed), theta: new Float64Array(nClosed), pillow: new Uint8Array(nClosed),
    cones: {}, waist: new Uint32Array(N), seals,
    strip: topo.withStrip ? { triStart: topo.nTriParts, triCount: 2 * N, edgeStart: topo.nFixedEdges, edgeCount: 2 * N, cells: 0, frac: 0 } : null,
    ringOwner: topo.owner, degenerate: parts.map((pt) => pt.deg),
    exact: true, rimExcess: 0, sMax: Infinity, minSlope: 0,
    open: {
      nVertices: nOpen, positions: new Float64Array(3 * nOpen), closedOf: topo.closedOf.slice(), triangles: topo.triO.slice(),
      s: new Float64Array(nOpen), theta: new Float64Array(nOpen), sigma: new Float64Array(nOpen), thetaLocal: new Float64Array(nOpen), pillow: topo.oPillow.slice(),
      edges: topo.edgeO.slice(),
    },
    _topo: topo, _r: new Float64Array(nOpen), _z: new Float64Array(nOpen), frame: null,
  };
}

/** Stage 1: everything that depends on the pillows' shapes (orders, L) and not on the twist. */
function fillShape(mesh, pls, kind, cuff, minSlope) {
  const topo = mesh._topo, { N, nS, H, parts } = topo, c = cuff / N, flat = kind === 'E';
  const o = mesh.open, sig = o.sigma, thl = o.thetaLocal, R = mesh._r, Z = mesh._z;
  const pr = flat ? null : crownProfile(cuff, minSlope), rho = cuff / TAU, kap = sqrt(1 - minSlope * minSlope);
  let excess = 0;
  for (const pt of parts) {
    const pl = pls[pt.k];
    for (let j = 0; j < N; j++) {
      const th = j <= H ? j * c : (j - N) * c;
      const hj = pt.deg ? 0 : j === 0 ? pl.hP : j === H ? pl.hQ : pl.roofAt(abs(th));
      for (let i = pt.rowMin; i <= pt.roofRow; i++) {
        const idx = pt.baseOpen + (i - pt.rowMin) * N + j, sg = pt.deg ? 0 : i === nS ? hj : (i / nS) * hj;
        sig[idx] = sg; thl[idx] = th;
        if (flat) { R[idx] = rho; Z[idx] = sg; }
        else if (sg <= pr.sEdge) { R[idx] = rho * cosh(sg); Z[idx] = sg === 0 ? 0 : crownZ0(rho, sg); }
        else { R[idx] = pr.rEdge + kap * (sg - pr.sEdge); Z[idx] = pr.zEdge + minSlope * (sg - pr.sEdge); }
      }
      if (!flat && hj - pr.sMax > excess) excess = hj - pr.sMax;
    }
  }
  mesh.kind = kind; mesh.cuff = cuff; mesh.minSlope = minSlope;
  mesh.sMax = flat ? Infinity : pr.sMax; mesh.rimExcess = excess; mesh.exact = excess <= 0 && (flat || minSlope === 0 || pls.every((pl) => max(pl.hP, pl.hQ) <= pr.sEdge));
  // rest lengths of the fixed edges: each lies in one pillow, so its own chart serves
  const eo = o.edges, rest = mesh.restLength, nF = topo.nFixedEdges;
  if (flat) for (let e = 0; e < nF; e++) { const a = eo[2 * e], b = eo[2 * e + 1]; rest[e] = hypot(sig[a] - sig[b], wrapSym(thl[a] - thl[b], cuff)); }
  else for (let e = 0; e < nF; e++) { const a = eo[2 * e], b = eo[2 * e + 1]; rest[e] = dFermi(sig[a], wrapSym(thl[a] - thl[b], cuff), sig[b], 0); }
}

/** Stage 2: everything that depends on the twist: the orbifold chart, the positions, the zipper strip. */
function fillTwist(mesh, base0, base1, tw, single = false) {
  // base0, base1: the orbifold-chart theta of each pillow's first cone point. Pillow 0 lies below (theta = base - theta',
  // s = -sigma), pillow 1 above (theta = base + theta'); a single pillow (pillowMesh) is drawn above.
  const topo = mesh._topo, { N, parts, closedOf, copies, firstOpen, nOpen, nClosed } = topo, cuff = mesh.cuff, flat = mesh.kind === 'E';
  const o = mesh.open, sig = o.sigma, thl = o.thetaLocal, sO = o.s, thO = o.theta, pO = o.positions, R = mesh._r, Z = mesh._z;
  const k2 = TAU / cuff;
  for (const pt of parts) {
    const side = single || pt.k === 1 ? 1 : -1, base = pt.k === 1 ? base1 : base0;
    for (let j = 0; j < N; j++) {
      const th = base + side * thl[pt.baseOpen + j], ph = k2 * th, cph = cos(ph), sph = sin(ph);
      for (let i = pt.rowMin; i <= pt.roofRow; i++) {
        const idx = pt.baseOpen + (i - pt.rowMin) * N + j, i3 = 3 * idx;
        thO[idx] = th; sO[idx] = side * sig[idx];
        pO[i3] = R[idx] * cph; pO[i3 + 1] = R[idx] * sph; pO[i3 + 2] = side * Z[idx];
      }
    }
  }
  // closed vertices: the mean of their open copies (a seal vertex: the midpoint of its two crown points)
  const pC = mesh.positions;
  pC.fill(0);
  for (let v = 0; v < nOpen; v++) { const c3 = 3 * closedOf[v], v3 = 3 * v; pC[c3] += pO[v3]; pC[c3 + 1] += pO[v3 + 1]; pC[c3 + 2] += pO[v3 + 2]; }
  for (let c = 0; c < nClosed; c++) {
    if (copies[c] === 2) { pC[3 * c] *= 0.5; pC[3 * c + 1] *= 0.5; pC[3 * c + 2] *= 0.5; }
    const f = firstOpen[c];
    mesh.s[c] = sO[f]; mesh.theta[c] = thO[f]; mesh.pillow[c] = o.pillow[f];
  }
  for (const seal of mesh.seals) for (let k = 0; k < seal.chain.length; k++) for (let x = 0; x < 3; x++) {
    seal.a[3 * k + x] = pO[3 * seal.openA[k] + x]; seal.b[3 * k + x] = pO[3 * seal.openB[k] + x];
  }
  mesh.tw = tw; mesh.turn = TAU * tw;
  if (!topo.withStrip) return;
  // the zipper strip: upper-ring vertex k lies above the lower-ring edge [k + m, k + m + 1], at the fraction f
  const del = tw * N, mFloor = floor(del), f = del - mFloor, m = ((mFloor % N) + N) % N;
  const B = topo.stripB, T = topo.stripT, tO = o.triangles, tC = mesh.triangles, eO = o.edges, eC = mesh.edges, rest = mesh.restLength;
  let t3 = 3 * topo.nTriParts, e = topo.nFixedEdges;
  for (let k = 0; k < N; k++) {
    const b0 = B[(k + m) % N], b1 = B[(k + m + 1) % N], t0 = T[k], t1 = T[(k + 1) % N];
    tO[t3] = b0; tO[t3 + 1] = b1; tO[t3 + 2] = t0; tO[t3 + 3] = b1; tO[t3 + 4] = t1; tO[t3 + 5] = t0;
    for (let x = 0; x < 6; x++) tC[t3 + x] = closedOf[tO[t3 + x]];
    t3 += 6;
    for (let x = 0; x < 2; x++) {
      const b = x === 0 ? b0 : b1;
      eO[2 * e] = b; eO[2 * e + 1] = t0; eC[2 * e] = closedOf[b]; eC[2 * e + 1] = closedOf[t0];
      const dth = wrapSym(thO[b] - thO[t0], cuff);
      rest[e] = flat ? hypot(sO[b] - sO[t0], dth) : dFermi(sO[b], dth, sO[t0], 0);
      e++;
    }
  }
  mesh.strip.cells = mFloor; mesh.strip.frac = f;
  const wr = topo.owner === 0 ? B : T;
  for (let i = 0; i < N; i++) mesh.waist[i] = closedOf[wr[i]];
}

const roundUp4 = (n) => max(4, 4 * Math.ceil(n / 4));

/**
 * The mesh of ONE pillow {p, q, L} as the crown above its cuff (z >= 0), P's meridian at azimuth 0.
 * opts: { nTheta = 48 (made a multiple of 4), nS = 8, minSlope = 0, into (a mesh of the same shape to refill) }.
 * Returns the fields of orbifoldMesh that make sense for one pillow: cones { P, Q }, the cuff's ring in `waist`,
 * one seal; the surface is a disc (Euler characteristic 1) bounded by the cuff. {2, 2, L}: no triangles, the
 * folded ring only.
 */
export function pillowMesh(p, q, L, opts = {}) {
  const N = roundUp4(opts.nTheta ?? 48), nS = max(1, opts.nS ?? 8), minSlope = opts.minSlope || 0;
  const pl = opts.flatHeight !== undefined ? flatPillow(L, opts.flatHeight) : pillow(p, q, L);
  const topo = buildTopology(N, nS, [{ deg: pl.degenerate, rowMin: 0 }], false);
  const mesh = opts.into && opts.into._topo === topo ? opts.into : allocMesh(topo);
  fillShape(mesh, [pl], pl.flat ? 'E' : 'H', L, minSlope);
  fillTwist(mesh, 0, 0, 0, true);
  const pt = topo.parts[0];
  for (let j = 0; j < N; j++) mesh.waist[j] = topo.closedOf[topo.oi(pt, pt.rowMin, j)];
  mesh.orders = [p, q]; mesh.L = L; mesh.pillows = [pl];
  mesh.cones = { P: mesh.seals[0].chain[0], Q: mesh.seals[0].chain[topo.H] };
  return mesh;
}

/**
 * The mesh of the orbifold of the engine's state (orders = [p, q, r, s], L, tw): pillow {p, q} below the waist,
 * pillow {r, s} above, the zipper strip between them.
 * opts: { nTheta = 48 (made a multiple of 4, at least 4), nS = 8 (at least 2), minSlope = 0, cut = 0.5 (2222 only), into }.
 *
 * Returned (typed arrays; n = nVertices, the vertices of the CLOSED surface, seals identified):
 *   positions[3n]      the start of a relaxation: the open crowns; a seal vertex at the midpoint of its two crown points
 *   triangles[3m]      counter-clockwise seen from outside; triPillow[m] 0 = {P, Q}, 1 = {R, S}
 *   edges[2e], restLength[e]   the exact distance on the orbifold between the two ends
 *   s[n], theta[n], pillow[n]  the orbifold-chart point of each vertex (a seal vertex: its copy on theta' >= 0)
 *   cones { P, Q, R, S }, waist[nTheta] (the ring, by increasing theta)
 *   seals[2]           { pillow, chain (first cone point .. second), openA, openB, a, b }: a, b the two crown points
 *   strip              { triStart, triCount, edgeStart, edgeCount, cells, frac }: the part a twist rewrites
 *   open               { nVertices, positions, closedOf, triangles, edges, s, theta, sigma, thetaLocal, pillow }:
 *                      the same triangles and edges corner by corner on vertices that keep the seals' two sides apart
 *   exact, rimExcess, sMax    whether every vertex lies within the crown's rim (else the fallback was used past it)
 */
export function orbifoldMesh(orders, L, tw = 0, opts = {}) {
  const N = roundUp4(opts.nTheta ?? 48), nS = max(2, opts.nS ?? 8), minSlope = opts.minSlope || 0;   // nS = 1 beside a (2, 2) pair would join two folded rings: not a simplicial surface
  const g = orbifold(orders, L, tw, opts);
  const topo = buildTopology(N, nS, [
    { deg: g.lower.degenerate, rowMin: 0 },
    { deg: g.upper.degenerate, rowMin: g.upper.degenerate ? 0 : 1 },
  ].map((sp, k, all) => (k === 0 && all[1].deg ? { deg: false, rowMin: 1 } : sp)), true);
  const mesh = opts.into && opts.into._topo === topo ? opts.into : allocMesh(topo);
  fillShape(mesh, [g.lower, g.upper], g.kind, g.cuff, minSlope);
  mesh.orders = g.orders; mesh.L = L; mesh.pillows = [g.lower, g.upper]; mesh.frame = g;
  fillTwist(mesh, g.thP, g.thR, tw);
  const H = topo.H;
  mesh.cones = { P: mesh.seals[0].chain[0], Q: mesh.seals[0].chain[H], R: mesh.seals[1].chain[0], S: mesh.seals[1].chain[H] };
  return mesh;
}

/** The same mesh at another twist: only the upper pillow's place, the positions and the zipper strip change. */
export function setTwist(mesh, tw) {
  const g = mesh.frame;
  if (!g) throw new Error('setTwist: not an orbifold mesh');
  g.tw = tw; g.turn = TAU * tw; g.thR = g.thP + tw * g.cuff; g.thS = g.thR + g.cuff / 2;
  fillTwist(mesh, g.thP, g.thR, tw);
  return mesh;
}

/**
 * The three corners of triangle t in the chart of its own pillow, unwrapped: out = [sigma0, th0, sigma1, th1, sigma2, th2]
 * with sigma >= 0 the distance from the waist and th the pillow-chart theta' (first cone point at 0), so a print
 * laid out in pillow charts can be drawn triangle by triangle whatever the twist.
 */
export function triLocal(mesh, t, out = new Float64Array(6)) {
  const o = mesh.open, k = mesh.triPillow[t], g = mesh.frame, cuff = mesh.cuff;
  const base = g ? (k === 0 ? g.thP : g.thR) : 0, side = g ? (k === 0 ? -1 : 1) : 1;
  let ref = 0;
  for (let x = 0; x < 3; x++) {
    const v = o.triangles[3 * t + x];
    let th = side * (o.theta[v] - base);
    th = x === 0 ? wrapSym(th, cuff) : ref + wrapSym(th - ref, cuff);
    if (x === 0) ref = th;
    out[2 * x] = side * o.s[v]; out[2 * x + 1] = th;
  }
  return out;
}

/**
 * Where the pillow-chart point (sigma, thetaLocal) of pillow k (0 = {P, Q}, 1 = {R, S}) lies in the mesh: a triangle
 * and the weights of its three corners. The map is piecewise linear in (theta', u = sigma / roof(theta')), the
 * grid's own parameters, so it is exact at the vertices, continuous, and the same whether the positions are the
 * open crowns, the start or a relaxed surface: use it to carry a print. It follows the zipper strip at any twist.
 * out = { tri, w: [w0, w1, w2] }: the point is sum w[x] * position(vertex x of triangle tri). Returns null for a
 * (2, 2) pillow (it has no inside).
 */
export function locate(mesh, k, sigma, thetaLocal, out = { tri: 0, w: [0, 0, 0] }) {
  const topo = mesh._topo, { N, nS, H } = topo, pt = topo.parts[k], cuff = mesh.cuff, c = cuff / N, pl = mesh.pillows[k];
  if (pt.deg) return null;
  const th = thetaLocal - cuff * floor(thetaLocal / cuff);                  // [0, cuff)
  const hRoof = pl.roofAt(th <= cuff / 2 ? th : cuff - th), y = min(1, max(0, sigma / hRoof)) * nS;
  const i = min(nS - 1, floor(y)), b = y - i, w = out.w;
  if (i < pt.rowMin) {
    // the zipper strip: bottom ring B (the lower pillow's), top ring T (the upper's), sheared so that T lies over B
    const g = mesh.frame, del = g.tw * N, mF = floor(del), f = del - mF;
    const t = k === 1 ? b : 1 - b;                                           // the share of the way from B to T
    const xB = (k === 1 ? g.thR + th - g.thP : -th) / c - f * t;             // in cells of B, counted from P's foot
    const i0 = floor(xB), a = xB - i0, kT = (((i0 - mF) % N) + N) % N;
    if (a + t <= 1) { out.tri = mesh.strip.triStart + 2 * kT; w[0] = 1 - a - t; w[1] = a; w[2] = t; }
    else { out.tri = mesh.strip.triStart + 2 * kT + 1; w[0] = 1 - t; w[1] = a + t - 1; w[2] = 1 - a; }
    return out;
  }
  const x = th / c, j = min(N - 1, floor(x)), a = x - j, jm = j < H ? j : N - 1 - j, back = (j < H) === (jm < (N >> 2));
  const t0 = pt.triBase + 2 * ((i - pt.rowMin) * N + j);
  if (back) {
    if (a + b <= 1) { out.tri = t0; w[0] = 1 - a - b; w[1] = a; w[2] = b; } else { out.tri = t0 + 1; w[0] = 1 - b; w[1] = a + b - 1; w[2] = 1 - a; }
  } else if (b <= a) { out.tri = t0; w[0] = 1 - a; w[1] = a - b; w[2] = b; } else { out.tri = t0 + 1; w[0] = 1 - b; w[1] = a; w[2] = b - a; }
  return out;
}
/**
 * The point of `positions` (3 per vertex) that `loc` = locate(...) names. `triangles` says which vertices the
 * positions belong to: mesh.triangles with closed positions (the default), mesh.open.triangles with open ones.
 */
export function pointOn(mesh, loc, positions = mesh.positions, triangles = mesh.triangles, out = [0, 0, 0]) {
  const a = 3 * triangles[3 * loc.tri], b = 3 * triangles[3 * loc.tri + 1], c = 3 * triangles[3 * loc.tri + 2], w = loc.w;
  for (let x = 0; x < 3; x++) out[x] = w[0] * positions[a + x] + w[1] * positions[b + x] + w[2] * positions[c + x];
  return out;
}

/**
 * A grid (nTheta, nS) of about nVertices vertices whose cells are about as wide as they are high, on average over
 * both pillows: nTheta / nS = cuff <cosh s> / <roof>. The ratio moves a great deal with L (3333: 1.1 at L = 1,
 * 2.7 at L = 2, 8 at L = 4), so a page that slides L with one grid picks it for the middle of the range.
 */
export function suggestGrid(orders, L, nVertices = 2500) {
  const g = orbifold(orders, L, 0);
  let wid = 0, hgt = 0, n = 0;
  for (const pl of [g.lower, g.upper]) {
    if (pl.degenerate) continue;
    for (let i = 0; i <= 16; i++) {
      const h = pl.roofAt((i / 16) * (g.cuff / 2)), wgt = i === 0 || i === 16 ? 0.5 : 1;
      wid += wgt * (g.kind === 'E' ? 1 : sinh(h) / h); hgt += wgt * h; n += wgt;        // <cosh s> over 0..h is sinh h / h
    }
  }
  const ratio = (g.cuff * (wid / n)) / (hgt / n), cells = max(8, (nVertices - 2) / (g.lower.degenerate || g.upper.degenerate ? 1 : 2));
  const nS = max(2, Math.round(sqrt(cells / ratio))), nTheta = roundUp4(cells / nS);
  return { nTheta, nS, ratio };
}

/**
 * The mesh in the shape the prototype round's metrics read (../common/metrics.mjs): plain arrays, cones as
 * [P, Q, R, S], seals as two chains. `positions` defaults to the mesh's own start (the pressed open crowns).
 */
export function toResult(mesh, positions = mesh.positions) {
  return {
    state: { orders: mesh.orders, L: mesh.L, tw: mesh.tw },
    positions: Array.from(positions), triangles: Array.from(mesh.triangles), edges: Array.from(mesh.edges), rest: Array.from(mesh.restLength),
    pillow: Array.from(mesh.triPillow), cones: ['P', 'Q', 'R', 'S'].map((nm) => mesh.cones[nm]).filter((v) => v !== undefined),
    waist: Array.from(mesh.waist), seals: mesh.seals.map((sl) => Array.from(sl.chain)),
  };
}

/** A mesh as plain JSON-able arrays (numbers rounded to `digits` significant digits). */
export function meshToJSON(mesh, digits = 12) {
  const num = (a) => Array.from(a, (v) => (Number.isFinite(v) ? +v.toPrecision(digits) : v));
  const int = (a) => Array.from(a);
  const o = mesh.open;
  return {
    about: 'pillow.mjs mesh. Closed vertices: seals identified. open: the same triangles on vertices that keep the two sides of each seal apart (the crowns before the seals are closed). Lengths hyperbolic (kind H) or Euclidean (kind E).',
    kind: mesh.kind, orders: mesh.orders, L: mesh.L, tw: mesh.tw, cuff: mesh.cuff, turn: mesh.turn, nTheta: mesh.nTheta, nS: mesh.nS,
    exact: mesh.exact, rimExcess: mesh.rimExcess, sMax: Number.isFinite(mesh.sMax) ? mesh.sMax : null, minSlope: mesh.minSlope,
    ringOwner: mesh.ringOwner, degenerate: mesh.degenerate,
    nVertices: mesh.nVertices, nTriangles: mesh.nTriangles, nEdges: mesh.nEdges,
    positions: num(mesh.positions), triangles: int(mesh.triangles), triPillow: int(mesh.triPillow),
    edges: int(mesh.edges), restLength: num(mesh.restLength),
    s: num(mesh.s), theta: num(mesh.theta), pillow: int(mesh.pillow),
    cones: mesh.cones, waist: int(mesh.waist),
    seals: mesh.seals.map((sl) => ({ pillow: sl.pillow, chain: int(sl.chain), openA: int(sl.openA), openB: int(sl.openB), a: num(sl.a), b: num(sl.b) })),
    strip: mesh.strip,
    open: { nVertices: o.nVertices, positions: num(o.positions), closedOf: int(o.closedOf), triangles: int(o.triangles), edges: int(o.edges), s: num(o.s), theta: num(o.theta), sigma: num(o.sigma), thetaLocal: num(o.thetaLocal), pillow: int(o.pillow) },
  };
}
