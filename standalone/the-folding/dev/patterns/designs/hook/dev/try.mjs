// dev/try.mjs — variants of a hand-drawn hook, numbers only:  node try.mjs <id> [per]   (edit VARIANTS below)
import { BY_ID, run } from './lib.mjs';
import { hook, jhook } from './seeds.mjs';
import { VARIANTS } from './variants.mjs';
const id = process.argv[2], per = +process.argv[3] || 24, g = BY_ID[id];
for (const [name, sp] of VARIANTS[id](hook, jhook)) {
  const m = run(g, sp, { per });
  console.log(name.padEnd(28), `dark ${m.coverage.toFixed(3)} bare ${m.bare.toFixed(2)} solid ${m.solid.toFixed(2)} loops ${m.loops} ${m.plain ? 'PLAIN ' + m.apart : ''} at ${m.bareAt}`);
}
