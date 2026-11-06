(() => {
  const owners=new Set(['mario@memberhq.net','mpenalver@bethelsd.org','astramario@gmail.com']);
  const status=document.getElementById('admin-status'),tools=document.getElementById('admin-tools');
  const create=document.getElementById('admin-create'),period=document.getElementById('admin-period');
  const student=document.getElementById('admin-student'),studentEmail=document.getElementById('admin-student-email');
  const list=document.getElementById('admin-accounts-list');
  let loaded=false,rosterRequest=0,loadRequest=0,accounts=[];
  const search=document.getElementById('admin-account-search'),type=document.getElementById('admin-account-type'),count=document.getElementById('admin-account-count');
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
  function createdTime(value){
    if(!value)return 'Not recorded';
    const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'Not recorded';
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]));
    return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}:${parts.minute}:${parts.second}`;
  }
  function render(){
    const query=search.value.trim().toLocaleLowerCase();
    const filtered=accounts.filter(account=>(!type.value||account.type===type.value)&&[account.name,account.email,account.username,account.recoveryEmail,account.firstName+' '+account.lastName].join(' ').toLocaleLowerCase().includes(query));
    count.textContent=`${filtered.length} of ${accounts.length} active accounts`;list.replaceChildren();
    if(!filtered.length){list.append(el('p',accounts.length?'No accounts match your search.':'No active registered accounts.'));return;}
    for(const account of filtered){
      const card=el('article',undefined,'account-entry'),title=el('h4',account.name?`${account.lastName}, ${account.firstName}`.replace(/^, /,''):`Name unavailable · ${account.username}`);
      card.append(title,el('p',`${account.type==='staff'?'Staff':account.type==='student'?'Student':'Unclassified'} · ${account.email||'No linked email'} · Username: ${account.username}`));
      const metadata=el('dl',undefined,'account-metadata');
      for(const [label,value] of [['Active status',account.active?'Active':'Inactive'],['Session version',account.sessionVersion],['Created at (Pacific)',createdTime(account.createdAt)],['Recovery email',account.recoveryEmail||'None'],['Periods',account.period||'—']])metadata.append(el('dt',label),el('dd',String(value)));
      card.append(metadata);
      const notesForm=el('form',undefined,'account-notes'),label=el('label','Administrator notes'),notes=el('textarea');
      notes.name='notes';notes.rows=3;notes.maxLength=1000;notes.value=account.notes||'';notes.setAttribute('aria-label',`Administrator notes for ${account.name||account.username}`);label.append(notes);
      const saveNote=el('button','Save note');saveNote.type='submit';const noteStatus=el('span','');noteStatus.setAttribute('role','status');notesForm.append(label,saveNote,noteStatus);
      notesForm.addEventListener('submit',async event=>{
        event.preventDefault();saveNote.disabled=true;noteStatus.textContent='Saving…';
        try{await request('admin-notes',{accountKey:account.accountKey,notes:notes.value});account.notes=notes.value;noteStatus.textContent='Saved.';}catch(error){noteStatus.textContent=error.message;}finally{saveNote.disabled=false;}
      });card.append(notesForm);
      const details=el('details',undefined,'account-credential-details');details.append(el('summary','Stored password hash & salt'));
      const credentials=el('dl',undefined,'account-metadata');for(const [label,value] of [['Password Hash',account.passwordHash],['Password Salt',account.passwordSalt]])credentials.append(el('dt',label),el('dd',value||'Not recorded','account-hash'));details.append(credentials);card.append(details);
      if(account.manual){
        const controls=el('details');controls.append(el('summary','Manage manual account access'));
        const form=el('form',undefined,'internal-form');form.append(field('Username','username',account.username),field('New password','password','','password'));
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
        });controls.append(form,remove);card.append(controls);
      }
      list.append(card);
    }
  }
  async function refresh(){
    const id=++loadRequest;list.replaceChildren(el('p','Loading accounts…'));count.textContent='';
    try{
      const data=await request('admin-directory');if(id!==loadRequest)return;
      accounts=data.accounts.sort((a,b)=>(a.lastName||'\uffff').localeCompare(b.lastName||'\uffff')||(a.firstName||'').localeCompare(b.firstName||'')||a.username.localeCompare(b.username));loaded=true;render();
    }catch(error){if(id===loadRequest){accounts=[];loaded=false;list.replaceChildren(el('p',error.message));}}
  }
  search.addEventListener('input',render);type.addEventListener('change',render);
  document.getElementById('admin-account-refresh').addEventListener('click',refresh);
  const unlock=document.getElementById('admin-registration-unlock'),unlockStatus=document.getElementById('admin-registration-status');
  unlock.addEventListener('submit',async event=>{
    event.preventDefault();if(!unlock.reportValidity())return;const button=unlock.querySelector('button');button.disabled=true;unlockStatus.textContent='Resetting signup attempts…';
    try{const result=await request('admin-registration-unlock',{email:unlock.elements.email.value.trim()});unlockStatus.textContent=result.message;}catch(error){unlockStatus.textContent=error.message;}finally{button.disabled=false;}
  });
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
  async function show(){
    const identity=window.NestAuth?.identity,allowed=!!identity&&owners.has(String(identity.email).toLowerCase());
    tools.hidden=!allowed;status.textContent=allowed?'Administrator access confirmed.':'Sign in with a NEST administrator account to manage accounts.';
    if(!allowed){loaded=false;loadRequest++;accounts=[];list.replaceChildren();count.textContent='';create.reset();unlock.reset();unlockStatus.textContent='';return;}
    if(!loaded&&!document.getElementById('profile-admin-panel').hidden){loaded=true;await refresh();}
  }
  document.addEventListener('nest-auth-change',show);document.addEventListener('nest-profile-tab-change',show);window.NestAuth?.ready.then(show);
})();
