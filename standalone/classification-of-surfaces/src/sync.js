// sync.js — one screen drives the others.
//
// His ask (Tue 17 Nov 2026): "Make this collaborative so that multiple people can drag it and see the results,
// similar to how this page was done. https://spacesheep.dev/@misha/the-folding-synced". That page uses spacesheep's
// page stream, and so does this one: the page declares a stream it may write
// (<meta name="ss-streams" content="NAME" data-push="NAME">, in index.template.html), the open page of the space's
// OWNER pushes its state into it, and every other screen that has the page open draws what arrives, signed-out
// readers included. spacesheep refuses anyone else's push, so a reader's screen follows and cannot lead: that is the
// service's rule (its route checks the caller is the owner), not a choice made here. Whoever is signed in as the
// owner leads from whichever of their screens they touched last. Outside spacesheep (the tailnet copy) there is no
// window.ss, and nothing here runs.
//
//   const sync = createSync({ stream, snapshot, apply, chip });
//     stream      window.ss.stream(NAME), or null
//     snapshot()  the page's state as a small plain object (app.js: the tab, what its address holds, the views)
//     apply(s)    put the page in that state
//     chip        the button in the header: it says what this screen is doing, and a tap turns following off and on
//   sync.state()  for the tests
//
// The rules, as spacesheep's notes give them: push state, not events; at most about 15 values a second while
// something moves; one every second or two while nothing does, so that a screen that opens late catches up; put an id
// for this tab in the value and ignore the value when it comes back.

const STEP = 70;                    // ms between looks at the page's state while this screen drives
const BEAT = 1500;                  // ms between sends while that state is not changing
const QUIET = 30 * 60 * 1000;       // ms after the last touch for which a still screen goes on saying where it is
const LIVE = 4000;                  // ms since a value arrived for which this screen counts as following someone
const HAND = 250;                   // ms after a touch of one's own for which an arriving value is not taken
const STORE = 'classification-of-surfaces.sync';

const TEXT = {
  live: ['Live', 'Every screen that has this page open follows yours. Tap to stop: nothing is sent, nothing followed.'],
  following: ['Following', 'This screen follows the presenter’s. Tap to go solo.'],
  synced: ['Synced', 'When the page’s owner presents, this screen follows. Tap to go solo.'],
  solo: ['Solo', 'This screen is on its own. Tap to follow the presenter again.'],
};

export function createSync({ stream, snapshot, apply, chip }) {
  const me = Math.random().toString(36).slice(2, 10);
  let mode = 'synced';              // or 'solo': neither sends nor follows
  let driver = false;               // this screen was touched last, so its state is the one to send
  let canPush = null;               // null until spacesheep has answered a push: true for the owner, false for a reader
  let confirmed = false, applying = false;
  let lastInput = -1e9, down = 0;   // this screen's own hand (performance.now(); pointers held)
  let heard = 0, shared = null;     // the last value from another screen, and when (Date.now())
  let applied = '';                 // the state last taken from another screen, as text
  let sent = '', lastSend = 0, busy = false, again = false;

  const usable = (v) => !!v && typeof v === 'object' && v.k === 'c' && typeof v.c === 'string' && !!v.s && typeof v.s === 'object' && typeof v.s.tab === 'string';

  function label() {
    if (!chip) return;
    const leading = mode === 'synced' && driver && canPush === true && confirmed;
    const key = !stream ? 'none' : mode === 'solo' ? 'solo' : leading ? 'live' : Date.now() - heard < LIVE ? 'following' : 'synced';
    if (chip.dataset.state === key) return;
    chip.dataset.state = key;
    chip.hidden = key === 'none';
    if (key === 'none') return;
    chip.querySelector('.sync-t').textContent = TEXT[key][0];
    chip.title = TEXT[key][1];
    chip.setAttribute('aria-label', TEXT[key][0] + '. ' + TEXT[key][1]);
    chip.setAttribute('aria-pressed', String(mode === 'synced'));
  }

  function take(v) {
    applied = JSON.stringify(v.s);
    applying = true;
    try { apply(v.s); } catch (e) { console.error('[sync] could not show the presenter’s state', e); }
    applying = false;
  }
  // A value from another screen is taken when it says something new. One that only repeats the last (the presenter's
  // beat while nothing moves) is not taken again, so a reader who has wandered off is left alone until the presenter
  // moves; and never while this screen's own hand is on it.
  function follow(v) {
    heard = Date.now(); shared = v;
    if (mode === 'synced' && !(down > 0 || performance.now() - lastInput < HAND) && JSON.stringify(v.s) !== applied) { driver = false; take(v); }
    label();
  }

  /** Send where this screen is, if it has moved since the last send (or force: say it again). One send at a time; the newest state waits. */
  function flush(force) {
    if (!stream || mode !== 'synced' || !driver || canPush === false || applying) return;
    if (busy) { again = true; return; }
    let s, body;
    try { s = snapshot(); body = JSON.stringify(s); } catch (e) { return; }
    if (!s || (body === sent && !force)) return;
    sent = body; lastSend = Date.now(); busy = true;
    stream.push({ k: 'c', c: me, s }).then((r) => {
      if (r && r.ok) { canPush = true; confirmed = true; }
      else if (r && (r.status === 'refused' || r.status === 'unheard')) { canPush = false; driver = false; }      // a reader, or not on spacesheep: this screen follows
    }, () => {}).then(() => { busy = false; label(); if (again) { again = false; flush(false); } });
  }
  setInterval(() => {
    if (driver && mode === 'synced' && canPush !== false && !document.hidden && performance.now() - lastInput < QUIET) flush(Date.now() - lastSend > BEAT);
    label();
  }, STEP);

  // A real touch makes this screen the one that drives (if spacesheep lets it: the first push says so).
  const mine = (e) => {
    if (!e.isTrusted || (chip && e.target && e.target.closest && e.target.closest('#' + chip.id))) return;
    lastInput = performance.now();
    if (mode === 'synced' && canPush !== false) driver = true;
  };
  for (const t of ['pointerdown', 'keydown', 'input', 'change', 'wheel', 'touchstart']) document.addEventListener(t, mine, { capture: true, passive: true });
  document.addEventListener('pointerdown', () => { down++; }, true);
  for (const t of ['pointerup', 'pointercancel']) document.addEventListener(t, () => { down = Math.max(0, down - 1); lastInput = performance.now(); }, true);
  window.addEventListener('blur', () => { down = 0; });

  // Values from other screens. A screen that opens while someone presents hears the presenter within a second (the
  // beat above) and goes there; with nobody presenting it stays on the address it was opened with: the stream's
  // last value may be hours old, and is not asked for.
  if (stream) stream.on((v) => { if (usable(v) && v.c !== me) follow(v); });

  function setMode(m) {
    if (m === mode) return;
    mode = m; driver = false;
    if (m === 'synced' && shared && Date.now() - heard < LIVE) take(shared);          // back to where the room is
    try { window.localStorage.setItem(STORE, m); } catch (e) { /* not kept, that is all */ }
    label();
  }
  if (chip) chip.addEventListener('click', () => setMode(mode === 'synced' ? 'solo' : 'synced'));
  try { if (window.localStorage.getItem(STORE) === 'solo') mode = 'solo'; } catch (e) { /* no storage here: synced */ }
  label();

  return { setMode, state: () => ({ on: !!stream, mode, driver, canPush, confirmed, me, following: Date.now() - heard < LIVE, sends: lastSend }) };
}
