// Each lane updates both Gray–Scott species at one lattice site. All boundary
// reads wrap within the same trajectory. FP64 and no fast-math are intentional.
extern "C" __global__ void rk4_stage(
 const double* base, const double* cur, double* acc, double* out,
 const double* parameters, const int n, const int batch, const int stage) {
 const int S=n*n, lane=blockDim.x*blockIdx.x+threadIdx.x;
 if(lane>=batch*S)return;
 const int b=lane/S, p=lane%S, x=p%n, y=p/n, o=b*2*S, u=o+p, v=u+S;
 const int l=y*n+(x+n-1)%n, r=y*n+(x+1)%n;
 const int up=(y+n-1)%n*n+x, down=(y+1)%n*n+x;
 const double du=parameters[6*b],dv=parameters[6*b+1],F=parameters[6*b+2];
 const double k=parameters[6*b+3],dx=parameters[6*b+4],dt=parameters[6*b+5];
 const double U=cur[u],V=cur[v],rx=U*V*V,di=1.0/(dx*dx);
 const double a=du*di*(cur[o+l]+cur[o+r]+cur[o+up]+cur[o+down]-4*U)-rx+F*(1-U);
 const double c=dv*di*(cur[o+S+l]+cur[o+S+r]+cur[o+S+up]+cur[o+S+down]-4*V)+rx-(F+k)*V;
 if(stage==1){acc[u]=a;acc[v]=c;out[u]=base[u]+.5*dt*a;out[v]=base[v]+.5*dt*c;}
 else if(stage==2){acc[u]+=2*a;acc[v]+=2*c;out[u]=base[u]+.5*dt*a;out[v]=base[v]+.5*dt*c;}
 else if(stage==3){acc[u]+=2*a;acc[v]+=2*c;out[u]=base[u]+dt*a;out[v]=base[v]+dt*c;}
 else{out[u]=base[u]+dt*(acc[u]+a)/6.;out[v]=base[v]+dt*(acc[v]+c)/6.;}
}
