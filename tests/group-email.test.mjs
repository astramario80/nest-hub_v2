import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import handler from '../api/group-email.mjs';
import {renderDivisionPage} from '../api/division-page.mjs';
const tick=()=>new Promise(r=>setTimeout(r,20));
const records={period:'2',members:[{name:'Sample Leader',email:'leader@students.bethelsd.org'},{name:'Sample Member',email:'member@students.bethelsd.org'}],leaders:[{name:'Sample Leader',email:'leader@students.bethelsd.org',position:'Safety Officer'}]};
const response=()=>({code:200,setHeader(){},status(c){this.code=c;return this;},json(data){this.data=data;return this;}});
async function server(access,period="2"){
 const oldFetch=globalThis.fetch,oldURL=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN,calls=[];
 process.env.SPINNER_BRIDGE_URL='https://bridge.example.test';process.env.SPINNER_BRIDGE_TOKEN='test';
 globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body.action);const result=body.action==='auth-division-slides'?(typeof access==='function'?access(body.period):access):body.action==='auth-leadership-directory'?{status:200,leaders:[{division:'Period 2',position:'Safety Officer',firstName:'Sample',lastName:'Leader',email:records.leaders[0].email},{division:'Period 3',position:'Safety Officer',firstName:'Other',lastName:'Division',email:'other@students.bethelsd.org'}]}:{status:200,period:body.period,students:[...records.members,{name:'Archived',email:'archived@students.bethelsd.org',active:false}],scores:{private:'excluded'}};return new Response(JSON.stringify(result));};
 try{const res=response();await handler({method:'GET',headers:{cookie:'__Host-nest-auth='+'a'.repeat(64)},query:{period}},res);return {res,calls};}
 finally{globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldURL;if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;}
}
test('email groups require login and reject invalid divisions and write requests',async()=>{
 for(const [req,code] of [[{method:'GET',headers:{},query:{period:'2'}},401],[{method:'GET',headers:{},query:{period:'__proto__'}},400],[{method:'POST',headers:{},query:{}},405]]){const res=response();await handler(req,res);assert.equal(res.code,code);}
});
test('ordinary members and other division members receive no email roster',async()=>{
 for(const access of [{status:200,roles:[],canManage:false},{status:403,roles:['Safety Officer']}]){const {res,calls}=await server(access);assert.equal(res.code,403);assert.equal(res.data.members,undefined);assert.deepEqual(calls,['auth-division-slides']);}
});
test('managers, assistants and assigned leaders receive only current selected-division recipients',async()=>{
 for(const access of [{status:200,canManage:true},{status:200,roles:['Assistant Manager']},{status:200,roles:['Safety Officer']}]){const {res}=await server(access);assert.equal(res.code,200);assert.deepEqual(res.data.members,records.members);assert.equal(res.data.leaders.length,1);assert.equal(res.data.scores,undefined);}
});
function ui(gmail=false){
 const dom=new JSDOM(renderDivisionPage('2',{manager:{},leaders:[],canManage:false}),{runScripts:'outside-only',url:'https://gknest.org/divisions/2#lookup'}),w=dom.window;
 w.AbortSignal=AbortSignal;w.Blob=Blob;w.TextEncoder=TextEncoder;w.NestAuth={identity:{signedIn:true},ready:Promise.resolve()};w.NestDivisionHQ={allowed:true,active:"lookup"};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let copied=null,opened=null;w.ClipboardItem=class{constructor(data){this.data=data;}};
 Object.defineProperty(w.navigator,'clipboard',{value:{write:async items=>copied=items[0]}});w.open=url=>opened={location:{href:url}};
 if(gmail)w.google={accounts:{oauth2:{initTokenClient:config=>({ ...config, requestAccessToken(){this.callback({access_token:'test-token',expires_in:3600,scope:'send email'});}}),hasGrantedAllScopes:()=>true}}};
 w.fetch=async()=>({ok:true,json:async()=>gmail?{...records,gmailClientId:'test-client.apps.googleusercontent.com'}:records});w.eval(fs.readFileSync('js/group-email.js','utf8'));
 return {w,get copied(){return copied;},get opened(){return opened;}};
}
test('composer filters groups, copies sanitized banner HTML and opens an unsent Gmail draft',async()=>{
 const app=ui(),{w}=app;await tick();const q=s=>w.document.querySelector(s);
 assert.equal(q('.group-email-launch').hidden,false);q('.group-email-launch').click();assert.equal(q('.group-email-dialog').open,true);
 assert.equal(q('[data-email-recipients]').querySelectorAll('input:checked').length,1);
 q('[data-email-group]').value='members';q('[data-email-group]').dispatchEvent(new w.Event('change'));assert.equal(q('[data-email-recipients]').querySelectorAll('input:checked').length,2);
 q('[data-email-group]').value='specific';q('[data-email-group]').dispatchEvent(new w.Event('change'));assert.equal(q('[data-email-open]').disabled,true);
 q('[data-email-recipients] input').checked=true;q('[data-email-recipients] input').dispatchEvent(new w.Event('change'));
 q('[data-email-subject]').value='Team meeting';q('.group-email-message').innerHTML='<b>Hello</b><ul><li>Agenda</li></ul><font face="Georgia" size="4">Team</font><script>bad()</script><a href="javascript:bad()">unsafe</a>';
 q('[data-email-open]').click();await tick();
 const html=await app.copied.data['text/html'].text();assert.match(html,/nest-email-banner.png/);assert.match(html,/<ul>/);assert.match(html,/face="Georgia"/);assert.doesNotMatch(html,/javascript:|<script/);
 assert.match(app.opened.location.href,/mail.google.com/);assert.match(app.opened.location.href,/leader%40students/);assert.match(app.opened.location.href,/su=Team%20meeting/);assert.doesNotMatch(app.opened.location.href,/member%40students/);w.close();
});
test('revoked access prevents copying and opening recipients, and clears the draft',async()=>{
 const app=ui(),{w}=app;await tick();const q=s=>w.document.querySelector(s);q('.group-email-launch').click();q('[data-email-subject]').value='Meeting';q('.group-email-message').textContent='Hello';
 w.fetch=async()=>({ok:false,json:async()=>({error:'Leadership access ended.'})});q('[data-email-open]').click();await tick();assert.equal(app.copied,null);assert.equal(app.opened,null);
 w.NestDivisionHQ.allowed=false;w.document.dispatchEvent(new w.Event('nest-hq-access-revoked'));assert.equal(q('.group-email-message').textContent,'');assert.equal(q('.group-email-dialog').open,false);assert.equal(q('.group-email-launch').hidden,true);w.close();
});

test('All divisions aggregates authorized rosters, deduplicates recipients and excludes nonleadership divisions',async()=>{
 const owner=await server({status:200,isOwner:true},'all');assert.equal(owner.res.code,200);assert.deepEqual(owner.res.data.divisions,['1','2','3','4','5','7','CTSO']);assert.equal(owner.res.data.members.length,2);assert.equal(owner.calls.filter(a=>a==='tracker').length,7);
 const leader=await server(p=>p==='2'?{status:200,roles:['Safety Officer']}:{status:200,roles:[]},'all');assert.equal(leader.res.code,200);assert.deepEqual(leader.res.data.divisions,['2']);assert.equal(leader.calls.filter(a=>a==='tracker').length,1);assert.equal(leader.res.data.leaders.length,1);
 const denied=await server({status:200,roles:[]},'all');assert.equal(denied.res.code,403);assert.equal(denied.calls.includes('tracker'),false);
});
test('All divisions is selectable and retains the written draft when changing scope',async()=>{
 const {w}=ui();await tick();const q=s=>w.document.querySelector(s);q('.group-email-launch').click();q('.group-email-message').textContent='Keep this message';
 assert.equal(q('[data-email-division] option[value=all]').textContent,'All divisions');
 let requested;w.fetch=async url=>{requested=url;return {ok:true,json:async()=>({...records,period:'all',divisions:['2','3']})};};
 q('[data-email-division]').value='all';q('[data-email-division]').dispatchEvent(new w.Event('change'));await tick();assert.match(requested,/period=all/);assert.equal(q('.group-email-message').textContent,'Keep this message');assert.match(q('[data-email-status]').textContent,/Division 2, Division 3/);w.close();
});

function selectText(w,first,last,start=0,end=last.textContent.length){
 const range=w.document.createRange();range.setStart(first.firstChild,start);range.setEnd(last.firstChild,end);
 const selection=w.getSelection();selection.removeAllRanges();selection.addRange(range);
 w.document.dispatchEvent(new w.Event('selectionchange'));
}
function indent(w,name='indent'){
 const button=w.document.querySelector('[data-email-command="'+name+'"]');
 button.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,cancelable:true}));button.click();
}
test('indent/outdent preserves a multiple-paragraph selection and leaves neighboring lines alone',async()=>{
 const {w}=ui();await tick();const editor=w.document.querySelector('.group-email-message');editor.innerHTML='<p>Before</p><p>First</p><p>Second</p><p>After</p>';
 const paragraphs=[...editor.children];selectText(w,paragraphs[1],paragraphs[2]);indent(w);
 assert.deepEqual(paragraphs.map(el=>el.style.marginLeft),['','32px','32px','']);assert.equal(w.getSelection().toString(),'FirstSecond');
 indent(w);assert.equal(paragraphs[1].style.marginLeft,'64px');indent(w,'outdent');indent(w,'outdent');assert.equal(paragraphs[1].style.marginLeft,'');assert.equal(paragraphs[2].style.marginLeft,'');w.close();
});
test('multiple bullets nest together and outdent without changing their bullet type or trailing content',async()=>{
 const {w}=ui();await tick();const editor=w.document.querySelector('.group-email-message');editor.innerHTML='<ul><li>Parent</li><li>First</li><li>Second</li><li>After</li></ul>';
 const items=[...editor.querySelectorAll('li')];selectText(w,items[1],items[2]);indent(w);
 assert.equal(items[1].parentElement.parentElement,items[0]);assert.equal(items[2].parentElement,items[1].parentElement);assert.equal(editor.querySelector(':scope > ul').children.length,2);assert.equal(w.getSelection().toString(),'FirstSecond');
 indent(w,'outdent');assert.deepEqual([...editor.querySelector(':scope > ul').children].map(el=>el.textContent),['Parent','First','Second','After']);assert.equal(w.getSelection().toString(),'FirstSecond');w.close();
});
test('first bullets visibly indent and pasted line breaks become separately adjustable lines',async()=>{
 const {w}=ui();await tick();const editor=w.document.querySelector('.group-email-message');editor.innerHTML='<ul><li>First</li><li>Second</li></ul>';
 const items=[...editor.querySelectorAll('li')];selectText(w,items[0],items[1]);indent(w);assert.equal(items[0].style.marginLeft,'32px');assert.equal(items[1].style.marginLeft,'32px');indent(w,'outdent');assert.equal(items[0].style.marginLeft,'');
 editor.innerHTML='One<br>Two<br>Three';const nodes=[...editor.childNodes];const range=w.document.createRange();range.setStart(nodes[0],0);range.setEnd(nodes[2],3);w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.document.dispatchEvent(new w.Event('selectionchange'));indent(w);
 assert.deepEqual([...editor.children].map(el=>el.style.marginLeft),['32px','32px','']);assert.match(w.getSelection().toString(),/OneTwo/);w.close();
});
test('copied email keeps indentation and nested bullets while stripping unrelated inline styles',async()=>{
 const app=ui(),{w}=app;await tick();const q=s=>w.document.querySelector(s);q('.group-email-launch').click();q('[data-email-subject]').value='Meeting';const editor=q('.group-email-message');editor.innerHTML='<p style="color:red" onclick="bad()">First</p><p>Second</p><ul><li>Parent<ul><li>Child</li></ul></li></ul>';
 selectText(w,editor.children[0],editor.children[1]);indent(w);q('[data-email-copy]').click();await tick();const html=await app.copied.data['text/html'].text();assert.equal((html.match(/margin-left: 32px/g)||[]).length,2);assert.match(html,/<li>Parent<ul><li>Child/);assert.doesNotMatch(html,/data-email-indent|onclick|color:red/);w.close();
});

test('selection ending at the start of the next bullet does not indent that unselected bullet',async()=>{
 const {w}=ui();await tick();const editor=w.document.querySelector('.group-email-message');editor.innerHTML='<ul><li>Parent</li><li>First</li><li>Second</li><li>After</li></ul>';
 const items=[...editor.querySelectorAll('li')];selectText(w,items[1],items[3],0,0);indent(w);assert.equal(items[1].parentElement.parentElement,items[0]);assert.equal(items[2].parentElement,items[1].parentElement);assert.equal(items[3].parentElement,items[0].parentElement);w.close();
});
test('a caret in a nested bullet outdents only that bullet, keeping following children attached',async()=>{
 const {w}=ui();await tick();const editor=w.document.querySelector('.group-email-message');editor.innerHTML='<ul><li>Parent<ul><li>First</li><li>Second</li><li>Child after</li></ul></li><li>Last</li></ul>';
 const items=[...editor.querySelectorAll('li')];selectText(w,items[2],items[2],2,2);indent(w,'outdent');assert.equal(items[2].parentElement,items[0].parentElement);assert.equal(items[1].parentElement.parentElement,items[0]);assert.equal(items[3].parentElement.parentElement,items[2]);assert.equal(w.getSelection().isCollapsed,true);w.close();
});

test('outdent after a selection ending at the next bullet does not also outdent the parent',async()=>{
 const {w}=ui();await tick();const editor=w.document.querySelector('.group-email-message');editor.innerHTML='<ul><li>Parent</li><li>First</li><li>Second</li><li>After</li></ul>';
 const items=[...editor.querySelectorAll('li')];selectText(w,items[1],items[3],0,0);indent(w);indent(w,'outdent');assert.equal(editor.children.length,1);assert.deepEqual([...editor.firstChild.children].map(el=>el.textContent),['Parent','First','Second','After']);w.close();
});

async function gmailApp(sendResponse={ok:true,status:200,json:async()=>({id:'message-sent'})}){
 const app=ui(true),{w}=app;await tick();let sends=[],rosterAllowed=true;
 w.fetch=async(url,options)=>{
   if(url.includes('userinfo'))return {ok:true,json:async()=>({email:'leader@students.bethelsd.org',verified_email:true})};
   if(url.includes('messages/send')){sends.push(options);return typeof sendResponse==='function'?sendResponse():sendResponse;}
   return {ok:rosterAllowed,json:async()=>rosterAllowed?{...records,gmailClientId:'test-client.apps.googleusercontent.com'}:{error:'Leadership access ended.'}};
 };
 w.document.querySelector('.group-email-launch').click();await tick();w.document.querySelector('[data-email-connect]').click();await tick();
 w.document.querySelector('[data-email-subject]').value='Team café 🦅';w.document.querySelector('.group-email-message').innerHTML='<div data-email-indent="1">Hello team</div><ul><li>Agenda<ul><li>Discussion</li></ul></li></ul>';
 return {app,w,sends,deny(){rosterAllowed=false;}};
}
test('Send email directly calls the connected Gmail API with UTF-8 multipart content, banner and selected recipients',async()=>{
 const {app,w,sends}=await gmailApp();const q=s=>w.document.querySelector(s);assert.match(q('[data-email-sender]').textContent,/leader@students/);assert.equal(q('[data-email-send]').disabled,false);
 q('[data-email-send]').click();q('[data-email-send]').click();await tick();assert.equal(sends.length,1);assert.equal(sends[0].headers.Authorization,'Bearer test-token');assert.equal(sends[0].credentials,'omit');
 const raw=JSON.parse(sends[0].body).raw;assert.doesNotMatch(raw,/[+/=]/);const mime=Buffer.from(raw,'base64url').toString('utf8');assert.match(mime,/From: leader@students.bethelsd.org/);assert.match(mime,/To: leader@students.bethelsd.org/);assert.doesNotMatch(mime,/member@students/);assert.match(mime,/multipart\/alternative/);
 const subject=mime.match(/Subject: ([\s\S]*?)\r\nDate:/)[1];const decoded=[...subject.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map(m=>Buffer.from(m[1],'base64').toString('utf8')).join('');assert.equal(decoded,'Team café 🦅');
 const html=Buffer.from(mime.match(/Content-Type: text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/)[1].replace(/\s/g,''),'base64').toString('utf8');assert.match(html,/nest-email-banner.png/);assert.match(html,/margin-left: 32px/);assert.match(html,/<li>Agenda<ul><li>Discussion/);
 assert.match(q('[data-email-status]').textContent,/Email sent from/);assert.equal(q('[data-email-send]').disabled,true);assert.equal(app.opened,null);w.close();
});
test('direct send rechecks leadership authorization before transmitting any email',async()=>{
 const {w,sends,deny}=await gmailApp();deny();w.document.querySelector('[data-email-send]').click();await tick();assert.equal(sends.length,0);assert.match(w.document.querySelector('[data-email-status]').textContent,/Leadership access ended/);assert.match(w.document.querySelector('.group-email-message').textContent,/Hello team/);w.close();
});
test('uncertain Gmail delivery blocks repeat sends and never resends automatically',async()=>{
 const {w,sends}=await gmailApp(()=>{throw new Error('network lost');});const send=w.document.querySelector('[data-email-send]');send.click();await tick();assert.equal(sends.length,1);assert.equal(send.disabled,true);assert.match(w.document.querySelector('[data-email-status]').textContent,/Check your Gmail Sent folder/);send.click();assert.equal(sends.length,1);w.close();
});
test('expired Gmail authorization leaves the draft and requires reconnecting',async()=>{
 const {w,sends}=await gmailApp({ok:false,status:401});w.document.querySelector('[data-email-send]').click();await tick();assert.equal(sends.length,1);assert.equal(w.document.querySelector('[data-email-send]').disabled,true);assert.match(w.document.querySelector('[data-email-status]').textContent,/Connect again/);assert.match(w.document.querySelector('.group-email-message').textContent,/Hello team/);assert.equal(w.document.querySelector('[data-email-disconnect]').hidden,true);w.close();
});
test('declined send permission and wrong-account connections cannot enable sending',async()=>{
 for(const wrongAccount of [false,true]){
  const {w}=ui(true);await tick();w.NestAuth.identity.email='leader@students.bethelsd.org';w.fetch=async url=>({ok:true,json:async()=>url.includes('userinfo')?{email:'other@students.bethelsd.org',verified_email:true}:{...records,gmailClientId:'test-client.apps.googleusercontent.com'}});
  if(!wrongAccount)w.google.accounts.oauth2.hasGrantedAllScopes=()=>false;
  w.document.querySelector('.group-email-launch').click();await tick();w.document.querySelector('[data-email-connect]').click();await tick();assert.equal(w.document.querySelector('[data-email-send]').disabled,true);assert.match(w.document.querySelector('[data-email-sender]').textContent,wrongAccount?/account you use for NEST/:/did not authorize/);w.close();
 }
});
test('NEST logout clears Gmail authorization and the composed message',async()=>{
 const {w}=await gmailApp();w.NestAuth.identity.signedIn=false;w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(w.document.querySelector('[data-email-send]').disabled,true);assert.equal(w.document.querySelector('[data-email-disconnect]').hidden,true);assert.equal(w.document.querySelector('.group-email-message').textContent,'');w.close();
});

test('an in-flight send locks editing, resists duplicate clicks and ignores a response after logout',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);const {w,sends}=await gmailApp(()=>pending);const q=s=>w.document.querySelector(s);q('[data-email-send]').click();await tick();assert.equal(sends.length,1);assert.equal(q('[data-email-subject]').disabled,true);assert.equal(q('.group-email-message').contentEditable,'false');q('[data-email-send]').click();assert.equal(sends.length,1);
 w.NestAuth.identity.signedIn=false;w.document.dispatchEvent(new w.Event('nest-auth-change'));finish({ok:true,status:200,json:async()=>({id:'message'})});await tick();assert.equal(q('[data-email-send]').disabled,true);assert.equal(q('[data-email-new]').hidden,true);assert.equal(q('.group-email-message').textContent,'');w.close();
});
test('a configured public Gmail client ID is returned only with an authorized roster',async()=>{
 const previous=process.env.EMAIL_GOOGLE_CLIENT_ID;process.env.EMAIL_GOOGLE_CLIENT_ID='email-client.apps.googleusercontent.com';
 try{const permitted=await server({status:200,roles:['Safety Officer']});assert.equal(permitted.res.data.gmailClientId,'email-client.apps.googleusercontent.com');const denied=await server({status:200,roles:[]});assert.equal(denied.res.data.gmailClientId,undefined);}
 finally{if(previous===undefined)delete process.env.EMAIL_GOOGLE_CLIENT_ID;else process.env.EMAIL_GOOGLE_CLIENT_ID=previous;}
});
