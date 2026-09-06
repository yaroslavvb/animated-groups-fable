/** Load the offline wallpaper atlas. Certificates are build artifacts, not
 * browser proofs; selected concentration bytes are checked against their hash.
 */
import {downloadOrbitBytes} from './precomputed-catalog.mjs?v=20260905-gallery-fix';
const HASH=/^[a-f0-9]{64}$/i,SCHEMA='scott-gray-wallpaper-atlas-v1',GATE='wallpaper-offline-v1';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const opsEqual=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((op,i)=>equal(op.M,b[i].M)&&equal(op.v,b[i].v)&&op.s===b[i].s&&Math.abs(op.tau-b[i].tau)<1e-12);
const freeze=o=>{if(o&&typeof o==='object'){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
const range=a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[1]>a[0];
export function createWallpaperCatalog(manifest,{groups,baseUrl=new URL('./',import.meta.url),fetcher=globalThis.fetch,maxCachedOrbits=2}={}){
 if(manifest?.schema!==SCHEMA||manifest.gateVersion!==GATE||!Array.isArray(manifest.orbits))throw Error('Unsupported wallpaper atlas.');
 if(!Array.isArray(groups))throw Error('Canonical wallpaper groups required.');
 if(typeof fetcher!=='function')throw Error('A field fetcher is required.');
 if(!Number.isInteger(maxCachedOrbits)||maxCachedOrbits<1||maxCachedOrbits>32)throw Error('Invalid cache capacity.');
 const canonical=new Map(groups.map(g=>[g.id,g])),byGroup=new Map(groups.map(g=>[g.id,[]])),entries=new Map(),loaded=new Map(),inflight=new Map(),branded=new WeakSet();
 for(const source of manifest.orbits){
  const entry=structuredClone(source),g=canonical.get(entry.groupId),c=entry.config,v=entry.offlineVerification,w=entry.wallpaperVerification;
  if(!g||c?.groupId!==g.id||!opsEqual(c.ops,g.ops))throw Error(`Orbit ${entry.id} does not match its time-shift group.`);
  if(typeof entry.id!=='string'||!entry.id||entries.has(entry.id))throw Error('Orbit ids must be unique.');
  if(!Number.isInteger(c.N)||c.N<4||c.N%g.meshMultiple||!Number.isInteger(c.M)||c.M<8||c.M%g.frameMultiple||!Number.isFinite(c.period)||c.period<=0)throw Error('Incompatible orbit dimensions.');
  if(g.lattice==='triangular'&&c.params.stencil!=='triangular-six'||g.lattice==='square'&&!['five-point','bulatov9'].includes(c.params.stencil))throw Error('Orbit metric and diffusion stencil differ.');
  if(![c.L,c.params.F,c.params.k,c.params.Du,c.params.Dv,c.params.dx].every(Number.isFinite)||c.L<=0||c.params.Du<=0||c.params.Dv<=0)throw Error('Invalid saved parameters.');
  if(entry.fieldEncoding!=='float32-le'||!HASH.test(entry.fieldSha256)||entry.fieldValueCount!==2*c.N*c.N*c.M||entry.fieldByteLength!==4*entry.fieldValueCount||typeof entry.fieldUrl!=='string')throw Error('Invalid field metadata.');
  if(v?.passed!==true||v.gateVersion!==GATE||v.fieldSha256!==entry.fieldSha256||w?.passed!==true||w.phaseRelations?.passed!==true||w.independentDynamics?.passed!==true||w.temporalResolution?.passed!==true||w.forwardTargetPhaseBounds?.passed!==true||g.hasTimeShift&&w.visibility?.passed!==true)throw Error(`Missing offline verification for ${entry.id}.`);
  if(!range(entry.ranges?.u)||!range(entry.ranges?.v))throw Error('Missing concentration ranges.');
  for(const name of ['ember','ceramic','concentration'])if(typeof entry.thumbnails?.[name]!=='string')throw Error('Missing pattern thumbnail.');
  const tv=entry.translationVerification;
  if(!Array.isArray(entry.translations)||!entry.translations.length||tv?.passed!==true||tv.fieldSha256!==entry.fieldSha256||tv.N!==c.N||!Number.isFinite(tv.maximumAbsoluteError)||tv.maximumAbsoluteError>1e-7||!Number.isFinite(tv.maximumRelativeRms)||tv.maximumRelativeRms>1e-6)throw Error('Missing checked repeat-cell geometry.');
  for(const t of entry.translations)if(!Array.isArray(t.v)||t.v.length!==2||!t.v.every(x=>Number.isFinite(x)&&x>=0&&x<1&&Math.abs(x*c.N-Math.round(x*c.N))<1e-7)||!Number.isFinite(t.max)||t.max>1e-7||!Number.isFinite(t.relativeRms)||t.relativeRms>1e-6)throw Error('Invalid repeat-cell translation.');
  if('field' in entry)throw Error('Manifest must not contain movie samples.');
  entry.fieldUrl=new URL(entry.fieldUrl,baseUrl).href;
  if(entry.metadataUrl)entry.metadataUrl=new URL(entry.metadataUrl,baseUrl).href;
  for(const name of Object.keys(entry.thumbnails))entry.thumbnails[name]=new URL(entry.thumbnails[name],baseUrl).href;
  freeze(entry);entries.set(entry.id,entry);byGroup.get(g.id).push(entry);
 }
 for(const list of byGroup.values())Object.freeze(list);
 const all=Object.freeze([...entries.values()]);
 const load=id=>{
  if(loaded.has(id)){const r=loaded.get(id);loaded.delete(id);loaded.set(id,r);return Promise.resolve(r);}
  if(inflight.has(id))return inflight.get(id);
  const summary=entries.get(id);if(!summary)return Promise.reject(Error('Unknown saved orbit.'));
  const promise=(async()=>{const bytes=await downloadOrbitBytes(summary.fieldUrl,{fetcher,byteLength:summary.fieldByteLength,fieldSha256:summary.fieldSha256});const view=new DataView(bytes),field=new Float32Array(summary.fieldValueCount);for(let i=0;i<field.length;i++){field[i]=view.getFloat32(i*4,true);if(!Number.isFinite(field[i]))throw Error('Invalid concentration data.');}const record=Object.freeze({...summary,field,kind:'verified-periodic'});branded.add(record);loaded.set(id,record);while(loaded.size>maxCachedOrbits)loaded.delete(loaded.keys().next().value);return record;})();inflight.set(id,promise);promise.then(()=>inflight.delete(id),()=>inflight.delete(id));return promise;
 };
 return Object.freeze({load,get:id=>entries.get(id)??null,summaries:id=>id===undefined?all:byGroup.get(id)??[],size:id=>id===undefined?all.length:byGroup.get(id)?.length??0,isVerified:(record,id=record?.groupId)=>branded.has(record)&&record.groupId===id});
}
