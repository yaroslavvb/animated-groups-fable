import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS, RefreshRateCalculator, SyncJitterMonitor } from '../src/perf-monitor.js';

test('RefreshRateCalculator recovers 60 Hz, 59.94 Hz, and 120 Hz to < 0.01 Hz with realistic jitter', () => {
  for (const targetHz of [60, 59.94, 120]) {
    const period = 1000 / targetHz;
    const calc = new RefreshRateCalculator({ warmupCycles: 10, validateMs: 50, timerQuantum: 0.005 });
    let t = 100;
    for (let i = 0; i < 180; i++) {
      // Zero-mean bounded sawtooth phase jitter (±0.15 ms) well within tight grouping threshold
      const noise = ((i % 5) - 2) * 0.06;
      calc.countCycle(t + noise);
      t += period;
    }
    const est = calc.getFilteredHz(t, 200);
    assert.ok(Math.abs(est - targetHz) < 0.01, `expected ~${targetHz} Hz, got ${est}`);
    const drift = calc.getDrift();
    assert.ok(drift && drift.max - drift.min < period * 0.5, 'drift stays within half-frame bound');
    assert.ok(calc.getSampleCount() > 50);
  }
});

test('RefreshRateCalculator adapts across 60 Hz -> 120 Hz switch, ignores stutter cycles, and resets on excessive drift', () => {
  const calc = new RefreshRateCalculator({ warmupCycles: 5, validateMs: 40, timerQuantum: 0.005 });
  let t = 0;
  for (let i = 0; i < 90; i++) {
    calc.countCycle(t);
    t += 1000 / 60;
  }
  assert.ok(Math.abs(calc.getCurrentFrequency() - 60) < 0.05);

  // Inject one skipped cycle (stutter) with ignoreNextCycle: estimate must remain ~60 Hz
  calc.ignoreNextCycle(1);
  t += 1000 / 30;
  calc.countCycle(t);
  for (let i = 0; i < 20; i++) {
    t += 1000 / 60;
    calc.countCycle(t);
  }
  assert.ok(Math.abs(calc.getCurrentFrequency() - 60) < 0.05);

  // Switch cleanly to 120 Hz (> 20 shifted cycles triggers auto-reset and re-lock)
  for (let i = 0; i < 120; i++) {
    t += 1000 / 120;
    calc.countCycle(t);
  }
  const hz120 = calc.getFilteredHz(t, 100);
  assert.ok(Math.abs(hz120 - 120) < 0.05, `expected ~120 Hz after switch, got ${hz120}`);

  // Excessive cumulative drift (> 0.5 * period) resets validator
  const driftCalc = new RefreshRateCalculator({ warmupCycles: 4, validateMs: 20, msChange: 4, timerQuantum: 0.005 });
  let td = 0;
  for (let i = 0; i < 140; i++) {
    // Slewing period gently inside MSCHANGE stays within consecutive threshold until cumulative drift exceeds T/2
    const step = 16.6667 + (i > 45 ? 0.25 : 0);
    driftCalc.countCycle(td);
    td += step;
  }
  assert.equal(driftCalc.getCurrentFrequency() === 0 || driftCalc._lastResetReason.length > 0, true);
});

test('SyncJitterMonitor locks to READY at 60 Hz, flags stutters & MAJOR STUTTERING, HIGH_CPU, freeze, and aggregates latencies', () => {
  const period = 1000 / 60;
  const mon = new SyncJitterMonitor({ warmupCycles: 6, validateMs: 40, timerQuantum: 0.005 });
  let t = 50;

  // 2.5 seconds of clean 60 Hz frames (~150 frames) should lock to STATUS.GOOD ('READY')
  for (let i = 0; i < 155; i++) {
    mon.beginFrame(t, t - 0.8);
    if (i === 10) mon.recordInput(t - 5.2, t);
    mon.endFrame(t + 1.2, { gpuSamples: [2.1, 3.3], glScale: 0.75 });
    t += period;
  }
  let snap = mon.snapshot();
  assert.equal(snap.status.code, STATUS.GOOD.code);
  assert.equal(snap.stutters, 0);
  assert.equal(snap.droppedFrames, 0);
  assert.ok(snap.goodSeconds >= 2);
  assert.ok(Math.abs(snap.hz - 60) < 0.05);
  assert.ok(snap.gpuP50Ms > 2 && snap.gpuP95Ms >= snap.gpuP50Ms);
  assert.ok(snap.inputLatencyP95Ms >= 5);

  // Single 50 ms frame stall -> immediate stutter detection & goodSeconds reset
  t += 50 - period;
  mon.beginFrame(t, t - 1.0);
  mon.endFrame(t + 1.5, { gpuSamples: [2.4], glScale: 0.75 });
  snap = mon.snapshot();
  assert.equal(snap.stutters, 1);
  assert.ok(snap.droppedFrames >= 2);
  assert.equal(snap.goodSeconds, 0);
  assert.notEqual(snap.status.code, STATUS.GOOD.code);

  // Escalate with 12 back-to-back stutters inside one second -> MAJOR STUTTERING
  for (let i = 0; i < 12; i++) {
    t += 48;
    mon.beginFrame(t, t - 0.5);
    mon.endFrame(t + 1.0, { glScale: 0.75 });
  }
  snap = mon.snapshot();
  assert.equal(snap.status.code, STATUS.STUTTER_MAJOR.code);
  assert.ok(snap.stutters >= 13);

  // High CPU usage detection (> 700 ms/s render time over 3s window)
  const cpuMon = new SyncJitterMonitor({ warmupCycles: 6, validateMs: 40, timerQuantum: 0.005 });
  let tc = 10;
  for (let i = 0; i < 240; i++) {
    cpuMon.beginFrame(tc, tc - 0.3);
    cpuMon.endFrame(tc + 13.5, { glScale: 1 });
    tc += period;
  }
  assert.equal(cpuMon.snapshot().status.code, STATUS.HIGH_CPU.code);

  // Pause/freeze detection (> 200 ms gap triggers resync to SYNCING)
  mon.beginFrame(t + 400, t + 400);
  mon.endFrame(t + 401, { glScale: 1 });
  assert.equal(mon.snapshot().status.code, STATUS.SYNCING.code);
});
