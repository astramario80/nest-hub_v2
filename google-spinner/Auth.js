// NEST account records live in StudentNESTAccess. Only salted hashes are stored.
const AUTH_SHEET = "'StudentNESTAccess'!A2:K";
const AUTH_DURATIONS = {session:43200000,'1d':86400000,'7d':604800000,'30d':2592000000};
// Run once in the school-owned editor after changing the manifest's Sheets scope.
function authorizeNestAuth() {
  const expected=['Username','District Email','Password Hash','Password Salt','Active','Session Version','Created At','Last Login At'];
  const header=(Sheets.Spreadsheets.Values.get(NEST_DATABASE,"'StudentNESTAccess'!A1:H1").values||[])[0]||[];
  if(expected.some((name,index)=>String(header[index]||'').trim()!==name))throw new Error('StudentNESTAccess headers do not match the NEST authentication schema.');
  if(MailApp.getRemainingDailyQuota()<1)throw new Error('No email quota remains for account verification.');
  console.log('NEST account sheet and verification email quota are ready.');
}
function districtEmail_(value) {
  const email=email_(value);
  return email.length<=254 && /^[^\s@,;<>]+@(students\.bethelsd\.org|bethelsd\.org)$/.test(email)?email:'';
}
function accountEmail_(value) {
  const key=email_(value);
  return districtEmail_(key)||(OWNER_EMAILS.includes(key)?key:'')||(/^manual:[a-z][a-z0-9._-]{2,31}$/.test(key)?key:'');
}
function registrationEmail_(value) {
  const email=accountEmail_(value);
  return districtEmail_(email)||(OWNER_EMAILS.includes(email)?email:'');
}
function username_(value) {
  const name=String(value||'').trim().toLowerCase();
  return /^[a-z][a-z0-9._-]{2,31}$/.test(name)?name:'';
}
function accounts_() {
  const rows=Sheets.Spreadsheets.Values.get(NEST_DATABASE,AUTH_SHEET).values||[];
  return rows.map((row,index)=>({row:index+2,username:username_(row[0]),email:accountEmail_(row[1]),passwordHash:String(row[2]||''),passwordSalt:String(row[3]||''),active:String(row[4]||'').toLowerCase()==='true',version:Number(row[5])||1,periods:String(row[8]||'').split(',').filter(value=>Object.prototype.hasOwnProperty.call(PERIODS,value)),recoveryEmail:districtEmail_(row[9])||(OWNER_EMAILS.includes(email_(row[9]))?email_(row[9]):'')||districtEmail_(row[1])||(OWNER_EMAILS.includes(email_(row[1]))?email_(row[1]):''),linkedEmail:districtEmail_(row[10])})).filter(a=>a.email);
}
function accountByEmail_(email) {return accounts_().find(a=>a.email===email_(email));}
function withAuthLock_(work) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))return {status:503};
  try{return work();}finally{lock.releaseLock();}
}
function lookupAccounts_() {
  const cache=CacheService.getScriptCache(),key='auth-directory-v1';
  const cached=cache.get(key);
  if(cached)return JSON.parse(cached);
  const result=withAuthLock_(()=>{
    const latest=cache.get(key);
    if(latest)return JSON.parse(latest);
    const rows=accounts_();
    const encoded=JSON.stringify(rows);
    if(encoded.length<90000)cache.put(key,encoded,20);
    return rows;
  });
  if(result.status===503)throw new Error('Account directory busy');
  return result;
}
function recognizedForAccount_(email) {
  if(OWNER_EMAILS.includes(email))return true;
  const cache=CacheService.getScriptCache(),key='auth-recognized-v1';
  let cached=cache.get(key);
  if(!cached){
    const result=withAuthLock_(()=>{
      const latest=cache.get(key);
      if(latest)return latest;
      const known=new Set();
      Object.keys(PERIODS).forEach(period=>rows_(period).forEach(row=>known.add(row[1])));
      const leaders=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!F2:F").values||[];
      leaders.forEach(row=>known.add(email_(row[0])));
      const encoded=JSON.stringify([...known]);
      if(encoded.length<90000)cache.put(key,encoded,60);
      return encoded;
    });
    if(result.status===503)throw new Error('Account eligibility busy');
    cached=result;
  }
  return JSON.parse(cached).includes(email)||globalAccess_(email);
}
function authSession_(raw,store,now) {
  if(!/^[a-f0-9]{64}$/.test(raw||''))return null;
  const key='authsession:'+hash_(raw),session=read_(store,key,now);
  if(!session)return null;
  const account=accountByEmail_(session.email);
  if(!account||!account.active||account.version!==session.version){store.deleteProperty(key);return null;}
  return {email:account.email,username:account.username,expires:session.expires};
}
function authDispatch_(r) {
  const store=PropertiesService.getScriptProperties(),now=Date.now();
  if(/^auth-(admin-create|admin-roster|admin-list|admin-edit|admin-remove|admin-reset|profile-read|profile-update|recover-request|recover-verify|recover-reset)$/.test(r.action||''))return accountDispatch_(r,store,now);
  if(Number(store.getProperty('auth-cleanup')||0)<now-3600000){
    const lock=LockService.getScriptLock();
    if(lock.tryLock(100))try{
      if(Number(store.getProperty('auth-cleanup')||0)<now-3600000){
        store.setProperty('auth-cleanup',String(now));
        const all=store.getProperties();
        Object.keys(all).forEach(key=>{
          if(/^auth(session|challenge|ticket|recover|recoveryticket|\-ip|\-email|\-cooldown|\-login\-ip|\-login\-name|\-reserve|\-recover\-ip|\-recover\-email|\-recover\-cooldown):/.test(key)){
            try{if(JSON.parse(all[key]).expires<=now)store.deleteProperty(key);}catch(_){store.deleteProperty(key);}
          }
        });
      }
    }finally{lock.releaseLock();}
  }
  if(r.action==='auth-register-request') {
    const email=registrationEmail_(r.email);
    if(!email||!/^\d{6}$/.test(r.code||'')||! /^[a-f0-9]{64}$/.test(r.challenge||'')||! /^[a-f0-9]{64}$/.test(r.ip||''))return {status:400};
    const limited=withAuthLock_(()=>{
      if(!rate_(store,'auth-ip:'+r.ip,30,3600000,now)||!rate_(store,'auth-email:'+hash_(email),5,3600000,now))return {status:429};
      if(!rate_(store,'auth-cooldown:'+hash_(email),1,60000,now))return {status:429};
      return {status:200};
    });
    if(limited.status!==200)return limited;
    if(lookupAccounts_().some(a=>a.email===email)||!recognizedForAccount_(email))return {status:200};
    if(MailApp.getRemainingDailyQuota()<1)return {status:503};
    const key='authchallenge:'+hash_(r.challenge);
    store.setProperty(key,JSON.stringify({email,digest:hash_(r.challenge+':'+r.code),attempts:0,expires:now+600000}));
    try {MailApp.sendEmail({to:email,name:'gk NEST',subject:'Create your NEST account',body:'Your one-time NEST account verification code is '+r.code+'. It expires in 10 minutes. Enter it only at https://gknest.org. If you did not request an account, ignore this email.',htmlBody:nestEmailHtml_('Create your NEST account','Your account verification code is',r.code)});}
    catch(_){store.deleteProperty(key);return {status:503};}
    return {status:200};
  }
  if(r.action==='auth-register-verify') {
    if(!/^[a-f0-9]{64}$/.test(r.challenge||'')||!/^\d{6}$/.test(r.code||'')||! /^[a-f0-9]{64}$/.test(r.ticket||''))return {status:401};
    const key='authchallenge:'+hash_(r.challenge);
    const verified=withAuthLock_(()=>{
      const challenge=read_(store,key,now);
      if(!challenge||challenge.attempts>=5)return {status:401};
      challenge.attempts++;store.setProperty(key,JSON.stringify(challenge));
      if(challenge.digest!==hash_(r.challenge+':'+r.code))return {status:401};
      store.setProperty('authticket:'+hash_(r.ticket),JSON.stringify({email:challenge.email,expires:now+600000}));
      store.deleteProperty(key);
      return {status:200,email:challenge.email};
    });
    if(verified.status!==200)return verified;
    if(lookupAccounts_().some(a=>a.email===verified.email)){store.deleteProperty('authticket:'+hash_(r.ticket));return {status:409};}
    return verified;
  }
  if(r.action==='auth-register') {
    const name=username_(r.username),ticket=/^[a-f0-9]{64}$/.test(r.ticket||'')?read_(store,'authticket:'+hash_(r.ticket),now):null;
    if(!ticket)return {status:401};
    if(!name||! /^[a-f0-9]{64}$/.test(r.passwordHash||'')||! /^[a-f0-9]{32}$/.test(r.passwordSalt||''))return {status:400};
    const all=accounts_();
    if(all.some(a=>a.username===name||a.email===ticket.email))return {status:409};
    if(!recognizedForAccount_(ticket.email))return {status:403};
    const reserved=withAuthLock_(()=>{
      const nameKey='auth-reserve:'+hash_(name),emailKey='auth-reserve:'+hash_(ticket.email);
      if(read_(store,nameKey,now)||read_(store,emailKey,now))return {status:409};
      const value=JSON.stringify({expires:now+120000});
      store.setProperty(nameKey,value);store.setProperty(emailKey,value);
      return {status:200};
    });
    if(reserved.status!==200)return reserved;
    try {
      // Commit the account before doing optional sheet housekeeping. A failed sort
      // must never turn a successful account write into a setup error.
      Sheets.Spreadsheets.Values.append({values:[[name,ticket.email,r.passwordHash,r.passwordSalt,true,1,new Date(now).toISOString(),'']]},NEST_DATABASE,AUTH_SHEET,{valueInputOption:'RAW',insertDataOption:'INSERT_ROWS'});
      CacheService.getScriptCache().remove('auth-directory-v1');
      try {
        const sheet=(Sheets.Spreadsheets.get(NEST_DATABASE,{fields:'sheets(properties(sheetId,title))'}).sheets||[]).find(s=>s.properties&&s.properties.title==='StudentNESTAccess');
        if(sheet)Sheets.Spreadsheets.batchUpdate({requests:[{sortRange:{range:{sheetId:sheet.properties.sheetId,startRowIndex:1,endRowIndex:all.length+2,startColumnIndex:0,endColumnIndex:10},sortSpecs:[{dimensionIndex:0,sortOrder:'ASCENDING'}]}}]},NEST_DATABASE);
      }catch(error){console.error('NEST account sort failed',String(error&&error.message||error).slice(0,300));}
    } finally {
      store.deleteProperty('auth-reserve:'+hash_(name));
      store.deleteProperty('auth-reserve:'+hash_(ticket.email));
    }
    store.deleteProperty('authticket:'+hash_(r.ticket));
    const duration=AUTH_DURATIONS[r.duration];
    if(duration&&/^[a-f0-9]{64}$/.test(r.session||'')){
      const expires=now+duration;
      store.setProperty('authsession:'+hash_(r.session),JSON.stringify({email:ticket.email,version:1,expires}));
      return {status:200,email:ticket.email,expires};
    }
    return {status:200,email:ticket.email};
  }
  if(r.action==='auth-lookup') {
    const name=username_(r.username);
    if(!name||! /^[a-f0-9]{64}$/.test(r.ip||''))return {status:400};
    const limited=withAuthLock_(()=>{
      if(!rate_(store,'auth-login-ip:'+r.ip,60,3600000,now)||!rate_(store,'auth-login-name:'+hash_(name),15,3600000,now))return {status:429};
      return {status:200};
    });
    if(limited.status!==200)return limited;
    const account=lookupAccounts_().find(a=>a.username===name&&a.active);
    if(!account)return {status:401};
    return {status:200,email:account.email,passwordHash:account.passwordHash,passwordSalt:account.passwordSalt};
  }
  if(r.action==='auth-session') {
    const email=accountEmail_(r.email),duration=AUTH_DURATIONS[r.duration];
    if(!email||!duration||! /^[a-f0-9]{64}$/.test(r.session||''))return {status:400};
    const account=accountByEmail_(email);
    if(!account||!account.active)return {status:401};
    const expires=now+duration;
    store.setProperty('authsession:'+hash_(r.session),JSON.stringify({email,version:account.version,expires}));
    return {status:200,expires};
  }
  if(r.action==='auth-me') {
    const session=authSession_(r.session,store,now);
    return session?{status:200,email:session.email,username:session.username,expires:session.expires}:{status:401};
  }
  if(r.action==='auth-tech-ticket-access') {
    const session=authSession_(r.session,store,now);
    if(!session)return {status:401};
    const leaders=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
    const technician=leaders.some(row=>email_(row[4])===memberEmail_(session.email,String(row[0]||'').replace(/period/ig,'').trim().toUpperCase())&&/^software technician$/i.test(String(row[2]||'').trim()));
    return {status:technician?200:403};
  }
  if(r.action==='auth-logout') {
    if(/^[a-f0-9]{64}$/.test(r.session||''))store.deleteProperty('authsession:'+hash_(r.session));
    return {status:200};
  }
  return {status:400};
}
