"""Write marking.json for the page builder.  Run: python3 export.py

NOTE: this OVERWRITES marking.json in this directory, which is the file the
viewer's marking.data.mjs is generated from.
"""
import json, time, subprocess
from itertools import product
from chair import *

MARKS = marking_to_facet_marks(M24)
FRAMES = child_frames(M24)
NOTCH = (1, 1, 1)


def inv(pose):
    L, t = pose
    p, s = L
    pinv = [0, 0, 0]
    for a in range(3):
        pinv[p[a]] = a
    Linv = (tuple(pinv), tuple(s[pinv[a]] for a in range(3)))
    return (Linv, lin(Linv, (-t[0], -t[1], -t[2])))


def rel(p1, p2):
    return pose_compose(inv(p1), p2)


BASE = Tile((IDENT, (0, 0, 0)), MARKS)
A44, AIMP = [], []
for L in ALL_L:
    for t in product(range(-4, 5), repeat=3):
        tl = Tile((L, t), MARKS)
        if BASE.cells & tl.cells or not contacts(BASE, tl):
            continue
        if pair_legal(BASE, tl)[0]:
            (A44 if det(L) == 1 else AIMP).append((L, t))
A44.sort(); AIMP.sort()
ROLE = {rel(FRAMES[a], FRAMES['dent']): a for a in K}

TYPENAME = {'F': 'purple-filled', 'H': 'purple-hollow', 'B': 'blue'}

facets = []
for f in sorted(FACETS):
    c, d = f
    ty, v = MARKS[f]
    corners = facet_corners(f)
    opp = tuple(2 * (sum(x[i] for x in corners) / 4.0) - v[i] for i in range(3))
    facets.append({
        'id': len(facets),
        'cell': list(c),
        'outward_normal': list(d),
        'axis': 'xyz'[facet_axis(f)],
        'is_notch_facet': add(c, d) == NOTCH,
        'corners': [list(x) for x in corners],
        'mark': {
            'type': ty,
            'name': TYPENAME[ty],
            'site': list(v),
            # the arrow is drawn along the facet diagonal, tail at the corner
            # opposite the site, head at the site
            'arrow_tail': [int(round(x)) for x in opp],
            'arrow_head': list(v),
        },
    })

stars = {}
for kk in list(K) + ['dent']:
    key = 'dent' if kk == 'dent' else ''.join(map(str, kk))
    stars[key] = {'site': list(KEY_SITE[kk]),
                  'x': M24[kk][0], 'y': M24[kk][1], 'z': M24[kk][2]}

out = {
    '_about': 'Reconstruction of the marked 3-D chair that Chaim Goodman-Strauss '
              'drew on 2026-09-17, with the marking M24 determined by the drawing '
              'and verified by computation.  See tiling-spec.md.',
    '_generated': time.strftime('%Y-%m-%dT%H:%M:%S'),
    'conventions': {
        'cell': 'an integer triple c denotes the closed unit cube [c, c+1].',
        'chair': 'C = [0,2]^3 minus [1,2]^3 = the 7 cells {0,1}^3 minus (1,1,1).',
        'far_corner': [0, 0, 0],
        'notch_cell': [1, 1, 1],
        'concave_corner': [1, 1, 1],
        'facet': 'a unit square of the boundary, written (cell, outward normal); '
                 'there are 24, of which 21 outer and 3 in the notch.',
        'site': 'the marked corner of a facet: the concave corner (1,1,1) for the '
                'three notch facets, otherwise 2*cell.  There are 8 sites, each '
                'shared by exactly 3 facets.',
        'pose': 'a signed permutation (perm, signs) with (L v)_i = signs_i * '
                'v_{perm_i}, plus an integer translation.',
        'orientations': 'the 24 orientation-preserving cubic frames.  Reflected '
                        'copies are NOT allowed (see the caveats in tiling-spec.md).',
    },
    'symbols': {
        'F': {'name': 'purple-filled', 'glyph': 'solid triangular arrowhead',
              'matches': 'H'},
        'H': {'name': 'purple-hollow', 'glyph': 'open hook / V arrowhead',
              'matches': 'F'},
        'B': {'name': 'blue', 'glyph': 'pale-blue arrow', 'matches': 'B'},
    },
    'matching_rule': {
        'statement': 'Two chairs may share a unit facet only if the two marks on '
                     'it point at the SAME corner of that square and their types '
                     'are complementary: purple-filled with purple-hollow, blue '
                     'with blue.',
        'complement': {'F': 'H', 'H': 'F', 'B': 'B'},
    },
    'stars': stars,
    'facets': facets,
    'substitution': {
        'supertile': 'S = [0,4]^3 minus [2,4]^3 = the chair at scale 2',
        'children': [
            {'slot': ('dent' if k == 'dent' else ''.join(map(str, k))),
             'role': ('central' if k == 'dent' else 'corner'),
             'perm': list(FRAMES[k][0][0]), 'signs': list(FRAMES[k][0][1]),
             'translation': list(FRAMES[k][1]), 'det': det(FRAMES[k][0])}
            for k in list(K) + ['dent']],
        'note': 'These eight frames are FORCED by the requirement that the '
                'supertile, read at double scale, carries the same marking.',
    },
    'contact_atlas': {
        'proper': [{'perm': list(L[0]), 'signs': list(L[1]), 'translation': list(t)}
                   for (L, t) in A44],
        'proper_count': len(A44),
        'improper_count': len(AIMP),
        'improper': [{'perm': list(L[0]), 'signs': list(L[1]), 'translation': list(t)}
                     for (L, t) in AIMP],
        'note': 'the 44 orientation-preserving entries are identical, as a set '
                'of poses, to the 44-pose contact atlas A44 reported for '
                "Tsiokos's Chair44 (2026), as transcribed in "
                'tiling-matching-system.json.  That transcription, not the '
                'paper itself, is what the comparison is against.',
    },
    'notch_fillers': [
        {'slot': ''.join(map(str, ROLE[p])), 'perm': list(p[0][0]),
         'signs': list(p[0][1]), 'translation': list(p[1])}
        for p in sorted(ROLE)],
    'verification': json.load(open('verify_out.json')),
}
for name in ('force_out.json', 'force2_out.json', 'force3_out.json',
             'force4_out.json', 'search_out.json', 'classes_out.json'):
    try:
        out['verification'][name[:-5]] = json.load(open(name))
    except Exception as e:
        out['verification'][name[:-5]] = {'error': str(e)}


# --- Tsiokos panel IDs -> our facets (see panelmap.py) -----------------------
from fractions import Fraction
_ts = json.load(open('tiling-matching-system.json'))
_cls = {}
for nm, ps in {'A': [0,2,7,9,11,14,20,21], 'B': [1,4,6,8,12,15,18,19],
               'C': [3,5,10,13,16,17,22,23]}.items():
    for q in ps:
        _cls[q] = nm
_pm = []
for q in _ts['panels']:
    ax = q['normal_axis']; sg = q['outward_sign']
    ctr = [Fraction(x) for x in q['panel_centre']]
    dv = [0, 0, 0]; dv[ax] = sg; dv = tuple(dv)
    cell = tuple((int(ctr[i]) - (1 if sg == 1 else 0)) if i == ax
                 else int(ctr[i] - Fraction(1, 2)) for i in range(3))
    _pm.append({'panel': q['panel'], 'tsiokos_motif': _cls[q['panel']],
                'symbol': MARKS[(cell, dv)][0], 'cell': list(cell),
                'outward_normal': list(dv), 'is_notch': q['is_notch_panel']})
# derived, not asserted: the correspondence flips with the chirality
_dict = {}
for _r in _pm:
    _dict.setdefault(_r['tsiokos_motif'], _r['symbol'])
    assert _dict[_r['tsiokos_motif']] == _r['symbol'], 'motif classes do not coincide'
_LONG = {'F': 'purple-filled (F)', 'H': 'purple-hollow (H)', 'B': 'blue (B)'}
out['tsiokos_panel_map'] = {
    '_note': 'Tsiokos Chair44 panel IDs mapped onto the 24 facets used here. '
             'The three D4 motif classes coincide exactly with the three symbols: '
             + ', '.join('%s = %s' % (k, _LONG[_dict[k]]) for k in sorted(_dict)) + '.',
    'dictionary': _dict,
    'panels': _pm,
}

json.dump(out, open('marking.json', 'w'), indent=1)
print('wrote marking.json  (%d facets, %d atlas entries)'
      % (len(facets), len(A44)))
