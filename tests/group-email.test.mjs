import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import handler from '../api/group-email.mjs';
import {LEADER_SLIDES} from '../lib/division-slides.mjs';
import {renderDivisionPage} from '../api/division-page.mjs';
const tick=()=>new Promise(r=>setTimeout(r,20));
const records={period:'2',members:[{name:'Sample Leader',email:'leader@students.bethelsd.org'},{name:'Sample Member',email:'member@students.bethelsd.org'}],leaders:[{name:'Sample Leader',email:'leader@students.bethelsd.org',position:'Safety Officer'}]};
const response=()=>({code:200,setHeader(){},status(c){this.code=c;return this;},json(data){this.data=data;return this;}});
async function server(access,period="2",audience='division',rosters={}){
 const oldFetch=globalThis.fetch,oldURL=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN,calls=[];
 process.env.SPINNER_BRIDGE_URL='https://bridge.example.test';process.env.SPINNER_BRIDGE_TOKEN='test';
 const school=vm.createContext({PERIODS:Object.fromEntries(['1','2','3','4','5','7','CTSO'].map(p=>[p,p])),divisionSlidesDispatch_:r=>typeof access==='function'?access(r.period):access,districtEmail_:v=>/^[^\s@,;<>]+@(students\.bethelsd\.org|bethelsd\.org)$/.test(v||'')?v:'',rows_:p=>(rosters[p]||records.members).map(m=>[m.name,m.email]),memberLeadershipDirectory_:()=>({status:200,leaders:[{division:'Period 2',position:'Safety Officer',firstName:'Sample',lastName:'Leader',email:records.leaders[0].email},{division:'Period 3',position:'Safety Officer',firstName:'Other',lastName:'Division',email:'other@students.bethelsd.org'}]})});
 vm.runInContext(fs.readFileSync('google-spinner/GroupEmail.js','utf8'),school);
 globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body.action);assert.equal(body.action,'auth-group-email-access');return new Response(JSON.stringify(school.groupEmailAccess_(body)));};
 try{const res=response();await handler({method:'GET',headers:{cookie:'__Host-nest-auth='+'a'.repeat(64)},query:{period,audience}},res);return {res,calls};}
 finally{globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldURL;if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;}
}
test('email groups require login and reject invalid divisions and write requests',async()=>{
 for(const [req,code] of [[{method:'GET',headers:{},query:{period:'2'}},401],[{method:'GET',headers:{},query:{period:'__proto__'}},400],[{method:'POST',headers:{},query:{}},405]]){const res=response();await handler(req,res);assert.equal(res.code,code);}
});
test('ordinary members and other division members receive no email roster',async()=>{
 for(const access of [{status:200,roles:[],canManage:false},{status:403,roles:['Safety Officer']}]){const {res,calls}=await server(access);assert.equal(res.code,403);assert.equal(res.data.members,undefined);assert.deepEqual(calls,['auth-group-email-access']);}
});
test('managers, assistants and assigned leaders receive only current selected-division recipients',async()=>{
 for(const access of [{status:200,canManage:true},{status:200,roles:['Assistant Manager']},{status:200,roles:['Safety Officer']}]){const {res}=await server(access);assert.equal(res.code,200);assert.deepEqual(res.data.members,records.members);assert.equal(res.data.leaders.length,1);assert.equal(res.data.scores,undefined);}
});
const nestRecords={...records,period:'all',audience:'nest',accessPeriod:'2',divisions:['1','2','3','4','5','7','CTSO'],members:[...records.members.map(m=>({...m,divisions:['2']})),{name:'Other Member',email:'other@students.bethelsd.org',divisions:['3','CTSO']}],leaders:[...records.leaders,{name:'Other Member',email:'other@students.bethelsd.org',position:'Assistant Manager',division:'Period 3'},{name:'Other Member',email:'other@students.bethelsd.org',position:'Safety Officer',division:'NEST Robotics'}]};
function ui(_unused=false,inline=false){
 const dom=new JSDOM(renderDivisionPage('2',{manager:{},leaders:[],canManage:false}),{runScripts:'outside-only',url:'https://gknest.org/divisions/2#lookup'}),w=dom.window;
 if(!inline)w.document.querySelector('[data-hq-communications]').remove();
 w.AbortSignal=AbortSignal;w.Blob=Blob;w.TextEncoder=TextEncoder;w.NestAuth={identity:{signedIn:true},ready:Promise.resolve()};w.NestDivisionHQ={allowed:true,active:inline?'communications':'lookup'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let copied=null,opened=null,tokenRequest=null;w.ClipboardItem=class{constructor(data){this.data=data;}};
 Object.defineProperty(w.navigator,'clipboard',{value:{write:async items=>copied=items[0]}});w.open=url=>opened={location:{href:url}};
 w.fetch=async()=>({ok:true,json:async()=>({...nestRecords,canReachBuildingLeadership:true,emailService:{ready:true,from:'communications@gknest.org'}})});w.eval(fs.readFileSync('js/group-email.js','utf8'));
 return {w,get copied(){return copied;},get opened(){return opened;},get tokenRequest(){return tokenRequest;}};
}
test('composer filters recipients and offers a concise official-use policy notice',async()=>{
 const {w}=ui();try{await tick();const q=s=>w.document.querySelector(s);q('.group-email-launch').click();assert.equal(q('.group-email-dialog').open,true);
 assert.match(q('[data-email-count]').textContent,/2 recipients/);assert.equal(q('[data-email-search-label]').hidden,true);
 q('[data-email-group]').value='individual';q('[data-email-group]').dispatchEvent(new w.Event('change'));assert.equal(q('[data-email-send]').disabled,true);assert.equal(q('[data-email-search-label]').hidden,false);assert.equal(q('[data-email-recipients]').querySelectorAll('input').length,3);
 assert.match(q('.group-email-notice').textContent,/official NEST™ communications only/);assert.equal(q('.group-email-notice a').textContent,'Email privacy policy');
 for(const selector of ['[data-email-copy]','[data-email-sender]','.group-email-shortcuts','.group-email-banner-note'])assert.equal(q(selector),null);
 }finally{w.close();}
});
test('revoked access clears the draft and closes the composer',async()=>{
 const app=ui(),{w}=app;await tick();const q=s=>w.document.querySelector(s);q('.group-email-launch').click();q('[data-email-subject]').value='Meeting';q('.group-email-message').textContent='Hello';

 w.NestDivisionHQ.allowed=false;w.document.dispatchEvent(new w.Event('nest-hq-access-revoked'));assert.equal(q('.group-email-message').textContent,'');assert.equal(q('.group-email-dialog').open,false);assert.equal(q('.group-email-launch').hidden,true);w.close();
});

test('All divisions aggregates authorized rosters, deduplicates recipients and excludes nonleadership divisions',async()=>{
 const owner=await server({status:200,isOwner:true},'all');assert.equal(owner.res.code,200);assert.deepEqual(owner.res.data.divisions,['1','2','3','4','5','7','CTSO']);assert.equal(owner.res.data.members.length,2);assert.equal(owner.calls.filter(a=>a==='auth-group-email-access').length,1);
 const leader=await server(p=>p==='2'?{status:200,roles:['Safety Officer']}:{status:200,roles:[]},'all');assert.equal(leader.res.code,200);assert.deepEqual(leader.res.data.divisions,['2']);assert.equal(leader.calls.filter(a=>a==='auth-group-email-access').length,1);assert.equal(leader.res.data.leaders.length,1);
 const denied=await server({status:200,roles:[]},'all');assert.equal(denied.res.code,403);assert.equal(denied.calls.includes('tracker'),false);
});
test('division and position checkbox pickers support multiple/all choices and deduplicate members',async()=>{
 const {w}=ui();try{await tick();const q=s=>w.document.querySelector(s);q('.group-email-launch').click();q('.group-email-message').textContent='Keep this message';
 const mode=value=>{q('[data-email-group]').value=value;q('[data-email-group]').dispatchEvent(new w.Event('change'));};
 mode('division');assert.equal(q('[data-email-search-label]').hidden,true);assert.equal(q('[data-email-options] [value="2"]').checked,true);q('[data-email-options] [value="3"]').click();assert.match(q('[data-email-count]').textContent,/3 recipients/);q('[data-email-options] [value="CTSO"]').click();assert.match(q('[data-email-count]').textContent,/3 recipients/);
 q('[data-email-options] [value="all"]').click();assert.ok([...w.document.querySelectorAll('[data-email-options] input')].every(box=>box.checked));assert.match(q('[data-email-picker-summary]').textContent,/All divisions/);q('[data-email-options] [value="all"]').click();assert.match(q('[data-email-count]').textContent,/0 recipients/);
 mode('position');assert.equal(q('[data-email-options]').querySelectorAll('input').length,3);q('[data-email-options] [value="all"]').click();assert.match(q('[data-email-count]').textContent,/2 recipients/);assert.equal(q('.group-email-message').textContent,'Keep this message');
 }finally{w.close();}
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

test('the composer keeps its banner for delivery and provides additional formatting controls',async()=>{
 const {w}=ui();await tick();const d=w.document;
 assert.equal(d.querySelector('.group-email-banner'),null);assert.equal(d.querySelector('.group-email-banner-note'),null);
 for(const command of ['underline','strikeThrough','insertOrderedList','justifyLeft','justifyCenter','justifyRight','removeFormat','unlink','undo','redo'])assert.ok(d.querySelector(`[data-email-command="${command}"]`));
 for(const name of ['block','color','highlight'])assert.ok(d.querySelector(`[data-email-${name}]`));w.close();
});

test('Tab and Shift+Tab indent only the selected composer paragraphs and preserve the selection',async()=>{
 const {w}=ui();await tick();const editor=w.document.querySelector('.group-email-message');editor.innerHTML='<p>One</p><p>Two</p><p>Three</p>';const paragraphs=[...editor.children];
 try{selectText(w,paragraphs[0],paragraphs[1]);const tab=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});editor.dispatchEvent(tab);assert.equal(tab.defaultPrevented,true);assert.equal(paragraphs[0].style.marginLeft,'32px');assert.equal(paragraphs[1].style.marginLeft,'32px');assert.equal(paragraphs[2].style.marginLeft,'');assert.equal(w.getSelection().toString(),'OneTwo');
  const outdent=new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true});editor.dispatchEvent(outdent);assert.equal(outdent.defaultPrevented,true);assert.equal(paragraphs[0].style.marginLeft,'');assert.equal(paragraphs[1].style.marginLeft,'');
 }finally{w.close();}
});
test('Control and Command bracket shortcuts use the same bullet nesting rules as the toolbar',async()=>{
 for(const modifier of ['ctrlKey','metaKey']){
  const {w}=ui();await tick();const editor=w.document.querySelector('.group-email-message');editor.innerHTML='<ul><li>Parent</li><li>Child</li><li>After</li></ul>';const [parent,child,after]=editor.querySelectorAll('li');
  try{selectText(w,child,child,2,2);const key=(value,code)=>new w.KeyboardEvent('keydown',{key:value,code,[modifier]:true,bubbles:true,cancelable:true});const indentKey=key(']','BracketRight');editor.dispatchEvent(indentKey);assert.equal(indentKey.defaultPrevented,true);assert.equal(child.parentElement.parentElement,parent);assert.equal(after.parentElement,parent.parentElement);editor.dispatchEvent(key('[','BracketLeft'));assert.equal(child.parentElement,parent.parentElement);assert.equal(w.getSelection().isCollapsed,true);}finally{w.close();}
 }
});
test('Escape then Tab leaves the composer without trapping focus, and shortcuts do not affect other fields',async()=>{
 const {w}=ui();await tick();const editor=w.document.querySelector('.group-email-message');editor.innerHTML='<p>Text</p>';selectText(w,editor.firstChild,editor.firstChild,1,1);
 try{const escape=new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});editor.dispatchEvent(escape);assert.equal(escape.defaultPrevented,true);const tab=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});editor.dispatchEvent(tab);assert.equal(tab.defaultPrevented,false);assert.equal(editor.firstChild.style.marginLeft,'');
  const subject=w.document.querySelector('[data-email-subject]'),subjectTab=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});subject.dispatchEvent(subjectTab);assert.equal(subjectTab.defaultPrevented,false);assert.equal(editor.hasAttribute('aria-describedby'),false);
 }finally{w.close();}
});

test('HQ composer is embedded in Communications and preserves the draft and selections across tabs',async()=>{
 const {w}=ui(false,true);try{await tick();const q=s=>w.document.querySelector(s);
 assert.equal(q('.group-email-launch'),null);assert.equal(q('[data-hq-communications] .group-email-inline').tagName,'SECTION');assert.equal(q('[data-email-close]').hidden,true);
 assert.equal(q('[data-hq-lookup]').dataset.emailEnabled,undefined);
 q('[data-email-subject]').value='Draft subject';q('.group-email-message').textContent='Draft message';q('[data-email-group]').value='individual';q('[data-email-group]').dispatchEvent(new w.Event('change'));q('[data-email-recipients] input').click();
 w.NestDivisionHQ.active='lookup';w.document.dispatchEvent(new w.CustomEvent('nest-hq-tab-change',{detail:{tab:'lookup'}}));
 w.NestDivisionHQ.active='communications';w.document.dispatchEvent(new w.CustomEvent('nest-hq-tab-change',{detail:{tab:'communications'}}));
 assert.equal(q('[data-email-subject]').value,'Draft subject');assert.equal(q('.group-email-message').textContent,'Draft message');assert.equal(q('[data-email-recipients] input').checked,true);
 w.NestDivisionHQ.allowed=false;w.document.dispatchEvent(new w.Event('nest-hq-access-revoked'));
 assert.equal(q('[data-email-subject]').value,'');assert.equal(q('.group-email-message').textContent,'');assert.equal(q('[data-email-recipients]').children.length,0);
 }finally{w.close();}
});

test('all assigned division leaders can retrieve building leadership without receiving other student rosters',async()=>{
 for(const role of ['Division Manager','Assistant Manager','Safety Officer','Software Technician','Partner Liaison','Division DJ','Chief Executive Officer','Chief Financial Officer','Chief Operations Officers','Executive Vice-President']){
  const target=role.startsWith('Chief')||role.startsWith('Executive')?'CTSO':'2';
  const access=p=>p===target?{status:200,roles:[role]}:{status:403};
  const building=await server(access,'all','leadership');assert.equal(building.res.code,200,role);assert.equal(building.res.data.leaders.length,2);assert.equal(building.res.data.members.length,2);
  assert.equal(building.res.data.members.some(m=>m.email==='member@students.bethelsd.org'),false);assert.equal(building.calls.includes('tracker'),false);
  const scoped=await server(access,'all');assert.deepEqual(scoped.res.data.divisions,[target]);assert.equal(scoped.calls.filter(action=>action==='auth-group-email-access').length,1);
 }
 const denied=await server(p=>p==='2'?{status:200,roles:[]}:{status:403},'all','leadership');assert.equal(denied.res.code,403);assert.equal(denied.calls.includes('auth-leadership-directory'),false);
 const invalid=await server({status:200,canManage:true},'2','leadership');assert.equal(invalid.res.code,400);
});

test('Individual search selects multiple members across NEST and keeps selections when filtering or switching modes',async()=>{
 const {w}=ui(false,true);try{await tick();const q=s=>w.document.querySelector(s),mode=value=>{q('[data-email-group]').value=value;q('[data-email-group]').dispatchEvent(new w.Event('change'));};
 mode('individual');q('[data-email-recipients] [value="leader@students.bethelsd.org"]').click();q('[data-email-search]').value='Other';q('[data-email-search]').dispatchEvent(new w.Event('input'));q('[data-email-recipients] [value="other@students.bethelsd.org"]').click();assert.match(q('[data-email-count]').textContent,/2 recipients/);assert.equal([...w.document.querySelectorAll('[data-email-recipients] label')].filter(row=>!row.hidden).length,1);
 mode('position');assert.equal(q('[data-email-search-label]').hidden,true);mode('individual');assert.equal(q('[data-email-recipients] [value="leader@students.bethelsd.org"]').checked,true);assert.equal(q('[data-email-recipients]').querySelectorAll('input:checked').length,2);
 }finally{w.close();}
});

async function nestMailApp(send){
 const app=ui(),{w}=app;await tick();const sends=[];
 w.fetch=async(url,options)=>{
  if(url==='/api/group-email-send'){sends.push(JSON.parse(options.body));return send?send():{ok:true,status:200,json:async()=>({state:'accepted',accepted:1,rejected:0})};}
  return {ok:true,json:async()=>({...nestRecords,canReachBuildingLeadership:true,emailService:{ready:true,from:'communications@gknest.org'}})};
 };
 w.document.querySelector('.group-email-launch').click();w.document.querySelector('[data-email-subject]').value='Meeting';w.document.querySelector('.group-email-message').innerHTML='<p>Hello team</p>';
 return {...app,w,sends};
}
test('NEST send needs no Google connection, sends through the local API and blocks duplicate clicks',async()=>{
 const {w,sends}=await nestMailApp();try{const q=s=>w.document.querySelector(s);assert.equal(q('[data-email-connect]'),null);assert.equal(q('[data-email-open]'),null);q('[data-email-send]').click();q('[data-email-send]').click();await tick();assert.equal(sends.length,1);assert.match(sends[0].requestId,/^[a-f0-9]{64}$/);assert.equal(sends[0].html,'<p>Hello team</p>');assert.equal(sends[0].testing,false);assert.equal(q('[data-email-send]').disabled,true);assert.equal(q('.group-email-actions').nextElementSibling,q('[data-email-status]'));assert.equal(q('[data-email-status]').dataset.state,'success');assert.match(q('[data-email-status]').textContent,/Email sent.*recipient.*Accepted for delivery/);assert.equal(w.document.querySelector('script[src*=google]'),null);}finally{w.close();}
});
test('uncertain NEST delivery preserves the draft and cannot retry automatically',async()=>{
 const {w,sends}=await nestMailApp(async()=>{throw new Error('Network lost');});try{const q=s=>w.document.querySelector(s);q('[data-email-send]').click();await tick();assert.match(q('[data-email-status]').textContent,/not resend automatically/);assert.equal(q('.group-email-message').textContent,'Hello team');q('[data-email-send]').click();assert.equal(sends.length,1);assert.equal(q('[data-email-new]').hidden,false);}finally{w.close();}
});
test('NEST self-test preserves the team draft and leaves recipient choice to the server',async()=>{
 const {w,sends}=await nestMailApp();try{const q=s=>w.document.querySelector(s);q('[data-email-test]').click();await tick();assert.equal(sends[0].testing,true);assert.deepEqual(sends[0].recipients,[]);assert.equal(q('.group-email-message').textContent,'Hello team');assert.equal(q('[data-email-send]').disabled,false);}finally{w.close();}
});
test('a late send acknowledgement after logout cannot restore the old identity or draft',async()=>{
 let settle;const {w,sends}=await nestMailApp(()=>new Promise(resolve=>settle=resolve));try{const q=s=>w.document.querySelector(s);q('[data-email-send]').click();await tick();w.NestAuth.identity={signedIn:false};w.document.dispatchEvent(new w.Event('nest-auth-change'));settle({ok:true,status:200,json:async()=>({state:'accepted',accepted:1})});await tick();assert.equal(sends.length,1);assert.equal(q('.group-email-message').textContent,'');assert.equal(q('[data-email-send]').disabled,true);assert.doesNotMatch(q('[data-email-status]').textContent,/accepted/);}finally{w.close();}
});

test('every configured NEST leadership role can select the full live roster; ordinary members cannot',async()=>{
 const roles=[...new Set(Object.values(LEADER_SLIDES).flat().map(slide=>slide.role))];
 for(const role of roles){const {res}=await server(p=>p==='2'?{status:200,roles:[role]}:{status:403},'all','nest',{'3':[{name:'Other Division',email:'other@students.bethelsd.org'}]});assert.equal(res.code,200,role);assert.equal(res.data.accessPeriod,'2');assert.equal(res.data.members.length,3);assert.equal(res.data.members.find(m=>m.email==='other@students.bethelsd.org').divisions[0],'3');assert.equal(res.data.divisions.length,7);}
 for(const access of [{status:200,roles:[]},{status:403,roles:['Safety Officer']}])assert.equal((await server(access,'all','nest')).res.code,403);
 assert.equal((await server({status:200,roles:['Safety Officer']},'2','nest')).res.code,400);
});

test('uncertain delivery rechecks status without sending again and restores confirmed success',async()=>{
 const {w,sends}=await nestMailApp(async()=>({ok:true,status:200,json:async()=>({state:'unknown',accepted:0,rejected:0})}));
 try{const q=s=>w.document.querySelector(s);q('[data-email-send]').click();await tick();const sendFetch=w.fetch;let checks=0;
 w.fetch=async(url,options)=>{if(url.startsWith('/api/group-email-history?')){checks++;return {ok:true,json:async()=>({requestId:sends[0].requestId,state:'accepted',accepted:2,rejected:0,unconfirmed:0})};}return sendFetch(url,options);};
 q('[data-email-check]').click();await tick();assert.equal(checks,1);assert.equal(sends.length,1);assert.match(q('[data-email-status]').textContent,/Email sent to 2 recipients/);assert.equal(q('[data-email-status]').dataset.state,'success');assert.equal(q('[data-email-check]').hidden,true);assert.equal(q('[data-email-send]').disabled,true);
 }finally{w.close();}
});
test('a partially successful send reports confirmed counts instead of an unconfirmed batch',async()=>{
 const {w,sends}=await nestMailApp(async()=>({ok:true,status:200,json:async()=>({state:'partial',accepted:7,rejected:1})}));
 try{const q=s=>w.document.querySelector(s);q('[data-email-send]').click();await tick();assert.match(q('[data-email-status]').textContent,/Email sent to 7 recipients.*1 recipient was rejected/);assert.equal(q('[data-email-check]').hidden,true);assert.equal(sends.length,1);}finally{w.close();}
});

test('logout discards a late status check and clears its controls',async()=>{
 const {w,sends}=await nestMailApp(async()=>({ok:true,status:200,json:async()=>({state:'pending'})}));
 try{const q=s=>w.document.querySelector(s);q('[data-email-send]').click();await tick();let settle;w.fetch=()=>new Promise(resolve=>settle=resolve);q('[data-email-check]').click();await tick();w.NestAuth.identity={signedIn:false};w.document.dispatchEvent(new w.Event('nest-auth-change'));settle({ok:true,json:async()=>({requestId:sends[0].requestId,state:'accepted',accepted:1})});await tick();assert.equal(q('[data-email-status]').textContent,'');assert.equal(q('[data-email-check]').hidden,true);assert.equal(q('[data-email-send]').disabled,true);
 }finally{w.close();}
});
