import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const source=['Code.js','Auth.js','Tracker.js','DivisionSlides.js'].map(file=>fs.readFileSync('google-spinner/'+file,'utf8')).join('\n');
const token='a'.repeat(64),hash=value=>createHash('sha256').update(value).digest('hex');
function service(manual=false){
 const email=manual?'manual:manager':'manager@students.bethelsd.org',account=['manager',email,'','',true,1,'','','1','','manager@students.bethelsd.org'];
 let leaders=[['Period 1','','Division Manager','Manager, Morgan','manager@students.bethelsd.org']],roster=[['Manager, Morgan','','manager@students.bethelsd.org']],failLeadership=false;
 const state=new Map([['authsession:'+hash(token),JSON.stringify({email,version:1,expires:Date.now()+60000})]]),parallel=[],fallback=[];
 const store={getProperty:k=>state.get(k),deleteProperty:k=>state.delete(k)};
 const values=range=>range.includes('StudentNESTAccess')?[account]:range.includes('Imported')?leaders:range.includes('Period 1')?roster:[];
 const ctx=vm.createContext({console,Date,PropertiesService:{getScriptProperties:()=>store},ScriptApp:{getOAuthToken:()=> 'owner-oauth'},Utilities:{DigestAlgorithm:{SHA_256:'sha'},computeDigest:(_,value)=>[...createHash('sha256').update(value).digest()]},UrlFetchApp:{fetchAll:requests=>{
  parallel.push(requests);return requests.map((request,index)=>({getResponseCode:()=>index===1&&failLeadership?503:200,getContentText:()=>JSON.stringify({valueRanges:new URL(request.url).searchParams.getAll('ranges').map(range=>({values:values(range)}))})}));
 }},Sheets:{Spreadsheets:{Values:{get:(_id,range)=>{fallback.push(range);return {values:values(range)};}}}}});
 vm.runInContext(source,ctx);
 const request={action:'auth-division-slides',operation:'access',period:'1',session:token};
 const read=()=>ctx.withNestReadContext_(request,()=>ctx.divisionSlidesDispatch_(request));
 return {ctx,read,parallel,fallback,account,revokeRole:()=>leaders[0][2]='Software Technician',revokeMembership:()=>roster=[],failRead:()=>failLeadership=true,request};
}
test('access reads account and roster together while fetching leadership in parallel, including manual accounts',()=>{
 for(const manual of [false,true]){const app=service(manual),result=app.read();assert.equal(result.status,200);assert.equal(result.canManage,true);assert.equal(app.parallel.length,1);assert.equal(app.parallel[0].length,2);assert.equal(app.fallback.length,0);assert.equal(result.identity.username,'manager');}
});
test('request-scoped read reuse never preserves former membership or manager rights on later requests',()=>{
 const app=service();assert.equal(app.read().canManage,true);app.revokeRole();assert.equal(app.read().canManage,false);app.revokeMembership();assert.equal(app.read().status,403);assert.equal(app.parallel.length,3);
 app.account[4]=false;assert.equal(app.read().status,401);
});
test('parallel service errors fall back to fresh Sheets reads; invalid sessions do not prefetch private workbooks',()=>{
 const app=service();app.failRead();assert.equal(app.read().status,200);assert.deepEqual(app.fallback,["'Imported'!B2:F"]);
 app.request.session='b'.repeat(64);const before=app.parallel.length;assert.equal(app.read().status,401);assert.equal(app.parallel.length,before);
 app.ctx.nestAccessValues_('leadership',"'Imported'!B2:F");assert.equal(app.fallback.length,2);
});
