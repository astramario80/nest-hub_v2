// Public guest intake; verified email does not grant NEST or member-profile access.
function roboticsSignupSchema_(){
 const form=FormApp.openById(ROBOTICS_SIGNUP_FORM),fields=[];let section='',deferred=false,declineNotice='';
 const casts={TEXT:'asTextItem',PARAGRAPH_TEXT:'asParagraphTextItem',MULTIPLE_CHOICE:'asMultipleChoiceItem',CHECKBOX:'asCheckboxItem',LIST:'asListItem'};
 form.getItems().forEach(item=>{
  const type=String(item.getType()),title=String(item.getTitle()||'');
  if(type==='PAGE_BREAK'||type==='SECTION_HEADER'){
   section=title;deferred=/first inspires|band group/i.test(title);
   if(/sorry to see you go/i.test(title)){declineNotice=item[type==='PAGE_BREAK'?'asPageBreakItem':'asSectionHeaderItem']().getHelpText();deferred=true;}return;
  }
  if(deferred||['FILE_UPLOAD','IMAGE','VIDEO'].includes(type))return;
  if(!casts[type])throw new Error('Unsupported membership question type: '+type);
  const q=item[casts[type]]();
  const field={id:String(item.getId()),label:title,section,help:String(q.getHelpText()||''),type,required:q.isRequired()||/^Your (FIRST|LAST) Name$/i.test(title)};
  if(['MULTIPLE_CHOICE','CHECKBOX','LIST'].includes(type)){
   field.choices=q.getChoices().map(c=>c.getValue());field.other=type!=='LIST'&&q.hasOtherOption();
  }
  fields.push(field);
 });
 if(!fields.some(f=>/^Your FIRST Name$/i.test(f.label))||!fields.some(f=>/^Your LAST Name$/i.test(f.label)))throw new Error('Membership name questions are missing');
 const schema={title:form.getTitle(),description:form.getDescription(),fields,declineNotice};
 return {...schema,revision:hash_(JSON.stringify(schema))};
}
function roboticsSignupRelevantSchema_(schema,answers){
 if(!answers||typeof answers!=='object'||Array.isArray(answers))return schema;
 const declined=schema.fields.findIndex(f=>f.section==='Our Community Agreements'&&answers[f.id]==='I disagree');
 return declined<0?schema:{...schema,fields:schema.fields.slice(0,declined+1)};
}
function roboticsSignupAnswers_(schema,answers){
 if(!answers||Array.isArray(answers)||typeof answers!=='object'||Object.keys(answers).some(k=>!schema.fields.some(f=>f.id===k)))throw new Error('Invalid answers');
 return schema.fields.map(f=>{
  let value=answers[f.id]??(f.type==='CHECKBOX'?[]:'');
  if(f.type==='CHECKBOX'){
   if(!Array.isArray(value)||value.length>30||new Set(value).size!==value.length||value.some(v=>typeof v!=='string'||v.length>2000||(!f.other&&!f.choices.includes(v))))throw new Error('Invalid checkbox answer');
   if(f.other&&value.filter(v=>!f.choices.includes(v)).length>1)throw new Error('Invalid other answer');
  }else{
   if(typeof value!=='string'||value.length>2000)throw new Error('Invalid answer');value=value.trim();
   if(value&&f.choices&&!f.choices.includes(value)&&!f.other)throw new Error('Invalid choice');
  }
  if(f.required&&!value.length)throw new Error('Required answer missing');
  return {id:f.id,label:f.label,value,editable:['TEXT','PARAGRAPH_TEXT'].includes(f.type)&&/(phone|email|address|contact|guardian|parent)/i.test(f.label)&&!/(consent|agree|waiver|student.?id|legal name)/i.test(f.label)};
 });
}
function roboticsSignupSweep_(store,now){
 if(Number(store.getProperty('robotics-signup-cleanup')||0)>now-3600000)return;
 const all=store.getProperties();Object.keys(all).filter(k=>/^robotics-signup:(challenge|session|rate):/.test(k)).forEach(k=>{try{if(JSON.parse(all[k]).expires<=now)store.deleteProperty(k);}catch(_){store.deleteProperty(k);}});
 store.setProperty('robotics-signup-cleanup',String(now));
}
function roboticsSignupDispatch_(r){
 if(r.action==='robotics-signup-schema')return {status:200,schema:roboticsSignupSchema_()};
 const tokenOK=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),store=PropertiesService.getScriptProperties(),now=Date.now();
 if(!tokenOK(r.ip))return {status:400};
 const verifiedIdentity=['robotics-signup-continue','robotics-signup-submit'].includes(r.action)?authRecoveryReadContext_(()=>authSession_(r.nestSession,store,now)):null;
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
 let mail=null,entry=null,result;
 try{
  roboticsSignupSweep_(store,now);
  if(r.action==='robotics-signup-continue'){if(!tokenOK(r.nestSession)||!tokenOK(r.session))return {status:401};const identity=verifiedIdentity;if(!identity||!/^\d{3,12}@students\.bethelsd\.org$/.test(identity.email))return {status:403};store.setProperty('robotics-signup:session:'+hash_(r.session),JSON.stringify({email:identity.email,expires:now+3600000}));return {status:200,email:identity.email};}
  if(r.action==='robotics-signup-account'){if(!tokenOK(r.session)||!tokenOK(r.ticket))return {status:401};const signup=read_(store,'robotics-signup:session:'+hash_(r.session),now);if(!signup||!/^\d{3,12}@students\.bethelsd\.org$/.test(signup.email))return {status:403};const existing=authRecoveryReadContext_(()=>accounts_()).find(a=>a.email===signup.email);if(existing)return {status:200,email:signup.email,needsAccount:false};store.setProperty('auth-guest-robotics:'+hash_(signup.email),JSON.stringify({email:signup.email,expires:now+86400000,source:'verified-robotics-application'}));store.setProperty('authticket:'+hash_(r.ticket),JSON.stringify({email:signup.email,expires:now+600000}));return {status:200,email:signup.email,needsAccount:true};}
  if(r.action==='robotics-signup-request'){
   const email=email_(r.email);
   if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)||email.length>254||!tokenOK(r.challenge)||!/^\d{6}$/.test(r.code||''))return {status:400};
   const prefix='robotics-signup:rate:';
   const limits=[[prefix+'global-hour',30,3600000],[prefix+'global-day',150,86400000],[prefix+'ip:'+r.ip,30,3600000],[prefix+'email:'+hash_(email),3,3600000],[prefix+'cooldown:'+hash_(email),1,60000]].map(([key,max,ttl])=>({key,max,value:read_(store,key,now)||{count:0,expires:now+ttl}}));const grantKey='robotics-signup:retry-grant:'+hash_(email),grant=read_(store,grantKey,now),hasGrant=grant&&grant.remaining===1;const blocked=hasGrant?[]:limits.filter(limit=>limit.value.count>=limit.max);if(blocked.length)return {status:429,retryAfter:Math.max(1,...blocked.map(limit=>Math.ceil((limit.value.expires-now)/1000)))};limits.forEach(limit=>{limit.value.count++;store.setProperty(limit.key,JSON.stringify(limit.value));});if(hasGrant)store.deleteProperty(grantKey);
   store.setProperty('robotics-signup:challenge:'+hash_(r.challenge),JSON.stringify({email,digest:hash_(r.challenge+':'+r.code),attempts:0,expires:now+600000}));
   mail={htmlBody:nestEmailHtml_('Verify your Robotics signup email','Your Robotics signup verification code is',r.code).replaceAll('https://gknest.org"','https://gknest.org/join-robotics"').replaceAll('>https://gknest.org<','>https://gknest.org/join-robotics<'),to:email,name:'NEST™ Robotics',subject:'Verify your Robotics signup email',body:'Your NEST Robotics signup verification code is '+r.code+'. It expires in 10 minutes. Enter it only at https://gknest.org/join-robotics. If you did not request this, ignore this email.'};result={status:200};
  }else if(r.action==='robotics-signup-verify'){
   if(!tokenOK(r.challenge)||!tokenOK(r.session)||!/^\d{6}$/.test(r.code||''))return {status:401};
   const key='robotics-signup:challenge:'+hash_(r.challenge),challenge=read_(store,key,now);
   if(!challenge)return {status:401,reason:'code-expired'};if(challenge.attempts>=5)return {status:401,reason:'code-exhausted'};
   challenge.attempts++;store.setProperty(key,JSON.stringify(challenge));
   if(challenge.digest!==hash_(r.challenge+':'+r.code))return {status:401,reason:challenge.attempts<5?'incorrect-code':'code-exhausted',attemptsRemaining:Math.max(0,5-challenge.attempts)};
   store.deleteProperty(key);store.setProperty('robotics-signup:session:'+hash_(r.session),JSON.stringify({email:challenge.email,expires:now+3600000}));result={status:200,email:challenge.email};
  }else if(r.action==='robotics-signup-submit'){
   if(!tokenOK(r.session))return {status:401};const session=read_(store,'robotics-signup:session:'+hash_(r.session),now);if(!session)return {status:401};
   const identity=verifiedIdentity;if(!identity||identity.email!==session.email)return {status:401};
   const schema=roboticsSignupSchema_();if(r.revision!==schema.revision)return {status:409};
   let fields;try{fields=roboticsSignupAnswers_(roboticsSignupRelevantSchema_(schema,r.answers),r.answers);}catch(_){return {status:400};}
   const fingerprint=hash_(JSON.stringify(fields)),key=hash_('native-signup|'+r.session);
   entry=roboticsPrivateRows_().find(e=>e.key===key);
   if(entry&&entry.record.fingerprint!==fingerprint)return {status:409};
   if(!entry){
    const first=fields.find(f=>/^Your FIRST Name$/i.test(f.label)).value,last=fields.find(f=>/^Your LAST Name$/i.test(f.label)).value;
    fields.unshift({id:'respondent-email',label:'Verified signup email',value:session.email,editable:false});
    if(roboticsPrivateRows_().length>=9999)return {status:503};
    entry=roboticsPrivateNew_(key,{kind:'signup',source:'nest-website',verifiedAccount:true,name:last+', '+first,submitted:new Date(now).toISOString(),respondent:session.email,fields,memberId:null,checks:{},historical:false,mail:{},fingerprint});
   }
   result={status:200,received:true};
  }else return {status:400};
 }finally{lock.releaseLock();}
 if(mail){try{nestAccountMail_(r,mail);}catch(_){store.deleteProperty('robotics-signup:challenge:'+hash_(r.challenge));return {status:503};}}
 if(entry){try{roboticsSignupMail_(entry.key);}catch(_){/* Saved applications remain visible; existing retry handles unclaimed notices. */}}
 return result;
}
function roboticsScreenshotUpload_(entry,r,member){
 if(!member||!member.active||!Array.isArray(r.files)||r.files.length<1||r.files.length>2)return {status:400};
 if((entry.record.screenshots||[]).length+r.files.length>6)return {status:400};
 const files=[];
 for(const file of r.files){
  if(!file||typeof file.data!=='string'||file.data.length>1400000||!/^[A-Za-z0-9+/]+={0,2}$/.test(file.data)||!['image/png','image/jpeg','image/webp'].includes(file.mime))return {status:400};
  const bytes=Utilities.base64Decode(file.data),b=bytes.map(v=>v&255);if(bytes.length<12||bytes.length>1048576)return {status:400};
  const valid=file.mime==='image/png'?b.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':file.mime==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:b.slice(0,4).map(x=>String.fromCharCode(x)).join('')==='RIFF'&&b.slice(8,12).map(x=>String.fromCharCode(x)).join('')==='WEBP';
  if(!valid)return {status:400};files.push({bytes,mime:file.mime});
 }
 const props=PropertiesService.getScriptProperties();let folder=props.getProperty('robotics-screenshot-folder');
 if(!folder){folder=Drive.Files.create({name:'NEST Robotics — Private Onboarding Screenshots',mimeType:'application/vnd.google-apps.folder'},{fields:'id'}).id;props.setProperty('robotics-screenshot-folder',folder);}
 const added=[];
 for(const f of files){const name='Robotics-'+entry.key.slice(0,12)+'-'+Utilities.getUuid()+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[f.mime]);const created=Drive.Files.create({name,mimeType:f.mime,parents:[folder]},Utilities.newBlob(f.bytes,f.mime,name),{fields:'id'});added.push({id:created.id,name,mime:f.mime,size:f.bytes.length,at:new Date().toISOString()});}
 entry.record.screenshots=[...(entry.record.screenshots||[]),...added];entry.record.updated=new Date().toISOString();roboticsPrivateSave_(entry);return roboticsProfileView_(entry,member);
}
function roboticsScreenshotDownload_(entry,r){
 const file=(entry.record.screenshots||[]).find(f=>f.id===r.file);if(!file||!/^[A-Za-z0-9_-]{10,100}$/.test(file.id))return {status:404};
 const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+file.id+'?alt=media',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
 if(response.getResponseCode()!==200)return {status:503};const bytes=response.getBlob().getBytes();if(bytes.length>1048576)return {status:503};
 return {status:200,screenshot:{name:file.name,mime:file.mime,data:Utilities.base64Encode(bytes)}};
}
function roboticsSetupNativeSignup(){
 if(!OWNER_EMAILS.includes(email_(Session.getEffectiveUser().getEmail())))throw new Error('Run as a NEST owner');
 const schema=roboticsSignupSchema_();if(!roboticsPrivateId_())throw new Error('Run Robotics onboarding setup first');
 const step='first-band-screenshots',protocols=roboticsProtocols_();
 if(!protocols.some(p=>p.id===step)){
  if(protocols.length>=100)throw new Error('Protocol capacity reached');
  roboticsWrite_(roboticsPrivateId_(),[{range:"'Protocols'!A"+(protocols.length+2)+':F'+(protocols.length+2),values:[[step,'Verify FIRST and Band profiles','','After activation, the member adds FIRST and Band profile screenshots in My Profile. Leadership verifies FIRST Team #2927 registration and the parent waiver before completing this step.',true,'']]}]);
 }
 Logger.log('Native Robotics signup ready: '+schema.fields.length+' questions; screenshots deferred to onboarding. No messages sent.');
}
