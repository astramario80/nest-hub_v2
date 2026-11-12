// The form's D column is a submission timestamp. Student IDs come from website membership.
function nestRoboticsDatabaseRows_(){
 const source=SpreadsheetApp.openById('1EahcN40fqGdlHCwZi_kZ-PzxuvRx1oAZWwxEHDbdmDU').getSheetByName('Website Member Status');
 if(!source||source.getRange('M1').getValue()!=='website-authority-v1')throw new Error('Website membership storage is not ready');
 const rows=source.getRange('A2:E1000').getValues().filter(row=>String(row[2]||'').trim());
 if(!rows.length)throw new Error('Website membership storage is empty');
 nestRoboticsNamesFromRows_(rows);
 const roster=SpreadsheetApp.openById('12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE').getSheetByName('CTSO').getRange('A2:C1000').getValues();
 return rows.filter(row=>row[0]===true&&row[1]!==true).map(row=>{
  const matches=roster.filter(person=>nestRoboticsNameKey_(person[0])===nestRoboticsNameKey_(row[2])),address=String(matches.length===1?matches[0][2]:row[4]||'').trim().toLowerCase();
  const canonical=/^(\d+)@students\.bethelsd\.org$/.exec(address),id=canonical?canonical[1]:String(row[3]||'').trim();
  if(!/^\d+$/.test(id))throw new Error('Active member needs a student ID before database sync');
  return [true,false,row[2],id,canonical?address:id+'@students.bethelsd.org'];
 });
}
