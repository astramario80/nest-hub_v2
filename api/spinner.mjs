import { randomBytes, randomInt, createHmac } from 'node:crypto';
const periods=new Set(['1','2','3','4','5','7','CTSO']);
const origins=new Set(['https://gknest.org','https://www.gknest.org']);
const errors={400:'Please check your entry.',401:'Verify your email to access this period. The code may be incorrect or expired.',403:'You do not have permission for this action.',409:'The tracker changed. Refresh it before saving again.',429:'Too many requests. Please try again later.',503:'Email access is temporarily unavailable. Please try again later.'};
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const fail=status=>res.status(status).json({error:errors[status]||'Request unavailable.'});
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'});}
  if(!origins.has(req.headers.origin) && !(process.env.NODE_ENV!=='production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin||''))) return fail(403);
  if(!String(req.headers['content-type']||'').startsWith('application/json')) return fail(400);
  let body=req.body;
  try {if(typeof body==='string') body=JSON.parse(body);} catch {return fail(400);}
  if(!body || JSON.stringify(body).length>2048 || !periods.has(body.period) || !['request','verify','roster','logout','tracker','tracker-update','export'].includes(body.action)) return fail(400);
  const endpoint=process.env.SPINNER_BRIDGE_URL,token=process.env.SPINNER_BRIDGE_TOKEN;
  if(!endpoint || !token) return fail(503);
  const {period,action}=body;
  const cookieName=kind=>`__Host-nest-${kind}`;
  const cookies=Object.fromEntries(String(req.headers.cookie||'').split(';').map(c=>c.trim().split('=')));
  const readCookie=kind=>/^[a-f0-9]{64}$/.test(cookies[cookieName(kind)]||'')?cookies[cookieName(kind)]:'';
  const cookie=(kind,value,seconds)=>`${cookieName(kind)}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Strict`;
  let challenge=readCookie('code'),session=readCookie('session');
  const payload={token,period,action};
  if(action==='request') {
    const email=String(body.email||'').trim().toLowerCase();
    if(email.length>254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) return fail(400);
    challenge=challenge || randomBytes(32).toString('hex');
    Object.assign(payload,{email,challenge,code:String(randomInt(1000000)).padStart(6,'0'),
      ip:createHmac('sha256',token).update(String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()).digest('hex')});
  } else if(action==='verify') {
    if(!challenge || !/^\d{6}$/.test(body.code||'')) return fail(401);
    session=randomBytes(32).toString('hex');Object.assign(payload,{challenge,session,code:body.code});
  } else {
    if(action==='logout') res.setHeader('Set-Cookie',[cookie('session','',0),cookie('code','',0)]);
    if(!session) return action==='logout'?res.status(200).json({ok:true}):fail(401);
    payload.session=session;
    if(action==='tracker-update'){if(!Number.isInteger(body.revision) || !body.change || typeof body.change!=='object')return fail(400);payload.revision=body.revision;payload.change=body.change;}
  }
  let stage='google-request';const started=Date.now();
  try {
    const signal=AbortSignal.timeout(45000);
    let response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'manual',signal});
    console.info('NEST bridge stage',{action,stage,status:response.status,ms:Date.now()-started});
    if([301,302,303].includes(response.status)){
      const target=new URL(response.headers.get('location'));
      if(target.protocol!=='https:' || target.hostname!=='script.googleusercontent.com')return fail(503);
      stage='google-result';
      // Retry only the response GET; never repeat the email or verification POST.
      for(let attempt=0;attempt<2;attempt++){
        try{
          response=await fetch(target,{redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
          if(response.ok || ![404,429,500,502,503,504].includes(response.status))break;
        }catch(error){if(attempt===1 || signal.aborted)throw error;}
      }
      console.info('NEST bridge stage',{action,stage,status:response.status,ms:Date.now()-started});
    }
    stage='result-body';
    if(!response.ok) return fail(503);
    const data=await response.json();
    if(action==='logout' && [200,401].includes(data.status)) return res.status(200).json({ok:true});
    if(data.status===429 && action==='request' && Number.isFinite(data.retryAfter)) { const seconds=Math.min(3600,Math.max(1,Math.ceil(data.retryAfter)));res.setHeader('Retry-After',String(seconds));return res.status(429).json({error:`Please wait ${Math.ceil(seconds/60)} minute(s) before requesting another code. If you already received one, use that code.`,retryAfter:seconds}); }
    if(data.status!==200) return fail([400,401,403,409,429].includes(data.status)?data.status:503);
    if(action==='request') {res.setHeader('Set-Cookie',cookie('code',challenge,600));return res.status(200).json({message:'If this email is authorized for this period, a code is on its way. Check your inbox and spam folder.'});}
    if(action==='logout') return res.status(200).json({ok:true});
    if(['tracker','tracker-update','export'].includes(action)) {
      if(!Number.isFinite(data.expires)||data.expires<=Date.now()||data.expires>Date.now()+21605000||data.period!==period||!Array.isArray(data.students)||!Array.isArray(data.assignments)||!Number.isInteger(data.revision))return fail(503);
      return res.status(200).json(data);
    }
    if(!Array.isArray(data.names) || !data.names.every(n=>typeof n==='string') || !Number.isFinite(data.expires) || data.expires<=Date.now() || data.expires>Date.now()+21605000) return fail(503);
    if(action==='verify') res.setHeader('Set-Cookie',[cookie('session',session,Math.max(0,Math.floor((data.expires-Date.now())/1000))),cookie('code','',0)]);
    return res.status(200).json({names:data.names,expires:data.expires,period});
  } catch (error) {console.error('NEST bridge request failed',{action,stage,ms:Date.now()-started,kind:error?.name||'Error'});return fail(503);}
}
