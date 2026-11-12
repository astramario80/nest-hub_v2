// Canonical private Google Drive storage. No Drive sharing is granted by this module.
const SAFETY_CURRICULUM_FOLDER='1wg8FNgVX4othd5S3CoaZ8zMyIJwG8I8T';
const SAFETY_PHOTO_TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
var safetyDriveFoldersCache_={};
function safetyDriveRootId_(){return PropertiesService.getScriptProperties().getProperty?.('safety-drive-root')||'';}
function safetyDriveFolder_(parent,key,name){
 const cacheKey=parent+'|'+key;if(safetyDriveFoldersCache_[cacheKey])return safetyDriveFoldersCache_[cacheKey];
 const files=Drive.Files.list({q:"trashed=false and mimeType='application/vnd.google-apps.folder' and "+(parent?"'"+parent+"' in parents and ":'')+"appProperties has {key='nestSafetyFolder' and value='"+key+"'}",fields:'files(id)',pageSize:2}).files||[];if(files.length>1)throw Error('Duplicate Safety folders require review');
 const id=files[0]?.id||Drive.Files.create({name,mimeType:'application/vnd.google-apps.folder',writersCanShare:false,...(parent?{parents:[parent]}:{}),appProperties:{nestSafetyFolder:key}},null,{fields:'id'}).id;
 safetyDriveFoldersCache_[cacheKey]=id;return id;
}
function safetyDriveTerm_(value){const term=/^\d{4}_\d{4}_Tri[123]$/.test(value||'')?value:safetyNoFlyRoster_().trimester;if(!/^\d{4}_\d{4}_Tri[123]$/.test(term))throw Error('Current trimester unavailable');return term;}
function safetyDriveReportFolder_(period,reportId,term,name){
 const root=safetyDriveRootId_();if(!root||!(Drive.Files.get(root,{fields:'parents,trashed'}).parents||[]).includes(SAFETY_CURRICULUM_FOLDER))throw Error('Safety report folder is not in the curriculum folder');
 term=safetyDriveTerm_(term);const year=term.slice(0,9),yearId=safetyDriveFolder_(root,'year-'+year,year),tri=safetyDriveFolder_(yearId,'term-'+term,'Trimester '+term.slice(-1)),division=safetyDriveFolder_(tri,'division-'+term+'-'+period,'Division '+period);
 return safetyDriveFolder_(division,'report-'+reportId,String(name||'Flight report').replace(/[\u0000-\u001f\/\\]/g,' ').slice(0,160)+' · '+reportId.slice(0,8));
}
function safetyDrivePhotoEvent_(events,path){return events.find(e=>e.op==='photo-prepare'&&e.data.path===path);}
function safetyDrivePhotoReady_(event,actor,reportId,allowUnverified){
 const d=event?.data;if(!d||event.actor!==actor||reportId&&d.reportId!==reportId)return null;
 const actual=Drive.Files.get(d.driveId,{fields:'id,size,mimeType,trashed,appProperties'});if(actual.trashed||Number(actual.size)!==d.size||actual.mimeType!==d.type||actual.appProperties?.nestSafetyUploader!==hash_(actor)||!allowUnverified&&actual.appProperties?.nestSafetyVerified!=='1')return null;return d;
}
function safetyDrivePhotoCheck_(access,r,events){
 if(!Array.isArray(r.paths)||r.paths.length>8||new Set(r.paths).size!==r.paths.length||r.paths.some(p=>typeof p!=='string'||!/^safety-media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(p)))return {status:400};
 let total=0,driveBytes=0;const drivePaths=[];for(const path of r.paths){const event=safetyDrivePhotoEvent_(events,path);if(!event){total+=2097152;continue;}const file=safetyDrivePhotoReady_(event,access.email,r.reportId);if(!file)return {status:409,error:'Finish uploading your own photos for this report before submitting.'};total+=file.size;driveBytes+=file.size;drivePaths.push(path);}return total>83886080?{status:400,error:'Choose photos totaling up to 80 MB.'}:{status:200,drivePaths,driveBytes};
}
function safetyDriveUpload_(access,r,book){
 if(!/^[a-f0-9-]{36}$/.test(r.reportId||''))return {status:400};if(!safetyNoFlyRoster_().students.some(s=>s.email===access.email&&s.enrollments.some(e=>e.period===r.period)))return {status:403};
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};try{
  const events=safetyEvents_(book,r.period);
  if(r.operation==='photo-complete'){if(typeof r.path!=='string')return {status:400};const event=safetyDrivePhotoEvent_(events,r.path);if(!event||event.actor!==access.email||event.data.reportId!==r.reportId)return {status:403};const file=safetyDrivePhotoReady_(event,access.email,r.reportId,true);if(!file)return {status:404,error:'This photo has not finished uploading.'};const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.driveId)+'?alt=media',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),Range:'bytes=0-11'},muteHttpExceptions:true});const b=response.getBlob().getBytes().slice(0,12).map(v=>(v+256)%256),type=b.length>=12&&b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.length>=8&&b.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'?'image/png':b.length>=12&&b.slice(0,4).join(',')==='82,73,70,70'&&b.slice(8,12).join(',')==='87,69,66,80'?'image/webp':'';if(![200,206].includes(response.getResponseCode())||type!==file.type)return {status:400,error:'Choose a valid JPG, PNG, or WebP photo.'};const actual=Drive.Files.get(file.driveId,{fields:'appProperties'});Drive.Files.update({appProperties:{...actual.appProperties,nestSafetyVerified:'1'}},file.driveId,null,{fields:'id'});return {status:200,photo:r.path};}
  const f=r.file;if(!f||!/^[a-f0-9-]{36}$/.test(f.id||'')||!Object.prototype.hasOwnProperty.call(SAFETY_PHOTO_TYPES,f.type)||!Number.isSafeInteger(f.size)||f.size<1||f.size>20971520)return {status:400};
  const path='safety-media/'+f.id+'.'+SAFETY_PHOTO_TYPES[f.type],prior=safetyDrivePhotoEvent_(events,path),draft=events.filter(e=>e.op==='photo-prepare'&&e.data.reportId===r.reportId);
  if(events.some(e=>e.op==='submit'&&e.request===r.reportId))return {status:409,error:'This report is already submitted.'};
  if(prior&&(prior.actor!==access.email||prior.data.reportId!==r.reportId||prior.data.size!==f.size||prior.data.type!==f.type))return {status:409};
  if(!prior&&(draft.length>=8||draft.reduce((n,e)=>n+e.data.size,0)+f.size>83886080))return {status:400,error:'Choose up to eight photos totaling 80 MB.'};
  if(!prior&&events.filter(e=>e.op==='photo-prepare'&&e.actor===access.email&&Date.now()-Date.parse(e.time)<86400000).length>=50)return {status:429};
  let d=prior?.data;
  if(!d){const term=safetyNoFlyRoster_().trimester,folder=safetyDriveReportFolder_(r.period,r.reportId,term,safetyDate_(new Date())+' '+access.name+' Post-flight'),photos=safetyDriveFolder_(folder,'photos-'+r.reportId,'Photos');
   const found=Drive.Files.list({q:"trashed=false and appProperties has {key='nestSafetyPhoto' and value='"+f.id+"'}",fields:'files(id,appProperties)',pageSize:2}).files||[];if(found.length>1||found[0]&&(found[0].appProperties?.nestSafetyUploader!==hash_(access.email)||found[0].appProperties?.nestSafetyReport!==r.reportId||found[0].appProperties?.nestSafetyPeriod!==r.period))return {status:409};
   const created=found[0]||Drive.Files.create({name:'Photo '+(draft.length+1)+'.'+SAFETY_PHOTO_TYPES[f.type],mimeType:f.type,parents:[photos],writersCanShare:false,appProperties:{nestSafetyPhoto:f.id,nestSafetyReport:r.reportId,nestSafetyPeriod:r.period,nestSafetyUploader:hash_(access.email),nestSafetySize:String(f.size)}},null,{fields:'id'});
   d={path,reportId:r.reportId,driveId:created.id,size:f.size,type:f.type,term};safetyAppend_(book,r.period,access,{operation:'photo-prepare',requestId:f.id},d,null);
  }
  const event={actor:access.email,data:d};if(safetyDrivePhotoReady_(event,access.email,r.reportId))return {status:200,path,storage:'drive',complete:true};
  const cache=CacheService.getScriptCache(),key='safety-photo-upload:'+d.driveId;let url=cache.get(key);
  if(!url||r.restart===true){const response=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(d.driveId)+'?uploadType=resumable',{method:'patch',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),Origin:'https://gknest.org','X-Upload-Content-Type':d.type,'X-Upload-Content-Length':String(d.size)},contentType:'application/json',payload:'{}',muteHttpExceptions:true});if(response.getResponseCode()!==200)throw Error('Drive upload preparation failed');const headers=response.getAllHeaders();url=headers.Location||headers.location;if(typeof url!=='string'||!/^https:\/\/(?:www\.)?googleapis\.com\/upload\/drive\//.test(url))throw Error('Invalid Drive upload session');cache.put(key,url,1800);}
  return {status:200,path,storage:'drive',uploadUrl:url};
 }finally{lock.releaseLock();}
}
function safetyDriveWrite_(parent,key,name,type,text){const files=Drive.Files.list({q:"trashed=false and '"+parent+"' in parents and appProperties has {key='nestSafetyDocument' and value='"+key+"'}",fields:'files(id)',pageSize:2}).files||[];if(files.length>1)throw Error('Duplicate report documents require review');const blob=Utilities.newBlob(text,type,name);if(files.length)return Drive.Files.update({name,mimeType:type},files[0].id,blob,{fields:'id'});return Drive.Files.create({name,mimeType:type,parents:[parent],writersCanShare:false,appProperties:{nestSafetyDocument:key}},blob,{fields:'id'});}
function safetyDriveArchive_(book,event){
 const report=safetyReport_({owner:true},event.period,book,event),term=safetyDriveTerm_(event.data.trimester),folder=safetyDriveReportFolder_(event.period,event.request,term,safetyDate_(event.time)+' '+report.name+' '+report.kind),photos=[];
 const events=safetyEvents_(book,event.period);if(event.op==='flight-complete'){const draft=safetyDrafts_(events).find(d=>d.id===event.data.id);if(draft)report.fields=SAFETY_FIELDS.filter(f=>f.column>=5&&f.column<=23||[32,36,37].includes(f.column)).map(f=>({label:f.label,value:draft.answers[f.column]||''})).concat(draft.metarObservation?[{label:'METAR flight observations',value:draft.metarObservation}]:[]);}
 for(const path of event.data.photos||[]){const file=safetyDrivePhotoEvent_(events,path)?.data;if(file)photos.push({name:'Aircraft damage photo',driveId:file.driveId,url:'https://drive.google.com/file/d/'+file.driveId+'/view'});else photos.push({name:'Earlier protected attachment',url:'https://gknest.org/api/safety?'+['period='+event.period,'media='+report.photoId,'index='+photos.length].join('&')});}
 const {photoId,...safe}=report,document={...safe,trimester:term,photos,sourceRequestId:event.request};
 const text=['NEST™ Drone Piloting — '+report.kind,'Student: '+report.name,'Division: '+event.period,'School term: '+term,'Submitted (Pacific): '+Utilities.formatDate(new Date(event.time),'America/Los_Angeles','yyyy-MM-dd HH:mm:ss'),'Aircraft: '+(report.aircraft||'—'),...(report.flags||[]).map(f=>'Review: '+f),'',...report.fields.flatMap(f=>[f.label,String(f.value), '']),...photos.map(p=>p.name+': '+p.url),'Source request: '+event.request].join('\n');
 safetyDriveWrite_(folder,event.request+'-text','Flight report.txt','text/plain',text);safetyDriveWrite_(folder,event.request+'-json','Flight report.json','application/json',JSON.stringify(document,null,2));
 safetyAppend_(book,event.period,{email:'system'},{operation:'drive-archived',requestId:Utilities.getUuid()},{reportId:event.request,folderId:folder},null);return folder;
}
// Invoked only by the server's existing signed bridge or the installed script trigger.
function safetyDriveWorker_(r){
 const store=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();if(r.operation==='setup'){if(!lock.tryLock(15000))return {status:503};try{const root=safetyDriveRootId_()||safetyDriveFolder_('','root','Flight Safety Reports');store.setProperty('safety-drive-root',root);return {status:200,folderId:root};}finally{lock.releaseLock();}}
 if(r.operation!=='sync')return {status:400};const root=safetyDriveRootId_();if(!root||!(Drive.Files.get(root,{fields:'parents'}).parents||[]).includes(SAFETY_CURRICULUM_FOLDER))return {status:409};
 if(r.install===true&&!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='SafetyDriveSync'))ScriptApp.newTrigger('SafetyDriveSync').timeBased().everyMinutes(5).create();
 const book=SpreadsheetApp.openById(SAFETY_BOOK),events=safetyAllEvents_(book),done=new Set(events.filter(e=>e.op==='drive-archived').map(e=>e.period+'|'+e.data.reportId)),pending=events.filter(e=>['flight-review','flight-complete','submit'].includes(e.op)&&!done.has(e.period+'|'+e.request));let archived=0,failed=0;const started=Date.now();
 for(const event of pending.slice(0,2)){if(Date.now()-started>25000||!lock.tryLock(1000))break;try{if(!safetyEvents_(book,event.period).some(e=>e.op==='drive-archived'&&e.data.reportId===event.request)){safetyDriveArchive_(book,event);archived++;}}catch(error){failed++;console.error('Safety Drive archive deferred',error.name);}finally{lock.releaseLock();}}
 const legacyPhotoLinks=events.filter(e=>e.op==='submit').flatMap(e=>e.data.photos||[]).filter(path=>!events.some(e=>e.op==='photo-prepare'&&e.data.path===path)).length;return {status:200,folderId:root,archived,failed,pending:pending.length-archived,legacyPhotoLinks};
}
function SafetyDriveSync(){return safetyReadContext_({action:'safety-drive-worker'},()=>safetyDriveWorker_({operation:'sync'}));}
