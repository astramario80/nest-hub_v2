// Verified-user flight reference archive. Never serialize health answers, clearance codes,
// escort restrictions, contact addresses, or damage attachments in these shared responses.
function safetyDrone_(prep){return /DRONE\s+PILOTING/i.test(String(prep||''));}
function safetyFlightTransitions_(book){const today=safetyDate_(new Date()),values={};for(const e of safetyAllEvents_(book))if(e.op==='flight-transition'&&e.data.date===today&&Number.isInteger(e.data.minutes)&&e.data.minutes>=0&&e.data.minutes<=60)values[e.period]={date:today,minutes:e.data.minutes,publishedAt:e.time};return values;}
function safetyFlightCatalog_(session){
 const roster=safetyNoFlyRoster_(),owner=websiteAdmin_(session.email);
 const own=roster.students.filter(s=>s.enrollments.some(e=>s.email===memberEmail_(session.email,e.period)));
 const periods=owner?Object.keys(PERIODS):staffIdentity_(session.email)?Object.keys(PERIODS).filter(p=>staffRole_(session.email,p)):[...new Set(own.flatMap(s=>s.enrollments.map(e=>e.period)))];
 const dronePeriods=[...new Set(roster.students.flatMap(s=>s.enrollments.filter(e=>safetyDrone_(e.prep)).map(e=>e.period)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 return {status:200,...safetyFlyDayState_(),flightTransitions:safetyFlightTransitions_(SpreadsheetApp.openById(SAFETY_BOOK)),dronePeriods,activeTrimester:roster.trimester,isOwner:owner,divisions:periods,canViewCurrent:owner||own.some(s=>s.enrollments.some(e=>safetyDrone_(e.prep))),canSubmit:own.length>0};
}
function safetyArchiveTerm_(date){
 const year=Number(date.slice(0,4))-(Number(date.slice(5,7))<7?1:0),schoolYear=year+'_'+(year+1),calendars=typeof weatherCalendars_==='function'?weatherCalendars_():{},bounds=calendars[schoolYear.replace('_','-')];
 return {year:schoolYear,trimester:bounds&&date>=bounds[0]&&date<=bounds[3]?(date<=bounds[1]?'1':date<=bounds[2]?'2':'3'):'Unassigned'};
}
function safetyReferenceRecords_(book){
 const sheet=book.getSheetByName('PreFlight/PostFlight'),count=sheet.getLastRow()-1;if(count<=0)return [];if(count>15000)throw Error('Flight archive needs pagination maintenance');
 const values=sheet.getRange(2,1,count,38).getValues(),rich=sheet.getRange(2,2,count,1).getRichTextValues(),combined=nestAccessValues_(SAFETY_ROSTER,"'CombinedStudentList'!A2:F5000").values||[];
 const byEmail=new Map(),byName=new Map();combined.forEach(r=>{const email=email_(r[2]),name=String(r[0]||'').trim();if(!email||!name)return;if(!byEmail.has(email))byEmail.set(email,[]);byEmail.get(email).push(r);if(!byName.has(name))byName.set(name,new Set());byName.get(name).add(email);});
 const native=new Map(),log=book.getSheetByName('SafetyWebEvents');if(log&&log.getLastRow()>1){if(log.getLastRow()>25000)throw Error('Safety log needs archiving');log.getRange(2,1,log.getLastRow()-1,6).getValues().forEach(r=>{if(!['submit','flight-complete'].includes(r[3]))return;const data=JSON.parse(r[5]);if(data.trimester)native.set(email_(r[2])+'|'+Math.floor(new Date(r[0]).getTime()/1000),{period:String(r[1]),trimester:data.trimester,metarObservation:data.metarObservation||''});});}
 return values.map((r,i)=>{
  if(r[2]!=='Pre-Flight'||!safetyDate_(r[0]))return null;const date=safetyDate_(r[0]),time=new Date(r[0]).toISOString(),text=String(r[1]||'').trim(),link=rich[i][0]?.getLinkUrl()||'';
  let email=link.startsWith('mailto:')?email_(link.slice(7)):/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)?email_(text):'';if(!email&&byName.get(text)?.size===1)email=[...byName.get(text)][0];
  const enrolled=byEmail.get(email)||[],name=enrolled[0]?.[0]||(!text.includes('@')?text:'Former NEST student'),saved=native.get(email+'|'+Math.round(Date.parse(time)/1000));
  const term=safetyArchiveTerm_(date);if(saved&&/^\d{4}_\d{4}_Tri[123]$/.test(saved.trimester)){term.year=saved.trimester.slice(0,9);term.trimester=saved.trimester.slice(-1);}
  const ref=term.year+'_Tri'+term.trimester,periods=[...new Set(enrolled.filter(e=>String(e[5]).trim()===ref).map(e=>safetyPeriod_(e[3])))],period=saved?.period||(periods.length===1?periods[0]:'Unassigned');
  const fields=SAFETY_FIELDS.filter(f=>f.column>=5&&f.column<=23||[32,36,37].includes(f.column)).map(f=>({label:f.label,value:String(r[f.column]||'')})).filter(f=>f.value);
  if(saved?.metarObservation)fields.push({label:'METAR flight observations',value:saved.metarObservation});
  return {id:hash_(time+'|'+(email||text)+'|'+String(r[32]||'')),email,name:String(name),time,date,year:term.year,trimester:term.trimester,period,aircraft:String(r[32]||''),fields};
 }).filter(Boolean).sort((a,b)=>b.time.localeCompare(a.time));
}
function safetyFlightReads_(r){
 const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());if(!session)return {status:401};const catalog=safetyFlightCatalog_(session);if(r.operation==='catalog')return catalog;
 if(r.operation==='current-flight-log'&&!catalog.canViewCurrent)return {status:403,error:'The current-trimester class log is available to current Drone Piloting students and the teacher.'};
 const book=SpreadsheetApp.openById(SAFETY_BOOK),records=safetyReferenceRecords_(book);
 if(r.operation==='archive'){
  if(r.year&&r.year!=='all'&&!/^\d{4}_\d{4}$/.test(r.year)||r.trimester&&!['all','1','2','3','Unassigned'].includes(r.trimester)||!['date-desc','date-asc','name'].includes(r.sort||'date-desc')||!Number.isInteger(r.page)||r.page<0||r.page>300||typeof r.search!=='string'||r.search.length>100)return {status:400};
  const query=r.search.trim().toLowerCase(),rows=records.filter(x=>(!r.year||r.year==='all'||x.year===r.year)&&(!r.trimester||r.trimester==='all'||x.trimester===r.trimester)&&(!query||[x.name,x.date,x.aircraft,x.period].join(' ').toLowerCase().includes(query)));
  rows.sort(r.sort==='name'?(a,b)=>a.name.localeCompare(b.name)||b.time.localeCompare(a.time):r.sort==='date-asc'?(a,b)=>a.time.localeCompare(b.time):(a,b)=>b.time.localeCompare(a.time));
  return {status:200,years:[...new Set(records.map(x=>x.year))].sort().reverse(),activeTrimester:catalog.activeTrimester,total:rows.length,page:r.page,hasMore:rows.length>(r.page+1)*30,records:rows.slice(r.page*30,(r.page+1)*30).map(({email,...row})=>row)};
 }
 const roster=safetyNoFlyRoster_(),groups=new Map();roster.students.forEach(s=>s.enrollments.filter(e=>safetyDrone_(e.prep)).forEach(e=>{if(!groups.has(e.period))groups.set(e.period,[]);if(!groups.get(e.period).some(member=>member.email===s.email))groups.get(e.period).push(s);}));
 const current=records.filter(x=>x.year+'_Tri'+x.trimester===roster.trimester);
 const classes=[...groups].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).map(([period,students])=>{
  const members=new Map(students.map(s=>[s.email,s])),completed=current.filter(x=>x.period===period&&members.has(x.email));
  const pending=students.filter(s=>!completed.some(x=>x.email===s.email)).map(s=>({name:s.name})).sort((a,b)=>a.name.localeCompare(b.name));
  const log=completed.map(({email,fields,...row})=>row);log.sort(r.sort==='name'?(a,b)=>a.name.localeCompare(b.name)||b.time.localeCompare(a.time):(a,b)=>b.time.localeCompare(a.time));
  return {period,studentCount:students.length,completedStudents:students.length-pending.length,pending,records:log};
 });
 return {status:200,activeTrimester:roster.trimester,classes,updatedAt:new Date().toISOString()};
}
