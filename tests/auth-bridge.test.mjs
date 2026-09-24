import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const source = fs.readFileSync(new URL('../google-spinner/Code.js',import.meta.url),'utf8') + '\n' + fs.readFileSync(new URL('../google-spinner/Auth.js',import.meta.url),'utf8') + '\n' + fs.readFileSync(new URL('../google-spinner/Tracker.js',import.meta.url),'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
function service() {
  let now=1_000_000_000, accounts=[], sent=[],leaders=[],failAuditUpdate=false;
  const state=new Map(),store={getProperty:key=>state.get(key)||null,setProperty:(key,value)=>state.set(key,value),deleteProperty:key=>state.delete(key),getProperties:()=>Object.fromEntries(state)};
  const values={
    get(_id,range){
      if(range.includes('StudentNESTAccess'))return {values:accounts};
      if(range.includes("'Imported'"))return {values:leaders};
      if(range.includes("'Period 1'"))return {values:[['Student','','student@students.bethelsd.org']]};
      return {values:[]};
    },
    update(resource,_id,range){if(failAuditUpdate)throw new Error('Audit column unavailable');accounts[Number(range.match(/H(\d+)/)[1])-2][7]=resource.values[0][0];return {};}
  };
  const batchUpdate=({requests})=>{for(const request of requests){
    if(request.insertDimension)accounts.splice(request.insertDimension.range.startIndex-1,0,[]);
    if(request.updateCells)accounts[request.updateCells.range.startRowIndex-1]=request.updateCells.rows[0].values.map(cell=>Object.values(cell.userEnteredValue)[0]);
    if(request.sortRange)accounts.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  }return {};};
  const ctx=vm.createContext({Date:class extends Date{static now(){return now;}},console,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,input)=>[...createHash('sha256').update(input).digest()]},PropertiesService:{getScriptProperties:()=>store},Sheets:{Spreadsheets:{Values:values,get:(_id,options)=>options?.fields?.includes('properties(sheetId,title)')?{sheets:[{properties:{sheetId:57426151,title:'StudentNESTAccess'}}]}:{sheets:[]},batchUpdate}},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:message=>sent.push(message)}});
  vm.runInContext(source,ctx);
  return {call:request=>JSON.parse(JSON.stringify(ctx.authDispatch_(request))),tool:request=>JSON.parse(JSON.stringify(ctx.dispatch_(request))),state,sent,accounts,setLeaders:value=>leaders=value,setAuditFailure:value=>failAuditUpdate=value,advance:ms=>now+=ms};
}
const challenge='a'.repeat(64),ticket='b'.repeat(64),session='c'.repeat(64),ip='d'.repeat(64),email='student@students.bethelsd.org';
test('registration requires known district email, verified code, and unique username',()=>{
  const app=service();
  assert.equal(app.call({action:'auth-register-request',email:'outsider@other.org',challenge,code:'123456',ip}).status,400);
  assert.equal(app.call({action:'auth-register-request',email,challenge,code:'123456',ip}).status,200);
  assert.equal(app.sent.length,1);
  assert.equal(app.call({action:'auth-register-verify',challenge,code:'000000',ticket}).status,401);
  assert.equal(app.call({action:'auth-register-verify',challenge,code:'123456',ticket}).status,200);
  assert.equal(app.call({action:'auth-register',ticket,username:'student1',passwordHash:'e'.repeat(64),passwordSalt:'f'.repeat(32)}).status,200);
  assert.deepEqual(JSON.parse(JSON.stringify(app.accounts[0].slice(0,6))),['student1',email,'e'.repeat(64),'f'.repeat(32),true,1]);
  assert.equal(app.call({action:'auth-register',ticket,username:'student2',passwordHash:'e'.repeat(64),passwordSalt:'f'.repeat(32)}).status,401);
});
test('new accounts stay sorted below the header and session updates follow the moved row',()=>{
  const app=service();
  app.accounts.push(['zeta','other@bethelsd.org','e'.repeat(64),'f'.repeat(32),true,1,'','']);
  assert.equal(app.call({action:'auth-register-request',email,challenge,code:'123456',ip}).status,200);
  assert.equal(app.call({action:'auth-register-verify',challenge,code:'123456',ticket}).status,200);
  assert.equal(app.call({action:'auth-register',ticket,username:'alpha',passwordHash:'e'.repeat(64),passwordSalt:'f'.repeat(32)}).status,200);
  assert.deepEqual(app.accounts.map(row=>row[0]),['alpha','zeta']);
  assert.equal(app.call({action:'auth-session',email,session,duration:'1d'}).status,200);
  assert.ok(app.accounts[0][7]);
  assert.equal(app.accounts[1][7],'');
});
test('session is available across tools, expires, and logout revokes it',()=>{
  const app=service();
  app.accounts.push(['student1',email,'e'.repeat(64),'f'.repeat(32),true,1,'','']);
  assert.equal(app.call({action:'auth-session',email,session,duration:'1d'}).status,200);
  assert.equal(app.call({action:'auth-me',session}).status,200);
  assert.equal(app.tool({action:'roster',period:'1',session}).status,200);
  assert.equal(app.tool({action:'roster',period:'2',session}).status,403);
  assert.equal(app.call({action:'auth-logout',session}).status,200);
  assert.equal(app.call({action:'auth-me',session}).status,401);
  app.call({action:'auth-session',email,session,duration:'1d'});
  app.accounts[0][4]=false;
  assert.equal(app.call({action:'auth-me',session}).status,401);
  app.accounts[0][4]=true;
  app.call({action:'auth-session',email,session,duration:'1d'});
  app.accounts[0][5]=2;
  assert.equal(app.call({action:'auth-me',session}).status,401);
  app.accounts[0][5]=1;
  app.call({action:'auth-session',email,session,duration:'1d'});
  app.advance(86400000);
  assert.equal(app.call({action:'auth-me',session}).status,401);
});
test('an unavailable audit column does not prevent a valid account session',()=>{
  const app=service();
  app.accounts.push(['student1',email,'e'.repeat(64),'f'.repeat(32),true,1,'','']);
  app.setAuditFailure(true);
  assert.equal(app.call({action:'auth-session',email,session,duration:'1d'}).status,200);
  assert.equal(app.call({action:'auth-me',session}).status,200);
});
test('Tech Ticket backend check requires a current Software Technician and an active NEST session',()=>{
  const app=service();app.accounts.push(['student1',email,'e'.repeat(64),'f'.repeat(32),true,1,'','']);
  const check=()=>app.call({action:'auth-tech-ticket-access',session});
  assert.equal(check().status,401);
  app.call({action:'auth-session',email,session,duration:'1d'});
  assert.equal(check().status,403);
  app.setLeaders([['Period 4','','Software Technician','Student',email]]);
  assert.equal(check().status,200);
  app.setLeaders([['Period 4','','Safety Officer','Student',email]]);
  assert.equal(check().status,403);
});
test('existing email-code sessions remain usable during the website rollout',()=>{
  const app=service();
  assert.equal(app.tool({action:'request',period:'1',email,challenge,code:'123456',ip}).status,200);
  assert.equal(app.tool({action:'verify',period:'1',challenge,code:'123456',session}).status,200);
  assert.equal(app.tool({action:'roster',period:'1',session}).status,200);
  assert.equal(app.tool({action:'roster',period:'2',session}).status,401);
  assert.equal(app.tool({action:'logout',period:'1',session}).status,200);
  assert.equal(app.tool({action:'roster',period:'1',session}).status,401);
});
