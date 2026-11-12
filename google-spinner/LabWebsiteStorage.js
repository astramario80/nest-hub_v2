// The website owns request records. Google remains the identity/staff bridge.
let LAB_WEBSITE_SNAPSHOT;
function labWebsiteMode_(){return PropertiesService.getScriptProperties().getProperty('lab-request-storage-mode')==='website';}
function labUseWebsiteCredential_(r){
 if(typeof r.storageToken!=='string'||!/^[a-f0-9]{64}$/.test(r.storageToken))return;
 const props=PropertiesService.getScriptProperties();if(props.getProperty('lab-website-storage-token')!==r.storageToken)props.setProperty('lab-website-storage-token',r.storageToken);
}
function labWebsiteCall_(payload){
 const token=PropertiesService.getScriptProperties().getProperty('lab-website-storage-token');if(!token)throw Error('Website storage is not configured');
 const response=UrlFetchApp.fetch('https://gknest.org/api/lab-storage',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify(payload),muteHttpExceptions:true,followRedirects:false});
 const result=JSON.parse(response.getContentText());if(response.getResponseCode()!==200||result.status!==200)throw Error('Website archive operation failed');return result;
}
function labWebsiteRecords_(){
 // Never fall back to Google after cutover: a storage failure must not create
 // a second, divergent archive in the retired workbook.
 const result=labWebsiteCall_({operation:'read'});LAB_WEBSITE_SNAPSHOT={version:result.version,records:result.records};
 return JSON.parse(JSON.stringify(result.records)).map((record,index)=>({...record,_row:index+2}));
}
function labWebsiteSave_(records){
 if(!LAB_WEBSITE_SNAPSHOT)labWebsiteRecords_();
 const clean=records.map(record=>{const {_row,...data}=record;return data;});
 const result=labWebsiteCall_({operation:'save',version:LAB_WEBSITE_SNAPSHOT.version,records:clean});
 const merged=new Map(LAB_WEBSITE_SNAPSHOT.records.map(record=>[record.id,record]));clean.forEach(record=>merged.set(record.id,record));
 LAB_WEBSITE_SNAPSHOT={version:result.version,records:JSON.parse(JSON.stringify([...merged.values()]))};
}
function labMigrateWebsite_(session,r){
 if(!labOwner_(session))return labError_(403,'Only the lab administrator can move the archive.');
 labUseWebsiteCredential_(r);
 return labLocked_(()=>{
  if(labWebsiteMode_())return {status:200,migrated:true,count:labWebsiteRecords_().length};
  const records=labRecords_().map(record=>{const {_row,...data}=record;return data;});
  const result=labWebsiteCall_({operation:'migrate',records});
  if(result.count!==records.length)throw Error('Archive count verification failed');
  const verified=labWebsiteCall_({operation:'read'});
  if(JSON.stringify(verified.records)!==JSON.stringify(records))throw Error('Archive content verification failed');
  PropertiesService.getScriptProperties().setProperty('lab-request-storage-mode','website');
  LAB_WEBSITE_SNAPSHOT={version:verified.version,records:verified.records};
  return {status:200,migrated:true,count:records.length};
 });
}
