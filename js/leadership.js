/* NEST™ Leadership Lookup
   - Fetches public CSVs for leaders + required positions
   - Search by Division or Position
   - Pins CTSO exec (CEO/CFO/COO) always on top
   - Division search: shows one hiring sheet link + missing roles (hiring.gif -> leadership-jobs.html)
*/

(() => {
  const LEADERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSY1bNOarIMZn_xl2Qf8xY8zHVJJfgTyNiK0FzNtlYP7Hg0uGqISVnlBAhFw6JZGf6J9KDt3k8frUT9/pub?gid=0&single=true&output=csv';
  const POSITIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSY1bNOarIMZn_xl2Qf8xY8zHVJJfgTyNiK0FzNtlYP7Hg0uGqISVnlBAhFw6JZGf6J9KDt3k8frUT9/pub?gid=1215972243&single=true&output=csv';

  const JOBS_PAGE = 'leadership-jobs.html';
  const HIRING_GIF_SRC = 'assets/hiring.gif';

  const EXEC_TITLES = new Set([
    'chief executive officer',
    'chief financial officer',
    'chief operations officer'
  ]);

  const state = {
    leaders: [], // {division, position, firstName, hiringLink}
    positions: [], // [position]
    ready: false,
  };

  // Elements
  const els = {};

  function q(id){
    return document.getElementById(id);
  }

  function norm(s){
    return (s || '').trim().toLowerCase();
  }

  function escapeHtml(str){
    return (str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  async function fetchText(url){
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.text();
  }

  // Simple CSV parser that handles quoted fields.
  function parseCSV(csvText){
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++){
      const ch = csvText[i];
      const next = csvText[i+1];

      if (inQuotes){
        if (ch === '"' && next === '"'){
          cur += '"';
          i++;
        } else if (ch === '"'){
          inQuotes = false;
        } else {
          cur += ch;
        }
        continue;
      }

      if (ch === '"'){
        inQuotes = true;
      } else if (ch === ','){
        row.push(cur);
        cur = '';
      } else if (ch === '\n'){
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else if (ch === '\r'){
        // ignore
      } else {
        cur += ch;
      }
    }

    if (cur.length || row.length){
      row.push(cur);
      rows.push(row);
    }

    return rows;
  }

  function toLeaders(rows){
    // Expect header: Division, Position, LeaderFirstName, HiringLink
    const header = rows[0].map(norm);
    const idx = {
      division: header.indexOf('division'),
      position: header.indexOf('position'),
      firstName: header.indexOf('leaderfirstname'),
      hiringLink: header.indexOf('hiringlink'),
    };

    return rows.slice(1)
      .filter(r => r && r.length)
      .map(r => ({
        division: (r[idx.division] || '').trim(),
        position: (r[idx.position] || '').trim(),
        firstName: (r[idx.firstName] || '').trim(),
        hiringLink: (r[idx.hiringLink] || '').trim(),
      }))
      .filter(x => x.division || x.position || x.firstName);
  }

  function toPositions(rows){
    // Expect header: Position
    return rows.slice(1)
      .map(r => ((r && r[0]) ? r[0].trim() : ''))
      .filter(Boolean);
  }

  function isExec(position){
    return EXEC_TITLES.has(norm(position));
  }

  function sortExecFirst(a, b){
    const ae = isExec(a.position) ? 0 : 1;
    const be = isExec(b.position) ? 0 : 1;
    if (ae !== be) return ae - be;
    // then by position, then firstName
    const p = a.position.localeCompare(b.position);
    if (p !== 0) return p;
    return a.firstName.localeCompare(b.firstName);
  }

  function renderExecStrip(){
    const exec = state.leaders.filter(l => isExec(l.position));
    const container = els.execList;
    container.innerHTML = '';

    if (!exec.length){
      container.innerHTML = '<div class="exec-empty">(No exec roles found in data)</div>';
      return;
    }

    exec.sort(sortExecFirst);

    exec.forEach(l => {
      const pill = document.createElement('div');
      pill.className = 'exec-pill';
      pill.innerHTML = `
        <div class="exec-role">${escapeHtml(l.position)}</div>
        <div class="exec-name">${escapeHtml(l.firstName || '')}</div>
        <div class="exec-division">${escapeHtml(l.division || '')}</div>
      `;
      container.appendChild(pill);
    });
  }

  function clearResults(){
    els.resultsGrid.innerHTML = '';
    els.missingRoles.style.display = 'none';
    els.missingList.innerHTML = '';
    els.divisionHiringLink.style.display = 'none';
    els.divisionHiringLink.href = '#';
    els.resultsTitle.textContent = 'Select a division or type a position to begin.';
  }

  function getUniqueHiringLinkForDivision(division){
    const rows = state.leaders.filter(l => l.division === division && l.hiringLink);
    if (!rows.length) return '';
    // Often same link repeated; just return first
    return rows[0].hiringLink;
  }

  function getMissingPositionsForDivision(division){
    // Missing positions = positions list minus what exists in leaders for that division.
    // We exclude exec roles from missing list (they're global/pinned).
    const have = new Set(
      state.leaders
        .filter(l => l.division === division)
        .map(l => norm(l.position))
        .filter(p => p && !EXEC_TITLES.has(p))
    );

    return state.positions
      .filter(p => p && !EXEC_TITLES.has(norm(p)))
      .filter(p => !have.has(norm(p)));
  }

  function renderCardRow(l){
    const div = document.createElement('div');
    div.className = 'leader-row';
    div.innerHTML = `
      <div class="leader-pos">${escapeHtml(l.position)}</div>
      <div class="leader-name">${escapeHtml(l.firstName || '')}</div>
      <div class="leader-div">${escapeHtml(l.division)}</div>
    `;
    return div;
  }

  function renderDivisionResults(division){
    clearResults();
    if (!division){
      return;
    }

    const rows = state.leaders
      .filter(l => l.division === division && !isExec(l.position))
      .sort((a, b) => a.position.localeCompare(b.position) || a.firstName.localeCompare(b.firstName));

    els.resultsTitle.textContent = `Leadership — ${division}`;

    // Hiring link once per division
    const hiringLink = getUniqueHiringLinkForDivision(division);
    if (hiringLink){
      els.divisionHiringLink.href = hiringLink;
      els.divisionHiringLink.style.display = 'inline-flex';
    }

    if (!rows.length){
      els.resultsGrid.innerHTML = '<div class="results-empty">No leaders found for this division yet.</div>';
    } else {
      els.resultsGrid.innerHTML = '';
      rows.forEach(l => els.resultsGrid.appendChild(renderCardRow(l)));
    }

    // Missing roles UI
    const missing = getMissingPositionsForDivision(division);
    if (missing.length){
      els.missingRoles.style.display = 'block';
      els.missingList.innerHTML = '';

      missing.forEach(pos => {
        const item = document.createElement('div');
        item.className = 'missing-item';
        item.innerHTML = `
          <div class="missing-pos">${escapeHtml(pos)}</div>
          <a class="missing-apply" href="${JOBS_PAGE}" title="See job purpose + apply">
            <img src="${HIRING_GIF_SRC}" alt="Hiring" class="missing-hiring-img" />
          </a>
        `;
        els.missingList.appendChild(item);
      });
    }
  }

  function renderPositionResults(positionQuery){
    clearResults();
    const q = (positionQuery || '').trim();
    if (!q){
      return;
    }

    // Match if query is contained in position text
    const qn = norm(q);
    const rows = state.leaders
      .filter(l => norm(l.position).includes(qn))
      .sort(sortExecFirst);

    els.resultsTitle.textContent = `Position search: “${q}”`;

    if (!rows.length){
      els.resultsGrid.innerHTML = '<div class="results-empty">No matches found.</div>';
      return;
    }

    els.resultsGrid.innerHTML = '';
    rows.forEach(l => els.resultsGrid.appendChild(renderCardRow(l)));
  }

  function updateMode(){
    const mode = els.mode.value;
    if (mode === 'division'){
      els.divisionWrap.style.display = 'block';
      els.positionWrap.style.display = 'none';
      els.positionInput.value = '';
      renderDivisionResults(els.divisionSelect.value);
    } else {
      els.divisionWrap.style.display = 'none';
      els.positionWrap.style.display = 'block';
      els.divisionSelect.value = '';
      renderPositionResults(els.positionInput.value);
    }
  }

  async function init(){
    // Only run on leadership page
    if (!document.querySelector('.leadership-page')) return;

    els.mode = q('leadership-mode');
    els.divisionSelect = q('leadership-division');
    els.positionInput = q('leadership-position');
    els.clearBtn = q('leadership-clear');
    els.execList = q('exec-list');
    els.resultsGrid = q('results-grid');
    els.resultsTitle = q('results-title');
    els.divisionHiringLink = q('division-hiring-link');
    els.missingRoles = q('missing-roles');
    els.missingList = q('missing-list');
    els.divisionWrap = q('leadership-division-wrap');
    els.positionWrap = q('leadership-position-wrap');

    clearResults();

    try {
      const [leadersCsv, positionsCsv] = await Promise.all([
        fetchText(LEADERS_CSV_URL),
        fetchText(POSITIONS_CSV_URL)
      ]);

      const leaderRows = parseCSV(leadersCsv);
      const posRows = parseCSV(positionsCsv);

      state.leaders = toLeaders(leaderRows);
      state.positions = toPositions(posRows);
      state.ready = true;

      renderExecStrip();

      // Wire events
      els.mode.addEventListener('change', updateMode);
      els.divisionSelect.addEventListener('change', () => renderDivisionResults(els.divisionSelect.value));
      els.positionInput.addEventListener('input', () => renderPositionResults(els.positionInput.value));
      els.clearBtn.addEventListener('click', () => {
        els.divisionSelect.value = '';
        els.positionInput.value = '';
        clearResults();
      });

      // Initial mode render
      updateMode();

    } catch (err){
      els.resultsTitle.textContent = 'Leadership data failed to load.';
      els.resultsGrid.innerHTML = `<div class="results-empty">${escapeHtml(err.message)}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
