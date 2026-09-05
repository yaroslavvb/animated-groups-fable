"""Compare actual concentration movies, allowing lattice isometries and phases.

This is a diversity diagnostic, not PDE admission. Spatial means are removed at
each phase so a shared bulk oscillation cannot obscure different spatial shapes.
Only positive time shifts are allowed: time reversal is not a PDE symmetry.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter
from scipy.optimize import minimize
from scipy.signal import resample


def read_movie(path):
    path = Path(path)
    meta = json.loads(path.read_text())
    config = meta['config']
    dtype = '<f4' if meta['fieldEncoding'] == 'float32-le' else '<f8'
    field = np.fromfile(path.parent / meta['fieldUrl'], dtype=dtype)
    return meta, field.reshape(config['M'], 2, config['N'], config['N'])


def centered(field, size=24, phases=48):
    """Common Fourier grid; compare the whole orbit at normalized phase."""
    field = np.asarray(field, dtype=float)
    for axis, length in [(0, phases), (2, size), (3, size)]:
        if field.shape[axis] != length:
            field = resample(field, length, axis=axis).real
    return field - field.mean(axis=(2, 3), keepdims=True)


def point_group(family):
    rotation = np.array([[0, -1], [1, 0]]) if family == 'p4' else np.array([[1, -1], [1, 0]])
    reflection = np.array([[0, 1], [1, 0]])
    for exponent in range(4 if family == 'p4' else 6):
        matrix = np.linalg.matrix_power(rotation, exponent)
        yield matrix
        yield matrix @ reflection


def continuous_correlation(cross, correlation, normalization):
    """Refine sampled correlation peaks using the complete Fourier polynomial.

    Shifts use sample-index units in (time, y, x) order. The analytic gradient
    differentiates the same Fourier interpolation used for the final metric;
    no modes beyond the comparison-grid resampling are discarded.
    """
    shape=np.asarray(correlation.shape)
    frequencies=[2*np.pi*np.fft.fftfreq(length) for length in shape]
    scale=float(np.prod(shape))
    index=np.unravel_index(np.argmax(correlation),correlation.shape)
    best={'correlation':float(correlation[index]),'shift':np.asarray(index,dtype=float),'converged':True}
    sampled=best['correlation']
    if sampled/normalization>=1-1e-14 or np.max(np.abs(cross))/scale<normalization*1e-15:
        return {**best,'sampledCorrelation':sampled}

    def objective(shift):
        factors=[np.exp(1j*frequency*offset) for frequency,offset in zip(frequencies,shift)]
        terms=cross*factors[0][:,None,None]*factors[1][None,:,None]*factors[2][None,None,:]
        value=float(terms.sum().real)/(scale*normalization)
        gradient=np.array([float((terms*(1j*frequency.reshape(tuple(-1 if j==axis else 1 for j in range(3))))).sum().real)
                           for axis,frequency in enumerate(frequencies)])/(scale*normalization)
        return -value,-gradient

    # Nearby grid points can belong to one peak. Start from separate periodic
    # local maxima so a competing sampled maximum does not hide a better
    # between-sample alignment of the same smooth movie.
    maxima=np.flatnonzero(correlation==maximum_filter(correlation,size=3,mode='wrap'))
    maxima=maxima[np.argsort(correlation.ravel()[maxima])[-4:][::-1]]
    for flat in maxima:
        start=np.array(np.unravel_index(flat,correlation.shape),dtype=float)
        fit=minimize(objective,start,jac=True,method='L-BFGS-B',
                     options={'ftol':1e-15,'gtol':1e-11,'maxiter':150,'maxls':30})
        value,gradient=objective(fit.x)
        candidate=-value*normalization
        if np.isfinite(candidate) and candidate>best['correlation']:
            best={'correlation':candidate,'shift':np.mod(fit.x,shape),
                  'converged':bool(fit.success or np.linalg.norm(gradient,np.inf)<1e-8)}
        if best['correlation']/normalization>=1-1e-13:break
    return {**best,'sampledCorrelation':sampled}


def orbit_distance(first, second, family='p6', size=24, phases=48):
    """Normalized whole-movie shape RMS after continuous shifts and D4/D6.

    FFT grid peaks initialize analytic Fourier refinement in time and both
    lattice directions. This remains a finite-resolution, multistart numerical
    minimum, not an exhaustive proof of distinctness under all transformations.
    """
    if family not in ('p4','p6'):raise ValueError('Select p4 or p6 morphology.')
    a, b = centered(first, size, phases), centered(second, size, phases)
    axes = (0, 2, 3)
    ahat = np.fft.fftn(a, axes=axes)
    ea, eb = float(np.sum(a*a)), float(np.sum(b*b))
    if not np.isfinite([ea,eb]).all() or min(ea, eb) < 1e-20:
        raise ValueError('Shape comparison requires two spatially nonuniform movies.')
    y, x = np.indices((size, size))
    coordinates = np.array([x.ravel(), y.ravel()])
    best = None
    for matrix in point_group(family):
        transformed = matrix @ coordinates % size
        moved = b[:, :, transformed[1], transformed[0]].reshape(b.shape)
        cross=(ahat*np.conj(np.fft.fftn(moved,axes=axes))).sum(axis=1)
        correlation=np.fft.ifftn(cross).real
        aligned=continuous_correlation(cross,correlation,np.sqrt(ea*eb))
        dot=aligned['correlation'];shift=aligned['shift']
        error = max(0., ea + eb - 2*dot)
        relative = np.sqrt(error / ((ea + eb)/2))
        if best is None or relative < best['relativeShapeRms']:
            normalized=np.sqrt(max(0.,2-2*dot/np.sqrt(ea*eb)))
            best = dict(relativeShapeRms=float(relative), amplitudeNormalizedShapeRms=float(normalized), matrix=matrix.tolist(),
                        phaseShift=float(shift[0]/phases), latticeShift=[float(shift[2]/size),float(shift[1]/size)],
                        sampledRelativeShapeRms=float(np.sqrt(max(0.,ea+eb-2*aligned['sampledCorrelation'])/((ea+eb)/2))),
                        alignmentConverged=aligned['converged'])
        if best['amplitudeNormalizedShapeRms']<1e-7:break
    return {**best,'comparisonGrid':size,'comparisonPhases':phases,'continuousShiftRefinement':True,
            'alignmentMethod':'Whole-movie Fourier correlation, D4/D6 and continuous time/lattice shifts; four sampled-peak starts per isometry.',
            'caveat':'Comparison-grid resampling limits resolved detail; multistart local alignment is not an exhaustive uniqueness proof.'}


def spectrum(field, family='p6'):
    n = field.shape[-1]
    wave = np.asarray(field, dtype=float)
    wave -= wave.mean(axis=(2, 3), keepdims=True)
    power = np.mean(abs(np.fft.fft2(wave, axes=(2, 3)))**2, axis=(0, 1))
    power /= power.sum()
    freq = np.rint(np.fft.fftfreq(n)*n).astype(int)
    ky, kx = np.meshgrid(freq, freq, indexing='ij')
    radii = kx*kx + ky*ky + (kx*ky if family == 'p6' else 0)
    shells = sorted(({'squaredWaveNumber':int(q), 'fraction':float(power[radii==q].sum())}
                     for q in np.unique(radii) if q), key=lambda row:-row['fraction'])
    return shells[:8]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('metadata', nargs='+', type=Path)
    parser.add_argument('--family', choices=['p4','p6'], default='p6')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    movies = [read_movie(path) for path in args.metadata]
    report = {'family':args.family, 'scope':'Whole-period spatial shapes, excluding means; D4/D6 isometries and continuously refined Fourier phase/position shifts, no time reversal.',
              'records':[{'path':str(path), 'period':meta['config']['period'], 'spectrum':spectrum(field.copy(),args.family)}
                         for path,(meta,field) in zip(args.metadata,movies)], 'pairs':[]}
    for i in range(len(movies)):
        for j in range(i):
            result = orbit_distance(movies[i][1],movies[j][1],args.family)
            report['pairs'].append({'first':i,'second':j,**result})
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'records':len(movies),'minimumRelativeShapeRms':min((p['relativeShapeRms'] for p in report['pairs']), default=None)}))


if __name__ == '__main__':
    main()
