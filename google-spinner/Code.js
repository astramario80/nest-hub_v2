// Server-only roster service. No public route accepts spreadsheet IDs.
const PERIODS = {
  '1': '1QDEskd_kKvtjUoLuWnKicsNqhy6ElubA70vaX7OmQzc',
  '2': '1bizUxDzZbJyEnu4sCU3Z33U_SdT_Iz3Ln-LeO7hc21Y',
  '3': '1Ycdle_67UhmlyUd0brcbKrYCP2pYjPeiNzsyikxlK70',
  '4': '1dQUtAsQtmx_srX9JqOaQ6KevW_Id2S0Ywvn33vPbgxE',
  '5': '1ShuqoqtcNNY-o4suHdxn0lbI1aoJ-nTqzq3-VIt3_ik',
  '7': '1yqniHZOhh8ct7_RF1WB8b8Wv_r2OmGIz029h6yexGRA',
  'CTSO': '1EahcN40fqGdlHCwZi_kZ-PzxuvRx1oAZWwxEHDbdmDU'
};
const BRIDGE_DIGEST = 'fa73c87e353c83d23f5a447adf018eda6be9a8096a6d84e03318eb8833f984cf';
function hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>('0'+(b&255).toString(16)).slice(-2)).join(''); }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return json_({status:401}); }
function doPost(e) {
  let r;
  try { r=JSON.parse(e.postData.contents); } catch (_) { return json_({status:400}); }
  if(typeof r.token!=='string' || hash_(r.token)!==BRIDGE_DIGEST) return json_({status:401});
  if(r.action==='leadership') return json_({status:401});
  if(r.action==='auth-leadership-directory') {
    try {
      const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
      return json_(session?memberLeadershipDirectory_():{status:401});
    } catch(_){return json_({status:503});}
  }
  if(r.action==='auth-weather') {
    try {
      const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
      return json_(session?weatherForMember_(session.email,r.period,r.page):{status:401});
    } catch(error){console.error('Weather view failed',String(error&&error.message||error).slice(0,200));return json_({status:503});}
  }
  if(r.action==='auth-hiring-access') {
    try {
      const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
      if(!session)return json_({status:401});
      if(!Object.prototype.hasOwnProperty.call(PERIODS,r.period))return json_({status:400});
      return json_({status:hiringPermissions_(session.email,r.period).canReview?200:403});
    } catch(error){console.error('Hiring access failed',String(error&&error.message||error).slice(0,200));return json_({status:503});}
  }
  if(r.action==='auth-hiring-view') {
    try {
      const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
      return json_(session?hiringView_(session.email,r.period,r.page):{status:401});
    } catch(error){console.error('Hiring view failed',String(error&&error.message||error).slice(0,200));return json_({status:503});}
  }
  if(r.action==='auth-hiring-assign') {
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(15000))return json_({status:503});
    try {
      const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
      return json_(session?hiringAssign_(session.email,r):{status:401});
    } catch(error){console.error('Hiring assignment failed',String(error&&error.message||error).slice(0,200));return json_({status:503});}
    finally{lock.releaseLock();}
  }
  if(!/^auth-/.test(r.action||'') && !Object.prototype.hasOwnProperty.call(PERIODS,r.period)) return json_({status:400});
  // Account reads and independent session writes must not queue behind tracker edits.
  // Auth.js takes short locks only where a shared counter or registration is changed.
  if(/^auth-/.test(r.action||'')) {
    try { return json_(authDispatch_(r)); }
    catch(error) {
      console.error('NEST bridge dispatch failed',r.action,String(error&&error.message||error).slice(0,300));
      return json_({status:503});
    }
  }
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000)) return json_({status:503});
  try { return json_(dispatch_(r)); }
  catch (error) {
    console.error('NEST bridge dispatch failed',r.action,String(error&&error.message||error).slice(0,300));
    return json_({status:503});
  }
  finally { lock.releaseLock(); }
}
const NEST_DATABASE = '12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE';
const OWNER_EMAILS = ['astramario@gmail.com','mpenalver@bethelsd.org','mario@memberhq.net'];
function email_(value) { return String(value||'').trim().toLowerCase(); }
function rows_(period) {
  const rows=Sheets.Spreadsheets.Values.get(NEST_DATABASE,"'"+(period==='CTSO'?'CTSO':'Period '+period)+"'!A2:C1000").values||[];
  return rows.filter(row=>row[0] && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email_(row[2]))).map(row=>[String(row[0]).trim(),email_(row[2])]);
}
function globalAccess_(email) {
  email=email_(email);if(OWNER_EMAILS.includes(email))return true;
  const result=Sheets.Spreadsheets.get(NEST_DATABASE,{ranges:["'Location_Lists_Inventory_OSPI_21stCenturySkills'!T2:T20"],fields:'sheets(data(rowData(values(hyperlink,textFormatRuns,userEnteredValue))))'});
  return (result.sheets||[]).some(sheet=>(sheet.data||[]).some(grid=>(grid.rowData||[]).some(row=>(row.values||[]).some(cell=>{
    const links=[cell.hyperlink,...(cell.textFormatRuns||[]).map(run=>run.format&&run.format.link&&run.format.link.uri)];
    const formula=cell.userEnteredValue&&cell.userEnteredValue.formulaValue;
    if(formula){const m=formula.match(/^=HYPERLINK\(\s*"(mailto:[^"]+)"/i);if(m)links.push(m[1]);}
    return links.some(link=>typeof link==='string' && /^mailto:/i.test(link) && email_(decodeURIComponent(link.slice(7).split('?')[0]))===email);
  }))));
}
function authorized_(rows,email,period) { return rows.some(row=>email_(row[1])===email_(email)) || globalAccess_(email) || (period && (manager_(email,period) || Boolean(editorGrant_(email,period)))); }
function read_(store,key,now) {
  const raw=store.getProperty(key); if(!raw) return null;
  const value=JSON.parse(raw); if(value.expires<=now) {store.deleteProperty(key);return null;} return value;
}
function rate_(store,key,max,ttl,now) {
  const value=read_(store,key,now)||{count:0,expires:now+ttl};
  if(value.count>=max) return false;
  value.count++;store.setProperty(key,JSON.stringify(value));return true;
}
function dispatch_(r) {
  const store=PropertiesService.getScriptProperties(),now=Date.now();
  // Bound retained state; expired records are swept on use once per hour.
  if(Number(store.getProperty('cleanup')||0)<now-3600000) {
    const all=store.getProperties();
    Object.keys(all).forEach(key=>{if(/^(challenge:|session:|grant:|email:|cooldown:|ip:|global$)/.test(key) && JSON.parse(all[key]).expires<=now) store.deleteProperty(key);});
    store.setProperty('cleanup',String(now));
  }
  if(r.action==='health') {
    try {rows_(r.period);return {status:200,sheets:true,emailQuota:MailApp.getRemainingDailyQuota()};}
    catch(error) {return {status:503,diagnostic:String(error.message).slice(0,500)};}
  }
  if(r.action==='request') {
    const email=String(r.email||'').trim().toLowerCase();
    if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || email.length>254 || !/^[a-f0-9]{64}$/.test(r.challenge||'') || !/^\d{6}$/.test(r.code||'') || !/^[a-f0-9]{64}$/.test(r.ip||'')) return {status:400};
    // Fixed global limit bounds state growth from arbitrary addresses/IPs.
    if(!rate_(store,'global',1000,3600000,now) || !rate_(store,'ip:'+r.ip,60,3600000,now)) return {status:429};
    const key='email:'+hash_(email);
    if(!rate_(store,'cooldown:'+hash_(email),1,60000,now)) return {status:429,retryAfter:60};
    if(!rate_(store,key,5,3600000,now)) return {status:429,retryAfter:Math.max(1,Math.ceil((read_(store,key,now).expires-now)/1000))};
    const rows=rows_(r.period);
    if(!authorized_(rows,email,r.period)) return {status:200};
    if(MailApp.getRemainingDailyQuota()<1) return {status:503};
    const challengeKey='challenge:'+hash_(r.challenge);
    store.setProperty(challengeKey,JSON.stringify({email,period:r.period,digest:hash_(r.challenge+':'+r.code),attempts:0,expires:now+600000}));
    try {
      MailApp.sendEmail({to:email,name:'gk NEST',subject:'Your gk NEST '+(r.period==='CTSO'?'Robotics':'Period '+r.period)+' access code',
        body:'Your Period '+r.period+' code is '+r.code+'. It expires in 10 minutes. Enter it only at https://gknest.org. Access lasts 6 hours. If you did not request this, ignore this email.',
        htmlBody:emailHtml_(r.period,r.code)});
    } catch (_) {store.deleteProperty(challengeKey);return {status:503};}
    return {status:200};
  }
  if(r.action==='verify') {
    if(!/^[a-f0-9]{64}$/.test(r.challenge||'') || !/^[a-f0-9]{64}$/.test(r.session||'') || !/^\d{6}$/.test(r.code||'')) return {status:401};
    const key='challenge:'+hash_(r.challenge),c=read_(store,key,now);
    if(!c || c.period!==r.period || c.attempts>=5) return {status:401};
    c.attempts++;store.setProperty(key,JSON.stringify(c));
    if(c.digest!==hash_(r.challenge+':'+r.code)) return {status:401};
    const rows=rows_(r.period);
    if(!authorized_(rows,c.email,r.period)) return {status:401};
    const session={email:c.email,period:r.period,expires:now+21600000};
    store.setProperty('session:'+hash_(r.session),JSON.stringify(session));
    store.deleteProperty(key); // Single use after successful authorization and session persistence.
    return {status:200,expires:session.expires,names:rows.map(row=>String(row[0]||'').trim()).filter(Boolean)};
  }
  if(['roster','logout','tracker','tracker-update','export'].includes(r.action)) {
    const auth=authSession_(r.session,store,now);
    const legacyKey='session:'+hash_(r.session||'');
    const s=auth||(/^[a-f0-9]{64}$/.test(r.session||'')?read_(store,legacyKey,now):null);
    if(!s||(!auth&&s.period!==r.period&&!globalAccess_(s.email)))return {status:401};
    if(r.action==='logout'){if(!auth)store.deleteProperty(legacyKey);return {status:200};}
    const rows=rows_(r.period);
    if(!authorized_(rows,s.email,r.period)) return {status:403};
    if(['tracker','tracker-update','export'].includes(r.action))return trackerDispatch_(r,s,rows,store,now);
    return {status:200,expires:s.expires,names:rows.map(row=>String(row[0]||'').trim()).filter(Boolean)};
  }
  return {status:400};
}
function emailHtml_(period,code) {
  return '<div style="max-width:560px;margin:auto;font-family:Arial,sans-serif;color:#18233b">'+
    '<a href="https://gknest.org" style="display:block;text-decoration:none">'+
    '<img src="https://gknest.org/assets/nest-email-banner.png" width="560" alt="NEST&trade; &mdash; New Economy Skills Training" style="display:block;width:100%;max-width:560px;height:auto;margin:auto;border:0">'+
    '</a>'+
    '<div style="padding:28px"><h1 style="font-size:24px">Period '+period+' access</h1><p>Enter this code in the NEST tool you are unlocking:</p>'+
    '<p style="font-size:36px;letter-spacing:8px;font-weight:bold">'+code+'</p>'+
    '<p>This code expires in 10 minutes. Once verified, your access lasts <strong>6 hours</strong> on this browser.</p>'+
    '<p>Enter the code only at <a href="https://gknest.org/sops">gknest.org</a>. Do not share it.</p>'+
    '<p style="color:#626a79;font-size:13px">If you did not request this email, you can ignore it.</p></div></div>';
}
// Owner runs this once to grant read-only Sheets and send-email permissions.
// This checks access and quota; it does not send a message or print student data.
function authorizeSpinner() {
  Object.keys(PERIODS).forEach(period=>rows_(period));
  console.log('All period sheets readable. Email quota: '+MailApp.getRemainingDailyQuota());
}

// Public directory exposes only first names, divisions and roles.
function leadershipDirectory_() {
  const rows=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:E").values||[];
  const leaders=rows.map(row=>{
    const period=String(row[0]||'').replace(/period/ig,'').trim().toUpperCase();
    const name=String(row[3]||'').trim();
    return {division:period==='CTSO'?'NEST Robotics':'Period '+period,position:String(row[2]||'').trim(),firstName:name.includes(',')?name.split(',').slice(1).join(',').trim():name.split(/\s+/)[0]};
  }).filter(row=>row.position&&row.firstName&&!/^(vacant|open|we.?re hiring|hiring|tbd|n\/a)$/i.test(row.firstName));
  return {status:200,leaders};
}
function memberLeadershipDirectory_() {
  const rows=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
  const leaders=rows.map(row=>{
    const period=String(row[0]||'').replace(/period/ig,'').trim().toUpperCase();
    const name=String(row[3]||'').trim(),comma=name.indexOf(',');
    return {
      division:period==='CTSO'?'NEST Robotics':'Period '+period,
      position:String(row[2]||'').trim(),
      firstName:comma>=0?name.slice(comma+1).trim():name.split(/\s+/)[0],
      lastName:comma>=0?name.slice(0,comma).trim():name.split(/\s+/).slice(1).join(' '),
      email:districtEmail_(row[4])
    };
  }).filter(row=>row.position&&row.firstName&&row.lastName&&row.email&&/^(?:Period (?:1|2|3|4|5|7)|NEST Robotics)$/.test(row.division)&&!/^(vacant|open|we.?re hiring|hiring|tbd|n\/a)$/i.test(row.firstName));
  return {status:200,leaders};
}
