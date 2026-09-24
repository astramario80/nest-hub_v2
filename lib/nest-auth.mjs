import { randomBytes } from 'node:crypto';

export const COOKIE = '__Host-nest-auth';
export const CHALLENGE = '__Host-nest-register-challenge';
export const TICKET = '__Host-nest-register-ticket';
export const durations = Object.freeze({ session: 12 * 3600, '1d': 86400, '7d': 604800, '30d': 2592000 });
export const token = () => randomBytes(32).toString('hex');
export const validToken = value => /^[a-f0-9]{64}$/.test(value || '');
export const districtEmail = value => {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@,;<>]+@(students\.bethelsd\.org|bethelsd\.org)$/.test(email) ? email : '';
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
export async function bridge(request, timeout = 45000) {
  const endpoint = process.env.SPINNER_BRIDGE_URL;
  const bridgeToken = process.env.SPINNER_BRIDGE_TOKEN;
  if (!endpoint || !bridgeToken) throw new Error('Bridge not configured');
  const signal = AbortSignal.timeout(timeout);
  let response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, token: bridgeToken }), redirect: 'manual', signal
  });
  if ([301, 302, 303].includes(response.status)) {
    const target = new URL(response.headers.get('location'));
    if (target.protocol !== 'https:' || target.hostname !== 'script.googleusercontent.com') throw new Error('Unexpected Google response host');
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(target, { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
        if (response.ok || ![404, 429, 500, 502, 503, 504].includes(response.status)) break;
      } catch (error) { if (attempt === 1 || signal.aborted) throw error; }
    }
  }
  if (!response.ok) throw new Error('Google bridge unavailable');
  return response.json();
}
