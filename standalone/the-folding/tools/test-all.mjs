#!/usr/bin/env node
// test-all.mjs — run the test suite on another machine (a lab box or the mini, through ~/git0/flush-util/run_remote,
// memory- and time-capped), on exactly the files of THIS workspace: src/, test/, tools/ and package.json are sent as a
// tar stream on stdin and unpacked into a temporary directory that is removed afterwards.
//
//   node tools/test-all.mjs                         the whole suite
//   node tools/test-all.mjs test/hinge.test.js      some files (paths relative to the workspace)
//   FOLDING_TESTS=local node tools/test-all.mjs     on this Mac instead (holds the one machine-wide 'suite' slot,
//                                                   node --test --test-concurrency=2)
//   FOLDING_TEST_HOST=mini|aifoundry1|auto          where (default auto: the host with the most free memory, lab first)
// Environment variables your tests read (FOLDS_SEEDS, CORE_SALT, ANCHOR_SEEDS, VR_SALT, ...: every process.env.NAME in
// test/*.js) are passed along when they are set here.
// Exit code = the suite's. If no remote host can run it, it falls back to this Mac.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { acquireSlot } from './chrome-slot.mjs';

// A bare `node --test` matches this file (Node's default pattern **/test-*.mjs) and runs it as a test: do nothing then.
if (process.env.NODE_TEST_CONTEXT) process.exit(0);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// explicit pattern (expanded by node itself), so nothing outside test/ is ever picked up
const args = process.argv.slice(2).length ? process.argv.slice(2) : ['test/**/*.test.js'];
// FOLDING_RUN_REMOTE: another run_remote (a stand-in that exits 3 tests the fallback: dev/final-fix/fake-run-remote.sh)
const RUN_REMOTE = process.env.FOLDING_RUN_REMOTE || path.join(os.homedir(), 'git0/flush-util/run_remote');
const host = process.env.FOLDING_TEST_HOST || 'auto';

function runLocal() {
  return acquireSlot('suite').then((release) => new Promise((resolve) => {
    console.error('[test-all] running on this Mac (2 workers)');
    const child = spawn(process.execPath, ['--test', '--test-concurrency=2', '--test-reporter=spec', ...args], { cwd: root, stdio: 'inherit' });
    child.on('exit', (code) => { release(); resolve(code === null ? 1 : code); });
  }));
}

/**
 * The knobs the tests read: every process.env.NAME in test/*.js (so a new knob needs no edit here; until the final fix
 * of 10 Nov a fixed list of prefixes dropped ANCHOR_SEEDS and VR_*), plus the old prefixes; never this tool's own
 * settings, the browser's, or the opt-in browser layout test's (SHELL_LAYOUT runs on this Mac only).
 */
function testKnobs() {
  const names = new Set();
  try {
    for (const f of fs.readdirSync(path.join(root, 'test'))) {
      if (!f.endsWith('.js')) continue;
      for (const m of fs.readFileSync(path.join(root, 'test', f), 'utf8').matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) names.add(m[1]);
    }
  } catch { /* no test/ folder: the prefixes alone */ }
  const machinery = /^(NODE_|FOLDING_|CHROME_|PLAYWRIGHT_|SHELL_LAYOUT)/;
  return Object.entries(process.env).filter(([k]) => !machinery.test(k) && (names.has(k) || /^(FOLDS_|CORE_|VERIFY_|HINGE_|ROLL_|CROSSCAP_|SNOW|PLANE_|APP_|ANCHOR_|VR_)/.test(k)));
}

function runRemote() {
  // pass along the knobs the tests read
  const env = testKnobs();
  const envArgs = env.map(([k, v]) => `${k}=${v}`);
  if (envArgs.length) console.error('[test-all] passing ' + env.map(([k]) => k).join(' '));
  const script = [
    'set -e',
    'd=$(mktemp -d "${TMPDIR:-/tmp}/folding-test.XXXXXX")',
    'trap \'rm -rf "$d"\' EXIT',
    'tar -xzf - -C "$d"',
    'cd "$d"',
    'NODE=""; for n in "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" /opt/homebrew/bin/node /usr/local/bin/node "$(command -v node || true)"; do if [ -n "$n" ] && [ -x "$n" ] && "$n" --version >/dev/null 2>&1; then NODE="$n"; break; fi; done',
    'C=$(( $(getconf _NPROCESSORS_ONLN) / 2 )); [ "$C" -lt 2 ] && C=2; [ "$C" -gt 8 ] && C=8',
    'echo "[test-all] $(hostname -s): node $("$NODE" --version), $C workers" >&2',
    'set -f', // no shell globbing: node expands the patterns itself
    'env "$@" "$NODE" --test --test-concurrency=$C --test-reporter=spec $TESTS',
  ].join('\n');
  return new Promise((resolve) => {
    const tar = spawn('tar', ['-cz', '--no-mac-metadata', '--exclude', 'tools/.mini-pool.json', '-C', root, 'src', 'test', 'tools', 'package.json'],
      { env: { ...process.env, COPYFILE_DISABLE: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
    const rr = spawn(RUN_REMOTE, ['--host', host, '--max-gb', '6', '--timeout', '1200', '--',
      'env', 'TESTS=' + args.join(' '), 'bash', '-c', script, 'bash', ...envArgs], { stdio: ['pipe', 'inherit', 'pipe'] });
    let err = '';
    rr.stderr.on('data', (d) => { err += d; process.stderr.write(d); });
    // run_remote may exit before it has read the whole tar stream (no host has room: exit 3); the write then fails with
    // EPIPE, which must not crash this process (before the final fix it did, with exit 1 and no test output) but lead
    // to the exit code below and the fallback
    const ignore = () => {};
    rr.stdin.on('error', ignore); tar.stdout.on('error', ignore); tar.on('error', ignore);
    tar.stdout.pipe(rr.stdin);
    rr.on('error', (e) => resolve({ infra: true, why: String(e.message) }));
    rr.on('exit', (code) => {
      // run_remote: 2 = usage / refused host, 3 = no host has room; ssh: 255 = connection failure
      if (code === 2 || code === 3 || code === 255 || code === null) resolve({ infra: true, why: 'exit ' + code + ' ' + err.trim().split('\n').pop() });
      else resolve({ code });
    });
  });
}

let code;
if (process.env.FOLDING_TESTS === 'local') code = await runLocal();
else {
  const r = await runRemote();
  if (r.infra) {
    console.error('[test-all] remote run unavailable (' + r.why.slice(0, 200) + '); running here instead');
    code = await runLocal();
  } else code = r.code;
}
process.exit(code);
