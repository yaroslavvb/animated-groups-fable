import assert from 'node:assert/strict';
import {mainFrameScreenshot} from './browser-frame.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=(process.argv[2]??'http://localhost:8934/').replace(/\/?$/,'/'),label=process.argv[3]??'local';
const cases=[
  {name:'p6-q31',family:'p6',group:'g247',id:'saved:g247-diversity-q1-wide-L1024-Q31-F00406-F0p00406000-k0p02000000-L1024-N66-M96',phase:0,play:true,index:31,approximate:true},
  {name:'p6-q12',family:'p6',group:'g247',id:'saved:g247-diversity-q1-wide-L1024-Q12-F00406-F0p00406000-k0p02000000-L1024-N96-M96',phase:.34798750000000434,play:false,index:12,approximate:false},
  {name:'p4-original',family:'p4',group:'g96',id:'saved:g96-F0p00400000-k0p02000000-N48-M128',phase:.1296874999999396,play:false},
  {name:'p4-oblique',family:'p4',group:'g96',id:'saved:g96-diversity-p4-rotating-oblique-31-f00395-F0p00395000-k0p02000000-L256-N48-M128',phase:.1296874999999396,play:false},
  {name:'p4-g98',family:'p4',group:'g98',id:'saved:g98-F0p00403000-k0p02000-N48-M128',phase:.17,play:false},
];
const path=c=>c.family==='p6'?'scott-gray/p6/':'scott-gray/';
const params=page=>new URLSearchParams(page.url().split('?')[1]);
const loaded=page=>page.waitForFunction(()=>document.querySelector('#empty-state').hidden&&!document.querySelector('#play').disabled,null,{timeout:45000});
const frame=mainFrameScreenshot;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  async function inspectGeometry(c,count,simulation=false){
    const result=await page.evaluate(async({family,id,count,simulation})=>{
      const root=family==='p6'?'../':'./';
      const [{primitiveCell,latticeToCell},{makeCellView},{viewTransform,screenPointToLattice},{rotationCentres},{overlayNearEvidence}]=await Promise.all([
        import(root+'cell-geometry.mjs'),import(root+'cell-view.mjs'),import(root+'view-transform.mjs'),import(root+'rotation-centres.mjs'),import(root+'overlay-near-data.mjs')
      ]);
      const [strictIndex,nearIndex,manifest,groups]=await Promise.all([fetch(root+'data/overlay-translations.json').then(r=>r.json()),fetch(root+'data/overlay-near-translations.json').then(r=>r.json()),fetch('data/precomputed-atlas.json').then(r=>r.json()),fetch('groups.json').then(r=>r.json())]);
      const record=manifest.orbits.find(r=>r.id===id),translations=strictIndex.orbits[id].translations,near=overlayNearEvidence(nearIndex,record,translations),cell=primitiveCell({family,translations:near?.translations??translations}),view=makeCellView(cell,count),group=groups.find(g=>g.id===record.groupId);
      const named=family==='p6'?group.namedGenerators:(await import(root+'overlay.mjs')).GROUP_DISPLAY[group.id].namedGenerators;
      const expectedCentres=rotationCentres({namedGenerators:named,ops:group.render.ops,family,translations:near?.translations??translations});
      const markers=[...document.querySelectorAll('#generator-overlay [data-lattice-point]')];let maximumError=0,weighted=0,outside=0;
      for(const marker of markers){
        const original=JSON.parse(marker.dataset.latticePoint),hit=marker.querySelector('.sg-generator-hit');
        const displayed=hit?[+hit.getAttribute('cx')/768,+hit.getAttribute('cy')/768]:(()=>{const matrix=marker.transform.baseVal.consolidate().matrix;return [matrix.e/768,matrix.f/768];})();
        if(simulation){const back=screenPointToLattice(displayed,viewTransform({family,tiles:count}));maximumError=Math.max(maximumError,...back.map((v,i)=>Math.abs(v-original[i])));}
        else{
          const expected=view.originalToScreen(original);maximumError=Math.max(maximumError,...displayed.map((v,i)=>Math.abs(v-expected[i])));if(!view.contains(original))outside++;
          let weight=1;for(const coordinate of latticeToCell(original,cell))if(Math.abs(coordinate)<1e-7||Math.abs(coordinate-count)<1e-7)weight/=2;weighted+=weight;
        }
      }
      const canvas=document.querySelector('#gpu-pattern').hidden?document.querySelector('#pattern'):document.querySelector('#gpu-pattern');
      const expectedClipStyle=document.createElement('canvas').style;expectedClipStyle.clipPath=view.clipPath;
      const clips=['pattern','gpu-pattern'].map(id=>document.getElementById(id).style.clipPath);
      return {index:cell.index,approximate:!!near,count:markers.length,weighted,expectedWeighted:expectedCentres.length/cell.index*count*count,maximumError,outside,
        guide:[...document.querySelectorAll('#cell-guide path')].map(p=>p.getAttribute('d')),expectedGuide:[...view.guideMarkup.matchAll(/ d="([^"]+)"/g)].map(m=>m[1]),guideHidden:document.querySelector('#cell-guide').hasAttribute('hidden'),clips,expectedClip:expectedClipStyle.clipPath,
        divisions:document.querySelector('[data-cell-divisions]')?.getAttribute('data-cell-divisions')??'0',canvasWidth:canvas.width,canvasHeight:canvas.height,
        options:[...document.querySelector('#tiles').options].map(o=>[o.value,o.textContent]),scale:document.querySelector('.scale-label').textContent,explanation:document.querySelector('#view-scale-explanation').textContent,
        approximateMarkers:document.querySelectorAll('#generator-overlay .approximate-centre').length};
    },{family:c.family,id:c.id,count,simulation});
    assert.ok(result.maximumError<1e-7,`${c.name}: marker and field coordinates disagree by ${result.maximumError}`);
    if(simulation){assert.ok(result.guideHidden);assert.ok(result.clips.every(clip=>clip===''));assert.deepEqual(result.options,[['1','L'],['2','2 L'],['3','3 L']]);assert.match(result.scale,/Physical width/);return result;}
    if(c.index!==undefined)assert.equal(result.index,c.index);if(c.approximate!==undefined)assert.equal(result.approximate,c.approximate);
    assert.ok(result.count>0);assert.equal(result.outside,0);assert.ok(Math.abs(result.weighted-result.expectedWeighted)<1e-7,`${c.name}: expected ${result.expectedWeighted} weighted centres, saw ${result.weighted}`);
    assert.deepEqual(result.guide,result.expectedGuide);assert.equal(result.divisions,String(2*(count-1)));assert.ok(!result.guideHidden);assert.ok(result.clips.every(clip=>clip===result.expectedClip));
    const qualifier=result.approximate?'approx. ':'';assert.deepEqual(result.options,[['1',`1 ${qualifier}cell`],['2',`2 × 2 ${qualifier}cells`],['3',`3 × 3 ${qualifier}cells`]]);
    assert.match(result.explanation,/outlined (rhombus|square) is one/);
    if(result.approximate){assert.ok(result.approximateMarkers>0);assert.match(result.scale,/approximate cell/);assert.match(result.explanation,/approximate/);}
    else assert.equal(result.approximateMarkers,0);
    if(c.name==='p6-q12'&&count===1){assert.equal(result.count,11);assert.equal(result.weighted,6);}
    return result;
  }
  for(const c of cases){
    const query=new URLSearchParams({v:'1',pattern:c.id,palette:'ember',tiles:'1',speed:'1',generator:'α',overlay:'1',phase:String(c.phase),play:c.play?'1':'0'});
    await page.goto(base+path(c)+'#'+c.group+'?'+query);await loaded(page);
    assert.equal(await page.locator('.comparison,#compare-original,#comparison-error').count(),0,'comparison/tutorial is absent');
    assert.equal(await page.locator('#framing').inputValue(),'cells');assert.equal(params(page).get('v'),'2');assert.equal(params(page).get('framing'),'cells');assert.equal(params(page).get('tiles'),'1');
    assert.equal(await page.locator('#show-approximate').isChecked(),true);
    if(c.play){assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause animation');await page.locator('#play').click();}
    else assert.equal(params(page).get('phase'),String(c.phase));
    const first=await inspectGeometry(c,1),oneCellFrame=await frame(page);
    await page.locator('.canvas-wrap').screenshot({path:`/tmp/cell-framing-${label}-${c.name}-desktop.png`});
    for(const count of [2,3]){await page.selectOption('#tiles',String(count));await inspectGeometry(c,count);assert.notEqual(await frame(page),oneCellFrame,'cell count changes the actual sampled field');}
    await page.selectOption('#tiles','1');assert.equal(await frame(page),oneCellFrame);
    await page.selectOption('#framing','simulation');await inspectGeometry(c,1,true);assert.notEqual(await frame(page),oneCellFrame,'old simulation view is a different actual frame, not only a relabelled cell');
    await page.selectOption('#framing','cells');assert.equal(await frame(page),oneCellFrame);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${c.name} overflows a mobile viewport`);
    assert.equal(await page.evaluate(()=>{
      const image=document.querySelector('.canvas-wrap').getBoundingClientRect();
      return document.querySelector('.viewer-labels').getBoundingClientRect().bottom<=image.top&&document.querySelector('.view-caption').getBoundingClientRect().top>=image.bottom;
    }),true,'status labels cannot cover cell-boundary generators');
    await page.locator('.canvas-wrap').screenshot({path:`/tmp/cell-framing-${label}-${c.name}-mobile.png`});
    await page.setViewportSize({width:1440,height:1200});
    await page.selectOption('#palette','ceramic');await page.selectOption('#speed','2');
    await page.locator('#phase').evaluate(input=>{input.value='.371';input.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.selectOption('#tiles','2');
    const marker=await page.locator('#generator-overlay [data-lattice-point]').evaluateAll(elements=>{
      const box=document.querySelector('.canvas-wrap').getBoundingClientRect();return elements.findIndex(e=>{const b=e.getBoundingClientRect();return b.left>box.left+30&&b.right<box.right-30&&b.top>box.top+30&&b.bottom<box.bottom-30;});
    });
    assert.ok(marker>=0,'a marker is available for pointer selection');await page.locator('#generator-overlay [data-lattice-point]').nth(marker).click();
    const shared=page.url(),sharedFrame=await frame(page),generator=await page.locator('#operation').inputValue();assert.ok(generator.includes('@'));
    const restored=await browser.newPage({viewport:{width:390,height:844}});await restored.goto(shared);await loaded(restored);
    assert.equal(restored.url(),shared);assert.equal(await frame(restored),sharedFrame);assert.equal(await restored.locator('#operation').inputValue(),generator);assert.equal(await restored.locator('#framing').inputValue(),'cells');assert.equal(await restored.locator('#show-generators').isChecked(),true);assert.equal(await restored.locator('#show-approximate').isChecked(),true);assert.equal(await restored.locator('#play').getAttribute('aria-label'),'Play animation');await restored.close();
    if(first.approximate){await page.locator('#show-approximate').uncheck();assert.equal(await page.locator('#generator-overlay .approximate-centre').count(),0);assert.equal(params(page).get('approx'),'0');assert.match(await page.locator('.scale-label').textContent(),/approximate cell/);}
    console.log(JSON.stringify({case:c.name,index:first.index,rawCentres:first.count,weightedCentres:first.weighted,approximate:first.approximate,scales:[1,2,3],mobile:'passed',share:'passed',simulation:'passed'}));
    await page.setViewportSize({width:1440,height:1200});
  }
  for(const family of ['p4','p6']){await page.goto(base+(family==='p6'?'scott-gray/p6/#g247':'scott-gray/#g96'));await loaded(page);assert.equal(await page.locator('#show-generators').isChecked(),false);assert.equal(await page.locator('#generator-overlay').isVisible(),false);assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause animation');assert.equal(await page.locator('#framing').inputValue(),'cells');}
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
