import { signalsClasses } from '../lib/signals-classes.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://signals.gknest.org https://nest-classroom-signals.j-m-adventur-9502.chatgpt.site");
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const asset = req.query?.asset || 'access';
  if (!['access', 'index', 'app', 'classes'].includes(asset)) return res.status(404).json({ error: 'Not found.' });
  if (asset === 'classes') {
    try { return res.status(200).json({ classes: await signalsClasses() }); }
    catch (_) { return res.status(503).json({ error: 'Class enrollment could not be loaded. Try Start signals again.' }); }
  }
  if (asset === 'access') return res.status(200).json({ allowed: true });
  res.setHeader('Content-Type', asset === 'app' ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  const source = await readFile(join(process.cwd(), 'lib/signals-player', asset === 'app' ? 'app.txt' : 'index.txt'), 'utf8');
  return res.status(200).send(source);
}
