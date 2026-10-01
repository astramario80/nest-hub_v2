import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
const source=fs.readFileSync('js/resource-viewer.js','utf8');
function page(url,navigation){const dom=new JSDOM('<main><h1>Billboards</h1><a id="source">Division 1</a></main>',{url:'https://gknest.org/billboards',runScripts:'outside-only'});const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.document.querySelector('a').href=url;w.eval('(function(location){'+source+'\n})')(navigation||w.location);return dom;}
test('Padlet opens in a contained viewer; close removes the frame and returns focus',()=>{const d=page('https://padlet.com/astramario/project-billboard_period1-h5lmpj4m7g51sy0v'),w=d.window;w.document.querySelector('#source').click();const f=w.document.querySelector('iframe');assert.equal(f.src,'https://padlet.com/embed/h5lmpj4m7g51sy0v');assert.match(f.title,/Billboards.*Division 1/);assert.equal(f.getAttribute('sandbox'),null);w.document.querySelector('[data-close]').click();assert.equal(w.document.querySelector('iframe'),null);assert.equal(w.document.activeElement.id,'source');w.close();});
test('Google views use live originals, forms embed mode, and provider permissions',()=>{for(const [url,expected] of [['https://docs.google.com/document/d/example/edit?tab=t.0','https://docs.google.com/document/d/example/preview'],['https://docs.google.com/forms/d/e/example/viewform','https://docs.google.com/forms/d/e/example/viewform?embedded=true']]){const d=page(url);d.window.document.querySelector('#source').click();assert.equal(d.window.document.querySelector('iframe').src,expected);assert.equal(d.window.document.querySelector('[data-original]').href,new URL(url).href);d.window.close();}});
test('providers blocking frames show a direct launch option without a broken iframe',()=>{for(const url of ['https://app.smartpass.app/main/passes','https://portal.bethelsd.org']){const d=page(url);d.window.document.querySelector('#source').click();assert.equal(d.window.document.querySelector('iframe'),null);assert.equal(d.window.document.querySelector('[data-original]').href,new URL(url).href);assert.match(d.window.document.querySelector('[data-help]').textContent,/requires its own tab/);d.window.close();}});
test('internal and modified clicks retain their normal navigation',()=>{const d=page('https://padlet.com/astramario/test-h5lmpj4m7g51sy0v'),w=d.window;w.document.querySelector('#source').dispatchEvent(new w.MouseEvent('click',{bubbles:true,ctrlKey:true,cancelable:true}));assert.equal(w.document.querySelector('iframe'),null);w.document.querySelector('#source').href='/leadership';const e=new w.MouseEvent('click',{bubbles:true,cancelable:true});w.document.querySelector('#source').dispatchEvent(e);assert.equal(e.defaultPrevented,false);w.close();});
test('Tech Ticket gear opens the backend only after a technician access check',async()=>{
 const form='https://docs.google.com/forms/d/e/1FAIpQLSeB9z95XH0vrXiglF1Mr15pxrhhkLS3jYBDZOx6tki3Rt3Mkw/viewform';
 const backend='https://docs.google.com/spreadsheets/d/169SCXhVH1ufehSUSv_qkbVBJhrdz4MVAjBMOUfDBMGg/edit?gid=1649772389#gid=1649772389';
 const d=page(form),w=d.window;w.AbortSignal=AbortSignal;let calls=0;
 w.fetch=async()=>{calls++;return {ok:true,json:async()=>({url:backend})};};
 try{
  w.document.querySelector('#source').click();await new Promise(resolve=>setImmediate(resolve));
  const gear=w.document.querySelector('[data-tech-backend]');assert.equal(calls,1);assert.equal(gear.hidden,false);assert.equal(gear.href,backend);assert.equal(gear.target,'_blank');
  w.document.querySelector('[data-close]').click();assert.equal(gear.hidden,true);assert.equal(gear.hasAttribute('href'),false);
 }finally{w.close();}
 const denied=page(form),wd=denied.window;wd.AbortSignal=AbortSignal;wd.fetch=async()=>({ok:false,status:403});
 try{wd.document.querySelector('#source').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(wd.document.querySelector('[data-tech-backend]').hidden,true);}finally{wd.close();}
 const other=page('https://docs.google.com/forms/d/e/another/viewform'),wo=other.window;wo.AbortSignal=AbortSignal;wo.fetch=()=>{throw new Error('Other forms must not check tech access');};
 try{wo.document.querySelector('#source').click();assert.equal(wo.document.querySelector('[data-tech-backend]').hidden,true);}finally{wo.close();}
});

test('all external Resources links wait for OK and open in a separate tab',()=>{
 const menu=new JSDOM(fs.readFileSync('index.html','utf8'));
 const links=[...menu.window.document.querySelectorAll('#gear-2 a[data-resource-exit]')];
 assert.equal(links.length,6);
 for(const link of links){
  const d=page(link.href),w=d.window,opener=w.document.querySelector('#source');
  opener.setAttribute('data-resource-exit','');
  try{
   assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');
   const click=new w.MouseEvent('click',{bubbles:true,cancelable:true});opener.dispatchEvent(click);
   const notice=w.document.querySelector('[aria-labelledby="resource-exit-title"]'),ok=notice.querySelector('[data-exit-ok]');
   assert.equal(click.defaultPrevented,true);assert.equal(notice.open,true);
   assert.equal(w.document.querySelector('iframe'),null);
   assert.equal(w.document.querySelector('dialog.resource-viewer').open,false);
   assert.equal(notice.querySelector('h2').textContent,'We are now leaving the NEST™ Universe.');
   assert.equal(ok.href,link.href);assert.equal(ok.target,'_blank');assert.equal(ok.rel,'noopener noreferrer');
   assert.equal(w.document.activeElement,ok);
   const confirm=new w.MouseEvent('click',{bubbles:true,cancelable:true});ok.dispatchEvent(confirm);
   assert.equal(confirm.defaultPrevented,false);assert.equal(notice.open,false);
   assert.equal(w.document.activeElement,opener);assert.equal(w.location.href,'https://gknest.org/billboards');
  }finally{w.close();}
 }
 menu.window.close();
});
test('Cancel keeps the resource closed and returns focus to the menu link',()=>{
 const d=page('https://www.tinkercad.com/login'),w=d.window,opener=w.document.querySelector('#source');
 opener.setAttribute('data-resource-exit','');
 try{
  opener.click();w.document.querySelector('[data-exit-cancel]').click();
  assert.equal(w.document.querySelector('[aria-labelledby="resource-exit-title"]').open,false);
  assert.equal(w.document.querySelector('iframe'),null);assert.equal(w.document.activeElement,opener);
 }finally{w.close();}
});
test('SolidProfessor and Thingiverse have internal pages with working NEST chrome',()=>{
 const menu=new JSDOM(fs.readFileSync('index.html','utf8'));
 for(const [slug,url] of [['solidprofessor','https://www.solidprofessor.com/account/login'],['thingiverse','https://www.thingiverse.com/education']]){
  const link=menu.window.document.querySelector(`#gear-2 a[href="/${slug}"]`);
  assert.ok(link);assert.equal(link.hasAttribute('data-resource-exit'),false);assert.equal(link.target,'');
  const dom=new JSDOM(fs.readFileSync(slug+'.html','utf8'),{url:`https://gknest.org/${slug}`,runScripts:'outside-only'}),w=dom.window;
  try{
   w.eval(fs.readFileSync('js/main.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
   assert.equal(w.document.querySelector('main iframe').src,url);
   assert.equal(w.document.querySelector('.embedded-resource-menu').getAttribute('href'),'/');
   assert.equal(w.document.querySelector('header .logo-container a').getAttribute('href'),'/');
   assert.equal(w.document.querySelector('#current-year').textContent,String(new Date().getFullYear()));
   for(const selector of ['.dropdown-btn','.footer-dropdown-title']){
    const toggle=w.document.querySelector(selector);toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.ok(toggle.nextElementSibling.classList.contains('show'));
    w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));
    assert.equal(toggle.getAttribute('aria-expanded'),'false');
   }
   assert.ok(w.document.querySelector('script[src="/js/nest-auth.js"]'));
  }finally{w.close();}
 }
 menu.window.close();
});
