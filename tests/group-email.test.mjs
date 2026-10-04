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
function ui(){
 const dom=new JSDOM(renderDivisionPage('2',{manager:{},leaders:[],canManage:false}),{runScripts:'outside-only',url:'https://gknest.org/divisions/2#lookup'}),w=dom.window;
 w.AbortSignal=AbortSignal;w.Blob=Blob;w.NestAuth={identity:{signedIn:true},ready:Promise.resolve()};w.NestDivisionHQ={allowed:true,active:"lookup"};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let copied=null,opened=null;w.ClipboardItem=class{constructor(data){this.data=data;}};
 Object.defineProperty(w.navigator,'clipboard',{value:{write:async items=>copied=items[0]}});w.open=url=>opened={location:{href:url}};
 w.fetch=async()=>({ok:true,json:async()=>records});w.eval(fs.readFileSync('js/group-email.js','utf8'));
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
