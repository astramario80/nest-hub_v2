(() => {
  const $=id=>document.getElementById(id),status=$('profile-status');
  const owners=new Set(['astramario@gmail.com','mario@memberhq.net','mpenalver@bethelsd.org']);
  async function api(action,details) {
    const response=await fetch('/api/account',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...details})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Account service unavailable.');
    return data;
  }
  function show() {
    const identity=window.NestAuth?.identity;
    $('profile-signed-in').hidden=!identity;
    $('profile-signed-out').hidden=Boolean(identity);
    status.textContent=identity?'Signed in.':'Sign in to edit your profile, or recover your account below.';
    if(identity){$('profile-identity').textContent=identity.username;$('profile-form').elements.username.value=identity.username;$('profile-admin').hidden=!owners.has(String(identity.email).toLowerCase());api('profile-read',{}).then(data=>{$('profile-identity').textContent=`${data.username} · ${data.manual?'Manually created account':'District account'} · Recovery: ${data.recoveryEmail||'administrator reset only'}`;}).catch(()=>{});}
  }
  async function submit(form,action,details) {
    const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='Please wait…';
    try{return await api(action,details);}catch(error){status.textContent=error.message;return null;}finally{button.disabled=false;}
  }
  $('profile-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form));
    const result=await submit(form,'profile-update',values);
    if(result){form.elements.currentPassword.value='';form.elements.newPassword.value='';await window.NestAuth.refresh();status.textContent='Profile saved. Your other sessions have been signed out.';}
  });
  $('recover-request').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
    const result=await submit(form,'recover-request',Object.fromEntries(new FormData(form)));
    if(result){$('recover-verify').hidden=false;status.textContent=result.message;}
  });
  $('recover-verify').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
    const result=await submit(form,'recover-verify',Object.fromEntries(new FormData(form)));
    if(result){$('recover-verify').hidden=true;$('recover-reset').hidden=false;const select=$('recover-reset').elements.username;select.replaceChildren();(result.usernames||[]).forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);});status.textContent='Code verified. Choose an account and a new password.';}
  });
  $('recover-reset').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
    const result=await submit(form,'recover-reset',Object.fromEntries(new FormData(form)));
    if(result){$('recover-reset').hidden=true;status.textContent=result.message;window.NestAuth?.open('login');}
  });
  $('profile-login').addEventListener('click',()=>window.NestAuth?.open('login'));
  document.addEventListener('nest-auth-change',show);window.NestAuth?.ready.then(show);
})();
