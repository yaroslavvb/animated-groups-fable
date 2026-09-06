/** Exercise real saved data: navigation, empty states, selectors, framing and
 * reproducible paused URLs across all 15 newly supported wallpaper families. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/');
const label=process.argv[3]??'local';
const [metadata,manifest]=await Promise.all(['scott-gray/wallpaper-groups.json','scott-gray/data/wallpaper-atlas.json'].map(async path=>{const response=await fetch(base+path);assert.ok(response.ok,path);return response.json();}));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const ready=()=>page.waitForFunction(()=>{const status=document.getElementById('status')?.textContent;return status==='Saved animation ready.'||status==='No verified pattern in the saved search results.'||status==='This entry has no nonzero time shift.';},undefined,{timeout:60000});
const visibleCanvas=()=>page.locator('.canvas-wrap canvas:not([hidden])');
let populated=0,empty=0,checkedDefaults=false,checkedSelectors=false;
try{
  for(const family of metadata.families.filter(item=>!['p4','p6'].includes(item.id))){
    const records=manifest.orbits.filter(item=>metadata.groups.find(group=>group.id===item.groupId)?.family===family.id);
    const selected=records[0],groupId=selected?.groupId??family.groupIds[0];
    await page.goto(`${base}scott-gray/${family.id}/#${groupId}`);await ready();
    assert.equal(await page.locator('#family-nav option').count(),17,`${family.id} family navigation`);
    assert.deepEqual(await page.locator('#groups .group').evaluateAll(items=>items.map(item=>item.dataset.groupId)),family.groupIds);
    assert.equal(await page.locator('.comparison').count(),0);
    assert.equal(await page.locator('#show-generators').isChecked(),false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${family.id} desktop overflow`);
    if(!records.length){
      empty++;
      for(const id of family.groupIds){
        await page.locator(`[data-group-id="${id}"]`).click();await ready();
        assert.equal(await page.locator('#play').isDisabled(),true);
        assert.equal(await page.locator('#solution').isDisabled(),true);
        assert.equal(await page.locator('#empty-state').isVisible(),true);
        assert.equal(await page.locator('#generator-overlay').getAttribute('hidden'),'');
        const g=metadata.groups.find(item=>item.id===id);
        assert.equal(await page.locator('#mode-label').innerText(),g.hasTimeShift?'Existence unresolved':'No time offset');
      }
    }else{
      populated++;
      assert.equal(await page.locator('#empty-state').isVisible(),false);
      assert.match(await page.locator('#mode-label').innerText(),/^Numerically verified/);
      const initialPhase=+(await page.locator('#phase').inputValue());
      await page.waitForFunction(start=>+document.getElementById('phase').value!==start,initialPhase);
      assert.match(await page.locator('#play').innerText(),/Pause/);
      await page.locator('#phase').evaluate(element=>{element.value='0.375';element.dispatchEvent(new Event('input',{bubbles:true}));});
      await page.locator('#tiles').selectOption('1');
      await page.locator('#show-generators').check();
      assert.equal(await page.locator('#generator-overlay').getAttribute('hidden'),null);
      assert.ok(await page.locator('.wallpaper-generator').count()>0,`${family.id} visible generators`);
      assert.ok(await page.locator('#cell-guide [data-cell-boundary]').count()>0,`${family.id} cell guide`);
      assert.match(await visibleCanvas().evaluate(canvas=>canvas.style.clipPath),/^polygon\(/);
      await page.locator('#framing').selectOption('simulation');
      assert.equal(await visibleCanvas().evaluate(canvas=>canvas.style.clipPath),'');
      assert.equal(await page.locator('#tiles option:checked').innerText(),'L');
      await page.locator('#framing').selectOption('cells');
      assert.equal(await page.locator('#tiles option:checked').innerText(),'1 cell');
      await page.locator('#palette').selectOption('concentration');assert.match(await page.locator('#display-range').innerText(),/^V /);
      await page.locator('#palette').selectOption('ember');assert.match(await page.locator('#display-range').innerText(),/^U /);
      await page.locator('#speed').selectOption('2');
      const operations=await page.locator('#operation option').evaluateAll(items=>items.map(item=>item.value));
      await page.locator('#operation').selectOption(operations.at(-1));
      const shared=page.url(),before=await visibleCanvas().screenshot();
      await page.reload();await ready();
      assert.equal(page.url(),shared,`${family.id} exact URL restoration`);
      assert.equal(+(await page.locator('#phase').inputValue()),.375);
      assert.equal(await page.locator('#show-generators').isChecked(),true);
      assert.equal(await page.locator('#operation').inputValue(),operations.at(-1));
      assert.match(await page.locator('#play').innerText(),/Play/);
      assert.deepEqual(await visibleCanvas().screenshot(),before,`${family.id} paused frame restoration`);
      if(!checkedSelectors && await page.locator('#parameter-set option').count()>1){
        const options=await page.locator('#parameter-set option').evaluateAll(items=>items.map(item=>item.value));
        await page.locator('#parameter-set').selectOption(options.at(-1));await ready();
        assert.ok(await page.locator('.pattern-thumb').count()>0);
        const patternIds=await page.locator('#solution option').evaluateAll(items=>items.map(item=>item.value));
        await page.locator('#solution').selectOption(patternIds.at(-1));await ready();
        assert.equal(new URL(page.url()).hash.includes(encodeURIComponent(patternIds.at(-1))),true);
        const map=page.locator('#parameter-map');if(await map.isVisible()){await map.click({position:{x:30,y:30}});await ready();assert.equal(await page.locator('#parameter-set').isDisabled(),false);}
        checkedSelectors=true;
      }
      if(!checkedDefaults){
        await page.goto(`${base}scott-gray/${family.id}/#${groupId}`);await ready();
        assert.equal(await page.locator('#show-generators').isChecked(),false);
        assert.match(await page.locator('#play').innerText(),/Pause/);checkedDefaults=true;
      }
    }
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${family.id} mobile overflow`);
    await page.screenshot({path:`/tmp/wallpaper-${label}-${family.id}-mobile.png`,fullPage:true});
    await page.setViewportSize({width:1280,height:1000});
    console.log(`${family.id}: ${records.length} records, selectors, URL, framing and mobile passed`);
  }
  assert.deepEqual(errors,[],'No uncaught page errors');
  console.log(JSON.stringify({families:15,populated,empty,checkedDefaults,checkedSelectors}));
}finally{await browser.close();}
