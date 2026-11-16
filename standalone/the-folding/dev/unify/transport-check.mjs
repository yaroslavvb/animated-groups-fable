#!/usr/bin/env node
// transport-check.mjs — the journey's two buttons, Space and the scrubber in a real Chrome, on the built page:
// Fold from the pattern goes all the way to the surface; Unfold stops at the flat tile; Tile goes on to the pattern;
// Tile at the pattern makes the copies again; a button pauses its own play and the other one turns it round; Space
// pauses and goes on; a kaleidoscope has no fold half (its Fold gathers the pattern onto the tile). (15 Nov 2026)
//   node dev/unify/transport-check.mjs [--page dist/index.html]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
let failed = 0, passed = 0;
const check = (ok, what, detail = '') => { if (ok) passed++; else failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? '  — ' + detail : ''}`); };
const B = await openBrowser({ root });
try {
  const page = await (await B.browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  let errors = 0;
  page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('CONSOLE ERROR', m.text()); } });
  page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message); });
  await page.goto(B.url(opt.page || 'dist/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 15000 });
  const st = () => page.evaluate(() => { const s = window.__folding.getState(); return { g: s.groupId, t: +s.t.toFixed(4), tile: +s.tile.toFixed(4), j: +s.journey.toFixed(4), stop: s.journeyStop, fold: s.button, next: s.nextButton, lead: s.lead, going: s.going, playing: s.playing, hash: s.hash, errors: s.errors, foldDisabled: document.getElementById('fold-btn').disabled, quietFold: document.getElementById('fold-btn').hasAttribute('data-quiet'), quietNext: document.getElementById('next-btn').hasAttribute('data-quiet') }; });
  const idle = async () => { await page.waitForFunction(() => { const s = window.__folding.getState(); return !s.playing && !s.going; }, null, { timeout: 30000 }); await page.waitForTimeout(80); return st(); };
  const timed = async (f) => { const t0 = Date.now(); await f(); const s = await idle(); return [s, (Date.now() - t0) / 1000]; };

  let s = await st();
  check(s.g === '333' && s.stop === 'pattern' && s.fold === 'Fold' && s.next === 'Tile' && !s.quietFold && s.quietNext && !/tile=|t=/.test(s.hash), 'the page opens at the pattern: Fold solid, Tile outlined, nothing in the address', JSON.stringify(s));
  let sec;
  [s, sec] = await timed(() => page.click('#fold-btn'));
  check(s.stop === 'surface' && s.t === 1 && s.tile === 0 && s.foldDisabled && s.next === 'Unfold' && !s.quietNext && /t=1/.test(s.hash) && !/tile=/.test(s.hash), `Fold from the pattern gathers the copies and folds to the surface (${sec.toFixed(1)} s)`, JSON.stringify(s));
  [s, sec] = await timed(() => page.click('#next-btn'));
  check(s.stop === 'tile' && s.t === 0 && s.tile === 0 && s.next === 'Tile' && !s.quietNext && s.quietFold && /tile=0/.test(s.hash), `Unfold stops at the flat tile; the button now reads Tile, solid (${sec.toFixed(1)} s)`, JSON.stringify(s));
  [s, sec] = await timed(() => page.click('#next-btn'));
  check(s.stop === 'pattern' && s.tile === 1 && !s.quietFold && !/tile=/.test(s.hash), `Tile goes on to the pattern; Fold is solid again (${sec.toFixed(1)} s)`, JSON.stringify(s));
  [s, sec] = await timed(() => page.click('#next-btn'));
  check(s.stop === 'pattern' && s.tile === 1, `Tile at the pattern makes the copies again (${sec.toFixed(1)} s)`, JSON.stringify(s));

  // pause and turn round
  await page.click('#fold-btn');
  await page.waitForTimeout(700);
  let m = await st();
  check(m.playing && m.going === 'surface' && m.fold === 'Pause', 'while folding, the Fold button reads Pause', JSON.stringify(m));
  await page.click('#fold-btn');
  await page.waitForTimeout(250);
  m = await st();
  check(!m.playing && m.j > 0 && m.j < 1 && m.fold === 'Fold', 'Pause stops it part-way', JSON.stringify(m));
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  m = await st();
  check(m.playing && m.going === 'surface', 'Space goes on the way it was going', JSON.stringify(m));
  await page.click('#next-btn');
  await page.waitForTimeout(200);
  m = await st();
  check(m.playing && m.going === 'pattern' && m.next === 'Pause', 'the other button turns the play round', JSON.stringify(m));
  s = await idle();
  check(s.stop === 'tile' || s.stop === 'pattern', 'and it ends at a stop', JSON.stringify(s));

  // a kaleidoscope: the tile is the surface
  await page.evaluate(() => window.__folding.setGroup('*632'));
  s = await st();
  check(s.stop === 'pattern' && s.fold === 'Fold' && s.next === 'Tile', '*632 opens at the pattern', JSON.stringify(s));
  [s, sec] = await timed(() => page.click('#fold-btn'));
  check(s.stop === 'tile' && s.j === 0 && s.t === 0 && s.tile === 0 && s.foldDisabled && s.next === 'Tile', `*632: Fold gathers the pattern onto the tile, which is the surface (${sec.toFixed(1)} s)`, JSON.stringify(s));
  [s, sec] = await timed(() => page.click('#next-btn'));
  check(s.stop === 'pattern' && s.tile === 1, `*632: Tile unfolds it again (${sec.toFixed(1)} s)`, JSON.stringify(s));

  // a pasted link: t wins over tile; a kaleidoscope's t means its tile
  await page.evaluate(() => { location.hash = '#g=2222&tile=0.4&t=0.5'; });
  await page.waitForTimeout(400);
  s = await st();
  check(s.g === '2222' && s.t === 0.5 && s.tile === 0, 'a link with t and tile: the fold wins, the tile has no copies', JSON.stringify(s));
  await page.evaluate(() => { location.hash = '#g=%2A632&t=1'; });
  await page.waitForTimeout(400);
  s = await st();
  check(s.g === '*632' && s.t === 0 && s.tile === 0 && s.stop === 'tile', 'an old link #g=*632&t=1 shows the tile alone: the surface', JSON.stringify(s));
  check(errors === 0 && s.errors === 0, 'no console error, no page error', String(errors));
} finally { await B.close(); }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
