import json,numpy as np
from pathlib import Path
import sys
from scipy.integrate import solve_ivp
from scipy.optimize import root
p=json.loads(Path(__file__).with_name('oscillator.json').read_text());f=p['feed'];k=p['kill'];u0=p['initial'][0]
def rhs(t,z):
 u,v=z; q=u*v*v;return [-q+f*(1-u),q-(f+k)*v]
def shoot(a,dense=False):
 v0,T=a; ini=[u0,v0]
 sol=solve_ivp(rhs,[0,T],ini,method='DOP853',rtol=2e-13,atol=2e-15,dense_output=dense,max_step=2)
 return sol if dense else sol.y[:,-1]-ini
fit=root(shoot,[p['initial'][1],p['period']],tol=1e-10)
v0,T=fit.x;sol=shoot([v0,T],True);ts=np.linspace(0,T,257);zz=sol.sol(ts)
ini=np.array([u0,v0]); check=solve_ivp(rhs,[0,2*T],ini,method='DOP853',rtol=3e-14,atol=3e-16,max_step=.5,dense_output=True)
err=np.max(np.abs(check.sol(np.linspace(0,T,121)+T)-check.sol(np.linspace(0,T,121))))
out={"feed":f,"kill":k,"period":float(T),"initial":ini.tolist(),"closureMax":float(np.max(np.abs(shoot([v0,T])))),"independentTwoCycleMax":float(err),"temporalRange":np.ptp(zz,axis=1).tolist(),"stationary":False,"spatiallyUniform":True,"group":"g94","description":"Homogeneous periodic Gray–Scott oscillator; extra spatial symmetry; verification fixture, not glider.","frames":zz.T.tolist(),"times":ts.tolist()}
Path(sys.argv[1] if len(sys.argv)>1 else 'oscillator-reproduced.json').write_text(json.dumps(out,indent=2));print(json.dumps({key:value for key,value in out.items() if key not in ['frames','times']},indent=2));print('fit',fit.success,fit.message)
