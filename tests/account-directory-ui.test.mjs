import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const data=[{accountKey:'teacher@bethelsd.org',username:'zoe',name:'Able, Zoe',firstName:'Zoe',lastName:'Able',type:'staff',email:'teacher@bethelsd.org',active:true,sessionVersion:2,createdAt:'2026-11-02T17:00:00Z',passwordHash:'a'.repeat(64),passwordSalt:'b'.repeat(32),notes:'',manual:false},{accountKey:'manual:student',username:'student',name:'Zulu, Amy',firstName:'Amy',lastName:'Zulu',type:'student',email:'student@students.bethelsd.org',active:true,sessionVersion:1,createdAt:'2026-11-02T17:00:00Z',passwordHash:'c'.repeat(64),passwordSalt:'d'.repeat(32),notes:'<img src=x onerror=alert(1)>',manual:true}];
test('directory sorts, searches names/email/username, filters staff/students, and saves private notes',async()=>{
 const dom=new JSDOM(fs.readFileSync('profile.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/profile#accounts'}),w=dom.window,calls=[];
 w.document.getElementById('profile-admin-panel').hidden=false;w.NestAuth={identity:{email:'mpenalver@bethelsd.org'},ready:Promise.resolve()};
 w.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);calls.push(body);return {ok:true,json:async()=>body.action==='admin-directory'?{accounts:structuredClone(data)}:{message:'Saved'}};};
 try{
  w.eval(fs.readFileSync('js/admin-accounts.js','utf8'));await tick();
  const q=s=>w.document.querySelector(s),cards=()=>[...w.document.querySelectorAll('.account-entry')];
  assert.equal(cards().length,2);assert.equal(cards()[0].querySelector('h4').textContent,'Able, Zoe');assert.match(cards()[0].textContent,/2026-11-02-09:00:00/);
  assert.equal(q('.account-credential-details').open,false);assert.equal(q('.account-hash').textContent,'a'.repeat(64));assert.equal(cards()[1].querySelector('img'),null);
  const search=q('#admin-account-search');for(const query of ['Amy Zulu','student@students','student']){search.value=query;search.dispatchEvent(new w.Event('input'));assert.equal(cards().length,1);assert.match(cards()[0].textContent,/Zulu, Amy/);}
  search.value='';search.dispatchEvent(new w.Event('input'));const filter=q('#admin-account-type');filter.value='staff';filter.dispatchEvent(new w.Event('change'));assert.equal(cards().length,1);assert.match(cards()[0].textContent,/Able, Zoe/);
  const notes=q('.account-notes textarea');notes.value='Call next week';q('.account-notes').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(calls.at(-1).action,'admin-notes');assert.equal(calls.at(-1).accountKey,'teacher@bethelsd.org');assert.equal(calls.at(-1).notes,'Call next week');assert.match(q('.account-notes').textContent,/Saved/);
  w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(q('#admin-tools').hidden,true);assert.equal(cards().length,0);assert.ok(!q('#admin-accounts-list').textContent.includes('a'.repeat(64)));
 }finally{w.close();}
});
test('non-owner identities never request the account directory',async()=>{
 const dom=new JSDOM(fs.readFileSync('profile.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/profile'}),w=dom.window;let calls=0;
 try{w.NestAuth={identity:{email:'student@students.bethelsd.org'},ready:Promise.resolve()};w.fetch=async()=>{calls++;throw Error('Unexpected');};w.eval(fs.readFileSync('js/admin-accounts.js','utf8'));await tick();assert.equal(calls,0);assert.equal(w.document.getElementById('admin-tools').hidden,true);}finally{w.close();}
});
