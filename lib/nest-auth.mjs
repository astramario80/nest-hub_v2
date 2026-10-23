import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const COOKIE = '__Host-nest-auth';
export const CHALLENGE = '__Host-nest-register-challenge';
export const TICKET = '__Host-nest-register-ticket';
export const RECOVERY_CHALLENGE = '__Host-nest-recovery-challenge';
export const RECOVERY_TICKET = '__Host-nest-recovery-ticket';
export const IDENTITY = '__Host-nest-identity';
export const IDENTITY_TTL = 300;
export const durations = Object.freeze({ session: 12 * 3600, '1d': 86400, '7d': 604800, '30d': 2592000 });
export const token = () => randomBytes(32).toString('hex');
export const validToken = value => /^[a-f0-9]{64}$/.test(value || '');
const identityMac = value => createHmac('sha256', process.env.SPINNER_BRIDGE_TOKEN).update(`nest-identity-v1:${value}`).digest('base64url');
export function signedIdentity(session, data) {
  if (!validToken(session) || !process.env.SPINNER_BRIDGE_TOKEN ||
      !username(data.username) || !accountEmail(data.email) ||
      !Number.isFinite(data.expires) || data.expires <= Date.now() || data.expires > Date.now() + durations['30d'] * 1000 + 5000) return '';
  const value = Buffer.from(JSON.stringify({ u: username(data.username), e: accountEmail(data.email), x: data.expires, c: Math.min(data.expires, Date.now() + IDENTITY_TTL * 1000), s: identityMac(session) })).toString('base64url');
  return `${value}.${identityMac(value)}`;
}
export function readIdentity(session, raw) {
  if (!validToken(session) || !process.env.SPINNER_BRIDGE_TOKEN || typeof raw !== 'string' || raw.length > 1024) return null;
  const parts = raw.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const expected = Buffer.from(identityMac(parts[0]));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (data.s !== identityMac(session) || !username(data.u) || !accountEmail(data.e) ||
        !Number.isFinite(data.x) || data.x <= Date.now() || data.x > Date.now() + durations['30d'] * 1000 + 5000 ||
        !Number.isFinite(data.c) || data.c <= Date.now() || data.c > Date.now() + IDENTITY_TTL * 1000 + 5000) return null;
    return { username: data.u, email: data.e, expires: data.x };
  } catch { return null; }
}
export const districtEmail = value => {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@,;<>]+@(students\.bethelsd\.org|bethelsd\.org)$/.test(email) ? email : '';
};
export const accountEmail = value => {
  const key = String(value || '').trim().toLowerCase();
  return districtEmail(key) || (['mario@memberhq.net','mpenalver@bethelsd.org','astramario@gmail.com'].includes(key) ? key : '') || (/^manual:[a-z][a-z0-9._-]{2,31}$/.test(key) ? key : '');
};
export const registrationEmail = value => {
  const email = accountEmail(value);
  return email.startsWith('manual:') ? '' : email;
};
export const username = value => {
  const name = String(value || '').trim().toLowerCase();
  return /^[a-z][a-z0-9._-]{2,31}$/.test(name) ? name : '';
};
export function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? [] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(pair => pair.length));
}
export function setCookie(name, value, seconds) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict'];
  if (Number.isFinite(seconds)) parts.push(`Max-Age=${Math.max(0, Math.floor(seconds))}`);
  return parts.join('; ');
}
export function originAllowed(req) {
  const origin = req.headers.origin;
  return origin === 'https://gknest.org' || origin === 'https://www.gknest.org' ||
    (/^[a-z0-9.-]+\.vercel\.app$/.test(req.headers.host || '') && origin === `https://${req.headers.host}`) ||
    (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || ''));
}
const retryableSchoolHTTP=status=>[404,408,429,500,502,503,504].includes(status);
const schoolRead=request=>request.action==='auth-me'||request.action==='auth-group-email-access'||request.action==='auth-leadership-directory'||request.action==='auth-division-slides'&&['access','status'].includes(request.operation);
export function bridgeFailure(error){
 const raw=error?.cause?.code||error?.code;
 const code=typeof raw==='string'&&/^(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ENETUNREACH|UND_ERR_(?:CONNECT_TIMEOUT|HEADERS_TIMEOUT|BODY_TIMEOUT|SOCKET))$/.test(raw)?raw:error?.name==='TimeoutError'?'TIMEOUT':error?.name==='SyntaxError'?'INVALID_JSON':'UNAVAILABLE';
 return {kind:error?.name||'Error',stage:error?.bridgeStage||'response',code,...(Number.isInteger(error?.schoolHTTP)?{httpStatus:error.schoolHTTP}:{})};
}
export async function bridge(request, timeout = 45000) {
 const started=Date.now(),endpoint=process.env.SPINNER_BRIDGE_URL,bridgeToken=process.env.SPINNER_BRIDGE_TOKEN;
 if(!endpoint||!bridgeToken)throw new Error('Bridge not configured');
 const signal=AbortSignal.timeout(timeout),readOnly=schoolRead(request);
 const pause=async()=>{if(!signal.aborted)await new Promise(resolve=>setTimeout(resolve,150));};
 const httpError=status=>Object.assign(new Error(`Google bridge HTTP ${status}`),{schoolHTTP:status,retryable:retryableSchoolHTTP(status)});
 let stage='school-request';
 for(let attempt=0;attempt<(readOnly?2:1);attempt++){
  try{
   stage='school-request';
   let response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,token:bridgeToken}),redirect:'manual',signal:readOnly?AbortSignal.any([signal,AbortSignal.timeout(Math.min(18000,timeout))]):signal});
   if([301,302,303].includes(response.status)){
    const target=new URL(response.headers.get('location'));
    if(target.protocol!=='https:'||target.hostname!=='script.googleusercontent.com')throw Object.assign(new Error('Unexpected Google response host'),{retryable:false});
    // Reading the signed result again never executes the original action again.
    for(let resultAttempt=0;resultAttempt<2;resultAttempt++){
     try{
      stage='school-result';
      response=await fetch(target,{redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(16000)])});
      if(!response.ok)throw httpError(response.status);
      stage='school-result-body';const data=await response.json();
      if(readOnly&&data?.status===503&&attempt===0)throw Object.assign(new Error('School service unavailable'),{restartRead:true});
      if(['auth-hiring-view','auth-division-slides','auth-leadership-directory'].includes(request.action))console.info('NEST school read completed',{action:request.action,milliseconds:Date.now()-started});
      return data;
     }catch(error){
      error.bridgeStage=stage;
      if(resultAttempt===1||signal.aborted||error.retryable===false||error.restartRead)throw error;
      await pause();
     }
    }
   }
   if(!response.ok)throw httpError(response.status);
   stage='school-response-body';const data=await response.json();
   if(readOnly&&data?.status===503&&attempt===0){await pause();continue;}
   return data;
  }catch(error){
   error.bridgeStage=error.bridgeStage||stage;
   if(!readOnly||attempt===1||signal.aborted||error.retryable===false)throw error;
   console.warn('NEST school read retry',{action:request.action,operation:request.operation||'read',...bridgeFailure(error)});
   await pause();
  }
 }
}

// Only expose identity from the same authenticated school response as page data.
export function verifiedIdentity(value){
 return value?.signedIn===true&&username(value.username)&&accountEmail(value.email)&&Number.isFinite(value.expires)&&value.expires>Date.now()?{signedIn:true,username:value.username,email:value.email,expires:value.expires}:undefined;
}
