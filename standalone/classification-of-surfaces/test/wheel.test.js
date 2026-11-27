// wheel.test.js — a trackpad's two-finger swipe turns; a pinch and a mouse wheel zoom (wheel.js, Sun 22 Nov 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { wheelKind, wheelSorter, MOUSE_STEP } from '../src/wheel.js';

const ev = (o) => ({ deltaMode: 0, deltaX: 0, deltaY: 0, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });

test('a trackpad swipe in Chrome or Safari: wheelDelta is -3 x delta', () => {
  assert.equal(wheelKind(ev({ deltaY: 2, deltaX: 0, wheelDeltaY: -6, wheelDeltaX: 0 })), 'swipe');
  assert.equal(wheelKind(ev({ deltaY: -7, deltaX: 3, wheelDeltaY: 21, wheelDeltaX: -9 })), 'swipe');
  assert.equal(wheelKind(ev({ deltaY: 1.5, deltaX: 0, wheelDeltaY: -4, wheelDeltaX: 0 })), 'swipe');   // rounding
  assert.equal(wheelKind(ev({ deltaY: 0, deltaX: -12, wheelDeltaY: 0, wheelDeltaX: 36 })), 'swipe');   // sideways only
});

test('a mouse wheel zooms: a macOS notch, a Windows notch, lines', () => {
  assert.equal(wheelKind(ev({ deltaY: MOUSE_STEP, wheelDeltaY: -120, wheelDeltaX: 0 })), 'wheel');
  assert.equal(wheelKind(ev({ deltaY: -3 * MOUSE_STEP, wheelDeltaY: 360, wheelDeltaX: 0 })), 'wheel');
  assert.equal(wheelKind(ev({ deltaY: 100, wheelDeltaY: -120, wheelDeltaX: 0 })), 'wheel');
  assert.equal(wheelKind(ev({ deltaY: -125, wheelDeltaY: 150, wheelDeltaX: 0 })), 'wheel');
  assert.equal(wheelKind(ev({ deltaMode: 1, deltaY: 3 })), 'wheel');
  assert.equal(wheelKind(ev({ deltaMode: 2, deltaY: 1 })), 'wheel');
});

test('a pinch is ctrl+wheel; other modifier keys leave the wheel alone', () => {
  assert.equal(wheelKind(ev({ ctrlKey: true, deltaY: 1.2, wheelDeltaY: -4, wheelDeltaX: 0 })), 'pinch');
  assert.equal(wheelKind(ev({ shiftKey: true, deltaY: 2, wheelDeltaY: -6, wheelDeltaX: 0 })), 'wheel');
  assert.equal(wheelKind(ev({ metaKey: true, deltaY: 2, wheelDeltaY: -6, wheelDeltaX: 0 })), 'wheel');
});

test('no wheelDelta (Firefox): only a sideways scroll is a swipe', () => {
  assert.equal(wheelKind(ev({ deltaY: 4 })), 'wheel');
  assert.equal(wheelKind(ev({ deltaY: 4, deltaX: 2 })), 'swipe');
  assert.equal(wheelKind(ev({})), 'wheel');
});

test('one gesture keeps the kind of its first event; a pause starts a new one', () => {
  const sort = wheelSorter();
  assert.equal(sort(ev({ deltaY: 2, wheelDeltaY: -6, wheelDeltaX: 0 }), 0), 'swipe');
  // a momentum event that happens to look like a notch stays part of the swipe
  assert.equal(sort(ev({ deltaY: MOUSE_STEP, wheelDeltaY: -12, wheelDeltaX: 0 }), 16), 'swipe');
  assert.equal(sort(ev({ deltaY: 1, wheelDeltaY: -3, wheelDeltaX: 0 }), 32), 'swipe');
  // after a pause, a mouse notch is a wheel again
  assert.equal(sort(ev({ deltaY: MOUSE_STEP, wheelDeltaY: -120, wheelDeltaX: 0 }), 500), 'wheel');
  assert.equal(sort(ev({ deltaY: 2, wheelDeltaY: -6, wheelDeltaX: 0 }), 520), 'wheel');
  // a pinch is always a pinch, and the next swipe starts afresh
  assert.equal(sort(ev({ ctrlKey: true, deltaY: 1 }), 540), 'pinch');
  assert.equal(sort(ev({ deltaY: 2, wheelDeltaY: -6, wheelDeltaX: 0 }), 560), 'swipe');
});
