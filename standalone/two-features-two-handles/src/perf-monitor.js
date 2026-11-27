// perf-monitor.js — VSYNC refresh-rate regression, sync state machine, stutter/jitter detector, and sparkline renderer.

/** Display sync and stutter diagnostic states modeled after VSYNC verification tools. */
export const STATUS = Object.freeze({
  SYNCING: Object.freeze({ code: 'SYNCING', label: 'SYNCING', category: 'syncing' }),
  SYNCING_MORE: Object.freeze({ code: 'SYNCING_MORE', label: 'SYNCING MORE', category: 'syncing' }),
  GOOD: Object.freeze({ code: 'GOOD', label: 'READY', category: 'good' }),
  STUTTER_CAUTION: Object.freeze({ code: 'STUTTER_CAUTION', label: 'PERFORMANCE WARNING', category: 'warning' }),
  STUTTER_DETECTED: Object.freeze({ code: 'STUTTER_DETECTED', label: 'STUTTER WARNING', category: 'warning' }),
  STUTTER_MAJOR: Object.freeze({ code: 'STUTTER_MAJOR', label: 'MAJOR STUTTERING', category: 'error' }),
  HIGH_CPU: Object.freeze({ code: 'HIGH_CPU', label: 'HIGH CPU', category: 'warning' }),
  PERFORMANCE: Object.freeze({ code: 'PERFORMANCE', label: 'POOR PERFORMANCE', category: 'error' }),
  SYNCFAIL: Object.freeze({ code: 'SYNCFAIL', label: 'SYNC FAILURE', category: 'error' }),
});

const STANDARD_HZ = new Set([60, 75, 100, 120, 144, 165, 200, 240, 280, 300, 360, 480, 540, 600, 720, 960, 1000]);

const medianOf = (arr) => {
  if (!arr || !arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length & 1 ? s[m] : 0.5 * (s[m - 1] + s[m]);
};

const pctOf = (arr, p) => {
  if (!arr || !arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
};

/**
 * Precision display refresh-rate estimator using tight 5-frame cycle filtering,
 * adaptive timer-quantum bounds, and ordinary least-squares phase regression.
 */
export class RefreshRateCalculator {
  constructor(opts = {}) {
    this.validateMs = opts.validateMs ?? 100;
    this.maxStore = opts.maxStore ?? 240000;
    this.lowestValidHz = opts.lowestValidHz ?? 8;
    this.minAgeMs = opts.minAgeMs ?? 500;
    this.tightGroupMs = opts.tightGroupMs ?? 4;
    this.tightGroupPerc = opts.tightGroupPerc ?? 0.2;
    this.msChange = opts.msChange ?? 4;
    this.msChangePerc = opts.msChangePerc ?? 0.2;
    this.warmupCycles = opts.warmupCycles ?? 20;
    this.nowFn = opts.nowFn || (() => performance.now());
    this._timerQuantum = opts.timerQuantum ?? 0;
    this._warmupLeft = this.warmupCycles;
    this._intervalLP = 0;
    this.reset('init');
  }

  /** Reset accumulated phase samples while optionally retaining calibrated timer quantum. */
  reset(reason = '') {
    this._lastResetReason = reason;
    this._cycleCount = 0;
    this._seen = 0;
    this._nSkipBase = 0;
    this._nSkip = 0;
    this._tUpdate = -Infinity;
    this._L0 = this._L1 = this._L2 = this._L3 = this._L4 = null;
    this._D = [];
    this._S = [];
    this._periodMs = 0;
    this._validated = false;
    this._drift = null;
    this._tvsync = 0;
    this._sumMs = 0;
    this._nMs = 0;
    this._nChange = 0;
    this._lastHz = 0;
    this._firstDetectHz = 0;
    this._firstDetectTs = 0;
    this._intervalLP = 0;
    this._warmupLeft = Math.min(this._warmupLeft, 5);
  }

  /** Skip the next `count` samples (e.g. across a known stutter cycle). */
  ignoreNextCycle(count = 1) {
    this._nSkip = Math.max(this._nSkip, count);
  }

  /** Measure or return the finest positive clock step of `nowFn` in ms. */
  getTimerQuantum() {
    if (this._timerQuantum > 0) return this._timerQuantum;
    try {
      const steps = [];
      const t0 = this.nowFn();
      let prev = t0;
      while (steps.length < 100 && prev - t0 < 2.5) {
        let cur = this.nowFn();
        while (cur === prev && cur - t0 < 2.5) cur = this.nowFn();
        const dt = cur - prev;
        prev = cur;
        if (dt > 0) steps.push(dt);
      }
      if (!steps.length) {
        this._timerQuantum = 1;
        return 1;
      }
      const med = medianOf(steps);
      const filtered = steps.filter((d) => d >= 0.5 * med && d <= 1.5 * med);
      let q = filtered.length ? Math.min(...filtered) : Math.min(...steps);
      if (!Number.isFinite(q) || q <= 0) q = 1;
      q = Math.max(0.005, Math.min(1, q));
      this._timerQuantum = 0.001 * Math.round(q / 0.001);
      return this._timerQuantum;
    } catch {
      this._timerQuantum = 1;
      return 1;
    }
  }

  getMaxHzDetectPossible() {
    return 1000 / this.getTimerQuantum() / 2;
  }

  _getUnverifiedInterval() {
    if (this._nMs > 0) return this._sumMs / this._nMs;
    const ds = [];
    if (this._L4 !== null && this._L3 !== null) ds.push(this._L4 - this._L3);
    if (this._L3 !== null && this._L2 !== null) ds.push(this._L3 - this._L2);
    if (this._L2 !== null && this._L1 !== null) ds.push(this._L2 - this._L1);
    if (this._L1 !== null && this._L0 !== null) ds.push(this._L1 - this._L0);
    return ds.length ? medianOf(ds) : 0;
  }

  getUnverifiedFrequency() {
    const iv = this._getUnverifiedInterval();
    return iv > 0 ? 1000 / iv : 0;
  }

  _computeThresholds() {
    const iv = this._getUnverifiedInterval();
    if (iv > 0) this._intervalLP = this._intervalLP ? 0.8 * this._intervalLP + 0.2 * iv : iv;
    const ref = this._intervalLP || iv || this._periodMs || 0;
    const q = this.getTimerQuantum();
    let tight = ref > 0 ? Math.min(this.tightGroupMs, ref * this.tightGroupPerc) : this.tightGroupMs;
    let change = ref > 0 ? Math.min(this.msChange, ref * this.msChangePerc) : this.msChange;
    if (q > 0) {
      if (tight < q) tight = q;
      if (change < q) change = q;
    }
    return { tight, change };
  }

  _decimate() {
    const dNext = [], sNext = [];
    for (let i = 0; i < this._D.length; i += 2) {
      dNext.push(this._D[i]);
      sNext.push(this._S[i]);
    }
    this._D = dNext;
    this._S = sNext;
    this._nSkipBase = 2 * this._nSkipBase + 1;
  }

  _validate() {
    const n = this._D.length;
    if (n < 3 || !this._periodMs) return false;
    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, cyc = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) cyc += Math.round((this._S[i] - this._S[i - 1]) / this._periodMs);
      const y = this._D[i] - this._D[0];
      sumX += cyc;
      sumY += y;
      sumXX += cyc * cyc;
      sumXY += cyc * y;
    }
    const denom = n * sumXX - sumX * sumX;
    if (denom <= 0) return false;
    const slope = (n * sumXY - sumX * sumY) / denom;
    if (!(slope > 0) || slope >= 1000 / this.lowestValidHz) return false;
    const intercept = (sumXX * sumY - sumX * sumXY) / denom;
    this._periodMs = slope;
    const anchor = this._D[0] + intercept;
    const half = slope * 0.5;
    let driftMax = 0, driftMin = 0;
    for (let i = 1; i < n; i++) {
      const r = (((this._D[i] - anchor + half) % slope) + slope) % slope - half;
      if (r < driftMin) driftMin = r;
      if (r > driftMax) driftMax = r;
    }
    if (driftMax - driftMin < half) {
      this._tvsync = anchor + driftMin;
      this._drift = { min: driftMin, max: driftMax };
      this._validated = true;
      return true;
    }
    this.reset('Excessive Hz drift');
    return false;
  }

  /** Record one animation frame timestamp in milliseconds. */
  countCycle(ts) {
    const t = ts ?? this.nowFn();
    this._cycleCount++;
    this._L0 = this._L1;
    this._L1 = this._L2;
    this._L2 = this._L3;
    this._L3 = this._L4;
    this._L4 = t;
    this._seen++;
    if (this._seen < 5) return;

    const d0 = this._L1 - this._L0;
    const d1 = this._L2 - this._L1;
    const d2 = this._L3 - this._L2;
    const d3 = this._L4 - this._L3;
    const span = Math.max(d0, d1, d2, d3) - Math.min(d0, d1, d2, d3);
    const { tight, change } = this._computeThresholds();

    const warmupDone = --this._warmupLeft < 0;
    const skipDone = --this._nSkip < 0;
    if (span < tight && warmupDone && skipDone) {
      const dt4 = (this._L4 - this._L0) / 4;
      if (dt4 > 0 && dt4 < 1000 / this.lowestValidHz) {
        const meanMs = this._nMs > 0 ? this._sumMs / this._nMs : 0;
        const shifted = this._nMs > 10 && Math.abs(dt4 - meanMs) > change;
        this._nChange = shifted ? this._nChange + 1 : 0;
        if (!shifted) {
          this._sumMs += dt4;
          this._nMs++;
          if (!this._periodMs && this._nMs > Math.max(24, Math.round(60 * span))) {
            this._periodMs = this._sumMs / this._nMs;
            const hzInit = 1000 / this._periodMs;
            this._lastHz = hzInit;
            if (!this._firstDetectTs) {
              this._firstDetectHz = hzInit;
              this._firstDetectTs = t;
            }
          }
        }
        if (this._nChange > 20) {
          this.reset(`Change in Hz detected ${meanMs.toFixed(3)} -> ${dt4.toFixed(3)}`);
          return;
        }
        if (this._D.length >= this.maxStore) this._decimate();
        this._D.push(this._L2);
        this._S.push((this._L0 + this._L1 + this._L2 + this._L3 + this._L4) / 5);
        this._nSkip = this._nSkipBase;
        if (this._periodMs && t - this._tUpdate >= this.validateMs) {
          this._tUpdate = t;
          this._validate();
        }
      }
    }
  }

  getCurrentFrequency() {
    if (!this._periodMs) return 0;
    const hz = 1000 / this._periodMs;
    return hz > this.getMaxHzDetectPossible() ? 0 : hz;
  }

  getFilteredHz(now = this.nowFn(), minAge = this.minAgeMs) {
    const hz = this.getCurrentFrequency();
    if (!hz) {
      this._lastHz = 0;
      return 0;
    }
    if (!this._lastHz) {
      this._lastHz = hz;
      this._firstDetectHz = hz;
      this._firstDetectTs = now;
      return minAge <= 0 ? hz : 0;
    }
    this._lastHz = hz;
    return now - this._firstDetectTs >= minAge ? hz : 0;
  }

  getAgeOfDetect(now = this.nowFn()) {
    return this._lastHz ? Math.max(0, now - this._firstDetectTs) : 0;
  }

  getDrift() {
    return this._drift ? { min: this._drift.min, max: this._drift.max } : null;
  }

  getSampleCount() {
    return this._D.length;
  }

  getVsyncOffset(t = this.nowFn()) {
    if (!this._validated || !this._periodMs) return 0;
    return (((t - this._tvsync + 2) % this._periodMs) + this._periodMs) % this._periodMs - 2;
  }

  getScanoutPct(t = this.nowFn()) {
    if (!this._validated || !this._periodMs) return 0;
    let dt = t - this._tvsync;
    while (dt < 0) dt += this._periodMs;
    return (dt % this._periodMs) / this._periodMs;
  }
}

/**
 * Combines frame cadence / stutter classification, refresh-rate locking,
 * input-to-render latency tracking, and WebGL GPU timer query aggregation.
 */
export class SyncJitterMonitor {
  constructor(opts = {}) {
    this.maxHistory = opts.maxHistory ?? 240;
    this.minGoodHz = opts.minGoodHz ?? 48;
    this.fpsMin = opts.fpsMin ?? 15;
    this.fpsRecovery = opts.fpsRecovery ?? 20;
    this.cpuConsumeLimitMs = opts.cpuConsumeLimitMs ?? 700;
    this.syncFailSeconds = opts.syncFailSeconds ?? 12;
    this.hertz = new RefreshRateCalculator(opts);
    this.reset();
  }

  reset(reason = 'Initializing...', hard = true) {
    if (hard) this.hertz.reset(reason);
    this.status = STATUS.SYNCING;
    this.message = reason;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsDecimal = 0;
    this.refreshRate = 0;
    this.refreshDisplayed = 0;
    this.goodSeconds = 0;
    this.syncSeconds = 0;
    this.fpsSync = 0;
    this.frameStart = 0;
    this.prevFrameStart = 0;
    this.lastDt = 0;
    this.idealMs = 16.6667;
    this.jitterMs = 0;
    this.lastRenderMs = 0;
    this.lastRafLatencyMs = 0;
    this.lastInputLatencyMs = null;
    this.lastGpuMs = null;
    this.lastScale = 1;
    this.pendingInputTs = null;
    this.lastSecondTs = 0;
    this.secCount = 0;
    this.frameTimeTotal = 0;
    this.jitterCount = 0;
    this.jitterProblem = 0;
    this.jitterAmountTotal = 0;
    this.jitterMajor = 0;
    this.largeNegCount = 0;
    this.largePosCount = 0;
    this.largeNegTotal = 0;
    this.largePosTotal = 0;
    this.totalStutters = 0;
    this.totalDroppedFrames = 0;
    this.fpsHistory = [];
    this.cpuHistory = [];
    this.gpuHistory = [];
    this.rafLatHistory = [];
    this.inputLatHistory = [];
    this.renderHistory = [];
    this.history = [];
    this.stutterEvents = [];
    this._resyncMode = null;
    this._resyncMsg = '';
    this._browserFroze = false;
    this._browserMoved = false;
  }

  resync(reason = 'Resynchronizing...', hard = true) {
    this._resyncMode = hard ? 'hard' : 'soft';
    this._resyncMsg = reason;
    this.goodSeconds = 0;
    this.status = STATUS.SYNCING;
    this.message = reason;
    if (hard) this.hertz.reset(reason);
    else this.hertz.ignoreNextCycle(2);
  }

  onResize() {
    this._browserMoved = true;
    this.resync('Window resize detected, resynchronizing...', true);
  }

  onVisibilityChange(hidden) {
    if (hidden) {
      this._browserFroze = true;
      this.resync('Tab hidden, paused sync...', true);
    } else {
      this.resync('Tab visible, resynchronizing...', true);
    }
  }

  /** Record user input timestamp for next-frame input-to-render latency measurement. */
  recordInput(eventTs, now = performance.now()) {
    if (Number.isFinite(eventTs) && eventTs > 0 && now >= eventTs && now - eventTs < 500) {
      this.pendingInputTs = eventTs;
    } else {
      this.pendingInputTs = now;
    }
  }

  /** Mark start of animation callback; captures frame delta and rAF/input queue latency. */
  beginFrame(now, rafTs = now) {
    this.prevFrameStart = this.frameStart;
    this.frameStart = now;
    this.lastDt = this.prevFrameStart > 0 ? Math.max(0, now - this.prevFrameStart) : 0;
    const rafLat = Number.isFinite(rafTs) && rafTs > 0 && now >= rafTs && now - rafTs < 250 ? now - rafTs : 0;
    this.lastRafLatencyMs = rafLat;
    this.rafLatHistory.push(rafLat);
    if (this.rafLatHistory.length > 60) this.rafLatHistory.shift();
    if (this.pendingInputTs !== null) {
      const il = now - this.pendingInputTs;
      this.pendingInputTs = null;
      if (il >= 0 && il < 500) {
        this.lastInputLatencyMs = il;
        this.inputLatHistory.push(il);
        if (this.inputLatHistory.length > 60) this.inputLatHistory.shift();
      }
    }
  }

  _preferredLookbehind(hz) {
    if (STANDARD_HZ.has(hz)) return 2;
    return hz < 58 || hz > 250 ? 5 : 3;
  }

  _varianceOfFPS(lookbehind) {
    const n = Math.min(lookbehind, this.fpsHistory.length);
    if (!n) return 999;
    let lo = Infinity, hi = -Infinity;
    for (let i = this.fpsHistory.length - n; i < this.fpsHistory.length; i++) {
      const v = this.fpsHistory[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return hi - lo;
  }

  _avgCpu(n) {
    if (!this.cpuHistory.length) return 0;
    const k = Math.min(n, this.cpuHistory.length);
    let sum = 0;
    for (let i = this.cpuHistory.length - k; i < this.cpuHistory.length; i++) sum += this.cpuHistory[i];
    return sum / k;
  }

  _isSyncingOrError() {
    return this.status === STATUS.SYNCING
      || this.status === STATUS.SYNCING_MORE
      || this.status === STATUS.SYNCFAIL
      || this.status === STATUS.PERFORMANCE
      || this.status === STATUS.HIGH_CPU;
  }

  /** Finish frame timing, evaluate jitter/stutter state, and run 1-second VSYNC verification. */
  endFrame(nowEnd, { gpuSamples = [], glScale = 1 } = {}) {
    this.frameCount++;
    this.lastScale = glScale;
    for (let i = 0; i < gpuSamples.length; i++) {
      const g = gpuSamples[i];
      if (Number.isFinite(g) && g > 0 && g < 500) {
        this.lastGpuMs = g;
        this.gpuHistory.push(g);
        if (this.gpuHistory.length > 60) this.gpuHistory.shift();
      }
    }

    const renderMs = Math.max(0, nowEnd - this.frameStart);
    this.lastRenderMs = renderMs;
    this.renderHistory.push(renderMs);
    if (this.renderHistory.length > 60) this.renderHistory.shift();
    this.frameTimeTotal += renderMs;

    const dt = this.lastDt;
    const olsHz = this.hertz.getCurrentFrequency();
    const unverifiedHz = this.hertz.getUnverifiedFrequency();
    const estHz = olsHz > 0 ? olsHz : (this.fpsDecimal > 1 ? this.fpsDecimal : unverifiedHz);
    const idealMs = estHz > 0 ? 1000 / estHz : 16.6667;
    this.idealMs = idealMs;

    const jitterMs = dt > 0 && estHz > 0 ? dt - idealMs : 0;
    this.jitterMs = jitterMs;
    if (estHz > 0 && Math.abs(jitterMs) >= 1) {
      if (jitterMs < 0) { this.largeNegCount++; this.largeNegTotal += -jitterMs; }
      else { this.largePosCount++; this.largePosTotal += jitterMs; }
    }

    let isStutter = false;
    const paused = (this.fps > 0 && this.fps <= this.fpsMin && this.frameCount > 30 && dt > 250)
      || (dt > 0 && Math.abs(dt - idealMs) > 200)
      || (this.lastSecondTs > 0 && this.frameStart - this.lastSecondTs >= 1500);

    if (paused && this.frameCount > 2) {
      if (!this._browserFroze || !this._browserMoved) {
        this._browserFroze = true;
        this.resync('Browser pause detected, resynchronizing...', true);
      }
    } else if (dt > 0 && this.fps > 0 && estHz > 0 && Math.abs(jitterMs) > idealMs * 0.5) {
      isStutter = true;
      const ratio = Math.abs(jitterMs) / idealMs;
      const missed = Math.max(1, Math.round(dt / idealMs) - 1);
      this.jitterAmountTotal += ratio;
      if (ratio > 1) this.jitterMajor += ratio;
      this.jitterCount++;
      this.totalStutters++;
      this.totalDroppedFrames += missed;
      this.jitterProblem++;
      this.goodSeconds = 0;
      this.hertz.ignoreNextCycle(1);
      this.stutterEvents.push({ t: this.frameStart, dt, idealMs, jitterMs, missed });
      if (this.stutterEvents.length > 20) this.stutterEvents.shift();

      if (!this._isSyncingOrError() && !this._resyncMode) {
        if (this.jitterProblem <= 10 && this.jitterCount <= 10 && ratio <= 1 && this.jitterAmountTotal / this.jitterCount < 1) {
          this.status = STATUS.STUTTER_CAUTION;
          this.message = `Performance warning (${this.jitterCount})`;
        } else if (this.jitterCount <= 10 && this.jitterProblem <= 10) {
          this.status = STATUS.STUTTER_DETECTED;
          this.message = `Stutter detected (${this.totalStutters})`;
        } else {
          this.status = STATUS.STUTTER_MAJOR;
          this.message = `Major stuttering (${this.totalStutters})`;
        }
      }
    } else if (this.jitterProblem > 0) {
      this.jitterProblem--;
    }

    if (!paused) this.hertz.countCycle(this.frameStart);

    this.history.push({
      t: this.frameStart,
      dt,
      idealMs,
      jitterMs,
      renderMs,
      gpuMs: this.lastGpuMs,
      rafLatencyMs: this.lastRafLatencyMs,
      stutter: isStutter,
      glScale,
    });
    if (this.history.length > this.maxHistory) this.history.shift();

    if (this._resyncMode) {
      const hard = this._resyncMode === 'hard';
      this._resyncMode = null;
      this.syncSeconds = 0;
      this.status = STATUS.SYNCING;
      if (this._resyncMsg) this.message = this._resyncMsg;
      if (hard) {
        this.fpsSync = 0;
        this.secCount = 0;
        this.lastSecondTs = this.frameStart;
        this.jitterCount = 0;
        this.jitterProblem = 0;
        this.jitterAmountTotal = 0;
        this.jitterMajor = 0;
        this.largeNegCount = this.largePosCount = 0;
        this.largeNegTotal = this.largePosTotal = 0;
        this.frameTimeTotal = 0;
        return;
      }
    }

    if (this.lastSecondTs === 0) {
      this.lastSecondTs = this.frameStart;
      this.secCount = 1;
      return;
    }

    this.secCount++;
    const elapsed = this.frameStart - this.lastSecondTs;
    if (elapsed >= 1000) {
      const measuredFps = this.secCount * (1000 / elapsed);
      this.fpsDecimal = measuredFps;
      this.fps = Math.round(measuredFps);
      this.fpsHistory.push(0 | this.fps);
      this.cpuHistory.push(Math.round(this.frameTimeTotal));
      if (this.fpsHistory.length > 30) this.fpsHistory.shift();
      if (this.cpuHistory.length > 30) this.cpuHistory.shift();

      this.fpsSync++;
      this.syncSeconds++;
      const avgNeg = this.largeNegCount > 0 ? this.largeNegTotal / this.largeNegCount : 0;
      const avgPos = this.largePosCount > 0 ? this.largePosTotal / this.largePosCount : 0;

      let canLock = this.jitterCount === 0 && measuredFps >= this.fpsMin;
      if (avgPos > 1.5 && 3 * avgPos < avgNeg) {
        canLock = false;
        this.resync('Unusual stuttering detected, resynchronizing...', false);
      } else if (this.jitterCount === 0 && this.refreshDisplayed > 0 && Math.abs(this.refreshDisplayed - Math.round(measuredFps)) >= 2) {
        canLock = false;
        this.refreshDisplayed = 0;
        this.resync('Framerate changed, resynchronizing...', true);
      } else if (this._avgCpu(3) > this.cpuConsumeLimitMs) {
        canLock = false;
        this.status = STATUS.HIGH_CPU;
        this.message = 'High CPU frame render time';
      } else if (this.fps < this.fpsMin && !this._browserFroze) {
        canLock = false;
        this.status = STATUS.PERFORMANCE;
        this.message = 'Low frame rate (<15 FPS)';
      } else if (this.status === STATUS.PERFORMANCE && this.fps <= this.fpsRecovery) {
        canLock = false;
      } else if ((this.status === STATUS.SYNCING || this.status === STATUS.SYNCING_MORE) && this.syncSeconds > this.syncFailSeconds) {
        canLock = false;
        this.status = STATUS.SYNCFAIL;
        this.message = this.fps < 48 ? 'Low framerate or unstable VSYNC' : 'Unable to lock VSYNC';
      }

      if (canLock) {
        const olsNow = this.hertz.getFilteredHz(this.frameStart, 200);
        this.refreshRate = Math.round(olsNow > 0 ? olsNow : measuredFps);
        this.goodSeconds++;
        const lookbehind = this._preferredLookbehind(this.refreshRate);
        if (this.goodSeconds >= lookbehind && this._varianceOfFPS(lookbehind) <= 1) {
          this._browserMoved = false;
          this._browserFroze = false;
          this.refreshDisplayed = this.refreshRate;
          this.status = STATUS.GOOD;
          this.message = 'VSYNC locked';
        }
      } else {
        this.goodSeconds = 0;
      }

      this.lastSecondTs = this.frameStart;
      this.secCount = 0;
      this.jitterMajor = 0;
      this.jitterCount = 0;
      this.jitterAmountTotal = 0;
      this.largeNegCount = this.largePosCount = 0;
      this.largeNegTotal = this.largePosTotal = 0;
      this.frameTimeTotal = 0;
    }
  }

  /** Return immutable snapshot of current refresh-rate, stutter, latency, and GPU metrics. */
  snapshot() {
    const now = this.frameStart || this.hertz.nowFn();
    const filteredHz = this.hertz.getFilteredHz(now, this.hertz.minAgeMs);
    const hz = filteredHz > 0 ? filteredHz : this.hertz.getCurrentFrequency();
    const recentJitters = this.history.slice(-120).filter((f) => f.dt > 0).map((f) => Math.abs(f.jitterMs));
    return {
      status: this.status,
      message: this.message,
      hz,
      hzDisplay: hz > 0 ? `${hz.toFixed(4)} Hz` : 'Calculating…',
      unverifiedHz: this.hertz.getUnverifiedFrequency(),
      refreshDisplayed: this.refreshDisplayed,
      fps: this.fps,
      fpsDecimal: this.fpsDecimal,
      idealMs: this.idealMs,
      dtMs: this.lastDt,
      jitterMs: this.jitterMs,
      jitterP95Ms: pctOf(recentJitters, 0.95) ?? 0,
      jitterMaxMs: recentJitters.length ? Math.max(...recentJitters) : 0,
      stutters: this.totalStutters,
      droppedFrames: this.totalDroppedFrames,
      goodSeconds: this.goodSeconds,
      renderMs: this.lastRenderMs,
      renderP50Ms: pctOf(this.renderHistory, 0.5) ?? 0,
      renderP95Ms: pctOf(this.renderHistory, 0.95) ?? 0,
      rafLatencyMs: this.lastRafLatencyMs,
      rafLatencyP50Ms: pctOf(this.rafLatHistory, 0.5) ?? 0,
      inputLatencyMs: this.lastInputLatencyMs,
      inputLatencyP95Ms: pctOf(this.inputLatHistory, 0.95),
      gpuMs: this.lastGpuMs,
      gpuP50Ms: pctOf(this.gpuHistory, 0.5),
      gpuP95Ms: pctOf(this.gpuHistory, 0.95),
      glScale: this.lastScale,
      drift: this.hertz.getDrift(),
      samples: this.hertz.getSampleCount(),
      frameCount: this.frameCount,
      history: this.history,
    };
  }
}

/** Render live scrolling frame-interval, jitter threshold, GPU time, and CPU render sparkline. */
export function drawJitterGraph(canvas, monitor, dark) {
  if (!canvas || !monitor) return;
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(120, Math.round(rect.width || canvas.clientWidth || 320));
  const H = Math.max(52, Math.round(rect.height || canvas.clientHeight || 68));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const wPx = Math.round(W * dpr), hPx = Math.round(H * dpr);
  if (canvas.width !== wPx || canvas.height !== hPx) {
    canvas.width = wPx;
    canvas.height = hPx;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const hist = monitor.history;
  const ideal = monitor.idealMs > 0 ? monitor.idealMs : 16.6667;
  const yMax = Math.max(ideal * 2.4, 36);
  const yOf = (ms) => H - 3 - (Math.min(ms, yMax) / yMax) * (H - 6);

  // Background guide lines: target idealMs (green) and ±50% stutter thresholds (amber dashed)
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = dark ? 'rgba(240, 168, 48, 0.35)' : 'rgba(180, 110, 0, 0.28)';
  for (const bound of [0.5 * ideal, 1.5 * ideal]) {
    const y = Math.round(yOf(bound)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = dark ? 'rgba(72, 200, 120, 0.45)' : 'rgba(20, 130, 70, 0.35)';
  const yIdeal = Math.round(yOf(ideal)) + 0.5;
  ctx.beginPath();
  ctx.moveTo(0, yIdeal);
  ctx.lineTo(W, yIdeal);
  ctx.stroke();

  if (hist.length) {
    const n = hist.length;
    const step = W / monitor.maxHistory;
    const xOff = (monitor.maxHistory - n) * step;

    for (let i = 0; i < n; i++) {
      const f = hist[i];
      if (!(f.dt > 0)) continue;
      const x = xOff + i * step;
      const y = yOf(f.dt);
      const major = f.dt >= 2 * ideal;
      ctx.fillStyle = major
        ? (dark ? '#ff5c5c' : '#d62828')
        : f.stutter
          ? (dark ? '#f0a830' : '#d97706')
          : (dark ? 'rgba(82, 210, 135, 0.72)' : 'rgba(22, 138, 76, 0.65)');
      ctx.fillRect(x, y, Math.max(1.2, step - 0.5), H - 2 - y);
    }

    // GPU time line (blue)
    let started = false;
    ctx.strokeStyle = dark ? '#56b4e9' : '#0072b2';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const g = hist[i].gpuMs;
      if (g === null || !Number.isFinite(g)) continue;
      const x = xOff + (i + 0.5) * step;
      const y = yOf(g);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    if (started) ctx.stroke();

    // JS render time line (purple)
    ctx.strokeStyle = dark ? '#c084fc' : '#7c3aed';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xOff + (i + 0.5) * step;
      const y = yOf(hist[i].renderMs);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.font = '10px -apple-system, BlinkMacSystemFont, system-ui, monospace';
  ctx.fillStyle = dark ? 'rgba(235, 240, 245, 0.65)' : 'rgba(30, 35, 45, 0.6)';
  ctx.textBaseline = 'top';
  ctx.fillText(`${yMax.toFixed(0)} ms`, 4, 2);
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${ideal.toFixed(1)} ms target`, 4, H - 1);
}
