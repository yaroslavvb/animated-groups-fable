"""
Marked 3-D chair (Goodman-Strauss / Tsiokos "Chair44" carrier) -- core model.

CONVENTIONS
-----------
Unit cell  c in Z^3  denotes the closed cube [c, c+1].
Chair      C = [0,2]^3 \ [1,2]^3 = the 7 cells K = {0,1}^3 \ {(1,1,1)}.
           "far corner"     F = (0,0,0)          (the corner of the bounding cube
                                                  diagonally opposite the notch)
           "notch/dent"     the missing cell [1,2]^3
           "concave corner" N = (1,1,1)          (the corner of the notch nearest F)

Facet      a unit square of dC, written (c, d) with c in K, d a unit axis vector,
           c + d not in K.  There are exactly 24:
             21 outer  (4+4+4+3+3+3 over the six outer faces)
              3 notch  (those with c + d == (1,1,1))

Site       every facet (c,d) is assigned the vertex
             site(c,d) = N            if c + d == (1,1,1)     (notch facets)
                       = 2*c          otherwise
           This is always one of the four corners of the facet.  The 8 distinct
           sites are the 7 corners 2a (a in K) of the bounding cube other than
           (2,2,2), plus N = (1,1,1).  Exactly 3 facets sit at each site.

Mark       every facet carries exactly one mark, drawn in the facet's quarter at
           its site and pointing at that site.  A mark is a TYPE in
             'F' = solid/filled purple arrowhead
             'H' = hollow/open purple arrowhead (the hook / V)
             'B' = pale-blue arrow
           A "star" is the assignment of the three types to the three facets at a
           site; it is always a bijection {x,y,z} -> {F,H,B}, so the whole marking
           is 8 stars = 8 permutations of (F,H,B).

Matching   two chairs meet legally iff (i) their cell sets are disjoint and
           (ii) for every pair of adjacent cells c1 in T1, c2 in T2, the facets
           (c1, c2-c1) and (c2, c1-c2) carry marks with
                same site vertex   and   complementary types,
           where comp(F)=H, comp(H)=F, comp(B)=B.

Pose       (L, t) with L a signed permutation matrix and t in Z^3.  L is written
           (p, s): (L v)_i = s_i * v_{p_i}.
"""

from itertools import permutations, product

# ---------------------------------------------------------------- basic algebra

AXES = (0, 1, 2)
TYPES = ('F', 'H', 'B')
COMP = {'F': 'H', 'H': 'F', 'B': 'B'}


def lin(L, v):
    p, s = L
    return (s[0] * v[p[0]], s[1] * v[p[1]], s[2] * v[p[2]])


def det(L):
    p, s = L
    # sign of the permutation p times product of signs
    sgn = 1
    q = list(p)
    for i in range(3):
        for j in range(i + 1, 3):
            if q[i] > q[j]:
                sgn = -sgn
    return sgn * s[0] * s[1] * s[2]


def compose(L1, L2):
    """L1 o L2 as a signed permutation."""
    p1, s1 = L1
    p2, s2 = L2
    # (L1 L2 v)_i = s1_i * (L2 v)_{p1_i} = s1_i * s2_{p1_i} * v_{p2[p1_i]}
    p = tuple(p2[p1[i]] for i in range(3))
    s = tuple(s1[i] * s2[p1[i]] for i in range(3))
    return (p, s)


ALL_L = tuple((p, s) for p in permutations(AXES) for s in product((1, -1), repeat=3))
PROPER_L = tuple(L for L in ALL_L if det(L) == 1)
IDENT = ((0, 1, 2), (1, 1, 1))
assert len(ALL_L) == 48 and len(PROPER_L) == 24


def pose_apply_pt(pose, v):
    L, t = pose
    w = lin(L, v)
    return (w[0] + t[0], w[1] + t[1], w[2] + t[2])


def pose_apply_cell(pose, c):
    """Image of the unit cell [c,c+1] under the pose, as its min corner."""
    L, t = pose
    p, s = L
    out = []
    for i in range(3):
        lo = s[i] * c[p[i]] if s[i] == 1 else -c[p[i]] - 1
        out.append(lo + t[i])
    return tuple(out)


def pose_compose(P1, P2):
    """P1 o P2."""
    L1, t1 = P1
    L2, t2 = P2
    L = compose(L1, L2)
    w = lin(L1, t2)
    return (L, (w[0] + t1[0], w[1] + t1[1], w[2] + t1[2]))


# ---------------------------------------------------------------- the chair

K = tuple(sorted(c for c in product((0, 1), repeat=3) if c != (1, 1, 1)))
NOTCH_CELL = (1, 1, 1)
FAR = (0, 0, 0)
N_CORNER = (1, 1, 1)

DIRS = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def scale(k, a):
    return (k * a[0], k * a[1], k * a[2])


FACETS = tuple(sorted((c, d) for c in K for d in DIRS if add(c, d) not in K))
assert len(FACETS) == 24
NOTCH_FACETS = tuple(f for f in FACETS if add(f[0], f[1]) == NOTCH_CELL)
assert len(NOTCH_FACETS) == 3


def site(f):
    c, d = f
    if add(c, d) == NOTCH_CELL:
        return N_CORNER
    return scale(2, c)


def facet_corners(f):
    """The four lattice corners of the unit-square facet f."""
    c, d = f
    ax = [i for i in range(3) if d[i] != 0][0]
    base = list(c)
    if d[ax] == 1:
        base[ax] += 1
    others = [i for i in range(3) if i != ax]
    out = []
    for a in (0, 1):
        for b in (0, 1):
            v = list(base)
            v[others[0]] += a
            v[others[1]] += b
            out.append(tuple(v))
    return out


for f in FACETS:
    assert site(f) in facet_corners(f), f

SITES = tuple(sorted(set(site(f) for f in FACETS)))
assert len(SITES) == 8
SITE_FACETS = {v: tuple(sorted(f for f in FACETS if site(f) == v)) for v in SITES}
for v, fs in SITE_FACETS.items():
    assert len(fs) == 3
    assert sorted(abs(d[0]) * 0 + [i for i in range(3) if d[i] != 0][0]
                  for (_, d) in fs) == [0, 1, 2]

# site key: 'dent' for N, otherwise the cell a with 2a = v
SITE_KEY = {}
for v in SITES:
    if v == N_CORNER:
        SITE_KEY[v] = 'dent'
    else:
        SITE_KEY[v] = tuple(x // 2 for x in v)
KEY_SITE = {k: v for v, k in SITE_KEY.items()}


def facet_axis(f):
    d = f[1]
    return [i for i in range(3) if d[i] != 0][0]


# --------------------------------------------------- markings (8 stars)

# A marking is a dict:  site key -> (type on the x-facet, y-facet, z-facet)
# at that site.

def marking_to_facet_marks(stars):
    """dict facet -> (type, site vertex)."""
    out = {}
    for f in FACETS:
        v = site(f)
        out[f] = (stars[SITE_KEY[v]][facet_axis(f)], v)
    return out


# The reconstruction read off CGS's sketch, completed at the far corner (see
# tiling-spec.md).  M24 = every facet marked.
#
# CHIRALITY.  The tile is chiral: a marking and its mirror image are different
# objects, and no rotation carries one to the other.  Beside the single-tile
# figure CGS wrote his own axis labels -- "+x" with an arrow to the LOWER LEFT
# and "+y" with an arrow to the RIGHT -- which is the convention used here and
# by the viewer, so the drawing fixes the chirality with nothing left free.
# Read with those axes the three notch walls are  +x: solid purple (F),
# +y: open V (H), +z: blue (B)  -- the open V is on the screen-left wall and the
# solid head on the screen-right wall -- and the purple bar across the top L
# face has its hollow head at (2,0,2) and its solid head at (0,2,2).  An earlier
# transcription of the photograph had x and y interchanged; the marking below is
# the corrected one.  Its mirror image (the earlier M24) satisfies (a)+(b)+(c)
# and has the same contact atlas, so only the drawing distinguishes them; see
# tiling-spec.md sections 2.1 and 6.
M24 = {
    (0, 0, 0): ('H', 'F', 'B'),
    (1, 0, 0): ('B', 'F', 'H'),
    (0, 1, 0): ('H', 'B', 'F'),
    (0, 0, 1): ('F', 'H', 'B'),
    (1, 1, 0): ('H', 'F', 'B'),
    (1, 0, 1): ('F', 'B', 'H'),
    (0, 1, 1): ('B', 'H', 'F'),
    'dent':    ('F', 'H', 'B'),
}

# M21 = the literal sketch, which leaves the three facets at the far corner blank.
M21_BLANK_SITE = (0, 0, 0)


# --------------------------------------------------- placed tiles

class Tile:
    __slots__ = ('pose', 'cells', 'marks')

    def __init__(self, pose, facet_marks):
        self.pose = pose
        L, t = pose
        self.cells = frozenset(pose_apply_cell(pose, c) for c in K)
        m = {}
        for (c, d), (ty, v) in facet_marks.items():
            c2 = pose_apply_cell(pose, c)
            d2 = lin(L, d)
            v2 = pose_apply_pt(pose, v)
            m[(c2, d2)] = (ty, v2)
        self.marks = m

    def __repr__(self):
        return 'Tile(%r)' % (self.pose,)


def contacts(t1, t2):
    """List of (cell1, cell2) adjacent pairs across the two tiles."""
    out = []
    for c1 in t1.cells:
        for d in DIRS:
            c2 = add(c1, d)
            if c2 in t2.cells:
                out.append((c1, d))
    return out


def pair_legal(t1, t2, blank_ok=False):
    """Disjoint cells and every shared facet matches.  Returns (ok, n_contacts)."""
    if t1.cells & t2.cells:
        return (False, 0)
    n = 0
    for c1, d in contacts(t1, t2):
        c2 = add(c1, d)
        nd = (-d[0], -d[1], -d[2])
        m1 = t1.marks.get((c1, d))
        m2 = t2.marks.get((c2, nd))
        n += 1
        if m1 is None or m2 is None:
            if blank_ok and m1 is None and m2 is None:
                continue
            if blank_ok:
                return (False, n)
            return (False, n)
        if m1[1] != m2[1] or COMP[m1[0]] != m2[0]:
            return (False, n)
    return (True, n)


def patch_legal(tiles, blank_ok=False):
    """All pairs disjoint + every internal contact matches. Returns (ok, details)."""
    bad = []
    ncontacts = 0
    for i in range(len(tiles)):
        for j in range(i + 1, len(tiles)):
            ok, n = pair_legal(tiles[i], tiles[j], blank_ok)
            ncontacts += n
            if not ok:
                bad.append((i, j))
    return (not bad, {'contacts': ncontacts, 'bad_pairs': bad})


# --------------------------------------------------- the substitution

def child_frames(stars, allow_improper=True):
    """
    Derive the 8 child poses of the level-1 supertile 2C = [0,4]^3 \ [2,4]^3
    from the requirement that the supertile, read at double scale, carries the
    SAME marking M.  Returns dict site-key -> pose, or None if inconsistent.

    For a corner child at octant a (a in K) the child's far corner is 4a and the
    three facets there are its own far-corner facets; the parent's star at 4a must
    be the parent's star at site key a, i.e. stars[a].
    For the central child the frame is fixed by matching the parent's dent star.
    """
    marks = marking_to_facet_marks(stars)
    far_star = stars[FAR]                     # types on the child's own x,y,z far facets
    out = {}
    for a in K:
        want = stars[a]                       # parent's star at 4a: types on dirs (2a_i-1)e_i
        # child's facet in own direction -e_j carries far_star[j];
        # it must land in global direction (1-2a_i)*(-e_i) ... see spec.
        p = [None, None, None]
        s = [None, None, None]
        for i in range(3):
            ty = want[i]
            js = [j for j in range(3) if far_star[j] == ty]
            if len(js) != 1:
                return None
            j = js[0]
            # L(e_j) = (1-2a_i) e_i   =>   in (p,s) form:  p[i] = j, s[i] = 1-2a_i
            if p[i] is not None:
                return None
            p[i] = j
            s[i] = 1 - 2 * a[i]
        L = (tuple(p), tuple(s))
        if len(set(p)) != 3:
            return None
        if not allow_improper and det(L) != 1:
            return None
        pose = (L, scale(4, a))
        # geometric check: the image must be the right octant minus the right cell
        cells = set(pose_apply_cell(pose, c) for c in K)
        want_cells = set()
        for b in product((0, 1), repeat=3):
            cell = tuple(2 * a[i] + b[i] for i in range(3))
            want_cells.add(cell)
        # the removed cell is the one nearest the centre (2,2,2)
        nearest = tuple(2 * a[i] + (1 - a[i]) for i in range(3))
        want_cells.discard(nearest)
        if cells != want_cells:
            return None
        out[a] = pose
    # central child
    dent_star = stars['dent']
    p = [None, None, None]
    for i in range(3):
        js = [j for j in range(3) if dent_star[j] == dent_star[i]]
        if len(js) != 1:
            return None
        p[i] = js[0]
    Lc = (tuple(p), (1, 1, 1))
    if tuple(p) != (0, 1, 2):
        return None
    out['dent'] = (Lc, (1, 1, 1))
    return out


def supertile_poses(frames, level):
    """Poses of the 8^level unit chairs of the level-`level` supertile."""
    poses = [ (IDENT, (0, 0, 0)) ]
    for n in range(level):
        k = 2 ** n
        nxt = []
        for key, (L, t) in frames.items():
            outer = (L, scale(k, t))
            for p in poses:
                nxt.append(pose_compose(outer, p))
        poses = nxt
    return poses
