// test/shell-layout.lib.js — the layout checks of the page shell, for any Playwright page that shows the app: Chrome
// (test/shell-layout.test.js, the gate) and WebKit, Safari's engine (dev/recut/webkit-layout.mjs, run on the M5). No
// import: the WebKit runner copies this one file next to the built page.
//   sweep(page, cases, { quick }?) -> { failures: [text], foldAt375: { id: px }, opened: key, seconds }
//       cases: [{ id, features }] for the 17 groups (features = groupFeatures(group).join(' '))
//       opened: the pattern the page showed at load (its default)
//       quick: the patterns other than the default at 4 sizes only (as before 14 Nov), not at all 23
//   NOSCRIPT(want) -> [text]   in a page of the template and the stylesheet with no script: the pill shows the default
// The page must already show the app (window.__folding.ready). A size written fWxH is "in the 50 px host frame": the
// page gets W x (H - 50), exactly what the spacesheep viewer's iframe gives it.
//
// 14 Nov 2026 (the pattern round: Paisley, Soft commas, Tomoe): EVERY pattern of the selector at every size, for every
// group — the page's default first (the full check, as before), then each other pattern. Per pattern: #app[data-pattern],
// the select and the pill's name say it; exactly one swatch shows, ITS swatch (.pat-sw-<key>, 18 x 18 in the pill),
// in the print's two tones under a print; the name fits its pill uncut and shows from 560 px (not in a low landscape
// window), the word "Pattern" from 720 px; the print is of the kind the pattern has (a design that fails for a group
// shows the comma instead: caught); #app[data-print] is that kind; the legend's "front · back" shows under every
// print from 360 px and under no print. The selector lists PATTERNS in order, each with a swatch.

export const SIZES = ['f375x548', 'f390x664', 'f390x780', 'f360x584', 'f412x785', 'f320x568', '320x568', '360x640', '360x820', '390x780',
  '414x896', '667x375', 'f667x375', '640x360', '740x360', '844x390', 'f844x390', '768x1024', '960x540', '1024x768', '1280x720', '1440x900', '1920x1080'];
export const parse = (s) => { const f = s.startsWith('f'); const [w, h] = s.replace(/^f/, '').split('x').map(Number); return { name: s, w, h: f ? h - 50 : h }; };

// The selector's patterns, in its order (14 Nov 2026), with the kinds of print each may show (src/app.js sets
// #app[data-print] to it). Rings: rings round the centres of rotation, stripes (linear) for a group without rotations.
// The Comma is a shape print since 14 Nov (src/patterns/comma.js; the owner, 13 Nov: "reuse the two different shades
// from "checkerboard" pattern for all patterns"): a group where it falls back to the sheet is a failure, as for the
// other three (the review of 15 Nov: the gate took the Comma with no print at all).
export const PATTERNS = Object.freeze([
  { key: 'paisley', label: 'Paisley', kinds: ['shapes'] },
  { key: 'soft', label: 'Soft commas', kinds: ['shapes'] },
  { key: 'tomoe', label: 'Tomoe', kinds: ['shapes'] },
  { key: 'checker', label: 'Checkerboard', kinds: ['linear'] },
  { key: 'rings', label: 'Rings', kinds: ['rings', 'linear'] },
  { key: 'comma', label: 'Comma', kinds: ['shapes'] },
].map((p) => Object.freeze(p)));

// runs in the page: everything this test asserts about the layout as it stands. want = { pattern, label, kinds }
export const CHECK = ([expectFeatures, want]) => {
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
  // the pattern on screen and its print (14 Nov 2026): the page's state, the select and #app agree; the print is of a
  // kind the pattern has (a design that fails for a group gives no print: the comma is shown instead)
  const st = window.__folding.getState(), kind = st.printKind || null, sel = q('#pattern');
  if (app.getAttribute('data-pattern') !== want.pattern) bad.push(`#app data-pattern is "${app.getAttribute('data-pattern')}", the pattern is ${want.pattern}`);
  if (st.pattern !== want.pattern) bad.push(`the app's pattern is "${st.pattern}", not ${want.pattern}`);
  if (sel.value !== want.pattern) bad.push(`the select says "${sel.value}" for the pattern ${want.pattern}`);
  if (want.kinds && !want.kinds.includes(kind)) bad.push(`${want.pattern}: ${kind ? `a print of the kind "${kind}"` : 'no print (the comma is shown instead)'}, not ${want.kinds.join(' or ')}`);
  if ((app.getAttribute('data-print') || null) !== kind) bad.push(`#app data-print is "${app.getAttribute('data-print')}", the print on screen ${kind ? 'is ' + kind : 'is none'}`);
  // the pattern selector: at the right of the header, clear of the chip and of the caption; one swatch, the pattern's
  // own; the native select covers it all (so a tap anywhere on it opens the platform's picker)
  const pat = q('#pattern-box'), pill = q('#pattern-box .pat-pill');
  if (!shown(pat) || !shown(pill)) bad.push('no pattern selector');
  else {
    const pb = B(pat), sb = B(sel), lb = B(pill);
    if (!within(pb, win) || !within(pb, B(q('#header')), 1)) bad.push('the pattern selector leaves the header');
    if (overlap(pb, B(q('#chip')))) bad.push('the pattern selector lies over the chip');
    if (overlap(lb, B(q('#caption')))) bad.push('the pattern selector lies over the caption');
    if (!within(lb, pb, 0.5)) bad.push('the pill leaves the selector\'s box');
    if (lb.height < 35.5) bad.push(`the selector's pill is ${r1(lb.height)} px high`);
    const sw = qa('#pattern-box .pat-sw').filter(shown);
    if (sw.length !== 1) bad.push(`${sw.length} swatches in the selector (${want.pattern})`);
    else {
      const s0 = sw[0], b0 = B(s0);
      if (!s0.classList.contains('pat-sw-' + want.pattern)) bad.push(`the swatch of ${want.pattern} is "${s0.getAttribute('class')}"`);
      if (Math.abs(b0.width - 18) > 0.5 || Math.abs(b0.height - 18) > 0.5) bad.push(`the swatch of ${want.pattern} is ${r1(b0.width)}x${r1(b0.height)}`);
      if (!within(b0, lb, 0.5)) bad.push(`the swatch of ${want.pattern} leaves its pill`);
      // under a print: drawn in the paper's two front tones (the light ground, the dark marks), as the print is
      if (kind) {
        const rgb = (hex) => { const h = hex.trim().replace('#', ''); return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`; };
        const root = getComputedStyle(document.documentElement), tones = [rgb(root.getPropertyValue('--print-light')), rgb(root.getPropertyValue('--print-dark'))];
        const paints = [...s0.querySelectorAll('rect, path, circle, ellipse, polygon')].flatMap((e) => { const cs = getComputedStyle(e); return [cs.fill, cs.stroke]; });
        const off = [...new Set(paints.filter((p) => p !== 'none' && !tones.includes(p)))];
        if (off.length) bad.push(`the swatch of ${want.pattern} has ${off.join(', ')} under a print (the print's tones: ${tones.join(', ')})`);
      }
    }
    // the name: shown from 560 px, not in a low landscape window (the caption shares the row); the pattern's own name,
    // whole, inside the pill. The word "Pattern" from 720 px, likewise
    const lab = q('#pattern-label'), low = vw > vh && vh < 480;
    if (lab.textContent.trim() !== want.label) bad.push(`the pill names "${lab.textContent.trim()}", the pattern is ${want.label}`);
    if (shown(lab) && (lab.scrollWidth > lab.clientWidth + 0.5 || !within(B(lab), lb, 0.5))) bad.push(`the pattern's name "${lab.textContent.trim()}" is cut`);
    if (shown(lab) !== (vw >= 560 && !low)) bad.push(`the pattern's name is ${shown(lab) ? 'shown' : 'hidden'} at ${vw} x ${vh}`);
    const word = q('#pattern-box .pat-k');
    if (word && shown(word) !== (vw >= 720 && !low)) bad.push(`the word "Pattern" is ${shown(word) ? 'shown' : 'hidden'} at ${vw} x ${vh}`);
    if (Math.abs(sb.width - pb.width) > 1 || Math.abs(sb.height - pb.height) > 1) bad.push('the native select does not cover the selector');
    if (parseFloat(getComputedStyle(sel).fontSize) < 16) bad.push('the select is under 16 px: iOS zooms the page');
  }
  // the title: there from 370 px up; below, the selector has its room (it stays in the page for a screen reader)
  { const tb = B(q('.title')); if ((tb.width > 2) !== (vw >= 370)) bad.push(`the title is ${tb.width > 2 ? 'shown' : 'hidden'} at ${vw} px`); }
  const pp = B(q('#pane-plane')), pf = B(q('#pane-fold'));
  if (pp.width < 149.5 || pp.height < 149.5) bad.push(`plane pane ${r1(pp.width)}x${r1(pp.height)}`);
  if (pf.width < 149.5 || pf.height < 149.5) bad.push(`fold pane ${r1(pf.width)}x${r1(pf.height)}`);
  // the cut controls
  const presets = q('#presets'), wavy = q('#wavy-field'), note = q('#cut-note');
  if (fold === 'disc') {
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
    ['Unfold / Tile', q('#next-btn')],
    ['reset view', q('#reset-view')], ['scrubber', q('#scrub')], ['Wavy', q('#wavy-field .scrub')], ['companion link', q('.companion a')]].filter(([, e]) => shown(e));
  for (const [n, e] of taps) { const b = B(e); if (b.width < 43.5 || b.height < 43.5) bad.push(`tap target ${n} ${r1(b.width)}x${r1(b.height)}`); if (!within(b, win)) bad.push(`tap target ${n} leaves the window`); }
  // The caption's first words are a link to the Classification of Surfaces page (15 Nov 2026): a link in a sentence,
  // so its height is the line's (WCAG 2.5.8, the exception "Inline"). It is all in view (every piece of it inside the
  // caption's box: the clamp cuts nothing of it), at least 44 px wide and a line high.
  const capLink = q('#caption a.cap-link');
  if (!shown(capLink)) bad.push('the caption has no link to the Classification of Surfaces page');
  else {
    const cb = B(capLink), cap = B(q('#caption')), parts = [...capLink.getClientRects()];
    if (cb.width < 43.5 || parts.some((r) => r.height < 14.5)) bad.push(`the caption's link is ${r1(cb.width)}x${r1(parts[0].height)}`);
    if (parts.some((r) => r.left < cap.left - 0.5 || r.right > cap.right + 0.5 || r.top < cap.top - 1.5 || r.bottom > cap.bottom + 1.5)) bad.push(`the caption's link is not all in view (${parts.length} piece${parts.length === 1 ? '' : 's'})`);
    if (!within(cb, win)) bad.push("the caption's link leaves the window");
  }
  const link = B(q('.companion a'));
  for (const s of ['#fold-btn', '#next-btn', '#reset-view', '#scrub', '#wavy-field .scrub', '#presets']) { const e = q(s); if (shown(e) && overlap(link, B(e))) bad.push(`the companion link's box lies over ${s}`); }
  // THE JOURNEY's transport (15 Nov 2026; src/journey.js): Fold, the scrubber, Unfold / Tile, reset view — in a row,
  // nothing cut; the scrubber wide enough to take hold of; the names of its stops (::after of the main ticks) inside
  // its box, clear of each other, 13 px. Which names show goes by the width of the transport's row (styles.css, "the
  // journey's transport by the width of its row"): 'surface', 'tile', 'pattern' from 352 px; the two ends alone from
  // 272; none below; a kaleidoscope: 'tile = surface' and 'pattern' from 372 px, 'surface' and 'pattern' from 272.
  // And no Tile bar in the plane
  {
    const fb = q('#fold-btn'), nb = q('#next-btn'), sc = q('#scrub'), rv = q('#reset-view');
    if (q('#tile-bar') || q('#tile-btn')) bad.push('the plane pane still holds a Tile bar');
    if (!nb || !shown(nb) || !shown(fb) || !shown(sc)) bad.push('the transport is not all there (Fold, scrubber, Unfold / Tile)');
    else {
      const a = B(fb), sb2 = B(sc), n = B(nb), r = B(rv);
      if (!(a.right <= sb2.left + 0.5 && sb2.right <= n.left + 0.5 && n.right <= r.left + 0.5)) bad.push('the transport is not Fold, scrubber, Unfold / Tile, reset view in a row');
      if (Math.abs(a.top - n.top) > 0.5 || Math.abs(a.height - n.height) > 0.5) bad.push('the two buttons of the transport are not level');
      for (const [name, b] of [['Fold', fb], ['Unfold / Tile', nb]]) {
        const l = b.querySelector('[data-label]'), lb2 = B(l), bb = B(b);
        if (b.scrollWidth > b.clientWidth + 0.5 || lb2.left < bb.left + 2 || lb2.right > bb.right - 2) bad.push(`the word "${l.textContent}" of the ${name} button is cut`);
        if (parseFloat(getComputedStyle(b).fontSize) < 13) bad.push(`the ${name} button's word is ${getComputedStyle(b).fontSize}`);
      }
      // (the longest word the second button shows is "Unfold": it must fit as "Tile" does — measured with its font)
      { const m = document.createElement('canvas').getContext('2d'), cs = getComputedStyle(nb); m.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const need = Math.max(m.measureText('Unfold').width, m.measureText('Pause').width); if (need > n.width - 8) bad.push(`"Unfold" needs ${r1(need)} px, the button has ${r1(n.width)}`); }
      // (the narrowest row of the 23 sizes is 248 px: a 640 x 360 phone on its side with a three-chip group, whose
      // plane column is the widest; its scrubber is 74 px, a 52 px track between two buttons that do the same job)
      if (sb2.width < 72) bad.push(`the scrubber is ${r1(sb2.width)} px wide`);
      const names = [], meter = document.createElement('canvas').getContext('2d');
      for (const t of qa('#scrub .scrub-ticks > i[data-main]')) {
        const cs = getComputedStyle(t, '::after');
        let text = cs.content;
        if (!text || text === 'none' || text === 'normal') continue;
        text = /^attr\(/.test(text) ? t.getAttribute('data-label') : text.replace(/^["'](.*)["']$/, '$1');
        meter.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const w = meter.measureText(text).width, tb = B(t), kind = t.getAttribute('data-main');
        const left = kind === 'start' ? sb2.left + 1 : kind === 'end' ? sb2.right - 1 - w : tb.left + tb.width / 2 - w / 2;
        names.push({ text, left, right: left + w, px: parseFloat(cs.fontSize) });
      }
      const rowW = B(q('#fold-controls')).width;
      const wantNames = rowW < 272 ? [] : fold === 'disc' ? [rowW < 372 ? 'surface' : 'tile = surface', 'pattern'] : rowW < 352 ? ['surface', 'pattern'] : ['surface', 'tile', 'pattern'];
      if (names.map((x) => x.text).join(' | ') !== wantNames.join(' | ')) bad.push(`the scrubber's stops are named "${names.map((x) => x.text).join(' | ')}", not "${wantNames.join(' | ')}" in a row of ${r1(rowW)} px`);
      names.forEach((x, i) => {
        if (x.px < 13) bad.push(`the stop's name "${x.text}" is ${x.px} px`);
        if (x.left < sb2.left - 0.5 || x.right > sb2.right + 0.5) bad.push(`the stop's name "${x.text}" leaves the scrubber's box`);
        if (i && x.left - names[i - 1].right < 4) bad.push(`the stops' names "${names[i - 1].text}" and "${x.text}" are ${r1(x.left - names[i - 1].right)} px apart`);
      });
    }
  }
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
  // (the paper's two sides come first, under every print and from 360 px up: one line of the legend is all a 320 px
  // phone has; under no print there is no paper to explain)
  const allItems = qa('#legend .lg').filter(shown), paper = allItems.filter((e) => e.hasAttribute('data-paper'));
  const items = allItems.filter((e) => !e.hasAttribute('data-paper'));
  const got = items.map((e) => e.getAttribute('data-feature')).join(' ');
  if (got !== expectFeatures) bad.push(`legend shows "${got}", the group has "${expectFeatures}" (#app data-features "${app.getAttribute('data-features')}")`);
  if (paper.length !== (kind && vw >= 360 ? 1 : 0)) bad.push(`legend: ${paper.length} "front · back" items (pattern ${want.pattern}, print ${kind || 'none'}, ${vw} px)`);
  if (paper.length && allItems[0] !== paper[0]) bad.push('legend: the paper is not the first item');
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


// the words of a re-cut (xx Hexagon, 22x Hexagon): over the 3D pane, at its foot, on one line, inside the pane, clear of
// "drag to turn" — on the flat tile (what Fold will do first), while a piece is carried, while the home tile folds
export const WORDS = (want) => {
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

// runs in a page of the template and the stylesheet with NO script (before the bundle runs): the pill shows the
// default pattern's swatch and name, the select has it selected. want = { pattern, label }
export const NOSCRIPT = (want) => {
  const q = (s) => document.querySelector(s), bad = [];
  const shown = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) if (getComputedStyle(e).display === 'none') return false; return el.getBoundingClientRect().width > 0; };
  const app = q('#app');
  if (app.hasAttribute('data-pattern') || app.hasAttribute('data-print')) bad.push('the template sets #app[data-pattern] or [data-print] itself');
  const sw = [...document.querySelectorAll('#pattern-box .pat-sw')].filter(shown).map((e) => e.getAttribute('class'));
  if (sw.length !== 1 || !sw[0].split(' ').includes('pat-sw-' + want.pattern)) bad.push(`before the script: the swatches shown are [${sw.join(' | ')}], not ${want.pattern}'s`);
  if (q('#pattern-label').textContent.trim() !== want.label) bad.push(`before the script: the pill names "${q('#pattern-label').textContent.trim()}", not ${want.label}`);
  if (q('#pattern').value !== want.pattern) bad.push(`before the script: the select says "${q('#pattern').value}", not ${want.pattern}`);
  if (q('#legend [data-paper]') && shown(q('#legend [data-paper]'))) bad.push('before the script: the legend shows "front · back" (no print yet)');
  return bad;
};

/** Every check, at every size: -> { failures, foldAt375, opened, seconds }. */
export async function sweep(page, cases, { quick = false } = {}) {
  const failures = [], foldAt375 = {}, t0 = Date.now();
  // the selector: PATTERNS, in this order, each with its swatch in the pill; the pattern the page opened with
  const { options, opened } = await page.evaluate(() => ({
    options: [...document.querySelectorAll('#pattern option')].map((o) => ({ key: o.value, label: o.textContent.trim(), swatch: !!document.querySelector(`#pattern-box .pat-sw-${CSS.escape(o.value)}`) })),
    opened: window.__folding.getState().pattern,
  }));
  const listed = (a) => a.map((o) => `${o.key} (${o.label})`).join(', ');
  if (listed(options) !== listed(PATTERNS)) failures.push(`the selector lists ${listed(options)}; it should list ${listed(PATTERNS)}`);
  for (const o of options) if (!o.swatch) failures.push(`no swatch in the pill for the pattern ${o.key} (svg.pat-sw.pat-sw-${o.key}): a bare caret on a phone`);
  const want = (key) => { const p = PATTERNS.find((q) => q.key === key) || { key, label: (options.find((o) => o.key === key) || {}).label || key, kinds: null }; return { pattern: p.key, label: p.label, kinds: p.kinds }; };
  const first = want(opened), others = PATTERNS.filter((p) => p.key !== opened).map((p) => want(p.key));
  // the page as it opens, with its default pattern: every check at every size, for every group
  for (const s of SIZES.map(parse)) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(150);
    for (const g of cases) {
      await page.evaluate(([id, p]) => { const F = window.__folding; F.setGroup(id); F.setPattern(p); F.setT(0); }, [g.id, first.pattern]);
      await page.waitForTimeout(40);
      const r = await page.evaluate(CHECK, [g.features, first]);
      for (const b of r.bad) failures.push(`${s.name} ${g.id}: ${b}`);
      if (s.name === 'f375x548') foldAt375[g.id] = r.fold[1];
    }
  }
  // every other pattern of the selector (14 Nov 2026: Paisley, Soft commas, Tomoe joined), at every size (quick: at a
  // phone, a phone on its side and a laptop), for every group: its own swatch and name, its print and the legend's
  // paper, and nothing else moves — a longer name must not cut the chip's words, a print must not cost a line
  for (const s of (quick ? ['f360x584', 'f320x568', '667x375', '1280x720'] : SIZES).map(parse)) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(150);
    for (const g of cases) {
      await page.evaluate((id) => { window.__folding.setGroup(id); window.__folding.setT(0); }, g.id);
      for (const w of others) {
        await page.evaluate((p) => { window.__folding.setPattern(p); window.__folding.setT(0); }, w.pattern);
        await page.waitForTimeout(40);
        const r = await page.evaluate(CHECK, [g.features, w]);
        for (const b of r.bad) failures.push(`${s.name} ${g.id} ${w.pattern}: ${b}`);
      }
    }
    await page.evaluate((p) => window.__folding.setPattern(p), first.pattern);
  }
  // the words of a re-cut; none for the home tile itself
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
      const stripOf = () => { const c = document.querySelector('#fold-canvas').getBoundingClientRect(), p = document.querySelector('#pane-fold').getBoundingClientRect(); return p.bottom - c.bottom; };
      if (id === 'xx') {
        // (14 Nov 2026) the Klein bottle's default cut names its three moves, and what the closed shape shows: the
        // same words' place and strip as a re-cut's, also on the flat tile and at t = 1 (the picture keeps its size)
        const flat = await page.evaluate(boxOf);
        for (const [t, want] of [[0.1, '^one end folds over'], [0.45, '^(the doubled sheet )?rolls up: a tube in'], [0.8, '^the neck hooks round to'], [1, '^(the two ends are )?sewn through the wall']]) {
          await page.evaluate((t) => window.__folding.setT(t), t);
          await page.waitForTimeout(60);
          for (const b of await page.evaluate(WORDS, want)) failures.push(`${s.name} ${id} home, t = ${(+t).toFixed(2)}: ${b}`);
          const now = await page.evaluate(boxOf);
          if (now !== flat) failures.push(`${s.name} ${id} home: the picture is ${flat} on the flat tile and ${now} at t = ${t}`);
        }
        await page.evaluate(() => window.__folding.setT(0));
        await page.waitForTimeout(60);
      } else if (await page.evaluate(stripOf) > 2) failures.push(`${s.name} ${id}: the home tile's picture does not fill the pane`);
    }
  }
  return { failures, foldAt375, opened, seconds: Math.round((Date.now() - t0) / 1000) };
}
