from core import *
from norm import *
import json
data,by_id=load()
REF={'p1':'g1','p2':'g5','pm':'g10','pg':'g11','cm':'g8','pmm':'g54','pmg':'g56','pgg':'g58','cmm':'g68','p4':'g94','p4m':'g128','p4g':'g132','p3':'g224','p3m1':'g230','p31m':'g232','p6':'g243','p6m':'g268'}
ORB={'p1':'o','p2':'2222','pm':'**','pg':'xx','cm':'*x','pmm':'*2222','pmg':'22*','pgg':'22x','cmm':'2*22','p4':'442','p4m':'*442','p4g':'4*2','p3':'333','p3m1':'*333','p31m':'3*3','p6':'632','p6m':'*632'}
NS=(2,3,4,5,6,7,8,12)
def build(fam):
    e=by_id[REF[fam]]
    return Film(e['ops'],gens=e['namedGenerators'],with_time=False,name=fam)
if __name__=='__main__':
    res={}
    print('%-5s %-6s %-12s'%('fam','orb','ab') + ''.join('%10s'%('n=%d'%n) for n in NS))
    tot={n:0 for n in NS}; totp={n:0 for n in NS}
    for fam in REF:
        W=build(fam)
        Aall=normaliser(W,denom=12,bound=3)
        Apro=normaliser(W,denom=12,bound=3,proper_only=True)
        ab=[]
        row=[];rowp=[]
        for n in NS:
            h=W.homs(n); onto=[p for p in h if W.image_order(p,n)==n]
            ob=orbits(W,onto,n,Aall); obp=orbits(W,onto,n,Apro)
            row.append((len(onto),len(ob))); rowp.append(len(obp))
            tot[n]+=len(ob); totp[n]+=len(obp)
        res[fam]={'surj':{n:row[i][0] for i,n in enumerate(NS)},
                  'types':{n:row[i][1] for i,n in enumerate(NS)},
                  'types_proper':{n:rowp[i] for i,n in enumerate(NS)}}
        print('%-5s %-6s %-12s'%(fam,ORB[fam],'') + ''.join('%10s'%('%d/%d'%(a,b)) for a,b in row) + '  proper:'+','.join(str(x) for x in rowp))
    print('%-25s'%'TOTAL(surj/types)'+''.join('%10s'%tot[n] for n in NS))
    print('%-25s'%'TOTAL proper-only'+''.join('%10s'%totp[n] for n in NS))
    json.dump(res,open('wp_counts.json','w'),indent=1)
