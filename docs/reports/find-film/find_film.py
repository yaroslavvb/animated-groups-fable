"""Find the 333 Brusselator film with symmetry and time evolution.

Requires Python 3 and NumPy. Run:
    python find_film.py
    python find_film.py --compare

--compare downloads the published film and compares its first frame after
aligning time. The search itself does not download or use the published film.
"""

import argparse
import urllib.request

import numpy as np

N, L, a, b, dt = 36, 40.0, 1.0, 2.3, 0.02
y, x = np.indices((N, N))
rest = np.array([a, b / a])[:, None, None]


def rate(q):  # the Brusselator on a triangular mesh, in a repeating box
    u, v = q
    lap = (
        (
            sum(
                np.roll(q, d, (1, 2))
                for d in [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1)]
            )
            - 6 * q
        )
        * 2
        / (3 * (L / N) ** 2)
    )
    return lap + np.array([a - (b + 1) * u + u * u * v, b * u - u * u * v])


def simulate(q, t):  # simulate for time t: RK4 with steps no longer than dt
    n = int(np.ceil(t / dt))
    h = t / n
    for _ in range(n):
        k1 = rate(q)
        k2 = rate(q + h / 2 * k1)
        k3 = rate(q + h / 2 * k2)
        k4 = rate(q + h * k3)
        q = q + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    return q


slide = lambda q: np.roll(
    q, (-N // 3, -2 * N // 3), (1, 2)
)  # (S q)(y, x) = q(y + N/3, x + 2N/3): costs T/3 of time
turn = (
    lambda q: q[:, (x - y) % N, -y % N]
)  # the 120-degree turn about the origin: costs no time


def find_film(q, T=6.355, tol=1e-10):
    """Return one frame of the film, its period T, and the number of sweeps it took."""
    q = (
        q + turn(q) + turn(turn(q))
    ) / 3  # costs no time, so impose it once and it stays
    for sweep in range(1, 400):
        q = simulate(q, T)  # one free period: what decays, decays
        third = simulate(q, T / 3)
        two_thirds = simulate(third, T / 3)

        lag = slide(third) - q  # zero on the film
        if np.sqrt(np.mean(lag * lag)) < tol:
            return q, T, sweep

        # T is off by 3 x lag / speed. Move it gently, since at first it's all noise.
        speed = rate(q)
        T -= np.clip(3 * np.sum(lag * speed) / np.sum(speed * speed), -0.1, 0.1)

        # What obeys the rule survives the average; what ticks in unison cancels.
        q = (q + slide(third) + slide(slide(two_thirds))) / 3
    raise RuntimeError("no convergence")


def compare_published(q, T):
    """Compare with the published 333 Brusselator film, allowing a phase shift."""
    url = (
        "https://yaroslavvb.github.io/animated-groups-fable/scott-gray/"
        "data/equation-orbits/e47c12f9099fb9d2b6d4.f32"
    )
    raw = urllib.request.urlopen(url).read()
    film0 = np.frombuffer(raw, dtype="<f4")[: 2 * N * N].astype(float).reshape(
        2, N, N
    )
    p = min(
        (simulate(q, T * j / 24 + 1e-12) for j in range(24)),
        key=lambda z: np.abs(z - film0).max(),
    )
    for _ in range(4):
        p = simulate(
            p, np.sum((film0 - p) * rate(p)) / np.sum(rate(p) ** 2) % T + 1e-12
        )
    print(
        "largest difference from the published first frame: "
        f"{np.abs(p - film0).max():.2e}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--compare", action="store_true")
    args = parser.parse_args()
    seed = args.seed
    q, T, sweeps = find_film(
        rest + 0.1 * np.random.default_rng(seed).standard_normal((2, N, N))
    )
    print(f"seed {seed}: T = {T:.10f} after {sweeps} sweeps")
    if args.compare:
        compare_published(q, T)
