// custom-check.mjs — the text field after the chips ("or type any orbifold") in a real Chrome: typed with the keyboard,
// tapped, dragged, linked to, on a wide screen and on a phone in the dark. And the print: at a family's default
// numbers the pattern is the Classification of Surfaces page's, lying as it lies there (src/paisley.js). And what
// the field opens beyond four features: five or six cone points, with a plus to pick another pair to move
// (src/multi.js), and every other orbifold, shown still with its pair controls off.
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
const S = (T) => T.evaluate(() => { const s = window.__handles.state(); return { k: s.k, m: s.m, L: s.L, tw: s.tw, b: s.b, tau: s.tau, hash: s.hash, loc: s.locationHash, feat: s.featLabels, custom: s.custom, classified: s.classified, print: s.print, tab: s.tab, pat: s.pattern, moment: s.moment, mode: s.mode || 'pairs', multi: s.multi || null, still: s.still || null, controls: s.controls || null, cones: s.tileScreens || [], mid: s.pairMid || null, d: s.d, mDist: s.mDist }; });
// the same engine in node: the print must come out the same on every machine
const engine = await import(path.join(root, 'src/handles.js'));
const mul3 = (A, B) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => A[3 * r] * B[c] + A[3 * r + 1] * B[3 + c] + A[3 * r + 2] * B[6 + c]));
/** How far the pattern on the screen is from lying as on the Classification page (0: exactly so; Infinity: that page has no such view). */
const offClassified = (s) => { const v = s.multi ? s.multi.view : s.classified.view; if (!v) return Infinity; const now = mul3(s.pat.V, s.pat.base); return Math.max(...now.map((x, i) => Math.abs(x - v[i]))); };
/** How far each of the tile's cone points moved on the screen between two states, in px. */
const movedPx = (a, b) => a.cones.map((p, i) => Math.hypot(p.x - b.cones[i].x, p.y - b.cones[i].y));
const slide = (T, id, v) => T.evaluate(([i, x]) => { const r = document.getElementById(i); r.value = x; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, [id, String(v)]);
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
    pair: [...document.querySelectorAll('.sig-btn')].filter((b) => !b.hidden).map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '!' : '')).join(' '),
    // the pair controls: which feature buttons are grayed (a pair not yet picked, or an orbifold shown still), the plus, the sliders
    grayed: [...document.querySelectorAll('.sig-btn')].filter((b) => !b.hidden).map((b) => (b.dataset.off === '1' || b.disabled ? '-' : '+')).join(''),
    plus: (() => { const b = document.getElementById('pair-add'); if (b.hidden) return null; const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
    slidersOff: document.querySelector('.controls .sliders').hasAttribute('inert'),
    stillNote: document.getElementById('still-note').hidden ? '' : document.getElementById('still-note').textContent,
    surfSub: document.getElementById('surf-sub') ? document.getElementById('surf-sub').textContent : '',
    lenShown: document.getElementById('val-len') ? document.getElementById('val-len').textContent : '',
    pairRow: (() => { const r = document.querySelector('.sig-wrap').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; })(),
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
  // ---------------------------------------------------------------- the print: the Classification page's, at the defaults
  {
    const { ctx, page, T } = await newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const chips = await T.evaluate(() => [...document.querySelectorAll('[data-fam]')].map((b) => b.dataset.fam));
    for (const k of chips) {
      await T.click(`[data-fam="${k}"]`);
      await page.waitForTimeout(350);
      const s = await S(T), mine = engine.paisleyInfo(k);
      ok(s.k === k && s.classified.at && s.classified.exact && offClassified(s) < 1e-6, `${k}: opens on the Classification page's pattern, lying as it lies there`, JSON.stringify([s.classified.at, s.classified.exact, offClassified(s)]));
      ok(s.pat.shapes === mine.tied.length && s.classified.tied.join() === mine.tied.join() && s.classified.shapes === mine.shapes, `${k}: the same commas on the same cone points here as in node`, JSON.stringify([s.pat.shapes, s.classified.tied, mine.tied]));
      ok(s.pat.shapes === s.classified.shapes && s.classified.joint.clear && s.print.scale === 1 && Math.abs(s.classified.joint.delta - mine.joint.delta) < 1e-6, `${k}: every comma whole, at that page's size, and a joint that runs through none`, JSON.stringify([s.pat.shapes, s.classified.shapes, s.classified.joint, s.print]));
      await shot(page, 'p-' + k.replace('*', 's'));
    }
    // a slider moves: the pattern holds its place (the view is not touched), and Reset then centres on the pair
    await T.click('[data-fam="3333"]');
    await page.waitForTimeout(300);
    const before = await S(T);
    await T.evaluate(() => { const r = document.getElementById('tw-range'); r.value = '0.62'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(400);
    let s = await S(T);
    ok(!s.classified.at && Math.abs(s.tw - before.tw) > 0.05 && s.pat.shapes === before.pat.shapes && s.pat.shapes === s.classified.shapes && s.print.scale === 1, 'Twist moved on 3333: the same commas, whole and at their size, ride with their blocks', JSON.stringify([s.tw, s.pat.shapes, s.print]));
    await shot(page, 'p-3333-twist');
    // his example: "…#k=2222&m=0123&l=1&tw=0.0067, if I apply the twist, it breaks comma"
    {
      const ex = await newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }, '#k=2222&m=0123&l=1&tw=0.0067');
      let se = await S(ex.T);
      ok(se.k === '2222' && Math.abs(se.tw - 0.0067) < 1e-9 && se.pat.shapes === se.classified.shapes && se.print.scale === 1, 'his link to 2222 at Twist 0.0067: two whole commas a tile', JSON.stringify([se.tw, se.pat.shapes, se.classified.shapes, se.print]));
      for (const u of ['0.8', '0.07', '1']) {
        await ex.T.evaluate((v) => { const r = document.getElementById('tw-range'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, u);
        await ex.page.waitForTimeout(250);
        se = await S(ex.T);
        ok(se.pat.shapes === se.classified.shapes && se.print.scale === 1, `2222 at Twist ${se.tw.toFixed(2)}: still two whole commas a tile, at their size`, JSON.stringify([se.pat.shapes, se.print]));
      }
      await shot(ex.page, 'p-2222-twist');
      await ex.ctx.close();
    }
    // 333∗: one comma fills the tile, larger than any block: whole all the same, drawn in a little once the Twist leaves the family's own
    await T.click('[data-fam="333*"]');
    await page.waitForTimeout(300);
    const star0 = await S(T);
    await T.evaluate(() => { const r = document.getElementById('tw-range'); r.value = '0.75'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(400);
    s = await S(T);
    ok(star0.print.scale === 1 && star0.print.fit < 1 && s.pat.shapes === 1 && s.print.scale < 1 && Math.abs(s.print.scale - s.print.fit) < 1e-9, '333∗ twisted: its one comma whole, drawn in to its block', JSON.stringify([star0.print, s.pat.shapes, s.print]));
    await shot(page, 'p-333s-twist');
    // a pick: the commas stay and are tied to the new pair's blocks; a Twist along the new cut keeps them whole; the link says the same
    await T.click('[data-fam="3333"]');
    await page.waitForTimeout(300);
    await T.evaluate(() => window.__handles.pick(0, 2, { glide: false }));
    await page.waitForTimeout(400);
    s = await S(T);
    ok(s.m !== before.m && s.print.own && s.print.joint.clear && s.pat.shapes === before.pat.shapes && s.print.scale === 1, 'a pick on 3333: the same commas, tied to the new pair\'s blocks', JSON.stringify([s.m, s.print, s.pat.shapes]));
    await T.evaluate(() => { const r = document.getElementById('tw-range'); r.value = '0.3'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(400);
    s = await S(T);
    ok(s.pat.shapes === before.pat.shapes && s.print.scale === 1, 'and a Twist along the new cut: whole, at their size', JSON.stringify([s.tw, s.pat.shapes, s.print]));
    await shot(page, 'p-3333-pick-twist');
    {
      const linked = await newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 }, s.hash);
      const sl = await S(linked.T);
      ok(sl.m === s.m && sl.print.own && sl.print.joint.clear && Math.abs(sl.print.joint.delta - s.print.joint.delta) < 1e-6 && sl.pat.shapes === s.pat.shapes, 'the link to that state opens with the same print', JSON.stringify([sl.m, sl.print, s.print]));
      await linked.ctx.close();
    }
    await T.click('#reset2');
    await page.waitForTimeout(300);
    s = await S(T);
    ok(offClassified(s) > 1e-3, 'Reset away from the defaults centres on the pair', String(offClassified(s)));
    // back at the defaults, dragged away, Reset: the classified view again
    await T.click('[data-fam="2222"]');
    await page.waitForTimeout(300);
    const box = await (await T.$('#pattern')).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 40, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    s = await S(T);
    const dragged = offClassified(s);
    await T.click('#reset2');
    await page.waitForTimeout(300);
    s = await S(T);
    ok(dragged > 1e-3 && s.classified.at && offClassified(s) < 1e-6, '2222 dragged, then Reset: lying as on the Classification page again', JSON.stringify([dragged, offClassified(s)]));
    await ctx.close();

    // a link copied at the defaults carries rounded numbers: it opens on the defaults themselves
    for (const k of chips) {
      const fresh = await newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
      await fresh.T.click(`[data-fam="${k}"]`);
      await fresh.page.waitForTimeout(250);
      const hash = (await S(fresh.T)).hash;
      await fresh.ctx.close();
      if (hash === '#') continue;
      const linked = await newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 }, hash.replace('*', '%2A'));
      const sl = await S(linked.T);
      ok(sl.k === k && sl.classified.at && offClassified(sl) < 1e-6 && sl.hash === hash, `a link copied at ${k}'s defaults (${hash}) opens as classified`, JSON.stringify([sl.k, sl.classified.at, offClassified(sl), sl.hash]));
      await linked.ctx.close();
    }
  }

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

    // typed key by key: one cone point alone and two of different orders have no pattern (3333 stays, a note says
    // why); three are an orbifold, shown still; four are one of this page's own, with its pair picked
    await T.click('#custom-in');
    for (const [ch, re] of [['2', /one cone point cannot stand alone/], ['3', /two cone points alone must be of one order/]]) {
      await page.keyboard.type(ch);
      await page.waitForTimeout(120);
      u = await ui(T); s = await S(T);
      ok(s.k === '3333' && re.test(u.note) && u.noteBox && u.noteBox.under >= 0 && u.noteBox.under < 12, `"${u.value}": 3333 stays, and a note under the field says why no pattern has it`, JSON.stringify([s.k, u.note, u.noteBox]));
    }
    ok(u.tries.join() === '22,33,322', 'the nearest that have a pattern are offered', u.tries.join());
    ok(Math.abs((await paneTop(T)) - top0) < 1, 'the note moves nothing on the page');
    await shot(page, 'w02-two');
    await page.keyboard.type('7');
    await page.waitForTimeout(350);
    u = await ui(T); s = await S(T);
    ok(s.k === '237' && s.mode === 'still' && u.on && u.note === '' && u.pair === '2 3 7' && u.grayed === '---' && u.slidersOff && /rigid/.test(u.stillNote) && u.plus === null, 'the third character shows 237: a rigid orbifold, its pair controls off, a line under the sliders says why', JSON.stringify([s.k, s.mode, u.on, u.pair, u.grayed, u.slidersOff, u.stillNote]));
    ok(s.hash === '#k=237' && s.loc === s.hash && s.pat.tiles > 3 && s.controls.off, 'its address is its signature, its pattern is drawn', JSON.stringify([s.hash, s.pat.tiles]));
    await shot(page, 'w02-237');
    await page.keyboard.type('9');
    await page.waitForTimeout(350);
    u = await ui(T); s = await S(T);
    ok(!u.slidersOff && u.stillNote === '' && u.grayed === '++++', 'a fourth character: the pair controls are back', JSON.stringify([u.slidersOff, u.stillNote, u.grayed]));
    ok(s.k === '2379' && u.on && u.note === '' && u.pressed.length === 0 && u.pair === '2! 3! 7 9', 'the fourth character shows 2379: the field lit like a pressed chip, no chip pressed', JSON.stringify([s.k, u.on, u.pressed, u.pair]));
    ok(/^#k=2379&m=\d{4}&l=[\d.]+&tw=-?[\d.]+$/.test(s.hash) && s.loc === s.hash, 'the address follows', s.hash + ' ' + s.loc);
    ok(s.classified.at && s.classified.exact && offClassified(s) < 1e-6, 'a typed orbifold of four cone points opens on the Classification page\'s tile, lying as it lies there', JSON.stringify([s.classified.at, s.classified.exact, offClassified(s)]));
    ok(s.pat && s.pat.tiles > 3, 'the pattern is drawn', JSON.stringify(s.pat && s.pat.tiles));
    await shot(page, 'w03-2379');

    // a pair picked, sliders moved, then a digit changed in the field: the new orbifold opens at its own numbers
    await T.evaluate(() => window.__handles.set({ L: 1.4, tw: -0.2 }));
    await T.evaluate(() => window.__handles.tapCone(2));
    await T.evaluate(() => window.__handles.tapCone(1));
    await T.evaluate(() => window.__handles.waitGlide());
    s = await S(T);
    ok(s.m.slice(0, 2).split('').sort().join('') === '12', 'a pair picked on a typed orbifold', s.m);
    await T.click('#custom-in');
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(150);
    ok((await S(T)).k === '237' && (await ui(T)).note === '', 'one character deleted: what is left is an orbifold too, and is shown');
    await page.keyboard.type('5');
    await page.waitForTimeout(300);
    s = await S(T);
    ok(s.k === '2375' && s.classified.at && offClassified(s) < 1e-6, 'a digit changed: the new orbifold opens at its own default numbers, as classified', `${s.k} ${s.m} ${s.L} ${s.tw} ${offClassified(s)}`);

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

    // what cannot be shown says why, and offers what can: the four shapes no pattern folds up to (one cone point
    // alone, two of different orders, and the same with a mirror's corners), and what is no signature. The page
    // keeps the last orbifold it could show: what was there before, or what the text was on its way (a mirror
    // alone, while ∗5 is typed)
    for (const [text, stays, re, tries] of [['5', 'o27', /one cone point cannot stand alone/, '55,5*,5x'], ['23', 'o27', /two cone points alone must be of one order/, '22,33,322'], ['*5', '*', /a mirror cannot have one corner alone/, '5*,*55'], ['*23', '*', /a mirror's two corners alone must be of one order/, '2*3,3*2,32*,*22'], ['2y4', 'o27', /Not a signature/, ''], ['1', 'o27', /Not a signature/, '']]) {
      await typeIn('o27');
      await typeIn(text);
      u = await ui(T); s = await S(T);
      ok(s.k === stays && !u.on && re.test(u.note) && u.tries.join() === tries, `"${text}": ${stays} stays, the note says why`, JSON.stringify([s.k, u.note, u.tries]));
      ok(u.noteBox.left >= 0 && u.noteBox.right <= u.vw && !u.overflowX, `"${text}": the note is inside the page`, JSON.stringify(u.noteBox));
    }
    await shot(page, 'w05-why');
    await page.keyboard.press('Enter');
    ok((await S(T)).k === 'o27' && (await ui(T)).value === '1', 'Enter on what cannot be shown changes nothing');
    await typeIn('23');
    await T.click('#custom-pop .trylink[data-k="322"]');
    await page.waitForTimeout(300);
    u = await ui(T); s = await S(T);
    ok(s.k === '322' && u.on && u.value === '322' && u.focused && u.note === '', 'a tap on an offer takes it; the field keeps the keyboard', JSON.stringify([s.k, u.value, u.focused]));
    // what used to be turned away is shown now, each with its pair controls off
    for (const [text, k, re] of [['234*56', '234*56', /5 numbers of shape/], ['22*x', '22*x', /4 numbers of shape/], ['oo', 'oo', /6 numbers of shape/], ['*632', '*632', /rigid/], ['2222222', '2222222', /8 numbers of shape/], ['*2222', '*2222', /1 number of shape/], ['532', '532', /rigid/]]) {
      await typeIn(text);
      u = await ui(T); s = await S(T);
      ok(s.k === k && s.mode === 'still' && u.on && u.note === '' && u.slidersOff && re.test(u.stillNote) && u.plus === null && !/\+/.test(u.grayed) && s.pat.tiles >= 1 && !u.overflowX, `"${text}" is shown as classified, its pair controls off`, JSON.stringify([s.k, s.mode, u.on, u.slidersOff, u.stillNote, u.grayed, s.pat.tiles]));
    }
    await shot(page, 'w05-still');
    await typeIn('322');

    // the field beside the chips: a chip takes over, the field keeps its text in gray, a tap on it brings it back
    await T.click('[data-fam="333*3"]');
    await page.waitForTimeout(250);
    u = await ui(T); s = await S(T);
    ok(s.k === '333*3' && !u.on && u.value === '322' && u.pressed.join() === '333*3' && u.color === u.muted && u.note === '' && !u.slidersOff && u.stillNote === '', 'a chip of the page takes over; the field keeps its text, gray and unlit; the pair controls are on again', JSON.stringify([s.k, u.on, u.value, u.color, u.muted, u.slidersOff]));
    await shot(page, 'w06-chip');
    await T.click('#custom-in');
    await page.waitForTimeout(250);
    s = await S(T); u = await ui(T);
    ok(s.k === '322' && u.on && u.pressed.length === 0, 'a tap on the field brings its orbifold back, as a chip would', JSON.stringify([s.k, u.on]));
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

  // ---------------------------------------------------------------- more than two pairs: five or six cone points, and the plus
  // His ask: "user interface to allow modifying more orbifolds, more than just 2 pairs ones like 2222. Perhaps a
  // plus button I can click to select another pair for modification."
  {
    const { ctx, page, T, off, typeIn } = await newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
    for (const [text, chips0, pairs] of [['223344', '2! 2! 3 3 4 4', 3], ['22233', '2! 2! 2 3 3', 2]]) {
      await typeIn(text);
      await page.waitForTimeout(500);
      let s = await S(T), u = await ui(T);
      const d = engine.FAMILIES[engine.normalizeFamilyKey(text)].defaults;
      ok(s.k === text && s.mode === 'multi' && u.on && u.note === '' && u.pair === chips0 && !u.slidersOff && u.stillNote === '', `${text}: shown, its first pair picked, the sliders on`, JSON.stringify([s.k, s.mode, u.pair, u.slidersOff]));
      ok(u.grayed === (pairs === 3 ? '++----' : '++---') && u.plus && s.multi.pairs === pairs && s.multi.shown === 1 && s.multi.active === 0, `${text}: the other pairs wait, grayed, behind a plus`, JSON.stringify([u.grayed, u.plus, s.multi.shown]));
      ok(s.multi.atDefaults && s.multi.Ls.every((L, i) => near(L, d.L[i])) && s.multi.tws.every((t) => t === 0) && offClassified(s) < 1e-6, `${text}: opens on the Classification page's pattern, lying as it lies there`, JSON.stringify([s.multi.atDefaults, s.multi.Ls, offClassified(s)]));
      ok(s.pat.shapes === s.multi.commas && s.multi.joints.every((j) => j.clear) && s.pat.tiles > 3, `${text}: that page's commas, and a joint for every cut that runs through none`, JSON.stringify([s.pat.shapes, s.multi.commas, s.multi.joints]));
      ok(new RegExp(`^#k=${text}&p=1&n=1&l=[\\d.,]+&tw=[\\d.,-]+$`).test(s.hash) && s.loc === s.hash, `${text}: its address carries every pair's Length and Twist`, s.hash);
      await shot(page, 'm-' + text + '-a');
      const opened = s;

      // the plus: the next pair is picked; nothing moves on the pattern; the sliders show that pair's numbers
      await T.click('#pair-add');
      await page.waitForTimeout(400);
      s = await S(T); u = await ui(T);
      ok(s.multi.active === 1 && s.multi.shown === 2 && near(s.L, d.L[1]) && s.tw === 0 && Math.max(...movedPx(opened, s)) < 0.5, `${text}: the plus picks the second pair; the pattern stays where it was`, JSON.stringify([s.multi.active, s.L, movedPx(opened, s)]));
      ok(u.pair.split(' ').map((x, i) => (x.endsWith('!') ? i : -1)).filter((i) => i >= 0).join() === '2,3' && (u.plus === null) === (pairs === 2), `${text}: its two symbols are the pressed ones${pairs === 2 ? ', and with no pair left the plus goes' : ''}`, JSON.stringify([u.pair, u.plus]));
      ok(/Pair 2 of/.test(u.surfSub), `${text}: the surface says which pair`, u.surfSub);
      // its Twist, by the slider: its own two cone points stay, the rest of the pattern slides by
      const b4 = s;
      await slide(T, 'tw-range', 0.83);
      await page.waitForTimeout(500);
      s = await S(T);
      let mv = movedPx(b4, s);
      ok(near(s.multi.tws[1], s.tw) && Math.abs(s.tw - 0.33) < 0.01 && s.multi.tws[0] === 0 && mv[2] < 0.5 && mv[3] < 0.5 && mv[0] > 5 && mv[1] > 5, `${text}: the Twist slider moves the picked pair's Twist alone; its two cone points stay on the screen, the first pair's slide by`, JSON.stringify([s.multi.tws, mv]));
      ok(s.pat.shapes === s.multi.commas && s.pat.tiles > 3 && !s.multi.atDefaults, `${text}: every comma still drawn`, JSON.stringify([s.pat.shapes, s.pat.tiles]));
      // its Length: the pair's middle stays
      const b5 = s;
      await slide(T, 'len-range', 0.12);
      await page.waitForTimeout(500);
      s = await S(T); u = await ui(T);
      ok(near(s.multi.Ls[1], s.L) && s.L < d.L[1] - 0.5 && near(s.multi.Ls[0], d.L[0]) && Math.hypot(s.mid.x - b5.mid.x, s.mid.y - b5.mid.y) < 0.5 && s.pat.tiles > 3, `${text}: the Length slider moves the picked pair's Length alone; the pair's middle stays on the screen`, JSON.stringify([s.multi.Ls, s.mid, b5.mid]));
      ok(Number.isFinite(s.d) && Number.isFinite(s.mDist) && u.lenShown === s.L.toFixed(2), `${text}: the readout follows`, JSON.stringify([s.d, s.mDist, u.lenShown]));
      await shot(page, 'm-' + text + '-b');
      // the first pair again, by its symbol: nothing moves, the sliders go back to its numbers
      const b6 = s;
      await T.click('.sig-btn[data-cone="0"]');
      await page.waitForTimeout(400);
      s = await S(T);
      ok(s.multi.active === 0 && near(s.L, d.L[0]) && s.tw === 0 && s.multi.shown === 2 && Math.max(...movedPx(b6, s)) < 0.5, `${text}: a tap on a symbol of the first pair picks it; nothing moves, the sliders show its numbers`, JSON.stringify([s.multi.active, s.L, s.tw, movedPx(b6, s)]));
      // a tap on a feature of the surface picks its pair
      s = await T.evaluate(() => window.__handles.tapCone(3)).then(() => S(T));
      ok(s.multi.active === 1, `${text}: a tap on a feature picks its pair`, String(s.multi.active));
      if (pairs === 3) {
        await T.click('#pair-add');
        await page.waitForTimeout(400);
        s = await S(T); u = await ui(T);
        ok(s.multi.active === 2 && s.multi.shown === 3 && u.plus === null && u.grayed === '++++++', `${text}: the plus again picks the third pair, and goes`, JSON.stringify([s.multi.active, s.multi.shown, u.plus, u.grayed]));
      } else {
        s = await T.evaluate(() => window.__handles.tapCone(4)).then(() => S(T));
        ok(s.multi.active === 1 && (await ui(T)).grayed === '++++-', `${text}: the cone point left over has no pair: a tap on it changes nothing, and its symbol stays gray`, JSON.stringify([s.multi.active, (await ui(T)).grayed]));
      }
      // Reset: the picked pair level in the middle
      await T.click('#reset2');
      await page.waitForTimeout(400);
      s = await S(T);
      const a = s.multi.active, size = await T.evaluate(() => { const c = document.getElementById('pattern'); return [c.clientWidth, c.clientHeight]; });
      ok(Math.abs(s.cones[2 * a].y - size[1] / 2) < 0.6 && Math.abs(s.cones[2 * a + 1].y - size[1] / 2) < 0.6 && Math.abs(s.mid.x - size[0] / 2) < 0.6 && s.cones[2 * a].x < s.cones[2 * a + 1].x, `${text}: Reset lays the picked pair level in the middle`, JSON.stringify([s.cones[2 * a], s.cones[2 * a + 1], size]));
      // the link to this state opens it
      {
        const linked = await newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 }, s.hash);
        const sl = await S(linked.T), ul = await ui(linked.T);
        ok(sl.k === text && sl.hash === s.hash && sl.multi.active === s.multi.active && sl.multi.shown === s.multi.shown && sl.multi.Ls.every((L, i) => Math.abs(L - s.multi.Ls[i]) < 1e-3) && sl.multi.tws.every((t, i) => Math.abs(t - s.multi.tws[i]) < 1e-4) && ul.on, `${text}: the link to that state (${s.hash}) opens it`, JSON.stringify([sl.hash, sl.multi]));
        await linked.ctx.close();
      }
      // a link copied at the defaults carries rounded numbers: it opens on the defaults themselves
      {
        const linked = await newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 }, opened.hash);
        const sl = await S(linked.T);
        ok(sl.multi.atDefaults && offClassified(sl) < 1e-6 && sl.hash === opened.hash, `${text}: a link copied at its defaults (${opened.hash}) opens as classified`, JSON.stringify([sl.multi.atDefaults, offClassified(sl), sl.hash]));
        await linked.ctx.close();
      }
      // every pair's sliders at both ends, and the pattern dragged: it stays drawn
      const ends = await T.evaluate(async (n) => {
        const out = [];
        for (let pair = 0; pair < n; pair++) {
          window.__handles.pair(pair);
          for (const id of ['len-range', 'tw-range']) {
            const inp = document.getElementById(id);
            for (const v of ['0', '1', '0.5']) {
              inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise((r) => setTimeout(r, 70));
              const st = window.__handles.state();
              out.push([pair, id, v, st.pattern.tiles, Number.isFinite(st.d) && Number.isFinite(st.mDist), st.pattern.shapes === st.multi.commas]);
            }
          }
        }
        return out;
      }, pairs);
      const bad = ends.filter(([, , , tiles, fin, all]) => !(tiles > 3) || !fin || !all);
      ok(ends.length === pairs * 6 && bad.length === 0, `${text}: every pair's sliders at both ends`, JSON.stringify(bad));
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
      ok(worst > 3, `${text}: dragged six times, the pattern stays drawn`, 'fewest tiles ' + worst);
      await T.click('#reset2');
    }
    // the shortest cut beside the longest: the far corner of the sliders (found by sweep: the pattern pane once listed a tile eight times here)
    await T.evaluate(() => window.__handles.set({ k: '777777', Ls: [1.46, 4.52, 1.05], tws: [0.2, -0.3, 0.4], active: 2, shown: 3 }));
    await page.waitForTimeout(600);
    let s = await S(T);
    ok(s.k === '777777' && s.pat.tiles > 3 && s.pat.tiles < 3000 && s.pat.shapes === s.multi.commas, '777777 with cuts of 1.05 and 4.52: drawn, each tile once', JSON.stringify([s.pat.tiles, s.pat.shapes]));
    await shot(page, 'm-777777-far');
    // a chip of the page after five or six cone points: back to four buttons, no plus
    await T.click('[data-fam="3333"]');
    await page.waitForTimeout(300);
    const u = await ui(T);
    ok(u.pair === '3! 3! 3 3' && u.plus === null && u.grayed === '++++' && !u.slidersOff, 'a chip of the page after that: four symbols, no plus', JSON.stringify([u.pair, u.plus, u.grayed]));
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
    const { ctx, page, T } = await newPage({ viewport: { width: 1280, height: 900 } }, '#k=23');
    const s = await S(T), u = await ui(T);
    ok(s.k === '3333' && u.value === '23' && !u.on && /two cone points alone must be of one order/.test(u.note) && u.tries.join() === '22,33,322', 'a link to a signature no pattern has: it is in the field, with the reason', JSON.stringify({ k: s.k, value: u.value, note: u.note }));
    await shot(page, 'l02-23');
    await T.click('h1');
    await page.waitForTimeout(150);
    ok((await ui(T)).value === '23', 'the field keeps it');
    await ctx.close();
  }
  {
    const { ctx, page, T } = await newPage({ viewport: { width: 1280, height: 900 } }, '#k=237');
    const s = await S(T), u = await ui(T);
    ok(s.k === '237' && s.mode === 'still' && u.on && u.value === '237' && u.note === '' && u.slidersOff && s.hash === '#k=237', 'a link to an orbifold shown still opens it, the field lit, the pair controls off', JSON.stringify({ k: s.k, value: u.value, off: u.slidersOff, hash: s.hash }));
    await shot(page, 'l03-237');
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
    for (const t of ['5', '29', '*7', 'nonsense text here', '2y4', '*29']) {
      await T.evaluate((x) => window.__handles.custom.type(x), t);
      await page.waitForTimeout(200);
      u = await ui(T);
      ok(u.note !== '' && u.noteBox.left >= 0 && u.noteBox.right <= u.vw && !u.overflowX, `"${t}" on a phone: its note is inside the screen`, JSON.stringify([u.note.slice(0, 40), u.noteBox, u.vw]));
    }
    await shot(page, 'p01-phone-dark-note');
    const small = await T.evaluate(() => [...document.querySelectorAll('#custom-pop .trylink')].map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.k, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => h < 32 || w < 44));
    ok(small.length === 0, 'the offers are wide enough for a finger', JSON.stringify(small));
    for (const t of ['2379', '957*', '222*2', '999x', 'o99', '22233', '223344', '237', '2222222', 'oo', '99*99']) {
      await T.evaluate((x) => window.__handles.custom.type(x), t);
      await page.waitForTimeout(350);
      u = await ui(T);
      ok((await S(T)).k === t && u.on && !u.overflowX && u.pairRow[0] >= 0 && u.pairRow[1] <= u.vw, `${t} on a phone: shown, nothing wider than the screen`, JSON.stringify([u.on, u.overflowX, u.pairRow, u.vw]));
    }
    // the plus, under a finger
    await T.evaluate((x) => window.__handles.custom.type(x), '223344');
    await page.waitForTimeout(350);
    u = await ui(T);
    ok(u.plus && u.plus[0] >= 40 && u.plus[1] >= 40, 'the plus is wide enough for a finger', JSON.stringify(u.plus));
    await T.tap('#pair-add');
    await page.waitForTimeout(350);
    ok((await S(T)).multi.active === 1 && !(await ui(T)).overflowX, 'a tap on the plus picks the second pair');
    await shot(page, 'p03-phone-dark-pairs', { fullPage: true });
    await shot(page, 'p02-phone-dark', { fullPage: true });
    await ctx.close();
  }
} finally {
  await B.close();
}
console.log(`${failed ? 'FAILED ' + failed : 'all ok'}; page errors ${errors}`);
process.exit(failed || errors ? 1 : 0);
