/* Notation page: live tabbed examples for each rule of the clockwork
 * orbifold notation. Tabs are resolved by SYMBOL from catalog.json, so the
 * examples cannot drift out of sync with the enumeration — a symbol that
 * disappears from the catalog renders an explicit error, never a stale demo. */
"use strict";
import { buildTabs } from "./tabs.js?v=47";
import { leadHtml } from "./catalog-names.js?v=47";

/* One entry per notation rule; `note` explains what the named group
 * exemplifies. Keep notes to the point being illustrated — the section
 * text above each widget carries the general rule. */
const SECTIONS = {
  "tabs-gyration": [
    { sym: "442",
      note: "All subscripts zero: the product p4 × ℤ. The whole plane fills \
in unison — every instant is a p4 wallpaper with the full fourfold symmetry." },
    { sym: "4₁4₁2₁",
      note: "The time-axis P4₁: a quarter turn about any 4-centre advances \
the animation a quarter period, so the four copies around a centre form a \
staircase of quarter phases. Freeze the animation — no instant has fourfold \
symmetry, yet the loop does." },
    { sym: "4₂4₂2",
      note: "The half-period screw P4₂: 90° equals half a period, so \
diagonally opposite copies around a 4-centre agree. The orbifold relation \
forces the 2-centres to carry no offset: ½ + ½ + 0 ≡ 0." },
    { sym: "4₃4₃2₁",
      note: "P4₃, the spacetime mirror image of 4₁4₁2₁: the same \
long-exposure photograph, the opposite screw handedness. No \
orientation-preserving motion of the plane combined with any forward \
re-timing of the clock identifies the two — only a spatial reflection, or \
playing the animation backwards, does (rule 4)." },
  ],
  "tabs-glides": [
    { sym: "*2222",
      note: "For contrast, the undecorated kaleidoscope pmm × ℤ: four \
mirror arcs, no marks — every mirror holds at every instant." },
    { sym: "*~2~2~2~2",
      note: "Every arc tilded: each of the four mirror families holds only \
after waiting half a period. Watch a mirror line: the fill levels on the \
two sides differ by exactly half a period." },
    { sym: "*~3~3~3",
      note: "The parity rule at work: corners of odd order force the two \
adjacent arcs to carry equal marks, so with threefold corners either no arc \
is tilded or all three are. This is the all-tilded option over p3m1." },
    { sym: "~*×½",
      note: "Tilde and decorated miracle together, over cm: the mirror \
waits half a period, and the glide carries time offset ½ as its subscript \
records." },
    { sym: "22×½",
      note: "The mixed space–time glide (m | T<sub>s</sub><sup>1/2</sup>\
T<sub>t</sub><sup>1/2</sup>): reflect, slide half a cell, wait half a \
period. Its square is the pure cell translation, so 2q ≡ 0 is satisfied \
with q = ½." },
    { sym: "c22₁×¼",
      note: "On a time-centred lattice a glide can square to the centring \
translation (half cell, half period) and so carry a quarter offset — the \
animation analogue of a crystallographic d-glide. The prefix c is the subject of \
the next rule." },
  ],
  "tabs-centred": [
    { sym: "c222₁2₁",
      note: "The checkerboard: translating half a cell diagonal equals \
waiting half a period. The centring splits the translation-related \
2-centres into classes running in counterphase — plain 2s and 2₁s in one \
group, which a primitive lattice forbids." },
    { sym: "c44₂2₁",
      note: "The time-axis I4: the centring forces the two classes of \
4-centres half a period apart — one stays a plain 4, the other becomes a \
4₂ screw." },
    { sym: "c4₁4₃2",
      note: "The assignment 4₁4₃ — impossible on a primitive lattice, \
where it would need a drifting frame — is realised by the centring: the \
time-axis I4₁. Compare rule 1, where 4₁4₃2 was excluded." },
    { sym: "r33₁3₂",
      note: "Rhombohedral stacking: a third of a cell at a third of a \
period. The three classes of 3-centres carry offsets 0, ⅓, ⅔ — the \
ABC-stacked animation, time-axis R3." },
  ],
  "tabs-reversal": [
    { sym: "2222/1′",
      note: "A gray group: the loop is a palindrome and the forward part is \
the full product 2222. Reversal negates offsets, and every offset here is \
0 ≡ −0, so nothing else is decorated." },
    { sym: "o/g′",
      note: "Glide time-reversal over the bare torus: played backwards, the \
animation equals itself shifted half a cell. Columns alternately fill and \
drain." },
    { sym: "4₁4₁2₁/m′[*442]",
      note: "Why /1′ cannot dress a 4₁: reversal alone would turn it into a \
4₃. Composed with a mirror the handedness flips twice, so /m′ works. The \
reversal mirrors enlarge the photograph from p4 to p4m — recorded in the \
bracket." },
    { sym: "o/m′[*×]",
      note: "No forward symmetry beyond translations: the reversal mirror \
alone is responsible for the photograph, enriching p1 to cm. The animation has \
mirror symmetry only as a palindrome, never at an instant." },
  ],
  "tabs-letters": [
    { sym: "**/g′ᵃ",
      note: "Forward part pm × ℤ, reversing coset a glide time-reversal. \
The descriptor /g′ does not say where the reversal glide runs relative to \
the forward mirrors —" },
    { sym: "**/g′ᵇ",
      note: "— and the two inequivalent positions (on a mirror axis, midway \
between axes) give two genuinely different groups. One coset descriptor, \
two geometries: the generator lists, always complete, distinguish them." },
    { sym: "c*222₁2₁ᵃ",
      note: "Collisions also occur forward on time-centred lattices: the \
prefix does not say which mirror family is in phase with the centring. \
Here the mirrors carry offset 0 —" },
    { sym: "c*222₁2₁ᵇ",
      note: "— and here offset ½; against the centring's half-cell, \
half-period shift the two choices are inequivalent (one group is \
symmorphic, the other is not)." },
  ],
  "tabs-reading": [
    { sym: "6₁3₁2₁",
      note: "Turning 60° about a 6-centre equals one sixth of a period: the \
six copies around it are filled a sixth apart. The subscripts obey \
⅙ + ⅓ + ½ ≡ 0, so the 3- and 2-centre offsets are forced." },
    { sym: "6₅3₂2₁",
      note: "The mirror twin: the animation that is 6₁3₁2₁'s reflection. \
Handedness of a time screw is real — the pair is the spacetime-group analogue \
of left- and right-handed quartz." },
  ],
};

const data = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
const bySym = new Map(data.groups.map(g => [g.symbol, g]));
for (const [id, items] of Object.entries(SECTIONS)) {
  const host = document.getElementById(id);
  if (host) {
    // the tab is named the way the rest of the site names a group: by its
    // book colour signature where it has one
    buildTabs(host, items.map(it =>
      ({ g: bySym.get(it.sym), sym: it.sym, note: it.note })),
      { label: leadHtml });
  }
}
