import {accountEmail,validToken} from './nest-auth.mjs';
import {emailContent} from './postmark-email.mjs';
const states=new Set(['pending','accepted','partial','rejected','unknown']);
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
export async function senderArchiveHistory({session,identity,actor,requestId,offset,statusOnly=false,bridge,postmarkRead}){
 const result=await bridge({action:'auth-email-archive',operation:requestId?'sent-detail':'sent-list',session,requestId,offset},45000);
 if([404,501].includes(result.status))return null;
 if(result.status!==200)throw new Error('Saved send history unavailable');
 if(!requestId){if(!Array.isArray(result.messages)||!Number.isInteger(result.nextOffset)||typeof result.hasMore!=='boolean')throw new Error('Invalid saved send history');return {messages:result.messages.map(m=>{if(m.sender!==identity||!validToken(m.requestId)||!states.has(m.state))throw new Error('Invalid saved send ownership');return {requestId:m.requestId,subject:m.subject,sentAt:m.sentAt,testing:m.testing,state:m.state,accepted:m.accepted,rejected:m.rejected,selected:m.selected};}),nextOffset:result.nextOffset,hasMore:result.hasMore,permanent:true};}
 const m=result.message;if(!m||m.sender!==identity||m.requestId!==requestId||!states.has(m.state)||!Array.isArray(m.recipientDetails)||m.recipientDetails.length>300||m.recipientDetails.length!==m.selected||m.recipientDetails.some(r=>!accountEmail(r.email)||r.email.startsWith('manual:')))throw new Error('Invalid saved send ownership');
 const accepted=Number(m.accepted)||0,rejected=Number(m.rejected)||0,unconfirmed=Math.max(0,m.selected-accepted-rejected);
 if(statusOnly)return {requestId,state:m.state,accepted,rejected,unconfirmed,selected:m.selected,testing:m.testing};
 const recipients=m.recipientDetails.map(r=>({email:r.email,name:typeof r.name==='string'&&r.name.trim()?r.name:r.email,state:['pending','accepted','rejected','unknown'].includes(r.state)?r.state:'unknown',errorCode:Number.isInteger(r.errorCode)?r.errorCode:null,errorMessage:typeof r.errorMessage==='string'?r.errorMessage.slice(0,500):'',openedAt:null}));
 let tracking=false;const byId=new Map(m.recipientDetails.filter(r=>r.state==='accepted'&&uuid(r.messageId)).map(r=>[r.messageId,recipients.find(p=>p.email===r.email)]));
 if(byId.size&&process.env.POSTMARK_SERVER_TOKEN){try{const activity=await postmarkRead('/messages/outbound/opens',{count:'500',offset:'0',tag:'nest-'+requestId,messagestream:process.env.POSTMARK_MESSAGE_STREAM||'broadcast'});if(!Array.isArray(activity.Opens))throw new Error('Invalid open activity');for(const open of activity.Opens){const r=byId.get(open.MessageID);if(r&&r.email===open.Recipient&&Number.isFinite(Date.parse(open.ReceivedAt))&&(!r.openedAt||Date.parse(open.ReceivedAt)<Date.parse(r.openedAt)))r.openedAt=open.ReceivedAt;}tracking=true;}catch{/* Delivery history remains readable when provider open activity is unavailable. */}}
 const observedOpens=recipients.filter(r=>r.openedAt).length,content=emailContent(m.html||'');return {requestId,subject:m.subject,sentAt:m.sentAt,testing:m.testing,state:m.state,tracking,accepted,rejected,unconfirmed,selected:m.selected,observedOpens,openRate:accepted?Math.round(observedOpens/accepted*1000)/10:0,recipients,html:content.html,text:content.text,permanent:true};
}
