import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import handler from '../api/division.mjs';
import {DIVISIONS} from '../lib/divisions.mjs';
const tick=()=>new Promise(r=>setTimeout(r,25));
const id='12345678-1234-1234-1234-123456789abc';
function ui(canManage=true){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/'}),w=dom.window,calls=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.AbortSignal=AbortSignal;w.NestAuth={identity:{signedIn:true,email:'manager@students.bethelsd.org'},ready:Promise.resolve(),open(){}};
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({canManage})};};
 w.eval(fs.readFileSync('js/division-workspace.js','utf8'));
 w.document.querySelector('[data-division-workspace="1"]').click();return {dom,w,calls};
}
test('division folder, slideshow and control screen share one window with verified division-specific sources',async()=>{
 const {w,calls}=ui();await tick();const dialog=w.document.querySelector('.division-workspace');
 assert.equal(dialog.open,true);assert.match(dialog.querySelector('iframe').src,new RegExp(DIVISIONS['1'].folder));
 dialog.querySelector('[data-screen=slides]').click();assert.match(dialog.querySelector('iframe').src,new RegExp(DIVISIONS['1'].slides));
 assert.equal(dialog.querySelector('[data-load]').disabled,false);
 dialog.querySelector('[data-screen=control]').click();assert.equal(dialog.querySelector('iframe'),null);assert.match(dialog.textContent,/title slide/);
 assert.match(dialog.querySelector('.division-original').href,/#gid=0$/);assert.equal(calls.length,1);
 dialog.querySelector('[data-close]').click();assert.equal(dialog.querySelector('iframe'),null);w.close();
});
test('ordinary members cannot trigger a slide update',async()=>{
 const {w,calls}=ui(false);await tick();const button=w.document.querySelector('[data-load]');assert.equal(button.disabled,true);button.click();assert.equal(calls.length,1);w.close();
});
test('slide update queues once and completion refreshes the manager slideshow',async()=>{
 const {w,calls}=ui();await tick();let state='queued',pollTimer;
 w.setTimeout=callback=>{pollTimer=callback;return 1;};w.clearTimeout=()=>{};
 w.fetch=async(url,options)=>{calls.push({url,options});const job=options.method==='POST'?JSON.parse(options.body).job:new URL(url,'https://gknest.org').searchParams.get('job');return {ok:true,json:async()=>({job,state})};};
 const dialog=w.document.querySelector('.division-workspace');dialog.querySelector('[data-screen=slides]').click();const oldFrame=dialog.querySelector('iframe');
 const button=dialog.querySelector('[data-load]');button.click();button.click();await tick();
 assert.equal(calls.filter(c=>c.options.method==='POST').length,1);assert.match(dialog.querySelector('[role=status]').textContent,/queued/);
 state='completed';pollTimer();await tick();assert.match(dialog.querySelector('[role=status]').textContent,/updated/);
 assert.notEqual(oldFrame,dialog.querySelector('iframe'));assert.equal(button.disabled,false);w.close();
});
test('closing and reopening resumes a queued update without starting another',async()=>{
 const {w,calls}=ui();await tick();
 w.fetch=async(url,options)=>{calls.push({url,options});const job=options.method==='POST'?JSON.parse(options.body).job:new URL(url,'https://gknest.org').searchParams.get('job');return {ok:true,json:async()=>job?{job,state:'queued'}:{canManage:true}};};
 const dialog=w.document.querySelector('.division-workspace');dialog.querySelector('[data-load]').click();await tick();dialog.querySelector('[data-close]').click();
 w.document.querySelector('[data-division-workspace="1"]').click();await tick();
 assert.match(dialog.querySelector('[role=status]').textContent,/queued/);assert.equal(calls.filter(c=>c.options.method==='POST').length,1);w.close();
});
const res=()=>({code:200,setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
test('division API rejects unsigned sessions, forged targets and cross-site starts',async()=>{
 let r=res();await handler({method:'GET',headers:{},query:{period:'1'}},r);assert.equal(r.code,401);
 r=res();await handler({method:'GET',headers:{},query:{period:'__proto__'}},r);assert.equal(r.code,400);
 r=res();await handler({method:'POST',headers:{origin:'https://example.com',host:'gknest.org','content-type':'application/json'},body:{action:'load-slides',period:'1',job:id}},r);assert.equal(r.code,403);
});
function queue(){
 const properties=new Map(),setups=[],updates=[];
 const store={getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v),deleteProperty:k=>properties.delete(k),getProperties:()=>Object.fromEntries(properties)};
 let allowed=true;
 const ctx=vm.createContext({console,Date,ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},Utilities:{DigestAlgorithm:{SHA_256:'sha'},computeDigest:()=>Array.from(Buffer.from('fa73c87e353c83d23f5a447adf018eda6be9a8096a6d84e03318eb8833f984cf','hex'))},PropertiesService:{getScriptProperties:()=>store},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},ScriptApp:{getProjectTriggers:()=>[{getHandlerFunction:()=> 'nestDivisionSlidesWorker'}]},SpreadsheetApp:{openById:()=>({getSheetByName:()=>({getRange:range=>range==='B2:F99'?{getValues:()=>allowed?[['Period 1','','Division Manager','','manager@students.bethelsd.org']]:[]}:{setValue:value=>setups.push(value)}})})},updateManagerSlides:(division,locked)=>updates.push({division,locked})});
 vm.runInContext(fs.readFileSync('google-control-center/NestDivisionWeb.js','utf8'),ctx);
 const call=r=>ctx.doPost({postData:{contents:JSON.stringify({token:'test',period:'1',email:'manager@students.bethelsd.org',job:id,...r})}});
 return {ctx,properties,updates,setups,call,revoke:()=>{allowed=false;}};
}
test('queue is idempotent, excludes simultaneous division updates, and worker runs the original routine',()=>{
 const q=queue();assert.equal(q.call({operation:'start'}).state,'queued');assert.equal(q.call({operation:'start'}).state,'queued');
 assert.equal(q.call({operation:'start',job:'aaaaaaaa-1234-1234-1234-123456789abc'}).status,409);
 q.ctx.nestDivisionSlidesWorker();assert.deepEqual(q.updates,[{division:'Division 1',locked:true}]);assert.deepEqual(q.setups,['Slides Updated']);
 assert.equal(q.call({operation:'status'}).state,'completed');
 assert.equal(q.call({operation:'status',period:'2'}).status,403);
});
test('worker checks the live manager role again before changing slides',()=>{
 const q=queue();q.call({operation:'start'});q.revoke();q.ctx.nestDivisionSlidesWorker();assert.equal(q.updates.length,0);
 assert.equal(JSON.parse(q.properties.get('nest-slide-job:'+id)).state,'failed');
});

test('every window uses the same verified folder and slideshow mapping as the server',()=>{
 const source=fs.readFileSync('js/division-workspace.js','utf8');
 const map=JSON.parse(source.match(/const divisions=(\{.*\});/)[1]);assert.deepEqual(map,DIVISIONS);
 for(const name of ['index.html','control-center.html']){
  const dom=new JSDOM(fs.readFileSync(name,'utf8'));
  assert.deepEqual([...dom.window.document.querySelectorAll('[data-division-workspace]')].map(a=>a.dataset.divisionWorkspace),Object.keys(DIVISIONS));dom.window.close();
 }
});
test('wrong bridge token cannot enqueue a job',()=>{
 const q=queue();q.ctx.Utilities.computeDigest=()=>Array(32).fill(0);
 assert.equal(q.call({operation:'start'}).status,401);assert.equal(q.properties.size,0);
});

test('school bridge resolves manual identities and does not grant other divisions or executive review-only roles',()=>{
 const rows=[['Period 1','','Division Manager','','manager@students.bethelsd.org'],['Period 2','','Assistant Manager','','assistant@students.bethelsd.org'],['CTSO','','Chief Financial Officer','','cfo@students.bethelsd.org'],['Period CTSO','','Chief Executive Officer','','ceo@students.bethelsd.org']];
 const ctx=vm.createContext({OWNER_EMAILS:['mpenalver@bethelsd.org'],email_:x=>String(x||'').trim().toLowerCase(),memberEmail_:(identity,period)=>identity==='manual:manager'&&period==='1'?'manager@students.bethelsd.org':identity,LEADERSHIP_DATABASE:'leadership',Sheets:{Spreadsheets:{Values:{get:()=>({values:rows})}}}});
 vm.runInContext(fs.readFileSync('google-spinner/DivisionSlides.js','utf8'),ctx);
 assert.equal(ctx.divisionSlidesPermissions_('manual:manager','1'),true);
 assert.equal(ctx.divisionSlidesPermissions_('manual:manager','2'),false);
 assert.equal(ctx.divisionSlidesPermissions_('assistant@students.bethelsd.org','2'),true);
 assert.equal(ctx.divisionSlidesPermissions_('cfo@students.bethelsd.org','CTSO'),false);
 assert.equal(ctx.divisionSlidesPermissions_('ceo@students.bethelsd.org','CTSO'),true);
});
test('school bridge retries temporary Google redirect failures without submitting another update',()=>{
 let posts=0,gets=0;
 const ctx=vm.createContext({PERIODS:{'1':'roster'},OWNER_EMAILS:['owner@bethelsd.org'],email_:x=>x,memberEmail_:x=>x,authSession_:()=>({email:'owner@bethelsd.org'}),PropertiesService:{getScriptProperties:()=>({})},Utilities:{sleep(){}},UrlFetchApp:{fetch:(url,options)=>{
  if(options.method==='post'){posts++;return {getResponseCode:()=>302,getAllHeaders:()=>({Location:'https://script.googleusercontent.com/example'})};}
  gets++;return {getResponseCode:()=>gets===1?404:200,getContentText:()=>JSON.stringify({status:200,job:id,state:'queued'})};
 }}});
 vm.runInContext(fs.readFileSync('google-spinner/DivisionSlides.js','utf8'),ctx);
 assert.equal(ctx.divisionSlidesDispatch_({period:'1',operation:'start',job:id,token:'test'}).state,'queued');assert.equal(posts,1);assert.equal(gets,2);
});
