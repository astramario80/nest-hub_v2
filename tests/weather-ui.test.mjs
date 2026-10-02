import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

async function layoutUI(saved){
  const dom=new JSDOM(fs.readFileSync('weather.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/weather'}),w=dom.window;
  w.NestAuth={identity:{signedIn:true,username:'layout-tester'},ready:Promise.resolve()};
  const key='nest-weather-layout:layout-tester:1';if(saved)w.localStorage.setItem(key,JSON.stringify(saved));
  w.fetch=async url=>({ok:true,json:async()=>String(url).includes('period=mine')?{periods:['1','2']}:{division:'Period 1',summary:[],columns:['Date','Report'],rows:[['Today','A long report with details that should remain available.']],hasMore:true}});
  w.eval(fs.readFileSync('js/weather.js','utf8'));await new Promise(resolve=>setImmediate(resolve));
  w.document.querySelectorAll('#weather-divisions button')[1].click();await new Promise(resolve=>setImmediate(resolve));return {w,key};
}
test('weather sizes can be adjusted with keyboard and restored to responsive fit',async()=>{
  const {w,key}=await layoutUI(),table=w.document.getElementById('weather-responses');
  assert.equal(table.style.width,'100%');assert.deepEqual([...table.querySelectorAll('col')].map(col=>col.style.width),['50%','50%']);
  const column=table.querySelector('.weather-column-resize'),row=table.querySelector('.weather-row-resize');
  column.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(table.querySelector('col').style.width,'136px');assert.equal(table.style.width,'256px');assert.equal(column.getAttribute('aria-valuenow'),'136');
  row.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  assert.deepEqual([...table.querySelectorAll('.weather-cell')].map(box=>box.style.height),['160px','160px']);
  assert.equal(JSON.parse(w.localStorage.getItem(key)).heights['0:0'],160);
  w.document.getElementById('weather-next').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(table.querySelector('col').style.width,'136px');assert.equal(table.querySelector('.weather-cell').style.height,'144px');
  w.document.getElementById('weather-prev').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(table.querySelector('.weather-cell').style.height,'160px');
  w.document.getElementById('weather-fit').click();assert.equal(table.style.width,'100%');assert.equal(table.querySelector('col').style.width,'50%');
  w.document.getElementById('weather-reset-rows').click();assert.equal(table.querySelector('.weather-cell').style.height,'144px');assert.equal(row.getAttribute('role'),'separator');
  const stored=JSON.parse(w.localStorage.getItem(key));assert.equal(stored.widths,undefined);assert.equal(stored.heights,undefined);
  assert.doesNotMatch(w.localStorage.getItem(key),/long report/);w.close();
});
test('weather drag sizes are bounded, stop on cancellation, and stay separate between divisions',async()=>{
  const {w}=await layoutUI();
  function pointer(target,type,x,y){const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:3});target.dispatchEvent(e);}
  const table=w.document.getElementById('weather-responses'),column=table.querySelector('.weather-column-resize'),row=table.querySelector('.weather-row-resize');
  pointer(column,'pointerdown',100,0);pointer(w.document,'pointermove',-1000,0);assert.equal(table.querySelector('col').style.width,'40px');
  pointer(w.document,'pointercancel',-1000,0);pointer(w.document,'pointermove',1000,0);assert.equal(table.querySelector('col').style.width,'40px');
  pointer(row,'pointerdown',0,100);pointer(w.document,'pointermove',0,2000);assert.equal(table.querySelector('.weather-cell').style.height,'900px');pointer(w.document,'pointerup',0,2000);
  w.document.querySelectorAll('#weather-divisions button')[2].click();await new Promise(resolve=>setImmediate(resolve));assert.equal(table.style.width,'100%');assert.equal(table.querySelector('.weather-cell').style.height,'144px');
  w.document.querySelectorAll('#weather-divisions button')[1].click();await new Promise(resolve=>setImmediate(resolve));assert.equal(table.querySelector('col').style.width,'40px');assert.equal(table.querySelector('.weather-cell').style.height,'900px');w.close();
});
test('invalid stored weather sizes fall back safely and remain adjustable',async()=>{
  const {w}=await layoutUI({widths:['bad',-5],heights:{'0:0':5000}}),table=w.document.getElementById('weather-responses');
  assert.equal(table.style.width,'100%');assert.equal(table.querySelector('.weather-cell').style.height,'900px');
  table.querySelector('.weather-column-resize').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(table.querySelector('col').style.width,'136px');w.close();
});

test('weather page keeps the form visible and renders only an authorized tab with its gauges',async()=>{
  const dom=new JSDOM(fs.readFileSync('weather.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/weather'});
  const w=dom.window;
  w.NestAuth={identity:{signedIn:true},ready:Promise.resolve()};
  w.fetch=async url=>({ok:true,json:async()=>String(url).includes('period=mine')?{periods:['1']}:{division:'Period 1',summary:[["Today's Trimester 1",'Pacing','Rigor','Safety'],['',3,3,5],['Trimester 1',3,3,5],['Trimester 2','','',''],['Trimester 3','','','']],columns:['Timestamp','Report'],rows:[['Today','Calm']],hasMore:false}});
  w.eval(fs.readFileSync('js/weather.js','utf8'));
  await new Promise(resolve=>setImmediate(resolve));
  const buttons=[...w.document.querySelectorAll('#weather-divisions button')];
  assert.deepEqual(buttons.map(button=>button.textContent),['Advisory','Period 1','Period 2','Period 3','Period 4','Period 5','CTSO']);
  assert.equal(buttons[0].disabled,true);
  assert.equal(buttons[1].disabled,false);
  assert.match(w.document.querySelector('iframe').src,/viewform\?embedded=true/);
  buttons[1].click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#weather-data').hidden,false);
  assert.equal(w.document.querySelectorAll('#weather-charts svg').length,3);
  assert.match(w.document.querySelector('#weather-charts').textContent,/3 \/ 5/);
  const gauges=[...w.document.querySelectorAll('.weather-gauge svg')];
  const colors=gauge=>[...gauge.querySelectorAll('path')].map(path=>path.getAttribute('stroke'));
  assert.deepEqual(colors(gauges[0]),['#ec7950','#f6b149','#65ad6f','#f6b149','#ec7950']);
  assert.deepEqual(colors(gauges[1]),colors(gauges[0]));
  assert.deepEqual(colors(gauges[2]),['#ec7950','#f6b149','#65ad6f']);
  const point=angle=>[100+78*Math.cos(angle*Math.PI/180),103-78*Math.sin(angle*Math.PI/180)];
  const arcPath=(from,to)=>{const start=point(from),end=point(to);return `M ${start[0]} ${start[1]} A 78 78 0 0 1 ${end[0]} ${end[1]}`;};
  const paths=gauge=>[...gauge.querySelectorAll('path')].map(path=>path.getAttribute('d'));
  assert.deepEqual(paths(gauges[0]),[[180,150],[150,120],[120,60],[60,30],[30,0]].map(([from,to])=>arcPath(from,to)));
  assert.deepEqual(paths(gauges[1]),paths(gauges[0]));
  assert.deepEqual(paths(gauges[2]),[[180,120],[120,60],[60,0]].map(([from,to])=>arcPath(from,to)));
  assert.ok(Math.abs(Number(gauges[0].querySelector('line').getAttribute('x2'))-100)<0.00001);
  assert.equal(gauges[2].querySelector('line').getAttribute('x2'),'162');
  assert.match(gauges[0].getAttribute('aria-label'),/best at 3/);
  assert.match(gauges[1].getAttribute('aria-label'),/best at 3/);
  assert.match(gauges[2].getAttribute('aria-label'),/best at 5/);
  assert.equal(w.document.querySelector('#weather-data tbody tr td').textContent,'Today');
  assert.match(w.document.querySelector('#weather-data > h3').textContent,/this trimester/);
  assert.match(w.document.querySelector('#weather-status').textContent,/current-trimester responses/);
  dom.window.close();
});
