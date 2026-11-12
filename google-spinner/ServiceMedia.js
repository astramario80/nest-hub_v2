// Private website media: upload grants are bound to a verified requester and draft.
const SERVICE_MEDIA_TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/heic':'heic','image/heif':'heif','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','video/mpeg':'mpeg','video/3gpp':'3gp','video/x-m4v':'m4v'};
function serviceMediaId_(value){return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);}
function serviceMediaMeta_(value){
 if(!value||!serviceMediaId_(value.ticketId)||!serviceMediaId_(value.fileId)||typeof value.name!=='string'||!value.name.trim()||value.name.length>180||/[\u0000-\u001f\u007f]/.test(value.name)||!Object.prototype.hasOwnProperty.call(SERVICE_MEDIA_TYPES,value.type)||!Number.isSafeInteger(value.size)||value.size<=0||value.size>104857600)return null;
 const path='service-media/'+value.ticketId+'/'+value.fileId+'.'+SERVICE_MEDIA_TYPES[value.type];if(value.path&&value.path!==path)return null;
 if(value.context!==undefined&&!['ticket','internal','public'].includes(value.context))return null;if(value.context&&value.context!=='ticket'&&!serviceMediaId_(value.entryId))return null;
 if(value.storage!==undefined&&value.storage!=='drive')return null;if(value.storage==='drive'&&(typeof value.driveId!=='string'||!/^[-_a-zA-Z0-9]{10,200}$/.test(value.driveId)))return null;
 return {ticketId:value.ticketId,fileId:value.fileId,name:value.name.trim(),type:value.type,size:value.size,...(value.storage==='drive'?{storage:'drive',driveId:value.driveId,driveUrl:'https://drive.google.com/file/d/'+value.driveId+'/view'}:{}),...(value.context?{context:value.context,...(value.entryId?{entryId:value.entryId}:{})}:{}),path};
}
function serviceMediaURL_(file){return 'https://gknest.org/api/service-attachments?ticket='+file.ticketId+'&file='+file.fileId;}
function serviceMediaFor_(item,events){
 const files=events.filter(e=>e[1]===item.id&&e[2]==='attachments').flatMap(e=>{const parsed=JSON.parse(e[9]||'[]');if(!Array.isArray(parsed))throw Error('Invalid attachment record');return parsed;});
 return files.map(serviceMediaMeta_).filter(file=>file&&file.ticketId===item.id);
}
function serviceMediaRows_(item,events){return serviceMediaFor_(item,events).filter(f=>!f.context||f.context==='ticket').map(file=>({fileId:file.fileId,name:file.name,type:file.type,size:file.size,url:serviceMediaURL_(file),...(file.driveUrl?{driveUrl:file.driveUrl}:{})}));}
function serviceMediaForSubmission_(id,email,ids,store){
 if(!ids.length)return [];
 const grant=read_(store,'service-intake:files:'+id,Date.now());if(!grant||grant.email!==email)throw Error('UPLOAD_NOT_READY');
 const files=ids.map(fileId=>grant.files.find(file=>file.fileId===fileId&&file.complete)).map(serviceMediaMeta_);
 if(files.some(file=>!file||file.ticketId!==id)||files.reduce((n,f)=>n+f.size,0)>262144000)throw Error('UPLOAD_NOT_READY');return files;
}
function serviceMediaDispatch_(r,store){
 if(['auth-service-upload-prepare','auth-service-upload-complete'].includes(r.action))return serviceTeamUpload_(r,store);
 if(r.action==='auth-service-attachment-read'){
  if(!serviceMediaId_(r.ticketId)||!serviceMediaId_(r.fileId))return {status:400};
  const account=authSession_(r.session,store,Date.now()),client=serviceClientSession_({session:r.clientSession},store);if(!account&&!client)return {status:401};
  const state=serviceRead_(),item=state.requests.find(item=>item.id===r.ticketId);if(!item)return {status:404};
  let allowed=Boolean(client&&(typeof serviceIsClient_==='function'?serviceIsClient_(client.email,item,state.events):client.email===item.email))||Boolean(client&&typeof serviceSubmitter_==='function'&&serviceSubmitter_(item,state.events)?.email===client.email);
  if(!allowed&&account){const leaders=serviceLeaders_(),roster=serviceRoster_();allowed=serviceRole_(account.email,leaders)||serviceTicketAccess_(account.email,item,leaders,roster).canEdit;}
  if(!allowed)return {status:403};const file=serviceMediaFor_(item,state.events).find(file=>file.fileId===r.fileId);const team=account&&(serviceRole_(account.email,serviceLeaders_())||serviceTicketAccess_(account.email,item,serviceLeaders_(),serviceRoster_()).canEdit);if(file&&!team&&!serviceMediaVisible_(file,item,state.events))return {status:403};return file?{status:200,file,...(file.storage==='drive'?{readToken:ScriptApp.getOAuthToken()}:{} )}:{status:404};
 }
 const client=serviceClientSession_(r,store);if(!client||!serviceIntakeEmail_(client.email))return {status:401};
 const file=serviceMediaMeta_(r.file);if(!file)return {status:400};
 const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return {status:503};
 try{
  const now=Date.now(),key='service-intake:files:'+file.ticketId,grant=read_(store,key,now)||{email:client.email,files:[],expires:now+86400000};
  if(grant.email!==client.email)return {status:409};
  const existing=grant.files.find(f=>f.fileId===file.fileId);
  if(r.action==='service-client-upload-prepare'){
   if(existing){if(existing.storage==='drive')return serviceDrivePrepare_(file,grant,key,store,r.restart===true);return JSON.stringify(serviceMediaMeta_(existing))===JSON.stringify(file)?{status:200}:{status:409};}
   if(grant.files.length>=5||grant.files.reduce((n,f)=>n+f.size,0)+file.size>262144000)return {status:429};
   const rateKey='service-intake:media-rate:'+hash_(client.email),rate=read_(store,rateKey,now)||{count:0,bytes:0,expires:now+86400000};
   if(rate.count>=50||rate.bytes+file.size>1073741824)return {status:429};rate.count++;rate.bytes+=file.size;store.setProperty(rateKey,JSON.stringify(rate));
   if(r.driveReady===true&&typeof serviceDrivePrepare_==='function')return serviceDrivePrepare_(file,grant,key,store);grant.files.push({...file,complete:false});store.setProperty(key,JSON.stringify(grant));return {status:200};
  }
  if(r.action!=='service-client-upload-complete')return {status:400};
  if(!existing)return {status:404};if(existing.storage==='drive')return serviceDriveComplete_(file,grant,key,store);if(JSON.stringify(serviceMediaMeta_(existing))!==JSON.stringify(file))return {status:409};
  existing.complete=true;store.setProperty(key,JSON.stringify(grant));return {status:200};
 }finally{lock.releaseLock();}
}

function serviceWorkspaceFiles_(item,email,ids,store,context,entryId){
 if(!Array.isArray(ids)||ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>!serviceMediaId_(id)))throw Error('INVALID_MEDIA');if(!ids.length)return [];
 const grant=read_(store,'service-work:files:'+item.id+':'+hash_(email),Date.now()),scoped=typeof serviceDriveGrantStore_==='function'?serviceDriveGrantStore_(store):store;
 const attached=serviceMediaFor_(item,serviceRead_().events),files=ids.map(id=>{const cached=read_(scoped,'service-work:files:'+item.id+':'+hash_(email)+':'+id,Date.now()),file=(grant?.email===email?grant.files:cached?.email===email?cached.files:[]).find(f=>f.fileId===id&&f.complete);if(file)return file;const recovered=typeof serviceDriveFind_==='function'?serviceDriveFind_(item.id,id,email):null;return recovered?.complete?recovered:null;}).map(serviceMediaMeta_);
 if(files.some(f=>!f||f.context!==context||f.entryId!==entryId)||files.reduce((n,f)=>n+f.size,0)>262144000)throw Error('UPLOAD_NOT_READY');return files.filter(f=>!attached.some(a=>a.fileId===f.fileId));
}
function serviceMediaVisible_(file,item,events){return !file.context||file.context==='ticket'||file.context==='public'&&serviceLogEntries_(item,events).some(e=>e.entryId===file.entryId&&!e.publicDeleted);}
function serviceLogMedia_(item,events,entryId,scope){return serviceMediaFor_(item,events).filter(f=>f.entryId===entryId&&f.context===scope).map(f=>({fileId:f.fileId,name:f.name,type:f.type,size:f.size,url:serviceMediaURL_(f),...(f.driveUrl?{driveUrl:f.driveUrl}:{})}));}
function serviceTeamUpload_(r,store){
 const session=authSession_(r.session,store,Date.now());if(!session)return {status:401};const file=serviceMediaMeta_(r.file);if(!file?.context)return {status:400};
 const state=serviceRead_(),item=state.requests.find(x=>x.id===file.ticketId);if(!item)return {status:404};if(!serviceTicketAccess_(session.email,item,serviceLeaders_(),serviceRoster_()).canEdit)return {status:403};
 const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return {status:503};
 const rateStore=store;store=typeof serviceDriveGrantStore_==='function'?serviceDriveGrantStore_(store):store;
 try{const now=Date.now(),key='service-work:files:'+file.ticketId+':'+hash_(session.email)+':'+file.fileId,grant=read_(store,key,now)||{email:session.email,files:[],expires:now+86400000},existing=grant.files.find(f=>f.fileId===file.fileId);
  if(r.action==='auth-service-upload-prepare'){if(!existing){const rateKey='service-work:media-rate:'+hash_(session.email),rate=read_(rateStore,rateKey,now)||{count:0,bytes:0,expires:now+86400000};if(rate.count>=50||rate.bytes+file.size>1073741824)return {status:429};rate.count++;rate.bytes+=file.size;rateStore.setProperty(rateKey,JSON.stringify(rate));}if(!existing&&(grant.files.length>=50||grant.files.reduce((n,f)=>n+f.size,0)+file.size>1073741824))return {status:429};if(r.driveReady===true&&typeof serviceDrivePrepare_==='function'&&(!existing||existing.storage==='drive'))return serviceDrivePrepare_(file,grant,key,store,r.restart===true);if(existing)return JSON.stringify(serviceMediaMeta_(existing))===JSON.stringify(file)?{status:200}:{status:409};if(grant.files.length>=50||grant.files.reduce((n,f)=>n+f.size,0)+file.size>1073741824)return {status:429};grant.files.push({...file,complete:false});}
  else{if(!existing)return {status:404};if(existing.storage==='drive')return serviceDriveComplete_(file,grant,key,store);if(JSON.stringify(serviceMediaMeta_(existing))!==JSON.stringify(file))return {status:409};existing.complete=true;}
  store.setProperty(key,JSON.stringify(grant));return {status:200};
 }finally{lock.releaseLock();}
}
