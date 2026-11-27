// Main interactive workbench controller for Fenchel-Nielsen orbifold coordinates.

import {
  PRESETS,
  parseOrbifold,
  createDefaultCarving,
  getCutOptions,
  setCutPair,
  cycleCarvingTopology,
  totalSliderCount,
  formatFrac,
  formatAreaPi
} from "./orbifold.js?v=fn-v1";

import {
  ID3,
  mul3,
  apply3,
  invLorentz,
  normTime,
  poincare,
  liftDisk,
  geodesicSamples,
  slideFrame,
  mobiusTranslateToOrigin,
  det3,
  buildRealization,
  generateTiling
} from "./hyperbolic.js?v=fn-v1";

import { renderSchematic } from "./schematic.js?v=fn-v1";

const state = {
  orb: null,
  carving: null,
  realization: null,
  cameraM: ID3,
  activePickCutIndex: null,
  pendingNodeId: null,
  hoveredCutId: null,
  animFrame: null,
  refineTimer: null,
  rafRenderPending: false,
  overlays: {
    cuts: true,
    fd: true,
    seams: false,
    markers: true,
    parity: true
  }
};

// DOM references
const els = {
  sigForm: document.getElementById("sig-form"),
  sigInput: document.getElementById("sig-input"),
  presetGroups: document.getElementById("preset-groups"),
  statusBanner: document.getElementById("status-banner"),
  kpis: document.getElementById("kpi-grid"),
  canvas: document.getElementById("disk-canvas"),
  schematicHost: document.getElementById("schematic-host"),
  slidersHost: document.getElementById("sliders-host"),
  btnCycleCarving: document.getElementById("btn-cycle-carving"),
  btnCancelPick: document.getElementById("btn-cancel-pick"),
  btnRecenter: document.getElementById("btn-recenter"),
  btnResetParams: document.getElementById("btn-reset-params"),
  btnRandomize: document.getElementById("btn-randomize"),
  genSummary: document.getElementById("gen-diag"),
  genBody: document.getElementById("gen-tbody")
};

function cutKindLabel(cut) {
  switch (cut.kind) {
    case "pair":
      return "Closed geodesic";
    case "mirror-arc":
      return "Orthogeodesic arc";
    case "cone-mirror-arc":
      return "Cone-mirror arc";
    case "bridge-arc":
      return "Cuff–mirror bridge";
    case "handle":
      return "Handle loop";
    case "crosscap":
      return "Crosscap core";
    case "smooth-mirror":
      return "Smooth mirror";
    case "collar":
      return "Collar cuff";
    default:
      return cut.kind;
  }
}

function formatItemDisplayName(id, orb, carving) {
  const cut = carving.cuts.find((c) => c.id === id);
  if (cut) return cut.name;
  if (id.startsWith("cone:")) {
    return orb.coneItems[parseInt(id.split(":")[1], 10)]?.shortLabel || id;
  }
  if (id.startsWith("corner:")) {
    const [, j, r] = id.split(":").map(Number);
    return orb.mirrorLoops[j]?.corners[r]?.shortLabel || id;
  }
  if (id.startsWith("handle:")) {
    const [, hStr, side] = id.split(":");
    return `h${parseInt(hStr, 10) + 1}${side === "+" ? "⁺" : "⁻"}`;
  }
  if (id.startsWith("crosscap:")) {
    return `x${parseInt(id.split(":")[1], 10) + 1}`;
  }
  if (id.startsWith("smooth:")) {
    return `*${parseInt(id.split(":")[1], 10) + 1}`;
  }
  if (id.startsWith("collar:")) {
    const j = parseInt(id.split(":")[1], 10);
    return orb.mirrorLoops[j]?.shortLabel || id;
  }
  return id;
}

function stopActiveAnimation() {
  if (state.animFrame) {
    cancelAnimationFrame(state.animFrame);
    state.animFrame = null;
  }
}

// ---------------------------------------------------------------------------
// 1. Canvas Poincaré Disk Renderer
// ---------------------------------------------------------------------------

function prepCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = canvas.clientWidth || 480;
  const px = Math.round(css * dpr);
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, size: css };
}

function drawPolygonPath(ctx, toPx, vertsH) {
  ctx.beginPath();
  for (let i = 0; i < vertsH.length; i++) {
    const u = vertsH[i];
    const w = vertsH[(i + 1) % vertsH.length];
    const pu = poincare(u);
    const pw = poincare(w);
    const d = Math.hypot(pu[0] - pw[0], pu[1] - pw[1]);
    const steps = d > 0.35 ? 10 : d > 0.14 ? 6 : 3;
    const samples = geodesicSamples(u, w, steps);
    for (let s = 0; s < samples.length; s++) {
      if (i > 0 && s === 0) continue;
      const [px, py] = toPx(samples[s]);
      if (i === 0 && s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function drawMarker(ctx, x, y, mk, sizeScale = 1) {
  const r = (mk.order === 2 ? 4.2 : 5.0) * sizeScale;
  ctx.save();
  if (mk.kind === "corner") {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#9c5b10";
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = mk.order === 2 ? "#b85d10" : mk.order === 3 ? "#0f5a8a" : "#1e6b48";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (mk.order === 2) {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
    } else if (mk.order <= 8) {
      for (let i = 0; i < mk.order; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / mk.order;
        const px = x + r * Math.cos(a);
        const py = y + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function renderDisk(maxPolys = 2200) {
  const cv = els.canvas;
  if (!cv) return;
  const { ctx, size } = prepCanvas(cv);
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.48;
  const toPx = (p) => [cx + p[0] * R, cy - p[1] * R];

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = "#f2f1ec";
  ctx.fill();
  ctx.clip();

  const real = state.realization;
  if (!real) {
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "#c7c7d1";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }

  const tiles = generateTiling(real, state.cameraM, { maxPolys, rMax: 0.985 });
  const { overlays, hoveredCutId } = state;

  // 1. Draw all tile polygons
  for (let ti = 0; ti < tiles.length; ti++) {
    const t = tiles[ti];
    const CM = mul3(state.cameraM, t.M);
    const tileDetFlip = t.detPos ? 0 : 1;
    for (let pi = 0; pi < real.fdPolygons.length; pi++) {
      const poly = real.fdPolygons[pi];
      const worldVerts = poly.vertsH.map((v) => normTime(apply3(CM, v)));
      drawPolygonPath(ctx, toPx, worldVerts);
      if (overlays.parity) {
        const p = poly.parity ^ tileDetFlip;
        ctx.fillStyle = p === 0 ? "#e2e7ee" : "#f9f8f4";
      } else {
        ctx.fillStyle = "#f7f6f1";
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(26, 26, 31, 0.20)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  // 2. Highlight assembled fundamental domain
  if (overlays.fd) {
    for (let pi = 0; pi < real.fdPolygons.length; pi++) {
      const poly = real.fdPolygons[pi];
      const worldVerts = poly.vertsH.map((v) => normTime(apply3(state.cameraM, v)));
      drawPolygonPath(ctx, toPx, worldVerts);
      ctx.fillStyle = "rgba(15, 90, 138, 0.14)";
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 90, 138, 0.58)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // 3. Draw half-pant internal seams
  if (overlays.seams && real.seamSegments.length > 0) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(26, 26, 31, 0.45)";
    ctx.lineWidth = 1.2;
    for (const seg of real.seamSegments) {
      ctx.beginPath();
      for (let i = 0; i < seg.length; i++) {
        const pt = poincare(normTime(apply3(state.cameraM, liftDisk(seg[i][0], seg[i][1]))));
        const [px, py] = toPx(pt);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Draw lifted cut geodesics across tiles
  if (overlays.cuts && real.cutSegments.length > 0) {
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      if (t.r > 0.94) continue;
      const CM = mul3(state.cameraM, t.M);
      const isFD = ti === 0;
      for (const seg of real.cutSegments) {
        const pA = normTime(apply3(CM, seg.A));
        const pB = normTime(apply3(CM, seg.B));
        const dA = poincare(pA);
        const dB = poincare(pB);
        const distDisk = Math.hypot(dA[0] - dB[0], dA[1] - dB[1]);
        if (distDisk < 0.008) continue;

        const pts = geodesicSamples(pA, pB, distDisk > 0.25 ? 12 : 6);
        const isHov = hoveredCutId === seg.cutId;
        ctx.save();
        ctx.beginPath();
        for (let k = 0; k < pts.length; k++) {
          const [px, py] = toPx(pts[k]);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = seg.color;
        ctx.globalAlpha = isFD ? 0.98 : isHov ? 0.9 : 0.62;
        ctx.lineWidth = isFD ? (isHov ? 4.4 : 3.0) : isHov ? 2.8 : 1.5;
        ctx.lineCap = "round";
        if (seg.isMirrorWall) ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw twist footpoint ticks along FD cut geodesics
    if (overlays.fd) {
      for (const seg of real.cutSegments) {
        if (!seg.twistTicks || !seg.frame) continue;
        const wf = {
          P: normTime(apply3(state.cameraM, seg.frame.P)),
          T: apply3(state.cameraM, seg.frame.T),
          N: apply3(state.cameraM, seg.frame.N)
        };
        const tickOffsets = [0, seg.twistTurns * seg.length];
        for (let k = 0; k < tickOffsets.length; k++) {
          const s = ((tickOffsets[k] % seg.length) + seg.length) % seg.length;
          const pt = slideFrame(wf, s);
          const nStep = 0.085;
          const pIn = normTime([
            pt.P[0] + nStep * pt.N[0] * (k === 0 ? 1 : -1),
            pt.P[1] + nStep * pt.N[1] * (k === 0 ? 1 : -1),
            pt.P[2] + nStep * pt.N[2] * (k === 0 ? 1 : -1)
          ]);
          const [x0, y0] = toPx(poincare(pt.P));
          const [x1, y1] = toPx(poincare(pIn));
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.strokeStyle = "#1a1a1f";
          ctx.lineWidth = 2.2;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // 5. Draw cone & corner markers
  if (overlays.markers && real.markers.length > 0) {
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      if (t.r > 0.72 && ti > 0) continue;
      const CM = mul3(state.cameraM, t.M);
      const isFD = ti === 0;
      for (const mk of real.markers) {
        const dp = poincare(normTime(apply3(CM, mk.P)));
        if (Math.hypot(dp[0], dp[1]) > 0.94) continue;
        const [px, py] = toPx(dp);
        const scale = isFD ? 1.12 : Math.max(0.55, 0.95 - 0.5 * Math.hypot(dp[0], dp[1]));
        drawMarker(ctx, px, py, mk, scale);
      }
    }
  }

  ctx.restore();

  // Disk boundary ring
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = "#1a1a1f";
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function scheduleDiskRender(fast = false) {
  if (fast) {
    if (!state.rafRenderPending) {
      state.rafRenderPending = true;
      requestAnimationFrame(() => {
        state.rafRenderPending = false;
        renderDisk(950);
      });
    }
    clearTimeout(state.refineTimer);
    state.refineTimer = setTimeout(() => renderDisk(2200), 130);
  } else {
    clearTimeout(state.refineTimer);
    renderDisk(2200);
  }
}

// ---------------------------------------------------------------------------
// 2. UI Rendering: KPIs, Presets, Cut Slider Cards, Diagnostics
// ---------------------------------------------------------------------------

function renderPresets() {
  els.presetGroups.innerHTML = "";
  const activeCanon = state.orb?.ok ? state.orb.canonical : "";
  for (const grp of PRESETS) {
    const row = document.createElement("div");
    row.className = "preset-row";
    const lbl = document.createElement("span");
    lbl.className = "preset-group-lbl";
    lbl.textContent = grp.group;
    row.append(lbl);
    for (const item of grp.items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `preset-btn ${item.sig === activeCanon ? "is-active" : ""}`;
      btn.textContent = item.sig;
      btn.title = item.note;
      btn.addEventListener("click", () => loadSignature(item.sig));
      row.append(btn);
    }
    els.presetGroups.append(row);
  }
}

function renderStatusAndKPIs() {
  const orb = state.orb;
  if (!orb || !orb.ok) {
    els.statusBanner.hidden = false;
    els.statusBanner.className = "status-banner is-error";
    els.statusBanner.textContent = orb?.error || "Invalid orbifold signature.";
    els.kpis.innerHTML = "";
    return;
  }

  if (orb.geometry !== "hyperbolic") {
    els.statusBanner.hidden = false;
    els.statusBanner.className = "status-banner";
    const geomTitle = orb.geometry === "spherical" ? "Spherical (χ > 0)" : "Euclidean (χ = 0)";
    els.statusBanner.innerHTML = `<span><strong>${orb.canonical}</strong> is <strong>${geomTitle}</strong> with cost ${formatFrac(orb.cost)} and χ = ${formatFrac(orb.chi)} — hyperbolic Fenchel–Nielsen coordinates require cost &gt; 2 (χ &lt; 0).</span>`;
    if (orb.suggestion) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm btn-primary";
      btn.textContent = `Try ${orb.suggestion} →`;
      btn.addEventListener("click", () => loadSignature(orb.suggestion));
      els.statusBanner.append(btn);
    }
  } else {
    els.statusBanner.hidden = true;
  }

  const sliderCount = state.carving ? totalSliderCount(state.carving) : 0;
  const cutsCount = state.carving ? state.carving.cuts.length : 0;
  const geomLabel =
    orb.geometry === "hyperbolic" ? "Hyperbolic ℍ²" : orb.geometry === "euclidean" ? "Euclidean E²" : "Spherical S²";

  const cards = [
    { val: orb.canonical, lbl: "Orbifold", sub: orb.mode === "non-hyperbolic" ? "No ℍ² metric" : `Mode: ${orb.mode}` },
    { val: geomLabel, lbl: "Geometry", sub: `Cost = ${formatFrac(orb.cost)}` },
    { val: formatFrac(orb.chi), lbl: "Euler χ", sub: "χ = 2 − cost" },
    {
      val: orb.geometry === "hyperbolic" ? formatAreaPi(orb.areaOverPi) : "—",
      lbl: "Hyperbolic area",
      sub: orb.geometry === "hyperbolic" ? `≈ ${orb.areaNum.toFixed(3)}` : "Requires χ < 0"
    },
    {
      val: `${orb.teichDim}D`,
      lbl: "Teichmüller dim",
      sub:
        orb.geometry === "hyperbolic"
          ? `${cutsCount} ${cutsCount === 1 ? "cut" : "cuts"} · ${sliderCount} ${sliderCount === 1 ? "slider" : "sliders"}`
          : "0D"
    }
  ];

  els.kpis.innerHTML = "";
  for (const c of cards) {
    const div = document.createElement("div");
    div.className = "kpi-card";
    div.innerHTML = `<div class="kpi-val">${c.val}</div><div class="kpi-lbl">${c.lbl}</div><div class="kpi-sub">${c.sub}</div>`;
    els.kpis.append(div);
  }
}

function renderDiagnostics() {
  const real = state.realization;
  if (!real) {
    els.genSummary.textContent = "No hyperbolic realization built.";
    els.genBody.innerHTML = "";
    return;
  }
  els.genSummary.textContent = `Exact Gauss–Bonnet area = ${real.totalArea.toFixed(6)} (error ${real.areaError.toExponential(2)}) · max O(2,1) Lorentz error = ${real.maxLorentzError.toExponential(2)}`;
  els.genBody.innerHTML = "";
  for (const g of real.gens) {
    const M = g.M;
    const tr = M[0][0] + M[1][1] + M[2][2];
    const det = det3(M);
    let type = g.role;
    let invStr = "";
    if (det < 0 && Math.abs(tr - 1) < 1e-4) {
      type = "reflection";
      invStr = "order 2";
    } else if (det < 0) {
      type = "glide";
      const d = Math.acosh(Math.max(1, (1 - tr) / 2));
      invStr = `step d = ${d.toFixed(3)}`;
    } else if (tr < 3 - 1e-5) {
      type = "rotation";
      const ang = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
      const ord = Math.round((2 * Math.PI) / Math.max(1e-6, ang));
      invStr = `2π/${ord}`;
    } else if (tr > 3 + 1e-5) {
      type = "translation";
      const ell = Math.acosh(Math.max(1, (tr - 1) / 2));
      invStr = `ℓ = ${ell.toFixed(3)}`;
    }
    const row = document.createElement("tr");
    row.innerHTML = `<td>${g.label}</td><td>${type}</td><td>${det > 0 ? "+1" : "−1"}</td><td>${tr.toFixed(4)}</td><td>${invStr}</td>`;
    els.genBody.append(row);
  }
}

function renderSliders() {
  els.slidersHost.innerHTML = "";
  const orb = state.orb;
  const carving = state.carving;
  if (!orb || !orb.ok || orb.geometry !== "hyperbolic") return;

  if (carving.cuts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "panel";
    empty.innerHTML = `<p class="panel-sub"><strong>${orb.canonical}</strong> is a rigid hyperbolic orbifold (Teichmüller dimension 0). All angles and lengths are uniquely fixed with no free sliders.</p>`;
    els.slidersHost.append(empty);
    return;
  }

  carving.cuts.forEach((cut, idx) => {
    const opts = getCutOptions(orb, carving, idx);
    const isPicking = state.activePickCutIndex === idx;
    const isHovered = state.hoveredCutId === cut.id;

    const card = document.createElement("div");
    card.className = `cut-card ${isPicking ? "is-picking" : ""} ${isHovered ? "is-hovered" : ""}`;
    card.dataset.cutId = cut.id;
    card.style.borderLeftColor = cut.color;

    card.addEventListener("mouseenter", () => {
      state.hoveredCutId = cut.id;
      syncHoverVisuals();
      scheduleDiskRender(false);
    });
    card.addEventListener("mouseleave", () => {
      if (state.hoveredCutId === cut.id) {
        state.hoveredCutId = null;
        syncHoverVisuals();
        scheduleDiskRender(false);
      }
    });

    // Header
    const head = document.createElement("div");
    head.className = "cut-card-head";
    const isFoldedTwoTwo =
      cut.kind === "pair" &&
      carving.pieces.some((p) => p.boundaryCutId === cut.id && p.degenerate);
    const badgeText = isFoldedTwoTwo ? "Folded (2,2) bar" : cutKindLabel(cut);
    head.innerHTML = `
      <span class="cut-title"><span class="cut-dot" style="background:${cut.color};"></span>${cut.name}</span>
      <span class="cut-badge">${badgeText}</span>
    `;
    card.append(head);

    // Pair selector row (for every cut where user picks how to carve it out!)
    if (opts.pairMode !== "none") {
      const pairRow = document.createElement("div");
      pairRow.className = "pair-row";
      const lbl = document.createElement("label");
      lbl.className = "pair-lbl";
      lbl.textContent = opts.pairMode === "edge-slot" ? "Anchor edge:" : "Draw around:";
      lbl.htmlFor = `pair-sel-${idx}`;

      const select = document.createElement("select");
      select.id = `pair-sel-${idx}`;
      select.className = "pair-select";

      const curA = opts.currentPair[0];
      const curB = opts.currentPair[1];
      for (const [u, v] of opts.validPairs) {
        const opt = document.createElement("option");
        opt.value = `${u}||${v}`;
        const nu = formatItemDisplayName(u, orb, carving);
        const nv = formatItemDisplayName(v, orb, carving);
        opt.textContent = opts.pairMode === "edge-slot" ? `Edge (${nu}, ${nv})` : `${nu} + ${nv}`;
        if ((u === curA && v === curB) || (u === curB && v === curA)) {
          opt.selected = true;
        }
        select.append(opt);
      }
      select.addEventListener("change", () => {
        const [u, v] = select.value.split("||");
        applyCarvingUpdate(setCutPair(state.orb, state.carving, idx, u, v));
      });

      const pickBtn = document.createElement("button");
      pickBtn.type = "button";
      pickBtn.className = "btn btn-sm";
      pickBtn.setAttribute("aria-pressed", String(isPicking));
      pickBtn.textContent = isPicking ? "Picking…" : "Pick on diagram";
      pickBtn.addEventListener("click", () => {
        if (state.activePickCutIndex === idx) {
          state.activePickCutIndex = null;
          state.pendingNodeId = null;
        } else {
          state.activePickCutIndex = idx;
          state.pendingNodeId = null;
        }
        renderAllViews(false);
      });

      pairRow.append(lbl, select, pickBtn);
      card.append(pairRow);
    }

    // Length slider
    const lenRow = document.createElement("div");
    lenRow.className = "param-row";
    const lenLabelText =
      cut.kind === "crosscap"
        ? `Core step d (${cut.name})`
        : cut.kind === "mirror-arc" || cut.kind === "cone-mirror-arc" || cut.kind === "bridge-arc"
        ? `Arc length d (${cut.name})`
        : `Length ℓ (${cut.name})`;
    const formatLenVal = (val) =>
      cut.kind === "crosscap" ? `d = ${val.toFixed(2)} (cuff = ${(2 * val).toFixed(2)})` : `ℓ = ${val.toFixed(2)}`;

    const lenTop = document.createElement("div");
    lenTop.className = "param-top";
    const lenNameEl = document.createElement("span");
    lenNameEl.className = "param-name";
    lenNameEl.textContent = lenLabelText;
    const lenValEl = document.createElement("span");
    lenValEl.className = "param-val";
    lenValEl.textContent = formatLenVal(cut.length);
    lenTop.append(lenNameEl, lenValEl);

    const lenInput = document.createElement("input");
    lenInput.type = "range";
    lenInput.className = "fn-range";
    lenInput.min = cut.kind === "crosscap" ? "0.15" : "0.25";
    lenInput.max = cut.kind === "crosscap" ? "2.75" : "5.50";
    lenInput.step = "0.01";
    lenInput.value = String(cut.length);
    lenInput.style.accentColor = cut.color;
    lenInput.setAttribute("aria-label", `${lenLabelText} slider`);

    let twistValEl = null;
    const formatTwistVal = (turns, length) => {
      const sign = turns >= 0 ? "+" : "";
      const tau = turns * length;
      const tSign = tau >= 0 ? "+" : "";
      return `${sign}${turns.toFixed(2)} turns (τ = ${tSign}${tau.toFixed(2)})`;
    };

    lenInput.addEventListener("input", () => {
      stopActiveAnimation();
      cut.length = parseFloat(lenInput.value);
      lenValEl.textContent = formatLenVal(cut.length);
      if (twistValEl) twistValEl.textContent = formatTwistVal(cut.twistTurns, cut.length);
      state.realization = buildRealization(state.orb, state.carving);
      renderDiagnostics();
      scheduleDiskRender(true);
    });
    lenInput.addEventListener("change", () => scheduleDiskRender(false));

    lenRow.append(lenTop, lenInput);
    card.append(lenRow);

    // Twist slider (when hasTwist)
    if (cut.hasTwist) {
      const twRow = document.createElement("div");
      twRow.className = "param-row";
      const twTop = document.createElement("div");
      twTop.className = "param-top";
      const twNameEl = document.createElement("span");
      twNameEl.className = "param-name";
      twNameEl.textContent = `Twist θ (${cut.name})`;
      twistValEl = document.createElement("span");
      twistValEl.className = "param-val";
      twistValEl.textContent = formatTwistVal(cut.twistTurns, cut.length);
      twTop.append(twNameEl, twistValEl);

      const twControls = document.createElement("div");
      twControls.className = "param-controls";
      const twInput = document.createElement("input");
      twInput.type = "range";
      twInput.className = "fn-range";
      twInput.min = "-1";
      twInput.max = "1";
      twInput.step = "0.005";
      twInput.value = String(cut.twistTurns);
      twInput.style.accentColor = cut.color;
      twInput.setAttribute("aria-label", `Twist ${cut.name} slider`);

      const dehnBtn = document.createElement("button");
      dehnBtn.type = "button";
      dehnBtn.className = "btn btn-sm";
      dehnBtn.textContent = "Dehn twist ↻";
      dehnBtn.title = "Animate θ → θ + 1 turn (a full Dehn twist leaves the tiling invariant)";

      twInput.addEventListener("input", () => {
        stopActiveAnimation();
        cut.twistTurns = parseFloat(twInput.value);
        twistValEl.textContent = formatTwistVal(cut.twistTurns, cut.length);
        state.realization = buildRealization(state.orb, state.carving);
        renderDiagnostics();
        scheduleDiskRender(true);
      });
      twInput.addEventListener("change", () => scheduleDiskRender(false));

      dehnBtn.addEventListener("click", () => {
        stopActiveAnimation();
        const start = cut.twistTurns;
        const duration = 1350;
        const t0 = performance.now();
        const stepAnim = (now) => {
          const u = Math.min(1, (now - t0) / duration);
          const ease = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
          const val = start + ease;
          cut.twistTurns = val;
          const displayTurns = val > 1 ? val - 2 : val;
          twInput.value = String(Math.max(-1, Math.min(1, displayTurns)));
          twistValEl.textContent = formatTwistVal(val, cut.length);
          state.realization = buildRealization(state.orb, state.carving);
          renderDisk(1000);
          if (u < 1) {
            state.animFrame = requestAnimationFrame(stepAnim);
          } else {
            state.animFrame = null;
            // Wrap smoothly modulo 1 into [-1, 1]
            let final = cut.twistTurns;
            while (final > 1.0001) final -= 1;
            while (final < -1.0001) final += 1;
            cut.twistTurns = Math.round(final * 1000) / 1000;
            twInput.value = String(cut.twistTurns);
            twistValEl.textContent = formatTwistVal(cut.twistTurns, cut.length);
            state.realization = buildRealization(state.orb, state.carving);
            renderDiagnostics();
            renderDisk(2200);
          }
        };
        state.animFrame = requestAnimationFrame(stepAnim);
      });

      twControls.append(twInput, dehnBtn);
      twRow.append(twTop, twControls);
      card.append(twRow);
    } else {
      const note = document.createElement("div");
      note.className = "no-twist-note";
      note.textContent =
        cut.kind === "crosscap"
          ? "1-parameter cut: crosscap has a fixed half-turn glide twist."
          : "1-parameter cut: mirror boundary fixes twist = 0.";
      card.append(note);
    }

    els.slidersHost.append(card);
  });
}

function syncHoverVisuals() {
  for (const card of els.slidersHost.querySelectorAll(".cut-card")) {
    card.classList.toggle("is-hovered", card.dataset.cutId === state.hoveredCutId);
  }
}

function renderSchematicView() {
  renderSchematic(els.schematicHost, state.orb, state.carving, state.realization, state, {
    onSelectCutPair: (cutIdx, u, v) => {
      state.activePickCutIndex = null;
      state.pendingNodeId = null;
      applyCarvingUpdate(setCutPair(state.orb, state.carving, cutIdx, u, v));
    },
    onPickNode: (nodeId) => {
      const cutIdx = state.activePickCutIndex;
      if (cutIdx === null) return;
      const opts = getCutOptions(state.orb, state.carving, cutIdx);
      if (!opts.selectableIds.includes(nodeId)) return;

      if (!state.pendingNodeId) {
        state.pendingNodeId = nodeId;
        renderSchematicView();
        return;
      }
      if (state.pendingNodeId === nodeId) {
        state.pendingNodeId = null;
        renderSchematicView();
        return;
      }
      const first = state.pendingNodeId;
      const ok = opts.validPairs.some(
        ([u, v]) => (u === first && v === nodeId) || (u === nodeId && v === first)
      );
      if (ok) {
        state.activePickCutIndex = null;
        state.pendingNodeId = null;
        applyCarvingUpdate(setCutPair(state.orb, state.carving, cutIdx, first, nodeId));
      } else {
        // Restart pair selection with clicked node as new first node
        state.pendingNodeId = nodeId;
        renderSchematicView();
      }
    },
    onHoverCut: (cutId) => {
      state.hoveredCutId = cutId;
      syncHoverVisuals();
      scheduleDiskRender(false);
    },
    onSelectCutCard: (cutIdx) => {
      const opts = getCutOptions(state.orb, state.carving, cutIdx);
      if (opts.pairMode === "none") return;
      state.activePickCutIndex = state.activePickCutIndex === cutIdx ? null : cutIdx;
      state.pendingNodeId = null;
      renderAllViews(false);
    }
  });
}

function updateCarvingActionButtons() {
  const hasMutable =
    state.carving &&
    state.carving.cuts.some((_, i) => getCutOptions(state.orb, state.carving, i).validPairs.length > 1);
  if (els.btnCycleCarving) els.btnCycleCarving.hidden = !hasMutable;
  if (els.btnCancelPick) els.btnCancelPick.hidden = state.activePickCutIndex === null;
}

function renderAllViews(resetCamera = false) {
  if (resetCamera) state.cameraM = ID3;
  renderPresets();
  renderStatusAndKPIs();
  renderSchematicView();
  renderSliders();
  renderDiagnostics();
  updateCarvingActionButtons();
  scheduleDiskRender(false);
}

function applyCarvingUpdate(nextCarving) {
  stopActiveAnimation();
  state.carving = nextCarving;
  state.realization = buildRealization(state.orb, state.carving);
  renderAllViews(false);
}

function loadSignature(rawSig, pushUrl = true) {
  stopActiveAnimation();
  const parsed = parseOrbifold(rawSig);
  state.orb = parsed;
  state.activePickCutIndex = null;
  state.pendingNodeId = null;
  state.hoveredCutId = null;
  if (parsed.ok) {
    els.sigInput.value = parsed.canonical;
    if (pushUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("orb", parsed.canonical);
      window.history.replaceState(null, "", url.toString());
    }
  }
  if (parsed.ok && parsed.geometry === "hyperbolic") {
    state.carving = createDefaultCarving(parsed);
    state.realization = buildRealization(parsed, state.carving);
  } else {
    state.carving = null;
    state.realization = null;
  }
  renderAllViews(true);
}

// ---------------------------------------------------------------------------
// 3. Events & Camera Panning
// ---------------------------------------------------------------------------

els.sigForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  loadSignature(els.sigInput.value);
});

els.btnCycleCarving?.addEventListener("click", () => {
  if (!state.orb || !state.carving) return;
  state.activePickCutIndex = null;
  state.pendingNodeId = null;
  applyCarvingUpdate(cycleCarvingTopology(state.orb, state.carving));
});

els.btnCancelPick?.addEventListener("click", () => {
  state.activePickCutIndex = null;
  state.pendingNodeId = null;
  renderAllViews(false);
});

els.btnRecenter?.addEventListener("click", () => {
  state.cameraM = ID3;
  scheduleDiskRender(false);
});

els.btnResetParams?.addEventListener("click", () => {
  if (!state.orb || state.orb.geometry !== "hyperbolic") return;
  stopActiveAnimation();
  state.cameraM = ID3;
  state.carving = createDefaultCarving(state.orb);
  state.realization = buildRealization(state.orb, state.carving);
  renderAllViews(true);
});

els.btnRandomize?.addEventListener("click", () => {
  if (!state.orb || !state.carving || state.carving.cuts.length === 0) return;
  stopActiveAnimation();
  for (const c of state.carving.cuts) {
    if (c.kind === "crosscap") {
      c.length = Math.round((0.65 + Math.random() * 1.45) * 100) / 100;
    } else {
      c.length = Math.round((0.8 + Math.random() * 2.4) * 100) / 100;
    }
    if (c.hasTwist) {
      c.twistTurns = Math.round(((Math.random() - 0.5) * 1.4) * 200) / 200;
    }
  }
  state.realization = buildRealization(state.orb, state.carving);
  renderSliders();
  renderDiagnostics();
  scheduleDiskRender(false);
});

// Overlay checkboxes
for (const key of Object.keys(state.overlays)) {
  const chk = document.getElementById(`ov-${key}`);
  if (!chk) continue;
  chk.checked = state.overlays[key];
  chk.addEventListener("change", () => {
    state.overlays[key] = chk.checked;
    scheduleDiskRender(false);
  });
}

// Mouse / touch Mobius pan on canvas
if (els.canvas) {
  let dragStartPt = null;
  let dragStartCamera = null;

  const clientToDisk = (e) => {
    const rect = els.canvas.getBoundingClientRect();
    const R = rect.width * 0.48;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let u = (e.clientX - cx) / R;
    let v = -(e.clientY - cy) / R;
    const rad = Math.hypot(u, v);
    if (rad > 0.92) {
      u = (u / rad) * 0.92;
      v = (v / rad) * 0.92;
    }
    return [u, v];
  };

  els.canvas.addEventListener("pointerdown", (e) => {
    if (!state.realization) return;
    els.canvas.setPointerCapture(e.pointerId);
    dragStartPt = clientToDisk(e);
    dragStartCamera = state.cameraM;
  });

  els.canvas.addEventListener("pointermove", (e) => {
    if (!dragStartPt) return;
    const curPt = clientToDisk(e);
    const Pstart = liftDisk(dragStartPt[0], dragStartPt[1]);
    const Pcur = liftDisk(curPt[0], curPt[1]);
    const M1 = mobiusTranslateToOrigin(Pstart);
    const M2 = invLorentz(mobiusTranslateToOrigin(Pcur));
    state.cameraM = mul3(mul3(M2, M1), dragStartCamera);
    scheduleDiskRender(true);
  });

  const endDrag = () => {
    if (!dragStartPt) return;
    dragStartPt = null;
    dragStartCamera = null;
    scheduleDiskRender(false);
  };
  els.canvas.addEventListener("pointerup", endDrag);
  els.canvas.addEventListener("pointercancel", endDrag);
  els.canvas.addEventListener("dblclick", () => {
    state.cameraM = ID3;
    scheduleDiskRender(false);
  });
}

window.addEventListener("resize", () => scheduleDiskRender(false));

// Initial boot
const params = new URLSearchParams(window.location.search);
loadSignature(params.get("orb") || "3322", false);
