#include <vector>
#include <cmath>
extern "C" void flow(const double* initial,double* out,int n,double du,double dv,double F,double k,double dx,double T,int steps){
 const int S=n*n,K=2*S;const double dt=T/steps,di=1/(dx*dx);std::vector<double>q(initial,initial+K),tmp(K),a(K),b(K),c(K),d(K);std::vector<int>l(S),r(S),u(S),v(S);
 for(int y=0;y<n;y++)for(int x=0;x<n;x++){int p=y*n+x;l[p]=y*n+(x+n-1)%n;r[p]=y*n+(x+1)%n;u[p]=(y+n-1)%n*n+x;v[p]=(y+1)%n*n+x;}
 auto rhs=[&](const std::vector<double>&z,std::vector<double>&o){for(int p=0;p<S;p++){double U=z[p],V=z[S+p],rx=U*V*V;o[p]=du*di*(z[l[p]]+z[r[p]]+z[u[p]]+z[v[p]]-4*U)-rx+F*(1-U);o[S+p]=dv*di*(z[S+l[p]]+z[S+r[p]]+z[S+u[p]]+z[S+v[p]]-4*V)+rx-(F+k)*V;}};
 for(int s=0;s<steps;s++){rhs(q,a);for(int i=0;i<K;i++)tmp[i]=q[i]+dt*.5*a[i];rhs(tmp,b);for(int i=0;i<K;i++)tmp[i]=q[i]+dt*.5*b[i];rhs(tmp,c);for(int i=0;i<K;i++)tmp[i]=q[i]+dt*c[i];rhs(tmp,d);for(int i=0;i<K;i++)q[i]+=dt*(a[i]+2*b[i]+2*c[i]+d[i])/6.;}
 for(int i=0;i<K;i++)out[i]=q[i];
}
