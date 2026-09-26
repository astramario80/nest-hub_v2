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
function weatherRole_(email,period,leaders) {
  if(OWNER_EMAILS.includes(email_(email)))return true;
  leaders=leaders||Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
  return leaders.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period.toUpperCase() &&
    /^(division manager|assistant manager|partner liaison|parnter liaison)$/i.test(String(row[2]||'').trim()) && email_(row[4])===memberEmail_(email,period));
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
  const start=page*100+10,end=Math.min(start+99,tab.properties.gridProperties.rowCount);
  const sourceRows=end>=start?(Sheets.Spreadsheets.Values.get(WEATHER_DATABASE,quoted+'A'+start+':M'+end,{valueRenderOption:'FORMATTED_VALUE'}).values||[]):[];
  const expectedPeriod=expected.title;
  const rows=sourceRows.filter(row=>String(row[3]||'').trim()===expectedPeriod);
  return {status:200,division:expected.title,summary,columns,rows,page,hasMore:end<tab.properties.gridProperties.rowCount&&sourceRows.length===100};
}
