// dev/patterns/designs/glyph/inspect.mjs — the default tile of each group in tile sizes: its corners, its sides (length,
// and whether a mirror, a glide axis or neither runs along it), the angles. The critic's (13 Nov 2026, second run) look
// at what the F has to live in.   node dev/patterns/designs/glyph/inspect.mjs [ids=*x,22*]
import { GROUPS, BY_ID, symmetryElements } from '../../../../src/groups.js';
import { tileOf } from '../../kit.js';

const arg = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const ids = arg.ids ? arg.ids.split(',') : GROUPS.map((g) => g.id);
const hyp = Math.hypot;
for (const id of ids) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea);
  const T = tileOf(g), P = T.poly, n = P.length;
  const S = symmetryElements(g, g.center[0], g.center[1], 6 * size);
  const onLine = (m, p) => Math.abs((p[0] - m.px) * -m.uy + (p[1] - m.py) * m.ux) < 1e-6 * size;
  const sides = [];
  for (let i = 0; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n], len = hyp(q[0] - p[0], q[1] - p[1]) / size;
    const mir = S.mirrors.some((m) => onLine(m, p) && onLine(m, q)), gl = S.glides.some((m) => onLine(m, p) && onLine(m, q));
    const a = P[(i + n - 1) % n], u = [a[0] - p[0], a[1] - p[1]], v = [q[0] - p[0], q[1] - p[1]];
    const ang = Math.round((Math.acos((u[0] * v[0] + u[1] * v[1]) / hyp(...u) / hyp(...v)) * 180) / Math.PI);
    const cen = S.centers.find((c) => hyp(c.x - p[0], c.y - p[1]) < 1e-6 * size);
    sides.push(`${ang}deg${cen ? '(' + cen.order + (cen.onMirror ? '*' : '') + ')' : ''} -[${len.toFixed(2)}${mir ? ' MIRROR' : gl ? ' glide' : ''}]-`);
  }
  console.log(id.padEnd(6), 'sides', n, ' ', sides.join(' '));
}
