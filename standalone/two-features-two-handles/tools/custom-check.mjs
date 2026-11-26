// custom-check.mjs — the text field after the chips ("or type an orbifold") in a real Chrome: typed with the keyboard,
// tapped, dragged, linked to, on a wide screen and on a phone in the dark.
//
//   node tools/custom-check.mjs [--root <this folder>] [--page site/index.html] [--shots <dir>] [--live <url>]
// --live takes the page's address on spacesheep (https://spacesheep.dev/@yaroslavvb/two-features-two-handles): there
// the page runs in the viewer's frame, so the checks are made in that frame and the viewer's own address is checked too.
// Needs The Folding's browser door (~/git/animated-groups-fable/standalone/the-folding/tools/browser.mjs) and its
// PLAYWRIGHT_MJS / FOLDING_BROWSER settings, as steps.json's shot.mjs does. Prints one line a check (ok / FAIL) and
// exits 1 if any failed or the page logged an error. No default of a family is written in here: the page's own
// state says what a fresh orbifold's numbers are.

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
const S = (T) => T.evaluate(() => { const s = window.__handles.state(); return { k: s.k, m: s.m, L: s.L, tw: s.tw, b: s.b, tau: s.tau, hash: s.hash, loc: s.locationHash, feat: s.featLabels, custom: s.custom, tab: s.tab, pat: s.pattern, moment: s.moment }; });
const ui = (T) => T.evaluate(() => {
  const f = document.getElementById('custom-in'), pop = document.getElementById('custom-pop');
  const fr = f.getBoundingClientRect(), pr = pop.hidden ? null : pop.getBoundingClientRect();
  return {
    value: f.value, on: f.dataset.on === '1', placeholder: f.placeholder, focused: document.activeElement === f,
    color: getComputedStyle(f).color, muted: getComputedStyle(document.querySelector('.sig-label')).color,
    field: [Math.round(fr.width), Math.round(fr.height)],
    note: pop.hidden ? '' : pop.textContent, tries: [...pop.querySelectorAll('.trylink')].map((b) => b.dataset.k),
    noteBox: pr && { left: Math.round(pr.left), right: Math.round(pr.right), top: Math.round(pr.top), under: Math.round(pr.top - fr.bottom) },
    pressed: [...document.querySelectorAll('[data-fam][aria-pressed="true"]')].map((b) => b.dataset.fam),
    pair: [...document.querySelectorAll('.sig-btn')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '!' : '')).join(' '),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, vw: document.documentElement.clientWidth,
    keys: { fault: !document.getElementById('key-fault').hidden, mirror: !document.getElementById('key-mirror').hidden, glide: !document.getElementById('key-glide').hidden },
    rows: { tau: !document.getElementById('tau-row').hidden && !document.getElementById('extra-sliders').hidden, b: !document.getElementById('b-row').hidden && !document.getElementById('extra-sliders').hidden, tauLabel: document.getElementById('tau-label').textContent, bLabel: document.getElementById('b-label').textContent },
    old: !!document.getElementById('custom-chip') || !!document.getElementById('custom-ed') || !!document.querySelector('.symcells'),
  };
});
const shot = async (page, name, o = {}) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), ...o }); };
const paneTop = (T) => T.evaluate(() => document.getElementById('pane2').getBoundingClientRect().top);

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
  /** Empty the field and type into it, key by key. */
  const typeIn = async (text) => { await T.click('#custom-in'); await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A'); await page.keyboard.press('Backspace'); if (text) await page.keyboard.type(text, { delay: 15 }); await page.waitForTimeout(250); };
  return { ctx, page, T, off, typeIn };
}

try {
  // ---------------------------------------------------------------- wide screen, a mouse and a keyboard
  {
    const { ctx, page, T, off, typeIn } = await newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    let u = await ui(T), s = await S(T);
    ok(!u.old, 'the Custom chip and its editor are gone', JSON.stringify(u.old));
    ok(u.value === '' && /orbifold/.test(u.placeholder) && /2345/.test(u.placeholder) && !u.on && u.pressed.join() === '3333', 'a plain link: an empty field whose hint says an orbifold can be typed, 3333 pressed', u.placeholder);
    ok(s.hash === '#' && u.note === '', 'a plain link keeps the plain address, and no note', s.hash + ' ' + u.note);
    ok(u.field[1] >= 44, 'the field is as tall as a chip', u.field.join('x'));
    // the hint's own examples must be ones the page shows
    const examples = u.placeholder.split(':')[1].split(',').map((x) => x.trim()).filter(Boolean);
    ok(examples.length >= 3, 'the hint gives examples', u.placeholder);
    for (const ex of examples) {
      await typeIn(ex);
      const [se, ue] = [await S(T), await ui(T)];
      ok(ue.on && ue.note === '' && se.custom.why === null, `the hint's example ${ex} is shown when typed`, JSON.stringify([se.k, ue.on, ue.note]));
    }
    await typeIn('');          // the field first: a tap on a field that holds an orbifold brings it back
    await T.click('[data-fam="3333"]');
    await T.evaluate(() => document.activeElement && document.activeElement.blur());
    await shot(page, 'w01-plain');
    const top0 = await paneTop(T);

    // typed key by key: nothing changes until there are four features, then the orbifold is shown
    await T.click('#custom-in');
    for (const [ch, want] of [['2', 'one'], ['3', 'two'], ['7', 'three']]) {
      await page.keyboard.type(ch);
      await page.waitForTimeout(120);
      u = await ui(T); s = await S(T);
      ok(s.k === '3333' && new RegExp(`has ${want} feature`).test(u.note) && u.noteBox && u.noteBox.under >= 0 && u.noteBox.under < 12, `"${u.value}": 3333 stays, and a note under the field says ${want} of four`, JSON.stringify([s.k, u.note, u.noteBox]));
    }
    ok(u.tries.join() === '2372', 'the nearest that works is offered', u.tries.join());
    ok(Math.abs((await paneTop(T)) - top0) < 1, 'the note moves nothing on the page');
    await shot(page, 'w02-three');
    await page.keyboard.type('9');
    await page.waitForTimeout(350);
    u = await ui(T); s = await S(T);
    ok(s.k === '2379' && u.on && u.note === '' && u.pressed.length === 0 && u.pair === '2! 3! 7 9', 'the fourth character shows 2379: the field lit like a pressed chip, no chip pressed', JSON.stringify([s.k, u.on, u.pressed, u.pair]));
    ok(/^#k=2379&m=0123&l=[\d.]+&tw=-?[\d.]+$/.test(s.hash) && s.loc === s.hash, 'the address follows', s.hash + ' ' + s.loc);
    ok(s.pat && s.pat.tiles > 3, 'the pattern is drawn', JSON.stringify(s.pat && s.pat.tiles));
    await shot(page, 'w03-2379');

    // a pair picked, sliders moved, then a digit changed in the field: the pair and the sliders stay
    await T.evaluate(() => window.__handles.set({ L: 1.4, tw: -0.2 }));
    await T.evaluate(() => window.__handles.tapCone(2));
    await T.evaluate(() => window.__handles.tapCone(1));
    await T.evaluate(() => window.__handles.waitGlide());
    s = await S(T);
    const kept = { m: s.m, L: s.L, tw: s.tw };
    ok(s.m.slice(0, 2).split('').sort().join('') === '12', 'a pair picked on a typed orbifold', s.m);
    await T.click('#custom-in');
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(150);
    ok((await S(T)).k === '2379' && /has three features/.test((await ui(T)).note), 'one character deleted: 2379 stays meanwhile');
    await page.keyboard.type('5');
    await page.waitForTimeout(300);
    s = await S(T);
    ok(s.k === '2375' && s.m === kept.m && Math.abs(s.L - kept.L) < 1e-9 && Math.abs(s.tw - kept.tw) < 1e-9, 'a digit changed: the pair and the sliders stay', `${s.k} ${s.m} ${s.L} ${s.tw}`);

    // loose notation: spaces, the star and the cross as typed or as printed, rings and crosses anywhere, capitals
    for (const [text, k, pair] of [['2 3 4 *', '234*', '2 ∗ 3 4'], ['234∗5', '234*5', '2 ∗5 3 4'], ['x 2 3 4', '234x', '2 × 3 4'], ['2,3,4,×', '234x', '2 × 3 4'], ['27o', 'o27', 'o⁺ o⁻ 2 7'], ['O27', 'o27', 'o⁺ o⁻ 2 7'], ['5432', '5432', '5 4 3 2']]) {
      await typeIn(text);
      s = await S(T); u = await ui(T);
      ok(s.k === k && u.on && u.value === text && u.pair.replace(/!/g, '') === pair && u.note === '', `"${text}" is read as ${k}, and stays as typed`, JSON.stringify([s.k, u.value, u.pair, u.note]));
    }
    await typeIn('234*5');
    s = await S(T); u = await ui(T);
    ok(u.keys.mirror && u.rows.b && u.rows.bLabel === 'Mirror len' && u.rows.tau && u.rows.tauLabel === 'Corner shift' && /^#k=234\*5&m=\d{4}&l=[\d.]+&tw=-?[\d.]+&b=[\d.]+&tc=-?[\d.]+$/.test(s.hash), '234∗5: the mirror\'s key, its length and its corner shift, its address', JSON.stringify(u.rows) + ' ' + s.hash);
    if (opt.live) {
      await page.waitForTimeout(400);
      ok(/#k=234%2A5&m=\d{4}&l=[\d.]+&tw=-?[\d.]+&b=[\d.]+&tc=/.test(page.url()), 'on spacesheep the viewer\'s address follows, the star as %2A', page.url());
    }
    await shot(page, 'w04-234s5');
    await typeIn('234x');
    u = await ui(T);
    ok(u.keys.glide && u.rows.bLabel === 'Crosscap len' && !u.rows.tau, '234×: the glide key and the crosscap\'s length', JSON.stringify([u.keys, u.rows]));
    await typeIn('o27');
    u = await ui(T); s = await S(T);
    ok(u.keys.fault && u.rows.tau && u.rows.tauLabel === 'Handle shift' && /&to=/.test(s.hash), 'o27: the handle\'s fault line key and its shift', JSON.stringify(u.rows) + ' ' + s.hash);

    // what cannot be shown says why, and offers what can. The page keeps the last orbifold it could show: what was
    // there before, or what the text was on its way (2345 while 23456 is typed)
    for (const [text, stays, re, tries] of [['234*56', '234*5', /the mirror has two corners/, '234*5,234*'], ['22*x', 'o27', /has a mirror and a crosscap/, '222*,222x'], ['oo', 'o27', /has two handles/, 'o22'], ['23456', '2345', /has five features/, '2345'], ['*632', 'o27', /has one feature/, '222*6,222*'], ['2y4', 'o27', /Not a signature/, ''], ['1', 'o27', /Not a signature/, '']]) {
      await typeIn('o27');
      await typeIn(text);
      u = await ui(T); s = await S(T);
      ok(s.k === stays && !u.on && re.test(u.note) && u.tries.join() === tries, `"${text}": ${stays} stays, the note says why`, JSON.stringify([s.k, u.note, u.tries]));
      ok(u.noteBox.left >= 0 && u.noteBox.right <= u.vw && !u.overflowX, `"${text}": the note is inside the page`, JSON.stringify(u.noteBox));
    }
    await shot(page, 'w05-why');
    await page.keyboard.press('Enter');
    ok((await S(T)).k === 'o27' && (await ui(T)).value === '1', 'Enter on what cannot be shown changes nothing');
    await typeIn('22*x');
    await T.click('#custom-pop .trylink[data-k="222x"]');
    await page.waitForTimeout(300);
    u = await ui(T); s = await S(T);
    ok(s.k === '222x' && u.on && u.value === '222×' && u.focused && u.note === '', 'a tap on an offer takes it; the field keeps the keyboard', JSON.stringify([s.k, u.value, u.focused]));

    // the field beside the chips: a chip takes over, the field keeps its text in gray, a tap on it brings it back
    await T.click('[data-fam="333*3"]');
    await page.waitForTimeout(250);
    u = await ui(T); s = await S(T);
    ok(s.k === '333*3' && !u.on && u.value === '222×' && u.pressed.join() === '333*3' && u.color === u.muted && u.note === '', 'a chip of the page takes over; the field keeps its text, gray and unlit', JSON.stringify([s.k, u.on, u.value, u.color, u.muted]));
    await shot(page, 'w06-chip');
    await T.click('#custom-in');
    await page.waitForTimeout(250);
    s = await S(T); u = await ui(T);
    ok(s.k === '222x' && u.on && u.pressed.length === 0, 'a tap on the field brings its orbifold back, as a chip would', JSON.stringify([s.k, u.on]));
    await typeIn('3333');
    u = await ui(T); s = await S(T);
    ok(s.k === '3333' && !u.on && u.pressed.join() === '3333', 'one of the page\'s own typed in lights its chip, not the field', JSON.stringify([s.k, u.on, u.pressed]));
    await typeIn('2222');
    ok((await S(T)).k === '2222' && /Euclidean/.test(await T.textContent('#pat-sub')), '2222 typed is the flat one');
    await typeIn('');
    u = await ui(T);
    ok((await S(T)).k === '2222' && u.note === '' && !u.on, 'an emptied field says nothing and changes nothing');

    // a moment leaves for 3333 while the field holds a typed orbifold: its text stays, unlit
    await typeIn('o29');
    for (const [i, j] of [[0, 1], [2, 3], [1, 2], [0, 3], [0, 2]]) {
      await T.evaluate(([a, b]) => window.__handles.pick(a, b), [i, j]);
      await T.evaluate(() => window.__handles.waitGlide());
    }
    s = await S(T);
    ok(s.k === 'o29' && Number.isFinite(s.L) && s.pat.tiles > 3, 'five picks on o29 leave a drawn pattern', JSON.stringify({ L: s.L, tw: s.tw, tiles: s.pat.tiles }));
    await T.evaluate(() => { document.activeElement && document.activeElement.blur(); window.__handles.moment('follow'); });
    await page.waitForTimeout(2200);
    ok((await S(T)).moment === 'follow', 'Follow the tree runs on a typed orbifold');
    await shot(page, 'w07-o29-follow');
    await T.evaluate(() => window.__handles.moment('half'));
    await page.waitForTimeout(200);
    u = await ui(T); s = await S(T);
    ok(s.k === '3333' && !u.on && u.value === 'o29' && u.pressed.join() === '3333', 'a moment goes to 3333: the field keeps o29, unlit', JSON.stringify([s.k, u.value, u.on]));

    // typing stays in the field: nothing typed elsewhere reaches it
    await T.focus('#len-range');
    await page.keyboard.press('2');
    await T.click('.tab2[data-tab="tutorial"]');
    await T.evaluate(() => document.activeElement && document.activeElement.blur());
    for (const k of ['2', '3', 'Backspace']) await page.keyboard.press(k);
    await T.click('.tab2[data-tab="play"]');
    ok((await ui(T)).value === 'o29' && (await S(T)).k === '3333', 'keys pressed on a slider or on the Tutorial tab do not reach the field');

    // drags and the ends of every slider on typed orbifolds: the pattern stays drawn
    for (const t of ['2345', '957*', '259*4', '957x', 'o29', '9999', '2229']) {
      await T.evaluate((x) => { document.activeElement && document.activeElement.blur(); window.__handles.custom.type(x); }, t);
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
      ok((await S(T)).k === t && worst > 3, `${t}: dragged six times, the pattern stays drawn`, 'fewest tiles ' + worst);
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
    await ctx.close();
  }

  // ---------------------------------------------------------------- links
  {
    const { ctx, page, T } = await newPage({ viewport: { width: 1280, height: 900 } }, '#k=259%2A4&m=1302&l=1.3&tw=-0.25&b=0.8&tc=0.1');
    const s = await S(T), u = await ui(T);
    ok(s.k === '259*4' && s.m === '1302' && Math.abs(s.L - 1.3) < 1e-9 && Math.abs(s.b - 0.8) < 1e-9 && Math.abs(s.tau - 0.1) < 1e-9, 'a link to a typed orbifold opens it with its numbers', JSON.stringify(s));
    ok(u.on && u.value === '259∗4' && u.pressed.length === 0 && u.note === '', 'with the field holding it, lit', JSON.stringify([u.on, u.value]));
    ok(s.hash === '#k=259*4&m=1302&l=1.3&tw=-0.25&b=0.8&tc=0.1', 'and the same address back', s.hash);
    await shot(page, 'l01-link');
    await ctx.close();
  }
  {
    const { ctx, page, T } = await newPage({ viewport: { width: 1280, height: 900 } }, '#k=237');
    const s = await S(T), u = await ui(T);
    ok(s.k === '3333' && u.value === '237' && !u.on && /has three features/.test(u.note) && u.tries.join() === '2372', 'a link to a signature the page cannot show: it is in the field, with the reason', JSON.stringify({ k: s.k, value: u.value, note: u.note }));
    await shot(page, 'l02-237');
    await T.click('h1');
    await page.waitForTimeout(150);
    ok((await ui(T)).value === '237', 'the field keeps it');
    await ctx.close();
  }
  {
    const { ctx, T } = await newPage({ viewport: { width: 1280, height: 900 } }, '#k=o33&m=0213&l=2.2&tw=0.15&b=1.3&to=0.25');
    const s = await S(T), u = await ui(T);
    ok(s.k === 'o33' && !u.on && u.value === '' && u.pressed.join() === 'o33', 'an old link to a family of the page is unchanged', JSON.stringify(u.pressed));
    await ctx.close();
  }

  // ---------------------------------------------------------------- narrower windows: the chips, the field and the Pair buttons
  for (const w of [1100, 940, 760, 600]) {
    const { ctx, T } = await newPage({ viewport: { width: w, height: 800 } });
    const u = await ui(T);
    const rows = await T.evaluate(() => ['[data-fam="3333"]', '#custom-in', '.sig-wrap', '#pane2'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right)]; }));
    ok(!u.overflowX && u.field[0] >= 150 && rows[1][2] <= w && rows[2][1] < rows[3][1], `${w} px wide: the field keeps its width, nothing wider than the window`, JSON.stringify([u.field, rows]));
    await ctx.close();
  }

  // ---------------------------------------------------------------- a phone, dark, touch
  {
    const { ctx, page, T } = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', hasTouch: true, isMobile: true }, '#k=o25');
    let u = await ui(T);
    ok(u.on && u.value === 'o25' && !u.overflowX && u.field[1] >= 44 && u.field[0] >= 150, 'a phone: the field lit on o25, a finger tall, nothing wider than the screen', JSON.stringify([u.on, u.value, u.field, u.overflowX]));
    const fontPx = await T.evaluate(() => parseFloat(getComputedStyle(document.getElementById('custom-in')).fontSize));
    ok(fontPx >= 16, 'its text is 16 px, so a phone does not zoom in on it', String(fontPx));
    await T.tap('#custom-in');
    for (const t of ['o252', '23*56', '22**', '99999999', 'o o o', 'nonsense text here']) {
      await T.evaluate((x) => window.__handles.custom.type(x), t);
      await page.waitForTimeout(200);
      u = await ui(T);
      ok(u.note !== '' && u.noteBox.left >= 0 && u.noteBox.right <= u.vw && !u.overflowX, `"${t}" on a phone: its note is inside the screen`, JSON.stringify([u.note.slice(0, 40), u.noteBox, u.vw]));
    }
    await shot(page, 'p01-phone-dark-note');
    const small = await T.evaluate(() => [...document.querySelectorAll('#custom-pop .trylink')].map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.k, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => h < 32 || w < 44));
    ok(small.length === 0, 'the offers are wide enough for a finger', JSON.stringify(small));
    for (const t of ['2379', '957*', '222*2', '999x', 'o99']) {
      await T.evaluate((x) => window.__handles.custom.type(x), t);
      await page.waitForTimeout(250);
      u = await ui(T);
      ok((await S(T)).k === t && u.on && !u.overflowX, `${t} on a phone: shown, nothing wider than the screen`);
    }
    await shot(page, 'p02-phone-dark', { fullPage: true });
    await ctx.close();
  }
} finally {
  await B.close();
}
console.log(`${failed ? 'FAILED ' + failed : 'all ok'}; page errors ${errors}`);
process.exit(failed || errors ? 1 : 0);
