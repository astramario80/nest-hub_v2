import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {JSDOM} from 'jsdom';
import handler from '../api/weather-native.mjs';
const OWNER='mpenalver@bethelsd.org',STUDENT='student@students.bethelsd.org',DM='manager@students.bethelsd.org',AM='assistant@students.bethelsd.org',PL='liaison@students.bethelsd.org';
function school(){
 const properties={'weather-native-store':'private'},reports=[],alerts=[],confirmations=[],reads=[],writes=[];let failReceipt=false;
 const store={getProperty:k=>properties[k]||null,setProperty(k,v){if(failReceipt&&k.startsWith('weather-confirm:')){failReceipt=false;throw Error('Receipt unavailable');}properties[k]=v;},deleteProperty:k=>delete properties[k],getProperties:()=>({...properties})};
 const leaders=[['Period 1','', 'Division Manager','',DM],['Period 1','','Assistant Manager','',AM],['Period 1','','Partner Liaison','',PL],['Period 2','','Division Manager','','other@students.bethelsd.org']];
 const ctx=vm.createContext({console,OWNER_EMAILS:[OWNER],WEATHER_DATABASE:'legacy',LEADERSHIP_DATABASE:'leaders',email_:v=>String(v||'').toLowerCase(),districtEmail_:v=>/@(?:students\.)?bethelsd\.org$/.test(v)?v:'',memberEmail_:v=>v==='manual:student'?STUDENT:v,
  hash_:v=>Buffer.from(v).toString('hex'),PropertiesService:{getScriptProperties:()=>store},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  Utilities:{getUuid:()=>crypto.randomUUID(),formatDate:(d,tz,format)=>format==='yyyy-MM-dd HH:mm:ss'?d.toISOString().slice(0,19).replace('T',' '):d.toISOString().slice(0,10),parseDate:s=>new Date(s+'Z')},
  Sheets:{Spreadsheets:{Values:{get(id,range){reads.push([id,range]);if(id==='leaders')return {values:leaders};if(range.includes('CombinedStudentList'))return {values:[['Clíné, Student','123',STUDENT,'Period 1','Division 1']]};if(range.includes('Confirmations'))return {values:confirmations};if(range.includes('Reports'))return {values:reports};if(range.includes('Alerts'))return {values:alerts};return {values:[]};},append(data,id,range,opts){writes.push({data,id,range,opts});if(range.includes('Confirmations')&&failReceipt){failReceipt=false;throw Error('Receipt unavailable');}(range.includes('Alerts')?alerts:range.includes('Confirmations')?confirmations:reports).push(...data.values);}}}},UrlFetchApp:{fetch(){throw Error('offline');}}});
 vm.runInContext(fs.readFileSync('google-spinner/WeatherEmotions.js','utf8')+fs.readFileSync('google-spinner/WeatherNative.js','utf8'),ctx);
 const call=(email,operation,fields={})=>ctx.weatherNativeDispatch_({email},{operation,...fields});const emotion=vm.runInContext('WEATHER_EMOTIONS.find(x=>x.family==="Sad").id',ctx);
 return {ctx,call,emotion,properties,reports,alerts,reads,writes,failReceipt:()=>failReceipt=true};
}
const uuid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('confirmation uses enrolled linked email, emits once, and submission is permanently idempotent',()=>{
 const s=school();const request={period:'1',draft:uuid,emotion:s.emotion};const result=s.call('manual:student','confirm',request);assert.equal(result.confirmed,true);assert.equal(result.alerted,true);assert.equal(s.alerts.length,1);assert.equal(s.reports.length,0);
 assert.equal(s.alerts[0][3],'Clíné, Student');assert.equal(s.call('manual:student','confirm',request).confirmed,true);assert.equal(s.alerts.length,1);
 const fields={...request,pacing:3,challenge:3,safety:5,working:'Working well',change:'=HYPERLINK("bad")'};assert.equal(s.call('manual:student','submit',fields).saved,true);assert.equal(s.call('manual:student','submit',fields).saved,true);assert.equal(s.reports.length,1);assert.equal(s.reports[0][5],STUDENT);assert.equal(s.writes.at(-1).opts.valueInputOption,'RAW');
 assert.equal(s.call(STUDENT,'submit',{...fields,draft:crypto.randomUUID()}).status,409);
});
test('confirmation recovers from a lost receipt without duplicating an alert',()=>{const s=school(),r={period:'1',draft:uuid,emotion:s.emotion};s.failReceipt();assert.throws(()=>s.call(STUDENT,'confirm',r));assert.equal(s.alerts.length,1);assert.equal(s.call(STUDENT,'confirm',r).confirmed,true);assert.equal(s.alerts.length,1);});
test('students cannot spoof identity, emotion, period, recipient audience, export or administer',()=>{
 const s=school();for(const operation of ['export','test','calendar','import-calendar','refresh-counselors'])assert.equal(s.call(STUDENT,operation,{draft:uuid,emotion:s.emotion}).status,403);
 assert.equal(s.call(STUDENT,'confirm',{period:'2',emotion:s.emotion,draft:uuid,email:OWNER}).status,403);
 assert.equal(s.call(STUDENT,'confirm',{period:'1',emotion:'evil',draft:uuid}).status,400);
 assert.equal(s.call(STUDENT,'reports',{period:'all'}).status,403);assert.equal(s.call(DM,'reports',{period:'2'}).status,403);assert.equal(s.call(AM,'reports',{period:'1'}).status,200);
});
test('alerts go only to owner, current division manager and partner liaison; tests stay private',()=>{
 const s=school();s.call(STUDENT,'confirm',{period:'1',emotion:s.emotion,draft:uuid});
 for(const user of [OWNER,DM,PL])assert.equal(s.call(user,'alerts').events.length,1);
 for(const user of [AM,STUDENT,'other@students.bethelsd.org'])assert.equal(s.call(user,'alerts').events.length,0);
 s.call(OWNER,'test',{period:'1',emotion:s.emotion,draft:crypto.randomUUID()});assert.equal(s.call(OWNER,'alerts').events.length,2);assert.equal(s.call(DM,'alerts').events.length,1);assert.equal(s.reports.length,0);
});
test('school counselor directory parses all six valid ranges and normalizes last names; failures retain last good mapping',()=>{
 const s=school();const directory=fs.readFileSync('tests/fixtures/weather-counselors.html','utf8');const parsed=s.ctx.weatherParseCounselors_(directory);assert.equal(parsed.length,6);assert.equal(parsed[0].name,'Katie Kimball');
 s.properties['weather-counselors']=JSON.stringify({checkedAt:new Date().toISOString(),counselors:parsed});assert.equal(s.ctx.weatherCounselor_({lastName:'Clíné'}).name,'Katie Kimball');assert.equal(s.ctx.weatherCounselor_({lastName:'Stallman'}).name,'Mike Stallman');assert.equal(s.ctx.weatherCounselor_({lastName:'!!!'}).unmatched,true);
 const saved=s.properties['weather-counselors'];s.ctx.weatherRefreshCounselors_();assert.equal(s.properties['weather-counselors'],saved);assert.ok(s.properties['weather-counselor-error']);assert.throws(()=>s.ctx.weatherParseCounselors_('<p>Broken page</p>'));
});
test('calendar edits validate actual ordered dates and recalculate trimester labels',()=>{
 const s=school();assert.equal(s.call(OWNER,'calendar',{year:'2027-2028',dates:['2027-08-30','2027-11-24','2028-03-10','2028-06-15']}).status,200);
 assert.equal(s.ctx.weatherTrimester_('2027-12-01','2027-2028'),'2');assert.equal(s.ctx.weatherTrimester_('2025-12-01','2025-2026'),'Unassigned');
 assert.equal(s.call(OWNER,'calendar',{year:'2027-2028',dates:['2027-08-30','2027-11-24','2028-02-31','2028-06-15']}).status,400);
});
const response=()=>({statusCode:0,setHeader(){},status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}});
test('native API requires a session, same-origin JSON mutations, and never accepts mutation by GET',async()=>{
 const no=response();await handler({method:'GET',headers:{},query:{}},no);assert.equal(no.statusCode,401);
 const headers={cookie:'__Host-nest-auth='+'a'.repeat(64),origin:'https://bad.example','content-type':'application/json'};
 const bad=response();await handler({method:'POST',headers,body:{operation:'confirm'}},bad);assert.equal(bad.statusCode,403);
 const read=response();await handler({method:'GET',headers,query:{operation:'submit'}},read);assert.equal(read.statusCode,400);
});
test('wheel hover only previews; explicit confirmation sends one request and exposes counselor appointment',async()=>{
 const dom=new JSDOM(fs.readFileSync('weather.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/weather'}),w=dom.window,calls=[];
 w.NestAuth={identity:{signedIn:true,email:STUDENT},ready:Promise.resolve()};w.AbortSignal.timeout=()=>undefined;const catalog=JSON.parse(fs.readFileSync('assets/weather-emotions.json','utf8'));
 w.fetch=async(url,opts={})=>{const u=String(url);if(u.endsWith('weather-emotions.json'))return {ok:true,json:async()=>catalog};if(u.endsWith('.svg'))return {ok:true,text:async()=>fs.readFileSync('assets/emotional-check-in.svg','utf8')};const body=opts.body?JSON.parse(opts.body):null;if(body)calls.push(body);return {ok:true,json:async()=>body?{confirmed:true,alerted:true,counselor:{name:'Katie Kimball',url:'https://calendar.google.com/example'}}:{periods:[],studentPeriods:['1'],admin:false}};};
 w.eval(fs.readFileSync('js/weather-form.js','utf8'));await new Promise(r=>setTimeout(r,20));const emotion=catalog.find(x=>x.family==='Sad');const group=w.document.querySelector('[data-emotion="'+emotion.id+'"]');
 group.dispatchEvent(new w.MouseEvent('pointerover',{bubbles:true}));assert.equal(w.document.getElementById('weather-emotion-answer').value,emotion.answer);assert.equal(calls.length,0);
 assert.equal(w.document.getElementById('weather-lens').hidden,false);group.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.equal(w.document.getElementById('weather-lens').hidden,true);await new Promise(r=>setImmediate(r));assert.equal(calls.length,1);assert.equal(calls[0].operation,'confirm');assert.equal(w.document.getElementById('weather-counselor').hidden,false);
 group.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await new Promise(r=>setImmediate(r));assert.equal(calls.length,1);
 assert.equal(w.document.getElementById('weather-confirm'),null);const other=catalog.find(x=>x.family==='Happy');w.document.querySelector('[data-emotion="'+other.id+'"]').dispatchEvent(new w.MouseEvent('pointerover',{bubbles:true}));assert.equal(w.document.getElementById('weather-emotion-answer').value,emotion.answer);assert.equal(calls.length,1);
 const dialog=w.document.getElementById('weather-builder');dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};w.document.getElementById('weather-change').value='Existing feedback.';w.document.getElementById('weather-builder-open').click();assert.equal(w.document.getElementById('weather-builder-feeling').value,'sad');
 for(const [key,value] of [['when','plans change'],['need','clarity'],['request','we agree first']])w.document.getElementById('weather-builder-'+key).value=value;w.document.getElementById('weather-builder-use').click();assert.equal(dialog.open,false);assert.match(w.document.getElementById('weather-change').value,/Existing feedback\.\n\nI feel sad when plans change/);
 for(const id of ['weather-pacing','weather-challenge','weather-safety'])w.document.getElementById(id).value='3';w.document.getElementById('weather-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));assert.equal(calls.at(-1).operation,'submit');assert.equal(calls.at(-1).emotion,emotion.id);assert.equal(w.document.getElementById('weather-emotion'),null);const happyGroup=w.document.querySelector('#weather-wheel [data-emotion="'+other.id+'"]');happyGroup.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await new Promise(r=>setImmediate(r));assert.equal(calls.at(-1).operation,'confirm');assert.equal(calls.at(-1).emotion,other.id);assert.equal(w.document.getElementById('weather-emotion-answer').value,other.answer);dom.window.close();
});
test('archive calendar lookup is reused across historical rows inside one request',()=>{
 const s=school();s.ctx.weatherCalendars_();const before=s.ctx.weatherTrimester_('2026-12-01','2026-2027');assert.equal(before,'2');
 // A request-local cached calendar must not be read again for every response.
 s.properties['weather-calendars']='invalid JSON';for(let i=0;i<2000;i++)assert.equal(s.ctx.weatherTrimester_('2026-12-01','2026-2027'),'2');
});
test('empty global alert polls need no spreadsheet reads and return no student data',()=>{
 const s=school();s.ctx.read_=()=>({email:STUDENT});s.properties['weather-alert-latest']='5';
 const empty=s.ctx.weatherNativePollEmpty_({operation:'alerts',session:'a'.repeat(64),since:'5'});assert.equal(empty.events.length,0);assert.equal(s.reads.length,0);
 assert.equal(s.ctx.weatherNativePollEmpty_({operation:'alerts',session:'a'.repeat(64),since:'4'}),null);
});

test('school-calendar import requires validated school-year boundaries and saves all three actual trimesters',()=>{
 const s=school(),source=fs.readFileSync('google-spinner/ServiceRequests.js','utf8');vm.runInContext(source.slice(source.indexOf('function serviceCalendarRange_'),source.indexOf('function serviceCurrentTrimester_')),s.ctx);
 s.ctx.SERVICE_CALENDARS=['school-one','school-two'];const definitions=[['First day of school','2026-08-31','2026-09-01'],['End Trimester 1','2026-11-24','2026-11-25'],['End Trimester 2','2027-03-10','2027-03-11'],['Last day of school','2027-06-15','2027-06-16']];
 s.ctx.CalendarApp={getCalendarById:()=>({getEvents:()=>definitions.map(([title,start,end])=>({isAllDayEvent:()=>true,getTitle:()=>title,getAllDayStartDate:()=>new Date(start+'T12:00:00Z'),getAllDayEndDate:()=>new Date(end+'T12:00:00Z')}))})};
 const result=s.call(OWNER,'import-calendar',{year:'2026-2027'});assert.equal(result.status,200);assert.deepEqual(Array.from(result.dates),['2026-08-31','2026-11-24','2027-03-10','2027-06-15']);
 assert.equal(s.call(OWNER,'import-calendar',{year:'2026-2028'}).status,400);s.ctx.CalendarApp.getCalendarById=()=>({getEvents:()=>[]});assert.equal(s.call(OWNER,'import-calendar',{year:'2025-2026'}).status,409);
});

test('global support alerts remain visible inside open modal dialogs without repeated announcements',async t=>{
 const dom=new JSDOM('<html><head></head><body><dialog open><p>Another NEST dialog</p></dialog></body></html>',{runScripts:'outside-only',url:'https://gknest.org/'}),w=dom.window;w.AbortSignal.timeout=()=>undefined;w.NestAuth={identity:{signedIn:true,email:DM},ready:Promise.resolve()};t.after(()=>dom.window.close());
 w.fetch=async url=>({ok:true,json:async()=>String(url).includes('alert-access')?{eligible:true}:{eligible:true,events:[{id:'test-id',student:'Synthetic student',period:'1',emotion:'Sad',counselor:{name:'Test counselor',url:'https://calendar.app.google/example'},at:new Date().toISOString(),test:true}],cursor:'1'}});
 w.eval(fs.readFileSync('js/weather-alerts.js','utf8'));await new Promise(resolve=>setImmediate(resolve));const panel=w.document.querySelector('.nest-weather-alert');assert.ok(panel);assert.equal(panel.parentElement.tagName,'DIALOG');assert.match(panel.textContent,/Student: Synthetic student/);assert.match(panel.textContent,/Emotion: Sad/);assert.equal(panel.querySelector('.nest-weather-alert-call').getAttribute('href'),'tel:+12538006176');assert.equal([...panel.querySelectorAll('a')].find(a=>a.textContent==='Schedule with Test counselor').href,'https://calendar.app.google/example');
 await w.NestWeatherAlerts.check();assert.equal(w.document.querySelector('.nest-weather-alert'),panel);w.document.querySelector('dialog').remove();await new Promise(resolve=>setImmediate(resolve));assert.equal(w.document.querySelector('.nest-weather-alert').parentElement,w.document.body);
 w.document.querySelector('.nest-weather-alert button').click();assert.equal(w.document.querySelector('.nest-weather-alert'),null);assert.doesNotMatch([...Array(w.localStorage.length)].map((_,i)=>w.localStorage.getItem(w.localStorage.key(i))).join(''),/Synthetic student|Sad/);dom.window.close();
});

test('trimester parsing prioritizes MS/HS events and supports ordinal numbers, Tri abbreviations, and inferred adjacent boundaries',()=>{
 const s=school(),events=[{title:'First day of school',start:'2026-08-31',end:'2026-09-01'},{title:'ES End of 1st Trimester',start:'2026-11-20',end:'2026-11-21'},{title:'MS/HS End of 1st Trimester - Grade Prep - Early Dismissal Gr. 6-12',start:'2026-11-24',end:'2026-11-25'},{title:'MS/HS End of Tri2 - Grade Prep',start:'2027-03-10',end:'2027-03-11'},{title:'Last day of school',start:'2027-06-15',end:'2027-06-16'}];
 assert.deepEqual(Array.from(s.ctx.weatherCalendarDates_(events)),['2026-08-31','2026-11-24','2027-03-10','2027-06-15']);
 events[2]={title:'MS/HS 2nd Trimester Begins',start:'2026-11-25',end:'2026-11-26'};assert.deepEqual(Array.from(s.ctx.weatherCalendarDates_(events)),['2026-08-31','2026-11-24','2027-03-10','2027-06-15']);
});

test('school calendar imports timed First Day of School events as local date boundaries',()=>{
 const s=school(),defs=[['First Day of School','2023-08-30','2023-08-30',false],['End of 1st Trimester','2023-11-30','2023-12-01',true],['End of 2nd Trimester','2024-03-14','2024-03-15',true],['Last Day of School','2024-06-14','2024-06-15',true]];
 s.ctx.CalendarApp={getCalendarById:()=>({getEvents:()=>defs.map(([title,start,end,allDay])=>({isAllDayEvent:()=>allDay,getTitle:()=>title,getAllDayStartDate:()=>new Date(start+'T12:00:00Z'),getAllDayEndDate:()=>new Date(end+'T12:00:00Z'),getStartTime:()=>new Date(start+'T14:15:00Z'),getEndTime:()=>new Date(end+'T21:45:00Z')}))})};
 const result=s.call(OWNER,'import-calendar',{year:'2023-2024'});assert.equal(result.status,200);assert.deepEqual(Array.from(result.dates),['2023-08-30','2023-11-30','2024-03-14','2024-06-14']);
});


test('June 30 fallback fills only a missing school-year end, never conflicting explicit events',()=>{
 const s=school(),events=[{title:'First Day of School',start:'2024-08-28',end:'2024-08-29'},{title:'End of Trimester 1',start:'2024-11-26',end:'2024-11-27'},{title:'End of Trimester 2',start:'2025-03-12',end:'2025-03-13'}];
 assert.deepEqual(Array.from(s.ctx.weatherCalendarDates_(events,'2025-06-30')),['2024-08-28','2024-11-26','2025-03-12','2025-06-30']);
 events.push({title:'Last Day of School',start:'2025-06-12',end:'2025-06-13'});assert.equal(s.ctx.weatherCalendarDates_(events,'2025-06-30')[3],'2025-06-12');
 events.push({title:'Last Day of School',start:'2025-06-13',end:'2025-06-14'});assert.equal(s.ctx.weatherCalendarDates_(events,'2025-06-30'),null);
 events.splice(1,1);assert.equal(s.ctx.weatherCalendarDates_(events,'2025-06-30'),null);
});

test('administrator without enrollment can complete a private full-form test without affecting reports or leadership alerts',()=>{
 const s=school();s.ctx.weatherSetup_=()=>{};const boot=s.call(OWNER,'bootstrap');assert.equal(boot.testMode,true);assert.equal(boot.studentPeriods.length,0);assert.ok(boot.previewPeriods.includes('1'));
 const fields={period:'1',emotion:s.emotion,draft:uuid,pacing:3,challenge:3,safety:5,working:'Synthetic check',change:'Synthetic feedback'};
 assert.equal(s.call(OWNER,'submit',fields).status,409);const receipt=s.call(OWNER,'confirm',fields);assert.equal(receipt.confirmed,true);assert.equal(receipt.test,true);assert.equal(s.alerts[0][7],true);
 assert.equal(s.call(OWNER,'alerts').events.length,1);assert.equal(s.call(DM,'alerts').events.length,0);assert.equal(s.call(PL,'alerts').events.length,0);
 assert.equal(s.call(OWNER,'submit',{...fields,safety:0}).status,400);assert.equal(s.call(OWNER,'submit',fields).test,true);assert.equal(s.call(OWNER,'submit',fields).saved,true);assert.equal(s.reports.length,0);
 assert.equal(s.call(OWNER,'confirm',{...fields,period:'invalid'}).status,403);assert.equal(s.call(STUDENT,'confirm',{...fields,period:'2',testMode:true}).status,403);
});

test('administrator test form enables division and rating controls and reports private completion',async t=>{
 const dom=new JSDOM(fs.readFileSync('weather.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/weather'}),w=dom.window;t.after(()=>w.close());w.NestAuth={identity:{signedIn:true,email:OWNER},ready:Promise.resolve()};w.AbortSignal.timeout=()=>undefined;
 const catalog=JSON.parse(fs.readFileSync('assets/weather-emotions.json','utf8'));w.fetch=async(url,opts={})=>String(url).endsWith('.json')?{ok:true,json:async()=>catalog}:String(url).endsWith('.svg')?{ok:true,text:async()=>fs.readFileSync('assets/emotional-check-in.svg','utf8')}:{ok:true,json:async()=>opts.body?{confirmed:true,saved:true,test:true}:{admin:true,testMode:true,studentPeriods:[],previewPeriods:['1','2'],periods:['1','2']}};
 w.eval(fs.readFileSync('js/weather-form.js','utf8'));await new Promise(r=>setImmediate(r));assert.equal(w.document.getElementById('weather-fields').disabled,false);assert.equal(w.document.getElementById('weather-period').options.length,2);assert.match(w.document.getElementById('weather-form-status').textContent,/Administrator test mode/);
 w.document.querySelector('#weather-wheel [data-emotion="e0"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await new Promise(r=>setImmediate(r));for(const id of ['weather-pacing','weather-challenge','weather-safety'])w.document.getElementById(id).value='3';w.document.getElementById('weather-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));assert.match(w.document.getElementById('weather-submit-status').textContent,/No student report was added/);assert.equal(w.document.getElementById('weather-submit').textContent,'Start another test');
 w.document.getElementById('weather-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(w.document.getElementById('weather-submit').textContent,'Complete administrator test');
});

test('seven administrator sample surnames use the live counselor matcher while students retain their enrolled surname',()=>{
 const s=school();s.ctx.weatherSetup_=()=>{};s.properties['weather-counselors']=JSON.stringify({checkedAt:new Date().toISOString(),counselors:s.ctx.weatherParseCounselors_(fs.readFileSync('tests/fixtures/weather-counselors.html','utf8'))});
 const samples=s.call(OWNER,'bootstrap').previewSurnames;assert.equal(samples.length,7);const expected=['Katie Kimball','Katie Kimball','Brad Hostak','Emmalee Kronoff','Zoey Williams','Elizabeth Martinez','Mike Stallman'];
 samples.forEach((previewSurname,i)=>{const result=s.call(OWNER,'counselor',{period:'1',previewSurname});assert.equal(result.counselor.name,expected[i]);assert.equal(result.counselor.unmatched,undefined);assert.match(result.counselor.url,/calendar|youcanbook/);});
 assert.equal(s.call(STUDENT,'counselor',{period:'1',previewSurname:'Williams'}).counselor.name,'Katie Kimball');assert.equal(s.call(OWNER,'counselor',{period:'1',previewSurname:'Unapproved'}).counselor.unmatched,true);
 const confirmed=s.call(OWNER,'confirm',{period:'1',previewSurname:'Penalver',emotion:s.emotion,draft:uuid});assert.equal(confirmed.test,true);assert.equal(confirmed.counselor.name,'Elizabeth Martinez');assert.equal(s.call(DM,'alerts').events.length,0);assert.equal(s.reports.length,0);
});


test('support alerts resolve the student counselor from current ranges, including older alert records',()=>{
 const s=school(),counselors=s.ctx.weatherParseCounselors_(fs.readFileSync('tests/fixtures/weather-counselors.html','utf8'));s.properties['weather-counselors']=JSON.stringify({checkedAt:new Date().toISOString(),counselors});
 s.call(STUDENT,'confirm',{period:'1',emotion:s.emotion,draft:uuid});assert.equal(s.alerts[0][9],'Clíné');assert.equal(s.call(DM,'alerts').events[0].counselor.name,'Katie Kimball');
 counselors[0].name='Updated counselor';counselors[0].url='https://calendar.app.google/updated';s.properties['weather-counselors']=JSON.stringify({checkedAt:new Date().toISOString(),counselors});assert.equal(s.call(DM,'alerts').events[0].counselor.url,'https://calendar.app.google/updated');
 s.alerts[0].pop();assert.equal(s.call(DM,'alerts').events[0].counselor.name,'Updated counselor');assert.equal(s.call(AM,'alerts').events.length,0);
});
