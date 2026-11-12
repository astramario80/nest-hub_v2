(() => {
 const form=document.getElementById('staff-access-form');if(!form)return;
 const owners=new Set(['mario@memberhq.net','mpenalver@bethelsd.org','astramario@gmail.com']);
 const fields=document.getElementById('staff-division-fields'),list=document.getElementById('staff-access-list'),status=document.getElementById('staff-access-status');
 const periods=['1','2','3','4','5','7','CTSO'];let generation=0,loaded=false;
 const allowed=()=>owners.has(String(window.NestAuth?.identity?.email||'').toLowerCase());
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 async function request(action,details={}){const response=await fetch('/api/account',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...details})});const data=await response.json();if(!response.ok)throw Error(data.error||'Staff access is unavailable.');return data;}
 function toggle(){fields.hidden=form.elements.level.value!=='division';fields.disabled=fields.hidden;}
 function edit(staff){form.reset();form.elements.email.value=staff.email;form.elements.level.value=staff.level;periods.forEach(p=>form.elements['division-'+p].value=staff.divisions?.[p]||'');toggle();form.elements.email.focus();status.textContent='Editing '+staff.email+'. Save staff access to apply changes.';}
 async function refresh(){if(!allowed())return;const id=++generation;list.replaceChildren(node('p','Loading staff access…'));
  try{const data=await request('staff-list');if(id!==generation||!allowed())return;loaded=true;list.replaceChildren();
   for(const staff of data.staff||[]){const card=node('article','');card.className='account-entry';card.append(node('h4',staff.email),node('p',staff.registered?'Registered · '+staff.username:'Awaiting account registration'));
    const summary=staff.level==='admin'?'Website admin · all divisions':staff.level==='division'?periods.filter(p=>staff.divisions?.[p]).map(p=>(p==='CTSO'?'Robotics':'Division '+p)+': '+staff.divisions[p]).join(' · '):'Basic · no delegated divisions';card.append(node('p',summary));const button=node('button','Edit access');button.type='button';button.addEventListener('click',()=>edit(staff));card.append(button);list.append(card);}
   if(!list.childElementCount)list.append(node('p','No staff accounts or pending delegations yet. Enter a staff email above to begin.'));
  }catch(error){if(id===generation){loaded=false;list.replaceChildren(node('p',error.message));}}
 }
 form.elements.level.addEventListener('change',toggle);document.getElementById('staff-access-refresh').addEventListener('click',refresh);
 form.addEventListener('submit',async event=>{event.preventDefault();if(!allowed()||!form.reportValidity())return;const email=form.elements.email.value.trim().toLowerCase(),level=form.elements.level.value,divisions={};
  if(!/^[^\s@,;<>]+@bethelsd\.org$/.test(email)||owners.has(email)){status.textContent='Enter a staff @bethelsd.org email. Owner access cannot be changed here.';return;}
  if(level==='division'){periods.forEach(p=>{const role=form.elements['division-'+p].value;if(role)divisions[p]=role;});if(!Object.keys(divisions).length){status.textContent='Choose access for at least one division.';return;}}
  const button=form.querySelector('[type=submit]'),id=generation;button.disabled=true;status.textContent='Saving staff access…';
  try{const data=await request('staff-save',{email,level,divisions});if(id!==generation||!allowed())return;form.reset();toggle();status.textContent=data.message;await refresh();}catch(error){if(id===generation&&allowed())status.textContent=error.message;}finally{button.disabled=false;}
 });
 function show(){if(!allowed()){generation++;loaded=false;list.replaceChildren();form.reset();status.textContent='';toggle();return;}if(!loaded&&!document.getElementById('profile-admin-panel').hidden){loaded=true;refresh();}}
 toggle();document.addEventListener('nest-auth-change',show);document.addEventListener('nest-profile-tab-change',show);window.NestAuth?.ready.then(show);
})();
