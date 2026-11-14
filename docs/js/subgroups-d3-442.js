(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SubgroupsD3442 = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Accessible Bridges / Okabe-Ito-derived palette (indices 1..10 on index 0..9)
  const PALETTE = [
    "#c8501e", // 1 burnt orange
    "#1f6fa8", // 2 steel blue
    "#f0e442", // 3 bright yellow
    "#66ccee", // 4 sky cyan
    "#2b2b2b", // 5 charcoal
    "#e69f00", // 6 amber
    "#332288", // 7 deep indigo
    "#009988", // 8 teal
    "#cc79a7", // 9 rose mauve
    "#44bb99"  // 10 mint green
  ];

  const LABEL_INK = [
    "#ffffff",
    "#ffffff",
    "#15232b",
    "#15232b",
    "#ffffff",
    "#15232b",
    "#ffffff",
    "#ffffff",
    "#15232b",
    "#15232b"
  ];

  function colorFor(colourId) {
    const idx = colourId - 1;
    if (idx >= 0 && idx < PALETTE.length) return PALETTE[idx];
    const hue = ((idx * 137.508) % 360).toFixed(1);
    return `hsl(${hue}, 62%, 48%)`;
  }

  function inkFor(colourId) {
    const idx = colourId - 1;
    if (idx >= 0 && idx < LABEL_INK.length) return LABEL_INK[idx];
    return "#ffffff";
  }

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x;
  }

  function canonicalColouring(arr) {
    const map = new Map();
    let next = 1;
    return arr.map((c) => {
      if (!map.has(c)) map.set(c, next++);
      return map.get(c);
    });
  }

  function formatSet(indices, names) {
    if (!indices || indices.length === 0) return "∅";
    return `{${indices.map((i) => names[i]).join(", ")}}`;
  }

  // =========================================================================
  // PART 1: D3 (Order 6) Algebra & Enumeration
  // =========================================================================

  const D3_NAMES = ["e", "a", "a²", "b", "ab", "a²b"];
  const D3_MUL = [
    [0, 1, 2, 3, 4, 5],
    [1, 2, 0, 4, 5, 3],
    [2, 0, 1, 5, 3, 4],
    [3, 5, 4, 0, 2, 1],
    [4, 3, 5, 1, 0, 2],
    [5, 4, 3, 2, 1, 0]
  ];
  const D3_INV = [0, 2, 1, 3, 4, 5];
  // Wedge w occupies polar interval [w*60°, (w+1)*60°] CCW from +x axis.
  // D3_SLOT[g] is the wedge index where element g places wedge 0 (e).
  const D3_SLOT = [0, 2, 4, 5, 1, 3];

  function mulD3(h, x) {
    return D3_MUL[h][x];
  }

  function invD3(h) {
    return D3_INV[h];
  }

  // Rigid left action of h on colouring C: piece x carries colour C[x] to position mulD3(h, x).
  function actD3(h, coloring) {
    const out = new Array(6);
    for (let x = 0; x < 6; x++) {
      out[D3_MUL[h][x]] = coloring[x];
    }
    return out;
  }

  // Compare two colourings over a finite set: checks if `before` -> `after` is a well-defined
  // bijection on colours. Returns { kind: "fixes"|"permutes"|"breaks", mapping }.
  function permOf(before, after) {
    const map = new Map();
    const rev = new Map();
    let allFixed = true;
    for (let i = 0; i < before.length; i++) {
      const c1 = before[i];
      const c2 = after[i];
      if (c1 !== c2) allFixed = false;
      if (map.has(c1)) {
        if (map.get(c1) !== c2) return { kind: "breaks", mapping: null };
      } else {
        if (rev.has(c2)) return { kind: "breaks", mapping: null };
        map.set(c1, c2);
        rev.set(c2, c1);
      }
    }
    return { kind: allFixed ? "fixes" : "permutes", mapping: map };
  }

  function leftCosetsD3(elements) {
    const elSet = new Set(elements);
    const seen = new Array(6).fill(false);
    const blocks = [];
    for (let g = 0; g < 6; g++) {
      if (seen[g]) continue;
      const block = [];
      for (const s of elements) {
        const gs = D3_MUL[g][s];
        if (!seen[gs]) {
          seen[gs] = true;
          block.push(gs);
        }
      }
      block.sort((a, b) => a - b);
      blocks.push({ rep: g, elements: block, isSubgroup: elSet.has(g) });
    }
    const coloring = new Array(6);
    blocks.forEach((blk, idx) => {
      for (const x of blk.elements) coloring[x] = idx + 1;
    });
    return { blocks, coloring };
  }

  function rightCosetsD3(elements) {
    const elSet = new Set(elements);
    const seen = new Array(6).fill(false);
    const blocks = [];
    for (let g = 0; g < 6; g++) {
      if (seen[g]) continue;
      const block = [];
      for (const s of elements) {
        const sg = D3_MUL[s][g];
        if (!seen[sg]) {
          seen[sg] = true;
          block.push(sg);
        }
      }
      block.sort((a, b) => a - b);
      blocks.push({ rep: g, elements: block, isSubgroup: elSet.has(g) });
    }
    const coloring = new Array(6);
    blocks.forEach((blk, idx) => {
      for (const x of blk.elements) coloring[x] = idx + 1;
    });
    return { blocks, coloring };
  }

  function conjugateD3Set(elements, h) {
    const hi = D3_INV[h];
    return elements.map((s) => D3_MUL[D3_MUL[h][s]][hi]).sort((a, b) => a - b);
  }

  function sameSortedSet(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function findD3SubgroupByElements(elList) {
    const sorted = [...new Set(elList)].sort((a, b) => a - b);
    return D3_SUBGROUPS.find((s) => sameSortedSet(s.elements, sorted)) || null;
  }

  const D3_RAW_SUBGROUPS = [
    {
      id: "D3",
      label: "D₃ = ⟨a, b⟩",
      shortLabel: "⟨a, b⟩",
      elements: [0, 1, 2, 3, 4, 5],
      classId: "D3",
      colorGroup: "C₁ (order 1)",
      table2Id: "C1",
      note: "Whole group: 1 coset, 1 orbit, every motion fixes colour 1."
    },
    {
      id: "C3",
      label: "⟨a⟩ ≅ C₃",
      shortLabel: "⟨a⟩",
      elements: [0, 1, 2],
      classId: "C3",
      colorGroup: "C₂ (order 2)",
      table2Id: "C2",
      note: "Normal index-2 subgroup: left cosets {e,a,a²}, {b,ab,a²b} match right cosets; rotations fix colours, flips swap them."
    },
    {
      id: "b",
      label: "⟨b⟩ ≅ C₂",
      shortLabel: "⟨b⟩",
      elements: [0, 3],
      classId: "C2",
      colorGroup: "D₃ (order 6)",
      table2Id: "C8",
      note: "Non-normal index-3 subgroup: left cosets g⟨b⟩ are perfect (permuted by all of D₃), while orbits ⟨b⟩g break under rotations."
    },
    {
      id: "ab",
      label: "⟨ab⟩ ≅ C₂",
      shortLabel: "⟨ab⟩",
      elements: [0, 4],
      classId: "C2",
      colorGroup: "D₃ (order 6)",
      table2Id: "C7",
      note: "Conjugate to ⟨b⟩ (via a or a²): produces a rotated 3-colouring with the same D₃ colour group."
    },
    {
      id: "a2b",
      label: "⟨a²b⟩ ≅ C₂",
      shortLabel: "⟨a²b⟩",
      elements: [0, 5],
      classId: "C2",
      colorGroup: "D₃ (order 6)",
      table2Id: "C6",
      note: "Conjugate to ⟨b⟩: the third placement of the C₂ subgroup gives the third orientation of the 3-colour triangle."
    },
    {
      id: "E",
      label: "{e}",
      shortLabel: "{e}",
      elements: [0],
      classId: "E",
      colorGroup: "D₃ (order 6)",
      table2Id: "C5",
      note: "Trivial subgroup (index 6): regular action — 6 distinct colours, every non-identity motion moves all 6 without fixing any."
    }
  ];

  const D3_SUBGROUPS = D3_RAW_SUBGROUPS.map((raw) => {
    const order = raw.elements.length;
    const index = 6 / order;
    const lc = leftCosetsD3(raw.elements);
    const rc = rightCosetsD3(raw.elements);
    const normaliser = [];
    for (let h = 0; h < 6; h++) {
      if (sameSortedSet(conjugateD3Set(raw.elements, h), raw.elements)) {
        normaliser.push(h);
      }
    }
    const normal = normaliser.length === 6;
    // Core K = intersection of conjugates
    const kernel = [0, 1, 2, 3, 4, 5].filter((x) => {
      for (let h = 0; h < 6; h++) {
        const conj = conjugateD3Set(raw.elements, h);
        if (!conj.includes(x)) return false;
      }
      return true;
    });
    return {
      ...raw,
      order,
      index,
      normal,
      normaliser,
      kernel,
      leftCosets: lc.blocks,
      leftColoring: lc.coloring,
      rightCosets: rc.blocks,
      rightColoring: rc.coloring
    };
  });

  function doubleCosetTableD3(sub) {
    const rows = sub.leftCosets;
    const cols = sub.rightCosets;
    const cells = rows.map((row) =>
      cols.map((col) => {
        const colSet = new Set(col.elements);
        const inter = row.elements.filter((x) => colSet.has(x));
        const sameBlock =
          inter.length === row.elements.length && inter.length === col.elements.length;
        return { elements: inter, sameBlock };
      })
    );
    return { rows, cols, cells };
  }

  function analyseColouringD3(rawColoring) {
    const coloring = canonicalColouring(rawColoring);
    const permutedBy = [];
    const fixedBy = [];
    const brokenBy = [];
    const verdicts = [];
    for (let h = 0; h < 6; h++) {
      const next = actD3(h, coloring);
      const res = permOf(coloring, next);
      verdicts.push({ h, ...res, next });
      if (res.kind === "fixes") {
        fixedBy.push(h);
        permutedBy.push(h);
      } else if (res.kind === "permutes") {
        permutedBy.push(h);
      } else {
        brokenBy.push(h);
      }
    }
    const isPerfect = permutedBy.length === 6;
    const permSub = findD3SubgroupByElements(permutedBy);
    const kerSub = findD3SubgroupByElements(fixedBy);

    // Definition 1 decomposition: orbits of H_P on D3, with stabiliser J_i on colour block
    const hBlocks = leftCosetsD3(permutedBy).blocks;
    const colorMap = new Map();
    for (let x = 0; x < 6; x++) {
      const c = coloring[x];
      if (!colorMap.has(c)) colorMap.set(c, []);
      colorMap.get(c).push(x);
    }
    const def1Orbits = hBlocks.map((hb) => {
      const rep = hb.elements[0];
      const repColour = coloring[rep];
      // J_i = { h in H_P : h maps rep into repColour block } = stabiliser in H_P of repColour
      const cBlock = new Set(colorMap.get(repColour));
      const ji = permutedBy.filter((h) => cBlock.has(D3_MUL[h][rep]));
      const jSub = findD3SubgroupByElements(ji);
      const coloursInOrbit = [...new Set(hb.elements.map((x) => coloring[x]))];
      return {
        orbitElements: hb.elements,
        rep,
        ji,
        jLabel: jSub ? jSub.shortLabel : formatSet(ji, D3_NAMES),
        colours: coloursInOrbit
      };
    });

    // Check if matches any subgroup's left coset or right coset colouring
    let leftMatch = null;
    let rightMatch = null;
    for (const s of D3_SUBGROUPS) {
      if (sameSortedSet(s.leftColoring.map((v, i) => v * 10 + i), coloring.map((v, i) => v * 10 + i))) {
        leftMatch = s;
      }
      const rcCanon = canonicalColouring(s.rightColoring);
      if (sameSortedSet(rcCanon.map((v, i) => v * 10 + i), coloring.map((v, i) => v * 10 + i))) {
        rightMatch = s;
      }
    }

    return {
      coloring,
      colorCount: colorMap.size,
      isPerfect,
      permutedBy,
      fixedBy,
      brokenBy,
      verdicts,
      permSub,
      kerSub,
      def1Orbits,
      leftMatch,
      rightMatch
    };
  }

  // Bridges 2001 Table 2 C1-C8 presets (in rigid left-action form, plus canon(b * C3) = C4)
  const TABLE2_PRESETS = [
    {
      id: "C1",
      title: "C1 (S = D₃)",
      subId: "D3",
      coloring: D3_SUBGROUPS[0].leftColoring.slice(),
      note: "1 colour: H_P = D₃, K_P = D₃, Q = C₁."
    },
    {
      id: "C2",
      title: "C2 (S = ⟨a⟩)",
      subId: "C3",
      coloring: D3_SUBGROUPS[1].leftColoring.slice(),
      note: "2 colours: H_P = D₃, K_P = ⟨a⟩, Q = C₂."
    },
    {
      id: "C3",
      title: "C3 (non-perfect)",
      subId: null,
      coloring: [1, 1, 1, 2, 3, 4],
      note: "Bridges Def. 1 non-perfect colouring: H_P = ⟨a⟩ (rotations 3-cycle {2,3,4}), reflections break it into C4; K_P = {e}."
    },
    {
      id: "C4",
      title: "C4 (b · C3)",
      subId: null,
      coloring: [1, 2, 3, 4, 4, 4],
      note: "Image of C3 under reflection b: H_P = ⟨a⟩, K_P = {e}. C3 and C4 share the same H_P and form one D₃-orbit of colourings."
    },
    {
      id: "C5",
      title: "C5 (S = {e})",
      subId: "E",
      coloring: D3_SUBGROUPS[5].leftColoring.slice(),
      note: "6 colours (regular): H_P = D₃, K_P = {e}, Q = D₃."
    },
    {
      id: "C6",
      title: "C6 (S = ⟨a²b⟩)",
      subId: "a2b",
      coloring: D3_SUBGROUPS[4].leftColoring.slice(),
      note: "3 colours (left cosets of ⟨a²b⟩): H_P = D₃, K_P = {e}, Q = D₃."
    },
    {
      id: "C7",
      title: "C7 (S = ⟨ab⟩)",
      subId: "ab",
      coloring: D3_SUBGROUPS[3].leftColoring.slice(),
      note: "3 colours (left cosets of ⟨ab⟩): H_P = D₃, K_P = {e}, Q = D₃."
    },
    {
      id: "C8",
      title: "C8 (S = ⟨b⟩)",
      subId: "b",
      coloring: D3_SUBGROUPS[2].leftColoring.slice(),
      note: "3 colours (left cosets of ⟨b⟩): H_P = D₃, K_P = {e}, Q = D₃."
    }
  ];

  // =========================================================================
  // PART 2: 442 (p4) Wallpaper Group Algebra & Enumeration
  // =========================================================================

  function rotVec(q, x, y) {
    switch (mod(q, 4)) {
      case 0:
        return [x, y];
      case 1:
        return [-y, x];
      case 2:
        return [-x, -y];
      case 3:
        return [y, -x];
    }
  }

  function mul442(g1, g2) {
    const [rx, ry] = rotVec(g1.q, g2.x, g2.y);
    return { x: g1.x + rx, y: g1.y + ry, q: mod(g1.q + g2.q, 4) };
  }

  function inv442(g) {
    const qi = mod(-g.q, 4);
    const [rx, ry] = rotVec(qi, g.x, g.y);
    return { x: -rx, y: -ry, q: qi };
  }

  function conj442(g, h) {
    return mul442(g, mul442(h, inv442(g)));
  }

  function formatElem442(g) {
    const qStr = g.q === 0 ? "e" : g.q === 1 ? "r" : `r${g.q === 2 ? "²" : "³"}`;
    if (g.x === 0 && g.y === 0) return qStr;
    const tStr = `t(${g.x}, ${g.y})`;
    return g.q === 0 ? tStr : `${tStr}·${qStr}`;
  }

  // Sublattice L in HNF with basis columns (d1, 0) and (c, d2), 0 <= c < d1, d1*d2 = a.
  function modL(L, x, y) {
    const ry = mod(y, L.d2);
    const m = (y - ry) / L.d2;
    const rx = mod(x - L.c * m, L.d1);
    return [rx, ry];
  }

  function inL(L, x, y) {
    const [rx, ry] = modL(L, x, y);
    return rx === 0 && ry === 0;
  }

  function hnfFromCols(col1, col2) {
    let v1 = [col1[0], col1[1]];
    let v2 = [col2[0], col2[1]];
    while (v2[1] !== 0) {
      const q = Math.trunc(v1[1] / v2[1]);
      const t = [v1[0] - q * v2[0], v1[1] - q * v2[1]];
      v1 = v2;
      v2 = t;
    }
    const d1 = Math.abs(v2[0]);
    if (v1[1] < 0) v1 = [-v1[0], -v1[1]];
    const d2 = v1[1];
    const c = mod(v1[0], d1);
    return { d1, c, d2, a: d1 * d2 };
  }

  function isLatticeRotInvariant(L, q) {
    const [r1x, r1y] = rotVec(q, L.d1, 0);
    const [r2x, r2y] = rotVec(q, L.c, L.d2);
    return inL(L, r1x, r1y) && inL(L, r2x, r2y);
  }

  // 2D Gauss lattice basis reduction so rendered cells look compact / square when possible.
  function gaussReduce2D(v1in, v2in) {
    let v1 = [v1in[0], v1in[1]];
    let v2 = [v2in[0], v2in[1]];
    const norm2 = (v) => v[0] * v[0] + v[1] * v[1];
    for (let iter = 0; iter < 30; iter++) {
      if (norm2(v1) > norm2(v2)) {
        const tmp = v1;
        v1 = v2;
        v2 = tmp;
      }
      const n1 = norm2(v1);
      if (n1 === 0) break;
      const mu = Math.round((v1[0] * v2[0] + v1[1] * v2[1]) / n1);
      if (mu === 0) break;
      v2 = [v2[0] - mu * v1[0], v2[1] - mu * v1[1]];
    }
    return [v1, v2];
  }

  function pointInfoFromRS(rS) {
    if (rS === 1) return { rS: 1, b: 1, psList: [0, 1, 2, 3], psLabel: "C₄" };
    if (rS === 2) return { rS: 2, b: 2, psList: [0, 2], psLabel: "C₂" };
    return { rS: 0, b: 4, psList: [0], psLabel: "{e}" };
  }

  function cocycleForQ(rS, L, u, q) {
    const qm = mod(q, 4);
    if (qm === 0 || rS === 0) return [0, 0];
    if (rS === 2) {
      if (qm === 2) return modL(L, u[0], u[1]);
      return null;
    }
    // rS === 1
    if (qm === 1) return modL(L, u[0], u[1]);
    if (qm === 2) return modL(L, u[0] - u[1], u[0] + u[1]);
    if (qm === 3) return modL(L, -u[1], u[0]);
    return null;
  }

  function inSubgroup442(S, g) {
    const q = mod(g.q, 4);
    if (S.rS === 0 && q !== 0) return false;
    if (S.rS === 2 && q % 2 !== 0) return false;
    const uq = cocycleForQ(S.rS, S.L, S.u, q);
    return inL(S.L, g.x - uq[0], g.y - uq[1]);
  }

  function subKey442(S) {
    return `${S.rS}:${S.L.d1},${S.L.c},${S.L.d2}:${S.u[0]},${S.u[1]}`;
  }

  function conjugateSubgroup442(S, g) {
    const c1 = rotVec(g.q, S.L.d1, 0);
    const c2 = rotVec(g.q, S.L.c, S.L.d2);
    const Lp = hnfFromCols(c1, c2);
    let up = [0, 0];
    if (S.rS === 1 || S.rS === 2) {
      const [rx, ry] = rotVec(S.rS, g.x, g.y);
      const [uxr, uyr] = rotVec(g.q, S.u[0], S.u[1]);
      up = modL(Lp, g.x - rx + uxr, g.y - ry + uyr);
    }
    return buildRawSubgroup442(S.rS, Lp, up);
  }

  function applyOuterTau(S) {
    if (S.rS === 0) return buildRawSubgroup442(0, S.L, [0, 0]);
    const shift = S.rS === 1 ? [1, 0] : [1, 1];
    const up = modL(S.L, S.u[0] + shift[0], S.u[1] + shift[1]);
    return buildRawSubgroup442(S.rS, S.L, up);
  }

  function applyOuterSigma(S) {
    // S_y(x, y) = (x, -y)
    const Lp = hnfFromCols([S.L.d1, 0], [S.L.c, -S.L.d2]);
    let up = [0, 0];
    if (S.rS === 1) {
      // S_y (u, 1) S_y^-1 = (S_y u, 3); its inverse has q = 1, translation = -R_1(S_y u) = (-u_y, -u_x)
      up = modL(Lp, -S.u[1], -S.u[0]);
    } else if (S.rS === 2) {
      up = modL(Lp, S.u[0], -S.u[1]);
    }
    return buildRawSubgroup442(S.rS, Lp, up);
  }

  function buildRawSubgroup442(rS, L, u) {
    const info = pointInfoFromRS(rS);
    const uNorm = rS === 0 ? [0, 0] : modL(L, u[0], u[1]);
    const sub = {
      rS,
      b: info.b,
      psList: info.psList,
      psLabel: info.psLabel,
      a: L.a,
      k: info.b * L.a,
      L: { d1: L.d1, c: L.c, d2: L.d2, a: L.a },
      u: uNorm
    };
    sub.key = subKey442(sub);
    return sub;
  }

  // Exact left coset ID in 0 .. k-1 for element g = (x, y, q).
  function leftCosetId442(S, g) {
    const q = mod(g.q, 4);
    const rho = q % S.b;
    const qS = mod(q - rho, 4);
    const uqS = cocycleForQ(S.rS, S.L, S.u, qS);
    const gPrime = mul442(g, inv442({ x: uqS[0], y: uqS[1], q: qS }));
    const [hx, hy] = rotVec(mod(-rho, 4), gPrime.x, gPrime.y);
    const [rx, ry] = modL(S.L, hx, hy);
    return (rho * S.L.d2 + ry) * S.L.d1 + rx;
  }

  // Exact right coset (S-orbit under left multiplication) ID in 0 .. k-1 for g = (x, y, q).
  function rightCosetId442(S, g) {
    const q = mod(g.q, 4);
    const rho = q % S.b;
    const p = mod(rho - q, 4); // p in P_S brings q down to rho
    const up = cocycleForQ(S.rS, S.L, S.u, p);
    const [gx, gy] = rotVec(p, g.x, g.y);
    const [rx, ry] = modL(S.L, up[0] + gx, up[1] + gy);
    return (rho * S.L.d2 + ry) * S.L.d1 + rx;
  }

  function leftCosetReps442(S) {
    const reps = [];
    for (let rho = 0; rho < S.b; rho++) {
      for (let ry = 0; ry < S.L.d2; ry++) {
        for (let rx = 0; rx < S.L.d1; rx++) {
          const [gx, gy] = rotVec(rho, rx, ry);
          reps.push({ x: gx, y: gy, q: rho });
        }
      }
    }
    return reps;
  }

  function latticeIntersectionWithRot442(L) {
    // Largest C4-invariant sublattice inside L: contains a*Z^2.
    if (isLatticeRotInvariant(L, 1)) return { ...L };
    const a = L.a;
    let d1K = a;
    for (let d = 1; d <= a; d++) {
      if (a % d === 0 && inL(L, d, 0) && inL(L, 0, d)) {
        d1K = d;
        break;
      }
    }
    // Enumerate candidates for smallest d2K dividing d1K (since L_K is C4-invariant, (c, d2) implies (-d2, c) in L_K -> d2 | d1K)
    for (let d2 = 1; d2 <= d1K; d2++) {
      if (d1K % d2 !== 0) continue;
      for (let c = 0; c < d1K; c++) {
        const cand = { d1: d1K, c, d2, a: d1K * d2 };
        if (
          isLatticeRotInvariant(cand, 1) &&
          inL(L, cand.d1, 0) &&
          inL(L, cand.c, cand.d2) &&
          inL(L, -cand.d2, cand.c)
        ) {
          // Verify maximal: check all vectors of L in [0..a-1]^2 also in cand whenever rotated 90 is in L
          let maximal = true;
          for (let y = 0; y < a && maximal; y += L.d2) {
            const m = y / L.d2;
            for (let rx = 0; rx < a; rx += L.d1) {
              const x = mod(L.c * m + rx, a);
              if (inL(L, -y, x) && !inL(cand, x, y)) {
                maximal = false;
              }
            }
          }
          if (maximal) return cand;
        }
      }
    }
    return { d1: a, c: 0, d2: a, a: a * a };
  }

  function kernelAndQuotient442(S) {
    const reps = leftCosetReps442(S);
    const LK = latticeIntersectionWithRot442(S.L);

    // Check normaliser in 442 via left coset reps
    let normCount = 0;
    const conjKeys = new Set();
    for (const g of reps) {
      const cg = conjugateSubgroup442(S, g);
      conjKeys.add(cg.key);
      if (cg.key === S.key) normCount++;
    }
    const normaliserIndexInG = S.k / normCount;
    const isNormal = conjKeys.size === 1;

    // Collect L / LK coset representatives to test u_q + l shifts for K_P.
    const lkCosetReps = [];
    const seenModLK = new Set();
    for (let ry = 0; ry < S.L.d2; ry++) {
      for (let rx = 0; rx < S.L.d1; rx++) {
        // Not all (x,y); iterate multiples of L basis up to a
      }
    }
    const maxStep = LK.a;
    for (let m = 0; m < maxStep; m++) {
      for (let n = 0; n < maxStep; n++) {
        const vx = n * S.L.d1 + m * S.L.c;
        const vy = m * S.L.d2;
        const [kx, ky] = modL(LK, vx, vy);
        const tag = `${kx},${ky}`;
        if (!seenModLK.has(tag)) {
          seenModLK.add(tag);
          lkCosetReps.push([kx, ky]);
        }
      }
    }

    // Check if an element of order 4 or 2 can survive inside core(S)
    let rK = 0;
    let uK = [0, 0];
    const checkRotationInCore = (qTest) => {
      const uBase = cocycleForQ(S.rS, S.L, S.u, qTest);
      for (const lr of lkCosetReps) {
        const cand = { x: uBase[0] + lr[0], y: uBase[1] + lr[1], q: qTest };
        // Must stay in S under conjugation by all 442 coset reps AND extra translation shifts if LK != L
        let ok = true;
        for (const g of reps) {
          if (!inSubgroup442(S, conj442(g, cand))) {
            ok = false;
            break;
          }
        }
        // Check generators t(1,0), t(0,1), r explicitly too (in case rep list didn't cover a shift mod L_K)
        if (ok) {
          for (const g of [{ x: 1, y: 0, q: 0 }, { x: 0, y: 1, q: 0 }, { x: 0, y: 0, q: 1 }]) {
            const img = conj442(g, cand);
            const diff = [img.x - cand.x, img.y - cand.y];
            if (!inL(LK, diff[0], diff[1]) || !inSubgroup442(S, img)) {
              ok = false;
              break;
            }
          }
        }
        if (ok) return modL(LK, cand.x, cand.y);
      }
      return null;
    };

    if (S.rS === 1) {
      const found1 = checkRotationInCore(1);
      if (found1) {
        rK = 1;
        uK = found1;
      } else {
        const found2 = checkRotationInCore(2);
        if (found2) {
          rK = 2;
          uK = found2;
        }
      }
    } else if (S.rS === 2) {
      const found2 = checkRotationInCore(2);
      if (found2) {
        rK = 2;
        uK = found2;
      }
    }

    const K = buildRawSubgroup442(rK, LK, uK);
    const qOrder = K.k; // since K is normal in 442, [442 : K] = K.k!
    const qInfo = identifyQuotient442(K);

    return {
      K,
      isNormal,
      conjugateCount: conjKeys.size,
      normaliserCosetsPerBlock: normCount,
      normaliserIndexInG,
      qOrder,
      qLabel: qInfo.label,
      qAbelian: qInfo.abelian
    };
  }

  function identifyQuotient442(K) {
    const order = K.k;
    if (order === 1) return { label: "C₁ (trivial)", abelian: true };
    if (order === 2) return { label: "C₂", abelian: true };
    if (order === 3) return { label: "C₃", abelian: true };

    // Enumerate elements of Q = 442 / K via coset reps of K and check abelian + max element order.
    const reps = leftCosetReps442(K);
    const idOf = new Map();
    reps.forEach((g, idx) => {
      idOf.set(leftCosetId442(K, g), idx);
    });
    const mulQ = (i, j) => idOf.get(leftCosetId442(K, mul442(reps[i], reps[j])));
    const idElem = idOf.get(leftCosetId442(K, { x: 0, y: 0, q: 0 }));

    let abelian = true;
    for (let i = 0; i < order && abelian; i++) {
      for (let j = i + 1; j < order; j++) {
        if (mulQ(i, j) !== mulQ(j, i)) {
          abelian = false;
          break;
        }
      }
    }
    let maxOrd = 1;
    let ord2Count = 0;
    for (let i = 0; i < order; i++) {
      let cur = i;
      let o = 1;
      while (cur !== idElem && o <= order) {
        cur = mulQ(cur, i);
        o++;
      }
      if (o > maxOrd) maxOrd = o;
      if (o === 2) ord2Count++;
    }

    if (order === 4) {
      return {
        label: maxOrd === 4 ? "C₄" : "C₂ × C₂",
        abelian: true
      };
    }
    if (order === 5) return { label: "C₅", abelian: true };
    if (order === 6) return { label: abelian ? "C₆" : "D₃ (S₃)", abelian };
    if (order === 8) {
      if (!abelian) {
        return { label: ord2Count >= 5 ? "D₄" : "Q₈", abelian: false };
      }
      return {
        label: maxOrd === 8 ? "C₈" : maxOrd === 4 ? "C₄ × C₂" : "C₂³",
        abelian: true
      };
    }
    if (order === 9) return { label: maxOrd === 9 ? "C₉" : "C₃ × C₃", abelian: true };
    if (order === 10) return { label: abelian ? "C₁₀" : "D₅", abelian };
    if (order === 20 && !abelian) return { label: "C₅ ⋊ C₄ (F₂₀)", abelian: false };

    if (!abelian && K.rS !== 1) {
      const subDigits = (n) =>
        String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);
      const s1 = gcd(gcd(K.L.d1, K.L.c), K.L.d2);
      const s2 = K.L.a / s1;
      const tq = s1 === 1 ? `C${subDigits(s2)}` : `(C${subDigits(s2)} × C${subDigits(s1)})`;
      const pq = K.rS === 2 ? "C₂" : "C₄";
      return { label: `${tq} ⋊ ${pq} (order ${order})`, abelian: false };
    }

    return {
      label: `${abelian ? "Abelian" : "Non-abelian"} order ${order} (max ord ${maxOrd})`,
      abelian
    };
  }

  function latticesOfIndex(a) {
    const out = [];
    for (let d1 = 1; d1 <= a; d1++) {
      if (a % d1 !== 0) continue;
      const d2 = a / d1;
      for (let c = 0; c < d1; c++) {
        out.push({ d1, c, d2, a });
      }
    }
    return out;
  }

  function gaussianIdealNote(L) {
    // Describe L geometrically using 2D Gauss reduction & Gaussian integers if C4-invariant.
    const [v1, v2] = gaussReduce2D([L.d1, 0], [L.c, L.d2]);
    const isC4 = isLatticeRotInvariant(L, 1);
    let gauss = "";
    if (isC4) {
      // Find (u, v) = shortest nonzero vector in L
      const u = v1[0];
      const v = v1[1];
      const norm = u * u + v * v;
      const absU = Math.abs(u);
      const absV = Math.abs(v);
      const sign = u * v >= 0 ? "+" : "−";
      gauss = `C₄-invariant Gaussian ideal (${absU || absV === 0 ? absU : ""}${
        absV === 0 ? "" : (absU === 0 ? "" : ` ${sign} `) + (absV === 1 ? "i" : `${absV}i`)
      })ℤ[i], norm ${absU}² + ${absV}² = ${norm}`;
      // Simplify cleanly
      const re = v1[0];
      const im = v1[1];
      const imPart = Math.abs(im) === 0 ? "" : Math.abs(im) === 1 ? "i" : `${Math.abs(im)}i`;
      const term =
        re === 0
          ? imPart || "0"
          : im === 0
          ? `${re}`
          : `${re} ${im > 0 ? "+" : "−"} ${imPart}`;
      gauss = `C₄-invariant ideal (${term})ℤ[i] (${re}² + ${im}² = ${norm})`;
    }
    return {
      v1,
      v2,
      isC4,
      gauss,
      hnf: `((${L.d1}, ${L.c}), (0, ${L.d2}))`,
      basisText: `⟨(${v1[0]}, ${v1[1]}), (${v2[0]}, ${v2[1]})⟩`
    };
  }

  function rotationCenterText(sub) {
    if (sub.rS === 0) return "None (pure lattice L)";
    if (sub.rS === 1) {
      const cx = (sub.u[0] - sub.u[1]) / 2;
      const cy = (sub.u[0] + sub.u[1]) / 2;
      const fmt = (val) => (Number.isInteger(val) ? String(val) : `${val * 2}/2`);
      return `4-fold at (${fmt(cx)}, ${fmt(cy)}) mod ½L`;
    }
    const fmt = (val) => (Number.isInteger(val) ? String(val) : `${val * 2}/2`);
    return `2-fold at (${fmt(sub.u[0] / 2)}, ${fmt(sub.u[1] / 2)}) mod ½L`;
  }

  function enumerate442(maxK = 10) {
    const allSubgroups = [];
    const byK = new Map();
    for (let k = 1; k <= maxK; k++) {
      byK.set(k, {
        k,
        subgroups: [],
        conjClasses: [],
        properClasses: [],
        autClasses: []
      });
    }

    for (let k = 1; k <= maxK; k++) {
      const bucket = byK.get(k);
      for (const rS of [1, 2, 0]) {
        const b = rS === 1 ? 1 : rS === 2 ? 2 : 4;
        if (k % b !== 0) continue;
        const a = k / b;
        const lats = latticesOfIndex(a);
        for (const L of lats) {
          if (rS === 1 && !isLatticeRotInvariant(L, 1)) continue;
          if (rS === 2 && !isLatticeRotInvariant(L, 2)) continue;
          if (rS === 0) {
            const sub = buildRawSubgroup442(0, L, [0, 0]);
            bucket.subgroups.push(sub);
            allSubgroups.push(sub);
          } else {
            for (let uy = 0; uy < L.d2; uy++) {
              for (let ux = 0; ux < L.d1; ux++) {
                const sub = buildRawSubgroup442(rS, L, [ux, uy]);
                bucket.subgroups.push(sub);
                allSubgroups.push(sub);
              }
            }
          }
        }
      }

      // Compute conjugacy, proper-affine, and Aut(442) classes inside bucket.subgroups
      const byKey = new Map();
      bucket.subgroups.forEach((s) => {
        s.info = kernelAndQuotient442(s);
        s.latNote = gaussianIdealNote(s.L);
        s.centerText = rotationCenterText(s);
        byKey.set(s.key, s);
      });

      const gen442 = [
        { x: 1, y: 0, q: 0 },
        { x: 0, y: 1, q: 0 },
        { x: 0, y: 0, q: 1 }
      ];

      const collectOrbit = (seed, useTau, useSigma) => {
        const seen = new Set([seed.key]);
        const queue = [seed];
        while (queue.length > 0) {
          const cur = queue.shift();
          for (const g of gen442) {
            const nxt = conjugateSubgroup442(cur, g);
            if (!seen.has(nxt.key)) {
              seen.add(nxt.key);
              queue.push(byKey.get(nxt.key) || nxt);
            }
          }
          if (useTau) {
            const nxt = applyOuterTau(cur);
            if (!seen.has(nxt.key)) {
              seen.add(nxt.key);
              queue.push(byKey.get(nxt.key) || nxt);
            }
          }
          if (useSigma) {
            const nxt = applyOuterSigma(cur);
            if (!seen.has(nxt.key)) {
              seen.add(nxt.key);
              queue.push(byKey.get(nxt.key) || nxt);
            }
          }
        }
        return [...seen].map((key) => byKey.get(key));
      };

      // 1. 442 conjugacy classes
      const conjDone = new Set();
      bucket.subgroups.forEach((s) => {
        if (conjDone.has(s.key)) return;
        const members = collectOrbit(s, false, false);
        members.forEach((m) => conjDone.add(m.key));
        const cid = bucket.conjClasses.length + 1;
        const cls = {
          id: `k${k}-c${cid}`,
          index: cid,
          rep: members[0],
          members
        };
        members.forEach((m) => (m.conjClassId = cls.id));
        bucket.conjClasses.push(cls);
      });

      // 2. Proper-affine classes
      const properDone = new Set();
      bucket.subgroups.forEach((s) => {
        if (properDone.has(s.key)) return;
        const members = collectOrbit(s, true, false);
        members.forEach((m) => properDone.add(m.key));
        const pid = bucket.properClasses.length + 1;
        const cls = { id: `k${k}-p${pid}`, index: pid, rep: members[0], members };
        members.forEach((m) => (m.properClassId = cls.id));
        bucket.properClasses.push(cls);
      });

      // 3. Aut(442) classes
      const autDone = new Set();
      bucket.subgroups.forEach((s) => {
        if (autDone.has(s.key)) return;
        const members = collectOrbit(s, true, true);
        members.forEach((m) => autDone.add(m.key));
        const aid = bucket.autClasses.length + 1;
        const conjIds = [...new Set(members.map((m) => m.conjClassId))];
        const properIds = [...new Set(members.map((m) => m.properClassId))];
        const chiral = properIds.length > 1;
        const cls = {
          id: `k${k}-a${aid}`,
          index: aid,
          rep: members[0],
          members,
          chiral,
          properCount: properIds.length,
          conjGroups: conjIds.map((id) => bucket.conjClasses.find((c) => c.id === id))
        };
        members.forEach((m) => (m.autClassId = cls.id));
        bucket.autClasses.push(cls);
      });
    }

    return { maxK, byK, allSubgroups };
  }

  // Evaluate colouring on a finite grid [-R..R]^2 x {0..3}
  function gridElements442(radius) {
    const els = [];
    for (let j = -radius; j <= radius; j++) {
      for (let i = -radius; i <= radius; i++) {
        for (let q = 0; q < 4; q++) {
          els.push({ x: i, y: j, q });
        }
      }
    }
    return els;
  }

  // Computes colours under mode "coset" or "orbit" after left action of h on initial subgroup S.
  // Acting by h on the left maps left cosets gS -> (hg)S (same partition!),
  // and maps S-orbits Sg -> (h S h^-1) (hg) (orbits of conjugate hSh^-1).
  function evaluatePatch442(S, mode, h, radius) {
    const hi = inv442(h);
    const els = gridElements442(radius);
    const raw = els.map((g) => {
      const pre = mul442(hi, g);
      return mode === "coset" ? leftCosetId442(S, pre) : rightCosetId442(S, pre);
    });
    // Stabilize colours consistently so colour ID of pre=e stays at 1 when h=e,
    // using canonical map from fixed ID (0..k-1) -> 1..k based on e-order over whole k.
    const colors = raw.map((id) => id + 1);
    return { els, colors };
  }

  // Checks invariance of motion m applied to current colouring state (represented by h applied to S).
  // Compare `before` = (h on S) and `after` = (m ∘ h on S) over inner [-2..2]^2 grid.
  function checkMotionVerdict442(S, mode, hBefore, motion) {
    const innerEls = gridElements442(2);
    const hiBefore = inv442(hBefore);
    const hAfter = mul442(motion, hBefore);
    const hiAfter = inv442(hAfter);
    const idFn = mode === "coset" ? leftCosetId442 : rightCosetId442;
    const before = innerEls.map((g) => idFn(S, mul442(hiBefore, g)) + 1);
    const after = innerEls.map((g) => idFn(S, mul442(hiAfter, g)) + 1);
    const res = permOf(before, after);
    const curS = mode === "coset" ? S : conjugateSubgroup442(S, hBefore);
    const nextS = mode === "coset" ? S : conjugateSubgroup442(S, hAfter);
    return { ...res, curS, nextS, hAfter };
  }

  function validateBuilder442(rS, d1, c, d2, ux, uy) {
    if (!Number.isInteger(d1) || d1 < 1 || !Number.isInteger(d2) || d2 < 1) {
      return { ok: false, error: "d₁ and d₂ must be integers ≥ 1." };
    }
    const cClean = mod(c, d1);
    const L = { d1, c: cClean, d2, a: d1 * d2 };
    if (rS === 1 && !isLatticeRotInvariant(L, 1)) {
      const r1 = rotVec(1, d1, 0);
      const r2 = rotVec(1, cClean, d2);
      const why = !inL(L, r1[0], r1[1])
        ? `R₉₀(${d1}, 0) = (${r1[0]}, ${r1[1]}) ∉ L`
        : `R₉₀(${cClean}, ${d2}) = (${r2[0]}, ${r2[1]}) ∉ L`;
      return {
        ok: false,
        L,
        error: `C₄ does NOT preserve L: ${why}. A C₄-invariant sublattice exists only when a = d₁·d₂ = u² + v² (Gaussian ideal norm).`
      };
    }
    const uUse = rS === 0 ? [0, 0] : [mod(ux, d1), mod(uy, d2)];
    const sub = buildRawSubgroup442(rS, L, uUse);
    sub.info = kernelAndQuotient442(sub);
    sub.latNote = gaussianIdealNote(sub.L);
    sub.centerText = rotationCenterText(sub);
    return { ok: true, sub };
  }

  // =========================================================================
  // PART 3: DOM Interactive UI (guarded for browser-only execution)
  // =========================================================================

  function svgEl(tag, attrs = {}, text = null) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
    if (text !== null) el.textContent = text;
    return el;
  }

  function formatPermMapping(res, labelPrefix = "") {
    if (res.kind === "fixes") return "fixes every colour";
    if (res.kind === "breaks") return "breaks colour partition";
    const pairs = [];
    const seen = new Set();
    const keys = [...res.mapping.keys()].sort((a, b) => a - b);
    for (const start of keys) {
      if (seen.has(start)) continue;
      let cur = start;
      const cyc = [];
      while (!seen.has(cur)) {
        seen.add(cur);
        cyc.push(cur);
        cur = res.mapping.get(cur);
      }
      if (cyc.length > 1) pairs.push(`(${cyc.join(" ")})`);
    }
    return `${labelPrefix}permutes colours: ${pairs.join("") || "identity"}`;
  }

  function initUI() {
    const tabBtns = [...document.querySelectorAll(".sg-tab")];
    const panels = [...document.querySelectorAll(".sg-panel")];

    function activateTab(tabId, updateHash = true) {
      tabBtns.forEach((b) => {
        const match = b.dataset.tab === tabId;
        b.setAttribute("aria-selected", match ? "true" : "false");
      });
      panels.forEach((p) => {
        const match = p.dataset.panel === tabId;
        if (match) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });
      if (updateHash && typeof history !== "undefined") {
        history.replaceState(null, "", `#${tabId}`);
      }
    }

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.dataset.tab, true));
    });

    document.querySelectorAll("[data-jump-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activateTab(btn.dataset.jumpTab, true);
        if (btn.dataset.jumpK && window._set442K) {
          window._set442K(Number(btn.dataset.jumpK));
        }
        if (btn.dataset.jumpD3 && window._setD3Sub) {
          window._setD3Sub(btn.dataset.jumpD3);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    const hashTab = (window.location.hash || "").replace("#", "");
    if (["d3", "p4", "bridge"].includes(hashTab)) {
      activateTab(hashTab, false);
    }

    initD3Section();
    init442Section();
  }

  // -------------------------------------------------------------------------
  // UI A: D3 Interactive Section
  // -------------------------------------------------------------------------
  function drawRosetteSVG(svg, coloring, options = {}) {
    const {
      selectedSet = null,
      clickable = false,
      onPieceClick = null,
      animateTransform = ""
    } = options;
    svg.innerHTML = "";
    const cx = 130;
    const cy = 122;
    const R = 96;

    const rotGroup = svgEl("g", {
      class: "sg-rosette-layer"
    });

    // Build reverse lookup: wedge index w (0..5) -> element g
    const wedgeToElem = new Array(6);
    for (let g = 0; g < 6; g++) wedgeToElem[D3_SLOT[g]] = g;

    const toXY = (deg, rad) => {
      const a = (deg * Math.PI) / 180;
      return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)];
    };

    for (let w = 0; w < 6; w++) {
      const g = wedgeToElem[w];
      const ang0 = w * 60;
      const ang1 = (w + 1) * 60;
      // Equilateral triangle vertices at multiples of 120° (r=R), midpoints at 60°,180°,300° (r=R/2)
      const r0 = w % 2 === 0 ? R : R * 0.5;
      const r1 = w % 2 === 0 ? R * 0.5 : R;
      const [x0, y0] = toXY(ang0, r0);
      const [x1, y1] = toXY(ang1, r1);
      const cid = coloring[g];
      const fill = colorFor(cid);
      const ink = inkFor(cid);
      const isHi = selectedSet && selectedSet.has(g);

      const grp = svgEl("g", {
        class: `sg-piece${clickable ? " is-clickable" : ""}`,
        "data-el": g
      });
      const poly = svgEl("polygon", {
        points: `${cx},${cy} ${x0.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`,
        fill,
        stroke: isHi ? "#111827" : "#ffffff",
        "stroke-width": isHi ? "3.2" : "1.8",
        "stroke-linejoin": "round"
      });
      grp.appendChild(poly);

      // Chiral dot safely inside the acute corner, shifted away from midline and clear of text centroid
      const dotAng = w % 2 === 0 ? ang0 + 12 : ang1 - 12;
      const [dx, dy] = toXY(dotAng, R * 0.64);
      const dot = svgEl("circle", {
        cx: dx.toFixed(1),
        cy: dy.toFixed(1),
        r: "2.5",
        fill: ink,
        opacity: "0.78",
        "pointer-events": "none"
      });
      grp.appendChild(dot);

      // Label centroid pushed slightly toward vertex for clear separation from dot
      const lx = (cx + x0 + x1) / 3;
      const ly = (cy + y0 + y1) / 3;
      const lbl = svgEl(
        "text",
        {
          x: lx.toFixed(1),
          y: (ly + 4).toFixed(1),
          "text-anchor": "middle",
          fill: ink,
          "font-size": "12",
          "font-weight": "700",
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "pointer-events": "none"
        },
        D3_NAMES[g]
      );
      grp.appendChild(lbl);

      if (clickable && onPieceClick) {
        grp.addEventListener("click", () => onPieceClick(g));
      }
      rotGroup.appendChild(grp);
    }

    // Outer subtle mirror reference axes (dotted line for horizontal axis b)
    const [bx1, by1] = toXY(180, R * 0.66);
    const [bx2, by2] = toXY(0, R * 1.11);
    svg.appendChild(
      svgEl("line", {
        x1: bx1.toFixed(1),
        y1: by1.toFixed(1),
        x2: bx2.toFixed(1),
        y2: by2.toFixed(1),
        stroke: "#9ca3af",
        "stroke-width": "1",
        "stroke-dasharray": "3,3"
      })
    );
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animateTransform && !prefersReduced && typeof rotGroup.animate === "function") {
      try {
        rotGroup.style.transformBox = "view-box";
        rotGroup.style.transformOrigin = "50% 50%";
        rotGroup.animate(
          [{ transform: animateTransform }, { transform: "none" }],
          { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
      } catch (_) {}
    }
    svg.appendChild(rotGroup);
    svg.appendChild(
      svgEl("circle", { cx, cy, r: "3.5", fill: "#1f2430", stroke: "#ffffff", "stroke-width": "1.2" })
    );
  }

  function d3InvCssTransform(h) {
    // Inverse rigid motion in CSS transform-origin (cx, cy) around center so
    // animating from inverse -> none glides the rosette forward by h.
    switch (h) {
      case 1:
        return "rotate(120deg)";
      case 2:
        return "rotate(-120deg)";
      case 3:
        return "scaleY(-1)";
      case 4:
        return "rotate(-60deg) scaleY(-1) rotate(60deg)";
      case 5:
        return "rotate(-120deg) scaleY(-1) rotate(120deg)";
    }
    return "";
  }

  function initD3Section() {
    const hasseSvg = document.getElementById("d3-hasse-svg");
    if (!hasseSvg) return;

    const leftSvg = document.getElementById("d3-left-svg");
    const rightSvg = document.getElementById("d3-right-svg");
    const leftStatus = document.getElementById("d3-left-status");
    const rightStatus = document.getElementById("d3-right-status");
    const motionRow = document.getElementById("d3-motion-row");
    const subFacts = document.getElementById("d3-sub-facts");
    const dcWrap = document.getElementById("d3-dc-wrap");
    const dcHint = document.getElementById("d3-dc-hint");

    let activeSub = D3_SUBGROUPS[2]; // default ⟨b⟩ so gS vs Sg divergence is visible immediately
    let activeMotion = 0; // element 0..5 applied to initial coset/orbit colourings
    let highlightedPieces = new Set();

    window._setD3Sub = (id) => {
      const found = D3_SUBGROUPS.find((s) => s.id === id);
      if (found) {
        activeSub = found;
        activeMotion = 0;
        highlightedPieces = new Set();
        renderD3Main();
      }
    };

    const hasseCoords = {
      D3: { x: 150, y: 34 },
      C3: { x: 75, y: 98 },
      b: { x: 150, y: 120 },
      ab: { x: 215, y: 120 },
      a2b: { x: 280, y: 120 },
      E: { x: 150, y: 188 }
    };

    const hasseEdges = [
      ["D3", "C3"],
      ["D3", "b"],
      ["D3", "ab"],
      ["D3", "a2b"],
      ["C3", "E"],
      ["b", "E"],
      ["ab", "E"],
      ["a2b", "E"]
    ];

    function renderHasse() {
      hasseSvg.innerHTML = "";
      // Conjugacy box around the 3 reflections
      hasseSvg.appendChild(
        svgEl("rect", {
          x: 118,
          y: 94,
          width: 194,
          height: 52,
          rx: 10,
          fill: "rgba(224, 145, 60, 0.08)",
          stroke: "#e0913c",
          "stroke-width": "1.2",
          "stroke-dasharray": "4,3"
        })
      );
      hasseSvg.appendChild(
        svgEl(
          "text",
          {
            x: 215,
            y: 159,
            "text-anchor": "middle",
            fill: "#92400e",
            "font-size": "10",
            "font-weight": "700"
          },
          "1 conjugacy class · 3 placements"
        )
      );

      for (const [u, v] of hasseEdges) {
        const p1 = hasseCoords[u];
        const p2 = hasseCoords[v];
        hasseSvg.appendChild(
          svgEl("line", {
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            stroke: "#cbd5e1",
            "stroke-width": "1.8"
          })
        );
      }

      D3_SUBGROUPS.forEach((sub) => {
        const pos = hasseCoords[sub.id];
        const isSel = sub.id === activeSub.id;
        const g = svgEl("g", {
          class: `sg-hnode${isSel ? " is-selected" : ""}`,
          "data-sub": sub.id,
          role: "button",
          tabindex: "0"
        });
        g.appendChild(
          svgEl("rect", {
            x: pos.x - 28,
            y: pos.y - 17,
            width: 56,
            height: 34,
            rx: 8
          })
        );
        g.appendChild(
          svgEl(
            "text",
            {
              x: pos.x,
              y: pos.y - 1,
              "text-anchor": "middle",
              "font-size": "12",
              "font-weight": "700"
            },
            sub.shortLabel
          )
        );
        g.appendChild(
          svgEl(
            "text",
            {
              class: "sg-hsub",
              x: pos.x,
              y: pos.y + 11,
              "text-anchor": "middle",
              "font-size": "9.5"
            },
            `k=${sub.index}${sub.normal ? " · N" : ""}`
          )
        );
        g.addEventListener("click", () => {
          activeSub = sub;
          activeMotion = 0;
          highlightedPieces = new Set();
          renderD3Main();
        });
        g.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activeSub = sub;
            activeMotion = 0;
            highlightedPieces = new Set();
            renderD3Main();
          }
        });
        hasseSvg.appendChild(g);
      });
    }

    function renderD3MotionButtons() {
      motionRow.innerHTML = "";
      for (let h = 0; h < 6; h++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sg-btn motion sm";
        btn.setAttribute("aria-pressed", activeMotion === h ? "true" : "false");
        btn.dataset.motion = String(h);
        btn.textContent = h === 0 ? "e (reset)" : D3_NAMES[h];
        btn.addEventListener("click", () => {
          const prev = activeMotion;
          activeMotion = h;
          const stepH = h === 0 ? 0 : D3_MUL[h][D3_INV[prev]];
          renderD3RosettesAndStatus(stepH);
          renderD3MotionButtons();
        });
        motionRow.appendChild(btn);
      }
    }

    function renderD3RosettesAndStatus(animateStepH = 0) {
      const leftAfter = actD3(activeMotion, activeSub.leftColoring);
      const rightAfter = actD3(activeMotion, activeSub.rightColoring);
      const anim = animateStepH ? d3InvCssTransform(animateStepH) : "";

      drawRosetteSVG(leftSvg, leftAfter, {
        selectedSet: highlightedPieces,
        clickable: true,
        animateTransform: anim,
        onPieceClick: (el) => {
          const blk = activeSub.leftCosets.find((b) => b.elements.includes(el));
          highlightedPieces = new Set(blk ? blk.elements : [el]);
          renderD3RosettesAndStatus();
        }
      });
      drawRosetteSVG(rightSvg, rightAfter, {
        selectedSet: highlightedPieces,
        clickable: true,
        animateTransform: anim,
        onPieceClick: (el) => {
          const blk = activeSub.rightCosets.find((b) => b.elements.includes(el));
          highlightedPieces = new Set(blk ? blk.elements : [el]);
          renderD3RosettesAndStatus();
        }
      });

      const leftVerdict = permOf(activeSub.leftColoring, leftAfter);
      leftStatus.dataset.kind = leftVerdict.kind;
      leftStatus.textContent =
        activeMotion === 0
          ? `gS initial state · ${activeSub.index} colour${activeSub.index > 1 ? "s" : ""} (perfect)`
          : `${D3_NAMES[activeMotion]} ${formatPermMapping(leftVerdict)} → perfect`;

      const rightVerdict = permOf(activeSub.rightColoring, rightAfter);
      const conjEls = conjugateD3Set(activeSub.elements, activeMotion);
      const conjSub = findD3SubgroupByElements(conjEls);
      rightStatus.dataset.kind = rightVerdict.kind;
      if (activeMotion === 0) {
        rightStatus.textContent = `Sg initial orbits of ${activeSub.shortLabel}`;
      } else if (rightVerdict.kind === "breaks") {
        rightStatus.textContent = `${D3_NAMES[activeMotion]} breaks Sg → now orbits of ${
          conjSub ? conjSub.shortLabel : formatSet(conjEls, D3_NAMES)
        } (≠ ${activeSub.shortLabel})`;
      } else {
        rightStatus.textContent = `${D3_NAMES[activeMotion]} ${formatPermMapping(
          rightVerdict
        )} (in N(${activeSub.shortLabel}))`;
      }
    }

    function renderD3Facts() {
      const kerSub = findD3SubgroupByElements(activeSub.kernel);
      subFacts.innerHTML = `
        <dt>Subgroup S</dt><dd>${activeSub.label} (${formatSet(
        activeSub.elements,
        D3_NAMES
      )})</dd>
        <dt>Index k = |D₃|/|S|</dt><dd>${activeSub.index} colour${
        activeSub.index > 1 ? "s" : ""
      }</dd>
        <dt>Normal in D₃?</dt><dd>${
          activeSub.normal ? "Yes (gS = Sg for all g)" : "No (gS ≠ Sg)"
        }</dd>
        <dt>Normaliser N(S)</dt><dd>${formatSet(activeSub.normaliser, D3_NAMES)}</dd>
        <dt>Core K_P = ⋂ gSg⁻¹</dt><dd>${
        kerSub ? kerSub.shortLabel : formatSet(activeSub.kernel, D3_NAMES)
      }</dd>
        <dt>Colour group Q = D₃/K_P</dt><dd>${activeSub.colorGroup} · Bridges ${
        activeSub.table2Id
      }</dd>
      `;
    }

    function renderDoubleCosetTable() {
      const tblData = doubleCosetTableD3(activeSub);
      const table = document.createElement("table");
      table.className = "sg-dc-table";
      const thead = document.createElement("thead");
      const hr = document.createElement("tr");
      const corner = document.createElement("th");
      corner.textContent = "gᵢS \\ Sfⱼ";
      hr.appendChild(corner);

      tblData.cols.forEach((col, j) => {
        const th = document.createElement("th");
        const sw = document.createElement("span");
        sw.className = "sg-swatch";
        sw.style.background = colorFor(j + 1);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sg-dc-btn";
        btn.appendChild(sw);
        btn.appendChild(document.createTextNode(` ${formatSet(col.elements, D3_NAMES)}`));
        btn.addEventListener("click", () => {
          highlightedPieces = new Set(col.elements);
          dcHint.textContent = `Right coset / S-orbit S·${D3_NAMES[col.rep]} = ${formatSet(
            col.elements,
            D3_NAMES
          )}`;
          renderD3RosettesAndStatus();
        });
        th.appendChild(btn);
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      tblData.rows.forEach((row, i) => {
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        const sw = document.createElement("span");
        sw.className = "sg-swatch";
        sw.style.background = colorFor(i + 1);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sg-dc-btn";
        btn.appendChild(sw);
        btn.appendChild(document.createTextNode(` ${formatSet(row.elements, D3_NAMES)}`));
        btn.addEventListener("click", () => {
          highlightedPieces = new Set(row.elements);
          dcHint.textContent = `Left coset ${D3_NAMES[row.rep]}·S = ${formatSet(
            row.elements,
            D3_NAMES
          )}`;
          renderD3RosettesAndStatus();
        });
        th.appendChild(btn);
        tr.appendChild(th);

        tblData.cells[i].forEach((cell, j) => {
          const td = document.createElement("td");
          const cellBtn = document.createElement("button");
          cellBtn.type = "button";
          cellBtn.className = "sg-dc-btn";
          cellBtn.textContent = formatSet(cell.elements, D3_NAMES);
          if (cell.elements.length === 0) {
            cellBtn.style.opacity = "0.4";
          } else if (!cell.sameBlock) {
            td.style.background = "rgba(192, 57, 43, 0.08)";
          } else {
            td.style.background = "rgba(47, 107, 70, 0.1)";
          }
          cellBtn.addEventListener("click", () => {
            highlightedPieces = new Set(cell.elements);
            dcHint.textContent =
              cell.elements.length === 0
                ? `${D3_NAMES[row.rep]}S ∩ S${D3_NAMES[tblData.cols[j].rep]} = ∅`
                : `Overlap ${D3_NAMES[row.rep]}S ∩ S${D3_NAMES[tblData.cols[j].rep]} = ${formatSet(
                    cell.elements,
                    D3_NAMES
                  )}`;
            renderD3RosettesAndStatus();
          });
          td.appendChild(cellBtn);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      dcWrap.innerHTML = "";
      dcWrap.appendChild(table);
    }

    function renderD3Main() {
      renderHasse();
      renderD3MotionButtons();
      renderD3RosettesAndStatus();
      renderD3Facts();
      renderDoubleCosetTable();
    }

    renderD3Main();

    // --- Free-Paint & Bridges Table 2 Sandbox ---
    const sbSvg = document.getElementById("d3-sandbox-svg");
    const sbPalette = document.getElementById("d3-sandbox-palette");
    const sbPresets = document.getElementById("d3-sandbox-presets");
    const sbElGrid = document.getElementById("d3-sandbox-el-grid");
    const sbAnalysis = document.getElementById("d3-sandbox-analysis");
    const sbNote = document.getElementById("d3-sandbox-note");

    let sbBrush = 1;
    let sbColoring = TABLE2_PRESETS[2].coloring.slice(); // start with C3 to demonstrate non-perfect!
    let sbActivePresetId = "C3";
    let sbMotionPreview = 0;

    function renderSandboxPalette() {
      sbPalette.innerHTML = "";
      for (let c = 1; c <= 6; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sg-pal-btn";
        btn.style.background = colorFor(c);
        btn.style.color = inkFor(c);
        btn.setAttribute("aria-pressed", sbBrush === c ? "true" : "false");
        btn.textContent = String(c);
        btn.addEventListener("click", () => {
          sbBrush = c;
          renderSandboxPalette();
        });
        sbPalette.appendChild(btn);
      }
    }

    function renderSandboxPresets() {
      sbPresets.innerHTML = "";
      TABLE2_PRESETS.forEach((p) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sg-btn sm";
        btn.setAttribute("aria-pressed", sbActivePresetId === p.id ? "true" : "false");
        btn.textContent = p.id;
        btn.title = p.title;
        btn.addEventListener("click", () => {
          sbColoring = p.coloring.slice();
          sbActivePresetId = p.id;
          sbMotionPreview = 0;
          sbNote.textContent = p.note;
          renderSandboxAll();
        });
        sbPresets.appendChild(btn);
      });
      const randBtn = document.createElement("button");
      randBtn.type = "button";
      randBtn.className = "sg-btn sm";
      randBtn.textContent = "Random";
      randBtn.title = "Pick a random 3-colouring";
      randBtn.addEventListener("click", () => {
        sbColoring = canonicalColouring(
          Array.from({ length: 6 }, () => 1 + Math.floor(Math.random() * 4))
        );
        sbActivePresetId = null;
        sbMotionPreview = 0;
        sbNote.textContent = "Random colouring — almost all non-coset colourings have small H_P.";
        renderSandboxAll();
      });
      sbPresets.appendChild(randBtn);
    }

    function renderSandboxAll() {
      const shown = sbMotionPreview === 0 ? sbColoring : actD3(sbMotionPreview, sbColoring);
      drawRosetteSVG(sbSvg, shown, {
        clickable: true,
        animateTransform: sbMotionPreview ? d3InvCssTransform(sbMotionPreview) : "",
        onPieceClick: (el) => {
          sbColoring[el] = sbBrush;
          sbColoring = canonicalColouring(sbColoring);
          sbActivePresetId = null;
          sbMotionPreview = 0;
          sbNote.textContent = "Custom colouring — click any D₃ element tile below to test its action.";
          renderSandboxAll();
        }
      });

      const res = analyseColouringD3(sbColoring);
      sbElGrid.innerHTML = "";
      res.verdicts.forEach((v) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "sg-el-cell";
        cell.dataset.v = v.kind;
        cell.style.cursor = "pointer";
        cell.innerHTML = `<strong>${D3_NAMES[v.h]}</strong><span>${
          v.kind === "fixes" ? "fixes" : v.kind === "permutes" ? "permutes" : "breaks"
        }</span>`;
        cell.addEventListener("click", () => {
          sbMotionPreview = sbMotionPreview === v.h ? 0 : v.h;
          renderSandboxAll();
        });
        sbElGrid.appendChild(cell);
      });

      const badge = res.isPerfect
        ? `<span class="sg-badge ok">Perfect (H_P = D₃)</span>`
        : `<span class="sg-badge bad">Non-perfect (H_P = ${
            res.permSub ? res.permSub.shortLabel : formatSet(res.permutedBy, D3_NAMES)
          })</span>`;
      const originTxt = res.leftMatch
        ? `Left cosets gS of ${res.leftMatch.label}`
        : res.rightMatch
        ? `S-orbits (right cosets Sg) of ${res.rightMatch.label}`
        : `General Def. 1 partition across ${res.def1Orbits.length} H_P-orbit${
            res.def1Orbits.length > 1 ? "s" : ""
          }`;
      const def1Lines = res.def1Orbits
        .map(
          (o, idx) =>
            `Y${idx + 1}=${formatSet(o.orbitElements, D3_NAMES)} with J${idx + 1}=${o.jLabel}`
        )
        .join(" · ");

      sbAnalysis.innerHTML = `
        <div class="sg-btn-row" style="margin-bottom:8px;">${badge} <span class="sg-badge">${
        res.colorCount
      } colours</span>${
        sbMotionPreview !== 0
          ? `<span class="sg-badge warn">Previewing ${D3_NAMES[sbMotionPreview]} (click tile again to reset)</span>`
          : ""
      }</div>
        <dl class="sg-facts">
          <dt>Colour-permuting H_P</dt><dd>${
            res.permSub ? res.permSub.label : formatSet(res.permutedBy, D3_NAMES)
          }</dd>
          <dt>Colour-fixing K_P</dt><dd>${
            res.kerSub ? res.kerSub.label : formatSet(res.fixedBy, D3_NAMES)
          }</dd>
          <dt>Classification</dt><dd>${originTxt}</dd>
          <dt>Def. 1 (Yᵢ, Jᵢ) recipe</dt><dd>${def1Lines}</dd>
        </dl>
      `;
      renderSandboxPalette();
      renderSandboxPresets();
    }

    sbNote.textContent = TABLE2_PRESETS[2].note;
    renderSandboxAll();
  }

  // -------------------------------------------------------------------------
  // UI B: 442 (p4) Interactive Section
  // -------------------------------------------------------------------------
  function drawPlanar442SVG(svg, S, mode, h, overlays, animateTransform = "") {
    svg.innerHTML = "";
    const defs = svgEl("defs");
    const clip = svgEl("clipPath", { id: `clip-${svg.id || "p4"}` });
    clip.appendChild(svgEl("rect", { x: -2.5, y: -2.5, width: 5, height: 5 }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    const clipped = svgEl("g", { "clip-path": `url(#clip-${svg.id || "p4"})` });
    const motionGroup = svgEl("g", {
      class: "sg-planar-motion-layer"
    });

    // Margin grid radius 3 (-3..3 => 7x7 cells) so animations sliding 1 unit or rotating 90deg have zero gaps
    const patch = evaluatePatch442(S, mode, h, 3);
    patch.els.forEach((g, idx) => {
      const cid = patch.colors[idx];
      const fill = colorFor(cid);
      const ink = inkFor(cid);
      // Four right-triangle sectors in cell (g.x, g.y) using SVG y-down = -mathY
      const cx = g.x;
      const cy = -g.y;
      let p1, p2;
      if (g.q === 0) {
        p1 = [cx + 0.5, cy + 0.5];
        p2 = [cx + 0.5, cy - 0.5];
      } else if (g.q === 1) {
        p1 = [cx + 0.5, cy - 0.5];
        p2 = [cx - 0.5, cy - 0.5];
      } else if (g.q === 2) {
        p1 = [cx - 0.5, cy - 0.5];
        p2 = [cx - 0.5, cy + 0.5];
      } else {
        p1 = [cx - 0.5, cy + 0.5];
        p2 = [cx + 0.5, cy + 0.5];
      }
      motionGroup.appendChild(
        svgEl("polygon", {
          points: `${cx},${cy} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`,
          fill,
          stroke: "rgba(255,255,255,0.48)",
          "stroke-width": "0.018",
          "stroke-linejoin": "round"
        })
      );

      if (overlays.chiral) {
        // Asymmetric chiral dot + tiny tail at local (0.31, 0.13) mapped by g = t(x,y) r^q
        const [dmX, dmY] = rotVec(g.q, 0.31, 0.13);
        const [dtX, dtY] = rotVec(g.q, 0.23, 0.04);
        const sx = g.x + dmX;
        const sy = -(g.y + dmY);
        const tx = g.x + dtX;
        const ty = -(g.y + dtY);
        motionGroup.appendChild(
          svgEl("line", {
            x1: sx,
            y1: sy,
            x2: tx,
            y2: ty,
            stroke: ink,
            "stroke-width": "0.032",
            "stroke-linecap": "round",
            opacity: "0.78"
          })
        );
        motionGroup.appendChild(
          svgEl("circle", {
            cx: sx,
            cy: sy,
            r: "0.055",
            fill: ink,
            opacity: "0.84"
          })
        );
      }
    });

    // Subtle unit tile grid boundary overlay
    for (let k = -2.5; k <= 2.5; k += 1) {
      motionGroup.appendChild(
        svgEl("line", {
          x1: -3.5,
          y1: k,
          x2: 3.5,
          y2: k,
          stroke: "rgba(17,24,39,0.22)",
          "stroke-width": "0.015"
        })
      );
      motionGroup.appendChild(
        svgEl("line", {
          x1: k,
          y1: -3.5,
          x2: k,
          y2: 3.5,
          stroke: "rgba(17,24,39,0.22)",
          "stroke-width": "0.015"
        })
      );
    }

    // Active L-cell overlay (in current frame h, or initial? L-cell / S centers move with S' if orbit mode, stay S if fixed frame)
    const activeS = mode === "coset" ? S : conjugateSubgroup442(S, h);
    if (overlays.lCell) {
      const [v1, v2] = gaussReduce2D([activeS.L.d1, 0], [activeS.L.c, activeS.L.d2]);
      const p0 = [0, 0];
      const p1 = [v1[0], -v1[1]];
      const p2 = [v1[0] + v2[0], -(v1[1] + v2[1])];
      const p3 = [v2[0], -v2[1]];
      motionGroup.appendChild(
        svgEl("polygon", {
          points: `${p0} ${p1} ${p2} ${p3}`,
          fill: "rgba(255,255,255,0.08)",
          stroke: "#111827",
          "stroke-width": "0.055",
          "stroke-dasharray": "0.14,0.09"
        })
      );
    }

    if (overlays.kCell && S.info && S.info.K) {
      const LK = S.info.K.L;
      const [v1, v2] = gaussReduce2D([LK.d1, 0], [LK.c, LK.d2]);
      const p0 = [0, 0];
      const p1 = [v1[0], -v1[1]];
      const p2 = [v1[0] + v2[0], -(v1[1] + v2[1])];
      const p3 = [v2[0], -v2[1]];
      motionGroup.appendChild(
        svgEl("polygon", {
          points: `${p0} ${p1} ${p2} ${p3}`,
          fill: "none",
          stroke: "#f59e0b",
          "stroke-width": "0.055",
          "stroke-dasharray": "0.06,0.08"
        })
      );
    }

    if (overlays.centers && activeS.rS !== 0) {
      const seenPts = new Set();
      const fourFoldPts = [];
      const twoFoldPts = [];
      // Generate lattice points v in [-6..6]^2 of L
      for (let m = -8; m <= 8; m++) {
        for (let n = -8; n <= 8; n++) {
          const vx = n * activeS.L.d1 + m * activeS.L.c;
          const vy = m * activeS.L.d2;
          if (activeS.rS === 1) {
            // Fixed point of (v + u_1, 1): (I - R_1)^-1 (v + u_1) = 0.5 * [[1,-1],[1,1]] (v + u_1)
            const sx = vx + activeS.u[0];
            const sy = vy + activeS.u[1];
            const px = (sx - sy) / 2;
            const py = (sx + sy) / 2;
            if (Math.abs(px) <= 2.6 && Math.abs(py) <= 2.6) {
              const tag = `4:${px},${py}`;
              if (!seenPts.has(tag)) {
                seenPts.add(tag);
                fourFoldPts.push([px, py]);
              }
            }
            // Fixed point of (v + u_2, 2): 0.5 * (v + u_2)
            const u2 = cocycleForQ(1, activeS.L, activeS.u, 2);
            const p2x = (vx + u2[0]) / 2;
            const p2y = (vy + u2[1]) / 2;
            if (Math.abs(p2x) <= 2.6 && Math.abs(p2y) <= 2.6) {
              if (!seenPts.has(`4:${p2x},${p2y}`) && !seenPts.has(`2:${p2x},${p2y}`)) {
                seenPts.add(`2:${p2x},${p2y}`);
                twoFoldPts.push([p2x, p2y]);
              }
            }
          } else if (activeS.rS === 2) {
            const p2x = (vx + activeS.u[0]) / 2;
            const p2y = (vy + activeS.u[1]) / 2;
            if (Math.abs(p2x) <= 2.6 && Math.abs(p2y) <= 2.6) {
              const tag = `2:${p2x},${p2y}`;
              if (!seenPts.has(tag)) {
                seenPts.add(tag);
                twoFoldPts.push([p2x, p2y]);
              }
            }
          }
        }
      }
      twoFoldPts.forEach(([px, py]) => {
        motionGroup.appendChild(
          svgEl("ellipse", {
            cx: px,
            cy: -py,
            rx: "0.09",
            ry: "0.05",
            fill: "#ffffff",
            stroke: "#111827",
            "stroke-width": "0.03"
          })
        );
      });
      fourFoldPts.forEach(([px, py]) => {
        const s = 0.095;
        motionGroup.appendChild(
          svgEl("polygon", {
            points: `${px},${-py - s} ${px + s},${-py} ${px},${-py + s} ${px - s},${-py}`,
            fill: "#ffffff",
            stroke: "#111827",
            "stroke-width": "0.032"
          })
        );
      });
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animateTransform && !prefersReduced && typeof motionGroup.animate === "function") {
      try {
        motionGroup.style.transformBox = "view-box";
        motionGroup.style.transformOrigin = "50% 50%";
        motionGroup.animate(
          [{ transform: animateTransform }, { transform: "none" }],
          { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
      } catch (_) {}
    }

    clipped.appendChild(motionGroup);
    svg.appendChild(clipped);

    // Outer frame & origin reticle
    svg.appendChild(
      svgEl("rect", {
        x: -2.5,
        y: -2.5,
        width: 5,
        height: 5,
        fill: "none",
        stroke: "#cbd5e1",
        "stroke-width": "0.03"
      })
    );
    svg.appendChild(
      svgEl("circle", {
        cx: 0,
        cy: 0,
        r: "0.06",
        fill: "#111827",
        stroke: "#ffffff",
        "stroke-width": "0.02"
      })
    );
  }

  function init442Section() {
    const indexBar = document.getElementById("p4-index-bar");
    if (!indexBar) return;

    const catalog = enumerate442(10);
    const catalogBody = document.getElementById("p4-catalog-body");
    const autWrap = document.getElementById("p4-aut-wrap");
    const emptyBox = document.getElementById("p4-empty-box");
    const stageSingle = document.getElementById("p4-stage-single");
    const stageDual = document.getElementById("p4-stage-dual");
    const mainSvg = document.getElementById("p4-main-svg");
    const dualCosetSvg = document.getElementById("p4-dual-coset-svg");
    const dualOrbitSvg = document.getElementById("p4-dual-orbit-svg");
    const modeNote = document.getElementById("p4-mode-note");
    const mainVerdict = document.getElementById("p4-verdict-main");
    const dualCosetVerdict = document.getElementById("p4-verdict-dual-coset");
    const dualOrbitVerdict = document.getElementById("p4-verdict-dual-orbit");
    const factsEl = document.getElementById("p4-facts");

    // Builder DOM
    const bPs = document.getElementById("b-ps");
    const bD1 = document.getElementById("b-d1");
    const bC = document.getElementById("b-c");
    const bD2 = document.getElementById("b-d2");
    const bUx = document.getElementById("b-ux");
    const bUy = document.getElementById("b-uy");
    const bStatus = document.getElementById("b-status");
    const bLoadBtn = document.getElementById("b-load");

    let activeK = 5;
    let activeSub = catalog.byK.get(5).subgroups[0];
    let activeMode = "sidebyside"; // "coset" | "orbit" | "sidebyside"
    let activeH = { x: 0, y: 0, q: 0 };
    let lastVerdictSingle = null;
    let lastVerdictCoset = null;
    let lastVerdictOrbit = null;
    let overlays = {
      chiral: true,
      lCell: true,
      kCell: false,
      centers: true
    };
    let customSubActive = false;

    window._set442K = (k) => {
      activeK = k;
      customSubActive = false;
      activeH = { x: 0, y: 0, q: 0 };
      lastVerdictSingle = lastVerdictCoset = lastVerdictOrbit = null;
      const b = catalog.byK.get(k);
      if (b && b.subgroups.length > 0) {
        activeSub = b.subgroups[0];
      }
      render442All();
    };

    function renderIndexBar() {
      indexBar.innerHTML = "";
      for (let k = 1; k <= 10; k++) {
        const b = catalog.byK.get(k);
        const count = b.subgroups.length;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `sg-idx-btn${count === 0 ? " is-empty" : ""}`;
        btn.setAttribute("aria-pressed", activeK === k ? "true" : "false");
        btn.dataset.k = String(k);
        btn.innerHTML = `<b>${k}</b><small>(${count})</small>`;
        btn.addEventListener("click", () => {
          activeK = k;
          customSubActive = false;
          activeH = { x: 0, y: 0, q: 0 };
          lastVerdictSingle = lastVerdictCoset = lastVerdictOrbit = null;
          if (b.subgroups.length > 0) {
            activeSub = b.subgroups[0];
          }
          render442All();
        });
        indexBar.appendChild(btn);
      }
    }

    function renderCatalogBucket() {
      const b = catalog.byK.get(activeK);
      if (b.subgroups.length === 0) {
        catalogBody.setAttribute("hidden", "");
        emptyBox.removeAttribute("hidden");
        emptyBox.innerHTML = `
          <div>
            <strong>Why index k = ${activeK} has 0 colourings in 442 (p4):</strong>
            <p style="margin:6px 0 0;">Every subgroup S ≤ 442 has index <code>k = b · a</code>, where
            <code>b = [C₄ : P_S] ∈ {1, 2, 4}</code> and <code>a = [ℤ² : L]</code> is the index of a
            <code>P_S</code>-invariant sublattice L. Here <code>k = ${activeK}</code> is odd and not
            divisible by 2 or 4, forcing <code>b = 1</code> (<code>P_S = C₄</code>) and <code>a = ${activeK}</code>.
            However, C₄-invariant sublattices of ℤ² are ideals <code>(u + iv)ℤ[i]</code> of norm
            <code>a = u² + v²</code>. Since <code>${activeK} ≡ 3 (mod 4)</code>, Fermat's two-squares theorem
            forbids <code>u² + v² = ${activeK}</code> — so no C₄-invariant lattice of index ${activeK} exists.</p>
          </div>
          <div class="sg-sub" style="margin:0;">
            Try <strong>k = 2</strong> (norm 1²+1², index-2 checkerboard), <strong>k = 5</strong> (norm 2²+1², chiral Gaussian pair), or <strong>k = 9</strong> (3²+0², scaled 3×3 square lattice).
          </div>
        `;
        return;
      }

      emptyBox.setAttribute("hidden", "");
      catalogBody.removeAttribute("hidden");
      autWrap.innerHTML = "";

      const summary = document.createElement("p");
      summary.className = "sg-sub";
      summary.style.marginTop = "0";
      summary.innerHTML = `Index <strong>k = ${activeK}</strong>: <strong>${b.subgroups.length}</strong> subgroups · <strong>${b.conjClasses.length}</strong> 442-conjugacy class${
        b.conjClasses.length === 1 ? "" : "es"
      } · <strong>${b.properClasses.length}</strong> proper-affine class${
        b.properClasses.length === 1 ? "" : "es"
      } · <strong>${b.autClasses.length}</strong> Aut(442) colour group${
        b.autClasses.length === 1 ? "" : "s"
      }.`;
      autWrap.appendChild(summary);

      const cards = document.createElement("div");
      cards.className = "sg-aut-groups";

      b.autClasses.forEach((ac) => {
        const card = document.createElement("div");
        card.className = "sg-aut-card";
        const rep = ac.rep;
        const head = document.createElement("div");
        head.className = "sg-aut-head";
        head.innerHTML = `
          <div>
            <strong>Colour group #${ac.index}: Q ≅ ${rep.info.qLabel}</strong>
            <span class="sg-mono"> · P_S=${rep.psLabel}, a=${rep.a}</span>
          </div>
          <div class="sg-btn-row">
            ${
              ac.chiral
                ? `<span class="sg-badge warn">Chiral pair (${ac.properCount} proper classes)</span>`
                : `<span class="sg-badge">Achiral</span>`
            }
            <span class="sg-badge">${ac.members.length} sub${ac.members.length > 1 ? "s" : ""}</span>
          </div>
        `;
        card.appendChild(head);

        const conjRow = document.createElement("div");
        conjRow.className = "sg-conj-groups";
        ac.conjGroups.forEach((cg) => {
          const box = document.createElement("div");
          box.className = "sg-conj-box";
          const lbl = document.createElement("div");
          lbl.className = "sg-conj-label";
          lbl.textContent = `Conjugacy class (${cg.members.length} ${
            cg.members.length === 1 ? "normal placement" : "conjugates"
          })`;
          box.appendChild(lbl);

          cg.members.forEach((s) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "sg-sub-chip";
            chip.setAttribute(
              "aria-pressed",
              !customSubActive && activeSub.key === s.key ? "true" : "false"
            );
            chip.textContent = `u=(${s.u[0]},${s.u[1]}) · L=(${s.L.d1},${s.L.c},${s.L.d2})`;
            chip.title = `${s.psLabel} · ${s.latNote.hnf} · ${s.centerText}`;
            chip.addEventListener("click", () => {
              activeSub = s;
              customSubActive = false;
              activeH = { x: 0, y: 0, q: 0 };
              lastVerdictSingle = lastVerdictCoset = lastVerdictOrbit = null;
              syncBuilderFromSub(s);
              render442CatalogSelection();
              render442Stage();
              render442Facts();
            });
            box.appendChild(chip);
          });
          conjRow.appendChild(box);
        });

        card.appendChild(conjRow);
        cards.appendChild(card);
      });
      autWrap.appendChild(cards);
    }

    function render442CatalogSelection() {
      renderCatalogBucket();
    }

    function render442Stage(animTransform = "") {
      if (activeMode === "sidebyside") {
        stageSingle.setAttribute("hidden", "");
        stageDual.removeAttribute("hidden");
        drawPlanar442SVG(dualCosetSvg, activeSub, "coset", activeH, overlays, animTransform);
        drawPlanar442SVG(dualOrbitSvg, activeSub, "orbit", activeH, overlays, animTransform);
        updateVerdictBanner(
          dualCosetVerdict,
          lastVerdictCoset,
          "coset",
          activeSub,
          activeH
        );
        updateVerdictBanner(
          dualOrbitVerdict,
          lastVerdictOrbit,
          "orbit",
          activeSub,
          activeH
        );
      } else {
        stageDual.setAttribute("hidden", "");
        stageSingle.removeAttribute("hidden");
        drawPlanar442SVG(mainSvg, activeSub, activeMode, activeH, overlays, animTransform);
        updateVerdictBanner(
          mainVerdict,
          lastVerdictSingle,
          activeMode,
          activeSub,
          activeH
        );
      }

      modeNote.textContent =
        activeMode === "coset"
          ? `Mode: Left cosets gS — perfect under every motion in 442 (${activeSub.k} colours).`
          : activeMode === "orbit"
          ? `Mode: Orbits / Right cosets Sg — invariant only under N_442(S) (index ${activeSub.info.normaliserIndexInG}).`
          : `Side-by-side: Left cosets gS always stay a valid colouring under 442; S-orbits Sg break unless S is normal (${
              activeSub.info.isNormal ? "normal here!" : `${activeSub.info.conjugateCount} conjugates`
            }).`;
    }

    function updateVerdictBanner(el, verdict, mode, baseS, curH) {
      if (!verdict) {
        const curS = mode === "coset" ? baseS : conjugateSubgroup442(baseS, curH);
        el.dataset.kind = "fixes";
        el.textContent =
          mode === "coset"
            ? `gS initial state · h = ${formatElem442(curH)} · perfect ${baseS.k}-colouring`
            : `Sg orbits of u=(${curS.u[0]},${curS.u[1]}) · L=(${curS.L.d1},${curS.L.c},${curS.L.d2})`;
        return;
      }
      el.dataset.kind = verdict.kind;
      if (mode === "coset") {
        el.textContent = `${verdict.motionName}: ${formatPermMapping(verdict)} (perfect)`;
      } else if (verdict.kind === "breaks") {
        const ns = verdict.nextS;
        el.textContent = `${verdict.motionName} breaks Sg → now orbits of conjugate hSh⁻¹ with u=(${ns.u[0]},${ns.u[1]}), L=(${ns.L.d1},${ns.L.c},${ns.L.d2})`;
      } else {
        el.textContent = `${verdict.motionName} ${formatPermMapping(verdict)} (normalises S)`;
      }
    }

    function render442Facts() {
      const s = activeSub;
      const info = s.info;
      factsEl.innerHTML = `
        <dt>Subgroup S = (P_S, L, u)</dt><dd>P_S = ${s.psLabel} (b=${s.b}), L = ${
        s.latNote.hnf
      } (a=${s.a}), u = (${s.u[0]}, ${s.u[1]})</dd>
        <dt>Lattice geometry</dt><dd>${
          s.latNote.gauss || `Reduced basis ${s.latNote.basisText}`
        }</dd>
        <dt>Surviving centres of S</dt><dd>${s.centerText}</dd>
        <dt>Normal in 442?</dt><dd>${
          info.isNormal
            ? "Yes (normal · gS = Sg always)"
            : `No · ${info.conjugateCount} distinct conjugates (N(S) has index ${info.normaliserIndexInG})`
        }</dd>
        <dt>Core K_P = ⋂ gSg⁻¹</dt><dd>r_K=${
          info.K.rS === 1 ? "C₄" : info.K.rS === 2 ? "C₂" : "{e}"
        }, L_K=((${info.K.L.d1},${info.K.L.c}),(0,${info.K.L.d2})) (index ${info.qOrder})</dd>
        <dt>Colour group Q = 442/K_P</dt><dd>${info.qLabel} · |Q| = ${info.qOrder}${
        s.k === 5 || s.k === 10 ? " (chiral if P_S=C₄)" : ""
      }</dd>
      `;
    }

    // Wire mode & overlay controls
    document.querySelectorAll("[data-p4-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeMode = btn.dataset.p4Mode;
        document.querySelectorAll("[data-p4-mode]").forEach((b) => {
          b.setAttribute("aria-pressed", b.dataset.p4Mode === activeMode ? "true" : "false");
        });
        render442Stage();
      });
    });

    document.querySelectorAll("[data-p4-overlay]").forEach((chk) => {
      chk.addEventListener("change", () => {
        overlays[chk.dataset.p4Overlay] = chk.checked;
        render442Stage();
      });
    });

    const MOTIONS_442 = {
      r: { elem: { x: 0, y: 0, q: 1 }, name: "r (90° CCW)", invCss: "rotate(90deg)" },
      ri: { elem: { x: 0, y: 0, q: 3 }, name: "r' (90° CW)", invCss: "rotate(-90deg)" },
      r2: { elem: { x: 0, y: 0, q: 2 }, name: "r² (180°)", invCss: "rotate(180deg)" },
      tx: { elem: { x: 1, y: 0, q: 0 }, name: "tₓ (+1 →)", invCss: "translate(-1px, 0px)" },
      ty: { elem: { x: 0, y: 1, q: 0 }, name: "tᵧ (+1 ↑)", invCss: "translate(0px, 1px)" }
    };

    document.querySelectorAll("[data-p4-motion]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.p4Motion;
        if (key === "reset") {
          activeH = { x: 0, y: 0, q: 0 };
          lastVerdictSingle = lastVerdictCoset = lastVerdictOrbit = null;
          render442Stage();
          return;
        }
        const m = MOTIONS_442[key];
        if (!m) return;
        const vCoset = checkMotionVerdict442(activeSub, "coset", activeH, m.elem);
        const vOrbit = checkMotionVerdict442(activeSub, "orbit", activeH, m.elem);
        vCoset.motionName = m.name;
        vOrbit.motionName = m.name;
        activeH = vCoset.hAfter;
        lastVerdictCoset = vCoset;
        lastVerdictOrbit = vOrbit;
        lastVerdictSingle = activeMode === "orbit" ? vOrbit : vCoset;
        render442Stage(m.invCss);
      });
    });

    // Subgroup Builder controls
    function syncBuilderFromSub(s) {
      if (!bPs) return;
      bPs.value = String(s.rS);
      bD1.value = String(s.L.d1);
      bD2.value = String(s.L.d2);
      bC.value = String(s.L.c);
      bUx.value = String(s.u[0]);
      bUy.value = String(s.u[1]);
      evaluateBuilder();
    }

    function evaluateBuilder() {
      const rS = Number(bPs.value);
      const d1 = Math.max(1, Math.min(12, Math.trunc(Number(bD1.value) || 1)));
      const d2 = Math.max(1, Math.min(12, Math.trunc(Number(bD2.value) || 1)));
      const cRaw = Math.trunc(Number(bC.value) || 0);
      const c = mod(cRaw, d1);
      bC.max = String(Math.max(0, d1 - 1));
      bUx.max = String(Math.max(0, d1 - 1));
      bUy.max = String(Math.max(0, d2 - 1));
      const ux = mod(Math.trunc(Number(bUx.value) || 0), d1);
      const uy = mod(Math.trunc(Number(bUy.value) || 0), d2);
      const disableU = rS === 0;
      bUx.disabled = disableU;
      bUy.disabled = disableU;

      const check = validateBuilder442(rS, d1, c, d2, ux, uy);
      if (!check.ok) {
        bStatus.className = "sg-gaussian-box";
        bStatus.innerHTML = `<strong style="color:var(--accent2);">Invalid for 442:</strong> ${check.error}`;
        bLoadBtn.disabled = true;
        return null;
      }
      const s = check.sub;
      bStatus.className = "sg-gaussian-box";
      bStatus.innerHTML = `<strong style="color:var(--fwd-ink);">Valid 442 subgroup!</strong> Index <strong>k = ${
        s.k
      }</strong> (b=${s.b}, a=${s.a}) · ${s.latNote.gauss || s.latNote.hnf} · ${
        s.info.isNormal ? "Normal" : `${s.info.conjugateCount} conjugates`
      } · Q ≅ ${s.info.qLabel}.`;
      bLoadBtn.disabled = false;
      return s;
    }

    if (bPs) {
      [bPs, bD1, bC, bD2, bUx, bUy].forEach((inp) => {
        inp.addEventListener("input", evaluateBuilder);
        inp.addEventListener("change", evaluateBuilder);
      });
      bLoadBtn.addEventListener("click", () => {
        const s = evaluateBuilder();
        if (!s) return;
        activeSub = s;
        customSubActive = true;
        activeH = { x: 0, y: 0, q: 0 };
        lastVerdictSingle = lastVerdictCoset = lastVerdictOrbit = null;
        if (s.k >= 1 && s.k <= 10) {
          activeK = s.k;
          const match = catalog.byK.get(s.k).subgroups.find((m) => m.key === s.key);
          if (match) {
            activeSub = match;
            customSubActive = false;
          }
          renderIndexBar();
          render442CatalogSelection();
        }
        render442Stage();
        render442Facts();
      });
      syncBuilderFromSub(activeSub);
    }

    function render442All() {
      renderIndexBar();
      render442CatalogSelection();
      if (catalog.byK.get(activeK).subgroups.length > 0) {
        syncBuilderFromSub(activeSub);
        render442Stage();
        render442Facts();
      }
    }

    render442All();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initUI);
    } else {
      initUI();
    }
  }

  return {
    PALETTE,
    LABEL_INK,
    D3_NAMES,
    D3_MUL,
    D3_INV,
    D3_SLOT,
    mulD3,
    invD3,
    actD3,
    permOf,
    D3_SUBGROUPS,
    TABLE2_PRESETS,
    doubleCosetTableD3,
    analyseColouringD3,
    rotVec,
    mul442,
    inv442,
    conj442,
    modL,
    inL,
    hnfFromCols,
    isLatticeRotInvariant,
    inSubgroup442,
    leftCosetId442,
    rightCosetId442,
    kernelAndQuotient442,
    enumerate442,
    evaluatePatch442,
    checkMotionVerdict442,
    validateBuilder442
  };
});
