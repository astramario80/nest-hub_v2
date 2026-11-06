// Verified email-code access is separate from NEST leadership/student accounts.
function serviceIntakeEmail_(value){
 const address=email_(value);return address.length<=254&&/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(address)?address:'';
}
function serviceIntakeFields_(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const limits={name:200,phone:80,room:120,category:120,description:4000,attachment:2000},fields={};
 for(const key of Object.keys(limits)){if(typeof value[key]!=='string'||value[key].length>limits[key]||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value[key]))return null;fields[key]=value[key].trim();}
 if(!fields.name||!fields.room||!fields.category||!fields.description||!['1','2','3','4','5'].includes(value.urgency))return null;
 if(fields.attachment&&!fields.attachment.split(/\r?\n/).every(url=>/^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)[a-zA-Z0-9_-]+[^\s<>"']*$/.test(url.trim())))return null;
 if(value.client!=null){const c=value.client;if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.name!=='string'||!c.name.trim()||c.name.length>200||!serviceIntakeEmail_(c.email)||typeof c.address!=='string'||c.address.length>500||/[\u0000-\u001f\u007f]/.test(c.name+c.address))return null;fields.client={name:c.name.trim(),email:serviceIntakeEmail_(c.email),address:c.address.trim()};}
 fields.phone=typeof servicePhone_==='function'?servicePhone_(fields.phone):fields.phone;fields.urgency=value.urgency;return fields;
}
function serviceIntakeDispatch_(r,store){
 const now=Date.now(),hex=value=>/^[a-f0-9]{64}$/.test(value||'');
 if(r.action==='service-client-code-request'){
  const email=serviceIntakeEmail_(r.email);if(!email||!hex(r.challenge)||!hex(r.ip)||!/^\d{6}$/.test(r.code||''))return {status:400};
  const lock=LockService.getScriptLock();if(!lock.tryLock(3000))return {status:503};
  try{
   if(!rate_(store,'service-intake:email:'+hash_(email),5,3600000,now)||!rate_(store,'service-intake:ip:'+r.ip,300,3600000,now)||!rate_(store,'service-intake:cooldown:'+hash_(email),1,60000,now))return {status:429};
   if(Number(store.getProperty('service-intake:cleanup')||0)<now-3600000){
    store.setProperty('service-intake:cleanup',String(now));const props=store.getProperties();
    Object.keys(props).filter(k=>k.startsWith('service-intake:')&&k!=='service-intake:cleanup'||k.startsWith('service-session:')).forEach(k=>{try{if(JSON.parse(props[k]).expires<=now)store.deleteProperty(k);}catch(_){store.deleteProperty(k);}});
   }
   store.setProperty('service-intake:code:'+hash_(r.challenge),JSON.stringify({email,digest:hash_(r.challenge+':'+r.code),attempts:0,expires:now+600000}));
  }finally{lock.releaseLock();}
  nestAccountMail_(r,{to:email,subject:'Your NEST service request sign-in code',body:'Your NEST service request code is '+r.code+'. It expires in 10 minutes. Enter it only at https://gknest.org/service. This signs you in to request service and view requests for this email address. If you did not request it, ignore this message.',htmlBody:'<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><a href="https://gknest.org/service"><img alt="NEST" src="https://gknest.org/assets/nest-service-banner.png" style="width:100%"></a><h1>Your service request sign-in code</h1><p>Enter this code at <a href="https://gknest.org/service">NEST Service</a>:</p><p style="font-size:32px;letter-spacing:6px">'+r.code+'</p><p>Expires in 10 minutes. If you did not request this code, ignore this message.</p></div>'});
  return {status:200};
 }
 if(r.action==='service-client-code-verify'){
  if(!hex(r.challenge)||!hex(r.session)||!/^\d{6}$/.test(r.code||''))return {status:400};
  const lock=LockService.getScriptLock();if(!lock.tryLock(3000))return {status:503};
  try{
   const key='service-intake:code:'+hash_(r.challenge),challenge=read_(store,key,now);if(!challenge||!serviceIntakeEmail_(challenge.email))return {status:401};
   if(challenge.attempts>=5){store.deleteProperty(key);return {status:429};}
   challenge.attempts++;
   if(challenge.digest!==hash_(r.challenge+':'+r.code)){store.setProperty(key,JSON.stringify(challenge));return {status:401};}
   // Consuming the challenge and session rotation happen under the same lock.
   store.setProperty('service-session:'+hash_(r.session),JSON.stringify({email:challenge.email,method:'email-code',expires:now+28800000}));store.deleteProperty(key);
   if(hex(r.previous)&&r.previous!==r.session)store.deleteProperty('service-session:'+hash_(r.previous));
   return {status:200,email:challenge.email};
  }finally{lock.releaseLock();}
 }
 if(r.action!=='service-client-submit')return {status:400};
 const session=serviceClientSession_(r,store);if(!session||!serviceIntakeEmail_(session.email))return {status:401};
 const fields=serviceIntakeFields_(r.fields),attachmentIds=r.attachmentIds||[];if(!/^[a-f0-9-]{36}$/.test(r.id||'')||!fields||!Array.isArray(attachmentIds)||attachmentIds.length>5||new Set(attachmentIds).size!==attachmentIds.length||attachmentIds.some(id=>!serviceMediaId_(id)))return {status:400};
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
 try{
  const state=serviceRead_(),digest=hash_(JSON.stringify(attachmentIds.length?{fields,attachmentIds}:fields)),existing=state.requests.find(item=>item.id===r.id);
  if(existing){const event=state.events.find(e=>e[1]===r.id&&e[2]==='submission');return event?.[3]===session.email&&event?.[9]===digest?{status:200,id:existing.id,replayed:true,notificationQueued:event[7]==='queued'}:{status:409};}
  let files;try{files=attachmentIds.length?serviceMediaForSubmission_(r.id,session.email,attachmentIds,store):[];}catch(error){if(error.message==='UPLOAD_NOT_READY')return {status:425};throw error;}
  if(!rate_(store,'service-intake:submit:'+hash_(session.email),10,3600000,now))return {status:429};
  const tab=state.tabs.find(t=>t.title==='ServiceRequests'),c=serviceColumns_(tab.headers),raw=tab.headers.map(()=>'');
  const set=(column,value)=>{if(column>=0)raw[column]=value;};
  set(c.id,r.id);set(c.status,'New!');set(c.created,new Date(now).toISOString());set(c.email,fields.client?.email||session.email);set(c.name>=0?c.name:c.fallbackName,fields.client?.name||fields.name);set(c.phone,fields.phone);set(c.room,fields.room);set(c.category,fields.category);set(c.urgency,Number(fields.urgency));set(c.description,fields.description);set(c.attachment,[...fields.attachment.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),...files.map(file=>serviceMediaURL_(file))].join(', '));
  const queue=state.tabs.find(t=>t.title==='EmailQueue'),recipients=[...new Set(serviceLeaders_().filter(row=>['division manager','assistant manager','director of client relations','client relations director'].includes(String(row[2]||'').trim().toLowerCase().replace(/\s+/g,' '))).map(row=>serviceIntakeEmail_(row[4])).filter(address=>address&&/@(students\.)?bethelsd\.org$/.test(address)))];
  const queued=Boolean(queue&&recipients.length),stamp=new Date(now).toISOString();
  const commands=[serviceAppend_(tab,raw),serviceAppend_(state.logTab,[stamp,r.id,'submission',session.email,'New!','Service request submitted',r.id,queued?'queued':'saved','',digest])];
  if(fields.client)commands.push(serviceAppend_(state.logTab,[stamp,r.id,'submission-identity',session.email,'New!','Submitted on behalf of a client',Utilities.getUuid(),'','',JSON.stringify({submitterName:fields.name,submitterEmail:session.email,clientName:fields.client.name,clientEmail:fields.client.email,clientAddress:fields.client.address})]));
  if(files.length)commands.push(serviceAppend_(state.logTab,[stamp,r.id,'attachments',session.email,'New!','Photos and videos attached',r.id,'saved','',JSON.stringify(files)]));
  if(queued){
   const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const subject=(Number(fields.urgency)>=4?'URGENT: ':'')+'New Service Request — '+(fields.client?.name||fields.name);
   const html='<a href="https://gknest.org/service"><img src="https://gknest.org/assets/nest-service-banner.png" alt="NEST" style="max-width:600px;width:100%"></a><h2>New service request '+escape(r.id.slice(0,8).toUpperCase())+'</h2><p>Client: '+escape(fields.client?.name||fields.name)+' ('+escape(fields.client?.email||session.email)+')<br>Submitted by: '+escape(fields.name)+' ('+escape(session.email)+')<br>Room: '+escape(fields.room)+'<br>Category: '+escape(fields.category)+'<br>Urgency: '+escape(fields.urgency)+'/5</p><p style="white-space:pre-wrap">'+escape(fields.description)+'</p><p><a href="https://gknest.org/service/management">Open Client Relations to assign a project manager</a></p>';
   commands.push(serviceAppend_(queue,['Pending',recipients.join(','),subject,html,'',0,'✉️',stamp,'']));
  }
  // Ticket, audit event and existing notification queue commit atomically. The UUID
  // makes retrying an uncertain response safe without creating another request/email.
  Sheets.Spreadsheets.batchUpdate({requests:commands},SERVICE_SOURCE);
  if(typeof serviceDriveTrySync_==='function')serviceDriveTrySync_(r.id);return {status:200,id:r.id,notificationQueued:queued};
 }finally{lock.releaseLock();}
}

function serviceIntakeDirectory_(r,store){
 const session=r.action==='auth-service-directory'?authSession_(r.session,store,Date.now()):serviceClientSession_(r,store);if(!session)return {status:401};
 if(!/@(students\.)?bethelsd\.org$/.test(session.email)&&!(r.action==='auth-service-directory'&&OWNER_EMAILS.includes(email_(session.email))))return {status:200,staff:[]};
 try{const staff=labParseStaff_(Sheets.Spreadsheets.Values.get(LAB_STAFF_BOOK,"'Shared_data'!A1:D1001").values||[]).map(({name,email})=>({name,email}));return {status:200,staff};}catch(_){return {status:200,staff:[],directoryUnavailable:true};}
}
