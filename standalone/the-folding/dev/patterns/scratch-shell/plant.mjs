// scratch (shell, 14 Nov 2026): do the layout gate's new checks catch what they claim? Faults are PLANTED in the page
// at run time (an injected style, a wrong label, a missing attribute); no source file is touched.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-shell/plant.mjs
import fs from 'node:fs';
import { openBrowser } from '../../../tools/browser.mjs';
import { CHECK, NOSCRIPT, PATTERNS } from '../../../test/shell-layout.lib.js';
import { GROUPS } from '../../../src/groups.js';
import { groupFeatures } from '../../../src/app.js';

const W = (key) => { const p = PATTERNS.find((q) => q.key === key); return { pattern: p.key, label: p.label, kinds: p.kinds }; };
const feats = (id) => groupFeatures(GROUPS.find((g) => g.id === id)).join(' ');
// [name, size, group, pattern, style to inject, js to run after, a regexp the failures must match]
const PLANTS = [
  ['clean, phone', [390, 780], '333', 'soft', '', '', null],
  ['clean, laptop', [1280, 720], '*632', 'tomoe', '', '', null],
  ['the soft swatch hidden', [390, 780], '333', 'soft', '.app[data-pattern="soft"] .pat-sw-soft { display: none !important; }', '', /0 swatches in the selector \(soft\)/],
  ['a second swatch', [390, 780], '333', 'tomoe', '.app[data-pattern="tomoe"] .pat-sw-checker { display: block !important; }', '', /2 swatches in the selector \(tomoe\)/],
  ['the wrong swatch', [390, 780], '333', 'tomoe', '.app[data-pattern="tomoe"] .pat-sw-tomoe { display: none !important; } .app[data-pattern="tomoe"] .pat-sw-paisley { display: block !important; }', '', /the swatch of tomoe is "pat-sw pat-sw-paisley"/],
  ['a swatch not in the print\'s tones', [390, 780], '333', 'paisley', '.pat-sw-paisley .pat-fg { fill: var(--motif) !important; }', '', /the swatch of paisley has rgb\(59, 59, 68\) under a print/],
  ['a swatch of 16 px', [390, 780], '333', 'paisley', '.pat-sw { width: 16px !important; height: 16px !important; }', '', /the swatch of paisley is 16x16/],
  ['no paper under a shape print', [1280, 720], '333', 'paisley', '.app[data-print="shapes"] .lg[data-paper] { display: none !important; }', '', /legend: 0 "front · back" items \(pattern paisley, print shapes, 1280 px\)/],
  ['paper under the comma', [1280, 720], '333', 'comma', '.app .lg[data-paper] { display: flex !important; }', '', /legend: 1 "front · back" items \(pattern comma, print none, 1280 px\)/],
  ['the name cut', [1280, 720], '333', 'soft', '.pat-label { display: inline-block; max-width: 40px; overflow: hidden; }', '', /the pattern's name "Soft commas" is cut/],
  ['the wrong name', [1280, 720], '333', 'soft', '', 'document.querySelector("#pattern-label").textContent = "Checkerboard"', /the pill names "Checkerboard", the pattern is Soft commas/],
  ['the name on a phone', [390, 780], '333', 'tomoe', '.pat-label { display: inline !important; }', '', /the pattern's name is shown at 390 x 780/],
  ['"Pattern" hidden at 1280', [1280, 720], '333', 'tomoe', '.pat-k { display: none !important; }', '', /the word "Pattern" is hidden at 1280 x 720/],
  ['data-print missing', [1280, 720], '333', 'paisley', '', 'document.querySelector("#app").removeAttribute("data-print")', /#app data-print is "null", the print on screen is shapes/],
  ['the select elsewhere', [1280, 720], '333', 'paisley', '', 'document.querySelector("#pattern").value = "rings"', /the select says "rings" for the pattern paisley/],
];

const B = await openBrowser({ quiet: true });
let ok = 0, bad = 0;
try {
  const page = await (await B.browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(B.url('dev/patterns/app.html?designs=paisley,tomoe,blobs#g=333'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready && window.__designs && window.__designs.ready, null, { timeout: 30000 });
  for (const [name, [w, h], id, key, style, js, want] of PLANTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(([id, key]) => { const F = window.__folding; F.setGroup(id); F.setPattern(key); F.setT(0); }, [id, key]);
    await page.evaluate(([css, js]) => {
      let s = document.getElementById('plant'); if (!s) { s = document.createElement('style'); s.id = 'plant'; document.head.appendChild(s); }
      s.textContent = css; if (js) (0, eval)(js);
    }, [style, js]);
    await page.waitForTimeout(60);
    const r = await page.evaluate(CHECK, [feats(id), W(key)]);
    const pass = want ? r.bad.some((b) => want.test(b)) : r.bad.length === 0;
    if (pass) ok++; else bad++;
    console.log(`${pass ? 'CAUGHT' : 'MISSED'}  ${name}: ${r.bad.length ? r.bad.join(' | ').slice(0, 300) : '(nothing found)'}`);
    // undo: no style, and the app's own state again
    await page.evaluate(() => { document.getElementById('plant').textContent = ''; window.__folding.setPattern('checker'); });
  }
  // before the script: the template and the stylesheet (comments first, as build.mjs), clean and with a planted default
  const read = (p) => fs.readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
  const html = read('src/index.template.html').replace(/<!--[\s\S]*?-->/g, '').replace('/*__INLINE_CSS__*/', () => read('src/styles.css')).replace(/<script>\/\*__INLINE_JS__\*\/<\/script>/, '');
  for (const [w, h] of [[1280, 720], [390, 780]]) {
    const p0 = await (await B.browser.newContext({ viewport: { width: w, height: h } })).newPage();
    await p0.setContent(html, { waitUntil: 'load' });
    const clean = await p0.evaluate(NOSCRIPT, { pattern: 'paisley', label: 'Paisley' });
    console.log(`${clean.length ? 'MISSED' : 'CAUGHT'}  before the script, clean, ${w}x${h}: ${clean.join(' | ') || '(nothing found)'}`);
    clean.length ? bad++ : ok++;
    await p0.addStyleTag({ content: '.app:not([data-pattern]) .pat-sw-checker { display: block; }' });
    const planted = await p0.evaluate(NOSCRIPT, { pattern: 'paisley', label: 'Paisley' });
    const caught = planted.some((b) => /swatches shown are \[pat-sw pat-sw-paisley \| pat-sw pat-sw-checker\]/.test(b));
    console.log(`${caught ? 'CAUGHT' : 'MISSED'}  before the script, the checker's swatch too, ${w}x${h}: ${planted.join(' | ') || '(nothing found)'}`);
    caught ? ok++ : bad++;
  }
  if (errors.length) console.log('page errors: ' + errors.join(' | '));
} finally { await B.close(); }
console.log(`${ok} as expected, ${bad} not`);
process.exit(bad ? 1 : 0);
