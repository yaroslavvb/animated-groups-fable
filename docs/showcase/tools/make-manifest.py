#!/usr/bin/env python3
"""Build `docs/showcase/data/showcase.json`, and stamp the static part of
`docs/showcase/index.html` from it.

    python3 docs/showcase/tools/make-manifest.py
    python3 docs/showcase/tools/make-manifest.py --check     # diff, write nothing

Nothing here is written by hand and nothing is duplicated from a catalog that
already owns it: every row's name, group, equation, signature and dimensions are
read straight out of `scott-gray/data/wallpaper-atlas.json`,
`colour/data/colour-atlas.json`, `monochrome/data/monochrome-atlas.json` and
`scott-gray/wallpaper-groups.json` by `showcase_common.py`, which is also what
the preview generator reads, so a card and its clip can never disagree about
which picture they are.

The manifest carries, per card, exactly what a card draws and where it goes:

    {id, kind, family, groupId, name, equation, signature, dims, params,
     reading, preview, poster, href, featured, siblings, alsoIn,
     look, alike, alikeOf}

`reading` is the one thing a card says that its neighbours do not: the rule a
two-colour picture was read by, the colouring a three-colour one was made with,
and — where even those agree, as they do for six Trefoil colourings of one
Sel'kov orbit — the saved field's own short digest.  Every other word on a card
is shared by the cards around it, which is what a section of one wave read many
ways looks like.

`siblings` is the honest part of the deduplication.  The 720 wallpaper records
stand on 370 distinct fields, and the monochrome readings on far fewer distinct
pictures than there are rules; a showcase that drew one card per catalogue row
would show the reader the same animation several times over.  One card is drawn
per distinct picture, and the records it stands for are named on it — in the
manifest, in the card's `title`, and as a `+n` on the card's own detail line.

`look`, `alike` and `alikeOf` are the OTHER deduplication, the one the reader
sees rather than the one the catalogue justifies.  Two verified solutions at
F = .00402 and F = .00403 are two different pictures and two different records —
and to the eye they are the same black diamond around the same white blob.
`tools/look-alikes.py` clusters the clips perceptually into
`data/look-alikes.json`; this script maps each row to its cluster by clip id and,
per family, names one row the representative (`look` + `alike`) and files the
rest behind it (`look` + `alikeOf`).  Nothing is dropped: a folded row is still
a manifest row with its own parameters, its own reading and its own link, and
the page mounts it when the reader opens the chip.

The first `--per-section` (50) DEFAULT-VISIBLE cards of every family and all
eighteen section headings are also written into the HTML between the
`<!-- cards:begin -->` markers, so the page is a real, crawlable, linkable list
of pictures — in every wallpaper group, not only the first two — before a byte
of JSON arrives.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from html import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import showcase_common as sc  # noqa: E402

MANIFEST = os.path.join(sc.SHOWCASE, 'data', 'showcase.json')
PAGE = os.path.join(sc.SHOWCASE, 'index.html')
LOOK_ALIKES = os.path.join(sc.SHOWCASE, 'data', 'look-alikes.json')
PER_SECTION = 50

KIND_LABEL = {'ember': 'field', 'colour': 'three-colour', 'mono': 'black &amp; white',
              'viewer': 'viewer'}

# One line per family, saying where a card in that section takes the reader.
# The only prose this script owns; everything else it prints it was told.
FAMILY_NOTE = {
    'square': 'Square lattice. A card opens the reaction–diffusion family page, '
              'or the monochrome explorer, with the group, the equation, the '
              'parameter set and the pattern already chosen.',
    'triangular': 'Triangular lattice — the only kind that can host a three-colour '
                  'rule, so this section has Gyre and Trefoil cards as well as '
                  'fields and black-and-white pictures.',
}


def also_in(groups, rows):
    """Which other wallpaper groups card this very picture.

    An ember picture is a function of the field alone and a monochrome one of
    the field and the rule, so a wave hosted by twelve film groups is carded
    twelve times — once in each section, because that is where a reader looking
    for a p4g picture will look for it.  That is a placement and not a second
    picture, and 4 138 cards over 2 632 clips is a thing the page has to say out
    loud rather than let the reader count twice.
    """
    where = {}
    for row in rows:
        where.setdefault(row['preview'], []).append(row['family'])
    for row in rows:
        rest = [f for f in where[row['preview']] if f != row['family']]
        row['alsoIn'] = sorted(set(rest), key=groups.rank)


def clips_digest(clip_ids):
    """sha256 of the sorted clip ids.

    The same four lines as `clips_digest()` in tools/look-alikes.py, spelled
    again here rather than imported (the file's name is not a module name), so
    this script can tell — from the rows it is about to ship, before writing a
    byte — that the clustering it was handed was built from the same clip set.
    Two spellings of one hash can only disagree loudly, never quietly.
    """
    digest = hashlib.sha256()
    for cid in sorted(clip_ids):
        digest.update(cid.encode('utf-8'))
        digest.update(b'\n')
    return digest.hexdigest()


def cluster_distance(cluster):
    """d(clip a, clip b) for two members of one cluster, out of its `dists`.

    `dists` is the upper triangle of the cluster's own distance matrix in
    `members` order, flattened row by row. The fold needs arbitrary pairs and
    not just the distance to the global rep, because the card a FAMILY shows is
    often not that rep and a chip may not hide a card far from the card it sits
    behind.
    """
    members = cluster['members']
    n = len(members)
    at = {clip: i for i, clip in enumerate(members)}
    dists = cluster['dists']

    def distance(a, b):
        i, j = at[a], at[b]
        if i == j:
            return 0.0
        if i > j:
            i, j = j, i
        return dists[i * n - i * (i + 1) // 2 + (j - i - 1)]
    return distance


def read_look_alikes(path):
    """`data/look-alikes.json` → {clip id: cluster}, validated.

    The contract is small and every part of it is load-bearing, so every part of
    it is checked here rather than discovered as a wrong count on the page: a
    clip in two clusters would make a row's `look` depend on iteration order, a
    `rep` outside its own `members` would leave a family with folded rows and
    nothing to fold them behind, a cluster of one is a singleton the file is not
    supposed to list at all, and a `dists` of the wrong length would silently
    give the fold below the wrong distances to split on.

    The other half of the contract — that this clustering was built from the
    clip set this run is about to card — is `clip_set_drift()` below, which runs
    once the rows exist and is fatal on a build and on `--check` alike.
    """
    with open(path, encoding='utf-8') as fh:
        doc = json.load(fh)
    if doc.get('schema') != 'showcase-look-alikes-v1':
        raise SystemExit(f'{path}: schema is {doc.get("schema")!r}, '
                         'not "showcase-look-alikes-v1"')
    if not isinstance(doc.get('threshold'), (int, float)):
        raise SystemExit(f'{path}: no threshold')
    by_clip = {}
    for cluster in doc.get('clusters') or []:
        members = cluster.get('members') or []
        cid = cluster.get('id')
        if not cid:
            raise SystemExit(f'{path}: a cluster has no id')
        if len(members) < 2:
            raise SystemExit(f'{path}: cluster {cid} lists {len(members)} member(s); '
                             'singletons are not listed')
        if cluster.get('rep') not in members:
            raise SystemExit(f'{path}: cluster {cid} names a rep that is not one of '
                             'its own members')
        want = len(members) * (len(members) - 1) // 2
        if len(cluster.get('dists') or []) != want:
            raise SystemExit(f'{path}: cluster {cid} carries '
                             f'{len(cluster.get("dists") or [])} distances, wants {want} — '
                             'rerun tools/look-alikes.py')
        cluster['_d'] = cluster_distance(cluster)
        for clip in members:
            if clip in by_clip:
                raise SystemExit(f'{path}: {clip} is in two clusters '
                                 f'({by_clip[clip]["id"]} and {cid})')
            by_clip[clip] = cluster
    return doc, by_clip


def fold_look_alikes(rows, by_clip, threshold):
    """Split each family's share of each cluster into chips, and file every card
    behind one that really does look like it.

    A cluster is a set of CLIPS and a section is a set of CARDS, and the two do
    not line up: one clip is carded in every family that hosts its field, so a
    cluster of nine can put nine cards in p1 and one in p4m.  Folding is
    therefore decided per family — a cluster with one card in a section folds
    nothing there and the card keeps no chip — and a folded row is folded behind
    a representative that is in the SAME section, which is the only card the
    reader can open it from.

    ONE CLUSTER IS NOT ONE CHIP.  `look-alikes.py` clusters by single linkage,
    which chains: a run of steps each under the threshold can carry a hard
    rectangular checkerboard to a rounded pillow lattice, and folding all of it
    behind one card hid a picture the reader would have called different — and
    hid a different one in each section, because the card a section happened to
    show was whichever came first in it.  So a family's members are split here,
    greedily, into as many chips as it takes:

      * the leader of a chip is the card the section SHOWS.  It is the featured
        row if there is one (closest to the cluster's medoid, where the site
        features two), else the cluster's own global representative if this
        section cards it, else the first card of the section, which is the one
        the reader meets.  Featured beats everything, on every chip of the
        split, so a featured row is never folded behind an unfeatured one.

        That is one word short of what the design asked for — "every featured
        row stays default-visible" — and the shortfall is deliberate, so it is
        written down here rather than left in a report: 16 of the 166 featured
        rows are folded, and every one of them is behind ANOTHER featured card
        of the same section, 0.07 to 0.26 away.  The site's own pick is always
        on screen; making the other one a second visible card would put two
        cards that draw one picture side by side, which is the complaint this
        whole fold answers, and it would break the page's second promise —
        that no two cards a section shows are within the threshold of each
        other.  Being featured is a reason not to be hidden behind something
        DIFFERENT, and that is exactly what is guaranteed;
      * every remaining card within `threshold` of that leader is folded behind
        it, nearest first;
      * whatever is left starts another chip, and therefore another visible
        card.

    That gives the page the two promises a reader can check: no card is hidden
    behind a card more than `threshold` away from it, and no two cards the page
    SHOWS are within `threshold` of each other — a later leader was chosen
    precisely because no earlier one was near it.  A chip past the first gets
    `~1`, `~2` … on its cluster id, because the page keys an open chip by
    (family, `look`) and two chips of one cluster in one section must not open
    together.
    """
    per_family = {}
    for row in rows:
        per_family.setdefault(row['family'], []).append(row)
    folded = 0
    for mine in per_family.values():
        clusters = {}
        for row in mine:
            cluster = by_clip.get(row['preview'])
            if not cluster:
                continue
            # A cluster is one kind and one equation, by construction — and if a
            # hand edit ever made it two, a mono card would fold behind a colour
            # one and the kind filter would take the card away and leave the
            # chip. `look-alikes.py --check` says the same thing from the other
            # side; this is the half that sees the rows.
            if (cluster['kind'], cluster['equation']) != (row['kind'], row['equation']):
                raise SystemExit(
                    f'data/look-alikes.json: cluster {cluster["id"]} says '
                    f'{cluster["kind"]} · {cluster["equation"]} and holds '
                    f'{row["preview"]}, which this run cards as {row["kind"]} · '
                    f'{row["equation"]} — rerun tools/look-alikes.py --broad')
            clusters.setdefault(cluster['id'], []).append(row)
        for cid, members in clusters.items():
            if len(members) < 2:
                continue
            cluster = by_clip[members[0]['preview']]
            distance, global_rep = cluster['_d'], cluster['rep']
            at = {row['id']: n for n, row in enumerate(members)}

            def leads(row):
                if row['featured']:
                    return (0, distance(row['preview'], global_rep), at[row['id']])
                if row['preview'] == global_rep:
                    return (1, 0.0, at[row['id']])
                return (2, 0.0, at[row['id']])

            waiting, nth = list(members), 0
            while waiting:
                lead = min(waiting, key=leads)
                near, rest = [], []
                for row in waiting:
                    if row is lead:
                        continue
                    close = distance(lead['preview'], row['preview']) <= threshold
                    (near if close else rest).append(row)
                waiting = rest
                near.sort(key=lambda row: (distance(lead['preview'], row['preview']),
                                           at[row['id']]))
                look = cid if nth == 0 else f'{cid}~{nth}'
                nth += 1
                if not near:
                    continue           # a card of its own: no chip, no cluster id
                lead['look'] = look
                lead['alike'] = len(near)
                for row in near:
                    row['look'] = look
                    row['alikeOf'] = lead['id']
                    row['fold'] = 'look'
                    folded += 1
    return folded


WAVE_KINDS = ('ember', 'mono')


def wave_key(row):
    """What the catalogue itself calls one wave: its name under one film group of
    one equation.  Parameters and the two-colour rule are deliberately not in it."""
    return (row['kind'], row['groupId'], row['equation'], row['name'])


def fold_waves(rows):
    """One card per WAVE in a section, on top of the look-alike fold.

    The clip metric is exact about pixels and wrong about people.  Six cards of
    the g6 Gray–Scott rotating wave — F .00395 … .00408, read as half period,
    half slide, half turn and mirror — cycle through the same stripes, bones and
    chequers in a different order and at a slightly different spacing, so no
    alignment of one whole loop onto another is close and the metric calls them
    unrelated (0.8 to 1.41); the reader, watching six synchronised loops in a
    row, calls them the same card six times, which is what they are for browsing.
    The catalogue already says so: they share a NAME under one film group of one
    equation.  So, after the look-alike fold, every visible ember and black-and-
    white card of one `wave_key` in a section folds behind one of them — the
    featured one, else the one already hiding the most, else the first — and
    the cards that were folded behind it come along.  Colourings are left alone:
    a colouring is its own picture, not a reading of one.

    One thing keeps the page's promise exact — that every hidden card is the
    same wave as the card it is behind, or within the threshold of it.  A card
    that already hides look-alikes of ANOTHER wave (the clip metric crosses
    names; a `Standing wave` can measure alike a `Diagonal standing wave`) is
    not folded, because its followers would land behind a card that is neither
    the same wave nor close to them.  It stays visible, a second card of its
    wave, and the suite checks that every such second card really is blocked.
    `fold` says which promise a folded row is under: `look` or `wave`.
    """
    per_family = {}
    for row in rows:
        per_family.setdefault(row['family'], []).append(row)
    folded = 0
    for mine in per_family.values():
        followers = {}
        for row in mine:
            if row.get('alikeOf'):
                followers.setdefault(row['alikeOf'], []).append(row)
        waves = {}
        for row in mine:
            if row['kind'] in WAVE_KINDS and not row.get('alikeOf'):
                waves.setdefault(wave_key(row), []).append(row)
        for key, shown in waves.items():
            if len(shown) < 2:
                continue
            at = {row['id']: n for n, row in enumerate(shown)}
            primary = min(shown, key=lambda r: (not r['featured'],
                                                -len(followers.get(r['id'], [])), at[r['id']]))
            for row in shown:
                if row is primary:
                    continue
                tail = followers.get(row['id'], [])
                if any(wave_key(f) != key for f in tail):
                    continue                    # blocked: it hides another wave's look-alikes
                row['alikeOf'] = primary['id']
                row['fold'] = 'wave'
                folded += 1
                for f in tail:                  # the same wave as the primary, by the test above
                    f['alikeOf'] = primary['id']
                    f['fold'] = 'wave'
                followers.setdefault(primary['id'], []).extend([row] + tail)
                followers.pop(row['id'], None)
        # Recount, and key every chip so the page can open it by (family, look).
        behind = {}
        for row in mine:
            if row.get('alikeOf'):
                behind.setdefault(row['alikeOf'], []).append(row)
        for row in mine:
            tail = behind.get(row['id'], [])
            if tail:
                row['alike'] = len(tail)
                if not row.get('look'):
                    row['look'] = 'wave:%s:%s:%s:%s' % (
                        row['kind'], row['groupId'],
                        re.sub(r'[^a-z0-9]+', '-', row['equation'].lower()).strip('-'),
                        re.sub(r'[^a-z0-9]+', '-', row['name'].lower()).strip('-'))
                for f in tail:
                    f['look'] = row['look']
            else:
                row.pop('alike', None)
                if not row.get('alikeOf'):
                    row.pop('look', None)       # a card of its own carries no chip key
    return folded


def clip_set_drift(rows, look_alikes, tier):
    """'' when the clustering was built from the clip set these rows name, and a
    sentence saying what to do when it was not.

    Both scripts read the three catalogs through `showcase_common`, so the clip
    set this run is about to card is the clip set `look-alikes.py --broad` sees
    when it is run first — and a disagreement is therefore a real one, not the
    ordering wart it used to be.  It is fatal on a build as well as on `--check`:
    the clips the clustering does not name would ship as their own unfolded
    cards, which is the duplicate the whole fold exists to hide, and nothing else
    can see it (the file's own sha256 is unchanged, so `--check` printed
    "current" while a catalogue change shipped unfolded).
    """
    if not look_alikes:
        return ''
    mine = {row['preview'].rsplit('.', 1)[0] for row in rows if row['kind'] != 'viewer'}
    if clips_digest(mine) == look_alikes.get('clipsDigest'):
        return ''
    # No guess at WHICH clip moved: a clip the clustering does not name may be a
    # singleton, which the file is not supposed to list, so the honest signal is
    # the two counts, or — where even those agree, as they do when one clip was
    # swapped for another — the two digests.
    there = look_alikes['counts']['clips']
    if there > len(mine):
        # The clustering knows clips this run never built. By far the likeliest
        # reason is a forgotten --broad HERE, not a stale clustering, and
        # sending the reader off to re-cluster would be the wrong errand.
        return (f'data/look-alikes.json names {there} clips and the rows this run is about '
                f'to ship name {len(mine)} — this run is building the {tier} tier. Add '
                f'--broad, or recluster the same tier with tools/look-alikes.py.')
    how = (f'It names {there} clips; the rows this run is about to ship name {len(mine)}, '
           f'so some of them would arrive folded behind nothing.' if there != len(mine) else
           f'Both name {len(mine)} clips, but not the same {len(mine)}: its clipsDigest is '
           f'{str(look_alikes.get("clipsDigest"))[:12]}… and these rows hash to '
           f'{clips_digest(mine)[:12]}….')
    return ('data/look-alikes.json was clustered from a different clip set — rerun '
            'tools/look-alikes.py --broad. ' + how)


def build(broad=False, by_clip=None, look_alikes_path=None, look_alikes=None):
    groups = sc.Groups()
    rows = sc.all_rows(groups, sc.KINDS, broad=broad)
    also_in(groups, rows)
    fold_look_alikes(rows, by_clip or {}, (look_alikes or {}).get('threshold', 0.0))
    fold_waves(rows)
    # No two cards in one section may read the same. Returns the families whose
    # phone layout has to keep the group-and-equation line, because there it is
    # the line that tells two cards apart. Once per freshly built row set: it
    # appends to `reading`, so calling it twice would say the same field twice.
    keep_where = sc.disambiguate(rows)

    families = []
    for family in groups.families:
        fid = family['id']
        mine = [r for r in rows if r['family'] == fid]
        counts = {kind: sum(1 for r in mine if r['kind'] == kind) for kind in sc.KINDS}
        counts['total'] = len(mine)
        # What the section actually opens with: one card per look-alike cluster.
        # The heading, the rail pill and the "Show all" button all print this
        # one, and the quota in `showcase.mjs` counts against it.
        counts['distinct'] = sum(1 for r in mine if not r.get('alikeOf'))
        families.append({'id': fid, 'orbifold': family['orbifold'],
                         'hm': fid, 'lattice': family['lattice'], 'counts': counts,
                         'keepWhere': fid in keep_where})

    viewers = [{'slug': v['slug'], 'name': v['name'], 'note': v['note'],
                'href': v['href'], 'art': v['art'],
                'preview': f"previews/viewer/{v['slug']}"} for v in sc.VIEWERS]

    shipped = []
    for row in rows:
        card = {k: row[k] for k in ('id', 'kind', 'family', 'groupId', 'name', 'equation',
                                    'signature', 'dims', 'params', 'preview', 'href',
                                    'featured')}
        # Only the two-colour cards carry one, and it is the thing that tells
        # two of them apart: with both tiers carded, a section holds many
        # readings of one wave and they agree about everything else.
        if row.get('reading'):
            card['reading'] = row['reading']
        card['poster'] = row['preview'] + '.webp'
        card['preview'] = row['preview'] + '.mp4'
        if row['siblings']:
            card['siblings'] = row['siblings']
        if row.get('alsoIn'):
            card['alsoIn'] = row['alsoIn']
        # The look-alike fold, per family. `look` is on both sides of it so the
        # page can key an expansion by (family, cluster) without a lookup.
        for key in ('look', 'alike', 'alikeOf', 'fold'):
            if row.get(key):
                card[key] = row[key]
        shipped.append(card)

    sources = {}
    for name, path in (('wallpaper', sc.WALLPAPER_ATLAS), ('colour', sc.COLOUR_ATLAS),
                       ('mono', sc.MONO_ATLAS), ('look-alikes', look_alikes_path)):
        if path and os.path.exists(path):
            sources[name] = {'sha256': sc.sha256_of(path),
                             'bytes': os.path.getsize(path)}

    counts = {kind: sum(1 for r in shipped if r['kind'] == kind) for kind in sc.KINDS}
    counts['total'] = len(shipped)
    counts['clips'] = len({r['preview'] for r in shipped})
    # What the page opens with, and what it holds back. A folded card is still a
    # card and still a record; it is one fewer picture on the screen, which is
    # the number the summary line has to print beside the other two.
    #
    # The nine viewers count as distinct: nothing is ever folded behind them,
    # and leaving them out made the summary line print three numbers that did
    # not add up — 1 657 + 2 472 against 4 138 cards, nine short, on a line
    # whose whole subject is that its numbers are the manifest's.
    counts['distinct'] = sum(1 for r in shipped if not r.get('alikeOf'))
    counts['folded'] = sum(1 for r in shipped if r.get('alikeOf'))
    # …and the same fold counted in PICTURES rather than cards, which is the
    # smaller number, because a representative is a representative once in every
    # family that cards it. The summary says "cards" and carries this one in its
    # title, so the two can never be read as each other.
    folded_clips = sum(len(c['members']) - 1 for c in (look_alikes or {}).get('clusters', []))
    counts['distinctClips'] = counts['clips'] - folded_clips
    # DISTINCT catalogue rows, not cards. One monochrome entry is carded under
    # every family that hosts its field — up to twelve — and adding those cards
    # up counted a placement as a record, which is the very thing `alsoIn`
    # exists to stop the reader doing: it published 4 167 where the three
    # catalogs hold 2 973. The nine viewers are pages, not catalogue rows, and
    # the summary line counts them as pages.
    records = set()
    for row in rows:
        if row['kind'] == 'viewer':
            continue
        records.add((row['kind'], row['_recordId']))
        records.update((row['kind'], sibling) for sibling in row['siblings'])
    counts['records'] = len(records)
    counts['equations'] = len({r['equation'] for r in shipped if r['kind'] != 'viewer'})

    return {
        'schema': 'showcase-v1',
        'builtAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'note': ('One CARD per (picture, wallpaper group); `counts.clips` is how many '
                 'distinct pictures that is, and `counts.total` how many cards. A card '
                 'that stands for several catalogue records names them in `siblings` — '
                 'the same animation catalogued under different clockworks, or the same '
                 'two-colour function read by several rules — and a card whose picture is '
                 'also carded in another film group names those groups in `alsoIn`. '
                 'Cards whose clips LOOK alike are folded: one per cluster per family is '
                 'shown by default and carries `look` + `alike`, the rest carry `look` + '
                 '`alikeOf` and are mounted only when the reader opens that chip. '
                 '`counts.distinct` is what the page opens with and `counts.folded` what '
                 'it holds back; neither is a card the manifest dropped.'),
        'tier': 'broad' if broad else 'strict',
        'sources': sources,
        'counts': counts,
        'families': families,
        'viewers': viewers,
        'rows': shipped,
    }


# --------------------------------------------------------------------------- the page


def card_title(row):
    """Everything the card cannot fit, for the reader who hovers it."""
    parts = [row['name'], row.get('reading'), row['equation'], row['groupId'],
             row['dims'], row['params']]
    line = ' · '.join(part for part in parts if part)
    siblings = row.get('siblings') or []
    if siblings:
        what = ('the same wave catalogued under' if row['kind'] == 'ember'
                else 'the same two-colour function also read as')
        names = ', '.join(siblings[:4]) + ('\u2026' if len(siblings) > 4 else '')
        line += f' — {what} {len(siblings)} more: {names}'
    # The same picture is carded under every wallpaper group that hosts it,
    # which is a placement and not a second picture; `showcase.mjs` writes the
    # same clause, so a served card and a mounted one say the same thing.
    if row.get('alsoIn'):
        line += ' — the same picture is also in ' + ', '.join(row['alsoIn'])
    # With "Fold look-alikes" off the chip is hidden — a control that does
    # nothing is worse than no control — and the count it carried has to go
    # somewhere. The stylesheet said it was here; it was not, until now.
    if row.get('alike'):
        line += (f' — {row["alike"]} more card'
                 f'{"" if row["alike"] == 1 else "s"} in this group look'
                 f'{"s" if row["alike"] == 1 else ""} like this one')
    return line


def card_html(row, eager):
    """One card.

    A card is a `<div>` and not an `<a>`, because the look-alike chip is a
    button and a button may not sit inside a link: the whole card is still one
    link (`a.open` fills it), and the chip sits over the art beside it.
    `cardElement()` in `showcase.mjs` writes this markup attribute for
    attribute, and the browser suite compares a served card with a mounted one
    to keep it that way.

    `sections_html()` serves REPRESENTATIVES only — a folded card is mounted
    when the reader opens its chip, and serving it here would put the very
    look-alikes the fold exists to hide back into the first paint — so this
    never sees a row with `alikeOf` and writes no `data-alike-of` and no "alike"
    word.  Those two live in `cardElement()` alone.  They were written here too
    for a while, in branches nothing could reach: markup written twice and
    compared never, which is the one thing this pair of renderers must not have.
    """
    loading = 'eager' if eager else 'lazy'
    sig = f'<span class="sig">{escape(row["signature"])}</span>' if row['signature'] else ''
    where = ' · '.join(x for x in (row['groupId'], row['equation']) if x)
    # The reading leads the detail line because it is what differs between
    # neighbours — and it is the line the phone keeps, where the name alone
    # would be the same twenty cards running.
    detail = ' · '.join(x for x in (row.get('reading'), row['params'], row['dims']) if x)
    if row.get('siblings'):
        detail = (detail + ' · ' if detail else '') + f'+{len(row["siblings"])}'
    extra = ' data-featured="1"' if row['featured'] else ''
    extra += (f' data-siblings="{len(row["siblings"])}"' if row.get('siblings') else '')
    extra += (f' data-also="{len(row["alsoIn"])}"' if row.get('alsoIn') else '')
    if row.get('look'):
        extra += f' data-look="{escape(row["look"])}"'
    if row.get('alike'):
        extra += f' data-alike="{row["alike"]}"'
    extra += f' title="{escape(card_title(row))}"'
    chip = (f'<button type="button" class="alike" aria-expanded="false">'
            f'+{row["alike"]} alike</button>') if row.get('alike') else ''
    return (
        f'<div class="loop-card" data-kind="{row["kind"]}" '
        f'data-id="{escape(row["id"])}" data-preview="{escape(row["preview"])}"{extra}>'
        f'<a class="open" href="{escape(row["href"])}">'
        f'<span class="art"><img src="{escape(row["poster"])}" alt="" width="176" height="176" '
        f'loading="{loading}" decoding="async">'
        f'<span class="badge {row["kind"]}">{KIND_LABEL[row["kind"]]}</span>{sig}</span>'
        f'<span class="meta"><strong>{escape(row["name"])}</strong>'
        f'<span class="where">{escape(where)}</span>'
        + (f'<span class="det">{escape(detail)}</span>' if detail else '')
        + '</span></a>' + chip + '</div>')


_NUMBERS = ('Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
            'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve')

# Standalone pages whose field.f32 is byte-identical to a field the catalogues
# card (checked by sha256 over all nine: every one but Ember and the chair
# tiling, which has no field at all).  It is a fact about the bytes, so it is
# stated rather than the "one card per distinct picture" claim that was not true.
SHARED_VIEWERS = 7


def _spelled(n):
    """A small count at the head of a sentence, in words."""
    return _NUMBERS[n] if n < len(_NUMBERS) else str(n)


def heading_text(counts):
    """"305 distinct of 388 loops · 70 field · 318 black & white".

    `updateSectionCounts()` in `showcase.mjs` rewrites this line when the kind
    filter changes and has to be able to put this exact string back, so the two
    spellings — "N distinct of M loops" where the fold hides something, plain
    "M loops" where it hides nothing — live here and are mirrored there.
    """
    breakdown = ' · '.join(
        f'{counts[k]} {KIND_LABEL[k]}' for k in ('ember', 'colour', 'mono') if counts[k])
    head = (f'{counts["distinct"]} distinct of {counts["total"]} loops'
            if counts['distinct'] < counts['total'] else f'{counts["total"]} loops')
    return f'{head} · {breakdown}' if breakdown else head


def sections_html(doc, per_section):
    rows = doc['rows']
    by_family = {}
    for row in rows:
        by_family.setdefault(row['family'], []).append(row)

    out = []
    viewers = by_family.get('viewers', [])
    out.append('<section class="showcase-section" id="viewers" aria-labelledby="viewers-title">')
    out.append('<h2 id="viewers-title">Standalone viewers '
               '<span class="hm">endless, full screen, a page each</span> '
               f'<span class="n" data-count="viewers">{len(viewers)} pages</span></h2>')
    # The count is spelled out, and it is the real one: a ninth viewer landed
    # (Crosslet) and a hard-coded "Eight" would have made the prose disagree
    # with the heading two lines above it.
    out.append(f'<p class="small">{_spelled(len(viewers))} pages that are not catalogue rows: '
               'one wave each, drawn endlessly, pannable and zoomable, with their own writing '
               f'about what the picture is. {_spelled(SHARED_VIEWERS)} of them stand on a wave '
               'the catalogue below also holds — the viewer is that wave drawn full screen and '
               'without end, rather than a tenth of a screen in a grid.</p>')
    out.append('<div class="loop-grid pinned-grid">')
    out.extend(card_html(row, True) for row in viewers)
    out.append('</div></section>')

    # Every section serves its own first `per_section` cards, not a share of one
    # page-wide budget. The old budget ran out inside p2, so fifteen of the
    # seventeen wallpaper groups were served EMPTY under a "Show all N" button —
    # a page whose whole subject is the groups, arriving with fifteen of them
    # blank.
    for family in doc['families']:
        fid = family['id']
        mine = by_family.get(fid, [])
        counts = family['counts']
        # Only the representatives are served. A folded card is mounted when the
        # reader opens its chip, and serving it here would put the very
        # look-alikes the fold exists to hide back into the first paint.
        reps = [row for row in mine if not row.get('alikeOf')]
        shown = min(len(reps), per_section)
        out.append(f'<section class="showcase-section" id="{fid}" aria-labelledby="{fid}-title">')
        out.append(f'<h2 id="{fid}-title">{orbifold(family["orbifold"])} '
                   f'<span class="hm">{fid}</span> '
                   f'<span class="n" data-count="{fid}">{heading_text(counts)}</span></h2>')
        out.append(f'<p class="small">{FAMILY_NOTE[family["lattice"]]}</p>')
        # `data-where="keep"`: on a phone this section's cards keep the group
        # and equation line, because without it two of them would read exactly
        # alike. Where the line really is pure repetition the phone drops it and
        # the card is two lines shorter.
        where = ' data-where="keep"' if family.get('keepWhere') else ''
        out.append(f'<div class="loop-grid" data-family="{fid}" '
                   f'data-total="{counts["total"]}" '
                   f'data-distinct="{counts["distinct"]}"{where}>')
        out.extend(card_html(row, False) for row in reps[:shown])
        out.append('</div>')
        pending = len(reps) - shown
        hidden = ' hidden' if pending <= 0 else ''
        # …and the step says what pressing it will do. A section with 22 left
        # under a button promising 50 is the same lie as "Show all 76" bringing
        # 42, only smaller; `updateSectionCounts()` writes the same minimum.
        # (`or per_section` where there is nothing left: the bar is hidden, but
        # a hidden button reading "Show 0 more" is still markup the script would
        # have to write back, and the two renderers are compared attribute for
        # attribute.)
        step = min(per_section, pending) or per_section
        # …and where the step and "all" would mount the SAME cards, only "all" is
        # drawn — `updateSectionCounts()` hides the step on exactly this test.
        # Serving it visible meant seven sections painted two buttons that did
        # the same thing until the script's first pass took one away, which is a
        # flicker and, for the half-second it lasts, a page contradicting itself.
        step_hidden = ' hidden' if pending <= per_section else ''
        out.append(f'<div class="load-more" data-family="{fid}"{hidden}>'
                   f'<button type="button" class="show-more" data-family="{fid}"{step_hidden}>'
                   f'Show {step} more</button>'
                   f'<button type="button" class="show-all" data-family="{fid}">'
                   f'Show all {counts["distinct"]}</button></div>')
        out.append('</section>')
    return '\n'.join(out)


def summary_html(doc):
    counts = doc['counts']
    spaced = lambda n: f'{n:,}'.replace(',', ' ')
    parts = [('clips', counts['clips'], 'pictures', ''),
             ('total', counts['total'], 'cards', ''),
             ('distinct', counts['distinct'], 'distinct-looking cards',
              f'by the clip metric alone, {spaced(counts["distinctClips"])} distinct-looking '
              'pictures, a picture being a representative once in every wallpaper group that '
              'cards it; the wave fold — one card per named wave of a film group and equation — '
              'takes the page further than that'),
             ('folded', counts['folded'], 'folded behind them',
              'every one of them the same wave as the card it is behind — same name, film group '
              'and equation — or within the look-alike threshold of it'),
             ('records', counts['records'], 'catalogue records', ''),
             ('ember', counts['ember'], 'field', ''),
             ('colour', counts['colour'], 'three-colour', ''),
             ('mono', counts['mono'], 'black-and-white', ''),
             ('viewer', counts['viewer'], 'standalone viewers', ''),
             # …from the manifest, like every other number on this line. A
             # literal 17 was the one figure here that would have survived an
             # eighteenth family being carded, railed and headed below it.
             ('groups', len(doc['families']), 'wallpaper groups', ''),
             ('equations', counts['equations'], 'equations', '')]
    return ''.join(f'<span data-n="{key}"'
                   + (f' title="{escape(title)}"' if title else '')
                   + f'><b>{spaced(n)}</b> {label}</span>'
                   for key, n, label, title in parts)


def orbifold(text):
    """p1's orbifold symbol is a lone "◦", which at rail and heading size reads
    as a bullet rather than as a signature.  It keeps the site's own glyph and
    gets a class the stylesheet draws a little larger."""
    mark = ' class="orb-small"' if text.strip() in ('◦', '◦◦') else ''
    return f'<span{mark}>{escape(text)}</span>'


def rail_html(doc):
    """The pill carries the count the section will actually SHOW, and the count
    it holds in its title: a rail that promised 388 and scrolled to 305 cards
    would be the page lying about its own fold in the one place a reader looks
    before deciding to go there."""
    out = [f'<a href="#viewers" class="pinned" title="{doc["counts"]["viewer"]} '
           f'standalone viewer pages"><b>Viewers</b>'
           f'<span>{doc["counts"]["viewer"]}</span></a>']
    for family in doc['families']:
        counts = family['counts']
        title = (f'{counts["distinct"]} distinct-looking of {counts["total"]} loops '
                 f'in {family["id"]}')
        out.append(f'<a href="#{family["id"]}" title="{title}">'
                   f'<b>{orbifold(family["orbifold"])}</b>'
                   f'<span>{counts["distinct"]}</span></a>')
    return ''.join(out)


def stamp(page, doc, per_section):
    blocks = {'summary': summary_html(doc), 'rail': rail_html(doc),
              'cards': sections_html(doc, per_section)}
    for name, body in blocks.items():
        pattern = re.compile(f'(<!-- {name}:begin -->).*?(<!-- {name}:end -->)', re.S)
        if not pattern.search(page):
            raise SystemExit(f'index.html has no <!-- {name}:begin --> … <!-- {name}:end --> region')
        page = pattern.sub(lambda m: m.group(1) + '\n' + body + '\n' + m.group(2), page)
    return page


# --------------------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='compare and write nothing')
    ap.add_argument('--per-section', type=int, default=PER_SECTION,
                    help=f'how many default-visible cards of EVERY family to write '
                         f'into the served HTML (default {PER_SECTION})')
    ap.add_argument('--look-alikes', default=LOOK_ALIKES,
                    help='the perceptual clustering written by tools/look-alikes.py '
                         '(default data/look-alikes.json)')
    ap.add_argument('--no-look-alikes', action='store_true',
                    help='build with no fold at all: every row is its own picture. '
                         'Only for bootstrapping — the shipped page folds')
    ap.add_argument('--broad', action='store_true',
                    help='card the broad monochrome tier too, not only the strict '
                         'one (the threshold controls are carded by neither). The '
                         'shipped manifest is built with it, so --check wants it too')
    ap.add_argument('--require-previews', action='store_true',
                    help='fail unless every row has an .mp4 and a .webp on disk')
    args = ap.parse_args()

    by_clip, path, look_alikes = {}, None, None
    if not args.no_look_alikes:
        if not os.path.exists(args.look_alikes):
            print(f'{args.look_alikes} is not there. It is written by '
                  f'tools/look-alikes.py, which clusters the preview clips by how '
                  f'they LOOK; run that first, or pass --no-look-alikes to build a '
                  f'page that folds nothing.', file=sys.stderr)
            return 1
        look_alikes, by_clip = read_look_alikes(args.look_alikes)
        path = args.look_alikes

    doc = build(broad=args.broad, by_clip=by_clip, look_alikes_path=path,
                look_alikes=look_alikes)
    text = json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n'

    # The clustering has to have been built from the clip set being shipped, and
    # nothing else can see that: the file's own sha256 is unchanged, so a
    # catalogue change used to pass --check with its new clips unfolded. It is a
    # refusal on a build too, not a warning: `look-alikes.py` reads the same
    # catalogs this does, so running it first gives the right clip set on the
    # first pass and there is no longer a legitimate way to be here.
    drift = clip_set_drift(doc['rows'], look_alikes, doc['tier'])
    if drift:
        print(drift, file=sys.stderr)
        return 1

    missing = []
    for row in doc['rows']:
        for rel in (row['preview'], row['poster']):
            if not os.path.exists(os.path.join(sc.SHOWCASE, rel)):
                missing.append(rel)
    missing = sorted(set(missing))
    if missing:
        print(f'{len(missing)} preview files are not on disk yet, e.g. {missing[:3]}',
              file=sys.stderr)
        if args.require_previews:
            return 1

    with open(PAGE, 'r', encoding='utf-8') as fh:
        page = fh.read()
    stamped = stamp(page, doc, args.per_section)

    if args.check:
        old = open(MANIFEST, encoding='utf-8').read() if os.path.exists(MANIFEST) else ''
        shipped = json.loads(old or '{}')
        stale = []
        # The commonest way to see "stale" here is to have forgotten --broad,
        # which is a different question from the manifest being out of date.
        # Say which it is rather than let 3 500 row diffs stand for it.
        if shipped.get('tier') and shipped['tier'] != doc['tier']:
            print(f'the shipped manifest cards the {shipped["tier"]} tier and this run '
                  f'asked for the {doc["tier"]} one — rerun with '
                  f'{"--broad" if shipped["tier"] == "broad" else "no --broad"}',
                  file=sys.stderr)
            return 1
        if shipped.get('rows') != doc['rows']:
            stale.append('data/showcase.json')
        # The card set can be unchanged while the catalog under it is not — which
        # is exactly how the manifest came to name a superseded atlas while
        # --check printed "current". The source digests are part of being fresh.
        elif shipped.get('sources') != doc['sources']:
            stale.append('data/showcase.json (built from an older catalog: '
                         + ', '.join(sorted(name for name, block in doc['sources'].items()
                                            if (shipped.get('sources') or {}).get(name) != block))
                         + ')')
        if stamped != page:
            stale.append('index.html')
        if stale:
            print('stale: ' + ', '.join(stale), file=sys.stderr)
            return 1
        print('showcase.json and index.html are current', file=sys.stderr)
        return 0

    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, 'w', encoding='utf-8') as fh:
        fh.write(text)
    with open(PAGE, 'w', encoding='utf-8') as fh:
        fh.write(stamped)

    counts = doc['counts']
    served = stamped.count('<div class="loop-card"')
    print(f'{counts["total"]} cards over {counts["records"]} distinct catalogue records, '
          f'{counts["clips"]} clips, {counts["distinct"]} distinct-looking '
          f'({counts["folded"]} folded), {len(text) / 1000:.0f} kB of manifest, '
          f'{served} cards in the HTML ({args.per_section} a section)', file=sys.stderr)
    for kind in sc.KINDS:
        print(f'  {kind:7s} {counts[kind]:5d}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
