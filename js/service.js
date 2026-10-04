(() => {
 const $=id=>document.getElementById(id),node=(tag,text,className)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(className)n.className=className;return n;};
 let workspaceLoadedAt=0,clientLoadedAt=0,termRange=null,managerLoad=null;const workspaceTTL=120000;
 let view='client',activeTool='metrics',metricRows=[],students=[],metricLoaded=false,chosenManagers=null,chartModel=null,flipped=false,tickets=[],managers=[],selected=null,logEdit=null,dirty=false,busy=false,managerEpoch=0,clientEpoch=0,googleReady=null,clientSignedIn=false;
 const api=async(operation,body,outerSignal,requestId)=>{
  const controller=new AbortController(),timeout=body?60000:50000;
  const abort=()=>controller.abort();outerSignal?.addEventListener('abort',abort,{once:true});if(outerSignal?.aborted)abort();
  let timer;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const error=new Error(body?'The response took too long. Refresh to check whether your change saved before retrying.':'The workspace took too long to load. Click the gear to try again.');error.status=503;reject(error);},timeout);});
  try{return await Promise.race([deadline,(async()=>{
   const response=await fetch('/api/service-requests'+(body?'':'?operation='+encodeURIComponent(operation)+(requestId?'&id='+encodeURIComponent(requestId):'')),{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,...body})}:{}),credentials:'same-origin',cache:'no-store',signal:controller.signal});
   const data=await response.json();if(!response.ok){const error=new Error(data.error||'Service requests are unavailable.');error.status=response.status;throw error;}return data;
  })()]);}finally{clearTimeout(timer);outerSignal?.removeEventListener('abort',abort);}
 };
 const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString():String(value||'');};
 const allowDiscard=()=>!dirty||window.confirm('Discard your unsaved service request update?');
 function clearDetail(){selected=null;logEdit=null;dirty=false;$('service-log-editor').hidden=true;$('service-log-editor-note').value='';$('service-log-editor-status').textContent='';$('service-test-help').textContent='';$('service-detail').hidden=true;$('service-note').value='';$('service-public-note').value='';$('service-legacy-history').textContent='';$('service-access-status').textContent='';['service-detail-title','service-detail-fields','service-public-history','service-internal-history','service-save-status','service-log-audit','service-email-history','service-copy-choices','service-log-editor-title','service-log-editor-help'].forEach(id=>$(id).replaceChildren());$('service-manager').replaceChildren();$('service-email').disabled=true;}
 function clearManager(){$('service-unassigned-dialog').close?.();$('service-unassigned-list').replaceChildren();managerLoad?.controller.abort();managerLoad=null;$('service-gear-status').textContent='';$('service-email-mode').querySelector('option[value="test"]')?.remove();delete document.body.dataset.servicePrint;$('metric-student-search').value='';$('service-search').value='';$('service-period-status').textContent='';workspaceLoadedAt=0;termRange=null;$('metric-start').value='';$('metric-end').value='';tickets=[];students=[];metricRows=[];metricLoaded=false;chosenManagers=null;chartModel=null;metricOptions();managerEpoch++;managers=[];clearDetail();$('service-workspace').hidden=true;['service-ticket-list','service-metrics','service-reviews','service-metric-summary','service-metric-status','metric-calendar-status','service-chart-ranking','service-participation','service-participation-context','metric-export-status'].forEach(id=>$(id).replaceChildren());}
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
  const period=$('service-period').value,range=periodRange(period),filter=$('service-filter').value,search=$('service-search').value.trim().toLowerCase();$('service-ticket-list').replaceChildren();
  const visible=tickets.filter(r=>periodMatch(r,period)&&(filter==='all'||(filter==='closed'?r.status==='Closed':r.status!=='Closed'))&&[r.id,r.name,r.room,r.description,r.manager].join(' ').toLowerCase().includes(search));
  $('service-period-status').textContent=period==='current'&&!range?'Current trimester dates are unavailable. Select All time.':$('service-period').selectedOptions[0].textContent+' · '+visible.length+' matching requests.'+(period!=='all'&&tickets.some(r=>!requestDay(r))?' Requests with missing dates are included only in All time.':'');
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
  savedHistory($('service-public-history'),r.updates,'public');
  savedHistory($('service-internal-history'),r.internalUpdates||[],'internal');
  (r.logAudit||[]).slice().reverse().forEach(e=>{const card=node('div',null,'service-update');card.append(node('strong',date(e.time)+' · '+e.actor),node('p',(e.scope==='public'?'Client-facing':'Internal')+' entry '+(e.action==='delete'?'deleted':'edited')),node('p','Previous text: '+e.previousNote));if(e.action==='edit')card.append(node('p','Updated text: '+e.note));$('service-log-audit').append(card);});
  (r.copyChoices||[]).forEach(choice=>{const label=node('label'),input=node('input');input.type='checkbox';input.value=choice.email;input.dataset.emailCopy='true';label.append(input,node('span',choice.label));$('service-copy-choices').append(label);});
  if(!r.copyChoices?.length)$('service-copy-choices').append(node('p','No current leadership members are available to copy for this ticket.'));
  (r.emailHistory||[]).slice().reverse().forEach(e=>{const card=node('div',null,'service-update');card.append(node('strong',date(e.time)+' · '+e.actor),node('p',(e.testing?'Test email':'Client email')+' · '+(e.state==='sent'?'Sent':'Delivery uncertain')+' · '+(e.mode==='entire'?'Entire client-facing log':'Most recent entry')),node('p','To: '+e.to+(e.cc?.length?' · CC: '+e.cc.join(', '):'')));$('service-email-history').append(card);});
  if(!r.emailHistory?.length)$('service-email-history').append(node('p','No recorded email sends.'));
  configureEmailOptions();
  $('service-legacy-history').textContent=r.legacyLog||'No earlier log entries.';
  applyAccess();$('service-access-status').textContent=r.canEdit===false&&r.canAssign?'Assign a project manager to enable ticket management by that manager and their division leadership.':r.canEdit===false?'View only. Updates are limited to the assigned project manager and their division leadership.':r.canAssign===false?'You can update this ticket and email saved client updates. Division leadership manages assignments.':'You can update this ticket, manage its assignment, and email saved client updates.';
  emailStatus();
  renderList();
 }
 function loadManager(keepId){
  if(managerLoad)return managerLoad.promise;
  const controller=new AbortController(),entry={controller,promise:null};managerLoad=entry;
  entry.promise=runManager(keepId,controller.signal).finally(()=>{if(managerLoad===entry)managerLoad=null;});return entry.promise;
 }
 async function runManager(keepId,signal){
  const epoch=++managerEpoch;const slow=setTimeout(()=>{if(epoch===managerEpoch&&view==='manage')$('service-gear-status').textContent='Still loading the service workbook… Click the gear again to return to your requests.';},8000);$('manager-status').textContent='Checking your current leadership role…';
  try{
   const data=await api('manage',null,signal);if(epoch!==managerEpoch)return;if(dirty){$('manager-status').textContent='Fresh data is available. Save or discard your draft, then refresh.';return;}
   workspaceLoadedAt=Date.now();tickets=data.requests;managers=data.managers;metricRows=data.metrics||[];students=data.students||[];metricLoaded=Array.isArray(data.metrics);setTerm(data.trimester);periodOptions();document.querySelector('[data-tool=reviews]').hidden=data.canReview===false;if(data.canReview===false&&activeTool==='reviews')activeTool='metrics';$('service-status').replaceChildren(...data.statuses.map(s=>{const option=node('option',s);option.value=s;return option;}));
   $('service-workspace').hidden=false;$('manager-login').hidden=true;$('manager-status').textContent=tickets.length+' requests available. '+tickets.filter(r=>r.canEdit===true).length+' available for you to manage.';
   clearDetail();renderList();
   if(view==='manage'){flip(true);$('service-gear-status').textContent='';}
   if(activeTool!=='tickets')await tool(activeTool);if(keepId){const r=tickets.find(r=>r.id===keepId);if(r)openTicket(r);}
  }catch(error){if(epoch!==managerEpoch)return;const visible=view==='manage';clearManager();flip(false);$('manager-login').hidden=false;$('manager-status').textContent=error.message;if(visible)$('service-gear-status').textContent=error.message;}
  finally{clearTimeout(slow);}
 }
 function table(container,columns,rows){const t=node('table'),head=node('thead'),tr=node('tr');columns.forEach(c=>{const th=node('th',c);th.scope='col';tr.append(th);});head.append(tr);const body=node('tbody');rows.forEach(r=>{const line=node('tr');columns.forEach((_,i)=>line.append(node('td',r[i]??'')));body.append(line);});t.append(head,body);container.replaceChildren(t);}
 async function tool(name){
  if(busy||!allowDiscard())return;
  if(dirty)clearDetail();activeTool=name;document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===name)));
  ['tickets','metrics','reviews'].forEach(n=>$('tool-'+n).hidden=n!==(name==='closed'?'tickets':name));
  if(['tickets','closed'].includes(name)){ $('service-filter').value=name==='closed'?'closed':'open';clearDetail();renderList();return; }
  if(name==='metrics'&&metricLoaded){metricOptions();renderMetrics();return;}
  const epoch=managerEpoch,container=$('service-'+name);container.replaceChildren(node('p','Loading…'));
  try{const data=await api(name);if(epoch!==managerEpoch)return;
   if(name==='reviews')table(container,data.columns,data.rows);
   else {metricRows=data.metrics||[];students=data.students||students;metricLoaded=Array.isArray(data.metrics);setTerm(data.trimester);metricOptions();renderMetrics();}
  }catch(error){if(epoch===managerEpoch){container.replaceChildren(node('p',error.message));if([401,403].includes(error.status))clearManager();}}
 }
 function flip(back){
  flipped=back;$('service-front').hidden=back;$('view-manage').hidden=!back;
  $('service-flip-card').classList.toggle('is-flipped',back);$('service-gear').setAttribute('aria-expanded',String(back));
  $('service-gear').setAttribute('aria-label',back?'Return to My requests':'Open Client Relations');$('service-face-label').textContent=back?'Client Relations':'Your service desk';if(back)showUnassigned();else $('service-unassigned-dialog').close?.();
 }
 function showUnassigned(){
  const pending=tickets.filter(r=>r.status!=='Closed'&&!String(r.manager||'').trim()&&r.canAssign===true),dialog=$('service-unassigned-dialog');$('service-unassigned-list').replaceChildren();
  if(!pending.length){dialog.close?.();return;}
  pending.forEach(r=>{const button=node('button',(r.name||'Request '+r.id.slice(0,8))+' · '+(r.description||'Service request').slice(0,90));button.type='button';button.addEventListener('click',async()=>{if(busy||!allowDiscard())return;await tool('tickets');$('service-period').value='all';$('service-search').value='';openTicket(r);$('service-detail').scrollIntoView?.({block:'start',behavior:'smooth'});$('service-manager').focus();});$('service-unassigned-list').append(button);});
  if(!dialog.open)dialog.show?.();
 }
 $('service-unassigned-later').addEventListener('click',()=>$('service-unassigned-dialog').close?.());
 async function changeView(name){
  if(busy||!allowDiscard())return;if(dirty)clearDetail();
  if(name==='manage'){
   if(managerLoad&&!flipped&&view==='manage'){view='client';$('service-gear-status').textContent='';return;}
   if(flipped){view='client';flip(false);$('view-submit').hidden=true;$('view-client').hidden=false;if(Date.now()-clientLoadedAt>workspaceTTL)await loadClient();return;}
   view='manage';$('service-gear-status').textContent='Checking Client Relations access…';
   if(!window.NestAuth?.identity?.signedIn){window.NestAuth?.open();$('service-gear-status').textContent='Sign in to NEST to open Client Relations.';return;}
   if(workspaceLoadedAt){await tool('metrics');flip(true);$('service-gear-status').textContent='';if(Date.now()-workspaceLoadedAt>workspaceTTL&&!dirty)loadManager(selected?.id);return;}
   activeTool='metrics';await loadManager();return;
  }
  view=name;flip(false);document.querySelectorAll('[data-view]:not(#service-gear)').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
  ['submit','client'].forEach(n=>$('view-'+n).hidden=n!==name);if(name==='client')await loadClient();
 }
 function requestDay(r){return Number.isFinite(Date.parse(r.created))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.created)):'';}
 function setTerm(value){
  if(value?.start&&value?.end){termRange=value;$('metric-start').value=value.start;$('metric-end').value=value.end;$('metric-calendar-status').textContent='Trimester '+value.number+' · '+value.start+' through '+value.end+' · School Google calendars';}
  else if(!termRange){$('metric-calendar-status').textContent=value?.error||'Calendar dates are unavailable. Select All time.';}
 }
 function periodRange(value){
  if(value==='current')return termRange||($('metric-start').value&&$('metric-end').value?{start:$('metric-start').value,end:$('metric-end').value}:null);
  if(/^year:\d{4}$/.test(value)){const year=Number(value.slice(5));return {start:year+'-07-01',end:(year+1)+'-06-30'};}return null;
 }
 function periodMatch(r,value){if(value==='all')return true;const range=periodRange(value),day=requestDay(r);return Boolean(range&&day&&day>=range.start&&day<=range.end);}
 function periodOptions(){
  const today=requestDay({created:new Date().toISOString()}),current=Number(today.slice(0,4))-(Number(today.slice(5,7))<7?1:0),years=new Set([current,current-1]);
  tickets.forEach(r=>{const day=requestDay(r);if(day){const year=Number(day.slice(0,4))-(Number(day.slice(5,7))<7?1:0);if(year>=1900&&year<=current)years.add(year);}});
  ['service-period','metric-period'].forEach(id=>{const el=$(id),previous=el.value;el.replaceChildren();[['current','Current trimester'],...[...years].sort((a,b)=>b-a).map(y=>['year:'+y,'School year '+y+'–'+(y+1)]),['all','All time']].forEach(([value,label])=>{const opt=node('option',label);opt.value=value;el.append(opt);});el.value=[...el.options].some(o=>o.value===previous)?previous:(id==='service-period'?'all':'current');});
 }
 function metricOptions(){
  periodOptions();  const fill=(id,values,label)=>{const el=$(id),current=el.value;el.replaceChildren();const first=node('option',label);first.value='';el.append(first);[...new Set(values)].sort().forEach(value=>{const opt=node('option',value);opt.value=value;el.append(opt);});el.value=[...el.options].some(o=>o.value===current)?current:'';};
  fill('metric-division',[...metricRows.map(r=>r.division||'Unassigned'),...students.map(s=>s.division)],'All divisions');
  const role=$('metric-role').value,division=$('metric-division').value;
  $('metric-person-label').hidden=!role;
  const candidates=metricRows.filter(r=>!division||r.division===division);
  fill('metric-person',role?[...candidates.map(r=>r[role]||'Unassigned'),...(role==='manager'?students.filter(s=>!division||s.division===division).map(s=>s.manager):[])]:[],'Everyone');
  managerChoices();
 }
 function renderMetrics(){
  const period=$('metric-period').value,all=period==='all',range=periodRange(period),start=range?.start,end=range?.end;
  $('metric-start').disabled=all;$('metric-end').disabled=all;
  if(!all&&(!start||!end||start>end)){$('service-metrics').replaceChildren(node('p','Current trimester dates are unavailable. Select All time or a school year.'));$('service-metric-summary').replaceChildren();$('service-chart-ranking').replaceChildren();$('service-participation').replaceChildren();$('service-participation-context').textContent='';chartModel=null;$('service-metric-status').textContent='Trimester dates are unavailable. Choose a school year or All time.';return;}
  const labels=new Map(metricRows.map(r=>[r.manager,r])),groups=new Map(),clients=new Set();let excluded=0;
  for(const r of tickets){
   const rosterMeta=students.find(s=>s.manager===r.manager),meta=labels.get(r.manager||'Unassigned')||{...(rosterMeta?metricRows.find(m=>m.division===rosterMeta.division):null),manager:r.manager||'Unassigned',division:rosterMeta?.division||'Unassigned'};
   if($('metric-division').value&&meta.division!==$('metric-division').value)continue;if(chosenManagers!=null&&!chosenManagers.includes(meta.manager))continue;
   const role=$('metric-role').value,person=$('metric-person').value;if(role&&person&&person!==(meta[role]||'Unassigned'))continue;
   const day=requestDay(r);
   if(!all&&!day){excluded++;continue;}if(!all&&(day<start||day>end))continue;
   const key=meta.manager;if(!groups.has(key))groups.set(key,{...meta,total:0,open:0,closed:0,days:[],clients:new Set()});const g=groups.get(key);g.total++;
   if(r.status==='Closed')g.closed++;else{g.open++;if(day)g.days.push(Math.max(0,Math.floor((Date.now()-Date.parse(r.created))/86400000)));}
   if(r.email){g.clients.add(r.email);clients.add(r.email);}
  }
  const rows=[...groups.values()].sort((a,b)=>a.division.localeCompare(b.division)||a.manager.localeCompare(b.manager));
  if(window.NestServiceCharts){chartModel=window.NestServiceCharts.build({tickets,rows:metricRows,students,period,start,end,division:$('metric-division').value,role:$('metric-role').value,person:$('metric-person').value,selectedManagers:chosenManagers,studentSearch:$('metric-student-search').value,group:$('metric-group').value});}
  const total=rows.reduce((n,r)=>n+r.total,0),open=rows.reduce((n,r)=>n+r.open,0);
  $('service-metric-summary').replaceChildren(...[['Requests',total],['Open',open],['Closed',total-open],['Clients served',clients.size],['Average days open',chartModel?.average??'—']].map(([label,value])=>{const card=node('div');card.append(node('strong',value),node('span',label));return card;}));
  if(chartModel)renderCharts();
  $('service-metric-status').textContent=(all?'All time':start+' through '+end)+' · '+total+' matching requests.'+(chartModel?' Average includes '+chartModel.measured+' dated tickets; '+chartModel.unknownClosure+' closed tickets lack a recorded closure date.':'')+(excluded?' '+excluded+' requests with missing submission dates are excluded; select All time to include them.':'');
  if(!rows.length){$('service-metrics').replaceChildren(node('p','No requests match these filters. Try All time or a different manager.'));return;}
  table($('service-metrics'),['Division','Project manager','Client Relations Director','Division Manager','Total requests','Open','Closed','Average days currently open','Clients served'],rows.map(r=>[r.division,r.manager,r.clientRelationsDirector||'Unassigned',r.divisionManager||'Unassigned',r.total,r.open,r.closed,r.days.length?Math.round(r.days.reduce((a,b)=>a+b,0)/r.days.length*10)/10:'—',r.clients.size]));
 }
 function managerChoices(){
  const labels=[...new Set([...students.map(s=>s.manager),...metricRows.map(r=>r.manager)])].sort();$('metric-manager-options').replaceChildren();$('metric-manager-count').textContent=chosenManagers==null?'(all)':'('+chosenManagers.length+' selected)';
  labels.forEach(label=>{const wrapper=node('label'),input=node('input');input.type='checkbox';input.value=label;input.checked=chosenManagers==null||chosenManagers.includes(label);input.addEventListener('change',()=>{chosenManagers=[...$('metric-manager-options').querySelectorAll('input:checked')].map(el=>el.value);$('metric-manager-count').textContent='('+chosenManagers.length+' selected)';renderMetrics();});wrapper.append(input,node('span',label));$('metric-manager-options').append(wrapper);});
 }
 function renderCharts(){
  const m=chartModel,max=Math.max(1,...m.ranking.map(r=>r.total)),container=$('service-chart-ranking');container.replaceChildren(node('h3','Tickets by '+(m.group==='manager'?'project manager':'division')));
  const legend=node('p','Green: closed · Gold: open. Choose a bar to focus the charts.');container.append(legend);
  if(!m.ranking.length)container.append(node('p','No groups match these filters.'));
  m.ranking.forEach((r,i)=>{const button=node('button',null,'service-ranking-row');button.type='button';button.setAttribute('aria-label',r.label+': '+r.total+' tickets, '+r.closed+' closed, '+r.open+' open. Focus this '+m.group+'.');const track=node('span',null,'service-ranking-track'),fill=node('span',null,'service-ranking-fill'),closed=node('span',null,'service-ranking-closed');fill.style.width=(r.total/max*100)+'%';closed.style.width=(r.total?r.closed/r.total*100:0)+'%';fill.append(closed);track.append(fill);button.append(node('span',(i+1)+'. '+r.label,'service-ranking-label'),track,node('strong',r.total));button.addEventListener('click',()=>{if(m.group==='division'){$('metric-division').value=r.label;$('metric-role').value='';}else{$('metric-role').value='manager';}metricOptions();if(m.group==='manager')$('metric-person').value=r.label;renderMetrics();});container.append(button);});
  const donut=node('div',null,'service-closed-donut');donut.setAttribute('role','img');donut.setAttribute('aria-label',m.closed+' closed out of '+m.total+' requests');donut.style.setProperty('--closed-angle',(m.total?m.closed/m.total*360:0)+'deg');donut.append(node('strong',m.closed),node('span','closed'));const closedCard=[...$('service-metric-summary').children].find(c=>c.textContent.includes('Closed'));if(closedCard)closedCard.replaceChildren(donut,node('span','Closed'));
  $('service-participation').replaceChildren();for(const [title,list] of [['Have taken a ticket',m.taken],['Yet to take a ticket',m.waiting]]){const column=node('section');column.append(node('h4',title+' ('+list.length+')'));const names=node('ul');list.forEach(s=>{const li=node('li'),button=node('button',s.name+' · '+s.division);button.type='button';button.setAttribute('aria-label','Show service charts for '+s.name+' in '+s.division);button.addEventListener('click',()=>{chosenManagers=[s.manager];$('metric-division').value='';$('metric-role').value='';$('metric-student-search').value=s.name;$('metric-group').value='manager';metricOptions();renderMetrics();});li.append(button);names.append(li);});if(!list.length)names.append(node('li','No students match.'));column.append(names);$('service-participation').append(column);}
  $('service-participation-context').textContent='Current roster · recorded assignments on requests submitted in the selected period.'+(m.unknownAssignments?' '+m.unknownAssignments+' requests have no matching current-roster assignment.':'');
 }
 const saveDownload=(blob,name)=>{const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 async function exportCharts(format){
  if(!chartModel){$('metric-export-status').textContent='Load the barometer and choose a valid time period first.';return;}const epoch=managerEpoch,svg=window.NestServiceCharts.svg(chartModel,$('metric-export-scope').value),name='NEST-service-'+$('metric-export-scope').value+'-'+new Date().toISOString().slice(0,10);$('metric-export-status').textContent='Preparing your chart…';
  try{if(format==='svg')saveDownload(new Blob([svg],{type:'image/svg+xml'}),name+'.svg');else{const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});if(epoch!==managerEpoch)return;const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Unable to create image');saveDownload(blob,name+'.png');}finally{URL.revokeObjectURL(url);}}if(epoch===managerEpoch)$('metric-export-status').textContent='Chart downloaded. Insert the PNG or SVG into your leadership slide.';}
  catch{if(epoch===managerEpoch)$('metric-export-status').textContent='Image download could not finish. Try Download SVG or Print / Save PDF.';}
 }
 $('metric-manager-all').addEventListener('click',()=>{chosenManagers=null;metricOptions();renderMetrics();});
 $('metric-reset').addEventListener('click',()=>{chosenManagers=null;$('metric-division').value='';$('metric-role').value='';$('metric-student-search').value='';metricOptions();renderMetrics();});
 ['metric-group','metric-student-search'].forEach(id=>$(id).addEventListener(id==='metric-student-search'?'input':'change',renderMetrics));
 $('metric-download').addEventListener('click',()=>exportCharts('png'));$('metric-download-svg').addEventListener('click',()=>exportCharts('svg'));
 $('metric-print').addEventListener('click',()=>{if(!chartModel)return;document.body.dataset.servicePrint=$('metric-export-scope').value;window.addEventListener('afterprint',()=>{delete document.body.dataset.servicePrint;},{once:true});window.print();});
 ['metric-period','metric-division','metric-role','metric-person'].forEach(id=>$(id).addEventListener('change',()=>{metricOptions();renderMetrics();}));
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>changeView(b.dataset.view)));
 document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>tool(b.dataset.tool)));
 $('manager-login').addEventListener('click',()=>window.NestAuth?.open());
 $('manager-refresh').addEventListener('click',()=>{if(!busy&&allowDiscard())loadManager(selected?.id);});
 $('client-refresh').addEventListener('click',loadClient);
 $('client-logout').addEventListener('click',async()=>{clearClient();$('client-status').textContent='Signing out…';try{await api('client-logout',{});googleReady=null;window.google?.accounts?.id.disableAutoSelect();await loadClient();}catch(e){$('client-status').textContent=e.message;}});
 function emailStatus(){if($('service-email-mode').value==='test'){$('service-save-status').textContent=selected?.testEmailState==='unknown'?'Previous test delivery is uncertain. Check your inbox before sending another test.':'';return;}const state=selected?.emailStates?.[$('service-email-mode').value]||selected?.emailState;$('service-save-status').textContent=({sent:'This log option has already been emailed for the latest client entry.',sending:'An email attempt is in progress. Check sent mail before retrying.',unknown:'Email delivery is uncertain. Check sent mail before retrying.'})[state]||'';}
 $('service-email-mode').addEventListener('change',()=>{applyAccess();if(!busy&&!dirty)emailStatus();});
 $('service-period').addEventListener('change',renderList);
 ['service-filter','service-search'].forEach(id=>$(id).addEventListener('input',renderList));
 $('service-edit').addEventListener('input',event=>{if(event.target.dataset.emailCopy||['service-email-mode','service-test-log-mode'].includes(event.target.id))return;dirty=true;$('service-email').disabled=true;});
 function acceptSaved(data,id){
  const row=data.request;if(!row||row.id!==id||!/^[a-f0-9]{64}$/.test(row.version||''))return false;
  tickets=tickets.map(r=>r.id===id?row:r);workspaceLoadedAt=Date.now();clientLoadedAt=0;dirty=false;openTicket(row);return true;
 }
 function configureEmailOptions(){
  const el=$('service-email-mode'),previous=el.value;el.replaceChildren();[['latest','The most recent log entry'],['entire','The entire log'],...(selected?.canTestEmail?[['test','Testing: email log to myself']]:[])].forEach(([value,label])=>{const option=node('option',label);option.value=value;el.append(option);});el.value=[...el.options].some(o=>o.value===previous)?previous:'latest';
 }
 function savedHistory(container,entries,scope){
  container.replaceChildren();if(!entries.length){container.append(node('p',scope==='public'?'No client updates yet.':'No internal entries.'));return;}
  entries.slice().reverse().forEach(e=>{const card=node('div',null,'service-update');card.append(node('strong',date(e.time)+' · '+e.status));if(scope==='internal')card.append(node('p',e.actor+' · '+(e.manager||'Unassigned')));card.append(node('p',e.note||''));if(e.updatedAt)card.append(node('small','Edited '+date(e.updatedAt)));if(scope==='public'&&e.emailed)card.append(node('small','Included in an earlier email attempt. Sent emails cannot be changed.'));
   if(selected?.canEdit!==false&&e.canManageNote===true&&e.note&&e.entryId&&e.entryVersion){const actions=node('div',null,'internal-actions');[['edit','Edit'],['delete','Delete']].forEach(([action,label])=>{const button=node('button',label);button.type='button';button.dataset.logAction=action;button.setAttribute('aria-label',label+' '+(scope==='public'?'client-facing':'internal')+' entry from '+date(e.time));button.addEventListener('click',()=>action==='edit'?beginLogEdit(e,scope):deleteLogEntry(e,scope));actions.append(button);});card.append(actions);}container.append(card);
  });
 }
 function beginLogEdit(entry,scope){
  if(busy||logEdit||entry.canManageNote!==true||selected?.canEdit===false||!allowDiscard())return;const r=selected;if(dirty)openTicket(r);logEdit={entry,scope};dirty=true;$('service-log-editor').hidden=false;$('service-log-editor-title').textContent='Edit '+(scope==='public'?'client-facing':'internal')+' entry · '+date(entry.time);$('service-log-editor-help').textContent=scope==='public'?'Changes appear in the client portal and future emails. Emails already sent cannot be changed. A private revision history is kept.':'Changes update this saved internal entry. A private revision history is kept.';$('service-log-editor-note').value=entry.note;applyAccess();$('service-log-editor-note').focus();$('service-log-editor').scrollIntoView?.({block:'nearest',behavior:'smooth'});
 }
 async function changeSavedLog(operation,r,entry,scope,note,epoch){
  const payload={id:r.id,version:r.version,eventId:entry.entryId,entryVersion:entry.entryVersion,scope,...(operation==='edit-log'?{note}:{})};
  try{return await api(operation,payload);}catch(error){
   if(![409,503].includes(error.status)||epoch!==managerEpoch)throw error;
   const fresh=await api('ticket',null,null,r.id);if(epoch!==managerEpoch)return null;
   const row=fresh.request;if(!row||row.id!==r.id)throw error;
   const current=(scope==='public'?row.updates:row.internalUpdates||[]).find(e=>e.entryId===entry.entryId);
   if(operation==='delete-log'&&!current?.note||operation==='edit-log'&&current?.note===note)return fresh;
   if(error.status===409&&current?.entryVersion===entry.entryVersion&&row.canEdit!==false){
    try{return await api(operation,{...payload,version:row.version});}catch(retryError){if(retryError.status!==409)throw retryError;const newest=await api('ticket',null,null,r.id);if(epoch!==managerEpoch)return null;error=retryError;fresh.request=newest.request;}
   }
   const latest=fresh.request,updated=(scope==='public'?latest.updates:latest.internalUpdates||[]).find(e=>e.entryId===entry.entryId);
   acceptSaved(fresh,r.id);
   if(operation==='edit-log'){
    logEdit={entry:updated||entry,scope,unavailable:!updated?.note||updated.canManageNote!==true||latest.canEdit===false};dirty=true;$('service-log-editor').hidden=false;$('service-log-editor-note').value=note;$('service-log-editor-title').textContent='Review your log edit';$('service-log-editor-help').textContent='The saved log has been updated below. Your draft is preserved.';
    $('service-log-editor-status').textContent=!updated?.note?'This entry has been deleted. Your draft is kept here for copying.':error.status===409?'This entry changed elsewhere. Review the current log and your draft before saving again.':'The change could not be confirmed. The current log is shown below; your draft is kept.';
   }else $('service-save-status').textContent=error.status===409?'This entry changed elsewhere. The current log is shown; review it before deleting again.':'Deletion could not be confirmed. The current log is shown.';
   return null;
  }
 }
 async function deleteLogEntry(entry,scope){
  if(busy||logEdit||entry.canManageNote!==true||selected?.canEdit===false||!allowDiscard())return;const r=selected;if(dirty)openTicket(r);
  if(!window.confirm('Delete this '+(scope==='public'?'client-facing':'internal')+' entry? '+(scope==='public'?'It will be removed from the client portal and future log emails. Emails already sent stay unchanged. ':'')+'A private revision history will remain.'))return;
  const epoch=managerEpoch;setBusy(true);$('service-save-status').textContent='Deleting log entry…';
  try{const result=await changeSavedLog('delete-log',r,entry,scope,null,epoch);if(epoch!==managerEpoch||!result)return;if(!acceptSaved(result,r.id))await loadManager(r.id);$('service-save-status').textContent='Log entry deleted.';}
  catch(error){if(epoch===managerEpoch){$('service-save-status').textContent=error.message;if([401,403].includes(error.status))clearManager();}}
  finally{setBusy(false);}
 }
 $('service-log-editor').addEventListener('submit',async event=>{
  event.preventDefault();if(!logEdit||logEdit.entry.canManageNote!==true||logEdit.unavailable||!selected||busy||selected.canEdit===false)return;const r=selected,{entry,scope}=logEdit,note=$('service-log-editor-note').value.trim();if(!note){$('service-log-editor-status').textContent='Enter the updated text, or cancel and use Delete.';return;}if(note===entry.note){$('service-log-editor-status').textContent='No changes to save.';return;}
  const epoch=managerEpoch;setBusy(true);$('service-log-editor-status').textContent='Saving changes…';
  try{const result=await changeSavedLog('edit-log',r,entry,scope,note,epoch);if(epoch!==managerEpoch||!result)return;if(!acceptSaved(result,r.id)){dirty=false;await loadManager(r.id);}$('service-save-status').textContent='Log entry updated.';}
  catch(error){if(epoch===managerEpoch){$('service-log-editor-status').textContent=error.message;if([401,403].includes(error.status))clearManager();}}
  finally{setBusy(false);}
 });
 $('service-log-editor-cancel').addEventListener('click',()=>{if(!busy&&selected)openTicket(selected);});
 function applyAccess(){
  const locked=busy||!selected||selected.canEdit===false,testing=$('service-email-mode').value==='test';$('service-save').disabled=busy||!selected||selected.canEdit===false&&selected.canAssign!==true||Boolean(logEdit);$('service-save').textContent=selected?.canEdit===false&&selected.canAssign?'Assign project manager':'Save update';['service-status','service-note','service-public-note'].forEach(id=>$(id).disabled=locked||Boolean(logEdit));$('service-manager').disabled=busy||!selected||Boolean(logEdit)||selected.canAssign!==true;
  $('service-test-mode-label').hidden=!testing||!selected?.canTestEmail;$('service-test-help').hidden=!testing||!selected?.canTestEmail;$('service-test-help').textContent=testing&&selected?.canTestEmail?'Test recipient: '+selected.testEmail+'. The client is not emailed.':'';$('service-email').textContent=testing?'Send test to my email':'Email log to client';
  $('service-email').disabled=locked||dirty||!selected?.updates?.length||(testing?!selected?.canTestEmail:(selected?.emailStates?.[$('service-email-mode').value]||selected?.emailState)!=='unsent');
  document.querySelectorAll('[data-log-action]').forEach(b=>b.disabled=locked||Boolean(logEdit));['service-log-editor-note','service-log-editor-save','service-log-editor-cancel'].forEach(id=>$(id).disabled=locked);$('service-log-editor-save').disabled=locked||Boolean(logEdit?.unavailable);$('service-test-log-mode').disabled=locked||dirty;$('service-copy-panel').hidden=testing||selected?.canEdit===false;document.querySelectorAll('[data-email-copy]').forEach(input=>input.disabled=locked||dirty||Boolean(logEdit)||testing);
 }
 const setBusy=value=>{busy=value;applyAccess();};
 $('service-edit').addEventListener('submit',async event=>{
  event.preventDefault();if(!selected||busy||logEdit||selected.canEdit===false&&selected.canAssign!==true)return;const r=selected,epoch=managerEpoch;setBusy(true);$('service-save-status').textContent='Saving update…';
  try{const result=await api('update',{id:r.id,version:r.version,status:r.canEdit===false?r.status:$('service-status').value,manager:$('service-manager').value,note:r.canEdit===false?'':$('service-note').value,publicNote:r.canEdit===false?'':$('service-public-note').value});if(epoch!==managerEpoch)return;dirty=false;if(!acceptSaved(result,r.id))await loadManager(r.id);if(r.manager!==result.request?.manager&&result.request?.manager)$('service-unassigned-dialog').close?.();$('service-save-status').textContent='Update saved.';}
  catch(error){if(epoch===managerEpoch){$('service-save-status').textContent=error.message;if([401,403].includes(error.status))clearManager();}}
  finally{setBusy(false);}
 });
 $('service-email').addEventListener('click',async()=>{
  if(!selected||busy||dirty||selected.canEdit===false)return;const r=selected,latest=r.updates.at(-1);if(!latest)return;
  const testing=$('service-email-mode').value==='test',logMode=testing?$('service-test-log-mode').value:$('service-email-mode').value;if(testing&&!r.canTestEmail)return;
  const cc=testing?[]:[...$('service-copy-choices').querySelectorAll('input:checked')].map(input=>input.value);
  if(!window.confirm((testing?'Send a TEST of ':'Email ')+(logMode==='entire'?'the entire client-facing log':'the most recent client-facing entry')+' to '+(testing?r.testEmail:r.email)+'?'+(cc.length?' Copy: '+cc.join(', ')+'.':'')+(testing?' The client will not be emailed.':'')))return;
  const epoch=managerEpoch;setBusy(true);$('service-save-status').textContent='Sending the saved client update…';
  try{const result=await api(testing?'test-email':'email',{id:r.id,version:r.version,eventId:latest.eventId,logMode,cc});if(epoch!==managerEpoch)return;if(!acceptSaved(result,r.id))await loadManager(r.id);$('service-save-status').textContent=testing?'Test log emailed to '+r.testEmail+'.':'Client log emailed.';}
  catch(error){if(epoch===managerEpoch){$('service-save-status').textContent=error.message;if(!testing&&[502,503].includes(error.status)&&selected){selected.emailStates={latest:selected.emailState,entire:selected.emailState,...selected.emailStates,[logMode]:'unknown'};selected.emailState=selected.emailStates.latest;}$('service-email').disabled=true;if([401,403].includes(error.status))clearManager();}}
  finally{setBusy(false);}
 });
 document.addEventListener('nest-auth-change',()=>{clearManager();flip(false);if(window.NestAuth?.identity?.signedIn)loadManager();});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 window.addEventListener('pagehide',()=>{clearManager();clearClient();});
 if(location.hash==='#client-relations')changeView('manage');else changeView('client');
 Promise.resolve(window.NestAuth?.ready).then(()=>{if(window.NestAuth?.identity?.signedIn&&!workspaceLoadedAt&&!managerLoad)loadManager();});
})();
