/** Direction labels, conjugate selection/share links and actual GPU time direction. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/'),label=process.argv[3]??'local';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const id='equation:brusselator:g139:4edab43428d74fa2';
const ready=()=>page.waitForFunction(()=>document.querySelector('#empty-state').hidden&&!document.querySelector('#play').disabled,null,{timeout:60000});
try{
 await page.goto(`${base}scott-gray/p4g/#g139?v=2&pattern=${encodeURIComponent(id)}&tiles=2&framing=cells&overlay=1&generator=%CE%B1&phase=0.47248749999998996&play=0`);await ready();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1100});
  for(const framing of ['cells','simulation']){
   await page.selectOption('#framing',framing);
   for(const angle of [90,-90]){
    const marker=page.locator(`#generator-overlay .rotation[data-screen-angle="${angle}"]`).filter({visible:true}).first();
    await marker.focus();await marker.press('Enter');
    const expected=angle>0?'90° clockwise':'90° counterclockwise';
    assert.ok((await page.locator('#generator-description').innerText()).includes(expected));
    assert.ok((await page.locator('#operation option:checked').innerText()).includes(expected));
    const key=await marker.getAttribute('data-generator-key');
    assert.equal(new URLSearchParams(page.url().split('?').at(-1)).get('generator'),key);
    const shared=page.url();await page.reload();await ready();
    assert.equal(page.url(),shared);
    assert.equal(await page.locator('#operation').inputValue(),key);
    assert.ok((await page.locator('#generator-description').innerText()).includes(expected));
    const selected=await page.locator('#generator-overlay .rotation.selected').evaluateAll(nodes=>nodes.map(n=>+n.dataset.screenAngle));
    assert.ok(selected.length&&selected.every(value=>value===angle),JSON.stringify(selected));
   }
   await page.locator('.canvas-wrap').screenshot({path:`/tmp/generator-direction-${label}-${width}-${framing}.png`});
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 // Linear operation keys also survive share/reload without becoming the named
 // reference mirror, which can have a different displayed axis or glide.
 const line=page.locator('#generator-overlay .mirror').first();await line.focus();await line.press('Enter');
 const lineKey=await page.locator('#operation').inputValue();assert.ok(lineKey.includes('@op:'));
 await page.reload();await ready();assert.equal(await page.locator('#operation').inputValue(),lineKey);
 // Read actual rendered pixels synchronously after drawing. A point on the
 // right of canonical α moves down in the square camera after +T/4, i.e. CW.
 const pixels=await page.evaluate(async id=>{
  const root=new URL('../',location.href.split('#')[0]);
  const [{createWallpaperPlayer},{makeWallpaperCellView},manifest,metadata]=await Promise.all([
   import(new URL('wallpaper-playback.mjs',root)),import(new URL('wallpaper-cell.mjs',root)),
   fetch(new URL('data/wallpaper-atlas.json',root)).then(r=>r.json()),fetch(new URL('wallpaper-groups.json',root)).then(r=>r.json())]);
  const r=manifest.orbits.find(o=>o.id===id),g=metadata.groups.find(g=>g.id==='g139');
  r.field=new Float32Array(await fetch(new URL(r.fieldUrl,root)).then(r=>r.arrayBuffer()));
  const out=[];
  for(const backend of ['GPU','CPU']){
   const gpu=document.createElement('canvas'),cpu=document.createElement('canvas');gpu.width=gpu.height=cpu.width=cpu.height=512;
   if(backend==='CPU')gpu.getContext=()=>null;
   const player=createWallpaperPlayer(gpu,cpu,r),view=makeWallpaperCellView({lattice:g.lattice,count:2,framing:'simulation',translations:r.translations});
   const frame=phase=>{
    player.draw(phase,{palette:'ember',...view.viewOptions});
    if(backend==='CPU')return cpu.getContext('2d').getImageData(0,0,512,512).data;
    const gl=gpu.getContext('webgl2'),bottomUp=new Uint8Array(512*512*4),image=new Uint8Array(bottomUp.length);
    gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,bottomUp);
    for(let y=0;y<512;y++)image.set(bottomUp.subarray(y*2048,(y+1)*2048),(511-y)*2048);
    return image;
   };
   const a=frame(0),b=frame(.25),op=g.namedGenerators[0];let sum=0,max=0,n=0,wrong=0;
   for(let y=12;y<240;y+=7)for(let x=12;x<240;x+=7){
    const p=view.screenToOriginal([(x+.5)/512,(y+.5)/512]);
    const q=op.M.map((row,i)=>row[0]*p[0]+row[1]*p[1]+op.v[i]);
    const s=view.originalToScreen(q).map(value=>Math.floor(((value%1+1)%1)*512));
    for(let c=0;c<3;c++){const delta=Math.abs(a[(y*512+x)*4+c]-b[(s[1]*512+s[0])*4+c]);sum+=delta;max=Math.max(max,delta);wrong+=Math.abs(a[(y*512+x)*4+c]-b[(y*512+x)*4+c]);n++;}
   }
   out.push({backend:player.backend,meanError:sum/n,maxError:max,untransformedError:wrong/n});player.dispose();
  }
  return out;
 },id);
 for(const r of pixels){assert.ok(r.meanError<1,JSON.stringify(r));assert.ok(r.untransformedError>10,JSON.stringify(r));}
 assert.ok(pixels[0].backend.startsWith('WebGL'));
 console.log(JSON.stringify({renderedQuarterTurn:pixels}));
 // All families use the corrected shared overlay and retain autoplay/defaults.
 const metadata=await (await fetch(base+'scott-gray/wallpaper-groups.json')).json();
 for(const family of metadata.families){
  await page.goto(base+(family.id==='p4'?'scott-gray/':`scott-gray/${family.id}/`));await ready();
  assert.equal(await page.locator('#framing').inputValue(),'simulation');
  await page.check('#show-generators');
  const labels=await page.locator('#generator-overlay .rotation').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
  assert.ok(labels.every(text=>/° (clockwise|counterclockwise|turn)/.test(text)),family.id);
 }
 assert.deepEqual(errors,[]);console.log('Both camera framings and backends, desktop/mobile, exact conjugate/axis URL restoration, all 17 galleries passed.');
}finally{await browser.close();}
