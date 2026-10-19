import {withDiagnostics} from '../lib/diagnostics.mjs';
import {COOKIE,cookies,validToken,bridge,originAllowed} from '../lib/nest-auth.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validEntry(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.title!=='string'||!value.title.trim()||value.title.trim().length>120||typeof value.description!=='string'||!value.description.trim()||value.description.trim().length>1500||typeof value.url!=='string'||value.url.length>2000||!uuid.test(value.requestId||''))return false;
  try{const url=new URL(value.url.trim());return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&!/[\s\\<>"']/.test(value.url.trim());}catch{return false;}
}
async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
  const fail=(status,error)=>res.status(status).json({error});
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return fail(405,'Method not allowed.');}
  const session=cookies(req)[COOKIE];let payload={action:'finished-list-view',...(validToken(session)?{session}:{})};
  if(req.method==='POST'){
    if(!originAllowed(req))return fail(403,'This action is unavailable.');
    if(!validToken(session))return fail(401,'Sign in to NEST to add a resource.');
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return fail(400,'Invalid request.');
    let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return fail(400,'Invalid request.');}
    if(!body||JSON.stringify(body).length>5000||!validEntry(body))return fail(400,'Enter a title, a web link, and its learning purpose.');
    payload={action:'auth-finished-list-add',session,title:body.title.trim(),url:body.url.trim(),description:body.description.trim(),requestId:body.requestId};
  }
  try{
    const data=await bridge(payload,50000);
    if([400,401,403,409].includes(data.status))return fail(data.status,({400:'Check the title, link, and learning purpose.',401:'Your sign-in has ended. Sign in again.',403:'Only current Software Technicians, Division Managers, Assistant Managers, and NEST Robotics CEOs, CFOs, and COOs may add resources.',409:'This submission changed or the list is full. Refresh before trying again.'})[data.status]);
    if(data.status!==200||!Array.isArray(data.entries)||data.entries.length>500||!data.entries.every(e=>typeof e.id==='string'&&typeof e.title==='string'&&e.title.length<=120&&typeof e.description==='string'&&e.description.length<=1500&&typeof e.url==='string'&&e.url.length<=2000&&(!e.url||safeURL(e.url))&&(!e.instructions||typeof e.instructions==='string'&&e.instructions.length<=2000)))throw new Error('Invalid list response');
    return res.status(200).json({canAdd:validToken(session)&&data.canAdd===true,entries:data.entries.map(({id,title,url,description,instructions})=>({id,title,url,description,instructions:instructions||''}))});
  }catch(error){console.error('Finished list unavailable',{kind:error?.name||'Error'});return fail(503,'The Finished List is temporarily unavailable. Your draft is kept; retry to check whether it saved.');}
}
function safeURL(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}}
export default withDiagnostics('finished-list',handler);
