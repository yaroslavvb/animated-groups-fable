/** Remove saved rows in a browser-only response fixture to check every empty
 * time-symmetry state. No fabricated orbit or certificate is introduced. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/');
const [metadata,manifest]=await Promise.all(['scott-gray/wallpaper-groups.json','scott-gray/data/wallpaper-atlas.json'].map(async path=>(await fetch(base+path)).json()));
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/scott-gray/data/wallpaper-atlas.json',route=>route.fulfill({json:{...manifest,orbits:[]}}));
let checked=0;
try{
  for(const family of metadata.families.filter(item=>!['p4','p6'].includes(item.id))){
    await page.goto(`${base}scott-gray/${family.id}/`);
    await page.waitForFunction(()=>document.querySelectorAll('#groups .group').length>0);
    for(const id of family.groupIds){
      const group=metadata.groups.find(item=>item.id===id);
      await page.locator(`[data-group-id="${id}"]`).click();
      assert.equal(await page.locator('#empty-state').isVisible(),true);
      assert.equal(await page.locator('#mode-label').innerText(),group.hasTimeShift?'Existence unresolved':'No time offset');
      for(const control of ['play','phase','solution','parameter-set','export','show-generators'])assert.equal(await page.locator(`#${control}`).isDisabled(),true,`${id} ${control}`);
      assert.equal(await page.locator('#generator-overlay').getAttribute('hidden'),'');
      assert.equal(await page.locator('#pattern-thumbnails button').count(),0);
      const shared=page.url();assert.ok(shared.includes(`#${id}?v=2&`));
      await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#groups .group').length>0);
      assert.equal(page.url(),shared);
      assert.equal(await page.locator(`[data-group-id="${id}"]`).getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#empty-state').isVisible(),true);
      checked++;
    }
  }
  assert.equal(checked,56);assert.deepEqual(errors,[]);
  console.log(`${checked} empty symmetry variants: honest status, disabled controls, no generators or thumbnails, and exact URL restoration passed`);
}finally{await browser.close();}
