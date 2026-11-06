import {staffContext} from './helpers/staff-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {createDJHandler,renderDJPage,validInvitation} from '../api/dj.mjs';
const handler=createDJHandler({get:async()=>null,put:async()=>({})});
const periods=['1','2','3','4','5','7','CTSO'];
const session='a'.repeat(64);
function response(){return {headers:{},code:200,setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},send(v){this.body=v;return this;},json(v){this.body=v;return this;}};}
async function request(period='2',result={status:200,roles:['Division DJ']},options={},chosenHandler=handler){
 const prior=global.fetch;let payload;
 process.env.SPINNER_BRIDGE_URL='https://school.invalid';process.env.SPINNER_BRIDGE_TOKEN='test';
 global.fetch=async(_url,init)=>{payload=JSON.parse(init.body);return {ok:true,status:200,json:async()=>result};};
 try{const res=response();await chosenHandler({method:'GET',headers:{cookie:'__Host-nest-auth='+session},query:{period},...options},res);return {...res,payload};}finally{global.fetch=prior;}
}
test('all division DJ pages return only their own playlist after a live assignment check',async()=>{
 const found=new Set();
 for(const period of periods){
  const res=await request(period);assert.equal(res.code,200);assert.equal(res.payload.period,period);assert.equal(res.payload.operation,'access');assert.equal(res.payload.session,session);
  const doc=new JSDOM(res.body).window.document;const links=doc.querySelectorAll('a[href^="https://open.spotify.com/"]');assert.equal(links.length,2);found.add(links[0].href);
  const frame=doc.querySelector('iframe');assert.ok(frame);assert.equal(new URL(frame.src).pathname,new URL(links[0].href).pathname.replace('/playlist/','/embed/playlist/'));assert.match(frame.getAttribute('allow'),/encrypted-media/);assert.doesNotMatch(res.body,/docs\.google\.com\/presentation/);assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
 }
 assert.equal(found.size,7);
});
test('ordinary students, managers and executives do not inherit DJ access',async()=>{
 for(const roles of [[],['Division Manager'],['Chief Executive Officer'],['Assistant Manager'],['Division DJ intern']]){
  const res=await request('2',{status:200,roles,canManage:true});assert.equal(res.code,403);assert.doesNotMatch(res.body,/open\.spotify\.com|[?&]pt=/);
 }
});
test('owner retains access and school failures return no invitation',async()=>{
 assert.equal((await request('2',{status:200,isOwner:true,roles:[]})).code,200);
 for(const status of [401,403,503]){const res=await request('2',{status});assert.equal(res.code,status);assert.doesNotMatch(res.body,/open\.spotify\.com|[?&]pt=/);}
});
test('anonymous, invalid division and unsupported method fail before reading school data',async()=>{
 for(const [period,options,code] of [['2',{headers:{}},401],['6',{},404],['__proto__',{},404],['2',{method:'DELETE'},405]]){
  const res=await request(period,undefined,options);assert.equal(res.code,code);assert.equal(res.payload,undefined);assert.doesNotMatch(res.body,/open\.spotify\.com/);
 }
});
test('hiring and removal are reflected on the next page request',async()=>{
 for(const [roles,code] of [[[],403],[['Division DJ'],200],[[],403]])assert.equal((await request('2',{status:200,roles})).code,code);
});
test('school access checks bind DJ roles to the requested division and linked account',()=>{
 const leaders=[['Period 2','','Division DJ','DJ','dj@students.bethelsd.org']];
 const ctx=staffContext({console,PropertiesService:{getScriptProperties:()=>({})},Sheets:{Spreadsheets:{Values:{get:()=>({values:leaders})}}},LEADERSHIP_DATABASE:"leaders",PERIODS:{'1':'a','2':'b'},OWNER_EMAILS:[],email_:v=>String(v||'').toLowerCase(),memberEmail_:identity=>identity==='manual:dj'?'dj@students.bethelsd.org':identity,nestExecutive_:()=>false});
 vm.runInContext(fs.readFileSync('google-spinner/DivisionSlides.js','utf8'),ctx);
 ctx.authSession_=()=>({email:'manual:dj'});ctx.rows_=()=>[['DJ','dj@students.bethelsd.org']];
 assert.deepEqual(Array.from(ctx.divisionSlidesDispatch_({period:'2',operation:'access'}).roles),['Division DJ']);
 assert.deepEqual(Array.from(ctx.divisionSlidesDispatch_({period:'1',operation:'access'}).roles),[]);
 leaders.length=0;assert.equal(ctx.divisionSlidesDispatch_({period:'2',operation:'access'}).roles.length,0);
 ctx.rows_=()=>[];assert.equal(ctx.divisionSlidesDispatch_({period:'2',operation:'access'}).status,403);
});
test('public DJ menu contains seven protected local routes and no playlist invitations',()=>{
 const html=fs.readFileSync('dj.html','utf8'),doc=new JSDOM(html).window.document;
 assert.deepEqual([...doc.querySelectorAll('.dj-grid a')].map(a=>a.getAttribute('href')),periods.map(p=>'/dj/'+p));
 assert.doesNotMatch(html,/open\.spotify\.com|docs\.google\.com\/presentation/);
 const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));assert.ok(config.rewrites.some(r=>r.source==='/dj/:period'&&r.destination==='/api/dj?period=:period'));
});
test('sign out clears the invitation and returning from browser history rechecks access',async()=>{
 const dom=new JSDOM(renderDJPage('2'),{runScripts:'outside-only'}),w=dom.window;
 w.NestAuth={identity:{signedIn:true},ready:Promise.resolve()};w.eval(fs.readFileSync('js/dj.js','utf8'));await Promise.resolve();
 w.dispatchEvent(new w.Event('pagehide'));assert.equal(w.document.querySelector('a[href^="https://open.spotify.com"]'),null);w.close();
});
test('student instructions include joining, the app link, adding songs and community agreements',()=>{
 const doc=new JSDOM(renderDJPage('2')).window.document;
 assert.ok(doc.querySelector('a[href="https://www.spotify.com/us/download/other/"]'));
 assert.ok(doc.querySelector('a[href="/sops#community-agreements"]'));
 assert.match(doc.body.textContent,/Need permission to add songs/);assert.match(doc.body.textContent,/Add to playlist/);assert.match(doc.body.textContent,/safe and school-appropriate/);
 assert.equal(doc.querySelector('[data-invite-form]'),null);
 assert.ok(new JSDOM(renderDJPage('2',{isOwner:true})).window.document.querySelector('[data-invite-form]'));
});
test('saved Spotify links must match the selected playlist and use a supported format',()=>{
 const base='https://open.spotify.com/playlist/1ZTICxG3ozlLYqfrqOkpbu';
 assert.equal(validInvitation('2',base+'?pt='+'a'.repeat(32)),true);
 assert.equal(validInvitation('2',base+'?si='+'a'.repeat(22)),true);
 for(const value of [base,base+'?pt=bad',base.replace('https:','http:')+'?pt='+'a'.repeat(32),'https://evil.test/?pt='+'a'.repeat(32)])assert.equal(validInvitation('2',value),false);
 assert.equal(validInvitation('1',base+'?pt='+'a'.repeat(32)),false);
});
test('only teacher can save invitations and untrusted origins are rejected',async()=>{
 const options={method:'POST',headers:{cookie:'__Host-nest-auth='+session,origin:'https://gknest.org','content-type':'application/json'},body:{url:'https://open.spotify.com/playlist/1ZTICxG3ozlLYqfrqOkpbu?pt='+'a'.repeat(32)}};
 const denied=await request('2',{status:200,roles:['Division DJ']},options);assert.equal(denied.code,403);
 const saved=await request('2',{status:200,isOwner:true},options);assert.equal(saved.code,200);assert.equal(saved.body.saved,true);
 const forged=await request('2',{status:200,isOwner:true},{...options,headers:{...options.headers,origin:'https://evil.test'}});assert.equal(forged.code,403);assert.equal(forged.payload,undefined);
 const invalid=await request('2',{status:200,isOwner:true},{...options,body:{url:'https://evil.test'}});assert.equal(invalid.code,400);
});
test('private invitations appear only after DJ authorization and expire after seven days',async()=>{
 const url='https://open.spotify.com/playlist/1ZTICxG3ozlLYqfrqOkpbu?pt='+'a'.repeat(32);let reads=0,savedAt=Date.now();
 const custom=createDJHandler({get:async(path,options)=>{reads++;assert.equal(path,'dj/invitation-2.json');assert.equal(options.access,'private');return {stream:new Response(JSON.stringify({url,savedAt})).body};}});
 const current=await request('2',{status:200,roles:['Division DJ']},{},custom);assert.match(current.body,/class="dj-join"/);
 const denied=await request('2',{status:200,roles:[]},{},custom);assert.equal(denied.code,403);assert.doesNotMatch(denied.body,/pt=/);assert.equal(reads,1);
 savedAt=Date.now()-8*86400000;const expired=await request('2',{status:200,roles:['Division DJ']},{},custom);assert.doesNotMatch(expired.body,/class="dj-join"/);assert.doesNotMatch(expired.body,/pt=/);
});
test('guide separates playlist saving, copying, collaborator access and the song menu',()=>{
 const doc=new JSDOM(renderDJPage('2')).window.document;
 const setup=doc.querySelector('[data-guide-panel="setup"]').textContent;
 const songs=doc.querySelector('[data-guide-panel="songs"]').textContent;
 assert.match(setup,/three-dot menu.*beside Play/s);assert.match(setup,/Add to other playlist.*copies/s);
 assert.match(setup,/Opening or saving a playlist alone does not grant editing access/);
 assert.match(songs,/three dots.*beside the song/s);assert.match(songs,/Add to playlist/);
 assert.equal(doc.querySelectorAll('.dj-guide-panel[hidden]').length,0);
});
test('guide chapter navigation supports next, previous and keyboard selection',()=>{
 const dom=new JSDOM(renderDJPage('2'),{runScripts:'outside-only'}),w=dom.window;
 w.NestAuth={identity:{signedIn:true},ready:Promise.resolve()};w.eval(fs.readFileSync('js/dj.js','utf8'));
 const tabs=[...w.document.querySelectorAll('[role=tab]')],panels=[...w.document.querySelectorAll('[role=tabpanel]')];
 assert.equal(tabs.length,3);assert.equal(panels.filter(p=>!p.hidden).length,1);assert.equal(tabs[0].getAttribute('aria-selected'),'true');
 w.document.querySelector('[data-guide-next]').click();assert.equal(panels[1].hidden,false);assert.equal(panels[0].hidden,true);
 assert.match(w.document.querySelector('[data-guide-progress]').textContent,/Chapter 2 of 3/);
 tabs[1].dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(panels[2].hidden,false);assert.equal(w.document.activeElement,tabs[2]);assert.equal(w.document.querySelector('[data-guide-next]').disabled,true);
 w.document.querySelector('[data-guide-previous]').click();assert.equal(panels[1].hidden,false);dom.window.close();
});
test('an ordinary shared Spotify link is not presented as a collaboration invitation',()=>{
 const doc=new JSDOM(renderDJPage('2',{invite:{url:'https://open.spotify.com/playlist/1ZTICxG3ozlLYqfrqOkpbu?si='+'a'.repeat(22)}})).window.document;
 assert.equal(doc.querySelector('.dj-join'),null);assert.match(doc.body.textContent,/ask Mr. Penalver to check your collaboration access/);
});
test('locked DJ pages never contain a Spotify iframe',async()=>{
 for(const result of [{status:401},{status:403},{status:200,roles:[]}]){
  const res=await request('2',result);const doc=new JSDOM(res.body).window.document;
  assert.equal(doc.querySelector('iframe'),null);assert.doesNotMatch(res.body,/open\.spotify\.com\/embed/);
 }
});
