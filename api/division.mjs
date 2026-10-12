import { withDiagnostics } from '../lib/diagnostics.mjs';
import { COOKIE, cookies, validToken, bridge, originAllowed, verifiedIdentity } from '../lib/nest-auth.mjs';
import { DIVISIONS } from '../lib/divisions.mjs';
import { LEADER_SLIDES, roleKey } from '../lib/division-slides.mjs';
const validJob=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 let body={};
 if(req.method==='POST'){
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
  try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid request.'});}
  if(!body||Array.isArray(body)||JSON.stringify(body).length>256||body.action!=='load-slides'||!validJob(body.job))return res.status(400).json({error:'Invalid request.'});
 }
 const period=String(req.method==='POST'?body.period:req.query?.period||'');
 if(!Object.hasOwn(DIVISIONS,period))return res.status(400).json({error:'Choose a division.'});
 const session=cookies(req)[COOKIE];
 if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to use this division workspace.'});
 const job=req.method==='POST'?body.job:req.query?.job;
 if(job!==undefined&&!validJob(job))return res.status(400).json({error:'Invalid update.'});
 try{
  const readStarted=Date.now();
  const result=await bridge({action:'auth-division-slides',session,period,operation:req.method==='POST'?'start':job?'status':'access',job},45000);
  res.setHeader('Server-Timing','school;dur='+(Date.now()-readStarted));
  if([400,401,403,404,409,503].includes(result.status))return res.status(result.status).json({error:result.status===401?'Your sign-in has expired.':result.status===403?(job?'Only this division’s managers can load slides.':'This page is only available to members of this division.') :result.status===404?'This slide update is unavailable.':result.status===409?'A slide update is already running for this division.':'The slide update service is temporarily unavailable.'});
  if(result.status!==200)throw new Error('Invalid division response');
  if(!job){
   const roles=new Set((Array.isArray(result.roles)?result.roles:[]).map(roleKey));
   const canEdit=role=>result.isOwner===true||result.canManage===true||roles.has(roleKey(role));
   const team=(Array.isArray(result.team)?result.team:[]).filter(leader=>typeof leader.position==='string'&&typeof leader.name==='string').map(({position,name})=>({position:roleKey(position)==='fabrication supervisor'?'Fabrication Supervisor':position,name}));
   return res.status(200).json({identity:verifiedIdentity(result.identity),team,canManage:result.canManage===true,canManageRobotics:period==='CTSO'&&result.canManageRobotics===true,canViewRobotics:period==='CTSO'&&result.canViewRobotics===true,manager:{id:DIVISIONS[period].slides,role:'Manager Slideshow',canEdit:canEdit(period==='CTSO'?'Chief Executive Officer':'Division Manager')},leaders:LEADER_SLIDES[period].map(slide=>({...slide,canEdit:canEdit(slide.role)}))});
  }
  if(!['queued','running','completed','failed'].includes(result.state)||result.job!==job)throw new Error('Invalid slide update response');
  return res.status(200).json({job,state:result.state,updatedAt:result.updatedAt||null});
 }catch(error){console.error('Division slide request failed',{kind:error?.name||'Error'});return res.status(503).json({error:'The division workspace is temporarily unavailable. Please try again.'});}
}

export default withDiagnostics('division',handler);
