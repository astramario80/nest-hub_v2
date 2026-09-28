// Read-only, division-scoped weather report view. Never return the workbook URL or another tab.
const WEATHER_DATABASE = '1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8';
const WEATHER_TABS = {
  Advisory: {id:336431884,title:'Advisory'},
  '1': {id:746267134,title:'Period 1'},
  '2': {id:1427888033,title:'Period 2'},
  '3': {id:1130272553,title:'Period 3'},
  '4': {id:427894969,title:'Period 4'},
  '5': {id:544800814,title:'Period 5'},
  CTSO: {id:1301441231,title:'CTSO'}
};
const WEATHER_PERIODS = Object.keys(WEATHER_TABS);
// Bethel's published 2026–27 student calendar. Refresh these dates for each school year.
const WEATHER_TRIMESTERS = [
  {start:'2026-08-31',end:'2026-11-24'},
  {start:'2026-11-25',end:'2027-03-10'},
  {start:'2027-03-11',end:'2027-06-15'}
];
function weatherSerial_(date) {return Date.parse(date+'T00:00:00Z')/86400000+25569;}
function weatherCurrentTrimester_() {
  const today=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd');
  const trimester=WEATHER_TRIMESTERS.find(item=>item.start<=today&&today<=item.end);
  return trimester&&{start:weatherSerial_(trimester.start),end:Math.min(weatherSerial_(trimester.end),weatherSerial_(today))};
}
function weatherRole_(email,period,leaders) {
  if(OWNER_EMAILS.includes(email_(email)))return true;
  leaders=leaders||Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
  const ownEmail=memberEmail_(email,period),ctsoEmail=memberEmail_(email,'CTSO');
  return leaders.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period.toUpperCase() &&
    /^(division manager|assistant manager|partner liaison|parnter liaison)$/i.test(String(row[2]||'').trim()) && email_(row[4])===ownEmail) ||
    leaders.some(row=>String(row[0]||'').trim().toUpperCase()==='CTSO' &&
    /^chief (executive|financial|operations) officer$/i.test(String(row[2]||'').trim()) && email_(row[4])===ctsoEmail);
}
function weatherForMember_(email,period,page) {
  if(period==='mine') {
    const all=WEATHER_PERIODS;
    const leaders=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
    return {status:200,periods:all.filter(value=>weatherRole_(email,value,leaders))};
  }
  if(!WEATHER_PERIODS.includes(period)||!Number.isInteger(page)||page<0||page>100)return {status:400};
  if(!weatherRole_(email,period))return {status:403};
  const info=Sheets.Spreadsheets.get(WEATHER_DATABASE,{fields:'sheets(properties(sheetId,title,hidden,gridProperties(rowCount)))'});
  const expected=WEATHER_TABS[period];
  const tab=(info.sheets||[]).find(sheet=>!sheet.properties.hidden && sheet.properties.sheetId===expected.id && sheet.properties.title===expected.title);
  if(!tab)return {status:404};
  const title=tab.properties.title;
  const quoted="'"+title.replace(/'/g,"''")+"'!";
  const summaryRows=Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,quoted+'C2:F6',{valueRenderOption:'FORMATTED_VALUE'}).values||[];
  const summary=summaryRows.map(row=>[0,1,2,3].map(index=>String(row[index]??'')));
  const columns=(Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,quoted+'A9:M9',{valueRenderOption:'FORMATTED_VALUE'}).values||[])[0]||[];
  if(String(columns[0]||'').trim()!=='Timestamp')return {status:503};
  const trimester=weatherCurrentTrimester_();
  const lastRow=tab.properties.gridProperties.rowCount;
  const timestamps=trimester&&lastRow>=10?(Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,quoted+'A10:A'+lastRow,{valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'}).values||[]):[];
  const matchingRows=[];
  timestamps.forEach((row,index)=>{
    const serial=Number(row[0]);
    if(row[0]!==''&&row[0]!=null&&Number.isFinite(serial)&&Math.floor(serial)>=trimester.start&&Math.floor(serial)<=trimester.end)matchingRows.push(index+10);
  });
  const first=matchingRows[0],last=matchingRows[matchingRows.length-1];
  const sourceRows=first==null?[]:(Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,quoted+'A'+first+':M'+last,{valueRenderOption:'FORMATTED_VALUE'}).values||[]);
  const matching=new Set(matchingRows);
  const expectedPeriod=expected.title;
  const currentRows=sourceRows.filter((row,index)=>matching.has(first+index)&&String(row[3]||'').trim()===expectedPeriod);
  const rows=currentRows.slice(page*100,(page+1)*100);
  return {status:200,division:expected.title,summary,columns,rows,page,hasMore:(page+1)*100<currentRows.length};
}
