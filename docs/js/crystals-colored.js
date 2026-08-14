/* Catalogue D driver: the coloured 2D crystals, from data/colored.json.
 *
 * Builds the k-by-wallpaper-group catalogue with lazily painted static
 * plates (colored-crystal.js), Grünbaum–Shephard / Shubnikov labels where
 * the bibliographic mapping (data/colored-gs.json) provides them, and
 * crosslinks into catalogues A (bases and subgroups), C (clockwork
 * realisations) and E (pattern types). */
"use strict";
import { paintColoredCrystal } from "./colored-crystal.js?v=40";

const ORDER17 = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm",
                 "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"];
const KWORDS = { 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six" };
const SUBS = "₀₁₂₃₄₅₆₇₈₉";

const data = await (await fetch("data/colored.json", { cache: "no-cache" })).json();
let gsMap = {};
try {
  const r = await fetch("data/colored-gs.json", { cache: "no-cache" });
  if (r.ok) gsMap = (await r.json()).groups || {};
} catch (e) { /* bibliographic overlay is optional */ }
let catalog = null;
try {
  catalog = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
} catch (e) { /* counts fall back to markup defaults */ }

/* live counts in the prose */
const counts = {
  total: data.meta.total,
  cyclic: data.meta.cyclic,
  fwdnontrivial: catalog
    ? catalog.groups.filter(g => g.forward && !g.product).length : null,
};
for (const el of document.querySelectorAll("[data-count]")) {
  const v = counts[el.dataset.count];
  if (v !== null && v !== undefined) el.textContent = v;
}

const sub = n => String(n).split("").map(c => SUBS[+c] || c).join("");
const groupsOf = (k, hm) =>
  data.groups.filter(g => g.k === k && g.base.hm === hm);

function labelHtml(g) {
  const m = gsMap[g.id];
  if (m && m.gs) {
    // e.g. "pm[2]3" -> pm[2]₃ in the site's symbol style
    const t = m.gs.replace(/\[(\d)\](\d+)(\*?)/,
      (_, kk, i, star) => `[${kk}]${sub(+i)}${star}`);
    return `<span class="sym">${t}</span>`;
  }
  const n = +g.id.split("-")[2];
  return `<span class="sym">${g.base.hm}[${g.k}]${sub(n)}</span>`;
}

function tagsHtml(g) {
  const t = [];
  t.push(`<span class="tag">${g.action}</span>`);
  if (g.clockwork.length) t.push(`<span class="tag kind-cyclic">clockwork</span>`);
  else if (g.cyclic && g.boostable) t.push(`<span class="tag">cyclic · boostable</span>`);
  else if (g.cyclic) t.push(`<span class="tag">cyclic · no ${g.k}-clock</span>`);
  if (g.chiral) t.push(`<span class="tag kind-none">chiral pair</span>`);
  return t.join(" ");
}

function linksHtml(g) {
  const parts = [];
  parts.push(`<a href="crystals-2d.html#${g.base.hm}">Γ ${g.base.hm}</a>`);
  parts.push(`<a href="crystals-2d.html#${g.sub.hm}">H ${g.sub.hm}</a>`);
  for (const gid of g.clockwork) {
    parts.push(`<a href="crystals-clockwork.html#${gid}">⏱ ${gid.replace("g", "xu")}</a>`);
  }
  const m = gsMap[g.id];
  if (m && m.ppAnchors) {
    for (const a of m.ppAnchors) {
      parts.push(`<a href="crystals-patterns.html#${a.anchor}">${a.label}</a>`);
    }
  }
  parts.push(`<a href="#${g.id}" class="mono">¶</a>`);
  return parts.join(" · ");
}

function pairHtml(g) {
  const kern = g.kernel.hm === g.sub.hm && g.normal
    ? "" : ` · kernel <span class="sym">${g.kernel.orb}</span> (${g.kernel.hm})`;
  const shub = (gsMap[g.id] && gsMap[g.id].shubnikov)
    ? ` · <span class="sym">${gsMap[g.id].shubnikov}</span>` : "";
  return `<span class="sym">${g.base.orb}</span> / ` +
         `<span class="sym">${g.sub.orb}</span> (${g.sub.hm})${kern}${shub}`;
}

/* lazy painter */
const painted = new WeakSet();
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting || painted.has(e.target)) continue;
    painted.add(e.target);
    const g = data.groups.find(x => x.id === e.target.dataset.gid);
    try { paintColoredCrystal(e.target, g.render); }
    catch (err) { console.error("paint failed for", g.id, err); }
  }
}, { rootMargin: "300px" });

/* filters */
const filterState = { action: "", flag: "" };
const actions = [...new Set(data.groups.map(g => g.action))].sort();
const filters = document.getElementById("filters");
filters.innerHTML =
  `<label>action <select id="f-action"><option value="">any</option>` +
  actions.map(a => `<option>${a}</option>`).join("") + `</select></label> ` +
  `<label>show <select id="f-flag"><option value="">all</option>` +
  `<option value="clockwork">with a clockwork twin</option>` +
  `<option value="cyclic">cyclic</option>` +
  `<option value="boostable">cyclic, boostable</option>` +
  `<option value="chiral">chiral</option>` +
  `<option value="nonnormal">H not normal</option></select></label> ` +
  `<span id="f-n" style="color:var(--muted);"></span>`;

function passes(g) {
  if (filterState.action && g.action !== filterState.action) return false;
  switch (filterState.flag) {
    case "clockwork": return g.clockwork.length > 0;
    case "cyclic": return g.cyclic;
    case "boostable": return g.boostable;
    case "chiral": return g.chiral;
    case "nonnormal": return !g.normal;
    default: return true;
  }
}

function applyFilters() {
  let shown = 0;
  for (const card of document.querySelectorAll(".gcard[data-gid]")) {
    const g = data.groups.find(x => x.id === card.dataset.gid);
    const ok = passes(g);
    card.style.display = ok ? "" : "none";
    if (ok) shown++;
  }
  for (const sec of document.querySelectorAll("[data-block]")) {
    const any = [...sec.querySelectorAll(".gcard[data-gid]")]
      .some(c => c.style.display !== "none");
    sec.style.display = any ? "" : "none";
  }
  document.getElementById("f-n").textContent =
    shown === data.groups.length ? "" : `${shown} of ${data.groups.length}`;
}
document.getElementById("f-action").addEventListener("change", e => {
  filterState.action = e.target.value; applyFilters();
});
document.getElementById("f-flag").addEventListener("change", e => {
  filterState.flag = e.target.value; applyFilters();
});

/* TOC */
const toc = document.getElementById("toc");
toc.innerHTML = [2, 3, 4, 5, 6].map(k =>
  `<a class="chip" href="#k${k}">${k} colours · ${data.meta.totals[k]}</a>`
).join("");

/* the catalogue */
const host = document.getElementById("catalogue");
for (const k of [2, 3, 4, 5, 6]) {
  const h2 = document.createElement("h2");
  h2.id = `k${k}`;
  h2.innerHTML = `${KWORDS[k]} colours — ${data.meta.totals[k]} crystals`;
  host.appendChild(h2);
  for (const hm of ORDER17) {
    const list = groupsOf(k, hm);
    if (!list.length) continue;
    const block = document.createElement("section");
    block.dataset.block = `${k}-${hm}`;
    const orb = list[0].base.orb;
    block.innerHTML =
      `<h3 id="k${k}-${hm}">over <span class="sym">${orb}</span> · ` +
      `<a href="crystals-2d.html#${hm}">${hm}</a>` +
      `<span style="color:var(--muted); font-weight:normal;"> — ` +
      `${list.length} colouring${list.length > 1 ? "s" : ""}</span></h3>`;
    const grid = document.createElement("div");
    grid.className = "cardgrid";
    for (const g of list) {
      const card = document.createElement("div");
      card.className = "gcard";
      card.id = g.id;
      card.dataset.gid = g.id;
      const cv = document.createElement("canvas");
      cv.dataset.gid = g.id;
      card.appendChild(cv);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML =
        `<div>${labelHtml(g)} <span class="tags">${tagsHtml(g)}</span></div>` +
        `<div style="font-size:0.88rem;">${pairHtml(g)}</div>` +
        `<div style="font-size:0.85rem; color:var(--muted);">${linksHtml(g)}</div>`;
      card.appendChild(meta);
      grid.appendChild(card);
      io.observe(cv);
    }
    block.appendChild(grid);
    host.appendChild(block);
  }
}
applyFilters();
