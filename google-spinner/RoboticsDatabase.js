// Update only CTSO records; class and guest records retain their cells and rich links.
const ROBOTICS_ENROLLMENT='12XogWM3af3PLIvEyrFR39hzkI0kEmfiCZkr66y3eDcU';
function roboticsDatabaseRecords_(state){
 return state.members.filter(m=>m.active&&!m.inactive).map(member=>{
  const saved=state.membership[member.row-2]||[],sourceId=String(saved[3]||member.studentId||'').trim();
  // Prefer the uniquely matched live roster email. Never use a form timestamp as an ID.
  const address=email_(member.email||saved[4]||''),canonical=/^(\d+)@students\.bethelsd\.org$/.exec(address);
  const id=canonical?canonical[1]:sourceId;
  if(!/^\d+$/.test(id))throw new Error('Active member needs a student ID before database sync');
  return {name:member.name,id,email:canonical?address:id+'@students.bethelsd.org'};
 });
}
function roboticsDatabaseReplace_(sheet,start,col,width,periodOffset,records,richNames){
 const last=Math.max(start-1,sheet.getLastRow()),old=last>=start?sheet.getRange(start,col,last-start+1,width).getValues():[],slots=[];
 old.forEach((row,i)=>{if(String(row[periodOffset]).trim().toUpperCase()==='CTSO')slots.push(start+i);});
 let next=last+1;const targets=records.map((record,i)=>({row:slots[i]||next++,record,member:richNames?.[i]}));
 const required=targets.length?targets[targets.length-1].row:0,maxRows=sheet.getMaxRows();if(required>maxRows)sheet.insertRowsAfter(maxRows,required-maxRows);
 const groups=[];targets.forEach(target=>{const group=groups[groups.length-1];if(group&&group[group.length-1].row+1===target.row)group.push(target);else groups.push([target]);});
 groups.forEach(group=>{
  sheet.getRange(group[0].row,col,group.length,width).setValues(group.map(target=>target.record.map(value=>typeof value==='string'&&/^[=+\-@]/.test(value)?"'"+value:value)));
  if(richNames)sheet.getRange(group[0].row,col,group.length,1).setRichTextValues(group.map(target=>[SpreadsheetApp.newRichTextValue().setText(target.member.name).setLinkUrl('mailto:'+target.member.email).build()]));
 });
 const clear=slots.slice(records.length).map(row=>sheet.getRange(row,col,1,width).getA1Notation());if(clear.length)sheet.getRangeList(clear).clearContent();
}
function roboticsSyncDatabase_(state){
 const members=roboticsDatabaseRecords_(state);if(new Set(members.map(m=>m.id)).size!==members.length)throw new Error('Active member IDs need review before database sync');
 const master=SpreadsheetApp.openById(ROBOTICS_ENROLLMENT),database=SpreadsheetApp.openById(NEST_DATABASE);
 const enrolled=master.getSheetByName('EnrolledStudents'),combined=master.getSheetByName('CombinedStudentList'),schedule=database.getSheetByName('Schedule'),ctso=database.getSheetByName('CTSO');
 if(!enrolled||!combined||!schedule||!ctso)throw new Error('Database membership sheets are unavailable');
 const year=String(schedule.getRange('A2').getValue()||'').trim(),trimester=String(schedule.getRange('B6').getValue()||'').trim();
 if(!year||!trimester)throw new Error('Database school year is unavailable');
 const yearTri=year+'_Tri'+trimester,grades=new Map();
 if(enrolled.getLastRow()>=8)enrolled.getRange(8,1,enrolled.getLastRow()-7,8).getValues().forEach(row=>{if(row[1]&&row[2])grades.set(String(row[1]),row[2]);});
 const enrolledRows=members.map(m=>{const parts=m.name.split(',');return [m.email,m.id,grades.get(m.id)||'',parts[0].trim(),parts.slice(1).join(',').trim(),m.name,'CTSO','NEST™ Robotics'];});
 roboticsDatabaseReplace_(enrolled,8,1,8,6,enrolledRows);
 roboticsDatabaseReplace_(combined,2,1,7,3,members.map(m=>[m.name,m.id,m.email,'CTSO','NEST™ Robotics',yearTri,grades.get(m.id)||'']));
 roboticsDatabaseReplace_(schedule,9,7,6,2,members.map(m=>[m.name,m.id,'CTSO','NEST™ Robotics',grades.get(m.id)||'',yearTri]),members);
 const old=Math.max(0,ctso.getLastRow()-1);if(members.length+1>ctso.getMaxRows())ctso.insertRowsAfter(ctso.getMaxRows(),members.length+1-ctso.getMaxRows());
 if(members.length){ctso.getRange(2,1,members.length,3).setValues(members.map(m=>[m.name,m.id,m.email]));ctso.getRange(2,1,members.length,1).setRichTextValues(members.map(m=>[SpreadsheetApp.newRichTextValue().setText(m.name).setLinkUrl('mailto:'+m.email).build()]));}
 if(old>members.length)ctso.getRange(members.length+2,1,old-members.length,3).clearContent();
 SpreadsheetApp.flush();return members.length;
}
