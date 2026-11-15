// dev/patterns/tex-demo.mjs — the proof of the renderer's texture print (src/render3d.js, mode 3) on a GPU: drives
// dev/patterns/tex-demo.html in a headless Chrome of the pool on the mini (tools/browser.mjs), reads the pixels back
// there, and writes the numbers (tex-demo.json; the table also as tex-demo.txt and on stdout) and the pictures (PNG).
//   FOLDING_BROWSER=mini node dev/patterns/tex-demo.mjs [--out <dir>] [--dpr 1,2] [--size 256] [--range 4] [--tag name]
//        [--zooms 0.125,0.25,0.5,1,2,4,8] [--only zoom,back,mesh,seam,baked,range,size,tiny,lose,pictures]
//   --out    default ~/drive.unsynced/artifacts/the-folding-patterns/renderer
//   --size   texels a side; --range: where the texture saturates, in texels (of the e1 direction)
//   zoom z = css px per texel in the middle of a face-on picture (device px per texel = z x dpr)
// The sections (what is measured, and how, is described at the top of tex-demo.html):
//   zoom      face-on, tilted (el 35) and grazing (el 12) at every zoom, against the analytic print
//   back      the same from behind: the back's colours
//   mesh      two triangles against a grid            seam   the picture from a texture whose cells begin half a cell on
//   baked     the texture of src/sdf.js (the round's baker) from the same shapes as polygons
//   range, size   sweeps over the texture itself (once, at the finest pixels): what the 8 bits and the texels buy;
//             sizes that are no power of two; a field made the easy, poor way (a control)
//   tiny      the sheet 160 .. 12 px across, turning: mean tone and flicker against the ideal and an unfiltered picture
//   lose      WEBGL_lose_context and back             pictures   PNGs to look at, and a contact sheet
// Exit code 1 when a bound of the brief is missed:
//   pixels more than 2 px from an outline agree with the analytic print: at least 99.5 %, front and back (all of them,
//   and 2000 drawn at random); an outline is a ramp at most 1.5 px wide at z = 0.5, 1, 2, 4, 8, dpr 1 and 2; nothing
//   happens along the borders of the lattice cells; small on the screen the mean is calm and nothing flickers more than
//   in the ideal picture; a lost context brings the print back; the same tex handed over again is not uploaded again.
// One browser at a time per agent. A full run takes about a minute, nearly all of it in the Chrome on the mini.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const outDir = path.resolve(opt.out || path.join(os.homedir(), 'drive.unsynced/artifacts/the-folding-patterns/renderer'));
const dprs = (opt.dpr || '1,2').split(',').map(Number);
const only = new Set((opt.only || 'zoom,back,mesh,seam,baked,range,size,tiny,lose,pictures').split(','));
const zooms = (opt.zooms || '0.125,0.25,0.5,1,2,4,8').split(',').map(Number);
const size = +opt.size || 256, range = +opt.range || 4, tag = opt.tag ? '-' + opt.tag : '';
const REQUIRED = new Set([0.5, 1, 2, 4, 8]);                 // the zooms the brief names
fs.mkdirSync(outDir, { recursive: true });

const VIEWS = [
  { name: 'face-on', az: 0, el: 90 },
  { name: 'tilted', az: 30, el: 35 },
  { name: 'grazing', az: 20, el: 12 },
];
const fails = [];
const need = (ok, what) => { if (!ok) fails.push(what); return ok ? 'ok' : 'MISSED'; };
const savePng = (file, dataUrl) => { fs.writeFileSync(path.join(outDir, file), Buffer.from(dataUrl.split(',')[1], 'base64')); return file; };
const pad = (s, n) => String(s).padEnd(n);
const lines = [];
const say = (s = '') => { console.log(s); lines.push(s); };

const B = await openBrowser({ root });
const all = { when: new Date().toISOString(), where: B.where, size, range, runs: {} };
let code = 0;
try {
  for (const dpr of dprs) {
    const ctx = await B.browser.newContext({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') say(`CONSOLE ${m.type().toUpperCase()} ${m.text()}`); });
    page.on('pageerror', (e) => { say('PAGE ERROR', e.message); code = 1; });
    await page.goto(B.url(`dev/patterns/tex-demo.html?size=${size}&range=${range}`), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__tex && window.__tex.ready, null, { timeout: 120000 });
    const head = await page.evaluate(() => ({ error: window.__tex.error, info: window.__tex.info, focus: window.__tex.focus }));
    if (head.error) { say('ERROR ' + head.error); code = 1; break; }
    const run = (all.runs['dpr' + dpr] = { info: head.info });
    const I = head.info;
    say(`\n== dpr ${dpr}: ${I.W} x ${I.H} device px · ${I.gpu} · texture ${I.size}^2, range ${I.rangeTexels} texels = ${I.range.toFixed(4)} · anisotropic x${I.anisoUsed} (GPU max ${I.anisotropic}) · MSAA ${I.samples} · ${I.mesh}`);
    say(`   the page's camera against R.project: ${I.unprojectError.toExponential(1)} world units; mean tone of the texture ${I.meanTone.toFixed(4)}`);
    const focusOf = (z) => (z >= 2 ? head.focus : [0, 0]);

    const stats0 = await page.evaluate(() => window.__tex.stats());
    if (only.has('zoom')) {
      run.zoom = [];
      say('\n   far: pixels more than 2 px from every outline, the share whose tone is the analytic one within 0.05 (and the largest miss); edge: the ramp across an outline, its width (1 = one pixel),');
      say('   where it sits (offset) and how far single pixels put the outline from where it is (rms, px); twin: tone - sdfTone(...) within 2 px of an outline, on the analytic field, on the');
      say('   texture read in JS (tex), and with the footprint NOT taken across the outline (iso: the control); seam: the pixels on the borders of the lattice cells, on plateaus and beside outlines');
      say('   (misses: the far pixels that are off, and how many texels the farthest of them is from a corner of the bar; tex-iso: the texture twin with the direction ignored)');
      say('   view      zoom  px/texel  footpr/range |  far px   agree%  worst  misses (texels)  (sample of 2000) |  width  offset   pos rms px |  twin rms  p99    max    tex     iso    tex-iso |  seam px  worst   band rms');
      for (const v of VIEWS) for (const z of zooms) {
        const m = await page.evaluate(([view]) => { window.__tex.place(view); return window.__tex.measure({ side: 'front' }); }, [{ az: v.az, el: v.el, z, focus: focusOf(z) }]);
        m.name = v.name; m.z = z;
        run.zoom.push(m);
        const req = REQUIRED.has(z);
        const okFar = m.far.pct >= 99.5 && m.sample.pct >= 99.5, okW = m.edge.width != null && m.edge.width <= 1.5;
        const okSeam = m.seam.plateauMax <= Math.max(0.02, m.far.worst) && m.seam.bandRms < Math.max(0.03, 2 * m.twin.rms);
        if (req && v.name !== 'grazing') { need(okFar, `dpr ${dpr} ${v.name} z ${z}: far agreement ${m.far.pct} % (sample ${m.sample.pct} %)`); need(okW, `dpr ${dpr} ${v.name} z ${z}: edge width ${m.edge.width} px`); need(okSeam, `dpr ${dpr} ${v.name} z ${z}: seam plateau ${m.seam.plateauMax}, band rms ${m.seam.bandRms} vs ${m.twin.rms}`); }
        say(`   ${pad(v.name, 9)} ${pad(z, 5)} ${pad(m.view.pxPerTexel, 9)} ${pad(m.view.footprintOverRange, 12)} | ${pad(m.far.n, 8)} ${pad(m.far.pct, 7)} ${pad(m.far.worst, 6)} ${pad(m.far.missN, 6)} ${pad('(' + m.far.missCornerTexels + ')', 9)} (${pad(m.sample.pct, 6)} of ${pad(m.sample.n, 4)})  | ${pad(m.edge.width, 6)} ${pad(m.edge.offsetPx, 8)} ${pad(m.edge.posRms, 10)} | ${pad(m.twin.rms, 8)} ${pad(m.twin.p99, 6)} ${pad(m.twin.max, 6)} ${pad(m.twin.rmsTex, 7)} ${pad(m.twin.rmsIso, 6)} ${pad(m.twin.rmsTexIso, 7)} | ${pad(m.seam.plateauN, 8)} ${pad(m.seam.plateauMax, 7)} ${pad(m.seam.bandRms, 7)}${req && v.name !== 'grazing' && !(okFar && okW && okSeam) ? '  <-- MISSED' : ''}`);
      }
    }
    if (only.has('back')) {
      run.back = [];
      say('\n   the BACK of the sheet (only the back\'s two colours are changed between the three pictures):');
      for (const v of [{ name: 'face-on', az: 0, el: -90 }, { name: 'tilted', az: 30, el: -35 }]) for (const z of [1, 4]) {
        const m = await page.evaluate(([view]) => { window.__tex.place(view); return window.__tex.measure({ side: 'back' }); }, [{ az: v.az, el: v.el, z, focus: focusOf(z) }]);
        m.name = v.name; m.z = z;
        run.back.push(m);
        const ok = m.far.pct >= 99.5 && m.sample.pct >= 99.5 && m.edge.width <= 1.5 && m.dim === 0;
        need(ok, `dpr ${dpr} back ${v.name} z ${z}: far ${m.far.pct} %, width ${m.edge.width}, pixels the back's colours do not reach ${m.dim}`);
        say(`   back ${pad(v.name, 8)} z ${pad(z, 3)} far ${m.far.n} px agree ${m.far.pct} % (sample ${m.sample.pct} % of ${m.sample.n}); edge width ${m.edge.width} px, offset ${m.edge.offsetPx} px; twin rms ${m.twin.rms}; pixels where the back's colours changed nothing: ${m.dim}  ${ok ? 'ok' : '<-- MISSED'}`);
      }
      // the front seen with only the back's colours changed must not change at all (and the other way round)
      const cross = await page.evaluate(() => { window.__tex.place({ az: 30, el: 35, z: 1 }); const m = window.__tex.measure({ side: 'back', sample: 10 }); return { valid: m.valid, dim: m.dim }; });
      run.backCross = cross;
      need(cross.valid === 0 && cross.dim > 1000, `dpr ${dpr}: the front of the sheet reacts to the back's colours (${cross.valid} pixels)`);
      say(`   control, the FRONT with only the back's colours changed: ${cross.valid} pixels react, ${cross.dim} do not  ${cross.valid === 0 ? 'ok' : '<-- MISSED'}`);
    }
    if (only.has('zoom') || only.has('back')) {
      // all of the above handed the print over again with every colour change: the same tex, in a new wrapper
      const s1 = await page.evaluate(() => window.__tex.stats());
      run.handover = { styleCalls: s1.styleCalls - stats0.styleCalls, uploads: s1.printUploads - stats0.printUploads, uploadsAtStart: stats0.printUploads };
      need(run.handover.uploads === 0 && stats0.printUploads === 1 && run.handover.styleCalls > 20, `dpr ${dpr}: ${run.handover.uploads} uploads for ${run.handover.styleCalls} setStyle calls with the same tex`);
      say(`\n   the same tex handed over ${run.handover.styleCalls} times so far (setStyle with the print and new colours): ${run.handover.uploads} uploads after the first  ${run.handover.uploads === 0 ? 'ok' : '<-- MISSED'}`);
    }
    if (only.has('mesh')) {
      run.mesh = await page.evaluate(() => [window.__tex.meshes({ az: 30, el: 35, z: 1 }), window.__tex.meshes({ az: 0, el: 90, z: 4, focus: window.__tex.focus })]);
      const ok = run.mesh.every((m) => m.worst <= 4 && m.over2 <= 1e-5 * m.inside && m.inside > 10000);
      need(ok, `dpr ${dpr}: two triangles and the grid differ by ${run.mesh.map((m) => m.worst).join(', ')} levels inside the sheet`);
      say(`\n   two triangles against a 24 x 24 grid, same view (tilted z 1; face-on z 4): largest difference of a colour channel inside the sheet ${run.mesh.map((m) => m.worst + ' of 255 over ' + m.inside + ' px').join('; ')}` +
        ` (on the whole canvas, the sheet's multisampled rim included: ${run.mesh.map((m) => m.worstAll).join('; ')})  ${ok ? 'ok' : '<-- MISSED'}`);
    }
    if (only.has('seam')) {
      // the same print from a texture whose cell begins half a cell further on: the two pictures must be the same
      run.seam = [];
      say('\n   no seam: the picture from a second texture whose cells begin half a cell further on (its borders run elsewhere) against the first; the difference of the tone, pixel by pixel');
      say('   view                     |  pixels    largest  rms     |  on a border of either: pixels  largest  rms    (one colour level = 1 / levels of tone)');
      const views = [];
      for (const v of VIEWS) for (const z of zooms) views.push([`${v.name} z ${z}`, { az: v.az, el: v.el, z, focus: focusOf(z) }, {}, REQUIRED.has(z) && v.name !== 'grazing']);
      for (const sheetPx of [80, 40, 20, 12]) views.push([`sheet ${sheetPx} px, el 55`, { az: 10, el: 55, sheetPx }, { margin: 1.5 }, true]);
      for (const [name, view, o, req] of views) {
        const m = await page.evaluate(([v, oo]) => window.__tex.seamShift(v, oo), [view, o]);
        m.name = name;
        run.seam.push(m);
        // the two textures hold the same numbers half a side apart, so the GPU interpolates them at other sub-texel
        // positions: up to a few hundredths of a tone on an outline at 10 px a texel and more. A seam would be MORE on a border.
        const ok = m.max <= 0.06 && m.borderMax <= 0.03 && m.borderMax <= m.max;
        if (req) need(ok, `dpr ${dpr} seam ${name}: the two textures differ by ${m.max} (on a border ${m.borderMax})`);
        say(`   ${pad(name, 24)} |  ${pad(m.n, 8)}  ${pad(m.max, 7)}  ${pad(m.rms, 6)}  |  ${pad(m.borderN, 28)}  ${pad(m.borderMax, 7)}  ${pad(m.borderRms, 6)} (${m.levels})${req && !ok ? '  <-- MISSED' : ''}`);
      }
    }
    if (only.has('baked')) {
      // the two halves together: the same shapes as polygons, baked by src/sdf.js (the production baker), on the GPU
      if (I.sdfjs !== 'ok') say(`\n   src/sdf.js: ${I.sdfjs} — the row with its texture is left out`);
      else {
        run.baked = [];
        await page.evaluate(([sz, rg]) => window.__tex.setTex(sz, rg, 'baked'), [size, range]);
        say('\n   the texture baked by src/sdf.js bakeSDF from the same shapes as polygons (circles of 4096 points), against the analytic print:');
        for (const [name, view, side] of [['face-on z 1', { az: 0, el: 90, z: 1 }, 'front'], ['face-on z 4', { az: 0, el: 90, z: 4, focus: head.focus }, 'front'], ['tilted z 2', { az: 30, el: 35, z: 2, focus: head.focus }, 'front'], ['face-on z 0.25', { az: 0, el: 90, z: 0.25 }, 'front'], ['back, tilted z 1', { az: 30, el: -35, z: 1 }, 'back']]) {
          const m = await page.evaluate(([v, sd]) => { window.__tex.place(v); return window.__tex.measure({ side: sd }); }, [view, side]);
          m.name = name;
          run.baked.push(m);
          const ok = m.far.pct >= 99.5 && m.sample.pct >= 99.5 && m.edge.width <= 1.5 && Math.abs(m.edge.offsetPx) < 0.1;
          need(ok, `dpr ${dpr} baked ${name}: far ${m.far.pct} %, width ${m.edge.width}, offset ${m.edge.offsetPx}`);
          say(`   ${pad(name, 17)} far ${pad(m.far.n, 8)} px agree ${pad(m.far.pct, 7)} % (sample ${m.sample.pct} % of ${m.sample.n}); edge width ${pad(m.edge.width, 6)} px, offset ${pad(m.edge.offsetPx, 7)} px, outline rms ${pad(m.edge.posRms, 6)} px; twin rms ${pad(m.twin.rms, 6)} (texture ${m.twin.rmsTex})  ${ok ? 'ok' : '<-- MISSED'}`);
        }
        const sm = await page.evaluate(() => [window.__tex.seamShift({ az: 0, el: 90, z: 1 }), window.__tex.seamShift({ az: 10, el: 55, sheetPx: 40 }, { margin: 1.5 })]);
        run.bakedSeam = sm;
        const okS = sm.every((m) => m.borderMax <= 0.03 && m.max <= 0.06);
        need(okS, `dpr ${dpr} baked: the shifted texture differs by ${sm.map((m) => m.max).join(', ')}`);
        say(`   its half-cell-shifted twin (baked for the other cell): largest difference of the tone ${sm.map((m) => m.max).join(' (z 1), ')} (sheet 40 px)  ${okS ? 'ok' : '<-- MISSED'}`);
        await page.evaluate(([sz, rg]) => window.__tex.setTex(sz, rg), [size, range]);
      }
    }
    const sweeps = dpr === Math.max(...dprs);                 // the sweeps over the texture itself: once, at the finest pixels
    if (only.has('range') && sweeps) {
      // the same field, saturating nearer or farther: what the 8 bits of a texel are spent on
      run.range = [];
      say('\n   the RANGE (in texels; the texture is ' + size + ' a side): the outline is stored to range / 254, and the ramp gives way to the plain mean at a footprint of 2 range');
      say('   range  view            px/texel  footpr/range |  far agree%  worst |  width   pos rms px  pos max px (rms in texels) |  twin rms');
      for (const r of [1, 1.5, 2, 3, 4, 6, 8, 16]) {
        await page.evaluate(([sz, rg]) => window.__tex.setTex(sz, rg), [size, r]);
        for (const [name, view] of [['face-on z 8', { az: 0, el: 90, z: 8, focus: head.focus }], ['tilted z 4', { az: 30, el: 35, z: 4, focus: head.focus }], ['face-on z 1', { az: 0, el: 90, z: 1 }], ['face-on z 0.25', { az: 0, el: 90, z: 0.25 }], ['tilted z 0.25', { az: 30, el: 35, z: 0.25 }], ['face-on z 0.125', { az: 0, el: 90, z: 0.125 }]]) {
          const m = await page.evaluate(([v]) => { window.__tex.place(v); return window.__tex.measure({ side: 'front' }); }, [view]);
          m.name = name; m.rangeTexels = r;
          run.range.push(m);
          say(`   ${pad(r, 6)} ${pad(name, 15)} ${pad(m.view.pxPerTexel, 9)} ${pad(m.view.footprintOverRange, 12)} |  ${pad(m.far.pct, 10)}  ${pad(m.far.worst, 5)} |  ${pad(m.edge.width, 6)}  ${pad(m.edge.posRms, 10)}  ${pad(m.edge.posMax, 9)} (${pad(m.edge.posRmsTexel, 6)})         |  ${pad(m.twin.rms, 6)}`);
        }
      }
      await page.evaluate(([sz, rg]) => window.__tex.setTex(sz, rg), [size, range]);
    }
    if (only.has('size') && sweeps) {
      // the same picture (one lattice cell about 256 css px across, and 4 times that) from textures of several sizes
      run.size = [];
      say('\n   the SIZE of the texture (range 4 texels each), the picture kept the same: a cell of the lattice is 256 css px across (near), or 1024 (close)');
      say('   size   view    px/texel |  far agree%  worst |  width   pos rms px  pos max px |  twin rms   max');
      for (const sz of [64, 128, 256, 512, 1024]) {
        await page.evaluate(([a, rg]) => window.__tex.setTex(a, rg), [sz, 4]);
        for (const [name, view] of [['near', { az: 0, el: 90, z: 256 / sz }], ['close', { az: 0, el: 90, z: 4 * 256 / sz, focus: head.focus }]]) {
          const m = await page.evaluate(([v]) => { window.__tex.place(v); return window.__tex.measure({ side: 'front' }); }, [view]);
          m.name = name; m.size = sz;
          run.size.push(m);
          say(`   ${pad(sz, 6)} ${pad(name, 7)} ${pad(m.view.pxPerTexel, 8)} |  ${pad(m.far.pct, 10)}  ${pad(m.far.worst, 5)} |  ${pad(m.edge.width, 6)}  ${pad(m.edge.posRms, 10)}  ${pad(m.edge.posMax, 9)} |  ${pad(m.twin.rms, 8)}   ${pad(m.twin.max, 5)}`);
        }
      }
      run.upload = [];
      for (const sz of [256, 512, 1024, 2048]) run.upload.push(await page.evaluate(([a]) => window.__tex.uploadCost(a), [sz]));
      say('   handing over ANOTHER field (upload and mip levels, the frame it happens in less a frame without): ' + run.upload.map((u) => `${u.size}^2: ${u.ms} ms (worst of 5: ${u.worst})`).join(';  '));
      // a size that is no power of two: its mip levels do not repeat exactly; and the easy, poor way to make a field
      say('   other textures, against the 256 one (range 4 texels): the picture from the half-cell-shifted texture (largest difference of the tone), and the outline in the close view');
      run.other = [];
      for (const [label, sz, how] of [['256 (a power of two)', 256, 'exact'], ['200', 200, 'exact'], ['243 (odd)', 243, 'exact'], ['256 from a 0/1 raster', 256, 'raster']]) {
        await page.evaluate(([a, h]) => window.__tex.setTex(a, 4, h), [sz, how]);
        const row = { label, size: sz, how, seam: [] };
        for (const view of [{ az: 0, el: 90, z: 1 }, { az: 0, el: 90, z: 0.25 }, { az: 30, el: 35, z: 0.125 }, { az: 10, el: 55, sheetPx: 40 }, { az: 10, el: 55, sheetPx: 16 }]) row.seam.push(await page.evaluate(([v]) => window.__tex.seamShift(v, { margin: 1.5 }), [view]));
        row.close = await page.evaluate(([v]) => { window.__tex.place(v); return window.__tex.measure({ side: 'front' }); }, [{ az: 0, el: 90, z: 4 * 256 / sz, focus: head.focus }]);
        run.other.push(row);
        say(`   ${pad(label, 22)} shifted texture: ${row.seam.map((m) => m.max).join(' / ')} (z 1 / z 0.25 / tilted z 0.125 / sheet 40 px / sheet 16 px)   close view: far agree ${row.close.far.pct} %, width ${row.close.edge.width} px, outline rms ${row.close.edge.posRms} px (max ${row.close.edge.posMax}), twin rms ${row.close.twin.rms}`);
      }
      await page.evaluate(([sz, rg]) => window.__tex.setTex(sz, rg), [size, range]);
    }
    if (only.has('tiny')) {
      run.tiny = [];
      say('\n   small on the screen, turning 1 degree a frame (13 frames). flicker = mean |T(k-1) - 2 T(k) + T(k+1)| per pixel;');
      say('   ideal = the true share of dark under the pixel, soft = the mean of the saturating ramp (what the texture holds), point = no filtering (the control)');
      say('   sheet px  el  footpr/range |  mean tone gpu (spread)  ideal  (spread)  soft   |  flicker gpu  ideal   soft   point |  contrast gpu  ideal  soft |  rms gpu-soft  gpu-ideal');
      for (const el of [55, 90]) for (const sheetPx of [160, 80, 40, 20, 12]) {
        const t = await page.evaluate(([o]) => window.__tex.tiny(o), [{ sheetPx, el, frames: 13, stepDeg: 1 }]);
        run.tiny.push(t);
        // calm: the mean does not wander, and a pixel flickers no more than the ideal picture's does (plus a little)
        const ok = t.gpu.meanSpread <= Math.max(0.02, 2 * t.ideal.meanSpread) && t.gpu.flicker <= 1.1 * t.ideal.flicker + 0.002 && t.gpu.flicker < t.point.flicker;
        need(ok, `dpr ${dpr} tiny ${sheetPx} px el ${el}: mean spread ${t.gpu.meanSpread}, flicker ${t.gpu.flicker} (ideal ${t.ideal.flicker}, point ${t.point.flicker})`);
        say(`   ${pad(sheetPx, 9)} ${pad(el, 3)} ${pad(t.footprintOverRange, 12)} |  ${pad(t.gpu.mean, 6)} (${pad(t.gpu.meanSpread, 6)})        ${pad(t.ideal.mean, 6)} (${pad(t.ideal.meanSpread, 6)}) ${pad(t.soft.mean, 6)} |  ${pad(t.gpu.flicker, 11)}  ${pad(t.ideal.flicker, 6)}  ${pad(t.soft.flicker, 6)} ${pad(t.point.flicker, 6)}|  ${pad(t.gpu.contrast, 12)}  ${pad(t.ideal.contrast, 6)} ${pad(t.soft.contrast, 6)}|  ${pad(t.rmsVsSoft, 12)}  ${pad(t.rmsVsIdeal, 6)} ${ok ? '' : ' <-- MISSED'}`);
      }
    }
    if (only.has('lose')) {
      run.lose = await page.evaluate(() => window.__tex.lose({ az: 30, el: 35, z: 1 }));
      const L = run.lose;
      const ok = L.lostFlag && L.restored && L.worstDiff <= 1 && L.uploadsAfter === L.uploadsBefore + 1 && L.darkPixelsBefore > 1000;
      need(ok, `dpr ${dpr}: context loss ${JSON.stringify(L)}`);
      say(`\n   WEBGL_lose_context: lost ${L.lostFlag} (message shown ${L.noteShown}), restored ${L.restored}; texture uploads ${L.uploadsBefore} -> ${L.uploadsAfter}; the picture after against before: largest difference ${L.worstDiff} of 255 (${L.pixelsOver2} pixels over 2), ${L.darkPixelsBefore} dark pixels in it  ${ok ? 'ok' : '<-- MISSED'}`);
    }
    if (only.has('pictures')) {
      const shots = [
        [{ az: 0, el: 90, z: 0.9 }, {}, 'front, face-on, z 0.9', 'face-on'],
        [{ az: 30, el: 35, z: 0.8 }, {}, 'front, tilted (az 30, el 35)', 'tilted'],
        [{ az: 20, el: 12, z: 0.8 }, {}, 'front, grazing (el 12)', 'grazing'],
        [{ az: 30, el: -35, z: 0.8 }, {}, 'BACK, tilted (el -35)', 'back-tilted'],
        [{ az: 0, el: -90, z: 0.9 }, {}, 'BACK, face-on (el -90)', 'back-face-on'],
        [{ az: 0, el: 90, z: 2, focus: head.focus }, {}, 'z 2', 'z2'],
        [{ az: 0, el: 90, z: 4, focus: head.focus }, {}, 'z 4', 'z4'],
        [{ az: 0, el: 90, z: 8, focus: head.focus }, {}, `z 8 (${8 * dpr} device px a texel)`, 'z8'],
        [{ az: 30, el: 35, z: 8, focus: head.focus }, {}, 'z 8, tilted', 'z8-tilted'],
        [{ az: 20, el: 12, z: 4, focus: head.focus }, {}, 'z 4, grazing', 'z4-grazing'],
      ];
      // the minified views: the middle of the canvas, blown up without smoothing
      for (const [z, name] of [[0.5, 'z05'], [0.25, 'z025'], [0.125, 'z0125']]) {
        const side = Math.min(I.W, Math.round(640 * z * dpr * 1.08)), x0 = Math.round((I.W - side) / 2), k = Math.max(1, Math.floor(1200 / side));
        shots.push([{ az: 0, el: 90, z }, { crop: [x0, x0, side, side], scale: k }, `z ${z} (${1 / z / dpr} texels a device px), x${k}`, name]);
      }
      shots.push([{ az: 30, el: 35, z: 0.25 }, { crop: [Math.round(I.W * 0.3), Math.round(I.W * 0.3), Math.round(I.W * 0.4), Math.round(I.W * 0.4)], scale: Math.max(1, Math.floor(3 / dpr)) }, 'z 0.25, tilted, blown up', 'z025-tilted']);
      run.pictures = [];
      for (const [view, o, label, name] of shots) {
        const url = await page.evaluate(([v, oo, lb]) => window.__tex.picture(v, { ...oo, label: lb }), [view, o, `${label} · dpr ${dpr}`]);
        run.pictures.push(savePng(`tex${tag}-dpr${dpr}-${name}.png`, url));
      }
      // the small sheets: the middle of the canvas, blown up without smoothing
      for (const sheetPx of [80, 40, 20, 12]) {
        const cropPx = Math.round(sheetPx * 1.7), x0 = Math.round((I.W - cropPx) / 2), k = Math.max(1, Math.floor(600 / cropPx));
        for (const az of [10, 16]) {
          const url = await page.evaluate(([v, c, s, lb]) => window.__tex.picture(v, { crop: c, scale: s, label: lb }), [{ az, el: 55, sheetPx }, [x0, x0, cropPx, cropPx], k, `sheet ${sheetPx} device px, az ${az} (x${k}) · dpr ${dpr}`]);
          run.pictures.push(savePng(`tex${tag}-dpr${dpr}-small${sheetPx}-az${az}.png`, url));
        }
      }
      // the same paper rolled up (bent, not stretched): the print on a curved mesh, front and back in one picture
      await page.evaluate(() => window.__tex.setMesh('roll'));
      for (const [view, label, name] of [[{ az: 35, el: 30, z: 0.8, focus: [0, 0] }, 'rolled up: the front outside, the back inside', 'roll'], [{ az: 150, el: -20, z: 1.6, focus: [0, 0.2] }, 'rolled up, from behind and below, closer', 'roll-inside'], [{ az: 90, el: 4, z: 1.2, focus: [0, 0] }, 'rolled up, along the paper (grazing everywhere)', 'roll-grazing']]) {
        const url = await page.evaluate(([v, lb]) => window.__tex.picture(v, { label: lb }), [view, `${label} · dpr ${dpr}`]);
        run.pictures.push(savePng(`tex${tag}-dpr${dpr}-${name}.png`, url));
      }
      await page.evaluate(() => window.__tex.setMesh('grid'));
      const sheet = await page.evaluate(() => window.__tex.contact({ cols: 4, px: 300 }));
      await page.locator('#sheet').screenshot({ path: path.join(outDir, `tex${tag}-dpr${dpr}-contact.png`) });
      run.pictures.push(`tex${tag}-dpr${dpr}-contact.png`);
      say(`\n   pictures: ${run.pictures.length} PNG in ${outDir} (contact sheet of ${sheet.tiles}: tex${tag}-dpr${dpr}-contact.png)`);
    }
    run.stats = await page.evaluate(() => window.__tex.stats());
    say(`   texture uploads over the whole run at dpr ${dpr}: ${run.stats.printUploads} (every other texture of the sweeps and of the seam test is one; ${run.stats.styleCalls} setStyle calls with a print)`);
    await ctx.close();
  }
} finally { await B.close(); }
all.fails = fails;
fs.writeFileSync(path.join(outDir, `tex-demo${tag}.json`), JSON.stringify(all, null, 1));
if (fails.length) { say(`\nMISSED (${fails.length}):`); for (const f of fails) say('  - ' + f); code = 1; } else say('\nevery bound of the brief is met');
fs.writeFileSync(path.join(outDir, `tex-demo${tag}.txt`), lines.join('\n') + '\n');
console.log(`\nWROTE ${path.join(outDir, `tex-demo${tag}.json`)} and .txt (${B.where})`);
process.exit(code);
