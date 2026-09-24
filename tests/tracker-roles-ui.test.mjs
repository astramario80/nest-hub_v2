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
  assert.equal(Boolean(q('.trip-column-drag')),role==='manager');
  assert.equal(Boolean(q('.trip-column-resize')),role==='manager');
  assert.equal(Boolean(q('.trip-fill-column')),role==='manager');
  assert.equal(q('tbody td').dataset.score,'4');
  assert.equal(Boolean(q('.trip-column-controls')),role==='manager');
  if(role==='manager'){
   assert.equal(q('.trip-column-controls summary').textContent,'Column options');
   assert.equal(q('.trip-column-delete').textContent,'Delete column');
   assert.equal(q('[aria-label="Width for Safety in pixels"]'),null);
   assert.equal(q('.trip-column-moves'),null);
   assert.equal(q('.trip-column-controls form'),null);
  }
  assert.equal(q('[data-period="1"]').disabled,false);
  assert.deepEqual(actions,['tracker']);
 }finally{w.close();}
});

test('double-clicking an assignment name edits it and clicking elsewhere saves',async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'manager'},open(){},logout:async()=>{}};
 let tracker={role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students:[],assignments:[{id:'a',title:'Safety'}],scores:{},completionScores:['4'],grants:[]};
 const changes=[];
 w.fetch=async(_,options)=>{const request=JSON.parse(options.body);if(request.action==='tracker-update'){
  changes.push(request.change);tracker={...tracker,revision:tracker.revision+1,assignments:tracker.assignments.map(a=>a.id===request.change.assignment?{...a,title:request.change.title}:a)};
 }return {ok:true,status:200,json:async()=>tracker};};
 try{
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));q('[data-period="1"]').click();await tick();
  q('.trip-column-drag').dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true,cancelable:true}));
  const input=q('.trip-inline-title');assert.ok(input);assert.equal(input.value,'Safety');
  input.value='  New safety task  ';input.blur();await tick();
  assert.deepEqual(changes,[{type:'rename',assignment:'a',title:'New safety task'}]);
  assert.equal(q('.trip-column-drag span:last-child').textContent,'New safety task');
  q('.trip-column-drag').dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true,cancelable:true}));
  const canceled=q('.trip-inline-title');canceled.value='Discard this';canceled.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));await tick();
  assert.equal(changes.length,1);
  assert.equal(q('.trip-column-drag span:last-child').textContent,'New safety task');
 }finally{w.close();}
});

test('dragging a heading reorders columns and dragging its edge saves the new width',async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'manager'},open(){},logout:async()=>{}};
 let tracker={role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students:[],assignments:[{id:'a',title:'First'},{id:'b',title:'Second'},{id:'c',title:'Third'}],scores:{},completionScores:['4'],grants:[]};
 const changes=[];
 w.fetch=async(_,options)=>{const request=JSON.parse(options.body);if(request.action==='tracker-update'){
   changes.push(request.change);
   if(request.change.type==='reorder')tracker={...tracker,assignments:request.change.order.map(id=>tracker.assignments.find(a=>a.id===id)),revision:tracker.revision+1};
   if(request.change.type==='resize')tracker={...tracker,assignments:tracker.assignments.map(a=>a.id===request.change.assignment?{...a,width:request.change.width}:a),revision:tracker.revision+1};
  }return {ok:true,status:200,json:async()=>tracker};};
 const pointer=(target,type,x)=>{const event=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{pointerId:{value:1},button:{value:0},clientX:{value:x}});target.dispatchEvent(event);};
 try{
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));q('[data-period="1"]').click();await tick();
  const scroll=q('.trip-table-scroll');scroll.getBoundingClientRect=()=>({left:0,right:800});
  [...w.document.querySelectorAll('thead th[data-assignment]')].forEach((th,i)=>{th.getBoundingClientRect=()=>({left:190+i*180,width:180});});
  pointer(q('.trip-column-drag'),'pointerdown',280);pointer(w,'pointermove',700);pointer(w,'pointerup',700);await tick();
  assert.deepEqual(changes[0],{type:'reorder',order:['b','c','a']});
  const grip=q('.trip-column-resize');pointer(grip,'pointerdown',300);pointer(w,'pointermove',350);
  assert.equal(q('colgroup col:nth-child(2)').style.width,'230px');
  pointer(w,'pointerup',350);await tick();
  assert.deepEqual(changes[1],{type:'resize',assignment:'b',width:230});
  assert.equal(q('colgroup col:nth-child(2)').style.width,'230px');
  const currentGrip=q('.trip-column-resize');pointer(currentGrip,'pointerdown',350);pointer(w,'pointermove',390);
  w.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));
  assert.equal(q('colgroup col:nth-child(2)').style.width,'230px');
  assert.equal(changes.length,2);
 }finally{w.close();}
});
