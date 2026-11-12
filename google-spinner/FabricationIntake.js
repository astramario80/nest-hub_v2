// Native fabrication intake. Identity and files are verified on the school server.
const FAB_INTAKE_TAB='Website Fabrication';
// Uploads use a private root, without inheriting the source form folder's sharing.
const FAB_INTAKE_ROOT_KEY='fab-intake-private-root';
const FAB_INTAKE_HEADERS=['Status','Status Log','Notes','Timestamp','Email Address','Requester name','Equipment','Division','Service request','STL file','Formatted file','Minutes','Grams','Calculator screenshot','Cost before markup','Width','Length','DXF file','Website submission','Submission fingerprint','Product Calculator result'];
const FAB_INTAKE_MACHINES=['Sketch Large: Wall E II, R2, Atto','Laser cutter','Water jet cutter'];
function fabIntakeUuid_(v){return typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);}
function fabIntakeMembers_(session){
 const choices=[];Object.keys(PERIODS).forEach(period=>{const address=memberEmail_(session.email,period);const matches=rows_(period).filter(row=>email_(row[1])===address);if(matches.length===1)choices.push({period,name:String(matches[0][0]),email:address});});
 if(!choices.length&&websiteAdmin_(session.email))choices.push({period:'GUEST',name:'Mario Peñalver',email:session.email});
 return choices;
}
function fabIntakeFolder_(parent,key,name){const result=Drive.Files.list({q:"trashed=false and '"+parent+"' in parents and appProperties has {key='nestFabricationFolder' and value='"+key+"'}",fields:'files(id)',pageSize:2}).files||[];if(result.length>1)throw Error('Duplicate fabrication folders');return result[0]?.id||Drive.Files.create({name,mimeType:'application/vnd.google-apps.folder',parents:[parent],writersCanShare:false,appProperties:{nestFabricationFolder:key}},null,{fields:'id'}).id;}
function fabIntakeFile_(r,actor,slot){
 const matches=Drive.Files.list({q:"trashed=false and appProperties has {key='nestFabricationFile' and value='"+r.submission+'-'+slot+"'}",fields:'files(id,size,mimeType,appProperties)',pageSize:2}).files||[];
 if(matches.length>1)throw Error('Duplicate fabrication files');const f=matches[0];if(f&&f.appProperties.nestFabricationActor!==hash_(actor))return null;return f;
}
function fabIntakeUpload_(session,r,store){
 if(!['stl','formatted','calculator','dxf'].includes(r.slot))return {status:400};
 if(read_(store,'fab-intake-done:'+hash_(session.email+'|'+r.submission),Date.now()))return {status:409,error:'This request is already submitted.'};
 const f=r.file,types={stl:/\.stl$/i,formatted:/\.(makerbot|3mf|gcode|gco|ufp|zip)$/i,calculator:/\.(png|jpe?g|webp)$/i,dxf:/\.dxf$/i};
 if(!f||typeof f.name!=='string'||f.name.length>180||/[\u0000-\u001f\/\\]/.test(f.name)||!types[r.slot].test(f.name)||!Number.isSafeInteger(f.size)||f.size<1||f.size>100*1024*1024||r.slot==='calculator'&&f.size>10*1024*1024)return {status:400,error:'Choose a supported file (100 MB maximum; screenshots 10 MB).'};
 const mime=r.slot==='calculator'?(/\.png$/i.test(f.name)?'image/png':/\.webp$/i.test(f.name)?'image/webp':'image/jpeg'):'application/octet-stream';
 let found=fabIntakeFile_(r,session.email,r.slot);
 if(found&&(found.appProperties.nestFabricationSize!==String(f.size)||found.appProperties.nestFabricationName!==f.name))return {status:409,error:'This upload has started. Start a new request to choose a different file.'};
 if(!found){if(!rate_(store,'fab-intake-files:'+hash_(session.email),30,86400000,Date.now()))return {status:429};let root=store.getProperty(FAB_INTAKE_ROOT_KEY);if(!root){root=Drive.Files.create({name:'NEST Private Fabrication Requests',mimeType:'application/vnd.google-apps.folder',writersCanShare:false},null,{fields:'id'}).id;store.setProperty(FAB_INTAKE_ROOT_KEY,root);}const folder=fabIntakeFolder_(root,r.submission,r.submission);found=Drive.Files.create({name:f.name,mimeType:mime,parents:[folder],writersCanShare:false,appProperties:{nestFabricationFile:r.submission+'-'+r.slot,nestFabricationActor:hash_(session.email),nestFabricationSize:String(f.size),nestFabricationName:f.name}},null,{fields:'id,size,mimeType,appProperties'});}
 if(Number(found.size)===f.size)return {status:200,complete:true};
 const key='fab-intake-upload:'+found.id,cache=CacheService.getScriptCache();let url=cache.get(key);
 if(!url||r.restart===true){const response=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/'+found.id+'?uploadType=resumable',{method:'patch',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),Origin:'https://gknest.org','X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(f.size)},contentType:'application/json',payload:'{}',muteHttpExceptions:true});if(response.getResponseCode()!==200)throw Error('Upload preparation failed');const h=response.getAllHeaders();url=h.Location||h.location;if(typeof url!=='string'||!/^https:\/\/(?:www\.)?googleapis\.com\/upload\/drive\//.test(url))throw Error('Invalid upload URL');cache.put(key,url,1800);}
 return {status:200,uploadUrl:url,type:mime};
}
function fabIntakeNumber_(v){return typeof v==='string'&&/^\d{1,7}(\.\d{1,4})?$/.test(v)&&Number(v)>0;}
function fabIntakeSubmit_(session,r,identity,store){
 const a=r.answers;if(!a||typeof a.machine!=='string'||!['Yes','No'].includes(a.service))return {status:400};
 const modern=/^[a-f0-9]{64}$/.test(a.machine),legacyPrinting=a.machine===FAB_INTAKE_MACHINES[0];
 const fingerprint=hash_(JSON.stringify(modern?[identity.period,a.machine,a.machineVersion,a.service,a.minutes,a.grams,a.markup,a.pricingRevision,a.width,a.length]:[identity.period,a.machine,a.service,legacyPrinting?[a.minutes,a.grams,a.markup,a.pricingRevision]:[a.width,a.length]]));
 const key='fab-intake-done:'+hash_(session.email+'|'+r.submission),prior=read_(store,key,Date.now());if(prior)return prior.fingerprint===fingerprint?{status:200,id:prior.id,received:true}:{status:409};
 const choice=modern?roomMachineChoices_().find(m=>m.id===a.machine&&m.fabrication):FAB_INTAKE_MACHINES.includes(a.machine)?{name:a.machine,machineType:legacyPrinting?'3d-printer':a.machine===FAB_INTAKE_MACHINES[1]?'laser-cnc':'waterjet-cnc',profile:'Sketch Large'}:null;
 if(!choice)return {status:400,error:'This machine is no longer available. Choose current equipment.'};if(modern&&choice.version!==a.machineVersion)return {status:409,error:'The machine details changed. Reopen the form and review the current equipment.'};
 const printing=choice.machineType==='3d-printer',slots=printing?['stl','formatted']:['dxf'];
 if(printing&&!choice.profile)return {status:400,error:'Inventory must configure a filament pricing profile for this printer before requests can be submitted.'};
 if(printing&&(!fabIntakeNumber_(a.minutes)||!fabIntakeNumber_(a.grams))||!printing&&(!fabIntakeNumber_(a.width)||!fabIntakeNumber_(a.length)))return {status:400,error:'Complete the time, material, cost, or dimensions for your equipment.'};
 let quote=null;if(printing){quote=fabIntakeQuote_({...a,pricingProfile:choice.profile});if(quote.status!==200)return quote;}
 const urls={};for(const slot of slots){const f=fabIntakeFile_(r,session.email,slot);if(!f||Number(f.size)!==Number(f.appProperties.nestFabricationSize))return {status:409,error:'Finish uploading all required files before submitting.'};urls[slot]='https://drive.google.com/file/d/'+f.id+'/view';}
 const book=SpreadsheetApp.openById(FAB_QUEUE);let tab=book.getSheetByName(FAB_INTAKE_TAB);if(!tab){tab=book.insertSheet(FAB_INTAKE_TAB);tab.getRange(3,1,1,FAB_INTAKE_HEADERS.length).setValues([FAB_INTAKE_HEADERS]);tab.setFrozenRows(3);}
 if(JSON.stringify(tab.getRange(3,1,1,FAB_INTAKE_HEADERS.length).getValues()[0])!==JSON.stringify(FAB_INTAKE_HEADERS))throw Error('Intake headers changed');
 const found=tab.getRange(4,19,Math.max(1,tab.getLastRow()-3),1).getValues().map(row=>String(row[0])).indexOf(r.submission);
 let raw;if(found>=0){raw=tab.getRange(found+4,1,1,FAB_INTAKE_HEADERS.length).getValues()[0];if(raw[4]!==identity.email||raw[5]!==identity.name||raw[7]!==identity.period||raw[19]!==fingerprint)return {status:409};}else{
 if(!rate_(store,'fab-intake-submit:'+hash_(session.email),10,86400000,Date.now()))return {status:429};
 // Numeric Sheets timestamp stays stable through the queue's UNFORMATTED_VALUE read.
 if(tab.getLastRow()>=5000)return {status:429,error:'The fabrication queue needs archiving before it can accept more requests.'};
 const at=Math.round((Date.now()/86400000+25569)*1e8)/1e8;raw=['Queued','','',at,identity.email,identity.name,choice.name,identity.period,a.service,urls.stl||'',urls.formatted||'',printing?a.minutes:'',printing?a.grams:'',urls.calculator||'',printing?quote.base.toFixed(2):'',printing?'':a.width,printing?'':a.length,urls.dxf||'',r.submission,fingerprint,printing?quote.summary:''];
 tab.getRange(Math.max(4,tab.getLastRow()+1),1,1,raw.length).setValues([raw.map((v,i)=>i===3?v:String(v).replace(/^([=+@-])/,'\'$1'))]);SpreadsheetApp.flush();
 }
 const id=hash_(JSON.stringify([raw[3],identity.email,identity.name]));store.setProperty(key,JSON.stringify({id,fingerprint,expires:Date.now()+30*86400000}));return {status:200,id,received:true};
}
function fabIntakeDispatch_(r){
 const store=PropertiesService.getScriptProperties(),session=authSession_(r.session,store,Date.now());if(!session)return {status:401};
 if(r.operation==='download')return fabIntakeDownload_(session,r);
 const members=fabIntakeMembers_(session);if(!members.length)return {status:403,error:'A current NEST roster identity is required to request fabrication.'};
 if(r.operation==='access')return {status:200,members:members.map(({period,name})=>({period,name})),pricing:fabIntakePricing_(),machines:roomMachineChoices_().filter(m=>m.fabrication)};
 if(!fabIntakeUuid_(r.submission))return {status:400};const identity=members.find(m=>m.period===r.period);if(!identity)return {status:403};
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};try{if(r.operation==='upload')return fabIntakeUpload_(session,r,store);if(r.operation==='submit')return fabIntakeSubmit_(session,r,identity,store);return {status:400};}finally{lock.releaseLock();}
}
// Management downloads resolve a queue row and recheck the current role for every chunk.
function fabIntakeDownload_(session,r){
 if(!fabAllowed_(session.email,Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[]))return {status:403};
 if(!/^[a-f0-9]{64}$/.test(r.id||'')||!['stl','formatted','calculator','dxf'].includes(r.slot)||!Number.isSafeInteger(r.offset)||r.offset<0||r.offset>104857600)return {status:400};
 const matches=fabRead_().requests.filter(row=>row.id===r.id&&row.tab.title===FAB_INTAKE_TAB);if(matches.length!==1)return {status:404};
 const value=matches[0].raw[{stl:9,formatted:10,calculator:13,dxf:17}[r.slot]],match=String(value||'').match(/^https:\/\/drive.google.com\/file\/d\/([a-zA-Z0-9_-]+)\/view$/);if(!match)return {status:404};
 const file=Drive.Files.get(match[1],{fields:'id,name,size,mimeType,trashed'}),size=Number(file.size);if(file.trashed||!Number.isSafeInteger(size)||size<1||size>104857600||r.offset>=size)return {status:404};
 const end=Math.min(size-1,r.offset+2097152-1),response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+file.id+'?alt=media',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),Range:'bytes='+r.offset+'-'+end},muteHttpExceptions:true});if(response.getResponseCode()!==206&&!(response.getResponseCode()===200&&r.offset===0&&size<=2097152))throw Error('Download unavailable');
 const bytes=response.getBlob().getBytes();if(bytes.length!==end-r.offset+1)throw Error('Incomplete download');return {status:200,name:file.name,size,data:Utilities.base64Encode(bytes)};
}

// Same weight-based formula as the original calculator; markup is a dollar amount.
function fabIntakePricing_(){
 const rows=Sheets.Spreadsheets.Values.get('18ncTFNvl24LifQDc2jHcE1k31mJ7ROC7HuaXc3Vpd70',"'FilamentCurrentPrice'!B2:D17",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[];
 const rates=rows.filter(r=>['Sketch Large','Replicator +','Method'].includes(String(r[0]).trim())).map(r=>({printer:String(r[0]).trim(),grams:Number(r[1]),price:Number(r[2])}));
 if(!rates.length||rates.some(r=>!Number.isFinite(r.grams)||r.grams<=0||!Number.isFinite(r.price)||r.price<0)||new Set(rates.map(r=>r.printer)).size!==rates.length)throw Error('Calculator rates unavailable');
 return {rates,revision:hash_(JSON.stringify(rates))};
}
function fabIntakeQuote_(a){
 if(!fabIntakeNumber_(a.grams)||typeof a.markup!=='string'||!/^\d{1,7}(\.\d{1,2})?$/.test(a.markup))return {status:400,error:'Enter grams and a non-negative markup in dollars.'};
 const pricing=fabIntakePricing_();if(a.pricingRevision!==pricing.revision)return {status:409,error:'Material prices changed. Reopen the calculator and review the updated cost.'};
 const rate=pricing.rates.find(r=>r.printer===(a.pricingProfile||'Sketch Large'));if(!rate)return {status:400,error:'This printer’s filament pricing profile is unavailable. Ask Inventory to update its setup.'};
 const base=Number(a.grams)/rate.grams*rate.price,total=base+Number(a.markup);
 return {status:200,base,total,summary:['Printer: '+rate.printer,'Material: '+a.grams+' g','Filament price: $'+rate.price.toFixed(2)+' / '+rate.grams+' g','Cost before markup: $'+base.toFixed(2),'Markup: $'+Number(a.markup).toFixed(2),'Selling price: $'+total.toFixed(2),'Pricing revision: '+pricing.revision].join('\n')};
}
