import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('../google-spinner/Code.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../google-spinner/Tracker.js',import.meta.url),'utf8');
function service(){
  let now=1000000000,leaders=[],admins=[{hyperlink:'mailto:ADMIN@example.org'}],manager=false,saves=0;
  const state=new Map(),sent=[],rows=[['Student A','ID','student@example.org']];
  const store={getProperty:k=>state.get(k)||null,setProperty:(k,v)=>state.set(k,v),deleteProperty:k=>state.delete(k),getProperties:()=>Object.fromEntries(state)};
  const ctx=vm.createContext({Date:class extends Date{static now(){return now;}},console,Utilities:{getUuid:()=>String(now),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>[...createHash('sha256').update(s).digest()]},PropertiesService:{getScriptProperties:()=>store},Sheets:{Spreadsheets:{get:()=>({sheets:[{data:[{rowData:[{values:admins}]}]}]}),Values:{get:(id)=>({values:id==='1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I'?leaders:rows})}}},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:m=>sent.push(m)}});
  vm.runInContext(source,ctx);
  ctx.authSession_=(raw,store,at)=>{const value=state.get('authsession:'+ctx.hash_(raw));return value&&JSON.parse(value).expires>at?JSON.parse(value):null;};
  let data={schema:1,period:'1',revision:1,assignments:[{id:'a',title:'Safety'}],scores:{},completionScores:null,updatedAt:now};
  ctx.trackerRead_=period=>({...JSON.parse(JSON.stringify(data)),period});
  ctx.trackerSave_=updated=>{data=JSON.parse(JSON.stringify(updated));saves++;};
  return {ctx,sent,state,call:r=>JSON.parse(JSON.stringify(ctx.dispatch_(r))),setAdmins:a=>admins=a,setLeaders:a=>leaders=a,advance:n=>now+=n,get saves(){return saves;},get data(){return data;}};
}
const base={period:'1',email:'student@example.org',code:'012345',challenge:'a'.repeat(64),ip:'b'.repeat(64),session:'c'.repeat(64)};
function signIn(s,email=base.email){s.state.set('authsession:'+s.ctx.hash_(base.session),JSON.stringify({email,expires:1000000000+21600000}));return {status:200};}
test('one owner or administrator session opens other periods; student sessions remain period-bound',()=>{
  for(const email of ['astramario@gmail.com','mpenalver@bethelsd.org','mario@memberhq.net','admin@example.org']){
    const s=service();assert.equal(signIn(s,email).status,200);
    assert.equal(s.call({...base,period:'2',action:'tracker'}).status,200);
    assert.equal(s.call({...base,period:'2',action:'roster'}).status,200);
    s.advance(21600000);assert.equal(s.call({...base,period:'2',action:'tracker'}).status,401);
  }
  const s=service();signIn(s);s.ctx.rows_=period=>period==='1'?[['Student A','student@example.org']]:[];assert.equal(s.call({...base,period:'2',action:'tracker'}).status,403);
  assert.equal(s.call({...base,action:'tracker'}).status,200);
  assert.equal(s.call({...base,action:'export'}).status,403);
});
test('administrator emails are read from live rich links and removal revokes later access',()=>{
  const s=service();s.setAdmins([{textFormatRuns:[{format:{link:{uri:'mailto:ADMIN@example.org'}}}]}]);signIn(s,'admin@example.org');
  assert.equal(s.call({...base,period:'2',action:'tracker'}).status,200);s.setAdmins([]);
  assert.equal(s.call({...base,period:'2',action:'tracker'}).status,403);
  assert.equal(s.call({...base,action:'tracker'}).status,403);
});
test('student cannot write or claim administrator permission in request payload',()=>{
  const s=service();signIn(s);
  assert.equal(s.call({...base,action:'tracker-update',role:'administrator',revision:1,change:{type:'assignment',title:'Malicious'}}).status,403);
  assert.equal(s.saves,0);
});
test('administrator updates validate score, student and revision; stale edits cannot overwrite',()=>{
  const s=service();signIn(s,'astramario@gmail.com');const id=s.ctx.hash_('student@example.org');
  const update={...base,action:'tracker-update',revision:1,change:{type:'score',student:id,assignment:'a',score:'4'}};
  assert.equal(s.call({...update,change:{...update.change,score:'5'}}).status,400);
  assert.equal(s.call({...update,change:{...update.change,student:'unknown'}}).status,400);
  const saved=s.call(update);assert.equal(saved.status,200);assert.equal(saved.scores[id].a,'4');assert.equal(saved.revision,2);
  assert.equal(s.call(update).status,409);assert.equal(s.saves,1);
  assert.equal(s.call({...base,action:'export'}).status,200);
});
test('global logout revokes access across tools and periods',()=>{
  const s=service();signIn(s,'astramario@gmail.com');s.state.delete('authsession:'+s.ctx.hash_(base.session));
  assert.equal(s.call({...base,action:'roster'}).status,401);assert.equal(s.call({...base,action:'tracker',period:'2'}).status,401);
});
test('tracker output exposes only roster names and emails, never student IDs or absent students',()=>{
  const s=service();signIn(s);const result=s.call({...base,action:'tracker'});assert.equal(result.students[0].email,'student@example.org');
  assert.ok(!JSON.stringify(result).includes('"ID"'));assert.deepEqual(Object.keys(result.scores),[result.students[0].id]);
});
test('tracker includes each roster student’s leadership role from their email and period',()=>{
  const s=service();signIn(s,'astramario@gmail.com');s.setLeaders([
    ['Period 1','','Division Manager','Student A','student@example.org'],
    ['Period 1','','Safety Lead','Student A','STUDENT@example.org'],
    ['Period 2','','Other Role','Student A','student@example.org'],
    ['Period 1','','Unrelated Role','Student B','other@example.org']
  ]);
  const student=s.call({...base,action:'tracker'}).students[0];
  assert.equal(student.leadershipRole,'Division Manager · Safety Lead');
});
test('managers, assistants and temporary editors can grant district-only, period-bound editing',()=>{
  for(const position of ['Division Manager','Assistant Manager']){
    const s=service();s.setLeaders([['Period 1','',position,'Manager, Test','manager@example.org']]);signIn(s,'manager@example.org');
    const update=change=>s.call({...base,action:'tracker-update',revision:1,change});
    assert.equal(update({type:'grant',email:'outside@example.org'}).status,400);
    const grant=update({type:'grant',email:'helper@students.bethelsd.org'});assert.equal(grant.status,200);assert.equal(grant.grants.length,1);
    assert.equal(s.call({...base,period:'2',action:'tracker-update',revision:1,change:{type:'grant',email:'other@bethelsd.org'}}).status,403);
    signIn(s,'helper@students.bethelsd.org');
    assert.equal(s.call({...base,action:'tracker'}).role,'editor');
    assert.equal(s.call({...base,action:'tracker-update',revision:1,change:{type:'assignment',title:'New assignment'}}).status,200);
    const delegated=s.call({...base,action:'tracker-update',revision:2,change:{type:'grant',email:'third@bethelsd.org'}});
    assert.equal(delegated.status,200);assert.deepEqual(delegated.grants.map(g=>g.email),['third@bethelsd.org']);
    signIn(s,'third@bethelsd.org');assert.equal(s.call({...base,action:'tracker'}).role,'editor');
    assert.equal(s.call({...base,action:'tracker-update',revision:2,change:{type:'grant',email:'manager@example.org'}}).status,400);
    assert.equal(s.call({...base,period:'2',action:'tracker'}).status,403);
    s.advance(21600000);assert.equal(s.call({...base,action:'tracker'}).status,401);
  }
});
test('removing manager authority revokes their active delegated editors',()=>{
  const s=service();s.setLeaders([['1','','Division Manager','Manager, Test','manager@example.org']]);signIn(s,'manager@example.org');
  s.call({...base,action:'tracker-update',revision:1,change:{type:'grant',email:'helper@students.bethelsd.org'}});signIn(s,'helper@students.bethelsd.org');
  assert.equal(s.call({...base,action:'tracker'}).role,'editor');
  s.call({...base,action:'tracker-update',revision:1,change:{type:'grant',email:'third@bethelsd.org'}});
  signIn(s,'third@bethelsd.org');assert.equal(s.call({...base,action:'tracker'}).role,'editor');
  s.setLeaders([]);assert.equal(s.call({...base,action:'tracker'}).status,403);
});
test('a temporary editor may remove only grants they issued and revoking them ends downstream access',()=>{
  const s=service();s.setLeaders([['1','','Division Manager','Manager, Test','manager@example.org']]);signIn(s,'manager@example.org');
  const update=change=>s.call({...base,action:'tracker-update',revision:1,change});
  update({type:'grant',email:'helper@students.bethelsd.org'});
  update({type:'grant',email:'peer@bethelsd.org'});
  signIn(s,'helper@students.bethelsd.org');
  assert.equal(update({type:'revoke',email:'peer@bethelsd.org'}).status,403);
  assert.equal(update({type:'grant',email:'third@bethelsd.org'}).status,200);
  signIn(s,'manager@example.org');assert.equal(update({type:'revoke',email:'helper@students.bethelsd.org'}).status,200);
  signIn(s,'third@bethelsd.org');assert.equal(s.call({...base,action:'tracker'}).status,403);
});
test('only score 4 is reported as completed; lower scores and legacy Yes remain distinct',()=>{
  const s=service();signIn(s);assert.deepEqual(s.call({...base,action:'tracker'}).completionScores,['4']);
});

test('score batches validate every edit before writing and advance one revision',()=>{
 const s=service();signIn(s,'astramario@gmail.com');const student=s.ctx.hash_('student@example.org');
 const update={...base,action:'tracker-update',revision:1,change:{type:'scores',edits:[{student,assignment:'a',score:'4'},{student,assignment:'invalid',score:'3'}]}};
 assert.equal(s.call(update).status,400);assert.equal(s.saves,0);
 update.change.edits[1].assignment='a';const result=s.call(update);assert.equal(result.status,200);assert.equal(result.revision,2);assert.equal(result.scores[student].a,'3');assert.equal(s.saves,1);
 assert.equal(s.call(update).status,409);
});

test('editors can resize, reorder, rename and delete columns with their scores',()=>{
 const s=service();signIn(s,'astramario@gmail.com');const student=s.ctx.hash_('student@example.org');
 const change=(revision,value)=>s.call({...base,action:'tracker-update',revision,change:value});
 assert.equal(change(1,{type:'resize',assignment:'a',width:119}).status,400);
 assert.equal(change(1,{type:'resize',assignment:'a',width:280}).assignments[0].width,280);
 assert.equal(change(2,{type:'assignment',title:'Project'}).assignments.length,2);
 assert.equal(change(3,{type:'reorder',order:['a','a']}).status,400);
 assert.deepEqual(change(3,{type:'reorder',order:[String(1000000000),'a']}).assignments.map(a=>a.title),['Project','Safety']);
 assert.equal(change(4,{type:'rename',assignment:'a',title:'Updated Safety'}).assignments[1].title,'Updated Safety');
 for(const score of ['A','NE','Yes','No'])assert.equal(change(s.data.revision,{type:'score',student,assignment:'a',score}).scores[student].a,score);
 const deleted=change(s.data.revision,{type:'delete',assignment:'a'});assert.equal(deleted.status,200);
 assert.equal(deleted.assignments.length,1);assert.equal(s.data.scores[student].a,undefined);
 assert.equal(change(s.data.revision,{type:'delete',assignment:'a'}).status,400);
});
