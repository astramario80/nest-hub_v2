// Shared browser/server schedule rules. All times are local school wall-clock times.
export const KINDS = ['class','lunch','assembly','passing','attendance','halls','dismissal','advisory','support','ctso'];
export const PERIODS = ['0','1','2','3','4','5','6','7','CTSO'];
export const schoolDate = (now=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function validDate(value) { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value; }
export const minutes = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value||'') ? Number(value.slice(0,2))*60+Number(value.slice(3)) : NaN;
export function timeLabel(value) { const n=minutes(value); return Number.isFinite(n)?`${Math.floor(n/60)%12||12}:${String(n%60).padStart(2,'0')} ${n>=720?'PM':'AM'}`:'Invalid time'; }
export function validateWorkspace(w) {
 const errors=[];const err=s=>errors.push(s);
 const text=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
 const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,79}$/.test(v);
 const list=(a,max,label)=>{if(!Array.isArray(a)||a.length>max){err(label+' is too large or missing.');return [];}return a;};
 if(!w||typeof w!=='object'||Array.isArray(w))return ['Workspace is missing.'];
 const templates=list(w.templates,100,'Templates'),teachers=list(w.teachers,200,'Teachers'),days=list(w.days,800,'Dates');
 const unique=(a,label)=>{if(new Set(a.map(x=>x?.id)).size!==a.length)err(label+' contain duplicate IDs.');};
 function blocks(a,label){a=list(a,80,label);unique(a,label);for(const b of a){if(!b||!id(b.id)||!text(b.label,120)||!b.label.trim()||!KINDS.includes(b.kind)||typeof b.start!=='string'||typeof b.end!=='string'||!Number.isFinite(minutes(b.start))||minutes(b.end)<=minutes(b.start)||!Number.isFinite(minutes(b.end))||b.period!==''&&!PERIODS.includes(b.period))err(label+': each block needs a label, activity, period, and valid start/end time.');}}
 unique(templates,'Templates');unique(teachers,'Teachers');
 for(const t of templates){if(!t||!id(t.id)||!text(t.name,120)||!t.name.trim()||!/^#[a-f0-9]{6}$/i.test(t.color||'')||typeof t.noSchool!=='boolean'||!text(t.notes,2000)||t.lunchPeriod!==''&&!PERIODS.includes(t.lunchPeriod)){err('Invalid template details.');continue;}blocks(t.blocks,t.name);const lunches=list(t.lunches,6,t.name+' lunches'),groups=list(t.groups,12,t.name+' groups');unique(lunches,'Lunch groups');unique(groups,'Assembly groups');
  for(const l of lunches){if(!l||!id(l.id)||!text(l.name,80))err('Invalid lunch group.');else blocks(l.blocks,t.name+' / '+l.name);}
  for(const g of groups){if(!g||!id(g.id)||!text(g.name,80)||!Array.isArray(g.replacePeriods)||g.replacePeriods.some(p=>!PERIODS.includes(p)))err('Invalid assembly group.');else blocks(g.blocks,t.name+' / '+g.name);}
 }
 const templateMap=new Map(templates.map(t=>[t?.id,t])),teacherIds=new Set(teachers.map(t=>t?.id));
 for(const t of teachers){if(!t||!id(t.id)||!text(t.name,100)||!t.name.trim()||!text(t.lunchId,80)){err('Invalid teacher profile.');continue;}const preps=list(t.preps,12,'Teacher classes');if(new Set(preps.map(p=>p?.period)).size!==preps.length)err('A teacher has duplicate periods.');for(const p of preps)if(!p||!PERIODS.includes(p.period)||!text(p.name,120)||typeof p.enrolled!=='boolean')err('Invalid teacher class.');}
 if(new Set(days.map(d=>d?.date)).size!==days.length)err('Only one schedule can be assigned to a date.');
 for(const d of days){const t=templateMap.get(d?.templateId);if(!d||!validDate(d.date)||!t||!text(d.notes,1000)||typeof d.flyDay!=='boolean'||typeof d.absent!=='boolean'){err('Each date needs a valid date and template.');continue;}const assignments=list(d.assignments,200,'Teacher assignments');if(new Set(assignments.map(a=>a?.teacherId)).size!==assignments.length)err('A teacher has duplicate assignments on '+d.date);for(const a of assignments)if(!a||!teacherIds.has(a.teacherId)||a.groupId!==''&&!t.groups.some(g=>g.id===a.groupId)||a.lunchId!==''&&!t.lunches.some(l=>l.id===a.lunchId))err('Invalid teacher assignment on '+d.date);}
 return [...new Set(errors)];
}
export function resolveSchedule(workspace,{date,templateId,teacherId='',groupId,lunchId}={}) {
 const day=workspace.days.find(d=>d.date===date),template=workspace.templates.find(t=>t.id===(templateId||day?.templateId));
 const issues=[];if(!template)return {blocks:[],issues:[{level:'error',message:'No schedule is assigned to this date.'}],noSchool:false};
 if(template.noSchool)return {template,day,blocks:[],issues,noSchool:true};
 const teacher=workspace.teachers.find(t=>t.id===teacherId),assignment=day?.templateId===template.id?day.assignments.find(a=>a.teacherId===teacherId):null;
 const selectedGroup=groupId??assignment?.groupId??'',selectedLunch=lunchId??(assignment?.lunchId||teacher?.lunchId||'');
 const group=template.groups.find(g=>g.id===selectedGroup),lunch=template.lunches.find(l=>l.id===selectedLunch);
 let blocks=structuredClone(template.blocks);
 if(template.groups.length&&!group)issues.push({level:'error',message:'Choose an assembly group for this teacher or preview.'});
 if(selectedGroup&&!group)issues.push({level:'error',message:'The selected assembly group is unavailable.'});
 if(group){blocks=blocks.filter(b=>!group.replacePeriods.includes(b.period));blocks.push(...structuredClone(group.blocks));}
 if(template.lunches.length){if(!lunch)issues.push({level:'error',message:'Choose a lunch group for this teacher or preview.'});else{blocks=blocks.filter(b=>b.period!==template.lunchPeriod);blocks.push(...structuredClone(lunch.blocks));}}
 blocks.sort((a,b)=>minutes(a.start)-minutes(b.start)||minutes(a.end)-minutes(b.end));
 blocks=blocks.map(b=>{const prep=teacher?.preps.find(p=>p.period===b.period);return {...b,prep:b.kind==='class'?(prep?.name||''):b.kind==='lunch'?'LUNCH':b.kind==='assembly'?'ASSEMBLY':'',enrolled:prep?.enrolled??false,flyDay:!!day?.flyDay&&prep?.name.toLowerCase()==='drone piloting',duration:minutes(b.end)-minutes(b.start)};});
 for(let i=0;i<blocks.length;i++){const b=blocks[i];if(!Number.isFinite(b.duration)||b.duration<=0)issues.push({level:'error',message:b.label+' has invalid times.'});for(let j=0;j<i;j++){const a=blocks[j];if(a.kind==='halls'||b.kind==='halls')continue;if(minutes(a.start)<minutes(b.end)&&minutes(b.start)<minutes(a.end))issues.push({level:'error',message:`${a.label} overlaps ${b.label}.`});}}
 if(template.notes)issues.push({level:'note',message:template.notes});
 return {template,day,teacher,group,lunch,blocks,issues,noSchool:false,absent:!!day?.absent};
}
export function signalRows(resolved){return [...resolved.blocks.map(b=>[b.label,`${b.start}-${b.end}`,b.prep,b.flyDay?'Fly Day':'']),...(resolved.absent?[['Absent','','','']]:[])];}
