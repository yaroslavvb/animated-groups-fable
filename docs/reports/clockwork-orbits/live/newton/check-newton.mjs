// check.mjs — headless verification of index.html with Playwright + system Chrome.
// Serves this folder over http (ES modules and module workers need a real origin),
// presses "run the search", waits for convergence, and records what the page reports.
// Usage: node check.mjs [--amp 0.5] [--port 8951] [--keep]
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
// Point PLAYWRIGHT_MODULE at an installed playwright, CHROME at a Chrome binary.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const HERE = path.dirname(new URL(import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const PORT = Number(arg('port', 8951));
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(HERE, name === '/' ? 'index.html' : name);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('no'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${PORT}/index.html`;
console.log('serving', HERE, 'at', URL_);

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const report = { url: URL_, amp: Number(arg('amp', 0.5)), console: [], errors: [], loadAverageStart: os.loadavg(), cpus: os.cpus().length };

async function session(name, viewport, { run = true, amp = report.amp, screenshotDuring = false } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.console.push(`[${name}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => report.errors.push(`[${name}] ${e.message}`));
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const out = { name, viewport };
  // the seed picture must already be on screen, and the symbol drawn
  out.symbolPaths = await page.locator('#symbol svg polygon').count();
  out.seedText = (await page.locator('#seedOut').textContent()).trim();
  out.shellRows = await page.locator('#shellTable tr').count();
  out.seedPainted = await page.evaluate(() => {
    const c = document.getElementById('field'), ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const set = new Set(); for (let i = 0; i < d.length; i += 4000) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return set.size;
  });
  await page.screenshot({ path: `${HERE}/shot-${name}-seed.png`, fullPage: false });
  if (!run) { await page.close(); return out; }
  await page.selectOption('#amp', String(amp));
  const t0 = Date.now();
  await page.click('#run');
  if (screenshotDuring) {
    await page.waitForFunction(() => window.__live.history.length >= 2, null, { timeout: 120000 });
    await page.screenshot({ path: `${HERE}/shot-${name}-searching.png` });
  }
  try {
    await page.waitForFunction(() => window.__live.frames !== null, null, { timeout: 180000 });
    out.finished = true;
  } catch { out.finished = false; }
  out.wallSecondsBrowser = (Date.now() - t0) / 1000;
  out.loadAverage = os.loadavg();
  out.result = await page.evaluate(() => {
    const s = window.__live;
    return {
      period: s.result && s.result.T, iterations: s.history.length - 1,
      history: s.history.map(h => ({ i: h.iteration, rms: h.residualRms, T: h.T, inner: h.inner, flows: h.flows, s: h.seconds })),
      vortices: s.vortices, playing: s.playing, solved: s.converged, symmetryMax: s.movie && s.movie.symmetryMax,
      verdict: document.getElementById('verdictOut').innerText,
      charges: [...document.querySelectorAll('#chargeTable tr')].map(r => r.innerText.replace(/\t/g, ' | ')),
      status: document.getElementById('status').textContent,
    };
  });
  await page.waitForTimeout(1200);                    // let the movie play a little
  out.animates = await page.evaluate(async () => {
    const c = document.getElementById('field'), ctx = c.getContext('2d');
    const grab = () => ctx.getImageData(0, 0, c.width, c.height).data.slice(0, 20000);
    const a = grab();
    await new Promise(r => setTimeout(r, 700));
    const b = grab();
    let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    return diff / a.length;
  });
  await page.screenshot({ path: `${HERE}/shot-${name}-orbit.png` });
  // the monochrome style, as on the site
  await page.selectOption('#style', 'mono');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${HERE}/shot-${name}-mono.png` });
  await page.selectOption('#style', 'ember');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${HERE}/shot-${name}-full.png`, fullPage: true });
  out.scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  out.clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  await page.close();
  return out;
}

report.desktop = await session('desktop', { width: 1280, height: 900 }, { screenshotDuring: true });
report.mobile = await session('mobile390', { width: 390, height: 844 });
if (argv.includes('--stall')) report.stall = await session('amp025', { width: 1280, height: 900 }, { amp: 0.25 });

await browser.close();
server.close();
const pub = 6.390159918584649;
for (const k of ['desktop', 'mobile390', 'mobile']) {
  const r = report[k] || (k === 'mobile' ? report.mobile : null);
  if (!r || !r.result) continue;
  r.relativePeriodDifference = Math.abs(r.result.period - pub) / pub;
  r.matchingDigits = Math.floor(-Math.log10(r.relativePeriodDifference));
}
report.loadAverageEnd = os.loadavg();
await writeFile(`${HERE}/check.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({
  desktop: { solved: report.desktop.result.solved, finished: report.desktop.finished, period: report.desktop.result.period, digits: report.desktop.matchingDigits, seconds: report.desktop.result.history.at(-1).s, flows: report.desktop.result.history.at(-1).flows, browserSeconds: report.desktop.wallSecondsBrowser, animates: report.desktop.animates, colours: report.desktop.seedPainted },
  mobile: { solved: report.mobile.result.solved, finished: report.mobile.finished, period: report.mobile.result.period, seconds: report.mobile.result.history.at(-1).s, scrollWidth: report.mobile.scrollWidth, clientWidth: report.mobile.clientWidth, animates: report.mobile.animates },
  consoleNoise: report.console, pageErrors: report.errors,
}, null, 1));
console.log(report.desktop.result.verdict);
console.log(report.desktop.result.charges.join('\n'));
