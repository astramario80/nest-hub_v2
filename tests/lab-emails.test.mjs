import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const context=vm.createContext({Utilities:{formatDate(date,zone){return new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);}}});
vm.runInContext(['LabRequests.js','LabEmails.js'].map(f=>fs.readFileSync('google-spinner/'+f,'utf8')).join('\n'),context);
const record={id:'sample-pass',name:'Rivera, Alex',day:'2026-10-29',time:'10:00',goal:'Build <script> & print',teachers:[{name:'Teacher, Sample'}]};
test('issued and checked-in emails use charcoal and orange tickets, with a stamp and actual Pacific arrival only on check-in',()=>{
 const issued=context.labPassEmail_(record,{state:'issued'}),checked=context.labPassEmail_(record,{state:'checked-in',at:'2026-10-29T17:07:00Z'});
 for(const message of [issued,checked]){assert.match(message.htmlBody,/ADMIT ONE/);assert.match(message.htmlBody,/#242424;border:2px solid #e87722/);assert.match(message.htmlBody,/Build &lt;script&gt; &amp; print/);assert.match(message.htmlBody,/10:00 AM/);}
 assert.doesNotMatch(issued.htmlBody,/nest-lab-checked-in-stamp/);assert.match(issued.htmlBody,/nest-lab-email-brand/);
 assert.match(checked.htmlBody,/alt="Checked in"/);assert.match(checked.htmlBody,/Checked in · Oct 29, 2026, 10:07 AM \(Pacific time\)/);assert.match(checked.body,/10:07 AM/);assert.match(checked.htmlBody,/nest-lab-email-brand/);
});
test('every email presents NEST Request subtext followed by its explicit status heading',()=>{
 const messages=[['Pass requested',context.labNewRequestEmail_(record,null,'')],...Object.entries({issued:'Pass issued',denied:'Pass denied',tabled:'Request tabled','checked-in':'Checked in'}).map(([state,title])=>[title,context.labPassEmail_(record,{state,reason:'Unavailable',at:'2026-10-29T17:07:00Z'})])];
 for(const [title,message]of messages){assert.match(message.htmlBody,/>NEST™ Request<\/p><h1 /);assert.ok(message.htmlBody.includes('>'+title+'</h1>'));assert.doesNotMatch(message.htmlBody,/#fff0bc|#fffdf8/);}
});

test('official program and lab names and the verified work signature appear in HTML and plain-text notifications',()=>{
 const messages=[context.labNewRequestEmail_(record,null,''),...['issued','tabled','denied','checked-in'].map(state=>context.labPassEmail_(record,{state,reason:'Unavailable',teacherRequested:state==='denied',at:'2026-10-29T17:07:00Z'}))];
 for(const m of messages){assert.match(m.subject,/^NEST™ Request ·/);for(const text of [m.htmlBody,m.body]){assert.match(text,/Mario Peñalver, MA MAE \(He\/Him\/His\)/);assert.match(text,/CTE Engineering, Robotics/);assert.match(text,/Graham-Kapowsin HS/);assert.match(text,/Room 174/);assert.doesNotMatch(text,/lab request|the lab|\bMario\b(?! Peñalver)/i);}assert.match(m.htmlBody,/https:\/\/calendly.com\/mpenalver/);}
});

test('directory and archived teacher labels render the administrator preferred name without rewriting source data',()=>{const teacher={name:'PENALVER, MARIO',email:'mpenalver@bethelsd.org'};assert.equal(context.labTeacherName_(teacher),'Mario Peñalver');assert.equal(teacher.name,'PENALVER, MARIO');const message=context.labPassEmail_({...record,teachers:[teacher]},{state:'issued'});assert.match(message.htmlBody,/Mario Peñalver/);assert.doesNotMatch(message.htmlBody,/PENALVER, MARIO/);});
