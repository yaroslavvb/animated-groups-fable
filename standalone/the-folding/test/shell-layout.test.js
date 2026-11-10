// The page shell in a browser (round 3, ui-layout): the real app (dev/app-demo.html: src/index.template.html,
// src/styles.css, src/app.js) at 23 window sizes x 17 groups. Nothing is cut, hidden, overlapping or under 13 px;
// every tap target is 44 px; the legend shows exactly the group's features (contract C1); the kaleidoscopes show the
// note instead of chips and slider; the hints stay inside their panes (the plane's at the top edge of a phone pane);
// on the iPhone SE under the host bar (375 x 498) the 3D pane is at least 175 px tall for the default group (v1: 151).
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
const CHECK = (expectFeatures) => {
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
  const taps = [['the orbifold chip', q('#chip')], ...qa('#presets .chip').map((c) => [`chip "${c.textContent}"`, c]), ['Fold', q('#fold-btn')],
    ['reset view', q('#reset-view')], ['scrubber', q('#scrub')], ['Wavy', q('#wavy-field .scrub')], ['companion link', q('.companion a')]].filter(([, e]) => shown(e));
  for (const [n, e] of taps) { const b = B(e); if (b.width < 43.5 || b.height < 43.5) bad.push(`tap target ${n} ${r1(b.width)}x${r1(b.height)}`); if (!within(b, win)) bad.push(`tap target ${n} leaves the window`); }
  const link = B(q('.companion a'));
  for (const s of ['#fold-btn', '#reset-view', '#scrub', '#wavy-field .scrub', '#presets']) { const e = q(s); if (shown(e) && overlap(link, B(e))) bad.push(`the companion link's box lies over ${s}`); }
  // text
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.trim(); if (!t || !shown(n.parentElement)) continue;
    const fs = parseFloat(getComputedStyle(n.parentElement).fontSize); if (fs < 13) bad.push(`"${t.slice(0, 24)}" is ${fs} px`);
  }
  for (const s of ['#caption', '#chip-meta']) { const e = q(s); if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) bad.push(`${s} "${e.textContent}" is cut`); }
  // legend (contract C1)
  const items = qa('#legend .lg').filter(shown);
  const got = items.map((e) => e.getAttribute('data-feature')).join(' ');
  if (got !== expectFeatures) bad.push(`legend shows "${got}", the group has "${expectFeatures}" (#app data-features "${app.getAttribute('data-features')}")`);
  const lgBox = B(q('#legend'));
  const rects = items.map((e) => [e.getAttribute('data-feature'), B(e)]);
  { const rg = document.createRange(); rg.selectNodeContents(q('.companion a')); rects.push(['link', rg.getBoundingClientRect()]); }
  for (let i = 0; i < rects.length; i++) {
    if (!within(rects[i][1], lgBox)) bad.push(`legend: ${rects[i][0]} outside the legend`);
    for (let j = i + 1; j < rects.length; j++) if (overlap(rects[i][1], rects[j][1])) bad.push(`legend: ${rects[i][0]} overlaps ${rects[j][0]}`);
  }
  for (const e of items) if (e.scrollWidth > e.clientWidth + 0.5) bad.push(`legend item ${e.getAttribute('data-feature')} is cut`);
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
          const r = await page.evaluate(CHECK, groupFeatures(g).join(' '));
          for (const b of r.bad) failures.push(`${s.name} ${g.id}: ${b}`);
          if (s.name === 'f375x548') foldAt375[g.id] = r.fold[1];
        }
      }
    } finally { await B.close(); }
    console.log('fold pane height at 375 x 498 (the iPhone SE under the host bar):', JSON.stringify(foldAt375));
    assert.deepEqual(errors, [], 'no page or console error');
    assert.deepEqual(failures, [], failures.length + ' problems');
    assert.ok(foldAt375['333'] >= 175, `the default group's 3D pane at 375 x 498 is ${foldAt375['333']} px tall (v1: 151; finding 9)`);
    for (const [id, h] of Object.entries(foldAt375)) assert.ok(h >= 150, `${id}: 3D pane ${h} px tall at 375 x 498`);
  });
