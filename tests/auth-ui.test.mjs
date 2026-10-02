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

test('authorized division bootstrap skips a second sign-in request; expired bootstrap falls back to the server',async()=>{
 for(const expired of [false,true]){
  const identity={signedIn:true,email:'manager@students.bethelsd.org',username:'manager',expires:Date.now()+(expired?-1000:60000)};
  const dom=new JSDOM('<body><script type="application/json" id="nest-auth-bootstrap">'+JSON.stringify(identity)+'</script></body>',{runScripts:'outside-only',url:'https://gknest.org/divisions/1'}),w=dom.window,calls=[];
  w.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>({signedIn:false})};};w.eval(fs.readFileSync('js/nest-auth.js','utf8'));await w.NestAuth.ready;
  assert.equal(calls.length,expired?1:0);assert.equal(w.NestAuth.identity?.username,expired?undefined:'manager');assert.equal(w.document.getElementById('nest-auth-bootstrap'),null);w.close();
 }
});
test('direct hiring link initializes identity and applications in one authorized request, then consumes the view once',async()=>{
 const dom=new JSDOM(fs.readFileSync('hiring.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/hiring?period=1'}),w=dom.window,calls=[];
 const data={identity:{signedIn:true,email:'manager@students.bethelsd.org',username:'manager',expires:Date.now()+60000},division:'Division 1',canManage:true,columns:['Applicant'],applications:[],team:[],positions:['Assistant Manager'],candidates:[],reviews:[],page:0,hasMore:false};
 w.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>data};};w.eval(fs.readFileSync('js/nest-auth.js','utf8'));w.eval(fs.readFileSync('js/hiring.js','utf8'));await w.NestAuth.ready;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.filter(url=>url.startsWith('/api/hiring')).length,1);assert.equal(calls.filter(url=>url.startsWith('/api/auth')).length,0);assert.match(calls[0],/api\/hiring\?period=1/);assert.equal(w.document.querySelector('#hiring-data').hidden,false);assert.equal(w.NestAuth.takeHiringView('1'),null);
 w.document.querySelector('#hiring-reload').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.filter(url=>url.startsWith('/api/hiring')).length,2);w.close();
});
test('unsigned hiring preload neither restores identity nor exposes application details',async()=>{
 const dom=new JSDOM(fs.readFileSync('hiring.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/hiring?period=1'}),w=dom.window,calls=[];
 w.fetch=async url=>{calls.push(url);return {ok:false,status:401,json:async()=>({error:'Sign in.'})};};w.eval(fs.readFileSync('js/nest-auth.js','utf8'));w.eval(fs.readFileSync('js/hiring.js','utf8'));await w.NestAuth.ready;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1);assert.equal(w.NestAuth.identity,null);assert.equal(w.document.querySelector('#hiring-data').hidden,true);assert.match(w.document.querySelector('#hiring-status').textContent,/Sign in/);w.close();
});

test('failed hiring preload offers a retry without automatically requesting the same failed data again',async()=>{
 const dom=new JSDOM(fs.readFileSync('hiring.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/hiring?period=1'}),w=dom.window,calls=[];
 w.fetch=async url=>{calls.push(url);return url.startsWith('/api/hiring')?{ok:false,status:503,json:async()=>({error:'School data is unavailable.'})}:{ok:true,json:async()=>({signedIn:true,email:'manager@students.bethelsd.org',username:'manager',expires:Date.now()+60000})};};
 try{w.eval(fs.readFileSync('js/nest-auth.js','utf8'));w.eval(fs.readFileSync('js/hiring.js','utf8'));await w.NestAuth.ready;await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.filter(url=>url.startsWith('/api/hiring')).length,1);assert.match(w.document.querySelector('#hiring-status').textContent,/School data is unavailable/);assert.equal(w.document.querySelector('#hiring-status button').textContent,'Try again');}finally{w.close();}
});
