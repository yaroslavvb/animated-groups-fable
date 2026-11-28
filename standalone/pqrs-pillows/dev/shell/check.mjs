#!/usr/bin/env node
// check.mjs — the shell owner's own browser check of a build (default dev/shell/index.html).
//   node dev/shell/check.mjs [file.html] [--shots]
// Layout at 1280x900, 1024x700 and 390x844 (phone), no console error, the presets on WebGL, the typed field, a refusal
// that moves nothing, the stillness of the Pattern pane's print under an activation, and a Twist drag with a real
// pointer that moves all three cards.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const PW = process.env.PLAYWRIGHT_MJS || `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2), file = resolve(args.find((a) => !a.startsWith('--')) || resolve(here, 'index.html')), shots = args.includes('--shots');
const url = pathToFileURL(file).href;
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const ok = (cond, what, extra = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!cond) fails++; };
const diffOf = (a, b) => { let cmp = 0, ch = 0; for (let i = 0; i < a.length; i++) { if (a[i] === 'o' || b[i] === 'o') continue; cmp++; if (a[i] !== b[i]) ch++; } return { cmp, ch }; };
try {
  for (const [name, w, h, phone] of [['desk', 1280, 900, false], ['small', 1024, 700, false], ['phone', 390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    console.log(`--- ${name} ${w}x${h}`);
    const lay = await page.evaluate(() => {
      const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      const small = [];
      for (const e of document.querySelectorAll('button, input, .pq-card-head')) {
        if (e.closest('[hidden]') || e.hidden) continue;
        const b = e.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        if (b.height < 43.5 || b.width < 43.5) small.push(`${e.id || e.className || e.tagName}:${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      const wide = [];
      for (const e of document.querySelectorAll('body *')) { const b = e.getBoundingClientRect(); if (b.right > window.innerWidth + 0.5 && b.width > 0 && !e.closest('.pq-table-scroll') && !e.closest('[hidden]')) wide.push(`${e.id || e.className || e.tagName}:${Math.round(b.right)}`); }
      return {
        sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight,
        pane2: r('pane2'), pane: r('pane'), pattern: r('pattern'), view: r('view'), journey: r('journey'), cards: r('cards'), pillows: r('pillows'),
        cardRects: Array.from(document.querySelectorAll('.pq-card')).map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }),
        fieldFont: getComputedStyle(document.getElementById('sig-in')).fontSize, small, wide: wide.slice(0, 8),
        gl: window.__pqrs.pattern.state().gl, surf: window.__pqrs.surface(),
      };
    });
    console.log(JSON.stringify(lay));
    ok(lay.sw <= lay.iw, 'nothing wider than the screen', `scrollWidth ${lay.sw} of ${lay.iw}; beyond: ${lay.wide.join(' ')}`);
    ok(lay.pane2[1] === lay.pane[1] && lay.pane[0] > lay.pane2[0] + lay.pane2[2] - 1, 'the two panes side by side', `${lay.pane2} | ${lay.pane}`);
    ok(Math.abs(lay.pane2[2] - lay.pane[2]) <= 1, 'the two panes equally wide');
    ok(lay.small.length === 0, 'tap targets 44 px', lay.small.join(' '));
    ok(lay.fieldFont === '16px', 'field text 16 px', lay.fieldFont);
    ok(lay.gl === true, '3333 on WebGL');
    if (shots) await page.screenshot({ path: resolve(here, `check-${name}.png`), fullPage: true });

    if (name === 'desk') {
      // presets stay on the WebGL path (2222 is the plane: canvas 2D by design)
      for (const sig of ['2222', '3333', '2223', '2345', '4444']) {
        await page.click(`.chip[data-sig="${sig}"]`);
        await page.waitForTimeout(250);
        const st = await page.evaluate(() => ({ k: window.__pqrs.state().k, gl: window.__pqrs.pattern.state().gl, hash: window.__pqrs.state().hash, shown: window.__pqrs.shown().map((c) => `${c.label} ${c.LText} ${c.twText}${c.active ? '*' : ''}`), loc: location.hash }));
        ok(st.k === sig && (sig === '2222' ? st.gl === false : st.gl === true), `preset ${sig}: ${sig === '2222' ? 'plane, 2D' : 'WebGL'}`, `${st.hash}  ${st.shown.join(' ; ')}`);
        // every card of every preset activates with the print still
        for (const key of ['02|13', '03|12', '01|23']) {
          const before = await page.evaluate(() => window.__pqrs.patternGrid(48, 0.6));
          const done = await page.evaluate((k) => window.__pqrs.activate(k), key);
          const after = await page.evaluate(() => ({ g: window.__pqrs.patternGrid(48, 0.6), gl: window.__pqrs.pattern.state().gl, key: window.__pqrs.state().key }));
          const d = diffOf(before, after.g);
          ok(done && after.key === key && d.ch <= 0.005 * d.cmp && (sig === '2222' || after.gl), `  ${sig} activate ${key}: print still`, `${d.ch} of ${d.cmp} nodes changed tone`);
        }
        if (shots) await page.screenshot({ path: resolve(here, `check-preset-${sig}.png`) });
      }
      // the typed field
      await page.click('.chip[data-sig="3333"]');
      await page.fill('#sig-in', '2346');
      await page.waitForTimeout(250);
      let st = await page.evaluate(() => ({ k: window.__pqrs.state().k, on: document.getElementById('sig-in').dataset.on, gl: window.__pqrs.pattern.state().gl, labels: window.__pqrs.shown().map((c) => c.label) }));
      ok(st.k === '2346' && st.on === '1' && st.gl, 'typed 2346 is shown', JSON.stringify(st));
      const top0 = await page.evaluate(() => document.getElementById('pane2').getBoundingClientRect().top);
      await page.fill('#sig-in', '2a46');
      await page.waitForTimeout(150);
      st = await page.evaluate(() => ({ k: window.__pqrs.state().k, pop: !document.getElementById('sig-pop').hidden, text: document.getElementById('sig-pop').textContent, top: document.getElementById('pane2').getBoundingClientRect().top }));
      ok(st.k === '2346' && st.pop && st.top === top0, 'a refusal is one line and moves nothing', JSON.stringify(st));
      await page.fill('#sig-in', '23456');
      await page.waitForTimeout(100);
      st = await page.evaluate(() => ({ k: window.__pqrs.state().k, pop: !document.getElementById('sig-pop').hidden }));
      ok(st.k === '2346' && st.pop, 'five orders are refused');
      await page.fill('#sig-in', '');
      await page.click('.chip[data-sig="3333"]');
      await page.waitForTimeout(200);
    }

    // ---- 3333: slide the pattern, then activate each card: no pixel of the print moves
    const pat = await page.evaluate(() => { const b = document.getElementById('pattern').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    await page.mouse.move(pat.x + pat.w * 0.5, pat.y + pat.h * 0.5);
    await page.mouse.down();
    await page.mouse.move(pat.x + pat.w * 0.62, pat.y + pat.h * 0.57, { steps: 6 });
    await page.mouse.up();
    // the pattern coasts after a release: wait until its view rests
    for (let i = 0, last = ''; i < 40; i++) { await page.waitForTimeout(120); const v = await page.evaluate(() => JSON.stringify(window.__pqrs.pattern.getView().V)); if (v === last) break; last = v; }
    const slid = await page.evaluate(() => window.__pqrs.pattern.getView().V.map((x) => Number(x.toFixed(3))));
    console.log(`     the pattern was slid: V = ${JSON.stringify(slid)}`);
    for (const key of ['02|13', '03|12', '01|23', '03|12', '02|13', '01|23']) {
      const before = await page.evaluate(() => { const im = window.__pqrs.patternPixels(); return { g: window.__pqrs.patternGrid(64, 0.7), px: Array.from(im.data), w: im.width, h: im.height }; });
      // a real click on the card's header
      await page.click(`.pq-card[data-key="${key}"] .pq-card-head`);
      const after = await page.evaluate(() => ({ g: window.__pqrs.patternGrid(64, 0.7), px: Array.from(window.__pqrs.patternPixels().data), key: window.__pqrs.state().key, active: Array.from(document.querySelectorAll('.pq-card')).map((e) => e.dataset.active).join(','), st: window.__pqrs.state(), surf: window.__pqrs.surface() }));
      const d = diffOf(before.g, after.g);
      // every pixel of the pane whose tone is print (paper or comma) both before and after: how many differ at all
      let both = 0, moved = 0, any = 0, worst = 0, over8 = 0;
      const tone = (px, i) => { const near = (c) => Math.abs(px[i] - c[0]) + Math.abs(px[i + 1] - c[1]) + Math.abs(px[i + 2] - c[2]) < 24; return near([154, 213, 204]) ? 1 : near([79, 163, 151]) ? 2 : 0; };
      for (let i = 0; i < before.px.length; i += 4) { const a = tone(before.px, i), b = tone(after.px, i); if (a && b) { both++; if (a !== b) moved++; const dv = Math.max(Math.abs(before.px[i] - after.px[i]), Math.abs(before.px[i + 1] - after.px[i + 1]), Math.abs(before.px[i + 2] - after.px[i + 2])); if (dv) any++; if (dv > 8) over8++; if (dv > worst) worst = dv; } }
      // the same away from everything that is not print (lines, marks, the rim: they change by design, and their
      // antialiased fringes still read as print): pixels at least 3 px from any pixel that is not print in either picture
      const W = before.w, H = before.h, not = new Uint8Array(W * H);
      for (let i = 0, q = 0; i < before.px.length; i += 4, q++) if (!tone(before.px, i) || !tone(after.px, i)) not[q] = 1;
      let inner = 0, innerAny = 0, innerOver8 = 0, innerWorst = 0, innerTone = 0;
      for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
        let clear = true;
        for (let dy = -2; dy <= 2 && clear; dy++) for (let dx = -2; dx <= 2; dx++) if (not[(y + dy) * W + x + dx]) { clear = false; break; }
        if (!clear) continue;
        const i = 4 * (y * W + x), dv = Math.max(Math.abs(before.px[i] - after.px[i]), Math.abs(before.px[i + 1] - after.px[i + 1]), Math.abs(before.px[i + 2] - after.px[i + 2]));
        inner++; if (dv) innerAny++; if (dv > 8) innerOver8++; if (dv > innerWorst) innerWorst = dv; if (tone(before.px, i) !== tone(after.px, i)) innerTone++;
      }
      console.log(`     away from lines and marks (3 px): ${innerTone} of ${inner} print pixels changed tone, ${innerAny} changed value at all (${innerOver8} by more than 8 of 255, worst ${innerWorst})`);
      ok(after.key === key && d.ch === 0, `3333 click card ${key}: print still`, `grid ${d.ch} of ${d.cmp} changed; all pixels: ${moved} of ${both} print pixels changed tone, ${any} changed value at all (${over8} by more than 8 of 255, worst ${worst}); surface fails ${after.surf.fails}${after.surf.error ? ' ' + after.surf.error : ''}; active ${after.active}; L ${after.st.L.toFixed(4)} tw ${after.st.tw.toFixed(4)}`);
    }

    // ---- a Twist drag on the active card, with a real pointer: all three cards move
    const tw = await page.evaluate(() => { const e = document.querySelector('.pq-card[data-active="true"] .pq-srow:nth-of-type(2) input') || document.querySelectorAll('.pq-card[data-active="true"] input')[1]; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    const read = () => page.evaluate(() => window.__pqrs.shown().map((c) => ({ key: c.key, L: c.L, tw: c.tw, active: c.active })));
    const c0 = await read();
    if (phone) {
      await page.evaluate(() => { const e = document.querySelectorAll('.pq-card[data-active="true"] input')[1]; e.value = String(parseFloat(e.value) + 0.1); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    } else {
      await page.mouse.move(tw.x + tw.w * 0.5, tw.y + tw.h / 2);
      await page.mouse.down();
      await page.mouse.move(tw.x + tw.w * 0.62, tw.y + tw.h / 2, { steps: 8 });
      await page.mouse.up();
    }
    await page.waitForTimeout(300);
    const c1 = await read();
    const movedCards = c1.filter((c, i) => Math.abs(c.tw - c0[i].tw) > 1e-4 || Math.abs(c.L - c0[i].L) > 1e-4).length;
    ok(movedCards === 3, 'a Twist drag moves all three cards', c0.map((c, i) => `${c.key}: L ${c.L.toFixed(3)}→${c1[i].L.toFixed(3)} tw ${c.tw.toFixed(3)}→${c1[i].tw.toFixed(3)}`).join(' ; '));

    // ---- a slider of an inactive card is grabbed at once
    if (!phone) {
      const other = await page.evaluate(() => { const card = document.querySelector('.pq-card[data-active="false"]'); const e = card.querySelectorAll('input')[1]; const b = e.getBoundingClientRect(); return { key: card.dataset.key, x: b.left, y: b.top, w: b.width, h: b.height, v: (parseFloat(e.value) - parseFloat(e.min)) / (parseFloat(e.max) - parseFloat(e.min)) }; });
      const g0 = await page.evaluate(() => window.__pqrs.patternGrid(48, 0.6));
      const x0 = other.x + 11 + (other.w - 22) * other.v;
      await page.mouse.move(x0, other.y + other.h / 2);
      await page.mouse.down();
      const mid = await page.evaluate(() => ({ key: window.__pqrs.state().key, g: window.__pqrs.patternGrid(48, 0.6) }));
      const dm = diffOf(g0, mid.g);
      ok(mid.key === other.key && dm.ch <= 0.005 * dm.cmp, 'pointerdown on an inactive slider activates its card, the print still', `${dm.ch} of ${dm.cmp}`);
      await page.mouse.move(x0 + 30, other.y + other.h / 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      const c2 = await read();
      const mine = c2.find((c) => c.key === other.key), was = c1.find((c) => c.key === other.key);
      ok(mine.active && Math.abs(mine.tw - was.tw) > 0.02, 'and the same gesture drags it', `tw ${was.tw.toFixed(3)} → ${mine.tw.toFixed(3)}`);
    }
    // ---- keyboard arrows on a slider
    await page.evaluate(() => document.querySelectorAll('.pq-card[data-active="true"] input')[1].focus());
    const k0 = await read();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
    const k1 = await read();
    const ka = k0.findIndex((c) => c.active);
    ok(Math.abs(k1[ka].tw - k0[ka].tw - 0.01) < 1e-9 || k0[ka].tw > 0.49, 'ArrowRight moves the Twist by 0.01', `${k0[ka].tw.toFixed(3)} → ${k1[ka].tw.toFixed(3)}`);

    // ---- what a step costs here (script time of one apply, drawn at once)
    const cost = await page.evaluate(() => {
      const q = window.__pqrs, t = (f) => { const a = performance.now(); f(); return performance.now() - a; };
      const tw0 = q.state().tw, steps = [];
      for (let i = 0; i < 12; i++) steps.push(t(() => q.set({ tw: Math.max(-0.5, Math.min(0.5, tw0 + 0.004 * (i + 1))) }, { dragging: true })));
      q.set({ tw: tw0 });
      const key0 = q.state().key, other = q.cards().find((c) => !c.active).key;
      const flipMs = t(() => q.activate(other)), backMs = t(() => q.activate(key0));
      steps.sort((a, b) => a - b);
      return { stepMedian: steps[6], stepMax: steps[11], flipMs, backMs, surf: q.surface() };
    });
    console.log(`     cost: a slider step ${cost.stepMedian.toFixed(1)} ms (median of 12, worst ${cost.stepMax.toFixed(1)}), an activation ${cost.flipMs.toFixed(1)} ms and back ${cost.backMs.toFixed(1)} ms; surface on ${cost.surf.on}, fails ${cost.surf.fails}, stretch ${cost.surf.stats ? (100 * cost.surf.stats.strainMean).toFixed(2) + ' %' : 'n/a'}, bake ${cost.surf.bakeMs.toFixed(1)} ms`);

    // ---- the journey row and the tabs
    await page.click('#j-right');
    await page.waitForTimeout(1700);
    let j = await page.evaluate(() => ({ j: window.__pqrs.state().ui.j, l: document.getElementById('j-left').textContent, r: document.getElementById('j-right').textContent, hash: window.__pqrs.state().hash }));
    ok(Math.abs(j.j - 1) < 1e-6 && j.l === 'Join' && j.r === 'Unzip', 'Part goes to "two pillows"', JSON.stringify(j));
    await page.click('#j-right');
    await page.waitForTimeout(1700);
    j = await page.evaluate(() => ({ j: window.__pqrs.state().ui.j, l: document.getElementById('j-left').textContent, r: document.getElementById('j-right').textContent, dis: document.getElementById('j-right').disabled, hash: window.__pqrs.state().hash }));
    ok(Math.abs(j.j - 2) < 1e-6 && j.l === 'Zip' && j.dis, 'Unzip goes to "open crowns"', JSON.stringify(j));
    await page.click('#j-left'); await page.waitForTimeout(1700); await page.click('#j-left'); await page.waitForTimeout(1700);
    j = await page.evaluate(() => window.__pqrs.state().ui.j);
    ok(Math.abs(j) < 1e-6, 'Zip, Join return to the surface');
    await page.click('.tab2[data-tab="tutorial"]');
    let t = await page.evaluate(() => ({ play: document.getElementById('play').hidden, tut: document.getElementById('tutorial').hidden, sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    ok(t.play && !t.tut && t.sw <= t.iw, 'Tutorial tab shows, nothing wider than the screen');
    await page.click('.tab2[data-tab="play"]');
    await page.waitForTimeout(150);
    t = await page.evaluate(() => ({ play: document.getElementById('play').hidden, g: window.__pqrs.patternGrid(16, 0.5) }));
    ok(!t.play && /[pi]/.test(t.g), 'back on Play the pattern is drawn');

    // ---- the address restores the state
    const addr = await page.evaluate(() => ({ hash: window.__pqrs.state().hash, loc: location.hash, st: window.__pqrs.state(), shown: window.__pqrs.shown() }));
    const p2 = await ctx.newPage();
    await p2.goto(url + addr.hash, { waitUntil: 'load' });
    await p2.waitForTimeout(500);
    const back = await p2.evaluate(() => ({ st: window.__pqrs.state(), shown: window.__pqrs.shown() }));
    const same = back.st.k === addr.st.k && back.st.perm.join('') === addr.st.perm.join('') && Math.abs(back.st.L - addr.st.L) < 6e-4 && Math.abs(back.st.tw - addr.st.tw) < 6e-5
      && back.shown.every((c, i) => c.key === addr.shown[i].key && c.active === addr.shown[i].active && Math.abs(c.L - addr.shown[i].L) < 5e-3 && Math.abs(c.tw - addr.shown[i].tw) < 5e-3);
    ok(same && addr.loc === addr.hash, 'the address restores the state and all three cards', `${addr.hash}`);
    await p2.close();
    ok(errors.length === 0, 'no console or page error', errors.slice(0, 4).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
