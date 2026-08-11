"""Render looping GIFs of film groups, mirroring docs/js/renderer.js.

Usage: gifs.py <catalog.json> <group-id> <out.gif> [--size 480] [--frames 48]
Specs use the same format as the web renderer: basis (cartesian), ops list
(M lattice-coords, v lattice-coords, s, tau), base point, cell size.
"""

import json
import math
import sys
from fractions import Fraction

from PIL import Image, ImageDraw

SS = 4  # supersampling factor
# NON-ROTATIONAL clock, mirrors renderer.js: a thick comma (chiral, so a
# rotated or reflected copy reads as such) fills like a vessel, fill level =
# theta mod 1 (injective — no rotational aliasing possible). Colors static;
# only the fill boundary moves. Reversal copies drain. Around each comma the
# phase ring shows WHICH of the group's N time intervals the copy is in,
# drawn in screen coordinates and never rotated with the copy — see the
# drawPhaseRing comment in renderer.js.
BODY_L = (219, 230, 242)
OUTLINE = (125, 147, 171)
FILL = (59, 110, 165)
LINE = (192, 57, 43)
BEAT_ON = (192, 57, 43)
BEAT_OFF = (216, 210, 196)
BG = (250, 249, 246)

COMMA_R = 0.62      # comma circumradius, in units of the motif radius
RING_MID = 0.78     # phase-ring centreline; its outer edge stays inside 0.85 r
RING_W = 0.13
# the five cubic segments of the comma, verbatim from renderer.js
RAW_COMMA = [
    ((0.40, -0.30), (0.52, 0.18), (0.32, 0.56), (-0.52, 0.74)),
    ((-0.52, 0.74), (-0.10, 0.52), (0.18, 0.26), (0.06, 0.02)),
    ((0.06, 0.02), (-0.14, 0.02), (-0.40, -0.10), (-0.40, -0.30)),
    ((-0.40, -0.30), (-0.40, -0.54), (-0.22, -0.68), (0.00, -0.68)),
    ((0.00, -0.68), (0.24, -0.68), (0.40, -0.54), (0.40, -0.30)),
]


def bezier(p0, p1, p2, p3, steps=16):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def _normalized_comma():
    """Recentre the raw comma on its bounding box and scale it to circumradius
    COMMA_R — the same one-off normalisation renderer.js does, sampled the
    same way (24 steps per segment), so the GIFs and the site agree."""
    pts = []
    for seg in RAW_COMMA:
        pts.append(seg[0])
        pts += bezier(*seg, steps=24)
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    cy = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
    k = COMMA_R / max(math.hypot(p[0] - cx, p[1] - cy) for p in pts)
    segs = [tuple(((p[0] - cx) * k, (p[1] - cy) * k) for p in seg)
            for seg in RAW_COMMA]
    ys = [(p[1] - cy) * k for p in pts]
    return segs, min(ys), max(ys)


COMMA_SEGS, BODY_TOP, BODY_BOT = _normalized_comma()


def motif_paths(r):
    """The comma outline as one closed polygon, in motif-local coords."""
    body = [(COMMA_SEGS[0][0][0] * r, COMMA_SEGS[0][0][1] * r)]
    for seg in COMMA_SEGS:
        body += bezier(*[(p[0] * r, p[1] * r) for p in seg], steps=24)
    return [body]


def _clip_below(poly, y0):
    """Sutherland-Hodgman clip of a polygon to the half-plane y >= y0
    (canvas y-down local coords: the liquid below the surface line)."""
    out = []
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        ain, bin_ = a[1] >= y0, b[1] >= y0
        if ain:
            out.append(a)
        if ain != bin_:
            t = (y0 - a[1]) / (b[1] - a[1])
            out.append((a[0] + t * (b[0] - a[0]), y0))
    return out


def draw_motif(draw, cx, cy, T, theta, r, layer="all"):
    """T = 2x2 pixel transform matrix applied to motif-local coords.

    Non-rotational clock: the comma fills with the dark color, fill level =
    theta mod 1; a bright line marks the surface. Layered exactly as
    renderer.js ("body" = comma outline, "tail" = liquid, "hands" = surface
    line) so painting is order-independent and coincident copies superimpose
    their surface lines."""

    def xf(p):
        x, y = p
        return (cx + T[0][0] * x + T[0][1] * y, cy + T[1][0] * x + T[1][1] * y)

    ph = theta % 1.0
    y_level = (BODY_BOT - ph * (BODY_BOT - BODY_TOP)) * r
    polys = motif_paths(r)

    if layer in ("all", "body"):
        for poly in polys:
            draw.polygon([xf(p) for p in poly], fill=BODY_L, outline=OUTLINE,
                         width=max(1, int(0.045 * r)))

    if layer in ("all", "tail"):
        for poly in polys:
            cp = _clip_below(poly, y_level)
            if len(cp) >= 3:
                draw.polygon([xf(p) for p in cp], fill=FILL)

    if layer in ("all", "hands"):
        for poly in polys:
            cp = _clip_below(poly, y_level)
            xs = [p[0] for p in cp if abs(p[1] - y_level) < 1e-9]
            if len(xs) >= 2:
                draw.line([xf((min(xs), y_level)), xf((max(xs), y_level))],
                          fill=LINE, width=max(2, int(0.09 * r)))


def beat_count(taus):
    """The order of a set of fractions in R/Z: the smallest n with every value
    in (1/n)Z. Mirrors beatCount in phases.js."""
    n = 1
    for t in taus:
        d = Fraction(t % 1.0).limit_denominator(24).denominator
        n = n * d // math.gcd(n, d)
    return n


def interval_count(spec):
    """N: the number of intervals the loop's distinguished instants cut the
    period into — the beat k/B from the time translations, together with the
    fixed points tau/2, tau/2 + 1/2 of every time reversal. Mirrors
    timeMarks in phases.js; the ring is that ruler wrapped into a circle."""
    taus = [op["tau"] for op in spec["ops"]]
    b = beat_count(taus)
    marks = {round((k / b) % 1.0, 6) for k in range(b)}
    for op in spec["ops"]:
        if op["s"] == -1:
            marks.add(round((op["tau"] / 2) % 1.0, 6))
            marks.add(round((op["tau"] / 2 + 0.5) % 1.0, 6))
    return beat_count(marks)


def draw_phase_ring(draw, cx, cy, theta, r, n):
    """N arcs, the copy's current interval lit. Drawn in SCREEN coordinates —
    no spatial transform is applied — so one interval is one arc on every
    copy; see the drawPhaseRing comment in renderer.js. PIL arc angles are
    degrees clockwise from 3 o'clock, matching canvas."""
    lit = int((theta % 1.0) * n) % n if n > 1 else -1
    gap = min(0.125 / n, 0.022) * 360.0
    box = [cx - RING_MID * r, cy - RING_MID * r,
           cx + RING_MID * r, cy + RING_MID * r]
    for k in range(n):
        draw.arc(box, (k / n) * 360.0 - 90.0 + gap,
                 ((k + 1) / n) * 360.0 - 90.0 - gap,
                 fill=(BEAT_ON if k == lit else BEAT_OFF),
                 width=max(1, int(RING_W * r)))


def _scale_of(T):
    return math.sqrt(abs(T[0][0] * T[1][1] - T[0][1] * T[1][0]))


CELLS = 4          # translation repeats across the frame, as renderer.js
MIN_CELLS = 3      # the fewest a dense group may be relaxed to
MIN_MOTIF_PX = 13  # below this the clock stops being readable


def _cell_for(spec, size, k):
    """the cell size that fits k translation repeats across a square frame"""
    B = spec["basis"]
    hy = max(abs(B[0][1]), abs(B[1][1])) or 1
    return max(size / (k * hy), 24)


def _auto_cell(spec, size):
    """Uniform cell spacing, mirroring renderer.js: CELLS repeats across the
    frame, relaxed towards MIN_CELLS when that is the only way to keep the
    motifs big enough to read. GIF frames are square, so both sides show the
    same count."""
    cell = _cell_for(spec, size, CELLS)
    r = _motif_radius(spec, cell) / SS
    if r > 0 and r < MIN_MOTIF_PX:
        cell = min(cell * (MIN_MOTIF_PX / r), _cell_for(spec, size, MIN_CELLS))
    return cell


def render_frame(spec, t, size, cell=None, rings=True):
    """`rings=False` drops the phase-ring annotation, which is deliberately
    NOT equivariant (it is never rotated with its copy): the pixel-invariance
    check in verify_animations.py asserts invariance of the pattern proper."""
    if cell is None:
        cell = _auto_cell(spec, size)
    W = size * SS
    img = Image.new("RGB", (W, W), BG)
    draw = ImageDraw.Draw(img)
    B = spec["basis"]
    s = cell * SS
    b1 = (B[0][0] * s, -B[0][1] * s)
    b2 = (B[1][0] * s, -B[1][1] * s)
    l1 = math.hypot(*b1)
    l2 = math.hypot(*b2)
    base = spec.get("base", [0.31, 0.17])
    # motif radius from the minimum orbit distance: stamps must not overlap,
    # or paint order (not equivariant) would break frame invariance
    pts = []
    for op in spec["ops"]:
        M = op["M"]
        # site coords mod 1: the {0,1} window is only complete for canonical
        # representatives (M*base can land outside the unit cell)
        bx = (M[0][0] * base[0] + M[0][1] * base[1] + op["v"][0]) % 1.0
        by = (M[1][0] * base[0] + M[1][1] * base[1] + op["v"][1]) % 1.0
        for m1 in (0, 1):
            for m2 in (0, 1):
                pts.append((bx + m1, by + m2))
    min_d = min(l1, l2)
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            dx = (pts[i][0] - pts[j][0]) * b1[0] + (pts[i][1] - pts[j][1]) * b2[0]
            dy = (pts[i][0] - pts[j][0]) * b1[1] + (pts[i][1] - pts[j][1]) * b2[1]
            d = math.hypot(dx, dy)
            if d > 1e-6 and d < min_d:
                min_d = d
    r = min(0.40 * min(l1, l2), 0.55 * min_d) * spec.get("motifScale", 1)
    cx0, cy0 = W / 2, W / 2

    # lattice window
    det = b1[0] * b2[1] - b2[0] * b1[1]
    inv = ((b2[1] / det, -b2[0] / det), (-b1[1] / det, b1[0] / det))
    m1s, m2s = [], []
    for px, py in [(-W / 2, -W / 2), (W / 2, -W / 2), (-W / 2, W / 2), (W / 2, W / 2)]:
        m1s.append(inv[0][0] * px + inv[0][1] * py)
        m2s.append(inv[1][0] * px + inv[1][1] * py)
    pad = 1.6
    m1r = range(math.floor(min(m1s) - pad), math.ceil(max(m1s) + pad) + 1)
    m2r = range(math.floor(min(m2s) - pad), math.ceil(max(m2s) + pad) + 1)

    Bpix = ((b1[0], b2[0]), (b1[1], b2[1]))
    Binv = inv
    visible = []
    for op in spec["ops"]:
        M = op["M"]
        # pixel transform of M: Bpix * M * Bpix^{-1}
        MB = ((Bpix[0][0] * M[0][0] + Bpix[0][1] * M[1][0],
               Bpix[0][0] * M[0][1] + Bpix[0][1] * M[1][1]),
              (Bpix[1][0] * M[0][0] + Bpix[1][1] * M[1][0],
               Bpix[1][0] * M[0][1] + Bpix[1][1] * M[1][1]))
        T = ((MB[0][0] * Binv[0][0] + MB[0][1] * Binv[1][0],
              MB[0][0] * Binv[0][1] + MB[0][1] * Binv[1][1]),
             (MB[1][0] * Binv[0][0] + MB[1][1] * Binv[1][0],
              MB[1][0] * Binv[0][1] + MB[1][1] * Binv[1][1]))
        theta = op["s"] * (t - op["tau"])
        for m1 in m1r:
            for m2 in m2r:
                lx = M[0][0] * base[0] + M[0][1] * base[1] + op["v"][0] + m1
                ly = M[1][0] * base[0] + M[1][1] * base[1] + op["v"][1] + m2
                px = lx * b1[0] + ly * b2[0]
                py = lx * b1[1] + ly * b2[1]
                if abs(px) > W / 2 + 3 * r or abs(py) > W / 2 + 3 * r:
                    continue
                visible.append((px, py, T, theta))
    # layered, order-independent painting (mirrors renderer.js)
    for layer in ("body", "tail", "hands"):
        for (px, py, T, theta) in visible:
            draw_motif(draw, cx0 + px, cy0 + py, T, theta, r, layer)
    if rings:
        n = interval_count(spec)
        for (px, py, T, theta) in visible:
            draw_phase_ring(draw, cx0 + px, cy0 + py, theta, r, n)
    return img.resize((size, size), Image.LANCZOS)


def render_gif(spec, out_path, size=480, frames=40, cell=None, seconds=4.0):
    # GIF delays are quantized to centiseconds: choose duration as a multiple
    # of 10 ms (frames=40, 4 s -> exactly 100 ms/frame) to keep the loop exact
    duration = round(1000 * seconds / frames / 10) * 10
    imgs = [render_frame(spec, i / frames, size, cell) for i in range(frames)]
    imgs[0].save(out_path, save_all=True, append_images=imgs[1:],
                 duration=duration, loop=0, optimize=True)
    return out_path


if __name__ == "__main__":
    args = sys.argv[1:]
    catalog_path, gid, out = args[0], args[1], args[2]
    opts = {"--size": 480, "--frames": 40}
    for k in list(opts):
        if k in args:
            opts[k] = int(args[args.index(k) + 1])
    with open(catalog_path) as f:
        catalog = json.load(f)
    entry = next(e for e in catalog["groups"] if e["id"] == gid)
    render_gif(entry["render"], out, size=opts["--size"], frames=opts["--frames"])
    print("wrote", out)
