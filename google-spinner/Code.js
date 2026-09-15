// Server-only roster service. No public route accepts spreadsheet IDs.
const PERIODS = {
  '1': '1QDEskd_kKvtjUoLuWnKicsNqhy6ElubA70vaX7OmQzc',
  '2': '1bizUxDzZbJyEnu4sCU3Z33U_SdT_Iz3Ln-LeO7hc21Y',
  '3': '1Ycdle_67UhmlyUd0brcbKrYCP2pYjPeiNzsyikxlK70',
  '4': '1dQUtAsQtmx_srX9JqOaQ6KevW_Id2S0Ywvn33vPbgxE',
  '5': '1ShuqoqtcNNY-o4suHdxn0lbI1aoJ-nTqzq3-VIt3_ik',
  '7': '1yqniHZOhh8ct7_RF1WB8b8Wv_r2OmGIz029h6yexGRA'
};
const BRIDGE_DIGEST = 'fa73c87e353c83d23f5a447adf018eda6be9a8096a6d84e03318eb8833f984cf';
function hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>('0'+(b&255).toString(16)).slice(-2)).join(''); }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return json_({status:401}); }
function doPost(e) {
  let r;
  try { r=JSON.parse(e.postData.contents); } catch (_) { return json_({status:400}); }
  if(typeof r.token!=='string' || hash_(r.token)!==BRIDGE_DIGEST) return json_({status:401});
  if(!Object.prototype.hasOwnProperty.call(PERIODS,r.period)) return json_({status:400});
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000)) return json_({status:503});
  try { return json_(dispatch_(r)); }
  catch (_) { return json_({status:503}); }
  finally { lock.releaseLock(); }
}
function rows_(period) {
  return Sheets.Spreadsheets.Values.get(PERIODS[period],"'Period "+period+"'!A6:B").values || [];
}
function authorized_(rows,email) { return rows.some(row=>String(row[1]||'').trim().toLowerCase()===email); }
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
    Object.keys(all).forEach(key=>{if(key!=='cleanup' && JSON.parse(all[key]).expires<=now) store.deleteProperty(key);});
    store.setProperty('cleanup',String(now));
  }
  if(r.action==='request') {
    const email=String(r.email||'').trim().toLowerCase();
    if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || email.length>254 || !/^[a-f0-9]{64}$/.test(r.challenge||'') || !/^\d{6}$/.test(r.code||'') || !/^[a-f0-9]{64}$/.test(r.ip||'')) return {status:400};
    // Fixed global limit bounds state growth from arbitrary addresses/IPs.
    if(!rate_(store,'global',1000,3600000,now) || !rate_(store,'ip:'+r.ip,60,3600000,now)) return {status:429};
    const key='email:'+hash_(email);
    if(!rate_(store,key,5,3600000,now) || !rate_(store,'cooldown:'+hash_(email),1,60000,now)) return {status:200};
    const rows=rows_(r.period);
    if(!authorized_(rows,email)) return {status:200};
    if(MailApp.getRemainingDailyQuota()<1) return {status:503};
    const challengeKey='challenge:'+hash_(r.challenge);
    store.setProperty(challengeKey,JSON.stringify({email,period:r.period,digest:hash_(r.challenge+':'+r.code),attempts:0,expires:now+600000}));
    try {
      MailApp.sendEmail({to:email,name:'gk NEST™',subject:'Your NEST™ Period '+r.period+' access code',
        body:'Your Period '+r.period+' code is '+r.code+'. It expires in 10 minutes. Enter it only at https://gknest.org/sops. Access lasts 6 hours. If you did not request this, ignore this email.',
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
    store.deleteProperty(key); // Single use, also across concurrent requests.
    const rows=rows_(r.period);
    if(!authorized_(rows,c.email)) return {status:401};
    const session={email:c.email,period:r.period,expires:now+21600000};
    store.setProperty('session:'+hash_(r.session),JSON.stringify(session));
    return {status:200,expires:session.expires,names:rows.map(row=>String(row[0]||'').trim()).filter(Boolean)};
  }
  if(r.action==='roster' || r.action==='logout') {
    if(!/^[a-f0-9]{64}$/.test(r.session||'')) return {status:401};
    const key='session:'+hash_(r.session),s=read_(store,key,now);
    if(!s || s.period!==r.period) return {status:401};
    if(r.action==='logout') {store.deleteProperty(key);return {status:200};}
    const rows=rows_(r.period);
    if(!authorized_(rows,s.email)) {store.deleteProperty(key);return {status:401};}
    return {status:200,expires:s.expires,names:rows.map(row=>String(row[0]||'').trim()).filter(Boolean)};
  }
  return {status:400};
}
function emailHtml_(period,code) {
  return '<div style="max-width:560px;margin:auto;font-family:Arial,sans-serif;color:#18233b">'+
    '<a href="https://gknest.org" style="display:block;background:#121827;padding:24px;text-align:center;color:white;text-decoration:none">'+
    '<img src="https://gknest.org/assets/nest_logo_dark_background.png" width="480" alt="gk NEST™ — Never leave an Eagle behind" style="display:block;width:100%;max-width:480px;height:auto;margin:auto;border:0">'+
    '<strong style="display:block;margin-top:12px">gk NEST™</strong></a>'+
    '<div style="padding:28px"><h1 style="font-size:24px">Period '+period+' access</h1><p>Enter this code in the Magic Spinner:</p>'+
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
