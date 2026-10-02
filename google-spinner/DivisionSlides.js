// Website identities and live division roles are checked before reaching the
// existing Control Center's owner-run slide routine. No browser receives a token.
const DIVISION_SLIDES_WEBAPP = 'https://script.google.com/macros/s/AKfycbwRXV7QLRzmTqBJJcJs8WdQ3Gy0kwbCwgQBqW_t5ujSkSGOwb9wGF8MCpvEvNNkR0oA/exec';
function divisionSlidesPermissions_(identity,period,leaders){
 if(OWNER_EMAILS.includes(email_(identity)))return true;
 const email=memberEmail_(identity,period);
 const rows=leaders||((typeof nestAccessValues_==='function'?nestAccessValues_:Sheets.Spreadsheets.Values.get)(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[]);
 return rows.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===period&&email_(row[4])===email&&
  (period==='CTSO'?/^(chief executive officer|executive vice-president)$/i:/^(division manager|assistant manager)$/i).test(String(row[2]||'').trim()));
}
function divisionSlidesDispatch_(r){
 if(!Object.prototype.hasOwnProperty.call(PERIODS,r.period)||!['access','start','status'].includes(r.operation))return {status:400};
 const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
 if(!session)return {status:401};
 const email=memberEmail_(session.email,r.period),isOwner=OWNER_EMAILS.includes(email_(session.email));
 const roster=rows_(r.period),members=new Set(roster.map(row=>email_(row[1])));
 if(!isOwner&&!members.has(email))return {status:403};
 const leaders=(typeof nestAccessValues_==='function'?nestAccessValues_:Sheets.Spreadsheets.Values.get)(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
 const canManage=divisionSlidesPermissions_(session.email,r.period,leaders);
 if(r.operation==='access'){
  const roles=leaders.filter(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===r.period&&email_(row[4])===email).map(row=>String(row[2]||'').trim());
  const team=leaders.filter(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()===r.period&&members.has(email_(row[4]))).map(row=>{
   const name=String(row[3]||'').trim(),comma=name.indexOf(',');
   return {position:String(row[2]||'').trim(),name:comma>=0?name.slice(comma+1).trim()+' '+name.slice(0,comma).trim():name};
  }).filter(leader=>leader.position&&leader.name);
  return {status:200,canManage,roles,isOwner,team,identity:{signedIn:true,email:session.email,username:session.username,expires:session.expires}};
 }
 if(!canManage)return {status:403};
 if(!/^[a-f0-9-]{36}$/.test(r.job||''))return {status:400};
 if(!DIVISION_SLIDES_WEBAPP)return {status:503};
 let response=UrlFetchApp.fetch(DIVISION_SLIDES_WEBAPP,{method:'post',contentType:'application/json',payload:JSON.stringify({token:r.token,operation:r.operation,period:r.period,job:r.job,email:memberEmail_(session.email,r.period)}),muteHttpExceptions:true,followRedirects:false});
 if([301,302,303].includes(response.getResponseCode())){
  const headers=response.getAllHeaders(),target=String(headers.Location||headers.location||'');
  if(!/^https:\/\/script\.googleusercontent\.com\//.test(target))return {status:503};
  for(let attempt=0;attempt<3;attempt++){
   response=UrlFetchApp.fetch(target,{muteHttpExceptions:true,followRedirects:false});
   if(response.getResponseCode()===200)break;
   if(![404,429,500,502,503,504].includes(response.getResponseCode()))return {status:503};
   Utilities.sleep(500);
  }
 }
 if(response.getResponseCode()!==200)return {status:503};
 return JSON.parse(response.getContentText());
}

function hiringQueueSlideAccess_(r){
 try{
  let response=UrlFetchApp.fetch(DIVISION_SLIDES_WEBAPP,{method:'post',contentType:'application/json',payload:JSON.stringify({token:r.token,operation:'sync-access',period:r.period}),muteHttpExceptions:true,followRedirects:false});
  if([301,302,303].includes(response.getResponseCode())){
   const headers=response.getAllHeaders(),target=String(headers.Location||headers.location||'');
   if(!/^https:\/\/script\.googleusercontent\.com\//.test(target))return false;
   response=UrlFetchApp.fetch(target,{muteHttpExceptions:true,followRedirects:false});
  }
  return response.getResponseCode()===200&&JSON.parse(response.getContentText()).status===200;
 }catch(error){console.error('Hiring slide access queue unavailable');return false;}
}
