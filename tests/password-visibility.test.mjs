import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const settle = () => new Promise(resolve => setImmediate(resolve));
function setup(body = '') {
  const dom = new JSDOM('<body>' + body + '</body>', {runScripts:'outside-only',url:'https://gknest.org/profile'});
  const w = dom.window;
  w.fetch = async () => ({ok:true,json:async()=>({signedIn:false})});
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.eval(fs.readFileSync('js/nest-auth.js','utf8'));
  return dom;
}
test('sign-in reveal preserves password, validation and submitted fields without submitting the form', async () => {
  const dom = setup(),w = dom.window;
  try {
    await settle();
    const form = w.document.querySelector('[data-form="login"]'), input = form.elements.password;
    const toggle = input.closest('.nest-password-field').querySelector('button');
    let submits = 0;form.addEventListener('submit',event=>{event.preventDefault();submits++;});
    input.value = 'Example password 123';
    assert.equal(input.type,'password');assert.equal(toggle.type,'button');
    assert.equal(toggle.getAttribute('aria-controls'),input.id);
    toggle.click();assert.equal(input.type,'text');assert.equal(toggle.textContent,'Hide');assert.equal(toggle.getAttribute('aria-pressed'),'true');
    assert.equal(new w.FormData(form).get('password'),'Example password 123');assert.equal(submits,0);
    toggle.click();assert.equal(input.type,'password');assert.equal(input.value,'Example password 123');
    toggle.click();form.reset();assert.equal(input.type,'password');assert.equal(toggle.textContent,'Show');
    toggle.click();input.closest('dialog').dispatchEvent(new w.Event('close'));assert.equal(input.type,'password');
  } finally { w.close(); }
});
test('profile and recovery passwords toggle independently and retain constraints', async () => {
  const dom = setup(fs.readFileSync('profile.html','utf8')),w = dom.window;
  try {
    await settle();
    const current = w.document.querySelector('[name="currentPassword"]'),next = w.document.querySelector('[name="newPassword"]');
    current.closest('.nest-password-field').querySelector('button').click();
    assert.equal(current.type,'text');assert.equal(next.type,'password');assert.equal(next.minLength,12);
    for(const input of w.document.querySelectorAll('input[type="password"]'))assert.ok(input.closest('.nest-password-field').querySelector('button'));
    assert.equal(w.document.querySelectorAll('.nest-password-field .nest-password-field').length,0);
  } finally { w.close(); }
});
test('dynamically loaded admin password fields get one keyboard-operable control', async () => {
  const dom = setup(),w = dom.window;
  try {
    const form = w.document.createElement('form');form.innerHTML = '<label>New password<input name="password" type="password" minlength="12"></label>';
    w.document.body.append(form);await settle();await settle();
    const input = form.elements.password,toggle = form.querySelector('button');
    assert.equal(form.querySelectorAll('button').length,1);assert.equal(toggle.getAttribute('aria-label'),'Show password');
    input.value = 'A different password';toggle.click();assert.equal(input.type,'text');assert.equal(input.value,'A different password');
    form.reset();assert.equal(input.type,'password');assert.equal(toggle.getAttribute('aria-pressed'),'false');
  } finally { w.close(); }
});
