import test from 'node:test';
import assert from 'node:assert/strict';
import { leadershipAllowsSignals, signalsAccess, SIGNAL_ROLES } from '../lib/signals-access.mjs';
import handler from '../api/signals.mjs';
const email='leader@students.bethelsd.org', session='a'.repeat(64);
test('only the five requested roles match the signed-in email', () => {
  for (const position of SIGNAL_ROLES) assert.equal(leadershipAllowsSignals(email,[{email:' LEADER@students.bethelsd.org ',position:' '+position.toUpperCase()+' '}]),true);
  for (const position of ['Division DJ','Software Technician','Former Division Manager','Assistant Manager trainee','']) assert.equal(leadershipAllowsSignals(email,[{email,position}]),false);
  assert.equal(leadershipAllowsSignals(email,[{email:'someone@students.bethelsd.org',position:'Division Manager'}]),false);
});
test('staff exception requires exact verified district domain',()=>{
  assert.equal(leadershipAllowsSignals(' Teacher@BETHELSD.ORG ',[]),true);
  for(const value of ['student@students.bethelsd.org','fake@bethelsd.org.evil.com','@bethelsd.org','a@@bethelsd.org','manual:manager','mario@memberhq.net']) assert.equal(leadershipAllowsSignals(value,[]),false);
});
test('invalid, inactive, or expired sessions never reach the directory',async()=>{
  assert.equal(await signalsAccess('',()=>assert.fail()),401);
  assert.equal(await signalsAccess(session,async()=>({status:401})),401);
});
test('uses verified identity and fresh directory; role removal revokes access',async()=>{
  let leaders=[{email,position:'Division Manager'}];
  const request=async body=>body.action==='auth-me'?{status:200,email}:{status:200,leaders};
  assert.equal(await signalsAccess(session,request),200);
  leaders=[];
  assert.equal(await signalsAccess(session,request),403);
});
test('staff bypasses roster outages; student lookup fails closed',async()=>{
  assert.equal(await signalsAccess(session,async body=>{assert.equal(body.action,'auth-me');return {status:200,email:'staff@bethelsd.org'};}),200);
  assert.equal(await signalsAccess(session,async body=>body.action==='auth-me'?{status:200,email}:{status:503}),503);
});
test('direct player and script requests reject unsigned visitors and ignore supplied email',async()=>{
  for(const asset of ['index','app','access']) {
    const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},send(value){this.body=value;return this;},json(value){this.body=value;return this;}};
    await handler({method:'GET',headers:{},query:{asset,email:'staff@bethelsd.org'}},res);
    assert.equal(res.code,401);assert.match(res.headers['Cache-Control'],/no-store/);
    assert.doesNotMatch(JSON.stringify(res.body),/spotify-token|scheduleUrl|cleanupUri/);
  }
});

test('authorized requests receive player assets; denied role cannot fetch script',async()=>{
  const original=globalThis.fetch, oldUrl=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL='https://example.test/bridge';process.env.SPINNER_BRIDGE_TOKEN='test';
  let allowed=true;
  globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);return {ok:true,status:200,json:async()=>body.action==='auth-me'?{status:200,email}:{status:200,leaders:allowed?[{email,position:'Division Manager'}]:[]}};};
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},send(value){this.body=value;return this;},json(value){this.body=value;return this;}});
  try {
    let res=response();await handler({method:'GET',headers:{cookie:'__Host-nest-auth='+session},query:{asset:'index'}},res);assert.equal(res.code,200);assert.match(res.body,/api\/signals\?asset=app/);assert.doesNotMatch(res.body,/serviceWorker/);
    res=response();await handler({method:'GET',headers:{cookie:'__Host-nest-auth='+session},query:{asset:'app'}},res);assert.equal(res.code,200);assert.match(res.body,/checkNestAccess/);
    allowed=false;res=response();await handler({method:'GET',headers:{cookie:'__Host-nest-auth='+session},query:{asset:'app'}},res);assert.equal(res.code,403);
  } finally {globalThis.fetch=original;if(oldUrl===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldUrl;if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;}
});

test('player stops and disconnects when access expires or the check fails',async()=>{
  const {default:vm}=await import('node:vm');const {readFileSync}=await import('node:fs');
  const source=readFileSync('lib/signals-player/app.txt','utf8').replace(/initialize\(\);\s*$/,'');
  for(const failure of [401,403,503,'network']) {
    const calls=[];const ctx=vm.createContext({document:{querySelector:()=>({})},console,AbortSignal,fetch:async()=>{if(failure==='network')throw new Error('offline');return {ok:false,status:failure};},localStorage:{removeItem:()=>calls.push('clear')}});
    vm.runInContext(source,ctx);ctx.calls=calls;
    vm.runInContext("stopSignals = () => calls.push('stop'); state.player = {pause:async()=>calls.push('pause'),disconnect:()=>calls.push('disconnect')};",ctx);
    await assert.rejects(vm.runInContext('checkNestAccess(true)',ctx));
    assert.deepEqual(calls.slice(0,3),['stop','pause','disconnect']);
    assert.equal(calls.includes('clear'),failure===401||failure===403);
  }
});

test('Spotify login uses the shared Client ID and preserves the Signals redirect',async()=>{
  const {default:vm}=await import('node:vm');const {readFileSync}=await import('node:fs');const {webcrypto}=await import('node:crypto');
  const source=readFileSync('lib/signals-player/app.txt','utf8').replace(/initialize\(\);\s*$/,'');
  const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const top={location:{}};
  const ctx=vm.createContext({document:{querySelector:()=>({})},window:{top},localStorage:storage,sessionStorage:storage,crypto:webcrypto,TextEncoder,URLSearchParams,btoa});
  vm.runInContext(source,ctx);await vm.runInContext('beginSpotifyLogin()',ctx);
  const url=new URL(top.location.href);
  assert.equal(url.origin,'https://accounts.spotify.com');
  assert.equal(url.searchParams.get('client_id'),'e14ed1a76b2f45c8b3485093be6942f1');
  assert.equal(url.searchParams.get('redirect_uri'),'https://signals.gknest.org/');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.ok(url.searchParams.get('state'));
  assert.doesNotMatch(readFileSync('lib/signals-player/index.txt','utf8'),/id="client-id"/);
});

test('temporary bridge failures retry without treating a valid login as signed out',async()=>{
  let count=0;
  const status=await signalsAccess(session,async({action})=>{
    if(action==='auth-me' && ++count===1)throw new Error('temporary timeout');
    return action==='auth-me'?{status:200,email}:{status:200,leaders:[{email,position:'Division Manager'}]};
  });
  assert.equal(status,200);assert.equal(count,2);
});

test('short player grant is session-bound, tamper resistant, and expires',async()=>{
  const {issueSignalsGrant,validSignalsGrant}=await import('../lib/signals-grant.mjs');
  const old=process.env.SPINNER_BRIDGE_TOKEN;process.env.SPINNER_BRIDGE_TOKEN='test-secret';
  try {
    const now=Date.now(),grant=issueSignalsGrant(session,now);
    assert.equal(validSignalsGrant(session,grant,now+1000),true);
    assert.equal(validSignalsGrant('b'.repeat(64),grant,now+1000),false);
    assert.equal(validSignalsGrant(session,grant+'x',now+1000),false);
    assert.equal(validSignalsGrant(session,grant,now+60000),false);
    assert.equal(validSignalsGrant('',grant,now),false);
  }finally{if(old===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=old;}
});

test('player files reuse a fresh successful check; periodic checks still reauthorize',async()=>{
  const {issueSignalsGrant}=await import('../lib/signals-grant.mjs');
  const old=process.env.SPINNER_BRIDGE_TOKEN,oldUrl=process.env.SPINNER_BRIDGE_URL,original=globalThis.fetch;
  process.env.SPINNER_BRIDGE_TOKEN='test-secret';process.env.SPINNER_BRIDGE_URL='https://example.test';
  let calls=0;
  globalThis.fetch=async()=>{calls++;return {ok:true,status:200,json:async()=>({status:401})};};
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},send(value){this.body=value;return this;},json(value){this.body=value;return this;}});
  try{
    const cookie='__Host-nest-auth='+session+'; __Host-nest-signals-grant='+issueSignalsGrant(session);
    for(const asset of ['index','app']){const res=response();await handler({method:'GET',headers:{cookie},query:{asset}},res);assert.equal(res.code,200);assert.equal(res.headers['Set-Cookie'],undefined);if(asset==='app')assert.match(res.body,/^const NEST_ACCESS_VERIFIED_UNTIL = \d{13};/);}
    assert.equal(calls,0);
    const res=response();await handler({method:'GET',headers:{cookie},query:{asset:'access'}},res);assert.equal(res.code,401);assert.equal(calls,1);assert.match(res.headers['Set-Cookie'],/Max-Age=0/);
  }finally{globalThis.fetch=original;if(old===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=old;if(oldUrl===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldUrl;}
});

test('temporary service failure shows retry without a sign-in link',async()=>{
  const old=process.env.SPINNER_BRIDGE_URL;delete process.env.SPINNER_BRIDGE_URL;
  const res={setHeader(){},status(code){this.code=code;return this;},send(value){this.body=value;return this;},json(value){this.body=value;return this;}};
  try{await handler({method:'GET',headers:{cookie:'__Host-nest-auth='+session},query:{asset:'index'}},res);assert.equal(res.code,503);assert.match(res.body,/sign-in has not been cleared/);assert.doesNotMatch(res.body,/<a[^>]*.*Sign in/);}
  finally{if(old!==undefined)process.env.SPINNER_BRIDGE_URL=old;}
});
