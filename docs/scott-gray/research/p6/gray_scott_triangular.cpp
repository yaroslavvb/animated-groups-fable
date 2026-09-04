#include <vector>
#include <cmath>
// Rhombic coordinates: a=(1,0), b=(-1/2,sqrt(3)/2), spacing h.
// The six equal-length neighbor directions are ±a, ±b and ±(a+b).
extern "C" void flow(const double* initial,double* out,int n,double du,double dv,double F,double k,double h,double T,int steps){
 const int S=n*n,K=2*S;const double dt=T/steps,di=2./(3*h*h);std::vector<double>q(initial,initial+K),tmp(K),a(K),b(K),c(K),d(K);std::vector<int>neighbors(6*S);
 for(int y=0;y<n;y++)for(int x=0;x<n;x++){int p=y*n+x;int xp=(x+1)%n,xm=(x+n-1)%n,yp=(y+1)%n,ym=(y+n-1)%n;neighbors[6*p]=y*n+xp;neighbors[6*p+1]=y*n+xm;neighbors[6*p+2]=yp*n+x;neighbors[6*p+3]=ym*n+x;neighbors[6*p+4]=yp*n+xp;neighbors[6*p+5]=ym*n+xm;}
 auto rhs=[&](const std::vector<double>&z,std::vector<double>&o){for(int p=0;p<S;p++){double U=z[p],V=z[S+p],rx=U*V*V,lu=-6*U,lv=-6*V;for(int j=0;j<6;j++){int r=neighbors[6*p+j];lu+=z[r];lv+=z[S+r];}o[p]=du*di*lu-rx+F*(1-U);o[S+p]=dv*di*lv+rx-(F+k)*V;}};
 for(int s=0;s<steps;s++){rhs(q,a);for(int i=0;i<K;i++)tmp[i]=q[i]+dt*.5*a[i];rhs(tmp,b);for(int i=0;i<K;i++)tmp[i]=q[i]+dt*.5*b[i];rhs(tmp,c);for(int i=0;i<K;i++)tmp[i]=q[i]+dt*c[i];rhs(tmp,d);for(int i=0;i<K;i++)q[i]+=dt*(a[i]+2*b[i]+2*c[i]+d[i])/6.;}
 for(int i=0;i<K;i++)out[i]=q[i];
}
