// dev/patterns/app-sheet.mjs — a pattern DESIGN in the real app: one picture of all 17 groups, the stage of each (the plane on
// the left, the fold on the right) at one t. The designers' window into the app (dev/patterns/app.html), modelled on
// dev/recut/sheet.mjs. Chrome of the pool on the mini (tools/browser.mjs); a run takes about 15 s.
//
//   FOLDING_BROWSER=mini node dev/patterns/app-sheet.mjs --design designs/<key>/design.js --t 0.6 --out <png>
//        [--ids xx,22x,'*632']    which groups (default: all 17, the page's order)
//        [--w 760 --h 470]        the window of one shot, css px          [--phone]  = a 390 x 780 window: the panes stack
//        [--cols 3] [--scale 0.5] the sheet: columns, and how large a shot is shown (1 = pixel for pixel)
//        [--dpr 1]                device pixels per css px (2: a retina screen; the shots are then twice as large)
//        [--preset 1]             that cut of each group (clamped to the cuts it has): --ids xx --preset 1 --t 0.25
//                                 shows a re-cut under way
//        [--seed 0.3/0.2]         a cut dragged to that seed (straight coordinates), after --preset
//        [--wavy 0.5]             the Wavy slider
//        [--tile 0.5]             the Tile step at u (0 = the tile alone, 1 = tiled): the cards carry the print
//        [--view az/el/zoom]      the 3D view (degrees; el < 0 looks at the BACK of the flat sheet; zoom 1 = fitted)
//        [--pat <key>]            another pattern than the design: one of the page's own six (paisley, soft, tomoe, checker,
//                                 rings, comma: src/pattern.js PATTERNS) or one of --designs
//        [--designs a,b,c]        register dev/patterns/designs/<a>/design.js … as well (with --pat, without --design)
//        [--clip stage|fold|plane]  shoot that part of the page only (default: the whole window)
//        [--json <file>]          what was seen, per group
//   --design is a path relative to dev/patterns/ (any module that exports meta and find). It is registered under its own
//   meta.key and under 'dev'; the sheet shows 'dev'. A design that ships with the page since 14 Nov 2026 (Paisley, Soft
//   commas, Tomoe: their keys are built in) is registered under 'dev' alone: --design designs/paisley/design.js shows the
//   design folder's copy, --pat paisley the page's own.
//
// It prints the errors of the page (console errors and warnings, page errors) and getState().errors, the rules a motif
// breaks (RULES: src/shapes.js validateShapes, with the designs' gap GAP_MIN), the parts of the motif thinner than the 3D
// texture holds (THIN: src/shapes.js thinParts, 1.5 texels; a needle's tip is cut short in 3D), and FAILS (exit code 1)
// when the pattern did not take — getState().pattern is not the key, or there is no print: find threw, or the motif
// breaks a rule that would draw it wrong (src/shapes.js printable; the CONSOLE WARN line says which); the page shows
// the comma then — or when the page had errors.
// One browser at a time per agent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith('--')) continue;
  const k = args[i].slice(2);
  if (k === 'phone') { opt.phone = true; continue; }
  opt[k] = args[++i];
}
// the kinds of print each of the page's own patterns shows (the rings: stripes in a group without rotations); a
// registered design: a shape print
const KINDS = { checker: ['linear'], rings: ['rings', 'linear'] };
if ((!opt.design && !opt.pat) || !opt.out) {
  console.error('usage: FOLDING_BROWSER=mini node dev/patterns/app-sheet.mjs --design designs/<key>/design.js --t 0.6 --out <png>\n' +
    '       [--ids a,b] [--w 760 --h 470] [--phone] [--cols 3] [--scale 0.5] [--dpr 1] [--preset n] [--seed x/y] [--wavy a] [--tile u]\n' +
    '       [--view az/el/zoom] [--pat key] [--designs a,b] [--clip stage|fold|plane] [--json file]');
  process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const W = opt.phone ? 390 : +opt.w || 760, H = opt.phone ? 780 : +opt.h || 470, dpr = +opt.dpr || 1;
const cols = +opt.cols || (opt.phone ? 6 : 3), scale = +opt.scale || 0.5, t = opt.t === undefined ? 0.6 : +opt.t;
const key = opt.pat || 'dev', kinds = KINDS[key] || ['shapes'];
const view = opt.view ? opt.view.split('/').map(Number) : null, seed = opt.seed ? opt.seed.split('/').map(Number) : null;
const qs = new URLSearchParams();
if (opt.design) qs.set('design', opt.design);
if (opt.designs) qs.set('designs', opt.designs);

const B = await openBrowser({ root });
let code = 0;
try {
  const page = await (await B.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr })).newPage();
  const said = [];
  const say = (line) => { if (!said.includes(line)) { said.push(line); console.log(line); } };
  let errors = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') { errors++; say('CONSOLE ERROR ' + m.text()); } else if (m.type() === 'warning') say('CONSOLE WARN ' + m.text());
  });
  page.on('pageerror', (e) => { errors++; say('PAGE ERROR ' + e.message); });
  await page.goto(B.url('dev/patterns/app.html?' + qs.toString()), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__designs && window.__designs.ready && window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  const D = await page.evaluate(async () => ({ registered: window.__designs.registered, builtIn: window.__designs.builtIn || [], errors: window.__designs.errors,
    own: (await import('../../src/pattern.js')).PATTERNS.map((p) => ({ key: p.key, label: p.label, hint: p.hint })) }));
  for (const e of D.errors) { say('DESIGN ERROR ' + e); code = 1; }
  for (const b of D.builtIn) say(`(${b.path}: its key '${b.key}' is built in; ${b.path === opt.design ? "shown as 'dev'" : 'the page\'s own is shown'})`);
  const meta = D.registered.find((r) => r.key === key) || D.own.find((r) => r.key === key) || null;
  if (!meta) { console.log(`FAILED: the page has no pattern '${key}' (its own: ${D.own.map((r) => r.key).join(', ')}; registered: ${D.registered.map((r) => r.key).join(', ') || 'none'})`); code = 1; }
  const ids = opt.ids ? opt.ids.split(',') : ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
  const shots = [], rows = [];
  let thinSaid = false;
  for (const id of (code && !meta ? [] : ids)) {
    const st = await page.evaluate(async ([g, pat, tt, preset, sd, wavy, tile, vw]) => {
      const F = window.__folding;
      F.setGroup(g);
      if (F.getState().groupId !== g) return { missing: true };
      if (preset) F.setPreset(+preset);
      if (sd) F.setSeed(sd[0], sd[1]);
      if (wavy) F.setAmp(+wavy);
      F.setPattern(pat);
      if (vw) F.setView(vw[0], vw[1], vw[2] > 0 ? vw[2] : 1);
      if (tile !== null) F.setTile(+tile);
      F.setT(tt);
      const s = F.getState(), sc = F.scene(), pr = sc && sc.print;
      const out = { pattern: s.pattern, print: s.print, kind: s.printKind || null, errors: s.errors, preset: s.preset, recut: s.recut ? s.recut.movers : 0, caption: s.foldCaption,
        uploads: F.renderer.stats ? F.renderer.stats.printUploads : null, list: F.errors.slice(-3) };
      if (pr && pr.kind === 'shapes') {
        const { validateShapes, thinParts, bakeShapes } = await import('../../src/shapes.js');
        const v = validateShapes(pr);
        out.verts = pr.verts; out.problems = v.problems; out.gap = v.gap; out.stabilizer = v.stabilizer;
        // the parts thinner than 1.5 texels of the 3D texture (the texture of the print: baked already, the same object)
        const pitch = bakeShapes(pr).pitch, thin = thinParts(pr, 1.5 * pitch);
        out.thin = thin.slice(0, 3).map((r) => ({ texels: +(r.length / pitch).toFixed(1), width: +(r.width / pitch).toFixed(2), at: r.at.map((q) => +q.toFixed(4)), dark: r.dark }));
        out.texel = pitch / pr.size;
      }
      return out;
    }, [id, key, t, opt.preset || 0, seed, opt.wavy || 0, opt.tile === undefined ? null : opt.tile, view]);
    if (st.missing) { console.log(`FAILED ${id}: no such group`); code = 1; continue; }
    await page.waitForTimeout(view ? 420 : 280);                          // (a zoom on its way home after the group change; the frame's own draw)
    const took = st.pattern === key && kinds.includes(st.kind);
    if (!took) { console.log(`FAILED ${id}: the pattern did not take — pattern '${st.pattern}', print ${st.print === null ? 'null (the comma on the sheet is shown)' : st.print + ' (' + st.kind + ')'}`); code = 1; }
    if (st.errors) { console.log(`ERRORS ${id}: getState().errors = ${st.errors}: ${st.list.join(' || ')}`); code = 1; }
    if (st.problems && st.problems.length) console.log(`RULES ${id}: ${st.problems.join(' | ')}`);
    if (st.thin && st.thin.length && st.thin[0].texels > 6) {
      const r = st.thin[0];
      console.log(`THIN ${id}: ${r.dark ? 'dark' : 'light'}, under 1.5 texels along ${r.texels} texels of outline near (${r.at.join(', ')}); a texel is ${st.texel.toFixed(4)} tile sizes` + (st.thin.length > 1 ? ` (${st.thin.length} such parts)` : ''));
      thinSaid = true;
    }
    let clip;
    if (opt.clip) {
      const sel = opt.clip === 'fold' ? '.pane-fold' : opt.clip === 'plane' ? '.pane-plane' : '#stage';
      const box = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, sel);
      if (box && box.width > 0 && box.height > 0) clip = box; else console.log(`(no ${sel} to clip to: the whole window)`);
    }
    const buf = await page.screenshot({ fullPage: false, ...(clip ? { clip } : {}) });
    shots.push({ id, b64: buf.toString('base64'), st, w: clip ? clip.width : W });
    rows.push({ id, ...st, took });
  }
  if (shots.length) {
    const fw = Math.round(Math.max(...shots.map((s) => s.w)) * scale);
    const sheet = await B.browser.newPage({ viewport: { width: cols * (fw + 8) + 24, height: 900 } });
    const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const what = [meta ? `${meta.label.replace(/^dev: /, '')} (${opt.design || key})` : key, `t = ${t}`, opt.preset ? `cut ${opt.preset}` : '', seed ? `seed ${seed.join('/')}` : '', opt.wavy ? `wavy ${opt.wavy}` : '',
      opt.tile !== undefined ? `tile ${opt.tile}` : '', view ? `view ${view.join('/')}` : '', opt.phone ? 'phone' : `${W} x ${H}`, dpr !== 1 ? `dpr ${dpr}` : ''].filter(Boolean).join(' · ');
    await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:10px;font:12px system-ui;background:#fff;color:#1a1a1f}h1{font-size:13px;font-weight:600;margin:0 0 8px}.g{display:grid;grid-template-columns:repeat(${cols},${fw}px);gap:8px}figure{margin:0;border:1px solid #ddd}img{display:block;width:100%}figcaption{padding:1px 5px;color:#555}.bad{color:#b45309;font-weight:600}</style><h1>${esc(what)}</h1><div class="g">${shots.map((s) => `<figure><img src="data:image/png;base64,${s.b64}"><figcaption>${esc(s.id)} · ${esc(s.st.print || 'comma')}${s.st.verts ? ' · ' + s.st.verts + ' pts' : ''}${s.st.recut ? ' · re-cut ' + s.st.recut : ''}${s.st.problems && s.st.problems.length ? ` <span class="bad">· breaks ${s.st.problems.length} rule${s.st.problems.length > 1 ? 's' : ''}</span>` : ''}${s.st.thin && s.st.thin.length && s.st.thin[0].texels > 6 ? ` · thin ${s.st.thin[0].texels} tx` : ''}${s.st.errors ? ` <span class="bad">· ERRORS ${s.st.errors}</span>` : ''}</figcaption></figure>`).join('')}</div>`);
    await sheet.waitForTimeout(250);
    const out = path.resolve(opt.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sheet.screenshot({ path: out, fullPage: true });
    if (opt.json) fs.writeFileSync(path.resolve(opt.json), JSON.stringify({ key, design: opt.design || null, t, rows }, null, 1));
    if (thinSaid) console.log('THIN: the 3D view (a distance texture of BAKE_SIZE texels a cell) cuts such a part short or breaks it up; the plane draws it whole. A tip rounded to a radius of 1.5 texels keeps.');
    console.log(`GROUPS ${rows.map((r) => r.id + (r.took ? '' : '!')).join(' ')}`);
    console.log('WROTE ' + out + ' (' + B.where + ')' + (errors ? ` — ${errors} errors on the page` : ''));
  }
  if (errors) code = 1;
} finally { await B.close(); }
if (code) console.log('app-sheet: FAILED (see above)');
process.exit(code);
