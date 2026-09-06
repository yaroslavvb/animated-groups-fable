// Regression: an unversioned cached cell-ui still references the removed
// comparison canvases. A release must never mix it with the current HTML.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/');
const artifacts='/tmp/scott-gray-gallery-recovery';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const ready=page=>page.waitForFunction(()=>document.querySelector('#empty-state').hidden&&!document.querySelector('#play').disabled,null,{timeout:45000});
try{
 for(const [family,path,initial,next,selector] of [
  ['p4','scott-gray/','g95','g96','data-id'],
  ['p6','scott-gray/p6/','g247','g248','data-id'],
  ['p2','scott-gray/p2/','g6','g5','data-group-id'],
 ]){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  const errors=[],cellRequests=[];let staleRequests=0,fieldRequests=0;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.url().includes('/cell-ui.mjs'))cellRequests.push(request.url());});
  await page.route('**/cell-ui.mjs',route=>{
   staleRequests++;
   return route.fulfill({status:200,contentType:'text/javascript',body:`export function updateCellFraming(){for(const id of ['pattern','gpu-pattern','compare-original','compare-a','compare-b'])document.getElementById(id).style.clipPath='';}`});
  });
  // Both automatic attempts fail. A manual retry then succeeds using the same
  // requested pattern/playback state, without changing its parameters.
  await page.route('**/*.f32',route=>++fieldRequests<=2?route.fulfill({status:503,body:'Temporary test outage'}):route.continue());
  await page.goto(base+path+`#${initial}?v=2&phase=0.2&play=1&overlay=1`);
  await page.waitForFunction(()=>!document.querySelector('#retry-animation').hidden,null,{timeout:45000});
  assert.equal(staleRequests,0,'release must bypass the old cached cell-layout module');
  if(family!=='p2')assert.ok(cellRequests.some(url=>new URL(url).searchParams.has('v')));
  assert.equal(fieldRequests,2,'automatic recovery is bounded to one retry');
  assert.match(await page.locator('#empty-description').innerText(),/503/,'show the concrete failure next to Retry');
  const failedId=await page.locator('#solution').inputValue();
  await page.locator('.canvas-wrap').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${artifacts}/${family}-retry-mobile.png`});
  await page.locator('#retry-animation').click();await ready(page);
  assert.equal(fieldRequests,3);
  assert.equal(await page.locator('#solution').inputValue(),failedId,'retry keeps the same animation');
  assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause animation');
  assert.ok(Number(await page.locator('#phase').inputValue())>=.2,'retry preserves requested phase');
  await page.locator(`#groups [${selector}="${next}"]`).click();await ready(page);
  assert.equal(new URL(page.url()).hash.split('?')[0],'#'+next);
  const count=await page.locator(`#groups [${selector}="${next}"] ${family==='p2'?'span':'.orbit-count'}`).innerText();
  assert.ok((await page.locator('#solution-count').innerText()).endsWith(count),'count belongs to the selected group');
  await page.locator('.canvas-wrap').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${artifacts}/${family}-playing-mobile.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({family,staleCache:'bypassed',automaticRetries:1,manualRetry:'same pattern and playback',groupCount:count,mobile:'passed'}));
  await context.close();
 }
}finally{await browser.close();}
