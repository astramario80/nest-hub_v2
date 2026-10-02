import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(canManage=true){
 const calls=[];
 const ctx=vm.createContext({console,Sheets:{Spreadsheets:{get:()=>({sheets:[{properties:{title:'Applications',gridProperties:{rowCount:250}}},{properties:{title:'Division Team'}}]}),Values:{batchGet:(_id,options)=>{calls.push(options.ranges);return {valueRanges:options.ranges.map(range=>({values:range.includes('A1:H1')?[['Timestamp','Name','Period']]:range.includes('Division Team')?[['Assistant Manager','Current member','member@students.bethelsd.org']]:[['Today','Applicant','Period 2'],['Today','Other','Period 1']] }))};}}}}});
 vm.runInContext(fs.readFileSync('google-spinner/Hiring.js','utf8'),ctx);ctx.hiringRows_=()=>[];ctx.hiringPermissions_=()=>({canReview:true,canManage});ctx.hiringWorkbook_=()=> 'workbook';ctx.rows_=()=>[['Current member','member@students.bethelsd.org']];ctx.districtEmail_=x=>x;
 return {ctx,calls};
}
test('hiring batches authorized workbook cells and filters application rows to its division',()=>{
 const {ctx,calls}=setup();const result=ctx.hiringView_('manager','2',1);assert.equal(calls.length,1);assert.deepEqual([...calls[0]],["'Applications'!A1:H1","'Applications'!A102:H201","'Division Team'!B3:D20"]);assert.equal(result.applications.length,1);assert.equal(result.applications[0][1],'Applicant');assert.equal(result.team.length,1);assert.equal(result.candidates.length,1);assert.equal(result.page,1);
});
test('review-only hiring access does not read team assignments or roster candidates',()=>{
 const {ctx,calls}=setup(false);const result=ctx.hiringView_('reviewer','2',0);assert.equal(calls[0].length,2);assert.equal(result.team.length,0);assert.equal(result.candidates.length,0);
});
test('denied hiring access does not read the application workbook',()=>{
 const {ctx,calls}=setup();ctx.hiringPermissions_=()=>({canReview:false,canManage:false});assert.equal(ctx.hiringView_('outsider','2',0).status,403);assert.equal(calls.length,0);
});
