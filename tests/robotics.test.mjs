import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {renderDivisionPage} from '../api/division-page.mjs';
import handler from '../api/robotics.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
function school(){
 const values=new Map([["ctso|'Website Member Status'!A2:E1000",[[true,false,'Sample, Ada',100001,'wrong@students.bethelsd.org'],[true,false,'Example, Pat',123,'123@students.bethelsd.org']]],["ctso|'Website Member Status'!H2:L1000",[]],["1Mzxf0q87UHCQ5R6L0IBl2uCO_TmH-TmdcRSDIxOmBgw|'MembershipForm'!A2:E1000",[[true,false,'Sample, Ada',100001],[true,false,'Example, Pat',123]]]]);
 const roster=[['Sample, Ada','100001@students.bethelsd.org'],['Example, Pat','123@students.bethelsd.org']],writes=[],sent=[],props=new Map([['robotics-website-storage-v1:ctso','ready']]);
 const store={getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k),getProperties:()=>Object.fromEntries(props)};
 let roles=[],identity='100001@students.bethelsd.org';
 const c=vm.createContext({console,Date,Map,Set,JSON,PERIODS:{CTSO:'ctso'},OWNER_EMAILS:['mpenalver@bethelsd.org'],LEADERSHIP_DATABASE:'leaders',email_:v=>String(v||'').trim().toLowerCase(),memberEmail_:v=>v,rows_:()=>roster,hash_:hash,nestAccessValues_:()=>({values:roles}),authSession_:()=>({email:identity}),PropertiesService:{getScriptProperties:()=>store},Utilities:{getUuid:()=> '12345678-1234-1234-1234-123456789abc'},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:m=>sent.push(m)},Sheets:{Spreadsheets:{get:()=>({sheets:[]}),batchUpdate:(body,id)=>writes.push({body,id,schema:true}),Values:{get:(id,range)=>({values:values.get(id+'|'+range)||[]}),batchUpdate:(body,id)=>{writes.push({body,id});for(const d of body.data){
 if(d.range.startsWith("'Website Member Status'!A1:E"))values.set("ctso|'Website Member Status'!A2:E1000",d.values.slice(1));
 if(d.range.startsWith("'Website Member Status'!H1:L"))values.set("ctso|'Website Member Status'!H2:L1000",d.values.slice(1));
 if(d.range==="'Website Member Status'!M1")values.set("ctso|'Website Member Status'!M1",d.values);
}}}}}});
 vm.runInContext(fs.readFileSync('google-spinner/Robotics.js','utf8'),c);vm.runInContext(fs.readFileSync('google-spinner/Tracker.js','utf8'),c);
 return {c,values,writes,sent,roster,store,setRoles:v=>roles=v,setIdentity:v=>identity=v};
}
test('only owner and current CTSO CEO/CFO/COO can manage Robotics or edit CTSO assignments',()=>{
 const h=school();for(const role of ['Chief Executive Officer','Chief Financial Officer','Chief Operations Officer','Chief Operations Officers']){
 h.setRoles([['CTSO','',role,'Ada','100001@students.bethelsd.org']]);assert.equal(h.c.roboticsAccess_('100001@students.bethelsd.org'),true);assert.equal(h.c.trackerRole_('100001@students.bethelsd.org','CTSO'),'manager');}
 for(const role of ['Executive Vice-President','Partner Liaison','Division Manager']){h.setRoles([['CTSO','',role,'Ada','100001@students.bethelsd.org']]);assert.equal(h.c.roboticsAccess_('100001@students.bethelsd.org'),false);assert.equal(h.c.trackerRole_('100001@students.bethelsd.org','CTSO'),'student');}
 h.setRoles([['2','','Chief Financial Officer','Ada','100001@students.bethelsd.org']]);assert.equal(h.c.roboticsAccess_('100001@students.bethelsd.org'),false);
 h.setRoles([['CTSO','','Chief Financial Officer','Ada','100001@students.bethelsd.org']]);h.roster.splice(0,1);assert.equal(h.c.roboticsAccess_('100001@students.bethelsd.org'),false);assert.equal(h.c.roboticsAccess_('mpenalver@bethelsd.org'),true);
 assert.equal(h.c.grantEditor_({period:'CTSO'},{email:'mpenalver@bethelsd.org'},h.store,Date.now()).status,403);
});
test('canonical roster emails exclude identity mismatches; revisions reject conflicts; membership writes target website storage only',()=>{
 const h=school(),state=h.c.roboticsState_();assert.equal(state.members[0].email,'100001@students.bethelsd.org');assert.equal(state.members[0].identityVerified,true);
 h.roster[0][1]='100002@students.bethelsd.org';const changed=h.c.roboticsState_();assert.notEqual(changed.revision,state.revision);assert.equal(changed.members[0].identityVerified,false);assert.equal(h.c.roboticsRecipients_(changed,'join',{}).length,1);
 h.setIdentity('mpenalver@bethelsd.org');assert.equal(h.c.roboticsDispatch_({operation:'status',revision:state.revision,member:state.members[0].id,active:false}).status,409);assert.equal(h.writes.length,0);
 assert.equal(h.c.roboticsDispatch_({operation:'status',revision:changed.revision,member:changed.members[0].id,active:false}).status,200);
 assert.equal(h.writes.length,1);assert.equal(h.writes[0].id,'ctso');assert.equal(h.writes[0].body.data[0].range,"'Website Member Status'!A2:B2");assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0].body.data[0].values)),[[false,true]]);

});
test('website storage seeds once and ignores later legacy and Program of Work changes',()=>{
 const h=school();h.store.deleteProperty('robotics-website-storage-v1:ctso');
 h.values.set("ctso|'NEST™MembershipStatus'!A3:E1000",[[false,true,'Sample, Ada',100001]]);
 h.values.set("ctso|'FRC Roster Raw'!A2:E1000",[]);
 const initial=h.c.roboticsState_();assert.equal(initial.members[0].active,false);assert.equal(h.writes.length,2);
 h.values.set("ctso|'NEST™MembershipStatus'!A3:E1000",[[true,false,'Sample, Ada',100001]]);
 h.values.set("1Mzxf0q87UHCQ5R6L0IBl2uCO_TmH-TmdcRSDIxOmBgw|'MembershipForm'!A2:E1000",[[true,false,'Sample, Ada',100001]]);
 const next=h.c.roboticsState_();assert.equal(next.members[0].active,false);assert.equal(h.writes.length,2);
 h.setIdentity('mpenalver@bethelsd.org');assert.equal(h.c.roboticsDispatch_({operation:'refresh',revision:next.revision}).status,200);assert.equal(h.writes.length,2);
});
test('duplicate membership rows stay visible but cannot be edited or notified',()=>{
 const h=school(),rows=h.values.get("ctso|'Website Member Status'!A2:E1000");rows.push([...rows[0]]);
 const state=h.c.roboticsState_(),view=h.c.roboticsView_(state);
 assert.equal(view.status,200);assert.equal(view.members.length,3);assert.equal(new Set(view.members.map(m=>m.id)).size,3);
 const duplicates=view.members.filter(m=>m.name==='Sample, Ada');
 assert.equal(duplicates.length,2);duplicates.forEach(m=>{assert.equal(m.canChangeStatus,false);assert.equal(m.identityVerified,false);assert.match(m.warning,/Duplicate membership/);});
 assert.equal(view.members.find(m=>m.name==='Example, Pat').canChangeStatus,true);
 assert.equal(h.c.roboticsRecipients_(state,'join',{}).some(m=>m.name==='Sample, Ada'),false);
 h.setIdentity('mpenalver@bethelsd.org');
 assert.equal(h.c.roboticsDispatch_({operation:'status',revision:state.revision,member:duplicates[0].id,active:false}).status,400);assert.equal(h.writes.length,0);
});
test('FIRST import excludes pending and declined; unknown consent is never signed or notified as missing',()=>{
 const h=school(),text='Youth Members\nPending Invitations\nFull Legal Name\nPending Student\nAccepted\nFull Legal Name\nAda Sample\nEmail Address\n100001@students.bethelsd.org\nConsent & Release is on record\nFull Legal Name\nPat Example\nEmail Address\n123@students.bethelsd.org\nDeclined\nFull Legal Name\nDeclined Student\nTeam Leadership';
 const parsed=h.c.TripOMeter_parseAcceptedYouth_(h.c.TripOMeter_prepareRosterLines_(text));assert.equal(parsed.length,2);assert.equal(parsed[0].consentSigned,true);assert.equal(parsed[1].foundConsent,false);
 h.c.roboticsImport_({text},h.c.roboticsState_());assert.equal(h.writes[0].body.data[0].values[2][1],'UNKNOWN');
 h.values.set("ctso|'Website Member Status'!H2:L1000",[['Pat Example','UNKNOWN','✅','Example, Pat','123@students.bethelsd.org']]);const fresh=h.c.roboticsState_();assert.equal(fresh.members[1].waiver,null);assert.equal(h.c.roboticsRecipients_(fresh,'waiver',{}).length,0);
 assert.throws(()=>h.c.TripOMeter_parseAcceptedYouth_(['Youth Members','Pending Invitations','Full Legal Name','Pat Example']));
});
test('notification preview binds actor and revision, skips inactive members, and retries do not resend',()=>{
 const h=school(),state=h.c.roboticsState_(),session={email:'mpenalver@bethelsd.org'};state.members[1].active=false;
 const preview=h.c.roboticsNotify_({operation:'preview',kind:'join'},state,session,h.store);assert.equal(preview.recipients.length,1);assert.equal(h.sent.length,0);
 assert.equal(h.c.roboticsNotify_({operation:'send',ticket:preview.ticket},state,{email:'other@bethelsd.org'},h.store).status,409);
 assert.equal(h.c.roboticsNotify_({operation:'send',ticket:preview.ticket},state,session,h.store).sent,1);assert.equal(h.sent.length,1);
 assert.equal(h.c.roboticsNotify_({operation:'send',ticket:preview.ticket},state,session,h.store).sent,1);assert.equal(h.sent.length,1);
});
test('Robotics tab is CTSO-only and hides on executive revocation',()=>{
 const access={manager:{},leaders:[],canManage:false,canManageRobotics:true},dom=new JSDOM(renderDivisionPage('CTSO',access),{runScripts:'outside-only',url:'https://gknest.org/divisions/CTSO#robotics'}),w=dom.window;
 w.eval(fs.readFileSync('js/division-hq.js','utf8'));w.NestDivisionHQ.setAccess(true,false,true);assert.equal(w.NestDivisionHQ.active,'robotics');assert.equal(w.document.querySelector('#hq-tab-robotics').hidden,false);assert.equal(w.document.querySelector('#hq-tab-robotics').textContent,'Member Status');assert.equal(w.document.querySelector('[data-robotics-refresh]'),null);
 w.NestDivisionHQ.setAccess(true,false,false);assert.equal(w.document.querySelector('#hq-tab-robotics').hidden,true);assert.equal(w.NestDivisionHQ.active,'tripometer');assert.doesNotMatch(renderDivisionPage('2',access),/hq-tab-robotics/);
});
test('API rejects absent sessions, foreign origins and invalid operations',async()=>{
 async function run(req){let code;await handler({headers:{},...req},{setHeader(){},status(n){code=n;return this;},json(){}});return code;}
 assert.equal(await run({method:'GET'}),401);assert.equal(await run({method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:{operation:'send'}}),403);assert.equal(await run({method:'POST',headers:{origin:'https://gknest.org','content-type':'application/json'},body:{operation:'delete-all'}}),400);
});
test('Robotics UI previews recipients, sends only after confirmation, and clears personal data on sign-out',async()=>{
 const dom=new JSDOM(renderDivisionPage('CTSO',{manager:{},leaders:[],canManageRobotics:true}),{runScripts:'outside-only',url:'https://gknest.org/divisions/CTSO#robotics'}),w=dom.window,calls=[];
 w.NestDivisionHQ={allowed:true,active:'robotics'};w.AbortSignal=AbortSignal;w.confirm=()=>true;
 const result={revision:'a'.repeat(64),members:[{id:'b'.repeat(64),name:'Example, Pat',studentId:'123',active:true,joined:false,waiver:null,canChangeStatus:true}],summary:{active:1,joined:0,waivers:0,needJoin:1,needWaiver:0},unmatched:[],importedAt:null};
 w.fetch=async(url,options)=>{const body=options.body?JSON.parse(options.body):{operation:'view'};calls.push(body);return {ok:true,json:async()=>body.operation==='preview'?{ticket:'preview-ticket',recipients:[{name:'Example, Pat',email:'123@students.bethelsd.org',kind:'join'}],skipped:[],messages:[{subject:'Join',body:'Request Team 2927'}]}:body.operation==='send'?{sent:1,failed:0,delivery:'sent'}:result};};
 w.eval(fs.readFileSync('js/robotics.js','utf8'));await new Promise(r=>setTimeout(r,0));
 const q=s=>w.document.querySelector(s);assert.match(q('[data-robotics-members]').textContent,/Example, Pat/);assert.equal(q('[data-robotics-send]').hidden,true);
 q('[data-robotics-preview]').click();await new Promise(r=>setTimeout(r,0));assert.match(q('[data-robotics-preview-content]').textContent,/123@students.bethelsd.org/);assert.equal(calls.some(c=>c.operation==='send'),false);
 q('[data-robotics-send]').click();await new Promise(r=>setTimeout(r,0));assert.equal(calls.at(-1).ticket,'preview-ticket');assert.match(q('[data-robotics-status]').textContent,/1 sent/);
 w.document.dispatchEvent(new w.Event('nest-hq-access-revoked'));assert.equal(q('[data-robotics-content]').hidden,true);assert.equal(q('[data-robotics-members]').textContent,'');assert.equal(q('[data-robotics-preview-content]').textContent,'');
});
