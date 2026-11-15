// dev/patterns/scratch-review-webkit/tile-lib.mjs — the moving pictures in one engine: the Tile step half way (the cards
// carry the print through Path2D under their own transforms; a mirror's card swings under the paper) and a re-cut under
// way (the pieces carry the print), for Paisley and Tomoe; the plane and the fold pane, dpr 2.
//   runTile({ browser, url, out, engine })
import fs from 'node:fs';
import path from 'node:path';

const safe = (id) => id.replace(/\*/g, 's');
export async function runTile({ browser, url, out, engine }) {
  fs.mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const log = [];
  page.on('console', (m) => log.push([m.type(), m.text().slice(0, 300)]));
  page.on('pageerror', (e) => log.push(['pageerror', String(e && e.message).slice(0, 300)]));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  const rows = [];
  for (const p of ['paisley', 'tomoe']) {
    for (const [g, u] of [['2222', 0.5], ['*442', 0.5], ['333', 0.5], ['**', 0.3], ['22*', 0.3]]) {
      const s = await page.evaluate(([g, p, u]) => { const F = window.__folding; F.setGroup(g); F.setPattern(p); F.setT(0); return F.setTile(u); }, [g, p, u]);
      await page.waitForTimeout(250);
      await page.locator('#pane-plane').screenshot({ path: path.join(out, `T-${p}-${safe(g)}-u${u}.jpg`), type: 'jpeg', quality: 88 });
      rows.push({ p, g, u, tile: s.tile, caption: s.tileCaption, errors: s.errors, print: s.print });
    }
    await page.evaluate(() => window.__folding.setTile(1));
    for (const [g, preset, t] of [['xx', 1, 0.25], ['22x', 1, 0.25], ['22x', 2, 0.3]]) {
      const s = await page.evaluate(([g, p, preset, t]) => { const F = window.__folding; F.setGroup(g); F.setPattern(p); F.setPreset(preset); return F.setT(t); }, [g, p, preset, t]);
      await page.waitForTimeout(400);
      await page.locator('#stage').screenshot({ path: path.join(out, `R-${p}-${safe(g)}-p${preset}-t${t}.jpg`), type: 'jpeg', quality: 88 });
      rows.push({ p, g, preset, t, recut: s.recut && s.recut.home, caption: s.foldCaption, errors: s.errors, print: s.print });
    }
  }
  fs.writeFileSync(path.join(out, `tile-${engine}.json`), JSON.stringify({ engine, version: browser.version(), rows, log }, null, 1));
  await ctx.close();
  return rows.length;
}
