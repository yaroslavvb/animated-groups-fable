// unfold2d.js — rigid 2D unfolded wallpaper visualizer for "The real 2222".
// Renders the isometric flat development of the 2222 orbifold with exact Euclidean Paisley commas,
// the 4-triangle central pillow net, separated vertex highlighting, and non-hijacked scroll.

import {
  PARTITIONS,
  coords2,
  pairVectors,
  solidFromBasis,
  pairPrintParams,
  unfoldedNet,
} from './real2222.js';
import { SIDE_COLORS } from './pillow3d.js';
import { placedInPane, outline, sizeOf } from './paisley.js';

const VIEW_SPAN = 4.2;
const CAM_X = 0;
const CAM_Y = 0.42;

function paletteFor(dark) {
  const S = dark ? SIDE_COLORS.dark : SIDE_COLORS.light;
  if (dark) {
    return {
      ground: '#24423e',
      comma: '#386962',
      grid: 'rgba(236, 236, 240, 0.14)',
      crease: 'rgba(236, 236, 240, 0.56)',
      casing: 'rgba(19, 19, 23, 0.72)',
      dotOutline: '#131317',
      side1: S.side1.css,
      side2: S.side2.css,
    };
  }
  return {
    ground: '#9ad5cc',
    comma: '#4fa397',
    grid: 'rgba(20, 23, 31, 0.14)',
    crease: 'rgba(20, 23, 31, 0.54)',
    casing: 'rgba(255, 255, 255, 0.80)',
    dotOutline: '#ffffff',
    side1: S.side1.css,
    side2: S.side2.css,
  };
}

export function createUnfoldPane(canvas) {
  const ctx = canvas.getContext('2d');
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let curState = null;
  let stats = { commasDrawn: 0, netArea: 0, netEdges: 0, ppuX: 0, ppuY: 0, isRigid: true, netBox: null };

  function measure() {
    const rect = canvas.getBoundingClientRect();
    const nextDpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
    const nextW = Math.max(1, Math.round(rect.width || canvas.clientWidth || 320));
    const nextH = Math.max(1, Math.round(rect.height || canvas.clientHeight || 280));
    if (nextW !== W || nextH !== H || nextDpr !== dpr) {
      W = nextW;
      H = nextH;
      dpr = nextDpr;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      return true;
    }
    return false;
  }

  function scale() {
    const ppu = Math.max(1, Math.min(W, H)) / VIEW_SPAN;
    return { ppuX: ppu, ppuY: ppu };
  }

  function draw() {
    if (!curState) return;
    measure();
    const { ppuX, ppuY } = scale();
    const toScreen = ([x, y]) => [W / 2 + (x - CAM_X) * ppuX, H / 2 - (y - CAM_Y) * ppuY];

    const dark = !!(mq && mq.matches);
    const col = paletteFor(dark);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col.ground;
    ctx.fillRect(0, 0, W, H);

    // 1. Visible bounding box in plane coordinates (strictly rigid isotropic mapping)
    const hx = W / (2 * ppuX) + 0.35;
    const hy = H / (2 * ppuY) + 0.35;
    const planeBox = { x0: CAM_X - hx, x1: CAM_X + hx, y0: CAM_Y - hy, y1: CAM_Y + hy };

    // 2. Rigid Euclidean Paisley commas matching the 3D pillow
    const pv = pairVectors(curState.e, curState.activeFrame);
    const P = pairPrintParams(curState.e, curState.activeFrame, curState.pr || 0, curState.q90);
    const placed = placedInPane('2222', P, [0, 0], pv.vh, planeBox);

    const commaPath = new Path2D();
    let commasDrawn = 0;
    for (const it of placed) {
      if (sizeOf(it) * ppuX < 1.0) continue;
      const pts = outline(it);
      if (!pts.length) continue;
      const p0 = toScreen(pts[0]);
      commaPath.moveTo(p0[0], p0[1]);
      for (let k = 1; k < pts.length; k++) {
        const pk = toScreen(pts[k]);
        commaPath.lineTo(pk[0], pk[1]);
      }
      commaPath.closePath();
      commasDrawn++;
    }
    ctx.fillStyle = col.comma;
    ctx.fill(commaPath);

    // 3. Subtle wallpaper triangulation grid across all visible lattice copies
    const S = solidFromBasis(curState.e, { minConorm: 0 });
    const { va, vb } = S;
    const boxCorners = [
      [planeBox.x0, planeBox.y0],
      [planeBox.x1, planeBox.y0],
      [planeBox.x1, planeBox.y1],
      [planeBox.x0, planeBox.y1],
    ];
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const pt of boxCorners) {
      const [a, b] = coords2(pt, va, vb);
      if (a < aMin) aMin = a;
      if (a > aMax) aMax = a;
      if (b < bMin) bMin = b;
      if (b > bMax) bMax = b;
    }
    const ia0 = Math.floor(aMin) - 1;
    const ia1 = Math.ceil(aMax) + 1;
    const jb0 = Math.floor(bMin) - 1;
    const jb1 = Math.ceil(bMax) + 1;
    const latPt = (ia, jb) => [ia * va[0] + jb * vb[0], ia * va[1] + jb * vb[1]];

    const gridPath = new Path2D();
    for (let jb = jb0; jb <= jb1; jb++) {
      const p = toScreen(latPt(ia0, jb));
      const q = toScreen(latPt(ia1, jb));
      gridPath.moveTo(p[0], p[1]);
      gridPath.lineTo(q[0], q[1]);
    }
    for (let ia = ia0; ia <= ia1; ia++) {
      const p = toScreen(latPt(ia, jb0));
      const q = toScreen(latPt(ia, jb1));
      gridPath.moveTo(p[0], p[1]);
      gridPath.lineTo(q[0], q[1]);
    }
    for (let s = ia0 - jb1; s <= ia1 - jb0; s++) {
      const iStart = Math.max(ia0, jb0 + s);
      const iEnd = Math.min(ia1, jb1 + s);
      if (iStart >= iEnd) continue;
      const p = toScreen(latPt(iStart, iStart - s));
      const q = toScreen(latPt(iEnd, iEnd - s));
      gridPath.moveTo(p[0], p[1]);
      gridPath.lineTo(q[0], q[1]);
    }
    ctx.lineCap = 'butt';
    ctx.lineWidth = 1;
    ctx.strokeStyle = col.grid;
    ctx.stroke(gridPath);

    // 4. Central rigidly-unfolded 4-triangle pillow net
    const net = unfoldedNet(S, [CAM_X, CAM_Y]);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const o0 = toScreen(net.outline[0]);
    ctx.moveTo(o0[0], o0[1]);
    for (let k = 1; k < net.outline.length; k++) {
      const ok = toScreen(net.outline[k]);
      ctx.lineTo(ok[0], ok[1]);
    }
    ctx.closePath();
    ctx.strokeStyle = col.casing;
    ctx.lineWidth = 5.5;
    ctx.stroke();

    // Draw inactive interior/boundary creases first, then highlighted Side 1 / Side 2 seams on top
    const orderedEdges = [...net.edges].sort((u, v) => {
      const au = u.partIdx === curState.activeIdx ? 1 : 0;
      const av = v.partIdx === curState.activeIdx ? 1 : 0;
      return au - av;
    });

    for (const ed of orderedEdges) {
      const sa = toScreen(ed.a);
      const sb = toScreen(ed.b);
      const active = ed.partIdx === curState.activeIdx;
      const folded = ed.bend >= 0.08;
      ctx.beginPath();
      ctx.moveTo(sa[0], sa[1]);
      ctx.lineTo(sb[0], sb[1]);
      ctx.setLineDash(!folded ? [5, 4] : []);
      if (active) {
        ctx.strokeStyle = ed.side === 0 ? col.side1 : col.side2;
        ctx.lineWidth = folded ? (ed.side === 0 ? 3.8 : 2.9) : (ed.side === 0 ? 2.6 : 2.0);
      } else {
        ctx.strokeStyle = col.crease;
        ctx.lineWidth = folded ? 1.45 : 1.1;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 5. All visible half-turn centers highlighted by Side 1 (bigger blue) vs Side 2 (smaller orange)
    const activePart = PARTITIONS[curState.activeIdx];
    const side1Set = new Set(activePart.pairs[0]);
    const netCornerKeys = new Set(net.corners.map((c) => `${c.i},${c.j}`));

    for (let jb = jb0; jb <= jb1; jb++) {
      for (let ia = ia0; ia <= ia1; ia++) {
        const pt = latPt(ia, jb);
        if (pt[0] < planeBox.x0 || pt[0] > planeBox.x1 || pt[1] < planeBox.y0 || pt[1] > planeBox.y1) continue;
        const name = 'ABCD'[(ia & 1) + 2 * (jb & 1)];
        const isSide1 = side1Set.has(name);
        const onNet = netCornerKeys.has(`${ia},${jb}`);
        const radius = isSide1 ? (onNet ? 6.0 : 4.2) : (onNet ? 4.0 : 2.9);
        const [sx, sy] = toScreen(pt);
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSide1 ? col.side1 : col.side2;
        ctx.fill();
        ctx.lineWidth = onNet ? 1.6 : 1.1;
        ctx.strokeStyle = col.dotOutline;
        ctx.stroke();
      }
    }

    // 6. Crisp A, B, C, D corner labels on the unfolded net
    const cenScreen = toScreen(net.centroid);
    ctx.font = '700 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = col.ground;

    for (const name of ['A', 'B', 'C', 'D']) {
      const c = net.labelCorners[name];
      if (!c) continue;
      const [sx, sy] = toScreen(c.pt);
      let dx = sx - cenScreen[0];
      let dy = sy - cenScreen[1];
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const dist = side1Set.has(name) ? 14 : 12;
      const lx = Math.max(12, Math.min(W - 12, sx + dx * dist));
      const ly = Math.max(12, Math.min(H - 12, sy + dy * dist));
      ctx.strokeText(name, lx, ly);
      ctx.fillStyle = side1Set.has(name) ? col.side1 : col.side2;
      ctx.fillText(name, lx, ly);
    }

    const xs = net.outline.map((p) => p[0]);
    const ys = net.outline.map((p) => p[1]);
    stats = {
      commasDrawn,
      netArea: net.area,
      netEdges: net.edges.length,
      ppuX,
      ppuY,
      isRigid: Math.abs(ppuX - ppuY) < 1e-12,
      netBox: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)],
    };
  }

  if (mq) {
    const onTheme = () => {
      if (curState) draw();
    };
    if (mq.addEventListener) mq.addEventListener('change', onTheme);
    else if (mq.addListener) mq.addListener(onTheme);
  }

  return {
    set(nextState) {
      curState = nextState;
      draw();
    },
    resize() {
      if (measure() && curState) draw();
    },
    info() {
      return { ...stats };
    },
  };
}
