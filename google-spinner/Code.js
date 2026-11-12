// Source: Code.js
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
function doGet(e) { if(['robotics','employment'].includes(e?.parameter?.join)){try{return json_(joinPublicSchema_(e.parameter.join));}catch(_){return json_({status:503});}}return json_({status:401}); }
function doPost(e) {
  let r;
  try { r=JSON.parse(e.postData.contents); } catch (_) { return json_({status:400}); }
  if(typeof r.token!=='string' || hash_(r.token)!==BRIDGE_DIGEST) return json_({status:401});
  return withNestReadContext_(r,()=>nestRequest_(r));
}
function nestRequest_(r){
  if(r.action==='auth-tech-tickets'){try{return json_(techDispatch_(r));}catch(error){return json_({status:503,diagnostic:String(error.message||error).split(String(r.session||'__no_session__')).join('[session]').split(String(r.token||'__no_token__')).join('[credential]').slice(0,400)});}}
  if(r.action==='auth-fabrication-intake'){try{return json_(fabIntakeDispatch_(r));}catch(_){return json_({status:503});}}
  if(r.action==='safety-drive-worker'){try{return json_(safetyDriveWorker_(r));}catch(error){console.error('Safety Drive worker failed',String(error.stack||error));return json_({status:503});}}
  if(r.action==='auth-safety'){try{return json_(safetyDispatch_(r));}catch(error){console.error('Safety dispatch failed',String(error.stack||error));return json_({status:503,error:'Safety workspace is unavailable. Refresh before retrying.'});}}
  if(r.action==='join-employment-schema'){try{return json_({status:200,schema:joinEmploymentSchema_()});}catch(_){return json_({status:503});}}
  if(r.action==='auth-join-employment'){try{return json_(joinEmploymentSubmit_(r));}catch(_){return json_({status:503});}}

  if(r.action==='lab-teacher-action'){
    try{return json_(labTeacherDispatch_(r));}catch(_){return json_({status:503,error:'The teacher response could not be confirmed. Please open the email link again.'});}
  }

  if(r.action==='auth-lab-requests'){
    try{const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());return json_(session?labDispatch_(session,r):{status:401});}
    catch(_){return json_({status:503,error:'NEST™ Request is temporarily unavailable. Refresh before retrying.'});}
  }

  if(r.action==='auth-email-archive'){
    try{return json_(emailArchiveDispatch_(r));}catch(_){return json_({status:503});}
  }
  if(r.action==='auth-group-email-access'){
    try{return json_(groupEmailAccess_(r));}catch(error){return json_(nestServiceFailure_(r.action,error));}
  }
  if(r.action==='auth-group-email'){
    try{return json_(groupEmailDispatch_(r));}catch(error){return json_(nestServiceFailure_(r.action,error));}
  }
  if(['finished-list-view','auth-finished-list-add','auth-finished-list-update','auth-finished-list-delete'].includes(r.action)){
    try{return json_(finishedDispatch_(r));}catch(_){return json_({status:503});}
  }
  if(/^robotics-signup-/.test(r.action||'')){try{return json_(roboticsSignupDispatch_(r));}catch(_){return json_({status:503});}}
  if(['diagnostics-record','auth-diagnostics-read'].includes(r.action))return json_(diagnosticDispatch_(r));
  if(r.action==='auth-spinner-rosters') {
    try{return json_(spinnerRosters_(r.session));}catch(_){return json_({status:503});}
  }
  if(r.action==='doughnut-barometer') {
    try{return json_(doughnutBarometer_(r.session));}catch(_){return json_({status:503});}
  }
  if(/^(auth-service-|service-client-)/.test(r.action||''))return json_(serviceDispatch_(r));
  if(r.action==='signals-classes') {
    try { return json_(signalsClasses_()); } catch(_) { return json_({status:503}); }
  }
  if(r.action==='leadership') return json_({status:401});
  if(['fabrication-public','auth-fabrication-view','auth-fabrication-update','auth-fabrication-email'].includes(r.action)){
    try{return json_(fabDispatch_(r));}catch(error){console.error('Fabrication action failed',r.action);return json_({status:503});}
  }
  if(r.action==='auth-purchasing'){
    try{return json_(purchasingDispatch_(r));}catch(_){return json_({status:503});}
  }
  if(r.action==='auth-inventory'){
    try{return json_(inventoryDispatch_(r));}catch(_){return json_({status:503});}
  }
  if(r.action==='auth-robotics'){
    const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return json_({status:503});
    try{return json_(roboticsDispatch_(r));}catch(_){return json_({status:503});}finally{lock.releaseLock();}
  }
  if(r.action==='auth-division-slides') {
    try{return json_(divisionSlidesDispatch_(r));}catch(_){return json_({status:503});}
  }
  if(r.action==='auth-leadership-directory') {
    try {
      const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
      return json_(session?memberLeadershipDirectory_():{status:401});
    } catch(_){return json_({status:503});}
  }
  if(r.action==='auth-weather-native') {
    try {
      const empty=weatherNativePollEmpty_(r);if(empty)return json_(empty);
      const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
      return json_(session?weatherNativeDispatch_(session,r):{status:401});
    } catch(error){console.error('Native weather failed',String(error&&error.message||error).slice(0,160));return json_({status:503});}
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
      if(!session)return json_({status:401});
      const result=hiringView_(session.email,r.period,r.page);
      if(result.status===200)result.identity=nestSessionIdentity_(session);
      return json_(result);
    } catch(error){console.error('Hiring view failed',String(error&&error.message||error).slice(0,200));return json_({status:503});}
  }
  if(['auth-hiring-assign','auth-hiring-partner','auth-hiring-review'].includes(r.action)) {
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(15000))return json_({status:503});
    try {
      const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
      if(!session)return json_({status:401});
      const result=r.action==='auth-hiring-review'?hiringSaveReview_(session.email,r):r.action==='auth-hiring-partner'?hiringPartner_(session.email,r):hiringAssign_(session.email,r);
      if(result.status===200&&r.action!=='auth-hiring-review')result.sharingQueued=hiringQueueSlideAccess_(r);
      return json_(result);
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
      return json_(nestServiceFailure_(r.action,error));
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
// Fresh request-scoped reads only. Never reuse membership or roles across requests.
let NEST_ACCESS_READS=null;
function nestAccessValues_(id,range){
 const key=id+':'+range;
 if(NEST_ACCESS_READS&&NEST_ACCESS_READS.has(key))return {values:NEST_ACCESS_READS.get(key)};
 const result=Sheets.Spreadsheets.Values.get(id,range);
 if(NEST_ACCESS_READS)NEST_ACCESS_READS.set(key,result.values||[]);
 return result;
}
function withNestReadContext_(r,work){
 if(/^auth-(recover-(request|verify|reset)|register(-request|-verify)?)$/.test(r.action||''))return authRecoveryReadContext_(work);
 if(r.action==='safety-drive-worker')return safetyReadContext_(r,work);
 if(r.action==='auth-safety'){const result=safetyReadContext_(r,work);return result&&typeof result.status==='number'?json_(result):result;}
 if(r.action==='auth-tech-tickets')return techReadContext_(r,work);
 const readonly=r.action==='auth-division-slides'&&r.operation==='access'||r.action==='auth-hiring-view'||r.action==='auth-leadership-directory'||r.action==='auth-group-email-access';
 if(!readonly){
  if(!/^auth-service-/.test(r.action||'')&&!['auth-tech-tickets','auth-me','auth-group-email','auth-email-archive','diagnostics-record','auth-diagnostics-read','auth-weather-native'].includes(r.action))return work();
  // Reuse account reads only inside this request; later requests recheck live data.
  const previous=NEST_ACCESS_READS;NEST_ACCESS_READS=new Map();
  try{return work();}finally{NEST_ACCESS_READS=previous;}
 }
 const previous=NEST_ACCESS_READS;NEST_ACCESS_READS=new Map();
 try{
  const store=PropertiesService.getScriptProperties(),session=/^[a-f0-9]{64}$/.test(r.session||'')?read_(store,'authsession:'+hash_(r.session),Date.now()):null;
  if(session){
   const ranges=[AUTH_SHEET];
   if(r.action==='auth-group-email-access'&&r.period==='all')Object.keys(PERIODS).forEach(period=>ranges.push("'"+(period==='CTSO'?'CTSO':'Period '+period)+"'!A2:C1000"));
   if(Object.prototype.hasOwnProperty.call(PERIODS,r.period))ranges.push("'"+(r.period==='CTSO'?'CTSO':'Period '+r.period)+"'!A2:C1000");
   if(r.action==='auth-hiring-view'&&r.period!=='CTSO')ranges.push("'CTSO'!A2:C1000");
   const groups=[{id:NEST_DATABASE,ranges:[...new Set(ranges)]},{id:LEADERSHIP_DATABASE,ranges:["'Imported'!B2:F"]}];
   try{
    const bearer=ScriptApp.getOAuthToken();
    const responses=UrlFetchApp.fetchAll(groups.map(group=>({url:'https://sheets.googleapis.com/v4/spreadsheets/'+group.id+'/values:batchGet?'+group.ranges.map(range=>'ranges='+encodeURIComponent(range)).join('&')+'&valueRenderOption=FORMATTED_VALUE&fields=valueRanges(values)',headers:{Authorization:'Bearer '+bearer},muteHttpExceptions:true})));
    responses.forEach((response,index)=>{
     if(response.getResponseCode()!==200)return;
     const data=JSON.parse(response.getContentText()),group=groups[index];
     if(!Array.isArray(data.valueRanges)||data.valueRanges.length!==group.ranges.length)return;
     if(!data.valueRanges.every(range=>range&&(!range.values||Array.isArray(range.values)&&range.values.every(Array.isArray))))return;
     group.ranges.forEach((range,i)=>NEST_ACCESS_READS.set(group.id+':'+range,data.valueRanges[i].values||[]));
    });
   }catch(error){console.warn('Parallel access read unavailable; using live Sheets reads.');}
  }
  return work();
 }finally{NEST_ACCESS_READS=previous;}
}
function nestSessionIdentity_(session){return {signedIn:true,email:session.email,username:session.username,expires:session.expires};}
const NEST_DATABASE = '12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE';
const OWNER_EMAILS = ['mpenalver@bethelsd.org','mario@memberhq.net','astramario@gmail.com'];
function email_(value) { return String(value||'').trim().toLowerCase(); }
function rows_(period) {
  const rows=nestAccessValues_(NEST_DATABASE,"'"+(period==='CTSO'?'CTSO':'Period '+period)+"'!A2:C1000").values||[];
  return rows.filter(row=>row[0] && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email_(row[2]))).map(row=>[String(row[0]).trim(),email_(row[2])]);
}
function memberEmail_(identity,period) {
  const key=email_(identity);
  if(!key.startsWith('manual:'))return key;
  const account=accountByEmail_(key);
  if(!account||!account.active||!account.linkedEmail||!account.periods.includes(period))return key;
  return rows_(period).some(row=>email_(row[1])===account.linkedEmail)?account.linkedEmail:key;
}
function nestExecutive_(identity,leaders){
 const address=memberEmail_(identity,'CTSO');
 const rows=leaders||(nestAccessValues_(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[]);
 return rows.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()==='CTSO'&&
  /^chief (executive|financial|operations) officers?$/i.test(String(row[2]||'').trim())&&email_(row[4])===address)&&
  rows_('CTSO').some(row=>email_(row[1])===address);
}
// Staff registration proves identity; only owner-issued grants authorize divisions.
function staffIdentity_(identity){return /^[^\s@,;<>]+@bethelsd\.org$/.test(email_(identity))&&!OWNER_EMAILS.includes(email_(identity));}
function staffGrant_(identity){
 const email=email_(identity);if(!staffIdentity_(email))return null;
 const account=typeof accountByEmail_==='function'?accountByEmail_(email):null;if(!account||!account.active)return null;
 const raw=PropertiesService.getScriptProperties().getProperty('staff-access:'+hash_(email));
 if(!raw)return null;
 try{const grant=JSON.parse(raw);return grant.email===email&&['division','admin'].includes(grant.level)&&grant.divisions&&typeof grant.divisions==='object'?grant:null;}catch(_){return null;}
}
function staffRole_(identity,period){const grant=staffGrant_(identity);if(!grant)return '';return grant.level==='admin'?'administrator':Object.prototype.hasOwnProperty.call(PERIODS,period)&&['viewer','manager'].includes(grant?.divisions?.[period])?grant.divisions[period]:'';}
function websiteAdmin_(identity){return OWNER_EMAILS.includes(email_(identity))||staffRole_(identity)==='administrator';}
function staffManager_(identity,period){return ['administrator','manager'].includes(staffRole_(identity,period));}
function globalAccess_(email) {return websiteAdmin_(email);}
function manualPeriodAccess_(email,period) {
  if(typeof accountByEmail_!=='function')return false;
  const account=accountByEmail_(email);
  return Boolean(account&&account.active&&!account.linkedEmail&&account.periods.includes(period));
}
function authorized_(rows,email,period) { if(staffIdentity_(email))return Boolean(staffRole_(email,period)); return rows.some(row=>email_(row[1])===memberEmail_(email,period)) || globalAccess_(email) || (period && (manualPeriodAccess_(email,period) || manager_(email,period) || Boolean(editorGrant_(email,period)))); }
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
  const rows=nestAccessValues_(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
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

// Source: Auth.js
// NEST account records live in StudentNESTAccess. Only salted hashes are stored.
const AUTH_SHEET = "'StudentNESTAccess'!A2:K";
const AUTH_DURATIONS = {session:43200000,'1d':86400000,'7d':604800000,'30d':2592000000};
// Run once in the school-owned editor after changing the manifest's Sheets scope.
function authorizeNestAuth() {
  const expected=['Username','District Email','Password Hash','Password Salt','Active','Session Version','Created At','Last Login At'];
  const header=(Sheets.Spreadsheets.Values.get(NEST_DATABASE,"'StudentNESTAccess'!A1:H1").values||[])[0]||[];
  if(expected.some((name,index)=>String(header[index]||'').trim()!==name))throw new Error('StudentNESTAccess headers do not match the NEST authentication schema.');
  console.log('NEST account sheet is ready. Account mail uses the server-configured NEST Communications sender.');
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
  const rows=nestAccessValues_(NEST_DATABASE,AUTH_SHEET).values||[];
  return rows.map((row,index)=>({row:index+2,username:username_(row[0]),email:accountEmail_(row[1]),passwordHash:String(row[2]||''),passwordSalt:String(row[3]||''),active:String(row[4]||'').toLowerCase()==='true',version:Number(row[5])||1,periods:String(row[8]||'').split(',').filter(value=>Object.prototype.hasOwnProperty.call(PERIODS,value)),recoveryEmail:districtEmail_(row[9])||(OWNER_EMAILS.includes(email_(row[9]))?email_(row[9]):'')||districtEmail_(row[1])||(OWNER_EMAILS.includes(email_(row[1]))?email_(row[1]):''),linkedEmail:districtEmail_(row[10]),createdAt:String(row[6]||''),notes:String(row[11]||'')})).filter(a=>a.email);
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
  const guest=read_(PropertiesService.getScriptProperties(),'auth-guest-robotics:'+hash_(email),Date.now());if(guest?.email===email&&/^\d{3,12}@students\.bethelsd\.org$/.test(email))return true;
  if(OWNER_EMAILS.includes(email)||staffIdentity_(email))return true;
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
  if(/^auth-(admin-create|admin-roster|admin-list|admin-directory|admin-notes|admin-registration-unlock|admin-edit|admin-remove|admin-reset|staff-list|staff-save|profile-read|profile-update|recover-request|recover-verify|recover-reset)$/.test(r.action||''))return accountDispatch_(r,store,now);
  if(Number(store.getProperty('auth-cleanup')||0)<now-3600000){
    const lock=LockService.getScriptLock();
    if(lock.tryLock(100))try{
      if(Number(store.getProperty('auth-cleanup')||0)<now-3600000){
        store.setProperty('auth-cleanup',String(now));
        const all=store.getProperties();
        Object.keys(all).forEach(key=>{
          if(/^auth(session|challenge|ticket|recover|recoveryticket|\-register\-override|\-ip|\-email|\-cooldown|\-login\-ip|\-login\-name|\-reserve|\-recover\-ip|\-recover\-email|\-recover\-cooldown):/.test(key)){
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
      // A short owner-issued exception applies only to this email, including shared-school IP limits.
      const override=read_(store,'auth-register-override:'+hash_(email),now);
      if((!override&&!rate_(store,'auth-ip:'+r.ip,30,3600000,now))||!rate_(store,'auth-email:'+hash_(email),5,3600000,now))return {status:429};
      if(!rate_(store,'auth-cooldown:'+hash_(email),1,60000,now))return {status:429};
      return {status:200};
    });
    if(limited.status!==200)return limited;
    if(lookupAccounts_().some(a=>a.email===email)||!recognizedForAccount_(email))return {status:200};
    const key='authchallenge:'+hash_(r.challenge);
    store.setProperty(key,JSON.stringify({email,digest:hash_(r.challenge+':'+r.code),attempts:0,expires:now+600000}));
    try {nestAccountMail_(r,{to:email,subject:'Create your NEST account',body:'Your one-time NEST account verification code is '+r.code+'. It expires in 10 minutes. Enter it only at https://gknest.org. If you did not request an account, ignore this email.',htmlBody:nestEmailHtml_('Create your NEST account','Your account verification code is',r.code)});}
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
        if(sheet)withAuthLock_(()=>{Sheets.Spreadsheets.batchUpdate({requests:[{sortRange:{range:{sheetId:sheet.properties.sheetId,startRowIndex:1,endRowIndex:all.length+2,startColumnIndex:0,endColumnIndex:12},sortSpecs:[{dimensionIndex:0,sortOrder:'ASCENDING'}]}}]},NEST_DATABASE);return {status:200};});
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
      const overrideKey='auth-login-override:'+hash_(name),override=read_(store,overrideKey,now);if(override?.remaining===1){store.deleteProperty(overrideKey);return {status:200};}
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

// Source: Account.js
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
// Source: Tracker.js
// Private tracker files, created by this app. Original spreadsheets are read only during import.
const SCORE_OPTIONS = ['4','3','2','1','A','NE','Yes','No'];
function trackerFile_(period) {
  const store=PropertiesService.getScriptProperties();
  return store.getProperty('tracker-file:'+period);
}
function trackerRead_(period) {
  const id=trackerFile_(period);if(!id)return null;
  const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Tracker storage unavailable');
  const data=JSON.parse(response.getContentText());
  if(data.schema!==1 || data.period!==period || !Number.isInteger(data.revision))throw new Error('Invalid tracker format');
  return data;
}
function trackerFolder_() {
  const store=PropertiesService.getScriptProperties();let id=store.getProperty('tracker-folder');
  if(!id){id=Drive.Files.create({name:'NEST Private Trackers',mimeType:'application/vnd.google-apps.folder'},null,{fields:'id'}).id;store.setProperty('tracker-folder',id);}
  return id;
}
function trackerSave_(data) {
  const store=PropertiesService.getScriptProperties(),id=trackerFile_(data.period);
  const blob=Utilities.newBlob(JSON.stringify(data),'application/json','Period '+data.period+'.json');
  if(id) Drive.Files.update({},id,blob,{fields:'id'});
  else {const file=Drive.Files.create({name:'Period '+data.period+'.json',parents:[trackerFolder_()],mimeType:'application/json'},blob,{fields:'id'});store.setProperty('tracker-file:'+data.period,file.id);}
}
const LEADERSHIP_DATABASE = '1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I';
function manager_(email,period) {
  if(staffIdentity_(email))return staffManager_(email,period);
  const rows=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
  if(nestExecutive_(email,rows))return true;
  return rows.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period && ['division manager','assistant manager'].includes(String(row[2]||'').trim().toLowerCase()) && email_(row[4])===memberEmail_(email,period));
}
function grantRecord_(store,key,now) {
  const raw=store.getProperty(key);if(!raw)return null;
  const grant=JSON.parse(raw);
  if(grant.expires && grant.expires<=now){store.deleteProperty(key);return null;}
  // Existing active six-hour grants become revocable grants on first use.
  if(grant.expires!==Number.MAX_SAFE_INTEGER){grant.expires=Number.MAX_SAFE_INTEGER;store.setProperty(key,JSON.stringify(grant));}
  return grant;
}
function editorGrant_(email,period,seen) {
  const address=email_(email),chain=seen||new Set();
  if(chain.has(address)||chain.size>=50)return null;
  const store=PropertiesService.getScriptProperties(),grant=grantRecord_(store,'grant:'+period+':'+hash_(address),Date.now());
  if(!grant||email_(grant.email)!==address||grant.period!==period||!grant.issuer)return null;
  const issuer=email_(grant.issuer);
  if(globalAccess_(issuer)||manager_(issuer,period))return grant;
  chain.add(address);
  const parent=editorGrant_(issuer,period,chain);
  return parent&&grant.expires<=parent.expires?grant:null;
}
function trackerRole_(email,period) {
  if(staffIdentity_(email)){const role=staffRole_(email,period);return role==='viewer'?'student':role==='administrator'?'administrator':role==='manager'?'manager':'student';}
  if(period==='CTSO')return roboticsAccess_(email)?(OWNER_EMAILS.includes(email_(email))?'administrator':'manager'):'student';
  if(globalAccess_(email))return 'administrator';
  if(manager_(email,period))return 'manager';
  return editorGrant_(email,period)?'editor':'student';
}
function grantEditor_(r,s,store,now) {
  if(r.period==='CTSO')return {status:403};
  const authority=globalAccess_(s.email)||manager_(s.email,r.period),parent=authority?null:editorGrant_(s.email,r.period);
  if(!authority&&!parent)return {status:403};
  const email=email_((r.change||{}).email);
  if(email.length>254 || !/^[a-z0-9._%+-]+@(students\.)?bethelsd\.org$/.test(email)||email===email_(s.email))return {status:400};
  if(r.change.type==='grant'&&staffIdentity_(email))return {status:403};
  const key='grant:'+r.period+':'+hash_(email);
  const existing=grantRecord_(store,key,now);
  if(!authority&&existing&&email_(existing.issuer)!==email_(s.email))return {status:403};
  if(r.change.type==='revoke'){store.deleteProperty(key);return {status:200};}
  // A delegate cannot grant to someone who is already above them in the chain.
  if(!authority){let current=email_(s.email),seen=new Set();while(current&&!seen.has(current)){if(current===email)return {status:403};seen.add(current);const grant=grantRecord_(store,'grant:'+r.period+':'+hash_(current),now);current=grant&&email_(grant.issuer);}}
  const all=store.getProperties(),count=Object.keys(all).filter(k=>k.startsWith('grant:'+r.period+':')&&grantRecord_(store,k,now)).length;
  if(count>=50&&!store.getProperty(key))return {status:429};
  store.setProperty(key,JSON.stringify({email,issuer:email_(s.email),period:r.period,expires:Number.MAX_SAFE_INTEGER}));
  return {status:200};
}
function trackerView_(data,rows,role,expires,includeArchived=false) {
  const leaders=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
  const leadership=new Map();
  leaders.forEach(row=>{
    if(String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()!==data.period)return;
    const email=email_(row[4]),position=String(row[2]||'').trim();
    if(!email||!position)return;
    const roles=leadership.get(email)||[];if(!roles.includes(position))roles.push(position);leadership.set(email,roles);
  });
  const current=rows.map(row=>({id:hash_(email_(row[1])),name:row[0],email:row[1],active:true,leadershipRole:(leadership.get(email_(row[1]))||[]).join(' · ')}));
  const students=includeArchived ? [...current,...(data.students||[]).filter(old=>!current.some(s=>s.id===old.id)).map(old=>({...old,active:false}))] : current;
  const scores={};
  students.forEach(s=>{scores[s.id]={};data.assignments.forEach(a=>{scores[s.id][a.id]=(data.scores[s.id]||{})[a.id]||'';});});
  return {status:200,period:data.period,expires,revision:data.revision,role,students,assignments:data.assignments,scores,completionScores:['4'],updatedAt:data.updatedAt};
}
function trackerDispatch_(r,s,rows,store,now) {
  const role=trackerRole_(s.email,r.period),data=trackerRead_(r.period);
  if(!data)return {status:409,message:'This period is waiting for its initial data import.'};
  function view(){const result=trackerView_(data,rows,role,s.expires);result.canShare=r.period!=='CTSO';if(role==='editor')result.editExpires=editorGrant_(s.email,r.period).expires;
    if(['administrator','manager','editor'].includes(role)){const all=store.getProperties();result.grants=Object.keys(all).filter(k=>k.startsWith('grant:'+r.period+':')).map(k=>grantRecord_(store,k,now)).filter(g=>g&&editorGrant_(g.email,r.period)&&(role!=='editor'||email_(g.issuer)===email_(s.email))).map(g=>({email:g.email}));}return result;}
  if(r.action==='tracker')return view();
  if(r.action==='export' && role==='administrator')return trackerView_(data,rows,role,s.expires,true);
  if(r.action!=='tracker-update' || !['administrator','manager','editor'].includes(role))return {status:403};
  if(['grant','revoke'].includes((r.change||{}).type)){const result=grantEditor_(r,s,store,now);return result.status===200?view():result;}
  if(r.revision!==data.revision)return {status:409,message:'Another person saved changes. Refresh the tracker before trying again.'};
  const change=r.change||{};
  if(change.type==='score' || change.type==='scores') {
    const edits=change.type==='score'?[change]:change.edits;
    if(!Array.isArray(edits)||!edits.length||edits.length>8)return {status:400};
    for(const edit of edits){
      if(!SCORE_OPTIONS.includes(edit.score) && edit.score!=='')return {status:400};
      if(!data.assignments.some(a=>a.id===edit.assignment) || !rows.some(row=>hash_(email_(row[1]))===edit.student))return {status:400};
    }
    edits.forEach(edit=>{data.scores[edit.student]=data.scores[edit.student]||{};data.scores[edit.student][edit.assignment]=edit.score;});
  } else if(change.type==='assignment') {
    const title=String(change.title||'').trim();if(!title || title.length>100 || data.assignments.length>=100)return {status:400};
    data.assignments.push({id:Utilities.getUuid(),title});
  } else if(change.type==='rename') {
    const a=data.assignments.find(a=>a.id===change.assignment),title=String(change.title||'').trim();
    if(!a || !title || title.length>100)return {status:400};a.title=title;
  } else if(change.type==='resize') {
    const a=data.assignments.find(a=>a.id===change.assignment),width=Number(change.width);
    if(!a || !Number.isInteger(width) || width<64 || width>600)return {status:400};a.width=width;
  } else if(change.type==='reorder') {
    const order=change.order;
    if(!Array.isArray(order)||order.length!==data.assignments.length||new Set(order).size!==order.length||order.some(id=>typeof id!=='string'||!data.assignments.some(a=>a.id===id)))return {status:400};
    const byId=new Map(data.assignments.map(a=>[a.id,a]));data.assignments=order.map(id=>byId.get(id));
  } else if(change.type==='delete') {
    const index=data.assignments.findIndex(a=>a.id===change.assignment);
    if(index<0)return {status:400};
    const id=data.assignments[index].id;data.assignments.splice(index,1);
    Object.values(data.scores).forEach(scores=>{if(scores&&typeof scores==='object')delete scores[id];});
  } else return {status:400};
  const current=rows.map(row=>({id:hash_(email_(row[1])),name:row[0],email:row[1]}));
  data.students=[...current,...(data.students||[]).filter(old=>!current.some(s=>s.id===old.id))];
  data.revision++;data.updatedAt=now;
  // Keep a bounded audit trail, without copying student names or email addresses into it.
  data.audit=(data.audit||[]).concat({at:now,actor:hash_(s.email),type:change.type,revision:data.revision}).slice(-500);
  trackerSave_(data);return view();
}
function importTracker_(period) {
  if(trackerFile_(period))throw new Error('Tracker already imported; refusing to overwrite');
  const raw=Sheets.Spreadsheets.Values.get(PERIODS[period],"'"+(period==='CTSO'?'CTSO':'Period '+period)+"'!A5:W").values||[];
  const headers=raw[0]||[],assignments=[];
  for(let col=2;col<headers.length;col++)if(String(headers[col]||'').trim())assignments.push({id:'legacy-'+col,title:String(headers[col]).trim(),sourceColumn:col});
  const scores={},students=[];
  raw.slice(1).forEach(row=>{const email=email_(row[1]);if(!email)return;const id=hash_(email);if(scores[id])throw new Error('Duplicate student email in legacy tracker');students.push({id,name:String(row[0]||'').trim(),email});scores[id]={};assignments.forEach(a=>{scores[id][a.id]=String(row[a.sourceColumn]||'').trim();});});
  const data={schema:1,period,revision:1,assignments:assignments.map(({id,title})=>({id,title})),scores,students,completionScores:['4'],updatedAt:Date.now(),audit:[]};
  trackerSave_(data);return {period,assignments:data.assignments.length,students:Object.keys(scores).length};
}

// Run only by the school project owner after authorizing the new Drive scopes.
function initializeTrackers() {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {Object.keys(PERIODS).forEach(period=>{
    rows_(period);manager_('health-check@example.invalid',period);
    if(!trackerFile_(period))console.log(JSON.stringify(importTracker_(period)));
    else console.log('Period '+period+' already imported; left unchanged.');
    const data=trackerRead_(period);if(!data)throw new Error('Import verification failed');
  });}finally{lock.releaseLock();}
}
// Source: Weather.js
// Read-only, division-scoped weather report view. Never return the workbook URL or another tab.
const WEATHER_DATABASE = '1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8';
const WEATHER_TABS = {
  Advisory: {id:336431884,title:'Advisory'},
  '1': {id:746267134,title:'Period 1'},
  '2': {id:1427888033,title:'Period 2'},
  '3': {id:1130272553,title:'Period 3'},
  '4': {id:427894969,title:'Period 4'},
  '5': {id:544800814,title:'Period 5'},
  CTSO: {id:1301441231,title:'CTSO'}
};
const WEATHER_PERIODS = Object.keys(WEATHER_TABS);
// Bethel's published 2026–27 student calendar. Refresh these dates for each school year.
const WEATHER_TRIMESTERS = [
  {start:'2026-08-31',end:'2026-11-24'},
  {start:'2026-11-25',end:'2027-03-10'},
  {start:'2027-03-11',end:'2027-06-15'}
];
function weatherSerial_(date) {return Date.parse(date+'T00:00:00Z')/86400000+25569;}
function weatherCurrentTrimester_() {
  const today=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd');
  const trimester=WEATHER_TRIMESTERS.find(item=>item.start<=today&&today<=item.end);
  return trimester&&{start:weatherSerial_(trimester.start),end:Math.min(weatherSerial_(trimester.end),weatherSerial_(today))};
}
function weatherRole_(email,period,leaders) {
  if(websiteAdmin_(email))return true;
  if(staffIdentity_(email))return staffManager_(email,period);
  leaders=leaders||Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
  const ownEmail=memberEmail_(email,period);
  return leaders.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period.toUpperCase() &&
    /^(division manager|assistant manager|partner liaison|parnter liaison)$/i.test(String(row[2]||'').trim()) && email_(row[4])===ownEmail);
}
function weatherForMember_(email,period,page) {
  if(period==='mine') {
    const all=WEATHER_PERIODS;
    const leaders=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
    return {status:200,periods:all.filter(value=>weatherRole_(email,value,leaders))};
  }
  if(!WEATHER_PERIODS.includes(period)||!Number.isInteger(page)||page<0||page>100)return {status:400};
  if(!weatherRole_(email,period))return {status:403};
  const info=Sheets.Spreadsheets.get(WEATHER_DATABASE,{fields:'sheets(properties(sheetId,title,hidden,gridProperties(rowCount)))'});
  const expected=WEATHER_TABS[period];
  const tab=(info.sheets||[]).find(sheet=>!sheet.properties.hidden && sheet.properties.sheetId===expected.id && sheet.properties.title===expected.title);
  if(!tab)return {status:404};
  const title=tab.properties.title;
  const quoted="'"+title.replace(/'/g,"''")+"'!";
  const summaryRows=Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,quoted+'C2:F6',{valueRenderOption:'FORMATTED_VALUE'}).values||[];
  const summary=summaryRows.map(row=>[0,1,2,3].map(index=>String(row[index]??'')));
  const columns=(Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,quoted+'A9:M9',{valueRenderOption:'FORMATTED_VALUE'}).values||[])[0]||[];
  if(String(columns[0]||'').trim()!=='Timestamp')return {status:503};
  const trimester=weatherCurrentTrimester_();
  const lastRow=tab.properties.gridProperties.rowCount;
  const timestamps=trimester&&lastRow>=10?(Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,quoted+'A10:A'+lastRow,{valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'}).values||[]):[];
  const matchingRows=[];
  timestamps.forEach((row,index)=>{
    const serial=Number(row[0]);
    if(row[0]!==''&&row[0]!=null&&Number.isFinite(serial)&&Math.floor(serial)>=trimester.start&&Math.floor(serial)<=trimester.end)matchingRows.push(index+10);
  });
  const first=matchingRows[0],last=matchingRows[matchingRows.length-1];
  const sourceRows=first==null?[]:(Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,quoted+'A'+first+':M'+last,{valueRenderOption:'FORMATTED_VALUE'}).values||[]);
  const matching=new Set(matchingRows);
  const expectedPeriod=expected.title;
  const currentRows=sourceRows.filter((row,index)=>matching.has(first+index)&&String(row[3]||'').trim()===expectedPeriod);
  const rows=currentRows.slice(page*100,(page+1)*100);
  return {status:200,division:expected.title,summary,columns,rows,page,hasMore:(page+1)*100<currentRows.length};
}
// Source: Hiring.js
// Application data stays in its school-owned workbook; every read checks live leadership roles.
const HIRING_PERIODS = ['1','2','3','4','5','7','CTSO'];
function hiringRows_() {return (typeof nestAccessValues_==='function'?nestAccessValues_:Sheets.Spreadsheets.Values.get)(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];}
function hiringPermissions_(email,period,rows) {
  if(staffIdentity_(email)){const allowed=staffManager_(email,period);return {canReview:allowed,canManage:allowed};}
  if(OWNER_EMAILS.includes(email_(email)))return {canReview:true,canManage:true};
  rows=rows||hiringRows_();
  const normalized=memberEmail_(email,period);
  const own=rows.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&
    /^(division manager|assistant manager|chief executive officer|executive vice-president)$/i.test(String(row[2]||'').trim())&&email_(row[4])===normalized);
  const currentMember=own&&rows_(period).some(row=>email_(row[1])===normalized);
  const currentExecutive=nestExecutive_(email,rows);
  return {canReview:currentMember||currentExecutive,canManage:currentMember||currentExecutive};
}
// Fixed school-owned sources also work when a division has no hires yet.
const HIRING_WORKBOOKS = {
 '1':'1Ut9K28LgaYbNHJRw6cn1l48wD_aaO484ZMjJi8zcIxo','2':'13RUztc3CXnd9bzM9IcYXEIqhO-045KbStHeB7GKA_W4',
 '3':'1-GGowYJrqxrE9fzS7Gqco1CMRqflPd45HK4NvXj4WMc','4':'1DBkq8zvNVi48aegk0AkMObEDH0krVmRnmigVPUHyuCI',
 '5':'1BAzRoHsx3lbAG-PH48_8fQHRW6WAmEJL3Fi0eIxBcGY','7':'12IHgmIYtgh840IR9A52G5nON3Q0foQKNSGU-2LCx4ks',
 'CTSO':'1Fz65n04x1wCLcuVjYpKEcEexlyZvsoMKhOfJZkhovfg'
};
const HIRING_POSITIONS = ['Division Manager','Assistant Manager','Director of Client Relations','Director of Inventory','Director of Social Marketing','Division DJ','Fabrication Supervisor','Partner Liaison','Safety Officer','Software Technician'];
function hiringPositions_(period){return period==='CTSO'?['Chief Executive Officer','Executive Vice-President','Chief Financial Officer','Chief Operations Officers',...HIRING_POSITIONS.slice(2)]:HIRING_POSITIONS;}
function hiringWorkbook_(period) {return HIRING_WORKBOOKS[period]||'';}
function hiringHash_(value) {
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value)).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function hiringKey_(row) {return hiringHash_(Array.from({length:7},(_,i)=>String(row[i]||'')));}
function hiringScores_(value) {
 try {const scores=typeof value==='string'?JSON.parse(value):value;
  return Array.isArray(scores)&&scores.length===4&&scores.every(x=>x===null||(Number.isInteger(x)&&x>=1&&x<=4))?scores:null;
 }catch{return null;}
}
function hiringReview_(row,saved) {
 const notes=String(row[7]||''),scores=hiringScores_(saved&&saved[1])||[null,null,null,null];
 return {key:hiringKey_(row),notes,scores,revision:hiringHash_([notes,scores])};
}
function hiringView_(email,period,page) {
  if(period!=='mine'&&!HIRING_PERIODS.includes(period))return {status:400};
  if(!Number.isInteger(page)||page<0||page>10)return {status:400};
  const rows=hiringRows_();
  if(period==='mine')return {status:200,periods:HIRING_PERIODS.filter(value=>hiringWorkbook_(value,rows)&&hiringPermissions_(email,value,rows).canReview)};
  const access=hiringPermissions_(email,period,rows);
  if(!access.canReview)return {status:403};
  const workbook=hiringWorkbook_(period,rows);
  if(!workbook)return {status:404};
  const info=Sheets.Spreadsheets.get(workbook,{fields:'sheets(properties(title,gridProperties(rowCount)))'});
  const tabs=info.sheets||[];
  const apps=tabs.find(sheet=>sheet.properties.title==='Applications');
  if(!apps)return {status:404};
  const start=page*100+2,end=Math.min(start+99,apps.properties.gridProperties.rowCount);
  const ranges=["'Applications'!A1:H1"];
  const applicationIndex=end>=start?ranges.push("'Applications'!A"+start+':H'+end)-1:-1;
  const teamTab=tabs.find(sheet=>sheet.properties.title==='Division Team');
  const teamIndex=access.canManage&&teamTab?ranges.push("'Division Team'!B3:D"+teamTab.properties.gridProperties.rowCount)-1:-1;
  const reviewTab=tabs.find(sheet=>sheet.properties.title==='NEST Interview Reviews');
  const reviewIndex=reviewTab?ranges.push("'NEST Interview Reviews'!A2:D"+reviewTab.properties.gridProperties.rowCount)-1:-1;
  // Fetch the headers, bounded applications and permitted team cells together.
  const values=Sheets.Spreadsheets.Values.batchGet(workbook,{ranges,valueRenderOption:'FORMATTED_VALUE'}).valueRanges||[];
  const columns=(values[0]&&values[0].values||[])[0]||[];
  const sourceRows=applicationIndex>=0&&values[applicationIndex]?values[applicationIndex].values||[]:[];
  const expectedPeriod=period==='CTSO'?'CTSO':'Period '+period;
  const applications=sourceRows.filter(row=>String(row[2]||'').trim()===expectedPeriod);
  const savedReviews=reviewIndex>=0&&values[reviewIndex]?values[reviewIndex].values||[]:[];
  const reviewMap=new Map(savedReviews.map(row=>[row[0],row]));
  const reviews=applications.map(row=>hiringReview_(row,reviewMap.get(hiringKey_(row))));
  const team=teamIndex>=0&&values[teamIndex]?values[teamIndex].values||[]:[];
  const candidates=teamIndex>=0?rows_(period).filter(row=>districtEmail_(row[1])).map(row=>({name:row[0],email:row[1]})):[];
  return {status:200,division:period==='CTSO'?'NEST Robotics':'Division '+period,canManage:access.canManage,columns,applications,reviews,team,positions:hiringPositions_(period),candidates,page,hasMore:end<apps.properties.gridProperties.rowCount&&sourceRows.length===100};
}
function hiringTeamMutation_(email,r,partner) {
 if(!HIRING_PERIODS.includes(r.period)||typeof r.position!=='string'||!r.position||r.position.length>100||
  !districtEmail_(r.studentEmail)||(!partner&&(!Number.isInteger(r.row)||r.row<3||r.row>10000||typeof r.expectedName!=='string'||r.expectedName.length>100||typeof r.expectedEmail!=='string'||r.expectedEmail.length>254)))return {status:400};
 const leaders=hiringRows_();
 if(!hiringPermissions_(email,r.period,leaders).canManage)return {status:403};
 const workbook=hiringWorkbook_(r.period),roster=rows_(r.period).filter(row=>email_(row[1])===email_(r.studentEmail));
 if(roster.length!==1)return {status:400};
 const name=String(roster[0][0]||'').trim(),studentEmail=email_(roster[0][1]);
 if(!name||name.length>100)return {status:400};
 const detail=Sheets.Spreadsheets.get(workbook,{ranges:["'Division Team'!B3:C3"],fields:'sheets(properties(sheetId,title,gridProperties(rowCount)),data(rowData(values(dataValidation))))'});
 const sheet=(detail.sheets||[]).find(item=>item.properties.title==='Division Team');
 if(!sheet)return {status:404};
 const max=sheet.properties.gridProperties.rowCount;
 const team=Sheets.Spreadsheets.Values.get(workbook,"'Division Team'!B3:D"+max,{valueRenderOption:'FORMATTED_VALUE'}).values||[];
 if(!team.some(row=>String(row[0]||'')===r.position)&&!hiringPositions_(r.period).includes(r.position))return {status:400};
 const already=team.some(row=>String(row[0]||'')===r.position&&email_(row[2])===studentEmail);
 if(partner&&already){hiringRefreshLeadership_(r.period,workbook,team,leaders);return {status:200,name,email:studentEmail,unchanged:true};}
 let row=r.row;
 if(partner){
  // Reuse an empty slot for this role; otherwise append without a per-role cap.
  const vacant=team.findIndex(item=>(String(item[0]||'')===r.position||!item[0])&&!item[1]&&!item[2]);
  row=vacant>=0?vacant+3:Math.max(3,team.length+3);
 }else{
  const current=team[row-3]||[];
  if(String(current[0]||'')===r.position&&String(current[1]||'')===name&&email_(current[2])===studentEmail){hiringRefreshLeadership_(r.period,workbook,team,leaders);return {status:200,name,email:studentEmail,unchanged:true};}
  if(String(current[0]||'')!==r.position||String(current[1]||'')!==r.expectedName||email_(current[2])!==email_(r.expectedEmail))return {status:409};
  if(already&&email_(current[2])!==studentEmail)return {status:409};
 }
 const requests=[],sheetId=sheet.properties.sheetId;
 if(row>max)requests.push({appendDimension:{sheetId,dimension:'ROWS',length:Math.max(20,row-max)}});
 if(partner)requests.push({copyPaste:{source:{sheetId,startRowIndex:2,endRowIndex:3,startColumnIndex:1,endColumnIndex:4},destination:{sheetId,startRowIndex:row-1,endRowIndex:row,startColumnIndex:1,endColumnIndex:4},pasteType:'PASTE_FORMAT'}});
 const rules=sheet.data&&sheet.data[0]&&sheet.data[0].rowData&&sheet.data[0].rowData[0]&&sheet.data[0].rowData[0].values||[];
 const positionRule=rules[0]&&rules[0].dataValidation;
 if(partner&&positionRule)requests.push({setDataValidation:{range:{sheetId,startRowIndex:row-1,endRowIndex:row,startColumnIndex:1,endColumnIndex:2},rule:positionRule}});
 const nameRule=rules[1]&&rules[1].dataValidation;
 if(nameRule&&nameRule.condition.type==='ONE_OF_LIST'){
  const options=[...new Set([...nameRule.condition.values.map(value=>value.userEnteredValue),name])].filter(Boolean).sort();
  requests.push({setDataValidation:{range:{sheetId,startRowIndex:row-1,endRowIndex:row,startColumnIndex:2,endColumnIndex:3},rule:{condition:{type:'ONE_OF_LIST',values:options.map(value=>({userEnteredValue:value}))},strict:true,showCustomUi:true}}});
 }
 const literal=value=>({userEnteredValue:{stringValue:String(value)}});
 requests.push({updateCells:{start:{sheetId,rowIndex:row-1,columnIndex:1},rows:[{values:[r.position,name,studentEmail].map(literal)}],fields:'userEnteredValue'}});
 team[row-3]=[r.position,name,studentEmail];
 // Keep the original exported team columns in step with the website assignments.
 requests.push({updateCells:{range:{sheetId,startRowIndex:2,endRowIndex:Math.max(max,row),startColumnIndex:5,endColumnIndex:8},rows:team.map(item=>({values:[item[0]||'',item[1]||'',item[2]||''].map(literal)})),fields:'userEnteredValue'}});
 Sheets.Spreadsheets.batchUpdate({requests},workbook);
 hiringRefreshLeadership_(r.period,workbook,team,leaders);
 return {status:200,name,email:studentEmail};
}
function hiringAssign_(email,r){return hiringTeamMutation_(email,r,false);}
function hiringPartner_(email,r){return hiringTeamMutation_(email,r,true);}
function hiringRefreshLeadership_(period,workbook,team,leaders){
 const remaining=leaders.filter(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()!==period);
 const periodName=period==='CTSO'?'CTSO':'Period '+period;
 const updated=remaining.concat(team.filter(row=>row[0]&&row[1]&&row[2]).map(row=>[periodName,'https://docs.google.com/spreadsheets/d/'+workbook+'/edit',...row]));
 const detail=Sheets.Spreadsheets.get(LEADERSHIP_DATABASE,{fields:'sheets(properties(sheetId,title,gridProperties(rowCount)))'});
 const sheet=detail.sheets.find(item=>item.properties.title==='Imported'),max=sheet.properties.gridProperties.rowCount;
 const requests=[];
 if(updated.length+1>max)requests.push({appendDimension:{sheetId:sheet.properties.sheetId,dimension:'ROWS',length:updated.length+1-max}});
 requests.push({updateCells:{range:{sheetId:sheet.properties.sheetId,startRowIndex:1,endRowIndex:Math.max(max,updated.length+1),startColumnIndex:1,endColumnIndex:6},rows:updated.map(row=>({values:row.map((value,index)=>({userEnteredValue:{stringValue:String(value||'')},...(index===3&&districtEmail_(row[4])?{textFormatRuns:[{startIndex:0,format:{link:{uri:'mailto:'+email_(row[4])}}}]}:{})}))})),fields:'userEnteredValue,textFormatRuns'}});
 Sheets.Spreadsheets.batchUpdate({requests},LEADERSHIP_DATABASE);
}
function hiringSaveReview_(email,r){
 if(!HIRING_PERIODS.includes(r.period)||!/^[a-f0-9]{64}$/.test(r.key||'')||!/^[a-f0-9]{64}$/.test(r.revision||'')||typeof r.notes!=='string'||r.notes.length>5000||!hiringScores_(r.scores))return {status:400};
 if(!hiringPermissions_(email,r.period).canManage)return {status:403};
 const workbook=hiringWorkbook_(r.period),info=Sheets.Spreadsheets.get(workbook,{fields:'sheets(properties(sheetId,title,gridProperties(rowCount)))'});
 const apps=info.sheets.find(item=>item.properties.title==='Applications'),reviewTab=info.sheets.find(item=>item.properties.title==='NEST Interview Reviews');
 if(!apps)return {status:404};
 const ranges=["'Applications'!A2:H"+apps.properties.gridProperties.rowCount];
 if(reviewTab)ranges.push("'NEST Interview Reviews'!A2:D"+reviewTab.properties.gridProperties.rowCount);
 const values=Sheets.Spreadsheets.Values.batchGet(workbook,{ranges,valueRenderOption:'FORMATTED_VALUE'}).valueRanges||[];
 const applications=values[0]&&values[0].values||[],saved=values[1]&&values[1].values||[];
 const matches=applications.map((row,index)=>({row,index})).filter(item=>hiringKey_(item.row)===r.key&&String(item.row[2]||'').trim()===(r.period==='CTSO'?'CTSO':'Period '+r.period));
 if(matches.length!==1)return {status:409};
 const savedIndex=saved.findIndex(row=>row[0]===r.key);
 const current=hiringReview_(matches[0].row,saved[savedIndex]);
 if(current.revision!==r.revision)return {status:409};
 const requests=[],sheetId=reviewTab?reviewTab.properties.sheetId:987654321;
 const literal=value=>({userEnteredValue:{stringValue:String(value)}});
 if(!reviewTab){
  requests.push({addSheet:{properties:{sheetId,title:'NEST Interview Reviews',hidden:true,gridProperties:{rowCount:1000,columnCount:4}}}});
  requests.push({updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[{values:['Application key','Interview ratings','Updated at','Updated by'].map(literal)}],fields:'userEnteredValue'}});
 }
 const reviewRow=savedIndex>=0?savedIndex+1:saved.length+1;
 if(reviewTab&&reviewRow>=reviewTab.properties.gridProperties.rowCount)requests.push({appendDimension:{sheetId,dimension:'ROWS',length:100}});
 requests.push({updateCells:{start:{sheetId:apps.properties.sheetId,rowIndex:matches[0].index+1,columnIndex:7},rows:[{values:[literal(r.notes)]}],fields:'userEnteredValue'}});
 requests.push({updateCells:{start:{sheetId,rowIndex:reviewRow,columnIndex:0},rows:[{values:[r.key,JSON.stringify(r.scores),new Date().toISOString(),email_(email)].map(literal)}],fields:'userEnteredValue'}});
 Sheets.Spreadsheets.batchUpdate({requests},workbook);
 return {status:200,revision:hiringHash_([r.notes,r.scores])};
}


// Bounded, content-free service fault categories for the owner diagnostic.
function nestServiceFailure_(action,error){
 const message=String(error&&error.message||''),code=/quota|too many times|rate.?limit|RESOURCE_EXHAUSTED/i.test(message)?'school-quota':/permission|denied|authorized|forbidden/i.test(message)?'school-permission':error&&error.name==='ReferenceError'?'school-reference':/timed? out|timeout/i.test(message)?'school-timeout':'school-service';
 try{PropertiesService.getScriptProperties().setProperty('nest-service-fault:'+action,JSON.stringify({action,code,time:new Date().toISOString()}));}catch(_){}
 return {status:503,code};
}
