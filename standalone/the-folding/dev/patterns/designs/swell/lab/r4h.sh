#!/bin/bash
# round 4h: would another kind of seat leave a smaller bare place in the worst groups? numbers only
cd /Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding || exit 1
L=dev/patterns/designs/swell/lab/lab.mjs
for S in 'hooks=1;1,elbows=1;1' 'hooks=2;2,elbows=2;2' 'hooks=-1;-1,elbows=-1;-1' 'hooks=-2;-2,elbows=-2;-2' 'hooks=-3;-3,elbows=-3;-3' 'chins=1;0.6' 'cornerW=20' 'hollow=0.3'; do
  echo "== $S"
  node $L --ids '*442,*333,*632,2222,**,*2222,4*2' --px 200 --cols 7 --set "$S" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=s.trim().split("\n").filter(l=>l[0]=="{").map(JSON.parse);console.log(r.map(x=>x.id+" "+(x.error?"ERR":x.bare+"/"+x.cov+" h"+x.info.comma.hollow+" r"+x.info.comma.head)).join("  "))})'
done
