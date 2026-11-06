import {bridge,COOKIE,cookies,validToken,originAllowed} from '../lib/nest-auth.mjs';
export function createEmploymentHandler(school=bridge){return async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 let payload={action:'join-employment-schema'};
 if(req.method==='POST'){
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid application.'});
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid application.'});}
  if(!body||Array.isArray(body)||JSON.stringify(body).length>16000||!validToken(body.revision)||!/^[a-f0-9-]{36}$/.test(body.submission||'')||!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers))return res.status(400).json({error:'Check your application.'});
  const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to NEST before applying.'});
  payload={action:'auth-join-employment',session,revision:body.revision,submission:body.submission,answers:body.answers};
 }
 try{const data=await school(payload,55000);if(data.status===200)return res.status(200).json(req.method==='GET'?{schema:data.schema}:{received:data.received===true});const code=[400,401,403,409,429].includes(data.status)?data.status:503;return res.status(code).json({error:({400:'Complete all required questions.',401:'Sign in to NEST before applying.',403:'Choose your own division. Use your district NEST account to apply.',409:'This application changed. Reload before starting a new application.',429:'You have reached today’s application limit. Please try again tomorrow.',503:'The application service is temporarily unavailable. Keep this page open and retry the same application.'})[code]});}catch{return res.status(503).json({error:'We could not confirm the submission. Keep your answers and retry the same application.'});}
};}
export default createEmploymentHandler();
