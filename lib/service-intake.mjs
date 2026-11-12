import {normalizePhone} from './service-phone.mjs';
export const CODE_COOKIE='__Host-nest-service-code';
export function serviceEmail(value){
 const email=typeof value==='string'?value.trim().toLowerCase():'';
 return email.length<=254&&/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email)?email:'';
}
export function intakeFields(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const limits={name:200,phone:80,room:120,category:120,description:4000,attachment:2000};const fields={};
 for(const [key,max] of Object.entries(limits)){
  if(typeof value[key]!=='string'||value[key].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value[key]))return null;
  fields[key]=value[key].trim();
 }
 if(!fields.name||!fields.room||!fields.category||!fields.description||!['1','2','3','4','5'].includes(value.urgency))return null;
 if(fields.attachment&&!fields.attachment.split(/\r?\n/).every(url=>/^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)[a-zA-Z0-9_-]+[^\s<>"']*$/.test(url.trim())))return null;
 if(value.client!=null){const c=value.client;if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.name!=='string'||!c.name.trim()||c.name.length>200||!serviceEmail(c.email)||typeof c.address!=='string'||c.address.length>500||/[\u0000-\u001f\u007f]/.test(c.name+c.address))return null;fields.client={name:c.name.trim(),email:serviceEmail(c.email),address:c.address.trim()};}
 fields.phone=normalizePhone(fields.phone);fields.urgency=value.urgency;return fields;
}
