#!/usr/bin/env python3
"""Precompute exact-grid, zero-time-shift translations of saved concentration movies.

Run locally with Python 3 and NumPy. FFT autocorrelation proposes candidates;
every accepted translation is then compared directly against every saved U and V
sample. Neither screenshots, colour palettes, nor individual frames are used.
Fractional translations that do not map the playback mesh to itself are excluded.
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
MAX_ABSOLUTE_ERROR = 1e-7
MAX_RELATIVE_RMS = 1e-6


def translation_candidates(field):
    """Return integer (dy, dx) shifts passing a generous FFT RMS screen."""
    n = field.shape[-1]
    centered = field.astype(np.float64)
    centered -= np.mean(centered, axis=(0, 2, 3), keepdims=True)
    transform = np.fft.fft2(centered, axes=(-2, -1)) / (n * n)
    power = np.mean(np.abs(transform) ** 2, axis=(0, 1))
    correlation = np.fft.ifft2(power).real * n * n
    squared_rms = np.maximum(0, 2 * (correlation[0, 0] - correlation))
    # A genuine pointwise match necessarily passes this looser RMS screen.
    # The allowance also covers autocorrelation roundoff at its zero peak.
    allowance = 64 * np.finfo(np.float64).eps * max(float(power.sum()), 1e-12)
    return np.argwhere(squared_rms <= MAX_ABSOLUTE_ERROR ** 2 + allowance)


def verify_translation(field, dy, dx, variation):
    """Check both channels independently, at every node of every saved frame."""
    difference = np.roll(field, (int(dy), int(dx)), axis=(-2, -1)) - field
    channel_rms = np.sqrt(np.mean(np.square(difference, dtype=np.float64), axis=(0, 2, 3)))
    channel_max = np.max(np.abs(difference), axis=(0, 2, 3))
    relative = channel_rms / np.maximum(variation, 1e-12)
    if np.any(channel_max > MAX_ABSOLUTE_ERROR) or np.any(relative > MAX_RELATIVE_RMS):
        return None
    n = field.shape[-1]
    return {
        "v": [int(dx) / n, int(dy) / n],
        "gridShift": [int(dx), int(dy)],
        "rms": float(np.sqrt(np.mean(channel_rms ** 2))),
        "max": float(np.max(channel_max)),
        "relativeRms": float(np.max(relative)),
        "channelRms": channel_rms.tolist(),
        "channelMax": channel_max.tolist(),
    }


def analyze(field):
    if field.ndim != 4 or field.shape[1] != 2 or field.shape[-2] != field.shape[-1]:
        raise ValueError("Expected a frame-major [M,2,N,N] concentration movie")
    if not np.all(np.isfinite(field)):
        raise ValueError("Nonfinite concentration sample")
    variation = np.std(field.astype(np.float64), axis=(0, 2, 3))
    translations = []
    for dy, dx in translation_candidates(field):
        checked = verify_translation(field, dy, dx, variation)
        if checked is not None:
            translations.append(checked)
    return {"variationRmsByChannel": variation.tolist(), "translations": translations}


def build(output):
    orbits = {}
    counts = {}
    for family, base in (("p4", ROOT), ("p6", ROOT / "p6")):
        atlas = json.loads((base / "data/precomputed-atlas.json").read_text())
        histogram = {}
        for record in atlas["orbits"]:
            payload = (base / record["fieldUrl"]).read_bytes()
            actual_hash = hashlib.sha256(payload).hexdigest()
            if actual_hash != record["fieldSha256"]:
                raise ValueError("Field hash mismatch: " + record["id"])
            n, m = record["config"]["N"], record["config"]["M"]
            field = np.frombuffer(payload, dtype="<f4").reshape(m, 2, n, n)
            result = analyze(field)
            orbits[record["id"]] = {
                "fieldSha256": actual_hash,
                "family": family,
                "N": n,
                **result,
            }
            count = len(result["translations"])
            histogram[str(count)] = histogram.get(str(count), 0) + 1
        counts[family] = {"orbits": len(atlas["orbits"]), "translationCountHistogram": histogram}
        print(f"{family}: {counts[family]}", flush=True)
    document = {
        "schema": "overlay-translations-v1",
        "description": "Zero-time-shift translations checked against all saved Float32 samples of both concentrations. FFT autocorrelation only screens candidates; every accepted translation is directly verified. Integer grid shifts preserve the actual playback interpolation mesh. These additional periods describe each saved numerical solution, not additional imposed group relations or a continuum existence theorem.",
        "thresholds": {
            "maximumAbsoluteError": MAX_ABSOLUTE_ERROR,
            "maximumRelativeRmsPerChannel": MAX_RELATIVE_RMS,
            "relativeScale": "Per-channel standard deviation over the full space-time movie; floor 1e-12.",
        },
        "counts": counts,
        "orbits": orbits,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    return document


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/overlay-translations.json")
    arguments = parser.parse_args()
    build(arguments.output)
