// Clearance is a separate, server-enforced review handshake. Daily codes are private.
function safetyDailyCode_(book){const event=safetyEvents_(book,'*').filter(e=>e.op==='clearance-code').pop();return event&&event.data.date===safetyDate_(new Date())?{code:event.data.code,id:event.request,publishedAt:event.time,date:event.data.date}:null;}
function safetyDrafts_(events){const drafts=new Map();events.forEach(e=>{const d=e.data;if(e.op==='flight-review')drafts.set(e.request,{id:e.request,actor:e.actor,name:d.name,time:e.time,date:safetyDate_(e.time),answers:d.answers,metarObservation:d.metarObservation||'',trimester:d.trimester,status:'Pending clearance'});const draft=drafts.get(d.id);if(!draft)return;if(e.op==='flight-release'){draft.status='Code released';draft.code=d.code;draft.codeId=d.codeId;draft.releasedAt=e.time;}if(e.op==='flight-complete'){draft.status='Cleared for takeoff';draft.completedAt=e.time;}if(e.op==='flight-cancel')draft.status='Cancelled';});return [...drafts.values()];}
function safetyClearanceView_(access,book,events){const today=safetyDate_(new Date()),drafts=safetyDrafts_(events).filter(d=>d.date===today&&d.status!=='Cancelled'),activeCode=safetyDailyCode_(book),code=access.canManage?activeCode:null;drafts.forEach(d=>{if(d.status==='Code released'&&d.codeId!==activeCode?.id){d.status='Pending clearance';delete d.code;}});
 const own=drafts.filter(d=>d.actor===access.email).map(d=>({id:d.id,time:d.time,status:d.status,aircraft:d.answers[32],...(d.status==='Code released'?{code:d.code}:{})}));
 const queue=access.canManage?drafts.filter(d=>d.status!=='Cleared for takeoff').map(d=>{const row=safetyValidateFlight_({type:'Pre-Flight',answers:{...d.answers,30:'PENDING REVIEW'}}),result=safetyFlightStatus_(row);return {id:d.id,name:d.name,time:d.time,status:d.status,aircraft:d.answers[32],checklistStatus:result.status,flags:result.flags,fields:SAFETY_FIELDS.filter(f=>f.column>=5&&f.column<=23||[32,36,37].includes(f.column)).map(f=>({label:f.label,value:d.answers[f.column]||''})).concat(d.metarObservation?[{label:'METAR flight observations',value:d.metarObservation}]:[])};}):[];
 return {ownFlights:own,...(access.canManage?{clearanceCode:code,reviewQueue:queue}:{})};
}
function safetyClearanceMutation_(access,r,book,events){
 const today=safetyDate_(new Date()),enrollment=safetyNoFlyRoster_(),member=enrollment.students.some(s=>s.email===access.email&&s.enrollments.some(e=>e.period===r.period));
 if(r.operation==='clearance-code'){
  if(!access.owner)return {status:403};if(typeof r.code!=='string'||!r.code.trim()||r.code.trim().length>100)return {status:400};safetyAppend_(book,'*',access,r,{date:today,code:r.code.trim()},null);return {status:200,saved:true};
 }
 if(r.operation==='flight-review'){
  if(!member)return {status:403};const row=safetyValidateFlight_({type:'Pre-Flight',answers:{...r.answers,30:'PENDING REVIEW'}});if(!row)return {status:400,error:'Complete the checklist before sending it for review.'};
  const observation=r.metarObservation===undefined?'':r.metarObservation;if(typeof observation!=='string'||observation.length>3000||safetyFlightStatus_(row).status==='Go'&&!observation.trim())return {status:400,error:'Explain what the METAR conditions mean for today’s flight.'};
  if(safetyDrafts_(events).some(d=>d.actor===access.email&&d.date===today&&!['Cleared for takeoff','Cancelled'].includes(d.status)))return {status:409,error:'You already have a checklist awaiting clearance.'};
  const answers={};SAFETY_FIELDS.filter(f=>f.mode!=='post'&&f.column!==30).forEach(f=>{if(row[f.column])answers[f.column]=row[f.column];});safetyAppend_(book,r.period,access,r,{name:access.name,answers,metarObservation:observation.trim(),trimester:enrollment.trimester},null);return {status:200,saved:true,pending:true};
 }
 const draft=safetyDrafts_(events).find(d=>d.id===r.id&&d.date===today);if(!draft||['Cancelled','Cleared for takeoff'].includes(draft.status))return {status:409,error:'This checklist is no longer awaiting clearance.'};
 if(draft.status==='Code released'&&draft.codeId!==safetyDailyCode_(book)?.id){draft.status='Pending clearance';delete draft.code;}
 if(r.operation==='flight-cancel'){if(!access.canManage&&draft.actor!==access.email)return {status:403};safetyAppend_(book,r.period,access,r,{id:draft.id},null);return {status:200,saved:true};}
 if(r.operation==='flight-release'){
  if(!access.canManage)return {status:403};if(draft.status!=='Pending clearance')return {status:409};const code=safetyDailyCode_(book);if(!code)return {status:409,error:'The administrator must publish today’s code first.'};
  const row=safetyValidateFlight_({type:'Pre-Flight',answers:{...draft.answers,30:'REVIEW'}});if(safetyFlightStatus_(row).status!=='Go')return {status:409,error:'Resolve the No-Go or incomplete checklist before releasing clearance.'};
  safetyAppend_(book,r.period,access,r,{id:draft.id,code:code.code,codeId:code.id},null);return {status:200,saved:true};
 }
 if(r.operation==='flight-complete'){
  if(!member||draft.actor!==access.email)return {status:403};if(draft.status!=='Code released'||typeof r.code!=='string'||r.code.trim()!==draft.code)return {status:403,error:'Wait for your safety leader to release the code, then paste it exactly.'};
  const row=safetyValidateFlight_({type:'Pre-Flight',answers:{...draft.answers,30:r.code.trim()}});if(!row||safetyFlightStatus_(row).status!=='Go')return {status:409};row[1]=access.email;safetyAppend_(book,r.period,access,r,{id:draft.id,type:'Pre-Flight',trimester:draft.trimester,metarObservation:draft.metarObservation},row);return {status:200,saved:true,flightStatus:'Cleared for takeoff'};
 }
 return {status:400};
}
