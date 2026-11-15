#!/usr/bin/env node
/* MathJax at build time: LaTeX in, static SVG out, so the page loads no script and no CDN and every
   formula is real MathJax typesetting. His rule, Sun 1 Nov 2026 (week 44): tutorials use LaTeX through MathJax.

   In a page or a partial write \( ... \) inline and \[ ... \] display, as plain LaTeX. Then, in build.mjs:

     import { renderHtml, MATH_CSS } from './tools/mathjax_render.mjs';
     html = renderHtml(html);                 // skips <script>, <style>, <pre>, <code>, <textarea>
     // put MATH_CSS in the page's <style> once

   or for a label drawn by a demo:  renderTex('\\tau_g T', false)  -> an HTML string.

   CLI:  node tools/mathjax_render.mjs in.html out.html
         node tools/mathjax_render.mjs --selftest

   An undefined command or a syntax error THROWS with the offending LaTeX: a formula never ships red.
   SVG glyphs use currentColor, so they follow the theme. Each formula carries role="img" and its
   source as aria-label. A wide display formula scrolls inside its own box instead of the page. */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const HOME = process.env.MATHJAX_HOME ||
  '/Users/yaroslavvb/.ctmp/claude-501/-Users-yaroslavvb-Library-CloudStorage-Dropbox-git0-gyroscope/c8c560f9-ea7e-5b8c-9ad4-768e7cee8a51/scratchpad/mathjax';
const require = createRequire(HOME + '/package.json');
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const MACROS = {
  R: '\\mathbb{R}',
  Z: '\\mathbb{Z}',
  lap: '\\nabla^2',
};

const tex = new TeX({
  packages: AllPackages.filter((p) => p !== 'noerrors' && p !== 'noundefined' && p !== 'bussproofs'),
  macros: MACROS,
  formatError: (_jax, err) => { throw err; },
});
// One shared table of glyph outlines, not a copy in every formula: with 1,800 formulas the page fell by more than half (Tue 3 Nov 2026).
const svg = new SVG({ fontCache: 'global' });
const doc = mathjax.document('', { InputJax: tex, OutputJax: svg });

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function unesc(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export function renderTex(source, display = false) {
  let node;
  try {
    node = doc.convert(source, { display, em: 16, ex: 8, containerWidth: 1200 });
  } catch (e) {
    throw new Error(`MathJax could not typeset: ${source}\n  ${e.message || e}`);
  }
  const inner = adaptor.innerHTML(node).replace(/\s*(focusable|tabindex)="[^"]*"/g, '');
  if (inner.includes('data-mml-node="merror"')) throw new Error(`MathJax error in: ${source}`);
  const label = esc(source.trim().replace(/\s+/g, ' '));
  return display
    ? `<div class="mjx-d" role="img" aria-label="${label}"><div class="mjx-w">${inner}</div></div>`
    : `<span class="mjx-i" role="img" aria-label="${label}">${inner}</span>`;
}

// The shared glyph table: put it once in the page, after every formula is rendered. Every formula's <use> points into it.
export const fontCacheHtml = () => `<svg id="MJX-SVG-global-cache" aria-hidden="true" style="display:none">${adaptor.outerHTML(svg.fontCache.getCache())}</svg>`;

const PROTECT = /<(script|style|pre|code|textarea)\b[\s\S]*?<\/\1>/gi;

export function renderHtml(html) {
  let count = 0;
  const parts = [];
  let last = 0;
  for (const m of html.matchAll(PROTECT)) {
    parts.push([html.slice(last, m.index), true]);
    parts.push([m[0], false]);
    last = m.index + m[0].length;
  }
  parts.push([html.slice(last), true]);
  const out = parts.map(([text, live]) => {
    if (!live) return text;
    return text
      .replace(/\\\[([\s\S]+?)\\\]/g, (_m, s) => { count++; return renderTex(unesc(s), true); })
      .replace(/\\\(([\s\S]+?)\\\)/g, (_m, s) => { count++; return renderTex(unesc(s), false); });
  }).join('');
  renderHtml.lastCount = count;
  return out;
}

export const MATH_CSS = `
.mjx-i svg{display:inline-block}
.mjx-i{white-space:nowrap}
.mjx-d{overflow-x:auto;overflow-y:hidden;margin:1em 0;position:relative;-webkit-overflow-scrolling:touch}
.mjx-w{display:table;margin:0 auto;padding:.1em 0}
.mjx-d svg{display:block;max-width:none}
`;

if (process.argv[1] && process.argv[1].endsWith('mathjax_render.mjs')) {
  const a = process.argv.slice(2);
  if (a[0] === '--selftest') {
    const samples = [
      ['u_t = D_u \\lap u + a-(b+1)\\,u+u^2 v', true],
      ['q(g x,\\ t+\\tau_g T)=q(x,t)', true],
      ['\\frac{1}{|G|}\\sum_{g\\in G} S_g\\,\\Phi_{\\tau_g T}(q)', true],
      ['\\tfrac13', false],
    ];
    for (const [s, d] of samples) console.log(renderTex(s, d).length, 'bytes', s);
    let threw = false;
    try { renderTex('\\notacommand x', false); } catch { threw = true; }
    console.log(threw ? 'an undefined command throws: ok' : 'FAIL: an undefined command did not throw');
    process.exit(threw ? 0 : 1);
  }
  if (a.length === 2) {
    const h = renderHtml(fs.readFileSync(a[0], 'utf8'));
    fs.writeFileSync(a[1], h);
    console.log(`typeset ${renderHtml.lastCount} formulas -> ${a[1]}`);
  } else {
    console.log('usage: mathjax_render.mjs in.html out.html | --selftest');
  }
}
