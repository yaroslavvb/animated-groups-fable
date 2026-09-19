#!/usr/bin/env python3
"""Build the three-colour catalog (`colour-atlas-v1`) by mining the wallpaper atlas.

Two colourings of a hexagonal-lattice field U(x, t), both on three colours
(0 terracotta, 1 teal, 2 sand):

  GYRE     colour(x, t) = argmax_k U(g^k x, t + k T/3),  g = the 120 degree turn
           about a point p that is NOT a symmetry centre of U.  The entangled law
           colour(g x, t + T/3) = colour(x, t) - 1 holds exactly for any field and
           any centre; the halves fail generically.

  TREFOIL  colour(x, t) = argmax_k U(x + k b, t),  b = (1/3, 2/3) in lattice
           coordinates (R b = b mod L).  Translation by b cycles the colours with
           no time shift; a field symmetry (h, tau) with h b = -b mod L turns into
           a colour TRANSPOSITION, so the colour group is S3.

Everything below is exact integer arithmetic on the saved nodes: no interpolation
and no tolerance anywhere except the float tolerance used to shortlist candidates
out of the FFT search, which is always confirmed by a direct integer comparison.

Two sources feed one pipeline: the triangular-six orbits of the wallpaper atlas,
and the admitted records of the offline equation search (`--records DIR`, one
folder per candidate with its certificate and its Float32 payload).  A record's
field is copied byte-identically into `../data/orbits/<sha256>.f32`; records that
are translations, rotations or time shifts of one another are collapsed, and the
two chiralities of one orbit are both kept and flagged as a pair.

Every entry carries the generator marks the explorer pages draw, in the shape
`../../scott-gray/trefoil/generators.mjs` exports: derived from the entry's own
measured symmetry list, checked against the master rule sigma(c) = (-1)^m c - j,
and then re-tested at all N^2 M node-frames.

Usage
    python3 build-colour-catalog.py [--records DIR ...] [--jobs N] [--limit N]
                                    [--only SHA_PREFIX] [--per-set N]
                                    [--strips DIR] [--out PATH] [--no-thumbs]

    See README.md for the full interface, the budgets, and how to re-run when
    the long search finishes.

Dependencies: python3 + numpy (stdlib zlib/struct write the PNGs).
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import itertools
import json
import math
import os
import struct
import sys
import time
import zlib
from concurrent.futures import ProcessPoolExecutor
from fractions import Fraction

import numpy as np

# --------------------------------------------------------------------------- paths

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.normpath(os.path.join(HERE, '..', '..'))           # .../docs
SG = os.path.join(DOCS, 'scott-gray')
ATLAS = os.path.join(SG, 'data', 'wallpaper-atlas.json')
GROUPS = os.path.join(SG, 'wallpaper-groups.json')
OUT_DIR = os.path.join(DOCS, 'colour', 'data')
THUMB_DIR = os.path.join(OUT_DIR, 'thumbs')

PALETTE = ['#c9563e', '#57979a', '#e2be68']                        # 0, 1, 2
PALETTE_RGB = np.array([[0xc9, 0x56, 0x3e], [0x57, 0x97, 0x9a], [0xe2, 0xbe, 0x68]], dtype=np.uint8)
SQRT3 = math.sqrt(3.0)

# --------------------------------------------------------------------------- lattice

# Lattice coordinates on the basis a1 = (1, 0), a2 = (-1/2, -sqrt3/2) (screen y
# down, the renderers' convention).  The third-turn used by the Gyre rule is the
# integer matrix S(u, v) = (v - u, -u) -- `R240` in the table below, the one
# `../scott-gray/gyre/` names S.  S^2 + S + I = 0, so S^3 = I and
# (I - S)^-1 = (2 I + S) / 3.
S3ROT = np.array([[-1, 1], [-1, 0]], dtype=np.int64)
S3INV = np.array([[1, 1], [-1, 2]], dtype=np.int64)          # 2 I + S = 3 (I - S)^-1

# The twelve point operations of the triangular lattice, in lattice coordinates.
POINT_OPS = [
    ('1',    ((1, 0), (0, 1))),
    ('R60',  ((1, -1), (1, 0))),
    ('R120', ((0, -1), (1, -1))),
    ('R180', ((-1, 0), (0, -1))),
    ('R240', ((-1, 1), (-1, 0))),
    ('R300', ((0, 1), (-1, 1))),
    ('Ma',   ((0, 1), (1, 0))),
    ('Mb',   ((1, 0), (1, -1))),
    ('Mc',   ((-1, 1), (0, 1))),
    ('Md',   ((0, -1), (-1, 0))),
    ('Me',   ((-1, 0), (-1, 1))),
    ('Mf',   ((1, -1), (0, -1))),
]
OP_BY_MATRIX = {m: name for name, m in POINT_OPS}

# Parameters the site already ships, so that the catalog reproduces them rather
# than quietly replacing them.  `w` is the Gyre turn translation in node units.
SHIPPED = {
    '8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c': {
        'gyre': {'w': [0, 11], 'page': 'scott-gray/gyre/',
                 'note': 'p = (1/18, 1/9), the centre the shipped Gyre page turns about'},
        'trefoil': {'page': 'scott-gray/trefoil/',
                    'note': 'the shipped Trefoil page, b = (1/3, 2/3)'},
    },
}

# Chosen by eye from the 512-pixel thumbnails and the 12-frame strips this
# script writes: the most legible pictures, spread over the three equations, the
# film groups of the source fields and the cell sizes.  Every one of them is
# exact; `featured` is a judgement about how it looks, nothing else.
#
# A key here exempts its entry from the budget trim AND protects that entry's
# chirality partner (`featured_partners`, `select_entries`), because a blurb can
# say "its mirror is in the catalog too" and the pages badge the mirror only
# when it is shipped.  Say nothing here about another entry that the build does
# not keep true by construction.
FEATURED = {
    'colour:gyre:8fcde9bc1178': 'the centre and field the shipped ../scott-gray/gyre/ page uses: '
                                'interlocking scroll hooks, colour-preserving subgroup exactly p1',
    'colour:gyre:2130d7fe5d3d': 'broad triangles and half-hexagons in bands, the boldest shapes in the '
                                'catalog; the source field is a p6m wave (g224/g230/g233/g246/g271) yet '
                                'the colouring keeps no mirror at all',
    'colour:gyre:63b94614de9c': 'rings: terracotta discs inside sand annuli on teal, the one motif here '
                                'that reads as a figure rather than a tiling',
    'colour:gyre:af4fd681881a': 'the cleanest large lozenges in the catalog - boundary density 0.052, '
                                'area imbalance 0.010, speckle 2.8e-4',
    'colour:gyre:87baf199081e': 'big interlocking curved arms, a p6-sibling field (g226/g248) at the '
                                'opposite chirality to the featured g225/g247 ones',
    'colour:gyre:521b5766893a': 'complex Ginzburg-Landau: three-armed spirals, a motif no Gray-Scott '
                                'field in the atlas produces',
    'colour:gyre:bc8f182d96b3': 'complex Ginzburg-Landau on a p3 field: paisley scrolls, tight and '
                                'speckle-free (speckle exactly 0)',
    'colour:gyre:62750911596d': 'Brusselator: broad flat blocks, a decisive argmax (margin 1.21 field '
                                'standard deviations) and speckle exactly 0',
    'colour:trefoil:8fcde9bc1178': 'the field and offset the shipped ../scott-gray/trefoil/ page uses: '
                                   'S3, 18 exact symmetries, colour-preserving p3 (g225)',
    'colour:trefoil:d212294af397': 'the mirror sibling of the shipped page - the same picture at the '
                                   'opposite chirality, colour-preserving g226 and picture group g248',
    'colour:trefoil:1c29d2a226c9': 'broad wave bands, the most readable Trefoil: boundary density 0.056, '
                                   'margin 1.09, exactly a third of every frame in each colour',
    'colour:trefoil:4680de1f3367': 'the g226/g248 partner of the wave bands, for the chirality pair',
    'colour:trefoil:661f1fd325eb': 'paisley teardrops - the least grid-like Trefoil in the catalog',
    'colour:trefoil:2162754aa965': '72 exact symmetries rather than 18: the picture repeats on a lattice '
                                   'four times finer than the saved cell, a scale-and-fan pattern',
    'colour:trefoil:0f8a90186a3d': 'Brusselator: broad diamonds, margin 1.24 - the only non-Gray-Scott '
                                   'equation that yields a Trefoil at all',
    'colour:trefoil:2897f4d0a546': 'the g248 Brusselator partner of the above, completing the '
                                   'equation-by-chirality grid',

    # ---- the offline equation search (docs/scott-gray/research/colour/) ----
    # Chosen the same way: by looking at the 512-pixel thumbnails and the
    # 12-frame strips of every search entry the build mined, laid out as contact
    # sheets per equation.  Two or three per equation, spread over the motifs the search
    # actually produced - hexagon tilings, triangles, spirals, scrolls,
    # scallops and lozenges - and over both chiralities where the search found
    # a pair.
    'colour:gyre:b5207a1aafaf': 'Brusselator: a flat hexagon tiling, three colours one per '
                                'hexagon, with the area split exactly in thirds and no speckle '
                                'at all - the plainest statement in the catalog of what a '
                                'three-colouring of a wave is',
    # The g246 bru-e picture that used to stand here (field 1cb589bef8b7) left the
    # catalog when the long batch found the same orbit again at a lower boundary
    # density; the kept copy is a different phase of it and a quieter picture.  Its
    # role — big triangles, the boldest area imbalance in the catalog — passes to
    # this bru-d orbit on the same film group, which carries the motif and the claim.
    'colour:gyre:0aa87383a573': 'Brusselator on a g246 field: whole triangles of one colour with '
                                'teal and red wedges bitten out of them, and the boldest area '
                                'imbalance in the catalog (0.248) - in its worst frame one colour '
                                'holds 58% of the cell, while over the film the three shares are '
                                'exactly a third each',
    'colour:trefoil:bc386cbb30c5': 'Brusselator, Trefoil: broad wave lozenges, 18 exact '
                                   'symmetries, colour-preserving p3 - and its mirror is in the '
                                   'catalog too, as the chirality partner the search found',
    'colour:gyre:38a9d1a77254': 'cubic-quintic Ginzburg-Landau: interlocking clover, the one '
                                'motif with three-lobed pieces rather than blocks or scrolls',
    'colour:gyre:c3614b3de8c9': 'cubic-quintic Ginzburg-Landau: the largest spirals in the '
                                'catalog, one arm per colour, speckle exactly 0',
    'colour:gyre:a767fbcc68c0': 'Ginzburg-Landau at the new cgl-d parameters: plus-shaped '
                                'pieces on a p3 field, boundary density 0.071 with no speckle',
    'colour:gyre:64ed69f33459': 'Ginzburg-Landau, cgl-c: tight three-armed spirals at the '
                                'opposite chirality to the g225 ones the atlas already had',
    'colour:gyre:56cf777b57b5': 'the lambda-omega normal form: a clean hexagon tiling on a p31m '
                                'field, exactly a third of every frame in each colour',
    # Supersedes the lw-b g244 open scrolls (f7cf7381878b, boundary density 0.170,
    # margin 0.96, speckle 9.6e-5) the previous build featured: same motif, same
    # equation, and better on every measurement that bears on how it reads.
    'colour:gyre:2facfcba0639': 'the lambda-omega normal form at the lw-d parameters: a dense '
                                'field of small three-armed scrolls on a nine-op p3 field, '
                                'speckle exactly 0 and an exact third of every frame in each '
                                'colour - the cleanest scroll picture the search produced',
    'colour:gyre:76f88d20b6ac': 'Schnakenberg: rounded hexagons, boundary density 0.066 — the '
                                'lowest of the new equations, though six Gray–Scott entries go '
                                'lower — and speckle exactly 0',
    'colour:gyre:45d35d02d738': 'Schnakenberg on a p6m field: the cleanest large triangles here, '
                                'alternating point-up and point-down',
    'colour:trefoil:8bd53f8ad4ee': 'Schnakenberg, Trefoil: broad diamonds, margin 1.24 and an '
                                   'exact third of every frame in each colour',
    'colour:gyre:3364a7645e6f': 'Sel’kov: a soft check of rounded blocks, boundary density '
                                '0.069 and argmax margin 1.23 — a relaxation-like cycle drawn '
                                'with soft edges',
    'colour:trefoil:3364a7645e6f': 'the Trefoil of the same Sel’kov orbit - the one place in '
                                   'the catalog where both colourings of one field are featured, '
                                   'so the two rules can be read against each other',

    # ---- the two equations the long batch added (Lengyel-Epstein, rock-paper-scissors) ----
    # Same judgement, same way: contact sheets of every entry these two equations
    # produced, at 512 pixels, laid out per equation and per colouring.
    'colour:gyre:c02dbaafcb27': 'Lengyel-Epstein, the CIMA reaction that first showed a Turing '
                                'pattern in a laboratory: interlocking plus-shapes on a nine-op '
                                'p3 field, boundary density 0.068 with no speckle at all and an '
                                'exact third of every frame in each colour - the cleanest Gyre '
                                'of the equations the long batch added',
    'colour:trefoil:03ca299f9b36': 'Lengyel-Epstein, Trefoil: overlapping fish-scale scallops, a '
                                   'motif no other equation in the catalog produces, with 18 '
                                   'exact symmetries and colour-preserving p3 - the shape of the '
                                   'shipped Trefoil page drawn by different chemistry',
    'colour:trefoil:721371620bab': 'the g248 partner of the Lengyel-Epstein scallops: the same '
                                   'picture at the opposite chirality, matched to its mirror by '
                                   'Ma at 2.0e-5 relative RMS',
    # Not "the most decisive argmax of the new equations": the other g227 rps
    # entry, 54faf5565b0a, measures 1.311 against this one's 1.234.  This is the
    # cleaner picture of the two (boundary density 0.075 against 0.085), which is
    # why it is the one featured; the margin is a decisive one, not the largest.
    'colour:gyre:5fc3cc7d4c15': 'rock-paper-scissors: one flat hexagon per species, speckle '
                                'exactly 0, an exact third of every frame in each colour and a '
                                'decisive argmax (margin 1.23) - the cyclic competition of three '
                                'species drawn as plainly as three colours can draw it',
    'colour:gyre:171743e84bbd': 'rock-paper-scissors on the p3 field of the opposite chirality: '
                                'the same cyclic competition read as an irregular cellular '
                                'tiling rather than a lattice - rounded cells of unequal size, '
                                'the least grid-like picture the new equations gave',
}

# --------------------------------------------------------------------------- models
#
# The pages read this table out of the catalog rather than closing over a fixed
# list (colour-pages-design.md section 4): the equation pills, the monospace
# equation line, the paragraph, the parameter-map axis names, the parameter
# <select> text and the channel names in #display-range all come from here.
# Adding an equation is adding one object to this dict and re-running the
# builder; not a line of page code changes.  `axes` are the two parameters the
# parameter map plots; `parameters` is the full ordered signature that makes one
# parameter set; `diffusion` names the ones that must be positive.

MODELS = {
    'gray-scott': {
        'name': 'Gray–Scott',
        'axes': ['F', 'k'],
        'labels': {'F': 'F', 'k': 'k', 'Du': 'Dᵤ', 'Dv': 'Dᵥ'},
        'parameters': ['F', 'k', 'Du', 'Dv'],
        'diffusion': ['Du', 'Dv'],
        'channels': ['U', 'V'],
        'equation': 'uₜ = Dᵤ∇²u − uv² + F(1 − u)\nvₜ = Dᵥ∇²v + uv² − (F + k)v',
        'equationHtml': 'u<sub>t</sub> = D<sub>u</sub>∇²u − uv² + F(1 − u)<br>'
                        'v<sub>t</sub> = D<sub>v</sub>∇²v + uv² − (F + k)v',
        'description':
            'The autocatalytic Gray–Scott reaction: a substrate u fed in at rate F is eaten by '
            'an activator v at the cubic rate uv², and v decays at rate F + k. It is the '
            'equation the rest of the site runs on, and one of the four here with no '
            'continuous phase symmetry, so a periodic orbit has to be closed by shooting: '
            '19 of the 74 saved Gray–Scott fields were shot for this search and the other '
            '55 are the wallpaper atlas’s own audited orbits. The U channel the colourings '
            'read is the substrate.',
    },
    'ginzburg-landau': {
        'name': 'Ginzburg–Landau',
        'axes': ['alpha', 'beta'],
        'labels': {'alpha': 'α', 'beta': 'β', 'D': 'D'},
        'parameters': ['alpha', 'beta', 'D'],
        'diffusion': ['D'],
        'channels': ['Re A', 'Im A'],
        'equation': 'Aₜ = A + (1 + iα)D∇²A − (1 − iβ)|A|²A,  A = u + iv',
        'equationHtml': 'A<sub>t</sub> = A + (1 + iα)D∇²A − (1 − iβ)|A|²A, &nbsp; A = u + iv',
        'description':
            'The cubic complex Ginzburg–Landau equation, written on two real channels. '
            'Multiplying A by a constant phase is an exact symmetry, so a wave that is steady '
            'in a rotating frame is exactly time-periodic — which is why nearly every orbit '
            'of this family was found as a relative equilibrium rather than by shooting. The '
            'colourings read Re A.',
    },
    'cgl-quintic': {
        'name': 'Cubic–quintic Ginzburg–Landau',
        'axes': ['alpha', 'beta'],
        'labels': {'alpha': 'α', 'beta': 'β', 'D': 'D', 'gamma': 'γ', 'delta': 'δ'},
        'parameters': ['alpha', 'beta', 'D', 'gamma', 'delta'],
        'diffusion': ['D'],
        'channels': ['Re A', 'Im A'],
        'equation': 'Aₜ = A + (1 + iα)D∇²A − (1 − iβ)|A|²A − (γ − iδ)|A|⁴A',
        'equationHtml': 'A<sub>t</sub> = A + (1 + iα)D∇²A − (1 − iβ)|A|²A − (γ − iδ)|A|⁴A',
        'description':
            'Ginzburg–Landau with the next term in the amplitude expansion kept. The quintic '
            'coefficients γ and δ bend the amplitude–frequency relation, so the same phase '
            'symmetry survives while the shape of the wave does not: the coloured pictures it '
            'gives are rounder and less faceted. The three (α, β) pairs saved here — '
            '(0.4, 0.9), (1.0, 0.6) and (1.6, 0.2) — are not among the cubic ones, so the two '
            'families cannot be compared at equal parameters on this page.',
    },
    'lambda-omega': {
        'name': 'λ–ω system',
        'axes': ['l1', 'w1'],
        'labels': {'l0': 'λ₀', 'l1': 'λ₁', 'l2': 'λ₂', 'w0': 'ω₀', 'w1': 'ω₁', 'w2': 'ω₂', 'D': 'D'},
        'parameters': ['l0', 'l1', 'l2', 'w0', 'w1', 'w2', 'D'],
        'diffusion': ['D'],
        'channels': ['Re A', 'Im A'],
        'equation': 'Aₜ = D∇²A + (λ(m) + iω(m))A,  m = |A|²\n'
                    'λ(m) = λ₀ − λ₁m + λ₂m²,  ω(m) = ω₀ + ω₁m + ω₂m²',
        'equationHtml': 'A<sub>t</sub> = D∇²A + (λ(m) + iω(m))A, &nbsp; m = |A|²<br>'
                        'λ(m) = λ₀ − λ₁m + λ₂m², &nbsp; ω(m) = ω₀ + ω₁m + ω₂m²',
        'description':
            'The λ–ω normal form: a complex amplitude whose growth rate and frequency depend '
            'only on its modulus, with ordinary real diffusion. It is the most permissive '
            'phase-symmetric family in the search — the frequency at zero amplitude, ω₀, is a '
            'free dial that shifts the period without touching the shape — and it supplies '
            'more of the new coloured orbits than any other equation.',
    },
    'brusselator': {
        'name': 'Brusselator',
        'axes': ['b', 'a'],
        'labels': {'a': 'a', 'b': 'b', 'Du': 'Dᵤ', 'Dv': 'Dᵥ'},
        'parameters': ['a', 'b', 'Du', 'Dv'],
        'diffusion': ['Du', 'Dv'],
        'channels': ['U', 'V'],
        'equation': 'uₜ = Dᵤ∇²u + a − (b + 1)u + u²v\nvₜ = Dᵥ∇²v + bu − u²v',
        'equationHtml': 'u<sub>t</sub> = D<sub>u</sub>∇²u + a − (b + 1)u + u²v<br>'
                        'v<sub>t</sub> = D<sub>v</sub>∇²v + bu − u²v',
        'description':
            'The Brusselator, the textbook trimolecular oscillator. Its uniform state '
            '(a, b/a) loses stability in a Hopf bifurcation at b = 1 + a², and the waves just '
            'past that line are the ones the search seeds from. It has no phase symmetry, so '
            'every orbit here was closed by twisted shooting, and it gives the flattest, '
            'blockiest colourings in the catalog.',
    },
    'schnakenberg': {
        'name': 'Schnakenberg',
        'axes': ['a', 'b'],
        'labels': {'a': 'a', 'b': 'b', 'Du': 'Dᵤ', 'Dv': 'Dᵥ'},
        'parameters': ['a', 'b', 'Du', 'Dv'],
        'diffusion': ['Du', 'Dv'],
        'channels': ['U', 'V'],
        'equation': 'uₜ = Dᵤ∇²u + a − u + u²v\nvₜ = Dᵥ∇²v + b − u²v',
        'equationHtml': 'u<sub>t</sub> = D<sub>u</sub>∇²u + a − u + u²v<br>'
                        'v<sub>t</sub> = D<sub>v</sub>∇²v + b − u²v',
        'description':
            'The Schnakenberg activator–substrate scheme for glycolysis. With s = a + b the '
            'uniform state is (s, b/s²) and the Hopf locus is s − s³ = 2a, a narrow band; the '
            'orbits admitted here sit just inside it, which is why there are few of them and '
            'why their waves are shallow and smooth.',
    },
    'selkov': {
        'name': 'Sel’kov',
        'axes': ['a', 'b'],
        'labels': {'a': 'a', 'b': 'b', 'Du': 'Dᵤ', 'Dv': 'Dᵥ'},
        'parameters': ['a', 'b', 'Du', 'Dv'],
        'diffusion': ['Du', 'Dv'],
        'channels': ['U', 'V'],
        'equation': 'uₜ = Dᵤ∇²u − u + av + u²v\nvₜ = Dᵥ∇²v + b − av − u²v',
        'equationHtml': 'u<sub>t</sub> = D<sub>u</sub>∇²u − u + av + u²v<br>'
                        'v<sub>t</sub> = D<sub>v</sub>∇²v + b − av − u²v',
        'description':
            'Sel’kov’s glycolytic oscillator, the two-variable ancestor of the Schnakenberg '
            'scheme. The uniform state is (b, b/(a + b²)) and, with s = a + b², the Hopf locus '
            'is 2b² = s(1 + s). Its relaxation-like cycle spends most of the period near one '
            'extreme, so the colour shares swing inside a loop rather than holding a third '
            'each frame — worst deviation 0.206 across its entries here, against 0.254 for '
            'the Brusselator, 0.235 for Schnakenberg and 0.163 for Gray–Scott.',
    },
    'lengyel-epstein': {
        'name': 'Lengyel–Epstein',
        'axes': ['a', 'b'],
        'labels': {'a': 'a', 'b': 'b', 'Du': 'Dᵤ', 'Dv': 'Dᵥ'},
        'parameters': ['a', 'b', 'Du', 'Dv'],
        'diffusion': ['Du', 'Dv'],
        'channels': ['U', 'V'],
        'equation': 'uₜ = Dᵤ∇²u + a − u − 4uv/(1 + u²)\n'
                    'vₜ = Dᵥ∇²v + b(u − uv/(1 + u²))',
        'equationHtml': 'u<sub>t</sub> = D<sub>u</sub>∇²u + a − u − 4uv/(1 + u²)<br>'
                        'v<sub>t</sub> = D<sub>v</sub>∇²v + b(u − uv/(1 + u²))',
        'description':
            'The Lengyel–Epstein two-variable model of the CIMA chlorite–iodide–malonic-acid '
            'reaction, the chemistry in which Turing patterns were first seen in a laboratory. '
            'u is the iodide activator and v the chlorite inhibitor; the Michaelis-like term '
            '4uv/(1 + u²) saturates, which is what lets the oscillation stay bounded without a '
            'cubic. The uniform state is u* = a/5, v* = 1 + u*², and the Hopf locus is '
            'b = (3u*² − 5)/u*; only the set just past it — a = 12, b = 4.9 — closed any '
            'orbits here, and it is the latest equation in the catalog to carry a Trefoil as '
            'well as a Gyre. The colourings read the iodide channel u.',
    },
    'rps': {
        'name': 'Rock–paper–scissors',
        'axes': ['e', 'd'],
        'labels': {'e': 'e', 'd': 'd', 'mu': 'μ', 'D': 'D'},
        'parameters': ['e', 'd', 'mu', 'D'],
        'diffusion': ['D'],
        'channels': ['u₀', 'u₁'],
        'equation': 'u₂ = 1 − u₀ − u₁,  fᵢ = e uᵢ₊₁ − d uᵢ₊₂,  φ = Σ uᵢ fᵢ\n'
                    '(uᵢ)ₜ = D∇²uᵢ + uᵢ(fᵢ − φ) + μ(1/3 − uᵢ)',
        'equationHtml': 'u₂ = 1 − u₀ − u₁, &nbsp; f<sub>i</sub> = e u<sub>i+1</sub> − '
                        'd u<sub>i+2</sub>, &nbsp; φ = Σ u<sub>i</sub> f<sub>i</sub><br>'
                        '(u<sub>i</sub>)<sub>t</sub> = D∇²u<sub>i</sub> + '
                        'u<sub>i</sub>(f<sub>i</sub> − φ) + μ(1/3 − u<sub>i</sub>)',
        'description':
            'The cyclic three-species replicator — rock beats scissors beats paper beats rock — '
            'with equal diffusion and a small mutation rate μ holding the state off the '
            'extinction boundary. It is the one equation in this catalog that is equivariant '
            'under cyclic relabelling of its species: (u₀, u₁, u₂) → (u₁, u₂, u₀) leaves the '
            'right-hand side unchanged. That is a symmetry of the chemistry and not of the '
            'picture — the Z₃ a Gyre shows is the colouring’s own third-turn-and-third-period '
            'screw, which on these orbits is not the relabelling — but it is the only family '
            'here where the two are even the same group. Equal diffusion conserves '
            'u₀ + u₁ + u₂ = 1 exactly, which is why two channels suffice; the colourings read '
            'u₀. It was also the hardest family to close — half of its shooting runs (85 of 172) '
            'ran out their ten-minute budget — so only a handful of its orbits are here, all of '
            'them Gyres: it produced no Trefoil at all.',
    },
}

# b, the threefold-centre offset.  3b = a1 + 2a2 is a lattice vector and
# R120 b = b (mod L), so L' = L + Z b is the index-3 superlattice of all
# threefold centres.
B_FRAC = (1.0 / 3.0, 2.0 / 3.0)

# The six colour permutations of Z3, as sigma(c).  The even ones are c -> c + m,
# the odd ones c -> m - c.
PERMS = []
for _m in range(3):
    PERMS.append(('even', _m, tuple((c + _m) % 3 for c in range(3))))
for _m in range(3):
    PERMS.append(('odd', _m, tuple((_m - c) % 3 for c in range(3))))

PERM_NAMES = {
    (0, 1, 2): 'identity', (1, 2, 0): '+1', (2, 0, 1): '-1',
    (0, 2, 1): '(1 2)', (1, 0, 2): '(0 1)', (2, 1, 0): '(0 2)',
}


def check_point_ops():
    """The twelve matrices really are the point group of the hexagonal lattice."""
    g = np.array([[1.0, -0.5], [-0.5, 1.0]])           # Gram matrix of a1, a2
    found = []
    for a, b, c, d in itertools.product(range(-2, 3), repeat=4):
        p = np.array([[a, b], [c, d]], dtype=float)
        if abs(round(np.linalg.det(p))) != 1:
            continue
        if np.allclose(p.T @ g @ p, g):
            found.append(((a, b), (c, d)))
    assert len(found) == 12, len(found)
    assert set(found) == set(m for _, m in POINT_OPS), (sorted(found), sorted(m for _, m in POINT_OPS))


def to_plane(u, v):
    """Lattice to plane coordinates, x right and y DOWN (the renderers')."""
    return u - v / 2.0, -SQRT3 * v / 2.0


def from_plane(x, y):
    return x - y / SQRT3, -2.0 * y / SQRT3


def inv_unimodular(m):
    (a, b), (c, d) = m
    det = a * d - b * c
    assert abs(det) == 1
    return np.array([[d, -b], [-c, a]], dtype=np.int64) * det


# --------------------------------------------------------------------------- atlas

def load_atlas():
    with open(ATLAS) as fh:
        return json.load(fh)


def load_groups():
    with open(GROUPS) as fh:
        return json.load(fh)


def distinct_hex_fields(atlas):
    """One record per distinct field file among the triangular-six orbits.

    185 orbit records share 116 distinct fields (the same orbit is catalogued
    under several film groups); the catalog is built per field, and every
    groupId that names it is carried along.
    """
    by_sha = {}
    for o in atlas['orbits']:
        cfg = o.get('config') or {}
        if (cfg.get('params') or {}).get('stencil') != 'triangular-six':
            continue
        sha = o['fieldSha256']
        rec = by_sha.get(sha)
        if rec is None:
            by_sha[sha] = rec = {'orbit': o, 'atlasIds': [], 'groupIds': [], 'ops': {}}
        rec['atlasIds'].append(o['id'])
        if o['groupId'] not in rec['groupIds']:
            rec['groupIds'].append(o['groupId'])
        # The same field is catalogued under several film groups, each listing
        # only that group's ops.  Take the union: the richest known symmetry set.
        for op in cfg['ops']:
            key = (tuple(tuple(int(x) for x in r) for r in op['M']),
                   round(float(op['v'][0]) % 1.0, 9), round(float(op['v'][1]) % 1.0, 9),
                   round(float(op['tau']) % 1.0, 9))
            rec['ops'][key] = {'M': [[int(x) for x in r] for r in op['M']],
                               'v': [float(op['v'][0]), float(op['v'][1])],
                               's': op.get('s', 1), 'tau': float(op['tau'])}
        if len(cfg['ops']) > len(rec['orbit']['config']['ops']):
            rec['orbit'] = o
    for rec in by_sha.values():
        rec['ops'] = list(rec['ops'].values())
        rec['origin'] = 'atlas'
        rec['fieldPath'] = os.path.join(SG, rec['orbit']['fieldUrl'])
        rec['fieldUrl'] = 'scott-gray/' + rec['orbit']['fieldUrl']
        rec['sourceExtra'] = {}
    return list(by_sha.values())


# --------------------------------------------------------------------------- records

RECORD_SCHEMA = 'colour-candidate-v1'
GATE_VERSION = 'colour-offline-v1'


def _job_params(cand):
    """The parameters that identify the equation point, without dx or stencil."""
    names = (MODELS.get(cand['model']) or {}).get('parameters') or sorted(cand['job']['params'])
    src = cand['job']['params']
    return {k: float(src[k]) for k in names if k in src}


def load_records(dirs, skipped):
    """Every admitted record under the given search-output directories.

    A record is one folder holding `candidate.json` (schema colour-candidate-v1)
    and the Float32 payload it names.  The certificate is re-read and the gate
    re-checked here: a record whose certificate does not say `passed` under the
    gate this catalog carries is skipped with a reason, never quietly included.
    Records are returned in the same shape `distinct_hex_fields` produces, so
    `analyse_field` cannot tell the two sources apart.
    """
    out, by_sha = [], {}
    for root in dirs:
        root = os.path.abspath(root)
        if not os.path.isdir(root):
            skipped.append({'dir': root, 'why': 'not a directory'})
            continue
        for name in sorted(os.listdir(root)):
            path = os.path.join(root, name, 'candidate.json')
            if not os.path.isfile(path):
                continue
            try:
                with open(path) as fh:
                    cand = json.load(fh)
            except Exception as exc:
                skipped.append({'job': name, 'why': f'unreadable candidate.json: {exc}'})
                continue
            cert = cand.get('certificate') or {}
            why = None
            if cand.get('schema') != RECORD_SCHEMA:
                why = f"schema {cand.get('schema')!r}, expected {RECORD_SCHEMA!r}"
            elif cand.get('gateVersion') != GATE_VERSION or cert.get('gateVersion') != GATE_VERSION:
                why = f"gate {cand.get('gateVersion')!r}/{cert.get('gateVersion')!r}, expected {GATE_VERSION!r}"
            elif not cert.get('passed'):
                why = 'certificate does not say passed'
            elif cand['model'] not in MODELS:
                why = f"model {cand['model']!r} has no entry in the catalog models table"
            elif (cand['config']['params'] or {}).get('stencil') != 'triangular-six':
                why = 'not on the triangular six-neighbour stencil'
            field = os.path.join(root, name, cand.get('fieldUrl') or 'candidate.f32')
            if why is None and not os.path.isfile(field):
                why = 'field file missing'
            if why is None and os.path.getsize(field) != int(cand['fieldByteLength']):
                why = (f'field is {os.path.getsize(field)} bytes, '
                       f"certificate says {cand['fieldByteLength']}")
            if why is not None:
                skipped.append({'job': name, 'batch': os.path.basename(root), 'why': why})
                continue
            sha = cand['fieldSha256']
            if sha in by_sha:
                skipped.append({'job': name, 'batch': os.path.basename(root),
                                'why': f"same field sha as {by_sha[sha]}", 'duplicateOf': by_sha[sha]})
                continue
            by_sha[sha] = cand['job']['id']
            cfg = cand['config']
            out.append({
                'origin': 'record',
                'orbit': {
                    'id': f"colour-record:{cand['job']['id']}",
                    'groupId': cand['groupId'],
                    'config': cfg,
                    'fieldSha256': sha,
                    'name': None,
                    'ranges': None,
                },
                'ops': cfg['ops'],
                'atlasIds': [],
                'groupIds': [cand['groupId']],
                'fieldPath': field,
                'fieldUrl': f'colour/data/orbits/{sha}.f32',
                'candidate': cand,
                'sourceExtra': {},
                'batch': os.path.basename(root),
                'jobParams': _job_params(cand),
            })
    return out


def _fingerprint(u_field, q=65):
    """A quantile signature of the U channel, invariant under every relabelling
    of the nodes and frames — so two fields that differ in it cannot be a
    translation, rotation, mirror or time shift of one another.  It is a cheap
    necessary condition used only to avoid running the exact test below on
    pairs that obviously cannot match."""
    return np.quantile(u_field.astype(np.float64).ravel(), np.linspace(0.0, 1.0, q))


def _pad_time(g, m, over):
    """Zero-pad a 1-D time spectrum from m to over*m samples, so the inverse
    transform evaluates the correlation BETWEEN saved frames.  The saved frames
    band-limit the orbit — the certificate bounds the energy above a quarter of
    the frame count at 1 % — so this is interpolation, not invention."""
    if over == 1:
        return g
    half = m // 2
    out = np.zeros(over * m, dtype=complex)
    out[:half + 1] = g[:half + 1]
    if m - half - 1:
        out[-(m - half - 1):] = g[half + 1:]
    return out


def motion_match(a, b, n, m, tol=1e-3, over=64):
    """The point operation, node translation and time shift that best carries
    field `a` onto field `b`, with the relative RMS of what is left over.

    ‖a∘g − b‖² = ‖a‖² + ‖b‖² − 2⟨a∘g, b⟩, and the inner product over every
    translation and every time shift at once is a 3-D cyclic cross-correlation,
    so one FFT per point operation settles all N²·M motions — the same trick
    `symmetry_search` uses on the colours.  Both channels are carried, because a
    two-channel field that agrees on U alone is not the same orbit.

    Two independent Newton solves of one orbit generally stop at different
    phases, and the phase offset need not be a whole saved frame, so when the
    whole-frame pass leaves a residue the time axis is oversampled `over`-fold
    and the search repeated: a sub-frame time shift is still a time shift.

    Returns {'proper', 'mirror', 'bestProper', 'bestMirror'}; `proper` and
    `mirror` are the best PROPER and IMPROPER motions within `tol`, or None.
    """
    # float64 throughout: in complex64 the round-off of a 124 416-point
    # transform shows up as a relative residue of 2e-4, which is larger than the
    # agreement two independent solves of one orbit actually reach.
    fa = np.fft.fftn(a.astype(np.float64), axes=(0, 2, 3))
    fb = np.conj(np.fft.fftn(b.astype(np.float64), axes=(0, 2, 3)))
    sa, sb = float(np.sum(a.astype(np.float64) ** 2)), float(np.sum(b.astype(np.float64) ** 2))
    kx, ky = np.meshgrid(np.arange(n), np.arange(n), indexing='xy')
    kvec = np.stack([kx, ky])
    denom = math.sqrt(sb / a.size) or 1.0
    best = {1: None, -1: None}
    for name, mat in POINT_OPS:
        det = mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0]
        pmt = inv_unimodular(mat).T
        kq = np.tensordot(pmt, kvec, axes=(1, 0)) % n
        # Invert the two SPATIAL axes only, so the time axis is still a spectrum
        # and the whole-frame peak can be refined without repeating the 3-D work.
        spat = np.fft.ifftn(fa[:, :, kq[1], kq[0]] * fb, axes=(2, 3))
        corr = np.fft.ifft(spat, axis=0).sum(axis=1).real
        idx = np.unravel_index(int(np.argmax(corr)), corr.shape)
        peak, shift = float(corr[idx]), float(idx[0])
        if over > 1:
            # At the winning node translation the correlation is a trigonometric
            # polynomial in the time shift; evaluating it on an over-fold finer
            # grid costs one padded 1-D transform and catches the sub-frame phase
            # offset two independent Newton solves of one orbit end up at.
            g = spat[:, :, idx[1], idx[2]].sum(axis=1)
            dense = np.fft.ifft(_pad_time(g, m, over)).real * over
            j = int(np.argmax(dense))
            if float(dense[j]) > peak:
                peak, shift = float(dense[j]), j / over
        ssd = max(0.0, sa + sb - 2.0 * peak)
        rel = math.sqrt(ssd / a.size) / denom
        p = np.array(mat, dtype=np.int64)
        u = np.array([int(idx[2]), int(idx[1])], dtype=np.int64)
        v = (p @ u) % n
        row = {'op': name, 'v': [int(v[0]), int(v[1])], 'frames': round(shift, 6),
               'relRms': float(rel), 'determinant': int(det)}
        if best[det] is None or rel < best[det]['relRms']:
            best[det] = row
    return {'proper': best[1] if best[1] and best[1]['relRms'] <= tol else None,
            'mirror': best[-1] if best[-1] and best[-1]['relRms'] <= tol else None,
            'bestProper': best[1], 'bestMirror': best[-1]}


def _record_quality(cand):
    """Lower is better: the cleanest colouring the search measured on this
    record, used to pick which of two copies of one orbit to keep."""
    best = 9.0
    for f in (cand.get('gyre') or {}).get('finalists') or []:
        if f.get('lawAgreement') == 1.0 and not f.get('ties'):
            best = min(best, float(f['boundaryDensity']))
    for f in cand.get('trefoil') or []:
        if f.get('cycleAgreement') == 1.0 and not f.get('ties'):
            best = min(best, float(f['boundaryDensity']))
    return best


def dedupe_records(recs, tol=1e-3, verbose=True):
    """Collapse records that are the same orbit, and pair up the chiralities.

    Two records are candidates for being related when the equation, the
    parameters, the box and the grid agree and the periods agree to 1e-6
    relative (the search polishes each period to a residual near 1e-13); the quantile fingerprint then filters the pairs worth testing, and
    `motion_match` settles it exactly.  A PROPER motion (translation, rotation,
    frame shift, or any composition of them) means one orbit reached twice, and
    the copy whose best measured colouring has the lower boundary density is
    kept.  A MIRROR means the two chiralities of one orbit: both are kept — they
    are genuinely different pictures, and the pages want the pair — and each is
    flagged with the other.
    """
    buckets = {}
    for rec in recs:
        cand = rec['candidate']
        key = (cand['model'],
               tuple(sorted((k, round(v, 12)) for k, v in rec['jobParams'].items())),
               round(float(cand['config']['L']), 9), cand['config']['N'], cand['config']['M'])
        buckets.setdefault(key, []).append(rec)

    kept, dropped, pairs = [], [], []
    for key in sorted(buckets, key=lambda k: (k[0], str(k[1]), k[2], k[3], k[4])):
        group = sorted(buckets[key], key=lambda r: r['candidate']['job']['id'])
        reps = []
        for rec in group:
            cand = rec['candidate']
            n, m = int(cand['config']['N']), int(cand['config']['M'])
            rec['_field'] = load_field(rec['fieldPath'], n, m)
            rec['_fp'] = _fingerprint(rec['_field'][:, 0])
            rec['_q'] = _record_quality(cand)
            match = None
            for rep in reps:
                if abs(cand['period'] - rep['candidate']['period']) > 1e-6 * abs(rep['candidate']['period']):
                    continue
                span = float(np.ptp(rep['_fp'])) or 1.0
                # Loose on purpose: two independent solves of one orbit stop at
                # different phases, so their empirical quantiles differ by about
                # a part in a thousand.  Unrelated fields differ by O(span).
                if float(np.abs(rec['_fp'] - rep['_fp']).max()) > 2e-2 * span:
                    continue
                res = motion_match(rec['_field'], rep['_field'], n, m, tol=tol)
                if res['proper']:
                    match = ('duplicate', rep, res['proper'])
                    break
                if res['mirror']:
                    match = ('chirality', rep, res['mirror'])
                    break
            if match and match[0] == 'duplicate':
                _, rep, how = match
                loser, winner = (rep, rec) if rec['_q'] < rep['_q'] else (rec, rep)
                dropped.append({'job': loser['candidate']['job']['id'], 'batch': loser['batch'],
                                'fieldSha256': loser['candidate']['fieldSha256'],
                                'sameOrbitAs': winner['candidate']['job']['id'],
                                'relation': {'op': how['op'], 'v': how['v'], 'frames': how['frames'],
                                             'relRms': round(how['relRms'], 12)},
                                'why': 'a translation / rotation / frame shift of the kept record; '
                                       'the copy with the lower boundary density is kept'})
                if winner is rec:
                    reps[reps.index(rep)] = rec
                continue
            if match and match[0] == 'chirality':
                _, rep, how = match
                rec['chirality'] = {'partnerSha256': rep['candidate']['fieldSha256'],
                                    'partnerJob': rep['candidate']['job']['id'],
                                    'mirror': how['op'],
                                    'relRms': round(how['relRms'], 12)}
                rep.setdefault('chirality', {}).update(
                    {'partnerSha256': cand['fieldSha256'], 'partnerJob': cand['job']['id'],
                     'mirror': how['op'], 'relRms': round(how['relRms'], 12)})
                pairs.append([rep['candidate']['job']['id'], cand['job']['id'], how['op']])
            reps.append(rec)
        kept.extend(reps)
        for rec in group:                      # one bucket of fields at a time
            rec.pop('_field', None)
    for rec in recs:
        rec.pop('_field', None)
        rec.pop('_fp', None)
    if verbose:
        print(f'  records: {len(recs)} admitted, {len(dropped)} same-orbit duplicates dropped, '
              f'{len(pairs)} chirality pairs, {len(kept)} kept', file=sys.stderr)
    return sorted(kept, key=lambda r: r['candidate']['job']['id']), dropped, pairs


def load_field(path, n, m):
    """Both channels of a saved orbit as F[t, c, y, x]; y is the a2 index, x the a1."""
    raw = np.fromfile(path, dtype='<f4')
    if raw.size != m * 2 * n * n:
        raise ValueError(f'{path}: {raw.size} floats, expected {m * 2 * n * n}')
    return raw.reshape(m, 2, n, n)


def load_u(rec):
    """U channel of a record's field as U[t, y, x]."""
    cfg = rec['orbit']['config']
    n, m = int(cfg['N']), int(cfg['M'])
    return load_field(rec['fieldPath'], n, m)[:, 0].astype(np.float32, copy=True), n, m


# --------------------------------------------------------------------------- the rules

def gyre_colour(u_field, n, m, w):
    """colour(x, t) = argmax_k U(g^k x, t + k T/3) on every saved node and frame.

    `w` is the integer node vector with g(x) = S x + w, so the turn centre is
    p = (I - S)^-1 w = (2 I + S) w / (3 N) in lattice coordinates.  Because w is a
    whole number of nodes, g carries saved nodes to saved nodes; and T/3 is
    exactly M/3 saved frames.  Returns (colour[t, y, x], values[k, t, y, x]).
    """
    assert m % 3 == 0
    third = m // 3
    ys, xs = np.meshgrid(np.arange(n), np.arange(n), indexing='ij')
    pts = np.stack([xs, ys])
    w = np.asarray(w, dtype=np.int64)
    offs = [np.zeros(2, dtype=np.int64), w, w + S3ROT @ w]
    vals = np.empty((3, m, n, n), dtype=np.float32)
    sk = np.eye(2, dtype=np.int64)
    for k in range(3):
        q = np.tensordot(sk, pts, axes=(1, 0)) + offs[k][:, None, None]
        vals[k] = np.roll(u_field, -k * third, axis=0)[:, q[1] % n, q[0] % n]
        sk = S3ROT @ sk
    return np.argmax(vals, axis=0).astype(np.int8), vals


def gyre_same_instant(ops, w, n):
    """If the field carries the threefold screw U(S x + v, t + T/3) = U(x, t) --
    S being Gyre's own third-turn, the `R240` of the table -- then

        U(S^k x + offs_k, t + k T/3) = U(x + S^-k (offs_k - v_k), t),
        v_k = v + S v + ... + S^(k-1) v,

    so the Gyre rule collapses to a comparison of three points at ONE instant
    and the whole picture is visible in a single frame.  Returns the three
    offsets c_k in node units, or None.  When c_2 = 2 c_1 and 3 c_1 is a lattice
    vector the offsets are a translation orbit and the picture is a Trefoil.
    """
    for op in ops:
        mat = tuple(tuple(int(x) for x in r) for r in op['M'])
        if mat != ((-1, 1), (-1, 0)) or abs(op['tau'] - 1.0 / 3.0) > 1e-9:
            continue
        v = np.rint(np.array(op['v'], dtype=float) * n).astype(np.int64)
        if not np.allclose(np.array(op['v'], dtype=float) * n, v, atol=1e-6):
            continue
        w = np.asarray(w, dtype=np.int64)
        offs = [np.zeros(2, dtype=np.int64), w, w + S3ROT @ w]
        sinv = np.array([[0, -1], [1, -1]], dtype=np.int64)          # S^-1 = R120
        cs, vk, sk = [], np.zeros(2, dtype=np.int64), np.eye(2, dtype=np.int64)
        for k in range(3):
            c = (sk @ (offs[k] - vk)) % n
            cs.append([int(c[0]), int(c[1])])
            vk = vk + np.linalg.matrix_power(S3ROT, k) @ v
            sk = sinv @ sk
        c1, c2 = np.array(cs[1]), np.array(cs[2])
        cyclic = bool(np.all((2 * c1 - c2) % n == 0) and np.all((3 * c1) % n == 0))
        return {'offsets': cs, 'offsetsLattice': [[c[0] / n, c[1] / n] for c in cs],
                'screw': {'M': [list(r) for r in mat], 'v': [float(x) for x in op['v']],
                          'tau': op['tau']},
                'translationOrbit': cyclic}
    return None


def gyre_centre(w, n):
    """The turn centre p in lattice coordinates.  (I - S)^-1 = (2 I + S) / 3."""
    q = S3INV @ np.asarray(w, dtype=np.int64)
    return (float(q[0]) / (3.0 * n), float(q[1]) / (3.0 * n))


def trefoil_colour(u_field, n, m):
    """colour(x, t) = argmax_k U(x + k b, t); b = (N/3, 2N/3) whole nodes."""
    assert n % 3 == 0
    bx, by = n // 3, 2 * n // 3
    vals = np.empty((3, m, n, n), dtype=np.float32)
    for k in range(3):
        vals[k] = np.roll(np.roll(u_field, -k * by, axis=1), -k * bx, axis=2)
    return np.argmax(vals, axis=0).astype(np.int8), vals


# --------------------------------------------------------------------------- metrics

def tie_count(vals):
    """Node-frames where the argmax is not strict (two compared values equal)."""
    s = np.sort(vals, axis=0)
    return int(np.count_nonzero(s[2] == s[1]))


def quality(colour, vals, u_std):
    """Area balance, boundary density, speckle, churn and decisiveness."""
    m = colour.shape[0]
    frac = np.stack([(colour == k).mean(axis=(1, 2)) for k in range(3)])   # (3, M)
    overall = frac.mean(axis=1)
    imbalance = float(np.abs(frac - 1.0 / 3.0).max())
    # The three lattice edge directions a1, a2, a1 + a2 (nearest neighbours).
    e1 = (colour != np.roll(colour, -1, axis=2)).mean()
    e2 = (colour != np.roll(colour, -1, axis=1)).mean()
    e3 = (colour != np.roll(np.roll(colour, -1, axis=1), -1, axis=2)).mean()
    edges = float((e1 + e2 + e3) / 3.0)
    # Speckle: nodes disagreeing with all six nearest neighbours.
    nbrs = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1)]
    isolated = np.ones(colour.shape, dtype=bool)
    for dx, dy in nbrs:
        isolated &= colour != np.roll(np.roll(colour, -dy, axis=1), -dx, axis=2)
    speckle = float(isolated.mean())
    churn = float((colour != np.roll(colour, -1, axis=0)).mean())
    s = np.sort(vals, axis=0)
    margin = float(np.mean(s[2] - s[1]) / u_std) if u_std > 0 else 0.0
    ties = int(np.count_nonzero(s[2] == s[1]))
    return {
        'areaFractions': [round(float(x), 6) for x in overall],
        'areaImbalance': round(imbalance, 6),
        'boundaryDensity': round(edges, 6),
        'speckle': round(speckle, 8),
        'churn': round(churn, 6),
        'margin': round(margin, 6),
        'ties': ties,
        'tieFraction': round(ties / float(colour.size), 9),
    }


# --------------------------------------------------------------------------- search

OMEGA = np.exp(2j * np.pi / 3.0)


def symmetry_search(colour, n, m, exact_tol=1e-7):
    """Every (point op, node translation, time shift, colour permutation) that maps
    the colouring to itself, plus the best agreement of everything that does not.

    The count of agreeing node-frames is a 3-D cyclic cross-correlation, so one
    complex correlation per point operation and parity covers every translation
    and every time shift at once.  With E = omega^colour, the indicator
    [c' = sigma(c)] = (1/3) sum_j omega^(j (c' - sigma(c))) folds the six colour
    permutations into two correlations:

        X = mean_x,t  E(P x + v, t + s) conj(E(x, t))      even sigma: c -> c + mu
        Y = mean_x,t  E(P x + v, t + s)      E(x, t)       odd  sigma: c -> mu - c

        agreement(mu) = (1 + 2 Re(omega^-mu Z)) / 3,   Z = X or Y,

    and exactness is Z = omega^mu on the nose.  Because P is unimodular, the
    transform of E o P is the transform of E with its frequency index permuted by
    P^-T, so one FFT of E serves all twelve operations.

    Returns (exact, stats) where `exact` lists the confirmed symmetries and
    `stats` records the best non-symmetry agreements, including the best agreement
    at each time shift for every (op, permutation).
    """
    e = np.exp(2j * np.pi * colour.astype(np.float64) / 3.0)        # [t, y, x]
    fe = np.fft.fftn(e, axes=(0, 1, 2))
    # FFT(conj(E))[k] = conj(FE[-k]); conj of that is FE[-k].
    fe_neg = fe[np.ix_((-np.arange(m)) % m, (-np.arange(n)) % n, (-np.arange(n)) % n)]
    fe_conj = np.conj(fe)

    kx, ky = np.meshgrid(np.arange(n), np.arange(n), indexing='xy')  # k[..] = (kx, ky)
    kvec = np.stack([kx, ky])                                        # (2, n, n) indexed [ky, kx]

    exact = []
    best_overall = (-1.0, None)
    scale = 1.0 / float(m * n * n)
    by_shift = {}          # (opname, parity, mu) -> (M,) float of max agreement per s
    for name, mat in POINT_OPS:
        pmt = inv_unimodular(mat).T                      # P^-T acting on frequencies
        kq = np.tensordot(pmt, kvec, axes=(1, 0)) % n    # (2, ny, nx)
        fc = fe[:, kq[1], kq[0]]
        for parity, other in (('even', fe_conj), ('odd', fe_neg)):
            z = np.fft.ifftn(fc * other, axes=(0, 1, 2))
            zr, zi = np.real(z) * scale, np.imag(z) * scale
            for mu in range(3):
                # Re(omega^-mu z) = cos(2 pi mu/3) Re z + sin(2 pi mu/3) Im z
                ang = 2.0 * math.pi * mu / 3.0
                agree = (1.0 + 2.0 * (math.cos(ang) * zr + math.sin(ang) * zi)) / 3.0
                hits = np.argwhere(agree > 1.0 - exact_tol)
                masked = agree
                if hits.size:
                    masked = agree.copy()
                    for s, uy, ux in hits:
                        masked[s, uy, ux] = -1.0
                        exact.append({'op': name, 'parity': parity, 'mu': mu,
                                      's': int(s), 'u': (int(ux), int(uy))})
                by_shift[(name, parity, mu)] = masked.max(axis=(1, 2))
                idx = np.unravel_index(np.argmax(masked), masked.shape)
                val = float(masked[idx])
                if val > best_overall[0]:
                    best_overall = (val, {'op': name, 'parity': parity, 'mu': mu,
                                          's': int(idx[0]), 'u': (int(idx[2]), int(idx[1]))})
    return exact, {'byShift': by_shift, 'bestNonExact': best_overall}


def confirm_exact(colour, n, m, cand):
    """Recheck a shortlisted symmetry in exact integer arithmetic; return it
    described in the atlas's own convention, or None."""
    name = cand['op']
    mat = dict(POINT_OPS)[name]
    p = np.array(mat, dtype=np.int64)
    u = np.array(cand['u'], dtype=np.int64)
    v = (p @ u) % n                                        # translation in node units
    perm = next(sig for par, mu, sig in PERMS if par == cand['parity'] and mu == cand['mu'])
    ys, xs = np.meshgrid(np.arange(n), np.arange(n), indexing='ij')
    q = (np.tensordot(p, np.stack([xs, ys]), axes=(1, 0)) + v[:, None, None]) % n
    lhs = np.roll(colour, -cand['s'], axis=0)[:, q[1], q[0]]
    rhs = np.array(perm, dtype=np.int8)[colour]
    if not np.array_equal(lhs, rhs):
        return None
    return {
        'name': name,
        'M': [list(r) for r in mat],
        'v': [int(v[0]), int(v[1])],
        'vLattice': [round(float(v[0]) / n, 9), round(float(v[1]) / n, 9)],
        'frames': int(cand['s']),
        'tau': round(float(cand['s']) / m, 9),
        'perm': list(perm),
        'permName': PERM_NAMES[tuple(perm)],
        'agreement': 1.0,
    }


# --------------------------------------------------------------------------- group id

IDENTITY = ((1, 0), (0, 1))


def _frac(x):
    return Fraction(x).limit_denominator(20160) % 1


def signature(ops, reduce_translations=False):
    """Origin-independent signature of a set of space-time symmetries.

    Conjugating by a translation d sends (M, v, tau) to (M, v + (I - M) d, tau),
    so M and tau are invariant and v is meaningful only for M = I.  The raw
    signature therefore keeps v for the pure translations and drops it
    elsewhere.  With `reduce_translations` the set is additionally quotiented by
    its own pure-translation subgroup, which is what identifies a picture living
    on a lattice finer than the saved cell.
    """
    def vec(op):                       # v as a fraction of the cell, not in nodes
        return op.get('vLattice', op['v'])

    trans = [(_frac(vec(op)[0]), _frac(vec(op)[1]), _frac(op['tau']))
             for op in ops if tuple(tuple(int(x) for x in r) for r in op['M']) == IDENTITY]
    if not reduce_translations or not trans:
        trans = [(Fraction(0), Fraction(0), Fraction(0))]
    gamma = sorted({t[2] for t in trans})
    out = set()
    for op in ops:
        mat = tuple(tuple(int(x) for x in r) for r in op['M'])
        tau = _frac(op['tau'])
        if mat == IDENTITY:
            vx, vy = _frac(vec(op)[0]), _frac(vec(op)[1])
            best = min(((vx - a) % 1, (vy - b) % 1, (tau - c) % 1) for a, b, c in trans)
            out.add((mat, best[0], best[1], best[2]))
        else:
            out.add((mat, None, None, min((tau - g) % 1 for g in gamma)))
    return frozenset(out)


def build_group_index(groups):
    raw, red = {}, {}
    for entry in groups['groups']:
        raw.setdefault(signature(entry['ops']), []).append(entry)
        red.setdefault(signature(entry['ops'], True), []).append(entry)
    # Prefer the presentation whose own translation subgroup is trivial.
    for hits in red.values():
        hits.sort(key=lambda e: sum(1 for op in e['ops']
                                    if tuple(tuple(int(x) for x in r) for r in op['M']) == IDENTITY))
    return {'raw': raw, 'reduced': red}


def _describe(entry, extra=None):
    out = {'groupId': entry['id'], 'family': entry['family'], 'orbifold': entry['orbifold'],
           'signature': entry['signature'], 'phaseOrder': entry['phaseOrder']}
    if extra:
        out.update(extra)
    return out


def match_group(group_index, ops, n, m):
    """Name the film group of a symmetry set, first on the saved cell, then --
    if the set carries pure sub-translations -- on the finer lattice they span."""
    sig = signature(ops)
    hits = group_index['raw'].get(sig)
    if hits:
        return _describe(hits[0], {'onFinerLattice': False,
                                   'alsoCatalogued': [h['id'] for h in hits[1:]]})
    sub = [{'v': [op['v'][0] / n, op['v'][1] / n], 'vNodes': list(op['v']),
            'tau': round(op['frames'] / m, 6), 'frames': op['frames']}
           for op in ops
           if tuple(tuple(int(x) for x in r) for r in op['M']) == IDENTITY
           and (op['v'][0] % n or op['v'][1] % n or op['frames'])]
    hits = group_index['reduced'].get(signature(ops, True))
    if hits:
        return _describe(hits[0], {'onFinerLattice': True, 'subTranslations': sub,
                                   'alsoCatalogued': [h['id'] for h in hits[1:]]})
    return {'groupId': None, 'onFinerLattice': None, 'subTranslations': sub,
            'signature': sorted((str(mat), str(vx), str(vy), str(t)) for mat, vx, vy, t in sig)}


# --------------------------------------------------------------------------- png

def write_png(path, rgb):
    h, w, _ = rgb.shape
    raw = b''.join(b'\x00' + rgb[y].tobytes() for y in range(h))

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n'
                 + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                 + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


def render_frame(colour_frame, n, size=512, span=2.2, centre=(0.0, 0.0)):
    """Nearest-node render of one colour frame, `span` lattice lengths across,
    in the renderers' screen convention (x right, y down)."""
    s = (np.arange(size) + 0.5) / size - 0.5
    px, py = np.meshgrid(s * span, s * span, indexing='xy')
    du, dv = from_plane(px, py)
    ui = np.rint((centre[0] + du) * n).astype(np.int64) % n
    vi = np.rint((centre[1] + dv) * n).astype(np.int64) % n
    return PALETTE_RGB[colour_frame[vi, ui]]


def render_strip(colour, n, frames=12, tile=128, span=2.2, centre=(0.0, 0.0)):
    m = colour.shape[0]
    cols = [render_frame(colour[(i * m) // frames], n, size=tile, span=span, centre=centre)
            for i in range(frames)]
    return np.concatenate(cols, axis=1)


# --------------------------------------------------------------------------- notation
#
# The clockwork-colour notation of ../../scott-gray/trefoil/generators.mjs and
# research/generator-notation.md:
#
#     n_k^(sigma)   a gyration of order n whose ANTICLOCKWISE generator advances
#                   the film by k/n of a period and permutes the colours by
#                   sigma, in cycle notation over the colour digits 0 terracotta,
#                   1 teal, 2 sand.  The superscript is omitted when sigma is the
#                   identity and the subscript when k = 0.
#
# THE MASTER RULE, against which every mark below is re-derived and then tested
# node by node: for the rotation by R_m (m sixths of a turn, anticlockwise) about
# a point p, put v = (I - R_m) p.  Then p is a centre of the coloured picture
# exactly when v is in the picture's own translation lattice; v = j b (mod L) for
# a unique j in {0, 1, 2}, the time shift is -m/6 of a period, and
#
#     sigma(c) = (-1)^m c - j  (mod 3).
#
# Nothing here ASSUMES that rule: every (frames, perm) written into a mark is
# read off the entry's measured symmetry list, and `j` is recovered from the
# measured permutation as (-sigma(0)) mod 3.  The rule is then checked, and the
# mark is checked again directly on all N^2 M node-frames.

ROT_SIXTHS = {'R60': 1, 'R120': 2, 'R180': 3, 'R240': 4, 'R300': 5}
COLOUR_NAMES = ['terracotta', 'teal', 'sand']
SUBSCRIPT = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
SUPERSCRIPT = str.maketrans('0123456789()', '⁰¹²³⁴⁵⁶⁷⁸⁹⁽⁾')
VULGAR = {(1, 2): '½', (1, 3): '⅓', (2, 3): '⅔', (1, 4): '¼', (3, 4): '¾',
          (1, 6): '⅙', (5, 6): '⅚', (1, 5): '⅕', (2, 5): '⅖', (3, 5): '⅗',
          (4, 5): '⅘', (1, 8): '⅛', (3, 8): '⅜', (5, 8): '⅝', (7, 8): '⅞'}
TURN_WORDS = {1: 'a sixth of a turn anticlockwise', 2: 'a third of a turn anticlockwise',
              3: 'a half turn', 4: 'two thirds of a turn anticlockwise',
              5: 'five sixths of a turn anticlockwise'}


def cycle_notation(perm):
    """Cycle notation over the colour digits; the empty string for the identity."""
    perm, seen, parts = tuple(perm), set(), []
    for start in range(3):
        if start in seen:
            continue
        if perm[start] == start:
            seen.add(start)
            continue
        cyc, c = [], start
        while c not in seen:
            seen.add(c)
            cyc.append(c)
            c = perm[c]
        parts.append('(' + ''.join(str(x) for x in cyc) + ')')
    return ''.join(parts)


def fraction_words(fr, of_loop=False):
    """'⅚ T' / '⅚ of the loop' for a Fraction of one period."""
    if fr == 0:
        return 'nothing: the clock is empty' if of_loop else 'none'
    glyph = VULGAR.get((fr.numerator, fr.denominator)) or f'{fr.numerator}/{fr.denominator}'
    return f'{glyph} of the loop' if of_loop else f'{glyph} T'


def colour_short(perm):
    perm = tuple(perm)
    if perm == (0, 1, 2):
        return 'unchanged'
    if perm == (1, 2, 0):
        return 'each steps on one'
    if perm == (2, 0, 1):
        return 'each steps back one'
    i, j = [c for c in range(3) if perm[c] != c]
    return f'{COLOUR_NAMES[i]} ↔ {COLOUR_NAMES[j]}'


def colour_text(perm):
    perm = tuple(perm)
    if perm == (0, 1, 2):
        return 'nothing: the colours stay put'
    if perm == (1, 2, 0):
        return 'every colour steps on one'
    if perm == (2, 0, 1):
        return 'every colour steps back one'
    return colour_short(perm)


def colour_clause(perm):
    perm = tuple(perm)
    if perm == (0, 1, 2):
        return 'leave the colours alone'
    if perm == (1, 2, 0):
        return 'step every colour on one'
    if perm == (2, 0, 1):
        return 'step every colour back one'
    i, j = [c for c in range(3) if perm[c] != c]
    return f'exchange {COLOUR_NAMES[i]} and {COLOUR_NAMES[j]}'


def compose_perm(*perms):
    """sigma_1 o sigma_2 o ... , applied right to left, as the atlas convention
    composes symmetries."""
    out = [0, 1, 2]
    for perm in perms:
        out = [out[perm[c]] for c in range(3)]
    return tuple(out)


def lattice_basis(vectors, n):
    """Hermite normal form basis of the sublattice of Z^2 generated by the node
    vectors plus the saved cell (n, 0), (0, n) — i.e. of the coloured picture's
    own translation lattice, written in node units."""
    rows = [[int(v[0]), int(v[1])] for v in vectors] + [[n, 0], [0, n]]
    # First column to a single gcd by repeated Euclid on pairs of rows.
    a = [r[:] for r in rows]
    while True:
        nz = [r for r in a if r[0]]
        if len(nz) <= 1:
            break
        nz.sort(key=lambda r: abs(r[0]))
        pivot = nz[0]
        a = [r if r is pivot or not r[0] else [r[0] - (r[0] // pivot[0]) * pivot[0],
                                               r[1] - (r[0] // pivot[0]) * pivot[1]] for r in a]
    top = next((r for r in a if r[0]), None)
    rest = [r[1] for r in a if not r[0]]
    d = 0
    for y in rest:
        d = math.gcd(d, abs(int(y)))
    if top is None:                                   # cannot happen: (n, 0) is in the list
        return [[n, 0], [0, n]]
    if top[0] < 0:
        top = [-top[0], -top[1]]
    top = [top[0], top[1] % d] if d else top
    return [top, [0, d]]


def rotation_centres(exact, n):
    """Every rotation centre of the coloured picture inside one saved cell, with
    the measured row of each power about it.

    A listed row (P, v) is one point of the torus, and the map c -> (I - P)c is
    |det(I - P)|-to-one on it, so each row names |det(I - P)| centres modulo the
    coarse lattice.  They are enumerated exactly, in Fractions.
    """
    out = {}
    for row in exact:
        msix = ROT_SIXTHS.get(row['name'])
        if msix is None:
            continue
        p = np.array(row['M'], dtype=np.int64)
        d = np.eye(2, dtype=np.int64) - p
        det = int(round(float(np.linalg.det(d))))
        adj = [[int(d[1][1]), -int(d[0][1])], [-int(d[1][0]), int(d[0][0])]]
        for a0 in range(abs(det)):
            for a1 in range(abs(det)):
                vx, vy = row['v'][0] + n * a0, row['v'][1] + n * a1
                cx = Fraction(adj[0][0] * vx + adj[0][1] * vy, det * n) % 1
                cy = Fraction(adj[1][0] * vx + adj[1][1] * vy, det * n) % 1
                out.setdefault((cx, cy), {})[msix] = row
    return out


def _fr_pair(c):
    return [float(c[0]), float(c[1])]


def _sixths(c):
    """The point in sixths of the lattice basis, or None when it does not lie on
    the 1/6 grid (a Gyre turn centre generally does not)."""
    s = [x * 6 for x in c]
    if all(x.denominator == 1 for x in s):
        return [int(x) for x in s]
    return None


def _nearest(c):
    """The translate of c nearest the origin, in plane coordinates.

    Everything about a mark's placement is read off this representative, so a
    centre written as 2/3 and the same centre written as −1/3 sort alike; that
    is what makes the presentation the builder picks reproducible rather than
    dependent on which coset representative came out of the search.
    """
    best, out = 1e9, (0.0, 0.0)
    for a in (-1, 0, 1):
        for b in (-1, 0, 1):
            x, y = to_plane(float(c[0]) + a, float(c[1]) + b)
            d = math.hypot(x, y)
            if d < best - 1e-12:
                best, out = d, (x, y)
    return out


def _distance(c):
    """Physical distance from the origin to the nearest translate of c."""
    return math.hypot(*_nearest(c))


def _angle(c):
    """Angle of the nearest translate east of the screen +x axis, measured
    anticlockwise on screen (y runs down, so the sign of y is flipped)."""
    x, y = _nearest(c)
    return math.atan2(-y, x)


LAYOUT = {
    'alpha': {'chipDeg': 180, 'labelDeg': 180, 'labelR': 100},
    'beta': {'chipDeg': 150, 'labelDeg': 72, 'labelR': 62},
    'gamma': {'chipDeg': 30, 'labelDeg': 95, 'labelR': 64},
    'g': {'chipDeg': 210, 'labelDeg': 150, 'labelR': 96},
    'gSquared': {'chipDeg': 330, 'labelDeg': 30, 'labelR': 96},
}


def rotation_mark(name, glyph, centre, row, n, m, note=''):
    """One coin-and-chip mark, in the shape `trefoil/generators.mjs` exports."""
    msix = ROT_SIXTHS[row['name']]
    order = 6 // math.gcd(msix, 6)
    frames, perm = int(row['frames']), tuple(row['perm'])
    if frames * order % m:
        raise ValueError(f'{name}: {frames} frames is not a whole k/{order} of {m}')
    k = frames * order // m
    fr = Fraction(frames, m)
    cyc = cycle_notation(perm)
    sub = str(k) if k else None
    base = str(order)
    symbol = base + (sub.translate(SUBSCRIPT) if sub else '') + cyc.translate(SUPERSCRIPT)
    html = base + (f'<sub>{sub}</sub>' if sub else '') + (f'<sup>{cyc}</sup>' if cyc else '')
    ascii_ = base + (f'_{sub}' if sub else '') + (f'^{cyc}' if cyc else '')
    deg = 60 * msix
    turn_words = TURN_WORDS[msix]
    where = note or 'the marked point'
    mark = {
        'name': name, 'glyph': glyph, 'kind': 'rotation', 'order': order, 'k': k, 'n': order,
        'centre': _fr_pair(centre), 'centreSixths': _sixths(centre),
        'centreExact': [[centre[0].numerator, centre[0].denominator],
                        [centre[1].numerator, centre[1].denominator]],
        'turn': [list(r) for r in row['M']], 'op': row['name'], 'degrees': deg, 'msixths': msix,
        'v': list(row['v']), 'frames': frames, 'sixths': (frames * 6 // m) if frames * 6 % m == 0 else None,
        'timeFraction': [fr.numerator, fr.denominator],
        'perm': list(perm), 'cycle': cyc, 'j': (-perm[0]) % 3,
        'symbol': symbol, 'html': html, 'ascii': ascii_,
        'base': base, 'sub': sub, 'sup': cyc or None,
        'rotationShort': f'{deg}°' if deg == 180 else f'{deg}° ↺',
        'timeShort': fraction_words(fr),
        'colourShort': colour_short(perm),
        'rotationText': f'{turn_words}, about {where}',
        'timeText': fraction_words(fr, of_loop=True),
        'colourText': colour_text(perm),
        'reading': f'turn {turn_words} about {where}, '
                   + ('with no waiting at all' if frames == 0
                      else f'run the film on {fraction_words(fr, of_loop=True)}')
                   + f', and {colour_clause(perm)}',
    }
    mark.update(LAYOUT.get(name, {'chipDeg': 180, 'labelDeg': 180, 'labelR': 96}))
    return mark


def translation_mark(name, glyph, vec, row, n, m, side=-1, lead=False, ascii_base='tau'):
    """A plain-arrow mark: a translation of the picture, with no dial when it
    carries no wait at all."""
    frames, perm = int(row['frames']), tuple(row['perm'])
    fr = Fraction(frames, m)
    cyc = cycle_notation(perm)
    symbol = glyph + cyc.translate(SUPERSCRIPT)
    return {
        'name': name, 'glyph': glyph, 'kind': 'translation', 'order': None, 'k': None, 'n': None,
        'vector': _fr_pair(vec), 'vectorSixths': _sixths(vec),
        'vectorExact': [[vec[0].numerator, vec[0].denominator], [vec[1].numerator, vec[1].denominator]],
        'turn': [[1, 0], [0, 1]], 'op': '1', 'degrees': 0, 'msixths': 0,
        'v': list(row['v']), 'frames': frames,
        'sixths': (frames * 6 // m) if frames * 6 % m == 0 else None,
        'timeFraction': [fr.numerator, fr.denominator],
        'perm': list(perm), 'cycle': cyc, 'j': (-perm[0]) % 3,
        'symbol': symbol, 'html': glyph + (f'<sup>{cyc}</sup>' if cyc else ''),
        'ascii': ascii_base + (f'^{cyc}' if cyc else ''),
        'base': glyph, 'sub': None, 'sup': cyc or None,
        'side': side, 'lead': lead,
        'rotationShort': 'slide, one motif' if lead else 'slide',
        'timeShort': fraction_words(fr),
        'colourShort': colour_short(perm),
        'rotationText': 'no turn at all — a slide of one step of the picture’s own lattice',
        'timeText': fraction_words(fr, of_loop=True),
        'colourText': colour_text(perm),
        'reading': 'slide the picture by one step of its own lattice, '
                   + ('with no waiting at all' if frames == 0
                      else f'run the film on {fraction_words(fr, of_loop=True)}')
                   + f', and {colour_clause(perm)}',
    }


def compose_marks(marks, n, m):
    """The product of the marks in order, as a motion / wait / recolouring."""
    mat = np.eye(2, dtype=np.int64)
    vec = np.zeros(2, dtype=np.int64)
    frames, perms = 0, []
    for mk in marks:
        p = np.array(mk['turn'], dtype=np.int64)
        vec = vec + mat @ np.array(mk['v'], dtype=np.int64)
        mat = mat @ p
        frames += mk['frames']
        perms.append(tuple(mk['perm']))
    return {'M': [[int(x) for x in r] for r in mat], 'v': [int(vec[0]) % n, int(vec[1]) % n],
            'frames': frames % m, 'periods': frames / m, 'perm': list(compose_perm(*perms))}


def verify_mark(colour, n, m, mark):
    """Re-test a mark on every saved node-frame: colour(M x + v, t + frames)
    must equal perm(colour(x, t)) exactly, with no tolerance anywhere."""
    p = np.array(mark['turn'], dtype=np.int64)
    v = np.array(mark['v'], dtype=np.int64) % n
    ys, xs = np.meshgrid(np.arange(n), np.arange(n), indexing='ij')
    q = (np.tensordot(p, np.stack([xs, ys]), axes=(1, 0)) + v[:, None, None]) % n
    lhs = np.roll(colour, -int(mark['frames']), axis=0)[:, q[1], q[0]]
    rhs = np.array(mark['perm'], dtype=np.int8)[colour]
    return int(np.count_nonzero(lhs != rhs))


def centre_classes(centres, n, free=None, limit=512):
    """The whole periodic set of rotation centres in one saved cell, so the page
    can put a mark at every centre in view and not only at the generators.

    Each class carries its order, where it sits, its class j in the colour
    homomorphism, and one compact row per power: [m sixths, frames, perm].
    """
    out = []
    for c, rows in centres.items():
        msixths = sorted(rows)
        order = len(msixths) + 1
        out.append({
            'order': order,
            'at': _fr_pair(c),
            'atSixths': _sixths(c),
            'latticeClass': _lattice_class(c, free),
            'rows': [[msix, int(rows[msix]['frames']),
                      ''.join(str(x) for x in rows[msix]['perm']),
                      (-int(rows[msix]['perm'][0])) % 3]
                     for msix in msixths],
        })
    out.sort(key=lambda r: (-r['order'], round(_distance(r['at']), 9), r['at']))
    truncated = max(0, len(out) - limit)
    return {'rule': 'the rotation by m sixths about this centre shifts the film by -m/6 of a '
                    'period and recolours by sigma(c) = (-1)^m c - j (mod 3), where j is the '
                    'class of (I - R_m) p in the picture lattice modulo the coarse lattice; '
                    'rows are [m sixths, frames, perm, j]',
            'cellRepeat': 'the coarse lattice of the saved cell: one unit of marks per cell',
            'classes': out[:limit], 'truncated': truncated}


def build_marks(kind, cand, exact, n, m, colour):
    """The per-entry generator data the pages' marks need.

    Everything is derived from `exact`, the entry's own measured symmetry list,
    and then re-verified node by node.  Returns
    (marks, relation, centres, notes) — `marks` empty when no presentation of
    the measured group could be built.
    """
    notes = []
    index = {(row['name'], (row['v'][0] % n, row['v'][1] % n)): row for row in exact}
    centres = rotation_centres(exact, n)

    def row_at(op_name, centre):
        """The measured row for the rotation `op_name` about `centre`, or None."""
        p = np.array(dict(POINT_OPS)[op_name], dtype=np.int64)
        d = np.eye(2, dtype=np.int64) - p
        vx = Fraction(int(d[0][0])) * centre[0] + Fraction(int(d[0][1])) * centre[1]
        vy = Fraction(int(d[1][0])) * centre[0] + Fraction(int(d[1][1])) * centre[1]
        vxn, vyn = vx * n, vy * n
        if vxn.denominator != 1 or vyn.denominator != 1:
            return None
        return index.get((op_name, (int(vxn) % n, int(vyn) % n)))

    # ---- the translations of the picture, from the measured pure translations.
    pure = [row for row in exact if row['name'] == '1']
    basis = lattice_basis([row['v'] for row in pure], n)
    trans = []
    for vec_nodes in basis:
        vec = (Fraction(int(vec_nodes[0]), n), Fraction(int(vec_nodes[1]), n))
        row = index.get(('1', (int(vec_nodes[0]) % n, int(vec_nodes[1]) % n)))
        if row is None:                                # a whole cell: trivial on the torus
            row = {'name': '1', 'M': [[1, 0], [0, 1]], 'v': [0, 0], 'frames': 0, 'perm': [0, 1, 2]}
        trans.append((vec, row))

    # The free translation: the generator of the picture's lattice that is not a
    # whole cell of the saved one.  For Trefoil this is b, and it is what gives
    # the centres their class j.
    free_pairs = [(vec, row) for vec, row in trans
                  if vec[0].denominator > 1 or vec[1].denominator > 1]
    free = free_pairs[0][0] if free_pairs else None

    marks, relation = [], None
    if kind == 'trefoil':
        sixfold = sorted((c for c, rows in centres.items() if len(rows) == 5),
                         key=lambda c: (round(_distance(c), 9), abs(_angle(c))))
        threefold = [c for c, rows in centres.items() if sorted(rows) == [2, 4]]
        twofold = [c for c, rows in centres.items() if sorted(rows) == [3]]
        for ca in sixfold[:6]:
            alpha = rotation_mark('alpha', 'α', ca, row_at('R60', ca), n, m,
                                  note='a sixfold centre of the pattern')
            betas = sorted(threefold, key=lambda c: (round(_distance_between(c, ca), 9),
                                                     abs(_angle_between(c, ca))))
            gammas = sorted(twofold, key=lambda c: round(_distance_between(c, ca), 9))
            for cb in betas:
                rb = row_at('R120', cb)
                if rb is None:
                    continue
                beta = rotation_mark('beta', 'β', cb, rb, n, m)
                for cg in gammas:
                    rg = row_at('R180', cg)
                    if rg is None:
                        continue
                    gamma = rotation_mark('gamma', 'γ', cg, rg, n, m)
                    rel = compose_marks([alpha, beta, gamma], n, m)
                    if rel['M'] == [[1, 0], [0, 1]] and rel['v'] == [0, 0] \
                            and rel['frames'] == 0 and rel['perm'] == [0, 1, 2]:
                        marks = [alpha, beta, gamma]
                        relation = {'product': 'alpha . beta . gamma', 'motion': 'identity',
                                    'periods': rel['periods'], 'perm': rel['perm'],
                                    'holds': True}
                        break
                if marks:
                    break
            if marks:
                break
        if not marks:
            notes.append('trefoil: no 632 presentation with alpha.beta.gamma = 1 in the measured group')
        # tau: the translation generator that is not a whole cell — the free
        # slide by one motif, which is the whole point of this page.
        for vec, row in free_pairs[:1]:
            marks.append(translation_mark('tau', 'τ', vec, row, n, m, side=-1, lead=True))
    else:
        wv = np.asarray(cand['w'], dtype=np.int64)
        w = [int(x) % n for x in wv]
        g_row = index.get(('R240', (w[0], w[1])))
        w2 = (wv + S3ROT @ wv) % n
        g2_row = index.get(('R120', (int(w2[0]), int(w2[1]))))
        # p = (I - S)^-1 w / N = (2 I + S) w / (3 N), exactly, in Fractions.
        q = S3INV @ wv
        p = (Fraction(int(q[0]), 3 * n) % 1, Fraction(int(q[1]), 3 * n) % 1)
        if g_row and g2_row:
            g = rotation_mark('g', 'g', p, g_row, n, m, note='the turn centre p')
            g2 = rotation_mark('gSquared', 'g²', p, g2_row, n, m, note='the same centre p')
            rel = compose_marks([g, g, g], n, m)
            marks = [g, g2]
            relation = {'product': 'g . g . g', 'motion': 'identity' if rel['M'] == [[1, 0], [0, 1]]
                        and rel['v'] == [0, 0] else 'not the identity',
                        'periods': rel['periods'], 'perm': rel['perm'],
                        'holds': rel['M'] == [[1, 0], [0, 1]] and rel['v'] == [0, 0]
                        and rel['frames'] == 0 and rel['perm'] == [0, 1, 2]}
        else:
            notes.append('gyre: the third-turn about p is not in the measured list')
        for i, (vec, row) in enumerate(trans):
            marks.append(translation_mark(f'tau{i + 1}', f'τ{"₁₂"[i]}', vec, row, n, m,
                                          side=-1 if i == 0 else 1, lead=(i == 0),
                                          ascii_base=f'tau{i + 1}'))

    for mk in marks:
        mk['violations'] = verify_mark(colour, n, m, mk)
        # The master rule, checked rather than assumed.
        expected = [((-c if mk['msixths'] % 2 else c) - mk['j']) % 3 for c in range(3)]
        mk['masterRule'] = expected == list(mk['perm'])
        if m % 6 == 0:
            mk['masterRuleTime'] = bool((mk['frames'] * 6) % m == 0
                                        and (mk['frames'] * 6 // m) % 6 == (-mk['msixths']) % 6)
        else:
            mk['masterRuleTime'] = None
    bad = [mk['name'] for mk in marks if mk['violations']]
    if bad:
        notes.append(f'generators failing the node test: {", ".join(bad)}')
    return marks, relation, centre_classes(centres, n, free), notes


def _lattice_class(c, free):
    """Which class of the picture lattice modulo the coarse lattice the point
    lies in — for Trefoil, the j of research/generator-notation.md section 4 —
    or None when the picture has no free translation, or the point is not in it."""
    if free is None:
        return None
    for j in range(12):
        if (c[0] - j * free[0]) % 1 == 0 and (c[1] - j * free[1]) % 1 == 0:
            return j
    return None


def _distance_between(c, d):
    return _distance((c[0] - d[0], c[1] - d[1]))


def _angle_between(c, d):
    return _angle((c[0] - d[0], c[1] - d[1]))


def entry_symbol(marks):
    """The picture's clockwork-colour symbol: the gyration marks in order, then
    the free translations after a centre dot."""
    turns = [mk for mk in marks if mk['kind'] == 'rotation']
    slides = [mk for mk in marks if mk['kind'] == 'translation']
    head = ' '.join(mk['symbol'] for mk in turns)
    tail = ' '.join(mk['symbol'] for mk in slides)
    join = ' · ' if head and tail else ''
    return {
        'unicode': head + join + tail,
        'html': ' '.join(mk['html'] for mk in turns) + join + ' '.join(mk['html'] for mk in slides),
        'ascii': ' '.join(mk['ascii'] for mk in turns) + (' . ' if head and tail else '')
                 + ' '.join(mk['ascii'] for mk in slides),
    }


# --------------------------------------------------------------------------- per field

def op_matches_swap(mat_inv_b, b):
    """Is M^-1 b congruent to -b (mod L)?  Then the op transposes two colours."""
    return all(abs(((mat_inv_b[i] + b[i]) % 1.0 + 0.5) % 1.0 - 0.5) < 1e-9 for i in range(2))


def op_keeps_colour(mat_inv_b, b):
    return all(abs(((mat_inv_b[i] - b[i]) % 1.0 + 0.5) % 1.0 - 0.5) < 1e-9 for i in range(2))


def field_rotation_centres(ops, n):
    """Threefold centres of the field, in lattice coordinates, modulo one cell.

    A listed op is a coset representative: composing it with a lattice
    translation a gives the rotation x -> M x + v + a, whose centre is
    (I - M)^-1 (v + a).  Those centres, not the translates of one of them, are
    what a Gyre turn centre must avoid: if the field has a threefold screw about
    p carrying T/3 then the three compared values coincide and every node ties.
    """
    centres = set()
    eye = np.eye(2)
    for op in ops:
        mat = np.array(op['M'], dtype=float)
        if abs(np.linalg.det(mat) - 1.0) > 1e-9:
            continue                                    # mirrors have lines, not points
        d = eye - mat
        if abs(np.linalg.det(d)) < 1e-9:
            continue                                    # identity
        # only threefold and sixfold turns can make the Gyre rule degenerate
        order, acc = None, eye.copy()
        for k in range(1, 7):
            acc = acc @ mat
            if np.allclose(acc, eye):
                order = k
                break
        if order not in (3, 6):
            continue
        v = np.array(op['v'], dtype=float)
        for a in range(-2, 3):
            for c in range(-2, 3):
                base = np.linalg.solve(d, v + np.array([a, c], dtype=float))
                centres.add((round(base[0] % 1.0, 9), round(base[1] % 1.0, 9)))
    return sorted(centres)


def min_centre_distance(p, centres):
    """Physical distance from p to the nearest field rotation centre, mod L."""
    best = 1e9
    for cu, cv in centres:
        for a in (-1, 0, 1):
            for b in (-1, 0, 1):
                du, dv = p[0] - (cu + a), p[1] - (cv + b)
                x, y = to_plane(du, dv)
                best = min(best, math.hypot(x, y))
    return best


def gyre_score(q, part_g, part_t):
    """Higher is better.  Chunky (few boundaries but not blank), balanced,
    decisive, speckle-free, and with both halves of the law failing hard.

    A tie in the argmax is fatal -- it breaks the entangled law at that node,
    because the tie-break "lowest index" is not carried along by the relabelling
    -- so it is penalised hard enough to sort every tied centre below every
    tie-free one, but not rejected outright: the law itself is the gate.
    """
    if q['speckle'] > 0.02:
        return -1e9
    return (-1000.0 * q['tieFraction']
            + 2.5 * q['margin']
            - 4.0 * q['areaImbalance']
            - 2.0 * max(0.0, q['boundaryDensity'] - 0.10)
            - 1.5 * max(0.0, 0.06 - q['boundaryDensity'])
            - 120.0 * q['speckle']
            - 1.2 * max(0.0, part_g - 0.45)
            - 1.2 * max(0.0, part_t - 0.45))


def gyre_parts(colour, n, m, w):
    """Agreement of the two halves of the entangled law, best over relabellings,
    and of the whole law (which must be 1)."""
    third = m // 3
    w = np.asarray(w, dtype=np.int64)
    ys, xs = np.meshgrid(np.arange(n), np.arange(n), indexing='ij')
    q = (np.tensordot(S3ROT, np.stack([xs, ys]), axes=(1, 0)) + w[:, None, None]) % n
    c_g = colour[:, q[1], q[0]]
    law = float(np.mean(np.roll(c_g, -third, axis=0) == (colour - 1) % 3))
    part_g = max(float(np.mean(c_g == (colour + k) % 3)) for k in range(3))
    part_t = max(float(np.mean(np.roll(colour, -third, axis=0) == (colour + k) % 3)) for k in range(3))
    no_recolour = float(np.mean(np.roll(c_g, -third, axis=0) == colour))
    wrong_way = float(np.mean(np.roll(c_g, -third, axis=0) == (colour + 1) % 3))
    return law, part_g, part_t, no_recolour, wrong_way


def sweep_gyre(u_field, n, m, centres, coarse=20, keep=6, frame_stride=None, min_dist=0.035,
               seeds=(), separation=0.05):
    """Coarse sweep of turn centres, local refinement, then a full-metric pass.

    `p` must be a rational point of the 1/(3N) grid with i + j = 0 (mod 3) --
    equivalently p = (2 I + S) w / (3 N) for an integer NODE vector w -- so that
    g carries saved nodes to saved nodes and every claim is checked in exact
    integer arithmetic.  The sweep therefore enumerates w, not p.
    """
    if frame_stride is None:
        frame_stride = max(1, m // 24)
    while frame_stride > 1 and ((m // frame_stride) % 3 or (m // 3) % frame_stride):
        frame_stride -= 1
    sub = u_field[::frame_stride] if frame_stride > 1 else u_field
    msub = sub.shape[0]
    u_std = float(u_field.std())
    seen, rough = set(), []

    def rough_score(w):
        p = gyre_centre(w, n)
        dist = min_centre_distance(p, centres)
        if dist < min_dist:
            return None
        c, vals = gyre_colour(sub, n, msub, w)
        q = quality(c, vals, u_std)
        return gyre_score(q, 1.0 / 3.0, 1.0 / 3.0), w, dist

    step = max(1, n // coarse)
    grid = [(wu, wv) for wu in range(0, n, step) for wv in range(0, n, step)]
    for w in list(tuple(int(x) % n for x in s) for s in seeds) + grid:
        if w in seen:
            continue
        seen.add(w)
        r = rough_score(w)
        if r:
            rough.append(r)
    rough.sort(key=lambda r: -r[0])
    # Refine at stride 1 around the best few coarse hits.
    for _, (wu, wv), _ in rough[:max(2, keep // 2)]:
        for du in range(-step, step + 1):
            for dv in range(-step, step + 1):
                w = ((wu + du) % n, (wv + dv) % n)
                if w in seen:
                    continue
                seen.add(w)
                r = rough_score(w)
                if r:
                    rough.append(r)
    rough.sort(key=lambda r: -r[0])

    seed_set = {tuple(int(x) % n for x in s) for s in seeds}
    out, fingerprints, kept_p = [], set(), []
    ordered = ([r for r in rough if r[1] in seed_set]
               + [r for r in rough if r[1] not in seed_set])
    for sc, w, dist in ordered:
        if sc <= -1e8 or len(out) >= keep + len(seed_set):
            break
        p = gyre_centre(w, n)
        # Centres in one orbit of the field's own symmetry group give the same
        # picture up to a motion (same metrics); nearby centres give nearly the
        # same picture.  Keep only well-separated, genuinely distinct ones --
        # except a seeded centre, which is always kept.
        forced = w in seed_set
        if not forced and any(min_centre_distance(p, [q]) < separation for q in kept_p):
            continue
        c, vals = gyre_colour(u_field, n, m, w)
        q = quality(c, vals, u_std)
        law, pg, pt, no_rec, wrong = gyre_parts(c, n, m, w)
        fp = (round(q['margin'], 7), round(q['boundaryDensity'], 7), round(q['areaImbalance'], 7),
              round(pg, 7))
        if fp in fingerprints and not forced:
            continue
        fingerprints.add(fp)
        kept_p.append(p)
        out.append({'w': list(w), 'p': list(p), 'centreDistance': round(dist, 6),
                    'seeded': forced, 'score': round(gyre_score(q, pg, pt), 6), 'metrics': q,
                    'law': law, 'partTurn': round(pg, 6), 'partWait': round(pt, 6),
                    'noRecolour': round(no_rec, 6), 'wrongWay': round(wrong, 6)})
    out.sort(key=lambda r: -r['score'])
    return out


def summarise_failures(stats, exact_ops, n, m):
    """Named failure rows read off the byShift table of the exhaustive search."""
    by = stats['byShift']
    gamma = sorted({op['frames'] for op in exact_ops if op['permName'] == 'identity'})

    def best(pred):
        v, who = -1.0, None
        for (name, parity, mu), arr in by.items():
            perm = next(sig for par, k, sig in PERMS if par == parity and k == mu)
            for s in range(m):
                if not pred(name, perm, s):
                    continue
                if arr[s] > v:
                    v, who = float(arr[s]), {'op': name, 'perm': list(perm),
                                             'permName': PERM_NAMES[perm], 'frames': s,
                                             'tau': round(s / m, 6)}
        return (round(v, 6), who) if who else (None, None)

    rows = []
    def add(label, value, who):
        if value is not None:
            rows.append({'what': label, 'agreement': value, 'best': who})

    v, who = stats['bestNonExact']
    add('the best combination that is NOT a symmetry, over all 12 point ops '
        'x N^2 node translations x M time shifts x 6 recolourings',
        round(float(v), 6), who)
    add('the best non-symmetry with no time shift and a genuine recolouring',
        *best(lambda name, perm, s: s == 0 and perm != (0, 1, 2)))
    add('the best non-symmetry that is a pure time shift, any recolouring',
        *best(lambda name, perm, s: name == '1' and s != 0))
    add('the best non-symmetry using a mirror, any centre, shift and recolouring',
        *best(lambda name, perm, s: name.startswith('M')))
    add('the best non-symmetry realising a transposition with tau in Gamma '
        '(the time shifts the colour-preserving subgroup can absorb)',
        *best(lambda name, perm, s: perm in ((0, 2, 1), (1, 0, 2), (2, 1, 0)) and s in gamma))
    add('the best non-symmetry realising a 3-cycle with tau in Gamma',
        *best(lambda name, perm, s: perm in ((1, 2, 0), (2, 0, 1)) and s in gamma))
    return rows


def colour_group_name(perms):
    p = set(perms)
    if p == {(0, 1, 2)}:
        return 'trivial'
    if p == {(0, 1, 2), (1, 2, 0), (2, 0, 1)}:
        return 'Z3'
    if len(p) == 2:
        return 'Z2'
    if len(p) == 6:
        return 'S3'
    return f'order-{len(p)}'


def analyse_field(rec, group_index, opts):
    """Every catalog entry this one field yields."""
    orbit = rec['orbit']
    cfg = orbit['config']
    ops = rec['ops']
    n, m = int(cfg['N']), int(cfg['M'])
    sha = orbit['fieldSha256']
    t0 = time.time()
    notes = []
    try:
        u_field, n, m = load_u(rec)
    except Exception as exc:                                       # pragma: no cover
        return {'sha': sha, 'entries': [], 'refused': [{'kind': 'both', 'why': f'load failed: {exc}'}],
                'seconds': 0.0}

    u_std = float(u_field.std())
    model = cfg.get('model', 'gray-scott')
    source = {
        'origin': rec['origin'],
        'atlasIds': rec['atlasIds'], 'groupIds': rec['groupIds'], 'groupId': orbit['groupId'],
        'model': model, 'params': cfg.get('params'),
        'N': n, 'M': m, 'period': cfg.get('period'), 'L': cfg.get('L'),
        'fieldUrl': rec['fieldUrl'], 'fieldSha256': sha,
        'fieldByteLength': 4 * 2 * n * n * m, 'fieldValueCount': 2 * n * n * m,
        'fieldEncoding': 'float32-le', 'channels': 2, 'channelUsed': 0,
        'name': orbit.get('name') or orbit.get('patternName'),
        'ranges': orbit.get('ranges'),
        'opCount': len(ops),
    }
    if rec['origin'] == 'atlas':
        source['gate'] = {'gateVersion': GATE_VERSION, 'passed': True,
                          'source': 'scott-gray-wallpaper-atlas-v1',
                          'note': 'the orbit carries the wallpaper atlas’s own offline '
                                  'verification; the colouring is settled by the exhaustive '
                                  'search below, in exact integer arithmetic on the samples'}
        source['provenance'] = {'kind': 'audited-saved-field',
                                'sourceAtlas': 'scott-gray-wallpaper-atlas-v1',
                                'atlasIds': rec['atlasIds']}
    else:
        cand_rec = rec['candidate']
        cert = cand_rec['certificate']
        source['ranges'] = {'u': [float(np.min(u_field)), float(np.max(u_field))]}
        source['gate'] = {'gateVersion': cand_rec['gateVersion'], 'passed': bool(cert['passed']),
                          'verificationCodeSha256': cand_rec['verificationCodeSha256'],
                          'certificateSchema': cert.get('schema'),
                          'trajectoryRms': max(
                              (float(c['trajectoryRms'])
                               for c in (cert.get('independentDynamics') or {}).get('checks', [])),
                              default=None),
                          # A LIMIT, not a measurement: it is the threshold the
                          # certificate's phase relations were required to stay
                          # under, and it sat beside trajectoryRms, which is one.
                          'symmetryLimit': float((cert.get('limits') or {}).get('symmetryMax', 0.0)),
                          'scope': cert.get('scope')}
        source['provenance'] = {'kind': 'equation-search',
                                'method': cand_rec.get('method'),
                                'job': cand_rec['job']['id'], 'batch': rec['batch'],
                                'label': cand_rec['job']['label'],
                                'strategy': cand_rec['job'].get('strategy'),
                                'seed': cand_rec['job'].get('seed'),
                                'searchTools': 'scott-gray/research/colour/'}
        if rec.get('chirality'):
            source['chirality'] = rec['chirality']
        source['name'] = (f"{MODELS[model]['name']} {cand_rec['job']['label']} "
                          f"on {orbit['groupId']}")
    entries, refused = [], []
    centres = field_rotation_centres(ops, n)

    # ---------------------------------------------------------------- gyre
    if m % 3:
        refused.append({'kind': 'gyre', 'why': f'M = {m} is not divisible by 3, so T/3 is not a saved frame'})
    else:
        shipped = (SHIPPED.get(sha) or {}).get('gyre')
        cands = sweep_gyre(u_field, n, m, centres, coarse=opts['coarse'], keep=opts['keep'],
                           seeds=[shipped['w']] if shipped else ())
        exactc = [c for c in cands if c['law'] == 1.0]
        if not cands:
            refused.append({'kind': 'gyre', 'why': 'every turn centre in the sweep was degenerate'})
        elif not exactc:
            lo = min(cands, key=lambda c: c['metrics']['ties'])
            refused.append({'kind': 'gyre',
                            'why': f"no tie-free turn centre: the least-tied of the sweep still has "
                                   f"{lo['metrics']['ties']} tied node-frames "
                                   f"({lo['metrics']['tieFraction']:.2%}), where the argmax is decided by "
                                   f"index order and the relabelling does not carry that along, so the "
                                   f"entangled law only reaches {lo['law']:.9f}"})
        else:
            # Run the exhaustive search on the best few centres and keep the
            # cleanest: one whose colour group does not split, i.e. no exact
            # symmetry realises a recolouring with a time shift the
            # colour-preserving subgroup could absorb.  On a field carrying the
            # R240 @ T/3 screw the rule reduces to one instant (see
            # `gyre_same_instant`) and the split is easy to fall into.
            tried = []
            ranked = sorted(exactc, key=lambda c: (0 if c.get('seeded') else 1, -c['score']))
            for cand in ranked[:4]:
                colour, vals = gyre_colour(u_field, n, m, cand['w'])
                exact_raw, stats = symmetry_search(colour, n, m)
                exact = [e for e in (confirm_exact(colour, n, m, c) for c in exact_raw) if e]
                if len(exact) != len(exact_raw):
                    notes.append(f'gyre: {len(exact_raw) - len(exact)} FFT shortlist entries '
                                 f'failed the integer recheck')
                if not any(e['name'] == 'R240' and e['frames'] == m // 3
                           and e['v'] == [cand['w'][0] % n, cand['w'][1] % n] for e in exact):
                    continue
                gamma = {e['frames'] for e in exact if e['permName'] == 'identity'}
                split = [e for e in exact if e['permName'] != 'identity' and e['frames'] in gamma]
                lattice_only = sum(1 for e in exact if e['permName'] == 'identity') == 1
                # A centre the site already ships wins any tie, so the catalog
                # reproduces the published page rather than replacing it.
                rank = (0 if not split else 1, 0 if lattice_only else 1,
                        0 if cand.get('seeded') else 1, -cand['score'])
                tried.append((rank, cand, colour, exact, stats, vals, split, lattice_only))
                if not split and lattice_only:
                    break
            if not tried:
                refused.append({'kind': 'gyre',
                                'why': 'the entangled generator is not in the exhaustively confirmed set'})
            else:
                tried.sort(key=lambda r: r[0])
                _, best, colour, exact, stats, vals, split, lattice_only = tried[0]
                best['fullyEntangled'] = not split
                best['colourPreservingIsLatticeOnly'] = lattice_only
                best['splitRecolourings'] = [{'op': e['name'], 'v': e['v'], 'frames': e['frames'],
                                              'permName': e['permName']} for e in split]
                best['sameInstant'] = gyre_same_instant(ops, best['w'], n)
                entries.append(build_entry('gyre', source, best, colour, exact, stats, group_index,
                                           n, m, [c for c in cands if c is not best], u_std, vals))
    # ---------------------------------------------------------------- trefoil
    b = B_FRAC
    swap_ops, keep_ops = [], []
    for op in ops:
        mat = np.array(op['M'], dtype=np.int64)
        inv = inv_unimodular(tuple(tuple(int(x) for x in r) for r in op['M'])).astype(float)
        mb = (inv @ np.array(b))
        tau = float(op['tau'])
        v = [float(x) for x in op['v']]
        row = {'M': [[int(x) for x in r] for r in op['M']], 'v': v, 'tau': tau,
               'name': OP_BY_MATRIX.get(tuple(tuple(int(x) for x in r) for r in op['M']), '?')}
        if op_matches_swap(mb, b):
            swap_ops.append(row)
        elif op_keeps_colour(mb, b):
            keep_ops.append(row)
    if n % 3:
        refused.append({'kind': 'trefoil', 'why': f'N = {n} is not divisible by 3, so b is not a whole node'})
    elif not swap_ops:
        refused.append({'kind': 'trefoil',
                        'why': 'the field has no exact symmetry h with h b = -b (mod L), so no transposition'})
    else:
        # tau must land on a saved frame and v on a whole node, or the claim
        # cannot be checked in exact integer arithmetic on the samples.
        def on_grid(o):
            return (abs(o['tau'] * m - round(o['tau'] * m)) < 1e-6
                    and all(abs(x * n - round(x * n)) < 1e-6 for x in o['v']))

        usable = sorted((o for o in swap_ops if on_grid(o)),
                        key=lambda o: (0 if abs(o['tau'] - 0.5) < 1e-9 else 1, abs(o['tau'] - 0.5)))
        colour, vals = trefoil_colour(u_field, n, m)
        ties = tie_count(vals)
        if not usable:
            refused.append({'kind': 'trefoil',
                            'why': 'every swap-giving op has a tau or v off the saved grid'})
        elif ties > 0.25 * colour.size:
            refused.append({'kind': 'trefoil',
                            'why': f'{ties} of {colour.size} node-frames tie ({ties / colour.size:.1%}): '
                                   f'b is a period of the field, so the three compared values coincide'})
        else:
            # The atlas orbits satisfy their ops to the certificate limit
            # (symmetryMax 2e-07 relative), not bit-exactly in float32, so the
            # field test is a tolerance; the exactness that matters is the
            # COLOURING's, and that is settled by the exhaustive search below.
            ys, xs = np.meshgrid(np.arange(n), np.arange(n), indexing='ij')
            rng = float(np.ptp(u_field)) or 1.0
            verified, failed = [], []
            for o in usable:
                p = np.array(o['M'], dtype=np.int64)
                vv = np.rint(np.array(o['v']) * n).astype(np.int64)
                s = int(round(o['tau'] * m))
                q = (np.tensordot(p, np.stack([xs, ys]), axes=(1, 0)) + vv[:, None, None]) % n
                diff = np.abs(np.roll(u_field, -s, axis=0)[:, q[1], q[0]] - u_field)
                row = dict(o, frames=s, maxAbsDiff=float(diff.max()),
                           maxRelDiff=round(float(diff.max()) / rng, 12),
                           differingSamples=int(np.count_nonzero(diff)))
                (verified if row['maxRelDiff'] <= 2e-7 else failed).append(row)
            if not verified:
                refused.append({'kind': 'trefoil',
                                'why': 'every swap-giving op misses on the samples by more than the '
                                       'atlas certificate limit 2e-07: '
                                       + ', '.join(f"{o['name']}@tau={o['tau']:.4f} "
                                                   f"(rel {o['maxRelDiff']:.2e})" for o in failed)})
            else:
                chosen = verified[0]
                exact_raw, stats = symmetry_search(colour, n, m)
                exact = [e for e in (confirm_exact(colour, n, m, c) for c in exact_raw) if e]
                if len(exact) != len(exact_raw):
                    notes.append(f'trefoil: {len(exact_raw) - len(exact)} FFT shortlist entries '
                                 f'failed the integer recheck')
                perms = {tuple(e['perm']) for e in exact}
                if len(perms) != 6:
                    refused.append({'kind': 'trefoil',
                                    'why': f'colour group is {colour_group_name(perms)}, not S3 '
                                           f'({len(exact)} exact symmetries, {ties} ties): no '
                                           f'transposition survives in the coloured picture'})
                else:
                    cand = {'w': None, 'p': None, 'b': list(b),
                            'bNodes': [n // 3, 2 * n // 3],
                            'swapOp': chosen, 'swapOpsVerified': verified,
                            'swapOpsFailed': failed, 'keepOps': keep_ops,
                            'metrics': quality(colour, vals, u_std), 'score': None}
                    entries.append(build_entry('trefoil', source, cand, colour, exact, stats,
                                               group_index, n, m, [], u_std, vals))
    return {'sha': sha, 'entries': entries, 'refused': refused, 'notes': notes,
            'seconds': round(time.time() - t0, 2)}


def build_entry(kind, source, cand, colour, exact, stats, group_index, n, m, runners, u_std, vals):
    perms = {tuple(e['perm']) for e in exact}
    keep = [e for e in exact if e['permName'] == 'identity']
    cp_match = match_group(group_index, keep, n, m)
    pic_match = match_group(group_index, exact, n, m)
    marks, relation, centres, mark_notes = build_marks(kind, cand, exact, n, m, colour)
    sid = f"colour:{kind}:{source['fieldSha256'][:12]}"
    entry = {
        'id': sid,
        'kind': kind,
        'source': source,
        'colouring': {
            'rule': ('colour(x, t) = argmax_k U(g^k x, t + k T/3)' if kind == 'gyre'
                     else 'colour(x, t) = argmax_k U(x + k b, t)'),
            'palette': PALETTE,
        },
        'symmetries': exact,
        'failures': summarise_failures(stats, exact, n, m),
        'colourGroup': colour_group_name(perms),
        'colourGroupOrder': len(perms),
        'colourPreservingGroup': cp_match,
        'pictureGroup': pic_match,
        'exactSymmetryCount': len(exact),
        'metrics': cand['metrics'],
        'generators': marks,
        'generatorRelation': relation,
        'centres': centres,
        'symbol': entry_symbol(marks),
        'cellSixths': 6 if n % 6 == 0 else None,
        'nodesPerSixth': n // 6 if n % 6 == 0 else None,
        'markNotes': mark_notes,
        'thumbnail': f'data/thumbs/{sid.replace(":", "-")}.png',
    }
    entry['featured'] = sid in FEATURED
    if entry['featured']:
        entry['featuredWhy'] = FEATURED[sid]
    ship = (SHIPPED.get(source['fieldSha256']) or {}).get(kind)
    if ship:
        entry['shippedPage'] = dict(ship,
                                    matchesChoice=(kind != 'gyre' or list(ship['w']) == list(cand['w'])))
    if kind == 'gyre':
        entry['colouring'].update({
            'p': cand['p'], 'w': cand['w'],
            'pDenominator': 3 * n,
            'centreDistance': cand['centreDistance'],
            'constraint': ('p = (2 I + S) w / (3 N) for an integer node vector w: p lies on the '
                           '1/(3N) grid and g carries saved nodes to saved nodes'),
        })
        entry['metrics'] = dict(cand['metrics'])
        entry['metrics'].update({'law': cand['law'], 'partTurn': cand['partTurn'],
                                 'partWait': cand['partWait'], 'noRecolour': cand['noRecolour'],
                                 'wrongWay': cand['wrongWay'], 'score': cand['score'],
                                 'fullyEntangled': cand.get('fullyEntangled'),
                                 'colourPreservingIsLatticeOnly':
                                     cand.get('colourPreservingIsLatticeOnly')})
        entry['splitRecolourings'] = cand.get('splitRecolourings', [])
        if cand.get('sameInstant'):
            entry['colouring']['sameInstant'] = cand['sameInstant']
        entry['runnersUp'] = [{'w': r['w'], 'p': [round(x, 6) for x in r['p']],
                               'seeded': r.get('seeded', False),
                               'score': r['score'], 'margin': r['metrics']['margin'],
                               'boundaryDensity': r['metrics']['boundaryDensity'],
                               'areaImbalance': r['metrics']['areaImbalance'],
                               'speckle': r['metrics']['speckle'],
                               'partTurn': r['partTurn'], 'partWait': r['partWait']}
                              for r in runners[:4]]
    else:
        entry['colouring'].update({'b': cand['b'], 'bNodes': cand['bNodes'],
                                   'swapOp': cand['swapOp'],
                                   'swapOpsVerified': cand['swapOpsVerified'],
                                   'swapOpsFailed': cand['swapOpsFailed'],
                                   'keepOps': cand['keepOps'],
                                   'constraint': 'N divisible by 3 so b = (N/3, 2N/3) is a whole node'})
        gamma = sorted({e['frames'] for e in keep})
        swaps = sorted({e['frames'] for e in exact if e['permName'].startswith('(')})
        entry['metrics'] = dict(cand['metrics'])
        entry['metrics'].update({
            'gammaFrames': gamma,
            'swapFrames': swaps,
            'swapEntangled': bool(swaps and all(s not in gamma for s in swaps)),
        })
    return entry


# --------------------------------------------------------------------------- driver

def worker(args):
    rec, group_index, opts = args
    try:
        return analyse_field(rec, group_index, opts)
    except Exception as exc:                                        # pragma: no cover
        import traceback
        return {'sha': rec['orbit']['fieldSha256'], 'entries': [], 'notes': [],
                'refused': [{'kind': 'both', 'why': f'{exc}\n{traceback.format_exc()}'}], 'seconds': 0.0}


SLIM_CERT = ('schema', 'passed', 'gateVersion', 'limits', 'scope', 'verificationSources',
             'verificationCodeSha256', 'spatialRms', 'temporalRms', 'minimum', 'maximum')


def slim_record(rec):
    """Drop everything a worker does not read before the records are handed to
    the process pool: a full certificate is 29 kB and would be pickled once per
    field.  What is kept is exactly what `analyse_field` writes into `source`."""
    cand = rec['candidate']
    cert = cand['certificate']
    rec['candidate'] = {
        'schema': cand['schema'], 'gateVersion': cand['gateVersion'], 'model': cand['model'],
        'groupId': cand['groupId'], 'config': cand['config'], 'period': cand['period'],
        'fieldSha256': cand['fieldSha256'], 'fieldByteLength': cand['fieldByteLength'],
        'verificationCodeSha256': cand['verificationCodeSha256'],
        'method': cand.get('method'), 'job': cand['job'],
        'certificate': dict(
            {k: cert[k] for k in SLIM_CERT if k in cert},
            independentDynamics={'checks': (cert.get('independentDynamics') or {}).get('checks', [])}),
    }
    return rec


def copy_field(rec, orbits_dir, report):
    """Copy an admitted record's field into the catalog's own orbit store,
    byte-identically, and re-hash it on the way in."""
    sha = rec['orbit']['fieldSha256']
    dest = os.path.join(orbits_dir, sha + '.f32')
    if os.path.exists(dest) and os.path.getsize(dest) == os.path.getsize(rec['fieldPath']):
        with open(dest, 'rb') as fh:
            if hashlib.sha256(fh.read()).hexdigest() == sha:
                report['kept'] += 1
                return True
    with open(rec['fieldPath'], 'rb') as fh:
        raw = fh.read()
    got = hashlib.sha256(raw).hexdigest()
    if got != sha:
        report['refused'].append({'job': rec['candidate']['job']['id'], 'expected': sha, 'got': got})
        return False
    os.makedirs(orbits_dir, exist_ok=True)
    with open(dest, 'wb') as fh:
        fh.write(raw)
    report['copied'] += 1
    report['bytes'] += len(raw)
    return True


def shipped_pairs(entries):
    """The chirality pairs the catalog can actually show: two SHIPPED entries of
    one kind whose `source.chirality` names each other."""
    by_key = {(e['kind'], e['source']['fieldSha256']): e for e in entries}
    pairs = set()
    for e in entries:
        chirality = e['source'].get('chirality')
        if not chirality:
            continue
        mate = by_key.get((e['kind'], chirality['partnerSha256']))
        if mate is None:
            continue
        back = (mate['source'].get('chirality') or {}).get('partnerSha256')
        if back == e['source']['fieldSha256']:
            pairs.add(tuple(sorted((e['id'], mate['id']))))
    return pairs


def summarise(entries):
    """The counts block: per kind x model x film group, featured, new vs existing."""
    by = {}
    for e in entries:
        key = f"{e['kind']}|{e['source']['model']}|{e['source']['groupId']}"
        by[key] = by.get(key, 0) + 1
    def tally(pred):
        return {'entries': sum(1 for e in entries if pred(e)),
                'gyre': sum(1 for e in entries if pred(e) and e['kind'] == 'gyre'),
                'trefoil': sum(1 for e in entries if pred(e) and e['kind'] == 'trefoil'),
                'fields': len({e['source']['fieldSha256'] for e in entries if pred(e)}),
                'models': sorted({e['source']['model'] for e in entries if pred(e)}),
                'groups': sorted({e['source']['groupId'] for e in entries if pred(e)}),
                'featured': sum(1 for e in entries if pred(e) and e.get('featured'))}
    return {
        'byKindModelGroup': dict(sorted(by.items())),
        'all': tally(lambda e: True),
        'existing': tally(lambda e: e['source']['origin'] == 'atlas'),
        'new': tally(lambda e: e['source']['origin'] == 'record'),
        'chiralityPairs': len(shipped_pairs(entries)),
        # An entry carries source.chirality for the mirror the SEARCH found; the
        # trim can leave that partner unshipped, and two entries of one kind can
        # each name a different mirror of the same orbit.  Only a mutual link
        # between two shipped entries of the same kind is a pair the pages can
        # put side by side, so that is what the count is — the rest are named
        # here rather than folded into it.
        'chiralityUnpaired': (sum(1 for e in entries if e['source'].get('chirality'))
                              - 2 * len(shipped_pairs(entries))),
        'fullyEntangled': sum(1 for e in entries if e['metrics'].get('fullyEntangled')),
        'latticeOnly': sum(1 for e in entries
                           if e['metrics'].get('colourPreservingIsLatticeOnly')),
        'generatorsVerified': sum(1 for e in entries
                                  if e['generators'] and all(g['violations'] == 0
                                                             for g in e['generators'])),
    }


def round_floats(o, sig=9):
    """Nine significant digits everywhere.  The catalog's exact claims are all
    integers — node vectors, frame counts, permutations, the numerator/
    denominator pairs of every centre — so the floats are for reading and
    drawing, and full float64 repr costs a fifth of the file for digits nobody
    can use."""
    if isinstance(o, float):
        return o if o != o or o in (math.inf, -math.inf) else float('%.*g' % (sig, o))
    if isinstance(o, list):
        return [round_floats(x, sig) for x in o]
    if isinstance(o, dict):
        return {k: round_floats(v, sig) for k, v in o.items()}
    return o


# Prose that is the same on every entry lives at the top level and is named
# here, so the entries carry only what differs.  Each pair is (path, key).
HOISTED = [('source', 'gate', ('scope', 'note')),
           ('source', 'provenance', ('searchTools',)),
           ('centres', None, ('rule', 'cellRepeat')),
           ('colouring', None, ('rule', 'constraint', 'palette'))]


def compact(doc, runners=2):
    """Take the repetition out of the entries, losslessly.

    Six things are hoisted or dropped, each of them recoverable from what is
    left: the six failure captions (a top-level table), the point-operation
    matrix and the derived names on every symmetry row (a top-level table of
    the twelve matrices, and `permName` is the cycle notation of `perm`), the
    standing prose on `gate`, `centres` and `colouring`, the tail of
    `runnersUp`, and float digits past the ninth.  `doc.shape` says so in the
    file itself, so a reader never has to guess.
    """
    labels = []
    for e in doc['entries']:
        for row in e.get('failures', []):
            what = row.pop('what')
            if what not in labels:
                labels.append(what)
            row['label'] = labels.index(what)
        for row in e['symmetries']:
            # `permName` goes too: the permutation itself is the measurement and
            # the page derives its wording from that, so the shorthand was 100 kB
            # of duplicated data on the one file that has a size ceiling. It is
            # still computed, and still used above, for Gamma and for the split
            # recolourings; it is only not shipped on a row that already carries
            # `perm`.
            for key in ('M', 'vLattice', 'permName'):
                row.pop(key, None)
        for block, sub, keys in HOISTED:
            target = e.get(block) or {}
            if sub:
                target = target.get(sub) or {}
            for key in keys:
                target.pop(key, None)
        if e.get('runnersUp'):
            e['runnersUp'] = e['runnersUp'][:runners]
    doc['failureLabels'] = labels
    doc['pointOps'] = {name: [list(r) for r in mat] for name, mat in POINT_OPS}
    doc['shape'] = {
        'symmetryRow': 'colour(M x + v, t + frames) = perm(colour(x, t)); M is '
                       'pointOps[name], v is in whole saved nodes, vLattice is v / N, and '
                       'tau is frames / M.',
        'failureRow': 'label indexes failureLabels; agreement is the best a combination that '
                      'is NOT a symmetry reaches, and best names it.',
        'hoisted': 'colouring.rule, colouring.constraint and colouring.palette are '
                   'colourings[kind].rule, colourings[kind].constraint and palette; '
                   'centres.rule and centres.cellRepeat are notation.centreRule and '
                   'notation.cellRepeat; source.gate.note is gates[source.origin].',
        'floats': 'rounded to nine significant digits; every exact claim is an integer or a '
                  'numerator/denominator pair beside it.',
        'runnersUp': f'at most {runners} alternate turn centres per Gyre entry are listed; the '
                     f'sweep considered more, and the build record has the counts.',
    }
    doc['entries'] = round_floats(doc['entries'])
    return doc


def featured_partners(entries):
    """(kind, fieldSha256) of the chirality partner of every featured entry.

    A featured blurb may say "its mirror is in the catalog too", and the pages
    badge an entry with `mirror partner <group>` only when the partner is
    shipped, so a trim that keeps a featured entry and drops its twin makes the
    page contradict itself.  The pair is protected as a unit."""
    want = set()
    for e in entries:
        chirality = e['source'].get('chirality')
        if e.get('featured') and chirality:
            want.add((e['kind'], chirality['partnerSha256']))
    return want


def select_entries(entries, per_set, max_new=None, report=None):
    """Choose which patterns to ship.

    The explorer's ladder is film group -> equation -> parameter set -> pattern,
    and the search returns as many as twenty orbits of one equation at one
    parameter point on one film group.  They are genuinely distinct orbits, but
    past the first few they are variations on one picture, and every one of them
    costs a megabyte of field on a static site.

    Two knobs, applied in this order.  `per_set` caps one cell, keeping the
    cleanest of it — lowest boundary density, then the most decisive argmax —
    with two extra allowed per Trefoil cell, because a field needs an exact
    symmetry reversing b to carry a Trefoil at all and only a tenth of the
    admitted records do.  `max_new` then takes the head of a ROUND-ROBIN over
    the cells, so a catalog trimmed to fit loses the twentieth pattern of a
    crowded cell before it loses the only pattern of a rare one.

    Entries mined from the wallpaper atlas, anything featured, and the chirality
    partner of anything featured, are never dropped: the first are the catalog
    the site already ships, the second are the pictures a person chose, and the
    third is what keeps a featured pair a pair (see `featured_partners`).
    """
    protected = featured_partners(entries)
    cells, kept = {}, []
    for e in entries:
        if (e['source']['origin'] != 'record' or e.get('featured')
                or (e['kind'], e['source']['fieldSha256']) in protected):
            kept.append(e)
            continue
        key = (e['kind'], e['source']['model'], e['source']['provenance']['label'],
               e['source']['groupId'])
        cells.setdefault(key, []).append(e)
    ranked = []
    for key in sorted(cells):
        rows = sorted(cells[key], key=lambda e: (e['metrics']['boundaryDensity'],
                                                 -e['metrics']['margin'], e['id']))
        limit = len(rows) if per_set <= 0 else per_set + (2 if key[0] == 'trefoil' else 0)
        for rank, e in enumerate(rows[:limit]):
            ranked.append((rank, key, e))
    # Interleave the kinds INSIDE a rank.  Ordering a rank by the cell key alone
    # puts every 'gyre' cell before every 'trefoil' one, so a cut that lands
    # inside rank 0 would take the whole of the scarcer colouring first; with the
    # kinds interleaved the cut costs both in proportion.
    slots, ordered = {}, []
    for rank, key, e in sorted(ranked, key=lambda r: (r[0], r[1])):
        slot = slots.get((rank, key[0]), 0)
        slots[(rank, key[0])] = slot + 1
        ordered.append(((rank, slot, key), e))
    ordered.sort(key=lambda r: r[0])
    ranked = [(k[0], k[2], e) for k, e in ordered]
    rank0 = sum(1 for rank, _, _ in ranked if rank == 0)
    if max_new is not None:
        ranked = ranked[:max(0, max_new)]
    if report is not None:
        # How close the budget came to cutting into rank 0 — the one cut that
        # would empty a (kind, equation, parameter set, group) cell.  Positive
        # headroom is second-and-later patterns the round robin still carried.
        report.clear()
        report.update({
            'rows': len(ordered), 'rank0Rows': rank0, 'taken': len(ranked),
            'headroomOverRank0': len(ranked) - rank0,
            'rank0ByKind': tally_kinds(e for k, e in ordered if k[0] == 0),
            'takenByKind': tally_kinds(e for _, _, e in ranked),
            'protectedPartners': sorted(f'{kind}:{sha[:12]}' for kind, sha in protected),
            'note': 'the round robin over (kind, equation, parameter set, group) cells, '
                    'rank-first and with the kinds interleaved inside a rank; maxNew takes '
                    'its head. headroomOverRank0 < 0 means the cut fell inside rank 0 and a '
                    'cell lost its only pattern.',
        })
    kept.extend(e for _, _, e in ranked)
    return sorted(kept, key=entry_sort_key)


def tally_kinds(entries):
    counts = {}
    for e in entries:
        counts[e['kind']] = counts.get(e['kind'], 0) + 1
    return dict(sorted(counts.items()))


def prune(directory, keep, suffix):
    """Delete files this build did not write.  A rebuild with a tighter budget
    ships fewer entries, and a stale thumbnail or orbit left behind on a static
    site is a file nothing links to and nobody notices growing."""
    if not os.path.isdir(directory):
        return 0
    gone = 0
    for name in sorted(os.listdir(directory)):
        if name.endswith(suffix) and name not in keep:
            os.remove(os.path.join(directory, name))
            gone += 1
    return gone


def write_thumbnails(entries, by_sha, args):
    """One 512-pixel PNG per entry, shrunk until it is inside the ceiling.

    A three-colour picture compresses hard — the largest in the catalog is under
    18 kB — but a very fine one could grow, and a page that has to download a
    hundred of them cannot afford a surprise."""
    thumbs = {'written': 0, 'maxBytes': 0, 'over': []}
    if args.no_thumbs:
        return thumbs
    os.makedirs(THUMB_DIR, exist_ok=True)
    if args.strips:
        os.makedirs(args.strips, exist_ok=True)
    for entry in entries:
        rec = by_sha[entry['source']['fieldSha256']]
        u_field, n, m = load_u(rec)
        if entry['kind'] == 'gyre':
            colour, _ = gyre_colour(u_field, n, m, entry['colouring']['w'])
            centre = tuple(entry['colouring']['p'])
        else:
            colour, _ = trefoil_colour(u_field, n, m)
            centre = (0.0, 0.0)
        name = entry['id'].replace(':', '-')
        path = os.path.join(THUMB_DIR, name + '.png')
        for size in (512, 384, 256, 192):
            write_png(path, render_frame(colour[0], n, size=size, centre=centre))
            if os.path.getsize(path) <= args.thumb_bytes:
                break
        got = os.path.getsize(path)
        thumbs['written'] += 1
        thumbs['maxBytes'] = max(thumbs['maxBytes'], got)
        if got > args.thumb_bytes:
            thumbs['over'].append([entry['id'], got])
        if args.strips:
            write_png(os.path.join(args.strips, name + '-strip.png'),
                      render_strip(colour, n, centre=centre))
    if args.prune:
        thumbs['pruned'] = prune(THUMB_DIR,
                                 {e['id'].replace(':', '-') + '.png' for e in entries}, '.png')
    return thumbs


def entry_sort_key(e):
    """Deterministic order, so the pages' default selection never depends on the
    order the workers happened to finish in: kind, film group, equation, then
    the cleanest picture first, then the id."""
    return (e['kind'], e['source']['groupId'], e['source']['model'],
            round(e['metrics'].get('boundaryDensity', 9.0), 6), e['id'])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--jobs', type=int, default=max(1, (os.cpu_count() or 4) - 2))
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--only', default=None, help='restrict to fields whose sha starts with this')
    ap.add_argument('--coarse', type=int, default=20, help='turn centres per lattice direction in the sweep')
    ap.add_argument('--keep', type=int, default=6, help='sweep survivors rescored on all frames')
    ap.add_argument('--out', default=os.path.join(OUT_DIR, 'colour-atlas.json'))
    ap.add_argument('--strips', default=None, help='directory for 12-frame inspection strips')
    ap.add_argument('--no-thumbs', action='store_true')
    ap.add_argument('--records', action='append', default=[], metavar='DIR',
                    help='a search output directory of admitted records (repeatable)')
    ap.add_argument('--records-limit', type=int, default=0)
    ap.add_argument('--no-atlas', action='store_true', help='skip the wallpaper atlas')
    ap.add_argument('--no-dedupe', action='store_true',
                    help='keep every admitted record, even copies of one orbit')
    ap.add_argument('--orbits-dir', default=os.path.join(OUT_DIR, 'orbits'),
                    help="where admitted records' fields are copied")
    ap.add_argument('--thumb-bytes', type=int, default=40000,
                    help='hard ceiling on one thumbnail, in bytes')
    ap.add_argument('--json-mb', type=float, default=4.5,
                    help='ceiling on the catalog JSON, in megabytes')
    ap.add_argument('--per-set', type=int, default=3,
                    help='patterns kept per (kind, equation, parameter set, film group) for '
                         'search records; lowered automatically until the JSON fits')
    ap.add_argument('--runners', type=int, default=2,
                    help='alternate Gyre turn centres listed per entry')
    ap.add_argument('--no-prune', dest='prune', action='store_false',
                    help='keep thumbnails and orbit files this build did not write')
    args = ap.parse_args(argv)

    check_point_ops()
    t0 = time.time()
    groups = load_groups()
    group_index = build_group_index(groups)

    fields, atlas_sha = [], None
    if not args.no_atlas:
        atlas = load_atlas()
        atlas_sha = hashlib.sha256(open(ATLAS, 'rb').read()).hexdigest()
        fields = distinct_hex_fields(atlas)

    skipped, dropped, pairs = [], [], []
    records = []
    if args.records:
        records = load_records(args.records, skipped)
        print(f'{len(records)} admitted records in {len(args.records)} directories '
              f'({len(skipped)} skipped)', file=sys.stderr)
        if args.records_limit:
            records = records[:args.records_limit]
        if not args.no_dedupe:
            records, dropped, pairs = dedupe_records(records)
        records = [slim_record(r) for r in records]
    fields = fields + records

    if args.only:
        fields = [f for f in fields if f['orbit']['fieldSha256'].startswith(args.only)]
    if args.limit:
        fields = fields[:args.limit]
    print(f'{len(fields)} distinct triangular-six fields, {args.jobs} workers', file=sys.stderr)

    opts = {'coarse': args.coarse, 'keep': args.keep}
    results = []
    if args.jobs > 1:
        with ProcessPoolExecutor(max_workers=args.jobs) as ex:
            for i, res in enumerate(ex.map(worker, [(f, group_index, opts) for f in fields], chunksize=1)):
                results.append(res)
                print(f'  [{i + 1}/{len(fields)}] {res["sha"][:12]} '
                      f'{len(res["entries"])} entries {res["seconds"]}s', file=sys.stderr)
    else:
        for i, f in enumerate(fields):
            res = worker((f, group_index, opts))
            results.append(res)
            print(f'  [{i + 1}/{len(fields)}] {res["sha"][:12]} '
                  f'{len(res["entries"])} entries {res["seconds"]}s', file=sys.stderr)

    entries = [e for r in results for e in r['entries']]
    refused = [dict(r, sha=res['sha']) for res in results for r in res['refused']]
    notes = [f"{res['sha'][:12]}: {t}" for res in results for t in res.get('notes', [])]
    entries.sort(key=entry_sort_key)

    builder_sha = hashlib.sha256(open(os.path.abspath(__file__), 'rb').read()).hexdigest()

    def make_doc(chosen, field_report, thumbs):
        return {
        'schema': 'colour-atlas-v1',
        'gateVersion': GATE_VERSION,
        'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'source': {'atlas': None if args.no_atlas else 'scott-gray/data/wallpaper-atlas.json',
                   'atlasSha256': atlas_sha,
                   'groups': 'scott-gray/wallpaper-groups.json',
                   'groupsSha256': hashlib.sha256(open(GROUPS, 'rb').read()).hexdigest(),
                   'recordDirs': [os.path.relpath(os.path.abspath(d), DOCS) for d in args.records],
                   'orbitStore': 'colour/data/orbits'},
        'palette': PALETTE,
        'models': MODELS,
        'colourings': {
            'gyre': {'name': 'Gyre', 'colourGroup': 'Z3',
                     'rule': 'colour(x, t) = argmax_k U(g^k x, t + k T/3)',
                     'blurb': 'A third-turn about a point that is NOT a symmetry centre of the '
                              'wave, read three times a third of a period apart. The turn and '
                              'the wait are inseparable: either alone destroys the picture.'},
            'trefoil': {'name': 'Trefoil', 'colourGroup': 'S3',
                        'rule': 'colour(x, t) = argmax_k U(x + k b, t)',
                        'blurb': 'Three copies of one instant, slid by the threefold offset b. '
                                 'Sliding cycles the colours with no wait at all; a symmetry of '
                                 'the wave that reverses b turns into a colour swap, and the '
                                 'colour group is the whole of S3.'},
        },
        'notation': {
            'scheme': 'clockwork-colour',
            'reference': 'scott-gray/trefoil/generators.mjs, notation.html',
            'symbol': 'n_k^(sigma): a gyration of order n whose ANTICLOCKWISE generator advances '
                      'the film by k/n of a period and permutes the colours by sigma, in cycle '
                      'notation over the digits 0 terracotta, 1 teal, 2 sand. The superscript is '
                      'omitted when sigma is the identity and the subscript when k is 0.',
            'entrySymbol': "entry.symbol is built from entry.generators — the marks the page "
                           "draws — in the order they are listed, with the free translations "
                           "after a centre dot. It is a presentation, not an orbifold symbol: "
                           "the orbifold of the coloured picture is entry.pictureGroup.orbifold, "
                           "and each mark's subscript is the time numerator of THAT element, not "
                           "of the smallest anticlockwise rotation about its centre.",
            'masterRule': 'sigma(c) = (-1)^m c - j (mod 3) for a rotation by m sixths, where j '
                          'is the class of the centre: (I - R_m) p is j b modulo the coarse '
                          'lattice. What masterRule tests is the form — that sigma is '
                          'c -> +/-c + const with the sign set by the parity of m — with j read '
                          'off the permutation itself (j = -sigma(0) mod 3) rather than '
                          'recomputed from the centre, so the geometric half of the rule is '
                          'stated here and not checked here. masterRuleTime is a test: '
                          'frames*6/M == -m (mod 6). Every mark is derived from the measured '
                          'symmetry list and then re-tested at all N^2 M node-frames.',
        },
        'gates': {
            'atlas': 'the orbit carries the wallpaper atlas\u2019s own offline verification; the '
                     'colouring is settled by the exhaustive search below, in exact integer '
                     'arithmetic on the samples',
            'record': 'the record carries the equation search\u2019s certificate, re-derived '
                      'from the exported bytes by an independent integration at two timestep '
                      'limits; the colouring is settled the same way',
        },
        'counts': summarise(chosen),
        'fieldStore': {'copied': field_report['copied'], 'alreadyPresent': field_report['kept'],
                       'bytes': field_report['bytes'], 'pruned': field_report.get('pruned', 0),
                       'note': 'admitted record fields, byte-identical, named by their sha256'},
        'thumbnails': {'written': thumbs['written'], 'maxBytes': thumbs['maxBytes'],
                       'ceiling': args.thumb_bytes, 'over': thumbs['over'],
                       'pruned': thumbs.get('pruned', 0)},
        'records': {'admitted': len(records) + len(dropped), 'deduplicated': len(records),
                    'duplicatesDropped': len(dropped), 'chiralityPairs': len(pairs),
                    'skipped': len(skipped), 'mined': len(fields),
                    'perParameterSet': per_set, 'maxNew': max_new,
                    'buildRecord': os.path.basename(build_out)},
        'provenance': {'builder': 'docs/colour/tools/build-colour-catalog.py',
                       'builderSha256': builder_sha,
                       'date': time.strftime('%Y-%m-%d', time.gmtime()),
                       'seconds': round(time.time() - t0, 1)},
        'entries': chosen,
    }

    # --------------------------------------------- how many patterns per set fit
    build_out = os.path.join(os.path.dirname(args.out), 'colour-atlas-build.json')
    blank = {'copied': 0, 'kept': 0, 'bytes': 0}
    blank_thumbs = {'written': 0, 'maxBytes': 0, 'over': []}
    selection = {}
    def trial(per_set, max_new):
        chosen = select_entries(entries, per_set, max_new, report=selection)
        doc = compact(make_doc(copy.deepcopy(chosen), blank, blank_thumbs), args.runners)
        size = len(json.dumps(doc, separators=(',', ':')))
        print(f'  per-set {per_set}'
              + (f', at most {max_new} new' if max_new is not None else '')
              + f': {len(chosen)} entries, {size / 1e6:.2f} MB', file=sys.stderr)
        return chosen, size

    per_set, max_new = args.per_set, None
    while True:
        chosen, size = trial(per_set, None)
        if size <= args.json_mb * 1e6 or per_set <= 1:
            break
        per_set -= 1
    # Still over at one pattern per set?  Take the head of the round robin, so
    # what goes is always the most redundant thing left.
    floor = sum(1 for e in entries if e['source']['origin'] == 'record' and e.get('featured'))
    max_new = sum(1 for e in chosen if e['source']['origin'] == 'record')
    while size > args.json_mb * 1e6 and max_new > floor:
        max_new = max(floor, int(max_new * 0.92) - 1)
        chosen, size = trial(per_set, max_new)
    if selection.get('headroomOverRank0', 0) < 0:
        print(f"WARNING: the budget cut {-selection['headroomOverRank0']} rank-0 patterns; "
              'a parameter set now ships nothing', file=sys.stderr)

    # A featured entry's chirality partner is protected from the trim, but the
    # partner has to have been mined in the first place — a dedupe can retire
    # it.  Say so here rather than letting a blurb promise a mirror the pages
    # cannot show.
    chosen_keys = {(e['kind'], e['source']['fieldSha256']) for e in chosen}
    orphaned = sorted(f'{kind}:{sha[:12]}' for kind, sha in featured_partners(chosen)
                      if (kind, sha) not in chosen_keys)
    if orphaned:
        notes.append('featured entries whose chirality partner is NOT shipped: '
                     + ', '.join(orphaned))
        print(f'WARNING: featured chirality partner missing: {", ".join(orphaned)}',
              file=sys.stderr)

    # ------------------------------------------------- the fields the pages load
    by_sha = {f['orbit']['fieldSha256']: f for f in fields}
    field_report = {'copied': 0, 'kept': 0, 'bytes': 0, 'refused': []}
    for sha in sorted({e['source']['fieldSha256'] for e in chosen}):
        rec = by_sha[sha]
        if rec['origin'] == 'record':
            copy_field(rec, args.orbits_dir, field_report)
    if field_report['refused']:
        raise SystemExit(f'field copy refused: {field_report["refused"]}')
    if args.prune:
        field_report['pruned'] = prune(
            args.orbits_dir,
            {e['source']['fieldSha256'] + '.f32' for e in chosen
             if e['source']['origin'] == 'record'}, '.f32')

    # ---------------------------------------------------------------- pictures
    thumbs = write_thumbnails(chosen, by_sha, args)

    doc = compact(make_doc(chosen, field_report, thumbs), args.runners)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w') as fh:
        json.dump(doc, fh, separators=(',', ':'))
    with open(build_out, 'w') as fh:
        json.dump({'schema': 'colour-atlas-build-v1', 'catalog': os.path.basename(args.out),
                   'generated': doc['generated'], 'builderSha256': builder_sha,
                   'recordDirs': doc['source']['recordDirs'],
                   'perParameterSet': per_set, 'maxNew': max_new,
                   'roundRobin': selection,
                   'minedFields': len(fields), 'entriesMined': len(entries),
                   'entriesShipped': len(chosen),
                   'duplicatesDropped': dropped, 'chiralityPairs': pairs,
                   'skippedRecords': skipped, 'refused': refused, 'notes': notes,
                   'notShipped': sorted(e['id'] for e in entries
                                        if e['id'] not in {c['id'] for c in chosen})},
                  fh, separators=(',', ':'))
    size = os.path.getsize(args.out)
    print(f'wrote {args.out} ({size / 1e6:.2f} MB) and {build_out} '
          f'({os.path.getsize(build_out) / 1e6:.2f} MB) in {time.time() - t0:.1f}s', file=sys.stderr)
    if size > args.json_mb * 1e6:
        print(f'WARNING: catalog is {size / 1e6:.2f} MB, over the {args.json_mb} MB budget',
              file=sys.stderr)
    if thumbs['over']:
        print(f"WARNING: {len(thumbs['over'])} thumbnails over {args.thumb_bytes} bytes",
              file=sys.stderr)
    return doc


if __name__ == '__main__':
    main()
