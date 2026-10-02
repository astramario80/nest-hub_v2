// Only aggregate class eligibility leaves this fixed, private database range.
function signalsClasses_() {
  const rows = Sheets.Spreadsheets.Values.get(NEST_DATABASE, "'Schedule'!A9:C").values || [];
  const classes = {};
  rows.forEach(function(row) {
    const label = String(row[0] || '').trim().toUpperCase();
    const match = /^PERIOD\s+([0-7])$/.exec(label);
    const key = label === 'CTSO' ? 'CTSO' : match ? match[1] : '';
    if (!key) return;
    const raw = row[2];
    if (raw === '' || raw === null || raw === undefined || !Number.isInteger(Number(raw)) || Number(raw) < 0) throw new Error('Invalid class count');
    classes[key] = Boolean(classes[key] || Number(raw) > 0);
  });
  if (!Object.keys(classes).length) throw new Error('Class counts unavailable');
  return {status:200,classes:classes};
}
