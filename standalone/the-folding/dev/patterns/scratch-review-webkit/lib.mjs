// dev/patterns/scratch-review-webkit/lib.mjs — the review of the pattern round in ONE engine (the reviewer of 15 Nov
// 2026, lens: Safari). The same scenario runs in WebKit (wk.mjs, on the M5) and in Chrome (cr.mjs, on the mini), on the
// BUILT page, so the two can be put side by side. No import: wk.mjs copies this file next to the page.
//   runReview({ browser, url, out, engine, quick }) -> report (also written to out/report.json)
// What it does, per engine:
//   env       the engine, WebGL 2's strings, requestIdleCallback, the pattern the page opens with
//   shader    the page's own surface shaders (taken from the bundle's text) compiled and linked in a fresh context
//   states    1280 x 800 at dpr 2: 6 patterns x 6 groups at t = 0 (the AGREE check), 0.6 and 1 (pictures of both panes);
//             GL errors, console messages, the print on screen
//   agree     t = 0: at the centroids of the tile's triangles (away from the print's outlines), the colour the 3D view
//             drew (readPixels right after a draw) and the colour the plane drew (getImageData) against print.tone
//   select    the native select: each option chosen as a person does (selectOption), at 1280 and 375 px; the pill's
//             swatch and name, the hash, the page's width
//   width     every pattern chosen in the select at 320 / 360 / 375 / 390 / 414 px: no page wider than its window
//   phone     390 x 844 at dpr 3: 4 patterns x 3 groups at t = 0.6 and 1
//   idle      a page WITHOUT requestIdleCallback (removed before the app runs): does the warmer make the 16 groups
//   time      setGroup over the 17 groups, nothing made ahead (warmer stopped) and made ahead (after the warmer)
import fs from 'node:fs';
import path from 'node:path';

export const PATS = ['paisley', 'soft', 'tomoe', 'checker', 'rings', 'comma'];
export const GROUPS_SHOT = ['333', '*x', 'xx', '22x', '*632', 'o'];
export const ALL = ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
const safe = (id) => id.replace(/\*/g, 's');

// ---- in the page ------------------------------------------------------------------------------------------------
const ENV = () => {
  const F = window.__folding, R = F.renderer, gl = R.gl, st = F.getState();
  let info = null;
  if (gl) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    info = {
      version: gl.getParameter(gl.VERSION), glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
      unmasked: dbg ? [gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL), gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)] : null,
      maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), aniso: an ? gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : null,
      samples: gl.getParameter(gl.SAMPLES), stencil: gl.getParameter(gl.STENCIL_BITS),
      attrs: gl.getContextAttributes(),
    };
  }
  return {
    ua: navigator.userAgent, dpr: devicePixelRatio, ric: typeof window.requestIdleCallback, cic: typeof window.cancelIdleCallback,
    gl: info, rok: R.ok !== false, opened: st.pattern, group: st.groupId, print: st.print, printKind: st.printKind,
    hash: location.hash, select: document.getElementById('pattern').value, dataPattern: document.getElementById('app').getAttribute('data-pattern'),
    dataPrint: document.getElementById('app').getAttribute('data-print'), errors: F.errors.slice(0, 5).map(String), warm: st.warm,
    uploads: R.stats.printUploads, frames: R.stats.frames,
  };
};

const SHADER = () => {
  const src = [...document.scripts].map((s) => s.textContent).join('\n');
  const lits = src.match(/`#version 300 es[^`]*`/g) || [];
  const vs = lits.find((s) => s.includes('in vec2 aUV')), fs = lits.find((s) => s.includes('uPatT'));
  if (!vs || !fs) return { found: lits.length, error: 'the surface shaders are not in the bundle\'s text' };
  const c = document.createElement('canvas'); c.width = 4; c.height = 4;
  const gl = c.getContext('webgl2');
  if (!gl) return { error: 'no webgl2' };
  const comp = (type, s) => { const sh = gl.createShader(type); gl.shaderSource(sh, s.slice(1, -1)); gl.compileShader(sh); return { sh, ok: !!gl.getShaderParameter(sh, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(sh) || '' }; };
  const v = comp(gl.VERTEX_SHADER, vs), f = comp(gl.FRAGMENT_SHADER, fs);
  const p = gl.createProgram(); gl.attachShader(p, v.sh); gl.attachShader(p, f.sh); gl.linkProgram(p);
  const linked = !!gl.getProgramParameter(p, gl.LINK_STATUS), plog = gl.getProgramInfoLog(p) || '';
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0, uni = [];
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); if (u) uni.push(u.name); }
  const dbg = gl.getExtension('WEBGL_debug_shaders');
  const out = { found: lits.length, vsOk: v.ok, vsLog: v.log.slice(0, 400), fsOk: f.ok, fsLog: f.log.slice(0, 400), linked, plog: plog.slice(0, 400),
    uniforms: uni.length, hasSampler: uni.includes('uPatT'), translatedFs: dbg ? dbg.getTranslatedShaderSource(f.sh).length : null, fsChars: fs.length };
  const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
  return out;
};

const GLERR = () => {
  const gl = window.__folding.renderer.gl, codes = [];
  if (!gl) return codes;
  for (let i = 0; i < 8; i++) { const e = gl.getError(); if (!e) break; codes.push(e); }
  return codes;
};

const STATE = () => {
  const F = window.__folding, st = F.getState();
  return { g: st.groupId, pat: st.pattern, print: st.print, kind: st.printKind, t: st.t, webgl: st.webgl, errors: st.errors,
    appErrors: F.errors.slice(0, 3).map(String), uploads: F.renderer.stats.printUploads, caption: st.foldCaption, recut: st.recut ? st.recut.home : null,
    dataPrint: document.getElementById('app').getAttribute('data-print'),
    plane: { ms: Math.round(F.plane.stats.ms * 10) / 10, printMs: Math.round(F.plane.stats.printMs * 10) / 10, printBuilds: F.plane.stats.printBuilds },
    r3d: { cpuMs: Math.round(F.renderer.stats.cpuMs * 10) / 10, tris: F.renderer.stats.triangles } };
};

// t = 0: the 3D view's and the plane's colour at the tile's points against the print's own tone
const AGREE = (opts) => {
  const F = window.__folding, S = F.scene(), R = F.renderer, P = F.plane, gl = R.gl;
  if (!S || !S.print) return { skip: 'no print' };
  const pr = S.print, rr = (opts.r || 0.025) * Math.sqrt(S.group.domainArea);
  R.render();                                                  // draw, and read the drawing buffer in the same task
  const cv = R.canvas, cw = cv.width, ch = cv.height, kx = cw / cv.clientWidth, ky = ch / cv.clientHeight;
  const buf = new Uint8Array(cw * ch * 4);
  gl.readPixels(0, 0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const glErr = gl.getError();
  P.render();
  const pc = document.getElementById('plane-canvas'), pimg = pc.getContext('2d').getImageData(0, 0, pc.width, pc.height).data;
  const pkx = pc.width / pc.clientWidth, pky = pc.height / pc.clientHeight;
  const xy = S.M.xy, pos = S.pos, tri = S.M.tri, tint = S.M.tint && S.M.tint.length >= S.n ? S.M.tint : null;
  const nT = tri.length / 3, step = Math.max(1, Math.floor(nT / (opts.n || 2500)));
  const s3 = [], sp = [];
  let skipped = 0;
  for (let k = 0; k < nT; k += step) {
    const a = tri[3 * k], b = tri[3 * k + 1], c = tri[3 * k + 2];
    if (tint && ((tint[a] & 1) || (tint[b] & 1) || (tint[c] & 1))) { skipped++; continue; }
    const u = (xy[2 * a] + xy[2 * b] + xy[2 * c]) / 3, v = (xy[2 * a + 1] + xy[2 * b + 1] + xy[2 * c + 1]) / 3;
    const tone = pr.tone(u, v);
    let clean = true;
    for (let i = 0; i < 12 && clean; i++) { const th = i * Math.PI / 6; if (pr.tone(u + rr * Math.cos(th), v + rr * Math.sin(th)) !== tone) clean = false; }
    if (!clean) continue;
    const p = [0, 1, 2].map((j) => (pos[3 * a + j] + pos[3 * b + j] + pos[3 * c + j]) / 3);
    const q = R.project(p);
    if (q[2]) {
      const X = Math.floor(q[0] * kx), Y = Math.floor(q[1] * ky);
      if (X >= 0 && Y >= 0 && X < cw && Y < ch) { const o = 4 * ((ch - 1 - Y) * cw + X); s3.push([tone, buf[o], buf[o + 1], buf[o + 2], buf[o + 3], +u.toFixed(4), +v.toFixed(4)]); }
    }
    const pp = P.toCss(u, v), PX = Math.floor(pp[0] * pkx), PY = Math.floor(pp[1] * pky);
    if (PX >= 0 && PY >= 0 && PX < pc.width && PY < pc.height) { const o = 4 * (PY * pc.width + PX); sp.push([tone, pimg[o], pimg[o + 1], pimg[o + 2], pimg[o + 3], +u.toFixed(4), +v.toFixed(4)]); }
  }
  // each tone's colour: the mean of its commonest colour bin (16 levels a channel). (A median per channel is no colour
  // when a tone's samples also hit the rim's coloured seams and the cone points, as on a small tile.)
  const mode = (rows) => {
    const bins = new Map();
    for (const r of rows) { const k = (r[1] >> 4) + ',' + (r[2] >> 4) + ',' + (r[3] >> 4); const b = bins.get(k) || []; b.push(r); bins.set(k, b); }
    let best = [];
    for (const b of bins.values()) if (b.length > best.length) best = b;
    return [1, 2, 3, 4].map((j) => best.length ? Math.round(best.reduce((s, r) => s + r[j], 0) / best.length) : NaN);
  };
  const classify = (arr) => {
    const by = [0, 1].map((t) => arr.filter((r) => r[0] === t));
    const m = by.map(mode);
    const dist = (r, c) => Math.hypot(r[1] - c[0], r[2] - c[1], r[3] - c[2]);
    const sep = by[0].length && by[1].length ? Math.hypot(m[0][0] - m[1][0], m[0][1] - m[1][1], m[0][2] - m[1][2]) : 0;
    let agree = 0, wrong = 0, unc = 0;
    const bad = [];
    for (const r of arr) {
      const d0 = dist(r, m[0]), d1 = dist(r, m[1]), near = d0 <= d1 ? 0 : 1;
      if (!(sep > 0) || Math.min(d0, d1) > 0.35 * sep) { unc++; continue; }
      if (near === r[0]) agree++; else { wrong++; if (bad.length < 6) bad.push(r); }
    }
    return { n: arr.length, n0: by[0].length, n1: by[1].length, light: m[0], dark: m[1], sep: Math.round(sep), agree, wrong, unc, bad };
  };
  return { print: pr.name, kind: pr.kind, tris: nT, step, ghostSkipped: skipped, glErr, gl3: classify(s3), plane: classify(sp), canvas: [cw, ch], planeCanvas: [pc.width, pc.height] };
};

// the pill as it is: which swatch shows, its name, the select, the page's width
const PILL = () => {
  const q = (s) => document.querySelector(s), app = q('#app');
  const shown = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const sw = [...document.querySelectorAll('#pattern-box .pat-sw')].filter(shown);
  const h = q('#header'), sel = q('#pattern'), lab = q('#pattern-label');
  const paints = sw.length ? [...sw[0].querySelectorAll('rect, path, circle')].map((e) => getComputedStyle(e).fill) : [];
  const st = window.__folding.getState();
  return { w: innerWidth, pattern: st.pattern, print: st.print, kind: st.printKind, dataPattern: app.getAttribute('data-pattern'), dataPrint: app.getAttribute('data-print'),
    select: sel.value, selectedText: sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : null,
    swatches: sw.map((e) => e.getAttribute('class')), swBox: sw.length ? (({ width, height }) => [Math.round(width * 10) / 10, Math.round(height * 10) / 10])(sw[0].getBoundingClientRect()) : null,
    paints: [...new Set(paints)], label: lab.textContent.trim(), labelShown: shown(lab), hash: location.hash,
    pageW: document.documentElement.scrollWidth, headerOver: h.scrollWidth - h.clientWidth, bodyW: document.body.scrollWidth,
    selBox: (({ left, top, width, height }) => [left, top, width, height].map((v) => Math.round(v)))(sel.getBoundingClientRect()),
    pillBox: (({ left, top, width, height }) => [left, top, width, height].map((v) => Math.round(v)))(q('#pattern-box .pat-pill').getBoundingClientRect()),
    selScrollW: sel.scrollWidth, selClientW: sel.clientWidth };
};

// ---- the scenario ---------------------------------------------------------------------------------------------
async function settle(page, maxMs = 1500) {
  let last = -1;
  const t0 = Date.now();
  for (;;) {
    const f = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__folding.renderer.stats.frames)))));
    if (f === last || Date.now() - t0 > maxMs) return;
    last = f;
    await page.waitForTimeout(120);
  }
}

async function open(browser, url, { viewport, dpr, init, report, name }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const log = [];
  page.on('console', (m) => { if (log.length < 400) log.push([m.type(), m.text().slice(0, 300)]); });
  page.on('pageerror', (e) => { if (log.length < 400) log.push(['pageerror', String(e && e.message).slice(0, 300)]); });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  report.loads.push({ name, ms: Date.now() - t0 });
  return { ctx, page, log };
}

export async function runReview({ browser, url, out, engine, quick = false }) {
  fs.mkdirSync(out, { recursive: true });
  const report = { engine, version: browser.version(), url, started: new Date().toISOString(), loads: [], states: [], agree: [], select: [], width: [], phone: [], idle: {}, time: {}, logs: {} };
  const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  const shot = async (page, sel, file) => { try { await page.locator(sel).screenshot({ path: path.join(out, file), type: 'jpeg', quality: 88 }); } catch (e) { report.states.push({ shotError: file + ': ' + String(e.message).slice(0, 200) }); } };

  // ---- the laptop, retina: env, the shader, every pattern on six groups --------------------------------------------
  {
    const { ctx, page, log } = await open(browser, url, { viewport: { width: 1280, height: 800 }, dpr: 2, report, name: 'laptop' });
    report.env = await page.evaluate(ENV);
    report.shader = await page.evaluate(SHADER);
    report.glErrAtOpen = await page.evaluate(GLERR);
    await settle(page);
    // a pattern change on 333, the first time (its print, the 3D texture, the plane's layers) and again
    report.patTime = await page.evaluate((pats) => {
      const F = window.__folding, out = [];
      F.warmer.stop();
      for (const round of [1, 2]) for (const p of pats.slice(1).concat(pats[0])) { const t0 = performance.now(); F.setPattern(p); out.push([round, p, Math.round((performance.now() - t0) * 10) / 10]); }
      return out;
    }, PATS);
    await page.screenshot({ path: path.join(out, 'L-open.jpg'), type: 'jpeg', quality: 88 });
    const pats = quick ? ['paisley', 'checker'] : PATS, groups = quick ? ['333', '*x'] : GROUPS_SHOT;
    for (const p of pats) {
      for (const g of groups) {
        await page.evaluate(([g, p]) => { const F = window.__folding; F.setGroup(g); F.setPattern(p); F.setT(0); }, [g, p]);
        await settle(page);
        const ag = await page.evaluate(AGREE, { r: 0.025, n: 2500 });
        report.agree.push({ g, p, ...ag });
        if (g === '333' || g === '*x') await page.screenshot({ path: path.join(out, `L-${p}-${safe(g)}-t0.jpg`), type: 'jpeg', quality: 88 });
        for (const t of [0.6, 1]) {
          await page.evaluate((t) => window.__folding.setT(t), t);
          await settle(page);
          const s = await page.evaluate(STATE);
          s.glErr = await page.evaluate(GLERR);
          report.states.push({ g, p, t, ...s });
          const tag = `${p}-${safe(g)}-t${t === 1 ? '1' : '06'}`;
          await shot(page, '#pane-fold', `L-fold-${tag}.jpg`);
          await shot(page, '#pane-plane', `L-plane-${tag}.jpg`);
        }
      }
      save();
    }
    // the back of the closed shape for the new three (the view from below)
    for (const p of ['paisley', 'soft', 'tomoe']) {
      await page.evaluate((p) => { const F = window.__folding; F.setGroup('333'); F.setPattern(p); F.setT(0.6); F.setView(180, -40, 1); }, p);
      await settle(page);
      await shot(page, '#pane-fold', `L-fold-${p}-333-back.jpg`);
    }
    await page.evaluate(() => window.__folding.resetView());

    // ---- the native select, as a person chooses -------------------------------------------------------------------
    for (const w of [1280, 375]) {
      await page.setViewportSize({ width: w, height: w > 600 ? 800 : 667 });
      await page.evaluate(() => { const F = window.__folding; F.setGroup('333'); F.setT(0); });
      await page.waitForTimeout(200);
      for (const p of PATS) {
        await page.selectOption('#pattern', p);
        await page.waitForTimeout(250);
        const r = await page.evaluate(PILL);
        report.select.push({ w, chose: p, ...r });
        await page.locator('#header').screenshot({ path: path.join(out, `S-${w}-${p}.png`) });
      }
    }
    // ---- no page wider than its window, every pattern chosen in the select -------------------------------------
    for (const w of [320, 360, 375, 390, 414]) {
      await page.setViewportSize({ width: w, height: 700 });
      await page.waitForTimeout(150);
      for (const p of PATS) {
        await page.selectOption('#pattern', p);
        await page.waitForTimeout(80);
        const r = await page.evaluate(PILL);
        report.width.push({ w, p, pageW: r.pageW, bodyW: r.bodyW, headerOver: r.headerOver, selScrollW: r.selScrollW, selClientW: r.selClientW, pattern: r.pattern });
      }
    }
    report.logs.laptop = log;
    save();
    await ctx.close();
  }

  // ---- a phone at dpr 3 ------------------------------------------------------------------------------------------
  if (!quick) {
    const { ctx, page, log } = await open(browser, url, { viewport: { width: 390, height: 844 }, dpr: 3, report, name: 'phone' });
    report.phoneEnv = await page.evaluate(ENV);
    for (const p of ['paisley', 'soft', 'tomoe', 'checker']) {
      for (const g of ['333', '*x', '*632']) {
        for (const t of [0.6, 1]) {
          await page.evaluate(([g, p, t]) => { const F = window.__folding; F.setGroup(g); F.setPattern(p); F.setT(t); }, [g, p, t]);
          await settle(page);
          const s = await page.evaluate(STATE);
          s.glErr = await page.evaluate(GLERR);
          report.phone.push({ g, p, t, ...s });
          await page.screenshot({ path: path.join(out, `P-${p}-${safe(g)}-t${t === 1 ? '1' : '06'}.jpg`), type: 'jpeg', quality: 85 });
        }
      }
    }
    report.logs.phone = log;
    save();
    await ctx.close();
  }

  // ---- no requestIdleCallback (Safari): the warmer's timeout chain ----------------------------------------------------
  const idleRun = async (name, init) => {
    const { ctx, page, log } = await open(browser, url, { viewport: { width: 1280, height: 800 }, dpr: 1, init, report, name });
    const r = { ric: await page.evaluate(() => typeof window.requestIdleCallback), passes: [] };
    for (const p of ['paisley', 'soft', 'tomoe']) {
      if (p !== 'paisley') await page.evaluate((p) => window.__folding.setPattern(p), p);
      const t0 = Date.now();
      let w = null;
      while (Date.now() - t0 < 20000) {
        w = await page.evaluate(() => window.__folding.getState().warm);
        if (w.key === p && w.left === 0) break;
        await page.waitForTimeout(250);
      }
      r.passes.push({ p, sec: (Date.now() - t0) / 1000, warm: w });
    }
    // with Tomoe's prints made ahead: a group change over the 17 groups
    r.warmedTomoe = await page.evaluate((ids) => { const F = window.__folding, out = []; for (const id of ids) { const t0 = performance.now(); F.setGroup(id); out.push([id, Math.round((performance.now() - t0) * 10) / 10]); } return out; }, ALL);
    r.state = await page.evaluate(STATE);
    r.log = log;
    await ctx.close();
    return r;
  };
  report.idle.removed = await idleRun('idle-removed', () => { try { delete window.requestIdleCallback; delete window.cancelIdleCallback; } catch (e) { /* */ } try { window.requestIdleCallback = undefined; window.cancelIdleCallback = undefined; } catch (e) { /* */ } });
  save();
  if (!quick) { report.idle.native = await idleRun('idle-native', null); save(); }

  // ---- setGroup: nothing made ahead, then made ahead -----------------------------------------------------------------
  if (!quick) {
    for (const p of ['paisley', 'soft']) {
      const { ctx, page, log } = await open(browser, url, { viewport: { width: 1280, height: 800 }, dpr: 1, report, name: 'time-' + p });
      const cold = await page.evaluate(([ids, p]) => {
        const F = window.__folding, before = F.getState().warm.made;
        F.warmer.stop();
        if (p !== 'paisley') F.setPattern(p);
        F.warmer.stop();
        const out = [];
        for (const id of ids) { F.warmer.stop(); const t0 = performance.now(); F.setGroup(id); out.push([id, Math.round((performance.now() - t0) * 10) / 10]); }
        F.warmer.stop();
        return { before, out };
      }, [ALL, p]);
      report.time[p] = { cold, log };
      await ctx.close();
      save();
    }
  }
  report.ended = new Date().toISOString();
  save();
  return report;
}
