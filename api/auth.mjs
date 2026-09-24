import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { COOKIE, CHALLENGE, TICKET, durations, token, validToken, districtEmail, username, cookies, setCookie, originAllowed, bridge } from '../lib/nest-auth.mjs';

const errors = { 400: 'Check the information you entered.', 401: 'Your sign-in has expired. Please sign in again.', 403: 'This action is unavailable.', 409: 'That username or district email already has an account.', 429: 'Too many attempts. Please try later.', 503: 'NEST sign-in is temporarily unavailable.' };
const fail = (res, status, message) => res.status(status).json({ error: message || errors[status] });
const passwordValid = value => typeof value === 'string' && value.length >= 12 && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value);
const hashPassword = (password, salt) => pbkdf2Sync(password, Buffer.from(salt, 'hex'), 210000, 32, 'sha256').toString('hex');
const TECH_TICKET_BACKEND = 'https://docs.google.com/spreadsheets/d/169SCXhVH1ufehSUSv_qkbVBJhrdz4MVAjBMOUfDBMGg/edit?gid=1649772389#gid=1649772389';
const NEST_OWNERS = new Set(['astramario@gmail.com', 'mpenalver@bethelsd.org', 'mario@memberhq.net']);
const ipHash = req => createHmac('sha256', process.env.SPINNER_BRIDGE_TOKEN || '').update(String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()).digest('hex');
async function retryableAuthBridge(payload) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await bridge(payload, 12000);
      if (data.status !== 503) return data;
      lastError = new Error('School service unavailable');
    } catch (error) { lastError = error; }
    console.error('NEST auth bridge retry', { action: payload.action, attempt: attempt + 1, kind: lastError?.name || 'Error' });
  }
  throw lastError;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const jar = cookies(req);
  if (req.method === 'GET') {
    const action=req.query?.action;
    if (action !== 'me' && action !== 'tech-ticket') return fail(res, 400);
    const session = validToken(jar[COOKIE]) ? jar[COOKIE] : '';
    if (!session) return action==='me'?res.status(200).json({ signedIn: false }):fail(res,401);
    try {
      const data = await (action==='me'?retryableAuthBridge({ action:'auth-me',session }):bridge({ action:'auth-tech-ticket-access',session },25000));
      if (action==='tech-ticket') {
        if (data.status===200) return res.status(200).json({url:TECH_TICKET_BACKEND});
        if (data.status===401) return fail(res,401);
        const identity=await retryableAuthBridge({action:'auth-me',session});
        if (identity.status===200 && NEST_OWNERS.has(String(identity.email||'').toLowerCase())) return res.status(200).json({url:TECH_TICKET_BACKEND});
        return fail(res,identity.status===401?401:403);
      }
      if (data.status !== 200) return res.status(200).json({ signedIn: false });
      return res.status(200).json({ signedIn: true, username: data.username, email: data.email, expires: data.expires });
    } catch { return fail(res, 503); }
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!originAllowed(req)) return fail(res, 403);
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return fail(res, 400);
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { return fail(res, 400); }
  if (!body || Array.isArray(body) || JSON.stringify(body).length > 2048) return fail(res, 400);
  try {
    if (body.action === 'register-request') {
      const email = districtEmail(body.email);
      if (!email) return fail(res, 400, 'Use your district email address.');
      const challenge = token();
      const data = await bridge({ action: 'auth-register-request', email, challenge, code: String(randomBytes(4).readUInt32BE() % 1000000).padStart(6, '0'), ip: ipHash(req) });
      if (data.status === 429) return fail(res, 429);
      if (data.status !== 200) return fail(res, 503);
      res.setHeader('Set-Cookie', setCookie(CHALLENGE, challenge, 600));
      return res.status(200).json({ message: 'If this district email is in NEST and has no account, a verification code is on its way.' });
    }
    if (body.action === 'register-verify') {
      const challenge = jar[CHALLENGE];
      if (!validToken(challenge) || !/^\d{6}$/.test(body.code || '')) return fail(res, 401, 'The code is invalid or expired.');
      const ticket = token();
      const data = await bridge({ action: 'auth-register-verify', challenge, code: body.code, ticket });
      if (data.status !== 200) return fail(res, data.status === 429 ? 429 : 401, 'The code is invalid or expired.');
      res.setHeader('Set-Cookie', [setCookie(CHALLENGE, '', 0), setCookie(TICKET, ticket, 600)]);
      return res.status(200).json({ email: data.email });
    }
    if (body.action === 'register') {
      const name = username(body.username), ticket = jar[TICKET];
      if (!name || !passwordValid(body.password) || !validToken(ticket) || !Object.hasOwn(durations, body.duration)) return fail(res, 400);
      const salt = randomBytes(16).toString('hex');
      const passwordHash = hashPassword(body.password, salt);
      const data = await bridge({ action: 'auth-register', ticket, username: name, passwordHash, passwordSalt: salt });
      if (data.status !== 200) return fail(res, [400, 401, 409].includes(data.status) ? data.status : 503);
      const session = token();
      const sessionData = await bridge({ action: 'auth-session', email: data.email, session, duration: body.duration });
      if (sessionData.status !== 200) return fail(res, 503);
      res.setHeader('Set-Cookie', [setCookie(TICKET, '', 0), setCookie(COOKIE, session, body.duration === 'session' ? undefined : durations[body.duration])]);
      return res.status(200).json({ signedIn: true, username: name, email: data.email, expires: sessionData.expires });
    }
    if (body.action === 'login') {
      const name = username(body.username);
      if (!name || typeof body.password !== 'string' || body.password.length > 128 || !Object.hasOwn(durations, body.duration)) return fail(res, 400);
      const data = await retryableAuthBridge({ action: 'auth-lookup', username: name, ip: ipHash(req) });
      if (data.status === 429) return fail(res, 429);
      if (data.status === 503) return fail(res, 503);
      if (data.status !== 200 || !/^[a-f0-9]{32}$/.test(data.passwordSalt || '') || !/^[a-f0-9]{64}$/.test(data.passwordHash || '')) return fail(res, 401, 'Incorrect username or password.');
      const actual = Buffer.from(hashPassword(body.password, data.passwordSalt), 'hex');
      if (!timingSafeEqual(actual, Buffer.from(data.passwordHash, 'hex'))) return fail(res, 401, 'Incorrect username or password.');
      const session = token();
      const sessionData = await retryableAuthBridge({ action: 'auth-session', email: data.email, session, duration: body.duration });
      if (sessionData.status !== 200) return fail(res, sessionData.status === 401 ? 401 : 503);
      res.setHeader('Set-Cookie', setCookie(COOKIE, session, body.duration === 'session' ? undefined : durations[body.duration]));
      return res.status(200).json({ signedIn: true, username: name, email: data.email, expires: sessionData.expires });
    }
    if (body.action === 'logout') {
      if (validToken(jar[COOKIE])) await bridge({ action: 'auth-logout', session: jar[COOKIE] }, 25000);
      res.setHeader('Set-Cookie', [setCookie(COOKIE, '', 0), setCookie(CHALLENGE, '', 0), setCookie(TICKET, '', 0)]);
      return res.status(200).json({ signedIn: false });
    }
    return fail(res, 400);
  } catch (error) {
    console.error('NEST auth failed', { action: body.action, kind: error?.name || 'Error' });
    return fail(res, 503);
  }
}
