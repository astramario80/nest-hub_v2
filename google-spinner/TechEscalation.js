// Only Mr. Peñalver's verified NEST identities may select or send an outside escalation.
const TECH_OWNER_IDENTITIES=['mpenalver@bethelsd.org','mario@memberhq.net','astramario@gmail.com'];
const TECH_OWNER_EMAIL='mpenalver@bethelsd.org';
function techActorLabel_(session){return techCanEscalate_(session)?'NEST™ supervisor, Mr. Peñalver':session.username;}
function techCanEscalate_(session){return TECH_OWNER_IDENTITIES.includes(email_(session.email));}
function techRecipients_(){
 const rows=Sheets.Spreadsheets.Values.get(NEST_DATABASE,"'Notifications'!H2:J1000").values||[];
 return rows.map((row,index)=>{const email=email_(row[2]),supervisor=TECH_OWNER_IDENTITIES.includes(email),name=supervisor?'Mr. Peñalver':String(row[0]||'').trim(),position=supervisor?'NEST™ supervisor':String(row[1]||'').trim();if((!name&&!position)||! /^[^\s@,;<>]+@bethelsd\.org$/.test(email))return null;return {key:String(index+2),name,position,email,label:[name,position,email].filter(Boolean).join(' · ')};}).filter(Boolean);
}
function techSuggestedRecipient_(ticket,recipients){const software=/software request|cte-specific need/i.test(ticket.type);return recipients.find(r=>software?/\bCTE\s+TOSA\b/i.test(r.position):/^Tech Support$/i.test(r.position))?.key||'';}
function techEmailEscape_(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function techStationTable_(ticket){
 if(ticket.targets?.length)return ticket.targets.map(x=>({station:x.name,barcode:x.serial||'Not provided'}));
 const key=value=>String(value).split(';')[0].trim().replace(/^Station\s*/i,'').replace(/\s+/g,'').replace(/^0+(?=\d)/,'').toLowerCase();
 let stations=String(ticket.station||'').split(/,\s*(?=Station\b)/i);if(stations.some(s=>! /BSD Serial Number/i.test(s)&&/^\d+$/.test(key(s)))){try{const catalog=(Sheets.Spreadsheets.Values.get('1dRyHDG8UbdjaOyQVXaGWS6UoqiEJr5uOg2LUQPM_rEY',"'LaptopInventory'!E2:E1000").values||[]).map(r=>String(r[0]||''));stations=stations.map(s=>catalog.find(c=>key(c)===key(s))||s);}catch(_){/* Missing barcode is shown explicitly rather than guessed. */}}
 return stations.map(s=>{const parts=s.split(';');return {station:parts[0].trim().replace(/^Station\s*/i,'')||'Not provided',barcode:parts.slice(1).join(';').trim().replace(/^BSD Serial Number\s*/i,'')||'Not provided'};});
}
function techEscalationEmail_(ticket,recipient,note,ownerReview){
 const stationRows=techStationTable_(ticket),greeting=ownerReview?'Mr. Peñalver':recipient.name||recipient.position;
 let reporter=ticket.reporterName||ticket.reporter;try{const address=memberEmail_(ticket.reporter,ticket.period),student=rows_(ticket.period).find(r=>email_(r[1])===address);if(student)reporter=String(student[0]);}catch(_){}
 if(TECH_OWNER_IDENTITIES.includes(email_(ticket.reporter)))reporter='the NEST™ supervisor, Mr. Peñalver';
 const summary=String(ticket.title||'Tech Issue Reported').replace(/[\r\n]+/g,' ').trim();
 const text=['Hello '+greeting+'!',ownerReview?'A Software Technician has escalated this ticket for your review. No outside recipient has been contacted.':'',reporter+', from NEST™ Division '+ticket.period+', is reporting a tech issue at the following computer station(s):',...stationRows.map(s=>'Station '+s.station+' | Bethel Barcode: '+s.barcode),'The issue being reported is: '+ticket.description,note?'Additional details: '+note:'',!ownerReview&&ticket.imageFile?'A screenshot is attached.':'',ownerReview?'Review ticket: https://gknest.org/tech-management':'Please address this issue at your earliest convenience.','Sincerely,','NEST™ Software Tech Team.'].filter(Boolean).join('\n\n');
 const html='<p>Hello '+techEmailEscape_(greeting)+'!</p>'+(ownerReview?'<p>A Software Technician has escalated this ticket for your review. No outside recipient has been contacted.</p>':'')+'<p>'+techEmailEscape_(reporter)+', from NEST™ Division '+techEmailEscape_(ticket.period)+', is reporting a tech issue at the following computer station(s):</p><table border="1" style="border-collapse:collapse;margin-left:2em"><tr><th>Station Number</th><th>Bethel Barcode</th></tr>'+stationRows.map(s=>'<tr><td style="padding:4px 8px">'+techEmailEscape_(s.station)+'</td><td style="padding:4px 8px">'+techEmailEscape_(s.barcode)+'</td></tr>').join('')+'</table><p>The issue being reported is: '+techEmailEscape_(ticket.description).replace(/\n/g,'<br>')+'</p>'+(note?'<p>Additional details: '+techEmailEscape_(note).replace(/\n/g,'<br>')+'</p>':'')+(!ownerReview&&ticket.imageFile?'<p>A screenshot is attached to illustrate the issue.</p>':'')+(ownerReview?'<p><a href="https://gknest.org/tech-management">Review the ticket in NEST™</a></p>':'<p>Please address this issue at your earliest convenience.</p>')+'<p>Sincerely,<br>NEST™ Software Tech Team.</p>';
 return {to:recipient.email,recipient,subject:summary,body:text,htmlBody:html,replyTo:TECH_OWNER_EMAIL,name:'NEST™ Software Tech Team',hasScreenshot:!ownerReview&&!!ticket.imageFile};
}
function techEscalationView_(ticket,session){
 if(!techCanEscalate_(session))return {status:403};const recipients=techRecipients_();return {status:200,recipients,suggestedRecipient:techSuggestedRecipient_(ticket,recipients)};
}
function techEscalationDispatch_(r,session,access){
 const operation=r.operation,owner=techCanEscalate_(session),external=['escalation-preview','escalation-send','escalation-reconcile'].includes(operation);
 if(external?!owner:!access.canManage)return {status:403};
 if(!/^[a-f0-9-]{36}$/.test(r.id||''))return {status:400};
 if(operation==='escalation-options'){
  const entry=techState_().records.find(e=>e.ticket.id===r.id);return entry?techEscalationView_(entry.ticket,session):{status:404};
 }
 if(!/^[a-f0-9]{64}$/.test(r.version||''))return {status:400};
 const note=r.note===undefined?'':r.note;if(!techText_(note,2000,false))return {status:400};
 if(operation!=='escalation-preview'&&!/^[a-f0-9-]{36}$/.test(r.actionId||''))return {status:400};
 if(operation==='escalation-reconcile'&&!['sent','not-sent'].includes(r.resolution))return {status:400};
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};try{
 const state=techState_(),entry=state.records.find(e=>e.ticket.id===r.id);if(!entry)return {status:404};const ticket=entry.ticket;
 if(operation==='escalation-options')return techEscalationView_(ticket,session);
 const actionHash=hash_(JSON.stringify([operation,session.email,r.recipientKey||'',note,r.resolution||'',r.previewHash||'']));
 const prior=(ticket.deliveries||[]).find(d=>d.actionId===r.actionId);
 if(prior){if(prior.actionHash!==actionHash)return {status:409};return {status:200,ticket:techPublic_(ticket,true),deliveryState:prior.state};}
 if(techVersion_(ticket)!==r.version)return {status:409};
 if(ticket.history.length>=90||(ticket.deliveries||[]).length>=20)return {status:409,error:'This ticket has reached its escalation history limit.'};
 if(operation==='escalation-reconcile'){
  const unresolved=(ticket.deliveries||[]).filter(d=>['sending','uncertain'].includes(d.state)).at(-1);if(!unresolved)return {status:409};
  unresolved.state=r.resolution==='sent'?'sent':'not-sent';unresolved.reconciledBy=session.email;unresolved.reconciledAt=new Date().toISOString();
  ticket.updated=unresolved.reconciledAt;if(r.resolution==='sent'&&unresolved.kind==='external'){ticket.status='Pending';ticket.escalation={stage:'external',recipient:unresolved.recipient,time:ticket.updated};}
  ticket.history.push({time:ticket.updated,actor:techActorLabel_(session),status:ticket.status,note:'Mr. Peñalver checked sent mail and marked the escalation '+(r.resolution==='sent'?'sent.':'not sent. A new reviewed send is now allowed.'),internal:true});
  ticket.deliveries.push({actionId:r.actionId,actionHash,kind:'reconcile',state:'recorded',time:ticket.updated});techSave_(state,ticket,entry.row);return {status:200,ticket:techPublic_(ticket,true)};
 }
 if((ticket.deliveries||[]).some(d=>['sending','uncertain'].includes(d.state)))return {status:409,error:'A previous email has an uncertain delivery result. Mr. Peñalver must check sent mail and resolve it before another send.'};
 const ownerReview=operation==='escalate-owner';
 if(ownerReview&&ticket.escalation?.stage==='owner-review')return {status:409,error:'This ticket is already waiting for Mr. Peñalver’s review.'};
 let recipient={name:'Mr. Peñalver',position:'NEST™ supervisor',email:TECH_OWNER_EMAIL};if(!ownerReview){recipient=techRecipients_().find(x=>x.key===r.recipientKey);if(!recipient)return {status:400,error:'Choose a current recipient from Notifications.'};}
 const email=techEscalationEmail_(ticket,recipient,note,ownerReview),previewHash=hash_(JSON.stringify([r.version,email]));
 if(operation==='escalation-preview')return {status:200,preview:{to:email.to,name:recipient.name,position:recipient.position,subject:email.subject,body:email.body,htmlBody:email.htmlBody,hasScreenshot:email.hasScreenshot,previewHash}};
 if(!ownerReview&&r.previewHash!==previewHash)return {status:409,error:'The recipient or email changed. Review a fresh preview before sending.'};
 const mail={to:email.to,subject:email.subject,body:email.body,htmlBody:email.htmlBody,replyTo:email.replyTo,name:email.name};
 if(email.hasScreenshot){const image=techImageRead_(ticket);if(!image)return {status:503,error:'The screenshot could not be loaded. Nothing was sent. Refresh and retry.'};mail.attachments=[Utilities.newBlob(Utilities.base64Decode(image.split(',')[1]),'image/jpeg','NEST-ticket-'+ticket.id.slice(0,8)+'.jpg')];}
 // Save an intent BEFORE invoking MailApp. Uncertain retries never send a second email.
 const now=new Date().toISOString(),delivery={actionId:r.actionId,actionHash,kind:ownerReview?'owner-review':'external',recipient:{name:recipient.name,position:recipient.position,email:recipient.email},state:'sending',time:now,actor:session.email};
 ticket.deliveries=ticket.deliveries||[];ticket.deliveries.push(delivery);ticket.updated=now;if(ownerReview){ticket.status='Waiting';ticket.escalation={stage:'owner-review',recipient:delivery.recipient,time:now};ticket.history.push({time:now,actor:techActorLabel_(session),status:ticket.status,note:'Escalated to the NEST™ supervisor, Mr. Peñalver, for review.',internal:false});}techSave_(state,ticket,entry.row);
 try{
  MailApp.sendEmail(mail);delivery.state='sent';delivery.sentAt=new Date().toISOString();ticket.status=ownerReview?'Waiting':'Pending';ticket.escalation={stage:ownerReview?'owner-review':'external',recipient:delivery.recipient,time:delivery.sentAt};ticket.updated=delivery.sentAt;
  if(!ownerReview)ticket.history.push({time:delivery.sentAt,actor:techActorLabel_(session),status:ticket.status,note:ownerReview?'Escalated to Mr. Peñalver for review.':'Mr. Peñalver escalated this ticket to '+(recipient.name||recipient.position)+'.',internal:false});techSave_(state,ticket,entry.row);return {status:200,ticket:techPublic_(ticket,true),deliveryState:'sent'};
 }catch(_){delivery.state='uncertain';ticket.updated=new Date().toISOString();try{techSave_(state,ticket,entry.row);}catch(__){}return {status:200,ticket:techPublic_(ticket,true),deliveryState:'uncertain'};}
 }finally{lock.releaseLock();}
}
