// pillow3d.js — 3D WebGL stage for "The real 2222": full-pillow paisley print,
// colored corner pairings, isolating cut band/loop, tablet pinch zoom, and non-hijacked page scroll.

import { createStage } from '../../classification-of-surfaces/src/stage.js';
import { THEME } from '../../classification-of-surfaces/src/theme.js';
import { unitFields, printOf, printTexture, cellBox } from './paisley.js';
import { PARTITIONS, buildPillowMesh, pairPrintParams } from './real2222.js';

const SURFACE_RADIUS = 0.86;
const PRINT_SIZE = 256;
const VIEW = { az: -24, el: 18, zoom: 1 };

export const SIDE_COLORS = {
  light: {
    side1: { rgb: [0, 0.447, 0.698], css: '#0072B2' },     // vivid cobalt blue
    side2: { rgb: [0.835, 0.369, 0], css: '#D55E00' },     // vivid vermilion orange
  },
  dark: {
    side1: { rgb: [0.337, 0.706, 0.914], css: '#56B4E9' }, // vivid sky blue
    side2: { rgb: [1.0, 0.541, 0.239], css: '#FF8A3D' },   // vivid warm coral-orange
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

  function sidePalette() {
    return THEME.dark ? SIDE_COLORS.dark : SIDE_COLORS.light;
  }

  function buildMarkerList() {
    if (!mesh || !curState) return [];
    const S = sidePalette();
    const part = PARTITIONS[curState.activeIdx];
    const side1Set = new Set(part.pairs[0]);

    return ['A', 'B', 'C', 'D'].map((name) => {
      const isSide1 = side1Set.has(name);
      const spec = isSide1 ? S.side1 : S.side2;
      return {
        name,
        side: isSide1 ? 1 : 2,
        p: mesh.corners[name],
        color: spec.rgb,
        size: isSide1 ? 15 : 9.5,
        alpha: 1,
        shape: 'dot',
        xray: 0.5,
        label: name,
        labelColor: spec.css,
      };
    });
  }

  function lines() {
    if (!mesh || !curState) return [];
    const out = [];
    const S = sidePalette();

    for (const ep of mesh.edgePairs) {
      const active = ep.idx === curState.activeIdx;
      const folded = ep.bend >= 0.08;
      if (active) {
        // Highlight the two separated edge pairs in Side 1 vs Side 2 colors
        const sideSpecs = [S.side1, S.side2];
        ep.segs.forEach(([a, b], pairIndex) => {
          const spec = sideSpecs[pairIndex];
          out.push({
            points: flat2(a, b),
            color: spec.rgb,
            width: folded ? (pairIndex === 0 ? 4.2 : 3.2) : (pairIndex === 0 ? 2.8 : 2.1),
            alpha: folded ? 1 : 0.92,
            xray: folded ? 0.34 : 0.26,
            dashed: !folded,
          });
        });
      } else {
        // Non-active creases stay subtle neutral lines so separated pairs stand out clearly
        for (const [a, b] of ep.segs) {
          out.push({
            points: flat2(a, b),
            color: THEME.soft,
            width: folded ? 1.5 : 1.0,
            alpha: folded ? 0.58 : 0.24,
            xray: folded ? 0.18 : 0.1,
            dashed: !folded,
          });
        }
      }
    }

    return out;
  }

  function markers() {
    return buildMarkerList();
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
    });

    const key = [
      nextState.e[0][0],
      nextState.e[0][1],
      nextState.e[1][0],
      nextState.e[1][1],
      nextState.activeFrame.map((r) => r.join(',')).join('/'),
      nextState.q90 || 0,
      nextState.pr || 0,
    ].join('|');

    if (key !== printKey) {
      printKey = key;
      texTurn ^= 1;
      const P = pairPrintParams(nextState.e, nextState.activeFrame, nextState.pr || 0, nextState.q90);
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
      const markerStyles = buildMarkerList().map((m) => ({
        name: m.name,
        side: m.side,
        size: m.size,
        color: m.labelColor,
      }));
      return {
        activeIdx: curState ? curState.activeIdx : 0,
        kind: mesh ? mesh.S.kind : '',
        edges: mesh ? mesh.S.edges.slice() : [],
        bends: mesh ? mesh.S.bends.slice() : [],
        corners: mesh ? { ...mesh.corners } : {},
        triangles: mesh ? mesh.triangles : 0,
        cutLength: mesh ? mesh.cutLength : 0,
        cutLinesDrawn: 0,
        markerStyles,
        view: R.getView(),
        printUploads: R.stats ? R.stats.printUploads : 0,
      };
    },
  };
}
