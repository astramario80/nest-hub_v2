import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source=['Code.js','Auth.js','Tracker.js','Hiring.js'].map(name=>fs.readFileSync('google-spinner/'+name,'utf8')).join('\n');
function setup(current='Existing, Student') {
 const writes=[];
 const roster=[['New, Student','','new@students.bethelsd.org'],['Existing, Student','','existing@students.bethelsd.org']];
 const leader=[['Period 1','https://docs.google.com/spreadsheets/d/workbook/edit','Division Manager','','manager@students.bethelsd.org']];
 const rule={condition:{type:'ONE_OF_LIST',values:[{userEnteredValue:'Existing, Student'}]},strict:true};
 const Sheets={Spreadsheets:{Values:{get:(id,range)=>{
   if(range==="'Imported'!B2:F99")return {values:leader};
   if(range==="'Period 1'!A2:C1000")return {values:roster};
   if(range==="'Division Team'!B3:D3")return {values:[['Division Manager',current,'existing@students.bethelsd.org']]};
   throw new Error('Unexpected range '+range);
 }},get:()=>({sheets:[{properties:{title:'Division Team',sheetId:5},data:[{rowData:Array.from({length:18},()=>({values:[{dataValidation:rule}]}))}]}]}),batchUpdate:(body,id)=>writes.push({body,id})}};
 const ctx=vm.createContext({Sheets,console});vm.runInContext(source,ctx);
 return {ctx,writes};
}
const request={period:'1',row:3,position:'Division Manager',expectedName:'Existing, Student',expectedEmail:'existing@students.bethelsd.org',studentEmail:'new@students.bethelsd.org'};
test('only current division manager can assign a roster student',()=>{
 const {ctx,writes}=setup();
 assert.equal(ctx.hiringAssign_('outsider@students.bethelsd.org',request).status,403);
 assert.equal(writes.length,0);
 const result=ctx.hiringAssign_('manager@students.bethelsd.org',request);
 assert.equal(result.status,200);assert.equal(result.name,'New, Student');assert.equal(writes.length,1);
 assert.equal(writes[0].id,'workbook');
 assert.equal(writes[0].body.requests[0].setDataValidation.range.sheetId,5);
 assert.equal(writes[0].body.requests[1].updateCells.rows[0].values[1].userEnteredValue.stringValue,'new@students.bethelsd.org');
});
test('stale cell and non-roster student cannot be assigned',()=>{
 const {ctx,writes}=setup('Changed, Student');
 assert.equal(ctx.hiringAssign_('manager@students.bethelsd.org',request).status,409);
 assert.equal(ctx.hiringAssign_('manager@students.bethelsd.org',{...request,studentEmail:'other@students.bethelsd.org'}).status,400);
 assert.equal(writes.length,0);
});
