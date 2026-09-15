import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const tick=()=>new Promise(r=>setTimeout(r,20));
test('slow score saves leave other cells editable, preserve focus, and serialize revisions',async()=>{
 const dom=new JSDOM(fs.readFileSync('trip-o-meter.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/trip-o-meter'}),w=dom.window;w.AbortSignal=AbortSignal;
 let data={role:'manager',period:'1',revision:1,expires:Date.now()+21600000,students:[{id:'a',name:'Example A',email:'a@example.org'},{id:'b',name:'Example B',email:'b@example.org'}],assignments:[{id:'x',title:'Assignment'}],scores:{a:{x:''},b:{x:''}},completionScores:['4'],grants:[]};
 const pending=[],requests=[];w.fetch=async(_,options)=>{const body=JSON.parse(options.body);if(body.action==='tracker-update'){requests.push(body);return new Promise(resolve=>pending.push(()=>{assert.equal(body.revision,data.revision);body.change.edits.forEach(e=>data.scores[e.student][e.assignment]=e.score);data.revision++;resolve({ok:true,json:async()=>structuredClone(data)});}));}return {ok:true,json:async()=>structuredClone(data)};};
 w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));w.document.querySelector('[data-period="1"]').click();await tick();
 const cells=w.document.querySelectorAll('tbody select');cells[0].value='4';cells[0].dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,280));
 assert.equal(requests.length,1);assert.equal(cells[1].disabled,false);cells[1].focus();cells[1].value='3';cells[1].dispatchEvent(new w.Event('change'));assert.equal(w.document.activeElement,cells[1]);assert.match(w.document.querySelector('[data-save-notice]').textContent,/Saving/);
 pending.shift()();await tick();assert.equal(requests.length,2);assert.equal(requests[1].revision,2);assert.equal(w.document.activeElement,cells[1]);assert.equal(cells[1].value,'3');
 pending.shift()();await tick();assert.match(w.document.querySelector('[data-save-notice]').textContent,/All scores saved/);assert.match(w.document.querySelector('.trip-summary').textContent,/50%/);assert.equal(w.document.activeElement,cells[1]);dom.window.close();
});
