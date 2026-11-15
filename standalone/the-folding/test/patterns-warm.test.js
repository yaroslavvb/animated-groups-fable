// test/patterns-warm.test.js — the prints of the other groups, made while the page is idle (src/patterns/warm.js; 14 Nov
// 2026, the pattern round: a group change must not freeze the page while a shape pattern's find runs). A fake scheduler
// and a fake clock: one group per idle slot, the groups after the shown one first; none within `quiet` of a poke, none
// in a short slot; another pattern drops the queue AT ONCE (its pending slot too); the shown group is not made again; a
// made print costs no slot; stop. Then the real thing: printFor's cache holds every group's print when the slots ran.
// Since the review of 15 Nov 2026: a hidden page makes nothing and asks for no slot (warm takes the queue up when it
// shows); a slot must hold the longest print of the pattern so far (never more than 0.9 of the longest slot there is);
// Safari's timeout chain says a slot is empty when its timer came late (the main thread was busy).
//   node --test test/patterns-warm.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID } from '../src/groups.js';
import { printFor, printCached } from '../src/pattern.js';
import { createWarmer, idleScheduler, IDLE_FALLBACK, IDLE_LONGEST, QUIET_MS, MIN_SLOT_MS } from '../src/patterns/warm.js';

/** A fake page: a clock that only moves when told, idle slots that run only when told (each with `left` ms in it). */
function fakePage() {
  let t = 0, next = 1;
  const slots = new Map();                          // handle -> callback, in the order they were asked for
  return {
    now: () => t,
    advance(ms) { t += ms; },
    idle: (cb) => { const h = next++; slots.set(h, cb); return h; },
    cancel: (h) => { slots.delete(h); },
    pending: () => slots.size,
    /** Run the slots that are waiting now (not the ones they ask for), each with `left` ms of idle time. */
    run(left = 50) {
      const now = [...slots.entries()];
      slots.clear();
      for (const [, cb] of now) cb({ didTimeout: false, timeRemaining: () => left });
      return now.length;
    },
  };
}

const IDS = ['a', 'b', 'c', 'd', 'e'];

test('warm: one group per idle slot, the ones after the shown group first, then round; nothing within `quiet` of a poke; a short slot is passed over', () => {
  const F = fakePage(), made = [];
  const W = createWarmer({ ids: IDS, prepare: (id, key) => { made.push(`${id}:${key}`); F.advance(7); }, idle: F.idle, cancel: F.cancel, now: F.now, quiet: 100, minSlot: 30 });
  W.poke();
  W.warm('p', 'c');
  assert.equal(F.pending(), 1, 'one slot asked for');
  F.run();
  assert.deepEqual(made, [], 'a poke a moment ago: the slot is passed over');
  assert.equal(W.state().passed, 1);
  F.advance(100);
  F.run(20);
  assert.deepEqual(made, [], 'a slot with 20 ms left (between two frames): passed over');
  F.run(50);
  assert.deepEqual(made, ['d:p'], 'one group per slot: the one after the shown group');
  for (let i = 0; i < 3; i++) F.run(50);
  assert.deepEqual(made, ['d:p', 'e:p', 'a:p', 'b:p'], 'then round to the ones before it; never the shown one');
  assert.equal(F.pending(), 0, 'nothing left: no slot is asked for');
  const s = W.state();
  assert.deepEqual([s.key, s.left, s.made, s.slots, s.ms, s.maxMs], ['p', 0, 4, 4, 28, 7]);
  // a poke in the middle: the next slot waits again
  W.warm('q', 'a');
  F.run(50);
  assert.equal(made.length, 5);
  W.poke();
  F.run(50);
  assert.equal(made.length, 5, 'poked: waits');
  F.advance(99);
  F.run(50);
  assert.equal(made.length, 5, 'still within quiet');
  F.advance(1);
  F.run(50);
  assert.equal(made.length, 6);
});

test('warm: another pattern drops the queue at once, its pending slot too; the same pattern keeps it and takes the shown group out; a print made already costs no slot', () => {
  const F = fakePage(), made = [], have = new Set();
  const W = createWarmer({ ids: IDS, prepare: (id, key) => { made.push(`${id}:${key}`); have.add(`${id}:${key}`); }, ready: (id, key) => have.has(`${id}:${key}`), idle: F.idle, cancel: F.cancel, now: F.now, quiet: 0, minSlot: 0 });
  W.warm('p', 'a');
  F.run();
  assert.deepEqual(made, ['b:p']);
  assert.equal(F.pending(), 1);
  // the pattern changes: the slot that was asked for is cancelled and the queue is the new pattern's
  W.warm('q', 'a');
  assert.equal(F.pending(), 1, 'one slot, the new one');
  F.run();
  assert.deepEqual(made, ['b:p', 'b:q'], 'nothing more of the old pattern');
  // the person shows d: the same pattern, d is taken out (the page has just made it)
  have.add('d:q');
  W.warm('q', 'd');
  F.run();
  assert.deepEqual(made, ['b:p', 'b:q', 'c:q'], 'the queue kept its order');
  F.run();
  assert.deepEqual(made, ['b:p', 'b:q', 'c:q', 'e:q'], 'd was skipped');
  // back to the first pattern: b was made before, so it costs no slot
  W.warm('p', 'a');
  F.run();
  assert.deepEqual(made.slice(4), ['c:p'], 'b:p was made already: skipped within the slot');
  assert.ok(W.state().skipped >= 1);
  // stop: nothing more, the pending slot is cancelled
  W.stop();
  assert.equal(F.pending(), 0);
  F.run();
  assert.equal(made.length, 5);
  assert.equal(W.state().key, null);
  // and it starts again with warm
  W.warm('p', 'a');
  F.run();
  assert.deepEqual(made.slice(5), ['d:p']);
});

test('warm: what prepare throws is kept (twenty at most) and the queue goes on; createWarmer needs its functions', () => {
  const F = fakePage();
  const W = createWarmer({ ids: IDS, prepare: (id) => { if (id === 'b') throw new Error('no motif\nfor b'); }, idle: F.idle, cancel: F.cancel, now: F.now, quiet: 0, minSlot: 0 });
  W.warm('p', 'a');
  for (let i = 0; i < 6; i++) F.run();
  assert.deepEqual(W.state().errors, ['b p: no motif']);
  assert.equal(W.state().made, 4);
  assert.throws(() => createWarmer({ ids: IDS, idle: F.idle, cancel: F.cancel, now: F.now }), TypeError);
});

test('warm: the page\'s scheduler — requestIdleCallback where there is one, else a chain of short timeouts that says IDLE_FALLBACK.slot ms', async () => {
  const calls = [];
  const win = { requestIdleCallback: (cb) => { calls.push('ric'); return 7; }, cancelIdleCallback: (h) => calls.push('cancel ' + h) };
  const S = idleScheduler(win);
  assert.equal(S.native, true);
  assert.equal(S.idle(() => {}), 7); S.cancel(7);
  assert.deepEqual(calls, ['ric', 'cancel 7']);
  // Safari: no requestIdleCallback
  const T = idleScheduler({ setTimeout, clearTimeout, performance });
  assert.equal(T.native, false);
  // (0 when the timer came late on a busy machine: the next test holds the clock and checks both)
  const left = await new Promise((resolve) => T.idle((d) => resolve(d.timeRemaining())));
  assert.ok(left >= 0 && left <= IDLE_FALLBACK.slot, `${left} ms`);
  let ran = false;
  const h = T.idle(() => { ran = true; });
  T.cancel(h);
  await new Promise((r) => setTimeout(r, IDLE_FALLBACK.every + 30));
  assert.equal(ran, false, 'cancelled');
  assert.ok(QUIET_MS >= 200 && MIN_SLOT_MS >= 20 && IDLE_FALLBACK.slot >= MIN_SLOT_MS, 'a fallback slot is long enough to be used');
});

test('warm: a hidden page makes nothing — no slot asked for while hidden, a slot that comes then makes nothing and asks for no other; warm, when the page shows again, takes the queue up where it was', () => {
  const F = fakePage(), made = [];
  let hid = false;
  const W = createWarmer({ ids: IDS, prepare: (id, key) => made.push(`${id}:${key}`), idle: F.idle, cancel: F.cancel, now: F.now, quiet: 0, minSlot: 0, hidden: () => hid });
  W.warm('p', 'a');
  F.run();
  assert.deepEqual(made, ['b:p']);
  assert.equal(F.pending(), 1, 'the next slot is asked for');
  hid = true;                                       // another tab in front: the slot asked for comes anyway
  F.run();
  assert.deepEqual(made, ['b:p'], 'the slot that came while hidden made nothing');
  assert.equal(F.pending(), 0, '... and asked for no other');
  W.warm('p', 'c');
  W.warm('q', 'c');
  assert.equal(F.pending(), 0, 'hidden: a group or pattern change asks for no slot either');
  assert.equal(W.state().key, 'q');
  hid = false;                                      // shown again: the page calls warm with what it shows
  W.warm('q', 'c');
  assert.equal(F.pending(), 1);
  for (let i = 0; i < 6; i++) F.run();
  assert.deepEqual(made, ['b:p', 'd:q', 'e:q', 'a:q', 'b:q'], 'the queue of the pattern on screen, in its order');
  assert.equal(W.state().left, 0);
});

test('warm: a slot must hold the longest print of the pattern so far — but no more than 0.9 of the longest slot there is (a print longer than any slot takes a whole idle period, it does not wait for ever)', () => {
  const F = fakePage(), made = [];
  let cost = 35;
  const W = createWarmer({ ids: IDS, prepare: (id) => { made.push(id); F.advance(cost); }, idle: F.idle, cancel: F.cancel, now: F.now, quiet: 0, minSlot: 30, longest: 50 });
  W.warm('p', 'a');
  F.run(31);
  assert.deepEqual(made, ['b'], 'the first print: nothing known yet, minSlot holds');
  F.run(31);
  assert.deepEqual(made, ['b'], 'it took 35 ms: a slot with 31 ms left is passed over');
  assert.equal(W.state().passed, 1);
  F.run(36);
  assert.deepEqual(made, ['b', 'c'], 'one with 36 ms left takes the next');
  cost = 80;                                        // a print longer than any idle period (a phone)
  F.run(36);
  assert.deepEqual(made, ['b', 'c', 'd']);
  F.run(44);
  assert.deepEqual(made, ['b', 'c', 'd'], 'after an 80 ms print: 44 ms left is too short ...');
  F.run(45);
  assert.deepEqual(made, ['b', 'c', 'd', 'e'], '... 45 (0.9 of the longest slot, 50) is enough');
  W.warm('q', 'a');                                 // another pattern: what its prints cost is not known yet
  F.run(31);
  assert.deepEqual(made, ['b', 'c', 'd', 'e', 'b']);
  // the longest slot of Safari's chain (40 ms): a long print needs 36, which every on-time slot of the chain has
  const S = createWarmer({ ids: IDS, prepare: (id) => { made.push('S' + id); F.advance(80); }, idle: F.idle, cancel: F.cancel, now: F.now, quiet: 0, minSlot: MIN_SLOT_MS, longest: IDLE_FALLBACK.slot });
  W.stop();
  S.warm('p', 'a');
  F.run(IDLE_FALLBACK.slot); F.run(IDLE_FALLBACK.slot);
  assert.deepEqual(made.slice(-2), ['Sb', 'Sc'], 'a slow print still goes on in Safari\'s chain');
});

test('warm: Safari\'s timeout chain — a timer that comes more than IDLE_FALLBACK.late ms after it was due says its slot is empty (the main thread was busy); requestIdleCallback\'s longest slot is IDLE_LONGEST', () => {
  let t = 1000;
  const timers = [];
  const win = { setTimeout: (f, ms) => { timers.push({ f, at: t + ms }); return timers.length; }, clearTimeout: () => {}, performance: { now: () => t } };
  const S = idleScheduler(win);
  assert.equal(S.native, false);
  assert.equal(S.longest, IDLE_FALLBACK.slot);
  let left = null;
  S.idle((d) => { left = d.timeRemaining(); });
  t = timers[0].at + 3; timers[0].f();
  assert.equal(left, IDLE_FALLBACK.slot, 'on time: the whole slot');
  S.idle((d) => { left = d.timeRemaining(); });
  t = timers[1].at + IDLE_FALLBACK.late + 1; timers[1].f();
  assert.equal(left, 0, 'late: none');
  // the warmer passes such a slot over and asks for the next
  const made = [];
  const W = createWarmer({ ids: IDS, prepare: (id) => made.push(id), idle: S.idle, cancel: S.cancel, now: () => t, quiet: 0, longest: S.longest });
  W.warm('p', 'a');
  t = timers[2].at + 40; timers[2].f();
  assert.deepEqual(made, [], 'a late timer: nothing made');
  assert.equal(timers.length, 4, 'the next slot is asked for');
  t = timers[3].at + 1; timers[3].f();
  assert.deepEqual(made, ['b']);
  assert.equal(idleScheduler({ requestIdleCallback: () => 1, cancelIdleCallback: () => {} }).longest, IDLE_LONGEST);
  assert.ok(0.9 * IDLE_FALLBACK.slot >= MIN_SLOT_MS && 0.9 * IDLE_LONGEST >= MIN_SLOT_MS, 'the cap is above the floor');
});

test('warm: the real prints — after the idle slots ran, every other group\'s print of the pattern is in printFor\'s cache (a group change finds it made)', () => {
  const F = fakePage();
  const key = 'tomoe', ids = GROUPS.map((g) => g.id);
  const W = createWarmer({ ids, prepare: (id, k) => { printFor(BY_ID[id], k); }, ready: (id, k) => printCached(BY_ID[id], k), idle: F.idle, cancel: F.cancel, now: () => performance.now(), quiet: 0, minSlot: 0 });
  printFor(BY_ID['333'], key);                     // the shown group: the page made it
  const before = ids.filter((id) => printCached(BY_ID[id], key));
  W.warm(key, '333');
  let slots = 0;
  while (F.pending() && slots < 100) { F.run(); slots++; }
  const s = W.state();
  assert.ok(ids.every((id) => printCached(BY_ID[id], key)), 'every group\'s print is made');
  assert.equal(s.made + s.skipped, 16, 'the other sixteen');
  assert.equal(s.made, 16 - (before.length - 1), 'one slot per group that was not made yet');
  assert.ok(ids.every((id) => printFor(BY_ID[id], key) && printFor(BY_ID[id], key).kind === 'shapes'));
  assert.deepEqual(s.errors, []);
});
