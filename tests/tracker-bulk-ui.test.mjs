import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('down arrow fills only unscored cells and clears a column only after confirmation',async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'manager'},ready:Promise.resolve(),open(){},logout:async()=>{}};
 const students=Array.from({length:12},(_,i)=>({id:'s'+i,name:'Student '+i,email:`s${i}@example.org`}));
 let tracker={role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students,assignments:[{id:'a',title:'Safety'}],scores:Object.fromEntries(students.map((s,i)=>[s.id,{a:i===0?'3':i===2?'4':i===3?'NE':''}])),completionScores:['4'],grants:[]};
 const updates=[],prompts=[];let confirmClear=false;
 w.confirm=message=>{prompts.push(message);return confirmClear;};
 w.fetch=async(_,options)=>{const request=JSON.parse(options.body);if(request.action==='tracker-update'){
  assert.equal(request.revision,tracker.revision);
  assert.equal(request.change.type,'scores');
  assert.ok(request.change.edits.length<=8);
  updates.push(request.change.edits);
  tracker={...tracker,revision:tracker.revision+1,scores:structuredClone(tracker.scores)};
  request.change.edits.forEach(edit=>{tracker.scores[edit.student][edit.assignment]=edit.score;});
 }return {ok:true,status:200,json:async()=>structuredClone(tracker)};};
 try{
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));q('[data-period-select]').value='1';q('[data-period-select]').dispatchEvent(new w.Event('change'));await pause(20);
  assert.equal(q('.trip-fill-column').textContent,'↓');
  q('.trip-fill-column').click();await pause(400);
  assert.equal(prompts.length,0);
  assert.deepEqual(updates.map(batch=>batch.length),[8,1]);
  assert.equal(tracker.scores.s0.a,'3');assert.equal(tracker.scores.s2.a,'4');assert.equal(tracker.scores.s3.a,'NE');
  for(const student of students.slice(1))assert.ok(tracker.scores[student.id].a);

  const first=q('tbody select');first.value='';first.dispatchEvent(new w.Event('change'));await pause(400);
  assert.equal(tracker.scores.s0.a,'');
  const before=updates.length;q('.trip-fill-column').click();await pause(20);
  assert.equal(updates.length,before);assert.match(prompts.at(-1),/Clear all 11 saved scores/);
  confirmClear=true;q('.trip-fill-column').click();await pause(400);
  assert.deepEqual(updates.slice(before).map(batch=>batch.length),[8,3]);
  for(const student of students)assert.equal(tracker.scores[student.id].a,'');
 }finally{w.close();}
});
