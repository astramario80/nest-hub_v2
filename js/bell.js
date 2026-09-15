(function () {
  const base = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS48SaNAi_BcEsa09RJINK8kX5Su6eJ6g2YvL4dAMqBBNo_09qilAG1tTBXAgSwFoRY1kCLHwR-VBG1/pub';
  let scheduleDate = '';
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
      else if (c === '\n' && !quoted) { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
    return rows;
  }
  function renderRows(tableId, data, column) {
    const body = document.querySelector(`#${tableId} tbody`);
    body.replaceChildren();
    for (let i = 8; i <= 25; i++) {
      const name = data[i]?.[column], time = data[i]?.[column + 1];
      if (!name || !time) continue;
      const row = document.createElement('tr');
      if (/lunch/i.test(name)) row.classList.add('lunch-row');
      const label = document.createElement('td'); label.className = 'period-name'; label.textContent = name;
      const value = document.createElement('td'); value.className = 'period-time'; value.textContent = time;
      row.dataset.time = time;
      row.append(label, value); body.append(row);
    }
  }
  // School clock is Pacific even when the visitor is in another time zone.
  function schoolClock(now) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', year:'numeric', month:'numeric', day:'numeric',
      hour:'numeric', minute:'numeric', hourCycle:'h23'
    }).formatToParts(now).map(p => [p.type, p.value]));
    return { date:`${Number(parts.month)}/${Number(parts.day)}/${parts.year}`, minute:Number(parts.hour) * 60 + Number(parts.minute) };
  }
  function timeRange(value) {
    const match = value.replace(/[–—]/g, '-').match(/^\s*(\d{1,2}):(\d{2})\s*(am|pm)?\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)?\s*$/i);
    if (!match) return null;
    const minutes = (h, m, suffix) => {
      h = Number(h); m = Number(m);
      if (h < 1 || h > 12 || m > 59) return NaN;
      if (suffix) h = h % 12 + (suffix.toLowerCase() === 'pm' ? 12 : 0);
      else if (h < 6) h += 12; // The published school-day feed uses 1:00 for 1 PM.
      return h * 60 + m;
    };
    const start = minutes(match[1],match[2],match[3]), end = minutes(match[4],match[5],match[6]);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [start,end] : null;
  }
  function highlightCurrentPeriod(now = new Date()) {
    const clock = schoolClock(now);
    document.querySelectorAll('#today-table tbody tr').forEach(row => {
      const range = timeRange(row.dataset.time || '');
      const active = clock.date === scheduleDate && range && clock.minute >= range[0] && clock.minute < range[1];
      row.classList.toggle('is-current', Boolean(active));
      row.querySelector('.now-marker')?.remove();
      row.removeAttribute('aria-current');
      if (active) {
        row.setAttribute('aria-current','time');
        const marker = document.createElement('span'); marker.className = 'now-marker'; marker.textContent = '▸ NOW';
        row.firstElementChild.prepend(marker);
      }
    });
  }
  async function loadBellSchedule() {
    const loading = document.getElementById('bell-loading'); if (!loading) return;
    const todayOnly = Boolean(document.querySelector('[data-bell-today-only]'));
    loading.textContent = "Loading today's schedule…";
    try {
      const [slide, current] = await Promise.all([0,927955961].map(async gid => {
        const response = await fetch(`${base}?gid=${gid}&single=true&output=csv`, { signal:AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error('Schedule unavailable');
        const text = await response.text();
        if (/<html|<!DOCTYPE|#REF!/i.test(text)) throw new Error('Schedule unavailable');
        return parseCSV(text);
      }));
      const color = current[1]?.[2];
      if (/^#([a-f\d]{3}){1,2}$/i.test(color)) document.getElementById('bell-body').style.backgroundColor = color;
      const rawDate = current[1]?.[0]?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      scheduleDate = rawDate ? `${Number(rawDate[1])}/${Number(rawDate[2])}/${rawDate[3]}` : '';
      document.getElementById('today-title').textContent = slide[7]?.[0] || 'No School Today';
      renderRows('today-table',slide,0);
      highlightCurrentPeriod();
      if (!todayOnly) {
        const upcomingTitle = slide[7]?.[3];
        document.querySelector('.upcoming-card').hidden = !upcomingTitle;
        if (upcomingTitle) {
          document.getElementById('upcoming-title').textContent = upcomingTitle;
          renderRows('upcoming-table',slide,3);
          const upcomingColor = current[2]?.[2];
          if (/^#([a-f\d]{3}){1,2}$/i.test(upcomingColor)) {
            const panel = document.querySelector('.upcoming-card');
            panel.style.setProperty('--upcoming-color',upcomingColor);
            const hex = upcomingColor.slice(1); const full = hex.length === 3 ? [...hex].map(c=>c+c).join('') : hex;
            const channels = [0,2,4].map(i => parseInt(full.slice(i,i+2),16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
            panel.style.color = channels[0]*.2126+channels[1]*.7152+channels[2]*.0722 > .179 ? '#15191d' : '#fff';
          }
        }
        const upcoming = current.slice(2,6).filter(row=>row[0]&&row[1]).map(row=>`${row[0]} – ${row[1]}`);
        document.getElementById('ticker-text').textContent = upcoming.length ? `Upcoming: ${upcoming.join('  ❧  ')}` : 'No upcoming schedules published.';
      }
      loading.hidden = true; document.getElementById('bell-content').style.display = 'block';
    } catch (error) {
      loading.hidden = false;
      loading.textContent = "Today's live schedule is temporarily unavailable. Please try again shortly.";
      document.getElementById('bell-content').style.display = 'none';
      console.warn('Unable to refresh bell schedule');
    }
  }
  document.addEventListener('DOMContentLoaded',loadBellSchedule);
  setInterval(highlightCurrentPeriod,15000);
  setInterval(loadBellSchedule,300000);
  document.addEventListener('visibilitychange',()=>{ if (!document.hidden) loadBellSchedule(); });
})();
