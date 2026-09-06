"""Extract the 68 forward time-translation actions used by the correspondence.

Coordinates in render.ops are fractional lattice coordinates. For the numerical
search we choose unit square or unit 120-degree triangular cells, which all the
corresponding integer matrices preserve. This changes the arbitrary illustration
metric for the oblique/rectangular families, not their abstract affine actions.
"""
from pathlib import Path
import json, math, re, hashlib
from fractions import Fraction

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'data/clockwork-coloring-correspondence.json'
DESTINATION = ROOT / 'scott-gray/wallpaper-groups.json'
ORDER = ['p1','p2','pm','pg','cm','pmm','pmg','pgg','cmm','p4','p4m','p4g','p3','p3m1','p31m','p6','p6m']
TRIANGULAR = set(ORDER[-5:])
SHAPES = dict(zip(ORDER, ['oblique','oblique','rectangular','rectangular','centered-rectangular','rectangular','rectangular','rectangular','centered-rectangular','square','square','square','triangular','triangular','triangular','triangular','triangular']))

def multiply(A, B):
    return [[sum(A[i][k]*B[k][j] for k in range(2)) for j in range(2)] for i in range(2)]

def apply(A, p):
    return [sum(A[i][j]*p[j] for j in range(2)) for i in range(2)]

def inverse(A):
    d=A[0][0]*A[1][1]-A[0][1]*A[1][0]
    return [[A[1][1]/d,-A[0][1]/d],[-A[1][0]/d,A[0][0]/d]]

def marker_for(op, basis):
    B=[[basis[0][0],basis[1][0]],[basis[0][1],basis[1][1]]]
    A=multiply(multiply(B,op['M']),inverse(B)); w=apply(B,op['v'])
    det=round(A[0][0]*A[1][1]-A[0][1]*A[1][0])
    if op['M']==[[1,0],[0,1]]:
        return {'kind':'translation','vector':op['v'],'physicalVector':w}
    if det==1:
        C=[[1-op['M'][0][0],-op['M'][0][1]],[-op['M'][1][0],1-op['M'][1][1]]]
        angle=math.degrees(math.atan2(A[1][0],A[0][0]))%360
        centre=apply(inverse(C),op['v'])
        return {'kind':'rotation','centre':centre,'angleDegrees':round(angle,9),'order':round(360/min(angle,360-angle))}
    # Reflection/glide axis: fixed line of the reflection part, shifted by half
    # the normal component of the affine translation. No inversion of I-A.
    d=[A[0][1],1-A[0][0]]
    if math.hypot(*d)<1e-9: d=[1-A[1][1],A[1][0]]
    scale=math.hypot(*d); d=[a/scale for a in d]
    if d[0]<-1e-9 or (abs(d[0])<1e-9 and d[1]<0): d=[-a for a in d]
    glide=sum(a*b for a,b in zip(d,w))
    p=[(w[i]-glide*d[i])/2 for i in range(2)]
    return {'kind':'mirror' if abs(glide)<1e-9 else 'glide','axisPoint':apply(inverse(B),p),'axisDirection':apply(inverse(B),d),'physicalAxisDirection':d,'glideVector':apply(inverse(B),[glide*a for a in d])}

def build():
    raw=SOURCE.read_bytes(); source=json.loads(raw); by_id={g['id']:g for g in source['groups']}
    families=[]; groups=[]
    for family in ORDER:
        html=(ROOT/f'correspondence-{family}.html').read_text()
        ids=re.findall(r'data-panel-id="(g\d+)"',html)
        expected={g['id'] for g in source['groups'] if g['parent']['hm']==family}
        assert set(ids)==expected and len(ids)==len(expected), family
        basis=[[1,0],[-.5,math.sqrt(3)/2]] if family in TRIANGULAR else [[1,0],[0,1]]
        lattice='triangular' if family in TRIANGULAR else 'square'
        orbifold=by_id[ids[0]]['parent']['orbifold']
        families.append({'id':family,'orbifold':orbifold,'latticeShape':SHAPES[family],'lattice':lattice,'basis':basis,'groupIds':ids,'image':f'img/mathworld/{family}.webp','page':f'scott-gray/{family}/' if family!='p4' else 'scott-gray/'})
        for gid in ids:
            g=by_id[gid]; generators=[]
            for named in g['chaim_presentation']['generators']:
                original=g['render']['ops'][named['plate_source_index']]
                op={**original,'v':[original['v'][i]+named['plate_lattice_shift'][i] for i in range(2)]}
                assert abs(op['tau']-float(Fraction(named['time_shift'])))<1e-8,(gid,named)
                marker=marker_for(op,basis)
                generators.append({'name':named['generator'],'kind':marker['kind'],**op,'timeShift':named['time_shift'],'marker':marker})
            denominators=[Fraction(a).limit_denominator(24).denominator for op in g['render']['ops'] for a in op['v']]
            mesh=math.lcm(*denominators)
            groups.append({'id':gid,'family':family,'orbifold':orbifold,'signature':g['book_color_signature'],'phaseOrder':g['clock_order'],'hasTimeShift':g['clock_order']>1,'lattice':lattice,'basis':basis,'ops':g['render']['ops'],'namedGenerators':generators,'meshMultiple':mesh,'frameMultiple':g['clock_order'],'reference':f'../correspondence-{family}.html#{gid}','feasibility':{'status':'not-obstructed-by-time-action' if g['clock_order']>1 else 'zero-offset-reference','reason':'Every operation advances time by a constant offset; spatial reflections do not reverse time.' if g['clock_order']>1 else 'This catalog entry assigns zero offset to every spatial operation. It has no nonzero time-shift generator to demonstrate.'}})
    return {'schema':'scott-gray-wallpaper-groups-v1','sourceSha256':hashlib.sha256(raw).hexdigest(),'convention':'q(Mx + v, t + tau T) = q(x,t); x is measured in the listed lattice basis; full lattice translations have zero phase.','scope':'The 68 forward time-translation actions in the correspondence catalog, including 17 zero-offset spatial reference actions. This finite classification is not an enumeration of every possible phase character on an arbitrary fixed wallpaper lattice.','latticeChoice':'The search uses square representatives for oblique and rectangular families and a unit 120-degree basis for triangular families; every listed M is an isometry of its chosen basis.','families':families,'groups':groups,'timeReversalExclusion':{'assumptions':'Autonomous Gray–Scott equations with spatially uniform coefficients, ordinary spatial isometries, and unchanged concentration channels.','statement':'An exact constraint q(gx,-t+c)=q(x,t) forces a classical solution to be stationary.','proof':'Spatial equivariance gives F(g*q)=g*F(q). Differentiating the time-reflection constraint gives -g*q_t(-t+c)=q_t(t), whereas the equation and the constraint give g*q_t(-t+c)=q_t(t). Therefore q_t=0.','appliesToListedGroups':False}}

if __name__=='__main__':
    result=build(); DESTINATION.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(f"Wrote {len(result['groups'])} actions in {len(result['families'])} families to {DESTINATION}")
