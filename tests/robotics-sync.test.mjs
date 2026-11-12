import {staffContext} from './helpers/staff-context.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function setup({fail=false}={}){
 const props=new Map(),writes=[],forms=new Map(),triggers=[];
 const store={getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)};
 for(const [id,choices] of [[1844423709,['Class, Student (Period 1)','Old, Member (CTSO)','Visitor (Guest)']],[704486396,['CURRENT ATTENDEES: Last Meeting','Class, Student_(Period 1)','Old, Member_(CTSO)']],[30664606,['Class, Student_(Period 1)','Old, Member_(CTSO)']]])forms.set(id,{choices,getChoices(){return this.choices.map(value=>({getValue:()=>value}));},setChoiceValues(values){if(fail)throw Error('unavailable');this.choices=values;}});
 const rows=[[true,false,'Old, Member','historical timestamp','private email'],[true,false,'Active, Ada','timestamp','private email'],[true,false,'Active, Ada','duplicate timestamp','private email']];
 const c=staffContext({roboticsSyncDatabase_:s=>s.members.filter(m=>m.active&&!m.inactive).length,console:{error(){}},Date,Map,Set,JSON,PropertiesService:{getScriptProperties:()=>store},roboticsValues_:()=>rows,roboticsWrite_:(id,data)=>writes.push({id,data}),Sheets:{Spreadsheets:{get:()=>({sheets:[{properties:{title:'MembershipForm',sheetId:1,gridProperties:{rowCount:4}}}]}),batchUpdate:(body,id)=>writes.push({id,schema:body})}},FormApp:{ItemType:{LIST:'LIST',CHECKBOX:'CHECKBOX'},openById:()=>({getItemById:id=>({getType:()=>id===1844423709?'LIST':'CHECKBOX',asListItem:()=>forms.get(id),asCheckboxItem:()=>forms.get(id)})})},ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:handler=>({timeBased:()=>({everyHours:()=>({create:()=>triggers.push({getHandlerFunction:()=>handler})})})})}});
 vm.runInContext(fs.readFileSync('robotics-script/WebsiteMembership.js','utf8')+'\n'+fs.readFileSync('google-spinner/RoboticsSync.js','utf8'),c);
 return {c,rows,writes,forms,triggers};
}
const state={members:[{name:'Active, Ada',active:true,inactive:false},{name:'New, Bea',active:true,inactive:false},{name:'Old, Member',active:false,inactive:true}]};
test('one-way sync mirrors status, appends names without overwriting private answers and replaces only CTSO choices',()=>{
 const h=setup();assert.equal(h.c.roboticsSyncMembership_(state).status,'synced');
 assert.equal(h.writes[0].schema.requests[0].appendDimension.length,1);assert.equal(h.writes[1].data.length,3);assert.deepEqual(JSON.parse(JSON.stringify(h.writes[1].data.map(d=>[d.range,d.values]))),[["'MembershipForm'!A2:B2",[[false,true]]],["'MembershipForm'!A4:B4",[[false,true]]],["'MembershipForm'!A5:C5",[[true,false,'New, Bea']]]]);
 assert.equal(h.rows[1][3],'timestamp');assert.equal(h.rows[1][4],'private email');assert.equal(h.writes.some(w=>w.id==='ctso'),false);
 assert.deepEqual(Array.from(h.forms.get(1844423709).choices),['Class, Student (Period 1)','Visitor (Guest)','Active, Ada (CTSO)','New, Bea (CTSO)']);
 assert.equal(h.forms.get(30664606).choices.filter(c=>c.endsWith('(CTSO)')).length,2);
 assert.deepEqual(Array.from(h.forms.get(704486396).choices),['CURRENT ATTENDEES: Last Meeting','Class, Student_(Period 1)','Active, Ada_(CTSO)','New, Bea_(CTSO)']);
 h.c.roboticsSyncMembership_(state);assert.equal(h.triggers.length,1);assert.equal(h.c.roboticsSyncStatus_().active,2);
});
test('external failure leaves saved membership intact and reports pending; ambiguous names prevent projection',()=>{
 const h=setup({fail:true});assert.equal(h.c.roboticsSyncMembership_(state).status,'pending');assert.equal(h.writes.some(w=>w.id==='ctso'),false);
 const other=setup();assert.equal(other.c.roboticsSyncMembership_({members:[...state.members,{name:'Ada Active',active:true}]}).status,'pending');assert.equal(other.writes.length,0);
});
test('empty active list removes only CTSO choices; uninitialized empty membership cannot clear forms',()=>{
 const h=setup();assert.equal(h.c.roboticsSyncMembership_({members:state.members.map(m=>({...m,active:false,inactive:true}))}).active,0);assert.equal(h.forms.get(1844423709).choices.length,2);
 const empty=setup();assert.equal(empty.c.roboticsSyncMembership_({members:[]}).status,'pending');assert.equal(empty.writes.length,0);
});
test('manager can retry sync with the loaded revision and see pending failures separately from membership saves',async()=>{
 const {JSDOM}=await import('jsdom'),{renderDivisionPage}=await import('../api/division-page.mjs');
 const dom=new JSDOM(renderDivisionPage('CTSO',{manager:{},leaders:[],canManageRobotics:true}),{runScripts:'outside-only',url:'https://gknest.org/divisions/CTSO#robotics'}),w=dom.window,calls=[];
 w.NestDivisionHQ={allowed:true,active:'robotics'};w.AbortSignal=AbortSignal;
 const result={revision:'a'.repeat(64),members:[],summary:{active:0,joined:0,waivers:0,needJoin:0,needWaiver:0},unmatched:[],sync:{status:'pending'}};
 w.fetch=async(url,options)=>{calls.push(options.body?JSON.parse(options.body):{operation:'view'});return {ok:true,json:async()=>result};};
 w.eval(fs.readFileSync('js/robotics.js','utf8'));await new Promise(r=>setTimeout(r,0));
 assert.match(w.document.querySelector('[data-robotics-sync]').textContent,/pending/);
 w.document.querySelector('[data-robotics-sync-now]').click();await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(calls.find(c=>c.operation==='sync'),{operation:'sync',revision:'a'.repeat(64)});assert.equal(calls.at(-1).operation,'sync');
 dom.window.close();
});

test('historical inactive duplicates do not block the active member list',()=>{
 const h=setup();assert.equal(h.c.roboticsSyncMembership_({members:[...state.members,{name:'Old, Member',active:false,inactive:true}]}).status,'synced');
});
