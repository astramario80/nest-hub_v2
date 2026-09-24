import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { publicLeaders } from '../api/leadership.mjs';

const response = () => ({
  statusCode: 200, headers: {}, body: null,
  setHeader(name, value) { this.headers[name] = value; return this; },
  status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; }
});

test('published directory projects only first names and roles from quoted CSV', () => {
  const leaders = publicLeaders('"Period 1","https://private.example/part,a","Division Manager","Example, Alex"\n"CTSO","","Chief Executive Officer","Example, Sam"\n"Period 2","","Open","Vacant"');
  assert.deepEqual(leaders, [
    { division: 'Period 1', position: 'Division Manager', firstName: 'Alex' },
    { division: 'NEST Robotics', position: 'Chief Executive Officer', firstName: 'Sam' }
  ]);
});

test('published leadership directory serves and caches current first names', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'text/csv; charset=utf-8' }, text: async () => '"Period 1","private-link","Division Manager","Example, Alex"' });
  try {
    const res = response();await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { leaders: [{ division: 'Period 1', position: 'Division Manager', firstName: 'Alex' }] });
    assert.match(res.headers['Cache-Control'], /stale-while-revalidate/);
  } finally { globalThis.fetch = originalFetch; }
});

test('school bridge is retried when the published directory fails', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SPINNER_BRIDGE_URL;
  const originalToken = process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL = 'https://script.google.com/macros/s/example/exec';
  process.env.SPINNER_BRIDGE_TOKEN = 'test-token';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) throw new Error('Published view unavailable');
    return { ok: true, status: 200, json: async () => calls === 2
      ? { status: 503 }
      : { status: 200, leaders: [{ division: 'Period 1', position: 'Manager', firstName: 'Alex', email: 'private@example.test' }] } };
  };
  try {
    const res = response();
    await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(calls, 3);
    assert.deepEqual(res.body, { leaders: [{ division: 'Period 1', position: 'Manager', firstName: 'Alex' }] });
    assert.match(res.headers['Cache-Control'], /stale-while-revalidate/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SPINNER_BRIDGE_URL; else process.env.SPINNER_BRIDGE_URL = originalUrl;
    if (originalToken === undefined) delete process.env.SPINNER_BRIDGE_TOKEN; else process.env.SPINNER_BRIDGE_TOKEN = originalToken;
  }
});
