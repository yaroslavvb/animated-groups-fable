"""Check a state exported by the browser (or by node_run.mjs) against the Python lab.

    python verify_glue.py <state.f64> <state.json> [out.json]

Reads the (2, 36, 36) float64 torus field the delayed-glue module ended on, together with
the delay it settled at, then:

  * measures the repository's twisted shooting residual on it, unprojected;
  * runs a short Newton-Krylov polish (lab.newton_krylov_rpo, the repo's own rpo_polish
    unknowns) and reports the polished period;
  * compares the replayed movie with the published record (lab.compare_orbits);
  * runs the repository's acceptance audit and reads the winding at the nine centres.
"""
import json
import os
import sys

import numpy as np

# The shared lab module (lab.py, which wraps the repository's rdlab.py).  Set LAB_PATH to the
# directory that holds it.
sys.path.insert(0, os.environ.get('LAB_PATH', os.path.join(os.path.dirname(__file__), 'lab')))
import lab  # noqa: E402

N, L, M = 36, 40.0, 48


def main(state_path, meta_path, out_path=None):
    meta = json.load(open(meta_path))
    q = np.fromfile(state_path, dtype='<f8').reshape(2, N, N)
    T = float(meta['period'])
    entry = lab.load_entry('g227')
    params = lab.brusselator_params(a=1.0, b=2.3)
    rec = lab.load_published()

    r = lab.twisted_residual(q, T, entry, params, L=L, N=N)
    raw = dict(twistedResidualRms=float(np.sqrt(np.mean(r ** 2))),
               twistedResidualMax=float(np.abs(r).max()))

    mov_raw = lab.movie_from_state(q, T, entry, params, M=M, L=L, N=N)
    raw['symmetryErrorRaw'] = float(lab.symmetry_error(mov_raw, entry))
    raw['compareRaw'] = lab.compare_orbits(rec, dict(frames=mov_raw, period=T), entry)

    pol = lab.newton_krylov_rpo(q, T, entry, params, L=L, N=N, maxiter=20, tol=1e-11,
                                snapshots=False)
    mov = lab.movie_from_state(pol['q'], pol['T'], entry, params, M=M, L=L, N=N)
    cmp_ = lab.compare_orbits(rec, dict(frames=mov, period=pol['T']), entry)
    aud = lab.audit(lab.movie_from_state(pol['q'], pol['T'], entry, params, M=M, L=L, N=N,
                                         project=True), pol['T'], entry, params, L=L)
    Ahat = lab.first_harmonic(mov)
    charges = lab.charges_at_centres(Ahat, entry)

    out = dict(
        source=dict(state=state_path, meta=meta_path),
        browser=dict(period=T, relativePeriodError=(T - rec['period']) / rec['period'],
                     periods=meta.get('periods'), rhsCalls=meta.get('rhsCalls'),
                     stopReason=meta.get('stopReason')),
        rawState=lab.json_safe(raw),
        polish=dict(iterations=pol['iterations'], residual=pol['residual'],
                    success=pol['success'], period=pol['T'],
                    periodMinusPublished=pol['T'] - rec['period'],
                    relativePeriodDifference=(pol['T'] - rec['period']) / rec['period'],
                    cost=lab.json_safe(pol['cost'])),
        compareWithPublished=lab.json_safe(cmp_),
        audit=lab.json_safe(aud),
        charges=lab.json_safe(charges),
        publishedPeriod=rec['period'],
    )
    print(json.dumps(out, indent=1)[:4000])
    if out_path:
        lab.write_json(out_path, out)
    return out


if __name__ == '__main__':
    main(*sys.argv[1:])
