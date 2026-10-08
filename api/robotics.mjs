import {COOKIE,cookies,validToken,originAllowed,bridge} from '../lib/nest-auth.mjs';
const operations=new Set(['view','status','refresh','import','preview','send']);
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 let body={operation:'view'};
 if(req.method==='POST'){
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
  try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid request.'});}
 }
 if(!body||Array.isArray(body)||JSON.stringify(body).length>200000||!operations.has(body.operation))return res.status(400).json({error:'Invalid request.'});
 const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to NEST.'});
 // No caller can select a spreadsheet, division, identity, or arbitrary email recipient.
 const payload={action:'auth-robotics',session,operation:body.operation};
 if(body.operation==='status'){
  if(!/^[a-f0-9]{64}$/.test(body.member||'')||typeof body.active!=='boolean')return res.status(400).json({error:'Choose a member and status.'});
  Object.assign(payload,{member:body.member,active:body.active});
 }
 if(['status','refresh','import'].includes(body.operation)){
  if(!/^[a-f0-9]{64}$/.test(body.revision||''))return res.status(400).json({error:'Reload membership before saving.'});payload.revision=body.revision;
 }
 if(body.operation==='import'){
  if(typeof body.text!=='string'||body.text.length>150000||!body.text.trim())return res.status(400).json({error:'Paste the FIRST Team Roster page.'});payload.text=body.text;
 }
 if(body.operation==='preview'){
  if(!['join','waiver','both','test'].includes(body.kind))return res.status(400).json({error:'Choose a reminder type.'});payload.kind=body.kind;
 }
 if(body.operation==='send'){
  if(!/^[a-f0-9-]{36}$/.test(body.ticket||''))return res.status(400).json({error:'Preview recipients before sending.'});payload.ticket=body.ticket;
 }
 try{
  const result=await bridge(payload,50000);
  if(result.status!==200){const status=[400,401,403,409,429].includes(result.status)?result.status:503;
   return res.status(status).json({error:({400:'Check your entry. The roster must include Youth Members → Accepted.',401:'Your sign-in has expired.',403:'Only the CTSO CEO, CFO, COO, and Mario can manage Robotics.',409:'The records changed or this preview expired. Reload and preview again.',429:'The daily email limit has been reached.',503:'Robotics is temporarily unavailable. Please try again.'})[status]});}
  return res.status(200).json(result);
 }catch{return res.status(503).json({error:'Robotics is temporarily unavailable. Check saved status before retrying an action.'});}
}
