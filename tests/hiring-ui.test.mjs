import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

test('manager can choose a roster student and submit a position-scoped assignment',async()=>{
 const dom=new JSDOM(fs.readFileSync('hiring.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/hiring?period=1#manager-hiring'});
 const w=dom.window,requests=[];
 w.NestAuth={identity:{signedIn:true,email:'manager@students.bethelsd.org'},ready:Promise.resolve({signedIn:true}),open(){}};
 w.fetch=async (url,options={})=>{
   if(url.startsWith('/api/hiring?period=mine'))return {ok:true,json:async()=>({periods:['1']})};
   if(url.startsWith('/api/hiring?period=1'))return {ok:true,json:async()=>({division:'Division 1',canManage:true,columns:['Timestamp','Applicant'],applications:[['Today','Applicant']],team:[['Division Manager','Existing, Student','existing@students.bethelsd.org']],candidates:[{name:'Existing, Student',email:'existing@students.bethelsd.org'},{name:'New, Student',email:'new@students.bethelsd.org'}],hasMore:false})};
   requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({name:'New, Student',email:'new@students.bethelsd.org'})};
 };
 w.eval(fs.readFileSync('js/hiring.js','utf8'));
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.match(w.document.querySelector('#hiring-status').textContent,/application/i);
 const select=w.document.querySelector('#hiring-team select');assert.ok(select);
 select.value='new@students.bethelsd.org';w.document.querySelector('#hiring-team button').click();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.deepEqual(requests,[{action:'assign',period:'1',row:3,position:'Division Manager',expectedName:'Existing, Student',expectedEmail:'existing@students.bethelsd.org',studentEmail:'new@students.bethelsd.org'}]);
 dom.window.close();
});

const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
function workspace(url='https://gknest.org/hiring?period=1'){
 const dom=new JSDOM(fs.readFileSync('hiring.html','utf8'),{runScripts:'outside-only',url});
 dom.window.NestAuth={identity:{signedIn:true,email:'manager@students.bethelsd.org'},ready:Promise.resolve(),open(){}};
 return dom;
}
const view={division:'Division 1',canManage:true,columns:['Applicant'],applications:[],team:[['Assistant Manager','Example','example@students.bethelsd.org']],candidates:[],hasMore:false};
const response=data=>({ok:true,json:async()=>data});
test('division link opens directly and auth event plus ready starts only one request',async()=>{
 const dom=workspace(),w=dom.window,calls=[];
 w.fetch=async url=>{calls.push(url);return response(view);};
 w.eval(fs.readFileSync('js/hiring.js','utf8'));
 w.document.dispatchEvent(new w.Event('nest-auth-change'));
 await tick();
 assert.equal(calls.length,1);assert.match(calls[0],/period=1/);assert.doesNotMatch(calls[0],/mine/);
 assert.equal(w.document.querySelector('#hiring-data').hidden,false);w.close();
});
test('stalled access request times out with a retry that can recover',async()=>{
 const dom=workspace('https://gknest.org/hiring'),w=dom.window;
 let timer,signal,calls=0;
 w.setTimeout=(callback,delay)=>{assert.equal(delay,60000);timer=callback;return 1;};w.clearTimeout=()=>{};
 w.fetch=async (_url,options)=>{signal=options.signal;return ++calls===1?new Promise(()=>{}):response({periods:['1']});};
 w.eval(fs.readFileSync('js/hiring.js','utf8'));await tick();
 timer();await tick();
 assert.equal(signal.aborted,true);assert.match(w.document.querySelector('#hiring-status').textContent,/too long/);
 w.document.querySelector('#hiring-status button').click();await tick();
 assert.equal(w.document.querySelector('#hiring-divisions button').textContent,'Division 1');assert.equal(calls,2);w.close();
});
test('non-JSON server failure offers a retry instead of leaving the loading message',async()=>{
 const dom=workspace(),w=dom.window;
 w.fetch=async()=>({ok:false,json:async()=>{throw new SyntaxError('Unexpected <');}});
 w.eval(fs.readFileSync('js/hiring.js','utf8'));await tick();
 assert.match(w.document.querySelector('#hiring-status').textContent,/temporarily unavailable/);
 assert.equal(w.document.querySelector('#hiring-status button').textContent,'Try again');
 assert.equal(w.document.querySelector('#hiring-data').hidden,true);w.close();
});
test('old access responses cannot replace a new account or restore details after logout',async()=>{
 const dom=workspace('https://gknest.org/hiring'),w=dom.window;let finish;
 w.fetch=()=>new Promise(resolve=>{finish=resolve;});
 w.eval(fs.readFileSync('js/hiring.js','utf8'));await tick();
 const oldFinish=finish;
 w.NestAuth.identity={signedIn:true,email:'other@students.bethelsd.org'};
 w.document.dispatchEvent(new w.Event('nest-auth-change'));await tick();
 oldFinish(response({periods:['1']}));await tick();
 assert.equal(w.document.querySelector('#hiring-divisions').children.length,0);
 w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));
 finish(response({periods:['2']}));await tick();
 assert.match(w.document.querySelector('#hiring-status').textContent,/Sign in/);
 assert.equal(w.document.querySelector('#hiring-divisions').children.length,0);w.close();
});

test('Add partner preserves the existing assignment and submits a role-scoped roster selection',async()=>{
 const dom=workspace(),w=dom.window,posts=[];
 w.fetch=async (_url,options={})=>options.method==='POST'?(posts.push(JSON.parse(options.body)),response({sharingQueued:true})):response({...view,candidates:[{name:'Partner','email':'partner@students.bethelsd.org'}]});
 w.eval(fs.readFileSync('js/hiring.js','utf8'));await tick();
 const button=[...w.document.querySelectorAll('#hiring-team button')].find(b=>b.textContent==='Add partner');
 assert.ok(button);button.closest('tr').querySelector('select').value='partner@students.bethelsd.org';button.click();await tick();
 assert.deepEqual(posts,[{action:'partner',period:'1',position:'Assistant Manager',studentEmail:'partner@students.bethelsd.org'}]);
 assert.match(w.document.querySelector('#hiring-team tbody').textContent,/Example/);w.close();
});
test('notes and four interview ratings save together; unsaved changes protect pagination and layout supports keyboard resizing',async()=>{
 const dom=workspace(),w=dom.window,posts=[];
 const key='a'.repeat(64),revision='b'.repeat(64);
 w.fetch=async (_url,options={})=>options.method==='POST'?(posts.push(JSON.parse(options.body)),response({revision:'c'.repeat(64)})):response({...view,columns:['Timestamp','Applicant','Division'],applications:[['Today','Applicant','Period 1']],reviews:[{key,revision,notes:'Existing note',scores:[null,null,null,null]}],hasMore:true});
 w.eval(fs.readFileSync('js/hiring.js','utf8'));await tick();
 const tr=w.document.querySelector('#hiring-applications tbody tr'),notes=tr.querySelector('textarea'),selects=[...tr.querySelectorAll('select')];
 notes.value='Interview discussion';notes.dispatchEvent(new w.Event('input'));
 selects.forEach((s,i)=>{s.value=String(i+1);s.dispatchEvent(new w.Event('change'));});
 assert.equal(w.document.querySelector('#hiring-next').disabled,true);assert.match(tr.textContent,/10\/16/);
 tr.querySelector('button').click();await tick();
 assert.deepEqual(posts,[{action:'review',period:'1',key,revision,notes:'Interview discussion',scores:[1,2,3,4]}]);assert.equal(w.document.querySelector('#hiring-next').disabled,false);assert.match(tr.textContent,/Saved/);
 const col=w.document.querySelector('.application-column-resize');col.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(w.document.querySelector('#hiring-applications col').style.width,'136px');
 const row=tr.querySelector('.application-row-resize');row.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.equal(tr.querySelector('.application-cell').style.height,'196px');
 w.document.querySelector('#hiring-fit').click();assert.equal(w.document.querySelector('#hiring-applications').style.width,'100%');
 const stored=JSON.parse(w.localStorage.getItem('nest-hiring-layout:manager@students.bethelsd.org:1'));assert.equal(stored.heights['0:0'],196);assert.equal(stored.widths,undefined);assert.doesNotMatch(JSON.stringify(stored),/Interview discussion/);w.close();
});
test('review-only access exposes ratings and notes without edit actions',async()=>{
 const dom=workspace(),w=dom.window;w.fetch=async()=>response({...view,canManage:false,applications:[['Today','Applicant','Period 1','Position']],reviews:[{key:'a'.repeat(64),revision:'b'.repeat(64),notes:'Saved note',scores:[1,2,3,4]}]});
 w.eval(fs.readFileSync('js/hiring.js','utf8'));await tick();assert.equal(w.document.querySelector('#hiring-team').hidden,true);assert.equal(w.document.querySelector('#hiring-applications textarea').disabled,true);assert.equal(w.document.querySelector('#hiring-applications tbody button'),null);assert.match(w.document.querySelector('#hiring-applications tbody').textContent,/10\/16/);w.close();
});
