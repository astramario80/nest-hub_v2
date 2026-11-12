(() => {
 const day=value=>Number.isFinite(typeof value==='number'?value:Date.parse(value))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const activityScale='5 today · 4 within 2 days · 3 within 7 days · 2 within 14 days · 1 within 30 days · 0 older / no activity';
 function activityScore(value,now=Date.now()){
  const date=day(value),today=day(now);if(!date||!today||Date.parse(value)>now)return 0;
  const age=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(date+'T12:00:00Z'))/86400000);
  return age===0?5:age<=2?4:age<=7?3:age<=14?2:age<=30?1:0;
 }
 function rating(value,empty=false){return empty?{label:'No tickets',color:'#66736b'}:value<2?{label:'Poor',color:'#b42318'}:value<4?{label:'OK',color:'#a65b00'}:{label:'Excellent',color:'#16623b'};}
 function gauge(value,title,subtitle='Average across matching open tickets',options={}){
  const score=Math.max(0,Math.min(5,value)),state=rating(score,options.empty),cx=240,cy=205,r=155,angle=Math.PI+score/5*Math.PI,x=cx+Math.cos(angle)*r*.78,y=cy+Math.sin(angle)*r*.78,display=options.empty?'—':options.percent?(score*20).toFixed(1)+'%':score.toFixed(1)+' / 5';
  const arc=(from,to,color)=>{const a=Math.PI+from/5*Math.PI,b=Math.PI+to/5*Math.PI;return '<path d="M'+(cx+Math.cos(a)*r)+' '+(cy+Math.sin(a)*r)+' A155 155 0 0 1 '+(cx+Math.cos(b)*r)+' '+(cy+Math.sin(b)*r)+'" fill="none" stroke="'+color+'" stroke-width="26"/>';};
  let ticks='';for(let i=0;i<=5;i++){const a=Math.PI+i/5*Math.PI;ticks+='<text x="'+(cx+Math.cos(a)*190)+'" y="'+(cy+Math.sin(a)*190+7)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="'+(i<2?'#b42318':i<4?'#a65b00':'#16623b')+'">'+(options.percent?i*20:i)+'</text>';}
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 345" role="img" aria-label="'+escape(title+': '+display+'. '+state.label+'. '+subtitle)+'"><rect width="480" height="345" rx="18" fill="#faf9f4"/>'+arc(0,2,'#d55c55')+arc(2,4,'#e8b254')+arc(4,5,'#4f916a')+ticks+'<path class="service-gauge-needle" d="M240 205 L'+x+' '+y+'" stroke="'+state.color+'" stroke-width="6" stroke-linecap="round"/><circle cx="240" cy="205" r="10" fill="'+state.color+'"/><text x="240" y="246" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="'+state.color+'">'+display+'</text><text x="240" y="276" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="'+state.color+'">'+state.label+'</text><text x="240" y="306" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" font-weight="700" fill="#273d34">'+escape(title)+'</text><text x="240" y="332" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#273d34">'+escape(subtitle)+'</text></svg>';
 }
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
   const meta=metaFor(r.manager||'Unassigned'),label=group==='manager'?meta.manager:meta.division;if(!groups.has(label))groups.set(label,{label,total:0,open:0,closed:0});const g=groups.get(label);g.total++;r.status==='Closed'?g.closed++:g.open++;if(r.clientKey||r.email)clients.add(r.clientKey||r.email);
   const created=Date.parse(r.created),finish=r.status==='Closed'?Date.parse(r.closedAt):now;
   if(r.status==='Closed'&&!Number.isFinite(finish))unknownClosure++;
   if(Number.isFinite(created)&&Number.isFinite(finish)&&finish>=created&&created<=now)durations.push((Math.min(finish,now)-created)/86400000);
   const keys=r.participantKeys||students.filter(s=>s.manager===r.manager).map(s=>s.key);if(!keys.length)unknownAssignments++;
  });
  const search=studentSearch.trim().toLowerCase(),visible=eligibleStudents.filter(s=>s.name.toLowerCase().includes(search)).sort((a,b)=>a.name.localeCompare(b.name)||a.division.localeCompare(b.division));
  const activityTickets=filtered.filter(r=>!['Closed','Completed'].includes(r.status)).map(r=>({id:r.id,manager:r.manager||'Unassigned',workAt:r.activity?.workAt||'',communicationAt:r.activity?.communicationAt||'',work:activityScore(r.activity?.workAt,now),communication:activityScore(r.activity?.communicationAt,now)}));
  const mean=key=>activityTickets.length?Math.round(activityTickets.reduce((sum,r)=>sum+r[key],0)/activityTickets.length*10)/10:0;
  const activity={work:mean('work'),communication:mean('communication'),tickets:activityTickets,scale:activityScale};
  const closed=filtered.filter(r=>r.status==='Closed').length;
  return {closureRate:filtered.length?closed/filtered.length*100:null,activity,period,start,end,group,division,role,person,selectedManagers:selectedManagers==null?null:[...selectedManagers],studentSearch,ranking:[...groups.values()].sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label)),taken:visible.filter(s=>used.has(s.key)),waiting:visible.filter(s=>!used.has(s.key)),total:filtered.length,open:filtered.length-closed,closed,clients:clients.size,average:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length*10)/10:null,measured:durations.length,missing,unknownClosure,unknownAssignments,generated:new Date(now).toISOString()};
 }
 function svg(model,scope='ranking'){
  const rank=['ranking','all'].includes(scope),participation=['participation','all'].includes(scope),activity=['activity','work','communication','closure','all'].includes(scope),w=1600,rankHeight=rank?240+Math.max(1,model.ranking.length)*44:0,studentHeight=participation?130+Math.max(1,model.taken.length,model.waiting.length)*38:0,h=Math.max(900,160+rankHeight+studentHeight+90);
  const text=(x,y,value,size=24,weight=400)=>'<text x="'+x+'" y="'+y+'" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="'+weight+'" fill="#273d34">'+escape(value)+'</text>';
  const wrap=(value,max=55)=>{const words=String(value).split(/\s+/),lines=[];let line='';words.forEach(word=>{if((line+' '+word).trim().length>max&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();});if(line)lines.push(line);return lines;};
  let content='<rect width="100%" height="100%" fill="#faf9f4"/><rect width="1600" height="14" fill="#d1ac68"/>'+(window.NestServiceExport?.logo?'<image href="'+window.NestServiceExport.logo+'" x="70" y="26" width="90" height="100"/>':'')+text(185,72,'NEST™ · Service barometer',38,700)+text(185,114,model.period==='all'?'All time':model.start+' through '+model.end,24);
  const filters=[model.division,model.person,...(model.selectedManagers||[]),model.studentSearch&&'Student: '+model.studentSearch].filter(Boolean);if(filters.length)content+=text(70,147,'Filters: '+filters.join(' · ').slice(0,120),19);
  let y=185;
  if(activity){const a=model.activity||{work:0,communication:0,tickets:[]},both=['activity','all'].includes(scope),keys=both?['work','communication','closure']:[scope];for(const [i,key] of keys.entries()){const title=key==='work'?'Ticket activity':key==='communication'?'Client communication':'Tickets closed',x=both?50+i*510:420,width=both?480:700,height=width*345/480,value=key==='closure'?(model.closureRate||0)/20:a[key],subtitle=key==='closure'?model.closed+' closed / '+model.total+' created':a.tickets.length+' matching open tickets';content+='<svg x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" viewBox="0 0 480 345">'+gauge(value,title,subtitle,{percent:key==='closure',empty:key==='closure'?model.closureRate===null:!a.tickets.length}).replace(/^<svg[^>]*>|<\/svg>$/g,'')+'</svg>';}y+=both?380:535;content+=text(70,y,'As of '+day(model.generated)+' (Pacific time). Activity: below 2 Poor · 2–below 4 OK · 4–5 Excellent.',20);y+=32;content+=text(70,y,'Closure = Closed / all matching tickets created. Bands: below 40% Poor · 40–below 80% OK · 80–100% Excellent.',20);y+=45;}
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
 window.NestServiceCharts={build,svg,gauge,rating,activityScore,activityScale};
})();
