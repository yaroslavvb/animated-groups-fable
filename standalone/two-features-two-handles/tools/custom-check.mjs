// custom-check.mjs — the "Custom" chip in a real Chrome: typed with the keyboard, tapped, dragged, linked to, on a wide
// screen and on a phone in the dark.
//
//   node tools/custom-check.mjs [--root <this folder>] [--page site/index.html] [--shots <dir>] [--live <url>]
// --live takes the page's address on spacesheep (https://spacesheep.dev/@yaroslavvb/two-features-two-handles): there
// the page runs in the viewer's frame, so the checks are made in that frame and the viewer's own address is checked too.
// Needs The Folding's browser door (~/git/animated-groups-fable/standalone/the-folding/tools/browser.mjs) and its
// PLAYWRIGHT_MJS / FOLDING_BROWSER settings, as steps.json's shot.mjs does. Prints one line a check (ok / FAIL) and
// exits 1 if any failed or the page logged an error.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
const { openBrowser } = await import(path.join(process.env.HOME, 'git/animated-groups-fable/standalone/the-folding/tools/browser.mjs'));
const root = path.resolve(opt.root || path.join(path.dirname(new URL(import.meta.url).pathname), '..'));
const B = await openBrowser({ root });
const base = opt.live || B.url(opt.page || 'site/index.html');
const shots = opt.shots ? path.resolve(opt.shots) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

let failed = 0, errors = 0;
const ok = (cond, what, extra = '') => { if (!cond) failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}${cond ? '' : '  ' + extra}`); };
const S = (page) => page.evaluate(() => { const s = window.__handles.state(); return { k: s.k, m: s.m, L: s.L, tw: s.tw, b: s.b, tau: s.tau, hash: s.hash, loc: s.locationHash, feat: s.featLabels, custom: s.custom, tab: s.tab, pat: s.pattern, moment: s.moment }; });
const ui = (page) => page.evaluate(() => ({
  open: !document.getElementById('custom-ed').hidden,
  chip: document.getElementById('custom-chip').getAttribute('aria-pressed'),
  pressed: [...document.querySelectorAll('[data-fam][aria-pressed="true"]')].map((b) => b.dataset.fam),
  cells: [...document.querySelectorAll('#cu-cells .symcell')].map((b) => b.getAttribute('aria-label').split(':')[0]).join(' '),
  caretAfter: (() => { const kids = [...document.getElementById('cu-cells').children]; return kids.findIndex((c) => c.classList.contains('symcaret')); })(),
  say: document.getElementById('cu-say').textContent,
  sayState: document.getElementById('cu-say').dataset.state,
  tries: [...document.querySelectorAll('#cu-say .trychip')].map((b) => b.dataset.k),
  pair: [...document.querySelectorAll('.sig-btn')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '!' : '')).join(' '),
  minus: document.getElementById('cu-minus').disabled, plus: document.getElementById('cu-plus').disabled,
  focusInBar: document.getElementById('cu-cells').contains(document.activeElement) || document.activeElement === document.getElementById('cu-cells'),
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  keys: { fault: !document.getElementById('key-fault').hidden, mirror: !document.getElementById('key-mirror').hidden, glide: !document.getElementById('key-glide').hidden },
  rows: { tau: !document.getElementById('tau-row').hidden && !document.getElementById('extra-sliders').hidden, b: !document.getElementById('b-row').hidden && !document.getElementById('extra-sliders').hidden, tauLabel: document.getElementById('tau-label').textContent, bLabel: document.getElementById('b-label').textContent },
}));
const shot = async (page, name, o = {}) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), ...o }); };
const type = async (page, keys) => { for (const k of keys) await page.keyboard.press(k); };

async function newPage(ctxOpts, hash = '') {
  const ctx = await B.browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const mine = (url) => !opt.live || /spacesheep\.app/.test(url || '');          // on spacesheep only the framed page's own errors count, not the viewer's
  page.on('console', (m) => { if (m.type() === 'error' && mine(m.location().url)) { errors++; console.log('CONSOLE ERROR', m.text()); } });
  page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message); });
  await page.goto(base + hash, { waitUntil: 'load' });
  let T = page, off = { x: 0, y: 0 };
  if (opt.live) {
    for (let i = 0; i < 150 && T === page; i++) { const f = page.frames().find((fr) => /spacesheep\.app/.test(fr.url())); if (f) T = f; else await page.waitForTimeout(200); }
    if (T === page) throw new Error('no frame of the page in the viewer at ' + base);
  }
  await T.waitForFunction(() => window.__handles && window.__handles.state().pattern);
  await page.waitForTimeout(500);
  if (opt.live) { const box = await (await T.frameElement()).boundingBox(); off = { x: box.x, y: box.y }; }
  return { ctx, page, T, off };
}

try {
  // ---------------------------------------------------------------- wide screen, a mouse and a keyboard
  {
    const { ctx, page, T, off } = await newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    let u = await ui(T), s = await S(T);
    ok(!u.open && u.chip === 'false' && u.pressed.join() === '3333', 'a plain link: the editor is shut, 3333 pressed', JSON.stringify(u.pressed));
    ok(s.hash === '#', 'a plain link keeps the plain address', s.hash);

    await T.click('#custom-chip');
    u = await ui(T); s = await S(T);
    ok(u.open && u.chip === 'true' && u.pressed.length === 0, 'Custom opens the editor and is the one chip pressed', JSON.stringify(u));
    ok(u.cells === '3 3 3 3' && u.focusInBar && s.k === '3333', 'it opens on the orbifold shown, the bar holding the keyboard', u.cells + ' ' + u.focusInBar);
    ok(u.sayState === 'ok' && /Four features: 3 · 3 · 3 · 3\./.test(u.say), 'the line under the bar names the four features', u.say);
    await shot(page, 'w01-open');
    const paneTop0 = await T.evaluate(() => document.getElementById('pane2').getBoundingClientRect().top);

    // Delete down to an empty bar, as on the Classification page
    await type(page, ['Backspace']);
    u = await ui(T); s = await S(T);
    ok(u.cells === '3 3 3' && s.k === '3333' && u.sayState === 'no' && /has three features/.test(u.say) && /Still showing 3333/.test(u.say), 'three features: the reason, and the page keeps 3333', u.say);
    ok(u.tries.join() === '3332', 'the nearest that works is offered', u.tries.join());
    const paneTop1 = await T.evaluate(() => document.getElementById('pane2').getBoundingClientRect().top);
    ok(Math.abs(paneTop1 - paneTop0) < 1, 'the panes do not jump when the line changes', `${paneTop0} -> ${paneTop1}`);
    await shot(page, 'w02-three');
    await type(page, ['Backspace', 'Backspace', 'Backspace']);
    u = await ui(T);
    ok(u.cells === '' && /An empty bar/.test(u.say) && u.tries.length >= 3, 'an empty bar says what it takes and gives examples', u.say + ' ' + u.tries.join());
    await type(page, ['Backspace']);
    ok((await ui(T)).cells === '', 'Delete on an empty bar does nothing');

    // type 2 3 4 5
    await type(page, ['2', '3', '4']);
    s = await S(T);
    ok(s.k === '3333', 'nothing changes while three characters are typed', s.k);
    await type(page, ['5']);
    await page.waitForTimeout(300);
    u = await ui(T); s = await S(T);
    ok(s.k === '2345' && u.pair === '2! 3! 4 5' && u.sayState === 'ok', 'the fourth character shows 2345', s.k + ' | ' + u.pair);
    ok(s.hash === '#k=2345&m=0123&l=2&tw=0.175' && s.loc === s.hash, 'the address follows', s.hash + ' ' + s.loc);
    ok(s.pat && s.pat.tiles > 3, 'the pattern is drawn', JSON.stringify(s.pat && s.pat.tiles));
    await shot(page, 'w03-2345');

    // sliders, then a digit stepped: the pair and the sliders stay
    await T.evaluate(() => window.__handles.set({ L: 1.4, tw: -0.2 }));
    await T.evaluate(() => window.__handles.tapCone(2));
    await T.evaluate(() => window.__handles.tapCone(1));
    await T.evaluate(() => window.__handles.waitGlide());
    s = await S(T);
    const kept = { m: s.m, L: s.L, tw: s.tw };
    ok(s.m.slice(0, 2).split('').sort().join('') === '12', 'a pair picked on a custom orbifold', s.m);
    await T.focus('#cu-cells');
    await type(page, ['End', 'ArrowLeft']);          // on the last character, 5
    u = await ui(T);
    ok(u.minus === false && u.plus === false, 'a chosen digit can be stepped');
    await T.click('#cu-plus');
    await page.waitForTimeout(200);
    s = await S(T); u = await ui(T);
    ok(s.k === '2346' && s.m === kept.m && Math.abs(s.L - kept.L) < 1e-9 && Math.abs(s.tw - kept.tw) < 1e-9, 'a digit stepped: the pair and the sliders stay', `${s.k} ${s.m} ${s.L} ${s.tw}`);
    await T.focus('#cu-cells');          // the arrows are the bar's own keys
    await type(page, ['ArrowUp', 'ArrowUp', 'ArrowUp']);
    s = await S(T);
    ok(s.k === '2349', 'the up arrow steps it too, to 9', s.k);
    await type(page, ['ArrowUp']);
    ok((await S(T)).k === '2349' && (await ui(T)).plus === true, '9 is the highest order');

    // a mirror, then a corner on it
    await type(page, ['End', 'Backspace', '*']);
    await page.waitForTimeout(300);
    s = await S(T); u = await ui(T);
    ok(s.k === '234*' && u.pair.replace(/!/g, '') === '2 ∗ 3 4' && u.keys.mirror && u.rows.b && u.rows.bLabel === 'Mirror len' && !u.rows.tau, '234∗: a mirror, its key and its length slider', s.k + ' | ' + u.pair + ' ' + JSON.stringify(u.rows));
    ok(/^#k=234\*&m=\d{4}&l=[\d.]+&tw=-?[\d.]+&b=[\d.]+$/.test(s.hash), 'its address', s.hash);
    await type(page, ['5']);
    await page.waitForTimeout(300);
    s = await S(T); u = await ui(T);
    ok(s.k === '234*5' && u.pair.replace(/!/g, '') === '2 ∗5 3 4' && u.rows.tau && u.rows.tauLabel === 'Corner shift' && /&tc=/.test(s.hash), '234∗5: a digit after the star is a corner, with its shift slider', s.k + ' | ' + u.pair + ' ' + s.hash);
    if (opt.live) {
      await page.waitForTimeout(400);
      ok(/#k=234%2A5&m=\d{4}&l=[\d.]+&tw=-?[\d.]+&b=[\d.]+&tc=/.test(page.url()), 'on spacesheep the viewer\'s address follows, the star as %2A', page.url());
    }
    await shot(page, 'w04-234s5');
    await type(page, ['6']);
    u = await ui(T); s = await S(T);
    ok(s.k === '234*5' && /the mirror has two corners/.test(u.say) && u.tries.join() === '234*5,234*', 'two corners: not built, said so', u.say + ' | ' + u.tries.join());
    await T.click('#cu-say .trychip[data-k="234*"]');
    await page.waitForTimeout(200);
    ok((await S(T)).k === '234*' && (await ui(T)).cells === '2 3 4 star', 'a tap on an offer takes it', (await ui(T)).cells);

    // a crosscap in place of the mirror, by the buttons
    await T.click('#cu-remove');
    await T.click('#cu-add [data-add="x"]');
    await page.waitForTimeout(300);
    s = await S(T); u = await ui(T);
    ok(s.k === '234x' && u.keys.glide && u.rows.bLabel === 'Crosscap len', '234×: the add row works, the glide key shows', s.k + ' ' + JSON.stringify(u.keys));
    await shot(page, 'w05-234x');

    // a handle
    await type(page, ['Home', 'o']);
    u = await ui(T);
    ok(/×××/.test(u.say) || /crosscaps/.test(u.say), 'a ring beside a cross becomes two crosses more, and that is too many', u.say);
    await T.evaluate(() => window.__handles.custom.go('o27'));
    await page.waitForTimeout(300);
    s = await S(T); u = await ui(T);
    ok(s.k === 'o27' && u.pair.replace(/!/g, '') === 'o⁺ o⁻ 2 7' && u.keys.fault && u.rows.tau && u.rows.tauLabel === 'Handle shift' && /&to=/.test(s.hash), 'o27: a handle, its fault line key and its shift', s.k + ' ' + u.pair + ' ' + s.hash);
    for (const [i, j] of [[0, 1], [2, 3], [1, 2], [0, 3], [0, 2]]) {
      await T.evaluate(([a, b]) => window.__handles.pick(a, b), [i, j]);
      await T.evaluate(() => window.__handles.waitGlide());
    }
    s = await S(T);
    ok(s.k === 'o27' && Number.isFinite(s.L) && s.pat.tiles > 3, 'five picks on o27 leave a drawn pattern', JSON.stringify({ L: s.L, tw: s.tw, tiles: s.pat.tiles }));
    await T.evaluate(() => window.__handles.moment('follow'));
    await page.waitForTimeout(2200);
    ok((await S(T)).moment === 'follow', 'Follow the tree runs on a custom orbifold');
    await shot(page, 'w06-o27-follow');

    // a moment leaves for 3333: the bar follows; a chip of the page shuts the editor
    await T.evaluate(() => window.__handles.moment('half'));
    await page.waitForTimeout(200);
    u = await ui(T); s = await S(T);
    ok(s.k === '3333' && u.open && u.cells === '3 3 3 3' && u.pressed.length === 0, 'a moment goes to 3333 and the bar follows', u.cells);
    await T.click('[data-fam="333*3"]');
    await page.waitForTimeout(200);
    u = await ui(T); s = await S(T);
    ok(!u.open && u.chip === 'false' && u.pressed.join() === '333*3' && s.k === '333*3', 'a chip of the page shuts the editor', JSON.stringify(u.pressed));
    await T.click('#custom-chip');
    await page.waitForTimeout(250);
    u = await ui(T); s = await S(T);
    ok(u.open && u.cells === 'ring 2 7' && s.k === 'o27' && u.pressed.length === 0, 'Custom again comes back to the orbifold typed last: o27', u.cells + ' ' + s.k);
    await T.click('[data-fam="333*3"]');
    await T.evaluate(() => window.__handles.custom.open({ focus: true }));
    await T.evaluate(() => window.__handles.state());
    u = await ui(T);
    ok(u.open && u.cells === '3 3 3 star 3', 'opened without recall it is on what is shown: 333∗3', u.cells);

    // typing does not leak: a slider keeps its keys, the tutorial tab takes none
    await T.focus('#len-range');
    await type(page, ['2']);
    ok((await ui(T)).cells === '3 3 3 star 3', 'a digit typed on a slider is not taken');
    await T.click('.tab2[data-tab="tutorial"]');
    await T.evaluate(() => document.activeElement && document.activeElement.blur());
    await type(page, ['2', 'Backspace', 'Backspace']);
    await T.click('.tab2[data-tab="play"]');
    ok((await ui(T)).cells === '3 3 3 star 3', 'nothing is typed from the Tutorial tab');

    // drags and the ends of every slider on custom orbifolds: the pattern stays drawn
    for (const t of ['2345', '957*', '259*4', '957x', 'o29', '9999', '2229']) {
      await T.evaluate((x) => window.__handles.custom.go(x), t);
      await page.waitForTimeout(250);
      const box = await T.evaluate(() => { const r = document.getElementById('pattern').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
      let worst = Infinity;
      for (const [dx, dy] of [[0.42, 0.1], [-0.4, 0.3], [0.1, -0.45], [0.44, 0.02], [0.44, 0.02], [0.44, 0.02]]) {
        await page.mouse.move(off.x + box.x - dx * box.w / 2, off.y + box.y - dy * box.w / 2);
        await page.mouse.down();
        await page.mouse.move(off.x + box.x + dx * box.w / 2, off.y + box.y + dy * box.w / 2, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(120);
        worst = Math.min(worst, (await S(T)).pat.tiles);
      }
      ok(worst > 3, `${t}: dragged six times, the pattern stays drawn`, 'fewest tiles ' + worst);
      const ends = await T.evaluate(async () => {
        const out = [];
        for (const id of ['len-range', 'tw-range', 'b-range', 'tau-range']) {
          const inp = document.getElementById(id);
          if (inp.closest('[hidden]')) continue;
          for (const v of ['0', '1', '0.5']) {
            inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise((r) => setTimeout(r, 60));
            const st = window.__handles.state();
            out.push([id, v, st.pattern.tiles, Number.isFinite(st.d) && Number.isFinite(st.mDist)]);
          }
        }
        return out;
      });
      const bad = ends.filter(([, , tiles, fin]) => !(tiles > 3) || !fin);
      ok(bad.length === 0, `${t}: every slider at both ends`, JSON.stringify(bad));
      await T.click('#reset2');
    }

    // 2222 through the editor is the page's flat family
    await T.evaluate(() => window.__handles.custom.go('2222'));
    await page.waitForTimeout(300);
    s = await S(T); u = await ui(T);
    ok(s.k === '2222' && u.open && /Euclidean/.test(await T.textContent('#pat-sub')), '2222 typed is the flat one', s.k);
    await T.evaluate(() => window.__handles.custom.go('2223'));
    await page.waitForTimeout(300);
    ok((await S(T)).k === '2223', 'and one digit up it is hyperbolic 2223');
    await ctx.close();
  }

  // ---------------------------------------------------------------- links
  {
    const { ctx, page, T, off } = await newPage({ viewport: { width: 1280, height: 900 } }, '#k=259%2A4&m=1302&l=1.3&tw=-0.25&b=0.8&tc=0.1');
    let s = await S(T), u = await ui(T);
    ok(s.k === '259*4' && s.m === '1302' && Math.abs(s.L - 1.3) < 1e-9 && Math.abs(s.b - 0.8) < 1e-9 && Math.abs(s.tau - 0.1) < 1e-9, 'a link to a custom orbifold opens it with its numbers', JSON.stringify(s));
    ok(u.open && u.chip === 'true' && u.cells === '2 5 9 star 4' && u.pressed.length === 0, 'with the editor open on it', u.cells);
    ok(s.hash === '#k=259*4&m=1302&l=1.3&tw=-0.25&b=0.8&tc=0.1', 'and the same address back', s.hash);
    await shot(page, 'l01-link');
    await ctx.close();
  }
  {
    const { ctx, page, T, off } = await newPage({ viewport: { width: 1280, height: 900 } }, '#k=237');
    const s = await S(T), u = await ui(T);
    ok(s.k === '3333' && u.open && u.cells === '2 3 7' && /has three features/.test(u.say), 'a link to a signature the page cannot show opens the editor on it, with the reason', JSON.stringify({ k: s.k, cells: u.cells, say: u.say }));
    await ctx.close();
  }
  {
    const { ctx, page, T, off } = await newPage({ viewport: { width: 1280, height: 900 } }, '#k=nonsense');
    const s = await S(T), u = await ui(T);
    ok(s.k === '3333' && !u.open, 'a broken link opens the page as before', JSON.stringify({ k: s.k, open: u.open }));
    await ctx.close();
  }
  {
    const { ctx, page, T, off } = await newPage({ viewport: { width: 1280, height: 900 } }, '#k=o33&m=0213&l=2.2&tw=0.15&b=1.3&to=0.25');
    const s = await S(T), u = await ui(T);
    ok(s.k === 'o33' && !u.open && u.pressed.join() === 'o33', 'an old link to a family of the page is unchanged', JSON.stringify(u.pressed));
    await ctx.close();
  }

  // ---------------------------------------------------------------- a phone, dark
  {
    const { ctx, page, T, off } = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', hasTouch: true, isMobile: true }, '#k=o25');
    let u = await ui(T);
    ok(u.open && !u.overflowX, 'a phone: the editor open, nothing wider than the screen', JSON.stringify({ open: u.open, overflowX: u.overflowX }));
    const order = await T.evaluate(() => ['.seg', '#custom-ed', '.sig-wrap', '#pane2'].map((q) => Math.round(document.querySelector(q).getBoundingClientRect().top)));
    ok(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], 'the editor sits under the chips, before the Pair buttons', order.join(' '));
    const small = await T.evaluate(() => [...document.querySelectorAll('#custom-ed button')].filter((b) => !b.classList.contains('symcell') && b.offsetParent !== null).map((b) => { const r = b.getBoundingClientRect(); return [b.id || b.dataset.add || b.dataset.k, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => h < 40 || w < 40));
    ok(small.length === 0, 'the editor\'s buttons are a finger wide', JSON.stringify(small));
    await T.tap('#cu-add [data-add="cone"]');
    u = await ui(T);
    ok(/has five features/.test(u.say) && !u.overflowX, 'a tap on "cone" adds one; five features are too many', u.say);
    await shot(page, 'p01-phone-dark', { fullPage: true });
    await T.tap('#cu-remove');
    await page.waitForTimeout(200);
    ok((await S(T)).k === 'o25', 'delete takes it away again');
    for (const t of ['2379', '957*', '222*2', '999x', 'o99', '22222*']) {
      await T.evaluate((x) => window.__handles.custom.go(x), t);
      await page.waitForTimeout(250);
      u = await ui(T);
      ok(!u.overflowX, `${t} on a phone: nothing wider than the screen`);
    }
    await ctx.close();
  }
} finally {
  await B.close();
}
console.log(`${failed ? 'FAILED ' + failed : 'all ok'}; page errors ${errors}`);
process.exit(failed || errors ? 1 : 0);
