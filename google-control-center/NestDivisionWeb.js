// Adds a protected website entry point; the existing sheet menus and switch
// continue to call updateManagerSlides unchanged.
const NEST_WEB_DIGEST='fa73c87e353c83d23f5a447adf018eda6be9a8096a6d84e03318eb8833f984cf';
const NEST_WEB_PERIODS=['1','2','3','4','5','7','CTSO'];
function nestWebJson_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function nestWebAllowed_(email,period){
 email=String(email||'').trim().toLowerCase();
 if(!email)return false;
 if(['mpenalver@bethelsd.org','mario@memberhq.net'].includes(email))return true;
 if(!nestSlideRoster_(period).has(email))return false;
 const imported=SpreadsheetApp.openById('1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I').getSheetByName('Imported');
 const rows=imported.getRange(2,2,Math.max(1,imported.getLastRow()-1),5).getValues();
 return rows.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&String(row[4]||'').trim().toLowerCase()===email&&
 (period==='CTSO'?/^(chief executive officer|executive vice-president)$/i:/^(division manager|assistant manager)$/i).test(String(row[2]||'').trim()));
}
function authorizeNestDivisionWeb(){
 // Authorizes the queue worker, without changing a deck or its sharing.
 DriveApp.getFolderById('1JIjmW9E7Z0im8udvmdTksNdrb7NSjD5k').getName();
 SlidesApp.openById('1gqZ-iyiFJy16NpoEtw4bFOoTl39778Gdy4DriRw0mI8').getSlides().length;
 const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='nestDivisionSlidesWorker');
 if(!triggers.length)ScriptApp.newTrigger('nestDivisionSlidesWorker').timeBased().everyMinutes(1).create();
 return {ready:true};
}
function doGet(){return nestWebJson_({status:401});}
function doPost(e){
 try{
  const r=JSON.parse(e.postData.contents);
  const digest=typeof r.token==='string'?Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,r.token).map(b=>('0'+(b&255).toString(16)).slice(-2)).join(''):'';
  if(digest!==NEST_WEB_DIGEST)return nestWebJson_({status:401});
  if(r.operation==='sync-access'){
   if(!NEST_WEB_PERIODS.includes(r.period))return nestWebJson_({status:400});
   PropertiesService.getScriptProperties().setProperty('nest-hiring-access:'+r.period,Utilities.getUuid());
   return nestWebJson_({status:200});
  }
  if(r.operation==='health')return nestWebJson_({status:200,ready:ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='nestDivisionSlidesWorker')});
  if(!NEST_WEB_PERIODS.includes(r.period)||!['start','status'].includes(r.operation)||!/^[a-f0-9-]{36}$/.test(r.job||''))return nestWebJson_({status:400});
  if(!nestWebAllowed_(r.email,r.period))return nestWebJson_({status:403});
  const store=PropertiesService.getScriptProperties(),key='nest-slide-job:'+r.job;
  if(r.operation==='status'){
   const raw=store.getProperty(key),job=raw&&JSON.parse(raw);
   return nestWebJson_(job&&job.period===r.period?nestWebResult_(job):{status:404});
  }
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='nestDivisionSlidesWorker'))return nestWebJson_({status:503});
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return nestWebJson_({status:503});
  try{
   const existing=store.getProperty(key);
   if(existing){const job=JSON.parse(existing);return nestWebJson_(job.period===r.period?nestWebResult_(job):{status:409});}
   const jobs=store.getProperties(),now=Date.now();
   for(const name of Object.keys(jobs).filter(name=>name.startsWith('nest-slide-job:'))){
    const job=JSON.parse(jobs[name]);
    if(['queued','running'].includes(job.state)&&job.period===r.period)return nestWebJson_({status:409});
    if(now-job.updatedAt>86400000)store.deleteProperty(name);
   }
   const job={job:r.job,period:r.period,email:r.email,state:'queued',updatedAt:now};
   store.setProperty(key,JSON.stringify(job));return nestWebJson_(nestWebResult_(job));
  }finally{lock.releaseLock();}
 }catch(error){console.error('NEST slide queue request failed');return nestWebJson_({status:503});}
}
function nestWebResult_(job){return {status:200,job:job.job,state:job.state,updatedAt:job.updatedAt};}
function nestDivisionSlidesWorker(){
 const store=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();
 if(!lock.tryLock(1000))return;
 try{
  const jobs=Object.entries(store.getProperties()).filter(([key])=>key.startsWith('nest-slide-job:')).map(([key,raw])=>({key,...JSON.parse(raw)}));
  const now=Date.now();
  // A terminated execution must not leave the division locked indefinitely.
  for(const job of jobs.filter(job=>job.state==='running'&&now-job.updatedAt>600000)){
   job.state='failed';job.updatedAt=now;store.setProperty(job.key,JSON.stringify(job));
  }
  if(jobs.some(job=>job.state==='running'))return;
  const pending=Object.keys(store.getProperties()).find(key=>key.startsWith('nest-hiring-access:'));
  if(pending){const revision=store.getProperty(pending);nestSyncDivisionSlideAccess(pending.split(':')[1]);if(store.getProperty(pending)===revision)store.deleteProperty(pending);return;}
  const job=jobs.filter(job=>job.state==='queued').sort((a,b)=>a.updatedAt-b.updatedAt)[0];if(!job)return;
  job.state='running';job.updatedAt=now;store.setProperty(job.key,JSON.stringify(job));
  try{
   // Recheck the live role when work begins, even if it changed while queued.
   if(!nestWebAllowed_(job.email,job.period))throw new Error('Role changed');
   updateManagerSlides(job.period==='CTSO'?'CTSO':'Division '+job.period, true);
   SpreadsheetApp.openById('1GYT_Of3ioinTXbpzjVCLUjr1rxvnrjjCD_kYMVUfqto').getSheetByName(job.period==='CTSO'?'CTSO':'Div_'+job.period).getRange('B2').setValue('Slides Updated');
   job.state='completed';
  }catch(error){job.state='failed';console.error('NEST slide update failed',job.period);}
  job.updatedAt=Date.now();store.setProperty(job.key,JSON.stringify(job));
 }finally{lock.releaseLock();}
}
