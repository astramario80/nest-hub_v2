import {createHmac,timingSafeEqual} from 'node:crypto';
import {validToken} from './nest-auth.mjs';
export const SIGNALS_GRANT_COOKIE='__Host-nest-signals-grant';
export const SIGNALS_GRANT_TTL=60;
const mac=value=>createHmac('sha256',process.env.SPINNER_BRIDGE_TOKEN).update('nest-signals-grant-v1:'+value).digest('base64url');
export function issueSignalsGrant(session,now=Date.now()) {
  if(!validToken(session)||!process.env.SPINNER_BRIDGE_TOKEN)return '';
  const expires=String(now+SIGNALS_GRANT_TTL*1000);
  return expires+'.'+mac(session+':'+expires);
}
export function validSignalsGrant(session,grant,now=Date.now()) {
  if(!validToken(session)||!process.env.SPINNER_BRIDGE_TOKEN||typeof grant!=='string'||grant.length>100)return false;
  const [expires,signature,...extra]=grant.split('.');
  if(extra.length||!/^\d{13}$/.test(expires)||!signature||Number(expires)<=now||Number(expires)>now+SIGNALS_GRANT_TTL*1000)return false;
  const expected=Buffer.from(mac(session+':'+expires)),actual=Buffer.from(signature);
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
