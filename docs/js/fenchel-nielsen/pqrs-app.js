// Specialized interactive controller for 4-cone sphere orbifolds (PQRS) with
// simultaneous coupled Fenchel-Nielsen coordinates across all three pants partitions.

import {
  PQRS_LETTERS,
  PQRS_PARTITIONS,
  parsePqrs,
  createPqrsState,
  computeDragAlign,
  deformPqrsPartition,
  recenterPqrsState
} from "./pqrs.js?v=fn-v7";

import {
  ID3,
  mul3,
  det3,
  apply3,
  invLorentz,
  normTime,
  poincare,
  liftDisk,
  geodesicSamples,
  mobiusTranslateToOrigin,
  reorthonormalizeLorentz,
  panCameraByDiskDelta,
  wrapCameraInGroupWithColor,
  generateTiling
} from "./hyperbolic.js?v=fn-v7";

import {
  EID3,
  emul3,
  edet3,
  eapply,
  generateEuclideanTiling,
  panEuclideanCamera,
  wrapEuclideanCameraWithColor
} from "./euclidean.js?v=fn-v7";

const EUC_VIEW_R = 2.6;

const SIDE_COLORS = ["#0072B2", "#D55E00"]; // Side A (cobalt blue) vs Side B (vermilion)
const SIDE_HALOS = ["rgba(0, 114, 178, 0.20)", "rgba(213, 94, 0, 0.20)"];
const IDLE_MARKER_INK = "#484c56";

const QUOTIENT_COLORS = [
  ["#dce8f5", "#ebf2fa"], // sky slate
  ["#f7e4cd", "#fbf0e2"], // warm apricot
  ["#dceee2", "#ebf6ee"], // soft sage
  ["#eadff2", "#f4eef9"]  // soft lavender
];

const state = {
  orb: null,
  pqrs: null,
  coloring: "parity",
  cameraM: ID3,
  cameraWrapped: false,
  cameraColor: 0,
  hoveredPartIdx: null,
  cards: [],
  activeDragPart: null,
  activeAlign: null,
  refineTimer: null,
  rafId: null
};

const els = {
  sigForm: document.getElementById("sig-form"),
  sigInput: document.getElementById("sig-input"),
  colorSelect: document.getElementById("color-select"),
  orbMeta: document.getElementById("orb-meta"),
  statusBanner: document.getElementById("status-banner"),
  canvas: document.getElementById("disk-canvas"),
  controlsCol: document.getElementById("controls-col"),
  btnReset: document.getElementById("btn-reset"),
  slidersHost: document.getElementById("sliders-host")
};

function identityCamera(orb) {
  return orb?.geometry === "euclidean" ? EID3 : ID3;
}

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

function drawEucPolygonPath(ctx, toPx, vertsE) {
  ctx.beginPath();
  for (let i = 0; i < vertsE.length; i++) {
    const [px, py] = toPx(vertsE[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function sortStationaryDrawList(drawList) {
  drawList.sort((a, b) => {
    const ra = Math.round((a.sy + 0.137) * 0.25);
    const rb = Math.round((b.sy + 0.137) * 0.25);
    return ra !== rb ? ra - rb : a.sx - b.sx;
  });
}

function tileUniformFill(coloring, t, real) {
  if (coloring === "quotient") {
    return QUOTIENT_COLORS[(t.color ?? 0) & 3][0];
  }
  if (coloring === "none") {
    return "#f7f6f1";
  }
  if ((real.quotient?.quotientSize ?? 1) >= 2) {
    return ((t.color ?? 0) & 1) === 0 ? "#e2e7ee" : "#f9f8f4";
  }
  return t.detPos ? "#e2e7ee" : "#f9f8f4";
}

function dedupScreenMarker(buckets, px, py, kind, order, featureId = null) {
  const scale = 0.25;
  const bx = Math.round(px * scale);
  const by = Math.round(py * scale);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const list = buckets.get(`${bx + dx},${by + dy}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        const same = featureId && m.featureId ? m.featureId === featureId : m.kind === kind && m.order === order;
        if (same && Math.hypot(px - m.px, py - m.py) < 2.0) {
          return false;
        }
      }
    }
  }
  const home = `${bx},${by}`;
  if (!buckets.has(home)) buckets.set(home, []);
  buckets.get(home).push({ px, py, kind, order, featureId });
  return true;
}

function coneSideForPartition(partIdx, featureId) {
  if (partIdx === null || !featureId || !featureId.startsWith("cone:")) return null;
  const coneIdx = parseInt(featureId.split(":")[1], 10);
  const part = PQRS_PARTITIONS[partIdx];
  if (!part) return null;
  if (part.sideA.includes(coneIdx)) return 0;
  if (part.sideB.includes(coneIdx)) return 1;
  return null;
}

function drawMarker(ctx, x, y, mk, sizeScale = 1, side = null) {
  const isMarked = side === 0 || side === 1;
  const r = (isMarked ? (mk.order === 2 ? 5.0 : 5.6) : mk.order === 2 ? 4.0 : 4.7) * sizeScale;
  ctx.save();
  if (isMarked) {
    ctx.fillStyle = SIDE_HALOS[side];
    ctx.beginPath();
    ctx.arc(x, y, r + 2.6 * sizeScale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = isMarked ? SIDE_COLORS[side] : IDLE_MARKER_INK;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = isMarked ? 1.5 : 1.25;
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
  ctx.restore();
}

function renderEuclideanCanvas(ctx, size, real, maxPolys) {
  const cx = size / 2;
  const cy = size / 2;
  const scalePx = size / (2 * EUC_VIEW_R);
  const toPx = ([x, y]) => [cx + x * scalePx, cy - y * scalePx];
  const { hoveredPartIdx, coloring } = state;

  ctx.save();
  ctx.fillStyle = "#f2f1ec";
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.clip();

  if (!real || !real.dirichletPoly) {
    ctx.restore();
    return;
  }

  const tiles = generateEuclideanTiling(real, state.cameraM, {
    viewRadius: EUC_VIEW_R * 1.9,
    maxTiles: Math.min(maxPolys, 1600),
    cameraColor: state.cameraColor,
    useDirichlet: true
  });

  const refE = real.dirichletBase || real.dirichletPoly.centroid;
  const drawList = tiles.map((t) => {
    const CM = t.CM || emul3(state.cameraM, t.M);
    const [sx, sy] = toPx(eapply(CM, refE));
    return {
      sx,
      sy,
      worldVerts: real.dirichletPoly.vertsE.map((v) => eapply(CM, v)),
      fill: tileUniformFill(coloring, t, real)
    };
  });
  sortStationaryDrawList(drawList);

  for (let i = 0; i < drawList.length; i++) {
    drawEucPolygonPath(ctx, toPx, drawList[i].worldVerts);
    ctx.fillStyle = drawList[i].fill;
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(26, 26, 31, 0.22)";
  ctx.lineWidth = 0.75;
  for (let i = 0; i < drawList.length; i++) {
    drawEucPolygonPath(ctx, toPx, drawList[i].worldVerts);
    ctx.stroke();
  }

  const activeMarkers = real.dirichletPoly.markers || real.markers || [];
  if (activeMarkers.length > 0) {
    const buckets = new Map();
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const CM = t.CM || emul3(state.cameraM, t.M);
      for (const mk of activeMarkers) {
        const [px, py] = toPx(eapply(CM, mk.P));
        if (px < -16 || px > size + 16 || py < -16 || py > size + 16) continue;
        if (!dedupScreenMarker(buckets, px, py, mk.kind, mk.order, mk.featureId)) continue;
        drawMarker(ctx, px, py, mk, 1.0, coneSideForPartition(hoveredPartIdx, mk.featureId));
      }
    }
  }

  ctx.restore();
}

function renderDisk(maxPolys = 2200) {
  const cv = els.canvas;
  if (!cv) return;
  const real = state.pqrs?.realization;
  const isEuc = real?.geometry === "euclidean";
  cv.classList.toggle("is-euclidean", isEuc);

  const { ctx, size } = prepCanvas(cv);
  ctx.clearRect(0, 0, size, size);

  if (isEuc) {
    renderEuclideanCanvas(ctx, size, real, maxPolys);
    return;
  }

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.48;
  const toPx = (p) => [cx + p[0] * R, cy - p[1] * R];

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = "#f2f1ec";
  ctx.fill();
  ctx.clip();

  if (!real || !real.dirichletPoly) {
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "#c7c7d1";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }

  const { hoveredPartIdx, coloring } = state;
  const tiles = generateTiling(real, state.cameraM, {
    maxPolys,
    rMax: 0.985,
    cameraColor: state.cameraColor,
    useDirichlet: true
  });

  const refH = real.dirichletBase || real.dirichletPoly.centroid;
  const drawList = tiles.map((t) => {
    const CM = t.CM || mul3(state.cameraM, t.M);
    const [sx, sy] = toPx(poincare(normTime(apply3(CM, refH))));
    return {
      sx,
      sy,
      worldVerts: real.dirichletPoly.vertsH.map((v) => normTime(apply3(CM, v))),
      fill: tileUniformFill(coloring, t, real)
    };
  });
  sortStationaryDrawList(drawList);

  for (let i = 0; i < drawList.length; i++) {
    drawPolygonPath(ctx, toPx, drawList[i].worldVerts);
    ctx.fillStyle = drawList[i].fill;
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(26, 26, 31, 0.22)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < drawList.length; i++) {
    drawPolygonPath(ctx, toPx, drawList[i].worldVerts);
    ctx.stroke();
  }

  const activeMarkers = real.dirichletPoly.markers || real.markers || [];
  if (activeMarkers.length > 0) {
    const buckets = new Map();
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const CM = t.CM || mul3(state.cameraM, t.M);
      for (const mk of activeMarkers) {
        const dp = poincare(normTime(apply3(CM, mk.P)));
        const rDisk = Math.hypot(dp[0], dp[1]);
        if (rDisk > 0.90) continue;
        const [px, py] = toPx(dp);
        if (!dedupScreenMarker(buckets, px, py, mk.kind, mk.order, mk.featureId)) continue;
        const scale = Math.max(0.55, 1.0 - 0.45 * rDisk);
        drawMarker(ctx, px, py, mk, scale, coneSideForPartition(hoveredPartIdx, mk.featureId));
      }
    }
  }

  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = "#1a1a1f";
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function scheduleDiskRender(fast = false) {
  if (fast) {
    if (state.rafId === null) {
      state.rafId = requestAnimationFrame(() => {
        state.rafId = null;
        renderDisk(950);
      });
    }
    clearTimeout(state.refineTimer);
    state.refineTimer = setTimeout(() => renderDisk(2200), 130);
  } else {
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    clearTimeout(state.refineTimer);
    renderDisk(2200);
  }
}

// ---------------------------------------------------------------------------
// Simultaneous 3-partition slider controls
// ---------------------------------------------------------------------------

const formatTwist = (v) => {
  const c = Math.abs(v) < 0.005 ? 0 : v;
  return c >= 0 ? `+${c.toFixed(2)}` : c.toFixed(2);
};

function renderStatusAndMeta() {
  const orb = state.orb;
  if (!orb || !orb.ok) {
    els.orbMeta.textContent = "";
    els.statusBanner.hidden = false;
    els.statusBanner.className = "status-banner is-error";
    els.statusBanner.textContent = orb?.error || "Invalid PQRS signature.";
    return;
  }

  els.statusBanner.hidden = true;
  const chiStr = orb.chiStr.replace("-", "−");
  els.orbMeta.textContent =
    orb.geometry === "euclidean"
      ? `${orb.canonical} · χ = 0 · Euclidean · 2D`
      : `${orb.canonical} · χ = ${chiStr} · 2D`;
}

function updateColorSelectLabels() {
  if (!els.colorSelect) return;
  const qOpt = els.colorSelect.querySelector('option[value="quotient"]');
  if (qOpt) {
    const qSize = state.pqrs?.quotientSize;
    qOpt.textContent = qSize ? `Quotient (${qSize}-color)` : "Quotient (4-color)";
  }
}

function syncHoverVisuals() {
  for (const card of state.cards) {
    card.group.classList.toggle("is-hovered", card.partIdx === state.hoveredPartIdx);
  }
}

function syncAllSliders(skipPartIdx = -1) {
  if (!state.pqrs) return;
  for (let k = 0; k < state.cards.length; k++) {
    const card = state.cards[k];
    const { ell, theta } = state.pqrs.coords[k];
    card.lenVal.textContent = ell.toFixed(2);
    card.twVal.textContent = formatTwist(theta);
    if (k === skipPartIdx) continue;

    if (ell < parseFloat(card.lenInput.min)) {
      card.lenInput.min = String(Math.max(0.05, Math.floor(ell * 10) / 10 - 0.1));
    }
    if (ell > parseFloat(card.lenInput.max)) {
      card.lenInput.max = String(Math.ceil(ell * 10) / 10 + 0.5);
    }
    card.lenInput.value = String(ell);

    if (theta < parseFloat(card.twInput.min)) {
      card.twInput.min = String(Math.floor(theta * 10) / 10 - 0.2);
    }
    if (theta > parseFloat(card.twInput.max)) {
      card.twInput.max = String(Math.ceil(theta * 10) / 10 + 0.2);
    }
    card.twInput.value = String(theta);
  }
}

function finishActiveDrag() {
  if (state.pqrs && state.activeAlign !== null) {
    const rec = recenterPqrsState(state.pqrs);
    if (rec.state !== state.pqrs) {
      state.pqrs = rec.state;
      if (state.pqrs.geometry === "euclidean") {
        state.cameraM = emul3(state.cameraM, rec.camComp);
      } else {
        state.cameraM = reorthonormalizeLorentz(mul3(state.cameraM, rec.camComp));
      }
      if (rec.state.realization?.pullColorXor) {
        state.cameraColor = (state.cameraColor ^ rec.state.realization.pullColorXor) & 3;
      }
      syncAllSliders(-1);
    }
  }
  state.activeDragPart = null;
  state.activeAlign = null;
}

function renderPartitionCards() {
  els.slidersHost.innerHTML = "";
  state.cards = [];
  const orb = state.orb;

  if (!orb || !orb.ok || (orb.geometry !== "hyperbolic" && orb.geometry !== "euclidean")) {
    els.controlsCol.hidden = true;
    return;
  }

  els.controlsCol.hidden = false;
  const orders = orb.orders;

  PQRS_PARTITIONS.forEach((part, k) => {
    const group = document.createElement("div");
    group.className = `cut-group ${state.hoveredPartIdx === k ? "is-hovered" : ""}`;
    group.dataset.partIndex = String(k);
    group.style.borderLeftColor = part.color;

    let pointerHovered = false;
    let activeDrag = false;
    const syncHoverForCard = () => {
      const target =
        pointerHovered || activeDrag
          ? k
          : state.hoveredPartIdx === k
          ? null
          : state.hoveredPartIdx;
      if (state.hoveredPartIdx !== target) {
        state.hoveredPartIdx = target;
        syncHoverVisuals();
        scheduleDiskRender(false);
      }
    };

    group.addEventListener("mouseenter", () => {
      pointerHovered = true;
      syncHoverForCard();
    });
    group.addEventListener("mouseleave", () => {
      pointerHovered = false;
      syncHoverForCard();
    });

    const head = document.createElement("div");
    head.className = "cut-head";

    const title = document.createElement("span");
    title.className = "cut-title";
    const dot = document.createElement("span");
    dot.className = "cut-dot";
    dot.style.background = part.color;
    title.append(dot, part.name);

    const pair = document.createElement("span");
    pair.className = "cut-pair";
    const sideASpan = document.createElement("span");
    sideASpan.className = "pair-side-a";
    sideASpan.textContent = `${PQRS_LETTERS[part.sideA[0]]}:${orders[part.sideA[0]]} ${PQRS_LETTERS[part.sideA[1]]}:${orders[part.sideA[1]]}`;
    const sepSpan = document.createElement("span");
    sepSpan.className = "pair-sep";
    sepSpan.textContent = "|";
    const sideBSpan = document.createElement("span");
    sideBSpan.className = "pair-side-b";
    sideBSpan.textContent = `${PQRS_LETTERS[part.sideB[0]]}:${orders[part.sideB[0]]} ${PQRS_LETTERS[part.sideB[1]]}:${orders[part.sideB[1]]}`;
    pair.append(sideASpan, sepSpan, sideBSpan);

    head.append(title, pair);
    group.append(head);

    const { ell, theta } = state.pqrs.coords[k];

    const makeRangeRow = (symText, minVal, maxVal, initVal, ariaLabel, isTwist) => {
      const row = document.createElement("div");
      row.className = "param-row";
      const sym = document.createElement("span");
      sym.className = "param-sym";
      sym.textContent = symText;

      const input = document.createElement("input");
      input.type = "range";
      input.className = "fn-range";
      input.min = String(Math.min(minVal, isTwist ? Math.floor(initVal * 10) / 10 - 0.2 : Math.max(0.05, Math.floor(initVal * 10) / 10 - 0.1)));
      input.max = String(Math.max(maxVal, isTwist ? Math.ceil(initVal * 10) / 10 + 0.2 : Math.ceil(initVal * 10) / 10 + 0.5));
      input.step = "any";
      input.value = String(initVal);
      input.style.accentColor = part.color;
      input.setAttribute("aria-label", ariaLabel);

      const valEl = document.createElement("span");
      valEl.className = "param-val";
      valEl.textContent = isTwist ? formatTwist(initVal) : initVal.toFixed(2);

      const beginDrag = () => {
        activeDrag = true;
        if (state.activeDragPart !== k || !state.activeAlign) {
          state.activeDragPart = k;
          state.activeAlign = computeDragAlign(state.pqrs, k);
        }
        syncHoverForCard();
      };
      const endDrag = () => {
        activeDrag = false;
        finishActiveDrag();
        syncHoverForCard();
      };

      input.addEventListener("pointerdown", beginDrag);
      input.addEventListener("pointerup", endDrag);
      input.addEventListener("pointercancel", endDrag);
      input.addEventListener("blur", endDrag);
      input.addEventListener("input", () => {
        if (state.activeDragPart !== k || !state.activeAlign) {
          state.activeDragPart = k;
          state.activeAlign = computeDragAlign(state.pqrs, k);
        }
        const curCoords = state.pqrs.coords[k];
        const rawVal = parseFloat(input.value);
        const nextEll = isTwist ? curCoords.ell : rawVal;
        const nextTheta = isTwist ? rawVal : curCoords.theta;
        state.pqrs = deformPqrsPartition(state.pqrs, k, nextEll, nextTheta, state.activeAlign);
        if (state.pqrs.realization?.pullColorXor) {
          state.cameraColor = (state.cameraColor ^ state.pqrs.realization.pullColorXor) & 3;
        }
        syncAllSliders(k);
        scheduleDiskRender(true);
      });
      input.addEventListener("change", () => {
        endDrag();
        scheduleDiskRender(false);
      });

      row.append(sym, input, valEl);
      return { row, input, valEl };
    };

    const lenRow = makeRangeRow("ℓ", 0.25, 7.0, ell, `${part.name} length`, false);
    const twRow = makeRangeRow("θ", -1.0, 1.0, theta, `${part.name} twist`, true);
    group.append(lenRow.row, twRow.row);
    els.slidersHost.append(group);

    state.cards.push({
      partIdx: k,
      group,
      lenInput: lenRow.input,
      lenVal: lenRow.valEl,
      twInput: twRow.input,
      twVal: twRow.valEl
    });
  });
}

function renderAllViews(resetCamera = false) {
  if (resetCamera) {
    state.cameraM = identityCamera(state.orb);
    state.cameraWrapped = false;
    state.cameraColor = 0;
  }
  renderStatusAndMeta();
  updateColorSelectLabels();
  renderPartitionCards();
  scheduleDiskRender(false);
}

function loadSignature(rawSig, pushUrl = true) {
  const parsed = parsePqrs(rawSig);
  state.orb = parsed;
  state.hoveredPartIdx = null;
  state.activeDragPart = null;
  state.activeAlign = null;

  if (parsed.ok) {
    els.sigInput.value = parsed.canonical;
    if (pushUrl) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("orb", parsed.canonical);
        window.history.replaceState(null, "", url.toString());
      } catch {}
    }
    state.pqrs = createPqrsState(parsed);
  } else {
    state.pqrs = null;
  }

  renderAllViews(true);
}

// ---------------------------------------------------------------------------
// Events & Camera Panning
// ---------------------------------------------------------------------------

els.sigForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  loadSignature(els.sigInput.value, true);
});

els.colorSelect?.addEventListener("change", () => {
  state.coloring = els.colorSelect.value;
  scheduleDiskRender(false);
});

els.btnReset?.addEventListener("click", () => {
  if (state.orb?.ok) {
    loadSignature(state.orb.canonical, false);
  } else {
    loadSignature("3322", false);
  }
});

if (els.canvas) {
  const activePointers = new Map();
  let dragStartPt = null;
  let dragStartPx = null;
  let dragStartCamera = ID3;

  const clientCoordsToDisk = (cxClient, cyClient) => {
    const rect = els.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const R = rect.width * 0.48;
    let u = (cxClient - cx) / R;
    let v = (cy - cyClient) / R;
    const rad = Math.hypot(u, v);
    if (rad > 0.92) {
      u = (u / rad) * 0.92;
      v = (v / rad) * 0.92;
    }
    return [u, v];
  };

  const resetDragAnchor = () => {
    if (activePointers.size === 0) {
      dragStartPt = null;
      dragStartPx = null;
      return;
    }
    let sx = 0;
    let sy = 0;
    for (const pt of activePointers.values()) {
      sx += pt.x;
      sy += pt.y;
    }
    const mx = sx / activePointers.size;
    const my = sy / activePointers.size;
    dragStartPx = [mx, my];
    dragStartPt = clientCoordsToDisk(mx, my);
    dragStartCamera = state.cameraM;
  };

  els.canvas.addEventListener("pointerdown", (e) => {
    if (!state.pqrs?.realization) return;
    if (state.pqrs.geometry !== "euclidean") {
      const rect = els.canvas.getBoundingClientRect();
      const R = rect.width * 0.48;
      if (Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2)) > R) {
        return;
      }
    }
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      els.canvas.setPointerCapture(e.pointerId);
    } catch {}
    resetDragAnchor();
  });

  els.canvas.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    let sx = 0;
    let sy = 0;
    for (const pt of activePointers.values()) {
      sx += pt.x;
      sy += pt.y;
    }
    const mx = sx / activePointers.size;
    const my = sy / activePointers.size;

    const real = state.pqrs?.realization;
    if (real?.geometry === "euclidean") {
      if (!dragStartPx) return;
      const rect = els.canvas.getBoundingClientRect();
      const scalePx = rect.width / (2 * EUC_VIEW_R);
      const dx = (mx - dragStartPx[0]) / scalePx;
      const dy = -(my - dragStartPx[1]) / scalePx;
      const res = panEuclideanCamera(dragStartCamera, dx, dy, real);
      const nextCam = res.cameraE;
      if (res.wrapped) {
        state.cameraWrapped = true;
        state.cameraColor = (state.cameraColor ^ res.colorXor) & 3;
        dragStartPx = [mx, my];
        dragStartCamera = nextCam;
      }
      state.cameraM = nextCam;
      scheduleDiskRender(true);
      return;
    }

    if (!dragStartPt) return;
    const curPt = clientCoordsToDisk(mx, my);
    const Pstart = liftDisk(dragStartPt[0], dragStartPt[1]);
    const Pcur = liftDisk(curPt[0], curPt[1]);
    const M1 = mobiusTranslateToOrigin(Pstart);
    const M2 = invLorentz(mobiusTranslateToOrigin(Pcur));
    let nextCam = reorthonormalizeLorentz(mul3(mul3(M2, M1), dragStartCamera));
    if (nextCam[2][2] > 120 && real) {
      const wrappedRes = wrapCameraInGroupWithColor(nextCam, real);
      nextCam = wrappedRes.cameraM;
      state.cameraWrapped = true;
      state.cameraColor = (state.cameraColor ^ wrappedRes.colorXor) & 3;
      dragStartPt = curPt;
      dragStartCamera = nextCam;
    }
    state.cameraM = nextCam;
    scheduleDiskRender(true);
  });

  const endDrag = (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.delete(e.pointerId);
    const real = state.pqrs?.realization;
    if (activePointers.size === 0 && real?.geometry === "euclidean") {
      const wrapped = wrapEuclideanCameraWithColor(state.cameraM, real);
      state.cameraM = wrapped.cameraE;
      if (wrapped.colorXor) {
        state.cameraWrapped = true;
        state.cameraColor = (state.cameraColor ^ wrapped.colorXor) & 3;
      }
    }
    resetDragAnchor();
    if (activePointers.size === 0) {
      scheduleDiskRender(false);
    }
  };
  els.canvas.addEventListener("pointerup", endDrag);
  els.canvas.addEventListener("pointercancel", endDrag);

  els.canvas.addEventListener(
    "wheel",
    (e) => {
      const real = state.pqrs?.realization;
      if (!real || e.ctrlKey) return;
      const isEuc = real.geometry === "euclidean";
      const rect = els.canvas.getBoundingClientRect();
      const R = rect.width * 0.48;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (!isEuc && Math.hypot(e.clientX - cx, e.clientY - cy) > R + 4) return;

      e.preventDefault();
      let dxPx = e.deltaX;
      let dyPx = e.deltaY;
      if (e.deltaMode === 1) {
        dxPx *= 16;
        dyPx *= 16;
      } else if (e.deltaMode === 2) {
        dxPx *= rect.height * 0.5;
        dyPx *= rect.height * 0.5;
      }

      if (isEuc) {
        const scalePx = rect.width / (2 * EUC_VIEW_R);
        const dx = -dxPx / scalePx;
        const dy = dyPx / scalePx;
        if (Math.hypot(dx, dy) < 1e-6) return;
        const res = panEuclideanCamera(state.cameraM, dx, dy, real);
        state.cameraM = res.cameraE;
        if (res.wrapped) {
          state.cameraWrapped = true;
          state.cameraColor = (state.cameraColor ^ res.colorXor) & 3;
        }
        scheduleDiskRender(true);
        return;
      }

      const scale = Math.max(120, R * 1.15);
      const du = -dxPx / scale;
      const dv = dyPx / scale;
      if (Math.hypot(du, dv) < 1e-6) return;
      const res = panCameraByDiskDelta(state.cameraM, du, dv, real);
      state.cameraM = res.cameraM;
      if (res.wrapped) {
        state.cameraWrapped = true;
        state.cameraColor = (state.cameraColor ^ res.colorXor) & 3;
      }
      scheduleDiskRender(true);
    },
    { passive: false }
  );

  els.canvas.addEventListener("dblclick", () => {
    state.cameraM = identityCamera(state.orb);
    state.cameraWrapped = false;
    state.cameraColor = 0;
    scheduleDiskRender(false);
  });
}

window.addEventListener("resize", () => scheduleDiskRender(false));

const params = new URLSearchParams(window.location.search);
loadSignature(params.get("orb") || "3322", false);
