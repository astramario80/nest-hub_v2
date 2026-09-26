(() => {
  const owners=new Set(['astramario@gmail.com','mario@memberhq.net','mpenalver@bethelsd.org']);
  const status=document.getElementById('admin-status'),tools=document.getElementById('admin-tools');
  function show(){const identity=window.NestAuth?.identity;tools.hidden=!identity||!owners.has(String(identity.email).toLowerCase());status.textContent=tools.hidden?'Sign in with a NEST administrator account to manage accounts.':'Administrator access confirmed.';}
  async function submit(form,action,details){
    const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='Saving account…';
    try{const response=await fetch('/api/account',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...details})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Account service unavailable.');return data;}
    catch(error){status.textContent=error.message;return null;}finally{button.disabled=false;}
  }
  document.getElementById('admin-create').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form));values.periods=[...form.querySelectorAll('[name=periods]:checked')].map(item=>item.value);
    const result=await submit(form,'admin-create',values);
    if(result){status.textContent=`Created ${result.username}. Give the username and password to the student directly.`;form.reset();}
  });
  document.getElementById('admin-reset').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
    const result=await submit(form,'admin-reset',Object.fromEntries(new FormData(form)));
    if(result){status.textContent=result.message;form.reset();}
  });
  document.addEventListener('nest-auth-change',show);window.NestAuth?.ready.then(show);
})();
