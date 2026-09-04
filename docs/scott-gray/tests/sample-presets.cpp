// Native reference screen: periodic domain, explicit midpoint, planar U/V.
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <vector>
int main(int argc,char**argv){
 if(argc!=9)return 2;
 const int n=std::atoi(argv[1]),nn=n*n;const double L=std::atof(argv[2]),F=std::atof(argv[3]),k=std::atof(argv[4]),dt=std::atof(argv[5]),horizon=std::atof(argv[6]);
 std::vector<float>a(2*nn),mid(2*nn),b(2*nn);std::ifstream input(argv[7],std::ios::binary);input.read((char*)a.data(),a.size()*sizeof(float));if(!input)return 3;
 const double inv=1/((L/n)*(L/n));
 auto rhs=[&](const std::vector<float>&s,std::vector<float>&out){
  for(int y=0;y<n;y++)for(int x=0;x<n;x++){
   int i=y*n+x,xm=(x+n-1)%n,xp=(x+1)%n,ym=(y+n-1)%n*n,yp=(y+1)%n*n;
   double u=s[i],v=s[nn+i],react=u*v*v;
   for(int c=0;c<2;c++){int j=c*nn;double center=s[j+i];double lap=.8*(s[j+y*n+xm]+s[j+y*n+xp]+s[j+ym+x]+s[j+yp+x])+.2*(s[j+ym+xm]+s[j+ym+xp]+s[j+yp+xm]+s[j+yp+xp])-4*center;
    out[j+i]=(c==0?.2097*inv*lap-react+F*(1-u):.105*inv*lap+react-(F+k)*v);
   }
  }
 };
 const int steps=std::lround(horizon/dt),sampleStride=std::lround(50/dt),window=std::lround(200/dt);
 std::vector<std::vector<float>>frames;
 bool finite=true;
 for(int t=0;t<steps;t++){
  rhs(a,b);for(int i=0;i<2*nn;i++)mid[i]=a[i]+.5*dt*b[i];rhs(mid,b);for(int i=0;i<2*nn;i++){a[i]+=dt*b[i];if(!std::isfinite(a[i]))finite=false;}
  if(!finite)break;
  if((t+1)>=steps-window&&(t+1)%sampleStride==0)frames.push_back(a);
 }
 if(!finite){std::cout<<"{\"finite\":false,\"spatialRms\":0,\"temporalRms\":0}";return 0;}
 double spatial=0,temporal=0,lo=10,hi=-10;
 for(const auto&s:frames)for(int c=0;c<2;c++){double mean=0;for(int i=0;i<nn;i++)mean+=s[c*nn+i]/nn;for(int i=0;i<nn;i++){double v=s[c*nn+i];spatial+=(v-mean)*(v-mean);lo=std::min(lo,v);hi=std::max(hi,v);}}
 for(int i=0;i<2*nn;i++){double mean=0;for(const auto&s:frames)mean+=s[i]/frames.size();for(const auto&s:frames)temporal+=(s[i]-mean)*(s[i]-mean);}
 std::ofstream output(argv[8],std::ios::binary);output.write((const char*)a.data(),a.size()*sizeof(float));
 std::cout<<std::setprecision(10)<<"{\"finite\":true,\"spatialRms\":"<<std::sqrt(spatial/(2*nn*frames.size()))<<",\"temporalRms\":"<<std::sqrt(temporal/(2*nn*frames.size()))<<",\"minimum\":"<<lo<<",\"maximum\":"<<hi<<",\"samples\":"<<frames.size()<<"}";
}
