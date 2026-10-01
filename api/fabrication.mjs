import { COOKIE, cookies, validToken, bridge, originAllowed } from '../lib/nest-auth.mjs';
const statuses=['Queued','In progress','On hold','Errored','Ready for pickup','Done','Cancelled'];
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const publicRow=row=>({id:row.id,status:row.status,machine:row.machine,updates:row.updates.map(({time,status,note,eventId})=>({time,status,note,eventId}))});
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 let payload;const session=cookies(req)[COOKIE];
 if(req.method==='GET'){
  const manage=req.query?.manage==='1',page=Number(req.query?.page||0);
  if(!Number.isInteger(page)||page<0||page>100)return res.status(400).json({error:'Invalid page.'});
  if(manage&&!validToken(session))return res.status(401).json({error:'Sign in to NEST to manage fabrication requests.'});
  payload={action:manage?'auth-fabrication-view':'fabrication-public',page,...(manage?{session}:{})};
 }else{
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to manage fabrication requests.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
  let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid request.'});}
  if(!body||Array.isArray(body)||JSON.stringify(body).length>5000||!['update','email'].includes(body.action)||!digest(body.id)||!digest(body.version))return res.status(400).json({error:'Invalid request.'});
  if(body.action==='update'&&(!statuses.includes(body.status)||typeof body.publicNote!=='string'||body.publicNote.length>1000||typeof body.notes!=='string'||body.notes.length>2000))return res.status(400).json({error:'Invalid update.'});
  if(body.action==='email'&&(typeof body.eventId!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(body.eventId)))return res.status(400).json({error:'Save an update before sending it.'});
  payload=body.action==='email'?{action:'auth-fabrication-email',session,id:body.id,version:body.version,eventId:body.eventId}:{action:'auth-fabrication-update',session,id:body.id,version:body.version,status:body.status,publicNote:body.publicNote,notes:body.notes};
 }
 try{
  const data=await bridge(payload,45000);
  if([400,401,403,404,409,502].includes(data.status))return res.status(data.status).json({error:({400:'Invalid request.',401:'Your sign-in has expired.',403:'Fabrication supervisors, managers, and CTSO executives may manage requests.',404:'This request is no longer in the active queue.',409:'The request changed or this update already has an email attempt. Refresh before continuing.',502:'Email delivery is uncertain. Check the sent-mail log before trying again.'})[data.status]});
  if(data.status!==200)throw new Error('Invalid bridge status');
  if(req.method==='POST')return res.status(200).json(payload.action==='auth-fabrication-email'?{emailState:data.emailState}:{eventId:data.eventId});
  if(!Array.isArray(data.requests)||data.requests.length>50||!data.requests.every(row=>digest(row.id)&&statuses.includes(row.status)&&typeof row.machine==='string'&&row.machine.length<=160&&Array.isArray(row.updates)&&row.updates.length<=30&&row.updates.every(e=>typeof e.time==='string'&&statuses.includes(e.status)&&typeof e.note==='string'&&e.note.length<=1000&&typeof e.eventId==='string')))throw new Error('Invalid queue');
  const requests=data.requests.map(row=>payload.action==='fabrication-public'?publicRow(row):{...publicRow(row),version:row.version,name:row.name,email:row.email,notes:row.notes,legacyLog:row.legacyLog,fields:row.fields,canUpdate:row.canUpdate===true,emailState:row.emailState});
  return res.status(200).json({requests,statuses,page:payload.page,total:data.total,hasMore:data.hasMore===true});
 }catch(error){console.error('Fabrication request failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Fabrication requests are temporarily unavailable. Refresh to check whether your update saved.'});}
}
