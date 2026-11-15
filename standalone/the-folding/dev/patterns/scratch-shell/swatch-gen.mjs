// scratch: candidate swatches for the pattern pill (paisley, soft, tomoe), next to the three that exist.
// node dev/patterns/scratch-shell/swatch-gen.mjs  -> dev/patterns/scratch-shell/swatches.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));

const f = (n) => { const s = (Math.round(n * 100) / 100).toString(); return s.replace(/^(-?)0\./, '$1.'); };
const BG = '<rect class="pat-bg" width="18" height="18" rx="2.5"/>';

// the existing three, verbatim from src/index.template.html
const EXISTING = {
  checker: BG + '<path class="pat-fg" d="M0 2.5A2.5 2.5 0 0 1 2.5 0H6v6H0zM12 0h3.5A2.5 2.5 0 0 1 18 2.5V6h-6zM6 6h6v6H6zM0 12h6v6H2.5A2.5 2.5 0 0 1 0 15.5zM12 12h6v3.5a2.5 2.5 0 0 1-2.5 2.5H12z"/>',
  rings: BG + '<circle class="pat-ring" cx="9" cy="9" r="6.6"/><circle class="pat-ring" cx="9" cy="9" r="2.6"/>',
  comma: '<rect class="pat-glass" width="18" height="18" rx="2.5"/><path class="pat-ink" d="M11.4 3.4a3.5 3.5 0 0 1 3.5 3.5c0 4.6-3.9 7.9-9.4 7.9 2.4-1.2 3.6-2.9 3.5-5.3a3.5 3.5 0 0 1 2.4-6.1z"/>',
};

// rotate a point about (9, 9)
const rot = (p, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); const x = p[0] - 9, y = p[1] - 9; return [9 + c * x - s * y, 9 + s * x + c * y]; };
const P = (p) => f(p[0]) + ' ' + f(p[1]);

// the dark half of a yin-yang (a magatama) in the circle (9,9,R): head radius h*R, bite radius (1-h)*R, turned by deg
function magatama(R, h, deg) {
  const b = 1 - h;
  const top = rot([9, 9 - R], deg), mid = rot([9, 9 + (h - b) * R], deg), bot = rot([9, 9 + R], deg);
  return `M${P(top)}A${f(h * R)} ${f(h * R)} 0 0 1 ${P(mid)}A${f(b * R)} ${f(b * R)} 0 0 0 ${P(bot)}A${f(R)} ${f(R)} 0 0 1 ${P(top)}z`;
}

// tomoe: the square split by an S (two semicircles of radius 4.5), dark on the left, an eye in each head
const tomoeA = (eye) => BG + '<path class="pat-fg" d="M9 0H2.5A2.5 2.5 0 0 0 0 2.5v13A2.5 2.5 0 0 0 2.5 18H9a4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9z"/>'
  + `<circle class="pat-bg" cx="9" cy="4.5" r="${eye}"/><circle class="pat-fg" cx="9" cy="13.5" r="${eye}"/>`;
// the same S on the diagonal: from the top-right corner region to the bottom-left
function tomoeDiag(eye) {
  // S of two semicircles along the diagonal from (15,3) to (3,15): centre (9,9), half-length L
  const L = Math.hypot(6, 6), r = L / 2;            // two semicircles of radius L/2 along the diagonal
  const a = [15, 3], m = [9, 9], z = [3, 15];
  // dark = the upper-left side of the S, out to the square's edge
  const d = `M${P(a)}A${f(r)} ${f(r)} 0 0 1 ${P(m)}A${f(r)} ${f(r)} 0 0 0 ${P(z)}L0 18V2.5A2.5 2.5 0 0 1 2.5 0H18z`;
  const e1 = [9 + (15 - 9) / 2, 9 + (3 - 9) / 2], e2 = [9 - 3, 9 + 3];
  return BG + `<path class="pat-fg" d="${d}"/>` + `<circle class="pat-bg" cx="${f(e1[0])}" cy="${f(e1[1])}" r="${eye}"/><circle class="pat-fg" cx="${f(e2[0])}" cy="${f(e2[1])}" r="${eye}"/>`;
}

// a magatama centred (cx, cy) instead of (9, 9)
function magAt(cx, cy, R, h, deg) {
  const b = 1 - h, T = (p) => { const q = rot(p, deg); return [q[0] - 9 + cx, q[1] - 9 + cy]; };
  const top = T([9, 9 - R]), mid = T([9, 9 + (h - b) * R]), bot = T([9, 9 + R]);
  return `M${P(top)}A${f(h * R)} ${f(h * R)} 0 0 1 ${P(mid)}A${f(b * R)} ${f(b * R)} 0 0 0 ${P(bot)}A${f(R)} ${f(R)} 0 0 1 ${P(top)}z`;
}
// paisley: a slender magatama (small head, long tail round a big bite) and a small comma in the bite
function paisley(R, h, deg, Rs, hs, degS, shift = 0) {
  const c = rot([9, 9 + h * R + shift], deg);              // the bite's centre, turned with the big comma
  return BG + `<path class="pat-fg" d="${magatama(R, h, deg)}"/><path class="pat-fg" d="${magAt(c[0], c[1], Rs, hs, degS)}"/>`;
}
const CAND = {
  'tomoe 1.9': tomoeA(1.9),
  'tomoe 2.0': tomoeA(2.0),
  'soft rot30': BG + `<path class="pat-fg" d="${magatama(8.4, 0.62, 30)}"/>`,
  'paisley 180 big': paisley(8.4, 0.4, 180, 3.0, 0.56, 180),
  'paisley 165 big': paisley(8.4, 0.4, 165, 3.0, 0.56, 165),
  'paisley 195 big': paisley(8.4, 0.4, 195, 3.0, 0.56, 195),
  'paisley 165 s195': paisley(8.4, 0.4, 165, 3.0, 0.56, 195),
  'paisley 195 s165': paisley(8.4, 0.4, 195, 3.0, 0.56, 165),
};

const big = (svg) => `<svg viewBox="0 0 18 18" width="144" height="144" style="display:block">${svg}${grid()}</svg>`;
function grid() { let g = ''; for (let i = 1; i < 18; i++) g += `<path d="M${i} 0v18M0 ${i}h18" stroke="#000" stroke-opacity=".08" stroke-width=".04"/>`; return g; }
const small = (svg) => `<svg class="pat-sw" viewBox="0 0 18 18" style="display:block" aria-hidden="true">${svg}</svg>`;
const caret = '<svg class="orb-caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M0 0h10L5 6z"/></svg>';
const pill = (svg, label) => `<span class="pat-pill">${small(svg)}${label ? `<span class="pat-label">${label}</span>` : ''}${caret}</span>`;

const all = { ...EXISTING, ...CAND };
// the pixel view: each swatch rasterised at 18 px (1x) and 54 px (3x) as an image, shown blown up without smoothing
const COLORS = { 'pat-bg': 'fill="#9ad5cc"', 'pat-fg': 'fill="#4fa397"', 'pat-ring': 'fill="none" stroke="#4fa397" stroke-width="2.2"',
  'pat-glass': 'fill="#dcecea"', 'pat-ink': 'fill="#3b3b44"' };
const flat = (svg) => svg.replace(/class="([a-z-]+)"/g, (m, c) => COLORS[c] || m);
const pixelData = JSON.stringify(Object.entries(all).map(([k, s]) => [k, flat(s)]));
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../../../src/styles.css">
<style>body{height:auto;overflow:visible;padding:12px;font:13px system-ui} .row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;margin-bottom:14px}
.cell{display:flex;flex-direction:column;gap:6px;align-items:center;width:150px} .cap{font-size:13px;color:#52514a;text-align:center}
.pills{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:8px 0} .bare{display:flex;gap:8px;align-items:center}
.px{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px} .px canvas{image-rendering:pixelated;border:1px solid #e5e5ea}</style></head>
<body class="app">
<div class="row">${Object.entries(all).map(([k, s]) => `<div class="cell">${big(s)}<div class="cap">${k}</div></div>`).join('')}</div>
<div class="pills">${Object.entries(all).map(([k, s]) => pill(s, k.split(' ')[0])).join('')}</div>
<div class="pills">${Object.entries(all).map(([k, s]) => pill(s, '')).join('')}</div>
<div class="bare">${Object.entries(all).map(([k, s]) => small(s)).join('')}</div>
<div class="px" id="px1"></div><div class="px" id="px3"></div>
<script>
const items = ${pixelData};
window.__done = Promise.all(items.map(([k, svg]) => new Promise((ok) => {
  const img = new Image();
  img.onload = () => {
    for (const [id, n, z] of [['px1', 18, 6], ['px3', 54, 2]]) {
      const c = document.createElement('canvas'); c.width = n; c.height = n;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); g.drawImage(img, 0, 0, n, n);
      const v = document.createElement('canvas'); v.width = n * z; v.height = n * z; v.style.width = (n * z) + 'px'; v.title = k;
      const h = v.getContext('2d'); h.imageSmoothingEnabled = false; h.drawImage(c, 0, 0, n * z, n * z);
      document.getElementById(id).appendChild(v);
    }
    ok();
  };
  img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18">' + svg + '</svg>');
})));
</script>
</body></html>`;
fs.writeFileSync(path.join(here, 'swatches.html'), html);
console.log('wrote', path.join(here, 'swatches.html'), Object.keys(all).length, 'swatches');

// the three chosen (14 Nov): printed as the template's markup
const FINAL = {
  paisley: paisley(8.4, 0.4, 195, 3.0, 0.56, 195),
  soft: BG + `<path class="pat-fg" d="${magatama(8.4, 0.62, 30)}"/>`,
  tomoe: tomoeA(2),
};
for (const [k, s] of Object.entries(FINAL)) console.log(`<svg class="pat-sw pat-sw-${k}" viewBox="0 0 18 18" aria-hidden="true" focusable="false">${s}</svg>`);
