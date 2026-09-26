// Manual accounts, self-service profiles and email recovery use the existing school-owned account sheet.
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
function accountDispatch_(r,store,now) {
  if(/^auth-admin-(roster|list|edit|remove)$/.test(r.action||'')) {
    const session=authSession_(r.session,store,now);
    if(!session||!OWNER_EMAILS.includes(session.email))return {status:403};
    if(r.action==='auth-admin-roster') {
      if(!Object.prototype.hasOwnProperty.call(PERIODS,r.period))return {status:400};
      return {status:200,students:rows_(r.period).filter(row=>districtEmail_(row[1])).map(row=>({name:row[0],email:row[1]}))};
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
    const limited=withAuthLock_(()=>{
      if(!rate_(store,'auth-recover-ip:'+r.ip,30,3600000,now)||!rate_(store,'auth-recover-email:'+hash_(email),5,3600000,now)||!rate_(store,'auth-recover-cooldown:'+hash_(email),1,60000,now))return {status:429};
      return {status:200};
    });
    if(limited.status!==200)return limited;
    const accounts=accounts_().filter(account=>account.active&&account.recoveryEmail===email);
    if(!accounts.length)return {status:200};
    if(MailApp.getRemainingDailyQuota()<1)return {status:503};
    const key='authrecover:'+hash_(r.challenge);
    const usernames=accounts.map(account=>account.username);
    store.setProperty(key,JSON.stringify({email,keys:accounts.map(account=>account.email),digest:hash_(r.challenge+':'+r.code),attempts:0,expires:now+600000}));
    try {MailApp.sendEmail({to:email,name:'gk NEST',subject:'Recover your NEST account',body:'NEST usernames linked to this address: '+usernames.join(', ')+'. Your recovery code is '+r.code+'. It expires in 10 minutes. Enter it only at https://gknest.org/profile. If you did not request this, ignore this email.',htmlBody:nestEmailHtml_('Recover your NEST account','Your recovery code is',r.code,usernames)});}
    catch(_){store.deleteProperty(key);return {status:503};}
    return {status:200};
  }
  if(r.action==='auth-recover-verify') {
    if(! /^[a-f0-9]{64}$/.test(r.challenge||'')||!/^\d{6}$/.test(r.code||'')||! /^[a-f0-9]{64}$/.test(r.ticket||''))return {status:401};
    return withAuthLock_(()=>{
      const key='authrecover:'+hash_(r.challenge),challenge=read_(store,key,now);
      if(!challenge||challenge.attempts>=5)return {status:401};
      challenge.attempts++;store.setProperty(key,JSON.stringify(challenge));
      if(challenge.digest!==hash_(r.challenge+':'+r.code))return {status:401};
      const accounts=accounts_().filter(account=>account.active&&challenge.keys.includes(account.email)&&account.recoveryEmail===challenge.email);
      if(!accounts.length)return {status:401};
      store.setProperty('authrecoveryticket:'+hash_(r.ticket),JSON.stringify({keys:accounts.map(account=>account.email),expires:now+600000}));
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
