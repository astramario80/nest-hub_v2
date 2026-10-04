import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
export const CLIENT_COOKIE='__Host-nest-service';
export const NONCE_COOKIE='__Host-nest-service-nonce';
export const STAFF_DOMAIN='bethelsd.org';
const verifier=new OAuth2Client();
const mac=value=>createHmac('sha256',process.env.SPINNER_BRIDGE_TOKEN).update('service-google-v1:'+value).digest('base64url');
export function newChallenge(){
 const nonce=randomBytes(32).toString('hex');
 const value=Buffer.from(JSON.stringify({nonce,expires:Date.now()+600000})).toString('base64url');
 return {nonce,cookie:value+'.'+mac(value)};
}
export function readChallenge(raw){
 if(typeof raw!=='string'||raw.length>1024||!process.env.SPINNER_BRIDGE_TOKEN)return null;
 const [value,signature,...extra]=raw.split('.');if(!value||!signature||extra.length)return null;
 const expected=Buffer.from(mac(value)),actual=Buffer.from(signature);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
 try{const data=JSON.parse(Buffer.from(value,'base64url').toString());return /^[a-f0-9]{64}$/.test(data.nonce)&&data.expires>Date.now()&&data.expires<=Date.now()+600000?data:null;}catch{return null;}
}
export function staffClaims(claims,nonce,now=Date.now()){
 const email=String(claims?.email||'').toLowerCase();
 return claims?.nonce===nonce&&claims?.email_verified===true&&claims?.hd===STAFF_DOMAIN&&
 /^[^\s@,;<>]+@bethelsd\.org$/.test(email)&&email.length<=254&&typeof claims.sub==='string'&&
 Number.isFinite(claims.exp)&&claims.exp*1000>now?{email,sub:claims.sub,expires:Math.min(claims.exp*1000,now+3600000)}:null;
}
export async function verifyStaff(credential,nonce){
 const ticket=await verifier.verifyIdToken({idToken:credential,audience:process.env.SERVICE_GOOGLE_CLIENT_ID});
 return staffClaims(ticket.getPayload(),nonce);
}
