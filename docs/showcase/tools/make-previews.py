#!/usr/bin/env python3
"""Render the Showcase's looping previews: one short clip per distinct picture.

    python3 docs/showcase/tools/make-previews.py --kind ember,colour,viewer
    python3 docs/showcase/tools/make-previews.py --kind mono --broad
    python3 docs/showcase/tools/make-previews.py --kind all --broad --force

`--broad` is what the shipped tree is built with: it draws the broad monochrome
tier as well as the strict one, 1 830 two-colour clips rather than 326.  The
threshold controls are drawn by neither — see `sc.mono_rows`.

Each clip is 36 frames of one period at 176 CSS pixels, drawn by the CPU twin of
the shader the live page uses.  Nothing here is captured off a running page —
every pixel comes from the same saved float32 the page loads — but a clip is a
reconstruction and not a recording: one temporal sample per output frame, box
filtered down from `--supersample`, where the live pages composite a multi-tap
shutter.  A boundary moving fast is a little crisper here than it is there.

    ember    the ember ramp of `../../scott-gray/render.mjs`, on the record's
             own U range, at the family page's `framing=simulation&tiles=2`.
    colour   argmax of the three samples the entry's `colouring` block names,
             in the catalog's palette, at the explorer's home framing.
    mono     the sign of the difference field the rule names, taken on the
             spectrally doubled grid the viewers reconstruct on, framed by the
             explorer's own `homeTiles` law at 176 px (`sc.mono_tiles`).
    viewer   each standalone page's own field and own rule, at its own framing.
             The chair tiling has no field: its card is that page's own shipped
             preview image, held still, and it is the one card here that is.

Geometry, for all four: a pixel at normalised screen (x right, y DOWN) reads
the plane point `span * (x - 1/2, y - 1/2)`, which becomes a lattice point
through `from_plane` — the identity on the square lattice and
`(x - y/√3, -2y/√3)` on the triangular one.  That is `viewTransform` of
`../../scott-gray/view-transform.mjs` and `latticeAt` of
`../../colour/colour-renderer.mjs`, which agree with each other, written once.

Sampling is periodic Catmull–Rom in space and in time, the reconstruction every
one of those shaders uses.  Every frame is drawn at `--supersample` times the
output size and box-filtered down, so what is averaged is the COLOURS the rule
assigned and never the field: the average of a field still has one sharp
boundary, only displaced, while the average of the colours carries the boundary
across every pixel it swept.

The run is idempotent — a clip whose .mp4 and .webp are both newer than the
field they were drawn from, than this script and than `showcase_common.py` is
skipped — and parallel over one process per core.  Editing either script
therefore costs a full redraw (about 90 s on 18 cores); that is the price of
never shipping a clip drawn by code the tree no longer holds.
"""

import argparse
import math
import os
import struct
import subprocess
import sys
import tempfile
import time
import zlib
from concurrent.futures import ProcessPoolExecutor

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import showcase_common as sc  # noqa: E402

SQRT3 = math.sqrt(3.0)


# --------------------------------------------------------------------------- sampling


def cubic_weights(t):
    """Catmull–Rom, the four weights of `cubicWeights` in every renderer here."""
    t2, t3 = t * t, t * t * t
    return (-0.5 * t + t2 - 0.5 * t3,
            1.0 - 2.5 * t2 + 1.5 * t3,
            0.5 * t + 2.0 * t2 - 1.5 * t3,
            -0.5 * t2 + 0.5 * t3)


def from_plane(lattice, x, y):
    """Plane (x right, y down) to lattice coordinates."""
    if lattice == 'square':
        return x, y
    return x - y / SQRT3, -2.0 * y / SQRT3


def screen_lattice(size, span, centre, lattice):
    """The lattice coordinate every output pixel reads, as two (size, size) arrays."""
    s = (np.arange(size) + 0.5) / size - 0.5
    px, py = np.meshgrid(s * span, s * span, indexing='xy')
    du, dv = from_plane(lattice, px, py)
    return centre[0] + du, centre[1] + dv


class Sampler:
    """Periodic bicubic resampling of an N×N node grid at a fixed set of points.

    The 16 neighbour indices and their weights depend only on the camera, which
    never moves inside a clip, so they are built once and every frame is two
    array operations: one gather and one weighted sum.
    """

    def __init__(self, u, v, n):
        a, b = np.asarray(u) * n, np.asarray(v) * n
        i0 = np.floor(a).astype(np.int64)
        j0 = np.floor(b).astype(np.int64)
        wx = cubic_weights(a - i0)
        wy = cubic_weights(b - j0)
        idx = np.empty((16,) + a.shape, dtype=np.int32)
        wgt = np.empty((16,) + a.shape, dtype=np.float32)
        for j in range(4):
            for i in range(4):
                k = 4 * j + i
                idx[k] = (((j0 + j - 1) % n) * n + ((i0 + i - 1) % n)).astype(np.int32)
                wgt[k] = (wy[j] * wx[i]).astype(np.float32)
        self.idx, self.wgt, self.shape = idx, wgt, a.shape

    def __call__(self, frame_flat):
        return np.einsum('k...,k...->...', self.wgt, frame_flat[self.idx])


def frame_at(volume, phase):
    """One frame of an (M, …) volume at a fractional phase, Catmull–Rom in time.

    `frameAt` of the standalone viewers, verbatim: four saved frames, periodic,
    the same weights the spatial reconstruction uses.
    """
    m = volume.shape[0]
    if m == 1:
        return volume[0]
    t = (phase - math.floor(phase)) * m
    k = int(math.floor(t))
    w = cubic_weights(t - k)
    out = w[0] * volume[(k - 1) % m]
    out = out + w[1] * volume[k % m]
    out = out + w[2] * volume[(k + 1) % m]
    return out + w[3] * volume[(k + 2) % m]


def upsample2(frame):
    """Band-limited periodic doubling of one N×N frame.

    Trigonometric interpolation commutes with every lattice automorphism, so a
    difference taken here is the exact band-limited difference and not a
    difference of interpolations — which is why the monochrome viewers take
    theirs on this grid and not on the nodes.
    """
    n = frame.shape[0]
    big = 2 * n
    f = np.fft.fft2(frame).copy()
    h = n // 2
    if n % 2 == 0:
        f[h, :] *= 0.5
        f[:, h] *= 0.5
    out = np.zeros((big, big), dtype=complex)
    lo, hi = slice(0, h + 1), slice(n - h, n)
    out[lo, lo] = f[lo, lo]
    out[lo, big - h:] = f[lo, hi]
    out[big - h:, lo] = f[hi, lo]
    out[big - h:, big - h:] = f[hi, hi]
    return (np.real(np.fft.ifft2(out)) * 4.0).astype(np.float32)


# --------------------------------------------------------------------------- palettes


def ember_lut():
    """The 1024-entry ramp `renderField` builds from `palettes.ember`."""
    stops = sc.EMBER_STOPS
    lut = np.empty((1024, 3), dtype=np.uint8)
    for i in range(1024):
        v = i / 1023
        j = 1
        while j < len(stops) - 1 and stops[j][0] < v:
            j += 1
        a, b = stops[j - 1], stops[j]
        f = (v - a[0]) / (b[0] - a[0])
        lut[i] = [round(a[c] + (b[c] - a[c]) * f) for c in (1, 2, 3)]
    return lut


EMBER_LUT = ember_lut()
COLOUR_LUT = np.array(sc.COLOUR_PALETTE, dtype=np.uint8)
INK_LUT = np.array(sc.INK, dtype=np.uint8)


def downsample(rgb, factor):
    if factor == 1:
        return rgb.astype(np.uint8)
    h, w, _ = rgb.shape
    block = rgb.astype(np.float32).reshape(h // factor, factor, w // factor, factor, 3)
    return np.clip(np.round(block.mean(axis=(1, 3))), 0, 255).astype(np.uint8)


# --------------------------------------------------------------------------- field io


def load_field(path, n, m, channels=2):
    raw = np.fromfile(path, dtype='<f4')
    want = m * channels * n * n
    if raw.size != want:
        raise ValueError(f'{path}: {raw.size} floats, expected {want}')
    return raw.reshape(m, channels, n, n)


# --------------------------------------------------------------------------- the rules


def render_ember(spec, size, supersample):
    """One channel through the ember ramp — the family pages and Plume."""
    n, m = spec['n'], spec['m']
    field = load_field(os.path.join(sc.DOCS, spec['field']), n, m)
    volume = np.ascontiguousarray(field[:, spec.get('channel', 0)]).reshape(m, n * n)
    big = size * supersample
    sampler = Sampler(*screen_lattice(big, spec['span'], spec['centre'], spec['lattice']), n)
    lo, hi = spec['range']
    span = hi - lo
    out = []
    for i in range(sc.FRAMES):
        value = sampler(frame_at(volume, i / sc.FRAMES))
        z = np.clip(np.round((value - lo) / span * 1023.0), 0, 1023).astype(np.int32)
        out.append(downsample(EMBER_LUT[z], supersample))
    return out


def render_ember_analytic(spec, size, supersample):
    """The Ember viewer: a relative equilibrium B(x) turned analytically, so the
    frame at phase φ is Re(B) cos 2πφ + Im(B) sin 2πφ — its shader's own
    `dot(field(p), uRotation)`, no frame interpolation anywhere."""
    n = spec['n']
    field = load_field(os.path.join(sc.DOCS, spec['field']), n, 1)
    planes = [np.ascontiguousarray(field[0, c]).reshape(n * n) for c in (0, 1)]
    big = size * supersample
    sampler = Sampler(*screen_lattice(big, spec['span'], spec['centre'], spec['lattice']), n)
    real, imag = sampler(planes[0]), sampler(planes[1])
    lo, hi = spec['range']
    out = []
    for i in range(sc.FRAMES):
        angle = 2 * math.pi * i / sc.FRAMES
        value = real * math.cos(angle) + imag * math.sin(angle)
        z = np.clip(np.round((value - lo) / (hi - lo) * 1023.0), 0, 1023).astype(np.int32)
        out.append(downsample(EMBER_LUT[z], supersample))
    return out


def _colour_frames(values, supersample):
    """argmax of three readings → the catalog's three inks, box-filtered down.

    The supersample is the anti-aliasing: what is averaged is the colour each
    sub-sample was assigned, exactly as `paint()` averages colours over the
    shutter and never the field.
    """
    return downsample(COLOUR_LUT[np.argmax(np.stack(values), axis=0)], supersample)


def render_colour(spec, size, supersample):
    """Gyre, Trefoil and Triskele — the three-colour rules, each at its own
    three sample points and its own three instants."""
    n, m = spec['n'], spec['m']
    field = load_field(os.path.join(sc.DOCS, spec['field']), n, m)
    volume = np.ascontiguousarray(field[:, spec.get('channel', 0)]).reshape(m, n * n)
    big = size * supersample
    u, v = screen_lattice(big, spec['span'], spec['centre'], spec['lattice'])
    rule = spec['rule']
    if rule == 'gyre':
        # g(q) = S q + w, S the 240° turn (u, v) → (v − u, −v… ) as the shader
        # builds it: q1 = (v − u + w0, −u + w1).  Reading k is at g^k q and at
        # phase φ + k/3.
        w = spec['w']
        points, q = [], (u, v)
        for _ in range(3):
            points.append(q)
            q = (q[1] - q[0] + w[0], -q[0] + w[1])
        lags = (0.0, 1.0 / 3.0, 2.0 / 3.0)
    elif rule == 'trefoil':
        b = spec['b']
        points = [(u + k * b[0], v + k * b[1]) for k in range(3)]
        lags = (0.0, 0.0, 0.0)
    elif rule == 'triskele':
        # R^-1 q = (v − u, −u), R^-2 q = (−v, u − v); every reading is a vec3 of
        # the three instants and the three are averaged after a cyclic
        # relabelling, which is `(a + b.gbr + c.brg) / 3`.
        points = [(u, v), (v - u, -u), (-v, u - v)]
        lags = None
    else:
        raise ValueError(rule)
    samplers = [Sampler(pu, pv, n) for pu, pv in points]
    out = []
    for i in range(sc.FRAMES):
        phase = i / sc.FRAMES
        if rule == 'triskele':
            instants = [sampler_frames(volume, phase + k / 3.0) for k in range(3)]
            readings = [[samplers[p](instants[k]) for k in range(3)] for p in range(3)]
            values = [(readings[0][k] + readings[1][(k + 1) % 3] + readings[2][(k + 2) % 3]) / 3.0
                      for k in range(3)]
        else:
            values = [samplers[k](frame_at(volume, phase + lags[k])) for k in range(3)]
        out.append(_colour_frames(values, supersample))
    return out


def sampler_frames(volume, phase):
    return frame_at(volume, phase)


def render_mono(spec, size, supersample):
    """The sign of the difference field, on the spectrally doubled grid."""
    n, m = spec['n'], spec['m']
    field = load_field(os.path.join(sc.DOCS, spec['field']), n, m)
    channel = np.ascontiguousarray(field[:, spec.get('channel', 0)]).astype(np.float64)
    kind = spec.get('ruleKind', 'half-turn')
    big_n = 2 * n
    doubled = np.stack([upsample2(channel[t]) for t in range(m)])
    if kind == 'half-period':
        w = doubled - np.roll(doubled, -(m // 2), axis=0)
    elif kind == 'threshold':
        w = doubled - np.median(doubled)
    else:
        # x → P x + c on the doubled grid; the catalog's `v` is in saved nodes,
        # so it doubles with the grid.
        p = np.array(spec['M'], dtype=np.int64)
        c = np.array(spec['v'], dtype=np.int64) * 2
        ys, xs = np.meshgrid(np.arange(big_n), np.arange(big_n), indexing='ij')
        qx = (p[0][0] * xs + p[0][1] * ys + c[0]) % big_n
        qy = (p[1][0] * xs + p[1][1] * ys + c[1]) % big_n
        w = doubled - doubled[:, qy, qx]
    volume = w.reshape(m, big_n * big_n).astype(np.float32)
    big = size * supersample
    sampler = Sampler(*screen_lattice(big, spec['span'], spec['centre'], spec['lattice']), big_n)
    out = []
    for i in range(sc.FRAMES):
        value = sampler(frame_at(volume, i / sc.FRAMES))
        out.append(downsample(INK_LUT[(value > 0).astype(np.int8)], supersample))
    return out


def render_halfturn_viewer(spec, size, supersample):
    """Plume Monochrome and Weave Monochrome: w = U(x, t) − U(−x, t), the half
    turn about the lattice origin, taken on the doubled grid."""
    spec = dict(spec, ruleKind='half-turn', M=[[-1, 0], [0, -1]], v=[0, 0])
    return render_mono(spec, size, supersample)


def render_still(spec, size, supersample):
    """A page with no field of its own: its shipped social still, one frame."""
    path = os.path.join(sc.DOCS, spec['still'])
    raw = subprocess.run(
        ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', path,
         '-vf', f'crop=min(iw\\,ih):min(iw\\,ih),scale={size}:{size}:flags=lanczos',
         '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        check=True, capture_output=True).stdout
    return [np.frombuffer(raw, dtype=np.uint8).reshape(size, size, 3)]


RENDERERS = {
    'ember': render_ember,
    'ember-analytic': render_ember_analytic,
    'gyre': render_colour,
    'trefoil': render_colour,
    'triskele': render_colour,
    'mono': render_mono,
    'halfturn': render_halfturn_viewer,
    'still': render_still,
}


# --------------------------------------------------------------------------- output


def write_png(path, rgb):
    h, w, _ = rgb.shape
    raw = b''.join(b'\x00' + rgb[y].tobytes() for y in range(h))

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n'
                 + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                 + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def encode(frames, mp4_path, webp_path, size, crf, quality):
    """h264 at one keyframe per loop, plus a WebP poster of the first frame.

    GOP 36 means every loop starts on a keyframe, so the clip is seamless and
    a browser can seek it without decoding a previous loop; `+faststart` puts
    the index first, which is what makes a 20 kB file start on one round trip.
    """
    if len(frames) == 1:
        frames = frames * sc.FRAMES
    payload = b''.join(np.ascontiguousarray(f).tobytes() for f in frames)
    subprocess.run(
        ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{size}x{size}',
         '-r', str(sc.FPS), '-i', '-', '-an',
         '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', str(crf),
         '-g', str(sc.FRAMES), '-keyint_min', str(sc.FRAMES), '-sc_threshold', '0',
         '-preset', 'veryslow', '-movflags', '+faststart', mp4_path],
        input=payload, check=True, capture_output=True)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        poster = tmp.name
    try:
        write_png(poster, frames[0])
        subprocess.run(['cwebp', '-quiet', '-q', str(quality), poster, '-o', webp_path],
                       check=True, capture_output=True)
    finally:
        os.unlink(poster)


# --------------------------------------------------------------------------- driver


def job_paths(kind, preview_id):
    directory = os.path.join(sc.PREVIEWS, kind)
    return (os.path.join(directory, preview_id + '.mp4'),
            os.path.join(directory, preview_id + '.webp'))


# What a clip is drawn from: the saved field, the renderer here, AND the module
# that decides the geometry. Every `_render` block — the tile count, the centre,
# the lattice, the channel, the range — is built by `showcase_common.py`, so a
# clip can be wrong because that file changed and this one did not. It was not
# in the comparison, and `--kind all --broad` would then report nothing to do
# over 2 632 stale clips while `make-manifest --check` stayed green, because the
# manifest does not depend on a single pixel. The current tree was correct only
# by the accident of which file was saved last.
SOURCES = tuple(os.path.abspath(path) for path in (__file__, sc.__file__))


def is_fresh(mp4, webp, source):
    if not (os.path.exists(mp4) and os.path.exists(webp)):
        return False
    stamps = [os.path.getmtime(path) for path in SOURCES if os.path.exists(path)]
    if source and os.path.exists(source):
        stamps.append(os.path.getmtime(source))
    newest = max(stamps)
    return os.path.getmtime(mp4) >= newest and os.path.getmtime(webp) >= newest


def run_one(task):
    kind, preview_id, spec, options = task
    mp4, webp = job_paths(kind, preview_id)
    source = os.path.join(sc.DOCS, spec['field']) if 'field' in spec else (
        os.path.join(sc.DOCS, spec['still']) if 'still' in spec else None)
    if not options['force'] and is_fresh(mp4, webp, source):
        return (kind, preview_id, 'skipped', 0, 0)
    started = time.time()
    renderer = RENDERERS[spec['rule']]
    supersample = 1 if spec['rule'] == 'still' else options['supersample']
    try:
        frames = renderer(spec, options['size'], supersample)
        crf = (options['crf_mono'] if spec['rule'] in ('mono', 'halfturn')
               else options['crf'])
        encode(frames, mp4, webp, options['size'], crf, options['quality'])
    except Exception as exc:                                     # noqa: BLE001
        return (kind, preview_id, f'FAILED {type(exc).__name__}: {exc}', 0, 0)
    return (kind, preview_id, 'wrote', os.path.getsize(mp4) + os.path.getsize(webp),
            time.time() - started)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--kind', default='all',
                    help='comma-separated: ember, colour, mono, viewer, or all')
    ap.add_argument('--force', action='store_true', help='redraw clips that are already current')
    ap.add_argument('--jobs', type=int, default=os.cpu_count() or 4)
    ap.add_argument('--size', type=int, default=sc.SIZE)
    ap.add_argument('--supersample', type=int, default=3)
    ap.add_argument('--crf', type=int, default=30)
    # A two-ink source is the worst case for chroma-subsampled h264: at CRF 30
    # the mono clips carry visible mosquito noise along the one contour that is
    # the whole point of the picture. A few MB on a 62 MB budget buys it back.
    ap.add_argument('--crf-mono', type=int, default=26,
                    help='CRF for the two-colour clips, whose contours ring at 30')
    ap.add_argument('--quality', type=int, default=78, help='cwebp quality for the poster')
    ap.add_argument('--broad', action='store_true',
                    help='card the broad monochrome tier too, not only the strict '
                         'one (the threshold controls are carded by neither)')
    ap.add_argument('--limit', type=int, default=0, help='render at most this many clips')
    ap.add_argument('--no-prune', dest='prune', action='store_false',
                    help='keep clips this run\'s catalogs no longer name')
    # The shipped tree is the broad one: 2 632 clips, 62.3 MB. The ceiling is a
    # tripwire against a renderer change that quietly doubles every clip, not a
    # budget the tier is expected to fit under, so it is set above what the
    # catalogs actually name rather than at it.
    ap.add_argument('--ceiling-mb', type=float, default=80.0,
                    help='fail if the whole previews tree exceeds this')
    args = ap.parse_args()

    kinds = sc.KINDS if args.kind == 'all' else tuple(k.strip() for k in args.kind.split(','))
    unknown = [k for k in kinds if k not in sc.KINDS]
    if unknown:
        ap.error(f'unknown kind(s): {", ".join(unknown)}')

    groups = sc.Groups()
    rows = sc.all_rows(groups, kinds, broad=args.broad)
    jobs = sc.preview_jobs(rows)
    options = {'force': args.force, 'size': args.size, 'supersample': args.supersample,
               'crf': args.crf, 'crf_mono': args.crf_mono, 'quality': args.quality}
    tasks = [(kind, pid, spec, options) for (kind, pid), spec in sorted(jobs.items())]
    if args.limit:
        tasks = tasks[:args.limit]
    for kind in kinds:
        os.makedirs(os.path.join(sc.PREVIEWS, kind), exist_ok=True)

    print(f'{len(rows)} cards, {len(tasks)} distinct clips, {args.jobs} workers', file=sys.stderr)
    started = time.time()
    done = {'wrote': 0, 'skipped': 0}
    failures, written_bytes = [], 0
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        for i, (kind, pid, status, size, seconds) in enumerate(pool.map(run_one, tasks, chunksize=1)):
            if status.startswith('FAILED'):
                failures.append((kind, pid, status))
            else:
                done[status] += 1
                written_bytes += size
            if (i + 1) % 50 == 0 or i + 1 == len(tasks):
                print(f'  {i + 1}/{len(tasks)}  {done["wrote"]} written, {done["skipped"]} current, '
                      f'{len(failures)} failed  ({time.time() - started:.0f} s)', file=sys.stderr)

    # A catalog that is rebuilt renames pictures; a clip nothing points at any
    # more is repository weight with no card behind it.
    if args.prune and not args.limit:
        wanted = {(kind, pid) for (kind, pid) in jobs}
        for kind in kinds:
            directory = os.path.join(sc.PREVIEWS, kind)
            for name in sorted(os.listdir(directory)):
                stem, extension = os.path.splitext(name)
                if extension in ('.mp4', '.webp') and (kind, stem) not in wanted:
                    os.unlink(os.path.join(directory, name))
                    print(f'  pruned {kind}/{name}', file=sys.stderr)

    total = 0
    per_kind = {}
    for kind in sc.KINDS:
        directory = os.path.join(sc.PREVIEWS, kind)
        if not os.path.isdir(directory):
            continue
        size = sum(os.path.getsize(os.path.join(directory, f)) for f in os.listdir(directory))
        count = len([f for f in os.listdir(directory) if f.endswith('.mp4')])
        per_kind[kind] = (count, size)
        total += size
    for kind, (count, size) in per_kind.items():
        print(f'  {kind:7s} {count:5d} clips  {size / 1e6:7.2f} MB', file=sys.stderr)
    print(f'  {"total":7s} {sum(c for c, _ in per_kind.values()):5d} clips  {total / 1e6:7.2f} MB '
          f'in {time.time() - started:.0f} s', file=sys.stderr)

    for kind, pid, status in failures[:20]:
        print(f'  FAILED {kind}/{pid}: {status}', file=sys.stderr)
    if failures:
        print(f'{len(failures)} clips failed', file=sys.stderr)
        return 1
    if total > args.ceiling_mb * 1e6:
        print(f'previews are {total / 1e6:.1f} MB, over the {args.ceiling_mb} MB ceiling',
              file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
