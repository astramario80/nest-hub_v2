import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

test('verified account setup suggests letter-first usernames and explains rejected ID numbers', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'https://gknest.org/' });
  const w = dom.window, q = selector => w.document.querySelector(selector);
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.fetch = async (url, options) => options?.method === 'POST'
    ? { ok: true, json: async () => ({ email: 'jared.smith12345@students.bethelsd.org' }) }
    : { ok: true, json: async () => ({ signedIn: false }) };
  try {
    w.eval(fs.readFileSync('js/nest-auth.js', 'utf8'));
    w.NestAuth.open('register-verify');
    const verify = q('[data-form="register-verify"]');
    verify.elements.code.value = '123456';
    verify.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(q('[data-form="register"]').hidden, false);
    const suggestions = [...w.document.querySelectorAll('[data-username-options] button')].map(button => button.textContent);
    assert.deepEqual(suggestions, ['jared.smith', 'jared1', 'jared2']);
    const input = q('[data-form="register"] [name="username"]');
    input.value = '123456';
    assert.equal(input.checkValidity(), false);
    assert.match(q('[data-message]').textContent, /start with a letter/i);
    q('[data-username-options] button').click();
    assert.equal(input.value, 'jared.smith');
    assert.equal(input.checkValidity(), true);
  } finally { w.close(); }
});
