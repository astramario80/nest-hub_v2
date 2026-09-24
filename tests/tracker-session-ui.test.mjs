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
