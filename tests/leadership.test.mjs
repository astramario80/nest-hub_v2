import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
test('Imported directory projects only current first names and normalizes divisions',()=>{
 const ctx=vm.createContext({Sheets:{Spreadsheets:{Values:{get:(id,range)=>{assert.equal(range,"'Imported'!B2:E");return {values:[['Period 1','private-sheet','Division Manager','Example, Alex'],['CTSO','private-sheet','Chief Executive Officer','Example, Sam'],['Period 2','private-sheet','Assistant Manager','']]};}}}}});
 vm.runInContext(fs.readFileSync('google-spinner/Code.js','utf8')+fs.readFileSync('google-spinner/Tracker.js','utf8'),ctx);
 const result=JSON.parse(JSON.stringify(ctx.leadershipDirectory_()));
 assert.deepEqual(result.leaders,[{division:'Period 1',position:'Division Manager',firstName:'Alex'},{division:'NEST Robotics',position:'Chief Executive Officer',firstName:'Sam'}]);
});
test('directory displays populated roles and marks only missing roles for hiring',async()=>{
 const dom=new JSDOM(fs.readFileSync('leadership.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/leadership'});const w=dom.window;
 w.AbortSignal=AbortSignal;w.fetch=async url=>({ok:true,text:async()=>url==='/api/leadership'?JSON.stringify({leaders:[{division:'Period 1',position:'Division Manager',firstName:'Alex'},{division:'NEST Robotics',position:'Chief Executive Officer',firstName:'Sam'}]}):'Position\nDivision Manager\nAssistant Manager'});
 w.eval(fs.readFileSync('js/leadership.js','utf8'));await new Promise(r=>setTimeout(r,30));
 const select=w.document.querySelector('#leadership-division');select.value='Division 1';select.dispatchEvent(new w.Event('change'));
 assert.match(w.document.querySelector('#results-grid').textContent,/Alex/);assert.doesNotMatch(w.document.querySelector('#missing-list').textContent,/Division Manager/);assert.match(w.document.querySelector('#missing-list').textContent,/Assistant Manager/);assert.match(w.document.querySelector('#exec-list').textContent,/Sam/);dom.window.close();
});
