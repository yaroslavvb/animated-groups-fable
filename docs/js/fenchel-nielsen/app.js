// Minimal interactive workbench controller for Fenchel-Nielsen orbifold coordinates.

import {
  parseOrbifold,
  createRandomCarving,
  hasMultipleCarvings,
  getCutOptions,
  formatFrac
} from "./orbifold.js?v=fn-v3";

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
  reorthonormalizeLorentz,
  panCameraByDiskDelta,
  wrapCameraInGroup,
  buildRealization,
  generateTiling
} from "./hyperbolic.js?v=fn-v3";

const state = {
  orb: null,
  carving: null,
  realization: null,
  cameraM: ID3,
  cameraWrapped: false,
  hoveredCutId: null,
  refineTimer: null,
  rafId: null
};

const els = {
  sigForm: document.getElementById("sig-form"),
  sigInput: document.getElementById("sig-input"),
  orbMeta: document.getElementById("orb-meta"),
  statusBanner: document.getElementById("status-banner"),
  canvas: document.getElementById("disk-canvas"),
  controlsCol: document.getElementById("controls-col"),
  btnReshuffle: document.getElementById("btn-reshuffle"),
  slidersHost: document.getElementById("sliders-host")
};

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

function cutRoleLabel(cut, opts, orb, carving) {
  if (opts.pairMode === "edge-slot" && cut.pair) {
    const nu = formatItemDisplayName(cut.pair[0], orb, carving);
    const nv = formatItemDisplayName(cut.pair[1], orb, carving);
    return `Edge ${nu}–${nv}`;
  }
  if (cut.pair) {
    const nu = formatItemDisplayName(cut.pair[0], orb, carving);
    const nv = formatItemDisplayName(cut.pair[1], orb, carving);
    return `${nu} + ${nv}`;
  }
  switch (cut.kind) {
    case "handle":
      return "Handle";
    case "crosscap":
      return "Crosscap";
    case "collar":
      return "Collar";
    case "smooth-mirror":
      return "Smooth mirror";
    default:
      return "";
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
  const { hoveredCutId } = state;

  // 1. Tile polygons with orientation parity shading
  for (let ti = 0; ti < tiles.length; ti++) {
    const t = tiles[ti];
    const CM = t.CM || mul3(state.cameraM, t.M);
    const tileDetFlip = t.detPos ? 0 : 1;
    for (let pi = 0; pi < real.fdPolygons.length; pi++) {
      const poly = real.fdPolygons[pi];
      const worldVerts = poly.vertsH.map((v) => normTime(apply3(CM, v)));
      drawPolygonPath(ctx, toPx, worldVerts);
      const p = poly.parity ^ tileDetFlip;
      ctx.fillStyle = p === 0 ? "#e2e7ee" : "#f9f8f4";
      ctx.fill();
      ctx.strokeStyle = "rgba(26, 26, 31, 0.20)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  // 2. Highlight assembled fundamental domain
  if (!state.cameraWrapped) {
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

  // 3. Lifted cut geodesics and twist ticks
  if (real.cutSegments.length > 0) {
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      if (t.r > 0.94) continue;
      const CM = t.CM || mul3(state.cameraM, t.M);
      const isFD = Boolean(t.isFD) && !state.cameraWrapped;
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

    if (!state.cameraWrapped) {
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

  // 4. Cone & corner markers
  if (real.markers.length > 0) {
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const isFD = Boolean(t.isFD) && !state.cameraWrapped;
      if (t.r > 0.72 && !isFD) continue;
      const CM = t.CM || mul3(state.cameraM, t.M);
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
// 2. Minimal UI Rendering: Meta, Status Banner, Reshuffle, Parameter Sliders
// ---------------------------------------------------------------------------

function renderStatusAndMeta() {
  const orb = state.orb;
  if (!orb || !orb.ok) {
    els.orbMeta.textContent = "";
    els.statusBanner.hidden = false;
    els.statusBanner.className = "status-banner is-error";
    els.statusBanner.textContent = orb?.error || "Invalid orbifold signature.";
    return;
  }

  const chiStr = formatFrac(orb.chi).replace("-", "−");
  if (orb.geometry === "hyperbolic") {
    els.statusBanner.hidden = true;
    els.orbMeta.textContent =
      orb.teichDim === 0
        ? `${orb.canonical} · χ = ${chiStr} · Rigid (0D)`
        : `${orb.canonical} · χ = ${chiStr} · ${orb.teichDim}D`;
    return;
  }

  const geom = orb.geometry === "spherical" ? "Spherical" : "Euclidean";
  els.orbMeta.textContent = `${orb.canonical} · χ = ${chiStr} · ${geom}`;
  els.statusBanner.hidden = false;
  els.statusBanner.className = "status-banner";
  els.statusBanner.textContent = "";

  const msg = document.createElement("span");
  const strongSig = document.createElement("strong");
  strongSig.textContent = orb.canonical;
  const strongGeom = document.createElement("strong");
  strongGeom.textContent = `${geom} (χ = ${chiStr})`;
  msg.append(
    strongSig,
    " is ",
    strongGeom,
    ` with cost ${formatFrac(orb.cost)} — hyperbolic coordinates require χ < 0.`
  );
  els.statusBanner.append(msg);

  if (orb.suggestion) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-primary";
    btn.textContent = `Try ${orb.suggestion} →`;
    btn.addEventListener("click", () => loadSignature(orb.suggestion));
    els.statusBanner.append(btn);
  }
}

function updateReshuffleButton() {
  const orb = state.orb;
  const carving = state.carving;
  if (!orb?.ok || orb.geometry !== "hyperbolic" || !carving || carving.cuts.length === 0) {
    els.btnReshuffle.hidden = true;
    return;
  }
  const canReshuffle = hasMultipleCarvings(orb, carving);
  els.btnReshuffle.hidden = false;
  els.btnReshuffle.disabled = !canReshuffle;
  els.btnReshuffle.title = canReshuffle
    ? "Pick a different random carving"
    : "Only one carving exists for this orbifold";
}

function renderSliders() {
  els.slidersHost.innerHTML = "";
  const orb = state.orb;
  const carving = state.carving;

  if (!orb?.ok || orb.geometry !== "hyperbolic") {
    els.controlsCol.hidden = true;
    updateReshuffleButton();
    return;
  }

  els.controlsCol.hidden = false;
  updateReshuffleButton();

  if (!carving || carving.cuts.length === 0) {
    const note = document.createElement("p");
    note.className = "rigid-note";
    note.textContent = `${orb.canonical} is rigid (0 parameters).`;
    els.slidersHost.append(note);
    return;
  }

  carving.cuts.forEach((cut, idx) => {
    const opts = getCutOptions(orb, carving, idx);
    const group = document.createElement("div");
    group.className = `cut-group ${state.hoveredCutId === cut.id ? "is-hovered" : ""}`;
    group.dataset.cutId = cut.id;
    group.style.borderLeftColor = cut.color;

    group.addEventListener("mouseenter", () => {
      state.hoveredCutId = cut.id;
      syncHoverVisuals();
      scheduleDiskRender(false);
    });
    group.addEventListener("mouseleave", () => {
      if (state.hoveredCutId === cut.id) {
        state.hoveredCutId = null;
        syncHoverVisuals();
        scheduleDiskRender(false);
      }
    });

    const head = document.createElement("div");
    head.className = "cut-head";

    const title = document.createElement("span");
    title.className = "cut-title";
    const dot = document.createElement("span");
    dot.className = "cut-dot";
    dot.style.background = cut.color;
    title.append(dot, cut.name);

    const pair = document.createElement("span");
    pair.className = "cut-pair";
    pair.textContent = cutRoleLabel(cut, opts, orb, carving);

    head.append(title, pair);
    group.append(head);

    // Length / arc / core-step slider
    const isArcOrCrosscap =
      cut.kind === "crosscap" ||
      cut.kind === "mirror-arc" ||
      cut.kind === "cone-mirror-arc" ||
      cut.kind === "bridge-arc";
    const lenSymText = isArcOrCrosscap ? "d" : "ℓ";

    const lenRow = document.createElement("div");
    lenRow.className = "param-row";
    const lenSym = document.createElement("span");
    lenSym.className = "param-sym";
    lenSym.textContent = lenSymText;

    const lenInput = document.createElement("input");
    lenInput.type = "range";
    lenInput.className = "fn-range";
    lenInput.min = cut.kind === "crosscap" ? "0.15" : "0.25";
    lenInput.max = cut.kind === "crosscap" ? "2.75" : "5.5";
    lenInput.step = "0.01";
    lenInput.value = String(cut.length);
    lenInput.style.accentColor = cut.color;
    lenInput.setAttribute("aria-label", `${cut.name} ${lenSymText}`);

    const lenVal = document.createElement("span");
    lenVal.className = "param-val";
    lenVal.textContent = cut.length.toFixed(2);

    lenInput.addEventListener("input", () => {
      cut.length = parseFloat(lenInput.value);
      lenVal.textContent = cut.length.toFixed(2);
      state.realization = buildRealization(state.orb, state.carving);
      scheduleDiskRender(true);
    });
    lenInput.addEventListener("change", () => scheduleDiskRender(false));

    lenRow.append(lenSym, lenInput, lenVal);
    group.append(lenRow);

    // Twist slider (when applicable)
    if (cut.hasTwist) {
      const twRow = document.createElement("div");
      twRow.className = "param-row";
      const twSym = document.createElement("span");
      twSym.className = "param-sym";
      twSym.textContent = "θ";

      const twInput = document.createElement("input");
      twInput.type = "range";
      twInput.className = "fn-range";
      twInput.min = "-1";
      twInput.max = "1";
      twInput.step = "0.005";
      twInput.value = String(cut.twistTurns);
      twInput.style.accentColor = cut.color;
      twInput.setAttribute("aria-label", `${cut.name} twist`);

      const formatTw = (v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
      const twVal = document.createElement("span");
      twVal.className = "param-val";
      twVal.textContent = formatTw(cut.twistTurns);

      twInput.addEventListener("input", () => {
        cut.twistTurns = parseFloat(twInput.value);
        twVal.textContent = formatTw(cut.twistTurns);
        state.realization = buildRealization(state.orb, state.carving);
        scheduleDiskRender(true);
      });
      twInput.addEventListener("change", () => scheduleDiskRender(false));

      twRow.append(twSym, twInput, twVal);
      group.append(twRow);
    }

    els.slidersHost.append(group);
  });
}

function syncHoverVisuals() {
  for (const el of els.slidersHost.querySelectorAll(".cut-group")) {
    el.classList.toggle("is-hovered", el.dataset.cutId === state.hoveredCutId);
  }
}

function renderAllViews(resetCamera = false) {
  if (resetCamera) {
    state.cameraM = ID3;
    state.cameraWrapped = false;
  }
  renderStatusAndMeta();
  renderSliders();
  scheduleDiskRender(false);
}

function loadSignature(rawSig, pushUrl = true) {
  const parsed = parseOrbifold(rawSig);
  state.orb = parsed;
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
    state.carving = createRandomCarving(parsed);
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

els.btnReshuffle?.addEventListener("click", () => {
  if (!state.orb?.ok || state.orb.geometry !== "hyperbolic") return;
  state.hoveredCutId = null;
  state.carving = createRandomCarving(state.orb, state.carving);
  state.realization = buildRealization(state.orb, state.carving);
  state.cameraM = ID3;
  state.cameraWrapped = false;
  renderSliders();
  scheduleDiskRender(false);
});

if (els.canvas) {
  const activePointers = new Map();
  let dragStartPt = null;
  let dragStartCamera = null;

  const clientCoordsToDisk = (clientX, clientY) => {
    const rect = els.canvas.getBoundingClientRect();
    const R = rect.width * 0.48;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let u = (clientX - cx) / R;
    let v = -(clientY - cy) / R;
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
      dragStartCamera = null;
      return;
    }
    let sx = 0;
    let sy = 0;
    for (const p of activePointers.values()) {
      sx += p.clientX;
      sy += p.clientY;
    }
    dragStartPt = clientCoordsToDisk(sx / activePointers.size, sy / activePointers.size);
    dragStartCamera = state.cameraM;
  };

  els.canvas.addEventListener("pointerdown", (e) => {
    if (!state.realization) return;
    els.canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    resetDragAnchor();
  });

  els.canvas.addEventListener("pointermove", (e) => {
    if (!dragStartPt || !activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    let sx = 0;
    let sy = 0;
    for (const p of activePointers.values()) {
      sx += p.clientX;
      sy += p.clientY;
    }
    const curPt = clientCoordsToDisk(sx / activePointers.size, sy / activePointers.size);
    const Pstart = liftDisk(dragStartPt[0], dragStartPt[1]);
    const Pcur = liftDisk(curPt[0], curPt[1]);
    const M1 = mobiusTranslateToOrigin(Pstart);
    const M2 = invLorentz(mobiusTranslateToOrigin(Pcur));
    let nextCam = reorthonormalizeLorentz(mul3(mul3(M2, M1), dragStartCamera));
    if (nextCam[2][2] > 120 && state.realization) {
      nextCam = wrapCameraInGroup(nextCam, state.realization);
      state.cameraWrapped = true;
      dragStartPt = curPt;
      dragStartCamera = nextCam;
    }
    state.cameraM = nextCam;
    scheduleDiskRender(true);
  });

  const endDrag = (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.delete(e.pointerId);
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
      if (!state.realization || e.ctrlKey) return;
      const rect = els.canvas.getBoundingClientRect();
      const R = rect.width * 0.48;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (Math.hypot(e.clientX - cx, e.clientY - cy) > R + 4) return;

      e.preventDefault();
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
      } else if (e.deltaMode === 2) {
        dx *= rect.height * 0.5;
        dy *= rect.height * 0.5;
      }
      const scale = Math.max(120, R * 1.15);
      const du = -dx / scale;
      const dv = dy / scale;
      if (Math.hypot(du, dv) < 1e-6) return;
      const res = panCameraByDiskDelta(state.cameraM, du, dv, state.realization);
      state.cameraM = res.cameraM;
      if (res.wrapped) state.cameraWrapped = true;
      scheduleDiskRender(true);
    },
    { passive: false }
  );

  els.canvas.addEventListener("dblclick", () => {
    state.cameraM = ID3;
    state.cameraWrapped = false;
    scheduleDiskRender(false);
  });
}

window.addEventListener("resize", () => scheduleDiskRender(false));

// Initial boot
const params = new URLSearchParams(window.location.search);
loadSignature(params.get("orb") || "3322", false);
