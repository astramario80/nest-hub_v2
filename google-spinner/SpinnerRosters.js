// Names stay inside the existing roster permissions; no spreadsheet IDs or emails leave this action.
function spinnerRosters_(token) {
  const previous = NEST_ACCESS_READS;
  NEST_ACCESS_READS = new Map();
  try {
    const session = authSession_(token, PropertiesService.getScriptProperties(), Date.now());
    if (!session) return {status:401};
    const global = globalAccess_(session.email);
    const divisions = [];
    Object.keys(PERIODS).forEach(period => {
      const rows = rows_(period);
      const member = rows.some(row => email_(row[1]) === memberEmail_(session.email, period)) || manualPeriodAccess_(session.email, period);
      if (!global && !member && !manager_(session.email, period) && !editorGrant_(session.email, period)) return;
      const seen = new Set();
      const names = rows.filter(row => {
        const key = email_(row[1]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(row => row[0]);
      divisions.push({period, member, names});
    });
    return {status:200, expires:session.expires, divisions};
  } finally {
    NEST_ACCESS_READS = previous;
  }
}
