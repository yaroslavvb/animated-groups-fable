(async () => {
  const svg = document.querySelector('#graph');
  const status = document.querySelector('#status');
  if (!svg) return;

  const ns = 'http://www.w3.org/2000/svg';
  const SUP_TO_ASCII = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
  };

  const make = (name, attrs = {}) => {
    const el = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  };

  // Render Chaim short-form notation (e.g. ²2²2²2²2, ∗¹2²2¹2²2) with uniform
  // superscript tspans matching the HTML .tab-signature / .book-color-signature.
  function renderChaimSvgText(textEl, chaim) {
    textEl.textContent = '';
    let i = 0;
    let offset = 0;
    const supShift = -4.2;
    while (i < chaim.length) {
      if (SUP_TO_ASCII[chaim[i]]) {
        let run = '';
        while (i < chaim.length && SUP_TO_ASCII[chaim[i]]) {
          run += SUP_TO_ASCII[chaim[i]];
          i += 1;
        }
        const dy = supShift - offset;
        offset = supShift;
        const attrs = { class: 'chaim-sup' };
        if (Math.abs(dy) > 0.01) attrs.dy = String(dy);
        const tspan = make('tspan', attrs);
        tspan.textContent = run;
        textEl.append(tspan);
      } else {
        let run = '';
        while (i < chaim.length && !SUP_TO_ASCII[chaim[i]]) {
          run += chaim[i];
          i += 1;
        }
        const dy = 0 - offset;
        offset = 0;
        const attrs = { class: 'chaim-base' };
        if (Math.abs(dy) > 0.01) attrs.dy = String(dy);
        const tspan = make('tspan', attrs);
        tspan.textContent = run;
        textEl.append(tspan);
      }
    }
  }

  function describeGroup(g) {
    const colorWord = `${g.colors} colour${g.colors === 1 ? '' : 's'}`;
    const rollingNote = g.kernel_hm !== g.family
      ? `still frame ${g.kernel_orbifold} (${g.kernel_hm}) → rolling projection ${g.projected_orbifold} (${g.family})`
      : g.colors > 1
        ? `still frame ${g.kernel_orbifold} (${g.kernel_hm}, coarser sublattice) → rolling projection ${g.projected_orbifold} (${g.family})`
        : `static ${g.projected_orbifold} (${g.family}) in every frame`;
    return `${g.chaim} · clockwork ${g.symbol} · No. ${g.number} ${g.hm} · ${colorWord} · ${rollingNote}`;
  }

  function matchesRollingFilter(g, rollingFilter) {
    switch (rollingFilter) {
      case 'rolling-only':
        return g.kernel_hm !== g.family;
      case 'pure-rolling':
        return g.kernel_hm === 'p1' && g.colors > 1;
      case 'any-rolling':
        return g.colors > 1;
      case 'frame-keeps':
        return g.kernel_hm === g.family;
      case 'static':
        return g.colors === 1;
      case 'all':
      default:
        return true;
    }
  }

  function matchesFilters(g, colorsFilter, rollingFilter) {
    const colorOk = colorsFilter === 'all' || String(g.colors) === colorsFilter;
    const rollingOk = matchesRollingFilter(g, rollingFilter);
    return colorOk && rollingOk;
  }

  try {
    const response = await fetch('data/polar-inclusions.json');
    if (!response.ok) throw new Error('Could not load the inclusion data');
    const { groups, edges } = await response.json();
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));

    // Build transitive reachability (strict inclusion partial order) from covering edges.
    const directChildren = Object.fromEntries(groups.map((g) => [g.id, []]));
    edges.forEach(([a, b]) => directChildren[a].push(b));
    const descendants = {};
    for (const g of groups) {
      const seen = new Set();
      const stack = [...directChildren[g.id]];
      while (stack.length) {
        const cur = stack.pop();
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const next of directChildren[cur]) {
          if (!seen.has(next)) stack.push(next);
        }
      }
      descendants[g.id] = seen;
    }
    const isStrictSubgroup = (a, b) => descendants[a]?.has(b) ?? false;

    const colorSelects = [...document.querySelectorAll('[data-filter-colors]')];
    const rollingSelects = [...document.querySelectorAll('[data-filter-rolling]')];
    const modeSelects = [...document.querySelectorAll('[data-filter-hasse-mode]')];
    const resetButtons = [...document.querySelectorAll('[data-filter-reset]')];
    const statusOutputs = [...document.querySelectorAll('[data-filter-status]')];
    const familyCards = [...document.querySelectorAll('.family-card[data-family-hm]')];

    const params = new URLSearchParams(location.search);
    let state = {
      colors: params.get('colors') || 'all',
      rolling: params.get('rolling') || 'all',
      mode: params.get('mode') || 'highlight',
    };
    if (!['all', '1', '2', '3', '4', '6'].includes(state.colors)) state.colors = 'all';
    if (!['all', 'rolling-only', 'pure-rolling', 'any-rolling', 'frame-keeps', 'static'].includes(state.rolling)) {
      state.rolling = 'all';
    }
    if (!['highlight', 'induced'].includes(state.mode)) state.mode = 'highlight';

    let defaultStatusText = '';

    function renderHasseDiagram(subsetGroups, matchSet, isFiltered) {
      svg.textContent = '';
      if (subsetGroups.length === 0) {
        svg.setAttribute('viewBox', '0 0 680 120');
        svg.setAttribute('width', '680');
        svg.setAttribute('height', '120');
        const emptyText = make('text', {
          x: '340',
          y: '64',
          class: 'hasse-empty-text',
          'text-anchor': 'middle',
        });
        emptyText.textContent = 'No groups match this combination of filters.';
        svg.append(emptyText);
        return { displayedEdgesCount: 0, matchingEdgesCount: 0 };
      }

      const subIds = subsetGroups.map((g) => g.id);
      const subById = Object.fromEntries(subsetGroups.map((g) => [g.id, { ...g }]));

      // Covering edges of the induced sub-poset on subsetGroups
      const subEdges = [];
      for (const a of subIds) {
        for (const b of subIds) {
          if (!isStrictSubgroup(a, b)) continue;
          const covered = subIds.some((c) => isStrictSubgroup(a, c) && isStrictSubgroup(c, b));
          if (!covered) subEdges.push([a, b]);
        }
      }

      const parents = Object.fromEntries(subIds.map((id) => [id, []]));
      const children = Object.fromEntries(subIds.map((id) => [id, []]));
      subEdges.forEach(([a, b]) => {
        children[a].push(b);
        parents[b].push(a);
      });

      const ordered = Object.values(subById).sort((a, b) => a.order - b.order || a.number - b.number);
      for (const g of ordered) {
        g.level = parents[g.id].length
          ? 1 + Math.max(...parents[g.id].map((id) => subById[id].level))
          : 0;
      }

      const layers = [];
      ordered.forEach((g) => (layers[g.level] ||= []).push(g));

      // Alternate sweeps place related groups near one another to reduce crossings.
      for (let pass = 0; pass < 12; pass += 1) {
        const down = pass % 2 === 0;
        const indexes = down
          ? layers.map((_, i) => i).slice(1)
          : layers.map((_, i) => i).slice(0, -1).reverse();
        for (const i of indexes) {
          const positions = Object.fromEntries(
            layers.flatMap((layer) => layer.map((g, n) => [g.id, (n + 0.5) / layer.length])),
          );
          const score = (g) => {
            const neighbors = (down ? parents : children)[g.id];
            return neighbors.length
              ? neighbors.reduce((sum, id) => sum + positions[id], 0) / neighbors.length
              : positions[g.id];
          };
          layers[i].sort((a, b) => score(a) - score(b) || a.number - b.number);
        }
      }

      const maxCount = Math.max(...layers.map((layer) => layer.length));
      const width = Math.max(820, maxCount * 112 + 40);
      const rowStep = 108;
      const boxWidth = 96;
      const boxHeight = 40;
      const height = layers.length * rowStep + 28;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));

      layers.forEach((layer, level) => layer.forEach((g, i) => {
        g.x = (width * (i + 0.5)) / layer.length;
        g.y = 24 + level * rowStep;
      }));

      const edgeElements = [];
      let matchingEdgesCount = 0;
      subEdges.forEach(([a, b]) => {
        const from = subById[a];
        const to = subById[b];
        const bothMatch = matchSet.has(a) && matchSet.has(b);
        if (bothMatch) matchingEdgesCount += 1;
        const classes = ['edge'];
        if (isFiltered && state.mode === 'highlight') {
          classes.push(bothMatch ? 'is-match' : 'is-dimmed');
        }
        const line = make('path', {
          class: classes.join(' '),
          d: `M ${from.x} ${from.y + boxHeight} L ${to.x} ${to.y}`,
          'aria-hidden': 'true',
        });
        svg.append(line);
        edgeElements.push({ a, b, line });
      });

      const nodeElements = new Map();
      const highlightNode = (activeId) => {
        if (!activeId) {
          edgeElements.forEach(({ line }) => line.classList.remove('active'));
          nodeElements.forEach((el) => el.classList.remove('is-neighbor'));
          if (status) status.textContent = defaultStatusText;
          return;
        }
        const connected = new Set([activeId]);
        edgeElements.forEach(({ a, b, line }) => {
          const hit = a === activeId || b === activeId;
          line.classList.toggle('active', hit);
          if (hit) {
            connected.add(a);
            connected.add(b);
          }
        });
        nodeElements.forEach((el, id) => {
          el.classList.toggle('is-neighbor', connected.has(id) && id !== activeId);
        });
        if (status && byId[activeId]) {
          status.textContent = describeGroup(byId[activeId]);
        }
      };

      for (const g of ordered) {
        const isMatch = matchSet.has(g.id);
        const rollingOnly = g.kernel_hm !== g.family;
        const classes = ['node'];
        if (g.level >= layers.length / 2) classes.push('high');
        if (rollingOnly) classes.push('is-rolling-only');
        if (isFiltered && state.mode === 'highlight') {
          classes.push(isMatch ? 'is-match' : 'is-dimmed');
        }

        const link = make('a', {
          href: `correspondence-${g.family}.html#${g.id}`,
          class: classes.join(' '),
          'data-group-id': g.id,
          'data-colors': String(g.colors),
          'data-rolling-only': String(rollingOnly),
          'aria-label': `${g.chaim}, ${g.hm} (${g.symbol}, ${g.colors} colour${g.colors === 1 ? '' : 's'}): open correspondence`,
        });

        const title = make('title');
        title.textContent = describeGroup(g);

        const rect = make('rect', {
          x: String(g.x - boxWidth / 2),
          y: String(g.y),
          width: String(boxWidth),
          height: String(boxHeight),
          rx: '8',
        });

        const label = make('text', {
          x: String(g.x),
          y: String(g.y + 17),
          class: 'chaim-label',
        });
        renderChaimSvgText(label, g.chaim);

        const meta = make('text', {
          x: String(g.x),
          y: String(g.y + 32),
          class: 'number',
        });
        meta.textContent = g.colors > 1 ? `${g.hm} · ${g.colors}c` : g.hm;

        link.append(title, rect, label, meta);
        svg.append(link);
        nodeElements.set(g.id, link);

        link.addEventListener('mouseenter', () => highlightNode(g.id));
        link.addEventListener('focus', () => highlightNode(g.id));
        link.addEventListener('mouseleave', () => highlightNode(null));
        link.addEventListener('blur', () => highlightNode(null));
      }

      return { displayedEdgesCount: subEdges.length, matchingEdgesCount };
    }

    function updateFamilyCards(matchSet, isFiltered) {
      let matchingFamiliesCount = 0;
      for (const card of familyCards) {
        const hm = card.dataset.familyHm;
        const total = Number(card.dataset.totalCount || 0);
        const items = [...card.querySelectorAll('.family-card-group-item[data-group-id]')];
        let matchCount = 0;
        let firstMatchId = null;
        for (const item of items) {
          const gid = item.dataset.groupId;
          const matched = matchSet.has(gid);
          if (matched) {
            matchCount += 1;
            if (!firstMatchId) firstMatchId = gid;
          }
          item.classList.toggle('is-match', isFiltered && matched);
          item.classList.toggle('is-dimmed', isFiltered && !matched);
        }
        if (matchCount > 0) matchingFamiliesCount += 1;
        card.classList.toggle('is-dimmed', isFiltered && matchCount === 0);
        card.classList.toggle('has-filter-match', isFiltered && matchCount > 0);

        const badge = card.querySelector('.family-card-count');
        if (badge) {
          badge.textContent = isFiltered ? `${matchCount}/${total}` : String(total);
        }
        card.setAttribute(
          'href',
          isFiltered && firstMatchId
            ? `correspondence-${hm}.html#${firstMatchId}`
            : `correspondence-${hm}.html`,
        );
      }
      return matchingFamiliesCount;
    }

    function applyState({ updateUrl = true, centerScroll = false } = {}) {
      colorSelects.forEach((s) => { s.value = state.colors; });
      rollingSelects.forEach((s) => { s.value = state.rolling; });
      modeSelects.forEach((s) => { s.value = state.mode; });

      const isFiltered = state.colors !== 'all' || state.rolling !== 'all';
      resetButtons.forEach((btn) => { btn.hidden = !isFiltered && state.mode === 'highlight'; });

      const matchingGroups = groups.filter((g) => matchesFilters(g, state.colors, state.rolling));
      const matchSet = new Set(matchingGroups.map((g) => g.id));
      const subsetForHasse = state.mode === 'induced' && isFiltered ? matchingGroups : groups;

      const { displayedEdgesCount, matchingEdgesCount } = renderHasseDiagram(
        subsetForHasse,
        matchSet,
        isFiltered,
      );
      const matchingFamiliesCount = updateFamilyCards(matchSet, isFiltered);

      const edgesCount = state.mode === 'induced' && isFiltered ? displayedEdgesCount : matchingEdgesCount;
      defaultStatusText = isFiltered
        ? `Showing ${matchingGroups.length} of ${groups.length} groups across ${matchingFamiliesCount} of 17 projected wallpaper groups · ${edgesCount} inclusion${edgesCount === 1 ? '' : 's'} among matching groups.`
        : `Showing all ${groups.length} groups across 17 projected wallpaper groups · ${edges.length} immediate inclusions in these settings.`;

      if (status) status.textContent = defaultStatusText;
      statusOutputs.forEach((el) => { el.textContent = defaultStatusText; });

      if (centerScroll) {
        const scroller = svg.closest('.diagram');
        if (scroller) {
          scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
        }
      }

      if (updateUrl) {
        const nextParams = new URLSearchParams(location.search);
        if (state.colors === 'all') nextParams.delete('colors');
        else nextParams.set('colors', state.colors);
        if (state.rolling === 'all') nextParams.delete('rolling');
        else nextParams.set('rolling', state.rolling);
        if (state.mode === 'highlight') nextParams.delete('mode');
        else nextParams.set('mode', state.mode);
        const query = nextParams.toString();
        const nextUrl = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
        history.replaceState(null, '', nextUrl);
      }
    }

    colorSelects.forEach((select) => {
      select.addEventListener('change', () => {
        state.colors = select.value;
        applyState({ centerScroll: state.mode === 'induced' });
      });
    });

    rollingSelects.forEach((select) => {
      select.addEventListener('change', () => {
        state.rolling = select.value;
        applyState({ centerScroll: state.mode === 'induced' });
      });
    });

    modeSelects.forEach((select) => {
      select.addEventListener('change', () => {
        state.mode = select.value;
        applyState({ centerScroll: true });
      });
    });

    resetButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state = { colors: 'all', rolling: 'all', mode: 'highlight' };
        applyState({ centerScroll: true });
      });
    });

    applyState({ updateUrl: false, centerScroll: true });
  } catch (error) {
    if (status) status.textContent = `The diagram could not be loaded: ${error.message}`;
  }
})();
