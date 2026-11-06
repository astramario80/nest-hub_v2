import { createHmac, randomInt } from 'node:crypto';
import { bridge, cookies, COOKIE, TICKET, originAllowed, setCookie, token, validToken } from '../lib/nest-auth.mjs';

const CHALLENGE = '__Host-nest-robotics-challenge';
const SESSION = '__Host-nest-robotics-signup';
const errors = {400:'Check the required answers and try again.',401:'Verify your email again to continue.',409:'The form changed. Reload the page before submitting again.',429:'Please wait before requesting another code.',503:'The application service is temporarily unavailable. Your answers are still on this page.'};
export function createSignupHandler(school = bridge) {
 return async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed.'}); }
  let payload;
  if (req.method === 'GET') payload = {action:'robotics-signup-schema'};
  else {
   if (!originAllowed(req)) return res.status(403).json({error:'This action is unavailable.'});
   if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(400).json({error:errors[400]});
   let body;
   try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({error:errors[400]}); }
   if (!body || Array.isArray(body) || JSON.stringify(body).length > 60000 || !['request','verify','submit','account-setup','continue'].includes(body.operation)) return res.status(400).json({error:errors[400]});
   const secret = process.env.SPINNER_BRIDGE_TOKEN;
   if (!secret) return res.status(503).json({error:errors[503]});
   const ip = createHmac('sha256',secret).update('robotics-signup|' + String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()).digest('hex');
   payload = {action:'robotics-signup-' + body.operation,ip};
   if(body.operation==='continue'){const nestSession=cookies(req)[COOKIE];if(!validToken(nestSession))return res.status(401).json({error:'Sign in to NEST to continue.'});Object.assign(payload,{nestSession,session:token()});}
   else if(body.operation==='account-setup'){const session=cookies(req)[SESSION];if(!validToken(session))return res.status(401).json({error:errors[401]});Object.assign(payload,{action:'robotics-signup-account',session,ticket:token()});}
   else if (body.operation === 'request') {
    const email = String(body.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) return res.status(400).json({error:'Enter a valid email address.'});
    Object.assign(payload,{email,challenge:token(),code:String(randomInt(100000,1000000))});
   } else if (body.operation === 'verify') {
    body.code=String(body.code||'').replace(/\s/g,'');const challenge = cookies(req)[CHALLENGE];
    if (!validToken(challenge) || !/^\d{6}$/.test(body.code || '')) return res.status(401).json({error:'Enter the six-digit code from your email.'});
    Object.assign(payload,{challenge,code:body.code,session:token()});
   } else {
    const session = cookies(req)[SESSION];
    if (!validToken(session)) return res.status(401).json({error:errors[401]});
    if (!validToken(body.revision) || !body.answers || Array.isArray(body.answers) || typeof body.answers !== 'object') return res.status(400).json({error:errors[400]});
    const nestSession=cookies(req)[COOKIE];if(!validToken(nestSession))return res.status(401).json({error:'Sign in to NEST before submitting your application.'});Object.assign(payload,{session,nestSession,revision:body.revision,answers:body.answers});
   }
  }
  try {
   const result = await school(payload,55000);
   if(result.status===429){const wait=Math.max(1,Math.min(86400,Number(result.retryAfter)||60));res.setHeader('Retry-After',String(wait));return res.status(429).json({error:'Please wait '+(wait<60?wait+' seconds':Math.ceil(wait/60)+' minutes')+' before requesting another signup code.'});}
   if(result.status===401&&result.reason==='incorrect-code')return res.status(401).json({error:'That code did not match. Use the newest email and try again here. You have '+result.attemptsRemaining+' attempt(s) remaining.',retryable:true});
   if (result.status !== 200) { const code = [400,401,409,429].includes(result.status) ? result.status : 503; return res.status(code).json({error:errors[code]}); }
   if (req.method === 'GET') return res.status(200).json({schema:result.schema});
   if(payload.action==='robotics-signup-continue'){res.setHeader('Set-Cookie',setCookie(SESSION,payload.session,3600));return res.status(200).json({verified:true,email:result.email});}
   if(payload.action==='robotics-signup-account'){if(result.needsAccount)res.setHeader('Set-Cookie',setCookie(TICKET,payload.ticket,600));return res.status(200).json({email:result.email,needsAccount:result.needsAccount===true});}
   if (payload.action.endsWith('-request')) { res.setHeader('Set-Cookie',setCookie(CHALLENGE,payload.challenge,600)); return res.status(200).json({codeSent:true}); }
   if (payload.action.endsWith('-verify')) { res.setHeader('Set-Cookie',[setCookie(SESSION,payload.session,3600),setCookie(CHALLENGE,'',0)]); return res.status(200).json({verified:true,email:result.email}); }
   return res.status(200).json({received:result.received === true});
  } catch { return res.status(503).json({error:errors[503]}); }
 };
}
export default createSignupHandler();
