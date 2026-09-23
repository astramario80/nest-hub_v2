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
  if(r.action==='leadership') {try{return json_(leadershipDirectory_());}catch(_){return json_({status:503});}}
  if(!/^auth-/.test(r.action||'') && !Object.prototype.hasOwnProperty.call(PERIODS,r.period)) return json_({status:400});
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000)) return json_({status:503});
  try { return json_(/^auth-/.test(r.action||'') ? authDispatch_(r) : dispatch_(r)); }
  catch (_) { return json_({status:503}); }
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
  if(['roster','tracker','tracker-update','export'].includes(r.action)) {
    const s=authSession_(r.session,store,now);
    if(!s) return {status:401};
    const rows=rows_(r.period);
    if(!authorized_(rows,s.email,r.period)) return {status:403};
    if(['tracker','tracker-update','export'].includes(r.action))return trackerDispatch_(r,s,rows,store,now);
    return {status:200,expires:s.expires,names:rows.map(row=>String(row[0]||'').trim()).filter(Boolean)};
  }
  return {status:400};
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
