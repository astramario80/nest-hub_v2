// Bound to the existing flight recorder project, which already uses GmailApp.
// Reads official attachments only; never emails, forwards, or publishes photos.
const SCHOOL_NO_FLY_BOOK='17Z0REO0cjdqqRAdz_BxImj-4qKaZRYlAasxX3EORmfQ';
const SCHOOL_NO_FLY_DATABASE='12XogWM3af3PLIvEyrFR39hzkI0kEmfiCZkr66y3eDcU';
const SCHOOL_NO_FLY_SCHEDULE='12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE';
const SCHOOL_NO_FLY_SENDER='mlandron@bethelsd.org';
function schoolNoFlyNormalize_(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'‘`]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function schoolNoFlyKeys_(name){
 const parts=String(name||'').split(',');if(parts.length!==2)return [schoolNoFlyNormalize_(name)];
 const last=schoolNoFlyNormalize_(parts[0]),given=schoolNoFlyNormalize_(parts[1]);if(!last||!given)return [];
 return [last+'|'+given,last+'|'+given.split(' ')[0]];
}
function schoolNoFlyXMLText_(xml){return String(xml).replace(/<w:tab\b[^>]*\/>/g,' ').replace(/<\/w:p>/g,'\n').replace(/<[^>]*>/g,'').replace(/&#x([a-f0-9]+);/ig,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#([0-9]+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
function schoolNoFlyCandidates_(xml){
 const text=schoolNoFlyXMLText_(xml);if(!/no[\s-]*fly/i.test(text))throw Error('Missing No Fly heading');
 const cells=String(xml).match(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)||[];
 const candidates=cells.map(cell=>schoolNoFlyXMLText_(cell).replace(/\s+/g,' ').trim()).filter(value=>value.includes(',')&&value.length<120&&schoolNoFlyKeys_(value).length&& !/no[\s-]*fly|escort|contact/i.test(value));
 if(!candidates.length||candidates.length>500)throw Error('No Fly attachment layout needs review');
 return [...new Set(candidates)];
}
function schoolNoFlyMatch_(candidates,roster){
 const index=new Map();
 roster.forEach(student=>schoolNoFlyKeys_(student.name).forEach(key=>{if(!index.has(key))index.set(key,new Map());index.get(key).set(student.email,student);}));
 const matches=new Map();let ambiguous=0,unmatched=0;
 candidates.forEach(name=>{let found=null,duplicate=false;for(const key of schoolNoFlyKeys_(name)){const values=index.get(key);if(values?.size===1){found=[...values.values()][0];break;}if(values?.size>1)duplicate=true;}if(found)matches.set(found.email,found);else if(duplicate)ambiguous++;else unmatched++;});
 return {matches:[...matches.values()],ambiguousCount:ambiguous,unmatchedCount:unmatched};
}
function syncSchoolNoFly(){
 const book=SpreadsheetApp.openById(SCHOOL_NO_FLY_BOOK);let sheet=book.getSheetByName('SafetySchoolNoFly'),before=null;
 if(sheet){try{before=JSON.parse(sheet.getRange('A1').getValue()||'null');}catch(_){}}
 const now=new Date().toISOString();let stage='mail-search';
 try{
  const threads=GmailApp.search('from:'+SCHOOL_NO_FLY_SENDER+' {subject:"no fly" subject:"no-fly"} has:attachment newer_than:180d',0,30);
  stage='mail-filter';const candidates=[];
  threads.forEach(thread=>thread.getMessages().forEach(message=>{
   const from=message.getFrom().match(/<([^>]+)>/),email=(from?from[1]:message.getFrom()).trim().toLowerCase();
   if(email!==SCHOOL_NO_FLY_SENDER||!/no[\s-]*fly/i.test(message.getSubject()))return;
   const files=message.getAttachments({includeInlineImages:false,includeAttachments:true}).filter(file=>/no[\s-]*fly/i.test(file.getName())&&/\.docx?$/i.test(file.getName()));
   if(files.length)candidates.push({message,files});
  }));
  candidates.sort((a,b)=>b.message.getDate().getTime()-a.message.getDate().getTime());if(!candidates.length)throw Error('No official attachment found');
  const source=candidates[0];if(source.files.length!==1)throw Error('Multiple No Fly attachments need review');const attachment=source.files[0];
  if(!/\.docx$/i.test(attachment.getName()))throw Error('Word attachment requires DOCX format');
  stage='attachment-unzip';if(attachment.getSize()>15*1024*1024)throw Error('Attachment is too large');
  const files=Utilities.unzip(attachment.copyBlob().setContentType('application/zip')),document=files.find(file=>file.getName()==='word/document.xml');if(!document)throw Error('Word document is unreadable');
  stage='word-parse';const xml=document.getDataAsString('UTF-8')+'\n'+files.filter(file=>/^word\/header[0-9]*\.xml$/.test(file.getName())).map(file=>file.getDataAsString('UTF-8')).join('\n'),names=schoolNoFlyCandidates_(xml);
  stage='roster-read';const schedule=SpreadsheetApp.openById(SCHOOL_NO_FLY_SCHEDULE).getSheetByName('Schedule');
  const trimester=noFlyTerm_(schedule.getRange('A2').getValue(),schedule.getRange('B6').getValue());
  const rosterSheet=SpreadsheetApp.openById(SCHOOL_NO_FLY_DATABASE).getSheetByName('CombinedStudentList');
  if(!rosterSheet)throw Error('CombinedStudentList is unavailable');
  const raw=rosterSheet.getRange(2,1,Math.max(1,rosterSheet.getLastRow()-1),6).getValues();
  const roster=noFlyRosterFromRows_(raw,trimester);
  const result=schoolNoFlyMatch_(names,roster),text=schoolNoFlyXMLText_(xml),date=text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
  const snapshot={status:'ready',trimester,rosterSource:'CombinedStudentList!A2:F',checkedAt:now,lastSuccessAt:now,sourceMessageId:source.message.getId(),sourceReceivedAt:source.message.getDate().toISOString(),sourceSubject:source.message.getSubject(),attachmentName:attachment.getName(),documentDate:date?date[0]:'',candidateCount:names.length,...result};
  if(!sheet){sheet=book.insertSheet('SafetySchoolNoFly');sheet.hideSheet();}sheet.getRange('A1').setValue(JSON.stringify(snapshot));
  console.log(JSON.stringify({status:'ready',candidates:names.length,matched:result.matches.length,ambiguous:result.ambiguousCount}));return {status:'ready',matched:result.matches.length};
 }catch(error){
  const snapshot={...(before||{}),status:'error',checkedAt:now,error:'The latest official attachment could not be verified. The last successful matches remain visible; check the school email.'};
  if(!sheet){sheet=book.insertSheet('SafetySchoolNoFly');sheet.hideSheet();}sheet.getRange('A1').setValue(JSON.stringify(snapshot));
  console.error(JSON.stringify({stage,type:error.name,reason:String(error.message||'').slice(0,180)}));throw Error('School No Fly synchronization needs review.');
 }
}
