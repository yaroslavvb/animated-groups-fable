/* Wallpaper atlas: the 17 wallpaper groups, each shown as a film (the
 * product wallpaper × ℤ, all clocks in unison) followed by EVERY film group
 * whose spatial projection it is — the catalog partitioned by the `base`
 * field, 275 groups in 17 sections. */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=12";
import { attachControls } from "./controls.js?v=12";

/* Crystallographic order; orb = Conway orbifold of the wallpaper group. */
const WALLPAPERS = [
  { hm: "p1",   orb: "o",     note: "Translations only — the quotient is the torus, Conway's o." },
  { hm: "p2",   orb: "2222",  note: "Four families of half-turn centres; the quotient is a pillowcase of four cone points." },
  { hm: "pm",   orb: "**",    note: "Two parallel families of mirrors, nothing else." },
  { hm: "pg",   orb: "××",    note: "No mirrors — two families of glides, two of Conway's miracles." },
  { hm: "cm",   orb: "*×",    note: "A mirror family and a glide family interleaved: the centred rectangle." },
  { hm: "pmm",  orb: "*2222", note: "The rectangular kaleidoscope: mirrors both ways, four corner classes." },
  { hm: "pmg",  orb: "22*",   note: "Half-turn centres beside a single mirror family." },
  { hm: "pgg",  orb: "22×",   note: "Half-turns with glides only; no mirror anywhere." },
  { hm: "cmm",  orb: "2*22",  note: "The centred kaleidoscope: half-turn centres off the mirrors." },
  { hm: "p4",   orb: "442",   note: "Two families of fourfold gyrations and one of half-turns." },
  { hm: "p4m",  orb: "*442",  note: "The square kaleidoscope — the symmetry of graph paper." },
  { hm: "p4g",  orb: "4*2",   note: "Fourfold gyrations beside mirrors, glides between them." },
  { hm: "p3",   orb: "333",   note: "Three families of threefold gyrations." },
  { hm: "p3m1", orb: "*333",  note: "The equilateral-triangle kaleidoscope; every 3-centre on a mirror." },
  { hm: "p31m", orb: "3*3",   note: "A threefold gyration off the mirrors and one on them." },
  { hm: "p6",   orb: "632",   note: "Sixfold, threefold and twofold gyrations." },
  { hm: "p6m",  orb: "*632",  note: "The full hexagonal kaleidoscope, the (30°, 60°, 90°) triangle." },
];

const anims = new Map();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const anim = anims.get(e.target);
    if (!anim) continue;
    if (e.isIntersecting) {
      if (!anim.userPaused) anim.start();
      else anim.setPhase(anim.getPhase());   // draw the paused frame once
    } else {
      anim.stop();
    }
  }
}, { rootMargin: "80px" });

function addAnim(canvas, spec) {
  const anim = new FilmGroupAnimation(canvas, spec);
  anims.set(canvas, anim);
  observer.observe(canvas);
  return anim;
}

const data = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
const byBase = new Map(WALLPAPERS.map(w => [w.hm, []]));
for (const g of data.groups) {
  if (byBase.has(g.base)) byBase.get(g.base).push(g);
  else console.error("unknown spatial base in catalog:", g.base, g.id);
}
// within a section: the pure product first, then forward-time, then reversal
const rank = g => (g.forward ? (g.product ? 0 : 1) : 2);
for (const arr of byBase.values()) {
  arr.sort((a, b) => rank(a) - rank(b) || Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

const toc = document.getElementById("toc");
const atlas = document.getElementById("atlas");

for (const w of WALLPAPERS) {
  const list = byBase.get(w.hm);
  const chip = document.createElement("a");
  chip.className = "chip";
  chip.href = "#wp-" + w.hm;
  chip.innerHTML = `<span class="sym">${w.orb}</span> ${w.hm} <span class="n">${list.length}</span>`;
  toc.append(chip);
}

for (const w of WALLPAPERS) {
  const list = byBase.get(w.hm);
  const prod = list.find(g => g.product && g.forward);
  const nf = list.filter(g => g.forward).length;
  const npr = list.filter(g => g.product).length;

  const sec = document.createElement("section");
  sec.className = "wp";
  sec.id = "wp-" + w.hm;

  const h = document.createElement("h2");
  h.innerHTML = `<span class="sym">${w.orb}</span> · ${w.hm} ` +
    `<span class="n">${list.length} film groups</span>`;
  sec.append(h);

  const p = document.createElement("p");
  p.innerHTML = `${w.note} Of the ${list.length} film groups over ${w.hm}: ` +
    `${nf} forward-time and ${list.length - nf} with time reversal; ` +
    `${npr} ${npr === 1 ? "is a" : "are"} product${npr === 1 ? "" : "s"} of ` +
    `${w.hm} with a time group, ${list.length - npr} genuinely entangle ` +
    `space with time.`;
  sec.append(p);
  // attach the section BEFORE constructing any animation: geometry is read
  // from clientWidth/clientHeight at construction, and a detached canvas
  // falls back to a square default that would render the lattice distorted
  atlas.append(sec);

  // the wallpaper itself, as a film: the product w × ℤ (all offsets zero)
  if (prod) {
    const demo = document.createElement("div");
    demo.className = "demo";
    const canvas = document.createElement("canvas");
    demo.append(canvas);
    const cap = document.createElement("div");
    cap.className = "caption";
    cap.innerHTML =
      `<span class="sym">${prod.symbolHtml}</span> — the wallpaper itself, ` +
      `run as a film: the product ${w.hm} × ℤ. Every clock ticks in unison, ` +
      `so each instant carries the full ${w.hm} symmetry — the degenerate ` +
      `case in which all clockwork decorations vanish. ` +
      `<a class="linkish" href="catalog.html#${prod.id}">catalog ↗</a>`;
    demo.append(cap);
    sec.append(demo);
    const anim = addAnim(canvas, prod.render);
    attachControls(anim, demo, cap);
  } else {
    console.error("no forward product found for", w.hm);
  }

  const grid = document.createElement("div");
  grid.className = "cardgrid";
  sec.append(grid);
  for (const g of list) {
    const card = document.createElement("div");
    card.className = "gcard";
    const canvas = document.createElement("canvas");
    card.append(canvas);
    grid.append(card);   // attach first — see note above
    const anim = addAnim(canvas, g.render);
    attachControls(anim, card);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML =
      `<span class="sym">${g.symbolHtml}</span>` +
      `<span class="hm">${g.hm || ""}</span>` +
      `<a class="linkish" style="float:right;text-decoration:none;" ` +
      `href="catalog.html#${g.id}">catalog ↗</a>` +
      `<div class="tags">` +
      (g.symmorphic ? "" : `<span class="tag nonsym">nonsymmorphic</span>`) +
      (g.forward ? "" : `<span class="tag rev">time reversal</span>`) +
      (g.product ? `<span class="tag product">product</span>` : "") +
      `</div>`;
    card.append(meta);
  }
}

// sanity: every catalog group must appear in exactly one section
const shown = [...byBase.values()].reduce((n, a) => n + a.length, 0);
if (shown !== data.groups.length) {
  console.error(`atlas shows ${shown} of ${data.groups.length} groups`);
}

// the sections exist only after the awaited fetch, so fragment navigation
// (#wp-p4m from a toc chip, bookmark, or the notation page) needs replaying
function openFromHash() {
  const id = location.hash.replace(/^#/, "");
  if (!id) return;
  const el = document.getElementById(id);
  // instant, not smooth: a fragment jump on a page this long should not
  // animate through sixty thousand pixels of atlas
  if (el) el.scrollIntoView({ behavior: "instant" });
}
openFromHash();
window.addEventListener("hashchange", openFromHash);
