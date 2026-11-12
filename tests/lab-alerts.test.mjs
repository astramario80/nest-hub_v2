import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function browser(){
 const dom=new JSDOM('<body><button id="outside">Outside</button><dialog id="review"><h2>Review request</h2><button id="close">Close</button></dialog></body>',{runScripts:'outside-only',url:'https://gknest.org/lab-request',pretendToBeVisual:true}),w=dom.window;
 const state={callbacks:0,loopPrevented:false,calls:[],events:[{id:'request:pending',requestId:'11111111-1111-4111-a111-111111111111',revision:1,name:'Example, Student',day:'2026-10-28',time:'10:00',kind:'request'}]};
 // Bound a broken observer so the regression fails instead of hanging the test runner.
 const OriginalObserver=w.MutationObserver;
 w.MutationObserver=class extends OriginalObserver{constructor(callback){super((records,observer)=>{state.callbacks++;if(state.callbacks>40){state.loopPrevented=true;observer.disconnect();return;}callback(records,observer);});}};
 w.NestAuth={identity:{signedIn:true,email:'mpenalver@bethelsd.org'},ready:Promise.resolve()};
 w.fetch=async(url,options)=>{state.calls.push({url,options});return {ok:true,json:async()=>({eligible:true,events:state.events})};};
 w.eval(fs.readFileSync('js/lab-request-alerts.js','utf8'));await tick();return {dom,w,state};
}
test('an alert settles when a request dialog opens and closes instead of mutating forever',async()=>{
 const {dom,w,state}=await browser();try{
  const dialog=w.document.getElementById('review');assert.equal(w.document.querySelectorAll('.nest-lab-alert').length,1);
  dialog.setAttribute('open','');await tick();assert.equal(state.loopPrevented,false,'Alert observer recursively rebuilt its own dialog content');assert.ok(state.callbacks<10);assert.equal(w.document.querySelector('.nest-lab-alert').parentElement,dialog);
  const alert=w.document.querySelector('.nest-lab-alert');dialog.append(w.document.createElement('p'));await tick();assert.equal(w.document.querySelector('.nest-lab-alert'),alert);
  dialog.removeAttribute('open');await tick();assert.equal(w.document.querySelector('.nest-lab-alert').parentElement,w.document.body);assert.equal(state.loopPrevented,false);
 }finally{dom.window.close();}
});
test('repeated unchanged polls preserve the alert and focused control',async()=>{
 const {dom,w,state}=await browser();try{const alert=w.document.querySelector('.nest-lab-alert'),button=alert.querySelector('button');button.focus();for(let i=0;i<5;i++)await w.NestLabAlerts.check();assert.equal(w.document.querySelector('.nest-lab-alert'),alert);assert.equal(w.document.activeElement,button);assert.equal(state.loopPrevented,false);}finally{dom.window.close();}
});
test('changed alerts render, dismissal works inside a modal, and logout removes private content',async()=>{
 const {dom,w,state}=await browser();try{w.document.getElementById('review').setAttribute('open','');await tick();state.events=[{...state.events[0],name:'Second, Example'}];await w.NestLabAlerts.check();assert.match(w.document.querySelector('.nest-lab-alert').textContent,/Second, Example/);w.document.querySelector('.nest-lab-alert button').click();await tick();assert.equal(w.document.querySelector('.nest-lab-alert'),null);assert.equal(state.loopPrevented,false);w.NestAuth.identity.signedIn=false;w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(w.document.body.textContent.includes('Second, Example'),false);}finally{dom.window.close();}
});
