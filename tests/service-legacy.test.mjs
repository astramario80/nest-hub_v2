import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
class Sheet{
 constructor(title,grid){this.title=title;this.grid=grid;this.sorted=null;this.width=26;}
 getName(){return this.title;}getLastRow(){return this.grid.length;}getLastColumn(){return Math.max(...this.grid.map(r=>r.length));}getMaxColumns(){return this.width;}insertColumnsAfter(_at,count){this.width+=count;}
 getRange(row,col,height=1,width=1){const self=this;return {getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>self.grid[row-1+i]?.[col-1+j]??'')),getDisplayValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String(self.grid[row-1+i]?.[col-1+j]??''))),getValue:()=>self.grid[row-1]?.[col-1]??'',setValues:values=>{values.forEach((r,i)=>r.forEach((v,j)=>{self.grid[row-1+i]??=[];self.grid[row-1+i][col-1+j]=v;}));},setValue:value=>{self.grid[row-1]??=[];self.grid[row-1][col-1]=value;},sort:order=>self.sorted=order};}
}
function fixture(){
 const headers=['Status','Project Manager','Log','Timestamp','Email Address','Is there a phone number we can reach you at?','Choose your name below:',"If you don't see your name above fill it in here.",'What room can we find you in?','What is the category of your request?','How fast do you need this done?',"To the best of your ability, please describe the problem you'd like us to tackle.",'Share a picture or video of the issue you\'re facing'];
 const open=new Sheet('ServiceRequests',[headers,['Assigned','Project Manager','Internal',new Date(Date.now()-86400000*3),'staff@bethelsd.org','555','Name','','174','Repair',4,'Fix chair','https://drive.google.com/file/d/attachment']]);
 const closed=new Sheet('Closed Tickets',[['Status','Project Manager','Project Notes','Timestamp','Email Address','Please share a phone number we can reach you at.','Please share your first and last name here.','What room can we find you in?','What is the category of your request?','How fast do you need this done? (5 is ASAP.)',"To the best of your ability, please describe the problem you'd like us to tackle.",'Share a picture or video of the issue you\'re facing.','Request ID']]);
 const ss={getSheetByName:name=>name==='ServiceRequests'?open:closed};const ctx=vm.createContext({SpreadsheetApp:{openById:()=>ss},Date,Logger:{log(){}},Utilities:{getUuid:()=> '11111111-1111-4111-8111-111111111111'}});
 vm.runInContext(fs.readFileSync('service-script/Code.js','utf8')+'\n'+fs.readFileSync('service-script/ServiceSetup.js','utf8'),ctx);return {ctx,open,closed};
}
test('days-opened and sorting use named columns and leave attachment URLs untouched',()=>{
 const {ctx,open}=fixture();ctx.calculateDaysOpened();assert.equal(open.grid[1][12],'https://drive.google.com/file/d/attachment');assert.equal(open.grid[0][13],'Days Opened');assert.equal(open.grid[1][13],3);
 ctx.sortFormResponses();assert.equal(open.sorted[1].column,11);assert.equal(open.grid[1][12],'https://drive.google.com/file/d/attachment');
});
test('legacy archive maps old and new schema labels and stores formula-looking text literally',()=>{
 const {ctx,open,closed}=fixture();ctx.serviceTicketId_(open,2);open.grid[1][11]='=IMPORTXML("https://example.invalid","//data")';
 const row=ctx.serviceMapRow_(open,closed,2);assert.equal(row[7],'174');assert.equal(row[5],'555');assert.equal(row[6],'Name');assert.equal(row[10].startsWith("'=IMPORTXML"),true);assert.equal(row[11],'https://drive.google.com/file/d/attachment');assert.equal(row[12],'11111111-1111-4111-8111-111111111111');
});
test('legacy dialog uses permanent IDs after sorting instead of accepting stale row numbers',()=>{
 const {ctx,open}=fixture();ctx.serviceRequireEditor_=()=>true;ctx.serviceTicketId_(open,2);const id=open.grid[1][13];open.grid.unshift(open.grid.shift(),Array(open.grid[0].length).fill(''));
 const result=ctx.getOpenTicketsForDialog();assert.equal(result[0].id,id);assert.equal('row' in result[0],false);
 assert.equal(ctx.serviceRowById_(id).row,3);assert.throws(()=>ctx.serviceRowById_(2),/missing/);
});
