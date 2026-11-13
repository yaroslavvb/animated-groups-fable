// The page shell in a browser (round 3, ui-layout): the real app (dev/app-demo.html: src/index.template.html,
// src/styles.css, src/app.js) at 23 window sizes x 17 groups. Nothing is cut, hidden, overlapping or under 13 px;
// every tap target is 44 px; the legend shows exactly the group's features (contract C1); the kaleidoscopes show the
// note instead of chips and slider; the hints stay inside their panes (the plane's at the top edge of a phone pane);
// on the iPhone SE under the host bar (375 x 498) the 3D pane is at least 175 px tall for the default group (v1: 151).
// Since 13 Nov 2026 also: the pattern selector (a 44 px target at the right of the header, clear of the chip and the
// caption; its swatch alone on a phone), the title (gone under 370 px, where the selector has its room), the legend's
// "front · back" (with a print, from 360 px up), and the words of a re-cut over the 3D pane.
// THIS TEST IS THE GATE FOR ANY CHANGE TO THE HEADER OR THE LEGEND: the round of 13 Nov shipped without running it, and
// the chip lost a word at 360 px (p3m1 · equilateral…), the caption a line on a phone on its side, the 3D pane 16 px
// at 320 x 518.
//
// OPT-IN: it needs a Chrome (tools/browser.mjs: the pool on the mini, else this Mac), which the remote suite
// (tools/test-all.mjs) does not have. Run it from this Mac:
//     SHELL_LAYOUT=1 node --test test/shell-layout.test.js          (about a minute)
//     SHELL_LAYOUT_PAGE=<page> ...                                    (another page with the same shell ids)
// A size written fWxH is "in the 50 px host frame": the page gets W x (H - 50), exactly what the iframe gives it.
import test from 'node:test';
import assert from 'node:assert/strict';

const SIZES = ['f375x548', 'f390x664', 'f390x780', 'f360x584', 'f412x785', 'f320x568', '320x568', '360x640', '360x820', '390x780',
  '414x896', '667x375', 'f667x375', '640x360', '740x360', '844x390', 'f844x390', '768x1024', '960x540', '1024x768', '1280x720', '1440x900', '1920x1080'];
const parse = (s) => { const f = s.startsWith('f'); const [w, h] = s.replace(/^f/, '').split('x').map(Number); return { name: s, w, h: f ? h - 50 : h }; };

// runs in the page: everything this test asserts about the layout as it stands
const CHECK = ([expectFeatures, print]) => {
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const B = (el) => el.getBoundingClientRect();
  const r1 = (v) => Math.round(v * 10) / 10;
  const shown = (el) => {
    if (!el) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; }
    const b = B(el); return b.width > 0 && b.height > 0;
  };
  const vw = innerWidth, vh = innerHeight, bad = [];
  const within = (a, b, e = 0.5) => a.left >= b.left - e && a.top >= b.top - e && a.right <= b.right + e && a.bottom <= b.bottom + e;
  const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const de = document.documentElement;
  if (de.scrollWidth > vw + 0.5 || de.scrollHeight > vh + 0.5) bad.push(`the page scrolls: ${de.scrollWidth}x${de.scrollHeight}`);
  const app = q('#app'), fold = app.getAttribute('data-fold');
  const win = { left: 0, top: 0, right: vw, bottom: vh };
  // blocks
  const blocks = ['#header', '#caption', '#pane-plane', '#plane-controls', '#pane-fold', '#fold-controls', '#legend'].map((s) => [s, q(s)]).filter(([, e]) => shown(e));
  for (const [s, e] of blocks) if (!within(B(e), win)) bad.push(`${s} leaves the window`);
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const pair = blocks[i][0] + ' ' + blocks[j][0];
    if (pair === '#header #caption') continue;                       // a low landscape window: the caption sits in the header row
    if (overlap(B(blocks[i][1]), B(blocks[j][1]))) bad.push(`${blocks[i][0]} overlaps ${blocks[j][0]}`);
  }
  if (overlap(B(q('#caption')), B(q('#chip'))) || overlap(B(q('#caption')), B(q('.title')))) bad.push('the caption runs into the header');
  // the pattern selector: at the right of the header, clear of the chip and of the caption; one swatch; the native
  // select covers it all (so a tap anywhere on it opens the platform's picker)
  const pat = q('#pattern-box'), pill = q('#pattern-box .pat-pill');
  if (!shown(pat) || !shown(pill)) bad.push('no pattern selector');
  else {
    const pb = B(pat), sb = B(q('#pattern'));
    if (!within(pb, win) || !within(pb, B(q('#header')), 1)) bad.push('the pattern selector leaves the header');
    if (overlap(pb, B(q('#chip')))) bad.push('the pattern selector lies over the chip');
    if (overlap(B(pill), B(q('#caption')))) bad.push('the pattern selector lies over the caption');
    if (B(pill).height < 35.5) bad.push(`the selector's pill is ${r1(B(pill).height)} px high`);
    const sw = qa('#pattern-box .pat-sw').filter(shown);
    if (sw.length !== 1) bad.push(`${sw.length} swatches in the selector`);
    const lab = q('#pattern-label');
    if (shown(lab) && (lab.scrollWidth > lab.clientWidth + 0.5 || !lab.textContent.trim())) bad.push('the pattern\'s name is cut');
    if (shown(lab) !== (vw >= 560 && !(vw > vh && vh < 480))) bad.push(`the pattern's name is ${shown(lab) ? 'shown' : 'hidden'} at ${vw} x ${vh}`);
    if (Math.abs(sb.width - pb.width) > 1 || Math.abs(sb.height - pb.height) > 1) bad.push('the native select does not cover the selector');
    if (parseFloat(getComputedStyle(q('#pattern')).fontSize) < 16) bad.push('the select is under 16 px: iOS zooms the page');
  }
  // the title: there from 370 px up; below, the selector has its room (it stays in the page for a screen reader)
  { const tb = B(q('.title')); if ((tb.width > 2) !== (vw >= 370)) bad.push(`the title is ${tb.width > 2 ? 'shown' : 'hidden'} at ${vw} px`); }
  const pp = B(q('#pane-plane')), pf = B(q('#pane-fold'));
  if (pp.width < 149.5 || pp.height < 149.5) bad.push(`plane pane ${r1(pp.width)}x${r1(pp.height)}`);
  if (pf.width < 149.5 || pf.height < 149.5) bad.push(`fold pane ${r1(pf.width)}x${r1(pf.height)}`);
  // the cut controls
  const presets = q('#presets'), wavy = q('#wavy-field'), note = q('#cut-note');
  if (fold === 'snowflake') {
    if (shown(presets) || shown(wavy)) bad.push('a kaleidoscope shows chips or the Wavy slider');
    if (!shown(note)) bad.push('a kaleidoscope without the cut note');
    else if (note.scrollHeight > note.clientHeight + 1 || note.scrollWidth > note.clientWidth + 1 || !within(B(note), B(q('#plane-controls')))) bad.push('the cut note is cut');
    if (shown(q('#hint'))) bad.push('a kaleidoscope shows a hint over its plane');
  } else {
    if (shown(note)) bad.push('the cut note shows for a group with a cut');
    if (!shown(presets) || !shown(wavy)) bad.push('chips or Wavy missing');
    if (presets.scrollHeight > presets.clientHeight + 1 || presets.scrollWidth > presets.clientWidth + 1) bad.push(`the chips scroll (${presets.scrollWidth}x${presets.scrollHeight} in ${presets.clientWidth}x${presets.clientHeight})`);
    const pb = B(presets);
    for (const c of qa('#presets .chip')) {
      const cb = B(c);
      if (!within(cb, pb) || !within(cb, win)) bad.push(`chip "${c.textContent}" is not all visible`);
      if (c.scrollWidth > c.clientWidth + 0.5) bad.push(`chip "${c.textContent}" is cut (${c.clientWidth} of ${c.scrollWidth})`);
      if (overlap(cb, B(wavy))) bad.push(`chip "${c.textContent}" lies over the Wavy slider`);
    }
  }
  // tap targets
  const taps = [['the orbifold chip', q('#chip')], ['the pattern selector', q('#pattern-box')], ...qa('#presets .chip').map((c) => [`chip "${c.textContent}"`, c]), ['Fold', q('#fold-btn')],
    ['reset view', q('#reset-view')], ['scrubber', q('#scrub')], ['Wavy', q('#wavy-field .scrub')], ['companion link', q('.companion a')]].filter(([, e]) => shown(e));
  for (const [n, e] of taps) { const b = B(e); if (b.width < 43.5 || b.height < 43.5) bad.push(`tap target ${n} ${r1(b.width)}x${r1(b.height)}`); if (!within(b, win)) bad.push(`tap target ${n} leaves the window`); }
  const link = B(q('.companion a'));
  for (const s of ['#fold-btn', '#reset-view', '#scrub', '#wavy-field .scrub', '#presets']) { const e = q(s); if (shown(e) && overlap(link, B(e))) bad.push(`the companion link's box lies over ${s}`); }
  // text
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.trim(); if (!t || !shown(n.parentElement)) continue;
    if (n.parentElement.closest('.title') && vw < 370) continue;    // (the title under 370 px: one clipped pixel, for a screen reader)
    if (n.parentElement.closest('select')) continue;                // (the options of the native select: the platform draws them)
    const fs = parseFloat(getComputedStyle(n.parentElement).fontSize); if (fs < 13) bad.push(`"${t.slice(0, 24)}" is ${fs} px`);
  }
  for (const s of ['#caption', '#chip-meta']) { const e = q(s); if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) bad.push(`${s} "${e.textContent}" is cut`); }
  // legend (contract C1)
  // (the paper's two sides come first, with a print and from 360 px up: one line of the legend is all a 320 px phone has)
  const allItems = qa('#legend .lg').filter(shown), paper = allItems.filter((e) => e.hasAttribute('data-paper'));
  const items = allItems.filter((e) => !e.hasAttribute('data-paper'));
  const got = items.map((e) => e.getAttribute('data-feature')).join(' ');
  if (got !== expectFeatures) bad.push(`legend shows "${got}", the group has "${expectFeatures}" (#app data-features "${app.getAttribute('data-features')}")`);
  if (paper.length !== (print && vw >= 360 ? 1 : 0)) bad.push(`legend: ${paper.length} "front · back" items (pattern ${app.getAttribute('data-pattern')}, ${vw} px)`);
  if (paper.length && allItems[0] !== paper[0]) bad.push('legend: the paper is not the first item');
  if (app.getAttribute('data-pattern') !== (print ? print : 'comma')) bad.push(`#app data-pattern is "${app.getAttribute('data-pattern')}"`);
  const lgBox = B(q('#legend'));
  const rects = allItems.map((e) => [e.getAttribute('data-feature') || 'paper', B(e)]);
  { const rg = document.createRange(); rg.selectNodeContents(q('.companion a')); rects.push(['link', rg.getBoundingClientRect()]); }
  for (let i = 0; i < rects.length; i++) {
    if (!within(rects[i][1], lgBox)) bad.push(`legend: ${rects[i][0]} outside the legend`);
    for (let j = i + 1; j < rects.length; j++) if (overlap(rects[i][1], rects[j][1])) bad.push(`legend: ${rects[i][0]} overlaps ${rects[j][0]}`);
  }
  for (const e of allItems) if (e.scrollWidth > e.clientWidth + 0.5) bad.push(`legend item ${e.getAttribute('data-feature') || 'paper'} is cut`);
  // hints
  const hint = q('#hint');
  if (shown(hint)) {
    const hb = B(hint);
    if (!within(hb, pp)) bad.push('the plane hint is wider than its pane');
    if ((pp.width < 360 || pp.height < 360) && hb.top + hb.height / 2 > pp.top + pp.height / 2) bad.push('the plane hint is not at the top of a small pane');
    const cs = getComputedStyle(hint), px = (k) => parseFloat(cs[k]) || 0;
    const lines = (hb.height - px('paddingTop') - px('paddingBottom') - px('borderTopWidth') - px('borderBottomWidth')) / px('lineHeight');
    if (lines > 1.5) bad.push(`the plane hint wraps (${r1(lines)} lines)`);
  }
  const th = q('#turn-hint');
  if (shown(th)) { const tb = B(th); if (!within(tb, pf) || tb.right > pf.left + pf.width / 2 || tb.bottom > pf.top + pf.height / 2) bad.push('the turn hint is not in the top-left of the fold pane'); }
  return { bad, fold: [r1(pf.width), r1(pf.height)], plane: [r1(pp.width), r1(pp.height)] };
};

test('layout: 23 window sizes x 17 groups — nothing cut, hidden, overlapping or under 13 px; the C1 legend, note and hints',
  { skip: process.env.SHELL_LAYOUT === '1' ? false : 'opt-in: SHELL_LAYOUT=1 (needs a Chrome, see the top of the file)', timeout: 600000 }, async () => {
    const { openBrowser } = await import('../tools/browser.mjs');
    const { GROUPS } = await import('../src/groups.js');
    const { groupFeatures } = await import('../src/app.js');
    const B = await openBrowser({ quiet: true });
    const failures = [], errors = [], foldAt375 = {};
    try {
      const page = await (await B.browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(B.url((process.env.SHELL_LAYOUT_PAGE || 'dev/app-demo.html') + '#333'), { waitUntil: 'load' });
      await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
      await page.evaluate(() => window.__folding.ready);
      for (const s of SIZES.map(parse)) {
        await page.setViewportSize({ width: s.w, height: s.h });
        await page.waitForTimeout(150);
        for (const g of GROUPS) {
          await page.evaluate((id) => { window.__folding.setGroup(id); window.__folding.setT(0); }, g.id);
          await page.waitForTimeout(40);
          const r = await page.evaluate(CHECK, [groupFeatures(g).join(' '), 'checker']);
          for (const b of r.bad) failures.push(`${s.name} ${g.id}: ${b}`);
          if (s.name === 'f375x548') foldAt375[g.id] = r.fold[1];
        }
      }
      // the other patterns, at a phone, a phone on its side and a laptop: Rings is a print too; the Comma has no paper
      // to explain (no "front · back"), and nothing else moves
      for (const s of ['f360x584', 'f320x568', '667x375', '1280x720'].map(parse)) {
        await page.setViewportSize({ width: s.w, height: s.h });
        await page.waitForTimeout(150);
        for (const pattern of ['rings', 'comma']) {
          for (const g of GROUPS) {
            await page.evaluate(([id, p]) => { window.__folding.setGroup(id); window.__folding.setPattern(p); window.__folding.setT(0); }, [g.id, pattern]);
            await page.waitForTimeout(40);
            const r = await page.evaluate(CHECK, [groupFeatures(g).join(' '), pattern === 'comma' ? '' : pattern]);
            for (const b of r.bad) failures.push(`${s.name} ${g.id} ${pattern}: ${b}`);
          }
        }
        await page.evaluate(() => window.__folding.setPattern('checker'));
      }
      // the words of a re-cut (xx Hexagon, 22x Hexagon): over the 3D pane, at its foot, on one line, inside the pane,
      // clear of "drag to turn" — on the flat tile (what Fold will do first), while a piece is carried, while the home
      // tile folds; none for the home tile itself
      const WORDS = (want) => {
            const q = (s) => document.querySelector(s), B = (el) => el.getBoundingClientRect(), bad = [];
            const c = q('#fold-caption'), pf = B(q('#pane-fold')), st = window.__folding.getState();
            if (!c || c.hidden || getComputedStyle(c).display === 'none') return [`no words over the fold pane (state: ${JSON.stringify(st.foldCaption)})`];
            const cb = B(c), cs = getComputedStyle(c);
            if (!new RegExp(want).test(c.textContent)) bad.push(`the words are "${c.textContent}"`);
            if (cb.left < pf.left - 0.5 || cb.right > pf.right + 0.5 || cb.top < pf.top - 0.5 || cb.bottom > pf.bottom + 0.5) bad.push('the words leave the fold pane');
            if (cb.top + cb.height / 2 < pf.top + pf.height / 2) bad.push('the words are not at the foot of the fold pane');
            if (cb.height > 27) bad.push(`the words wrap (${cb.height} px high)`);
            if (c.scrollWidth > c.clientWidth + 0.5) bad.push('the words are cut');
            // a small pane: the words have a strip of their own and the picture ends above it (over the picture they
            // covered the lower end of a tall tile); a large one: the picture fills the pane, the words lie over its foot
            const cv = B(q('#fold-canvas')), lb = B(q('#fold-labels')), small = pf.height <= 451 || pf.width <= 451;
            if (small ? cv.bottom > cb.top + 0.5 : cv.bottom < pf.bottom - 2) bad.push(`the picture ends ${Math.round(cb.top - cv.bottom)} px above the words on a ${Math.round(pf.width)} x ${Math.round(pf.height)} pane`);
            if (small && pf.bottom - cv.bottom > 28) bad.push(`the strip of the words is ${Math.round(pf.bottom - cv.bottom)} px high`);
            if (Math.abs(lb.left - cv.left) > 0.5 || Math.abs(lb.top - cv.top) > 0.5 || Math.abs(lb.right - cv.right) > 0.5 || Math.abs(lb.bottom - cv.bottom) > 0.5) bad.push('the labels\' layer is not the canvas\'s box');
            const gl = q('#fold-canvas');
            if (Math.abs(gl.width / gl.height - cv.width / cv.height) > 0.02) bad.push(`the canvas is drawn ${gl.width} x ${gl.height} in a box of ${Math.round(cv.width)} x ${Math.round(cv.height)}`);
            if (parseFloat(cs.fontSize) < 13) bad.push(`the words are ${cs.fontSize}`);
            const th = q('#turn-hint');
            if (th && getComputedStyle(th).display !== 'none') { const tb = B(th); if (Math.min(cb.right, tb.right) - Math.max(cb.left, tb.left) > 1 && Math.min(cb.bottom, tb.bottom) - Math.max(cb.top, tb.top) > 1) bad.push('the words lie over "drag to turn"'); }
            const de = document.documentElement;
            if (de.scrollWidth > innerWidth + 0.5 || de.scrollHeight > innerHeight + 0.5) bad.push('the page scrolls');
            return bad;
      };
      for (const s of ['f375x548', 'f360x584', 'f320x568', '667x375', '844x390', '768x1024', '1280x720'].map(parse)) {
        await page.setViewportSize({ width: s.w, height: s.h });
        await page.waitForTimeout(150);
        for (const [id, preset] of [['xx', 1], ['22x', 2]]) {
          await page.evaluate(([id, preset]) => { const F = window.__folding; F.setGroup(id); F.setPreset(preset); F.setT(0); }, [id, preset]);
          await page.waitForTimeout(80);
          const foldFrom = await page.evaluate(() => window.__folding.getState().recut.tau0);
          for (const [t, want] of [[0, '^(Fold re-cuts the tile|re-cut) into the \\w+'], [0.12, '^re-cut(,| \\d)'], [foldFrom + 0.04, '^(the )?\\w+ folds: ']]) {
            await page.evaluate((t) => window.__folding.setT(t), t);
            await page.waitForTimeout(60);
            for (const b of await page.evaluate(WORDS, want)) failures.push(`${s.name} ${id} t = ${(+t).toFixed(2)}: ${b}`);
          }
          // closed: the words are gone, the picture keeps its size (the strip stays)
          const boxOf = () => { const b = document.querySelector('#fold-canvas').getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)].join('x'); };
          const during = await page.evaluate(boxOf);
          await page.evaluate(() => window.__folding.setT(1));
          await page.waitForTimeout(60);
          const closed = await page.evaluate(boxOf);
          if (closed !== during) failures.push(`${s.name} ${id}: the picture is ${during} while it folds and ${closed} when closed`);
          if (await page.evaluate(() => { const c = document.querySelector('#fold-caption'); return !!c && !c.hidden; })) failures.push(`${s.name} ${id}: words on the closed shape`);
          await page.evaluate(() => { const F = window.__folding; F.setT(0); F.setPreset(0); });
          await page.waitForTimeout(60);
          if (await page.evaluate(() => { const c = document.querySelector('#fold-caption'); return !!c && !c.hidden && getComputedStyle(c).display !== 'none'; })) failures.push(`${s.name} ${id}: the home tile shows a re-cut's words`);
          // the home tile has no strip: its picture fills the pane
          if (await page.evaluate(() => { const c = document.querySelector('#fold-canvas').getBoundingClientRect(), p = document.querySelector('#pane-fold').getBoundingClientRect(); return p.bottom - c.bottom > 2; })) failures.push(`${s.name} ${id}: the home tile's picture does not fill its pane`);
        }
      }
    } finally { await B.close(); }
    console.log('fold pane height at 375 x 498 (the iPhone SE under the host bar):', JSON.stringify(foldAt375));
    assert.deepEqual(errors, [], 'no page or console error');
    assert.deepEqual(failures, [], failures.length + ' problems');
    assert.ok(foldAt375['333'] >= 175, `the default group's 3D pane at 375 x 498 is ${foldAt375['333']} px tall (v1: 151; finding 9)`);
    for (const [id, h] of Object.entries(foldAt375)) assert.ok(h >= 150, `${id}: 3D pane ${h} px tall at 375 x 498`);
  });
