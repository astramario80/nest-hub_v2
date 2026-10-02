// Shared with the daily leadership access job. Only this division's roster may
// view a deck; position holders and division managers may edit. Owners remain.
const NEST_SLIDE_FOLDERS={'1':'1X7faoEUTi0dCNSOVi8EwFo4Z0fY6gEfG','2':'1SWRfcL8hT5C3CRu366rpoRCWXk6ObL7B','3':'16UJx1F6lStbayCUI41NOHGm5W0hKNFWX','4':'1t1KwHPPQ3L-wv6RLlv8t2yZLXX_Vccv0','5':'1diqsozFhlqdqgmu7rnfg3LzorBPzxBQh','7':'18zn5BYGBz8TyRnitb7arZFV7RIJDQ-VM','CTSO':'15l5SwyCQim0rYQTxMqgr7u3LvqSd8E7n'};
function nestSlideRole_(role){return String(role||'').trim().toLowerCase().replace(/^3d print specialist$/,'fabrication supervisor');}
function nestSlideRoster_(period){
 const sheet=SpreadsheetApp.openById('12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE').getSheetByName(period==='CTSO'?'CTSO':'Period '+period);
 if(!sheet)throw new Error('Division roster unavailable');
 const rows=sheet.getRange('A2:C1000').getValues().filter(row=>row.some(value=>String(value||'').trim()));
 const emails=rows.filter(row=>row[0]).map(row=>String(row[2]||'').trim().toLowerCase()).filter(email=>/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email));
 if(rows.length&&!emails.length)throw new Error('Division roster has no valid member emails; sharing was not changed');
 // A confirmed empty sheet has no members: remove former member grants.
 // Missing sheets and malformed nonempty rosters still fail without changes.
 return new Set(emails);
}
function nestSlidePermissions_(id,editors,viewers){
 const target={};viewers.forEach(email=>target[email]='reader');editors.forEach(email=>target[email]='writer');
 const permissions=nestSlideListPermissions_(id);
 permissions.forEach(permission=>{
  if(permission.role==='owner'||permission.view==='metadata')return;
  const email=String(permission.emailAddress||'').toLowerCase(),desired=permission.type==='user'?target[email]:null;
  if(desired===permission.role){delete target[email];return;}
  if(desired){
   // A direct editor grant can coexist with inherited reader access. Removing
   // that permission is rejected as inherited; patch the direct role instead.
   try{Drive.Permissions.patch({role:desired},id,permission.id,{supportsAllDrives:true});delete target[email];return;}
   catch(error){if(!/inherited/i.test(String(error.message)))throw error;return;}
  }
  // Parent folders are reconciled first, so inherited access follows the same
  // division policy. Any remaining inherited permission fails the final audit.
  try{Drive.Permissions.remove(id,permission.id,{supportsAllDrives:true});}
  catch(error){if(!/inherited/i.test(String(error.message)))throw error;}
 });
 Object.keys(target).forEach(email=>Drive.Permissions.insert({type:'user',role:target[email],value:email},id,{sendNotificationEmails:false,supportsAllDrives:true}));
 const final=nestSlideListPermissions_(id);
 const violations=final.filter(permission=>permission.role!=='owner'&&permission.view!=='metadata'&&(permission.type!=='user'||(editors.has(String(permission.emailAddress||'').toLowerCase())?'writer':viewers.has(String(permission.emailAddress||'').toLowerCase())?'reader':null)!==permission.role));
 if(violations.length){console.log(JSON.stringify(violations.map(p=>({type:p.type,role:p.role,hasEmail:Boolean(p.emailAddress),assigned:editors.has(String(p.emailAddress||'').toLowerCase()),member:viewers.has(String(p.emailAddress||'').toLowerCase()),view:p.view||'',details:p.permissionDetails||[]}))));throw new Error('Unexpected inherited or broad slide access remains on '+id);}
}
function nestSlideListPermissions_(id){
 let pageToken,permissions=[];
 do{const result=Drive.Permissions.list(id,{supportsAllDrives:true,maxResults:100,fields:'items(id,type,role,emailAddress,view,permissionDetails),nextPageToken',...(pageToken?{pageToken}: {})});permissions=permissions.concat(result.items||[]);pageToken=result.nextPageToken;}while(pageToken);
 return permissions;
}
function nestSlideLimitFolder_(id){
 // Drive's limited-access boundary prevents sharing from ancestor folders from
 // granting access to the content. Metadata-only entries are not content access.
 Drive.Files.patch({inheritedPermissionsDisabled:true},id,{supportsAllDrives:true});
 if(Drive.Files.get(id,{fields:'inheritedPermissionsDisabled',supportsAllDrives:true}).inheritedPermissionsDisabled!==true)throw new Error('Could not isolate division folder sharing');
}
function nestSyncDivisionSlideAccess(period){
 if(!Object.prototype.hasOwnProperty.call(NEST_SLIDE_FOLDERS,period))throw new Error('Unknown division');
 const roster=nestSlideRoster_(period);
 const leaders=SpreadsheetApp.openById('1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I').getSheetByName('Imported').getRange('B2:F99').getValues();
 const roleEmails={};leaders.forEach(row=>{
  const email=String(row[4]||'').trim().toLowerCase();if(String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()!==period||!roster.has(email))return;
  const role=nestSlideRole_(row[2]);if(!roleEmails[role])roleEmails[role]=new Set();roleEmails[role].add(email);
 });
 const management=new Set([...(roleEmails[period==='CTSO'?'chief executive officer':'division manager']||[]),...(roleEmails[period==='CTSO'?'executive vice-president':'assistant manager']||[])]);
 const folder=DriveApp.getFolderById(NEST_SLIDE_FOLDERS[period]);nestSlideLimitFolder_(folder.getId());nestSlidePermissions_(folder.getId(),new Set(),roster);
 const files=folder.getFiles();let count=0;
 while(files.hasNext()){
  const file=files.next();if(!file.getName().includes('Manager Slides'))continue;
  nestSlidePermissions_(file.getId(),management,roster);count++;
 }
 const subfolders=folder.getFoldersByName('Division Leader Slides');if(!subfolders.hasNext())throw new Error('Leadership slide folder missing');
 const source=subfolders.next();nestSlidePermissions_(source.getId(),new Set(),roster);
 const slides=source.getFiles();while(slides.hasNext()){
  const slide=slides.next();if(slide.getMimeType()!=='application/vnd.google-apps.presentation')continue;
  const role=nestSlideRole_(slide.getName().split('_').pop().replace(/^\d+-/,''));
  nestSlidePermissions_(slide.getId(),new Set([...(roleEmails[role]||[]),...management]),roster);count++;
 }
 console.log('Division '+period+': '+count+' decks verified; division-only viewers, assigned leaders and managers as editors.');
}
function nestSyncAllDivisionSlideAccess(){
 const store=PropertiesService.getScriptProperties();
 // Checkpoint each division so first-time sharing grants can exceed a single
 // Apps Script execution without losing progress or leaving later divisions out.
 if(!store.getProperty('nest-slide-access-pending')){
  nestSlideLimitFolder_('1JIjmW9E7Z0im8udvmdTksNdrb7NSjD5k');
  nestSlidePermissions_('1JIjmW9E7Z0im8udvmdTksNdrb7NSjD5k',new Set(),new Set());
  store.setProperty('nest-slide-access-pending',JSON.stringify(Object.keys(NEST_SLIDE_FOLDERS)));
  store.deleteProperty('nest-slide-access-completed');
 }
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='nestContinueDivisionSlideAccess'))ScriptApp.newTrigger('nestContinueDivisionSlideAccess').timeBased().everyMinutes(1).create();
 nestContinueDivisionSlideAccess();
}
function nestContinueDivisionSlideAccess(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{
  const store=PropertiesService.getScriptProperties(),raw=store.getProperty('nest-slide-access-pending');
  if(!raw)return;
  const pending=JSON.parse(raw);if(pending.length){nestSyncDivisionSlideAccess(pending[0]);pending.shift();}
  if(pending.length){store.setProperty('nest-slide-access-pending',JSON.stringify(pending));console.log('Division sharing continues automatically: '+pending.join(', '));}
  else{
   store.deleteProperty('nest-slide-access-pending');store.setProperty('nest-slide-access-completed',String(Date.now()));
   ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='nestContinueDivisionSlideAccess').forEach(t=>ScriptApp.deleteTrigger(t));
   console.log('All division slide access verified.');
  }
 }finally{lock.releaseLock();}
}
function nestReportDivisionSlideAccess(){
 const store=PropertiesService.getScriptProperties();
 console.log(store.getProperty('nest-slide-access-pending')?'Sharing still running: '+store.getProperty('nest-slide-access-pending'):store.getProperty('nest-slide-access-completed')?'All division slide access verified.':'No sharing update has been queued.');
}
