import { COOKIE, cookies, validToken, originAllowed, bridge } from '../lib/nest-auth.mjs';

const periods = new Set(['1','2','3','4','5','7','CTSO']);
const actions = new Set(['roster','tracker','tracker-update','export']);
const errors = {400:'Please check your entry.',401:'Sign in to NEST to continue.',403:'You do not have access to this period or action.',409:'The tracker changed. Refresh it before saving again.',429:'Too many requests. Please try again later.',503:'NEST access is temporarily unavailable.'};

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const fail=status=>res.status(status).json({error:errors[status]||'Request unavailable.'});
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'});}
  if(!originAllowed(req)) return fail(403);
  if(!String(req.headers['content-type']||'').startsWith('application/json')) return fail(400);
  let body=req.body;
  try {if(typeof body==='string') body=JSON.parse(body);} catch {return fail(400);}
  if(!body||Array.isArray(body)||JSON.stringify(body).length>4096||!periods.has(body.period)||!actions.has(body.action)) return fail(400);
  const session=cookies(req)[COOKIE];
  if(!validToken(session))return fail(401);
  const {period,action}=body;
  const payload={period,action,session};
  if(action==='tracker-update'){
    if(!Number.isInteger(body.revision)||!body.change||typeof body.change!=='object'||Array.isArray(body.change))return fail(400);
    payload.revision=body.revision;payload.change=body.change;
  }
  try {
    const data=await bridge(payload,50000);
    if(data.status!==200)return fail([400,401,403,409,429].includes(data.status)?data.status:503);
    if(!Number.isFinite(data.expires)||data.expires<=Date.now()||data.expires>Date.now()+2592005000)return fail(503);
    if(action==='roster'){
      if(!Array.isArray(data.names)||!data.names.every(name=>typeof name==='string'))return fail(503);
      return res.status(200).json({names:data.names,expires:data.expires,period});
    }
    if(data.period!==period||!Array.isArray(data.students)||!Array.isArray(data.assignments)||!Number.isInteger(data.revision))return fail(503);
    return res.status(200).json(data);
  } catch(error) {console.error('NEST tool request failed',{action,kind:error?.name||'Error'});return fail(503);}
}
