import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import handler from '../api/spinner.mjs';
import {JSDOM} from 'jsdom';
const gasSource=fs.readFileSync(new URL('../google-spinner/Code.js',import.meta.url),'utf8');
function service() {
  const state=new Map(),sent=[];let now=1000000000,rows=[['Student A','one@example.org'],['Student B','two@example.org']];
  const store={getProperty:k=>state.get(k)||null,setProperty:(k,v)=>state.set(k,v),deleteProperty:k=>state.delete(k),getProperties:()=>Object.fromEntries(state)};
  const ctx=vm.createContext({Date:class extends Date {static now(){return now;}},console,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>[...createHash('sha256').update(s).digest()]},PropertiesService:{getScriptProperties:()=>store},Sheets:{Spreadsheets:{get:()=>({sheets:[]}),Values:{get:(id)=>({values:id==='1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I'?[]:rows.map(row=>[row[0],'',row[1]])})}}},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:m=>sent.push(m)},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>s})}});
  vm.runInContext(gasSource+'\n'+fs.readFileSync(new URL('../google-spinner/Tracker.js',import.meta.url),'utf8'),ctx);
  return {call:r=>JSON.parse(JSON.stringify(ctx.dispatch_(r))),ctx,sent,state,advance:n=>now+=n,setRows:r=>rows=r};
}
const base={period:'1',email:'one@example.org',code:'012345',challenge:'a'.repeat(64),ip:'b'.repeat(64),session:'c'.repeat(64)};
test('roster requires email code; session is period bound, expires, and logout revokes',()=>{
  const s=service();assert.equal(s.call({...base,action:'roster'}).status,401);
  assert.equal(s.call({...base,action:'request'}).status,200);assert.equal(s.sent.length,1);
  assert.equal(s.call({...base,action:'verify',code:'999999'}).status,401);
  assert.equal(s.call({...base,action:'verify',period:'2'}).status,401);
  const verified=s.call({...base,action:'verify'});assert.equal(verified.names.length,2);assert.equal(verified.expires,1000000000+21600000);
  assert.equal(s.call({...base,action:'verify'}).status,401);
  assert.equal(s.call({...base,action:'roster',period:'2'}).status,401);
  assert.equal(s.call({...base,action:'roster'}).status,200);
  s.advance(21600000);assert.equal(s.call({...base,action:'roster'}).status,401);
  s.call({...base,action:'request'});s.call({...base,action:'verify'});
  assert.equal(s.call({...base,action:'logout'}).status,200);assert.equal(s.call({...base,action:'roster'}).status,401);
});
test('unknown email has same response but no message; codes expire and allow only five tries',()=>{
  const s=service();assert.deepEqual(s.call({...base,action:'request',email:'outsider@example.org'}),{status:200});assert.equal(s.sent.length,0);
  s.call({...base,action:'request'});
  for(let i=0;i<5;i++)assert.equal(s.call({...base,action:'verify',code:'999999'}).status,401);
  assert.equal(s.call({...base,action:'verify'}).status,401);
  s.advance(60001);s.call({...base,action:'request'});s.advance(600000);
  assert.equal(s.call({...base,action:'verify'}).status,401);
});
test('authorization is rechecked; request throttles are durable and banner links to NEST',()=>{
  const s=service();s.call({...base,action:'request'});s.call({...base,action:'request'});assert.equal(s.sent.length,1);
  assert.match(s.sent[0].htmlBody,/href="https:\/\/gknest.org"/);assert.match(s.sent[0].htmlBody,/nest-email-banner.png/);
  assert.match(s.sent[0].body,/012345/);assert.match(s.sent[0].htmlBody,/6 hours/);
  s.call({...base,action:'verify'});s.setRows([['Student B','two@example.org']]);assert.equal(s.call({...base,action:'roster'}).status,401);
  assert.equal(JSON.parse(s.ctx.doPost({postData:{contents:JSON.stringify({...base,action:'roster',token:'wrong'})}})).status,401);
});
function response() {return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(d){this.data=d;return this;}};}
test('API rejects cross-site requests and keeps credentials in secure cookies only',async()=>{
  const previousFetch=global.fetch,previousURL=process.env.SPINNER_BRIDGE_URL,previousToken=process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL='https://bridge.example';process.env.SPINNER_BRIDGE_TOKEN='server-secret';
  let payload;
  global.fetch=async(_,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>payload.action==='request'?{status:200}:{status:200,names:['Student A'],expires:Date.now()+21600000}};};
  try {
    const req={method:'POST',headers:{origin:'https://gknest.org','content-type':'application/json'},body:{action:'request',period:'1',email:'one@example.org'}};
    let res=response();await handler({...req,headers:{...req.headers,origin:'https://evil.example'}},res);assert.equal(res.code,403);
    res=response();await handler(req,res);assert.equal(res.code,200);assert.match(res.headers['Cache-Control'],/no-store/);assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);assert.ok(!JSON.stringify(res.data).includes(payload.code));
    const challengeCookie=res.headers['Set-Cookie'].split(';')[0];
    const firstChallenge=payload.challenge;
    res=response();await handler({...req,headers:{...req.headers,cookie:challengeCookie}},res);assert.equal(payload.challenge,firstChallenge,'resend during cooldown preserves the code already received');
    res=response();await handler({...req,headers:{...req.headers,cookie:challengeCookie},body:{action:'verify',period:'1',code:'123456'}},res);
    assert.equal(res.code,200);assert.equal(res.headers['Set-Cookie'].length,2);assert.match(res.headers['Set-Cookie'][0],/Max-Age=21[56]\d{2}/);assert.ok(!JSON.stringify(res.data).includes(payload.session));
    res=response();await handler({...req,body:{action:'roster',period:'1'}},res);assert.equal(res.code,401);
  } finally {global.fetch=previousFetch;if(previousURL===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=previousURL;if(previousToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=previousToken;}
});
test('spinner UI loads only after verification and clears names on period change and sign-out',async()=>{
  const dom=new JSDOM('<div class="sops-content"><div class="placeholder"><section id="spinner-access"></section><textarea id="spinner-names"></textarea><button id="spin-button">SPIN</button><div id="spinner-status"></div></div></div>',{runScripts:'outside-only',url:'https://gknest.org/sops'});
  const {window:w}=dom;w.fetch=async(_,options)=>{const r=JSON.parse(options.body);return {ok:r.action!=='roster',status:r.action==='roster'?401:200,json:async()=>r.action==='verify'?{names:['Example Student'],expires:Date.now()+21600000}:{message:'Check email'}};};
  w.eval(fs.readFileSync(new URL('../js/spinner-access.js',import.meta.url),'utf8'));const tick=()=>new Promise(r=>setImmediate(r)),q=s=>w.document.querySelector(s);
  q('[data-period="1"]').click();await tick();assert.equal(q('#spinner-names').value,'');
  q('#spinner-email').value='one@example.org';q('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  q('#spinner-code').value='123456';q('[data-verify]').click();await tick();assert.equal(q('#spinner-names').value,'Example Student');
  q('[data-period="2"]').click();await tick();assert.equal(q('#spinner-names').value,'');
  q('#spinner-code').value='123456';q('[data-verify]').click();await tick();q('[data-logout]').click();await tick();assert.equal(q('#spinner-names').value,'');dom.window.close();
});

test('all three owner emails can verify every period without roster membership; outsiders cannot',()=>{
  for(const email of ['astramario@gmail.com','mpenalver@bethelsd.org','mario@memberhq.net']) {
    for(const period of ['1','2','3','4','5','7']) {
      const s=service();s.setRows([]);
      assert.equal(s.call({...base,email:email.toUpperCase(),period,action:'request'}).status,200);
      assert.equal(s.sent.length,1);
      assert.equal(s.call({...base,period,action:'roster'}).status,401);
      assert.equal(s.call({...base,period,action:'verify'}).status,200);
      assert.equal(s.call({...base,period,action:'roster'}).status,200);
    }
  }
  const s=service();s.setRows([]);s.call({...base,email:'outsider@example.org',action:'request'});assert.equal(s.sent.length,0);
});

test('cooldown is explicit and rapid retries do not consume the hourly send allowance',()=>{
  const s=service();s.call({...base,action:'request'});
  for(let i=0;i<6;i++)assert.equal(s.call({...base,action:'request'}).status,429);
  assert.equal(s.sent.length,1);
  for(let i=0;i<4;i++){s.advance(60001);assert.equal(s.call({...base,action:'request'}).status,200);}
  assert.equal(s.sent.length,5);s.advance(60001);
  const limited=s.call({...base,action:'request'});assert.equal(limited.status,429);assert.ok(limited.retryAfter>60);
  s.advance(3600000);assert.equal(s.call({...base,action:'request'}).status,200);assert.equal(s.sent.length,6);
});
