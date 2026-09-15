// Private tracker files, created by this app. Original spreadsheets are read only during import.
const SCORE_OPTIONS = ['4','3','2','1','NE'];
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
function trackerRole_(email,period) {
  if(globalAccess_(email))return 'administrator';
  // A verified live manager source will replace this fail-closed default before manager editing is enabled.
  return 'student';
}
function trackerView_(data,rows,role,expires,includeArchived=false) {
  const current=rows.map(row=>({id:hash_(email_(row[1])),name:row[0],email:row[1],active:true}));
  const students=includeArchived ? [...current,...(data.students||[]).filter(old=>!current.some(s=>s.id===old.id)).map(old=>({...old,active:false}))] : current;
  const scores={};
  students.forEach(s=>{scores[s.id]={};data.assignments.forEach(a=>{scores[s.id][a.id]=(data.scores[s.id]||{})[a.id]||'';});});
  return {status:200,period:data.period,expires,revision:data.revision,role,students,assignments:data.assignments,scores,completionScores:data.completionScores,updatedAt:data.updatedAt};
}
function trackerDispatch_(r,s,rows,store,now) {
  const role=trackerRole_(s.email,r.period),data=trackerRead_(r.period);
  if(!data)return {status:409,message:'This period is waiting for its initial data import.'};
  if(r.action==='tracker')return trackerView_(data,rows,role,s.expires);
  if(r.action==='export' && role==='administrator')return trackerView_(data,rows,role,s.expires,true);
  if(r.action!=='tracker-update' || !['administrator','manager'].includes(role))return {status:403};
  if(r.revision!==data.revision)return {status:409,message:'Another person saved changes. Refresh the tracker before trying again.'};
  const change=r.change||{};
  if(change.type==='score') {
    if(!SCORE_OPTIONS.includes(change.score) && change.score!=='')return {status:400};
    if(!data.assignments.some(a=>a.id===change.assignment) || !rows.some(row=>hash_(email_(row[1]))===change.student))return {status:400};
    data.scores[change.student]=data.scores[change.student]||{};data.scores[change.student][change.assignment]=change.score;
  } else if(change.type==='assignment') {
    const title=String(change.title||'').trim();if(!title || title.length>100 || data.assignments.length>=100)return {status:400};
    data.assignments.push({id:Utilities.getUuid(),title});
  } else if(change.type==='rename') {
    const a=data.assignments.find(a=>a.id===change.assignment),title=String(change.title||'').trim();
    if(!a || !title || title.length>100)return {status:400};a.title=title;
  } else return {status:400};
  const current=rows.map(row=>({id:hash_(email_(row[1])),name:row[0],email:row[1]}));
  data.students=[...current,...(data.students||[]).filter(old=>!current.some(s=>s.id===old.id))];
  data.revision++;data.updatedAt=now;
  // Keep a bounded audit trail, without copying student names or email addresses into it.
  data.audit=(data.audit||[]).concat({at:now,actor:hash_(s.email),type:change.type,revision:data.revision}).slice(-500);
  trackerSave_(data);return trackerView_(data,rows,role,s.expires);
}
function importTracker_(period) {
  if(trackerFile_(period))throw new Error('Tracker already imported; refusing to overwrite');
  const raw=Sheets.Spreadsheets.Values.get(PERIODS[period],"'Period "+period+"'!A5:W1000").values||[];
  const headers=raw[0]||[],assignments=[];
  for(let col=2;col<headers.length;col++)if(String(headers[col]||'').trim())assignments.push({id:'legacy-'+col,title:String(headers[col]).trim(),sourceColumn:col});
  const scores={},students=[];
  raw.slice(1).forEach(row=>{const email=email_(row[1]);if(!email)return;const id=hash_(email);if(scores[id])throw new Error('Duplicate student email in legacy tracker');students.push({id,name:String(row[0]||'').trim(),email});scores[id]={};assignments.forEach(a=>{scores[id][a.id]=String(row[a.sourceColumn]||'').trim();});});
  const data={schema:1,period,revision:1,assignments:assignments.map(({id,title})=>({id,title})),scores,students,completionScores:null,updatedAt:Date.now(),audit:[]};
  trackerSave_(data);return {period,assignments:data.assignments.length,students:Object.keys(scores).length};
}
