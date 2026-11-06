import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {initialWorkspace} from '../lib/bell-schedule-seed.mjs';
import {minutes,validDate,validateWorkspace,resolveSchedule,signalRows,schoolDate} from '../js/bell-schedule-model.mjs';
import {createBellWorkspaceHandler} from '../api/bell-workspace.mjs';
const session='a'.repeat(64),head='bell-workspace/v1/state.json';
function fixture({email='mpenalver@bethelsd.org',schoolStatus=200}={}){
 const map=new Map();let writes=0,reads=0,schoolReads=0;
 const storage={get:async path=>{reads++;const b=map.get(path);return b?{stream:new Blob([b.text]).stream(),blob:{etag:b.etag},statusCode:200}:null;},put:async(path,text,options)=>{writes++;const current=map.get(path);if(options.ifMatch&&current?.etag!==options.ifMatch||!options.ifMatch&&options.allowOverwrite!==true&&current)throw Object.assign(Error('Precondition failed'),{name:'BlobPreconditionFailedError'});const etag=randomUUID();map.set(path,{text,etag});return {etag};}};
 const school=async()=>{schoolReads++;return {status:schoolStatus,email};};const handler=createBellWorkspaceHandler({school,storage});
 async function call(body,{cookie=session,origin='https://gknest.org',method=body?'POST':'GET'}={}){const req={method,headers:{host:'gknest.org',origin,'content-type':'application/json',cookie:cookie?'__Host-nest-auth='+cookie:''},body};const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(data){this.data=data;return this;}};await handler(req,res);return res;}
 return {call,map,counts:()=>({writes,reads,schoolReads}),storage,handler};
}
test('imports 23 templates and resolves the two Veterans Day teacher paths without overlaps',()=>{
 const w=initialWorkspace();assert.equal(w.templates.length,23);assert.deepEqual(validateWorkspace(w),[]);
 const a=resolveSchedule(w,{date:'2026-11-06',teacherId:'penalver'}),b=resolveSchedule(w,{date:'2026-11-06',teacherId:'penalver',groupId:'assembly-b'});
 assert.equal(a.issues.filter(i=>i.level==='error').length,0);assert.equal(b.issues.filter(i=>i.level==='error').length,0);
 assert.equal(a.blocks.find(b=>b.kind==='assembly').start,'12:40');assert.equal(a.blocks.find(b=>b.period==='5'&&b.kind==='class').start,'13:15');assert.equal(b.blocks.find(b=>b.kind==='assembly').start,'13:45');
 assert.equal(a.blocks.find(b=>b.period==='3').start,'10:23');assert.equal(a.blocks.find(b=>b.period==='2').start,'08:49');
 assert.equal(b.blocks.find(b=>b.period==='5').end,'13:37');assert.ok(a.blocks.some(b=>b.kind==='passing'));
});
test('no-school, lunch variations, missing groups, date flags and Pacific date boundaries',()=>{
 const w=initialWorkspace();assert.equal(resolveSchedule(w,{date:'2026-11-11'}).blocks.length,0);
 assert.equal(resolveSchedule(w,{date:'2026-11-06'}).issues.filter(i=>i.level==='error').length,2);
 const r=resolveSchedule(w,{date:'2026-11-06',teacherId:'penalver',lunchId:'2'});assert.equal(r.blocks.filter(b=>b.period==='3').length,2);
 w.days[0].absent=true;w.days[0].flyDay=true;const flagged=resolveSchedule(w,{date:'2026-11-06',teacherId:'penalver'});assert.equal(flagged.blocks.find(b=>b.period==='4').flyDay,true);assert.deepEqual(signalRows(flagged).at(-1),['Absent','','','']);
 assert.equal(schoolDate(new Date('2026-11-07T02:00:00Z')),'2026-11-06');assert.equal(validDate('2026-99-99'),false);assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-11-06'),true);assert.ok(Number.isNaN(minutes('25:00')));
});
test('overlaps are detected and validation rejects broken references and times',()=>{
 const w=initialWorkspace();const t=w.templates.find(t=>t.id==='blue-bell-schedule');t.blocks.push({...t.blocks[2],id:'overlap'});assert.ok(resolveSchedule(w,{date:'2026-11-12',teacherId:'penalver'}).issues.some(i=>/overlaps/.test(i.message)));
 t.blocks[0].end='00:01';w.days[0].assignments[0].groupId='bad-group';assert.ok(validateWorkspace(w).some(s=>/start\/end/.test(s)));assert.ok(validateWorkspace(w).some(s=>/assignment/.test(s)));
});
test('anonymous, student and failed verification requests cannot read or write storage',async()=>{
 const anonymous=fixture();assert.equal((await anonymous.call(undefined,{cookie:''})).statusCode,401);assert.deepEqual(anonymous.counts(),{reads:0,writes:0,schoolReads:0});
 const student=fixture({email:'student@students.bethelsd.org'});assert.equal((await student.call()).statusCode,403);assert.equal(student.counts().reads,0);
 const expired=fixture({schoolStatus:401});assert.equal((await expired.call()).statusCode,401);assert.equal(expired.counts().writes,0);
 const f=fixture();assert.equal((await f.call({operation:'save'},{origin:'https://evil.test'})).statusCode,403);assert.equal(f.counts().schoolReads,0);
});
test('save, read, stale save protection and restore create persistent private revisions',async()=>{
 const f=fixture(),first=await f.call();assert.equal(first.data.revision,null);assert.equal(f.counts().writes,0);assert.equal(first.headers['Cache-Control'],'private, no-store');
 const w=first.data.workspace;w.templates[0].name='Draft revision one';const save=await f.call({operation:'save',workspace:w,expectedRevision:null});assert.equal(save.statusCode,200);assert.equal(save.data.liveConnected,false);const rev=save.data.revision;
 assert.equal((await f.call()).data.workspace.templates[0].name,'Draft revision one');
 assert.equal((await f.call({operation:'save',workspace:w,expectedRevision:null})).statusCode,409);
 w.templates[0].name='Draft revision two';const second=await f.call({operation:'save',workspace:w,expectedRevision:rev});assert.equal(second.statusCode,200);
 const restored=await f.call({operation:'restore',revision:rev,expectedRevision:second.data.revision});assert.equal(restored.statusCode,200);assert.equal(restored.data.workspace.templates[0].name,'Draft revision one');assert.equal(restored.data.history.length,3);
 const before=f.counts().writes;assert.equal((await f.call({operation:'restore',revision:'../../outside',expectedRevision:restored.data.revision})).statusCode,404);assert.equal(f.counts().writes,before);
});
test('simultaneous first writes and updates have exactly one winner',async()=>{
 const f=fixture(),w=initialWorkspace();const responses=await Promise.all([f.call({operation:'save',workspace:w,expectedRevision:null}),f.call({operation:'save',workspace:w,expectedRevision:null})]);assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
 const revision=(await f.call()).data.revision;const updates=await Promise.all([f.call({operation:'save',workspace:w,expectedRevision:revision}),f.call({operation:'save',workspace:w,expectedRevision:revision})]);assert.deepEqual(updates.map(r=>r.statusCode).sort(),[200,409]);
});
test('preview validates without saving; all writes are confined to the new draft namespace',async()=>{
 const f=fixture();const r=await f.call({operation:'preview',date:'2026-11-06',teacherId:'penalver'});assert.equal(r.statusCode,200);assert.equal(r.data.resolved.group.id,'assembly-a');assert.equal(f.counts().writes,0);
 const bad=initialWorkspace();bad.days[0].date='invalid';assert.equal((await f.call({operation:'save',workspace:bad,expectedRevision:null})).statusCode,400);assert.equal(f.counts().writes,0);
 const source=fs.readFileSync('api/bell-workspace.mjs','utf8');assert.doesNotMatch(source,/auth-safety|Calendar\.Events|SpreadsheetApp|SlidesApp/);
 const ui=fs.readFileSync('js/bell-workspace.mjs','utf8');assert.doesNotMatch(ui,/innerHTML/);assert.match(ui,/beforeunload/);
});
import {JSDOM} from 'jsdom';
import * as model from '../js/bell-schedule-model.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function uiFixture(f=fixture(),fetchOverride){
 const dom=new JSDOM(fs.readFileSync('bell-workspace.html','utf8'),{url:'https://gknest.org/bell-workspace',runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,model,{structuredClone,confirm:()=>true,AbortSignal,fetch:fetchOverride|| (async(_,o)=>{const r=await f.call(o?.body?JSON.parse(o.body):undefined);return {ok:r.statusCode===200,status:r.statusCode,json:async()=>r.data};})});
 w.eval(fs.readFileSync('js/bell-workspace.mjs','utf8').replace(/^import .*\n/,''));return {w,f,close:()=>w.close()};
}
test('browser editor saves initial import, edits a schedule, reloads it and previews Assembly B',async()=>{
 const ui=uiFixture();try{await settle();const d=ui.w.document;assert.equal(d.getElementById('bw-shell').hidden,false);assert.equal(d.getElementById('bw-save').disabled,false);
 d.getElementById('bw-save').click();await settle();await settle();assert.equal(d.getElementById('bw-save').textContent,'Draft saved');
 const name=[...d.querySelectorAll('label')].find(l=>l.firstChild.textContent==='Schedule name').querySelector('input');name.value='Veterans Day edited';name.dispatchEvent(new ui.w.Event('input'));d.getElementById('bw-save').click();await settle();await settle();d.getElementById('bw-reload').click();await settle();await settle();assert.equal(d.querySelector('#bw-panel h2').textContent,'Veterans Day edited');
 const group=d.getElementById('bw-preview-group');group.value='assembly-b';group.dispatchEvent(new ui.w.Event('change'));assert.match(d.getElementById('bw-preview-body').textContent,/1:45 PM – 2:15 PM/);
 d.getElementById('bw-tab-history').click();assert.equal(d.querySelectorAll('.bw-history').length,2);
 }finally{ui.close();}
});
test('late workspace responses cannot expose data after sign-out',async()=>{
 let deliver;const ui=uiFixture(fixture(),()=>new Promise(resolve=>deliver=resolve));try{ui.w.document.dispatchEvent(new ui.w.CustomEvent('nest-auth-change',{detail:null}));deliver({ok:true,json:async()=>({workspace:initialWorkspace(),revision:null,history:[]})});await settle();await settle();assert.equal(ui.w.document.getElementById('bw-shell').hidden,true);assert.equal(ui.w.document.querySelectorAll('.bw-template').length,0);}finally{ui.close();}
});
