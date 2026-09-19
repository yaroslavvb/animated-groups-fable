#!/usr/bin/env python3
"""Superseded by `docs/monochrome/tools/add-nav.py`. This script now delegates.

This was the insertion script for the **Colour** nav group, and it did its job:
it put "Entangled colourings / Gyre / Trefoil" on all 82 pages of the previous
round. Section A.9 of the monochrome/showcase design note then renamed that
group to **Colourings**, gave it a fourth link (Monochrome), and made
**Showcase** the first link under Catalogues. `add-nav.py` writes that shape.

It is kept as a working entry point, not as a duplicate implementation, because
running the old code against the new pages would silently break them: its skip
test looked for the exact string `navgroup-label">Colour<`, which a page
labelled `Colourings` does not contain, so it inserted a SECOND, stale "Colour"
group next to the real one. Rather than leave that trap in the tree, every
invocation is forwarded to the one script that owns the header.

    python3 docs/colour/tools/add-colour-nav.py docs [--check] [--verify]
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SUCCESSOR = os.path.normpath(os.path.join(HERE, '..', '..', 'monochrome', 'tools', 'add-nav.py'))


def main() -> int:
    if not os.path.exists(SUCCESSOR):
        print(f'the nav is now written by {SUCCESSOR}, which is not in this tree',
              file=sys.stderr)
        return 1
    print(f'superseded: forwarding to {os.path.relpath(SUCCESSOR, os.getcwd())}',
          file=sys.stderr)
    return subprocess.call([sys.executable, SUCCESSOR, *sys.argv[1:]])


if __name__ == '__main__':
    raise SystemExit(main())
