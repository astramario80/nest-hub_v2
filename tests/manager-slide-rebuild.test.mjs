import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture(options={}){
 const events=[],state=new Map(),original=[{id:'title'},{id:'old-role'}],slides=[...original],source=[{id:'new-role-1'},{id:'new-role-2'}];
 original.forEach(s=>s.remove=()=>{events.push('remove:'+s.id);slides.splice(slides.indexOf(s),1);});
 const iter=items=>{let i=0;return {hasNext:()=>i<items.length,next:()=>items[i++]};};
 const manager={getId:()=> 'manager',getName:()=> 'Division 1 Team_Manager Slides',makeCopy:()=>{events.push('backup');if(options.backupFails)throw new Error('Backup failed');return {getId:()=> 'backup'};}};
 const leader={getId:()=> 'source',getName:()=> 'Division 1_Assistant Manager'};
 const folder={getFiles:()=>iter([manager]),getFoldersByName:()=>iter([{getFiles:()=>iter([leader])}])};
 const deck={getSlides:()=>slides.slice(),appendSlide:s=>{events.push('append:'+s.id);if(options.copyFails&&s.id==='new-role-2')throw new Error('Copy failed');const copy={id:s.id,remove(){events.push('rollback:'+s.id);slides.splice(slides.indexOf(copy),1);}};slides.push(copy);return copy;},saveAndClose:()=>events.push('save')};
 const ctx=vm.createContext({Date,console,Logger:{log(){}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>state.get(k),setProperty:(k,v)=>state.set(k,v)})},DriveApp:{createFolder:()=>({getId:()=> 'private-backups'}),getFileById:()=>manager,getFolderById:id=>id==='1JIjmW9E7Z0im8udvmdTksNdrb7NSjD5k'?{getFoldersByName:()=>iter([folder])}:id==='private-backups'?{}:{getFoldersByName:()=>iter([{getFiles:()=>iter([])}])}},SpreadsheetApp:{openById:id=>({getSheetByName:()=>({getRange:()=>({getValues:()=>id==='1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I'?[['Period 1','','Assistant Manager','','assistant@students.bethelsd.org']]:[['Assistant Manager']]})})})},SlidesApp:{openById:id=>{if(id==='manager')return deck;if(options.readFails)throw new Error('Source unavailable');return {getSlides:()=>source};}},nestSlideRole_:s=>String(s).toLowerCase(),nestSyncDivisionSlideAccess:()=>events.push('sync')});
 vm.runInContext(fs.readFileSync('google-control-center/SlideshowUpdates.js','utf8'),ctx);
 return {ctx,events,slides,original,run:()=>ctx.updateManagerSlides('Division 1')};
}
test('rebuild backs up first, appends all sources before deleting compiled slides and never edits originals',()=>{
 const f=fixture();f.run();assert.deepEqual(f.slides.map(s=>s.id),['title','new-role-1','new-role-2']);assert.deepEqual(f.events,['backup','append:new-role-1','append:new-role-2','remove:old-role','save','sync']);
});
test('unreadable sources or failed backups leave the existing meeting slideshow intact',()=>{
 for(const options of [{readFails:true},{backupFails:true}]){const f=fixture(options);assert.throws(f.run);assert.deepEqual(f.slides,f.original);assert.ok(!f.events.some(e=>e.startsWith('remove:')));}
});
test('a copy failure rolls back newly inserted slides and preserves existing content',()=>{
 const f=fixture({copyFails:true});assert.throws(f.run,/Copy failed/);assert.deepEqual(f.slides,f.original);assert.ok(f.events.includes('rollback:new-role-1'));assert.ok(!f.events.includes('remove:old-role'));
});
test('permission-only menu action never rebuilds presentation content',()=>{
 const f=fixture(),alerts=[],periods=[];f.ctx.Session={getActiveUser:()=>({getEmail:()=> 'manager@students.bethelsd.org'})};f.ctx.SpreadsheetApp.getUi=()=>({alert:text=>alerts.push(text)});f.ctx.NEST_getAllowedDivisionsForUser_=()=>['Division 1'];f.ctx.nestSyncDivisionSlideAccess=p=>periods.push(p);f.ctx.updateManagerSlides=()=>{throw new Error('Must not rebuild');};f.ctx.NEST_syncMySlidePermissions();assert.deepEqual(periods,['1']);assert.equal(alerts.length,1);
});
