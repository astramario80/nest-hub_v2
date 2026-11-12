// One-way membership projection. Never imports Program of Work data into website status.
const ROBOTICS_POW='1Mzxf0q87UHCQ5R6L0IBl2uCO_TmH-TmdcRSDIxOmBgw';
function roboticsSyncStatus_(){
 const raw=PropertiesService.getScriptProperties().getProperty('robotics-membership-sync');
 try{return raw?JSON.parse(raw):{status:'pending'};}catch(_){return {status:'pending'};}
}
function roboticsSyncMembership_(state){
 const store=PropertiesService.getScriptProperties();
 try{
  const names=nestRoboticsNamesFromRows_(state.members.map(m=>[m.active,m.inactive,m.name]));
  if(!state.members.length)throw new Error('Website membership storage is empty');
  const databaseMembers=roboticsSyncDatabase_(state);
  const active=new Set(names.map(nestRoboticsNameKey_)),members=new Map(state.members.map(m=>[nestRoboticsNameKey_(m.name),m]));
  const rows=roboticsValues_(ROBOTICS_POW,"'MembershipForm'!A2:E1000"),seen=new Set(),data=[];
  rows.forEach((row,i)=>{
   if(!row[2])return;const key=nestRoboticsNameKey_(row[2]);
   // Preserve historical duplicate answers; only one matching row may be active.
   const enabled=active.has(key)&&!seen.has(key);seen.add(key);
   if(row[0]!==enabled||row[1]!==!enabled)data.push({range:"'MembershipForm'!A"+(i+2)+':B'+(i+2),values:[[enabled,!enabled]]});
  });
  let next=rows.length+2;
  members.forEach((member,key)=>{if(seen.has(key))return;if(next>1000)throw new Error('Membership mirror is full');
   data.push({range:"'MembershipForm'!A"+next+':C'+next,values:[[active.has(key),!active.has(key),member.name]]});next++;
  });
  const sheet=(Sheets.Spreadsheets.get(ROBOTICS_POW,{fields:'sheets(properties(sheetId,title,gridProperties(rowCount)))'}).sheets||[]).find(s=>s.properties.title==='MembershipForm');
  if(!sheet)throw new Error('Membership mirror sheet is unavailable');
  const needed=next-1-sheet.properties.gridProperties.rowCount;
  if(needed>0)Sheets.Spreadsheets.batchUpdate({requests:[{appendDimension:{sheetId:sheet.properties.sheetId,dimension:'ROWS',length:needed}}]},ROBOTICS_POW);
  roboticsWrite_(ROBOTICS_POW,data);
  roboticsWrite_(ROBOTICS_POW,[{range:"'POW'!F15",values:[[names.join('; ')]]}]);
  const targets=[
   {form:'1WAdJ-qTSwRvqKatt_Fj3xEbl_uTTS9EjqSLr-JYxTeg',item:1844423709,type:FormApp.ItemType.LIST,separator:' '},
   {form:'1iqLYMh__tV86J0k_QhBEWv8r4gvG9ZfuiwZW7ReclRM',item:704486396,type:FormApp.ItemType.CHECKBOX,separator:'_'},
   {form:'1iqLYMh__tV86J0k_QhBEWv8r4gvG9ZfuiwZW7ReclRM',item:30664606,type:FormApp.ItemType.CHECKBOX,separator:'_'}
  ];
  targets.forEach(target=>{
   const item=FormApp.openById(target.form).getItemById(target.item);
   if(!item||item.getType()!==target.type)throw new Error('Membership form field changed');
   const field=target.type===FormApp.ItemType.LIST?item.asListItem():item.asCheckboxItem();
   const previous=field.getChoices().map(c=>c.getValue()),choices=nestRoboticsChoices_(previous,names,target.separator);
   if(!choices.length)throw new Error('Form must retain at least one choice');
   if(JSON.stringify(previous)!==JSON.stringify(choices))field.setChoiceValues(choices);
  });
  // Install only this reconciliation worker; existing signup notification triggers remain separate.
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='roboticsReconcileMembership'))ScriptApp.newTrigger('roboticsReconcileMembership').timeBased().everyHours(1).create();
  const result={status:'synced',active:names.length,database:databaseMembers,at:new Date().toISOString()};store.setProperty('robotics-membership-sync',JSON.stringify(result));return result;
 }catch(error){
  const previous=roboticsSyncStatus_(),result={status:'pending',at:previous.status==='synced'?previous.at:previous.at||null};
  store.setProperty('robotics-membership-sync',JSON.stringify(result));console.error('Robotics membership sync pending: '+String(error.message));return result;
 }
}
function roboticsReconcileMembership(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return;
 try{roboticsSyncMembership_(roboticsState_());}finally{lock.releaseLock();}
}
