/* How a group is NAMED to the reader.
 *
 * The catalogue's ids are g1…g275, and the numbering is not ours: it is the
 * one in Xu & Wu's classification of the 275 spacetime groups, which the
 * correspondence tables at yaroslavvb.github.io/animated-groups also follow.
 * Written "g6" that provenance is invisible and the id reads like an internal
 * key; written "xu6" it says where the number comes from and that the same
 * number means the same group in either place.
 *
 * The id itself is untouched — it is still what URLs, anchors and JSON keys
 * carry, so every link ever shared keeps working. This is a display function
 * and nothing else.
 */
"use strict";

export function xuLabel(id) {
  return typeof id === "string" ? id.replace(/^g(?=\d)/, "xu") : id;
}
