import {head} from '@vercel/blob';
import {handleUpload} from '@vercel/blob/client';
import {bridge,cookies,validToken,originAllowed,COOKIE} from '../lib/nest-auth.mjs';
import {CLIENT_COOKIE} from '../lib/service-google.mjs';
import {mediaFields,mediaReceipt,readMediaReceipt} from '../lib/service-media.mjs';
export function createUploadHandler(storage={head,handleUpload},school=bridge){return async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid upload request.'});}
 if(!body||Array.isArray(body)||JSON.stringify(body).length>10000||!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid upload request.'});
 // Blob signs completion callbacks. They never grant storage access or change a ticket.
 if(body.type==='blob.upload-completed'){
  try{return res.status(200).json(await storage.handleUpload({request:req,body,onBeforeGenerateToken:async()=>{throw Error('Unavailable');}}));}catch{return res.status(403).json({error:'Unavailable.'});}
 }
 if(!originAllowed(req))return res.status(403).json({error:'Unavailable.'});
 const jar=cookies(req),account=jar[COOKIE],client=jar[CLIENT_COOKIE],rawReceipt=body.receipt||body.payload?.clientPayload,accountReceipt=validToken(account)?readMediaReceipt(rawReceipt,account):null,clientReceipt=validToken(client)?readMediaReceipt(rawReceipt,client):null,receipt=accountReceipt||clientReceipt,management=body.operation==='prepare'?!!body.file?.context:!!receipt?.context,session=management?account:client;if(!validToken(session))return res.status(401).json({error:'Verify your email before uploading files.'});
 try{
  if(body.operation==='prepare'){
   const meta=mediaFields(body.file);if(!meta)return res.status(400).json({error:'Choose a supported photo or video, up to 100 MB per file.'});
   const result=await school({action:management?'auth-service-upload-prepare':'service-client-upload-prepare',session,file:meta,driveReady:true,restart:body.restart===true},30000);
   if(result.status!==200)return res.status([401,409,429].includes(result.status)?result.status:503).json({error:result.status===401?'Verify your email again.':result.status===429?'Choose up to five files, totaling 250 MB, or try again later.':result.status===409?'This file reference belongs to another draft.':'Upload preparation is temporarily unavailable.'});
   const prepared=result.file?mediaFields(result.file):meta;if(!prepared)throw Error('Invalid upload metadata');return res.status(200).json({path:prepared.path,receipt:mediaReceipt(prepared,session),...(prepared.storage==='drive'?{storage:'drive',uploadUrl:result.uploadUrl,complete:result.complete===true}: {})});
  }
  if(body.type==='blob.generate-client-token'){
   const meta=readMediaReceipt(body.payload?.clientPayload,session);if(!meta||meta.storage==='drive'||body.payload?.pathname!==meta.path)return res.status(403).json({error:'Upload permission expired. Retry your submission.'});
   const result=await storage.handleUpload({request:req,body,onBeforeGenerateToken:async pathname=>{
    if(pathname!==meta.path)throw Error('Unavailable');return {allowedContentTypes:[meta.type],maximumSizeInBytes:meta.size,validUntil:meta.expires,addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60};
   }});return res.status(200).json(result);
  }
  if(body.operation==='complete'){
   const meta=readMediaReceipt(body.receipt,session);if(!meta)return res.status(401).json({error:'Upload permission expired. Verify your email if needed and retry this submission.'});
   if(meta.storage==='drive'){const result=await school({action:management?'auth-service-upload-complete':'service-client-upload-complete',session,file:meta},30000);if(result.status!==200)return res.status([401,403,404,409].includes(result.status)?result.status:503).json({error:result.error||'The file is not ready yet. Retry this upload.'});return res.status(200).json({fileId:meta.fileId,name:meta.name,driveUrl:meta.driveUrl});}
   let blob;try{blob=await storage.head(meta.path);}catch(error){if(error?.name==='BlobNotFoundError')return res.status(404).json({error:'The file has not finished uploading.'});throw error;}
   if(blob.pathname!==meta.path||blob.size!==meta.size||blob.contentType!==meta.type)return res.status(409).json({error:'The uploaded file does not match the selected photo or video.'});
   const result=await school({action:management?'auth-service-upload-complete':'service-client-upload-complete',session,file:meta},30000);
   if(result.status!==200)return res.status([401,404,409].includes(result.status)?result.status:503).json({error:'The file could not be attached yet. Retry this same submission.'});
   return res.status(200).json({fileId:meta.fileId,name:meta.name});
  }
  return res.status(400).json({error:'Invalid upload action.'});
 }catch(error){console.error('Service media upload failed',{name:error?.name||'Error'});return res.status(503).json({error:'The upload could not be confirmed. Retry this same submission.'});}
};}
export default createUploadHandler();
