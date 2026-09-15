import { randomBytes, randomInt, createHmac } from 'node:crypto';
const periods=new Set(['1','2','3','4','5','7']);
const origins=new Set(['https://gknest.org','https://www.gknest.org']);
const errors={400:'Please check your entry.',401:'Verify your email to access this period. The code may be incorrect or expired.',403:'Please use gknest.org to sign in.',429:'Too many requests. Please try again later.',503:'Email access is temporarily unavailable. Please try again later.'};
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
  if(!body || JSON.stringify(body).length>2048 || !periods.has(body.period) || !['request','verify','roster','logout'].includes(body.action)) return fail(400);
  const endpoint=process.env.SPINNER_BRIDGE_URL,token=process.env.SPINNER_BRIDGE_TOKEN;
  if(!endpoint || !token) return fail(503);
  const {period,action}=body;
  const cookieName=kind=>`__Host-nest-${kind}-${period}`;
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
  }
  try {
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
    if(!response.ok) return fail(503);
    const data=await response.json();
    if(action==='logout' && [200,401].includes(data.status)) return res.status(200).json({ok:true});
    if(data.status===429 && action==='request' && Number.isFinite(data.retryAfter)) { const seconds=Math.min(3600,Math.max(1,Math.ceil(data.retryAfter)));res.setHeader('Retry-After',String(seconds));return res.status(429).json({error:`Please wait ${Math.ceil(seconds/60)} minute(s) before requesting another code. If you already received one, use that code.`,retryAfter:seconds}); }
    if(data.status!==200) return fail([400,401,429].includes(data.status)?data.status:503);
    if(action==='request') {res.setHeader('Set-Cookie',cookie('code',challenge,600));return res.status(200).json({message:'If this email is authorized for this period, a code is on its way. Check your inbox and spam folder.'});}
    if(action==='logout') return res.status(200).json({ok:true});
    if(!Array.isArray(data.names) || !data.names.every(n=>typeof n==='string') || !Number.isFinite(data.expires) || data.expires<=Date.now() || data.expires>Date.now()+21605000) return fail(503);
    if(action==='verify') res.setHeader('Set-Cookie',[cookie('session',session,Math.max(0,Math.floor((data.expires-Date.now())/1000))),cookie('code','',0)]);
    return res.status(200).json({names:data.names,expires:data.expires,period});
  } catch {return fail(503);}
}
