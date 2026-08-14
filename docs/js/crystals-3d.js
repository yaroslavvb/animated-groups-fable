/* Catalogue B driver: the 230 space groups, from data/spacegroups.json.
 *
 * Builds the system-by-crystal-class catalogue with lazily loaded structure
 * images hot-linked from crystalsymmetry.wordpress.com/230-2, and badges
 * crosslinking the enantiomorphic partner (⇄), the wallpaper stack
 * (catalogue A) and the clockwork lifts (catalogue C). Card ids sg-1..sg-230
 * are the suite's anchor scheme for space groups. */
"use strict";

const data = await (await fetch("data/spacegroups.json", { cache: "no-cache" })).json();

const SYSTEMS = ["triclinic", "monoclinic", "orthorhombic", "tetragonal",
                 "trigonal", "hexagonal", "cubic"];

/* live counts in the prose */
const counts = {
  total: data.meta.total,
  stacks: data.groups.filter(g => g.stackOf).length,
  lifts: data.groups.reduce((n, g) => n + g.lifts.length, 0),
};
for (const el of document.querySelectorAll("[data-count]")) {
  const v = counts[el.dataset.count];
  if (v !== null && v !== undefined) el.textContent = v;
}

const esc = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Digits directly after an element letter or a closing bracket are
 * stoichiometric subscripts: Cu3(AsO4)(OH)3 → Cu₃(AsO₄)(OH)₃. */
const formulaHtml = f =>
  esc(f).replace(/([A-Za-z)\]])(\d+)/g, "$1<sub>$2</sub>");

function badgesHtml(g) {
  const parts = [];
  if (g.enantiomorph) {
    parts.push(`<a href="#sg-${g.enantiomorph}">sg-${g.enantiomorph} ⇄</a>`);
  }
  if (g.stackOf) {
    parts.push(`<a href="crystals-2d.html#${g.stackOf}">stack of ${g.stackOf}</a>`);
  }
  for (const id of g.lifts) {
    parts.push(`<a href="crystals-clockwork.html#${id}">⏱ ${id.replace("g", "xu")}</a>`);
  }
  return parts.join(" · ");
}

function cardEl(g) {
  const card = document.createElement("div");
  card.className = "gcard";
  card.id = `sg-${g.number}`;

  const link = document.createElement("a");
  link.href = g.image;                      /* the full-size original */
  const img = document.createElement("img");
  img.loading = "lazy";
  img.src = g.image;
  img.alt = `${g.example} — space group ${g.hm} (No. ${g.number})`;
  img.style.cssText =
    "width:100%;height:210px;object-fit:contain;background:#fff;display:block;";
  img.addEventListener("error", () => { link.style.display = "none"; });
  link.appendChild(img);
  card.appendChild(link);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.style.cursor = "default";            /* no detail modal on this page */
  const example = esc(g.example) +
    (g.formula
      ? ` <span style="color:var(--muted);">·</span> ${formulaHtml(g.formula)}`
      : "");
  const badges = badgesHtml(g);
  meta.innerHTML =
    `<div><span class="sym">${g.number} · ${esc(g.hm)}</span></div>` +
    `<div style="font-size:0.88rem;">${example}</div>` +
    (badges
      ? `<div style="font-size:0.85rem; color:var(--muted); margin-top:0.25rem;">${badges}</div>`
      : "");
  card.appendChild(meta);
  return card;
}

const host = document.getElementById("cat");
const cap = s => s[0].toUpperCase() + s.slice(1);

/* system TOC */
const toc = document.createElement("div");
toc.className = "toc";
toc.innerHTML = SYSTEMS.map(s => {
  const n = data.groups.filter(g => g.system === s).length;
  return `<a class="chip" href="#sys-${s}">${s} <span class="n">${n}</span></a>`;
}).join("");
host.appendChild(toc);

for (const s of SYSTEMS) {
  const list = data.groups.filter(g => g.system === s);
  if (!list.length) continue;
  const h2 = document.createElement("h2");
  h2.id = `sys-${s}`;
  const lo = list[0].number, hi = list[list.length - 1].number;
  h2.innerHTML = `${cap(s)} <span style="color:var(--muted); font-weight:normal;">` +
    `— ${list.length} groups, Nos. ${lo}–${hi}</span>`;
  host.appendChild(h2);

  /* crystal classes, in numbering order (each class is a contiguous run) */
  const classes = [];
  for (const g of list) {
    if (!classes.length || classes[classes.length - 1] !== g.pointGroup) {
      classes.push(g.pointGroup);
    }
  }
  for (const pg of classes) {
    const sub = list.filter(g => g.pointGroup === pg);
    const h3 = document.createElement("h3");
    h3.innerHTML = `crystal class <span class="sym">${esc(pg)}</span> ` +
      `<span style="color:var(--muted); font-weight:normal;">— ${sub.length} ` +
      `group${sub.length > 1 ? "s" : ""}</span>`;
    host.appendChild(h3);
    const grid = document.createElement("div");
    grid.className = "cardgrid";
    for (const g of sub) grid.appendChild(cardEl(g));
    host.appendChild(grid);
  }
}
