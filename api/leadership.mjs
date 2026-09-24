import { bridge } from '../lib/nest-auth.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // This directory contains only the same first names and roles shown publicly
  // on the page. Cache successful reads so a brief Google outage does not block it.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await bridge({ action: 'leadership' }, 20000);
      if (data.status !== 200 || !Array.isArray(data.leaders) || !data.leaders.length) {
        throw new Error(`Directory status ${data.status || 'invalid'}`);
      }
      const leaders = data.leaders.map(({ division, position, firstName }) => ({ division, position, firstName }));
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
      return res.status(200).json({ leaders });
    } catch (error) {
      console.error('NEST leadership request failed', { attempt: attempt + 1, kind: error?.name || 'Error', message: error?.message || '' });
    }
  }
  return res.status(503).json({ error: 'Leadership data is temporarily unavailable. Please try again.' });
}
