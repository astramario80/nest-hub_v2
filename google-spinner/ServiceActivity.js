// Chart-safe recency signals only: never include log text, file URLs or client contacts.
function serviceActivity_(item,events){
 const work=[],communication=[],latest=values=>values.filter(v=>Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||'';
 for(const entry of serviceLogEntries_(item,events)){
  if(entry.internalNote&&!entry.internalDeleted)work.push(entry.internalUpdatedAt||entry.time);
  if(entry.publicNote&&!entry.publicDeleted){const at=entry.publicUpdatedAt||entry.time;work.push(at);communication.push(at);}
 }
 for(const e of events){if(e[1]!==item.id)continue;
  if(['details','attachments'].includes(e[2])||e[2]==='shopping'&&!/^(Started |Changing |Item action declined)/.test(String(e[5])))work.push(e[0]);
  if(e[2]==='email'&&e[7]==='sent')communication.push(e[0]);
 }
 return {workAt:latest(work),communicationAt:latest(communication)};
}
