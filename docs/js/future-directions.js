/* Render the generated colour-to-forward-film census.  All mathematical
 * counts live in data/color-forward-census.json; this file only presents
 * them, so the report and downloadable tables cannot drift apart. */
"use strict";

const DATA_URL = "data/color-forward-census.json";

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
      if (index === 0) cell.scope = "row";
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
    return [row.wallpaper_group, ...counts,
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
  const headers = ["wallpaper", ...data.summary.map(row => `N=${row.colours}`), "Σ"];
  replaceWithTable("cyclic-wallpaper-table", makeTable(
    headers, wallpaperRows(data, "regular_cyclic"), {
      caption: "Regular cyclic plane colour groups by wallpaper type",
    }));
  replaceWithTable("film-wallpaper-table", makeTable(
    headers, wallpaperRows(data, "forward_catalog"), {
      caption: "Forward catalog normal forms by wallpaper projection and canonical clock order",
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
