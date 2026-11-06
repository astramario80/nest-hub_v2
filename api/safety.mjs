import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { withDiagnostics } from '../lib/diagnostics.mjs';
import { COOKIE, cookies, validToken, bridge, originAllowed } from '../lib/nest-auth.mjs';
import {PHOTO_PATH,MAX_PHOTOS,MAX_PHOTO_TOTAL,photoJSON} from '../lib/safety-media.mjs';
const periods=['1','2','3','4','5','7','CTSO'];
const operations=['drive-storage-setup','drive-storage-sync','flight-start','clearance-code','flight-review','flight-release','flight-complete','flight-cancel','no-fly-add','no-fly-remove','flight-settings','flight-transition','queue-join','queue-toggle','queue-cancel','queue-return','queue-out','message','message-remove','maintenance-resolve','maintenance-reopen','submit','upload'];
const mediaPath=/^safety-media\/[a-f0-9-]{36}\.(jpg|png|webp)$/;
async function storedJSON(storage,path){const value=await storage.get(path,{access:'private',useCache:false});return value?new Response(value.stream).json():null;}
export function imageType(bytes){
 if(bytes.length>=12&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return {ext:'jpg',mime:'image/jpeg'};
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {ext:'png',mime:'image/png'};
 if(bytes.length>=12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return {ext:'webp',mime:'image/webp'};
 return null;
}
export function createSafetyHandler({school=bridge,storage={get,put}}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');
  const fail=(status,error)=>res.status(status).json({error});
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return fail(405,'Method not allowed.');}
  if(req.method==='POST'&&(!originAllowed(req)||!String(req.headers['content-type']||'').startsWith('application/json')))return fail(403,'Open this action from the NEST website.');
  const session=cookies(req)[COOKIE];if(!validToken(session))return fail(401,'Sign in to your NEST account.');
  let body={};if(req.method==='POST'){try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return fail(400,'Invalid request.');}if(!body||typeof body!=='object'||JSON.stringify(body).length>3000000)return fail(413,'Use a photo smaller than 2 MB.');}
  const period=String(req.method==='POST'?body.period:req.query?.period||'');const sharedRead=req.method==='GET'&&['catalog','archive','current-flight-log','notifications','report'].includes(req.query?.operation);if(!sharedRead&&!periods.includes(period))return fail(400,'Choose your division.');
  const call=data=>school({action:'auth-safety',session,period,...data},55000);
  const send=result=>{const {status=503,actorKey,photo,readToken,driveId,...data}=result||{};return res.status(status).json(status===200?data:{error:data.error||({401:'Your sign-in expired. Sign in again.',403:'This workspace is available to current members of this division.',409:'The workspace changed. Refresh and try again.',429:'Please wait a moment before posting again.'}[status]||'Safety workspace is temporarily unavailable. Refresh before retrying.')});};
  try{
   if(req.method==='GET'){
    if(sharedRead){const operation=req.query.operation,id=String(req.query.id||'');if(operation==='report'&&(!periods.includes(period)||!/^[a-f0-9-]{36}$/.test(id)))return fail(400,'Choose a report.');const page=Number(req.query.page||0),sort=String(req.query.sort||'date-desc'),year=String(req.query.year||'all'),trimester=String(req.query.trimester||'all'),search=String(req.query.search||'');if(!Number.isInteger(page)||page<0||page>300||search.length>100||!['date-desc','date-asc','name'].includes(sort))return fail(400,'Invalid archive filters.');return send(await call({operation,id,page,sort,year,trimester,search}));}
    if(req.query?.media){
     const id=String(req.query.media);if(!/^[a-f0-9]{64}$/.test(id))return fail(400,'Invalid photo.');
     const index=Number(req.query.index||0);if(!Number.isInteger(index)||index<0||index>=MAX_PHOTOS)return fail(400,'Invalid photo.');const result=await call({operation:'media',id,index});if(result.status!==200)return send(result);
     if(!mediaPath.test(result.photo))return fail(404,'Photo unavailable.');
     let stored;if(result.driveId){if(!/^[-_a-zA-Z0-9]{10,200}$/.test(result.driveId)||typeof result.readToken!=='string'||result.readToken.length<20)return fail(404,'Photo unavailable.');const response=await (storage.fetch||fetch)('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(result.driveId)+'?alt=media',{headers:{Authorization:'Bearer '+result.readToken},redirect:'error'});if(!response.ok)return fail(response.status===404?404:503,'Photo unavailable.');stored={stream:response.body};}else stored=await storage.get(result.photo,{access:'private',useCache:false});if(!stored)return fail(404,'Photo unavailable.');
     const ext=result.photo.split('.').pop();res.setHeader('Content-Type',{jpg:'image/jpeg',png:'image/png',webp:'image/webp'}[ext]);res.setHeader('Content-Disposition','inline; filename="aircraft-damage.'+ext+'"');res.status(200);for await(const chunk of stored.stream)if(!res.write(Buffer.from(chunk)))await once(res,'drain');return res.end();
    }
    const date=String(req.query?.date||'');if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return fail(400,'Choose a valid date.');
    return send(await call({operation:'view',date}));
   }
   if(!operations.includes(body.operation)||!/^[a-f0-9-]{36}$/.test(body.requestId||''))return fail(400,'Invalid safety action.');
   if(body.photos!==undefined&&(!Array.isArray(body.photos)||body.photos.length>MAX_PHOTOS||new Set(body.photos).size!==body.photos.length))return fail(400,'Choose up to eight different photos.');
   const photos=body.photos?.length?body.photos:body.photo?[body.photo]:[];
   if(body.operation==='upload'||body.operation==='submit'&&photos.length){
    const access=await call({operation:'view'});if(access.status!==200)return send(access);if(!access.canFly||access.canSubmit===false)return fail(403,'Flight checklists are available to current division members with a NEST enrollment record.');
    if(body.operation==='upload'){
     if(typeof body.base64!=='string'||body.base64.length>2800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.base64))return fail(400,'Choose a JPG, PNG, or WebP photo smaller than 2 MB.');
     const bytes=Buffer.from(body.base64,'base64'),type=imageType(bytes);if(!type||bytes.length>2*1024*1024)return fail(400,'Choose a JPG, PNG, or WebP photo smaller than 2 MB.');
     const path='safety-media/'+randomUUID()+'.'+type.ext;
     await storage.put(path,bytes,{access:'private',contentType:type.mime,addRandomSuffix:false,cacheControlMaxAge:0});
     await storage.put(path+'.json',JSON.stringify({actor:access.actorKey,period,created:Date.now()}),{access:'private',contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:0});
     return res.status(200).json({uploaded:true,photo:path});
    }
    const check=await call({operation:'photo-check',paths:photos,reportId:body.requestId});if(check.status!==200)return send(check);const drivePaths=check.drivePaths||[];let total=check.driveBytes||0;for(const path of photos){if(typeof path!=='string'||!PHOTO_PATH.test(path))return fail(400,'Upload damage photos first.');if(drivePaths.includes(path))continue;const meta=await storedJSON(storage,path+'.json');if(!meta||meta.actor!==access.actorKey||meta.period!==period)return fail(403,'Use photos uploaded with your account for this division.');if(meta.size){const ready=await photoJSON(storage,path+'.ready.json');if(!ready||ready.actor!==access.actorKey||ready.period!==period||ready.size!==meta.size)return fail(409,'Finish uploading every photo before submitting.');}total+=meta.size||2*1024*1024;}if(total>MAX_PHOTO_TOTAL)return fail(400,'Choose photos totaling up to 80 MB.');
   }
   const {operation,requestId,id,text,enabled,type,answers,photo,settings,code,metarObservation,reason,notes,aircraft,transitionMinutes}=body;
   return send(await call({operation,requestId,id,text,enabled,type,answers,settings,code,metarObservation,reason,notes,aircraft,transitionMinutes,photos,photo:photos[0]||photo}));
  }catch{return fail(503,'Safety workspace is temporarily unavailable. Refresh before retrying.');}
 };
}
export default withDiagnostics('division',createSafetyHandler());
