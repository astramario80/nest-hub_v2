import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

test('weather page keeps the form visible and renders only an authorized tab with its gauges',async()=>{
  const dom=new JSDOM(fs.readFileSync('weather.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/weather'});
  const w=dom.window;
  w.NestAuth={identity:{signedIn:true},ready:Promise.resolve()};
  w.fetch=async url=>({ok:true,json:async()=>String(url).includes('period=mine')?{periods:['1']}:{division:'Period 1',summary:[["Today's Trimester 1",'Pacing','Rigor','Safety'],['',3,2,5],['Trimester 1',3,2,5],['Trimester 2','','',''],['Trimester 3','','','']],columns:['Timestamp','Report'],rows:[['Today','Calm']],hasMore:false}});
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
  assert.equal(w.document.querySelector('#weather-data tbody tr td').textContent,'Today');
  dom.window.close();
});
