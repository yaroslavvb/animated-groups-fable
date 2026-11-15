// scratch-core-sdf/mutants-run.mjs — every planted fault in src/sdf.js must make test/sdf.test.js fail.
//   bash dev/patterns/suite.sh dev/patterns/scratch-core-sdf/mutants-run.mjs
import { define } from './mutants-core.mjs';
define(false);
