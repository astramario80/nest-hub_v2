import imported from './bell-schedule-import.json' with { type: 'json' };
function clock(value){let [h,m]=value.split(':').map(Number);if(h<6)h+=12;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
function block(label,time,id){
 const clean=String(time).replace(/[–—−]/g,'-').replace(/\s/g,'');if(!/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(clean))return null;
 const [start,end]=clean.split('-').map(clock),m=label.match(/^(\d)(?:st|nd|rd|th)?\s*(?:period|hour)/i),period=m?.[1]||(/advisory/i.test(label)?'7':'');
 const kind=/lunch/i.test(label)?'lunch':/halls/i.test(label)?'halls':/dismissal/i.test(label)?'dismissal':/assembly/i.test(label)?'assembly':/support/i.test(label)?'support':/advisory/i.test(label)?'advisory':'class';
 return {id,label,kind,period:kind==='lunch'?'':period,start,end};
}
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function initialWorkspace(){
 const headers=imported.templates[0];
 const templates=imported.templates.slice(1).filter(r=>r[0]).map((r,i)=>{
  const blocks=r.slice(3,14).map((v,j)=>v?block(headers[j+3],v,'block-'+j):null).filter(Boolean);
  const lunchRows=imported.lunches.filter(l=>l[0]===r[0]),lunches=[];
  for(const name of [...new Set(lunchRows.map(l=>l[1]))]){const rows=lunchRows.filter(l=>l[1]===name),valid=rows.map((l,k)=>block(l[2],l[3],'lunch-'+k)).filter(Boolean);if(valid.length)lunches.push({id:String(name[0]),name,blocks:valid});}
  return {id:slug(r[0]),name:r[0],color:r[1],noSchool:r[0]==='No School',lunchPeriod:r[2]?.match(/^(\d)/)?.[1]||'',notes:'Imported from Bell Schedules on November 6, 2026. Review special schedules and source discrepancies before use.',blocks,lunches,groups:[]};
 });
 const veteran=templates.find(t=>t.id==='assembly-veterans-day');
 // The source PDF explicitly defines parallel A/B sequences; the spreadsheet does not.
 veteran.blocks=veteran.blocks.filter(b=>b.period!=='5'&&b.kind!=='assembly');
 veteran.blocks.find(b=>b.period==='2').start='08:49';
 const make=(id,label,kind,period,start,end)=>({id,label,kind,period,start,end});
 veteran.groups=[
  {id:'assembly-a',name:'Assembly A',replacePeriods:['5'],blocks:[make('attendance','Attendance & pass to gym','attendance','5','12:32','12:40'),make('assembly','Veterans’ Day · Assembly A','assembly','','12:40','13:10'),make('passing','Pass to fifth period','passing','','13:10','13:15'),make('period-5','5th Period','class','5','13:15','14:15')]},
  {id:'assembly-b',name:'Assembly B',replacePeriods:['5'],blocks:[make('period-5','5th Period','class','5','12:32','13:37'),make('passing','Pass to gym','passing','','13:37','13:45'),make('assembly','Veterans’ Day · Assembly B','assembly','','13:45','14:15')]}
 ];
 veteran.lunches=[{id:'1',name:'1st Lunch',blocks:[make('lunch','1st Lunch','lunch','','09:48','10:18'),make('period-3','3rd Period','class','3','10:23','11:23')]},{id:'2',name:'2nd Lunch',blocks:[make('period-3a','3rd Period','class','3','09:53','10:21'),make('lunch','2nd Lunch','lunch','','10:21','10:51'),make('period-3b','3rd Period','class','3','10:56','11:23')]},{id:'3',name:'3rd Lunch',blocks:[make('period-3','3rd Period','class','3','09:53','10:53'),make('lunch','3rd Lunch','lunch','','10:53','11:23')]}];
 veteran.notes='Draft rebuilt from VeteransDayAssembliesSch20261106.pdf (dated October 28). Penalver is listed in Assembly A. Second-period and lunch times follow the PDF; they differ from the spreadsheet. Review before connecting live outputs.';
 const days=imported.current.slice(1).filter(r=>r[0]&&r[1]).map(r=>{const [m,d,y]=r[0].split('/');return {date:`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,templateId:slug(r[1]),notes:'Imported calendar assignment',flyDay:false,absent:false,assignments:[]};});
 days.find(d=>d.date==='2026-11-06').assignments=[{teacherId:'penalver',groupId:'assembly-a',lunchId:'1'}];
 return {templates,days,teachers:[{id:'penalver',name:'Mario Penalver',lunchId:'1',preps:[{period:'1',name:'DESIGN & MODELING',enrolled:true},{period:'2',name:'ENGINEERING ESSENTIALS',enrolled:true},{period:'3',name:'PLANNING',enrolled:false},{period:'4',name:'DRONE PILOTING',enrolled:true},{period:'5',name:'DESIGN & MODELING',enrolled:true}]}]};
}
