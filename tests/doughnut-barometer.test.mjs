import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import barometerHandler from '../api/doughnut-barometer.mjs';

const periods=['Period 7','Period 1','Period 2','Period 3','Period 4','Period 5'];
const validSession='a'.repeat(64);
const source=fs.readFileSync('google-spinner/DoughnutBarometer.js','utf8');
function summary(today,start,end,sessionToken) {
  let reads=0;
  const context={
    Date:class extends Date { constructor(...args){super(...(args.length?args:[today+'T12:00:00-07:00']));} },
    Utilities:{formatDate:date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`},
    PropertiesService:{getScriptProperties:()=>({})},
    authSession_:token=>token===validSession?{email:'member@bethelsd.org'}:null,
    Sheets:{Spreadsheets:{Values:{
      batchGet:()=>({valueRanges:[{values:[[start]]},{values:[[end]]}]}),
      get:(_id,range)=>{reads++;return {values:range.includes('G6:H11')?periods.map((name,index)=>[name,index===0?9.25:0]):[['Period 7','9/28/2026',9.25,'Great leadership'],['Period 1','9/28/2026',0,'']]};}
    }}}
  };
  vm.createContext(context);vm.runInContext(source,context);
  return {data:context.doughnutBarometer_(sessionToken),reads};
}
test('public barometer gives six averages but neither reads nor returns comments',()=>{
  for(const today of ['2026-09-25','2026-10-01']) {
    const {data,reads}=summary(today,'09/25/2026','10/01/2026');
    assert.equal(data.active,true);assert.equal(data.periods.length,6);assert.equal(data.periods[0].average,9.25);assert.equal(reads,1);
    assert.deepEqual(Object.keys(data.periods[0]),['name','average']);
    assert.equal(data.commentsAuthorized,false);assert.equal(data.comments.length,0);
  }
});
test('only a verified NEST session reads comments',()=>{
  const invalid=summary('2026-09-28','09/25/2026','10/01/2026','b'.repeat(64));
  assert.equal(invalid.data.commentsAuthorized,false);assert.equal(invalid.reads,1);
  const signed=summary('2026-09-28','09/25/2026','10/01/2026',validSession);
  assert.equal(signed.data.commentsAuthorized,true);assert.equal(signed.reads,2);
  assert.equal(signed.data.comments[0].text,'Great leadership');assert.equal(signed.data.comments.length,1);
});
test('website API strips comments for public requests even if a bridge response includes them',async()=>{
  const oldFetch=globalThis.fetch,oldUrl=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL='https://script.google.com/macros/s/test/exec';
  process.env.SPINNER_BRIDGE_TOKEN='test-token';
  const sent=[];
  globalThis.fetch=async(_url,options)=>{
    sent.push(JSON.parse(options.body));
    return {ok:true,status:200,json:async()=>({status:200,active:true,start:'2026-09-25',end:'2026-10-01',
      periods:periods.map(name=>({name,average:8})),announcementReady:false,
      commentsAuthorized:true,comments:[{period:'Period 7',text:'Private comment'}]})};
  };
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(value){this.value=value;return this;}});
  try {
    const publicResult=response();
    await barometerHandler({method:'GET',headers:{},query:{comments:'1'}},publicResult);
    assert.equal(publicResult.code,200);assert.equal(publicResult.value.commentsAuthorized,false);
    assert.deepEqual(publicResult.value.comments,[]);assert.equal(sent[0].session,undefined);
    const signedResult=response();
    await barometerHandler({method:'GET',headers:{cookie:`__Host-nest-auth=${validSession}`},query:{comments:'1'}},signedResult);
    assert.equal(signedResult.value.commentsAuthorized,true);
    assert.equal(signedResult.value.comments[0].text,'Private comment');
    assert.equal(sent[1].session,validSession);
  } finally {
    globalThis.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldUrl;
    if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;
  }
});
test('outside and invalid windows hide the barometer without reading ratings',()=>{
  for(const [today,start,end] of [['2026-09-24','09/25/2026','10/01/2026'],['2026-10-02','09/25/2026','10/01/2026'],['2026-09-28','09/31/2026','10/01/2026']]) {
    const {data,reads}=summary(today,start,end);assert.equal(data.active,false);assert.equal(reads,0);
  }
});
test('winner notice waits until the day after the final absence',()=>{
  assert.equal(summary('2026-09-28','09/25/2026','10/01/2026').data.announcementReady,false);
  assert.equal(summary('2026-09-29','09/25/2026','10/01/2026').data.announcementReady,true);
});
test('main menu link follows the barometer state',async()=>{
  for(const active of [false,true]) {
    const dom=new JSDOM('<a id="doughnut-menu-link" hidden></a>',{runScripts:'outside-only'});
    dom.window.fetch=async()=>({ok:true,json:async()=>({active})});
    dom.window.eval(fs.readFileSync('js/doughnut-menu.js','utf8'));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(dom.window.document.querySelector('a').hidden,!active);
    dom.window.close();
  }
});
test('page keeps comments hidden publicly, then shows them after sign-in and hides them on sign-out',async()=>{
  const dom=new JSDOM(fs.readFileSync('doughnut-barometer.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/doughnut-barometer'});
  const {window}=dom;
  let authorized=false;
  window.fetch=async()=>({ok:true,json:async()=>({active:true,start:'2026-09-25',end:'2026-10-01',announcementReady:false,
    periods:periods.map((name,index)=>({name,average:index===0?9.25:0})),commentsAuthorized:authorized,comments:[{period:'Period 7',text:'Excellent teamwork'}]})});
  window.eval(fs.readFileSync('js/doughnut-barometer.js','utf8'));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(window.document.querySelectorAll('.doughnut-card').length,6);
  assert.equal(window.document.querySelector('#doughnut-comments-section').hidden,true);
  assert.equal(window.document.querySelector('#doughnut-comments').textContent,'');
  assert.equal(window.document.querySelector('#doughnut-comments-prompt').hidden,false);
  authorized=true;window.document.dispatchEvent(new window.Event('nest-auth-change'));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(window.document.querySelector('.doughnut-comment p').textContent,'Excellent teamwork');
  assert.equal(window.document.querySelector('#doughnut-comments-section').hidden,false);
  authorized=false;window.document.dispatchEvent(new window.Event('nest-auth-change'));
  assert.equal(window.document.querySelector('#doughnut-comments').textContent,'');
  assert.equal(window.document.querySelector('#doughnut-comments-section').hidden,true);
  assert.equal(window.document.querySelector('#doughnut-bars'),null);
  dom.window.close();
});
test('winner dialog blocks until acknowledged and does not repeat for that result',()=>{
  const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://gknest.org/'});
  const {window}=dom;
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  window.eval(fs.readFileSync('js/doughnut-announcement.js','utf8'));
  const data={announcementReady:true,end:'2026-10-01',periods:periods.map((name,index)=>({name,average:index===0?9.25:7}))};
  window.DoughnutWinner.show(data);
  assert.equal(window.document.querySelector('dialog').open,true);
  assert.match(window.document.querySelector('dialog h2').textContent,/Period 7 wins/);
  window.document.querySelector('dialog button').click();
  assert.equal(window.document.querySelector('dialog'),null);
  window.DoughnutWinner.show(data);
  assert.equal(window.document.querySelector('dialog'),null);
  dom.window.close();
});
test('winner dialog handles a tie and skips a window with no ratings',()=>{
  const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://gknest.org/'});
  const {window}=dom;
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  window.eval(fs.readFileSync('js/doughnut-announcement.js','utf8'));
  const empty={announcementReady:true,end:'2026-10-02',periods:periods.map(name=>({name,average:0}))};
  window.DoughnutWinner.show(empty);assert.equal(window.document.querySelector('dialog'),null);
  window.DoughnutWinner.show({announcementReady:true,end:'2026-10-02',periods:periods.map((name,index)=>({name,average:index<2?9:7}))});
  assert.match(window.document.querySelector('dialog h2').textContent,/Period 7 & Period 1 tie/);
  dom.window.close();
});

test('barometer retries a transient Google connection failure without forwarding public comments access',async()=>{
  const oldFetch=globalThis.fetch,oldUrl=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN;
  process.env.SPINNER_BRIDGE_URL='https://script.google.com/macros/s/test/exec';process.env.SPINNER_BRIDGE_TOKEN='test-token';let calls=0;
  globalThis.fetch=async(_url,options)=>{calls++;assert.equal(JSON.parse(options.body).session,undefined);if(calls===1)throw new TypeError('fetch failed');return {ok:true,status:200,json:async()=>({status:200,active:false})};};
  const res={setHeader(){},status(code){this.code=code;return this;},json(value){this.value=value;return this;}};
  try{await barometerHandler({method:'GET',headers:{},query:{comments:'1'}},res);assert.equal(calls,2);assert.equal(res.code,200);assert.deepEqual(res.value,{active:false});}
  finally{globalThis.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldUrl;if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;}
});
