// Recipient-bound, expiring email capabilities. Raw action tokens are never stored.
function labCreateTeacherActions_(record){
 const end=Utilities.parseDate(record.day+' 23:59',LAB_ZONE,'yyyy-MM-dd HH:mm').getTime()+60000,expires=Math.min(end,Date.now()+30*86400000);
 const actions=record.teachers.map(teacher=>({email:teacher.email,token:hash_(Utilities.getUuid()+Utilities.getUuid()),expires}));
 record.teacherActions=actions.map(action=>({email:action.email,digest:hash_(action.token),expires:action.expires}));return actions;
}
function labTeacherContext_(token){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
 const digest=hash_(token);
 for(const record of labRecords_()){
  const action=(record.teacherActions||[]).find(a=>a.digest===digest);if(!action)continue;
  const teacher=record.teachers.find(t=>t.email===action.email);if(!teacher||!Number.isFinite(action.expires)||action.expires<=Date.now())return null;
  return {record,action,teacher};
 }
 return null;
}
function labTeacherView_(context){
 const {record,teacher}=context;return {status:200,student:labEmailName_(record),goal:record.goal,day:record.day,time:record.time,state:record.state,teacher:teacher.name,canDeny:['pending','issued','tabled'].includes(record.state)&&record.day>=labDay_(),reason:record.state==='denied'?record.reason:''};
}
function labTeacherDispatch_(r){
 if(!['view','deny'].includes(r.operation))return labError_(400,'Invalid teacher action.');
 labUseWebsiteCredential_(r);
 if(r.operation==='view'){const context=labTeacherContext_(r.teacherToken);return context?labTeacherView_(context):labError_(410,'This email link has expired or is no longer available. Please reply to the email to reach Mario Peñalver.');}
 return labLocked_(()=>{
  const context=labTeacherContext_(r.teacherToken);if(!context)return labError_(410,'This email link has expired or is no longer available.');
  const {record,action,teacher}=context,eventId='teacher-denial:'+action.digest;
  if(record.events.some(event=>event.id===eventId))return {...labTeacherView_(context),denied:true,repeated:true};
  if(record.state==='denied')return {...labTeacherView_(context),denied:true,repeated:true};
  if(!['pending','issued','tabled'].includes(record.state)||record.day<labDay_())return labError_(409,'This request can no longer be denied. Please reply to the email if you need to contact Mario Peñalver.');
  if(typeof r.mailToken!=='string'||!r.mailToken)return labError_(503,'Email confirmations are not configured. Please contact Mario Peñalver.');
  const event={id:eventId,state:'denied',reason:'at incoming teacher’s request',at:new Date().toISOString(),actor:teacher.email,teacherRequested:true,denyingTeacher:teacher.name,emailState:'sending'};
  record.state='denied';record.reason=event.reason;record.revision++;record.events.push(event);action.usedAt=event.at;
  // Commit the denial and email reservation before sending, so retries cannot
  // send duplicate confirmations or repeat the state transition.
  labSave_(record);labSend_(record,event,r.mailToken);
  return {...labTeacherView_(context),denied:true,emailState:event.emailState};
 });
}
