/** Read the trusted, build-time verified atlas without solving or auditing an orbit.
 * Parameter and pattern summaries are available synchronously. Only the selected
 * field is downloaded, checked against its recorded SHA-256, and decoded.
 * New candidates must still pass solution-atlas.mjs before joining this artifact.
 */
const SCHEMA='scott-gray-precomputed-atlas-v1';
const FAMILIES={
  p4:{ids:['g94','g95','g96','g97','g98','g99'],gate:'recomputed-from-field-v1',divisor:4,label:'442'},
  p6:{ids:['g243','g244','g245','g246','g247','g248'],gate:'recomputed-triangular-field-v1',divisor:6,label:'632'},
};
const HASH=/^[a-f0-9]{64}$/i;
const SHA256_K=new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotate=(value,bits)=>(value>>>bits)|(value<<(32-bits));
function bytesOf(input){
  if(input instanceof Uint8Array)return input;
  if(input instanceof ArrayBuffer)return new Uint8Array(input);
  throw new TypeError('SHA-256 requires an ArrayBuffer or Uint8Array.');
}

/** Portable SHA-256 for ordinary HTTP Tailscale previews without crypto.subtle. */
export function sha256Portable(input){
  const bytes=bytesOf(input),length=bytes.byteLength;
  const padded=new Uint8Array(Math.ceil((length+9)/64)*64);padded.set(bytes);padded[length]=0x80;
  const view=new DataView(padded.buffer),end=padded.byteLength;
  view.setUint32(end-8,Math.floor(length/0x20000000),false);view.setUint32(end-4,(length*8)>>>0,false);
  const state=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const words=new Uint32Array(64);
  for(let block=0;block<end;block+=64){
    for(let i=0;i<16;i++)words[i]=view.getUint32(block+4*i,false);
    for(let i=16;i<64;i++){
      const a=words[i-15],b=words[i-2];
      words[i]=(words[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+words[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))>>>0;
    }
    let [a,b,c,d,e,f,g,h]=state;
    for(let i=0;i<64;i++){
      const t1=(h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+SHA256_K[i]+words[i])>>>0;
      const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    for(const [i,value] of [a,b,c,d,e,f,g,h].entries())state[i]=(state[i]+value)>>>0;
  }
  return Array.from(state,value=>value.toString(16).padStart(8,'0')).join('');
}

export async function sha256(input){
  const bytes=bytesOf(input);
  if(globalThis.crypto?.subtle){
    try{
      const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
      return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
    }catch{/* Restricted browser contexts can expose crypto but reject digest. */}
  }
  return sha256Portable(bytes);
}

function snapshot(value){
  if(Array.isArray(value))return Object.freeze(value.map(snapshot));
  if(value&&typeof value==='object')return Object.freeze(Object.fromEntries(Object.entries(value).map(([key,item])=>[key,snapshot(item)])));
  return value;
}
function sameOps(a,b){return Array.isArray(a)&&a.length===b.length&&a.every((op,i)=>{
  const ref=b[i];return op?.s===ref.s&&op?.tau===ref.tau&&Array.isArray(op.v)&&op.v.length===2&&op.v.every((v,j)=>v===ref.v[j])
    &&Array.isArray(op.M)&&op.M.length===2&&op.M.every((row,j)=>Array.isArray(row)&&row.length===2&&row.every((v,k)=>v===ref.M[j][k]));
});}
function validRange(range){return Array.isArray(range)&&range.length===2&&range.every(Number.isFinite)&&range[1]>range[0];}

/** `manifest` is the checked-in artifact produced by the offline catalog build.
 * Its verification certificate is trusted like application code; this loader
 * checks file integrity, not whether arbitrary imported fields solve the PDE.
 */
export function createPrecomputedCatalog(manifest,{groups,family='p4',fetcher=globalThis.fetch,maxCachedOrbits=3}={}){
  const definition=FAMILIES[family];
  if(!definition||manifest?.schema!==SCHEMA||manifest?.gateVersion!==definition.gate||(manifest.family!==undefined&&manifest.family!==family)||!Array.isArray(manifest.orbits))throw Error('A supported precomputed atlas is required.');
  if(!Array.isArray(groups))throw Error('The canonical groups.json catalog is required.');
  const canonical=new Map(groups.filter(group=>definition.ids.includes(group?.id)&&Array.isArray(group.render?.ops)).map(group=>[group.id,snapshot(group.render.ops)]));
  if(canonical.size!==6)throw Error(`All six canonical ${definition.label} groups are required.`);
  if(typeof fetcher!=='function')throw Error('A field fetcher is required.');
  if(!Number.isInteger(maxCachedOrbits)||maxCachedOrbits<1||maxCachedOrbits>32)throw Error('Cache capacity must be between 1 and 32 orbits.');
  const summaries=new Map(),byGroup=new Map([...canonical.keys()].map(id=>[id,[]]));
  for(const entry of manifest.orbits){
    const config=entry?.config,verification=entry?.offlineVerification;
    if(typeof entry?.id!=='string'||!entry.id||summaries.has(entry.id))throw Error('Every precomputed orbit needs a unique id.');
    if(!canonical.has(entry.groupId)||config?.groupId!==entry.groupId||!sameOps(config.ops,canonical.get(entry.groupId)))throw Error(`Precomputed orbit ${entry.id} does not match its canonical time-symmetry group.`);
    const {N,M,period}=config;
    if(!Number.isInteger(N)||N<definition.divisor||N%definition.divisor||!Number.isInteger(M)||M<definition.divisor||M%definition.divisor||!Number.isFinite(period)||period<=0)throw Error(`Invalid grid or period for ${entry.id}.`);
    if(family==='p6'&&config.params?.stencil!=='triangular-six')throw Error(`A triangular diffusion stencil is required for ${entry.id}.`);
    if(!Number.isFinite(config.params?.F)||!Number.isFinite(config.params?.k))throw Error(`Invalid parameters for ${entry.id}.`);
    if(entry.fieldEncoding!=='float32-le'||entry.fieldValueCount!==2*N*N*M||entry.fieldByteLength!==4*entry.fieldValueCount||typeof entry.fieldUrl!=='string'||!entry.fieldUrl||!HASH.test(entry.fieldSha256))throw Error(`Invalid binary metadata for ${entry.id}.`);
    if(verification?.passed!==true||verification.gateVersion!==definition.gate||verification.fieldSha256!==entry.fieldSha256||entry.diagnostics?.validated!==true)throw Error(`Missing offline verification certificate for ${entry.id}.`);
    if(manifest.visibilityPolicyVersion&&(entry.visibleTimeSymmetry?.version!==manifest.visibilityPolicyVersion||entry.visibleTimeSymmetry.passed!==true))throw Error(`Missing visible time-symmetry certificate for ${entry.id}.`);
    if(!validRange(entry.ranges?.u)||!validRange(entry.ranges?.v))throw Error(`Missing precomputed display ranges for ${entry.id}.`);
    if(['ember','ceramic','concentration'].some(palette=>typeof entry.thumbnails?.[palette]!=='string'||!entry.thumbnails[palette]))throw Error(`Missing precomputed thumbnails for ${entry.id}.`);
    if(Object.hasOwn(entry,'field'))throw Error('Precomputed summaries must not contain concentration fields.');
    const summary=snapshot(entry);summaries.set(entry.id,summary);byGroup.get(entry.groupId).push(summary);
  }
  const all=Object.freeze([...summaries.values()]);
  for(const entries of byGroup.values())Object.freeze(entries);
  const empty=Object.freeze([]),loaded=new Map(),inflight=new Map(),branded=new WeakSet();
  function load(id){
    if(loaded.has(id)){const record=loaded.get(id);loaded.delete(id);loaded.set(id,record);return Promise.resolve(record);}
    if(inflight.has(id))return inflight.get(id);
    const summary=summaries.get(id);
    if(!summary)return Promise.reject(Error('Unknown precomputed orbit.'));
    const request=(async()=>{
      const response=await fetcher(summary.fieldUrl);
      if(!response||response.ok===false||typeof response.arrayBuffer!=='function')throw Error(`Could not download the selected orbit${response?.status?` (HTTP ${response.status})`:''}.`);
      const bytes=await response.arrayBuffer();
      if(!(bytes instanceof ArrayBuffer)||bytes.byteLength!==summary.fieldByteLength)throw Error('The downloaded orbit has the wrong byte count.');
      if(await sha256(bytes)!==summary.fieldSha256.toLowerCase())throw Error('The downloaded orbit failed its SHA-256 integrity check.');
      const view=new DataView(bytes),field=new Array(summary.fieldValueCount);
      for(let i=0;i<field.length;i++){
        field[i]=view.getFloat32(4*i,true);
        if(!Number.isFinite(field[i]))throw Error('The downloaded orbit contains a non-finite concentration.');
      }
      const record=Object.freeze({...summary,atlasId:id,kind:'verified-periodic',field:Object.freeze(field)});
      branded.add(record);loaded.set(id,record);
      // A large gallery must not retain every full movie in mobile memory.
      while(loaded.size>maxCachedOrbits)loaded.delete(loaded.keys().next().value);
      return record;
    })();
    inflight.set(id,request);
    // Delete failures as well as successes so a transient network error can retry.
    request.then(()=>inflight.delete(id),()=>inflight.delete(id));
    return request;
  }
  function nearest(groupId,point,{scales={F:.2,k:.08}}={}){
    if(!canonical.has(groupId)||!Number.isFinite(point?.F)||!Number.isFinite(point?.k)||!Number.isFinite(scales?.F)||scales.F<=0||!Number.isFinite(scales?.k)||scales.k<=0)return null;
    let closest=null,distance=Infinity;
    for(const summary of byGroup.get(groupId)){
      const p=summary.config.params,value=((p.F-point.F)/scales.F)**2+((p.k-point.k)/scales.k)**2;
      if(value<distance){closest=summary;distance=value;}
    }
    return closest;
  }
  return Object.freeze({load,nearest,get:id=>summaries.get(id)||null,
    summaries:groupId=>groupId===undefined?all:byGroup.get(groupId)||empty,
    size:groupId=>groupId===undefined?summaries.size:byGroup.get(groupId)?.length||0,
    isVerified:(record,groupId=record?.config?.groupId)=>branded.has(record)&&record.config.groupId===groupId,
  });
}
