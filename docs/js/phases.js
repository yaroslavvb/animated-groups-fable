/* Time symmetry of a spacetime group: which instants of the loop matter.
 *
 * Every element acts on time as  t -> s t + tau  with s = +-1 and tau a
 * fraction of the period. Two structures follow, and both are used on screen.
 *
 * THE MARKS.  The distinguished instants of the loop, offered as jump targets
 * on the scrub bar (controls.js):
 *   beat marks   t = k/B, where the tau values of the group's elements are
 *                exactly the coset (1/B)Z. The frame here is the frame at
 *                t = 0 moved by the spatial part of an element with tau = k/B.
 *   mirror marks fixed points of a time reversal t -> -t + tau, i.e.
 *                t = tau/2 and tau/2 + 1/2. At those instants the animation is
 *                momentarily palindromic and the reversal's spatial part is
 *                an honest symmetry of the single frame.
 * With reversals present the two sets always merge into k/(2B) — a reversal
 * coset has tau in tau_0 + (1/B)Z, so its fixed points fill tau_0/2 + (1/2B)Z,
 * which already contains (1/B)Z. Either way the marks land on a UNIFORM grid
 * of N = B or 2B instants; at most 12 over the catalog.
 *
 * THE INTERVALS (N).  The marks cut the period into N intervals, and every
 * copy of the motif sits in one of them — that index is what the phase ring
 * draws (renderer.js), so the ring is this ruler wrapped into a circle. It is
 * well defined because N tau_c is an integer for every copy c: with
 * theta_c = s_c (t - tau_c), floor(N theta_c) mod N is constant between marks
 * and ALL copies step to their next interval at the same instants. For
 * 6_1 3_1 2_1, N = 6: the six copies around a 6-centre occupy the six
 * intervals, and the ring makes that staircase readable in a frozen frame.
 * For a group whose only time structure is a reversal, N = 2: the ring
 * separates the copies filling from the copies draining.
 *
 * All fractions arrive as floats; denominators are recovered exactly, since
 * every tau in the enumeration is k/d with d | 12.
 */
"use strict";

const MAXD = 24;      // no spacetime-group tau has a larger denominator
const EPS = 1e-6;

const frac1 = x => ((x % 1) + 1) % 1;

/* smallest d in 1..MAXD with x*d an integer (x taken mod 1) */
export function denomOf(x) {
  const f = frac1(x);
  for (let d = 1; d <= MAXD; d++) {
    if (Math.abs(f * d - Math.round(f * d)) < EPS * d) return d;
  }
  return MAXD;   // unreachable for enumerated specs; never divides by zero
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a * b) / gcd(a, b);

/* the order of a set of fractions in R/Z: the smallest n with every x in
 * (1/n)Z. Applied to the taus it gives the beat B, to the marks it gives N. */
export function beatCount(taus) {
  let n = 1;
  for (const t of taus) n = lcm(n, denomOf(t));
  return n;
}

/* Which of the N intervals an internal time falls in. The ring no longer
 * lights that interval — its hand rides round continuously and the interval is
 * read off from where the point is (renderer.js) — but the index is what makes
 * the ruler well defined, and it is the statement the marks on the scrub bar
 * and the notation both rest on, so it stays exported and documented here. */
export function beatOf(theta, n) {
  return ((Math.floor(frac1(theta) * n) % n) + n) % n;
}

/* "0", "1/6", "1/2" — the label under a mark */
export function fracLabel(t) {
  const f = frac1(t);
  if (f < EPS) return "0";
  const d = denomOf(f);
  return `${Math.round(f * d)}/${d}`;
}

/* The distinguished instants, sorted, deduplicated, each tagged with what
 * makes it distinguished. `taus` are all the elements' time offsets;
 * `revTaus` those of the time-reversing elements only. */
export function timeMarks(taus, revTaus) {
  const b = beatCount(taus);
  const at = new Map();   // key: rounded t -> mark
  const put = (t, kind) => {
    const f = frac1(t);
    const key = Math.round(f * 1e6);
    const m = at.get(key);
    if (m) m.kind = m.kind === kind ? kind : "both";
    else at.set(key, { t: f, kind, label: fracLabel(f) });
  };
  for (let k = 0; k < b; k++) put(k / b, "beat");
  for (const tau of revTaus) { put(tau / 2, "mirror"); put(tau / 2 + 0.5, "mirror"); }
  const marks = [...at.values()].sort((a, b2) => a.t - b2.t);
  // N is derived from the marks rather than counted, so a hypothetical
  // non-uniform mark set would still yield a grid every mark lands on
  return { n: beatCount(marks.map(m => m.t)), beat: b, marks };
}

/* 2+1D spec: ops [{M, v, s, tau}] */
export function filmTimeSymmetry(spec) {
  const ops = spec.ops || [];
  return timeMarks(ops.map(o => o.tau),
                   ops.filter(o => o.s === -1).map(o => o.tau));
}

/* 1+1D strip spec: ops [{m, s, v, tau}] plus an optional centring [v, tau] */
export function stripTimeSymmetry(spec) {
  const reps = [];
  for (const o of spec.ops || []) {
    reps.push({ s: o.s, tau: o.tau });
    if (spec.cent) reps.push({ s: o.s, tau: o.tau + spec.cent[1] });
  }
  return timeMarks(reps.map(o => o.tau),
                   reps.filter(o => o.s === -1).map(o => o.tau));
}
