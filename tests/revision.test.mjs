import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {JSDOM} from 'jsdom';import {PDFDocument,StandardFonts} from 'pdf-lib';import {parseLunchPdf} from '../lib/lunch-parser.mjs';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('all homepage links and nested groups remain accessible; touch toggles and Escape closes',()=>{
 const dom=new JSDOM(read('index.html'),{runScripts:'outside-only'});const w=dom.window;
 const pending=new Map();let timerId=0;w.setTimeout=fn=>{pending.set(++timerId,fn);return timerId;};w.clearTimeout=id=>pending.delete(id);const finishClose=()=>{const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn());};
 w.eval(read('js/disclosures.js'));
 const panels=[...w.document.querySelectorAll('.gear-panel')];assert.equal(panels.length,4);
 for(const panel of panels){const button=panel.querySelector('button'),content=button.nextElementSibling;
 assert.equal(content.hidden,true);
 const enter=new w.Event('pointerenter');Object.defineProperty(enter,'pointerType',{value:'mouse'});panel.dispatchEvent(enter);assert.equal(content.hidden,false);
 const leave=new w.Event('pointerleave');Object.defineProperty(leave,'pointerType',{value:'mouse'});panel.dispatchEvent(leave);assert.equal(content.hidden,false);panel.dispatchEvent(enter);finishClose();assert.equal(content.hidden,false);panel.dispatchEvent(leave);finishClose();assert.equal(content.hidden,true);
 button.click();assert.equal(content.hidden,false);button.click();assert.equal(content.hidden,true);
 button.focus();assert.equal(content.hidden,false);button.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(content.hidden,true);
 }
 const tools=panels[1],button=tools.querySelector('button');button.click();
 const nested=tools.querySelector('.gear-group-trigger');nested.click();
 assert.equal(nested.nextElementSibling.hidden,false);assert.equal(button.getAttribute('aria-expanded'),'true');
 assert.equal(nested.nextElementSibling.querySelector('a').getAttribute('href'),'/bell-schedule');
 w.document.activeElement.blur();
 const group=panels[3].querySelector('.gear-group');const hover=new w.Event('pointerenter');Object.defineProperty(hover,'pointerType',{value:'mouse'});panels[3].dispatchEvent(hover);group.dispatchEvent(hover);const out=new w.Event('pointerleave');Object.defineProperty(out,'pointerType',{value:'mouse'});group.dispatchEvent(out);finishClose();assert.equal(group.classList.contains('is-open'),true);panels[3].dispatchEvent(out);finishClose();assert.equal(group.classList.contains('is-open'),false);
 dom.window.close();
});
test('Pacific period highlight handles boundaries, PM rollover, passing time, and stale dates on both pages',async()=>{
 for(const html of ['index.html','bell-schedule.html']) {
  const dom=new JSDOM(read(html),{runScripts:'outside-only'});const w=dom.window;
  let current='2026-09-15T15:00:00Z';const NativeDate=w.Date;
  w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[current]));} static now(){return new NativeDate(current).getTime();}};
  const timers=[];w.setInterval=(fn,ms)=>{timers.push({fn,ms});};w.AbortSignal.timeout=()=>undefined;
  const rows=Array.from({length:8},()=>[]);rows[7]=['Today Orange','','','Upcoming Blue'];
  rows.push(['1st Period','7:45-8:53','','1st Period','7:45-8:46'],['2nd Period','8:58-10:06'],['Lunch','10:06-10:36'],['4th Period','11:54-1:02'],['5th Period','1:07-2:15']);
  let date='9/15/2026';w.fetch=async url=>({ok:true,text:async()=>url.includes('gid=0&')?rows.map(r=>r.join(',')).join('\n'):`Date,Schedule,Color\n${date},Orange,#ff7e05\n9/16/2026,Blue,#72acf7`});
  w.eval(read('js/bell.js'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(r=>setTimeout(r,20));
  const highlighted=()=>[...w.document.querySelectorAll('#today-table .is-current')].map(r=>r.textContent);
  assert.match(highlighted()[0],/1st Period/);
  const tick=timers.find(t=>t.ms===15000).fn;
  current='2026-09-15T14:44:00Z';tick();assert.equal(highlighted().length,0);
  current='2026-09-15T15:52:59Z';tick();assert.match(highlighted()[0],/1st Period/);
  current='2026-09-15T15:53:00Z';tick();assert.equal(highlighted().length,1);assert.match(highlighted()[0],/2nd Period/);
  current='2026-09-15T15:57:00Z';tick();assert.match(highlighted()[0],/2nd Period/);
  current='2026-09-15T15:58:00Z';tick();assert.match(highlighted()[0],/2nd Period/);
  current='2026-09-15T17:06:00Z';tick();assert.match(highlighted()[0],/Lunch/);
  current='2026-09-15T19:30:00Z';tick();assert.match(highlighted()[0],/4th Period/);
  current='2026-09-15T20:02:00Z';tick();assert.match(highlighted()[0],/5th Period/);
  current='2026-09-15T20:07:00Z';tick();assert.match(highlighted()[0],/5th Period/);
  current='2026-09-15T21:15:00Z';tick();assert.equal(highlighted().length,0);
  const state=()=>w.document.querySelector('#today-table .is-current');
  for(const [time,expected] of [['14:45:00','passes-locked'],['14:54:59','passes-locked'],['14:55:00','passes-open'],['15:42:59','passes-open'],['15:43:00','passes-locked'],['15:52:59','passes-locked']]){
    current='2026-09-15T'+time+'Z';tick();assert.ok(state().classList.contains(expected),time+' '+expected);
    assert.match(state().querySelector('.pass-status').textContent,expected==='passes-open'?/Passes available/:/10\/10 · Passes locked/);
  }
  current='2026-09-15T15:53:00Z';tick();assert.match(state().textContent,/Passing time/);assert.ok(!state().classList.contains('passes-locked'));assert.ok(!state().classList.contains('passes-open'));
  current='2026-09-15T17:06:00Z';tick();assert.ok(!state().classList.contains('passes-locked'));assert.ok(!state().classList.contains('passes-open'));
  // A period shorter than 20 minutes remains locked throughout its actual duration.
  w.document.querySelector('#today-table tbody tr').dataset.time='7:45-8:00';
  current='2026-09-15T14:55:00Z';tick();assert.ok(state().classList.contains('passes-locked'));
  current='2026-09-16T15:00:00Z';tick();assert.equal(highlighted().length,0);
  assert.equal(w.document.querySelectorAll('#today-table .pass-status,#today-table .passes-open,#today-table .passes-locked').length,0);
  dom.window.close();
 }
});
async function fixture(counts=[2,1,3],omitTime=false) {
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([612,792]);
 const draw=(text,x,y)=>page.drawText(text,{x,y,size:10,font});
 for(let i=0;i<3;i++){const x=60+i*170;draw(`${i+1} LUNCH`,x+30,640);if(!omitTime || i!==2)draw('Orange: 10:06-10:36',x,610);for(let j=0;j<counts[i];j++)draw(`STAFF ${String.fromCharCode(65+i)}${String.fromCharCode(65+j)}`,x,570-j*16);}
 draw('STAFF ON PLANNING PERIOD',200,180);draw('TESTER / PLANNER',100,160);return pdf.save();
}
test('new PDFs derive staff by column without fixed staff counts or file ID',async()=>{
 for(const counts of [[2,1,3],[4,3,1]]) {const data=await parseLunchPdf(await fixture(counts));assert.deepEqual(data.lunches.map(l=>l.staff.length),counts);assert.deepEqual(data.planning,['TESTER','PLANNER']);assert.equal(data.schedules[0].times.length,3);}
});
test('malformed PDF table fails closed instead of publishing incorrect assignments',async()=>{
 await assert.rejects(parseLunchPdf(await fixture([2,1,3],true)));
 await assert.rejects(parseLunchPdf(Buffer.from('not a PDF')));
});
test('bridge rejects anonymous requests and discovers newest PDF in folder',()=>{
 const code=read('google-apps-script/Code.js');const crypto=awaitCrypto;
 let files=[],reads=0;const context={Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()],base64Encode:()=> 'pdf'},MimeType:{PDF:'application/pdf'},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},DriveApp:{getFolderById:id=>{reads++;assert.equal(id,'1uZMZ1kgGk0TiZZuut4voigcWT0-APO_0');return {getFilesByType:()=>{let i=0;return {hasNext:()=>i<files.length,next:()=>files[i++]};}};}}};
 vm.createContext(context);vm.runInContext(code,context);assert.match(context.doGet().error,/Authentication/);assert.match(context.doPost({postData:{contents:'{"token":"wrong"}'}}).error,/Authentication/);assert.equal(reads,0);
 // Substitute only the test hash; production continues to use its separate server-only key.
 vm.runInContext(code.replace(/const LUNCH_FOLDER_ID = [^;]+;/, '').replace(/const expected = '[a-f0-9]+'/,`const expected = '${crypto.createHash('sha256').update('test-key').digest('hex')}'`),context);
 const file=(name,date)=>({getName:()=>name,getLastUpdated:()=>new Date(date),getDateCreated:()=>new Date(date),getSize:()=>100,getBlob:()=>({getBytes:()=>[]})});
 files=[file('old.pdf','2026-01-01'),file('new.pdf','2026-09-01')];assert.equal(context.doPost({postData:{contents:'{"token":"test-key"}'}}).source.name,'new.pdf');
 files.reverse();assert.equal(context.doPost({postData:{contents:'{"token":"test-key"}'}}).source.name,'new.pdf');
});
import awaitCrypto from 'node:crypto';
