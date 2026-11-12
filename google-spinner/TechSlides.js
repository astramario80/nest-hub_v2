// Only aggregate room-health data reaches division presentations.
const TECH_SLIDE_KINDS=['open','aging','types','stations','status','indicators'];
function techOverviewTables_(tickets){
 const years={};for(const t of tickets){const year=years[t.year]||(years[t.year]={stations:[],statuses:[]}),closed=['Resolved','Closed'].includes(t.status);const add=(rows,label)=>{let row=rows.find(r=>r.label===label);if(!row){row={label,total:0,open:0,closed:0};rows.push(row);}row.total++;row[closed?'closed':'open']++;};add(year.statuses,t.status);const targets=t.targets?.length?t.targets.map(x=>x.name):[String(t.station||'Unspecified').split(';')[0].trim()];[...new Set(targets)].forEach(label=>add(year.stations,label));}Object.values(years).forEach(y=>{y.stations.sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label));y.statuses.sort((a,b)=>TECH_STATUSES.indexOf(a.label)-TECH_STATUSES.indexOf(b.label));});return years;
}
function techSlideModel_(r,access){
 if(!access.slideExportPeriods?.includes(r.period))return {status:403};if(!TECH_SLIDE_KINDS.includes(r.kind)||!/^\d{4}–\d{4}$/.test(r.year||''))return {status:400};
 const tickets=techState_().records.map(x=>x.ticket).filter(t=>t.year===r.year),health=techHealth_(tickets,Date.now()).byYear[r.year]||{total:0,open:0,agedOpen:0,unassigned:0,stationsAffected:0,oldestOpenDays:0,types:[]},tables=techOverviewTables_(tickets)[r.year]||{stations:[],statuses:[]};
 const titles={open:'Open tickets',aging:'Open tickets aged 7+ days',types:'Tickets by issue type',stations:'Tickets by station / machine',status:'Tickets by status',indicators:'Room tech indicators'};
 const source=r.kind==='types'?health.types.map(x=>({label:x.type,total:x.total,open:x.open,closed:x.closed})):r.kind==='stations'?tables.stations:r.kind==='status'?tables.statuses:[];
 const rows=source.slice(0,12);if(source.length>12)rows.push(source.slice(12).reduce((a,r)=>({label:'Other stations / machines',total:a.total+r.total,open:a.open+r.open,closed:a.closed+r.closed}),{total:0,open:0,closed:0}));
 const model={kind:r.kind,title:titles[r.kind],year:r.year,total:health.total,open:health.open,agedOpen:health.agedOpen,unassigned:health.unassigned,stationsAffected:health.stationsAffected,oldestOpenDays:health.oldestOpenDays,rows};
 return {status:200,model,version:hash_(JSON.stringify(model)),asOf:new Date().toISOString()};
}
function techSlideDispatch_(r,session,access){
 const snapshot=techSlideModel_(r,access);if(snapshot.status!==200||r.operation==='slide-snapshot')return snapshot;
 if(!/^[a-f0-9-]{36}$/.test(r.id||'')||r.snapshotVersion!==snapshot.version)return {status:409,error:'The overview changed. Export again to use the latest data.'};
 if(typeof r.image!=='string'||r.image.length>900000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(r.image))return {status:400};
 const response=UrlFetchApp.fetch(DIVISION_SLIDES_WEBAPP,{method:'post',contentType:'application/json',payload:JSON.stringify({token:r.token,operation:'tech-graphic-export',id:r.id,period:r.period,kind:r.kind,year:r.year,email:memberEmail_(session.email,access.slideExportPeriods?.length===HIRING_PERIODS.length?'CTSO':r.period),image:r.image}),muteHttpExceptions:true,followRedirects:false});
 let result=response;if([301,302,303].includes(response.getResponseCode())){const headers=response.getAllHeaders(),target=String(headers.Location||headers.location||'');if(!/^https:\/\/script\.googleusercontent\.com\//.test(target))return {status:503};for(let attempt=0;attempt<2;attempt++){result=UrlFetchApp.fetch(target,{muteHttpExceptions:true,followRedirects:false});if(result.getResponseCode()===200)break;}}
 return result.getResponseCode()===200?JSON.parse(result.getContentText()):{status:503};
}
