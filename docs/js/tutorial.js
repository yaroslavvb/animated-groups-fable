/* Tutorial page: hero demo, 13 chronofrieze strips, operation bestiary.
 * All animation specs come from data/featured.json (single source of truth,
 * verified by enumerate/verify_animations.py and at runtime by orbit.js). */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=45";
import { StripAnimation } from "./strip.js?v=45";
import { attachControls } from "./controls.js?v=45";
import { attachStage } from "./stage.js?v=45";

const STRIP_BLURBS = {
  "P1": "translations only — a marching band of identical clocks",
  "P2": "2-fold spacetime rotation: flip space AND run time backwards",
  "Pm_x": "spatial mirror, clocks in phase",
  "Pg_x": "time glide: mirror + half-period delay",
  "Pm_t": "time mirror: the loop is a palindrome",
  "Pg_t": "glide time-reversal: played backwards = shifted half a cell",
  "P2m_xm_t": "mirror + palindrome (and their product, the 2-fold)",
  "P2g_xg_t": "both glides; only the 2-fold survives undisplaced",
  "P2m_xg_t": "mirror + glide time-reversal",
  "P2g_xm_t": "time glide + palindrome",
  "Cm_x": "centred: neighbours run half a period out of phase; mirror survives",
  "Cm_t": "centred palindrome",
  "C2m_xm_t": "centred, mirror and palindrome together",
};

const BESTIARY = [
  { id: "p4-timescrew", sym: "4<sub>1</sub>4<sub>1</sub>2<sub>1</sub>", title: "Time screw",
    text: "(R<sub>&pi;/2</sub>&thinsp;|&thinsp;T<sub>t</sub><sup>1/4</sup>): a quarter turn = a quarter period. The four motifs around each 4-centre are the same motif at four moments." },
  { id: "pm-timeglide", sym: "~*~*", title: "Time glide",
    text: "(m<sub>x</sub>&thinsp;|&thinsp;T<sub>t</sub><sup>1/2</sup>): mirror symmetry that holds only after waiting half a period — mirror images run in counterphase. (Crystallographically this group is pg&nbsp;&times;&nbsp;&#8484; in disguise — see the gallery.)" },
  { id: "mixed-glide", sym: "&times;<sub>&frac12;</sub>&times;<sub>&frac12;</sub>", title: "Mixed space–time glide",
    text: "(m<sub>x</sub>&thinsp;|&thinsp;T<sub>y</sub><sup>1/2</sup>T<sub>t</sub><sup>1/2</sup>): reflect, slide half a cell, wait half a period." },
  { id: "p2-timecentred", sym: "c222<sub>1</sub>2<sub>1</sub>", title: "Time centring",
    text: "Centred spacetime lattice: translating by half a cell diagonal = waiting half a period. Half the 2-centres fill in phase, half in counterphase." },
  { id: "glide-time-reversal", sym: "o/g&prime;", title: "Glide time-reversal",
    text: "(m<sub>t</sub>&thinsp;|&thinsp;T<sub>x</sub><sup>1/2</sup>): played backwards, the animation equals itself shifted half a cell — neighbouring columns fill and drain in opposite senses." },
];

const anims = [];
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const a = anims.find(x => x.canvas === e.target);
    if (!a) continue;
    if (e.isIntersecting) { if (a.playRequested) a.start(); else a.drawStatic(); }
    else a.stop();
  }
}, { rootMargin: "60px" });

function attach(anim) {
  anims.push(anim);
  observer.observe(anim.canvas);
}

async function init() {
  const data = await (await fetch("data/featured.json", {cache: "no-cache"})).json();

  /* hero */
  const heroCanvas = document.getElementById("hero");
  if (heroCanvas) {
    // note the neighbours before attachStage wraps the canvas
    const box = heroCanvas.parentElement, cap = heroCanvas.nextElementSibling;
    const heroAnim = new FilmGroupAnimation(heroCanvas, data.specs.hero);
    attachStage(heroAnim, heroCanvas);
    attachControls(heroAnim, box, cap);
    attach(heroAnim);
  }

  /* strips */
  const stripsDiv = document.getElementById("strips");
  if (stripsDiv) {
    for (const g of data.strips) {
      const fig = document.createElement("figure");
      fig.style.margin = "0.9rem 0";
      const label = document.createElement("div");
      label.innerHTML = `<span class="sym">${g.orb || g.name}</span> <span style="color:var(--muted);font-size:0.9rem;">${g.name.replace(/_(\w)/g, "<sub>$1</sub>")} — ${STRIP_BLURBS[g.name] || ""}</span>`;
      label.style.marginBottom = "0.25rem";
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:100%;height:96px;border:1px solid var(--rule);border-radius:8px;background:#faf9f6;";
      fig.append(label, canvas);
      stripsDiv.append(fig);
      const anim = new StripAnimation(canvas, g);
      attachStage(anim, canvas);
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
      bd.append(card);   // attach before constructing: geometry reads clientWidth
      const anim = new FilmGroupAnimation(canvas, data.specs[b.id]);
      attachStage(anim, canvas);
      attachControls(anim, card);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<b>${b.title}</b> <span class="sym" style="margin-left:0.4em;">${b.sym}</span><div style="margin-top:0.2rem;color:var(--muted);">${b.text}</div>`;
      card.append(meta);
      attach(anim);
    }
  }

  /* fill counts from catalog data */
  fetch("data/catalog.json", {cache: "no-cache"}).then(r => r.json()).then(cat => {
    for (const el of document.querySelectorAll("[data-count]")) {
      const key = el.dataset.count;
      if (cat.meta && cat.meta[key] !== undefined) el.textContent = cat.meta[key];
    }
  }).catch(() => {});
}

init();
