// Shared with the daily leadership access job. Only this division's roster may
// view a deck; position holders and division managers may edit. Owners remain.
const NEST_SLIDE_FOLDERS={'1':'1X7faoEUTi0dCNSOVi8EwFo4Z0fY6gEfG','2':'1SWRfcL8hT5C3CRu366rpoRCWXk6ObL7B','3':'16UJx1F6lStbayCUI41NOHGm5W0hKNFWX','4':'1t1KwHPPQ3L-wv6RLlv8t2yZLXX_Vccv0','5':'1diqsozFhlqdqgmu7rnfg3LzorBPzxBQh','7':'18zn5BYGBz8TyRnitb7arZFV7RIJDQ-VM','CTSO':'15l5SwyCQim0rYQTxMqgr7u3LvqSd8E7n'};
function nestSlideRole_(role){return String(role||'').trim().toLowerCase().replace(/^3d print specialist$/,'fabrication supervisor');}
function nestSlideRoster_(period){
 const sheet=SpreadsheetApp.openById('12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE').getSheetByName(period==='CTSO'?'CTSO':'Period '+period);
 if(!sheet)throw new Error('Division roster unavailable');
 const emails=sheet.getRange('A2:C1000').getValues().filter(row=>row[0]).map(row=>String(row[2]||'').trim().toLowerCase()).filter(email=>/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email));
 if(!emails.length)throw new Error('Division roster is empty; sharing was not changed');
 return new Set(emails);
}
function nestSlidePermissions_(id,editors,viewers){
 const target={};viewers.forEach(email=>target[email]='reader');editors.forEach(email=>target[email]='writer');
 const permissions=Drive.Permissions.list(id,{supportsAllDrives:true}).items||[];
 permissions.forEach(permission=>{
  if(permission.role==='owner')return;
  const email=String(permission.emailAddress||'').toLowerCase(),desired=permission.type==='user'?target[email]:null;
  if(desired===permission.role){delete target[email];return;}
  // Parent folders are reconciled first, so inherited access follows the same
  // division policy. Any remaining inherited permission fails the final audit.
  try{Drive.Permissions.remove(id,permission.id,{supportsAllDrives:true});}
  catch(error){if(!/inherited/i.test(String(error.message)))throw error;}
 });
 Object.keys(target).forEach(email=>Drive.Permissions.insert({type:'user',role:target[email],value:email},id,{sendNotificationEmails:false,supportsAllDrives:true}));
 const final=Drive.Permissions.list(id,{supportsAllDrives:true}).items||[];
 const violations=final.filter(permission=>permission.role!=='owner'&&(permission.type!=='user'||(editors.has(String(permission.emailAddress||'').toLowerCase())?'writer':viewers.has(String(permission.emailAddress||'').toLowerCase())?'reader':null)!==permission.role));
 if(violations.length)throw new Error('Unexpected inherited or broad slide access remains on '+id);
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
 const folder=DriveApp.getFolderById(NEST_SLIDE_FOLDERS[period]);nestSlidePermissions_(folder.getId(),new Set(),roster);
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
 // Remove legacy sharing on the common parent before reconciling children.
 nestSlidePermissions_('1JIjmW9E7Z0im8udvmdTksNdrb7NSjD5k',new Set(),new Set());
 Object.keys(NEST_SLIDE_FOLDERS).forEach(nestSyncDivisionSlideAccess);
 console.log('All division slide access verified.');
}
