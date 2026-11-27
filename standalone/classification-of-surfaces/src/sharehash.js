// sharehash.js — the address a reader can copy follows the page.
//
// On spacesheep the page runs in a frame, and the address bar belongs to the viewer round it. The viewer hands its
// #fragment down to the page when it loads, and takes the page's back when the page says {type: "ss-hash", hash}
// (spacesheep's own bridge says so on a hashchange; this page writes its address with replaceState, which fires none).
// The viewer takes only fragments of [A-Za-z0-9_.=%&/-], so the star of a signature travels as %2A; the page reads
// either. '#' alone clears the viewer's fragment: the pages say that for the state a plain link opens. Outside a
// frame nothing is said.

/** The fragment in the characters the viewer takes: every other character percent-escaped ("#k=*632" is "#k=%2A632"). */
export function viewerHash(hash) {
  return '#' + String(hash).replace(/^#/, '').replace(/[^A-Za-z0-9_.=%&/-]/gu, (c) => {
    let e;
    try { e = encodeURIComponent(c); } catch (err) { return ''; }       // half of a broken pair of code units: left out
    return e.replace(/[!'()*~]/g, (x) => '%' + x.charCodeAt(0).toString(16).toUpperCase());
  });
}

export function shareHash(hash) {
  if (typeof window === 'undefined' || window.parent === window) return;
  try { window.parent.postMessage({ type: 'ss-hash', hash: viewerHash(hash) }, '*'); } catch (e) { /* no parent to tell */ }
}
