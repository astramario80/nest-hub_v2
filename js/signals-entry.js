(() => {
  const status = document.querySelector('#signals-status');
  const login = document.querySelector('#signals-login');
  const retry = document.querySelector('#signals-retry');
  let ready = false, generation = 0, expired = false;
  const destination = new URL('/api/signals?asset=index', location.origin);
  const query = new URLSearchParams(location.search);
  for (const key of ['code', 'state', 'error']) if (query.has(key)) destination.searchParams.set(key, query.get(key));

  async function check() {
    if (!ready) return;
    const current = ++generation;
    const identity = window.NestAuth.identity;
    login.hidden = true; retry.hidden = true; expired = false;
    if (!identity?.signedIn) {
      status.textContent = 'Sign in with your NEST school account. Signals will open automatically after sign-in.';
      login.textContent = 'Sign in to NEST'; login.hidden = false;
      return;
    }
    status.textContent = `Signed in as ${identity.email || identity.username}. Checking Signals access…`;
    try {
      const response = await fetch('/api/signals?asset=access', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(55000) });
      if (current !== generation) return;
      const data = await response.json();
      if (current !== generation) return;
      if (response.ok && data.allowed === true) {
        status.textContent = 'Access confirmed. Opening Signals…';
        location.replace(destination.href);
        return;
      }
      expired = response.status === 401;
      status.textContent = expired ? 'Your NEST sign-in has expired. Sign in again to continue.' : response.status === 403
        ? 'You are signed in, but this account does not currently have Signals access. Use your school account with an approved leadership role or staff email.'
        : 'NEST could not check Signals access right now. Please try again.';
      login.textContent = expired ? 'Sign in again' : 'Switch NEST account';
      login.hidden = ![401, 403].includes(response.status); retry.hidden = false;
    } catch (_) {
      if (current !== generation) return;
      status.textContent = 'NEST could not check Signals access right now. Please try again.'; retry.hidden = false;
    }
  }
  login.addEventListener('click', async () => {
    if (window.NestAuth.identity?.signedIn) {
      await window.NestAuth.logout();
      if (window.NestAuth.identity?.signedIn) return;
    }
    window.NestAuth.open();
  });
  retry.addEventListener('click', check);
  document.addEventListener('nest-auth-change', check);
  window.addEventListener('focus', async () => {
    if (!ready) return;
    try { await window.NestAuth.refresh(); } catch (_) { status.textContent = 'NEST sign-in could not be checked. Please try again.'; retry.hidden = false; }
  });
  window.NestAuth.ready.then(async () => {
    ready = true;
    await check();
    if (!window.NestAuth.identity?.signedIn) window.NestAuth.open();
  });
})();
