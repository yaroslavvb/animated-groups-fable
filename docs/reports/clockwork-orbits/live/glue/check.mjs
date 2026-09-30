// check.mjs — headless verification of test.html with Playwright + system Chrome.
// Serves the `live/` tree over http (ES modules and module workers need a real origin),
// presses "Start from noise", waits for the delay to settle, screenshots at desktop and
// mobile widths, and writes the settled field for the Python cross-check.
//
//   PLAYWRIGHT_MODULE=<...>/playwright/index.mjs CHROME=<...>/Google\ Chrome node check.mjs
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
// Playwright is not vendored here.  Point PLAYWRIGHT_MODULE at an installed copy, e.g.
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs node check.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');                 // .../live
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const PORT = Number(arg('port', 8961));
const SEED = arg('seed', '1');
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, name === '/' ? 'glue/test.html' : name);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${PORT}/glue/test.html`;
console.log('serving', ROOT, 'at', URL_);

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const report = { url: URL_, seed: SEED, console: [], errors: [], loadAverage: os.loadavg(), cpus: os.cpus().length, sessions: [] };

async function session(name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.console.push(`[${name}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => report.errors.push(`[${name}] ${e.message}`));
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const out = { name, viewport };
  out.selfTest = await page.waitForFunction(() => window.__glueSelfTest, null, { timeout: 60000 }).then(h => h.jsonValue());
  out.domainPainted = await page.evaluate(() => {
    const c = document.querySelector('.glue-demo canvas.domain');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const set = new Set(); for (let i = 0; i < d.length; i += 400) set.add(`${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]}`);
    return set.size;
  });
  out.domainCaption = (await page.locator('.glue-demo .domaincap').textContent()).replace(/\s+/g, ' ').trim();
  out.noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  await page.screenshot({ path: `${HERE}/shot-${name}-idle.png` });

  await page.selectOption('.glue-demo select.seed', SEED);
  const t0 = Date.now();
  await page.click('.glue-demo button.start');

  await page.waitForFunction(() => window.__glue && window.__glue.setup, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__glue.frame && window.__glue.frame.periods >= 4, null, { timeout: 120000 });
  // an element shot: a full-page one takes long enough that the run finishes underneath it
  await page.locator('.glue-demo .glue-grid').first().screenshot({ path: `${HERE}/shot-${name}-assembling.png` });
  out.atShot = await page.evaluate(() => {
    const c = document.querySelector('.glue-demo canvas.field');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const set = new Set(); for (let i = 0; i < d.length; i += 4000) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return { colours: set.size, periods: window.__glue.frame.periods, done: !!window.__glue.assembled };
  });

  await page.waitForFunction(() => window.__glue && window.__glue.assembled, null, { timeout: 300000 });
  out.assembledSeconds = (Date.now() - t0) / 1000;
  out.assembled = await page.evaluate(() => {
    const a = window.__glue.assembled;
    return {
      T: a.T, periods: a.periods, steps: a.steps, stopReason: a.stopReason, lastDeltaT: a.lastDeltaT,
      seconds: a.seconds, computeSeconds: a.computeSeconds, rhsCalls: a.rhsCalls, nodeEvals: a.nodeEvals, historySamples: a.historySamples,
      published: a.published, relativePeriodError: a.relativePeriodError,
      symmetryMaxRaw: a.symmetryMaxRaw, vortices: a.vortices, totalCharge: a.totalCharge,
      centres: a.centres, glue: window.__glue.setup.glue, T0: window.__glue.setup.T0,
      delays: a.delays.length, drift: a.drift.map(d => d.driftRms),
    };
  });
  await page.screenshot({ path: `${HERE}/shot-${name}-assembled.png`, fullPage: true });

  out.polished = await page.waitForFunction(() => window.__glue && window.__glue.polished, null, { timeout: 300000 })
    .then(() => page.evaluate(() => {
      const p = window.__glue.polished;
      return { T: p.T, iterations: p.iterations, residualRms: p.residualRms, seconds: p.seconds,
        rhsCalls: p.rhsCalls, flows: p.flows, relativePeriodError: p.relativePeriodError,
        symmetryMaxRaw: p.symmetryMaxRaw };
    }))
    .catch(e => ({ error: String(e.message || e) }));
  out.totalSeconds = (Date.now() - t0) / 1000;
  out.noHorizontalScrollAfter = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  await page.screenshot({ path: `${HERE}/shot-${name}-done.png`, fullPage: true });

  // the settled field, for the Python lab
  const dump = await page.evaluate(() => {
    const st = window.__glue;
    return {
      glue: { period: st.assembled.T, values: Array.from(st.assembled.state) },
      polished: st.polished ? { period: st.polished.T, values: Array.from(st.polished.state) } : null,
    };
  });
  out.exported = [];
  for (const which of ['glue', 'polished']) {
    const d = dump[which];
    if (!d) continue;
    const buf = Buffer.alloc(8 * d.values.length);
    d.values.forEach((v, i) => buf.writeDoubleLE(v, 8 * i));
    await writeFile(`${HERE}/browser-${name}-${which}.f64`, buf);
    await writeFile(`${HERE}/browser-${name}-${which}.json`, JSON.stringify({
      which, period: d.period, gluePeriod: dump.glue.period,
      periods: out.assembled.periods, rhsCalls: out.assembled.rhsCalls,
      stopReason: out.assembled.stopReason, viewport, seed: SEED,
    }, null, 1));
    out.exported.push({ which, period: d.period, bytes: buf.length });
  }

  await page.close();
  return out;
}

/** A clean wall-clock run: click, wait, nothing in between. */
async function timing(name, viewport, speed) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.errors.push(`[${name}] ${e.message}`));
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  if (speed) await page.selectOption('.glue-demo select.speed', speed);
  const t0 = Date.now();
  await page.click('.glue-demo button.start');
  await page.waitForFunction(() => window.__glue && window.__glue.assembled, null, { timeout: 300000 });
  const assembled = (Date.now() - t0) / 1000;
  await page.waitForFunction(() => window.__glue && window.__glue.polished, null, { timeout: 300000 });
  const polished = (Date.now() - t0) / 1000;
  const numbers = await page.evaluate(() => ({
    glueT: window.__glue.assembled.T, glueSeconds: window.__glue.assembled.seconds,
    polishedT: window.__glue.polished.T, newtonSeconds: window.__glue.polished.seconds,
    newtonIterations: window.__glue.polished.iterations,
  }));
  await page.close();
  return { name, viewport, speed: speed || 'normal', clickToPeriodFound: assembled, clickToPolished: polished, ...numbers };
}

report.sessions.push(await session('desktop', { width: 1280, height: 900 }));
report.sessions.push(await session('mobile390', { width: 390, height: 844 }));
report.timing = [];
for (const s of ['7', '14', '56']) report.timing.push(await timing(`timing-${s}`, { width: 1280, height: 900 }, s));
report.timing.push(await timing('timing-mobile390', { width: 390, height: 844 }, '14'));
report.loadAverageEnd = os.loadavg();
await browser.close();
server.close();
await writeFile(`${HERE}/check.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({
  errors: report.errors, console: report.console, timing: report.timing,
  sessions: report.sessions.map(s => ({
    atShot: s.atShot,
    name: s.name, selfTest: s.selfTest.maxDifference, domainPainted: s.domainPainted,
    noHorizontalScroll: s.noHorizontalScroll && s.noHorizontalScrollAfter,
    T: s.assembled.T, periods: s.assembled.periods, rel: s.assembled.relativePeriodError,
    glueSeconds: s.assembled.seconds, wallToAssembled: s.assembledSeconds,
    polishedT: s.polished.T, polishedRel: s.polished.relativePeriodError,
    newtonIterations: s.polished.iterations, totalSeconds: s.totalSeconds,
    chargesAgree: s.assembled.centres.every(c => c.agrees),
  })),
}, null, 1));
