// Smooth, periodic test movies. These satisfy group constraints, not the PDE.
export const mod = (x, n = 1) => ((x % n) + n) % n;
export function equilibrium(F, k) {
  const disc = 1 - 4 * (F + k) ** 2 / F;
  if (disc < 0) return [1, 0];
  const u = (1 - Math.sqrt(disc)) / 2;
  return [u, F * (1 - u) / (F + k)];
}
export function makePreview({N, M, ops, seed = 'skate', F = .062, k = .0609}) {
  const field = new Float64Array(2 * N * N * M), nn = N * N;
  const bg = equilibrium(F, k);
  // Orbit summation of a localized seed is invariant under q(gx,t+tau)=q(x,t).
  // Periodic distances guarantee smooth spatial boundary matching.
  for (let t = 0; t < M; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let intensity = 0;
    for (const op of ops) {
      const phase = 2 * Math.PI * (t / M - op.tau);
      const cx = .27 + .065 * Math.cos(phase), cy = .23 + .075 * Math.sin(phase);
      const px = x / N - op.v[0], py = y / N - op.v[1];
      const sx = op.M[0][0] * px + op.M[1][0] * py;
      const sy = op.M[0][1] * px + op.M[1][1] * py;
      const dx = mod(sx - cx + .5) - .5, dy = mod(sy - cy + .5) - .5;
      const angle = seed === 'spiral' ? phase : .28 * Math.sin(phase) + .5;
      const a = Math.cos(angle), b = Math.sin(angle);
      const u = a * dx + b * dy, v = -b * dx + a * dy;
      let d;
      if (seed === 'worms') {
        const half = .06 + .02 * Math.sin(phase);
        d = Math.hypot(Math.max(Math.abs(u) - half, 0), v);
      } else {
        const r = .052, leg = seed === 'spiral' ? .035 : .058;
        d = v > 0 ? Math.abs(Math.hypot(u, v) - r) : Math.hypot(Math.abs(u) - r, Math.min(0, v + leg));
      }
      intensity += Math.exp(-.5 * (d / .0115) ** 2);
      if (seed !== 'worms') intensity += .92 * Math.exp(-.5 * ((u / .011) ** 2 + ((v + .008) / .011) ** 2));
    }
    const a = 1 - Math.exp(-1.4 * intensity);
    const i = t * nn * 2 + y * N + x;
    field[i] = bg[0] + (.93 - bg[0]) * a;
    field[i + nn] = bg[1] * (1 - .94 * a);
  }
  return field;
}
export const DESCRIPTIONS = {
  g94: ['FOURFOLD BREATHER', 'Fourfold symmetry at every instant. The chemistry can breathe while each quarter-turn leaves the frame unchanged.', 'R₉₀, τ = 0', 'Fourfold breathing worms', 'R₉₀ ↔ 0'],
  g95: ['HALF-PERIOD SCREW', 'Turn the world by 90° and advance half a cycle. Opposite packets remain paired at every instant.', 'R₉₀, τ = ½', 'Alternating pairs of packets', 'R₉₀ ↔ T/2'],
  g96: ['QUARTER-PERIOD SCREW', 'A 90° turn advances one quarter of the cycle. Four local packets take successive phases of the same motion.', 'R₉₀, τ = ¼', 'Four-phase rotating packets', 'R₉₀ ↔ T/4'],
  g97: ['THREE-QUARTER SCREW', 'The opposite handed clock: a 90° turn advances three quarters of a cycle. A spatial reflection exchanges this class with g96.', 'R₉₀, τ = ¾', 'Opposite handed rotating packets', 'R₉₀ ↔ 3T/4'],
  g98: ['HALF-CELL EXCHANGE', 'Each frame is fourfold symmetric. Half a cycle exchanges two arrangements separated by a diagonal half-cell translation.', 'R₉₀, τ = 0\n(x + ½, y + ½), τ = ½', 'Interleaved fourfold breathers', 'C ↔ T/2; R₉₀ ↔ 0'],
  g99: ['CENTRED SCREW', 'An offset quarter-turn advances the clock, while a diagonal half-cell translation advances half a cycle. The shifted rotation centre matters.', '(−y + ¼, x + ¾), τ = ¾\n(x + ½, y + ½), τ = ½', 'Four-phase centred exchanges', 'Offset R₉₀ ↔ 3T/4; C ↔ T/2']
};
