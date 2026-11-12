// Shared by the mailbox importer and school web app. CombinedStudentList is authoritative.
function noFlyTerm_(year,trimester){
 const schoolYear=String(year||'').trim(),tri=String(trimester||'').trim();
 if(!/^\d{4}_\d{4}$/.test(schoolYear)||!/^[123]$/.test(tri))throw Error('Active school year/trimester is unavailable');
 return schoolYear+'_Tri'+tri;
}
function noFlyRosterFromRows_(rows,term){
 const students=new Map();
 rows.forEach(row=>{
  const name=String(row[0]||'').trim(),email=String(row[2]||'').trim().toLowerCase(),period=String(row[3]||'').replace(/period\s*/ig,'').trim().toUpperCase(),prep=String(row[4]||'').trim(),trimester=String(row[5]||'').trim();
  if(trimester!==term||!name||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)||!['1','2','3','4','5','7','CTSO'].includes(period))return;
  let student=students.get(email);if(!student){student={name,email,enrollments:[]};students.set(email,student);}
  if(!student.enrollments.some(e=>e.period===period&&e.prep===prep))student.enrollments.push({period,prep,trimester});
 });
 return [...students.values()];
}
