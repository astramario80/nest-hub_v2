import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/leadership.mjs';

const response = () => ({
  statusCode: 200, headers: {}, body: null,
  setHeader(name, value) { this.headers[name] = value; return this; },
  status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; }
});

test('public leadership directory retries a transient bridge failure and caches success', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SPINNER_BRIDGE_URL;
  const originalToken = process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL = 'https://script.google.com/macros/s/example/exec';
  process.env.SPINNER_BRIDGE_TOKEN = 'test-token';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => calls === 1
      ? { status: 503 }
      : { status: 200, leaders: [{ division: 'Period 1', position: 'Manager', firstName: 'Alex', email: 'private@example.test' }] } };
  };
  try {
    const res = response();
    await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(calls, 2);
    assert.deepEqual(res.body, { leaders: [{ division: 'Period 1', position: 'Manager', firstName: 'Alex' }] });
    assert.match(res.headers['Cache-Control'], /stale-while-revalidate/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SPINNER_BRIDGE_URL; else process.env.SPINNER_BRIDGE_URL = originalUrl;
    if (originalToken === undefined) delete process.env.SPINNER_BRIDGE_TOKEN; else process.env.SPINNER_BRIDGE_TOKEN = originalToken;
  }
});
