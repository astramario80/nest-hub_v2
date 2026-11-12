import {mediaId} from '../lib/service-media.mjs';
import {randomInt,createHmac} from 'node:crypto';
import {CODE_COOKIE,serviceEmail,intakeFields} from '../lib/service-intake.mjs';
import { withDiagnostics } from '../lib/diagnostics.mjs';
import { COOKIE,cookies,validToken,token,bridge,originAllowed,setCookie } from '../lib/nest-auth.mjs';
import { CLIENT_COOKIE,NONCE_COOKIE,newChallenge,readChallenge,verifyStaff } from '../lib/service-google.mjs';
const statuses=['New!','Assigned','In Progress','Completed','Closed'];
const id=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const clientRow=r=>({driveFolder:r.driveFolder?{url:r.driveFolder.url}:null,attachments:r.attachments||[],canAct:r.canAct===true,version:r.version,clients:r.clients||[],clientShopping:{available:r.clientShopping?.available===true,items:(r.clientShopping?.items||[]).map(x=>({id:x.id,title:x.title,quantity:x.quantity,unitCost:x.unitCost,url:x.url,status:x.status||'open',purchasedAt:x.purchasedAt||'',questions:x.questions||[],followUp:x.followUp===true,pendingAction:x.pendingAction||null}))},client:r.client?{name:String(r.client.name||''),email:String(r.client.email||''),address:String(r.client.address||'')}:null,submittedBy:r.submittedBy?{name:String(r.submittedBy.name||''),email:String(r.submittedBy.email||'')}:null,id:r.id,status:r.status,created:typeof r.created==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(r.created)&&Number.isFinite(Date.parse(r.created))?r.created:'',description:r.description,category:r.category,room:r.room,manager:r.manager,updates:(r.updates||[]).map(e=>({time:e.time,status:e.status,note:e.note,attachments:e.attachments||[]}))});
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
  if(!body||Array.isArray(body)||JSON.stringify(body).length>(body?.operation==='members'?100000:12000))return res.status(400).json({error:'Invalid request.'});
 }
 const op=req.method==='POST'?body.operation:operation;
 let request;
 try{
  if(req.method==='POST'&&op==='code-request'){
   const email=serviceEmail(body.email);if(!email)return res.status(400).json({error:'Enter a valid email address.'});
   const challenge=token(),code=String(randomInt(0,1000000)).padStart(6,'0'),ip=createHmac('sha256',process.env.SPINNER_BRIDGE_TOKEN||'').update(String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()).digest('hex');
   const data=await bridge({action:'service-client-code-request',email,challenge,code,ip},55000);
   if(data.status!==200)return res.status(data.status===429?429:503).json({error:data.status===429?'Please wait before requesting another code.':'The verification email could not be confirmed. Please wait a minute before requesting a new code.'});
   res.setHeader('Set-Cookie',setCookie(CODE_COOKIE,challenge,600));return res.status(200).json({message:'Check your inbox for a six-digit code. It expires in 10 minutes.'});
  }
  if(req.method==='POST'&&op==='code-verify'){
   if(!validToken(jar[CODE_COOKIE])||!/^\d{6}$/.test(body.code||''))return res.status(401).json({error:'Enter the six-digit code from your email, or request a new code.'});
   const session=token(),data=await bridge({action:'service-client-code-verify',challenge:jar[CODE_COOKIE],code:body.code,session,previous:jar[CLIENT_COOKIE]},45000);
   if(data.status!==200)return res.status(data.status===429?429:data.status===503?503:401).json({error:data.status===503?'Verification is temporarily unavailable. Try again.':'The code is invalid, expired, or has already been used. Request a new code.'});
   res.setHeader('Set-Cookie',[setCookie(CLIENT_COOKIE,session,28800),setCookie(CODE_COOKIE,'',0)]);return res.status(200).json({email:data.email});
  }
  if(req.method==='POST'&&op==='submit-request'){
   if(!validToken(jar[CLIENT_COOKIE]))return res.status(401).json({error:'Verify your email before submitting a request.'});
   const fields=intakeFields(body.fields),attachmentIds=body.attachmentIds||[];if(!id(body.id)||!fields||!Array.isArray(attachmentIds)||attachmentIds.length>5||new Set(attachmentIds).size!==attachmentIds.length||attachmentIds.some(id=>!mediaId(id)))return res.status(400).json({error:'Complete the required request fields. Attachment links must be Google Drive file links.'});
   const data=await bridge({action:'service-client-submit',session:jar[CLIENT_COOKIE],id:body.id,fields,attachmentIds},55000);
   if(data.status!==200)return res.status([401,409,425,429].includes(data.status)?data.status:503).json({error:({401:'Your email verification has expired. Verify your email again; your draft is still here.',409:'This submission reference has already been used for different details. Open My requests before starting another request.',425:'The attachments are still finishing. Retry this same submission.',429:'Please wait before submitting more requests.'})[data.status]||'The save could not be confirmed. Retry this same request to check its result; do not start a second request.'});
   return res.status(200).json({id:data.id,replayed:data.replayed===true,notificationQueued:data.notificationQueued===true});
  }
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
  if(req.method==='GET'&&op==='directory'){
   const nest=validToken(jar[COOKIE]),client=validToken(jar[CLIENT_COOKIE]);if(!nest&&!client)return res.status(401).json({error:'Verify your email before choosing a staff contact.'});
   request={action:nest?'auth-service-directory':'service-client-directory',session:nest?jar[COOKIE]:jar[CLIENT_COOKIE]};
  }else if(req.method==='GET'&&op==='client-view'){
   if(!validToken(jar[CLIENT_COOKIE]))return res.status(401).json({error:'Verify your email to see your requests.'});
   request={action:'service-client-view',session:jar[CLIENT_COOKIE]};
  }else{
   if(!validToken(jar[COOKIE]))return res.status(401).json({error:'Sign in to NEST to use Client Relations.'});
   if(req.method==='GET'&&!['manage','reviews','metrics','ticket','shopping-status'].includes(op)||req.method==='POST'&&!['client','members','update','email','edit-log','delete-log','test-email','shopping-save','shopping-remove','shopping-push','shopping-route'].includes(op))return res.status(400).json({error:'Invalid action.'});
   request={action:'auth-service-'+op,session:jar[COOKIE]};
   if(['ticket','shopping-status'].includes(op)){if(!id(req.query?.id))return res.status(400).json({error:'Select a request.'});request.id=req.query.id;}
   if(req.method==='POST'){
    if(!id(body.id)||!digest(body.version))return res.status(400).json({error:'Refresh and select a request.'});
    Object.assign(request,{id:body.id,version:body.version});
    if(['shopping-save','shopping-remove','shopping-push','shopping-route'].includes(op)){
     if(op!=='shopping-push'){if(!id(body.itemId))return res.status(400).json({error:'Choose an item.'});request.itemId=body.itemId;}
     if(op==='shopping-route'){if(!['requisition','client','inventory'].includes(body.route))return res.status(400).json({error:'Choose the item purchase destination.'});request.route=body.route;}
     if(op==='shopping-save'){if(typeof body.title!=='string'||!body.title.trim()||body.title.length>120||!Number.isInteger(body.quantity)||body.quantity<1||body.quantity>10000||!(body.unitCost===null||typeof body.unitCost==='number'&&Number.isFinite(body.unitCost)&&body.unitCost>=0&&body.unitCost<=1000000&&Math.abs(body.unitCost*100-Math.round(body.unitCost*100))<.00001)||typeof body.url!=='string'||body.url.length>500||body.url&&!/^https:\/\/[^\s<>"']+$/.test(body.url)||typeof body.notes!=='string'||body.notes.length>500||!['CTE','ASB'].includes(body.fund))return res.status(400).json({error:'Check the shopping item details.'});if(body.clientPurchaseRequested!==undefined&&typeof body.clientPurchaseRequested!=='boolean')return res.status(400).json({error:'Choose a funding request.'});Object.assign(request,{title:body.title,quantity:body.quantity,unitCost:body.unitCost,url:body.url,notes:body.notes,fund:body.fund,clientPurchaseRequested:body.clientPurchaseRequested===true});}
    }else if(op==='client'){
     if(typeof body.email!=='string'||body.email.length>254||!serviceEmail(body.email)||typeof body.name!=='string'||!body.name.trim()||body.name.length>200)return res.status(400).json({error:'Enter the client name and email address.'});
     if(typeof (body.address??'')!=='string'||String(body.address??'').length>500||/[\u0000-\u001f\u007f]/.test(String(body.address??'')))return res.status(400).json({error:'Enter a valid client address.'});request.email=serviceEmail(body.email);request.name=body.name.trim();request.address=String(body.address??'').trim();
    }else if(op==='members'){
     if(!Array.isArray(body.members)||body.members.some(v=>typeof v!=='string'||v.length>254||! /^[^\s@,;<>]+@students\.bethelsd\.org$/.test(v)))return res.status(400).json({error:'Choose current students as project members.'});
     request.members=body.members;
    }else if(op==='update'){
     if(!statuses.includes(body.status)||typeof body.manager!=='string'||body.manager.length>254||typeof body.note!=='string'||body.note.length>2000||typeof body.publicNote!=='string'||body.publicNote.length>2000)return res.status(400).json({error:'Invalid update.'});
     if(body.entryId!==undefined&&!id(body.entryId)||body.attachmentIds!==undefined&&(!Array.isArray(body.attachmentIds)||body.attachmentIds.length>5||body.attachmentIds.some(x=>!id(x))))return res.status(400).json({error:'Check the log attachments.'});Object.assign(request,{status:body.status,manager:body.manager,note:body.note,publicNote:body.publicNote,...(body.entryId?{entryId:body.entryId,attachmentIds:body.attachmentIds||[]}: {})});
    }else if(['edit-log','delete-log'].includes(op)){
     if(!id(body.eventId)||!digest(body.entryVersion)||!['public','internal'].includes(body.scope)||op==='edit-log'&&(typeof body.note!=='string'||!body.note.trim()||body.note.length>2000))return res.status(400).json({error:'Choose a saved log entry and enter its updated text.'});
     Object.assign(request,{eventId:body.eventId,entryVersion:body.entryVersion,scope:body.scope});if(op==='edit-log')request.note=body.note;
    }else{if(!id(body.eventId))return res.status(400).json({error:'Save a client update before emailing it.'});if(body.logMode!=null&&!['latest','entire'].includes(body.logMode))return res.status(400).json({error:'Choose a log email option.'});if(body.cc!=null&&(!Array.isArray(body.cc)||body.cc.length>20||body.cc.some(v=>typeof v!=='string'||! /^[^\s@,;<>]+@(students\.)?bethelsd\.org$/.test(v))))return res.status(400).json({error:'Choose current leadership members to copy.'});if(op==='test-email'&&body.cc?.length)return res.status(400).json({error:'Test emails go only to your signed-in account.'});request.cc=body.cc||[];request.eventId=body.eventId;request.logMode=body.logMode||'latest';if(body.includeMedia!==undefined&&typeof body.includeMedia!=='boolean')return res.status(400).json({error:'Choose whether to include client media.'});request.includeMedia=body.includeMedia===true;if(body.includeShopping!==undefined){if(typeof body.includeShopping!=='boolean')return res.status(400).json({error:'Choose whether to include the shopping list.'});request.includeShopping=body.includeShopping;}}
   }
  }
  const data=await bridge(request,45000);
  if(data.status!==200){
   const code=[400,401,403,404,409,428,502].includes(data.status)?data.status:503;
   return res.status(code).json({error:data.error||({400:'Invalid request.',401:'Your sign-in has expired.',403:'Your current ticket permissions do not allow this action.',404:'This request is unavailable.',409:['edit-log','delete-log'].includes(op)?'The ticket or log entry changed. Refresh before continuing.':'The request changed or an email attempt already exists. Refresh before continuing.',428:'The service workbook needs its integration setup before this page can open.',502:op==='test-email'?'Test delivery is uncertain. Check your inbox, then refresh before sending another test.':'Email delivery is uncertain. Check sent mail before retrying.',503:'Service requests are temporarily unavailable. Refresh to check whether your change saved.'})[code]});
  }
  if(op==='shopping-status')return res.status(200).json({items:data.items||[]});
  if(op==='directory')return res.status(200).json({staff:Array.isArray(data.staff)?data.staff.map(x=>({name:x.name,email:x.email})):[],directoryUnavailable:data.directoryUnavailable===true});
  if(op==='client-view'){
   if(!Array.isArray(data.requests)||data.requests.length>5000)throw new Error('Invalid client view');
   return res.status(200).json({email:data.email,requests:data.requests.map(clientRow)});
  }
  if(op==='manage')return res.status(200).json({requests:data.requests,statuses,managers:data.managers,canReview:data.canReview,chartTickets:data.chartTickets,metrics:data.metrics,students:data.students,trimester:data.trimester});
  if(op==='reviews')return res.status(200).json({columns:data.columns,rows:data.rows});
  if(op==='metrics')return res.status(200).json({chartTickets:data.chartTickets,metrics:data.metrics,students:data.students,trimester:data.trimester});
  return res.status(200).json({eventId:data.eventId,emailState:data.emailState,testSent:data.testSent,request:data.request});
 }catch(error){console.error('Service request failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Service requests are temporarily unavailable. Refresh to check whether your change saved.'});}
}

export default withDiagnostics('service',handler);
