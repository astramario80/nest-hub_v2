import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

function ui() {
  const dom = new JSDOM('<a href="/divisions/1" class="trip-card"><span>Division 1</span></a><a href="/divisions/CTSO">CTSO</a>', {url:'https://gknest.org/divisions', runScripts:'outside-only'});
  dom.window.eval(fs.readFileSync('js/main.js', 'utf8'));
  return dom.window;
}
function click(w, link, options = {}) {
  const event = new w.MouseEvent('click', {bubbles:true, cancelable:true, button:0, ...options});
  link.dispatchEvent(event);
  // Stop only JSDOM's unsupported navigation after checking our handler's behavior.
  const prevented = event.defaultPrevented;
  event.preventDefault();
  return prevented;
}

test('HQ click immediately highlights the selected card and leaves native navigation intact', () => {
  const w = ui(), link = w.document.querySelector('a');
  assert.equal(click(w, link.querySelector('span')), false);
  assert.equal(link.getAttribute('aria-busy'), 'true');
  assert.equal(link.classList.contains('division-navigation-pending'), true);
  assert.equal(w.document.querySelector('[role=status]').textContent, 'Opening Division 1…');
  assert.equal(link.hasAttribute('aria-disabled'), false);
  w.dispatchEvent(new w.PageTransitionEvent('pageshow', {persisted:true}));
  assert.equal(link.hasAttribute('aria-busy'), false);
  assert.equal(link.classList.contains('division-navigation-pending'), false);
  assert.equal(w.document.querySelector('[role=status]').hidden, true);
  w.close();
});

test('another choice replaces the pending card, including late-created menu links', () => {
  const w = ui(), first = w.document.querySelector('a');
  first.setAttribute('aria-busy', 'false');
  click(w, first);
  const link = w.document.createElement('a'); link.href='/divisions/CTSO'; w.document.body.append(link);
  click(w, link);
  assert.equal(first.getAttribute('aria-busy'), 'false');
  assert.equal(first.classList.contains('division-navigation-pending'), false);
  assert.equal(w.document.querySelector('[role=status]').textContent, 'Opening CTSO…');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', {key:'Escape'}));
  assert.equal(link.hasAttribute('aria-busy'), false);
  assert.equal(w.document.querySelector('[role=status]').hidden, true);
  w.close();
});

test('modified clicks, other targets, downloads, prevented clicks and unrelated URLs do not show loading', () => {
  const w = ui(), link = w.document.querySelector('a');
  for (const options of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}]) click(w,link,options);
  link.target='_blank'; click(w,link); link.removeAttribute('target');
  link.download=''; click(w,link); link.removeAttribute('download');
  for (const href of ['https://elsewhere.example/divisions/1','/hiring?period=1','/divisions/6','/divisions#same-page']) {link.href=href; click(w,link);}
  link.href='/divisions/1'; link.addEventListener('click', event=>event.preventDefault(), {once:true}); click(w,link);
  assert.equal(w.document.querySelector('[role=status]'), null);
  w.close();
});
