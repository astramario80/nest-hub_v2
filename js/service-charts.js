(() => {
 const day=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 function build({tickets=[],rows=[],students=[],period='all',start,end,division='',role='',person='',selectedManagers=null,studentSearch='',group='division',now=Date.now()}){
  const labels=new Map(rows.map(r=>[r.manager,r])),rosterByManager=new Map(students.map(s=>[s.manager,s]));
  const metaFor=manager=>{const student=rosterByManager.get(manager);return labels.get(manager)||{...(student?rows.find(r=>r.division===student.division):null),manager:manager||'Unassigned',division:student?.division||'Unassigned'};};
  const matches=meta=>(!division||meta.division===division)&&(!role||!person||(meta[role]||'Unassigned')===person)&&(selectedManagers==null||selectedManagers.includes(meta.manager));
  const groups=new Map(),clients=new Set(),durations=[],used=new Set();let missing=0,unknownClosure=0,unknownAssignments=0;
  const filtered=tickets.filter(r=>{const meta=metaFor(r.manager||'Unassigned');if(!matches(meta))return false;const created=day(r.created);if(period!=='all'&&!created){missing++;return false;}return period==='all'||Boolean(start&&end&&created>=start&&created<=end);});
  // Include zero-ticket divisions/students so participation is visible, without inventing assignments.
  const eligibleStudents=students.filter(s=>{const meta={...metaFor(s.manager),division:s.division};if(role&&person&&role!=='manager'&&!meta[role])meta[role]=rows.find(r=>r.division===s.division)?.[role];return matches(meta);});
  eligibleStudents.forEach(s=>{const label=group==='manager'?s.manager:s.division;if(!groups.has(label))groups.set(label,{label,total:0,open:0,closed:0});});
  tickets.filter(r=>{const created=day(r.created);return period==='all'||Boolean(start&&end&&created&&created>=start&&created<=end);}).forEach(r=>{const keys=r.participantKeys||students.filter(s=>s.manager===r.manager).map(s=>s.key);keys.forEach(key=>used.add(key));});
  filtered.forEach(r=>{
   const meta=metaFor(r.manager||'Unassigned'),label=group==='manager'?meta.manager:meta.division;if(!groups.has(label))groups.set(label,{label,total:0,open:0,closed:0});const g=groups.get(label);g.total++;r.status==='Closed'?g.closed++:g.open++;if(r.email)clients.add(r.email);
   const created=Date.parse(r.created),finish=r.status==='Closed'?Date.parse(r.closedAt):now;
   if(r.status==='Closed'&&!Number.isFinite(finish))unknownClosure++;
   if(Number.isFinite(created)&&Number.isFinite(finish)&&finish>=created&&created<=now)durations.push((Math.min(finish,now)-created)/86400000);
   const keys=r.participantKeys||students.filter(s=>s.manager===r.manager).map(s=>s.key);if(!keys.length)unknownAssignments++;
  });
  const search=studentSearch.trim().toLowerCase(),visible=eligibleStudents.filter(s=>s.name.toLowerCase().includes(search)).sort((a,b)=>a.name.localeCompare(b.name)||a.division.localeCompare(b.division));
  const closed=filtered.filter(r=>r.status==='Closed').length;
  return {period,start,end,group,division,role,person,selectedManagers:selectedManagers==null?null:[...selectedManagers],studentSearch,ranking:[...groups.values()].sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label)),taken:visible.filter(s=>used.has(s.key)),waiting:visible.filter(s=>!used.has(s.key)),total:filtered.length,open:filtered.length-closed,closed,clients:clients.size,average:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length*10)/10:null,measured:durations.length,missing,unknownClosure,unknownAssignments,generated:new Date(now).toISOString()};
 }
 function svg(model,scope='ranking'){
  const rank=scope!=='participation',participation=scope!=='ranking',w=1600,rankHeight=rank?240+Math.max(1,model.ranking.length)*44:0,studentHeight=participation?130+Math.max(1,model.taken.length,model.waiting.length)*38:0,h=Math.max(900,160+rankHeight+studentHeight+90);
  const text=(x,y,value,size=24,weight=400)=>'<text x="'+x+'" y="'+y+'" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="'+weight+'" fill="#273d34">'+escape(value)+'</text>';
  const wrap=(value,max=55)=>{const words=String(value).split(/\s+/),lines=[];let line='';words.forEach(word=>{if((line+' '+word).trim().length>max&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();});if(line)lines.push(line);return lines;};
  let content='<rect width="100%" height="100%" fill="#faf9f4"/><rect width="1600" height="14" fill="#d1ac68"/>'+text(70,72,'NEST™ · Service barometer',38,700)+text(70,114,model.period==='all'?'All time':model.start+' through '+model.end,24);
  const filters=[model.division,model.person,...(model.selectedManagers||[]),model.studentSearch&&'Student: '+model.studentSearch].filter(Boolean);if(filters.length)content+=text(70,147,'Filters: '+filters.join(' · ').slice(0,120),19);
  let y=185;
  if(rank){
   const stats=[['Requests',model.total],['Average days open',model.average??'—'],['Open',model.open],['Closed',model.closed]];
   stats.forEach(([label,value],i)=>{const x=70+i*380;content+='<rect x="'+x+'" y="'+y+'" width="350" height="110" rx="14" fill="#e9eee5"/>'+text(x+22,y+48,value,42,700)+text(x+22,y+86,label,21);});y+=150;
   content+=text(70,y,'Tickets by '+(model.group==='manager'?'project manager':'division'),28,700);y+=48;
   const max=Math.max(1,...model.ranking.map(r=>r.total));
   if(!model.ranking.length){content+=text(70,y,'No matching requests.');y+=44;}
   model.ranking.forEach(r=>{const x=560,width=900*r.total/max,closed=r.total?width*r.closed/r.total:0;content+=text(70,y+22,r.label.slice(0,40),22)+'<rect x="'+x+'" y="'+y+'" width="900" height="28" rx="5" fill="#e5e6df"/><rect x="'+x+'" y="'+y+'" width="'+width+'" height="28" rx="5" fill="#d1ac68"/><rect x="'+x+'" y="'+y+'" width="'+closed+'" height="28" rx="5" fill="#416553"/>'+text(1480,y+23,r.total,23,700);y+=44;});content+=text(560,y+15,'Green: closed · Gold: open',19);y+=55;
  }
  if(participation){content+=text(70,y,'Student participation · current roster',28,700);y+=46;content+=text(70,y,'Have taken a ticket ('+model.taken.length+')',24,700)+text(840,y,'Yet to take a ticket ('+model.waiting.length+')',24,700);y+=35;
   const n=Math.max(1,model.taken.length,model.waiting.length);for(let i=0;i<n;i++){if(i%2===0)content+='<rect x="60" y="'+(y-24)+'" width="1480" height="38" fill="#edf0e8"/>';for(const [x,list] of [[70,model.taken],[840,model.waiting]]){const s=list[i];if(s)content+=text(x,y,s.name+' · '+s.division,21);else if(i===0&&!list.length)content+=text(x,y,'No students match.',21);}y+=38;}y+=20;
  }
  const footnotes=['Participation uses recorded assignments on requests submitted in the selected period.','Average includes '+model.measured+' dated tickets; '+model.unknownClosure+' closed tickets lack a closure date.'];if(model.unknownAssignments)footnotes.push(model.unknownAssignments+' requests have no matching current-roster assignment.');
  footnotes.forEach(line=>{content+=text(70,y,line,18);y+=25;});
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+Math.max(h,y+40)+'" viewBox="0 0 '+w+' '+Math.max(h,y+40)+'" role="img" aria-label="NEST Service barometer">'+content+'</svg>';
 }
 window.NestServiceCharts={build,svg};
})();
