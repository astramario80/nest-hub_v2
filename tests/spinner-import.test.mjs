import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import spinner from '../api/spinner.mjs';
const ui=fs.readFileSync('js/spinner-access.js','utf8');
const module=fs.readFileSync('google-spinner/SpinnerRosters.js','utf8');
const divisions=[{period:'1',member:true,names:['Alex','Blair']},{period:'2',member:false,names:['Alex','Casey']}];
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
test('late-mounted spinner autoimports own division, combines allowed names, and clears on sign-out',async()=>{
 const dom=new JSDOM('<div class="sops-content"><div class="placeholder"></div></div>',{url:'https://gknest.org/sops',runScripts:'outside-only'}),w=dom.window;
 let calls=0;
 w.NestAuth={identity:{email:'member@example.org'},ready:Promise.resolve()};
 w.resetMagicSpinner=()=>{};
 w.fetch=async()=>{calls++;return {ok:true,json:async()=>({divisions})};};
 w.eval(ui);
 w.document.querySelector('.placeholder').innerHTML='<section id="spinner-access"></section><textarea id="spinner-names"></textarea><p id="spinner-status"></p>';
 await flush();await flush();
 assert.equal(w.document.querySelector('#spinner-names').value,'Alex\nBlair');
 assert.equal(calls,1);
 w.document.querySelector('select').value='all';w.document.querySelector('[data-import]').click();await flush();
 assert.equal(w.document.querySelector('#spinner-names').value,'Alex\nBlair\nCasey');assert.equal(calls,2);
 w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));
 assert.equal(w.document.querySelector('#spinner-names').value,'');assert.equal(w.document.querySelector('[data-controls]').hidden,true);
 dom.window.close();
});
test('an import completing after sign-out cannot restore names',async()=>{
 const dom=new JSDOM('<div class="sops-content"><div class="placeholder"><section id="spinner-access"></section><textarea id="spinner-names"></textarea><p id="spinner-status"></p></div></div>',{url:'https://gknest.org/sops',runScripts:'outside-only'}),w=dom.window;
 let finish;w.NestAuth={identity:{email:'member@example.org'},ready:Promise.resolve()};
 w.fetch=()=>new Promise(resolve=>finish=resolve);w.eval(ui);
 w.NestAuth.identity=null;w.document.dispatchEvent(new w.Event('nest-auth-change'));
 finish({ok:true,json:async()=>({divisions})});await flush();
 assert.equal(w.document.querySelector('#spinner-names').value,'');dom.window.close();
});
test('school importer restricts rosters and rechecks membership on every request',()=>{
 let member=true,owner=false,valid=true;
 const ctx=vm.createContext({NEST_ACCESS_READS:null,Map,Set,Date,PERIODS:{1:'private',2:'private'},PropertiesService:{getScriptProperties:()=>({})},authSession_:()=>valid?{email:'member@example.org',expires:Date.now()+10000}:null,globalAccess_:()=>owner,rows_:p=>p==='1'?[['Alex',member?'member@example.org':'revoked@example.org'],['Alex duplicate',member?'member@example.org':'revoked@example.org']]:[['Casey','other@example.org']],email_:x=>x,memberEmail_:x=>x,manualPeriodAccess_:()=>false,manager_:()=>false,editorGrant_:()=>null});
 vm.runInContext(module,ctx);
 let result=ctx.spinnerRosters_('session');assert.equal(result.divisions.length,1);assert.equal(result.divisions[0].names.length,1);assert.ok(!JSON.stringify(result).includes('@'));
 member=false;assert.equal(ctx.spinnerRosters_('session').divisions.length,0);
 owner=true;assert.equal(ctx.spinnerRosters_('session').divisions.length,2);
 valid=false;assert.equal(ctx.spinnerRosters_('session').status,401);
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};}
test('API requires authentication and returns only validated roster fields',async()=>{
 const req={method:'POST',headers:{origin:'https://gknest.org','content-type':'application/json'},body:{action:'rosters'}};
 let res=response();await spinner(req,res);assert.equal(res.code,401);
 const oldFetch=global.fetch,oldUrl=process.env.SPINNER_BRIDGE_URL,oldToken=process.env.SPINNER_BRIDGE_TOKEN;
 process.env.SPINNER_BRIDGE_URL='https://school.example/exec';process.env.SPINNER_BRIDGE_TOKEN='test';
 global.fetch=async(_url,options)=>{assert.equal(JSON.parse(options.body).action,'auth-spinner-rosters');return {ok:true,json:async()=>({status:200,expires:Date.now()+10000,divisions:divisions.map(d=>({...d,email:'must not leave API'}))})};};
 try {res=response();await spinner({...req,headers:{...req.headers,cookie:'__Host-nest-auth='+'a'.repeat(64)}},res);assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');assert.ok(!JSON.stringify(res.data).includes('must not leave API'));}
 finally{global.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SPINNER_BRIDGE_URL;else process.env.SPINNER_BRIDGE_URL=oldUrl;if(oldToken===undefined)delete process.env.SPINNER_BRIDGE_TOKEN;else process.env.SPINNER_BRIDGE_TOKEN=oldToken;}
});
