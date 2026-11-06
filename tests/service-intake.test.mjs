import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';import {JSDOM} from 'jsdom';
import {serviceEmail,intakeFields,CODE_COOKIE} from '../lib/service-intake.mjs';import handler from '../api/service-requests.mjs';
const token='a'.repeat(64),challenge='b'.repeat(64),ip='c'.repeat(64),id='11111111-1111-4111-8111-111111111111',hash=v=>createHash('sha256').update(v).digest('hex');
const fields={name:'Test Staff',phone:'1234',room:'100',category:'Parts assembly',description:'Please assemble the parts.',attachment:'',urgency:'3'};
function school(){
 let now=Date.now(),failWrite=false,failMail=false;const props=new Map(),mail=[],writes=[],requests=[],events=[],queue=[];
 const store={getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k),getProperties:()=>Object.fromEntries(props)};
 const read=(store,key)=>{const raw=store.getProperty(key);if(!raw)return null;const result=JSON.parse(raw);if(result.expires<=now){store.deleteProperty(key);return null;}return result;};
 const ctx=vm.createContext({console,Utilities:{getUuid:()=> '33333333-3333-4333-8333-333333333333'},Date:class extends Date{static now(){return now;}},email_:v=>String(v||'').trim().toLowerCase(),hash_:hash,read_:read,
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},serviceClientSession_:r=>read(store,'service-session:'+hash(r.session||'')),
 rate_:(s,k,max,ttl)=>{const v=read(s,k)||{count:0,expires:now+ttl};if(v.count>=max)return false;v.count++;s.setProperty(k,JSON.stringify(v));return true;},
 nestAccountMail_:(_r,message)=>{if(failMail)throw Error('mail failed');mail.push(message);},
 serviceRead_:()=>({requests,events,logTab:{sheetId:2},tabs:[{title:'ServiceRequests',sheetId:1,headers:['id','status','created','email','name','phone','room','category','urgency','description','attachment']},{title:'EmailQueue',sheetId:3}]}),
 serviceColumns_:headers=>Object.fromEntries(headers.map((h,i)=>[h,i])),serviceAppend_:(tab,row)=>({tab:tab.sheetId,row}),serviceLeaders_:()=>[['Period 1','','Division Manager','Manager','manager@students.bethelsd.org']],SERVICE_SOURCE:'source',
 Sheets:{Spreadsheets:{batchUpdate:({requests:commands})=>{if(failWrite)throw Error('write failed');writes.push(commands);commands.forEach(c=>{if(c.tab===1)requests.push({id:c.row[0],email:c.row[3]});if(c.tab===2)events.push(c.row);if(c.tab===3)queue.push(c.row);});}}}});
 vm.runInContext(fs.readFileSync('google-spinner/ServiceIntake.js','utf8')+'\n'+fs.readFileSync('google-spinner/ServiceMedia.js','utf8'),ctx);
 const call=r=>JSON.parse(JSON.stringify(ctx.serviceIntakeDispatch_(r,store)));
 const start=email=>call({action:'service-client-code-request',challenge,email,code:'123456',ip});
 const verify=()=>call({action:'service-client-code-verify',challenge,code:'123456',session:token});
 return {ctx,props,mail,writes,requests,events,queue,call,media:r=>ctx.serviceMediaDispatch_(r,store),start,verify,advance:ms=>now+=ms,failWrite:()=>failWrite=true,failMail:()=>failMail=true};
}
test('verified client emails support district and outside addresses with matching school validation',()=>{
 const app=school();for(const email of ['user@bethelsd.org','USER@STUDENTS.BETHELSD.ORG','user@gmail.com','user@bethelsd.org.evil.test']){assert.ok(serviceEmail(email));assert.ok(app.ctx.serviceIntakeEmail_(email));}
 for(const email of ['bad@','a@localhost','a b@bethelsd.org','a@bethelsd.org\nBcc:evil@test.org']){assert.equal(serviceEmail(email),'');assert.equal(app.ctx.serviceIntakeEmail_(email),'');}
 for(const f of [fields,{...fields,name:''},{...fields,description:'x'.repeat(4001)},{...fields,attachment:'javascript:alert(1)'},{...fields,urgency:'6'},{...fields,attachment:'https://drive.google.com/file/d/test/view'}])assert.deepEqual(JSON.parse(JSON.stringify(app.ctx.serviceIntakeFields_(f))),intakeFields(f));
});
test('email code grants a separate client session for either domain without creating a NEST account',()=>{
 for(const email of ['staff@bethelsd.org','student@students.bethelsd.org']){
  const app=school();assert.equal(app.start(email).status,200);assert.equal(app.mail.length,1);assert.equal(app.mail[0].to,email);assert.match(app.mail[0].body,/123456/);
  const stored=app.props.get('service-intake:code:'+hash(challenge));assert.equal(stored.includes('123456'),false);
  assert.equal(app.verify().status,200);assert.equal(JSON.parse(app.props.get('service-session:'+hash(token))).email,email);
  assert.equal(app.verify().status,401);assert.equal([...app.props.keys()].some(k=>k.startsWith('authsession:')),false);
 }
});
test('codes expire, guessing is bounded, request cooldown is enforced, and prior client sessions rotate',()=>{
 let app=school();app.start('staff@bethelsd.org');assert.equal(app.start('staff@bethelsd.org').status,429);app.advance(600001);assert.equal(app.verify().status,401);
 app=school();app.start('staff@bethelsd.org');for(let i=0;i<5;i++)assert.equal(app.call({action:'service-client-code-verify',challenge,code:'999999',session:token}).status,401);assert.equal(app.verify().status,429);
 app=school();app.start('staff@bethelsd.org');app.props.set('service-session:'+hash(ip),JSON.stringify({email:'old@bethelsd.org',expires:Date.now()+50000}));assert.equal(app.call({action:'service-client-code-verify',challenge,code:'123456',session:token,previous:ip}).status,200);assert.equal(app.props.has('service-session:'+hash(ip)),false);
 app.advance(28800001);assert.equal(app.call({action:'service-client-submit',session:token,id,fields}).status,401);
});
test('submission atomically saves the ticket, audit and existing notification queue with verified recipient and replay protection',()=>{
 const app=school();app.start('staff@bethelsd.org');app.verify();const r={action:'service-client-submit',session:token,id,fields,email:'forged@bethelsd.org'};
 assert.equal(app.call(r).status,200);assert.equal(app.writes.length,1);assert.equal(app.writes[0].length,3);assert.equal(app.requests[0].email,'staff@bethelsd.org');assert.equal(app.queue.length,1);assert.equal(app.queue[0][1],'manager@students.bethelsd.org');assert.equal(app.queue[0][4],'');
 assert.equal(app.call(r).replayed,true);assert.equal(app.writes.length,1);assert.equal(app.queue.length,1);
 assert.equal(app.call({...r,fields:{...fields,name:'Changed'}}).status,409);assert.equal(app.call({...r,session:ip}).status,401);
});
test('failed atomic writes leave no ticket, audit or email queue item',()=>{
 const app=school();app.start('staff@bethelsd.org');app.verify();app.failWrite();assert.throws(()=>app.call({action:'service-client-submit',session:token,id,fields}),/write failed/);assert.equal(app.requests.length+app.events.length+app.queue.length,0);
});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.data=v;return this;}});
test('HTTP code flow is same-origin, uses HttpOnly client cookies, sends no code to browser, and ignores forged submitter email',async()=>{
 const oldFetch=global.fetch,oldURL=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN,oldEnabled=process.env.NEST_EMAIL_ENABLED,oldMailToken=process.env.POSTMARK_SERVER_TOKEN,oldFrom=process.env.POSTMARK_FROM_EMAIL;
 process.env.SPINNER_BRIDGE_URL='https://school.test';process.env.SPINNER_BRIDGE_TOKEN='test-token';process.env.NEST_EMAIL_ENABLED='true';process.env.POSTMARK_SERVER_TOKEN='mail-token';process.env.POSTMARK_FROM_EMAIL='communications@gknest.org';const calls=[];
 global.fetch=async(_url,options)=>{const r=JSON.parse(options.body);calls.push(r);return {status:200,ok:true,json:async()=>({status:200,email:'staff@bethelsd.org',id})};};
 try{
  const headers={origin:'https://gknest.org','content-type':'application/json'},send=async(body,extra={})=>{const res=response();await handler({method:'POST',headers:{...headers,...extra},body},res);return res;};
  assert.equal((await send({operation:'code-request',email:'bad@'})).code,400);assert.equal(calls.length,0);
  assert.equal((await send({operation:'code-request',email:'staff@bethelsd.org'},{origin:'https://evil.test'})).code,403);
  let res=await send({operation:'code-request',email:'staff@bethelsd.org'});assert.equal(res.code,200);assert.match(res.headers['Set-Cookie'],/HttpOnly/);assert.equal(JSON.stringify(res.data).includes(calls[0].code),false);assert.equal(calls[0].accountMailToken,'mail-token');
  res=await send({operation:'code-verify',code:'123456'},{cookie:CODE_COOKIE+'='+challenge});assert.equal(res.code,200);assert.ok(res.headers['Set-Cookie'].some(v=>v.startsWith('__Host-nest-service=')));assert.equal(res.headers['Set-Cookie'].some(v=>v.startsWith('__Host-nest-auth=')),false);
  res=await send({operation:'submit-request',id,fields,email:'evil@bethelsd.org'},{cookie:'__Host-nest-service='+token});assert.equal(res.code,200);assert.equal(calls.at(-1).email,undefined);assert.deepEqual(calls.at(-1).fields,fields);
 }finally{global.fetch=oldFetch;for(const [key,value] of Object.entries({SPINNER_BRIDGE_URL:oldURL,SPINNER_BRIDGE_TOKEN:oldToken,NEST_EMAIL_ENABLED:oldEnabled,POSTMARK_SERVER_TOKEN:oldMailToken,POSTMARK_FROM_EMAIL:oldFrom})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('embedded form hides until verified, preserves uncertain submissions and never embeds Google Forms',async()=>{
 const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{url:'https://gknest.org/service',runScripts:'outside-only'}),w=dom.window;w.crypto.randomUUID=()=>id;const calls=[];let fail=true;
 w.fetch=async(_url,options)=>{const r=JSON.parse(options.body);calls.push(r);return {ok:!fail,status:fail?503:200,json:async()=>fail?{error:'Uncertain save'}:{id}};};w.eval(fs.readFileSync('js/service-intake.js','utf8'));
 const d=w.document;assert.equal(d.querySelector('#service-intake-form').hidden,true);assert.equal(d.querySelector('iframe'),null);
 d.dispatchEvent(new w.CustomEvent('nest-service-client-state',{detail:{signedIn:true,email:'staff@bethelsd.org'}}));assert.equal(d.querySelector('#service-intake-form').hidden,false);
 for(const [key,value] of Object.entries(fields))d.querySelector('#intake-'+key).value=value;
 const submit=()=>d.querySelector('#service-intake-form').dispatchEvent(new w.Event('submit',{cancelable:true}));submit();await new Promise(r=>setTimeout(r,5));assert.equal(d.querySelector('#service-intake-fields').disabled,true);assert.equal(d.querySelector('#intake-name').value,'Test Staff');
 fail=false;submit();await new Promise(r=>setTimeout(r,5));assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.match(d.querySelector('#service-intake-status').textContent,/11111111 saved/);assert.equal(d.querySelector('#service-intake-form').hidden,true);dom.window.close();
});

test('late-loaded intake UI restores an already verified client and code verification unlocks only client access',async()=>{
 const html=fs.readFileSync('service.html','utf8'),script=fs.readFileSync('js/service-intake.js','utf8');
 let dom=new JSDOM(html,{url:'https://gknest.org/service',runScripts:'outside-only'}),w=dom.window;
 w.NestServiceClient={signedIn:true,email:'student@students.bethelsd.org'};w.eval(script);assert.equal(w.document.querySelector('#service-intake-form').hidden,false);assert.match(w.document.querySelector('#service-intake-email').textContent,/student@/);dom.window.close();
 dom=new JSDOM(html,{url:'https://gknest.org/service',runScripts:'outside-only'});w=dom.window;const calls=[];
 w.fetch=async(_url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({email:'staff@bethelsd.org',message:'Code emailed'})};};w.eval(script);const d=w.document;
 d.querySelector('#service-code-email').value='staff@bethelsd.org';d.querySelector('#service-code-request').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,5));assert.equal(d.querySelector('#service-code-verify').hidden,false);assert.equal(d.querySelector('#service-intake-form').hidden,true);
 d.querySelector('#service-code').value='123456';d.querySelector('#service-code-verify').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,5));assert.equal(d.querySelector('#service-intake-form').hidden,false);assert.equal(d.querySelector('#service-client-auth').hidden,true);assert.deepEqual(calls.map(c=>c.operation),['code-request','code-verify']);assert.equal(w.NestAuth,undefined);dom.window.close();
});

test('completed uploads commit with the ticket, remain requester-bound and do not duplicate on retry',()=>{
 const app=school(),ticket='11111111-1111-4111-8111-111111111111',fileId='44444444-4444-4444-8444-444444444444',file={ticketId:ticket,fileId,name:'Photo.jpg',type:'image/jpeg',size:3,path:'service-media/'+ticket+'/'+fileId+'.jpg'};
 app.start('staff@bethelsd.org');app.verify();assert.equal(app.media({action:'service-client-upload-prepare',session:token,file}).status,200);
 assert.equal(app.call({action:'service-client-submit',session:token,id:ticket,fields,attachmentIds:[fileId]}).status,425);assert.equal(app.writes.length,0);
 assert.equal(app.media({action:'service-client-upload-complete',session:token,file}).status,200);
 const request={action:'service-client-submit',session:token,id:ticket,fields,attachmentIds:[fileId]};assert.equal(app.call(request).status,200);assert.equal(app.writes[0].length,4);assert.match(app.writes[0][0].row[10],/api\/service-attachments\?ticket=/);assert.equal(app.events.filter(e=>e[2]==='attachments').length,1);assert.equal(JSON.parse(app.events.find(e=>e[2]==='attachments')[9])[0].name,'Photo.jpg');assert.equal(app.call(request).replayed,true);assert.equal(app.writes.length,1);
 const foreign={...file,fileId:'55555555-5555-4555-8555-555555555555',path:'service-media/'+ticket+'/55555555-5555-4555-8555-555555555555.jpg'};app.props.set('service-session:'+hash(ip),JSON.stringify({email:'another@bethelsd.org',expires:Date.now()+50000}));assert.equal(app.media({action:'service-client-upload-prepare',session:ip,file:foreign}).status,409);
});
test('on-behalf intake validates client identity, preserves verified submitter, and atomically saves an idempotent outside-client ticket',()=>{const app=school(),client={name:'Community Client',email:'client@example.com',address:'123 Example Street'},f={...fields,name:'Student Submitter',client};assert.deepEqual(intakeFields(f),JSON.parse(JSON.stringify(app.ctx.serviceIntakeFields_(f))));for(const patch of [{email:'bad@'},{name:''},{address:'bad\naddress'}])assert.equal(intakeFields({...f,client:{...client,...patch}}),null);app.start('student@students.bethelsd.org');app.verify();const request={action:'service-client-submit',session:token,id,fields:f};assert.equal(app.call(request).status,200);assert.equal(app.requests[0].email,'client@example.com');const identity=JSON.parse(app.events.find(e=>e[2]==='submission-identity')[9]);assert.equal(identity.submitterEmail,'student@students.bethelsd.org');assert.equal(identity.submitterName,'Student Submitter');assert.equal(identity.clientAddress,'123 Example Street');assert.equal(app.events.find(e=>e[2]==='submission')[3],'student@students.bethelsd.org');assert.equal(app.call(request).replayed,true);assert.equal(app.writes.length,1);assert.match(app.queue[0][3],/Community Client/);});
test('outside clients can verify an email code without receiving a NEST leadership account',()=>{const app=school();assert.equal(app.start('client@example.com').status,200);assert.equal(app.mail[0].to,'client@example.com');assert.equal(app.verify().status,200);assert.equal(JSON.parse(app.props.get('service-session:'+hash(token))).email,'client@example.com');assert.equal([...app.props.keys()].some(k=>k.startsWith('authsession:')),false);});
test('on-behalf form selects staff or custom external clients and keeps submitter fields distinct',async()=>{const dom=new JSDOM(fs.readFileSync('service.html','utf8'),{url:'https://gknest.org/service',runScripts:'outside-only'}),w=dom.window,calls=[];w.fetch=async(url,opts)=>{const b=opts?.body?JSON.parse(opts.body):{};calls.push({url,body:b});return {ok:true,json:async()=>url.includes('directory')?{staff:[{name:'Teacher Example',email:'teacher@bethelsd.org'}]}:{id}};};w.eval(fs.readFileSync('js/service-intake.js','utf8'));try{const d=w.document;d.dispatchEvent(new w.CustomEvent('nest-service-client-state',{detail:{signedIn:true,email:'student@students.bethelsd.org'}}));d.querySelector('#intake-on-behalf').value='yes';d.querySelector('#intake-on-behalf').dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,10));assert.equal(d.querySelector('#intake-client-fields').hidden,false);assert.equal(d.querySelector('#intake-client-name').required,true);d.querySelector('#intake-client-staff').value='teacher@bethelsd.org';d.querySelector('#intake-client-staff').dispatchEvent(new w.Event('change'));assert.equal(d.querySelector('#intake-client-email').value,'teacher@bethelsd.org');d.querySelector('#intake-client-staff').value='';d.querySelector('#intake-client-name').value='Outside Client';d.querySelector('#intake-client-email').value='outside@example.com';d.querySelector('#intake-client-address').value='123 Example Street';for(const [key,value] of Object.entries(fields))d.querySelector('#intake-'+key).value=value;d.querySelector('#service-intake-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));const submission=calls.find(c=>c.body.operation==='submit-request').body;assert.equal(submission.fields.name,'Test Staff');assert.deepEqual(submission.fields.client,{name:'Outside Client',email:'outside@example.com',address:'123 Example Street'});assert.equal(submission.email,undefined);}finally{dom.window.close();}});
test('staff directory is available to verified school identities and is not exposed to anonymous or outside-code sessions',()=>{const app=school();let reads=0;app.ctx.Sheets.Spreadsheets.Values={get:()=>{reads++;return {values:[]};}};app.ctx.LAB_STAFF_BOOK='staff';app.ctx.labParseStaff_=()=>[{name:'Teacher Example',email:'teacher@bethelsd.org',id:'private-id'}];app.ctx.OWNER_EMAILS=['owner@example.com'];app.ctx.authSession_=raw=>raw==='owner'?{email:'owner@example.com'}:null;assert.equal(app.ctx.serviceIntakeDirectory_({action:'service-client-directory',session:'bad'},{ }).status,401);app.start('client@example.com');app.verify();let result=app.ctx.serviceIntakeDirectory_({action:'service-client-directory',session:token},{});assert.equal(result.staff.length,0);assert.equal(reads,0);result=app.ctx.serviceIntakeDirectory_({action:'auth-service-directory',session:'owner'},{});assert.equal(result.staff[0].email,'teacher@bethelsd.org');assert.equal('id' in result.staff[0],false);assert.equal(reads,1);});
