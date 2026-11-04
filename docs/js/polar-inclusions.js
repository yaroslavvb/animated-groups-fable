(async () => {
  const svg = document.querySelector('#graph');
  const status = document.querySelector('#status');
  const ns = 'http://www.w3.org/2000/svg';
  const make = (name, attrs = {}) => {
    const el = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  };
  try {
    const response = await fetch('data/polar-inclusions.json');
    if (!response.ok) throw new Error('Could not load the inclusion data');
    const { groups, edges } = await response.json();
    const byId = Object.fromEntries(groups.map(g => [g.id, g]));
    const parents = Object.fromEntries(groups.map(g => [g.id, []]));
    const children = Object.fromEntries(groups.map(g => [g.id, []]));
    edges.forEach(([a, b]) => { children[a].push(b); parents[b].push(a); });
    const ordered = [...groups].sort((a, b) => a.order - b.order || a.number - b.number);
    for (const g of ordered) g.level = parents[g.id].length ? 1 + Math.max(...parents[g.id].map(id => byId[id].level)) : 0;
    const layers = [];
    ordered.forEach(g => (layers[g.level] ||= []).push(g));
    // Alternate sweeps place related groups near one another to reduce crossings.
    for (let pass = 0; pass < 12; pass++) {
      const down = pass % 2 === 0;
      const indexes = down ? layers.map((_, i) => i).slice(1) : layers.map((_, i) => i).slice(0, -1).reverse();
      for (const i of indexes) {
        const positions = Object.fromEntries(layers.flatMap(layer => layer.map((g, n) => [g.id, (n + .5) / layer.length])));
        const score = g => {
          const neighbors = (down ? parents : children)[g.id];
          return neighbors.length ? neighbors.reduce((sum, id) => sum + positions[id], 0) / neighbors.length : positions[g.id];
        };
        layers[i].sort((a, b) => score(a) - score(b) || a.number - b.number);
      }
    }
    const maxCount = Math.max(...layers.map(layer => layer.length));
    const width = Math.max(1100, maxCount * 112 + 40);
    const height = layers.length * 112 + 35;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    layers.forEach((layer, level) => layer.forEach((g, i) => {
      g.x = width * (i + .5) / layer.length;
      g.y = 32 + level * 112;
    }));
    const edgeElements = [];
    edges.forEach(([a, b]) => {
      const from = byId[a], to = byId[b];
      const line = make('path', { class: 'edge', d: `M ${from.x} ${from.y + 37} L ${to.x} ${to.y}`, 'aria-hidden': 'true' });
      svg.append(line); edgeElements.push({ a, b, line });
    });
    const showEdges = id => edgeElements.forEach(({a, b, line}) => line.classList.toggle('active', a === id || b === id));
    for (const g of ordered) {
      const link = make('a', { href: `correspondence-${g.family}.html#${g.id}`, class: `node${g.level >= layers.length / 2 ? ' high' : ''}`, 'aria-label': `${g.hm.replaceAll('_', ' ')}: space group ${g.number}, open correspondence` });
      const title = make('title'); title.textContent = `${g.hm.replaceAll('_', '')} · No. ${g.number}`;
      const rect = make('rect', { x: g.x - 48, y: g.y, width: 96, height: 37, rx: 8 });
      const label = make('text', { x: g.x, y: g.y + 15 });
      // Subscript digits in the International Tables symbol.
      label.textContent = g.hm.replace(/_(\d+)/g, (_, digits) => [...digits].map(d => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]).join(''));
      const number = make('text', { x: g.x, y: g.y + 29, class: 'number' }); number.textContent = `No. ${g.number}`;
      link.append(title, rect, label, number); svg.append(link);
      link.addEventListener('mouseenter', () => showEdges(g.id));
      link.addEventListener('focus', () => showEdges(g.id));
    }
    const scroller = document.querySelector('.diagram');
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
    status.textContent = `${groups.length} groups · ${edges.length} immediate inclusions in these settings`;
  } catch (error) { status.textContent = `The diagram could not be loaded: ${error.message}`; }
})();
