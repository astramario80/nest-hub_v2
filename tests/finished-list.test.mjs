import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import handler,{validEntry} from '../api/finished-list.mjs';

const source=fs.readFileSync('google-spinner/FinishedList.js','utf8'),script=fs.readFileSync('js/finished-list.js','utf8');
const id='15d1a8ab-0e5f-49e2-a94a-74a093d2b1f0';
const entry={requestId:id,title:'Build a story',url:'https://scratch.mit.edu/',description:'Practice sequencing and programming by making a story.'};
const hash=value=>createHash('sha256').update(value).digest('hex');
function school(){
  const properties=new Map(),store={getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value)};
  const state={leaders:[],members:new Map(),files:new Map(),writes:0,locked:false,email:'member@students.bethelsd.org',lockAvailable:true};
  const save=blob=>{state.writes++;state.files.set('list-file',blob);};
  const context=vm.createContext({console,Date,PERIODS:{1:'one',2:'two',3:'three',4:'four',5:'five',7:'seven',CTSO:'robotics'},LEADERSHIP_DATABASE:'leadership',
    Sheets:{Spreadsheets:{Values:{get:()=>({values:state.leaders})}}},email_:value=>String(value||'').trim().toLowerCase(),
    memberEmail_:(identity,period)=>identity==='manual:member'&&period==='2'?'linked@students.bethelsd.org':identity,
    rows_:period=>state.members.get(period)||[],hash_:hash,authSession_:value=>value==='valid'?{email:state.email}:null,
    PropertiesService:{getScriptProperties:()=>store},LockService:{getScriptLock:()=>({tryLock:()=>state.locked=state.lockAvailable,releaseLock:()=>state.locked=false})},
    Utilities:{newBlob:text=>text},ScriptApp:{getOAuthToken:()=> 'test-token'},trackerFolder_:()=> 'folder',
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>state.files.get('list-file')})},
    Drive:{Files:{create:(_meta,blob)=>{assert.equal(state.locked,true);save(blob);return {id:'list-file'};},update:(_meta,_id,blob)=>{assert.equal(state.locked,true);save(blob);}}}
  });
  vm.runInContext(source,context);
  const role=(position,period='2',email=state.email)=>{state.leaders=[[period,'',position,'',email]];state.members.set(period,[['Member',email]]);};
  const call=request=>JSON.parse(JSON.stringify(context.finishedDispatch_(request)));
  return {state,role,call,allowed:identity=>context.finishedAllowed_(identity)};
}

test('only the requested current positions may add; ownership alone grants no access',()=>{
  const app=school();
  for(const [role,period] of [['Software Technician','2'],['Software Technician','CTSO'],['Division Manager','2'],['Assistant Manager','7'],['Chief Executive Officer','CTSO'],['Chief Financial Officer','CTSO'],['Chief Operations Officer','CTSO'],['Chief Operations Officers','CTSO'],['Chief Operating Officer','CTSO']]){
    app.role(role,period);assert.equal(app.allowed(app.state.email),true,role);
  }
  for(const [role,period] of [['Student','2'],['Software Technician','Advisory'],['Partner Liaison','2'],['Fabrication Supervisor','2'],['Executive Vice-President','CTSO'],['Chief Executive Officer','2'],['Chief Financial Officer','2'],['Chief Operations Officer','2'],['Division Manager','CTSO'],['Assistant Manager','CTSO']]){
    app.role(role,period);assert.equal(app.allowed(app.state.email),false,role+' '+period);
  }
  app.state.leaders=[];assert.equal(app.allowed('mpenalver@bethelsd.org'),false);
  app.role('Software Technician');app.state.members.clear();assert.equal(app.allowed(app.state.email),false);
});

test('linked manual accounts use the matching current member email and division',()=>{
  const app=school();app.role('Software Technician','2','linked@students.bethelsd.org');
  assert.equal(app.allowed('manual:member'),true);
  app.role('Software Technician','1','linked@students.bethelsd.org');assert.equal(app.allowed('manual:member'),false);
});

test('all 17 original activities survive migration, including project ideas without links',()=>{
  const app=school(),result=app.call({action:'finished-list-view'});
  assert.equal(result.entries.length,17);assert.equal(result.canAdd,false);assert.equal(app.state.writes,0);
  assert.equal(result.entries.filter(e=>!e.url).length,3);
  assert.equal(result.entries.find(e=>e.title==='Scratch game design').url,'https://scratch.mit.edu/');
  assert.match(result.entries.find(e=>e.title==='Create a documentary').instructions,/Mockumentary/);
  assert.equal(result.entries.find(e=>e.title==='Animated storytelling tutorial').url,'https://www.iorad.com/player/123331/GO-ANIMATE#trysteps-1');
  assert.equal(result.entries.every(e=>e.description&&e.instructions),true);
});

test('authorized additions persist alongside originals and retries cannot duplicate a resource',()=>{
  const app=school();app.role('Software Technician');
  const result=app.call({action:'auth-finished-list-add',session:'valid',...entry});
  assert.equal(result.entries.length,18);assert.equal(app.state.writes,1);assert.equal(app.state.locked,false);
  assert.equal(result.entries.at(-1).title,entry.title);assert.equal(JSON.stringify(result).includes('actor'),false);
  assert.equal(app.call({action:'auth-finished-list-add',session:'valid',...entry}).entries.length,18);assert.equal(app.state.writes,1);
  assert.equal(app.call({action:'auth-finished-list-add',session:'valid',...entry,title:'Different'}).status,409);
  const next={...entry,requestId:'25d1a8ab-0e5f-49e2-a94a-74a093d2b1f0'};
  assert.equal(app.call({action:'auth-finished-list-add',session:'valid',...next}).entries.length,19);assert.equal(app.state.writes,2);
  assert.equal(app.call({action:'finished-list-view'}).entries.length,19);
});

test('every add rechecks sessions, live roles and membership; denied requests never write',()=>{
  const app=school();app.role('Division Manager');
  assert.equal(app.call({action:'finished-list-view',session:'valid'}).canAdd,true);
  app.state.leaders=[];
  assert.equal(app.call({action:'auth-finished-list-add',session:'valid',...entry,canAdd:true}).status,403);
  app.role('Division Manager');app.state.members.clear();assert.equal(app.call({action:'auth-finished-list-add',session:'valid',...entry}).status,403);
  assert.equal(app.call({action:'auth-finished-list-add',session:'expired',...entry}).status,401);
  app.state.lockAvailable=false;assert.equal(app.call({action:'auth-finished-list-add',session:'valid',...entry}).status,503);
  assert.equal(app.state.writes,0);
});

test('both servers reject script URLs, credentials, missing fields, and oversized entries',()=>{
  const app=school();app.role('Software Technician');
  for(const change of [{url:'javascript:alert(1)'},{url:'data:text/html,test'},{url:'https://user:pass@example.org/'},{url:'https://example.org/\nnext'},{title:' '},{description:''},{requestId:'not-an-id'},{description:'a'.repeat(1501)},{url:'https://example.org/'+ 'a'.repeat(2000)}]){
    const value={...entry,...change};assert.equal(validEntry(value),false,JSON.stringify(change).slice(0,80));
    assert.equal(app.call({action:'auth-finished-list-add',session:'valid',...value}).status,400);
  }
  assert.equal(app.state.writes,0);
});

const response=()=>({setHeader(name,value){(this.headers||={})[name]=value;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
const headers={origin:'https://gknest.org','content-type':'application/json',cookie:'__Host-nest-auth='+'a'.repeat(64)};
test('API rejects unsigned and cross-site writes before contacting the school bridge',async()=>{
  for(const [request,code] of [[{method:'POST',headers:{...headers,cookie:''},body:entry},401],[{method:'POST',headers:{...headers,origin:'https://evil.example'},body:entry},403],[{method:'POST',headers,body:{...entry,url:'javascript:alert(1)'}},400]]){
    const res=response();await handler(request,res);assert.equal(res.code,code);
  }
});

test('API sends only allowed fields and projects safe public data with private no-store caching',async()=>{
  const old=globalThis.fetch,previous={url:process.env.SPINNER_BRIDGE_URL,token:process.env.SPINNER_BRIDGE_TOKEN};
  process.env.SPINNER_BRIDGE_URL='https://script.google.com/test';process.env.SPINNER_BRIDGE_TOKEN='test';let payload;
  globalThis.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({status:200,canAdd:true,entries:[{id,title:entry.title,url:entry.url,description:entry.description,actor:'secret',email:'private@example.org'}]})};};
  try{
    const res=response();await handler({method:'POST',headers,body:{...entry,canAdd:true,actor:'spoof'}},res);
    assert.equal(res.code,200);assert.equal(payload.canAdd,undefined);assert.equal(payload.actor,undefined);assert.equal(payload.action,'auth-finished-list-add');
    assert.equal(JSON.stringify(res.data).includes('secret'),false);assert.equal(JSON.stringify(res.data).includes('private@example'),false);
    assert.match(res.headers['Cache-Control'],/no-store/);assert.equal(res.headers.Vary,'Cookie');
    const publicRes=response();await handler({method:'GET',headers:{}},publicRes);assert.equal(publicRes.data.canAdd,false);
  }finally{globalThis.fetch=old;for(const [key,value] of [['SPINNER_BRIDGE_URL',previous.url],['SPINNER_BRIDGE_TOKEN',previous.token]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
function website(fetch,identity={username:'editor'}){
  const dom=new JSDOM(fs.readFileSync('finished-list.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/finished-list'}),w=dom.window;
  w.AbortSignal=AbortSignal;w.NestAuth={identity,ready:Promise.resolve(),open(){}};w.fetch=fetch;w.eval(script);
  return {w,q:selector=>w.document.querySelector(selector)};
}
test('list is searchable, renders HTML as text, and exposes additions only to authorized users',async()=>{
  const entries=[{id:'one',title:'<img src=x onerror=alert(1)>',url:'https://scratch.mit.edu/',description:'Learn coding',instructions:'Original task'},{id:'two',title:'Documentary',url:'',description:'Learn storytelling'}];
  const {w,q}=website(async()=>({ok:true,json:async()=>({entries,canAdd:false})}),null);
  try{
    await tick();assert.equal(q('#finished-add').hidden,true);assert.equal(q('#finished-signin').hidden,false);assert.equal(q('.finished-card img'),null);
    assert.equal(w.document.querySelectorAll('.finished-card').length,2);
    q('#finished-search').value='storytelling';q('#finished-search').dispatchEvent(new w.Event('input'));
    assert.equal(w.document.querySelectorAll('.finished-card').length,1);assert.equal(q('.finished-card h3').textContent,'Documentary');
  }finally{w.close();}
});

test('a failed add keeps its draft and retry ID, then shows the persisted resource exactly once',async()=>{
  const writes=[];let fail=true;const entries=[];
  const {w,q}=website(async(_url,options)=>{
    if(options.method==='POST'){
      const body=JSON.parse(options.body);writes.push(body);
      if(fail){fail=false;return {ok:false,status:503,json:async()=>({error:'Please retry'})};}
      entries.push({id:body.requestId,...body});
    }
    return {ok:true,json:async()=>({entries:structuredClone(entries),canAdd:true})};
  });
  try{
    await tick();assert.equal(q('#finished-add').hidden,false);
    const form=q('form');form.elements.title.value=entry.title;form.elements.url.value=entry.url;form.elements.description.value=entry.description;
    form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(form.elements.title.value,entry.title);
    form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(writes[0].requestId,writes[1].requestId);
    assert.equal(form.elements.title.value,'');assert.equal(w.document.querySelectorAll('.finished-card').length,1);assert.match(q('#finished-status').textContent,/was added/);
    w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(q('#finished-add').hidden,true);
  }finally{w.close();}
});
