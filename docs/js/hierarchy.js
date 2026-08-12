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
import { buildTabs } from "./tabs.js?v=40";
import { leadHtml } from "./catalog-names.js?v=40";

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
    `<tbody>${rows.map((r, j) =>
      `<tr${opts.total && j === last ? ' class="total"' : ""}>` +
      r.map((c, i) => `<td${cls(i)}>${c}</td>`).join("") + `</tr>`).join("")}</tbody>` +
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
     "a plane pattern whose N colours are a clock", b(CYCLIC), ditto],
    ["space-time (film) groups, 2+1D", "an animation that loops and tiles",
     b(H.headline.filmGroups),
     "a change of frame, up to re-basing the space-time lattice"],
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
    "; the totals are not comparable. See §7." });

/* §4 — the image of the clock in Isom(S¹) */
table("phase-table",
  ["order N of the clock", ...H.phaseImage.map(r => b(r.n)), "Σ"],
  [
    ["C<sub>N</sub> — never reverses time (clockwork)",
     ...H.phaseImage.map(r => r.cyclic), b(H.headline.clockwork)],
    ["D<sub>N</sub> — reverses time",
     ...H.phaseImage.map(r => r.dihedral),
     b(H.headline.filmGroups - H.headline.clockwork)],
  ],
  { left: [0],
    note: "N&nbsp;=&nbsp;5 is absent from both rows, and so is every " +
    "N&nbsp;&gt;&nbsp;6: the crystallographic restriction applies to the " +
    "clock as much as to the rotations." });

/* §5 — the fibres of "forget which axis is time" */
{
  const sizes = Object.keys(H.fibres.sizeCounts).sort();
  table("fibre-table",
    ["3D crystal system", "space-group types", "film groups",
     ...sizes.map(s => `fibres of ${s}`)],
    H.fibres.bySystem.map(r =>
      [r.system, r.types, r.films,
       ...sizes.map(s => r.sizes[s] || "<span style='color:var(--rule);'>·</span>")])
      .concat([[b("Σ"), b(H.fibres.types), b(H.headline.filmGroups),
                ...sizes.map(s => b(H.fibres.sizeCounts[s]))]]),
    { total: true, left: [0],
      note: "A fibre of size k is one space-group type sliced by k inequivalent films." });
  for (const el of document.querySelectorAll("[data-fib]"))
    el.textContent = H.fibres.sizeCounts[el.dataset.fib];
}

/* §6 — the 68 clockwork groups against the 68 polar space groups */
{
  const rows = H.polarTable.map(r => [
    `<a href="group.html?g=${r.id}">${sym(leadHtml(r))}</a>`,
    sym(H.byOrbifold.find(o => o.hm === r.base).orbifold) +
      ` <span style="color:var(--muted);">${r.base}</span>`,
    r.clock === 1 ? "<span style='color:var(--muted);'>1</span>" : r.clock,
    r.it, `<span class="mono">${r.hm.replace(/_(\d)/g, "<sub>$1</sub>")}</span>`,
    r.pointGroup, r.system,
  ]);
  table("polar-table",
    ["clockwork symbol", "projects to", "colours", "IT&nbsp;no.",
     "Hermann–Mauguin", "class", "system"], rows,
    { left: [0, 1, 6],
      note: `All ${H.polarTable.length} rows, ordered by International Tables ` +
      `number; the “colours” column is the order of the clock. ` +
      `Every polar type occurs exactly once.` });

  const pairs = H.enantiomorphicPairs.map(([a, c]) => {
    const f = n => H.polarTable.find(r => r.it === n).hm.replace(/_(\d)/g, "<sub>$1</sub>");
    return `${f(a)}/${f(c)}`;
  });
  document.getElementById("enant").innerHTML = pairs.join(", ");
}

/* §7 — cyclic colourings against film groups, one wallpaper group per row */
{
  const N = H.meta.maxColours;
  const dot = "<span style='color:var(--rule);'>·</span>";
  const cell = (c, f) => !c && !f ? dot
    : c === f ? `${c}` : `<span style="color:var(--accent2);">${c}→${f}</span>`;
  table("orb-table",
    ["orbifold", "HM", ...Array.from({ length: N }, (_, i) => `C<sub>${i + 1}</sub>`),
     "Σ colourings", "Σ films", "Δ"],
    H.byOrbifold.map(r => {
      const d = r.filmTotal - r.cyclicTotal;
      return [sym(r.orbifold), r.hm,
        ...r.cyclic.map((c, i) => cell(c, r.film[i])),
        r.cyclicTotal, r.filmTotal,
        d === 0 ? "" : `<b style="color:var(--accent2);">${d > 0 ? "+" : ""}${d}</b>`];
    }).concat([[b("Σ"), "",
      ...Array.from({ length: N }, (_, i) => b(cell(
        sum(H.byOrbifold.map(r => r.cyclic[i])),
        sum(H.byOrbifold.map(r => r.film[i]))))),
      b(CYCLIC), b(H.headline.clockwork),
      b(H.headline.clockwork - CYCLIC)]]),
    { total: true, left: [0, 1],
      note: "Each cell is <i>cyclic colourings → film groups</i> for that " +
      "wallpaper group and clock order, marked where they differ. The four " +
      "rotation-free rows collapse; p3, p4 and p6 split." });

  document.getElementById("rf-cyclic").textContent = H.rotationFree.cyclic;
  document.getElementById("rf-film").textContent = H.rotationFree.film;
}

/* ---------- live widgets ---------- */

/* the five clocks that exist, in order, the trivial one last */
{
  const picks = [
    ["g6", "C<sub>2</sub>: every 2-centre advances the film by half a " +
      "period, so its two copies are opposite in phase. Lifts to " +
      "P2<sub>1</sub>."],
    ["g226", "C<sub>3</sub>: a third of a period per 120° turn. Lifts to " +
      "P3<sub>1</sub>; the opposite sense gives P3<sub>2</sub>, its mirror " +
      "image and a distinct film."],
    ["g96", "C<sub>4</sub>: a quarter of a period per 90° turn. Lifts to " +
      "P4<sub>1</sub>."],
    ["g235", "C<sub>6</sub>: a time glide and a time centring together " +
      "generate six phases. Lifts to R3c."],
    ["g1", "C<sub>1</sub>: no clock. The 17 such films are the 17 wallpaper " +
      "groups with an independent loop."],
  ];
  const host = document.createElement("div");
  host.className = "tabdemo big";
  document.getElementById("clocks").append(host);
  buildTabs(host, picks.map(([id, note]) => ({ g: BY_ID.get(id), sym: id, note })));
}

/* one space-group type, several inequivalent films */
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
        "palindrome in the film"}. As a crystal it is ` +
      `<span class="mono">${hm}</span>, as in the other tabs.`,
  })), { split: true });
}

/* ---------- the Euler diagram at the top ---------- */

/* Two circles that genuinely are sets of the same kind of thing, nested one
 * ring deep each, and drawn so that the ring inside the left circle meets the
 * ring inside the right one in exactly the clockwork groups.
 *
 * The regions are set differences, with one seam: the left circle counts
 * colourings up to plane-affine equivalence and the right one counts
 * space-group types, so the 101 cyclic colourings and the 68 polar types are
 * the same region measured two ways. The caption names that seam rather than
 * reporting a single number for the region.
 */
document.getElementById("venn").innerHTML = venn();

function venn() {
  const h = H.headline;
  const A = { x: 265, y: 245, r: 175 };          // coloured wallpaper groups
  const Ai = { x: 310, y: 245, r: 125 };         // …with a regular cyclic clock
  const C = { x: 495, y: 245, r: 175 };          // space-group types
  const Ci = { x: 460, y: 245, r: 132 };         // …non-cubic

  // the lens where the two inner circles meet: the clockwork groups
  const d = Ci.x - Ai.x;
  const a = (d * d + Ai.r * Ai.r - Ci.r * Ci.r) / (2 * d);
  const k = Math.sqrt(Ai.r * Ai.r - a * a);
  const px = (Ai.x + a).toFixed(2), top = (Ai.y - k).toFixed(2), bot = (Ai.y + k).toFixed(2);
  const lens = `M ${px} ${top} A ${Ai.r} ${Ai.r} 0 0 1 ${px} ${bot} ` +
               `A ${Ci.r} ${Ci.r} 0 0 1 ${px} ${top} Z`;

  const circle = (c, colour, dash) => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}"
    fill="var(${colour})" fill-opacity="0.09" stroke="var(${colour})"
    stroke-width="1.6" ${dash ? 'stroke-dasharray="5 4"' : ""}/>`;
  const n = (x, y, v, label, colour) => `
    <text x="${x}" y="${y}" text-anchor="middle" font-size="26" font-weight="700"
      fill="var(${colour || "--ink"})">${v}</text>
    ${label.map((t, i) => `<text x="${x}" y="${y + 20 + i * 14}" text-anchor="middle"
      font-size="11.5" fill="var(--muted)">${t}</text>`).join("")}`;

  const ring = (x, y, colour, text) => `<text x="${x}" y="${y}"
    text-anchor="middle" font-size="11.5" fill="var(${colour})">${text}</text>`;

  return `<div class="tablewrap"><svg viewBox="0 0 760 505" width="100%"
    style="max-width:760px;display:block;margin:1.2rem auto 0.4rem;
           font-family:system-ui,sans-serif;" role="img"
    aria-label="Two overlapping circles. The left is the ${COLOURS} coloured
      wallpaper groups with up to six colours, containing the ${CYCLIC} whose
      colour group is a regular cyclic clock. The right is the
      ${h.spaceGroups} space-group types, containing the ${h.nonCubic}
      non-cubic ones that the ${h.filmGroups} film groups realise. The two
      inner circles meet in the ${h.clockwork} clockwork groups, which are
      also the ${h.polar} polar space groups.">
    ${circle(A, "--gold")}${circle(C, "--accent")}
    ${circle(Ai, "--gold", true)}${circle(Ci, "--accent", true)}
    <path d="${lens}" fill="var(--accent2)" fill-opacity="0.17"
      stroke="var(--accent2)" stroke-width="2"/>

    <text x="${A.x}" y="40" text-anchor="middle" font-size="11.5" font-weight="600"
      letter-spacing="0.07em" fill="var(--gold)">COLOURED WALLPAPER GROUPS</text>
    <text x="${A.x}" y="55" text-anchor="middle" font-size="10.5"
      fill="var(--muted)">N&#160;≤&#160;${H.meta.maxColours} colours · ${COLOURS} in all</text>
    <text x="${C.x}" y="40" text-anchor="middle" font-size="11.5" font-weight="600"
      letter-spacing="0.07em" fill="var(--accent)">SPACE-GROUP TYPES</text>
    <text x="${C.x}" y="55" text-anchor="middle" font-size="10.5"
      fill="var(--muted)">of 3 dimensions · ${h.spaceGroups} in all</text>

    ${/* each dashed ring is named inside itself, clear of the lens between them */""}
    ${ring(275, 175, "--gold", `${CYCLIC} cyclic clocks`)}
    ${ring(505, 168, "--accent", `${h.nonCubic} non-cubic`)}
    ${ring(505, 183, "--accent", `all ${h.filmGroups} films land here`)}

    ${n(144, 205, COLOURS - CYCLIC, ["colour group", "is not a clock"])}
    ${n(256, 252, CYCLIC - h.clockwork, ["not a new film", "(§7)"])}
    ${n(381, 236, h.clockwork, ["clockwork", "= polar"], "--accent2")}
    ${n(513, 252, h.nonCubic - h.polar, ["non-polar types",
        `— ${h.filmGroups - h.clockwork} reversing films`])}
    ${n(631, 205, h.cubic, ["cubic types"])}

    <line x1="381" y1="352" x2="381" y2="446" stroke="var(--accent2)"
      stroke-width="1.2"/>
    <text x="381" y="464" text-anchor="middle" font-size="11.5"
      fill="var(--accent2)" font-weight="600">the ${h.clockwork} clockwork groups</text>
    <text x="381" y="480" text-anchor="middle" font-size="11"
      fill="var(--muted)">a colouring, a film and a polar crystal</text>
  </svg>
  <p class="hint" style="margin-top:0;">Regions are set differences:
  ${COLOURS - CYCLIC}&nbsp;+&nbsp;${CYCLIC - h.clockwork}&nbsp;+&nbsp;${h.clockwork}&nbsp;=&nbsp;${COLOURS}
  on the left,
  ${h.cubic}&nbsp;+&nbsp;${h.nonCubic - h.polar}&nbsp;+&nbsp;${h.polar}&nbsp;=&nbsp;${h.spaceGroups}
  on the right. The ${h.cubic} cubic types lie outside both circles: a cubic
  point group fixes no direction, so no axis of such a crystal can be time.
  The circles use different equivalences — colourings up to affine maps of the
  plane, crystals up to space-group type — and the ${CYCLIC - h.clockwork} is
  the gap: ${CYCLIC} regular cyclic colourings, ${h.clockwork} distinct films
  (<a href="#disagree">§7</a>).</p></div>`;
}

/* ---------- the summary diagram at the foot ---------- */

document.getElementById("diagram").innerHTML = diagram();

/* Three lanes — the plane, space-time, space — three rows each. Every lane
 * reads downwards as a containment; the arrows across are the two maps of §5
 * and §6 plus the colour reading of §3. The middle row of the outer lanes is
 * deliberately empty so that the bijection lands on one horizontal line. */
function diagram() {
  const L = [95, 380, 665];              // lane centres
  const ROW = [50, 146, 242];            // box tops
  const W = 90, HGT = 56;                // half-width, height
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
    role="img" aria-label="The three lanes — plane, space-time, space — and the
    maps between them: phase read as height maps the 275 film groups onto the
    194 non-cubic space-group types, and restricts to a bijection between the
    68 clockwork groups and the 68 polar space groups.">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
      markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>
    ${head(L[0], "IN THE PLANE")}${head(L[1], "IN SPACE-TIME")}${head(L[2], "IN SPACE")}
    ${box(L[0], ROW[0], COLOURS, ["coloured wallpaper groups",
        `N&#160;≤&#160;${H.meta.maxColours} colours`])}
    ${box(L[0], ROW[2], CYCLIC, ["…whose colour group is", "a regular cyclic clock"])}
    ${box(L[1], ROW[0], h.filmGroups, ["film (space-time) groups", "of 2+1 dimensions"])}
    ${box(L[1], ROW[2], h.clockwork, ["clockwork groups", "— they never run backwards"], true)}
    ${box(L[2], ROW[0], h.spaceGroups, ["space-group types", "of 3 dimensions"])}
    ${box(L[2], ROW[1], h.nonCubic, ["non-cubic", "— Fletcher's count"])}
    ${box(L[2], ROW[2], h.polar, ["polar space groups", "— the pyroelectric ten"], true)}
    ${contain(L[0], ROW[0] + HGT, ROW[2], "cyclic")}
    ${contain(L[1], ROW[0] + HGT, ROW[2], "forward")}
    ${contain(L[2], ROW[0] + HGT, ROW[1], "no cubic")}
    ${contain(L[2], ROW[1] + HGT, ROW[2], "polar")}
    ${arrow(L[1] + W, L[2] - W, ROW[0] + 28, "phase = height",
        `onto all ${h.nonCubic} · fibres 1–3`)}
    ${arrow(L[1] - W, L[0] + W, ROW[2] + 28, "phase = colour", "−42 drift · +4 chiral")}
    ${arrow(L[1] + W, L[2] - W, ROW[2] + 28, "bijection", "", true)}
    <text x="${mid(L[0], L[2])}" y="336" text-anchor="middle" font-size="10.5"
      fill="var(--muted)">the ${h.wallpaper} wallpaper groups are the
      N&#160;=&#160;1 case of every column: one colour, a C₁ clock, no time
      structure at all</text>
  </svg></div>`;
}
