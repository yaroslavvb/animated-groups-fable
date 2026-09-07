#!/usr/bin/env python3
"""Render the 17 wallpaper-group pages of the reaction–diffusion catalog from one template.

The site header and navigation are copied from docs/index.html at build time so the pages
never drift from the rest of the site. The 442 and 632 laboratory pages keep their own
apps but receive the same header.
"""
import html, json, re
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent; DOCS = ROOT.parent
VERSION = '20260907-marker-spacing'
STAR = '∗'
SUMMARIES = {'p1': 'Translations only.', 'p2': 'Four half-turn centres.', 'pm': 'Parallel mirrors.', 'pg': 'Parallel glide reflections.', 'cm': 'Mirrors with glides between them.', 'pmm': 'Two families of mirrors at right angles.', 'pmg': 'Mirrors, glides and half-turns.', 'pgg': 'Two families of glides and half-turns.', 'cmm': 'Two families of mirrors and half-turns between them.', 'p4': 'Quarter-turns and half-turns.', 'p4m': 'A mirror triangle with corner orders 4, 4 and 2.', 'p4g': 'Quarter-turns and a mirror through the half-turns.', 'p3': 'Three third-turn centres.', 'p3m1': 'A mirror triangle with corner orders 3, 3 and 3.', 'p31m': 'A third-turn and a mirror triangle.', 'p6': 'Sixth-turns, third-turns and half-turns.', 'p6m': 'A mirror triangle with corner orders 6, 3 and 2.'}

def site_header(prefix):
    index = (DOCS / 'index.html').read_text(); block = re.search(r'<header class="site">.*?</header>', index, re.S).group(0)
    block = re.sub(r'href="(?!https?:)([^"]+)"', lambda m: f'href="{prefix}{m.group(1)}"', block)
    block = block.replace(' class="here"', '')
    block = block.replace(f'<a href="{prefix}scott-gray-groups.html">Reaction–diffusion</a>', f'<a href="{prefix}scott-gray-groups.html" class="here">Reaction–diffusion</a>')
    return block

def favicon():
    return re.search(r'^\s*(<link rel="icon".*)$', (DOCS / 'index.html').read_text(), re.M).group(1).strip()

def page(family, index, families, prefix, app):
    hm = family['id']; orbifold = family['orbifold'].replace('*', STAR); zero_only = all(not g['hasTimeShift'] for g in family['groups'])
    prev_family = families[index - 1] if index > 0 else None; next_family = families[index + 1] if index + 1 < len(families) else None
    link = lambda f: f"{prefix}{f['page']}"
    pager = ''.join([
        f'<a class="family-pager-link family-pager-prev" href="{link(prev_family)}" rel="prev"><span aria-hidden="true">←</span> {prev_family["orbifold"].replace("*", STAR)} {prev_family["id"]}</a>' if prev_family else '',
        f'<a class="family-pager-link family-pager-index" href="{prefix}scott-gray-groups.html">All 17 wallpaper groups</a>',
        f'<a class="family-pager-link family-pager-next" href="{link(next_family)}" rel="next">{next_family["orbifold"].replace("*", STAR)} {next_family["id"]} <span aria-hidden="true">→</span></a>' if next_family else '',
        f'<label class="family-select"><span>Go to</span> <select aria-label="Wallpaper group" data-family="{hm}" id="family-nav"><option>{orbifold} · {hm}</option></select></label>'])
    step1 = ('<p class="eyebrow selection-step">1 · The time symmetry</p><p class="small zero-offset-note">This wallpaper group has one catalog entry, the zero-offset reference: every operation acts at the same instant, so its patterns are ordinary periodic animations with the full spatial symmetry.</p>' if zero_only else '<p class="eyebrow selection-step">1 · Choose the time symmetry</p>')
    lab_link = {'p4': f'<a href="{app}lab.html">442 laboratory (browser search)</a>', 'p6': f'<a href="{app}lab.html">632 laboratory</a>'}.get(hm, '')
    description = f'Numerically verified periodic patterns of the Gray–Scott, Ginzburg–Landau and Brusselator equations whose {orbifold} ({hm}) operations act with prescribed time shifts.'
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{html.escape(description)}">
  <meta name="theme-color" content="#ffffff">
  <title>{orbifold} {hm} — Periodic reaction–diffusion patterns — Spacetime Groups</title>
  {favicon()}
  <link rel="stylesheet" href="{prefix}css/style.css?v=collapsible-header-v1">
  <script defer src="{prefix}js/site-header.js?v=collapsible-header-v1"></script>
  <link rel="stylesheet" href="{app}style.css?v={VERSION}">
  <link rel="stylesheet" href="{app}wallpaper-style.css?v={VERSION}">
</head>
<body>
  <a class="skip-link" href="#groups">Skip to the time symmetries</a>
  {site_header(prefix)}
  <main class="reaction-diffusion-page">
    <section class="family-page-header" aria-labelledby="page-title">
      <p class="family-breadcrumb"><a href="{prefix}scott-gray-groups.html">Periodic reaction–diffusion patterns</a> <span aria-hidden="true">·</span> wallpaper group {index + 1} of 17</p>
      <h1 id="page-title"><span class="family-orbifold">{orbifold}</span> <span class="family-hm">{hm}</span></h1>
      <p class="family-summary">{SUMMARIES[hm]} Each entry below is one way the group's operations can advance a periodic pattern in time, from the <a href="{prefix}correspondence-{hm}.html">clockwork/colouring correspondence</a>; every animation is a saved, independently re-verified solution of the named equation.</p>
      <nav class="family-pager" aria-label="Neighbouring wallpaper groups">{pager}</nav>
    </section>
    {step1}
    <div aria-label="{orbifold} time-shift symmetries" class="groups variable-groups" id="groups" role="group"></div>
    <div class="solution-policy"><strong id="policy-label">Precomputed, verified solutions</strong><span id="solution-count">Loading catalog…</span></div>
    <div class="lab">
      <section aria-label="Verified solution animation" class="viewer">
        <div class="image-label viewer-labels"><span id="mode-label">Loading catalog</span><span id="group-label">{orbifold}</span></div>
        <div class="canvas-wrap">
          <canvas aria-label="Verified periodic solution. Press Space to play or pause." height="384" id="pattern" tabindex="0" width="384"></canvas>
          <canvas aria-label="Verified periodic solution rendered with WebGL. Press Space to play or pause." height="768" hidden id="gpu-pattern" tabindex="0" width="768"></canvas>
          <svg aria-label="Pattern cell boundaries" class="cell-guide" id="cell-guide" viewBox="0 0 768 768"></svg>
          <svg aria-label="{orbifold} symmetry generators" class="generator-overlay" hidden id="generator-overlay" viewBox="0 0 768 768"></svg>
          <div id="empty-state"><div class="empty-symbol">∅</div><h2>Loading saved catalog…</h2><p id="empty-description">Parameters, thumbnails and numerical checks are precomputed.</p><button hidden id="retry-animation" type="button">Retry animation</button></div>
        </div>
        <div class="view-caption"><span class="scale-label" id="scale-label">Physical width 2 L</span></div>
        <div class="playback"><button aria-label="Play animation" disabled id="play" type="button">▶ Play</button><button aria-label="Return to first frame" disabled id="rewind" type="button">↤</button><input aria-label="Animation phase" disabled id="phase" max="1" min="0" step="0.001" type="range" value="0"><output id="phase-label">—</output><label>View <select aria-label="View framing" id="framing"><option value="cells">Pattern cells</option><option selected value="simulation">Simulation width</option></select></label><label><span id="tile-label">Width</span> <select aria-describedby="view-scale-explanation" aria-label="Simulation width" id="tiles"><option value="1">L</option><option selected value="2">2 L</option><option value="3">3 L</option></select></label><label>Speed <select aria-label="Playback speed" id="speed"><option value="0.5">Slow</option><option selected value="1">Normal</option><option value="2">Fast</option></select></label></div>
        <div class="overlay-controls"><label><input id="show-generators" type="checkbox"> Generators</label><select aria-label="Named generator" id="operation"></select><span id="engine-label">No orbit loaded</span></div>
        <div class="phase-rule"><p id="generator-description"></p></div>
        <details class="numerical-record"><summary>Numerical record</summary><p class="small" id="view-scale-explanation">The displayed width is measured in simulation lattice lengths L.</p><p class="caption" id="caption">Only accepted numerical orbits appear here. An empty entry means existence remains unresolved.</p><div class="metrics"><div><span>Forward trajectory RMS</span><strong id="pde">—</strong></div><div><span>Time-symmetry error</span><strong id="symmetry">—</strong></div><div><span>Temporal variation</span><strong id="motion">—</strong></div><div><span>Forward return RMS</span><strong id="return">—</strong></div></div></details>
      </section>
      <aside class="controls">
        <div class="selected"><p class="eyebrow" id="selected-id"></p><h2 id="selected-title"></h2><p id="selected-description"></p></div>
        <section aria-label="Equation, verified parameters and pattern selectors" class="atlas-panel">
          <p class="eyebrow">2 · Choose the equation</p>
          <div aria-label="Equation" class="equations" id="equations" role="group"></div>
          <p class="equation-description" id="equation-description"></p>
          <p class="eyebrow">3 · Choose verified parameters</p>
          <label class="atlas-label" for="parameter-set">Saved parameters</label><select disabled id="parameter-set"><option>No verified parameters</option></select>
          <p class="parameter-values" id="parameter-values">Loading precomputed parameters…</p>
          <div class="parameter-map-wrap"><canvas aria-label="Verified parameter plane. Click to select the closest verified parameter set; the selector above also provides keyboard access." height="320" id="parameter-map" tabindex="0" width="660"></canvas></div>
          <div class="pattern-section"><p class="eyebrow">4 · Choose a pattern</p><p class="small" id="pattern-count">Loading saved patterns…</p><div aria-label="Verified pattern thumbnails" class="pattern-thumbnails" id="pattern-thumbnails" role="group"></div>
          <label class="atlas-label" for="solution">Verified periodic pattern</label><select disabled id="solution"><option>No verified patterns</option></select></div>
        </section>
        <label class="stack">Appearance<select id="palette"><option value="ember">Ember</option><option value="ceramic">Porcelain</option><option value="concentration">Second channel</option></select></label>
        <p class="small" id="display-range"></p><button class="text-button" disabled id="export" type="button">↓ Export verified orbit + evidence</button><p id="status" role="status">Loading the precomputed catalog…</p>
      </aside>
    </div>
    <p class="page-links"><a href="{prefix}scott-gray-groups.html">All 17 wallpaper groups</a> · <a href="{app}research-note/">Research note</a> · <a href="https://github.com/yaroslavvb/animated-groups-fable/blob/main/docs/scott-gray/research/equations/README.md">How the patterns are computed</a>{' · ' + lab_link if lab_link else ''}</p>
  </main>
  <footer class="site">
    Spacetime groups: the crystallography of looping animations ·
    <a href="https://github.com/yaroslavvb/animated-groups-fable">source</a>
  </footer>
  <script type="module" src="{app}wallpaper-app.mjs?v={VERSION}"></script>
  <script type="module" src="{app}family-navigation.mjs?v={VERSION}"></script>
</body>
</html>
'''


def directory_page(families):
    cards = []
    for f in families:
        hm = f['id']; orbifold = f['orbifold'].replace('*', STAR); n = len(f['groupIds'])
        cards.append(f'''        <a class="family-card" data-family="{hm}" href="{f['page']}" aria-label="{orbifold}, {hm}: periodic reaction–diffusion patterns">
          <img src="{f['image']}" width="320" height="240" loading="lazy" decoding="async" alt="">
          <span class="family-card-caption"><strong class="family-card-orbifold">{orbifold}</strong><span class="family-card-hm">{hm}</span></span>
          <span class="family-card-count">{n} time {'symmetry' if n == 1 else 'symmetries'}</span>
          <span class="family-card-results"><span data-pattern-count>Verified patterns</span><small data-equations></small></span>
        </a>''')
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Numerically verified periodic solutions of the Gray–Scott, complex Ginzburg–Landau and Brusselator equations whose wallpaper-group operations act with prescribed time shifts, one page per wallpaper group.">
  <meta name="theme-color" content="#ffffff">
  <title>Periodic reaction–diffusion patterns — Spacetime Groups</title>
  {favicon()}
  <link rel="stylesheet" href="css/style.css?v=collapsible-header-v1">
  <script defer src="js/site-header.js?v=collapsible-header-v1"></script>
  <link rel="stylesheet" href="css/scott-gray-directory.css?v={VERSION}">
  <script type="module" src="js/scott-gray-directory.mjs?v={VERSION}"></script>
</head>
<body>
  <a class="skip-link" href="#families">Skip to wallpaper groups</a>
  {site_header('')}
  <main class="gray-scott-directory">
    <section class="directory" aria-labelledby="page-title">
      <p class="overline">Time-shift symmetries</p>
      <h1 id="page-title">Periodic reaction–diffusion patterns</h1>
      <p>Saved periodic solutions of three equations — Gray–Scott, complex Ginzburg–Landau and the Brusselator — whose wallpaper-group operations advance the pattern by prescribed fractions of its period, grouped by wallpaper group. Each entry is one row of the <a href="correspondence.html">clockwork/colouring correspondence</a>; every animation was re-verified from its saved bytes.</p>
    </section>
    <section id="families" aria-labelledby="families-title">
      <div class="family-directory-heading"><h2 id="families-title">The 17 wallpaper groups</h2><p id="atlas-summary" aria-live="polite"></p></div>
      <nav class="family-grid" aria-label="Wallpaper groups">
{chr(10).join(cards)}
      </nav>
    </section>
    <p class="atlas-note">Only numerically verified periodic patterns appear in the galleries. Counts are loaded from the saved index; each card also opens without them.</p>
  </main>
  <footer class="site">
    Spacetime groups: the crystallography of looping animations ·
    <a href="https://github.com/yaroslavvb/animated-groups-fable">source</a>
  </footer>
</body>
</html>
'''

def patch_lab(path, prefix, family):
    """Give a hand-written laboratory page the site header and stylesheet; keep its own app."""
    s = path.read_text()
    s = re.sub(r'<header>.*?</header>|<header class="site">.*?</header>', site_header(prefix), s, count=1, flags=re.S)
    s = re.sub(r'^\s*<link rel="icon"[^\n]*\n', '', s, flags=re.M)
    s = re.sub(r'^\s*<link rel="stylesheet" href="[^"]*css/style\.css[^\n]*\n', '', s, flags=re.M)
    s = re.sub(r'^\s*<script defer src="[^"]*js/site-header\.js[^\n]*\n', '', s, flags=re.M)
    s = re.sub(r'<p class="family-breadcrumb">.*?</p>', '', s, count=1, flags=re.S)
    if 'css/style.css' not in s:
        s = s.replace('</head>', f'<link rel="stylesheet" href="{prefix}css/style.css?v=collapsible-header-v1">\n<script defer src="{prefix}js/site-header.js?v=collapsible-header-v1"></script>\n{favicon()}\n</head>', 1)
    s = re.sub(r'<title>.*?</title>', f'<title>{family["orbifold"].replace("*", STAR)} {family["id"]} laboratory — Spacetime Groups</title>', s, count=1)
    s = re.sub(r'(<div class="intro"><div>)', r'\1<p class="family-breadcrumb"><a href="' + prefix + 'scott-gray-groups.html">Periodic reaction–diffusion patterns</a> · <a href="index.html">' + family['orbifold'].replace('*', STAR) + ' ' + family['id'] + ' catalog page</a> · laboratory</p>', s, count=1)
    s = s.replace('<option value="simulation">Simulation width</option>', '<option selected="" value="simulation">Simulation width</option>')
    s = s.replace('<span id="tile-label">Cells</span>', '<span id="tile-label">Width</span>')
    s = s.replace('aria-label="Number of pattern cells" id="tiles"', 'aria-label="Simulation width" id="tiles"')
    s = s.replace('<option value="1">1 cell</option>', '<option value="1">L</option>')
    s = s.replace('<option selected="" value="2">2 × 2 cells</option>', '<option selected="" value="2">2 L</option>')
    s = s.replace('<option value="3">3 × 3 cells</option>', '<option value="3">3 L</option>')
    s = s.replace('Each outlined region is one pattern repeat cell. The pattern and generators share this cell scale.', 'The displayed width is measured in simulation lattice lengths L.')
    path.write_text(s)

def main():
    data = json.loads((ROOT / 'wallpaper-groups.json').read_text()); groups = {g['id']: g for g in data['groups']}
    families = [dict(f, groups=[groups[i] for i in f['groupIds']]) for f in data['families']]
    for index, family in enumerate(families):
        if family['id'] == 'p4': target, prefix, app = ROOT / 'index.html', '../', './'
        elif family['id'] == 'p6': target, prefix, app = ROOT / 'p6/index.html', '../../', '../'
        else: target, prefix, app = ROOT / family['id'] / 'index.html', '../../', '../'
        target.parent.mkdir(exist_ok=True); target.write_text(page(family, index, families, prefix, app))
    patch_lab(ROOT / 'lab.html', '../', next(f for f in families if f['id'] == 'p4'))
    patch_lab(ROOT / 'p6/lab.html', '../../', next(f for f in families if f['id'] == 'p6'))
    (DOCS / 'scott-gray-groups.html').write_text(directory_page(families))
    print('wrote 17 pages, the directory page, and patched 2 laboratory pages')

if __name__ == '__main__': main()
