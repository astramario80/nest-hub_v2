import {cookies,COOKIE,IDENTITY,validToken,readIdentity,originAllowed,bridge} from '../lib/nest-auth.mjs';
import {diagnosticOwners,browserDiagnostic} from '../lib/diagnostics.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 const jar=cookies(req);if(!validToken(jar[COOKIE]))return res.status(401).json({error:'Sign in to NEST.'});
 if(req.method==='POST'){
  if(!originAllowed(req)||!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(403).json({error:'Unavailable.'});
  const actor=readIdentity(jar[COOKIE],jar[IDENTITY]);
  let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid report.'});}
  if(!Array.isArray(body?.events)||body.events.length>20||JSON.stringify(body).length>16000)return res.status(400).json({error:'Invalid report.'});
  const events=body.events.map(e=>browserDiagnostic(e,actor||{username:'anonymous'}));if(events.some(e=>!e))return res.status(400).json({error:'Invalid report.'});
  // Use only the verified signed identity; arbitrary browser text and identities are discarded.
  try{const result=await bridge({action:'diagnostics-record',session:jar[COOKIE],entries:events},8000);return result.status===200?res.status(200).json({recorded:true}):res.status(503).json({error:'Reporting temporarily unavailable.'});}catch{return res.status(503).json({error:'Reporting temporarily unavailable.'});}
 }
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed.'});
 const identity=readIdentity(jar[COOKIE],jar[IDENTITY]);if(identity&&!diagnosticOwners.has(identity.email))return res.status(403).json({error:'This dashboard is private to the NEST owner.'});
 try{const result=await bridge({action:'auth-diagnostics-read',session:jar[COOKIE]},25000);if(result.status!==200)return res.status([401,403].includes(result.status)?result.status:503).json({error:result.status===403?'This dashboard is private to the NEST owner.':'Diagnostics could not load. Try again.'});return res.status(200).json({events:result.events||[],capacity:5000,updatedAt:new Date().toISOString()});}catch{return res.status(503).json({error:'Diagnostics could not load. Try again.'});}
}
