(() => {
  const owners=new Set(['astramario@gmail.com','mario@memberhq.net','mpenalver@bethelsd.org']);
  const status=document.getElementById('admin-status'),tools=document.getElementById('admin-tools');
  const create=document.getElementById('admin-create'),period=document.getElementById('admin-period');
  const student=document.getElementById('admin-student'),studentEmail=document.getElementById('admin-student-email');
  const list=document.getElementById('admin-accounts-list');
  let loaded=false,rosterRequest=0;
  async function request(action,details={}) {
    const response=await fetch('/api/account',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...details})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Account service unavailable.');
    return data;
  }
  function message(error){status.textContent=error.message||'Account service unavailable.';}
  function random(length){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return Array.from(bytes,value=>alphabet[value%alphabet.length]).join('');}
  function el(tag,text,className){const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item;}
  function field(label,name,value,type='text'){
    const wrapper=el('label',label),input=document.createElement('input');input.name=name;input.type=type;input.value=value;input.autocomplete='off';
    if(name==='username'){input.required=true;input.minLength=3;input.maxLength=32;input.pattern='[A-Za-z][A-Za-z0-9._-]{2,31}';}
    if(name==='password'){input.minLength=12;input.maxLength=128;input.placeholder='Leave blank to keep current password';}
    wrapper.append(input);return wrapper;
  }
  async function refresh(){
    list.replaceChildren(el('p','Loading accounts…'));
    try{
      const data=await request('admin-list');list.replaceChildren();
      if(!data.accounts.length){list.append(el('p','No manually created accounts yet.'));return;}
      for(const account of data.accounts){
        const card=el('div',undefined,'account-entry'),title=el('h3',account.studentName||account.username);
        card.append(title,el('p',[account.period?`Period ${account.period}`:'Legacy account',account.studentEmail||'No linked student',`Username: ${account.username}`,account.recoveryEmail?`Recovery: ${account.recoveryEmail}`:'No recovery email'].join(' · ')));
        const form=el('form',undefined,'internal-form');form.append(field('Username','username',account.username),field('New password','password','','text'));
        const save=el('button','Save changes');save.type='submit';form.append(save);
        form.addEventListener('submit',async event=>{
          event.preventDefault();if(!form.reportValidity())return;
          const values=Object.fromEntries(new FormData(form));
          if(values.username===account.username&&!values.password){status.textContent='Change the username or enter a new password.';return;}
          save.disabled=true;
          try{const result=await request('admin-edit',{currentUsername:account.username,...values});status.textContent=result.message;await refresh();}catch(error){message(error);}finally{save.disabled=false;}
        });
        const remove=el('button','Remove access');remove.type='button';remove.className='account-remove';
        remove.addEventListener('click',async()=>{
          if(!confirm(`Remove ${account.username}'s NEST account access? This signs them out everywhere.`))return;
          remove.disabled=true;
          try{const result=await request('admin-remove',{currentUsername:account.username});status.textContent=result.message;await refresh();}catch(error){message(error);remove.disabled=false;}
        });
        card.append(form,remove);list.append(card);
      }
    }catch(error){list.replaceChildren(el('p',error.message));}
  }
  period.addEventListener('change',async()=>{
    const id=++rosterRequest;student.disabled=true;student.replaceChildren(new Option('Loading students…',''));studentEmail.value='';
    if(!period.value){student.replaceChildren(new Option('Choose a period first',''));return;}
    try{const data=await request('admin-roster',{period:period.value});if(id!==rosterRequest)return;
      student.replaceChildren(new Option('Choose a student',''));
      for(const item of data.students)student.add(new Option(item.name,item.email));
      student.disabled=false;
    }catch(error){if(id===rosterRequest){student.replaceChildren(new Option('Student list unavailable',''));message(error);}}
  });
  student.addEventListener('change',()=>{studentEmail.value=student.value;});
  document.getElementById('admin-generate').addEventListener('click',()=>{
    if(!student.value){status.textContent='Choose a student first.';return;}
    const selected=student.selectedOptions[0].textContent.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'').slice(0,22);
    create.elements.username.value=(selected||'student')+'.'+random(5).toLowerCase();
    create.elements.password.value=random(24);
    status.textContent='Credentials generated. Save the account, then give them to the student directly.';
  });
  create.addEventListener('submit',async event=>{
    event.preventDefault();if(!create.reportValidity())return;
    const button=create.querySelector('[type=submit]');button.disabled=true;status.textContent='Creating account…';
    try{const result=await request('admin-create',Object.fromEntries(new FormData(create)));status.textContent=`Created ${result.username}. Give the username and password to the student directly.`;create.reset();student.disabled=true;student.replaceChildren(new Option('Choose a period first',''));studentEmail.value='';await refresh();}
    catch(error){message(error);}finally{button.disabled=false;}
  });
  async function show(){const identity=window.NestAuth?.identity;const allowed=!!identity&&owners.has(String(identity.email).toLowerCase());tools.hidden=!allowed;status.textContent=allowed?'Administrator access confirmed.':'Sign in with a NEST administrator account to manage accounts.';if(allowed&&!loaded){loaded=true;await refresh();}if(!allowed)loaded=false;}
  document.addEventListener('nest-auth-change',show);window.NestAuth?.ready.then(show);
})();
