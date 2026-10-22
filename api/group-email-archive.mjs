import {COOKIE,cookies,validToken,originAllowed,bridge,accountEmail} from '../lib/nest-auth.mjs';
import {emailIdentity} from '../lib/email-identity.mjs';
import {diagnosticOwners,withDiagnostics} from '../lib/diagnostics.mjs';
import {emailSenderKey,emailContent,postmarkRead} from '../lib/postmark-email.mjs';
const fail=(res,status)=>res.status(status).json({error:status===403?'The master email archive is available only to the NEST administrator.':status===401?'Your NEST sign-in expired.':'The email archive could not load. Please try again.'});
async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 const session=cookies(req)[COOKIE];if(!validToken(session))return fail(res,401);
 if(req.method==='POST'&&(!originAllowed(req)||!String(req.headers['content-type']||'').startsWith('application/json')))return fail(res,403);
 try{
  const identity=await emailIdentity(req,res,session);if(identity.status!==200)return fail(res,401);if(!diagnosticOwners.has(identity.email))return fail(res,403);
  if(req.method==='POST'){
   let body=req.body;if(typeof body==='string')body=JSON.parse(body);const offset=body?.offset||0;if(body?.operation!=='import'||!Number.isInteger(offset)||offset<0||offset>9500)return res.status(400).json({error:'Choose a valid import page.'});
   const access=await bridge({action:'auth-email-archive',operation:'identities',session},25000);if(access.status!==200)return fail(res,[401,403].includes(access.status)?access.status:503);
   const identities=new Map((access.identities||[]).filter(a=>accountEmail(a.email)).map(a=>[emailSenderKey(a.email),a]));
   const stream=process.env.POSTMARK_MESSAGE_STREAM||'broadcast',result=await postmarkRead('/messages/outbound',{count:'500',offset:String(offset),messagestream:stream});
   if(!Array.isArray(result.Messages)||!Number.isInteger(result.TotalCount))throw new Error('Invalid provider history');
   const groups=new Map();result.Messages.forEach((m,index)=>{if(m.Recipients?.length===1&&accountEmail(m.Recipients[0])&&!m.Recipients[0].startsWith('manual:')&&/^[a-f0-9]{64}$/.test(m.Metadata?.nestActor||'')&&validToken(m.Metadata?.nestRequestId)&&m.Tag==='nest-'+m.Metadata.nestRequestId&&!groups.has(m.Tag))groups.set(m.Tag,{message:m,start:index});});
   const all=[...groups.values()],page=all.slice(0,5),messages=await Promise.all(page.map(async({message:m})=>{
    const batch=await postmarkRead('/messages/outbound',{count:'500',offset:'0',messagestream:stream,tag:m.Tag,metadata_nestActor:m.Metadata.nestActor});
    if(!Array.isArray(batch.Messages)||batch.TotalCount!==batch.Messages.length||!batch.TotalCount||batch.TotalCount>300||batch.Messages.some(x=>x.Tag!==m.Tag||x.Metadata?.nestActor!==m.Metadata.nestActor||x.Metadata?.nestRequestId!==m.Metadata.nestRequestId||x.Recipients?.length!==1||!accountEmail(x.Recipients[0])))throw new Error('Invalid import ownership');
    const detail=await postmarkRead('/messages/outbound/'+m.MessageID+'/details');if(detail.Metadata?.nestActor!==m.Metadata.nestActor||detail.Metadata?.nestRequestId!==m.Metadata.nestRequestId||detail.MessageID!==m.MessageID)throw new Error('Invalid import detail');
    const header=String(detail.Body||'').match(/^Reply-To:\s*(?:[^\r\n<]*<)?([^\s<>\r\n]+@[^\s<>\r\n]+)/im),replyTo=accountEmail(header?.[1]);const sender=identities.get(m.Metadata.nestActor);if(!sender)throw new Error('An original sender could not be resolved');
    let html=String(detail.HtmlBody||'');const start=html.indexOf('<!-- NEST_MESSAGE_START -->'),end=html.indexOf('<!-- NEST_MESSAGE_END -->');if(start>=0&&end>start)html=html.slice(start+27,end);const content=emailContent(html);
    return {requestId:m.Metadata.nestRequestId,senderKey:m.Metadata.nestActor,sender:sender.email,username:sender.username,replyTo:replyTo||sender.email,subject:detail.Subject,sentAt:detail.ReceivedAt,testing:m.Metadata.nestTesting==='true',state:'accepted',accepted:batch.Messages.length,rejected:0,recipients:batch.Messages.map(x=>x.Recipients[0]),outcomes:batch.Messages.map(x=>({email:x.Recipients[0],messageId:x.MessageID,errorCode:0})),html:content.html,text:content.text};
   }));
   const saved=await bridge({action:'auth-email-archive',operation:'import',session,messages},45000);if(saved.status!==200)return fail(res,[401,403].includes(saved.status)?saved.status:503);
   const nextOffset=all.length>5?offset+all[5].start:offset+result.Messages.length;
   return res.status(200).json({imported:messages.length,hasMore:nextOffset<result.TotalCount,nextOffset});
  }
  if(req.query?.action==='diagnose'){
   if(!validToken(req.query.requestId)||typeof req.query.username!=='string'||!/^[a-z][a-z0-9._-]{2,31}$/.test(req.query.username))return res.status(400).json({error:'Invalid diagnostic request.'});
   const result=await bridge({action:'auth-email-archive',operation:'diagnose',session,username:req.query.username,requestId:req.query.requestId},45000);if(result.status!==200)return fail(res,[401,403,404].includes(result.status)?result.status:503);const {status,...data}=result;return res.status(200).json(data);
  }
  const operation=req.query?.action==='access'?'access':req.query?.archiveId?'detail':'list',offset=Number(req.query?.offset||0),search=String(req.query?.search||'');
  if(!Number.isInteger(offset)||offset<0||search.length>120||operation==='detail'&&!validToken(req.query.archiveId))return res.status(400).json({error:'Choose a valid archive page.'});
  const result=await bridge({action:'auth-email-archive',operation,session,archiveId:req.query?.archiveId,offset,search},45000);if(result.status!==200)return fail(res,[401,403,404].includes(result.status)?result.status:503);
  if(operation==='detail'){const content=emailContent(result.message.html||'');return res.status(200).json({message:{...result.message,html:content.html,text:content.text}});}
  const {status,...data}=result;return res.status(200).json(data);
 }catch(error){console.error('NEST permanent email archive unavailable',{kind:error.name});return fail(res,503);}
}
export default withDiagnostics('division',handler);
