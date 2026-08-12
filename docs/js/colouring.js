/* Which colouring of its projection a spacetime group induces.
 *
 * This is the partition the hierarchy page draws (§5), computed here so the
 * catalog can label a group by it. Every element acts on the loop as
 * t -> t + tau or t -> -t + tau, which is a map of the phase circle, so a
 * spacetime group G comes with a homomorphism  Phi: G -> Isom(S^1).  Its image
 * is cyclic C_N when nothing reverses time and dihedral D_N when something
 * does.
 *
 * Phi is a COLOURING of the projected wallpaper group exactly when it descends
 * to it — when no element moves time while leaving space alone. One that does
 * is a pure time reversal, (x, t) -> (x, -t + tau): the animation played
 * backwards is itself, with nothing moved. Its presence is what stops the clock
 * from colouring the projection.
 *
 * So the 275 fall into four classes, and each group is in exactly one:
 *
 *   cyclic         nothing reverses time; the colour is the phase, and these
 *                  are precisely the 68 clockwork groups
 *   antisymmetry   a reversal, no phase to go with it; the colour is the
 *                  DIRECTION of time, two of them. D_1 is cyclic of order 2,
 *                  so this colours as regularly as C_N does
 *   dihedral       a reversal and a phase; 2N colours
 *   none           a pure time reversal, so Phi does not descend at all
 *
 * The catalog's old symmorphic/nonsymmorphic tag said something true but
 * unrelated to any of this — it is a fact about the cocycle, not about what the
 * animation does — so it is these that are on the cards now.
 */
"use strict";

/* Catalog time offsets are exact small rationals; nothing in the enumeration
 * has a denominator past 12. Recovering the fraction rather than carrying the
 * float is what makes the lcm below exact. */
const MAXD = 12;
const EPS = 1e-8;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a / gcd(a, b)) * b;

/* a time offset as {n, d} in lowest terms, mod 1 */
function phase(value) {
  const f = ((Number(value) % 1) + 1) % 1;
  for (let d = 1; d <= MAXD; d++) {
    const n = Math.round(f * d);
    if (Math.abs(f * d - n) < EPS * d) {
      const g = gcd(n, d) || 1;
      return { n: (n / g) % (d / g || 1), d: d / g };
    }
  }
  throw new Error(`time offset is not a small catalog rational: ${value}`);
}

const sub = (a, b) => {
  const d = lcm(a.d, b.d);
  let n = ((a.n * (d / a.d) - b.n * (d / b.d)) % d + d) % d;
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};

const opsOf = (g) => (g.render && g.render.ops) || [];

/* The image of G in Isom(S^1): its order N, and whether it contains a
 * reflection. The forward elements give rotations directly; a PAIR of
 * reversals composes to the rotation by their difference, which is where the
 * rest of the rotation subgroup comes from. */
export function clockImage(g) {
  const ops = opsOf(g);
  let order = 1;
  const rev = [];
  for (const o of ops) {
    if (o.s === 1) order = lcm(order, phase(o.tau).d);
    else rev.push(phase(o.tau));
  }
  for (const a of rev) {
    for (const b of rev) order = lcm(order, sub(a, b).d);
  }
  return { order, reversing: rev.length > 0 };
}

/* A reversal that acts trivially on space. */
export function hasPureReversal(g) {
  return opsOf(g).some(
    (o) => o.s === -1 && o.M[0][0] === 1 && o.M[0][1] === 0 &&
           o.M[1][0] === 0 && o.M[1][1] === 1 &&
           phase(o.v[0]).n === 0 && phase(o.v[1]).n === 0);
}

export function colouringKind(g) {
  const { order, reversing } = clockImage(g);
  if (!reversing) return "cyclic";
  if (hasPureReversal(g)) return "none";
  return order === 1 ? "antisymmetry" : "dihedral";
}

/* How each class is named on a card, and what the name means. "cyclic" is
 * absent: those groups already wear the "clockwork" tag, and two tags for one
 * fact is one tag too many. */
export const KIND = {
  cyclic: {
    label: "clockwork",
    title: "nothing reverses time: the clock colours the projection by phase, " +
           "with a regular cyclic colour group",
  },
  antisymmetry: {
    label: "antisymmetry",
    title: "time reverses, with no phase to go with it — the colour is the " +
           "direction of time, and there are two colours",
  },
  dihedral: {
    label: "dihedral",
    title: "time reverses and carries a phase: a dihedral colour group on " +
           "2N colours, phase and direction together",
  },
  none: {
    label: "no colouring",
    title: "a reversal that leaves space alone, so the clock does not descend " +
           "to the projection and colours it at all",
  },
};
