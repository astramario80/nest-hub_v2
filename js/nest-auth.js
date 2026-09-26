(() => {
  let identity = null;
  const usernameRule = 'Username must start with a letter and be 3–32 characters. Use letters, numbers, periods, underscores, or hyphens.';
  const usernameIdeas = email => {
    const parts = String(email || '').split('@')[0].toLowerCase().match(/[a-z]{3,}/g) || [];
    const base = parts.join('.'), first = parts[0] || 'nestmember';
    return [...new Set([base || first, first + '1', first + '2'])].filter(name => /^[a-z][a-z0-9._-]{2,31}$/.test(name)).slice(0, 3);
  };
  const changed = () => document.dispatchEvent(new CustomEvent('nest-auth-change', { detail: identity }));
  const api = async (action, extra = {}) => {
    const response = await fetch('/api/auth', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'NEST sign-in is unavailable.');
    return data;
  };
  const dialog = document.createElement('dialog');
  dialog.className = 'nest-auth-dialog';
  dialog.innerHTML = `<div class="nest-auth-card"><button type="button" class="nest-auth-close" aria-label="Close">×</button>
    <div class="nest-auth-brand"><img src="/assets/nest_menu_icon.png" alt="NEST™ logo"><h2>NEST™ Account</h2></div><p data-message role="status" aria-live="polite">Sign in to use your NEST tools.</p>
    <nav class="nest-auth-tabs" aria-label="Account options"><button type="button" data-mode="login">Sign in</button><button type="button" data-mode="register-request">Create account</button></nav>
    <form data-form="login"><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><label>Stay signed in<select name="duration"><option value="session">Until I close the browser (shared computer)</option><option value="1d">1 day</option><option value="7d">7 days</option><option value="30d">30 days</option></select></label><button type="submit">Sign in</button><a href="/profile">Forgot username or password?</a></form>
    <form data-form="register-request" hidden><label>District email or approved administrator email<input name="email" type="email" autocomplete="email" maxlength="254" required></label><button type="submit">Send verification code</button></form>
    <form data-form="register-verify" hidden><label>Six-digit code<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label><button type="submit">Verify email</button></form>
    <form data-form="register" hidden><p data-verified-email></p><label>Choose a username (start with a letter; 3–32 characters)<input name="username" minlength="3" maxlength="32" pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" title="Start with a letter. Use 3–32 letters, numbers, periods, underscores, or hyphens." autocomplete="username" required></label><p data-username-help>Start with a letter. An ID number alone cannot be a username.</p><div data-username-suggestions role="group" aria-label="Username suggestions"><strong>Username ideas</strong><div data-username-options></div><small>Suggestions may already be taken. You can also make your own.</small></div><label>Choose a password (12 or more characters)<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label>Stay signed in<select name="duration"><option value="session">Until I close the browser (shared computer)</option><option value="1d">1 day</option><option value="7d">7 days</option><option value="30d">30 days</option></select></label><button type="submit">Create account</button></form>
    <div data-account hidden><a href="/profile">Your profile</a><button type="button" data-account-close>Continue to NEST</button><button type="button" data-account-logout>Log out</button></div>
  </div>`;
  document.body.append(dialog);
  const message = dialog.querySelector('[data-message]');
  const forms = [...dialog.querySelectorAll('[data-form]')];
  const usernameInput = dialog.querySelector('[data-form="register"] [name="username"]');
  const usernameOptions = dialog.querySelector('[data-username-options]');
  usernameInput.addEventListener('invalid', () => { message.textContent = usernameRule; });
  usernameInput.addEventListener('input', () => {
    if (usernameInput.validity.valid && message.textContent === usernameRule) message.textContent = 'Choose your NEST username and password.';
  });
  function suggestUsernames(email) {
    usernameOptions.replaceChildren();
    usernameIdeas(email).forEach(name => {
      const button = document.createElement('button');button.type = 'button';button.textContent = name;
      button.setAttribute('aria-label', 'Use username ' + name);
      button.addEventListener('click', () => { usernameInput.value = name;usernameInput.dispatchEvent(new Event('input', { bubbles: true }));usernameInput.focus(); });
      usernameOptions.append(button);
    });
  }
  function mode(value) {
    forms.forEach(form => form.hidden = form.dataset.form !== value);
    dialog.querySelector('.nest-auth-tabs').hidden = value === 'account';
    dialog.querySelector('[data-account]').hidden = value !== 'account';
    dialog.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-current', String(button.dataset.mode === value)));
    message.textContent = value === 'account' ? `Signed in as ${identity.username}.` : value === 'login' ? 'Sign in to use your NEST tools.' : value === 'register-request' ? 'Enter your district email or approved administrator email to create an account.' : value === 'register-verify' ? 'Enter the code sent to your email.' : 'Choose your NEST username and password.';
  }
  function open(selected = 'login') { mode(identity?.signedIn ? 'account' : selected); if (!dialog.open) dialog.showModal(); }
  dialog.querySelector('.nest-auth-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-account-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-account-logout]').addEventListener('click', async () => { await logout(); if (!identity) { dialog.close(); } });
  dialog.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => mode(button.dataset.mode)));
  forms.forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const action = form.dataset.form;
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    message.textContent = 'Please wait…';
    try {
      const data = await api(action, values);
      if (action === 'register-request') { mode('register-verify'); message.textContent = data.message; }
      else if (action === 'register-verify') { dialog.querySelector('[data-verified-email]').textContent = `Verified: ${data.email}`; suggestUsernames(data.email); mode('register'); }
      else { identity = data; changed(); refreshLinks(); dialog.close(); form.reset(); }
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  }));
  function refreshLinks() {
    document.querySelectorAll('.dropdown-content').forEach(list => {
      if (!list.closest('.header-dropdown')) return;
      list.querySelectorAll('[data-nest-auth-link]').forEach(item => item.remove());
      if (identity?.signedIn) {
        const account = document.createElement('div');account.dataset.nestAuthLink = '';account.className = 'nest-auth-user-menu';
        const toggle = document.createElement('button');toggle.type = 'button';toggle.className = 'nest-auth-user-toggle';toggle.textContent = identity.username;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-haspopup','true');
        const options = document.createElement('div');options.className = 'nest-auth-user-options';options.hidden = true;
        const profile = document.createElement('a');profile.href = '/profile';profile.textContent = 'Profile';
        const out = document.createElement('button');out.type = 'button';out.textContent = 'Log out';out.addEventListener('click', logout);
        toggle.addEventListener('click', event => {event.stopPropagation();const open = options.hidden;document.querySelectorAll('.nest-auth-user-options').forEach(menu => {menu.hidden = true;menu.previousElementSibling?.setAttribute('aria-expanded','false');});options.hidden = !open;toggle.setAttribute('aria-expanded',String(open));});
        account.append(toggle,options);options.append(profile,out);list.append(account);
      } else {
        const login = document.createElement('button'); login.type = 'button'; login.dataset.nestAuthLink = ''; login.textContent = 'Log in'; login.addEventListener('click', () => open()); list.append(login);
      }
    });
  }
  document.addEventListener('click', event => {
    if (event.target.closest('.nest-auth-user-menu')) return;
    document.querySelectorAll('.nest-auth-user-options').forEach(menu => {menu.hidden = true;menu.previousElementSibling?.setAttribute('aria-expanded','false');});
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.nest-auth-user-options').forEach(menu => {menu.hidden = true;menu.previousElementSibling?.setAttribute('aria-expanded','false');});
  });
  async function logout() {
    try { await api('logout'); } catch (error) { alert(error.message); return; }
    identity = null; refreshLinks(); changed();
  }
  async function refresh() {
    const response = await fetch('/api/auth?action=me', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('NEST sign-in is temporarily unavailable.');
    const data = await response.json();
    identity = data.signedIn ? data : null;
    refreshLinks(); changed();
    return identity;
  }
  const ready = refresh().catch(() => { identity = null; refreshLinks(); changed(); return null; });
  window.NestAuth = { ready, refresh, open, logout, get identity() { return identity; } };
})();
