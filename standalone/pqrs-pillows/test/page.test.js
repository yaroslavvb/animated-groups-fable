// page.test.js — the shell's files read as text (src/page.js, page.template.html, page.css, cards.js,
// pattern-glue.js): the template has what page.js looks up and what the build needs; nothing a publish would refuse.
// (What the page DOES is checked in a browser: dev/shell/check.mjs and tools/check.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '../src/state.js';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f) => readFileSync(resolve(src, f), 'utf8');
const page = read('page.js'), template = read('page.template.html'), css = read('page.css');
const count = (text, part) => text.split(part).length - 1;

test('every element page.js looks up by id is in the template, once', () => {
  const ids = new Set();
  for (const m of page.matchAll(/\$\('([\w-]+)'\)/g)) ids.add(m[1]);
  for (const m of page.matchAll(/\['([\w-]+)', '([\w-]+)'\]/g)) { ids.add(m[1]); ids.add(m[2]); }
  assert.ok(ids.size >= 20, `ids found: ${ids.size}`);
  for (const id of ids) assert.equal(count(template, `id="${id}"`), 1, `id="${id}"`);
});

test('the template has the build\'s three slots once each, and the tutorial\'s two markers in order', () => {
  for (const slot of ['/*__INLINE_CSS__*/', '/*__INLINE_JS__*/', '<!--__MATH_CACHE__-->']) assert.equal(count(template, slot), 1, slot);
  assert.ok(template.startsWith('<!doctype html>'));
  const a = template.indexOf('<!-- TUTORIAL:BEGIN -->'), b = template.indexOf('<!-- TUTORIAL:END -->');
  assert.ok(a > 0 && b > a, 'TUTORIAL:BEGIN before TUTORIAL:END');
  assert.equal(count(template, '<!-- TUTORIAL:BEGIN -->'), 1);
  assert.equal(count(template, '<!-- TUTORIAL:END -->'), 1);
  const tut = template.indexOf('<section id="tutorial"');
  assert.ok(tut > 0 && tut < a && template.indexOf('</section>', b) > b, 'the markers lie inside the Tutorial tab');
});

test('the shell: title, the one sentence, the presets in order, the quiet field, two tabs, the journey\'s words', () => {
  assert.match(template, /<title>PQRS pillows<\/title>/);
  assert.match(template, /<h1>PQRS pillows<\/h1>/);
  assert.ok(template.includes('The orbifold PQRS is two pillows joined along a loop. Each of the three ways to pair its four cone points has its own Length and Twist: move any of them.'));
  const chips = [...template.matchAll(/class="chip"[^>]*data-sig="(\d{4})"/g)].map((m) => m[1]);
  assert.deepEqual(chips, PRESETS);
  assert.ok(template.includes('placeholder="or type four orders: 2346"'));
  assert.deepEqual([...template.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]), ['play', 'tutorial']);
  assert.ok(template.includes('<span>surface</span><span>two pillows</span><span>open crowns</span>'));
  for (const word of ['Join', 'Zip', 'Part', 'Unzip']) assert.ok(page.includes(`'${word}'`), word);
});

test('what page.js imports is there', () => {
  const froms = [...page.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.ok(froms.length >= 8);
  for (const f of froms) assert.ok(existsSync(resolve(src, f)), f);
  for (const name of ['createSurfaceModel', 'createSurfacePane', 'createPrint3d', 'createPatternGlue', 'createCards', 'shareHash']) assert.ok(page.includes(name), name);
  assert.match(page, /const SURFACE = (true|false);/, 'the Surface has ONE switch');
});

test('nothing a build or a publish refuses', () => {
  for (const tag of ['<img', '<link', '<iframe', '<video', '<audio', '<object', '<embed', '<script src']) assert.ok(!template.includes(tag), tag);
  assert.equal(count(template, '<script'), 1);
  assert.equal(count(template, '<style'), 1);
  assert.ok(!/url\(/.test(css) && !/@import/.test(css), 'no url() and no @import in page.css');
  const allowed = ['https://spacesheep.dev/@yaroslavvb/', 'https://yaroslavvb.github.io/animated-groups-fable/'];
  for (const [name, text] of [['page.template.html', template], ['page.js', page], ['page.css', css], ['cards.js', read('cards.js')], ['pattern-glue.js', read('pattern-glue.js')]]) {
    for (const m of text.matchAll(/\b(?:https?|wss?|ftp):\/\/[^\s"'<>)]+/g)) assert.ok(allowed.some((a) => m[0].startsWith(a)), `${name}: ${m[0]}`);
    for (const word of ['recorder', 'recording', 'transcript']) assert.ok(!text.toLowerCase().includes(word), `${name}: the word "${word}"`);
  }
});

test('phones: the panes stay side by side, fields are 16 px, sliders 44 px tall', () => {
  assert.match(css, /\.play-panes\.pq-panes \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  const phone = css.slice(css.indexOf('@media (max-width: 640px)'));
  assert.ok(phone.includes('"pat surf"'), 'two columns on a phone too');
  assert.ok(!/grid-template-columns: minmax\(0, 1fr\);[^}]*\}[^}]*\.pq-panes/.test(phone));
  assert.match(css, /\.pq-swrap input\[type="range"\] \{[^}]*height: 44px/);
  assert.match(css, /\.pq-card-head \{[^}]*min-height: 44px/);
  assert.match(css, /\.pq-swrap input\[type="range"\] \{[^}]*font-size: 16px/);
});
