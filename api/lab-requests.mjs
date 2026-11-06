import {labStorageKey} from './lab-storage.mjs';
import {COOKIE,cookies,validToken,originAllowed,bridge} from '../lib/nest-auth.mjs';
const reads=new Set(['bootstrap','list','detail','alert-access','alerts']);
const writes=new Set(['submit','decide','sync-staff','calendar','migrate-storage']);
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to use NEST™ Request for a NEST™ Lab pass.'});
 if(req.method==='POST'&&(!originAllowed(req)||!String(req.headers['content-type']||'').startsWith('application/json')))return res.status(403).json({error:'This action is unavailable.'});
 let input=req.method==='GET'?req.query:req.body;try{if(typeof input==='string')input=JSON.parse(input);}catch{return res.status(400).json({error:'Invalid request.'});}
 if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>2850000)return res.status(400).json({error:'Keep the screenshot under 2 MB.'});
 const operation=String(input.operation||'bootstrap');if(!(req.method==='GET'?reads:writes).has(operation))return res.status(400).json({error:'Invalid NEST™ Request action.'});
 const payload={action:'auth-lab-requests',session,operation,storageToken:labStorageKey()};
 for(const key of ['page','filter','id','revision','state','eventId','reason','customReason','requestId','firstName','lastName','division','day','time','goal','teachers','gradeConfirmed','evidence','view','year','trimester','search','student','dates'])if(Object.hasOwn(input,key))payload[key]=input[key];
 // The browser cannot select a sender, recipient, owner identity, or mail credential.
 if(['bootstrap','submit','decide','sync-staff'].includes(operation))payload.mailToken=process.env.POSTMARK_SERVER_TOKEN;
 try{
  const data=await bridge(payload,55000);if(data.status!==200){const code=[400,401,403,404,409,429].includes(data.status)?data.status:503;return res.status(code).json({error:data.error||'NEST™ Request is temporarily unavailable. Refresh before trying again.'});}
  const {status,...result}=data;return res.status(200).json(result);
 }catch{return res.status(503).json({error:'NEST could not confirm the result. Refresh the request before retrying. Your request and decision IDs protect against duplicates.'});}
}
