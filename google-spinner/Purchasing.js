// Only this school bridge resolves the caller's live membership and role.
const PURCHASE_BUDGET_URL = 'https://script.google.com/macros/s/AKfycbwROElSh-vX1_QGOgVYJpcwkzpxJLfRF_UjmGuiu5cQbXbXElXW7z6DE5v2jzrB9Y4z/exec'; // Filled with the deployed PurchaseLog web app URL.
function purchasingDiscussionRole_(period,role){
 const title=String(role||'').trim().replace(/[-–]/g,' ').replace(/\s+/g,' ');
 return /^(division manager|assistant (?:division )?manager|director of inventory|inventory director)$/i.test(title)||
  (period==='CTSO'&&/^(chief .+ officers?|executive(?: vice)? presidents?)$/i.test(title));
}
function purchasingActor_(session){
 const admin=websiteAdmin_(session.email),periods=[],rosters={},addresses={},groups=new Set();let listManager=false;
 Object.keys(PERIODS).forEach(period=>{rosters[period]=new Set(rows_(period).map(row=>email_(row[1])));addresses[period]=memberEmail_(session.email,period);if(rosters[period].has(addresses[period])||staffRole_(session.email,period))periods.push(period);if(staffManager_(session.email,period)){groups.add('division:'+period);groups.add('managers');listManager=true;}});
 const leaders=(typeof nestAccessValues_==='function'?nestAccessValues_:Sheets.Spreadsheets.Values.get)(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[],team=new Map();
 for(const row of leaders){
  const period=String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase(),email=email_(row[4]),role=String(row[2]||'').trim(),name=String(row[3]||'').trim();
  if(!rosters[period]||!rosters[period].has(email)||!name||!role)continue;
  if(addresses[period]===email){groups.add('division:'+period);groups.add('all-leadership');if(/^(division manager|assistant (?:division )?manager)$/i.test(role)){listManager=true;groups.add('managers');}if(/^(director of inventory|inventory director)$/i.test(role))groups.add('inventory');if(period==='CTSO'&&/^(chief .+ officers?|executive(?: vice[- ]?)?presidents?)$/i.test(role))groups.add('robotics-executives');}
  if(!purchasingDiscussionRole_(period,role))continue;
  if(!team.has(email))team.set(email,{id:hash_('purchase-discussion:'+email),name,email,roles:[]});
  const person=team.get(email);if(!person.roles.some(x=>x.period===period&&x.position===role))person.roles.push({period,position:role});
 }
 const mine=[...team.values()].filter(person=>person.roles.some(role=>addresses[role.period]===person.email));
 const manager=admin||mine.some(person=>person.roles.some(role=>/^(director of inventory|inventory director)$/i.test(role.position)));
 return {email:session.email,name:session.username,periods,manager,admin,listManager,groups:[...groups],allDivisionLeadership:admin||mine.length>0,discussionTeam:[...team.values()].map(({email,...person})=>person).sort((a,b)=>a.name.localeCompare(b.name))};
}
function purchasingDispatch_(r){try{return purchasingWork_(r);}catch(error){console.error('Purchasing action failed',{operation:r.operation,name:error.name,frames:String(error.stack||'').split('\n').slice(1,5).join('\n')});return {...nestServiceFailure_('auth-purchasing',error),error:'Inventory and purchasing could not load. Refresh the saved status before retrying.'};}}
function purchasingWork_(r){
 const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());if(!session)return {status:401};
 const adminAction=['purchase-history','admin','attendance','preview','commit','food-document','asb-preview','asb-commit'].includes(r.operation),owner=email_(session.email)==='mpenalver@bethelsd.org';
 if(adminAction&&!owner)return {status:403};
 const actor=adminAction?{email:session.email,name:session.username,periods:[],manager:true,admin:true,allDivisionLeadership:true,discussionTeam:[]}:purchasingActor_(session);if(!actor.manager&&!actor.periods.length)return {status:403};
 if(r.operation==='budget-reference'&&!actor.admin&&!(actor.groups||[]).includes('all-leadership'))return {status:403};
 if(r.operation==='service-lists')return serviceShoppingInventory_(session,actor);
 if(r.operation==='update'&&!actor.manager)return {status:403};
 if(!['budget-reference','purchase-history','request-action','request-edit','list-create','list-edit','list-remove','list-restore','list-item-add','list-item-edit','list-item-remove','list-item-restore','view','admin','attendance','create','item-link','comment','update','preview','commit','food-document','asb-preview','asb-commit'].includes(r.operation))return {status:400};
 if(!PURCHASE_BUDGET_URL)return {status:503,error:'Purchasing is being connected to the budget workflow.'};
 const fields={'purchase-history':['year'],'request-action':['id','revision','change','newId','day'],'request-edit':['id','revision','title','reason','quantity','unitCost','shipping','fund','url'],'list-create':['id','name','description','group'],'list-edit':['id','revision','name','description'],'list-remove':['id','revision'],'list-restore':['id','revision'],'list-item-add':['id','revision','itemId','title','reason','quantity','unitCost','url'],'list-item-edit':['id','revision','itemId','title','reason','quantity','unitCost','url'],'list-item-restore':['id','revision','itemId'],'list-item-remove':['id','revision','itemId'],'food-document':['id'],'asb-preview':['id','revision','change','ticket','signaturesConfirmed'],'asb-commit':['ticket'],attendance:['day','group'],create:['id','title','reason','url','unitCost','quantity','divisions','fund'],'item-link':['id','revision','url'],comment:['id','revision','commentId','text'],update:['id','revision','divisions','quantity','unitCost','shipping','fund','stage'],preview:['id','draft','receipt'],commit:['id']}[r.operation]||[];
 return purchasingBudgetRequest_(r.token,actor,r.operation,Object.fromEntries(fields.filter(key=>r[key]!==undefined).map(key=>[key,r[key]])));
}
function purchasingBudgetRequest_(token,actor,operation,fields){
 const payload={action:'purchase-web',token,actor,operation,...fields};
 const response=UrlFetchApp.fetch(PURCHASE_BUDGET_URL,{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw Error('Budget service unavailable');const result=JSON.parse(response.getContentText());if(!Number.isInteger(result.status))throw Error('Invalid budget response');return result;
}
