import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('every score has an arrow that fills empty cells while a blank source never clears saved grades',async()=>{
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
  assert.equal(w.document.querySelectorAll('.trip-fill-column').length,12);
  q('.trip-fill-column').click();await pause(400);
  assert.equal(prompts.length,0);
  assert.deepEqual(updates.map(batch=>batch.length),[8,1]);
  assert.equal(tracker.scores.s0.a,'3');assert.equal(tracker.scores.s2.a,'4');assert.equal(tracker.scores.s3.a,'NE');
  for(const student of students.slice(1))assert.ok(tracker.scores[student.id].a);

  const first=q('tbody select');first.value='';first.dispatchEvent(new w.Event('change'));await pause(400);
  assert.equal(tracker.scores.s0.a,'');
  const before=updates.length;q('.trip-fill-column').click();await pause(20);
  assert.equal(updates.length,before);assert.equal(prompts.length,0);assert.match(q('[data-status]').textContent,/Choose a score/);
  assert.equal(tracker.scores.s2.a,'4');assert.equal(tracker.scores.s3.a,'NE');
 }finally{w.close();}
});

async function rowFillUI(students,initialScores,onSave){
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'manager'},ready:Promise.resolve(),open(){}};
 let tracker={role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students,assignments:[{id:'a',title:'Safety'},{id:'b',title:'Tools'}],scores:structuredClone(initialScores),completionScores:['4'],grants:[]};
 const requests=[];w.fetch=async(_,options)=>{const request=JSON.parse(options.body);if(request.action==='tracker-update'){
  requests.push(request);const conflict=onSave?.(request,tracker,requests.length);if(conflict)return {ok:false,status:409,json:async()=>({error:'Tracker changed'})};
  assert.equal(request.revision,tracker.revision);tracker.revision++;for(const edit of request.change.edits){assert.equal('fillOnly' in edit,false);(tracker.scores[edit.student]||={})[edit.assignment]=edit.score;}
 }return {ok:true,status:200,json:async()=>structuredClone(tracker)};};
 w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));q('[data-period-select]').value='1';q('[data-period-select]').dispatchEvent(new w.Event('change'));await pause(20);
 return {dom,w,q,requests,get tracker(){return tracker;},arrow:id=>q(`select[data-student="${id}"][data-assignment="a"]`).nextElementSibling};
}
const namedStudents=[['d','Delta, Ava'],['b','Bravo, Zoe'],['a','Alpha, Mia'],['c','Charlie, Bob'],['e','Echo, Theo']].map(([id,name])=>({id,name,email:id+'@example.org'}));
test('a middle-row arrow fills only blank rows below it and only its assignment',async()=>{
 const ui=await rowFillUI(namedStudents,{a:{a:''},b:{a:'3'},c:{a:'4'},d:{a:''},e:{a:'',b:'NE'}});
 try{
  assert.equal(ui.w.document.querySelectorAll('.trip-fill-column').length,10);
  assert.match(ui.arrow('b').getAttribute('aria-label'),/Safety.*Bravo, Zoe/);ui.arrow('b').click();await pause(400);
  assert.deepEqual(ui.requests.flatMap(r=>r.change.edits).map(e=>e.student),['d','e']);
  assert.equal(ui.tracker.scores.a.a,'');assert.equal(ui.tracker.scores.c.a,'4');assert.equal(ui.tracker.scores.e.b,'NE');assert.equal(ui.tracker.scores.e.a,'3');
  ui.arrow('e').click();await pause(20);assert.equal(ui.requests.length,1);assert.match(ui.q('[data-status]').textContent,/no unscored cells below/);
 }finally{ui.w.close();}
});
test('fill-down follows the selected first-name sort rather than storage order',async()=>{
 const ui=await rowFillUI(namedStudents,{a:{a:''},b:{a:'3'},c:{a:'4'},d:{a:''},e:{a:''}});
 try{
  const sort=ui.q('.trip-student-sort');sort.value='first';sort.dispatchEvent(new ui.w.Event('change'));ui.arrow('c').click();await pause(400);
  assert.deepEqual(ui.requests.flatMap(r=>r.change.edits).map(e=>e.student),['a','e']);assert.equal(ui.tracker.scores.d.a,'');assert.equal(ui.tracker.scores.b.a,'3');
 }finally{ui.w.close();}
});
test('a concurrent grader score discovered on retry is preserved while remaining blanks are filled',async()=>{
 const students=[0,1,2,3].map(i=>({id:'s'+i,name:'Student '+i,email:'s'+i+'@example.org'}));
 const ui=await rowFillUI(students,{s0:{a:'3'},s1:{a:''},s2:{a:''},s3:{a:'NE'}},(_request,tracker,count)=>{if(count===1){tracker.scores.s1.a='4';tracker.revision++;return true;}});
 try{
  ui.arrow('s0').click();await pause(1400);assert.equal(ui.requests.length,2);assert.deepEqual(ui.requests[1].change.edits.map(e=>e.student),['s2']);
  assert.equal(ui.tracker.scores.s1.a,'4');assert.equal(ui.tracker.scores.s2.a,'3');assert.equal(ui.tracker.scores.s3.a,'NE');
 }finally{ui.w.close();}
});
