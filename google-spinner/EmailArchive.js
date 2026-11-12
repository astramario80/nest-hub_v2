// Private school-owned storage; archive rows have no expiry or automatic deletion.
const EMAIL_ARCHIVE_HEADERS=['Archive ID','Request ID','Sender','Username','Created at','Subject','Reply to','Recipients','Test','State','Accepted','Rejected','Provider outcomes','HTML 1','HTML 2','Text 1','Text 2','Source','Sender key'];
function emailArchiveBook_(){
 const store=PropertiesService.getScriptProperties();let id=store.getProperty('NEST_EMAIL_ARCHIVE_WORKBOOK');
 if(!id){
  const book=Sheets.Spreadsheets.create({properties:{title:'NEST™ Communications Archive'},sheets:[{properties:{title:'Messages',gridProperties:{rowCount:1000,columnCount:19}}}]});id=book.spreadsheetId;
  // Store the private workbook before further writes so initialization can recover.
  store.setProperty('NEST_EMAIL_ARCHIVE_WORKBOOK',id);
 }
 const header=(Sheets.Spreadsheets.Values.get(id,"'Messages'!A1:S1").values||[])[0];
 if(!header||!header.length)Sheets.Spreadsheets.Values.update({values:[EMAIL_ARCHIVE_HEADERS]},id,"'Messages'!A1:S1",{valueInputOption:'RAW'});
 else if(EMAIL_ARCHIVE_HEADERS.some((v,i)=>header[i]!==v))throw new Error('Email archive schema mismatch');
 return id;
}
function emailArchiveRows_(id){return Sheets.Spreadsheets.Values.get(id,"'Messages'!A2:M").values||[];}
function emailArchiveSummary_(row){return {archiveId:row[0],requestId:row[1],sender:row[2],username:row[3],sentAt:row[4],subject:row[5],replyTo:row[6],selected:JSON.parse(row[7]||'[]').length,testing:String(row[8])==='true',state:row[9],accepted:Number(row[10])||0,rejected:Number(row[11])||0};}
function emailArchiveRecord_(id,row,index){
 const content=(Sheets.Spreadsheets.Values.get(id,"'Messages'!N"+(index+2)+':S'+(index+2)).values||[])[0]||[];
 return {...emailArchiveSummary_(row),recipients:JSON.parse(row[7]||'[]'),outcomes:JSON.parse(row[12]||'[]'),html:String(content[0]||'')+String(content[1]||''),text:String(content[2]||'')+String(content[3]||''),source:content[4]||'nest'};
}
function emailArchiveValid_(doc){return doc&&/^[a-f0-9]{64}$/.test(doc.senderKey||'')&&typeof doc.subject==='string'&&doc.subject.length<=187&&typeof doc.html==='string'&&doc.html.length<=60000&&typeof doc.text==='string'&&doc.text.length<=60000&&Array.isArray(doc.recipients)&&doc.recipients.length>0&&doc.recipients.length<=300&&doc.recipients.every(email=>accountEmail_(email)&&!email.startsWith('manual:'))&&typeof doc.testing==='boolean';}
function emailArchiveParts_(text){const code=text.charCodeAt(29999),cut=code>=0xD800&&code<=0xDBFF?29999:30000;return [text.slice(0,cut),text.slice(cut)];}
function emailArchiveWrite_(book,doc){
 const archiveId=hash_(doc.senderKey+':'+doc.requestId),rows=emailArchiveRows_(book),existing=rows.findIndex(row=>row[0]===archiveId);
 if(existing>=0){if(doc.source==='postmark-import'&&['pending','unknown'].includes(rows[existing][9])){const selected=JSON.parse(rows[existing][7]||'[]').length;Sheets.Spreadsheets.Values.update({values:[[doc.accepted===selected?'accepted':'partial',doc.accepted||0,doc.rejected||0,JSON.stringify(doc.outcomes||[])]]},book,"'Messages'!J"+(existing+2)+':M'+(existing+2),{valueInputOption:'RAW'});}return {archiveId,row:existing+2};}
 const values=[archiveId,doc.requestId,doc.sender,doc.username||'',doc.sentAt,doc.subject,doc.replyTo,JSON.stringify(doc.recipients),String(doc.testing),doc.state||'pending',doc.accepted||0,doc.rejected||0,JSON.stringify(doc.outcomes||[]),...emailArchiveParts_(doc.html),...emailArchiveParts_(doc.text),doc.source||'nest',doc.senderKey];
 const result=Sheets.Spreadsheets.Values.append({values:[values]},book,"'Messages'!A:S",{valueInputOption:'RAW',insertDataOption:'INSERT_ROWS'});
 const match=String(result.updates&&result.updates.updatedRange||'').match(/![A-Z]+(\d+):/);if(!match)throw new Error('Archive append not confirmed');
 return {archiveId,row:Number(match[1])};
}
function emailArchiveReserve_(r,session,replyTo){
 const doc=r.archive;if(doc&&doc.testing)doc.recipients=[replyTo];if(!emailArchiveValid_(doc)||doc.recipients.length!==r.count||doc.testing&&doc.recipients[0]!==replyTo)throw new Error('Invalid archive record');
 return emailArchiveWrite_(emailArchiveBook_(),{...doc,requestId:r.requestId,sender:session.email,username:session.username,sentAt:new Date().toISOString(),replyTo,state:'pending',source:'nest',outcomes:doc.recipients.map(email=>({email,name:typeof doc.recipientNames?.[email]==='string'?doc.recipientNames[email].slice(0,200):'',state:'pending'}))});
}
function emailArchiveFinish_(record,r){
 if(!record.archiveRow)return;
 const book=PropertiesService.getScriptProperties().getProperty('NEST_EMAIL_ARCHIVE_WORKBOOK');if(!book)throw new Error('Missing archive');
 const saved=(Sheets.Spreadsheets.Values.get(book,"'Messages'!A"+record.archiveRow+':B'+record.archiveRow).values||[])[0]||[];
 if(saved[0]!==record.archiveId||saved[1]!==r.requestId)throw new Error('Invalid archive ownership');
 const previous=(Sheets.Spreadsheets.Values.get(book,"'Messages'!M"+record.archiveRow+':M'+record.archiveRow).values||[])[0]||[],snapshots=JSON.parse(previous[0]||'[]');const incoming=Array.isArray(r.outcomes)&&r.outcomes.length?r.outcomes:snapshots.map(p=>({...p,state:'unknown'}));const outcomes=incoming.map(o=>({...o,name:snapshots.find(p=>p.email===o.email)?.name||''}));if(outcomes.length>300||JSON.stringify(outcomes).length>45000)throw new Error('Invalid provider outcomes');
 Sheets.Spreadsheets.Values.update({values:[[r.state,r.accepted,r.rejected,JSON.stringify(outcomes)]]},book,"'Messages'!J"+record.archiveRow+':M'+record.archiveRow,{valueInputOption:'RAW'});
}
function emailArchiveRecipientDetails_(m){const names={};for(const o of m.outcomes||[])if(o.email&&typeof o.name==='string'&&o.name.trim())names[o.email]=o.name;try{const ranges=Object.keys(PERIODS).map(p=>"'"+(p==='CTSO'?'CTSO':'Period '+p)+"'!A2:C1000"),values=Sheets.Spreadsheets.Values.batchGet(NEST_DATABASE,{ranges,valueRenderOption:'FORMATTED_VALUE'}).valueRanges||[];for(const range of values)for(const row of range.values||[])if(row[0]&&row[2]&&!names[email_(row[2])])names[email_(row[2])]=String(row[0]).trim();}catch(_){}return m.recipients.map(email=>{const o=(m.outcomes||[]).find(o=>o.email===email),state=o&&Number.isInteger(o.errorCode)?o.errorCode===0?'accepted':'rejected':m.accepted===m.selected?'accepted':m.rejected===m.selected?'rejected':m.state==='pending'?'pending':'unknown';return {email,name:names[email]||email,state,errorCode:o&&Number.isInteger(o.errorCode)?o.errorCode:null,errorMessage:typeof o?.errorMessage==='string'?o.errorMessage.slice(0,500):'',messageId:o?.messageId||null};});}
function emailArchiveSent_(r,session){const book=PropertiesService.getScriptProperties().getProperty('NEST_EMAIL_ARCHIVE_WORKBOOK');if(!book)return {status:501};const rows=emailArchiveRows_(book);if(r.operation==='sent-detail'){if(!/^[a-f0-9]{64}$/.test(r.requestId||''))return {status:400};const index=rows.findIndex(row=>row[1]===r.requestId&&row[2]===session.email);if(index<0)return {status:404};const message=emailArchiveRecord_(book,rows[index],index);message.recipientDetails=emailArchiveRecipientDetails_(message);return {status:200,message};}const offset=Number(r.offset||0);if(!Number.isInteger(offset)||offset<0||offset>100000)return {status:400};const all=rows.filter(row=>row[2]===session.email).map(emailArchiveSummary_).sort((a,b)=>Date.parse(b.sentAt)-Date.parse(a.sentAt));return {status:200,messages:all.slice(offset,offset+20),hasMore:offset+20<all.length,nextOffset:offset+20,permanent:true};}
function emailArchiveDispatch_(r){
 const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());if(!session)return {status:401};
 if(['sent-list','sent-detail'].includes(r.operation))return emailArchiveSent_(r,session);
 if(!OWNER_EMAILS.includes(email_(session.email)))return {status:403};
 if(r.operation==='diagnose'){
  if(!/^[a-f0-9]{64}$/.test(r.requestId||'')||!username_(r.username))return {status:400};
  const account=accounts_().find(a=>a.username===r.username);if(!account)return {status:404};
  const raw=PropertiesService.getScriptProperties().getProperty('groupmail:attempt:'+hash_(hash_(account.email)+':'+r.requestId)),attempt=raw?JSON.parse(raw):null;
  const book=PropertiesService.getScriptProperties().getProperty('NEST_EMAIL_ARCHIVE_WORKBOOK');let archiveReady=false;
  try{const header=book?(Sheets.Spreadsheets.Values.get(book,"'Messages'!A1:S1").values||[])[0]:null;archiveReady=!!header&&EMAIL_ARCHIVE_HEADERS.every((v,i)=>header[i]===v);}catch(_){}
  return {status:200,accountActive:account.active,manualAccount:account.email.startsWith('manual:'),linkedAddressAvailable:!!districtEmail_(account.linkedEmail),recoveryAddressAvailable:!!districtEmail_(account.recoveryEmail),attemptRecorded:!!attempt,state:attempt&&attempt.state,archiveRecorded:!!(attempt&&attempt.archiveRow),accepted:attempt&&attempt.accepted||0,rejected:attempt&&attempt.rejected||0,archiveReady,serviceFaults:Object.entries(PropertiesService.getScriptProperties().getProperties()).filter(([key])=>key.indexOf('nest-service-fault:')===0).map(([,value])=>JSON.parse(value))};
 }
 if(r.operation==='access')return {status:200,administrator:true};
 if(r.operation==='identities')return {status:200,identities:accounts_().map(a=>({email:a.email,username:a.username}))};
 if(!['list','detail','import'].includes(r.operation))return {status:400};
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))return {status:503};
 try{
  const book=emailArchiveBook_();
  if(r.operation==='import'){
   if(!Array.isArray(r.messages)||r.messages.length>20||r.messages.some(doc=>!emailArchiveValid_(doc)||!/^[a-f0-9]{64}$/.test(doc.requestId||'')||!accountEmail_(doc.sender)||!Number.isFinite(Date.parse(doc.sentAt))||!['accepted','partial','rejected','unknown','pending'].includes(doc.state)))return {status:400};
   r.messages.forEach(doc=>emailArchiveWrite_(book,{...doc,source:'postmark-import'}));return {status:200,imported:r.messages.length};
  }
  const rows=emailArchiveRows_(book);
  if(r.operation==='detail'){
   if(!/^[a-f0-9]{64}$/.test(r.archiveId||''))return {status:400};const index=rows.findIndex(row=>row[0]===r.archiveId);if(index<0)return {status:404};const message=emailArchiveRecord_(book,rows[index],index);message.recipientDetails=emailArchiveRecipientDetails_(message);return {status:200,message};
  }
  const offset=Number(r.offset||0),search=String(r.search||'').trim().toLowerCase();if(!Number.isInteger(offset)||offset<0||search.length>120)return {status:400};
  const all=rows.filter(row=>/^[a-f0-9]{64}$/.test(row[0]||'')).map(emailArchiveSummary_).filter(m=>!search||[m.sender,m.username,m.subject].some(v=>String(v||'').toLowerCase().includes(search))).sort((a,b)=>Date.parse(b.sentAt)-Date.parse(a.sentAt));
  return {status:200,messages:all.slice(offset,offset+50),total:all.length,nextOffset:offset+50,hasMore:offset+50<all.length,permanent:true};
 }finally{lock.releaseLock();}
}
