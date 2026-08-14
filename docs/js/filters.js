/* The catalog's filter predicate, shared by the catalog grid and the single
 * group pages.
 *
 * A selection is a view of the catalog and lives in the query string, so it is
 * linkable: catalog.html?time=forward is the 68 clockwork groups. The group
 * page carries the same query along as `from`, which is what lets its previous
 * / next links walk the list the reader was actually browsing rather than the
 * whole catalog.
 */
"use strict";
import { colouringKind } from "./colouring.js?v=41";

/* select id -> query-string key. The values are the option values themselves
 * ("forward", "dihedral", …), so a URL reads as what it selects. */
export const FILTER_KEYS = [
  ["f-system", "system"],
  ["f-base", "base"],
  ["f-time", "time"],
  ["f-colour", "colouring"],
  ["f-prod", "product"],
];

/* q: URLSearchParams (or anything with .get). Absent or unrecognised values
 * are "all", so a stale or hand-edited link degrades to the full catalog
 * rather than to an empty grid. */
export function passes(g, q) {
  const v = k => q.get(k) || "";
  if (v("system") && g.system !== v("system")) return false;
  if (v("base") && g.base !== v("base")) return false;
  if (v("time") === "forward" && !g.forward) return false;
  if (v("time") === "with reversal" && g.forward) return false;
  if (v("colouring") && colouringKind(g) !== v("colouring")) return false;
  if (v("product") === "product" && !g.product) return false;
  if (v("product") === "not a product" && g.product) return false;
  return true;
}

/* the URL of a group's own page, carrying the current selection so that the
 * page can offer a way back to it */
export function groupHref(id, fromQuery = "") {
  const from = String(fromQuery).replace(/^\?/, "");
  return `group.html?g=${encodeURIComponent(id)}` +
    (from ? `&from=${encodeURIComponent(from)}` : "");
}
