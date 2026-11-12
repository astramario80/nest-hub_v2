import {COOKIE,cookies,validToken,bridge,originAllowed} from '../lib/nest-auth.mjs';
import {CLIENT_COOKIE} from '../lib/service-google.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fields={'drive-ensure':[],details:['fields','attachmentIds'],clients:['clients'],'shopping-publish':['visible'],'shopping-visibility':['visible'],'shopping-reply':['itemId','actionId','text'],'shopping-action':['itemId','actionId','text','change']};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});if(!originAllowed(req))return res.status(403).json({error:'Unavailable.'});
 let b=req.body;try{if(typeof b==='string')b=JSON.parse(b);}catch{return res.status(400).json({error:'Invalid ticket update.'});}
 if(!String(req.headers['content-type']||'').startsWith('application/json')||!b||Array.isArray(b)||!Object.hasOwn(fields,b.operation)||JSON.stringify(b).length>60000||!uuid(b.id)||!digest(b.version)||Object.keys(b).some(k=>!['operation','id','version',...fields[b.operation]].includes(k)))return res.status(400).json({error:'Check the ticket update and refresh its saved version.'});
 const client=b.operation==='shopping-action',jar=cookies(req),session=jar[client?CLIENT_COOKIE:COOKIE];if(!validToken(session))return res.status(401).json({error:client?'Verify your client email again.':'Sign in to NEST to manage this ticket.'});
 if(['shopping-reply','shopping-action'].includes(b.operation)&&(!uuid(b.itemId)||!uuid(b.actionId)||typeof b.text!=='string'||b.text.length>2000))return res.status(400).json({error:'Choose an item and enter a message of up to 2,000 characters.'});
 if(b.attachmentIds!==undefined&&(!Array.isArray(b.attachmentIds)||b.attachmentIds.length>5||b.attachmentIds.some(x=>!uuid(x))))return res.status(400).json({error:'Choose up to five uploaded files.'});
 const payload={action:client?'service-client-shopping-action':'auth-service-'+b.operation,session,id:b.id,version:b.version};for(const f of fields[b.operation])if(b[f]!==undefined)payload[f]=b[f];
 try{const data=await bridge(payload,55000);if(data.status!==200)return res.status([400,401,403,404,409,429].includes(data.status)?data.status:503).json({error:data.error||({400:'Check the ticket update.',401:'Your sign-in expired.',403:'Your current ticket access does not allow this action.',404:'This ticket or item is unavailable.',409:'This ticket changed. Refresh before retrying.'})[data.status]||'The update could not be confirmed. Refresh and retry the same action.'});return res.status(200).json({request:data.request});}catch{return res.status(503).json({error:'The update could not be confirmed. Refresh and retry the same action.'});}
}
