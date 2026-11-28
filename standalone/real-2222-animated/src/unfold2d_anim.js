// unfold2d_anim.js — rigid 2D unfolded wallpaper visualizer for "The real 2222 animated":
// draws the isotropic flat development with subtle rigid Paisley commas, faint triangulation hairlines,
// and exact 180-deg symmetric colored emblems matching the 3D corners 1-to-1.

import {
  coords2,
  pairVectors,
  solidFromBasis,
  pairPrintParams,
  unfoldedNet,
} from '../../real-2222/src/real2222.js';
import { placedInPane, outline, sizeOf } from '../../real-2222/src/paisley.js';
import {
  FEATURES,
  SYMBOL_POLYS,
  DEPTH_ORDER,
  MAX_SYMBOL_RADIUS,
} from './symbols.js';

const VIEW_SPAN = 4.2;
const CAM_X = 0;
const CAM_Y = 0.42;

function paletteFor(dark) {
  if (dark) {
    return {
      ground: '#1f3532',
      comma: '#2c4a45',
      grid: 'rgba(236, 236, 240, 0.13)',
      sym: {
        A: FEATURES.A.dark,
        B: FEATURES.B.dark,
        C: FEATURES.C.dark,
        D: FEATURES.D.dark,
      },
    };
  }
  return {
    ground: '#dceee9',
    comma: '#b9d9d1',
    grid: 'rgba(20, 23, 31, 0.14)',
    sym: {
      A: FEATURES.A.light,
      B: FEATURES.B.light,
      C: FEATURES.C.light,
      D: FEATURES.D.light,
    },
  };
}

export function createAnimUnfoldPane(canvas) {
  const ctx = canvas.getContext('2d');
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let curState = null;
  let stats = { commasDrawn: 0, symbolsDrawn: 0, netLinesDrawn: 0, netArea: 0, ppuX: 0, ppuY: 0, isRigid: true };

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

    // 1. Visible box in plane coordinates (strictly rigid isotropic scale)
    const hx = W / (2 * ppuX) + 0.35;
    const hy = H / (2 * ppuY) + 0.35;
    const planeBox = { x0: CAM_X - hx, x1: CAM_X + hx, y0: CAM_Y - hy, y1: CAM_Y + hy };

    // 2. Subtle rigid Paisley commas in background
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

    // 3. Background triangulation grid across visible wallpaper
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

    // 4. Canonical label anchors (zero tetrahedron outline lines drawn)
    const net = unfoldedNet(S, [CAM_X, CAM_Y]);

    // 5. Four large 180-deg symmetric colored motifs painted in fixed depth order (D < B < C < A)
    const paths = { A: new Path2D(), B: new Path2D(), C: new Path2D(), D: new Path2D() };
    const symBox = {
      x0: planeBox.x0 - MAX_SYMBOL_RADIUS,
      x1: planeBox.x1 + MAX_SYMBOL_RADIUS,
      y0: planeBox.y0 - MAX_SYMBOL_RADIUS,
      y1: planeBox.y1 + MAX_SYMBOL_RADIUS,
    };
    const sbCorners = [
      [symBox.x0, symBox.y0],
      [symBox.x1, symBox.y0],
      [symBox.x1, symBox.y1],
      [symBox.x0, symBox.y1],
    ];
    let sa0 = Infinity, sa1 = -Infinity, sb0 = Infinity, sb1 = -Infinity;
    for (const pt of sbCorners) {
      const [a, b] = coords2(pt, va, vb);
      if (a < sa0) sa0 = a;
      if (a > sa1) sa1 = a;
      if (b < sb0) sb0 = b;
      if (b > sb1) sb1 = b;
    }

    let symbolsDrawn = 0;
    for (let jb = Math.floor(sb0) - 1; jb <= Math.ceil(sb1) + 1; jb++) {
      for (let ia = Math.floor(sa0) - 1; ia <= Math.ceil(sa1) + 1; ia++) {
        const pt = latPt(ia, jb);
        if (pt[0] < symBox.x0 || pt[0] > symBox.x1 || pt[1] < symBox.y0 || pt[1] > symBox.y1) continue;
        const name = 'ABCD'[(ia & 1) + 2 * (jb & 1)];
        const poly = SYMBOL_POLYS[name];
        const path = paths[name];
        const s0 = toScreen([pt[0] + poly[0][0], pt[1] + poly[0][1]]);
        path.moveTo(s0[0], s0[1]);
        for (let k = 1; k < poly.length; k++) {
          const sk = toScreen([pt[0] + poly[k][0], pt[1] + poly[k][1]]);
          path.lineTo(sk[0], sk[1]);
        }
        path.closePath();
        symbolsDrawn++;
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = col.ground;
    for (const name of DEPTH_ORDER) {
      ctx.stroke(paths[name]);
      ctx.fillStyle = col.sym[name];
      ctx.fill(paths[name]);
    }
    ctx.restore();

    // 6. Crisp A, B, C, D cone labels anchored at the centers of the four central motifs
    ctx.font = '700 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(16, 22, 26, 0.65)';
    ctx.fillStyle = dark ? '#101418' : '#ffffff';

    for (const name of ['A', 'B', 'C', 'D']) {
      const c = net.labelCorners[name];
      if (!c) continue;
      const [sx, sy] = toScreen(c.pt);
      const lx = Math.max(12, Math.min(W - 12, sx));
      const ly = Math.max(12, Math.min(H - 12, sy));
      ctx.strokeText(name, lx, ly);
      ctx.fillText(name, lx, ly);
    }

    stats = {
      commasDrawn,
      symbolsDrawn,
      netLinesDrawn: 0,
      netArea: net.area,
      ppuX,
      ppuY,
      isRigid: Math.abs(ppuX - ppuY) < 1e-12,
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
