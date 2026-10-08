// Owner-private storage: never put form answers into the team-shared CTSO workbook.
const ROBOTICS_SIGNUP_FORM='1ROTm1QXYvOzRUh3TVeNDQNhXmxRrYxNayzxZHvBI1cg';
const ROBOTICS_CALENDAR='c_2b422570f48c710a09f9a4ad62f01b3a99eba983da39e7cc648454dcf129a079@group.calendar.google.com';
const ROBOTICS_CALENDAR_LINK='https://calendar.google.com/calendar/u/0?cid=Y18yYjQyMjU3MGY0OGM3MTBhMDlmOWE0YWQ2MmYwMWIzYTk5ZWJhOTgzZGEzOWU3Y2M2NDg0NTRkY2YxMjlhMDc5QGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20';
function roboticsPrivateId_(){return PropertiesService.getScriptProperties().getProperty('robotics-private-storage')||'';}
function roboticsRoster_(){const byEmail=new Map();Object.keys(PERIODS).forEach(period=>rows_(period).forEach(row=>{const key=email_(row[1]);if(!key)return;const old=byEmail.get(key);if(old&&roboticsName_(old[0])!==roboticsName_(row[0]))throw new Error('Roster identity conflict');byEmail.set(key,row);} ));return [...byEmail.values()];}
function roboticsPrivateRows_(){const id=roboticsPrivateId_();return id?roboticsValues_(id,"'Members'!A2:B10000").map((row,index)=>({key:String(row[0]),row:index+2,record:JSON.parse(row[1])})):[];}
function roboticsPrivateSave_(entry){
 const text=JSON.stringify(entry.record);if(text.length>45000)throw new Error('Profile exceeds storage limit');
 roboticsWrite_(roboticsPrivateId_(),[{range:"'Members'!A"+entry.row+':B'+entry.row,values:[[entry.key,text]]}]);
}
function roboticsPrivateNew_(key,record){const rows=roboticsPrivateRows_(),entry={key,row:rows.length?Math.max(...rows.map(r=>r.row))+1:2,record};roboticsPrivateSave_(entry);return entry;}
function roboticsSafeLink_(value){
 const s=String(value||'').trim();return /^https:\/\/[^\s<>"']+$/i.test(s)&&!/^https:\/\/[^/]*@/i.test(s)&&!/[?&](id_token_hint|access_token|token|code|auth|sig|key)=/i.test(s)?s:'';
}
function roboticsProtocols_(){const id=roboticsPrivateId_();return id?roboticsValues_(id,"'Protocols'!A2:F101").filter(r=>r[0]).map(r=>({id:String(r[0]),label:String(r[1]),url:roboticsSafeLink_(r[2]),detail:String(r[3]||''),active:r[4]!==false})):[];}
function roboticsProtocolRevision_(){return hash_(JSON.stringify(roboticsProtocols_()));}
function roboticsProfilesFor_(member){return roboticsPrivateRows_().filter(entry=>entry.record.memberId===member.id);}
function roboticsOwnMember_(identity,state){
 const address=memberEmail_(identity,'CTSO');return state.members.filter(m=>m.active&&m.identityVerified&&m.email===address&&m.canChangeStatus);
}
function roboticsManagementAccess_(identity,leaders){
 if(roboticsAccess_(identity,leaders))return true;
 const address=memberEmail_(identity,'CTSO');if(!rows_('CTSO').some(r=>email_(r[1])===address))return false;
 return (leaders||nestAccessValues_(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[]).some(r=>String(r[0]).replace(/period/ig,'').trim().toUpperCase()==='CTSO'&&email_(r[4])===address&&/^executive vice[- ]president$/i.test(String(r[2]).trim()));
}
function roboticsCanView_(identity){return roboticsManagementAccess_(identity)||roboticsOwnMember_(identity,roboticsState_()).length===1;}
function roboticsOnboardingView_(state,identity){
 const manager=roboticsManagementAccess_(identity),own=roboticsOwnMember_(identity,state),protocols=roboticsProtocols_();
 if(!manager&&own.length!==1)return {status:403};
 const entries=manager?roboticsPrivateRows_():roboticsPrivateRows_().filter(e=>e.record.memberId===own[0].id);
 const requests=entries.filter(e=>e.record.kind==='signup').map(e=>({id:e.key,name:e.record.name,submitted:e.record.submitted,memberId:e.record.memberId||null,
  candidate:state.members.some(m=>m.email===e.record.respondent)?null:roboticsRoster_().filter(row=>email_(row[1])===e.record.respondent).map(row=>({id:hash_(String(row[1]).split('@')[0]+'|'+roboticsName_(row[0])),name:String(row[0])}))[0]||null,
  progress:protocols.filter(p=>p.active).filter(p=>e.record.checks?.[p.id]?.done).length,total:protocols.filter(p=>p.active).length,
  notification:e.record.historical?'Historical import':!e.record.mailPlan?'Pending':e.record.mailPlan.some(m=>e.record.mail?.[hash_(m.email)]?.state!=='sent')?'Needs review':'Sent'}));
 return {...(manager?roboticsView_(state):{}),status:200,manager,ready:!!roboticsPrivateId_(),requests:manager?requests:[],protocols:manager?protocols:[],protocolRevision:manager?roboticsProtocolRevision_():null,
  members:manager?roboticsView_(state).members:[],ownMember:own.length===1?{id:own[0].id,name:own[0].name}:null};
}
function roboticsProfileView_(entry,member){
 return {status:200,profile:{id:entry.key,memberId:member?.id||null,name:entry.record.name,submitted:entry.record.submitted||null,
  revision:hash_(JSON.stringify(entry.record)),fields:entry.record.fields||[],checks:entry.record.checks||{},protocols:roboticsProtocols_().filter(p=>p.active)}};
}
function roboticsProfileEntry_(r,state,manager,identity){
 const member=state.members.find(m=>m.id===r.member),entries=roboticsPrivateRows_();
 if(r.request){if(!manager)return null;return {entry:entries.find(e=>e.key===r.request),member:null};}
 if(!member)return null;
 if(!manager){const own=roboticsOwnMember_(identity,state);if(own.length!==1||own[0].id!==member.id)return null;}
 const matches=entries.filter(e=>e.record.memberId===member.id);if(matches.length>1)return {ambiguous:true};
 let entry=matches[0];
 if(!entry&&r.operation==='profile')entry=roboticsPrivateNew_(hash_('profile|'+member.id),{kind:'profile',memberId:member.id,name:member.name,fields:[{id:'contact-email',label:'Contact email',value:member.email,editable:true},{id:'contact-phone',label:'Contact phone',value:'',editable:true}],checks:{}});
 return {entry,member};
}
function roboticsOnboardingDispatch_(r,state,session){
 const manager=roboticsManagementAccess_(session.email);
 if(r.operation==='onboarding')return roboticsOnboardingView_(state,session.email);
 if(!roboticsPrivateId_())return {status:503};
 if(r.operation==='protocol-save'){
  if(!manager)return {status:403};if(r.revision!==roboticsProtocolRevision_())return {status:409};
  if(!Array.isArray(r.protocols)||!r.protocols.length||r.protocols.length>100)return {status:400};
  const old=roboticsProtocols_(),seen=new Set(),rows=[];
  for(const p of r.protocols){
   if(!p||typeof p.label!=='string'||!p.label.trim()||p.label.length>1000||typeof p.detail!=='string'||p.detail.length>2000||typeof p.active!=='boolean'||typeof p.url!=='string'||(p.url&&!roboticsSafeLink_(p.url)))return {status:400};
   const id=p.id||Utilities.getUuid();if(p.id&&!old.some(item=>item.id===id)||seen.has(id))return {status:400};seen.add(id);rows.push([id,p.label.trim(),p.url,p.detail,p.active,'']);
  }
  // Removing a step retires it, preserving every member's completion history.
  old.filter(p=>!seen.has(p.id)).forEach(p=>rows.push([p.id,p.label,p.url,p.detail,false,'']));
  if(rows.length>100)return {status:400};while(rows.length<100)rows.push(['','','','','','']);
  roboticsWrite_(roboticsPrivateId_(),[{range:"'Protocols'!A2:F101",values:rows}]);return roboticsOnboardingView_(state,session.email);
 }
 const selected=roboticsProfileEntry_(r,state,manager,session.email);if(!selected)return {status:403};if(selected.ambiguous)return {status:409};
 const {entry,member}=selected;if(!entry)return {status:404};
 if(r.operation==='profile')return roboticsProfileView_(entry,member);
 if(r.revision!==hash_(JSON.stringify(entry.record)))return {status:409};
 if(r.operation==='profile-save'){
  if(!r.fields||typeof r.fields!=='object'||Array.isArray(r.fields))return {status:400};
  for(const [id,value] of Object.entries(r.fields)){
   const field=entry.record.fields.find(f=>f.id===id);if(!field?.editable||typeof value!=='string'||value.length>2000)return {status:400};
   if(/email/i.test(field.label)&&value&&!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value))return {status:400};field.value=value.trim();
  }
 }else if(r.operation==='checklist'){
  if(!manager)return {status:403};if(typeof r.done!=='boolean'||!roboticsProtocols_().some(p=>p.id===r.step&&p.active))return {status:400};
  entry.record.checks=entry.record.checks||{};entry.record.checks[r.step]={done:r.done,at:new Date().toISOString(),by:session.email};
 }else if(r.operation==='activate-request'){
  if(!manager)return {status:403};if(entry.record.kind!=='signup')return {status:400};
  if(r.memberRevision!==state.revision)return {status:409};
  let target=state.members.find(m=>m.id===r.member);
  if(entry.record.memberId&&entry.record.memberId!==r.member)return {status:400};
  const other=roboticsPrivateRows_().filter(e=>e.key!==entry.key&&e.record.memberId===r.member);
  if(other.some(e=>e.record.kind!=='profile')||other.length>1)return {status:409};
  if(!target){
   const matches=roboticsRoster_().filter(row=>email_(row[1])===entry.record.respondent&&hash_(String(row[1]).split('@')[0]+'|'+roboticsName_(row[0]))===r.member);
   if(matches.length!==1||!/^\d+@students\.bethelsd\.org$/.test(entry.record.respondent))return {status:400};
   const source=matches[0],row=state.members.length?Math.max(...state.members.map(m=>m.row))+1:2;if(row>1000)return {status:400};
   target={id:r.member,row,name:String(source[0]),studentId:entry.record.respondent.split('@')[0],email:entry.record.respondent,identityVerified:true,canChangeStatus:true};
   roboticsWrite_(PERIODS.CTSO,[{range:"'"+ROBOTICS_STORAGE+"'!A"+row+':E'+row,values:[[false,true,target.name,target.studentId,target.email]]}]);
  }
  if(!target.identityVerified||!target.canChangeStatus)return {status:400};
  if(other.length){entry.record.fields.push(...other[0].record.fields);entry.record.checks={...other[0].record.checks,...entry.record.checks};other[0].record.memberId=null;other[0].record.kind='archived-profile';roboticsPrivateSave_(other[0]);}
  // A human explicitly links the request to a verified roster identity; form answers never grant access.
  entry.record.memberId=target.id;entry.record.activated=new Date().toISOString();roboticsPrivateSave_(entry);
  roboticsWrite_(PERIODS.CTSO,[{range:"'"+ROBOTICS_STORAGE+"'!A"+target.row+':B'+target.row,values:[[true,false]]}]);
  return roboticsOnboardingView_(roboticsState_(),session.email);
 }else return {status:400};
 entry.record.updated=new Date().toISOString();roboticsPrivateSave_(entry);return roboticsProfileView_(entry,member);
}
function roboticsSetupOnboarding(){
 if(!OWNER_EMAILS.includes(email_(Session.getEffectiveUser().getEmail())))throw new Error('Run setup as the school owner');
 const form=FormApp.openById(ROBOTICS_SIGNUP_FORM);if(!form.collectsEmail())throw new Error('Signup form must collect respondent email');
 const calendar=CalendarApp.getCalendarById(ROBOTICS_CALENDAR);if(!calendar)throw new Error('School owner needs access to the club calendar');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const store=PropertiesService.getScriptProperties();
  if(!roboticsPrivateId_()){
   const book=Sheets.Spreadsheets.create({properties:{title:'NEST Robotics — Private Membership'},sheets:[{properties:{title:'Members',gridProperties:{rowCount:10000,columnCount:2}}},{properties:{title:'Protocols',gridProperties:{rowCount:101,columnCount:6}}}]});
   store.setProperty('robotics-private-storage',book.spreadsheetId);
   roboticsWrite_(book.spreadsheetId,[{range:"'Members'!A1:B1",values:[['Record ID','Private record']]},{range:"'Protocols'!A1:F1",values:[['Step ID','Step','Help URL','Details','Active','']]}]);
  }
  if(!roboticsProtocols_().length){
   const legacy=roboticsValues_(PERIODS.CTSO,"'NewMemberProtocols'!A2:C100").filter(r=>r[0]);
   const protocols=legacy.map(r=>{let label=String(r[0]),url=roboticsSafeLink_(r[1]);
    if(/first inspires/i.test(label)&&!url)url='https://my.firstinspires.org/Dashboard/';
    if(/mark their status/i.test(label)){label='Activate their membership on the NEST website';url='https://gknest.org/divisions/CTSO#robotics';}
    return [Utilities.getUuid(),label,url,String(r[2]||''),true,''];});
   if(protocols.length)roboticsWrite_(roboticsPrivateId_(),[{range:"'Protocols'!A2:F"+(protocols.length+1),values:protocols}]);
  }
  // Backfill without notifying historical respondents; repeated setup never resends mail.
  form.getResponses().forEach(response=>roboticsCaptureSignup_(response,true));
  const state=roboticsState_(),entries=roboticsPrivateRows_();
  state.members.filter(m=>m.identityVerified&&m.canChangeStatus).forEach(member=>{
   if(entries.some(e=>e.record.memberId===member.id))return;
   const candidates=entries.filter(e=>e.record.historical&&e.record.kind==='signup'&&!e.record.memberId&&e.record.respondent===member.email).sort((a,b)=>b.record.submitted.localeCompare(a.record.submitted));
   if(candidates.length){candidates[0].record.memberId=member.id;roboticsPrivateSave_(candidates[0]);}
  });
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='roboticsMembershipSubmitted'&&t.getTriggerSourceId()===ROBOTICS_SIGNUP_FORM))ScriptApp.newTrigger('roboticsMembershipSubmitted').forForm(form).onFormSubmit().create();
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='roboticsRetryPendingSignups'))ScriptApp.newTrigger('roboticsRetryPendingSignups').timeBased().everyHours(1).create();
  store.setProperty('robotics-onboarding-ready',new Date().toISOString());
 }finally{lock.releaseLock();}
}
function roboticsMembershipSubmitted(e){
 if(!e?.response||!e.source||e.source.getId()!==ROBOTICS_SIGNUP_FORM)throw new Error('Use the membership form submit trigger');
 const lock=LockService.getScriptLock();lock.waitLock(30000);let key;
 try{key=roboticsCaptureSignup_(e.response,false).key;}finally{lock.releaseLock();}
 roboticsSignupMail_(key);
}
function roboticsCaptureSignup_(response,historical){
 const responseId=response.getId();if(!responseId)throw new Error('Submitted response ID required');
 const key=hash_('signup|'+responseId),existing=roboticsPrivateRows_().find(e=>e.key===key);if(existing)return existing;
 const fields=response.getItemResponses().map(ir=>{const item=ir.getItem(),type=String(item.getType()),label=item.getTitle();
  return {id:String(item.getId()),label,value:ir.getResponse(),editable:['TEXT','PARAGRAPH_TEXT'].includes(type)&&/(phone|email|address|contact|guardian|parent)/i.test(label)&&!/(consent|agree|waiver|student.?id|legal name)/i.test(label)};});
 const submitted=response.getTimestamp().toISOString(),address=email_(response.getRespondentEmail()),roster=rows_('CTSO'),matches=roster.filter(r=>email_(r[1])===address);
 const nameField=fields.find(f=>/^(student )?(full |legal )?name$/i.test(f.label.trim()));
 fields.unshift({id:'respondent-email',label:'Signed-in account email',value:address,editable:false});
 const name=matches.length===1?String(matches[0][0]):String(nameField?.value||fields.filter(f=>/^(your |student )?(first|last) name$/i.test(f.label.trim())).map(f=>f.value).join(' ')||address||'Unmatched signup');
 return roboticsPrivateNew_(key,{kind:'signup',name,submitted,respondent:address,fields,memberId:null,checks:{},historical,mail:{}});
}
function roboticsSignupRecipients_(){
 const roster=new Set(rows_('CTSO').map(r=>email_(r[1]))),roles=nestAccessValues_(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
 return [...new Set(['mpenalver@bethelsd.org',...roles.filter(r=>String(r[0]).replace(/period/ig,'').trim().toUpperCase()==='CTSO'&&roster.has(email_(r[4]))&&/^(chief (executive|financial|operations) officers?|executive vice[- ]president|partner liaison)$/i.test(String(r[2]).trim())).map(r=>email_(r[4]))])];
}
function roboticsNextMeeting_(){
 const calendar=CalendarApp.getCalendarById(ROBOTICS_CALENDAR);if(!calendar)throw new Error('Club calendar unavailable');
 const now=new Date(),end=new Date(now.getTime()+180*86400000),events=calendar.getEvents(now,end).filter(e=>e.getStartTime()>now&&/(meeting|robotics weekly)/i.test(e.getTitle())).sort((a,b)=>a.getStartTime()-b.getStartTime());
 if(!events.length)return 'The next meeting has not yet been scheduled; the club will confirm the date.';
 const event=events[0];return event.getTitle()+' — '+Utilities.formatDate(event.getStartTime(),calendar.getTimeZone(),'EEEE, MMMM d, yyyy, h:mm a z');
}
function roboticsSignupMail_(key){
 const lock=LockService.getScriptLock();lock.waitLock(30000);let entry,deliveries=[];
 try{
  entry=roboticsPrivateRows_().find(e=>e.key===key);if(!entry||entry.record.historical)return;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(!entry.record.mailPlan){
   const date=roboticsNextMeeting_(),calendarText='Add the club calendar: '+ROBOTICS_CALENDAR_LINK;
   const protocols=roboticsProtocols_().filter(p=>p.active),steps=protocols.map(p=>'☐ '+p.label+(p.url?' — '+p.url:'')+(p.detail?'\n'+p.detail:'')).join('\n');
   entry.record.mailPlan=[{email:entry.record.respondent,subject:'NEST™ Robotics — signup received',body:'Thank you for completing the NEST™ Robotics membership form! Someone from the club will reach out soon with information on how to prepare for the next meeting.\n\n'+date+'\n\n'+calendarText,htmlBody:'<p>Thank you for completing the NEST™ Robotics membership form! Someone from the club will reach out soon with information on how to prepare for the next meeting.</p><p>'+esc(date)+'</p><p><a href="'+esc(ROBOTICS_CALENDAR_LINK)+'">Add the club calendar</a></p><p>After adding the club calendar to your Google account, enable it in your device’s calendar settings.</p>'},
    ...roboticsSignupRecipients_().map(email=>({email,subject:'NEST™ Robotics — new member signup',body:entry.record.name+' completed the membership form. Review and activate the member in the website.\nhttps://gknest.org/divisions/CTSO#robotics\n\nAfter activation:\n'+steps,
    htmlBody:'<p>'+esc(entry.record.name)+' completed the membership form.</p><p><a href="https://gknest.org/divisions/CTSO#robotics">Review the signup and activate membership</a></p><p>After activation:</p><ul>'+protocols.map(p=>'<li>☐ '+(p.url?'<a href="'+esc(p.url)+'">'+esc(p.label)+'</a>':esc(p.label))+(p.detail?'<p>'+esc(p.detail)+'</p>':'')+'</li>').join('')+'</ul>'}))];
   roboticsPrivateSave_(entry);
  }
  const pending=entry.record.mailPlan.filter(m=>/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(m.email)&&!entry.record.mail[hash_(m.email)]);
  if(pending.length>MailApp.getRemainingDailyQuota())throw new Error('Not enough mail quota; notifications pending');
  pending.forEach(m=>{entry.record.mail[hash_(m.email)]={state:'claimed',at:new Date().toISOString()};deliveries.push(m);});roboticsPrivateSave_(entry);
 }finally{lock.releaseLock();}
 for(const m of deliveries){
  let outcome='sent';try{MailApp.sendEmail({to:m.email,name:'NEST™ Robotics',subject:m.subject,body:m.body,htmlBody:m.htmlBody});}catch(_){outcome='failed';}
  lock.waitLock(30000);try{const fresh=roboticsPrivateRows_().find(e=>e.key===key);fresh.record.mail[hash_(m.email)].state=outcome;roboticsPrivateSave_(fresh);}finally{lock.releaseLock();}
 }
}

// Retry only unclaimed work; failed or uncertain sends remain visible for human review.
function roboticsRetryPendingSignups(){
 roboticsPrivateRows_().filter(e=>e.record.kind==='signup'&&!e.record.historical&&(!e.record.mailPlan||e.record.mailPlan.some(m=>!e.record.mail?.[hash_(m.email)]))).forEach(e=>{try{roboticsSignupMail_(e.key);}catch(_){/* Leave pending for the next run. */}});
}
