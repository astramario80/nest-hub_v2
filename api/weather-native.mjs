import {COOKIE,cookies,validToken,originAllowed,bridge,bridgeFailure} from '../lib/nest-auth.mjs';
const reads=new Set(['bootstrap','counselor','reports','alerts','alert-access']);
const writes=new Set(['confirm','submit','test','export','calendar','import-calendar','refresh-counselors']);
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to continue.'});
 if(req.method==='POST'&&(!originAllowed(req)||!String(req.headers['content-type']||'').startsWith('application/json')))return res.status(403).json({error:'This action is unavailable.'});
 const input=req.method==='GET'?req.query:req.body;
 if(!input||typeof input!=='object'||JSON.stringify(input).length>15000)return res.status(400).json({error:'Invalid weather request.'});
 const operation=String(input.operation||'bootstrap');if(!(req.method==='GET'?reads:writes).has(operation))return res.status(400).json({error:'Invalid weather action.'});
 // Only selected fields cross the bridge. Identity, owner status, audience, and timestamps never come from the browser.
 const payload={action:'auth-weather-native',session,operation};
 for(const key of ['period','page','year','trimester','since','draft','emotion','pacing','challenge','safety','working','change','dates','previewSurname'])if(Object.hasOwn(input,key))payload[key]=input[key];
 try{
  const data=await bridge(payload,operation==='export'?55000:45000);
  if(data.status!==200){const code=[400,401,403,409,429].includes(data.status)?data.status:503;return res.status(code).json({error:data.error||({400:'Check the required fields.',401:'Your sign-in has expired.',403:'Your account does not have access to this weather action.',409:'Confirm your emotion again before submitting.',429:'Please wait before confirming another emotion.'}[code])||'Weather reports are temporarily unavailable. Please try again.'});}
  const {status,...result}=data;return res.status(200).json(result);
 }catch(error){console.error('Native weather request failed',{operation,...bridgeFailure(error)});return res.status(503).json({error:'NEST could not confirm this action. Please try again; repeated confirmations and submissions are protected against duplicates.'});}
}
