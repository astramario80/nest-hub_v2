// Ticket shopping lists are private event snapshots; no client email or fiscal write.
function serviceShoppingRead_(item,events){
 const changes=events.filter(e=>e[1]===item.id&&e[2]==='shopping');
 const latest=changes.slice(-1)[0],items=latest?JSON.parse(String(latest[9]||'[]')):[];
 if(!Array.isArray(items)||items.length>20)throw Error('Invalid ticket shopping list');
 return {items,history:changes.map(e=>({at:String(e[0]),actor:String(e[3]),action:String(e[5])}))};
}
function serviceShoppingEvent_(state,item,email,items,action){
 const at=new Date().toISOString(),event=[at,item.id,'shopping',email,item.status,action,Utilities.getUuid(),'','',JSON.stringify(items)];
 if(event[9].length>45000)throw Error('Shopping list capacity reached');
 const extra=[],published=typeof serviceWorkspaceSettings_==='function'&&serviceWorkspaceSettings_(item,state.events).clientPublished,previous=serviceClientShoppingItems_(serviceShoppingRead_(item,state.events).items,published),next=serviceClientShoppingItems_(items,published);
 const publicSnapshot=values=>JSON.stringify(values.map(({pendingAction,...value})=>value));
 if(publicSnapshot(previous)!==publicSnapshot(next))extra.push([at,item.id,'update',email,item.status,next.length?'Client shopping list updated: '+next.length+' item(s). See the client shopping list below for status and questions.':'Client shopping list updated: no items currently need to be purchased by you.',Utilities.getUuid(),'',item.manager||'','']);
 Sheets.Spreadsheets.batchUpdate({requests:[event,...extra].map(e=>serviceAppend_(state.logTab,e))},SERVICE_SOURCE);
 const events=[...state.events,event,...extra],updated={...item,version:serviceVersion_(item.raw,extra.slice(-1)[0]||event)};
 return {events,item:updated};
}
function serviceShoppingWrite_(session,r){
 let state=serviceRead_(),item=state.requests.find(x=>x.id===r.id);if(!item)return {status:404};
 const email=session.email,leaders=serviceLeaders_(),roster=serviceRoster_();
 if(!serviceTicketAccess_(email,item,leaders,roster).canEdit&&!purchasingActor_(session).manager)return {status:403};
 if(typeof serviceWorkspaceSettings_==='function'&&serviceWorkspaceSettings_(item,state.events).pendingVisibility)return {status:409,error:'Finish the pending Inventory sharing change first.'};
 if(item.version!==r.version)return {status:409};if(['Completed','Closed'].includes(item.status))return {status:400,error:'Reopen the service ticket before changing its shopping list.'};
 let items=serviceShoppingRead_(item,state.events).items.map(x=>({...x})),action='';
 const existing=items.find(x=>x.id===r.itemId);
 if(existing&&(existing.purchasedAt||existing.clientStatus==='purchased')&&['auth-service-shopping-save','auth-service-shopping-remove'].includes(r.action))return {status:409,error:'This item is recorded as purchased. Its history is retained.'};
 if(r.action==='auth-service-shopping-save'){
  if(!/^[a-f0-9-]{36}$/.test(r.itemId||'')||typeof r.title!=='string'||!r.title.trim()||/^[=+@]/.test(r.title.trim())||/[<>\u0000-\u0008]/.test(r.title)||r.title.length>120||!Number.isInteger(r.quantity)||r.quantity<1||r.quantity>10000||!(r.unitCost===null||typeof r.unitCost==='number'&&isFinite(r.unitCost)&&r.unitCost>=0&&r.unitCost<=1000000&&Math.abs(r.unitCost*100-Math.round(r.unitCost*100))<.00001)||typeof r.url!=='string'||r.url.length>500||r.url&&!/^https:\/\/[^\s<>"']+$/.test(r.url)||typeof r.notes!=='string'||r.notes.length>500||!['CTE','ASB'].includes(r.fund))return {status:400,error:'Check the item, quantity, price, product URL and funding source.'};
  if(r.clientPurchaseRequested!==undefined&&typeof r.clientPurchaseRequested!=='boolean')return {status:400};
  if(existing&&(existing.transferState==='pending'||(existing.changePending||existing.workspacePending)))return {status:409,error:'Retry the pending inventory transfer or change before editing this item.'};
  if(!existing&&items.length>=20)return {status:400,error:'A ticket shopping list supports up to 20 lines.'};
  const next={id:r.itemId,title:r.title.trim(),quantity:r.quantity,unitCost:r.unitCost,url:r.url.trim(),notes:r.notes.trim(),fund:r.fund,clientPurchaseRequested:r.clientPurchaseRequested===true,author:existing?.author||session.username||email,updatedAt:new Date().toISOString()};
  if(existing?.sentAt)return serviceShoppingChange_(session,r,state,item,items,existing,'edit',next,leaders,roster);
  if(existing)items[items.indexOf(existing)]=next;else items.push(next);action=(existing?'Edited item: ':'Added item: ')+next.title;
 }else if(r.action==='auth-service-shopping-remove'){
  if(!existing)return {status:404};if(existing.transferState==='pending'||(existing.changePending||existing.workspacePending))return {status:409,error:'Retry the pending inventory transfer or change first.'};if(existing.sentAt)return serviceShoppingChange_(session,r,state,item,items,existing,'remove',null,leaders,roster);items=items.filter(x=>x.id!==existing.id);action='Removed draft item: '+existing.title;
 }else if(r.action==='auth-service-shopping-route'){
  const routeActor=purchasingActor_(session);if(!routeActor.manager&&!routeActor.listManager)return {status:403};
  if(!existing||!existing.sentAt)return {status:400,error:'Send the saved item to inventory before choosing its purchase destination.'};
  if((existing.changePending||existing.workspacePending)||!['requisition','client','inventory'].includes(r.route))return {status:409,error:'Finish the pending item change first.'};
  return serviceShoppingChange_(session,r,state,item,items,existing,'route',{purchaseRoute:r.route},leaders,roster);
 }else if(r.action==='auth-service-shopping-push'){
  const changing=items.find(x=>x.changePending);if(changing)return serviceShoppingChange_(session,r,state,item,items,changing,null,null,leaders,roster);
  const assignment=serviceAssignment_(item,roster),division=assignment?.period;
  if(!['1','2','3','4','5','7','CTSO'].includes(division))return {status:400,error:'Assign a current project manager before sending the shopping list to inventory.'};
  const sharing=typeof serviceWorkspaceSettings_==='function'?serviceWorkspaceSettings_(item,state.events):null;if(sharing?.inventoryExplicit&&sharing.inventoryVisible===false&&!r.shareRequested)return {status:409,error:'Turn on Inventory sharing before sending new items.'};
  const pending=items.filter(x=>!x.sentAt);if(!pending.length)return {status:200,request:serviceShoppingReply_(item,state.events,session,leaders,roster)};
  // Persist the exact payload before crossing services. A timeout freezes these lines;
  // retrying uses the same UUIDs and cannot create duplicate purchase requests.
  pending.forEach(x=>{x.transferState='pending';x.division=x.division||division;});
  let saved=serviceShoppingEvent_(state,item,email,items,'Started inventory transfer');item=saved.item;state={...state,events:saved.events};
  const actor=purchasingActor_(session);actor.periods=[...new Set([...actor.periods,...pending.map(x=>x.division)])];
  const result=purchasingBudgetRequest_(r.token,actor,'service-import',{ticketId:item.id,items:pending.map(x=>({...x}))});
  if(result.status!==200)return {status:result.status===400?400:503,error:result.error||'Inventory transfer needs review. Refresh this ticket, then retry the pending transfer.'};
  const at=new Date().toISOString();pending.forEach(x=>{x.sentAt=at;x.transferState='sent';});action='Sent '+pending.length+' item(s) to inventory';
 }else return {status:400};
 const saved=serviceShoppingEvent_(state,item,email,items,action);
 return {status:200,request:serviceShoppingReply_(saved.item,saved.events,session,leaders,roster)};
}
function serviceShoppingInventory_(session,actor){
 const state=serviceRead_(),leaders=serviceLeaders_(),roster=serviceRoster_();
 const tickets=state.requests.filter(item=>actor.manager||serviceTicketAccess_(session.email,item,leaders,roster).canEdit).map(item=>{
  const list=serviceShoppingRead_(item,state.events),settings=typeof serviceWorkspaceSettings_==='function'?serviceWorkspaceSettings_(item,state.events):{inventoryVisible:true},items=(settings.inventoryVisible?list.items:[]).filter(x=>x.sentAt||x.transferState==='pending').map(({id,title,quantity,unitCost,url,notes,fund,sentAt,transferState,division,purchaseRoute,clientPurchaseRequested,changePending,clientStatus,purchasedAt,questions,followUp,workspacePending})=>({id,title,quantity,unitCost,url,notes,fund,sentAt,transferState,division,purchaseRoute,clientPurchaseRequested,clientStatus,purchasedAt,questions,followUp,workspacePending:workspacePending||null,changePending:!!changePending}));
  return {id:item.id,version:item.version,canEdit:(actor.manager||serviceTicketAccess_(session.email,item,leaders,roster).canEdit)&&!['Completed','Closed'].includes(item.status),status:item.status,category:item.category,manager:item.manager,items};
 }).filter(x=>x.items.length);
 return {status:200,tickets};
}

// Journal an exact change before crossing services. Retrying cannot duplicate it.
function serviceShoppingChange_(session,r,state,ticket,items,existing,kind,next,leaders,roster){
 let change=existing.changePending;
 if(!change){
  change={id:Utilities.getUuid(),kind,before:{title:existing.title,quantity:existing.quantity,unitCost:existing.unitCost,url:existing.url,notes:existing.notes,fund:existing.fund},after:next};
  existing.changePending=change;
  const started=serviceShoppingEvent_(state,ticket,session.email,items,'Started inventory item '+kind+': '+existing.title);ticket=started.item;state={...state,events:started.events};
 }
 const actor=purchasingActor_(session);actor.periods=[...new Set([...actor.periods,existing.division].filter(Boolean))];
 let result;try{result=purchasingBudgetRequest_(r.token,actor,'service-change',{ticketId:ticket.id,itemId:existing.id,changeId:change.id,change:change.kind,before:change.before,after:change.after});}catch(_){return {status:503,error:'The item change could not be confirmed. Refresh this ticket and choose Retry pending item change.'};}
 if(result.status!==200){
  if([400,403,404,409].includes(result.status)){delete existing.changePending;serviceShoppingEvent_(state,ticket,session.email,items,'Inventory item change declined: '+existing.title);}
  return {status:result.status,error:result.error||'The item change needs review. Refresh and retry the pending item change.'};
 }
 if(change.kind==='remove')items=items.filter(x=>x.id!==existing.id);
 else {Object.assign(existing,change.after,{sentAt:existing.sentAt,division:existing.division,transferState:'sent'});delete existing.changePending;}
 const saved=serviceShoppingEvent_(state,ticket,session.email,items,(change.kind==='remove'?'Removed sent item: ':change.kind==='route'?'Changed purchase destination to '+change.after.purchaseRoute+': ':'Edited sent item: ')+existing.title);
 return {status:200,request:serviceShoppingReply_(saved.item,saved.events,session,leaders,roster)};
}

function serviceClientShoppingItems_(items,published=false){return items.filter(x=>published||x.purchaseRoute==='client').map(({id,title,quantity,unitCost,url,clientStatus,purchasedAt,questions,followUp,workspacePending})=>({id,title,quantity,unitCost,url,status:clientStatus||'open',purchasedAt:purchasedAt||'',questions:questions||[],followUp:!!followUp,pendingAction:workspacePending?{actionId:workspacePending.actionId,change:workspacePending.action,text:workspacePending.text,actor:workspacePending.actor}:null}));}
function serviceClientShopping_(item,events){const list=serviceShoppingRead_(item,events),published=typeof serviceWorkspaceSettings_==='function'?serviceWorkspaceSettings_(item,events).clientPublished:null;if(published===false)return {items:[],available:false,updated:''};return {items:serviceClientShoppingItems_(list.items,published),updated:events.filter(e=>e[1]===item.id&&e[2]==='shopping').slice(-1)[0]?.[0]||'',available:published||list.history.some(e=>/destination to client/.test(e.action))};}
function serviceShoppingStatus_(session,r){
 const state=serviceRead_(),item=state.requests.find(x=>x.id===r.id);if(!item)return {status:404};
 if(!serviceTicketAccess_(session.email,item,serviceLeaders_(),serviceRoster_()).canEdit)return {status:403};
 const items=serviceShoppingRead_(item,state.events).items.filter(x=>x.sentAt),actor=purchasingActor_(session);actor.periods=[...new Set([...actor.periods,...items.map(x=>x.division)].filter(Boolean))];
 return purchasingBudgetRequest_(r.token,actor,'service-status',{ticketId:item.id,itemIds:items.map(x=>x.id)});
}

function serviceShoppingReply_(item,events,session,leaders,roster){return serviceTicketAccess_(session.email,item,leaders,roster).canEdit?serviceManagerRow_(item,events,session.email,leaders,roster):{id:item.id,version:item.version,shopping:serviceShoppingRead_(item,events)};}
