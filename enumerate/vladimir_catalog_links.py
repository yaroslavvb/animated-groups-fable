#!/usr/bin/env python3
"""Map the 68 forward clockwork groups to Vladimir Bulatov's colour-group catalog.

Vladimir's catalog (https://github.com/vbulatov2011/colorsym-catalog, served from
https://colorsym-catalog.mathornament.workers.dev/) has one entry page per
(G, H, n): the colourings of G's pattern whose colour classes are the cosets of
the index-n subgroup H.  Its page for an entry named ``G/H[n]`` (optionally
``G/H[n]#k`` when G has several such subgroups up to conjugacy) lives at

    <Gstem>/<n>/<Gstem>-<Hstem>-<n>/          (* -> s; ``#k`` is not part of the path)

exactly as ``tools/make_entry_job.py`` / ``tools/make_entry_page.py`` build it.

A forward clockwork group with plane orbifold G, clock order N and kernel K
(the perfect N-colouring's colour-preserving subgroup) corresponds to the
entry G/K[N] whose K is *normal* in G with *cyclic* quotient G/K = C_N — the
kernel of the phase character.  When Vladimir's manifest lists several such
subgroups up to conjugacy in G (``#1``, ``#2``, …) they are the same colouring
type up to the affine normaliser (the correspondence has one record for the
(G, K-type, N) triple) and they share one page path; all their names are kept.

Writes docs/data/vladimir-catalog-links.json:

    {"meta": {...}, "links": {"<record id>": {"entry": "632/333[2]",
      "entries": ["632/333[2]"], "path": "632/2/632-333-2/",
      "url": "https://.../632/2/632-333-2/", "rendered": false}, ...}}

``rendered`` says whether the snapshot of the catalog given by --catalog
already contains that page (Vladimir's catalog is a growing prototype).

Usage:
    python3 enumerate/vladimir_catalog_links.py \
        --catalog ~/git/colorsym-catalog \
        --base-url https://colorsym-catalog.mathornament.workers.dev/
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CORRESPONDENCE = os.path.join(ROOT, "docs", "data", "clockwork-coloring-correspondence.json")
OUTPUT = os.path.join(ROOT, "docs", "data", "vladimir-catalog-links.json")


def vname(orbifold):
    """Correspondence orbifold spelling -> Vladimir's manifest spelling."""
    return orbifold.replace("◦", "o").replace("×", "x")


def stem(name):
    """Vladimir's directory stem for a group name (`*` -> `s`)."""
    return vname(name).replace("*", "s")


def perm_group(perms, n):
    """Close the permutation images of the generators; return the set of perms."""
    identity = tuple(range(n))
    seen = {identity}
    queue = [identity]
    gens = [tuple(p) for p in perms]
    while queue:
        q = queue.pop()
        for g in gens:
            r = tuple(g[x] for x in q)
            if r not in seen:
                seen.add(r)
                queue.append(r)
    return seen


def perm_order(p):
    n = len(p)
    seen = [False] * n
    order = 1
    for i in range(n):
        if seen[i]:
            continue
        length = 0
        j = i
        while not seen[j]:
            seen[j] = True
            j = p[j]
            length += 1
        # lcm
        a, b = order, length
        while b:
            a, b = b, a % b
        order = order * length // a
    return order


def quotient_is_cyclic(subgroup, n):
    """G/H acting regularly on the n cosets is C_n: |image| = n with an n-cycle element."""
    perms = [entry["perm"] for entry in subgroup["colorAction"]]
    image = perm_group(perms, n)
    return len(image) == n and any(perm_order(p) == n for p in image)


def load_manifests(catalog):
    index = json.load(open(os.path.join(catalog, "data", "index.json"), encoding="utf-8"))
    manifests = {}
    for group in index["groups"]:
        manifests[group["name"]] = json.load(
            open(os.path.join(catalog, "data", group["file"]), encoding="utf-8"))
    return manifests


def entry_path(entry_name):
    """'632/333[8]#2' -> '632/8/632-333-8/' (mirrors tools/make_entry_page.py)."""
    gsym, rest = entry_name.split("/")
    hsym = rest.split("[")[0]
    n = int(rest.split("[")[1].split("]")[0])
    slug = ("%s-%s-%d" % (gsym, hsym, n)).replace("*", "s")
    return "%s/%d/%s/" % (gsym.replace("*", "s"), n, slug)


def build(catalog, base_url):
    data = json.load(open(CORRESPONDENCE, encoding="utf-8"))
    manifests = load_manifests(catalog)
    links = {}
    problems = []
    for record in data["groups"]:
        G = vname(record["parent"]["orbifold"])
        K = vname(record["kernel"]["orbifold"])
        N = int(record["clock_order"])
        manifest = manifests[G]
        candidates = [s for s in manifest["subgroups"]
                      if s["index"] == N and s["type"] == K and s["normal"]
                      and quotient_is_cyclic(s, N)]
        if not candidates:
            problems.append("%s: no normal %s/%s[%d] with cyclic quotient" % (record["id"], G, K, N))
            continue
        paths = {entry_path(s["name"]) for s in candidates}
        if len(paths) != 1:
            problems.append("%s: candidates map to several paths %s" % (record["id"], sorted(paths)))
            continue
        path = paths.pop()
        # entries[i] and manifest_ids[i] describe the same subgroup: Vladimir's
        # "#k" numbering does not follow his id numbering, so sort once, by name.
        candidates.sort(key=lambda s: s["name"])
        rendered = os.path.isfile(os.path.join(catalog, path, "index.html"))
        links[record["id"]] = {
            "entry": "%s/%s[%d]" % (G, K, N),
            "entries": [s["name"] for s in candidates],
            "manifest_ids": [s["id"] for s in candidates],
            "path": path,
            "url": base_url + path,
            "rendered": rendered,
        }
    return data, links, problems


def catalog_commit(catalog):
    try:
        return subprocess.check_output(["git", "-C", catalog, "rev-parse", "HEAD"],
                                       text=True).strip()
    except Exception:  # noqa: BLE001 - best effort provenance only
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--catalog", default=os.path.expanduser("~/git/colorsym-catalog"),
                        help="local checkout of vbulatov2011/colorsym-catalog")
    parser.add_argument("--base-url", default="https://colorsym-catalog.mathornament.workers.dev/")
    parser.add_argument("--output", default=OUTPUT)
    args = parser.parse_args()
    base_url = args.base_url if args.base_url.endswith("/") else args.base_url + "/"
    data, links, problems = build(args.catalog, base_url)
    if problems:
        for p in problems:
            print("ERROR", p, file=sys.stderr)
        sys.exit(1)
    out = {
        "meta": {
            "title": "Vladimir Bulatov colour-group catalog links for the forward clockwork groups",
            "catalog_repo": "https://github.com/vbulatov2011/colorsym-catalog",
            "catalog_commit": catalog_commit(args.catalog),
            "base_url": base_url,
            "source": os.path.relpath(CORRESPONDENCE, ROOT),
            "source_schema_version": data["meta"].get("schema_version"),
            "rule": "entry G/K[N]: K normal in G, G/K cyclic of order N; several manifest "
                    "subgroups (#k) of one type share the page path",
            "records": len(links),
            "rendered": sum(1 for v in links.values() if v["rendered"]),
        },
        "links": links,
    }
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("wrote %s: %d records, %d rendered in snapshot %s" % (
        os.path.relpath(args.output, ROOT), len(links), out["meta"]["rendered"],
        (out["meta"]["catalog_commit"] or "?")[:9]))


if __name__ == "__main__":
    main()
