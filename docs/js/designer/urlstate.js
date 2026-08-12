/* The whole design, in the URL hash.
 *
 * A design has no server behind it, so the hash IS the save file: whatever a
 * reader pastes into a chat message has to rebuild the billiards exactly, and
 * an address bar that has been through two mail clients and a Slack channel
 * is a hostile transport. That fixes three properties.
 *
 *   SHORT.  Every quantity is packed to the bit — the design is a few hundred
 *           bits, not a few hundred bytes of JSON — and the bytes go out as
 *           base64url, whose alphabet no URL escaper and no chat client
 *           rewrites. Four billiards of three breakpoints is ~110 characters.
 *
 *   TOTAL.  decode() never throws. Truncated, mutated and outright random
 *           strings return null, so the page can fall back to its default
 *           design instead of dying on someone else's typo. A 16-bit checksum
 *           over the payload means a mangled hash is overwhelmingly likely to
 *           be REJECTED rather than silently read as a different design —
 *           loading the wrong billiards is the worse failure.
 *
 *   TAGGED. A 4-bit version leads the payload. If the layout below ever
 *           changes, old links are recognised as old rather than misread.
 *
 * The quantisation in LIMITS is the real fidelity of a shared link, and it is
 * deliberately finer than the eye or the mouse: 1/4096 of a period in time,
 * a thousandth of a lattice cell in space. Round-tripping is exact to that
 * grid, not to the float — callers that need bit-identical state must keep
 * their own copy.
 *
 *   encode(state) -> string        base64url, no leading '#'
 *   decode(str)   -> state | null  accepts a leading '#'
 */
"use strict";

/* The group menu, frozen here rather than read from designer-groups.json: a
 * link's meaning must not depend on a data file that may later gain a group.
 * Position in this list is the wire value, so entries may be APPENDED but
 * never reordered or removed. */
const GROUP_IDS = [
  "g225", "g226", "g227", "g234", "g244", "g245",
  "g96", "g97", "g99", "g137", "g139", "g75",
  "g235", "g247", "g248",
];

const VERSION = 1;
const TAU = Math.PI * 2;

/* Field widths, in bits. Their sum times the design size is the hash length,
 * so each is the smallest that still over-serves the interaction:
 *   t     a period is 4096 steps, ~170x finer than a 24-frame scrub
 *   u     +-16 cells at 1/1024 — the editor never leaves the +-8 the spec asks
 *         for, and the extra ring costs one bit
 *   zoom  0.5 px per lattice unit, up to 4095.5
 *   yaw   1/1024 of a turn is a third of a degree, below what a drag resolves
 */
const B_VERSION = 4;
const B_GROUP = 4;
const B_R = 12;
/* One spare bit, written zero and ignored on the way back. Room for the next
 * one-bit mode to appear without a version bump, which is the only kind of
 * change that costs old links nothing. */
const B_RESERVED = 1;
const B_SPAN = 1;
const B_ANGLE = 10;
const B_ZOOM = 13;
const B_NSEEDS = 6;
const B_SEED_COLOR = 3;
const B_NPTS = 6;
const B_T = 12;
const B_U = 15;

const STEP_T = 1 / 4096;
const STEP_U = 1 / 1024;
const STEP_R = 1 / 4096;
const STEP_ZOOM = 0.5;
const STEP_ANGLE = TAU / 1024;

const MAX_SEEDS = (1 << B_NSEEDS) - 1;
const MAX_PTS = (1 << B_NPTS) - 1;
const PALETTE_SIZE = 6;

export const LIMITS = Object.freeze({
  version: VERSION,
  /* every numeric field: quantisation step, and the closed range that survives
   * a round trip (encode CLAMPS to it rather than failing) */
  t: { step: STEP_T, min: 0, max: 1 - STEP_T, bits: B_T },
  u: { step: STEP_U, min: -16, max: 16 - STEP_U, bits: B_U },
  r: { step: STEP_R, min: 0, max: 1 - STEP_R, bits: B_R },
  yaw: { step: STEP_ANGLE, min: 0, max: TAU - STEP_ANGLE, bits: B_ANGLE, wraps: true },
  pitch: { step: STEP_ANGLE, min: -Math.PI, max: Math.PI - STEP_ANGLE, bits: B_ANGLE, wraps: true },
  zoom: { step: STEP_ZOOM, min: 0, max: STEP_ZOOM * ((1 << B_ZOOM) - 1), bits: B_ZOOM },
  span: { values: [1, 2] },
  seedColor: { min: 0, max: PALETTE_SIZE - 1 },
  seeds: { min: 0, max: MAX_SEEDS },
  points: { min: 1, max: MAX_PTS },
  groups: Object.freeze(GROUP_IDS.slice()),
});

/* ---- bit stream ---------------------------------------------------------- */

class BitWriter {
  constructor() {
    this.bytes = [];
    this.acc = 0;
    this.n = 0;
  }
  put(value, bits) {
    // two's complement for negatives; values are always < 2^31 so | is safe
    let v = value & ((bits === 32 ? 0 : 1 << bits) - 1);
    for (let i = bits - 1; i >= 0; i--) {
      this.acc = (this.acc << 1) | ((v >> i) & 1);
      if (++this.n === 8) { this.bytes.push(this.acc); this.acc = 0; this.n = 0; }
    }
  }
  /* Pad bits are zero and the reader insists on it, so a hash with junk
   * appended to its last byte is rejected. */
  finish() {
    if (this.n > 0) { this.bytes.push(this.acc << (8 - this.n)); this.acc = 0; this.n = 0; }
    return Uint8Array.from(this.bytes);
  }
}

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.pos = 0;                       // in bits
    this.end = bytes.length * 8;
  }
  get left() { return this.end - this.pos; }
  /* Returns null when the stream runs out, so every read site can bail. */
  get(bits) {
    if (this.left < bits) return null;
    let v = 0;
    for (let i = 0; i < bits; i++) {
      const p = this.pos + i;
      v = (v << 1) | ((this.bytes[p >> 3] >> (7 - (p & 7))) & 1);
    }
    this.pos += bits;
    return v >>> 0;
  }
  getSigned(bits) {
    const v = this.get(bits);
    if (v === null) return null;
    return v >= 1 << (bits - 1) ? v - (1 << bits) : v;
  }
  /* True when only zero pad bits remain: catches truncation and padding. */
  atCleanEnd() {
    if (this.left >= 8) return false;
    while (this.pos < this.end) if (this.get(1) !== 0) return false;
    return true;
  }
}

/* ---- base64url ----------------------------------------------------------- */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64INV = (() => {
  const m = new Int8Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) m[B64.charCodeAt(i)] = i;
  return m;
})();

function toBase64url(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = bytes.length - i;
    const b0 = bytes[i], b1 = n > 1 ? bytes[i + 1] : 0, b2 = n > 2 ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    if (n > 1) out += B64[((b1 & 15) << 2) | (b2 >> 6)];
    if (n > 2) out += B64[b2 & 63];
  }
  return out;
}

function fromBase64url(str) {
  const s = str.replace(/=+$/, "");
  if (s.length % 4 === 1) return null;   // no byte count produces this
  const out = new Uint8Array((s.length * 3) >> 2);
  let acc = 0, nbits = 0, k = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const d = c < 128 ? B64INV[c] : -1;
    if (d < 0) return null;
    acc = (acc << 6) | d;
    nbits += 6;
    if (nbits >= 8) { nbits -= 8; out[k++] = (acc >> nbits) & 0xff; }
  }
  if (nbits > 0 && (acc & ((1 << nbits) - 1)) !== 0) return null;  // stray bits
  return out;
}

/* ---- checksum ------------------------------------------------------------ */

/* FNV-1a, folded to 16 bits. Not a hash for security — just enough that a
 * hash which lost a character to a line wrap fails loudly. */
function checksum16(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h >>> 16) ^ (h & 0xffff)) & 0xffff;
}

/* ---- quantisation -------------------------------------------------------- */

const num = (x, fallback) => (typeof x === "number" && isFinite(x) ? x : fallback);
const clampInt = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);
const wrapInt = (n, mod) => ((n % mod) + mod) % mod;

/* ---- encode -------------------------------------------------------------- */

/* Out-of-range input is clamped, not rejected: encode() runs on every edit and
 * a hash is more useful than an exception. Values inside LIMITS are untouched. */
export function encode(state) {
  const s = state && typeof state === "object" ? state : {};
  const w = new BitWriter();

  const gi = GROUP_IDS.indexOf(s.g);
  const view = s.view && typeof s.view === "object" ? s.view : {};

  w.put(VERSION, B_VERSION);
  w.put(gi < 0 ? 0 : gi, B_GROUP);
  w.put(clampInt(Math.round(num(s.r, 0) / STEP_R), 0, (1 << B_R) - 1), B_R);
  w.put(0, B_RESERVED);
  w.put(s.span === 2 ? 1 : 0, B_SPAN);
  w.put(wrapInt(Math.round(num(view.yaw, 0) / STEP_ANGLE), 1 << B_ANGLE), B_ANGLE);
  w.put(wrapInt(Math.round(num(view.pitch, 0) / STEP_ANGLE), 1 << B_ANGLE), B_ANGLE);
  w.put(clampInt(Math.round(num(view.zoom, 0) / STEP_ZOOM), 0, (1 << B_ZOOM) - 1), B_ZOOM);

  /* A seed with no breakpoints is not a billiard, and decode() rejects one —
   * so drop it here rather than mint a hash this module cannot read back, which
   * would cost the reader every OTHER billiard in the design as well. */
  const seeds = (Array.isArray(s.seeds) ? s.seeds : [])
    .filter((sd) => sd && typeof sd === "object" &&
                    Array.isArray(sd.pts) && sd.pts.length > 0)
    .slice(0, MAX_SEEDS);
  w.put(seeds.length, B_NSEEDS);
  for (const seed of seeds) {
    const sd = seed;
    const pts = sd.pts.slice(0, MAX_PTS);
    w.put(clampInt(Math.round(num(sd.c, 0)), 0, PALETTE_SIZE - 1), B_SEED_COLOR);
    w.put(pts.length, B_NPTS);
    for (const pt of pts) {
      const p = pt && typeof pt === "object" ? pt : {};
      const u = Array.isArray(p.u) ? p.u : [];
      /* CLAMPED, not wrapped, unlike the angles: t indexes a sorted breakpoint
       * list and t = 1 is the anchor, not a free instant. A breakpoint in the
       * last 1/8192 of the period wrapped to 0 comes back as a second anchor,
       * and the sort in Design.fromState then reorders the loop into a
       * different design — the silent wrong answer this format exists to
       * avoid. */
      w.put(clampInt(Math.round(num(p.t, 0) / STEP_T), 0, (1 << B_T) - 1), B_T);
      w.put(clampInt(Math.round(num(u[0], 0) / STEP_U), -(1 << (B_U - 1)), (1 << (B_U - 1)) - 1), B_U);
      w.put(clampInt(Math.round(num(u[1], 0) / STEP_U), -(1 << (B_U - 1)), (1 << (B_U - 1)) - 1), B_U);
    }
  }

  const payload = w.finish();
  const c = checksum16(payload);
  const out = new Uint8Array(payload.length + 2);
  out.set(payload, 0);
  out[payload.length] = c >> 8;
  out[payload.length + 1] = c & 0xff;
  return toBase64url(out);
}

/* ---- decode -------------------------------------------------------------- */

export function decode(str) {
  if (typeof str !== "string") return null;
  const s = (str[0] === "#" ? str.slice(1) : str).trim();
  if (s.length === 0) return null;

  const raw = fromBase64url(s);
  if (raw === null || raw.length < 3) return null;

  const payload = raw.subarray(0, raw.length - 2);
  const want = (raw[raw.length - 2] << 8) | raw[raw.length - 1];
  if (checksum16(payload) !== want) return null;

  const r = new BitReader(payload);
  const version = r.get(B_VERSION);
  if (version !== VERSION) return null;

  const gi = r.get(B_GROUP);
  const rq = r.get(B_R);
  const reserved = r.get(B_RESERVED);
  const span = r.get(B_SPAN);
  const yaw = r.get(B_ANGLE);
  const pitch = r.get(B_ANGLE);
  const zoom = r.get(B_ZOOM);
  const nSeeds = r.get(B_NSEEDS);
  // a failed read leaves the cursor put, so a NARROWER field after a wide one
  // can still succeed on a truncated payload — check them all, not just the last
  if (gi === null || rq === null || reserved === null || span === null ||
      yaw === null || pitch === null || zoom === null || nSeeds === null) return null;
  if (gi >= GROUP_IDS.length) return null;

  const seeds = [];
  for (let i = 0; i < nSeeds; i++) {
    const c = r.get(B_SEED_COLOR);
    if (c === null || c >= PALETTE_SIZE) return null;
    const npts = r.get(B_NPTS);
    if (npts === null || npts < 1) return null;
    const pts = [];
    for (let k = 0; k < npts; k++) {
      const t = r.get(B_T);
      const u1 = r.getSigned(B_U);
      const u2 = r.getSigned(B_U);
      if (t === null || u1 === null || u2 === null) return null;
      pts.push({ t: t * STEP_T, u: [u1 * STEP_U, u2 * STEP_U] });
    }
    seeds.push({ c, pts });
  }
  if (!r.atCleanEnd()) return null;

  // pitch is stored as a fraction of a turn; read it back into (-pi, pi]
  const half = 1 << (B_ANGLE - 1);

  return {
    v: VERSION,
    g: GROUP_IDS[gi],
    r: rq * STEP_R,
    span: span ? 2 : 1,
    view: {
      yaw: yaw * STEP_ANGLE,
      pitch: (pitch >= half ? pitch - (1 << B_ANGLE) : pitch) * STEP_ANGLE,
      zoom: zoom * STEP_ZOOM,
    },
    seeds,
  };
}
