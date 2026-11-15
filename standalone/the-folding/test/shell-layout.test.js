// The page shell in a browser (round 3, ui-layout): the real app (dev/app-demo.html: src/index.template.html,
// src/styles.css, src/app.js) at 23 window sizes x 17 groups. Nothing is cut, hidden, overlapping or under 13 px;
// every tap target is 44 px; the legend shows exactly the group's features (contract C1); the kaleidoscopes show the
// note instead of chips and slider; the hints stay inside their panes (the plane's at the top edge of a phone pane);
// on the iPhone SE under the host bar (375 x 498) the 3D pane is at least 175 px tall for the default group (v1: 151).
// Since 13 Nov 2026 also: the pattern selector (a 44 px target at the right of the header, clear of the chip and the
// caption; its swatch alone on a phone), the title (gone under 370 px, where the selector has its room), the legend's
// "front · back" (with a print, from 360 px up), and the words of a re-cut over the 3D pane.
// Since 14 Nov 2026 (the pattern round): EVERY pattern of the selector (Paisley, Soft commas, Tomoe, Checkerboard,
// Rings, Comma) at all 23 sizes for all 17 groups — its own swatch in the print's tones, its name uncut, its print and
// the legend's paper under every print — and the pill before the script runs (Paisley, the default); the page opens
// with Paisley. test/shell-layout.lib.js has the list.
// THIS TEST IS THE GATE FOR ANY CHANGE TO THE HEADER OR THE LEGEND: the round of 13 Nov shipped without running it, and
// the chip lost a word at 360 px (p3m1 · equilateral…), the caption a line on a phone on its side, the 3D pane 16 px
// at 320 x 518.
//
// OPT-IN: it needs a Chrome (tools/browser.mjs: the pool on the mini, else this Mac), which the remote suite
// (tools/test-all.mjs) does not have. Run it from this Mac:
//     SHELL_LAYOUT=1 FOLDING_BROWSER=mini node --test test/shell-layout.test.js     (about four minutes: every pattern)
//     SHELL_LAYOUT_PAGE=<page> ...                     another page with the same shell ids, e.g. the designs not yet
//                                                      in src/: 'dev/patterns/app.html?designs=paisley,tomoe,blobs'
//     SHELL_LAYOUT_QUICK=1 ...                         the patterns other than the default at 4 sizes, not 23 (a minute)
// A size written fWxH is "in the 50 px host frame": the page gets W x (H - 50), exactly what the iframe gives it.
// The checks themselves are test/shell-layout.lib.js; dev/recut/webkit-layout.mjs runs the same ones in WebKit (Safari's
// engine, on the M5): Chrome cannot see what Safari lays out differently (13 Nov: the invisible native select's own
// text counted as page width there).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sweep, PATTERNS, NOSCRIPT } from './shell-layout.lib.js';

test('layout: 23 window sizes x 17 groups x every pattern — nothing cut, hidden, overlapping or under 13 px; the C1 legend, note and hints; the pill',
  { skip: process.env.SHELL_LAYOUT === '1' ? false : 'opt-in: SHELL_LAYOUT=1 (needs a Chrome, see the top of the file)', timeout: 900000 }, async () => {
    const { openBrowser } = await import('../tools/browser.mjs');
    const { GROUPS } = await import('../src/groups.js');
    const { groupFeatures } = await import('../src/app.js');
    const B = await openBrowser({ quiet: true });
    const errors = [];
    let failures = [], foldAt375 = {}, opened = null, seconds = 0, before = [];
    try {
      const page = await (await B.browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(B.url((process.env.SHELL_LAYOUT_PAGE || 'dev/app-demo.html') + '#333'), { waitUntil: 'load' });
      await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
      await page.evaluate(() => window.__folding.ready);
      ({ failures, foldAt375, opened, seconds } = await sweep(page, GROUPS.map((g) => ({ id: g.id, features: groupFeatures(g).join(' ') })),
        { quick: process.env.SHELL_LAYOUT_QUICK === '1' }));
      // the page before its script runs: the template and the stylesheet alone (what build.mjs inlines), on a laptop and
      // a phone — the pill shows the default, Paisley, and the legend no paper
      const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
      // (the HTML comments go first, as build.mjs does: the template's own documentation names the placeholders)
      const html = read('src/index.template.html').replace(/<!--[\s\S]*?-->/g, '')
        .replace('/*__INLINE_CSS__*/', () => read('src/styles.css')).replace(/<script>\/\*__INLINE_JS__\*\/<\/script>/, '');
      for (const [w, h] of [[1280, 720], [390, 780]]) {
        const p0 = await (await B.browser.newContext({ viewport: { width: w, height: h } })).newPage();   // (no script in it)
        await p0.setContent(html, { waitUntil: 'load' });
        for (const b of await p0.evaluate(NOSCRIPT, { pattern: PATTERNS[0].key, label: PATTERNS[0].label })) before.push(`${w}x${h}: ${b}`);
      }
    } finally { await B.close(); }
    console.log(`${seconds} s; the page opened with "${opened}"; fold pane height at 375 x 498 (the iPhone SE under the host bar):`, JSON.stringify(foldAt375));
    // everything found, before the first assertion stops the test: the same problem at many sizes once, with its count
    const kinds = new Map(), keys = PATTERNS.map((p) => p.key).join('|');
    for (const f of failures) { const k = f.replace(new RegExp(`^\\S+ \\S+( (${keys}))?( t = [\\d.]+)?: `), ''); kinds.set(k, (kinds.get(k) || []).concat(f)); }
    for (const [k, v] of kinds) console.log(`  ${String(v.length).padStart(4)} x  ${k}    e.g. ${v[0].slice(0, 60)}`);
    for (const b of before) console.log('  before the script: ' + b);
    for (const e of errors.slice(0, 5)) console.log('  page error: ' + e);
    assert.deepEqual(errors, [], 'no page or console error');
    assert.deepEqual(failures, [], failures.length + ' problems');
    assert.ok(foldAt375['333'] >= 175, `the default group's 3D pane at 375 x 498 is ${foldAt375['333']} px tall (v1: 151; finding 9)`);
    for (const [id, h] of Object.entries(foldAt375)) assert.ok(h >= 150, `${id}: 3D pane ${h} px tall at 375 x 498`);
    assert.deepEqual(before, [], 'the pill before the script runs');
    assert.equal(opened, PATTERNS[0].key, `the page opens with ${PATTERNS[0].label}, the selector's first pattern (src/pattern.js DEFAULT_PATTERN)`);
  });
