#!/usr/bin/env python3
"""Build the two-colour (black and white) catalog `monochrome-atlas-v2`.

A monochrome picture of a saved orbit U(x, t) is the SIGN of a difference field

    w(x, t) = U(x, t) - (U o s)(x, t),        s an involution of the lattice
    w(x, t) = U(x, t) - U(x, t + T/2),        the universal half-period rule
    w(x, t) = U(x, t) - median(U),            the plain threshold (no antisymmetry)

drawn white where w > 0 and black where w < 0.  The point of the first family is
an algebraic identity: if s is an involution (s o s = the identity modulo the
lattice) then

    w(s x, t) = U(s x, t) - U(s s x, t) = -(U(x, t) - U(s x, t)) = -w(x, t)

EXACTLY, for any field whatsoever and in floating point too, because a - b and
b - a are exact negations in IEEE arithmetic.  So s swaps black and white by
construction, and the picture is a genuine two-colour (antisymmetry) pattern
rather than a decorated one.  Everything else -- what else swaps, what
preserves -- is measured, never assumed.

One fact discovered by building this and worth stating up front: if (s, T/2) is
an exact spacetime symmetry of the field (U(s x, t + T/2) = U(x, t)) then

    U(s x, t) = U(x, t - T/2)   =>   w_s(x, t) = U(x, t) - U(x, t + T/2)

identically, so EVERY such rule is the half-period rule wearing a different hat.
That is why `../../scott-gray/plume-monochrome/` and `../../scott-gray/weave-monochrome/`
can say that three rules "are the same function".  The pictures that are NOT the
half-period rule are the ones whose s is *not* a symmetry of the field at all --
the monochrome analogue of `../../scott-gray/gyre/`'s turn about a centre that is
not a symmetry centre.  Both families are mined here; the coincidences are
recorded on the surviving entry as `rule.sameAs`.

Two tiers, and they are not the same claim (`entry.tier`):

    strict    the rule's involution s is an exact SPACETIME symmetry of the field,
              U(s x, t + T/2) = U(x, t).  Then s alone swaps the inks, waiting T/2
              alone swaps them, and the two together preserve them: a genuine
              two-colour spacetime group.  By the identity above every such rule
              draws the half-period picture, so a field has exactly ONE strict
              picture or none at all -- never two.
    broad     s is a FREE involution: it swaps the inks by the algebra above and
              by nothing else -- not because it is a symmetry of the field.  Each
              frozen frame is a two-colour wallpaper pattern.  Several per field,
              all different.  This says NOTHING about the half-period wait: on
              the phase-symmetric equations U(x, t + T/2) = -U(x, t) identically,
              so the wait exchanges the inks of a free involution's picture too,
              and `laws.halfPeriod` is where that is measured, per entry.  The
              tier is a fact about s against the field, not about the picture.
    control   the threshold rule, which carries no antisymmetry at all.

Sources
    the wallpaper atlas    every distinct field of ../../scott-gray/data/wallpaper-atlas.json
                           (720 records), square and hexagonal, with the union of
                           the ops every film group lists for it
    --records DIR          one folder per admitted offline-search candidate
                           (`candidate.json` + its Float32 payload), the shape
                           ../../scott-gray/research/colour/out/*/ and
                           ../../scott-gray/research/monochrome/out/modal/*/ write

Fields that are the same orbit reached twice -- a translation, a rotation or a
phase shift apart -- are collapsed onto one picture by `motion_match`, and every
film-group and family placement of every member is kept on the survivor.  Record
fields cost real repository bytes, so only a chosen spread of them is copied in
(`--orbit-mb`); the rest are listed in `recordsOnDisk` with where they live.

Everything measured is measured on the saved nodes in integer index arithmetic:
the FFT is used only to shortlist, and every shortlisted symmetry is confirmed
by a direct comparison of arrays.  The quality gate is the exception, and
deliberately so: it is measured on the spectrally DOUBLED grid the viewers draw,
with the boolean `w > 0` the viewers draw, because on the node grid the exact
zero set of a colour-reversing mirror line counts as speckle and the Weave --
which is published as speckle-free -- scores 0.084 instead of 0.

Usage
    python3 build-monochrome-catalog.py [--records DIR ...] [--jobs N] [--limit N]
                                        [--only SHA_PREFIX] [--sheets DIR]
                                        [--strips DIR] [--out PATH] [--no-thumbs]

    See README.md for the full interface and the budgets.

Dependencies: python3 + numpy (stdlib zlib/struct write the PNGs).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import struct
import sys
import time
import zlib
from concurrent.futures import ProcessPoolExecutor
from fractions import Fraction

import numpy as np

# --------------------------------------------------------------------------- paths

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.normpath(os.path.join(HERE, '..', '..'))            # .../docs
SG = os.path.join(DOCS, 'scott-gray')
ATLAS = os.path.join(SG, 'data', 'wallpaper-atlas.json')
GROUPS = os.path.join(SG, 'wallpaper-groups.json')
COLOUR_ATLAS = os.path.join(DOCS, 'colour', 'data', 'colour-atlas.json')   # its model table
OUT_DIR = os.path.join(DOCS, 'monochrome', 'data')
THUMB_DIR = os.path.join(OUT_DIR, 'thumbs')
ORBITS_DIR = os.path.join(OUT_DIR, 'orbits')

SCHEMA = 'monochrome-atlas-v2'
RECORD_SCHEMAS = ('colour-candidate-v1', 'monochrome-candidate-v1')
GATE_VERSIONS = ('colour-offline-v1', 'monochrome-offline-v1')
QUALITY_GATE = 'monochrome-doubled-grid-v1'

# Ink.  Black, white, and the grey the pages draw where w is exactly zero (the
# anti-aliased contour of the shipped viewers collapses to this on a still).
INK = [(0x10, 0x10, 0x10), (0xf2, 0xf2, 0xf0), (0x80, 0x80, 0x80)]
SQRT3 = math.sqrt(3.0)

# --------------------------------------------------------------------------- lattices
#
# Lattice coordinates (u, v) mean the point u a1 + v a2; nodes are u = i/N.
# Screen convention of every viewer in this repo: x right, y DOWN.
#
#   square       a1 = (1, 0)        a2 = (0, 1)
#   triangular   a1 = (1, 0)        a2 = (-1/2, -sqrt3/2)
#
# An operation is written x -> P x + c with P an integer matrix in lattice
# coordinates and c a whole number of nodes.

SQUARE_OPS = [
    ('1',    ((1, 0), (0, 1)),   'the identity'),
    ('R90',  ((0, -1), (1, 0)),  'a quarter turn, (x, y) -> (-y, x)'),
    ('R180', ((-1, 0), (0, -1)), 'a half turn'),
    ('R270', ((0, 1), (-1, 0)),  'a quarter turn the other way'),
    ('Mx',   ((-1, 0), (0, 1)),  'reflection across a vertical line (x -> -x)'),
    ('My',   ((1, 0), (0, -1)),  'reflection across a horizontal line (y -> -y)'),
    ('Md',   ((0, 1), (1, 0)),   'reflection across the diagonal y = x'),
    ('Ma',   ((0, -1), (-1, 0)), 'reflection across the antidiagonal y = -x'),
]

TRIANGULAR_OPS = [
    ('1',    ((1, 0), (0, 1)),   'the identity'),
    ('R60',  ((1, -1), (1, 0)),  'a sixth of a turn'),
    ('R120', ((0, -1), (1, -1)), 'a third of a turn'),
    ('R180', ((-1, 0), (0, -1)), 'a half turn'),
    ('R240', ((-1, 1), (-1, 0)), 'two thirds of a turn'),
    ('R300', ((0, 1), (-1, 1)),  'five sixths of a turn'),
    ('Ma',   ((0, 1), (1, 0)),   'reflection across the a1 + a2 diagonal'),
    ('Mb',   ((1, 0), (1, -1)),  'reflection across the 2a1 + a2 axis'),
    ('Mc',   ((-1, 1), (0, 1)),  'reflection across the a1 + 2a2 axis'),
    ('Md',   ((0, -1), (-1, 0)), 'reflection across the a1 - a2 axis'),
    ('Me',   ((-1, 0), (-1, 1)), 'reflection across the a2 axis'),
    ('Mf',   ((1, -1), (0, -1)), 'reflection across the a1 axis'),
]

OPS = {'square': SQUARE_OPS, 'triangular': TRIANGULAR_OPS}
IDENTITY = ((1, 0), (0, 1))


def lattice_of(stencil):
    return 'triangular' if stencil == 'triangular-six' else 'square'


def from_plane(lattice, x, y):
    """Plane (x right, y down) to lattice coordinates."""
    if lattice == 'square':
        return x, y
    return x - y / SQRT3, -2.0 * y / SQRT3


def inv_unimodular(m):
    (a, b), (c, d) = m
    det = a * d - b * c
    assert abs(det) == 1, m
    return ((d * det, -b * det), (-c * det, a * det))


def matmul(a, b):
    return tuple(tuple(sum(a[i][k] * b[k][j] for k in range(2)) for j in range(2)) for i in range(2))


def matvec(a, v):
    return (a[0][0] * v[0] + a[0][1] * v[1], a[1][0] * v[0] + a[1][1] * v[1])


# --------------------------------------------------------------------------- rule kinds

RULE_KINDS = {
    'half-period': {
        'title': 'half period',
        'rule': 'w(x, t) = U(x, t) - U(x, t + T/2)',
        'blurb': 'Every orbit has this one: compare the frame with the frame half a '
                 'period later. Waiting half a period swaps black and white exactly, '
                 'and every symmetry of the field preserves them.',
    },
    'half-turn': {
        'title': 'half turn',
        'rule': 'w(x, t) = U(x, t) - U(2p - x, t)',
        'blurb': 'Compare the pattern with its own half-turn image about a point p. '
                 'The half turn swaps black and white exactly, whatever the field.',
    },
    'mirror': {
        'title': 'mirror',
        'rule': 'w(x, t) = U(x, t) - U(m x, t)',
        'blurb': 'Compare the pattern with its own reflection in a line. The '
                 'reflection swaps black and white exactly; w vanishes identically '
                 'on the line itself, so the mirror line is drawn as a contour.',
    },
    'glide': {
        'title': 'glide',
        'rule': 'w(x, t) = U(x, t) - U(g x, t)',
        'blurb': 'Compare the pattern with its reflection-and-slide image. The glide '
                 'swaps black and white exactly, and unlike a mirror it has no fixed '
                 'line, so nothing is forced to vanish.',
    },
    'half-shift': {
        # One name, everywhere.  The chip (`mono-atlas.mjs` RULE_LABELS), the
        # caption over the canvas, the status line and the rule prose all read
        # this title, and the design's SS A.5 calls it a half SLIDE.
        'title': 'half slide',
        'rule': 'w(x, t) = U(x, t) - U(x + h, t)',
        'blurb': 'Compare the pattern with itself slid half a cell. The slide swaps '
                 'black and white exactly.',
    },
    'threshold': {
        'title': 'threshold',
        'rule': 'w(x, t) = U(x, t) - median(U)',
        'blurb': 'The plain picture: above the median is white, below is black. No '
                 'motion swaps the two colours, so every symmetry of the field '
                 'preserves them; it is here for comparison.',
    },
}

ANTISYMMETRIC_KINDS = ('half-period', 'half-turn', 'mirror', 'glide', 'half-shift')

KIND_CODE = {'half-turn': 0, 'mirror': 1, 'glide': 2, 'half-shift': 3,
             'half-period': 4, 'threshold': 5}

# The two sentences `rule.sameAs` repeats, hoisted out of every entry.
NOTES = [
    'the same rule wearing a different hat: (s, T/2) is an exact symmetry of the field, '
    'so U(s x, t) = U(x, t - T/2) and the difference is this one',
    'conjugate by a symmetry of the field, so the picture is this one moved',
    'the drawn pictures are equal node-frame by node-frame',
    'the drawn pictures are exact negatives, so the two differ by swapping the inks',
    'the same picture at another origin: the shift columns carry one onto the other exactly',
    'the same picture at another origin, with the inks exchanged',
]
NOTE_CODE = {t: i for i, t in enumerate(NOTES)}

# --------------------------------------------------------------------------- tiers

#
# The two titles name what `tier` MEASURES -- a property of the involution s
# against the field -- and not a property of the picture.  They used to read
# "exact in space and time" and "exact in space only", and the second was a
# false negative on more than half the tier: `tier` is broad exactly when s is
# free, which says nothing about the half-period wait, and on the phase-
# symmetric equations (where U(x, t + T/2) = -U(x, t) identically) the wait
# exchanges the inks of a free involution's picture too.  Whether it does is
# measured per entry in `laws.halfPeriod`, and `counts.broadHalfPeriodExact`
# says on how many.

TIERS = {
    'strict': {
        'title': 'the involution is a symmetry of the field',
        'short': 'strict',
        'law': 'U(s x, t + T/2) = U(x, t)',
        'blurb': 'The involution s is an exact spacetime symmetry of the field, so s alone '
                 'swaps black and white, waiting half a period alone swaps them, and the two '
                 'together put the picture back. This is a two-colour SPACETIME group, and it '
                 'is what the two pages the site already ships are. Because every such rule '
                 'computes the same function -- the half-period difference -- a field has one '
                 'strict picture or none, never two; the readings are listed on it.',
    },
    'broad': {
        'title': 'the involution is free',
        'short': 'broad',
        'law': 'w(s x, t) = -w(x, t)',
        'blurb': 'The involution s is free: it exchanges the inks by an identity of subtraction '
                 'and by nothing else -- not because it is a symmetry of the field. Every '
                 'frozen frame is a genuine two-colour wallpaper pattern, and a field offers '
                 'many of these, all different pictures. Whether the FILM is also a two-colour '
                 'spacetime pattern is a separate question this tier does not decide: it is '
                 'measured per entry in laws.halfPeriod, and on the phase-symmetric equations, '
                 'where U(x, t + T/2) = -U(x, t) identically, the answer is usually yes.',
    },
    'control': {
        'title': 'no antisymmetry',
        'short': 'control',
        'law': 'w(x, t) = U(x, t) - median U',
        'blurb': 'The plain threshold. Nothing swaps black and white; every symmetry of the '
                 'field preserves them. It is here so the other two tiers can be compared with '
                 'the picture you get for free.',
    },
}

TIER_ORDER = ['strict', 'broad', 'control']

# --------------------------------------------------------------------------- models
#
# `../../colour/data/colour-atlas.json` carries the table for nine equations and is
# the base (see model_table).  Anything the offline searches admitted that is not
# in it is described here, lifted from
# `../../scott-gray/research/equations/rdlab.py` and
# `../../scott-gray/research/colour/rdlab_colour.py`.

MODEL_EXTRA = {
    'fitzhugh-nagumo': {
        'name': 'FitzHugh–Nagumo',
        'axes': ['eps', 'I'],
        'labels': {'Du': 'D_u', 'Dv': 'D_v', 'eps': 'ε', 'a': 'a', 'b': 'b', 'I': 'I'},
        'parameters': ['Du', 'Dv', 'eps', 'a', 'b', 'I'],
        'diffusion': ['Du', 'Dv'],
        'channels': ['u', 'v'],
        'equation': 'u_t = D_u ∇²u + u − u³/3 − v + I,   v_t = D_v ∇²v + ε (u + a − b v)',
        'equationHtml': 'u<sub>t</sub> = D<sub>u</sub>∇²u + u − u³/3 − v + I, &nbsp; '
                        'v<sub>t</sub> = D<sub>v</sub>∇²v + ε(u + a − b v)',
        'description': 'The FitzHugh–Nagumo excitable medium, the two-variable caricature of a '
                       'nerve membrane: a fast cubic activator u and a slow linear recovery '
                       'variable v. Its uniform limit cycle is stable enough that most seeded '
                       'spirals relax onto it, which is why the whole offline search returned a '
                       'single periodic orbit on a wallpaper group.',
    },
}

# --------------------------------------------------------------------------- featured
#
# Chosen by eye from the contact sheets this script writes with --sheets, two to
# four per wallpaper family, spread over the equations and the rule kinds.  Every
# entry in the catalog is exact; `featured` is a judgement about how a picture
# looks and nothing else.  Regenerate the sheets, look, edit this dict, re-run.

FEATURED = {}
try:                                    # kept in a sidecar so a re-judge is one file
    with open(os.path.join(HERE, 'featured.json')) as _fh:
        FEATURED = json.load(_fh)
except FileNotFoundError:
    pass

# Pages already shipped from these fields, so the catalog reproduces them rather
# than quietly replacing them.
SHIPPED = {
    '459f00246aed541414bbe7d3d092ca2e66e4b3e417ccb5d3d8efaa37abbe78d7': {
        'page': 'scott-gray/weave-monochrome/', 'name': 'Weave Monochrome',
        'classic': 'the weave', 'kind': 'half-period', 'preserve': 32, 'swap': 32,
        'note': 'the half turn about the lattice origin, which on this orbit is the '
                'half-period rule (README: 32 preserving + 32 swapping)',
    },
    '731aa45654d4d690f202dc48818e47c8fe023bfd5462284a8601f4bed6563483': {
        'page': 'scott-gray/plume-monochrome/', 'name': 'Plume Monochrome',
        'classic': 'the wave', 'kind': 'half-period', 'preserve': 16, 'swap': 16,
        'note': 'the same rule on the sibling rotating wave (README: 16 + 16)',
    },
}

# The two named classics, in the words the pages already use.  The catalog must
# reproduce them exactly -- same field, same rule, same published group orders --
# or the build fails, because a catalog that quietly replaced a shipped page
# would be worse than no catalog.
CLASSICS = {
    'the wave': {
        'field': '731aa45654d4', 'kind': 'half-period', 'tier': 'strict',
        'page': 'scott-gray/plume-monochrome/', 'title': 'Plume Monochrome',
        'preserve': 16, 'swap': 16,
        'blurb': 'The rotating Gray–Scott wave, drawn in two inks. A half turn about the '
                 'lattice origin exchanges black and white; so does waiting half a period; '
                 'the two together put the picture back. 16 operations preserve the inks and '
                 '16 exchange them.',
    },
    'the weave': {
        'field': '459f00246aed', 'kind': 'half-period', 'tier': 'strict',
        'page': 'scott-gray/weave-monochrome/', 'title': 'Weave Monochrome',
        'preserve': 32, 'swap': 32,
        'blurb': 'The woven rotating wave, and the picture that made the collapse obvious: on '
                 'this orbit the half turn about the origin, the half-cell slide along x and '
                 'the half-period difference are three sentences about one function. 32 '
                 'operations preserve the inks and 32 exchange them.',
    },
}

# --------------------------------------------------------------------------- png


def write_png(path, indexed, palette):
    """An indexed PNG, 1 bit per pixel for two inks and 2 bits for three."""
    h, w = indexed.shape
    depth = 1 if len(palette) <= 2 else 2
    per_byte = 8 // depth
    pad = (-w) % per_byte
    if pad:
        indexed = np.concatenate([indexed, np.zeros((h, pad), dtype=np.uint8)], axis=1)
    packed = np.zeros((h, indexed.shape[1] // per_byte), dtype=np.uint8)
    for k in range(per_byte):
        packed |= (indexed[:, k::per_byte].astype(np.uint8) & ((1 << depth) - 1)) << (
            depth * (per_byte - 1 - k))
    raw = b''.join(b'\x00' + packed[y].tobytes() for y in range(h))

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

    plte = b''.join(bytes(c) for c in palette)
    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n'
                 + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, depth, 3, 0, 0, 0))
                 + chunk(b'PLTE', plte)
                 + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def upsample(frame, k):
    """Band-limited periodic upsample of one N x N frame to kN x kN.

    Trigonometric interpolation commutes with the lattice operations, so the
    upsampled picture is the exact band-limited difference field and not a
    difference of interpolations -- the same thing `../../scott-gray/plume-monochrome/`
    does on load.
    """
    n = frame.shape[0]
    if k <= 1:
        return frame
    big = n * k
    f = np.fft.fft2(frame)
    out = np.zeros((big, big), dtype=complex)
    h = n // 2
    # The Nyquist row/column of an even-length transform is split in half so the
    # interpolant stays real.
    f = f.copy()
    if n % 2 == 0:
        f[h, :] *= 0.5
        f[:, h] *= 0.5
    lo = slice(0, h + 1)
    hi = slice(n - h, n)
    out[lo, lo] = f[lo, lo]
    out[lo, big - h:] = f[lo, hi]
    out[big - h:, lo] = f[hi, lo]
    out[big - h:, big - h:] = f[hi, hi]
    return np.real(np.fft.ifft2(out)) * (k * k)


def render_frame(w_frame, n, lattice, size=512, span=2.0, upscale=None):
    """One frame of the sign picture, `span` lattice lengths across."""
    if upscale is None:
        upscale = max(1, int(math.ceil(size / (span * n))))
    big = upsample(w_frame.astype(np.float64), upscale)
    bn = big.shape[0]
    s = (np.arange(size) + 0.5) / size - 0.5
    px, py = np.meshgrid(s * span, s * span, indexing='xy')
    du, dv = from_plane(lattice, px, py)
    ui = np.rint(du * bn).astype(np.int64) % bn
    vi = np.rint(dv * bn).astype(np.int64) % bn
    vals = big[vi, ui]
    out = np.where(vals > 0, 1, 0).astype(np.uint8)
    if upscale == 1:
        out[vals == 0] = 2
    return out


def render_strip(w, n, lattice, frames=12, tile=128, span=2.0):
    m = w.shape[0]
    cols = [render_frame(w[(i * m) // frames], n, lattice, size=tile, span=span)
            for i in range(frames)]
    return np.concatenate(cols, axis=1)


# --------------------------------------------------------------------------- field io


def load_field(path, n, m):
    raw = np.fromfile(path, dtype='<f4')
    if raw.size != m * 2 * n * n:
        raise ValueError(f'{path}: {raw.size} floats, expected {m * 2 * n * n}')
    return raw.reshape(m, 2, n, n)


def node_grid(n):
    ys, xs = np.meshgrid(np.arange(n), np.arange(n), indexing='ij')
    return np.stack([xs, ys])                       # (2, n, n), indexed [., y, x]


def gather(field, P, c, n, grid=None):
    """field(P x + c, t) on every saved node."""
    g = node_grid(n) if grid is None else grid
    q = (np.tensordot(np.array(P, dtype=np.int64), g, axes=(1, 0))
         + np.array(c, dtype=np.int64)[:, None, None]) % n
    return field[:, q[1], q[0]]


def freq_permutation(P, n):
    """Index map with F(f o P^-1)[k] = F(f)[P^T k]: one FFT serves every op."""
    g = node_grid(n)
    pt = np.array(P, dtype=np.int64).T
    q = np.tensordot(pt, g, axes=(1, 0)) % n
    return q[1], q[0]                                # (ky index, kx index)


def correlate_spectra(fa, fb):
    """C[s, vy, vx] = sum_z a[z + v, tau + s] b[z, tau]."""
    return np.real(np.fft.ifftn(fa * np.conj(fb)))


# --------------------------------------------------------------------------- symmetry search


def field_symmetries(u, n, m, ops, tol=2e-6):
    """Every (P, v, s) with U(P x + v, t + s) = U(x, t), to `tol` relative rms.

    Shortlisted by one 3-D cyclic cross-correlation per point operation (which
    settles all N^2 translations and all M time shifts at once) and then
    confirmed by a direct comparison, which is what the reported residual is.
    """
    f = u - u.mean()
    std = float(f.std())
    if std == 0.0:
        return []
    norm2 = float(np.sum(f * f))
    fa = np.fft.fftn(f)
    out = []
    for name, P, _ in ops:
        iy, ix = freq_permutation(P, n)
        fb = fa[:, iy, ix]
        c = correlate_spectra(fa, fb)
        rms = np.sqrt(np.maximum(2.0 * (norm2 - c), 0.0) / f.size) / std
        for s, vy, vx in np.argwhere(rms < tol):
            res = float(np.abs(gather(np.roll(u, -int(s), axis=0), P, (int(vx), int(vy)), n)
                               - u).max())
            out.append({'name': name, 'P': P, 'v': (int(vx), int(vy)), 'frames': int(s),
                        'residual': res, 'rms': float(rms[s, vy, vx])})
    return out


def two_colour_group(a, n, m, ops):
    """The exact two-colour group of a sign volume a in {-1, 0, +1}.

    Same shortlist, at the level of the picture: the correlation of a with its
    image reaches +/- the non-tied fraction only when the two agree (or disagree)
    at every single node-frame, and each hit is then confirmed by an integer
    array comparison.  Ties are carried along: a zero must map to a zero.
    """
    af = a.astype(np.float64)
    nz = float(np.count_nonzero(a)) / a.size
    fa = np.fft.fftn(af)
    preserve, swap = [], []
    for name, P, _ in ops:
        iy, ix = freq_permutation(P, n)
        c = correlate_spectra(fa, fa[:, iy, ix]) / a.size
        for sign, bucket in ((1, preserve), (-1, swap)):
            for s, vy, vx in np.argwhere(sign * c > nz - 1e-9):
                g = gather(np.roll(a, -int(s), axis=0), P, (int(vx), int(vy)), n)
                if np.array_equal(g, a if sign > 0 else -a):
                    bucket.append({'name': name, 'M': P, 'v': [int(vx), int(vy)],
                                   'frames': int(s), 'action': 'preserve' if sign > 0 else 'swap'})
    return preserve, swap


# --------------------------------------------------------------------------- involutions


def involutions(n, ops):
    """Every x -> P x + c with (P x + c) applied twice the identity, modulo the cell.

    s o s = x + (I + P) c, so s is an involution exactly when (I + P) c = 0 mod N,
    and it is a true mirror (rather than a glide) when (I + P) c = 0 mod 2N -- the
    projection (I + P)c / 2 of c onto the mirror line is then a lattice vector.
    """
    grid = node_grid(n).reshape(2, -1).T                  # (n*n, 2) as (x, y)
    out = []
    for name, P, _ in ops:
        pm = np.array(P, dtype=np.int64)
        if not np.array_equal(pm @ pm, np.eye(2, dtype=np.int64)):
            continue
        e = (grid @ (pm + np.eye(2, dtype=np.int64)).T)   # (I + P) c
        ok = np.all(e % n == 0, axis=1)
        pure = np.all(e % (2 * n) == 0, axis=1)
        for idx in np.nonzero(ok)[0]:
            c = (int(grid[idx, 0]), int(grid[idx, 1]))
            if P == IDENTITY:
                if c == (0, 0):
                    continue
                kind = 'half-shift'
            elif P == ((-1, 0), (0, -1)):
                kind = 'half-turn'
            else:
                kind = 'mirror' if pure[idx] else 'glide'
            out.append({'kind': kind, 'name': name, 'P': P, 'c': c})
    return out


def involution_classes(cands, syms, n):
    """Label candidates by their orbit under conjugation by the field's symmetries.

    Conjugating s = (P, c) by a field symmetry g = (Q, u) gives
    (Q P Q^-1, Q c + u - (Q P Q^-1) u), and w_{g s g^-1} is w_s moved by g and
    shifted in time -- the same animation.  One representative per class is
    scored.
    """
    index = {(cd['P'], cd['c']): i for i, cd in enumerate(cands)}
    parent = list(range(len(cands)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[max(ri, rj)] = min(ri, rj)

    for i, cd in enumerate(cands):
        for g in syms:
            Q, u = g['P'], g['v']
            qi = inv_unimodular(Q)
            pp = matmul(matmul(Q, cd['P']), qi)
            qc = matvec(Q, cd['c'])
            pu = matvec(pp, u)
            cc = ((qc[0] + u[0] - pu[0]) % n, (qc[1] + u[1] - pu[1]) % n)
            j = index.get((pp, cc))
            if j is not None:
                union(i, j)
    return [find(i) for i in range(len(cands))]


# --------------------------------------------------------------------------- metrics


def edge_directions(lattice):
    return [(1, 0), (0, 1), (1, 1)] if lattice == 'triangular' else [(1, 0), (0, 1)]


def neighbours(lattice):
    if lattice == 'triangular':
        return [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1)]
    return [(1, 0), (-1, 0), (0, 1), (0, -1)]


def sign_volume(w):
    return np.sign(w).astype(np.int8)


def measure(a, lattice, w=None, u_std=None):
    """Balance, ties, boundary density, speckle, churn, and the legibility score.

    Balance is counted on the three-way sign (white, black, and the zero set,
    which is a measure-zero contour of the band-limited field but a real set of
    nodes on the saved grid).  Boundary, speckle and churn are counted on the
    picture as DRAWN -- white where w > 0 and black everywhere else -- because a
    white/zero/black run is one boundary crossing on the screen and would be
    none if the zero nodes were read as neither colour.
    """
    size = a.size
    white = float(np.count_nonzero(a > 0)) / size
    black = float(np.count_nonzero(a < 0)) / size
    tie = 1.0 - white - black
    drawn = a > 0
    cross = []
    for dx, dy in edge_directions(lattice):
        shifted = np.roll(np.roll(drawn, -dy, axis=1), -dx, axis=2)
        cross.append(float(np.count_nonzero(drawn != shifted)) / size)
    boundary = float(np.mean(cross))
    isolated = np.ones(drawn.shape, dtype=bool)
    for dx, dy in neighbours(lattice):
        isolated &= drawn != np.roll(np.roll(drawn, -dy, axis=1), -dx, axis=2)
    speckle = float(np.count_nonzero(isolated)) / size
    churn = float(np.count_nonzero(drawn != np.roll(drawn, -1, axis=0))) / size
    out = {
        'white': round(white, 6), 'black': round(black, 6),
        'imbalance': round(abs(white - black), 6),
        'tieFraction': round(tie, 8),
        'boundaryDensity': round(boundary, 6),
        'boundaryByDirection': [round(c, 6) for c in cross],
        'runLengthNodes': round(1.0 / boundary, 3) if boundary > 0 else None,
        'speckle': round(speckle, 8),
        'churn': round(churn, 6),
    }
    if w is not None and u_std:
        out['amplitude'] = round(float(np.abs(w).mean()) / u_std, 6)
    return out


def upsample_volume(w, k=2):
    """Band-limited periodic upsample of every frame of an (M, N, N) volume.

    Same trigonometric interpolation as `upsample`, done once for the whole
    volume: this is the grid the shipped viewers actually reconstruct and draw,
    so it is the grid the quality gate is measured on.
    """
    m, n = w.shape[0], w.shape[1]
    if k <= 1:
        return np.asarray(w, dtype=np.float64)
    big = n * k
    f = np.fft.fft2(np.asarray(w, dtype=np.float64), axes=(1, 2))
    h = n // 2
    if n % 2 == 0:
        f[:, h, :] *= 0.5
        f[:, :, h] *= 0.5
    out = np.zeros((m, big, big), dtype=complex)
    lo = slice(0, h + 1)
    hi = slice(n - h, n)
    out[:, lo, lo] = f[:, lo, lo]
    out[:, lo, big - h:] = f[:, lo, hi]
    out[:, big - h:, lo] = f[:, hi, lo]
    out[:, big - h:, big - h:] = f[:, hi, hi]
    return np.real(np.fft.ifft2(out, axes=(1, 2))) * (k * k)


def measure_drawn(drawn, lattice):
    """Balance, boundary, speckle, churn of a BOOLEAN picture, as drawn.

    `drawn` is `w > 0` -- one ink or the other and nothing in between, which is
    what a viewer puts on the screen.  On the node grid the exact zero set of a
    colour-reversing mirror is a real set of samples and `measure` counts it; on
    the reconstruction grid it is a measure-zero contour and counting it as a
    third state turns every mirror line into a line of speckle.
    """
    size = drawn.size
    cross = []
    for dx, dy in edge_directions(lattice):
        shifted = np.roll(np.roll(drawn, -dy, axis=1), -dx, axis=2)
        cross.append(float(np.count_nonzero(drawn != shifted)) / size)
    boundary = float(np.mean(cross))
    isolated = np.ones(drawn.shape, dtype=bool)
    for dx, dy in neighbours(lattice):
        isolated &= drawn != np.roll(np.roll(drawn, -dy, axis=1), -dx, axis=2)
    return {
        'white': round(float(np.count_nonzero(drawn)) / size, 6),
        'boundaryDensity': round(boundary, 6),
        'boundaryByDirection': [round(c, 6) for c in cross],
        'speckle': round(float(np.count_nonzero(isolated)) / size, 9),
        'churn': round(float(np.count_nonzero(drawn != np.roll(drawn, -1, axis=0))) / size, 6),
    }


def measure_doubled(w, n, lattice, u_range, k=2):
    """The gate's numbers, on the spectrally doubled grid the viewer draws.

    `strandNodes` is the mean run length of one ink along a lattice direction in
    SAVED nodes -- the doubled-grid run divided by k -- because that is the number
    `../../scott-gray/weave-monochrome/README.md` publishes (48 / 5.93 = 8.09).
    `strandCells` is the same length as a fraction of the lattice cell, which is
    what the framing needs and the only form that compares two orbits saved at
    different N.
    """
    big = upsample_volume(w, k)
    q = measure_drawn(big > 0, lattice)
    bd = q['boundaryDensity']
    strand = (1.0 / bd) if bd > 0 else None
    q['grid'] = k * n
    q['boundaryPerCell'] = round(bd * k * n, 4)
    q['strandNodes'] = round(strand / k, 4) if strand else None
    q['strandCells'] = round(strand / (k * n), 6) if strand else None
    span = float(big.max() - big.min())
    q['wRelRange'] = round(span / u_range, 6) if u_range else None
    return q


def gate(q2, limits):
    """The quality gate, measured on `measure_doubled`'s block.  Reasons, not a bool."""
    why = []
    if q2['speckle'] > limits['speckle']:
        why.append('speckle')
    if not (limits['white'][0] < q2['white'] < limits['white'][1]):
        why.append('balance')
    if q2['boundaryDensity'] < limits['boundaryDensity']:
        why.append('blank')
    if q2['wRelRange'] is not None and q2['wRelRange'] < limits['wRelRange']:
        why.append('flat')
    if q2['strandCells'] is not None and q2['strandCells'] > limits['strandCells']:
        why.append('coarse')
    return {'passed': not why, 'failed': why}


def framing(q2, tile_pixels, want_pixels, tiles_max):
    """How many cells to draw so one strand lands in the 20-60 CSS pixel band.

    A strand is `strandCells` of a lattice cell; drawn `tiles` cells across a
    `tilePixels` box it is `strandCells * tilePixels / tiles` pixels wide.  The
    two shipped pages sit at the middle of that band, which is where `want` is.
    """
    cells = q2.get('strandCells')
    if not cells:
        return {'tiles': 2, 'tilePixels': tile_pixels, 'strandPixels': None}
    tiles = int(round(cells * tile_pixels / want_pixels))
    tiles = max(1, min(tiles_max, tiles))
    return {'tiles': tiles, 'tilePixels': tile_pixels,
            'strandPixels': round(cells * tile_pixels / tiles, 1)}


def channel_lag(wu, wv):
    """The time shift at which the V picture reproduces the U picture.

    Both are drawn as +/-1 on `w > 0`, so the cyclic time correlation counts
    agreements minus disagreements and one 1-D transform per node settles every
    lag at once.  A negative peak means V draws the U picture with the inks
    exchanged, which is still the same picture and is flagged.
    """
    a = np.where(wu > 0, 1.0, -1.0).reshape(wu.shape[0], -1)
    b = np.where(wv > 0, 1.0, -1.0).reshape(wv.shape[0], -1)
    m = a.shape[0]
    corr = np.fft.irfft(np.fft.rfft(a, axis=0) * np.conj(np.fft.rfft(b, axis=0)),
                        n=m, axis=0).sum(axis=1)
    # corr counts agreements minus disagreements, so it is an integer; rounding
    # the transform's 1e-4 of noise away makes a tie between two lags break the
    # same way here as it does in a direct count, which is what the test runs.
    corr = np.rint(corr)
    k = int(np.argmax(np.abs(corr)))
    peak = float(corr[k])
    return {'lagFrames': k, 'lag': round(k / m, 6),
            'agreement': round(0.5 * (1.0 + abs(peak) / a.size), 6),
            'inverted': 1 if peak < 0 else 0}


def picture_key(w):
    """A translation- and time-shift-invariant fingerprint of a drawn picture.

    |FFT| is unchanged by any cyclic shift of any axis and by negating the whole
    volume, so two pictures that are the same animation seen from a different
    origin or at a different phase -- or with the inks exchanged -- share a key.
    It is a shortlist, never a verdict: `same_picture` decides.
    """
    a = np.where(w > 0, 1.0, -1.0)
    f = np.abs(np.fft.fftn(a)) / a.size
    return hashlib.sha1(np.round(f, 9).tobytes()).hexdigest()[:16]


def same_picture(wa, wb):
    """The shift carrying one drawn picture onto the other, or onto its negative.

    The cyclic cross-correlation of two +/-1 volumes reaches +/-size exactly when
    they agree (or disagree) at every single node-frame, so the test is a peak
    comparison and an integer one.  Returns None, or (dt, dy, dx, sign) with

        b[t, y, x] = sign * a[t + dt, y + dy, x + dx]      at every node-frame,

    which is a claim a reader can re-run, so it is what the catalog records.
    """
    a = np.where(wa > 0, 1.0, -1.0)
    b = np.where(wb > 0, 1.0, -1.0)
    c = np.real(np.fft.ifftn(np.fft.fftn(a) * np.conj(np.fft.fftn(b))))
    idx = np.unravel_index(int(np.argmax(np.abs(c))), c.shape)
    if abs(float(c[idx])) <= a.size - 0.5:
        return None
    return (int(idx[0]), int(idx[1]), int(idx[2]), 1 if c[idx] > 0 else -1)


def _pad_time(g, m, over):
    """One frame-spectrum padded `over`-fold, so a sub-frame shift can be found."""
    half = m // 2
    out = np.zeros(over * m, dtype=complex)
    out[:half + 1] = g[:half + 1]
    if m - half - 1:
        out[-(m - half - 1):] = g[half + 1:]
    return out


def motion_match(a, b, n, m, ops, tol=1e-3, over=64):
    """The point operation, node translation and time shift carrying field a onto b.

    Ported from `../../colour/tools/build-colour-catalog.py`.  ‖a∘g − b‖² =
    ‖a‖² + ‖b‖² − 2⟨a∘g, b⟩ and the inner product over every translation and
    every time shift at once is a 3-D cyclic cross-correlation, so one FFT per
    point operation settles all N²·M motions.  Both channels are carried: a
    two-channel field that agrees on U alone is not the same orbit.  Two
    independent Newton solves of one orbit stop at different phases and the
    offset need not be a whole saved frame, so the winning peak is refined on an
    `over`-fold finer time grid.
    """
    fa = np.fft.fftn(a.astype(np.float64), axes=(0, 2, 3))
    fb = np.conj(np.fft.fftn(b.astype(np.float64), axes=(0, 2, 3)))
    sa, sb = float(np.sum(a.astype(np.float64) ** 2)), float(np.sum(b.astype(np.float64) ** 2))
    kx, ky = np.meshgrid(np.arange(n), np.arange(n), indexing='xy')
    kvec = np.stack([kx, ky])
    denom = math.sqrt(sb / a.size) or 1.0
    best = None
    for name, mat, _ in ops:
        pmt = inv_unimodular(mat)
        pmt = ((pmt[0][0], pmt[1][0]), (pmt[0][1], pmt[1][1]))         # transpose
        kq = np.tensordot(np.array(pmt, dtype=np.int64), kvec, axes=(1, 0)) % n
        spat = np.fft.ifftn(fa[:, :, kq[1], kq[0]] * fb, axes=(2, 3))
        corr = np.fft.ifft(spat, axis=0).sum(axis=1).real
        idx = np.unravel_index(int(np.argmax(corr)), corr.shape)
        peak, shift = float(corr[idx]), float(idx[0])
        if over > 1:
            g = spat[:, :, idx[1], idx[2]].sum(axis=1)
            dense = np.fft.ifft(_pad_time(g, m, over)).real * over
            j = int(np.argmax(dense))
            if float(dense[j]) > peak:
                peak, shift = float(dense[j]), j / over
        rel = math.sqrt(max(0.0, sa + sb - 2.0 * peak) / a.size) / denom
        p = np.array(mat, dtype=np.int64)
        u = np.array([int(idx[2]), int(idx[1])], dtype=np.int64)
        v = (p @ u) % n
        row = {'op': name, 'v': [int(v[0]), int(v[1])], 'frames': round(shift, 6),
               'relRms': float(rel)}
        if best is None or rel < best['relRms']:
            best = row
    return best if best and best['relRms'] <= tol else None


def legibility(q):
    """Higher is better: balanced, decisive, chunky but not blank, and no dust.

    The bands are the ones the eye asks for on a 512 pixel thumbnail of two or
    three cells: a black/white run wants to be six nodes or more across
    (boundary density under about 0.17), and a picture with almost no boundary
    at all is a blank.
    """
    bd = q['boundaryDensity']
    return (2.0 * q.get('amplitude', 0.0)
            - 6.0 * q['imbalance']
            - 12.0 * max(0.0, q['tieFraction'] - 0.01)
            - 200.0 * q['speckle']
            - 6.0 * max(0.0, bd - 0.17)
            - 8.0 * max(0.0, 0.035 - bd)
            - 1.5 * max(0.0, q['churn'] - 0.12))


# --------------------------------------------------------------------------- group naming
#
# Ported from ../../colour/tools/build-colour-catalog.py so that a monochrome
# picture's preserving subgroup, and its whole group with the colours forgotten,
# are named in the same vocabulary as the rest of the site.


def _frac(x):
    return Fraction(x).limit_denominator(20160) % 1


def signature(ops, reduce_translations=False):
    def vec(op):
        return op['vLattice']

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
        ops = [{'M': op['M'], 'vLattice': op['v'], 'tau': op['tau']} for op in entry['ops']]
        raw.setdefault(signature(ops), []).append(entry)
        red.setdefault(signature(ops, True), []).append(entry)
    for hits in red.values():
        hits.sort(key=lambda e: sum(1 for op in e['ops']
                                    if tuple(tuple(int(x) for x in r) for r in op['M']) == IDENTITY))
    return {'raw': raw, 'reduced': red}


def match_group(index, ops):
    """Name a spacetime symmetry set among the 68 forward film groups."""
    hits = index['raw'].get(signature(ops))
    if hits:
        return {'groupId': hits[0]['id'], 'family': hits[0]['family'],
                'orbifold': hits[0]['orbifold'], 'onFinerLattice': False}
    hits = index['reduced'].get(signature(ops, True))
    if hits:
        return {'groupId': hits[0]['id'], 'family': hits[0]['family'],
                'orbifold': hits[0]['orbifold'], 'onFinerLattice': True}
    return {'groupId': None, 'family': None, 'orbifold': None, 'onFinerLattice': None}


# --------------------------------------------------------------------------- sources


def model_table(atlas):
    """The equation table the pages read.

    The wallpaper atlas names its three models and no more; the colour catalog
    already carries the axes, the parameters, the equation in text and in HTML
    and the parameter labels for nine equations, so it is the base and the
    wallpaper atlas's names fill any gap.  Adding an equation is adding it there
    (or here) and re-running: no page code changes.

    The PROSE is not inherited.  The colour catalog's paragraphs describe the
    colour corpus -- they count its Gray-Scott fields, name its Trefoils and
    Gyres and talk about colour shares -- and every one of those clauses is
    either wrong here or meaningless on a two-ink page.  `MODEL_PROSE` below is
    this catalog's own, and `describe_models` fills its corpus-dependent slots
    from the fields that actually ship.
    """
    out = {}
    try:
        with open(COLOUR_ATLAS) as fh:
            out.update(json.load(fh).get('models') or {})
    except (OSError, ValueError):
        pass
    for name, value in (atlas.get('models') or {}).items():
        if name not in out:
            out[name] = value if isinstance(value, dict) else {'name': value}
    for name, value in MODEL_EXTRA.items():
        out.setdefault(name, value)
    # Whatever prose came in with the colour table is a description of a
    # different catalog.  Drop it now so that a model with no monochrome
    # paragraph ships no paragraph at all rather than a misleading one.
    for value in out.values():
        if isinstance(value, dict):
            value.pop('description', None)
    return out


def _sig(value):
    """A parameter value as a reader would write it: 0.8, -0.4, 12, 4.9."""
    text = f'{float(value):.6g}'
    return text.replace('-', '−')


def _pairs(fields, model, keys):
    """The distinct parameter sets of one model here, with how many fields each
    closed, most-populated first and then in value order."""
    seen = {}
    for rec in fields:
        if rec['model'] != model:
            continue
        key = tuple(round(float(rec['params'].get(k, 0.0)), 9) for k in keys)
        seen[key] = seen.get(key, 0) + 1
    return sorted(seen.items(), key=lambda kv: kv[0])


def _pair_list(fields, model, keys):
    rows = _pairs(fields, model, keys)
    return ', '.join('(' + ', '.join(_sig(v) for v in key) + ')' for key, _ in rows), len(rows)


def describe_models(models, fields, entries):
    """Give every equation this catalog holds its own paragraph, with the
    corpus-dependent clauses computed from the shipped fields rather than
    asserted.  Nothing here repeats a number the reader can see counted wrong.
    """
    rows = list(fields.values()) if isinstance(fields, dict) else list(fields)
    here = sorted({rec['model'] for rec in rows})
    by_model = {m: [rec for rec in rows if rec['model'] == m] for m in here}

    def origin_split(model):
        """How the wallpaper atlas says its own orbits were found, for the
        models that come from it."""
        kinds = {}
        for rec in by_model.get(model, []):
            kinds[rec.get('provenanceKind') or rec['origin']] = \
                kinds.get(rec.get('provenanceKind') or rec['origin'], 0) + 1
        return kinds

    gs = origin_split('gray-scott')
    le_sets, le_n = _pair_list(rows, 'lengyel-epstein', ('a', 'b'))
    cq_sets, cq_n = _pair_list(rows, 'cgl-quintic', ('alpha', 'beta'))

    prose = {
        'gray-scott':
            'The autocatalytic Gray–Scott reaction: a substrate u fed in at rate F is eaten '
            'by an activator v at the cubic rate uv², and v decays at rate F + k. It is the '
            'equation the rest of the site runs on, and one of the four here with no continuous '
            'phase symmetry, so a periodic orbit has to be closed by shooting. Every '
            'Gray–Scott field in this catalog comes from the wallpaper atlas: by its own '
            'provenance, {shot} were shot for a film group of their own and {audited} are '
            'audited orbits of a subgroup. The pictures read the substrate u.'.format(
                shot=gs.get('new-shooting', 0), audited=gs.get('audited-subgroup', 0)),
        'ginzburg-landau':
            'The cubic complex Ginzburg–Landau equation, written on two real channels. '
            'Multiplying A by a constant phase is an exact symmetry, so a wave that is steady in '
            'a rotating frame is exactly time-periodic — which is why nearly every orbit of '
            'this family was found as a relative equilibrium rather than by shooting. The '
            'pictures read Re A. Where the saved period is the phase’s own half turn, '
            'A(x, t + T/2) = −A(x, t) and every rule’s difference field inherits the '
            'half-period law, free involution or not — which is why so many of this '
            'equation’s readings exchange the inks after half a period although their tier '
            'says nothing about time.',
        'cgl-quintic':
            'Ginzburg–Landau with the next term in the amplitude expansion kept. The quintic '
            'coefficients γ and δ bend the amplitude–frequency relation, so the '
            'same phase symmetry survives while the shape of the wave does not. The {n} '
            '(α, β) pairs saved here — {sets} — are not among the cubic ones, '
            'so the two families cannot be compared at equal parameters on this '
            'page.'.format(n=cq_n, sets=cq_sets),
        'lambda-omega':
            'The λ–ω normal form: a complex amplitude whose growth rate and '
            'frequency depend only on its modulus, with ordinary real diffusion. It is the most '
            'permissive phase-symmetric family in the search — the frequency at zero '
            'amplitude, ω₀, is a free dial that shifts the period without touching the '
            'shape — and like the other phase-symmetric families its pictures are usually '
            'half-period antisymmetric whatever the rule. The pictures read Re A.',
        'brusselator':
            'The Brusselator, the textbook trimolecular oscillator. Its uniform state (a, b/a) '
            'loses stability in a Hopf bifurcation at b = 1 + a², and the waves just past '
            'that line are the ones the search seeds from. It has no phase symmetry, so every '
            'orbit here had to be closed by twisted shooting.',
        'schnakenberg':
            'The Schnakenberg activator–substrate scheme for glycolysis. With s = a + b the '
            'uniform state is (s, b/s²) and the Hopf locus is s − s³ = 2a, a '
            'narrow band; the orbits admitted here sit just inside it, which is why there are '
            'few of them and why their waves are shallow and smooth.',
        'selkov':
            'Sel’kov’s glycolytic oscillator, the two-variable ancestor of the '
            'Schnakenberg scheme. The uniform state is (b, b/(a + b²)) and, with '
            's = a + b², the Hopf locus is 2b² = s(1 + s). Its relaxation-like cycle '
            'spends most of the period near one extreme, so a threshold picture of it is far '
            'from balanced and the antisymmetric rules are what make it readable at all.',
        'lengyel-epstein':
            'The Lengyel–Epstein two-variable model of the CIMA chlorite–iodide–'
            'malonic-acid reaction, the chemistry in which Turing patterns were first seen in a '
            'laboratory. u is the iodide activator and v the chlorite inhibitor; the '
            'Michaelis-like term 4uv/(1 + u²) saturates, which is what lets the oscillation '
            'stay bounded without a cubic. The uniform state is u* = a/5, v* = 1 + u*², and '
            'the Hopf locus is b = (3u*² − 5)/u*; the {n} (a, b) sets that closed '
            'orbits here — {sets} — all sit just past it. The pictures read the iodide '
            'channel u.'.format(n=le_n, sets=le_sets),
        'rps':
            'The cyclic three-species replicator — rock beats scissors beats paper beats '
            'rock — with equal diffusion and a small mutation rate μ holding the state '
            'off the extinction boundary. It is the one equation in this catalog that is '
            'equivariant under cyclic relabelling of its species: '
            '(u₀, u₁, u₂) → (u₁, u₂, u₀) leaves the '
            'right-hand side unchanged. That is a symmetry of the chemistry and not of the '
            'picture, which reads one channel and knows nothing of the other two. Equal '
            'diffusion conserves u₀ + u₁ + u₂ = 1 exactly, which is why two '
            'channels suffice; the pictures read u₀. It was also the hardest family to '
            'close, so only a handful of its orbits are here.',
        'fitzhugh-nagumo':
            'The FitzHugh–Nagumo excitable medium, the two-variable caricature of a nerve '
            'membrane: a fast cubic activator u and a slow linear recovery variable v. Its '
            'uniform limit cycle is stable enough that most seeded spirals relax onto it, which '
            'is why the whole offline search returned a single periodic orbit on a wallpaper '
            'group.',
    }

    for model, block in models.items():
        if not isinstance(block, dict):
            continue
        text = prose.get(model)
        mine = [e for e in entries if fields[e['field']]['model'] == model]
        if mine:
            tiers = {t: sum(1 for e in mine if e['tier'] == t)
                     for t in ('strict', 'broad', 'control')}
            half = sum(1 for e in mine if (e['laws'].get('halfPeriod') or [0, 0])[1])
            # One computed sentence, the same shape for every equation, so that
            # no paragraph has to carry a corpus number in its own prose.
            n_f = len(by_model.get(model, []))
            parts = []
            if tiers['strict']:
                parts.append(f"{tiers['strict']} where the involution is a symmetry of the field")
            if tiers['broad']:
                parts.append(f"{tiers['broad']} where it is free")
            if tiers['control']:
                parts.append(f"{tiers['control']} plain threshold"
                             f"{'' if tiers['control'] == 1 else 's'}")
            split = ''
            if len(parts) > 1:
                split = ' — ' + ', '.join(parts[:-1]) + ' and ' + parts[-1]
            elif parts:
                split = ' — ' + parts[0]
            text = ((text + ' ') if text else '') + (
                'In this catalog: {f} saved field{fs} read {e} way{es}{split}, and {half} of '
                'those readings exchange{hv} the inks after half a period exactly.'.format(
                    f=n_f, fs='' if n_f == 1 else 's',
                    e=len(mine), es='' if len(mine) == 1 else 's', split=split,
                    half=half, hv='s' if half == 1 else ''))
        if text:
            block['description'] = text
    return models


def atlas_fields(atlas):
    """One source per distinct field file, with every record that names it."""
    by_sha = {}
    for o in atlas['orbits']:
        cfg = o.get('config') or {}
        sha = o['fieldSha256']
        rec = by_sha.get(sha)
        if rec is None:
            params = dict(cfg.get('params') or {})
            by_sha[sha] = rec = {
                'origin': 'atlas',
                'fieldSha256': sha,
                'fieldPath': os.path.join(SG, o['fieldUrl']),
                'fieldUrl': 'scott-gray/' + o['fieldUrl'],
                'fieldByteLength': o.get('fieldByteLength'),
                'N': int(cfg['N']), 'M': int(cfg['M']),
                'L': cfg.get('L'), 'period': cfg.get('period'),
                'model': cfg.get('model') or o.get('model') or 'gray-scott',
                'params': params,
                'lattice': lattice_of(params.get('stencil')),
                'atlasIds': [], 'groupIds': [], 'families': [], 'names': [],
                'ops': {},
                'batch': None, 'recordDir': None, 'singleMode': None,
                'usableRules': None, 'recordSignature': None,
                'jobLabel': None, 'strategy': None,
                # How the wallpaper atlas says this orbit was found -- so that
                # the Gray-Scott paragraph can count the split instead of
                # inheriting the colour catalog's guess at it.
                'provenanceKind': (o.get('provenance') or {}).get('kind'),
            }
        rec['atlasIds'].append(o['id'])
        if o['groupId'] not in rec['groupIds']:
            rec['groupIds'].append(o['groupId'])
        fam = o.get('family')
        if fam and fam not in rec['families']:
            rec['families'].append(fam)
        nm = o.get('patternName') or o.get('name')
        if nm and nm not in rec['names']:
            rec['names'].append(nm)
        for op in cfg.get('ops') or []:
            key = (tuple(tuple(int(x) for x in r) for r in op['M']),
                   round(float(op['v'][0]) % 1.0, 9), round(float(op['v'][1]) % 1.0, 9),
                   round(float(op['tau']) % 1.0, 9))
            rec['ops'][key] = {'M': [[int(x) for x in r] for r in op['M']],
                               'v': [float(op['v'][0]), float(op['v'][1])],
                               'tau': float(op['tau'])}
    for rec in by_sha.values():
        rec['ops'] = list(rec['ops'].values())
        rec['families'].sort()
        rec['groupIds'].sort()
    return list(by_sha.values())


def record_name(cfg, stripe):
    """What to call an offline-search orbit on a page.

    Only what the certificate measured: a single-Fourier-mode relative
    equilibrium (spatialRms == temporalRms to the last bit) is a travelling
    stripe wave and nothing else is claimed to be one.  The box separates two
    otherwise identical names, and the parameter set beside them separates the
    rest; the job id stays as `names[1]`.
    """
    box = cfg.get('L')
    what = 'Travelling stripe wave' if stripe else 'Periodic wave'
    return f'{what} · L{float(box):g}' if box else what


def record_fields(dirs, refused):
    """Admitted offline-search records: one folder per candidate."""
    out = []
    for root in dirs:
        if not os.path.isdir(root):
            refused.append({'source': root, 'reason': 'records directory not found'})
            continue
        for name in sorted(os.listdir(root)):
            folder = os.path.join(root, name)
            path = os.path.join(folder, 'candidate.json')
            if not os.path.isfile(path):
                continue
            try:
                with open(path) as fh:
                    cand = json.load(fh)
            except (OSError, ValueError) as exc:
                refused.append({'source': folder, 'reason': f'unreadable candidate.json: {exc}'})
                continue
            cert = cand.get('certificate') or {}
            why = None
            if cand.get('schema') not in RECORD_SCHEMAS:
                why = f"schema {cand.get('schema')!r}"
            elif cand.get('gateVersion') not in GATE_VERSIONS or \
                    cert.get('gateVersion') not in GATE_VERSIONS:
                why = 'gate version'
            elif not cert.get('passed'):
                why = 'certificate not passed'
            if why:
                refused.append({'source': folder, 'reason': why})
                continue
            cfg = cand['config']
            n, m = int(cfg['N']), int(cfg['M'])
            field = os.path.join(folder, cand.get('fieldUrl') or 'candidate.f32')
            if not os.path.isfile(field) or os.path.getsize(field) != m * 2 * n * n * 4:
                refused.append({'source': folder, 'reason': 'field file missing or wrong length'})
                continue
            params = dict(cfg.get('params') or {})
            # A single-Fourier-mode relative equilibrium -- a travelling stripe wave
            # with |A| constant -- has spatialRms == temporalRms to machine
            # precision.  802 of the Modal corpus's 849 orbits are one of those, so
            # the flag is what keeps a repository-sized selection from being 800
            # copies of one motif.  See ../../scott-gray/research/monochrome/README.md.
            srms, trms = cert.get('spatialRms'), cert.get('temporalRms')
            stripe = (srms is not None and trms is not None
                      and abs(srms - trms) <= 1e-12 * max(1.0, abs(srms)))
            mono = cand.get('monochrome') or {}
            out.append({
                'origin': 'record',
                'fieldSha256': cand['fieldSha256'],
                'fieldPath': field,
                'fieldUrl': None,                     # filled in when it is copied
                'fieldByteLength': m * 2 * n * n * 4,
                'N': n, 'M': m, 'L': cfg.get('L'), 'period': cfg.get('period'),
                'model': cand.get('model') or cfg.get('model') or 'unknown',
                'params': params,
                'lattice': cand.get('lattice') or lattice_of(params.get('stencil')),
                'atlasIds': [], 'groupIds': [cand['groupId']] if cand.get('groupId') else [],
                'families': [cand['family']] if cand.get('family') else [],
                # A job id is provenance, not a name.  It used to be names[0],
                # so `g6-cq-a-L56-N36-s0-phase` was what the explorer's caption,
                # its status line and the showcase card all called the picture,
                # on 174 of the 397 fields.  The name now says what was MEASURED
                # -- `stripe` is spatialRms == temporalRms to machine precision,
                # which is a single-Fourier-mode relative equilibrium -- and the
                # job id keeps its place behind it, as it does in `jobLabel` and
                # `recordDir`.
                'names': [record_name(cfg, stripe), cand.get('job', {}).get('id') or name],
                'ops': [], 'jobId': cand.get('job', {}).get('id') or name,
                'batch': os.path.basename(root.rstrip('/')),
                'recordDir': os.path.relpath(folder, DOCS),
                'singleMode': bool(stripe),
                'usableRules': cand.get('usableMonochrome'),
                'recordSignature': ((mono.get('rules') or [{}])[0] or {}).get('pictureSignature'),
                'jobLabel': (cand.get('job') or {}).get('label'),
                'strategy': (cand.get('job') or {}).get('strategy'),
            })
    return out


# --------------------------------------------------------------------------- orbit classes


def _bucket_key(src):
    """Fields that could possibly be the same orbit: a motion changes none of these."""
    return (src['model'], json.dumps(src['params'], sort_keys=True), src['lattice'],
            round(float(src['L']), 9) if src['L'] else None, src['N'], src['M'],
            round(float(src['period']), 6) if src['period'] else None)


def _rep_rank(src):
    """Which member of one orbit class the catalog should keep.

    A field a shipped page already draws wins outright -- the catalog must
    reproduce the site, not replace it.  Then an atlas field, because it costs no
    new repository bytes and carries film-group placements; then the one with the
    most placements; then the lowest sha, so the choice is reproducible.
    """
    return (0 if src['fieldSha256'] in SHIPPED else 1,
            0 if src['origin'] == 'atlas' else 1,
            -len(src['groupIds']), src['fieldSha256'])


def _class_worker(args):
    """Pairwise motion tests inside one bucket, in a worker."""
    bucket, tol = args
    loaded = []
    for src in bucket:
        try:
            loaded.append((src, load_field(src['fieldPath'], src['N'], src['M'])))
        except (OSError, ValueError):
            loaded.append((src, None))
    reps, members = [], []
    for src, field in loaded:
        if field is None:
            reps.append((src, None))
            members.append((src['fieldSha256'], src['fieldSha256'], None))
            continue
        hit = None
        for rsrc, rfield in reps:
            if rfield is None:
                continue
            how = motion_match(field, rfield, src['N'], src['M'], OPS[src['lattice']], tol=tol)
            if how:
                hit = (rsrc, how)
                break
        if hit:
            members.append((src['fieldSha256'], hit[0]['fieldSha256'], hit[1]))
        else:
            reps.append((src, field))
            members.append((src['fieldSha256'], src['fieldSha256'], None))
    return members


def orbit_classes(sources, tol, jobs, report):
    """Collapse fields that are one orbit reached twice.

    Two fields can only be the same orbit when the equation, the parameters, the
    box, the grid and the period agree, so those bucket the work; inside a bucket
    `motion_match` settles it exactly, and a whole point operation, node
    translation and (possibly sub-frame) phase shift is allowed, because two
    independent solves of one orbit stop wherever Newton leaves them.

    Returns {sha: (repSha, relation)} and rewrites the surviving sources in place
    so that every film group, family, atlas id and name of every member is kept
    on the survivor.  Nothing is thrown away: the members are listed on it.
    """
    buckets = {}
    for src in sources:
        buckets.setdefault(_bucket_key(src), []).append(src)
    work = []
    for key in sorted(buckets, key=str):
        group = sorted(buckets[key], key=_rep_rank)
        if len(group) > 1:
            work.append((group, tol))
    by_sha = {s['fieldSha256']: s for s in sources}
    relation = {}
    if work:
        with ProcessPoolExecutor(max_workers=jobs) as pool:
            for members in pool.map(_class_worker, work, chunksize=1):
                for sha, rep, how in members:
                    if rep != sha:
                        relation[sha] = (rep, how)
    kept = []
    for src in sources:
        sha = src['fieldSha256']
        if sha in relation:
            continue
        kept.append(src)
    for sha, (rep, how) in sorted(relation.items()):
        loser, winner = by_sha[sha], by_sha[rep]
        for key in ('atlasIds', 'groupIds', 'families', 'names'):
            for value in loser[key]:
                if value not in winner[key]:
                    winner[key].append(value)
        for op in loser['ops']:
            if op not in winner['ops']:
                winner['ops'].append(op)
        winner.setdefault('sameOrbit', []).append({
            'sha256': sha, 'origin': loser['origin'],
            'atlasIds': loser['atlasIds'], 'groupIds': loser['groupIds'],
            'recordDir': loser['recordDir'],
            'op': how['op'], 'v': how['v'], 'frames': how['frames'],
            'relRms': round(how['relRms'], 12),
        })
    for src in kept:
        src['families'].sort()
        src['groupIds'].sort()
        src.setdefault('sameOrbit', [])
    report['orbitClassesCollapsed'] = len(relation)
    report['orbitClassBuckets'] = len(work)
    return kept, relation


# --------------------------------------------------------------------------- record budget


def choose_records(records, atlas_srcs, budget_bytes, cap, report):
    """Which record fields earn repository bytes.

    Orbit bytes are the whole cost of this catalog, so the corpus on disk is
    thousands of fields and what ships is a spread:

      1. every Modal orbit that is NOT a single-mode travelling stripe wave --
         47 of 849, and the only ones that are a different motif;
      2. the first orbit of every (family, equation) cell, so no equation and no
         family is represented by nothing;
      3. up to `cap` per (family, equation) after that, preferring a non-stripe
         record, then one whose film group is new for the equation, then one from
         a parameter set not yet used -- and always a DISTINCT orbit, because the
         orbit classes above have already collapsed the repeats.

    Everything refused is returned with its reason and its path, so the build
    record says what exists on disk and where.
    """
    have_cell = {(f, m) for src in atlas_srcs
                 for f in (src['families'] or ['unclassified']) for m in [src['model']]}
    have_gm = {(g, src['model']) for src in atlas_srcs for g in src['groupIds']}

    def cell(src):
        return ((src['families'] or ['unclassified'])[0], src['model'])

    ranked = []
    for src in records:
        fam, model = cell(src)
        stripe = bool(src['singleMode'])
        modal = (src['recordDir'] or '').find('/monochrome/out/modal/') >= 0
        priority = (0 if (modal and not stripe) else
                    1 if not stripe else 2)
        ranked.append((priority, src))

    picked, left = [], []
    counts, used_params = {}, {}
    seen_cell, seen_gm = set(have_cell), set(have_gm)
    total = 0

    def take(src, why):
        nonlocal total
        picked.append(src)
        src['selectedBecause'] = why
        counts[cell(src)] = counts.get(cell(src), 0) + 1
        used_params.setdefault(cell(src), set()).add(json.dumps(src['params'], sort_keys=True))
        seen_cell.add(cell(src))
        for g in src['groupIds']:
            seen_gm.add((g, src['model']))
        total += src['fieldByteLength']

    # Pass 1: the mandatory ones, in a fixed order.
    order = sorted(ranked, key=lambda r: (r[0], r[1]['fieldSha256']))
    for priority, src in order:
        if priority == 0:
            take(src, 'a Modal orbit that is not a single-mode stripe wave')
        elif cell(src) not in seen_cell:
            take(src, f'the first {cell(src)[1]} orbit on {cell(src)[0]}')
    # Pass 2: fill each cell to the cap, diverse first.
    for priority, src in order:
        if 'selectedBecause' in src:
            continue
        key = cell(src)
        if counts.get(key, 0) >= cap or total + src['fieldByteLength'] > budget_bytes:
            continue
        fresh_group = any((g, src['model']) not in seen_gm for g in src['groupIds'])
        fresh_params = json.dumps(src['params'], sort_keys=True) not in used_params.get(key, ())
        if priority == 1:
            take(src, 'a hexagonal record that is not a single-mode stripe wave')
        elif fresh_group:
            take(src, 'the first orbit of this equation on this film group')
        elif fresh_params:
            take(src, 'a stripe wave from a parameter set this cell does not have')
        else:
            take(src, 'a stripe wave distinct by motion from the others in this cell')
    for priority, src in order:
        if 'selectedBecause' not in src:
            left.append(src)

    report['recordsSeen'] = len(records)
    report['recordsShipped'] = len(picked)
    report['recordBytesShipped'] = total
    report['recordBytesOnDisk'] = sum(s['fieldByteLength'] for s in left)
    return picked, left


# --------------------------------------------------------------------------- per field


def _cellfrac(k, n):
    """k nodes as a fraction of the cell, in words where there is a short one."""
    fr = Fraction(int(k) % n, n)
    return {Fraction(0): '0', Fraction(1, 2): '1/2', Fraction(1, 4): '1/4',
            Fraction(3, 4): '3/4', Fraction(1, 3): '1/3', Fraction(2, 3): '2/3'}.get(
                fr, f'{fr.numerator}/{fr.denominator}')


def rule_description(kind, op_name, c, n):
    if kind == 'half-period':
        return 'compare each frame with the frame half a period later'
    if kind == 'threshold':
        return 'white above the median of U, black below'
    if kind == 'half-shift':
        return (f'compare with the pattern slid ({_cellfrac(c[0], n)}, {_cellfrac(c[1], n)}) '
                f'of a cell')
    if kind == 'half-turn':
        return (f'compare with the half-turn image about the point '
                f'({_cellfrac(c[0], 2 * n)}, {_cellfrac(c[1], 2 * n)}) of a cell: '
                f'x -> ({c[0]}, {c[1]}) - x in nodes')
    verb = 'reflection' if kind == 'mirror' else 'glide reflection'
    return f'compare with the {verb} {op_name}: x -> {op_name} x + ({c[0]}, {c[1]}) nodes'


def build_rules(u, n, m, lattice, ops, syms, opts):
    """Every candidate rule for one channel, scored on a subsample of frames.

    Returns the list of survivors, best first, already de-duplicated: two rules
    whose sign volumes are equal, or exact negatives of one another, are the same
    picture and only the first is kept (the others are listed on it).
    """
    stride = max(1, m // max(4, opts['frames']))
    sub = u[::stride]
    u_std = float(u.std())
    med = float(np.median(u))

    cands = involutions(n, ops)
    classes = involution_classes(cands, syms, n)
    sym_at = {(g['P'], g['v']): g['frames'] for g in syms}
    half = m // 2

    # One representative per conjugacy class.  Conjugation can turn a mirror into
    # a glide (when the conjugating element carries a half-cell slide of its own),
    # so the class -- not the (kind, class) pair -- is the unit, and the class is
    # named after its most informative member.
    rank = {'half-turn': 0, 'mirror': 1, 'half-shift': 2, 'glide': 3}
    reps = {}
    for cd, cls in zip(cands, classes):
        prev = reps.get(cls)
        if prev is None or rank[cd['kind']] < rank[prev['kind']]:
            reps[cls] = dict(cd, cls=cls)
        if prev is not None:
            prev.setdefault('also', []).append({'kind': cd['kind'], 'op': cd['name'],
                                                'v': list(cd['c'])})

    rough, collapsed, vanished = [], [], []
    for cls, cd in sorted(reps.items()):
        sf = sym_at.get((cd['P'], cd['c']))
        if sf == 0:
            vanished.append({'kind': cd['kind'], 'op': cd['name'], 'v': list(cd['c'])})
            continue                       # s is a symmetry at tau = 0, so w vanishes
        if sf == half:
            # U(s x, t) = U(x, t - T/2), so w_s IS the half-period rule.
            collapsed.append({'kind': cd['kind'], 'op': cd['name'], 'v': list(cd['c'])})
            continue
        w = sub - gather(sub, cd['P'], cd['c'], n)
        if not np.any(w):
            vanished.append({'kind': cd['kind'], 'op': cd['name'], 'v': list(cd['c'])})
            continue
        a = sign_volume(w)
        q = measure(a, lattice, w, u_std)
        rough.append({'kind': cd['kind'], 'name': cd['name'], 'P': cd['P'], 'c': cd['c'],
                      'class': cls, 'score': legibility(q), 'rough': q, 'symFrames': sf,
                      'also': cd.get('also', [])})

    rough.sort(key=lambda r: (-r['score'], r['name'], r['c']))
    picked, centres = [], []
    per_kind = opts['per_kind']
    for kind in ('half-turn', 'mirror', 'glide', 'half-shift'):
        want = per_kind.get(kind, 1)
        for r in rough:
            if r['kind'] != kind or want <= 0:
                continue
            p = (r['c'][0] / (2.0 * n), r['c'][1] / (2.0 * n))
            if kind == 'half-turn' and any(plane_distance(p, q, lattice) < opts['separation']
                                           for q in centres):
                continue                   # a neighbouring turn centre is the same picture again
            centres.append(p)
            picked.append(r)
            want -= 1

    # The two rules every field has.
    picked.insert(0, {'kind': 'half-period', 'name': '1', 'P': IDENTITY, 'c': (0, 0),
                      'class': None, 'score': None, 'rough': None, 'symFrames': None,
                      'also': collapsed})
    picked.append({'kind': 'threshold', 'name': '1', 'P': IDENTITY, 'c': (0, 0),
                   'class': None, 'score': None, 'rough': None, 'symFrames': None, 'also': []})
    return picked, med, {'classes': len(reps), 'candidates': len(cands),
                         'vanished': vanished, 'collapsed': collapsed}


def plane_distance(p, q, lattice):
    """Shortest distance between two lattice-coordinate points, modulo the cell."""
    best = 1e9
    for a in (-1, 0, 1):
        for b in (-1, 0, 1):
            du, dv = p[0] - q[0] + a, p[1] - q[1] + b
            if lattice == 'square':
                x, y = du, dv
            else:
                x, y = du - dv / 2.0, -SQRT3 * dv / 2.0
            best = min(best, math.hypot(x, y))
    return best


def rule_field(u, rule, n, m, median):
    """w for one rule on one channel."""
    if rule['kind'] == 'half-period':
        return u - np.roll(u, -(m // 2), axis=0)
    if rule['kind'] == 'threshold':
        return u - median
    return u - gather(u, rule['P'], rule['c'], n)


def analyse_field(source, opts, group_index):
    """Mine one field: the rules, their groups, their metrics and their thumbnails."""
    t0 = time.time()
    n, m = source['N'], source['M']
    lattice = source['lattice']
    ops = OPS[lattice]
    try:
        raw = load_field(source['fieldPath'], n, m)
    except (OSError, ValueError) as exc:
        return {'refused': {'fieldSha256': source['fieldSha256'], 'reason': str(exc)}}
    channels = {'u': raw[:, 0].astype(np.float64), 'v': raw[:, 1].astype(np.float64)}
    del raw

    syms = field_symmetries(channels['u'], n, m, ops, opts['tol'])
    exact = [g for g in syms if g['residual'] <= opts['residual']]
    if not exact:
        exact = [g for g in syms if g['name'] == '1' and g['v'] == (0, 0) and g['frames'] == 0]
    half = m // 2
    half_period_is_symmetry = any(g['name'] == '1' and g['v'] == (0, 0) and g['frames'] == half
                                  for g in exact)

    picked, median, sweep = build_rules(channels['u'], n, m, lattice, ops, exact, opts)

    u_range = {ch: float(u.max() - u.min()) for ch, u in channels.items()}
    entries, seen, gated = [], {}, []
    previews = {}
    for rule in picked:
        # U is canonical.  V is the same picture at a lag on every orbit measured
        # (best agreement >= 0.978, median 0.992, while at lag 0 the two agree on
        # 22% of samples), so it is an option on this entry and never a second
        # entry.  V becomes canonical only when U's difference vanishes outright.
        drawn = {}
        for ch, u in channels.items():
            med = float(np.median(u)) if rule['kind'] == 'threshold' else 0.0
            w = rule_field(u, rule, n, m, med)
            drawn[ch] = None if not np.any(w) else {'w': w, 'median': med}
        canonical = 'u' if drawn['u'] else ('v' if drawn['v'] else None)
        if canonical is None:
            continue
        other = 'v' if canonical == 'u' else 'u'
        best = dict(drawn[canonical], channel=canonical)
        best['a'] = sign_volume(best['w'])
        best['metrics'] = measure(best['a'], lattice, best['w'],
                                  float(channels[canonical].std()))
        best['score'] = legibility(best['metrics'])
        best['doubled'] = measure_doubled(best['w'], n, lattice, u_range[canonical],
                                          opts['upscale'])
        best['gate'] = gate(best['doubled'], opts['limits'])
        best['view'] = framing(best['doubled'], opts['tile_pixels'], opts['want_pixels'],
                               opts['tiles_max'])
        if drawn[other] is not None:
            lag = channel_lag(best['w'], drawn[other]['w'])
            alt = measure(sign_volume(drawn[other]['w']), lattice, drawn[other]['w'],
                          float(channels[other].std()))
            lag.update({'channel': other, 'score': round(legibility(alt), 6),
                        'boundaryDensity': alt['boundaryDensity'],
                        'sameFunction': 1 if same_picture(best['w'], drawn[other]['w']) else 0})
            best['alternate'] = lag
        else:
            best['alternate'] = None

        # Two rules of one field are the same picture when one is a shift of the
        # other -- a translation, a phase, or the inks exchanged.  The |FFT|
        # fingerprint is invariant under all three and shortlists; the exact
        # cross-correlation peak decides.  (The old exact-bytes test missed every
        # pair that differed by a translation, which on a stripe wave is most of
        # them.)
        key = picture_key(best['w'])
        oi = {name: i for i, (name, _, _) in enumerate(ops)}
        prior, how = None, None
        for cand in seen.get(key, ()):
            how = same_picture(best['w'], cand['w'])
            if how:
                prior = cand
                break
        if prior is not None:
            dt, dy, dx, sign = how
            still = (dt, dy, dx) == (0, 0, 0)
            note = (2 if sign > 0 else 3) if still else (4 if sign > 0 else 5)
            prior['entry']['rule'].setdefault('sameAs', []).append(
                [KIND_CODE[rule['kind']], oi[rule['name']], rule['c'][0], rule['c'][1], note,
                 dt, dy, dx, sign])
            # The folded rule's own conjugates come along, but their relation to
            # the surviving picture is a conjugation composed with this shift,
            # which four integers do not describe -- so sign 0, note 1.
            prior['entry']['rule']['sameAs'].extend(
                [KIND_CODE[x['kind']], oi[x['op']], x['v'][0], x['v'][1], 1, 0, 0, 0, 0]
                for x in rule.get('also', []))
            continue
        if not best['gate']['passed'] and rule['kind'] not in ('half-period', 'threshold'):
            gated.append({'kind': rule['kind'], 'op': rule['name'], 'v': list(rule['c']),
                          'failed': best['gate']['failed']})
            continue

        entry = make_entry(source, rule, best, n, m, lattice, ops, group_index, exact,
                           half_period_is_symmetry, sweep, opts)
        seen.setdefault(key, []).append({'w': best['w'], 'a': best['a'], 'entry': entry})
        entries.append(entry)
        if opts['previews']:
            previews[entry['id']] = render_frame(best['w'][0], n, lattice,
                                                 size=opts['preview_size'],
                                                 span=float(entry['view']['tiles']))
        if opts['thumbs']:
            ind = render_frame(best['w'][0], n, lattice, size=opts['thumb_size'],
                               span=float(entry['view']['tiles']))
            write_png(os.path.join(THUMB_DIR, thumb_name(entry['id'])), ind,
                      INK[:3] if 2 in ind else INK[:2])
        if opts['strips']:
            strip = render_strip(best['w'], n, lattice, span=float(entry['view']['tiles']))
            write_png(os.path.join(opts['strips'], thumb_name(entry['id'])), strip,
                      INK[:3] if 2 in strip else INK[:2])

    return {'entries': entries, 'previews': previews,
            'fieldSymmetries': len(exact),
            'sweep': dict(sweep, gated=gated),
            'seconds': round(time.time() - t0, 2)}


def thumb_name(entry_id):
    return entry_id.replace(':', '-').replace('/', '-') + '.png'


def make_entry(source, rule, best, n, m, lattice, ops, group_index, exact,
               half_period_is_symmetry, sweep, opts):
    a = best['a']
    preserve, swap = two_colour_group(a, n, m, ops)
    op_index = {name: i for i, (name, _, _) in enumerate(ops)}

    def row(g):
        return [op_index[g['name']], g['v'][0], g['v'][1], g['frames'],
                1 if g['action'] == 'preserve' else 0]

    keep_ops = [{'M': g['M'], 'vLattice': [g['v'][0] / n, g['v'][1] / n],
                 'tau': g['frames'] / m} for g in preserve]
    all_ops = [{'M': g['M'], 'vLattice': [g['v'][0] / n, g['v'][1] / n],
                'tau': g['frames'] / m} for g in preserve + swap]

    why = NOTES[0] if rule['kind'] == 'half-period' else NOTES[1]
    tag = {'half-period': 'T2', 'threshold': 'med'}.get(
        rule['kind'], f"{rule['name']}{rule['c'][0]}.{rule['c'][1]}")
    sid = f"mono:{rule['kind']}:{source['fieldSha256'][:12]}:{tag}"
    if best['channel'] != 'u':
        sid += ':v'

    law = verify_laws(best['w'], rule, n, m)

    # The tier.  `strict` is the one claim that needs a property of the FIELD:
    # some involution s with U(s x, t + T/2) = U(x, t) exactly.  Every such rule
    # computes the half-period difference, so the strict picture of a field IS
    # its half-period picture and there is at most one.  Everything else built
    # from a free involution is `broad`; the threshold is the `control`.
    strict_readings = sweep['collapsed'] if rule['kind'] == 'half-period' else []
    if rule['kind'] == 'threshold':
        tier = 'control'
    elif rule['kind'] == 'half-period' and strict_readings:
        tier = 'strict'
    else:
        tier = 'broad'

    rule_block = {
        'kind': rule['kind'],
        'channel': best['channel'],
        'op': rule['name'],
        'M': [list(r) for r in rule['P']],
        'v': list(rule['c']),
        'description': rule_description(rule['kind'], rule['name'], rule['c'], n),
        'antisymmetric': rule['kind'] in ANTISYMMETRIC_KINDS,
        # The collapse (note 0) is an identity -- the two rules compute the same
        # array, so the shift is zero and the sign is +1 and a reader can check it.
        # A conjugate (note 1) is the picture moved by a point operation as well as
        # a translation, which no four integers describe, so its sign column is 0
        # and the shift columns mean nothing.
        'sameAs': [[KIND_CODE[x['kind']], op_index[x['op']], x['v'][0], x['v'][1],
                    NOTE_CODE[why], 0, 0, 0, 1 if NOTE_CODE[why] == 0 else 0]
                   for x in rule.get('also', [])],
    }
    # Always an integer, never a null: -1 says s was tested against every time
    # shift and is a symmetry of the field at none of them, which is exactly what
    # makes the involution free and the tier broad.
    if rule['kind'] not in ('half-period', 'threshold'):
        rule_block['sIsFieldSymmetryAt'] = -1 if rule['symFrames'] is None else rule['symFrames']
    if strict_readings:
        rule_block['strictReadings'] = [
            [KIND_CODE[x['kind']], op_index[x['op']], x['v'][0], x['v'][1]]
            for x in strict_readings]
        # The strict claim, measured rather than inherited, and measured for
        # EVERY reading rather than only the first: the page offers each one as a
        # chip, so each one is a claim a reader can act on, and they do not all
        # hold equally.  Each row is
        #
        #     [relative residual of w(s x, t) + w(x, t),  1 if bit-exact,
        #      fraction of node-frames where the DRAWN inks are not exchanged,
        #      1 if none]
        #
        # (s, T/2) is a symmetry of the SAVED field only to the search's residual
        # (--residual, 2e-7), not to the last bit, so the first pair can be a part
        # in 1e8 rather than exactly zero.  The claim that matters to a reader is
        # about the PICTURE, which is why the drawn ink exchange is counted
        # separately.  Where it is not zero it is a handful of nodes a frame,
        # sitting where |w| is at the float32 noise floor -- on a symmetric
        # reading that includes the fixed set of s, where the antisymmetry forces
        # w = 0 and the samples give 1e-9 instead, but it is not confined to it
        # and both inks occur there.  A half SHIFT has no fixed node at all and
        # still mismatches on a few.
        by_name = dict((nm, mm) for nm, mm, _ in ops)
        scale = float(np.abs(best['w']).max()) or 1.0
        each = []
        for reading in strict_readings:
            img = gather(best['w'], by_name[reading['op']], tuple(reading['v']), n)
            differ = float(np.count_nonzero((img > 0) != (best['w'] < 0))) / best['w'].size
            # SIGNIFICANT digits, not decimal places: rounding a residual of
            # 3e-10 to nine decimals published a flat 0.0 next to an exact flag
            # of 0, and a page that prints the number then says "residual 0" of
            # something that is not zero -- the very claim this block exists to
            # replace.
            each.append([round_floats(float(np.abs(img + best['w']).max()) / scale),
                         1 if np.array_equal(img, -best['w']) else 0,
                         round_floats(differ), 1 if differ == 0.0 else 0])
        # The catalog is on a 4.5 MB budget and 244 of the 326 strict entries
        # have nothing to report -- every reading bit-exact, every reading
        # drawing the same picture -- so the rows are shipped only where they are
        # not all [0, 1, 0, 1].  A reader that finds no `strictEach` on a strict
        # entry may take every reading to be exact; `shape.laws` says so.
        if any(row != [0.0, 1, 0.0, 1] for row in each):
            law['strictEach'] = each
        # Kept for the readers (and the tests) that only ever want the first.
        law['strict'] = each[0][:2]
        law['strictDrawn'] = each[0][2:]

    entry = {
        'id': sid,
        'kind': rule['kind'],
        'tier': tier,
        'field': source['fieldSha256'][:12],
        'rule': rule_block,
        'channelV': best['alternate'],
        'laws': law,
        'group': {
            'preserve': len(preserve), 'swap': len(swap),
            'keepGroup': group_row(match_group(group_index, keep_ops)),
            'picGroup': group_row(match_group(group_index, all_ops)),
            'pointOpsPreserving': sorted({g['name'] for g in preserve}),
            'pointOpsSwapping': sorted({g['name'] for g in swap}),
        },
        'symmetries': [row(g) for g in preserve + swap],
        'metrics': dict(best['metrics'], score=round(best['score'], 6)),
        # Whatever every entry would repeat lives at the top level instead: the
        # gate's name and limits in `gates`, the tile box and the loop length in
        # `gates.framing`.  Two thousand copies of one string is 60 kB of the
        # 4.5 MB ceiling and says nothing.
        'quality': {k: v for k, v in best['doubled'].items()
                    if k != 'boundaryByDirection'},
        'view': {'tiles': best['view']['tiles'], 'strandPixels': best['view']['strandPixels']},
        'featured': False,
    }
    entry['quality']['passed'] = 1 if best['gate']['passed'] else 0
    if best['gate']['failed']:
        entry['quality']['failed'] = best['gate']['failed']
    if rule['kind'] == 'half-period' and half_period_is_symmetry:
        entry['rule']['degenerate'] = 'T/2 is itself a symmetry of the field'
    return entry


def group_row(match):
    """A film-group match as [groupId, family, 1 if on a finer lattice], or null."""
    if not match['groupId']:
        return None
    return [match['groupId'], match['family'], 1 if match['onFinerLattice'] else 0]


def verify_laws(w, rule, n, m):
    """The three laws, measured rather than assumed.

    Every residual is rounded to nine SIGNIFICANT digits, not nine decimal
    places: a residual of 3e-10 rounded the second way ships as a flat 0.0
    beside an exact flag of 0, and a page that prints it then tells the reader
    the residual is zero when the arrays are not equal.
    """
    out = {}
    scale = float(np.abs(w).max()) or 1.0
    if rule['kind'] not in ('threshold',):
        if rule['kind'] == 'half-period':
            img = np.roll(w, -(m // 2), axis=0)
        else:
            img = gather(w, rule['P'], rule['c'], n)
        out['s'] = [round_floats(float(np.abs(img + w).max()) / scale),
                    1 if np.array_equal(img, -w) else 0]
    half = np.roll(w, -(m // 2), axis=0)
    out['halfPeriod'] = [round_floats(float(np.abs(half + w).max()) / scale),
                         1 if np.array_equal(half, -w) else 0]
    if rule['kind'] not in ('threshold', 'half-period'):
        both = gather(half, rule['P'], rule['c'], n)
        out['both'] = [round_floats(float(np.abs(both - w).max()) / scale),
                       1 if np.array_equal(both, w) else 0]
    return out


# --------------------------------------------------------------------------- driver


def worker(args):
    source, opts, groups_raw = args
    index = build_group_index(groups_raw)
    try:
        out = analyse_field(source, opts, index)
    except Exception as exc:                                   # noqa: BLE001
        import traceback
        return {'refused': {'fieldSha256': source['fieldSha256'],
                            'reason': f'{type(exc).__name__}: {exc}',
                            'traceback': traceback.format_exc()[-800:]}}
    out['fieldSha256'] = source['fieldSha256']
    return out


def round_floats(o, sig=9):
    if isinstance(o, float):
        if o != o or o in (float('inf'), float('-inf')):
            return o
        if o == 0:
            return 0.0
        r = round(o, max(0, sig - 1 - int(math.floor(math.log10(abs(o))))))
        return int(r) if r == int(r) and abs(r) < 1e15 else r
    if isinstance(o, dict):
        return {k: round_floats(v, sig) for k, v in o.items()}
    if isinstance(o, list):
        return [round_floats(v, sig) for v in o]
    return o


def sheet(previews, ids, cols=10, gutter=4):
    """A numpy montage of indexed previews, row major, with a grey gutter."""
    if not ids:
        return None
    tile = previews[ids[0]].shape[0]
    rows = (len(ids) + cols - 1) // cols
    out = np.full((rows * (tile + gutter) + gutter, cols * (tile + gutter) + gutter), 2,
                  dtype=np.uint8)
    for i, key in enumerate(ids):
        r, c = divmod(i, cols)
        y = gutter + r * (tile + gutter)
        x = gutter + c * (tile + gutter)
        out[y:y + tile, x:x + tile] = previews[key]
    return out


def same_orbit_block(fields):
    """Fields the motion test found to be one orbit reached twice.

    Not a candidate list and not an inference from agreeing metrics: each row is
    a measured point operation, node translation and (possibly sub-frame) phase
    shift that carries the dropped field onto the kept one, with the relative rms
    of what is left over.  The dropped field's film groups and families are on
    the survivor, which is why the catalog can say "one picture" and still file
    it under every group that hosts it.
    """
    out = []
    for key, f in sorted(fields.items()):
        for row in f.get('sameOrbit') or []:
            out.append({'kept': key, 'dropped': row['sha256'][:12], 'origin': row['origin'],
                        'op': row['op'], 'v': row['v'], 'frames': row['frames'],
                        'relRms': row['relRms'],
                        'groupIds': row['groupIds'], 'atlasIds': row['atlasIds']})
    return out


def counts_block(entries, fields):
    def tally(keyfn):
        out = {}
        for e in entries:
            for k in keyfn(e):
                out[k] = out.get(k, 0) + 1
        return dict(sorted(out.items()))

    fams = lambda e: fields[e['field']]['families'] or ['unclassified']
    model = lambda e: fields[e['field']]['model']
    field_rows = [fields[k] for k in {e['field'] for e in entries}]
    return {
        'entries': len(entries),
        'fields': len({e['field'] for e in entries}),
        'byTier': tally(lambda e: [e['tier']]),
        'byKind': tally(lambda e: [e['kind']]),
        'byFamily': tally(lambda e: fams(e)),
        'byModel': tally(lambda e: [model(e)]),
        'byLattice': tally(lambda e: [fields[e['field']]['lattice']]),
        'byChannel': tally(lambda e: [e['rule']['channel']]),
        'byTierModel': tally(lambda e: [f'{e["tier"]}|{model(e)}']),
        'byFamilyTier': tally(lambda e: [f'{f}|{e["tier"]}' for f in fams(e)]),
        'byFamilyTierModel': tally(
            lambda e: [f'{f}|{e["tier"]}|{model(e)}' for f in fams(e)]),
        'byFamilyKind': tally(lambda e: [f'{f}|{e["kind"]}' for f in fams(e)]),
        'byPreservingFamily': tally(
            lambda e: [(e['group']['keepGroup'] or [None, 'unnamed'])[1]]),
        'fieldsByOrigin': {k: sum(1 for f in field_rows if f['origin'] == k)
                           for k in sorted({f['origin'] for f in field_rows})},
        'fieldsByModel': {k: sum(1 for f in field_rows if f['model'] == k)
                          for k in sorted({f['model'] for f in field_rows})},
        'strictFields': len({e['field'] for e in entries if e['tier'] == 'strict'}),
        'fieldsWithoutAStrictPicture':
            len({e['field'] for e in entries}) - len({e['field'] for e in entries
                                                      if e['tier'] == 'strict'}),
        'featured': sum(1 for e in entries if e['featured']),
        'gatePassed': sum(1 for e in entries if e['quality']['passed']),
        'zeroSpeckle': sum(1 for e in entries if e['quality']['speckle'] == 0),
        'channelVFolded': sum(1 for e in entries if e.get('channelV')),
        'channelVSameFunction': sum(1 for e in entries
                                    if (e.get('channelV') or {}).get('sameFunction')),
        'strictExactlyDrawn': sum(1 for e in entries
                                  if (e['laws'].get('strictDrawn') or [0, 0])[1]),
        # Every chip the strict tier offers, and how many of them really do draw
        # the same picture -- an entry with no `strictEach` has all of its rows
        # exact, which is why it is omitted.
        'strictReadings': sum(len(e['rule'].get('strictReadings') or []) for e in entries),
        'strictReadingsNotBitExact': sum(
            1 for e in entries for row in (e['laws'].get('strictEach') or []) if not row[1]),
        'strictReadingsDrawnDifferently': sum(
            1 for e in entries for row in (e['laws'].get('strictEach') or []) if not row[3]),
        # The fact the tier does NOT decide: a free involution's picture may or
        # may not also be antisymmetric under the half-period wait, and on the
        # phase-symmetric equations it nearly always is.  Every sentence about
        # the broad tier and time has to come from here and not from `tier`.
        'broadHalfPeriodExact': sum(1 for e in entries if e['tier'] == 'broad'
                                    and (e['laws'].get('halfPeriod') or [0, 0])[1]),
        'broadHalfPeriodExactByModel': {
            k: sum(1 for e in entries if e['tier'] == 'broad'
                   and (e['laws'].get('halfPeriod') or [0, 0])[1]
                   and fields[e['field']]['model'] == k)
            for k in sorted({fields[e['field']]['model'] for e in entries})},
        'broadWithASwappingWait': sum(
            1 for e in entries if e['tier'] == 'broad'
            and any(row[4] == 0 and row[3] != 0 for row in e['symmetries'])),
        'antisymmetric': sum(1 for e in entries if e['group']['swap'] > 0),
        'exactSwapLaw': sum(1 for e in entries
                            if (e['laws'].get('s') or [0, 0])[1]),
    }


def select(entries, fields, budget_bytes, doc_builder, report):
    """Everything if it fits; otherwise a round robin over the (family, kind, model)
    cells so that what goes is the fourth picture of a crowded cell and never the
    only picture of a rare one."""
    protected, rest = [], []
    best_of_field = {}
    for e in entries:
        f = e['field']
        if f not in best_of_field or e['metrics']['score'] > best_of_field[f]['metrics']['score']:
            best_of_field[f] = e
    keep_ids = {e['id'] for e in best_of_field.values()}
    keep_ids |= {e['id'] for e in entries if e['featured'] or e.get('shippedPage')}
    # The strict tier is the spine -- one picture per field, and what the two
    # shipped pages are -- and the threshold is the control the other tiers are
    # read against.  A field must arrive with both, so neither is ever trimmed;
    # what goes is the fourth broad picture of a crowded cell.
    keep_ids |= {e['id'] for e in entries if e['kind'] in ('half-period', 'threshold')}
    for e in entries:
        (protected if e['id'] in keep_ids else rest).append(e)

    cells = {}
    for e in rest:
        fam = (fields[e['field']]['families'] or ['unclassified'])[0]
        cells.setdefault((fam, e['tier'], e['kind'], fields[e['field']]['model']), []).append(e)
    for lst in cells.values():
        lst.sort(key=lambda e: -e['metrics']['score'])
    order = []
    rank = 0
    while True:
        row = [lst[rank] for lst in cells.values() if len(lst) > rank]
        if not row:
            break
        row.sort(key=lambda e: -e['metrics']['score'])
        order.extend(row)
        rank += 1

    def size(kept):                       # the bytes that will be written, exactly
        return len(json.dumps(doc_builder(kept), separators=(',', ':')).encode())

    lo, hi = 0, len(order)
    if size(protected + order) <= budget_bytes:
        report['trimmed'] = 0
        return protected + order
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if size(protected + order[:mid]) <= budget_bytes:
            lo = mid
        else:
            hi = mid - 1
    report['trimmed'] = len(order) - lo
    report['trimmedIds'] = [e['id'] for e in order[lo:]]
    return protected + order[:lo]


def entry_sort_key(e, fields):
    f = fields[e['field']]
    return ((f['families'] or ['zz'])[0], TIER_ORDER.index(e['tier']), f['model'], e['kind'],
            -e['metrics']['score'], e['id'])


def prune(directory, keep, report):
    if not os.path.isdir(directory):
        return
    gone = 0
    for name in os.listdir(directory):
        if name.endswith('.png') and name not in keep:
            os.remove(os.path.join(directory, name))
            gone += 1
    report.append(f'{directory}: {gone} stale files removed')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--records', action='append', default=[])
    ap.add_argument('--no-atlas', action='store_true')
    ap.add_argument('--only', default=None, help='fields whose sha starts with this')
    ap.add_argument('--limit', type=int, default=None)
    ap.add_argument('--jobs', type=int, default=max(1, (os.cpu_count() or 4) - 2))
    ap.add_argument('--frames', type=int, default=8, help='frames in the cheap sweep')
    ap.add_argument('--per-kind', type=int, default=2, help='rules kept per kind per field')
    ap.add_argument('--separation', type=float, default=0.08,
                    help='least distance between two kept turn centres, in cell units')
    ap.add_argument('--tol', type=float, default=2e-6, help='relative rms for the shortlist')
    ap.add_argument('--residual', type=float, default=2e-7, help='max abs residual of a symmetry')
    ap.add_argument('--out', default=os.path.join(OUT_DIR, 'monochrome-atlas.json'))
    ap.add_argument('--thumb-size', type=int, default=512)
    ap.add_argument('--thumb-bytes', type=int, default=40000)
    ap.add_argument('--json-mb', type=float, default=4.5)
    ap.add_argument('--no-thumbs', action='store_true')
    ap.add_argument('--no-prune', action='store_true')
    ap.add_argument('--sheets', default=None, help='write per-family contact sheets here')
    ap.add_argument('--preview-size', type=int, default=128)
    ap.add_argument('--sheet-top', type=int, default=60,
                    help='tiles per family contact sheet, at most one per field')
    ap.add_argument('--strips', default=None, help='write 12-frame inspection strips here')
    ap.add_argument('--orbit-mb', type=float, default=200.0,
                    help='ceiling on NEW field bytes copied in from --records')
    ap.add_argument('--per-cell', type=int, default=3,
                    help='record fields shipped per (family, equation) cell')
    ap.add_argument('--motion-tol', type=float, default=1e-3,
                    help='relative rms under which two fields are one orbit')
    ap.add_argument('--no-collapse', action='store_true',
                    help='skip the motion test that collapses repeated orbits')
    ap.add_argument('--upscale', type=int, default=2,
                    help='reconstruction factor the quality gate is measured on')
    ap.add_argument('--max-speckle', type=float, default=1e-4)
    ap.add_argument('--max-strand-cells', type=float, default=0.75,
                    help='a strand wider than this fraction of a cell is not a picture')
    ap.add_argument('--tile-pixels', type=int, default=380,
                    help='the CSS box one tile is drawn in, for view.tiles')
    ap.add_argument('--strand-pixels', type=float, default=34.0,
                    help='the CSS width view.tiles aims one strand at (band 20-60)')
    ap.add_argument('--tiles-max', type=int, default=8)
    ap.add_argument('--loop-seconds', type=float, default=8.0)
    ap.add_argument('--plan', action='store_true',
                    help='print which record fields would be copied in, and stop')
    args = ap.parse_args(argv)

    t0 = time.time()
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(THUMB_DIR, exist_ok=True)
    if args.strips:
        os.makedirs(args.strips, exist_ok=True)
    if args.sheets:
        os.makedirs(args.sheets, exist_ok=True)

    with open(ATLAS) as fh:
        atlas = json.load(fh)
    with open(GROUPS) as fh:
        groups = json.load(fh)

    refused = []
    report = {}
    models = model_table(atlas)
    sources = [] if args.no_atlas else atlas_fields(atlas)
    records = record_fields(args.records, refused)
    report['recordsAdmitted'] = len(records)
    report['recordBytesAdmitted'] = sum(r['fieldByteLength'] for r in records)
    known = {s['fieldSha256'] for s in sources}
    deduped = []
    for rec in records:
        if rec['fieldSha256'] in known:
            refused.append({'source': rec['recordDir'], 'reason': 'already catalogued'})
            continue
        known.add(rec['fieldSha256'])
        deduped.append(rec)
    records = deduped

    if args.only:
        sources = [s for s in sources if s['fieldSha256'].startswith(args.only)]
        records = [s for s in records if s['fieldSha256'].startswith(args.only)]
    sources.sort(key=lambda s: s['fieldSha256'])
    records.sort(key=lambda s: s['fieldSha256'])

    # One orbit reached twice is one picture.  The motion test runs over the
    # atlas and the whole record corpus together, BEFORE anything is chosen, so
    # the budget below is never spent on a copy of a field already in the repo
    # and "distinct by motion" means what it says.
    if args.no_collapse:
        for src in sources + records:
            src.setdefault('sameOrbit', [])
        report['orbitClassesCollapsed'] = 0
    else:
        print(f'collapsing {len(sources) + len(records)} fields onto orbit classes',
              file=sys.stderr)
        merged, _ = orbit_classes(sources + records, args.motion_tol, args.jobs, report)
        sources = [s for s in merged if s['origin'] == 'atlas']
        records = [s for s in merged if s['origin'] == 'record']
        print(f'  {report["orbitClassesCollapsed"]} fields were another field moved',
              file=sys.stderr)

    # Orbit bytes are the cost of this catalog.  Choose a spread, and say where
    # the rest live rather than copying a gigabyte into the repository.
    chosen, left_on_disk = choose_records(records, sources, int(args.orbit_mb * 1e6),
                                          args.per_cell, report)
    if args.plan:
        cells = {}
        for src in chosen:
            key = ((src['families'] or ['unclassified'])[0], src['model'])
            cells.setdefault(key, []).append(src)
        for key in sorted(cells):
            print(f'{key[0]:<6} {key[1]:<18} {len(cells[key])}', file=sys.stderr)
            for src in cells[key]:
                print(f'    {src["fieldSha256"][:12]} {src["lattice"]:<11} '
                      f'{"stripe" if src["singleMode"] else "      "} '
                      f'{src["fieldByteLength"] / 1e6:5.2f} MB  {src["selectedBecause"]}',
                      file=sys.stderr)
        print(f'\n{report["recordsShipped"]} records, '
              f'{report["recordBytesShipped"] / 1e6:.1f} MB in; '
              f'{len(left_on_disk)} records, {report["recordBytesOnDisk"] / 1e6:.0f} MB left '
              f'on disk; {report.get("orbitClassesCollapsed", 0)} fields collapsed',
              file=sys.stderr)
        return 0

    sources = sources + chosen
    if args.limit:
        sources = sources[:args.limit]

    # Copy in the fields of the records that were chosen -- and only those, so
    # that `--limit 8` against a thousand-record batch copies eight fields and
    # not a gigabyte.  Every copy is re-hashed on the way in.
    kept_sources = []
    for src in sources:
        if src['origin'] != 'record':
            kept_sources.append(src)
            continue
        os.makedirs(ORBITS_DIR, exist_ok=True)
        dest = os.path.join(ORBITS_DIR, src['fieldSha256'] + '.f32')
        if not os.path.exists(dest):
            shutil.copyfile(src['fieldPath'], dest)
        with open(dest, 'rb') as fh:
            digest = hashlib.sha256(fh.read()).hexdigest()
        if digest != src['fieldSha256']:
            refused.append({'source': src['recordDir'], 'reason': 'sha256 mismatch'})
            os.remove(dest)
            continue
        src['fieldPath'] = dest
        src['fieldUrl'] = 'monochrome/data/orbits/' + src['fieldSha256'] + '.f32'
        kept_sources.append(src)
    sources = kept_sources
    print(f'{len(sources)} fields, {args.jobs} workers', file=sys.stderr)

    limits = {'speckle': args.max_speckle, 'white': (0.30, 0.70),
              'boundaryDensity': 0.002, 'wRelRange': 0.02,
              'strandCells': args.max_strand_cells}
    opts = {'frames': args.frames, 'tol': args.tol, 'residual': args.residual,
            'per_kind': {'half-turn': args.per_kind, 'mirror': args.per_kind,
                         'glide': args.per_kind, 'half-shift': 1},
            'separation': args.separation,
            'thumbs': not args.no_thumbs, 'thumb_size': args.thumb_size,
            'strips': args.strips, 'previews': bool(args.sheets),
            'preview_size': args.preview_size,
            'upscale': args.upscale, 'limits': limits,
            'tile_pixels': args.tile_pixels, 'want_pixels': args.strand_pixels,
            'tiles_max': args.tiles_max, 'loop_seconds': args.loop_seconds}

    fields, entries, previews = {}, [], {}
    by_sha = {s['fieldSha256']: s for s in sources}
    done = 0
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        for out in pool.map(worker, [(s, opts, groups) for s in sources], chunksize=1):
            done += 1
            if done % 25 == 0:
                print(f'  {done}/{len(sources)}', file=sys.stderr)
            if 'refused' in out:
                refused.append(out['refused'])
                continue
            src = by_sha[out['fieldSha256']]
            key = src['fieldSha256'][:12]
            fields[key] = {
                'sha256': src['fieldSha256'],
                'fieldUrl': src['fieldUrl'],
                'byteLength': src['fieldByteLength'] or src['M'] * 2 * src['N'] ** 2 * 4,
                'N': src['N'], 'M': src['M'], 'L': src['L'], 'period': src['period'],
                'lattice': src['lattice'], 'model': src['model'], 'params': src['params'],
                'atlasIds': src['atlasIds'], 'groupIds': src['groupIds'],
                'families': src['families'], 'names': src['names'],
                'origin': src['origin'],
                # 'new-shooting' / 'audited-subgroup' for an atlas orbit: the
                # split the Gray-Scott paragraph counts.
                'provenanceKind': src.get('provenanceKind') or src['origin'],
                'fieldSymmetries': out['fieldSymmetries'],
                'involutionClasses': out['sweep']['classes'],
                'involutionsVanishing': out['sweep']['vanished'],
                'involutionsCollapsingToHalfPeriod': out['sweep']['collapsed'],
                'rulesGatedOut': out['sweep']['gated'],
                'sameOrbit': src.get('sameOrbit') or [],
                'seconds': out['seconds'],
            }
            if src['origin'] == 'record':
                fields[key].update({
                    'recordDir': src['recordDir'], 'batch': src['batch'],
                    'singleMode': 1 if src['singleMode'] else 0,
                    'selectedBecause': src.get('selectedBecause'),
                    'jobLabel': src['jobLabel'], 'strategy': src['strategy'],
                })
            if src['fieldSha256'] in SHIPPED:
                fields[key]['shippedPage'] = SHIPPED[src['fieldSha256']]
            entries.extend(out['entries'])
            previews.update(out.get('previews') or {})

    for e in entries:
        e['featured'] = e['id'] in FEATURED
        if e['featured']:
            e['featuredWhy'] = FEATURED[e['id']]
        ship = fields[e['field']].get('shippedPage')
        if ship and ship['kind'] == e['kind'] and e['rule']['channel'] == 'u':
            e['shippedPage'] = {
                'page': ship['page'], 'name': ship['name'],
                'matchesPublishedGroup': (e['group']['preserve'] == ship['preserve']
                                          and e['group']['swap'] == ship['swap']),
                'published': {'preserve': ship['preserve'], 'swap': ship['swap']},
            }


    # Round once, here, so that the budget is measured on the bytes that ship.
    entries = [round_floats(e) for e in entries]
    fields = round_floats(fields)
    entries.sort(key=lambda e: entry_sort_key(e, fields))

    def doc_builder(kept):
        kept = sorted(kept, key=lambda e: entry_sort_key(e, fields))
        used = {e['field'] for e in kept}
        return {
            'schema': SCHEMA,
            'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'scope': (
                'Two-colour (black and white) pictures of the verified orbits of '
                '../../scott-gray/data/wallpaper-atlas.json and of the offline equation '
                'searches under ../../scott-gray/research/. Each entry is the sign of a '
                'difference field w; the rule says which difference and `tier` says how '
                'strong the claim is. Everything under `laws`, `group`, `symmetries` and '
                '`metrics` is measured on the saved nodes in integer index arithmetic, not '
                'asserted; `quality` is measured on the doubled grid the viewer draws.'),
            'shape': {
                'entries': 'sorted by family, tier, model, kind, then legibility score',
                'tier': 'strict / broad / control; tiers[tier] is the descriptor. It is a '
                        'property of the involution s against the FIELD, not of the picture. '
                        'strict means s satisfies U(s x, t + T/2) = U(x, t) exactly, so the '
                        'picture is the half-period picture and a field has at most one of '
                        'them; broad means s is free -- it exchanges the inks by the algebra of '
                        'subtraction and by no symmetry of the field -- which says nothing '
                        'either way about the half-period wait, and laws.halfPeriod is where '
                        'that is measured; control is the threshold, which exchanges nothing.',
                'rule.strictReadings': 'packed rows [ruleKindCode, pointOpIndex, vx, vy]: every '
                                       'involution whose (s, T/2) is an exact symmetry of the '
                                       'field. They all compute this one function; present only '
                                       'on a strict entry, and non-empty there by definition. '
                                       'laws.strictEach carries the measurement of each one, '
                                       'row for row.',
                'rule.sIsFieldSymmetryAt': 'the whole saved frames k with U(s x, t + k) = U(x, t) '
                                           'exactly, or -1 when s is a symmetry of the field at '
                                           'no k at all -- which is what makes the involution '
                                           'free and the tier broad. Absent on half-period and '
                                           'threshold, whose rule has no spatial s.',
                'channelV': 'the other channel of the same field, drawn by the same rule: '
                            '{channel, lagFrames, lag, agreement, inverted, sameFunction, score, '
                            'boundaryDensity}. V is the U picture at a lag, not a second '
                            'picture, so it is an option on this entry (?channel=v) and never a '
                            'separate one. sameFunction is 1 when the two are exactly one '
                            'picture shifted; agreement is the fraction of node-frames that '
                            'match at the best lag; inverted is 1 when they match with the inks '
                            'exchanged. null when the rule vanishes on the other channel.',
                'quality': 'measured on the spectrally doubled grid (grid = 2N nodes a cell) '
                           'with the boolean w > 0 the viewer draws, NOT on the saved node grid: '
                           'on the node grid the exact zero set along a colour-reversing mirror '
                           'is counted as speckle and the published speckle-free Weave scores '
                           '0.084. strandNodes is the mean run of one ink in SAVED nodes -- the '
                           'doubled-grid run divided by two -- and strandCells the same as a '
                           'fraction of the cell, so strandCells = 2 * strandNodes / grid; '
                           '`failed` lists the gates a picture misses.',
                'view': 'how to frame it: draw `tiles` cells across a `tilePixels` box and one '
                        'strand lands `strandPixels` wide, inside the 20-60 CSS pixel band the '
                        'two shipped pages sit in. A fixed tile count does not work -- the '
                        'coarsest pictures show one strand at tiles = 2 and the finest show ten.',
                'symmetries': 'packed rows [pointOpIndex, vx, vy, frames, 1 preserve / 0 swap]; '
                              'vx, vy are whole nodes and frames whole saved frames, so the '
                              'operation is x -> M x + v, t -> t + frames, and the row says '
                              'whether it keeps the two inks or exchanges them',
                'pointOpIndex': 'an index into pointOps[field.lattice].ops',
                'rule.sameAs': 'packed rows [ruleKindCode, pointOpIndex, vx, vy, noteCode, dt, '
                               'dy, dx, sign]: other rules of this field that draw this same '
                               'picture. ruleKindCodes is the code table, notes[noteCode] says '
                               'why, and where sign is not 0 the claim is exact and checkable -- '
                               'thisPicture[t, y, x] = sign * thatPicture[t + dt, y + dy, x + dx] '
                               'at every saved node-frame. sign 0 means the relation is a '
                               'conjugation by a point operation, which four integers do not '
                               'describe.',
                'laws': 's = the rule motion, halfPeriod = a shift of T/2, both = the two '
                        'together; each is [relative residual, 1 if exact on every saved '
                        'node-frame]. `both` is absent where the rule has no spatial motion; on '
                        'a half-period entry `s` IS the half-period shift and equals '
                        '`halfPeriod`, and only the threshold drops both. On a strict entry, '
                        '`strictEach` is one row per rule.strictReadings row, in the same order: '
                        '[relative residual, 1 if bit-exact, fraction of node-frames where the '
                        'DRAWN inks are not exchanged, 1 if none]. It is omitted, to save bytes, '
                        'exactly when every row would be [0, 1, 0, 1] -- so a strict entry '
                        'without it has every reading bit-exact. `strict` and `strictDrawn` '
                        'are the first row split in two, kept for readers that only want it. '
                        'Where the drawn fraction is not 0, the mismatching samples are where '
                        '|w| is at the float32 noise floor: on a symmetric reading that includes '
                        'the fixed set of s -- the centres of a half turn, the line of a mirror '
                        '-- where antisymmetry forces w to vanish and the saved samples give '
                        '1e-9 instead, but it is not confined to it (a half slide has no fixed '
                        'node and still mismatches on a few) and both inks occur there.',
                'group.keepGroup': '[filmGroupId, family, 1 if the match needed the finer '
                                   'lattice the picture lives on] for the colour-PRESERVING '
                                   'subgroup, or null when it is none of the 68 forward film '
                                   'groups; picGroup is the same for the whole group with the '
                                   'two inks forgotten',
                'thumbnail': 'DERIVED, never stored on an entry: thumbs.base + the entry id '
                             'with every ":" replaced by "-" + ".png"',
                'floats': 'rounded to 9 significant digits; every exact claim is an integer',
                'fields': 'one record per distinct field file, keyed by the first 12 hex '
                          'digits of its sha256; entry.field is that key',
                'fields.sameOrbit': 'fields the motion test found to BE this one -- a point '
                                    'operation, node translation and (possibly sub-frame) phase '
                                    'shift apart. Their film groups and families are merged into '
                                    'this record, so one picture is listed once and still filed '
                                    'under every group that hosts it.',
                'fieldUrl': 'relative to docs/, and the bytes are M frames x 2 channels '
                            '(U then V) x N x N float32 little-endian, x fastest',
                'recordsOnDisk': 'admitted search records whose field was NOT copied into the '
                                 'repository: columns names the fields of each packed row. They '
                                 'exist at `dir` in a working copy of the research tree and can '
                                 'be folded in with --records and a bigger --orbit-mb.',
            },
            'tiers': TIERS,
            'gates': {
                'version': QUALITY_GATE,
                'measuredOn': f'the spectrally x{args.upscale} doubled grid, boolean w > 0',
                'measuredHow': 'the doubling here is FFT zero-padding with the Nyquist row '
                               'halved; ../mono-renderer.mjs doubles with the half-sample '
                               'Dirichlet kernel. The two agree in VALUE to 1e-14, but `white` '
                               'and `churn` are booleans of w > 0, so they can differ by a few '
                               'parts in a thousand across the exact zero contour (on the Weave, '
                               'white 0.4966 here against 0.4896 there). boundaryDensity, '
                               'strandCells and view.tiles are identical on both paths, and the '
                               'gated white band 0.3-0.7 has orders of magnitude of margin, so '
                               'nothing is misgated by the difference.',
                'limits': {'speckle': args.max_speckle, 'white': [0.30, 0.70],
                           'boundaryDensity': 0.002, 'wRelRange': 0.02,
                           'strandCells': args.max_strand_cells},
                'symmetryResidual': args.residual,
                'symmetryResidualMeans': 'the largest absolute error a field symmetry may have '
                                         'and still count. It is why laws.strict can be a part '
                                         'in 1e8 rather than exactly 0: (s, T/2) holds on the '
                                         'saved float32 samples to this, not to the last bit.',
                'framing': {'tilePixels': args.tile_pixels, 'strandPixels': args.strand_pixels,
                            'band': [20, 60], 'tilesMax': args.tiles_max},
                'appliesTo': 'half-period and threshold entries are kept whatever they score, '
                             'because the strict tier is one picture per field and the control '
                             'is the comparison; every broad entry must pass.',
            },
            'thumbs': {'base': 'data/thumbs/', 'size': args.thumb_size,
                       'span': 'entry.view.tiles',
                       'what': 'the sign of w at phase 0, entry.view.tiles cells across, '
                               'band-limited upsampled; white w > 0, black w < 0'},
            'notes': NOTES,
            'ruleKindCodes': KIND_CODE,
            'pointOps': {name: {'ops': [{'name': n, 'M': [list(r) for r in mat], 'what': what}
                                        for n, mat, what in table]}
                         for name, table in OPS.items()},
            'ruleKinds': RULE_KINDS,
            # The paragraphs are written against the fields that actually ship,
            # so a trimmed build describes itself and not the mined corpus.
            'models': describe_models(
                models, {k: v for k, v in fields.items() if k in used}, kept),
            'families': groups.get('families'),
            'classics': CLASSICS,
            'counts': counts_block(kept, fields),
            'sameOrbit': same_orbit_block({k: v for k, v in fields.items() if k in used}),
            'fields': {k: v for k, v in sorted(fields.items()) if k in used},
            'entries': kept,
            'recordsOnDisk': {
                'columns': ['sha12', 'model', 'family', 'groupId', 'lattice', 'singleMode',
                            'bytes', 'dir'],
                'note': 'admitted, verified, and left where they are: see provenance.orbitBudget',
                'rows': [[s['fieldSha256'][:12], s['model'], (s['families'] or [None])[0],
                          (s['groupIds'] or [None])[0], s['lattice'],
                          1 if s['singleMode'] else 0, s['fieldByteLength'], s['recordDir']]
                         for s in sorted(left_on_disk, key=lambda s: s['fieldSha256'])],
            },
            'refused': refused,
        }

    ids = [e['id'] for e in entries]
    if len(set(ids)) != len(ids):
        from collections import Counter
        dup = [i for i, c in Counter(ids).items() if c > 1]
        print(f'  WARNING: {len(dup)} duplicate entry ids, e.g. {dup[:4]}', file=sys.stderr)
    # `provenance` and the classics' measurements are added after the budget is
    # measured, so the budget keeps a reserve for them and the final size is
    # asserted against the ceiling below.
    ceiling = int(args.json_mb * 1e6)
    kept = select(entries, fields, ceiling - 80000, doc_builder, report)
    doc = round_floats(doc_builder(kept))

    # The two classics are load-bearing: the catalog reproduces two pages the
    # site already ships, or it is wrong.  Checked here rather than in a test so
    # that a bad catalog is never written in the first place.
    classic_report = {}
    partial = bool(args.only or args.limit or args.no_atlas)
    for name, want in CLASSICS.items():
        hit = [e for e in kept if e['field'] == want['field'] and e['kind'] == want['kind']
               and e['rule']['channel'] == 'u']
        if not hit and partial:
            continue                        # a trial build of a few fields, not the catalog
        if not hit:
            raise SystemExit(f'the catalog lost {name} ({want["field"]}, {want["kind"]})')
        e = hit[0]
        if (e['group']['preserve'], e['group']['swap']) != (want['preserve'], want['swap']):
            raise SystemExit(f'{name}: measured {e["group"]["preserve"]}+{e["group"]["swap"]}, '
                             f'{want["page"]} publishes {want["preserve"]}+{want["swap"]}')
        if e['tier'] != want['tier']:
            raise SystemExit(f'{name}: tier {e["tier"]}, expected {want["tier"]}')
        if e['quality']['speckle'] != 0:
            raise SystemExit(f'{name}: speckle {e["quality"]["speckle"]} on the doubled grid, '
                             'and it is published as speckle-free')
        classic_report[name] = e['id']
        doc['classics'][name]['entry'] = e['id']
        doc['classics'][name]['measured'] = {
            'preserve': e['group']['preserve'], 'swap': e['group']['swap'],
            'strandNodes': e['quality']['strandNodes'], 'speckle': e['quality']['speckle'],
            'tiles': e['view']['tiles'], 'strandPixels': e['view']['strandPixels'],
        }

    doc['provenance'] = {
        'builderSha256': hashlib.sha256(open(__file__, 'rb').read()).hexdigest(),
        'atlasSha256': hashlib.sha256(open(ATLAS, 'rb').read()).hexdigest(),
        'groupsSha256': hashlib.sha256(open(GROUPS, 'rb').read()).hexdigest(),
        'numpy': np.__version__, 'python': sys.version.split()[0],
        'seconds': round(time.time() - t0, 1),
        'mined': len(entries), 'shipped': len(kept), 'trimmed': report.get('trimmed', 0),
        'sources': {'atlas': not args.no_atlas, 'records': args.records},
        'orbitClasses': {
            'collapsed': report.get('orbitClassesCollapsed', 0),
            'buckets': report.get('orbitClassBuckets', 0),
            'tol': args.motion_tol,
            'how': 'motion_match: one point operation, node translation and sub-frame phase '
                   'shift, confirmed at a relative rms under tol',
        },
        'orbitBudget': {
            'ceilingBytes': int(args.orbit_mb * 1e6),
            'perCell': args.per_cell,
            'recordsAdmitted': report.get('recordsAdmitted', 0),
            'recordBytesAdmitted': report.get('recordBytesAdmitted', 0),
            'recordOrbits': report.get('recordsSeen', 0),
            'recordsShipped': report.get('recordsShipped', 0),
            'bytesShipped': report.get('recordBytesShipped', 0),
            'recordsOnDisk': len(left_on_disk),
            'bytesOnDisk': report.get('recordBytesOnDisk', 0),
            'policy': 'every Modal orbit that is not a single-mode stripe wave, the first orbit '
                      'of every (family, equation) cell, then up to perCell per cell preferring '
                      'a new film group and a new parameter set',
            'reads': 'recordsAdmitted is every record the searches wrote that passed its own '
                     'certificate; recordOrbits is how many distinct ORBITS those are once the '
                     'motion test has collapsed the repeats; recordsShipped is how many of those '
                     'earned repository bytes, and recordsOnDisk the rest, which stay in the '
                     'research tree and are listed in recordsOnDisk.',
        },
        'classics': classic_report,
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w') as fh:
        json.dump(doc, fh, separators=(',', ':'))
    size = os.path.getsize(args.out)
    if size > ceiling:
        raise SystemExit(f'{args.out}: {size} bytes, over the {ceiling} ceiling')

    notes = []
    if not args.no_thumbs and not args.no_prune:
        prune(THUMB_DIR, {thumb_name(e['id']) for e in kept}, notes)
    if not args.no_prune and os.path.isdir(ORBITS_DIR):
        wanted = {os.path.basename(fields[e['field']]['fieldUrl']) for e in kept}
        gone = 0
        for name in os.listdir(ORBITS_DIR):
            if name.endswith('.f32') and name not in wanted:
                os.remove(os.path.join(ORBITS_DIR, name))
                gone += 1
        if gone:
            notes.append(f'{ORBITS_DIR}: {gone} orbit copies no build wanted, removed')
    big = []
    for e in kept:
        p = os.path.join(OUT_DIR, 'thumbs', thumb_name(e['id']))
        if os.path.exists(p) and os.path.getsize(p) > args.thumb_bytes:
            big.append((thumb_name(e['id']), os.path.getsize(p)))
    if big:
        notes.append(f'{len(big)} thumbnails over {args.thumb_bytes} bytes, largest {max(b[1] for b in big)}')

    if args.sheets and previews:
        by_family = {}
        for e in kept:
            if e['id'] not in previews:
                continue
            for fam in (fields[e['field']]['families'] or ['unclassified']):
                by_family.setdefault(fam, []).append(e)
        for fam, lst in sorted(by_family.items()):
            # Strict first, because it is the spine the Showcase is built on and
            # the tier `featured` should mostly come from; then by legibility.
            lst.sort(key=lambda e: (TIER_ORDER.index(e['tier']), -e['metrics']['score']))
            seen, spread = set(), []
            for e in lst:                       # one per field, so the sheet shows variety
                if e['field'] in seen:
                    continue
                seen.add(e['field'])
                spread.append(e)
            lst = spread[:args.sheet_top]
            ids = [e['id'] for e in lst]
            img = sheet(previews, ids)
            write_png(os.path.join(args.sheets, f'{fam}.png'), img, INK[:3])
            with open(os.path.join(args.sheets, f'{fam}.txt'), 'w') as fh:
                for i, e in enumerate(lst):
                    r, c = divmod(i, 10)
                    fh.write(f"{r},{c}\t{e['id']}\t{e['tier']}\t{e['kind']}\t"
                             f"{fields[e['field']]['model']}\t"
                             f"score {e['metrics']['score']:.3f}\t"
                             f"strand {e['quality']['strandNodes']}\t"
                             f"tiles {e['view']['tiles']}\t"
                             f"speckle {e['quality']['speckle']}\t"
                             f"{e['group']['preserve']}+{e['group']['swap']}\n")

    counts = doc['counts']
    print(f"{len(entries)} mined, {len(kept)} shipped, {size} bytes "
          f"({size / 1e6:.2f} MB), {len(fields)} fields, {len(refused)} refused, "
          f"{time.time() - t0:.0f}s", file=sys.stderr)
    for n in notes:
        print('  ' + n, file=sys.stderr)
    print('  tiers: ' + ', '.join(f'{k} {v}' for k, v in counts['byTier'].items()), file=sys.stderr)
    print('  kinds: ' + ', '.join(f'{k} {v}' for k, v in counts['byKind'].items()), file=sys.stderr)
    print('  models: ' + ', '.join(f'{k} {v}' for k, v in counts['byModel'].items()),
          file=sys.stderr)
    print('  families: ' + ', '.join(f'{k} {v}' for k, v in counts['byFamily'].items()),
          file=sys.stderr)
    ob = doc['provenance']['orbitBudget']
    print(f"  orbits: {ob['recordsShipped']} record fields copied in "
          f"({ob['bytesShipped'] / 1e6:.0f} MB), {ob['recordsOnDisk']} left on disk "
          f"({ob['bytesOnDisk'] / 1e6:.0f} MB); {doc['provenance']['orbitClasses']['collapsed']} "
          f"fields were another field moved", file=sys.stderr)
    return 0


if __name__ == '__main__':
    main()
