import test from 'node:test';
import assert from 'node:assert/strict';
import account from '../api/account.mjs';
import {bridge} from '../lib/nest-auth.mjs';

const session='c'.repeat(64);
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
const request=(action,extra={},cookie='')=>({method:'POST',headers:{origin:'https://gknest.org','content-type':'application/json',cookie},body:{action,...extra}});
const oldFetch=global.fetch;
function withBridge(handler){
  const oldURL=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL='https://script.google.com/exec';process.env.SPINNER_BRIDGE_TOKEN='test-token';
  global.fetch=async (_url,options)=>({ok:true,json:async()=>handler(JSON.parse(options.body))});
  return ()=>{global.fetch=oldFetch;if(oldURL===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldURL;if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;};
}
test('manual account creation requires an administrator and district recovery address',async()=>{
  const calls=[];const restore=withBridge(payload=>{calls.push(payload);return payload.action==='auth-me'?{status:200,email:'mario@memberhq.net'}:{status:200};});
  try{
    let res=response();await account(request('admin-create',{username:'student1',password:'twelve characters',recoveryEmail:'outsider@example.org'}),res);
    assert.equal(res.code,403);assert.equal(calls.length,0);
    const cookie='__Host-nest-auth='+session;
    res=response();await account(request('admin-create',{username:'student1',password:'twelve characters',recoveryEmail:'outsider@example.org'},cookie),res);
    assert.equal(res.code,400);assert.deepEqual(calls.map(item=>item.action),['auth-me']);
    res=response();await account(request('admin-create',{username:'student1',password:'twelve characters',recoveryEmail:'mpenalver@bethelsd.org',period:'1',studentEmail:'student@students.bethelsd.org'},cookie),res);
    assert.equal(res.code,200);assert.deepEqual(calls.map(item=>item.action),['auth-me','auth-me','auth-admin-create']);
    assert.equal(calls[2].recoveryEmail,'mpenalver@bethelsd.org');assert.ok(!JSON.stringify(calls[2]).includes('twelve characters'));
  }finally{restore();}
});
test('account listing and edits require an owner and never return password hashes',async()=>{
  const calls=[];const restore=withBridge(payload=>{calls.push(payload);if(payload.action==='auth-me')return {status:200,email:'mario@memberhq.net'};if(payload.action==='auth-admin-list')return {status:200,accounts:[{username:'student1',studentName:'Test Student',period:'1'}]};return {status:200};});
  try{
    const cookie='__Host-nest-auth='+session;
    let res=response();await account(request('admin-list'),res);assert.equal(res.code,403);
    res=response();await account(request('admin-list',{},cookie),res);assert.equal(res.code,200);assert.equal(res.data.accounts[0].studentName,'Test Student');
    res=response();await account(request('admin-edit',{currentUsername:'student1',username:'student2',password:'a long new password'},cookie),res);
    assert.equal(res.code,200);assert.ok(!JSON.stringify(res.data).includes('passwordHash'));
    assert.equal(calls.at(-1).action,'auth-admin-edit');assert.ok(!JSON.stringify(calls.at(-1)).includes('a long new password'));
    res=response();await account(request('admin-remove',{currentUsername:'student2'},cookie),res);assert.equal(res.code,200);
    assert.equal(calls.at(-1).action,'auth-admin-remove');
  }finally{restore();}
});
test('recovery rejects personal addresses and keeps unknown district accounts private',async()=>{
  const calls=[];const restore=withBridge(payload=>{calls.push(payload);return {status:200};});
  try{
    let res=response();await account(request('recover-request',{email:'outsider@example.org'}),res);
    assert.equal(res.code,400);assert.equal(calls.length,0);
    res=response();await account(request('recover-request',{email:'student@students.bethelsd.org'}),res);
    assert.equal(res.code,200);assert.match(res.data.message,/If this email/);assert.match(res.headers['Set-Cookie'],/__Host-nest-recovery-challenge=/);
    assert.ok(!JSON.stringify(res.data).includes(calls[0].code));
  }finally{restore();}
});

test('recovery retries preserve challenge, code and ticket after an interrupted school request',async()=>{
 for(const action of ['recover-request','recover-verify']){
  const calls=[];let first=true;const restore=withBridge(payload=>{calls.push(payload);if(first){first=false;throw new TypeError('Simulated interrupted response');}return {status:200,usernames:['student']};});
  try{const res=response();await account(request(action,action==='recover-request'?{email:'student@students.bethelsd.org'}:{code:'123456'},'__Host-nest-recovery-challenge='+session),res);assert.equal(res.code,200);assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);}finally{restore();}
 }
});
test('password resets are never automatically resubmitted after an interrupted school request',async()=>{
 let calls=0;const restore=withBridge(()=>{calls++;throw new TypeError('Simulated interrupted response');});
 try{const res=response();await account(request('recover-reset',{username:'student',password:'a long new password'},'__Host-nest-recovery-ticket='+session),res);assert.equal(res.code,503);assert.equal(calls,1);}finally{restore();}
});
test('all recovery operations allow a 55-second school response window',async()=>{
 const timeout=AbortSignal.timeout,deadlines=[];AbortSignal.timeout=ms=>{deadlines.push(ms);return timeout(ms);};
 const restore=withBridge(()=>({status:200,usernames:['student'],username:'student'}));
 try{
  for(const action of ['recover-request','recover-verify','recover-reset']){const res=response();await account(request(action,{email:'student@students.bethelsd.org',code:'123456',username:'student',password:'a long new password'},'__Host-nest-recovery-challenge='+session+'; __Host-nest-recovery-ticket='+session),res);assert.equal(res.code,200);}
  assert.equal(deadlines.filter(ms=>ms===55000).length,3);assert.ok(deadlines.filter(ms=>ms!==55000).every(ms=>ms<=18000));
 }finally{restore();AbortSignal.timeout=timeout;}
});

test('stalled recovery result URLs are replaced by safely replaying the same verification',async()=>{
 const restore=withBridge(()=>({status:200})),posts=[],gets=[];let count=0;
 global.fetch=async(url,options)=>{
  if(options.method==='POST'){posts.push(JSON.parse(options.body));count++;return {status:302,headers:{get:()=> 'https://script.googleusercontent.com/result-'+count}};}
  gets.push(String(url));if(String(url).endsWith('result-1'))throw new DOMException('Simulated stalled result','TimeoutError');
  return {ok:true,json:async()=>({status:200,usernames:['student']})};
 };
 try{const result=await bridge({action:'auth-recover-verify',challenge:session,code:'123456',ticket:'b'.repeat(64)},55000);assert.equal(result.status,200);assert.equal(posts.length,2);assert.deepEqual(posts[0],posts[1]);assert.deepEqual(gets,['https://script.googleusercontent.com/result-1','https://script.googleusercontent.com/result-1','https://script.googleusercontent.com/result-2']);}finally{restore();}
});

test('only account email requests receive the server mail credential and never return it to the browser',async()=>{
 const keys=['POSTMARK_SERVER_TOKEN','POSTMARK_FROM_EMAIL','NEST_EMAIL_ENABLED'],saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 const calls=[],restore=withBridge(payload=>{calls.push(payload);return {status:200};});
 Object.assign(process.env,{POSTMARK_SERVER_TOKEN:'private-mail-token',POSTMARK_FROM_EMAIL:'communications@gknest.org',NEST_EMAIL_ENABLED:'true'});
 try{
  for(const action of ['auth-register-request','auth-recover-request','auth-me'])await bridge({action,accountMailToken:'untrusted-token'});
  assert.equal(calls[0].accountMailToken,'private-mail-token');assert.equal(calls[1].accountMailToken,'private-mail-token');assert.equal(calls[2].accountMailToken,undefined);
  const res=response();await account(request('recover-request',{email:'student@students.bethelsd.org',accountMailToken:'untrusted-token'}),res);
  assert.equal(res.code,200);assert.ok(!JSON.stringify(res).includes('private-mail-token'));
  process.env.NEST_EMAIL_ENABLED='false';await bridge({action:'auth-recover-request'});assert.equal(calls.at(-1).accountMailToken,undefined);
 }finally{restore();for(const key of keys)if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
});

test('directory and notes require live owner authorization and notes use a stable account key',async()=>{
 let owner=true;const calls=[],restore=withBridge(payload=>{calls.push(payload);if(payload.action==='auth-me')return {status:200,email:owner?'mpenalver@bethelsd.org':'student@students.bethelsd.org'};return {status:200,accounts:[{username:'teacher',passwordHash:'a'.repeat(64),passwordSalt:'b'.repeat(32)}]};});
 try{
  const cookie='__Host-nest-auth='+session;
  for(const action of ['admin-directory','admin-notes']){let res=response();await account(request(action,{accountKey:'manual:student',notes:'test'}),res);assert.equal(res.code,403);owner=false;res=response();await account(request(action,{accountKey:'manual:student',notes:'test'},cookie),res);assert.equal(res.code,403);owner=true;}
  let res=response();await account(request('admin-directory',{},cookie),res);assert.equal(res.code,200);assert.equal(res.data.accounts[0].passwordHash,'a'.repeat(64));assert.match(res.headers['Cache-Control'],/no-store/);
  res=response();await account(request('admin-notes',{accountKey:'manual:student',notes:'Follow up'},cookie),res);assert.equal(res.code,200);assert.equal(calls.at(-1).accountKey,'manual:student');assert.equal(calls.at(-1).notes,'Follow up');assert.ok(!JSON.stringify(res.data).includes('passwordHash'));
  res=response();await account(request('admin-notes',{accountKey:'manual:student',notes:'x'.repeat(1001)},cookie),res);assert.equal(res.code,400);
 }finally{restore();}
});
test('signup reset validates the email and requires a live owner session',async()=>{
 let owner=true;const calls=[],restore=withBridge(payload=>{calls.push(payload);return payload.action==='auth-me'?{status:200,email:owner?'mpenalver@bethelsd.org':'student@students.bethelsd.org'}:{status:200,expires:123};});
 try{const cookie='__Host-nest-auth='+session;let res=response();await account(request('admin-registration-unlock',{email:'student@students.bethelsd.org'}),res);assert.equal(res.code,403);res=response();await account(request('admin-registration-unlock',{email:'outsider@example.com'},cookie),res);assert.equal(res.code,400);owner=false;res=response();await account(request('admin-registration-unlock',{email:'student@students.bethelsd.org'},cookie),res);assert.equal(res.code,403);owner=true;res=response();await account(request('admin-registration-unlock',{email:'student@students.bethelsd.org'},cookie),res);assert.equal(res.code,200);assert.equal(calls.at(-1).action,'auth-admin-registration-unlock');assert.equal(calls.at(-1).email,'student@students.bethelsd.org');assert.equal(res.data.expires,123);}finally{restore();}
});
test('recovery rate limits return the server wait time without exposing the address or bucket',async()=>{const restore=withBridge(()=>({status:429,retryAfter:125}));try{const res=response();await account(request('recover-request',{email:'student@students.bethelsd.org'}),res);assert.equal(res.code,429);assert.equal(res.headers['Retry-After'],'125');assert.match(res.data.error,/3 minutes/);assert.ok(!res.data.error.includes('student@'));}finally{restore();}});
