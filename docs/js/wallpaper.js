/* Wallpaper atlas, OVERVIEW level: 17 sections, one per wallpaper group.
 * Each section: what happens over this base (the issues), then a
 * notation-style tab widget over ALL film groups with that projection —
 * the info box below each animation states its time behaviour — and a
 * link to the same list larger (wallpaper-group.html?g=<hm>). */
"use strict";
import { buildTabs } from "./tabs.js?v=33";
import { WALLPAPERS, sectionSort, censusSentence, timeStory }
  from "./wallpaper-data.js?v=33";

const data = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
const byBase = new Map(WALLPAPERS.map(w => [w.hm, []]));
for (const g of data.groups) {
  if (byBase.has(g.base)) byBase.get(g.base).push(g);
  else console.error("unknown spatial base in catalog:", g.base, g.id);
}

const toc = document.getElementById("toc");
const atlas = document.getElementById("atlas");

for (const w of WALLPAPERS) {
  const chip = document.createElement("a");
  chip.className = "chip";
  chip.href = "#wp-" + w.hm;
  chip.innerHTML = `<span class="sym">${w.orb}</span> ${w.hm} ` +
    `<span class="n">${byBase.get(w.hm).length}</span>`;
  toc.append(chip);
}

for (const w of WALLPAPERS) {
  const list = sectionSort(byBase.get(w.hm));

  const sec = document.createElement("section");
  sec.className = "wp";
  sec.id = "wp-" + w.hm;
  atlas.append(sec);   // attach before any animation is constructed

  const h = document.createElement("h2");
  h.innerHTML = `<span class="sym">${w.orb}</span> · ${w.hm} ` +
    `<span class="n">${list.length} film groups</span>`;
  sec.append(h);

  const p = document.createElement("p");
  p.innerHTML = `${w.note} ${w.issues}`;
  sec.append(p);

  const pc = document.createElement("p");
  pc.style.color = "var(--muted)";
  pc.textContent = censusSentence(w, list);
  sec.append(pc);

  // ALL film groups over this base, tabbed (product first, then forward,
  // then reversal)
  const tabHost = document.createElement("div");
  tabHost.className = "tabdemo";
  sec.append(tabHost);
  buildTabs(tabHost, list.map(g => ({ g, sym: g.symbol, note: timeStory(g) })));

  const all = document.createElement("p");
  all.className = "alllink";
  all.innerHTML = `<a href="wallpaper-group.html?g=${w.hm}">` +
    `The same ${list.length} groups on their own page, larger →</a>`;
  sec.append(all);
}

// fragment navigation must replay after the awaited fetch built the sections
function openFromHash() {
  const id = location.hash.replace(/^#/, "");
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "instant" });
}
openFromHash();
window.addEventListener("hashchange", openFromHash);
