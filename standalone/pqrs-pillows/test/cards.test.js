// cards.test.js — the three partition cards (src/cards.js), on a small stand-in DOM: what they show, and what they
// tell the page when a header is clicked, a slider is grabbed, dragged or moved with the keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCards, twistText, lengthText } from '../src/cards.js';
import { stateFor, cardsOf, activate, withNumbers } from '../src/state.js';

// ---- a stand-in DOM: just what cards.js touches ----
function fakeDocument() {
  const make = (tag) => {
    const listeners = {};
    const e = {
      tagName: tag.toUpperCase(), children: [], parentNode: null, dataset: {}, style: {}, attrs: {}, className: '', textContent: '', hidden: false,
      appendChild(c) { c.parentNode = e; e.children.push(c); return c; },
      append(...cs) { for (const c of cs) e.appendChild(c); },
      setAttribute(k, v) { e.attrs[k] = String(v); },
      getAttribute(k) { return k in e.attrs ? e.attrs[k] : null; },
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      fire(type, ev = {}) { const event = { type, defaultPrevented: false, preventDefault() { event.defaultPrevented = true; }, ...ev }; for (const fn of listeners[type] || []) fn(event); return event; },
    };
    return e;
  };
  const doc = { createElement: make };
  const host = make('div');
  host.ownerDocument = doc;
  return { doc, host };
}
const inputsOf = (card) => card.children.filter((c) => c.className === 'pq-srow').map((row) => row.children[1].children[0]);
const outputsOf = (card) => card.children.filter((c) => c.className === 'pq-srow').map((row) => row.children[2]);
const headOf = (card) => card.children[0];
const text = (node) => (node.children.length ? node.children.map(text).join('') : node.textContent);

function mount(sig = '3333') {
  const { host } = fakeDocument(), calls = [];
  const ui = createCards(host, { onActivate: (key) => calls.push(['activate', key]), onInput: (key, numbers, meta) => calls.push(['input', key, numbers, meta]) });
  const state = stateFor(sig);
  ui.update(cardsOf(state), state);
  return { host, ui, calls, state };
}

test('three cards in the fixed order, named by pairing, the pair with P written first', () => {
  const { host, ui } = mount('3333');
  assert.equal(host.children.length, 3);
  assert.deepEqual(host.children.map((c) => c.dataset.key), ['01|23', '02|13', '03|12']);
  assert.deepEqual(ui.read().map((c) => c.label), ['P3 Q3 | R3 S3', 'P3 R3 | Q3 S3', 'P3 S3 | Q3 R3']);
  assert.deepEqual(host.children.map((c) => c.dataset.active), ['true', 'false', 'false']);
  assert.deepEqual(host.children.map((c) => headOf(c).attrs['aria-pressed']), ['true', 'false', 'false']);
  // the numbers: the engine's default 3333 (L = 2.634, no twist), and the third loop a quarter turn off
  assert.deepEqual(ui.read().map((c) => c.LText), ['2.634', '2.634', '3.850']);
  assert.deepEqual(ui.read().map((c) => c.twText), ['+0.000', '+0.000', '+0.250']);
  // Twist carries its unit
  assert.equal(text(outputsOf(host.children[0])[1]), '+0.000 turn');
});

test('the dots say which pair is blue (first) and which orange, whatever side it is written on', () => {
  const { host, state } = mount('2345');
  const cards = cardsOf(state);
  host.children.forEach((card, i) => {
    const id = headOf(card).children[0], left = id.children[0], right = id.children[2];
    const lead = cards[i].pairs[0].includes(0) ? 0 : 1;
    assert.equal(left.className, `pq-pair pq-pair-${lead + 1}`);
    assert.equal(right.className, `pq-pair pq-pair-${2 - lead}`);
    assert.ok(text(left).startsWith('P'), 'the pair with P is on the left');
  });
});

test('a header click asks for the activation; nothing else is sent', () => {
  const { host, calls } = mount();
  headOf(host.children[2]).fire('click');
  assert.deepEqual(calls, [['activate', '03|12']]);
});

test('a slider of an inactive card is grabbed at once: activation first, then the drag', () => {
  const { host, ui, calls, state } = mount();
  const tw = inputsOf(host.children[1])[1];
  tw.fire('pointerdown');
  assert.deepEqual(calls, [['activate', '02|13']]);
  // the page activates and refreshes the cards while the pointer is down
  const flipped = activate(state, '02|13').state;
  ui.update(cardsOf(flipped), flipped);
  assert.equal(host.children[1].dataset.active, 'true');
  tw.value = '0.125';
  tw.fire('input');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].slice(0, 3), ['input', '02|13', { tw: 0.125 }]);
  assert.equal(calls[1][3].dragging, true);
  tw.fire('pointerup');
  tw.fire('change');
  assert.equal(calls[2][3].dragging, false, 'the release ends the drag');
  // a grab of the ACTIVE card's slider sends no activation
  calls.length = 0;
  inputsOf(host.children[1])[0].fire('pointerdown');
  assert.deepEqual(calls, []);
  // a finger on an inactive slider may be scrolling the page: no activation until the slider itself moves
  const far = inputsOf(host.children[2])[1];
  far.fire('pointerdown', { pointerType: 'touch' });
  assert.deepEqual(calls, []);
  far.value = '0.3';
  far.fire('input');
  assert.deepEqual(calls[0].slice(0, 3), ['input', '03|12', { tw: 0.3 }], 'the page activates the card on this input');
});

test('the arrow keys move a focused slider: Twist by 0.01, Length by 0.02, Shift a fine 0.001', () => {
  const { host, calls } = mount();
  const [len, tw] = inputsOf(host.children[0]);
  const ev = tw.fire('keydown', { key: 'ArrowRight' });
  assert.ok(ev.defaultPrevented);
  assert.deepEqual(calls[0].slice(0, 3), ['input', '01|23', { tw: 0.01 }]);
  tw.fire('keydown', { key: 'ArrowLeft', shiftKey: true });
  assert.deepEqual(calls[1][2], { tw: -0.001 });
  len.fire('keydown', { key: 'ArrowUp' });
  assert.ok(Math.abs(calls[2][2].L - 2.654) < 1e-9, `Length ${calls[2][2].L}`);
  tw.fire('keydown', { key: 'End' });
  assert.deepEqual(calls[3][2], { tw: 0.5 });
  tw.fire('keydown', { key: 'Home' });
  assert.deepEqual(calls[4][2], { tw: -0.5 });
  const other = tw.fire('keydown', { key: 'a' });
  assert.equal(other.defaultPrevented, false);
  assert.equal(calls.length, 5);
});

test('a held Length slider keeps the range it was grabbed with; released, it takes the new one', () => {
  const { host, ui, calls, state } = mount();
  const len = inputsOf(host.children[0])[0];
  assert.equal(len.min, '0.4'); assert.equal(len.max, '7');
  len.fire('pointerdown');
  const long = withNumbers(state, { L: 7 });
  ui.update(cardsOf(long), long);
  assert.equal(len.max, '7', 'held: the range stays');
  len.value = '7';
  len.fire('input');
  assert.deepEqual(calls[calls.length - 1][3].range, [0.4, 7], 'the page is told the range the slider holds');
  len.fire('pointerup');
  ui.update(cardsOf(long), long);
  assert.ok(parseFloat(len.max) > 7, `released: the range follows the number (${len.max})`);
});

test('all three cards are refreshed by one update (a Twist of the active card moves the other two)', () => {
  const { ui, state } = mount();
  const before = ui.read();
  const next = withNumbers(state, { tw: 0.13 });
  ui.update(cardsOf(next), next);
  const after = ui.read();
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(after[i].tw - before[i].tw) > 1e-3 || Math.abs(after[i].L - before[i].L) > 1e-3, `card ${after[i].key} moved`);
  assert.equal(after[0].twText, '+0.130');
});

test('2222: the Length is the pair spacing, and says so', () => {
  const { host } = mount('2222');
  for (const card of host.children) {
    const label = card.children[1].children[0], small = label.children[0];
    assert.equal(small.hidden, false);
    assert.equal(small.textContent, 'pair spacing');
    assert.match(inputsOf(card)[0].attrs['aria-label'], /pair spacing/);
  }
  const hyper = mount('3333').host;
  assert.equal(hyper.children[0].children[1].children[0].children[0].hidden, true);
});

test('the numbers as text: three decimals, a sign on the Twist, never a negative zero', () => {
  assert.equal(lengthText(2.6339), '2.634');
  assert.equal(twistText(0.25), '+0.250');
  assert.equal(twistText(-0.125), '−0.125');
  assert.equal(twistText(-0.0001), '+0.000');
  assert.equal(twistText(0), '+0.000');
});
