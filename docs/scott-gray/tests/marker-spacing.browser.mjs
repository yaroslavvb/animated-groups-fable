/** Regression for the reported g245 cell view and responsive marker sizing. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/'),label=process.argv[3]??'local';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1150}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const ready=()=>page.waitForFunction(()=>document.querySelector('#empty-state').hidden&&!document.querySelector('#play').disabled,null,{timeout:60000});
const id='wallpaper:g245:c74b45b07d722c40';
async function inspect(){
 await page.waitForFunction(()=>{
  const svg=document.getElementById('generator-overlay'),circle=svg.querySelector('.rotation circle');
  return circle&&circle.getBoundingClientRect().width<=28.001;
 });
 const result=await page.evaluate(()=>{
  const markers=[...document.querySelectorAll('#generator-overlay .rotation')];
  const points=markers.map(g=>{
   const circle=g.querySelector('circle'),box=circle.getBoundingClientRect(),art=g.getBoundingClientRect();
   return {x:box.x+box.width/2,y:box.y+box.height/2,r:box.width/2,box:{left:art.left,right:art.right,top:art.top,bottom:art.bottom}};
  });
  let maxRatio=0,overlaps=0;
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++){
   const a=points[i],b=points[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
   maxRatio=Math.max(maxRatio,(a.r+b.r)/distance);
   if(Math.min(a.box.right,b.box.right)>Math.max(a.box.left,b.box.left)+.1&&Math.min(a.box.bottom,b.box.bottom)>Math.max(a.box.top,b.box.top)+.1)overlaps++;
  }
  return {count:points.length,maxRadius:Math.max(...points.map(p=>p.r)),maxRatio,overlaps,framing:document.getElementById('framing').value,tiles:document.getElementById('tiles').value,pattern:document.getElementById('solution').value,phase:document.getElementById('phase').value,svgWidth:document.getElementById('generator-overlay').getBoundingClientRect().width};
 });
 assert.ok(result.count>0);assert.ok(result.maxRadius<=14.001,JSON.stringify(result));
 assert.ok(result.maxRatio<=.401,JSON.stringify(result));assert.equal(result.overlaps,0,JSON.stringify(result));
 assert.equal(result.pattern,id);assert.equal(result.phase,'0.275');
 return result;
}
try{
 await page.goto(base+'scott-gray/p6/#g245?v=2&pattern='+encodeURIComponent(id)+'&palette=ember&tiles=2&framing=cells&speed=1&generator=%CE%B1&overlay=1&approx=0&phase=0.275&play=0');await ready();
 assert.equal(await page.locator('#framing').inputValue(),'cells','explicit shared view is preserved');
 for(const viewport of [{width:1440,height:1150},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const framing of ['cells','simulation'])for(const tiles of ['1','2','3']){
   await page.selectOption('#framing',framing);await page.selectOption('#tiles',tiles);
   const result=await inspect();
   assert.equal(result.framing,framing);assert.equal(result.tiles,tiles);
   if(tiles==='2')await page.locator('.canvas-wrap').screenshot({path:`/tmp/marker-spacing-${label}-${viewport.width}-${framing}.png`});
   console.log(JSON.stringify({viewport:viewport.width,...result}));
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no mobile overflow');
 }
 // Resizing alone must update the CSS-pixel cap, without a control change or
 // rewriting the user's saved view. Also exercise a wide presentation canvas.
 await page.selectOption('#framing','cells');await page.selectOption('#tiles','1');await inspect();
 const beforeResize=page.url();await page.setViewportSize({width:1920,height:1300});await inspect();
 assert.equal(page.url(),beforeResize);
 const wide=await page.addStyleTag({content:'main{max-width:none!important}.lab{display:block!important}.viewer{width:100%!important}'});
 const wideResult=await inspect();assert.ok(wideResult.svgWidth>1000,JSON.stringify(wideResult));
 assert.equal(page.url(),beforeResize);await wide.evaluate(element=>element.remove());
 // Default applies to every family. Explicit URLs above keep their cell view.
 const metadata=await (await fetch(base+'scott-gray/wallpaper-groups.json')).json();
 for(const family of metadata.families){
  const path=family.id==='p4'?'scott-gray/':`scott-gray/${family.id}/`;
  await page.goto(base+path);await ready();
  assert.equal(await page.locator('#framing').inputValue(),'simulation',family.id);
  assert.equal(await page.locator('#tiles option:checked').innerText(),'2 L',family.id);
  assert.equal(await page.locator('#show-generators').isChecked(),false, family.id);
 }
 assert.deepEqual(errors,[]);console.log('All 17 default views: Simulation width, 2 L, generators hidden.');
}finally{await browser.close();}
