// scratch-core-sdf/mutants-report.mjs — the table of which tests notice which planted fault, mutants 1 to 20
// (mutants-report-b.mjs: the rest). FAILS ON PURPOSE: the suite script prints "not ok" lines only, 40 at most, so
// every mutant reports through the name of a failing test.
//   SUITE_LINES=1 bash dev/patterns/suite.sh dev/patterns/scratch-core-sdf/mutants-report.mjs
import { define } from './mutants-core.mjs';
define(true, 0, 20);
