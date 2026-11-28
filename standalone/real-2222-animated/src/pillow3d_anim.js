// pillow3d_anim.js — 3D WebGL stage for "The real 2222 animated":
// renders the 4 carved 180-deg symmetric colored corner emblems on the fixed-area/size pillow,
// subtle sliding Paisley print, high-contrast active twist edges, tablet pinch zoom, and passive wheel scroll.

import { createStage } from '../../classification-of-surfaces/src/stage.js';
import { THEME } from '../../classification-of-surfaces/src/theme.js';
import { unitFields, printOf, printTexture, cellBox } from '../../real-2222/src/paisley.js';
import { pairPrintParams } from '../../real-2222/src/real2222.js';
import { FEATURES, FEATURE_LIST, buildSymbolPillowMesh } from './symbols.js';

const SURFACE_RADIUS = 0.86;
const PRINT_SIZE = 256;
const VIEW = { az: -26, el: 20, zoom: 1 };

const BG_PRINT = {
  light: {
    front: ['#d6eae5', '#b3d4cc'],
    back: ['#e8dec4', '#cdb98e'],
    ghost: [26 / 255, 26 / 255, 31 / 255],
    mix: 0.1,
  },
  dark: {
    front: ['#1f3532', '#2c4a45'],
    back: ['#463d28', '#5e5033'],
    ghost: [0, 0, 0],
    mix: 0.2,
  },
};

const flat2 = (a, b) => new Float32Array([a[0], a[1], a[2], b[0], b[1], b[2]]);

export function createAnimPillowStage(canvas, labelLayer, scrollHost) {
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

  // Allow two-finger trackpad scroll / wheel to scroll the page natively.
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

  // On tablet touch: 2-finger pinch zooms; parallel 2-finger vertical drag scrolls the page.
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
    const P = THEME.dark ? BG_PRINT.dark : BG_PRINT.light;
    const palette = FEATURE_LIST.map((f) => {
      const hex = THEME.dark ? f.dark : f.light;
      return { front: hex, back: hex };
    });
    R.setStyle({
      printFront: P.front,
      printBack: P.back,
      ghost: P.ghost,
      ghostMix: P.mix,
      opacity: THEME.opacity,
      palette,
    });
  }

  function lines() {
    if (!mesh || !curState) return [];
    const out = [];
    for (const ep of mesh.edgePairs) {
      const active = ep.idx === curState.activeIdx;
      const folded = ep.bend >= 0.08;
      if (active) {
        for (const [a, b] of ep.segs) {
          out.push({
            points: flat2(a, b),
            color: THEME.ink,
            width: folded ? 3.4 : 2.2,
            alpha: folded ? 0.92 : 0.85,
            xray: folded ? 0.28 : 0.2,
            dashed: !folded,
          });
        }
      } else {
        for (const [a, b] of ep.segs) {
          out.push({
            points: flat2(a, b),
            color: THEME.soft,
            width: folded ? 1.45 : 0.95,
            alpha: folded ? 0.52 : 0.22,
            xray: folded ? 0.16 : 0.09,
            dashed: !folded,
          });
        }
      }
    }
    return out;
  }

  function markers() {
    if (!mesh || !curState) return [];
    const pinRgb = THEME.dark ? [0.08, 0.08, 0.1] : [1, 1, 1];
    return ['A', 'B', 'C', 'D'].map((name) => {
      const feat = FEATURES[name];
      return {
        p: mesh.corners[name],
        color: pinRgb,
        size: 3.4,
        alpha: 0.9,
        shape: 'dot',
        xray: 0.35,
        label: name,
        labelColor: THEME.dark ? feat.dark : feat.light,
      };
    });
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
    mesh = buildSymbolPillowMesh(nextState.e, nextState.activeFrame, {
      activeIdx: nextState.activeIdx,
      pinFrame: nextState.pinFrame,
    });
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
      const tintSet = new Set();
      if (mesh && mesh.tint) for (let i = 0; i < mesh.tint.length; i++) tintSet.add(mesh.tint[i]);
      return {
        activeIdx: curState ? curState.activeIdx : 0,
        kind: mesh ? mesh.S.kind : '',
        edges: mesh ? mesh.S.edges.slice() : [],
        bends: mesh ? mesh.S.bends.slice() : [],
        corners: mesh ? { ...mesh.corners } : {},
        triangles: mesh ? mesh.triangles : 0,
        paletteTints: [...tintSet].sort((a, b) => a - b),
        view: R.getView(),
        printUploads: R.stats ? R.stats.printUploads : 0,
      };
    },
  };
}
