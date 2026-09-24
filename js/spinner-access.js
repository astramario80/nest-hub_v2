(() => {
  let generation = 0;
  const byId = id => document.getElementById(id);
  const clearNames = () => { window.resetMagicSpinner?.(); const names = byId('spinner-names'); if (names) names.value = ''; };
  async function roster(period) {
    const response = await fetch('/api/spinner', { method:'POST', credentials:'same-origin', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'roster', period }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load this period.');
    return data;
  }
  function mount() {
    const host = byId('spinner-access');
    if (!host || host.childElementCount) return;
    const own = ++generation;
    clearNames();
    host.innerHTML = `<h3>Load your period’s student list</h3><p>Sign in to NEST, then choose a period you can access.</p>
      <button type="button" data-login>🔐 NEST Login</button>
      <div class="spinner-periods" role="group" aria-label="Choose your period">${[1,2,3,4,5,7,'CTSO'].map(p=>`<button type="button" data-period="${p}" aria-pressed="false">${p==='CTSO'?'Robotics':'Period '+p}</button>`).join('')}</div>
      <p data-message role="status" aria-live="polite"></p>`;
    const message = host.querySelector('[data-message]');
    const login = host.querySelector('[data-login]');
    function identityChanged() { if (generation !== own || !host.isConnected) return; clearNames(); login.hidden = Boolean(window.NestAuth?.identity); message.textContent = login.hidden ? 'Choose your period.' : 'Sign in to open a period.'; }
    login.addEventListener('click', () => window.NestAuth?.open());
    host.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', async () => {
      const period = button.dataset.period;
      clearNames();
      host.querySelectorAll('[data-period]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      if (!window.NestAuth?.identity) { window.NestAuth?.open(); message.textContent = 'Sign in first, then choose your period.'; return; }
      message.textContent = 'Loading period ' + period + '…';
      try {
        const data = await roster(period);
        if (generation !== own || !host.isConnected) return;
        byId('spinner-names').value = data.names.join('\n');
        message.textContent = data.names.length + ' names loaded.';
        byId('spinner-status').textContent = data.names.length ? 'Ready to spin.' : 'This period has no names yet.';
      } catch (error) { message.textContent = error.message; }
    }));
    document.addEventListener('nest-auth-change', identityChanged);
    window.NestAuth?.ready.then(identityChanged);
  }
  const content = byId('content');
  if (content) new MutationObserver(() => { if (!byId('spinner-access')) { generation++; clearNames(); } else mount(); }).observe(content, { childList:true });
  mount();
})();
