// Public question metadata only. Submission routes always verify the applicant.
const JOIN_EMPLOYMENT_FORM='1rmCIPuYiOKWorRxmDJxuI8dUnLFWNVGFZH8ei-LJsVI';
function joinEmploymentSchema_(){
 const form=FormApp.openById(JOIN_EMPLOYMENT_FORM),fields=[];let section='';
 const casts={TEXT:'asTextItem',PARAGRAPH_TEXT:'asParagraphTextItem',MULTIPLE_CHOICE:'asMultipleChoiceItem',CHECKBOX:'asCheckboxItem',LIST:'asListItem'};
 form.getItems().forEach(item=>{const type=String(item.getType());if(['PAGE_BREAK','SECTION_HEADER'].includes(type)){section=item.getTitle();return;}if(['IMAGE','VIDEO'].includes(type))return;if(!casts[type])throw Error('Unsupported employment question: '+type);const q=item[casts[type]](),f={id:String(item.getId()),label:item.getTitle(),section,help:q.getHelpText()||'',type,required:q.isRequired()};if(['MULTIPLE_CHOICE','CHECKBOX','LIST'].includes(type)){f.choices=q.getChoices().map(c=>c.getValue());f.other=type!=='LIST'&&q.hasOtherOption();}fields.push(f);});
 const schema={title:form.getTitle(),description:form.getDescription(),fields};return {...schema,revision:hash_(JSON.stringify(schema))};
}
function joinPublicSchema_(kind){return kind==='robotics'?{status:200,schema:roboticsSignupSchema_()}:kind==='employment'?{status:200,schema:joinEmploymentSchema_()}:{status:400};}
function joinEmploymentSubmit_(r){
 const store=PropertiesService.getScriptProperties(),now=Date.now(),session=authSession_(r.session,store,now);
 if(!session)return {status:401};
 if(!/^[a-f0-9-]{36}$/.test(r.submission||''))return {status:400};
 const schema=joinEmploymentSchema_();if(r.revision!==schema.revision)return {status:409};
 let fields;try{fields=roboticsSignupAnswers_(schema,r.answers);}catch(_){return {status:400};}
 // The existing hiring queue is timestamp, verified roster name, period, position, and three written answers.
 const ids=['1636397509','1494671636','680677583','1953877181','1076517328'];
 if(schema.fields.length!==ids.length||ids.some(id=>!fields.some(f=>f.id===id)))return {status:503};
 const answers=ids.map(id=>fields.find(f=>f.id===id).value),period=answers[0]==='CTSO'?'CTSO':answers[0].replace(/^Period /,'');
 if(!HIRING_PERIODS.includes(period)||!districtEmail_(session.email))return {status:403};
 const address=email_(session.email),roster=period==='CTSO'?roboticsRoster_():rows_(period);
 const matched=roster.filter(row=>email_(row[1])===address);if(matched.length!==1)return {status:403};
 const applicant=String(matched[0][0]);
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
 try{
  const key='join-employment:'+hash_(address+'|'+r.submission),fingerprint=hash_(JSON.stringify([address,...answers]));
  let receipt=read_(store,key,now);
  if(receipt&&receipt.fingerprint!==fingerprint)return {status:409};
  if(receipt?.done)return {status:200,received:true};
  const book=hiringWorkbook_(period);
  if(!receipt){
   if(!rate_(store,'join-employment-rate:'+hash_(address),5,86400000,now))return {status:429};
   const sheet=Sheets.Spreadsheets.get(book,{fields:'sheets(properties(sheetId,title,gridProperties(rowCount)))'}).sheets.find(s=>s.properties.title==='Applications');if(!sheet)return {status:503};
   const headers=roboticsValues_(book,"'Applications'!A1:H1")[0]||[];
   if(headers[1]!=='Applicant'||ids.some((id,index)=>headers[index+2]!==schema.fields.find(f=>f.id===id).label))return {status:503};
   const rows=roboticsValues_(book,"'Applications'!A1:A"+sheet.properties.gridProperties.rowCount),counter='join-employment-next:'+book,row=Math.max(2,rows.length+1,Number(store.getProperty(counter)||0));
   store.setProperty(counter,String(row+1));
   if(row>sheet.properties.gridProperties.rowCount)Sheets.Spreadsheets.batchUpdate({requests:[{appendDimension:{sheetId:sheet.properties.sheetId,dimension:'ROWS',length:100}}]},book);
   receipt={fingerprint,row,at:Utilities.formatDate(new Date(now),'America/Los_Angeles','M/d/yyyy H:mm:ss'),expires:now+30*86400000};store.setProperty(key,JSON.stringify(receipt));
  }
  const range="'Applications'!A"+receipt.row+':H'+receipt.row,values=[receipt.at,applicant,...answers,''];
  const current=roboticsValues_(book,range)[0]||[];
  if(current.some(v=>v!==''&&v!==null)&&JSON.stringify(current.slice(0,7))!==JSON.stringify(values.slice(0,7)))return {status:409};
  if(!current.length||current.every(v=>v===''||v===null))roboticsWrite_(book,[{range,values:[values]}]);
  receipt.done=true;store.setProperty(key,JSON.stringify(receipt));return {status:200,received:true};
 }finally{lock.releaseLock();}
}
