// The page shell in a browser (round 3, ui-layout): the real app (dev/app-demo.html: src/index.template.html,
// src/styles.css, src/app.js) at 23 window sizes x 17 groups. Nothing is cut, hidden, overlapping or under 13 px;
// every tap target is 44 px; the legend shows exactly the group's features (contract C1); the kaleidoscopes show the
// note instead of chips and slider; the hints stay inside their panes (the plane's at the top edge of a phone pane);
// on the iPhone SE under the host bar (375 x 498) the 3D pane is at least 175 px tall for the default group (v1: 151).
// Since 13 Nov 2026 also: the pattern selector (a 44 px target at the right of the header, clear of the chip and the
// caption; its swatch alone on a phone), the title (gone under 370 px, where the selector has its room), the legend's
// "front · back" (with a print, from 360 px up), and the words of a re-cut over the 3D pane.
// THIS TEST IS THE GATE FOR ANY CHANGE TO THE HEADER OR THE LEGEND: the round of 13 Nov shipped without running it, and
// the chip lost a word at 360 px (p3m1 · equilateral…), the caption a line on a phone on its side, the 3D pane 16 px
// at 320 x 518.
//
// OPT-IN: it needs a Chrome (tools/browser.mjs: the pool on the mini, else this Mac), which the remote suite
// (tools/test-all.mjs) does not have. Run it from this Mac:
//     SHELL_LAYOUT=1 node --test test/shell-layout.test.js          (about a minute)
//     SHELL_LAYOUT_PAGE=<page> ...                                    (another page with the same shell ids)
// A size written fWxH is "in the 50 px host frame": the page gets W x (H - 50), exactly what the iframe gives it.
// The checks themselves are test/shell-layout.lib.js; dev/recut/webkit-layout.mjs runs the same ones in WebKit (Safari's
// engine, on the M5): Chrome cannot see what Safari lays out differently (13 Nov: the invisible native select's own
// text counted as page width there).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sweep } from './shell-layout.lib.js';

test('layout: 23 window sizes x 17 groups — nothing cut, hidden, overlapping or under 13 px; the C1 legend, note and hints',
  { skip: process.env.SHELL_LAYOUT === '1' ? false : 'opt-in: SHELL_LAYOUT=1 (needs a Chrome, see the top of the file)', timeout: 600000 }, async () => {
    const { openBrowser } = await import('../tools/browser.mjs');
    const { GROUPS } = await import('../src/groups.js');
    const { groupFeatures } = await import('../src/app.js');
    const B = await openBrowser({ quiet: true });
    const errors = [];
    let failures = [], foldAt375 = {};
    try {
      const page = await (await B.browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(B.url((process.env.SHELL_LAYOUT_PAGE || 'dev/app-demo.html') + '#333'), { waitUntil: 'load' });
      await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
      await page.evaluate(() => window.__folding.ready);
      ({ failures, foldAt375 } = await sweep(page, GROUPS.map((g) => ({ id: g.id, features: groupFeatures(g).join(' ') }))));
    } finally { await B.close(); }
    console.log('fold pane height at 375 x 498 (the iPhone SE under the host bar):', JSON.stringify(foldAt375));
    assert.deepEqual(errors, [], 'no page or console error');
    assert.deepEqual(failures, [], failures.length + ' problems');
    assert.ok(foldAt375['333'] >= 175, `the default group's 3D pane at 375 x 498 is ${foldAt375['333']} px tall (v1: 151; finding 9)`);
    for (const [id, h] of Object.entries(foldAt375)) assert.ok(h >= 150, `${id}: 3D pane ${h} px tall at 375 x 498`);
  });
