#!/usr/bin/env python3
"""Reproduce the linked g6 / original 442 g96 orbit audit.

Requires Python 3 and NumPy. Run from any directory:
    python3 docs/reports/space-time-color/audit.py
    python3 docs/reports/space-time-color/audit.py --check

The first command writes audit.json beside this script; --check verifies the
checked-in values (allowing only floating-point roundoff). No field is modified.
This tests saved numerical samples, not existence of an exact continuum orbit.
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np


HERE = Path(__file__).resolve().parent
DOCS = HERE.parents[1]
MODEL_ROOT = DOCS / "scott-gray"
ORBIT_ID = "wallpaper:g6:731aa45654d4d690"
EXPECTED_SHA256 = "731aa45654d4d690f202dc48818e47c8fe023bfd5462284a8601f4bed6563483"


def rms(a):
    return float(np.sqrt(np.mean(np.square(a))))


def residual(a, b, spans):
    r = a - b
    return {
        "maximumAbsolute": float(np.max(np.abs(r))),
        "rmsByChannel": [rms(r[:, c]) for c in range(2)],
        "rmsOverChannelRange": [rms(r[:, c]) / spans[c] for c in range(2)],
    }


def audit():
    atlas = json.loads((MODEL_ROOT / "data/wallpaper-atlas.json").read_text())
    record = next(r for r in atlas["orbits"] if r["id"] == ORBIT_ID)
    config = record["config"]
    n, m = config["N"], config["M"]
    payload = (MODEL_ROOT / record["fieldUrl"]).read_bytes()
    sha = hashlib.sha256(payload).hexdigest()
    if sha != EXPECTED_SHA256:
        raise ValueError(f"Expected the linked source field; received SHA256 {sha}")
    q = np.frombuffer(payload, dtype="<f4").reshape(m, 2, n, n).astype(np.float64)
    spans = [float(np.ptp(q[:, c])) for c in range(2)]
    y, x = np.indices((n, n))
    rotations = [
        (0, [[1, 0], [0, 1]], x, y),
        (90, [[0, -1], [1, 0]], -y, x),
        (180, [[-1, 0], [0, -1]], -x, -y),
        (270, [[0, 1], [-1, 0]], y, -x),
    ]
    operations = []
    for degrees, matrix, xx, yy in rotations:
        spatial = q[:, :, yy % n, xx % n]
        for quarter in range(4):
            # np.roll(...,-k)[t] is the saved sample at t+k.
            transformed = np.roll(spatial, -(quarter * m // 4), axis=0)
            operations.append({
                "rotationDegrees": degrees,
                "matrix": matrix,
                "translation": [0, 0],
                "phaseShift": quarter / 4,
                **residual(transformed, q, spans),
            })

    half = np.roll(q, -(m // 2), axis=0)
    channels = []
    for c, label in enumerate(["U", "V"]):
        original, shifted = q[:, c], half[:, c]
        span = spans[c]
        mean = float(original.mean())
        minimum, maximum = float(original.min()), float(original.max())
        covariance = float(np.mean((original - mean) * (shifted - mean)))
        slope = covariance / float(np.var(original))
        offset = mean * (1 - slope)
        midpoint = (minimum + maximum) / 2
        threshold_results = []
        for name, threshold in [
            ("full-range midpoint", midpoint),
            ("global mean", mean),
            ("global median", float(np.median(original))),
        ]:
            # A label swap succeeds iff these two Boolean labels differ.
            mismatch = (original > threshold) == (shifted > threshold)
            by_phase = mismatch.mean(axis=(1, 2))
            threshold_results.append({
                "thresholdName": name,
                "threshold": threshold,
                "highLabelFraction": float(np.mean(original > threshold)),
                "swapMismatchFraction": float(mismatch.mean()),
                "minimumPhaseMismatchFraction": float(by_phase.min()),
                "maximumPhaseMismatchFraction": float(by_phase.max()),
            })
        spectrum = np.fft.rfft(original, axis=0)
        energy = np.sum(np.abs(spectrum) ** 2, axis=(1, 2))
        # Parseval weights for a real, even-length DFT. Exclude the DC term;
        # this measures variation about each spatial node's temporal mean.
        weights = np.full(energy.shape, 2.0)
        weights[0] = weights[-1] = 1.0
        energy *= weights
        dynamic_energy = float(energy[1:].sum())
        odd_part = (original - shifted) / 2
        odd_flip_error = odd_part + np.roll(odd_part, -(m // 2), axis=0)
        channels.append({
            "channel": label,
            "range": [minimum, maximum],
            "rangeSpan": span,
            "globalMean": mean,
            "spatialStdOfPerNodeTemporalMean": float(np.std(original.mean(axis=0))),
            "halfPeriodIdentity": {
                "rms": rms(shifted - original),
                "rmsOverRange": rms(shifted - original) / span,
            },
            "halfPeriodReversalAboutGlobalMean": {
                "map": "z -> 2*globalMean-z",
                "rms": rms(shifted + original - 2 * mean),
                "rmsOverRange": rms(shifted + original - 2 * mean) / span,
            },
            "halfPeriodReversalAboutRangeMidpoint": {
                "map": "z -> minimum+maximum-z",
                "rms": rms(shifted + original - 2 * midpoint),
                "rmsOverRange": rms(shifted + original - 2 * midpoint) / span,
            },
            "halfPeriodBestAffineFit": {
                "map": "z -> slope*z+offset (least squares; not required to be an involution)",
                "slope": slope,
                "offset": offset,
                "rms": rms(shifted - slope * original - offset),
                "rmsOverRange": rms(shifted - slope * original - offset) / span,
            },
            "binaryThresholds": threshold_results,
            "temporalFourierEnergy": {
                "normalization": "Fraction of all non-DC real-DFT energy, summed over spatial nodes; DC means per-node temporal mean.",
                "firstHarmonicFraction": float(energy[1] / dynamic_energy),
                "evenHarmonicFraction": float(energy[2::2].sum() / dynamic_energy),
                "firstEightHarmonics": [
                    {"harmonic": j, "fraction": float(energy[j] / dynamic_energy)}
                    for j in range(1, 9)
                ],
            },
            "derivedOddTemporalPart": {
                "definition": "b(x,t) = (q(x,t)-q(x,t+T/2))/2",
                "halfPeriodSignReversalMax": float(np.max(np.abs(odd_flip_error))),
                "quarterTurnThreeQuarterPeriodSignReversalMax": float(np.max(np.abs(
                    odd_part + np.roll(odd_part[:, x % n, (-y) % n], -(3 * m // 4), axis=0)
                ))),
                "zeroValueFraction": float(np.mean(odd_part == 0)),
                "scope": "An exact algebraic projection of the saved movie, not a Gray-Scott concentration or independently evolved solution. A binary sign label is undefined at zero if exact label complementation is required.",
            },
        })

    source = json.loads((MODEL_ROOT / record["metadataUrl"]).read_text())
    return {
        "schema": "space-time-color-observed-orbit-audit-v1",
        "orbitId": ORBIT_ID,
        "fieldUrl": "../../scott-gray/" + record["fieldUrl"],
        "metadataUrl": "../../scott-gray/" + record["metadataUrl"],
        "fieldSha256": sha,
        "fieldByteLength": len(payload),
        "fieldShape": [m, 2, n, n],
        "fieldLayout": "Float32 little-endian; q[frame,channel,y,x], planar U then V; converted to Float64 for reductions.",
        "period": config["period"],
        "sourceGroupId": record["provenance"]["sourceGroupId"],
        "sourceKind": record["provenance"]["kind"],
        "operationConvention": "Compare q(R*x, t+tau*T) against q(x,t); x,y are periodic coordinates i/N. R90(x,y)=(-y,x) in mathematical coordinates, modulo the square lattice. All rotations have center (0,0).",
        "normalization": "RMS = sqrt(mean(error^2)) over all 128 frames and 48*48 nodes separately for each channel; normalized RMS divides by that channel's global maximum-minus-minimum over the full saved movie.",
        "testedScope": "All 16 combinations of rotations 0,90,180,270 degrees about the lattice origin and phases 0,1/4,1/2,3/4, without translation or color change. Additionally test scalar color reversal and best affine fit at T/2 with no rotation, and three specified binary thresholds. This is not an exhaustive search over centers, phase shifts, nonlinear palette permutations, or the maximal symmetry group.",
        "exactnessScope": "Maximum 0 means byte-exact equality of the saved samples. Grid-aligned quarter-turn and frame-aligned quarter-period identities also commute with the site's periodic linear/bilinear interpolation. This audit does not rerun the PDE solver or establish a continuum existence theorem.",
        "paletteInterpretation": {
            "ember": "A multistop gradient of U, normalized by the orbit's full U range; not two species, two labels, or an RGB complement operation.",
            "concentration": "The grayscale-like concentration palette displays V, normalized by the orbit's full V range.",
            "source": "../../scott-gray/render.mjs",
        },
        "speciesInterpretation": {
            "equations": "U_t=Du*lap(U)-U*V^2+F*(1-U); V_t=Dv*lap(V)+U*V^2-(F+k)*V",
            "colorSwap": "Relabeling a displayed color does not interchange U and V or change the chemical state.",
            "noSpeciesSwapSymmetry": "At the saved parameters Du=0.16 differs from Dv=0.08, and the feed/kill reaction terms differ. Exchanging U and V is not an equivariance of these equations.",
            "noConservationAssumption": "On a periodic domain, d mean(U+V)/dt = F*(1-mean(U))-(F+k)*mean(V), which is generally nonzero. A two-color complement must not be inferred from conservation of total concentration.",
            "source": "../../scott-gray/research/gray_scott_rk4.cpp",
        },
        "existingSourceValidationNotRerun": {
            key: source["validationSummary"][key]
            for key in ["candidateSymmetryMax", "refinedReturnRms", "refinedTrajectoryRms", "refinedDt"]
        },
        "spaceTimeOperations": operations,
        "channels": channels,
    }


def check_equal(expected, actual, path="root"):
    if isinstance(expected, dict):
        assert expected.keys() == actual.keys(), path
        for key in expected:
            check_equal(expected[key], actual[key], f"{path}.{key}")
    elif isinstance(expected, list):
        assert len(expected) == len(actual), path
        for i, (a, b) in enumerate(zip(expected, actual)):
            check_equal(a, b, f"{path}[{i}]")
    elif isinstance(expected, float):
        assert np.isclose(expected, actual, rtol=1e-11, atol=1e-13), (path, expected, actual)
    else:
        assert expected == actual, (path, expected, actual)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    options = parser.parse_args()
    result = audit()
    output = HERE / "audit.json"
    if options.check:
        check_equal(json.loads(output.read_text()), result)
        print("Checked saved audit: source SHA256 and all measurements agree.")
    else:
        output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
        print(f"Wrote {output}")
