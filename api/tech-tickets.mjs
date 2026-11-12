import {COOKIE,cookies,validToken,bridge,originAllowed} from '../lib/nest-auth.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
export function createTechTicketHandler(read=bridge){return async function(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
 const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to use Tech Tickets.'});
 let payload={action:'auth-tech-tickets',session};
 if(req.method==='GET'){
  const operation=req.query?.operation||'view';if(!['catalog','view','access','image','legacy','escalation-options'].includes(operation)||['image','escalation-options'].includes(operation)&&!uuid(req.query?.id))return res.status(400).json({error:'Invalid ticket request.'});Object.assign(payload,{operation,...(['image','escalation-options'].includes(operation)?{id:req.query.id}:{})});
 }else{
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
  let b=req.body;try{if(typeof b==='string')b=JSON.parse(b);}catch{return res.status(400).json({error:'Invalid request.'});}
  const keys=b?.operation==='submit'?['operation','id','fields','screenshot']:b?.operation==='update'?['operation','id','version','status','assignee','note','internal','actionId']:b?.operation==='escalate-owner'?['operation','id','version','actionId','note']:b?.operation==='escalation-preview'?['operation','id','version','recipientKey','note']:b?.operation==='escalation-send'?['operation','id','version','actionId','recipientKey','note','previewHash']:b?.operation==='escalation-reconcile'?['operation','id','version','actionId','resolution']:[];
  if(!b||Array.isArray(b)||!keys.length||Object.keys(b).some(k=>!keys.includes(k))||!uuid(b.id)||JSON.stringify(b).length>510000)return res.status(400).json({error:'Check the ticket details.'});
  if(b.operation==='submit'&&(typeof b.screenshot!=='string'||b.screenshot.length>500000||b.screenshot&&!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(b.screenshot)||!b.fields||typeof b.fields!=='object'))return res.status(400).json({error:'Check the screenshot and ticket details.'});
  Object.assign(payload,b);
 }
 try{let data=await read(payload,payload.operation==='submit'?40000:55000);if(data.status===503)console.error('Tech Ticket school error',{operation:payload.operation,diagnostic:data.diagnostic||'unclassified'});if(payload.operation==='submit'&&data.status===503){try{const saved=await read({action:'auth-tech-tickets',session,operation:'result',id:payload.id},12000);if(saved.status===200)data=saved;}catch{}}if(data.status!==200)return res.status([400,401,403,404,409,429].includes(data.status)?data.status:503).json({error:data.error||({400:'Complete the required fields and choose your division.',401:'Your sign-in expired. Sign in again; your draft is still here.',403:'Your current NEST role does not allow this action.',404:'This ticket is unavailable.',409:'The ticket changed. Refresh before saving again.',429:'Please wait before submitting more tickets.'})[data.status]||(req.method==='GET'?'The school connection is temporarily unavailable. Your draft is still here.':'The result could not be confirmed. Retry the same action to check whether it saved.')});
  const {status,...result}=data;return res.status(200).json(result);
 }catch(error){console.error('Tech Ticket connection failed',{operation:payload.operation,kind:error.name,stage:error.bridgeStage});if(payload.operation==='submit'){try{const saved=await read({action:'auth-tech-tickets',session,operation:'result',id:payload.id},12000);if(saved.status===200)return res.status(200).json({ticket:saved.ticket,recovered:true});}catch{}}return res.status(503).json({error:req.method==='GET'?'The school connection is temporarily unavailable. Your draft is still here.':'The result could not be confirmed. Retry the same action to check whether it saved.'});}
};}
export default createTechTicketHandler();
