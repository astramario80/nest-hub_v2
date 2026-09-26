import test from 'node:test';
import assert from 'node:assert/strict';
import account from '../api/account.mjs';

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
