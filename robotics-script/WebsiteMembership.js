// Shared by the Program of Work and Sign-In form builders. Website status is authoritative.
function nestRoboticsActiveNames_(){
 const sheet=SpreadsheetApp.openById('1EahcN40fqGdlHCwZi_kZ-PzxuvRx1oAZWwxEHDbdmDU').getSheetByName('Website Member Status');
 if(!sheet||sheet.getRange('M1').getValue()!=='website-authority-v1')throw new Error('Website membership storage is not ready');
 const rows=sheet.getRange('A2:E1000').getValues().filter(row=>String(row[2]||'').trim());
 if(!rows.length)throw new Error('Website membership storage is empty');
 return nestRoboticsNamesFromRows_(rows);
}
function nestRoboticsNameKey_(name){
 const parts=String(name||'').trim().split(',');
 return (parts.length>1?parts.slice(1).join(' ')+' '+parts[0]:parts[0]).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
function nestRoboticsNamesFromRows_(rows){
 const seen=new Set();
 const active=rows.filter(row=>row[0]===true&&row[1]!==true);
 active.forEach(row=>{const key=nestRoboticsNameKey_(row[2]);if(!key||seen.has(key))throw new Error('Review duplicate active website membership names before syncing');seen.add(key);});
 return active.map(row=>String(row[2]).trim()).sort((a,b)=>a.localeCompare(b));
}
function nestRoboticsChoices_(choices,names,separator){
 return [...new Set(choices.filter(value=>!/_?\s*\(CTSO\)\s*$/i.test(value)).concat(names.map(name=>name+separator+'(CTSO)')))];
}
