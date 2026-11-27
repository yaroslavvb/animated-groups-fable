// Minimal interactive workbench controller for Fenchel-Nielsen orbifold coordinates.

import {
  parseOrbifold,
  createDefaultCarving,
  createRandomCarving,
  hasMultipleCarvings,
  getCutOptions,
  getCutMarkerSides,
  formatFrac
} from "./orbifold.js?v=fn-v9";

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
  slideFrame,
  mobiusTranslateToOrigin,
  reorthonormalizeLorentz,
  panCameraByDiskDelta,
  wrapCameraInGroupWithColor,
  wrapPointIntoTileI,
  buildRealization,
  generateTiling,
  recutHyperbolic
} from "./hyperbolic.js?v=fn-v9";

import {
  EID3,
  emul3,
  edet3,
  eapply,
  buildEuclideanRealization,
  generateEuclideanTiling,
  panEuclideanCamera,
  wrapEuclideanCameraWithColor,
  wrapPointIntoEucFD,
  recutEuclidean
} from "./euclidean.js?v=fn-v9";

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

const PIECE_COLORS = [
  ["#cfe0f2", "#eaf2fa"],
  ["#f2d8b6", "#fbf0e1"],
  ["#cde6d5", "#eaf6ee"],
  ["#e0d0ee", "#f3ecf9"],
  ["#f2cfd4", "#faeaec"],
  ["#cbe6ea", "#e8f5f7"]
];

const state = {
  orb: null,
  carving: null,
  realization: null,
  coloring: "parity",
  cameraM: ID3,
  cameraWrapped: false,
  cameraColor: 0,
  parityFlip: 0,
  hoveredCutId: null,
  selectedCutId: null,
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
  btnReshuffle: document.getElementById("btn-reshuffle"),
  slidersHost: document.getElementById("sliders-host")
};

function isSupportedGeometry(orb) {
  return Boolean(orb?.ok && (orb.geometry === "hyperbolic" || orb.geometry === "euclidean"));
}

function identityCamera(orb) {
  return orb?.geometry === "euclidean" ? EID3 : ID3;
}

function formatItemDisplayName(id, orb, carving) {
  const cut = carving.cuts.find((c) => c.id === id);
  if (cut) return cut.name;
  if (id === "e1") return "e₁";
  if (id === "e2") return "e₂";
  if (id === "e3") return "e₃";
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
// 1. Canvas Poincaré Disk & Euclidean Plane Renderer
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

function drawEucPolygonPath(ctx, toPx, vertsE) {
  ctx.beginPath();
  for (let i = 0; i < vertsE.length; i++) {
    const [px, py] = toPx(vertsE[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHyperbolicEdge(ctx, toPx, u, w) {
  const pu = poincare(u);
  const pw = poincare(w);
  const d = Math.hypot(pu[0] - pw[0], pu[1] - pw[1]);
  const steps = d > 0.35 ? 10 : d > 0.14 ? 6 : 3;
  const samples = geodesicSamples(u, w, steps);
  ctx.beginPath();
  for (let s = 0; s < samples.length; s++) {
    const [px, py] = toPx(samples[s]);
    if (s === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawFdHighlight(ctx, real, cameraM, toPx, isEuc) {
  ctx.save();
  ctx.strokeStyle = "rgba(26, 26, 31, 0.72)";
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (real.dirichletPoly) {
    const verts = isEuc
      ? real.dirichletPoly.vertsE.map((v) => eapply(cameraM, v))
      : real.dirichletPoly.vertsH.map((v) => normTime(apply3(cameraM, v)));
    if (isEuc) drawEucPolygonPath(ctx, toPx, verts);
    else drawPolygonPath(ctx, toPx, verts);
    ctx.stroke();
  } else {
    for (let pi = 0; pi < real.fdPolygons.length; pi++) {
      const p = real.fdPolygons[pi];
      const verts = isEuc
        ? p.vertsE.map((v) => eapply(cameraM, v))
        : p.vertsH.map((v) => normTime(apply3(cameraM, v)));
      for (let e = 0; e < verts.length; e++) {
        if (p.isExteriorEdge && p.isExteriorEdge[e] === false) continue;
        const u = verts[e];
        const w = verts[(e + 1) % verts.length];
        if (isEuc) {
          const [x0, y0] = toPx(u);
          const [x1, y1] = toPx(w);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        } else {
          drawHyperbolicEdge(ctx, toPx, u, w);
        }
      }
    }
  }
  ctx.restore();
}

function sortStationaryDrawList(drawList) {
  drawList.sort((a, b) => {
    const ra = Math.round((a.sy + 0.137) * 0.25);
    const rb = Math.round((b.sy + 0.137) * 0.25);
    return ra !== rb ? ra - rb : a.sx - b.sx;
  });
}

function stationaryRefEuc(real) {
  if (real.dirichletPoly) {
    if (real.dirichletBase) return real.dirichletBase;
    const vs = real.dirichletPoly.vertsE;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < vs.length; i++) {
      sx += vs[i][0];
      sy += vs[i][1];
    }
    return vs.length > 0 ? [sx / vs.length, sy / vs.length] : [0, 0];
  }
  const uniq = [];
  for (const poly of real.fdPolygons) {
    for (const v of poly.vertsE) {
      if (!uniq.some((u) => Math.hypot(u[0] - v[0], u[1] - v[1]) < 1e-4)) {
        uniq.push(v);
      }
    }
  }
  if (uniq.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const u of uniq) {
    sx += u[0];
    sy += u[1];
  }
  return [sx / uniq.length, sy / uniq.length];
}

function stationaryRefHyp(real) {
  if (real.dirichletPoly) {
    return real.dirichletBase || real.dirichletPoly.centroid;
  }
  const uniq = [];
  for (const poly of real.fdPolygons) {
    for (const v of poly.vertsH) {
      const pv = poincare(v);
      if (!uniq.some((u) => Math.hypot(u.pv[0] - pv[0], u.pv[1] - pv[1]) < 1e-4)) {
        uniq.push({ v, pv });
      }
    }
  }
  if (uniq.length === 0) return [0, 0, 1];
  let sx = 0;
  let sy = 0;
  let st = 0;
  for (const u of uniq) {
    sx += u.v[0];
    sy += u.v[1];
    st += u.v[2];
  }
  return normTime([sx, sy, st]);
}

function tileUniformFill(coloring, t, poly, real, hasOrientRev) {
  if (coloring === "quotient") {
    return QUOTIENT_COLORS[(t.color ?? 0) & 3][0];
  }
  if (coloring === "none") {
    return "#f7f6f1";
  }
  if (hasOrientRev) {
    return t.detPos !== Boolean(state.parityFlip) ? "#e2e7ee" : "#f9f8f4";
  }
  if ((real.quotient?.quotientSize ?? 1) >= 2) {
    return ((t.color ?? 0) & 1) === 0 ? "#e2e7ee" : "#f9f8f4";
  }
  return ((poly?.parity ?? 0) ^ (t.detPos ? 0 : 1)) === 0 ? "#e2e7ee" : "#f9f8f4";
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

function pickDefaultSelectedCutId(orb, carving) {
  if (!orb || !carving?.cuts?.length) return null;
  for (const cut of carving.cuts) {
    const sides = getCutMarkerSides(orb, carving, cut.id);
    if (sides && sides.sideA.size > 0 && sides.sideB.size > 0) return cut.id;
  }
  return null;
}

function getActiveHighlightCutId() {
  return state.hoveredCutId ?? state.selectedCutId;
}

function getHoverMarkerContext(hoveredCutId) {
  const hoverSides =
    hoveredCutId && state.orb && state.carving
      ? getCutMarkerSides(state.orb, state.carving, hoveredCutId)
      : null;
  const hasTwoSidedMarkers = Boolean(hoverSides && hoverSides.sideA.size > 0 && hoverSides.sideB.size > 0);
  return { hoverSides, hasTwoSidedMarkers };
}

function markerSideOf(hoverSides, mk) {
  if (!hoverSides || !mk.featureId) return null;
  if (hoverSides.sideA.has(mk.featureId)) return 0;
  if (hoverSides.sideB.has(mk.featureId)) return 1;
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
  if (mk.kind === "corner") {
    ctx.fillStyle = isMarked ? SIDE_COLORS[side] : "#ffffff";
    ctx.strokeStyle = isMarked ? "#ffffff" : IDLE_MARKER_INK;
    ctx.lineWidth = isMarked ? 1.6 : 1.75;
    ctx.beginPath();
    ctx.arc(x, y, r * (isMarked ? 0.94 : 0.92), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
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
  }
  ctx.restore();
}

function renderEuclideanCanvas(ctx, size, real, maxPolys) {
  const cx = size / 2;
  const cy = size / 2;
  const scalePx = size / (2 * EUC_VIEW_R);
  const toPx = ([x, y]) => [cx + x * scalePx, cy - y * scalePx];
  const { hoveredCutId, coloring } = state;
  const { hoverSides } = getHoverMarkerContext(getActiveHighlightCutId());
  const { hasTwoSidedMarkers: hoveredHasTwoSided } = getHoverMarkerContext(hoveredCutId);

  ctx.save();
  ctx.fillStyle = "#f2f1ec";
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.clip();

  const tiles = generateEuclideanTiling(real, state.cameraM, {
    viewRadius: EUC_VIEW_R * 1.9,
    maxTiles: Math.min(maxPolys, 1600),
    cameraColor: state.cameraColor,
    useDirichlet: coloring !== "pieces" && Boolean(real.dirichletPoly)
  });
  const hasOrientRev = real.gens.some((g) => edet3(g.M) < 0);

  if (coloring === "pieces") {
    const pieceIndexById = new Map();
    for (let pi = 0; pi < real.fdPolygons.length; pi++) {
      const pid = real.fdPolygons[pi].pieceId;
      if (!pieceIndexById.has(pid)) pieceIndexById.set(pid, pieceIndexById.size);
    }

    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const CM = t.CM || emul3(state.cameraM, t.M);
      const tileDetFlip = t.detPos ? 0 : 1;
      for (let pi = 0; pi < real.fdPolygons.length; pi++) {
        const poly = real.fdPolygons[pi];
        const worldVerts = poly.vertsE.map((v) => eapply(CM, v));
        drawEucPolygonPath(ctx, toPx, worldVerts);
        const pIdx = pieceIndexById.get(poly.pieceId) ?? 0;
        const pair = PIECE_COLORS[pIdx % PIECE_COLORS.length];
        ctx.fillStyle = pair[(poly.parity ?? 0) ^ tileDetFlip];
        ctx.fill();
        ctx.strokeStyle = "rgba(26, 26, 31, 0.22)";
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }
    }

    if (!state.cameraWrapped) {
      for (let pi = 0; pi < real.fdPolygons.length; pi++) {
        const poly = real.fdPolygons[pi];
        const worldVerts = poly.vertsE.map((v) => eapply(state.cameraM, v));
        drawEucPolygonPath(ctx, toPx, worldVerts);
        ctx.strokeStyle = "rgba(26, 26, 31, 0.55)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const CM = t.CM || emul3(state.cameraM, t.M);
      const isFD = Boolean(t.isFD) && !state.cameraWrapped;
      for (const seg of real.cutSegments) {
        ctx.save();
        ctx.beginPath();
        const samples = seg.samples || [seg.A, seg.B];
        for (let k = 0; k < samples.length; k++) {
          const [px, py] = toPx(eapply(CM, samples[k]));
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = seg.color;
        ctx.globalAlpha = isFD ? 0.88 : 0.48;
        ctx.lineWidth = isFD ? 2.2 : 1.2;
        ctx.lineCap = "round";
        if (seg.isMirrorWall) ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (!state.cameraWrapped) {
      for (const seg of real.cutSegments) {
        if (!seg.twistTicks || !seg.tickBase || !seg.tickNormal) continue;
        const b0 = eapply(state.cameraM, seg.tickBase);
        const e0 = eapply(state.cameraM, [
          seg.tickBase[0] + seg.tickNormal[0],
          seg.tickBase[1] + seg.tickNormal[1]
        ]);
        const b1 = eapply(state.cameraM, seg.tickEnd || seg.tickBase);
        const e1 = eapply(state.cameraM, [
          (seg.tickEnd || seg.tickBase)[0] - seg.tickNormal[0],
          (seg.tickEnd || seg.tickBase)[1] - seg.tickNormal[1]
        ]);
        for (const [a, b] of [[b0, e0], [b1, e1]]) {
          const [x0, y0] = toPx(a);
          const [x1, y1] = toPx(b);
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
  } else {
    // Stationary modes (parity, quotient, none): 2-pass screen-sorted fill then border stroke
    const refE = stationaryRefEuc(real);
    const drawList = [];
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const CM = t.CM || emul3(state.cameraM, t.M);
      const [sx, sy] = toPx(eapply(CM, refE));
      if (real.dirichletPoly) {
        drawList.push({
          sx,
          sy,
          worldVerts: real.dirichletPoly.vertsE.map((v) => eapply(CM, v)),
          fill: tileUniformFill(coloring, t, real.dirichletPoly, real, hasOrientRev)
        });
      } else {
        drawList.push({
          sx,
          sy,
          polys: real.fdPolygons.map((poly) => ({
            worldVerts: poly.vertsE.map((v) => eapply(CM, v)),
            fill: tileUniformFill(coloring, t, poly, real, hasOrientRev),
            ext: poly.isExteriorEdge
          }))
        });
      }
    }
    sortStationaryDrawList(drawList);

    // Pass 1: fills (and interior triangulation seam seals)
    for (let di = 0; di < drawList.length; di++) {
      const item = drawList[di];
      if (real.dirichletPoly) {
        drawEucPolygonPath(ctx, toPx, item.worldVerts);
        ctx.fillStyle = item.fill;
        ctx.fill();
      } else {
        for (let pi = 0; pi < item.polys.length; pi++) {
          const p = item.polys[pi];
          drawEucPolygonPath(ctx, toPx, p.worldVerts);
          ctx.fillStyle = p.fill;
          ctx.fill();
          if (p.ext) {
            ctx.strokeStyle = p.fill;
            ctx.lineWidth = 0.85;
            for (let e = 0; e < p.worldVerts.length; e++) {
              if (p.ext[e] !== false) continue;
              const [x0, y0] = toPx(p.worldVerts[e]);
              const [x1, y1] = toPx(p.worldVerts[(e + 1) % p.worldVerts.length]);
              ctx.beginPath();
              ctx.moveTo(x0, y0);
              ctx.lineTo(x1, y1);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Pass 2: exterior cell borders
    ctx.strokeStyle = "rgba(26, 26, 31, 0.22)";
    ctx.lineWidth = 0.75;
    for (let di = 0; di < drawList.length; di++) {
      const item = drawList[di];
      if (real.dirichletPoly) {
        drawEucPolygonPath(ctx, toPx, item.worldVerts);
        ctx.stroke();
      } else {
        for (let pi = 0; pi < item.polys.length; pi++) {
          const p = item.polys[pi];
          for (let e = 0; e < p.worldVerts.length; e++) {
            if (p.ext && p.ext[e] === false) continue;
            const [x0, y0] = toPx(p.worldVerts[e]);
            const [x1, y1] = toPx(p.worldVerts[(e + 1) % p.worldVerts.length]);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          }
        }
      }
    }

    drawFdHighlight(ctx, real, state.cameraM, toPx, true);

    if (hoveredCutId && !hoveredHasTwoSided && real.cutSegments.length > 0) {
      for (let ti = 0; ti < tiles.length; ti++) {
        const t = tiles[ti];
        const CM = t.CM || emul3(state.cameraM, t.M);
        for (const seg of real.cutSegments) {
          if (seg.cutId !== hoveredCutId) continue;
          const samples = seg.samples || [seg.A, seg.B];
          ctx.save();
          ctx.beginPath();
          for (let k = 0; k < samples.length; k++) {
            const [px, py] = toPx(eapply(CM, samples[k]));
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = seg.color;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 1.2;
          ctx.lineCap = "round";
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // Cone & corner markers culled and deduplicated by spatial screen buckets
  const activeMarkers =
    coloring !== "pieces" && real.dirichletPoly?.markers?.length ? real.dirichletPoly.markers : real.markers;
  if (activeMarkers.length > 0) {
    const markerBuckets = new Map();
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const CM = t.CM || emul3(state.cameraM, t.M);
      for (const mk of activeMarkers) {
        const [px, py] = toPx(eapply(CM, mk.P));
        if (px < -16 || px > size + 16 || py < -16 || py > size + 16) continue;
        if (!dedupScreenMarker(markerBuckets, px, py, mk.kind, mk.order, mk.featureId)) continue;
        drawMarker(ctx, px, py, mk, 1.0, markerSideOf(hoverSides, mk));
      }
    }
  }

  ctx.restore();
}

function renderDisk(maxPolys = 2200) {
  const cv = els.canvas;
  if (!cv) return;
  const real = state.realization;
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

  if (!real) {
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "#c7c7d1";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }

  const { hoveredCutId, coloring } = state;
  const { hoverSides } = getHoverMarkerContext(getActiveHighlightCutId());
  const { hasTwoSidedMarkers: hoveredHasTwoSided } = getHoverMarkerContext(hoveredCutId);
  const tiles = generateTiling(real, state.cameraM, {
    maxPolys,
    rMax: 0.985,
    cameraColor: state.cameraColor,
    useDirichlet: coloring !== "pieces" && Boolean(real.dirichletPoly)
  });
  const hasOrientRev = real.gens.some((g) => det3(g.M) < 0);

  if (coloring === "pieces") {
    const pieceIndexById = new Map();
    for (let pi = 0; pi < real.fdPolygons.length; pi++) {
      const pid = real.fdPolygons[pi].pieceId;
      if (!pieceIndexById.has(pid)) pieceIndexById.set(pid, pieceIndexById.size);
    }

    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const CM = t.CM || mul3(state.cameraM, t.M);
      const tileDetFlip = t.detPos ? 0 : 1;
      for (let pi = 0; pi < real.fdPolygons.length; pi++) {
        const poly = real.fdPolygons[pi];
        const worldVerts = poly.vertsH.map((v) => normTime(apply3(CM, v)));
        drawPolygonPath(ctx, toPx, worldVerts);
        const pIdx = pieceIndexById.get(poly.pieceId) ?? 0;
        const pair = PIECE_COLORS[pIdx % PIECE_COLORS.length];
        ctx.fillStyle = pair[poly.parity ^ tileDetFlip];
        ctx.fill();
        ctx.strokeStyle = "rgba(26, 26, 31, 0.20)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    if (!state.cameraWrapped) {
      for (let pi = 0; pi < real.fdPolygons.length; pi++) {
        const poly = real.fdPolygons[pi];
        const worldVerts = poly.vertsH.map((v) => normTime(apply3(state.cameraM, v)));
        drawPolygonPath(ctx, toPx, worldVerts);
        ctx.strokeStyle = "rgba(26, 26, 31, 0.55)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

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
          ctx.save();
          ctx.beginPath();
          for (let k = 0; k < pts.length; k++) {
            const [px, py] = toPx(pts[k]);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = seg.color;
          ctx.globalAlpha = isFD ? 0.88 : 0.48;
          ctx.lineWidth = isFD ? 2.2 : 1.2;
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
  } else {
    // Stationary modes (parity, quotient, none): 2-pass screen-sorted fill then border stroke
    const refH = stationaryRefHyp(real);
    const drawList = [];
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const CM = t.CM || mul3(state.cameraM, t.M);
      const [sx, sy] = toPx(poincare(normTime(apply3(CM, refH))));
      if (real.dirichletPoly) {
        drawList.push({
          sx,
          sy,
          worldVerts: real.dirichletPoly.vertsH.map((v) => normTime(apply3(CM, v))),
          fill: tileUniformFill(coloring, t, real.dirichletPoly, real, hasOrientRev)
        });
      } else {
        drawList.push({
          sx,
          sy,
          polys: real.fdPolygons.map((poly) => ({
            worldVerts: poly.vertsH.map((v) => normTime(apply3(CM, v))),
            fill: tileUniformFill(coloring, t, poly, real, hasOrientRev),
            ext: poly.isExteriorEdge
          }))
        });
      }
    }
    sortStationaryDrawList(drawList);

    // Pass 1: fills (and interior triangulation seam seals)
    for (let di = 0; di < drawList.length; di++) {
      const item = drawList[di];
      if (real.dirichletPoly) {
        drawPolygonPath(ctx, toPx, item.worldVerts);
        ctx.fillStyle = item.fill;
        ctx.fill();
      } else {
        for (let pi = 0; pi < item.polys.length; pi++) {
          const p = item.polys[pi];
          drawPolygonPath(ctx, toPx, p.worldVerts);
          ctx.fillStyle = p.fill;
          ctx.fill();
          if (p.ext) {
            ctx.strokeStyle = p.fill;
            ctx.lineWidth = 0.85;
            for (let e = 0; e < p.worldVerts.length; e++) {
              if (p.ext[e] !== false) continue;
              drawHyperbolicEdge(ctx, toPx, p.worldVerts[e], p.worldVerts[(e + 1) % p.worldVerts.length]);
            }
          }
        }
      }
    }

    // Pass 2: exterior cell borders
    ctx.strokeStyle = "rgba(26, 26, 31, 0.22)";
    ctx.lineWidth = real.dirichletPoly ? 0.7 : 0.75;
    for (let di = 0; di < drawList.length; di++) {
      const item = drawList[di];
      if (real.dirichletPoly) {
        drawPolygonPath(ctx, toPx, item.worldVerts);
        ctx.stroke();
      } else {
        for (let pi = 0; pi < item.polys.length; pi++) {
          const p = item.polys[pi];
          for (let e = 0; e < p.worldVerts.length; e++) {
            if (p.ext && p.ext[e] === false) continue;
            drawHyperbolicEdge(ctx, toPx, p.worldVerts[e], p.worldVerts[(e + 1) % p.worldVerts.length]);
          }
        }
      }
    }

    drawFdHighlight(ctx, real, state.cameraM, toPx, false);

    // Subtle dashed hairline on hover only when the cut lacks special points on both sides
    if (hoveredCutId && !hoveredHasTwoSided && real.cutSegments.length > 0) {
      for (let ti = 0; ti < tiles.length; ti++) {
        const t = tiles[ti];
        if (t.r > 0.94) continue;
        const CM = t.CM || mul3(state.cameraM, t.M);
        for (const seg of real.cutSegments) {
          if (seg.cutId !== hoveredCutId) continue;
          const pA = normTime(apply3(CM, seg.A));
          const pB = normTime(apply3(CM, seg.B));
          const dA = poincare(pA);
          const dB = poincare(pB);
          const distDisk = Math.hypot(dA[0] - dB[0], dA[1] - dB[1]);
          if (distDisk < 0.008) continue;

          const pts = geodesicSamples(pA, pB, distDisk > 0.25 ? 12 : 6);
          ctx.save();
          ctx.beginPath();
          for (let k = 0; k < pts.length; k++) {
            const [px, py] = toPx(pts[k]);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = seg.color;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 1.2;
          ctx.lineCap = "round";
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // Cone & corner markers culled, scaled, and deduplicated by spatial screen buckets
  const activeMarkers =
    coloring !== "pieces" && real.dirichletPoly?.markers?.length ? real.dirichletPoly.markers : real.markers;
  if (activeMarkers.length > 0) {
    const markerBuckets = new Map();
    for (let ti = 0; ti < tiles.length; ti++) {
      const t = tiles[ti];
      const CM = t.CM || mul3(state.cameraM, t.M);
      for (const mk of activeMarkers) {
        const dp = poincare(normTime(apply3(CM, mk.P)));
        const rDisk = Math.hypot(dp[0], dp[1]);
        if (rDisk > 0.90) continue;
        const [px, py] = toPx(dp);
        if (!dedupScreenMarker(markerBuckets, px, py, mk.kind, mk.order, mk.featureId)) continue;
        const scale = Math.max(0.55, 1.0 - 0.45 * rDisk);
        drawMarker(ctx, px, py, mk, scale, markerSideOf(hoverSides, mk));
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
  if (orb.geometry === "euclidean") {
    els.statusBanner.hidden = true;
    els.orbMeta.textContent =
      orb.teichDim === 0
        ? `${orb.canonical} · χ = 0 · Euclidean · Rigid (0D)`
        : `${orb.canonical} · χ = 0 · Euclidean · ${orb.teichDim}D`;
    return;
  }

  els.orbMeta.textContent = `${orb.canonical} · χ = ${chiStr} · Spherical`;
  els.statusBanner.hidden = false;
  els.statusBanner.className = "status-banner";
  els.statusBanner.textContent = "";

  const msg = document.createElement("span");
  const strongSig = document.createElement("strong");
  strongSig.textContent = orb.canonical;
  const strongGeom = document.createElement("strong");
  strongGeom.textContent = `Spherical (χ = ${chiStr})`;
  msg.append(
    strongSig,
    " is ",
    strongGeom,
    ` with cost ${formatFrac(orb.cost)} — coordinates require χ ≤ 0.`
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
  if (!isSupportedGeometry(orb) || !carving || carving.cuts.length === 0) {
    els.btnReshuffle.hidden = true;
    return;
  }
  const canReshuffle = hasMultipleCarvings(orb, carving);
  els.btnReshuffle.hidden = false;
  els.btnReshuffle.disabled = !canReshuffle;
  els.btnReshuffle.title = canReshuffle
    ? "Pick a different carving without changing the orbifold"
    : "Only one carving exists for this orbifold";
}

function rebuildOnSliderChange() {
  const orb = state.orb;
  const oldReal = state.realization;
  const isEuc = orb.geometry === "euclidean";
  const oldBase = oldReal?.dirichletBase || null;

  const newReal = isEuc
    ? buildEuclideanRealization(orb, state.carving, { dirichletBase: oldBase })
    : buildRealization(orb, state.carving, { dirichletBase: oldBase });

  const sameGens =
    oldReal?.quotient &&
    oldReal.gens.length === newReal.gens.length &&
    oldReal.quotient.quotientSize === newReal.quotient.quotientSize &&
    oldReal.gens.every((g, i) => g.label === newReal.gens[i].label);

  if (sameGens) {
    newReal.quotient = oldReal.quotient;
    if (newReal.dirichletPoly?.sideGens) {
      const qm = oldReal.quotient.genColorMasks;
      for (const sg of newReal.dirichletPoly.sideGens) {
        if (sg.word) {
          let m = 0;
          for (let wi = 0; wi < sg.word.length; wi++) m ^= qm[sg.word[wi]];
          sg.colorMask = m;
        }
      }
    }
    if (oldBase && newReal.dirichletBase) {
      const wrapped = isEuc
        ? wrapPointIntoEucFD(oldBase, newReal.fdPolygons, newReal.gens, oldReal.quotient.genColorMasks)
        : wrapPointIntoTileI(oldBase, newReal.fdPolygons, newReal.gens, oldReal.quotient.genColorMasks);
      newReal.pullColorXor = wrapped.colorXor;
      newReal.pullDetFlip = wrapped.detFlip || 0;
    }
  }

  state.realization = newReal;
  if (newReal.pullColorXor) {
    state.cameraColor = (state.cameraColor ^ newReal.pullColorXor) & 3;
  }
  if (newReal.pullDetFlip) {
    state.parityFlip ^= newReal.pullDetFlip;
  }
}

function renderSliders() {
  els.slidersHost.innerHTML = "";
  const orb = state.orb;
  const carving = state.carving;

  if (!isSupportedGeometry(orb)) {
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
    group.className = `cut-group ${getActiveHighlightCutId() === cut.id ? "is-hovered" : ""}`;
    group.dataset.cutId = cut.id;
    group.style.borderLeftColor = cut.color;

    let pointerHovered = false;
    let activeDrag = false;
    const syncHoverForGroup = () => {
      const target = pointerHovered || activeDrag ? cut.id : state.hoveredCutId === cut.id ? null : state.hoveredCutId;
      if (state.hoveredCutId !== target) {
        state.hoveredCutId = target;
        syncHoverVisuals();
        scheduleDiskRender(false);
      }
    };

    group.addEventListener("mouseenter", () => {
      pointerHovered = true;
      syncHoverForGroup();
    });
    group.addEventListener("mouseleave", () => {
      pointerHovered = false;
      syncHoverForGroup();
    });
    group.addEventListener("click", () => {
      if (state.selectedCutId !== cut.id) {
        state.selectedCutId = cut.id;
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

    const defMin = cut.kind === "crosscap" ? 0.15 : 0.25;
    const defMax = cut.kind === "crosscap" ? 2.75 : 5.5;
    const minVal = Math.min(defMin, Math.max(0.05, Math.floor(cut.length * 10) / 10 - 0.1));
    const maxVal = Math.max(defMax, Math.ceil(cut.length * 10) / 10 + 0.5);

    const lenRow = document.createElement("div");
    lenRow.className = "param-row";
    const lenSym = document.createElement("span");
    lenSym.className = "param-sym";
    lenSym.textContent = lenSymText;

    const lenInput = document.createElement("input");
    lenInput.type = "range";
    lenInput.className = "fn-range";
    lenInput.min = String(minVal);
    lenInput.max = String(maxVal);
    lenInput.step = "0.005";
    lenInput.value = String(cut.length);
    lenInput.style.accentColor = cut.color;
    lenInput.setAttribute("aria-label", `${cut.name} ${lenSymText}`);

    const bindRangeEvents = (inputEl, onInputVal) => {
      const pinSelection = () => {
        if (state.selectedCutId !== cut.id) {
          state.selectedCutId = cut.id;
          syncHoverVisuals();
        }
      };
      const endDrag = () => {
        activeDrag = false;
        syncHoverForGroup();
      };
      inputEl.addEventListener("pointerdown", () => {
        activeDrag = true;
        pinSelection();
        syncHoverForGroup();
      });
      inputEl.addEventListener("pointerup", endDrag);
      inputEl.addEventListener("pointercancel", endDrag);
      inputEl.addEventListener("blur", endDrag);
      inputEl.addEventListener("input", () => {
        pinSelection();
        onInputVal(parseFloat(inputEl.value));
        rebuildOnSliderChange();
        scheduleDiskRender(true);
      });
      inputEl.addEventListener("change", () => {
        endDrag();
        scheduleDiskRender(false);
      });
    };

    const lenVal = document.createElement("span");
    lenVal.className = "param-val";
    lenVal.textContent = cut.length.toFixed(2);

    bindRangeEvents(lenInput, (val) => {
      cut.length = val;
      lenVal.textContent = cut.length.toFixed(2);
    });

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
      twInput.step = "0.002";
      twInput.value = String(cut.twistTurns);
      twInput.style.accentColor = cut.color;
      twInput.setAttribute("aria-label", `${cut.name} twist`);

      const formatTw = (v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
      const twVal = document.createElement("span");
      twVal.className = "param-val";
      twVal.textContent = formatTw(cut.twistTurns);

      bindRangeEvents(twInput, (val) => {
        cut.twistTurns = val;
        twVal.textContent = formatTw(cut.twistTurns);
      });

      twRow.append(twSym, twInput, twVal);
      group.append(twRow);
    }

    els.slidersHost.append(group);
  });
}

function syncHoverVisuals() {
  const activeCutId = getActiveHighlightCutId();
  for (const el of els.slidersHost.querySelectorAll(".cut-group")) {
    el.classList.toggle("is-hovered", el.dataset.cutId === activeCutId);
  }
}

function updateColorSelectLabels() {
  if (!els.colorSelect) return;
  const qOpt = els.colorSelect.querySelector('option[value="quotient"]');
  if (qOpt) {
    const qSize = state.realization?.quotient?.quotientSize;
    qOpt.textContent = qSize ? `Quotient (${qSize}-color)` : "Quotient (4-color)";
  }
  const pOpt = els.colorSelect.querySelector('option[value="pieces"]');
  if (pOpt) {
    const pieceCount = state.realization
      ? new Set(state.realization.fdPolygons.map((p) => p.pieceId)).size
      : 0;
    pOpt.textContent = pieceCount > 0 ? `Carved pieces (${pieceCount})` : "Carved pieces";
  }
}

function renderAllViews(resetCamera = false) {
  if (resetCamera) {
    state.cameraM = identityCamera(state.orb);
    state.cameraWrapped = false;
    state.cameraColor = 0;
    state.parityFlip = 0;
  }
  renderStatusAndMeta();
  updateColorSelectLabels();
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
  } else if (parsed.ok && parsed.geometry === "euclidean") {
    state.carving = createDefaultCarving(parsed);
    state.realization = buildEuclideanRealization(parsed, state.carving);
  } else {
    state.carving = null;
    state.realization = null;
  }
  state.selectedCutId = pickDefaultSelectedCutId(parsed, state.carving);

  renderAllViews(true);
}

// ---------------------------------------------------------------------------
// 3. Events & Camera Panning
// ---------------------------------------------------------------------------

els.sigForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  loadSignature(els.sigInput.value);
});

els.colorSelect?.addEventListener("change", () => {
  state.coloring = els.colorSelect.value;
  scheduleDiskRender(false);
});

els.btnReshuffle?.addEventListener("click", () => {
  const orb = state.orb;
  if (!isSupportedGeometry(orb) || !state.carving || !state.realization) return;
  const isEuc = orb.geometry === "euclidean";

  let res = null;
  let fallbackRes = null;
  let lastSeenSig = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = createRandomCarving(orb, state.carving);
    const sig = JSON.stringify(candidate.cuts.map((c) => c.pair));
    if (attempt > 0 && sig === lastSeenSig) continue;
    lastSeenSig = sig;
    let curRes = null;
    try {
      curRes = isEuc
        ? recutEuclidean(orb, state.carving, state.realization, candidate)
        : recutHyperbolic(orb, state.carving, state.realization, candidate);
    } catch {
      curRes = null;
    }
    if (curRes) {
      if (!fallbackRes) fallbackRes = curRes;
      if (curRes.realization.quotient?.exactTransferred !== false) {
        res = curRes;
        break;
      }
    }
  }
  if (!res) res = fallbackRes;
  if (!res) return;

  state.hoveredCutId = null;
  state.carving = res.carving;
  state.realization = res.realization;
  const canKeepSelected =
    state.selectedCutId &&
    res.carving.cuts.some((c) => c.id === state.selectedCutId) &&
    getHoverMarkerContext(state.selectedCutId).hasTwoSidedMarkers;
  state.selectedCutId = canKeepSelected
    ? state.selectedCutId
    : pickDefaultSelectedCutId(orb, res.carving);
  state.cameraColor = (state.cameraColor ^ (res.colorXor || 0)) & 3;
  state.parityFlip ^= res.detFlip || 0;
  state.cameraWrapped = true;

  if (isEuc) {
    state.cameraM = emul3(state.cameraM, res.invQ);
    const wrapped = wrapEuclideanCameraWithColor(state.cameraM, state.realization);
    state.cameraM = wrapped.cameraE;
    state.cameraColor = (state.cameraColor ^ wrapped.colorXor) & 3;
  } else {
    let nextCam = mul3(state.cameraM, res.invQ);
    if (nextCam[2][2] <= 5000) nextCam = reorthonormalizeLorentz(nextCam);
    state.cameraM = nextCam;
    if (state.cameraM[2][2] > 2.0) {
      const wrapped = wrapCameraInGroupWithColor(state.cameraM, state.realization);
      state.cameraM = wrapped.cameraM;
      state.cameraColor = (state.cameraColor ^ wrapped.colorXor) & 3;
    }
  }

  updateColorSelectLabels();
  renderSliders();
  scheduleDiskRender(false);
});

if (els.canvas) {
  const activePointers = new Map();
  let dragStartPt = null;
  let dragStartPx = null;
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
      dragStartPx = null;
      dragStartCamera = null;
      return;
    }
    let sx = 0;
    let sy = 0;
    for (const p of activePointers.values()) {
      sx += p.clientX;
      sy += p.clientY;
    }
    const mx = sx / activePointers.size;
    const my = sy / activePointers.size;
    dragStartPx = [mx, my];
    dragStartPt = clientCoordsToDisk(mx, my);
    dragStartCamera = state.cameraM;
  };

  els.canvas.addEventListener("pointerdown", (e) => {
    if (!state.realization) return;
    els.canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    resetDragAnchor();
  });

  els.canvas.addEventListener("pointermove", (e) => {
    if (!state.realization || !activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    let sx = 0;
    let sy = 0;
    for (const p of activePointers.values()) {
      sx += p.clientX;
      sy += p.clientY;
    }
    const mx = sx / activePointers.size;
    const my = sy / activePointers.size;

    if (state.realization.geometry === "euclidean") {
      if (!dragStartPx) return;
      const rect = els.canvas.getBoundingClientRect();
      const scalePx = rect.width / (2 * EUC_VIEW_R);
      const dx = (mx - dragStartPx[0]) / scalePx;
      const dy = -(my - dragStartPx[1]) / scalePx;
      const res = panEuclideanCamera(dragStartCamera, dx, dy, state.realization);
      let nextCam = res.cameraE;
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
    if (nextCam[2][2] > 120 && state.realization) {
      const wrappedRes = wrapCameraInGroupWithColor(nextCam, state.realization);
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
    if (activePointers.size === 0 && state.realization?.geometry === "euclidean") {
      const wrapped = wrapEuclideanCameraWithColor(state.cameraM, state.realization);
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
      if (!state.realization || e.ctrlKey) return;
      const isEuc = state.realization.geometry === "euclidean";
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
        const res = panEuclideanCamera(state.cameraM, dx, dy, state.realization);
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
      const res = panCameraByDiskDelta(state.cameraM, du, dv, state.realization);
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
    state.parityFlip = 0;
    scheduleDiskRender(false);
  });
}

window.addEventListener("resize", () => scheduleDiskRender(false));

// Initial boot
const params = new URLSearchParams(window.location.search);
loadSignature(params.get("orb") || "3322", false);
