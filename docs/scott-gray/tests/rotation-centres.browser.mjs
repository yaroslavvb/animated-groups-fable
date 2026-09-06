import assert from 'node:assert/strict';
// Run against a server serving docs. PLAYWRIGHT_MODULE may name a local installation.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/'),label=process.argv[3]??'local';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const cases=[{path:'scott-gray/p6/',group:'g248',id:'saved:g248-F0p00404000-k0p02000000-mode1-shell3-N48-M192',count:18}, {path:'scott-gray/',group:'g96',id:'saved:g96-F0p00400000-k0p02000000-N48-M128',count:4}, {path:'scott-gray/',group:'g96',id:'saved:g96-diversity-p4-rotating-oblique-31-f00395-F0p00395000-k0p02000000-L256-N48-M128',count:8}, {path:'scott-gray/p6/',group:'g248',id:'saved:g248-F0p00404000-k0p02000000-mode1-N48-M192',count:6}];
 for(const c of cases){
  const params=new URLSearchParams({v:'2',framing:'simulation',approx:'0',pattern:c.id,palette:'ember',tiles:'2',speed:'1',generator:'α',overlay:'1',phase:'.1296874999999396',play:'0'});
  await page.goto(base+c.path+'#'+c.group+'?'+params);
  await page.waitForFunction(()=>document.querySelector('#empty-state').hidden,{},{timeout:30000});
  assert.equal(await page.locator('.scale-label').innerText(),`Physical width 2 L · ${c.path.includes('/p6/')?'triangular':'square'} lattice`);
  assert.deepEqual(await page.locator('#tiles option').evaluateAll(es=>es.map(e=>[e.value,e.textContent])),[['1','L'],['2','2 L'],['3','3 L']]);
  assert.match(await page.locator('#view-scale-explanation').innerText(),/pattern can repeat several times within L/);
  assert.match(await page.locator('#overlay-explanation').innerText(),new RegExp('^'+c.count+' rotation centres'));
  const keys=await page.locator('#generator-overlay [data-centre-key]').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.centreKey))]);
  assert.equal(keys.length,c.count);
  await page.locator('.canvas-wrap').screenshot({path:'/tmp/overlay-'+label+'-'+c.group+'-desktop.png'});
  const candidates=await page.locator('#generator-overlay [data-centre-key]').evaluateAll(es=>es.map(e=>({key:e.dataset.centreKey,extra:e.classList.contains('extra-centre')})));
  const key=(candidates.find(e=>e.extra&&e.key.startsWith('β'))??candidates.find(e=>e.key.startsWith('γ@0.5,0'))??candidates[0]).key;
  const matches=page.locator(`[data-centre-key="${key}"]`);
  const interior=await matches.evaluateAll(es=>{const box=document.querySelector('.canvas-wrap').getBoundingClientRect();return es.findIndex(e=>{const r=e.getBoundingClientRect();return r.left>box.left+40&&r.right<box.right-40&&r.top>box.top+50&&r.bottom<box.bottom-30;});});
  assert.ok(interior>=0,'an interior marker is available for a pointer click');await matches.nth(interior).click();
  assert.equal(new URLSearchParams(page.url().split('?')[1]).get('generator'),key);
  const errorText=await page.locator('#comparison-error').innerText();
  const residual=Number(errorText.match(/with phase shift ([\d.e+-]+)/)[1]);assert.ok(residual<2e-6,errorText);
  const shared=page.url();await page.reload();await page.waitForFunction(()=>document.querySelector('#empty-state').hidden);
  assert.equal(await page.locator('#operation').inputValue(),key);assert.equal(page.url(),shared);
  const alternative=await page.locator('#solution option').evaluateAll(es=>es.find(e=>e.value!==document.querySelector('#solution').value)?.value);
  if(alternative){await page.selectOption('#solution',alternative);await page.waitForFunction(()=>document.querySelector('#empty-state').hidden);await page.evaluate(hash=>{location.hash=hash;},new URL(shared).hash);await page.waitForFunction(()=>document.querySelector('#empty-state').hidden);assert.equal(await page.locator('#operation').inputValue(),key,'hash navigation between patterns preserves the selected centre');}
  await page.setViewportSize({width:390,height:844});
  await page.locator('.canvas-wrap').screenshot({path:'/tmp/overlay-'+label+'-'+c.group+'-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#show-generators').uncheck();assert.equal(await page.locator('#generator-overlay').isVisible(),false);
  console.log(JSON.stringify({group:c.group,centres:keys.length,selected:key,phaseResidual:residual,share:'passed',mobile:'passed'}));
  await page.setViewportSize({width:1440,height:1200});
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
