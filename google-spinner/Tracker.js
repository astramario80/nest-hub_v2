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
  const rows=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
  return rows.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period && ['division manager','assistant manager'].includes(String(row[2]||'').trim().toLowerCase()) && email_(row[4])===email_(email));
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
  if(globalAccess_(email))return 'administrator';
  if(manager_(email,period))return 'manager';
  return editorGrant_(email,period)?'editor':'student';
}
function grantEditor_(r,s,store,now) {
  const authority=globalAccess_(s.email)||manager_(s.email,r.period),parent=authority?null:editorGrant_(s.email,r.period);
  if(!authority&&!parent)return {status:403};
  const email=email_((r.change||{}).email);
  if(email.length>254 || !/^[a-z0-9._%+-]+@(students\.)?bethelsd\.org$/.test(email)||email===email_(s.email))return {status:400};
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
  function view(){const result=trackerView_(data,rows,role,s.expires);if(role==='editor')result.editExpires=editorGrant_(s.email,r.period).expires;
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
    if(!a || !Number.isInteger(width) || width<120 || width>600)return {status:400};a.width=width;
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
