#!/usr/bin/env python3
"""Stage a copy of the Showcase that can live on another host (spacesheep.dev).

    python3 docs/showcase/tools/make-standalone.py --out <dir>
    python3 docs/showcase/tools/make-standalone.py --out <dir> --previews copy

The Showcase is one page, but it leans on the rest of the site: the shared
stylesheets and header script, the site menu, and — above all — every card's
link, which opens the family page, an explorer or a viewer with that picture
already selected. A copy on another origin has none of those next to it, so
this script rewrites every `../` reference to the published site and marks
those links to open in a new tab (the spacesheep wrapper shows a space inside
a sandboxed iframe that allows popups but not top navigation).

Previews are the other question. A spacesheep space holds at most 200 files
(the CLI refuses more), and the previews are 5 000-odd clips and posters, so
by default (`--previews hotlink`) the copy loads them from the published site;
`--previews copy` writes them into the staging folder instead, for a host that
can take them. Either way the manifest and the served cards agree.

The copy is marked `noindex` with a canonical link to the page it copies; the
page itself is unchanged. `showcase.mjs` honours `data-external` on <body> by
giving every card it mounts the same target the served cards carry.
"""

import argparse
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SHOWCASE = os.path.dirname(HERE)
SITE = 'https://yaroslavvb.github.io/animated-groups-fable/'
CLI_MAX_FILES = 200


def absolutise_html(page, site, previews_base):
    """Point every `../` reference at the site, and previews where asked."""
    page = re.sub(r'(href|src)="\.\./', lambda m: f'{m.group(1)}="{site}', page)
    if previews_base:
        page = re.sub(r'(src|data-preview)="previews/',
                      lambda m: f'{m.group(1)}="{previews_base}', page)
    # Every link that leaves the copy opens the site in a new tab. Anchors that
    # already say where they open are left alone.
    def retarget(m):
        tag = m.group(0)
        if ' target=' in tag:
            return tag
        return tag[:-1] + ' target="_blank" rel="noopener">'
    page = re.sub(r'<a\b[^>]*\bhref="' + re.escape(site) + r'[^"]*"[^>]*>', retarget, page)
    # A copy, and it says so: no indexing, and the original as canonical.
    head_extra = (f'  <meta name="robots" content="noindex">\n'
                  f'  <link rel="canonical" href="{site}showcase/">\n')
    page = page.replace('  <meta name="theme-color"', head_extra + '  <meta name="theme-color"', 1)
    page = re.sub(r'<body class="showcase"', '<body class="showcase" data-external="1"', page, count=1)
    return page


def absolutise_manifest(doc, site, previews_base):
    for row in doc['rows']:
        if row['href'].startswith('../'):
            row['href'] = site + row['href'][3:]
        if previews_base:
            for key in ('preview', 'poster'):
                if row[key].startswith('previews/'):
                    row[key] = previews_base + row[key][len('previews/'):]
    for viewer in doc.get('viewers', []):
        if viewer['href'].startswith('../'):
            viewer['href'] = site + viewer['href'][3:]
        if previews_base and viewer.get('preview', '').startswith('previews/'):
            viewer['preview'] = previews_base + viewer['preview'][len('previews/'):]
    doc['standalone'] = {'site': site, 'previews': previews_base or 'copied'}
    return doc


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', required=True, help='the staging folder (created; emptied first)')
    ap.add_argument('--site', default=SITE, help='the published site, with a trailing slash')
    ap.add_argument('--previews', choices=('hotlink', 'copy'), default='hotlink',
                    help='load previews from the site (default) or copy them into the folder')
    args = ap.parse_args()
    site = args.site if args.site.endswith('/') else args.site + '/'
    previews_base = None if args.previews == 'copy' else f'{site}showcase/previews/'

    out = os.path.abspath(args.out)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'data'))

    with open(os.path.join(SHOWCASE, 'index.html'), encoding='utf-8') as fh:
        page = absolutise_html(fh.read(), site, previews_base)
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(page)
    for name in ('showcase.css', 'showcase.mjs'):
        shutil.copy2(os.path.join(SHOWCASE, name), os.path.join(out, name))
    with open(os.path.join(SHOWCASE, 'data', 'showcase.json'), encoding='utf-8') as fh:
        doc = absolutise_manifest(json.load(fh), site, previews_base)
    with open(os.path.join(out, 'data', 'showcase.json'), 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n')
    if args.previews == 'copy':
        shutil.copytree(os.path.join(SHOWCASE, 'previews'), os.path.join(out, 'previews'))

    files = [os.path.join(d, f) for d, _, fs in os.walk(out) for f in fs]
    total = sum(os.path.getsize(f) for f in files)
    left = sum(1 for row in doc['rows'] if row['href'].startswith('../'))
    print(f'{out}: {len(files)} files, {total / 1e6:.1f} MB, previews {args.previews}, '
          f'{left} relative links left', file=sys.stderr)
    if len(files) > CLI_MAX_FILES:
        print(f'note: {len(files)} files is more than the {CLI_MAX_FILES} a spacesheep space '
              f'holds; the CLI will refuse this folder', file=sys.stderr)
    return 1 if left else 0


if __name__ == '__main__':
    sys.exit(main())
