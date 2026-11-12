import {accountSchool as service} from './helpers/account-school.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const source = fs.readFileSync(new URL('../google-spinner/Code.js',import.meta.url),'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');

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

test('recovery request retries reuse one email and verification retries reuse one ticket',()=>{
 const app=service();app.accounts.push(['student',email,'e'.repeat(64),'f'.repeat(32),true,1,'','','',email]);
 const request={action:'auth-recover-request',email,challenge,code:'123456',ip};
 assert.equal(app.call(request).status,200);assert.equal(app.call(request).status,200);assert.equal(app.sent.length,1);
 assert.equal(app.call({...request,code:'654321'}).status,400);assert.equal(app.sent.length,1);
 const verify={action:'auth-recover-verify',challenge,code:'123456',ticket};
 assert.deepEqual(app.call(verify).usernames,['student']);assert.deepEqual(app.call(verify).usernames,['student']);
 assert.equal(app.call({...verify,code:'000000'}).status,401);
 assert.equal(app.call({...verify,ticket:'e'.repeat(64)}).status,401);
 assert.equal(app.call({action:'auth-recover-reset',ticket,username:'student',passwordHash:'a'.repeat(64),passwordSalt:'b'.repeat(32)}).status,200);
 assert.equal(app.call(verify).status,401);
});
test('uncertain mail delivery is not resent when the same recovery request is replayed',()=>{
 const app=service();app.accounts.push(['student',email,'e'.repeat(64),'f'.repeat(32),true,1,'','','',email]);
 const request={action:'auth-recover-request',email,challenge,code:'123456',ip};
 assert.equal(app.call(request).status,200);
 const key='authrecover:'+hash(challenge),record=JSON.parse(app.state.get(key));record.delivery='uncertain';app.state.set(key,JSON.stringify(record));
 assert.equal(app.call(request).status,503);assert.equal(app.sent.length,1);
});
test('verification replay rechecks the active account and expires with its ticket',()=>{
 const app=service();app.accounts.push(['student',email,'e'.repeat(64),'f'.repeat(32),true,1,'','','',email]);
 app.call({action:'auth-recover-request',email,challenge,code:'123456',ip});const verify={action:'auth-recover-verify',challenge,code:'123456',ticket};
 assert.equal(app.call(verify).status,200);app.accounts[0][4]=false;assert.equal(app.call(verify).status,401);
 app.accounts[0][4]=true;app.advance(600001);assert.equal(app.call(verify).status,401);
});
test('unknown recovery addresses keep the same private success response on replay without email',()=>{
 const app=service(),request={action:'auth-recover-request',email,challenge,code:'123456',ip};
 assert.equal(app.call(request).status,200);assert.equal(app.call(request).status,200);assert.equal(app.sent.length,0);
});


test('registration and recovery use NEST Communications transactional mail without tracking',()=>{
 for(const action of ['auth-register-request','auth-recover-request']){
  const app=service();if(action==='auth-recover-request')app.accounts.push(['student',email,'e'.repeat(64),'f'.repeat(32),true,1]);
  assert.equal(app.call({action,email,challenge,code:'123456',ip}).status,200);
  const message=app.sent[0];assert.equal(message.From,'NEST Communications <communications@gknest.org>');assert.equal(message.To,email);
  assert.equal(message.MessageStream,'outbound');assert.equal(message.TrackOpens,false);assert.equal(message.TrackLinks,'None');
  assert.ok(!message.HtmlBody.includes('unsubscribe'));assert.ok(!JSON.stringify([...app.state.values()]).includes('test-mail-token'));
 }
});
test('failed or uncertain provider delivery never falls back to work email or repeats a recovery send',()=>{
 for(const mode of ['throw','rejected','malformed']){
  const app=service();app.accounts.push(['student',email,'e'.repeat(64),'f'.repeat(32),true,1]);app.setMailMode(mode);
  const request={action:'auth-recover-request',email,challenge,code:'123456',ip};
  assert.equal(app.call(request).status,503);assert.equal(app.call(request).status,503);assert.equal(app.sent.length,1);
  assert.equal(JSON.parse(app.state.get('authrecover:'+hash(challenge))).delivery,'uncertain');
 }
});
test('account email fails closed when the server credential is missing',()=>{
 for(const action of ['auth-register-request','auth-recover-request']){
  const app=service();if(action==='auth-recover-request')app.accounts.push(['student',email,'e'.repeat(64),'f'.repeat(32),true,1]);
  assert.equal(app.call({action,email,challenge,code:'123456',ip,accountMailToken:undefined}).status,503);assert.equal(app.sent.length,0);
 }
});

test('owner directory includes active district and manual student/staff accounts and protects credential metadata',()=>{
 const app=service(),owner='mpenalver@bethelsd.org',ownerSession='1'.repeat(64),studentSession='2'.repeat(64);
 app.accounts.push(['mario',owner,'e'.repeat(64),'f'.repeat(32),true,1,'2026-11-02T17:00:00.000Z',''],['student',email,'a'.repeat(64),'b'.repeat(32),true,3,'2026-10-01T12:00:00Z','','','','','Private note'],['teacher','teacher@bethelsd.org','c'.repeat(64),'d'.repeat(32),true,2,'2026-09-01T12:00:00Z',''],['disabled','old@students.bethelsd.org','','',false,1,'','']);
 app.setLeaders([['1','','Manager','Able, Zoe','teacher@bethelsd.org']]);
 app.call({action:'auth-session',email:owner,session:ownerSession,duration:'1d'});app.call({action:'auth-session',email,session:studentSession,duration:'1d'});
 assert.equal(app.call({action:'auth-admin-directory'}).status,403);assert.equal(app.call({action:'auth-admin-directory',session:studentSession}).status,403);
 const result=app.call({action:'auth-admin-directory',session:ownerSession});assert.equal(result.status,200);assert.equal(result.accounts.length,3);assert.equal(result.accounts[0].name,'Able, Zoe');assert.equal(result.accounts[0].type,'staff');
 const student=result.accounts.find(a=>a.username==='student');assert.equal(student.type,'student');assert.equal(student.passwordHash,'a'.repeat(64));assert.equal(student.passwordSalt,'b'.repeat(32));assert.equal(student.sessionVersion,3);assert.equal(student.notes,'Private note');assert.equal(student.createdAt,'2026-10-01T12:00:00Z');
 assert.ok(!JSON.stringify(app.call({action:'auth-profile-read',session:studentSession})).includes('Private note'));
});
test('owner notes write only administrator metadata, validate input, and preserve existing sessions',()=>{
 const app=service(),owner='mpenalver@bethelsd.org',ownerSession='1'.repeat(64),studentSession='2'.repeat(64);
 app.accounts.push(['mario',owner,'e'.repeat(64),'f'.repeat(32),true,1,'',''],['student',email,'a'.repeat(64),'b'.repeat(32),true,3,'2026-10-01T12:00:00Z','']);
 app.call({action:'auth-session',email:owner,session:ownerSession,duration:'1d'});app.call({action:'auth-session',email,session:studentSession,duration:'1d'});
 assert.equal(app.call({action:'auth-admin-notes',session:studentSession,accountKey:email,notes:'bad'}).status,403);
 assert.equal(app.call({action:'auth-admin-notes',session:ownerSession,accountKey:email,notes:'x'.repeat(1001)}).status,400);
 const before=app.accounts[1].slice(0,8);assert.equal(app.call({action:'auth-admin-notes',session:ownerSession,accountKey:email,notes:'=SUM(1,2)\nFollow up'}).status,200);
 assert.equal(app.accounts[1][11],'=SUM(1,2)\nFollow up');assert.deepEqual(app.accounts[1].slice(0,8),before);assert.equal(app.call({action:'auth-me',session:studentSession}).status,200);
 assert.equal(app.call({action:'auth-admin-notes',session:ownerSession,accountKey:email,notes:''}).status,200);assert.equal(app.accounts[1][11],'');
});
test('signup reset is owner-only, email-specific, temporary, and never sends email or bypasses verification',()=>{
 const app=service(),owner='mpenalver@bethelsd.org',ownerSession='1'.repeat(64),now=1_000_000_000;
 app.accounts.push(['mario',owner,'e'.repeat(64),'f'.repeat(32),true,1,'','']);app.call({action:'auth-session',email:owner,session:ownerSession,duration:'1d'});
 app.call({action:'auth-register-request',email,challenge,code:'123456',ip});
 for(let i=0;i<5;i++)assert.equal(app.call({action:'auth-register-verify',challenge,code:'000000',ticket}).status,401);
 app.state.set('auth-ip:'+ip,JSON.stringify({count:30,expires:now+3600000}));app.state.set('auth-email:'+hash(email),JSON.stringify({count:5,expires:now+3600000}));
 assert.equal(app.call({action:'auth-admin-registration-unlock',email}).status,403);
 assert.equal(app.call({action:'auth-admin-registration-unlock',session:ownerSession,email:'unknown@students.bethelsd.org'}).status,404);
 assert.equal(app.call({action:'auth-admin-registration-unlock',session:ownerSession,email:owner}).status,409);
 const sent=app.sent.length,result=app.call({action:'auth-admin-registration-unlock',session:ownerSession,email});assert.equal(result.status,200);assert.equal(result.expires,now+600000);assert.equal(result.challengesReset,1);assert.equal(app.sent.length,sent);
 assert.equal(app.call({action:'auth-register-verify',challenge,code:'123456',ticket}).status,200);
 assert.equal(app.call({action:'auth-register-request',email:'other@students.bethelsd.org',challenge:'7'.repeat(64),code:'123456',ip}).status,429);
 assert.equal(app.call({action:'auth-register-request',email,challenge:'8'.repeat(64),code:'123456',ip}).status,200);
 assert.equal(app.call({action:'auth-register-request',email,challenge:'9'.repeat(64),code:'123456',ip}).status,429,'one-minute cooldown remains');
 app.advance(600001);assert.equal(app.call({action:'auth-register-request',email,challenge:'9'.repeat(64),code:'123456',ip}).status,429,'shared-network exception expires');
});

test('old eleven-column account sheets remain readable and gain only the notes column on first save',()=>{
 const app=service(),owner='mpenalver@bethelsd.org',ownerSession='1'.repeat(64);app.setColumns(11);app.accounts.push(['mario',owner,'e'.repeat(64),'f'.repeat(32),true,1,'','']);
 assert.equal(app.call({action:'auth-session',email:owner,session:ownerSession,duration:'1d'}).status,200);
 assert.equal(app.call({action:'auth-admin-directory',session:ownerSession}).status,200);assert.equal(app.getColumns(),11);
 assert.equal(app.call({action:'auth-admin-notes',session:ownerSession,accountKey:owner,notes:'Private note'}).status,200);assert.equal(app.getColumns(),12);assert.equal(app.accounts[0][11],'Private note');assert.equal(app.call({action:'auth-me',session:ownerSession}).status,200);
});
test('recovery cooldown denials do not consume hourly email or shared-network allowances',()=>{const app=service(),email='fictional@students.bethelsd.org',ip='e'.repeat(64);app.accounts.push(['fictional',email,'e'.repeat(64),'f'.repeat(32),true,1]);const request=()=>app.call({action:'auth-recover-request',email,challenge:cryptoChallenge(),code:'123456',ip});let count=0;function cryptoChallenge(){return (++count).toString(16).padStart(64,'0');}assert.equal(request().status,200);for(let i=0;i<10;i++){const result=request();assert.equal(result.status,429);assert.equal(result.retryAfter,60);}assert.equal(JSON.parse(app.state.get('auth-recover-email:'+hash(email))).count,1);assert.equal(JSON.parse(app.state.get('auth-recover-ip:'+ip)).count,1);app.advance(60001);assert.equal(request().status,200);assert.equal(app.sent.length,2);});
test('an account read failure never consumes recovery allowance',()=>{const app=service();app.ctx.accounts_=()=>{throw Error('Read quota');};assert.throws(()=>app.call({action:'auth-recover-request',email,challenge,code:'123456',ip}),/Read quota/);assert.equal([...app.state.keys()].some(k=>k.startsWith('auth-recover-')),false);});
test('recovery uses a fresh native account read and restores its request context',()=>{const app=service(),old=new Map([['before','value']]);let advanced=0;app.ctx.SpreadsheetApp={openById:()=>({getSheetByName:()=>({getLastRow:()=>2,getMaxColumns:()=>12,getRange:()=>({getValues:()=>[['fictional',email,'a'.repeat(64),'b'.repeat(32),true,1]]})})})};vm.runInContext('NEST_ACCESS_READS=new Map([["before","value"]]);',app.ctx);const get=app.ctx.Sheets.Spreadsheets.Values.get;app.ctx.Sheets.Spreadsheets.Values.get=()=>{advanced++;throw Error('Advanced API must not be used');};const result=app.ctx.authRecoveryReadContext_(()=>app.ctx.accounts_());assert.equal(result[0].username,'fictional');assert.equal(advanced,0);assert.equal(vm.runInContext('NEST_ACCESS_READS.get("before")',app.ctx),'value');app.ctx.Sheets.Spreadsheets.Values.get=get;});
