import {staffContext} from './helpers/staff-context.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function setup(){
 const books=new Map();function sheet(rows){const data=rows.map(r=>[...r]),links=new Map();let capacity=Math.max(20,rows.length);
 const range=(r,c,h=1,w=1)=>({getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>data[r-1+i]?.[c-1+j]??'')),getValue:()=>data[r-1]?.[c-1]??'',setValues:values=>values.forEach((row,i)=>row.forEach((value,j)=>{data[r-1+i]??=[];data[r-1+i][c-1+j]=value;})),setRichTextValues:values=>values.forEach((row,i)=>row.forEach((v,j)=>links.set((r+i)+':'+(c+j),v))),clearContent:()=>{for(let i=0;i<h;i++)for(let j=0;j<w;j++){if(data[r-1+i])data[r-1+i][c-1+j]='';links.delete((r+i)+':'+(c+j));}},getA1Notation:()=>JSON.stringify([r,c,h,w])});
 return {data,links,getLastRow:()=>data.length,getMaxRows:()=>capacity,insertRowsAfter:(row,n)=>{capacity+=n;},getRange:(r,...args)=>typeof r==='string'?range(r==='A2'?2:6,r==='A2'?1:2):range(r,...args),getRangeList:notations=>({clearContent:()=>notations.forEach(n=>range(...JSON.parse(n)).clearContent())})};}
 const enrolled=sheet(Array.from({length:7},()=>[]).concat([['class',1,11,'Class','Student','Class, Student','Period 1','Class'],['old',2,10,'Old','Student','Old, Student','CTSO','NEST™ Robotics'],['guest',3,12,'Guest','Student','Guest, Student','Guest','Guest']]));
 const combined=sheet([['header'],['Class, Student',1,'class','Period 1'],['Old, Student',2,'old','CTSO'],['Guest, Student',3,'guest','Guest']]);
 const scheduleRows=Array.from({length:11},()=>[]);scheduleRows[1][0]='2026_2027';scheduleRows[5][1]='1';scheduleRows[8]=['untouched','','','','','', 'Class, Student',1,'Period 1'];scheduleRows[9]=['untouched','','','','','', 'Old, Student',2,'CTSO'];scheduleRows[10]=['untouched','','','','','', 'Guest, Student',3,'Guest'];const schedule=sheet(scheduleRows),ctso=sheet([['header'],['Old, Student',2,'old']]);
 books.set('master',{EnrolledStudents:enrolled,CombinedStudentList:combined});books.set('db',{Schedule:schedule,CTSO:ctso});
 const c=staffContext({Map,Set,String,Error,NEST_DATABASE:'db',email_:s=>String(s||'').toLowerCase(),SpreadsheetApp:{openById:id=>({getSheetByName:name=>books.get(id==='12XogWM3af3PLIvEyrFR39hzkI0kEmfiCZkr66y3eDcU'?'master':id)[name]}),flush(){},newRichTextValue:()=>{const value={};return {setText(t){value.text=t;return this;},setLinkUrl(t){value.url=t;return this;},build:()=>value};}}});vm.runInContext(fs.readFileSync('google-spinner/RoboticsDatabase.js','utf8'),c);return {c,enrolled,combined,schedule,ctso};
}
const state={membership:[[true,false,'New, Ada',100001,'']],members:[{row:2,name:'New, Ada',studentId:'100001',email:'100001@students.bethelsd.org',active:true,inactive:false}]};
test('database handoff updates CTSO only and preserves class, guest and adjacent schedule cells',()=>{
 const h=setup(),classRow=[...h.enrolled.data[7]],guestRow=[...h.enrolled.data[9]];assert.equal(h.c.roboticsSyncDatabase_(state),1);
 assert.deepEqual(h.enrolled.data[7],classRow);assert.deepEqual(h.enrolled.data[9],guestRow);assert.equal(h.enrolled.data[8][5],'New, Ada');assert.equal(h.schedule.data[9][0],'untouched');assert.equal(h.schedule.data[9][6],'New, Ada');assert.equal(h.schedule.links.get('10:7').url,'mailto:100001@students.bethelsd.org');assert.equal(h.ctso.data[1][1],'100001');
 h.c.roboticsSyncDatabase_(state);assert.equal(h.enrolled.data.filter(r=>r[6]==='CTSO').length,1);assert.equal(h.combined.data.filter(r=>r[3]==='CTSO').length,1);
});
test('canonical roster email supplies ID instead of a form timestamp; invalid and duplicate IDs prevent mutation',()=>{
 const h=setup();const canonical={...state,members:[{...state.members[0],studentId:'45302.661',email:'100002@students.bethelsd.org'}]};assert.equal(h.c.roboticsDatabaseRecords_(canonical)[0].id,'100002');
 const before=JSON.stringify(h.enrolled.data);assert.throws(()=>h.c.roboticsSyncDatabase_({membership:[],members:[{row:2,name:'Bad',studentId:'timestamp',active:true}]}),/student ID/);assert.throws(()=>h.c.roboticsSyncDatabase_({...state,members:[...state.members,{...state.members[0],name:'Other'}]}),/IDs need review/);assert.equal(JSON.stringify(h.enrolled.data),before);
});
