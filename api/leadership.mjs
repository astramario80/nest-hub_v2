import { bridge } from '../lib/nest-auth.mjs';

const PUBLIC_DIRECTORY = 'https://docs.google.com/spreadsheets/d/1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I/gviz/tq?tqx=out:csv&sheet=Imported&range=B2:E';

function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function publicLeaders(csv) {
  return csvRows(csv).filter(row => row.length === 4).map(row => {
    const period = String(row[0] || '').replace(/period/ig, '').trim().toUpperCase();
    const name = String(row[3] || '').trim();
    return {
      division: period === 'CTSO' ? 'NEST Robotics' : 'Period ' + period,
      position: String(row[2] || '').trim(),
      firstName: name.includes(',') ? name.split(',').slice(1).join(',').trim() : name.split(/\s+/)[0]
    };
  }).filter(row => row.position && row.firstName && /^Period (?:1|2|3|4|5|7)$|^NEST Robotics$/.test(row.division) && !/^(vacant|open|we.?re hiring|hiring|tbd|n\/a)$/i.test(row.firstName));
}

async function publishedDirectory() {
  const response = await fetch(PUBLIC_DIRECTORY, { signal: AbortSignal.timeout(10000) });
  if (!response.ok || !/text\/csv/i.test(response.headers.get('content-type') || '')) throw new Error('Published directory unavailable');
  const leaders = publicLeaders(await response.text());
  if (!leaders.length) throw new Error('Published directory empty');
  return leaders;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Read the published leadership view first. Only first names and roles leave
  // this endpoint; the private school script remains a fallback.
  try {
    const leaders = await publishedDirectory();
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({ leaders });
  } catch (error) {
    console.error('NEST published leadership request failed', { kind: error?.name || 'Error', message: error?.message || '' });
  }

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
