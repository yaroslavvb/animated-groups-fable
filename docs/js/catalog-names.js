/* What a group is CALLED, in one place, so the catalogue, a group's own page
 * and the wallpaper atlas cannot drift apart.
 *
 * The lead name is the book colour signature — ²2²2²2²2, ³3*²3 — in the
 * notation of Conway, Burgiel and Goodman-Strauss: a superscript on an
 * orbifold feature is the order of the colour permutation that feature
 * induces. It is the right lead here because a clock of order N on a film
 * group IS a perfect N-colouring of the group's spatial projection, so the
 * signature says the same thing the animation shows.
 *
 * Only the 68 forward groups have one — a time-reversing group is nobody's
 * colouring — so the others keep the crystallographic symbol, and the
 * catalogue symbol always travels alongside as the secondary name.
 */
"use strict";

const SIGS = await (async () => {
  try {
    const r = await fetch("data/xu-correspondence.json", { cache: "no-cache" });
    if (!r.ok) return new Map();
    return new Map(Object.entries((await r.json()).groups));
  } catch (e) {
    console.warn("catalog-names: no colour signatures —", e.message);
    return new Map();
  }
})();

export function signatureOf(id) { return SIGS.get(id) || null; }

const plain = h => String(h || "").replace(/<[^>]*>/g, "");

/* lead: the name to show large. tail: the other names, in falling order of
 * how much they add — the colour type G/K, the catalogue symbol, the
 * Hermann-Mauguin-style form. Anything that merely repeats the lead, or an
 * earlier tail entry, is dropped: for a group with a trivial clock the
 * signature, the orbifold and the symbol are all the same string, and
 * printing it three times says nothing three times. */
export function nameOf(g) {
  const s = SIGS.get(g.id);
  const lead = s ? s.signatureHtml : g.symbolHtml;
  const tail = [];
  for (const cand of [s ? s.tos : "", s ? g.symbolHtml : "", g.hm || ""]) {
    const t = plain(cand);
    if (!t) continue;
    if (t === plain(lead) || tail.some(x => plain(x) === t)) continue;
    tail.push(cand);
  }
  return { lead, tail };
}
