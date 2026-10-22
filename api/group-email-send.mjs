import { createHash } from 'node:crypto';
import { COOKIE,cookies,validToken,originAllowed,bridge,districtEmail,accountEmail } from '../lib/nest-auth.mjs';
import { DIVISIONS } from '../lib/divisions.mjs';
import { withDiagnostics } from '../lib/diagnostics.mjs';
import { groupRecords } from '../lib/group-email-access.mjs';
import { emailContent,emailSenderKey,postmarkMessages,submitPostmark,MAX_EMAIL_RECIPIENTS } from '../lib/postmark-email.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'});}
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to send email.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
  let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid request.'});}
  if(!body||Array.isArray(body)||JSON.stringify(body).length>100000||!validToken(body.requestId)||typeof body.subject!=='string'||!body.subject.trim()||body.subject.length>180||/[\r\n\x00-\x1f]/.test(body.subject)||typeof body.html!=='string'||body.html.length>60000||!['division','leadership'].includes(body.audience)||body.audience==='leadership'&&body.period!=='all'||body.period!=='all'&&!Object.hasOwn(DIVISIONS,body.period)||typeof body.testing!=='boolean'||!Array.isArray(body.recipients)||body.recipients.length>MAX_EMAIL_RECIPIENTS||body.recipients.some(email=>typeof email!=='string'||districtEmail(email)!==email))return res.status(400).json({error:'Check the subject, message and selected recipients (maximum 300).'});
  if(!process.env.POSTMARK_SERVER_TOKEN||!/^[a-z0-9._+-]+@gknest\.org$/i.test(process.env.POSTMARK_FROM_EMAIL||'')||process.env.NEST_EMAIL_ENABLED!=='true')return res.status(503).json({error:'NEST email setup is not complete. Your draft is still here.'});
  const content=emailContent(body.html);if(!content.text)return res.status(400).json({error:'Add a message before sending.'});
  let reserved=false;
  try{
    const [fresh,sender]=await Promise.all([groupRecords(session,body.period,body.audience),bridge({action:'auth-me',session},20000)]);
    if(sender.status!==200||!accountEmail(sender.email))return res.status(sender.status===401?401:503).json({error:'Your sending identity could not be verified.'});
    const allowed=new Set(fresh.members.map(m=>m.email));
    const recipients=[...new Set(body.recipients)].sort();
    if(!body.testing&&(!recipients.length||recipients.some(email=>!allowed.has(email))))return res.status(403).json({error:'The group changed. Choose the recipients again.'});
    const fingerprint=sha(JSON.stringify({period:body.period,audience:body.audience,recipients:body.testing?[]:recipients,subject:body.subject.trim(),html:content.html,testing:body.testing}));
    const reservation=await bridge({action:'auth-group-email',operation:'reserve',session,requestId:body.requestId,fingerprint,count:body.testing?1:recipients.length,period:body.period==='all'?fresh.divisions[0]:body.period},25000);
    if(reservation.status!==200)return res.status([400,401,403,409,429].includes(reservation.status)?reservation.status:503).json({error:reservation.status===429?'NEST email limit reached. Wait before sending another message.':reservation.status===403?'Your account needs a linked reply email before sending.':'Sending could not start. Your draft is still here.'});
    if(reservation.duplicate)return res.status(200).json({state:reservation.state,accepted:reservation.accepted||0,rejected:reservation.rejected||0,duplicate:true});
    reserved=true;
    const messages=postmarkMessages({recipients:body.testing?[reservation.replyTo]:recipients,replyTo:reservation.replyTo,subject:body.subject.trim(),content,requestId:body.requestId,testing:body.testing,senderKey:emailSenderKey(sender.email)});
    let result;try{result=await submitPostmark(messages);}catch{result={state:'unknown',accepted:0,rejected:0};}
    // A failed journal acknowledgement must never cause an automatic resend.
    const saved=await bridge({action:'auth-group-email',operation:'finish',session,requestId:body.requestId,fingerprint,lease:reservation.lease,...result},25000);
    if(saved.status!==200)return res.status(200).json({state:'unknown',accepted:result.accepted,rejected:result.rejected});
    return res.status(200).json(result);
  }catch(error){
    if(reserved)return res.status(200).json({state:'unknown',accepted:0,rejected:0});
    return res.status([401,403].includes(error.status)?error.status:503).json({error:[401,403].includes(error.status)?error.message:'Email access could not be verified. Your draft is still here.'});
  }
}
export default withDiagnostics('division',handler);
