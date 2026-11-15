// scratch-core-sdf/mutants-report-b.mjs — the table of mutants-report.mjs, mutants 21 on. FAILS ON PURPOSE.
//   SUITE_LINES=1 bash dev/patterns/suite.sh dev/patterns/scratch-core-sdf/mutants-report-b.mjs
import { define } from './mutants-core.mjs';
define(true, 20, 99);
