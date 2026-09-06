const integer = value => Number.isSafeInteger(value) && value >= 0;
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// Search and numerical verification run offline; the directory reads only
// their saved counts. A failed index request leaves the static links usable.
async function loadCounts() {
  try {
    const response = await fetch('scott-gray/data/wallpaper-atlas-index.json');
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
      card.querySelector('[data-parameter-count]').textContent = count && integer(family.verifiedParameterCount)
        ? plural(family.verifiedParameterCount, 'parameter set') : '';
      if (integer(family.timeSymmetryCount) && family.timeSymmetryCount > 0) {
        card.querySelector('.family-card-count').textContent = plural(family.timeSymmetryCount, 'type');
      }
      loaded++;
    }
    if (loaded === 17) document.querySelector('#atlas-summary').textContent = integer(index.uniqueFieldCount)
      ? plural(index.uniqueFieldCount, 'saved field') : 'Precomputed periodic solutions';
  } catch {
    // The catalog remains navigable offline or during a deployment.
  }
}

loadCounts();
