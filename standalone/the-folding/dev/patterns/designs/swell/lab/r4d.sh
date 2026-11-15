#!/bin/bash
# round 4d: the dark share's cap and target; numbers only
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
L=dev/patterns/designs/swell/lab/lab.mjs
for S in 'target=0.57,cap=0.6' 'target=0.57,cap=0.6,open=1.2' 'target=0.57,cap=0.6,kappa=1'; do
  echo "== $S"
  node $L --px 200 --cols 6 --set "$S" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=s.trim().split("\n").filter(l=>l[0]=="{").map(JSON.parse);console.log(r.map(x=>x.id+" "+x.bare+"/"+x.cov).join("  "));console.log("worst bare",Math.max(...r.map(x=>x.bare)),"mean",(r.reduce((a,x)=>a+x.bare,0)/r.length).toFixed(3),"cov",Math.min(...r.map(x=>x.cov)),Math.max(...r.map(x=>x.cov)))})'
done
