/** The Colour catalog loader.
 *
 * `data/colour-atlas.json` (schema `colour-atlas-v1`) is a build artifact of
 * `tools/build-colour-catalog.py`: for every saved triangular orbit of the
 * wallpaper atlas it records the Gyre and/or Trefoil colouring of that field,
 * the exhaustive measurement of the coloured picture's symmetries, and why a
 * field was refused where it was. This module loads it, **gates** it, and hands
 * the page frozen entries. It never re-derives a colour law, a permutation or a
 * group: it reads them, checks their shape, and refuses the file if anything is
 * inconsistent — a broken catalog must not render.
 *
 * Only the selected field is downloaded, through the site's one download path
 * (`scott-gray/precomputed-catalog.mjs`), which checks the byte length and the
 * SHA-256 before the bytes are decoded.
 */
import {downloadOrbitBytes} from '../scott-gray/precomputed-catalog.mjs?v=20260905-gallery-fix';

const SCHEMA = 'colour-atlas-v1';
/** The offline gate the builder stamps on the catalog and on every entry. */
const GATE = 'colour-offline-v1';
const HASH = /^[a-f0-9]{64}$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[A-Za-z0-9:._-]{1,512}$/;

/** How each equation is named, written and charted. The catalog carries the
 * parameters; this table carries the prose and the axes. A future catalog may
 * ship its own `models` block (design §4) — it is merged over this one, so a
 * new equation plugs in with data alone and an unknown model still renders from
 * the shape of its own parameter object. */
export const MODELS = Object.freeze({
  'gray-scott': {
    name: 'Gray–Scott', axes: ['F', 'k'],
    labels: {F: 'F', k: 'k', Du: 'Dᵤ', Dv: 'Dᵥ', dx: 'dx'},
    parameters: ['F', 'k', 'Du', 'Dv'], diffusion: ['Du', 'Dv'], channels: ['U', 'V'],
    equation: 'uₜ = Dᵤ∇²u − uv² + F(1 − u)\nvₜ = Dᵥ∇²v + uv² − (F + k)v',
    description: 'An autocatalytic feed–kill system: U is fed at rate F and consumed by the reaction U + 2V → 3V, while V is removed at rate F + k. Its rotating and interwoven waves on a triangular lattice supply most of the hexagonal catalog. The colouring reads the U channel only.',
  },
  'ginzburg-landau': {
    name: 'Ginzburg–Landau', axes: ['alpha', 'beta'],
    labels: {alpha: 'α', beta: 'β', D: 'D', dx: 'dx'},
    parameters: ['alpha', 'beta', 'D'], diffusion: ['D'], channels: ['Re A', 'Im A'],
    equation: 'Aₜ = A + (1 + iα)D∇²A − (1 − iβ)|A|²A,  A = u + iv',
    description: 'The universal amplitude equation just past a Hopf bifurcation. It is equivariant under the global phase rotation A ↦ e^{iφ}A, which is why a spatial operation’s phase winding becomes a time shift: its relative equilibria are exactly periodic, and its spiral lattices give the cleanest threefold screws in the catalog.',
  },
  'brusselator': {
    name: 'Brusselator', axes: ['b', 'a'],
    labels: {a: 'a', b: 'b', Du: 'Dᵤ', Dv: 'Dᵥ', dx: 'dx'},
    parameters: ['a', 'b', 'Du', 'Dv'], diffusion: ['Du', 'Dv'], channels: ['U', 'V'],
    equation: 'uₜ = Dᵤ∇²u + a − (b + 1)u + u²v\nvₜ = Dᵥ∇²v + bu − u²v',
    description: 'A two-species autocatalytic model with a Hopf point at b = 1 + a². Its periodic orbits here are reached by lifting a Ginzburg–Landau spiral lattice through the Hopf eigenvector and polishing the twisted shooting equation, so they carry the same time-shift character with visibly different chemistry: sharper crests, slower drift.',
  },
});

/** The two colourings this category publishes. `kind` is the catalog's own key. */
export const COLOURINGS = Object.freeze({
  gyre: {
    kind: 'gyre', name: 'Gyre', colourGroup: 'Z₃', slug: 'gyre',
    rule: 'colour(x, t) = argmaxₖ U(gᵏ x, t + k T/3)',
    blurb: 'Three colours welded to a third-turn about a point of no symmetry: turn, wait a third of the loop, and step every colour back one.',
  },
  trefoil: {
    kind: 'trefoil', name: 'Trefoil', colourGroup: 'S₃', slug: 'trefoil',
    rule: 'colour(x, t) = argmaxₖ U(x + k b, t)',
    blurb: 'Three colours whose 3-cycle is a plain slide and whose swaps are welded to a half-turn and half a period.',
  },
});

const freeze = value => {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};
const integers = value => Array.isArray(value) && value.every(Number.isInteger);
const range = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && value[1] > value[0];
const bad = (id, why) => { throw Error(`Colour catalog entry ${id}: ${why}`); };
/** The Trefoil colour law as a row of the measured table: the pure slide by
 * b = (N/3, 2N/3) at no time shift, cycling the three colours. */
const bSlide = entry => (entry.symmetries ?? []).find(sym => sym.name === '1' && !sym.frames
  && sym.v?.[0] === entry.colouring?.bNodes?.[0] && sym.v?.[1] === entry.colouring?.bNodes?.[1]
  && sym.perm?.[0] !== 0) ?? null;

/** Every field the page shows, read off one catalog entry, in one place so the
 * rest of the code never reaches into the raw JSON shape — and so that a build
 * which hoists a field to the manifest, or adds one, is absorbed here. */
function describe(entry, groups, models, failureLabels) {
  const s = entry.source, c = entry.colouring, m = entry.metrics;
  const group = groups.get(s.groupId) ?? null;
  const model = models[s.model] ?? null;
  return {
    id: entry.id,
    kind: entry.kind,
    groupId: s.groupId,
    groupIds: s.groupIds ?? [s.groupId],
    signature: group?.signature ?? s.groupId,
    orbifold: group?.orbifold ?? '',
    family: group?.family ?? '',
    model: s.model,
    modelName: model?.name ?? s.model,
    name: s.name,
    N: s.N, M: s.M, L: s.L, period: s.period,
    params: s.params,
    ranges: s.ranges,
    /** Some records save only the channel the colouring reads. */
    hasSecondChannel: range(s.ranges?.v),
    fieldSha256: s.fieldSha256,
    shortSha: s.fieldSha256.slice(0, 12),
    byteLength: s.fieldByteLength ?? 8 * s.N * s.N * s.M,
    valueCount: s.fieldValueCount ?? 2 * s.N * s.N * s.M,
    atlasIds: s.atlasIds?.length ? s.atlasIds : [s.provenance?.job ?? s.fieldSha256.slice(0, 16)],
    origin: s.origin ?? 'atlas',
    sourceProvenance: s.provenance ?? null,
    gate: s.gate ?? null,
    chirality: s.chirality ?? null,
    colouring: c,
    symmetries: entry.symmetries,
    // A failure row names its prose by index into the manifest's shared list;
    // older builds carried the sentence on the row itself.
    failures: entry.failures.map(failure => ({
      ...failure,
      what: failure.what ?? failureLabels[failure.label] ?? 'a combination that is not a symmetry',
    })),
    colourGroup: entry.colourGroup,
    colourGroupOrder: entry.colourGroupOrder,
    colourPreservingGroup: entry.colourPreservingGroup,
    pictureGroup: entry.pictureGroup,
    exactSymmetryCount: entry.exactSymmetryCount,
    metrics: m,
    /** What the page prints as "colour-law violations" and "argmax ties",
     * measured rather than written in. A Gyre entry carries the law as a
     * metric; a Trefoil entry carries it as the b-slide row of its table. */
    law: entry.kind === 'gyre' ? m.law ?? null : bSlide(entry)?.agreement ?? null,
    ties: m.ties ?? null,
    /** Three samples of ONE frame, not three frames: on 123 of the Gyre fields
     * the threefold screw collapses the compared triple into a single instant.
     * The wait is still what makes the law a symmetry — this only says the rule
     * is computable from one frame. */
    sameInstant: c.sameInstant ?? null,
    featured: !!entry.featured,
    featuredWhy: entry.featuredWhy ?? null,
    shippedPage: entry.shippedPage ?? null,
    splitRecolourings: entry.splitRecolourings ?? [],
    runnersUp: entry.runnersUp ?? [],
    generators: Array.isArray(entry.generators) && entry.generators.length ? entry.generators : null,
    generatorRelation: entry.generatorRelation ?? null,
    centres: entry.centres ?? null,
    markNotes: entry.markNotes ?? [],
    cellSixths: Number.isInteger(entry.cellSixths) ? entry.cellSixths : 6,
    symbol: entry.symbol ?? null,
    fullyEntangled: m.fullyEntangled ?? null,
    latticeOnly: m.colourPreservingIsLatticeOnly ?? null,
    swapEntangled: m.swapEntangled ?? null,
    fieldUrl: null, thumbnail: null, raw: entry,
  };
}

/** Loads, gates and indexes one `colour-atlas-v1` manifest.
 *
 * `groups` is `scott-gray/wallpaper-groups.json`'s group list, used only for the
 * film group's signature and lattice; `baseUrl` is `docs/colour/`. */
export function createColourCatalog(manifest, {groups = [], baseUrl = new URL('./', import.meta.url), fetcher = globalThis.fetch, maxCachedOrbits = 2} = {}) {
  if (manifest?.schema !== SCHEMA || !Array.isArray(manifest.entries)) throw Error('Unsupported colour atlas.');
  if (manifest.gateVersion !== undefined && manifest.gateVersion !== GATE) throw Error(`Unsupported colour gate ${manifest.gateVersion}.`);
  if (!Array.isArray(manifest.palette) || manifest.palette.length !== 3 || !manifest.palette.every(hex => HEX.test(hex))) throw Error('The colour atlas needs three hex colours.');
  if (typeof fetcher !== 'function') throw Error('A field fetcher is required.');
  const canonical = new Map(groups.map(group => [group.id, group]));
  // The manifest's own model and colouring blocks win: a new equation must plug
  // in with data alone (design §4), and the tables here are the fallback for a
  // build that predates them.
  const models = {...MODELS, ...(manifest.models ?? {})};
  const colourings = Object.fromEntries(Object.entries(COLOURINGS)
    .map(([kind, base]) => [kind, {...base, ...(manifest.colourings?.[kind] ?? {}), colourGroup: base.colourGroup}]));
  const failureLabels = Array.isArray(manifest.failureLabels) ? manifest.failureLabels : [];
  const entries = new Map(), byKind = new Map([['gyre', []], ['trefoil', []]]), warnings = [];
  const loaded = new Map(), inflight = new Map(), branded = new WeakSet();

  for (const source of manifest.entries) {
    const entry = structuredClone(source), s = entry.source, c = entry.colouring, m = entry.metrics;
    const id = entry.id;
    if (typeof id !== 'string' || !ID.test(id) || entries.has(id)) throw Error('Colour entries need unique, URL-safe ids.');
    if (!byKind.has(entry.kind)) bad(id, `unknown colouring ${entry.kind}`);
    if (!canonical.has(s?.groupId)) bad(id, `unknown film group ${s?.groupId}`);
    if (canonical.get(s.groupId).lattice !== 'triangular') bad(id, 'the film group is not triangular');
    // The page files an entry under every id in `groupIds`, so every one of
    // them has to name a real triangular group and to include the canonical
    // one — a tile for an unknown group would have no signature to print.
    for (const other of s.groupIds ?? []) {
      if (!canonical.has(other)) bad(id, `unknown hosting film group ${other}`);
      if (canonical.get(other).lattice !== 'triangular') bad(id, `hosting film group ${other} is not triangular`);
    }
    if (s.groupIds && !s.groupIds.includes(s.groupId)) bad(id, 'groupIds does not contain the canonical film group');
    if (s.params?.stencil !== 'triangular-six') bad(id, 'the diffusion stencil is not triangular-six');
    if (!Number.isInteger(s.N) || s.N < 4 || !Number.isInteger(s.M) || s.M < 6 || s.M % 3) bad(id, 'incompatible grid or frame count');
    if (!Number.isFinite(s.period) || s.period <= 0 || !Number.isFinite(s.L) || s.L <= 0) bad(id, 'invalid period or box length');
    if (!models[s.model]) bad(id, `unknown equation ${s.model}`);
    for (const name of models[s.model].parameters ?? []) if (!Number.isFinite(s.params[name])) bad(id, `parameter ${name} is not a number`);
    for (const name of models[s.model].diffusion ?? []) if (!(s.params[name] > 0)) bad(id, `diffusion ${name} must be positive`);
    if (typeof s.fieldUrl !== 'string' || !s.fieldUrl || !HASH.test(s.fieldSha256 ?? '')) bad(id, 'invalid field metadata');
    if (s.fieldEncoding !== undefined && s.fieldEncoding !== 'float32-le') bad(id, `unsupported field encoding ${s.fieldEncoding}`);
    // The byte count is what the download is checked against, so it must agree
    // with the grid rather than merely be present.
    const values = s.fieldValueCount ?? 2 * s.N * s.N * s.M;
    const channels = s.channels ?? 2;
    if (values !== channels * s.N * s.N * s.M) bad(id, 'the field value count does not match the grid');
    if ((s.fieldByteLength ?? 4 * values) !== 4 * values) bad(id, 'the field byte length does not match its value count');
    // Only the channel the colouring reads is required; a search record may
    // save the range of that one alone.
    if (!range(s.ranges?.u)) bad(id, 'missing the concentration range of the channel the colouring reads');
    if (typeof entry.thumbnail !== 'string' || !entry.thumbnail) bad(id, 'missing thumbnail');
    if (s.gate?.gateVersion !== undefined && s.gate.gateVersion !== GATE) bad(id, `unsupported entry gate ${s.gate.gateVersion}`);
    if (s.gate !== undefined && s.gate?.passed !== true) bad(id, 'the orbit did not pass its own gate');
    // The colouring's own exactness, which is what this catalog is for. Both
    // numbers are printed on the page, so both are gated here rather than
    // written in as literals: `ties` is the argmax's own exactness and `law` is
    // the agreement of the colouring rule with the relabelled film. A Trefoil
    // entry records no `law` — its 3-cycle is a measured symmetry of the table
    // rather than a separate scan — and the page reads that row off the table.
    if (m?.ties !== 0) bad(id, 'the argmax ties: the colour law is not exact');
    if (m?.law !== undefined && m.law !== 1) bad(id, 'the colour law does not hold at every node-frame');
    if (entry.kind === 'gyre' && m?.law !== 1) bad(id, 'a Gyre entry must carry a measured colour law of exactly 1');
    if (!Array.isArray(entry.symmetries) || !entry.symmetries.length) bad(id, 'no measured symmetries');
    for (const sym of entry.symmetries) {
      if (sym.agreement !== 1) bad(id, 'a measured symmetry is not exact');
      if (!Array.isArray(sym.perm) || [...sym.perm].sort().join('') !== '012') bad(id, 'a measured symmetry has no colour permutation');
    }
    if (!Array.isArray(entry.failures)) bad(id, 'no measured non-symmetries');
    for (const failure of entry.failures) if (!(failure.agreement < 1)) bad(id, 'a listed non-symmetry is in fact exact');
    if (!['Z3', 'S3', 'Z2', '1'].includes(entry.colourGroup)) bad(id, `unexpected colour group ${entry.colourGroup}`);
    // The integrality that makes every claim checkable without interpolation.
    if (entry.kind === 'gyre') {
      if (!integers(c.w) || c.w.length !== 2) bad(id, 'the turn translation w must be whole nodes');
      if (c.pDenominator !== 3 * s.N) bad(id, 'the turn centre is not on the 1/(3N) grid');
    } else {
      if (s.N % 3) bad(id, 'N is not divisible by 3, so b is not a whole node');
      if (!integers(c.bNodes) || c.bNodes[0] !== s.N / 3 || c.bNodes[1] !== 2 * s.N / 3) bad(id, 'b is not (N/3, 2N/3)');
      // A Trefoil entry carries no scalar `law`: the colour law *is* the slide
      // by b, and it is measured as a row of the symmetry table. Requiring the
      // row here is what lets the page print the law's agreement from the data
      // instead of from a literal.
      if (!bSlide(entry)) bad(id, 'the slide by b is not among the measured symmetries, so the colour law is unwitnessed');
    }
    // The generator marks are decoration over evidence the page has already
    // gated, and they arrive in a later build of the catalog than the rest. A
    // malformed mark therefore drops the whole mark layer for that entry and is
    // reported in `warnings`, rather than taking the page down with it — unlike
    // every check above, each of which is about whether the picture may be
    // shown at all.
    if (Array.isArray(entry.generators) && entry.generators.length) {
      // A Gyre turn centre is on the 1/(3N) grid, not on the sixths grid, so a
      // mark may give its place as lattice coordinates instead.
      const placed = g => integers(g.centreSixths ?? g.vectorSixths ?? null)
        || (Array.isArray(g.centre ?? g.vector) && (g.centre ?? g.vector).length === 2 && (g.centre ?? g.vector).every(Number.isFinite));
      const why = !Number.isInteger(entry.cellSixths) || entry.cellSixths < 1
        ? 'cellSixths must be a positive integer'
        : entry.generators.find(g => !Array.isArray(g.perm) || [...g.perm].sort().join('') !== '012')
          ? 'a generator has no colour permutation'
          : entry.generators.find(g => !placed(g))
            ? 'a generator has no centre or vector'
            : entry.generators.find(g => typeof g.name !== 'string' || !g.name)
              ? 'a generator has no name'
              : entry.generators.find(g => g.violations !== undefined && g.violations !== 0)
                ? 'a generator was measured with violations' : null;
      if (why) { warnings.push(`${id}: generator marks dropped — ${why}`); entry.generators = null; }
    } else entry.generators = null;
    const view = describe(entry, canonical, models, failureLabels);
    view.fieldUrl = new URL(`../${s.fieldUrl}`, baseUrl).href;
    view.thumbnail = new URL(entry.thumbnail, baseUrl).href;
    freeze(view);
    entries.set(id, view);
    byKind.get(entry.kind).push(view);
  }
  for (const list of byKind.values()) Object.freeze(list);
  const all = Object.freeze([...entries.values()]);
  // The chirality pair the build record names: two admitted fields that are the
  // same picture at opposite handedness, related by a mirror of the plane. The
  // link is by field SHA-256, so it is the build's own statement rather than a
  // guess from matching metrics.
  const bySha = new Map();
  for (const entry of all) {
    if (!bySha.has(entry.fieldSha256)) bySha.set(entry.fieldSha256, []);
    bySha.get(entry.fieldSha256).push(entry);
  }
  const partnerOf = entry => {
    const sha = entry?.chirality?.partnerSha256;
    if (!sha) return null;
    return (bySha.get(sha) ?? []).find(other => other.kind === entry.kind && other.id !== entry.id) ?? null;
  };
  // Refusals moved into the build record beside the catalog; an older build
  // carried them on the manifest itself.
  let refused = Array.isArray(manifest.refused) ? manifest.refused : [];

  const load = id => {
    if (loaded.has(id)) { const record = loaded.get(id); loaded.delete(id); loaded.set(id, record); return Promise.resolve(record); }
    if (inflight.has(id)) return inflight.get(id);
    const summary = entries.get(id);
    if (!summary) return Promise.reject(Error('Unknown colour entry.'));
    const promise = (async () => {
      const bytes = await downloadOrbitBytes(summary.fieldUrl, {fetcher, byteLength: summary.byteLength, fieldSha256: summary.fieldSha256});
      const view = new DataView(bytes), field = new Float32Array(summary.valueCount);
      for (let i = 0; i < field.length; i++) {
        field[i] = view.getFloat32(4 * i, true);
        if (!Number.isFinite(field[i])) throw Error('The downloaded field contains a non-finite value.');
      }
      const record = Object.freeze({...summary, field, kind2: 'verified-colouring'});
      branded.add(record);
      loaded.set(id, record);
      while (loaded.size > maxCachedOrbits) loaded.delete(loaded.keys().next().value);
      return record;
    })();
    inflight.set(id, promise);
    promise.then(() => inflight.delete(id), () => inflight.delete(id));
    return promise;
  };

  return Object.freeze({
    manifest: freeze(structuredClone({
      schema: manifest.schema, gateVersion: manifest.gateVersion ?? GATE,
      generated: manifest.generated, source: manifest.source,
      palette: manifest.palette, counts: manifest.counts, provenance: manifest.provenance,
      gates: manifest.gates ?? {}, notes: manifest.notes ?? [],
      // `shape` says how to read a symmetry row, a failure row and the field
      // bytes. The page prints the symmetry sentence under its table and the
      // export carries the whole block, so a copied entry is readable: without
      // it the `v` of a row and the layout of the field are conventions the
      // reader has to guess.
      shape: manifest.shape ?? {},
    })),
    models: freeze(structuredClone(models)),
    colourings: freeze(structuredClone(colourings)),
    notation: freeze(structuredClone(manifest.notation ?? {})),
    /** The tables the build hoists out of the entries: a failure row names its
     * prose by index into `failureLabels`, and a symmetry row names its point
     * operation by a key of `pointOps`. An entry copied out of the catalog —
     * the export button does exactly that — means nothing without them. */
    failureLabels: Object.freeze([...failureLabels]),
    pointOps: freeze(structuredClone(manifest.pointOps ?? {})),
    palette: Object.freeze([...manifest.palette]),
    load,
    /** Marks dropped for a malformed record — never a reason to refuse the page. */
    warnings: Object.freeze([...warnings]),
    get: id => entries.get(id) ?? null,
    /** The canonical wallpaper group record for any film group id. An entry is
     * hosted by every id in its `groupIds`, and the supergroups it also sits in
     * have their own signature, orbifold and phase order. */
    groupMeta: id => canonical.get(id) ?? null,
    all: kind => (kind === undefined ? all : byKind.get(kind) ?? []),
    size: kind => (kind === undefined ? all.length : byKind.get(kind)?.length ?? 0),
    isVerified: record => branded.has(record),
    partnerOf,
    /** The build record carries the refusals and the mining counts; it is a
     * side file, so a missing one costs the page a footnote and nothing else. */
    async loadBuildRecord(url = new URL('data/colour-atlas-build.json', baseUrl)) {
      try {
        const response = await fetcher(url);
        if (!response.ok) return false;
        const build = await response.json();
        if (Array.isArray(build.refused)) { refused = build.refused; return true; }
      } catch { /* the footnote is optional */ }
      return false;
    },
    /** The refusal reasons for one colouring, collapsed to distinct sentences
     * with a count each — the "why some fields cannot host this colouring" note.
     *
     * Every reason carries per-field numbers, so the sentences have to be
     * grouped by their *shape* or the note would list 439 near-identical lines.
     * Collapsing them to a placeholder, though, eats the only quantitative
     * content the block has — and it is the page's evidence for why 479 of 737
     * candidates were rejected. So each numeric slot is kept and rendered as the
     * range the group spans, which stays one line and still says how tied a
     * refused field was. A digit welded to a letter or a slash is part of a
     * name — Z2, S3, T/3 — and is not a slot. */
    refusals(kind) {
      const SLOT = /(?<![A-Za-z/])\d+(?:[.,]\d+)*%?(?![A-Za-z])/g;
      const groups = new Map();
      for (const item of refused) {
        if (item.kind !== kind) continue;
        const text = String(item.why);
        const slots = text.match(SLOT) ?? [];
        const template = text.replace(SLOT, ' ');
        if (!groups.has(template)) groups.set(template, {count: 0, slots: slots.map(() => [])});
        const group = groups.get(template);
        group.count++;
        slots.forEach((value, index) => group.slots[index]?.push(value));
      }
      const span = values => {
        const unique = [...new Set(values)];
        if (unique.length <= 1) return unique[0] ?? '—';
        const number = value => Number(String(value).replace(/[%,]/g, ''));
        const sorted = unique.slice().sort((a, b) => number(a) - number(b));
        // Only a plain whole count is regrouped; a decimal or a percentage is
        // printed exactly as the build wrote it, because rounding an agreement
        // of 0.998263889 to 0.998 would quietly turn evidence into a shrug.
        const show = value => (/^\d+$/.test(value) ? number(value).toLocaleString('en-GB') : value);
        return `${show(sorted[0])}–${show(sorted[sorted.length - 1])}`;
      };
      return [...groups.entries()].map(([template, group]) => {
        let index = 0;
        const why = template.replace(/ /g, () => span(group.slots[index++]));
        return {why, count: group.count};
      }).sort((a, b) => b.count - a.count);
    },
  });
}

/** Fetches the manifest and the canonical groups, then builds the catalog. */
export async function loadColourCatalog({baseUrl = new URL('./', import.meta.url), version = '', fetcher = globalThis.fetch} = {}) {
  const query = version ? `?v=${version}` : '';
  const [atlas, groups] = await Promise.all([
    fetcher(new URL(`data/colour-atlas.json${query}`, baseUrl)),
    fetcher(new URL(`../scott-gray/wallpaper-groups.json${query}`, baseUrl)),
  ]);
  if (!atlas.ok || !groups.ok) throw Error('The colour catalog could not be loaded.');
  const [manifest, metadata] = await Promise.all([atlas.json(), groups.json()]);
  // The build record is NOT awaited here: it is a quarter-megabyte side file
  // whose only job is the refusal list inside a closed <details>, and awaiting
  // it put that cost on every first paint. The caller loads it when it wants
  // it, and the catalog is complete without it.
  return createColourCatalog(manifest, {groups: metadata.groups, baseUrl, fetcher});
}
