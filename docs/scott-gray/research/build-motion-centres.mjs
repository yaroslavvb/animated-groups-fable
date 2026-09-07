/** Export the viewer's complete rotation-centre geometry for offline motion measurement.
 * node docs/scott-gray/research/build-motion-centres.mjs /tmp/scott-gray-motion-centres.json
 */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {wallpaperGeneratorPlacements} from '../wallpaper-overlay.mjs';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root)));
const metadata=await read('wallpaper-groups.json'),groups=new Map(metadata.groups.map(g=>[g.id,g]));
const sources=['data/precomputed-atlas.json','p6/data/precomputed-atlas.json','data/wallpaper-atlas.json','data/equation-atlas.json'];
const records=new Map(),cache=new Map(),wrap=x=>Number((((x%1+1)%1)%1).toFixed(9))%1;
const view={originalCorners:[[0,0],[1,0],[1,1],[0,1]],originalToScreen:p=>p,contains:p=>p.every(x=>x>=-1e-8&&x<=1+1e-8),latticeBounds:{min:[0,0],max:[1,1]}};
for(const source of sources)for(const record of (await read(source)).orbits){
 if(records.has(record.id))continue;
 const group=groups.get(record.groupId),key=JSON.stringify([group.id,record.translations]);
 if(!cache.has(key)){
  const points=new Map();
  for(const p of wallpaperGeneratorPlacements(group,{cellView:view,translations:record.translations??[]}))if(p.kind==='rotation'){
   const point=p.point.map(wrap);points.set(point.join(','),point);
  }
  const B=group.basis??[[1,0],[0,1]],physical=p=>[B[0][0]*p[0]+B[1][0]*p[1],B[0][1]*p[0]+B[1][1]*p[1]];
  cache.set(key,[...points.values()].map(point=>{
   let nearest=Infinity;
   for(const other of points.values())for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
    const d=Math.hypot(...physical([other[0]+i-point[0],other[1]+j-point[1]]));if(d>1e-7)nearest=Math.min(nearest,d);
   }
   return {point,nearestDistance:nearest};
  }));
 }
 const c=record.config;
 records.set(record.id,{id:record.id,groupId:group.id,lattice:group.lattice,N:c.N,M:c.M,fieldSha256:record.fieldSha256,fieldPath:fileURLToPath(new URL(record.fieldUrl,new URL(source==='p6/data/precomputed-atlas.json'?'p6/':'./',root))),centres:cache.get(key)});
}
const output=process.argv[2]??'/tmp/scott-gray-motion-centres.json';
await writeFile(output,JSON.stringify({schema:'wallpaper-motion-centres-v1',records:[...records.values()]})+'\n');
console.log(JSON.stringify({output,records:records.size,geometries:cache.size,centres:[...records.values()].reduce((n,r)=>n+r.centres.length,0)}));
