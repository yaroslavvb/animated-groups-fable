#!/usr/bin/env node
/**
 * Deep links into the 3D spacetime designer, one per group in its menu.
 *
 * designer.html keeps its whole state in the URL hash, packed and checksummed
 * by docs/js/designer/urlstate.js.  A correspondence entry wants to hand the
 * reader a box that is already this group's, already turned to a readable
 * angle, and already holding one billiard to look at — an empty box opens on
 * nothing and reads as a bug.  So this script imports the site's own encoder
 * (never a copy of it) and writes, for every group of LIMITS.groups, the hash
 * of
 *
 *     {g, r: 0.06, span: 1, seeds: [{c: 0, pts: [{t: 0, u: [0.28, 0.14]}]}],
 *      view: {yaw: 0.62, pitch: 0.62, dist: 0, ortho: false}}
 *
 * one ring of images, one seed a little off the cell's corner, the default
 * distance, in perspective.  The 17 product/trivial-clock groups are not in
 * the designer's menu and get no entry; enumerate/correspondence_visualizations.py
 * simply leaves the designer card off those entries.
 *
 * Writes docs/data/designer-links.json:
 *
 *     {"note": "...", "links": {"g6": "SgPYjKMoAAAQCAABHwEepPA", ...}}
 *
 * Usage (the encoder is an ES module of the shipped site, so it needs a modern
 * node — this repository's is /usr/local/Cellar/node/25.2.1/bin/node):
 *
 *     node enumerate/designer_links.mjs            write the file
 *     node enumerate/designer_links.mjs --check    exit 1 unless it is current
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URLSTATE = path.join(ROOT, 'docs', 'js', 'designer', 'urlstate.js');
const OUT = path.join(ROOT, 'docs', 'data', 'designer-links.json');

const { encode, LIMITS } = await import(pathToFileURL(URLSTATE).href);

const NOTE =
  'designer.html deep links, one per group of the designer menu: an empty box '
  + 'with one ring of images and a single seed, written by enumerate/designer_links.mjs '
  + 'with docs/js/designer/urlstate.js encode().  The 17 product/trivial-clock '
  + 'groups are not in the menu and have no entry.';

const links = {};
for (const g of LIMITS.groups) {
  links[g] = encode({
    g,
    r: 0.06,
    span: 1,
    seeds: [{ c: 0, pts: [{ t: 0, u: [0.28, 0.14] }] }],
    view: { yaw: 0.62, pitch: 0.62, dist: 0, ortho: false },
  });
}

const text = JSON.stringify({ note: NOTE, links }, null, 1) + '\n';

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (current !== text) {
    console.log('out of date: docs/data/designer-links.json');
    process.exit(1);
  }
  console.log(`up to date: ${Object.keys(links).length} designer links`);
} else {
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${Object.keys(links).length} designer links to docs/data/designer-links.json`);
}
