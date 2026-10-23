import {COOKIE,cookies,validToken,accountEmail} from '../lib/nest-auth.mjs';
import {emailIdentity} from '../lib/email-identity.mjs';
import {withDiagnostics} from '../lib/diagnostics.mjs';
import {emailSenderKey,emailContent,postmarkRead} from '../lib/postmark-email.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
function ownMessages(data,actor,requestId){
 if(!Array.isArray(data.Messages)||!Number.isInteger(data.TotalCount))throw new Error('Invalid history');
 for(const m of data.Messages){
  if(m.Metadata?.nestActor!==actor||!validToken(m.Metadata?.nestRequestId)||m.Tag!=='nest-'+m.Metadata.nestRequestId||requestId&&m.Metadata.nestRequestId!==requestId||!uuid(m.MessageID)||typeof m.Subject!=='string'||!Array.isArray(m.Recipients)||m.Recipients.length!==1||!accountEmail(m.Recipients[0])||!Number.isFinite(Date.parse(m.ReceivedAt)))throw new Error('Invalid message ownership');
 }
 return data.Messages;
}
async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
 const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to see your sent email.'});
 const requestId=req.query?.requestId,offset=Number(req.query?.offset||0);
 if(requestId!==undefined&&!validToken(requestId)||!Number.isInteger(offset)||offset<0||offset>9500)return res.status(400).json({error:'Choose a valid history page.'});
 if(!process.env.POSTMARK_SERVER_TOKEN)return res.status(503).json({error:'Email history is not configured.'});
 try{
  const identity=await emailIdentity(req,res,session);if(identity.status!==200||!accountEmail(identity.email))return res.status(401).json({error:'Your NEST sign-in expired.'});
  const actor=emailSenderKey(identity.email),stream=process.env.POSTMARK_MESSAGE_STREAM||'broadcast';
  const query={count:'500',offset:String(requestId?0:offset),messagestream:stream,metadata_nestActor:actor,...(requestId?{tag:'nest-'+requestId}:{})};
  const result=await postmarkRead('/messages/outbound',query),messages=ownMessages(result,actor,requestId);
  if(requestId){
   if(!messages.length)return res.status(404).json({error:'This message is not available in your history.'});
   if(result.TotalCount>300||result.TotalCount!==messages.length)throw new Error('Incomplete message history');
   if(req.query?.action==='status'){
    const selected=Number(messages[0].Metadata.nestSelectedCount);
    if(!Number.isInteger(selected)||selected<messages.length||selected>300||messages.some(m=>Number(m.Metadata.nestSelectedCount)!==selected))throw new Error('Invalid send count');
    return res.status(200).json({requestId,state:messages.length===selected?'accepted':'partial',accepted:messages.length,rejected:0,unconfirmed:selected-messages.length,selected,testing:messages[0].Metadata.nestTesting==='true'});
   }
   const [detail,activity]=await Promise.all([postmarkRead('/messages/outbound/'+messages[0].MessageID+'/details'),postmarkRead('/messages/outbound/opens',{count:'500',offset:'0',tag:'nest-'+requestId,messagestream:stream})]);
   if(detail.Metadata?.nestActor!==actor||detail.Metadata?.nestRequestId!==requestId||detail.MessageID!==messages[0].MessageID||!Array.isArray(activity.Opens)||!Number.isInteger(activity.TotalCount)||activity.TotalCount<0||activity.TotalCount>500)throw new Error('Invalid activity ownership');
   const recipients=messages.map(m=>({email:m.Recipients[0],messageId:m.MessageID,openedAt:null})),byId=new Map(recipients.map(r=>[r.messageId,r]));
   for(const open of activity.Opens){const recipient=byId.get(open.MessageID);if(recipient&&open.Recipient===recipient.email&&Number.isFinite(Date.parse(open.ReceivedAt))&&(!recipient.openedAt||Date.parse(open.ReceivedAt)<Date.parse(recipient.openedAt)))recipient.openedAt=open.ReceivedAt;}
   const observedOpens=recipients.filter(r=>r.openedAt).length;
   let html=String(detail.HtmlBody||'');const start=html.indexOf('<!-- NEST_MESSAGE_START -->'),end=html.indexOf('<!-- NEST_MESSAGE_END -->');
   if(start>=0&&end>start)html=html.slice(start+27,end);
   const content=emailContent(html);
   return res.status(200).json({requestId,subject:detail.Subject,sentAt:detail.ReceivedAt,testing:detail.Metadata.nestTesting==='true',tracking:detail.TrackOpens===true,accepted:recipients.length,selected:Number(detail.Metadata.nestSelectedCount)||recipients.length,observedOpens,openRate:Math.round(observedOpens/recipients.length*1000)/10,recipients:recipients.map(({email,openedAt})=>({email,openedAt})),html:content.html,text:content.text});
  }
  const groups=new Map();messages.forEach((m,index)=>{const id=m.Metadata.nestRequestId;if(!groups.has(id))groups.set(id,{requestId:id,subject:m.Subject,sentAt:m.ReceivedAt,testing:m.Metadata.nestTesting==='true',selected:Number(m.Metadata.nestSelectedCount)||1,start:index,loaded:0});groups.get(id).loaded++;});
  let list=[...groups.values()],nextOffset=offset+messages.length;
  if(list.length>20){nextOffset=offset+list[20].start;list=list.slice(0,20);}
  else if(messages.length===500&&list.length>1&&list.at(-1).loaded<list.at(-1).selected){nextOffset=offset+list.at(-1).start;list.pop();}
  return res.status(200).json({messages:list.map(({start,loaded,...m})=>m),hasMore:nextOffset<result.TotalCount,nextOffset,retentionDays:45});
 }catch(error){console.error('NEST email history unavailable',{kind:error.name});return res.status(503).json({error:'Your email history could not load. Please try again.'});}
}
export default withDiagnostics('division',handler);
