const SOURCE = 'https://docs.google.com/spreadsheets/d/1WlFSdQPYNSr6d8ucjFsqL7S0nY9fpia2pRAmcPNKY5A/gviz/tq?tqx=out:csv&sheet=Inventory';

function csvRows(csv) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('Incomplete inventory data');
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

export function parseInventory(csv) {
  const rows = csvRows(csv);
  if (rows[0]?.[0] !== 'Station #' || rows[0]?.[2] !== 'Laptop BSD Serial #') throw new Error('Unexpected inventory format');
  const computers = rows.slice(1).map(row => {
    const listedStation = (row[0] || '').trim();
    const match = /^Station: (.+); BSD Serial Number: (\d+)$/.exec((row[2] || '').trim());
    return match && (!listedStation || match[1] === listedStation) ? { station: match[1], serial: match[2] } : null;
  }).filter(Boolean);
  if (!computers.length) throw new Error('Inventory is empty');
  return computers;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  try {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(10000), headers: { Accept: 'text/csv' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    const computers = parseInventory(await response.text());
    return res.status(200).json({ computers });
  } catch (error) {
    console.error('Computer lookup unavailable', error);
    return res.status(503).json({ error: 'Computer lookup is temporarily unavailable. Try again.' });
  }
}
