(() => {
 const root=document.querySelector('.robotics-workspace');if(!root)return;
 const q=selector=>root.querySelector(selector),status=q('[data-robotics-status]'),content=q('[data-robotics-content]');
 let data=null,busy=false,generation=0,preview=null,profile=null,selection=null;
 const element=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function invalidatePreview(){preview=null;q('[data-robotics-preview-content]').replaceChildren();q('[data-robotics-send]').hidden=true;}
 function controls(){root.querySelectorAll('button,select,textarea,input').forEach(el=>el.disabled=busy||(el.hasAttribute('data-manager-only')&&data?.manager===false));root.querySelectorAll('[data-member-status]').forEach(el=>el.disabled=busy||el.dataset.editable!=='true');}
 function clear(){generation++;data=null;busy=false;invalidatePreview();content.hidden=true;q('[data-robotics-members]').replaceChildren();q('[data-robotics-roster]').value='';['profile','inactive','requests','protocols','self'].forEach(key=>q('[data-robotics-'+key+']')?.replaceChildren());profile=null;selection=null;status.textContent='';}
 async function request(operation,extra={}){
  const response=await fetch('/api/robotics',{method:operation==='view'?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(55000),...(operation==='view'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,...extra})})});
  const result=await response.json();if(!response.ok){const error=new Error(result.error||'Robotics is unavailable.');error.status=response.status;throw error;}return result;
 }
 function renderMembers(){
  const tbody=q('[data-robotics-members]'),inactive=q('[data-robotics-inactive]');tbody.replaceChildren();inactive?.replaceChildren();if(q('[data-robotics-inactive-count]'))q('[data-robotics-inactive-count]').textContent='('+data.members.filter(m=>m.inactive).length+')';const search=q('[data-robotics-search]').value.toLowerCase().trim();
  data.members.filter(m=>(m.name+' '+m.studentId).toLowerCase().includes(search)).forEach(member=>{
   const row=element('tr');const nameCell=element('td'),open=element('button',member.name);open.type='button';open.addEventListener('click',()=>run('profile',{member:member.id}));nameCell.append(open);row.append(nameCell);const cell=element('td'),select=element('select');select.dataset.memberStatus='';select.dataset.editable=String(member.canChangeStatus);select.setAttribute('aria-label',member.name+' club status');
   [['unassigned','Not set'],['active','Active'],['inactive','Inactive']].forEach(([value,label])=>{const option=element('option',label);option.value=value;option.disabled=value==='unassigned';select.append(option);});
   select.value=member.active?'active':member.inactive?'inactive':'unassigned';select.disabled=!member.canChangeStatus||busy;
   select.addEventListener('change',()=>run('status',{member:member.id,active:select.value==='active',revision:data.revision}));cell.append(select);row.append(cell,element('td',member.joined?'Joined':'Needs to join'),element('td',!member.joined?'Not applicable':member.waiver===true?'Signed':member.waiver===false?'Needed':'Unknown — import updated roster'),element('td',member.warning||'—'));(member.inactive&&inactive?inactive:tbody).append(row);
  });
 }
 function render(result){data=result;content.hidden=false;invalidatePreview();renderOnboarding();if(data.manager===false){q('[data-robotics-members]').replaceChildren();q('[data-robotics-inactive]')?.replaceChildren();return;}renderMembers();const s=data.summary;
  q('[data-robotics-summary]').textContent=`${s.active} active · ${s.joined} joined FIRST · ${s.waivers} waivers signed · ${s.needJoin} need to join · ${s.needWaiver} need waiver review`;
  q('[data-robotics-imported]').textContent=data.importedAt?'FIRST roster last imported '+new Date(data.importedAt).toLocaleString():'Existing saved FIRST roster. Import date unknown; paste the latest roster before sending reminders.';
  q('[data-robotics-unmatched]').textContent=data.unmatched.length?'FIRST names needing review: '+data.unmatched.join('; '):'';
 }
 async function run(operation,extra={}){
  if(busy)return;busy=true;controls();const own=generation;status.textContent=operation==='view'?'Loading Robotics membership…':operation==='send'?'Sending reminders…':'Saving…';
  try{let result=await request(operation,extra);if(['status','refresh','import','activate-request','protocol-save'].includes(operation))result=await request('view');if(own!==generation)return;
   if(['view','status','refresh','import','activate-request','protocol-save'].includes(operation)){render(result);if(operation==='import')q('[data-robotics-roster]').value='';status.textContent=operation==='view'?'':'Saved.';}
   if(['profile','profile-save','checklist'].includes(operation)){selection=operation==='profile'?extra:selection;renderProfile(result.profile);status.textContent=operation==='profile'?'':'Saved.';}
   if(operation==='preview'){
    preview=result;const panel=q('[data-robotics-preview-content]');panel.replaceChildren();panel.append(element('p',result.recipients.length+' emails ready for review.'));
    const list=element('ul');result.recipients.forEach(m=>list.append(element('li',m.name+' — '+m.email+' ('+m.kind+')')));panel.append(list);
    if(result.skipped.length)panel.append(element('p','Skipped for identity review: '+result.skipped.join('; ')));
    result.messages.forEach(message=>{panel.append(element('h3',message.subject),element('pre',message.body));});q('[data-robotics-send]').hidden=!result.recipients.length;status.textContent='Review recipients and messages below.';
   }
   if(operation==='send'){q('[data-robotics-send]').hidden=true;status.textContent=result.delivery==='unknown'?'Delivery status is uncertain. Check sent mail before creating another preview.':`${result.sent} sent; ${result.failed} failed. No automatic resend.`;preview=null;}
  }catch(error){if(own!==generation)return;
   if([401,403].includes(error.status)){clear();status.textContent=error.message;return;}
   status.textContent=error.message;
   if(operation==='send'){q('[data-robotics-send]').hidden=false;status.textContent+=' Use the same send button to check this batch; it will not resend a claimed batch.';}
   if(operation==='status'&&data)renderMembers();
  }finally{if(own===generation){busy=false;controls();}}
 }

 function renderOnboarding(){
  const manager=q('[data-robotics-manager]');if(manager)manager.hidden=data.manager===false;
  const setup=q('[data-robotics-setup]');if(setup)setup.textContent=data.ready===false?'Signup processing is waiting for the school owner to run onboarding setup.':'';
  const self=q('[data-robotics-self]');if(self){self.replaceChildren();if(data.ownMember){const b=element('button','My Profile');b.type='button';b.addEventListener('click',()=>run('profile',{member:data.ownMember.id}));self.append(b);}}
  const requests=q('[data-robotics-requests]');if(requests){requests.replaceChildren();(data.requests||[]).forEach(r=>{const box=element('div'),b=element('button',r.name);b.type='button';b.addEventListener('click',()=>run('profile',{request:r.id}));box.append(b,element('p',`${!r.memberId?(r.notification==='Historical import'?'Historical signup awaiting activation · ':'New signup awaiting activation · '):'Onboarding · '}${r.progress}/${r.total} steps · ${r.notification} · ${new Date(r.submitted).toLocaleDateString()}`));requests.append(box);});if(!data.requests?.length)requests.append(element('p','No membership submissions to review.'));}
  const steps=q('[data-robotics-protocols]');if(steps){steps.replaceChildren();(data.protocols||[]).forEach(addProtocol);}
 }
 function addProtocol(p={id:null,label:'',url:'',detail:'',active:true}){
  const row=element('fieldset');row.dataset.stepId=p.id||'';row.append(element('legend','Onboarding step'));
  [['label','Step','text'],['url','Help link','url'],['detail','Details','text']].forEach(([key,title,type])=>{const label=element('label',title+' '),input=element('input');input.type=type;input.value=p[key];input.dataset.protocolField=key;label.append(input);row.append(label);});
  const label=element('label','Include in checklists '),input=element('input');input.type='checkbox';input.checked=p.active;input.dataset.protocolField='active';label.append(input);row.append(label);q('[data-robotics-protocols]').append(row);
 }
 function renderProfile(value){
  profile=value;const panel=q('[data-robotics-profile]');panel.hidden=false;panel.replaceChildren();panel.append(element('h3',value.name));
  const close=element('button','Close profile');close.type='button';close.addEventListener('click',()=>{panel.replaceChildren();panel.hidden=true;profile=null;selection=null;});panel.append(close);
  const fields=element('div');(value.fields||[]).forEach(f=>{const label=element('label',f.label+' ');if(f.editable){const input=element('input');input.type=/email/i.test(f.label)?'email':'text';input.value=String(f.value||'');input.dataset.profileField=f.id;label.append(input);}else{const text=Array.isArray(f.value)?f.value.join(', '):String(f.value??'');label.append(element('span',text));}fields.append(label);});panel.append(fields);
  const save=element('button','Save contact information');save.type='button';save.addEventListener('click',()=>{const changes={};panel.querySelectorAll('[data-profile-field]').forEach(input=>changes[input.dataset.profileField]=input.value);run('profile-save',{...selection,revision:profile.revision,fields:changes});});panel.append(save);
  if(data.manager!==false){
   const req=(data.requests||[]).find(r=>r.id===selection?.request);
   if(req&&!req.memberId){const choose=element('select');choose.setAttribute('aria-label','Verified member identity');choose.append(element('option','Choose the matching member'));
    const candidates=[...(data.members||[]).filter(m=>m.identityVerified&&m.canChangeStatus),...(req.candidate?[req.candidate]:[])];candidates.forEach(m=>{const o=element('option',m.name);o.value=m.id;choose.append(o);});choose.options[0].value='';panel.append(choose);
    const activate=element('button','Activate this member');activate.type='button';activate.addEventListener('click',()=>{if(choose.value)run('activate-request',{request:req.id,member:choose.value,memberRevision:data.revision,revision:profile.revision});});panel.append(activate);
   }
  }
  panel.append(element('h4','Onboarding checklist'));(value.protocols||[]).forEach(p=>{const label=element('label'),check=element('input');check.type='checkbox';check.checked=!!value.checks?.[p.id]?.done;check.disabled=data.manager===false;check.dataset.managerOnly='';check.addEventListener('change',()=>run('checklist',{...selection,revision:profile.revision,step:p.id,done:check.checked}));label.append(check,document.createTextNode(' '+p.label+' '));if(p.url){const a=element('a','Instructions');a.href=p.url;a.target='_blank';a.rel='noopener noreferrer';label.append(a);}panel.append(label);if(p.detail)panel.append(element('p',p.detail));});
 }
 q('[data-robotics-add-step]')?.addEventListener('click',()=>addProtocol());
 q('[data-robotics-save-steps]')?.addEventListener('click',()=>{const protocols=[...q('[data-robotics-protocols]').children].map(row=>{const p={id:row.dataset.stepId||null};row.querySelectorAll('[data-protocol-field]').forEach(input=>p[input.dataset.protocolField]=input.type==='checkbox'?input.checked:input.value);return p;});run('protocol-save',{protocols,revision:data.protocolRevision});});
 q('[data-robotics-load]').addEventListener('click',()=>run('view'));
 q('[data-robotics-search]').addEventListener('input',()=>{if(data)renderMembers();});
 q('[data-robotics-import]').addEventListener('click',()=>{if(data&&q('[data-robotics-roster]').value.trim())run('import',{revision:data.revision,text:q('[data-robotics-roster]').value});});
 q('[data-robotics-preview]').addEventListener('click',()=>{invalidatePreview();run('preview',{kind:q('[data-robotics-kind]').value});});
 q('[data-robotics-kind]').addEventListener('change',invalidatePreview);
 q('[data-robotics-send]').addEventListener('click',()=>{if(preview&&window.confirm('Send '+preview.recipients.length+' reminder emails to the reviewed recipients?'))run('send',{ticket:preview.ticket});});
 document.addEventListener('nest-hq-access-revoked',clear);
 document.addEventListener('nest-auth-change',clear);
 document.addEventListener('nest-hq-tab-change',event=>{
  if(event.detail.tab==='robotics'&&window.NestDivisionHQ?.allowed){if(!data)run('view');}
  else if(document.querySelector('[data-hq-tab="robotics"]')?.hidden)clear();
 });
 window.addEventListener('pagehide',clear);
 if(window.NestDivisionHQ?.allowed&&window.NestDivisionHQ.active==='robotics')run('view');
})();
