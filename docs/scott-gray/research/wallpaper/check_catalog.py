#!/usr/bin/env python3
"""Check publication payload/config/certificate bindings without repeating search."""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent.parent
catalog=json.loads((ROOT/'data/wallpaper-atlas.json').read_text());groups={g['id']:g for g in json.loads((ROOT/'wallpaper-groups.json').read_text())['groups']}
codehash=hashlib.sha256(b''.join((HERE/name).read_bytes() for name in catalog['verificationSources'])).hexdigest()
assert catalog['verificationCodeSha256']==codehash
cache={};identities=set();new=0
for r in catalog['orbits']:
 assert r['id'] not in identities;identities.add(r['id']);c=r['config'];g=groups[r['groupId']];proof=r['wallpaperVerification'];gate=r['offlineVerification']
 assert c['groupId']==r['groupId'] and c['ops']==g['ops']
 assert gate['passed'] and gate['verificationCodeSha256']==codehash and gate['fieldSha256']==r['fieldSha256']
 assert proof['passed'] and proof['phaseRelations']['passed'] and proof['independentDynamics']['passed'] and proof['visibility']['passed'] and proof['forwardTargetPhaseBounds']['passed']
 path=ROOT/r['fieldUrl']
 if path not in cache:
  payload=path.read_bytes();cache[path]=(len(payload),hashlib.sha256(payload).hexdigest())
 size,digest=cache[path];assert size==r['fieldByteLength']==8*c['N']**2*c['M'] and digest==r['fieldSha256']
 assert r['classification']==('time-shift-orbit' if g['hasTimeShift'] else 'zero-offset-reference')
 if r['provenance']['kind']=='new-shooting':
  new+=1;metadata=json.loads((ROOT/r['metadataUrl']).read_text());assert metadata['config']==c and metadata['wallpaperVerification']==proof and metadata['independentlyVerified'] is True and metadata['fieldSha256']==digest
  assert c['N']>=24
assert set(g['id'] for g in groups.values() if g['family'] not in ['p4','p6'])==set(r['groupId'] for r in catalog['orbits'])
print(json.dumps({'entries':len(identities),'newShootingEntries':new,'distinctPayloadPaths':len(cache),'allAddedFamiliesAndVariantsPopulated':True,'passed':True}))
