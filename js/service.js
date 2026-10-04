(() => {
 const $=id=>document.getElementById(id),node=(tag,text,className)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(className)n.className=className;return n;};
 let workspaceLoadedAt=0,clientLoadedAt=0;const workspaceTTL=120000;
 let view='client',activeTool='tickets',metricRows=[],flipped=false,tickets=[],managers=[],selected=null,dirty=false,busy=false,managerEpoch=0,clientEpoch=0,googleReady=null,clientSignedIn=false;
 const api=async(operation,body)=>{
  const response=await fetch('/api/service-requests'+(body?'':'?operation='+encodeURIComponent(operation)),body?{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,...body})}:{credentials:'same-origin',cache:'no-store'});
  const data=await response.json();if(!response.ok){const error=new Error(data.error||'Service requests are unavailable.');error.status=response.status;throw error;}return data;
 };
 const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString():String(value||'');};
 const allowDiscard=()=>!dirty||window.confirm('Discard your unsaved service request update?');
 function clearDetail(){selected=null;dirty=false;$('service-detail').hidden=true;$('service-note').value='';$('service-public-note').value='';$('service-legacy-history').textContent='';$('service-access-status').textContent='';['service-detail-title','service-detail-fields','service-public-history','service-internal-history','service-save-status'].forEach(id=>$(id).replaceChildren());$('service-manager').replaceChildren();$('service-email').disabled=true;}
 function clearManager(){workspaceLoadedAt=0;metricRows=[];metricOptions();managerEpoch++;tickets=[];managers=[];clearDetail();$('service-workspace').hidden=true;['service-ticket-list','service-metrics','service-reviews','service-metric-summary','service-metric-status','metric-calendar-status'].forEach(id=>$(id).replaceChildren());}
 function clearClient(){clientLoadedAt=0;clientEpoch++;clientSignedIn=false;$('client-requests').replaceChildren();$('client-logout').hidden=true;$('client-status').textContent='';}
 function history(container,updates){container.replaceChildren();if(!updates.length){container.append(node('p','No client updates yet.'));return;}updates.slice().reverse().forEach(e=>{const item=node('div',null,'service-update');item.append(node('strong',date(e.time)+' · '+e.status),node('p',e.note));container.append(item);});}
 async function initGoogle(){
  if(googleReady)return googleReady;
  googleReady=(async()=>{
   const config=await api('config');
   if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error('Google sign-in could not load. Refresh this page to try again.'));document.head.append(script);});
   window.google.accounts.id.initialize({client_id:config.clientId,nonce:config.nonce,hd:'bethelsd.org',auto_select:false,callback:async result=>{
    const epoch=++clientEpoch;$('client-status').textContent='Verifying your school Google account…';
    try{await api('client-login',{credential:result.credential});if(epoch!==clientEpoch)return;googleReady=null;$('service-google-button').replaceChildren();await loadClient();}
    catch(error){if(epoch===clientEpoch){$('client-status').textContent=error.message;googleReady=null;$('service-google-button').replaceChildren();}}
   }});
   window.google.accounts.id.renderButton($('service-google-button'),{theme:'outline',size:'large',text:'signin_with',shape:'rectangular'});
  })().catch(error=>{googleReady=null;throw error;});return googleReady;
 }
 async function loadClient(){
  clientLoadedAt=Date.now();const epoch=++clientEpoch;$('client-requests').replaceChildren();$('client-status').textContent='Loading your requests…';
  try{
   const data=await api('client-view');if(epoch!==clientEpoch)return;
   clientSignedIn=true;$('client-logout').hidden=false;$('service-google-button').replaceChildren();$('client-status').textContent='Signed in as '+data.email+'.';
   if(!data.requests.length)$('client-requests').append(node('p','No requests were found for this school email. New requests appear after processing.'));
   data.requests.slice().reverse().forEach(r=>{
    const card=node('article');card.append(node('span',r.status,'service-badge'),node('h3',r.description||'Service request'),node('p','Request '+r.id.slice(0,8).toUpperCase()+' · '+date(r.created)),node('p',[r.category,r.room&&'Room '+r.room,r.manager&&'Project manager: '+r.manager].filter(Boolean).join(' · ')));
    const updates=node('div');history(updates,r.updates);card.append(updates);
    if(r.status==='Closed'){const feedback=node('a','Share feedback on this service');feedback.href='https://forms.gle/J3xe3qBiy7mReFLq6';feedback.target='_blank';feedback.rel='noopener noreferrer';card.append(feedback);}
    $('client-requests').append(card);
   });
  }catch(error){
   if(epoch!==clientEpoch)return;clientSignedIn=false;$('client-logout').hidden=true;$('client-status').textContent=error.message;
   if(error.status===401)try{await initGoogle();}catch(e){if(epoch===clientEpoch)$('client-status').textContent=e.message;}
  }
 }
 function renderList(){
  const filter=$('service-filter').value,search=$('service-search').value.trim().toLowerCase();$('service-ticket-list').replaceChildren();
  const visible=tickets.filter(r=>(filter==='all'||(filter==='closed'?r.status==='Closed':r.status!=='Closed'))&&[r.id,r.name,r.room,r.description,r.manager].join(' ').toLowerCase().includes(search));
  if(!visible.length)$('service-ticket-list').append(node('p','No matching requests.'));
  visible.forEach(r=>{const button=node('button',null,'service-ticket');button.type='button';button.setAttribute('aria-current',String(r.id===selected?.id));button.append(node('strong',r.name||r.email||'Request '+r.id.slice(0,8)),node('span',r.status+' · Room '+(r.room||'—')),node('span',(r.description||'Service request').slice(0,110)));button.addEventListener('click',()=>{if(busy||!allowDiscard())return;openTicket(r);});$('service-ticket-list').append(button);});
 }
 function openTicket(r){
  clearDetail();selected=r;$('service-detail').hidden=false;$('service-detail-title').textContent='Request '+r.id.slice(0,8).toUpperCase();
  const fields=node('dl');[['Client',r.name],['Email',r.email],['Phone',r.phone],['Submitted',date(r.created)],['Room',r.room],['Category',r.category],['Urgency',r.urgency],['Request',r.description]].forEach(([label,value])=>{fields.append(node('dt',label),node('dd',value||'—'));});
  if(r.attachment){fields.append(node('dt','Attachments'));const dd=node('dd');let linked=false;r.attachment.split(/,\s*/).forEach(value=>{try{const url=new URL(value);if(url.protocol==='https:'&&url.hostname==='drive.google.com'){const link=node('a','Open attachment');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';dd.append(link,node('br'));linked=true;}}catch{}});if(!linked)dd.textContent='No valid attachment link is stored. '+r.attachment;fields.append(dd);}
  $('service-detail-fields').append(fields);$('service-status').value=r.status;
  const options=[{email:'',label:'Unassigned'},...(r.assignmentChoices||managers)];if(r.manager&&!options.some(m=>m.label===r.manager||m.email===r.manager))options.push({email:r.manager,label:r.manager+' (existing assignment)'});
  options.forEach(m=>{const opt=node('option',m.label);opt.value=m.email;if(m.label===r.manager||m.email===r.manager)opt.selected=true;$('service-manager').append(opt);});
  history($('service-public-history'),r.updates);
  (r.internalUpdates||[]).slice().reverse().forEach(e=>{const item=node('div',null,'service-update');item.append(node('strong',date(e.time)+' · '+e.actor),node('p',e.status+' · '+(e.manager||'Unassigned')),node('p',e.note||''));$('service-internal-history').append(item);});
  $('service-legacy-history').textContent=r.legacyLog||'No earlier log entries.';
  applyAccess();$('service-access-status').textContent=r.canEdit===false?'View only. Updates are limited to the assigned project manager and their division leadership.':r.canAssign===false?'You can update this ticket and email saved client updates. Division leadership manages assignments.':'You can update this ticket, manage its assignment, and email saved client updates.';
  if(['sent','sending','unknown'].includes(r.emailState))$('service-save-status').textContent=({sent:'The latest client update has been emailed.',sending:'An email attempt is in progress. Check sent mail before retrying.',unknown:'Email delivery is uncertain. Check sent mail before retrying.'})[r.emailState];
  renderList();
 }
 async function loadManager(keepId){
  const epoch=++managerEpoch;$('manager-status').textContent='Checking your current leadership role…';
  try{
   const data=await api('manage');if(epoch!==managerEpoch)return;if(dirty){$('manager-status').textContent='Fresh data is available. Save or discard your draft, then refresh.';return;}
   workspaceLoadedAt=Date.now();tickets=data.requests;managers=data.managers;document.querySelector('[data-tool=reviews]').hidden=data.canReview===false;if(data.canReview===false&&activeTool==='reviews')activeTool='tickets';$('service-status').replaceChildren(...data.statuses.map(s=>{const option=node('option',s);option.value=s;return option;}));
   $('service-workspace').hidden=false;$('manager-login').hidden=true;$('manager-status').textContent=tickets.length+' requests available. '+tickets.filter(r=>r.canEdit===true).length+' available for you to manage.';
   clearDetail();renderList();
   if(view==='manage'){flip(true);$('service-gear-status').textContent='';}
   if(activeTool!=='tickets')await tool(activeTool);if(keepId){const r=tickets.find(r=>r.id===keepId);if(r)openTicket(r);}
  }catch(error){if(epoch!==managerEpoch)return;clearManager();flip(false);$('manager-login').hidden=false;$('manager-status').textContent=error.message;$('service-gear-status').textContent=error.message;}
 }
 function table(container,columns,rows){const t=node('table'),head=node('thead'),tr=node('tr');columns.forEach(c=>{const th=node('th',c);th.scope='col';tr.append(th);});head.append(tr);const body=node('tbody');rows.forEach(r=>{const line=node('tr');columns.forEach((_,i)=>line.append(node('td',r[i]??'')));body.append(line);});t.append(head,body);container.replaceChildren(t);}
 async function tool(name){
  if(busy||!allowDiscard())return;
  if(dirty)clearDetail();activeTool=name;document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===name)));
  ['tickets','metrics','reviews'].forEach(n=>$('tool-'+n).hidden=n!==(name==='closed'?'tickets':name));
  if(['tickets','closed'].includes(name)){ $('service-filter').value=name==='closed'?'closed':'open';clearDetail();renderList();return; }
  const epoch=managerEpoch,container=$('service-'+name);container.replaceChildren(node('p','Loading…'));
  try{const data=await api(name);if(epoch!==managerEpoch)return;
   if(name==='reviews')table(container,data.columns,data.rows);
   else {metricRows=data.metrics;if(data.trimester?.start&&data.trimester?.end){$('metric-start').value=data.trimester.start;$('metric-end').value=data.trimester.end;$('metric-calendar-status').textContent='Trimester '+data.trimester.number+' · '+data.trimester.start+' through '+data.trimester.end+' · School Google calendars';}else{$('metric-start').value='';$('metric-end').value='';$('metric-calendar-status').textContent=data.trimester?.error||'Calendar dates are unavailable. Select All time.';}metricOptions();renderMetrics();}
  }catch(error){if(epoch===managerEpoch){container.replaceChildren(node('p',error.message));if([401,403].includes(error.status))clearManager();}}
 }
 function flip(back){
  flipped=back;$('service-front').hidden=back;$('view-manage').hidden=!back;
  $('service-flip-card').classList.toggle('is-flipped',back);$('service-gear').setAttribute('aria-expanded',String(back));
  $('service-gear').setAttribute('aria-label',back?'Return to My requests':'Open Client Relations');$('service-face-label').textContent=back?'Client Relations':'Your service desk';
 }
 async function changeView(name){
  if(busy||!allowDiscard())return;if(dirty)clearDetail();
  if(name==='manage'){
   if(flipped){view='client';flip(false);$('view-submit').hidden=true;$('view-client').hidden=false;if(Date.now()-clientLoadedAt>workspaceTTL)await loadClient();return;}
   view='manage';$('service-gear-status').textContent='Checking Client Relations access…';
   if(!window.NestAuth?.identity?.signedIn){window.NestAuth?.open();$('service-gear-status').textContent='Sign in to NEST to open Client Relations.';return;}
   if(workspaceLoadedAt){flip(true);$('service-gear-status').textContent='';if(Date.now()-workspaceLoadedAt>workspaceTTL&&!dirty)loadManager(selected?.id);return;}
   await loadManager();return;
  }
  view=name;flip(false);document.querySelectorAll('[data-view]:not(#service-gear)').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
  ['submit','client'].forEach(n=>$('view-'+n).hidden=n!==name);if(name==='client')await loadClient();
 }
 function metricOptions(){
  const fill=(id,values,label)=>{const el=$(id),current=el.value;el.replaceChildren();const first=node('option',label);first.value='';el.append(first);[...new Set(values)].sort().forEach(value=>{const opt=node('option',value);opt.value=value;el.append(opt);});el.value=[...el.options].some(o=>o.value===current)?current:'';};
  fill('metric-division',metricRows.map(r=>r.division||'Unassigned'),'All divisions');
  const role=$('metric-role').value,division=$('metric-division').value;
  $('metric-person-label').hidden=!role;
  const candidates=metricRows.filter(r=>!division||r.division===division);
  fill('metric-person',role?candidates.map(r=>r[role]||'Unassigned'):[],'Everyone');
 }
 function renderMetrics(){
  const all=$('metric-period').value==='all',start=$('metric-start').value,end=$('metric-end').value;
  $('metric-start').disabled=all;$('metric-end').disabled=all;
  if(!all&&(!start||!end||start>end)){$('service-metrics').replaceChildren(node('p','Choose the trimester start and end dates to view these requests.'));$('service-metric-summary').replaceChildren();$('service-metric-status').textContent='Trimester dates need to be set.';return;}
  const labels=new Map(metricRows.map(r=>[r.manager,r])),groups=new Map(),clients=new Set();let excluded=0;
  for(const r of tickets){
   const meta=labels.get(r.manager||'Unassigned')||{manager:r.manager||'Unassigned',division:'Unassigned'};
   if($('metric-division').value&&meta.division!==$('metric-division').value)continue;
   const role=$('metric-role').value,person=$('metric-person').value;if(role&&person&&person!==(meta[role]||'Unassigned'))continue;
   const day=Number.isFinite(Date.parse(r.created))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.created)):'';
   if(!all&&!day){excluded++;continue;}if(!all&&(day<start||day>end))continue;
   const key=meta.manager;if(!groups.has(key))groups.set(key,{...meta,total:0,open:0,closed:0,days:[],clients:new Set()});const g=groups.get(key);g.total++;
   if(r.status==='Closed')g.closed++;else{g.open++;if(day)g.days.push(Math.max(0,Math.floor((Date.now()-Date.parse(r.created))/86400000)));}
   if(r.email){g.clients.add(r.email);clients.add(r.email);}
  }
  const rows=[...groups.values()].sort((a,b)=>a.division.localeCompare(b.division)||a.manager.localeCompare(b.manager));
  const total=rows.reduce((n,r)=>n+r.total,0),open=rows.reduce((n,r)=>n+r.open,0);
  $('service-metric-summary').replaceChildren(...[['Requests',total],['Open',open],['Closed',total-open],['Clients served',clients.size]].map(([label,value])=>{const card=node('div');card.append(node('strong',value),node('span',label));return card;}));
  $('service-metric-status').textContent=(all?'All time':start+' through '+end)+' · '+total+' matching requests.'+(excluded?' '+excluded+' requests with missing submission dates are excluded; select All time to include them.':'');
  if(!rows.length){$('service-metrics').replaceChildren(node('p','No requests match these filters. Try All time or a different manager.'));return;}
  table($('service-metrics'),['Division','Project manager','Client Relations Director','Division Manager','Total requests','Open','Closed','Average days currently open','Clients served'],rows.map(r=>[r.division,r.manager,r.clientRelationsDirector||'Unassigned',r.divisionManager||'Unassigned',r.total,r.open,r.closed,r.days.length?Math.round(r.days.reduce((a,b)=>a+b,0)/r.days.length*10)/10:'—',r.clients.size]));
 }
 ['metric-period','metric-division','metric-role','metric-person'].forEach(id=>$(id).addEventListener('change',()=>{metricOptions();renderMetrics();}));
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>changeView(b.dataset.view)));
 document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>tool(b.dataset.tool)));
 $('manager-login').addEventListener('click',()=>window.NestAuth?.open());
 $('manager-refresh').addEventListener('click',()=>{if(!busy&&allowDiscard())loadManager(selected?.id);});
 $('client-refresh').addEventListener('click',loadClient);
 $('client-logout').addEventListener('click',async()=>{clearClient();$('client-status').textContent='Signing out…';try{await api('client-logout',{});googleReady=null;window.google?.accounts?.id.disableAutoSelect();await loadClient();}catch(e){$('client-status').textContent=e.message;}});
 ['service-filter','service-search'].forEach(id=>$(id).addEventListener('input',renderList));
 $('service-edit').addEventListener('input',()=>{dirty=true;$('service-email').disabled=true;});
 function acceptSaved(data,id){
  const row=data.request;if(!row||row.id!==id||!/^[a-f0-9]{64}$/.test(row.version||''))return false;
  tickets=tickets.map(r=>r.id===id?row:r);workspaceLoadedAt=Date.now();clientLoadedAt=0;dirty=false;openTicket(row);return true;
 }
 function applyAccess(){const locked=busy||!selected||selected.canEdit===false;$('service-save').disabled=locked;['service-status','service-note','service-public-note'].forEach(id=>$(id).disabled=locked);$('service-manager').disabled=locked||selected?.canAssign===false;$('service-email').disabled=locked||dirty||selected?.emailState!=='unsent'||!selected?.updates?.length;}
 const setBusy=value=>{busy=value;applyAccess();};
 $('service-edit').addEventListener('submit',async event=>{
  event.preventDefault();if(!selected||busy||selected.canEdit===false)return;const r=selected,epoch=managerEpoch;setBusy(true);$('service-save-status').textContent='Saving update…';
  try{const result=await api('update',{id:r.id,version:r.version,status:$('service-status').value,manager:$('service-manager').value,note:$('service-note').value,publicNote:$('service-public-note').value});if(epoch!==managerEpoch)return;dirty=false;if(!acceptSaved(result,r.id))await loadManager(r.id);$('service-save-status').textContent='Update saved.';}
  catch(error){if(epoch===managerEpoch){$('service-save-status').textContent=error.message;if([401,403].includes(error.status))clearManager();}}
  finally{setBusy(false);}
 });
 $('service-email').addEventListener('click',async()=>{
  if(!selected||busy||dirty||selected.canEdit===false)return;const r=selected,latest=r.updates.at(-1);if(!latest)return;
  if(!window.confirm('Email the saved client update to '+r.email+'?'))return;
  const epoch=managerEpoch;setBusy(true);$('service-save-status').textContent='Sending the saved client update…';
  try{const result=await api('email',{id:r.id,version:r.version,eventId:latest.eventId});if(epoch!==managerEpoch)return;if(!acceptSaved(result,r.id))await loadManager(r.id);$('service-save-status').textContent='Client update emailed.';}
  catch(error){if(epoch===managerEpoch){$('service-save-status').textContent=error.message;if([502,503].includes(error.status)&&selected)selected.emailState='unknown';$('service-email').disabled=true;if([401,403].includes(error.status))clearManager();}}
  finally{setBusy(false);}
 });
 document.addEventListener('nest-auth-change',()=>{clearManager();if(view==='manage'&&window.NestAuth?.identity?.signedIn)loadManager();else flip(false);});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 window.addEventListener('pagehide',()=>{clearManager();clearClient();});
 if(location.hash==='#client-relations')changeView('manage');else changeView('client');
})();
