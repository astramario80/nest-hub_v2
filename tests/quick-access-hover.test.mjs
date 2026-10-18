import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
async function menu(){
 const dom=new JSDOM('<!doctype html><body><div class="header-dropdown"><button class="dropdown-btn">Quick Access</button><div class="dropdown-content"><a href="/profile">Profile</a></div></div><button id="outside">Outside</button></body>',{runScripts:'outside-only',url:'https://gknest.org/'}),w=dom.window;
 await new Promise(resolve=>setImmediate(resolve));
 w.eval(fs.readFileSync('js/main.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const timers=new Map(),nativeTimeout=w.setTimeout.bind(w),nativeClear=w.clearTimeout.bind(w);let id=100000;
 w.setTimeout=(fn,ms)=>{if(ms!==450)return nativeTimeout(fn,ms);timers.set(++id,fn);return id;};w.clearTimeout=id=>{if(!timers.delete(id))nativeClear(id);};
 const wrapper=w.document.querySelector('.header-dropdown'),button=wrapper.firstElementChild,content=button.nextElementSibling;
 return {dom,w,wrapper,button,content,flush:()=>{const tasks=[...timers.values()];timers.clear();tasks.forEach(fn=>fn());}};
}
test('Quick Access keeps hovering menu open through brief pointer excursions and closes after the grace period',async()=>{
 const {dom,w,wrapper,button,flush}=await menu();
 wrapper.dispatchEvent(new w.Event('pointerenter'));assert.equal(wrapper.classList.contains('menu-hover-open'),true);assert.equal(button.getAttribute('aria-expanded'),'true');
 wrapper.dispatchEvent(new w.Event('pointerleave'));assert.equal(wrapper.classList.contains('menu-hover-open'),true);
 wrapper.dispatchEvent(new w.Event('pointerenter'));flush();assert.equal(wrapper.classList.contains('menu-hover-open'),true);
 wrapper.dispatchEvent(new w.Event('pointerleave'));flush();assert.equal(wrapper.classList.contains('menu-hover-open'),false);assert.equal(button.getAttribute('aria-expanded'),'false');dom.window.close();
});
test('Quick Access retains click pinning and keyboard focus, while outside click and Escape dismiss it immediately',async()=>{
 const {dom,w,wrapper,button,content,flush}=await menu(),outside=w.document.getElementById('outside');
 wrapper.dispatchEvent(new w.Event('pointerenter'));button.click();wrapper.dispatchEvent(new w.Event('pointerleave'));flush();assert.equal(content.classList.contains('show'),true);
 outside.click();assert.equal(content.classList.contains('show'),false);assert.equal(wrapper.classList.contains('menu-hover-open'),false);
 wrapper.dispatchEvent(new w.Event('pointerleave'));content.querySelector('a').focus();flush();assert.equal(wrapper.classList.contains('menu-hover-open'),true);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(wrapper.classList.contains('menu-hover-open'),false);assert.equal(button.getAttribute('aria-expanded'),'false');
 outside.focus();flush();assert.equal(wrapper.classList.contains('menu-hover-open'),false);dom.window.close();
});
