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
function diagnosticRecoveryHealth_(){
 const store=PropertiesService.getScriptProperties(),now=Date.now(),all=store.getProperties?.()||{},mail={sent:0,uncertain:0,unknownAddress:0},limited={network:0,email:0,cooldown:0};let fault=null;
 try{const value=JSON.parse(store.getProperty('nest-service-fault:auth-recover-request')||'null');if(value&&['school-quota','school-permission','school-reference','school-timeout','school-service'].includes(value.code)&&Number.isFinite(Date.parse(value.time)))fault={code:value.code,time:value.time};}catch(_){}
 Object.keys(all).forEach(key=>{try{const value=JSON.parse(all[key]);if(key.startsWith('authrecover:')&&value.expires>now-86400000){if(!value.keys?.length)mail.unknownAddress++;else if(value.delivery==='sent')mail.sent++;else if(['sending','uncertain'].includes(value.delivery))mail.uncertain++;}if(value.expires>now){if(key.startsWith('auth-recover-ip:')&&value.count>=30)limited.network++;if(key.startsWith('auth-recover-email:')&&value.count>=5)limited.email++;if(key.startsWith('auth-recover-cooldown:')&&value.count>=1)limited.cooldown++;}}catch(_){}});return {fault,mail,limited,remainingGoogleMailRecipients:typeof MailApp!=='undefined'?MailApp.getRemainingDailyQuota():null};
}
function diagnosticDispatch_(r){
 try{
  if(r.action==='auth-diagnostics-read'){
   const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());if(!session)return {status:401};if(!OWNER_EMAILS.includes(email_(session.email)))return {status:403};
   if(r.signupEmail)return diagnosticSignupHelp_(r,session);
   const id=PropertiesService.getScriptProperties().getProperty('diagnostic-sheet');if(!id)return {status:200,events:[],recoveryHealth:diagnosticRecoveryHealth_()};
   const rows=Sheets.Spreadsheets.Values.get(id,"'Events'!A2:K"+(DIAGNOSTIC_CAPACITY+1)).values||[];
   return {status:200,recoveryHealth:diagnosticRecoveryHealth_(),events:rows.filter(row=>row[0]).map(row=>({id:row[0],requestId:row[1],time:row[2],area:row[3],operation:row[4],phase:row[5],status:Number(row[6]),durationMs:Number(row[7]),actor:row[8],identity:row[9],code:row[10]})).sort((a,b)=>b.time.localeCompare(a.time))};
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

function diagnosticSignupHelp_(r,session){
 const lookup=String(r.signupEmail||'').trim().toLowerCase(),isStudent=email=>/^[^\s@,;<>]+@students\.bethelsd\.org$/.test(String(email||''));
 if(lookup.length>254||!isStudent(lookup)&&!username_(lookup))return {status:400,error:'Enter a student email or NEST username.'};
 const store=PropertiesService.getScriptProperties(),now=Date.now(),directory=authRecoveryReadContext_(()=>accounts_());
 const student=a=>isStudent(a.email)||isStudent(a.linkedEmail)||a.email.startsWith('manual:')&&(a.periods.length>0||isStudent(a.recoveryEmail));
 const matches=directory.filter(a=>student(a)&&(isStudent(lookup)?[a.email,a.linkedEmail,a.recoveryEmail].includes(lookup):a.username===lookup));
 if(!isStudent(lookup)&&!matches.length)return {status:404,error:'No student account matches that username.'};
 const email=isStudent(lookup)?lookup:matches.flatMap(a=>[a.email,a.linkedEmail,a.recoveryEmail]).find(isStudent)||'',emailHash=email?hash_(email):'',expires=now+600000;
 let challengesReset=0;
 if(r.signupUnblock===true){const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:503};try{
  const override=JSON.stringify({remaining:1,expires,by:session.email,createdAt:now});
  if(email){for(const key of ['auth-email:','auth-cooldown:','auth-recover-email:','auth-recover-cooldown:','robotics-signup:rate:email:','robotics-signup:rate:cooldown:'])store.deleteProperty(key+emailHash);store.setProperty('auth-register-override:'+emailHash,override);store.setProperty('auth-recover-override:'+emailHash,override);store.setProperty('robotics-signup:retry-grant:'+emailHash,override);}
  for(const account of matches){store.deleteProperty('auth-login-name:'+hash_(account.username));store.setProperty('auth-login-override:'+hash_(account.username),override);}
  for(const [key,raw]of Object.entries(store.getProperties())){if(!['authchallenge:','authrecover:','robotics-signup:challenge:'].some(prefix=>key.startsWith(prefix)))continue;try{const value=JSON.parse(raw);if(value.email===email&&value.expires>now){value.attempts=0;store.setProperty(key,JSON.stringify(value));challengesReset++;}}catch(_){}}
  store.setProperty('auth-access-unblock:'+hash_(lookup),JSON.stringify({expires,by:session.email,at:new Date(now).toISOString()}));
 }finally{lock.releaseLock();}}
 const rates=[],add=(kind,key,max)=>{const value=read_(store,key,now);rates.push({kind,count:value?.count||0,max,retryAfter:value?Math.max(0,Math.ceil((value.expires-now)/1000)):0,blocked:!!value&&value.count>=max});};
 if(email){add('NEST account signup','auth-email:'+emailHash,5);add('Account recovery','auth-recover-email:'+emailHash,5);add('Robotics application','robotics-signup:rate:email:'+emailHash,3);}
 matches.forEach(a=>add('Sign-in: '+a.username,'auth-login-name:'+hash_(a.username),15));
 const challenges=[];for(const [key,raw]of Object.entries(store.getProperties())){const flow=key.startsWith('authchallenge:')?'NEST account signup':key.startsWith('authrecover:')?'Account recovery':key.startsWith('robotics-signup:challenge:')?'Robotics application':'';if(!flow)continue;try{const value=JSON.parse(raw);if(email&&value.email===email)challenges.push({flow,attempts:value.attempts||0,expired:value.expires<=now,expiresAt:new Date(value.expires).toISOString()});}catch(_){}}
 const grant=read_(store,'auth-access-unblock:'+hash_(lookup),now);
 return {status:200,signupHealth:{lookup,email,accounts:matches.map(a=>({username:a.username,active:a.active})),rates,challenges,challengesReset,retryGranted:!!grant,retryExpiresAt:grant?new Date(grant.expires).toISOString():null}};
}
