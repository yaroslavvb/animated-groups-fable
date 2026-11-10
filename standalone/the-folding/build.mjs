#!/usr/bin/env node
// build.mjs — bundle the app into ONE self-contained HTML file. OWNER: shell agent.
//
// 1. npx --yes esbuild <entry> --bundle --format=iife --minify      (no source map)  -> the JS bundle
// 2. npx --yes esbuild <css> --minify                                               -> the CSS
// 3. strips the HTML comments from the template and puts the two in place of its placeholders
//        /*__INLINE_CSS__*/   (inside <style>)        /*__INLINE_JS__*/   (inside <script>)
//    escaping "</script", "</style" and "<!--" so the inlined text cannot end its element early.
// 4. checks the result: one file, one inline <script>, no external script / stylesheet / @import / url(), and no URL
//    at all except the companion link. (XML namespace names such as http://www.w3.org/2000/svg are names, never
//    fetched, and are let through; anything else needs --allow-url.)
// Relative paths are resolved against this file's directory (the workspace root), not the shell's cwd.
// Prints the sizes. Exit code 1 on any failure; nothing is written unless every check passes.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const USAGE = `node build.mjs [options]
  --entry <file>      entry module to bundle            (default src/app.js)
  --out <file>        the page to write                 (default dist/index.html)
  --template <file>   page shell with the placeholders  (default src/index.template.html)
  --css <file>        stylesheet to inline              (default src/styles.css)
  --target <t>        passed to esbuild as --target=<t> (default: none, the code is shipped as written)
  --no-minify         keep JS and CSS readable
  --allow-url <pfx>   let URLs starting with <pfx> through the self-containment check (repeatable)`;

const run = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CSS_SLOT = '/*__INLINE_CSS__*/';
const JS_SLOT = '/*__INLINE_JS__*/';
const COMPANION = 'https://spacesheep.dev/@yaroslavvb/the-unfolding';
const NAMESPACES = ['http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xhtml', 'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1998/Math/MathML', 'http://www.w3.org/XML/1998/namespace', 'http://www.w3.org/2000/xmlns/'];

function fail(message) {
  console.error('build.mjs: ' + message);
  process.exit(1);
}

function parseArgs(argv) {
  const opt = { entry: 'src/app.js', out: 'dist/index.html', template: 'src/index.template.html', css: 'src/styles.css',
    minify: true, target: null, allow: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) fail(`${a} needs a value\n${USAGE}`);
      return argv[++i];
    };
    if (a === '--entry') opt.entry = value();
    else if (a === '--out') opt.out = value();
    else if (a === '--template') opt.template = value();
    else if (a === '--css') opt.css = value();
    else if (a === '--target') opt.target = value();
    else if (a === '--allow-url') opt.allow.push(value());
    else if (a === '--no-minify') opt.minify = false;
    else if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
    else fail(`unknown argument ${a}\n${USAGE}`);
  }
  return opt;
}

const abs = (p) => path.resolve(ROOT, p);
const rel = (p) => path.relative(ROOT, p) || p;
const kb = (n) => (n / 1024).toFixed(1) + ' kB';
const count = (text, needle) => text.split(needle).length - 1;

async function esbuild(file, flags) {
  if (!fs.existsSync(file)) fail(`${rel(file)} does not exist`);
  try {
    const { stdout, stderr } = await run('npx', ['--yes', 'esbuild', file, ...flags, '--log-level=warning'],
      { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
    if (stderr.trim()) console.error(stderr.trimEnd());
    return stdout;
  } catch (err) {
    if (err.stderr) console.error(String(err.stderr).trimEnd());
    return fail(`esbuild failed on ${rel(file)}` + (err.code === 'ENOENT' ? ' (npx was not found)' : ''));
  }
}

// The inlined text must hold nothing the HTML parser reads as the end of its element (or as the start of a comment).
function inlineSafeJs(js) {
  const out = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  if (out !== js) {
    try { new vm.Script(out, { filename: 'bundle.js' }); }      // compiles, never runs: the escapes must keep it valid
    catch (err) { fail(`after escaping "</script" / "<!--" the bundle no longer parses (${err.message}); move that text into a string`); }
  }
  return out;
}
const inlineSafeCss = (css) => css.replace(/<\/style/gi, '<\\/style').replace(/<!--/g, '<\\!--');

function foreignUrls(text, allow) {
  const ok = [COMPANION, ...NAMESPACES, ...allow];
  const found = text.match(/\b(?:https?|wss?|ftp):\/\/[^\s"'`<>)\\]+/gi) || [];
  return [...new Set(found)].filter((u) => !ok.some((prefix) => u.startsWith(prefix)));
}

const opt = parseArgs(process.argv.slice(2));
const templateFile = abs(opt.template), cssFile = abs(opt.css), entryFile = abs(opt.entry), outFile = abs(opt.out);

if (!fs.existsSync(templateFile)) fail(`${opt.template} does not exist`);
// HTML comments go first (the template's own documentation names the placeholders), then the placeholders are counted.
const shell = fs.readFileSync(templateFile, 'utf8').replace(/<!--[\s\S]*?-->\n?/g, '').replace(/\n{3,}/g, '\n\n');
for (const slot of [CSS_SLOT, JS_SLOT]) {
  if (count(shell, slot) !== 1) fail(`${opt.template} must contain the placeholder ${slot} exactly once outside comments (found ${count(shell, slot)})`);
}

const jsFlags = ['--bundle', '--format=iife'];
if (opt.minify) jsFlags.push('--minify');
if (opt.target) jsFlags.push('--target=' + opt.target);
const [jsRaw, cssRaw] = await Promise.all([
  esbuild(entryFile, jsFlags),
  esbuild(cssFile, opt.minify ? ['--minify'] : []),
]);
if (!jsRaw.trim()) fail(`the bundle of ${opt.entry} is empty`);
if (!cssRaw.trim()) fail(`${opt.css} is empty`);
const js = inlineSafeJs(jsRaw.trim());
const css = inlineSafeCss(cssRaw.trim());

// A replacer FUNCTION is used because a replacement STRING would have its "$&", "$1" … sequences expanded, and
// minified code is full of "$". The JS goes in first, so nothing in the CSS can ever be mistaken for its placeholder.
const html = shell.replace(JS_SLOT, () => js).replace(CSS_SLOT, () => css);

const problems = [];
const lower = html.toLowerCase(), shellLower = shell.toLowerCase();
if (html.includes(CSS_SLOT) || html.includes(JS_SLOT)) problems.push('a placeholder survived');
if (!/^<!doctype html>/i.test(html.trimStart())) problems.push('the page does not start with <!doctype html>');
if (count(shellLower, '<script') !== 1 || count(shellLower, '<style') !== 1) problems.push('the template must hold exactly one <script> and one <style> (the two placeholders)');
if (count(lower, '</script') !== 1) problems.push('an unescaped "</script" is left in the bundle');
if (count(lower, '</style') !== 1) problems.push('an unescaped "</style" is left in the styles');
if (/<script[^>]*\ssrc\s*=/.test(shellLower)) problems.push('the template loads a script file');
if (/<link\b/.test(shellLower)) problems.push('the template has a <link>');
if (/<(?:img|iframe|video|audio|source|object|embed)\b/.test(shellLower)) problems.push('the template embeds an external resource');
if (/@import\b/i.test(css)) problems.push('the CSS has an @import');
if (/url\(\s*["']?(?!data:|#)/i.test(css)) problems.push('the CSS has a url() that is not a data: URI');
const urls = foreignUrls(html, opt.allow);
if (urls.length) problems.push('URLs besides the companion link (if one is intended, pass --allow-url <prefix>):\n      ' + urls.join('\n      '));
if (!html.includes(COMPANION)) problems.push('the companion link is missing');
if (problems.length) fail(`${opt.out} was NOT written — the page failed its checks:\n  - ` + problems.join('\n  - '));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
const bytes = Buffer.byteLength(html);
console.log(`built ${rel(outFile)}  (entry ${opt.entry}${opt.minify ? '' : ', not minified'})`);
console.log(`  html shell ${kb(Buffer.byteLength(shell)).padStart(9)}`);
console.log(`  css        ${kb(Buffer.byteLength(css)).padStart(9)}   from ${kb(fs.statSync(cssFile).size)} of source`);
console.log(`  js bundle  ${kb(Buffer.byteLength(js)).padStart(9)}`);
console.log(`  total      ${kb(bytes).padStart(9)}   = ${bytes} bytes, ${kb(zlib.gzipSync(html, { level: 9 }).length)} gzipped`);
console.log('  self-contained: one file, one inline <script>, no URL except the companion link');
