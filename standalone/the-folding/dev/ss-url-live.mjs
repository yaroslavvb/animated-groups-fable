// ss-url-live.mjs — the owner's URL request, checked on the REAL spacesheep page (not the stand-in):
//  1. open the page, change state inside the app frame (group, preset, seed, wavy, t, view)
//  2. read the TOP address bar: does it carry the state?
//  3. open that address in a fresh page: is the same state restored?
//  4. legacy link #*632 and a pasted new-form link
import { openBrowser } from '../tools/browser.mjs';

const BASE = 'https://spacesheep.dev/@yaroslavvb/the-folding';
const B = await openBrowser();
const out = {};
async function appFrame(page) {
  for (let i = 0; i < 150; i++) {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      try { if (await f.evaluate(() => !!(window.__folding && window.__folding.ready))) return f; } catch { /* loading */ }
    }
    await page.waitForTimeout(200);
  }
  throw new Error('no app frame');
}
const pick = (s) => ({ g: s.groupId, preset: s.preset, seed: s.seed && s.seed.map((v) => +v.toFixed(4)), amp: s.amp, t: +(+s.t).toFixed(3),
  view: s.view && { az: +s.view.az.toFixed(1), el: +s.view.el.toFixed(1), zoom: +s.view.zoom.toFixed(2) } });
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  const f = await appFrame(page);
  out.loadedUrl = page.url();
  await f.evaluate(() => {
    const F = window.__folding;
    F.setGroup('632'); F.setPreset(2); F.setSeed(0.36, 0.11); F.setAmp(0.6); F.setT(0.8); F.setView(35, 30);
  });
  await page.waitForTimeout(2500);
  out.stateSet = pick(await f.evaluate(() => window.__folding.getState()));
  out.topUrlAfter = page.url();
  out.frameHash = await f.evaluate(() => location.hash);
  // fresh page from the copied address
  const page2 = await (await B.browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page2.goto(out.topUrlAfter, { waitUntil: 'load' });
  const f2 = await appFrame(page2);
  await page2.waitForTimeout(800);
  out.stateRestored = pick(await f2.evaluate(() => window.__folding.getState()));
  await page2.screenshot({ path: 'qa/live-url-restored.png' });
  await page.screenshot({ path: 'qa/live-url-original.png' });
  // legacy link
  const page3 = await (await B.browser.newContext({ viewport: { width: 390, height: 780 } })).newPage();
  await page3.goto(BASE + '#*632', { waitUntil: 'load' });
  const f3 = await appFrame(page3);
  await page3.waitForTimeout(1500);
  out.legacy = { group: (await f3.evaluate(() => window.__folding.getState())).groupId, topUrl: page3.url() };
} finally { await B.close(); }
out.match = JSON.stringify(out.stateSet) === JSON.stringify(out.stateRestored);
console.log(JSON.stringify(out, null, 1));
