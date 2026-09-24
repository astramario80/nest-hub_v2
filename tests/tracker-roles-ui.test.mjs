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
  q('[data-period-select]').value='1';q('[data-period-select]').dispatchEvent(new w.Event('change'));await tick();
  assert.equal(q('[data-view]').hidden,false);assert.equal(q('[data-login]').hidden,true);
  assert.equal(q('[data-status]').textContent,'');
  assert.equal(Boolean(q('tbody select')),role==='manager');
  assert.equal(Boolean(q('[aria-label="New assignment title"]')),role==='manager');
  assert.equal(Boolean(q('.trip-column-drag')),role==='manager');
  assert.equal(Boolean(q('.trip-column-edit')),role==='manager');
  assert.equal(Boolean(q('.trip-movable-column .trip-column-resize')),role==='manager');
  assert.equal(Boolean(q('.trip-name-resize')),true);
  assert.equal(Boolean(q('.trip-fill-column')),role==='manager');
  assert.equal(q('tbody td').dataset.score,'4');
  assert.equal(q('.trip-column-controls'),null);
  assert.equal(q('[data-temp-access]').hidden,role==='student');
  assert.equal(q('.trip-temp-access summary')?.textContent,role==='manager'?'Shared edit access':undefined);
  if(role==='manager'){
   assert.equal(q('.trip-column-delete').textContent,'×');
   assert.equal(q('.trip-assignment-meta .trip-column-delete')!==null,true);
   assert.equal(q('[aria-label="Width for Safety in pixels"]'),null);
   assert.equal(q('.trip-column-moves'),null);
  }
  assert.equal(q('[data-period-select]').disabled,false);
  assert.equal(q('[data-refresh]').disabled,false);
  assert.equal(q('[data-export]').hidden,role!=='administrator');
  assert.equal(q('.trip-score-breakdown summary span').textContent.includes('1 student · 1 assignment'),true);
  assert.equal(q('.trip-summary'),null);
  assert.equal(q('.trip-layout-help'),null);
  assert.equal(q('.trip-column-drag span:last-child')?.title,role==='manager'?'Double-click its name to rename it, or tap Edit name below.':undefined);
  assert.deepEqual(actions,['tracker']);
 }finally{w.close();}
});

test('temporary editors can grant access with only the district email name',async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'editor'},ready:Promise.resolve(),open(){}};
 let tracker={role:'editor',period:'1',revision:1,expires:Date.now()+21600000,students:[],assignments:[],scores:{},completionScores:['4'],grants:[]};
 const changes=[];w.fetch=async(_,options)=>{const request=JSON.parse(options.body);if(request.action==='tracker-update'){changes.push(request.change);tracker={...tracker,grants:[{email:request.change.email}]};}return {ok:true,status:200,json:async()=>tracker};};
 try{
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));q('[data-period-select]').value='1';q('[data-period-select]').dispatchEvent(new w.Event('change'));await tick();
  const details=q('.trip-temp-access');assert.ok(details);details.open=true;
  const prefix=q('.trip-email-entry input'),domain=q('.trip-email-entry select');prefix.value='Taylor';domain.value='bethelsd.org';
  q('.trip-temp-access form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.deepEqual(changes,[{type:'grant',email:'Taylor@bethelsd.org'}]);
  assert.equal(q('.trip-temp-access').open,true);assert.equal(q('.trip-grants li span').textContent.includes('Taylor@bethelsd.org'),true);
  assert.equal(q('.trip-grants .trip-grant-remove').textContent,'×');
 }finally{w.close();}
});

test('assignment delete icon confirms before deleting',async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'manager'},ready:Promise.resolve(),open(){}};
 const tracker={role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students:[],assignments:[{id:'a',title:'Safety'}],scores:{},completionScores:['4'],grants:[]};
 const changes=[];w.fetch=async(_,options)=>{const request=JSON.parse(options.body);if(request.change)changes.push(request.change);return {ok:true,status:200,json:async()=>tracker};};
 try{
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));q('[data-period-select]').value='1';q('[data-period-select]').dispatchEvent(new w.Event('change'));await tick();
  w.confirm=()=>false;q('.trip-column-delete').click();assert.equal(changes.length,0);
  w.confirm=()=>true;q('.trip-column-delete').click();await tick();assert.deepEqual(changes,[{type:'delete',assignment:'a'}]);
 }finally{w.close();}
});

test('column move refreshes and retries after a stale revision',async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'manager'},ready:Promise.resolve(),open(){}};
 let tracker={role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students:[],assignments:[{id:'a',title:'First'},{id:'b',title:'Second'}],scores:{},completionScores:['4'],grants:[]};
 const requests=[];w.fetch=async(_,options)=>{const request=JSON.parse(options.body);requests.push(request);
  if(request.change?.type==='reorder'&&request.revision===1)return {ok:false,status:409,json:async()=>({error:'Another person saved changes.'})};
  if(request.action==='tracker'&&requests.length>1)tracker={...tracker,revision:2};
  if(request.change?.type==='reorder')tracker={...tracker,revision:3,assignments:request.change.order.map(id=>tracker.assignments.find(a=>a.id===id))};
  return {ok:true,status:200,json:async()=>tracker};};
 const pointer=(target,type,x)=>{const event=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{pointerId:{value:1},button:{value:0},clientX:{value:x}});target.dispatchEvent(event);};
 try{
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));q('[data-period-select]').value='1';q('[data-period-select]').dispatchEvent(new w.Event('change'));await tick();
  q('.trip-table-scroll').getBoundingClientRect=()=>({left:0,right:800});
  [...w.document.querySelectorAll('thead th[data-assignment]')].forEach((th,i)=>{th.getBoundingClientRect=()=>({left:190+i*180,width:180});});
  pointer(q('.trip-column-drag'),'pointerdown',280);pointer(w,'pointermove',600);pointer(w,'pointerup',600);await tick();
  assert.deepEqual(requests.map(r=>[r.action,r.revision]),[['tracker',undefined],['tracker-update',1],['tracker',undefined],['tracker-update',2]]);
  assert.deepEqual([...w.document.querySelectorAll('thead th[data-assignment]')].map(th=>th.dataset.assignment),['b','a']);
  assert.equal(q('[data-status]').textContent,'Column order saved.');
 }finally{w.close();}
});

test('compact toolbar changes periods, refreshes, and downloads the selected period',async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'administrator'},ready:Promise.resolve(),open(){},logout:async()=>{}};
 const requests=[];w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 w.fetch=async(_,options)=>{const request=JSON.parse(options.body);requests.push([request.action,request.period]);return {ok:true,status:200,json:async()=>({role:'administrator',period:request.period,revision:1,expires:Date.now()+21600000,students:[],assignments:[],scores:{},completionScores:['4'],grants:[]})};};
 try{
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));
  assert.equal(q('[data-refresh]').disabled,true);assert.equal(q('[data-export]').hidden,true);
  const period=q('[data-period-select]');period.value='2';period.dispatchEvent(new w.Event('change'));await tick();
  assert.equal(q('[data-export]').hidden,false);assert.equal(q('[data-refresh]').disabled,false);
  assert.equal(q('[data-status]').textContent,'');
  period.value='3';period.dispatchEvent(new w.Event('change'));await tick();
  q('[data-refresh]').click();await tick();q('[data-export]').click();await tick();
  assert.deepEqual(requests,[['tracker','2'],['tracker','3'],['tracker','3'],['export','3']]);
  assert.equal(q('.trip-score-breakdown')!==null,true);
  assert.equal([...w.document.querySelectorAll('#trip-app button')].some(button=>button.textContent.includes('Sign out')),false);
 }finally{w.close();}
});

test('double-click and single-tap Edit name both open assignment renaming',async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'manager'},open(){},logout:async()=>{}};
 let tracker={role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students:[],assignments:[{id:'a',title:'Safety'}],scores:{},completionScores:['4'],grants:[]};
 const changes=[];
 w.fetch=async(_,options)=>{const request=JSON.parse(options.body);if(request.action==='tracker-update'){
  changes.push(request.change);tracker={...tracker,revision:tracker.revision+1,assignments:tracker.assignments.map(a=>a.id===request.change.assignment?{...a,title:request.change.title}:a)};
 }return {ok:true,status:200,json:async()=>tracker};};
 try{
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));q('[data-period-select]').value='1';q('[data-period-select]').dispatchEvent(new w.Event('change'));await tick();
  q('.trip-column-drag').dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true,cancelable:true}));
  const input=q('.trip-inline-title');assert.ok(input);assert.equal(input.value,'Safety');
  input.value='  New safety task  ';input.blur();await tick();
  assert.deepEqual(changes,[{type:'rename',assignment:'a',title:'New safety task'}]);
  assert.equal(q('.trip-column-drag span:last-child').textContent,'New safety task');
  assert.equal(q('.trip-column-edit').getAttribute('aria-label'),'Edit assignment name for New safety task');
  q('.trip-column-edit').click();
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
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));q('[data-period-select]').value='1';q('[data-period-select]').dispatchEvent(new w.Event('change'));await tick();
  const scroll=q('.trip-table-scroll');scroll.getBoundingClientRect=()=>({left:0,right:800});
  [...w.document.querySelectorAll('thead th[data-assignment]')].forEach((th,i)=>{th.getBoundingClientRect=()=>({left:190+i*180,width:180});});
  pointer(q('.trip-column-drag'),'pointerdown',280);pointer(w,'pointermove',700);pointer(w,'pointerup',700);await tick();
  assert.deepEqual(changes[0],{type:'reorder',order:['b','c','a']});
  const grip=q('.trip-movable-column .trip-column-resize');pointer(grip,'pointerdown',300);pointer(w,'pointermove',350);
  assert.equal(q('colgroup col:nth-child(2)').style.width,'230px');
  pointer(w,'pointerup',350);await tick();
  assert.deepEqual(changes[1],{type:'resize',assignment:'b',width:230});
  assert.equal(q('colgroup col:nth-child(2)').style.width,'230px');
  const currentGrip=q('.trip-movable-column .trip-column-resize');pointer(currentGrip,'pointerdown',350);pointer(w,'pointermove',390);
  w.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));
  assert.equal(q('colgroup col:nth-child(2)').style.width,'230px');
  assert.equal(changes.length,2);
 }finally{w.close();}
});
