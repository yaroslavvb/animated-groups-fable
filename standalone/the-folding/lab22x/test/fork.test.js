// fork.test.js — the lab's renderer. Until 13 Nov 2026 it was a generated fork of the app's (lab22x/tools/fork-renderer.mjs)
// that added a palette for the surface; the app's renderer now has the palette itself (src/render3d.js: setStyle({ palette }),
// vertex tints 4 + i), and the lab uses it as it is. This file checks that what the lab relies on is there.
//   node --test lab22x/test/fork.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

test('the lab draws with the app\'s renderer, which has the palette', () => {
  const main = fs.readFileSync(path.join(here, '../src/main.js'), 'utf8');
  assert.match(main, /from '\.\.\/\.\.\/src\/render3d\.js'/);
  assert.ok(!fs.existsSync(path.join(here, '../src/render3d-lab.js')), 'no fork left behind');
  const s = fs.readFileSync(path.join(here, '../../src/render3d.js'), 'utf8');
  assert.match(s, /uniform vec3 uPalF\[16\];/);
  assert.match(s, /uniform vec3 uPalB\[16\];/);
  assert.match(s, /style\.palF = new Float32Array\(48\)/);
  assert.match(s, /if \(tq > 3\.5\) \{ int pi = clamp\(int\(tq\) - 4, 0, 15\); base = gl_FrontFacing \? uPalF\[pi\] : uPalB\[pi\]; \}/, 'a tint of 4 + i takes palette colour i (never beyond the palette)');
});
