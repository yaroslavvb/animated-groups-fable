// disk_view.js — crisp HiDPI Canvas 2D Poincaré disk renderer for 22222 animated:
// draws all visible hyperbolic motif copies in strict fixed painter's depth order (D < B < E < C < A),
// with smooth hyperbolic pan, zoom, and optional / hover-triggered rail & pair highlight overlays.

import {
  qOne,
  qMul,
  qNorm,
  qBoost,
  fromDisk,
  toDisk,
  ptOf,
  clamp,
  enumerateVisibleOrbit,
  sampleGeodesicDisk,
  sampleSegmentDisk,
  buildWorldFrames,
  qAct,
} from './h22222.js';
import { DEPTH_ORDER, FEATURES, HYPERBOLIC_MOTIFS } from './motifs.js';

function isDarkTheme() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/**
 * Create the interactive Poincaré disk view bound to `canvas`.
 */
export function createDiskView(canvas, { onInteract } = {}) {
  const ctx = canvas.getContext('2d');
  let viewQ = qOne();
  let zoom = 1.0; // visual magnification (1.0 = full unit Poincaré disk fits cleanly with margin)
  let showRails = false;
  let hoverInfo = null; // { kind: 'rail', railIdx } | { kind: 'flip', flip } | null
  let lastState = null;
  let lastStats = { totalCopies: 0, groupElems: 0 };

  let cssW = 480;
  let cssH = 480;
  let dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(120, Math.round(rect.width));
    cssH = Math.max(120, Math.round(rect.height));
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    if (lastState) render(lastState);
  }

  function diskGeometry() {
    const cx = cssW * 0.5;
    const cy = cssH * 0.5;
    const baseR = Math.min(cssW, cssH) * 0.468;
    const R = baseR * zoom;
    return { cx, cy, R, baseR };
  }

  function drawLoop(mat, flatPts, cx, cy, R, moveOnly) {
    const m0 = mat[0], m1 = mat[1], m2 = mat[2];
    const m3 = mat[3], m4 = mat[4], m5 = mat[5];
    const m6 = mat[6], m7 = mat[7], m8 = mat[8];
    const n = flatPts.length / 3;
    for (let i = 0; i < n; i++) {
      const px = flatPts[3 * i];
      const py = flatPts[3 * i + 1];
      const pz = flatPts[3 * i + 2];
      const X = m0 * px + m1 * py + m2 * pz;
      const Y = m3 * px + m4 * py + m5 * pz;
      const Z = m6 * px + m7 * py + m8 * pz;
      const inv = 1 / (1 + Z);
      const sx = cx + X * inv * R;
      const sy = cy - Y * inv * R;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    if (!moveOnly) ctx.closePath();
  }

  function traceDiskPath(pts, cx, cy, R) {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(cx + pts[0][0] * R, cy - pts[0][1] * R);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(cx + pts[i][0] * R, cy - pts[i][1] * R);
    }
  }

  function render(state) {
    lastState = state;
    if (!ctx) return;

    const dark = isDarkTheme();
    const groundCol = dark ? '#13161b' : '#faf8f4';
    const outerBg = dark ? '#0d1014' : '#f1eee7';
    const rimCol = dark ? 'rgba(255,255,255,0.22)' : 'rgba(25,28,34,0.20)';
    const outlineCol = dark ? 'rgba(19,22,27,0.82)' : 'rgba(250,248,244,0.86)';
    const inkCol = dark ? '#eef2f7' : '#181a1f';

    const { cx, cy, R } = diskGeometry();

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = outerBg;
    ctx.fillRect(0, 0, cssW, cssH);

    // Clip to Poincaré disk
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = groundCol;
    ctx.fill();
    ctx.clip();

    // Enumerate visible orbit (tighter radius if zoomed in for even more speed, generous at 1x)
    const rVis = zoom > 1.4 ? 4.45 : 5.15;
    const orbit = enumerateVisibleOrbit(state, viewQ, { rVis, maxElems: 3000 });

    let totalCopies = 0;
    // Fixed painter's depth order: bottom -> top (D < B < E < C < A)
    for (const lbl of DEPTH_ORDER) {
      const copies = orbit.byLabel[lbl];
      const motif = HYPERBOLIC_MOTIFS[lbl];
      const feat = FEATURES[lbl];
      const fillCol = dark ? feat.dark : feat.light;
      totalCopies += copies.length;

      ctx.fillStyle = fillCol;
      ctx.strokeStyle = outlineCol;
      ctx.lineJoin = 'round';

      // Batch fill in large chunks and crisp thin separation strokes for overlapping depth legibility
      for (let i = 0; i < copies.length; i++) {
        const c = copies[i];
        // Euclidean apparent size in px ~ R * (1 - r^2) * 0.5 * motif.radius
        const r2 = c.dx * c.dx + c.dy * c.dy;
        const pxSize = R * (1 - r2) * 0.55 * motif.radius;
        if (pxSize < 0.75) continue;

        ctx.beginPath();
        for (let lp = 0; lp < motif.loops.length; lp++) {
          drawLoop(c.mat, motif.loops[lp], cx, cy, R, false);
        }
        ctx.fill(motif.evenodd ? 'evenodd' : 'nonzero');
        if (pxSize > 3.2) {
          ctx.lineWidth = Math.min(1.6, Math.max(0.55, pxSize * 0.042));
          ctx.stroke();
        }
      }
    }

    // Optional rails or hover preview overlay (zero lines drawn by default unless toggled or hovered!)
    const wantRails = showRails || hoverInfo !== null;
    if (wantRails) {
      const { frames: W } = buildWorldFrames(state);
      const pts = W.map((F) => qAct(viewQ, ptOf(F)));
      const [pa, pb, pc, pd, pe] = pts;
      const [la, lb, lc, ld, le] = state.labels;

      const drawRailArc = (p, q, color, width, dash = []) => {
        const gPts = sampleGeodesicDisk(p, q, 56);
        traceDiskPath(gPts, cx, cy, R);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.stroke();
        ctx.restore();
      };

      const rail1Color = dark ? 'rgba(96,182,255,0.88)' : 'rgba(0,114,178,0.82)';
      const rail2Color = dark ? 'rgba(255,154,102,0.88)' : 'rgba(213,94,0,0.82)';
      const previewColor = dark ? '#fde047' : '#b45309';

      const r1Hot =
        (hoverInfo && hoverInfo.kind === 'rail' && hoverInfo.railIdx === 0) ||
        (hoverInfo && hoverInfo.kind === 'flip' && hoverInfo.flip.railIdx === 0) ||
        (showRails && (state.activeRail === 0 || state.activeRail === 2));
      const r2Hot =
        (hoverInfo && hoverInfo.kind === 'rail' && hoverInfo.railIdx === 1) ||
        (hoverInfo && hoverInfo.kind === 'flip' && hoverInfo.flip.railIdx === 1) ||
        (showRails && (state.activeRail === 1 || state.activeRail === 2));

      drawRailArc(pa, pb, rail1Color, r1Hot ? 2.6 : 1.4, r1Hot ? [] : [5, 4]);
      drawRailArc(pc, pd, rail2Color, r2Hot ? 2.6 : 1.4, r2Hot ? [] : [5, 4]);

      // If hovering a specific local flip, preview the new pairing geodesic segment!
      if (hoverInfo && hoverInfo.kind === 'flip') {
        const fl = hoverInfo.flip;
        const pKeep = fl.railIdx === 0 ? (fl.keepIdx === 0 ? pa : pb) : fl.keepIdx === 0 ? pc : pd;
        const seg = sampleSegmentDisk(pKeep, pe, 28);
        traceDiskPath(seg, cx, cy, R);
        ctx.save();
        ctx.strokeStyle = previewColor;
        ctx.lineWidth = 3.2;
        ctx.setLineDash([7, 4]);
        ctx.stroke();
        ctx.restore();
      }

      // Draw crisp letter badges on the 5 base centers so the grouping is crystal clear
      const drawBadge = (p, label, ringCol, bold) => {
        const [dx, dy] = toDisk(p);
        const sx = cx + dx * R;
        const sy = cy - dy * R;
        const rad = bold ? 12 : 10;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = groundCol;
        ctx.fill();
        ctx.lineWidth = bold ? 2.6 : 1.8;
        ctx.strokeStyle = ringCol || (dark ? FEATURES[label].dark : FEATURES[label].light);
        ctx.stroke();
        ctx.fillStyle = inkCol;
        ctx.font = `700 ${bold ? 12 : 10.5}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, sx, sy + 0.5);
        ctx.restore();
      };

      const hiSet = new Set();
      if (hoverInfo && hoverInfo.kind === 'flip') {
        hiSet.add(hoverInfo.flip.keepLabel);
        hiSet.add(hoverInfo.flip.pivot);
      } else if (hoverInfo && hoverInfo.kind === 'rail') {
        if (hoverInfo.railIdx === 0) { hiSet.add(la); hiSet.add(lb); }
        else { hiSet.add(lc); hiSet.add(ld); }
      }

      drawBadge(pa, la, hiSet.has(la) ? previewColor : rail1Color, hiSet.has(la));
      drawBadge(pb, lb, hiSet.has(lb) ? previewColor : rail1Color, hiSet.has(lb));
      drawBadge(pc, lc, hiSet.has(lc) ? previewColor : rail2Color, hiSet.has(lc));
      drawBadge(pd, ld, hiSet.has(ld) ? previewColor : rail2Color, hiSet.has(ld));
      drawBadge(pe, le, hiSet.has(le) ? previewColor : inkCol, hiSet.has(le) || true);
    }

    ctx.restore(); // end disk clip

    // Outer Poincaré disk horizon border
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = rimCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    lastStats = { totalCopies, groupElems: orbit.groupElems };
  }

  // ---- Interactive hyperbolic pan & zoom ----
  let dragging = false;
  let lastPtr = null;

  function clientToDisk(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const { cx, cy, R } = diskGeometry();
    const x = (clientX - rect.left - cx) / R;
    const y = -(clientY - rect.top - cy) / R;
    const r = Math.hypot(x, y);
    if (r > 0.92) {
      const k = 0.92 / r;
      return [x * k, y * k];
    }
    return [x, y];
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    lastPtr = clientToDisk(e.clientX, e.clientY);
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !lastPtr) return;
    const cur = clientToDisk(e.clientX, e.clientY);
    const dx = cur[0] - lastPtr[0];
    const dy = cur[1] - lastPtr[1];
    if (dx * dx + dy * dy < 1e-8) return;
    // Apply exact hyperbolic translation matching pointer delta
    const stepP = fromDisk(clamp(dx * 0.85, -0.5, 0.5), clamp(dy * 0.85, -0.5, 0.5));
    viewQ = qNorm(qMul(qBoost(stepP), viewQ));
    lastPtr = cur;
    if (onInteract) onInteract();
    if (lastState) render(lastState);
  });

  const endDrag = () => {
    dragging = false;
    lastPtr = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('dblclick', () => {
    viewQ = qOne();
    zoom = 1.0;
    if (lastState) render(lastState);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0014);
    zoom = clamp(zoom * factor, 0.85, 2.4);
    if (lastState) render(lastState);
  }, { passive: false });

  resize();

  return {
    set: render,
    resize,
    resetView() {
      viewQ = qOne();
      zoom = 1.0;
      if (lastState) render(lastState);
    },
    setShowRails(flag) {
      showRails = !!flag;
      if (lastState) render(lastState);
    },
    setHover(info) {
      hoverInfo = info || null;
      if (lastState) render(lastState);
    },
    info: () => ({ ...lastStats, zoom, showRails }),
  };
}
