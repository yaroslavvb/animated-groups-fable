// paste-tutorial.mjs — puts src/tutorial.html between the template's two TUTORIAL markers (idempotent).
// Run from anywhere:  node dev/integration/paste-tutorial.mjs        (then npm run build)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const A = '<!-- TUTORIAL:BEGIN -->', B = '<!-- TUTORIAL:END -->';
const template = readFileSync(resolve(src, 'page.template.html'), 'utf8');
const tutorial = readFileSync(resolve(src, 'tutorial.html'), 'utf8').replace(/\s+$/, '');
const a = template.indexOf(A), b = template.indexOf(B);
if (a < 0 || b < a) { console.error('markers not found'); process.exit(1); }
const next = `${template.slice(0, a + A.length)}\n${tutorial}\n${template.slice(b)}`;
if (next === template) console.log('template already holds this tutorial');
else { writeFileSync(resolve(src, 'page.template.html'), next); console.log(`pasted ${tutorial.length} characters of src/tutorial.html into src/page.template.html`); }
