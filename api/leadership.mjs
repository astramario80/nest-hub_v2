import { COOKIE, cookies, validToken, bridge } from '../lib/nest-auth.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const session = cookies(req)[COOKIE];
  if (!validToken(session)) return res.status(401).json({ error: 'Sign in to NEST to view the leadership directory.' });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await bridge({ action: 'auth-leadership-directory', session }, 20000);
      if (data.status === 401) return res.status(401).json({ error: 'Your sign-in has expired. Please sign in again.' });
      if (data.status === 200 && Array.isArray(data.leaders) && data.leaders.every(leader =>
        typeof leader.division === 'string' && typeof leader.position === 'string' &&
        typeof leader.firstName === 'string' && typeof leader.lastName === 'string' &&
        typeof leader.email === 'string' && /^[^\s@,;<>]+@(students\.bethelsd\.org|bethelsd\.org)$/.test(leader.email)
      )) {
        const leaders = data.leaders.map(({ division, position, firstName, lastName, email }) => ({ division, position, firstName, lastName, email }));
        return res.status(200).json({ leaders });
      }
      throw new Error(`Directory status ${data.status || 'invalid'}`);
    } catch (error) {
      console.error('NEST member leadership request failed', { attempt: attempt + 1, kind: error?.name || 'Error', message: error?.message || '' });
    }
  }
  return res.status(503).json({ error: 'Leadership data is temporarily unavailable. Please try again.' });
}
