// stage.js — the one 3D pane: The Folding's renderer plus the current Scene.
//
//   const stage = createStage(canvas, labelLayer);
//   stage.setScene(scene, frame)     a new surface (its topology), framed
//   stage.refresh()                  the scene's state changed: new positions, lines and markers, one draw
//   stage.animate(seconds, step, done)   step(u) for u = 0 .. 1 on animation frames; returns a cancel function
//   stage.R                          the renderer (render3d.js)

import { createRenderer, viewFromAzEl } from './vendor/the-folding/render3d.js';
import { THEME, setDark } from './theme.js';

export function createStage(canvas, labelLayer) {
  const R = createRenderer(canvas, { labelLayer });
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const stage = { R, scene: null, extraLines: null, extraMarkers: null };
  const still = () => !!R.reducedMotion;
  function applyTheme() {
    setDark(!!(mq && mq.matches));
    R.setStyle({ front: THEME.front, back: THEME.back, opacity: THEME.opacity, background: null });
  }
  stage.decorate = () => {
    if (!stage.scene) return;
    const lines = stage.scene.lines(), marks = stage.scene.markers();
    if (stage.extraLines) lines.push(...stage.extraLines());
    if (stage.extraMarkers) marks.push(...stage.extraMarkers());
    R.setLines(lines); R.setMarkers(marks);
  };
  stage.setScene = (scene, frame, immediate = true) => {
    stage.scene = scene;
    const { positions, indices } = scene.finish();
    R.setSurface({ positions, indices, tint: scene.tint ? scene.tint() : undefined });
    if (frame) R.setFrame(frame, immediate);
    stage.decorate();
    R.render();
  };
  stage.refresh = () => {
    if (!stage.scene) return;
    R.updatePositions(stage.scene.update());
    stage.decorate();
    R.render();
  };
  let anims = new Set();
  stage.animate = (seconds, step, done) => {
    if (still() || seconds <= 0) { step(1); stage.refresh(); if (done) done(); return () => {}; }
    const t0 = performance.now();
    const a = { id: 0, stop: false };
    const tick = (now) => {
      if (a.stop) return;
      // a hidden tab stalls frames: never jump more than 0.1 s of motion at once
      const u = Math.min(1, (now - t0) / (1000 * seconds));
      step(u); stage.refresh();
      if (u < 1) a.id = requestAnimationFrame(tick); else { anims.delete(a); if (done) done(); }
    };
    a.id = requestAnimationFrame(tick);
    anims.add(a);
    return () => { a.stop = true; cancelAnimationFrame(a.id); anims.delete(a); };
  };
  // Glide the camera so that the eye sits in the world direction `dir` from the frame's centre (z stays up-screen).
  let glide = null;
  stage.lookFrom = (dir, seconds = 0.7) => {
    if (glide) { glide(); glide = null; }
    const el = (Math.asin(Math.max(-0.985, Math.min(0.985, dir[2]))) * 180) / Math.PI, az = (Math.atan2(dir[0], -dir[1]) * 180) / Math.PI;
    const v0 = R.getView(), q1 = viewFromAzEl(az, el).q;
    if (!v0 || !v0.q) return;
    let q0 = v0.q.slice(), c = q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3];
    const b = c < 0 ? q1.map((x) => -x) : q1;
    c = Math.abs(c);
    if (c > 0.9995) return;
    const th = Math.acos(Math.min(1, c)), sn = Math.sin(th);
    const at = (u) => { const ka = Math.sin((1 - u) * th) / sn, kb = Math.sin(u * th) / sn; return [0, 1, 2, 3].map((i) => ka * q0[i] + kb * b[i]); };
    if (still() || seconds <= 0) { R.setView({ q: at(1), zoom: v0.zoom }); R.render(); return; }
    const t0 = performance.now();
    let id = 0, stop = false;
    const tick = (now) => {
      if (stop) return;
      const u = Math.min(1, (now - t0) / (1000 * seconds)), e = u * u * (3 - 2 * u);
      R.setView({ q: at(e), zoom: R.getView().zoom }); R.render();
      if (u < 1) id = requestAnimationFrame(tick); else glide = null;
    };
    id = requestAnimationFrame(tick);
    glide = () => { stop = true; cancelAnimationFrame(id); };
  };
  canvas.addEventListener('pointerdown', () => { if (glide) { glide(); glide = null; } });
  stage.stopAll = () => { for (const a of anims) { a.stop = true; cancelAnimationFrame(a.id); } anims = new Set(); };
  if (mq) { const on = () => { applyTheme(); stage.refresh(); }; if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on); }
  applyTheme();
  return stage;
}
