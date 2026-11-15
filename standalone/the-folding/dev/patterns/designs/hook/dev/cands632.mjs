// dev/cands632.mjs — *632 ticks with a taper (second run), imported by cands.mjs.
const S3 = Math.sqrt(3);
import { inset } from './cands.mjs';
const P6 = [0, 0], P3 = [-0.5, -S3 / 6], P2 = [-0.25, -S3 / 4];
export const C632 = (hook, jhook) => {
  const d = 0.022, o = { r: 0.3, gap: 0.12, rd: 0.03, fil: 0.03 };
  const T = (name, ex, dd = d) => [name, hook('*632', inset(P6, P3, P2, dd), inset(P3, P6, P2, dd), inset(P2, P3, P6, dd), { ...o, ...ex })];
  const lerp = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];
  const Cj = (name, f, r, dd = d, ex = {}, dA = dd) => [name, jhook('*632', inset(P6, P3, P2, dA), inset(P3, P6, P2, dd), inset(P2, P3, P6, dd), lerp(inset(P2, P3, P6, dd), inset(P6, P3, P2, dd), f), { ...o, r, ...ex })];
  return [
    Cj('C .35 r.17', 0.35, 0.17),
    Cj('C .35 r.17 g.09', 0.35, 0.17, d, { gap: 0.09 }, 0.016),
    Cj('C .35 r.17 g.08', 0.35, 0.17, d, { gap: 0.08 }, 0.014),
    Cj('C .35 r.19 g.09', 0.35, 0.19, d, { gap: 0.09 }, 0.016),
    Cj('C .4 r.17 g.09 rd.02', 0.4, 0.17, d, { gap: 0.09, rd: 0.02 }, 0.016),
    Cj('C .3 r.2 g.09 rd.02', 0.3, 0.2, d, { gap: 0.09, rd: 0.02 }, 0.016),
    Cj('C .35 r.17 g.1 A.019', 0.35, 0.17, d, { gap: 0.1 }, 0.019),
    T('P3 base', {}),
    T('P3 rt.22 rh.42', { rt: 0.22, rh: 0.42 }),
    T('P3 r.36 rt.22 rh.42', { r: 0.36, rt: 0.22, rh: 0.42 }),
    T('P3 r.4 rt.2 rh.4', { r: 0.4, rt: 0.2, rh: 0.4 }),
    T('P3 r.4 rt.16 rh.44', { r: 0.4, rt: 0.16, rh: 0.44 }),
    T('P3 r.36 rt.18 rh.44 d.03', { r: 0.36, rt: 0.18, rh: 0.44 }, 0.03),
  ];
};
