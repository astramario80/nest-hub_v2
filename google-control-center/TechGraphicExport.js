// The credential-protected bridge supplies server-rendered aggregate PNGs only.
function nestTechExportAllowed_(email,period){
 if(nestWebAllowed_(email,period))return true;email=String(email||'').trim().toLowerCase();if(!nestSlideRoster_(period).has(email))return false;
 const sheet=SpreadsheetApp.openById('1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I').getSheetByName('Imported');return sheet.getRange(2,2,Math.max(1,sheet.getLastRow()-1),5).getValues().some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&/^software technician$/i.test(String(row[2]||'').trim())&&String(row[4]||'').trim().toLowerCase()===email);
}
function nestTechTargets_(period){
 const folder=DriveApp.getFolderById(NEST_SLIDE_FOLDERS[period]),folders=folder.getFoldersByName('Division Leader Slides');if(!folders.hasNext())throw Error('Leader slide folder missing');const leaders=folders.next().getFiles(),root=folder.getFiles(),result=[];
 while(leaders.hasNext()){const f=leaders.next();if(f.getMimeType()==='application/vnd.google-apps.presentation'&&nestSlideRole_(f.getName().split('_').pop().replace(/^\d+-/,''))==='software technician')result.push({id:f.getId(),role:'Software Technician'});}
 while(root.hasNext()){const f=root.next();if(f.getMimeType()==='application/vnd.google-apps.presentation'&&f.getName().includes('Manager Slides'))result.push({id:f.getId(),role:'Division slideshow'});}
 if(result.length!==2||new Set(result.map(x=>x.role)).size!==2)throw Error('Ambiguous or missing slideshow target');return result;
}
function nestTechPutGraphic_(target,blob,marker,title){
 const deck=SlidesApp.openById(target.id),notes=s=>s.getNotesPage().getSpeakerNotesShape()?.getText(),matches=deck.getSlides().filter(s=>s.getImages().some(i=>String(i.getDescription()||'').startsWith(marker))||String(notes(s)?.asString()||'').split('\n').includes(marker));if(matches.length>1)throw Error('Duplicate graphic slots need review');
 const slide=matches[0]||deck.appendSlide(SlidesApp.PredefinedLayout.BLANK);if(!matches.length)notes(slide)?.appendText('\n'+marker);
 const pageId=slide.getObjectId(),previous=slide.getImages().filter(i=>String(i.getDescription()||'').startsWith(marker)),w=deck.getPageWidth(),h=deck.getPageHeight(),scale=Math.min(w/1600,h/900);let image;
 try{image=slide.insertImage(blob,(w-1600*scale)/2,(h-900*scale)/2,1600*scale,900*scale);image.setDescription(marker);image.setTitle(title);for(const old of previous)old.remove();deck.saveAndClose();}catch(error){if(image){try{image.remove();}catch(_){}}throw error;}
 return {role:target.role,url:'https://docs.google.com/presentation/d/'+target.id+'/edit#slide=id.'+pageId};
}
function nestTechGraphicExport_(r){
 if(!NEST_WEB_PERIODS.includes(r.period)||!['open','aging','types','stations','status','indicators'].includes(r.kind)||!/^\d{4}–\d{4}$/.test(r.year||'')||!/^[a-f0-9-]{36}$/.test(r.id||'')||typeof r.image!=='string'||r.image.length>900000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(r.image))return {status:400};
 if(!nestTechExportAllowed_(r.email,r.period))return {status:403};const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:503};
 try{const store=PropertiesService.getScriptProperties(),key='nest-tech-export:'+r.id,raw=store.getProperty(key),prior=raw&&JSON.parse(raw),identity=[r.email,r.period,r.kind,r.year].join('|');if(prior&&prior.identity!==identity)return {status:409};if(prior?.state==='completed')return {status:200,links:prior.links};
 const targets=nestTechTargets_(r.period),blob=Utilities.newBlob(Utilities.base64Decode(r.image.split(',')[1]),'image/png','NEST-tech-'+r.kind+'.png'),marker='NEST_TECH_GRAPHIC_V1:'+r.kind+':'+r.year;store.setProperty(key,JSON.stringify({identity,state:'running',updatedAt:Date.now()}));
 const links=targets.map(t=>nestTechPutGraphic_(t,blob,marker,'Room tech health — '+r.kind+' — '+r.year));store.setProperty(key,JSON.stringify({identity,state:'completed',updatedAt:Date.now(),links}));
 const properties=store.getProperties();for(const name of Object.keys(properties).filter(k=>k.startsWith('nest-tech-export:'))){try{if(JSON.parse(properties[name]).updatedAt<Date.now()-86400000)store.deleteProperty(name);}catch(_){}}
 return {status:200,links};}finally{lock.releaseLock();}
}
