/* Catalogue A driver: the 17 wallpaper groups as 2D crystals.
 *
 * Each section's plate is the base's TRIVIAL CLOCK (the forward product
 * group of catalog.json), constructed live but left paused — attachStage
 * paints the frozen frame, and a click lets it run. The fact rows are
 * computed from data/catalog.json (spacetime and clockwork censuses) and
 * data/colored.json (colouring census, subgroup/kernel appearances). */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=45";
import { attachStage } from "./stage.js?v=45";

const ORDER17 = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm",
                 "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"];

/* wallpaper × ℤ vertical stack: the symmorphic space group that is the
 * phase-as-height lift of the trivial clock (catalogue B anchors) */
const STACK = {
  p1:  [1,   "P1"],   p2:   [3,   "P2"],   pm:   [6,   "Pm"],
  pg:  [7,   "Pc"],   cm:   [8,   "Cm"],   pmm:  [25,  "Pmm2"],
  pmg: [28,  "Pma2"], pgg:  [32,  "Pba2"], cmm:  [35,  "Cmm2"],
  p4:  [75,  "P4"],   p4m:  [99,  "P4mm"], p4g:  [100, "P4bm"],
  p3:  [143, "P3"],   p3m1: [156, "P3m1"], p31m: [157, "P31m"],
  p6:  [168, "P6"],   p6m:  [183, "P6mm"],
};

const catalog = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
let colored = null;
try {
  colored = await (await fetch("data/colored.json", { cache: "no-cache" })).json();
} catch (e) { /* colouring rows are skipped if the census is unavailable */ }

function addRow(dl, dt, dd) {
  const t = document.createElement("dt");
  t.innerHTML = dt;
  const d = document.createElement("dd");
  d.innerHTML = dd;
  dl.appendChild(t);
  dl.appendChild(d);
}

/* "pm[4] ×3" links into catalogue D for entries whose sub/kernel is hm */
function appearances(field, hm) {
  const tally = new Map();
  for (const g of colored.groups) {
    if (g[field].hm !== hm) continue;
    const key = `${g.base.hm}|${g.k}`;
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  return [...tally.entries()]
    .map(([key, n]) => {
      const [b, k] = key.split("|");
      return { b, k: +k, n };
    })
    .sort((a, b) => a.k - b.k || ORDER17.indexOf(a.b) - ORDER17.indexOf(b.b))
    .map(({ b, k, n }) =>
      `<a href="crystals-colored.html#k${k}-${b}">${b}[${k}]</a>` +
      (n > 1 ? `&thinsp;×${n}` : ""));
}

for (const hm of ORDER17) {
  const sec = document.getElementById(hm);
  if (!sec) continue;

  const over = catalog.groups.filter(g => g.base === hm);
  const triv = over.find(g => g.forward && g.product);

  /* the static plate: live-but-paused trivial clock; never autostarted */
  const canvas = sec.querySelector("canvas");
  if (canvas && triv) {
    const anim = new FilmGroupAnimation(canvas, triv.render);
    attachStage(anim, canvas);
  }

  const dl = sec.querySelector("dl.facts");
  if (!dl) continue;

  /* spacetime groups over this base */
  const nFwd = over.filter(g => g.forward).length;
  addRow(dl, "Spacetime groups over it",
    `${over.length} of the 275 (${nFwd} forward, ` +
    `${over.length - nFwd} with time reversal) — ` +
    `<a href="wallpaper-group.html?g=${hm}">all of them, animated</a>`);

  /* clockwork crystals: the forward non-products, plus the trivial clock */
  const fwd = over.filter(g => g.forward && !g.product)
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const links = fwd.map(g =>
    `<a href="crystals-clockwork.html#${g.id}"><span class="sym">${g.symbolHtml}</span></a>`);
  addRow(dl, "Clockwork crystals over it",
    (fwd.length
      ? `${fwd.length} nontrivial: ${links.join(", ")} — plus `
      : `none nontrivial; only `) +
    `the trivial clock <a href="crystals-clockwork.html#${triv.id}">` +
    `<span class="sym">${triv.symbolHtml}</span></a>`);

  if (colored) {
    /* colourings of this base, per number of colours */
    const per = colored.meta.perGroup[hm] || {};
    const parts = [];
    let total = 0;
    for (const k of [2, 3, 4, 5, 6]) {
      const n = per[k];
      if (!n) continue;
      total += n;
      parts.push(`<a href="crystals-colored.html#k${k}-${hm}">k&thinsp;=&thinsp;${k}: ${n}</a>`);
    }
    addRow(dl, "Colourings (k ≤ 6)",
      `${total} — ${parts.join(" · ")}`);

    /* where this group sits inside a colouring */
    const asH = appearances("sub", hm);
    addRow(dl, "As colour-preserving H in",
      asH.length ? asH.join(", ") : "none with k ≤ 6");
    const asK = appearances("kernel", hm);
    addRow(dl, "As colour-fixing kernel in",
      asK.length ? asK.join(", ") : "none with k ≤ 6");
  }

  /* the wallpaper × ℤ stack in catalogue B */
  const [sgNo, sgSym] = STACK[hm];
  addRow(dl, "Vertical stack",
    `<a href="crystals-3d.html#sg-${sgNo}"><span class="sym">${sgSym}</span> — ` +
    `space group ${sgNo}</a> ` +
    `<span style="color:var(--muted);">(${hm} × ℤ: the phase-as-height ` +
    `lift of the trivial clock)</span>`);
}
