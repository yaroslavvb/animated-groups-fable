#!/usr/bin/env python3
"""Group the Showcase's preview clips that look alike, so the page can fold them.

    python3 docs/showcase/tools/look-alikes.py --broad                # rebuild data/look-alikes.json
    python3 docs/showcase/tools/look-alikes.py --broad --check        # is the shipped file stale?
    python3 docs/showcase/tools/look-alikes.py --broad --montages DIR # and the PNGs that judge it

The Showcase cards one clip per (picture, wallpaper group), and a catalog that
sweeps a parameter hands it long runs of cards that are the same picture: F
.00395, .00398, .004 … .00405 of one Gray–Scott standing wave are, to the eye,
one animation.  This script finds those runs.  `make-manifest.py` reads the file
it writes and gives every section one card per cluster, with the rest folded
behind a `+N alike` chip, so the grid shows distinct pictures and not distinct
records.  Nothing here decides what is carded — only which cards look the same.

WHERE THE CLIP LIST COMES FROM
------------------------------
`showcase_common.all_rows(groups, KINDS, broad=…)` — the three catalogs
themselves, read exactly as `make-manifest.py` reads them, with the same
`--broad` flag — and never `data/showcase.json` and never a directory scan.
That is not a detail of style.  The manifest is what `make-manifest.py` WRITES,
so taking the clip list from it made one pass of the documented order cluster
the PREVIOUS clip set: every clip a catalog change added was missing from
`data/look-alikes.json` and shipped as its own unfolded card, which is the
duplicate this whole file exists to hide, and the way out was to run the pair
twice and remember to.  Read from the catalogs, the first pass is already the
right one.  (A directory scan is the other wrong source: it would let a clip no
catalog names any more into a cluster.)

WHAT A CLIP LOOKS LIKE, to this script
--------------------------------------
Every clip a non-viewer row names is decoded by
ffmpeg to 36 grayscale frames at 40x40 (`scale=…:flags=area`), blurred in space
with a periodic Gaussian of sigma 1.6 (7 px at the clip's own 176 px, about a
twelfth of a unit cell at `tiles=2`) and z-scored over all its pixels and
frames.  All 36 frames are kept: the whole linear-algebra stage costs about five
seconds, so dropping to 12 phases would buy nothing and would alias the fast
boundaries the monochrome clips are made of.  Colour clips are read in gray like
the rest; measured against an RGB signature on all 423 of them, not one pair
that gray called alike was a pair RGB called different, because a colouring is a
function of the same scalar field the shape already shows.

  * the blur is the reader's eye, not a detail.  The monochrome clips are hard
    black and white, so a one-pixel wobble of a boundary is a large RMS and a
    picture nobody can tell apart.  Blurring shrinks the distance inside the two
    known look-alike runs by a quarter (0.91 -> 0.73, 0.90 -> 0.69) and moves
    the median distance between unrelated clips by 0.003.

DISTANCE
--------
RMS difference of the two normalised clips, minimised over every cyclic shift in
time AND in the two screen axes:

    d(A,B) = min over (dt, dy, dx) of RMS(A - shift(B))  =  sqrt(2 - 2 c / N)

with c the largest 3-D cyclic cross-correlation and N the number of samples.
d = 0 is the same clip, sqrt(2) = 1.414 is uncorrelated, 2 is the negative.

Time shifts are needed because the clip is one period and two readings of one
wave start at different phases.  Translation is needed too, and that is not
obvious — the previews are drawn with a fixed camera (`framing=simulation`,
`tiles=2`) — but a catalog gives a pattern the origin its own solver landed on,
so the same picture is often drawn half a cell over.  The evidence: pairs like
`half-period-3df707d30ba5-T2` and `half-period-666667770109-T2` (mono, Gray–
Scott, F .0039837) are the same pinwheel tiling to the eye, sit at direct
distance 1.414 — orthogonal, the metric's word for "unrelated" — and at 0.005
once a shift is allowed.  Without the search they are never folded, which is
exactly the complaint.  With `tiles=2` the frame holds a whole number of unit
cells, so a cyclic screen shift is an honest translation of the pattern and not
a seam (on the triangular lattices the screen period is not axis-aligned, so
some of those translations are missed; that costs recall, never a false fold).

The search is affordable because of an admissible screen.  For any shift,
<A, shift(B)> <= sum over frequencies of |Â||B̂| (Cauchy–Schwarz, one frequency
at a time), so the magnitude spectra alone give a LOWER BOUND on d.  That bound
is one matrix product per (kind, equation); only the tenth of pairs it cannot
rule out get the full 3-D FFT correlation.  Every distance a merge or the
diameter guard below could turn on is therefore exact, and the rest are upper
bounds that cannot.  20 s all told, decoding included, on 18 cores.

CLUSTERING
----------
Within one (kind, equation) and never across it — a Brusselator checkerboard and
a Gray–Scott checkerboard are not the same picture, whatever the pixels say.

Single linkage at the threshold, with a diameter guard: a merge is refused if it
would put two members further than 1.25 * threshold apart.

Complete linkage was tried first and is wrong here.  At this threshold it leaves
37 pairs under 0.15 — the closest at 0.084, which is indistinguishable — in
different clusters, because the clusters they sit in are already as wide as the
threshold allows.  The reader then sees two identical cards side by side, which
is the thing being fixed.  Single linkage cannot do that: every pair under the
threshold ends up in one cluster.

A CLUSTER IS NOT A CHIP
-----------------------
Single linkage chains, and a chain can be two pictures: a run of steps each
under the threshold carries a hard rectangular checkerboard to a rounded pillow
lattice, and even with the guard the two ends of that run can be 0.35 apart —
well inside the band where a pair reads as two cards.  The guard bounds the
chain but does not break it, and a cluster is not what the reader is shown
anyway — a CHIP is, and a chip is per family.

So this file does not promise that a cluster is one picture.  It promises the
weaker, true thing — every pair under the threshold is in one cluster — and it
publishes `dists`, the full pairwise distance matrix of each cluster, so
`make-manifest.py` can split a family's members into as many chips as it takes
for **no folded card to be further than the threshold from the card it is
folded behind**.  That split (`fold_look_alikes`) is a greedy leader pass: the
leader of each chip is a card the section shows, and a card that is not within
the threshold of any leader becomes a leader itself.  Two shown cards are
therefore always more than the threshold apart, and every hidden card is within
it of the one hiding it — which is the pair of promises the reader can check.

The guard is not only insurance.  At 1.25 * threshold — 0.35 — it refuses the
merges that would have joined 20 pairs of clusters, and no two members of a
shipped cluster are further apart than 0.349.  It also bounds a chain before a
future catalog grows one, and it makes the `spread` and the `dists` this file
reports exact, because a cluster can never be wider than the radius out to which
distances are refined (0.35, comfortably past the 0.28 the fold splits on).

A cluster's representative is its medoid, the member with the smallest sum of
distances to the others; members are listed rep first, then by distance to it.

THE FILE
--------
`data/look-alikes.json`, sorted and stable, keyed by clip id — the manifest's
`preview` with the extension dropped.  Singletons are not listed.  Each cluster
carries `dists`: the upper triangle of its own distance matrix, in `members`
order, flattened row by row — d(0,1), d(0,2) … d(n-2,n-1).  Distances at or
under the threshold are exact; a larger one may be an upper bound (see the
screen above), which can only ever split a chip that could have stayed whole and
never hide a card the reader would call different.

`clustersDigest` is the sha256 of the `clusters` array itself.  Nothing else in
the file can see inside it — `fingerprint` and `clipsDigest` are both computed
from the clip list, which `--check` rebuilds from the catalogs — so deleting a
cluster and editing `counts` to match used to pass the gate.  It cannot now.

`clipsDigest` is the sha256 of the sorted clip ids alone, so `make-manifest.py`
can tell — from the rows it is about to ship, without decoding anything — that
this file was clustered from the clip set it is about to card.  Both scripts now
read the same catalogs, so a mismatch is no longer an ordering wart to be run
around: it is a real disagreement, and the manifest builder refuses on it.
`fingerprint` folds this script's own bytes, the threshold and the guard in on
top of it, so `--check` also calls the file stale when the method changed.
Re-running after a catalog changes is the whole build: this script has no
incremental mode, and does not need one.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
from concurrent.futures import ProcessPoolExecutor

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import showcase_common as sc  # noqa: E402

SHOWCASE = sc.SHOWCASE
OUT = os.path.join(SHOWCASE, "data", "look-alikes.json")
FFMPEG = "/opt/homebrew/bin/ffmpeg"

SCHEMA = "showcase-look-alikes-v1"
FRAMES = 36          # one period, every frame
SIZE = 40            # the decoded square
SIGMA = 1.6          # spatial blur, in decoded pixels
THRESHOLD = 0.28     # read off the ladder of sampled pairs; see `method.threshold`
GUARD = 1.25         # a cluster may not grow wider than GUARD * threshold
N = FRAMES * SIZE * SIZE

DASHES = "\u2010\u2011\u2012\u2013\u2014\u2015\u2212"   # the hyphens unicode spells differently

GREEK = {"α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon",
         "λ": "lambda", "μ": "mu", "ω": "omega", "σ": "sigma", "τ": "tau", "φ": "phi"}


# --------------------------------------------------------------------------- clips


def slug(text):
    """A stable ascii slug for an equation name: 'λ–ω system' -> 'lambda-omega-system'.

    The en dash that every one of these names is built on (Gray–Scott, λ–ω) has to become a
    hyphen BEFORE the ascii fold, or the fold drops it and glues the two halves together.
    """
    text = "".join(GREEK.get(ch, ch) for ch in text)
    text = "".join("-" if ch in DASHES else ch for ch in text)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text)).strip("-") or "other"


def read_clips(broad):
    """Every clip a non-viewer card names, once, in clip-id order.

    Straight out of the catalogs through `showcase_common`, the same reading
    `make-manifest.py` ships — so this runs BEFORE the manifest and still sees
    exactly the clip set the manifest is about to card.  `row['preview']` is
    already the clip id: the manifest is what appends `.mp4` and `.webp` to it.
    """
    groups = sc.Groups()
    clips = {}
    for row in sc.all_rows(groups, sc.KINDS, broad=broad):
        if row["kind"] == "viewer":
            continue
        cid = row["preview"]
        if cid not in clips:
            clips[cid] = {"id": cid, "kind": row["kind"], "equation": row["equation"],
                          "poster": cid + ".webp",
                          "name": row.get("name", ""), "params": row.get("params", ""),
                          "reading": row.get("reading", "")}
    return [clips[k] for k in sorted(clips)]


def clips_digest(clip_ids):
    """sha256 of the sorted clip ids alone.

    `make-manifest.py` spells this same four-line hash again over the rows it is
    about to ship, so it can refuse a clustering built from a different clip set
    without decoding a clip or importing this file.  Two spellings of one hash
    is a risk worth naming: they can only disagree loudly — every build would
    report the mismatch — never quietly.
    """
    h = hashlib.sha256()
    for cid in sorted(clip_ids):
        h.update(cid.encode("utf-8"))
        h.update(b"\n")
    return h.hexdigest()


def fingerprint(clip_ids, tau):
    """sha256 of the clips digest, this script's own bytes, the threshold and the guard.

    The last two are arguments rather than source, so a file built at another
    `--threshold` is stale for the same reason an edited script makes one stale.
    """
    h = hashlib.sha256()
    h.update(clips_digest(clip_ids).encode("ascii"))
    h.update(open(os.path.abspath(__file__), "rb").read())
    h.update(("%.6f/%.6f" % (tau, GUARD)).encode("ascii"))
    return h.hexdigest()


def _decode(cid):
    path = os.path.join(SHOWCASE, cid + ".mp4")
    proc = subprocess.run(
        [FFMPEG, "-v", "error", "-i", path,
         "-vf", "scale=%d:%d:flags=area,format=gray" % (SIZE, SIZE), "-f", "rawvideo", "-"],
        capture_output=True)
    want = FRAMES * SIZE * SIZE
    if proc.returncode or len(proc.stdout) != want:
        return cid, None
    return cid, np.frombuffer(proc.stdout, np.uint8).reshape(FRAMES, SIZE, SIZE).copy()


def decode_all(clips, workers):
    with ProcessPoolExecutor(workers) as pool:
        got = dict(pool.map(_decode, [c["id"] for c in clips], chunksize=16))
    bad = [cid for cid, arr in got.items() if arr is None]
    if bad:
        raise SystemExit("could not decode %d clip(s), first: %s.mp4" % (len(bad), bad[0]))
    return np.stack([got[c["id"]] for c in clips])


# --------------------------------------------------------------------------- signature


def signature(raw):
    """(n, T, S, S) uint8 -> blurred, z-scored float32."""
    X = raw.astype(np.float32)
    k = np.fft.fftfreq(SIZE) * SIZE
    g = np.exp(-2.0 * (np.pi * SIGMA * k / SIZE) ** 2).astype(np.float32)
    F = np.fft.fft2(X, axes=(-2, -1))
    F *= g[:, None] * g[None, :]
    X = np.real(np.fft.ifft2(F, axes=(-2, -1))).astype(np.float32)
    X -= X.mean(axis=(1, 2, 3), keepdims=True)
    X /= np.maximum(X.std(axis=(1, 2, 3), keepdims=True), 1e-6)
    return X


def time_distance(X, chunk=192):
    """RMS distance minimised over cyclic time shift, every pair, by FFT along time."""
    n = X.shape[0]
    Y = X.reshape(n, FRAMES, -1)
    Yf = np.fft.rfft(Y, axis=1).astype(np.complex64)
    nf = Yf.shape[1]
    D = np.empty((n, n), np.float32)
    for i0 in range(0, n, chunk):
        i1 = min(n, i0 + chunk)
        cross = np.empty((i1 - i0, n, nf), np.complex64)
        for f in range(nf):
            cross[:, :, f] = Yf[i0:i1, f, :].conj() @ Yf[:, f, :].T
        c = np.fft.irfft(cross, n=FRAMES, axis=2)
        D[i0:i1] = np.sqrt(np.maximum(0.0, 2.0 - 2.0 * c.max(axis=2) / N))
    D = np.minimum(D, D.T)
    np.fill_diagonal(D, 0.0)
    return D


def spectral_bound(X):
    """sqrt(2 - 2<|Â|,|B̂|>): a lower bound on the distance under ANY cyclic shift."""
    M = np.abs(np.fft.fftn(X, axes=(1, 2, 3))).reshape(X.shape[0], -1).astype(np.float32)
    M /= np.maximum(np.linalg.norm(M, axis=1, keepdims=True), 1e-12)
    return np.sqrt(np.maximum(0.0, 2.0 - 2.0 * (M @ M.T)))


def shift_distance(X, D, cutoff):
    """Refine the pairs the bound cannot rule out with the full 3-D shift search."""
    n = X.shape[0]
    if n < 2:
        return D, 0
    bound = spectral_bound(X)
    np.fill_diagonal(bound, np.inf)
    FX = np.fft.fftn(X, axes=(1, 2, 3)).astype(np.complex64)
    ahead = np.arange(n)
    refined = 0
    for i in range(n):
        j = np.nonzero((bound[i] < cutoff) & (ahead > i))[0]
        if not len(j):
            continue
        refined += len(j)
        corr = np.real(np.fft.ifftn(np.conj(FX[i])[None] * FX[j], axes=(1, 2, 3)))
        c = corr.reshape(len(j), -1).max(axis=1)
        d = np.minimum(np.sqrt(np.maximum(0.0, 2.0 - 2.0 * c / N)).astype(np.float32), D[i, j])
        D[i, j] = d
        D[j, i] = d
    return D, refined


def distances(X, cutoff):
    """Every pair's distance, exact wherever it could matter — below `cutoff` — and an upper
    bound (the time-shift-only distance) above it, where no merge and no guard can turn on it."""
    return shift_distance(X, time_distance(X), cutoff)


# --------------------------------------------------------------------------- clustering


def guarded_single_linkage(D, tau, guard):
    """Single linkage at tau, refusing any merge that would widen a cluster past guard."""
    n = D.shape[0]
    if n < 2:
        return [[i] for i in range(n)]
    iu = np.triu_indices(n, 1)
    v = D[iu]
    near = np.nonzero(v <= tau)[0]
    near = near[np.lexsort((iu[1][near], iu[0][near], v[near]))]
    home = list(range(n))
    members = {i: [i] for i in range(n)}
    for q in near:
        a, b = int(iu[0][q]), int(iu[1][q])
        ra, rb = home[a], home[b]
        if ra == rb:
            continue
        if D[np.ix_(members[ra], members[rb])].max() > guard:
            continue
        keep, drop = (ra, rb) if (len(members[ra]), -ra) >= (len(members[rb]), -rb) else (rb, ra)
        for i in members[drop]:
            home[i] = keep
        members[keep] = sorted(members[keep] + members[drop])
        del members[drop]
    return [members[k] for k in sorted(members)]


def medoid(M):
    """Index of the member with the smallest sum of distances; ties go to the lower index."""
    total = M.sum(axis=1)
    return int(np.lexsort((np.arange(M.shape[0]), total))[0])


def clusters_digest(clusters):
    """sha256 of the clusters array, exactly as `write()` renders it.

    `fingerprint` and `clipsDigest` are both computed from the clip list, which
    `--check` can rebuild from the catalogs — so neither can see inside
    `clusters` at all, and `counts` alone cannot stand in for them: deleting a
    cluster and decrementing `counts.clusters` and `counts.folded` to match left
    every other invariant true and printed "current".  This digest is over the
    membership itself, so an edit has to be a re-run.
    """
    text = json.dumps(clusters, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def audit(doc, clips):
    """Everything `--check` can know without decoding a clip, as a list of complaints.

    A fingerprint over the clip ids and this script's bytes cannot see a hand
    edit, a partial write or a dropped cluster inside `clusters` — and the gate
    used to print `counts` straight out of the file it was vouching for, so
    deleting a whole cluster from it still read "current — 481 clusters".  The
    counts are recomputed here, the membership is checked against
    `clustersDigest`, and so is every structural promise
    `make-manifest.read_look_alikes()` and the page itself rely on:

      * a clip in two clusters would make a row's `look` depend on iteration
        order, and a rep outside its own members would leave a family with
        nothing to fold behind;
      * a `dists` of the wrong length would make the fold split on the wrong
        number;
      * a cluster whose members are not all ONE kind and ONE equation is the
        one thing the design says can never happen — a mono clip folded behind
        a colour card would cross the kind filter, so the reader would pick
        "black & white" and find the chip gone with the card still there.  The
        clip records this run read are what say which kind and which equation a
        clip is; a member no catalog names any more is a complaint of its own.
    """
    why = []
    clusters = doc.get("clusters")
    if not isinstance(clusters, list):
        return ["clusters is not a list"]
    about = {c["id"]: (c["kind"], c["equation"]) for c in clips}
    seen = {}
    folded = 0
    for cl in clusters:
        cid = cl.get("id") or "?"
        members = cl.get("members") or []
        n = len(members)
        if n < 2:
            why.append("%s lists %d member(s); singletons are not listed" % (cid, n))
            continue
        folded += n - 1
        if cl.get("rep") not in members:
            why.append("%s names a rep that is not one of its own members" % cid)
        elif members[0] != cl["rep"]:
            why.append("%s does not list its rep first" % cid)
        want_about = (cl.get("kind"), cl.get("equation"))
        for clip in members:
            if clip in seen:
                why.append("%s is in two clusters (%s and %s)" % (clip, seen[clip], cid))
            seen[clip] = cid
            if clip not in about:
                why.append("%s holds %s, which no clip this run read is called" % (cid, clip))
            elif about[clip] != want_about:
                why.append("%s says %s · %s and holds %s, which is %s · %s"
                           % (cid, want_about[0], want_about[1], clip, *about[clip]))
        dists = cl.get("dists")
        want = n * (n - 1) // 2
        if not isinstance(dists, list) or len(dists) != want:
            why.append("%s carries %s distances, wants %d"
                       % (cid, "no" if dists is None else len(dists), want))
        elif abs(max(dists[:n - 1]) - float(cl.get("spread", -1))) > 5e-4:
            why.append("%s says spread %s, its rep row says %.4f"
                       % (cid, cl.get("spread"), max(dists[:n - 1])))
    counts = doc.get("counts") or {}
    for name, got in (("clips", len(clips)), ("clusters", len(clusters)), ("folded", folded)):
        if counts.get(name) != got:
            why.append("counts.%s says %s, the file holds %d" % (name, counts.get(name), got))
    if "clustersDigest" not in doc:
        why.append("no clustersDigest: written before this script hashed its own clusters")
    elif doc["clustersDigest"] != clusters_digest(clusters):
        why.append("clustersDigest: the clusters were edited after they were written")
    return why


# --------------------------------------------------------------------------- the run


def build(clips, tau, workers, verbose=True):
    raw = decode_all(clips, workers)
    X = signature(raw)
    groups = {}
    for i, c in enumerate(clips):
        groups.setdefault((c["kind"], c["equation"]), []).append(i)

    clusters, refined = [], 0
    for key in sorted(groups):
        sel = groups[key]
        D, r = distances(X[sel], tau * GUARD)
        refined += r
        found = []
        for cl in guarded_single_linkage(D, tau, tau * GUARD):
            if len(cl) < 2:
                continue
            M = D[np.ix_(cl, cl)]
            rep = medoid(M)
            # rep first even when another member is bit-identical to it (distance 0 as well)
            order = sorted(range(len(cl)),
                           key=lambda k: (k != rep, round(float(M[rep][k]), 6), clips[sel[cl[k]]]["id"]))
            # The whole matrix, in `members` order: the manifest builder needs
            # the distance between any two members of a cluster, because the
            # card a family SHOWS is not always this rep and a chip may not hide
            # a card that is far from the card it is behind.
            Mo = M[np.ix_(order, order)]
            iu = np.triu_indices(len(cl), 1)
            found.append({"rep": clips[sel[cl[rep]]]["id"],
                          "members": [clips[sel[cl[k]]]["id"] for k in order],
                          "spread": round(float(M[rep].max()), 4),
                          "dists": [round(float(v), 4) for v in Mo[iu]]})
        found.sort(key=lambda c: c["rep"])
        for nth, c in enumerate(found):
            c["id"] = "%s:%s:%04d" % (key[0], slug(key[1]), nth)
            c["kind"] = key[0]
            c["equation"] = key[1]
            clusters.append({k: c[k]
                             for k in ("id", "kind", "equation", "rep", "members", "spread", "dists")})
    if verbose:
        print("  %d pairs needed the full shift search" % refined, file=sys.stderr)
    return clusters


def method_note(tau):
    return {
        "signature": ("ffmpeg decodes each clip to %d grayscale frames at %dx%d "
                      "(scale flags=area); a periodic Gaussian of sigma %s blurs each frame in "
                      "space; the clip is then z-scored over all its pixels and frames."
                      % (FRAMES, SIZE, SIZE, SIGMA)),
        "distance": ("RMS difference of two normalised clips, minimised over every cyclic shift "
                     "in time and in the two screen axes: sqrt(2 - 2c/N) for the largest 3-D "
                     "cyclic cross-correlation c. 0 is identical, 1.414 uncorrelated."),
        "search": ("The magnitude spectra give an admissible lower bound on that distance "
                   "(Cauchy-Schwarz per frequency), so only the pairs it cannot rule out - a "
                   "tenth of them - get the full 3-D FFT correlation. Every distance a merge or "
                   "the guard can turn on is exact; the rest are upper bounds that cannot."),
        "clustering": ("Single linkage at the threshold within one (kind, equation) and never "
                       "across it, refusing any merge that would put two members further than "
                       "%.2f apart (%.2f x the threshold). Complete linkage was rejected: it "
                       "leaves pairs 0.084 apart - indistinguishable - in different clusters once "
                       "those clusters are threshold-wide, which is the duplicate the reader "
                       "complained about. The guard refuses the merges that would have joined 20 "
                       "pairs of clusters here, bounds a chain, and keeps `spread` and `dists` "
                       "exact out to its own radius." % (tau * GUARD, GUARD)),
        "chaining": ("Single linkage chains, so a cluster can hold two pictures joined by "
                     "intermediates and is NOT a promise that its members look alike. `dists` "
                     "carries the full pairwise matrix of each cluster, in `members` order, "
                     "upper triangle flattened row by row; make-manifest.py splits a family's "
                     "members into as many chips as it takes for no folded card to be further "
                     "than the threshold from the card it is folded behind, and two cards the "
                     "page shows are therefore always more than the threshold apart. Distances "
                     "at or under the threshold are exact; a larger one may be an upper bound, "
                     "which can split a chip but can never hide a card that is far away."),
        "representative": "The medoid: the member with the smallest sum of distances to the others.",
        "threshold": ("Read off a ladder of sampled pairs by distance band, not chosen to hit a "
                      "count, and judged on pairs rendered with the metric's own best (dt, dy, "
                      "dx) applied - so neither phase nor translation can stand in for a "
                      "difference. Below 0.26 a sampled pair is one picture every time. From "
                      "0.30 up it routinely is not: wavy ribbons against straight stripes at "
                      "0.354, a diamond checkerboard against rows of bells at 0.350, a lattice "
                      "of squares against a lattice of rings at 0.323, clean circles against a "
                      "melted checkerboard at 0.310. 0.40 and then 0.36 were earlier readings "
                      "and folded that whole band - about 260 of the folds at 0.36 are pairs the "
                      "reader would have called two pictures. 0.28 is the last line the eye "
                      "agrees with. `--montages` redraws what it was judged by."),
    }


def write(path, clusters, clips, tau):
    doc = {"schema": SCHEMA,
           "method": method_note(tau),
           "threshold": round(tau, 4),
           "fingerprint": fingerprint([c["id"] for c in clips], tau),
           "clipsDigest": clips_digest([c["id"] for c in clips]),
           "clustersDigest": clusters_digest(clusters),
           "counts": {"clips": len(clips),
                      "clusters": len(clusters),
                      "folded": sum(len(c["members"]) - 1 for c in clusters)},
           "clusters": clusters}
    text = json.dumps(doc, ensure_ascii=False, indent=1, sort_keys=False) + "\n"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return doc, len(text.encode("utf-8"))


# --------------------------------------------------------------------------- montages


def montages(clusters, clips, tau, outdir):
    """The three PNGs the threshold is judged by. PIL only, and only when asked."""
    from PIL import Image, ImageDraw, ImageFont
    os.makedirs(outdir, exist_ok=True)
    by = {c["id"]: c for c in clips}

    def font(sz):
        for p in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, sz)
                except Exception:
                    pass
        return ImageFont.load_default()

    F10, F12, F14 = font(10), font(12), font(14)
    TILE, PAD, CAP, LAB = 118, 6, 36, 20

    def grid(rows, path, title):
        ncol = max(len(r[1]) for r in rows)
        cw, ch = TILE + PAD, TILE + CAP + PAD + LAB
        im = Image.new("RGB", (PAD + ncol * cw, 26 + len(rows) * ch + PAD), (16, 16, 18))
        dr = ImageDraw.Draw(im)
        dr.text((PAD, 6), title, font=F14, fill=(238, 238, 238))
        for ri, (rlab, tiles) in enumerate(rows):
            y0 = 26 + ri * ch
            dr.text((PAD, y0), rlab, font=F12, fill=(255, 205, 120))
            y0 += LAB
            for ci, (poster, caption) in enumerate(tiles):
                x0 = PAD + ci * cw
                try:
                    t = Image.open(os.path.join(SHOWCASE, poster)).convert("RGB").resize((TILE, TILE), Image.LANCZOS)
                except Exception:
                    t = Image.new("RGB", (TILE, TILE), (60, 0, 0))
                im.paste(t, (x0, y0))
                dr.rectangle([x0, y0, x0 + TILE - 1, y0 + TILE - 1], outline=(70, 70, 76))
                for li, line in enumerate(caption[:3]):
                    dr.text((x0, y0 + TILE + 2 + li * 11), line[:27], font=F10, fill=(202, 202, 208))
        im.save(path)
        print("  %s" % path, file=sys.stderr)

    def tile(cid, head):
        c = by[cid]
        return (c["poster"], [head, c["params"], (c["reading"] or c["name"])[:26]])

    # (a) the 12 largest clusters
    rows = []
    for cl in sorted(clusters, key=lambda c: (-len(c["members"]), c["id"]))[:12]:
        tiles = [tile(m, ("REP " if m == cl["rep"] else "") + m.split("/")[-1][:16])
                 for m in cl["members"][:12]]
        rows.append(("%s · %s · %d members · spread %.2f"
                     % (cl["kind"], cl["equation"], len(cl["members"]), cl["spread"]), tiles))
    grid(rows, os.path.join(outdir, "clusters-largest.png"),
         "the 12 largest look-alike clusters at threshold %.2f, representative first" % tau)

    # (b)/(c) pairs either side of the line
    raw = decode_all(clips, os.cpu_count())
    X = signature(raw)
    groups = {}
    for i, c in enumerate(clips):
        groups.setdefault((c["kind"], c["equation"]), []).append(i)
    # What the reader is shown is a CHIP, not a cluster, and the split in
    # `make-manifest.fold_look_alikes` promises exactly one thing about it: a
    # folded card is within the threshold of the card it is folded behind, and
    # two cards the page shows are further apart than that. So the pairs to
    # judge are the pairs either side of the threshold itself — inside a cluster
    # for the first (nothing else can share a chip) and anywhere for the second.
    merged, apart = [], []
    for key in sorted(groups):
        sel = groups[key]
        D, _ = distances(X[sel], tau * GUARD)
        lab = np.zeros(len(sel), int)
        for t, cl in enumerate(guarded_single_linkage(D, tau, tau * GUARD)):
            for i in cl:
                lab[i] = t
        iu = np.triu_indices(len(sel), 1)
        same = lab[iu[0]] == lab[iu[1]]
        for q in range(len(iu[0])):
            d = float(D[iu[0][q], iu[1][q]])
            pair = (d, clips[sel[iu[0][q]]]["id"], clips[sel[iu[1][q]]]["id"])
            if same[q] and d <= tau:
                merged.append(pair)       # a chip may hide the second behind the first
            elif d > tau:
                apart.append(pair)        # the page shows both, wherever they were clustered
    merged.sort(key=lambda x: (-x[0], x[1]))
    apart.sort(key=lambda x: (x[0], x[1]))

    def pair_grid(items, path, title):
        rows = []
        for k in range(0, min(16, len(items)), 2):
            labs, tiles = [], []
            for d, a, b in items[k:k + 2]:
                labs.append("d %.3f" % d)
                tiles += [tile(a, "d %.3f" % d), tile(b, "d %.3f" % d)]
            rows.append(("   ·   ".join(labs), tiles))
        grid(rows, path, title)

    pair_grid(merged, os.path.join(outdir, "threshold-merged.png"),
              "threshold %.2f: the 16 widest pairs a chip may hide together (just under the line)" % tau)
    pair_grid(apart, os.path.join(outdir, "threshold-apart.png"),
              "threshold %.2f: the 16 closest pairs the page shows as two cards (just over it)" % tau)


# --------------------------------------------------------------------------- cli


def main():
    ap = argparse.ArgumentParser(description="Cluster the Showcase preview clips that look alike.")
    ap.add_argument("--check", action="store_true",
                    help="report whether data/look-alikes.json is stale; exit 1 if it is")
    ap.add_argument("--threshold", type=float, default=THRESHOLD,
                    help="distance at which two clips count as the same picture (default %.2f)" % THRESHOLD)
    ap.add_argument("--broad", action="store_true",
                    help="cluster the broad monochrome tier's clips too, not only the "
                         "strict one. Mirrors make-manifest.py's flag, and the shipped "
                         "tree is built with it, so --check wants it too")
    ap.add_argument("--workers", type=int, default=os.cpu_count(), help="decoder processes")
    ap.add_argument("--out", default=OUT, help="where to write the JSON")
    ap.add_argument("--montages", metavar="DIR",
                    help="also draw the three PNGs the threshold is judged by")
    args = ap.parse_args()

    clips = read_clips(args.broad)
    want = fingerprint([c["id"] for c in clips], args.threshold)

    if args.check:
        if not os.path.exists(args.out):
            print("look-alikes: %s is missing" % os.path.relpath(args.out, SHOWCASE))
            return 1
        have = json.load(open(args.out, encoding="utf-8"))
        ids = [c["id"] for c in clips]
        why = []
        if have.get("schema") != SCHEMA:
            why.append("schema %s, want %s" % (have.get("schema"), SCHEMA))
        if have.get("fingerprint") != want:
            why.append("fingerprint: the clip set, this script or the threshold changed")
        if "clipsDigest" not in have:
            why.append("no clipsDigest: written before this script read the catalogs directly")
        elif have["clipsDigest"] != clips_digest(ids):
            # The commonest cause by far is a forgotten --broad, which is a
            # different question from the file being out of date. Say which.
            why.append("clipsDigest: clustered from a different clip set — %d clips there, "
                       "%d in the %s tier this run read%s"
                       % (have.get("counts", {}).get("clips", 0), len(ids),
                          "broad" if args.broad else "strict",
                          "" if args.broad else " (did you mean --broad?)"))
        if abs(float(have.get("threshold", -1)) - args.threshold) > 1e-9:
            why.append("threshold %s, asked for %s" % (have.get("threshold"), args.threshold))
        # …and the clusters themselves, which no fingerprint covers.
        why += audit(have, clips)[:4]
        if why:
            print("look-alikes: STALE — " + "; ".join(why))
            return 1
        print("look-alikes: current — %d clips, %d clusters, %d folded, threshold %.2f"
              % (have["counts"]["clips"], have["counts"]["clusters"],
                 have["counts"]["folded"], have["threshold"]))
        return 0

    t0 = time.time()
    clusters = build(clips, args.threshold, args.workers)
    doc, nbytes = write(args.out, clusters, clips, args.threshold)
    biggest = max(clusters, key=lambda c: len(c["members"])) if clusters else None
    print("look-alikes: %d clips, %d clusters, %d folded, largest %d (%s · %s), %.0f kB, %.1fs"
          % (doc["counts"]["clips"], doc["counts"]["clusters"], doc["counts"]["folded"],
             len(biggest["members"]) if biggest else 0,
             biggest["kind"] if biggest else "-", biggest["equation"] if biggest else "-",
             nbytes / 1024.0, time.time() - t0))
    if args.montages:
        montages(clusters, clips, args.threshold, args.montages)
    return 0


if __name__ == "__main__":
    sys.exit(main())
