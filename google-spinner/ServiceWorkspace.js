// Ticket workspace extensions. All mutations recheck live access and ticket revision.
function servicePhone_(value){
 const text=String(value||'').trim();if(!text)return '';const match=text.match(/(?:ext\.?|extension|x|#)\s*(\d{1,8})\s*$/i),ext=match?' x'+match[1]:'',base=match?text.slice(0,match.index):text,digits=base.replace(/\D/g,'');
 if(!digits)return text;const us=digits.length===11&&digits[0]==='1'?digits.slice(1):digits;
 return (us.length===10?'('+us.slice(0,3)+') '+us.slice(3,6)+'-'+us.slice(6):base.trim().startsWith('+')?'+'+digits:digits)+ext;
}
function serviceClients_(item,events){
 const event=events.filter(e=>e[1]===item.id&&e[2]==='clients').slice(-1)[0],extra=event?JSON.parse(event[9]||'[]'):[];
 return [serviceClientContact_(item,events),...extra].filter((c,i,all)=>c.email&&all.findIndex(x=>x.email===c.email)===i);
}
function serviceIsClient_(email,item,events){return serviceClients_(item,events).some(c=>c.email===email);}
function serviceWorkspaceSettings_(item,events){
 const latest=events.filter(e=>e[1]===item.id&&e[2]==='shopping-settings').slice(-1)[0],settings=latest?JSON.parse(latest[9]||'{}'):{};
 const pending=events.filter(e=>e[1]===item.id&&['shopping-visibility-pending','shopping-settings'].includes(e[2])).slice(-1)[0];
 return {inventoryExplicit:Object.prototype.hasOwnProperty.call(settings,'inventoryVisible'),inventoryVisible:settings.inventoryVisible??serviceShoppingRead_(item,events).items.some(x=>x.sentAt),clientPublished:typeof settings.clientPublished==='boolean'?settings.clientPublished:null,pendingVisibility:pending?.[2]==='shopping-visibility-pending'?JSON.parse(pending[9]):null};
}
function serviceWorkspaceAppend_(state,item,email,kind,note,data,extra=[]){
 const now=new Date().toISOString(),event=[now,item.id,kind,email,item.status,note,Utilities.getUuid(),'',item.manager||'',JSON.stringify(data)];
 if(event[9].length>45000)throw Error('Ticket update exceeds capacity');
 const entries=[event,...extra];Sheets.Spreadsheets.batchUpdate({requests:entries.map(e=>serviceAppend_(state.logTab,e))},SERVICE_SOURCE);
 return {item:{...item,version:serviceVersion_(item.raw,entries.slice(-1)[0])},events:[...state.events,...entries]};
}
function serviceWorkspacePublicEvent_(item,email,note){return [new Date().toISOString(),item.id,'update',email,item.status,note,Utilities.getUuid(),'',item.manager||'',''];}
function serviceWorkspaceRow_(item,events,email,leaders,roster){return serviceManagerRow_(item,events,email,leaders,roster);}
function serviceWorkspaceDispatch_(r){
 const store=PropertiesService.getScriptProperties(),clientMode=r.action==='service-client-shopping-action',session=clientMode?serviceClientSession_(r,store):authSession_(r.session,store,Date.now());if(!session)return {status:401};
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
 try{
  let state=serviceRead_(),item=state.requests.find(x=>x.id===r.id);if(!item)return {status:404};
  const leaders=serviceLeaders_(),roster=serviceRoster_();
  if(clientMode?!serviceIsClient_(session.email,item,state.events):!serviceTicketAccess_(session.email,item,leaders,roster).canEdit)return {status:403};
  // A retry first finishes an exact, already-journaled shopping action.
  if(['service-client-shopping-action','auth-service-shopping-reply'].includes(r.action))return serviceWorkspaceItem_(session,r,state,item,clientMode,leaders,roster);
  if(item.version!==r.version)return {status:409,error:'This ticket changed. Refresh before saving.'};
  if(r.action==='auth-service-drive-ensure'){const folder=serviceDriveSync_(item,state.events);return {status:200,request:serviceWorkspaceRow_(item,state.events,session.email,leaders,roster)};}
  if(r.action==='auth-service-details')return serviceWorkspaceDetails_(session,r,state,item,leaders,roster);
  if(r.action==='auth-service-clients'){
   if(!Array.isArray(r.clients)||JSON.stringify(r.clients).length>40000||r.clients.length>150||r.clients.some(c=>!c||typeof c.name!=='string'||!c.name.trim()||c.name.length>200||!serviceClientAddress_(email_(c.email))||typeof (c.address??'')!=='string'||String(c.address??'').length>500||/[\u0000-\u001f\u007f]/.test(c.name+String(c.address??''))))return {status:400,error:'Check each client name and email address.'};
   const clients=r.clients.map(c=>({name:c.name.trim(),email:email_(c.email),address:String(c.address||'').trim()})).filter(c=>c.email!==item.email);if(new Set(clients.map(c=>c.email)).size!==clients.length)return {status:400,error:'Each client email should appear once.'};
   const saved=serviceWorkspaceAppend_(state,item,session.email,'clients','Additional clients updated',clients);if(typeof serviceDriveTrySync_==='function')serviceDriveTrySync_(item.id);return {status:200,request:serviceWorkspaceRow_(saved.item,saved.events,session.email,leaders,roster)};
  }
  if(r.action==='auth-service-shopping-publish'){
   if(typeof r.visible!=='boolean')return {status:400};const settings=serviceWorkspaceSettings_(item,state.events);if(settings.pendingVisibility)return {status:409,error:'Finish the pending Inventory sharing change first.'};
   const saved=serviceWorkspaceAppend_(state,item,session.email,'shopping-settings',r.visible?'Shopping list shared with clients':'Shopping list hidden from clients',{...settings,clientPublished:r.visible},[serviceWorkspacePublicEvent_(item,session.email,r.visible?'The project shopping list is now available below. You can mark items purchased, table an item or ask the team a question.':'The project shopping list is no longer shared in the client view.')]);
   return {status:200,request:serviceWorkspaceRow_(saved.item,saved.events,session.email,leaders,roster)};
  }
  if(r.action==='auth-service-shopping-visibility')return serviceWorkspaceVisibility_(session,r,state,item,leaders,roster);
  return {status:400};
 }finally{lock.releaseLock();}
}
function serviceWorkspaceDetails_(session,r,state,item,leaders,roster){
 const f=r.fields;if(!f||typeof f.phone!=='string'||f.phone.length>80||typeof f.room!=='string'||!f.room.trim()||f.room.length>120||typeof f.category!=='string'||!f.category.trim()||f.category.length>120||typeof f.description!=='string'||!f.description.trim()||f.description.length>4000||!['1','2','3','4','5'].includes(String(f.urgency))||Object.values(f).some(v=>typeof v==='string'&&/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)))return {status:400,error:'Check the ticket details.'};
 const values={phone:servicePhone_(f.phone),room:f.room.trim(),category:f.category.trim(),urgency:String(f.urgency),description:f.description.trim()},raw=[...item.raw],before={};const writes=[];
 for(const [key,value] of Object.entries(values)){if(item.c[key]<0)return {status:428};before[key]=item[key];raw[item.c[key]]=value;writes.push(serviceUpdateCell_(item,item.c[key],value));}
 const fileIds=r.attachmentIds||[],files=serviceWorkspaceFiles_(item,session.email,fileIds,PropertiesService.getScriptProperties(),'ticket');
 const event=[new Date().toISOString(),item.id,'details',session.email,item.status,'Ticket details updated',Utilities.getUuid(),'',item.manager||'',JSON.stringify({before,after:values})],events=[...state.events,event];writes.push(serviceAppend_(state.logTab,event));
 if(files.length){const media=[new Date().toISOString(),item.id,'attachments',session.email,item.status,'Ticket media added',Utilities.getUuid(),'','',JSON.stringify(files)];events.push(media);writes.push(serviceAppend_(state.logTab,media));}
 Sheets.Spreadsheets.batchUpdate({requests:writes},SERVICE_SOURCE);const updated={...item,...values,raw,version:serviceVersion_(raw,events.slice(-1)[0])};return {status:200,request:serviceWorkspaceRow_(updated,events,session.email,leaders,roster)};
}
function serviceWorkspaceVisibility_(session,r,state,item,leaders,roster){
 let settings=serviceWorkspaceSettings_(item,state.events),pending=settings.pendingVisibility;
 if(!pending){
  if(typeof r.visible!=='boolean')return {status:400};
  if(r.visible){const sent=serviceShoppingWrite_(session,{action:'auth-service-shopping-push',id:item.id,version:item.version,token:r.token,shareRequested:true});if(sent.status!==200)return sent;state=serviceRead_();item=state.requests.find(x=>x.id===r.id);settings=serviceWorkspaceSettings_(item,state.events);}
  pending={id:Utilities.getUuid(),visible:r.visible};const started=serviceWorkspaceAppend_(state,item,session.email,'shopping-visibility-pending','Changing Inventory sharing',pending);item=started.item;state={...state,events:started.events};
 }
 const actor=purchasingActor_(session),items=serviceShoppingRead_(item,state.events).items;actor.periods=[...new Set([...actor.periods,...items.map(x=>x.division)].filter(Boolean))];
 let result;try{result=purchasingBudgetRequest_(r.token,actor,'service-visibility',{ticketId:item.id,changeId:pending.id,visible:pending.visible,itemIds:items.filter(x=>x.sentAt).map(x=>x.id)});}catch(_){return {status:503,error:'Sharing could not be confirmed. Refresh and retry this same sharing change.'};}
 if(result.status!==200)return {status:result.status,error:result.error||'Refresh and retry the pending sharing change.'};
 const saved=serviceWorkspaceAppend_(state,item,session.email,'shopping-settings',pending.visible?'Shopping list shared with Inventory':'Shopping list removed from Inventory',{inventoryVisible:pending.visible,clientPublished:settings.clientPublished});return {status:200,request:serviceWorkspaceRow_(saved.item,saved.events,session.email,leaders,roster)};
}
function serviceWorkspaceItem_(session,r,state,ticket,clientMode,leaders,roster){
 let items=serviceShoppingRead_(ticket,state.events).items.map(x=>({...x})),item=items.find(x=>x.id===r.itemId);if(!item)return {status:404};
 const settings=serviceWorkspaceSettings_(ticket,state.events),published=settings.clientPublished===true||settings.clientPublished===null&&item.purchaseRoute==='client';if(clientMode&&!published)return {status:403};if(item.workspaceActions?.includes(r.actionId))return {status:200,request:clientMode?serviceClientRow_(ticket,state.events):serviceWorkspaceRow_(ticket,state.events,session.email,leaders,roster)};if(settings.pendingVisibility)return {status:409,error:'Inventory sharing is being updated. Please retry after it finishes.'};
 let pending=item.workspacePending;
 if(pending){if(clientMode&&pending.actor!==session.email||pending.actionId!==r.actionId)return {status:409,error:'A previous item action is finishing. Retry that action first.'};}
 else {
  if(ticket.version!==r.version)return {status:409,error:'This ticket changed. Refresh before saving your item update.'};
  if(!serviceMediaId_(r.actionId)||typeof r.text!=='string'||r.text.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(r.text))return {status:400};
  if(JSON.stringify(items).length+r.text.length>40000)return {status:400,error:'This list has reached its discussion capacity. Ask the project team to archive completed items.'};
  const action=clientMode?r.change:'answer';if(clientMode&&!['purchased','table','question'].includes(action)||['question','answer'].includes(action)&&!r.text.trim())return {status:400};
  if(item.clientStatus==='purchased'&&action!=='question'&&action!=='answer')return {status:409,error:'This item is already recorded as purchased.'};
  if(item.workspaceActions?.includes(r.actionId))return {status:200,request:clientMode?serviceClientRow_(ticket,state.events):serviceWorkspaceRow_(ticket,state.events,session.email,leaders,roster)};
  pending={id:Utilities.getUuid(),actionId:r.actionId,actor:session.email,name:serviceClients_(ticket,state.events).find(x=>x.email===session.email)?.name||session.username||session.email,action,text:r.text.trim()};item.workspacePending=pending;
  const started=serviceShoppingEvent_(state,ticket,session.email,items,'Started item '+action);ticket=started.item;state={...state,events:started.events};
 }
 if(item.sentAt){
  const actor=clientMode?{email:session.email,name:pending.name,periods:[item.division],admin:false}:purchasingActor_(session);actor.periods=[...new Set([...actor.periods,item.division].filter(Boolean))];
  let result;try{result=purchasingBudgetRequest_(r.token,actor,'service-client-action',{ticketId:ticket.id,itemId:item.id,changeId:pending.id,change:pending.action,text:pending.text});}catch(_){return {status:503,error:'The item action could not be confirmed. Refresh and retry the same action.'};}
  if(result.status!==200){if([400,403,404,409].includes(result.status)){delete item.workspacePending;serviceShoppingEvent_(state,ticket,session.email,items,'Item action declined: '+item.title);}return {status:result.status,error:result.error||'The linked inventory item could not be updated. Retry this action.'};}
 }
 const at=new Date().toISOString();if(pending.action==='purchased'){item.clientStatus='purchased';item.purchasedAt=at;item.purchasedBy=pending.name;}
 if(pending.action==='table')item.clientStatus='tabled';
 if(['question','answer'].includes(pending.action)){item.questions=[...(item.questions||[]),{id:pending.actionId,at,author:pending.name,text:pending.text,kind:pending.action}];item.followUp=pending.action==='question';if(pending.action==='answer'&&item.clientStatus==='question')item.clientStatus='open';if(pending.action==='question'&&item.clientStatus!=='purchased')item.clientStatus='question';}
 item.workspaceActions=[...(item.workspaceActions||[]),pending.actionId].slice(-100);delete item.workspacePending;
 const saved=serviceShoppingEvent_(state,ticket,session.email,items,'Client shopping item '+pending.action+': '+item.title);return {status:200,request:clientMode?serviceClientRow_(saved.item,saved.events):serviceWorkspaceRow_(saved.item,saved.events,session.email,leaders,roster)};
}
