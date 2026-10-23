// Private native weather reports. All identities and audiences are resolved in the school service.
let WEATHER_DIRECTORY_ROWS,WEATHER_CALENDARS_READ;
const WEATHER_STUDENT_DIRECTORY='12XogWM3af3PLIvEyrFR39hzkI0kEmfiCZkr66y3eDcU';
const WEATHER_COUNSELOR_PAGE='https://gkhs.bethelsd.org/counseling-career-centers/counseling-centers';
const WEATHER_NATIVE_PERIODS=['Advisory','1','2','3','4','5','7','CTSO'];
const WEATHER_NATIVE_HEADERS=['Report ID','Timestamp','School year','Trimester','Name','Email','Period','Division','Emotion','Emotion family','Pacing','Grit','Safety','What is working','What can we change'];
function weatherOwner_(identity){return OWNER_EMAILS.includes(email_(identity));}
function weatherPeriod_(value){return String(value||'').replace(/^(period|division)\s*/i,'').trim().replace(/^advisory$/i,'Advisory').replace(/^ctso$/i,'CTSO');}
function weatherLeaders_(){return (typeof nestAccessValues_==='function'?nestAccessValues_:Sheets.Spreadsheets.Values.get)(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];}
function weatherLeadership_(identity,period,leaders,alerts){
 if(weatherOwner_(identity))return true;
 const address=memberEmail_(identity,period);
 return leaders.some(row=>weatherPeriod_(row[0])===period&&email_(row[4])===address&&
  (alerts?/^(division manager|partner liaison|parnter liaison)$/i:/^(division manager|assistant manager|partner liaison|parnter liaison)$/i).test(String(row[2]||'').trim()));
}
function weatherStore_(create){
 const props=PropertiesService.getScriptProperties();let id=props.getProperty('weather-native-store');if(id)return id;if(!create)throw new Error('Weather storage has not been initialized');
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw new Error('Weather storage is busy');
 try{ id=props.getProperty('weather-native-store');if(id)return id;
  const book=Sheets.Spreadsheets.create({properties:{title:'NEST Private Weather Reports',timeZone:'America/Los_Angeles'},sheets:[{properties:{title:'Reports',gridProperties:{frozenRowCount:1}}},{properties:{title:'Alerts',gridProperties:{frozenRowCount:1}}},{properties:{title:'Confirmations',gridProperties:{frozenRowCount:1}}}]});id=book.spreadsheetId;
  Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data:[{range:"'Reports'!A1:O1",values:[WEATHER_NATIVE_HEADERS]},{range:"'Alerts'!A1:J1",values:[['ID','Timestamp','Period','Student','Emotion','Family','Actor','Test','Sequence','Student surname']]},{range:"'Confirmations'!A1:F1",values:[['ID','Timestamp','Actor','Draft','Emotion','Alerted']]}]},id);
  props.setProperty('weather-native-store',id);return id;
 }finally{lock.releaseLock();}
}
function weatherStudent_(identity,period){
 if(!WEATHER_NATIVE_PERIODS.includes(period))return null;
 const address=memberEmail_(identity,period);if(!districtEmail_(address))return null;
 const rows=WEATHER_DIRECTORY_ROWS||(WEATHER_DIRECTORY_ROWS=Sheets.Spreadsheets.Values.get(WEATHER_STUDENT_DIRECTORY,"'CombinedStudentList'!A2:E1000").values||[]);
 const matches=rows.filter(row=>email_(row[2])===address&&weatherPeriod_(row[3])===period);
 if(matches.length!==1)return null;const row=matches[0];
 return {name:String(row[0]||'').trim(),email:address,period,division:String(row[4]||period).trim(),lastName:String(row[0]||'').split(',')[0].trim()};
}
const WEATHER_PREVIEW_SURNAMES=['Anderson','Clíné','Garcia','Johnson','Miller','Penalver','Williams'];
function weatherPreviewStudent_(identity,period,previewSurname){
 return weatherOwner_(identity)&&WEATHER_NATIVE_PERIODS.includes(period)?{period,name:'TEST — Administrator preview',email:identity,division:period,test:true,lastName:WEATHER_PREVIEW_SURNAMES.includes(previewSurname)?previewSurname:''}:null;
}
function weatherCalendars_(){
 if(WEATHER_CALENDARS_READ)return WEATHER_CALENDARS_READ;
 const raw=PropertiesService.getScriptProperties().getProperty('weather-calendars');
 return WEATHER_CALENDARS_READ=raw?JSON.parse(raw):{'2026-2027':['2026-08-31','2026-11-24','2027-03-10','2027-06-15']};
}
function weatherDate_(date){return Utilities.formatDate(date,'America/Los_Angeles','yyyy-MM-dd');}
function weatherYear_(day){const year=Number(day.slice(0,4))-(Number(day.slice(5,7))<8?1:0);return year+'-'+(year+1);}
function weatherTrimester_(day,year){const dates=weatherCalendars_()[year];return !dates||day<dates[0]||day>dates[3]?'Unassigned':day<=dates[1]?'1':day<=dates[2]?'2':'3';}
function weatherPlain_(html){return String(html).replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function weatherParseCounselors_(html){
 const found=[];
 (String(html).match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)||[]).forEach(block=>{
  const text=weatherPlain_(block),match=text.match(/^(.{3,80}?)\s+Counselor:\s*([A-Z]{1,3})\s*[-–—]\s*([A-Z]{1,3})\b/i);
  if(!match)return;
  const links=[...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const link=links.find(x=>/Schedule Appointment/i.test(weatherPlain_(x[2]))&&/^https:\/\/(?:calendar\.google\.com|calendar\.app\.google|[a-z0-9-]+\.youcanbook\.me)\//i.test(x[1]));
  if(link)found.push({name:match[1].trim(),start:match[2].toUpperCase(),end:match[3].toUpperCase(),url:link[1].replace(/&amp;/g,'&')});
 });
 found.sort((a,b)=>a.start.localeCompare(b.start));
 if(found.length<4||found.length>12||found[0].start!=='A'||found[found.length-1].end!=='Z'||found.some((x,i)=>x.start>x.end||i>0&&found[i-1].end>=x.start))throw new Error('Counselor ranges could not be validated');
 return found;
}
function weatherRefreshCounselors_(){
 const props=PropertiesService.getScriptProperties();
 try{
  const response=UrlFetchApp.fetch(WEATHER_COUNSELOR_PAGE,{muteHttpExceptions:true,followRedirects:true});if(response.getResponseCode()!==200)throw new Error('School directory unavailable');
  const counselors=weatherParseCounselors_(response.getContentText());
  props.setProperty('weather-counselors',JSON.stringify({checkedAt:new Date().toISOString(),counselors}));props.deleteProperty('weather-counselor-error');
 }catch(error){props.setProperty('weather-counselor-error',new Date().toISOString()+': School counselor directory needs review.');}
}
function weatherCounselor_(student){
 const props=PropertiesService.getScriptProperties();const cached=props.getProperty('weather-counselors');const directory=cached?JSON.parse(cached):null;
 const surname=String(student?.lastName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'');
 const matches=(directory?.counselors||[]).filter(c=>surname&&surname>=c.start&&(surname<=c.end||surname.startsWith(c.end)));
 // A malformed or stale directory never produces a guessed counselor assignment.
 return matches.length===1&&Date.now()-Date.parse(directory.checkedAt)<8*86400000?{...matches[0],checkedAt:directory.checkedAt}:{name:'School counseling center',url:WEATHER_COUNSELOR_PAGE,unmatched:true};
}
function weatherSetup_(){
 const id=weatherStore_(true),props=PropertiesService.getScriptProperties();
 if(props.getProperty('weather-schema')!=='3'){Sheets.Spreadsheets.Values.update({values:[['Grit']]},id,"'Reports'!L1",{valueInputOption:'RAW'});Sheets.Spreadsheets.Values.update({values:[['Student surname']]},id,"'Alerts'!J1",{valueInputOption:'RAW'});props.setProperty('weather-schema','3');}
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='weatherRefreshCounselors_'))ScriptApp.newTrigger('weatherRefreshCounselors_').timeBased().everyDays(1).atHour(5).create();
 const saved=PropertiesService.getScriptProperties().getProperty('weather-counselors');if(!saved||Date.now()-Date.parse(JSON.parse(saved).checkedAt)>86400000)weatherRefreshCounselors_();
}
function weatherConfirmation_(identity,draft){
 const id=hash_(identity+':'+draft),rows=Sheets.Spreadsheets.Values.get(weatherStore_(false),"'Confirmations'!A2:F20000").values||[];
 if(rows.length>=19999)throw new Error('Confirmation storage requires pagination upgrade');
 const row=rows.find(x=>x[0]===id);return row?{emotion:String(row[4]),alerted:row[5]===true||String(row[5]).toLowerCase()==='true'}:null;
}
function weatherAlert_(identity,student,emotion,draft,test){
 const store=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))return {status:503};
 try{
  const prior=weatherConfirmation_(identity,draft);if(prior)return {status:200,confirmed:prior.emotion===emotion.id,conflict:prior.emotion!==emotion.id,alerted:prior.alerted};
  const id=hash_(identity+':'+draft),now=new Date().toISOString();
  if(emotion.charged){
   const rows=Sheets.Spreadsheets.Values.get(weatherStore_(false),"'Alerts'!A2:J20000").values||[];
   if(rows.length>=19999)throw new Error('Alert storage requires pagination upgrade');
   const existing=rows.find(row=>row[0]===id);
   if(existing&&existing[4]!==emotion.answer)return {status:409};
   if(!existing){
    const latest=rows.filter(row=>row[6]===identity).at(-1);if(latest&&Date.now()-Date.parse(latest[1])<10000)return {status:429};
    const sequence=Math.max(Number(store.getProperty('weather-alert-latest')||0),...rows.map(row=>Number(row[8])||0))+1;
    Sheets.Spreadsheets.Values.append({values:[[id,now,student.period,student.name,emotion.answer,emotion.family,identity,test===true,sequence,student.lastName||'']]},weatherStore_(false),"'Alerts'!A:J",{valueInputOption:'RAW'});
    store.setProperty('weather-alert-latest',String(sequence));
   }else store.setProperty('weather-alert-latest',String(Math.max(Number(store.getProperty('weather-alert-latest')||0),Number(existing[8])||0)));
  }
  Sheets.Spreadsheets.Values.append({values:[[id,now,identity,draft,emotion.id,emotion.charged]]},weatherStore_(false),"'Confirmations'!A:F",{valueInputOption:'RAW'});
  return {status:200,confirmed:true,alerted:emotion.charged};
 }finally{lock.releaseLock();}
}
function weatherNativeRows_(){
 const id=weatherStore_(false),values=Sheets.Spreadsheets.Values.get(id,"'Reports'!A2:O20000",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[];
 if(values.length>=19999)throw new Error('Report storage requires pagination upgrade');return values;
}
function weatherLegacyRows_(){
 const rows=Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,"'WeatherReports'!A2:I10000",{valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'}).values||[];
 if(rows.length>=9999)throw new Error('Legacy archive requires pagination upgrade');
 return rows.filter(r=>r[0]&&r[1]).map((row,i)=>{
  const date=typeof row[0]==='number'?Utilities.parseDate(Utilities.formatDate(new Date((row[0]-25569)*86400000),'UTC','yyyy-MM-dd HH:mm:ss'),'America/Los_Angeles','yyyy-MM-dd HH:mm:ss'):new Date(row[0]);if(!Number.isFinite(date.getTime()))return null;
  const day=weatherDate_(date),year=weatherYear_(day),period=weatherPeriod_(row[3]);
  return ['legacy-'+i,date.toISOString(),year,weatherTrimester_(day,year),'',String(row[1]),period,period,String(row[2]||''),'',row[4]??'',row[5]??'',row[6]??'',row[7]??'',row[8]??''];
 }).filter(Boolean);
}
function weatherFiltered_(identity,r,leaders){
 const owner=weatherOwner_(identity),period=String(r.period||'');
 if(period==='all'&&!owner||period!=='all'&&(!WEATHER_NATIVE_PERIODS.includes(period)||!weatherLeadership_(identity,period,leaders,false)))return {status:403};
 const all=weatherNativeRows_().map(row=>{const copy=row.slice();copy[3]=weatherTrimester_(weatherDate_(new Date(row[1])),String(row[2]));return copy;}).concat(weatherLegacyRows_());const years=[...new Set(all.map(x=>String(x[2])).concat(weatherYear_(weatherDate_(new Date()))))].sort().reverse();
 const rows=all.filter(x=>(period==='all'||x[6]===period)&&(!r.year||r.year==='all'||x[2]===r.year)&&(!r.trimester||r.trimester==='all'||String(x[3])===r.trimester)).sort((a,b)=>String(b[1]).localeCompare(String(a[1])));
 return {status:200,rows,years};
}
function weatherSummary_(rows){
 const mean=(list,index)=>{const vals=list.map(r=>Number(r[index])).filter(x=>x>=1&&x<=5);return vals.length?Number((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2)):'';};
 return [['Report period','Pacing','Grit','Safety'],['Selected reports',... [10,11,12].map(i=>mean(rows,i))],...['1','2','3'].map(t=>['Trimester '+t,...[10,11,12].map(i=>mean(rows.filter(r=>String(r[3])===t),i))])];
}
function weatherExport_(identity,r,leaders){
 if(!weatherOwner_(identity))return {status:403};const data=weatherFiltered_(identity,r,leaders);if(data.status!==200)return data;
 const book=SpreadsheetApp.create('NEST Weather Archive '+Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd HHmmss'));
 const sheet=book.getSheets()[0].setName('Responses');if(data.rows.length+1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),data.rows.length+1-sheet.getMaxRows());const safe=v=>typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v;
 sheet.getRange(1,1,data.rows.length+1,15).setValues([WEATHER_NATIVE_HEADERS,...data.rows].map(row=>row.map(safe)));sheet.setFrozenRows(1);sheet.getRange(1,1,1,15).setFontWeight('bold').setBackground('#173b50').setFontColor('#ffffff');sheet.getDataRange().setWrap(true);sheet.setColumnWidths(1,15,145);sheet.setColumnWidths(14,2,350);
 const summary=book.insertSheet('Charts'),stats=weatherSummary_(data.rows);summary.getRange(1,1,stats.length,4).setValues(stats);summary.getRange(1,1,1,4).setFontWeight('bold');summary.setColumnWidths(1,4,150);
 const counts={};data.rows.forEach(row=>{const label=String(row[9]||row[8]||'Unspecified').trim().toLowerCase()||'unspecified';counts[label]=(counts[label]||0)+1;});const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]),emotions=[['Emotion','Responses'],...ranked];summary.getRange(8,1,emotions.length,2).setValues(emotions);const displayed=ranked.length>8?[...ranked.slice(0,7),['Other reported emotions',ranked.slice(7).reduce((n,row)=>n+row[1],0)]]:ranked,chartEmotions=[['Emotion','Responses'],...displayed];summary.getRange(8,11,chartEmotions.length,2).setValues(chartEmotions);
 summary.insertChart(summary.newChart().setChartType(Charts.ChartType.COLUMN).addRange(summary.getRange(1,1,2,4)).setNumHeaders(1).setPosition(1,6,0,0).setOption('title','Average responses — Pacing/Grit: 3 ideal; Safety: 5 ideal').setOption('vAxis',{viewWindow:{min:0,max:5}}).build());
 if(emotions.length>1)summary.insertChart(summary.newChart().setChartType(Charts.ChartType.PIE).addRange(summary.getRange(8,11,chartEmotions.length,2)).setNumHeaders(1).setPosition(20,6,0,0).setOption('title','Most reported emotions').build());
 const printable=book.insertSheet('Printable report'),lines=[['NEST Weather Reports — '+data.rows.length+' responses'],['Division: '+r.period+' | School year: '+(r.year||'all')+' | Trimester: '+(r.trimester||'all')],['Pacing: 1 Too Slow · 3 Just Right! · 5 Too Fast | Grit: 1 Too Easy · 3 Just Right! · 5 Too Hard | Safety: 5 ideal'],...Array.from({length:31},()=>[''])];
 const wrap=text=>{const value=String(text||'—').replace(/\r/g,'');return value.split('\n').flatMap(line=>line.match(/.{1,115}(?:\s|$)|.{1,115}/g)||['']);};
 data.rows.forEach(row=>{
  const entries=[row[1]+' | '+(row[4]||row[5])+' | Division '+row[6]+' | '+row[2]+' | Trimester '+row[3],
   'Emotion: '+row[8], 'Pacing: '+row[10]+' / 5 | Grit: '+row[11]+' / 5 | Safety: '+row[12]+' / 5',
   'What is working: '+row[13], 'What can we change: '+row[14],''];
  entries.forEach(text=>wrap(text).forEach(line=>lines.push([safe(line)])));
 });
 if(lines.length>printable.getMaxRows())printable.insertRowsAfter(printable.getMaxRows(),lines.length-printable.getMaxRows());
 printable.getRange(1,1,lines.length,1).setValues(lines).setFontSize(11);printable.setColumnWidth(1,900);printable.setRowHeights(1,lines.length,24);printable.getRange(1,1,1,1).setFontWeight('bold').setFontSize(16);
 printable.insertChart(printable.newChart().setChartType(Charts.ChartType.COLUMN).addRange(summary.getRange(1,1,2,4)).setNumHeaders(1).setPosition(4,1,0,0).setOption('width',850).setOption('height',300).setOption('title','Average responses — Pacing/Grit: 3 ideal; Safety: 5 ideal').setOption('vAxis',{viewWindow:{min:0,max:5}}).build());
 if(emotions.length>1)printable.insertChart(printable.newChart().setChartType(Charts.ChartType.PIE).addRange(summary.getRange(8,11,chartEmotions.length,2)).setNumHeaders(1).setPosition(18,1,0,0).setOption('width',850).setOption('height',300).setOption('title','Most reported emotions').build());
 SpreadsheetApp.flush();const base='https://docs.google.com/spreadsheets/d/'+book.getId();
 return {status:200,count:data.rows.length,spreadsheet:base+'/edit',xlsx:base+'/export?format=xlsx',pdf:base+'/export?format=pdf&gid='+printable.getSheetId()+'&portrait=false&fitw=true&sheetnames=false&printtitle=false&gridlines=false&pagenum=RIGHT',note:'Private to the school account that owns NEST. Sign in with that Google account to download.'};
}
const WEATHER_SCHOOL_CALENDAR='c_913e7cfd3fae4b0ebac48350ef736dd9ab300fee8390a21ce972c0cb8ca78049@group.calendar.google.com';
function weatherCalendarDates_(events,fallbackEnd){
 const starts={1:[],2:[],3:[]},ends={1:[],2:[],3:[]},first=[],last=[];
 const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 const choose=values=>{if(!values.length)return '';const priority=Math.max(...values.map(x=>x.priority)),days=[...new Set(values.filter(x=>x.priority===priority).map(x=>x.day))];return days.length===1?days[0]:'';};
 for(const event of events){
  const name=String(event.title||'').toLowerCase();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(event.start)||!/^\d{4}-\d{2}-\d{2}$/.test(event.end)||event.end<=event.start)continue;
  if(/\b(?:elementary|es)\b/.test(name)&&!/\b(?:ms|hs)\b|middle school|high school/.test(name))continue;
  if(/\b(?:senior|seniors|kindergarten)\b/.test(name)&&!/k\s*[-–]\s*12|gr(?:ades?)?\.?\s*1\s*[-–]\s*12/.test(name))continue;
  const secondary=/\b(?:ms|hs)\b|middle school|high school|gr(?:ades?)?\.?\s*6\s*[-–]\s*12/.test(name);
  const priority=secondary?2:1,entry={day:event.start,priority};
  const match=name.match(/\btri(?:mester)?\.?\s*(?:#|no\.?)?\s*([123])(?:st|nd|rd)?\b|\b([123])(?:st|nd|rd)?\s*tri(?:mester)?\b|\b(first|second|third)\s+tri(?:mester)?\b/);
  const number=match?Number(match[1]||match[2]||({first:1,second:2,third:3})[match[3]]):0;
  if(number&&/\b(?:end|ends|ending|last|grade prep|grades due)\b/.test(name))ends[number].push({day:shift(event.end,-1),priority});
  if(number&&/\b(?:start|starts|starting|begin|begins|beginning|first day|1st day)\b/.test(name))starts[number].push(entry);
  if(number&&!/\b(?:end|ends|ending|last|start|starts|begin|begins)\b/.test(name)&&Date.parse(event.end)-Date.parse(event.start)>20*86400000){starts[number].push(entry);ends[number].push({day:shift(event.end,-1),priority});}
  if(/\bfirst day of school\b|\bschool (starts|begins)\b/.test(name))first.push(entry);
  if(/\blast day of school\b/.test(name))last.push({day:shift(event.end,-1),priority});
 }
 const next2=choose(starts[2]),next3=choose(starts[3]);
 const dates=[choose(starts[1])||choose(first),choose(ends[1])||(next2?shift(next2,-1):''),choose(ends[2])||(next3?shift(next3,-1):''),choose(ends[3])||choose(last)||(!ends[3].length&&!last.length?fallbackEnd:'')];
 return dates.every((day,i)=>day&&(!i||day>dates[i-1]))?dates:null;
}
function weatherImportCalendar_(year){
 if(!/^20\d\d-20\d\d$/.test(year)||Number(year.slice(5))!==Number(year.slice(0,4))+1)return {status:400};
 const start=Number(year.slice(0,4)),calendar=CalendarApp.getCalendarById(WEATHER_SCHOOL_CALENDAR);if(!calendar)throw new Error('School calendar unavailable');
 const rows=calendar.getEvents(new Date(start+'-08-01T00:00:00-07:00'),new Date((start+1)+'-08-01T00:00:00-07:00'));if(rows.length>5000)throw new Error('School calendar capacity');
 const events=rows.filter(e=>/\btri(?:mester)?|\b[123](?:st|nd|rd)?\s*tri|\bfirst day of school\b|\bschool (starts|begins)\b|\blast day of school\b/i.test(e.getTitle())).map(e=>{const allDay=e.isAllDayEvent(),start=weatherDate_(allDay?e.getAllDayStartDate():e.getStartTime()),end=allDay?weatherDate_(e.getAllDayEndDate()):new Date(Date.parse(weatherDate_(e.getEndTime())+'T12:00:00Z')+86400000).toISOString().slice(0,10);return {title:e.getTitle(),start,end};});
 const dates=weatherCalendarDates_(events,(start+1)+'-06-30');
 if(!dates||dates.some(day=>weatherYear_(day)!==year))return {status:409,error:'The school calendar does not provide one unambiguous set of MS/HS trimester dates for this year. Enter the official dates manually.'};
 const calendars=weatherCalendars_();calendars[year]=dates;PropertiesService.getScriptProperties().setProperty('weather-calendars',JSON.stringify(calendars));return {status:200,year,dates,source:'School Google calendar'};
}
function weatherNativeDispatch_(session,r){
 WEATHER_DIRECTORY_ROWS=null;WEATHER_CALENDARS_READ=null;
 const identity=session.email,owner=weatherOwner_(identity),operation=String(r.operation||'bootstrap'),store=PropertiesService.getScriptProperties();
 if(operation==='bootstrap'){
  if(owner)weatherSetup_();const leaders=weatherLeaders_(),periods=WEATHER_NATIVE_PERIODS.filter(p=>weatherLeadership_(identity,p,leaders,false));
  const studentPeriods=WEATHER_NATIVE_PERIODS.filter(p=>weatherStudent_(identity,p));
  const today=weatherDate_(new Date()),currentYear=weatherYear_(today),currentTrimester=weatherTrimester_(today,currentYear);
  return {status:200,admin:owner,periods,studentPeriods,testMode:owner&&!studentPeriods.length,previewPeriods:owner?WEATHER_NATIVE_PERIODS:[],previewSurnames:owner?WEATHER_PREVIEW_SURNAMES:[],currentYear,currentTrimester,alertPeriods:WEATHER_NATIVE_PERIODS.filter(p=>weatherLeadership_(identity,p,leaders,true)),calendars:owner?weatherCalendars_():undefined,counselorCheckedAt:owner?JSON.parse(store.getProperty('weather-counselors')||'{}').checkedAt:undefined,counselorError:owner?store.getProperty('weather-counselor-error'):undefined};
 }
 if(operation==='alert-access'){const leaders=weatherLeaders_();return {status:200,eligible:WEATHER_NATIVE_PERIODS.some(p=>weatherLeadership_(identity,p,leaders,true))};}
 if(operation==='counselor'){const student=weatherStudent_(identity,r.period)||weatherPreviewStudent_(identity,r.period,r.previewSurname);return {status:200,counselor:weatherCounselor_(student)};}
 if(operation==='refresh-counselors'){if(!owner)return {status:403};weatherRefreshCounselors_();return {status:200,checkedAt:JSON.parse(store.getProperty('weather-counselors')||'{}').checkedAt,error:store.getProperty('weather-counselor-error')};}
 if(operation==='import-calendar'){if(!owner)return {status:403};return weatherImportCalendar_(String(r.year||''));}
 if(operation==='calendar'){
  if(!owner)return {status:403};const dates=r.dates;if(!/^20\d\d-20\d\d$/.test(r.year||'')||!Array.isArray(dates)||dates.length!==4||dates.some((d,i)=>!/^20\d\d-\d\d-\d\d$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d||i>0&&d<=dates[i-1]))return {status:400};
  if(Number(r.year.slice(5))!==Number(r.year.slice(0,4))+1||weatherYear_(dates[0])!==r.year||weatherYear_(dates[3])!==r.year)return {status:400};const calendars=weatherCalendars_();calendars[r.year]=dates;store.setProperty('weather-calendars',JSON.stringify(calendars));return {status:200};
 }
 if(operation==='confirm'||operation==='test'){
  if(!/^[a-f0-9-]{36}$/.test(r.draft||''))return {status:400};const emotion=WEATHER_EMOTIONS.find(x=>x.id===r.emotion);if(!emotion)return {status:400};
  let student;if(operation==='test'){if(!owner)return {status:403};student={period:WEATHER_NATIVE_PERIODS.includes(r.period)?r.period:'1',name:'TEST — Administrator preview'};}else{student=weatherStudent_(identity,r.period)||weatherPreviewStudent_(identity,r.period,r.previewSurname);if(!student)return {status:403};}
  const result=weatherAlert_(identity,student,emotion,r.draft,operation==='test'||student.test===true);result.test=operation==='test'||student.test===true;if(result.confirmed)result.counselor=weatherCounselor_(student);return result;
 }
 if(operation==='submit'){
  const student=weatherStudent_(identity,r.period)||weatherPreviewStudent_(identity,r.period,r.previewSurname),emotion=WEATHER_EMOTIONS.find(x=>x.id===r.emotion);if(!student)return {status:403};
  if(!emotion||!/^[a-f0-9-]{36}$/.test(r.draft||'')||![r.pacing,r.challenge,r.safety].every(n=>Number.isInteger(n)&&n>=1&&n<=5)||![r.working,r.change].every(x=>typeof x==='string'&&x.length<=5000))return {status:400};
  const confirmation=weatherConfirmation_(identity,r.draft);if(!confirmation||confirmation.emotion!==emotion.id)return {status:409,error:'Confirm your emotion before submitting.'};
  if(student.test)return {status:200,saved:true,test:true};
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};try{
   const id=hash_(identity+':'+r.draft),rows=weatherNativeRows_();if(rows.some(row=>row[0]===id))return {status:200,saved:true};
   const now=new Date(),day=weatherDate_(now),year=weatherYear_(day);
   Sheets.Spreadsheets.Values.append({values:[[id,now.toISOString(),year,weatherTrimester_(day,year),student.name,student.email,student.period,student.division,emotion.answer,emotion.family,r.pacing,r.challenge,r.safety,r.working,r.change]]},weatherStore_(false),"'Reports'!A:O",{valueInputOption:'RAW'});return {status:200,saved:true};
  }finally{lock.releaseLock();}
 }
 if(operation==='alerts'){
  const leaders=weatherLeaders_(),allowed=WEATHER_NATIVE_PERIODS.filter(p=>weatherLeadership_(identity,p,leaders,true));if(!allowed.length)return {status:200,events:[],eligible:false};
  const latest=Number(store.getProperty('weather-alert-latest')||0),since=Math.max(0,Number(r.since)||0);if(!latest||latest<=since)return {status:200,events:[],eligible:true,cursor:String(since)};
  const rows=Sheets.Spreadsheets.Values.get(weatherStore_(false),"'Alerts'!A2:J20000").values||[];
  const events=rows.filter(row=>Number(row[8])>since&&(since>0||Date.parse(row[1])>Date.now()-86400000)&&allowed.includes(String(row[2]))&&(!['true','TRUE'].includes(String(row[7]))||owner&&email_(row[6])===identity)).map(row=>({id:String(row[0]),at:String(row[1]),period:String(row[2]),student:String(row[3]),emotion:String(row[4]),counselor:weatherCounselor_({lastName:String(row[9]||(String(row[3]).includes(',')?String(row[3]).split(',')[0]:''))}),test:['true','TRUE'].includes(String(row[7]))}));
  return {status:200,eligible:true,events,cursor:String(latest)};
 }
 if(operation==='reports'||operation==='export'){
  const leaders=weatherLeaders_();if(operation==='export')return weatherExport_(identity,r,leaders);
  const data=weatherFiltered_(identity,r,leaders);if(data.status!==200)return data;const page=Number(r.page||0);if(!Number.isInteger(page)||page<0||page>10000)return {status:400};
  return {status:200,division:r.period==='all'?'All divisions':'Division '+r.period,summary:weatherSummary_(data.rows),columns:WEATHER_NATIVE_HEADERS.slice(1),rows:data.rows.slice(page*100,(page+1)*100).map(x=>x.slice(1)),years:data.years,total:data.rows.length,page,hasMore:(page+1)*100<data.rows.length};
 }
 return {status:400};
}

// Empty polls disclose no student data and need no spreadsheet read. Any new event
// always returns through authSession_ and fresh division authorization above.
function weatherNativePollEmpty_(r){
 if(r.operation!=='alerts'||!/^[a-f0-9]{64}$/.test(r.session||''))return null;
 const store=PropertiesService.getScriptProperties(),session=read_(store,'authsession:'+hash_(r.session),Date.now());
 if(!session)return {status:401};
 const since=Math.max(0,Number(r.since)||0),latest=Number(store.getProperty('weather-alert-latest')||0);
 return latest<=since?{status:200,eligible:true,events:[],cursor:String(since)}:null;
}
