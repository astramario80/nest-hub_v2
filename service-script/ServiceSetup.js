// Install in the spreadsheet-bound service project, not in the NEST sign-in bridge.
const SERVICE_SETUP_VERSION='nest-service-2026-10-v1';
function serviceHeaders_(sheet){return sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getDisplayValues()[0];}
function serviceEnsureColumn_(sheet,title){
 const headers=serviceHeaders_(sheet),index=headers.indexOf(title);if(index>=0)return index+1;
 const col=Math.max(1,sheet.getLastColumn())+1;if(col>sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),col-sheet.getMaxColumns());
 sheet.getRange(1,col).setValue(title);return col;
}
function serviceTicketId_(sheet,row){const col=serviceEnsureColumn_(sheet,'Request ID');let id=String(sheet.getRange(row,col).getValue()||'');if(!id){id=Utilities.getUuid();sheet.getRange(row,col).setValue(id);}return id;}
function serviceRowById_(id){
 const ss=getServiceSs_(),matches=[];
 [CONFIG.TABS.SERVICE_REQUESTS,CONFIG.TABS.CLOSED_TICKETS].forEach(name=>{
  const sheet=ss.getSheetByName(name),col=serviceHeaders_(sheet).indexOf('Request ID')+1;if(col<1||sheet.getLastRow()<2)return;
  sheet.getRange(2,col,sheet.getLastRow()-1,1).getValues().forEach((value,i)=>{if(String(value[0])===String(id))matches.push({sheet,row:i+2});});
 });
 if(matches.length!==1)throw new Error('The request is missing or its ID is duplicated. Refresh the request list.');return matches[0];
}
function serviceEditorEmails_(){
 const allowed=new Set(),sheet=getLeadershipSheet_();
 if(!sheet||sheet.getLastRow()<2)throw new Error('Leadership roster unavailable; permissions were not changed.');
 sheet.getRange(2,2,sheet.getLastRow()-1,5).getValues().forEach(row=>{
  const period=String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase(),role=String(row[2]||'').trim().toLowerCase().replace(/\s+/g,' '),email=String(row[4]||'').trim().toLowerCase();
  if(email&&(['division manager','assistant manager','director of client relations'].includes(role)||period==='CTSO'&&/^(chief (executive|financial|operations) officers?|executive vice[ -]president)$/.test(role)))allowed.add(email);
 });
 const owner=getServiceFile_().getOwner();if(owner)allowed.add(owner.getEmail().toLowerCase());
 return allowed;
}
function serviceRequireEditor_(){
 const actor=String(Session.getActiveUser().getEmail()||'').toLowerCase();if(!actor||!serviceEditorEmails_().has(actor))throw new Error('A current Client Relations leadership role is required.');return actor;
}
function TRG_ServiceAccessSync(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return;
 try{reconcileServiceSpreadsheetEditors_();ensureAllSheetsBaselineProtection_();}finally{lock.releaseLock();}
}
function serviceMapRow_(source,target,row){
 const a=serviceHeaders_(source),b=serviceHeaders_(target),key=value=>{
  const h=String(value||'').trim().toLowerCase();
  if(/^(log|project notes)$/.test(h))return 'log';if(/^(choose your name|please share your first and last name)/.test(h))return 'name';
  if(/phone number/.test(h))return 'phone';if(/how fast do you need/.test(h))return 'urgency';if(/picture or video/.test(h))return 'attachment';
  return h.replace(/[.?:]+$/,'');
 };
 const values=source.getRange(row,1,1,a.length).getValues()[0];return b.map(h=>{const i=h?a.findIndex(s=>key(s)===key(h)):-1;let value=i>=0?values[i]:'';if(key(h)==='name'&&!b.some(v=>/^If you don't see your name/i.test(v))){const fallback=a.findIndex(v=>/^If you don't see your name/i.test(v));if(fallback>=0&&values[fallback])value=values[fallback];}return typeof value==='string'&&value.startsWith('=')?"'"+value:value;});
}
function Tool_InstallServiceWeb(){
 const ss=getServiceSs_(),owner=getServiceFile_().getOwner();
 if(!owner||Session.getEffectiveUser().getEmail().toLowerCase()!==owner.getEmail().toLowerCase())throw new Error('The spreadsheet owner must run integration setup.');
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('service-setup-version')!==SERVICE_SETUP_VERSION){
  const backup=getServiceFile_().makeCopy('NEST Service Requests — before service integration '+Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd HHmmss'));
  props.setProperty('service-backup-file',backup.getId());
 }
 const ids=new Set();
 [CONFIG.TABS.SERVICE_REQUESTS,CONFIG.TABS.CLOSED_TICKETS].forEach(name=>{
  const sheet=ss.getSheetByName(name);if(!sheet)throw new Error('Missing ticket tab: '+name);
  const idColumn=serviceEnsureColumn_(sheet,'Request ID');serviceEnsureColumn_(sheet,'Days Opened');serviceEnsureColumn_(sheet,'NEST Sort');
  const last=sheet.getLastRow();if(last<2)return;
  const rows=sheet.getRange(2,1,last-1,sheet.getLastColumn()).getValues();
  const values=rows.map(row=>{
   if(!row.some(v=>v!==''&&v!=null))return [''];let id=String(row[idColumn-1]||'');if(!id)id=Utilities.getUuid();
   if(!/^[a-f0-9-]{36}$/.test(id)||ids.has(id))throw new Error('Invalid or duplicate Request ID; restore/inspect the backup before retrying.');ids.add(id);return [id];
  });sheet.getRange(2,idColumn,values.length,1).setValues(values);
 });
 let log=ss.getSheetByName('ServiceWebLog');
 const logHeaders=['Time','Request ID','Action','Actor','Status','Client update','Event ID','Email state','Manager','Internal note'];
 if(!log){log=ss.insertSheet('ServiceWebLog');log.getRange(1,1,1,10).setValues([logHeaders]);log.hideSheet();}
 else if(serviceHeaders_(log).slice(0,10).join('|')!==logHeaders.join('|'))throw new Error('ServiceWebLog has unexpected headers.');
 // Reserve capacity for structured events; the bridge appends records without formulas.
 if(log.getMaxRows()<30000)log.insertRowsAfter(log.getMaxRows(),30000-log.getMaxRows());
 const queue=ss.getSheetByName(CONFIG.TABS.EMAIL_QUEUE);if(queue){
  serviceEnsureColumn_(queue,'Request ID');
  if(queue.getLastRow()>1)queue.getRange(2,1,queue.getLastRow()-1,1).getValues().forEach(([status],i)=>{if(status==='Pending')queue.getRange(i+2,1).setValue('Review required: pre-integration email');});
 }
 calculateDaysOpened();updateServiceBarometer();reconcileServiceSpreadsheetEditors_();ensureAllSheetsBaselineProtection_();
 // Row protections formerly granted project managers must also be reconciled.
 [CONFIG.TABS.SERVICE_REQUESTS,CONFIG.TABS.CLOSED_TICKETS].forEach(name=>ss.getSheetByName(name).getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(protection=>{
  if(/^TICKET_ROW_PROTECT:/.test(protection.getDescription())){const allowed=serviceEditorEmails_();protection.getEditors().forEach(user=>{if(!allowed.has(user.getEmail().toLowerCase()))protection.removeEditor(user);});protection.addEditors([...allowed]);if(protection.canDomainEdit())protection.setDomainEdit(false);}
 }));
 // Remove domain/anyone read permissions. Hidden tabs alone do not protect records.
 const permissions=Drive.Permissions.list(CONFIG.IDS.SERVICE_SS,{fields:'permissions(id,type,role)'}).permissions||[];
 permissions.filter(p=>['domain','anyone'].includes(p.type)).forEach(p=>Drive.Permissions.remove(CONFIG.IDS.SERVICE_SS,p.id));
 // Existing explicitly invited readers also bypass per-client ownership filtering.
 getServiceFile_().getViewers().forEach(user=>getServiceFile_().removeViewer(user));
 const triggers=ScriptApp.getProjectTriggers();
 if(!triggers.some(t=>t.getHandlerFunction()==='TRG_onFormSubmit'))ScriptApp.newTrigger('TRG_onFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
 if(!triggers.some(t=>t.getHandlerFunction()==='TRG_ServiceAccessSync'))ScriptApp.newTrigger('TRG_ServiceAccessSync').timeBased().everyMinutes(5).create();
 props.setProperty('service-setup-version',SERVICE_SETUP_VERSION);
 Logger.log('Integration ready. Backup file ID: '+props.getProperty('service-backup-file'));
}
