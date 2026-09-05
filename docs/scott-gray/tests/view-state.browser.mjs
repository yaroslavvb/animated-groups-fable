// Run against a server serving docs: node tests/view-state.browser.mjs <site-root-url>.
// Requires Playwright and Chrome; PLAYWRIGHT_MODULE can point to an installed module.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {readViewState} from '../view-state.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/');
const artifacts=process.env.VIEW_STATE_ARTIFACTS??'/tmp/scott-gray-view-state';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const ready=page=>page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('ready'),{timeout:60000});
const snapshot=page=>page.evaluate(()=>({
  group:document.querySelector('#groups [aria-pressed="true"]').dataset.id,
  parameter:document.querySelector('#parameter-set').value,
  pattern:document.querySelector('#solution').value,
  palette:document.querySelector('#palette').value,
  tiles:document.querySelector('#tiles').value,
  speed:document.querySelector('#speed').value,
  generator:document.querySelector('#operation').value,
  overlay:document.querySelector('#show-generators').checked,
  phase:document.querySelector('#phase-label').textContent,
  play:document.querySelector('#play').getAttribute('aria-label'),
  image:document.querySelector('#compare-original').toDataURL(),
}));
try{
  for(const [family,path,initial,selected] of [['442','scott-gray/','g95','g96'],['632','scott-gray/p6/','g247','g248']]){
    const errors=[],context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    const page=await context.newPage();
    await page.goto(base+path+'#'+initial);await ready(page);
    assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause animation','legacy links autoplay');
    assert.equal(await page.locator('#show-generators').isChecked(),false);
    const initialUrl=page.url();
    await page.waitForFunction(()=>Number(document.querySelector('#phase').value)>.04);
    assert.equal(page.url(),initialUrl,'animation frames must not rewrite the URL');
    await page.locator(`#groups [data-id="${selected}"]`).click();await ready(page);
    assert.equal(readViewState(new URL(page.url()).hash).groupId,selected);
    const sets=await page.locator('#parameter-set option').evaluateAll(options=>options.map(option=>option.value));
    assert.ok(sets.length>1,'exercise a nondefault parameter set');
    await page.selectOption('#parameter-set',sets[1]);await ready(page);
    const parameters=await page.locator('#parameter-values').innerText();
    const patterns=await page.locator('#solution option').evaluateAll(options=>options.map(option=>option.value));
    assert.ok(patterns.length>1,'exercise a nondefault pattern at fixed parameters');
    await page.locator('#pattern-thumbnails button').nth(1).click();await ready(page);
    assert.equal(await page.locator('#parameter-values').innerText(),parameters);
    assert.equal(readViewState(new URL(page.url()).hash).patternId,patterns[1]);
    await page.selectOption('#palette','ceramic');await page.selectOption('#tiles','3');await page.selectOption('#speed','0.5');
    await page.locator('#show-generators').check();await page.selectOption('#operation','β');
    await page.locator('#phase').fill('0.137');await page.locator('#phase').dispatchEvent('input');
    const expected=await snapshot(page),sharedUrl=page.url(),view=readViewState(new URL(sharedUrl).hash);
    assert.deepEqual({palette:view.palette,tiles:view.tiles,speed:view.speed,generator:view.generator,overlay:view.overlay,play:view.play},{palette:'ceramic',tiles:3,speed:0.5,generator:'β',overlay:true,play:false});
    assert.ok(Math.abs(view.phase-.137)<1e-12);
    const recipient=await context.newPage();await recipient.goto(sharedUrl);await ready(recipient);
    assert.deepEqual(await snapshot(recipient),expected,'shared URL restores the exact controls, parameters, pattern and rendered frame');
    assert.equal(recipient.url(),sharedUrl,'restoring a URL keeps its exact phase precision');
    await recipient.screenshot({path:`${artifacts}/${family}-desktop.png`});
    await recipient.setViewportSize({width:390,height:844});
    await recipient.locator('.playback').scrollIntoViewIfNeeded();
    await recipient.screenshot({path:`${artifacts}/${family}-mobile.png`});
    assert.equal(await recipient.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no mobile horizontal overflow');
    await recipient.evaluate(group=>{location.hash=group;},initial);await ready(recipient);
    assert.equal(await recipient.locator('#palette').inputValue(),'ember','legacy navigation resets display defaults');
    assert.equal(await recipient.locator('#show-generators').isChecked(),false);
    await recipient.goBack();await ready(recipient);
    assert.deepEqual(await snapshot(recipient),expected,'back restores shared view rather than remembered defaults');
    await recipient.locator('#play').click();
    const playingUrl=recipient.url();assert.equal(readViewState(new URL(playingUrl).hash).play,true);
    const autoplay=await context.newPage();await autoplay.goto(playingUrl);await ready(autoplay);
    assert.equal(await autoplay.locator('#play').getAttribute('aria-label'),'Pause animation');
    await autoplay.waitForFunction(()=>Number(document.querySelector('#phase').value)>.18);
    assert.equal(autoplay.url(),playingUrl);
    await autoplay.locator('#play').click();await autoplay.locator('#rewind').click();
    assert.equal(readViewState(new URL(autoplay.url()).hash).phase,0);
    await autoplay.selectOption('#solution',patterns[0]);await ready(autoplay);
    assert.equal(await autoplay.locator('#play').getAttribute('aria-label'),'Pause animation','selecting a new pattern autoplays');
    await autoplay.goto(base+path+`#${selected}?v=1&pattern=missing&tiles=999&speed=NaN&palette=invalid&generator=bad&phase=Infinity&play=0`);await ready(autoplay);
    const fallback=readViewState(new URL(autoplay.url()).hash);
    assert.equal(fallback.groupId,selected);assert.notEqual(fallback.patternId,'missing');
    assert.equal(fallback.tiles,2);assert.equal(fallback.speed,1);assert.equal(fallback.palette,'ember');assert.equal(fallback.phase,0);assert.equal(fallback.play,false);
    if(family==='442'){
      await autoplay.locator('#play').click();
      const urlBeforeLoss=autoplay.url();
      await autoplay.evaluate(()=>document.querySelector('#gpu-pattern').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await autoplay.waitForFunction(()=>document.querySelector('#gpu-pattern').hidden);
      const phaseBeforeLoss=await autoplay.locator('#phase').inputValue();
      await autoplay.waitForFunction(value=>document.querySelector('#phase').value!==value,phaseBeforeLoss);
      assert.equal(await autoplay.locator('#play').getAttribute('aria-label'),'Pause animation','graphics fallback preserves autoplay');
      assert.match(await autoplay.locator('#engine-label').innerText(),/^CPU playback/);
      assert.equal(autoplay.url(),urlBeforeLoss);
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({family,roundtrip:'exact frame and full state',autoplay:true,mobile:'passed',sharedUrl}));
    await context.close();
  }
}finally{await browser.close();}
