import { BY_ID } from '../../../../../src/groups.js';
import { findWith } from '../design.js';
const g = BY_ID['*442'], r = findWith(g, null), [HB] = r.info.heads; console.log(HB[0].toFixed(4), HB[1].toFixed(4));
