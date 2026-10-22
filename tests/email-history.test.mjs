import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import handler from '../api/group-email-history.mjs';
import {emailSenderKey} from '../lib/postmark-email.mjs';
const requestId='c'.repeat(64),id='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
const sender='manager@students.bethelsd.org',email='member@students.bethelsd.org';
function response(){return {setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};}
async function api(options={}){
 const oldFetch=globalThis.fetch,env={...process.env};Object.assign(process.env,{SPINNER_BRIDGE_URL:'https://school.invalid',SPINNER_BRIDGE_TOKEN:'private-bridge',POSTMARK_SERVER_TOKEN:'private-postmark'});
 const actor=emailSenderKey(sender),calls=[];
 const metadata={nestActor:actor,nestRequestId:requestId,nestSelectedCount:'2',nestTesting:'false'};
 const message={MessageID:id,Metadata:metadata,Tag:'nest-'+requestId,Recipients:[email],Subject:'Meeting',ReceivedAt:'2026-10-22T17:00:00Z',TrackOpens:true};
 const messages=[message,{...message,MessageID:second,Recipients:['other@students.bethelsd.org']}];
 globalThis.fetch=async(url,init)=>{
  if(url==='https://school.invalid')return new Response(JSON.stringify(options.expired?{status:401}:{status:200,email:sender}));
  calls.push(String(url));const path=new URL(url).pathname;
  if(path==='/messages/outbound')return new Response(JSON.stringify({Messages:options.foreign?[{...message,Metadata:{...metadata,nestActor:'different-account'}}]:options.empty?[]:messages,TotalCount:options.empty?0:2}));
  if(path.endsWith('/details'))return new Response(JSON.stringify({...message,...(options.foreignDetail?{Metadata:{...metadata,nestActor:'different-account'}}:{}),HtmlBody:'<div><img src="https://tracking.invalid/pixel"><!-- NEST_MESSAGE_START --><h2>Original message</h2><script>bad()</script><!-- NEST_MESSAGE_END --><p>Footer</p></div>'}));
  if(path==='/messages/outbound/opens')return new Response(JSON.stringify({TotalCount:3,Opens:[{MessageID:id,Recipient:email,ReceivedAt:'2026-10-22T17:01:00Z',Geo:{IP:'private-ip'}},{MessageID:id,Recipient:email,ReceivedAt:'2026-10-22T17:02:00Z'},{MessageID:'unknown',Recipient:'foreign@students.bethelsd.org',ReceivedAt:'2026-10-22T17:00:00Z'}]}));
  throw new Error('Unexpected Postmark route');
 };
 try{const res=response();await handler({method:'GET',headers:{cookie:'__Host-nest-auth='+'a'.repeat(64)},query:options.list?{}:{requestId,...options.query}},res);return {res,calls,actor};}
 finally{globalThis.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
}
test('history computes unique recipient open rates, retains first observed open and returns sanitized original content',async()=>{
 const {res,calls,actor}=await api();assert.equal(res.code,200);assert.equal(res.data.openRate,50);assert.equal(res.data.observedOpens,1);assert.equal(res.data.accepted,2);assert.equal(res.data.recipients[0].openedAt,'2026-10-22T17:01:00Z');assert.equal(res.data.recipients[1].openedAt,null);assert.match(res.data.html,/<h2>Original message/);assert.doesNotMatch(res.data.html,/tracking|<script|Footer/);assert.doesNotMatch(JSON.stringify(res.data),/private-ip|private-postmark|nestActor|MessageID/);assert.ok(calls.find(c=>new URL(c).searchParams.get('metadata_nestActor')===actor));
});
test('history ignores browser-supplied actor selectors and refuses foreign provider messages or details',async()=>{
 for(const option of [{foreign:true},{foreignDetail:true}]){const {res}=await api(option);assert.equal(res.code,503);assert.equal(res.data.html,undefined);assert.equal(res.data.messages,undefined);}
 const {calls,actor}=await api({query:{actor:'someone-else'}});assert.equal(new URL(calls[0]).searchParams.get('metadata_nestActor'),actor);
});
test('history returns only sender-scoped grouped messages and handles expiry, unknown IDs and invalid request IDs',async()=>{
 const list=await api({list:true});assert.equal(list.res.data.messages.length,1);assert.equal(list.res.data.messages[0].requestId,requestId);assert.equal(list.res.data.retentionDays,45);assert.equal(list.res.data.messages[0].html,undefined);
 assert.equal((await api({expired:true})).res.code,401);assert.equal((await api({empty:true})).res.code,404);assert.equal((await api({query:{requestId:'../someone'}})).res.code,400);
 const res=response();await handler({method:'GET',headers:{},query:{}},res);assert.equal(res.code,401);
});
function historyUI(fetcher){
 const dom=new JSDOM('<div data-hq-communications><section class="group-email-inline"><textarea>Draft stays here</textarea></section></div>',{url:'https://gknest.org/divisions/2',runScripts:'outside-only'}),w=dom.window;
 w.NestAuth={identity:{signedIn:true}};w.NestDivisionHQ={allowed:true};w.AbortSignal=AbortSignal;w.fetch=fetcher;
 w.eval(fs.readFileSync('js/group-email-history.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));return w;
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
test('Sent history keeps the compose draft, shows observed opens and uses a sandboxed preview without remote images',async()=>{
 const w=historyUI(async url=>({ok:true,json:async()=>url.includes('requestId=')?{subject:'Team <script>',sentAt:'2026-10-22T17:00:00Z',tracking:true,openRate:50,observedOpens:1,accepted:2,selected:2,recipients:[{email,openedAt:'2026-10-22T17:01:00Z'},{email:'other@students.bethelsd.org',openedAt:null}],html:'<h2>Original message</h2>'}:{messages:[{requestId,subject:'Team <script>',sentAt:'2026-10-22T17:00:00Z'}],hasMore:false,nextOffset:2}}));
 try{w.document.getElementById('email-history-tab').click();await tick();assert.equal(w.document.querySelector('.group-email-inline').hidden,true);w.document.querySelector('.email-history-item').click();await tick();assert.match(w.document.querySelector('.email-history-metrics').textContent,/50%/);assert.match(w.document.querySelector('.email-history-recipients').textContent,/No open detected/);const frame=w.document.querySelector('iframe');assert.equal(frame.getAttribute('sandbox'),'');assert.match(frame.srcdoc,/img-src 'none'/);assert.equal(w.document.querySelector('script'),null);w.document.dispatchEvent(new w.CustomEvent('nest-hq-tab-change',{detail:{tab:'lookup'}}));assert.equal(w.document.getElementById('email-history-tab').getAttribute('aria-selected'),'true');w.document.dispatchEvent(new w.CustomEvent('nest-hq-tab-change',{detail:{tab:'communications'}}));assert.equal(w.document.getElementById('email-compose-tab').getAttribute('aria-selected'),'true');assert.equal(w.document.querySelector('.group-email-inline').hidden,false);assert.equal(w.document.getElementById('email-history-panel').hidden,true);assert.equal(w.document.querySelector('textarea').value,'Draft stays here');}finally{w.close();}
});
test('logout clears history and a late response cannot expose the previous sender’s messages',async()=>{
 let settle;const w=historyUI(()=>new Promise(resolve=>settle=resolve));
 try{w.document.getElementById('email-history-tab').click();w.NestAuth.identity={signedIn:false};w.document.dispatchEvent(new w.Event('nest-auth-change'));settle({ok:true,json:async()=>({messages:[{requestId,subject:'Private old account',sentAt:'2026-10-22T17:00:00Z'}],hasMore:false})});await tick();assert.equal(w.document.querySelector('[data-history-list]').textContent,'');assert.equal(w.document.querySelector('[data-history-detail]').textContent,'');}finally{w.close();}
});
test('failed detail reads offer a retry that recovers the selected message',async()=>{
 let attempts=0;
 const w=historyUI(async url=>({ok:!url.includes('requestId=')||++attempts>1,json:async()=>!url.includes('requestId=')?{messages:[{requestId,subject:'Meeting',sentAt:'2026-10-22T17:00:00Z'}],hasMore:false,nextOffset:1}:attempts===1?{error:'Your email history could not load. Please try again.'}:{subject:'Meeting',sentAt:'2026-10-22T17:00:00Z',tracking:true,openRate:0,observedOpens:0,accepted:1,selected:1,recipients:[{email,openedAt:null}],html:'<p>Original message</p>'}}));
 try{w.document.getElementById('email-history-tab').click();await tick();w.document.querySelector('.email-history-item').click();await tick();const detail=w.document.querySelector('[data-history-detail]');assert.match(detail.textContent,/could not load/);detail.querySelector('button').click();await tick();assert.equal(attempts,2);assert.ok(detail.querySelector('iframe'));}finally{w.close();}
});
