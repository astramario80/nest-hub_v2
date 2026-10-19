import {withDiagnostics} from '../lib/diagnostics.mjs';
import {COOKIE,cookies,validToken,bridge,originAllowed} from '../lib/nest-auth.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validIcon(value){
  if(value==='')return true;
  if(typeof value!=='string'||value.length>45000)return false;
  if(/^\/assets\/finished-list\/[a-z0-9-]+\.(png|ico|svg|webp)$/.test(value))return true;
  const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match||match[2].length%4)return false;
  const bytes=Buffer.from(match[2],'base64');if(bytes.length<12||bytes.length>32768)return false;
  return match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
}
const validSkills=value=>Array.isArray(value)&&value.length>0&&value.length<=24&&new Set(value).size===value.length&&value.every(skill=>typeof skill==='string'&&skill.trim()===skill&&skill.length>0&&skill.length<=120);
export const validTarget=value=>value&&typeof value==='object'&&!Array.isArray(value)&&/^(original-\d+|[a-f0-9-]{36})$/i.test(value.id||'')&&Number.isInteger(value.version)&&value.version>0&&uuid.test(value.requestId||'');
export function validEntry(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.title!=='string'||!value.title.trim()||value.title.trim().length>120||typeof value.description!=='string'||!value.description.trim()||value.description.trim().length>1500||typeof value.url!=='string'||value.url.length>2000||!uuid.test(value.requestId||'')||!validSkills(value.skills)||!validIcon(value.icon||''))return false;
  if(value.operation==='update'&&(!/^(original-\d+|[a-f0-9-]{36})$/i.test(value.id||'')||!Number.isInteger(value.version)||value.version<1))return false;
  if(value.operation&&value.operation!=='update'&&value.operation!=='add')return false;
  return value.operation==='update'&&value.url===''||safeURL(value.url.trim());
}
function safeURL(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&!/[\s\\<>"']/.test(value);}catch{return false;}}
async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
  const fail=(status,error)=>res.status(status).json({error});
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return fail(405,'Method not allowed.');}
  const session=cookies(req)[COOKIE];let payload={action:'finished-list-view',...(validToken(session)?{session}:{})};
  if(req.method==='POST'){
    if(!originAllowed(req))return fail(403,'This action is unavailable.');
    if(!validToken(session))return fail(401,'Sign in to NEST to edit resources.');
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return fail(400,'Invalid request.');
    let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return fail(400,'Invalid request.');}
    if(!body||JSON.stringify(body).length>65000||!(body.operation==='delete'?validTarget(body):validEntry(body)))return fail(400,'Check the title, link, learning purpose, skills, and icon.');
    payload=body.operation==='delete'?{action:'auth-finished-list-delete',session,id:body.id,version:body.version,requestId:body.requestId}:{action:body.operation==='update'?'auth-finished-list-update':'auth-finished-list-add',session,title:body.title.trim(),url:body.url.trim(),description:body.description.trim(),skills:body.skills,icon:body.icon||'',requestId:body.requestId,...(body.operation==='update'?{id:body.id,version:body.version}:{})};
  }
  try{
    const data=await bridge(payload,50000);
    if([400,401,403,404,409].includes(data.status))return fail(data.status,({400:'Check the title, link, learning purpose, skills, and icon.',401:'Your sign-in has ended. Sign in again.',403:'Only the NEST supervisor and current Software Technicians, Division Managers, Assistant Managers, and Robotics CEOs, CFOs, and COOs may edit resources.',404:'This resource no longer exists. Refresh the list.',409:'This resource changed since you opened it. Your draft is kept. Refresh the list and reopen it before saving.'})[data.status]);
    if(data.status!==200||!Array.isArray(data.skills)||data.skills.length>100||!data.skills.every(skill=>typeof skill==='string'&&skill.length<=120)||!Array.isArray(data.entries)||data.entries.length>500||!data.entries.every(e=>typeof e.id==='string'&&typeof e.title==='string'&&e.title.length<=120&&typeof e.description==='string'&&e.description.length<=1500&&typeof e.url==='string'&&e.url.length<=2000&&(!e.url||safeURL(e.url))&&(!e.instructions||typeof e.instructions==='string'&&e.instructions.length<=2000)&&Array.isArray(e.skills)&&e.skills.length<=24&&e.skills.every(skill=>typeof skill==='string'&&skill.length<=120)&&validIcon(e.icon||'')&&Number.isInteger(e.version)&&e.version>0))throw new Error('Invalid list response');
    return res.status(200).json({canAdd:validToken(session)&&data.canAdd===true,canEdit:validToken(session)&&data.canEdit===true,skills:data.skills,entries:data.entries.map(({id,title,url,description,instructions,skills,icon,version})=>({id,title,url,description,instructions:instructions||'',skills,icon:icon||'',version}))});
  }catch(error){console.error('Finished list unavailable',{kind:error?.name||'Error'});return fail(503,'The Finished List is temporarily unavailable. Your draft is kept; retry to check whether it saved.');}
}
export default withDiagnostics('leadership',handler);
