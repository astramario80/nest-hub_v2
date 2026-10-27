// Private workbook; roles and client ownership are enforced before returning data.
const SERVICE_SOURCE='1hSTOG16yGajUsrlywCHThvbMx9JHXQzmpAN43yzAXb0';
const SERVICE_LOG='ServiceWebLog';
const SERVICE_STATUSES=['New!','Assigned','In Progress','Completed','Closed'];
function serviceRole_(email,leaders){
 if(OWNER_EMAILS.includes(email_(email)))return true;
 return leaders.some(row=>{
  const period=String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase();
  const role=String(row[2]||'').trim().toLowerCase().replace(/\s+/g,' ');
  return email_(row[4])===memberEmail_(email,period)&&
   (['division manager','assistant manager','director of client relations','client relations director'].includes(role)||
    period==='CTSO'&&/^(chief (executive|financial|operations) officers?|executive vice[ -]president)$/.test(role));
 });
}
function serviceColumns_(headers){
 const find=pattern=>headers.findIndex(h=>pattern.test(String(h||'').trim()));
 return {id:find(/^Request ID$/i),status:find(/^Status$/i),manager:find(/^Project Manager$/i),log:find(/^(Log|Project Notes)$/i),
  created:find(/^Timestamp$/i),email:find(/^Email Address$/i),name:find(/^(Choose your name|Please share your first and last name)/i),
  fallbackName:find(/^If you don't see your name/i),phone:find(/phone number/i),room:find(/room can we find/i),
  category:find(/category of your request/i),urgency:find(/How fast do you need/i),description:find(/describe the problem/i),attachment:find(/picture or video/i)};
}
function serviceLeaders_(){return Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];}
function serviceQuote_(value){return "'"+value.replace(/'/g,"''")+"'";}
function serviceRead_(){
 const meta=Sheets.Spreadsheets.get(SERVICE_SOURCE,{fields:'sheets(properties)'});
 const tabs=(meta.sheets||[]).map(s=>s.properties),names=['ServiceRequests','Closed Tickets'];
 const ticketTabs=names.map(name=>tabs.find(t=>t.title===name));
 const logTab=tabs.find(t=>t.title===SERVICE_LOG);
 if(ticketTabs.some(t=>!t)||!logTab)throw new Error('SERVICE_SETUP_REQUIRED');
 if(ticketTabs.some(t=>t.gridProperties.rowCount>10000)||logTab.gridProperties.rowCount>30000)throw new Error('Service data capacity requires review');
 const ranges=ticketTabs.map(tab=>serviceQuote_(tab.title)+'!A1:'+serviceColumnLetter_(Math.min(tab.gridProperties.columnCount,52))+Math.min(tab.gridProperties.rowCount,10000));
 ranges.push(serviceQuote_(SERVICE_LOG)+'!A2:J'+Math.min(logTab.gridProperties.rowCount,30000));
 const batch=typeof Sheets.Spreadsheets.Values.batchGet==='function'?Sheets.Spreadsheets.Values.batchGet(SERVICE_SOURCE,{ranges,valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges:null;
 if(batch&&batch.length!==3)throw new Error('Service data unavailable');
 const requests=[];
 ticketTabs.forEach((tab,index)=>{
  const rows=batch?(batch[index].values||[]):(Sheets.Spreadsheets.Values.get(SERVICE_SOURCE,ranges[index],{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]);
  const headers=rows[0]||[],c=serviceColumns_(headers);tab.headers=headers;
  if(['id','status','manager','log','created','email','description'].some(k=>c[k]<0))throw new Error('SERVICE_SETUP_REQUIRED');
  rows.slice(1).forEach((raw,index)=>{
   if(!raw.some(value=>value!==''&&value!=null))return;
   const id=String(raw[c.id]||'');if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('SERVICE_SETUP_REQUIRED');
   const text=key=>String(raw[c[key]]??'');
   const created=raw[c.created],serial=typeof created==='number'?created:NaN;
   const createdDate=Number.isFinite(serial)?new Date((serial-25569)*86400000):new Date(String(created));
   requests.push({id,version:hash_(JSON.stringify(raw)),status:text('status'),manager:text('manager'),email:email_(text('email')),
    name:text('fallbackName')||text('name'),phone:text('phone'),room:text('room'),category:text('category'),urgency:text('urgency'),description:text('description'),attachment:text('attachment'),
    created:Number.isFinite(createdDate.getTime())?createdDate.toISOString():'',createdMs:createdDate.getTime(),legacyLog:text('log'),tab,c,row:index+2,raw,headers});
  });
 });
 const ids=new Set();requests.forEach(r=>{if(ids.has(r.id))throw new Error('Duplicate request ID');ids.add(r.id);});
 const events=batch?(batch[2].values||[]):(Sheets.Spreadsheets.Values.get(SERVICE_SOURCE,ranges[2]).values||[]);
 if(events.length>29995)throw new Error('Service event capacity requires review');
 requests.forEach(item=>{item.members=serviceStoredMembers_(item,events);item.version=serviceVersion_(item.raw,events.filter(e=>e[1]===item.id).slice(-1)[0]||[]);});
 return {requests,events,logTab,tabs};
}
function serviceColumnLetter_(number){let value='';while(number){number--;value=String.fromCharCode(65+number%26)+value;number=Math.floor(number/26);}return value;}
// Original events remain immutable; revisions alter only the chosen visible note.
function serviceLogEntries_(item,events){
 const entries=new Map();
 events.filter(e=>e[1]===item.id).forEach(e=>{
  if(e[2]==='update'){entries.set(String(e[6]),{entryId:String(e[6]),time:String(e[0]),actor:String(e[3]),status:String(e[4]),manager:String(e[8]||''),publicNote:String(e[5]||''),internalNote:String(e[9]||''),publicRevision:String(e[6]),internalRevision:String(e[6]),publicDeleted:false,internalDeleted:false});return;}
  const match=String(e[2]).match(/^(edit|delete)-(public|internal)$/),entry=entries.get(String(e[6]));if(!match||!entry)return;
  const scope=match[2];entry[scope+'Note']=match[1]==='delete'?'':String(e[scope==='public'?5:9]||'');entry[scope+'Deleted']=match[1]==='delete';entry[scope+'Revision']=String(e[8]);entry[scope+'UpdatedAt']=String(e[0]);
 });return [...entries.values()];
}
function serviceEntryVersion_(entry,scope){return hash_(JSON.stringify([entry.entryId,scope,entry[scope+'Note'],entry[scope+'Deleted'],entry[scope+'Revision']]));}
function serviceEntryEmailed_(item,entry,events){
 const revisions=new Set([entry.entryId,...events.filter(e=>e[1]===item.id&&e[6]===entry.entryId&&e[2]==='edit-public').map(e=>e[8])]);
 return events.some(e=>e[1]===item.id&&e[2]==='email'&&['sent','sending','unknown'].includes(e[7])&&(revisions.has(e[6])||e[8]==='entire'&&String(e[0])>=entry.time));
}
function serviceUpdates_(item,events){return serviceLogEntries_(item,events).filter(e=>!e.publicDeleted&&e.publicNote).map(e=>({time:e.time,status:e.status,note:e.publicNote,eventId:e.publicRevision,entryId:e.entryId,entryVersion:serviceEntryVersion_(e,'public'),updatedAt:e.publicUpdatedAt||'',emailed:serviceEntryEmailed_(item,e,events)}));}
function serviceLogBlock_(entry,note){return entry.time+' — '+entry.actor+'\nStatus: '+entry.status+'; Project Manager: '+(entry.manager||'Unassigned')+(note?'\n'+note:'');}
function serviceLegacyLog_(item,events){
 let legacy=item.legacyLog;
 serviceLogEntries_(item,events).forEach(entry=>{
  const source=events.find(e=>e[1]===item.id&&e[2]==='update'&&e[6]===entry.entryId),notes=new Set([String(source?.[9]||''),entry.internalNote,...events.filter(e=>e[1]===item.id&&e[6]===entry.entryId&&e[2]==='edit-internal').map(e=>String(e[9]||''))]);
  [...notes].sort((a,b)=>b.length-a.length).forEach(note=>{legacy=legacy.replace(serviceLogBlock_(entry,note)+'\n\n','');});
 });return legacy;
}
function serviceVisibleLog_(item,events){const blocks=serviceLogEntries_(item,events).filter(e=>!e.internalDeleted).reverse().map(e=>serviceLogBlock_(e,e.internalNote)+'\n\n');return blocks.join('')+serviceLegacyLog_(item,events);}
function serviceLogAudit_(item,events){
 const notes=new Map(),audit=[];
 events.filter(e=>e[1]===item.id).forEach(e=>{
  if(e[2]==='update'){notes.set(String(e[6]),{public:String(e[5]||''),internal:String(e[9]||'')});return;}
  const match=String(e[2]).match(/^(edit|delete)-(public|internal)$/),entry=notes.get(String(e[6]));if(!match||!entry)return;
  const scope=match[2],note=match[1]==='delete'?'':String(e[scope==='public'?5:9]||'');audit.push({time:String(e[0]),actor:String(e[3]),action:match[1],scope,entryId:String(e[6]),previousNote:entry[scope],note});entry[scope]=note;
 });return audit;
}
function serviceClosedAt_(item,events){if(item.status!=='Closed')return '';const event=events.filter(e=>e[1]===item.id&&e[2]==='update'&&e[4]==='Closed').slice(-1)[0];return event&&Number.isFinite(Date.parse(event[0]))?new Date(event[0]).toISOString():'';}
function serviceParticipation_(item,events,roster){const labels=[item.manager,...events.filter(e=>e[1]===item.id&&e[2]==='update'&&e[8]).map(e=>e[8])];return [...new Set(labels.map(manager=>serviceAssignment_({manager},roster)).filter(Boolean).map(m=>hash_(m.email+':'+m.period)))];}
function serviceStudentRows_(roster){return roster.map(m=>({key:hash_(m.email+':'+m.period),name:m.label.replace(/\s*\(Period\s+[^)]+\)$/i,''),manager:m.label,division:'Period '+m.period}));}
function serviceClientRow_(item,events){return {id:item.id,status:item.status,created:item.created,description:item.description,category:item.category,room:item.room,manager:item.manager,updates:serviceUpdates_(item,events)};}
function serviceEmailKey_(item,events,mode){
 const entries=serviceUpdates_(item,events),last=entries.slice(-1)[0];if(!last)return '';
 if(mode==='entire'&&events.some(e=>e[1]===item.id&&/^(edit|delete)-public$/.test(e[2])))return hash_(JSON.stringify(entries.map(e=>[e.entryId,e.eventId,e.note])));
 return last.eventId;
}
function serviceEmailState_(item,events,mode){
 mode=mode||'latest';const key=serviceEmailKey_(item,events,mode);if(!key)return 'none';
 return String(events.filter(e=>e[1]===item.id&&e[2]==='email'&&e[6]===key&&(e[8]==='entire'?'entire':'latest')===mode).slice(-1)[0]?.[7]||'unsent');
}
function serviceRoster_(){
 const periods=Object.keys(PERIODS),all=[];
 // Read all current divisions together; writes still use an uncached current roster.
 const batch=typeof Sheets.Spreadsheets.Values.batchGet==='function'?Sheets.Spreadsheets.Values.batchGet(NEST_DATABASE,{ranges:periods.map(p=>serviceQuote_(p==='CTSO'?'CTSO':'Period '+p)+'!A2:C1000')}).valueRanges:null;
 if(batch&&batch.length!==periods.length)throw new Error('Roster unavailable');
 periods.forEach((period,index)=>{
  const rows=batch?(batch[index].values||[]).filter(r=>r[0]&&/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email_(r[2]))).map(r=>[String(r[0]).trim(),email_(r[2])]):rows_(period);
  rows.forEach(row=>{if(email_(row[1]))all.push({email:email_(row[1]),label:row[0]+' (Period '+period+')',period:String(period).toUpperCase()});});
 });return all;
}
function serviceManagers_(){return serviceRoster_();}
function serviceAssignment_(item,roster){
 const label=String(item.manager||'').trim().toLowerCase();
 const matches=roster.filter(m=>m.label.trim().toLowerCase()===label||m.email===label);
 return matches.length===1?matches[0]:null;
}
function serviceDivisionLeader_(email,leaders){return leaders.some(row=>['division manager','assistant manager','director of client relations','client relations director'].includes(String(row[2]||'').trim().toLowerCase().replace(/\s+/g,' '))&&email_(row[4])===memberEmail_(email,String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase()));}
// Membership snapshots live in the existing append-only service event sheet.
function serviceStoredMembers_(item,events){
 const event=events.filter(e=>e[1]===item.id&&e[2]==='members').slice(-1)[0];if(!event)return [];
 const members=JSON.parse(event[9]||'[]');if(!Array.isArray(members)||members.some(m=>typeof m.email!=='string'||typeof m.label!=='string'))throw new Error('Invalid project membership');return members;
}
function serviceCurrentMembers_(item,roster){return (item.members||[]).map(member=>roster.find(m=>m.email===member.email)||member);}
function serviceMemberHistory_(item,events){return events.filter(e=>e[1]===item.id&&e[2]==='members').map(e=>({time:String(e[0]),actor:String(e[3]),note:String(e[5])}));}
function serviceCanAssignMembers_(email,item,leaders,roster){
 const assigned=serviceAssignment_(item,roster);if(!assigned)return false;
 if(OWNER_EMAILS.includes(email_(email))||assigned.email===memberEmail_(email,assigned.period))return true;
 return leaders.some(row=>String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase()===assigned.period&&['division manager','assistant manager','director of client relations','client relations director'].includes(String(row[2]||'').trim().toLowerCase().replace(/\s+/g,' '))&&email_(row[4])===memberEmail_(email,assigned.period));
}
function serviceTicketAccess_(email,item,leaders,roster){
 if(OWNER_EMAILS.includes(email_(email)))return {canEdit:true,canAssign:true,canChangeStatus:true,period:''};
 const canChangeAnyStatus=leaders.some(row=>['division manager','director of client relations','client relations director'].includes(String(row[2]||'').trim().toLowerCase().replace(/\s+/g,' '))&&email_(row[4])===memberEmail_(email,String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase()));
 const assigned=serviceAssignment_(item,roster);if(!assigned)return {canEdit:false,canChangeStatus:canChangeAnyStatus,canAssign:!String(item.manager||'').trim()&&item.status!=='Closed'&&serviceDivisionLeader_(email,leaders),period:''};
 const member=(item.members||[]).some(m=>roster.some(student=>student.email===m.email&&student.email===memberEmail_(email,student.period)));
 const divisionLeader=leaders.some(row=>String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase()===assigned.period&&['division manager','assistant manager','director of client relations','client relations director'].includes(String(row[2]||'').trim().toLowerCase().replace(/\s+/g,' '))&&email_(row[4])===memberEmail_(email,assigned.period));
 return {canEdit:member||divisionLeader||assigned.email===memberEmail_(email,assigned.period),canChangeStatus:member||canChangeAnyStatus||divisionLeader||assigned.email===memberEmail_(email,assigned.period),canAssign:divisionLeader,period:assigned.period};
}
function serviceCanManageNote_(entry,email){return OWNER_EMAILS.includes(email_(email))||email_(entry.actor)===email_(email);}
function serviceMetrics_(requests,leaders){
 leaders=leaders||serviceLeaders_();const groups=new Map();
 requests.forEach(r=>{
  const name=r.manager||'Unassigned';if(!groups.has(name)){
   const match=name.match(/\(Period\s+(\d+|CTSO)\)/i),period=match?match[1].toUpperCase():'';
   const leader=role=>String(leaders.find(row=>String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase()===period&&String(row[2]||'').trim().toLowerCase()===role)?.[3]||'');
   groups.set(name,{manager:name,division:period?'Period '+period:'Unassigned',clientRelationsDirector:leader('director of client relations'),divisionManager:leader('division manager'),total:0,open:0,closed:0,days:[],clients:new Set()});
  }
  const g=groups.get(name);g.total++;if(r.status==='Closed')g.closed++;else{g.open++;if(Number.isFinite(r.createdMs))g.days.push(Math.max(0,Math.floor((Date.now()-r.createdMs)/86400000)));}if(r.email)g.clients.add(r.email);
 });
 return [...groups.values()].map(g=>({manager:g.manager,division:g.division,clientRelationsDirector:g.clientRelationsDirector,divisionManager:g.divisionManager,total:g.total,open:g.open,closed:g.closed,averageDaysOpen:g.days.length?Math.round(g.days.reduce((a,b)=>a+b,0)/g.days.length*10)/10:0,clientsHelped:g.clients.size}));
}
function serviceManage_(operation,email){
 const leaders=serviceLeaders_(),globalView=email==null||serviceRole_(email,leaders);

 if(operation==='reviews'){
  if(!globalView)return {status:403};
  const rows=Sheets.Spreadsheets.Values.get(SERVICE_SOURCE,"'ClientReviews'!A1:O5000",{valueRenderOption:'FORMATTED_VALUE'}).values||[];
  return {status:200,columns:rows[0]||[],rows:rows.slice(1).filter(r=>r.some(Boolean))};
 }
 const state=serviceRead_(),roster=serviceRoster_();
 if(!globalView)state.requests=state.requests.filter(r=>serviceTicketAccess_(email,r,leaders,roster).canEdit);
 if(!globalView&&!state.requests.length)return {status:403};
 const visibleRoster=globalView?roster:roster.filter(m=>m.email===memberEmail_(email,m.period));
 if(operation==='metrics'){
  return {status:200,metrics:serviceMetrics_(state.requests,leaders),students:serviceStudentRows_(visibleRoster),trimester:serviceCurrentTrimester_()};
 }
 return {status:200,metrics:serviceMetrics_(state.requests,leaders),students:serviceStudentRows_(visibleRoster),trimester:serviceCurrentTrimester_(),canReview:globalView,managers:globalView?roster:[],requests:state.requests.map(r=>{
  return serviceManagerRow_(r,state.events,email,leaders,roster);
 })};
}
function serviceCopyChoices_(item,email,leaders,roster){
 const assigned=serviceAssignment_(item,roster),owner=OWNER_EMAILS.includes(email_(email)),seen=new Set();
 return leaders.flatMap(row=>{const period=String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase(),address=email_(row[4]);
  if(!owner&&period!==assigned?.period||!row[2]||!/^([^\s@,;<>]+)@(students\.)?bethelsd\.org$/.test(address)||seen.has(address))return [];seen.add(address);
  return [{email:address,label:[String(row[3]||address),String(row[2]),'Period '+period].join(' · ')}];
 });
}
function serviceEmailHistory_(item,events){return events.filter(e=>e[1]===item.id&&['email','email-test'].includes(e[2])&&['sent','unknown'].includes(e[7])).map(e=>{
 let meta={};try{meta=JSON.parse(e[9]||'{}');}catch(_){}
 return {time:String(e[0]),actor:String(e[3]),state:String(e[7]),testing:e[2]==='email-test',mode:e[8]==='entire'?'entire':'latest',to:meta.to||(e[2]==='email-test'?String(e[3]):item.email),cc:Array.isArray(meta.cc)?meta.cc:[]};
 });}
function serviceActors_(events,roster,leaders){
 const actors={};for(const event of events){const actor=email_(event[3]);if(!actor||actors[actor])continue;
  const student=roster.find(m=>m.email===memberEmail_(actor,m.period)),leader=leaders.find(row=>email_(row[4])===actor);
  let name=student?.label?.replace(/\s*\(Period\s+[^)]+\)$/i,'')||String(leader?.[3]||'').trim(),address=student?.email||actor;
  if(!name&&['mario@memberhq.net','mpenalver@bethelsd.org','astramario@gmail.com'].includes(actor))name='Mario Penalver';
  if(!name){for(const entry of events.filter(e=>e[2]==='members')){try{const saved=JSON.parse(entry[9]||'[]').find(m=>m.email===actor);if(saved){name=saved.label.replace(/\s*\(Period\s+[^)]+\)$/i,'');break;}}catch(_){}}}
  if(name)actors[actor]={name,email:address};
 }return actors;
}
function serviceManagerRow_(r,events,email,leaders,roster){
  const access=serviceTicketAccess_(email,r,leaders,roster),assignmentChoices=access.canAssign?roster.filter(m=>OWNER_EMAILS.includes(email_(email))||!String(r.manager||'').trim()||m.period===access.period):[];
  const noteEntries=serviceLogEntries_(r,events),authors=new Map(noteEntries.map(entry=>[entry.entryId,entry]));
  return {...serviceClientRow_(r,events),actors:serviceActors_(events.filter(e=>e[1]===r.id),roster,leaders),members:serviceCurrentMembers_(r,roster),canAssignMembers:serviceCanAssignMembers_(email,r,leaders,roster),memberChoices:serviceCanAssignMembers_(email,r,leaders,roster)?[...new Map(roster.filter(m=>/@students\.bethelsd\.org$/.test(m.email)).map(m=>[m.email,m])).values()]:[],memberHistory:serviceMemberHistory_(r,events),updates:serviceUpdates_(r,events).map(e=>({...e,actor:authors.get(e.entryId)?.actor||'',canManageNote:access.canEdit&&serviceCanManageNote_(authors.get(e.entryId),email)})),copyChoices:access.canEdit?serviceCopyChoices_(r,email,leaders,roster):[],emailHistory:serviceEmailHistory_(r,events),closedAt:serviceClosedAt_(r,events),participantKeys:serviceParticipation_(r,events,roster),...access,canTestEmail:OWNER_EMAILS.includes(email_(email)),testEmail:OWNER_EMAILS.includes(email_(email))?email_(email):'',testEmailState:OWNER_EMAILS.includes(email_(email))?String(events.filter(e=>e[1]===r.id&&e[2]==='email-test'&&e[3]===email_(email)).slice(-1)[0]?.[7]||'none'):'none',assignmentChoices,version:r.version,email:r.email,name:r.name,phone:r.phone,urgency:r.urgency,attachment:r.attachment,legacyLog:serviceLegacyLog_(r,events),logAudit:serviceLogAudit_(r,events),emailState:serviceEmailState_(r,events),emailStates:{latest:serviceEmailState_(r,events,'latest'),entire:serviceEmailState_(r,events,'entire')},internalUpdates:noteEntries.filter(e=>!e.internalDeleted).map(e=>({time:e.time,actor:e.actor,note:e.internalNote,status:e.status,manager:e.manager,entryId:e.entryId,entryVersion:serviceEntryVersion_(e,'internal'),canManageNote:access.canEdit&&serviceCanManageNote_(e,email),updatedAt:e.internalUpdatedAt||''}))};
}
function serviceEmailMessage_(item,events,mode,roster){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const stamp=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Not recorded';};
 const entries=serviceUpdates_(item,events),chosen=mode==='entire'?entries:entries.slice(-1),title=mode==='entire'?'The entire client-facing log':'The most recent log entry';
 const assigned=serviceAssignment_(item,roster||serviceRoster_()),managerEmail=assigned&&/^[a-z0-9._+-]+@(students\.)?bethelsd\.org$/.test(assigned.email)?assigned.email:'';
 const projectMembers=serviceCurrentMembers_(item,roster||serviceRoster_());
 const fields=[['Client',item.name],['Client email',item.email],['Contact phone',item.phone],['Submitted',stamp(item.created)],['Room',item.room],['Category',item.category],['Urgency',item.urgency],['Project manager',item.manager||'Unassigned'],['Project members',projectMembers.map(m=>m.label).join(', ')],['Current status',item.status]].filter(pair=>pair[1]);
 const attachments=String(item.attachment||'').split(/,\s*/).filter(value=>/^https:\/\/drive\.google\.com\//.test(value)&&!/[\s<>"']/.test(value));
 const summary=fields.map(pair=>pair[0]+': '+pair[1]).join('\n')+'\nRequest: '+(item.description||'Not recorded')+(attachments.length?'\nAttachments: '+attachments.join(', '):'');
 const log=chosen.map(e=>stamp(e.time)+' · '+e.status+'\n'+e.note).join('\n\n'),link='https://gknest.org/service';
 const panel='<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #c8cbbf;border-radius:8px;background:#f5f6f1;margin:20px 0"><tr><td style="padding:20px"><h2 style="font-size:18px;margin:0 0 16px">'+title+'</h2>'+chosen.map(e=>'<div style="border-left:3px solid #d1ac68;padding:8px 16px;margin:16px 0"><p style="font-size:13px">'+escape(stamp(e.time))+' · '+escape(e.status)+'</p><p style="white-space:pre-wrap">'+escape(e.note).replace(/\r?\n/g,'<br>')+'</p></div>').join('')+'</td></tr></table>';
 return {body:'Service request '+item.id.slice(0,8).toUpperCase()+'\n\nOriginal request details\n'+summary+'\n\n========== '+title+' ==========\n\n'+log+'\n\n========================================\nView your requests securely: '+link+(item.status==='Closed'?'\nShare your feedback: https://forms.gle/J3xe3qBiy7mReFLq6':''),
 htmlBody:'<!doctype html><html><body style="margin:0;background:#f4f4f1;font-family:Arial,sans-serif;color:#25251f"><div style="max-width:640px;margin:auto;background:white"><a href="'+link+'"><img src="https://gknest.org/assets/nest-service-banner.png" alt="NEST™ — New Economy Skills Training" width="640" style="display:block;width:100%;max-width:640px;height:auto;border:0"></a><div style="padding:24px"><h1 style="font-size:22px">Service request '+escape(item.id.slice(0,8).toUpperCase())+'</h1><h2 style="font-size:18px">Original request details</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">'+fields.map(pair=>'<tr><td style="padding:5px 10px 5px 0;vertical-align:top;width:135px;font-weight:bold">'+escape(pair[0])+'</td><td style="padding:5px 0;overflow-wrap:anywhere">'+(pair[0]==='Project manager'&&managerEmail?'<a href="mailto:'+escape(managerEmail)+'">'+escape(pair[1])+'</a>':pair[0]==='Project members'?projectMembers.map(m=>'<a href="mailto:'+escape(m.email)+'">'+escape(m.label)+'</a>').join('<br>'):escape(pair[1]))+'</td></tr>').join('')+'</table><p style="font-weight:bold;margin-bottom:6px">Request</p><p style="white-space:pre-wrap;margin-top:0">'+escape(item.description||'Not recorded').replace(/\r?\n/g,'<br>')+'</p>'+(attachments.length?'<p>Attachments: '+attachments.map((url,i)=>'<a href="'+escape(url)+'">Attachment '+(i+1)+'</a>').join(' · ')+'</p>':'')+panel+'<p><a href="'+link+'">View your request in NEST™</a></p>'+(item.status==='Closed'?'<p><a href="https://forms.gle/J3xe3qBiy7mReFLq6">Share your feedback</a></p>':'')+'</div></div></body></html>'};
}
function serviceStoredRow_(row){const copy=[...row];while(copy.length&&(copy[copy.length-1]===''||copy[copy.length-1]==null))copy.pop();return copy;}
function serviceVersion_(raw,event){return hash_(JSON.stringify([serviceStoredRow_(raw),serviceStoredRow_(event)]));}
function serviceCell_(value){return {userEnteredValue:typeof value==='number'?{numberValue:value}:typeof value==='boolean'?{boolValue:value}:{stringValue:String(value??'')}};}
function serviceAppend_(tab,values){return {appendCells:{sheetId:tab.sheetId,rows:[{values:values.map(serviceCell_)}],fields:'userEnteredValue'}};}
function serviceUpdateCell_(item,column,value){return {updateCells:{range:{sheetId:item.tab.sheetId,startRowIndex:item.row-1,endRowIndex:item.row,startColumnIndex:column,endColumnIndex:column+1},rows:[{values:[serviceCell_(value)]}],fields:'userEnteredValue'}};}
function serviceWrite_(email,r){
 const state=serviceRead_(),item=state.requests.find(x=>x.id===r.id);if(!item)return {status:404};
 const leaders=serviceLeaders_(),roster=serviceRoster_(),access=serviceTicketAccess_(email,item,leaders,roster);
 if(!access.canEdit&&!((access.canAssign||access.canChangeStatus)&&r.action==='auth-service-update'))return {status:403};if(item.version!==r.version)return {status:409};
 const now=new Date().toISOString();
 if(r.action==='auth-service-members'){
  if(!serviceCanAssignMembers_(email,item,leaders,roster))return {status:403};
  if(!Array.isArray(r.members)||r.members.some(v=>typeof v!=='string'||!/^\S+@students\.bethelsd\.org$/.test(v)))return {status:400};
  const addresses=[...new Set(r.members.map(email_))].sort(),members=addresses.map(address=>roster.find(m=>m.email===address));
  if(members.some(m=>!m)||JSON.stringify(members).length>45000)return {status:400};
  const previous=item.members||[],added=members.filter(m=>!previous.some(p=>p.email===m.email)),removed=previous.filter(m=>!members.some(p=>p.email===m.email));
  if(!added.length&&!removed.length)return {status:200,request:serviceManagerRow_(item,state.events,email,leaders,roster)};
  const note=[added.length?'Project members added: '+added.map(m=>m.label).join('; '):'',removed.length?'Project members removed: '+removed.map(m=>m.label).join('; '):''].filter(Boolean).join('\n');
  const eventId=Utilities.getUuid(),event=[now,item.id,'members',email,item.status,note,eventId,'',item.manager,JSON.stringify(members)],raw=[...item.raw];
  raw[item.c.log]=now+' — '+email+'\n'+note+'\n\n'+item.legacyLog;
  Sheets.Spreadsheets.batchUpdate({requests:[serviceAppend_(state.logTab,event),serviceUpdateCell_(item,item.c.log,raw[item.c.log])]},SERVICE_SOURCE);
  const updated={...item,members,raw,legacyLog:raw[item.c.log],version:serviceVersion_(raw,event)};
  return {status:200,eventId,request:serviceManagerRow_(updated,[...state.events,event],email,leaders,roster)};
 }
 if(['auth-service-edit-log' ,'auth-service-delete-log'].includes(r.action)){
  if(!['public','internal'].includes(r.scope)||!/^[a-f0-9-]{36}$/.test(r.eventId||'')||!/^[a-f0-9]{64}$/.test(r.entryVersion||''))return {status:400};
  const entry=serviceLogEntries_(item,state.events).find(e=>e.entryId===r.eventId);if(!entry)return {status:404};
  if(!serviceCanManageNote_(entry,email))return {status:403};
  if(entry[r.scope+'Deleted']||!entry[r.scope+'Note']||serviceEntryVersion_(entry,r.scope)!==r.entryVersion)return {status:409};
  const deleting=r.action==='auth-service-delete-log';
  if(!deleting&&(typeof r.note!=='string'||!r.note.trim()||r.note.length>2000||r.note.trim()===entry[r.scope+'Note']))return {status:400};
  const revisionId=Utilities.getUuid(),note=deleting?'':r.note.trim(),event=[now,item.id,(deleting?'delete':'edit')+'-'+r.scope,email,item.status,r.scope==='public'?note:'',entry.entryId,'',revisionId,r.scope==='internal'?note:''];
  const events=[...state.events,event],raw=[...item.raw];raw[item.c.log]=serviceVisibleLog_(item,events);
  Sheets.Spreadsheets.batchUpdate({requests:[serviceAppend_(state.logTab,event),serviceUpdateCell_(item,item.c.log,raw[item.c.log])]},SERVICE_SOURCE);
  const updated={...item,raw,legacyLog:raw[item.c.log],version:serviceVersion_(raw,event)};
  return {status:200,eventId:revisionId,request:serviceManagerRow_(updated,events,email,leaders,roster)};
 }
 if(['auth-service-email','auth-service-test-email'].includes(r.action)){
  const testing=r.action==='auth-service-test-email';if(testing&&!OWNER_EMAILS.includes(email_(email)))return {status:403};const mailAction=testing?'email-test':'email';
  const mode=r.logMode||'latest';if(!['latest','entire'].includes(mode))return {status:400};
  const latest=serviceUpdates_(item,state.events).slice(-1)[0],emailKey=serviceEmailKey_(item,state.events,mode);
  if(!latest||latest.eventId!==r.eventId||!testing&&serviceEmailState_(item,state.events,mode)!=='unsent')return {status:409};
  if(!testing&&!/^[^\s@,;<>]+@bethelsd\.org$/.test(item.email))return {status:400};
  const requested=r.cc||[];if(!Array.isArray(requested)||requested.length>20||requested.some(v=>typeof v!=='string')||testing&&requested.length)return {status:400};
  const choices=serviceCopyChoices_(item,email,leaders,roster),cc=[...new Set(requested.map(email_))];if(cc.some(address=>!choices.some(c=>c.email===address)))return {status:403};
  const assigned=testing?null:serviceAssignment_(item,roster);
  const managerEmail=assigned&&/^[a-z0-9._+-]+@(students\.)?bethelsd\.org$/.test(assigned.email)?assigned.email:'';
  const to=testing?email_(email):item.email,copies=[...new Set([...cc,...(managerEmail?[managerEmail]:[])])].filter(address=>address!==to),metadata=JSON.stringify({to,cc:copies,attemptId:Utilities.getUuid()});
  const message=serviceEmailMessage_(item,state.events,mode,roster);if(testing){const reminder='TEST EMAIL — Sent only to your signed-in owner account. The client was not emailed.';message.body=reminder+'\n\n'+message.body;message.htmlBody=message.htmlBody.replace('</body>', '<p style="font-family:Arial,sans-serif;text-align:center;color:#273d34;padding:16px">'+reminder+'</p></body>');}
  Sheets.Spreadsheets.batchUpdate({requests:[serviceAppend_(state.logTab,[now,item.id,mailAction,email,item.status,'',emailKey,'sending',mode,metadata])]},SERVICE_SOURCE);
  try{MailApp.sendEmail({to,...(copies.length?{cc:copies.join(',')}:{}),name:'NEST™ Client Relations',subject:(testing?'TEST · ':'')+'NEST™ service request '+item.id.slice(0,8).toUpperCase()+' · '+item.status,...message});}
  catch(_){Sheets.Spreadsheets.batchUpdate({requests:[serviceAppend_(state.logTab,[new Date().toISOString(),item.id,mailAction,email,item.status,'',emailKey,'unknown',mode,metadata])]},SERVICE_SOURCE);return {status:502};}
  const sentAt=new Date().toISOString(),event=[sentAt,item.id,mailAction,email,item.status,'',emailKey,'sent',mode,metadata],raw=[...item.raw];
  const record=sentAt+' — '+email+'\n'+(testing?'Test log email':'Client log email')+' sent ('+(mode==='entire'?'entire client-facing log':'most recent client-facing entry')+'). To: '+to+(copies.length?'; CC: '+copies.join(', '):'');
  raw[item.c.log]=record+'\n\n'+item.legacyLog;
  Sheets.Spreadsheets.batchUpdate({requests:[serviceAppend_(state.logTab,event),serviceUpdateCell_(item,item.c.log,raw[item.c.log])]},SERVICE_SOURCE);
  const updated={...item,raw,legacyLog:raw[item.c.log],version:serviceVersion_(raw,event)};
  return {status:200,testSent:testing,emailState:testing?serviceEmailState_(updated,[...state.events,event],mode):'sent',request:serviceManagerRow_(updated,[...state.events,event],email,leaders,roster)};
 }
 if(!SERVICE_STATUSES.includes(r.status)||typeof r.note!=='string'||r.note.length>2000||typeof r.publicNote!=='string'||r.publicNote.length>2000||typeof r.manager!=='string'||r.manager.length>254)return {status:400};
 if(!access.canEdit){
  if(r.note||r.publicNote)return {status:403};
  if(r.status!==item.status&&!access.canChangeStatus)return {status:403};
  if(r.manager!==item.manager&&(!access.canAssign||!r.manager))return {status:403};
 }
 const choices=roster.filter(m=>OWNER_EMAILS.includes(email_(email))||!String(item.manager||'').trim()||m.period===access.period),selected=choices.find(m=>m.email===r.manager);
 const current=serviceAssignment_(item,roster);
 if(!access.canAssign&&r.manager!==item.manager&&r.manager!==current?.email)return {status:403};
 if(r.manager&&r.manager!==item.manager&&!selected)return {status:400};
 const manager=selected?selected.label:r.manager;
 // Existing historical labels may remain, but new assignments must come from the roster.
 const raw=[...item.raw];raw[item.c.status]=r.status;raw[item.c.manager]=manager;
 const eventId=Utilities.getUuid(),note=r.note.trim(),publicNote=r.publicNote.trim();
 raw[item.c.log]=now+' — '+email+'\nStatus: '+r.status+'; Project Manager: '+(manager||'Unassigned')+(note?'\n'+note:'')+'\n\n'+item.legacyLog;
 const event=[now,item.id,'update',email,r.status,publicNote,eventId,'',manager,note];
 const writes=[serviceAppend_(state.logTab,event)];let storedRaw=raw;
 const targetName=r.status==='Closed'?'Closed Tickets':'ServiceRequests';
 if(item.tab.title===targetName){
  writes.push(serviceUpdateCell_(item,item.c.status,r.status),serviceUpdateCell_(item,item.c.manager,manager),serviceUpdateCell_(item,item.c.log,raw[item.c.log]));
 }else{
  const target=state.tabs.find(t=>t.title===targetName),headers=target.headers||[],c=serviceColumns_(headers);
  if(['id','status','manager','log','created','email','description'].some(k=>c[k]<0))return {status:428};
  const row=Array(headers.length).fill('');
  Object.keys(c).forEach(key=>{if(c[key]>=0&&item.c[key]>=0)row[c[key]]=raw[item.c[key]]??'';});
  if(c.name>=0&&c.fallbackName<0)row[c.name]=item.name;
  // Preserve extra named columns by header, rather than copying positional schemas.
  headers.forEach((h,i)=>{const source=item.headers.indexOf(h);if(h&&source>=0&&!Object.values(c).includes(i))row[i]=raw[source]??'';});
  storedRaw=row;writes.push(serviceAppend_(target,row),{deleteDimension:{range:{sheetId:item.tab.sheetId,dimension:'ROWS',startIndex:item.row-1,endIndex:item.row}}});
 }
 const barometer=state.tabs.find(t=>t.title==='ServiceBarometer');
 if(barometer&&(r.status!==item.status||manager!==item.manager)){
  const projected=state.requests.map(x=>x.id===item.id?{...x,status:r.status,manager}:x),metrics=serviceMetrics_(projected,leaders);
  if(metrics.length>barometer.gridProperties.rowCount-4)throw new Error('Service barometer capacity requires review');
  writes.push({updateCells:{range:{sheetId:barometer.sheetId,startRowIndex:4,endRowIndex:barometer.gridProperties.rowCount,startColumnIndex:1,endColumnIndex:8},rows:metrics.map(m=>({values:[m.division,m.manager,m.clientRelationsDirector,m.divisionManager,m.total,m.averageDaysOpen,m.clientsHelped].map(serviceCell_)})),fields:'userEnteredValue'}});
 }
 Sheets.Spreadsheets.batchUpdate({requests:writes},SERVICE_SOURCE);
 const updated={...item,status:r.status,manager,raw:storedRaw,legacyLog:raw[item.c.log],version:serviceVersion_(storedRaw,event)};
 return {status:200,eventId,request:serviceManagerRow_(updated,[...state.events,event],email,leaders,roster)};
}
function serviceClientSession_(r,store){return /^[a-f0-9]{64}$/.test(r.session||'')?read_(store,'service-session:'+hash_(r.session),Date.now()):null;}
function serviceDispatch_(r){
 const store=PropertiesService.getScriptProperties();
 try{
  if(r.action==='service-client-login'){
   if(!/^[^\s@,;<>]+@bethelsd\.org$/.test(r.email||'')||!/^[a-f0-9]{64}$/.test(r.session||'')||!/^[a-f0-9]{64}$/.test(r.nonce||'')||!Number.isFinite(r.expires)||r.expires<=Date.now()||r.expires>Date.now()+3600000)return {status:400};
   const lock=LockService.getScriptLock();if(!lock.tryLock(10000))return {status:503};
   try{
    const nonceKey='service-nonce:'+hash_(r.nonce);if(read_(store,nonceKey,Date.now()))return {status:409};
    store.setProperty(nonceKey,JSON.stringify({expires:Date.now()+600000}));
    if(/^[a-f0-9]{64}$/.test(r.previous||''))store.deleteProperty('service-session:'+hash_(r.previous));
    const props=store.getProperties();Object.keys(props).filter(k=>/^service-(session|nonce):/.test(k)).forEach(k=>{try{if(JSON.parse(props[k]).expires<=Date.now())store.deleteProperty(k);}catch(_){store.deleteProperty(k);}});
    store.setProperty('service-session:'+hash_(r.session),JSON.stringify({email:r.email,sub:r.sub,expires:r.expires}));return {status:200};
   }finally{lock.releaseLock();}
  }
  if(r.action==='service-client-logout'){if(/^[a-f0-9]{64}$/.test(r.session||''))store.deleteProperty('service-session:'+hash_(r.session));return {status:200};}
  if(r.action==='service-client-view'){
   const session=serviceClientSession_(r,store);if(!session)return {status:401};
   const state=serviceRead_();return {status:200,email:session.email,requests:state.requests.filter(item=>item.email===session.email).map(item=>serviceClientRow_(item,state.events))};
  }
  const session=authSession_(r.session,store,Date.now());if(!session)return {status:401};
  if(r.action==='auth-service-ticket'){
   if(!/^[a-f0-9-]{36}$/.test(r.id||''))return {status:400};
   const state=serviceRead_(),item=state.requests.find(x=>x.id===r.id);if(!item)return {status:404};
   const leaders=serviceLeaders_(),roster=serviceRoster_();if(!serviceRole_(session.email,leaders)&&!serviceTicketAccess_(session.email,item,leaders,roster).canEdit)return {status:403};
   return {status:200,request:serviceManagerRow_(item,state.events,session.email,leaders,roster)};
  }
  if(['auth-service-manage','auth-service-reviews','auth-service-metrics'].includes(r.action))return serviceManage_(r.action.slice(13),session.email);
  if(!['auth-service-members','auth-service-update','auth-service-email','auth-service-edit-log','auth-service-delete-log','auth-service-test-email'].includes(r.action))return {status:400};
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
  try{return serviceWrite_(session.email,r);}finally{lock.releaseLock();}
 }catch(error){return {status:error.message==='SERVICE_SETUP_REQUIRED'?428:503};}
}

const SERVICE_CALENDARS=[
 'c_fb2c6c5e4a321922a65941d2d5d6035bc05bc2f24281868b2801beeb575d81ec@group.calendar.google.com',
 'c_913e7cfd3fae4b0ebac48350ef736dd9ab300fee8390a21ce972c0cb8ca78049@group.calendar.google.com'
];
function serviceCalendarRange_(events,today){
 const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 const points=events.filter(e=>e.allDay&&/^\d{4}-\d{2}-\d{2}$/.test(e.start)&&/^\d{4}-\d{2}-\d{2}$/.test(e.end)&&e.end>e.start);
 const starts=new Map(),ends=new Map(),first=[],last=[];
 const add=(map,n,day)=>{if(!map.has(n))map.set(n,new Set());map.get(n).add(day);};
 for(const e of points){
  const name=String(e.title||'').toLowerCase();
  const match=name.match(/\btri(?:mester)?\.?\s*#?\s*([123])(?:st|nd|rd)?\b|\b([123])(?:st|nd|rd)?\s+tri(?:mester)?\b|\b(first|second|third)\s+tri(?:mester)?\b/);
  const n=match?Number(match[1]||match[2]||({first:1,second:2,third:3})[match[3]]):0;
  if(n&&/\b(end|ends|ending|last)\b/.test(name))add(ends,n,shift(e.end,-1));
  if(n&&/\b(start|starts|starting|begin|begins|beginning|first day)\b/.test(name))add(starts,n,e.start);
  if(/\bfirst day of school\b|\bschool (starts|begins)\b/.test(name))first.push(e.start);
  if(/\blast day of school\b/.test(name))last.push(shift(e.end,-1));
 }
 const single=set=>set?.size===1?[...set][0]:null;
 const a=new Set(first),z=new Set(last);
 if(!starts.has(1)&&a.size===1)add(starts,1,single(a));
 if(!ends.has(3)&&z.size===1)add(ends,3,single(z));
 const ranges=[];
 for(let n=1;n<=3;n++){
  if(!starts.has(n)&&n>1&&single(ends.get(n-1)))add(starts,n,shift(single(ends.get(n-1)),1));
  if(!ends.has(n)&&n<3&&single(starts.get(n+1)))add(ends,n,shift(single(starts.get(n+1)),-1));
  const start=single(starts.get(n)),end=single(ends.get(n));if(start&&end&&start<=end)ranges.push({number:n,start,end});
 }
 const matches=ranges.filter(r=>r.start<=today&&today<=r.end);
 return matches.length===1?{...matches[0],source:'School Google calendars'}:{error:'No single current trimester could be determined from the school calendars. Use All time.'};
}
function serviceCurrentTrimester_(){
 try{
  const today=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd');
  const year=Number(today.slice(0,4))-(Number(today.slice(5,7))<7?1:0),key='service-trimester-boundaries:'+year;
  const cache=CacheService.getScriptCache(),cached=cache.get(key);let events=cached?JSON.parse(cached):null;
  if(!events){
   events=[];
   SERVICE_CALENDARS.forEach(id=>{
    const calendar=CalendarApp.getCalendarById(id);if(!calendar)throw new Error('Calendar unavailable');
    const rows=calendar.getEvents(new Date(year+'-07-01T00:00:00-07:00'),new Date((year+1)+'-07-01T00:00:00-07:00'));
    if(rows.length>5000)throw new Error('Calendar capacity');
    rows.filter(e=>e.isAllDayEvent()&&/\btri(?:mester)?\b|\bfirst day of school\b|\bschool (starts|begins)\b|\blast day of school\b/i.test(e.getTitle())).forEach(e=>events.push({title:e.getTitle(),allDay:true,start:Utilities.formatDate(e.getAllDayStartDate(),'America/Los_Angeles','yyyy-MM-dd'),end:Utilities.formatDate(e.getAllDayEndDate(),'America/Los_Angeles','yyyy-MM-dd')}));
   });cache.put(key,JSON.stringify(events),3600);
  }
  return serviceCalendarRange_(events,today);
 }catch(_){return {error:'School calendar access is unavailable. Use All time while calendar access is restored.'};}
}
function Tool_ServiceCalendarAuthorization(){
 const result=serviceCurrentTrimester_();if(result.error)throw new Error(result.error);
 console.log('School calendar integration ready. Trimester '+result.number+': '+result.start+' through '+result.end);
}
