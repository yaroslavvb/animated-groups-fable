// pillow3d.js — 3D WebGL stage for "The real 2222": full-pillow paisley print,
// colored corner pairings, isolating cut band/loop, tablet pinch zoom, and non-hijacked page scroll.

import { createStage } from '../../classification-of-surfaces/src/stage.js';
import { THEME } from '../../classification-of-surfaces/src/theme.js';
import { unitFields, printOf, printTexture, cellBox } from './paisley.js';
import { PARTITIONS, buildPillowMesh, pairPrintParams } from './real2222.js';

const SURFACE_RADIUS = 0.86;
const PRINT_SIZE = 256;
const VIEW = { az: -24, el: 18, zoom: 1 };

export const PAIR_RGB = {
  light: {
    ab: [0, 0.447, 0.698],
    ac: [0.835, 0.533, 0],
    ad: [0.478, 0.361, 0.78],
  },
  dark: {
    ab: [0.337, 0.706, 0.914],
    ac: [0.941, 0.682, 0.118],
    ad: [0.682, 0.588, 0.925],
  },
};

const PRINT = {
  light: {
    front: ['#9ad5cc', '#4fa397'],
    back: ['#f5e6c6', '#d8bd85'],
    shade: [26 / 255, 26 / 255, 31 / 255],
    mix: 0.11,
  },
  dark: {
    front: ['#2b4f4a', '#43796f'],
    back: ['#5e4f30', '#857246'],
    shade: [0, 0, 0],
    mix: 0.25,
  },
};

const flat2 = (a, b) => new Float32Array([a[0], a[1], a[2], b[0], b[1], b[2]]);

export function createPillowStage(canvas, labelLayer, scrollHost) {
  THEME.opacity = 0.96;
  const stage = createStage(canvas, labelLayer);
  const R = stage.R;
  const fields = unitFields();
  const texBuf = [new Uint8Array(PRINT_SIZE * PRINT_SIZE), new Uint8Array(PRINT_SIZE * PRINT_SIZE)];
  let texTurn = 0;
  let printKey = '';

  let curState = null;
  let mesh = null;
  let framed = false;

  // Allow 2-finger scroll on trackpad/wheel (non-ctrl) to scroll the page natively.
  // Must run in capture phase on an ancestor of canvas.parentElement BEFORE turning.js and render3d.js!
  const host = scrollHost || canvas.parentElement?.parentElement;
  if (host) {
    host.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey) e.stopPropagation();
      },
      { capture: true, passive: true }
    );
  }

  // On a tablet touchscreen, two fingers pinching/spreading zoom cleanly (render3d + turning.level),
  // whereas two fingers sliding together in parallel vertically scroll the page instead of zooming.
  const touchPts = new Map();
  let lastTouchDist = 0;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPts.size === 2) {
        const [a, b] = [...touchPts.values()];
        lastTouchDist = Math.hypot(b.x - a.x, b.y - a.y);
      }
    },
    { capture: true }
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'touch' || !touchPts.has(e.pointerId)) return;
      const prev = touchPts.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;
      prev.dx = dx;
      prev.dy = dy;

      if (touchPts.size === 2) {
        const vals = [...touchPts.values()];
        const a = vals[0];
        const b = vals[1];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const dax = a.dx || 0;
        const day = a.dy || 0;
        const dbx = b.dx || 0;
        const dby = b.dy || 0;
        const lenA = Math.hypot(dax, day);
        const lenB = Math.hypot(dbx, dby);
        const dMidX = 0.5 * (dax + dbx);
        const dMidY = 0.5 * (day + dby);
        const midLen = Math.hypot(dMidX, dMidY);
        const dot = dax * dbx + day * dby;
        const distDelta = Math.abs(dist - lastTouchDist);
        lastTouchDist = dist;

        // Parallel two-finger drag -> scroll page, don't zoom.
        if (lenA > 1.2 && lenB > 1.2 && dot > 0.78 * lenA * lenB && distDelta < 0.25 * midLen && Math.abs(dMidY) > 0.5) {
          if (typeof window !== 'undefined' && typeof window.scrollBy === 'function') {
            window.scrollBy(0, -dMidY);
          }
          e.stopImmediatePropagation();
          a.dx = a.dy = b.dx = b.dy = 0;
        }
      }
    },
    { capture: true }
  );
  const clearTouch = (e) => {
    if (e.pointerType !== 'touch') return;
    touchPts.delete(e.pointerId);
    lastTouchDist = 0;
  };
  canvas.addEventListener('pointerup', clearTouch, { capture: true });
  canvas.addEventListener('pointercancel', clearTouch, { capture: true });

  function applyStyle() {
    const P = THEME.dark ? PRINT.dark : PRINT.light;
    R.setStyle({
      printFront: P.front,
      printBack: P.back,
      ghost: P.shade,
      ghostMix: P.mix,
      opacity: THEME.opacity,
    });
  }

  function lines() {
    if (!mesh || !curState) return [];
    const out = [];
    const C = THEME.dark ? PAIR_RGB.dark : PAIR_RGB.light;

    for (const ep of mesh.edgePairs) {
      const col = C[ep.colorKey];
      const active = ep.idx === curState.activeIdx;
      const folded = ep.bend >= 0.08;
      if (active) {
        for (const [a, b] of ep.segs) {
          out.push({
            points: flat2(a, b),
            color: col,
            width: folded ? 3.5 : 2.3,
            alpha: folded ? 1 : 0.9,
            xray: folded ? 0.32 : 0.24,
            dashed: !folded,
          });
        }
      } else {
        for (const [a, b] of ep.segs) {
          out.push({
            points: flat2(a, b),
            color: col,
            width: folded ? 2.1 : 1.2,
            alpha: folded ? 0.85 : 0.38,
            xray: folded ? 0.24 : 0.14,
            dashed: !folded,
          });
        }
      }
    }

    for (const [a, b] of mesh.cutSegments) {
      out.push({
        points: flat2(a, b),
        color: THEME.ink,
        width: 2.8,
        alpha: 1,
        xray: 0.24,
      });
    }

    return out;
  }

  function markers() {
    if (!mesh || !curState) return [];
    const C = THEME.dark ? PAIR_RGB.dark : PAIR_RGB.light;
    const part = PARTITIONS[curState.activeIdx];
    const col = C[part.colorKey];
    const primarySet = new Set(part.pairs[0]);
    const labelColor = THEME.dark ? '#f2f2f5' : '#141418';

    return ['A', 'B', 'C', 'D'].map((name) => ({
      p: mesh.corners[name],
      color: col,
      size: primarySet.has(name) ? 9.5 : 7.5,
      alpha: 1,
      shape: 'dot',
      xray: 0.45,
      label: name,
      labelColor,
    }));
  }

  const scene = {
    update: () => (mesh ? mesh.positions : new Float32Array(0)),
    lines,
    markers,
  };
  stage.scene = scene;
  R.setView(VIEW);
  applyStyle();

  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  if (mq) {
    const onTheme = () => {
      applyStyle();
      if (curState) stage.refresh();
    };
    if (mq.addEventListener) mq.addEventListener('change', onTheme);
    else if (mq.addListener) mq.addListener(onTheme);
  }

  function set(nextState) {
    curState = nextState;
    mesh = buildPillowMesh(nextState.e, nextState.activeFrame, nextState.cFrac);
    R.setSurface({
      positions: mesh.positions,
      indices: mesh.indices,
      uv: mesh.uv,
      tint: mesh.tint,
    });

    const key = [
      nextState.e[0][0],
      nextState.e[0][1],
      nextState.e[1][0],
      nextState.e[1][1],
      nextState.activeFrame.map((r) => r.join(',')).join('/'),
      nextState.pr || 0,
    ].join('|');

    if (key !== printKey) {
      printKey = key;
      texTurn ^= 1;
      const P = pairPrintParams(nextState.e, nextState.activeFrame, nextState.pr || 0);
      const placed = printOf('2222', P, cellBox(mesh.ca, mesh.cb));
      R.setStyle({
        print: printTexture(fields, placed, mesh.ca, mesh.cb, PRINT_SIZE, texBuf[texTurn]),
      });
    }

    R.setFrame({ center: [0, 0, 0], radius: SURFACE_RADIUS }, !framed);
    framed = true;
    stage.decorate();
    R.render();
  }

  return {
    stage,
    set,
    resetView() {
      R.setView(VIEW);
      R.render();
    },
    resize() {
      R.resize();
      if (curState) {
        stage.decorate();
        R.render();
      }
    },
    info() {
      return {
        activeIdx: curState ? curState.activeIdx : 0,
        kind: mesh ? mesh.S.kind : '',
        edges: mesh ? mesh.S.edges.slice() : [],
        bends: mesh ? mesh.S.bends.slice() : [],
        corners: mesh ? { ...mesh.corners } : {},
        triangles: mesh ? mesh.triangles : 0,
        cutLength: mesh ? mesh.cutLength : 0,
        view: R.getView(),
        printUploads: R.stats ? R.stats.printUploads : 0,
      };
    },
  };
}
