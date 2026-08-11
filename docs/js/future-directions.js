/* Future-directions page: paired demos — a STATIC coloured rendering of a
 * film-group spec (colour = clock data) beside the LIVE film — plus the
 * colour-count numbers computed from the catalog at load time, so the page
 * can never disagree with the data. */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=22";
import { attachControls } from "./controls.js?v=22";
import { paintColored } from "./colored.js?v=22";
import { groupCaption } from "./wallpaper-data.js?v=22";

const PAIRS = [
  { host: "pair-bw", sym: "o/g′", mode: "bw",
    left: "The dichromatic pattern: colour = time sign. Swapping black and \
white is playing the film backwards; here the swap is carried by a \
half-cell translation.",
    right: "The film itself: columns alternately fill and drain." },
  { host: "pair-checker", sym: "c222₁2₁", mode: "phase",
    left: "The unitary two-colouring: hue = phase, and the two phases 0 and \
½ paint the two sublattices of the checkerboard.",
    right: "The film: translating half a cell diagonally equals waiting \
half a period." },
  { host: "pair-z4", sym: "4₁4₁2₁", mode: "phase",
    left: "The perfect ℤ₄-colouring of p4: a quarter turn about any \
4-centre advances the colour by one.",
    right: "The film: the same quarter turn advances the phase by a \
quarter period." },
  { host: "pair-z6", sym: "6₁3₁2₁", mode: "phase",
    left: "The perfect ℤ₆-colouring of p6: six colours cycling around every \
6-centre, three around every 3-centre, two around every 2-centre.",
    right: "The film: the hero of the tutorial, read chromatically." },
];

const anims = new Map();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const anim = anims.get(e.target);
    if (!anim) continue;
    if (e.isIntersecting) { if (!anim.userPaused) anim.start(); }
    else anim.stop();
  }
}, { rootMargin: "80px" });

const data = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
const bySym = new Map(data.groups.map(g => [g.symbol, g]));

for (const p of PAIRS) {
  const host = document.getElementById(p.host);
  if (!host) continue;
  const g = bySym.get(p.sym);
  if (!g) { console.error("missing symbol", p.sym); continue; }

  const mk = (cap) => {
    const demo = document.createElement("div");
    demo.className = "demo";
    const canvas = document.createElement("canvas");
    demo.append(canvas);
    const c = document.createElement("div");
    c.className = "caption";
    c.innerHTML = cap;
    demo.append(c);
    host.append(demo);
    return { demo, canvas, cap: c };
  };

  const L = mk(`<span class="sym">${g.symbolHtml}</span>, coloured — ${p.left}`);
  paintColored(L.canvas, g.render, p.mode);

  const R = mk(groupCaption(g) + `<p style="margin:0.4rem 0 0;">${p.right}</p>`);
  const anim = new FilmGroupAnimation(R.canvas, g.render);
  anims.set(R.canvas, anim);
  observer.observe(R.canvas);
  attachControls(anim, R.demo, R.cap);
}

/* colour counts, computed live from the catalog */
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function denom(x) {
  // smallest q <= 12 with q*x integral (all catalog taus are 12-smooth)
  for (let q = 1; q <= 12; q++) if (Math.abs(q * x - Math.round(q * x)) < 1e-6) return q;
  return 1;
}
function clockDenom(g) {
  let d = 1;
  for (const op of g.render.ops) d = d * denom(op.tau) / gcd(d, denom(op.tau));
  return d;
}
function clockless(g) {
  return g.render.ops.every(op =>
    op.s === -1 || denom(((op.tau % 1) + 1) % 1) === 1);
}
const fwd = data.groups.filter(g => g.forward);
const byN = {};
for (const g of fwd) byN[clockDenom(g)] = (byN[clockDenom(g)] || 0) + 1;
const rev = data.groups.filter(g => !g.forward && clockless(g));
const gray = rev.filter(g => g.product).length;
const put = (key, val) => {
  for (const el of document.querySelectorAll(`[data-cc="${key}"]`)) el.textContent = val;
};
put("gray", gray);
put("proper", rev.length - gray);
put("n1", byN[1] || 0);
put("n2", byN[2] || 0);
put("n2b", byN[2] || 0);
put("n3", byN[3] || 0);
put("n4", byN[4] || 0);
put("n6", byN[6] || 0);
put("nf", fwd.length);
