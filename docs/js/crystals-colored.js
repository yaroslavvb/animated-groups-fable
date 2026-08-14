/* Catalogue D driver: the coloured 2D crystals, from data/colored.json.
 *
 * Builds the k-by-wallpaper-group catalogue with lazily painted static
 * plates (colored-crystal.js), Grünbaum–Shephard / Shubnikov labels where
 * the bibliographic mapping (data/colored-gs.json) provides them, and
 * crosslinks into catalogues A (bases and subgroups), C (clockwork
 * realisations) and E (pattern types). */
"use strict";
import { paintColoredCrystal } from "./colored-crystal.js?v=43";

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

const SUPS = { 2: "\u00b2", 3: "\u00b3", 4: "\u2074", 5: "\u2075", 6: "\u2076" };

/* THE BOOK'S COLOUR TYPE. Conway, Burgiel and Goodman-Strauss name a colouring
 * by the orbifold of the whole group, the index as a superscript, and the
 * orbifold of the colour-fixing kernel: 3*3⁶/333, 2222/◦. Twofold is
 * understood, so k = 2 prints no exponent.
 *
 * This is the notation the clockwork/colouring correspondence tables use, and
 * the rule is checked against them: over the 51 coloured crystals that have a
 * clockwork twin it reproduces the published colour type in every case. */
function tosHtml(g) {
  const sup = g.k > 2 ? SUPS[g.k] : "";
  return `<span class="sym">${g.base.orb}${sup}/${g.kernel.orb}</span>`;
}

/* The Grünbaum-Shephard symbol, kept as the secondary name: it distinguishes
 * colourings that share a colour type, which the pair notation does not. */
function gsHtml(g) {
  const m = gsMap[g.id];
  if (m && m.gs) {
    const t = m.gs.replace(/\[(\d)\](\d+)(\*?)/,
      (_, kk, i, star) => `[${kk}]${sub(+i)}${star}`);
    return `<span class="sym">${t}</span>`;
  }
  const n = +g.id.split("-")[2];
  return `<span class="sym">${g.base.hm}[${g.k}]${sub(n)}</span>`;
}

function labelHtml(g) { return tosHtml(g); }

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
  // the colour type is now the lead label, so this line carries what it does
  // NOT say: the stabiliser H, the kernel when it differs from H, the
  // Grünbaum-Shephard symbol, and Shubnikov's where there is one
  const kern = g.kernel.hm === g.sub.hm && g.normal
    ? "" : ` · kernel <span class="sym">${g.kernel.orb}</span> (${g.kernel.hm})`;
  const shub = (gsMap[g.id] && gsMap[g.id].shubnikov)
    ? ` · <span class="sym">${gsMap[g.id].shubnikov}</span>` : "";
  return `${gsHtml(g)} · H <span class="sym">${g.sub.orb}</span> ` +
         `(${g.sub.hm})${kern}${shub}`;
}

/* lazy painter */
const painted = new WeakSet();
/* Panes paint when they are first opened (buildPlateTabs), so nothing is
 * drawn for a colouring nobody has looked at. */

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
  // a filtered-out colouring loses its TAB; the section goes when none is left,
  // and a section whose open tab was just hidden re-opens on its first survivor
  for (const btn of document.querySelectorAll(".tabbtn[data-gid]")) {
    const g = data.groups.find(x => x.id === btn.dataset.gid);
    const ok = passes(g);
    btn.style.display = ok ? "" : "none";
    if (ok) shown++;
  }
  for (const sec of document.querySelectorAll("[data-block]")) {
    const live = [...sec.querySelectorAll(".tabbtn[data-gid]")]
      .filter(b => b.style.display !== "none");
    sec.style.display = live.length ? "" : "none";
    if (live.length && !live.some(b => b.classList.contains("active"))) {
      sec._openFirst && sec._openFirst();
    }
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

/* THE CATALOGUE, as tabbed panes.
 *
 * Same widget the wallpaper atlas uses: over each wallpaper group the
 * colourings are a row of tabs and one large plate, rather than a grid of
 * thumbnails. A colouring is a picture you read — which cells took which
 * colour, and where the colour-fixing subgroup's cell sits — and that does not
 * survive being shrunk to a card. One at a time, big, with the row above
 * saying what else is there.
 *
 * Plates paint on first activation rather than on scroll: a pane that has
 * never been opened has never cost anything, which matters when the page
 * holds 269 of them. */
const host = document.getElementById("catalogue");

function buildPlateTabs(section, list) {
  const bar = document.createElement("div");
  bar.className = "tabbar";
  const box = document.createElement("div");
  const panes = [];

  list.forEach((g, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tabbtn sym";
    btn.dataset.gid = g.id;
    btn.innerHTML = labelHtml(g);

    const pane = document.createElement("div");
    pane.className = "tabpane";
    pane.id = g.id;
    pane.dataset.gid = g.id;
    const cv = document.createElement("canvas");
    cv.dataset.gid = g.id;
    const cap = document.createElement("div");
    cap.className = "caption";
    cap.innerHTML =
      `<div>${labelHtml(g)} <span class="tags">${tagsHtml(g)}</span></div>` +
      `<div style="font-size:0.88rem;">${pairHtml(g)}</div>` +
      `<div style="font-size:0.85rem; color:var(--muted);">${linksHtml(g)}</div>`;
    pane.append(cv, cap);
    pane._paint = () => {
      if (painted.has(cv)) return;
      painted.add(cv);
      try { paintColoredCrystal(cv, g.render); }
      catch (err) { console.error("paint failed for", g.id, err); }
    };

    btn.addEventListener("click", () => activate(i));
    bar.append(btn);
    box.append(pane);
    panes.push({ btn, pane, g });
  });

  function activate(k) {
    panes.forEach(({ btn, pane }, i) => {
      btn.classList.toggle("active", i === k);
      pane.classList.toggle("active", i === k);
    });
    panes[k].pane._paint();
  }
  section._activate = activate;
  section._panes = panes;
  // open on the first colouring the filters admit
  section._openFirst = () => {
    const i = panes.findIndex(({ btn }) => btn.style.display !== "none");
    if (i >= 0) activate(i);
  };
  section.append(bar, box);
  activate(0);
}

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
    block.className = "tabdemo";
    const orb = list[0].base.orb;
    const head = document.createElement("h3");
    head.id = `k${k}-${hm}`;
    head.innerHTML =
      `over <span class="sym">${orb}</span> · ` +
      `<a href="crystals-2d.html#${hm}">${hm}</a>` +
      `<span style="color:var(--muted); font-weight:normal;"> — ` +
      `${list.length} colouring${list.length > 1 ? "s" : ""}</span>`;
    block.appendChild(head);
    host.appendChild(block);          // attach before measuring the canvas
    buildPlateTabs(block, list);
  }
}
applyFilters();

/* a colouring linked to directly (#gid) opens its own tab */
function openHash() {
  const id = location.hash.slice(1);
  if (!id) return;
  const pane = document.getElementById(id);
  if (!pane || !pane.dataset.gid) return;
  const section = pane.closest("[data-block]");
  const i = section._panes.findIndex(x => x.g.id === id);
  if (i >= 0) { section._activate(i); section.scrollIntoView({ block: "start" }); }
}
window.addEventListener("hashchange", openHash);
openHash();
