/* The colour-groups page: worked visual examples, then the census.
 *
 * The examples pair a STATIC coloured rendering of a film-group spec (colour
 * = clock data, colored.js) with the LIVE film, so the dictionary "colour =
 * phase" can be read off directly. The census below is generated: every
 * mathematical count lives in data/color-forward-census.json, so the report
 * and the downloadable tables cannot drift apart. */
"use strict";
import { FilmGroupAnimation } from "./renderer.js?v=25";
import { attachControls } from "./controls.js?v=25";
import { attachStage } from "./stage.js?v=25";
import { paintColored } from "./colored.js?v=25";
import { groupCaption } from "./wallpaper-data.js?v=25";

const DATA_URL = "data/color-forward-census.json";

/* ------------------------------------------------------ worked examples */
const PAIRS = [
  { host: "pair-bw", sym: "o/g′", mode: "bw",
    left: "Colour = time sign. Swapping black for white is playing the film \
backwards; here the swap is carried by a half-cell translation, so the \
columns alternate.",
    right: "The film: columns alternately fill and drain." },
  { host: "pair-checker", sym: "c222₁2₁", mode: "phase",
    left: "The unitary two-colouring: hue = phase, and the two phases 0 and \
½ paint the two sublattices of the checkerboard.",
    right: "The film: translating half a cell diagonally equals waiting half \
a period." },
  { host: "pair-z4", sym: "4₁4₁2₁", mode: "phase",
    left: "The perfect C₄-colouring of p4: a quarter turn about any 4-centre \
advances the colour by one.",
    right: "The film: the same quarter turn advances the phase by a quarter \
period." },
  { host: "pair-z6", sym: "6₁3₁2₁", mode: "phase",
    left: "The perfect C₆-colouring of p6: six colours cycling around every \
6-centre, three around every 3-centre, two around every 2-centre.",
    right: "The film: the tutorial's hero, read chromatically." },
];

const anims = new Map();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const anim = anims.get(e.target);
    if (!anim) continue;
    if (e.isIntersecting) { if (!anim.userPaused) anim.start(); }
    else anim.stop();
  }
}, { rootMargin: "80px" });

/* The reversal layer is outside the generated census (which is forward-only),
 * so the two-colour counts quoted in the text are computed here, from the
 * catalog: a group is CLOCKLESS when no forward operation and no centring
 * carries an offset — the reversal offsets are then removable by a shift of
 * the time origin — and those are the film groups that are two-colourings in
 * the Shubnikov sense. Offsets are multiples of 1/12, so the test is exact. */
function fillReversalCounts(cat) {
  const tw = x => ((Math.round(x * 12) % 12) + 12) % 12;
  const clockless = g => g.render.ops.every(op => op.s === -1 || tw(op.tau) === 0);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const order = g => 12 / (g.render.ops.reduce((d, op) => gcd(d, tw(op.tau)), 12) || 12);
  const rev = cat.groups.filter(g => !g.forward && clockless(g));
  const gray = rev.filter(g => g.product).length;
  const n2 = cat.groups.filter(g => g.forward && order(g) === 2).length;
  const put = (k, v) => {
    for (const el of document.querySelectorAll(`[data-cc="${k}"]`)) el.textContent = v;
  };
  put("gray", gray);
  put("proper", rev.length - gray);
  put("n2", n2);
}

async function buildExamples() {
  if (!document.getElementById("pair-bw")) return;
  const cat = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
  fillReversalCounts(cat);
  const bySym = new Map(cat.groups.map(g => [g.symbol, g]));
  for (const p of PAIRS) {
    const host = document.getElementById(p.host);
    const g = bySym.get(p.sym);
    if (!host || !g) { console.error("missing example", p.sym); continue; }
    const mk = (cap) => {
      const demo = document.createElement("div");
      demo.className = "demo";
      const canvas = document.createElement("canvas");
      demo.append(canvas);
      const c = document.createElement("div");
      c.className = "caption";
      c.innerHTML = cap;
      demo.append(c);
      host.append(demo);          // attach before constructing: geometry
      return { demo, canvas, cap: c };
    };
    const L = mk(`<span class="sym">${g.symbolHtml}</span>, coloured — ${p.left}`);
    paintColored(L.canvas, g.render, p.mode);
    const R = mk(groupCaption(g) + `<p style="margin:0.4rem 0 0;">${p.right}</p>`);
    const anim = new FilmGroupAnimation(R.canvas, g.render);
    anims.set(R.canvas, anim);
    observer.observe(R.canvas);
    attachStage(anim, R.canvas);
    attachControls(anim, R.demo, R.cap);
  }
}

function makeTable(headers, rows, options = {}) {
  const table = document.createElement("table");
  table.className = "counts census-table";
  if (options.caption) {
    const caption = document.createElement("caption");
    caption.textContent = options.caption;
    table.append(caption);
  }

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of headers) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headerRow.append(th);
  }
  thead.append(headerRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    row.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) {
        cell.scope = "row";
        if (options.firstColumnClass) {
          cell.className = options.firstColumnClass;
        }
      }
      cell.textContent = value;
      tr.append(cell);
    });
    tbody.append(tr);
  }
  table.append(tbody);
  return table;
}

function replaceWithTable(id, table) {
  const host = document.getElementById(id);
  if (!host) return;
  host.replaceChildren(table);
}

function summaryRow(data, field, label) {
  const values = data.summary.map(row => row[field]);
  return [label, ...values, values.reduce((a, b) => a + b, 0)];
}

function renderSummary(data) {
  const result = document.getElementById("result-clock-orders");
  if (result) {
    result.textContent = data.summary
      .map(row => row.forward_catalog_canonical_clock_order).join(", ");
  }
  const headers = ["census", ...data.summary.map(row => `N=${row.colours}`), "Σ through 6"];
  const rows = [
    summaryRow(data, "wieting_all_transitive",
      "all transitive perfect plane colourings"),
    summaryRow(data, "regular_cyclic_kernels",
      "regular cyclic plane colour groups"),
    summaryRow(data, "forward_catalog_canonical_clock_order",
      "forward catalog normal forms of exact clock order"),
  ];
  replaceWithTable("census-table", makeTable(headers, rows, {
    caption: "Counts for exact colour or canonical clock order N",
  }));
}

function wallpaperRows(data, field) {
  const rows = data.by_wallpaper.map(row => {
    const counts = data.summary.map(summary =>
      row[field][String(summary.colours)]);
    return [row.orbifold, ...counts,
      field === "forward_catalog"
        ? row.forward_total
        : counts.reduce((a, b) => a + b, 0)];
  });
  const totals = data.summary.map(summary => {
    const n = String(summary.colours);
    return data.by_wallpaper.reduce((sum, row) => sum + row[field][n], 0);
  });
  rows.push(["TOTAL", ...totals, totals.reduce((a, b) => a + b, 0)]);
  return rows;
}

function renderWallpaperTables(data) {
  const headers = ["orbifold", ...data.summary.map(row => `N=${row.colours}`), "Σ"];
  replaceWithTable("cyclic-wallpaper-table", makeTable(
    headers, wallpaperRows(data, "regular_cyclic"), {
      caption: "Regular cyclic plane colour groups by Conway orbifold",
      firstColumnClass: "sym",
    }));
  replaceWithTable("film-wallpaper-table", makeTable(
    headers, wallpaperRows(data, "forward_catalog"), {
      caption: "Forward catalog normal forms by spatial orbifold projection and canonical clock order",
      firstColumnClass: "sym",
    }));
}

function renderFingerprint(data) {
  const host = document.getElementById("data-fingerprint");
  if (!host) return;
  const meta = data.meta;
  host.textContent =
    `Generated from ${meta.catalog_total_groups} catalog entries ` +
    `(${meta.catalog_forward_groups} forward); catalog SHA-256 ` +
    `${meta.catalog_sha256}.`;
}

function showError(error) {
  console.error(error);
  for (const id of ["census-table", "cyclic-wallpaper-table",
                    "film-wallpaper-table"]) {
    const host = document.getElementById(id);
    if (!host) continue;
    const p = document.createElement("p");
    p.className = "aside";
    p.textContent = "The generated census could not be loaded. Use the CSV download links below.";
    host.replaceChildren(p);
  }
}

try {
  const response = await fetch(DATA_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${DATA_URL}: HTTP ${response.status}`);
  const data = await response.json();
  renderSummary(data);
  renderWallpaperTables(data);
  renderFingerprint(data);
} catch (error) {
  showError(error);
}

// the examples are independent of the census: a failed census must not take
// the pictures down with it, nor the reverse
try {
  await buildExamples();
} catch (error) {
  console.error(error);
}
