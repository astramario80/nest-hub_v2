import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {renderDivisionPage} from '../api/division-page.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
function school(){
 const records=[],protocols=[['step-1','Welcome','https://example.org/start','Arrange an introduction',true]],members=[[true,false,'Sample, Ada','100001','100001@students.bethelsd.org'],[false,true,'Example, Pat','100002','100002@students.bethelsd.org']],roster=[['Sample, Ada','100001@students.bethelsd.org'],['Example, Pat','100002@students.bethelsd.org'],['New, Kai','100003@students.bethelsd.org']],sent=[],props=new Map([['robotics-private-storage','private'],['robotics-website-storage-v1:ctso','ready']]);let identity='mpenalver@bethelsd.org',roles=[],quota=100,fail=false;
 const store={getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)};
 const c=vm.createContext({Date,Map,Set,JSON,PERIODS:{CTSO:'ctso'},OWNER_EMAILS:['mpenalver@bethelsd.org'],NEST_DATABASE:'nest',LEADERSHIP_DATABASE:'leaders',email_:v=>String(v||'').trim().toLowerCase(),memberEmail_:v=>v,rows_:()=>roster,hash_:hash,nestAccessValues_:()=>({values:roles}),authSession_:()=>({email:identity}),PropertiesService:{getScriptProperties:()=>store},Utilities:{getUuid:randomUUID,formatDate:()=> 'Wednesday, October 28, 2026, 2:30 PM PDT'},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},CalendarApp:{getCalendarById:()=>({getTimeZone:()=> 'America/Los_Angeles',getEvents:()=>[{getTitle:()=> 'NEST™ Robotics Weekly',getStartTime:()=>new Date(Date.now()+86400000)}]})},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:m=>{if(fail)throw new Error('test');sent.push(m);}},Sheets:{Spreadsheets:{Values:{batchGet:()=>({valueRanges:[{values:roster.map(r=>[r[0],'',r[1]])}]}),get:(id,range)=>({values:id==='private'?range.startsWith("'Members'")?records:protocols:range.includes('A2:E')?members:[]}),batchUpdate:({data},id)=>data.forEach(d=>{
 if(id==='private'&&d.range.startsWith("'Members'")){const row=+d.range.match(/A(\d+)/)[1]-2;records[row]=d.values[0];}
 else if(id==='private'){protocols.splice(0,protocols.length,...d.values.filter(r=>r[0]));}
 else{const match=d.range.match(/A(\d+):([BE])/),row=+match[1]-2;if(match[2]==='E')members[row]=d.values[0];else members[row].splice(0,2,...d.values[0]);}
 })}}}});
 vm.runInContext(fs.readFileSync('google-spinner/Robotics.js','utf8'),c);vm.runInContext(fs.readFileSync('google-spinner/RoboticsOnboarding.js','utf8'),c);
 const response=(id='response-1',email='100003@students.bethelsd.org')=>({getId:()=>id,getTimestamp:()=>new Date('2026-10-08T10:00:00Z'),getRespondentEmail:()=>email,getItemResponses:()=>[{getItem:()=>({getId:()=>1,getTitle:()=> 'Contact phone',getType:()=> 'TEXT'}),getResponse:()=> '555-0100'},{getItem:()=>({getId:()=>2,getTitle:()=> 'Parent consent',getType:()=> 'CHECKBOX'}),getResponse:()=> ['Yes']}]});
 return {c,records,protocols,members,roster,sent,response,props,setIdentity:v=>identity=v,setRoles:v=>roles=v,setQuota:v=>quota=v,setFail:v=>fail=v};
}
test('active members see only their profile; inactive members and partner liaison have no private access',()=>{
 const h=school();h.setIdentity('100001@students.bethelsd.org');const own=h.c.roboticsState_().members[0],other=h.c.roboticsState_().members[1];
 const view=h.c.roboticsDispatch_({operation:'view'});assert.equal(view.manager,false);assert.equal(view.members.length,0);assert.equal(view.requests.length,0);assert.equal(view.protocols.length,0);assert.equal(view.ownMember.id,own.id);
 const result=h.c.roboticsDispatch_({operation:'profile',member:own.id});assert.equal(result.status,200);assert.equal(h.c.roboticsDispatch_({operation:'profile',member:other.id}).status,403);
 assert.equal(h.c.roboticsDispatch_({operation:'profile-save',member:own.id,revision:result.profile.revision,fields:{'contact-phone':'555-0133'}}).status,200);
 assert.equal(h.c.roboticsDispatch_({operation:'checklist',member:own.id,revision:result.profile.revision,step:'step-1',done:true}).status,409);
 h.setIdentity('100002@students.bethelsd.org');h.setRoles([['CTSO','','Partner Liaison','','100002@students.bethelsd.org']]);assert.equal(h.c.roboticsDispatch_({operation:'view'}).status,403);assert.equal(h.c.roboticsDispatch_({operation:'profile',member:own.id}).status,403);
 h.setRoles([['CTSO','','Executive Vice-President','','100002@students.bethelsd.org']]);assert.equal(h.c.roboticsDispatch_({operation:'profile',member:own.id}).status,200);assert.equal(h.c.roboticsAccess_('100002@students.bethelsd.org'),false);
});
test('signup capture is idempotent, immutable form answers stay immutable, and activation binds a verified identity',()=>{
 const h=school(),entry=h.c.roboticsCaptureSignup_(h.response(),false);h.c.roboticsCaptureSignup_(h.response(),false);assert.equal(h.records.length,1);
 let p=h.c.roboticsDispatch_({operation:'profile',request:entry.key}).profile;
 assert.equal(h.c.roboticsDispatch_({operation:'profile-save',request:entry.key,revision:p.revision,fields:{'respondent-email':'evil@example.org'}}).status,400);
 assert.equal(h.c.roboticsDispatch_({operation:'profile-save',request:entry.key,revision:p.revision,fields:{2:'No'}}).status,400);
 assert.equal(h.c.roboticsDispatch_({operation:'activate-request',request:entry.key,revision:p.revision,member:'forged',memberRevision:h.c.roboticsState_().revision}).status,400);
 const candidate=h.c.roboticsDispatch_({operation:'view'}).requests[0].candidate;
 assert.equal(h.c.roboticsDispatch_({operation:'activate-request',request:entry.key,revision:p.revision,member:candidate.id,memberRevision:h.c.roboticsState_().revision}).status,200);
 h.setIdentity('100003@students.bethelsd.org');assert.equal(h.c.roboticsDispatch_({operation:'profile',member:candidate.id}).profile.fields.length,3);
 h.members[2][0]=false;h.members[2][1]=true;assert.equal(h.c.roboticsDispatch_({operation:'profile',member:candidate.id}).status,403);
});
test('protocol revisions reject races, unsafe URLs are rejected, and retired steps retain per-member history',()=>{
 const h=school(),e=h.c.roboticsCaptureSignup_(h.response(),false);let p=h.c.roboticsDispatch_({operation:'profile',request:e.key}).profile;
 p=h.c.roboticsDispatch_({operation:'checklist',request:e.key,revision:p.revision,step:'step-1',done:true}).profile;assert.equal(p.checks['step-1'].done,true);
 const view=h.c.roboticsDispatch_({operation:'view'}),steps=[{id:'step-1',label:'Welcome',url:'https://example.org/?access_token=secret',detail:'',active:false}];
 assert.equal(h.c.roboticsDispatch_({operation:'protocol-save',revision:view.protocolRevision,protocols:steps}).status,400);
 steps[0].url='https://example.org/';assert.equal(h.c.roboticsDispatch_({operation:'protocol-save',revision:view.protocolRevision,protocols:steps}).status,200);
 assert.equal(h.c.roboticsDispatch_({operation:'protocol-save',revision:view.protocolRevision,protocols:steps}).status,409);
 p=h.c.roboticsDispatch_({operation:'profile',request:e.key}).profile;assert.equal(p.protocols.length,0);assert.equal(p.checks['step-1'].done,true);
});
test('mail uses current executives and hired liaison, meeting title lookup, escaped rich links, and never repeats claimed delivery',()=>{
 const h=school();h.setRoles([['CTSO','','Chief Executive Officer','','100001@students.bethelsd.org'],['CTSO','','Partner Liaison','','100002@students.bethelsd.org'],['CTSO','','Partner Liaison','','outsider@example.org']]);const e=h.c.roboticsCaptureSignup_(h.response(),false);
 h.c.roboticsSignupMail_(e.key);assert.equal(h.sent.length,4);assert.match(h.sent[0].body,/October 28/);assert.match(h.sent[1].htmlBody,/<a href="https:\/\/example.org\/start">Welcome<\/a>/);assert.equal(h.sent.some(m=>m.to==='outsider@example.org'),false);
 h.c.roboticsSignupMail_(e.key);assert.equal(h.sent.length,4);
 const old=h.c.roboticsCaptureSignup_(h.response('older'),true);h.c.roboticsSignupMail_(old.key);assert.equal(h.sent.length,4);
});
test('quota defers unclaimed mail and delivery failures remain visible without automatic resend',()=>{
 const h=school(),e=h.c.roboticsCaptureSignup_(h.response(),false);h.setQuota(0);assert.throws(()=>h.c.roboticsSignupMail_(e.key),/quota/);assert.equal(h.sent.length,0);
 assert.equal(h.c.roboticsDispatch_({operation:'view'}).requests[0].notification,'Needs review');h.setQuota(100);h.setFail(true);h.c.roboticsRetryPendingSignups();h.setFail(false);h.c.roboticsRetryPendingSignups();assert.equal(h.sent.length,0);assert.equal(h.c.roboticsDispatch_({operation:'view'}).requests[0].notification,'Needs review');
});
test('UI separates inactive members and clears protected profiles on sign-out',async()=>{
 const h=school(),view=JSON.parse(JSON.stringify(h.c.roboticsDispatch_({operation:'view'}))),dom=new JSDOM(renderDivisionPage('CTSO',{manager:{},leaders:[],canManageRobotics:true}),{runScripts:'outside-only',url:'https://gknest.org/divisions/CTSO#robotics'}),w=dom.window;
 w.AbortSignal.timeout=()=>undefined;w.NestDivisionHQ={allowed:true,active:'robotics'};w.fetch=async()=>({ok:true,json:async()=>view});w.eval(fs.readFileSync('js/robotics.js','utf8'));await new Promise(r=>setTimeout(r,10));
 assert.equal(w.document.querySelector('[data-robotics-members]').children.length,1);assert.equal(w.document.querySelector('[data-robotics-inactive]').children.length,1);
 w.document.querySelector('[data-robotics-profile]').textContent='Private answer';w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(w.document.querySelector('[data-robotics-profile]').textContent,'');w.close();
});
test('owner setup imports historical responses silently, attaches only verified identities, and installs each trigger once',()=>{
 const h=school(),triggers=[];h.c.Session={getEffectiveUser:()=>({getEmail:()=> 'mpenalver@bethelsd.org'})};h.c.FormApp={openById:()=>({collectsEmail:()=>true,getResponses:()=>[h.response('historical','100001@students.bethelsd.org')]})};
 h.c.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:handler=>{let source='';const chain={forForm:()=>{source='1ROTm1QXYvOzRUh3TVeNDQNhXmxRrYxNayzxZHvBI1cg';return chain;},onFormSubmit:()=>chain,timeBased:()=>chain,everyHours:()=>chain,create:()=>triggers.push({getHandlerFunction:()=>handler,getTriggerSourceId:()=>source})};return chain;}};
 h.c.roboticsSetupOnboarding();h.c.roboticsSetupOnboarding();assert.equal(triggers.length,2);assert.equal(h.records.length,1);assert.equal(h.sent.length,0);
 const record=JSON.parse(h.records[0][1]);assert.equal(record.memberId,h.c.roboticsState_().members[0].id);assert.equal(record.historical,true);
 h.c.Session={getEffectiveUser:()=>({getEmail:()=> 'outsider@example.org'})};assert.throws(()=>h.c.roboticsSetupOnboarding(),/school owner/);
});
