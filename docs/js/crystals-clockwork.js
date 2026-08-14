/* Catalogue C driver: the 68 clockwork (forward) crystals, one section per
 * wallpaper base, with lazily painted static phase-coloured plates and
 * crosslinks into catalogues A (parent and kernel), B (space-group lift),
 * D (the colouring) and the companion-site atlas. */
"use strict";
import { paintColored } from "./colored.js?v=45";

const ORDER17 = [
  ["p1", "◦"], ["p2", "2222"], ["pm", "**"], ["pg", "××"], ["cm", "*×"],
  ["pmm", "*2222"], ["pmg", "22*"], ["pgg", "22×"], ["cmm", "2*22"],
  ["p4", "442"], ["p4m", "*442"], ["p4g", "4*2"],
  ["p3", "333"], ["p3m1", "*333"], ["p31m", "3*3"],
  ["p6", "632"], ["p6m", "*632"],
];

const [catalog, corr, colored, lifts] = await Promise.all([
  "data/catalog.json", "data/xu-correspondence.json",
  "data/colored.json", "data/clockwork-lifts.json",
].map(async u => (await fetch(u, { cache: "no-cache" })).json()));

const sigOf = id => corr.groups[id] || null;
const liftOf = id => lifts.groups[id] || null;

/* reverse the coloured catalogue's clockwork lists: gid -> coloured id */
const colouringOf = new Map();
for (const c of colored.groups) {
  for (const gid of c.clockwork || []) colouringOf.set(gid, c.id);
}

const forward = catalog.groups.filter(g => g.forward);
const inSection = hm => forward
  .filter(g => g.base === hm)
  .sort((a, b) => (b.product - a.product) ||
                  (+a.id.slice(1) - +b.id.slice(1)));

function line1(g) {
  const s = sigOf(g.id);
  const lead = s ? s.signatureHtml : g.symbolHtml;
  const tags = [`<span class="tag">C<sub>${s ? s.clockOrder : "?"}</sub></span>`];
  if (g.product) tags.push(`<span class="tag">trivial clock</span>`);
  return `<span class="sym">${lead}</span> ` +
         `<span class="tags">${tags.join(" ")}</span>`;
}

function line2(g) {
  const s = sigOf(g.id);
  if (!s) return "";
  return `<span class="sym">${s.parentOrbifold}</span> ` +
         `(<a href="crystals-2d.html#${s.parentHm}">${s.parentHm}</a>)` +
         ` / <span class="sym">${s.kernelOrbifold}</span> ` +
         `(<a href="crystals-2d.html#${s.kernelHm}">${s.kernelHm}</a>)`;
}

function line3(g) {
  const s = sigOf(g.id);
  const lift = liftOf(g.id);
  const parts = [`<a href="group.html?g=${g.id}">live</a>`];
  const cid = colouringOf.get(g.id);
  if (cid) {
    parts.push(`<a href="crystals-colored.html#${cid}">colouring ` +
               `<span class="mono">${cid}</span></a>`);
  } else {
    parts.push(`1-colouring — <a href="crystals-2d.html#${g.base}">catalogue A</a>`);
  }
  if (lift) {
    parts.push(`<a href="crystals-3d.html#sg-${lift.sg}">lift ${lift.sgName}</a>`);
  }
  if (lift && lift.mate) {
    parts.push(`<a href="#${lift.mate}">reverse clock ` +
               `${lift.mate.replace("g", "xu")}</a>`);
  }
  if (s && s.correspondenceUrl) {
    parts.push(`<a href="${s.correspondenceUrl}">atlas</a>`);
  }
  return parts.join(" · ");
}

/* lazy painter: static coloured plates, painted on approach */
const painted = new WeakSet();
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting || painted.has(e.target)) continue;
    painted.add(e.target);
    const g = forward.find(x => x.id === e.target.dataset.gid);
    try { paintColored(e.target, g.render, "phase"); }
    catch (err) { console.error("paint failed for", g.id, err); }
  }
}, { rootMargin: "300px" });

/* TOC */
const toc = document.getElementById("toc");
toc.innerHTML = ORDER17.map(([hm, orb]) => {
  const n = inSection(hm).length;
  return n ? `<a class="chip" href="#over-${hm}">${orb} ${hm} · ${n}</a>` : "";
}).join("");

/* the catalogue: one section per wallpaper base */
const host = document.getElementById("cat");
for (const [hm, orb] of ORDER17) {
  const list = inSection(hm);
  if (!list.length) continue;
  const h2 = document.createElement("h2");
  h2.id = `over-${hm}`;
  h2.innerHTML = `over <span class="sym">${orb}</span> · ` +
    `<a href="crystals-2d.html#${hm}">${hm}</a>` +
    `<span style="color:var(--muted); font-weight:normal;"> — ` +
    `${list.length} clockwork group${list.length > 1 ? "s" : ""}</span>`;
  host.appendChild(h2);
  const grid = document.createElement("div");
  grid.className = "cardgrid";
  for (const g of list) {
    const card = document.createElement("div");
    card.className = "gcard";
    card.id = g.id;
    const cv = document.createElement("canvas");
    cv.dataset.gid = g.id;
    card.appendChild(cv);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML =
      `<div>${line1(g)}</div>` +
      `<div style="font-size:0.88rem;">${line2(g)}</div>` +
      `<div style="font-size:0.85rem; color:var(--muted);">${line3(g)}</div>`;
    card.appendChild(meta);
    grid.appendChild(card);
    io.observe(cv);
  }
  host.appendChild(grid);
}
