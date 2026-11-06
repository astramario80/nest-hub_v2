import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
const source=fs.readFileSync('js/main.js','utf8').split('\n/* =========================')[0];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('site branding gives bare and already marked NEST text exactly one superscript trademark',async()=>{
 const d=new JSDOM('<title>NEST tools</title><body><h1>NEST tools</h1><p>NEST™ support and NEST Robotics</p><a aria-label="NEST home">Home</a></body>',{runScripts:'outside-only'});d.window.eval(source);await tick();
 assert.equal(d.window.document.title,'NEST™ tools');assert.equal(d.window.document.querySelectorAll('.nest-brand>sup').length,3);assert.equal(d.window.document.querySelector('p').textContent,'NEST™ support and NEST™ Robotics');assert.equal(d.window.document.querySelector('a').getAttribute('aria-label'),'NEST™ home');d.window.close();
});
test('branding follows dynamic messages without changing editable text or code',async()=>{
 const d=new JSDOM('<body><textarea>NEST draft</textarea><div contenteditable="true">NEST draft</div><code>NEST_KEY NEST</code><p>NESTER</p><section></section></body>',{runScripts:'outside-only'});d.window.eval(source);
 const status=d.window.document.createElement('p');status.textContent='Sign in to NEST';d.window.document.querySelector('section').append(status);await tick();assert.equal(status.textContent,'Sign in to NEST™');assert.equal(status.querySelectorAll('sup').length,1);
 status.textContent='NEST™ ready';await tick();await tick();assert.equal(status.querySelectorAll('sup').length,1);assert.equal(d.window.document.querySelector('textarea').value,'NEST draft');assert.equal(d.window.document.querySelector('[contenteditable]').textContent,'NEST draft');assert.equal(d.window.document.querySelector('code').textContent,'NEST_KEY NEST');assert.equal(d.window.document.querySelector('body>p').textContent,'NESTER');d.window.close();
});
