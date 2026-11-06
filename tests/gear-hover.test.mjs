import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
function fixture(){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://gknest.org/',runScripts:'outside-only'}),w=dom.window,timers=new Map();let serial=0,keyboard=false;
 w.matchMedia=()=>({matches:true});w.setTimeout=callback=>{timers.set(++serial,callback);return serial;};w.clearTimeout=id=>timers.delete(id);
 // JSDOM does not model the browser's pointer versus keyboard focus modality.
 const matches=w.HTMLElement.prototype.matches;w.HTMLElement.prototype.matches=function(selector){return selector===':focus-visible'?keyboard&&this===w.document.activeElement:matches.call(this,selector);};
 w.eval(fs.readFileSync('js/disclosures.js','utf8'));
 const gears=[...w.document.querySelectorAll('.home-dashboard > .gear-panel')],pointer=(element,type,pointerType='mouse')=>{const e=new w.Event(type,{bubbles:type==='pointerdown'});Object.defineProperty(e,'pointerType',{value:pointerType});element.dispatchEvent(e);};
 return {dom,w,gears,pointer,click(gear,type='mouse'){keyboard=false;const b=gear.querySelector(':scope > button');pointer(b,'pointerdown',type);b.focus();b.click();},keyboard(gear){keyboard=true;gear.querySelector(':scope > button').focus();},flush(){for(const [id,callback] of [...timers]){timers.delete(id);callback();}},open:()=>gears.map(g=>g.classList.contains('is-open'))};
}
test('moving between any pair of gears closes the mouse-focused previous gear, including SOAR and Command',()=>{
 for(let from=0;from<4;from++)for(let to=0;to<4;to++){if(from===to)continue;const f=fixture();try{f.click(f.gears[from]);assert.equal(f.open()[from],true);f.pointer(f.gears[from],'pointerleave');f.pointer(f.gears[to],'pointerenter');assert.deepEqual(f.open(),f.gears.map((_,i)=>i===to));f.flush();assert.equal(f.open()[to],true);}finally{f.dom.window.close();}}
});
test('mouse-off closes a clicked gear even if its trigger still holds mouse focus',()=>{for(let i=0;i<4;i++){const f=fixture();try{f.click(f.gears[i]);f.pointer(f.gears[i],'pointerleave');f.flush();assert.equal(f.open()[i],false);assert.equal(f.gears[i].querySelector(':scope > button').getAttribute('aria-expanded'),'false');assert.equal(f.gears[i].querySelector(':scope > button').nextElementSibling.hidden,true);}finally{f.dom.window.close();}}});
test('keyboard focus and Escape stay usable; touch-open gears survive touch pointerleave',()=>{const f=fixture();try{f.keyboard(f.gears[0]);f.pointer(f.gears[0],'pointerleave');f.flush();assert.equal(f.open()[0],true);f.gears[0].dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.open()[0],false);f.click(f.gears[3],'touch');f.pointer(f.gears[3],'pointerleave','touch');f.flush();assert.equal(f.open()[3],true);}finally{f.dom.window.close();}});
test('moving inside a gear keeps its selected submenu open; leaving closes both',()=>{const f=fixture();try{const tools=f.gears[1];f.pointer(tools,'pointerenter');const nested=tools.querySelector('.gear-group');f.pointer(nested.querySelector('button'),'pointerdown');nested.querySelector('button').click();f.pointer(nested,'pointerleave');f.flush();assert.equal(nested.classList.contains('is-open'),true);f.pointer(tools,'pointerleave');f.flush();assert.equal(tools.classList.contains('is-open'),false);assert.equal(nested.classList.contains('is-open'),false);}finally{f.dom.window.close();}});
