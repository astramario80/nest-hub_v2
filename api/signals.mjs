import { sitePage } from '../lib/site-layout.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COOKIE, cookies, setCookie } from '../lib/nest-auth.mjs';
import { signalsAccess } from '../lib/signals-access.mjs';
import {SIGNALS_GRANT_COOKIE,SIGNALS_GRANT_TTL,issueSignalsGrant,validSignalsGrant} from '../lib/signals-grant.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://signals.gknest.org https://nest-classroom-signals.j-m-adventur-9502.chatgpt.site");
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const asset = req.query?.asset || 'access';
  if (!['access', 'index', 'app'].includes(asset)) return res.status(404).json({ error: 'Not found.' });
  const jar = cookies(req), session = jar[COOKIE];
  let status;
  let accessUntil = 0;
  try {
    status = asset !== 'access' && validSignalsGrant(session, jar[SIGNALS_GRANT_COOKIE])
      ? 200 : await signalsAccess(session);
  } catch { status = 503; }
  if (status === 200) {
    // Only a fresh server authorization issues a grant; asset requests never extend it.
    if (asset === 'access' || !validSignalsGrant(session, jar[SIGNALS_GRANT_COOKIE])) {
      const grant = issueSignalsGrant(session);
      if (grant) {
        res.setHeader('Set-Cookie', setCookie(SIGNALS_GRANT_COOKIE, grant, SIGNALS_GRANT_TTL));
        accessUntil = Number(grant.split('.')[0]);
      }
    }
    if (!accessUntil && validSignalsGrant(session, jar[SIGNALS_GRANT_COOKIE])) accessUntil = Number(jar[SIGNALS_GRANT_COOKIE].split('.')[0]);
  } else if (status === 401 || status === 403) {
    res.setHeader('Set-Cookie', setCookie(SIGNALS_GRANT_COOKIE, '', 0));
  }
  if (status !== 200) {
    const message = status === 401 ? 'Sign in to NEST to use Signals.' : status === 403 ? 'Signals is available to district staff and current Assistant Managers, Division Managers, and Chief Executive, Financial, or Operations Officers.' : 'We could not check Signals access. Please try again.';
    if (asset !== 'index') return res.status(status).json({ allowed: false, error: message });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const action = status === 401
      ? '<a style="color:#9cddff" href="https://gknest.org/signals" target="_top">Sign in to NEST™ and continue</a>'
      : status === 403 ? '<a style="color:#9cddff" href="https://gknest.org/signals" target="_top">Check your NEST™ account</a>'
      : '<p>Your sign-in has not been cleared. The school service could not finish checking access.</p>';
    return res.status(status).send(await sitePage(`<h1>NEST™ Signals</h1><p>${message}</p>${action}<p><button style="font:inherit;padding:12px" onclick="location.reload()">Try opening Signals again</button></p>`));
  }
  if (asset === 'access') return res.status(200).json({ allowed: true });
  res.setHeader('Content-Type', asset === 'app' ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  const source = await readFile(join(process.cwd(), 'lib/signals-player', asset === 'app' ? 'app.txt' : 'index.txt'), 'utf8');
  return res.status(200).send(asset === 'app' ? `const NEST_ACCESS_VERIFIED_UNTIL = ${accessUntil};\n${source}` : source);
}
