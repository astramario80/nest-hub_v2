// Private, bounded operational metadata. Never stores request bodies, messages, cookies or tokens.
const DIAGNOSTIC_CAPACITY=5000;
function diagnosticStore_(){
 const props=PropertiesService.getScriptProperties(),existing=props.getProperty('diagnostic-sheet');if(existing)return existing;
 const sheet=Sheets.Spreadsheets.create({properties:{title:'NEST™ Private Access Diagnostics'},sheets:[{properties:{title:'Events',gridProperties:{rowCount:DIAGNOSTIC_CAPACITY+1,columnCount:11}}}]}),id=sheet.spreadsheetId;
 const permissions=Drive.Permissions.list(id,{fields:'permissions(id,role,type)'}).permissions||[];
 permissions.filter(p=>p.role!=='owner').forEach(p=>Drive.Permissions.remove(id,p.id));
 Sheets.Spreadsheets.Values.update({values:[['Event ID','Request ID','Time','Area','Operation','Phase','Status','Wait ms','Account','Identity source','Code']]},id,"'Events'!A1:K1",{valueInputOption:'RAW'});
 props.setProperty('diagnostic-sheet',id);return id;
}
function diagnosticClean_(e){
 if(!e||!['auth','service','hiring','tracker','signals','division','leadership','fabrication','lunch','profile'].includes(e.area)||!['browser','server'].includes(e.phase)||!/^[a-z][a-z0-9-]{0,39}$/.test(e.operation||'')||!Number.isInteger(e.status)||e.status<0||e.status>599||!Number.isFinite(e.durationMs)||e.durationMs<0||e.durationMs>180000||!/^[a-f0-9-]{36}$/.test(e.id||'')||!/^[a-f0-9-]{36}$/.test(e.requestId||'')||!['attempted','verified','anonymous'].includes(e.identity)||!/^[a-z][a-z0-9._-]{0,31}$/.test(e.actor||'')||!Number.isFinite(Date.parse(e.time)))return null;
 return [e.id,e.requestId,new Date(e.time).toISOString(),e.area,e.operation,e.phase,e.status,Math.round(e.durationMs),e.actor,e.identity,e.status===0?'network':e.status>=400?'http-'+e.status:'ok'];
}
function diagnosticDispatch_(r){
 try{
  if(r.action==='auth-diagnostics-read'){
   const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());if(!session)return {status:401};if(!OWNER_EMAILS.includes(email_(session.email)))return {status:403};
   const id=PropertiesService.getScriptProperties().getProperty('diagnostic-sheet');if(!id)return {status:200,events:[]};
   const rows=Sheets.Spreadsheets.Values.get(id,"'Events'!A2:K"+(DIAGNOSTIC_CAPACITY+1)).values||[];
   return {status:200,events:rows.filter(row=>row[0]).map(row=>({id:row[0],requestId:row[1],time:row[2],area:row[3],operation:row[4],phase:row[5],status:Number(row[6]),durationMs:Number(row[7]),actor:row[8],identity:row[9],code:row[10]})).sort((a,b)=>b.time.localeCompare(a.time))};
  }
  if(r.action!=='diagnostics-record'||!Array.isArray(r.entries)||!r.entries.length||r.entries.length>20)return {status:400};
  const store=PropertiesService.getScriptProperties(),sessions=new Map();
  const resolve=token=>{if(!sessions.has(token))sessions.set(token,authSession_(token,store,Date.now()));return sessions.get(token);};
  const reported=r.session?resolve(r.session):null;if(r.session&&!reported)return {status:401};
  const rows=r.entries.map(e=>{const session=reported||(e._session?resolve(e._session):null);return diagnosticClean_(session?{...e,actor:session.username,identity:'verified'}:e);});if(rows.some(row=>!row))return {status:400};
  // Reserve the initialization and ring positions under short locks; Google I/O stays outside them.
  const props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();let initialize=false;
  if(!lock.tryLock(100))return {status:503};
  try{if(!props.getProperty('diagnostic-sheet')){if(Number(props.getProperty('diagnostic-initializing')||0)>Date.now()-60000)return {status:503};props.setProperty('diagnostic-initializing',String(Date.now()));initialize=true;}}finally{lock.releaseLock();}
  if(initialize){try{diagnosticStore_();}finally{props.setProperty('diagnostic-initializing','0');}}
  if(!lock.tryLock(100))return {status:503};let id,counter;
  try{id=props.getProperty('diagnostic-sheet');if(!id)return {status:503};counter=Number(props.getProperty('diagnostic-counter')||0);props.setProperty('diagnostic-counter',String(counter+rows.length));}finally{lock.releaseLock();}
  const data=rows.map(row=>({range:"'Events'!A"+(counter++%DIAGNOSTIC_CAPACITY+2)+':K'+((counter-1)%DIAGNOSTIC_CAPACITY+2),values:[row]}));
  Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data},id);return {status:200};
 }catch(_){return {status:503};}
}
