/** Refreshes the seventeen landing cards' counts from the live catalog, exactly
 * as `../js/scott-gray-directory.mjs` does for the wallpaper cards and
 * `../colour/colour-directory.mjs` for the three colour ones.
 *
 * The cards are complete static links without it — `tools/make-family-pages.py`
 * stamps the counts in at build time so the page reads right with JavaScript
 * off — so a failed request costs the page nothing at all. What this adds is the
 * guarantee that a catalog rebuilt without re-stamping the pages still shows the
 * truth, and the equation breakdown, which is too long for the stamp. */
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const SCHEMAS = new Set(['monochrome-atlas-v1', 'monochrome-atlas-v2']);
/** v2 says outright which tier a reading is in; on v1 the nearest discriminator
 * is the measured half-period law, and the threshold is the control. */
const tierOf = entry => (['strict', 'broad', 'control'].includes(entry.tier) ? entry.tier
  : entry.kind === 'threshold' ? 'control'
    : entry.laws?.halfPeriod?.[1] === 1 ? 'strict' : 'broad');

try {
  const version = '20260919-mono-v1';
  const response = await fetch(`data/monochrome-atlas.json?v=${version}`);
  if (response.ok) {
    const atlas = await response.json();
    // Both shapes the builder has shipped, the same set `mono-atlas.mjs` gates
    // on. Naming only v1 here meant every visit fetched 4.4 MB and dropped it
    // on the floor, which looked like nothing at all because the stamped counts
    // happened to be current -- exactly the drift this module exists to catch.
    if (SCHEMAS.has(atlas.schema) && Array.isArray(atlas.entries) && atlas.fields) {
      const names = Object.fromEntries(Object.entries(atlas.models ?? {}).map(([id, model]) => [id, model.name ?? id]));
      const fields = atlas.fields;
      for (const card of document.querySelectorAll('.family-card[data-family]')) {
        const family = card.dataset.family;
        const here = atlas.entries.filter(entry => fields[entry.field]?.families?.includes(family));
        const pictures = new Set(here.map(entry => entry.field));
        // The strict tier: the rule's involution s is itself a spacetime
        // symmetry of the field. NOT `laws.halfPeriod`, which is a different
        // measurement -- 837 free involutions satisfy it too, so reading the
        // tier off it counted nearly every field as strict.
        const strict = new Set(here.filter(entry => tierOf(entry) === 'strict').map(entry => entry.field));
        const models = new Map();
        for (const key of pictures) {
          const model = fields[key]?.model;
          if (model) models.set(model, (models.get(model) ?? 0) + 1);
        }
        const count = card.querySelector('[data-picture-count]');
        const readings = card.querySelector('[data-readings]');
        if (count) count.textContent = plural(pictures.size, 'picture');
        if (readings) {
          // The same sentence `make-family-pages.py` stamps, so the live count
          // replaces the static one word for word and never half of it.
          readings.replaceChildren(
            `${plural(here.length, 'reading')} · ${strict.size} where `,
            Object.assign(document.createElement('i'), {textContent: 's'}),
            ' is a symmetry of the field');
          readings.title = [...models.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([id, n]) => `${names[id] ?? id} ${n}`).join(' · ');
        }
        card.dataset.empty = String(pictures.size === 0);
      }
      const summary = document.querySelector('#atlas-summary');
      if (summary) {
        const models = new Map();
        for (const field of Object.values(fields)) models.set(field.model, (models.get(field.model) ?? 0) + 1);
        const equations = [...models.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const strict = atlas.entries.filter(entry => tierOf(entry) === 'strict').length;
        summary.replaceChildren(
          `${Object.keys(fields).length} saved fields · ${plural(atlas.entries.length, 'reading')} (${strict} where `,
          Object.assign(document.createElement('i'), {textContent: 's'}),
          ` is a symmetry of the field) · ${equations.length} equations — `
            + equations.map(([id, n]) => `${names[id] ?? id} ${n}`).join(' · '));
      }
    }
  }
} catch { /* the static cards are complete without the counts */ }
