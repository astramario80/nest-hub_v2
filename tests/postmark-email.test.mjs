import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import handler from '../api/group-email-send.mjs';
import {emailContent,postmarkMessages,submitPostmark} from '../lib/postmark-email.mjs';
const replyTo='manager@students.bethelsd.org',recipient='member@students.bethelsd.org';
const body=()=>({period:'2',audience:'division',recipients:[recipient],subject:'Meeting',html:'<p>Hello team</p>',requestId:'a'.repeat(64),testing:false});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.data=data;return this;}};}
async function api(change={},requestChange={}){
 const env={...process.env},old=globalThis.fetch,calls=[],messages=[];
 Object.assign(process.env,{SPINNER_BRIDGE_URL:'https://bridge.invalid',SPINNER_BRIDGE_TOKEN:'bridge-token',POSTMARK_SERVER_TOKEN:'private-server-token',POSTMARK_FROM_EMAIL:'communications@gknest.org',NEST_EMAIL_ENABLED:'true'});
 globalThis.fetch=async(url,options)=>{
  const value=JSON.parse(options.body);
  if(url==='https://api.postmarkapp.com/email/batch'){
   messages.push(...value);if(change.lostResponse)throw new Error('Lost provider response');
   return new Response(JSON.stringify(change.provider||value.map(m=>({To:m.To,ErrorCode:0,MessageID:'accepted-id'}))));
  }
  calls.push(value);
  let data=value.action==='auth-group-email-access'?{status:200,period:value.period,audience:value.audience,divisions:['2'],accessPeriod:'2',members:[{email:recipient,name:'Member',...(value.audience==='nest'?{divisions:['2','3']}:{} )}],leaders:[]}:value.action==='auth-me'?{status:200,email:replyTo}:value.action==='auth-division-slides'?{status:200,canManage:true}:value.action==='auth-leadership-directory'?{status:200,leaders:[]}:value.action==='tracker'?{status:200,period:'2',students:[{email:recipient,name:'Member'}]}:value.operation==='reserve'?{status:200,replyTo,lease:'lease'}:{status:200};
  if(change.accessDenied&&value.action==='auth-group-email-access')data={status:403};
  if(change.duplicate&&value.operation==='reserve')data={status:200,duplicate:true,state:'pending'};
  if(change.finishFailed&&value.operation==='finish')throw new Error('Journal unavailable');
  if(change.rateLimited&&value.operation==='reserve')data={status:429};
  return new Response(JSON.stringify(data));
 };
 try{const res=response();await handler({method:'POST',query:{},headers:{origin:'https://gknest.org',host:'gknest.org','content-type':'application/json',cookie:'__Host-nest-auth='+'b'.repeat(64)},body:{...body(),...change.body},...requestChange},res);return {res,calls,messages};}
 finally{globalThis.fetch=old;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
}
test('server sends separate private emails from NEST with authoritative Reply-To and no browser credentials',async()=>{
 const {res,messages,calls}=await api({body:{from:'spoof@bad.invalid',replyTo:'spoof@bad.invalid'}});
 assert.equal(res.data.state,'accepted');assert.equal(messages.length,1);assert.match(messages[0].From,/communications@gknest.org/);assert.equal(messages[0].ReplyTo,replyTo);assert.equal(messages[0].To,recipient);assert.equal(messages[0].TrackOpens,true);assert.equal(messages[0].TrackLinks,'None');assert.match(messages[0].HtmlBody,/nest-email-banner/);assert.doesNotMatch(JSON.stringify(res.data),/token|lease|manager@/);assert.ok(calls.find(c=>c.operation==='reserve'));assert.ok(calls.find(c=>c.operation==='finish'));
});
test('self-test ignores browser recipients and sends only to the verified linked account',async()=>{
 const {res,messages}=await api({body:{testing:true,recipients:[]}});assert.equal(res.data.state,'accepted');assert.equal(messages[0].To,replyTo);assert.match(messages[0].Subject,/^\[TEST\]/);
});
test('access revocation, unselected recipients, foreign origins and quota rejection prevent provider calls',async()=>{
 for(const [change,request,code] of [[{accessDenied:true},{},403],[{body:{recipients:['outsider@students.bethelsd.org']}},{},403],[{}, {headers:{origin:'https://evil.invalid'}},403],[{rateLimited:true},{},429]]){
  const {res,messages}=await api(change,request);assert.equal(res.code,code);assert.equal(messages.length,0);
 }
});
test('header injection, malformed scope, oversized HTML and excessive recipient lists fail before reservation',async()=>{
 for(const data of [{subject:'Hello\r\nBcc: victim@example.com'},{period:'__proto__'},{audience:'leadership'},{html:'x'.repeat(60001)},{recipients:Array(301).fill(recipient)}]){
  const {res,calls,messages}=await api({body:data});assert.equal(res.code,400);assert.equal(messages.length,0);assert.equal(calls.filter(c=>c.operation==='reserve').length,0);
 }
});
test('duplicate reservation never reaches Postmark; lost provider or journal acknowledgement never retries',async()=>{
 const duplicate=await api({duplicate:true});assert.equal(duplicate.messages.length,0);assert.equal(duplicate.res.data.state,'pending');
 for(const config of [{lostResponse:true},{finishFailed:true}]){const result=await api(config);assert.equal(result.res.data.state,'unknown');assert.equal(result.messages.length,1);}
});
test('batch response checks per-recipient rejection even with HTTP 200',async()=>{
 const rejected=await api({provider:[{To:recipient,ErrorCode:406,Message:'Inactive recipient'}]});assert.equal(rejected.res.data.state,'rejected');
 const malformed=await api({provider:[{To:'wrong@example.com',ErrorCode:0,MessageID:'id'}]});assert.equal(malformed.res.data.state,'unknown');
});
test('server sanitizer strips active content, tracking images and CSS URLs while preserving safe formatting',()=>{
 const content=emailContent('<h2 onclick="bad()" style="text-align:center;position:fixed">Hi</h2><p style="margin-left:64px;color:#123456;background-image:url(https://bad.invalid)"><u>Text</u><a href="javascript:bad()">bad</a><img src="https://bad.invalid"><iframe>hidden</iframe><script>private()</script></p>');
 assert.match(content.html,/<u>Text/);assert.match(content.html,/text-align:center/);assert.doesNotMatch(content.html,/onclick|javascript|bad.invalid|position|<img|iframe|private/);assert.doesNotMatch(content.text,/hidden|private/);
});
function journal(){
 let now=2000000000000;const values=new Map();let locked=false;
 const store={getProperty:k=>values.get(k)||null,setProperty(k,v){values.set(k,v);},deleteProperty:k=>values.delete(k),getProperties:()=>Object.fromEntries(values)};
 const ctx=vm.createContext({Date:class extends Date{static now(){return now;}},PropertiesService:{getScriptProperties:()=>store},authSession_:s=>s==='session'?{email:replyTo}:null,hash_:v=>createHash('sha256').update(v).digest('hex'),LockService:{getScriptLock:()=>({tryLock:()=>{assert.equal(locked,false);locked=true;return true;},releaseLock:()=>{locked=false;}})},Utilities:{getUuid:()=> 'lease'},accountByEmail_:()=>({}),memberEmail_:email=>email,districtEmail_:email=>email,OWNER_EMAILS:[],PERIODS:{'2':'id'}});
 vm.runInContext(fs.readFileSync('google-spinner/GroupEmail.js','utf8'),ctx);
 return {call:changes=>ctx.groupEmailDispatch_({session:'session',operation:'reserve',requestId:'a'.repeat(64),fingerprint:'b'.repeat(64),count:2,period:'2',...changes}),values,advance:ms=>now+=ms};
}
test('durable journal blocks repeated requests and identical content under a different request ID',()=>{
 const j=journal();const first=j.call();assert.equal(first.lease,'lease');assert.equal(j.call().duplicate,true);assert.equal(j.call({requestId:'c'.repeat(64)}).duplicate,true);assert.equal(j.call({fingerprint:'c'.repeat(64)}).status,409);
 assert.equal(j.call({operation:'finish',lease:'wrong',state:'accepted',accepted:2,rejected:0}).status,400);
 assert.equal(j.call({operation:'finish',lease:'lease',state:'accepted',accepted:2,rejected:0}).status,200);assert.equal(j.call().state,'accepted');assert.doesNotMatch(JSON.stringify([...j.values]),/Hello|Meeting|@/);
});
test('journal rate limits parallel new messages and requires a valid session',()=>{
 const j=journal();j.call();assert.equal(j.call({requestId:'c'.repeat(64),fingerprint:'d'.repeat(64)}).status,429);assert.equal(j.call({session:'expired'}).status,401);j.advance(31000);assert.equal(j.call({requestId:'c'.repeat(64),fingerprint:'d'.repeat(64)}).status,200);
});

test('NEST-wide selections revalidate membership and reserve against the sender’s authorized division',async()=>{
 const {res,calls,messages}=await api({body:{period:'all',audience:'nest'}});assert.equal(res.data.state,'accepted');assert.equal(messages[0].To,recipient);assert.equal(calls.find(c=>c.operation==='reserve').period,'2');
 const denied=await api({body:{period:'all',audience:'nest',recipients:['outsider@students.bethelsd.org']}});assert.equal(denied.res.code,403);assert.equal(denied.messages.length,0);
});
