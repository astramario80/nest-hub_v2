import test from 'node:test';
import assert from 'node:assert/strict';
import auth from '../api/auth.mjs';
import spinner from '../api/spinner.mjs';
import { districtEmail, username } from '../lib/nest-auth.mjs';

const response = () => ({ headers:{}, setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;}, json(data){this.data=data;return this;} });
const req = (action, extra={}, cookie='') => ({method:'POST',headers:{origin:'https://gknest.org','content-type':'application/json',cookie},body:{action,...extra}});
const session='c'.repeat(64);
const oldFetch=global.fetch;
function withBridge(handler) {
  const oldURL=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL='https://script.google.com/exec';process.env.SPINNER_BRIDGE_TOKEN='test-token';
  global.fetch=async (_url,options)=>({ok:true,json:async()=>handler(JSON.parse(options.body))});
  return ()=>{global.fetch=oldFetch;if(oldURL===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldURL;if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;};
}
test('district email and username validation reject outsiders and dangerous sheet input',()=>{
  assert.equal(districtEmail('A@students.bethelsd.org'),'a@students.bethelsd.org');
  assert.equal(districtEmail('a@other.org'),'');assert.equal(districtEmail('a@bethelsd.org.evil'),'');
  assert.equal(username('Mario.1'),'mario.1');assert.equal(username('=IMPORTXML'),'');
});
test('registration sends a one-time code and puts only opaque tokens in secure cookies',async()=>{
  const restore=withBridge(payload=>({status:200,email:'student@bethelsd.org'}));
  try {
    let res=response();await auth(req('register-request',{email:'student@bethelsd.org'}),res);
    assert.equal(res.code,200);assert.match(res.headers['Set-Cookie'],/__Host-nest-register-challenge=/);assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
    const challenge=res.headers['Set-Cookie'].split(';')[0];
    res=response();await auth(req('register-verify',{code:'123456'},challenge),res);
    assert.equal(res.code,200);assert.equal(res.headers['Set-Cookie'].length,2);
    assert.ok(!JSON.stringify(res.data).includes('123456'));
  } finally {restore();}
});
test('login checks salted hash and duration before issuing a session',async()=>{
  const {pbkdf2Sync}=await import('node:crypto');
  const salt='a'.repeat(32),password='a long private password';
  const hash=pbkdf2Sync(password,Buffer.from(salt,'hex'),210000,32,'sha256').toString('hex');
  let calls=[];const restore=withBridge(payload=>{calls.push(payload.action);return payload.action==='auth-lookup'?{status:200,email:'student@bethelsd.org',passwordSalt:salt,passwordHash:hash}:{status:200,expires:Date.now()+86400000};});
  try {
    let res=response();await auth(req('login',{username:'student',password:'wrong password',duration:'1d'}),res);assert.equal(res.code,401);assert.deepEqual(calls,['auth-lookup']);
    calls=[];res=response();await auth(req('login',{username:'student',password,duration:'1d'}),res);assert.equal(res.code,200);assert.deepEqual(calls,['auth-lookup','auth-session']);assert.match(res.headers['Set-Cookie'],/Max-Age=86400/);assert.ok(!JSON.stringify(res.data).includes(session));
  } finally {restore();}
});
test('protected tool requires the NEST cookie and blocks cross-site writes',async()=>{
  const restore=withBridge(payload=>({status:200,names:['Student'],expires:Date.now()+86400000}));
  try {
    let res=response();await spinner(req('roster',{period:'1'}),res);assert.equal(res.code,401);
    res=response();await spinner(req('roster',{period:'1'},'__Host-nest-auth='+session),res);assert.equal(res.code,200);
    res=response();await spinner({...req('roster',{period:'1'},'__Host-nest-auth='+session),headers:{origin:'https://evil.example','content-type':'application/json',cookie:'__Host-nest-auth='+session}},res);assert.equal(res.code,403);
  } finally {restore();}
});
test('logout asks the bridge to revoke the session',async()=>{
  const calls=[];const restore=withBridge(payload=>{calls.push(payload.action);return {status:200};});
  try {const res=response();await auth(req('logout',{},'__Host-nest-auth='+session),res);assert.equal(res.code,200);assert.deepEqual(calls,['auth-logout']);assert.match(res.headers['Set-Cookie'][0],/Max-Age=0/);} finally {restore();}
});
test('Tech Ticket backend URL is returned only for an authorized signed-in technician',async()=>{
  let allowed=false;const calls=[];const restore=withBridge(payload=>{calls.push(payload.action);return {status:allowed?200:403};});
  const get=cookie=>({method:'GET',headers:{cookie},query:{action:'tech-ticket'}});
  try{
    let res=response();await auth(get(''),res);assert.equal(res.code,401);assert.deepEqual(calls,[]);
    res=response();await auth(get('__Host-nest-auth='+session),res);assert.equal(res.code,403);
    allowed=true;res=response();await auth(get('__Host-nest-auth='+session),res);assert.equal(res.code,200);
    assert.match(res.data.url,/docs\.google\.com\/spreadsheets\/d\/169SCXhVH1ufehSUSv_qkbVBJhrdz4MVAjBMOUfDBMGg/);
    assert.deepEqual(calls,['auth-tech-ticket-access','auth-tech-ticket-access']);
  }finally{restore();}
});
