import sanitizeHtml from 'sanitize-html';
import {decodeHTML} from 'entities';
import {createHmac} from 'node:crypto';

export const MAX_EMAIL_RECIPIENTS=300;
export function emailContent(input){
  const html=sanitizeHtml(input,{allowedTags:['p','div','br','b','strong','i','em','ul','ol','li','blockquote','a','span','font','u','s','strike','del','h1','h2','h3'],
    allowedAttributes:{'*':['style'],a:['href'],font:['face','size','color']},allowedSchemes:['https','http','mailto'],allowProtocolRelative:false,
    allowedStyles:{'*':{
      color:[/^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\)|[a-z]+)$/i],
      'background-color':[/^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\)|[a-z]+)$/i],
      'text-align':[/^(left|center|right|justify)$/],'margin-left':[/^(?:0|[1-9]\d?|[1-5]\d{2}|6[0-3]\d|640)px$/],
      'font-weight':[/^(normal|bold|[1-9]00)$/],'font-style':[/^(normal|italic)$/],
      'text-decoration':[/^(underline|line-through)( (underline|line-through))?$/],
      'font-family':[/^(?:Arial|Verdana|Georgia|Times New Roman|Courier New)(?:,\s*(?:serif|sans-serif|monospace))?$/i],
      'font-size':[/^(small|medium|large|x-large|[1-4][0-9]px)$/]
    }},nonTextTags:['script','style','textarea','option','iframe','object','svg','math','form']});
  const text=sanitizeHtml(html.replace(/<\/(?:p|div|li|h[123]|blockquote)>|<br\s*\/?>/gi,'\n'),{allowedTags:[],allowedAttributes:{}}).trim();
  return {html,text:decodeHTML(text)};
}
export const emailSenderKey=email=>createHmac('sha256',process.env.SPINNER_BRIDGE_TOKEN).update('nest-email-sender:'+email).digest('hex');
export function postmarkMessages({recipients,replyTo,subject,content,requestId,testing,senderKey}){
  const from=process.env.POSTMARK_FROM_EMAIL;
  const html='<div><a href="https://gknest.org/"><img src="https://gknest.org/assets/nest-email-banner.png" alt="NEST™" width="560" style="max-width:100%;height:auto"></a><div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6"><!-- NEST_MESSAGE_START -->'+content.html+'<!-- NEST_MESSAGE_END --></div><p>Sent through NEST™ Communications. Replies go to '+replyTo+'.</p><p><a href="{{{ pm:unsubscribe }}}">Unsubscribe from NEST announcements</a></p></div>';
  return recipients.map(To=>({From:'NEST Communications <'+from+'>',To,ReplyTo:replyTo,Subject:(testing?'[TEST] ':'')+subject,
    HtmlBody:html,TextBody:'NEST™\n'+content.text+'\n\nReplies: '+replyTo+'\nUnsubscribe: {{{ pm:unsubscribe }}}',
    MessageStream:process.env.POSTMARK_MESSAGE_STREAM||'broadcast',Tag:'nest-'+requestId,TrackOpens:true,TrackLinks:'None',
    ...(senderKey?{Metadata:{nestActor:senderKey,nestRequestId:requestId,nestSelectedCount:String(recipients.length),nestTesting:String(testing)}}:{})}));
}

export async function postmarkRead(path,query={}){
 const response=await fetch('https://api.postmarkapp.com'+path+'?'+new URLSearchParams(query),{headers:{Accept:'application/json','X-Postmark-Server-Token':process.env.POSTMARK_SERVER_TOKEN},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('Postmark history unavailable');return response.json();
}

// Never retry a send: a lost response can still mean the provider accepted it.
export async function submitPostmark(messages){
  const response=await fetch('https://api.postmarkapp.com/email/batch',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-Postmark-Server-Token':process.env.POSTMARK_SERVER_TOKEN},body:JSON.stringify(messages),signal:AbortSignal.timeout(25000)});
  let result;try{result=await response.json();}catch{return {state:'unknown',accepted:0,rejected:0};}
  if(response.status>=400&&response.status<500)return {state:'rejected',accepted:0,rejected:messages.length};
  if(!response.ok||!Array.isArray(result)||result.length!==messages.length)return {state:'unknown',accepted:0,rejected:0};
  if(result.some((item,i)=>item.To?.toLowerCase()!==messages[i].To||!Number.isInteger(item.ErrorCode)||item.ErrorCode===0&&(typeof item.MessageID!=='string'||!item.MessageID)))return {state:'unknown',accepted:0,rejected:0};
  const accepted=result.filter(item=>item.ErrorCode===0).length;
  return {state:accepted===messages.length?'accepted':accepted?'partial':'rejected',accepted,rejected:messages.length-accepted,outcomes:result.map(item=>({email:item.To,messageId:item.ErrorCode===0?item.MessageID:null,errorCode:item.ErrorCode}))};
}
