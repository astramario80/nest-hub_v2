import test from 'node:test';
import assert from 'node:assert/strict';
import {bridge,bridgeFailure} from '../lib/nest-auth.mjs';
async function run(action,fetcher){
 const oldFetch=globalThis.fetch,env={...process.env};Object.assign(process.env,{SPINNER_BRIDGE_URL:'https://school.invalid',SPINNER_BRIDGE_TOKEN:'private-token'});globalThis.fetch=fetcher;
 try{return await bridge({action:'auth-division-slides',operation:'access',...action},3000);}finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);}
}
test('transient read submission failures retry fresh live access; explicit denials do not',async()=>{
 let posts=0;const result=await run({},async()=>{if(++posts===1)throw new TypeError('fetch failed',{cause:{code:'ECONNRESET'}});return Response.json({status:200});});assert.equal(result.status,200);assert.equal(posts,2);
 posts=0;assert.equal((await run({},async()=>{posts++;return Response.json({status:403});})).status,403);assert.equal(posts,1);
 posts=0;await assert.rejects(run({},async()=>{posts++;return new Response('',{status:403});}),/HTTP 403/);assert.equal(posts,1);
});
test('lost result bodies retry the same Google result URL without repeating an update',async()=>{
 let posts=0,gets=0;const result=await run({operation:'start'},async(url,options)=>{
  if(options.method==='POST'){posts++;return new Response(null,{status:302,headers:{location:'https://script.googleusercontent.com/result'}});}
  gets++;if(gets===1)return {ok:true,json:async()=>{throw new TypeError('terminated',{cause:{code:'UND_ERR_SOCKET'}});}};
  return Response.json({status:200,state:'queued'});
 });assert.equal(result.state,'queued');assert.equal(posts,1);assert.equal(gets,2);
});
test('unknown write submission failures never replay; unexpected redirect hosts never receive credentials',async()=>{
 let calls=0;await assert.rejects(run({operation:'start'},async()=>{calls++;throw new TypeError('fetch failed');}),/fetch failed/);assert.equal(calls,1);
 calls=0;await assert.rejects(run({},async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://evil.invalid/result'}});}),/Unexpected Google response host/);assert.equal(calls,1);
 const fault=bridgeFailure(Object.assign(new TypeError('private URL and token'),{bridgeStage:'school-result',cause:{code:'UND_ERR_SOCKET',address:'private-address'}}));assert.deepEqual(fault,{kind:'TypeError',stage:'school-result',code:'UND_ERR_SOCKET'});assert.doesNotMatch(JSON.stringify(fault),/private/);
});

test('an unavailable read result starts a new read without replaying mutation results',async()=>{
 for(const operation of ['access','start']){let posts=0;const result=await run({operation},async(url,options)=>{if(options.method==='POST'){posts++;return new Response(null,{status:302,headers:{location:'https://script.googleusercontent.com/result'}});}return Response.json({status:posts===1?503:200});});assert.equal(posts,operation==='access'?2:1);assert.equal(result.status,operation==='access'?200:503);}
});
