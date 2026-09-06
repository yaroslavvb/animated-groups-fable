import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
let frameNumber=0;
/** Capture the actually displayed chemistry, excluding the independent SVG
 * annotations. Normalize only screenshot pixel dimensions so mobile/desktop
 * share-link comparisons exercise the same camera at the same raster size.
 * Reading WebGL toDataURL after compositing may return a cleared framebuffer.
 */
export async function mainFrameScreenshot(page){
  const selector=await page.evaluate(()=>document.querySelector('#gpu-pattern').hidden?'#pattern':'#gpu-pattern');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const bytes=await page.locator(selector).screenshot({animations:'disabled',scale:'css',style:`
    .canvas-wrap { position:fixed !important; left:0 !important; top:0 !important; margin:0 !important; border:0 !important; border-radius:0 !important; box-shadow:none !important; background:#f0edf5 !important; z-index:2147483647 !important; width:320px !important; height:320px !important; min-height:0 !important; aspect-ratio:1 !important; }
    #pattern,#gpu-pattern { width:320px !important; height:320px !important; border-radius:0 !important; box-shadow:none !important; }
    #generator-overlay,#cell-guide { visibility:hidden !important; }
  `});
  if(process.env.FRAME_DEBUG)await writeFile(`/tmp/browser-frame-${++frameNumber}.png`,bytes);
  return createHash('sha256').update(bytes).digest('hex');
}
