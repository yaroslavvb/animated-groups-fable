/* Shared playback core for the canvas animations (FilmGroupAnimation,
 * StripAnimation). Subclasses implement drawFrame(t), t in periods.
 *
 * PAUSED BY DEFAULT. Nothing on the site animates until the viewer asks for
 * it. Two separate channels decide whether frames are being generated:
 *
 *   playRequested — viewer intent, set only by play()/pause()/toggle() (the
 *                   overlay button, the control bar, the keyboard). This is
 *                   what the UI reflects: a running animation scrolled off
 *                   screen still reads as "playing".
 *   running       — the rAF loop is live. start()/stop() are the visibility
 *                   channel: the IntersectionObservers may call them freely,
 *                   but they must consult playRequested before starting, and
 *                   never touch it.
 *
 * A paused animation is not a blank canvas: drawStatic() paints the frozen
 * frame once, and scrubbing (setPhase / step) repaints while stopped.
 */
"use strict";

/* Where a paused animation sits before anyone touches it. Not 0: at t = 0 a
 * product group's vessels are all exactly empty, so the still frame would be
 * an outline drawing. A third of the way in, fill levels are visible and the
 * phase differences that distinguish the groups are legible while stopped. */
const START_PHASE = 0.3;

export class Playback {
  constructor(opts = {}) {
    this.period = opts.period || 4000;  // ms per time period
    this.running = false;
    this.playRequested = false;
    this.t0 = null;
    this.phase = opts.phase === undefined ? START_PHASE : opts.phase;
    this.onTick = null;      // callback(phase) for control widgets
    this._runListeners = []; // callback(anim) on any play/pause/start/stop
    this._raf = null;
    this._frame = this._frame.bind(this);
  }

  /* ---------------------------------------------------- viewer intent */
  play() { this.playRequested = true; this.start(); this._emitRun(); }
  pause() { this.playRequested = false; this.stop(); this._emitRun(); }
  toggle() { if (this.playRequested) this.pause(); else this.play(); }

  /* ------------------------------------ visibility (never sets intent) */
  start() {
    if (this.running) return;
    this.running = true;
    this.t0 = null;   // _frame resumes from this.phase
    this._raf = requestAnimationFrame(this._frame);
    this._emitRun();
  }
  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (!this.running) return;
    this.running = false;
    this._emitRun();
  }

  /* widgets subscribe here; the callback fires once immediately so a fresh
   * control starts in the right state */
  onRunChange(fn) { this._runListeners.push(fn); fn(this); return fn; }
  _emitRun() { for (const fn of this._runListeners) fn(this); }

  /* ---------------------------------------------------------- scrubbing */
  getPhase() { return this.phase; }
  setPhase(t) {
    this.phase = ((t % 1) + 1) % 1;
    this.t0 = null;   // if running, next frame re-anchors to the new phase
    if (!this.running) this.drawStatic();
  }
  /* step by dt periods; stepping is scrubbing, so it takes over from play */
  step(dt) { this.pause(); this.setPhase(this.phase + dt); }

  /* paint the frozen frame once (a paused canvas must never be blank) */
  drawStatic() {
    this.drawFrame(this.phase);
    if (this.onTick) this.onTick(this.phase);
  }

  _frame(ts) {
    if (!this.running) return;
    if (this.t0 === null) this.t0 = ts - this.phase * this.period;
    this.phase = (((ts - this.t0) / this.period) % 1 + 1) % 1;
    this.drawFrame(this.phase);
    if (this.onTick) this.onTick(this.phase);
    this._raf = requestAnimationFrame(this._frame);
  }
}
