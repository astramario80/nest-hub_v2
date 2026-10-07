(() => {
 const root=document.querySelector('.robotics-workspace');if(!root)return;
 const q=selector=>root.querySelector(selector),status=q('[data-robotics-status]'),content=q('[data-robotics-content]');
 let data=null,busy=false,generation=0,preview=null;
 const element=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function invalidatePreview(){preview=null;q('[data-robotics-preview-content]').replaceChildren();q('[data-robotics-send]').hidden=true;}
 function controls(){root.querySelectorAll('button,select,textarea,input').forEach(el=>el.disabled=busy);root.querySelectorAll('[data-member-status]').forEach(el=>el.disabled=busy||el.dataset.editable!=='true');}
 function clear(){generation++;data=null;busy=false;invalidatePreview();content.hidden=true;q('[data-robotics-members]').replaceChildren();q('[data-robotics-roster]').value='';status.textContent='';}
 async function request(operation,extra={}){
  const response=await fetch('/api/robotics',{method:operation==='view'?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(55000),...(operation==='view'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,...extra})})});
  const result=await response.json();if(!response.ok){const error=new Error(result.error||'Robotics is unavailable.');error.status=response.status;throw error;}return result;
 }
 function renderMembers(){
  const tbody=q('[data-robotics-members]');tbody.replaceChildren();const search=q('[data-robotics-search]').value.toLowerCase().trim();
  data.members.filter(m=>(m.name+' '+m.studentId).toLowerCase().includes(search)).forEach(member=>{
   const row=element('tr');row.append(element('td',member.name));const cell=element('td'),select=element('select');select.dataset.memberStatus='';select.dataset.editable=String(member.canChangeStatus);select.setAttribute('aria-label',member.name+' club status');
   [['unassigned','Not set'],['active','Active'],['inactive','Inactive']].forEach(([value,label])=>{const option=element('option',label);option.value=value;option.disabled=value==='unassigned';select.append(option);});
   select.value=member.active?'active':member.inactive?'inactive':'unassigned';select.disabled=!member.canChangeStatus||busy;
   select.addEventListener('change',()=>run('status',{member:member.id,active:select.value==='active',revision:data.revision}));cell.append(select);row.append(cell,element('td',member.joined?'Joined':'Needs to join'),element('td',!member.joined?'Not applicable':member.waiver===true?'Signed':member.waiver===false?'Needed':'Unknown — import updated roster'),element('td',member.warning||'—'));tbody.append(row);
  });
 }
 function render(result){data=result;content.hidden=false;invalidatePreview();renderMembers();const s=data.summary;
  q('[data-robotics-summary]').textContent=`${s.active} active · ${s.joined} joined FIRST · ${s.waivers} waivers signed · ${s.needJoin} need to join · ${s.needWaiver} need waiver review`;
  q('[data-robotics-imported]').textContent=data.importedAt?'FIRST roster last imported '+new Date(data.importedAt).toLocaleString():'Existing saved FIRST roster. Import date unknown; paste the latest roster before sending reminders.';
  q('[data-robotics-unmatched]').textContent=data.unmatched.length?'FIRST names needing review: '+data.unmatched.join('; '):'';
 }
 async function run(operation,extra={}){
  if(busy)return;busy=true;controls();const own=generation;status.textContent=operation==='view'?'Loading Robotics membership…':operation==='send'?'Sending reminders…':'Saving…';
  try{const result=await request(operation,extra);if(own!==generation)return;
   if(['view','status','refresh','import'].includes(operation)){render(result);if(operation==='import')q('[data-robotics-roster]').value='';status.textContent=operation==='view'?'':'Saved.';}
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
 q('[data-robotics-load]').addEventListener('click',()=>run('view'));
 q('[data-robotics-search]').addEventListener('input',()=>{if(data)renderMembers();});
 q('[data-robotics-refresh]').addEventListener('click',()=>{if(data&&window.confirm('Refresh all club membership records from the Program of Work?'))run('refresh',{revision:data.revision});});
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
