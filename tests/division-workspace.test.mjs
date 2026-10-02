import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import handler from '../api/division.mjs';
import pageHandler,{renderDivisionPage} from '../api/division-page.mjs';
import {DIVISIONS} from '../lib/divisions.mjs';
import {LEADER_SLIDES} from '../lib/division-slides.mjs';
const tick=()=>new Promise(r=>setTimeout(r,25));
const id='12345678-1234-1234-1234-123456789abc';
const access=(canManage=true)=>({team:[{position:'Division Manager',name:'Morgan Manager'},{position:'Software Technician',name:'Taylor Technician'}],canManage,manager:{id:DIVISIONS['1'].slides,role:'Manager Slideshow',canEdit:canManage},leaders:LEADER_SLIDES['1'].map(slide=>({...slide,canEdit:canManage||slide.role==='Software Technician'}))});
function ui(canManage=true){
 const dom=new JSDOM(renderDivisionPage('1',access(canManage)),{runScripts:'outside-only',url:'https://gknest.org/divisions/1'}),w=dom.window,calls=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.AbortSignal=AbortSignal;w.NestAuth={identity:{signedIn:true,email:'manager@students.bethelsd.org'},ready:Promise.resolve(),open(){}};
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>access(canManage)};};
 w.eval(fs.readFileSync('js/division-workspace.js','utf8'));
 return {dom,w,calls};
}
test('division page shows the current team and leadership buttons above the manager deck',async()=>{
 const {w,calls}=ui();await tick();const dialog=w.document.querySelector('.division-workspace');
 assert.equal(dialog.open,true);assert.match(dialog.querySelector('iframe').src,new RegExp(DIVISIONS['1'].slides));
 assert.equal(dialog.querySelectorAll('.division-window-positions button').length,9);
 assert.equal(dialog.querySelector('[data-load]').disabled,false);assert.equal(calls.length,0);assert.match(dialog.textContent,/Morgan Manager/);assert.match(dialog.textContent,/Taylor Technician/);assert.equal(dialog.tagName,'MAIN');
 w.dispatchEvent(new w.Event('pagehide'));assert.equal(dialog.querySelector('iframe'),null);w.close();
});
test('assigned leader gets an editor window; other positions open read-only windows',async()=>{
 const {w,calls}=ui(false);await tick();const dialog=w.document.querySelector('.division-workspace'),individual=w.document.querySelector('.division-individual');
 const buttons=[...dialog.querySelectorAll('.division-window-positions button')];buttons.find(button=>button.textContent.includes('Software Technician')).click();
 assert.equal(individual.querySelector('iframe'),null);await tick();assert.match(individual.querySelector('iframe').src,/\/edit$/);
 individual.querySelector('[data-back]').click();assert.equal(individual.querySelector('iframe'),null);
 buttons.find(button=>button.textContent.includes('Safety Officer')).click();await tick();assert.match(individual.querySelector('iframe').src,/\/embed\?/);assert.equal(calls.length,2);w.close();
});
test('a denied division never loads decks or slide buttons',async()=>{
 const {w}=ui();w.fetch=async()=>({ok:false,status:403,json:async()=>({error:'Only division members can open this window.'})});
 await tick();w.document.querySelector('[data-refresh]').click();await tick();
 assert.equal(w.document.querySelector('iframe'),null);assert.equal(w.document.querySelectorAll('.division-window-positions button').length,0);assert.match(w.document.querySelector('.division-workspace [role=status]').textContent,/division members/);w.close();
});
test('ordinary members cannot trigger a slide update',async()=>{
 const {w,calls}=ui(false);await tick();const button=w.document.querySelector('[data-load]');assert.equal(button.disabled,true);button.click();assert.equal(calls.length,0);assert.equal(w.document.querySelector('[data-hiring]').hidden,true);w.close();
});
test('slide update queues once and completion refreshes the manager slideshow',async()=>{
 const {w,calls}=ui();await tick();let state='queued',pollTimer;
 w.setTimeout=callback=>{pollTimer=callback;return 1;};w.clearTimeout=()=>{};
 w.fetch=async(url,options)=>{calls.push({url,options});const job=options.method==='POST'?JSON.parse(options.body).job:new URL(url,'https://gknest.org').searchParams.get('job');return {ok:true,json:async()=>({job,state})};};
 const dialog=w.document.querySelector('.division-workspace');const oldFrame=dialog.querySelector('iframe');
 const button=dialog.querySelector('[data-load]');button.click();button.click();await tick();
 assert.equal(calls.filter(c=>c.options.method==='POST').length,1);assert.match(dialog.querySelector('[role=status]').textContent,/queued/);
 state='completed';pollTimer();await tick();assert.match(dialog.querySelector('[role=status]').textContent,/updated/);
 assert.notEqual(oldFrame,dialog.querySelector('iframe'));assert.equal(button.disabled,false);w.close();
});
test('refreshing the division page resumes a queued update without starting another',async()=>{
 const {w,calls}=ui();await tick();
 w.fetch=async(url,options)=>{calls.push({url,options});const job=options.method==='POST'?JSON.parse(options.body).job:new URL(url,'https://gknest.org').searchParams.get('job');return {ok:true,json:async()=>job?{job,state:'queued'}:access(true)};};
 const page=w.document.querySelector('.division-page');page.querySelector('[data-load]').click();await tick();page.querySelector('[data-refresh]').click();await tick();
 assert.match(page.querySelector('[role=status]').textContent,/queued/);assert.equal(calls.filter(c=>c.options.method==='POST').length,1);w.close();
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
 ctx.nestSlideRoster_=()=>new Set(['manager@students.bethelsd.org']);
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

test('all divisions have verified server-side slide catalogs and public links stay inside NEST',()=>{
 assert.deepEqual(Object.keys(LEADER_SLIDES),Object.keys(DIVISIONS));
 assert.doesNotMatch(fs.readFileSync('js/division-workspace.js','utf8'),new RegExp(DIVISIONS['1'].slides));
 for(const name of ['divisions.html']){
  const dom=new JSDOM(fs.readFileSync(name,'utf8'));
  const links=[...dom.window.document.querySelectorAll('[data-division-workspace]')];
  assert.deepEqual(links.map(a=>a.dataset.divisionWorkspace),Object.keys(DIVISIONS));assert.ok(links.every(a=>a.getAttribute('href').startsWith('/divisions/')));dom.window.close();
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
 const ctx=vm.createContext({PERIODS:{'1':'roster'},rows_:()=>[],LEADERSHIP_DATABASE:'leaders',Sheets:{Spreadsheets:{Values:{get:()=>({values:[]})}}},OWNER_EMAILS:['owner@bethelsd.org'],email_:x=>x,memberEmail_:x=>x,authSession_:()=>({email:'owner@bethelsd.org'}),PropertiesService:{getScriptProperties:()=>({})},Utilities:{sleep(){}},UrlFetchApp:{fetch:(url,options)=>{
  if(options.method==='post'){posts++;return {getResponseCode:()=>302,getAllHeaders:()=>({Location:'https://script.googleusercontent.com/example'})};}
  gets++;return {getResponseCode:()=>gets===1?404:200,getContentText:()=>JSON.stringify({status:200,job:id,state:'queued'})};
 }}});
 vm.runInContext(fs.readFileSync('google-spinner/DivisionSlides.js','utf8'),ctx);
 assert.equal(ctx.divisionSlidesDispatch_({period:'1',operation:'start',job:id,token:'test'}).state,'queued');assert.equal(posts,1);assert.equal(gets,2);
});

test('API allows managers to edit every position but restricts ordinary members to assigned roles',async()=>{
 const oldFetch=globalThis.fetch,oldURL=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN;
 process.env.SPINNER_BRIDGE_URL='https://bridge.example.test';process.env.SPINNER_BRIDGE_TOKEN='test';
 try{
  for(const canManage of [false,true]){
   globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({status:200,canManage,roles:['3d Print Specialist']})});
   const r=res();await handler({method:'GET',headers:{cookie:'__Host-nest-auth='+ 'a'.repeat(64)},query:{period:'1'}},r);
   assert.equal(r.code,200);assert.equal(r.data.leaders.find(slide=>slide.role==='Fabrication Supervisor').canEdit,true);
   assert.equal(r.data.leaders.find(slide=>slide.role==='Safety Officer').canEdit,canManage);assert.equal(r.data.manager.canEdit,canManage);
  }
 }finally{globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldURL;if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;}
});
test('school bridge denies nonmembers even if a stale management assignment remains',()=>{
 const ctx=vm.createContext({PERIODS:{'1':'roster'},OWNER_EMAILS:[],email_:x=>x,memberEmail_:x=>x,rows_:()=>[['Current member','member@school.test']],authSession_:()=>({email:'former@school.test'}),PropertiesService:{getScriptProperties:()=>({})}});
 vm.runInContext(fs.readFileSync('google-spinner/DivisionSlides.js','utf8'),ctx);
 assert.equal(ctx.divisionSlidesDispatch_({period:'1',operation:'access'}).status,403);
 assert.equal(ctx.divisionSlidesDispatch_({period:'1',operation:'start',job:id}).status,403);
});
test('sharing removes public and outsider access and keeps division managers, role holders and readers',()=>{
 let permissions=[{id:'owner',type:'user',role:'owner',emailAddress:'teacher@school.test'},{id:'public',type:'anyone',role:'reader'},{id:'domain',type:'domain',role:'reader'},{id:'outsider',type:'user',role:'writer',emailAddress:'outside@school.test'},{id:'member',type:'user',role:'writer',emailAddress:'member@school.test'}];
 const ctx=vm.createContext({console,Drive:{Permissions:{list:()=>({items:permissions}),remove:(id,key)=>{permissions=permissions.filter(p=>p.id!==key);},patch:(value,id,key)=>{permissions.find(p=>p.id===key).role=value.role;},insert:(p)=>permissions.push({...p,emailAddress:p.value,id:p.value})}}});
 vm.runInContext(fs.readFileSync('google-control-center/DivisionSlideAccess.js','utf8'),ctx);
 ctx.nestSlidePermissions_('deck',new Set(['manager@school.test','assistant@school.test','leader@school.test']),new Set(['member@school.test','manager@school.test','assistant@school.test','leader@school.test']));
 assert.equal(permissions.length,5);assert.equal(permissions.find(p=>p.emailAddress==='member@school.test').role,'reader');
 assert.ok(['manager','assistant','leader'].every(name=>permissions.find(p=>p.emailAddress===name+'@school.test').role==='writer'));assert.equal(ctx.nestSlideRole_('3d Print Specialist'),'fabrication supervisor');
});
test('unexpected inherited access fails the sharing audit',()=>{
 const ctx=vm.createContext({console,Drive:{Permissions:{list:()=>({items:[{id:'wide',type:'anyone',role:'reader'}]}),remove:()=>{throw new Error('Inherited permission');},insert(){}}}});
 vm.runInContext(fs.readFileSync('google-control-center/DivisionSlideAccess.js','utf8'),ctx);assert.throws(()=>ctx.nestSlidePermissions_('deck',new Set(),new Set()),/Unexpected inherited/);
});
test('limited-access folders verify their boundary and ignore metadata-only parent visibility',()=>{
 const patches=[];
 const ctx=vm.createContext({console,Drive:{Files:{patch:(value,id)=>patches.push({value,id}),get:()=>({inheritedPermissionsDisabled:true})},Permissions:{list:()=>({items:[{id:'parent',type:'user',role:'reader',view:'metadata'}]}),remove:()=>{throw new Error('Metadata permission should not be changed');},insert(){}}}});
 vm.runInContext(fs.readFileSync('google-control-center/DivisionSlideAccess.js','utf8'),ctx);ctx.nestSlideLimitFolder_('folder');ctx.nestSlidePermissions_('folder',new Set(),new Set());
 assert.equal(patches[0].value.inheritedPermissionsDisabled,true);assert.equal(patches[0].id,'folder');
 ctx.Drive.Files.get=()=>({inheritedPermissionsDisabled:false});assert.throws(()=>ctx.nestSlideLimitFolder_('folder'),/Could not isolate/);
});
test('first-time sharing checkpoints each division and resumes after interruption',()=>{
 const properties=new Map(),triggers=[],synced=[];
 const store={getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value),deleteProperty:key=>properties.delete(key)};
 const ctx=vm.createContext({console,Date,PropertiesService:{getScriptProperties:()=>store},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased:()=>({everyMinutes:()=>({create:()=>triggers.push({getHandlerFunction:()=>name})})})}),deleteTrigger:trigger=>triggers.splice(triggers.indexOf(trigger),1)}});
 vm.runInContext(fs.readFileSync('google-control-center/DivisionSlideAccess.js','utf8'),ctx);
 ctx.nestSlideLimitFolder_=()=>{};ctx.nestSlidePermissions_=()=>{};ctx.nestSyncDivisionSlideAccess=period=>synced.push(period);
 ctx.nestSyncAllDivisionSlideAccess();assert.deepEqual(synced,['1']);assert.equal(triggers.length,1);
 ctx.nestSyncDivisionSlideAccess=()=>{throw new Error('Execution interrupted');};assert.throws(()=>ctx.nestContinueDivisionSlideAccess(),/interrupted/);
 assert.equal(JSON.parse(properties.get('nest-slide-access-pending'))[0],'2');
 ctx.nestSyncDivisionSlideAccess=period=>synced.push(period);for(let i=0;i<6;i++)ctx.nestContinueDivisionSlideAccess();
 assert.deepEqual(synced,['1','2','3','4','5','7','CTSO']);assert.equal(properties.has('nest-slide-access-pending'),false);assert.equal(triggers.length,0);assert.ok(properties.has('nest-slide-access-completed'));
});
test('the live sharing routine includes both division managers on every individual slide',()=>{
 const applied=[],leaders=[['Period 1','','Division Manager','','manager@school.test'],['Period 1','','Assistant Manager','','assistant@school.test'],['Period 1','','Software Technician','','leader@school.test'],['Period 1','','Software Technician','','outsider@school.test']];
 const iterator=items=>({hasNext:()=>items.length>0,next:()=>items.shift()});
 const slide={getId:()=> 'role-slide',getName:()=> 'Division 1_Software Technician',getMimeType:()=> 'application/vnd.google-apps.presentation'},manager={getId:()=> 'manager-slide',getName:()=> 'Division 1 Team_Manager Slides'};
 const source={getId:()=> 'source-folder',getFiles:()=>iterator([slide])},folder={getId:()=> 'division-folder',getFiles:()=>iterator([manager]),getFoldersByName:()=>iterator([source])};
 const ctx=vm.createContext({console,DriveApp:{getFolderById:()=>folder},SpreadsheetApp:{openById:()=>({getSheetByName:()=>({getRange:()=>({getValues:()=>leaders})})})}});
 vm.runInContext(fs.readFileSync('google-control-center/DivisionSlideAccess.js','utf8'),ctx);ctx.nestSlideRoster_=()=>new Set(['manager@school.test','assistant@school.test','leader@school.test','member@school.test']);ctx.nestSlideLimitFolder_=()=>{};ctx.nestSlidePermissions_=(id,editors,viewers)=>applied.push({id,editors:[...editors].sort(),viewers:[...viewers].sort()});
 ctx.nestSyncDivisionSlideAccess('1');
 assert.deepEqual(applied.find(p=>p.id==='role-slide').editors,['assistant@school.test','leader@school.test','manager@school.test']);assert.deepEqual(applied.find(p=>p.id==='manager-slide').editors,['assistant@school.test','manager@school.test']);assert.equal(applied.find(p=>p.id==='role-slide').viewers.length,4);
});

test('empty divisions revoke member access while unavailable or malformed rosters fail safely',()=>{
 let rows=[],sheetAvailable=true;
 const ctx=vm.createContext({console,SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheetAvailable?{getRange:()=>({getValues:()=>rows})}:null})}});
 vm.runInContext(fs.readFileSync('google-control-center/DivisionSlideAccess.js','utf8'),ctx);
 assert.equal(ctx.nestSlideRoster_('3').size,0);
 rows=[['Member without an email','','']];assert.throws(()=>ctx.nestSlideRoster_('3'),/no valid member emails/);
 sheetAvailable=false;assert.throws(()=>ctx.nestSlideRoster_('3'),/unavailable/);
 let permissions=[{id:'owner',type:'user',role:'owner'},{id:'former',type:'user',role:'reader',emailAddress:'former@school.test'}];
 ctx.Drive={Permissions:{list:()=>({items:permissions}),remove:(id,key)=>{permissions=permissions.filter(p=>p.id!==key);}}};
 ctx.nestSlidePermissions_('empty-division',new Set(),new Set());assert.equal(permissions.length,1);assert.equal(permissions[0].role,'owner');
});

test('division pages deny unsigned and nonmember requests before returning team or deck data',async()=>{
 const response=()=>({code:200,headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},send(html){this.html=html;return this;}});
 let r=response();await pageHandler({method:'GET',headers:{},query:{period:'1'}},r);assert.equal(r.code,401);assert.match(r.html,/Sign in to NEST/);assert.doesNotMatch(r.html,/division-bootstrap|Morgan Manager|data-hiring|presentation\/d\//);assert.equal(r.headers['Vercel-CDN-Cache-Control'],'no-store');
 const oldFetch=globalThis.fetch,oldURL=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN;process.env.SPINNER_BRIDGE_URL='https://bridge.example.test';process.env.SPINNER_BRIDGE_TOKEN='test';
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>({status:403,team:[{name:'Private leader'}]})});r=response();await pageHandler({method:'GET',headers:{cookie:'__Host-nest-auth='+ 'a'.repeat(64)},query:{period:'2'}},r);assert.equal(r.code,403);assert.doesNotMatch(r.html,/Private leader|division-bootstrap|presentation\/d\//);
  globalThis.fetch=async()=>({ok:true,json:async()=>({status:200,canManage:true,team:[{position:'Division Manager',name:'Private leader'}]})});r=response();await pageHandler({method:'GET',headers:{cookie:'__Host-nest-auth='+ 'a'.repeat(64)},query:{period:'1'}},r);assert.equal(r.code,200);assert.match(r.html,/Private leader|division-bootstrap/);
 }finally{globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldURL;if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;}
});
test('division bootstrap escapes script-breaking team names and pages do not intercept division navigation',()=>{
 const data=access();data.team[0].name='</script><img onerror=alert(1)>';
 const html=renderDivisionPage('1',data);assert.doesNotMatch(html,/<img onerror/);assert.match(html,/\\u003c/);
 const {w}=ui();assert.equal(w.document.querySelector('[data-hiring]').hidden,false);assert.equal(w.document.querySelector('[data-hiring]').getAttribute('href'),'/hiring?period=1#manager-hiring');assert.equal(w.document.querySelector('.division-page-actions a[href^="/leadership-application"]').getAttribute('href'),'/leadership-application?division=1');w.close();
});
test('the school bridge returns only the selected division current members and reads leadership once',()=>{
 let reads=0;const rows=[['Period 1','','Division Manager','Manager, Morgan','manager@school.test'],['Period 1','','Software Technician','Technician, Taylor','member@school.test'],['Period 1','','Safety Officer','Former, Leader','former@school.test'],['Period 2','','Division Manager','Other, Division','other@school.test']];
 const ctx=vm.createContext({PERIODS:{'1':'roster'},OWNER_EMAILS:[],email_:x=>x,memberEmail_:x=>x,rows_:()=>[['Manager','manager@school.test'],['Member','member@school.test']],authSession_:()=>({email:'manager@school.test'}),PropertiesService:{getScriptProperties:()=>({})},LEADERSHIP_DATABASE:'leadership',Sheets:{Spreadsheets:{Values:{get:()=>{reads++;return {values:rows};}}}}});
 vm.runInContext(fs.readFileSync('google-spinner/DivisionSlides.js','utf8'),ctx);const result=ctx.divisionSlidesDispatch_({period:'1',operation:'access'});assert.equal(result.status,200);assert.equal(reads,1);assert.deepEqual(JSON.parse(JSON.stringify(result.team)),[{position:'Division Manager',name:'Morgan Manager'},{position:'Software Technician',name:'Taylor Technician'}]);
});

test('signing out clears the protected team, slide frames and manager actions immediately',async()=>{
 const {w}=ui();await tick();w.NestAuth.identity=null;w.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Sign in to NEST.'})});w.document.dispatchEvent(new w.Event('nest-auth-change'));
 assert.equal(w.document.querySelector('iframe'),null);assert.equal(w.document.querySelectorAll('.division-window-positions button').length,0);assert.equal(w.document.querySelector('[data-team-summary]').textContent,'');assert.equal(w.document.querySelector('[data-hiring]').hidden,true);await tick();w.close();
});
test('the application page contains the form without loading manager hiring data',()=>{
 const html=fs.readFileSync('leadership-application.html','utf8');assert.match(html,/NEST leadership application/);assert.doesNotMatch(html,/manager-hiring|js\/hiring\.js/);
});

test('division page preserves native request header getters during its access check',async()=>{
 const req=Object.create({get headers(){return {};}});req.method='GET';req.query={period:'1'};
 const r={code:200,setHeader(){},status(code){this.code=code;return this;},send(html){this.html=html;return this;}};
 await pageHandler(req,r);assert.equal(r.code,401);assert.match(r.html,/data-sign-in/);
});

test('Command has one Division HQ entry and the chooser lists every division',()=>{
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'));const command=dom.window.document.querySelector('#gear-3');const links=[...command.querySelectorAll('a')].filter(a=>a.getAttribute('href').startsWith('/divisions'));assert.equal(links.length,1);assert.match(links[0].textContent,/Division HQ/);assert.equal(command.querySelector('[data-division-workspace]'),null);assert.doesNotMatch(command.textContent,/Control Center|Division Folders/);dom.window.close();assert.equal(fs.existsSync('control-center.html'),false);
});
test('allowed and locked division pages both contain the full NEST header and footer',()=>{
 for(const html of [renderDivisionPage('1',access()),renderDivisionPage('1',{error:'Sign in.'},401)]){
  const dom=new JSDOM(html),doc=dom.window.document;assert.ok(doc.querySelector('header .logo-container'));assert.ok(doc.querySelector('#today-date'));assert.ok(doc.querySelector('.header-dropdown'));assert.ok(doc.querySelector('.header-qr'));assert.ok(doc.querySelector('#current-year'));assert.match(doc.querySelector('footer').textContent,/Help & Support/);assert.match(doc.querySelector('footer').textContent,/About Me/);assert.ok(doc.querySelector('script[src="/js/main.js"]'));dom.window.close();
 }
});
