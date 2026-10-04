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
   (['division manager','assistant manager','director of client relations'].includes(role)||
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
 requests.forEach(item=>{item.version=serviceVersion_(item.raw,events.filter(e=>e[1]===item.id).slice(-1)[0]||[]);});
 return {requests,events,logTab,tabs};
}
function serviceColumnLetter_(number){let value='';while(number){number--;value=String.fromCharCode(65+number%26)+value;number=Math.floor(number/26);}return value;}
function serviceUpdates_(item,events){return events.filter(e=>e[1]===item.id&&e[2]==='update'&&e[5]).map(e=>({time:String(e[0]),status:String(e[4]),note:String(e[5]),eventId:String(e[6])}));}
function serviceClientRow_(item,events){return {id:item.id,status:item.status,created:item.created,description:item.description,category:item.category,room:item.room,manager:item.manager,updates:serviceUpdates_(item,events)};}
function serviceEmailState_(item,events){
 const last=events.filter(e=>e[1]===item.id&&e[2]==='update'&&e[5]).slice(-1)[0];if(!last)return 'none';
 return String(events.filter(e=>e[1]===item.id&&e[2]==='email'&&e[6]===last[6]).slice(-1)[0]?.[7]||'unsent');
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
function serviceTicketAccess_(email,item,leaders,roster){
 if(OWNER_EMAILS.includes(email_(email)))return {canEdit:true,canAssign:true,period:''};
 const assigned=serviceAssignment_(item,roster);if(!assigned)return {canEdit:false,canAssign:false,period:''};
 const divisionLeader=leaders.some(row=>String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase()===assigned.period&&['division manager','assistant manager','director of client relations'].includes(String(row[2]||'').trim().toLowerCase().replace(/\s+/g,' '))&&email_(row[4])===memberEmail_(email,assigned.period));
 return {canEdit:divisionLeader||assigned.email===memberEmail_(email,assigned.period),canAssign:divisionLeader,period:assigned.period};
}
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
 const state=serviceRead_(),roster=operation==='metrics'&&globalView?[]:serviceRoster_();
 if(!globalView)state.requests=state.requests.filter(r=>serviceTicketAccess_(email,r,leaders,roster).canEdit);
 if(!globalView&&!state.requests.length)return {status:403};
 if(operation==='metrics'){
  return {status:200,metrics:serviceMetrics_(state.requests),trimester:serviceCurrentTrimester_()};
 }
 return {status:200,canReview:globalView,managers:globalView?roster:[],requests:state.requests.map(r=>{
  return serviceManagerRow_(r,state.events,email,leaders,roster);
 })};
}
function serviceManagerRow_(r,events,email,leaders,roster){
  const access=serviceTicketAccess_(email,r,leaders,roster),assignmentChoices=access.canAssign?roster.filter(m=>OWNER_EMAILS.includes(email_(email))||m.period===access.period):[];
  return {...serviceClientRow_(r,events),...access,assignmentChoices,version:r.version,email:r.email,name:r.name,phone:r.phone,urgency:r.urgency,attachment:r.attachment,legacyLog:r.legacyLog,emailState:serviceEmailState_(r,events),internalUpdates:events.filter(e=>e[1]===r.id&&e[2]==='update').map(e=>({time:e[0],actor:e[3],note:e[9],status:e[4],manager:e[8]}))};
}
function serviceStoredRow_(row){const copy=[...row];while(copy.length&&(copy[copy.length-1]===''||copy[copy.length-1]==null))copy.pop();return copy;}
function serviceVersion_(raw,event){return hash_(JSON.stringify([serviceStoredRow_(raw),serviceStoredRow_(event)]));}
function serviceCell_(value){return {userEnteredValue:typeof value==='number'?{numberValue:value}:typeof value==='boolean'?{boolValue:value}:{stringValue:String(value??'')}};}
function serviceAppend_(tab,values){return {appendCells:{sheetId:tab.sheetId,rows:[{values:values.map(serviceCell_)}],fields:'userEnteredValue'}};}
function serviceUpdateCell_(item,column,value){return {updateCells:{range:{sheetId:item.tab.sheetId,startRowIndex:item.row-1,endRowIndex:item.row,startColumnIndex:column,endColumnIndex:column+1},rows:[{values:[serviceCell_(value)]}],fields:'userEnteredValue'}};}
function serviceWrite_(email,r){
 const state=serviceRead_(),item=state.requests.find(x=>x.id===r.id);if(!item)return {status:404};
 const leaders=serviceLeaders_(),roster=serviceRoster_(),access=serviceTicketAccess_(email,item,leaders,roster);
 if(!access.canEdit)return {status:403};if(item.version!==r.version)return {status:409};
 const now=new Date().toISOString();
 if(r.action==='auth-service-email'){
  const latest=state.events.filter(e=>e[1]===item.id&&e[2]==='update'&&e[5]).slice(-1)[0];
  if(!latest||latest[6]!==r.eventId||serviceEmailState_(item,state.events)!=='unsent')return {status:409};
  if(!/^[^\s@,;<>]+@bethelsd\.org$/.test(item.email))return {status:400};
  Sheets.Spreadsheets.batchUpdate({requests:[serviceAppend_(state.logTab,[now,item.id,'email',email,item.status,'',latest[6],'sending','',''])]},SERVICE_SOURCE);
  try{MailApp.sendEmail({to:item.email,name:'NEST Client Relations',subject:'NEST service request '+item.id.slice(0,8).toUpperCase()+' · '+item.status,body:'Your request is now '+item.status+'.\n\n'+String(latest[5])+'\n\nView your requests securely: https://gknest.org/service\n'+(item.status==='Closed'?'Share your feedback: https://forms.gle/J3xe3qBiy7mReFLq6':'')});}
  catch(_){Sheets.Spreadsheets.batchUpdate({requests:[serviceAppend_(state.logTab,[now,item.id,'email',email,item.status,'',latest[6],'unknown','',''])]},SERVICE_SOURCE);return {status:502};}
  Sheets.Spreadsheets.batchUpdate({requests:[serviceAppend_(state.logTab,[now,item.id,'email',email,item.status,'',latest[6],'sent','',''])]},SERVICE_SOURCE);
  const event=[now,item.id,'email',email,item.status,'',latest[6],'sent','',''];
  const updated={...item,version:serviceVersion_(item.raw,event)};
  return {status:200,emailState:'sent',request:serviceManagerRow_(updated,[...state.events,event],email,leaders,roster)};
 }
 if(!SERVICE_STATUSES.includes(r.status)||typeof r.note!=='string'||r.note.length>2000||typeof r.publicNote!=='string'||r.publicNote.length>2000||typeof r.manager!=='string'||r.manager.length>254)return {status:400};
 const choices=roster.filter(m=>OWNER_EMAILS.includes(email_(email))||m.period===access.period),selected=choices.find(m=>m.email===r.manager);
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
  if(['auth-service-manage','auth-service-reviews','auth-service-metrics'].includes(r.action))return serviceManage_(r.action.slice(13),session.email);
  if(!['auth-service-update','auth-service-email'].includes(r.action))return {status:400};
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
