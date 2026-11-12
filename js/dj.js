(() => {
 const page = document.querySelector('[data-dj-page]');
 if (!page) return;
 const guide = page.querySelector('.dj-guide');
 if (guide) {
  const tabs = [...guide.querySelectorAll('[data-guide-tab]')];
  const panels = [...guide.querySelectorAll('[data-guide-panel]')];
  const nav = guide.querySelector('.dj-guide-nav'), footer = guide.querySelector('.dj-guide-footer');
  const previous = guide.querySelector('[data-guide-previous]'), next = guide.querySelector('[data-guide-next]');
  const titles = ['Get connected','Add your songs','Check your mix'];
  let active = 0;
  function select(index, focus = false) {
   active = Math.max(0, Math.min(tabs.length - 1, index));
   tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === active)); tab.tabIndex = i === active ? 0 : -1; });
   panels.forEach((panel, i) => { panel.hidden = i !== active; });
   previous.disabled = active === 0; next.disabled = active === tabs.length - 1;
   next.textContent = active === tabs.length - 1 ? 'You’re ready ✓' : titles[active + 1] + ' →';
   guide.querySelector('[data-guide-progress]').textContent = 'Chapter ' + (active + 1) + ' of 3 · ' + titles[active];
   if (focus) tabs[active].focus();
  }
  nav.hidden = false; footer.hidden = false; nav.setAttribute('role','tablist');
  tabs.forEach((tab, index) => {
   tab.id = 'dj-guide-tab-' + index; tab.setAttribute('role','tab'); tab.setAttribute('aria-controls','dj-guide-panel-' + index);
   panels[index].id = 'dj-guide-panel-' + index; panels[index].setAttribute('role','tabpanel'); panels[index].setAttribute('aria-labelledby',tab.id); panels[index].tabIndex = 0;
   tab.addEventListener('click', () => select(index));
   tab.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    select(event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (active + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length, true);
   });
  });
  previous.addEventListener('click', () => select(active - 1, true)); next.addEventListener('click', () => select(active + 1, true));
  guide.classList.add('is-enhanced'); select(0);
 }
 const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 if ('IntersectionObserver' in window && !reducedMotion) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
   if (entry.isIntersecting) { entry.target.classList.remove('is-waiting'); observer.unobserve(entry.target); }
  }), {threshold:0.08});
  page.querySelectorAll('.dj-reveal').forEach(section => { section.classList.add('is-waiting'); observer.observe(section); });
 }
 page.querySelector('[data-sign-in]')?.addEventListener('click', () => window.NestAuth?.open());
 page.querySelector('[data-retry]')?.addEventListener('click', () => location.reload());
 page.querySelector('[data-invite-form]')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget, button = form.querySelector('button'), status = form.querySelector('[data-invite-status]');
  button.disabled = true; status.textContent = 'Saving invitation…';
  try {
   const response = await fetch(location.pathname + location.search, {method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:form.elements.invitation.value.trim()}),signal:AbortSignal.timeout(55000)});
   const result = await response.json().catch(() => ({}));
   if (!response.ok || !result.saved) throw new Error(result.error || 'The invitation could not be saved. Check your sign-in and try again.');
   location.reload();
  } catch (error) { status.textContent = error.message; button.disabled = false; }
 });
 let initialized = false;
 window.NestAuth?.ready.then(() => {
  initialized = true;
  if (page.dataset.authorized !== 'true' && window.NestAuth.identity?.signedIn && page.querySelector('[data-sign-in]')) location.reload();
 });
 document.addEventListener('nest-auth-change', () => {
  if (initialized) {
   page.replaceChildren();
   location.reload();
  }
 });
 window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
 window.addEventListener('pagehide', () => page.replaceChildren());
})();
