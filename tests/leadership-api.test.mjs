import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/leadership.mjs';

const session = 'c'.repeat(64);
const response = () => ({
  statusCode: 200, headers: {}, body: null,
  setHeader(name, value) { this.headers[name] = value; return this; },
  status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; }
});

test('unsigned and expired sessions cannot receive names or district emails', async () => {
  const oldFetch = globalThis.fetch, oldUrl = process.env.SPINNER_BRIDGE_URL, oldToken = process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL = 'https://script.google.com/macros/s/example/exec';
  process.env.SPINNER_BRIDGE_TOKEN = 'test-token';
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => ({ status: 401 }) }; };
  try {
    let res = response();await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 401);assert.equal(calls, 0);
    res = response();await handler({ method: 'GET', headers: { cookie: '__Host-nest-auth=' + session } }, res);
    assert.equal(res.statusCode, 401);assert.equal(calls, 1);
    assert.equal(res.headers['Vercel-CDN-Cache-Control'], 'no-store');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SPINNER_BRIDGE_URL; else process.env.SPINNER_BRIDGE_URL = oldUrl;
    if (oldToken === undefined) delete process.env.SPINNER_BRIDGE_TOKEN; else process.env.SPINNER_BRIDGE_TOKEN = oldToken;
  }
});

test('active NEST session receives only directory fields with no shared caching', async () => {
  const oldFetch = globalThis.fetch, oldUrl = process.env.SPINNER_BRIDGE_URL, oldToken = process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL = 'https://script.google.com/macros/s/example/exec';
  process.env.SPINNER_BRIDGE_TOKEN = 'test-token';
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).action, 'auth-leadership-directory');
    assert.equal(JSON.parse(options.body).session, session);
    return { ok: true, status: 200, json: async () => ({ status: 200, leaders: [{ division: 'Period 1', position: 'Division Manager', firstName: 'Alex', lastName: 'Example', email: 'alex@students.bethelsd.org', privateLink: 'do-not-return' }] }) };
  };
  try {
    const res = response();await handler({ method: 'GET', headers: { cookie: '__Host-nest-auth=' + session } }, res);
    assert.equal(res.statusCode, 200);assert.equal(calls, 1);
    assert.deepEqual(res.body, { leaders: [{ division: 'Period 1', position: 'Division Manager', firstName: 'Alex', lastName: 'Example', email: 'alex@students.bethelsd.org' }] });
    assert.equal(res.headers['Cache-Control'], 'private, no-store, max-age=0');
    assert.equal(res.headers['Vary'], 'Cookie');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SPINNER_BRIDGE_URL; else process.env.SPINNER_BRIDGE_URL = oldUrl;
    if (oldToken === undefined) delete process.env.SPINNER_BRIDGE_TOKEN; else process.env.SPINNER_BRIDGE_TOKEN = oldToken;
  }
});
