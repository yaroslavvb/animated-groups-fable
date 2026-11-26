// custom-webkit.mjs — the text field after the chips, live on spacesheep, in Safari's engine (Playwright WebKit).
//
// WebKit is on the M5 alone (webkit-2336 in ~/Library/Caches/ms-playwright), so the file is piped there and run
// with the M5's own runtime Node, from the mini or the Intel:
//   ssh m5 'mkdir -p /tmp/tfth-webkit && cat > /tmp/tfth-webkit/custom-webkit.mjs' < tools/custom-webkit.mjs
//   ssh m5 '~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /tmp/tfth-webkit/custom-webkit.mjs https://spacesheep.dev/@yaroslavvb/two-features-two-handles [/tmp/tfth-webkit/shot]'
// 14 checks at 1280 x 900 and on a phone in the dark (390 x 844, touch). The two "PAGE ERROR ... from accessing a
// frame with origin ...spacesheep.app" lines are the viewer's own (spacesheep.dev reaching into the page's frame, which
// WebKit refuses); they are counted apart and do not fail the run.
const { webkit } = await import(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`);
const url = process.argv[2];
let failed = 0, errors = 0, viewer = 0;
const ok = (c, what, extra = '') => { if (!c) failed++; console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${c ? '' : '  ' + extra}`); };
const browser = await webkit.launch();
try {
  for (const [name, ctxOpts] of [['wide', { viewport: { width: 1280, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark' }]]) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' && /spacesheep\.app/.test(m.location().url || '')) { errors++; console.log('CONSOLE ERROR', m.text().slice(0, 200)); } });
    page.on('pageerror', (e) => { if (/from accessing a frame with origin/.test(e.message)) { viewer++; return; } errors++; console.log('PAGE ERROR', e.message.slice(0, 200)); });
    await page.goto(url, { waitUntil: 'load' });
    let T = null;
    for (let i = 0; i < 150 && !T; i++) { T = page.frames().find((fr) => /spacesheep\.app/.test(fr.url())) || null; if (!T) await page.waitForTimeout(200); }
    await T.waitForFunction(() => window.__handles && window.__handles.state().pattern, null, { timeout: 45000 });
    await page.waitForTimeout(600);
    const ui = () => T.evaluate(() => {
      const f = document.getElementById('custom-in'), pop = document.getElementById('custom-pop'), fr = f.getBoundingClientRect(), pr = pop.hidden ? null : pop.getBoundingClientRect();
      const cs = getComputedStyle(f);
      return { value: f.value, on: f.dataset.on === '1', w: Math.round(fr.width), h: Math.round(fr.height), font: parseFloat(cs.fontSize), note: pop.hidden ? '' : pop.textContent, box: pr && [Math.round(pr.left), Math.round(pr.right), Math.round(pr.top - fr.bottom)],
        vw: document.documentElement.clientWidth, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, k: window.__handles.state().k, tiles: window.__handles.state().pattern.tiles,
        chipH: Math.round(document.querySelector('[data-fam="2222"]').getBoundingClientRect().height), pressed: [...document.querySelectorAll('[data-fam][aria-pressed="true"]')].map((b) => b.dataset.fam).join() };
    });
    let u = await ui();
    ok(u.value === '' && !u.overflowX && u.h >= 44 && u.h === u.chipH && u.w >= 150 && u.font >= 16, `${name}: the field is there, a chip tall, at least 150 px wide, 16 px text, nothing wider than the window`, JSON.stringify(u));
    if (name === 'phone') await T.tap('#custom-in'); else await T.click('#custom-in');
    await page.keyboard.type('237', { delay: 30 });
    await page.waitForTimeout(300);
    u = await ui();
    ok(/has three features/.test(u.note) && u.box && u.box[0] >= 0 && u.box[1] <= u.vw && u.box[2] >= 0 && u.box[2] < 12 && !u.overflowX && u.k === '3333', `${name}: 237 typed: the note is under the field, inside the window`, JSON.stringify(u));
    await page.keyboard.type('9', { delay: 30 });
    await page.waitForTimeout(700);
    u = await ui();
    ok(u.k === '2379' && u.on && u.note === '' && u.tiles > 3 && u.pressed === '' && !u.overflowX, `${name}: 2379 is shown, the field lit, the pattern drawn`, JSON.stringify(u));
    for (const t of ['234*5', 'o27', '957x']) {
      await T.evaluate((x) => window.__handles.custom.type(x), t);
      await page.waitForTimeout(600);
      u = await ui();
      ok(u.k === t && u.on && u.tiles > 3 && !u.overflowX, `${name}: ${t} is shown`, JSON.stringify(u));
    }
    await T.evaluate(() => window.__handles.custom.type('22*x'));
    await page.waitForTimeout(300);
    u = await ui();
    ok(/a mirror and a crosscap/.test(u.note) && u.box[0] >= 0 && u.box[1] <= u.vw && !u.overflowX, `${name}: 22∗× says why, inside the window`, JSON.stringify(u));
    if (process.argv[3]) await page.screenshot({ path: `${process.argv[3]}-${name}.png` });
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`${failed ? 'FAILED ' + failed : 'all ok'} in WebKit; page errors ${errors}; the viewer's own frame errors ${viewer}`);
process.exit(failed || errors ? 1 : 0);
