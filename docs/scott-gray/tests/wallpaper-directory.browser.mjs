import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/'),label=process.argv[3]??'local';
const [metadata,index]=await Promise.all(['scott-gray/wallpaper-groups.json','scott-gray/data/wallpaper-atlas-index.json'].map(async path=>{const response=await fetch(base+path);assert.ok(response.ok,path);return response.json();}));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  for(const width of [1280,390,320]){
    await page.setViewportSize({width,height:900});
    await page.goto(base+'scott-gray-groups.html');
    await page.waitForFunction(()=>document.getElementById('atlas-summary').textContent.length>0);
    assert.deepEqual(await page.locator('.family-card').evaluateAll(cards=>cards.map(card=>card.dataset.family)),metadata.families.map(family=>family.id));
    assert.equal(await page.locator('#atlas-summary').innerText(),`${index.uniqueFieldCount} saved fields`);
    for(const family of metadata.families){
      const card=page.locator(`[data-family="${family.id}"]`),row=index.families.find(item=>item.id===family.id),n=row.verifiedPatternCount;
      assert.equal(await card.locator('img').getAttribute('src'),`img/mathworld/${family.id}.webp`);
      assert.equal((await card.getAttribute('href')).split('#')[0],family.page);
      assert.equal(await card.locator('[data-pattern-count]').innerText(),n?`${n} verified pattern${n===1?'':'s'}`:'No verified patterns');
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow`);
    assert.doesNotMatch(await page.locator('main').innerText(),/tutorial|colou?r|clockwork|SEE WHY THE TIME OFFSET MATTERS/i);
    await page.locator('.family-card img').evaluateAll(async images=>{for(const image of images)image.loading='eager';await Promise.all(images.map(image=>image.decode()));});
    await page.screenshot({path:`/tmp/wallpaper-directory-${label}-${width}.png`,fullPage:true});
    console.log(`${width}px: 17 exact thumbnails/order, real saved counts, routes and responsive layout passed`);
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
