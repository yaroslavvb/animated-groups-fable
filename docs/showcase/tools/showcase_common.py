"""One reading of the three catalogs, shared by the preview generator and the
manifest builder.

Nothing here invents a fact.  Every card's name, equation, group, signature and
field come from `scott-gray/data/wallpaper-atlas.json`,
`colour/data/colour-atlas.json`, `monochrome/data/monochrome-atlas.json` or
`scott-gray/wallpaper-groups.json`; the only thing this module owns is which
rows become cards, what each card's preview is called, and the link that opens
the original page with that exact selection already made.

The four kinds, and the card key each one is deduplicated on:

    ember    one card per (family, field).  720 atlas records stand on 370
             distinct fields; an ember picture is a function of the field
             alone, so several records of one family that share a field are
             ONE picture catalogued under several clockworks.  The card names
             its own film group and lists the siblings.
    colour   one card per catalog entry: a colour entry already is one picture.
    mono     one card per distinct sign picture.  `rule.sameAs` says, in the
             catalog's own words, which rules draw the same function; the rows
             whose note is "the same rule wearing a different hat" or "the sign
             volumes are equal node-frame by node-frame" are folded together.
    viewer   the nine standalone pages, by hand, because they are pages.

The hash of every href was read off the app that has to parse it again:
`scott-gray/view-state.mjs` (v=2), `colour/colour-view-state.mjs` (v=1) and,
for monochrome, section A.6 of the design note — the monochrome explorer's own
`mono-view-state.mjs` is written by a sibling agent and, if it lands with a
different spelling, this is the one place to change.

Every row also carries a `reading`: the one thing on the card that its
neighbours in the same section do NOT say.  A section holds many pictures of one
wave — several rules reading one two-colour film, several colourings of one
colour orbit, several saved orbits of one parameter set — and they agree about
name, group, equation, parameters and size.  The rule (monochrome) or the
colouring (three-colour) is the difference where the catalog states one, and
where even that is equal — four verified Trefoil colourings of one equation at
one parameter set, on four different saved fields — `disambiguate` adds the
field's own short digest, because at that point the field IS the difference.
"""

import collections
import hashlib
import json
import os
from math import gcd
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
SHOWCASE = os.path.dirname(HERE)
DOCS = os.path.dirname(SHOWCASE)

WALLPAPER_ATLAS = os.path.join(DOCS, 'scott-gray', 'data', 'wallpaper-atlas.json')
COLOUR_ATLAS = os.path.join(DOCS, 'colour', 'data', 'colour-atlas.json')
MONO_ATLAS = os.path.join(DOCS, 'monochrome', 'data', 'monochrome-atlas.json')
GROUPS = os.path.join(DOCS, 'scott-gray', 'wallpaper-groups.json')

PREVIEWS = os.path.join(SHOWCASE, 'previews')
KINDS = ('viewer', 'ember', 'colour', 'mono')

# The palette every three-colour page draws with, and the two inks of the
# monochrome ones.  Taken from colour/colour-renderer.mjs and
# monochrome/tools/build-monochrome-catalog.py, not chosen here.
COLOUR_PALETTE = ((0xc9, 0x56, 0x3e), (0x57, 0x97, 0x9a), (0xe2, 0xbe, 0x68))
INK = ((0x11, 0x11, 0x11), (0xff, 0xff, 0xff))

# docs/scott-gray/render.mjs, `palettes.ember`.
EMBER_STOPS = ((0.00, 18, 9, 39), (0.22, 65, 12, 94), (0.43, 99, 25, 116),
               (0.58, 171, 45, 90), (0.69, 240, 111, 32), (0.78, 252, 181, 42),
               (0.89, 253, 219, 94), (1.00, 252, 242, 158))

# One loop, 36 frames, 176 CSS pixels: section B.3 of the design note.
FRAMES = 36
SIZE = 176
SUPERSAMPLE = 2
FPS = 24
# The framing an ember or colour card links to: `framing=simulation&tiles=2`, so
# two lattice lengths across the shorter side.  A preview that showed a
# different amount of the plane than the page it opens would be a small lie.
# The monochrome explorer does not take a tile count from a link at all — it
# frames each entry by the catalog's per-entry `view.tiles`, scaled to the
# canvas — so a monochrome clip is framed by that same law at the clip's size
# (`mono_tiles`) and its href carries no `tiles`.
TILES = 2


def read_json(path):
    with open(path, 'r', encoding='utf-8') as fh:
        return json.load(fh)


def model_name(models, key):
    """The wallpaper atlas spells `models` as {id: name}; the colour and
    monochrome ones as {id: {name, axes, …}}.  Both mean the same thing."""
    value = (models or {}).get(key)
    if isinstance(value, dict):
        return value.get('name', key)
    return value or key


def short_number(value):
    text = f'{float(value):.6g}'
    return text.replace('0.', '.') if text.startswith('0.') or text.startswith('-0.') else text


def axis_summary(models, model, params):
    """The one or two numbers that tell two neighbouring orbits apart.

    The catalogues hold whole parameter sweeps — three p6 orbits at F = 0.00406,
    0.00407, 0.00408 are three genuinely different verified waves that draw
    almost the same picture — so a card that named only the group and the
    equation would look like the same card three times.  Which parameters are
    the interesting ones is the model's own `axes`, where the catalog states
    them, and F and k otherwise, because the wallpaper atlas is all Gray-Scott.
    """
    block = (models or {}).get(model)
    axes = block.get('axes') if isinstance(block, dict) else None
    axes = axes or ['F', 'k']
    parts = [f'{name} {short_number(params[name])}'
             for name in axes[:2] if isinstance(params, dict) and name in params
             and isinstance(params[name], (int, float))]
    return ' '.join(parts)


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as fh:
        for block in iter(lambda: fh.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


# --------------------------------------------------------------------------- groups


class Groups:
    """`scott-gray/wallpaper-groups.json`, indexed the two ways cards need it."""

    def __init__(self, doc=None):
        doc = doc or read_json(GROUPS)
        self.families = doc['families']
        self.order = [f['id'] for f in self.families]
        self.by_family = {f['id']: f for f in self.families}
        self.groups = {g['id']: g for g in doc['groups']}

    def signature(self, group_id):
        return self.groups.get(group_id, {}).get('signature', '')

    def family_of(self, group_id):
        return self.groups.get(group_id, {}).get('family')

    def lattice(self, family):
        return self.by_family[family]['lattice']

    def page(self, family):
        """The reaction-diffusion family page, relative to docs/showcase/.

        p4 has no directory of its own: `scott-gray-groups.html` points the p4
        card at `scott-gray/` itself.  The wart lives here and nowhere else.
        """
        return '../' + self.by_family[family]['page']

    def rank(self, family):
        return self.order.index(family)


# --------------------------------------------------------------------------- hashes


def _hash(group_id, pairs):
    query = '&'.join(f'{k}={quote(str(v), safe="")}' for k, v in pairs)
    return f'#{group_id}?{query}'


def wallpaper_hash(group_id, pattern_id):
    """`scott-gray/view-state.mjs` v2, the fields it serialises, in its order."""
    return _hash(group_id, [
        ('v', 2), ('pattern', pattern_id), ('palette', 'ember'), ('tiles', TILES),
        ('framing', 'simulation'), ('speed', 1), ('overlay', 0), ('approx', 1),
        ('phase', 0), ('play', 1)])


def colour_hash(group_id, model, pattern_id):
    """`colour/colour-view-state.mjs` v1.  `sub=all` is the catalog-wide chip,
    which is what the explorer opens on anyway."""
    return _hash(group_id, [
        ('v', 1), ('sub', 'all'), ('model', model), ('pattern', pattern_id),
        ('framing', 'simulation'), ('tiles', TILES), ('palette', 'colour'),
        ('speed', 1), ('marks', 0), ('notation', 0), ('phase', '0.0'), ('play', 1)])


def mono_hash(group_id, rule, model, pattern_id, channel, tier='strict'):
    """`monochrome/mono-view-state.mjs` v1, field for field and in its order.

    `rule` is the catalog's own hyphenated kind (`half-turn`, not `halfturn`),
    and `tier` is the step-2 chip: a link into the strict tier must say so, or
    the page opens on the broad one and the reader is shown a picture the
    sentence above it is false about.

    No `tiles`.  The monochrome explorer frames every entry by its own
    `homeTiles` — the catalog's per-entry `view.tiles`, scaled to whatever canvas
    the reader has — and overwrites any `tiles` in the hash the moment the field
    loads, unless the link carries a full camera.  A `tiles=2` here was therefore
    a number the address bar never kept: the link is written without it, and the
    preview is framed by that same `homeTiles` law instead (see `mono_tiles`)."""
    return _hash(group_id, [
        ('v', 1), ('rule', rule), ('tier', tier), ('model', model),
        ('pattern', pattern_id), ('channel', channel), ('framing', 'simulation'),
        ('palette', 'mono'), ('speed', 1), ('marks', 0),
        ('notation', 0), ('phase', '0.0'), ('play', 1)])


def mono_tiles(entry, framing, size=SIZE):
    """How many lattice cells a monochrome preview shows: `homeTiles` of
    `monochrome/mono-app.mjs`, transcribed, evaluated at the clip's own size.

    The catalog picks `view.tiles` so the strand lands about
    `framing.strandPixels` wide in a box of `framing.tilePixels`, and the page
    rescales that to its canvas.  A clip that ignored it and always showed two
    cells drew 45 of the 326 strict pictures at a strand under 14 px — the floor
    the page itself calls a grey smudge — and 19 at over 60.  Through this law a
    176 px clip lands every one of them between 17 and 55 px, and shows exactly
    the piece of the plane the page it links to would show at that size.
    """
    box = framing.get('tilePixels', 380)
    most = framing.get('tilesMax', 8)
    strand = (entry.get('quality') or {}).get('strandCells', 0.0)
    tiles = min(most, max(1, round(entry['view']['tiles'] * size / box)))
    while tiles > 1 and size / tiles * strand < 14:
        tiles -= 1
    return tiles


# --------------------------------------------------------------------------- the reading

RULE_LABELS = {'half-turn': 'Half turn', 'mirror': 'Mirror', 'glide': 'Glide',
               'half-shift': 'Half slide', 'half-period': 'Half period',
               'threshold': 'Threshold'}


def cell_fraction(k, n):
    """`cellFraction` of `../../monochrome/mono-atlas.mjs`: an offset in nodes,
    written as the fraction of a lattice cell the reader sees in the explorer."""
    whole = k % n
    if not whole:
        return '0'
    g = gcd(whole, n)
    num, den = whole // g, n // g
    return str(num) if den == 1 else f'{num}/{den}'


def reading_label(entry, field):
    """Which reading of the wave this card's picture is — the explorer's own
    chip, `RULE_LABELS[kind]` and `chipDetail` of `mono-app.mjs`, joined.

    With both tiers carded, a section holds many readings of one field, and
    they share a name, a group, an equation, a parameter set and a size: the
    p1 grid is twenty cards called "Standing wave" and twenty different
    pictures.  The rule is the only thing that tells them apart, so it goes on
    the card rather than only in the link.
    """
    rule = entry['rule']
    kind = rule['kind']
    label = RULE_LABELS.get(kind, kind)
    n = field['N']
    v = rule.get('v') or [0, 0]
    if kind in ('half-period', 'threshold'):
        return label
    if kind == 'half-shift':
        return f'{label} ({cell_fraction(v[0], n)}, {cell_fraction(v[1], n)})'
    if kind == 'half-turn':
        return f'{label} about ({cell_fraction(v[0], 2 * n)}, {cell_fraction(v[1], 2 * n)})'
    slide = f', slide ({v[0]}, {v[1]})' if (v[0] or v[1]) else ''
    return f'{label} {rule.get("op", "")}{slide}'.strip()


def colouring_label(entry):
    """Which colouring of the wave this card's picture is.

    The same problem the monochrome `reading` solves, on the other catalog: the
    p6 section holds ten cards reading "Sel'kov sel-a on g247 · Sel'kov · a .1
    b .6 · 36²×96" over ten different colourings of one equation, four of them
    Gyre and six Trefoil, and nothing on the card said which was which — the
    badge says `three-colour` for both.

    The words are the colour explorer's own (`colour-app.mjs`, the paragraph
    under the picture): a Gyre entry turns about a centre "reached by the whole
    node vector w", and a Trefoil entry compares three samples "b apart — a
    whole (bNodes) nodes".  Both are integer node vectors, which is the form the
    catalog verifies them in and the form that fits on a card.
    """
    kind = entry['kind']
    colouring = entry.get('colouring') or {}
    if kind == 'gyre':
        w = colouring.get('w')
        return f'Gyre about w ({w[0]}, {w[1]})' if w else 'Gyre'
    b = colouring.get('bNodes')
    if b:
        return f'Trefoil at b ({b[0]}, {b[1]})'
    b = colouring.get('b')
    return (f'Trefoil at b ({short_number(b[0])}, {short_number(b[1])})' if b
            else 'Trefoil')


# --------------------------------------------------------------------------- viewers
#
# The nine standalone pages.  `render` is what the preview generator needs and
# nothing more; every number in it was read off that page's own renderer.mjs.

VIEWERS = [
    {'slug': 'ember', 'name': 'Ember', 'note': 'the relative equilibrium, turned analytically',
     'href': '../scott-gray/ember/', 'kind': 'viewer', 'art': 'ember',
     'render': {'rule': 'ember-analytic', 'field': 'scott-gray/ember/field.f32',
                'n': 36, 'm': 1, 'span': 3.0, 'centre': [1.5, 1.5], 'lattice': 'square',
                'range': [-1.1433281898498535, 1.1433281898498535]}},
    {'slug': 'plume', 'name': 'Plume', 'note': 'the rotating plume, in ember',
     'href': '../scott-gray/plume/', 'kind': 'viewer', 'art': 'ember',
     'render': {'rule': 'ember', 'field': 'scott-gray/plume/field.f32',
                'n': 48, 'm': 128, 'span': 2.0, 'centre': [1.0, 1.0], 'lattice': 'square',
                'range': [0.059269435703754425, 0.3834811747074127]}},
    {'slug': 'plume-monochrome', 'name': 'Plume Monochrome', 'note': 'the wave, black and white',
     'href': '../scott-gray/plume-monochrome/', 'kind': 'viewer', 'art': 'mono',
     'render': {'rule': 'halfturn', 'field': 'scott-gray/plume-monochrome/field.f32',
                'n': 48, 'm': 128, 'span': 2.0, 'centre': [1.0, 1.0], 'lattice': 'square'}},
    {'slug': 'weave-monochrome', 'name': 'Weave Monochrome', 'note': 'the woven twill, black and white',
     'href': '../scott-gray/weave-monochrome/', 'kind': 'viewer', 'art': 'mono',
     'render': {'rule': 'halfturn', 'field': 'scott-gray/weave-monochrome/field.f32',
                'n': 48, 'm': 128, 'span': 2.0, 'centre': [1.0, 1.0], 'lattice': 'square'}},
    {'slug': 'triskele', 'name': 'Triskele', 'note': 'Z₃, split — the turn alone',
     'href': '../scott-gray/triskele/', 'kind': 'viewer', 'art': 'colour',
     'render': {'rule': 'triskele', 'field': 'scott-gray/triskele/field.f32',
                'n': 66, 'm': 96, 'span': 2.0, 'centre': [0.0, 0.0], 'lattice': 'triangular'}},
    {'slug': 'gyre', 'name': 'Gyre', 'note': 'Z₃, fully entangled — turn and wait',
     'href': '../scott-gray/gyre/', 'kind': 'viewer', 'art': 'colour',
     'render': {'rule': 'gyre', 'field': 'scott-gray/gyre/field.f32',
                'n': 66, 'm': 96, 'span': 2.0, 'centre': [1 / 18, 1 / 9],
                'lattice': 'triangular', 'w': [0.0, 1 / 6]}},
    {'slug': 'trefoil', 'name': 'Trefoil', 'note': 'S₃, half entangled — three copies of one instant',
     'href': '../scott-gray/trefoil/', 'kind': 'viewer', 'art': 'colour',
     'render': {'rule': 'trefoil', 'field': 'scott-gray/trefoil/field.f32',
                'n': 66, 'm': 96, 'span': 2.0 / (3.0 ** 0.5), 'centre': [0.0, 0.0],
                'lattice': 'triangular', 'b': [1 / 3, 2 / 3]}},
    # Crosslet is the Gyre rule read on a *different* field — the complex
    # Ginzburg–Landau orbit colour:gyre:a767fbcc68c0 — about a turn centre that
    # is not a symmetry centre of the wave.  Every number here is from that
    # page's own renderer.mjs: GRID_SIZE, FRAMES, TURN_CENTRE, TURN_OFFSET.
    {'slug': 'crosslet', 'name': 'Crosslet', 'note': 'the Ginzburg–Landau gyre, in plus-shaped pieces',
     'href': '../scott-gray/crosslet/', 'kind': 'viewer', 'art': 'colour',
     'render': {'rule': 'gyre', 'field': 'scott-gray/crosslet/field.f32',
                'n': 36, 'm': 96, 'span': 2.0, 'centre': [17 / 54, 35 / 108],
                'lattice': 'triangular', 'w': [11 / 36, 23 / 36]}},
    {'slug': 'chair-tiling', 'name': 'Chair tiling', 'note': 'an aperiodic substitution, not a field',
     'href': '../chair-tiling/', 'kind': 'viewer', 'art': 'still',
     'render': {'rule': 'still', 'still': 'chair-tiling/social-preview.jpg'}},
]


# --------------------------------------------------------------------------- rows


def ember_rows(groups, atlas=None):
    """One card per (family, field), the sibling records folded in."""
    atlas = atlas or read_json(WALLPAPER_ATLAS)
    models = atlas.get('models', {})
    buckets = {}
    for rec in atlas['orbits']:
        family = rec.get('family') or groups.family_of(rec['groupId'])
        sha12 = rec['fieldSha256'][:12]
        buckets.setdefault((family, sha12), []).append(rec)
    rows = []
    for (family, sha12), recs in buckets.items():
        order = groups.by_family[family]['groupIds']
        recs.sort(key=lambda r: (order.index(r['groupId']) if r['groupId'] in order else 99, r['id']))
        rec = recs[0]
        cfg = rec['config']
        model = rec.get('model', 'gray-scott')
        rows.append({
            'id': rec['id'],
            'kind': 'ember',
            'family': family,
            'groupId': rec['groupId'],
            'name': rec.get('patternName') or rec.get('name') or 'Periodic wave',
            'equation': model_name(models, model),
            'model': model,
            'signature': groups.signature(rec['groupId']),
            'dims': f"{cfg['N']}²×{cfg['M']}",
            'params': axis_summary(models, model, cfg.get('params')),
            'preview': f'previews/ember/{sha12}',
            'href': groups.page(family) + wallpaper_hash(rec['groupId'], rec['id']),
            'featured': False,
            'siblings': [r['id'] for r in recs[1:]],
            '_render': {'rule': 'ember', 'field': os.path.join('scott-gray', rec['fieldUrl']),
                        'n': cfg['N'], 'm': cfg['M'], 'span': float(TILES),
                        'lattice': rec.get('lattice', 'square'),
                        'centre': ([TILES / 2, TILES / 2] if rec.get('lattice', 'square') == 'square'
                                   else [0.0, 0.0]),
                        'range': rec['ranges']['u']},
            '_previewId': sha12,
            '_recordId': rec['id'],
            '_field': sha12[:8],
        })
    rows.sort(key=lambda r: (groups.rank(r['family']), r['groupId'], r['model'], r['name']))
    return rows


def colour_rows(groups, atlas=None):
    """One card per colour entry; it is already one picture."""
    atlas = atlas or read_json(COLOUR_ATLAS)
    models = atlas.get('models', {})
    rows = []
    for entry in atlas['entries']:
        source = entry['source']
        group_id = source['groupId']
        family = groups.family_of(group_id)
        kind = entry['kind']
        pid = entry['id'].replace(':', '-').replace('colour-', '')
        render = {'rule': kind, 'field': source['fieldUrl'], 'n': source['N'], 'm': source['M'],
                  'span': float(TILES), 'lattice': 'triangular',
                  'channel': source.get('channelUsed', 0)}
        if kind == 'gyre':
            render['w'] = [entry['colouring']['w'][0] / source['N'],
                           entry['colouring']['w'][1] / source['N']]
            render['centre'] = list(entry['colouring']['p'])
        else:
            render['b'] = list(entry['colouring']['b'])
            render['centre'] = [0.0, 0.0]
        rows.append({
            'id': entry['id'],
            'kind': 'colour',
            'family': family,
            'groupId': group_id,
            'name': entry.get('name') or source.get('name') or 'Colouring',
            'equation': model_name(models, source['model']),
            'model': source['model'],
            'signature': groups.signature(group_id),
            'dims': f"{source['N']}²×{source['M']}",
            'params': axis_summary(models, source['model'], source.get('params')),
            # Which colouring this is: a section holds several of one wave, and
            # Gyre and Trefoil cards wear the same badge.
            'reading': colouring_label(entry),
            'preview': f'previews/colour/{pid}',
            'href': f'../colour/{kind}/' + colour_hash(group_id, source['model'], entry['id']),
            'featured': bool(entry.get('featured')),
            'siblings': [],
            '_render': render,
            '_previewId': pid,
            '_recordId': entry['id'],
            '_field': source['fieldSha256'][:8],
        })
    rows.sort(key=lambda r: (groups.rank(r['family']), r['groupId'], r['model'], r['name']))
    return rows


def mono_rows(groups, atlas=None, broad=False):
    """One card per distinct sign picture, filed under every family that hosts
    the field — the same rule the ember cards use, so the two kinds count the
    same way.

    The fold is the theorem of the design note's section 0.1, not a guess.  If
    waiting half a period exchanges the inks exactly, then every spatial reading
    of that field computes literally the same function as the half-period rule,
    so all of them are ONE picture; the card lists the rest as siblings.  Where
    the half-period law does not hold, the readings really are different
    pictures and each keeps its own card.  The threshold rule carries no
    antisymmetry at all and is never folded.

    By default only the STRICT tier is carded — the pictures whose two-colour
    law holds in space *and* time, which is what the word `spacetime` earns, and
    which is the tier the two shipped classics belong to.  `broad=True` cards
    the broad tier as well: every free involution, each a genuine two-colour
    wallpaper pattern in its own right, which is what makes the grid hundreds of
    animations deep instead of a few dozen.

    The threshold CONTROL is carded by neither.  It is the tier with no
    antisymmetry in it at all — it exists so the other two can be compared with
    something that has no two-colour law — and it belongs beside its own picture
    in the explorer, where the page can say what it is, rather than in a grid
    where it would look like one more two-colour picture and be none.

    A `monochrome-atlas-v2` entry states its own `tier`; a v1 one does not, and
    `tier_of` below is the same discriminator `mono-directory.mjs` uses there.
    """
    if atlas is None:
        if not os.path.exists(MONO_ATLAS):
            return []
        atlas = read_json(MONO_ATLAS)
    fields = atlas['fields']
    models = atlas.get('models', {})
    framing = (atlas.get('gates') or {}).get('framing') or {}

    def tier_of(entry):
        """Which of the catalog's three tiers a reading is in.

        A `monochrome-atlas-v2` entry states it.  A v1 one does not, and the
        discriminators are the ones `mono-directory.mjs` uses there: the
        threshold rule carries no antisymmetry at all, so it is the control,
        and an exact `laws.halfPeriod` is what makes a reading strict.
        """
        if entry.get('tier') in ('strict', 'broad', 'control'):
            return entry['tier']
        if entry['rule']['kind'] == 'threshold':
            return 'control'
        law = (entry.get('laws') or {}).get('halfPeriod')
        return 'strict' if (law and law[1] == 1) else 'broad'

    # The threshold control is never carded.  It exists so the two antisymmetric
    # tiers can be compared with something that has no two-colour law in it at
    # all, which is a thing to read in the explorer beside its own picture, not
    # a picture to hand a reader scrolling a grid.
    wanted = ('strict', 'broad') if broad else ('strict',)

    folded = {}
    for entry in atlas['entries']:
        tier = tier_of(entry)
        if tier not in wanted:
            continue
        key = ((entry['field'], entry['rule']['channel'], 'strict') if tier == 'strict'
               else (entry['field'], entry['rule']['channel'], entry['id']))
        folded.setdefault(key, []).append(entry)

    rows = []
    for key, group in folded.items():
        # The half-period reading is the canonical one inside a strict fold:
        # it is the rule that needs no operation to state.
        group.sort(key=lambda e: (e['rule']['kind'] != 'half-period',
                                  not e.get('featured'),
                                  -(e.get('metrics') or {}).get('score', 0), e['id']))
        entry = group[0]
        field = fields[entry['field']]
        rule = entry['rule']
        pid = entry['id'].replace(':', '-').replace('mono-', '')
        siblings = [e['id'] for e in group[1:]]
        for family in (field.get('families') or []):
            if family not in groups.by_family:
                continue
            hosts = [g for g in (field.get('groupIds') or [])
                     if groups.family_of(g) == family]
            group_id = hosts[0] if hosts else (field.get('groupIds') or [''])[0]
            rows.append({
                'id': entry['id'] + ('' if len(field.get('families') or []) < 2 else f'@{family}'),
                'kind': 'mono',
                'family': family,
                'groupId': group_id,
                'name': (field.get('names') or ['Two-colour picture'])[0],
                'equation': model_name(models, field['model']),
                'model': field['model'],
                'signature': groups.signature(group_id),
                'dims': f"{field['N']}\u00b2\u00d7{field['M']}",
                'params': axis_summary(models, field['model'], field.get('params')),
                'reading': reading_label(entry, field),
                'preview': f'previews/mono/{pid}',
                # The tier in the link is the ENTRY's own, not the run's: a
                # strict picture opened on the broad chip is a picture the
                # sentence above it is false about, and the explorer would have
                # to widen the chip back to `all` to find it at all.
                'href': f'../monochrome/{family}/' + mono_hash(
                    group_id, rule['kind'], field['model'], entry['id'],
                    rule['channel'], tier_of(entry)),
                'featured': bool(entry.get('featured')),
                'siblings': siblings,
                # The explorer centres every monochrome entry on the lattice
                # origin (`record.view.centre`, which this catalog never sets),
                # on the square lattice as well as the triangular one, so the
                # clip does too.
                '_render': {'rule': 'mono', 'field': field['fieldUrl'],
                            'n': field['N'], 'm': field['M'],
                            'span': float(mono_tiles(entry, framing)),
                            'lattice': field['lattice'],
                            'centre': [0.0, 0.0],
                            'channel': 0 if rule['channel'] == 'u' else 1,
                            'ruleKind': rule['kind'], 'M': rule.get('M'), 'v': rule.get('v')},
                '_previewId': pid,
                # The catalogue record behind the card, without the `@family`
                # placement suffix: one entry carded under twelve families is
                # one record, which is what `counts.records` has to count.
                '_recordId': entry['id'],
                '_field': entry['field'][:8],
            })
    rows.sort(key=lambda r: (groups.rank(r['family']), r['groupId'] or '', r['model'], r['name']))
    return rows


def viewer_rows(groups):
    rows = []
    for viewer in VIEWERS:
        rows.append({
            'id': f"viewer:{viewer['slug']}",
            'kind': 'viewer',
            'family': 'viewers',
            'groupId': '',
            'name': viewer['name'],
            'equation': viewer['note'],
            'model': '',
            'signature': '',
            'dims': '',
            'params': '',
            'preview': f"previews/viewer/{viewer['slug']}",
            'href': viewer['href'],
            'featured': True,
            'siblings': [],
            '_render': viewer['render'],
            '_previewId': viewer['slug'],
            # A viewer is a page, not a catalogue row: it is counted as a page
            # and never as a record.
            '_recordId': None,
            '_field': None,
        })
    return rows


# --------------------------------------------------------------------------- telling two cards apart


def _label(row, phone=False):
    """What the reader can actually read on the card.

    Desktop: the name, then the group and the equation, then the detail line —
    the reading, the parameters, the size and the `+n`.  The phone drops the
    group-and-equation line (there is no room for three lines on a 112 px card),
    so it is a shorter label and a stricter test.
    """
    detail = ' · '.join(x for x in (row.get('reading'), row['params'], row['dims']) if x)
    if row.get('siblings'):
        detail = (detail + ' · ' if detail else '') + f"+{len(row['siblings'])}"
    if phone:
        return (row['family'], row['name'], detail)
    return (row['family'], row['name'], row['groupId'], row['equation'], detail)


def disambiguate(rows):
    """Make sure no two cards in one section read the same.

    Every fact on a card comes from a catalog, and sometimes the catalog says
    the same thing twice: three verified g55 orbits at F = .0038, k = .02, all
    called "Woven standing wave · (2,1)", are three different saved fields that
    draw three different pictures and agree about every word on the card.  Six
    Trefoil colourings of one Sel'kov orbit are the same story on the other
    catalog — same b, same swap, six different fields.

    Where that happens the field is what differs, so the field's own short
    digest is added to the reading — the same 8 hex the clip is named by and the
    link carries, so a reader can match card, clip and address bar.  It is added
    ONLY where two cards would otherwise be indistinguishable: 314 of 4 138.

    The phone hides the group-and-equation line, which in twelve of the
    eighteen sections is the line that tells a g247 card from a g248 one.  Those
    grids are marked `keepWhere` instead of being given a digest they do not
    need on a wider screen — a real fact the reader already has beats an
    identifier, and the digest stays for the cards where there is no such fact.
    """
    buckets = collections.defaultdict(list)
    for row in rows:
        buckets[_label(row)].append(row)
    for group in buckets.values():
        if len(group) < 2:
            continue
        tokens = [f"field {row['_field']}" if row.get('_field') else '' for row in group]
        if len(set(tokens)) != len(group):
            # Never seen on the shipped catalogs; two rows of one family can
            # always be told apart by the clip, because that is what they are.
            tokens = [f"clip {row['_previewId']}" for row in group]
        for row, token in zip(group, tokens):
            row['reading'] = f"{row['reading']} · {token}" if row.get('reading') else token

    keep = set()
    for family, group in _by_family(rows).items():
        seen = collections.Counter(_label(row, phone=True) for row in group)
        if any(n > 1 for n in seen.values()):
            keep.add(family)
    return keep


def _by_family(rows):
    out = collections.defaultdict(list)
    for row in rows:
        out[row['family']].append(row)
    return out


BUILDERS = {'ember': ember_rows, 'colour': colour_rows, 'mono': mono_rows}


def all_rows(groups, kinds=KINDS, broad=False):
    """Every card, in the page's order.

    `disambiguate` is not called here: it rewrites `reading`, which is a thing a
    card says and not a thing a clip is, and the preview generator must not have
    its jobs depend on how many other rows happen to look alike.  The manifest
    builder calls it.
    """
    rows = []
    for kind in kinds:
        rows.extend(viewer_rows(groups) if kind == 'viewer'
                    else mono_rows(groups, broad=broad) if kind == 'mono'
                    else BUILDERS[kind](groups))
    return rows


def preview_jobs(rows):
    """One render per distinct clip: several cards may share one preview."""
    jobs = {}
    for row in rows:
        path = (row['kind'], row['_previewId'])
        jobs.setdefault(path, row['_render'])
    return jobs
