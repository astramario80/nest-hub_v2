import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {randomUUID,webcrypto} from 'node:crypto';
const ticketId=randomUUID(),entryId=randomUUID();
function uploader({loseResponse=false,incomplete=false,completionStatus}={}){
 const files=new Map(),transfers=[],requests=[],window={};
 const context=vm.createContext({window,console,crypto:webcrypto,CryptoKey:webcrypto.CryptoKey,btoa,atob,AbortSignal,Blob,File,Headers,Request,Response,ReadableStream,TransformStream,URL,URLSearchParams,TextEncoder,TextDecoder,setTimeout,clearTimeout,fetch:async(url,options)=>{
  if(url==='/api/service-upload'){
   const body=JSON.parse(options.body);requests.push(body);
   if(body.operation==='prepare'){const prior=files.get(body.file.fileId)||{...body.file,complete:false};files.set(prior.fileId,prior);return {ok:true,json:async()=>({storage:'drive',path:'unused',receipt:prior.fileId,uploadUrl:'https://www.googleapis.com/upload/drive/v3/files/'+prior.fileId,complete:prior.complete})};}
   const file=files.get(body.receipt),status=completionStatus||(file?.received?200:404);if(status===200)file.complete=true;return {ok:status===200,status,json:async()=>status===200?{fileId:file.fileId}:{error:'Not confirmed'}};
  }
  const file=files.get(String(url).split('/').pop());assert.ok(file);assert.equal(options.credentials,'omit');
  if(!options.body)return {ok:false,status:308,headers:new Headers()};
  transfers.push(file.fileId);file.received=!incomplete;
  if(loseResponse)throw new TypeError('Failed to load');
  return {ok:true,status:200,headers:new Headers()};
 }});
 vm.runInContext(fs.readFileSync('js/service-upload.js','utf8'),context);
 return {api:window.NestServiceUpload,requests,transfers,files};
}
const photos=()=>Array.from({length:4},(_,i)=>new File(['image fixture '+i],'photo-'+i+'.jpeg',{type:'image/jpeg'}));
test('four internal photos finish as one batch when Drive accepts bytes but the browser loses every success response',async()=>{
 const app=uploader({loseResponse:true}),tasks=app.api.selection(photos()),progress=[];
 const ids=await app.api.uploadFiles(tasks,ticketId,message=>progress.push(message),{context:'internal',entryId});
 assert.equal(ids.length,4);assert.equal(new Set(ids).size,4);assert.equal(app.transfers.length,4);
 assert.ok([...app.files.values()].every(f=>f.complete&&f.context==='internal'&&f.entryId===entryId));
 assert.equal(app.requests.filter(r=>r.operation==='complete').length,4);
 // A retry of the unchanged draft confirms the same IDs, without transferring a duplicate.
 const retried=await app.api.uploadFiles(tasks,ticketId,()=>{},{context:'internal',entryId});
 assert.deepEqual([...retried],[...ids]);assert.equal(app.transfers.length,4);
});
test('an incomplete upload preserves the draft and does not report any file as attached',async()=>{
 const app=uploader({loseResponse:true,incomplete:true}),tasks=app.api.selection(photos());
 await assert.rejects(app.api.uploadFiles(tasks,ticketId,()=>{},{context:'internal',entryId}),/photo-0.jpeg.*Keep these files selected/);
 assert.equal(app.transfers.length,1);assert.equal(tasks.length,4);assert.equal([...app.files.values()].filter(f=>f.complete).length,0);
});
test('server authorization errors during recovery stop the batch instead of claiming success',async()=>{
 const app=uploader({loseResponse:true,completionStatus:403}),tasks=app.api.selection(photos());
 await assert.rejects(app.api.uploadFiles(tasks,ticketId,()=>{},{context:'internal',entryId}),error=>error.status===403);
 assert.equal(app.transfers.length,1);assert.equal([...app.files.values()].filter(f=>f.complete).length,0);
});
test('ordinary successful transfers still complete all four files and preserve their internal audience',async()=>{
 const app=uploader(),tasks=app.api.selection(photos());const ids=await app.api.uploadFiles(tasks,ticketId,()=>{},{context:'internal',entryId});
 assert.equal(ids.length,4);assert.equal(app.transfers.length,4);assert.ok([...app.files.values()].every(f=>f.complete&&f.context==='internal'));
});
test('Drive sessions include the canonical origin and upgrade older sessions without creating another file',()=>{
 const calls=[],grant={email:'fictional@students.bethelsd.org',files:[]},file={ticketId,fileId:randomUUID(),name:'fixture.jpeg',type:'image/jpeg',size:3,context:'internal',entryId};
 const saved={...file,driveId:'sameFixtureDriveFile',storage:'drive',uploadUrl:'https://www.googleapis.com/upload/drive/v3/files/old',uploadExpires:Date.now()+1800000,complete:false};grant.files.push(saved);
 const store={setProperty(){}},ctx=vm.createContext({Date,ScriptApp:{getOAuthToken:()=> 'test-token'},UrlFetchApp:{fetch:(url,options)=>{calls.push({url,options});return {getResponseCode:()=>200,getAllHeaders:()=>({Location:'https://www.googleapis.com/upload/drive/v3/files/new'})};}},Drive:{Files:{create:()=>{throw Error('Must preserve the existing file');}}},serviceMediaMeta_:v=>v});
 vm.runInContext(fs.readFileSync('google-spinner/ServiceDrive.js','utf8'),ctx);
 const result=ctx.serviceDrivePrepare_(file,grant,'fixture',store,false);
 assert.equal(result.status,200);assert.equal(calls.length,1);assert.equal(calls[0].options.headers.Origin,'https://gknest.org');assert.equal(saved.uploadOrigin,'https://gknest.org');assert.equal(saved.driveId,'sameFixtureDriveFile');
 ctx.serviceDrivePrepare_(file,grant,'fixture',store,false);assert.equal(calls.length,1);
});
