// The address told to spacesheep's viewer (src/sharehash.js): only the characters its shell takes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { viewerHash, shareHash } from '../src/sharehash.js';

const VIEWER = /^#[A-Za-z0-9_.=%&/-]*$/;        // spacesheep, packages/app/src/pages/viewer.ts: a fragment outside this is dropped

test('viewerHash: the star of a signature travels as %2A, and comes back', () => {
  assert.equal(viewerHash('#k=*632'), '#k=%2A632');
  assert.equal(viewerHash('#sym&k=2*22'), '#sym&k=2%2A22');
  assert.equal(decodeURIComponent(viewerHash('#k=*632').slice(3)), '*632');
});

test('viewerHash: what the viewer already takes is left alone', () => {
  for (const h of ['#', '#tutorial', '#k=o632', '#prove&k=square', '#zip&kind=cap&st=3', '#sym&k=%2A632', '#a/b-c_d.e']) assert.equal(viewerHash(h), h);
  assert.equal(viewerHash('tutorial'), '#tutorial');
  assert.equal(viewerHash(''), '#');
});

test('viewerHash: every result is a fragment the viewer takes', () => {
  const nasty = ['#k=*x', "#q=!'()~*", '#z=1,2,3', '#a b', '#k=\u221732', '#e=\u{1F9F5}', '#s=<script>', '#p=a+b?c:d;e@f$g', '#h=#', '#u=\ud83d'];
  for (const h of nasty) assert.match(viewerHash(h), VIEWER, h);
  assert.equal(viewerHash("#q=!'()~*"), '#q=%21%27%28%29%7E%2A');
  assert.equal(viewerHash('#z=1,2,3'), '#z=1%2C2%2C3');
  assert.equal(viewerHash('#e=\u{1F9F5}'), '#e=%F0%9F%A7%B5');
  assert.equal(viewerHash('#u=\ud83d'), '#u=');                    // half of a pair: left out, not thrown
});

test('shareHash: outside a browser frame it says nothing and does not throw', () => {
  assert.doesNotThrow(() => shareHash('#k=*632'));
});
