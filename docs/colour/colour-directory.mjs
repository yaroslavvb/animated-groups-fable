/** Fills the three landing cards' counts from the colour catalog, exactly as
 * `../js/scott-gray-directory.mjs` does for the seventeen wallpaper cards. The
 * cards are complete static links without it; this only adds the numbers, so a
 * failed request costs the page nothing. */
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

try {
  const version = '20260919-colour-v1';
  const response = await fetch(`data/colour-atlas.json?v=${version}`);
  if (response.ok) {
    const atlas = await response.json();
    if (atlas.schema === 'colour-atlas-v1' && Array.isArray(atlas.entries)) {
      // The equation names live in the manifest from the build that added the
      // second wave of equations; the three originals are the fallback.
      const names = {'gray-scott': 'Gray–Scott', 'ginzburg-landau': 'Ginzburg–Landau', brusselator: 'Brusselator',
        ...Object.fromEntries(Object.entries(atlas.models ?? {}).map(([id, model]) => [id, model.name ?? id]))};
      for (const kind of ['gyre', 'trefoil']) {
        const card = document.querySelector(`.family-card[data-colouring="${kind}"]`);
        if (!card) continue;
        const entries = atlas.entries.filter(entry => entry.kind === kind);
        const models = new Map(), groups = new Set();
        for (const entry of entries) {
          models.set(entry.source.model, (models.get(entry.source.model) ?? 0) + 1);
          // Every hosting group, as the explorer page files them: 47 entries sit
          // in more than one, and counting canonical ids alone said 15 on a page
          // that offers 20 tiles.
          for (const id of entry.source.groupIds ?? [entry.source.groupId]) groups.add(id);
        }
        card.querySelector('[data-pattern-count]').textContent =
          `${plural(entries.length, 'verified colouring')} · ${plural(groups.size, 'film group')}`;
        card.querySelector('[data-equations]').textContent = [...models.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([id, count]) => `${names[id] ?? id} ${count}`).join(' · ');
        card.dataset.empty = String(entries.length === 0);
      }
      // The comparison table describes a character, not a law: 59 of the 200
      // Gyre entries do show a recolouring in one frozen frame and 87 have a
      // colour-preserving group finer than the lattice. The row now carries the
      // counts rather than asserting the ideal case for all of them.
      const gyre = atlas.entries.filter(entry => entry.kind === 'gyre');
      const figures = {
        'data-gyre-pi': `${gyre.filter(entry => entry.colourGroup === 'Z3').length} of ${gyre.length}; the rest measure S₃`,
        'data-gyre-entangled': `${gyre.filter(entry => entry.metrics?.fullyEntangled !== false).length} of ${gyre.length}`,
        'data-gyre-lattice': `${gyre.filter(entry => entry.metrics?.colourPreservingIsLatticeOnly === true).length} of ${gyre.length}`,
      };
      for (const [attribute, text] of Object.entries(figures)) {
        const slot = document.querySelector(`[${attribute}]`);
        if (slot) slot.textContent = `— ${text}`;
      }
      const summary = document.querySelector('#atlas-summary');
      if (summary) {
        // `counts.all` is where the build keeps the totals; an older build kept
        // them at the top of `counts`.
        const all = atlas.counts?.all ?? atlas.counts ?? {};
        const total = all.entries ?? atlas.entries.length;
        const fields = all.fields ?? new Set(atlas.entries.map(entry => entry.source.fieldSha256)).size;
        const equations = (all.models ?? Object.keys(atlas.models ?? {})).length;
        summary.textContent = `${total} colourings over ${fields} saved fields · ${plural(equations, 'equation')}`;
        // The refusals live in the build record beside the catalog, and they are
        // split across the two explorer pages — so the phrase that promises them
        // is a pair of links to those two blocks, not plain text that reads like
        // a link and is not one.
        try {
          const build = await fetch(`data/colour-atlas-build.json?v=${version}`);
          if (build.ok) {
            const refused = (await build.json()).refused;
            if (Array.isArray(refused)) {
              const byKind = {gyre: new Set(), trefoil: new Set()};
              for (const item of refused) byKind[item.kind]?.add(item.sha);
              const refusedTotal = byKind.gyre.size + byKind.trefoil.size;
              summary.append(` · ${refusedTotal} colourings refused, with reasons on `);
              for (const [index, kind] of ['gyre', 'trefoil'].entries()) {
                // A query, not a fragment: the fragment on an explorer page is
                // the view state, and `#refusals` would be read as a film group.
                const link = document.createElement('a');
                link.href = `${kind}/?show=refusals`;
                link.textContent = `${kind === 'gyre' ? 'Gyre' : 'Trefoil'} (${byKind[kind].size})`;
                summary.append(index ? ' and ' : '', link);
              }
            }
          }
        } catch { /* the refusal count is a footnote */ }
      }
    }
  }
} catch { /* the static cards are complete without the counts */ }
