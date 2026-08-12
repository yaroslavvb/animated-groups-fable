/* Wallpaper atlas, DETAIL level: one wallpaper group (?g=<hm>), a single
 * notation-style tab widget over EVERY film group whose spatial projection
 * it is. The box below the animation gives the group's data and a
 * plain-English account of its time behaviour. */
"use strict";
import { buildTabs } from "./tabs.js?v=39";
import { WALLPAPERS, sectionSort, censusSentence, timeStory, setSignatures, signatureOf }
  from "./wallpaper-data.js?v=39";

/* The book's colour signatures for the forward groups, so the atlas names each
 * film group the way the correspondence tables do. Optional by construction:
 * if the file is missing the captions fall back to the catalogue symbol. */
async function loadSignatures() {
  try {
    const r = await fetch("data/xu-correspondence.json", { cache: "no-cache" });
    if (!r.ok) return;
    const d = await r.json();
    setSignatures(new Map(Object.entries(d.groups)));
  } catch (e) {
    console.warn("wallpaper: no colour signatures —", e.message);
  }
}

await loadSignatures();

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
  document.title = `${w.orb} · ${w.hm} — Wallpaper Atlas — Film Groups`;

  const prev = WALLPAPERS[(idx + WALLPAPERS.length - 1) % WALLPAPERS.length];
  const next = WALLPAPERS[(idx + 1) % WALLPAPERS.length];
  head.innerHTML =
    `<h1><span class="sym">${w.orb}</span> · ${w.hm}</h1>` +
    `<p class="subtitle">All ${list.length} film groups whose spatial ` +
    `projection is ${w.hm} — tab across them; the box below each animation ` +
    `describes its time behaviour.</p>` +
    `<p><a href="wallpaper.html#wp-${w.hm}">← atlas overview</a> &ensp;·&ensp; ` +
    `<a href="wallpaper-group.html?g=${prev.hm}">← <span class="sym">${prev.orb}</span> ${prev.hm}</a> &ensp;·&ensp; ` +
    `<a href="wallpaper-group.html?g=${next.hm}"><span class="sym">${next.orb}</span> ${next.hm} →</a></p>`;
  intro.innerHTML = `<p>${w.note} ${w.issues}</p>` +
    `<p style="color:var(--muted);">${censusSentence(w, list)}</p>`;

  const tabHost = document.createElement("div");
  tabHost.className = "tabdemo big";
  listDiv.append(tabHost);   // attach before constructing animations
  buildTabs(tabHost, list.map(g => ({ g, sym: g.symbol, note: timeStory(g) })),
            { split: true, label: labelOf });   // forward run, then the reversal run
}

/* a tab is named by its book signature where it has one */
function labelOf(g) {
  const sig = signatureOf(g.id);
  return sig ? sig.signatureHtml : g.symbolHtml;
}
