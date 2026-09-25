import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function setup(fetch){
  const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'});
  const w=dom.window;w.AbortSignal=AbortSignal;
  w.NestAuth={identity:{username:'manager'},ready:Promise.resolve(),open(){}};
  w.fetch=fetch;
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));
  const period=w.document.querySelector('[data-period-select]');period.value='1';period.dispatchEvent(new w.Event('change'));
  return {dom,w,q:s=>w.document.querySelector(s)};
}
function tracker(){return {role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students:[{id:'s',name:'Student',email:'student@example.org'}],assignments:[{id:'a',title:'Safety'}],scores:{s:{a:''}},completionScores:['4'],grants:[]};}
function edit(w,q,value){const select=q('tbody select');select.value=value;select.dispatchEvent(new w.Event('change'));}

test('rapid edits use last write, retry a temporary failure, and confirm the final value',async()=>{
  let data=tracker(),fail=true;const updates=[];
  const {dom,w,q}=setup(async(_,options)=>{
    const body=JSON.parse(options.body);
    if(body.action==='tracker-update'){
      updates.push(body);
      if(fail){fail=false;return {ok:false,status:503,json:async()=>({error:'Temporarily unavailable'})};}
      assert.equal(body.revision,data.revision);
      data={...data,revision:data.revision+1,scores:{s:{a:body.change.edits.at(-1).score}}};
    }
    return {ok:true,status:200,json:async()=>structuredClone(data)};
  });
  try{
    await tick();edit(w,q,'4');edit(w,q,'3');edit(w,q,'2');
    await delay(220);
    assert.equal(updates.length,1);assert.deepEqual(updates[0].change.edits,[{student:'s',assignment:'a',score:'2'}]);
    assert.match(q('[data-save-notice]').textContent,/retrying/);
    await delay(1100);
    assert.equal(updates.length,2);assert.equal(data.scores.s.a,'2');
    assert.match(q('[data-save-notice]').textContent,/All scores saved/);
  }finally{dom.window.close();}
});

test('sharing a full district email waits for pending score saves and reports success',async()=>{
  let data=tracker(),completeScore;const updates=[];
  const {dom,w,q}=setup(async(_,options)=>{
    const body=JSON.parse(options.body);
    if(body.action==='tracker-update'){
      updates.push(body);
      if(body.change.type==='scores')return new Promise(resolve=>{completeScore=()=>{data={...data,revision:2,scores:{s:{a:'4'}}};resolve({ok:true,status:200,json:async()=>structuredClone(data)});};});
      data={...data,grants:[{email:body.change.email.toLowerCase()}]};
    }
    return {ok:true,status:200,json:async()=>structuredClone(data)};
  });
  try{
    await tick();edit(w,q,'4');await delay(220);
    q('.trip-temp-access').open=true;
    const input=q('.trip-email-entry input');input.value='helper@students.bethelsd.org';
    assert.equal(input.checkValidity(),true);
    q('.trip-temp-access form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(updates.length,1);
    completeScore();await tick();
    assert.equal(updates.length,2);
    assert.equal(updates[1].revision,2);
    assert.deepEqual(updates[1].change,{type:'grant',email:'helper@students.bethelsd.org'});
    assert.match(q('[data-status]').textContent,/Edit access shared/);
    assert.equal(q('.trip-grants li span').textContent,'helper@students.bethelsd.org');
  }finally{dom.window.close();}
});
