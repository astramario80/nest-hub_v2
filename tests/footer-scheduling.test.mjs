import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const release=process.env.NEST_FOOTER_RELEASE||'.';
const footer='<div class="footer-dropdown"><span class="footer-dropdown-title">About Me ▾</span><div class="footer-dropdown-content"><a href="https://www.linkedin.com/in/astramario/">LinkedIn</a></div></div>';
test('every released static About Me footer contains the canonical scheduling link',()=>{
 let checked=0;
 for(const file of fs.readdirSync(release).filter(name=>name.endsWith('.html'))){
  const dom=new JSDOM(fs.readFileSync(release+'/'+file,'utf8'));
  for(const wrapper of dom.window.document.querySelectorAll('.footer-dropdown')){
   if(!wrapper.querySelector('.footer-dropdown-title')?.textContent.includes('About Me'))continue;
   const links=wrapper.querySelectorAll('a[href="https://calendly.com/mpenalver"]');assert.equal(links.length,1,file);assert.equal(links[0].textContent,'Schedule Me',file);assert.equal(links[0].target,'_blank');checked++;
  }dom.window.close();
 }
 assert.ok(checked>=35);
 for(const file of ['lib/nest-page-shell.mjs','lib/site-layout/footer.html','lib/signals-player/index.txt']){const text=fs.readFileSync(release+'/'+file,'utf8');assert.ok(text.includes('https://calendly.com/mpenalver'),file);assert.ok(text.includes('Schedule Me'),file);}
});
test('shared footer code repairs older and dynamically inserted menus without duplicate links',async()=>{
 const dom=new JSDOM('<body>'+footer+'</body>',{runScripts:'outside-only',url:'https://gknest.org/'}),w=dom.window;
 try{
  const source=fs.readFileSync(release+'/js/main.js','utf8');w.eval(source.slice(0,source.indexOf('// Keep the NEST wordmark')));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(resolve=>setImmediate(resolve));
  let links=w.document.querySelectorAll('a[href="https://calendly.com/mpenalver"]');assert.equal(links.length,1);assert.equal(links[0].textContent,'Schedule Me');assert.equal(links[0].rel,'noopener noreferrer');
  const host=w.document.createElement('footer');host.innerHTML=footer;w.document.body.append(host);await new Promise(resolve=>setImmediate(resolve));links=w.document.querySelectorAll('a[href="https://calendly.com/mpenalver"]');assert.equal(links.length,2);assert.equal(links[1].textContent,'Schedule Me');
 }finally{w.close();}
});
test('shared navigation repairs old Join Us headers and marks LinkedIn for the existing exit dialog',async()=>{const dom=new JSDOM('<body><header><div class="header-dropdown"><a href="https://docs.google.com/forms/d/e/old/viewform" target="_blank">🚀 Join Us</a></div></header>'+footer+'</body>',{runScripts:'outside-only',url:'https://gknest.org'}),w=dom.window;try{const source=fs.readFileSync('js/main.js','utf8');w.eval(source.slice(0,source.indexOf('// Pin only the shared')));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(r=>setImmediate(r));assert.equal(w.document.querySelector('header a').getAttribute('href'),'/hiring');assert.equal(w.document.querySelector('header a').hasAttribute('target'),false);assert.equal(w.document.querySelector('a[href*=linkedin]').dataset.resourceExit,'LinkedIn');}finally{w.close();}});
test('released Quick Access Join Us links point to the native landing page',()=>{let count=0;for(const file of fs.readdirSync(release).filter(name=>name.endsWith('.html'))){const d=new JSDOM(fs.readFileSync(release+'/'+file,'utf8'));for(const a of d.window.document.querySelectorAll('header .header-dropdown a'))if(/Join\s+Us/i.test(a.textContent)){assert.equal(a.getAttribute('href'),'/hiring',file);count++;}d.window.close();}assert.ok(count>=35);});
