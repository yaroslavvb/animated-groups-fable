/** Export the actual WebGL renderer as a still and a seamless uploadable MP4.
 * Usage: node tools/export_ember_social.mjs [viewer URL] [output directory]
 * Requires Playwright/Chrome and ffmpeg. No realtime screen recording is used:
 * every frame is evaluated at its exact phase so slow exports cannot stutter.
 */
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const url = process.argv[2] ?? 'http://localhost:8934/scott-gray/ember/';
const output = resolve(process.argv[3] ?? 'docs/scott-gray/ember');
const temporary = await mkdtemp(join(tmpdir(), 'ember-social-'));
await mkdir(output, {recursive: true});
function ffmpeg(args) {
  const child = spawn(process.env.FFMPEG ?? 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {stdio: ['pipe', 'inherit', 'inherit']});
  child.completion = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });
  return child;
}
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1080, height: 1080}, deviceScaleFactor: 1});
  await page.goto(`${url}?play=0`);
  await page.waitForSelector('canvas[data-ready="true"]');
  const {phase, seconds} = await page.evaluate(async () => {
    const {createRenderer, INITIAL_PHASE, LOOP_SECONDS} = await import('./renderer.mjs');
    const response = await fetch('./field.f32');
    if (!response.ok) throw new Error('Could not fetch seed');
    const view = new DataView(await response.arrayBuffer());
    const field = Float32Array.from({length: view.byteLength / 4}, (_, i) => view.getFloat32(i * 4, true));
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    document.body.replaceChildren(canvas);
    const renderer = createRenderer(canvas, field);
    window.exportFrame = (phase, type = 'image/png') => {
      renderer.draw(phase);
      return canvas.toDataURL(type, .96).split(',')[1];
    };
    return {phase: INITIAL_PHASE, seconds: LOOP_SECONDS};
  });
  const fps = 30, frameCount = fps * seconds;
  const encoder = ffmpeg(['-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0', '-an',
    '-vf', 'scale=out_color_matrix=bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level:v', '4.1', '-maxrate', '12M', '-bufsize', '24M',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', join(temporary, 'cycle.mp4')]);
  for (let i = 0; i < frameCount; i++) {
    const png = Buffer.from(await page.evaluate(phase => window.exportFrame(phase), (phase + i / frameCount) % 1), 'base64');
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    if (i % fps === 0) console.log(`Rendered ${i}/${frameCount} exact-phase frames`);
  }
  encoder.stdin.end(); await encoder.completion;
  const loop = ffmpeg(['-stream_loop', '1', '-i', join(temporary, 'cycle.mp4'), '-an', '-c', 'copy', '-movflags', '+faststart', join(output, 'ember-preview.mp4')]);
  loop.stdin.end(); await loop.completion;
  await page.setViewportSize({width: 1200, height: 630});
  await writeFile(join(output, 'social-preview.jpg'), Buffer.from(await page.evaluate(phase => window.exportFrame(phase, 'image/jpeg'), phase), 'base64'));
  console.log('Exported 8-second 1080×1080 30fps MP4 and 1200×630 JPEG');
} finally { await browser.close(); await rm(temporary, {recursive: true, force: true}); }
