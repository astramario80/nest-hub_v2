// The credential-protected bridge supplies server-rendered aggregate PNGs only.
function nestTechExportAllowed_(email,period){
 if(nestWebAllowed_(email,period))return true;email=String(email||'').trim().toLowerCase();if(!nestSlideRoster_(period).has(email))return false;
 const sheet=SpreadsheetApp.openById('1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I').getSheetByName('Imported');return sheet.getRange(2,2,Math.max(1,sheet.getLastRow()-1),5).getValues().some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&/^software technician$/i.test(String(row[2]||'').trim())&&String(row[4]||'').trim().toLowerCase()===email);
}
function nestTechTargets_(period){
 const folder=DriveApp.getFolderById(NEST_SLIDE_FOLDERS[period]),folders=folder.getFoldersByName('Division Leader Slides');if(!folders.hasNext())throw Error('Leader slide folder missing');const leaders=folders.next().getFiles(),result=[];
 while(leaders.hasNext()){const f=leaders.next();if(f.getMimeType()==='application/vnd.google-apps.presentation'&&nestSlideRole_(f.getName().split('_').pop().replace(/^\d+-/,''))==='software technician')result.push({id:f.getId(),role:'Software Technician'});}
 if(result.length!==1)throw Error('Ambiguous or missing Software Technician deck');return result;
}
function nestTechPutGraphic_(target,blob,marker,title){
 const deck=SlidesApp.openById(target.id),slides=deck.getSlides();
 // Recover the same request even if insertion succeeded before its response was saved.
 const existing=slides.find(s=>s.getImages().some(i=>i.getDescription()===marker));if(existing)return {role:target.role,url:'https://docs.google.com/presentation/d/'+target.id+'/edit#slide=id.'+existing.getObjectId()};
 const slide=deck.appendSlide(SlidesApp.PredefinedLayout.BLANK),w=deck.getPageWidth(),h=deck.getPageHeight(),margin=24,width=Math.min(w-margin*2,(h-margin*2)*1600/900),height=width*900/1600;
 // A regular image object on a new slide; no existing slide content is changed.
 const image=slide.insertImage(blob,(w-width)/2,(h-height)/2,width,height);image.setDescription(marker);image.setTitle(title);const pageId=slide.getObjectId();deck.saveAndClose();
 return {role:target.role,url:'https://docs.google.com/presentation/d/'+target.id+'/edit#slide=id.'+pageId};
}
function nestTechGraphicExport_(r){
 if(!NEST_WEB_PERIODS.includes(r.period)||!['open','aging','types','stations','status','indicators'].includes(r.kind)||!/^\d{4}–\d{4}$/.test(r.year||'')||!/^[a-f0-9-]{36}$/.test(r.id||'')||typeof r.image!=='string'||r.image.length>900000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(r.image))return {status:400};
 if(!nestTechExportAllowed_(r.email,r.period))return {status:403};const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:503};
 try{const store=PropertiesService.getScriptProperties(),key='nest-tech-new-slide-v3:'+r.id,raw=store.getProperty(key),prior=raw&&JSON.parse(raw),identity=[r.email,r.period,r.kind,r.year].join('|');if(prior&&prior.identity!==identity)return {status:409};if(prior?.state==='completed')return {status:200,links:prior.links};
 const targets=nestTechTargets_(r.period),blob=Utilities.newBlob(Utilities.base64Decode(r.image.split(',')[1]),'image/png','NEST-tech-'+r.kind+'.png'),marker='NEST_TECH_NEW_SLIDE_V3:'+r.id;store.setProperty(key,JSON.stringify({identity,state:'running',updatedAt:Date.now()}));
 const links=targets.map(t=>nestTechPutGraphic_(t,blob,marker,'Room tech health — '+r.kind+' — '+r.year));store.setProperty(key,JSON.stringify({identity,state:'completed',updatedAt:Date.now(),links}));
 const properties=store.getProperties();for(const name of Object.keys(properties).filter(k=>k.startsWith('nest-tech-new-slide-v3:'))){try{if(JSON.parse(properties[name]).updatedAt<Date.now()-86400000)store.deleteProperty(name);}catch(_){}}
 return {status:200,links};}finally{lock.releaseLock();}
}
