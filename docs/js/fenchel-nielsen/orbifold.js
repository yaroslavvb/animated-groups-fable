// Pure Conway 2-orbifold parser, invariant calculator, and Fenchel-Nielsen carving model.
// Zero DOM dependencies so it can be verified directly in Node and used in the browser.

export const CUT_COLORS = [
  "#0f5a8a", // cobalt
  "#b85d10", // amber
  "#1e6b48", // forest
  "#7c3a8a", // plum
  "#b5352b", // crimson
  "#0e7490", // teal
  "#9a3412", // rust
  "#4338ca"  // indigo
];

export const PRESETS = [
  {
    group: "Cone spheres",
    items: [
      { sig: "3322", note: "4-cone sphere (2D: 1 cut, length + twist)" },
      { sig: "2223", note: "4-cone sphere with order 3" },
      { sig: "2345", note: "4 distinct cones (2D)" },
      { sig: "22223", note: "5-cone sphere (4D: 2 cuts)" },
      { sig: "222222", note: "6-cone sphere (6D: snowflake or caterpillar)" }
    ]
  },
  {
    group: "Mirror polygons",
    items: [
      { sig: "*3333", note: "Reflective quadrilateral (1D: 1 orthogeodesic)" },
      { sig: "*2223", note: "Lambert-type quad (1D)" },
      { sig: "*2345", note: "Asymmetric reflective quad (1D)" },
      { sig: "*22222", note: "Right-angled pentagon (2D: 2 arcs)" },
      { sig: "*222222", note: "Right-angled hexagon (3D: 3 arcs)" }
    ]
  },
  {
    group: "Mixed cone + mirror",
    items: [
      { sig: "2*32", note: "Circle Limit I group (1D)" },
      { sig: "2*33", note: "CL-IV 2-fold group (1D)" },
      { sig: "3*22", note: "3-cone + 2-corner mirror (1D)" },
      { sig: "2*222", note: "1 cone + 3-corner mirror (2D)" },
      { sig: "23*", note: "Two cones + smooth mirror (1D)" },
      { sig: "23*2", note: "Two cones + 1-corner mirror (2D)" },
      { sig: "23*22", note: "Two cones + 2-corner mirror (3D)" }
    ]
  },
  {
    group: "Handles & crosscaps",
    items: [
      { sig: "o2", note: "One-holed torus with 2-cone (2D)" },
      { sig: "o22", note: "Torus with two 2-cones (4D)" },
      { sig: "oo", note: "Genus-2 surface (6D: separating or non-separating)" },
      { sig: "o*", note: "Handle + smooth mirror (3D)" },
      { sig: "23x", note: "Two cones + crosscap (1D)" },
      { sig: "222x", note: "Three cones + crosscap (3D)" },
      { sig: "xxx", note: "3-crosscap non-orientable surface (3D)" },
      { sig: "*22*22", note: "Annulus with two 2-corner mirrors (4D)" }
    ]
  },
  {
    group: "Rigid (0D reference)",
    items: [
      { sig: "237", note: "Hurwitz triangle group (0D, cost 85/42)" },
      { sig: "*642", note: "Coxeter circle-limit triangle (0D, cost 49/24)" },
      { sig: "4*3", note: "Circle Limit IV outlines (0D, cost 25/12)" }
    ]
  }
];

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

export function frac(num, den = 1) {
  if (den === 0) throw new Error("Zero denominator");
  if (den < 0) {
    num = -num;
    den = -den;
  }
  if (num === 0) return { num: 0, den: 1 };
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

export function addFrac(a, b) {
  return frac(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function subFrac(a, b) {
  return frac(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function formatFrac(f) {
  if (f.den === 1) return `${f.num}`;
  return `${f.num}/${f.den}`;
}

export function formatAreaPi(f) {
  if (f.num === 0) return "0";
  if (f.den === 1) return f.num === 1 ? "π" : `${f.num}π`;
  return f.num === 1 ? `π/${f.den}` : `${f.num}π/${f.den}`;
}

function indexToLetters(idx) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (idx < 26) return letters[idx];
  const q = Math.floor(idx / 26) - 1;
  const r = idx % 26;
  return letters[q] + letters[r];
}

function formatOrderToken(n) {
  return n >= 10 ? `(${n})` : `${n}`;
}

function suggestHyperbolic(rawSig, info) {
  const { handles, crosscaps, cones, mirrors } = info;
  if (handles === 0 && crosscaps === 0 && mirrors.length === 0) {
    if (cones.length <= 2) return "237";
    if (cones.length === 3) return "237";
    if (cones.length === 4 && cones.every((c) => c === 2)) return "2223";
  }
  if (handles === 0 && crosscaps === 0 && mirrors.length === 1 && cones.length === 0) {
    const r = mirrors[0];
    if (r.length <= 2) return "*3333";
    if (r.length === 3) return "*237";
    if (r.length === 4 && r.every((c) => c === 2)) return "*2223";
  }
  if (handles === 1 && crosscaps === 0 && mirrors.length === 0 && cones.length === 0) return "o2";
  if (handles === 0 && crosscaps === 2 && mirrors.length === 0 && cones.length === 0) return "xxx";
  if (handles === 0 && crosscaps === 1 && mirrors.length === 1 && cones.length === 0) return "23x";
  if (handles === 0 && crosscaps === 0 && mirrors.length === 2 && cones.length === 0) return "*22*22";
  if (handles === 0 && crosscaps === 0 && mirrors.length === 1 && cones.length === 1) {
    if (mirrors[0].length <= 1) return "2*32";
    return "2*32";
  }
  if (handles === 0 && crosscaps === 0 && mirrors.length === 1 && cones.length === 2) {
    return "23*";
  }
  const trimmed = rawSig.trim();
  if (trimmed === "22*") return "23*";
  return "3322";
}

/**
 * Parse a Conway 2-orbifold signature into canonical structure, exact Euler
 * characteristic, Teichmuller dimension, topological items, and assembly mode.
 */
export function parseOrbifold(input) {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return { ok: false, raw, error: "Enter a Conway orbifold signature (e.g. 3322, *3333, 2*32, o2, oo)." };
  }

  let handles = 0;
  let crosscaps = 0;
  const cones = [];
  const mirrors = [];
  let inMirror = false;

  const pushOrder = (val) => {
    if (!Number.isInteger(val) || val < 2 || val > 99) {
      throw new Error(`Order "${val}" must be an integer between 2 and 99.`);
    }
    if (inMirror) {
      mirrors[mirrors.length - 1].push(val);
    } else {
      cones.push(val);
    }
  };

  try {
    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === ",") {
        i++;
        continue;
      }
      if (ch === "o" || ch === "O" || ch === "◦" || ch === "○") {
        handles++;
        i++;
        continue;
      }
      if (ch === "x" || ch === "X" || ch === "×") {
        crosscaps++;
        i++;
        continue;
      }
      if (ch === "*") {
        inMirror = true;
        mirrors.push([]);
        i++;
        continue;
      }
      if (ch === "(") {
        const close = raw.indexOf(")", i + 1);
        if (close === -1) throw new Error('Unclosed "(" in orbifold signature.');
        const inner = raw.slice(i + 1, close).trim();
        if (!/^\d+$/.test(inner)) {
          throw new Error(`Expected positive integer inside "(${inner})".`);
        }
        pushOrder(parseInt(inner, 10));
        i = close + 1;
        continue;
      }
      if (ch >= "0" && ch <= "9") {
        if (ch === "0") {
          throw new Error('Digit "0" is invalid; use "o" for handles and integers >= 2 for cone/corner orders.');
        }
        if (ch === "1") {
          if (i + 1 < raw.length && raw[i + 1] >= "0" && raw[i + 1] <= "9") {
            let end = i + 2;
            while (end < raw.length && raw[end] >= "0" && raw[end] <= "9" && end - i < 2) end++;
            pushOrder(parseInt(raw.slice(i, end), 10));
            i = end;
            continue;
          }
          throw new Error('Order "1" is trivial; use 2–9 or parentheses like (12).');
        }
        // Single digit 2..9 (unless explicitly written inside parentheses)
        pushOrder(parseInt(ch, 10));
        i++;
        continue;
      }
      throw new Error(`Unexpected symbol "${ch}". Allowed: o, x (or ×), *, digits 2–9, and (N).`);
    }
  } catch (err) {
    return { ok: false, raw, error: err.message };
  }

  const m = cones.length;
  const b = mirrors.length;
  const n = mirrors.reduce((acc, loop) => acc + loop.length, 0);
  const g = handles;
  const k = crosscaps;

  if (g === 0 && k === 0 && m === 0 && b === 0) {
    return { ok: false, raw, error: "Signature has no orbifold features." };
  }

  let cost = frac(2 * g + k + b, 1);
  for (const p of cones) {
    cost = addFrac(cost, frac(p - 1, p));
  }
  for (const loop of mirrors) {
    for (const q of loop) {
      cost = addFrac(cost, frac(q - 1, 2 * q));
    }
  }
  const chi = subFrac(frac(2, 1), cost);

  const canonical =
    "o".repeat(g) +
    cones.map(formatOrderToken).join("") +
    mirrors.map((loop) => "*" + loop.map(formatOrderToken).join("")).join("") +
    "x".repeat(k);

  let geometry = "hyperbolic";
  if (chi.num > 0) geometry = "spherical";
  else if (chi.num === 0) geometry = "euclidean";

  const teichDim = 6 * g + 3 * k + 3 * b - 6 + 2 * m + n;
  const areaOverPi = frac(-2 * chi.num, chi.den);
  const areaNum = (-2 * Math.PI * chi.num) / chi.den;

  // Build labeled topological items
  let letterCursor = 0;
  const coneItems = cones.map((order, idx) => {
    const letter = indexToLetters(letterCursor++);
    return {
      id: `cone:${idx}`,
      kind: "cone",
      index: idx,
      order,
      letter,
      shortLabel: `${letter}:${order}`,
      label: `${letter} (cone ${order})`
    };
  });

  const mirrorLoops = mirrors.map((loop, j) => {
    const cornerItems = loop.map((order, r) => {
      const letter = indexToLetters(letterCursor++);
      return {
        id: `corner:${j}:${r}`,
        kind: "corner",
        loopIndex: j,
        cornerIndex: r,
        order,
        letter,
        shortLabel: `${letter}:*${order}`,
        label: `${letter} (corner *${order})`
      };
    });
    return {
      id: `mirror:${j}`,
      kind: "mirror-loop",
      loopIndex: j,
      corners: cornerItems,
      orders: [...loop],
      shortLabel: `*${loop.map(formatOrderToken).join("") || `${j + 1}`}`,
      label: `Mirror *${loop.map(formatOrderToken).join("") || `loop ${j + 1}`}`
    };
  });

  const handleItems = Array.from({ length: g }, (_, h) => ({
    id: `handle:${h}`,
    kind: "handle",
    index: h,
    shortLabel: `h${h + 1}`,
    label: `Handle h${h + 1}`,
    plusId: `handle:${h}:+`,
    minusId: `handle:${h}:-`
  }));

  const crosscapItems = Array.from({ length: k }, (_, c) => ({
    id: `crosscap:${c}`,
    kind: "crosscap",
    index: c,
    shortLabel: `x${c + 1}`,
    label: `Crosscap x${c + 1}`
  }));

  const nTop = 2 * g + k + m + b;
  let mode = "non-hyperbolic";
  if (geometry === "hyperbolic") {
    if (teichDim === 0) {
      mode = "rigid";
    } else if (g === 0 && k === 0 && m === 0 && b === 1 && n >= 4) {
      mode = "mirror-poly";
    } else if (g === 0 && k === 0 && m === 1 && b === 1 && n >= 2) {
      mode = "cone-mirror";
    } else if (nTop >= 3) {
      mode = "pants";
    } else if (nTop === 2 && b >= 1 && n >= 1) {
      mode = "collar-pair";
    } else {
      return {
        ok: false,
        raw,
        error: `Unsupported hyperbolic topology "${canonical}" (nTop=${nTop}, dim=${teichDim}).`
      };
    }
  }

  return {
    ok: true,
    raw,
    canonical,
    handles: g,
    crosscaps: k,
    cones,
    mirrors,
    g,
    k,
    m,
    b,
    n,
    nTop,
    cost,
    chi,
    areaOverPi,
    areaNum,
    teichDim,
    geometry,
    mode,
    coneItems,
    mirrorLoops,
    handleItems,
    crosscapItems,
    suggestion: geometry === "hyperbolic" ? null : suggestHyperbolic(canonical, { handles: g, crosscaps: k, cones, mirrors })
  };
}

function itemOrderInOrb(orb, id) {
  if (id.startsWith("cone:")) {
    const idx = parseInt(id.split(":")[1], 10);
    return orb.cones[idx];
  }
  if (id.startsWith("corner:")) {
    const [, j, r] = id.split(":").map(Number);
    return orb.mirrors[j][r];
  }
  return null;
}

function makeItemNode(id, orb, labelMap) {
  if (id.startsWith("cone:")) {
    const item = orb.coneItems[parseInt(id.split(":")[1], 10)];
    return { id, kind: "cone", order: item.order, label: item.shortLabel };
  }
  if (id.startsWith("corner:")) {
    const [, j, r] = id.split(":").map(Number);
    const item = orb.mirrorLoops[j].corners[r];
    return { id, kind: "corner", order: item.order, label: item.shortLabel };
  }
  if (id.startsWith("handle:")) {
    const [, hStr, side] = id.split(":");
    const h = parseInt(hStr, 10);
    return { id, kind: "handle-end", handleIndex: h, side, label: `h${h + 1}${side === "+" ? "⁺" : "⁻"}` };
  }
  if (id.startsWith("crosscap:")) {
    const c = parseInt(id.split(":")[1], 10);
    return { id, kind: "crosscap-end", crosscapIndex: c, label: `x${c + 1}` };
  }
  if (id.startsWith("smooth:")) {
    const j = parseInt(id.split(":")[1], 10);
    return { id, kind: "smooth-end", loopIndex: j, label: `*${j + 1}` };
  }
  if (id.startsWith("collar:")) {
    const j = parseInt(id.split(":")[1], 10);
    return { id, kind: "collar-end", loopIndex: j, label: orb.mirrorLoops[j].shortLabel };
  }
  return { id, kind: "cut", cutId: id, label: labelMap.get(id) || id };
}

function isPairMatchingRing(ring, a, b) {
  const len = ring.length;
  for (let i = 0; i < len; i++) {
    const u = ring[i];
    const v = ring[(i + 1) % len];
    if ((u === a && v === b) || (u === b && v === a)) {
      return i;
    }
  }
  return -1;
}

function adjacentPairsOfRing(ring) {
  const out = [];
  const len = ring.length;
  for (let i = 0; i < len; i++) {
    out.push([ring[i], ring[(i + 1) % len], i]);
  }
  return out;
}

function defaultCutValues(kind, idx) {
  if (kind === "crosscap") return { length: 1.05 + 0.08 * (idx % 3), twistTurns: 0 };
  if (kind === "mirror-arc" || kind === "cone-mirror-arc" || kind === "bridge-arc") {
    return { length: 1.15 + 0.14 * (idx % 4), twistTurns: 0 };
  }
  return { length: 1.75 + 0.18 * (idx % 4), twistTurns: 0 };
}

/**
 * Create the initial cuts array and build the carving pieces tree.
 */
export function createDefaultCarving(orb) {
  if (!orb.ok || orb.geometry !== "hyperbolic") {
    return { cuts: [], rootId: null, pieces: [], steps: [] };
  }

  const cuts = [];
  let cutCounter = 0;
  let arcCounter = 0;
  let gammaCounter = 0;

  const pushCut = (spec) => {
    const idx = cutCounter++;
    const defaults = defaultCutValues(spec.kind, idx);
    cuts.push({
      id: `cut:${idx}`,
      index: idx,
      color: CUT_COLORS[idx % CUT_COLORS.length],
      length: spec.length ?? defaults.length,
      twistTurns: spec.hasTwist ? (spec.twistTurns ?? defaults.twistTurns) : 0,
      ...spec
    });
  };

  if (orb.mode === "mirror-poly") {
    const ring = orb.mirrorLoops[0].corners.map((c) => c.id);
    const numCuts = ring.length - 3;
    const work = [...ring];
    for (let i = 0; i < numCuts; i++) {
      const a = work[0];
      const b = work[1];
      const id = `cut:${cutCounter}`;
      const sym = `α${++arcCounter}`;
      pushCut({
        kind: "mirror-arc",
        name: sym,
        hasTwist: false,
        loopIndex: 0,
        pair: [a, b],
        desc: "Orthogeodesic mirror arc"
      });
      work.splice(0, 2, id);
    }
  } else if (orb.mode === "cone-mirror") {
    const corners = orb.mirrorLoops[0].corners.map((c) => c.id);
    const cone = orb.coneItems[0];
    const a = corners[0];
    const b = corners[1];
    const arc0Id = `cut:${cutCounter}`;
    pushCut({
      kind: "cone-mirror-arc",
      name: `α${++arcCounter}`,
      hasTwist: false,
      loopIndex: 0,
      coneId: cone.id,
      pair: [a, b],
      desc: `Arc separating ${cone.shortLabel} onto mirror edge`
    });
    const work = [corners[0], arc0Id, ...corners.slice(1)];
    const rem = corners.length - 2;
    for (let i = 0; i < rem; i++) {
      // Pick first adjacent pair after arc0Id if convenient, else [0, 1]
      const u = work[0];
      const v = work[1];
      const cid = `cut:${cutCounter}`;
      pushCut({
        kind: "mirror-arc",
        name: `α${++arcCounter}`,
        hasTwist: false,
        loopIndex: 0,
        pair: [u, v],
        desc: "Orthogeodesic mirror arc"
      });
      work.splice(0, 2, cid);
    }
  } else if (orb.mode === "pants" || orb.mode === "collar-pair") {
    // 1. Handle cuts
    for (const h of orb.handleItems) {
      pushCut({
        kind: "handle",
        name: h.shortLabel,
        hasTwist: true,
        targetId: h.id,
        pair: null,
        desc: `Handle loop ${h.shortLabel}`
      });
    }
    // 2. Crosscap cuts (in collar-pair, there is at most 1 crosscap glued to mirror loop)
    for (const xc of orb.crosscapItems) {
      pushCut({
        kind: "crosscap",
        name: xc.shortLabel,
        hasTwist: false,
        targetId: xc.id,
        pair: null,
        desc: `Crosscap core ${xc.shortLabel} (cuff = 2d)`
      });
    }
    // 3. Mirror loops
    if (orb.mode === "pants") {
      for (const ml of orb.mirrorLoops) {
        if (ml.corners.length === 0) {
          pushCut({
            kind: "smooth-mirror",
            name: ml.shortLabel,
            hasTwist: false,
            loopIndex: ml.loopIndex,
            targetId: ml.id,
            pair: null,
            desc: `Smooth mirror boundary ${ml.shortLabel}`
          });
        } else {
          pushCut({
            kind: "collar",
            name: ml.shortLabel,
            hasTwist: true,
            loopIndex: ml.loopIndex,
            targetId: ml.id,
            pair: null,
            desc: `Collar cuff around ${ml.shortLabel}`
          });
          if (ml.corners.length >= 2) {
            const cIds = ml.corners.map((c) => c.id);
            const bId = `cut:${cutCounter}`;
            pushCut({
              kind: "bridge-arc",
              name: `b${ml.loopIndex + 1}`,
              hasTwist: false,
              loopIndex: ml.loopIndex,
              targetId: ml.id,
              pair: [cIds[0], cIds[1]],
              desc: `Cuff-to-mirror bridge on ${ml.shortLabel}`
            });
            const work = [cIds[0], bId, ...cIds.slice(1)];
            for (let s = 0; s < cIds.length - 2; s++) {
              const cid = `cut:${cutCounter}`;
              pushCut({
                kind: "mirror-arc",
                name: `α${++arcCounter}`,
                hasTwist: false,
                loopIndex: ml.loopIndex,
                pair: [work[0], work[1]],
                desc: `Mirror arc inside ${ml.shortLabel}`
              });
              work.splice(0, 2, cid);
            }
          }
        }
      }
    } else {
      // mode === 'collar-pair': nTop === 2 with at least one cornered mirror loop
      const ml0 = orb.mirrorLoops[0];
      const hasSecondMirror = orb.mirrorLoops.length === 2;
      if (hasSecondMirror) {
        const ml1 = orb.mirrorLoops[1];
        if (ml0.corners.length === 0) {
          pushCut({
            kind: "smooth-mirror",
            name: ml0.shortLabel,
            hasTwist: false,
            loopIndex: 0,
            targetId: ml0.id,
            pair: null,
            desc: `Smooth mirror boundary ${ml0.shortLabel}`
          });
        } else if (ml1.corners.length === 0) {
          pushCut({
            kind: "smooth-mirror",
            name: ml1.shortLabel,
            hasTwist: false,
            loopIndex: 1,
            targetId: ml1.id,
            pair: null,
            desc: `Smooth mirror boundary ${ml1.shortLabel}`
          });
        } else {
          // Both have corners: shared collar cut with length + twist
          pushCut({
            kind: "collar",
            name: "γ₁",
            hasTwist: true,
            loopIndex: 0,
            targetId: "shared-collar",
            pair: null,
            desc: `Shared cuff between ${ml0.shortLabel} and ${ml1.shortLabel}`
          });
        }
      }
      // Internal bridge + mirror arcs for every cornered mirror loop with >= 2 corners
      for (const ml of orb.mirrorLoops) {
        if (ml.corners.length >= 2) {
          const cIds = ml.corners.map((c) => c.id);
          const bId = `cut:${cutCounter}`;
          pushCut({
            kind: "bridge-arc",
            name: `b${ml.loopIndex + 1}`,
            hasTwist: false,
            loopIndex: ml.loopIndex,
            targetId: ml.id,
            pair: [cIds[0], cIds[1]],
            desc: `Cuff-to-mirror bridge on ${ml.shortLabel}`
          });
          const work = [cIds[0], bId, ...cIds.slice(1)];
          for (let s = 0; s < cIds.length - 2; s++) {
            const cid = `cut:${cutCounter}`;
            pushCut({
              kind: "mirror-arc",
              name: `α${++arcCounter}`,
              hasTwist: false,
              loopIndex: ml.loopIndex,
              pair: [work[0], work[1]],
              desc: `Mirror arc inside ${ml.shortLabel}`
            });
            work.splice(0, 2, cid);
          }
        }
      }
    }

    // 4. Pair cuts on the sphere pool (for pants mode when nTop > 3)
    if (orb.mode === "pants" && orb.nTop > 3) {
      const pool = [];
      for (const h of orb.handleItems) {
        pool.push(h.plusId, h.minusId);
      }
      for (const c of orb.coneItems) pool.push(c.id);
      for (const ml of orb.mirrorLoops) {
        pool.push(ml.corners.length === 0 ? `smooth:${ml.loopIndex}` : `collar:${ml.loopIndex}`);
      }
      for (const xc of orb.crosscapItems) pool.push(`crosscap:${xc.index}`);

      const numPairCuts = orb.nTop - 3;
      const workPool = [...pool];
      for (let i = 0; i < numPairCuts; i++) {
        // Prefer pairing disjoint leaves when >= 4 items (gives Snowflake for 222222 and Separating for oo)
        const a = workPool[0];
        const b = workPool[1];
        const cid = `cut:${cutCounter}`;
        pushCut({
          kind: "pair",
          name: `γ${++gammaCounter}`,
          hasTwist: true,
          pair: [a, b],
          desc: "Closed Fenchel–Nielsen geodesic"
        });
        workPool.splice(0, 2);
        // Push composite at the end so next cuts pick fresh leaves first (Snowflake / Separating default!)
        workPool.push(cid);
      }
    }
  }

  const carving = { cuts };
  return rebuildCarving(orb, carving);
}

function getPoolDisplayItem(id, orb, cutById) {
  const cut = cutById.get(id);
  if (cut) {
    return { id, label: cut.name, shortLabel: cut.name, color: cut.color, isCut: true };
  }
  const node = makeItemNode(id, orb, new Map());
  return { id, label: node.label, shortLabel: node.label, color: null, isCut: false };
}

/**
 * Rebuild pieces tree, repair invalid downstream pairs cleanly, and collect per-step UI options.
 */
export function rebuildCarving(orb, inputCarving) {
  if (!orb.ok || orb.geometry !== "hyperbolic") {
    return { cuts: [], pieces: [], rootId: null, steps: [] };
  }

  const cuts = inputCarving.cuts.map((c) => ({ ...c, pair: c.pair ? [...c.pair] : null }));
  const cutById = new Map(cuts.map((c) => [c.id, c]));
  const labelMap = new Map(cuts.map((c) => [c.id, c.name]));

  const pieces = [];
  const steps = new Array(cuts.length);

  const isDegenerateTwoCone = (fList) => {
    const orders = fList.filter((f) => f.kind === "cone").map((f) => f.order);
    const cutsOnly = fList.filter((f) => f.kind === "cut" || f.kind === "collar-end" || f.kind === "handle-end" || f.kind === "crosscap-end" || f.kind === "smooth-end");
    return orders.length === 2 && orders[0] === 2 && orders[1] === 2 && cutsOnly.length === 1;
  };

  const isDegenerateTwoCorner = (fList) => {
    const orders = fList.filter((f) => f.kind === "corner").map((f) => f.order);
    const cutsOnly = fList.filter((f) => f.kind === "cut");
    return orders.length === 2 && orders[0] === 2 && orders[1] === 2 && cutsOnly.length === 1;
  };

  const addPiece = (piece) => {
    pieces.push(piece);
    return piece;
  };

  if (orb.mode === "rigid") {
    if (orb.m === 3) {
      addPiece({
        id: "piece:0",
        kind: "rigid-cones",
        features: orb.coneItems.map((c) => makeItemNode(c.id, orb, labelMap)),
        areaOverPi: orb.areaOverPi,
        areaNum: orb.areaNum,
        degenerate: false
      });
    } else if (orb.b === 1 && orb.n === 3) {
      addPiece({
        id: "piece:0",
        kind: "rigid-mirror-tri",
        features: orb.mirrorLoops[0].corners.map((c) => makeItemNode(c.id, orb, labelMap)),
        areaOverPi: orb.areaOverPi,
        areaNum: orb.areaNum,
        degenerate: false
      });
    } else {
      addPiece({
        id: "piece:0",
        kind: "rigid-cone-mirror",
        cone: orb.coneItems[0],
        corner: orb.mirrorLoops[0].corners[0],
        areaOverPi: orb.areaOverPi,
        areaNum: orb.areaNum,
        degenerate: false
      });
    }
    return { cuts, pieces, rootId: "piece:0", steps };
  }

  if (orb.mode === "mirror-poly") {
    let ring = orb.mirrorLoops[0].corners.map((c) => c.id);
    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      const adj = adjacentPairsOfRing(ring);
      let idx = cut.pair ? isPairMatchingRing(ring, cut.pair[0], cut.pair[1]) : -1;
      if (idx === -1) {
        idx = 0;
        cut.pair = [adj[0][0], adj[0][1]];
      } else {
        cut.pair = [ring[idx], ring[(idx + 1) % ring.length]];
      }
      steps[i] = {
        cutId: cut.id,
        pairMode: "adjacent",
        selectableIds: [...ring],
        validPairs: adj.map(([u, v]) => [u, v]),
        currentPair: [...cut.pair],
        itemsDisplay: ring.map((id) => getPoolDisplayItem(id, orb, cutById))
      };

      const [u, v] = cut.pair;
      const feats = [
        makeItemNode(u, orb, labelMap),
        makeItemNode(v, orb, labelMap),
        { id: cut.id, kind: "cut", cutId: cut.id, label: cut.name, color: cut.color }
      ];
      addPiece({
        id: `piece:cut:${cut.id}`,
        kind: "mirror-poly",
        features: feats,
        boundaryCutId: cut.id,
        degenerate: isDegenerateTwoCorner(feats)
      });

      // Replace adjacent pair (ring[idx], ring[(idx+1)%len]) with cut.id
      if (idx + 1 < ring.length) {
        ring.splice(idx, 2, cut.id);
      } else {
        // wrap-around pair (last, first)
        ring = [cut.id, ...ring.slice(1, ring.length - 1)];
      }
    }
    const finalFeats = ring.map((id) => makeItemNode(id, orb, labelMap));
    addPiece({
      id: "piece:final",
      kind: "mirror-poly",
      features: finalFeats,
      boundaryCutId: null,
      degenerate: isDegenerateTwoCorner(finalFeats)
    });
  } else if (orb.mode === "cone-mirror") {
    const corners = orb.mirrorLoops[0].corners.map((c) => c.id);
    const cut0 = cuts[0];
    const slots = adjacentPairsOfRing(corners);
    let slotIdx = cut0.pair ? isPairMatchingRing(corners, cut0.pair[0], cut0.pair[1]) : -1;
    if (slotIdx === -1) {
      slotIdx = 0;
      cut0.pair = [slots[0][0], slots[0][1]];
    } else {
      cut0.pair = [corners[slotIdx], corners[(slotIdx + 1) % corners.length]];
    }
    steps[0] = {
      cutId: cut0.id,
      pairMode: "edge-slot",
      selectableIds: [...corners],
      validPairs: slots.map(([u, v]) => [u, v]),
      currentPair: [...cut0.pair],
      itemsDisplay: corners.map((id) => getPoolDisplayItem(id, orb, cutById))
    };

    const coneNode = makeItemNode(orb.coneItems[0].id, orb, labelMap);
    addPiece({
      id: `piece:cone-mirror:${cut0.id}`,
      kind: "cone-mirror-cap",
      cone: coneNode,
      cutId: cut0.id,
      degenerate: coneNode.order === 2
    });

    // Insert cut0.id strictly between corners[slotIdx] and corners[(slotIdx+1)%len]
    let ring = [...corners];
    ring.splice(slotIdx + 1, 0, cut0.id);

    for (let i = 1; i < cuts.length; i++) {
      const cut = cuts[i];
      const adj = adjacentPairsOfRing(ring);
      let idx = cut.pair ? isPairMatchingRing(ring, cut.pair[0], cut.pair[1]) : -1;
      if (idx === -1) {
        idx = 0;
        cut.pair = [adj[0][0], adj[0][1]];
      } else {
        cut.pair = [ring[idx], ring[(idx + 1) % ring.length]];
      }
      steps[i] = {
        cutId: cut.id,
        pairMode: "adjacent",
        selectableIds: [...ring],
        validPairs: adj.map(([u, v]) => [u, v]),
        currentPair: [...cut.pair],
        itemsDisplay: ring.map((id) => getPoolDisplayItem(id, orb, cutById))
      };

      const [u, v] = cut.pair;
      const feats = [
        makeItemNode(u, orb, labelMap),
        makeItemNode(v, orb, labelMap),
        { id: cut.id, kind: "cut", cutId: cut.id, label: cut.name, color: cut.color }
      ];
      addPiece({
        id: `piece:cut:${cut.id}`,
        kind: "mirror-poly",
        features: feats,
        boundaryCutId: cut.id,
        degenerate: isDegenerateTwoCorner(feats)
      });
      if (idx + 1 < ring.length) {
        ring.splice(idx, 2, cut.id);
      } else {
        ring = [cut.id, ...ring.slice(1, ring.length - 1)];
      }
    }
    const finalFeats = ring.map((id) => makeItemNode(id, orb, labelMap));
    addPiece({
      id: "piece:final",
      kind: "mirror-poly",
      features: finalFeats,
      boundaryCutId: null,
      degenerate: isDegenerateTwoCorner(finalFeats)
    });
  } else {
    // 'pants' or 'collar-pair'
    const mirrorRings = new Map();
    const cutStepMeta = (cut) => ({
      cutId: cut.id,
      pairMode: "none",
      selectableIds: [],
      validPairs: [],
      currentPair: null,
      itemsDisplay: []
    });

    // Helper for processing mirror subtrees
    const bridgeCutsByLoop = new Map();
    const mirrorArcsByLoop = new Map();
    const collarCutByLoop = new Map();
    let sharedCollarCut = null;
    const smoothCutByLoop = new Map();
    const handleCutByIdx = new Map();
    const crosscapCutByIdx = new Map();
    const pairCuts = [];

    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      if (cut.kind === "handle") {
        handleCutByIdx.set(parseInt(cut.targetId.split(":")[1], 10), cut);
        steps[i] = cutStepMeta(cut);
      } else if (cut.kind === "crosscap") {
        crosscapCutByIdx.set(parseInt(cut.targetId.split(":")[1], 10), cut);
        steps[i] = cutStepMeta(cut);
      } else if (cut.kind === "smooth-mirror") {
        smoothCutByLoop.set(cut.loopIndex, cut);
        steps[i] = cutStepMeta(cut);
      } else if (cut.kind === "collar") {
        if (cut.targetId === "shared-collar") sharedCollarCut = cut;
        else collarCutByLoop.set(cut.loopIndex, cut);
        steps[i] = cutStepMeta(cut);
      } else if (cut.kind === "bridge-arc") {
        bridgeCutsByLoop.set(cut.loopIndex, { cut, stepIndex: i });
      } else if (cut.kind === "mirror-arc") {
        if (!mirrorArcsByLoop.has(cut.loopIndex)) mirrorArcsByLoop.set(cut.loopIndex, []);
        mirrorArcsByLoop.get(cut.loopIndex).push({ cut, stepIndex: i });
      } else if (cut.kind === "pair") {
        pairCuts.push({ cut, stepIndex: i });
      }
    }

    // Build mirror boundary caps/bridges/polygons for each cornered mirror loop
    for (const ml of orb.mirrorLoops) {
      if (ml.corners.length === 0) continue;
      const cuffSourceCut =
        orb.mode === "collar-pair"
          ? sharedCollarCut ??
            (orb.crosscapItems.length === 1 ? crosscapCutByIdx.get(0) : smoothCutByLoop.get(1 - ml.loopIndex))
          : collarCutByLoop.get(ml.loopIndex);

      if (ml.corners.length === 1) {
        addPiece({
          id: `piece:cap:${ml.loopIndex}`,
          kind: "corner-cap",
          loopIndex: ml.loopIndex,
          cuffCutId: cuffSourceCut.id,
          corner: ml.corners[0],
          mirrorEndId: orb.mode === "collar-pair" ? `collar:${ml.loopIndex}` : `collar:${ml.loopIndex}`,
          degenerate: false
        });
      } else {
        const corners = ml.corners.map((c) => c.id);
        const { cut: bCut, stepIndex: bStepIdx } = bridgeCutsByLoop.get(ml.loopIndex);
        const slots = adjacentPairsOfRing(corners);
        let slotIdx = bCut.pair ? isPairMatchingRing(corners, bCut.pair[0], bCut.pair[1]) : -1;
        if (slotIdx === -1) {
          slotIdx = 0;
          bCut.pair = [slots[0][0], slots[0][1]];
        } else {
          bCut.pair = [corners[slotIdx], corners[(slotIdx + 1) % corners.length]];
        }
        steps[bStepIdx] = {
          cutId: bCut.id,
          pairMode: "edge-slot",
          selectableIds: [...corners],
          validPairs: slots.map(([u, v]) => [u, v]),
          currentPair: [...bCut.pair],
          itemsDisplay: corners.map((id) => getPoolDisplayItem(id, orb, cutById))
        };

        addPiece({
          id: `piece:bridge:${ml.loopIndex}`,
          kind: "cuff-mirror-bridge",
          loopIndex: ml.loopIndex,
          cuffCutId: cuffSourceCut.id,
          bridgeCutId: bCut.id,
          mirrorEndId: `collar:${ml.loopIndex}`,
          degenerate: false
        });

        let ring = [...corners];
        ring.splice(slotIdx + 1, 0, bCut.id);
        const arcList = mirrorArcsByLoop.get(ml.loopIndex) || [];
        for (const { cut: mCut, stepIndex: mStepIdx } of arcList) {
          const adj = adjacentPairsOfRing(ring);
          let idx = mCut.pair ? isPairMatchingRing(ring, mCut.pair[0], mCut.pair[1]) : -1;
          if (idx === -1) {
            idx = 0;
            mCut.pair = [adj[0][0], adj[0][1]];
          } else {
            mCut.pair = [ring[idx], ring[(idx + 1) % ring.length]];
          }
          steps[mStepIdx] = {
            cutId: mCut.id,
            pairMode: "adjacent",
            selectableIds: [...ring],
            validPairs: adj.map(([u, v]) => [u, v]),
            currentPair: [...mCut.pair],
            itemsDisplay: ring.map((id) => getPoolDisplayItem(id, orb, cutById))
          };
          const [u, v] = mCut.pair;
          const feats = [
            makeItemNode(u, orb, labelMap),
            makeItemNode(v, orb, labelMap),
            { id: mCut.id, kind: "cut", cutId: mCut.id, label: mCut.name, color: mCut.color }
          ];
          addPiece({
            id: `piece:cut:${mCut.id}`,
            kind: "mirror-poly",
            loopIndex: ml.loopIndex,
            features: feats,
            boundaryCutId: mCut.id,
            degenerate: isDegenerateTwoCorner(feats)
          });
          if (idx + 1 < ring.length) {
            ring.splice(idx, 2, mCut.id);
          } else {
            ring = [mCut.id, ...ring.slice(1, ring.length - 1)];
          }
        }
        const finalMFeats = ring.map((id) => makeItemNode(id, orb, labelMap));
        addPiece({
          id: `piece:mirror-final:${ml.loopIndex}`,
          kind: "mirror-poly",
          loopIndex: ml.loopIndex,
          features: finalMFeats,
          boundaryCutId: null,
          degenerate: isDegenerateTwoCorner(finalMFeats)
        });
        mirrorRings.set(ml.loopIndex, ring);
      }
    }

    // Build interior pants pieces
    if (orb.mode === "pants") {
      const pool = [];
      for (const h of orb.handleItems) pool.push(h.plusId, h.minusId);
      for (const c of orb.coneItems) pool.push(c.id);
      for (const ml of orb.mirrorLoops) {
        pool.push(ml.corners.length === 0 ? `smooth:${ml.loopIndex}` : `collar:${ml.loopIndex}`);
      }
      for (const xc of orb.crosscapItems) pool.push(`crosscap:${xc.index}`);

      const work = [...pool];
      for (const { cut, stepIndex } of pairCuts) {
        let [a, b] = cut.pair || [];
        const hasA = work.includes(a);
        const hasB = work.includes(b);
        if (!hasA || !hasB || a === b) {
          if (hasA) {
            b = work.find((x) => x !== a);
          } else if (hasB) {
            a = work.find((x) => x !== b);
          } else {
            a = work[0];
            b = work[1];
          }
          cut.pair = [a, b];
        }
        const validPairs = [];
        for (let p = 0; p < work.length; p++) {
          for (let q = p + 1; q < work.length; q++) {
            validPairs.push([work[p], work[q]]);
          }
        }
        steps[stepIndex] = {
          cutId: cut.id,
          pairMode: "any",
          selectableIds: [...work],
          validPairs,
          currentPair: [a, b],
          itemsDisplay: work.map((id) => getPoolDisplayItem(id, orb, cutById))
        };

        const feats = [
          makeItemNode(a, orb, labelMap),
          makeItemNode(b, orb, labelMap),
          { id: cut.id, kind: "cut", cutId: cut.id, label: cut.name, color: cut.color }
        ];
        addPiece({
          id: `piece:pant:${cut.id}`,
          kind: "pant",
          features: feats,
          boundaryCutId: cut.id,
          degenerate: isDegenerateTwoCone(feats)
        });

        const idxA = work.indexOf(a);
        work.splice(idxA, 1);
        const idxB = work.indexOf(b);
        work.splice(idxB, 1);
        work.push(cut.id);
      }

      const finalPantFeats = work.map((id) => makeItemNode(id, orb, labelMap));
      addPiece({
        id: "piece:pant-final",
        kind: "pant",
        features: finalPantFeats,
        boundaryCutId: null,
        degenerate: isDegenerateTwoCone(finalPantFeats)
      });
    }
  }

  // Compute exact area of each piece via Gauss-Bonnet on the piece's orbifold Euler char
  for (const p of pieces) {
    p.areaOverPi = pieceAreaOverPi(p, orb);
    p.areaNum = (Math.PI * p.areaOverPi.num) / p.areaOverPi.den;
    p.degenerate = p.areaOverPi.num === 0;
  }

  const root = pieces.find((p) => !p.degenerate) || pieces[0];
  return {
    cuts,
    pieces,
    rootId: root ? root.id : null,
    steps
  };
}

function featureEulerCost(feat, orb) {
  if (feat.kind === "cone") return frac(feat.order - 1, feat.order);
  if (feat.kind === "corner") return frac(feat.order - 1, 2 * feat.order);
  // Cuff (cut, collar-end, handle-end, crosscap-end, smooth-end)
  return frac(1, 1);
}

function pieceAreaOverPi(piece, orb) {
  if (piece.kind === "rigid-cones" || piece.kind === "rigid-mirror-tri" || piece.kind === "rigid-cone-mirror") {
    return orb.areaOverPi;
  }
  if (piece.kind === "pant") {
    let cost = frac(0, 1);
    for (const f of piece.features) cost = addFrac(cost, featureEulerCost(f, orb));
    // sphere minus features: chi = 2 - cost; area = -2*pi*chi = 2*(cost - 2)*pi
    return frac(2 * (cost.num - 2 * cost.den), cost.den);
  }
  if (piece.kind === "mirror-poly") {
    // Disk mirror boundary contributes 1 to cost; each corner contributes (q-1)/(2q);
    // each orthogeodesic cut contributes 1/2 to mirror-polygon cost!
    let cost = frac(1, 1);
    for (const f of piece.features) {
      if (f.kind === "corner") cost = addFrac(cost, frac(f.order - 1, 2 * f.order));
      else cost = addFrac(cost, frac(1, 2)); // orthogeodesic cut
    }
    return frac(2 * (cost.num - 2 * cost.den), cost.den);
  }
  if (piece.kind === "cone-mirror-cap") {
    // 1 interior cone p, 1 mirror loop + 1 orthogeodesic cut (cost 1 + 1/2 + (p-1)/p)
    const p = piece.cone.order;
    const cost = addFrac(frac(3, 2), frac(p - 1, p));
    return frac(2 * (cost.num - 2 * cost.den), cost.den);
  }
  if (piece.kind === "corner-cap") {
    // 1 cuff (cost 1) + 1 mirror loop (cost 1) + 1 corner *q ((q-1)/(2q))
    const q = piece.corner.order;
    const cost = addFrac(frac(2, 1), frac(q - 1, 2 * q));
    return frac(2 * (cost.num - 2 * cost.den), cost.den);
  }
  if (piece.kind === "cuff-mirror-bridge") {
    // 1 cuff (cost 1) + 1 mirror loop (cost 1) + 1 orthogeodesic cut (cost 1/2) => cost 5/2 => area = pi
    return frac(1, 1);
  }
  return frac(0, 1);
}

/**
 * Return selectable items and valid pairs for cut `cutIndex`.
 */
export function getCutOptions(orb, carving, cutIndex) {
  const step = carving.steps[cutIndex];
  if (!step) {
    return { selectableItems: [], selectableIds: [], validPairs: [], currentPair: null, pairMode: "none" };
  }
  return {
    selectableItems: step.itemsDisplay || [],
    selectableIds: step.selectableIds || [],
    validPairs: step.validPairs || [],
    currentPair: step.currentPair || null,
    pairMode: step.pairMode || "none"
  };
}

/**
 * Update cut `cutIndex`'s pair to `[itemA, itemB]`, preserving existing slider values
 * and gracefully repairing any invalid downstream pairs.
 */
export function setCutPair(orb, carving, cutIndex, itemA, itemB) {
  const opts = getCutOptions(orb, carving, cutIndex);
  if (opts.pairMode === "none") return carving;
  const ok = opts.validPairs.some(
    ([u, v]) => (u === itemA && v === itemB) || (u === itemB && v === itemA)
  );
  if (!ok) return carving;

  const nextCuts = carving.cuts.map((c, idx) =>
    idx === cutIndex ? { ...c, pair: [itemA, itemB] } : { ...c, pair: c.pair ? [...c.pair] : null }
  );
  return rebuildCarving(orb, { cuts: nextCuts });
}

function canonicalTopologySignature(carving) {
  const cutById = new Map(carving.cuts.map((c) => [c.id, c]));
  const nodeSig = (f) => {
    if (f.kind === "cone") return `c${f.order}`;
    if (f.kind === "corner") return `r${f.order}`;
    if (f.kind === "handle-end") return "H";
    if (f.kind === "crosscap-end") return "X";
    if (f.kind === "smooth-end") return "S";
    if (f.kind === "collar-end") return "M";
    if (f.kind === "cut") return `(${cutSig(f.cutId)})`;
    return "?";
  };
  const cutSig = (cutId) => {
    const piece = carving.pieces.find((p) => p.boundaryCutId === cutId);
    if (!piece) {
      const c = cutById.get(cutId);
      return c ? c.kind : cutId;
    }
    const kids = piece.features.filter((f) => f.cutId !== cutId).map(nodeSig).sort();
    return kids.join("+");
  };
  return carving.pieces
    .map((p) => {
      if (p.kind === "pant" || p.kind === "mirror-poly") {
        return p.kind + "[" + p.features.map(nodeSig).sort().join(",") + "]";
      }
      return p.kind;
    })
    .sort()
    .join("|");
}

function serializePairs(carving) {
  return carving.cuts
    .map((c) => (c.pair ? `${c.id}:${[...c.pair].sort().join(",")}` : c.id))
    .join(";");
}

/**
 * Cycle to the next distinct carving topology (preferring genuinely different tree shapes first).
 */
export function cycleCarvingTopology(orb, carving) {
  const mutableIndices = [];
  for (let i = 0; i < carving.cuts.length; i++) {
    const opts = getCutOptions(orb, carving, i);
    if (opts.validPairs.length > 1) mutableIndices.push(i);
  }
  if (mutableIndices.length === 0) return carving;

  // Enumerate up to 80 distinct carvings via DFS over mutable cut choices
  const candidates = [];
  const seenKey = new Set();

  const dfs = (depth, curCarving) => {
    if (candidates.length >= 80) return;
    if (depth === mutableIndices.length) {
      const key = serializePairs(curCarving);
      if (!seenKey.has(key)) {
        seenKey.add(key);
        candidates.push({
          key,
          topoSig: canonicalTopologySignature(curCarving),
          cuts: curCarving.cuts.map((c) => ({ ...c, pair: c.pair ? [...c.pair] : null }))
        });
      }
      return;
    }
    const cutIdx = mutableIndices[depth];
    const opts = getCutOptions(orb, curCarving, cutIdx);
    for (const [u, v] of opts.validPairs) {
      const next = setCutPair(orb, curCarving, cutIdx, u, v);
      dfs(depth + 1, next);
      if (candidates.length >= 80) break;
    }
  };

  dfs(0, rebuildCarving(orb, carving));
  if (candidates.length <= 1) return carving;

  const curKey = serializePairs(carving);
  const curTopo = canonicalTopologySignature(carving);

  // Order candidates so distinct topological shapes are encountered before redundant permutations
  const byTopo = new Map();
  for (const cand of candidates) {
    if (!byTopo.has(cand.topoSig)) byTopo.set(cand.topoSig, cand);
  }
  const uniqueTopos = [...byTopo.values()];
  if (uniqueTopos.length > 1) {
    const tIdx = uniqueTopos.findIndex((c) => c.topoSig === curTopo);
    const nextTopo = uniqueTopos[(tIdx + 1) % uniqueTopos.length];
    if (nextTopo.key !== curKey) {
      return rebuildCarving(orb, {
        cuts: carving.cuts.map((orig, idx) => ({
          ...orig,
          pair: nextTopo.cuts[idx].pair ? [...nextTopo.cuts[idx].pair] : null
        }))
      });
    }
  }

  const curIdx = candidates.findIndex((c) => c.key === curKey);
  const next = candidates[(curIdx + 1) % candidates.length];
  return rebuildCarving(orb, {
    cuts: carving.cuts.map((orig, idx) => ({
      ...orig,
      pair: next.cuts[idx].pair ? [...next.cuts[idx].pair] : null
    }))
  });
}

export function totalSliderCount(carving) {
  let count = 0;
  for (const c of carving.cuts) {
    count += 1; // length slider
    if (c.hasTwist) count += 1;
  }
  return count;
}

function buildLeafResolver(pieces) {
  const childMap = new Map();
  for (const p of pieces) {
    if (!p.boundaryCutId || !p.features) continue;
    childMap.set(
      p.boundaryCutId,
      p.features.filter((f) => !(f.kind === "cut" && f.cutId === p.boundaryCutId)).map((f) => f.id)
    );
  }
  const memo = new Map();
  const leavesOf = (id) => {
    if (memo.has(id)) return memo.get(id);
    const children = childMap.get(id);
    const out = children ? children.flatMap((cid) => leavesOf(cid)) : [id];
    memo.set(id, out);
    return out;
  };
  return leavesOf;
}

function splitUniverse(leafIds, universe) {
  const set = new Set(leafIds);
  const sideA = [];
  const sideB = [];
  for (const id of universe) {
    if (set.has(id)) sideA.push(id);
    else sideB.push(id);
  }
  return [sideA, sideB];
}

function bipartitionKey(sideA, sideB) {
  const a = [...sideA].sort().join(",");
  const b = [...sideB].sort().join(",");
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function featureTypeToken(orb, cutLeafIds, id) {
  if (id.startsWith("cone:")) {
    const idx = parseInt(id.split(":")[1], 10);
    return `c${orb.cones[idx]}`;
  }
  if (id.startsWith("corner:")) {
    const [, j, r] = id.split(":").map(Number);
    return `r${orb.mirrors[j][r]}`;
  }
  if (id.startsWith("smooth:")) return "S";
  if (id.startsWith("collar:")) {
    const j = parseInt(id.split(":")[1], 10);
    return `M(${orb.mirrors[j].join(",")})`;
  }
  if (id.startsWith("crosscap:")) return "X";
  if (cutLeafIds.has(id)) return "ARC";
  return id;
}

function sideShapeToken(orb, cutLeafIds, sideIds) {
  const handleCounts = new Map();
  const tokens = [];
  for (const id of sideIds) {
    if (id.startsWith("handle:")) {
      const h = id.split(":")[1];
      handleCounts.set(h, (handleCounts.get(h) || 0) + 1);
    } else {
      tokens.push(featureTypeToken(orb, cutLeafIds, id));
    }
  }
  for (const count of handleCounts.values()) {
    tokens.push(count >= 2 ? "H2" : "H1");
  }
  tokens.sort();
  return tokens.join(",");
}

function collectSpherePool(orb) {
  const pool = [];
  for (const h of orb.handleItems) pool.push(h.plusId, h.minusId);
  for (const c of orb.coneItems) pool.push(c.id);
  for (const ml of orb.mirrorLoops) {
    pool.push(ml.corners.length === 0 ? `smooth:${ml.loopIndex}` : `collar:${ml.loopIndex}`);
  }
  for (const xc of orb.crosscapItems) pool.push(`crosscap:${xc.index}`);
  return pool;
}

/**
 * Canonical signature of the labeled geodesic curve set of a carving, invariant
 * under cut reordering and inside/outside orientation swaps.
 */
export function carvingPartitionSignature(orb, carving) {
  if (!orb?.ok || orb.geometry !== "hyperbolic" || !carving) return "";
  if (orb.mode === "rigid") return "rigid";

  const leavesOf = buildLeafResolver(carving.pieces);

  if (orb.mode === "mirror-poly") {
    const U = orb.mirrorLoops[0].corners.map((c) => c.id);
    const keys = carving.cuts
      .filter((c) => c.kind === "mirror-arc")
      .map((c) => bipartitionKey(...splitUniverse(leavesOf(c.id), U)))
      .sort();
    return keys.join(";");
  }

  if (orb.mode === "cone-mirror") {
    const corners = orb.mirrorLoops[0].corners.map((c) => c.id);
    const cut0 = carving.cuts[0];
    const slotKey = `slot:${[...cut0.pair].sort().join("-")}`;
    const U = [...corners, cut0.id];
    const arcKeys = carving.cuts
      .slice(1)
      .filter((c) => c.kind === "mirror-arc")
      .map((c) => bipartitionKey(...splitUniverse(leavesOf(c.id), U)))
      .sort();
    return [slotKey, ...arcKeys].join(";");
  }

  const parts = [];
  for (const ml of orb.mirrorLoops) {
    if (ml.corners.length < 2) continue;
    const bCut = carving.cuts.find((c) => c.kind === "bridge-arc" && c.loopIndex === ml.loopIndex);
    if (!bCut) continue;
    parts.push(`m${ml.loopIndex}:${[...bCut.pair].sort().join("-")}`);
    const mArcs = carving.cuts.filter((c) => c.kind === "mirror-arc" && c.loopIndex === ml.loopIndex);
    if (mArcs.length > 0) {
      const U = [...ml.corners.map((c) => c.id), bCut.id];
      const arcKeys = mArcs.map((c) => bipartitionKey(...splitUniverse(leavesOf(c.id), U))).sort();
      parts.push(`m${ml.loopIndex}-arcs:${arcKeys.join(",")}`);
    }
  }

  if (orb.mode === "pants") {
    const U = collectSpherePool(orb);
    const pairKeys = carving.cuts
      .filter((c) => c.kind === "pair")
      .map((c) => bipartitionKey(...splitUniverse(leavesOf(c.id), U)))
      .sort();
    if (pairKeys.length > 0) parts.push(`pairs:${pairKeys.join(";")}`);
  }

  return parts.join("|");
}

/**
 * Canonical signature of the unlabeled topological shape of a carving, used to
 * prefer geometrically distinct carvings (e.g. Snowflake vs Caterpillar) on Reshuffle.
 */
export function carvingShapeSignature(orb, carving) {
  if (!orb?.ok || orb.geometry !== "hyperbolic" || !carving) return "";
  if (orb.mode === "rigid") return "rigid";

  const leavesOf = buildLeafResolver(carving.pieces);
  const cutLeafIds = new Set(
    carving.cuts.filter((c) => c.kind === "cone-mirror-arc" || c.kind === "bridge-arc").map((c) => c.id)
  );

  const shapeParts = [];

  const canonicalBipartShape = (leafIds, universe) => {
    const [sideA, sideB] = splitUniverse(leafIds, universe);
    const a = sideShapeToken(orb, cutLeafIds, sideA);
    const b = sideShapeToken(orb, cutLeafIds, sideB);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  };

  if (orb.mode === "mirror-poly") {
    const U = orb.mirrorLoops[0].corners.map((c) => c.id);
    const keys = carving.cuts
      .filter((c) => c.kind === "mirror-arc")
      .map((c) => canonicalBipartShape(leavesOf(c.id), U))
      .sort();
    shapeParts.push(`mp:${keys.join(";")}`);
  } else if (orb.mode === "cone-mirror") {
    const corners = orb.mirrorLoops[0].corners.map((c) => c.id);
    const cut0 = carving.cuts[0];
    if (corners.length >= 3) {
      const slotOrders = cut0.pair.map((id) => itemOrderInOrb(orb, id)).sort((a, b) => a - b);
      shapeParts.push(`slot:${slotOrders.join("-")}`);
    }
    const U = [...corners, cut0.id];
    const arcKeys = carving.cuts
      .slice(1)
      .filter((c) => c.kind === "mirror-arc")
      .map((c) => canonicalBipartShape(leavesOf(c.id), U))
      .sort();
    if (arcKeys.length > 0) shapeParts.push(`arcs:${arcKeys.join(";")}`);
  } else {
    for (const ml of orb.mirrorLoops) {
      if (ml.corners.length < 2) continue;
      const bCut = carving.cuts.find((c) => c.kind === "bridge-arc" && c.loopIndex === ml.loopIndex);
      if (!bCut) continue;
      if (ml.corners.length >= 3) {
        const slotOrders = bCut.pair.map((id) => itemOrderInOrb(orb, id)).sort((a, b) => a - b);
        shapeParts.push(`m${ml.loopIndex}-slot:${slotOrders.join("-")}`);
      }
      const mArcs = carving.cuts.filter((c) => c.kind === "mirror-arc" && c.loopIndex === ml.loopIndex);
      if (mArcs.length > 0) {
        const U = [...ml.corners.map((c) => c.id), bCut.id];
        const arcKeys = mArcs.map((c) => canonicalBipartShape(leavesOf(c.id), U)).sort();
        shapeParts.push(`m${ml.loopIndex}-arcs:${arcKeys.join(";")}`);
      }
    }
    if (orb.mode === "pants") {
      const U = collectSpherePool(orb);
      const pairKeys = carving.cuts
        .filter((c) => c.kind === "pair")
        .map((c) => canonicalBipartShape(leavesOf(c.id), U))
        .sort();
      if (pairKeys.length > 0) shapeParts.push(`pairs:${pairKeys.join(";")}`);
    }
  }

  // Include sorted piece boundary-type summaries so tree shapes like 222222
  // Snowflake vs Caterpillar remain strictly distinct.
  const pieceSummaries = carving.pieces
    .filter((p) => p.kind === "pant" || p.kind === "mirror-poly")
    .map((p) => {
      const featTokens = p.features
        .map((f) => {
          if (f.kind === "cone") return `c${f.order}`;
          if (f.kind === "corner") return `r${f.order}`;
          if (f.kind === "handle-end") return "H";
          if (f.kind === "crosscap-end") return "X";
          if (f.kind === "smooth-end") return "S";
          if (f.kind === "collar-end") return "M";
          return "cut";
        })
        .sort();
      return `${p.kind}[${featTokens.join(",")}]`;
    })
    .sort();

  shapeParts.push(`pieces:${pieceSummaries.join("|")}`);
  return shapeParts.join("##");
}

/**
 * Return true iff this orbifold admits at least two distinct labeled carvings.
 */
export function hasMultipleCarvings(orb, carving) {
  if (!orb?.ok || orb.geometry !== "hyperbolic" || !carving || carving.cuts.length === 0) {
    return false;
  }
  const basePart = carvingPartitionSignature(orb, carving);
  for (let i = 0; i < carving.cuts.length; i++) {
    const opts = getCutOptions(orb, carving, i);
    if (opts.pairMode !== "none" && opts.validPairs.length > 1) {
      for (const [u, v] of opts.validPairs) {
        const cand = setCutPair(orb, carving, i, u, v);
        if (carvingPartitionSignature(orb, cand) !== basePart) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Pick a random valid carving for `orb`. When `prevCarving` is supplied and multiple
 * distinct carvings exist, return a strictly different carving (preferring one with
 * a different topological shape when available).
 */
export function createRandomCarving(orb, prevCarving = null, rng = Math.random) {
  if (!orb?.ok || orb.geometry !== "hyperbolic") {
    return { cuts: [], rootId: null, pieces: [], steps: [] };
  }

  const base = createDefaultCarving(orb);
  if (!hasMultipleCarvings(orb, base)) {
    return base;
  }

  const sampleOnce = () => {
    let cur = createDefaultCarving(orb);
    for (let i = 0; i < cur.cuts.length; i++) {
      const opts = getCutOptions(orb, cur, i);
      if (opts.pairMode !== "none" && opts.validPairs.length > 1) {
        const pick = opts.validPairs[Math.floor(rng() * opts.validPairs.length)];
        cur = setCutPair(orb, cur, i, pick[0], pick[1]);
      }
    }
    return cur;
  };

  if (!prevCarving) {
    return sampleOnce();
  }

  const prevPart = carvingPartitionSignature(orb, prevCarving);
  const prevShape = carvingShapeSignature(orb, prevCarving);

  let firstDiffPart = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const cand = sampleOnce();
    const part = carvingPartitionSignature(orb, cand);
    if (part === prevPart) continue;
    if (!firstDiffPart) firstDiffPart = cand;
    if (carvingShapeSignature(orb, cand) !== prevShape) {
      return cand;
    }
  }

  // Fallback bounded DFS over mutable steps if random sampling did not hit a new shape
  const mutableIndices = [];
  for (let i = 0; i < base.cuts.length; i++) {
    const opts = getCutOptions(orb, base, i);
    if (opts.pairMode !== "none") mutableIndices.push(i);
  }

  const candidates = [];
  const seenParts = new Set();
  const dfs = (depth, cur) => {
    if (candidates.length >= 80) return;
    if (depth === mutableIndices.length) {
      const part = carvingPartitionSignature(orb, cur);
      if (!seenParts.has(part)) {
        seenParts.add(part);
        candidates.push({
          part,
          shape: carvingShapeSignature(orb, cur),
          carving: cur
        });
      }
      return;
    }
    const cutIdx = mutableIndices[depth];
    const opts = getCutOptions(orb, cur, cutIdx);
    for (const [u, v] of opts.validPairs) {
      dfs(depth + 1, setCutPair(orb, cur, cutIdx, u, v));
      if (candidates.length >= 80) break;
    }
  };
  dfs(0, base);

  const diffShape = candidates.filter((c) => c.part !== prevPart && c.shape !== prevShape);
  if (diffShape.length > 0) {
    return diffShape[Math.floor(rng() * diffShape.length)].carving;
  }

  const diffPart = candidates.filter((c) => c.part !== prevPart);
  if (diffPart.length > 0) {
    return diffPart[Math.floor(rng() * diffPart.length)].carving;
  }

  return firstDiffPart || base;
}
