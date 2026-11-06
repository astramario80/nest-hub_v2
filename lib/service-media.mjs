import {createHmac,timingSafeEqual} from 'node:crypto';
import {mediaFields} from './service-media-types.mjs';
export * from './service-media-types.mjs';
const mac=value=>createHmac('sha256',process.env.SPINNER_BRIDGE_TOKEN).update('nest-service-media-v1:'+value).digest('base64url');
export function mediaReceipt(meta,session,now=Date.now()){
 const value=Buffer.from(JSON.stringify({...meta,session:mac(session),expires:now+1800000})).toString('base64url');return value+'.'+mac(value);
}
export function readMediaReceipt(raw,session,now=Date.now()){
 if(!process.env.SPINNER_BRIDGE_TOKEN||typeof raw!=='string'||raw.length>2400||typeof session!=='string')return null;
 const parts=raw.split('.');if(parts.length!==2)return null;
 const expected=Buffer.from(mac(parts[0])),actual=Buffer.from(parts[1]);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
 try{const v=JSON.parse(Buffer.from(parts[0],'base64url').toString()),meta=mediaFields(v);return meta&&v.path===meta.path&&v.session===mac(session)&&Number.isFinite(v.expires)&&v.expires>now&&v.expires<=now+1800000?{...meta,expires:v.expires}:null;}catch{return null;}
}
