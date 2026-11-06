// Request lifecycle and collaborative leadership lists. No fiscal writes or email.
const PURCHASE_LIST_GROUPS={
 'all-leadership':'All leadership',managers:'Division managers & assistant managers',inventory:'Inventory directors','robotics-executives':'Robotics executive team',
 'division:1':'Division 1 leadership','division:2':'Division 2 leadership','division:3':'Division 3 leadership','division:4':'Division 4 leadership','division:5':'Division 5 leadership','division:7':'Division 7 leadership','division:CTSO':'Robotics leadership'
};
function purchaseTriage_(a,x){return a.admin||a.manager||a.listManager===true;}
function purchaseAudit_(record,a,action,before,after){
 if(!record.history)record.history=[];
 const changed=Object.keys({...before,...after}).filter(key=>JSON.stringify(before&&before[key])!==JSON.stringify(after&&after[key])),prior={},next={};changed.forEach(key=>{if(before&&before[key]!==undefined)prior[key]=before[key];if(after&&after[key]!==undefined)next[key]=after[key];});
 record.history.push({id:Utilities.getUuid(),action,stage:record.stage,author:a.name,at:new Date().toISOString(),before:prior,after:next});
}
function purchaseRequestSnapshot_(x){return {title:x.title,reason:x.reason,url:x.url,quantity:x.quantity,unitCost:x.unitCost,shipping:x.shipping,fund:x.fund,stage:x.stage,divisions:x.divisions.slice(),stock:x.stock===true,inventoryVisible:x.sourceService?.inventoryVisible!==false,clientStatus:x.sourceService?.clientStatus||'',followUp:x.sourceService?.followUp===true,purchasedAt:x.purchasedAt||'',archivedAt:x.archivedAt||''};}
function purchaseRequestAction_(a,r){
 const records=purchaseRecords_('PurchaseBoardWeb'),x=records.find(x=>x.id===r.id);if(!x||!purchaseVisible_(a,x))return {status:404};
 if(r.change==='reorder'){
  if(!x.stock||!purchaseUuid_(r.newId))return {status:400,error:'Choose a stock item and refresh before requesting it again.'};
  const duplicate=records.find(x=>x.id===r.newId);if(duplicate)return duplicate.email===a.email?{status:200,saved:true}:{status:409};
  const at=new Date().toISOString(),copy={id:r.newId,revision:1,email:a.email,author:a.name,title:x.title,reason:'Reorder stock item: '+x.title,url:x.url||'',quantity:x.quantity,unitCost:x.unitCost,shipping:x.shipping||0,fund:x.fund,divisions:x.divisions.slice(),allDivisions:purchaseAllDivisions_(x),stage:'discussion',stock:false,sourceStockId:x.id,createdAt:at,updatedAt:at,comments:[],history:[]};purchaseAudit_(copy,a,'Requested stock item',{},purchaseRequestSnapshot_(copy));purchaseSave_('PurchaseBoardWeb',copy);return {status:200,saved:true};
 }
 if(!purchaseTriage_(a,x))return {status:403};if(x.revision!==r.revision)return {status:409,error:'This item changed. Refresh the requested-items list.'};
 if(['processing','review-required'].includes(x.purchaseState))return {status:409,error:'Review the linked purchase before changing this item.'};
 const before=purchaseRequestSnapshot_(x),at=new Date().toISOString();let label;
 if(r.change==='advance'){
  if(!['discussion','tabled','requisition'].includes(x.stage))return {status:400,error:'This item cannot be moved to the purchase list from its current status.'};
  x.stage='requisition';x.advancedAt=at;label='Moved to purchase list';
 }else if(r.change==='table'){
  if(!['discussion','requisition','tabled'].includes(x.stage)&&!a.admin)return {status:403};
  if(x.purchasedAt||x.stage==='archived')return {status:400,error:'Restore an unpurchased archived item before tabling it.'};
  x.stage='tabled';x.tabledAt=at;label='Tabled request';
 }else if(r.change==='archive'){
  if(x.stage==='archived')return {status:200,saved:true};x.archivedFrom=x.stage;x.stage='archived';x.archivedAt=at;label='Archived request';
 }else if(r.change==='restore'){
  if(x.stage!=='archived'||x.purchasedAt)return {status:400,error:'Purchased items stay in the archive. Use Request again for stock items.'};
  x.stage=['discussion','requisition','tabled'].includes(x.archivedFrom)?x.archivedFrom:'discussion';x.archivedAt='';label='Restored request';
 }else if(r.change==='stock'||r.change==='unstock'){
  x.stock=r.change==='stock';x.stockUpdatedAt=at;label=x.stock?'Saved as stock item':'Removed stock designation';
 }else if(r.change==='purchased'){
  if(!a.admin)return {status:403};if(x.purchasedAt)return {status:200,saved:true};
  if(r.day&&!purchaseDate_(r.day))return {status:400,error:'Choose the purchase date.'};
  x.stage='archived';x.archivedFrom='purchased';x.purchasedAt=at;x.purchasedDate=r.day||Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd');x.archivedAt=at;label='Marked purchased and archived (tracking only)';
 }else return {status:400};
 x.updatedAt=at;x.revision++;purchaseAudit_(x,a,label,before,purchaseRequestSnapshot_(x));purchaseSave_('PurchaseBoardWeb',x);return {status:200,saved:true};
}
function purchaseRequestEdit_(a,r){
 const x=purchaseRecords_('PurchaseBoardWeb').find(x=>x.id===r.id);if(!x||!purchaseVisible_(a,x))return {status:404};
 if(!purchaseTriage_(a,x)&&x.email!==a.email)return {status:403};if(x.revision!==r.revision)return {status:409,error:'This item changed. Refresh before saving.'};
 if(x.stage==='archived'||x.purchasedAt||['processing','review-required'].includes(x.purchaseState))return {status:409,error:'Archived or processing items keep their recorded details. Restore an unpurchased item or request a stock item again.'};
 if(!purchaseText_(r.title,120)||!purchaseText_(r.reason,2000)||!Number.isInteger(r.quantity)||r.quantity<1||r.quantity>10000||(r.unitCost!==null&&!purchaseMoney_(r.unitCost))||!purchaseMoney_(r.shipping)||!['CTE','ASB'].includes(r.fund)||typeof r.url!=='string'||(r.url&&!/^https:\/\/[^\s<>"']{1,500}$/.test(r.url)))return {status:400,error:'Check the item name, purpose, quantity, price and https link.'};
 const before=purchaseRequestSnapshot_(x);Object.assign(x,{title:r.title.trim(),reason:r.reason.trim(),quantity:r.quantity,unitCost:r.unitCost,shipping:r.shipping,fund:r.fund,url:r.url.trim(),updatedAt:new Date().toISOString()});x.revision++;purchaseAudit_(x,a,'Edited requested item',before,purchaseRequestSnapshot_(x));purchaseSave_('PurchaseBoardWeb',x);return {status:200,saved:true};
}
function purchaseListVisible_(a,list){return a.admin||a.listManager===true||(a.groups||[]).includes(list.group);}
function purchaseListAdmin_(a,list){return a.admin||a.listManager===true||list.email===a.email;}
function purchaseListItemEdit_(a,item){return a.admin||a.listManager===true||item.email===a.email;}
function purchaseListItemPublic_(a,i){return {id:i.id,title:i.title,reason:i.reason,url:i.url,quantity:i.quantity,unitCost:i.unitCost,author:i.author,createdAt:i.createdAt,updatedAt:i.updatedAt,removedAt:i.removedAt||'',canEdit:purchaseListItemEdit_(a,i)};}
function purchaseListPublic_(a,l){return {id:l.id,revision:l.revision,name:l.name,description:l.description,group:l.group,groupLabel:PURCHASE_LIST_GROUPS[l.group],author:l.author,createdAt:l.createdAt,updatedAt:l.updatedAt,removedAt:l.removedAt||'',canEdit:purchaseListAdmin_(a,l),canRemove:(a.admin||a.listManager===true||l.email===a.email&&!(l.items||[]).some(i=>!i.removedAt&&i.email!==a.email)),items:(l.items||[]).filter(i=>!i.removedAt).map(i=>purchaseListItemPublic_(a,i)),removedItems:(l.items||[]).filter(i=>i.removedAt).map(i=>purchaseListItemPublic_(a,i)),events:(l.events||[]).map(({actor,_row,listId,...e})=>e)};}
function purchaseListEvent_(list,a,action,before,after,itemId){
 if(!list.events)list.events=[];
 const event={id:Utilities.getUuid(),listId:list.id,action,author:a.name,actor:a.email,at:new Date().toISOString(),itemId:itemId||'',before:before||{},after:after||{}};
 list.events.push(event);list._pendingEvent=event;list.updatedAt=new Date().toISOString();
}
function purchaseListValues_(r){
 if(!purchaseText_(r.title,120)||typeof r.reason!=='string'||r.reason.length>1000||/[<>\u0000-\u0008]/.test(r.reason)||!Number.isInteger(r.quantity)||r.quantity<1||r.quantity>10000||(r.unitCost!==null&&!purchaseMoney_(r.unitCost))||typeof r.url!=='string'||(r.url&&!/^https:\/\/[^\s<>"']{1,500}$/.test(r.url)))return null;
 return {title:r.title.trim(),reason:r.reason.trim(),quantity:r.quantity,unitCost:r.unitCost,url:r.url.trim()};
}
function purchaseListDispatch_(a,r){
 const lists=purchaseLists_();
 if(r.operation==='list-create'){
  if(!purchaseUuid_(r.id)||!purchaseText_(r.name,120)||typeof r.description!=='string'||r.description.length>1000||/[<>\u0000-\u0008]/.test(r.description)||!Object.prototype.hasOwnProperty.call(PURCHASE_LIST_GROUPS,r.group))return {status:400,error:'Name the list and choose a leadership group.'};
  if(!a.admin&&!a.listManager&&!(a.groups||[]).includes(r.group))return {status:403};
  const existing=lists.find(x=>x.id===r.id);if(existing)return existing.email===a.email?{status:200,saved:true}:{status:409};
  if(lists.filter(x=>x.email===a.email&&!x.removedAt).length>=30)return {status:429,error:'Archive an unused list before creating another.'};
  const l={id:r.id,revision:1,email:a.email,author:a.name,name:r.name.trim(),description:r.description.trim(),group:r.group,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),items:[],events:[]};purchaseListEvent_(l,a,'Created list',{}, {name:l.name,description:l.description,group:l.group});purchaseListPersist_(l);return {status:200,saved:true};
 }
 const l=lists.find(x=>x.id===r.id);if(!l||!purchaseListVisible_(a,l))return {status:404};
 const duplicate=r.operation==='list-item-add'&&(l.items||[]).find(x=>x.id===r.itemId);if(duplicate)return duplicate.email===a.email?{status:200,saved:true}:{status:409};
 if(l.revision!==r.revision)return {status:409,error:'This collaborative list changed. Refresh it before saving.'};
 if(l.removedAt&&r.operation!=='list-restore')return {status:409,error:'Restore the list before changing its items.'};
 if(r.operation==='list-edit'){
  if(!purchaseListAdmin_(a,l))return {status:403};if(!purchaseText_(r.name,120)||typeof r.description!=='string'||r.description.length>1000||/[<>\u0000-\u0008]/.test(r.description))return {status:400};
  const before={name:l.name,description:l.description};l.name=r.name.trim();l.description=r.description.trim();purchaseListEvent_(l,a,'Edited list',before,{name:l.name,description:l.description});
 }else if(r.operation==='list-remove'||r.operation==='list-restore'){
  if(!purchaseListAdmin_(a,l)||r.operation==='list-remove'&&!a.admin&&!a.listManager&&(l.items||[]).some(i=>!i.removedAt&&i.email!==a.email))return {status:403,error:'A manager or administrator must remove a list containing other people’s items.'};
  l.removedAt=r.operation==='list-remove'?new Date().toISOString():'';purchaseListEvent_(l,a,r.operation==='list-remove'?'Closed list (retained in history)':'Reopened list',{}, {removedAt:l.removedAt});
 }else if(r.operation==='list-item-add'){
  const fields=purchaseListValues_(r);if(!purchaseUuid_(r.itemId)||!fields)return {status:400,error:'Check the item details.'};if(purchaseRecords_('PurchaseListItemsWeb').some(i=>i.id===r.itemId))return {status:409,error:'Refresh before adding this item.'};if((l.items||[]).filter(i=>!i.removedAt).length>=500)return {status:400,error:'Create another list before adding more than 500 active items.'};
  const item={id:r.itemId,listId:l.id,...fields,email:a.email,author:a.name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};l.items.push(item);l._pendingItem=item;purchaseListEvent_(l,a,'Added list item',{},fields,item.id);
 }else if(['list-item-edit','list-item-remove','list-item-restore'].includes(r.operation)){
  const item=(l.items||[]).find(x=>x.id===r.itemId&&(r.operation==='list-item-restore'?Boolean(x.removedAt):!x.removedAt));if(!item)return {status:404};if(!purchaseListItemEdit_(a,item))return {status:403,error:'Only the item’s author, a manager, an assistant manager, or the administrator can change it.'};
  l._pendingItem=item;const before={title:item.title,reason:item.reason,url:item.url,quantity:item.quantity,unitCost:item.unitCost};
  if(r.operation==='list-item-restore'){const removedAt=item.removedAt;item.removedAt='';item.updatedAt=new Date().toISOString();purchaseListEvent_(l,a,'Restored list item',{removedAt},{removedAt:''},item.id);}
  else if(r.operation==='list-item-remove'){item.removedAt=new Date().toISOString();purchaseListEvent_(l,a,'Removed list item',before,{},item.id);}
  else{const fields=purchaseListValues_(r);if(!fields)return {status:400,error:'Check the item details.'};Object.assign(item,fields,{updatedAt:new Date().toISOString()});purchaseListEvent_(l,a,'Edited list item',before,fields,item.id);}
 }else return {status:400};
 l.revision++;purchaseListPersist_(l);return {status:200,saved:true};
}
function purchaseWorkspaceView_(a,requests){
 const lists=purchaseLists_().filter(l=>purchaseListVisible_(a,l));
 const history=[];
 requests.forEach(x=>{if(!(x.history||[]).some(e=>e.action==='Created request'))history.push({id:'created:'+x.id,kind:'request',item:x.title,action:'Created request',author:x.author,at:x.createdAt,before:{},after:{}});(x.history||[]).forEach((e,i)=>history.push({id:e.id||x.id+':'+i,kind:'request',item:x.title,action:e.action||'Status: '+e.stage,author:e.author,at:e.at,before:e.before||{},after:e.after||{stage:e.stage}}));});
 lists.forEach(l=>(l.events||[]).forEach(({actor,_row,listId,...e})=>history.push({...e,kind:'list',item:l.name})));
 history.sort((a,b)=>b.at.localeCompare(a.at));
 const groups=(a.admin||a.listManager?Object.keys(PURCHASE_LIST_GROUPS):(a.groups||[])).filter(key=>Object.prototype.hasOwnProperty.call(PURCHASE_LIST_GROUPS,key)).map(id=>({id,name:PURCHASE_LIST_GROUPS[id]}));
 return {lists:lists.map(l=>purchaseListPublic_(a,l)),workspaceHistory:history.slice(0,1000),listGroups:groups};
}

function purchaseLists_(){
 const lists=purchaseRecords_('PurchaseListsWeb'),items=purchaseRecords_('PurchaseListItemsWeb'),events=purchaseRecords_('PurchaseListEventsWeb');
 return lists.map(l=>({...l,items:items.filter(i=>i.listId===l.id),events:events.filter(e=>e.listId===l.id)}));
}
function purchaseListPersist_(list){
 const {items,events,_pendingItem,_pendingEvent,_row,...metadata}=list;
 if(!_pendingEvent)throw Error('List audit event is required');
 const changes=[['PurchaseListsWeb',{...metadata,_row}],...(_pendingItem?[['PurchaseListItemsWeb',_pendingItem]]:[]),['PurchaseListEventsWeb',_pendingEvent]],requests=[];
 changes.forEach(([name,record])=>{
  const sheet=purchaseSheet_(name,true),{_row,...data}=record,json=JSON.stringify(data);if(json.length>48000)throw Error('Item or change is too large to save');const row=_row||sheet.getLastRow()+1;if(row>10001)throw Error('The collaborative archive needs maintenance');if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());
  requests.push({updateCells:{range:{sheetId:sheet.getSheetId(),startRowIndex:row-1,endRowIndex:row,startColumnIndex:0,endColumnIndex:2},rows:[{values:[{userEnteredValue:{stringValue:record.id}},{userEnteredValue:{stringValue:json}}]}],fields:'userEnteredValue'}});
 });
 SpreadsheetApp.flush();Sheets.Spreadsheets.batchUpdate({requests},CONFIG.MANAGER_SS_ID);
}
// Read-only setup check; creates no lists and sends no mail.
function Tool_InspectPurchaseWorkspace(){
 const response=Sheets.Spreadsheets.get(CONFIG.MANAGER_SS_ID,{fields:'spreadsheetId'});Logger.log('Collaborative atomic writes available: '+Boolean(response.spreadsheetId));
}

// Read-only financial archive. Uses the existing annual-budget resolver; never syncs or writes ledger cells.
function purchaseIsoDay_(value){
 if(value instanceof Date){if(isNaN(value.getTime()))return '';return Utilities.formatDate(value,'America/Los_Angeles','yyyy-MM-dd');}
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)){const timestamp=new Date(value);if(!isNaN(timestamp.getTime()))return Utilities.formatDate(timestamp,'America/Los_Angeles','yyyy-MM-dd');}
 const text=String(value||'').trim(),iso=text.match(/^(\d{4})-(\d{2})-(\d{2})/),us=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
 const day=iso?iso[1]+'-'+iso[2]+'-'+iso[3]:us?us[3]+'-'+us[1].padStart(2,'0')+'-'+us[2].padStart(2,'0'):'';return day&&purchaseDate_(day)?day:'';
}
function purchaseSchoolYear_(value){const day=purchaseIsoDay_(value);if(!day)return '';const start=Number(day.slice(0,4))-(Number(day.slice(5,7))<8?1:0);return String(start%100).padStart(2,'0')+'_'+String((start+1)%100).padStart(2,'0');}
function purchaseArchiveNumber_(value){if(typeof value==='number')return Number.isFinite(value)?value:null;const text=String(value??'').trim();if(!text)return null;const n=Number(text.replace(/[$,\s()]/g,''));return Number.isFinite(n)?text.startsWith('(')?-Math.abs(n):n:null;}
function purchaseArchiveLink_(rich,fallback){
 let url='';if(rich){url=rich.getLinkUrl()||'';if(!url&&typeof rich.getRuns==='function')url=rich.getRuns().map(x=>x.getLinkUrl()).find(Boolean)||'';}
 if(!url&&/^https:\/\//.test(String(fallback||'')))url=String(fallback);return /^https:\/\//.test(url)?url:'';
}
function purchaseFinancialLog_(){
 const sheet=SpreadsheetApp.openById(CONFIG.MANAGER_SS_ID).getSheetByName('BudgetLogs');if(!sheet||sheet.getLastRow()<2)return [];
 if(sheet.getLastRow()>10001)throw Error('The purchase-response archive needs maintenance');
 const range=sheet.getRange(2,1,sheet.getLastRow()-1,45),values=range.getValues(),rich=range.getRichTextValues();
 return values.map((v,i)=>{const day=purchaseIsoDay_(v[35]||v[0]),year=purchaseSchoolYear_(day);if(!year||!v[2]||purchaseIsPractice_({type:v[1],emailStatus:v[44]}))return null;const food=String(v[37]||'').startsWith('Yes'),amount=purchaseArchiveNumber_(v[41]);return {id:'log-'+(i+2),day,year,vendor:String(v[2]),description:String(v[36]||''),type:String(v[1]||'Purchase'),receiptAmount:amount,ledgerAmount:food?0:amount,total:food?0:amount,receipt:purchaseArchiveLink_(rich[i][40],v[40]),source:'BudgetLog submission',emailStatus:String(v[44]||'')};}).filter(Boolean);
}
function purchaseFinancialYears_(logs){
 const current=getCurrentSchoolYear(),start=2000+Number(current.slice(0,2)),years=new Set([current]);
 // Offer the current and previous school years even when an older form's date columns differ.
 for(let y=start-12;y<=start;y++)years.add(String(y%100).padStart(2,'0')+'_'+String((y+1)%100).padStart(2,'0'));
 logs.forEach(x=>years.add(x.year));
 const index=SpreadsheetApp.openById(CONFIG.MANAGER_SS_ID).getSheetByName('Past_Budgets');
 if(index&&index.getLastRow()>1){const rows=index.getRange(2,1,Math.min(index.getLastRow()-1,2000),5).getDisplayValues();rows.forEach(row=>row.forEach(text=>{for(const match of String(text||'').matchAll(/(?:^|[^\d])(20\d{2}|\d{2})[_\s–-]+(20\d{2}|\d{2})(?!\d)/g)){const first=Number(match[1])%100,last=Number(match[2])%100;if(last===(first+1)%100&&first<=start%100)years.add(String(first).padStart(2,'0')+'_'+String(last).padStart(2,'0'));}}));}
 return [...years].filter(y=>y<=current).sort().reverse().map(id=>({id,label:'20'+id.slice(0,2)+'–20'+id.slice(3)}));
}
function purchaseFinancialHistory_(a,r){if(!a.admin)return {status:403};return purchaseFinancialHistoryData_(r,true);}
function purchaseFinancialHistoryData_(r,includePrivate){
 const current=getCurrentSchoolYear(),year=r.year||current;
 if(!/^\d{2}_\d{2}$/.test(year)||Number(year.slice(3))!==(Number(year.slice(0,2))+1)%100||year>current)return {status:400,error:'Choose a school year.'};
 const logs=purchaseFinancialLog_(),years=purchaseFinancialYears_(logs);let purchases=[],source='',sourceUrl='',warning='';
 try{
  const file=resolveCurrentBudgetFile_(year,'website-purchase-history'),layout=findBudgetTabAndHeaders_(SpreadsheetApp.openById(file.getId())),sheet=layout.sheet,height=sheet.getLastRow()-layout.headerRow,width=sheet.getLastColumn();
  if(height>10000||width>60)throw Error('Annual budget archive is too large');
  source=file.getName();sourceUrl=file.getUrl();
  if(height>0){const range=sheet.getRange(layout.headerRow+1,1,height,width),values=range.getValues(),rich=range.getRichTextValues(),map=layout.headerMap;
   purchases=values.map((v,i)=>{const day=purchaseIsoDay_(v[map.Date-1]),vendor=String(v[map.Vendor-1]||'').trim();if(!day||!vendor)return null;const description=String(v[map.Description-1]||''),amount=purchaseArchiveNumber_(v[map.Amount-1]),total=purchaseArchiveNumber_(v[map.Total-1]),food=description.match(/🍕_\$(-?\d+(?:\.\d+)?)/),isReturn=amount<0||/return for|^↩/i.test(description),receiptAmount=food?(isReturn?-Math.abs(Number(food[1])):Number(food[1])):amount;return {id:'budget-'+(layout.headerRow+i+1),day,year,vendor,description,type:food?(isReturn?'Food return documentation':'Food documentation'):isReturn?'Return':'Purchase',receiptAmount,ledgerAmount:amount,total,receipt:purchaseArchiveLink_(rich[i][map.Amount-1],''),source:'District budget'};}).filter(Boolean);
  }
 }catch(_){purchases=logs.filter(x=>x.year===year&&x.type!=='ASB Purchase Request');source='Saved BudgetLog responses';warning='The annual district sheet could not be verified for this year. Showing saved form records; these may include corrections and original submissions.';}
 purchases.sort((a,b)=>b.day.localeCompare(a.day));
 return {status:200,currentYear:current,year,years,purchases,asbRequests:includePrivate?purchaseAsbPublic_().filter(x=>purchaseSchoolYear_(x.day)===year):[],source,sourceUrl,warning};
}

// Trusted school service gateway only: item IDs remain stable across transfer retries.
function purchaseServiceImport_(a,r){
 if(!purchaseUuid_(r.ticketId)||!Array.isArray(r.items)||!r.items.length||r.items.length>20)return {status:400};
 const records=purchaseRecords_('PurchaseBoardWeb'),ids=new Set();
 for(const item of r.items){
  if(!purchaseUuid_(item.id)||ids.has(item.id)||!purchaseText_(item.title,120)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10000||!(item.unitCost===null||purchaseMoney_(item.unitCost))||typeof item.notes!=='string'||item.notes.length>500||typeof item.url!=='string'||item.url.length>500||item.url&&!/^https:\/\/[^\s<>"']+$/.test(item.url)||!['CTE','ASB'].includes(item.fund)||!PURCHASE_PERIODS.includes(item.division)||!a.periods.includes(item.division))return {status:400,error:'Check the service shopping list before sending.'};
  ids.add(item.id);const prior=records.find(x=>x.id===item.id);if(prior&&prior.sourceService?.ticketId!==r.ticketId)return {status:409,error:'The item reference is already in use.'};
 }
 for(const item of r.items){if(records.some(x=>x.id===item.id))continue;const at=new Date().toISOString(),record={id:item.id,revision:1,title:item.title.trim(),reason:item.notes.trim()||'Items requested for service ticket '+r.ticketId.slice(0,8).toUpperCase(),url:item.url,quantity:item.quantity,unitCost:item.unitCost,shipping:0,fund:item.fund,divisions:[item.division],allDivisions:false,stage:'discussion',email:a.email,author:a.name,createdAt:at,updatedAt:at,comments:[],history:[],sourceService:{ticketId:r.ticketId,clientPurchaseRequested:item.clientPurchaseRequested===true}};purchaseAudit_(record,a,'Imported service shopping item',{},purchaseRequestSnapshot_(record));purchaseSave_('PurchaseBoardWeb',record);}
 return {status:200,saved:true,ids:[...ids]};
}

// Leadership reference exposes only chart values, never receipts or invoice descriptions.
function purchaseBudgetReference_(a){
 if(!a.admin&&!(a.groups||[]).includes('all-leadership'))return {status:403};
 const budget=purchaseBudget_(),report=purchaseFinancialHistoryData_({year:budget.year},false);
 return {status:200,year:budget.year,balance:budget.balance,revision:budget.revision,purchases:report.warning?[]:report.purchases.map(x=>({day:x.day,vendor:x.vendor,total:x.total})),warning:report.warning||''};
}

// Only the authenticated school gateway may invoke this source-ticket mutation.
function purchaseServiceChange_(a,r){
 if(!purchaseUuid_(r.ticketId)||!purchaseUuid_(r.itemId)||!purchaseUuid_(r.changeId)||!['edit','remove','route'].includes(r.change))return {status:400};
 const x=purchaseRecords_('PurchaseBoardWeb').find(x=>x.id===r.itemId);
 if(!x||x.sourceService?.ticketId!==r.ticketId)return {status:404};
 if(!a.admin&&!x.divisions.some(p=>a.periods.includes(p)))return {status:403};
 const prior=(x.sourceService.changes||[]).find(c=>c.id===r.changeId),digest=purchaseHash_(JSON.stringify({change:r.change,before:r.before,after:r.after}));
 if(prior)return prior.digest===digest?{status:200,saved:true}:{status:409,error:'The pending change payload changed. Refresh the service ticket.'};
 if(x.purchasedAt||x.purchaseState||x.asbRequested||!['discussion','requisition','tabled'].includes(x.stage))return {status:409,error:'This item is archived, purchased, or in the purchase workflow. Its recorded details cannot be changed from the service list.'};
 const reason=notes=>notes.trim()||'Items requested for service ticket '+r.ticketId.slice(0,8).toUpperCase();
 if(!r.before||['title','quantity','unitCost','url','fund'].some(k=>x[k]!==r.before[k])||typeof r.before.notes!=='string'||x.reason!==reason(r.before.notes))return {status:409,error:'This item changed in Inventory & Purchasing. Review the requested item before changing its service list.'};
 const before=purchaseRequestSnapshot_(x),at=new Date().toISOString();
 if(r.change==='edit'){
  const n=r.after;if(!n||!purchaseText_(n.title,120)||!Number.isInteger(n.quantity)||n.quantity<1||n.quantity>10000||!(n.unitCost===null||purchaseMoney_(n.unitCost))||typeof n.notes!=='string'||n.notes.length>500||typeof n.url!=='string'||n.url.length>500||n.url&&!/^https:\/\/[^\s<>"']+$/.test(n.url)||!['CTE','ASB'].includes(n.fund))return {status:400,error:'Check the shopping item fields.'};
  x.sourceService.clientPurchaseRequested=n.clientPurchaseRequested===true;
  Object.assign(x,{title:n.title.trim(),quantity:n.quantity,unitCost:n.unitCost,url:n.url.trim(),reason:reason(n.notes),fund:n.fund});
 }else if(r.change==='route'){
  const route=r.after?.purchaseRoute;if(!['requisition','client','inventory'].includes(route))return {status:400};x.stage=route==='requisition'?'requisition':route==='client'?'tabled':'discussion';x.sourceService.route=route;if(route==='requisition')x.advancedAt=at;
 }else {x.archivedFrom=x.stage;x.stage='archived';x.archivedAt=at;x.sourceService.removedAt=at;}
 x.updatedAt=at;x.revision++;x.sourceService.changes=[...(x.sourceService.changes||[]),{id:r.changeId,digest}].slice(-100);
 purchaseAudit_(x,a,r.change==='edit'?'Edited from service shopping list':r.change==='route'?'Service purchase destination: '+r.after.purchaseRoute:'Removed from service shopping list',before,purchaseRequestSnapshot_(x));purchaseSave_('PurchaseBoardWeb',x);return {status:200,saved:true};
}

function purchaseServiceStatuses_(a,r){
 if(!purchaseUuid_(r.ticketId)||!Array.isArray(r.itemIds)||r.itemIds.length>20||r.itemIds.some(id=>!purchaseUuid_(id)))return {status:400};
 const items=purchaseRecords_('PurchaseBoardWeb').filter(x=>r.itemIds.includes(x.id)&&x.sourceService?.ticketId===r.ticketId&&(a.admin||x.divisions.some(p=>a.periods.includes(p))));
 return {status:200,items:items.map(x=>({id:x.id,stage:x.stage,purchaseState:x.purchaseState||'',purchasedAt:x.purchasedAt||'',purchasedDate:x.purchasedDate||'',route:x.sourceService.route||'inventory'}))};
}

function purchaseServiceVisibility_(a,r){
 if(!purchaseUuid_(r.ticketId)||!purchaseUuid_(r.changeId)||typeof r.visible!=='boolean'||!Array.isArray(r.itemIds)||r.itemIds.length>20||r.itemIds.some(id=>!purchaseUuid_(id)))return {status:400};
 const records=purchaseRecords_('PurchaseBoardWeb').filter(x=>x.sourceService?.ticketId===r.ticketId&&r.itemIds.includes(x.id));
 if(records.some(x=>!a.admin&&!x.divisions.some(p=>a.periods.includes(p))))return {status:403};
 for(const x of records){if(x.sourceService.visibilityChange===r.changeId)continue;const before=purchaseRequestSnapshot_(x),at=new Date().toISOString();
  if(!r.visible&&!x.purchasedAt&&!x.purchaseState&&x.stage!=='archived'){x.sourceService.hiddenStage=x.stage;x.stage='tabled';}
  if(r.visible&&!x.purchasedAt&&!x.purchaseState&&x.stage!=='archived'&&x.sourceService.hiddenStage){x.stage=x.sourceService.hiddenStage;delete x.sourceService.hiddenStage;}
  x.sourceService.inventoryVisible=r.visible;x.sourceService.visibilityChange=r.changeId;x.updatedAt=at;x.revision++;purchaseAudit_(x,a,r.visible?'Service shopping list shared with Inventory':'Service shopping list withdrawn from Inventory',before,purchaseRequestSnapshot_(x));purchaseSave_('PurchaseBoardWeb',x);
 }return {status:200,saved:true};
}
function purchaseServiceClientAction_(a,r){
 if(!purchaseUuid_(r.ticketId)||!purchaseUuid_(r.itemId)||!purchaseUuid_(r.changeId)||!['purchased','table','question','answer'].includes(r.change)||typeof r.text!=='string'||r.text.length>2000)return {status:400};
 const x=purchaseRecords_('PurchaseBoardWeb').find(x=>x.id===r.itemId&&x.sourceService?.ticketId===r.ticketId);if(!x)return {status:404};if(!a.admin&&!x.divisions.some(p=>a.periods.includes(p)))return {status:403};
 const digest=purchaseHash_(JSON.stringify({change:r.change,text:r.text})),prior=(x.sourceService.clientActions||[]).find(x=>x.id===r.changeId);if(prior)return prior.digest===digest?{status:200,saved:true}:{status:409};
 if(['purchased','table'].includes(r.change)&&(x.purchasedAt||x.purchaseState))return {status:409,error:'The linked request is already purchased or in the purchase workflow.'};
 const before=purchaseRequestSnapshot_(x),at=new Date().toISOString();
 if(r.change==='purchased'){x.stage='archived';x.archivedAt=at;x.purchasedAt=at;x.purchasedDate=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd');x.purchaseState='client-complete';x.sourceService.clientStatus='purchased';x.sourceService.purchasedByClient=true;}
 if(r.change==='table'){x.stage='tabled';x.tabledAt=at;x.sourceService.clientStatus='tabled';}
 if(r.change==='question'||r.change==='answer'){x.sourceService.followUp=r.change==='question';if(r.change==='answer'&&x.sourceService.clientStatus==='question')x.sourceService.clientStatus='open';if(r.change==='question'&&!x.purchasedAt)x.sourceService.clientStatus='question';}
 x.sourceService.clientActions=[...(x.sourceService.clientActions||[]),{id:r.changeId,digest}].slice(-100);x.updatedAt=at;x.revision++;purchaseAudit_(x,a,'Client shopping item '+r.change,before,purchaseRequestSnapshot_(x));purchaseSave_('PurchaseBoardWeb',x);return {status:200,saved:true};
}
