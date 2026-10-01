import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/signals.mjs';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},send(value){this.body=value;return this;},json(value){this.body=value;return this;}});
test('anonymous and expired-session visitors can load Signals without school-service calls',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>assert.fail('public Signals must not call the school bridge');
  try {
    for(const cookie of ['', '__Host-nest-auth=expired']) {
      for(const asset of ['access','index','app']) {
        const res=response();await handler({method:'GET',headers:{cookie},query:{asset}},res);
        assert.equal(res.code,200);assert.equal(res.headers['Set-Cookie'],undefined);
        if(asset==='access')assert.equal(res.body.allowed,true);
        if(asset==='index')assert.match(res.body,/spotify-embed/);
        if(asset==='app')assert.doesNotMatch(res.body,/NEST_ACCESS_VERIFIED_UNTIL|accessCheckedAt/);
      }
    }
  }finally{globalThis.fetch=original;}
});
test('public Signals still rejects unknown assets and unsupported methods',async()=>{
  let res=response();await handler({method:'POST',query:{asset:'index'}},res);assert.equal(res.code,405);
  res=response();await handler({method:'GET',query:{asset:'blocked'}},res);assert.equal(res.code,404);
});
test('Spotify login uses the shared Client ID and preserves the Signals redirect',async()=>{
  const {default:vm}=await import('node:vm');const {readFileSync}=await import('node:fs');const {webcrypto}=await import('node:crypto');
  const source=readFileSync('lib/signals-player/app.txt','utf8').replace(/initialize\(\);\s*$/,'');
  const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const top={location:{}};
  const ctx=vm.createContext({document:{querySelector:()=>({})},window:{top},localStorage:storage,sessionStorage:storage,crypto:webcrypto,TextEncoder,URLSearchParams,btoa});
  vm.runInContext(source,ctx);await vm.runInContext('beginSpotifyLogin()',ctx);
  const url=new URL(top.location.href);
  assert.equal(url.origin,'https://accounts.spotify.com');
  assert.equal(url.searchParams.get('client_id'),'e14ed1a76b2f45c8b3485093be6942f1');
  assert.equal(url.searchParams.get('redirect_uri'),'https://signals.gknest.org/');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.ok(url.searchParams.get('state'));
  assert.doesNotMatch(readFileSync('lib/signals-player/index.txt','utf8'),/id="client-id"/);
});
