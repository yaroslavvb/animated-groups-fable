// folds/index.js — one door to the four fold modules (SPEC 5.3, 5.12). OWNER: integrator.
//
//   createFold(group, domain, mesh?, opts?) -> Fold      the fold of group.fold; builds the tile mesh itself when none is given
//   buildFold(group, domain, opts?)        -> Fold      = createFold(group, domain, null, opts)
//   foldMeshOptions(group)                 -> options for buildMesh(group, domain, …) that suit the group's fold
//   foldOptions(opts)                      -> the options handed to the fold module (the anchor checked, see below)
//   FOLD_TYPES                             the seven values of group.fold
//
// The anchor (SPEC 7, anchor contract). opts.anchor = [x, y] is a plane point that the app sets when a group or a
// preset is chosen (the preset's seed, in straight coordinates; no preset seed is moved by clampSeed) and does NOT
// change while the cut is dragged or made wavy. The hinge and cross-cap folds make the shape at t = 1 depend on the
// anchor only, so the folded shape stays put while the seams slide over it. Every module receives it; one that does
// not use it ignores it. A missing anchor means anchor = seed (the v1 behaviour). Anything but two finite numbers is
// dropped here, so a module only ever sees a well-formed anchor or none.
//
// Which module folds what:
//   hinge                              src/folds/hinge.js      2222, 22*, 2*22, 442, 4*2, 333, 3*3, 632
//   torus | cylinder | mobius | klein  src/folds/roll.js       o, **, *x, xx
//   crosscap                           src/folds/crosscap.js   22x
//   snowflake                          src/folds/snowflake.js  *2222, *442, *333, *632
//
// The Fold that comes back is the module's own object (SPEC 5.3: mesh, stops, duration, at(t), and whatever extras the
// module documents: doubleLine(t) for klein and crosscap, star / cellMaps for snowflake, kinematics for hinge and
// crosscap). **Draw from fold.mesh, never from the mesh passed in**: the hinge and cross-cap folds hand back a mesh
// with a finer outline (the cross-cap also with more triangles), the snowflake fold its own star of 2n cells, and a
// roll fold a finer mesh when the one it was given is too coarse for a round tube.
//
// The mesh density. A rolled tube of 25 flat facets looks faceted and the lobes of the figure 8 are tight, so the
// roll folds ask for a finer grid than the default of mesh.js (rollDensity: o 88, ** 60, *x 80, xx 104 steps across
// the tile's longer side). foldMeshOptions hands that to buildMesh, so nothing is built twice. The snowflake fold
// never looks at the tile mesh (the tile is the kaleidoscope's cell; it meshes its star itself), so none is built
// for it here.

import { buildMesh } from '../mesh.js';
import createHinge from './hinge.js';
import createRoll, { rollDensity } from './roll.js';
import createCrosscap from './crosscap.js';
import createSnowflake from './snowflake.js';

const MAKERS = {
  hinge: createHinge,
  torus: createRoll, cylinder: createRoll, mobius: createRoll, klein: createRoll,
  crosscap: createCrosscap,
  snowflake: createSnowflake,
};
const ROLLS = new Set(['torus', 'cylinder', 'mobius', 'klein']);

/** The values group.fold can take. */
export const FOLD_TYPES = Object.keys(MAKERS);

/** Options for buildMesh(group, domain, options) that suit this group's fold ({} = the defaults of mesh.js). */
export function foldMeshOptions(group) {
  return ROLLS.has(group.fold) ? { density: rollDensity(group) } : {};
}

/**
 * The options a fold module is given: a shallow copy of `opts` whose `anchor`, if present, is a fresh [x, y] of two
 * finite numbers; a malformed anchor (not two finite numbers) is left out, which means anchor = seed. `opts` itself is
 * never changed.
 */
export function foldOptions(opts) {
  const out = opts && typeof opts === 'object' ? { ...opts } : {};
  if ('anchor' in out) {
    const a = out.anchor;
    const x = a && a.length >= 2 ? Number(a[0]) : NaN, y = a && a.length >= 2 ? Number(a[1]) : NaN;
    if (a && typeof a !== 'string' && Number.isFinite(x) && Number.isFinite(y)) out.anchor = [x, y];
    else delete out.anchor;
  }
  return out;
}

/**
 * The fold of `group` for the tile `domain`.
 *   mesh   the tile mesh, if the caller has one (buildMesh(group, domain, foldMeshOptions(group))); otherwise it is
 *          built here. Not needed, and not built, for the snowflake fold.
 *   opts   passed on to the fold module through foldOptions (see each module). The app passes { anchor }.
 */
export function createFold(group, domain, mesh = null, opts = {}) {
  const make = MAKERS[group.fold];
  if (!make) throw new Error(`folds: no fold module for fold type "${group.fold}" (group ${group.id})`);
  if (!mesh && group.fold !== 'snowflake') mesh = buildMesh(group, domain, foldMeshOptions(group));
  const fold = make(group, domain, mesh, foldOptions(opts));
  if (!fold || typeof fold.at !== 'function' || !fold.mesh) throw new Error(`folds: the ${group.fold} module returned no fold for ${group.id}`);
  return fold;
}

/** createFold with the mesh built here. */
export function buildFold(group, domain, opts = {}) { return createFold(group, domain, null, opts); }

export default createFold;
