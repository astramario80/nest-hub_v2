import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('a signed-in user is not shown a login prompt when a tracker request fails', async () => {
  const dom = new JSDOM(fs.readFileSync('trip-o-meter.html', 'utf8'), { runScripts: 'outside-only', url: 'https://gknest.org/trip-o-meter' });
  const { window: w } = dom;
  w.AbortSignal = AbortSignal;
  w.NestAuth = { identity: { username: 'teacher' }, ready: Promise.resolve(), refresh: async () => w.NestAuth.identity, open() {} };
  w.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'Sign in to NEST to continue.' }) });
  try {
    w.eval(fs.readFileSync('js/trip-o-meter.js', 'utf8'));
    w.document.querySelector('[data-period="1"]').click();
    await tick();
    assert.equal(w.document.querySelector('[data-login]').hidden, true);
    assert.match(w.document.querySelector('[data-status]').textContent, /could not open this period/i);
  } finally { w.close(); }
});

test('a 30-day session keeps the tracker open instead of overflowing its expiry timer', async () => {
  const dom = new JSDOM(fs.readFileSync('trip-o-meter.html', 'utf8'), { runScripts: 'outside-only', url: 'https://gknest.org/trip-o-meter' });
  const { window: w } = dom;
  w.AbortSignal = AbortSignal;
  w.NestAuth = { identity: { username: 'teacher' }, ready: Promise.resolve(), open() {} };
  w.fetch = async () => ({ ok: true, status: 200, json: async () => ({
    period: '1', role: 'student', revision: 1, expires: Date.now() + 30 * 86400000,
    students: [], assignments: [], scores: {}, completionScores: ['4']
  }) });
  try {
    w.eval(fs.readFileSync('js/trip-o-meter.js', 'utf8'));
    w.document.querySelector('[data-period="1"]').click();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(w.document.querySelector('[data-view]').hidden, false);
    assert.equal(w.document.querySelector('[data-login]').hidden, true);
    assert.match(w.document.querySelector('[data-status]').textContent, /Access until/);
  } finally { w.close(); }
});
