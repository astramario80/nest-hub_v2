// Division-scoped safety workspace. Legacy form and recorder remain intact.
const SAFETY_BOOK='17Z0REO0cjdqqRAdz_BxImj-4qKaZRYlAasxX3EORmfQ';
const SAFETY_ROSTER='12XogWM3af3PLIvEyrFR39hzkI0kEmfiCZkr66y3eDcU';
function safetyPeriod_(value){return String(value||'').replace(/period\s*/ig,'').trim().toUpperCase();}
function safetyDate_(value){const date=new Date(value);return isNaN(date.getTime())?'':Utilities.formatDate(date,'America/Los_Angeles','yyyy-MM-dd');}
function safetyAccess_(r){
 if(!Object.prototype.hasOwnProperty.call(PERIODS,r.period))return {status:400};
 const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());if(!session)return {status:401};
 const email=memberEmail_(session.email,r.period),roster=rows_(r.period),member=roster.find(row=>email_(row[1])===email),owner=websiteAdmin_(session.email);
 if(staffIdentity_(session.email)&&!staffRole_(session.email,r.period))return {status:403};
 if(!member&&!owner&&!staffRole_(session.email,r.period))return {status:403};
 const leaders=nestAccessValues_(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
 const roles=leaders.filter(row=>safetyPeriod_(row[0])===r.period&&email_(row[4])===email).map(row=>String(row[2]||'').trim());
 const canInspectFlights=owner||staffManager_(session.email,r.period)||!staffIdentity_(session.email)&&roles.some(role=>/^(safety officer|division manager|assistant manager|director of inventory|inventory director)$/i.test(role));
 return {status:200,session,email,canInspectFlights,name:member?String(member[0]):session.username,owner,canManage:owner||staffManager_(session.email,r.period)||!staffIdentity_(session.email)&&roles.some(role=>/^(safety officer|division manager|assistant manager)$/i.test(role))};
}
function safetyEvents_(book,period){
 const sheet=book.getSheetByName('SafetyWebEvents');if(!sheet||sheet.getLastRow()<2)return [];
 if(sheet.getLastRow()>25000)throw Error('Safety log requires archiving');
 return sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues().filter(row=>String(row[1])===period).map(row=>({time:new Date(row[0]).toISOString(),actor:String(row[2]),op:String(row[3]),request:String(row[4]),data:JSON.parse(row[5])}));
}
function safetyState_(events){
 const state={enabled:false,queue:[],messages:[],resolved:{},noFly:{},flightSettings:null};
 events.forEach(e=>{
  const d=e.data;
  if(e.op==='no-fly-add')state.noFly[d.id]={time:e.time,reason:d.reason||'Legacy restriction',notes:d.notes||'',createdBy:d.createdBy||e.actor};
  if(e.op==='no-fly-remove')delete state.noFly[d.id];
  if(e.op==='flight-settings')state.flightSettings={...(state.flightSettings?.date===d.date?state.flightSettings:{}),...d,publishedAt:e.time};
  if(e.op==='queue-toggle')state.enabled=d.enabled;
  if(e.op==='queue-join')state.queue.push({id:e.request,actor:e.actor,name:d.name,time:e.time,status:'waiting'});
  if(['queue-cancel','queue-return','queue-out'].includes(e.op)){const entry=state.queue.find(x=>x.id===d.id);if(entry)entry.status=e.op==='queue-out'?'out':e.op==='queue-return'?'returned':'cancelled';}
  if(e.op==='message')state.messages.push({id:e.request,actor:e.actor,name:d.name,text:d.text,time:e.time});
  if(e.op==='message-remove')state.messages=state.messages.filter(m=>m.id!==d.id);
  if(e.op==='maintenance-resolve')state.resolved[d.id]=true;
  if(e.op==='maintenance-reopen')delete state.resolved[d.id];
 });
 return state;
}
function safetyRoster_(){
 return (nestAccessValues_(SAFETY_ROSTER,"'EnrolledStudents'!A8:H5000").values||[]).map(row=>({course:String(row[7]||'').trim().toUpperCase(),email:email_(row[0]),name:String(row[5]||'').trim(),period:safetyPeriod_(row[6])})).filter(x=>x.email&&x.name);
}
function safetyFlightStatus_(row){
 const flags=[];let incomplete=false;
 for(let c=5;c<=17;c++){
  const value=String(row[c]||'').trim().toLowerCase();
  if(value==='no'||value==='no-go')flags.push(SAFETY_FIELDS.find(f=>f.column===c).label);
  if(!value)incomplete=true;
 }
 let imsafe=false;
 for(let c=24;c<=29;c++){const value=String(row[c]||'').trim().toLowerCase();if(value==='yes')imsafe=true;if(!value)incomplete=true;}
 if(imsafe)flags.push('IMSAFE requires flight supervisor review');
 for(const c of [18,19,20,21,22,23,30,32,36,37])if(!String(row[c]||'').trim())incomplete=true;
 return {status:flags.length?'No-Go':incomplete?'Incomplete':'Go',flags};
}
function safetyRecords_(book,roster){
 const sheet=book.getSheetByName('PreFlight/PostFlight');if(!sheet)throw Error('Missing flight recorder');
 const count=sheet.getLastRow()-1;if(count<1)return [];if(count>15000)throw Error('Flight archive needs review');
 const attachments=new Map(safetyAllEvents_(book).filter(e=>e.op==='submit'&&e.data.photos?.length).map(e=>[e.actor+'|'+Math.floor(Date.parse(e.time)/1000)+'|'+e.data.photos[0],e.data.photos]));
 const rows=sheet.getRange(2,1,count,38).getValues(),rich=sheet.getRange(2,2,count,1).getRichTextValues();
 const emails=new Map(roster.map(x=>[x.email,x])),names=new Map();roster.forEach(x=>{if(names.has(x.name))names.set(x.name,null);else names.set(x.name,x);});
 return rows.map((row,i)=>{
  const link=rich[i][0]?.getLinkUrl()||'',who=emails.get(email_(link.startsWith('mailto:')?link.slice(7):row[1]))||names.get(String(row[1]||'').trim());
  if(!who||!['Pre-Flight','Post-Flight'].includes(row[2])||!safetyDate_(row[0]))return null;
  const timestamp=new Date(row[0]).toISOString(),id=hash_(JSON.stringify([timestamp,who.email,row[2],String(row[32]||''),row.slice(3).map(String)]));
  const result=row[2]==='Pre-Flight'?safetyFlightStatus_(row):{status:'Completed',flags:[]};
  return {id,email:who.email,name:who.name,period:who.period,date:safetyDate_(row[0]),time:timestamp,type:row[2],aircraft:String(row[32]||''),...result,maintenance:row[2]==='Post-Flight'&&(String(row[3]).toLowerCase()==='yes'||Boolean(row[31]||row[4]||row[34])),issue:String(row[31]||row[4]||''),cause:String(row[34]||''),prevention:String(row[35]||''),photo:String(row[33]||''),photos:attachments.get(who.email+'|'+Math.round(Date.parse(timestamp)/1000)+'|'+String(row[33]||''))||(String(row[33]||'').startsWith('safety-media/')?[String(row[33])]:[])};
 }).filter(Boolean).sort((a,b)=>b.time.localeCompare(a.time));
}
function safetyView_(access,r,book,events){
 const day=r.date||safetyDate_(new Date());if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return {status:400};
 const state=safetyState_(events),roster=safetyRoster_().filter(x=>x.period===r.period),records=safetyRecords_(book,roster),scoped=access.canManage?records:records.filter(x=>x.email===access.email),today=safetyDate_(new Date());
 const restricted=safetyRestrictionLookup_(book);const archiveEvents=access.owner?safetyAllEvents_(book):[],archiveDone=new Set(archiveEvents.filter(e=>e.op==='drive-archived').map(e=>e.period+'|'+e.data.reportId)),archiveReports=archiveEvents.filter(e=>['flight-review','flight-complete','submit'].includes(e.op));
 const queue=state.queue.filter(x=>['waiting','out'].includes(x.status)&&(x.status==='out'||safetyDate_(x.time)===today)).map(x=>({id:x.id,name:x.name,time:x.time,status:x.status,mine:x.actor===access.email,held:restricted(hash_(x.actor))}));
 const messages=state.messages.filter(x=>safetyDate_(x.time)===today).slice(-40).map(x=>({id:x.id,name:x.name,text:x.text,time:x.time,mine:x.actor===access.email}));
 const daily=scoped.filter(x=>x.date===day).map(({email,photo,photos,...row})=>({...row,maintenanceResolved:Boolean(state.resolved[row.id]),photoCount:photos.length,hasPhoto:photo.startsWith('safety-media/'),legacyPhoto:Boolean(photo)&&!photo.startsWith('safety-media/')}));
 const expected=roster.filter(s=>s.course==='DRONE PILOTING'||records.some(x=>x.email===s.email&&x.date===day));
 const students=(access.canManage?expected:expected.filter(x=>x.email===access.email)).map(s=>{
  const own=records.filter(x=>x.email===s.email&&x.date===day),pre=own.find(x=>x.type==='Pre-Flight'),post=own.find(x=>x.type==='Post-Flight'&&(!pre||x.aircraft===pre.aircraft));
  return {name:s.name,pre:pre?.status||'Missing',preTime:pre?.time||'',post:post?(pre&&post.time<pre.time?'Needed after latest pre-flight':'Completed'):'Missing',aircraft:pre?.aircraft||post?.aircraft||''};
 });
 const maintenance=scoped.filter(x=>x.maintenance&&!state.resolved[x.id]).map(({email,photo,photos,...row})=>({...row,maintenanceResolved:Boolean(state.resolved[row.id]),photoCount:photos.length,hasPhoto:photo.startsWith('safety-media/'),legacyPhoto:Boolean(photo)&&!photo.startsWith('safety-media/')}));
 return {status:200,actorKey:hash_(access.email),period:r.period,date:day,today,...(access.owner?{reportArchiveStatus:{archived:archiveReports.filter(e=>archiveDone.has(e.period+'|'+e.request)).length,pending:archiveReports.filter(e=>!archiveDone.has(e.period+'|'+e.request)).length}}:{}),...(access.owner&&safetyDriveRootId_()?{reportArchiveUrl:'https://drive.google.com/drive/folders/'+safetyDriveRootId_()}:{}),flightTransitions:safetyFlightTransitions_(book),...safetyClearanceView_(access,book,events),flightSettings:state.flightSettings?.date===today?state.flightSettings:null,...(access.canManage?safetyLeaderPanel_(access,r.period,book,state):{}),canInspectFlights:access.canInspectFlights,canManage:access.canManage,isOwner:access.owner,canFly:true,canSubmit:safetyNoFlyRoster_().students.some(s=>s.email===access.email&&s.enrollments.some(e=>e.period===r.period)),queueEnabled:state.enabled,queue,messages,students,records:daily,maintenance,resolvedMaintenance:access.canManage?scoped.filter(x=>x.maintenance&&state.resolved[x.id]).slice(0,40).map(({email,photo,photos,...row})=>row):[],updatedAt:new Date().toISOString()};
}
function safetyValidateFlight_(r){
 if(!['Pre-Flight','Post-Flight'].includes(r.type)||!r.answers||typeof r.answers!=='object'||Array.isArray(r.answers))return null;
 const row=Array(38).fill('');row[2]=r.type;
 const post=r.type==='Post-Flight',mode=post?'post':'pre';
 const held=!post&&Object.keys(r.answers).some(key=>{const c=Number(key),v=String(r.answers[key]).toLowerCase();return c>=5&&c<=17&&(v==='no'||v==='no-go')||c>=24&&c<=29&&v==='yes';});
 for(const field of SAFETY_FIELDS){
  if(field.mode!=='both'&&field.mode!==mode)continue;
  const value=r.answers[field.column];
  if(post&&[31,34,35].includes(field.column)&&r.answers[3]!=='Yes')continue;
  if((value===undefined||value==='')&&held&&field.column!==32)continue;
  if(typeof value!=='string'||!value.trim()||value.length>(field.options?100:3000)||field.options&&!field.options.includes(value))return null;
  row[field.column]=value.trim();
 }
 const photos=r.photos===undefined?(r.photo?[r.photo]:[]):r.photos;
 if(!Array.isArray(photos)||photos.length>8||new Set(photos).size!==photos.length||photos.some(p=>typeof p!=='string'||!/^safety-media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(p)))return null;
 if(post&&r.answers[3]==='Yes'){
  if(!/^safety-media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(photos[0]||''))return null;
  row[33]=photos[0];
 }
 return row;
}
function safetyAppend_(book,period,access,r,data,flight){
 if(flight){const headers=book.getSheetByName('PreFlight/PostFlight').getRange(1,1,1,38).getValues()[0];if(headers[0]!=='Timestamp'||headers[1]!=='Email Address'||headers[2]!=='Is this a Pre-Flight or Post-Flight?'||headers[32]!=='What number is your aircraft?')throw Error('Flight recorder columns changed; review before writing');}
 let log=book.getSheetByName('SafetyWebEvents');if(!log){log=book.insertSheet('SafetyWebEvents');log.getRange(1,1,1,6).setValues([['Time','Division','Actor','Operation','Request ID','Data']]);log.hideSheet();}
 const cells=values=>({values:values.map(value=>({userEnteredValue:{stringValue:String(value)}}))});
 const submittedAt=new Date();
 const requests=[{appendCells:{sheetId:log.getSheetId(),rows:[cells([submittedAt.toISOString(),period,access.email,r.operation,r.requestId,JSON.stringify(data)])],fields:'userEnteredValue'}}];
 if(flight){
  // Serial timestamp is a native Sheets date; other fields stay RAW strings.
  const row=cells(flight);row.values[0]={userEnteredValue:{numberValue:0}};
  // Use timezone-derived wall time rather than a fixed daylight-saving offset.
  const wall=Utilities.formatDate(submittedAt,'America/Los_Angeles',"yyyy-MM-dd'T'HH:mm:ss");row.values[0].userEnteredValue.numberValue=(Date.parse(wall+'Z')-Date.UTC(1899,11,30))/86400000;
  row.values[0].userEnteredFormat={numberFormat:{type:'DATE_TIME',pattern:'M/d/yyyy H:mm:ss'}};
  requests.push({appendCells:{sheetId:book.getSheetByName('PreFlight/PostFlight').getSheetId(),rows:[row],fields:'userEnteredValue,userEnteredFormat.numberFormat'}});
 }
 Sheets.Spreadsheets.batchUpdate({requests},SAFETY_BOOK);
}
function safetyDispatch_(r){
 if(r.operation==='notifications')return safetyNotifications_(r);
 if(['catalog','archive','current-flight-log'].includes(r.operation))return safetyFlightReads_(r);
 const access=safetyAccess_(r);if(access.status!==200)return access;
 const book=SpreadsheetApp.openById(SAFETY_BOOK);
 if(r.operation==='report'){if(!access.canInspectFlights)return {status:403};const event=safetyEvents_(book,r.period).find(e=>e.request===r.id&&['flight-start','flight-review','flight-complete','submit'].includes(e.op));return event?{status:200,report:safetyReport_(access,r.period,book,event)}:{status:404};}
 if(['drive-storage-setup','drive-storage-sync'].includes(r.operation)){if(!access.owner)return {status:403};return safetyDriveWorker_({operation:r.operation==='drive-storage-setup'?'setup':'sync',install:r.operation==='drive-storage-sync'});}
 if(['photo-prepare','photo-complete'].includes(r.operation))return safetyDriveUpload_(access,r,book);
 if(r.operation==='photo-check')return safetyDrivePhotoCheck_(access,r,safetyEvents_(book,r.period));
 if(r.operation==='media'){const record=safetyRecords_(book,safetyRoster_().filter(x=>x.period===r.period)).find(x=>x.id===r.id);if(!record||!access.canInspectFlights&&record.email!==access.email||!Number.isInteger(r.index??0))return {status:404};const path=record.photos[r.index??0];if(!path?.startsWith('safety-media/'))return {status:404};const event=safetyDrivePhotoEvent_(safetyEvents_(book,r.period),path);if(event){const file=safetyDrivePhotoReady_(event,record.email);return file?{status:200,photo:path,driveId:file.driveId,readToken:ScriptApp.getOAuthToken()}:{status:404};}return {status:200,photo:path};}
 if(r.operation==='view')return safetyView_(access,r,book,safetyEvents_(book,r.period));
 if(!/^[a-f0-9-]{36}$/.test(r.requestId||''))return {status:400};
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
 try{
  const events=safetyEvents_(book,r.period),state=safetyState_(events),today=safetyDate_(new Date());
  if([...events,...(r.operation==='clearance-code'?safetyEvents_(book,'*'):[])].some(e=>e.request===r.requestId&&e.actor===access.email))return {status:200,saved:true,duplicate:true};
  if(['clearance-code','flight-review','flight-release','flight-complete','flight-cancel'].includes(r.operation))return safetyClearanceMutation_(access,r,book,events);
  let data={},flight=null;
  const entry=state.queue.find(x=>x.id===r.id),active=state.queue.filter(x=>['waiting','out'].includes(x.status)&&(x.status==='out'||safetyDate_(x.time)===today));
  if(['no-fly-add','no-fly-remove'].includes(r.operation)){
   if(!access.canManage)return {status:403};if(!safetyNoFlyRoster_().students.some(s=>hash_(s.email)===r.id&&s.enrollments.some(e=>e.period===r.period)))return {status:404};if(r.operation==='no-fly-add'&&(!SAFETY_REASONS.includes(r.reason)||typeof r.notes!=='string'||r.notes.length>2000||r.reason==='Custom reason'&&!r.notes.trim()))return {status:400,error:'Choose a reason and keep notes under 2,000 characters.'};data={id:r.id,reason:r.operation==='no-fly-add'?r.reason:state.noFly[r.id]?.reason||'Legacy restriction',notes:r.operation==='no-fly-add'?r.notes:state.noFly[r.id]?.notes||'',createdBy:access.name,studentName:safetyNoFlyRoster_().students.find(s=>hash_(s.email)===r.id)?.name||''};
  }else if(r.operation==='flight-start'){if(!safetyNoFlyRoster_().students.some(s=>s.email===access.email&&s.enrollments.some(e=>e.period===r.period)))return {status:403};if(!SAFETY_FIELDS.find(f=>f.column===32).options.includes(r.aircraft))return {status:400};if(events.some(e=>e.op==='flight-start'&&e.actor===access.email&&Date.now()-Date.parse(e.time)<300000))return {status:200,saved:true};data={name:access.name,aircraft:r.aircraft};
  }else if(r.operation==='flight-transition'){
   if(!access.canManage)return {status:403};if(!safetyNoFlyRoster_().students.some(s=>s.enrollments.some(e=>e.period===r.period&&safetyDrone_(e.prep))))return {status:403};if(!Number.isInteger(r.transitionMinutes)||r.transitionMinutes<0||r.transitionMinutes>60)return {status:400,error:'Choose a whole number from 0 to 60 minutes before the bell.'};data={date:today,minutes:r.transitionMinutes};
  }else if(r.operation==='flight-settings'){
   if(!access.canManage)return {status:403};data=safetySettingsPatch_(r.settings,today);if(!data)return {status:400,error:'Choose a valid daily setting.'};
  }else if(r.operation==='queue-join'){
   if(!state.enabled||active.some(x=>x.actor===access.email)||active.length>=100)return {status:409,error:'The queue is closed or you are already in line.'};data={name:access.name};
  }else if(r.operation==='queue-toggle'){
   if(!access.canManage)return {status:403};if(typeof r.enabled!=='boolean')return {status:400};data={enabled:r.enabled};
  }else if(['queue-cancel','queue-return','queue-out'].includes(r.operation)){
   if(!entry||!active.includes(entry))return {status:409};
   if(!access.canManage&&(entry.actor!==access.email||r.operation==='queue-out'))return {status:403};
   if(r.operation==='queue-out'&&safetyRestrictionLookup_(book)(hash_(entry.actor)))return {status:403,error:'Please see Mr. Peñalver to find out more information.'};
   if(r.operation==='queue-out'&&(entry.status!=='waiting'||active.some(x=>x.status==='out')||active.find(x=>x.status==='waiting'&&!safetyRestrictionLookup_(book)(hash_(x.actor)))?.id!==entry.id))return {status:409,error:'Only the next student may leave, after the current student returns.'};
   if(r.operation==='queue-return'&&entry.status!=='out'||r.operation==='queue-cancel'&&entry.status!=='waiting')return {status:409};data={id:entry.id};
  }else if(r.operation==='message'){
   if(typeof r.text!=='string'||!r.text.trim()||r.text.length>500)return {status:400};
   if(events.some(e=>e.actor===access.email&&e.op==='message'&&Date.now()-Date.parse(e.time)<10000))return {status:429};data={name:access.name,text:r.text.trim()};
  }else if(r.operation==='message-remove'){
   const message=state.messages.find(m=>m.id===r.id);if(!message)return {status:409};if(!access.canManage&&message.actor!==access.email)return {status:403};data={id:r.id};
  }else if(['maintenance-resolve','maintenance-reopen'].includes(r.operation)){
   if(!access.canManage)return {status:403};if(!safetyRecords_(book,safetyRoster_().filter(x=>x.period===r.period)).some(x=>x.id===r.id&&x.maintenance))return {status:404};data={id:r.id};
  }else if(r.operation==='submit'){
   if(r.type==='Pre-Flight')return {status:409,error:'Send the checklist for review and complete the clearance step first.'};
   if(!safetyNoFlyRoster_().students.some(s=>s.email===access.email&&s.enrollments.some(e=>e.period===r.period)))return {status:403};
   const photoCheck=safetyDrivePhotoCheck_(access,{paths:r.photos||(r.photo?[r.photo]:[]),reportId:r.requestId},events);if(photoCheck.status!==200)return photoCheck;flight=safetyValidateFlight_(r);if(!flight)return {status:400,error:'Complete every required field, including a damage photo when maintenance is needed.'};flight[1]=access.email;data={type:r.type,trimester:safetyNoFlyRoster_().trimester,photos:flight[33]?(r.photos?.length?r.photos:[r.photo]):[]};
  }else return {status:400};
  safetyAppend_(book,r.period,access,r,data,flight);
  return {status:200,saved:true,...(r.operation==='queue-join'&&safetyRestrictionLookup_(book)(hash_(access.email))?{needsTeacher:true,message:'Please see Mr. Peñalver to find out more information.'}:{}),...(flight&&r.type==='Pre-Flight'?{flightStatus:safetyFlightStatus_(flight).status}: {})};
 }finally{lock.releaseLock();}
}
function safetyNoFlyRoster_(){
 const year=(nestAccessValues_(NEST_DATABASE,"'Schedule'!A2").values||[])[0]?.[0],tri=(nestAccessValues_(NEST_DATABASE,"'Schedule'!B6").values||[])[0]?.[0];
 const trimester=noFlyTerm_(year,tri),rows=nestAccessValues_(SAFETY_ROSTER,"'CombinedStudentList'!A2:F5000").values||[];
 return {trimester,students:noFlyRosterFromRows_(rows,trimester)};
}
function safetyLeaderPanel_(access,period,book,state){
 const roster=safetyNoFlyRoster_(),selected=roster.students.filter(s=>s.enrollments.some(e=>e.period===period));
 const members=selected.map(s=>({id:hash_(s.email),email:s.email,name:s.name}));
 let official=null;const source=book.getSheetByName('SafetySchoolNoFly');if(source){try{official=JSON.parse(source.getRange('A1').getValue()||'null');}catch(_){}}
 const school=new Set((official?.matches||[]).map(x=>email_(x.email)));
 const visible=(access.owner?roster.students:selected).filter(s=>school.has(s.email)||selected.some(m=>m.email===s.email)&&state.noFly[hash_(s.email)]);
 const noFly=visible.map(s=>({id:hash_(s.email),name:s.name,school:school.has(s.email),division:s.enrollments.some(e=>e.period===period)&&Boolean(state.noFly[hash_(s.email)]),periods:access.owner?[...new Set(s.enrollments.map(e=>e.period))]:[period],addedAt:state.noFly[hash_(s.email)]?.time||'',reason:state.noFly[hash_(s.email)]?.reason||'',notes:state.noFly[hash_(s.email)]?.notes||'',createdBy:state.noFly[hash_(s.email)]?.createdBy||''}));
 return {restrictionHistory:safetyRestrictionHistory_(access,period,book),restrictionReasons:SAFETY_REASONS,noFly,noFlyScope:access.owner?'all-current-divisions':'selected-division',activeTrimester:roster.trimester,members:members.map(({email,...m})=>m),noFlySync:{status:official?.status||'not-initialized',trimester:official?.trimester||'',rosterSource:official?.rosterSource||'',checkedAt:official?.checkedAt||'',lastSuccessAt:official?.lastSuccessAt||'',sourceReceivedAt:official?.sourceReceivedAt||'',documentDate:official?.documentDate||'',sourceSubject:official?.sourceSubject||'',ambiguousCount:official?.ambiguousCount||0,error:official?.error||''}};
}
// Use the native spreadsheet reader for this workspace. This avoids amplifying
// the shared Advanced Sheets API read quota, and never caches access between requests.
function safetyReadContext_(r,work){
 const previous=NEST_ACCESS_READS;NEST_ACCESS_READS=new Map();
 try{
  const control=SpreadsheetApp.openById(NEST_DATABASE);
  const read=(book,id,title,key,start,column,width,limit)=>{const sheet=book.getSheetByName(title);if(!sheet)throw Error('Safety source is unavailable: '+title);const count=Math.max(1,Math.min(limit||sheet.getLastRow(),sheet.getLastRow())-start+1),columns=Math.min(width,sheet.getMaxColumns()-column+1);const values=sheet.getRange(start,column,count,columns).getDisplayValues();NEST_ACCESS_READS.set(id+':'+key,values);};
  read(control,NEST_DATABASE,'StudentNESTAccess',AUTH_SHEET,2,1,12);
  const schedule=control.getSheetByName('Schedule');if(!schedule)throw Error('Schedule is unavailable');for(const cell of ['A2','B6'])NEST_ACCESS_READS.set(NEST_DATABASE+":'Schedule'!"+cell,[[schedule.getRange(cell).getDisplayValue()]]);
  const notifications=r.operation==='notifications';
  if(notifications)read(SpreadsheetApp.openById(LEADERSHIP_DATABASE),LEADERSHIP_DATABASE,'Imported',"'Imported'!B2:F",2,2,5);
  const session=notifications?authSession_(r.session,PropertiesService.getScriptProperties(),Date.now()):null;
  const contextPeriods=notifications?(session?safetyNotificationCandidates_(session):[]):Object.prototype.hasOwnProperty.call(PERIODS,r.period)?[r.period]:[];
  if(!notifications||contextPeriods.length)read(SpreadsheetApp.openById(SAFETY_ROSTER),SAFETY_ROSTER,'CombinedStudentList',"'CombinedStudentList'!A2:F5000",2,1,6,5000);
  if(contextPeriods.length){
   for(const period of contextPeriods){const title=period==='CTSO'?'CTSO':'Period '+period;read(control,NEST_DATABASE,title,"'"+title+"'!A2:C1000",2,1,3,1000);}
   if(!notifications){read(SpreadsheetApp.openById(LEADERSHIP_DATABASE),LEADERSHIP_DATABASE,'Imported',"'Imported'!B2:F",2,2,5);read(SpreadsheetApp.openById(SAFETY_ROSTER),SAFETY_ROSTER,'EnrolledStudents',"'EnrolledStudents'!A8:H5000",8,1,8,5000);}
  }
  return work();
 }finally{NEST_ACCESS_READS=previous;}
}

// Each daily setting is independent; event replay merges only within the same day.
function safetySettingsPatch_(settings,date){
 if(!settings||typeof settings!=='object'||Array.isArray(settings))return null;
 const keys=Object.keys(settings).filter(k=>['channel','ceiling','location','locationDetails'].includes(k));if(!keys.length)return null;
 if(keys.includes('channel')&&!/^([1-9]|1[0-6])$/.test(settings.channel))return null;
 if(keys.includes('ceiling')&&(typeof settings.ceiling!=='string'||!settings.ceiling.trim()||settings.ceiling.length>100))return null;
 if(keys.includes('location')&&!['Baseball field','Football Field','Bus Zone','Front entrance','NEST™ Courtyard','Other'].includes(settings.location))return null;
 if(keys.includes('locationDetails')&&!keys.includes('location'))return null;
 if(settings.location==='Other'&&(typeof settings.locationDetails!=='string'||!settings.locationDetails.trim()||settings.locationDetails.length>100))return null;
 const result={date};for(const k of keys)result[k]=typeof settings[k]==='string'?settings[k].trim():settings[k];if(keys.includes('location')&&settings.location!=='Other')result.locationDetails='';return result;
}
