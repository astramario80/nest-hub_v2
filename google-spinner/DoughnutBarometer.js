// Read the summary that the legacy absence job writes. No student-level responses leave Google.
const DOUGHNUT_WORKBOOK = '1wb1h-GIy8yL-gC-3XZPssZniFNl1NMdI0dEjig4pq5g';
const DOUGHNUT_TAB = "'DoughnutBarometer'!";
const DOUGHNUT_PERIODS = ['Period 7','Period 1','Period 2','Period 3','Period 4','Period 5'];
function doughnutDate_(value) {
  const match = String(value||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!match)return '';
  const month=Number(match[1]),day=Number(match[2]),year=Number(match[3]);
  const date=new Date(year,month-1,day);
  if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return '';
  return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function doughnutBarometer_(sessionToken) {
  const window=Sheets.Spreadsheets.Values.batchGet(DOUGHNUT_WORKBOOK,{
    ranges:[DOUGHNUT_TAB+'B3',DOUGHNUT_TAB+'D3'],valueRenderOption:'FORMATTED_VALUE'
  }).valueRanges||[];
  const start=doughnutDate_(window[0]&&window[0].values&&window[0].values[0]&&window[0].values[0][0]);
  const end=doughnutDate_(window[1]&&window[1].values&&window[1].values[0]&&window[1].values[0][0]);
  const today=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd');
  if(!start||!end||today<start||today>end)return {status:200,active:false};
  const rows=Sheets.Spreadsheets.Values.get(DOUGHNUT_WORKBOOK,DOUGHNUT_TAB+'G6:H11',{valueRenderOption:'UNFORMATTED_VALUE'}).values||[];
  if(rows.length!==DOUGHNUT_PERIODS.length||rows.some((row,index)=>row[0]!==DOUGHNUT_PERIODS[index]||!Number.isFinite(Number(row[1]))||Number(row[1])<0||Number(row[1])>10))return {status:503};
  const commentsAuthorized=typeof sessionToken==='string'&&/^[a-f0-9]{64}$/.test(sessionToken)&&
    Boolean(authSession_(sessionToken,PropertiesService.getScriptProperties(),Date.now()));
  let comments=[];
  if(commentsAuthorized) {
    const notes=Sheets.Spreadsheets.Values.get(DOUGHNUT_WORKBOOK,DOUGHNUT_TAB+'B6:E',{valueRenderOption:'FORMATTED_VALUE'}).values||[];
    comments=notes.filter(row=>DOUGHNUT_PERIODS.includes(String(row[0]||'').trim())&&String(row[3]||'').trim())
      .map(row=>({period:String(row[0]).trim(),text:String(row[3]).trim().slice(0,2000)}));
  }
  // Legacy D3 is the final absence date plus three calendar days.
  const finalAbsence=new Date(Number(end.slice(0,4)),Number(end.slice(5,7))-1,Number(end.slice(8,10)));
  finalAbsence.setDate(finalAbsence.getDate()-3);
  const finalAbsenceDay=Utilities.formatDate(finalAbsence,'America/Los_Angeles','yyyy-MM-dd');
  return {status:200,active:true,start,end,announcementReady:today>finalAbsenceDay,
    periods:rows.map(row=>({name:row[0],average:Number(row[1])})),commentsAuthorized,comments};
}
