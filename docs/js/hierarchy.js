/* The hierarchy page: every table on it is built from data/hierarchy.json,
 * which enumerate/hierarchy.py regenerates from the catalog and whose two
 * headline theorems it asserts. Nothing here hard-codes a count — if the
 * enumeration changes, the prose keeps its numbers or the page breaks
 * loudly, which is the intended failure mode.
 *
 * The two live widgets reuse the atlas tab component, so an animation on
 * this page behaves exactly like one anywhere else on the site.
 */
"use strict";
import { buildTabs } from "./tabs.js?v=42";
import { leadHtml, signatureOf } from "./catalog-names.js?v=42";

const H = await (await fetch("data/hierarchy.json", { cache: "no-cache" })).json();
const CATALOG = await (await fetch("data/catalog.json", { cache: "no-cache" })).json();
const BY_ID = new Map(CATALOG.groups.map(g => [g.id, g]));

const sum = xs => xs.reduce((a, b) => a + b, 0);
const COLOURS = sum(H.colourCensus.map(r => r.wieting));
const CYCLIC = sum(H.colourCensus.map(r => r.cyclic));

/* ---------- tables ---------- */

/* opts.left — column indices holding prose rather than counts, which the
 * shared .counts rule would otherwise right-align. opts.total — the last row
 * is a sum and gets a rule above it. */
function table(id, head, rows, opts = {}) {
  const host = document.getElementById(id);
  if (!host) return;
  const left = new Set(opts.left || []);
  const cls = i => left.has(i) ? ' class="txt"' : "";
  const last = rows.length - 1;
  const wrap = document.createElement("div");
  wrap.className = "tablewrap";
  wrap.innerHTML =
    `<table class="counts">` +
    `<thead><tr>${head.map((h, i) => `<th${cls(i)}>${h}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((r, j) => {
      // a row is either a plain array of cells or {cells, cls}
      const cells = Array.isArray(r) ? r : r.cells;
      const rowCls = [opts.total && j === last ? "total" : "",
                      Array.isArray(r) ? "" : (r.cls || "")].filter(Boolean).join(" ");
      return `<tr${rowCls ? ` class="${rowCls}"` : ""}>` +
        cells.map((c, i) => `<td${cls(i)}>${c}</td>`).join("") + `</tr>`;
    }).join("")}</tbody>` +
    `</table>` + (opts.note ? `<p class="hint">${opts.note}</p>` : "");
  host.append(wrap);
}

const b = s => `<b>${s}</b>`;
const sym = s => `<span class="sym">${s}</span>`;
const ditto = `<span style="color:var(--muted);">as above</span>`;

/* §1 — the six classifications, with the two refinements marked as such */
table("six-table",
  ["classification", "an object is", "count", "same when"],
  [
    ["wallpaper groups", "a plane pattern", b(H.headline.wallpaper),
     "an affine map of the plane carries one to the other"],
    ["coloured wallpaper groups, N&nbsp;≤&nbsp;6", "a plane pattern in N colours",
     b(COLOURS), "…the same, colours permuted freely"],
    ["&emsp;…with a regular cyclic colour group",
     "a plane pattern whose N colours form C<sub>N</sub>", b(CYCLIC), ditto],
    ["spacetime groups, 2+1D", "an animation that loops and tiles",
     b(H.headline.spacetimeGroups),
     "a change of frame, up to re-basing the spacetime lattice"],
    ["&emsp;…clockwork groups", "one that never runs backwards",
     b(H.headline.clockwork), ditto],
    ["space groups", "a 3D crystal", b(H.headline.spaceGroups),
     "an orientation-preserving affine map of space"],
    ["&emsp;…polar space groups", "a crystal with a polar axis",
     b(H.headline.polar), ditto],
  ],
  { left: [0, 1, 3],
    note: `Indented rows are subsets of the row above. ` +
    `${COLOURS} = ${H.colourCensus.map(r => r.wieting).join(" + ")} over ` +
    `N&nbsp;=&nbsp;1…6; ${CYCLIC} = ` +
    `${H.colourCensus.map(r => r.cyclic).join(" + ")}.` });

/* §2 — what each planar operation becomes once phase is read as height */
table("lift-table",
  ["in the plane", "its clock", "in 3-space, phase read as height"],
  [
    ["translation", "τ&nbsp;=&nbsp;0", "translation"],
    ["lattice translation", "τ&nbsp;=&nbsp;1/2 or 1/3", "a centring of the cell"],
    ["rotation by 2π/n", "τ&nbsp;=&nbsp;k/n", "n<sub>k</sub> screw axis along c"],
    ["reflection", "τ&nbsp;=&nbsp;0", "mirror plane containing c"],
    ["reflection", "τ&nbsp;=&nbsp;1/2", "glide plane, glide vector c/2"],
    ["identity", "reverses time", "mirror plane perpendicular to c"],
    ["reflection", "reverses time", "2-fold rotation about an axis ⊥ c"],
    ["half-turn", "reverses time", "inversion centre"],
    ["rotation by 2π/n", "reverses time", "rotoinversion about c"],
  ],
  { left: [0, 1, 2],
    note: "The first five rows keep the direction of the c-axis and are the " +
    "clockwork case; the last four turn it round." });

/* §3 — the colour census */
table("colour-table",
  ["colours N", "all N-colour plane groups", "colour group C<sub>N</sub>, regular",
   "clockwork groups"],
  H.colourCensus.map(r => [b(r.n), r.wieting, r.cyclic, r.clockwork])
    .concat([[b("Σ"), b(COLOURS), b(CYCLIC), b(H.headline.clockwork)]]),
  { total: true,
    note: "Column 1: Wieting 1982, Table 11. Column 2: the Senechal–Wieting " +
    "count of normal subgroups of index N with cyclic quotient, up to " +
    "plane-affine equivalence. Column 3: this catalog. " +
    "<b>The three columns use different equivalences</b>" +
    "; the totals are not comparable. See §8." });

/* §4 — the image of the clock in Isom(S¹) */
table("phase-table",
  ["order N of the clock", ...H.phaseImage.map(r => b(r.n)), "Σ"],
  [
    ["C<sub>N</sub> — never reverses time (clockwork)",
     ...H.phaseImage.map(r => r.cyclic), b(H.headline.clockwork)],
    ["D<sub>N</sub> — reverses time",
     ...H.phaseImage.map(r => r.dihedral),
     b(H.headline.spacetimeGroups - H.headline.clockwork)],
  ],
  { left: [0],
    note: "N&nbsp;=&nbsp;5 is absent from both rows, and so is every " +
    "N&nbsp;&gt;&nbsp;6: the crystallographic restriction applies to the " +
    "clock as much as to the rotations." });

/* §5 — the colouring of the projection that each spacetime group induces, and the
 * pure-reversal groups against the magnetic plane groups */
{
  const K = new Map(H.colouringKinds.map(k => [k.key, k]));
  table("kinds-table",
    ["image of Φ", "descends to Γ?", "colour group induced on Γ", "the colour is",
     "spacetime groups"],
    H.colouringKinds.map(k => [
      `<span class="sym">${k.image}</span>`,
      k.descends ? "yes" : "<b>no</b>", k.colourGroup, k.colour, b(k.count)])
      .concat([[b("Σ"), "", "", "", b(H.headline.spacetimeGroups)]]),
    { total: true, left: [0, 1, 2, 3],
      note: "Row 4 is the case Φ does not descend: G contains a pure time " +
        "reversal, so an element acting trivially on space acts non-trivially " +
        "on the loop. Rows 1 and 2 both give a regular cyclic colour group, " +
        `${K.get("cyclic").count} + ${K.get("antisymmetry").count} = ` +
        `${H.regularCyclicTotal} groups in all.` });
  for (const el of document.querySelectorAll("[data-kind]"))
    el.textContent = el.dataset.kind === "regular"
      ? H.regularCyclicTotal : K.get(el.dataset.kind).count;

  const p = H.pureReversal;
  table("pure-table",
    ["orbifold", "HM", "N&nbsp;=&nbsp;1", "N&nbsp;=&nbsp;2", "Σ"],
    p.byBase.map(r => [sym(r.orbifold), r.hm, r.spacetime[0], r.spacetime[1] ||
        "<span style='color:var(--rule);'>·</span>", r.spacetime[0] + r.spacetime[1]])
      .concat([[b("Σ"), "", b(p.byClock["1"]), b(p.byClock["2"]), b(p.count)]]),
    { total: true, left: [0, 1],
      note: "Spacetime groups with a pure time reversal, by spatial projection. " +
        "Each entry equals the Senechal–Wieting count of cyclic subgroups of " +
        "that index — column 2 of §3 restricted to N&nbsp;≤&nbsp;2 — so the " +
        "table is simultaneously the census of the 17 grey and 46 " +
        "black-white plane groups." });
}

/* §6 — the fibres of "forget which axis is time" */
{
  const sizes = Object.keys(H.fibres.sizeCounts).sort();
  table("fibre-table",
    ["3D crystal system", "space-group types", "spacetime groups",
     ...sizes.map(s => `fibres of ${s}`)],
    H.fibres.bySystem.map(r =>
      [r.system, r.types, r.spacetimeGroups,
       ...sizes.map(s => r.sizes[s] || "<span style='color:var(--rule);'>·</span>")])
      .concat([[b("Σ"), b(H.fibres.types), b(H.headline.spacetimeGroups),
                ...sizes.map(s => b(H.fibres.sizeCounts[s]))]]),
    { total: true, left: [0],
      note: "A fibre of size k is one space-group type sliced by k inequivalent animations." });
  for (const el of document.querySelectorAll("[data-fib]"))
    el.textContent = H.fibres.sizeCounts[el.dataset.fib];
}

/* §7 — the 68 clockwork groups against the 68 polar space groups */
{
  /* The lead name here is the book colour signature, and four of them occur
   * twice: the enantiomorphic pairs, which are one colouring and two groups.
   * Those eight rows are marked so the table shows §8's splits directly, and
   * the clockwork symbol travels alongside as the thing that separates them. */
  const lead = r => sym(leadHtml(r));
  const seen = new Map();
  for (const r of H.polarTable) {
    const k = lead(r);
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const rows = H.polarTable.map(r => {
    const alt = r.symbolHtml && sym(r.symbolHtml) !== lead(r)
      ? ` <span class="sym" style="color:var(--muted);font-size:0.9em;">${r.symbolHtml}</span>`
      : "";
    return {
      cls: seen.get(lead(r)) > 1 ? "pair" : "",
      cells: [
        `<a href="group.html?g=${r.id}">${lead(r)}</a>${alt}`,
        sym(H.byOrbifold.find(o => o.hm === r.base).orbifold) +
          ` <span style="color:var(--muted);">${r.base}</span>`,
        r.clock === 1 ? "<span style='color:var(--muted);'>1</span>" : r.clock,
        r.it, `<span class="mono">${r.hm.replace(/_(\d)/g, "<sub>$1</sub>")}</span>`,
        r.pointGroup, r.system,
      ],
    };
  });
  const paired = rows.filter(r => r.cls).length;
  table("polar-table",
    ["colour signature <span style='font-weight:normal;color:var(--muted);'>· " +
       "clockwork symbol</span>", "projects to", "colours", "IT&nbsp;no.",
     "Hermann–Mauguin", "class", "system"], rows,
    { left: [0, 1, 6],
      note: `All ${H.polarTable.length} rows, ordered by International Tables ` +
      `number; the “colours” column is the order of the clock. Every polar ` +
      `type occurs exactly once. The ${paired} shaded rows are the ` +
      `${paired / 2} pairs whose colour signature occurs twice — one ` +
      `colouring, two spacetime groups, separated only by the clockwork ` +
      `symbol beside it (<a href="#splits">§8</a>).` });

  // the pair names §7 quotes inline
  const pairNames = H.enantiomorphicPairs.map(([x, y]) => {
    const f = n => H.polarTable.find(r => r.it === n).hm.replace(/_(\d)/g, "<sub>$1</sub>");
    return `${f(x)}/${f(y)}`;
  });
  document.getElementById("enant").innerHTML = pairNames.join(", ");
}

/* §8 — cyclic colourings against spacetime groups, one wallpaper group per row */
{
  const N = H.meta.maxColours;
  const dot = "<span style='color:var(--rule);'>·</span>";
  const cell = (c, f) => !c && !f ? dot
    : c === f ? `${c}` : `<span style="color:var(--accent2);">${c}→${f}</span>`;
  table("orb-table",
    ["orbifold", "HM", ...Array.from({ length: N }, (_, i) => `C<sub>${i + 1}</sub>`),
     "Σ colourings", "Σ groups", "Δ"],
    H.byOrbifold.map(r => {
      const d = r.spacetimeTotal - r.cyclicTotal;
      return [sym(r.orbifold), r.hm,
        ...r.cyclic.map((c, i) => cell(c, r.spacetime[i])),
        r.cyclicTotal, r.spacetimeTotal,
        d === 0 ? "" : `<b style="color:var(--accent2);">${d > 0 ? "+" : ""}${d}</b>`];
    }).concat([[b("Σ"), "",
      ...Array.from({ length: N }, (_, i) => b(cell(
        sum(H.byOrbifold.map(r => r.cyclic[i])),
        sum(H.byOrbifold.map(r => r.spacetime[i]))))),
      b(CYCLIC), b(H.headline.clockwork),
      b(H.headline.clockwork - CYCLIC)]]),
    { total: true, left: [0, 1],
      note: "Each cell is <i>cyclic colourings → spacetime groups</i> for that " +
      "wallpaper group and clock order, marked where they differ. The four " +
      "rotation-free rows collapse; p3, p4 and p6 split." });

  document.getElementById("rf-cyclic").textContent = H.rotationFree.cyclic;
  document.getElementById("rf-spacetime").textContent = H.rotationFree.spacetime;
}

/* ---------- live widgets ---------- */

/* the five clocks that exist, in order, the trivial one last */
{
  const picks = [
    ["g6", "C<sub>2</sub>: every 2-centre advances the animation by half a " +
      "period, so its two copies are opposite in phase. Lifts to " +
      "P2<sub>1</sub>."],
    ["g226", "C<sub>3</sub>: a third of a period per 120° turn. Lifts to " +
      "P3<sub>1</sub>; the opposite sense gives P3<sub>2</sub>, its mirror " +
      "image and a distinct animation."],
    ["g96", "C<sub>4</sub>: a quarter of a period per 90° turn. Lifts to " +
      "P4<sub>1</sub>."],
    ["g235", "C<sub>6</sub>: a time glide and a time centring together " +
      "generate six phases. Lifts to R3c."],
    ["g1", "C<sub>1</sub>: no clock. The 17 such animations are the 17 wallpaper " +
      "groups with an independent loop."],
  ];
  const host = document.createElement("div");
  host.className = "tabdemo big";
  document.getElementById("clocks").append(host);
  buildTabs(host, picks.map(([id, note]) => ({ g: BY_ID.get(id), sym: id, note })));
}

/* one space-group type, several inequivalent animations */
{
  const ex = H.fibreExample;
  const hm = ex.hm.replace(/_(\d)/g, "<sub>$1</sub>");
  document.getElementById("fibre-name").innerHTML =
    `<span class="mono">${hm}</span> (No.&nbsp;${ex.it})`;
  const host = document.createElement("div");
  host.className = "tabdemo big";
  document.getElementById("fibre-demo").append(host);
  // split:true draws two runs, and expects the forward one first — the fibre
  // arrives in catalog order, which is not that
  const members = [...ex.members].sort((a, c) => Number(c.forward) - Number(a.forward));
  buildTabs(host, members.map(m => ({
    g: BY_ID.get(m.id), sym: m.symbol,
    note: `Projects to ${m.base}; ${m.forward
      ? "no time reversal, so this is the clockwork member of the fibre"
      : "reverses time — the mirror perpendicular to c in the crystal is a " +
        "palindrome in the animation"}. As a crystal it is ` +
      `<span class="mono">${hm}</span>, as in the other tabs.`,
  })), { split: true });
}

/* §8 — what a change of frame can remove, and the losses it accounts for */
{
  const c = H.coinvariants;
  table("coinv-table",
    ["orbifold", "HM", "|P|", "L<sub>P</sub>", "free rank",
     "colourings", "spacetime groups"],
    c.map(r => [sym(r.orbifold), r.hm, r.order,
      `<span class="sym">${r.module}</span>`,
      r.freeRank ? b(r.freeRank) : "<span style='color:var(--rule);'>0</span>",
      r.cyclic, r.spacetime]),
    { left: [0, 1, 3],
      note: "The coinvariants L<sub>P</sub> of the translation lattice under " +
        "the point group. Free rank is the whole obstruction: it is non-zero " +
        "for exactly the four groups whose point group has no rotation, and " +
        "those are exactly the rows where the colouring count exceeds the " +
        "spacetime-group count." });

  const lost = H.lostByColour;
  table("lost-table",
    ["colours N", ...lost.map(r => b(r.n)), "Σ"],
    [["cyclic colourings of p1, pm, pg, cm", ...lost.map(r => r.cyclic),
      b(sum(lost.map(r => r.cyclic)))],
     ["spacetime groups they realise", ...lost.map(r => r.spacetime),
      b(sum(lost.map(r => r.spacetime)))]],
    { left: [0],
      note: "Every loss in the whole census sits in this table. The five " +
        "survivors are P1, Pm, Pc, Cm and Cc — the triclinic and " +
        "R-monoclinic clockwork groups." });
}

/* §8 splits — one base worked through: every colouring of p3 against every
 * clockwork group over it. The colour type comes from the correspondence
 * tables, which is the point: two of the four rows carry the same one. */
{
  const e = H.splitExample;
  const type = id => {
    const s = signatureOf(id);
    return s ? `<span class="sym">${s.tos}</span>` : "—";
  };
  // group the clockwork groups by the colouring they realise
  const byType = new Map();
  for (const g of e.groups) {
    const key = (signatureOf(g.id) || {}).tos || g.id;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push(g);
  }
  const rows = [...byType.entries()].map(([, gs]) => [
    gs[0].clock === 1 ? "<span style='color:var(--muted);'>1</span>" : gs[0].clock,
    type(gs[0].id),
    gs.map(g => `<a href="group.html?g=${g.id}">${sym(g.symbolHtml)}</a>` +
      ` <span class="mono">${g.hm.replace(/_(\d)/g, "<sub>$1</sub>")}</span>`)
      .join(gs.length > 1 ? " <b style='color:var(--accent2);'>and</b> " : ""),
    gs.length > 1 ? b(gs.length) : gs.length,
  ]);
  table("split-table",
    ["colours", "the colouring", "clockwork groups realising it", "how many"],
    rows.concat([[b("Σ"), b(`${e.cyclicTotal} colourings`), "",
                  b(`${e.spacetimeTotal} groups`)]]),
    { total: true, left: [1, 2],
      note: `Every cyclic colouring of <span class="sym">${e.orbifold}</span> ` +
        `= ${e.hm}, and every clockwork group whose spatial projection it is. ` +
        `Three colourings, four groups: one row is realised twice.` });

  const host = document.createElement("div");
  host.className = "tabdemo big";
  document.getElementById("split-demo").append(host);
  const text = g => g.clock === 1
    ? "The uncoloured case: every copy in phase, the wallpaper with an independent loop."
    : g.it === 146
      ? "One colouring, one group. This one carries a 3<sub>1</sub> and a " +
        "3<sub>2</sub> axis at once, so its mirror image is itself."
      : `Every 3-centre advances the loop by ${g.symbol.includes("3\u2081")
          ? "a third" : "two thirds"} of a period. Reflect the plane and you ` +
        "get the other tab — which is why the two share a colouring and not a group.";
  /* the static plate beside the animation: the same pattern with the phases
   * frozen as colours, so "one colouring, two groups" can be seen rather than
   * asserted. Plates are from the companion correspondence atlas. */
  const plate = g =>
    // no loading="lazy": an inactive tab pane is display:none, so a lazy image
    // inside one never intersects the viewport and is never fetched at all
    `<img src="img/colourings/${g.id}.webp" width="720" height="420"` +
    ` alt="Static perfect ${g.clock}-colouring of the plane for ${g.symbol}"` +
    ` style="width:min(100%,290px);height:auto;border:1px solid var(--rule);` +
    `border-radius:4px;display:block;">`;
  buildTabs(host, e.groups.map(g => ({
    g: BY_ID.get(g.id), sym: g.symbol,
    note: `<span style="display:flex;gap:0.9rem;align-items:flex-start;flex-wrap:wrap;">` +
      plate(g) + `<span style="flex:1;min-width:13rem;">${text(g)}</span></span>`,
  })));
}

/* ---------- the summary diagram, which opens the page ---------- */

document.getElementById("diagram").innerHTML = diagram();

/* Three lanes — the plane, spacetime, space — three rows each. Every lane
 * reads downwards as a containment; the arrows across are the two maps of §6
 * and §7 plus the colour reading of §3. The middle row of the outer lanes is
 * deliberately empty so that the bijection lands on one horizontal line. */
function diagram() {
  const L = [95, 380, 665];              // lane centres
  const ROW = [50, 146, 242];            // box tops
  const W = 80, HGT = 56;                // half-width, height
  const box = (x, y, n, lines, accent) => `
    <rect x="${x - W}" y="${y}" width="${2 * W}" height="${HGT}" rx="6"
      fill="var(--panel)" stroke="${accent ? "var(--accent)" : "var(--rule)"}"
      stroke-width="${accent ? 2 : 1}"/>
    <text x="${x}" y="${y + 21}" text-anchor="middle" font-size="18"
      font-weight="700" fill="${accent ? "var(--accent)" : "var(--ink)"}">${n}</text>
    ${lines.map((t, i) => `<text x="${x}" y="${y + 36 + i * 13}" text-anchor="middle"
      font-size="11" fill="var(--muted)">${t}</text>`).join("")}`;
  const contain = (x, y1, y2, label) => `
    <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="var(--rule)"
      stroke-width="1.5"/>
    <text x="${x - 7}" y="${(y1 + y2) / 2 + 4}" text-anchor="end" font-size="10.5"
      fill="var(--muted)">${label}</text>
    <text x="${x + 4}" y="${(y1 + y2) / 2 + 5}" font-size="13"
      fill="var(--muted)">⊃</text>`;
  const arrow = (x1, x2, y, label, sub, accent) => `
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"
      stroke="${accent ? "var(--accent)" : "var(--muted)"}"
      stroke-width="${accent ? 2 : 1.3}" marker-end="url(#ah)"
      ${accent ? 'marker-start="url(#ah)"' : ""}/>
    <text x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle" font-size="11"
      fill="${accent ? "var(--accent)" : "var(--ink)"}">${label}</text>
    ${sub ? `<text x="${(x1 + x2) / 2}" y="${y + 16}" text-anchor="middle"
      font-size="10" fill="var(--muted)">${sub}</text>` : ""}`;
  const head = (x, t) => `<text x="${x}" y="32" text-anchor="middle" font-size="11"
      font-weight="600" letter-spacing="0.09em" fill="var(--muted)">${t}</text>`;

  const h = H.headline, mid = (a, c) => (a + c) / 2;
  return `<div class="tablewrap"><svg viewBox="0 0 760 350" width="100%"
    style="max-width:760px;display:block;margin:1rem auto;font-family:system-ui,sans-serif;"
    role="img" aria-label="The three lanes — plane, spacetime, space — and the
    maps between them: phase read as height maps the 275 spacetime groups onto the
    194 non-cubic space-group types, and restricts to a bijection between the
    68 clockwork groups and the 68 polar space groups.">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
      markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>
    ${head(L[0], "IN THE PLANE")}${head(L[1], "IN SPACE-TIME")}${head(L[2], "IN SPACE")}
    ${box(L[0], ROW[0], COLOURS, ["coloured wallpaper groups",
        `N&#160;≤&#160;${H.meta.maxColours} colours`])}
    ${box(L[0], ROW[2], CYCLIC, ["…whose colour group is", "a regular cyclic clock"])}
    ${box(L[1], ROW[0], h.spacetimeGroups, ["spacetime groups", "of 2+1 dimensions"])}
    ${box(L[1], ROW[2], h.clockwork, ["clockwork groups"], true)}
    ${box(L[2], ROW[0], h.spaceGroups, ["space-group types", "of 3 dimensions"])}
    ${box(L[2], ROW[1], h.nonCubic, ["non-cubic", "— Fletcher's count"])}
    ${box(L[2], ROW[2], h.polar, ["polar space groups"], true)}
    ${contain(L[0], ROW[0] + HGT, ROW[2], "cyclic")}
    ${contain(L[1], ROW[0] + HGT, ROW[2], "forward")}
    ${contain(L[2], ROW[0] + HGT, ROW[1], "no cubic")}
    ${contain(L[2], ROW[1] + HGT, ROW[2], "polar")}
    ${arrow(L[1] + W, L[2] - W, ROW[0] + 28, "phase = height",
        `onto all ${h.nonCubic}`)}
    ${arrow(L[1] - W, L[0] + W, ROW[2] + 28, "phase = colour", "−42, +4 (§8)")}
    ${arrow(L[1] + W, L[2] - W, ROW[2] + 28, "bijection", "", true)}
    <text x="${mid(L[0], L[2])}" y="336" text-anchor="middle" font-size="10.5"
      fill="var(--muted)">the ${h.wallpaper} wallpaper groups are the
      N&#160;=&#160;1 case of every column: one colour, a C₁ clock, no time
      structure at all</text>
  </svg></div>`;
}

/* ---------- deep links ----------
 * Every table, both diagrams and both widgets are injected by this module,
 * so the browser's own jump to #splits (or any other anchor) happens while
 * the page is still a few paragraphs long and lands nowhere near the target.
 * Re-apply it once the document has its real height. */
if (location.hash) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) {
    // an explicit instant scrollTo rather than scrollIntoView: the sheet sets
    // scroll-behavior:smooth, and a smooth scroll issued during load is easy
    // for the browser to drop on the floor
    const go = () => window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - 12,
      behavior: "instant",
    });
    go();
    // the plates land last and change the height under us, so do it again
    window.addEventListener("load", go, { once: true });
  }
}

/* ---------- hotlinkable headings ----------
 * Every h2/h3 carries an id; this hangs a "#" on each so the link can be
 * copied without reading the source. */
for (const h of document.querySelectorAll("main h2[id], main h3[id]")) {
  const a = document.createElement("a");
  a.className = "anchor";
  a.href = `#${h.id}`;
  a.textContent = "#";
  a.setAttribute("aria-label", `link to “${h.textContent.trim()}”`);
  h.append(a);
}
