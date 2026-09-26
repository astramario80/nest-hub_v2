// Application data stays in its school-owned workbook; every read checks live leadership roles.
const HIRING_PERIODS = ['1','2','3','4','5','7','CTSO'];
function hiringRows_() {return Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F99").values||[];}
function hiringPermissions_(email,period,rows) {
  if(OWNER_EMAILS.includes(email_(email)))return {canReview:true,canManage:true};
  rows=rows||hiringRows_();
  const normalized=memberEmail_(email,period),ctsoEmail=memberEmail_(email,'CTSO');
  const own=rows.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&
    /^(division manager|assistant manager)$/i.test(String(row[2]||'').trim())&&email_(row[4])===normalized);
  const executive=rows.some(row=>String(row[0]||'').trim().toUpperCase()==='CTSO'&&
    /^chief (executive|financial|operations) officer$/i.test(String(row[2]||'').trim())&&email_(row[4])===ctsoEmail);
  return {canReview:own||executive,canManage:own};
}
function hiringWorkbook_(period,rows) {
  const links=[...new Set(rows.filter(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period)
    .map(row=>String(row[1]||'').trim()).filter(Boolean))];
  if(links.length!==1)return '';
  const match=links[0].match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/edit(?:[?#].*)?$/);
  return match?match[1]:'';
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
  const columns=(Sheets.Spreadsheets.Values.get(workbook,"'Applications'!A1:H1",{valueRenderOption:'FORMATTED_VALUE'}).values||[])[0]||[];
  const start=page*100+2,end=Math.min(start+99,apps.properties.gridProperties.rowCount);
  const sourceRows=end>=start?(Sheets.Spreadsheets.Values.get(workbook,"'Applications'!A"+start+':H'+end,{valueRenderOption:'FORMATTED_VALUE'}).values||[]):[];
  const expectedPeriod=period==='CTSO'?'CTSO':'Period '+period;
  const applications=sourceRows.filter(row=>String(row[2]||'').trim()===expectedPeriod);
  let team=[],candidates=[];
  if(access.canManage && tabs.some(sheet=>sheet.properties.title==='Division Team')) {
    team=Sheets.Spreadsheets.Values.get(workbook,"'Division Team'!B3:D20",{valueRenderOption:'FORMATTED_VALUE'}).values||[];
    candidates=rows_(period).filter(row=>districtEmail_(row[1])).map(row=>({name:row[0],email:row[1]}));
  }
  return {status:200,division:period==='CTSO'?'NEST Robotics':'Division '+period,canManage:access.canManage,columns,applications,team,candidates,page,hasMore:end<apps.properties.gridProperties.rowCount&&sourceRows.length===100};
}
function hiringAssign_(email,r) {
  if(!HIRING_PERIODS.includes(r.period)||!Number.isInteger(r.row)||r.row<3||r.row>20||
    typeof r.position!=='string'||r.position.length>100||typeof r.expectedName!=='string'||r.expectedName.length>100||
    typeof r.expectedEmail!=='string'||r.expectedEmail.length>254||!districtEmail_(r.studentEmail))return {status:400};
  const leaders=hiringRows_();
  if(!hiringPermissions_(email,r.period,leaders).canManage)return {status:403};
  const workbook=hiringWorkbook_(r.period,leaders);
  if(!workbook)return {status:404};
  const roster=rows_(r.period).filter(row=>email_(row[1])===email_(r.studentEmail));
  if(roster.length!==1)return {status:400};
  const name=String(roster[0][0]||'').trim(),studentEmail=email_(roster[0][1]);
  if(!name||name.length>100)return {status:400};
  const current=(Sheets.Spreadsheets.Values.get(workbook,"'Division Team'!B"+r.row+':D'+r.row,{valueRenderOption:'FORMATTED_VALUE'}).values||[])[0]||[];
  if(String(current[0]||'')!==r.position||String(current[1]||'')!==r.expectedName||email_(current[2])!==email_(r.expectedEmail))return {status:409};
  const detail=Sheets.Spreadsheets.get(workbook,{ranges:["'Division Team'!C3:C20"],fields:'sheets(properties(sheetId,title),data(rowData(values(dataValidation))))'});
  const sheet=(detail.sheets||[]).find(item=>item.properties.title==='Division Team');
  const validations=(sheet&&sheet.data&&sheet.data[0]&&sheet.data[0].rowData||[]).map(row=>row.values&&row.values[0]&&row.values[0].dataValidation);
  if(validations.length!==18||validations.some(rule=>!rule||!rule.strict||rule.condition.type!=='ONE_OF_LIST'))return {status:409};
  const options=validations[0].condition.values.map(value=>String(value.userEnteredValue||''));
  if(validations.some(rule=>JSON.stringify(rule.condition.values.map(value=>String(value.userEnteredValue||'')))!==JSON.stringify(options)))return {status:409};
  const requests=[];
  if(!options.includes(name)) {
    const expanded=[...options,name].filter(Boolean).sort();
    requests.push({setDataValidation:{range:{sheetId:sheet.properties.sheetId,startRowIndex:2,endRowIndex:20,startColumnIndex:2,endColumnIndex:3},rule:{condition:{type:'ONE_OF_LIST',values:expanded.map(value=>({userEnteredValue:value}))},strict:true,showCustomUi:true}}});
  }
  requests.push({updateCells:{start:{sheetId:sheet.properties.sheetId,rowIndex:r.row-1,columnIndex:2},rows:[{values:[{userEnteredValue:{stringValue:name}},{userEnteredValue:{stringValue:studentEmail}}]}],fields:'userEnteredValue'}});
  Sheets.Spreadsheets.batchUpdate({requests},workbook);
  return {status:200,name,email:studentEmail};
}
