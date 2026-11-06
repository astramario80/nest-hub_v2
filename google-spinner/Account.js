// Manual accounts, self-service profiles and email recovery use the existing school-owned account sheet.
function nestAccountMail_(r,message) {
  if(typeof r.accountMailToken!=='string'||!r.accountMailToken)throw new Error('NEST account email is not configured');
  // Use the existing NEST server's transactional stream, independently of announcement subscriptions.
  const response=UrlFetchApp.fetch('https://api.postmarkapp.com/email',{
    method:'post',contentType:'application/json',muteHttpExceptions:true,followRedirects:false,
    headers:{Accept:'application/json','X-Postmark-Server-Token':r.accountMailToken},
    payload:JSON.stringify({From:'NEST Communications <communications@gknest.org>',To:message.to,
      Subject:message.subject,TextBody:message.body,HtmlBody:message.htmlBody,
      MessageStream:'outbound',Tag:r.action==='auth-recover-request'?'nest-account-recovery':'nest-account-verification',TrackOpens:false,TrackLinks:'None'})
  });
  let result;try{result=JSON.parse(response.getContentText());}catch(_){throw new Error('NEST account email delivery uncertain');}
  if(response.getResponseCode()!==200||result.ErrorCode!==0||typeof result.MessageID!=='string'||!result.MessageID)throw new Error('NEST account email was not acknowledged');
}
function nestEmailHtml_(title,introduction,code,usernames) {
  const names=Array.isArray(usernames)&&usernames.length?'<p>NEST usernames linked to this address: <strong>'+usernames.join(', ')+'</strong>.</p>':'';
  const destination=usernames?'https://gknest.org/profile':'https://gknest.org';
  return '<div style="max-width:560px;margin:auto;font-family:Arial,sans-serif;color:#18233b">'+
    '<a href="https://gknest.org" style="display:block;text-decoration:none">'+
    '<img src="https://gknest.org/assets/nest-email-banner.png" width="560" alt="NEST&trade; &mdash; New Economy Skills Training" style="display:block;width:100%;max-width:560px;height:auto;margin:auto;border:0"></a>'+
    '<div style="padding:28px"><h1 style="font-size:24px">'+title+'</h1><p>'+introduction+'</p>'+names+
    '<p style="font-size:36px;letter-spacing:8px;font-weight:bold">'+code+'</p>'+
    '<p>This code expires in 10 minutes. Enter it only at <a href="'+destination+'">'+destination+'</a>.</p>'+
    '<p style="color:#626a79;font-size:13px">If you did not request this email, you can ignore it.</p></div></div>';
}
function authHashFields_(r) {return /^[a-f0-9]{64}$/.test(r.passwordHash||'')&&/^[a-f0-9]{32}$/.test(r.passwordSalt||'');}
function authWrite_(data) {Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data},NEST_DATABASE);CacheService.getScriptCache().remove('auth-directory-v1');}
function databaseEmail_(email) {
  if(!districtEmail_(email))return false;
  if(accounts_().some(account=>account.email===email))return true;
  if(Object.keys(PERIODS).some(period=>rows_(period).some(row=>email_(row[1])===email)))return true;
  return (Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!F2:F").values||[]).some(row=>email_(row[0])===email);
}
// Owner-only account directory. Display metadata never changes authorization.
function accountDirectory_() {
  const names=new Map();
  const records=withAuthLock_(()=>{
    const accounts=accounts_();let notes=[];
    try{notes=Sheets.Spreadsheets.Values.get(NEST_DATABASE,"'StudentNESTAccess'!L2:L").values||[];}catch(_){/* Older account sheets have only the original eleven columns. */}
    return accounts.map(account=>({...account,notes:String(notes[account.row-2]?.[0]||'')}));
  });
  if(records.status===503)throw new Error('Account directory busy');
  Object.keys(PERIODS).forEach(period=>rows_(period).forEach(row=>names.set(email_(row[1]),String(row[0]||'').trim())));
  (nestAccessValues_(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[]).forEach(row=>{const email=districtEmail_(row[4]);if(email&&!names.has(email))names.set(email,String(row[3]||'').trim());});
  const staff=Sheets.Spreadsheets.get(NEST_DATABASE,{ranges:["'Location_Lists_Inventory_OSPI_21stCenturySkills'!T2:T20"],fields:'sheets(data(rowData(values(formattedValue,hyperlink,textFormatRuns,userEnteredValue))))'});
  (staff.sheets||[]).forEach(sheet=>(sheet.data||[]).forEach(grid=>(grid.rowData||[]).forEach(row=>(row.values||[]).forEach(cell=>{
    const links=[cell.hyperlink,...(cell.textFormatRuns||[]).map(run=>run.format&&run.format.link&&run.format.link.uri)];
    const formula=cell.userEnteredValue&&cell.userEnteredValue.formulaValue;
    const match=formula&&formula.match(/^=HYPERLINK\(\s*"(mailto:[^"]+)"/i);if(match)links.push(match[1]);
    links.forEach(link=>{if(typeof link!=='string'||!/^mailto:/i.test(link))return;let email;try{email=email_(decodeURIComponent(link.slice(7).split('?')[0]));}catch(_){return;}const name=String(cell.formattedValue||cell.userEnteredValue?.stringValue||'').trim();if(name&&name!==email&&!names.has(email))names.set(email,name);});
  }))));
  OWNER_EMAILS.forEach(email=>{if(!names.has(email))names.set(email,'Penalver, Mario');});
  return records.filter(account=>account.active).map(account=>{
    const manual=account.email.startsWith('manual:'),email=account.linkedEmail||(!manual?account.email:'');
    const name=names.get(email)||'',comma=name.indexOf(','),parts=name.split(/\s+/);
    const firstName=comma>=0?name.slice(comma+1).trim():name?parts.slice(0,-1).join(' ')||parts[0]:'';
    const lastName=comma>=0?name.slice(0,comma).trim():parts.length>1?parts[parts.length-1]:'';
    const type=email.endsWith('@students.bethelsd.org')?'student':email.endsWith('@bethelsd.org')||OWNER_EMAILS.includes(email)?'staff':manual&&account.periods.length?'student':'unknown';
    return {accountKey:account.email,username:account.username,email,name,firstName,lastName,type,manual,active:account.active,sessionVersion:account.version,createdAt:account.createdAt,passwordHash:account.passwordHash,passwordSalt:account.passwordSalt,notes:account.notes,recoveryEmail:account.recoveryEmail,period:account.periods.join(', ')};
  }).sort((a,b)=>(a.lastName||'\uffff').localeCompare(b.lastName||'\uffff')||a.firstName.localeCompare(b.firstName)||a.username.localeCompare(b.username));
}
// Recovery reads are fresh and request-scoped; they avoid the shared Sheets API read quota.
function authRecoveryReadContext_(work){
 const previous=NEST_ACCESS_READS;NEST_ACCESS_READS=new Map();
 try{const sheet=SpreadsheetApp.openById(NEST_DATABASE).getSheetByName('StudentNESTAccess');if(!sheet)throw Error('Account sheet is unavailable');const count=sheet.getLastRow()-1;if(count>50000)throw Error('Account directory requires review');const width=Math.min(12,sheet.getMaxColumns()),values=count>0?sheet.getRange(2,1,count,width).getValues():[];NEST_ACCESS_READS.set(NEST_DATABASE+':'+AUTH_SHEET,values);return work();}finally{NEST_ACCESS_READS=previous;}
}
function authRecoveryLimit_(store,email,ip,now){
 const overrideKey='auth-recover-override:'+hash_(email),override=read_(store,overrideKey,now);if(override?.remaining===1){store.deleteProperty(overrideKey);return {status:200};}
 const limits=[['auth-recover-cooldown:'+hash_(email),1,60000],['auth-recover-email:'+hash_(email),5,3600000],['auth-recover-ip:'+ip,30,3600000]].map(([key,max,ttl])=>({key,max,value:read_(store,key,now)||{count:0,expires:now+ttl}}));
 const blocked=limits.filter(limit=>limit.value.count>=limit.max);if(blocked.length)return {status:429,retryAfter:Math.max(1,...blocked.map(limit=>Math.ceil((limit.value.expires-now)/1000)))};
 limits.forEach(limit=>{limit.value.count++;store.setProperty(limit.key,JSON.stringify(limit.value));});return {status:200};
}

function accountDispatch_(r,store,now) {
  if(['auth-staff-list','auth-staff-save'].includes(r.action)){
    const session=authSession_(r.session,store,now);
    if(!session||!OWNER_EMAILS.includes(session.email))return {status:403};
    if(r.action==='auth-staff-list'){
      const all=store.getProperties(),registered=accounts_().filter(a=>a.active&&staffIdentity_(a.email));
      const emails=new Set(registered.map(a=>a.email));
      Object.keys(all).filter(k=>k.startsWith('staff-access:')).forEach(k=>{try{const g=JSON.parse(all[k]);if(staffIdentity_(g.email))emails.add(g.email);}catch(_){}});
      return {status:200,staff:[...emails].sort().map(email=>{const account=registered.find(a=>a.email===email);let grant;try{grant=JSON.parse(all['staff-access:'+hash_(email)]||'null');}catch(_){}return {email,username:account?.username||'',registered:!!account,level:grant?.level||'basic',divisions:grant?.divisions||{}};})};
    }
    const email=districtEmail_(r.email),divisions=r.divisions;
    if(!staffIdentity_(email)||!['basic','division','admin'].includes(r.level)||!divisions||typeof divisions!=='object'||Array.isArray(divisions)||Object.keys(divisions).some(p=>!Object.prototype.hasOwnProperty.call(PERIODS,p)||!['viewer','manager'].includes(divisions[p]))||r.level!=='division'&&Object.keys(divisions).length||r.level==='division'&&!Object.keys(divisions).length)return {status:400};
    const saved=withAuthLock_(()=>{
      const account=accounts_().find(a=>a.email===email);
      // Version change also invalidates cached identities on the next protected read.
      if(account)authWrite_([{range:"'StudentNESTAccess'!F"+account.row,values:[[account.version+1]]}]);
      if(r.level==='basic')store.deleteProperty('staff-access:'+hash_(email));
      else store.setProperty('staff-access:'+hash_(email),JSON.stringify({email,level:r.level,divisions,issuer:session.email,updatedAt:new Date(now).toISOString()}));
      return {status:200};
    });
    return saved.status===200?{status:200,slidesQueued:staffQueueSlideAccess_(r)}:saved;
  }

  if(/^auth-admin-(roster|list|directory|notes|registration-unlock|edit|remove)$/.test(r.action||'')) {
    const session=authSession_(r.session,store,now);
    if(!session||!OWNER_EMAILS.includes(session.email))return {status:403};
    if(r.action==='auth-admin-roster') {
      if(!Object.prototype.hasOwnProperty.call(PERIODS,r.period))return {status:400};
      return {status:200,students:rows_(r.period).filter(row=>districtEmail_(row[1])).map(row=>({name:row[0],email:row[1]}))};
    }
    if(r.action==='auth-admin-registration-unlock') {
      const email=registrationEmail_(r.email);
      if(!email)return {status:400};
      if(!recognizedForAccount_(email))return {status:404};
      return withAuthLock_(()=>{
        if(accounts_().some(account=>account.email===email))return {status:409};
        store.deleteProperty('auth-email:'+hash_(email));store.deleteProperty('auth-cooldown:'+hash_(email));
        const all=store.getProperties();let challengesReset=0;
        Object.keys(all).filter(key=>key.startsWith('authchallenge:')).forEach(key=>{
          let challenge;try{challenge=JSON.parse(all[key]);}catch(_){return;}
          if(challenge.email!==email||challenge.expires<=now)return;
          challenge.attempts=0;store.setProperty(key,JSON.stringify(challenge));challengesReset++;
        });
        const expires=now+600000;
        store.setProperty('auth-register-override:'+hash_(email),JSON.stringify({expires,by:session.email,createdAt:now}));
        return {status:200,expires,challengesReset};
      });
    }
    if(r.action==='auth-admin-directory')return {status:200,accounts:accountDirectory_()};
    if(r.action==='auth-admin-notes') {
      const key=accountEmail_(r.accountKey);
      if(!key||typeof r.notes!=='string'||r.notes.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(r.notes))return {status:400};
      return withAuthLock_(()=>{
        const account=accounts_().find(item=>item.email===key&&item.active);
        if(!account)return {status:404};
        const sheet=(Sheets.Spreadsheets.get(NEST_DATABASE,{fields:'sheets(properties(sheetId,title,gridProperties(columnCount)))'}).sheets||[]).find(item=>item.properties?.title==='StudentNESTAccess');
        if(!sheet)return {status:503};
        const columns=sheet.properties.gridProperties?.columnCount||0;
        if(columns<12)Sheets.Spreadsheets.batchUpdate({requests:[{appendDimension:{sheetId:sheet.properties.sheetId,dimension:'COLUMNS',length:12-columns}}]},NEST_DATABASE);
        const header=(Sheets.Spreadsheets.Values.get(NEST_DATABASE,"'StudentNESTAccess'!L1").values||[])[0]?.[0];
        if(header&&header!=='Administrator Notes')return {status:503};
        authWrite_([{range:"'StudentNESTAccess'!L1",values:[['Administrator Notes']]},{range:"'StudentNESTAccess'!L"+account.row,values:[[r.notes]]}]);
        return {status:200};
      });
    }
    if(r.action==='auth-admin-list') {
      const records=accounts_().filter(account=>account.active&&account.email.startsWith('manual:'));
      const roster={};
      records.forEach(account=>account.periods.forEach(period=>{if(!roster[period])roster[period]=rows_(period);}));
      return {status:200,accounts:records.map(account=>({username:account.username,period:account.periods.length===1?account.periods[0]:'',studentEmail:account.linkedEmail||'',studentName:(roster[account.periods[0]]||[]).find(row=>row[1]===account.linkedEmail)?.[0]||'',recoveryEmail:account.recoveryEmail||''}))};
    }
    const current=username_(r.currentUsername);
    if(!current)return {status:400};
    return withAuthLock_(()=>{
      const all=accounts_(),account=all.find(item=>item.username===current&&item.email.startsWith('manual:')&&item.active);
      if(!account)return {status:404};
      const prefix="'StudentNESTAccess'!";
      if(r.action==='auth-admin-remove') {
        authWrite_([{range:prefix+'E'+account.row,values:[[false]]},{range:prefix+'F'+account.row,values:[[account.version+1]]}]);
        return {status:200};
      }
      const name=username_(r.username);
      if(!name||((r.passwordHash||r.passwordSalt)&&!authHashFields_(r))||(name===account.username&&!r.passwordHash))return {status:400};
      if(all.some(item=>item.username===name&&item.email!==account.email))return {status:409};
      const data=[{range:prefix+'A'+account.row,values:[[name]]},{range:prefix+'F'+account.row,values:[[account.version+1]]}];
      if(r.passwordHash)data.push({range:prefix+'C'+account.row+':D'+account.row,values:[[r.passwordHash,r.passwordSalt]]});
      authWrite_(data);
      return {status:200};
    });
  }
  if(r.action==='auth-admin-create') {
    const session=authSession_(r.session,store,now),name=username_(r.username),key='manual:'+name,recoveryEmail=districtEmail_(r.recoveryEmail);
    const period=String(r.period||''),studentEmail=districtEmail_(r.studentEmail);
    if(!session||!OWNER_EMAILS.includes(session.email))return {status:403};
    if(!name||!authHashFields_(r)||!Object.prototype.hasOwnProperty.call(PERIODS,period)||!studentEmail||(r.recoveryEmail&&(!recoveryEmail||!databaseEmail_(recoveryEmail))))return {status:400};
    return withAuthLock_(()=>{
      const all=accounts_();
      if(all.some(account=>account.username===name||account.email===key))return {status:409};
      if(all.some(account=>account.active&&account.linkedEmail===studentEmail))return {status:409};
      if(rows_(period).filter(row=>row[1]===studentEmail).length!==1)return {status:400};
      const header=(Sheets.Spreadsheets.Values.get(NEST_DATABASE,"'StudentNESTAccess'!I1:K1").values||[])[0]||[];
      if((header[0]&&header[0]!=='Allowed Periods')||(header[1]&&header[1]!=='Recovery Email')||(header[2]&&header[2]!=='Linked Student Email'))return {status:503};
      Sheets.Spreadsheets.Values.update({values:[['Allowed Periods','Recovery Email','Linked Student Email']]},NEST_DATABASE,"'StudentNESTAccess'!I1:K1",{valueInputOption:'RAW'});
      Sheets.Spreadsheets.Values.append({values:[[name,key,r.passwordHash,r.passwordSalt,true,1,new Date(now).toISOString(),'',period,recoveryEmail,studentEmail]]},NEST_DATABASE,AUTH_SHEET,{valueInputOption:'RAW',insertDataOption:'INSERT_ROWS'});
      CacheService.getScriptCache().remove('auth-directory-v1');
      return {status:200};
    });
  }
  if(r.action==='auth-admin-reset') {
    const session=authSession_(r.session,store,now),name=username_(r.username);
    if(!session||!OWNER_EMAILS.includes(session.email))return {status:403};
    if(!name||!authHashFields_(r))return {status:400};
    return withAuthLock_(()=>{
      const account=accounts_().find(item=>item.username===name&&item.active);
      if(!account)return {status:404};
      const prefix="'StudentNESTAccess'!";
      authWrite_([{range:prefix+'C'+account.row+':D'+account.row,values:[[r.passwordHash,r.passwordSalt]]},{range:prefix+'F'+account.row,values:[[account.version+1]]}]);
      return {status:200};
    });
  }
  if(r.action==='auth-profile-update') {
    const session=authSession_(r.session,store,now),name=username_(r.username);
    if(!session||!name||((r.passwordHash||r.passwordSalt)&&!authHashFields_(r)))return {status:session?400:401};
    return withAuthLock_(()=>{
      const all=accounts_(),account=all.find(item=>item.email===session.email&&item.active);
      if(!account)return {status:401};
      if(all.some(item=>item.username===name&&item.email!==account.email))return {status:409};
      if(name===account.username&&!r.passwordHash)return {status:400};
      const prefix="'StudentNESTAccess'!",data=[{range:prefix+'A'+account.row,values:[[name]]},{range:prefix+'F'+account.row,values:[[account.version+1]]}];
      if(r.passwordHash)data.push({range:prefix+'C'+account.row+':D'+account.row,values:[[r.passwordHash,r.passwordSalt]]});
      authWrite_(data);
      return {status:200};
    });
  }
  if(r.action==='auth-profile-read') {
    const session=authSession_(r.session,store,now);
    if(!session)return {status:401};
    const account=accountByEmail_(session.email);
    return account?{status:200,username:account.username,recoveryEmail:account.recoveryEmail,manual:account.email.startsWith('manual:')}:{status:401};
  }
  if(r.action==='auth-recover-request') {
    const email=accountEmail_(r.email);
    if(!email||email.startsWith('manual:')||!/^\d{6}$/.test(r.code||'')||! /^[a-f0-9]{64}$/.test(r.challenge||'')||! /^[a-f0-9]{64}$/.test(r.ip||''))return {status:400};
    const accounts=accounts_().filter(account=>account.active&&account.recoveryEmail===email);
    const key='authrecover:'+hash_(r.challenge),digest=hash_(r.challenge+':'+r.code);
    const limited=withAuthLock_(()=>{
      const prior=read_(store,key,now);
      if(prior)return {status:prior.email===email&&prior.digest===digest?(prior.delivery==='sent'?200:503):400,replayed:true};
      return authRecoveryLimit_(store,email,r.ip,now);
    });
    if(limited.status!==200||limited.replayed)return {status:limited.status,...(limited.retryAfter?{retryAfter:limited.retryAfter}:{})};
    if(!accounts.length){store.setProperty(key,JSON.stringify({email,digest,keys:[],attempts:0,expires:now+600000,delivery:'sent'}));return {status:200};}
    const usernames=accounts.map(account=>account.username);
    const record={email,keys:accounts.map(account=>account.email),digest,attempts:0,expires:now+600000,delivery:'sending'};
    store.setProperty(key,JSON.stringify(record));
    try {nestAccountMail_(r,{to:email,subject:'Recover your NEST account',body:'NEST usernames linked to this address: '+usernames.join(', ')+'. Your recovery code is '+r.code+'. It expires in 10 minutes. Enter it only at https://gknest.org/profile. If you did not request this, ignore this email.',htmlBody:nestEmailHtml_('Recover your NEST account','Your recovery code is',r.code,usernames)});}
    catch(_){record.delivery='uncertain';store.setProperty(key,JSON.stringify(record));return {status:503};}
    record.delivery='sent';store.setProperty(key,JSON.stringify(record));
    return {status:200};
  }
  if(r.action==='auth-recover-verify') {
    if(! /^[a-f0-9]{64}$/.test(r.challenge||'')||!/^\d{6}$/.test(r.code||'')||! /^[a-f0-9]{64}$/.test(r.ticket||''))return {status:401};
    return withAuthLock_(()=>{
      const key='authrecover:'+hash_(r.challenge),ticketKey='authrecoveryticket:'+hash_(r.ticket);
      const previous=read_(store,ticketKey,now);
      if(previous&&previous.challenge===key&&previous.digest===hash_(r.challenge+':'+r.code)){
        const current=accounts_().filter(account=>account.active&&previous.keys.includes(account.email)&&account.recoveryEmail===previous.email);
        return current.length?{status:200,usernames:current.map(account=>account.username)}:{status:401};
      }
      const challenge=read_(store,key,now);
      if(!challenge||challenge.attempts>=5)return {status:401};
      challenge.attempts++;store.setProperty(key,JSON.stringify(challenge));
      if(challenge.digest!==hash_(r.challenge+':'+r.code))return {status:401};
      const accounts=accounts_().filter(account=>account.active&&challenge.keys.includes(account.email)&&account.recoveryEmail===challenge.email);
      if(!accounts.length)return {status:401};
      store.setProperty(ticketKey,JSON.stringify({keys:accounts.map(account=>account.email),email:challenge.email,challenge:key,digest:challenge.digest,expires:now+600000}));
      store.deleteProperty(key);
      return {status:200,usernames:accounts.map(account=>account.username)};
    });
  }
  if(r.action==='auth-recover-reset') {
    const name=username_(r.username);
    if(! /^[a-f0-9]{64}$/.test(r.ticket||'')||!name||!authHashFields_(r))return {status:400};
    return withAuthLock_(()=>{
      const key='authrecoveryticket:'+hash_(r.ticket),ticket=read_(store,key,now);
      if(!ticket)return {status:401};
      const account=accounts_().find(item=>item.username===name&&ticket.keys.includes(item.email));
      if(!account||!account.active)return {status:401};
      const prefix="'StudentNESTAccess'!";
      authWrite_([{range:prefix+'C'+account.row+':D'+account.row,values:[[r.passwordHash,r.passwordSalt]]},{range:prefix+'F'+account.row,values:[[account.version+1]]}]);
      store.deleteProperty(key);
      return {status:200,username:account.username};
    });
  }
  return {status:400};
}
