import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const member=(firstName,lastName='Example')=>({division:'Period 1',position:'Division Manager',firstName,lastName,email:firstName.toLowerCase()+'@students.bethelsd.org'});
const signedIn=w=>{w.NestAuth={identity:{signedIn:true,email:'viewer@students.bethelsd.org'},ready:Promise.resolve({signedIn:true}),open(){}};};
test('Imported directory projects only current first names and normalizes divisions',()=>{
 const ctx=vm.createContext({Sheets:{Spreadsheets:{Values:{get:(id,range)=>{assert.equal(range,"'Imported'!B2:E");return {values:[['Period 1','private-sheet','Division Manager','Example, Alex'],['CTSO','private-sheet','Chief Executive Officer','Example, Sam'],['Period 2','private-sheet','Assistant Manager','']]};}}}}});
 vm.runInContext(fs.readFileSync('google-spinner/Code.js','utf8')+fs.readFileSync('google-spinner/Tracker.js','utf8'),ctx);
 const result=JSON.parse(JSON.stringify(ctx.leadershipDirectory_()));
 assert.deepEqual(result.leaders,[{division:'Period 1',position:'Division Manager',firstName:'Alex'},{division:'NEST Robotics',position:'Chief Executive Officer',firstName:'Sam'}]);
});
test('member directory includes district emails and last names without private sheet links',()=>{
 const ctx=vm.createContext({Sheets:{Spreadsheets:{Values:{get:(id,range)=>{assert.equal(range,"'Imported'!B2:F");return {values:[['Period 1','private-link','Division Manager','Example, Alex','Alex@students.bethelsd.org'],['CTSO','private-link','Chief Executive Officer','Example, Sam','sam@bethelsd.org'],['Period 2','private-link','Open','Vacant','vacant@students.bethelsd.org']]};}}}}});
 vm.runInContext(fs.readFileSync('google-spinner/Code.js','utf8')+fs.readFileSync('google-spinner/Auth.js','utf8')+fs.readFileSync('google-spinner/Tracker.js','utf8'),ctx);
 const result=JSON.parse(JSON.stringify(ctx.memberLeadershipDirectory_()));
 assert.deepEqual(result.leaders,[{division:'Period 1',position:'Division Manager',firstName:'Alex',lastName:'Example',email:'alex@students.bethelsd.org'},{division:'NEST Robotics',position:'Chief Executive Officer',firstName:'Sam',lastName:'Example',email:'sam@bethelsd.org'}]);
 assert.doesNotMatch(JSON.stringify(result),/private-link/);
});
test('directory displays populated roles and marks only missing roles for hiring',async()=>{
 const dom=new JSDOM(fs.readFileSync('leadership.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/leadership'});const w=dom.window;
 signedIn(w);w.AbortSignal=AbortSignal;w.fetch=async url=>({ok:true,text:async()=>url==='/api/leadership'?JSON.stringify({leaders:[member('Alex'),{division:'NEST Robotics',position:'Chief Executive Officer',firstName:'Sam',lastName:'Example',email:'sam@students.bethelsd.org'}]}):'Position\nDivision Manager\nAssistant Manager\n3d Print Specialist'});
 w.eval(fs.readFileSync('js/leadership.js','utf8'));await new Promise(r=>setTimeout(r,30));
 const select=w.document.querySelector('#leadership-division');select.value='Division 1';select.dispatchEvent(new w.Event('change'));
 assert.match(w.document.querySelector('#results-grid').textContent,/Alex Example/);assert.match(w.document.querySelector('#results-grid').textContent,/alex@students.bethelsd.org/);assert.doesNotMatch(w.document.querySelector('#missing-list').textContent,/Division Manager/);assert.match(w.document.querySelector('#missing-list').textContent,/Assistant Manager/);assert.match(w.document.querySelector('#exec-list').textContent,/Sam Example/);assert.doesNotMatch(w.document.querySelector('#leadership-position').textContent,/3d Print Specialist/);assert.match(w.document.querySelector('#leadership-position').textContent,/Fabrication Supervisor/);dom.window.close();
});
test('directory remains usable when the separate position list fails',async()=>{
 const dom=new JSDOM(fs.readFileSync('leadership.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/leadership'});const w=dom.window;
 signedIn(w);w.AbortSignal=AbortSignal;w.fetch=async url=>url==='/api/leadership'?{ok:true,text:async()=>JSON.stringify({leaders:[member('Alex')]})}:Promise.reject(new Error('Fetch is aborted'));
 w.eval(fs.readFileSync('js/leadership.js','utf8'));await new Promise(r=>setTimeout(r,30));
 const select=w.document.querySelector('#leadership-division');select.value='Division 1';select.dispatchEvent(new w.Event('change'));
 assert.match(w.document.querySelector('#results-grid').textContent,/Alex/);assert.doesNotMatch(w.document.querySelector('#results-grid').textContent,/aborted/i);w.close();
});
test('failed directory offers a retry and then displays the selected division',async()=>{
 const dom=new JSDOM(fs.readFileSync('leadership.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/leadership'});const w=dom.window;let calls=0;
 signedIn(w);w.AbortSignal=AbortSignal;w.fetch=async url=>url!=='/api/leadership'?{ok:true,text:async()=>'Position\nDivision Manager'}:++calls===1?Promise.reject(new Error('Fetch is aborted')):{ok:true,text:async()=>JSON.stringify({leaders:[member('Alex')]})};
 w.eval(fs.readFileSync('js/leadership.js','utf8'));await new Promise(r=>setTimeout(r,30));
 const select=w.document.querySelector('#leadership-division');select.value='Division 1';select.dispatchEvent(new w.Event('change'));
 assert.match(w.document.querySelector('#results-title').textContent,/temporarily unavailable/i);assert.doesNotMatch(w.document.querySelector('#results-grid').textContent,/aborted/i);
 w.document.querySelector('#results-grid button').click();await new Promise(r=>setTimeout(r,30));
 assert.match(w.document.querySelector('#results-grid').textContent,/Alex/);assert.equal(calls,2);w.close();
});
test('signed-out viewer sees a login prompt and logout removes private details',async()=>{
 const dom=new JSDOM(fs.readFileSync('leadership.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/leadership'});const w=dom.window;let calls=0,opened=0;
 w.NestAuth={identity:null,ready:Promise.resolve(null),open(){opened++;}};
 w.AbortSignal=AbortSignal;w.fetch=async url=>{calls++;return {ok:true,text:async()=>url==='/api/leadership'?JSON.stringify({leaders:[member('Alex')]}):'Position\nDivision Manager'};};
 w.eval(fs.readFileSync('js/leadership.js','utf8'));await new Promise(r=>setTimeout(r,30));
 assert.equal(calls,0);assert.equal(w.document.querySelector('.leadership-controls').hidden,true);
 w.document.querySelector('#results-grid button').click();assert.equal(opened,1);
 w.NestAuth.identity={signedIn:true,email:'viewer@students.bethelsd.org'};w.document.dispatchEvent(new w.Event('nest-auth-change'));await new Promise(r=>setTimeout(r,30));
 const select=w.document.querySelector('#leadership-division');select.value='Division 1';select.dispatchEvent(new w.Event('change'));
 assert.match(w.document.querySelector('#results-grid').textContent,/alex@students.bethelsd.org/);
 w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));
 assert.doesNotMatch(w.document.querySelector('main').textContent,/alex@students.bethelsd.org/);assert.equal(w.document.querySelector('.leadership-controls').hidden,true);w.close();
});
