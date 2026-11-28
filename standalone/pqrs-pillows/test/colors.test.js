// colors.test.js — the three partitions' colours are ONE set: colors.js (the panes) and page.css (the cards, the key,
// the table) hold the same values, and nothing on the page is styled by which card is the cut.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PART_HEX, PART_RGB } from '../src/colors.js';
import { CARD_KEYS } from '../src/state.js';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const css = readFileSync(resolve(src, 'page.css'), 'utf8');

test('one colour a partition, in the cards\' order, the same in the stylesheet', () => {
  assert.equal(PART_HEX.length, CARD_KEYS.length);
  PART_HEX.forEach((hex, i) => {
    const m = new RegExp(`--pq-part-${i + 1}:\\s*(#[0-9A-Fa-f]{6})`).exec(css);
    assert.ok(m, `--pq-part-${i + 1} is defined`);
    assert.equal(m[1].toUpperCase(), hex.toUpperCase());
    assert.deepEqual(PART_RGB[i].map((v) => Math.round(255 * v)), [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)));
  });
  assert.equal(new Set(PART_HEX.map((h) => h.toUpperCase())).size, 3, 'three different colours');
});

test('no rule of the stylesheet reads which card is the cut', () => {
  assert.ok(!/data-active/.test(css), 'page.css has no data-active rule');
  assert.ok(!/pq-tag/.test(css), 'no "active" tag');
  for (let i = 1; i <= 3; i++) assert.match(css, new RegExp(`\\.pq-card\\[data-part="${i}"\\]\\s*\\{[^}]*--part-col:\\s*var\\(--pq-part-${i}\\)`));
});
