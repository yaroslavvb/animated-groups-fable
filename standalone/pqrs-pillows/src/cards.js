// cards.js — the three partition cards of PQRS pillows: PQ|RS, PR|QS, PS|QR, each with its loop's Length and Twist.
// DOM only; it knows nothing of the geometry. The page hands it `cards` (state.js cardsOf: FIXED order, keyed by
// pairing) after every change, and is told what the reader did:
//
//   const ui = createCards(host, { onActivate(key), onInput(key, { L } | { tw }, { dragging, range }), format? });
//   ui.update(cards, state)         every card refreshed: its name, both sliders and numbers
//                                   (state: the engine's, read only for the features' orders: "P3 Q3 | R3 S3")
//
// THE THREE CARDS ARE EQUALS (his ask, Fri 27 Nov 2026, 22:55: "when I switch between sliders, there shouldn't be
// any change. The only change will be when I'm actually moving the slider"). Each wears its partition's own colour
// (colors.js, page.css --pq-part-1 … 3: the colour of its seals and its loop in both panes), always. No card looks
// "active": which loop is the engine's cut is bookkeeping (data-active says it, for the checks; nothing is styled by
// it), and grabbing another card's slider changes nothing until the slider moves.
//
// `range` is the slider's own [lo, hi] at the moment of the grab: a Length slider's range follows its number, and
// is held still while a finger is on it. `format` = { length(L), twist(tw) } -> text (the default: three decimals).
//
// A slider of a card that is not the cut can be grabbed at once: its pointerdown first calls onActivate(key) (the
// page makes that partition the cut: a flip, nothing on the page changes), and the drag goes on in the same
// gesture. Under a finger the activation waits for the slider's first movement (onInput for a card that is not
// the cut: the page activates it first), so that scrolling the page across the cards flips nothing. The sliders are
// native ranges (as on The real 2222), 44 px tall; the arrow keys move a focused slider (Shift: a fine step), Page
// Up / Down ten steps, Home / End the ends.

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const TW_TICKS = [-0.5, -0.25, 0, 0.25, 0.5];

/** A Twist as the cards print it: signed, three decimals, a true minus, never "-0.000". */
export function twistText(tw) {
  const v = Number(Number(tw).toFixed(3));
  return (v < 0 ? '\u2212' : '+') + Math.abs(v).toFixed(3);
}
export const lengthText = (L) => Number(L).toFixed(3);

export function createCards(host, opts = {}) {
  const onActivate = opts.onActivate || (() => {}), onInput = opts.onInput || (() => {});
  let labelOf = opts.labelOf || ((f) => 'PQRS'[f]);
  let flat = false;
  const fmtL = (opts.format && opts.format.length) || lengthText, fmtTw = (opts.format && opts.format.twist) || twistText;
  const doc = host.ownerDocument;
  const el = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const slots = [];          // one per card, in the order first given
  let current = [];          // the cards last shown

  function sliderRow(slot, which) {
    const row = el('label', 'pq-srow');
    const name = el('span', 'pq-slabel', which === 'L' ? 'Length' : 'Twist');
    const sub = which === 'L' ? el('small', '', '') : null;
    if (sub) { sub.hidden = true; name.appendChild(sub); }
    const wrap = el('span', 'pq-swrap');
    const input = el('input');
    input.type = 'range';
    input.step = '0.001';
    if (which === 'tw') { input.min = '-0.5'; input.max = '0.5'; }
    wrap.appendChild(input);
    if (which === 'tw') {
      const ticks = el('span', 'pq-sticks');
      ticks.setAttribute('aria-hidden', 'true');
      for (const t of TW_TICKS) { const i = el('i'); i.style.left = `${(t + 0.5) * 100}%`; ticks.appendChild(i); }
      wrap.appendChild(ticks);
    }
    const out = el('output', 'pq-sval');
    const num = el('span', '', ''), unit = which === 'tw' ? el('small', '', ' turn') : null;
    out.appendChild(num);
    if (unit) out.appendChild(unit);
    row.append(name, wrap, out);

    const S = { which, row, input, num, sub, value: 0, range: [0, 1], held: false };
    const send = (v, dragging) => {
      const x = clamp(v, S.range[0], S.range[1]);
      onInput(slot.key, which === 'L' ? { L: x } : { tw: x }, { dragging, range: S.range.slice() });
    };
    // a grab: the card becomes the active one before the first movement. (A finger may only be scrolling the page
    // past the cards: there the card is made active by the first movement of the slider itself, through onInput.)
    input.addEventListener('pointerdown', (e) => { S.held = true; if (!slot.active && !(e && e.pointerType === 'touch')) onActivate(slot.key); });
    const release = () => { S.held = false; };
    input.addEventListener('pointerup', release);
    input.addEventListener('pointercancel', release);
    input.addEventListener('input', () => send(parseFloat(input.value), S.held));
    input.addEventListener('change', () => { S.held = false; send(parseFloat(input.value), false); });
    input.addEventListener('keydown', (e) => {
      const span = S.range[1] - S.range[0], coarse = which === 'L' ? 0.02 : 0.01, step = e.shiftKey ? 0.001 : coarse;
      let v = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = S.value + step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = S.value - step;
      else if (e.key === 'PageUp') v = S.value + 10 * coarse;
      else if (e.key === 'PageDown') v = S.value - 10 * coarse;
      else if (e.key === 'Home') v = S.range[0];
      else if (e.key === 'End') v = S.range[1];
      if (v === null || !(span > 0)) return;
      e.preventDefault();
      send(Math.round(v * 1000) / 1000, false);
    });
    return S;
  }

  function build(card, index) {
    const slot = { key: card.key, active: false };
    const root = el('article', 'pq-card');
    root.dataset.key = card.key;
    root.dataset.part = String(index + 1);           // the partition's colour (page.css), fixed for good
    const head = el('div', 'pq-card-head');
    const id = el('span', 'pq-card-id');
    // a short piece of the partition's line, then its two pairs; the pair with P is always written first
    const swatch = el('i', 'pq-swatch');
    swatch.setAttribute('aria-hidden', 'true');
    const t1 = el('span', 'pq-pair', ''), t2 = el('span', 'pq-pair', '');
    id.append(swatch, t1, el('span', 'pq-sep', '|'), t2);
    head.append(id);
    const len = sliderRow(slot, 'L'), tw = sliderRow(slot, 'tw');
    root.append(head, len.row, tw.row);
    host.appendChild(root);
    Object.assign(slot, { root, head, t1, t2, len, tw });
    return slot;
  }

  function setSlider(S, value, given, text, label) {
    // a held slider keeps the range it was grabbed with (a Length's range follows its number: it must not run away)
    const range = S.held ? S.range : given;
    S.value = value; S.range = range;
    const lo = String(range[0]), hi = String(range[1]);
    if (S.input.min !== lo) S.input.min = lo;
    if (S.input.max !== hi) S.input.max = hi;
    const shown = String(Math.round(clamp(value, range[0], range[1]) * 1000) / 1000);
    if (S.input.value !== shown) S.input.value = shown;
    if (S.num.textContent !== text) S.num.textContent = text;
    S.num.parentNode.dataset.value = String(value);
    S.input.setAttribute('aria-label', label);
    S.input.setAttribute('aria-valuetext', text + (S.which === 'tw' ? ' turn' : ''));
  }

  function update(cards, state = null) {
    if (state && Array.isArray(state.orders) && Array.isArray(state.perm)) {
      // feature f sits in slot perm.indexOf(f); its order is orders[slot]
      if (!opts.labelOf) labelOf = (f) => 'PQRS'[f] + state.orders[state.perm.indexOf(f)];
      flat = state.orders.every((n) => n === 2);
    }
    current = cards;
    cards.forEach((card, i) => {
      const slot = slots[i] || (slots[i] = build(card, i));
      slot.key = card.key;
      slot.active = !!card.active;
      slot.root.dataset.key = card.key;
      slot.root.dataset.active = String(!!card.active);          // for the checks; nothing is styled by it
      const name = (pr) => pr.slice().sort((x, y) => x - y).map((f) => labelOf(f)).join(' ');
      const lead = card.pairs[0].includes(0) ? 0 : 1;
      const a = name(card.pairs[lead]), b = name(card.pairs[1 - lead]);
      if (slot.t1.textContent !== a) slot.t1.textContent = a;
      if (slot.t2.textContent !== b) slot.t2.textContent = b;
      slot.root.setAttribute('aria-label', `Partition ${a} | ${b}`);
      if (slot.len.sub) { slot.len.sub.hidden = !flat; if (flat && slot.len.sub.textContent !== 'pair spacing') slot.len.sub.textContent = 'pair spacing'; }
      setSlider(slot.len, card.L, card.lRange || [0.4, 7], fmtL(card.L), `Length of the loop ${a} | ${b}${flat ? ' (pair spacing)' : ''}`);
      setSlider(slot.tw, card.tw, card.twRange || [-0.5, 0.5], fmtTw(card.tw), `Twist of the loop ${a} | ${b}, in turns`);
    });
  }

  return {
    update,
    /** For checks: what the cards show. */
    read: () => slots.map((s) => ({ key: s.key, active: s.active, L: s.len.value, tw: s.tw.value, LText: s.len.num.textContent, twText: s.tw.num.textContent, label: `${s.t1.textContent} | ${s.t2.textContent}` })),
    get cards() { return current; },
  };
}
