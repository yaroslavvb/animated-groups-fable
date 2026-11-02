#!/usr/bin/env python3
"""Re-file atlas records whose film has more symmetry than the group it was searched under.

Every record of data/wallpaper-atlas.json was solved inside the fixed points of the group it
was searched under and certified on that group's operations only, so a film can satisfy all
of them and more besides; a reader watching it sees the larger group.  The audit of Sun 1 Nov
2026 (week 44), by symdetect `identify` and by a brute force over every lattice map and shift of
the saved bytes, found that five of the six records filed under g227 (r33₁3₂, R3, ITA No. 146)
carry eighteen operations on their torus, not nine: they are r3₂∗3 (g234, R3m, ITA No. 160),
the index-2 supergroup that adds mirror lines, so every frame is mirror-symmetric.  On Mon 2 Nov
2026 (week 45) symdetect (tol 3e-5) named g234 again for the two records moved below, and g227
for the sixth, the Gray–Scott wave 093822675be6367b, the one exact r33₁3₂ film.

REFILED is the one place those decisions live, and merge_atlas.py applies it after every merge,
so a rebuild cannot file the records back.  Two kinds of entry:

  move      the record goes to its measured group.  It keeps its id, its field, its
            thumbnails and its metadata file, which carry the label it was searched under,
            and takes the target group's canonical operations and a certificate for them
            from the repo's own gate code: research/equations/admit.py `certify` for an
            equation record, which integrates the saved bytes again, and audit.py `audit`
            for a Gray–Scott record, which keeps the independent integration of the same
            bytes, as audit_subgroups.py does, because it does not depend on the group.
            Nothing moves on a failing certificate.  An equation record also states its
            `model` at the top level, which is where the Showcase reads a record's equation.
  withdraw  the same orbit is already filed under its measured group as a record of its
            own (`twin`), so the record leaves the catalog.

The published spiral lattice of the clockwork-orbits tutorial (e47c12f9…) is moved even though
its twin daf4fcff… is filed under g234 already: the tutorial, the two standalone viewers and
every link to the film show those bytes.  A moved record keeps a link to it working: the
explorer sends a link that names a record under another group to the page that files it.

STATED lists the records beside it that state their `model` too: the twin, and ee085777…, the
other Brusselator film of g234, whose card the twin was folded behind.  Every other equation
record leaves it to `config.model`, and the Showcase calls those Gray–Scott; that is a bug of the
whole manifest, left alone here.  With all three stated, the Showcase files the three cards under
one equation and folds the twin and its look-alike behind the published film.

    python3 research/wallpaper/refile_atlas.py          apply, then rebuild the directory index
    python3 research/wallpaper/refile_atlas.py --check  exit 1 unless the atlas already says so
"""
import argparse, copy, hashlib, json, os, subprocess, sys
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent / 'equations'))


def encoded(obj):
    """build_catalog.encoded, spelled again: importing build_catalog needs Pillow, for thumbnails this never draws."""
    return json.dumps(obj, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


ATLAS = ROOT / 'data/wallpaper-atlas.json'
DECIDED = '2026-11-02'
WHERE = 'research/wallpaper/refile_atlas.py'
MEASURED = 'symdetect identify (tol 3e-5) and a brute-force search of every lattice map and shift on the saved bytes'
REFILED = (
    dict(id='equation:brusselator:g227:e47c12f9099fb9d2', source='g227', target='g234',
         name='Brusselator spiral lattice · r3₂∗3',
         why='The published spiral lattice of the clockwork-orbits tutorial. symdetect identify gives '
             'g234 r3₂∗3 (ITA 160 R3m, kernel p3m1, residual 0); the brute force finds exactly 18 '
             'operations on its 36×36×48 torus, all bit-exact: the nine of r33₁3₂ and nine more that '
             'involve a mirror. Every frame is mirror-symmetric (∗333, p3m1).'),
    dict(id='wallpaper:g227:432b2f331a2d84da', source='g227', target='g234',
         why='symdetect identify gives g234 r3₂∗3 (ITA 160 R3m, kernel p3m1, residual 6.8e-10); the '
             'brute force finds 18 operations on its 24×24×192 torus, with the same mirrors as the '
             'published spiral lattice.'),
    dict(id='equation:brusselator:g227:92242e9a2c38c135', source='g227', target=None, measured='g234',
         twin='equation:brusselator:g234:ee085777aa611c19',
         why='18 operations on its torus (r3₂∗3); the same orbit as ee085777, filed under g234.'),
    dict(id='equation:ginzburg-landau:g227:b0c5ee80b48db846', source='g227', target=None, measured='g234',
         twin='equation:ginzburg-landau:g234:54ee1ba00df4346e',
         why='18 operations on its torus (r3₂∗3); the same orbit as 54ee1ba0, filed under g234.'),
    dict(id='equation:ginzburg-landau:g227:7a20a89f0633bcef', source='g227', target=None, measured='g234',
         twin='equation:ginzburg-landau:g234:ed501ca19e1a189f',
         why='18 operations on its torus (r3₂∗3); the same orbit as ed501ca1, filed under g234.'),
)
STATED = ('equation:brusselator:g234:daf4fcffba1a3fb0', 'equation:brusselator:g234:ee085777aa611c19')


def config_hashes(configs):
    """sha256 of JavaScript's JSON.stringify of each config: the browser's own spelling (merge_atlas.py)."""
    js = ("const crypto=require('crypto');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>"
          "console.log(JSON.stringify(JSON.parse(s).map(c=>crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex')))));")
    out = subprocess.run([os.environ.get('NODE', 'node'), '-e', js], input=encoded(configs), capture_output=True, check=True)
    return json.loads(out.stdout)


def saved_field(record):
    c = record['config']; payload = (ROOT / record['fieldUrl']).read_bytes()
    if hashlib.sha256(payload).hexdigest() != record['fieldSha256']:
        raise ValueError('Field hash mismatch: ' + record['id'])
    return np.frombuffer(payload, dtype='<f4').reshape(c['M'], 2, c['N'], c['N'])


def certificate(record, config, group, gates):
    """The target group's certificate, from the gate that admitted the record in the first place."""
    gate = record['offlineVerification']['gateVersion']
    field = saved_field(record)
    if gate == 'equations-offline-v1':
        from admit import certify, verifier_fingerprint
        if verifier_fingerprint() != gates[gate]:
            raise ValueError('research/equations/admit.py or rdlab.py changed since the atlas was built')
        return certify(field, config, group)
    if gate == 'wallpaper-offline-v1':
        from audit import audit
        source = record['wallpaperVerification']['independentDynamics']
        kept = dict(source, method=source['method'] + ' Kept from the certificate of the same bytes under '
                    + record['groupId'] + ': the integration is of the saved field and does not depend on the group.')
        return audit(field, config, group, dynamics=kept)
    raise ValueError(f"{record['id']}: no gate {gate!r} to re-certify with")


def moved(record, entry, group, gates):
    config = {**record['config'], 'groupId': group['id'], 'ops': group['ops']}
    proof = certificate(record, config, group, gates)
    if not proof.get('passed'):
        raise SystemExit(f"{record['id']} fails the {group['id']} certificate; it stays where it is")
    out = copy.deepcopy(record)
    out.update(groupId=group['id'], config=config, wallpaperVerification=proof,
               classification='time-shift-orbit' if group['hasTimeShift'] else 'zero-offset-reference',
               lattice=group['lattice'], family=group['family'],
               diagnostics={k: proof[k] for k in ('spatialRms', 'temporalRms', 'minimum', 'maximum')})
    out['offlineVerification'] = dict(record['offlineVerification'], passed=True, configSha256=None)
    if entry.get('name'):
        out['name'] = out['patternName'] = entry['name']
    out['provenance'] = dict(record['provenance'], refiled={
        'from': record['groupId'], 'to': group['id'], 'decided': DECIDED, 'why': entry['why'],
        'measuredBy': MEASURED, 'tool': WHERE,
        'previousCertificate': {'groupId': record['groupId'], 'operations': len(record['config']['ops']),
                                'passed': record['wallpaperVerification']['passed']}})
    if 'model' in config:
        out['model'] = config['model']
    return out


def plan(orbits):
    """[(entry, index or None, state)] with state 'pending', 'done' or 'absent'."""
    at = {r['id']: i for i, r in enumerate(orbits)}
    rows = []
    for entry in REFILED:
        i = at.get(entry['id'])
        if i is None:
            rows.append((entry, None, 'done' if entry['target'] is None else 'absent'))
            continue
        here = orbits[i]['groupId']
        if here == entry['source']:
            rows.append((entry, i, 'pending'))
        elif entry['target'] and here == entry['target'] and orbits[i]['provenance'].get('refiled', {}).get('to') == here:
            rows.append((entry, i, 'done'))
        else:
            raise SystemExit(f"{entry['id']} is filed under {here}, which REFILED does not expect")
    return rows


def apply(orbits, groups, gates):
    """Return (the re-filed orbit list, what changed).  `gates` maps gate version to verifier fingerprint."""
    rows = plan(orbits)
    present = {r['id']: r for r in orbits}
    for entry, _, _ in rows:
        twin = entry.get('twin')
        if twin and (twin not in present or present[twin]['groupId'] != entry['measured']):
            raise SystemExit(f"{entry['id']}: its twin {twin} is not filed under {entry['measured']}")
    out = list(orbits); changed = []; drop = set(); fresh = []
    for entry, i, state in rows:
        if state == 'absent':
            raise SystemExit(f"{entry['id']} is not in the atlas; nothing to move")
        if state != 'pending':
            continue
        if entry['target'] is None:
            drop.add(i); changed.append(('withdrawn', entry['id'], entry['source'], entry['twin']))
        else:
            out[i] = moved(orbits[i], entry, groups[entry['target']], gates); fresh.append(i)
            changed.append(('moved', entry['id'], entry['source'], entry['target']))
    if fresh:
        for i, digest in zip(fresh, config_hashes([out[i]['config'] for i in fresh])):
            out[i]['offlineVerification']['configSha256'] = digest
    at = {r['id']: i for i, r in enumerate(out)}
    for rid in unstated(out):
        i = at[rid]; out[i] = dict(out[i], model=out[i]['config']['model'])
        changed.append(('stated', rid, 'model', out[i]['model']))
    return [r for i, r in enumerate(out) if i not in drop], changed


def unstated(orbits):
    """The STATED records that do not yet state their model at the top level."""
    present = {r['id']: r for r in orbits}
    missing = [rid for rid in STATED if rid not in present]
    if missing:
        raise SystemExit('STATED names records the atlas does not hold: ' + ', '.join(missing))
    return [rid for rid in STATED if present[rid].get('model') != present[rid]['config']['model']]


def gates_of(catalog):
    gates = {'wallpaper-offline-v1': catalog['verificationCodeSha256']}
    gates.update({k: v['verificationCodeSha256'] for k, v in (catalog.get('equationGates') or {}).items()})
    return gates


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='exit 1 unless REFILED and STATED are already applied')
    a = ap.parse_args()
    catalog = json.loads(ATLAS.read_text())
    if a.check:
        pending = [entry['id'] for entry, _, state in plan(catalog['orbits']) if state != 'done']
        pending += unstated(catalog['orbits'])
        print(('refile_atlas: pending ' + ', '.join(pending)) if pending else
              f'refile_atlas: current — {len(REFILED)} records re-filed, {len(STATED)} more state their model')
        return 1 if pending else 0
    groups = {g['id']: g for g in json.loads((ROOT / 'wallpaper-groups.json').read_text())['groups']}
    orbits, changed = apply(catalog['orbits'], groups, gates_of(catalog))
    for row in changed:
        print(' '.join(str(x) for x in row))
    if not changed:
        print('refile_atlas: nothing to do'); return 0
    catalog['orbits'] = orbits
    ATLAS.write_bytes(encoded(catalog))
    subprocess.run([sys.executable, str(HERE / 'build_index.py')], check=True, stdout=subprocess.DEVNULL)
    print(f'refile_atlas: {len(changed)} changes; {len(orbits)} records; directory index rebuilt')
    return 0


if __name__ == '__main__':
    sys.exit(main())
