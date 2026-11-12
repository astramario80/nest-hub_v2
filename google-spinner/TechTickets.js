// Tech tickets are private to their reporter and current Software Technicians/website administrators.
const TECH_BOOK='169SCXhVH1ufehSUSv_qkbVBJhrdz4MVAjBMOUfDBMGg',TECH_TAB='NEST Tech Tickets';
const TECH_TYPES=['Website bug','Software / sign-in','Computer / hardware','Hardware / machines','Network / internet','Software Request','CTE-specific need','Other'];
const TECH_STATUSES=['New','Assigned','In progress','Waiting','Pending','Resolved','Closed'];
function techYear_(date){const parts=Utilities.formatDate(date,'America/Los_Angeles','yyyy-MM').split('-').map(Number),year=parts[0]-(parts[1]<8?1:0);return year+'–'+(year+1);}
function techAccess_(session,brief,withoutTechnicians){
 const admin=websiteAdmin_(session.email),technicians=[],periods=[];if(admin&&(brief||withoutTechnicians))return {admin:true,canManage:true,canViewOverview:true,slideExportPeriods:[...HIRING_PERIODS],technicians,periods:[...HIRING_PERIODS]};const leaders=hiringRows_();let technician=false,overview=false;const slidePeriods=[];
 if(brief){const allowed=admin||leaders.some(row=>{const p=String(row[0]||'').replace(/period/ig,'').trim().toUpperCase();if(!HIRING_PERIODS.includes(p)||!/^software technician$/i.test(String(row[2]||'').trim()))return false;const address=memberEmail_(session.email,p);return email_(row[4])===address&&rows_(p).some(r=>email_(r[1])===address);});return {admin,canManage:allowed,technicians,periods};}
 HIRING_PERIODS.forEach(period=>{const address=memberEmail_(session.email,period),roster=rows_(period);if(roster.some(row=>email_(row[1])===address)||manualPeriodAccess_(session.email,period))periods.push(period);if(roster.some(row=>email_(row[1])===address)&&leaders.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&email_(row[4])===address&&/^(division manager|assistant manager|chief (executive|financial|operations) officers?|executive vice-president)$/i.test(String(row[2]||'').trim())))overview=true;
 if(roster.some(row=>email_(row[1])===address)&&leaders.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&email_(row[4])===address&&/^(software technician|division manager|assistant manager|chief (executive|financial|operations) officers?|executive vice-president)$/i.test(String(row[2]||'').trim())))slidePeriods.push(period);
 leaders.filter(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&/^software technician$/i.test(String(row[2]||'').trim())).forEach(row=>{const mail=email_(row[4]),member=roster.find(r=>email_(r[1])===mail);if(member){if(mail===address)technician=true;if(!technicians.some(t=>t.email===mail))technicians.push({email:mail,name:String(member[0])});}});});
 return {admin,canManage:admin||technician,canViewOverview:admin||technician||overview,slideExportPeriods:admin||typeof nestExecutive_==='function'&&nestExecutive_(session.email,leaders)?[...HIRING_PERIODS]:slidePeriods,technicians,periods:admin?[...HIRING_PERIODS]:periods};
}
let TECH_NATIVE_STATE=null;
function techState_(){
 if(TECH_NATIVE_STATE)return TECH_NATIVE_STATE;
 const tabs=Sheets.Spreadsheets.get(TECH_BOOK,{fields:'sheets(properties(sheetId,title,gridProperties(rowCount)))'}).sheets||[],tab=tabs.find(s=>s.properties.title===TECH_TAB)?.properties;
 if(!tab)return {tab,records:[]};
 const rows=Sheets.Spreadsheets.Values.get(TECH_BOOK,"'"+TECH_TAB+"'!A2:B"+tab.gridProperties.rowCount).values||[];
 return {tab,records:rows.map((row,i)=>{if(!row[0])return null;const ticket=JSON.parse(row[1]);if(ticket.id!==row[0])throw Error('Invalid ticket record');return {row:i+2,ticket};}).filter(Boolean)};
}
function techVersion_(ticket){return hash_(JSON.stringify(ticket));}
function techPublic_(ticket,manage){const {imageFile,submissionHash,lastAction,deliveries,escalation,...safe}=ticket;return {...safe,...(manage?{deliveries:(deliveries||[]).map(({actionHash,...entry})=>entry),escalation:escalation||null}:{escalation:escalation?{stage:escalation.stage,time:escalation.time,recipientName:escalation.recipient?.name||escalation.recipient?.position||''}:null}),hasScreenshot:!!imageFile,version:techVersion_(ticket),history:(ticket.history||[]).filter(e=>manage||!e.internal)};}
function techImageRead_(ticket){const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(ticket.imageFile)+'?alt=media',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});return response.getResponseCode()===200?'data:image/jpeg;base64,'+Utilities.base64Encode(response.getBlob().getBytes()):null;}

function techText_(v,n,required){return typeof v==='string'&&v.length<=n&&(!required||v.trim())&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);}
function techFields_(f){return f&&typeof f==='object'&&!Array.isArray(f)&&Object.keys(f).every(k=>['title','description','type','station','period','page','stationIds','machineIds'].includes(k))&&techText_(f.title,120,true)&&techText_(f.description,4000,true)&&TECH_TYPES.includes(f.type)&&techText_(f.station,6000,!((f.stationIds||[]).length||(f.machineIds||[]).length))&&['stationIds','machineIds'].every(key=>f[key]===undefined||Array.isArray(f[key])&&f[key].length<=100&&new Set(f[key]).size===f[key].length&&f[key].every(id=>/^[a-f0-9]{64}$/.test(id)))&&HIRING_PERIODS.includes(f.period)&&techText_(f.page,250,false)&&(!f.page||/^\/(?!\/)[^?#]*$/.test(f.page));}
function techSave_(state,ticket,row){
 let tab=state.tab;if(!tab){tab=Sheets.Spreadsheets.batchUpdate({requests:[{addSheet:{properties:{title:TECH_TAB,gridProperties:{rowCount:10001,columnCount:2}}}}]},TECH_BOOK).replies[0].addSheet.properties;Sheets.Spreadsheets.Values.update({values:[['Ticket ID','Private ticket record']]},TECH_BOOK,"'"+TECH_TAB+"'!A1:B1",{valueInputOption:'RAW'});}
 if(!row&&state.records.length>=10000)throw Error('Ticket workbook capacity reached');
 const nextRow=row||state.records.reduce((max,entry)=>Math.max(max,entry.row),1)+1;if(nextRow>10001)throw Error('Ticket workbook capacity reached');
 const values=[[ticket.id,JSON.stringify(ticket)]];if(values[0][1].length>45000)throw Error('Ticket history capacity reached');
 Sheets.Spreadsheets.Values.update({values},TECH_BOOK,"'"+TECH_TAB+"'!A"+nextRow+':B'+nextRow,{valueInputOption:'RAW'});
}
function techImageCreate_(data,id,store){
 let folder=store.getProperty('tech-ticket-image-folder');if(!folder){folder=Drive.Files.create({name:'NEST Tech Ticket Screenshots (private)',mimeType:'application/vnd.google-apps.folder',writersCanShare:false}).id;store.setProperty('tech-ticket-image-folder',folder);}
 const blob=Utilities.newBlob(Utilities.base64Decode(data.split(',')[1]),'image/jpeg',id+'.jpg');return Drive.Files.create({name:id+'.jpg',mimeType:'image/jpeg',parents:[folder]},blob,{fields:'id'}).id;
}
// Aggregate counts only: never expose another reporter's ticket details or station text.
function techHealth_(tickets,now){
 const byYear={};tickets.forEach(t=>{if(!/^\d{4}–\d{4}$/.test(t.year||''))return;const year=byYear[t.year]||(byYear[t.year]={total:0,open:0,agedOpen:0,unassigned:0,stationsAffected:0,oldestOpenDays:0,types:[],_stations:[]});
  year.total++;const open=!['Resolved','Closed'].includes(t.status),age=Math.max(0,Math.floor((now-Date.parse(t.created))/86400000)),type=String(t.type||'Other');let category=year.types.find(x=>x.type===type);if(!category){category={type,total:0,open:0,closed:0};year.types.push(category);}category.total++;category[open?'open':'closed']++;
  if(open){year.open++;if(!t.assignee)year.unassigned++;if(Number.isFinite(age)){if(age>=7)year.agedOpen++;year.oldestOpenDays=Math.max(year.oldestOpenDays,age);}const stations=t.targets?.length?t.targets.map(x=>x.kind+'|'+x.id):[String(t.station||'').split(';')[0].trim().toLowerCase().replace(/^station\s*/,'').replace(/^0+(?=\d)/,'').replace(/\s+/g,' ')];stations.filter(Boolean).forEach(station=>{if(!year._stations.includes(station))year._stations.push(station);});}
 });Object.values(byYear).forEach(year=>{year.stationsAffected=year._stations.length;delete year._stations;year.types.sort((a,b)=>b.total-a.total||a.type.localeCompare(b.type));});return {byYear,asOf:new Date(now).toISOString()};
}
function techTargets_(fields){
 const stations=fields.stationIds||[],machines=fields.machineIds||[];if(!stations.length&&!machines.length)return ['Computer / hardware','Hardware / machines'].includes(fields.type)?null:{};
 const computerCatalog=stations.length?roomComputerChoices_():[],machineCatalog=machines.length?roomMachineChoices_():[],targets=[];
 for(const id of stations){const item=computerCatalog.find(x=>x.id===id);if(!item)return null;targets.push({id,kind:'computer',name:'Station '+item.number,serial:item.serial});}
 for(const id of machines){const item=machineCatalog.find(x=>x.id===id);if(!item)return null;targets.push({id,kind:'machine',name:item.name,serial:item.serial,machineType:item.machineType});}
 return {targets,station:targets.map(x=>x.name+(x.serial?'; Serial Number '+x.serial:'')).join(', ')};
}
function techDispatch_(r){
 const store=PropertiesService.getScriptProperties(),session=authSession_(r.session,store,Date.now());if(!session)return {status:401};
 const operation=r.operation||'view',access=techAccess_(session,operation==='access',!['view','update'].includes(operation));
 if(operation==='access')return {status:200,canManage:access.canManage,canEscalateOutside:techCanEscalate_(session)};
 if(['escalation-options','escalation-preview','escalation-send','escalate-owner','escalation-reconcile'].includes(operation))return techEscalationDispatch_(r,session,access);
 if(!['slide-snapshot','slide-export','catalog','result','view','submit','update','image','legacy'].includes(operation))return {status:400};
 if(!access.admin&&!access.periods.length)return {status:403};
 if(['slide-snapshot','slide-export'].includes(operation))return techSlideDispatch_(r,session,access);
 if(operation==='catalog')return {status:200,periods:access.periods,stations:roomComputerChoices_(),machines:roomMachineChoices_()};
 if(operation==='legacy'){
  if(!access.canManage)return {status:403};
  const tabs=Sheets.Spreadsheets.get(TECH_BOOK,{fields:'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))'}).sheets||[];
  return {status:200,sheets:tabs.filter(s=>s.properties.title==='TechTickets').map(s=>{const p=s.properties;return {name:p.title,rows:Sheets.Spreadsheets.Values.get(TECH_BOOK,"'"+p.title.replace(/'/g,"''")+"'!A1:AZ"+Math.min(p.gridProperties.rowCount,10001)).values||[]};})};
 }
 if(operation==='view'){
  const state=techState_(),records=state.records.map(x=>x.ticket).filter(t=>access.canManage||t.reporter===session.email);
  return {status:200,canManage:access.canManage,canViewOverview:access.canViewOverview,slideExportPeriods:access.slideExportPeriods||[],overviewTables:access.canViewOverview?techOverviewTables_(state.records.map(x=>x.ticket)):{},canEscalateOutside:techCanEscalate_(session),periods:access.periods,technicians:access.canManage?access.technicians:[],types:TECH_TYPES,statuses:TECH_STATUSES,currentYear:techYear_(new Date()),roomHealth:techHealth_(state.records.map(x=>x.ticket),Date.now()),tickets:records.map(t=>techPublic_(t,access.canManage))};
 }
 if(!/^[a-f0-9-]{36}$/.test(r.id||''))return {status:400};
 if(operation==='result'){const entry=techState_().records.find(e=>e.ticket.id===r.id&&e.ticket.reporter===session.email);return entry?{status:200,ticket:techPublic_(entry.ticket,access.canManage)}:{status:404};}
 if(operation==='image'){
  const entry=techState_().records.find(e=>e.ticket.id===r.id),ticket=entry?.ticket;if(!ticket||!ticket.imageFile||!access.canManage&&ticket.reporter!==session.email)return {status:404};
  const image=techImageRead_(ticket);return image?{status:200,image}:{status:503};
 }
 if(operation==='submit'&&(!techFields_(r.fields)||!access.admin&&!access.periods.includes(r.fields.period)||typeof r.screenshot!=='string'||r.screenshot.length>500000||r.screenshot&&!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(r.screenshot)))return {status:400};
 if(operation==='update'&&(!access.canManage||!TECH_STATUSES.includes(r.status)||!techText_(r.note,2000,false)||typeof r.internal!=='boolean'||typeof r.assignee!=='string'||r.assignee&&!access.technicians.some(t=>t.email===r.assignee)||!/^[a-f0-9]{64}$/.test(r.version||'')||!/^[a-f0-9-]{36}$/.test(r.actionId||'')))return {status:access.canManage?400:403};
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};try{
 const state=techState_(),entry=state.records.find(e=>e.ticket.id===r.id),now=new Date().toISOString();
 if(operation==='submit'){
  const submissionHash=hash_(JSON.stringify([session.email,r.fields,r.screenshot]));if(entry)return entry.ticket.reporter===session.email&&entry.ticket.submissionHash===submissionHash?{status:200,ticket:techPublic_(entry.ticket,access.canManage)}:{status:409};
  if(state.records.filter(e=>e.ticket.reporter===session.email&&Date.parse(e.ticket.created)>Date.now()-3600000).length>=12)return {status:429};
  const targets=techTargets_(r.fields);if(!targets)return {status:400,error:'Select one or more current computer stations or machines. Refresh equipment choices if the inventory changed.'};
  const ticket={id:r.id,...r.fields,...targets,reporter:session.email,reporterName:session.username,created:now,updated:now,year:techYear_(new Date()),status:'New',assignee:'',history:[{time:now,actor:techActorLabel_(session),status:'New',note:'Ticket submitted.',internal:false}],submissionHash,imageFile:r.screenshot?techImageCreate_(r.screenshot,r.id,store):''};techSave_(state,ticket);return {status:200,ticket:techPublic_(ticket,access.canManage)};
 }
 if(!entry)return {status:404};const ticket=entry.ticket;
 const actionHash=hash_(JSON.stringify([session.email,r.status,r.note,r.internal,r.assignee]));if(ticket.lastAction?.id===r.actionId)return ticket.lastAction.hash===actionHash?{status:200,ticket:techPublic_(ticket,true)}:{status:409};
 if(techVersion_(ticket)!==r.version)return {status:409};if(ticket.history.length>=100)return {status:409,error:'This ticket has reached its update limit. Contact the website owner.'};
 ticket.status=r.status;ticket.assignee=r.assignee;ticket.updated=now;if(techCanEscalate_(session)&&ticket.escalation?.stage==='owner-review'&&['Resolved','Closed'].includes(r.status))ticket.escalation={...ticket.escalation,stage:'reviewed',time:now};ticket.history.push({time:now,actor:techActorLabel_(session),status:r.status,note:r.note.trim(),internal:r.internal,assignee:r.assignee});ticket.lastAction={id:r.actionId,hash:actionHash};techSave_(state,ticket,entry.row);return {status:200,ticket:techPublic_(ticket,true)};
 }finally{lock.releaseLock();}
}

// Request-scoped native reads avoid the shared Advanced Sheets per-minute quota.
// Every request rereads authentication and current roles; nothing survives this call.
function techReadContext_(r,work){
 const previous=NEST_ACCESS_READS,previousState=TECH_NATIVE_STATE;NEST_ACCESS_READS=new Map();TECH_NATIVE_STATE=null;
 try{
  const control=SpreadsheetApp.openById(NEST_DATABASE);
  const read=(book,id,title,key,column,width,limit)=>{const sheet=book.getSheetByName(title);if(!sheet)throw Error('Ticket access source is unavailable');const count=Math.max(1,Math.min(sheet.getLastRow(),limit||sheet.getLastRow())-1);const values=sheet.getRange(2,column,count,width).getDisplayValues();NEST_ACCESS_READS.set(id+':'+key,values);};
  read(control,NEST_DATABASE,'StudentNESTAccess',AUTH_SHEET,1,12);
  const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
  if(session){
   const admin=websiteAdmin_(session.email);
   if(!admin||['view','update'].includes(r.operation||'view')){
    read(SpreadsheetApp.openById(LEADERSHIP_DATABASE),LEADERSHIP_DATABASE,'Imported',"'Imported'!B2:F",2,5);
    HIRING_PERIODS.forEach(period=>{const title=period==='CTSO'?'CTSO':'Period '+period;read(control,NEST_DATABASE,title,"'"+title+"'!A2:C1000",1,3,1000);});
   }
   const sheet=SpreadsheetApp.openById(TECH_BOOK).getSheetByName(TECH_TAB);
   if(!sheet)TECH_NATIVE_STATE={tab:null,records:[]};
   else{const rows=sheet.getLastRow()>1?sheet.getRange(2,1,Math.min(sheet.getLastRow()-1,10000),2).getDisplayValues():[];TECH_NATIVE_STATE={tab:{sheetId:sheet.getSheetId(),title:TECH_TAB},records:rows.map((row,i)=>{if(!row[0])return null;const ticket=JSON.parse(row[1]);if(ticket.id!==row[0])throw Error('Invalid ticket record');return {row:i+2,ticket};}).filter(Boolean)};}
  }
  return work();
 }finally{NEST_ACCESS_READS=previous;TECH_NATIVE_STATE=previousState;}
}
