import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {renderDivisionPage} from '../api/division-page.mjs';
import {HQ_JOBS_HTML,HQ_HIRING_HTML,HQ_LOOKUP_HTML} from '../lib/division-hq-content.mjs';
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const access=manage=>({canManage:manage,team:[{position:'Division Manager',name:'Morgan Manager'}],manager:{id:'manager-deck',role:'Manager Slideshow',canEdit:manage},leaders:[{id:'leadership-deck',role:'Safety Officer',canEdit:manage}]});
function ui(manage=true,hash=''){
  const dom=new JSDOM(renderDivisionPage('2',access(manage)),{runScripts:'outside-only',url:'https://gknest.org/divisions/2'+hash}),w=dom.window,calls=[];
  w.NestAuth={identity:{signedIn:true,email:'manager@school.test'},ready:Promise.resolve()};
  w.AbortSignal=AbortSignal;
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,json:async()=>access(manage)};};
  w.eval(fs.readFileSync('js/division-hq.js','utf8'));w.eval(fs.readFileSync('js/division-workspace.js','utf8'));return {w,calls};
}
function choose(w,key){w.document.querySelector('[data-hq-tab='+key+']').click();}
test('HQ has connected accessible tabs and loads slides and the application only on demand',async()=>{
  const {w,calls}=ui();await tick();
  assert.deepEqual([...w.document.querySelectorAll('[role=tab]')].map(tab=>tab.textContent),['Trip-o-meter','Team Lookup','Meetings','Employment','Hiring']);
  assert.equal(w.document.querySelector('[aria-selected=true]').id,'hq-tab-tripometer');
  assert.equal(w.document.querySelectorAll('[role=tabpanel]:not([hidden])').length,1);
  assert.equal(w.document.querySelector('iframe[src]'),null);assert.equal(calls.length,0);
  assert.equal(w.document.querySelector('[data-hq-lookup]').dataset.hqLookup,'2');
  assert.ok(w.document.querySelector('script[src="/js/trip-o-meter.js"]'));assert.equal(w.document.querySelector('script[src="/js/leadership.js"]'),null);choose(w,'lookup');assert.ok(w.document.querySelector('script[src="/js/leadership.js"]'));assert.equal(w.document.querySelector('script[src="/js/hiring.js"]'),null);
  choose(w,'meetings');assert.match(w.document.querySelector('.division-window-stage iframe').src,/manager-deck/);assert.equal(w.location.hash,'#meetings');
  choose(w,'employment');assert.match(w.document.querySelector('[data-application-src]').src,/viewform\?embedded=true/);
  assert.equal(w.document.querySelectorAll('#hq-panel-employment .job-card').length,10);
  assert.equal(w.document.querySelector('.division-page-actions').textContent,'All divisions');
  choose(w,'hiring');assert.ok(w.document.querySelector('script[src="/js/hiring.js"]'));
  choose(w,'meetings');choose(w,'hiring');assert.equal(w.document.querySelectorAll('script[src="/js/hiring.js"]').length,1);
  w.close();
});
test('members never receive a hiring workspace and keyboard tabs skip Hiring',async()=>{
  const {w}=ui(false,'#hiring');await tick();assert.equal(w.document.getElementById('hq-tab-hiring').hidden,true);assert.equal(w.document.getElementById('hq-panel-hiring'),null);
  assert.equal(w.document.getElementById('hiring-applications'),null);assert.equal(w.document.querySelector('[aria-selected=true]').id,'hq-tab-tripometer');
  const first=w.document.getElementById('hq-tab-tripometer');first.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(w.document.activeElement.id,'hq-tab-employment');
  w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(w.document.activeElement.id,'hq-tab-tripometer');w.close();
});
test('hiring reuses existing tables, keeps unsaved notes across tabs and clears them on access loss',async()=>{
  const {w,calls}=ui();await tick();choose(w,'hiring');
  w.fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,json:async()=>({division:'Division 2',canManage:true,columns:[],applications:[['Today','Sample Applicant','Period 2','Safety Officer','','','','']],reviews:[{key:'review-key',revision:'rev-1',notes:'',scores:[null,null,null,null]}],team:[['Safety Officer','','']],positions:['Safety Officer'],candidates:[],hasMore:false})};};
  w.eval(fs.readFileSync('js/hiring.js','utf8'));await tick();
  assert.equal(calls.filter(call=>call.url.includes('/api/hiring?period=2')).length,1);assert.equal(calls.some(call=>call.url.includes('period=mine')),false);
  assert.ok(w.document.querySelector('.application-column-resize'));assert.ok(w.document.querySelector('.application-row-resize'));assert.match(w.document.querySelector('#hiring-team').textContent,/Add partner/);
  const notes=w.document.querySelector('#hiring-applications textarea');notes.value='Draft interview notes';notes.dispatchEvent(new w.Event('input'));
  choose(w,'employment');choose(w,'hiring');assert.equal(w.document.querySelector('#hiring-applications textarea'),notes);assert.equal(notes.value,'Draft interview notes');assert.equal(calls.length,1);
  w.NestDivisionHQ.setAccess(false);assert.equal(w.document.querySelectorAll('[role=tabpanel]:not([hidden])').length,0);assert.equal(w.document.querySelector('#hiring-applications tbody').textContent,'');assert.equal(w.document.querySelector('#hiring-team tbody').textContent,'');assert.equal(w.document.querySelector('iframe[src]'),null);w.close();
});
test('lookup starts on the HQ division while retaining every division and position search',async()=>{
  const {w}=ui();await tick();
  w.fetch=async url=>({ok:true,text:async()=>String(url).includes('/api/leadership')?JSON.stringify({leaders:[{division:'Period 2',position:'Safety Officer',firstName:'Sample',lastName:'Leader',email:'sample@school.test'}]}):'Position\nSafety Officer\nDivision Manager'});
  w.eval(fs.readFileSync('js/leadership.js','utf8'));await tick();
  assert.equal(w.document.getElementById('leadership-division').value,'Division 2');assert.match(w.document.getElementById('results-title').textContent,/Division 2/);
  assert.equal(w.document.getElementById('leadership-division').options.length,8);assert.equal(w.document.getElementById('leadership-mode').options.length,2);
  assert.match(w.document.getElementById('results-grid').textContent,/Sample Leader/);
  w.NestDivisionHQ.setAccess(false);assert.doesNotMatch(w.document.getElementById('results-grid').textContent,/Sample Leader/);w.close();
});
test('HQ fragments retain the existing job descriptions, hiring controls and lookup filters',()=>{
  const jobs=new JSDOM(fs.readFileSync('leadership-jobs.html','utf8')),hq=new JSDOM(HQ_JOBS_HTML);
  assert.deepEqual([...hq.window.document.querySelectorAll('.job-card p')].map(p=>p.textContent),[...jobs.window.document.querySelectorAll('.job-card p')].map(p=>p.textContent));
  for(const id of ['hiring-applications','hiring-team','hiring-fit','hiring-reload','hiring-prev','hiring-next'])assert.match(HQ_HIRING_HTML,new RegExp('id="'+id+'"'));
  assert.match(HQ_LOOKUP_HTML,/id="leadership-division"/);assert.match(HQ_LOOKUP_HTML,/id="leadership-position"/);jobs.window.close();hq.window.close();
});

test('HQ tracker opens its own division, retains scores across tabs and rejects stale data after access loss',async()=>{
  const {w,calls}=ui();await tick();
  w.fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,json:async()=>({period:'2',role:'student',revision:1,expires:Date.now()+3600000,students:[{id:'sample',name:'Sample Student'}],assignments:[{id:'task',title:'Sample Task'}],scores:{sample:{task:'4'}},completionScores:['4']})};};
  w.eval(fs.readFileSync('js/trip-o-meter.js','utf8'));await tick();
  assert.equal(JSON.parse(calls[0].options.body).period,'2');
  assert.equal(w.document.querySelector('#trip-app [data-period-select]').hidden,true);
  const view=w.document.querySelector('#trip-app [data-view]');assert.match(view.textContent,/Sample Task/);
  choose(w,'employment');choose(w,'tripometer');assert.match(view.textContent,/Sample Task/);assert.equal(calls.length,1);
  let resolve;w.fetch=()=>new Promise(r=>resolve=r);
  w.document.querySelector('#trip-app [data-refresh]').click();await tick();
  w.NestDivisionHQ.setAccess(false);resolve({ok:true,json:async()=>({period:'2',role:'student',revision:2,expires:Date.now()+3600000,students:[{id:'late',name:'Late Response'}],assignments:[],scores:{},completionScores:['4']})});await tick();
  assert.equal(view.textContent,'');assert.equal(view.hidden,true);w.close();
});
test('locked HQ never returns the tracker and old tracker URLs route to Division HQ',()=>{
  const locked=renderDivisionPage('2',{error:'Sign in'},401);
  assert.doesNotMatch(locked,/id="trip-app"|id="hq-panel-tripometer"/);
  const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
  assert.ok(config.redirects.some(r=>r.source==='/trip-o-meter'&&r.destination==='/divisions'));
  assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/href="\/trip-o-meter"/);
});
