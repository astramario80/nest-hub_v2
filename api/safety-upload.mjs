import {get,put,head} from '@vercel/blob';
import {handleUpload} from '@vercel/blob/client';
import {COOKIE,cookies,validToken,bridge,originAllowed} from '../lib/nest-auth.mjs';
import {imageType} from './safety.mjs';
import {PHOTO_TYPES,PHOTO_PATH,MAX_PHOTO_SIZE,photoJSON} from '../lib/safety-media.mjs';
export function createSafetyUploadHandler({storage={get,put,head,handleUpload},school=bridge}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const fail=(status,error)=>res.status(status).json({error});
 if(req.method!=='POST')return fail(405,'Method not allowed.');
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return fail(400,'Invalid upload.');}
 if(!body||Array.isArray(body)||JSON.stringify(body).length>10000||!String(req.headers['content-type']||'').startsWith('application/json'))return fail(400,'Invalid upload.');
 if(body.type==='blob.upload-completed'){try{return res.status(200).json(await storage.handleUpload({request:req,body,onBeforeGenerateToken:async()=>{throw Error('Unavailable');}}));}catch{return fail(403,'Unavailable.');}}
 if(!originAllowed(req))return fail(403,'Open this action from NEST.');
 const session=cookies(req)[COOKIE];if(!validToken(session))return fail(401,'Sign in to upload photos.');
 try{
  let payload={};if(body.type==='blob.generate-client-token'){try{payload=JSON.parse(body.payload?.clientPayload||'');}catch{return fail(400,'Invalid upload.');}}
  const period=String(body.period||payload.period||'');if(!['1','2','3','4','5','7','CTSO'].includes(period))return fail(400,'Choose your division.');
  if(['prepare','complete'].includes(body.operation)&&body.reportId){const result=await school({action:'auth-safety',session,period,operation:body.operation==='prepare'?'photo-prepare':'photo-complete',reportId:body.reportId,file:body.file,path:body.path,restart:body.restart===true},55000);if(result.status!==200)return fail([400,401,403,404,409,429].includes(result.status)?result.status:503,result.error||'The Drive upload could not be confirmed. Keep the same files selected and retry.');const {path,photo,storage,uploadUrl,complete}=result;return res.status(200).json({path,photo,storage,uploadUrl,complete});}
  const access=await school({action:'auth-safety',session,period,operation:'view'},55000);if(access.status!==200)return fail(access.status===401?401:403,'Your division access could not be verified.');if(!access.actorKey||!access.canFly||access.canSubmit===false)return fail(403,'Upload with your current enrolled division account.');
  if(body.operation==='prepare'){
   const {id,type,size}=body.file||{};if(!/^[a-f0-9-]{36}$/.test(id||'')||!Object.hasOwn(PHOTO_TYPES,type)||!Number.isSafeInteger(size)||size<1||size>MAX_PHOTO_SIZE)return fail(400,'Choose JPG, PNG, or WebP photos up to 20 MB each.');
   const path='safety-media/'+id+'.'+PHOTO_TYPES[type],meta={actor:access.actorKey,period,type,size,created:Date.now()},prior=await photoJSON(storage,path+'.json');
   if(prior){if(prior.actor!==meta.actor||prior.period!==period||prior.size!==size||prior.type!==type)return fail(409,'Reselect this photo to start a new upload.');}
   else await storage.put(path+'.json',JSON.stringify(meta),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:0});
   return res.status(200).json({path});
  }
  const path=body.path||body.payload?.pathname;if(!PHOTO_PATH.test(path||''))return fail(400,'Choose a photo.');
  const meta=await photoJSON(storage,path+'.json');if(!meta||meta.actor!==access.actorKey||meta.period!==period||!meta.size)return fail(403,'Use photos uploaded with your account for this division.');
  if(body.type==='blob.generate-client-token')return res.status(200).json(await storage.handleUpload({request:req,body,onBeforeGenerateToken:async pathname=>{if(pathname!==path||Date.now()-meta.created>86400000)throw Error('Expired upload');return {allowedContentTypes:[meta.type],maximumSizeInBytes:meta.size,validUntil:Date.now()+1800000,addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60};}}));
  if(body.operation==='complete'){
   let blob;try{blob=await storage.head(path);}catch(e){if(e?.name==='BlobNotFoundError')return fail(404,'This photo has not finished uploading.');throw e;}
   if(blob.pathname!==path||blob.size!==meta.size||blob.contentType!==meta.type)return fail(409,'The uploaded photo does not match your selection.');
   const stored=await storage.get(path,{access:'private',useCache:false});if(!stored)return fail(404,'This photo has not finished uploading.');const reader=stored.stream.getReader();let prefix=Buffer.alloc(0);try{while(prefix.length<12){const {done,value}=await reader.read();if(done)break;prefix=Buffer.concat([prefix,Buffer.from(value).subarray(0,12-prefix.length)]);}}finally{await reader.cancel();}if(imageType(prefix)?.mime!==meta.type)return fail(400,'Choose a valid JPG, PNG, or WebP photo.');
   await storage.put(path+'.ready.json',JSON.stringify({actor:meta.actor,period,size:meta.size}),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:0});return res.status(200).json({photo:path});
  }
  return fail(400,'Invalid upload action.');
 }catch{return fail(503,'The photo upload could not be confirmed. Keep your files selected and retry.');}
};}
export default createSafetyUploadHandler();
