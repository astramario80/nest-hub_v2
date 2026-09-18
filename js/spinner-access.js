(() => {
  let generation=0,expires=0,expiryTimer=null;
  const byId=id=>document.getElementById(id);
  function clearNames() {
    window.resetMagicSpinner?.();
    const names=byId('spinner-names');if(names) names.value='';
    expires=0;clearTimeout(expiryTimer);
  }
  function current(panel,version) {return panel.isConnected && generation===version;}
  async function api(action,period,extra={}) {
    const response=await fetch('/api/spinner',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,period,...extra})});
    let data;
    try {data=await response.json();} catch {throw new Error('Email access is temporarily unavailable. Please try again later.');}
    if(!response.ok) throw Object.assign(new Error(data.error||'Please try again.'),{status:response.status});return data;
  }
  function locked(panel,message='Enter your authorized NEST email.') {
    clearNames();panel.querySelector('form').hidden=false;
    panel.querySelector('[data-session]').hidden=true;
    panel.querySelector('[data-message]').textContent=message;
  }
  function loaded(panel,data) {
    clearNames();byId('spinner-names').value=data.names.join('\n');expires=data.expires;
    panel.querySelector('form').hidden=true;panel.querySelector('[data-session]').hidden=false;
    panel.querySelector('[data-message]').textContent=`${data.names.length} names loaded. Access until ${new Date(expires).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}.`;
    byId('spinner-status').textContent=data.names.length?'Ready to spin.':'This period has no names yet.';
    expiryTimer=setTimeout(()=>locked(panel,'Your six-hour access has ended. Verify again to reload this period.'),Math.max(0,expires-Date.now()));
  }
  function mount() {
    const host=byId('spinner-access');if(!host || host.childElementCount)return;
    generation++;clearNames();
    host.innerHTML=`<h3>Load your period’s student list</h3><p>Verify your email for six-hour access. Sign out when you finish on a shared device.</p>
      <div class="spinner-periods" role="group" aria-label="Choose your period">${[1,2,3,4,5,7,'CTSO'].map(p=>`<button type="button" data-period="${p}" aria-pressed="false">${p==='CTSO'?'Robotics':'Period '+p}</button>`).join('')}</div>
      <section class="spinner-login" hidden aria-label="Period access"><h4 data-heading></h4>
      <p data-message role="status" aria-live="polite"></p>
      <form><label for="spinner-email">Your email</label><input id="spinner-email" type="email" autocomplete="email" maxlength="254" required>
      <button type="submit" data-send>Send code</button>
      <div data-code-row hidden><label for="spinner-code">Six-digit code</label><input id="spinner-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6">
      <button type="button" data-verify>Verify & load names</button></div></form>
      <div data-session hidden><button type="button" data-logout>Sign out of NEST</button></div></section>`;
    let period='',busy=false;
    const panel=host.querySelector('.spinner-login'),form=panel.querySelector('form'),message=panel.querySelector('[data-message]');
    function busyState(value) {busy=value;panel.setAttribute('aria-busy',String(value));panel.querySelectorAll('button').forEach(button=>button.disabled=value);host.querySelectorAll('[data-period]').forEach(button=>button.disabled=value);}
    host.addEventListener('click',async event=>{
      const button=event.target.closest('[data-period]');if(!button || busy)return;
      period=button.dataset.period;generation++;const version=generation;
      host.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      clearNames();panel.hidden=false;form.reset();panel.querySelector('[data-code-row]').hidden=true;
      panel.querySelector('[data-heading]').textContent=`Period ${period}`;
      locked(panel,'Checking your access…');busyState(true);
      try {const data=await api('roster',period);if(current(panel,version))loaded(panel,data);}
      catch(error) {if(current(panel,version)){locked(panel,error.status===401?undefined:error.message);byId('spinner-email').focus();}}
      finally {if(current(panel,version))busyState(false);}
    });
    byId('spinner-email').addEventListener('input',()=>{
      byId('spinner-code').value='';
      if(byId('spinner-email').validity.valid)panel.querySelector('[data-code-row]').hidden=false;
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy || !period || !byId('spinner-email').reportValidity())return;
      const version=generation;busyState(true);message.textContent='Requesting your code… Enter it below when it arrives.';
      panel.querySelector('[data-code-row]').hidden=false;byId('spinner-email').disabled=true;byId('spinner-code').focus();
      try {await api('prepare',period);const data=await api('request',period,{email:byId('spinner-email').value});if(current(panel,version)){message.textContent=data.message+' Wait one minute before requesting another code.';}}
      catch(error){if(current(panel,version))message.textContent=error.message;}
      finally{if(current(panel,version)){byId('spinner-email').disabled=false;busyState(false);}}
    });
    panel.querySelector('[data-verify]').addEventListener('click',async()=>{
      const code=byId('spinner-code').value.trim();if(busy || !/^\d{6}$/.test(code)){message.textContent='Enter the six-digit code from your email.';return;}
      const version=generation;busyState(true);message.textContent='Verifying…';
      try {const data=await api('verify',period,{code});if(current(panel,version)){loaded(panel,data);byId('spin-button').focus();}}
      catch(error){if(current(panel,version))message.textContent=error.message;}
      finally{if(current(panel,version))busyState(false);}
    });
    byId('spinner-code').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();panel.querySelector('[data-verify]').click();}});
    panel.querySelector('[data-logout]').addEventListener('click',async()=>{
      const version=generation;busyState(true);clearNames();
      try {await api('logout',period);if(current(panel,version))locked(panel,'Signed out of NEST. Verify your email to continue.');}
      catch(error){if(current(panel,version))message.textContent='Names cleared. Sign-out could not be confirmed; please retry.';}
      finally{if(current(panel,version))busyState(false);}
    });
  }
  function checkExpiry(event) {
    if(expires && Date.now()>=expires) {
      const panel=document.querySelector('.spinner-login');
      if(panel)locked(panel,'Your access has expired. Verify again to continue.');
      if(event?.type==='click'){event.preventDefault();event.stopImmediatePropagation();}
    }
  }
  document.addEventListener('visibilitychange',checkExpiry);
  window.addEventListener('pageshow',checkExpiry);
  document.addEventListener('click',checkExpiry,true);
  const content=document.querySelector('.sops-content .placeholder');
  if(content)new MutationObserver(()=>{if(!byId('spinner-access')){generation++;clearNames();}else mount();}).observe(content,{childList:true});
  mount();
})();
