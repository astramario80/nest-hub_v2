// Additive entry point in NEST™PurchaseLog. UnifiedBudgetSystem remains the processor.
const PURCHASE_WEB_DIGEST = 'fa73c87e353c83d23f5a447adf018eda6be9a8096a6d84e03318eb8833f984cf';
const PURCHASE_ADMINS = ['mpenalver@bethelsd.org'];
const PURCHASE_PRACTICE_TYPE = 'Practice Purchase — email preview only';
const PURCHASE_PERIODS = ['1','2','3','4','5','7','CTSO'];
const PURCHASE_STATES = ['discussion','requisition','approved','ordered','received','declined','tabled','archived'];
const PURCHASE_ATTENDANCE_GROUPS = ['Attendance_Food Sign-In','Attendance','Attendance_NEST Robotics'];
const PURCHASE_SIGNIN_FORM = '1WAdJ-qTSwRvqKatt_Fj3xEbl_uTTS9EjqSLr-JYxTeg';
function purchaseHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function purchaseJson_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function doGet(){return purchaseJson_({status:401});}
function doPost(e){
 try{
  const r=JSON.parse(e.postData.contents);
  if(typeof r.token!=='string'||purchaseHash_(r.token)!==PURCHASE_WEB_DIGEST)return purchaseJson_({status:401});
  if(r.action!=='purchase-web'||!r.actor||typeof r.actor.email!=='string')return purchaseJson_({status:400});
  const a={email:r.actor.email,name:String(r.actor.name||'NEST member').slice(0,80),periods:(r.actor.periods||[]).filter(p=>PURCHASE_PERIODS.includes(p)),admin:PURCHASE_ADMINS.includes(r.actor.email),manager:r.actor.manager===true,allDivisionLeadership:r.actor.allDivisionLeadership===true,discussionTeam:Array.isArray(r.actor.discussionTeam)?r.actor.discussionTeam:[],listManager:r.actor.listManager===true,groups:Array.isArray(r.actor.groups)?r.actor.groups.filter(g=>Object.prototype.hasOwnProperty.call(PURCHASE_LIST_GROUPS,g)):[]};
  a.manager=a.manager||a.admin;
  if(!a.manager&&!a.periods.length)return purchaseJson_({status:403});
  const read=['view','admin','attendance','purchase-history','budget-reference'].includes(r.operation);
  if(read)return purchaseJson_(purchaseDispatch_(a,r));
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return purchaseJson_({status:503,error:'Purchasing is busy. Refresh the saved status before retrying.'});
  try{return purchaseJson_(purchaseDispatch_(a,r));}finally{lock.releaseLock();}
 }catch(error){console.error('Purchase web failed',String(error.message||error));return purchaseJson_({status:503,error:'Purchasing could not be confirmed. Refresh saved status before retrying.'});}
}
function purchaseText_(v,max){return typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/^[=+@]/.test(v.trim())&&!/[<>\u0000-\u0008]/.test(v);}
function purchaseUuid_(v){return typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);}
function purchaseDate_(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;try{return Utilities.formatDate(Utilities.parseDate(v,'America/Los_Angeles','yyyy-MM-dd'),'America/Los_Angeles','yyyy-MM-dd')===v;}catch(_){return false;}}
function purchaseMoney_(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000000&&Math.abs(v*100-Math.round(v*100))<0.00001;}
function purchaseSheet_(name,create){const ss=SpreadsheetApp.openById(CONFIG.MANAGER_SS_ID);let sheet=ss.getSheetByName(name);if(!sheet&&create){sheet=ss.insertSheet(name);sheet.getRange(1,1,1,2).setValues([['ID','Record JSON']]);sheet.setFrozenRows(1);sheet.hideSheet();}return sheet;}
function purchaseRecords_(name){const sheet=purchaseSheet_(name,false);if(!sheet||sheet.getLastRow()<2)return [];if(sheet.getLastRow()>10001)throw Error('Purchase archive needs maintenance');return sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().map((row,i)=>{if(!row[0])return null;const record=JSON.parse(row[1]);if(record.id!==row[0])throw Error('Purchase archive mismatch');return {...record,_row:i+2};}).filter(Boolean);}
function purchaseSave_(name,record){const sheet=purchaseSheet_(name,true),{_row,...data}=record,json=JSON.stringify(data);if(json.length>48000)throw Error('Discussion is full; start a follow-up request');const row=_row||sheet.getLastRow()+1;if(row>10001)throw Error('Purchase archive needs maintenance');sheet.getRange(row,1,1,2).setValues([[record.id,json]]);record._row=row;SpreadsheetApp.flush();}
function purchaseAllDivisions_(x){return x.allDivisions===true||(Array.isArray(x.divisions)&&PURCHASE_PERIODS.every(p=>x.divisions.includes(p)));}
function purchaseVisible_(a,x){if(x.sourceService?.inventoryVisible===false)return false;return a.admin||a.manager||x.email===a.email||(purchaseAllDivisions_(x)?a.allDivisionLeadership===true||x.email===a.email:x.divisions.some(p=>a.periods.includes(p)));}
function purchasePublic_(x){return {id:x.id,revision:x.revision,title:x.title,reason:x.reason,url:x.url,quantity:x.quantity,unitCost:x.unitCost,shipping:x.shipping,fund:x.fund,divisions:x.divisions,allDivisions:purchaseAllDivisions_(x),stage:x.stage,author:x.author,createdAt:x.createdAt,updatedAt:x.updatedAt,comments:x.comments.map(c=>({id:c.id,author:c.author,text:c.text,at:c.at})),history:x.history.map(e=>({stage:e.stage,author:e.author,at:e.at})),purchaseState:x.purchaseState||'',stock:x.stock===true,purchasedAt:x.purchasedAt||'',purchasedDate:x.purchasedDate||'',archivedAt:x.archivedAt||'',archivedFrom:x.archivedFrom||'',tabledAt:x.tabledAt||'',sourceService:x.sourceService?{ticketId:x.sourceService.ticketId,route:x.sourceService.route||'inventory',clientPurchaseRequested:x.sourceService.clientPurchaseRequested===true,clientStatus:x.sourceService.clientStatus||'',followUp:x.sourceService.followUp===true}:null};}
function purchaseBudget_(){const year=getCurrentSchoolYear(),file=resolveCurrentBudgetFile_(year,'website'),layout=findBudgetTabAndHeaders_(SpreadsheetApp.openById(file.getId())),balance=layout.sheet.getRange(layout.balanceCell.row,layout.balanceCell.col).getValue();if(typeof balance!=='number'||!Number.isFinite(balance))throw Error('Budget balance unavailable');return {year,balance,revision:purchaseHash_(file.getId()+'|'+balance)};}
function purchaseView_(a){const records=purchaseRecords_('PurchaseBoardWeb').filter(x=>purchaseVisible_(a,x));let budget=null,budgetError='';if(a.manager)try{budget=purchaseBudget_();}catch(_){budgetError='The current district budget could not be verified. Estimates remain available.';}return {status:200,schoolYear:getCurrentSchoolYear(),access:{budgetReference:a.admin||(a.groups||[]).includes('all-leadership'),admin:a.admin,manager:a.manager,canTriage:a.admin||a.manager||a.listManager===true,listManager:a.listManager===true,periods:a.manager?PURCHASE_PERIODS:a.periods},requests:records.map(x=>({...purchasePublic_(x),canEditItem:purchaseTriage_(a,x)||x.email===a.email,canTriage:purchaseTriage_(a,x)})).reverse(),discussionTeam:records.some(purchaseAllDivisions_)?(a.discussionTeam||[]):[],budget,budgetError,...purchaseWorkspaceView_(a,records),...(a.admin?{asbRequests:purchaseAsbPublic_().filter(x=>purchaseSchoolYear_(x.day)===getCurrentSchoolYear()),asbActions:purchaseRecords_('PurchaseAsbActionsWeb').filter(x=>x.state!=='preview').slice(-20).map(x=>({id:x.id,state:x.state,change:x.change,at:x.createdAt})),runs:purchaseRecentRuns_()}:{})};}
function purchaseCreate_(a,r){
 if(!purchaseUuid_(r.id))return {status:400,error:'Refresh the request form.'};
 const allDivisions=Array.isArray(r.divisions)&&r.divisions.length===1&&r.divisions[0]==='ALL';
 const records=purchaseRecords_('PurchaseBoardWeb'),existing=records.find(x=>x.id===r.id);if(existing)return existing.email===a.email?{status:200,saved:true}:{status:409};
 if(!purchaseText_(r.title,120)||!purchaseText_(r.reason,2000)||!Number.isInteger(r.quantity)||r.quantity<1||r.quantity>10000||!Array.isArray(r.divisions)||!r.divisions.length||new Set(r.divisions).size!==r.divisions.length||(!allDivisions&&r.divisions.some(p=>!(a.manager?PURCHASE_PERIODS:a.periods).includes(p)))||!['CTE','ASB'].includes(r.fund))return {status:400,error:'Complete the request and choose your division.'};
 if(r.unitCost!==undefined&&r.unitCost!==null&&!purchaseMoney_(r.unitCost))return {status:400,error:'Enter a unit price with up to two decimal places, or leave it blank.'};
 if(r.url&&!/^https:\/\/[^\s<>"']{1,500}$/.test(r.url))return {status:400,error:'Use an https item link.'};
 if(records.filter(x=>x.email===a.email&&Date.parse(x.createdAt)>Date.now()-86400000).length>=15)return {status:429,error:'Please discuss your existing requests before adding more.'};
 const at=new Date().toISOString();purchaseSave_('PurchaseBoardWeb',{id:r.id,revision:1,title:r.title.trim(),reason:r.reason.trim(),url:r.url||'',quantity:r.quantity,unitCost:r.unitCost===undefined?null:r.unitCost,shipping:0,fund:r.fund,divisions:allDivisions?PURCHASE_PERIODS.slice():r.divisions,allDivisions,stage:'discussion',email:a.email,author:a.name,createdAt:at,updatedAt:at,comments:[],history:[{action:'Created request',stage:'discussion',author:a.name,at}]});return {status:200,saved:true};
}
function purchaseChange_(a,r){
 const record=purchaseRecords_('PurchaseBoardWeb').find(x=>x.id===r.id);if(!record||!purchaseVisible_(a,record))return {status:404};
 if(record.revision!==r.revision)return {status:409,error:'This request changed. Refresh it before saving.'};
 const at=new Date().toISOString();
 if(r.operation==='comment'){
  if(record.stage==='archived')return {status:409,error:'This request is archived. Restore an unpurchased request to continue discussion.'};
  if(!purchaseUuid_(r.commentId)||!purchaseText_(r.text,2000))return {status:400,error:'Enter a discussion comment.'};
  if(record.comments.some(c=>c.id===r.commentId))return {status:200,saved:true};
  if(record.comments.length>=50)return {status:400,error:'Start a follow-up request to continue this discussion.'};
  record.comments.push({id:r.commentId,author:a.name,email:a.email,text:r.text.trim(),at});
 }else{
  if(!a.manager)return {status:403};
  if(record.purchaseState==='processing'||record.purchaseState==='review-required')return {status:409,error:'Review the linked purchase before changing this requisition.'};
  if(!PURCHASE_STATES.includes(r.stage)||(!a.admin&&['approved','ordered','declined'].includes(r.stage)))return {status:403,error:'Administrator approval is required for this status.'};
  if(r.stage==='ordered'&&record.stage!=='ordered')return {status:400,error:'Record the purchase using the administrator form to mark it ordered.'};
  if(r.stage==='received'&&!['ordered','received'].includes(record.stage))return {status:400,error:'Record the order before marking equipment received.'};
  if(['ordered','received'].includes(record.stage)&&!['ordered','received'].includes(r.stage))return {status:400,error:'Purchased requests retain their order history. Add a follow-up discussion for changes.'};
  if(!Number.isInteger(r.quantity)||r.quantity<1||r.quantity>10000||(!purchaseMoney_(r.unitCost)&&!(r.unitCost===null&&r.stage==='discussion'))||!purchaseMoney_(r.shipping)||!['CTE','ASB'].includes(r.fund))return {status:400,error:'Enter quantity, estimated unit cost, shipping, and funding source.'};
  const oldDivisions=record.divisions.slice();
  if(r.divisions!==undefined){
   const all=Array.isArray(r.divisions)&&r.divisions.length===1&&r.divisions[0]==='ALL';
   if(!Array.isArray(r.divisions)||!r.divisions.length||new Set(r.divisions).size!==r.divisions.length||(!all&&r.divisions.some(p=>!PURCHASE_PERIODS.includes(p))))return {status:400,error:'Choose a requesting division or All divisions.'};
   record.divisions=all?PURCHASE_PERIODS.slice():r.divisions;record.allDivisions=all||PURCHASE_PERIODS.every(p=>record.divisions.includes(p));
  }
  Object.assign(record,{stage:r.stage,quantity:r.quantity,unitCost:r.unitCost,shipping:r.shipping,fund:r.fund});record.history.push({stage:r.stage,author:a.name,at,fromDivisions:oldDivisions,divisions:record.divisions.slice()});if(record.history.length>200)return {status:400,error:'Request history is full.'};
 }
 record.updatedAt=at;record.revision++;purchaseSave_('PurchaseBoardWeb',record);return {status:200,saved:true};
}
function purchaseOptions_(diagnostic){
 const form=FormApp.openById(CONFIG.FORM_ID);let items;
 function choices(id,match){let item;try{item=form.getItemById(id);}catch(_){}if(!item||!match.test(item.getTitle())){items=items||form.getItems();item=items.find(x=>match.test(x.getTitle()));}if(!item)return [];const type=String(item.getType()),method={LIST:'asListItem',MULTIPLE_CHOICE:'asMultipleChoiceItem',CHECKBOX:'asCheckboxItem'}[type];return method?item[method]().getChoices().map(c=>c.getValue()):[];}
 const options={types:['New Purchase','Updated Purchase','Return','ASB Purchase Request',PURCHASE_PRACTICE_TYPE],vendors:choices(1421458905,/^Vendor$/i),foodTypes:choices(1302789551,/Is this a food purchase/i),previous:choices(1448798513,/original|previous purchase|purchase.*updat|purchase.*return/i)};
 if(!options.foodTypes.length)throw Error('Purchase choices are unavailable.');
 // Cache only form choices; transaction preview/commit always call this fresh reader.
 try{const json=JSON.stringify(options);if(json.length<40000)CacheService.getScriptCache().put('purchase-web-choices-v1',json,300);}catch(_){}
 if(diagnostic){
  const logs=SpreadsheetApp.openById(CONFIG.MANAGER_SS_ID).getSheetByName('BudgetLogs');options.headers=logs.getRange(1,1,1,Math.max(45,logs.getLastColumn())).getDisplayValues()[0].slice(0,45);
  options.formItems=(items||form.getItems()).map(x=>({id:x.getId(),title:x.getTitle(),type:String(x.getType())}));
  options.signInItems=FormApp.openById(PURCHASE_SIGNIN_FORM).getItems().map(x=>({title:x.getTitle(),type:String(x.getType())}));
 }
 return options;
}
function purchaseCachedOptions_(){
 try{const raw=CacheService.getScriptCache().get('purchase-web-choices-v1');if(raw){const data=JSON.parse(raw);if(Array.isArray(data.foodTypes)&&data.foodTypes.length&&Array.isArray(data.vendors)&&Array.isArray(data.previous))return data;}}catch(_){}
 return purchaseOptions_();
}

function purchaseAttendance_(day,group){
 group=group||'Attendance_Food Sign-In';if(!PURCHASE_ATTENDANCE_GROUPS.includes(group))return {status:400,error:'Choose an attendance group.'};
 if(!purchaseDate_(day))return {status:400,error:'Choose the food purchase date.'};
 const form=FormApp.openById(PURCHASE_SIGNIN_FORM),start=Utilities.parseDate(day,'America/Los_Angeles','yyyy-MM-dd');
 const responses=form.getResponses(start).filter(x=>Utilities.formatDate(x.getTimestamp(),'America/Los_Angeles','yyyy-MM-dd')===day);
 const names=[];let count=0;
 for(const response of responses){
  const answers=response.getItemResponses(),value=title=>{const item=answers.find(x=>title.test(x.getItem().getTitle().trim()));return item?String(item.getResponse()||'').trim():'';};
  const location=value(/^Choose your location$/i);if(location!==group)continue;
  count++;let name=value(/^Select your name$/i);if(!name){const first=value(/^FIRST name$/i),last=value(/^LAST name$/i);if(first&&last)name=last+', '+first;}
  if(name)names.push(name);
 }
 return {status:200,day,names:[...new Set(names)].sort(),source:'NEST™ Sign-In System · '+group,group,count,needsReview:count>0&&!names.length};
}
function purchaseDraft_(r,options){
 const d=r.draft;if(!d||!options.types.includes(d.type)||!purchaseText_(d.vendor,150)||!purchaseDate_(d.day)||!purchaseText_(d.description,2000)||!purchaseMoney_(d.amount)||!purchaseMoney_(d.shipping)||!['Yes','No'].includes(d.taxed)||!options.foodTypes.includes(d.foodType))throw Error('Complete the purchase fields using current form choices.');
 if(['Updated Purchase','Return'].includes(d.type)&&!options.previous.includes(d.original))throw Error('Choose the original purchase.');
 if(['Updated Purchase','Return'].includes(d.type)&&wasOriginalPurchaseFood_(d.original)&&!d.foodType.startsWith('Yes'))throw Error('The original purchase was food. Choose its CTE or ASB food route and verify the students fed.');
 const food=d.foodType.startsWith('Yes');if(food&&!PURCHASE_ATTENDANCE_GROUPS.includes(d.attendanceGroup))throw Error('Choose the attendance group for this food purchase.');if(food&&(!Array.isArray(d.attendees)||!d.attendees.length||d.attendees.length>1000||d.attendees.some(n=>!purchaseText_(n,150))))throw Error('Include the students fed on the purchase date.');
 if(!Array.isArray(d.links)||d.links.length>10||new Set(d.links.map(x=>x.id)).size!==d.links.length||d.links.some(x=>!purchaseUuid_(x.id)||!Number.isInteger(x.revision)))throw Error('Refresh the requisition selection.');
 let items=[];if(d.type==='ASB Purchase Request'){
  if(!Array.isArray(d.items)||!d.items.length||d.items.length>10||d.items.some(x=>!purchaseText_(x.description,300)||!purchaseMoney_(x.price)))throw Error('Add up to ten ASB line items with extended prices.');
  if(!purchaseText_(d.vendorDetails,1000))throw Error('Enter the ASB vendor address or website.');items=d.items.map(x=>({description:x.description.trim(),price:x.price}));
 }
 return {type:d.type,vendor:d.vendor.trim(),day:d.day,description:d.description.trim(),amount:d.amount,shipping:d.shipping,taxed:d.taxed,foodType:d.foodType,original:d.original||'',attendees:food?[...new Set(d.attendees.map(n=>n.trim()))]:[],attendanceGroup:food?d.attendanceGroup:'',links:d.links.map(x=>({id:x.id,revision:x.revision})),items,vendorDetails:d.vendorDetails||''};
}
function purchaseLinked_(d){const records=purchaseRecords_('PurchaseBoardWeb');return d.links.map(link=>{const record=records.find(x=>x.id===link.id);if(!record||record.revision!==link.revision||!['requisition','approved'].includes(record.stage)||record.purchaseState==='processing'||record.purchaseState==='review-required'||(d.type==='ASB Purchase Request'&&record.asbRequested))throw Error('A selected requisition changed, was already purchased, or already has an ASB request.');return record;});}
function purchaseReceipt_(input,id){
 if(!input||!['application/pdf','image/jpeg','image/png'].includes(input.type)||typeof input.data!=='string'||input.data.length>2800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))throw Error('Upload a PDF, JPEG, or PNG receipt under 2 MB.');
 const bytes=Utilities.base64Decode(input.data),b=bytes.map(v=>v&255),valid=input.type==='application/pdf'?b.slice(0,5).join(',')==='37,80,68,70,45':input.type==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:b.slice(0,8).join(',')==='137,80,78,71,13,10,26,10';if(!valid||bytes.length>2*1024*1024)throw Error('The receipt content does not match its file type.');
 const props=PropertiesService.getScriptProperties();let folderId=props.getProperty('purchase-web-receipts');if(!folderId){folderId=DriveApp.createFolder('NEST Private Website Purchase Receipts').getId();props.setProperty('purchase-web-receipts',folderId);}
 const folder=DriveApp.getFolderById(folderId),ext={'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png'}[input.type],name='purchase-'+id+ext,existing=folder.getFilesByName(name);if(existing.hasNext())return existing.next().getUrl();return folder.createFile(Utilities.newBlob(bytes,input.type,name)).getUrl();
}
function purchasePreview_(a,r){
 if(!a.admin)return {status:403};if(!purchaseUuid_(r.id))return {status:400};
 const runs=purchaseRecords_('PurchaseRunsWeb'),existing=runs.find(x=>x.id===r.id);if(existing&&existing.state!=='preview')return {status:409,error:'This purchase has already been submitted. Check purchase history.'};
 let draft,linked,budget,options;try{options=purchaseOptions_();draft=purchaseDraft_(r,options);linked=purchaseLinked_(draft);budget=purchaseBudget_();}catch(e){return {status:400,error:e.message};}
 if(existing&&existing.email!==a.email)return {status:403};
 let receiptUrl=existing&&existing.receiptUrl||'';
 if(draft.type!=='ASB Purchase Request')try{if(r.receipt)receiptUrl=purchaseReceipt_(r.receipt,r.id);if(!receiptUrl)throw Error('Upload the purchase receipt.');}catch(e){return {status:400,error:e.message};}
 const asb=draft.type==='ASB Purchase Request',food=draft.foodType.startsWith('Yes'),impact=asb||food||draft.type===PURCHASE_PRACTICE_TYPE?0:(draft.type==='Return'?-draft.amount:draft.amount);
 const recipient=asb?getRecipientEmail_('ASB'):getRecipientEmail_(draft.foodType.includes('ASB')?'ASB':draft.foodType.includes('CTE')?'CTE':'Default');
 const receiptDigest=r.receipt?purchaseHash_(r.receipt.data):existing&&existing.receiptDigest||'';
 const record={id:r.id,email:a.email,state:'preview',draft,receiptUrl,receiptDigest,budgetRevision:budget.revision,createdAt:new Date().toISOString(),expires:Date.now()+15*60000};if(existing)record._row=existing._row;
 purchaseSave_('PurchaseRunsWeb',record);
 return {status:200,preview:{id:r.id,type:draft.type,vendor:draft.vendor,amount:draft.amount,recipient,receipt:receiptUrl,receiptName:asb?'ASB request PDF':draft.foodType.includes('ASB')?'Existing ASB receipt naming':formatCteReceiptName_(draft.day, draft.amount),balance:budget.balance,estimatedImpact:impact,linked:linked.map(x=>x.title),attendeeCount:draft.attendees.length,foodDocument:food&&draft.type!=='Return',asbTotal:asb?Math.round((draft.items.reduce((s,x)=>s+x.price,0)*1.101+draft.shipping)*100)/100:null,notice:draft.type===PURCHASE_PRACTICE_TYPE?'Emails a practice preview only to mpenalver@bethelsd.org. No purchase is recorded, no budget is changed, and no clerk or vendor is notified.':asb?'Creates an ASB request for the existing signature workflow.':food?'Food documentation keeps the existing $0 budget impact.':draft.type==='Updated Purchase'?'Replaces the original budget entry. The balance change depends on its original amount.':'Logs a completed transaction and sends the receipt using the existing workflow.'}};
}
function purchaseValues_(draft,receipt){const v=Array(45).fill('');v[0]=new Date();v[1]=draft.type;v[2]=draft.vendor;v[3]=draft.vendorDetails;draft.items.forEach((item,i)=>{v[4+i*3]=item.description;v[5+i*3]=item.price;});v[34]=draft.original;v[35]=draft.day.slice(5,7)+'/'+draft.day.slice(8,10)+'/'+draft.day.slice(0,4);v[36]=draft.description;v[37]=draft.foodType;v[38]=draft.taxed;v[39]=draft.attendees.join('; ');v[40]=receipt;v[41]=draft.amount;v[42]=draft.shipping;return v;}
function purchaseCommit_(a,r){
 if(!a.admin)return {status:403};const record=purchaseRecords_('PurchaseRunsWeb').find(x=>x.id===r.id);if(!record)return {status:404};if(record.email!==a.email)return {status:403};
 if(record.draft.type===PURCHASE_PRACTICE_TYPE)return purchasePracticeCommit_(a,record);
 if(record.state!=='preview')return {status:200,saved:record.state==='complete',state:record.state,message:record.message||''};
 let linked;try{if(record.expires<Date.now()||purchaseBudget_().revision!==record.budgetRevision)throw Error('The budget or preview changed. Preview this purchase again.');purchaseDraft_({draft:record.draft},purchaseOptions_());linked=purchaseLinked_(record.draft);}catch(e){return {status:409,error:e.message};}
 const duplicate=record.receiptDigest&&purchaseRecords_('PurchaseRunsWeb').some(x=>x.id!==record.id&&x.receiptDigest===record.receiptDigest&&['processing','complete','review-required'].includes(x.state)&&x.draft.type===record.draft.type&&x.draft.day===record.draft.day&&x.draft.vendor===record.draft.vendor&&x.draft.amount===record.draft.amount);
 if(duplicate)return {status:409,error:'This receipt and transaction already appear in website purchase history. Review the saved record before submitting again.'};
 const sheet=SpreadsheetApp.openById(CONFIG.MANAGER_SS_ID).getSheetByName('BudgetLogs'),headers=sheet.getRange(1,1,1,45).getDisplayValues()[0];
 if(!/timestamp/i.test(headers[0])||!/vendor/i.test(headers[2])||!/purchase date/i.test(headers[35])||!/receipt/i.test(headers[40])||!/amount/i.test(headers[41]))return {status:503,error:'BudgetLogs columns changed. The web form needs review before processing.'};
 record.state='processing';record.message='Processing started. Do not resubmit using the Google Form.';purchaseSave_('PurchaseRunsWeb',record);
 try{
  linked.forEach(x=>{x.purchaseState='processing';x.revision++;purchaseSave_('PurchaseBoardWeb',x);});
  const values=purchaseValues_(record.draft,record.receiptUrl),row=sheet.getLastRow()+1;record.sourceRow=row;purchaseSave_('PurchaseRunsWeb',record);
  // All free text is literal. This is the response-row shape expected by the unchanged processor.
  const input=values.map(v=>typeof v==='string'&&/^[=+\-@]/.test(v)?"'"+v:v);sheet.getRange(row,1,1,45).setValues([input]);SpreadsheetApp.flush();
  processFormResponse({values,range:sheet.getRange(row,1,1,45),source:sheet.getParent()});
  record.state='complete';record.message='Processed by the existing budget workflow.';purchaseSave_('PurchaseRunsWeb',record);
  linked.forEach(x=>{const before=purchaseRequestSnapshot_(x);x.purchaseState=record.draft.type==='ASB Purchase Request'?'asb-requested':'complete';if(record.draft.type==='ASB Purchase Request')x.asbRequested=true;if(record.draft.type==='New Purchase'){const at=new Date().toISOString();x.stage='archived';x.archivedFrom='purchased';x.purchasedAt=at;x.purchasedDate=record.draft.day;x.archivedAt=at;x.purchaseRunId=record.id;}x.revision++;x.updatedAt=new Date().toISOString();purchaseAudit_(x,a,record.draft.type==='New Purchase'?'Purchased and automatically archived':'Purchase workflow recorded',before,purchaseRequestSnapshot_(x));purchaseSave_('PurchaseBoardWeb',x);});
 }catch(error){record.state='review-required';record.message='Processing stopped after it started. Check BudgetLogs row '+(record.sourceRow||'pending')+' and sent mail before recovery. Automatic retry is disabled.';purchaseSave_('PurchaseRunsWeb',record);linked.forEach(x=>{x.purchaseState='review-required';x.revision++;purchaseSave_('PurchaseBoardWeb',x);});console.error('Purchase processing stopped',record.id,String(error));return {status:200,saved:false,state:record.state,message:record.message};}
 // A maintenance error must never turn a completed transaction into a retry.
 try{syncCurrentBudgetToNest_();updateFormDescription_();syncVendorsToForm();syncPreviousPurchasesToForm();}catch(_){record.message+=' Budget/form refresh is pending the existing maintenance schedule.';purchaseSave_('PurchaseRunsWeb',record);}
 return {status:200,saved:true,state:'complete',message:record.message};
}
function purchaseDispatch_(a,r){
 if(r.operation==='service-import')return purchaseServiceImport_(a,r);
 if(r.operation==='service-change')return purchaseServiceChange_(a,r);
 if(r.operation==='service-visibility')return purchaseServiceVisibility_(a,r);
 if(r.operation==='service-client-action')return purchaseServiceClientAction_(a,r);
 if(r.operation==='service-status')return purchaseServiceStatuses_(a,r);
 if(/^list-/.test(r.operation))return purchaseListDispatch_(a,r);
 if(r.operation==='request-action')return purchaseRequestAction_(a,r);
 if(r.operation==='request-edit')return purchaseRequestEdit_(a,r);
 if(r.operation==='budget-reference')return purchaseBudgetReference_(a);
 if(r.operation==='purchase-history')return purchaseFinancialHistory_(a,r);
 if(r.operation==='food-document')return purchaseFoodDocument_(a,r);
 if(r.operation==='asb-preview')return purchaseAsbPreview_(a,r);
 if(r.operation==='asb-commit')return purchaseAsbCommit_(a,r);
 if(r.operation==='view')return purchaseView_(a);
 if(r.operation==='admin')return a.admin?{status:200,options:purchaseCachedOptions_(),access:{admin:true,manager:true,canTriage:true,listManager:true,periods:PURCHASE_PERIODS.slice()}}:{status:403};
 if(r.operation==='attendance')return a.admin?purchaseAttendance_(r.day,r.group):{status:403};
 if(r.operation==='create')return purchaseCreate_(a,r);
 if(r.operation==='item-link')return purchaseItemLink_(a,r);
 if(['comment','update'].includes(r.operation))return purchaseChange_(a,r);
 if(r.operation==='preview')return purchasePreview_(a,r);
 if(r.operation==='commit')return purchaseCommit_(a,r);
 return {status:400};
}
// Read-only schema and attendance diagnostics; never submits purchases or sends email.
function Tool_InspectPurchaseWebsite(){
 const options=purchaseOptions_(true);Logger.log(JSON.stringify({headers:options.headers,foodTypes:options.foodTypes,formItems:options.formItems,signInItems:options.signInItems,previousCount:options.previous.length}));
 const attendance=purchaseAttendance_(Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd'));Logger.log(JSON.stringify({locations:FormApp.openById(PURCHASE_SIGNIN_FORM).getItems(FormApp.ItemType.LIST).filter(x=>/Choose your location/i.test(x.getTitle())).flatMap(x=>x.asListItem().getChoices().map(c=>c.getValue())),publishedUrl:FormApp.openById(PURCHASE_SIGNIN_FORM).getPublishedUrl()}));
 Logger.log(JSON.stringify({attendanceCount:attendance.names.length,responseCount:attendance.count,needsReview:attendance.needsReview}));
 Logger.log(JSON.stringify(purchaseBudget_()));
}
function purchaseAsbRows_(){
 const sheet=SpreadsheetApp.openById(CONFIG.MANAGER_SS_ID).getSheetByName(CONFIG.REQUESTS_SHEET_NAME);if(!sheet||sheet.getLastRow()<2)return [];
 if(sheet.getLastRow()>5001)throw Error('ASB request archive needs maintenance');
 const range=sheet.getRange(2,1,sheet.getLastRow()-1,8),values=range.getDisplayValues(),formulas=range.getFormulas(),rich=range.getRichTextValues(),rules=range.getDataValidations();
 return values.map((v,i)=>{if(!v[3])return null;const formula=formulas[i][2],match=formula&&formula.match(/"(https:\/\/[^"]+)"/),pdf=match?match[1]:rich[i][2]&&rich[i][2].getLinkUrl()||'',rule=rules[i][0],choices=rule&&String(rule.getCriteriaType())==='VALUE_IN_LIST'?rule.getCriteriaValues()[0]:[];return {id:purchaseHash_((i+2)+'|'+v[3]+'|'+v[5]),revision:purchaseHash_(JSON.stringify([v,formula])),row:i+2,action:v[0],status:v[1],vendor:v[3],total:v[4],day:v[5],pdf,choices:choices.filter(c=>['Approved','Send to ASB Director','Mark as Complete'].includes(c))};}).filter(Boolean);
}
function purchaseAsbPublic_(){return purchaseAsbRows_().slice(-50).reverse().map(({row,...x})=>x);}
function purchaseAsbPreview_(a,r){
 if(!a.admin)return {status:403};if(!purchaseUuid_(r.ticket))return {status:400};
 const x=purchaseAsbRows_().find(x=>x.id===r.id);if(!x)return {status:404};if(x.revision!==r.revision)return {status:409};
 if(purchaseRecords_('PurchaseAsbActionsWeb').some(a=>a.request===x.id&&['processing','review-required'].includes(a.state)))return {status:409,error:'An earlier ASB action needs review before continuing.'};
 if(r.change==='Send to ASB Director'&&x.action===r.change&&/Sent to ASB/i.test(x.status))return {status:409,error:'This request was already sent to the ASB clerk.'};
 if(!x.choices.includes(r.change))return {status:400};
 if(r.change==='Approved'&&!/^Select Action|^$/i.test(x.action))return {status:409,error:'This ASB request has already entered its workflow. Review the current status before starting another signature chain.'};
 const queue=r.change==='Approved'?getOrderedExecQueue_():[];if(r.change==='Approved'&&!queue.length)return {status:400,error:'No executive signature queue is available.'};
 const recipients=r.change==='Approved'?[queue[0].email]:r.change==='Send to ASB Director'?[getRecipientEmail_('ASB')]:[];
 const record={id:r.ticket,request:x.id,revision:x.revision,change:r.change,email:a.email,state:'preview',recipients,expires:Date.now()+10*60000,createdAt:new Date().toISOString()};purchaseSave_('PurchaseAsbActionsWeb',record);
 return {status:200,preview:{id:r.ticket,vendor:x.vendor,total:x.total,change:r.change,recipients}};
}
function purchaseAsbCommit_(a,r){
 if(!a.admin)return {status:403};const record=purchaseRecords_('PurchaseAsbActionsWeb').find(x=>x.id===r.ticket);if(!record)return {status:404};if(record.email!==a.email)return {status:403};if(record.state!=='preview')return {status:200,saved:record.state==='complete',state:record.state,message:'ASB action '+record.state+'. Refresh the saved status before continuing.'};
 const x=purchaseAsbRows_().find(x=>x.id===record.request);if(!x||x.revision!==record.revision||record.expires<Date.now())return {status:409,error:'ASB request changed or the preview expired. Refresh and preview again.'};
 record.state='processing';purchaseSave_('PurchaseAsbActionsWeb',record);
 try{const sheet=SpreadsheetApp.openById(CONFIG.MANAGER_SS_ID).getSheetByName(CONFIG.REQUESTS_SHEET_NAME),range=sheet.getRange(x.row,1);range.setValue(record.change);SpreadsheetApp.flush();onEdit_Requests({range,value:record.change});record.state='complete';purchaseSave_('PurchaseAsbActionsWeb',record);return {status:200,saved:true,message:'ASB request action completed using the existing signature workflow.'};}
 catch(_){record.state='review-required';purchaseSave_('PurchaseAsbActionsWeb',record);return {status:200,saved:false,state:record.state,message:'ASB processing needs review. Check the request status and sent mail before any recovery; automatic retry is disabled.'};}
}
// Optional attachment proof uses the same renderer as the final food purchase.
function purchaseFoodDocument_(a,r){
 if(!a.admin)return {status:403};const record=purchaseRecords_('PurchaseRunsWeb').find(x=>x.id===r.id);if(!record||record.email!==a.email)return {status:404};if(record.state!=='preview'||record.expires<Date.now()||(!record.draft.foodType.startsWith('Yes')||record.draft.type==='Return'))return {status:409,error:'Create a current food purchase preview first.'};
 if(record.documentUrl)return {status:200,document:record.documentUrl};
 const d=record.draft,values=purchaseValues_(d,record.receiptUrl),original=d.type==='Updated Purchase'&&wasOriginalPurchaseFood_(d.original)?parseOriginalPurchaseKey_(d.original):null,blob=createFoodPurchasePdf_({purchaseDate:original?original.dateStr:values[35],vendor:original?original.vendor:d.vendor,description:'🍕_$'+(original?original.amount:d.amount).toFixed(2)+'_'+d.description,foodPurchaseType:d.foodType,studentsFed:d.attendees.join('; '),receiptUrl:record.receiptUrl,amount:0,taxed:'N'});
 const folder=PropertiesService.getScriptProperties().getProperty('purchase-web-receipts');if(!folder)throw Error('Receipt preview folder missing');blob.setName('PREVIEW_Food_Purchase_'+record.id+'.pdf');record.documentUrl=DriveApp.getFolderById(folder).createFile(blob).getUrl();purchaseSave_('PurchaseRunsWeb',record);return {status:200,document:record.documentUrl};
}
// The legacy correction path calls this helper; its synced choices mark food explicitly.
function wasOriginalPurchaseFood_(original){return /\(FOOD\)\s*$/i.test(String(original||''));}

function purchaseItemLink_(a,r){
 const record=purchaseRecords_('PurchaseBoardWeb').find(x=>x.id===r.id);if(!record||!purchaseVisible_(a,record))return {status:404};
 if(!a.manager&&!a.admin&&!a.listManager&&record.email!==a.email)return {status:403};
 if(record.revision!==r.revision)return {status:409,error:'This request changed. Refresh it before changing the link.'};
 if(typeof r.url!=='string'||(r.url.trim()&&!/^https:\/\/[^\s<>"']{1,500}$/.test(r.url.trim())))return {status:400,error:'Use the full https item link, or leave it blank.'};
 const edits=record.itemLinkHistory||[];if(edits.length>=50)return {status:400,error:'This link has reached its edit limit. Ask the administrator to review its history.'};edits.push({from:record.url,to:r.url.trim(),actor:a.email,at:new Date().toISOString()});record.itemLinkHistory=edits;
 record.url=r.url.trim();record.revision++;record.updatedAt=new Date().toISOString();purchaseSave_('PurchaseBoardWeb',record);return {status:200,saved:true};
}

// Separate from fiscal commit: this path only sends the self-addressed practice email.
function purchasePracticeCommit_(a,record){
 if(!a.admin||a.email!=='mpenalver@bethelsd.org'||record.email!==a.email)return {status:403};
 if(record.state!=='preview')return {status:200,practice:true,saved:record.state==='practice-complete',state:record.state,message:record.message||'Check the saved practice email status before retrying.'};
 try{if(record.expires<Date.now())throw Error('Preview expired. Prepare the practice purchase again.');purchaseDraft_({draft:record.draft},purchaseOptions_());}catch(e){return {status:409,error:e.message};}
 record.state='practice-sending';record.message='Practice email started. Check your inbox before attempting another preview.';purchaseSave_('PurchaseRunsWeb',record);
 try{
  const result=processPracticePurchase_({values:purchaseValues_(record.draft,record.receiptUrl)});
  record.state='practice-complete';record.practiceRecipient=result.previewTo;record.productionRecipient=result.productionTo;record.message='Practice email sent only to '+result.previewTo+'. Intended production recipient: '+result.productionTo+'. No purchase was recorded or clerk notified.';
 }catch(e){record.state='practice-review-required';record.message='Practice delivery could not be confirmed. Check your inbox before trying again. No purchase was recorded.';}
 purchaseSave_('PurchaseRunsWeb',record);
 return {status:200,practice:true,saved:record.state==='practice-complete',state:record.state,message:record.message};
}

function purchaseIsPractice_(record){
 return /^Practice Purchase\b/i.test(String(record.type||(record.draft&&record.draft.type)||''))||/^practice-/.test(String(record.state||''))||/^PRACTICE ONLY/i.test(String(record.emailStatus||''));
}
function purchaseRecentRuns_(){
 const records=purchaseRecords_('PurchaseRunsWeb').filter(x=>x.state!=='preview'&&purchaseSchoolYear_(x.createdAt||x.draft.day)===getCurrentSchoolYear());
 return records.filter(x=>!purchaseIsPractice_(x)).slice(-30).concat(records.filter(purchaseIsPractice_).slice(-30)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(x=>({id:x.id,state:x.state,type:x.draft.type,vendor:x.draft.vendor,amount:x.draft.amount,at:x.createdAt,message:x.message||'',receipt:x.receiptUrl||''}));
}
