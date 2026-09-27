import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import handler, { parseInventory } from '../api/computer-lookup.mjs';

const csv = '"Station #","Barcodes","Laptop BSD Serial #"\n"01","44076982","Station: 01; BSD Serial Number: 44219719"\n"28","44219745","Station: 28; BSD Serial Number: 44219746"\n"","44219751","Station: NEST Robotics; BSD Serial Number: 44076982"\n"","44220238","Station: Teacher Station; BSD Serial Number: 44220238"\n';

test('inventory uses the actual serial in the result field and includes named stations', () => {
  assert.deepEqual(parseInventory(csv), [
    { station: '01', serial: '44219719' },
    { station: '28', serial: '44219746' },
    { station: 'NEST Robotics', serial: '44076982' },
    { station: 'Teacher Station', serial: '44220238' }
  ]);
  assert.throws(() => parseInventory('<html>Sign in</html>'), /Unexpected inventory format/);
});

test('lookup API returns only validated computer data and rejects writes', async () => {
  const prior = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, text: async () => csv });
  const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  try {
    const ok = response();
    await handler({ method: 'GET' }, ok);
    assert.equal(ok.code, 200);
    assert.equal(ok.body.computers.length, 4);
    assert.deepEqual(Object.keys(ok.body.computers[0]), ['station', 'serial']);
    const denied = response();
    await handler({ method: 'POST' }, denied);
    assert.equal(denied.code, 405);
  } finally { globalThis.fetch = prior; }
});

test('station and serial dropdowns filter in place and refresh retains selection', async () => {
  const html = readFileSync(new URL('../computer-lookup.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../js/computer-lookup.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://nest.example/computer-lookup', runScripts: 'dangerously' });
  const { window } = dom;
  window.fetch = async () => ({ ok: true, json: async () => ({ computers: parseInventory(csv) }) });
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  const station = window.document.querySelector('#station-filter');
  const serial = window.document.querySelector('#serial-filter');
  const rows = () => [...window.document.querySelectorAll('#lookup-results tr')].map(row => row.textContent);
  assert.equal(rows().length, 4);
  station.value = '28'; station.dispatchEvent(new window.Event('change'));
  assert.deepEqual(rows(), ['2844219746']);
  serial.value = '44076982'; serial.dispatchEvent(new window.Event('change'));
  assert.equal(station.value, '');
  assert.deepEqual(rows(), ['NEST Robotics44076982']);
  window.document.querySelector('#lookup-refresh').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(serial.value, '44076982');
  assert.deepEqual(rows(), ['NEST Robotics44076982']);
  serial.value = ''; serial.dispatchEvent(new window.Event('change'));
  assert.equal(rows().length, 4);
  window.close();
});

test('lookup page keeps NEST quick access, footer menus, and current year', () => {
  const html = readFileSync(new URL('../computer-lookup.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://nest.example/computer-lookup', runScripts: 'dangerously' });
  const { window } = dom;
  window.eval(main);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  assert.equal(window.document.querySelector('#current-year').textContent, String(new Date().getFullYear()));
  assert.match(window.document.querySelector('#today-date').textContent, /^Today is /);
  const quick = window.document.querySelector('.dropdown-btn');
  quick.click();
  assert.equal(quick.nextElementSibling.classList.contains('show'), true);
  assert.deepEqual([...quick.nextElementSibling.querySelectorAll('a')].map(a => a.textContent.trim()), ['StudentVue', 'SmartPass', '🚀 Join Us']);
  const footer = [...window.document.querySelectorAll('.footer-dropdown-title')];
  assert.deepEqual(footer.map(item => item.textContent.trim()), ['Help & Support ▾', 'About Me ▾']);
  footer[0].click();
  assert.equal(footer[0].nextElementSibling.classList.contains('show'), true);
  assert.equal(quick.nextElementSibling.classList.contains('show'), false);
  footer[1].click();
  assert.equal(footer[1].nextElementSibling.classList.contains('show'), true);
  window.close();
});
