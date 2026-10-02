import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {signalsClasses} from '../lib/signals-classes.mjs';
test('school service reads only the fixed summary and returns eligibility without names, preps or counts',()=>{
 let range;
 const ctx=vm.createContext({NEST_DATABASE:'fixed',Sheets:{Spreadsheets:{Values:{get:(id,r)=>{assert.equal(id,'fixed');range=r;return {values:[['Period 1','Course',22],['Period 3','PLANNING',0],['CTSO','Robotics',21]]};}}}}});
 vm.runInContext(readFileSync('google-spinner/Signals.js','utf8'),ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('signalsClasses_()',ctx))),{status:200,classes:{'1':true,'3':false,CTSO:true}});
 assert.equal(range,"'Schedule'!A9:C");
});
test('invalid or unavailable counts never masquerade as empty classes',async()=>{
 for(const result of [{status:503},{status:200,classes:{}},{status:200,classes:{'1':22}},{status:200,classes:{email:false}}])await assert.rejects(signalsClasses(async()=>result));
 assert.deepEqual(await signalsClasses(async()=>({status:200,classes:{'1':true,'3':false}})),{'1':true,'3':false});
});
