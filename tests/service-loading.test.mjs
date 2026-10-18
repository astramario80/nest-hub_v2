import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const settle=()=>new Promise(resolve=>setTimeout(resolve,15));
function setup(){
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{url:'https://gknest.org/service',runScripts:'outside-only'}),w=dom.window,pending=[];
 w.NestAuth={identity:{signedIn:true},ready:Promise.resolve()};w.confirm=()=>true;
 w.fetch=(url,options)=>new Promise((resolve,reject)=>{
  const op=new URL(url,'https://gknest.org').searchParams.get('operation');
  if(op!=='manage'){resolve({ok:true,json:async()=>({email:'staff@bethelsd.org',requests:[]})});return;}
  const entry={resolve:data=>resolve({ok:true,json:async()=>data}),signal:options.signal};pending.push(entry);
  options.signal.addEventListener('abort',()=>reject(new w.DOMException('Aborted','AbortError')),{once:true});
 });
 w.eval(fs.readFileSync('js/service.js','utf8'));return {dom,w,pending};
}
const workspace={requests:[],managers:[],metrics:[],students:[],statuses:['Assigned']};
test('sign-in prepares workspace; repeated pending gear clicks share one read and can return to front',async()=>{
 const {dom,w,pending}=setup();await settle();assert.equal(pending.length,1);const gear=w.document.getElementById('service-gear');gear.click();gear.click();assert.equal(pending.length,1);assert.equal(w.document.getElementById('service-gear-status').textContent,'');pending[0].resolve(workspace);await settle();assert.equal(w.document.getElementById('view-manage').hidden,true);gear.click();await settle();assert.equal(pending.length,1);assert.equal(w.document.getElementById('view-manage').hidden,false);dom.window.close();
});
test('account change aborts old load and cannot expose its late response or leave checking status',async()=>{
 const {dom,w,pending}=setup();await settle();w.document.getElementById('service-gear').click();w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));await settle();assert.equal(pending[0].signal.aborted,true);pending[0].resolve({...workspace,requests:[{name:'Old private data'}]});await settle();assert.equal(w.document.getElementById('view-manage').hidden,true);assert.equal(w.document.getElementById('service-gear-status').textContent,'');assert.equal(w.document.body.textContent.includes('Old private data'),false);dom.window.close();
});
test('a stalled read or JSON body has a deadline, retry remains available and backend stays hidden',async()=>{
 const {dom,w,pending}=setup();await settle();w.document.getElementById('service-gear').click();
 // Fire only the actual request deadline without waiting 50 seconds.
 // Capture a second load's timer after invalidating the first identity.
 const native=w.setTimeout.bind(w);let deadline;
 w.setTimeout=(fn,ms)=>{if(ms===50000){deadline=fn;return 12345;}return native(fn,ms);};
 w.document.dispatchEvent(new w.Event('nest-auth-change'));await settle();assert.equal(pending.length,2);deadline();await settle();assert.equal(pending[1].signal.aborted,true);assert.match(w.document.getElementById('service-gear-status').textContent,/took too long/);assert.equal(w.document.getElementById('view-manage').hidden,true);
 w.document.getElementById('service-gear').click();await settle();assert.equal(pending.length,3);pending[2].resolve(workspace);await settle();assert.equal(w.document.getElementById('view-manage').hidden,false);dom.window.close();
});
