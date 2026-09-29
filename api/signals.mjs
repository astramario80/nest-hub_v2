import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COOKIE, cookies } from '../lib/nest-auth.mjs';
import { signalsAccess } from '../lib/signals-access.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://signals.gknest.org https://nest-classroom-signals.j-m-adventur-9502.chatgpt.site");
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const asset = req.query?.asset || 'access';
  if (!['access', 'index', 'app'].includes(asset)) return res.status(404).json({ error: 'Not found.' });
  let status;
  try { status = await signalsAccess(cookies(req)[COOKIE]); } catch { status = 503; }
  if (status !== 200) {
    const message = status === 401 ? 'Sign in to NEST to use Signals.' : status === 403 ? 'Signals is available to district staff and current Assistant Managers, Division Managers, and Chief Executive, Financial, or Operations Officers.' : 'We could not check Signals access. Please try again.';
    if (asset !== 'index') return res.status(status).json({ allowed: false, error: message });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(status).send(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NEST Signals access</title><body style="font:18px system-ui;max-width:650px;margin:10vh auto;padding:24px;background:#102d47;color:white"><h1>NEST™ Signals</h1><p>${message}</p><p><a style="color:#9cddff" href="https://gknest.org/signals" target="_top">Sign in to NEST™ and continue</a></p><p>Use your existing NEST sign-in or sign in with your school account to continue automatically.</p><button style="font:inherit;padding:12px" onclick="location.reload()">Check access again</button></body></html>`);
  }
  if (asset === 'access') return res.status(200).json({ allowed: true });
  res.setHeader('Content-Type', asset === 'app' ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  return res.status(200).send(await readFile(join(process.cwd(), 'lib/signals-player', asset === 'app' ? 'app.txt' : 'index.txt'), 'utf8'));
}
