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
