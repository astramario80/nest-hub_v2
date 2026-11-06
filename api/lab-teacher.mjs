import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {bridge,originAllowed} from '../lib/nest-auth.mjs';
import {labStorageKey} from './lab-storage.mjs';
import {teacherPage} from '../lib/lab-teacher-page.mjs';
const mac=value=>createHmac('sha256',process.env.SPINNER_BRIDGE_TOKEN).update('nest-teacher-navigation:'+value).digest('base64url');
export const humanNavigation=req=>req.headers['sec-fetch-user']==='?1'&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document'&&!/prefetch|prerender/i.test(String(req.headers['sec-purpose']||req.headers.purpose||''));
export function navigationGrant(){const value=Buffer.from(JSON.stringify({expires:Date.now()+120000,nonce:randomBytes(16).toString('hex')})).toString('base64url');return value+'.'+mac(value);}
export function validNavigationGrant(value){try{if(typeof value!=='string'||value.length>500)return false;const parts=value.split('.');if(parts.length!==2)return false;const [body,signature]=parts;if(!body||!signature||!/^[A-Za-z0-9_-]+$/.test(signature))return false;const expected=mac(body),a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return false;const parsed=JSON.parse(Buffer.from(body,'base64url'));return parsed.expires>Date.now()&&parsed.expires<=Date.now()+120000&&/^[a-f0-9]{32}$/.test(parsed.nonce);}catch{return false;}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
 if(req.method==='HEAD')return res.status(200).end();
 if(req.method==='GET'){
  // GET never changes a request. Standard user-initiated browser navigation can
  // authorize the page's one-click POST; scanner/prefetch visits get a fallback.
  const demo=req.query?.demo==='1',grant=demo?'demo':humanNavigation(req)&&process.env.SPINNER_BRIDGE_TOKEN?navigationGrant():'';
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");return res.status(200).send(teacherPage({grant,demo}));
 }
 if(req.method!=='POST'){res.setHeader('Allow','GET, HEAD, POST');return res.status(405).json({error:'Method not allowed.'});}
 if(!originAllowed(req)||!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(403).json({error:'This action is unavailable.'});
 let input=req.body;try{if(typeof input==='string')input=JSON.parse(input);}catch{return res.status(400).json({error:'Open the link from your NEST™ Request email again.'});}
 if(!input||typeof input!=='object'||JSON.stringify(input).length>1500||!['view','deny'].includes(input.operation)||!/^[a-f0-9]{64}$/.test(input.teacherToken||''))return res.status(400).json({error:'Open the link from your NEST™ Request email again.'});
 if(input.operation==='deny'&&input.mode!=='manual'&&!validNavigationGrant(input.grant))return res.status(409).json({error:'Please use the confirmation button below.'});
 try{const data=await bridge({action:'lab-teacher-action',operation:input.operation,teacherToken:input.teacherToken,storageToken:labStorageKey(),...(input.operation==='deny'?{mailToken:process.env.POSTMARK_SERVER_TOKEN}:{})},55000);if(data.status!==200)return res.status([400,403,409,410].includes(data.status)?data.status:503).json({error:data.error||'This response could not be confirmed. Open the email link again before retrying.'});const {status,...result}=data;return res.status(200).json(result);}catch{return res.status(503).json({error:'This response could not be confirmed. Open the email link again before retrying; repeated clicks will not send duplicate confirmations.'});}
}
