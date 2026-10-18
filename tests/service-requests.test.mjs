import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';import {JSDOM} from 'jsdom';
import handler from '../api/service-requests.mjs';import {staffClaims,newChallenge,readChallenge} from '../lib/service-google.mjs';
const source=fs.readFileSync('google-spinner/ServiceRequests.js','utf8'),hash=v=>createHash('sha256').update(v).digest('hex');
const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
function fixture(){
 const heads=['Status','Project Manager','Log','Timestamp','Email Address','Is there a phone number we can reach you at?','Choose your name below:',"If you don't see your name above fill it in here.",'What room can we find you in?','What is the category of your request?','How fast do you need this done?',"To the best of your ability, please describe the problem you'd like us to tackle.",'Share a picture or video of the issue you\'re facing','Request ID'];
 const archive=['Status','Project Manager','Project Notes','Timestamp','Email Address','Please share a phone number we can reach you at.','Please share your first and last name here.','What room can we find you in?','What is the category of your request?','How fast do you need this done? (5 is ASAP.)',"To the best of your ability, please describe the problem you'd like us to tackle.",'Share a picture or video of the issue you\'re facing.','Request ID'];
 const state={tabs:[{sheetId:1,title:'ServiceRequests',gridProperties:{rowCount:102,columnCount:19}},{sheetId:2,title:'Closed Tickets',gridProperties:{rowCount:980,columnCount:26}},{sheetId:3,title:'ServiceWebLog',gridProperties:{rowCount:30000,columnCount:10}},{sheetId:4,title:'ClientReviews',gridProperties:{rowCount:113,columnCount:15}}],
  grids:{ServiceRequests:[heads,['Assigned','Student, Test (Period 2)','SECRET INTERNAL HISTORY',46295.5,'staff@bethelsd.org','555-1234','Staff Name','','174','Repair','4','Fix the chair','https://drive.google.com/file/d/attachment',first],['New!','','OTHER INTERNAL',46294,'other@bethelsd.org','','Other Staff','','175','Other','2','A different request','',second]],'Closed Tickets':[archive],ServiceWebLog:[['Time','Request ID','Action','Actor','Status','Client update','Event ID','Email state','Manager','Internal note']],ClientReviews:[['Timestamp','Email Address','Satisfaction'],['2026-10-01','staff@bethelsd.org','Yes']]},writes:[],mail:[],properties:new Map(),leaders:[['Period 2','','Director of Client Relations','Director','director@students.bethelsd.org'],['CTSO','','Chief Operations Officers','COO','coo@students.bethelsd.org']]};
 const store={getProperty:k=>state.properties.get(k)||null,setProperty:(k,v)=>state.properties.set(k,v),deleteProperty:k=>state.properties.delete(k),getProperties:()=>Object.fromEntries(state.properties)};
 const col=value=>[...value].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
 const values=(id,range)=>{
  if(range.includes('Imported'))return {values:state.leaders};
  const match=range.match(/^'(.+)'!([A-Z]+)(\d+):([A-Z]+)(\d+)$/);if(!match)throw new Error('Unexpected read '+range);
  const [,title,left,top,right,bottom]=match,grid=state.grids[title];if(!grid)throw new Error('Missing tab');return {values:grid.slice(Number(top)-1,Number(bottom)).map(row=>row.slice(col(left),col(right)+1))};
 };
 const spreadsheets={get:()=>({sheets:state.tabs.map(properties=>({properties}))}),Values:{get:values},batchUpdate:(body)=>{
  const copy=structuredClone(state.grids);
  for(const command of body.requests){
   if(command.appendCells){const tab=state.tabs.find(t=>t.sheetId===command.appendCells.sheetId);copy[tab.title].push(...command.appendCells.rows.map(row=>row.values.map(cell=>Object.values(cell.userEnteredValue)[0])));}
   if(command.updateCells){const r=command.updateCells.range,tab=state.tabs.find(t=>t.sheetId===r.sheetId);command.updateCells.rows.forEach((row,i)=>row.values.forEach((cell,j)=>copy[tab.title][r.startRowIndex+i][r.startColumnIndex+j]=Object.values(cell.userEnteredValue)[0]));}
   if(command.deleteDimension){const r=command.deleteDimension.range,tab=state.tabs.find(t=>t.sheetId===r.sheetId);copy[tab.title].splice(r.startIndex,r.endIndex-r.startIndex);}
  }state.grids=copy;state.writes.push(body);return {};
 }};
 const ctx=vm.createContext({Sheets:{Spreadsheets:spreadsheets},PropertiesService:{getScriptProperties:()=>store},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},LEADERSHIP_DATABASE:'leadership',OWNER_EMAILS:['owner@bethelsd.org'],email_:v=>String(v||'').trim().toLowerCase(),memberEmail_:v=>v,PERIODS:{'2':'roster'},rows_:()=>[['Student, Test','student@students.bethelsd.org']],hash_:hash,authSession_:raw=>raw==='director'?{email:'director@students.bethelsd.org'}:raw==='coo'?{email:'coo@students.bethelsd.org'}:raw==='outsider'?{email:'outsider@students.bethelsd.org'}:null,read_:(s,k,now)=>{const raw=s.getProperty(k);if(!raw)return null;const v=JSON.parse(raw);return v.expires>now?v:null;},Utilities:{getUuid:()=>`33333333-3333-4333-8333-${String(state.writes.length).padStart(12,'0')}`},MailApp:{sendEmail:mail=>state.mail.push(mail)},console,Date});vm.runInContext(source,ctx);return {ctx,state,store};
}
test('leadership has a workspace view while ticket changes use division-specific access',()=>{
 const {ctx,state}=fixture();for(const role of ['Director of Client Relations','Division Manager','Assistant Manager','Chief Executive Officer','Chief Financial Officer','Chief Operations Officers','Executive Vice-President']){
  const chief=/Chief|Executive/.test(role);assert.equal(ctx.serviceRole_('role@students.bethelsd.org',[[chief?'Period CTSO':'Period 5','',role,'','role@students.bethelsd.org']]),true);
 }for(const role of ['Project Manager','Partner Liaison','Software Technician','Fabrication Supervisor'])assert.equal(ctx.serviceRole_('role@students.bethelsd.org',[['Period 2','',role,'','role@students.bethelsd.org']]),false);
 assert.equal(ctx.serviceDispatch_({action:'auth-service-manage',session:'director'}).requests.length,2);
 assert.equal(ctx.serviceDispatch_({action:'auth-service-manage',session:'outsider'}).status,403);state.leaders=[];assert.equal(ctx.serviceDispatch_({action:'auth-service-manage',session:'director'}).status,403);
});
test('school clients see only owned requests with no internal notes, contacts, files or actors',()=>{
 const {ctx,store}=fixture(),session='a'.repeat(64);store.setProperty('service-session:'+hash(session),JSON.stringify({email:'staff@bethelsd.org',expires:Date.now()+60000}));
 const result=ctx.serviceDispatch_({action:'service-client-view',session,email:'other@bethelsd.org'});assert.equal(result.requests.length,1);assert.equal(result.requests[0].id,first);
 for(const secret of ['SECRET','OTHER INTERNAL','other@','555-1234','drive.google','Staff Name','legacyLog'])assert.equal(JSON.stringify(result).includes(secret),false);
 assert.equal(ctx.serviceDispatch_({action:'service-client-view',session:'b'.repeat(64)}).status,401);
});
test('malformed historical timestamps cannot expose internal text to clients',()=>{
 const {ctx,state,store}=fixture(),session='a'.repeat(64);
 state.grids.ServiceRequests[1][3]='SECRET INTERNAL HISTORY';
 store.setProperty('service-session:'+hash(session),JSON.stringify({email:'staff@bethelsd.org',expires:Date.now()+60000}));
 const result=ctx.serviceDispatch_({action:'service-client-view',session});
 assert.equal(result.status,200);assert.equal(result.requests[0].created,'');assert.equal(JSON.stringify(result).includes('SECRET'),false);
 assert.equal(state.grids.ServiceRequests[1][3],'SECRET INTERNAL HISTORY');
});
test('closing and reopening atomically map different headers and preserve attachments and permanent ID',()=>{
 const {ctx,state}=fixture();let item=ctx.serviceDispatch_({action:'auth-service-manage',session:'director'}).requests[0];
 const change={action:'auth-service-update',session:'director',id:item.id,version:item.version,status:'Closed',manager:item.manager,note:'Private followup',publicNote:'Your chair is ready.'};
 assert.equal(ctx.serviceDispatch_(change).status,200);assert.equal(state.writes.length,1);assert.equal(state.grids.ServiceRequests.length,2);
 const archived=state.grids['Closed Tickets'][1];assert.equal(archived[7],'174');assert.equal(archived[10],'Fix the chair');assert.equal(archived[11],'https://drive.google.com/file/d/attachment');assert.equal(archived[12],first);
 assert.equal(ctx.serviceDispatch_(change).status,409);
 item=ctx.serviceDispatch_({action:'auth-service-manage',session:'coo'}).requests.find(r=>r.id===first);
 assert.equal(ctx.serviceDispatch_({...change,session:'coo',version:item.version,status:'In Progress',publicNote:'Reopened.'}).status,403);
 assert.equal(ctx.serviceDispatch_({...change,session:'director',version:item.version,status:'In Progress',publicNote:'Reopened.'}).status,200);
 const reopened=state.grids.ServiceRequests.find(r=>r.includes(first));assert.equal(reopened[8],'174');assert.equal(reopened[11],'Fix the chair');assert.equal(reopened[12],'https://drive.google.com/file/d/attachment');assert.equal(state.grids['Closed Tickets'].length,1);
});
test('row sorting cannot change identity and duplicate or missing IDs fail closed',()=>{
 const {ctx,state}=fixture(),item=ctx.serviceManage_('manage').requests[0];state.grids.ServiceRequests.splice(1,2,...state.grids.ServiceRequests.slice(1).reverse());
 const after=ctx.serviceManage_('manage').requests.find(r=>r.id===item.id);assert.equal(after.description,'Fix the chair');assert.equal(after.version,item.version);
 state.grids.ServiceRequests[1][13]=first;assert.throws(()=>ctx.serviceRead_(),/Duplicate/);
 state.grids.ServiceRequests[1][13]='';assert.equal(ctx.serviceDispatch_({action:'auth-service-manage',session:'director'}).status,428);
});
test('email is explicit, only contains public update, uses stored recipient and rejects repeats',()=>{
 const {ctx,state}=fixture();let r=ctx.serviceManage_('manage').requests[0];
 ctx.serviceDispatch_({action:'auth-service-update',session:'director',id:r.id,version:r.version,status:'In Progress',manager:'student@students.bethelsd.org',note:'DO NOT EMAIL INTERNAL',publicNote:'We are working on the chair.'});assert.equal(state.mail.length,0);
 r=ctx.serviceManage_('manage').requests[0];const email={action:'auth-service-email',session:'director',id:r.id,version:r.version,eventId:r.updates.at(-1).eventId,to:'attacker@bethelsd.org'};
 assert.equal(ctx.serviceDispatch_(email).status,200);assert.equal(state.mail[0].to,'staff@bethelsd.org');assert.equal(state.mail[0].body.includes('DO NOT EMAIL'),false);assert.equal(state.mail[0].body.includes('We are working'),true);
 assert.equal(ctx.serviceDispatch_(email).status,409);assert.equal(state.mail.length,1);
});
test('uncertain delivery records an attempt and cannot be automatically retried',()=>{
 const {ctx,state}=fixture();let r=ctx.serviceManage_('manage').requests[0];
 ctx.serviceDispatch_({action:'auth-service-update',session:'director',id:r.id,version:r.version,status:'Completed',manager:r.manager,note:'Private',publicNote:'Finished.'});
 r=ctx.serviceManage_('manage').requests[0];ctx.MailApp.sendEmail=()=>{throw new Error('Network response lost');};
 const payload={action:'auth-service-email',session:'director',id:r.id,version:r.version,eventId:r.updates.at(-1).eventId};assert.equal(ctx.serviceDispatch_(payload).status,502);
 r=ctx.serviceManage_('manage').requests[0];assert.equal(r.emailState,'unknown');assert.equal(ctx.serviceDispatch_({...payload,version:r.version}).status,409);assert.equal(state.grids.ServiceWebLog.filter(e=>e[2]==='email').length,2);
});
test('closing preserves a manually entered requester name in the older archive layout',()=>{
 const {ctx,state}=fixture();state.grids.ServiceRequests[1][6]='';state.grids.ServiceRequests[1][7]='Fallback Staff Name';const r=ctx.serviceManage_('manage').requests[0];
 assert.equal(ctx.serviceDispatch_({action:'auth-service-update',session:'director',id:r.id,version:r.version,status:'Closed',manager:r.manager,note:'',publicNote:''}).status,200);assert.equal(state.grids['Closed Tickets'][1][6],'Fallback Staff Name');
});
test('metrics count real requests; invalid assignments and unauthorized writes change nothing',()=>{
 const {ctx,state}=fixture(),r=ctx.serviceManage_('manage').requests[0];assert.equal(ctx.serviceManage_('metrics').metrics.reduce((n,r)=>n+r.total,0),2);
 const data={action:'auth-service-update',session:'outsider',id:r.id,version:r.version,status:'Closed',manager:'',note:'',publicNote:''};assert.equal(ctx.serviceDispatch_(data).status,403);
 assert.equal(ctx.serviceDispatch_({...data,session:'director',manager:'outsider@students.bethelsd.org'}).status,400);assert.equal(state.writes.length,0);
});
test('Google login requires verified Workspace staff, correct nonce and unexpired token',()=>{
 const claims={sub:'123',email:'staff@bethelsd.org',email_verified:true,hd:'bethelsd.org',nonce:'nonce',exp:Math.floor(Date.now()/1000)+3600};assert.equal(staffClaims(claims,'nonce').email,claims.email);
 for(const patch of [{hd:undefined},{hd:'other.org'},{email_verified:false},{nonce:'other'},{email:'student@students.bethelsd.org'},{exp:1}])assert.equal(staffClaims({...claims,...patch},'nonce'),null);
 process.env.SPINNER_BRIDGE_TOKEN='test-signing-key';const challenge=newChallenge();assert.equal(readChallenge(challenge.cookie).nonce,challenge.nonce);assert.equal(readChallenge(challenge.cookie+'x'),null);delete process.env.SPINNER_BRIDGE_TOKEN;
});
test('client sessions rotate, nonce cannot replay, logout revokes the opaque token',()=>{
 const {ctx}=fixture(),r={action:'service-client-login',session:'a'.repeat(64),nonce:'b'.repeat(64),email:'staff@bethelsd.org',sub:'123',expires:Date.now()+30000};
 assert.equal(ctx.serviceDispatch_(r).status,200);assert.equal(ctx.serviceDispatch_(r).status,409);assert.equal(ctx.serviceDispatch_({action:'service-client-view',session:r.session}).status,200);
 assert.equal(ctx.serviceDispatch_({action:'service-client-logout',session:r.session}).status,200);assert.equal(ctx.serviceDispatch_({action:'service-client-view',session:r.session}).status,401);
});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.data=v;return this;}});
test('HTTP denies anonymous reads, forged login and cross-origin mutations',async()=>{
 for(const operation of ['client-view','manage','reviews','metrics']){const res=response();await handler({method:'GET',headers:{},query:{operation}},res);assert.equal(res.code,401);assert.match(res.headers['Cache-Control'],/no-store/);}
 const res=response();await handler({method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:{operation:'client-login'}},res);assert.equal(res.code,403);
 const login=response();await handler({method:'POST',headers:{origin:'https://gknest.org','content-type':'application/json'},body:{operation:'client-login',email:'staff@bethelsd.org',credential:'fake'}},login);assert.equal(login.code,401);
});
test('HTTP client projection removes unexpected private fields from bridge response',async()=>{
 const old=globalThis.fetch;process.env.SPINNER_BRIDGE_URL='https://script.google.com/test';process.env.SPINNER_BRIDGE_TOKEN='test';
 globalThis.fetch=async()=>({ok:true,json:async()=>({status:200,email:'staff@bethelsd.org',requests:[{id:first,status:'Assigned',updates:[],legacyLog:'SECRET',phone:'SECRET',email:'SECRET',attachment:'SECRET'}]})});
 try{const res=response();await handler({method:'GET',headers:{cookie:'__Host-nest-service='+'a'.repeat(64)},query:{operation:'client-view',email:'other@bethelsd.org'}},res);assert.equal(res.code,200);assert.equal(JSON.stringify(res.data).includes('SECRET'),false);}
 finally{globalThis.fetch=old;delete process.env.SPINNER_BRIDGE_URL;delete process.env.SPINNER_BRIDGE_TOKEN;}
});
test('management renders text safely, protects drafts, and drops private data on logout',async()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/service'}),w=dom.window;
 w.NestAuth={identity:{signedIn:true},open(){}};let calls=0;
 w.fetch=async url=>{if(url.includes('client-view'))return {ok:true,json:async()=>({email:'staff@bethelsd.org',requests:[]})};calls++;return {ok:true,json:async()=>({statuses:['Assigned','Closed'],metrics:[],managers:[],requests:[{id:first,version:'a'.repeat(64),status:'Assigned',name:'<img src=x onerror=alert(1)>',email:'staff@bethelsd.org',description:'PRIVATE REQUEST',manager:'',updates:[],internalUpdates:[],legacyLog:'PRIVATE HISTORY',emailState:'none'}]})};};
 w.eval(fs.readFileSync('js/service.js','utf8'));await new Promise(r=>setTimeout(r,10));w.document.querySelector('[data-view=manage]').click();await new Promise(r=>setTimeout(r,10));w.document.querySelector('.service-ticket').click();assert.equal(w.document.querySelector('#service-detail').hidden,false);assert.equal(w.document.querySelector('#service-ticket-list img'),null);
 const note=w.document.querySelector('#service-note');note.value='Draft';note.dispatchEvent(new w.Event('input',{bubbles:true}));w.confirm=()=>false;w.document.querySelector('#manager-refresh').click();assert.equal(calls,1);
 w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(w.document.querySelector('#service-workspace').hidden,true);assert.equal(note.value,'');assert.equal(w.document.body.textContent.includes('PRIVATE REQUEST'),false);assert.equal(w.document.body.textContent.includes('PRIVATE HISTORY'),false);dom.window.close();
});

test('selected barometer reloads after renewed leadership identity and workspace refresh',async()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/service'}),w=dom.window;
 w.NestAuth={identity:{signedIn:true},open(){}};let metricsCalls=0;
 w.fetch=async url=>{const operation=new URL(url,'https://gknest.org').searchParams.get('operation');
  const data=operation==='metrics'?{trimester:{number:1,start:'2026-08-31',end:'2026-11-24'},metrics:[{division:'Period 2',manager:'Test manager',total:60,open:5,closed:55,averageDaysOpen:4,clientsHelped:20}]}:{statuses:['Assigned'],managers:[],requests:[{id:first,created:'2026-09-15T12:00:00Z',manager:'Test manager',status:'Assigned',email:'staff@bethelsd.org',updates:[]}]};
  if(operation==='metrics')metricsCalls++;
  return {ok:true,json:async()=>data};
 };
 const settle=()=>new Promise(r=>setTimeout(r,10));
 w.eval(fs.readFileSync('js/service.js','utf8'));await new Promise(r=>setTimeout(r,10));w.document.querySelector('[data-view=manage]').click();await settle();
 w.document.querySelector('[data-tool=metrics]').click();await settle();assert.equal(metricsCalls,1);
 w.document.dispatchEvent(new w.Event('nest-auth-change'));await settle();
 assert.equal(metricsCalls,2);assert.match(w.document.querySelector('#service-metrics').textContent,/Test manager/);assert.equal(w.document.querySelector('#tool-metrics').hidden,false);
 w.document.querySelector('#manager-refresh').click();await settle();assert.equal(metricsCalls,3);
 w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(w.document.querySelector('#service-metrics').textContent,'');assert.equal(w.document.querySelector('#service-workspace').hidden,true);
 dom.window.close();
});
test('gear preserves client privacy; barometer filters dates and leadership; closed tickets have their own view',async()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/service'}),w=dom.window;
 w.NestAuth={identity:{signedIn:true},open(){}};
 const requests=[{id:first,created:'2026-09-15T15:00:00Z',manager:'PM A',status:'Assigned',email:'a@bethelsd.org',updates:[]},{id:second,created:'2025-09-15T15:00:00Z',manager:'PM B',status:'Closed',email:'b@bethelsd.org',updates:[]},{id:'33333333-3333-4333-8333-333333333333',created:'',manager:'PM A',status:'Closed',email:'a@bethelsd.org',updates:[]}];
 w.fetch=async url=>{const op=new URL(url,'https://gknest.org').searchParams.get('operation');return {ok:true,json:async()=>op==='client-view'?{email:'a@bethelsd.org',requests:[]} :op==='metrics'?{trimester:{number:1,start:'2026-08-31',end:'2026-11-24'},metrics:[{manager:'PM A',division:'Period 2',divisionManager:'DM A',clientRelationsDirector:'Director A'},{manager:'PM B',division:'Period 5',divisionManager:'DM B',clientRelationsDirector:'Director B'}]}:{requests,managers:[],statuses:['Assigned','Closed']}};};
 const settle=()=>new Promise(r=>setTimeout(r,10));w.eval(fs.readFileSync('js/service.js','utf8'));await settle();
 assert.equal(w.document.querySelector('#service-front').hidden,false);assert.equal(w.document.querySelector('#view-manage').hidden,true);
 w.document.querySelector('#service-gear').click();await settle();assert.equal(w.document.querySelector('#service-front').hidden,true);assert.equal(w.document.querySelector('#service-gear').getAttribute('aria-expanded'),'true');
 w.document.querySelector('[data-tool=metrics]').click();await settle();
 const change=(id,value)=>{const el=w.document.querySelector('#'+id);el.value=value;el.dispatchEvent(new w.Event('change'));};
 change('metric-start','2026-08-31');change('metric-end','2026-11-24');assert.match(w.document.querySelector('#service-metric-status').textContent,/1 matching requests/);assert.match(w.document.querySelector('#service-metric-status').textContent,/missing submission dates/);
 change('metric-period','all');assert.match(w.document.querySelector('#service-metric-status').textContent,/3 matching requests/);
 change('metric-role','divisionManager');change('metric-person','DM B');assert.match(w.document.querySelector('#service-metrics').textContent,/PM B/);assert.equal(w.document.querySelector('#service-metrics').textContent.includes('PM A'),false);
 change('metric-role','clientRelationsDirector');change('metric-person','Director A');assert.match(w.document.querySelector('#service-metric-status').textContent,/2 matching requests/);
 change('metric-role','manager');change('metric-person','PM B');assert.match(w.document.querySelector('#service-metric-status').textContent,/1 matching requests/);
 w.document.querySelector('[data-tool=closed]').click();assert.equal(w.document.querySelector('#service-filter').value,'closed');assert.equal(w.document.querySelectorAll('.service-ticket').length,2);
 w.document.querySelector('#service-gear').click();await settle();assert.equal(w.document.querySelector('#service-front').hidden,false);assert.equal(w.document.querySelector('#view-manage').hidden,true);
 w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(w.document.querySelector('#metric-person').textContent.includes('PM A'),false);dom.window.close();
});
test('barometer cells override the shared dark table background and retain readable text',()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8')),w=dom.window;
 for(const file of ['css/internal-workspaces.css','css/service.css']){const style=w.document.createElement('style');style.textContent=fs.readFileSync(file,'utf8');w.document.head.append(style);}
 w.document.querySelector('#service-metrics').innerHTML='<table><tbody><tr><td>60 requests</td></tr></tbody></table>';
 const table=w.getComputedStyle(w.document.querySelector('#service-metrics table')),cell=w.getComputedStyle(w.document.querySelector('#service-metrics td'));
 assert.equal(table.backgroundColor,'rgba(0, 0, 0, 0)');assert.equal(cell.color,'rgb(37, 37, 31)');assert.notEqual(cell.backgroundColor,'rgb(16, 45, 66)');dom.window.close();
});
test('calendar trimester detection matches ordinal and Tri. variants, all-day dates and conflicting boundaries',()=>{
 const {ctx}=fixture(),e=(title,start,end)=>({title,start,end,allDay:true});
 const events=[e('First Day of School','2026-08-31','2026-09-01'),e('End of 1st Trimester','2026-11-24','2026-11-25'),e('End Tri. #2','2027-03-10','2027-03-11'),e('Last Day of School','2027-06-15','2027-06-16')];
 for(const [today,n,start,end] of [['2026-10-04',1,'2026-08-31','2026-11-24'],['2026-11-25',2,'2026-11-25','2027-03-10'],['2027-03-11',3,'2027-03-11','2027-06-15']]){
  const term=ctx.serviceCalendarRange_(events,today);assert.equal(term.number,n);assert.equal(term.start,start);assert.equal(term.end,end);
 }
 const explicit=[e('Start Trimester 1','2026-09-02','2026-09-03'),e('End First Trimester','2026-11-23','2026-11-24')];assert.equal(ctx.serviceCalendarRange_(explicit,'2026-10-04').end,'2026-11-23');
 assert.match(ctx.serviceCalendarRange_([...events,e('End Trimester 1','2026-11-23','2026-11-24')],'2026-10-04').error,/No single/);
 assert.match(ctx.serviceCalendarRange_(events.map(x=>({...x,allDay:false})),'2026-10-04').error,/No single/);
 assert.match(ctx.serviceCalendarRange_(events,'2027-07-01').error,/No single/);
});

test('ticket writes and client emails require the assigned current project manager or their own division leadership',()=>{
 const {ctx,state}=fixture();ctx.PERIODS['5']='other';ctx.rows_=p=>p==='2'?[['Student, Test','student@students.bethelsd.org'],['Replacement','replacement@students.bethelsd.org']]:[['Other PM','otherpm@students.bethelsd.org']];
 state.leaders.push(['Period 2','','Division Manager','DM','dm@students.bethelsd.org'],['Period 2','','Assistant Manager','AM','am@students.bethelsd.org'],['Period 5','','Division Manager','Other DM','otherdm@students.bethelsd.org']);
 ctx.authSession_=raw=>({email:raw});
 const r=ctx.serviceManage_('manage').requests[0],change={action:'auth-service-update',id:r.id,version:r.version,status:'In Progress',manager:r.manager,note:'Private log',publicNote:'Client update'};
 for(const session of ['otherdm@students.bethelsd.org','otherpm@students.bethelsd.org','coo@students.bethelsd.org'])assert.equal(ctx.serviceDispatch_({...change,session}).status,403);
 assert.equal(state.writes.length,0);assert.equal(state.mail.length,0);
 const pmView=ctx.serviceDispatch_({action:'auth-service-manage',session:'student@students.bethelsd.org'});assert.equal(pmView.status,200);assert.equal(pmView.requests.length,1);assert.equal(pmView.requests[0].canEdit,true);assert.equal(pmView.requests[0].canAssign,false);assert.equal(pmView.canReview,false);
 assert.equal(ctx.serviceDispatch_({...change,session:'student@students.bethelsd.org',manager:'replacement@students.bethelsd.org'}).status,403);
 assert.equal(ctx.serviceDispatch_({...change,session:'student@students.bethelsd.org'}).status,200);
 let updated=ctx.serviceManage_('manage').requests[0];const mail={action:'auth-service-email',id:r.id,version:updated.version,eventId:updated.updates.at(-1).eventId};
 assert.equal(ctx.serviceDispatch_({...mail,session:'otherdm@students.bethelsd.org'}).status,403);assert.equal(state.mail.length,0);
 assert.equal(ctx.serviceDispatch_({...mail,session:'am@students.bethelsd.org'}).status,200);assert.equal(state.mail.length,1);
 updated=ctx.serviceManage_('manage').requests[0];assert.equal(ctx.serviceDispatch_({...change,version:updated.version,session:'dm@students.bethelsd.org',manager:'otherpm@students.bethelsd.org'}).status,400);
 assert.equal(ctx.serviceDispatch_({...change,version:updated.version,session:'dm@students.bethelsd.org',manager:'replacement@students.bethelsd.org'}).status,200);
 updated=ctx.serviceManage_('manage').requests[0];assert.equal(ctx.serviceDispatch_({...change,version:updated.version,session:'student@students.bethelsd.org',manager:updated.manager}).status,403);
 state.leaders=state.leaders.filter(x=>x[4]!=='dm@students.bethelsd.org');assert.equal(ctx.serviceDispatch_({...change,version:updated.version,session:'dm@students.bethelsd.org',manager:updated.manager}).status,403);
 assert.equal(ctx.serviceDispatch_({...change,version:updated.version,session:'owner@bethelsd.org',manager:'otherpm@students.bethelsd.org'}).status,200);
});
test('ambiguous, stale, and unassigned manager labels do not grant ticket editing',()=>{
 const {ctx,state}=fixture(),item=ctx.serviceManage_('manage').requests[0];
 assert.equal(ctx.serviceTicketAccess_('director@students.bethelsd.org',{manager:''},state.leaders,ctx.serviceRoster_()).canEdit,false);
 assert.equal(ctx.serviceTicketAccess_('director@students.bethelsd.org',{manager:'Removed (Period 2)'},state.leaders,ctx.serviceRoster_()).canEdit,false);
 const duplicate=[...ctx.serviceRoster_(),...ctx.serviceRoster_()];assert.equal(ctx.serviceTicketAccess_('student@students.bethelsd.org',item,state.leaders,duplicate).canEdit,false);
 for(const role of ['Division Manager','Assistant Manager','Director of Client Relations'])assert.equal(ctx.serviceTicketAccess_('leader@students.bethelsd.org',item,[['Period 2','',role,'','leader@students.bethelsd.org']],ctx.serviceRoster_()).canEdit,true);
});

test('warm gear flips reuse the workspace; explicit refresh and account changes fetch fresh authorization',async()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{url:'https://gknest.org/service',runScripts:'outside-only'}),w=dom.window;let manageCalls=0;
 w.NestAuth={identity:{signedIn:true},open(){}};w.confirm=()=>true;
 w.fetch=async url=>{const op=new URL(url,'https://gknest.org').searchParams.get('operation');if(op==='manage')manageCalls++;return {ok:true,json:async()=>op==='client-view'?{email:'staff@bethelsd.org',requests:[]}:{requests:[{id:first,status:'Assigned',manager:'PM',canEdit:false,canAssign:false,updates:[],internalUpdates:[],legacyLog:'history',emailState:'unsent'}],managers:[],statuses:['Assigned'],canReview:true}};};
 const settle=()=>new Promise(r=>setTimeout(r,15));w.eval(fs.readFileSync('js/service.js','utf8'));await settle();
 const gear=w.document.querySelector('#service-gear');gear.click();await settle();assert.equal(manageCalls,1);
 w.document.querySelector('.service-ticket').click();assert.equal(w.document.querySelector('#service-status').disabled,true);assert.equal(w.document.querySelector('#service-note').disabled,true);assert.equal(w.document.querySelector('#service-save').disabled,true);assert.equal(w.document.querySelector('#service-email').disabled,true);assert.match(w.document.querySelector('#service-access-status').textContent,/View only/);
 gear.click();await settle();gear.click();await settle();assert.equal(manageCalls,1);assert.equal(w.document.querySelector('#view-manage').hidden,false);
 w.document.querySelector('#manager-refresh').click();await settle();assert.equal(manageCalls,2);
 w.document.dispatchEvent(new w.Event('nest-auth-change'));await settle();assert.equal(manageCalls,3);
 w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));gear.click();await settle();assert.equal(manageCalls,3);assert.equal(w.document.querySelector('#view-manage').hidden,true);dom.window.close();
});
test('person filters narrow with division and reset invalid previous choices',async()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{url:'https://gknest.org/service',runScripts:'outside-only'}),w=dom.window;w.NestAuth={identity:{signedIn:true}};w.confirm=()=>true;
 w.fetch=async url=>{const op=new URL(url,'https://gknest.org').searchParams.get('operation');return {ok:true,json:async()=>op==='client-view'?{email:'staff@bethelsd.org',requests:[]}:op==='metrics'?{trimester:{number:1,start:'2026-08-31',end:'2026-11-24'},metrics:[{division:'Period 2',manager:'PM A',divisionManager:'DM A'},{division:'Period 5',manager:'PM B',divisionManager:'DM B'}]}:{requests:[{id:first,manager:'PM A',created:'2026-09-01T15:00:00Z',status:'Assigned',email:'staff@bethelsd.org',updates:[]}],managers:[],statuses:['Assigned']}};};
 const settle=()=>new Promise(r=>setTimeout(r,15));w.eval(fs.readFileSync('js/service.js','utf8'));await settle();w.document.querySelector('#service-gear').click();await settle();w.document.querySelector('[data-tool=metrics]').click();await settle();
 const change=(id,value)=>{const el=w.document.getElementById(id);el.value=value;el.dispatchEvent(new w.Event('change'));};
 assert.equal(w.document.getElementById('metric-person-label').hidden,true);change('metric-role','manager');change('metric-person','PM B');change('metric-division','Period 2');assert.equal(w.document.getElementById('metric-person').value,'');assert.equal(w.document.getElementById('metric-person').textContent.includes('PM B'),false);assert.equal(w.document.getElementById('metric-person').textContent.includes('PM A'),true);change('metric-role','divisionManager');assert.equal(w.document.getElementById('metric-person').textContent.includes('DM A'),true);dom.window.close();
});

test('current division rosters are read in one batch and normalized without stale permission caching',()=>{
 const {ctx}=fixture();ctx.NEST_DATABASE='roster-source';let calls=0;ctx.PERIODS={2:'p2',5:'p5',CTSO:'ctso'};
 ctx.Sheets.Spreadsheets.Values.batchGet=(id,options)=>{calls++;assert.equal(id,'roster-source');assert.deepEqual(Array.from(options.ranges),["'Period 2'!A2:C1000","'Period 5'!A2:C1000","'CTSO'!A2:C1000"]);return {valueRanges:[{values:[[' PM A ','','A@students.bethelsd.org'],['Invalid','','bad']]},{values:[['PM B','','b@students.bethelsd.org']]},{values:[]}]};};ctx.rows_=()=>{throw new Error('Unexpected separate roster call');};
 const roster=ctx.serviceRoster_();assert.equal(calls,1);assert.equal(roster.length,2);assert.equal(roster[0].label,'PM A (Period 2)');assert.equal(roster[0].email,'a@students.bethelsd.org');ctx.serviceRoster_();assert.equal(calls,2);
});
test('saved log confirmation returns a current ticket revision without rebuilding unchanged barometer data',()=>{
 const {ctx,state}=fixture();state.tabs.push({sheetId:5,title:'ServiceBarometer',gridProperties:{rowCount:100,columnCount:9}});state.grids.ServiceBarometer=Array.from({length:100},()=>[]);
 const item=ctx.serviceManage_('manage').requests[0];let leaderReads=0;const originalLeaders=ctx.serviceLeaders_;ctx.serviceLeaders_=()=>{leaderReads++;return originalLeaders();};
 const saved=ctx.serviceDispatch_({action:'auth-service-update',session:'director',id:item.id,version:item.version,status:item.status,manager:item.manager,note:'New private entry',publicNote:'Public progress'});
 assert.equal(saved.status,200);assert.equal(leaderReads,1);assert.equal(state.writes.length,1);assert.equal(state.writes[0].requests.some(r=>r.updateCells?.range.sheetId===5),false);
 const fresh=ctx.serviceManage_('manage').requests.find(r=>r.id===item.id);assert.equal(saved.request.version,fresh.version);assert.equal(saved.request.legacyLog,fresh.legacyLog);assert.equal(saved.request.updates.at(-1).note,'Public progress');assert.equal(saved.request.internalUpdates.at(-1).note,'New private entry');
 const mailed=ctx.serviceDispatch_({action:'auth-service-email',session:'director',id:item.id,version:saved.request.version,eventId:saved.eventId});assert.equal(mailed.status,200);assert.equal(mailed.request.emailState,'sent');assert.equal(mailed.request.version,ctx.serviceManage_('manage').requests.find(r=>r.id===item.id).version);
 const closed=ctx.serviceDispatch_({action:'auth-service-update',session:'director',id:item.id,version:mailed.request.version,status:'Closed',manager:item.manager,note:'',publicNote:''});assert.equal(closed.status,200);assert.equal(closed.request.version,ctx.serviceManage_('manage').requests.find(r=>r.id===item.id).version);assert.equal(state.writes.at(-1).requests.some(r=>r.updateCells?.range.sheetId===5),true);
});
test('request and event reads use one batch while retaining duplicate ID checks',()=>{
 const {ctx}=fixture();const original=ctx.Sheets.Spreadsheets.Values.get;let calls=0;
 ctx.Sheets.Spreadsheets.Values.batchGet=(id,options)=>{calls++;assert.equal(options.valueRenderOption,'UNFORMATTED_VALUE');assert.equal(options.ranges.length,3);return {valueRanges:Array.from(options.ranges,r=>original(id,r))};};
 const state=ctx.serviceRead_();assert.equal(calls,1);assert.equal(state.requests.length,2);assert.equal(state.requests[0].description,'Fix the chair');assert.ok(state.tabs.find(t=>t.title==='Closed Tickets').headers.length);
 ctx.Sheets.Spreadsheets.Values.batchGet=()=>({valueRanges:[]});assert.throws(()=>ctx.serviceRead_(),/unavailable/);
});
test('save waits for write acknowledgement, updates the selected ticket directly, and does not reload all requests',async()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{url:'https://gknest.org/service',runScripts:'outside-only'}),w=dom.window;let manageCalls=0,resolveUpdate;
 const row={id:first,version:'a'.repeat(64),created:'2026-09-01T15:00:00Z',status:'Assigned',manager:'PM',canEdit:true,canAssign:true,email:'staff@bethelsd.org',updates:[],internalUpdates:[],legacyLog:'Earlier entry',emailState:'none'};
 w.NestAuth={identity:{signedIn:true}};w.confirm=()=>true;w.fetch=async(url,options)=>{const op=options?.body?JSON.parse(options.body).operation:new URL(url,'https://gknest.org').searchParams.get('operation');if(op==='update')return new Promise(resolve=>resolveUpdate=resolve);if(op==='manage')manageCalls++;return {ok:true,json:async()=>op==='client-view'?{email:'staff@bethelsd.org',requests:[]}:{requests:[row],managers:[],statuses:['Assigned']}};};
 const settle=()=>new Promise(r=>setTimeout(r,15));w.eval(fs.readFileSync('js/service.js','utf8'));await settle();w.document.querySelector('#service-gear').click();await settle();w.document.querySelector('.service-ticket').click();
 const note=w.document.querySelector('#service-note');note.value='Saved note';note.dispatchEvent(new w.Event('input',{bubbles:true}));w.document.querySelector('#service-edit').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.match(w.document.querySelector('#service-save-status').textContent,/Saving/);assert.equal(note.value,'Saved note');
 resolveUpdate({ok:true,json:async()=>({eventId:second,request:{...row,version:'b'.repeat(64),legacyLog:'Saved note',internalUpdates:[{time:'2026-10-04T15:00:00Z',actor:'Director',status:'Assigned',manager:'PM',note:'Saved note'}]}})});await settle();assert.equal(manageCalls,1);assert.equal(w.document.querySelector('#service-save-status').textContent,'Update saved.');assert.equal(note.value,'');assert.match(w.document.querySelector('#service-internal-history').textContent,/Saved note/);assert.equal(w.document.querySelector('#service-save').disabled,false);dom.window.close();
});

test('log email scopes include public entries only, escape HTML and link the exact NEST banner',()=>{
 const {ctx,state}=fixture();const events=[['2026-09-01',first,'update','actor','Assigned','First client update','e1','','PM','PRIVATE ONE'],['2026-09-02',first,'update','actor','Assigned','','e2','','PM','PRIVATE TWO'],['2026-09-03',second,'update','actor','Assigned','OTHER CLIENT','e3','','PM',''],['2026-09-04',first,'update','actor','In Progress','Latest <script>alert("x")</script>\nNext line','e4','','PM','PRIVATE THREE']];
 const item=ctx.serviceManage_('manage').requests[0];const entire=ctx.serviceEmailMessage_(item,events,'entire'),latest=ctx.serviceEmailMessage_(item,events,'latest');
 assert.match(entire.body,/First client update/);assert.match(entire.body,/Latest/);assert.ok(entire.body.indexOf('First')<entire.body.indexOf('Latest'));assert.equal(latest.body.includes('First client update'),false);
 for(const mail of [entire,latest]){for(const secret of ['PRIVATE','SECRET INTERNAL','OTHER CLIENT'])assert.equal(JSON.stringify(mail).includes(secret),false);assert.match(mail.htmlBody,/&lt;script&gt;/);assert.equal(mail.htmlBody.includes('<script>'),false);assert.match(mail.htmlBody,/<a href="https:\/\/gknest.org\/service"><img src="https:\/\/gknest.org\/assets\/nest-service-banner.png"/);assert.match(mail.htmlBody,/Next line/);}
 assert.equal(state.mail.length,0);
});
test('each log email scope has its own duplicate guard and invalid scope cannot send',()=>{
 const {ctx,state}=fixture();let item=ctx.serviceManage_('manage').requests[0];
 const saved=ctx.serviceDispatch_({action:'auth-service-update',session:'director',id:item.id,version:item.version,status:'Assigned',manager:item.manager,note:'PRIVATE',publicNote:'Public update'});item=saved.request;
 const payload={action:'auth-service-email',session:'director',id:item.id,eventId:saved.eventId};
 assert.equal(ctx.serviceDispatch_({...payload,version:item.version,logMode:'internal'}).status,400);assert.equal(state.mail.length,0);
 let sent=ctx.serviceDispatch_({...payload,version:item.version,logMode:'latest'});assert.equal(sent.status,200);assert.equal(sent.request.emailStates.latest,'sent');assert.equal(sent.request.emailStates.entire,'unsent');
 assert.equal(ctx.serviceDispatch_({...payload,version:sent.request.version,logMode:'latest'}).status,409);
 sent=ctx.serviceDispatch_({...payload,version:sent.request.version,logMode:'entire'});assert.equal(sent.status,200);assert.equal(sent.request.emailStates.entire,'sent');assert.equal(state.mail.length,2);
 assert.equal(ctx.serviceDispatch_({...payload,version:sent.request.version,logMode:'entire'}).status,409);
});
test('ticket time filters use calendar trimester, historical school years, all time and closed requests',async()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{url:'https://gknest.org/service',runScripts:'outside-only'}),w=dom.window;w.NestAuth={identity:{signedIn:true}};
 const requests=[{id:first,status:'Assigned',created:'2026-09-01T15:00:00Z',updates:[]},{id:second,status:'Closed',created:'2025-06-30T19:00:00Z',updates:[]},{id:'33333333-3333-4333-8333-333333333333',status:'Assigned',created:'2025-07-01T19:00:00Z',updates:[]},{id:'44444444-4444-4444-8444-444444444444',status:'Assigned',created:'',updates:[]}];
 w.fetch=async url=>({ok:true,json:async()=>url.includes('client-view')?{email:'staff@bethelsd.org',requests:[]}:{requests,trimester:{number:1,start:'2026-08-31',end:'2026-11-24'},managers:[],statuses:['Assigned','Closed']}});
 const settle=()=>new Promise(r=>setTimeout(r,15));w.eval(fs.readFileSync('js/service.js','utf8'));await settle();w.document.querySelector('#service-gear').click();await settle();
 const change=(id,value)=>{const el=w.document.getElementById(id);el.value=value;el.dispatchEvent(new w.Event(id==='service-filter'?'input':'change'));};const count=()=>w.document.querySelectorAll('.service-ticket').length;
 assert.equal(w.document.querySelector('[data-tool=tickets]').textContent.trim(),'Log Entry');assert.equal(count(),3);change('service-period','current');assert.equal(count(),1);change('service-period','year:2025');assert.equal(count(),1);change('service-period','year:2024');assert.equal(count(),0);change('service-filter','closed');assert.equal(count(),1);change('service-period','all');assert.equal(count(),1);change('service-filter','all');assert.equal(count(),4);dom.window.close();
});
test('email scope selection preserves clean drafts, passes chosen mode and blocks uncertain retry',async()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{url:'https://gknest.org/service',runScripts:'outside-only'}),w=dom.window;w.NestAuth={identity:{signedIn:true}};w.confirm=()=>true;let payload;
 const row={id:first,version:'a'.repeat(64),status:'Assigned',email:'staff@bethelsd.org',manager:'',canEdit:true,updates:[{eventId:second,note:'Public',status:'Assigned',time:'2026-09-01'}],internalUpdates:[],emailState:'sent',emailStates:{latest:'sent',entire:'unsent'}};
 w.fetch=async(url,options)=>{if(options?.body){payload=JSON.parse(options.body);return {ok:false,status:502,json:async()=>({error:'Check sent mail.'})};}return {ok:true,json:async()=>url.includes('client-view')?{email:row.email,requests:[]}:{requests:[row],managers:[],statuses:['Assigned']}};};
 const settle=()=>new Promise(r=>setTimeout(r,15));w.eval(fs.readFileSync('js/service.js','utf8'));await settle();w.document.querySelector('#service-gear').click();await settle();w.document.querySelector('.service-ticket').click();const button=w.document.getElementById('service-email'),mode=w.document.getElementById('service-email-mode');assert.equal(button.disabled,true);mode.value='entire';mode.dispatchEvent(new w.Event('input',{bubbles:true}));mode.dispatchEvent(new w.Event('change'));assert.equal(button.disabled,false);button.click();await settle();assert.equal(payload.logMode,'entire');assert.equal(button.disabled,true);mode.dispatchEvent(new w.Event('change'));assert.equal(button.disabled,true);dom.window.close();
});

test('barometer roster exposes names and opaque participation keys within existing role scope',()=>{
 const {ctx,state}=fixture();let item=ctx.serviceManage_('manage','director@students.bethelsd.org').requests[0];assert.equal(item.closedAt,'');const saved=ctx.serviceDispatch_({action:'auth-service-update',session:'director',id:item.id,version:item.version,status:'Closed',manager:item.manager,note:'PRIVATE',publicNote:'Ready'});assert.ok(saved.request.closedAt);assert.equal(saved.request.participantKeys.length,1);
 const view=ctx.serviceManage_('manage','director@students.bethelsd.org');assert.equal(view.students.length,1);assert.equal(view.students[0].name,'Student, Test');assert.equal(JSON.stringify(view.students).includes('@'),false);assert.equal(view.requests.find(r=>r.id===first).participantKeys[0],view.students[0].key);
 state.leaders=[];const scoped=ctx.serviceManage_('manage','student@students.bethelsd.org');assert.equal(scoped.requests.length,1);assert.equal(scoped.students.length,1);assert.equal(scoped.canReview,false);assert.equal(ctx.serviceManage_('manage','outsider@students.bethelsd.org').status,403);
});

function savedLogFixture(){const f=fixture();let r=f.ctx.serviceManage_('manage','director@students.bethelsd.org').requests[0];const result=f.ctx.serviceDispatch_({action:'auth-service-update',session:'director',id:r.id,version:r.version,status:'Assigned',manager:r.manager,note:'Original INTERNAL note\n\nSecond paragraph',publicNote:'Original PUBLIC note'});return {...f,item:result.request};}
function logChange(ctx,item,scope,action,note){const entry=(scope==='public'?item.updates:item.internalUpdates).find(e=>e.note);return ctx.serviceDispatch_({action:'auth-service-'+action+'-log',session:'director',id:item.id,version:item.version,eventId:entry.entryId,entryVersion:entry.entryVersion,scope,note});}
test('public and internal entries can be revised independently, with immutable audit and matching fresh versions',()=>{
 const {ctx,state,item}=savedLogFixture();const original=structuredClone(state.grids.ServiceWebLog[1]);let result=logChange(ctx,item,'public','edit','Corrected PUBLIC <b>text</b>');assert.equal(result.status,200);assert.equal(result.request.updates[0].note,'Corrected PUBLIC <b>text</b>');assert.equal(result.request.internalUpdates[0].note,'Original INTERNAL note\n\nSecond paragraph');assert.equal(result.request.updates[0].entryId,item.updates[0].entryId);assert.notEqual(result.request.updates[0].eventId,item.updates[0].eventId);
 result=logChange(ctx,result.request,'internal','edit','Corrected INTERNAL note\n\nNew paragraph');assert.equal(result.status,200);assert.equal(result.request.updates[0].note,'Corrected PUBLIC <b>text</b>');assert.equal(result.request.internalUpdates[0].note,'Corrected INTERNAL note\n\nNew paragraph');assert.equal(state.grids.ServiceRequests[1][2].includes('Original INTERNAL note'),false);assert.equal(state.grids.ServiceRequests[1][2].includes('Corrected INTERNAL note'),true);assert.equal(result.request.legacyLog,'SECRET INTERNAL HISTORY');assert.equal(result.request.logAudit.length,2);assert.deepEqual(state.grids.ServiceWebLog[1],original);assert.equal(result.request.version,ctx.serviceManage_('manage','director@students.bethelsd.org').requests.find(r=>r.id===item.id).version);assert.equal(state.mail.length,0);
});
test('deletion removes only its scope from visible logs and future email content, preserving original history and ticket status',()=>{
 const {ctx,state,item}=savedLogFixture();let result=logChange(ctx,item,'public','delete');assert.equal(result.status,200);assert.equal(result.request.updates.length,0);assert.equal(result.request.internalUpdates[0].note,'Original INTERNAL note\n\nSecond paragraph');assert.equal(result.request.emailStates.latest,'none');const mail=ctx.serviceEmailMessage_(result.request,state.grids.ServiceWebLog.slice(1),'entire');assert.equal(JSON.stringify(mail).includes('Original PUBLIC'),false);assert.equal(JSON.stringify(mail).includes('Original INTERNAL'),false);
 result=logChange(ctx,result.request,'internal','delete');assert.equal(result.status,200);assert.equal(result.request.internalUpdates.length,0);assert.equal(result.request.status,'Assigned');assert.equal(result.request.manager,item.manager);assert.equal(state.grids.ServiceRequests[1][2],'SECRET INTERNAL HISTORY');assert.equal(result.request.logAudit[1].previousNote,'Original INTERNAL note\n\nSecond paragraph');assert.equal(state.grids.ServiceWebLog[1][5],'Original PUBLIC note');assert.equal(state.grids.ServiceWebLog[1][9],'Original INTERNAL note\n\nSecond paragraph');
 const client=ctx.serviceClientRow_(ctx.serviceRead_().requests.find(r=>r.id===item.id),state.grids.ServiceWebLog.slice(1));assert.equal(client.updates.length,0);assert.equal(JSON.stringify(client).includes('Original'),false);
});
test('entry writes reject stale versions, cross-ticket IDs, invalid scopes and users outside the current ticket permission',()=>{
 const {ctx,state,item}=savedLogFixture(),e=item.updates[0],payload={action:'auth-service-edit-log',session:'director',id:item.id,version:item.version,eventId:e.entryId,entryVersion:e.entryVersion,scope:'public',note:'New text'};
 const before=state.writes.length;for(const change of [{session:'coo'},{session:'outsider'}])assert.equal(ctx.serviceDispatch_({...payload,...change}).status,403);for(const change of [{scope:'legacy'},{note:''},{note:'x'.repeat(2001)}])assert.equal(ctx.serviceDispatch_({...payload,...change}).status,400);assert.equal(ctx.serviceDispatch_({...payload,eventId:second}).status,404);assert.equal(ctx.serviceDispatch_({...payload,entryVersion:'a'.repeat(64)}).status,409);assert.equal(state.writes.length,before);assert.equal(ctx.serviceDispatch_(payload).status,200);assert.equal(ctx.serviceDispatch_(payload).status,409);
 const fresh=ctx.serviceManage_('manage','director@students.bethelsd.org').requests.find(r=>r.id===item.id);assert.equal(ctx.serviceDispatch_({...payload,version:fresh.version}).status,409);
});
test('public revisions update email guards while internal revisions retain client delivery state',()=>{
 const {ctx,item}=savedLogFixture();let r=item;
 const send=mode=>{const result=ctx.serviceDispatch_({action:'auth-service-email',session:'director',id:r.id,version:r.version,eventId:r.updates.at(-1).eventId,logMode:mode});assert.equal(result.status,200);r=result.request;};send('latest');send('entire');let changed=logChange(ctx,r,'internal','edit','Internal correction');r=changed.request;assert.equal(r.emailStates.latest,'sent');assert.equal(r.emailStates.entire,'sent');changed=logChange(ctx,r,'public','edit','Public correction');r=changed.request;assert.equal(r.emailStates.latest,'unsent');assert.equal(r.emailStates.entire,'unsent');assert.equal(r.updates[0].emailed,true);send('entire');assert.equal(r.emailStates.entire,'sent');
});
test('editing an older public note refreshes whole-log delivery eligibility without changing the latest entry eligibility',()=>{
 const {ctx,item}=savedLogFixture();let result=ctx.serviceDispatch_({action:'auth-service-update',session:'director',id:item.id,version:item.version,status:item.status,manager:item.manager,note:'Other internal',publicNote:'Newest public'}),r=result.request;
 for(const mode of ['latest','entire']){result=ctx.serviceDispatch_({action:'auth-service-email',session:'director',id:r.id,version:r.version,eventId:r.updates.at(-1).eventId,logMode:mode});r=result.request;}
 result=logChange(ctx,r,'public','edit','Older public correction');assert.equal(result.status,200);assert.equal(result.request.emailStates.latest,'sent');assert.equal(result.request.emailStates.entire,'unsent');assert.equal(result.request.updates.at(-1).note,'Newest public');
});
test('owner test sends use only the verified owner recipient, never mark the client emailed and remain repeatable explicitly',()=>{
 const {ctx,state,item}=savedLogFixture();ctx.OWNER_EMAILS=['mario@memberhq.net','mpenalver@bethelsd.org','astramario@gmail.com'];ctx.authSession_=raw=>({email:raw});let r=item;
 for(const owner of ctx.OWNER_EMAILS){const result=ctx.serviceDispatch_({action:'auth-service-test-email',session:owner,id:r.id,version:r.version,eventId:r.updates.at(-1).eventId,logMode:'entire',to:'attacker@bethelsd.org'});assert.equal(result.status,200);assert.equal(result.testSent,true);const sent=state.mail.at(-1);assert.equal(sent.to,owner);assert.match(sent.subject,/^TEST/);assert.match(sent.htmlBody,/nest-service-banner.png/);assert.match(sent.body,/Original PUBLIC/);assert.equal(sent.body.includes('INTERNAL'),false);r=result.request;assert.equal(r.emailStates.latest,'unsent');assert.equal(r.emailStates.entire,'unsent');assert.equal(r.updates[0].emailed,false);assert.equal(r.canTestEmail,true);assert.equal(r.testEmail,owner);}
 assert.equal(state.grids.ServiceWebLog.filter(e=>e[2]==='email').length,0);assert.equal(state.grids.ServiceWebLog.filter(e=>e[2]==='email-test'&&e[7]==='sent').length,3);
 const writes=state.writes.length;assert.equal(ctx.serviceDispatch_({action:'auth-service-test-email',session:'director@students.bethelsd.org',id:r.id,version:r.version,eventId:r.updates[0].eventId}).status,403);assert.equal(state.writes.length,writes);assert.equal(state.mail.length,3);
});

test('HTTP log edits validate scope and revisions and test email accepts no client-controlled recipient',async()=>{
 const old=globalThis.fetch;process.env.SPINNER_BRIDGE_URL='https://script.google.com/test';process.env.SPINNER_BRIDGE_TOKEN='test';let sent;
 globalThis.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:200,request:{id:first,version:'c'.repeat(64)}})};};const headers={origin:'https://gknest.org','content-type':'application/json',cookie:'__Host-nest-auth='+'a'.repeat(64)},base={id:first,version:'b'.repeat(64),eventId:second,entryVersion:'d'.repeat(64),scope:'internal',note:'New text'};
 try{
  for(const patch of [{scope:'legacy'},{entryVersion:'bad'},{eventId:'row 3'},{note:' '}]){const res=response();await handler({method:'POST',headers,body:{operation:'edit-log',...base,...patch}},res);assert.equal(res.code,400);}
  const edit=response();await handler({method:'POST',headers,body:{operation:'edit-log',...base,to:'attacker@bethelsd.org',manager:'FORGED'}},edit);assert.equal(edit.code,200);assert.equal(sent.action,'auth-service-edit-log');assert.equal(sent.scope,'internal');assert.equal('manager' in sent,false);assert.equal('to' in sent,false);
  const preview=response();await handler({method:'POST',headers,body:{operation:'test-email',...base,logMode:'entire',to:'attacker@bethelsd.org'}},preview);assert.equal(preview.code,200);assert.equal(sent.action,'auth-service-test-email');assert.equal(sent.logMode,'entire');assert.equal('to' in sent,false);
 }finally{globalThis.fetch=old;delete process.env.SPINNER_BRIDGE_URL;delete process.env.SPINNER_BRIDGE_TOKEN;}
});
test('leadership copies are division-scoped, freshly validated and audited with successful send timestamp',()=>{
 const {ctx,state}=fixture();state.leaders.push(['Period 2','','Division Manager','Manager','manager@students.bethelsd.org'],['Period 3','','Assistant Manager','Other division','other@students.bethelsd.org']);
 let item=ctx.serviceRead_().requests[0];let result=ctx.serviceWrite_('director@students.bethelsd.org',{action:'auth-service-update',id:first,version:item.version,status:item.status,manager:item.manager,note:'Private note',publicNote:'Client progress'});item=result.request;
 assert.deepEqual(Array.from(item.copyChoices,c=>c.email),['director@students.bethelsd.org','manager@students.bethelsd.org']);
 const request={action:'auth-service-email',id:first,version:item.version,eventId:item.updates[0].eventId,logMode:'entire',cc:['other@students.bethelsd.org']};assert.equal(ctx.serviceWrite_('director@students.bethelsd.org',request).status,403);assert.equal(state.mail.length,0);
 request.cc=['manager@students.bethelsd.org'];state.leaders=state.leaders.filter(row=>row[4]!=='manager@students.bethelsd.org');assert.equal(ctx.serviceWrite_('director@students.bethelsd.org',request).status,403);state.leaders.push(['Period 2','','Division Manager','Manager','manager@students.bethelsd.org']);
 result=ctx.serviceWrite_('director@students.bethelsd.org',request);assert.equal(result.status,200);assert.equal(state.mail[0].to,'staff@bethelsd.org');assert.equal(state.mail[0].cc,'manager@students.bethelsd.org,student@students.bethelsd.org');const event=result.request.emailHistory[0];assert.equal(event.actor,'director@students.bethelsd.org');assert.equal(event.state,'sent');assert.ok(Number.isFinite(Date.parse(event.time)));assert.deepEqual(Array.from(event.cc),[...request.cc,'student@students.bethelsd.org']);assert.match(state.grids.ServiceRequests[1][2],/Client log email sent/);assert.match(state.grids.ServiceRequests[1][2],/CC: manager@students/);assert.equal(result.request.updates.length,1);assert.equal(result.request.updates[0].note,'Client progress');assert.equal(JSON.stringify(ctx.serviceClientRow_(ctx.serviceRead_().requests[0],ctx.serviceRead_().events)).includes('manager@students'),false);
});
test('uncertain mail retains recipients and actor without a successful send log; testing refuses copied recipients',()=>{
 const {ctx,state}=fixture();let item=ctx.serviceRead_().requests[0];let result=ctx.serviceWrite_('owner@bethelsd.org',{action:'auth-service-update',id:first,version:item.version,status:item.status,manager:item.manager,note:'',publicNote:'Public'});item=result.request;const request={action:'auth-service-test-email',id:first,version:item.version,eventId:item.updates[0].eventId,cc:['director@students.bethelsd.org']};assert.equal(ctx.serviceWrite_('owner@bethelsd.org',request).status,400);assert.equal(state.mail.length,0);
 ctx.MailApp.sendEmail=()=>{throw new Error('Transport unavailable');};request.action='auth-service-email';assert.equal(ctx.serviceWrite_('owner@bethelsd.org',request).status,502);const read=ctx.serviceRead_(),record=ctx.serviceEmailHistory_(read.requests[0],read.events)[0];assert.equal(record.state,'unknown');assert.equal(record.actor,'owner@bethelsd.org');assert.equal(record.cc[0],'director@students.bethelsd.org');assert.equal(state.grids.ServiceRequests[1][2].includes('Client log email sent'),false);
});
test('email starts with original ticket details and encloses chosen public log below the safely escaped summary',()=>{
 const {ctx}=fixture(),item=ctx.serviceRead_().requests[0];item.description='Original <script>request</script>\nSecond line';const events=[['2026-10-04T17:00:00Z',first,'update','actor','Assigned','Saved progress','e1','','PM','PRIVATE NOTE']];
 const mail=ctx.serviceEmailMessage_(item,events,'latest'),dom=new JSDOM(mail.htmlBody),d=dom.window.document;assert.match(mail.body,/Room: 174/);assert.match(mail.body,/Client: Staff Name/);assert.match(mail.body,/Category: Repair/);assert.match(mail.body,/Project manager: Student, Test/);assert.match(mail.body,/Submitted:/);assert.ok(mail.body.indexOf('Original request details')<mail.body.indexOf('Saved progress'));assert.equal(d.querySelector('script'),null);const tables=[...d.querySelectorAll('table')],panel=tables.find(t=>t.textContent.includes('Saved progress'));assert.ok(panel);assert.match(panel.getAttribute('style'),/border:1px solid/);assert.match(d.body.textContent,/Original <script>request/);assert.equal(mail.htmlBody.includes('PRIVATE NOTE'),false);assert.match(mail.htmlBody,/Attachment 1/);dom.window.close();
});
test('project-manager email link resolves exact current roster identity and never guesses ambiguous or stale assignments',()=>{
 const {ctx}=fixture(),item=ctx.serviceRead_().requests[0],roster=ctx.serviceRoster_();const mail=ctx.serviceEmailMessage_(item,[],'latest',roster);assert.match(mail.htmlBody,/<a href="mailto:student@students.bethelsd.org">Student, Test \(Period 2\)<\/a>/);for(const entries of [[],[...roster,...roster],[{email:'bad\"@students.bethelsd.org',label:item.manager,period:'2'}]])assert.equal(ctx.serviceEmailMessage_(item,[],'latest',entries).htmlBody.includes('mailto:'),false);
});
test('single-ticket refresh is authenticated and keeps assigned manager, leadership and client data boundaries',()=>{
 const {ctx,state}=fixture();let data=ctx.serviceDispatch_({action:'auth-service-ticket',session:'director',id:first});assert.equal(data.status,200);assert.equal(data.request.id,first);assert.equal('requests' in data,false);assert.equal(ctx.serviceDispatch_({action:'auth-service-ticket',session:'outsider',id:first}).status,403);assert.equal(ctx.serviceDispatch_({action:'auth-service-ticket',session:'invalid',id:first}).status,401);assert.equal(ctx.serviceDispatch_({action:'auth-service-ticket',session:'director',id:'invalid'}).status,400);assert.equal(ctx.serviceDispatch_({action:'auth-service-ticket',session:'director',id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}).status,404);state.leaders=[];assert.equal(ctx.serviceDispatch_({action:'auth-service-ticket',session:'director',id:first}).status,403);
});
test('only the assigned manager and division leaders can manage assigned tickets; note authorship limits revisions with admin override',()=>{
 const {ctx,state}=fixture();state.leaders.push(['Period 2','','Division Manager','DM','dm@students.bethelsd.org'],['Period 2','','Assistant Manager','AM','am@students.bethelsd.org'],['Period 3','','Division Manager','Other','other@students.bethelsd.org']);let item=ctx.serviceRead_().requests[0],result=ctx.serviceWrite_('student@students.bethelsd.org',{action:'auth-service-update',id:first,version:item.version,status:item.status,manager:item.manager,note:'PM internal',publicNote:'PM public'});assert.equal(result.status,200);
 for(const actor of ['student@students.bethelsd.org','director@students.bethelsd.org','dm@students.bethelsd.org','am@students.bethelsd.org'])assert.equal(ctx.serviceTicketAccess_(actor,ctx.serviceRead_().requests[0],state.leaders,ctx.serviceRoster_()).canEdit,true);assert.equal(ctx.serviceTicketAccess_('other@students.bethelsd.org',ctx.serviceRead_().requests[0],state.leaders,ctx.serviceRoster_()).canEdit,false);
 let row=ctx.serviceManagerRow_(ctx.serviceRead_().requests[0],ctx.serviceRead_().events,'director@students.bethelsd.org',state.leaders,ctx.serviceRoster_());assert.equal(row.updates[0].canManageNote,false);assert.equal(row.internalUpdates[0].canManageNote,false);const entry=row.updates[0],request={action:'auth-service-delete-log',id:first,version:row.version,eventId:entry.entryId,entryVersion:entry.entryVersion,scope:'public'};assert.equal(ctx.serviceWrite_('director@students.bethelsd.org',request).status,403);assert.equal(ctx.serviceWrite_('owner@bethelsd.org',request).status,200);
 row=ctx.serviceManagerRow_(ctx.serviceRead_().requests[0],ctx.serviceRead_().events,'student@students.bethelsd.org',state.leaders,ctx.serviceRoster_());assert.equal(row.internalUpdates[0].canManageNote,true);assert.equal(ctx.serviceWrite_('student@students.bethelsd.org',{action:'auth-service-edit-log',id:first,version:row.version,eventId:row.internalUpdates[0].entryId,entryVersion:row.internalUpdates[0].entryVersion,scope:'internal',note:'Own correction'}).status,200);
});
test('division leadership can assign open unassigned tickets without changing status or notes, then access follows assigned division',()=>{
 const {ctx,state}=fixture();let item=ctx.serviceRead_().requests.find(r=>r.id===second),leaders=state.leaders,roster=ctx.serviceRoster_();assert.equal(ctx.serviceTicketAccess_('director@students.bethelsd.org',item,leaders,roster).canAssign,true);assert.equal(ctx.serviceTicketAccess_('director@students.bethelsd.org',item,leaders,roster).canEdit,false);assert.equal(ctx.serviceTicketAccess_('coo@students.bethelsd.org',item,leaders,roster).canAssign,false);assert.equal(ctx.serviceTicketAccess_('student@students.bethelsd.org',item,leaders,roster).canAssign,false);assert.equal(ctx.serviceTicketAccess_('director@students.bethelsd.org',{...item,status:'Closed'},leaders,roster).canAssign,false);assert.equal(ctx.serviceTicketAccess_('director@students.bethelsd.org',{...item,manager:'Removed PM'},leaders,roster).canAssign,false);
 const payload={action:'auth-service-update',id:second,version:item.version,status:item.status,manager:'student@students.bethelsd.org',note:'',publicNote:''};assert.equal(ctx.serviceWrite_('director@students.bethelsd.org',{...payload,note:'Forbidden before assignment'}).status,403);assert.equal(ctx.serviceWrite_('student@students.bethelsd.org',{...payload,status:'Closed'}).status,403);const result=ctx.serviceWrite_('director@students.bethelsd.org',payload);assert.equal(result.status,200);assert.equal(result.request.manager,'Student, Test (Period 2)');assert.equal(result.request.canEdit,true);item=ctx.serviceRead_().requests.find(r=>r.id===second);assert.equal(ctx.serviceTicketAccess_('student@students.bethelsd.org',item,leaders,roster).canEdit,true);assert.equal(item.status,'New!');assert.equal(result.request.updates.length,0);
});
test('a leader may route an unassigned ticket to another division but cannot manage it after assignment',()=>{
 const {ctx,state}=fixture();state.leaders.push(['Period 3','','Division Manager','Other leader','other@students.bethelsd.org']);const item=ctx.serviceRead_().requests.find(r=>r.id===second);const before=ctx.serviceManagerRow_(item,ctx.serviceRead_().events,'other@students.bethelsd.org',state.leaders,ctx.serviceRoster_());assert.equal(before.canAssign,true);assert.equal(before.assignmentChoices[0].email,'student@students.bethelsd.org');const result=ctx.serviceWrite_('other@students.bethelsd.org',{action:'auth-service-update',id:second,version:item.version,status:item.status,manager:'student@students.bethelsd.org',note:'',publicNote:''});assert.equal(result.status,200);assert.equal(result.request.canEdit,false);assert.equal(result.request.canAssign,false);assert.equal(ctx.serviceWrite_('other@students.bethelsd.org',{action:'auth-service-update',id:second,version:result.request.version,status:item.status,manager:'student@students.bethelsd.org',note:'Forbidden after routing',publicNote:''}).status,403);
});


test('directors and division managers can change status across divisions including unassigned tickets, but not other protected fields',()=>{
 for(const role of ['Division Manager','Director of Client Relations','Client Relations Director']){
  const {ctx,state}=fixture(),actor='crossdivision@students.bethelsd.org';state.leaders.push(['Period 5','',role,'Leader',actor]);ctx.authSession_=raw=>({email:raw});
  let item=ctx.serviceRead_().requests.find(r=>r.id===first),row=ctx.serviceManagerRow_(item,[],actor,state.leaders,ctx.serviceRoster_());
  assert.equal(row.canEdit,false);assert.equal(row.canAssign,false);assert.equal(row.canChangeStatus,true);
  let payload={action:'auth-service-update',id:item.id,version:item.version,status:'In Progress',manager:item.manager,note:'',publicNote:''};
  for(const extra of [{note:'Not allowed'},{publicNote:'Not allowed'},{manager:'student@students.bethelsd.org'}])assert.equal(ctx.serviceWrite_(actor,{...payload,...extra}).status,403);
  assert.equal(state.writes.length,0);const saved=ctx.serviceDispatch_({...payload,session:actor});assert.equal(saved.status,200);assert.equal(saved.request.status,'In Progress');assert.equal(saved.request.manager,item.manager);assert.equal(saved.request.canChangeStatus,true);assert.equal(saved.request.canEdit,false);
  assert.equal(state.mail.length,0);assert.equal(ctx.serviceWrite_(actor,{action:'auth-service-email',id:first,version:saved.request.version,eventId:'x'}).status,403);
  item=ctx.serviceRead_().requests.find(r=>r.id===second);payload={...payload,id:item.id,version:item.version,manager:'',status:'Closed'};
  assert.equal(ctx.serviceWrite_(actor,payload).status,200);assert.equal(ctx.serviceRead_().requests.find(r=>r.id===second).status,'Closed');
  item=ctx.serviceRead_().requests.find(r=>r.id===first);state.leaders=state.leaders.filter(r=>r[4]!==actor);assert.equal(ctx.serviceWrite_(actor,{...payload,id:first,version:item.version,manager:item.manager}).status,403);
 }
});

test('assigned project manager status access follows the current roster assignment and never extends to unrelated students',()=>{
 const {ctx,state}=fixture(),item=ctx.serviceRead_().requests.find(r=>r.id===first),roster=ctx.serviceRoster_();
 assert.equal(ctx.serviceTicketAccess_('student@students.bethelsd.org',item,state.leaders,roster).canChangeStatus,true);
 for(const actor of ['otherpm@students.bethelsd.org','coo@students.bethelsd.org','outsider@students.bethelsd.org'])assert.equal(ctx.serviceTicketAccess_(actor,item,state.leaders,roster).canChangeStatus,false);
 assert.equal(ctx.serviceTicketAccess_('student@students.bethelsd.org',{...item,manager:''},state.leaders,roster).canChangeStatus,false);
 assert.equal(ctx.serviceTicketAccess_('student@students.bethelsd.org',item,state.leaders,[]).canChangeStatus,false);
});
