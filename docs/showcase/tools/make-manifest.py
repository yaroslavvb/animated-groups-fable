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
     reading, preview, poster, href, featured, siblings}

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

The first `--static` cards and all eighteen section headings are also written
into the HTML between the `<!-- cards:begin -->` markers, so the page is a real,
crawlable, linkable list of pictures before a byte of JSON arrives.
"""

import argparse
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


def build(broad=False):
    groups = sc.Groups()
    rows = sc.all_rows(groups, sc.KINDS, broad=broad)
    also_in(groups, rows)
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
        shipped.append(card)

    sources = {}
    for name, path in (('wallpaper', sc.WALLPAPER_ATLAS), ('colour', sc.COLOUR_ATLAS),
                       ('mono', sc.MONO_ATLAS)):
        if os.path.exists(path):
            sources[name] = {'sha256': sc.sha256_of(path),
                             'bytes': os.path.getsize(path)}

    counts = {kind: sum(1 for r in shipped if r['kind'] == kind) for kind in sc.KINDS}
    counts['total'] = len(shipped)
    counts['clips'] = len({r['preview'] for r in shipped})
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
                 'also carded in another film group names those groups in `alsoIn`.'),
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
    return line


def card_html(row, eager):
    loading = 'eager' if eager else 'lazy'
    sig = f'<span class="sig">{escape(row["signature"])}</span>' if row['signature'] else ''
    where = ' · '.join(x for x in (row['groupId'], row['equation']) if x)
    # The reading leads the detail line because it is what differs between
    # neighbours — and it is the line the phone keeps, where the name alone
    # would be the same twenty cards running.
    detail = ' · '.join(x for x in (row.get('reading'), row['params'], row['dims']) if x)
    if row.get('siblings'):
        detail = (detail + ' · ' if detail else '') + f'+{len(row["siblings"])}'
    extra = (f' data-siblings="{len(row["siblings"])}"' if row.get('siblings') else '')
    extra += (f' data-also="{len(row["alsoIn"])}"' if row.get('alsoIn') else '')
    extra += f' title="{escape(card_title(row))}"'
    return (
        f'<a class="loop-card" href="{escape(row["href"])}" data-kind="{row["kind"]}" '
        f'data-id="{escape(row["id"])}" data-preview="{escape(row["preview"])}"{extra}>'
        f'<span class="art"><img src="{escape(row["poster"])}" alt="" width="176" height="176" '
        f'loading="{loading}" decoding="async">'
        f'<span class="badge {row["kind"]}">{KIND_LABEL[row["kind"]]}</span>{sig}</span>'
        f'<span class="meta"><strong>{escape(row["name"])}</strong>'
        f'<span class="where">{escape(where)}</span>'
        + (f'<span class="det">{escape(detail)}</span>' if detail else '')
        + '</span></a>')


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


def sections_html(doc, static_cards):
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

    budget = static_cards
    for family in doc['families']:
        fid = family['id']
        mine = by_family.get(fid, [])
        counts = family['counts']
        breakdown = ' · '.join(
            f'{counts[k]} {KIND_LABEL[k]}' for k in ('ember', 'colour', 'mono') if counts[k])
        shown = min(len(mine), max(0, budget))
        budget -= shown
        out.append(f'<section class="showcase-section" id="{fid}" aria-labelledby="{fid}-title">')
        out.append(f'<h2 id="{fid}-title">{orbifold(family["orbifold"])} '
                   f'<span class="hm">{fid}</span> '
                   f'<span class="n" data-count="{fid}">{counts["total"]} loops · {breakdown}</span></h2>')
        out.append(f'<p class="small">{FAMILY_NOTE[family["lattice"]]}</p>')
        # `data-where="keep"`: on a phone this section's cards keep the group
        # and equation line, because without it two of them would read exactly
        # alike. Where the line really is pure repetition the phone drops it and
        # the card is two lines shorter.
        where = ' data-where="keep"' if family.get('keepWhere') else ''
        out.append(f'<div class="loop-grid" data-family="{fid}" '
                   f'data-total="{counts["total"]}"{where}>')
        out.extend(card_html(row, False) for row in mine[:shown])
        out.append('</div>')
        if shown < len(mine):
            out.append(f'<div class="load-more"><button type="button" class="show-all" '
                       f'data-family="{fid}">Show all {counts["total"]} in {fid}</button></div>')
        out.append('</section>')
    return '\n'.join(out)


def summary_html(doc):
    counts = doc['counts']
    parts = [(counts['clips'], 'pictures'), (counts['total'], 'cards'),
             (counts['records'], 'catalogue records'),
             (counts['ember'], 'field'), (counts['colour'], 'three-colour'),
             (counts['mono'], 'black-and-white'), (counts['viewer'], 'standalone viewers'),
             (17, 'wallpaper groups'), (counts['equations'], 'equations')]
    return ''.join(f'<span><b>{n:,}</b> {label}</span>'.replace(',', ' ') for n, label in parts)


def orbifold(text):
    """p1's orbifold symbol is a lone "◦", which at rail and heading size reads
    as a bullet rather than as a signature.  It keeps the site's own glyph and
    gets a class the stylesheet draws a little larger."""
    mark = ' class="orb-small"' if text.strip() in ('◦', '◦◦') else ''
    return f'<span{mark}>{escape(text)}</span>'


def rail_html(doc):
    out = [f'<a href="#viewers" class="pinned"><b>Viewers</b>'
           f'<span>{doc["counts"]["viewer"]}</span></a>']
    for family in doc['families']:
        out.append(f'<a href="#{family["id"]}"><b>{orbifold(family["orbifold"])}</b>'
                   f'<span>{family["counts"]["total"]}</span></a>')
    return ''.join(out)


def stamp(page, doc, static_cards):
    blocks = {'summary': summary_html(doc), 'rail': rail_html(doc),
              'cards': sections_html(doc, static_cards)}
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
    ap.add_argument('--static', type=int, default=240,
                    help='how many cards to write into the served HTML')
    ap.add_argument('--broad', action='store_true',
                    help='card the broad monochrome tier too, not only the strict '
                         'one (the threshold controls are carded by neither). The '
                         'shipped manifest is built with it, so --check wants it too')
    ap.add_argument('--require-previews', action='store_true',
                    help='fail unless every row has an .mp4 and a .webp on disk')
    args = ap.parse_args()

    doc = build(broad=args.broad)
    text = json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n'

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
    stamped = stamp(page, doc, args.static)

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
    print(f'{counts["total"]} cards over {counts["records"]} distinct catalogue records, '
          f'{counts["clips"]} clips, {len(text) / 1000:.0f} kB of manifest, '
          f'{args.static} cards in the HTML', file=sys.stderr)
    for kind in sc.KINDS:
        print(f'  {kind:7s} {counts[kind]:5d}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
