import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/hiring.mjs';
const res=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
const headers={cookie:'__Host-nest-auth='+'a'.repeat(64),origin:'https://gknest.org',host:'gknest.org','content-type':'application/json'};
test('hiring API rejects cross-site changes and malformed ratings before reaching the school bridge',async()=>{
 let r=res();await handler({method:'POST',headers:{...headers,origin:'https://outside.test'},body:{action:'partner',period:'1'}},r);assert.equal(r.code,403);
 r=res();await handler({method:'POST',headers,body:{action:'review',period:'1',key:'b'.repeat(64),revision:'c'.repeat(64),notes:'Note',scores:[1,2,3,5]}},r);assert.equal(r.code,400);
 r=res();await handler({method:'POST',headers:{...headers,cookie:''},body:{action:'partner',period:'1',position:'Assistant Manager',studentEmail:'student@students.bethelsd.org'}},r);assert.equal(r.code,401);
});
test('API accepts extended assignments and partner actions; returned hiring data stays private',async()=>{
 const previousFetch=global.fetch,previousUrl=process.env.SPINNER_BRIDGE_URL,previousToken=process.env.SPINNER_BRIDGE_TOKEN,calls=[];
 process.env.SPINNER_BRIDGE_URL='https://school.test/exec';process.env.SPINNER_BRIDGE_TOKEN='test-secret';
 global.fetch=async (_url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({status:200,name:'Student',email:'student@students.bethelsd.org',sharingQueued:true})};};
 try{
  for(const action of ['assign','partner']){const r=res();await handler({method:'POST',headers,body:{action,period:'1',row:25,position:'Software Technician',expectedName:'Previous',expectedEmail:'previous@students.bethelsd.org',studentEmail:'student@students.bethelsd.org',canManage:true}},r);assert.equal(r.code,200);assert.equal(r.data.sharingQueued,true);assert.match(r.headers['Cache-Control'],/no-store/);assert.equal(r.headers.Vary,'Cookie');}
  assert.equal(calls[0].action,'auth-hiring-assign');assert.equal(calls[0].row,25);assert.equal(calls[1].action,'auth-hiring-partner');assert.equal(calls[1].canManage,undefined);
 }finally{global.fetch=previousFetch;if(previousUrl===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=previousUrl;if(previousToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=previousToken;}
});
