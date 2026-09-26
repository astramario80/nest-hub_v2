import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const source = fs.readFileSync(new URL('../google-spinner/Code.js',import.meta.url),'utf8') + '\n' + fs.readFileSync(new URL('../google-spinner/Auth.js',import.meta.url),'utf8') + '\n' + fs.readFileSync(new URL('../google-spinner/Account.js',import.meta.url),'utf8') + '\n' + fs.readFileSync(new URL('../google-spinner/Tracker.js',import.meta.url),'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
function service() {
  let now=1_000_000_000, accounts=[], sent=[],leaders=[],failAuditUpdate=false,failSort=false,allowedHeader='',recoveryHeader='',linkedHeader='';
  const state=new Map(),store={getProperty:key=>state.get(key)||null,setProperty:(key,value)=>state.set(key,value),deleteProperty:key=>state.delete(key),getProperties:()=>Object.fromEntries(state)};
  const cacheState=new Map(),cache={get:key=>cacheState.get(key)?.expires>now?cacheState.get(key).value:null,put:(key,value,seconds)=>cacheState.set(key,{value,expires:now+seconds*1000}),remove:key=>cacheState.delete(key)};
  const lock={tryLock:()=>true,releaseLock:()=>{}};
  const values={
    get(_id,range){
      if(range.includes('StudentNESTAccess')&&range.includes('I1'))return {values:allowedHeader?[[allowedHeader,recoveryHeader,linkedHeader]]:[]};
      if(range.includes('StudentNESTAccess'))return {values:accounts};
      if(range.includes("'Imported'"))return {values:leaders};
      if(range.includes("'Period 1'"))return {values:[['Student','','student@students.bethelsd.org']]};
      return {values:[]};
    },
    update(resource,_id,range){if(range.includes('I1')){allowedHeader=resource.values[0][0];recoveryHeader=resource.values[0][1];linkedHeader=resource.values[0][2];return {};}if(failAuditUpdate)throw new Error('Audit column unavailable');accounts[Number(range.match(/H(\d+)/)[1])-2][7]=resource.values[0][0];return {};},
    batchUpdate(resource){for(const item of resource.data){const match=item.range.match(/!([A-I])(\d+)/),row=accounts[Number(match[2])-2],value=item.values[0];if(match[1]==='A')row[0]=value[0];if(match[1]==='C'){row[2]=value[0];row[3]=value[1];}if(match[1]==='E')row[4]=value[0];if(match[1]==='F')row[5]=value[0];}return {};},
    append(resource){accounts.push(resource.values[0]);return {};}
  };
  const batchUpdate=({requests})=>{for(const request of requests){
    if(request.insertDimension)accounts.splice(request.insertDimension.range.startIndex-1,0,[]);
    if(request.updateCells)accounts[request.updateCells.range.startRowIndex-1]=request.updateCells.rows[0].values.map(cell=>Object.values(cell.userEnteredValue)[0]);
    if(request.sortRange){if(failSort)throw new Error('Sort unavailable');accounts.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));}
  }return {};};
  const ctx=vm.createContext({Date:class extends Date{static now(){return now;}},console,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,input)=>[...createHash('sha256').update(input).digest()]},PropertiesService:{getScriptProperties:()=>store},CacheService:{getScriptCache:()=>cache},LockService:{getScriptLock:()=>lock},Sheets:{Spreadsheets:{Values:values,get:(_id,options)=>options?.fields?.includes('properties(sheetId,title)')?{sheets:[{properties:{sheetId:57426151,title:'StudentNESTAccess'}}]}:{sheets:[]},batchUpdate}},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:message=>sent.push(message)}});
  vm.runInContext(source,ctx);
  return {call:request=>JSON.parse(JSON.stringify(ctx.authDispatch_(request))),tool:request=>JSON.parse(JSON.stringify(ctx.dispatch_(request))),manager:(identity,period)=>ctx.manager_(identity,period),state,sent,accounts,setLeaders:value=>leaders=value,setAuditFailure:value=>failAuditUpdate=value,setSortFailure:value=>failSort=value,advance:ms=>now+=ms};
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
test('registration creates the tool session in the same school call',()=>{
  const app=service();
  assert.equal(app.call({action:'auth-register-request',email,challenge,code:'123456',ip}).status,200);
  assert.equal(app.call({action:'auth-register-verify',challenge,code:'123456',ticket}).status,200);
  const result=app.call({action:'auth-register',ticket,username:'student1',passwordHash:'e'.repeat(64),passwordSalt:'f'.repeat(32),session,duration:'1d'});
  assert.equal(result.status,200);
  assert.ok(Number.isFinite(result.expires));
  assert.equal(app.call({action:'auth-me',session}).status,200);
  assert.equal(app.tool({action:'roster',period:'1',session}).status,200);
  app.accounts[0][4]=false;
  assert.equal(app.tool({action:'roster',period:'1',session}).status,401);
});
test('a failed account sort still leaves a working new account',()=>{
  const app=service();
  app.setSortFailure(true);
  assert.equal(app.call({action:'auth-register-request',email,challenge,code:'123456',ip}).status,200);
  assert.equal(app.call({action:'auth-register-verify',challenge,code:'123456',ticket}).status,200);
  const result=app.call({action:'auth-register',ticket,username:'student1',passwordHash:'e'.repeat(64),passwordSalt:'f'.repeat(32),session,duration:'1d'});
  assert.equal(result.status,200);
  assert.equal(app.accounts.length,1);
  assert.equal(app.call({action:'auth-me',session}).status,200);
});
test('new accounts stay sorted below the header and sessions use the right account',()=>{
  const app=service();
  app.accounts.push(['zeta','other@bethelsd.org','e'.repeat(64),'f'.repeat(32),true,1,'','']);
  assert.equal(app.call({action:'auth-register-request',email,challenge,code:'123456',ip}).status,200);
  assert.equal(app.call({action:'auth-register-verify',challenge,code:'123456',ticket}).status,200);
  assert.equal(app.call({action:'auth-register',ticket,username:'alpha',passwordHash:'e'.repeat(64),passwordSalt:'f'.repeat(32)}).status,200);
  assert.deepEqual(app.accounts.map(row=>row[0]),['alpha','zeta']);
  assert.equal(app.call({action:'auth-session',email,session,duration:'1d'}).status,200);
  assert.equal(app.call({action:'auth-me',session}).email,email);
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
test('only an active administrator may create a manual account with scoped period access',()=>{
  const app=service(),owner='mario@memberhq.net',ownerSession='1'.repeat(64),studentSession='2'.repeat(64);
  app.accounts.push(['mario',owner,'e'.repeat(64),'f'.repeat(32),true,1,'','']);
  assert.equal(app.call({action:'auth-session',email:owner,session:ownerSession,duration:'1d'}).status,200);
  const request={action:'auth-admin-create',username:'visitor',recoveryEmail:'',passwordHash:'a'.repeat(64),passwordSalt:'b'.repeat(32),period:'1',studentEmail:email};
  assert.equal(app.call({...request,session:studentSession}).status,403);
  assert.equal(app.call({...request,session:ownerSession}).status,200);
  assert.equal(app.call({...request,session:ownerSession}).status,409);
  assert.equal(app.accounts[1][8],'1');
  assert.equal(app.accounts[1][9],'');
  assert.equal(app.accounts[1][10],email);
  assert.equal(app.call({action:'auth-session',email:'manual:visitor',session:studentSession,duration:'1d'}).status,200);
  assert.equal(app.tool({action:'roster',period:'1',session:studentSession}).status,200);
  assert.equal(app.tool({action:'roster',period:'2',session:studentSession}).status,403);
  assert.equal(app.sent.length,0);
});
test('administrator lists, edits, and removes a roster-linked student account',()=>{
  const app=service(),owner='mario@memberhq.net',ownerSession='1'.repeat(64),studentSession='2'.repeat(64);
  app.accounts.push(['mario',owner,'e'.repeat(64),'f'.repeat(32),true,1,'','']);
  app.call({action:'auth-session',email:owner,session:ownerSession,duration:'1d'});
  assert.equal(app.call({action:'auth-admin-roster',session:studentSession,period:'1'}).status,403);
  assert.equal(app.call({action:'auth-admin-roster',session:ownerSession,period:'1'}).students[0].email,email);
  const create={action:'auth-admin-create',session:ownerSession,username:'visitor',period:'1',studentEmail:email,passwordHash:'a'.repeat(64),passwordSalt:'b'.repeat(32)};
  assert.equal(app.call(create).status,200);
  assert.equal(app.call({...create,username:'other'}).status,409);
  assert.equal(app.call({action:'auth-admin-list',session:ownerSession}).accounts[0].studentName,'Student');
  app.call({action:'auth-session',email:'manual:visitor',session:studentSession,duration:'1d'});
  app.setLeaders([['Period 1','','Division Manager','Student',email]]);
  assert.equal(app.manager('manual:visitor','1'),true);
  assert.equal(app.manager('manual:visitor','2'),false);
  app.setLeaders([['Period 1','','Safety Officer','Student',email]]);
  assert.equal(app.manager('manual:visitor','1'),false);
  app.setLeaders([['Period 1','','Division Manager','Student',email]]);
  assert.equal(app.tool({action:'roster',period:'1',session:studentSession}).status,200);
  assert.equal(app.call({action:'auth-admin-edit',session:ownerSession,currentUsername:'visitor',username:'visitor2',passwordHash:'c'.repeat(64),passwordSalt:'d'.repeat(32)}).status,200);
  assert.equal(app.call({action:'auth-me',session:studentSession}).status,401);
  assert.equal(app.call({action:'auth-admin-list',session:ownerSession}).accounts[0].username,'visitor2');
  assert.equal(app.call({action:'auth-admin-remove',session:ownerSession,currentUsername:'visitor2'}).status,200);
  assert.equal(app.call({action:'auth-admin-list',session:ownerSession}).accounts.length,0);
});
test('profile changes revoke old sessions and recovery email carries banner and username',()=>{
  const app=service(),owner='mpenalver@bethelsd.org',ownerSession='1'.repeat(64),studentSession='2'.repeat(64);
  app.accounts.push(['mario',owner,'e'.repeat(64),'f'.repeat(32),true,1,'','']);
  app.call({action:'auth-session',email:owner,session:ownerSession,duration:'1d'});
  assert.equal(app.call({action:'auth-admin-create',session:ownerSession,username:'visitor',recoveryEmail:owner,passwordHash:'a'.repeat(64),passwordSalt:'b'.repeat(32),period:'1',studentEmail:email}).status,200);
  app.call({action:'auth-session',email:'manual:visitor',session:studentSession,duration:'1d'});
  assert.equal(app.call({action:'auth-profile-update',session:studentSession,username:'visitor2'}).status,200);
  assert.equal(app.call({action:'auth-me',session:studentSession}).status,401);
  const recovery='3'.repeat(64),reset='4'.repeat(64);
  assert.equal(app.call({action:'auth-recover-request',email:owner,challenge:recovery,code:'123456',ip}).status,200);
  assert.match(app.sent[0].htmlBody,/nest-email-banner\.png/);
  assert.match(app.sent[0].body,/visitor2/);
  assert.equal(app.call({action:'auth-recover-verify',challenge:recovery,code:'000000',ticket:reset}).status,401);
  assert.deepEqual(app.call({action:'auth-recover-verify',challenge:recovery,code:'123456',ticket:reset}).usernames,['mario','visitor2']);
  assert.equal(app.call({action:'auth-recover-reset',ticket:reset,username:'visitor2',passwordHash:'c'.repeat(64),passwordSalt:'d'.repeat(32)}).status,200);
  assert.equal(app.call({action:'auth-recover-reset',ticket:reset,username:'visitor2',passwordHash:'c'.repeat(64),passwordSalt:'d'.repeat(32)}).status,401);
  assert.equal(app.accounts[1][2],'c'.repeat(64));
});
