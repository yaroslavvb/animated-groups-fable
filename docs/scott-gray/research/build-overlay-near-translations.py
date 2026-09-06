#!/usr/bin/env python3
"""Describe approximate p6 repeats without admitting additional symmetries.

Fourier peaks propose rational translation groups. Every proposed translation is
then measured against both concentrations of every saved frame, using the actual
triangular playback interpolant. The maximum is checked on the common refinement
of the translated and original meshes, so it bounds every spatial point and every
linearly interpolated playback phase. No concentration sample is changed.
"""

import argparse
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
MAX_RELATIVE_MAX = .05
MAX_RELATIVE_RMS = .02
MAX_INDEX = 144


def translation_group(wave):
    """Annihilator of one reciprocal 60-degree star, with exact integers."""
    a, b = map(int, wave)
    determinant = a * a + a * b + b * b
    if not 1 < determinant <= MAX_INDEX:
        return None
    # Rows (a,b), (a+b,-a); inverse = this adjugate / (-determinant).
    numerator = np.array([[a, b], [a + b, -a]], dtype=np.int64)
    vectors = {
        tuple(map(int, (numerator @ np.array([i, j])) % determinant))
        for i in range(determinant) for j in range(determinant)
    }
    if len(vectors) != determinant:
        raise ValueError("Reciprocal-star translation count is inconsistent")
    # Check the actual finite group and its 60-degree conjugation closure.
    for x, y in vectors:
        if ((x - y) % determinant, x % determinant) not in vectors:
            raise ValueError("Translation group does not respect the p6 rotation")
        for u, v in vectors:
            if ((x + u) % determinant, (y + v) % determinant) not in vectors:
                raise ValueError("Translation group is not closed")
    return {"denominator": determinant, "numerators": sorted(vectors)}


def reciprocal_candidates(transform):
    """Propose distinct stars from the twelve strongest nonconstant modes."""
    n = transform.shape[-1]
    power = np.mean(np.abs(transform) ** 2, axis=(0, 1))
    power[0, 0] = 0
    frequencies = np.rint(np.fft.fftfreq(n) * n).astype(int)
    seen, results = set(), []
    for flat in np.argsort(power.ravel())[-12:][::-1]:
        y, x = np.unravel_index(flat, power.shape)
        if power[y, x] <= power.sum() * 1e-8:
            continue
        wave = [int(frequencies[x]), int(frequencies[y])]
        group = translation_group(wave)
        if group is None:
            continue
        key = (group["denominator"], tuple(group["numerators"]))
        if key not in seen:
            seen.add(key)
            results.append({"wavevector": wave, **group})
    return sorted(results, key=lambda g: -len(g["numerators"]))


def extends_strict_group(group, strict):
    denominator = group["denominator"]
    points = set(group["numerators"])
    if len(points) <= len(strict):
        return False
    for vector in strict:
        scaled = np.array(vector) * denominator
        rounded = np.rint(scaled).astype(int)
        if np.max(abs(scaled - rounded)) > 1e-7:
            return False
        if tuple(rounded % denominator) not in points:
            return False
    return True


def sample_offset(field, offset):
    """Actual p6 triangular interpolation at every mesh node plus pixel offset."""
    dx, dy = offset
    ix, iy = np.floor([dx, dy]).astype(int)
    fx, fy = dx - ix, dy - iy
    a = np.roll(field, (-iy, -ix), axis=(-2, -1))
    c = np.roll(field, (-iy - 1, -ix - 1), axis=(-2, -1))
    if fx >= fy:
        b = np.roll(field, (-iy, -ix - 1), axis=(-2, -1))
        return (1 - fx) * a + (fx - fy) * b + fy * c
    b = np.roll(field, (-iy - 1, -ix), axis=(-2, -1))
    return (1 - fy) * a + (fy - fx) * b + fx * c


def common_mesh_vertices(pixel_shift):
    """All vertices of both triangular meshes' common refinement, modulo Z²."""
    dx, dy = pixel_shift
    xs, ys, diagonals = (0., (-dx) % 1), (0., (-dy) % 1), (0., (-dx + dy) % 1)
    points = {(x, y) for x in xs for y in ys}
    points.update((x, (x - diagonal) % 1) for x in xs for diagonal in diagonals)
    points.update(((y + diagonal) % 1, y) for y in ys for diagonal in diagonals)
    rounded = {tuple(round(v % 1, 12) % 1 for v in point) for point in points}
    return sorted(rounded)


def measure_translation(field, vector, ranges, screen_only=False):
    shift = np.asarray(vector) * field.shape[-1]
    offsets = [(0., 0.)] if screen_only else common_mesh_vertices(shift)
    channel_max, squared_sum = np.zeros(2), np.zeros(2)
    sample_count = 0
    for offset in offsets:
        difference = sample_offset(field, shift + offset) - sample_offset(field, offset)
        channel_max = np.maximum(channel_max, np.max(abs(difference), axis=(0, 2, 3)))
        squared_sum += np.sum(difference ** 2, axis=(0, 2, 3))
        sample_count += difference.shape[0] * difference.shape[2] * difference.shape[3]
    channel_rms = np.sqrt(squared_sum / sample_count)
    return {
        "v": [float(v) for v in vector],
        "channelMax": channel_max.tolist(),
        "channelSampleRms": channel_rms.tolist(),
        "channelRelativeMax": (channel_max / ranges).tolist(),
        "channelRelativeSampleRms": (channel_rms / ranges).tolist(),
        "maximumRelativeError": float(np.max(channel_max / ranges)),
        "maximumRelativeSampleRms": float(np.max(channel_rms / ranges)),
        "meshVertexOffsets": len(offsets),
    }


def accepted(measurement):
    return (measurement["maximumRelativeError"] <= MAX_RELATIVE_MAX
            and measurement["maximumRelativeSampleRms"] <= MAX_RELATIVE_RMS)


def spectral_defect(transform, group):
    n = transform.shape[-1]
    k = np.rint(np.fft.fftfreq(n) * n).astype(int)
    x, y = np.meshgrid(k, k)
    denominator = group["denominator"]
    forbidden = np.zeros((n, n), dtype=bool)
    maximum_rms = np.zeros(2)
    power = np.mean(abs(transform) ** 2, axis=0)
    for u, v in group["numerators"]:
        residue = (x * u + y * v) % denominator
        forbidden |= residue != 0
        phase_difference = np.exp(2j * np.pi * residue / denominator) - 1
        rms = np.sqrt(np.sum(power * abs(phase_difference) ** 2, axis=(-2, -1)))
        maximum_rms = np.maximum(maximum_rms, rms)
    nonconstant = power.copy()
    nonconstant[:, 0, 0] = 0
    fraction = np.sum(power * forbidden, axis=(-2, -1)) / np.maximum(np.sum(nonconstant, axis=(-2, -1)), 1e-30)
    return {
        "channelForbiddenPowerFraction": fraction.tolist(),
        "channelMaximumTranslationRms": maximum_rms.tolist(),
        "description": "Defect of the ordinary full-domain Fourier interpolant; diagnostic only, distinct from the measured triangular playback errors.",
    }


def analyze(field, strict=((0., 0.),)):
    if field.ndim != 4 or field.shape[1] != 2 or field.shape[-2] != field.shape[-1]:
        raise ValueError("Expected [M,2,N,N] concentration movie")
    if not np.all(np.isfinite(field)):
        raise ValueError("Nonfinite concentration sample")
    field = field.astype(np.float64)
    ranges = np.ptp(field, axis=(0, 2, 3))
    if np.any(ranges <= 1e-8):
        return None
    n = field.shape[-1]
    transform = np.fft.fft2(field, axes=(-2, -1)) / (n * n)
    for group in reciprocal_candidates(transform):
        if not extends_strict_group(group, strict):
            continue
        vectors = [np.array(v) / group["denominator"] for v in group["numerators"]]
        if any(not accepted(measure_translation(field, v, ranges, screen_only=True)) for v in vectors):
            continue
        measured = [measure_translation(field, v, ranges) for v in vectors]
        if not all(accepted(m) for m in measured):
            continue
        return {
            "classification": "approximate-only",
            "proposal": group,
            "strictTranslationCount": len(strict),
            "approximateTranslationCount": len(vectors),
            "concentrationRanges": ranges.tolist(),
            "maximumRelativeError": max(m["maximumRelativeError"] for m in measured),
            "maximumRelativeSampleRms": max(m["maximumRelativeSampleRms"] for m in measured),
            "translations": measured,
            "spectralDefect": spectral_defect(transform, group),
        }
    return None


def canonical_symmetry_bound(field, operations):
    """Max residual of the rotations used to derive additional rotation centres."""
    m, _, n, _ = field.shape
    y, x = np.indices((n, n))
    maximum = np.zeros(2)
    for operation in operations:
        matrix = np.asarray(operation["M"], dtype=int)
        tx, ty = np.asarray(operation.get("v", [0, 0])) * n
        shift = operation.get("tau", 0) * m
        if max(abs(tx - round(tx)), abs(ty - round(ty)), abs(shift - round(shift))) > 1e-8:
            raise ValueError("Canonical operation does not preserve the playback mesh")
        mapped_x = (matrix[0, 0] * x + matrix[0, 1] * y + round(tx)) % n
        mapped_y = (matrix[1, 0] * x + matrix[1, 1] * y + round(ty)) % n
        transformed = np.roll(field[:, :, mapped_y, mapped_x], -round(shift), axis=0)
        maximum = np.maximum(maximum, np.max(abs(transformed - field), axis=(0, 2, 3)))
    return {
        "channelMax": maximum.tolist(),
        "derivedRotationMaximumBound": "For a derived rotation, add this per-channel canonical maximum to that translation's channelMax. Canonical p6 rotations preserve the triangular mesh and frame shifts, so the bound holds throughout the interpolated movie.",
    }


def analyze_record(inputs):
    record, strict = inputs
    base = ROOT / "p6"
    payload = (base / record["fieldUrl"]).read_bytes()
    sha = hashlib.sha256(payload).hexdigest()
    if sha != record["fieldSha256"]:
        raise ValueError("Field hash mismatch: " + record["id"])
    n, m = record["config"]["N"], record["config"]["M"]
    if strict["fieldSha256"] != sha or strict["N"] != n:
        raise ValueError("Strict translation evidence mismatch")
    field = np.frombuffer(payload, dtype="<f4").reshape(m, 2, n, n)
    result = analyze(field, [t["v"] for t in strict["translations"]])
    if result:
        result["canonicalSymmetryBound"] = canonical_symmetry_bound(field, record["config"]["ops"])
        result = {"fieldSha256": sha, "family": "p6", "N": n, **result}
    return record["id"], result


def build(output, workers=1):
    base = ROOT / "p6"
    atlas = json.loads((base / "data/precomputed-atlas.json").read_text())
    strict_index = json.loads((ROOT / "data/overlay-translations.json").read_text())
    orbits = {}
    inputs = [(r, strict_index["orbits"][r["id"]]) for r in atlas["orbits"]]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for identifier, result in pool.map(analyze_record, inputs):
            if result:
                orbits[identifier] = result
                print(identifier, result["approximateTranslationCount"], result["maximumRelativeError"], flush=True)
    document = {
        "schema": "overlay-near-translations-v1",
        "description": "Approximate smaller repeats of saved p6 movies, never verified additional symmetries. Reciprocal peaks only propose candidates. Every translation of a closed rational p6 group is checked in both concentrations of every saved frame using the actual triangular interpolant. No field or strict symmetry evidence is modified.",
        "thresholds": {"maximumRelativeErrorPerChannel": MAX_RELATIVE_MAX,
                       "maximumRelativeSampleRmsPerChannel": MAX_RELATIVE_RMS,
                       "relativeScale": "Each concentration's global maximum minus minimum over the full movie."},
        "maximumErrorScope": "All spatial points and all linear playback phases: the difference is affine on the common refinement of the two triangular meshes; its absolute maximum occurs at a checked vertex. Temporal interpolation cannot increase the maximum.",
        "rmsScope": "Finite-sample RMS at all common-refinement vertices in every mesh cell and every saved frame; this is not an area-integrated RMS or a continuum PDE verification.",
        "counts": {"examined": len(atlas["orbits"]), "approximateOnly": len(orbits)},
        "orbits": orbits,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    return document


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/overlay-near-translations.json")
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=1)
    args = parser.parse_args()
    build(args.output, workers=args.workers)
