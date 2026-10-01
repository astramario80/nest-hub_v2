import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read=file=>fs.readFileSync(file,'utf8');
const page=(file,url)=>new JSDOM(read(file),{url:url||'https://gknest.org/'+file,runScripts:'outside-only'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('SOAR opens on Safety and retains working mouse, click and keyboard letter selection',()=>{
 const dom=page('soar.html'),w=dom.window;
 try{
  w.eval(read('js/main.js'));
  assert.match(w.document.querySelector('#soar-text-display').textContent,/SAFETY/);
  assert.ok(w.document.querySelector('#soar-btn-S').classList.contains('active'));
  assert.equal(w.document.querySelector('.soar-toolbar a').getAttribute('href'),'/sops');
  w.document.querySelector('#soar-btn-O').click();assert.match(w.document.querySelector('#soar-text-display').textContent,/OWNERSHIP/);
  w.document.querySelector('#soar-btn-R').focus();assert.match(w.document.querySelector('#soar-text-display').textContent,/RESPECT/);
 }finally{w.close();}
});
test('SOPs contains SOAR within its content area, while the embedded version starts on S',()=>{
 const dom=page('sops.html'),w=dom.window;
 try{
  w.eval(read('js/main.js'));
  const tab=[...w.document.querySelectorAll('.sops-link')].find(button=>button.textContent==='SOAR Matrix');tab.click();
  assert.ok(tab.classList.contains('active'));
  assert.equal(w.document.querySelector('.sops-content iframe').getAttribute('src'),'/soar?embed=1');
  assert.equal(w.document.querySelector('.sops-content iframe').title,'Classroom expectations');
  [...w.document.querySelectorAll('.sops-link')].find(button=>button.textContent==='Division Norms').click();
  assert.equal(w.document.querySelector('.sops-content iframe'),null);
 }finally{w.close();}
 const embedded=page('soar.html','https://gknest.org/soar?embed=1');
 try{embedded.window.eval(read('js/main.js'));assert.ok(embedded.window.document.body.classList.contains('soar-embedded'));assert.match(embedded.window.document.querySelector('#soar-text-display').textContent,/SAFETY/);assert.equal(embedded.window.document.querySelector('script[src="/js/eagle-menu.js"]'),null);}finally{embedded.window.close();}
});
test('eagle menu reuses all four gears and their destinations; hover, pin, outside click and Escape work',async()=>{
 for(const file of ['index.html','solidprofessor.html','sops.html']){
  const dom=page(file),w=dom.window;
  w.fetch=async()=>({ok:true,text:async()=>read('index.html')});
  try{
   w.eval(read('js/eagle-menu.js'));await tick();
   const wrapper=w.document.querySelector('.logo-container'),button=wrapper.querySelector('button'),menu=w.document.querySelector('#eagle-menu');
   assert.equal(menu.hidden,true);
   assert.deepEqual([...menu.querySelectorAll(':scope > div > details > summary')].map(node=>node.textContent),['⚙️ SOAR','⚙️ Tools','⚙️ Resources','⚙️ Command']);
   assert.ok(menu.querySelector('a[href="/solidprofessor"]'));assert.ok(menu.querySelector('a[href="/thingiverse"]'));
   assert.equal(menu.querySelectorAll('a[data-resource-exit]').length,6);
   assert.equal(menu.querySelectorAll('[id]').length,0);
   const enter=new w.Event('pointerenter');Object.defineProperty(enter,'pointerType',{value:'mouse'});wrapper.dispatchEvent(enter);
   assert.equal(menu.hidden,false);assert.equal(button.getAttribute('aria-expanded'),'true');
   button.click();const leave=new w.Event('pointerleave');Object.defineProperty(leave,'pointerType',{value:'mouse'});wrapper.dispatchEvent(leave);
   assert.equal(menu.hidden,false);
   w.document.body.click();assert.equal(menu.hidden,true);
   button.click();assert.equal(menu.hidden,false);
   button.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(menu.hidden,true);
   assert.equal(w.document.activeElement,button);
  }finally{w.close();}
 }
});
