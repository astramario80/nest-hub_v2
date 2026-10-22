import test from 'node:test';
import assert from 'node:assert/strict';
import {emailIdentity} from '../lib/email-identity.mjs';
import {IDENTITY,signedIdentity} from '../lib/nest-auth.mjs';
const session='a'.repeat(64),identity={status:200,email:'manager@students.bethelsd.org',username:'manager',expires:Date.now()+3600000};
async function check({cached=false,tampered=false,expired=false,unavailable=false}={}){
 const env={...process.env},old=globalThis.fetch,calls=[];Object.assign(process.env,{SPINNER_BRIDGE_URL:'https://school.invalid',SPINNER_BRIDGE_TOKEN:'private-identity-test'});
 let signed=signedIdentity(session,identity);if(tampered)signed+='x';
 const headers={};globalThis.fetch=async()=>{calls.push(1);if(unavailable)throw new Error('Read timeout');return new Response(JSON.stringify(expired?{status:401}:calls.length===1&&!cached&&!tampered?{status:503}:identity));};
 try{const data=await emailIdentity({headers:{cookie:cached||tampered?IDENTITY+'='+signed:''}},{setHeader(k,v){headers[k]=v;}},session);return {data,calls,headers};}
 finally{globalThis.fetch=old;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);}
}
test('email reads reuse only a valid session-bound signed identity without calling the school',async()=>{
 const result=await check({cached:true});assert.equal(result.calls.length,0);assert.equal(result.data.email,identity.email);
 const tampered=await check({tampered:true});assert.equal(tampered.calls.length,1);assert.equal(tampered.data.email,identity.email);assert.match(tampered.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict; Max-Age=300/);
});
test('identity retries a transient read, refreshes the signed cookie, and stops on explicit session expiry',async()=>{
 const result=await check();assert.equal(result.calls.length,2);assert.equal(result.data.email,identity.email);assert.ok(result.headers['Set-Cookie']);
 const expired=await check({expired:true});assert.equal(expired.calls.length,1);assert.equal(expired.data.status,401);
 await assert.rejects(check({unavailable:true}),/Read timeout/);
});
