import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync('js/embed-size.js','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function page(){return new JSDOM('<main><h1>Resource</h1><iframe title="Resource" src="https://example.org/"></iframe></main>',{url:'https://gknest.org/',runScripts:'outside-only'});}

test('expand and restore retain the same iframe and return keyboard focus',()=>{
  const dom=page(),w=dom.window;
  try{
    const frame=w.document.querySelector('iframe'),parent=frame.parentElement;
    w.eval(source);const button=w.document.querySelector('.nest-embed-expand');button.click();
    assert.equal(frame.parentElement,parent);assert.equal(frame.src,'https://example.org/');
    assert.equal(parent.classList.contains('nest-expanded-embed'),true);
    assert.equal(button.textContent,'Restore view');assert.equal(button.getAttribute('aria-expanded'),'true');
    button.click();assert.equal(w.document.querySelector('iframe'),frame);
    assert.equal(parent.classList.contains('nest-expanded-embed'),false);
    assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(w.document.activeElement,button);
    button.click();w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(parent.classList.contains('nest-expanded-embed'),false);
  }finally{w.close();}
});

test('late-loading frames get one control and removing an expanded frame cleans up',async()=>{
  const dom=page(),w=dom.window;
  try{
    w.eval(source);w.eval(source);
    const section=w.document.createElement('section'),frame=w.document.createElement('iframe');frame.title='Application';section.append(frame);w.document.body.append(section);
    await tick();assert.equal(w.document.querySelectorAll('.nest-embed-expand').length,2);
    const button=section.querySelector('button');button.click();frame.remove();await tick();
    assert.equal(w.document.body.classList.contains('nest-embed-expanded'),false);assert.equal(button.isConnected,false);
    const dialog=w.document.createElement('dialog');dialog.className='resource-viewer';dialog.append(w.document.createElement('iframe'));w.document.body.append(dialog);await tick();
    assert.equal(dialog.querySelector('button'),null);
  }finally{w.close();}
});

test('browser fullscreen exits cleanly and denied fullscreen keeps the expanded viewport',async()=>{
  const dom=page(),w=dom.window;
  try{
    const parent=w.document.querySelector('main');let full=null;
    Object.defineProperty(w.document,'fullscreenElement',{get:()=>full});
    parent.requestFullscreen=async()=>{full=parent;};
    w.document.exitFullscreen=async()=>{full=null;w.document.dispatchEvent(new w.Event('fullscreenchange'));};
    w.eval(source);const button=w.document.querySelector('button');button.click();await tick();assert.equal(full,parent);
    button.click();await tick();assert.equal(full,null);assert.equal(button.getAttribute('aria-expanded'),'false');
    parent.requestFullscreen=async()=>{throw new Error('Unavailable');};button.click();await tick();
    assert.equal(parent.classList.contains('nest-expanded-embed'),true);button.click();
    assert.equal(parent.classList.contains('nest-expanded-embed'),false);
  }finally{w.close();}
});
