/** Verify visible phase-specific generator artwork on real saved animations. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/');
const label=process.argv[3]??'local';
const metadata=await (await fetch(`${base}scott-gray/wallpaper-groups.json`)).json();
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 for(const [family,id,expected] of [
  ['p2','g6',['rotation-2-1']],
  ['p2','g7',['rotation-2-0','rotation-2-1']],
  ['p3m1','g231',['plane-c']],
  ['pgg','g75',['plane-d','rotation-2-0','rotation-2-1']],
  ['p4g','g137',['plane-m','rotation-4-1']],
 ]){
  await page.goto(`${base}scott-gray/${family}/#${id}?v=2&overlay=1&tiles=1&phase=0.25&play=0`);
  await page.waitForFunction(()=>document.getElementById('status')?.textContent==='Saved animation ready.',undefined,{timeout:60000});
  assert.ok(await page.locator('#show-generators').isChecked());
  const symbols=await page.locator('.wallpaper-generator').evaluateAll(items=>[...new Set(items.map(item=>item.dataset.generatorSymbol))].sort());
  for(const symbol of expected)assert.ok(symbols.includes(symbol),`${id}: missing ${symbol}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id}: mobile overflow`);
  const group=metadata.groups.find(g=>g.id===id);
  const paths=await page.locator('.wallpaper-generator.rotation path.generator-symbol-core').evaluateAll(items=>items.map(item=>item.getAttribute('d')));
  for(const generator of group.namedGenerators.filter(g=>g.kind==='rotation'))assert.ok(paths.includes(generator.glyph.path),`${id}: source glyph absent`);
  if(id==='g231')assert.equal(await page.locator('.generator-axis').first().getAttribute('stroke-dasharray'),'0 8');
  if(id==='g75')assert.ok(await page.locator('.generator-quarter-arrow').count()>0);
  const before=await page.locator('.canvas-wrap canvas:not([hidden])').evaluate(canvas=>canvas.toDataURL());
  await page.locator('#show-generators').uncheck();
  assert.equal(await page.locator('.wallpaper-generator').count(),0);
  assert.ok(await page.locator('.canvas-wrap canvas:not([hidden])').evaluate(canvas=>canvas.toDataURL())===before,`${id}: glyph toggle changed the concentration image`);
  await page.locator('#show-generators').check();
  await page.locator('.viewer').screenshot({path:`/tmp/wallpaper-glyphs-${label}-${id}-mobile.png`});
  console.log(`${family} ${id}: ${symbols.join(', ')}; exact glyph paths, mobile layout and unchanged frame passed`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
