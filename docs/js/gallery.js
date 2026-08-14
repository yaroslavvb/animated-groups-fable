/* Gallery: featured non-product spacetime groups, big demos + GIF downloads. */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=43";
import { attachControls } from "./controls.js?v=43";
import { attachStage } from "./stage.js?v=43";
import { leadHtml, signatureOf } from "./catalog-names.js?v=43";

const FEATURED = [
  {
    id: "p4-timescrew",
    sym: "4<sub>1</sub>4<sub>1</sub>2<sub>1</sub>",
    kw: "(R<sub>π/2</sub>&thinsp;|&thinsp;T<sub>t</sub><sup>1/4</sup>) — time-screw rotation",
    text: "The time-axis P4<sub>1</sub>. A quarter turn about any 4-centre \
equals a quarter period of the animation; the two families of 4-centres both carry \
the screw, the 2-centres carry its square (half period). Why no product \
decomposition exists: any isomorphism with (wallpaper)&nbsp;×&nbsp;(clock) \
would make the 90° rotation an honest symmetry at each instant — but at a \
fixed time the four motifs around a centre are at four different phases, and \
only the full 360° turn is instantaneous. This is the animated analogue of a \
chiral screw crystal, and its spacetime mirror image, \
4<sub>3</sub>4<sub>3</sub>2<sub>1</sub>, is a genuinely different group — the \
pair is the spacetime-group version of left- and right-quartz.",
    specId: "p4-timescrew",
  },
  {
    id: "p6-timescrew",
    sym: "6<sub>1</sub>3<sub>1</sub>2<sub>1</sub>",
    kw: "(R<sub>π/3</sub>&thinsp;|&thinsp;T<sub>t</sub><sup>1/6</sup>) — sixfold time screw",
    text: "The time-axis P6<sub>1</sub>. The subscripts are forced by the \
orbifold relation: &#8537;&nbsp;+&nbsp;&#8531;&nbsp;+&nbsp;½&nbsp;=&nbsp;1&nbsp;≡&nbsp;0. \
Around each 6-centre the six copies are filled one sixth of a period apart — \
a hexagonal staircase of fill levels. Its mirror twin is \
6<sub>5</sub>3<sub>2</sub>2<sub>1</sub>; \
6<sub>2</sub>, 6<sub>3</sub>, 6<sub>4</sub> variants exist likewise, exactly \
matching the 3D screw groups P6<sub>1</sub>…P6<sub>5</sub>.",
    specId: "p6-timescrew",
  },
  {
    id: "p3-timescrew",
    sym: "3<sub>1</sub>3<sub>1</sub>3<sub>1</sub>",
    kw: "(R<sub>2π/3</sub>&thinsp;|&thinsp;T<sub>t</sub><sup>1/3</sup>) — the chirality-selection screw",
    text: "The time-axis P3<sub>1</sub>: all three families of 3-centres \
advance the animation by a third of a period. This is precisely the symmetry \
(R<sub>2π/3</sub>|T<sub>t</sub><sup>1/3</sup>) for which Ke–Wu derive their \
chirality-selective response rule: the heterodyne conductivities of a crystal \
pumped with this symmetry conserve pseudo-angular momentum mod 3, so probe \
light of one circular polarisation answers at shifted frequency with the \
<em>opposite</em> chirality.",
    specId: "p3-timescrew",
  },
  {
    id: "pm-timeglide",
    sym: "~*~*",
    kw: "(m<sub>x</sub>&thinsp;|&thinsp;T<sub>t</sub><sup>1/2</sup>) — time-glide reflection",
    text: "Mirror symmetry that is nowhere instantaneous: reflect, then wait \
half a period. Left- and right-handed copies run in counterphase. This is the \
operation protecting Ke–Wu's 'horizontal cone' in spacetime metamaterials \
(their driven two-site lattice satisfies u(t)&nbsp;=&nbsp;v(t&nbsp;+&nbsp;T/2), \
i.e. exactly this symmetry), and Fletcher's trick for halving an animator's \
work: 'the same drawing can be used again (turned if necessary) at different \
stages in the cycle'. A delicious fine point: <em>crystallographically</em> \
this group is isomorphic to pg&nbsp;×&nbsp;ℤ — the time glide is pg's spatial \
glide read along the time axis instead of a space axis. The identification \
relabels a space direction as time, so no change of frame realises it: as a \
animation, the pattern can never be made static. It is the smallest example where \
the strict Galilean classification (283 classes) is finer than the \
crystallographic one (275); the catalog, following Xu–Wu, files it with \
pg&nbsp;×&nbsp;ℤ under <span class=\"sym\">××</span>.",
    specId: "pm-timeglide",
  },
  {
    id: "p2-timecentred",
    sym: "c222<sub>1</sub>2<sub>1</sub>",
    kw: "time-centred lattice — the checkerboard flip",
    text: "No fractional point operation at all: here the <em>lattice</em> is \
the spacetime entanglement. Translating by half a cell diagonal is the same \
as waiting half a period, so the pattern is a checkerboard whose two sublattices \
swap roles every half period. With the 2-fold centres pinning the frame, no \
Galilean boost can undo the centring — the group is not a product even though \
every point operation is instantaneous. (This is the plane analogue of the \
1+1D centred groups Cm<sub>x</sub>, Cm<sub>t</sub> that Fletcher discarded as \
'rhombic'.)",
    specId: "p2-timecentred",
  },
  {
    id: "glide-time-reversal",
    sym: "o/g′",
    kw: "(m<sub>t</sub>&thinsp;|&thinsp;T<sub>x</sub><sup>1/2</sup>) — glide time-reversal",
    text: "Played backwards, the animation equals itself displaced half a cell: \
columns alternate filling / draining. The operation is anti-unitary \
in quantum settings — Xu–Wu show its 1+1D version forces a Kramers-like double \
degeneracy at the zone boundary <em>without any spin</em>. Note the \
time-collapsed photograph has a finer translation lattice than any single \
frame: the half-cell shift is a symmetry only of the loop, not of a moment.",
    specId: "glide-time-reversal",
  },
  {
    id: "palindromic-windmill",
    sym: "4<sub>2</sub>4<sub>2</sub>2/1′",
    kw: "time reversal + time screw — a palindromic windmill",
    text: "A half-period screw (4<sub>2</sub>) coexisting with a time mirror: \
the loop is a palindrome, and the quarter-turn-at-half-period survives because \
reversal negates the phase ½&nbsp;≡&nbsp;−½. The odd screws 4<sub>1</sub>, \
4<sub>3</sub> can never be palindromic this way — reversal would flip their \
handedness — they admit only reversal composed with a spatial mirror \
(4<sub>1</sub>4<sub>1</sub>2<sub>1</sub>/m′): a small parity theorem visible \
on screen.",
    specId: "palindromic-windmill",
  },
];


/* The featured list names its groups by symbol, not by id, so the catalogue
 * has to be consulted to find the signature. Subscript markup is stripped and
 * the digits folded to the catalogue's Unicode subscripts before comparing. */
const SUBS = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";
const CATALOG = await (async () => {
  try {
    const r = await fetch("data/catalog.json", { cache: "no-cache" });
    return r.ok ? (await r.json()).groups : [];
  } catch { return []; }
})();
const canon = h => String(h)
  .replace(/<sub>(\d)<\/sub>/g, (_, d) => SUBS[+d])
  .replace(/<[^>]*>/g, "");
const BY_SYMBOL = new Map(CATALOG.map(g => [g.symbol, g.id]));
function idBySymbol(sym) { return BY_SYMBOL.get(canon(sym)) || null; }

const anims = [];
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const a = anims.find(x => x.canvas === e.target);
    if (!a) continue;
    if (e.isIntersecting) { if (a.playRequested) a.start(); else a.drawStatic(); }
    else a.stop();
  }
}, { rootMargin: "60px" });

const root = document.getElementById("demos");
const DATA = await (await fetch("data/featured.json", {cache: "no-cache"})).json();
for (const f of FEATURED) {
  f.spec = DATA.specs[f.specId];
  f.gid = idBySymbol(f.sym);
  const d = document.createElement("div");
  d.className = "demo";
  d.id = f.id;
  const canvas = document.createElement("canvas");
  d.append(canvas);
  const cap = document.createElement("div");
  cap.className = "caption";
  cap.innerHTML =
    `<div style="display:flex;align-items:baseline;gap:0.7rem;flex-wrap:wrap;">` +
    `<span class="sym">${f.gid && signatureOf(f.gid) ? signatureOf(f.gid).signatureHtml : f.sym}</span>` +
    (f.gid && signatureOf(f.gid) ? `<span class="sym" style="color:var(--muted);font-size:0.85em;">${f.sym}</span>` : "") +
    `<span style="color:var(--muted);">${f.kw}</span>` +
    `<a class="linkish" style="margin-left:auto;text-decoration:none;" href="gifs/${f.id}.gif" download>⬇ GIF</a>` +
    `</div><p style="margin:0.4rem 0 0;">${f.text}</p>`;
  d.append(cap);
  root.append(d);
  const anim = new FilmGroupAnimation(canvas, f.spec);
  attachStage(anim, canvas);   // play button + keyboard, paints the still frame
  attachControls(anim, d, cap);
  anims.push(anim);
  observer.observe(canvas);
}
