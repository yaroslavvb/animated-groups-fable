/** Optional inspection evidence; never used for admitting a verified symmetry. */
import {rotationCentres, centreKey} from './rotation-centres.mjs?v=20260905-repeat-scale';

const MAX_ERROR = .05, MAX_SAMPLE_RMS = .02;
const finitePair = pair => Array.isArray(pair) && pair.length === 2 && pair.every(x => Number.isFinite(x) && x >= 0);
export function overlayNearEvidence(index, record, strictTranslations = []) {
  if (index?.schema !== 'overlay-near-translations-v1' || !record) return null;
  const evidence = index.orbits?.[record.id];
  if (!evidence || evidence.classification !== 'approximate-only' || evidence.family !== 'p6' ||
      evidence.fieldSha256 !== record.fieldSha256 || evidence.N !== record.config.N) return null;
  const translations = evidence.translations, count = evidence.approximateTranslationCount;
  if (!strictTranslations.length || evidence.strictTranslationCount !== strictTranslations.length) return null;
  if (!finitePair(evidence.canonicalSymmetryBound?.channelMax) || evidence.canonicalSymmetryBound.channelMax.some(x=>x>2e-7)) return null;
  if (!Number.isInteger(count) || count <= strictTranslations.length || count > 4096 || !Array.isArray(translations) || translations.length !== count) return null;
  if (!translations.every(t => finitePair(t.v) && t.v.every(x => x < 1) &&
      finitePair(t.channelRelativeMax) && t.channelRelativeMax.every(x => x <= MAX_ERROR) &&
      finitePair(t.channelRelativeSampleRms) && t.channelRelativeSampleRms.every(x => x <= MAX_SAMPLE_RMS))) return null;
  // Do not complete an unchecked approximate subgroup from a few passing shifts.
  const keys = new Set(translations.map(t => centreKey(t.v)));
  if (keys.size !== count || !keys.has('0,0') || strictTranslations.some(t => !keys.has(centreKey(t.v)))) return null;
  for (const {v: a} of translations) {
    if (!keys.has(centreKey([a[0]-a[1],a[0]]))) return null;
    for (const {v: b} of translations) if (!keys.has(centreKey([a[0]+b[0],a[1]+b[1]]))) return null;
  }
  return evidence;
}

/** Exact markers retain their classification; a dashed higher order is opt-in. */
export function withApproximateCentres(group, exact, evidence) {
  const byPosition = new Map(exact.map(g => [centreKey(g.centre), g]));
  const proposed = rotationCentres({namedGenerators: group.namedGenerators, ops: group.render.ops, family:'p6', translations:evidence.translations});
  return proposed.map(g => {
    const verified = byPosition.get(centreKey(g.centre));
    if (verified && verified.order >= g.order) return verified;
    return {...g, approximate:true, verifiedLowerOrder:verified ?? null};
  });
}

export function approximateCaption(evidence, enabled) {
  const maximum = 100 * Math.max(...evidence.translations.flatMap(t => t.channelRelativeMax));
  return `This pattern has a smaller approximate repeat lattice (${evidence.approximateTranslationCount} repeats per simulation cell). ` +
    `It fails the strict symmetry check. ${enabled ? 'Dashed amber markers show approximate rotations; solid markers remain verified. ' : 'Enable inspection to see dashed amber markers. '}` +
    `The largest checked translation mismatch is ${maximum.toFixed(2)}% of a concentration’s full range, over the whole saved animation. A solid outer ring marks a verified lower-order centre at the same position.`;
}
