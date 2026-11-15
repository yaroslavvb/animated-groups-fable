// src/patterns/warm.js — the prints of the other groups, made while the page is idle (14 Nov 2026, the pattern round).
// A shape print costs its find, makeShapePrint and printable the first time a group shows it (src/pattern.js printFor:
// 1 to 16 ms in Chrome on the mini, Soft commas the most since Paisley draws a table (15 Nov); two to four times that on
// a phone), on top of the rest of a group change. Once the page is idle the CURRENT pattern's print of every other group
// is made, ONE group per idle slot, so a group change finds it in printFor's cache. Not the texture: src/shapes.js
// bakeShapes keeps only BAKE_KEEP of them, and the 3D view bakes the one it shows.
//
//   createWarmer({ ids, prepare, ready, idle, cancel, now, quiet, minSlot, longest, hidden }) -> W
//     ids               the groups, in the order they are made after the shown one (the page: the picker's order)
//     prepare(id, key)  makes the print (the page: printFor(BY_ID[id], key)); what it throws is kept in W.state().errors
//     ready(id, key)    true when there is nothing to make (the page: printCached): skipped without a slot
//     idle(cb)          runs cb(deadline) in an idle slot, -> a handle; deadline.timeRemaining() in ms
//     cancel(handle)    the slot is not wanted
//     now()             ms
//     quiet             a slot is used only when nothing happened for this long (W.poke(): an input, a frame drawn)
//     minSlot           ... and only when the slot has at least this long left: a short slot between two frames of a
//                       play or a drag is passed over, so a print is never made in the middle of the person's gesture;
//                       and at least as long as the longest print of the pattern so far (the review of 15 Nov: a 35 ms
//                       print started with 31 ms left ran past its slot) ...
//     longest           ... but never more than 0.9 of this, the longest slot the scheduler gives (idleScheduler's
//                       `longest`), or a print longer than any slot would wait for ever: it takes a whole idle period
//     hidden()          true while the page is hidden (another tab in front): nothing is made and no slot asked for;
//                       W.warm, when it shows again, takes the queue up (the review of 15 Nov: a hidden page went on)
//   W.warm(key, shownId)  the page shows the group shownId with the pattern key: make the others' prints. Another key
//                         than before drops at once what was queued for the old one (and its slot); the same key keeps
//                         the queue (the shown group is taken out of it: the page has just made it)
//   W.poke()              something happened: the next slot waits `quiet` ms
//   W.stop()              drops the queue and its slot: nothing more is made until W.warm, which the page calls on every
//                         group or pattern change (to time a change with nothing made ahead, stop it after each one)
//   W.state()             { key, left, made, skipped, ms, maxMs, slots, passed, errors }: what is queued and what was
//                         made, the time spent making them (the longest one), the slots used and passed over
//
// The page (src/app.js) gives it window.requestIdleCallback where there is one, and else — Safari has none — a chain of
// short timeouts (idleScheduler) whose deadline says IDLE_FALLBACK.slot ms, or none when its timer came more than
// IDLE_FALLBACK.late ms late: the main thread was busy (Safari's only sign of it). Pure: no DOM;
// test/patterns-warm.test.js drives it with a fake scheduler and clock.

/** Without requestIdleCallback: a slot every `every` ms, which says it has `slot` ms (a slot is one group's print) —
 *  0 when its timer came more than `late` ms after it was due. */
export const IDLE_FALLBACK = Object.freeze({ every: 120, slot: 40, late: 15 });
/** The longest idle period requestIdleCallback gives (50 ms: the spec's, and Chrome's when nothing else is due). */
export const IDLE_LONGEST = 50;
/** The page's settings: nothing for QUIET_MS after an input or a frame; a slot must have MIN_SLOT_MS left. */
export const QUIET_MS = 400, MIN_SLOT_MS = 30;

/**
 * { idle, cancel, native, longest } of a window: requestIdleCallback where there is one (longest: IDLE_LONGEST), else a
 * setTimeout chain (IDLE_FALLBACK; longest: its slot).
 */
export function idleScheduler(win) {
  if (win && typeof win.requestIdleCallback === 'function' && typeof win.cancelIdleCallback === 'function') {
    return { idle: (cb) => win.requestIdleCallback(cb), cancel: (h) => win.cancelIdleCallback(h), native: true, longest: IDLE_LONGEST };
  }
  const st = (win && win.setTimeout) ? win.setTimeout.bind(win) : setTimeout, ct = (win && win.clearTimeout) ? win.clearTimeout.bind(win) : clearTimeout;
  const clock = () => (win && win.performance && win.performance.now ? win.performance.now() : Date.now());
  return {
    idle: (cb) => {
      const due = clock() + IDLE_FALLBACK.every;
      return st(() => {
        const t0 = clock(), busy = t0 - due > IDLE_FALLBACK.late;
        cb({ didTimeout: false, timeRemaining: () => (busy ? 0 : Math.max(0, IDLE_FALLBACK.slot - (clock() - t0))) });
      }, IDLE_FALLBACK.every);
    },
    cancel: (h) => ct(h), native: false, longest: IDLE_FALLBACK.slot,
  };
}

export function createWarmer({ ids, prepare, ready = () => false, idle, cancel, now, quiet = QUIET_MS, minSlot = MIN_SLOT_MS, longest = IDLE_LONGEST, hidden = () => false }) {
  if (typeof prepare !== 'function' || typeof idle !== 'function' || typeof cancel !== 'function' || typeof now !== 'function') throw new TypeError('createWarmer: prepare, idle, cancel and now are functions');
  const order = Array.from(ids || []);
  let key = null, queue = [], handle = null, last = -Infinity, stopped = false;
  let est = 0;                                     // the longest print of this pattern so far (ms): a slot must hold it
  const st = { made: 0, skipped: 0, ms: 0, maxMs: 0, slots: 0, passed: 0, errors: [] };

  function schedule() {
    if (handle !== null || stopped || !queue.length || hidden()) return;
    handle = idle(slot);
  }
  function drop() { if (handle !== null) { cancel(handle); handle = null; } }
  function slot(deadline) {
    handle = null;
    if (stopped || !queue.length || hidden()) return;          // (hidden: no slot until W.warm, when the page shows)
    const left = deadline && typeof deadline.timeRemaining === 'function' ? deadline.timeRemaining() : Infinity;
    // something happened a moment ago, or the slot is too short for a print of this pattern: the next one
    const need = Math.min(Math.max(minSlot, est), 0.9 * longest);
    if (now() - last < quiet || left < need) { st.passed++; schedule(); return; }
    // the groups made meanwhile (shown, or made by an earlier slot) cost no slot
    while (queue.length && ready(queue[0], key)) { queue.shift(); st.skipped++; }
    if (queue.length) {
      const id = queue.shift(), t0 = now();
      try { prepare(id, key); } catch (e) { if (st.errors.length < 20) st.errors.push(`${id} ${key}: ${String((e && e.message) || e).split('\n')[0]}`); }
      const ms = now() - t0;
      st.made++; st.slots++; st.ms += ms; if (ms > st.maxMs) st.maxMs = ms; if (ms > est) est = ms;
    }
    schedule();
  }

  return {
    warm(k, shownId) {
      stopped = false;
      if (k !== key) {
        drop();
        key = k;
        est = 0;
        // the groups after the shown one first, in the page's order, then round to the ones before it
        const at = order.indexOf(shownId);
        queue = at < 0 ? order.slice() : order.slice(at + 1).concat(order.slice(0, at));
      } else queue = queue.filter((id) => id !== shownId);
      schedule();
    },
    poke() { last = now(); },
    stop() { stopped = true; drop(); queue = []; key = null; },
    state() { return { key, left: queue.length, made: st.made, skipped: st.skipped, ms: Math.round(st.ms * 10) / 10, maxMs: Math.round(st.maxMs * 10) / 10, slots: st.slots, passed: st.passed, errors: st.errors.slice() }; },
  };
}
