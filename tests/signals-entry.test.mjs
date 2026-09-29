import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/signals-entry.js','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(identity, result={ok:true,status:200,data:{allowed:true}}, search='') {
  const listeners={},elements={},destinations=[];let opened=0,requests=0;
  const auth={identity,ready:Promise.resolve(),open(){opened++;},async logout(){auth.identity=null;listeners['nest-auth-change']?.();},async refresh(){listeners['nest-auth-change']?.();return auth.identity;}};
  const ctx=vm.createContext({URL,URLSearchParams,AbortSignal,location:{origin:'https://gknest.org',search,replace:value=>destinations.push(value)},document:{querySelector:id=>elements[id] ||= {hidden:true,addEventListener:(event,fn)=>listeners[id+event]=fn},addEventListener:(name,fn)=>listeners[name]=fn},window:{NestAuth:auth,addEventListener:(name,fn)=>listeners[name]=fn},fetch:async()=>{requests++;if(result instanceof Error)throw result;return {ok:result.ok,status:result.status,json:async()=>result.data};}});
  vm.runInContext(source,ctx);
  return {auth,elements,listeners,destinations,get opened(){return opened;},get requests(){return requests;}};
}
test('existing NEST login proceeds without asking the user to sign in again',async()=>{
  const s=setup({signedIn:true,email:'manager@students.bethelsd.org'});await tick();
  assert.equal(s.opened,0);assert.equal(s.requests,1);assert.deepEqual(s.destinations,['https://gknest.org/api/signals?asset=index']);
});
test('signed-out entry opens real login and automatically proceeds after login event',async()=>{
  const s=setup(null);await tick();assert.equal(s.opened,1);assert.equal(s.requests,0);
  assert.equal(s.elements['#signals-login'].hidden,false);
  s.auth.identity={signedIn:true,email:'manager@students.bethelsd.org'};s.listeners['nest-auth-change']();await tick();
  assert.equal(s.elements['#signals-login'].hidden,true);assert.equal(s.destinations.length,1);
});
test('login button invokes authentication and focus detects login in another tab',async()=>{
  const s=setup(null);await tick();await s.listeners['#signals-loginclick']();assert.equal(s.opened,2);
  s.auth.identity={signedIn:true};await s.listeners.focus();await tick();assert.equal(s.destinations.length,1);
});
test('unauthorized role and network failure never open player',async()=>{
  for(const result of [{ok:false,status:403,data:{}},new Error('offline')]) {
    const s=setup({signedIn:true,email:'student@students.bethelsd.org'},result);await tick();
    assert.equal(s.destinations.length,0);assert.equal(s.elements['#signals-retry'].hidden,false);
  }
});
test('OAuth callback survives sign-in and untrusted redirect destinations are ignored',async()=>{
  const s=setup(null,undefined,'?code=example-code&state=example-state&next=https://evil.test&asset=app');await tick();
  s.auth.identity={signedIn:true};s.listeners['nest-auth-change']();await tick();
  const target=new URL(s.destinations[0]);assert.equal(target.origin,'https://gknest.org');assert.equal(target.searchParams.get('asset'),'index');assert.equal(target.searchParams.get('code'),'example-code');assert.equal(target.searchParams.get('state'),'example-state');assert.equal(target.searchParams.has('next'),false);
});
