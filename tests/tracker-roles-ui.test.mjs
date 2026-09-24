import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const role of ['student','manager'])test(`verified ${role} opens tracker with correct controls`,async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 const actions=[];w.NestAuth={identity:{username:'student'},ready:Promise.resolve(),open(){},logout:async()=>{}};
 const tracker={role,period:'1',revision:1,expires:Date.now()+21600000,students:[{id:'a',name:'Example Student',email:'example@example.org'}],assignments:[{id:'x',title:'Safety'}],scores:{a:{x:'4'}},completionScores:['4'],grants:[]};
 w.fetch=async(_,options)=>{const r=JSON.parse(options.body);actions.push(r.action);if(r.action==='tracker')return {ok:true,status:200,json:async()=>tracker};return {ok:true,json:async()=>({})};};
 try{
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));
  q('[data-period="1"]').click();await tick();
  assert.equal(q('[data-view]').hidden,false);assert.equal(q('[data-login]').hidden,true);
  assert.match(q('[data-status]').textContent,role==='manager'?/Editing enabled/:/View only/);
  assert.equal(Boolean(q('tbody select')),role==='manager');
  assert.equal(Boolean(q('[aria-label="New assignment title"]')),role==='manager');
  assert.equal(q('[data-period="1"]').disabled,false);
  assert.deepEqual(actions,['tracker']);
 }finally{w.close();}
});
