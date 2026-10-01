import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/signals-entry.js','utf8');
test('public entry opens without identity or authentication libraries',()=>{
  let destination;
  vm.runInNewContext(source,{URL,URLSearchParams,location:{origin:'https://gknest.org',search:'',replace:url=>destination=url}});
  assert.equal(destination,'https://gknest.org/api/signals?asset=index');
});
test('Spotify callback survives public entry and arbitrary redirects are ignored',()=>{
  let destination;
  vm.runInNewContext(source,{URL,URLSearchParams,location:{origin:'https://gknest.org',search:'?code=abc&state=def&error=example&redirect=https://evil.test',replace:url=>destination=url}});
  const url=new URL(destination);assert.equal(url.origin,'https://gknest.org');assert.equal(url.searchParams.get('code'),'abc');assert.equal(url.searchParams.get('state'),'def');assert.equal(url.searchParams.get('error'),'example');assert.equal(url.searchParams.has('redirect'),false);
});
