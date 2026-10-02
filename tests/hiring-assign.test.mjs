import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source=['Code.js','Auth.js','Tracker.js','Hiring.js'].map(name=>fs.readFileSync('google-spinner/'+name,'utf8')).join('\n');
const utilities={DigestAlgorithm:{SHA_256:'sha'},computeDigest:(_algorithm,value)=>[...createHash('sha256').update(value).digest()]};
function setup(current='Existing, Student') {
 const writes=[],team=[['Division Manager',current,'existing@students.bethelsd.org']],apps=[['2026-10-02','Applicant','Period 1','Division Manager','Experience','Qualifications','Contribution','Existing notes']];let saved=[];
 const roster=[['New, Student','','new@students.bethelsd.org'],['Existing, Student','','existing@students.bethelsd.org'],['Manager','','manager@students.bethelsd.org']];
 const leader=[['Period 1','https://docs.google.com/spreadsheets/d/workbook/edit','Division Manager','','manager@students.bethelsd.org']];
 const rule={condition:{type:'ONE_OF_LIST',values:[{userEnteredValue:'Existing, Student'}]},strict:true};let max=3,reviewTab=false;
 const Sheets={Spreadsheets:{Values:{get:(id,range)=>{
   if(range==="'Imported'!B2:F")return {values:leader};
   if(range==="'Period 1'!A2:C1000")return {values:roster};
   if(range.startsWith("'Division Team'!B3:D"))return {values:team};
   throw new Error('Unexpected range '+range);
 },batchGet:()=>({valueRanges:[{values:apps},{values:saved}]})},get:id=>id==='1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I'?{sheets:[{properties:{title:'Imported',sheetId:9,gridProperties:{rowCount:100}}}]}:{sheets:[{properties:{title:'Division Team',sheetId:5,gridProperties:{rowCount:max}},data:[{rowData:[{values:[{}, {dataValidation:rule}]}]}]},{properties:{title:'Applications',sheetId:6,gridProperties:{rowCount:1000}}},...(reviewTab?[{properties:{title:'NEST Interview Reviews',sheetId:987654321,gridProperties:{rowCount:1000}}}]:[])]},batchUpdate:(body,id)=>{
  writes.push({body,id});for(const request of body.requests){
   if(request.appendDimension?.sheetId===5)max+=request.appendDimension.length;
   if(request.addSheet)reviewTab=true;
   const u=request.updateCells;if(!u?.start)continue;
   const values=u.rows[0].values.map(cell=>cell.userEnteredValue.stringValue);
   if(u.start.sheetId===5&&u.start.columnIndex===1)team[u.start.rowIndex-2]=values;
   if(u.start.sheetId===6)apps[u.start.rowIndex-1][7]=values[0];
   if(u.start.sheetId===987654321&&u.start.rowIndex>0)saved[u.start.rowIndex-1]=values;
  }
 }}};
 const ctx=vm.createContext({Sheets,console,Utilities:utilities});vm.runInContext(source,ctx);
 ctx.hiringWorkbook_=()=> 'workbook';return {ctx,writes,team,apps,roster};
}
const request={period:'1',row:3,position:'Division Manager',expectedName:'Existing, Student',expectedEmail:'existing@students.bethelsd.org',studentEmail:'new@students.bethelsd.org'};
test('only current roster managers can assign a roster student and publish the leadership change',()=>{
 const {ctx,writes,roster}=setup();assert.equal(ctx.hiringAssign_('outsider@students.bethelsd.org',request).status,403);assert.equal(writes.length,0);
 const result=ctx.hiringAssign_('manager@students.bethelsd.org',request);assert.equal(result.status,200);assert.equal(result.name,'New, Student');assert.equal(writes.length,2);
 const assignment=writes[0].body.requests.find(r=>r.updateCells?.start);assert.equal(assignment.updateCells.rows[0].values[2].userEnteredValue.stringValue,'new@students.bethelsd.org');
 assert.equal(writes[1].body.requests[0].updateCells.rows[0].values[2].userEnteredValue.stringValue,'Division Manager');
 roster.pop();assert.equal(ctx.hiringAssign_('manager@students.bethelsd.org',request).status,403);
});
test('stale assignment and non-roster student cannot overwrite the team',()=>{
 const {ctx,writes}=setup('Changed, Student');assert.equal(ctx.hiringAssign_('manager@students.bethelsd.org',request).status,409);
 assert.equal(ctx.hiringAssign_('manager@students.bethelsd.org',{...request,studentEmail:'other@students.bethelsd.org'}).status,400);assert.equal(writes.length,0);
});
test('adding partners appends beyond original slots, retains existing people and is retry-safe',()=>{
 const {ctx,writes,team}=setup();const partner={period:'1',position:'Division Manager',studentEmail:'new@students.bethelsd.org'};
 assert.equal(ctx.hiringPartner_('manager@students.bethelsd.org',partner).status,200);assert.equal(team.length,2);assert.equal(team[0][1],'Existing, Student');assert.equal(team[1][1],'New, Student');
 assert.ok(writes[0].body.requests.some(r=>r.appendDimension));
 assert.equal(ctx.hiringPartner_('manager@students.bethelsd.org',partner).unchanged,true);assert.equal(team.length,2);
 assert.equal(ctx.hiringPartner_('manager@students.bethelsd.org',{...partner,position:'Forged role'}).status,400);
});
test('review saves literal notes and ratings together, follows an application after row movement and rejects stale saves',()=>{
 const {ctx,writes,apps}=setup();const review=ctx.hiringReview_(apps[0]);
 apps.unshift(['Other','Other','Period 2']);
 const body={period:'1',...review,notes:'=not a formula',scores:[1,2,3,4]};
 assert.equal(ctx.hiringSaveReview_('manager@students.bethelsd.org',body).status,200);
 assert.equal(apps[1][7],'=not a formula');assert.equal(apps[0][7],undefined);
 const note=writes[0].body.requests.find(r=>r.updateCells?.start?.sheetId===6);assert.equal(note.updateCells.rows[0].values[0].userEnteredValue.stringValue,'=not a formula');
 assert.equal(ctx.hiringSaveReview_('manager@students.bethelsd.org',body).status,409);
});
test('review permissions, duplicate identities and invalid ratings fail without writes',()=>{
 const {ctx,writes,apps}=setup();const body={period:'1',...ctx.hiringReview_(apps[0]),notes:'Interview note',scores:[null,2,3,4]};
 assert.equal(ctx.hiringSaveReview_('outsider@students.bethelsd.org',body).status,403);
 assert.equal(ctx.hiringSaveReview_('manager@students.bethelsd.org',{...body,scores:[5,2,3,4]}).status,400);
 apps.push([...apps[0]]);assert.equal(ctx.hiringSaveReview_('manager@students.bethelsd.org',body).status,409);assert.equal(writes.length,0);
});
