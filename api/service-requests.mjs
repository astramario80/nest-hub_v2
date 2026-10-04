import { withDiagnostics } from '../lib/diagnostics.mjs';
import { COOKIE,cookies,validToken,token,bridge,originAllowed,setCookie } from '../lib/nest-auth.mjs';
import { CLIENT_COOKIE,NONCE_COOKIE,newChallenge,readChallenge,verifyStaff } from '../lib/service-google.mjs';
const statuses=['New!','Assigned','In Progress','Completed','Closed'];
const id=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const clientRow=r=>({id:r.id,status:r.status,created:typeof r.created==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(r.created)&&Number.isFinite(Date.parse(r.created))?r.created:'',description:r.description,category:r.category,room:r.room,manager:r.manager,updates:(r.updates||[]).map(e=>({time:e.time,status:e.status,note:e.note}))});
async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 const jar=cookies(req),operation=req.method==='GET'?String(req.query?.operation||'client-view'):req.body?.operation;
 if(req.method==='GET'&&operation==='config'){
  if(!process.env.SERVICE_GOOGLE_CLIENT_ID||!process.env.SPINNER_BRIDGE_TOKEN)return res.status(503).json({error:'School Google sign-in is awaiting configuration.'});
  const challenge=newChallenge();res.setHeader('Set-Cookie',setCookie(NONCE_COOKIE,challenge.cookie,600));
  return res.status(200).json({clientId:process.env.SERVICE_GOOGLE_CLIENT_ID,nonce:challenge.nonce});
 }
 let body=req.body;
 if(req.method==='POST'){
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
  try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid request.'});}
  if(!body||Array.isArray(body)||JSON.stringify(body).length>12000)return res.status(400).json({error:'Invalid request.'});
 }
 const op=req.method==='POST'?body.operation:operation;
 let request;
 try{
  if(req.method==='POST'&&op==='client-login'){
   const challenge=readChallenge(jar[NONCE_COOKIE]);
   if(!challenge||!process.env.SERVICE_GOOGLE_CLIENT_ID||typeof body.credential!=='string'||body.credential.length>8000)return res.status(401).json({error:'Restart school Google sign-in.'});
   let identity;try{identity=await verifyStaff(body.credential,challenge.nonce);}catch{return res.status(401).json({error:'Use your verified school staff Google account.'});}
   if(!identity)return res.status(403).json({error:'Use your @bethelsd.org school staff Google account.'});
   const session=token(),data=await bridge({action:'service-client-login',session,previous:jar[CLIENT_COOKIE],nonce:challenge.nonce,...identity});
   if(data.status!==200)throw new Error('Client session rejected');
   res.setHeader('Set-Cookie',[setCookie(CLIENT_COOKIE,session),setCookie(NONCE_COOKIE,'',0)]);
   return res.status(200).json({email:identity.email});
  }
  if(req.method==='POST'&&op==='client-logout'){
   if(validToken(jar[CLIENT_COOKIE])){const data=await bridge({action:'service-client-logout',session:jar[CLIENT_COOKIE]});if(data.status!==200)throw new Error('Logout unavailable');}
   res.setHeader('Set-Cookie',setCookie(CLIENT_COOKIE,'',0));return res.status(200).json({signedOut:true});
  }
  if(req.method==='GET'&&op==='client-view'){
   if(!validToken(jar[CLIENT_COOKIE]))return res.status(401).json({error:'Sign in with your school Google account to see your requests.'});
   request={action:'service-client-view',session:jar[CLIENT_COOKIE]};
  }else{
   if(!validToken(jar[COOKIE]))return res.status(401).json({error:'Sign in to NEST to use Client Relations.'});
   if(req.method==='GET'&&!['manage','reviews','metrics','ticket'].includes(op)||req.method==='POST'&&!['update','email','edit-log','delete-log','test-email'].includes(op))return res.status(400).json({error:'Invalid action.'});
   request={action:'auth-service-'+op,session:jar[COOKIE]};
   if(op==='ticket'){if(!id(req.query?.id))return res.status(400).json({error:'Select a request.'});request.id=req.query.id;}
   if(req.method==='POST'){
    if(!id(body.id)||!digest(body.version))return res.status(400).json({error:'Refresh and select a request.'});
    Object.assign(request,{id:body.id,version:body.version});
    if(op==='update'){
     if(!statuses.includes(body.status)||typeof body.manager!=='string'||body.manager.length>254||typeof body.note!=='string'||body.note.length>2000||typeof body.publicNote!=='string'||body.publicNote.length>2000)return res.status(400).json({error:'Invalid update.'});
     Object.assign(request,{status:body.status,manager:body.manager,note:body.note,publicNote:body.publicNote});
    }else if(['edit-log','delete-log'].includes(op)){
     if(!id(body.eventId)||!digest(body.entryVersion)||!['public','internal'].includes(body.scope)||op==='edit-log'&&(typeof body.note!=='string'||!body.note.trim()||body.note.length>2000))return res.status(400).json({error:'Choose a saved log entry and enter its updated text.'});
     Object.assign(request,{eventId:body.eventId,entryVersion:body.entryVersion,scope:body.scope});if(op==='edit-log')request.note=body.note;
    }else{if(!id(body.eventId))return res.status(400).json({error:'Save a client update before emailing it.'});if(body.logMode!=null&&!['latest','entire'].includes(body.logMode))return res.status(400).json({error:'Choose a log email option.'});if(body.cc!=null&&(!Array.isArray(body.cc)||body.cc.length>20||body.cc.some(v=>typeof v!=='string'||! /^[^\s@,;<>]+@(students\.)?bethelsd\.org$/.test(v))))return res.status(400).json({error:'Choose current leadership members to copy.'});if(op==='test-email'&&body.cc?.length)return res.status(400).json({error:'Test emails go only to your signed-in account.'});request.cc=body.cc||[];request.eventId=body.eventId;request.logMode=body.logMode||'latest';}
   }
  }
  const data=await bridge(request,45000);
  if(data.status!==200){
   const code=[400,401,403,404,409,428,502].includes(data.status)?data.status:503;
   return res.status(code).json({error:({400:'Invalid request.',401:'Your sign-in has expired.',403:'This action is limited to the assigned project manager and their current division leadership.',404:'This request is unavailable.',409:['edit-log','delete-log'].includes(op)?'The ticket or log entry changed. Refresh before continuing.':'The request changed or an email attempt already exists. Refresh before continuing.',428:'The service workbook needs its integration setup before this page can open.',502:op==='test-email'?'Test delivery is uncertain. Check your inbox, then refresh before sending another test.':'Email delivery is uncertain. Check sent mail before retrying.',503:'Service requests are temporarily unavailable. Refresh to check whether your change saved.'})[code]});
  }
  if(op==='client-view'){
   if(!Array.isArray(data.requests)||data.requests.length>5000)throw new Error('Invalid client view');
   return res.status(200).json({email:data.email,requests:data.requests.map(clientRow)});
  }
  if(op==='manage')return res.status(200).json({requests:data.requests,statuses,managers:data.managers,canReview:data.canReview,metrics:data.metrics,students:data.students,trimester:data.trimester});
  if(op==='reviews')return res.status(200).json({columns:data.columns,rows:data.rows});
  if(op==='metrics')return res.status(200).json({metrics:data.metrics,students:data.students,trimester:data.trimester});
  return res.status(200).json({eventId:data.eventId,emailState:data.emailState,testSent:data.testSent,request:data.request});
 }catch(error){console.error('Service request failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Service requests are temporarily unavailable. Refresh to check whether your change saved.'});}
}

export default withDiagnostics('service',handler);
