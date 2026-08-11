/* Shared data for the two-level wallpaper atlas: per-wallpaper blurbs,
 * discussion paragraphs, and curated example symbols. Both wallpaper.js
 * (overview, 17 sections) and wallpaper-group.js (one wallpaper, all its
 * film groups at full size) import this. Examples are resolved by SYMBOL
 * against catalog.json so they cannot silently drift. */
"use strict";

/* Crystallographic order; orb = Conway orbifold of the wallpaper group.
 * note: one-line description of the wallpaper itself.
 * issues: what actually happens over this base — the phenomena a reader
 * should look for; references only symbols that exist in the catalog.
 * examples: one or two curated catalog symbols shown on the overview. */
export const WALLPAPERS = [
  { hm: "p1", orb: "o",
    note: "Translations only — the quotient is the torus, Conway's o.",
    issues: "With no point operations a Galilean boost removes any drift, \
so the only forward film over p1 is the product o itself — even the \
time-centred stacking can be boosted away. Time structure survives only \
when reversal pins the frame: the palindrome o/1′, the glide time-reversal \
o/g′ (played backwards, the film is itself shifted half a cell), and the \
centred palindromes co/1′, co/g′, where the centring becomes irremovable \
precisely because reversal fixes a time origin.",
    examples: ["o/g′"] },
  { hm: "p2", orb: "2222",
    note: "Four families of half-turn centres; the quotient is a pillowcase of four cone points.",
    issues: "Half-turns are involutions, so each 2-centre carries offset 0 \
or ½, and the orbifold relation ties the four classes together: besides the \
product this allows exactly 2₁2₁2₁2₁, all four classes screwed. The \
centring c222₁2₁ mixes plain 2s and 2₁s in one group — the checkerboard \
whose sublattices swap roles every half period. Among the reversal groups, \
o/2′[2222] is the extreme case: the photograph's entire p2 symmetry is \
carried by time-reversing half-turns.",
    examples: ["2₁2₁2₁2₁", "c222₁2₁"] },
  { hm: "pm", orb: "**",
    note: "Two parallel families of mirrors, nothing else.",
    issues: "Over pm the crystallographic convention leaves a single \
forward group, the product: the tilded kaleidoscope ~*~* is the same \
abstract class as pg × ℤ and is filed under ×× (see pg). Everything else \
is reversal — including the catalog's largest symbol collisions: **/g′ᵃᵇ \
(the reversal glide runs on or between the mirrors) and the centred family \
c**/1′ᵃ…ᵈ, four groups on one symbol, separated only by their generator \
lists.",
    examples: ["**/g′ᵃ", "o/m′[**]"] },
  { hm: "pg", orb: "××",
    note: "No mirrors — two families of glides, two of Conway's miracles.",
    issues: "The home of the disguises. The time glide ~*~* and the mixed \
space–time glide ×½×½ are crystallographically the class ×× = pg × ℤ — \
pg's glide read along a different axis of spacetime — yet as films they \
can never be made static; this is exactly where the strict Galilean \
classification (283 classes) is finer than the crystallographic one used \
here (275). The decoration becomes essential once reversal pins the frame: \
×½×½/1′ and ××/1′ are different groups even though their forward parts \
are the same crystallographic class.",
    examples: ["××", "×½×½/1′"] },
  { hm: "cm", orb: "*×",
    note: "A mirror family and a glide family interleaved: the centred rectangle.",
    issues: "One forward decoration survives: ~*×½, the tilded mirror \
forcing offset ½ onto the interleaved glide. On the time-centred lattice \
the glide can square to the centring and carry a quarter offset — \
c×¼×¼/g′[*×], the d-glide analogue — and the pair c*×/1′ᵃᵇ is another \
relative-position collision.",
    examples: ["~*×½", "c×¼×¼/g′[*×]"] },
  { hm: "pmm", orb: "*2222",
    note: "The rectangular kaleidoscope: mirrors both ways, four corner classes.",
    issues: "Even corners leave the four mirror arcs free to tilde \
independently, giving the forward patterns *~2~2~2~2 and *2₁~2₁2₁~2₁ \
(tilded arcs force the corner screws). On the centred lattice the symbol \
stops recording which mirror family is in phase with the centring: the \
forward pairs c*222₁2₁ᵃᵇ of the notation's Resolution aside live here. \
The section also receives the /m′ enrichments of every group whose \
reversal mirrors complete a pmm photograph.",
    examples: ["*~2~2~2~2", "c*222₁2₁ᵃ"] },
  { hm: "pmg", orb: "22*",
    note: "Half-turn centres beside a single mirror family.",
    issues: "The mirror arc and the off-mirror 2-centres decorate \
independently: 22~*, 2₁2₁* and 2₁2₁~* realise every combination of tilde \
and screw — note 2₁2₁* against 2₁2₁~*, identical gyrations with the tilde \
alone distinguishing the groups — and the centred pair c22₁*ᵃᵇ collides on \
one symbol.",
    examples: ["2₁2₁~*", "c22₁*ᵃ"] },
  { hm: "pgg", orb: "22×",
    note: "Half-turns with glides only; no mirror anywhere.",
    issues: "No mirrors, so the ½-offsets ride the glides: 22×½ is the \
mixed space–time glide (reflect, slide half a cell, wait half a period), \
2₁2₁× screws the gyrations instead, and the centred c22₁×¼ carries the \
quarter-offset d-glide.",
    examples: ["22×½", "c22₁×¼"] },
  { hm: "cmm", orb: "2*22",
    note: "The centred kaleidoscope: half-turn centres off the mirrors.",
    issues: "The off-mirror 2-centres decorate independently of the \
kaleidoscope: 2*~2~2 tildes the arcs, 2₁*2₁~2₁ and c2*2₁2₁ screw the \
centres, and the centred pair c2₁*22ᵃᵇ collides. cmm also receives many \
bracketed /g′ enrichments — reversal glides completing a centred \
photograph from a smaller forward part.",
    examples: ["2*~2~2", "c2*2₁2₁"] },
  { hm: "p4", orb: "442",
    note: "Two families of fourfold gyrations and one of half-turns.",
    issues: "The screw assignments 442, 4₁4₁2₁, 4₂4₂2, 4₃4₃2₁ are forced \
exactly as in notation rule 1; the centring adds c44₂2₁ and c4₁4₃2, \
realising the 4₁4₃ assignment a primitive lattice forbids. Reversal is \
parity-selective: 4₂4₂2/1′ exists (½ ≡ −½) but the odd screws admit no \
palindrome over p4 — their reversal needs a mirror, and lands over p4m.",
    examples: ["4₁4₁2₁", "c4₁4₃2"] },
  { hm: "p4m", orb: "*442",
    note: "The square kaleidoscope — the symmetry of graph paper.",
    issues: "The largest family: 35 groups. The (2,4,4) triangle's arcs \
tilde in the patterns *4₂~4₂2, *~4₂4₂~2, *~4~4~2 — tildes at the \
4-corners force the 4₂ screws — the centred forward pair c*44₂2₁ᵃᵇ \
collides, and every /m′ of the p4 screws arrives here in brackets, \
including 4₁4₁2₁/m′[*442], the only way an odd screw meets time reversal.",
    examples: ["*~4~4~2", "4₁4₁2₁/m′[*442]"] },
  { hm: "p4g", orb: "4*2",
    note: "Fourfold gyrations beside mirrors, glides between them.",
    issues: "Gyration beside mirror: the 4-centres screw while the single \
arc tildes (4₂*~2, 4*~2, 4₂*2), and on the centred lattice the chiral \
pair c4₁*2, c4₃*2 appears. The bracketed /m′[4*2] entries show reversal \
mirrors completing a p4g photograph from pmm-, pgg- and p4-type forward \
parts.",
    examples: ["4₂*~2", "c4₁*2"] },
  { hm: "p3", orb: "333",
    note: "Three families of threefold gyrations.",
    issues: "No involutions at all: offsets come only in thirds. The \
uniform screws 3₁3₁3₁ and 3₂3₂3₂ (Ke–Wu's chirality-selecting symmetry) \
and the rhombohedral r33₁3₂ exhaust the forward decorations. Reversal is \
almost absent over p3: negation swaps 3₁ ↔ 3₂, so no screwed group is a \
palindrome — only the gray product 333/1′ survives, and the screws meet \
reversal only via a mirror (over p3m1) or a half-turn (over p6).",
    examples: ["3₁3₁3₁", "r33₁3₂"] },
  { hm: "p3m1", orb: "*333",
    note: "The equilateral-triangle kaleidoscope; every 3-centre on a mirror.",
    issues: "Odd corners force adjacent arcs to carry equal tilde marks, \
so the kaleidoscope decorates all-or-nothing: *~3~3~3 is the unique \
forward decoration. The section receives every /m′ of the p3 screws — \
3₁3₁3₁/m′[*333] is the chiral screw's only palindromic completion on this \
base — together with r33₁3₂/m′[*333].",
    examples: ["*~3~3~3", "3₁3₁3₁/m′[*333]"] },
  { hm: "p31m", orb: "3*3",
    note: "A threefold gyration off the mirrors and one on them.",
    issues: "With one 3-centre off the mirrors, tilde and screw decorate \
separately: 3*~3 tildes the arc while the rhombohedral stackings r3₂*3 \
and r3₂*~3 screw the off-mirror centre by thirds — kaleidoscope and ABC \
stacking in a single group.",
    examples: ["r3₂*3", "3*~3"] },
  { hm: "p6", orb: "632",
    note: "Sixfold, threefold and twofold gyrations.",
    issues: "The full screw family: 6₁3₁2₁ … 6₅3₂2₁ mirror the space \
groups P6₁…P6₅, in chiral pairs 6₁/6₅ and 6₂/6₄. Only the half-period \
screw 6₃32₁ is palindromic (again ½ ≡ −½). In 333/2′[632] and \
r33₁3₂/2′[632] the photograph's six-fold symmetry is supplied entirely by \
time-reversing half-turns.",
    examples: ["6₁3₁2₁", "6₃32₁"] },
  { hm: "p6m", orb: "*632",
    note: "The full hexagonal kaleidoscope, the (30°, 60°, 90°) triangle.",
    issues: "The (2,3,6) triangle tildes under the odd-corner constraint — \
*~6~3~2, *6₃~3~2₁, *~6₃32₁, the 6-corner screwing when its two arcs \
disagree — and the section collects the /m′ completions of the whole \
hexagonal tower: all five 6-screws and the trigonal groups below them.",
    examples: ["*6₃~3~2₁", "6₁3₁2₁/m′[*632]"] },
];

/* within a section: the pure product first, then forward-time, then reversal */
export function sectionSort(list) {
  const rank = g => (g.forward ? (g.product ? 0 : 1) : 2);
  return [...list].sort((a, b) =>
    rank(a) - rank(b) || Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

export function censusSentence(w, list) {
  const nf = list.filter(g => g.forward).length;
  const npr = list.filter(g => g.product).length;
  return `Of the ${list.length} film groups over ${w.hm}: ` +
    `${nf} forward-time and ${list.length - nf} with time reversal; ` +
    `${npr} ${npr === 1 ? "is a" : "are"} product${npr === 1 ? "" : "s"} of ` +
    `${w.hm} with a time group, ${list.length - npr} genuinely entangle ` +
    `space with time.`;
}

/* Plain-English account of a group's TIME behaviour, generated from its
 * actual operations (render.ops) rather than from the symbol — the ops are
 * the ground truth, so the text cannot drift from the mathematics. Kept to
 * a few sentences: what a viewer should watch for in the animation. */
export function timeStory(g) {
  const frac = x => ((x % 1) + 1) % 1;
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const fword = q =>
    near(q, 1 / 2) ? "half a period" :
    near(q, 1 / 4) ? "a quarter period" :
    near(q, 3 / 4) ? "three quarters of a period" :
    near(q, 1 / 3) ? "a third of a period" :
    near(q, 2 / 3) ? "two thirds of a period" :
    near(q, 1 / 6) ? "a sixth of a period" :
    near(q, 5 / 6) ? "five sixths of a period" : q.toFixed(2) + " of a period";

  const screws = new Map();   // rotation order -> smallest nonzero offset
  let plainRot = false, tildeMirror = false;
  let glideTau = null;        // smallest nonzero time offset on a spatial glide
  let cent = null;            // centring: {third: bool}
  const revs = new Set();     // "pal" | "shift" | "ref" | "rot"

  for (const op of g.render.ops) {
    const M = op.M;
    const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
    const tr = M[0][0] + M[1][1];
    const isId = det === 1 && tr === 2;
    const v = op.v.map(frac);
    const tau = frac(op.tau);
    const hasV = v.some(x => !near(x, 0) && !near(x, 1));
    if (op.s === 1) {
      if (isId) {
        if (hasV && tau > 1e-6) cent = { third: near(tau, 1 / 3) || near(tau, 2 / 3) };
      } else if (det === 1) {
        const n = tr === -2 ? 2 : tr === -1 ? 3 : tr === 0 ? 4 : 6;
        if (tau > 1e-6) {
          const cur = screws.get(n);
          if (cur === undefined || tau < cur) screws.set(n, tau);
        } else plainRot = true;
      } else {
        // reflection: g² = (I | Mv+v) is a lattice translation for mirrors
        // AND standard glides — the glide vector is (Mv+v)/2, so the test
        // must be mod 2: even components = mirror, odd = glide
        const gx = (M[0][0] * v[0] + M[0][1] * v[1] + v[0]) % 2;
        const gy = (M[1][0] * v[0] + M[1][1] * v[1] + v[1]) % 2;
        const even = x => near(x, 0) || near(x, 2);
        if (even(gx) && even(gy)) { if (tau > 1e-6) tildeMirror = true; }
        else if (tau > 1e-6 && (glideTau === null || tau < glideTau)) glideTau = tau;
      }
    } else {
      if (isId) revs.add(hasV ? "shift" : "pal");
      else if (det === 1) revs.add("rot");
      else revs.add("ref");
    }
  }

  const s = [];
  if (g.product) {
    s.push("Product: every copy runs in phase, and each instant has the \
full wallpaper symmetry.");
  } else {
    if (screws.size > 0) {
      const parts = [...screws.keys()].sort((a, b) => b - a).map((n, i) =>
        i === 0
          ? `A ${360 / n}° turn about a ${n}-centre advances the film \
${fword(screws.get(n))}`
          : `a ${360 / n}° turn about a ${n}-centre, ${fword(screws.get(n))}`);
      s.push(parts.join("; ") + ".");
      if (plainRot) s.push("Other rotation centres carry no offset.");
    }
    if (tildeMirror) {
      s.push("Mirror symmetry holds only after waiting half a period; no \
instant is mirror-symmetric.");
    }
    if (glideTau !== null) {
      s.push(`The glide reflection (reflect, slide half a cell) also waits \
${fword(glideTau)}.`);
    }
    if (cent) {
      s.push(cent.third ?
        "Translating a third of a cell equals waiting a third of a period \
(ABC stacking in time)." :
        "Translating half a cell diagonally equals waiting half a period: \
adjacent motifs run in counterphase.");
    }
  }
  if (revs.has("pal")) {
    s.push("Played backwards, the film equals itself: a palindrome.");
  } else if (revs.has("shift")) {
    s.push("Played backwards, the film equals itself shifted half a cell.");
  } else if (revs.has("ref")) {
    s.push("Played backwards and reflected, the film equals itself.");
  } else if (revs.has("rot")) {
    s.push("Played backwards and rotated, the film equals itself.");
  }
  return s.join(" ");
}

export function groupCaption(g) {
  return `<div style="display:flex;align-items:baseline;gap:0.7rem;flex-wrap:wrap;">` +
    `<span class="sym">${g.symbolHtml}</span>` +
    `<span style="color:var(--muted);">${g.hm || ""}</span>` +
    `<span class="tags" style="display:flex;gap:0.4rem;flex-wrap:wrap;">` +
    (g.symmorphic ? "" : `<span class="tag nonsym">nonsymmorphic</span>`) +
    (g.forward ? "" : `<span class="tag rev">time reversal</span>`) +
    (g.product ? `<span class="tag product">product</span>` : "") +
    `</span>` +
    `<a class="linkish" style="margin-left:auto;text-decoration:none;" ` +
    `href="group.html?g=${g.id}">this group ↗</a></div>`;
}
