// School-owned queue remains the source of truth; public output is explicitly projected.
const FAB_QUEUE='13Dnk31EDgx2_E46gkEAJ_e0gamqsA_VoFSf8qQEr4vk';
const FAB_LOG='FabricationWebLog';
const FAB_STATUSES=['Queued','In progress','On hold','Errored','Ready for pickup','Done','Cancelled'];
function fabRole_(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');}
function fabAllowed_(email,leaders){
  if(OWNER_EMAILS.includes(email_(email)))return true;
  return leaders.some(row=>{
    const period=String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase();
    const role=fabRole_(row[2]);
    return email_(row[4])===memberEmail_(email,period)&&
      ((['1','2','3','4','5','7'].includes(period)&&['fabrication supervisor','division manager','assistant manager'].includes(role))||
      (period==='CTSO'&&['chief executive officer','chief financial officer','chief operations officer'].includes(role)));
  });
}
function fabStatus_(value){const v=String(value||'').trim();return v==='Printing'?'In progress':v==='Stand by'?'On hold':FAB_STATUSES.includes(v)?v:'Queued';}
function fabRange_(title){return "'"+title.replace(/'/g,"''")+"'";}
function fabColumns_(headers){
 const find=pattern=>headers.findIndex(header=>pattern.test(String(header||'').trim()));
 return {time:find(/^timestamp\b/i),email:find(/^email address\b/i),name:find(/^(choose your name|request[eo]r name|name\b)/i),machine:find(/(printer type.*formatted|fabrication (type|method)|equipment|machine|process|request type|service type)/i),status:find(/^status$/i),log:find(/^status log$/i),notes:find(/^notes$/i)};
}
function fabRead_(){
 const meta=Sheets.Spreadsheets.get(FAB_QUEUE,{fields:'sheets(properties)'});
 const tabs=(meta.sheets||[]).map(s=>s.properties);
 // Discover request tabs by their headers, rather than machine names.
 const eligible=tabs.filter(t=>!['Home','Structure','Library','Sheet8',FAB_LOG].includes(t.title)&&!/^Archive/i.test(t.title));
 if(eligible.length>40)throw new Error('Too many queue tabs');
 const headers=Sheets.Spreadsheets.Values.batchGet(FAB_QUEUE,{ranges:eligible.map(t=>fabRange_(t.title)+'!A3:AZ3')}).valueRanges||[];
 const mapped=eligible.map((tab,i)=>({tab,headers:headers[i]?.values?.[0]||[]})).map(item=>({...item,c:fabColumns_(item.headers)})).filter(item=>item.c.time>=0&&item.c.email>=0&&item.c.name>=0);
 const ranges=mapped.map(item=>fabRange_(item.tab.title)+'!A4:AZ'+Math.min(item.tab.gridProperties.rowCount,5000));
 const data=ranges.length?Sheets.Spreadsheets.Values.batchGet(FAB_QUEUE,{ranges,valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges||[]:[];
 const requests=[];
 mapped.forEach((item,index)=>{
  (data[index]?.values||[]).forEach((row,offset)=>{
   const email=String(row[item.c.email]||'').trim().toLowerCase();
   if(!row[item.c.time]||!row[item.c.name]||!districtEmail_(email))return;
   const id=hash_(JSON.stringify([row[item.c.time],email,String(row[item.c.name])]));
   const status=fabStatus_(row[item.c.status]);
   const fields=item.headers.map((label,i)=>({label:String(label),value:String(row[i]??'')})).filter((field,i)=>field.label&&![item.c.status,item.c.log,item.c.notes,item.c.email,item.c.name].includes(i)&&field.value);
   requests.push({id,version:hash_(JSON.stringify(row)),status,machine:String(row[item.c.machine]||item.tab.title).slice(0,160),name:String(row[item.c.name]),email,notes:String(row[item.c.notes]||''),legacyLog:String(row[item.c.log]||''),fields,tab:item.tab,columns:item.c,row:offset+4,raw:row});
  });
 });
 const logTab=tabs.find(t=>t.title===FAB_LOG);
 const events=logTab?(Sheets.Spreadsheets.Values.get(FAB_QUEUE,fabRange_(FAB_LOG)+'!A2:I'+Math.min(logTab.gridProperties.rowCount,20000)).values||[]):[];
 requests.forEach(item=>{
  const latest=events.filter(e=>e[1]===item.id&&e[2]==='update').slice(-1)[0];
  item.version=hash_(JSON.stringify([item.raw,latest?.[6]||'']));
  if(latest&&(item.columns.status<0||!item.raw[item.columns.status]))item.status=fabStatus_(latest[4]);
  if(latest&&item.columns.notes<0)item.notes=String(latest[8]||'');
 });
 return {requests,events,logTab};
}
function fabEvents_(request,events){return events.filter(e=>e[1]===request.id&&e[2]==='update').map(e=>({time:String(e[0]),status:fabStatus_(e[4]),note:String(e[5]||''),eventId:String(e[6])})).slice(-30);}
function fabPublic_(request,events){return {id:request.id,status:request.status,machine:request.machine,updates:fabEvents_(request,events)};}
function fabView_(email,page){
 const privateView=Boolean(email);
 if(privateView&&!fabAllowed_(email,Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F99").values||[]))return {status:403};
 if(!Number.isInteger(page)||page<0||page>100)return {status:400};
 const state=fabRead_();
 const all=state.requests.filter(r=>state.requests.filter(other=>other.id===r.id).length===1);
 const pageRows=all.slice(page*50,(page+1)*50);
 return {status:200,statuses:FAB_STATUSES,page,total:all.length,hasMore:all.length>(page+1)*50,requests:pageRows.map(r=>privateView?{
  ...fabPublic_(r,state.events),version:r.version,name:r.name,email:r.email,notes:r.notes,legacyLog:r.legacyLog,fields:r.fields,canUpdate:true,
  emailState:fabEmailState_(r.id,state.events)
 }:fabPublic_(r,state.events))};
}
function fabEmailState_(id,events){
 const latest=events.filter(e=>e[1]===id&&e[2]==='update').slice(-1)[0];
 if(!latest)return 'none';
 const mail=events.filter(e=>e[1]===id&&e[6]===latest[6]&&e[2]==='email').slice(-1)[0];
 return mail?String(mail[7]):'unsent';
}
function fabEnsureLog_(state){
 if(state.logTab)return state.logTab;
 const tab=Sheets.Spreadsheets.batchUpdate({requests:[{addSheet:{properties:{title:FAB_LOG,hidden:true,gridProperties:{rowCount:20000,columnCount:9}}}}]},FAB_QUEUE).replies[0].addSheet.properties;
 Sheets.Spreadsheets.Values.update({values:[['Time','Request ID','Action','Actor','Status','Public update','Event ID','Email state','Internal note']]},FAB_QUEUE,fabRange_(FAB_LOG)+'!A1:I1',{valueInputOption:'RAW'});
 return tab;
}
function fabCell_(value){return {userEnteredValue:{stringValue:String(value??'')}};}
function fabAppendRequest_(logTab,values){return {appendCells:{sheetId:logTab.sheetId,rows:[{values:values.map(fabCell_)}],fields:'userEnteredValue'}};}
function fabWrite_(email,r){
 if(!fabAllowed_(email,Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F99").values||[]))return {status:403};
 if(!/^[a-f0-9]{64}$/.test(r.id||'')||!/^[a-f0-9]{64}$/.test(r.version||''))return {status:400};
 const state=fabRead_(),matches=state.requests.filter(item=>item.id===r.id);
 if(!matches.length)return {status:404};if(matches.length!==1)return {status:409};
 const item=matches[0];if(item.version!==r.version)return {status:409};
 const now=new Date().toISOString(),logTab=fabEnsureLog_(state);
 if(r.action==='auth-fabrication-email'){
  const latest=state.events.filter(e=>e[1]===item.id&&e[2]==='update').slice(-1)[0];
  if(!latest||latest[4]!==item.status||!r.eventId||r.eventId!==latest[6])return {status:409};
  if(fabEmailState_(item.id,state.events)!=='unsent')return {status:409};
  // Reserve before sending; ambiguous provider failures require human review, never auto-retry.
  Sheets.Spreadsheets.batchUpdate({requests:[fabAppendRequest_(logTab,[now,item.id,'email',email,item.status,'',latest[6],'sending',''])]},FAB_QUEUE);
  try {
   MailApp.sendEmail({to:item.email,subject:'NEST fabrication update · '+item.id.slice(0,8).toUpperCase(),body:'Your fabrication request '+item.id.slice(0,8).toUpperCase()+' is now '+item.status+'.\n\n'+String(latest[5]||'')+'\n\nView request status: https://gknest.org/print-queue#'+item.id,name:'NEST Fabrication'});
  }catch(error){
   Sheets.Spreadsheets.batchUpdate({requests:[fabAppendRequest_(logTab,[now,item.id,'email',email,item.status,'',latest[6],'unknown',''])]},FAB_QUEUE);
   return {status:502,emailState:'unknown'};
  }
  Sheets.Spreadsheets.batchUpdate({requests:[fabAppendRequest_(logTab,[now,item.id,'email',email,item.status,'',latest[6],'sent',''])]},FAB_QUEUE);
  return {status:200,emailState:'sent'};
 }
 if(!FAB_STATUSES.includes(r.status)||typeof r.publicNote!=='string'||r.publicNote.length>1000||typeof r.notes!=='string'||r.notes.length>2000)return {status:400};

 const eventId=Utilities.getUuid();
 const requests=[
  {updateCells:{range:{sheetId:item.tab.sheetId,startRowIndex:item.row-1,endRowIndex:item.row,startColumnIndex:item.columns.status,endColumnIndex:item.columns.status+1},rows:[{values:[fabCell_(r.status)]}],fields:'userEnteredValue'}},
  {updateCells:{range:{sheetId:item.tab.sheetId,startRowIndex:item.row-1,endRowIndex:item.row,startColumnIndex:item.columns.log,endColumnIndex:item.columns.log+1},rows:[{values:[fabCell_('Status: '+r.status+' - '+email+' - '+now+'\n'+item.legacyLog)]}],fields:'userEnteredValue'}},
  {updateCells:{range:{sheetId:item.tab.sheetId,startRowIndex:item.row-1,endRowIndex:item.row,startColumnIndex:item.columns.notes,endColumnIndex:item.columns.notes+1},rows:[{values:[fabCell_(r.notes)]}],fields:'userEnteredValue'}},
  fabAppendRequest_(logTab,[now,item.id,'update',email,r.status,r.publicNote,eventId,'',r.notes])
 ];
 // Status and audit event commit together in the same Sheets batch.
 const writes=item.columns.status>=0&&item.columns.log>=0&&item.columns.notes>=0?requests:[requests[3]];
 Sheets.Spreadsheets.batchUpdate({requests:writes},FAB_QUEUE);
 return {status:200,eventId};
}
function fabDispatch_(r){
 if(r.action==='fabrication-public')return fabView_('',r.page);
 const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
 if(!session)return {status:401};
 if(r.action==='auth-fabrication-view')return fabView_(session.email,r.page);
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
 try{return fabWrite_(session.email,r);}finally{lock.releaseLock();}
}
