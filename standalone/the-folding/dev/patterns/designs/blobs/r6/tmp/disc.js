// a planted fault for r6/extrasym.mjs: a disc at a generic point (its print has extra half-turns and mirrors)
export const meta = { key: 'disc', label: 'Disc', hint: 'test' };
export function find(g) {
  const s = Math.sqrt(g.domainArea), cx = g.center[0] + 0 * s, cy = g.center[1] + 0 * s, pts = [];
  for (let k = 0; k < 64; k++) pts.push([cx + 0.2 * s * Math.cos(k * Math.PI / 32), cy + 0.2 * s * Math.sin(k * Math.PI / 32)]);
  return { shapes: [{ pts, hole: false }], info: {} };
}
