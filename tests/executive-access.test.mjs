import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {renderDivisionPage} from '../api/division-page.mjs';
import {JSDOM} from 'jsdom';
const source=['Code.js','DivisionSlides.js'].map(name=>fs.readFileSync('google-spinner/'+name,'utf8')).join('\n');
const periods=['1','2','3','4','5','7','CTSO'];
function setup(role,label='Period CTSO'){
 const leaders=[[label,'',role,'Executive','executive@students.bethelsd.org']];
 const ctx=vm.createContext({console,Sheets:{Spreadsheets:{get:()=>({sheets:[]}),Values:{get:()=>({values:leaders})}}},PropertiesService:{getScriptProperties:()=>({})}});
 vm.runInContext(source,ctx);
 ctx.rows_=p=>p==='CTSO'?[['Executive','executive@students.bethelsd.org']]:[['Member','member@students.bethelsd.org']];
 ctx.roboticsAccess_=identity=>ctx.nestExecutive_(identity);
 ctx.authSession_=()=>({email:'executive@students.bethelsd.org',username:'executive',expires:Date.now()+60000});
 return {ctx,leaders};
}
test('CEO CFO and COO receive hiring and HQ management in every division with both CTSO labels',()=>{
 for(const role of ['Chief Executive Officer','Chief Financial Officer','Chief Operations Officer','Chief Operations Officers'])for(const label of ['CTSO','Period CTSO']){
  const {ctx}=setup(role,label);
  for(const period of periods){
   const hiring=ctx.hiringPermissions_('executive@students.bethelsd.org',period);
   assert.equal(hiring.canReview,true,role+' '+period);assert.equal(hiring.canManage,true,role+' '+period);
   assert.equal(ctx.manager_('executive@students.bethelsd.org',period),true);
   const access=ctx.divisionSlidesDispatch_({period,operation:'access'});
   assert.equal(access.status,200);assert.equal(access.canManage,true);
   if(period!=='CTSO')assert.equal(ctx.trackerRole_('executive@students.bethelsd.org',period),'manager');
   const dom=new JSDOM(renderDivisionPage(period,{...access,manager:{},leaders:[]}));
   assert.equal(dom.window.document.querySelector('[data-hq-tab="hiring"]').hidden,false);
   assert.ok(dom.window.document.querySelector('#hq-panel-hiring'));dom.window.close();
  }
 }
});
test('leadership removal, roster removal, stale email and ordinary roles revoke executive management',()=>{
 for(const change of ['leadership','roster','email','role']){
  const {ctx,leaders}=setup('Chief Executive Officer');
  if(change==='leadership')leaders.length=0;
  if(change==='roster')ctx.rows_=()=>[];
  if(change==='email')leaders[0][4]='other@students.bethelsd.org';
  if(change==='role')leaders[0][2]='Partner Liaison';
  for(const period of ['1','2','3','4','5','7']){
   assert.equal(ctx.hiringPermissions_('executive@students.bethelsd.org',period).canManage,false,change);
   assert.equal(ctx.manager_('executive@students.bethelsd.org',period),false,change);
   assert.equal(ctx.divisionSlidesDispatch_({period,operation:'access'}).status,403,change);
  }
 }
});
test('manual executive access follows a live CTSO-linked identity',()=>{
 const {ctx}=setup('Chief Financial Officer');
 ctx.accountByEmail_=()=>({active:true,linkedEmail:'executive@students.bethelsd.org',periods:['CTSO']});
 assert.equal(ctx.hiringPermissions_('manual:executive','2').canManage,true);
 ctx.accountByEmail_=()=>({active:false,linkedEmail:'executive@students.bethelsd.org',periods:['CTSO']});
 assert.equal(ctx.hiringPermissions_('manual:executive','2').canManage,false);
});
test('the slide queue authorizes current executives across divisions and denies stale assignments',()=>{
 for(const role of ['Chief Executive Officer','Chief Financial Officer','Chief Operations Officers']){
  const leaders=[['Period CTSO','',role,'Executive','executive@students.bethelsd.org']];
  const ctx=vm.createContext({SpreadsheetApp:{openById:()=>({getSheetByName:()=>({getLastRow:()=>2,getRange:()=>({getValues:()=>leaders})})})}});
  vm.runInContext(['DivisionSlideAccess.js','NestDivisionWeb.js'].map(name=>fs.readFileSync('google-control-center/'+name,'utf8')).join('\n'),ctx);
  ctx.nestStaffDelegates_=()=>[];ctx.nestSlideRoster_=p=>new Set(p==='CTSO'?['executive@students.bethelsd.org']:['member@students.bethelsd.org']);
  for(const period of periods)assert.equal(ctx.nestWebAllowed_('executive@students.bethelsd.org',period),true);
  ctx.nestSlideRoster_=()=>new Set();
  for(const period of periods)assert.equal(ctx.nestWebAllowed_('executive@students.bethelsd.org',period),false);
 }
});
test('the permanent worker queues every division once when the executive policy changes',()=>{
 const properties=new Map(),store={getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)};
 const ctx=vm.createContext({Utilities:{getUuid:()=> 'revision'}});
 vm.runInContext(fs.readFileSync('google-control-center/NestDivisionWeb.js','utf8'),ctx);
 ctx.nestQueueExecutiveSlideAccess_(store);
 assert.deepEqual([...properties.keys()].filter(k=>k.startsWith('nest-hiring-access:')),periods.map(p=>'nest-hiring-access:'+p));
 properties.delete('nest-hiring-access:1');ctx.nestQueueExecutiveSlideAccess_(store);
 assert.equal(properties.has('nest-hiring-access:1'),false);
});
test('manual executive slide jobs forward the verified CTSO email across divisions',()=>{
 const {ctx}=setup('Chief Executive Officer');let submitted;
 ctx.accountByEmail_=()=>({active:true,linkedEmail:'executive@students.bethelsd.org',periods:['CTSO']});
 ctx.authSession_=()=>({email:'manual:executive'});
 ctx.UrlFetchApp={fetch:(_url,options)=>{submitted=JSON.parse(options.payload);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({status:200,state:'queued'})};}};
 assert.equal(ctx.divisionSlidesDispatch_({period:'2',operation:'start',job:'12345678-1234-1234-1234-123456789abc',token:'test'}).status,200);
 assert.equal(submitted.email,'executive@students.bethelsd.org');
});
