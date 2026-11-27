// Interactive SVG topological carving schematic and piece-area breakdown.
// Visualizes how the Conway orbifold is cut into rigid pieces and lets users
// select pairs / edge slots directly on the diagram.

import { formatAreaPi } from "./orbifold.js?v=fn-v2";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, text = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  }
  if (text !== null) el.textContent = text;
  return el;
}

function polarPt(cx, cy, rx, ry, angle) {
  return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
}

/**
 * Compute deterministic leaf order around the schematic perimeter so every
 * subtree cut encloses a contiguous arc with zero crossings.
 */
function orderTreeLeaves(orb, carving) {
  const cutById = new Map(carving.cuts.map((c) => [c.id, c]));
  const pieceByCut = new Map();
  for (const p of carving.pieces) {
    if (p.boundaryCutId) pieceByCut.set(p.boundaryCutId, p);
  }

  // Fallback leaf list
  const rawLeaves = [];
  for (const h of orb.handleItems) rawLeaves.push(h.plusId, h.minusId);
  for (const c of orb.coneItems) rawLeaves.push(c.id);
  for (const ml of orb.mirrorLoops) {
    rawLeaves.push(ml.corners.length === 0 ? `smooth:${ml.loopIndex}` : `collar:${ml.loopIndex}`);
  }
  for (const xc of orb.crosscapItems) rawLeaves.push(`crosscap:${xc.index}`);

  if (orb.mode !== "pants") return rawLeaves;

  const finalPant = carving.pieces.find((p) => p.id === "piece:pant-final");
  if (!finalPant) return rawLeaves;

  const expand = (id) => {
    const p = pieceByCut.get(id);
    if (!p || p.kind !== "pant") return [id];
    const kids = p.features.filter((f) => f.cutId !== id).map((f) => f.id);
    return kids.flatMap(expand);
  };

  const ordered = [];
  for (const f of finalPant.features) {
    ordered.push(...expand(f.id));
  }
  // Ensure every raw leaf is included
  for (const l of rawLeaves) {
    if (!ordered.includes(l)) ordered.push(l);
  }
  return ordered;
}

/**
 * Render the interactive SVG schematic + pieces breakdown into `containerEl`.
 */
export function renderSchematic(containerEl, orb, carving, realization, state, callbacks) {
  containerEl.innerHTML = "";
  if (!orb || !orb.ok || orb.geometry !== "hyperbolic") {
    const msg = document.createElement("div");
    msg.className = "schematic-empty";
    msg.textContent = orb?.error || "Enter a hyperbolic orbifold signature above.";
    containerEl.append(msg);
    return;
  }

  const { activePickCutIndex, pendingNodeId, hoveredCutId } = state;
  const { onSelectCutPair, onPickNode, onHoverCut, onSelectCutCard } = callbacks;

  const W = 380;
  const H = 264;
  const svg = svgEl("svg", {
    class: "carving-svg",
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": `Topological carving diagram for ${orb.canonical}`
  });

  // Helper to attach interactive picking state banner inside SVG if armed
  const armedCut =
    activePickCutIndex !== null && activePickCutIndex >= 0 && activePickCutIndex < carving.cuts.length
      ? carving.cuts[activePickCutIndex]
      : null;
  const armedStep = armedCut ? carving.steps[activePickCutIndex] : null;

  // Build interactive node ring helper
  const drawPickableBadge = (x, y, id, label, subKind, colorOverride = null, opts = {}) => {
    const isSelectable = armedStep && armedStep.selectableIds.includes(id);
    const isPending = pendingNodeId === id;
    const isPairSelected =
      armedStep &&
      armedStep.currentPair &&
      (armedStep.currentPair[0] === id || armedStep.currentPair[1] === id);

    // If pendingNodeId is set, check if (pendingNodeId, id) is a valid pair
    const isValidPartner =
      armedStep &&
      pendingNodeId &&
      pendingNodeId !== id &&
      armedStep.validPairs.some(
        ([u, v]) => (u === pendingNodeId && v === id) || (u === id && v === pendingNodeId)
      );

    const g = svgEl("g", {
      class: [
        "sch-node",
        isSelectable ? "is-selectable" : "",
        isPending ? "is-pending" : "",
        isValidPartner ? "is-partner" : "",
        isPairSelected && armedCut ? "is-current-pair" : ""
      ]
        .filter(Boolean)
        .join(" "),
      tabindex: isSelectable ? "0" : null,
      role: isSelectable ? "button" : null,
      "aria-label": isSelectable ? `Select ${label}` : label
    });

    const r = opts.radius ?? (subKind === "cut" ? 13 : 16);
    if (isSelectable) {
      g.append(
        svgEl("circle", {
          cx: x,
          cy: y,
          r: r + 5,
          fill: "none",
          stroke: isPending ? "#1a1a1f" : armedCut.color,
          "stroke-width": isPending ? 2.4 : 1.6,
          "stroke-dasharray": isPending ? "none" : "3 2.5"
        })
      );
    }

    let fill = "#ffffff";
    let stroke = "#1a1a1f";
    let textColor = "#1a1a1f";
    if (subKind === "corner") {
      fill = "#fdf4e7";
      stroke = "#9c5b10";
      textColor = "#733f06";
    } else if (subKind === "crosscap") {
      fill = "#f3ecfa";
      stroke = "#7c3a8a";
      textColor = "#5a2466";
    } else if (subKind === "smooth" || subKind === "collar") {
      fill = "#e8f5ee";
      stroke = "#1e6b48";
      textColor = "#144d33";
    } else if (subKind === "handle") {
      fill = "#eaf3fa";
      stroke = "#0f5a8a";
      textColor = "#0a4166";
    } else if (subKind === "cut") {
      fill = colorOverride || "#0f5a8a";
      stroke = "#ffffff";
      textColor = "#ffffff";
    }

    if (isPending) {
      stroke = "#1a1a1f";
    }

    if (subKind === "corner") {
      // Diamond/square badge for mirror corner
      g.append(
        svgEl("rect", {
          x: x - r * 0.9,
          y: y - r * 0.72,
          width: r * 1.8,
          height: r * 1.44,
          rx: 5,
          fill,
          stroke: isPairSelected && armedCut ? armedCut.color : stroke,
          "stroke-width": isPairSelected && armedCut ? 2.4 : 1.7
        })
      );
    } else {
      g.append(
        svgEl("circle", {
          cx: x,
          cy: y,
          r,
          fill,
          stroke: isPairSelected && armedCut ? armedCut.color : stroke,
          "stroke-width": isPairSelected && armedCut ? 2.4 : 1.7
        })
      );
    }

    const txt = svgEl(
      "text",
      {
        x,
        y: y + 4,
        "text-anchor": "middle",
        "font-size": label.length > 4 ? "9.5" : "11",
        "font-weight": "700",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fill: textColor
      },
      label
    );
    g.append(txt);

    if (isSelectable) {
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        onPickNode(id);
      });
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPickNode(id);
        }
      });
    }
    svg.append(g);
  };

  // --- Mode-specific schematic drawing ---
  if (orb.mode === "rigid") {
    const cx = W / 2;
    const cy = H / 2 - 4;
    const R = 82;
    if (orb.b === 1 && orb.n === 3) {
      const pts = [0, 1, 2].map((i) => polarPt(cx, cy + 12, R, R, -Math.PI / 2 + (i * 2 * Math.PI) / 3));
      svg.append(
        svgEl("polygon", {
          points: pts.map((p) => p.join(",")).join(" "),
          fill: "#f3f4f6",
          stroke: "#1a1a1f",
          "stroke-width": 3.2
        })
      );
      pts.forEach(([x, y], i) => {
        const c = orb.mirrorLoops[0].corners[i];
        drawPickableBadge(x, y, c.id, c.shortLabel, "corner");
      });
    } else if (orb.m === 3) {
      svg.append(
        svgEl("ellipse", {
          cx,
          cy,
          rx: 108,
          ry: 84,
          fill: "#f7f7f8",
          stroke: "#9da2ae",
          "stroke-width": 1.6
        })
      );
      orb.coneItems.forEach((c, i) => {
        const [x, y] = polarPt(cx, cy, 68, 50, -Math.PI / 2 + (i * 2 * Math.PI) / 3);
        drawPickableBadge(x, y, c.id, c.shortLabel, "cone");
      });
    } else {
      // p*q
      svg.append(
        svgEl("circle", {
          cx,
          cy,
          r: R,
          fill: "#f7f7f8",
          stroke: "#1a1a1f",
          "stroke-width": 3.2
        })
      );
      drawPickableBadge(cx, cy - 12, orb.coneItems[0].id, orb.coneItems[0].shortLabel, "cone");
      drawPickableBadge(cx, cy + R, orb.mirrorLoops[0].corners[0].id, orb.mirrorLoops[0].corners[0].shortLabel, "corner");
    }
    svg.append(
      svgEl(
        "text",
        { x: cx, y: H - 10, "text-anchor": "middle", "font-size": "11.5", fill: "#52514a" },
        "Rigid orbifold (Teichmuller dimension 0 — no free cuts)"
      )
    );
  } else if (orb.mode === "mirror-poly" || orb.mode === "cone-mirror") {
    const cx = W / 2;
    const cy = H / 2 - 4;
    const R = 94;

    // Mirror boundary ring
    svg.append(
      svgEl("circle", {
        cx,
        cy,
        r: R,
        fill: "#f7f7f8",
        stroke: "#1a1a1f",
        "stroke-width": 3.2
      })
    );

    const corners = orb.mirrorLoops[0].corners;
    const n = corners.length;
    const cornerCoords = new Map();
    corners.forEach((c, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      cornerCoords.set(c.id, { ang, pt: polarPt(cx, cy, R, R, ang), item: c });
    });

    // Edge-slot highlight for cone-mirror Cut 0
    if (orb.mode === "cone-mirror" && armedCut && armedStep?.pairMode === "edge-slot") {
      for (let i = 0; i < n; i++) {
        const u = corners[i];
        const v = corners[(i + 1) % n];
        const a1 = cornerCoords.get(u.id).ang;
        const a2 = a1 + (2 * Math.PI) / n;
        const amid = (a1 + a2) / 2;
        const [ex, ey] = polarPt(cx, cy, R, R, amid);
        const isCur =
          armedStep.currentPair &&
          ((armedStep.currentPair[0] === u.id && armedStep.currentPair[1] === v.id) ||
            (armedStep.currentPair[0] === v.id && armedStep.currentPair[1] === u.id));
        const edgeBtn = svgEl("g", { class: "sch-edge-slot", role: "button", tabindex: "0" });
        edgeBtn.append(
          svgEl("circle", {
            cx: ex,
            cy: ey,
            r: 10,
            fill: isCur ? armedCut.color : "#ffffff",
            stroke: armedCut.color,
            "stroke-width": 2
          }),
          svgEl(
            "text",
            {
              x: ex,
              y: ey + 3.5,
              "text-anchor": "middle",
              "font-size": "9",
              "font-weight": "700",
              fill: isCur ? "#ffffff" : armedCut.color
            },
            "+"
          )
        );
        edgeBtn.addEventListener("click", () => onSelectCutPair(activePickCutIndex, u.id, v.id));
        svg.append(edgeBtn);
      }
    }

    // Track ring angular positions including inserted cone-mirror-arc cut and mirror-arc cuts
    const ringOrder = [...corners.map((c) => c.id)];
    const nodePos = new Map();
    for (const [id, info] of cornerCoords) nodePos.set(id, { ...info.pt, ang: info.ang });

    // For cone-mirror, place cut0 node on the chosen edge slot
    let cutStartIdx = 0;
    if (orb.mode === "cone-mirror") {
      const cut0 = carving.cuts[0];
      const [u, v] = cut0.pair;
      const idxU = corners.findIndex((c) => c.id === u);
      const a1 = cornerCoords.get(u).ang;
      const a2 = a1 + (2 * Math.PI) / n;
      const amid = (a1 + a2) / 2;
      const anchorPt = polarPt(cx, cy, R, R, amid);
      const conePt = [cx, cy];

      // Draw loop wrapping the cone onto the chosen edge slot
      const pStart = polarPt(cx, cy, R, R, amid - 0.16);
      const pEnd = polarPt(cx, cy, R, R, amid + 0.16);
      const perpX = Math.cos(amid);
      const perpY = Math.sin(amid);
      const ctrl1 = [cx - perpX * 26 - perpY * 36, cy - perpY * 26 + perpX * 36];
      const ctrl2 = [cx - perpX * 26 + perpY * 36, cy - perpY * 26 - perpX * 36];
      const isHov = hoveredCutId === cut0.id || (armedCut && armedCut.id === cut0.id);

      const pathEl = svgEl("path", {
        d: `M ${pStart[0]} ${pStart[1]} C ${ctrl1[0]} ${ctrl1[1]}, ${ctrl2[0]} ${ctrl2[1]}, ${pEnd[0]} ${pEnd[1]}`,
        fill: isHov ? `${cut0.color}18` : "none",
        stroke: cut0.color,
        "stroke-width": isHov ? 3.5 : 2.3,
        "stroke-linecap": "round",
        class: "sch-cut-curve"
      });
      pathEl.addEventListener("mouseenter", () => onHoverCut(cut0.id));
      pathEl.addEventListener("mouseleave", () => onHoverCut(null));
      pathEl.addEventListener("click", () => onSelectCutCard(0));
      svg.append(pathEl);

      // Node for alpha1 sits at edge midpoint so subsequent mirror-arc steps can select it!
      nodePos.set(cut0.id, { 0: anchorPt[0], 1: anchorPt[1], ang: amid, isArcMid: true });
      const insPos = (idxU + 1) % (ringOrder.length + 1);
      ringOrder.splice(idxU + 1, 0, cut0.id);
      cutStartIdx = 1;
      drawPickableBadge(conePt[0], conePt[1], orb.coneItems[0].id, orb.coneItems[0].shortLabel, "cone");
    }

    // Draw mirror-arc chords sequentially around the ring
    const workRing = [...ringOrder];
    for (let ci = cutStartIdx; ci < carving.cuts.length; ci++) {
      const cut = carving.cuts[ci];
      const [u, v] = cut.pair;
      const iu = workRing.indexOf(u);
      const iv = workRing.indexOf(v);
      const pu = nodePos.get(u);
      const pv = nodePos.get(v);

      // Compute chord span points slightly past u and v along boundary
      // Place arc midpoint inside the circle along the average chord
      const midAngle = Math.atan2((pu[1] + pv[1]) / 2 - cy, (pu[0] + pv[0]) / 2 - cx);
      const chordRadius = R * (0.64 - 0.08 * (ci - cutStartIdx));
      const midPt = polarPt(cx, cy, chordRadius, chordRadius, midAngle);
      const pA = [pu[0] + (cx - pu[0]) * 0.14, pu[1] + (cy - pu[1]) * 0.14];
      const pB = [pv[0] + (cx - pv[0]) * 0.14, pv[1] + (cy - pv[1]) * 0.14];

      // Draw smooth quadratic curve through midPt (Ctrl = 2*midPt - 0.5*(pA+pB))
      const ctrlX = 2 * midPt[0] - 0.5 * (pA[0] + pB[0]);
      const ctrlY = 2 * midPt[1] - 0.5 * (pA[1] + pB[1]);
      const isHov = hoveredCutId === cut.id || (armedCut && armedCut.id === cut.id);

      const pathEl = svgEl("path", {
        d: `M ${pA[0]} ${pA[1]} Q ${ctrlX} ${ctrlY} ${pB[0]} ${pB[1]}`,
        fill: "none",
        stroke: cut.color,
        "stroke-width": isHov ? 3.8 : 2.5,
        "stroke-dasharray": "none",
        "stroke-linecap": "round",
        class: "sch-cut-curve"
      });
      pathEl.addEventListener("mouseenter", () => onHoverCut(cut.id));
      pathEl.addEventListener("mouseleave", () => onHoverCut(null));
      pathEl.addEventListener("click", () => onSelectCutCard(ci));
      svg.append(pathEl);

      nodePos.set(cut.id, { 0: midPt[0], 1: midPt[1], ang: midAngle, isArcMid: true });

      if ((iu + 1) % workRing.length === iv) {
        if (iu + 1 < workRing.length) workRing.splice(iu, 2, cut.id);
        else workRing.splice(0, 1, cut.id), workRing.pop();
      } else {
        if (iv + 1 < workRing.length) workRing.splice(iv, 2, cut.id);
        else workRing.splice(0, 1, cut.id), workRing.pop();
      }
    }

    // Draw corner badges
    for (const c of corners) {
      const p = nodePos.get(c.id);
      drawPickableBadge(p[0], p[1], c.id, c.shortLabel, "corner");
    }
    // Draw arc badges (clickable when armed in adjacent mode or always visible as label pill)
    for (const cut of carving.cuts) {
      const p = nodePos.get(cut.id);
      if (!p) continue;
      drawPickableBadge(p[0], p[1], cut.id, cut.name, "cut", cut.color, { radius: 11 });
    }
  } else {
    // 'pants' or 'collar-pair'
    const cx = W / 2;
    const cy = H / 2 - 2;
    const rx = 118;
    const ry = 82;

    // Base orbifold sphere oval
    svg.append(
      svgEl("ellipse", {
        cx,
        cy,
        rx,
        ry,
        fill: "#f7f7f8",
        stroke: "#b8bdc8",
        "stroke-width": 1.6
      })
    );

    const leaves = orderTreeLeaves(orb, carving);
    const L = leaves.length;
    const leafPos = new Map();
    const leafAngle = new Map();

    // Place leaves cleanly around the perimeter (horizontal left/right when L === 2)
    leaves.forEach((id, i) => {
      const ang = L === 2 ? (i === 0 ? Math.PI : 0) : -Math.PI / 2 + (i * 2 * Math.PI) / L;
      leafAngle.set(id, ang);
      leafPos.set(id, polarPt(cx, cy, rx, ry, ang));
    });

    // Draw handle arches connecting h+ and h-
    for (const h of orb.handleItems) {
      const hCut = carving.cuts.find((c) => c.kind === "handle" && c.targetId === h.id);
      const pPlus = leafPos.get(h.plusId);
      const pMinus = leafPos.get(h.minusId);
      if (pPlus && pMinus && hCut) {
        const mx = (pPlus[0] + pMinus[0]) / 2;
        const my = (pPlus[1] + pMinus[1]) / 2;
        const vx = mx - cx;
        const vy = my - cy;
        const norm = Math.hypot(vx, vy) || 1;
        const pushOut = 54;
        const ctrlX = mx + (vx / norm) * pushOut;
        const ctrlY = my + (vy / norm) * pushOut;
        const isHov = hoveredCutId === hCut.id;
        const arch = svgEl("path", {
          d: `M ${pPlus[0]} ${pPlus[1]} Q ${ctrlX} ${ctrlY} ${pMinus[0]} ${pMinus[1]}`,
          fill: "none",
          stroke: hCut.color,
          "stroke-width": isHov ? 4.5 : 3,
          "stroke-dasharray": "5 3",
          class: "sch-cut-curve"
        });
        arch.addEventListener("mouseenter", () => onHoverCut(hCut.id));
        arch.addEventListener("mouseleave", () => onHoverCut(null));
        arch.addEventListener("click", () => onSelectCutCard(hCut.index));
        svg.append(arch);
      }
    }

    // Draw nested cut loops for pair cuts
    const cutCenter = new Map();
    const pieceByCut = new Map();
    for (const p of carving.pieces) {
      if (p.boundaryCutId) pieceByCut.set(p.boundaryCutId, p);
    }

    const collectLeaves = (id) => {
      const p = pieceByCut.get(id);
      if (!p || p.kind !== "pant") return [id];
      return p.features.filter((f) => f.cutId !== id).flatMap((f) => collectLeaves(f.id));
    };

    const pairCuts = carving.cuts.filter((c) => c.kind === "pair");
    pairCuts.forEach((cut, pi) => {
      const subLeaves = collectLeaves(cut.id);
      const pts = subLeaves.map((lid) => leafPos.get(lid)).filter(Boolean);
      if (pts.length === 0) return;

      // Bounding box + convex centroid of enclosed leaves
      let avgX = 0;
      let avgY = 0;
      for (const [px, py] of pts) {
        avgX += px;
        avgY += py;
      }
      avgX /= pts.length;
      avgY /= pts.length;

      // Build smooth enclosing capsule/loop around subLeaves
      const radSpread = pts.reduce((acc, [px, py]) => Math.max(acc, Math.hypot(px - avgX, py - avgY)), 0);
      const pad = 21 + 5 * (pi % 3);
      const isHov = hoveredCutId === cut.id || (armedCut && armedCut.id === cut.id);

      // Compute major axis from pts
      let dx = pts[pts.length - 1][0] - pts[0][0];
      let dy = pts[pts.length - 1][1] - pts[0][1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const halfMajor = Math.max(24, len * 0.52 + pad);
      const halfMinor = Math.max(22, Math.min(34, radSpread * 0.35 + 22));

      const loopG = svgEl("g", {
        transform: `translate(${avgX}, ${avgY}) rotate(${angleDeg})`,
        class: "sch-cut-curve"
      });
      loopG.append(
        svgEl("rect", {
          x: -halfMajor,
          y: -halfMinor,
          width: halfMajor * 2,
          height: halfMinor * 2,
          rx: halfMinor,
          fill: isHov ? `${cut.color}16` : `${cut.color}0a`,
          stroke: cut.color,
          "stroke-width": isHov ? 3.2 : 2
        })
      );
      loopG.addEventListener("mouseenter", () => onHoverCut(cut.id));
      loopG.addEventListener("mouseleave", () => onHoverCut(null));
      loopG.addEventListener("click", () => onSelectCutCard(cut.index));
      svg.append(loopG);

      // Place composite cut badge slightly toward sphere center
      const toCenterX = cx - avgX;
      const toCenterY = cy - avgY;
      const toCenterLen = Math.hypot(toCenterX, toCenterY) || 1;
      const badgeX = avgX + (toCenterX / toCenterLen) * Math.min(32, toCenterLen * 0.48);
      const badgeY = avgY + (toCenterY / toCenterLen) * Math.min(26, toCenterLen * 0.48);
      cutCenter.set(cut.id, [badgeX, badgeY]);
    });

    // Draw corner-cap / bridge mini-diagrams around collar ends if orb has cornered mirrors
    for (const ml of orb.mirrorLoops) {
      if (ml.corners.length < 2) continue;
      const collarId = `collar:${ml.loopIndex}`;
      const pos = leafPos.get(collarId) || [cx + (ml.loopIndex === 0 ? -90 : 90), cy];
      // Show compact corner ring near collar node when armed or small inset
      const bridgeCut = carving.cuts.find((c) => c.kind === "bridge-arc" && c.loopIndex === ml.loopIndex);
      if (bridgeCut) {
        const ringR = 30;
        const rCx = pos[0] + (pos[0] >= cx ? 38 : -38);
        const rCy = pos[1];
        svg.append(
          svgEl("circle", {
            cx: rCx,
            cy: rCy,
            r: ringR,
            fill: "#fdf4e7",
            stroke: "#1a1a1f",
            "stroke-width": 2.2
          })
        );
        const mCorners = ml.corners;
        const mcPos = new Map();
        mCorners.forEach((mc, idx) => {
          const a = -Math.PI / 2 + (idx * 2 * Math.PI) / mCorners.length;
          const pt = polarPt(rCx, rCy, ringR, ringR, a);
          mcPos.set(mc.id, { pt, ang: a });
        });
        // Bridge edge slot highlight
        if (armedCut && armedCut.id === bridgeCut.id && armedStep?.pairMode === "edge-slot") {
          mCorners.forEach((mc, idx) => {
            const next = mCorners[(idx + 1) % mCorners.length];
            const a1 = mcPos.get(mc.id).ang;
            const amid = a1 + Math.PI / mCorners.length;
            const [ex, ey] = polarPt(rCx, rCy, ringR, ringR, amid);
            const btn = svgEl("circle", {
              cx: ex,
              cy: ey,
              r: 7,
              fill: "#ffffff",
              stroke: bridgeCut.color,
              "stroke-width": 2,
              class: "sch-edge-slot"
            });
            btn.addEventListener("click", () => onSelectCutPair(bridgeCut.index, mc.id, next.id));
            svg.append(btn);
          });
        }
        // Bridge line from collar to chosen mirror edge
        const [bu, bv] = bridgeCut.pair;
        const buInfo = mcPos.get(bu);
        if (buInfo) {
          const amid = buInfo.ang + Math.PI / mCorners.length;
          const [ex, ey] = polarPt(rCx, rCy, ringR, ringR, amid);
          svg.append(
            svgEl("line", {
              x1: pos[0],
              y1: pos[1],
              x2: ex,
              y2: ey,
              stroke: bridgeCut.color,
              "stroke-width": 2.3
            })
          );
        }
        mCorners.forEach((mc) => {
          const p = mcPos.get(mc.id).pt;
          drawPickableBadge(p[0], p[1], mc.id, mc.shortLabel, "corner", null, { radius: 11 });
        });
      }
    }

    // Draw all perimeter leaf badges
    for (const id of leaves) {
      const [x, y] = leafPos.get(id);
      if (id.startsWith("cone:")) {
        const item = orb.coneItems[parseInt(id.split(":")[1], 10)];
        drawPickableBadge(x, y, id, item.shortLabel, "cone");
      } else if (id.startsWith("handle:")) {
        const [, hStr, side] = id.split(":");
        drawPickableBadge(x, y, id, `h${parseInt(hStr, 10) + 1}${side === "+" ? "⁺" : "⁻"}`, "handle");
      } else if (id.startsWith("crosscap:")) {
        const c = parseInt(id.split(":")[1], 10);
        drawPickableBadge(x, y, id, `x${c + 1}`, "crosscap");
      } else if (id.startsWith("smooth:")) {
        const j = parseInt(id.split(":")[1], 10);
        drawPickableBadge(x, y, id, `*${j + 1}`, "smooth");
      } else if (id.startsWith("collar:")) {
        const j = parseInt(id.split(":")[1], 10);
        drawPickableBadge(x, y, id, orb.mirrorLoops[j].shortLabel, "collar");
      }
    }

    // Draw composite cut badges
    for (const cut of pairCuts) {
      const p = cutCenter.get(cut.id);
      if (!p) continue;
      drawPickableBadge(p[0], p[1], cut.id, cut.name, "cut", cut.color, { radius: 12 });
    }
  }

  // Armed-pick hint pill at top of SVG
  if (armedCut && armedStep && armedStep.pairMode !== "none") {
    const hintText =
      armedStep.pairMode === "edge-slot"
        ? `Pick a mirror edge slot (+) for ${armedCut.name}`
        : pendingNodeId
        ? `Click second item to pair for ${armedCut.name}`
        : `Click two items on diagram to draw ${armedCut.name} around`;
    svg.append(
      svgEl("rect", {
        x: 16,
        y: 6,
        width: W - 32,
        height: 22,
        rx: 11,
        fill: "#1a1a1f"
      }),
      svgEl(
        "text",
        {
          x: W / 2,
          y: 21,
          "text-anchor": "middle",
          "font-size": "11",
          "font-weight": "600",
          fill: "#ffffff"
        },
        hintText
      )
    );
  }

  containerEl.append(svg);

  // --- Pieces breakdown strip ---
  const strip = document.createElement("div");
  strip.className = "pieces-strip";
  for (const piece of carving.pieces) {
    const chip = document.createElement("span");
    chip.className = `piece-chip ${piece.degenerate ? "is-degen" : ""}`;
    let title = "";
    if (piece.kind === "pant") {
      title = `(${piece.features.map((f) => f.label).join(", ")})`;
    } else if (piece.kind === "mirror-poly") {
      title = `[${piece.features.map((f) => f.label).join(", ")}]`;
    } else if (piece.kind === "cone-mirror-cap") {
      title = `Cap(${piece.cone.label}, mirror)`;
    } else if (piece.kind === "corner-cap") {
      title = `Cap(${piece.corner.shortLabel})`;
    } else if (piece.kind === "cuff-mirror-bridge") {
      title = `Bridge(cuff, mirror)`;
    } else {
      title = orb.canonical;
    }
    const areaTxt = piece.degenerate
      ? "0 (folded)"
      : formatAreaPi(piece.areaOverPi);
    chip.innerHTML = `<strong>${title}</strong> <span>${areaTxt}</span>`;
    strip.append(chip);
  }
  containerEl.append(strip);
}
