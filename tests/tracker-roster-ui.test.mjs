import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const tracker={role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students:[
 {id:'z',name:'Zebra, Amy',email:'amy@example.org',leadershipRole:'Division Manager'},
 {id:'a',name:'Able, Zoe',email:'zoe@example.org',leadershipRole:''},
 {id:'m',name:'Middle, Ben',email:'ben@example.org',leadershipRole:'Safety Lead'}
],assignments:[{id:'x',title:'Assignment'}],scores:{z:{x:''},a:{x:''},m:{x:''}},completionScores:['4'],grants:[]};

function page(saved){
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;
 w.NestAuth={identity:{username:'teacher'},ready:Promise.resolve(),open(){},logout:async()=>{}};
 w.fetch=async()=>({ok:true,status:200,json:async()=>structuredClone(tracker)});
 if(saved)w.localStorage.setItem('nest-tracker-display:teacher:1',saved);
 w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));
 const period=q('[data-period-select]');period.value='1';period.dispatchEvent(new w.Event('change'));
 return {dom,w,q};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const names=w=>[...w.document.querySelectorAll('tbody th a')].map(link=>link.textContent);

test('student name width, name order, and role visibility persist for the signed-in user',async()=>{
 const {dom,w,q}=page();
 try{
  await tick();assert.deepEqual(names(w),['Able, Zoe','Middle, Ben','Zebra, Amy']);
  assert.equal(q('.trip-leadership-role').hidden,false);
  const sort=q('.trip-student-sort');sort.value='first';sort.dispatchEvent(new w.Event('change'));assert.deepEqual(names(w),['Zebra, Amy','Middle, Ben','Able, Zoe']);
  q('.trip-role-toggle').click();assert.equal(q('.trip-leadership-role').hidden,true);
  const grip=q('.trip-name-resize');
  const pointer=(target,type,x)=>{const event=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{pointerId:{value:1},button:{value:0},clientX:{value:x}});target.dispatchEvent(event);};
  pointer(grip,'pointerdown',190);pointer(w,'pointermove',250);pointer(w,'pointerup',250);
  assert.equal(q('colgroup col:first-child').style.width,'250px');
  const saved=w.localStorage.getItem('nest-tracker-display:teacher:1');assert.deepEqual(JSON.parse(saved),{sort:'first',showRoles:false,nameWidth:250});
  const next=page(saved);
  try{await tick();assert.deepEqual(names(next.w),['Zebra, Amy','Middle, Ben','Able, Zoe']);assert.equal(next.q('.trip-leadership-role').hidden,true);assert.equal(next.q('colgroup col:first-child').style.width,'250px');}
  finally{next.dom.window.close();}
 }finally{dom.window.close();}
});
