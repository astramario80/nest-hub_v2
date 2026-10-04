import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('Quick Access ends with a username menu and switches to Log in after logout',async()=>{
  const dom=new JSDOM('<!doctype html><body><header><div class="header-dropdown"><button class="dropdown-btn">Quick Access</button><div class="dropdown-content"><a href="/hiring">Join Us</a></div></div></header></body>',{runScripts:'outside-only',url:'https://gknest.org/'});
  const w=dom.window,menu=w.document.querySelector('.dropdown-content');
  w.fetch=async (_url,options)=>options?.method==='POST'?{ok:true,json:async()=>({})}:{ok:true,json:async()=>({signedIn:true,username:'mario',email:'mario@memberhq.net'})};
  w.eval(read('js/nest-auth.js'));await w.NestAuth.ready;
  assert.equal(menu.lastElementChild.className,'nest-auth-user-menu');
  const toggle=menu.querySelector('.nest-auth-user-toggle'),options=menu.querySelector('.nest-auth-user-options');
  assert.equal(toggle.textContent,'mario');assert.equal(options.hidden,true);
  toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(options.hidden,false);
  assert.equal(options.querySelector('a').getAttribute('href'),'/profile');
  assert.equal(options.querySelectorAll('a')[1].getAttribute('href'),'/profile#diagnostics');
  assert.deepEqual([...options.children].map(item=>item.textContent),['Profile','Access diagnostics','Log out']);
  w.document.body.click();assert.equal(options.hidden,true);
  toggle.click();options.querySelector('button').click();await tick();
  assert.equal(menu.lastElementChild.textContent,'Log in');
  dom.window.close();
});

test('profile shows student accounts only to administrators and keeps the site frame',async()=>{
  const dom=new JSDOM(read('profile.html'),{runScripts:'outside-only',url:'https://gknest.org/profile'});
  const w=dom.window,q=selector=>w.document.querySelector(selector);
  let identity={signedIn:true,username:'mario',email:'mario@memberhq.net'};
  w.NestAuth={get identity(){return identity;},ready:Promise.resolve(),open(){},refresh:async()=>identity};
  w.fetch=async()=>({ok:true,json:async()=>({username:'mario',manual:false,recoveryEmail:'mario@memberhq.net'})});
  w.eval(read('js/profile.js'));await tick();
  assert.equal(q('#profile-admin-tab').hidden,false);
  assert.equal(q('#profile-diagnostics-tab').hidden,false);
  assert.equal(q('#profile-details-panel').hidden,false);
  q('#profile-admin-tab').click();
  assert.equal(q('#profile-admin-panel').hidden,false);
  assert.equal(q('#profile-details-panel').hidden,true);
  assert.equal(w.location.hash,'#accounts');
  assert.ok(q('.header-dropdown .dropdown-btn').textContent.includes('Quick Access'));
  assert.ok(q('.footer-dropdown-title').textContent.includes('Help'));
  assert.ok(q('.copyright').textContent.includes('Copyright ©'));
  assert.equal(q('link[rel="icon"]').getAttribute('href'),'/assets/nest_menu_icon.png');
  identity={signedIn:true,username:'student',email:'student@students.bethelsd.org'};
  w.document.dispatchEvent(new w.Event('nest-auth-change'));await tick();
  assert.equal(q('#profile-admin-tab').hidden,true);
  assert.equal(q('#profile-diagnostics-tab').hidden,true);
  q('#profile-diagnostics-tab').click();
  assert.equal(q('#profile-diagnostics-panel').hidden,true);
  assert.equal(q('#profile-admin-panel').hidden,true);
  identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));
  assert.equal(q('#profile-signed-in').hidden,true);
  assert.equal(q('#profile-signed-out').hidden,false);
  dom.window.close();
});

test('administrator account list loads inside the profile tab',async()=>{
  const dom=new JSDOM(read('profile.html'),{runScripts:'outside-only',url:'https://gknest.org/profile#accounts'});
  const w=dom.window,q=selector=>w.document.querySelector(selector);
  const identity={signedIn:true,username:'mario',email:'mpenalver@bethelsd.org'};
  w.NestAuth={identity,ready:Promise.resolve(identity),refresh:async()=>identity};
  w.fetch=async (_url,options)=>{
    const body=JSON.parse(options.body);
    return {ok:true,json:async()=>body.action==='admin-list'?{accounts:[{username:'student1',studentName:'Sample Student',period:'1',studentEmail:'student@students.bethelsd.org'}]}:{username:'mario',manual:false,recoveryEmail:identity.email}};
  };
  w.eval(read('js/profile.js'));w.eval(read('js/admin-accounts.js'));await tick();await tick();
  assert.equal(q('#profile-admin-panel').hidden,false);
  assert.equal(q('#admin-tools').hidden,false);
  assert.match(q('#admin-accounts-list').textContent,/Sample Student/);
  assert.equal(q('#admin-accounts-list .account-entry input[name="password"]').value,'');
  dom.window.close();
});

test('diagnostics loads lazily in the owner profile tab and reuses records across tab switches',async()=>{
 const dom=new JSDOM(read('profile.html'),{runScripts:'outside-only',url:'https://gknest.org/profile'}),w=dom.window,d=w.document;
 w.NestAuth={identity:{signedIn:true,username:'mario',email:'astramario@gmail.com'},ready:Promise.resolve()};w.AbortSignal=AbortSignal;
 let requests=0;w.fetch=async url=>{if(url==='/api/diagnostics')requests++;return {ok:true,json:async()=>url==='/api/diagnostics'?{events:[]}:{username:'mario'}};};
 w.eval(read('js/profile.js'));w.eval(read('js/diagnostics.js'));await tick();assert.equal(requests,0);
 d.getElementById('profile-diagnostics-tab').click();await tick();assert.equal(requests,1);assert.equal(w.location.hash,'#diagnostics');assert.equal(d.getElementById('profile-diagnostics-panel').hidden,false);assert.equal(d.getElementById('profile-details-panel').hidden,true);
 d.getElementById('profile-details-tab').click();d.getElementById('profile-diagnostics-tab').click();await tick();assert.equal(requests,1);
 d.getElementById('diagnostics-refresh').click();await tick();assert.equal(requests,2);dom.window.close();
});
