import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import handler,{validEntry,validIcon} from '../api/finished-list.mjs';

const source=fs.readFileSync('google-spinner/FinishedList.js','utf8'),script=fs.readFileSync('js/finished-list.js','utf8');
const id='15d1a8ab-0e5f-49e2-a94a-74a093d2b1f0';
const skills=['Think Creatively','Create Media','Communicate Clearly','Solve Problems'];
const entry={skills:['Think Creatively'],icon:'',requestId:id,title:'Build a story',url:'https://scratch.mit.edu/',description:'Practice sequencing and programming by making a story.'};
const hash=value=>createHash('sha256').update(value).digest('hex');
function school(){
  const properties=new Map(),store={getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value)};
  const state={leaders:[],members:new Map(),files:new Map(),writes:0,locked:false,email:'member@students.bethelsd.org',lockAvailable:true};
  const save=blob=>{state.writes++;state.files.set('list-file',blob);};
  const context=vm.createContext({console,Date,PERIODS:{1:'one',2:'two',3:'three',4:'four',5:'five',7:'seven',CTSO:'robotics'},LEADERSHIP_DATABASE:'leadership',NEST_DATABASE:'database',OWNER_EMAILS:['mpenalver@bethelsd.org'],
    Sheets:{Spreadsheets:{Values:{get:(_id,range)=>({values:range.includes('!R2:')?skills.map(skill=>[skill]):state.leaders})}}},email_:value=>String(value||'').trim().toLowerCase(),
    memberEmail_:(identity,period)=>identity==='manual:member'&&period==='2'?'linked@students.bethelsd.org':identity,
    rows_:period=>state.members.get(period)||[],hash_:hash,authSession_:value=>value==='valid'?{email:state.email}:null,
    PropertiesService:{getScriptProperties:()=>store},LockService:{getScriptLock:()=>({tryLock:()=>state.locked=state.lockAvailable,releaseLock:()=>state.locked=false})},
    Utilities:{newBlob:text=>text,base64Decode:value=>[...Buffer.from(value,'base64')]},ScriptApp:{getOAuthToken:()=> 'test-token'},trackerFolder_:()=> 'folder',
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>state.files.get('list-file')})},
    Drive:{Files:{create:(_meta,blob)=>{assert.equal(state.locked,true);save(blob);return {id:'list-file'};},update:(_meta,_id,blob)=>{assert.equal(state.locked,true);save(blob);}}}
  });
  vm.runInContext(source,context);
  const role=(position,period='2',email=state.email)=>{state.leaders=[[period,'',position,'',email]];state.members.set(period,[['Member',email]]);};
  const call=request=>JSON.parse(JSON.stringify(context.finishedDispatch_(request)));
  return {state,role,call,allowed:identity=>context.finishedAllowed_(identity)};
}

test('the supervisor and requested current positions may edit; unrelated roles stay denied',()=>{
  const app=school();
  for(const [role,period] of [['Software Technician','2'],['Software Technician','CTSO'],['Division Manager','2'],['Assistant Manager','7'],['Chief Executive Officer','CTSO'],['Chief Financial Officer','CTSO'],['Chief Operations Officer','CTSO'],['Chief Operations Officers','CTSO'],['Chief Operating Officer','CTSO']]){
    app.role(role,period);assert.equal(app.allowed(app.state.email),true,role);
  }
  for(const [role,period] of [['Student','2'],['Software Technician','Advisory'],['Partner Liaison','2'],['Fabrication Supervisor','2'],['Executive Vice-President','CTSO'],['Chief Executive Officer','2'],['Chief Financial Officer','2'],['Chief Operations Officer','2'],['Division Manager','CTSO'],['Assistant Manager','CTSO']]){
    app.role(role,period);assert.equal(app.allowed(app.state.email),false,role+' '+period);
  }
  app.state.leaders=[];assert.equal(app.allowed('mpenalver@bethelsd.org'),true);
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
  globalThis.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({status:200,canAdd:true,canEdit:true,skills,entries:[{id,title:entry.title,url:entry.url,description:entry.description,icon:'',skills:entry.skills,version:1,actor:'secret',email:'private@example.org'}]})};};
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
    return {ok:true,json:async()=>({entries:structuredClone(entries),canAdd:true,canEdit:true,skills})};
  });
  try{
    await tick();assert.equal(q('#finished-add').hidden,false);
    const form=q('form');form.elements.title.value=entry.title;form.elements.url.value=entry.url;form.elements.description.value=entry.description;q('#finished-skills input').checked=true;
    form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(form.elements.title.value,entry.title);
    form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(writes[0].requestId,writes[1].requestId);
    assert.equal(form.elements.title.value,'');assert.equal(w.document.querySelectorAll('.finished-card').length,1);assert.match(q('#finished-status').textContent,/was added/);
    w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(q('#finished-add').hidden,true);
  }finally{w.close();}
});

test('supervisor updates existing activities, preserves instructions, and rejects stale or changed retries',()=>{
 const app=school();app.state.email='mpenalver@bethelsd.org';
 const before=app.call({action:'finished-list-view',session:'valid'});assert.equal(before.canEdit,true);
 const original=before.entries.find(e=>e.id==='original-9');
 const update={...entry,action:'auth-finished-list-update',session:'valid',id:original.id,version:1,title:original.title,url:original.url,description:original.description,skills:['Think Creatively','Create Media'],icon:'/assets/finished-list/pixton.svg'};
 const saved=app.call(update);assert.equal(saved.status,200);const after=saved.entries.find(e=>e.id===original.id);assert.equal(after.version,2);assert.equal(after.instructions,original.instructions);assert.deepEqual(after.skills,update.skills);assert.equal(after.icon,update.icon);assert.equal(saved.entries.length,17);
 assert.equal(app.call(update).status,200);assert.equal(app.state.writes,1);
 assert.equal(app.call({...update,title:'Changed retry'}).status,409);
 assert.equal(app.call({...update,requestId:'25d1a8ab-0e5f-49e2-a94a-74a093d2b1f0'}).status,409);assert.equal(app.state.writes,1);
 app.state.email='member@students.bethelsd.org';assert.equal(app.call({...update,version:2}).status,403);assert.equal(app.state.writes,1);
});

test('old persisted resources gain defaults without overwriting custom descriptions or chosen tags',()=>{
 const app=school();app.role('Software Technician');app.call({action:'auth-finished-list-add',session:'valid',...entry});
 const state=JSON.parse(app.state.files.get('list-file')),pixton=state.entries.find(e=>e.id==='original-9');delete pixton.skills;delete pixton.icon;delete pixton.version;pixton.description='Teacher-specific purpose';app.state.files.set('list-file',JSON.stringify(state));
 let restored=app.call({action:'finished-list-view'}).entries.find(e=>e.id===pixton.id);assert.equal(restored.description,'Teacher-specific purpose');assert.ok(restored.skills.includes('Think Creatively'));assert.equal(restored.icon,'/assets/finished-list/pixton.svg');assert.equal(restored.version,1);
 pixton.skills=['Communicate Clearly'];pixton.icon='';app.state.files.set('list-file',JSON.stringify(state));restored=app.call({action:'finished-list-view'}).entries.find(e=>e.id===pixton.id);assert.deepEqual(restored.skills,['Communicate Clearly']);assert.equal(restored.icon,'');
});

test('skills must come from the live database and existing offline project ideas stay editable',()=>{
 const app=school();app.state.email='mpenalver@bethelsd.org';
 for(const chosen of [[],['Not in the database'],['Think Creatively','Think Creatively']])assert.equal(app.call({action:'auth-finished-list-add',session:'valid',...entry,skills:chosen}).status,400);
 const original=app.call({action:'finished-list-view'}).entries.find(e=>e.id==='original-6');
 const update={...entry,action:'auth-finished-list-update',session:'valid',id:original.id,version:1,url:'',title:original.title};assert.equal(app.call(update).status,200);
 assert.equal(app.call({...entry,action:'auth-finished-list-add',session:'valid',url:''}).status,400);
 assert.equal(app.call({...update,id:'original-9'}).status,400);
});

test('icon validation accepts bounded raster uploads and local assets while rejecting SVG uploads and external URLs',()=>{
 const app=school();app.role('Software Technician');
 const png='data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64');
 const webp='data:image/webp;base64,'+Buffer.from('RIFF0000WEBPVP8 ').toString('base64');
 for(const icon of [png,webp,'/assets/finished-list/pixton.svg']){assert.equal(validIcon(icon),true);assert.equal(app.call({...entry,requestId:crypto.randomUUID(),action:'auth-finished-list-add',session:'valid',icon}).status,200);}
 for(const icon of ['https://example.org/logo.png','data:image/svg+xml;base64,'+Buffer.from('<svg onload="alert(1)"/>').toString('base64'),'data:image/png;base64,'+Buffer.from('not really an image').toString('base64'),'/assets/finished-list/../../secret.svg',png+'A'.repeat(45000)]){
  assert.equal(validIcon(icon),false);assert.equal(validEntry({...entry,icon}),false);assert.equal(app.call({...entry,action:'auth-finished-list-add',session:'valid',icon}).status,400);
 }
});

test('skills are both searchable text and independently selectable categories',async()=>{
 const entries=[{id:'one',title:'Pixton',url:'https://www.pixton.com/',description:'Make comics',skills:['Think Creatively','Create Media'],icon:'/assets/finished-list/pixton.svg',version:1},{id:'two',title:'Chess',url:'',description:'Plan ahead',skills:['Solve Problems'],version:1}];
 const {w,q}=website(async()=>({ok:true,json:async()=>({entries,skills,canAdd:false,canEdit:false})}));
 try{
  await tick();assert.equal(q('.finished-card img').getAttribute('src'),'/assets/finished-list/pixton.svg');
  q('#finished-search').value='think creatively';q('#finished-search').dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelectorAll('.finished-card').length,1);assert.equal(q('.finished-card h3').textContent,'Pixton');
  q('#finished-search').value='';q('#finished-search').dispatchEvent(new w.Event('input'));q('#finished-skill-filter').value='Create Media';q('#finished-skill-filter').dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelectorAll('.finished-card').length,1);assert.match(q('#finished-category-title').textContent,/Create Media/);
  assert.equal(q('.finished-edit'),null);
 }finally{w.close();}
});

test('editing uses resource versions, preserves drafts after conflicts, and clears controls on access loss',async()=>{
 const original={id:'original-9',title:'Pixton',url:'https://www.pixton.com/',description:'Make comics',skills:['Think Creatively','Create Media'],icon:'/assets/finished-list/pixton.svg',version:3};let permission=true;const requests=[];
 const {w,q}=website(async(_url,options)=>{if(options.method==='POST'){requests.push(JSON.parse(options.body));return {ok:false,status:409,json:async()=>({error:'This resource changed. Your draft is kept.'})};}return {ok:true,json:async()=>({entries:[original],skills,canAdd:permission,canEdit:permission})};});
 try{
  await tick();q('.finished-edit').click();assert.equal(q('form').elements.title.value,'Pixton');assert.equal(q('#finished-icon-preview').getAttribute('src'),original.icon);assert.equal(w.document.querySelectorAll('#finished-skills input:checked').length,2);
  q('form').elements.description.value='Updated purpose';q('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(requests[0].version,3);assert.equal(requests[0].id,original.id);assert.equal(requests[0].operation,'update');assert.equal(q('form').elements.description.value,'Updated purpose');
  q('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(requests[0].requestId,requests[1].requestId);
  permission=false;q('#finished-refresh').click();await tick();assert.equal(q('.finished-edit'),null);assert.equal(q('#finished-add').hidden,true);
 }finally{w.close();}
});

test('icon chooser resizes a raster before saving, previews it, and rejects oversized uploads',async()=>{
 const uploaded='data:image/webp;base64,'+Buffer.from('RIFF0000WEBPVP8 ').toString('base64'),writes=[];let canvas,closed=0;
 const {w,q}=website(async(_url,options)=>{if(options.method==='POST')writes.push(JSON.parse(options.body));return {ok:true,json:async()=>({entries:[],skills,canAdd:true,canEdit:true})};});
 try{
  await tick();w.createImageBitmap=async()=>({width:1024,height:512,close(){closed++;}});
  w.HTMLCanvasElement.prototype.getContext=function(){canvas=this;return {drawImage(){}};};w.HTMLCanvasElement.prototype.toDataURL=()=>uploaded;
  const chooser=q('#finished-icon-file'),image=new w.File(['raster'],'icon.png',{type:'image/png'});Object.defineProperty(chooser,'files',{configurable:true,value:[image]});chooser.dispatchEvent(new w.Event('change'));await tick();
  assert.equal(canvas.width,128);assert.equal(canvas.height,64);assert.equal(closed,1);assert.equal(q('#finished-icon-preview').src,uploaded);assert.equal(q('#finished-icon-preview').hidden,false);
  const form=q('#finished-form');form.elements.title.value=entry.title;form.elements.url.value=entry.url;form.elements.description.value=entry.description;q('#finished-skills input').checked=true;form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(writes[0].icon,uploaded);
  Object.defineProperty(chooser,'files',{configurable:true,value:[new w.File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'})]});chooser.dispatchEvent(new w.Event('change'));await tick();assert.match(q('#finished-status').textContent,/smaller than 5 MB/);assert.equal(q('#finished-save').disabled,false);
 }finally{w.close();}
});

test('deletion checks live permissions and versions, removes stored content, and safely handles retries',()=>{
 const app=school();app.state.email='mpenalver@bethelsd.org';
 const request={action:'auth-finished-list-delete',session:'valid',id:'original-9',version:1,requestId:id};
 assert.equal(app.call({...request,session:'expired'}).status,401);
 app.state.email='member@students.bethelsd.org';assert.equal(app.call(request).status,403);assert.equal(app.state.writes,0);
 app.role('Software Technician');assert.equal(app.call({...request,version:2}).status,409);assert.equal(app.state.writes,0);
 const result=app.call(request);assert.equal(result.status,200);assert.equal(result.entries.length,16);assert.equal(result.entries.some(e=>e.id==='original-9'),false);assert.equal(app.state.writes,1);
 const stored=JSON.parse(app.state.files.get('list-file'));assert.equal(stored.entries.some(e=>e.id==='original-9'),false);assert.equal(JSON.stringify(stored).includes('pixton.svg'),false);assert.equal(JSON.stringify(result).includes('deleted'),false);
 assert.equal(app.call(request).status,200);assert.equal(app.state.writes,1);assert.equal(app.call({action:'finished-list-view'}).entries.length,16);
 assert.equal(app.call({...request,requestId:crypto.randomUUID()}).status,404);
 app.state.leaders=[];assert.equal(app.call(request).status,403);
});

test('a delayed add retry cannot resurrect a tool after deletion',()=>{
 const app=school();app.role('Software Technician');assert.equal(app.call({...entry,action:'auth-finished-list-add',session:'valid'}).status,200);
 assert.equal(app.call({action:'auth-finished-list-delete',session:'valid',id,version:1,requestId:crypto.randomUUID()}).status,200);
 assert.equal(app.call({...entry,action:'auth-finished-list-add',session:'valid'}).status,409);
 assert.equal(app.call({action:'finished-list-view'}).entries.some(e=>e.id===id),false);
});

test('delete API routes only target metadata, and rejects missing versions before contacting the bridge',async()=>{
 const old=globalThis.fetch,previous={url:process.env.SPINNER_BRIDGE_URL,token:process.env.SPINNER_BRIDGE_TOKEN};let calls=0;
 process.env.SPINNER_BRIDGE_URL='https://script.google.com/test';process.env.SPINNER_BRIDGE_TOKEN='test';
 globalThis.fetch=async(_url,options)=>{calls++;const payload=JSON.parse(options.body);assert.equal(payload.action,'auth-finished-list-delete');assert.equal(payload.id,'original-9');assert.equal(payload.title,undefined);return {ok:true,json:async()=>({status:200,canAdd:true,canEdit:true,skills,entries:[]})};};
 try{
  let res=response();await handler({method:'POST',headers,body:{operation:'delete',id:'original-9',version:1,requestId:id,title:'Ignored'}},res);assert.equal(res.code,200);
  res=response();await handler({method:'POST',headers,body:{operation:'delete',id:'original-9',requestId:id}},res);assert.equal(res.code,400);assert.equal(calls,1);
 }finally{globalThis.fetch=old;for(const [key,value] of [['SPINNER_BRIDGE_URL',previous.url],['SPINNER_BRIDGE_TOKEN',previous.token]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

test('editor deletion requires confirmation, survives an uncertain save, and clears after refresh',async()=>{
 const original={id:'original-9',title:'Pixton',url:'https://www.pixton.com/',description:'Make comics',skills:['Think Creatively'],icon:'',version:2};let deleted=false;const writes=[];
 const {w,q}=website(async(_url,options)=>{if(options.method==='POST'){writes.push(JSON.parse(options.body));deleted=true;return {ok:false,status:503,json:async()=>({error:'Please retry'})};}return {ok:true,json:async()=>({entries:deleted?[]:[original],skills,canAdd:true,canEdit:true})};});
 try{
  await tick();assert.equal(q('#finished-delete').hidden,true);q('.finished-edit').click();assert.equal(q('#finished-delete').hidden,false);
  w.confirm=message=>{assert.match(message,/Pixton/);return false;};q('#finished-delete').click();await tick();assert.equal(writes.length,0);assert.equal(q('#finished-form').elements.title.value,'Pixton');
  w.confirm=()=>true;q('#finished-delete').click();await tick();assert.equal(writes[0].operation,'delete');assert.equal(writes[0].version,2);assert.equal(q('#finished-form').elements.title.value,'Pixton');
  q('#finished-delete').click();await tick();assert.equal(writes[0].requestId,writes[1].requestId);
  q('#finished-refresh').click();await tick();assert.match(q('#finished-status').textContent,/was deleted/);assert.equal(q('#finished-delete').hidden,true);assert.equal(q('#finished-add').open,false);assert.equal(w.document.querySelectorAll('.finished-card').length,0);
 }finally{w.close();}
});
