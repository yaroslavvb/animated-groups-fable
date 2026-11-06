(async () => {
  const svg = document.querySelector('#graph');
  const status = document.querySelector('#status');
  const inspector = document.querySelector('[data-hasse-inspector]');
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

  const makeHtml = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  // Render Chaim short-form notation (e.g. ²2²2²2²2, ∗¹2²2¹2²2) with uniform
  // superscript tspans in SVG.
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

  // Render Chaim short-form notation into an HTML element using <sup>.
  function renderChaimHtml(container, chaim) {
    container.textContent = '';
    let i = 0;
    while (i < chaim.length) {
      if (SUP_TO_ASCII[chaim[i]]) {
        let run = '';
        while (i < chaim.length && SUP_TO_ASCII[chaim[i]]) {
          run += SUP_TO_ASCII[chaim[i]];
          i += 1;
        }
        const sup = document.createElement('sup');
        sup.textContent = run;
        container.append(sup);
      } else {
        let run = '';
        while (i < chaim.length && !SUP_TO_ASCII[chaim[i]]) {
          run += chaim[i];
          i += 1;
        }
        container.append(document.createTextNode(run));
      }
    }
  }

  function describeGroup(g) {
    const colorWord = `${g.colors} colour${g.colors === 1 ? '' : 's'}`;
    const rollingNote = g.rolling_only
      ? `still frame K = ${g.kernel_orbifold} → rolling Γ = ${g.projected_orbifold}`
      : g.colors > 1
        ? `still frame K = ${g.kernel_orbifold} (coarser sublattice) → rolling Γ = ${g.projected_orbifold}`
        : `static ${g.projected_orbifold} in every frame`;
    return `${g.chaim} · generators ${g.generators_label} · clockwork ${g.symbol} · ${colorWord} · ${rollingNote}`;
  }

  function matchesRollingFilter(g, rollingFilter) {
    switch (rollingFilter) {
      case 'rolling-only':
        return Boolean(g.rolling_only);
      case 'pure-rolling':
        return Boolean(g.pure_rolling);
      case 'any-rolling':
        return g.colors > 1;
      case 'frame-keeps':
        return !g.rolling_only;
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
    const { groups, edges, transitions = {} } = await response.json();
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
    let lastInspectedId = null;

    const diagramWrap = svg.closest('.diagram');
    let floatingCard = diagramWrap?.querySelector('[data-hasse-floating]') || null;
    if (diagramWrap && !floatingCard) {
      floatingCard = makeHtml('div', 'hasse-floating-card');
      floatingCard.dataset.hasseFloating = '';
      floatingCard.hidden = true;
      diagramWrap.append(floatingCard);
    }

    function renderFloatingCard(activeId, nodeCoords, parentsMap, childrenMap) {
      if (!floatingCard || !diagramWrap) return;
      if (!activeId || !byId[activeId] || !nodeCoords) {
        floatingCard.hidden = true;
        return;
      }
      const g = byId[activeId];
      floatingCard.textContent = '';

      const head = makeHtml('div', 'hasse-floating-head');
      const sig = makeHtml('strong', 'hasse-floating-sig');
      renderChaimHtml(sig, g.chaim);
      const tuple = makeHtml('code', 'hasse-floating-tuple', g.generators_label);
      const cw = makeHtml('span', 'hasse-floating-cw', `clockwork ${g.symbol}`);
      head.append(sig, tuple, cw);
      floatingCard.append(head);

      const gens = makeHtml('div', 'hasse-floating-gens');
      for (const gen of g.generators || []) {
        const item = makeHtml('span', 'hasse-floating-gen');
        item.append(
          makeHtml('code', '', gen.symbol),
          makeHtml('span', '', ` ${gen.description}`),
        );
        gens.append(item);
      }
      floatingCard.append(gens);

      const inIds = parentsMap?.[g.id] || [];
      if (inIds.length) {
        const row = makeHtml('div', 'hasse-floating-steps hasse-floating-steps--in');
        row.append(makeHtml('span', 'hasse-floating-step-label', '↑ From above: '));
        inIds.slice(0, 6).forEach((pid, idx) => {
          if (idx > 0) row.append(document.createTextNode(' · '));
          const p = byId[pid];
          const tr = transitions[`${pid}->${g.id}`];
          const s = makeHtml('span', 'hasse-floating-step');
          const ps = makeHtml('strong', '');
          renderChaimHtml(ps, p.chaim);
          s.append(ps, makeHtml('code', '', ` ${tr ? tr.added_label : ''}`));
          row.append(s);
        });
        floatingCard.append(row);
      }

      const outIds = childrenMap?.[g.id] || [];
      if (outIds.length) {
        const row = makeHtml('div', 'hasse-floating-steps hasse-floating-steps--out');
        row.append(makeHtml('span', 'hasse-floating-step-label', '↓ Add going down: '));
        outIds.slice(0, 6).forEach((cid, idx) => {
          if (idx > 0) row.append(document.createTextNode(' · '));
          const c = byId[cid];
          const tr = transitions[`${g.id}->${cid}`];
          const s = makeHtml('span', 'hasse-floating-step');
          s.append(makeHtml('code', '', `${tr ? tr.added_label : ''} → `));
          const cs = makeHtml('strong', '');
          renderChaimHtml(cs, c.chaim);
          s.append(cs);
          row.append(s);
        });
        if (outIds.length > 6) {
          row.append(makeHtml('span', 'hasse-floating-more', ` (+${outIds.length - 6} more)`));
        }
        floatingCard.append(row);
      }

      floatingCard.hidden = false;
      const cardW = 300;
      const viewLeft = diagramWrap.scrollLeft;
      const viewRight = viewLeft + diagramWrap.clientWidth;
      let left = nodeCoords.x + 48;
      if (left + cardW > viewRight - 10) {
        left = Math.max(viewLeft + 10, nodeCoords.x - cardW - 48);
      }
      const top = Math.max(8, Math.min(nodeCoords.y - 6, svg.clientHeight - 150));
      floatingCard.style.left = `${Math.round(left)}px`;
      floatingCard.style.top = `${Math.round(top)}px`;
    }

    function renderInspector(activeId, parentsMap, childrenMap) {
      if (!inspector) return;
      if (activeId && byId[activeId]) {
        lastInspectedId = activeId;
      }
      const effectiveId = activeId || (lastInspectedId && parentsMap?.[lastInspectedId] !== undefined ? lastInspectedId : null);
      const g = byId[effectiveId] || byId.g1 || groups[0];
      if (!g) return;
      const isDefault = !effectiveId;
      inspector.textContent = '';

      const header = makeHtml('div', 'hasse-inspector-header');
      const titleWrap = makeHtml('div', 'hasse-inspector-title');
      const badge = makeHtml(
        'span',
        'hasse-inspector-kicker',
        isDefault ? 'Base root (hover or focus any node to inspect generators)' : 'Selected / hovered group',
      );
      const sigSpan = makeHtml('span', 'hasse-inspector-chaim');
      renderChaimHtml(sigSpan, g.chaim);
      const genTuple = makeHtml('code', 'hasse-inspector-gen-tuple', g.generators_label);
      const metaSpan = makeHtml(
        'span',
        'hasse-inspector-meta',
        `clockwork ${g.symbol} · ${g.colors} colour${g.colors === 1 ? '' : 's'} · ${
          g.rolling_only
            ? `still frame K = ${g.kernel_orbifold} → rolling Γ = ${g.projected_orbifold}`
            : g.colors > 1
              ? `still frame K = ${g.kernel_orbifold} (sublattice) → rolling Γ = ${g.projected_orbifold}`
              : `static ${g.projected_orbifold} in every frame`
        }`,
      );
      titleWrap.append(badge, sigSpan, genTuple, metaSpan);
      header.append(titleWrap);

      const genListWrap = makeHtml('div', 'hasse-inspector-generators');
      const genLabel = makeHtml('span', 'hasse-inspector-section-label', 'Generators:');
      genListWrap.append(genLabel);
      for (const gen of g.generators || []) {
        const pill = makeHtml('span', 'hasse-gen-pill');
        const sym = makeHtml('code', 'hasse-gen-pill-sym', gen.symbol);
        const desc = makeHtml('span', 'hasse-gen-pill-desc', gen.description);
        pill.append(sym, desc);
        if (gen.formula) {
          pill.title = `${gen.symbol}: ${gen.description} — ${gen.formula}`;
        }
        genListWrap.append(pill);
      }

      const stepsGrid = makeHtml('div', 'hasse-inspector-steps');

      const incomingIds = parentsMap?.[g.id] || [];
      const inBox = makeHtml('div', 'hasse-step-col');
      const inTitle = makeHtml(
        'span',
        'hasse-inspector-section-label hasse-step-label--in',
        `↑ Added from subgroup${incomingIds.length === 1 ? '' : 's'} above (${incomingIds.length}):`,
      );
      inBox.append(inTitle);
      if (incomingIds.length === 0) {
        inBox.append(makeHtml('span', 'hasse-step-empty', 'Minimal root (possesses base translations T = ⟨t₁, t₂⟩)'));
      } else {
        const list = makeHtml('div', 'hasse-step-list');
        for (const pid of incomingIds) {
          const p = byId[pid];
          const tr = transitions[`${pid}->${g.id}`];
          const chip = makeHtml('span', 'hasse-step-chip hasse-step-chip--in');
          const pSig = makeHtml('strong', 'hasse-step-sig');
          renderChaimHtml(pSig, p.chaim);
          const arrow = makeHtml('code', 'hasse-step-added', tr ? `${tr.added_label} (×${tr.index})` : '→');
          chip.append(pSig, arrow);
          if (tr?.added?.length) {
            const descText = tr.added.map((d) => d.description).join('; ');
            chip.title = `From ${p.chaim} ${p.generators_label}: add ${tr.added_label} (${descText})`;
          }
          list.append(chip);
        }
        inBox.append(list);
      }

      const outgoingIds = childrenMap?.[g.id] || [];
      const outBox = makeHtml('div', 'hasse-step-col');
      const outTitle = makeHtml(
        'span',
        'hasse-inspector-section-label hasse-step-label--out',
        `↓ Add generator to go down (${outgoingIds.length}):`,
      );
      outBox.append(outTitle);
      if (outgoingIds.length === 0) {
        outBox.append(makeHtml('span', 'hasse-step-empty', 'Maximal in this view (no larger supergroups below)'));
      } else {
        const list = makeHtml('div', 'hasse-step-list');
        for (const cid of outgoingIds) {
          const c = byId[cid];
          const tr = transitions[`${g.id}->${cid}`];
          const chip = makeHtml('span', 'hasse-step-chip hasse-step-chip--out');
          const arrow = makeHtml('code', 'hasse-step-added', tr ? `${tr.added_label} (×${tr.index})` : '→');
          const cSig = makeHtml('strong', 'hasse-step-sig');
          renderChaimHtml(cSig, c.chaim);
          chip.append(arrow, cSig);
          if (tr?.added?.length) {
            const descText = tr.added.map((d) => d.description).join('; ');
            chip.title = `To ${c.chaim} ${c.generators_label}: add ${tr.added_label} (${descText})`;
          }
          list.append(chip);
        }
        outBox.append(list);
      }

      stepsGrid.append(inBox, outBox);
      inspector.append(header, genListWrap, stepsGrid);
    }

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
        renderInspector(null, {}, {});
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

      const ordered = Object.values(subById).sort(
        (a, b) => a.order - b.order || a.chaim.localeCompare(b.chaim) || a.id.localeCompare(b.id),
      );
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
          layers[i].sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id));
        }
      }

      const maxCount = Math.max(...layers.map((layer) => layer.length));
      const width = Math.max(860, maxCount * 116 + 44);
      const rowStep = 112;
      const boxWidth = 102;
      const boxHeight = 42;
      const height = layers.length * rowStep + 28;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));

      layers.forEach((layer, level) => layer.forEach((g, i) => {
        g.x = (width * (i + 0.5)) / layer.length;
        g.y = 24 + level * rowStep;
      }));

      const edgesLayer = make('g', { class: 'edges-layer' });
      const nodesLayer = make('g', { class: 'nodes-layer' });
      const badgesLayer = make('g', { class: 'edge-badges-layer', 'aria-hidden': 'true' });
      svg.append(edgesLayer, nodesLayer, badgesLayer);

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
        const x1 = from.x;
        const y1 = from.y + boxHeight;
        const x2 = to.x;
        const y2 = to.y;
        const line = make('path', {
          class: classes.join(' '),
          d: `M ${x1} ${y1} L ${x2} ${y2}`,
          'aria-hidden': 'true',
        });
        edgesLayer.append(line);
        const tr = transitions[`${a}->${b}`];
        edgeElements.push({
          a,
          b,
          line,
          mx: (x1 + x2) / 2,
          my: (y1 + y2) / 2,
          badgeText: tr ? tr.added_short : '',
        });
      });

      const nodeElements = new Map();
      const highlightNode = (activeId) => {
        badgesLayer.textContent = '';
        svg.classList.toggle('has-active-node', Boolean(activeId));
        if (!activeId) {
          edgeElements.forEach(({ line }) => {
            line.classList.remove('active', 'is-incoming', 'is-outgoing');
          });
          nodeElements.forEach((el) => {
            el.classList.remove('is-active', 'is-neighbor', 'is-parent', 'is-child');
          });
          if (status) status.textContent = defaultStatusText;
          renderFloatingCard(null, null, parents, children);
          renderInspector(null, parents, children);
          return;
        }
        const parentSet = new Set();
        const childSet = new Set();
        edgeElements.forEach(({ a, b, line, mx, my, badgeText }) => {
          const isIncoming = b === activeId;
          const isOutgoing = a === activeId;
          const hit = isIncoming || isOutgoing;
          line.classList.toggle('active', hit);
          line.classList.toggle('is-incoming', isIncoming);
          line.classList.toggle('is-outgoing', isOutgoing);
          if (isIncoming) parentSet.add(a);
          if (isOutgoing) childSet.add(b);
          if (hit && badgeText) {
            const badgeGroup = make('g', {
              class: `edge-badge ${isIncoming ? 'edge-badge--in edge-badge--incoming' : 'edge-badge--out edge-badge--outgoing'}`,
              transform: `translate(${mx}, ${my})`,
            });
            const bw = Math.max(30, badgeText.length * 6.4 + 12);
            const bh = 17;
            const bg = make('rect', {
              x: String(-bw / 2),
              y: String(-bh / 2),
              width: String(bw),
              height: String(bh),
              rx: '8.5',
            });
            const txt = make('text', {
              x: '0',
              y: '3.5',
              'text-anchor': 'middle',
            });
            txt.textContent = badgeText;
            badgeGroup.append(bg, txt);
            badgesLayer.append(badgeGroup);
          }
        });
        nodeElements.forEach((el, id) => {
          const isP = parentSet.has(id);
          const isC = childSet.has(id);
          el.classList.toggle('is-active', id === activeId);
          el.classList.toggle('is-neighbor', (isP || isC) && id !== activeId);
          el.classList.toggle('is-parent', isP);
          el.classList.toggle('is-child', isC);
        });
        if (status && byId[activeId]) {
          status.textContent = describeGroup(byId[activeId]);
        }
        renderFloatingCard(activeId, subById[activeId], parents, children);
        renderInspector(activeId, parents, children);
      };

      for (const g of ordered) {
        const isMatch = matchSet.has(g.id);
        const rollingOnly = Boolean(g.rolling_only);
        const classes = ['node'];
        if (g.level >= layers.length / 2) classes.push('high');
        if (rollingOnly) classes.push('is-rolling-only');
        if (isFiltered && state.mode === 'highlight') {
          classes.push(isMatch ? 'is-match' : 'is-dimmed');
        }

        const link = make('a', {
          href: `${g.page}#${g.id}`,
          class: classes.join(' '),
          'data-group-id': g.id,
          'data-colors': String(g.colors),
          'data-rolling-only': String(rollingOnly),
          'aria-label': `${g.chaim}, generators ${g.generators_label} (${g.symbol}, ${g.colors} colour${g.colors === 1 ? '' : 's'}): open correspondence`,
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
          y: String(g.y + 33),
          class: 'number',
        });
        meta.textContent = g.generators_short;

        link.append(title, rect, label, meta);
        nodesLayer.append(link);
        nodeElements.set(g.id, link);

        link.addEventListener('mouseenter', () => highlightNode(g.id));
        link.addEventListener('focus', () => highlightNode(g.id));
        link.addEventListener('mouseleave', () => highlightNode(null));
        link.addEventListener('blur', () => highlightNode(null));
      }

      renderInspector(null, parents, children);
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
        ? `Showing ${matchingGroups.length} of ${groups.length} groups across ${matchingFamiliesCount} of 17 projected orbifold groups · ${edgesCount} inclusion${edgesCount === 1 ? '' : 's'} among matching groups.`
        : `Showing all ${groups.length} groups across 17 projected orbifold groups · ${edges.length} immediate generator inclusions.`;

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
