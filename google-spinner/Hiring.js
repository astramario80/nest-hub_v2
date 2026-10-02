// Application data stays in its school-owned workbook; every read checks live leadership roles.
const HIRING_PERIODS = ['1','2','3','4','5','7','CTSO'];
function hiringRows_() {return (typeof nestAccessValues_==='function'?nestAccessValues_:Sheets.Spreadsheets.Values.get)(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];}
function hiringPermissions_(email,period,rows) {
  if(OWNER_EMAILS.includes(email_(email)))return {canReview:true,canManage:true};
  rows=rows||hiringRows_();
  const normalized=memberEmail_(email,period),ctsoEmail=memberEmail_(email,'CTSO');
  const own=rows.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&
    /^(division manager|assistant manager|chief executive officer|executive vice-president)$/i.test(String(row[2]||'').trim())&&email_(row[4])===normalized);
  const executive=rows.some(row=>String(row[0]||'').trim().toUpperCase()==='CTSO'&&
    /^chief (executive|financial|operations) officers?$/i.test(String(row[2]||'').trim())&&email_(row[4])===ctsoEmail);
  const currentMember=own&&rows_(period).some(row=>email_(row[1])===normalized);
  const currentExecutive=executive&&rows_('CTSO').some(row=>email_(row[1])===ctsoEmail);
  return {canReview:currentMember||currentExecutive,canManage:currentMember};
}
// Fixed school-owned sources also work when a division has no hires yet.
const HIRING_WORKBOOKS = {
 '1':'1Ut9K28LgaYbNHJRw6cn1l48wD_aaO484ZMjJi8zcIxo','2':'13RUztc3CXnd9bzM9IcYXEIqhO-045KbStHeB7GKA_W4',
 '3':'1-GGowYJrqxrE9fzS7Gqco1CMRqflPd45HK4NvXj4WMc','4':'1DBkq8zvNVi48aegk0AkMObEDH0krVmRnmigVPUHyuCI',
 '5':'1BAzRoHsx3lbAG-PH48_8fQHRW6WAmEJL3Fi0eIxBcGY','7':'12IHgmIYtgh840IR9A52G5nON3Q0foQKNSGU-2LCx4ks',
 'CTSO':'1Fz65n04x1wCLcuVjYpKEcEexlyZvsoMKhOfJZkhovfg'
};
const HIRING_POSITIONS = ['Division Manager','Assistant Manager','Director of Client Relations','Director of Inventory','Director of Social Marketing','Division DJ','Fabrication Supervisor','Partner Liaison','Safety Officer','Software Technician'];
function hiringPositions_(period){return period==='CTSO'?['Chief Executive Officer','Executive Vice-President','Chief Financial Officer','Chief Operations Officers',...HIRING_POSITIONS.slice(2)]:HIRING_POSITIONS;}
function hiringWorkbook_(period) {return HIRING_WORKBOOKS[period]||'';}
function hiringHash_(value) {
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value)).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function hiringKey_(row) {return hiringHash_(Array.from({length:7},(_,i)=>String(row[i]||'')));}
function hiringScores_(value) {
 try {const scores=typeof value==='string'?JSON.parse(value):value;
  return Array.isArray(scores)&&scores.length===4&&scores.every(x=>x===null||(Number.isInteger(x)&&x>=1&&x<=4))?scores:null;
 }catch{return null;}
}
function hiringReview_(row,saved) {
 const notes=String(row[7]||''),scores=hiringScores_(saved&&saved[1])||[null,null,null,null];
 return {key:hiringKey_(row),notes,scores,revision:hiringHash_([notes,scores])};
}
function hiringView_(email,period,page) {
  if(period!=='mine'&&!HIRING_PERIODS.includes(period))return {status:400};
  if(!Number.isInteger(page)||page<0||page>10)return {status:400};
  const rows=hiringRows_();
  if(period==='mine')return {status:200,periods:HIRING_PERIODS.filter(value=>hiringWorkbook_(value,rows)&&hiringPermissions_(email,value,rows).canReview)};
  const access=hiringPermissions_(email,period,rows);
  if(!access.canReview)return {status:403};
  const workbook=hiringWorkbook_(period,rows);
  if(!workbook)return {status:404};
  const info=Sheets.Spreadsheets.get(workbook,{fields:'sheets(properties(title,gridProperties(rowCount)))'});
  const tabs=info.sheets||[];
  const apps=tabs.find(sheet=>sheet.properties.title==='Applications');
  if(!apps)return {status:404};
  const start=page*100+2,end=Math.min(start+99,apps.properties.gridProperties.rowCount);
  const ranges=["'Applications'!A1:H1"];
  const applicationIndex=end>=start?ranges.push("'Applications'!A"+start+':H'+end)-1:-1;
  const teamTab=tabs.find(sheet=>sheet.properties.title==='Division Team');
  const teamIndex=access.canManage&&teamTab?ranges.push("'Division Team'!B3:D"+teamTab.properties.gridProperties.rowCount)-1:-1;
  const reviewTab=tabs.find(sheet=>sheet.properties.title==='NEST Interview Reviews');
  const reviewIndex=reviewTab?ranges.push("'NEST Interview Reviews'!A2:D"+reviewTab.properties.gridProperties.rowCount)-1:-1;
  // Fetch the headers, bounded applications and permitted team cells together.
  const values=Sheets.Spreadsheets.Values.batchGet(workbook,{ranges,valueRenderOption:'FORMATTED_VALUE'}).valueRanges||[];
  const columns=(values[0]&&values[0].values||[])[0]||[];
  const sourceRows=applicationIndex>=0&&values[applicationIndex]?values[applicationIndex].values||[]:[];
  const expectedPeriod=period==='CTSO'?'CTSO':'Period '+period;
  const applications=sourceRows.filter(row=>String(row[2]||'').trim()===expectedPeriod);
  const savedReviews=reviewIndex>=0&&values[reviewIndex]?values[reviewIndex].values||[]:[];
  const reviewMap=new Map(savedReviews.map(row=>[row[0],row]));
  const reviews=applications.map(row=>hiringReview_(row,reviewMap.get(hiringKey_(row))));
  const team=teamIndex>=0&&values[teamIndex]?values[teamIndex].values||[]:[];
  const candidates=teamIndex>=0?rows_(period).filter(row=>districtEmail_(row[1])).map(row=>({name:row[0],email:row[1]})):[];
  return {status:200,division:period==='CTSO'?'NEST Robotics':'Division '+period,canManage:access.canManage,columns,applications,reviews,team,positions:hiringPositions_(period),candidates,page,hasMore:end<apps.properties.gridProperties.rowCount&&sourceRows.length===100};
}
function hiringTeamMutation_(email,r,partner) {
 if(!HIRING_PERIODS.includes(r.period)||typeof r.position!=='string'||!r.position||r.position.length>100||
  !districtEmail_(r.studentEmail)||(!partner&&(!Number.isInteger(r.row)||r.row<3||r.row>10000||typeof r.expectedName!=='string'||r.expectedName.length>100||typeof r.expectedEmail!=='string'||r.expectedEmail.length>254)))return {status:400};
 const leaders=hiringRows_();
 if(!hiringPermissions_(email,r.period,leaders).canManage)return {status:403};
 const workbook=hiringWorkbook_(r.period),roster=rows_(r.period).filter(row=>email_(row[1])===email_(r.studentEmail));
 if(roster.length!==1)return {status:400};
 const name=String(roster[0][0]||'').trim(),studentEmail=email_(roster[0][1]);
 if(!name||name.length>100)return {status:400};
 const detail=Sheets.Spreadsheets.get(workbook,{ranges:["'Division Team'!B3:C3"],fields:'sheets(properties(sheetId,title,gridProperties(rowCount)),data(rowData(values(dataValidation))))'});
 const sheet=(detail.sheets||[]).find(item=>item.properties.title==='Division Team');
 if(!sheet)return {status:404};
 const max=sheet.properties.gridProperties.rowCount;
 const team=Sheets.Spreadsheets.Values.get(workbook,"'Division Team'!B3:D"+max,{valueRenderOption:'FORMATTED_VALUE'}).values||[];
 if(!team.some(row=>String(row[0]||'')===r.position)&&!hiringPositions_(r.period).includes(r.position))return {status:400};
 const already=team.some(row=>String(row[0]||'')===r.position&&email_(row[2])===studentEmail);
 if(partner&&already){hiringRefreshLeadership_(r.period,workbook,team,leaders);return {status:200,name,email:studentEmail,unchanged:true};}
 let row=r.row;
 if(partner){
  // Reuse an empty slot for this role; otherwise append without a per-role cap.
  const vacant=team.findIndex(item=>(String(item[0]||'')===r.position||!item[0])&&!item[1]&&!item[2]);
  row=vacant>=0?vacant+3:Math.max(3,team.length+3);
 }else{
  const current=team[row-3]||[];
  if(String(current[0]||'')===r.position&&String(current[1]||'')===name&&email_(current[2])===studentEmail){hiringRefreshLeadership_(r.period,workbook,team,leaders);return {status:200,name,email:studentEmail,unchanged:true};}
  if(String(current[0]||'')!==r.position||String(current[1]||'')!==r.expectedName||email_(current[2])!==email_(r.expectedEmail))return {status:409};
  if(already&&email_(current[2])!==studentEmail)return {status:409};
 }
 const requests=[],sheetId=sheet.properties.sheetId;
 if(row>max)requests.push({appendDimension:{sheetId,dimension:'ROWS',length:Math.max(20,row-max)}});
 if(partner)requests.push({copyPaste:{source:{sheetId,startRowIndex:2,endRowIndex:3,startColumnIndex:1,endColumnIndex:4},destination:{sheetId,startRowIndex:row-1,endRowIndex:row,startColumnIndex:1,endColumnIndex:4},pasteType:'PASTE_FORMAT'}});
 const rules=sheet.data&&sheet.data[0]&&sheet.data[0].rowData&&sheet.data[0].rowData[0]&&sheet.data[0].rowData[0].values||[];
 const positionRule=rules[0]&&rules[0].dataValidation;
 if(partner&&positionRule)requests.push({setDataValidation:{range:{sheetId,startRowIndex:row-1,endRowIndex:row,startColumnIndex:1,endColumnIndex:2},rule:positionRule}});
 const nameRule=rules[1]&&rules[1].dataValidation;
 if(nameRule&&nameRule.condition.type==='ONE_OF_LIST'){
  const options=[...new Set([...nameRule.condition.values.map(value=>value.userEnteredValue),name])].filter(Boolean).sort();
  requests.push({setDataValidation:{range:{sheetId,startRowIndex:row-1,endRowIndex:row,startColumnIndex:2,endColumnIndex:3},rule:{condition:{type:'ONE_OF_LIST',values:options.map(value=>({userEnteredValue:value}))},strict:true,showCustomUi:true}}});
 }
 const literal=value=>({userEnteredValue:{stringValue:String(value)}});
 requests.push({updateCells:{start:{sheetId,rowIndex:row-1,columnIndex:1},rows:[{values:[r.position,name,studentEmail].map(literal)}],fields:'userEnteredValue'}});
 team[row-3]=[r.position,name,studentEmail];
 // Keep the original exported team columns in step with the website assignments.
 requests.push({updateCells:{range:{sheetId,startRowIndex:2,endRowIndex:Math.max(max,row),startColumnIndex:5,endColumnIndex:8},rows:team.map(item=>({values:[item[0]||'',item[1]||'',item[2]||''].map(literal)})),fields:'userEnteredValue'}});
 Sheets.Spreadsheets.batchUpdate({requests},workbook);
 hiringRefreshLeadership_(r.period,workbook,team,leaders);
 return {status:200,name,email:studentEmail};
}
function hiringAssign_(email,r){return hiringTeamMutation_(email,r,false);}
function hiringPartner_(email,r){return hiringTeamMutation_(email,r,true);}
function hiringRefreshLeadership_(period,workbook,team,leaders){
 const remaining=leaders.filter(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()!==period);
 const periodName=period==='CTSO'?'CTSO':'Period '+period;
 const updated=remaining.concat(team.filter(row=>row[0]&&row[1]&&row[2]).map(row=>[periodName,'https://docs.google.com/spreadsheets/d/'+workbook+'/edit',...row]));
 const detail=Sheets.Spreadsheets.get(LEADERSHIP_DATABASE,{fields:'sheets(properties(sheetId,title,gridProperties(rowCount)))'});
 const sheet=detail.sheets.find(item=>item.properties.title==='Imported'),max=sheet.properties.gridProperties.rowCount;
 const requests=[];
 if(updated.length+1>max)requests.push({appendDimension:{sheetId:sheet.properties.sheetId,dimension:'ROWS',length:updated.length+1-max}});
 requests.push({updateCells:{range:{sheetId:sheet.properties.sheetId,startRowIndex:1,endRowIndex:Math.max(max,updated.length+1),startColumnIndex:1,endColumnIndex:6},rows:updated.map(row=>({values:row.map((value,index)=>({userEnteredValue:{stringValue:String(value||'')},...(index===3&&districtEmail_(row[4])?{textFormatRuns:[{startIndex:0,format:{link:{uri:'mailto:'+email_(row[4])}}}]}:{})}))})),fields:'userEnteredValue,textFormatRuns'}});
 Sheets.Spreadsheets.batchUpdate({requests},LEADERSHIP_DATABASE);
}
function hiringSaveReview_(email,r){
 if(!HIRING_PERIODS.includes(r.period)||!/^[a-f0-9]{64}$/.test(r.key||'')||!/^[a-f0-9]{64}$/.test(r.revision||'')||typeof r.notes!=='string'||r.notes.length>5000||!hiringScores_(r.scores))return {status:400};
 if(!hiringPermissions_(email,r.period).canManage)return {status:403};
 const workbook=hiringWorkbook_(r.period),info=Sheets.Spreadsheets.get(workbook,{fields:'sheets(properties(sheetId,title,gridProperties(rowCount)))'});
 const apps=info.sheets.find(item=>item.properties.title==='Applications'),reviewTab=info.sheets.find(item=>item.properties.title==='NEST Interview Reviews');
 if(!apps)return {status:404};
 const ranges=["'Applications'!A2:H"+apps.properties.gridProperties.rowCount];
 if(reviewTab)ranges.push("'NEST Interview Reviews'!A2:D"+reviewTab.properties.gridProperties.rowCount);
 const values=Sheets.Spreadsheets.Values.batchGet(workbook,{ranges,valueRenderOption:'FORMATTED_VALUE'}).valueRanges||[];
 const applications=values[0]&&values[0].values||[],saved=values[1]&&values[1].values||[];
 const matches=applications.map((row,index)=>({row,index})).filter(item=>hiringKey_(item.row)===r.key&&String(item.row[2]||'').trim()===(r.period==='CTSO'?'CTSO':'Period '+r.period));
 if(matches.length!==1)return {status:409};
 const savedIndex=saved.findIndex(row=>row[0]===r.key);
 const current=hiringReview_(matches[0].row,saved[savedIndex]);
 if(current.revision!==r.revision)return {status:409};
 const requests=[],sheetId=reviewTab?reviewTab.properties.sheetId:987654321;
 const literal=value=>({userEnteredValue:{stringValue:String(value)}});
 if(!reviewTab){
  requests.push({addSheet:{properties:{sheetId,title:'NEST Interview Reviews',hidden:true,gridProperties:{rowCount:1000,columnCount:4}}}});
  requests.push({updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:[{values:['Application key','Interview ratings','Updated at','Updated by'].map(literal)}],fields:'userEnteredValue'}});
 }
 const reviewRow=savedIndex>=0?savedIndex+1:saved.length+1;
 if(reviewTab&&reviewRow>=reviewTab.properties.gridProperties.rowCount)requests.push({appendDimension:{sheetId,dimension:'ROWS',length:100}});
 requests.push({updateCells:{start:{sheetId:apps.properties.sheetId,rowIndex:matches[0].index+1,columnIndex:7},rows:[{values:[literal(r.notes)]}],fields:'userEnteredValue'}});
 requests.push({updateCells:{start:{sheetId,rowIndex:reviewRow,columnIndex:0},rows:[{values:[r.key,JSON.stringify(r.scores),new Date().toISOString(),email_(email)].map(literal)}],fields:'userEnteredValue'}});
 Sheets.Spreadsheets.batchUpdate({requests},workbook);
 return {status:200,revision:hiringHash_([r.notes,r.scores])};
}
