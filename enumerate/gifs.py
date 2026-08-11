"""Render looping GIFs of film groups, mirroring docs/js/renderer.js.

Usage: gifs.py <catalog.json> <group-id> <out.gif> [--size 480] [--frames 48]
Specs use the same format as the web renderer: basis (cartesian), ops list
(M lattice-coords, v lattice-coords, s, tau), base point, cell size.
"""

import json
import math
import sys

from PIL import Image, ImageDraw

SS = 4  # supersampling factor
# NON-ROTATIONAL clock, mirrors renderer.js: the body fills like a vessel,
# fill level = theta mod 1 (injective — no rotational aliasing possible).
# Colors static; only the fill boundary moves. Reversal copies drain.
BODY_TOP = -0.85
BODY_BOT = 0.5

BODY_L = (219, 230, 242)
OUTLINE = (125, 147, 171)
FILL = (59, 110, 165)
LINE = (192, 57, 43)
BG = (250, 249, 246)


def bezier(p0, p1, p2, p3, steps=16):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def motif_paths(r):
    """Body polygon + beak triangle in motif-local coordinates (radius r)."""
    body = []
    body += bezier((-0.15 * r, -0.5 * r), (0.65 * r, -0.55 * r),
                   (0.55 * r, 0.28 * r), (0.05 * r, 0.42 * r))
    body += bezier((0.05 * r, 0.42 * r), (-0.28 * r, 0.5 * r),
                   (-0.42 * r, 0.12 * r), (-0.15 * r, -0.5 * r))
    beak = [(-0.15 * r, -0.5 * r), (0.1 * r, -0.85 * r), (0.22 * r, -0.45 * r)]
    return body, beak


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

    Non-rotational clock: the vessel (body + beak spout) fills with the dark
    color, fill level = theta mod 1; a bright line marks the surface. Layered
    exactly as renderer.js ("body" = vessel, "tail" = liquid, "hands" =
    surface line) so painting is order-independent and coincident copies
    superimpose their surface lines."""

    def xf(p):
        x, y = p
        return (cx + T[0][0] * x + T[0][1] * y, cy + T[1][0] * x + T[1][1] * y)

    ph = theta % 1.0
    y_level = (BODY_BOT - ph * (BODY_BOT - BODY_TOP)) * r
    body, beak = motif_paths(r)
    polys = [body, beak]

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


def _scale_of(T):
    return math.sqrt(abs(T[0][0] * T[1][1] - T[0][1] * T[1][0]))


def _auto_cell(spec, size):
    """Uniform repeat count, mirroring renderer.js: cell size chosen so every
    GIF shows the same number of translation repeats; sparse cells (one or
    two distinct spatial sites) get more repeats, very dense ones fewer.
    Sites are counted by distinct spatial part (reversal partners coincide)."""
    seen = set()
    for op in spec["ops"]:
        key = (tuple(tuple(r) for r in op["M"]),
               tuple(round(x % 1.0, 6) for x in op["v"]))
        seen.add(key)
    n = len(seen)
    repeats = 5 if n <= 1 else 4 if n <= 2 else 3 if n <= 6 else 2.0
    return max(24, size / repeats)


def render_frame(spec, t, size, cell=None):
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
    r = min(0.30 * min(l1, l2), 0.60 * min_d) * spec.get("motifScale", 1)
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
