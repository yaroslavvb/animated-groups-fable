/* Tutorial page: hero demo, 13 chronofrieze strips, operation bestiary. */
"use strict";
import { FilmGroupAnimation } from "./renderer.js";
import { StripAnimation, CHRONOFRIEZE } from "./strip.js";
import { attachControls } from "./controls.js";

const RT3_2 = Math.sqrt(3) / 2;
const SQ = [[1, 0], [0, 1]];
const HEX = [[1, 0], [-0.5, RT3_2]];
const R4 = [[0, -1], [1, 0]];
const R2 = [[-1, 0], [0, -1]];
const R4C = [[0, 1], [-1, 0]];
const R6 = [[1, -1], [1, 0]];
const MY = [[-1, 0], [0, 1]];

function powmat(M, k) {
  let A = [[1, 0], [0, 1]];
  for (let i = 0; i < k; i++) {
    A = [[M[0][0] * A[0][0] + M[0][1] * A[1][0], M[0][0] * A[0][1] + M[0][1] * A[1][1]],
         [M[1][0] * A[0][0] + M[1][1] * A[1][0], M[1][0] * A[0][1] + M[1][1] * A[1][1]]];
  }
  return A;
}

/* hero: 6_1 3_1 2_1 — time-axis P6_1 */
const HERO = {
  basis: HEX,
  ops: Array.from({ length: 6 }, (_, k) =>
    ({ M: powmat(R6, k), v: [0, 0], s: 1, tau: k / 6 })),
  base: [0.36, 0.13],
};

/* bestiary demos */
const BESTIARY = [
  {
    sym: "4<sub>1</sub>4<sub>1</sub>2<sub>1</sub>",
    title: "Time screw",
    text: "(R<sub>π/2</sub>&thinsp;|&thinsp;T<sub>t</sub><sup>1/4</sup>): a quarter turn = a quarter period. The four motifs around each 4-centre are the same motif at four moments.",
    spec: { basis: SQ, ops: Array.from({ length: 4 }, (_, k) =>
      ({ M: powmat(R4, k), v: [0, 0], s: 1, tau: k / 4 })), base: [0.33, 0.15] },
  },
  {
    sym: "~*~*",
    title: "Time glide",
    text: "(m<sub>x</sub>&thinsp;|&thinsp;T<sub>t</sub><sup>1/2</sup>): mirror symmetry that holds only after waiting half a period — mirror images run in counterphase.",
    spec: { basis: SQ, ops: [
      { M: [[1, 0], [0, 1]], v: [0, 0], s: 1, tau: 0 },
      { M: MY, v: [0, 0], s: 1, tau: 0.5 },
    ], base: [0.27, 0.2] },
  },
  {
    sym: "×<sub>½</sub>×<sub>½</sub>",
    title: "Mixed space–time glide",
    text: "(m<sub>x</sub>&thinsp;|&thinsp;T<sub>y</sub><sup>1/2</sup>T<sub>t</sub><sup>1/2</sup>): reflect, slide half a cell, wait half a period.",
    spec: { basis: SQ, ops: [
      { M: [[1, 0], [0, 1]], v: [0, 0], s: 1, tau: 0 },
      { M: MY, v: [0, 0.5], s: 1, tau: 0.5 },
    ], base: [0.27, 0.16] },
  },
  {
    sym: "c2·2·2<sub>1</sub>·2<sub>1</sub>",
    title: "Time centring",
    text: "Centred spacetime lattice: translating by half a cell diagonal = waiting half a period. Half the 2-centres spin in phase, half in counterphase.",
    spec: { basis: SQ, ops: [
      { M: [[1, 0], [0, 1]], v: [0, 0], s: 1, tau: 0 },
      { M: R2, v: [0, 0], s: 1, tau: 0 },
      { M: [[1, 0], [0, 1]], v: [0.5, 0.5], s: 1, tau: 0.5 },
      { M: R2, v: [0.5, 0.5], s: 1, tau: 0.5 },
    ], base: [0.3, 0.17] },
  },
  {
    sym: "o/g′",
    title: "Glide time-reversal",
    text: "(m<sub>t</sub>&thinsp;|&thinsp;T<sub>x</sub><sup>1/2</sup>): played backwards, the film equals itself shifted half a cell — neighbouring columns spin in opposite senses.",
    spec: { basis: SQ, ops: [
      { M: [[1, 0], [0, 1]], v: [0, 0], s: 1, tau: 0 },
      { M: [[1, 0], [0, 1]], v: [0.5, 0], s: -1, tau: 0 },
    ], base: [0.27, 0.2] },
  },
];

const anims = [];
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const a = anims.find(x => x.canvas === e.target);
    if (!a) continue;
    if (e.isIntersecting) { if (!a.userPaused) a.start(); }
    else a.stop();
  }
}, { rootMargin: "60px" });

function attach(anim) {
  anims.push(anim);
  observer.observe(anim.canvas);
}

/* hero */
const heroCanvas = document.getElementById("hero");
if (heroCanvas) {
  const heroAnim = new FilmGroupAnimation(heroCanvas, HERO, { cell: 78 });
  attachControls(heroAnim, heroCanvas.parentElement, heroCanvas.nextSibling);
  attach(heroAnim);
}

/* strips */
const stripsDiv = document.getElementById("strips");
if (stripsDiv) {
  for (const g of CHRONOFRIEZE) {
    const fig = document.createElement("figure");
    fig.style.margin = "0.9rem 0";
    const label = document.createElement("div");
    label.innerHTML = `<span class="sym">${g.name.replace(/_(\w)/g, "<sub>$1</sub>")}</span> <span style="color:var(--muted);font-size:0.9rem;">— ${g.blurb}</span>`;
    label.style.marginBottom = "0.25rem";
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:96px;border:1px solid var(--rule);border-radius:8px;background:#faf9f6;";
    fig.append(label, canvas);
    stripsDiv.append(fig);
    const anim = new StripAnimation(canvas, g, { cell: 92 });
    attachControls(anim, fig);
    attach(anim);
  }
}

/* bestiary */
const bd = document.getElementById("bestiary-cards");
if (bd) {
  for (const b of BESTIARY) {
    const card = document.createElement("div");
    card.className = "gcard";
    const canvas = document.createElement("canvas");
    card.append(canvas);
    const anim = new FilmGroupAnimation(canvas, b.spec, { cell: 58 });
    attachControls(anim, card);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<b>${b.title}</b> <span class="sym" style="margin-left:0.4em;">${b.sym}</span><div style="margin-top:0.2rem;color:var(--muted);">${b.text}</div>`;
    card.append(meta);
    bd.append(card);
    attach(anim);
  }
}

/* fill counts from catalog data */
fetch("data/catalog.json").then(r => r.json()).then(data => {
  for (const el of document.querySelectorAll("[data-count]")) {
    const key = el.dataset.count;
    if (data.meta && data.meta[key] !== undefined) el.textContent = data.meta[key];
  }
}).catch(() => {});
