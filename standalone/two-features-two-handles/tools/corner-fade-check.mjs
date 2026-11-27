// corner-fade-check.mjs — a mirror with a corner in a real Chrome: the tree does not jump at Corner shift 0, it
// fades from one wall of the corner to the other (src/handles.js cornerFade). His orbifold and numbers: 234∗2 at
// Length 3.221, Twist 0.0614, Mirror len 2.512 ("If I modify the corner shift here, the tree, the 'follow the tree
// line,' jumps rapidly"; then: "make it a cross-fade").
//
//   node tools/corner-fade-check.mjs [--root <this folder>] [--live <url>] [--shots <dir>]
// --live takes the page's address on spacesheep; there the page runs in the viewer's frame. Needs The Folding's
// browser door and its PLAYWRIGHT_MJS / FOLDING_BROWSER settings, as tools/custom-check.mjs does.
//
// How dark each of the two arcs is drawn is read off the pattern's canvas: the pixel under a point a third of the
// way along the arc, against the same pixel in a state whose tree runs elsewhere. The points come from the same
// engine in node. Prints one line a check (ok / FAIL); exits 1 if any failed or the page logged an error.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
const root = path.resolve(opt.root || path.join(path.dirname(new URL(import.meta.url).pathname), '..'));
const shots = opt.shots ? path.resolve(opt.shots) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const { openBrowser } = await import(new URL('../../the-folding/tools/browser.mjs', import.meta.url));
const H = await import(path.join(root, 'src/handles.js'));
const G = H.GH;
const k = H.normalizeFamilyKey('234*2'), L = 3.221, tw = 0.0614, b = 2.512;
const thetas = H.defaultCommas(k).map((s) => (s ? s.theta : 0));
const at = (tc, perm) => H.coneFeatCentered(k, L, tw, b, tc, { perm, thetas });
const B = await openBrowser({ root });
const base = opt.live || B.url('site/index.html');
let failed = 0, errors = 0;
const ok = (c, what, extra = '') => { if (!c) failed++; console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${c ? '' : '  ' + extra}`); };
try {
  // A browser session of its own for every page, as tools/custom-check.mjs has: in the spacesheep viewer a second
  // tab of one session opens on the page's plain address, the state in its link dropped.
  const open = async (tc, m = '0123') => {
    const ctx = await B.browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const mine = (url) => !opt.live || /spacesheep\.app/.test(url || '');
    page.on('console', (msg) => { if (msg.type() === 'error' && mine(msg.location().url)) { errors++; console.log('CONSOLE ERROR', msg.text().slice(0, 200)); } });
    page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message.slice(0, 200)); });
    await page.goto(`${base}#k=234%2A2&m=${m}&l=${L}&tw=${tw}&b=${b}&tc=${tc}`, { waitUntil: 'load' });
    let T = page;
    if (opt.live) { for (let i = 0; i < 150 && T === page; i++) { const f = page.frames().find((fr) => /spacesheep\.app/.test(fr.url())); if (f) T = f; else await page.waitForTimeout(200); } }
    await T.waitForFunction(() => window.__handles && window.__handles.state().pattern);
    await page.waitForTimeout(900);
    return { page, T, close: () => ctx.close() };
  };
  const shot = async (page, T, name) => { if (!shots) return; const box = await (await T.$('#pattern')).boundingBox(); const fr = opt.live ? await (await T.frameElement()).boundingBox() : { x: 0, y: 0 }; await page.screenshot({ path: path.join(shots, name + '.png'), clip: { x: fr.x + box.x, y: fr.y + box.y, width: box.width, height: box.height } }); };
  /** How dark the canvas is at a point of the pattern (the darkest of the pixels round it): 0 black .. 255 white. */
  const dark = (T, p) => T.evaluate((pt) => {
    const pat = window.__handles.pattern, xy = pat.projectTile(pt);
    let d;
    if (typeof pat.readPatch === 'function') d = pat.readPatch(xy[0], xy[1], 3);
    else {
      const c = document.getElementById('pattern'), s = c.width / c.clientWidth;
      d = c.getContext('2d').getImageData(Math.round(xy[0] * s) - 3, Math.round(xy[1] * s) - 3, 7, 7).data;
    }
    let best = 255;
    for (let i = 0; i < d.length; i += 4) best = Math.min(best, 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    return best;
  }, p);
  const ink = 0.09 * 255;

  // ---- the mirror picked with the cone point 2 (his link), then the mirror in the far pair (the pair 3, 4 picked)
  for (const [m, perm, full, what] of [['0123', [0, 1, 2, 3], 0.9, 'the picked pair\'s tree'], ['2301', [2, 3, 0, 1], 0.5, 'the far pair\'s tree']]) {
    // the ground under the two arcs, read where no tree runs: at Corner shift 0.25 the tree lies 6 degrees to one
    // side of the line to the corner, at -0.25 as far to the other; the one further from the arcs looked at is taken
    const refs = { plus: await open(0.25, m), minus: await open(-0.25, m) };
    const rows = [];
    for (const tc of [-0.2, -0.03, -0.0008, 0, 0.002, 0.03, 0.2]) {
      const c = at(tc, perm), f = H.cornerFade(tc), far = c.treeFade.far;
      const main = far ? [c.home[2], c.home[3]] : [c.home[0], c.home[1]];
      const pm = G.mix(main[0], main[1], 0.35), pa = G.mix(c.treeFade.seg[0], c.treeFade.seg[1], 0.35);
      const { page, T, close } = await open(tc, m);
      const s = await T.evaluate(() => { const st = window.__handles.state(); return { tau: st.tau, m: st.m, tiles: st.pattern.tiles }; });
      const ref = tc > 0 ? refs.minus : refs.plus;
      const [gm, ga, dm, da] = [await dark(ref.T, pm), await dark(ref.T, pa), await dark(T, pm), await dark(T, pa)];
      const am = (gm - dm) / (gm - ink), aa = (ga - da) / (ga - ink);
      rows.push({ tc, am, aa });
      ok(s.m === m && Math.abs(s.tau - tc) < 1e-9 && s.tiles > 3 && Math.abs(am - full * f.main) < 0.12 && Math.abs(aa - full * f.alt) < 0.12, `${what} at Corner shift ${tc}: the shortest arc drawn at ${am.toFixed(2)} (meant ${(full * f.main).toFixed(2)}), the second at ${aa.toFixed(2)} (meant ${(full * f.alt).toFixed(2)})`, JSON.stringify([s, am, aa]));
      await shot(page, T, `${m}-tc_${String(tc).replace('-', 'm')}`);
      await close();
    }
    const near = rows.filter((r) => Math.abs(r.tc) < 0.005);
    ok(near.length === 3 && near.every((r) => Math.abs(r.am - r.aa) < 0.1 && r.am > 0.3 * full), `${what}: within 0.005 of Corner shift 0 the two arcs are equally dark, so there is nothing to jump`, JSON.stringify(near));
    await refs.plus.close(); await refs.minus.close();
  }

  // ---- the slider itself, and Follow the tree
  {
    const { page, T, close } = await open(-0.0008);
    const before = await T.evaluate(() => window.__handles.state().tau);
    // one step of the slider across 0, as he did it
    await T.evaluate(() => { const r = document.getElementById('tau-range'); r.value = String(0.5 + 0.002); r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(500);
    const after = await T.evaluate(() => window.__handles.state().tau);
    const c = at(after, [0, 1, 2, 3]), pm = G.mix(c.home[0], c.home[1], 0.35), pa = G.mix(c.treeFade.seg[0], c.treeFade.seg[1], 0.35);
    const ref = await open(-0.25);
    const [gm, ga, dm, da] = [await dark(ref.T, pm), await dark(ref.T, pa), await dark(T, pm), await dark(T, pa)];
    const am = (gm - dm) / (gm - ink), aa = (ga - da) / (ga - ink);
    ok(before < 0 && after > 0 && Math.abs(am - aa) < 0.1 && am > 0.3, `the Corner shift slider moved from ${before} to ${after.toFixed(4)}: both arcs still there, equally dark (${am.toFixed(2)}, ${aa.toFixed(2)})`, JSON.stringify([before, after, am, aa]));
    await ref.close();
    await T.evaluate(() => window.__handles.moment('follow'));
    await page.waitForTimeout(2600);
    const s = await T.evaluate(() => { const st = window.__handles.state(); return { moment: st.moment, tiles: st.pattern.tiles }; });
    ok(s.moment === 'follow' && s.tiles > 3, 'Follow the tree runs there, the pattern drawn', JSON.stringify(s));
    await shot(page, T, 'follow-near-0');
    await close();
  }
} finally { await B.close(); }
console.log(`${failed ? 'FAILED ' + failed : 'all ok'}; page errors ${errors}`);
process.exit(failed || errors ? 1 : 0);
