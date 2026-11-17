#!/usr/bin/env node
// check_quotes.mjs — every book citation of the page quotes words that are on that page of the book.
//   node tools/check_quotes.mjs [path to the PDF]
// Reads data-p / data-q from src/index.template.html, src/showcase.template.html and the FIGS table of src/tabs/prove.js, extracts each cited
// page with pdftotext (PDF page = printed page + 19) and looks for the words, ignoring line breaks, hyphenation at
// line ends and the kind of quote marks. A quote is at most 15 words (the house rule). Exit 1 on any miss.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF = process.argv[2] || path.join(os.homedir(), 'git0/animated-groups/Conway J., Goodman-Strauss C. (2008) The Symmetries of Things.pdf');
const cites = [];
for (const name of ['src/index.template.html', 'src/showcase.template.html']) {
  if (!fs.existsSync(path.join(ROOT, name))) continue;
  const tpl = fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const m of tpl.matchAll(/data-p="(\d+)"\s+data-q="([^"]+)"/g)) cites.push({ p: +m[1], q: m[2], from: path.basename(name) });
}
for (const dir of ['src/tabs', 'src/zipper', 'src/examples']) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    const src = fs.readFileSync(path.join(d, f), 'utf8');
    for (const m of src.matchAll(/'8\.\d': \[(\d+), '([^']+)'\]/g)) cites.push({ p: +m[1], q: m[2], from: f });
    for (const m of src.matchAll(/bookLink\((\d+),\s*'([^']+)'/g)) cites.push({ p: +m[1], q: m[2], from: f });
    for (const m of src.matchAll(/\['[^'\n]*', (\d+), '([^'\n]+)'\]/g)) cites.push({ p: +m[1], q: m[2], from: f });
  }
}
// hyphens are dropped on both sides (a line may break inside "non-orientable"), dashes become spaces
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f¨]/g, '').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff').replace(/-\s*\n\s*/g, '').replace(/[—–]/g, ' ').replace(/-/g, '').replace(/\s+/g, ' ').replace(/[“”"‘’']/g, '').replace(/[◦○]/g, 'o').replace(/∗/g, '*').toLowerCase().trim();
const pages = new Map();
let bad = 0;
for (const c of cites) {
  // two readings of the page: laid out as printed, and in reading order (captions set side by side interleave in the first)
  if (!pages.has(c.p)) pages.set(c.p, ['-layout', '-raw'].map((mode) => norm(execFileSync('pdftotext', ['-f', String(c.p + 19), '-l', String(c.p + 19), mode, PDF, '-'], { encoding: 'utf8' }))).join(' || '));
  const words = c.q.trim().split(/\s+/).length, ok = pages.get(c.p).includes(norm(c.q));
  if (!ok || words > 15) { bad++; console.log(`${ok ? 'TOO LONG' : 'NOT FOUND'} p. ${c.p} (${c.from}, ${words} words): ${c.q}`); }
}
console.log(`${cites.length} citations checked, ${bad} wrong`);
process.exit(bad ? 1 : 0);
