// Email reads use live school rows without tracker files or tracker write locks.
function groupEmailAccess_(r){
 if(!['division','leadership'].includes(r.audience)||r.audience==='leadership'&&r.period!=='all'||r.period!=='all'&&!Object.prototype.hasOwnProperty.call(PERIODS,r.period))return {status:400};
 const targets=r.period==='all'?Object.keys(PERIODS):[r.period],included=[];
 for(const period of targets){
  const access=divisionSlidesDispatch_({operation:'access',session:r.session,period});
  if(access.status===401)return {status:401};if(![200,403].includes(access.status))return {status:503};
  if(access.status===200&&(access.isOwner===true||access.canManage===true||Array.isArray(access.roles)&&access.roles.some(role=>String(role||'').trim())))included.push(period);
 }
 if(!included.length)return {status:403};
 const directory=memberLeadershipDirectory_();if(directory.status!==200||!Array.isArray(directory.leaders))return {status:503};
 const name=leader=>[leader.firstName,leader.lastName].filter(Boolean).join(' '),members=new Map(),leaders=[];
 if(r.audience==='leadership'){
  directory.leaders.forEach(l=>{const email=districtEmail_(l.email);if(!email)return;members.set(email,{name:name(l),email});leaders.push({name:name(l),email,position:l.position,division:l.division});});
 }else included.forEach(period=>{
  const roster=rows_(period),emails=new Set();roster.forEach(row=>{const email=districtEmail_(row[1]);if(email){emails.add(email);members.set(email,{name:row[0],email});}});
  const division=period==='CTSO'?'NEST Robotics':'Period '+period;
  directory.leaders.filter(l=>l.division===division&&emails.has(districtEmail_(l.email))).forEach(l=>leaders.push({name:name(l),email:districtEmail_(l.email),position:l.position}));
 });
 return {status:200,period:r.period,audience:r.audience,divisions:included,canReachBuildingLeadership:true,members:[...members.values()],leaders};
}

// The website validates live roles/rosters before reserving. This owner-only bridge
// stores a durable attempt BEFORE Postmark is called; message content is not stored.
function groupEmailDispatch_(r){
 const now=Date.now(),store=PropertiesService.getScriptProperties();
 const session=authSession_(r.session,store,now);if(!session)return {status:401};
 if(!/^[a-f0-9]{64}$/.test(r.requestId||'')||!/^[a-f0-9]{64}$/.test(r.fingerprint||'')||!['reserve','finish'].includes(r.operation))return {status:400};
 const actor=hash_(session.email),key='groupmail:attempt:'+hash_(actor+':'+r.requestId);
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))return {status:503};
 try{
  const raw=store.getProperty(key),existing=raw?JSON.parse(raw):null;
  if(existing){
   if(existing.fingerprint!==r.fingerprint)return {status:409};
   if(r.operation==='reserve')return {status:200,duplicate:true,state:existing.state,accepted:existing.accepted||0,rejected:existing.rejected||0};
   if(existing.lease!==r.lease||!['accepted','partial','rejected','unknown'].includes(r.state)||!Number.isInteger(r.accepted)||!Number.isInteger(r.rejected)||r.accepted<0||r.rejected<0||r.accepted+r.rejected>existing.count)return {status:400};
   if(existing.state!=='pending')return {status:200};
   existing.state=r.state;existing.accepted=r.accepted;existing.rejected=r.rejected;
   store.setProperty(key,JSON.stringify(existing));return {status:200};
  }
  if(r.operation!=='reserve'||!Number.isInteger(r.count)||r.count<1||r.count>300||!Object.prototype.hasOwnProperty.call(PERIODS,r.period))return {status:400};
  const account=accountByEmail_(session.email),linked=memberEmail_(session.email,r.period);
  const replyTo=districtEmail_(linked)||(OWNER_EMAILS.includes(session.email)?session.email:'')||districtEmail_(account&&account.recoveryEmail);
  if(!replyTo)return {status:403};
  // Expire only old metadata; pending/ambiguous attempts never get replayed.
  const all=store.getProperties();Object.keys(all).filter(k=>k.indexOf('groupmail:')===0).forEach(k=>{try{if(JSON.parse(all[k]).expires<now)store.deleteProperty(k);}catch(_){}});
  const duplicateKey='groupmail:content:'+hash_(actor+':'+r.fingerprint),previous=store.getProperty(duplicateKey);
  if(previous){const duplicate=JSON.parse(previous);if(duplicate.expires>now){const attempt=store.getProperty(duplicate.key);if(attempt){const record=JSON.parse(attempt);return {status:200,duplicate:true,state:record.state,accepted:record.accepted||0,rejected:record.rejected||0};}}}
  const day=new Date(now).toISOString().slice(0,10),actorKey='groupmail:quota:'+actor+':'+day,globalKey='groupmail:quota:global:'+day;
  const quota=k=>JSON.parse(store.getProperty(k)||'{"recipients":0,"attempts":0,"last":0}');
  const user=quota(actorKey),global=quota(globalKey);
  if(user.last>now-30000||user.attempts>=20||user.recipients+r.count>500||global.attempts>=100||global.recipients+r.count>2000)return {status:429};
  [user,global].forEach(q=>{q.attempts++;q.recipients+=r.count;q.last=now;q.expires=now+172800000;});
  const lease=Utilities.getUuid(),record={state:'pending',fingerprint:r.fingerprint,lease,count:r.count,expires:now+7*86400000};
  // Reserve first; any later storage failure leaves an attempt that cannot resend.
  store.setProperty(key,JSON.stringify(record));
  store.setProperty(duplicateKey,JSON.stringify({key,expires:now+600000}));
  store.setProperty(actorKey,JSON.stringify(user));store.setProperty(globalKey,JSON.stringify(global));
  return {status:200,lease,replyTo};
 }finally{lock.releaseLock();}
}
