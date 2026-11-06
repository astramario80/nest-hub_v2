import {randomUUID} from 'node:crypto';
import {get,put} from '@vercel/blob';
import {COOKIE,cookies,validToken,bridge,originAllowed} from '../lib/nest-auth.mjs';
import {initialWorkspace} from '../lib/bell-schedule-seed.mjs';
import {validateWorkspace,resolveSchedule,signalRows,validDate} from '../js/bell-schedule-model.mjs';
const owners=new Set(['mpenalver@bethelsd.org','mario@memberhq.net','astramario@gmail.com']);
const ROOT='bell-workspace/v1/',HEAD=ROOT+'state.json';
const conflict=error=>/precondition|already.?exists|etag|condition.*match/i.test(error?.message||'')||['BlobPreconditionFailedError','BlobAlreadyExistsError'].includes(error?.name);
export function createBellWorkspaceHandler({school=bridge,storage={get,put},now=()=>new Date(),uuid=randomUUID}={}){
 async function read(path){const value=await storage.get(path,{access:'private',useCache:false});if(!value)return null;if(value.statusCode&&value.statusCode!==200)throw Error('Storage unavailable');return {value:await new Response(value.stream).json(),etag:value.blob?.etag};}
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff');
  const fail=(s,error)=>res.status(s).json({error});
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return fail(405,'Method not allowed.');}
  if(req.method==='POST'&&(!originAllowed(req)||!String(req.headers['content-type']||'').startsWith('application/json')))return fail(403,'Open this workspace from the NEST website.');
  const session=cookies(req)[COOKIE];if(!validToken(session))return fail(401,'Sign in to your NEST owner account to manage schedules.');
  try{
   const me=await school({action:'auth-me',session},25000);if(me.status!==200)return fail(me.status===401?401:503,'Your sign-in could not be verified. Sign in again or retry.');
   if(!owners.has(String(me.email||'').toLowerCase()))return fail(403,'Bell schedule management is available to the NEST owner.');
   const stored=await read(HEAD),state=stored?.value||{schemaVersion:1,revision:null,workspace:initialWorkspace(),history:[],updatedAt:null};
   if(state.schemaVersion!==1)throw Error('Unsupported schema');
   if(req.method==='GET')return res.status(200).json({...state,mode:'draft',liveConnected:false});
   let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return fail(400,'Invalid request.');}
   if(!body||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>600000)return fail(413,'This workspace is too large.');
   if(body.operation==='preview'){
    const workspace=body.workspace||state.workspace,errors=validateWorkspace(workspace);if(errors.length)return res.status(400).json({error:errors[0],errors});
    if(!validDate(body.date))return fail(400,'Choose a valid date.');const resolved=resolveSchedule(workspace,{date:body.date,teacherId:body.teacherId,groupId:body.groupId,lunchId:body.lunchId,templateId:body.templateId});
    return res.status(200).json({resolved,signals:signalRows(resolved),mode:'draft',liveConnected:false});
   }
   if(!['save','restore'].includes(body.operation))return fail(400,'Choose a workspace action.');
   if(body.expectedRevision!==state.revision)return fail(409,'This workspace was saved elsewhere. Download your changes, then reload the saved version.');
   let workspace=body.workspace;
   if(body.operation==='restore'){
    if(!state.history.some(h=>h.revision===body.revision))return fail(404,'That revision is not in this workspace history.');
    const snapshot=await read(ROOT+'revisions/'+body.revision+'.json');if(!snapshot)return fail(404,'That revision is unavailable.');workspace=snapshot.value.workspace;
   }
   const errors=validateWorkspace(workspace);if(errors.length)return res.status(400).json({error:errors[0],errors});
   const revision=uuid(),updatedAt=now().toISOString(),entry={revision,updatedAt,actor:me.email,action:body.operation};
   const next={schemaVersion:1,revision,updatedAt,workspace,history:[entry,...state.history].slice(0,30)};
   const options={access:'private',contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:0};
   // Immutable snapshot first; head is the commit point. Unreferenced snapshots are never exposed.
   await storage.put(ROOT+'revisions/'+revision+'.json',JSON.stringify({workspace,...entry}),options);
   if(stored&&!stored.etag)throw Error('Missing storage revision');
   await storage.put(HEAD,JSON.stringify(next),{...options,...(stored?{ifMatch:stored.etag}:{allowOverwrite:false})});
   return res.status(200).json({...next,mode:'draft',liveConnected:false});
  }catch(error){if(conflict(error))return fail(409,'Another save completed first. Download your changes, then reload the saved version.');return fail(503,'The schedule workspace is temporarily unavailable. Your unsaved changes remain in this page.');}
 };
}
export default createBellWorkspaceHandler();
