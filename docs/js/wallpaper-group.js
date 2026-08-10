/* Wallpaper atlas, DETAIL level: one wallpaper group (?g=<hm>), every film
 * group whose spatial projection it is, each as a full-size demo. */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=14";
import { attachControls } from "./controls.js?v=14";
import { WALLPAPERS, sectionSort, censusSentence, groupCaption }
  from "./wallpaper-data.js?v=14";

const anims = new Map();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const anim = anims.get(e.target);
    if (!anim) continue;
    if (e.isIntersecting) {
      if (!anim.userPaused) anim.start();
      else anim.setPhase(anim.getPhase());
    } else {
      anim.stop();
    }
  }
}, { rootMargin: "120px" });

const hm = new URLSearchParams(location.search).get("g");
const idx = WALLPAPERS.findIndex(w => w.hm === hm);
const head = document.getElementById("wg-head");
const intro = document.getElementById("wg-intro");
const listDiv = document.getElementById("wg-list");

if (idx < 0) {
  // no (or unknown) wallpaper requested: offer the 17 choices
  head.innerHTML = `<h1>Choose a wallpaper group</h1>`;
  const p = document.createElement("p");
  for (const w of WALLPAPERS) {
    const a = document.createElement("a");
    a.className = "chip";
    a.style.marginRight = "0.4rem";
    a.href = `wallpaper-group.html?g=${w.hm}`;
    a.innerHTML = `<span class="sym">${w.orb}</span> ${w.hm}`;
    p.append(a);
  }
  intro.append(p);
} else {
  const w = WALLPAPERS[idx];
  const data = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
  const list = sectionSort(data.groups.filter(g => g.base === w.hm));
  document.title = `${w.hm} — Wallpaper Atlas — Film Groups`;

  const prev = WALLPAPERS[(idx + WALLPAPERS.length - 1) % WALLPAPERS.length];
  const next = WALLPAPERS[(idx + 1) % WALLPAPERS.length];
  head.innerHTML =
    `<h1><span class="sym">${w.orb}</span> · ${w.hm}</h1>` +
    `<p class="subtitle">All ${list.length} film groups whose spatial ` +
    `projection is ${w.hm}, at full size.</p>` +
    `<p><a href="wallpaper.html#wp-${w.hm}">← atlas overview</a> &ensp;·&ensp; ` +
    `<a href="wallpaper-group.html?g=${prev.hm}">← ${prev.hm}</a> &ensp;·&ensp; ` +
    `<a href="wallpaper-group.html?g=${next.hm}">${next.hm} →</a></p>`;
  intro.innerHTML = `<p>${w.note} ${w.issues}</p>` +
    `<p style="color:var(--muted);">${censusSentence(w, list)}</p>`;

  for (const g of list) {
    const demo = document.createElement("div");
    demo.className = "demo";
    const canvas = document.createElement("canvas");
    demo.append(canvas);
    const cap = document.createElement("div");
    cap.className = "caption";
    cap.innerHTML = groupCaption(g);
    demo.append(cap);
    listDiv.append(demo);   // attach before constructing
    const anim = new FilmGroupAnimation(canvas, g.render);
    anims.set(canvas, anim);
    observer.observe(canvas);
    attachControls(anim, demo, cap);
  }
}
