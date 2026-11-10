// The page shell: the template's DOM contract, the build placeholders, the platform rules, the CSS mirror of palette.js,
// and the layout rules of round 3 (contract C1 of SPEC 8; findings 6-11, 31-33, 50, 54, 55 of qa/round3-triage.md).
// What only a browser can check (nothing cut, nothing hidden, at 19 window sizes) is test/shell-layout.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as PAL from '../src/palette.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const template = read('src/index.template.html');
const css = read('src/styles.css');
const html = template.replace(/<!--[\s\S]*?-->/g, '');            // what build.mjs keeps
const count = (text, needle) => text.split(needle).length - 1;
const tagWithId = (id) => {
  const m = html.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\bid="${id}"[^>]*>`));
  return m ? { tag: m[1], text: m[0] } : null;
};
const inside = (id, closeTag) => { const start = html.indexOf(`id="${id}"`); return html.slice(start, html.indexOf(closeTag, start)); };
const textOf = (fragment) => fragment.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// id -> the element the app and the timeline expect to find there
const CONTRACT = {
  'app': 'div', 'header': 'header', 'chip': 'button', 'chip-symbol': 'span', 'chip-meta': 'span', 'caption': 'p', 'stage': 'main',
  'pane-plane': 'section', 'plane-canvas': 'canvas', 'hint': 'p', 'plane-controls': 'div', 'presets': 'div', 'wavy': 'input',
  'cut-note': 'p', 'pane-fold': 'section', 'fold-canvas': 'canvas', 'fold-labels': 'div', 'turn-hint': 'p', 'fold-controls': 'div',
  'fold-btn': 'button', 'scrub': 'div', 'scrub-ticks': 'span', 'scrubber': 'input', 'reset-view': 'button', 'legend': 'footer',
  'picker-mount': 'div',
};

// contract C1: the legend items, in this order, with these words
const LEGEND = [
  ['seams', 'coloured = edges sewn together'],
  ['mirrors', 'ink = mirror (becomes the rim)'],
  ['cones', 'dot n = cone point'],
  ['corners', 'ring ∗n = mirror corner'],
  ['double', 'dashed = self-intersection'],
];
const CUT_NOTE = 'Every edge is a mirror: Fold folds the plane onto the tile.';

/** The body of the CSS block that starts at `head` (an at-rule or a selector), braces matched. */
function block(text, head, from = 0) {
  const i = text.indexOf(head, from);
  assert.ok(i >= 0, `${head} exists`);
  let depth = 0;
  const j = text.indexOf('{', i);
  for (let k = j; k < text.length; k++) {
    if (text[k] === '{') depth++;
    else if (text[k] === '}' && --depth === 0) return text.slice(j + 1, k);
  }
  return '';
}
/** The declarations of the rules whose WHOLE selector list is `sel`, joined (comments stripped; at the top level of
 *  `scope`: rules inside an at-rule of `scope` count too, so pass the at-rule's block to look only there). */
function rule(sel, scope = css) {
  const text = scope.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp('(?:^|[{}])\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  const all = [...text.matchAll(re)].map((m) => m[1]);
  assert.ok(all.length, `rule ${sel}`);
  return all.join('\n');
}

test('template: every id of the DOM contract exists once, on the right kind of element', () => {
  for (const [id, tag] of Object.entries(CONTRACT)) {
    assert.equal(count(html, `id="${id}"`), 1, `#${id} appears exactly once`);
    assert.equal(tagWithId(id).tag, tag, `#${id} is a <${tag}>`);
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate ids');
  for (const id of ['chip', 'fold-btn', 'reset-view']) assert.match(tagWithId(id).text, /type="button"/, `#${id} is type=button`);
  for (const id of ['wavy', 'scrubber']) assert.match(tagWithId(id).text, /type="range"/, `#${id} is a range input`);
  assert.match(tagWithId('wavy').text, /min="0"[^>]*max="1"/, 'the Wavy slider runs 0..1');
});

test('template: what the timeline and the app look for inside the contract elements', () => {
  assert.match(inside('fold-btn', '</button>'), /<span data-label>Fold<\/span>/, 'the Fold button holds a [data-label] span');
  const scrub = inside('scrub', '</div>');
  assert.match(tagWithId('scrub').text, /data-scrub/, '#scrub is the [data-scrub] wrapper');
  assert.match(scrub, /id="scrub-ticks" data-ticks/, 'ticks container inside the wrapper');
  assert.match(scrub, /class="scrub-fill"/, 'the accent fill');
  assert.match(scrub, /id="scrubber"/, 'the range input is a child of the wrapper');
  assert.match(inside('wavy-field', '</label>'), /<span class="scrub" data-scrub>[\s\S]*id="wavy"/, 'the Wavy input sits in a [data-scrub] wrapper');
  assert.match(inside('chip', '</button>'), /id="chip-symbol"[\s\S]*id="chip-meta"/, 'the chip holds symbol then meta');
  assert.match(inside('pane-plane', '</section>'), /id="plane-canvas"[\s\S]*id="hint"/);
  assert.match(inside('pane-fold', '</section>'), /id="fold-canvas"[\s\S]*id="fold-labels"[\s\S]*id="turn-hint"/,
    'the label layer comes after (above) the 3D canvas, the turn hint above both');
  assert.match(inside('plane-controls', '</p>'), /id="presets"[\s\S]*id="wavy-field"[\s\S]*id="cut-note"/,
    'the kaleidoscope note sits in the cut controls, where the chips and the slider are (C1)');
  // reading and tab order: chip, plane, cut controls, fold, fold controls, legend, picker
  const order = ['chip', 'caption', 'pane-plane', 'presets', 'wavy', 'cut-note', 'pane-fold', 'fold-btn', 'scrubber', 'reset-view', 'legend', 'picker-mount'].map((id) => html.indexOf(`id="${id}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'document order');
  assert.ok(html.indexOf('id="picker-mount"') > html.lastIndexOf('</footer>'), 'the picker mount is outside the app grid');
});

test('template: the two build placeholders, once each, in their elements', () => {
  assert.equal(count(html, '/*__INLINE_CSS__*/'), 1);
  assert.equal(count(html, '/*__INLINE_JS__*/'), 1);
  assert.match(html, /<style>\/\*__INLINE_CSS__\*\/<\/style>/);
  assert.match(html, /<script>\/\*__INLINE_JS__\*\/<\/script>\s*<\/body>/, 'the bundle runs after the markup');
  assert.equal(count(html.toLowerCase(), '<script'), 1);
  assert.equal(count(html.toLowerCase(), '<style'), 1);
});

test('template: platform rules (SPEC 5.11 and 6)', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'));
  assert.ok(html.includes('<title>The Folding</title>'));
  assert.match(tagWithId('pane-plane').text, /data-ss-comments="off"/);
  assert.match(tagWithId('pane-fold').text, /data-ss-comments="off"/);
  assert.match(tagWithId('stage').text, /data-ss-thumb/);
  assert.ok(html.includes('<a href="https://spacesheep.dev/@yaroslavvb/the-unfolding" target="_blank" rel="noopener">The Unfolding</a>'), 'the companion link, verbatim');
  const urls = html.match(/\b[a-z]+:\/\/[^\s"'<>]+/gi) || [];
  assert.deepEqual(urls, ['https://spacesheep.dev/@yaroslavvb/the-unfolding'], 'no other URL');
  assert.doesNotMatch(html, /<link\b|<img\b|<iframe\b|\ssrc=|@import/i, 'no external asset');
  for (const text of ['drag to move the cut', 'drag to turn', 'Wavy', 'The Folding', CUT_NOTE]) assert.ok(html.includes(text), `"${text}"`);
});

test('template: the legend has one item per feature of contract C1, in order, with the C1 words and a swatch', () => {
  const items = [...html.matchAll(/<span class="lg" data-feature="([a-z]+)">([\s\S]*?)<\/span>\s*(?=<span class="(?:lg|companion)")/g)];
  assert.deepEqual(items.map((m) => m[1]), LEGEND.map(([f]) => f), 'seams, mirrors, cones, corners, double — once each, in this order');
  items.forEach((m, i) => {
    assert.equal(textOf(m[2]), LEGEND[i][1], `the words of "${m[1]}"`);
    assert.match(m[2], /^<svg class="sw"[^>]*aria-hidden="true"/, `"${m[1]}" starts with a swatch hidden from screen readers`);
    assert.match(m[2], /<\/svg><span>/, `the words of "${m[1]}" are one span (no loose text in the flex item: the spaces around <i>n</i> stay)`);
  });
  assert.match(items[2][2], /dot <i>n<\/i> = cone point/, 'n is a variable: italic');
  assert.match(items[3][2], /ring ∗<i>n<\/i> = mirror corner/, 'the corner label is ∗n, as the 3D draws it');
  assert.match(items[3][2], /class="sw-ring"/, 'corners: a ring, like the 3D marker');
  assert.match(items[4][2], /class="sw-dash"/, 'double: a dashed line');
  assert.ok(html.indexOf('class="companion"') > html.indexOf('data-feature="double"'), 'the companion link comes after the items');
});

test('template: the reset button says the verb when it is narrow ("Reset"), "Reset view" when there is room (finding 54)', () => {
  const b = inside('reset-view', '</button>');
  assert.match(b, /<span class="btn-text">Reset<span class="btn-text-wide"> view<\/span><\/span>/);
  assert.match(tagWithId('reset-view').text, /aria-label="Reset view"/, 'its accessible name stays "Reset view"');
});

// ---- styles ---------------------------------------------------------------------------------------------------------

const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
const vars = Object.fromEntries([...rootBlock.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const norm = (v) => String(v).toLowerCase().replace(/\s+/g, '');
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('styles: the CSS variables mirror src/palette.js', () => {
  const expected = {
    '--ink': PAL.INK, '--muted': PAL.MUTED, '--faint': PAL.FAINT, '--hairline': PAL.HAIRLINE, '--card': PAL.CARD, '--ground': PAL.GROUND,
    '--accent': PAL.ACCENT, '--accent-soft': PAL.ACCENT_SOFT, '--mirror': PAL.MIRROR_COLOR, '--crease': PAL.CREASE_COLOR,
    '--glide': PAL.GLIDE_COLOR, '--motif': PAL.MOTIF_COLOR,
  };
  PAL.CLASS_COLORS.forEach((c, i) => { expected['--class-' + i] = c; });
  for (const [name, value] of Object.entries(expected)) {
    assert.ok(name in vars, `${name} is defined in :root`);
    assert.equal(norm(vars[name]), norm(value), `${name} matches palette.js — the two are kept in sync by hand`);
  }
  assert.equal(Object.keys(vars).filter((k) => k.startsWith('--class-')).length, PAL.CLASS_COLORS.length, 'one --class-N per glue colour');
});

test('styles: no colour outside the palette block, no gradient, no shadow beyond a hairline, nothing fixed', () => {
  const rest = css.replace(rootBlock, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rest, /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i, 'every colour comes from a palette variable');
  assert.doesNotMatch(rest, /gradient\(/i, 'no gradients');
  for (const m of rest.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
    assert.match(m[1].trim(), /^inset 0 0 0 1(\.5)?px var\(--[a-z-]+\)$/, `box-shadow "${m[1].trim()}" is a hairline`);
  }
  assert.doesNotMatch(rest, /position\s*:\s*fixed/, 'no position: fixed (spacesheep iframe)');
  assert.doesNotMatch(rest, /@import|url\(/i, 'no external asset');
  // visible radius <= 8 px: a control drawn inside a transparent border of b px carries radius 8 + b
  const radii = [...rest.matchAll(/border-radius\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  for (const r of radii) assert.ok(['50%', '1px', '7px', '8px', '10px', '12px'].includes(r), `border-radius ${r}`);
  assert.match(rest, /border: 4px solid transparent;\s*border-radius: 12px;/, '12 px only around a 4 px transparent border');
  assert.match(rest, /border: 2px solid transparent;\s*border-radius: 10px;/, '10 px only around a 2 px transparent border');
});

test('styles: no text of the page is smaller than 13 px, and nothing is cut with an ellipsis (findings 7, 32, 33)', () => {
  const sizes = [...cssNoComments.matchAll(/font(?:-size)?\s*:\s*(?:[a-z0-9 ]*?\s)?([0-9.]+)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 10, 'font sizes found');
  for (const s of sizes) assert.ok(s >= 13, `font size ${s} px`);
  assert.doesNotMatch(cssNoComments, /text-overflow\s*:\s*ellipsis/, 'no ellipsis: a preset name, the chip text, a legend item are never cut');
  // the 3D labels' layer, the hint, the legend, the Wavy label and the chip meta, which were 10.5-12.5 px in v1
  assert.match(rule('.labels'), /font-size: 13px/);
  assert.match(rule('.hint'), /font-size: 13px/);
  assert.match(rule('.legend'), /font-size: 13px/);
  assert.match(rule('.wavy-label'), /font-size: 13px/);
  assert.match(rule('.orb-meta'), /font-size: 13px/);
});

test('styles: the chip text ("hm · shape") wraps to two lines rather than being cut (finding 33)', () => {
  const r = rule('.orb-meta');
  assert.match(r, /-webkit-line-clamp: 2/);
  assert.match(r, /line-height: 16px/, 'two 16 px lines fit the 36 px pill');
  assert.doesNotMatch(r, /white-space: nowrap/);
  assert.doesNotMatch(cssNoComments, /\.orb-meta \{[^}]*font-size: 12/, 'never shrunk to fit');
});

test('styles: the caption reserves one line on a phone and takes two only when its words need them (finding 9)', () => {
  const base = rule('.caption');
  assert.match(base, /-webkit-line-clamp: 2/, 'at most two lines');
  const phone = block(css, '@media (max-width: 539px)');
  assert.match(phone, /\.caption \{[^}]*min-height: 17px;[^}]*line-height: 17px/, 'one 17 px line reserved, not two');
});

test('styles: legend items show only for the features #app names (contract C1, findings 31, 55)', () => {
  assert.match(rule('.lg'), /display: none/, 'an item is hidden unless its feature is named');
  const shown = cssNoComments.match(/((?:\.app[^{]*,\s*)*\.app:not\(\[data-features\]\)[^{]*)\{\s*display: flex;\s*\}/);
  assert.ok(shown, 'one rule shows the named items');
  const sel = shown[1];
  for (const [f] of LEGEND) assert.ok(sel.includes(`.app[data-features~="${f}"] .lg[data-feature="${f}"]`), `"${f}" shows when #app's data-features names it`);
  assert.ok(sel.includes('.app:not([data-features]) .lg:is([data-feature="seams"], [data-feature="mirrors"], [data-feature="cones"])'),
    'a page whose script has not set data-features shows the first three (the v1 legend), not an empty footer');
  const lg = rule('.legend');
  assert.match(lg, /flex-wrap: wrap/, 'items wrap as whole items (each nowrap)');
  assert.match(rule('.lg'), /white-space: nowrap/);
  assert.match(lg, /min-height: var\(--tap\)/, 'at least 44 px, the height of the link\'s tap box');
  assert.match(lg, /align-content: flex-end/, 'lines at the bottom: the link box reaches up over the line above it');
  const a = rule('.companion a');
  const pad = a.match(/padding: (\d+)px \d+px (\d+)px/), mar = a.match(/margin: -(\d+)px 0 -(\d+)px/);
  assert.ok(pad && mar, 'the link: padding and negative margins');
  assert.equal(Number(pad[1]) + 16 + Number(pad[2]), 44, 'the link\'s box is 44 px high (16 px of text)');
  assert.equal(Number(pad[1]), Number(mar[1]), 'its padding above takes no room in the layout');
  assert.equal(Number(pad[2]), Number(mar[2]), 'nor its padding below');
  assert.match(lg, /padding: [0-9]+px 1px max\(6px/, 'the legend\'s own bottom padding holds the 6 px the link box reaches below its text');
  assert.match(lg, /line-height: 16px/);
  assert.match(block(css, '@media (max-width: 479px)'), /\.companion-k \{ display: none; \}/, 'on a phone the link alone ("companion:" would cost a line)');
});

test('styles: the kaleidoscopes have nothing to cut — a note replaces chips and slider, and the plane shows no hint (C1, findings 6, 30, 36, 48, 49)', () => {
  assert.match(rule('.cut-note'), /display: none/, 'the note is hidden for the groups with a cut');
  assert.match(rule('.app[data-fold="snowflake"] .cut-note'), /display: block/);
  assert.match(rule('.app[data-fold="snowflake"] .presets, .app[data-fold="snowflake"] .wavy'), /display: none/, 'chips and Wavy give way');
  assert.match(rule('.app[data-fold="snowflake"] .pane-plane > .hint'), /display: none/, 'no hint over the kaleidoscope\'s plane');
  assert.match(rule('.cut-note'), /font-size: 13px/);
});

test('styles: the hints — never wider than their pane, at the top edge of a small plane pane, "drag to turn" in a corner (C1, findings 11, 50)', () => {
  const h = rule('.hint');
  assert.match(h, /width: max-content;\s*max-width: calc\(100% - [0-9]+px\)/, 'as wide as its words, never wider than the pane');
  assert.match(h, /white-space: normal/, 'it wraps rather than being cut');
  assert.match(h, /pointer-events: none/, 'a drag on the hint reaches the canvas under it');
  assert.match(h, /bottom: 10px/, 'a large plane pane: at the bottom edge');
  const small = block(css, '@container plane (max-height: 359px) or (max-width: 359px)');
  assert.match(small, /\.hint \{[^}]*top: [0-9]+px; bottom: auto;/, 'a small (phone) plane pane: at the top edge');
  const pad = Number((small.match(/padding: 1px (\d+)px/) || [])[1]), mw = Number((small.match(/max-width: calc\(100% - (\d+)px\)/) || [])[1]);
  assert.ok(2 * pad + 2 + 126 <= 150 - mw, `"drag to move the cut" (126 px at 13 px) fits one line of the smallest plane, 150 px (padding ${pad}, margin ${mw})`);
  const fallback = block(css, '@supports not (container-type: size)');
  assert.match(fallback, /\.pane-plane > \.hint \{[^}]*top: [0-9]+px; bottom: auto;/, 'without container queries: by window size');
  const t = rule('.turn-hint');
  assert.match(t, /left: [0-9]+px; top: [0-9]+px; bottom: auto; transform: none;/, 'the turn hint: top-left corner, clear of the shape the camera frames');
  assert.match(html, /<p class="hint turn-hint" id="turn-hint">drag to turn<\/p>/, 'styled like #hint');
  assert.doesNotMatch(cssNoComments, /data-faded|hint-part/, 'the v1 fade of the kaleidoscope hint is gone with the hint itself');
});

test('styles: a preset chip never shrinks; the cut-control row narrows the slider, then wraps (finding 7)', () => {
  const chip = rule('.chip');
  assert.match(chip, /flex: none/, 'a chip keeps its width');
  assert.match(chip, /white-space: nowrap/);
  assert.match(rule('.presets'), /flex-wrap: wrap/, 'chips that do not fit one row wrap');
  assert.match(rule('.ctl-plane'), /flex-wrap: wrap/, 'the slider goes to a second row before a chip is squeezed');
  const compact = block(css, '@container pctl (max-width: 479px)');
  assert.match(compact, /\.wavy \{[^}]*flex: 1 1 64px; min-width: 64px;/, 'a narrow row: the slider gives way first, down to 64 px');
  assert.match(compact, /\.chip \{ padding: 0 8px; font-size: 13px; \}/);
  // a phone on its side: the plane's column is at least as wide as its compact row (the fold is bound by the height)
  const low = block(css, '@media (orientation: landscape) and (max-height: 479px)');
  assert.match(low, /\.stage \{ grid-template-columns: minmax\(min\(320px, 60%\), 1fr\) minmax\(0, 1fr\); \}/, 'three chips + slider: 314 px');
  assert.match(low, /\.app:has\(\.presets > \.chip:nth-child\(4\)\) \.stage \{ grid-template-columns: minmax\(min\(360px, 60%\), 1fr\) minmax\(0, 1fr\); \}/, "632's four chips + slider: 349 px");
  // the fold never pays for a second row of cut controls: side by side, the fold pane spans the row they grow into
  assert.match(rule('.stage'), /grid-template-rows: minmax\(0, 1fr\) auto calc\(var\(--tap\) \+ 6px\);\s*grid-template-areas: "plane fold" "pctl fold" "pctl fctl";/);
});

test('styles: the phone column holds every chip — two to a line where they fit — and grows rather than hiding one (finding 8)', () => {
  const m = css.match(/@media \(orientation: portrait\) and \(max-width: 599px\) and \(min-aspect-ratio: 9\/20\) \{/);
  assert.ok(m, 'the phone layout');
  const phone = block(css, m[0]);
  assert.match(phone, /--plane: clamp\(150px, calc\(var\(--avail\) \* 0\.4\), calc\(100vw - 164px\)\);/, 'the plane: 40 % of the shared height, 150 px at least');
  assert.match(phone, /grid-template-rows: minmax\(var\(--plane\), auto\) minmax\(0, 1fr\) auto;/,
    'the first row is the square, or taller when the column needs it: a chip is never scrolled out of sight');
  assert.match(phone, /\.presets \{[^}]*flex: 1 1 auto;/);
  assert.doesNotMatch(phone, /\.presets \{[^}]*overflow/, 'the column does not scroll');
  assert.match(phone, /\.chip \{ flex: 1 1 40%; min-width: max-content; \}/,
    'chips fill their line, two at most (equal halves where both fit), never narrower than their name');
  assert.match(phone, /--avail: calc\(100vh - 170px\)/, 'the height the panes share: header, a one-line caption, a two-line legend, the fold controls');
});

test('styles: the reset button reads "Reset" when it is narrow, at 13 px (finding 54)', () => {
  const narrow = block(css, '@container fctl (max-width: 459px)');
  assert.match(narrow, /\.btn-text-wide \{ display: none; \}/, '" view" goes, "Reset" stays');
  assert.match(narrow, /min-width: 52px/, 'room for the word inside the pill');
  assert.doesNotMatch(narrow, /font-size/, 'the word keeps the button\'s 13 px');
  assert.match(rule('.btn-quiet'), /font-size: 13px/);
});

test('styles: the layout rules the shell promises', () => {
  assert.equal(vars['--tap'], '44px', 'tap targets are 44 px');
  assert.match(css, /height:\s*100dvh/, 'the page is exactly one dynamic viewport tall');
  assert.match(css, /@media \(orientation: portrait\)/, 'stacked when taller than wide');
  assert.match(css, /grid-template-areas: "plane fold" "pctl fold" "pctl fctl"/, 'side by side by default (wider than tall)');
  assert.match(css, /\.scrub > input\[type="range"\] \{[^}]*font-size: 16px/, 'inputs are 16 px');
  assert.match(css, /\[hidden\] \{ display: none !important; \}/, 'the hidden attribute always hides (hint, turn hint, picker)');
  assert.match(css, /\.pane-plane \{[^}]*container: plane \/ size;/, 'the plane pane is the size container the hint asks about');
});
