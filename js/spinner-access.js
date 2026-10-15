(() => {
  let cleanup = () => {};
  let mounted;
  const byId = id => document.getElementById(id);
  const label = period => period === 'CTSO' ? 'Robotics' : 'Period ' + period;
  function mount() {
    const host = byId('spinner-access');
    if (host === mounted) return;
    cleanup();
    mounted = host;
    if (!host) return;
    let generation = 0, controller, identityKey;
    const clearNames = () => {
      window.resetMagicSpinner?.();
      if (byId('spinner-names')) byId('spinner-names').value = '';
      if (byId('spinner-status')) byId('spinner-status').textContent = 'Paste or import names to begin.';
    };
    host.innerHTML = `<h3>Import division members</h3><p>Load your division, choose another division you can access, or combine them all. Importing replaces the names below; you can edit them before spinning.</p>
      <button type="button" data-login>🔐 NEST Login</button>
      <div data-controls hidden><label for="spinner-division">Members to import</label>
      <select id="spinner-division" data-division aria-label="Members to import"></select>
      <button type="button" data-import>Import names</button></div>
      <p data-message role="status" aria-live="polite"></p><button type="button" data-retry hidden>Try again</button>`;
    const message = host.querySelector('[data-message]'), login = host.querySelector('[data-login]');
    const retry = host.querySelector('[data-retry]');
    const controls = host.querySelector('[data-controls]'), select = host.querySelector('[data-division]'), button = host.querySelector('[data-import]');
    function options(divisions, preferred) {
      select.replaceChildren();
      const add = (value, text) => { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); };
      const mine = divisions.filter(item => item.member);
      if (mine.length) add('mine', mine.length === 1 ? 'My division · ' + label(mine[0].period) : 'My divisions');
      else add('', 'Choose a division…');
      divisions.forEach(item => add(item.period, label(item.period) + ' · ' + item.names.length + ' members'));
      if (divisions.length > 1) add('all', 'All accessible divisions');
      if ([...select.options].some(option => option.value === preferred)) select.value = preferred;
      controls.hidden = !divisions.length;
    }
    function fill(divisions, choice) {
      const chosen = divisions.filter(item => choice === 'all' || choice === 'mine' && item.member || item.period === choice);
      if (!chosen.length) throw new Error('Choose a division you can access.');
      const seen = new Set(), names = [];
      chosen.forEach(item => item.names.forEach(value => {
        const name = value.trim(), key = name.toLocaleLowerCase();
        if (name && !seen.has(key)) { seen.add(key); names.push(name); }
      }));
      window.resetMagicSpinner?.();
      byId('spinner-names').value = names.join('\n');
      message.textContent = names.length + ' names imported from ' + chosen.map(item => label(item.period)).join(', ') + '.';
      byId('spinner-status').textContent = names.length ? 'Ready to spin.' : 'No members found in this division.';
    }
    async function load(choice, auto = false) {
      controller?.abort(); controller = new AbortController();
      const current = ++generation;
      button.disabled = true; select.disabled = true; retry.hidden = true;
      message.textContent = 'Loading your accessible divisions…';
      try {
        const response = await fetch('/api/spinner', {method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'rosters'})});
        const data = await response.json();
        if (current !== generation || !host.isConnected) return;
        if (!response.ok) { const error = new Error(data.error || 'Unable to load division members.'); error.status = response.status; throw error; }
        options(data.divisions, choice);
        if (!data.divisions.length) { message.textContent = 'Your account has no accessible divisions. You can still paste names below.'; return; }
        if (choice) fill(data.divisions, choice);
        else if (auto && data.divisions.some(item => item.member) && !byId('spinner-names').value.trim()) fill(data.divisions, 'mine');
        else message.textContent = 'Choose members to import.';
      } catch (error) {
        if (current === generation && host.isConnected && error.name !== 'AbortError') {
          if ([401,403].includes(error.status)) { clearNames(); controls.hidden = true; }
          message.textContent = error.message; retry.hidden = false;
        }
      } finally { if (current === generation) { button.disabled = false; select.disabled = false; } }
    }
    function identityChanged() {
      const identity = window.NestAuth?.identity, key = identity?.email || '';
      if (identityKey === key) return;
      identityKey = key; generation++; controller?.abort(); clearNames();
      controls.hidden = true; retry.hidden = true; select.replaceChildren(); login.hidden = Boolean(identity);
      if (identity) load(undefined, true);
      else message.textContent = 'Sign in to import your division members, or paste names below.';
    }
    login.addEventListener('click', () => window.NestAuth?.open());
    retry.addEventListener('click', () => load(undefined, true));
    button.addEventListener('click', () => { if (select.value) load(select.value); else message.textContent = 'Choose a division first.'; });
    document.addEventListener('nest-auth-change', identityChanged);
    cleanup = () => { generation++; controller?.abort(); clearNames(); document.removeEventListener('nest-auth-change', identityChanged); };
    identityChanged();
    window.NestAuth?.ready?.then(identityChanged);
  }
  const content = document.querySelector('.sops-content .placeholder');
  if (content) new MutationObserver(mount).observe(content, {childList:true});
  mount();
})();
