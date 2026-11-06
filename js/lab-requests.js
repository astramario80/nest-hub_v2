(() => {
 const $=id=>document.getElementById(id);if(!$('lab-form')||!window.NestAuth)return;
 const labels={pending:'Awaiting review',issued:'Pass issued',tabled:'Tabled',denied:'Denied','checked-in':'Checked in',archived:'Archived'};
 const mailLabels={'not-sent':'No notification sent',accepted:'Email accepted for delivery',sending:'Email outcome unconfirmed — review before sending again',unknown:'Email outcome unknown — review in NEST Communications',partial:'Some emails were accepted; review delivery in NEST Communications',rejected:'Email rejected — review in NEST Communications'};
 let config=null,page=0,selected=null,busy=false,generation=0,requestId=crypto.randomUUID(),attempt=null,pollTimer,view='current',closedPage=0,listVersion=0,searchTimer,calendars={};
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const option=(value,text)=>{const n=node('option',text);n.value=value;return n;};
 const signed=()=>window.NestAuth.identity?.signedIn===true;
 const timestamp=value=>new Date(value).toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
 async function api(operation,fields={},write=false){
  const response=await fetch('/api/lab-requests'+(write?'':'?'+new URLSearchParams({operation,...fields})),{method:write?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:write?{'Content-Type':'application/json'}:undefined,body:write?JSON.stringify({operation,...fields}):undefined,signal:AbortSignal.timeout(60000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'NEST™ Request submissions are unavailable.');return data;
 }
 function badge(state){const n=node('span',labels[state]||state);n.className='lab-badge';n.dataset.state=state;return n;}
 function close(){if(busy)return;const d=$('lab-detail');if(d.open)d.close();selected=null;attempt=null;$('lab-detail-fields').replaceChildren();$('lab-history').replaceChildren();$('lab-detail-status').textContent='';}
 function closeEvidence(){const viewer=$('lab-evidence-viewer');if(viewer.open)viewer.close();$('lab-evidence-frame').removeAttribute('src');}
 function clear(){closeEvidence();clearTimeout(pollTimer);clearTimeout(searchTimer);generation++;config=null;selected=null;attempt=null;busy=false;requestId=crypto.randomUUID();$('lab-content').hidden=true;$('lab-detail').close?.();$('lab-detail-fields').replaceChildren();$('lab-history').replaceChildren();$('lab-detail-status').textContent='';$('lab-rows').replaceChildren();$('lab-closed-rows').replaceChildren();$('lab-closed').open=false;$('lab-student').replaceChildren(option('','All students'));$('lab-year').replaceChildren();$('lab-calendar-year').replaceChildren();$('lab-search').value='';$('lab-trimester').value='';calendars={};listVersion++;$('lab-teachers').replaceChildren();$('lab-division').replaceChildren(option('','Choose your division'));$('lab-form').reset();$('lab-submit-status').textContent='A request becomes a pass only after approval.';$('lab-form-fields').disabled=false;$('lab-submit').disabled=false;$('lab-decision-fields').disabled=false;$('lab-status').textContent='Sign in to request a lab pass and view your visits.';$('lab-signin').hidden=signed();}
 function reasonFields(){
  const state=$('lab-action').value,needsReason=['tabled','denied'].includes(state);$('lab-reason-label').hidden=!needsReason;$('lab-reason').required=needsReason;
  $('lab-reason').replaceChildren(option('','Choose a reason'),...(config.reasons[state]||[]).map(v=>option(v,v)),option('Other','Other — write my own'));
  const needsTime=state==='issued'&&selected?.legacy&&!selected.time;$('lab-legacy-time-label').hidden=!needsTime;$('lab-legacy-time').required=needsTime;
  $('lab-custom-label').hidden=true;$('lab-custom').required=false;$('lab-custom').value='';attempt=null;
 }
 function renderDetail(record){
  selected=record;const dl=node('dl');
  for(const [label,value] of [['Student',record.name],['Visit',record.day+(record.time?' at '+record.time+' · Pacific':' · time not recorded')],['Division',record.division],['Goal',record.goal],['Sending teacher(s)',record.teachers.map(t=>t.name).join('; ')],...(config.owner?[['District email',record.email]]:[]),['Status',labels[record.state]||record.state],['School year',(record.schoolYear||'')+(record.dateNeedsReview?' · grouped by submission date; original visit date needs review':'')],['Trimester',record.trimester==='Unassigned'?'Dates not assigned':record.trimester||''],...(record.reason?[['Reason',record.reason]]:[]),...(record.checkedInAt?[['Arrival confirmed',timestamp(record.checkedInAt)]]:[]),['Pass reference',record.id]])dl.append(node('dt',label),node('dd',value));
  $('lab-detail-fields').replaceChildren(dl);
  if(record.dateNeedsReview){const warning=node('p','The original visit date appears incorrect. Archive filters use the submission date; the original date is preserved above.');warning.className='lab-warning';$('lab-detail-fields').append(warning);}if(record.source&&config.owner){const source=node('a','Open original form record ↗');source.href=record.source;source.target='_blank';source.rel='noopener noreferrer';source.className='lab-action-link';$('lab-detail-fields').append(source);}
  if(record.evidence&&config.owner){const link=node('button','Review grade screenshot');link.type='button';link.className='lab-action-link';link.addEventListener('click',()=>{const match=record.evidence.match(/^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view(?:[?#].*)?$/);if(!match)return;$('lab-evidence-frame').src='https://drive.google.com/file/d/'+match[1]+'/preview';$('lab-evidence-viewer').showModal();});$('lab-detail-fields').append(link);}
  const states=config.owner&&['pending','tabled','issued'].includes(record.state)?[...(record.state==='issued'&&record.day===config.today?['checked-in']:[]),...(record.state!=='issued'&&record.day>=config.today?['issued']:[]),'tabled','denied']:[];
  $('lab-decision').hidden=!states.length;$('lab-action').replaceChildren(option('','Choose an action'),...states.map(state=>option(state,state==='checked-in'?'Check in — student has arrived':state==='issued'?'Issue digital pass':state==='tabled'?'Table request':'Deny request')));reasonFields();
  $('lab-history').replaceChildren(...record.events.map(event=>node('li',timestamp(event.at)+' · '+labels[event.state]+(event.reason?' · '+event.reason:'')+' · '+(mailLabels[event.emailState]||'Delivery not confirmed'))));
  if(record.legacy)$('lab-history').prepend(node('li','Original Google Form status: '+record.legacyStatus+'. Original email and check-in timestamps are not fully recorded.'));
  if(!record.events.length&&!record.legacy)$('lab-history').append(node('li','Submitted '+timestamp(record.createdAt)+' · awaiting review'));
  if(config.owner&&record.adminNotification)$('lab-history').append(node('li','Request receipt emails: '+(mailLabels[record.adminNotification.emailState]||'Unconfirmed')));
  if(config.owner&&record.arrivalReminder)$('lab-history').append(node('li','Your arrival reminder: '+(mailLabels[record.arrivalReminder.emailState]||'Unconfirmed')));
  $('lab-detail-title').textContent=record.state==='issued'?'NEST™ digital pass':'NEST™ Request';
 }
 async function open(id){
  if(busy)return;const current=generation;$('lab-status').textContent='Opening request…';
  try{const data=await api('detail',{id});if(current!==generation)return;attempt=null;renderDetail(data.request);$('lab-detail-status').textContent='';if(!$('lab-detail').open)$('lab-detail').showModal();$('lab-status').textContent=config.owner?'NEST™ Request desk ready.':'Your requests are up to date.';}catch(error){if(current===generation)$('lab-status').textContent=error.message;}
 }
 function renderRows(records,target){
  $(target).replaceChildren(...records.map(record=>{const row=node('tr');row.append(node('td',record.name),node('td',record.day+' · '+(record.dateNeedsReview?'Review original date':record.time||'Time not recorded')));const state=node('td');state.append(badge(record.state));row.append(state);const cell=node('td'),button=node('button','View request');button.type='button';button.setAttribute('aria-label','View '+record.name+' · '+record.day);button.addEventListener('click',()=>open(record.id));cell.append(button);row.append(cell);return row;}));
 }
 function calendarFields(){const dates=calendars[$('lab-calendar-year').value]||[];['lab-term-start','lab-term-1','lab-term-2','lab-term-3'].forEach((id,i)=>$(id).value=dates[i]||'');}
 async function closedList(){if(!config||view!=='current'||!$('lab-closed').open)return;const current=generation,data=await api('list',{view:'current',filter:'closed',page:closedPage});if(current!==generation||view!=='current')return;renderRows(data.records,'lab-closed-rows');$('lab-closed-page').textContent='Page '+(closedPage+1);$('lab-closed-prev').disabled=closedPage===0;$('lab-closed-next').disabled=!data.hasMore;}
 async function list(){
  if(!config)return;const current=generation,version=++listVersion;
  const fields={page,view,filter:view==='current'?'open':$('lab-filter').value,year:$('lab-year').value||config.currentYear,trimester:view==='archive'?$('lab-trimester').value:'',search:view==='archive'?$('lab-search').value:'',student:view==='archive'?$('lab-student').value:''};
  const data=await api('list',fields);if(current!==generation||version!==listVersion)return;renderRows(data.records,'lab-rows');
  const year=$('lab-year').value,student=$('lab-student').value;
  $('lab-year').replaceChildren(...(data.years||[config.currentYear]).filter(Boolean).map(y=>option(y,y)),option('all','All school years'));$('lab-year').value=year||config.currentYear;
  $('lab-student').replaceChildren(option('','All students'),...(data.students||[]).map(x=>option(x.id,x.name)));$('lab-student').value=student;
  const calendarYear=$('lab-calendar-year').value;$('lab-calendar-year').replaceChildren(...(data.years||[config.currentYear]).filter(Boolean).map(y=>option(y,y)));$('lab-calendar-year').value=calendarYear||config.currentYear;calendars=data.calendars||{};if(!$('lab-calendar-editor').open)calendarFields();
  $('lab-count').textContent=data.total+(view==='current'?' open request':' request')+(data.total===1?'':'s');$('lab-empty').hidden=data.records.length!==0;$('lab-page').textContent='Page '+(page+1);$('lab-prev').disabled=page===0;$('lab-next').disabled=!data.hasMore;$('lab-closed-count').textContent='('+Number(data.closedCount||0)+')';
  $('lab-year-label').textContent=view==='current'?(config.currentYear||data.currentYear||'Current school year')+' · open requests first':(data.legacyWarning||'Browse requests across school years.');await closedList();
 }
 function changeView(next){view=next;page=0;closedPage=0;$('lab-archive-filters').hidden=next!=='archive';$('lab-filter-label').hidden=next!=='archive';$('lab-closed').hidden=next==='archive';$('lab-calendar-editor').hidden=next!=='archive'||!config?.owner;$('lab-current-tab').setAttribute('aria-pressed',String(next==='current'));$('lab-archive-tab').setAttribute('aria-pressed',String(next==='archive'));list().catch(e=>$('lab-status').textContent=e.message);}
 async function load(){
  if(busy)return;clear();if(!signed())return;const current=generation;$('lab-status').textContent='Loading the request desk…';
  try{const data=await api('bootstrap');if(current!==generation)return;config=data;$('lab-signin').hidden=true;$('lab-content').hidden=false;
   $('lab-teachers').replaceChildren(...data.staff.map(t=>option(t.id,t.name)));$('lab-division').append(...data.divisions.map(v=>option(v,v)));$('lab-day').min=data.today;
   $('lab-sync').hidden=!data.owner;$('lab-migrate').hidden=!data.owner||data.storage!=='spreadsheet';$('lab-desk-title').textContent=data.owner?'NEST™ Request desk':'My requests & passes';$('lab-desk-label').textContent=data.owner?'Review · issue · welcome':'Your visits';$('lab-filter').value='';page=0;view='current';closedPage=0;$('lab-current-tab').setAttribute('aria-pressed','true');$('lab-archive-tab').setAttribute('aria-pressed','false');$('lab-archive-filters').hidden=true;$('lab-filter-label').hidden=true;$('lab-closed').hidden=false;$('lab-calendar-editor').hidden=true;$('lab-student-label').hidden=!data.owner;
   $('lab-staff-status').textContent='Staff directory updated '+timestamp(data.staffSyncedAt)+(data.staffWarning?' · '+data.staffWarning:'')+(!data.dailySync?' · Daily sync could not be enabled. Use Sync staff now and contact the site administrator.':'');
   await list();if(current!==generation)return;$('lab-status').textContent=data.owner&&!data.reminderEmail?'Email reminder setup needs attention. Refresh or sync staff, then check this message again.':data.owner?'New requests and arrivals alert you here and at mpenalver@bethelsd.org. Email arrival reminders run within about five minutes of the scheduled time.':'Choose a time and tell us your plan. Your pass status appears above.';
   const id=new URLSearchParams(location.search).get('request');if(id)await open(id);schedulePoll();
  }catch(error){if(current===generation)$('lab-status').textContent=error.message;}
 }
 function schedulePoll(){clearTimeout(pollTimer);if(!config)return;pollTimer=setTimeout(async()=>{try{if(!busy&&!$('lab-detail').open&&document.visibilityState!=='hidden')await list();}catch{}schedulePoll();},30000);}
 function readImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('The screenshot could not be read.'));reader.onload=()=>resolve({type:file.type,data:String(reader.result).split(',')[1]});reader.readAsDataURL(file);});}
 $('lab-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!config||!$('lab-form').reportValidity())return;
  const file=$('lab-evidence').files[0],teachers=[...$('lab-teachers').selectedOptions].map(x=>x.value);if(!file||file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)||teachers.length>5){$('lab-submit-status').textContent='Choose up to five teachers and an image screenshot under 2 MB.';return;}
  const current=generation,fields=Object.fromEntries(new FormData($('lab-form')));busy=true;$('lab-form-fields').disabled=true;$('lab-submit').disabled=true;$('lab-submit-status').textContent='Sending your request…';
  try{const evidence=await readImage(file);if(current!==generation)return;const data=await api('submit',{requestId,firstName:fields.firstName,lastName:fields.lastName,division:fields.division,day:fields.day,time:fields.time,goal:fields.goal,teachers,gradeConfirmed:fields.gradeConfirmed==='on',evidence},true);if(current!==generation)return;
   requestId=crypto.randomUUID();$('lab-form').reset();$('lab-submit-status').textContent='Request received. Wait for an issued pass before leaving class.';page=0;$('lab-filter').value='';await list();renderDetail(data.request);$('lab-detail-status').textContent='Your request is awaiting review.';if(!$('lab-detail').open)$('lab-detail').showModal();window.NestLabAlerts?.check();
  }catch(error){if(current===generation)$('lab-submit-status').textContent=error.message;}finally{if(current===generation){busy=false;$('lab-form-fields').disabled=false;$('lab-submit').disabled=false;}}
 });
 $('lab-decision').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!selected||!$('lab-decision').reportValidity())return;
  const fields={id:selected.id,revision:selected.revision,state:$('lab-action').value,reason:$('lab-reason-label').hidden?'':$('lab-reason').value,customReason:$('lab-custom-label').hidden?'':$('lab-custom').value,...(!$('lab-legacy-time-label').hidden?{time:$('lab-legacy-time').value}:{})};
  const signature=JSON.stringify(fields);if(!attempt||attempt.signature!==signature)attempt={signature,eventId:crypto.randomUUID()};
  const current=generation;busy=true;$('lab-decision-fields').disabled=true;$('lab-detail-status').textContent='Saving and notifying the teacher…';
  try{const data=await api('decide',{...fields,eventId:attempt.eventId},true);if(current!==generation)return;renderDetail(data.request);attempt=null;const last=data.request.events.at(-1);$('lab-detail-status').textContent=labels[data.request.state]+'. '+(mailLabels[last?.emailState]||'Review email delivery status.');await list();window.NestLabAlerts?.check();}
  catch(error){if(current===generation)$('lab-detail-status').textContent=error.message;}
  finally{if(current===generation){busy=false;$('lab-decision-fields').disabled=false;}}
 });
 $('lab-action').addEventListener('change',reasonFields);$('lab-reason').addEventListener('change',()=>{const custom=$('lab-reason').value==='Other';$('lab-custom-label').hidden=!custom;$('lab-custom').required=custom;attempt=null;});
 $('lab-evidence-close').addEventListener('click',closeEvidence);$('lab-evidence-viewer').addEventListener('close',()=>{$('lab-evidence-frame').removeAttribute('src');});
 $('lab-close').addEventListener('click',close);$('lab-detail').addEventListener('cancel',event=>{if(busy)event.preventDefault();else close();});
 $('lab-current-tab').addEventListener('click',()=>changeView('current'));$('lab-archive-tab').addEventListener('click',()=>changeView('archive'));
 for(const id of ['lab-year','lab-trimester','lab-student'])$(id).addEventListener('change',()=>{page=0;list().catch(e=>$('lab-status').textContent=e.message);});
 $('lab-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;list().catch(e=>$('lab-status').textContent=e.message);},300);});
 $('lab-closed').addEventListener('toggle',()=>closedList().catch(e=>$('lab-status').textContent=e.message));
 for(const [id,delta] of [['lab-closed-prev',-1],['lab-closed-next',1]])$(id).addEventListener('click',()=>{closedPage+=delta;closedList().catch(e=>$('lab-status').textContent=e.message);});
 $('lab-calendar-year').addEventListener('change',calendarFields);
 $('lab-calendar-form').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;const current=generation;try{await api('calendar',{year:$('lab-calendar-year').value,dates:['lab-term-start','lab-term-1','lab-term-2','lab-term-3'].map(id=>$(id).value)},true);if(current!==generation)return;$('lab-calendar-status').textContent='Trimester dates saved.';await list();}catch(error){if(current===generation)$('lab-calendar-status').textContent=error.message;}finally{if(current===generation)busy=false;}});
 $('lab-filter').addEventListener('change',()=>{page=0;list().catch(e=>$('lab-status').textContent=e.message);});
 for(const [id,delta] of [['lab-prev',-1],['lab-next',1]])$(id).addEventListener('click',()=>{page+=delta;list().catch(e=>$('lab-status').textContent=e.message);});
 $('lab-signin').addEventListener('click',()=>window.NestAuth.open());$('lab-reload').addEventListener('click',()=>{if(busy)return;if(config){list().then(()=>selected?open(selected.id):null).catch(e=>$('lab-status').textContent=e.message);}else load();});
 $('lab-migrate').addEventListener('click',async()=>{if(busy)return;busy=true;const current=generation;$('lab-migrate').disabled=true;$('lab-status').textContent='Moving and verifying the private archive…';try{const result=await api('migrate-storage',{},true);if(current!==generation)return;busy=false;await load();if(current===generation||config)$('lab-status').textContent='Private website archive verified · '+result.count+' requests migrated. The old request workbook is disconnected.';}catch(error){if(current===generation)$('lab-status').textContent=error.message;}finally{busy=false;$('lab-migrate').disabled=false;}});
 $('lab-sync').addEventListener('click',async()=>{if(busy)return;busy=true;const current=generation;try{await api('sync-staff',{},true);if(current===generation){busy=false;await load();}}catch(e){if(current===generation)$('lab-status').textContent=e.message;}finally{if(current===generation)busy=false;}});
 document.addEventListener('nest-auth-change',()=>{clear();load();});window.NestAuth.ready.then(load);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&config&&!busy){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(config.today!==day){config.today=day;$('lab-day').min=day;}list().catch(()=>{});}});
 document.addEventListener('nest-lab-checkin',()=>{if(config&&!busy)list().catch(()=>{});});
 window.NestLabRequests={api,open};
})();
