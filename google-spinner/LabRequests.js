// Private NEST lab passes. Source form and staff workbook remain unchanged.
const LAB_STAFF_BOOK='1SXaKUeh3tCsBVSdO90iWWX_pL8WhNe7aTSrELEIE98o';
const LAB_ZONE='America/Los_Angeles';
const LAB_REASONS={tabled:['NEST™ Lab is at capacity','Please choose another time','More information is needed','Waiting for teacher approval','Grade evidence needs review'],denied:['NEST™ Lab is unavailable at that time','Grade requirement is not met','Please remain in your scheduled class','The goal needs to be revised','Request was submitted too late']};
function labDay_(date){return Utilities.formatDate(date||new Date(),LAB_ZONE,'yyyy-MM-dd');}
function labOwner_(session){return websiteAdmin_(session.email);}
function labError_(status,error){return {status,error};}
function labUuid_(value){return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);}
function labText_(value,max){return typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);}
function labLocked_(work){const lock=LockService.getScriptLock();if(!lock.tryLock(10000))return labError_(503,'The request desk is busy. Please refresh.');try{return work();}finally{lock.releaseLock();}}
function labStore_(){
 const props=PropertiesService.getScriptProperties();let id=props.getProperty('lab-request-store');if(id)return id;
 return labLocked_(()=>{id=props.getProperty('lab-request-store');if(id)return id;
  const book=Sheets.Spreadsheets.create({properties:{title:'NEST Private Lab Passes',timeZone:LAB_ZONE},sheets:[{properties:{title:'Requests',gridProperties:{frozenRowCount:1,rowCount:10001,columnCount:2}}},{properties:{title:'Staff',gridProperties:{frozenRowCount:1,rowCount:503,columnCount:3}}}]});
  Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data:[{range:"'Requests'!A1:B1",values:[['Request ID','Private request record']]},{range:"'Staff'!A1:C1",values:[['Staff ID','Name','District email']]}]},book.spreadsheetId);
  props.setProperty('lab-request-store',book.spreadsheetId);return book.spreadsheetId;
 });
}
function labParseStaff_(rows){
 if(!rows.length||JSON.stringify(rows[0].map(v=>String(v).trim().toLowerCase()))!==JSON.stringify(['last','first','email','school']))throw Error('Staff directory headings changed');
 const map=new Map();
 rows.slice(1).forEach(row=>{const email=email_(row[2]),last=String(row[0]||'').trim(),first=String(row[1]||'').trim();
  if(String(row[3]||'').trim().toUpperCase()!=='GKHS'||!last||!first||!/^[-a-z0-9._+]+@bethelsd\.org$/.test(email))return;
  const name=last+', '+first;if(map.has(email)&&map.get(email).name!==name)throw Error('Staff directory has conflicting names');
  map.set(email,{id:hash_('lab-staff:'+email),name,email});
 });
 const staff=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name));if(staff.length<10||staff.length>500)throw Error('Staff directory size needs review');return staff;
}
function refreshNestLabStaff(){
 const store=labStore_();if(typeof store!=='string')throw Error('Lab storage unavailable');
 return labLocked_(()=>{const props=PropertiesService.getScriptProperties();try{
  const staff=labParseStaff_(Sheets.Spreadsheets.Values.get(LAB_STAFF_BOOK,"'Shared_data'!A1:D1001").values||[]);
  // One update replaces every cached row, including removed staff. No personal addresses are read.
  const values=Array.from({length:501},(_,i)=>i<staff.length?[staff[i].id,staff[i].name,staff[i].email]:['','','']);
  Sheets.Spreadsheets.Values.update({values},store,"'Staff'!A2:C502",{valueInputOption:'RAW'});
  props.setProperty('lab-staff-synced',new Date().toISOString());props.deleteProperty('lab-staff-error');return {status:200,count:staff.length};
 }catch(error){props.setProperty('lab-staff-error','Staff sync failed; the last successful directory was retained.');throw error;}});
}
function labTeacherName_(teacher){return teacher.email==='mpenalver@bethelsd.org'?'Mario Peñalver':teacher.name;}
function labStaff_(fresh){
 const props=PropertiesService.getScriptProperties(),at=props.getProperty('lab-staff-synced');
 if(!at||labDay_(new Date(at))!==labDay_()){
  try{refreshNestLabStaff();}catch(error){if(fresh||!at||Date.now()-Date.parse(at)>7*86400000)throw error;}
 }
 return (Sheets.Spreadsheets.Values.get(labStore_(),"'Staff'!A2:C502").values||[]).filter(r=>r[0]&&r[1]&&r[2]).map(r=>({id:r[0],name:r[1],email:r[2]}));
}
function labInstallDaily_(){
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='refreshNestLabStaff'))ScriptApp.newTrigger('refreshNestLabStaff').timeBased().atHour(5).everyDays(1).inTimezone(LAB_ZONE).create();
}
function labDivisions_(){return ['ADVISORY','ENGINEERING ESSENTIALS','DESIGN & MODELING','INTRO TO ENGINEERING DESIGN','DRONE PILOTING','NEST™ Robotics','GUEST'];}
function labRecords_(){if(typeof labWebsiteMode_==='function'&&labWebsiteMode_())return labWebsiteRecords_();return (Sheets.Spreadsheets.Values.get(labStore_(),"'Requests'!A2:B10001").values||[]).map((row,i)=>{if(!row[0])return null;const record=JSON.parse(row[1]);if(record.id!==row[0])throw Error('Invalid pass record');return {...record,_row:i+2};}).filter(Boolean);}
function labSave_(record){if(typeof labWebsiteMode_==='function'&&labWebsiteMode_())return labWebsiteSave_([record]);const {_row,...data}=record;const value={values:[[record.id,JSON.stringify(data)]]},id=labStore_();if(_row)Sheets.Spreadsheets.Values.update(value,id,"'Requests'!A"+_row+':B'+_row,{valueInputOption:'RAW'});else {const receipt=Sheets.Spreadsheets.Values.append(value,id,"'Requests'!A:B",{valueInputOption:'RAW',insertDataOption:'INSERT_ROWS'});const match=String(receipt.updates&&receipt.updates.updatedRange||'').match(/!A(\d+):B\d+$/);if(!match)throw Error('NEST™ Request write receipt unavailable');record._row=Number(match[1]);}}
function labIdentity_(session){const address=Object.keys(PERIODS).map(period=>memberEmail_(session.email,period)).find(value=>districtEmail_(value))||session.email;return districtEmail_(address)|| (labOwner_(session)?email_(session.email):'');}
function labPublic_(record,owner){
 const result={id:record.id,revision:record.revision,name:record.name,division:record.division,day:record.day,time:record.time,scheduledAt:record.scheduledAt,goal:record.goal,teachers:record.teachers.map(t=>({name:labTeacherName_(t)})),state:record.state,reason:record.reason,createdAt:record.createdAt,checkedInAt:record.checkedInAt||'',events:record.events.map(e=>({id:e.id,state:e.state,reason:e.reason,at:e.at,emailState:e.emailState}))};
 const archiveDay=labArchiveDay_(record);result.dateNeedsReview=archiveDay!==record.day;result.archiveDate=archiveDay;result.schoolYear=labYear_(archiveDay);result.trimester=labTerm_(archiveDay);result.legacy=record.legacy===true;result.legacyStatus=record.legacyStatus||'';
 if(owner){if(record.evidenceId)result.evidence='https://drive.google.com/file/d/'+record.evidenceId+'/view';result.email=record.email;result.adminNotification=record.adminNotification;result.arrivalReminder=record.arrivalReminder;}return result;
}
function labSchedule_(day,time){
 if(typeof day!=='string'||typeof time!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||''))return null;
 const text=day+' '+time;let date;try{date=Utilities.parseDate(text,LAB_ZONE,'yyyy-MM-dd HH:mm');}catch(_){return null;}
 return Utilities.formatDate(date,LAB_ZONE,'yyyy-MM-dd HH:mm')===text&&day>=labDay_()&&date.getTime()<=Date.now()+180*86400000&&date.getTime()>=Date.now()-60000?date.toISOString():null;
}
function labEvidence_(input,requestId){
 if(!input||!['image/png','image/jpeg','image/webp'].includes(input.type)||typeof input.data!=='string'||input.data.length>2800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))throw Error('Choose a PNG, JPEG, or WebP screenshot under 2 MB.');
 const bytes=Utilities.base64Decode(input.data),b=bytes.map(v=>v&255),head=b.slice(0,12);
 const signature=input.type==='image/png'?head.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':input.type==='image/jpeg'?head[0]===255&&head[1]===216&&head[2]===255:head.slice(0,4).join(',')==='82,73,70,70'&&head.slice(8,12).join(',')==='87,69,66,80';
 if(!signature||bytes.length>2*1024*1024||bytes.length<12)throw Error('Choose a valid image screenshot under 2 MB.');
 const props=PropertiesService.getScriptProperties();let folder=props.getProperty('lab-evidence-folder');
 if(!folder){folder=Drive.Files.create({name:'NEST Private Lab Grade Evidence',mimeType:'application/vnd.google-apps.folder'},null,{fields:'id'}).id;props.setProperty('lab-evidence-folder',folder);}
 const name='lab-'+requestId,existing=Drive.Files.list({q:"'"+folder+"' in parents and trashed = false and name = '"+name+"'",fields:'files(id)',pageSize:2}).files||[];
 if(existing.length===1)return existing[0].id;if(existing.length>1)throw Error('Evidence upload needs review');
 return Drive.Files.create({name,mimeType:input.type,parents:[folder]},Utilities.newBlob(bytes,input.type,name),{fields:'id'}).id;
}
function labSubmit_(session,r){
 const email=labIdentity_(session);if(!email)return labError_(403,'A linked district account is required.');
 if(!labUuid_(r.requestId))return labError_(400,'Refresh the request form.');
 // A durable request ID makes uncertain submissions safe to repeat.
 const existing=labRecords_().find(x=>x.id===r.requestId);if(existing)return existing.email===email?{status:200,request:labPublic_(existing,labOwner_(session)),saved:true}:labError_(409,'Refresh the request form.');
 const scheduledAt=labSchedule_(r.day,r.time),staff=labStaff_(true),divisions=labDivisions_();
 if(!labText_(r.firstName,80)||!labText_(r.lastName,80)||!labText_(r.goal,2000)||!scheduledAt||!divisions.includes(r.division)||r.gradeConfirmed!==true||!Array.isArray(r.teachers)||!r.teachers.length||r.teachers.length>5||new Set(r.teachers).size!==r.teachers.length)return labError_(400,'Complete the required fields, confirm your grades, and choose a future arrival time.');
 const teachers=r.teachers.map(id=>staff.find(t=>t.id===id));if(teachers.some(t=>!t))return labError_(409,'The staff list changed. Refresh and select your teacher again.');
 return labLocked_(()=>{
  const records=labRecords_(),duplicate=records.find(x=>x.id===r.requestId);if(duplicate)return duplicate.email===email?{status:200,saved:true,request:labPublic_(duplicate,labOwner_(session))}:labError_(409,'Refresh the request form.');
  if(records.length>=10000)return labError_(503,'The NEST™ Request archive needs maintenance.');
  if(records.filter(x=>x.email===email&&x.day===r.day&&['pending','tabled','issued'].includes(x.state)).length>=3)return labError_(429,'You already have three open requests for this day.');
  let evidenceId;try{evidenceId=labEvidence_(r.evidence,r.requestId);}catch(_){return labError_(400,'Upload a PNG, JPEG, or WebP grade screenshot under 2 MB.');}
  if(!r.mailToken)return labError_(503,'NEST™ Request alert email is not configured. Please contact the NEST™ Lab.');
  const record={id:r.requestId,revision:1,email,name:r.lastName.trim()+', '+r.firstName.trim(),division:r.division,day:r.day,time:r.time,scheduledAt,goal:r.goal.trim(),teachers,evidenceId,gradeConfirmed:true,state:'pending',reason:'',createdAt:new Date().toISOString(),events:[],adminNotification:{at:new Date().toISOString(),emailState:'sending'}};
  const actions=labCreateTeacherActions_(record);labSave_(record);labNotifyNewRequest_(record,r.mailToken,actions);return {status:200,saved:true,request:labPublic_(record,labOwner_(session))};
 });
}
function labEscape_(text){return String(text||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function labMessage_(record,event){return labPassEmail_(record,event);}
function labSend_(record,event,token){
 const message=labMessage_(record,event),recipients=[...new Set([...record.teachers.map(t=>t.email),record.email,...(event.teacherRequested?['mpenalver@bethelsd.org']:[])])];
 const messages=recipients.map(To=>({From:'NEST Communications <communications@gknest.org>',To,ReplyTo:'mpenalver@bethelsd.org',Subject:message.subject,TextBody:message.body,HtmlBody:message.htmlBody,MessageStream:'outbound',Tag:'nest-lab-pass',Metadata:{requestId:record.id,eventId:event.id},TrackOpens:false,TrackLinks:'None'}));
 try{
  const response=UrlFetchApp.fetch('https://api.postmarkapp.com/email/batch',{method:'post',contentType:'application/json',headers:{Accept:'application/json','X-Postmark-Server-Token':token},muteHttpExceptions:true,followRedirects:false,payload:JSON.stringify(messages)});
  const results=JSON.parse(response.getContentText());if(response.getResponseCode()!==200||!Array.isArray(results)||results.length!==messages.length)throw Error('Unknown delivery');
  event.deliveries=results.map((result,i)=>({email:recipients[i],state:result.ErrorCode===0&&result.MessageID?'accepted':Number.isInteger(result.ErrorCode)&&result.ErrorCode!==0?'rejected':'unknown'}));
  event.emailState=event.deliveries.every(d=>d.state==='accepted')?'accepted':event.deliveries.every(d=>d.state==='rejected')?'rejected':event.deliveries.some(d=>d.state==='accepted')?'partial':'unknown';
 }catch(_){event.emailState='unknown';}
 labSave_(record);
}
function labDecide_(session,r){
 if(!labOwner_(session))return labError_(403,'Only the NEST™ Lab administrator can manage passes.');
 if(!labUuid_(r.id)||!labUuid_(r.eventId)||!Number.isInteger(r.revision)||!['issued','tabled','denied','checked-in'].includes(r.state))return labError_(400,'Choose a pass action.');
 return labLocked_(()=>{
  const record=labRecords_().find(x=>x.id===r.id);if(!record)return labError_(404,'The request was not found.');
  if(record.events.some(e=>e.id===r.eventId))return {status:200,saved:true,request:labPublic_(record,true)};
  if(record.revision!==r.revision)return labError_(409,'This request changed. Refresh it before continuing.');
  if(r.state==='issued'&&record.day<labDay_())return labError_(409,'The requested visit day has passed. Please submit a new request for a future visit.');
  const checkin=r.state==='checked-in';if(checkin?(record.state!=='issued'||record.day!==labDay_()):!['pending','tabled','issued'].includes(record.state))return labError_(409,'This action is not available for the current pass status or visit date.');
  let reason='';if(['tabled','denied'].includes(r.state)){
   if(r.reason==='Other'){if(!labText_(r.customReason,1000))return labError_(400,'Provide a reason.');reason=r.customReason.trim();}
   else if(!LAB_REASONS[r.state].includes(r.reason))return labError_(400,'Choose a reason.');else reason=r.reason;
  }
  if(!record.email||!record.teachers.length)return labError_(409,'This original request is missing a verified student or teacher email. Review it in the source workbook.');
  if(typeof r.mailToken!=='string'||!r.mailToken)return labError_(503,'NEST Communications email is not configured. The decision was not saved.');
  if(record.events.length>=20)return labError_(409,'This request has reached its change limit. Please submit a new request.');
  if(r.state==='issued'&&!record.scheduledAt){const scheduledAt=labSchedule_(record.day,r.time);if(!scheduledAt)return labError_(400,'Choose a future arrival time for this original form request.');record.time=r.time;record.scheduledAt=scheduledAt;}
  const event={id:r.eventId,state:r.state,reason,at:new Date().toISOString(),actor:email_(session.email),emailState:'sending'};
  record.state=r.state;record.reason=reason;record.revision++;record.events.push(event);if(checkin)record.checkedInAt=event.at;
  // Persist the decision and email reservation together before contacting Postmark.
  // A lost response never causes another send; sending/unknown needs human review.
  labSave_(record);labSend_(record,event,r.mailToken);return {status:200,saved:true,request:labPublic_(record,true)};
 });
}
function labDispatch_(session,r){
 if(typeof labUseWebsiteCredential_==='function')labUseWebsiteCredential_(r);
 const owner=labOwner_(session),email=labIdentity_(session);if(!email)return labError_(403,'A linked district account is required for NEST™ Request submissions.');
 if(r.operation==='migrate-storage')return labMigrateWebsite_(session,r);
 if(r.operation==='calendar')return labSaveCalendar_(session,r);
 if(r.operation==='alert-access')return {status:200,eligible:owner};
 if(r.operation==='decide')return labDecide_(session,r);
 if(r.operation==='submit')return labSubmit_(session,r);
 if(r.operation==='sync-staff'){if(!owner)return labError_(403,'Administrator access required.');refreshNestLabStaff();labConfigure_(r.mailToken);return {status:200,synced:true};}
 if(r.operation==='alerts'){
  if(!owner)return {status:200,eligible:false,events:[]};
  const now=new Date(),today=labDay_(now),records=labRecords_();
  const events=records.filter(x=>x.state==='pending'&&x.day>=today&&labYear_(x.day)===labYear_(today)||x.state==='issued'&&x.day===today&&Date.parse(x.scheduledAt)<=now.getTime()).map(x=>({id:x.id+':'+(x.state==='pending'?'request':'arrival'),requestId:x.id,revision:x.revision,name:x.name,day:x.day,time:x.time,kind:x.state==='pending'?'request':'arrival'}));
  for(const record of records){const event=record.events.filter(e=>e.teacherRequested===true).slice(-1)[0];if(event&&Date.parse(event.at)>=now.getTime()-7*86400000)events.push({id:record.id+':teacher-denial:'+event.id,requestId:record.id,revision:record.revision,name:record.name,day:record.day,time:record.time,kind:'teacher-denial',reason:event.reason});}
  events.sort((a,b)=>(a.kind==='arrival'?-1:1)-(b.kind==='arrival'?-1:1));return {status:200,eligible:true,events:events.slice(0,100)};
 }
 if(r.operation==='list')return labArchiveList_(session,r);
 if(r.operation==='detail'){
  const record=labRecords_().find(x=>x.id===r.id);return !record?labError_(404,'The request was not found.'):!owner&&record.email!==email?labError_(403,'This pass belongs to another account.'):{status:200,request:labPublic_(record,owner)};
 }
 if(r.operation!=='bootstrap')return labError_(400,'Invalid NEST™ Request action.');
 labStore_();if(owner){tablePastNestLabRequests();}const staff=labStaff_(false);let dailySync=true,reminderEmail=true;try{reminderEmail=labConfigure_(r.mailToken);if(!reminderEmail)dailySync=false;}catch(_){dailySync=false;reminderEmail=false;}
 const props=PropertiesService.getScriptProperties();return {status:200,owner,storage:typeof labWebsiteMode_==='function'&&labWebsiteMode_()?'website':'spreadsheet',staff:staff.map(t=>({id:t.id,name:labTeacherName_(t)})),staffSyncedAt:props.getProperty('lab-staff-synced'),staffWarning:props.getProperty('lab-staff-error')||'',dailySync,reminderEmail,currentYear:labYear_(labDay_()),divisions:labDivisions_(),reasons:LAB_REASONS,today:labDay_(),timezone:LAB_ZONE};
}

// School years follow the existing NEST August–July convention. Trimester
// boundaries use the administrator's school calendars, never equal-length guesses.
function labYear_(day){const year=Number(day.slice(0,4))-(Number(day.slice(5,7))<8?1:0);return year+'-'+(year+1);}
function labCalendars_(){
 const props=PropertiesService.getScriptProperties();return JSON.parse(props.getProperty('lab-trimester-calendars')||'null')||(typeof weatherCalendars_==='function'?weatherCalendars_():{'2026-2027':['2026-08-31','2026-11-24','2027-03-10','2027-06-15']});
}
function labTerm_(day){const dates=labCalendars_()[labYear_(day)];return !dates||day<dates[0]||day>dates[3]?'Unassigned':day<=dates[1]?'1':day<=dates[2]?'2':'3';}
function labArchiveList_(session,r){
 const owner=labOwner_(session),email=labIdentity_(session),view=r.view==='archive'?'archive':'current',year=String(r.year||labYear_(labDay_())),term=String(r.trimester||''),search=String(r.search||'').trim().toLowerCase(),student=String(r.student||''),page=Number(r.page||0),filter=String(r.filter||'');
 if(!['','pending','issued','tabled','denied','checked-in','today','open','closed'].includes(filter)||!(year==='all'&&view==='archive'||/^\d{4}-\d{4}$/.test(year))||!['','1','2','3','Unassigned'].includes(term)||search.length>100||student.length>64||!Number.isInteger(page)||page<0||page>333)return labError_(400,'Check the archive filters.');
 const all=labRecords_().filter(x=>owner||x.email===email),years=[...new Set([labYear_(labDay_()),...all.map(x=>labYear_(labArchiveDay_(x)))])].sort().reverse(),students=labStudentChoices_(all,owner),matchingEmails=new Set(all.filter(x=>x.name.toLowerCase().includes(search)||x.email.toLowerCase().includes(search)).map(x=>x.email).filter(Boolean));
 let records=all.filter(x=>(view==='current'?labYear_(labArchiveDay_(x))===labYear_(labDay_()):year==='all'||labYear_(labArchiveDay_(x))===year)&&(!term||labTerm_(labArchiveDay_(x))===term)&&(!student||hash_(x.email||x.name)===student)&&(!search||matchingEmails.has(x.email)||x.name.toLowerCase().includes(search)||x.email.toLowerCase().includes(search))&&(!filter||(filter==='open'?['pending','issued'].includes(x.state):filter==='closed'?!['pending','issued'].includes(x.state):filter==='today'?x.day===labDay_():x.state===filter)));
 records.sort((a,b)=>b.day.localeCompare(a.day)||b.createdAt.localeCompare(a.createdAt));
 const result={status:200,records:records.slice(page*30,(page+1)*30).map(x=>labPublic_(x,owner)),total:records.length,page,hasMore:records.length>(page+1)*30,years,students,currentYear:labYear_(labDay_()),calendarYears:Object.keys(labCalendars_()),calendars:owner?labCalendars_():undefined,closedCount:all.filter(x=>labYear_(labArchiveDay_(x))===labYear_(labDay_())&&!['pending','issued'].includes(x.state)).length,legacyWarning:owner&&Boolean(PropertiesService.getScriptProperties().getProperty('lab-legacy-unparsed'))&&PropertiesService.getScriptProperties().getProperty('lab-legacy-unparsed')!=='[]'?'Some original request dates need review in the source workbook.':''};
 return result;
}
function labAdminEmail_(record,event,token,kind){
 const title=kind==='request'?'New NEST™ Request':'NEST™ Lab visitor due now',url='https://gknest.org/lab-request?request='+encodeURIComponent(record.id),visit=record.day+(record.time?' at '+record.time+' Pacific':''),esc=labEscape_;
 const body=record.name+'\nRequested visit: '+visit+'\nGoal: '+record.goal+'\n\n'+(kind==='request'?'Review this request and issue, table, or deny a pass.':'This student has an approved pass. Check them in when they arrive.')+'\n'+url+'\n\n'+labEmailSignatureText_();
 const html=labEmailFrame_(record,{title:kind==='request'?'Pass requested':'Visit due now',intro:kind==='request'?'A new NEST™ Request is ready for review.':'This student has an approved pass to the NEST™ Lab.',body:[kind==='request'?'Review this request and issue, table, or deny a pass.':'Check them in when they arrive.'],tone:'brand',action:labEmailButton_(kind==='request'?'Review request':'Open pass & check in',url,'#995019')});
 try{const response=UrlFetchApp.fetch('https://api.postmarkapp.com/email',{method:'post',contentType:'application/json',muteHttpExceptions:true,followRedirects:false,headers:{Accept:'application/json','X-Postmark-Server-Token':token},payload:JSON.stringify({From:'NEST Communications <communications@gknest.org>',To:'mpenalver@bethelsd.org',Subject:title+' · '+record.name,TextBody:body,HtmlBody:html,MessageStream:'outbound',Tag:'nest-lab-alert',Metadata:{requestId:record.id,kind},TrackOpens:false,TrackLinks:'None'})});const result=JSON.parse(response.getContentText());event.emailState=response.getResponseCode()===200&&result.ErrorCode===0&&result.MessageID?'accepted':Number.isInteger(result.ErrorCode)&&result.ErrorCode!==0?'rejected':'unknown';}catch(_){event.emailState='unknown';}
}
function labConfigure_(token){
 if(typeof token!=='string'||!token)return false;
 return labLocked_(()=>{
  const props=PropertiesService.getScriptProperties();if(props.getProperty('lab-postmark-token')!==token)props.setProperty('lab-postmark-token',token);
  labInstallDaily_();if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='sendNestLabArrivalReminders'))ScriptApp.newTrigger('sendNestLabArrivalReminders').timeBased().everyMinutes(5).create();return true;
 })===true;
}
function sendNestLabArrivalReminders(){
 // This existing five-minute job also retires past-day open requests without mail.
 tablePastNestLabRequests();
 const token=PropertiesService.getScriptProperties().getProperty('lab-postmark-token');if(!token)throw Error('Lab reminder email is not configured');
 return labLocked_(()=>{
  const now=new Date(),today=labDay_(now),records=labRecords_().filter(x=>x.state==='issued'&&x.day===today&&x.scheduledAt&&Date.parse(x.scheduledAt)<=now.getTime()&&!x.arrivalReminder).slice(0,5);
  records.forEach(record=>{const event={at:now.toISOString(),emailState:'sending'};record.arrivalReminder=event;labSave_(record);labAdminEmail_(record,event,token,'arrival');labSave_(record);});return records.length;
 });
}
function labSaveCalendar_(session,r){
 if(!labOwner_(session))return labError_(403,'Only the NEST™ Lab administrator can set trimester dates.');
 if(!/^\d{4}-\d{4}$/.test(r.year||'')||Number(r.year.slice(5))!==Number(r.year.slice(0,4))+1||!Array.isArray(r.dates)||r.dates.length!==4||r.dates.some((d,i)=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d||labYear_(d)!==r.year||i>0&&r.dates[i-1]>=d))return labError_(400,'Enter four valid dates in order within this school year.');
 return labLocked_(()=>{const calendars=labCalendars_();calendars[r.year]=r.dates;PropertiesService.getScriptProperties().setProperty('lab-trimester-calendars',JSON.stringify(calendars));return {status:200,saved:true};});
}
function labArchiveDay_(record){
 if(!record.legacy)return record.day;
 // Some original rows contain year 0024 or a birth year. Preserve their
 // requested dates, but do not invent historical school-year groupings.
 const distance=Math.abs(Date.parse(record.day+'T12:00:00Z')-Date.parse(record.createdAt));
 return Number(record.day.slice(0,4))<2000||!Number.isFinite(distance)||distance>370*86400000?labDay_(new Date(record.createdAt)):record.day;
}
function labStudentChoices_(records,owner){
 const map=new Map(),unknown=name=>/^(?:name not found|name not recorded|unknown)$/i.test(String(name).trim());
 records.forEach(record=>{const key=hash_(record.email||record.name),existing=map.get(key);if(!existing||unknown(existing.name)&&!unknown(record.name))map.set(key,{id:key,name:unknown(record.name)?'Name not recorded':record.name,email:record.email});});
 const counts={};map.forEach(x=>counts[x.name]=(counts[x.name]||0)+1);
 return [...map.values()].map(x=>({id:x.id,name:x.name+(owner&&x.email&&(unknown(x.name)||counts[x.name]>1)?' · '+x.email:'')})).sort((a,b)=>a.name.localeCompare(b.name));
}

function labAutoTableRecords_(records,now){
 const today=labDay_(now),at=now.toISOString(),changed=[];
 records.forEach(record=>{
  if(!['pending','issued'].includes(record.state)||typeof record.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(record.day)||record.day>=today)return;
  const reason='Automatically tabled because the requested visit day has passed.';
  record.state='tabled';record.reason=reason;record.revision++;
  record.events.push({id:'auto-table:'+record.id+':'+record.day,state:'tabled',reason,at,actor:'system',emailState:'not-sent'});
  changed.push(record);
 });
 return changed;
}
function tablePastNestLabRequests(){
 return labLocked_(()=>{
  const changed=labAutoTableRecords_(labRecords_(),new Date());
  if(changed.length&&typeof labWebsiteMode_==='function'&&labWebsiteMode_()){labWebsiteSave_(changed);return changed.length;}
  if(changed.length)Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data:changed.map(record=>{
   const {_row,...data}=record;return {range:"'Requests'!A"+_row+':B'+_row,values:[[record.id,JSON.stringify(data)]]};
  })},labStore_());
  // No mail reservation, email provider call, or recipient notification occurs here.
  return changed.length;
 });
}
