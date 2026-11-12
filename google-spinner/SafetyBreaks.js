const SAFETY_REASONS=['Too many breaks during the period','Exceeded the school break time limit','Did not go to the stated destination','Returned without checking in','Classroom safety concern','Teacher-directed restriction','Custom reason'];
function safetyAllEvents_(book){const sheet=book.getSheetByName('SafetyWebEvents');if(!sheet||sheet.getLastRow()<2)return [];if(sheet.getLastRow()>25000)throw Error('Safety history needs archiving');return sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues().map(row=>({period:String(row[1]),time:new Date(row[0]).toISOString(),actor:String(row[2]),op:String(row[3]),request:String(row[4]),data:JSON.parse(row[5])}));}
function safetyRestrictionLookup_(book){
 const active=new Map();for(const e of safetyAllEvents_(book)){if(!['no-fly-add','no-fly-remove'].includes(e.op))continue;const key=e.period+'|'+e.data.id;if(e.op==='no-fly-add')active.set(key,e);else active.delete(key);}
 let school=[];const sheet=book.getSheetByName('SafetySchoolNoFly');if(sheet){try{school=JSON.parse(sheet.getRange('A1').getValue()||'{}').matches||[];}catch{}}
 const ids=new Set([...active.values()].map(e=>e.data.id));school.forEach(s=>ids.add(hash_(email_(s.email))));return id=>ids.has(id);
}
function safetyRestrictionHistory_(access,period,book){
 const roster=safetyNoFlyRoster_().students,members=new Map(roster.map(s=>[hash_(s.email),s.name]));
 return safetyAllEvents_(book).filter(e=>['no-fly-add','no-fly-remove'].includes(e.op)&&(access.owner||e.period===period)).map(e=>({id:e.request,studentId:e.data.id,name:members.get(e.data.id)||e.data.studentName||'Former division member',period:e.period,time:e.time,action:e.op==='no-fly-add'?'Added':'Removed',reason:e.data.reason||'Legacy restriction',notes:e.data.notes||'',createdBy:e.data.createdBy||e.actor})).reverse();
}
function safetyReport_(access,period,book,event){
 const d=event.data,base={id:event.request,period,time:event.time,name:d.name||safetyNoFlyRoster_().students.find(s=>s.email===event.actor)?.name||'Division member',kind:'Flight activity',fields:[]};
 if(event.op==='flight-start')return {...base,kind:'Pre-flight in progress',aircraft:d.aircraft||''};
 if(event.op==='flight-review'){
  const row=safetyValidateFlight_({type:'Pre-Flight',answers:{...d.answers,30:'REVIEW'}}),result=row?safetyFlightStatus_(row):{status:'Incomplete',flags:[]};return {...base,kind:result.status==='No-Go'?'No-Go report':'Pre-flight awaiting clearance',aircraft:d.answers?.[32]||'',flags:result.flags,fields:SAFETY_FIELDS.filter(f=>f.column>=5&&f.column<=23||[32,36,37].includes(f.column)).map(f=>({label:f.label,value:d.answers?.[f.column]||''})).concat(d.metarObservation?[{label:'METAR flight observations',value:d.metarObservation}]:[])};
 }
 if(event.op==='flight-complete')return {...base,kind:'Cleared for takeoff',aircraft:safetyDrafts_(safetyEvents_(book,period)).find(f=>f.id===d.id)?.answers?.[32]||''};
 if(event.op==='submit'){
  const raw=safetyRecords_(book,safetyNoFlyRoster_().students.filter(s=>s.enrollments.some(e=>e.period===period)).map(s=>({email:s.email,name:s.name,period}))).find(f=>f.email===event.actor&&Math.abs(Date.parse(f.time)-Date.parse(event.time))<2000&&f.type===d.type&&(!d.photos?.length||f.photo===d.photos[0]));if(!raw)return {...base,kind:d.type||'Flight checklist'};
  return {...base,kind:raw.maintenance?'Crash / maintenance report':'Post-flight completed',aircraft:raw.aircraft,hasPhoto:Boolean(raw.photo),photoCount:raw.photos.length,photoId:raw.photo.startsWith('safety-media/')?raw.id:'',fields:raw.maintenance?[{label:'Issue',value:raw.issue},{label:'Cause',value:raw.cause},{label:'Prevention',value:raw.prevention}]:[]};
 }
 return base;
}
const SAFETY_CALENDAR='c_cce2b2e20fdcd5b4eb8ff90f6ff6aea1eb1b7ed99ec2b1cb2aafadf5f8fdd9f3@group.calendar.google.com';
function safetyCalendarNotices_(){
 try{const now=new Date(),calendar=CalendarApp.getCalendarById(SAFETY_CALENDAR);if(!calendar)return {calendarStatus:'unavailable',calendarEvents:[]};return {calendarStatus:'ready',calendarEvents:calendar.getEvents(now,new Date(now.getTime()+14*86400000)).slice(0,30).map(e=>({id:hash_(e.getId()+'|'+e.getStartTime().toISOString()),title:e.getTitle(),allDay:e.isAllDayEvent(),flyDay:e.isAllDayEvent()&&/\b(?:fly|flight)[\s-]*day\b/i.test(e.getTitle()),time:e.getStartTime().toISOString(),end:e.getEndTime().toISOString(),url:'https://calendar.google.com/calendar/u/0/r?cid='+encodeURIComponent(SAFETY_CALENDAR)}))};}catch{return {calendarStatus:'unavailable',calendarEvents:[]};}
}
function safetyFlyDayState_(calendar=safetyCalendarNotices_()){const now=new Date();return {flyDayDate:safetyDate_(now),flyDayStatus:calendar.calendarStatus,flyDay:calendar.calendarStatus==='ready'&&calendar.calendarEvents.some(e=>e.flyDay===true&&Date.parse(e.time)<=now.getTime()&&Date.parse(e.end)>now.getTime())};}
function safetyNotificationCandidates_(session){
 if(websiteAdmin_(session.email))return Object.keys(PERIODS);
 if(staffIdentity_(session.email))return Object.keys(PERIODS).filter(p=>staffManager_(session.email,p));
 const key=email_(session.email),account=key.startsWith('manual:')?accountByEmail_(key):null,actor=account?.linkedEmail||key,leaders=nestAccessValues_(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
 return [...new Set(leaders.filter(row=>email_(row[4])===actor&&/^(safety officer|division manager|assistant manager|director of inventory|inventory director)$/i.test(String(row[2]||'').trim())).map(row=>safetyPeriod_(row[0])).filter(p=>Object.prototype.hasOwnProperty.call(PERIODS,p)))];
}
function safetyNotifications_(r){
 const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());if(!session)return {status:401};const periods=[];for(const period of safetyNotificationCandidates_(session)){const access=safetyAccess_({...r,period});if(access.status===200&&access.canInspectFlights)periods.push(period);}
 if(!periods.length)return {status:200,eligible:false,notices:[],...safetyFlyDayState_()};const book=SpreadsheetApp.openById(SAFETY_BOOK),cutoff=Date.now()-7*86400000,events=safetyAllEvents_(book).filter(e=>periods.includes(e.period)&&Date.parse(e.time)>=cutoff&&['flight-start','flight-review','flight-complete','submit'].includes(e.op));
 const notices=events.slice(-100).reverse().map(e=>{const report=safetyReport_({canInspectFlights:true},e.period,book,e);return {id:report.id,period:e.period,time:e.time,name:report.name,kind:report.kind,aircraft:report.aircraft||''};});const calendar=safetyCalendarNotices_();return {status:200,eligible:true,notices,...calendar,...safetyFlyDayState_(calendar)};
}
