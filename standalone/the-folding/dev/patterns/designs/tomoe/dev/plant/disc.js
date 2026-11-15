export const meta = { key: 'plant', label: 'plant', hint: '' };
export function find(g) { const s = Math.sqrt(g.domainArea), c = [g.center[0] + 0.13 * s, g.center[1] + 0.07 * s], pts = []; for (let k = 0; k < 64; k++) { const f = (2 * Math.PI * k) / 64; pts.push([c[0] + 0.3 * s * Math.cos(f), c[1] + 0.3 * s * Math.sin(f)]); } return { shapes: [{ pts, hole: false }] }; }
