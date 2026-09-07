const integer = value => Number.isSafeInteger(value) && value >= 0;
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const NAMES = {'gray-scott': 'Gray–Scott', 'ginzburg-landau': 'Ginzburg–Landau', 'brusselator': 'Brusselator'};

// Search and numerical verification run offline; the directory reads only
// their saved counts. A failed index request leaves the static links usable.
async function loadCounts() {
  try {
    const response = await fetch('scott-gray/data/wallpaper-atlas-index.json?v=20260907-equations');
    if (!response.ok) return;
    const index = await response.json();
    if (!Array.isArray(index.families)) return;
    let loaded = 0;
    const seen = new Set();
    for (const family of index.families) {
      if (!/^[a-z0-9]+$/.test(family.id) || seen.has(family.id)) continue;
      const card = document.querySelector(`.family-card[data-family="${family.id}"]`);
      if (!card || !integer(family.verifiedPatternCount)) continue;
      seen.add(family.id);
      const count = family.verifiedPatternCount;
      card.dataset.empty = String(count === 0);
      card.querySelector('[data-pattern-count]').textContent = count ? plural(count, 'verified pattern') : 'No verified patterns';
      const models = Object.entries(family.models ?? {}).filter(([name, n]) => NAMES[name] && integer(n) && n > 0);
      card.querySelector('[data-equations]').textContent = models.map(([name, n]) => `${NAMES[name]} ${n}`).join(' · ');
      if (integer(family.timeSymmetryCount) && family.timeSymmetryCount > 0) {
        card.querySelector('.family-card-count').textContent = family.timeSymmetryCount === 1 ? '1 time symmetry' : `${family.timeSymmetryCount} time symmetries`;
      }
      loaded++;
    }
    if (loaded === 17 && integer(index.uniqueFieldCount)) {
      const models = Object.entries(index.models ?? {}).filter(([name, n]) => NAMES[name] && integer(n) && n > 0).map(([name, n]) => `${NAMES[name]} ${n}`);
      document.querySelector('#atlas-summary').textContent = `${plural(index.uniqueFieldCount, 'saved field')}${models.length ? ' · ' + models.join(' · ') : ''}`;
    }
  } catch {
    // The catalog remains navigable offline or during a deployment.
  }
}

loadCounts();
