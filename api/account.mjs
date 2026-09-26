import { createHmac, pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { COOKIE, IDENTITY, RECOVERY_CHALLENGE, RECOVERY_TICKET, accountEmail, districtEmail, username, token, validToken, cookies, setCookie, signedIdentity, originAllowed, bridge } from '../lib/nest-auth.mjs';

const owners = new Set(['astramario@gmail.com','mario@memberhq.net','mpenalver@bethelsd.org']);
const periods = new Set(['1','2','3','4','5','7','CTSO']);
const passwordValid = value => typeof value === 'string' && value.length >= 12 && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value);
const digest = (password, salt) => pbkdf2Sync(password, Buffer.from(salt, 'hex'), 210000, 32, 'sha256').toString('hex');
const ipHash = req => createHmac('sha256', process.env.SPINNER_BRIDGE_TOKEN || '').update(String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()).digest('hex');
const fail = (res, status, error) => res.status(status).json({error});
const hashFields = password => { const passwordSalt=randomBytes(16).toString('hex'); return {passwordSalt,passwordHash:digest(password,passwordSalt)}; };
async function current(jar) {
  if (!validToken(jar[COOKIE])) return null;
  const data=await bridge({action:'auth-me',session:jar[COOKIE]},25000);
  return data.status===200?data:null;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(res,405,'Method not allowed.');}
  if(!originAllowed(req)||!String(req.headers['content-type']||'').startsWith('application/json'))return fail(res,403,'This action is unavailable.');
  let body=req.body;
  try{if(typeof body==='string')body=JSON.parse(body);}catch{return fail(res,400,'Check the information you entered.');}
  if(!body||Array.isArray(body)||JSON.stringify(body).length>2048)return fail(res,400,'Check the information you entered.');
  const jar=cookies(req);
  try {
    if(body.action==='admin-create') {
      const admin=await current(jar);
      if(!admin||!owners.has(admin.email))return fail(res,403,'Only a NEST administrator can create accounts.');
      const name=username(body.username),recoveryEmail=body.recoveryEmail?districtEmail(body.recoveryEmail):'';
      const studentEmail=districtEmail(body.studentEmail);
      if(!name||!passwordValid(body.password)||(body.recoveryEmail&&!recoveryEmail)||!periods.has(body.period)||!studentEmail)return fail(res,400,'Choose a student and enter a username and password of at least 12 characters.');
      const data=await bridge({action:'auth-admin-create',session:jar[COOKIE],username:name,recoveryEmail,period:body.period,studentEmail,...hashFields(body.password)},30000);
      if(data.status===409)return fail(res,409,'That username or student already has an account.');
      if(data.status!==200)return fail(res,data.status===400?400:503,'The account could not be created. Check the student roster and recovery address.');
      return res.status(200).json({username:name,studentEmail,period:body.period});
    }
    if(['admin-roster','admin-list','admin-edit','admin-remove'].includes(body.action)) {
      const admin=await current(jar);
      if(!admin||!owners.has(admin.email))return fail(res,403,'Only a NEST administrator can manage accounts.');
      if(body.action==='admin-roster') {
        if(!periods.has(body.period))return fail(res,400,'Choose a period.');
        const data=await bridge({action:'auth-admin-roster',session:jar[COOKIE],period:body.period},30000);
        return data.status===200?res.status(200).json({students:data.students}):fail(res,503,'The student list is unavailable.');
      }
      if(body.action==='admin-list') {
        const data=await bridge({action:'auth-admin-list',session:jar[COOKIE]},30000);
        return data.status===200?res.status(200).json({accounts:data.accounts}):fail(res,503,'The account list is unavailable.');
      }
      const currentUsername=username(body.currentUsername);
      if(!currentUsername)return fail(res,400,'Choose an account.');
      if(body.action==='admin-remove') {
        const data=await bridge({action:'auth-admin-remove',session:jar[COOKIE],currentUsername},30000);
        return data.status===200?res.status(200).json({message:'Account access removed.'}):fail(res,data.status===404?404:503,'The account could not be removed.');
      }
      const name=username(body.username);
      if(!name||(body.password&&!passwordValid(body.password))||(!body.password&&name===currentUsername))return fail(res,400,'Enter a new username or a password of at least 12 characters.');
      const data=await bridge({action:'auth-admin-edit',session:jar[COOKIE],currentUsername,username:name,...(body.password?hashFields(body.password):{})},30000);
      if(data.status===409)return fail(res,409,'That username is already taken.');
      return data.status===200?res.status(200).json({message:'Account updated. Existing sign-ins were revoked.'}):fail(res,data.status===404?404:503,'The account could not be updated.');
    }
    if(body.action==='admin-reset') {
      const admin=await current(jar),name=username(body.username);
      if(!admin||!owners.has(admin.email))return fail(res,403,'Only a NEST administrator can reset accounts.');
      if(!name||!passwordValid(body.password))return fail(res,400,'Enter a username and a password of at least 12 characters.');
      const data=await bridge({action:'auth-admin-reset',session:jar[COOKIE],username:name,...hashFields(body.password)},30000);
      if(data.status!==200)return fail(res,data.status===404?404:503,'That account could not be reset.');
      return res.status(200).json({username:name,message:'Password reset. Existing sign-ins were revoked.'});
    }
    if(body.action==='profile-update') {
      const me=await current(jar);
      if(!me)return fail(res,401,'Sign in again to update your profile.');
      const name=body.username?username(body.username):me.username;
      if(!name||typeof body.currentPassword!=='string'||body.currentPassword.length>128||
        (body.newPassword&&!passwordValid(body.newPassword))||(!body.newPassword&&name===me.username))return fail(res,400,'Check your username and password. New passwords need at least 12 characters.');
      const lookup=await bridge({action:'auth-lookup',username:me.username,ip:ipHash(req)},25000);
      if(lookup.status!==200||!/^[a-f0-9]{32}$/.test(lookup.passwordSalt||'')||!/^[a-f0-9]{64}$/.test(lookup.passwordHash||''))return fail(res,401,'Current password is incorrect.');
      const expected=Buffer.from(lookup.passwordHash,'hex'),actual=Buffer.from(digest(body.currentPassword,lookup.passwordSalt),'hex');
      if(!timingSafeEqual(actual,expected))return fail(res,401,'Current password is incorrect.');
      const fields=body.newPassword?hashFields(body.newPassword):{};
      const data=await bridge({action:'auth-profile-update',session:jar[COOKIE],username:name,...fields},30000);
      if(data.status===409)return fail(res,409,'That username is already taken.');
      if(data.status!==200)return fail(res,data.status===401?401:503,'Your profile could not be updated.');
      const session=token(),duration='session';
      const fresh=await bridge({action:'auth-session',email:me.email,session,duration},25000);
      if(fresh.status!==200)return fail(res,503,'Profile saved. Please sign in again.');
      res.setHeader('Set-Cookie',[setCookie(COOKIE,session),setCookie(IDENTITY,signedIdentity(session,{username:name,email:me.email,expires:fresh.expires}),300)]);
      return res.status(200).json({signedIn:true,username:name,email:me.email,expires:fresh.expires});
    }
    if(body.action==='profile-read') {
      const me=await current(jar);
      if(!me)return fail(res,401,'Sign in to view your profile.');
      const data=await bridge({action:'auth-profile-read',session:jar[COOKIE]},25000);
      if(data.status!==200)return fail(res,503,'Profile unavailable.');
      return res.status(200).json({username:data.username,recoveryEmail:data.recoveryEmail||null,manual:data.manual===true});
    }
    if(body.action==='recover-request') {
      const email=districtEmail(body.email)||(['mario@memberhq.net','astramario@gmail.com'].includes(String(body.email||'').trim().toLowerCase())?String(body.email).trim().toLowerCase():'');
      if(!email)return fail(res,400,'Enter the approved recovery email address on your NEST account.');
      const challenge=token(),code=String(randomInt(0,1000000)).padStart(6,'0');
      const data=await bridge({action:'auth-recover-request',email,challenge,code,ip:ipHash(req)},25000);
      if(data.status===429)return fail(res,429,'Please wait before requesting another email.');
      if(data.status!==200)return fail(res,503,'Recovery is temporarily unavailable.');
      res.setHeader('Set-Cookie',setCookie(RECOVERY_CHALLENGE,challenge,600));
      return res.status(200).json({message:'If this email has a NEST account, a recovery message is on its way.'});
    }
    if(body.action==='recover-verify') {
      if(!validToken(jar[RECOVERY_CHALLENGE])||!/^\d{6}$/.test(body.code||''))return fail(res,401,'The code is invalid or expired.');
      const ticket=token();
      const data=await bridge({action:'auth-recover-verify',challenge:jar[RECOVERY_CHALLENGE],code:body.code,ticket},25000);
      if(data.status!==200)return fail(res,data.status===429?429:401,'The code is invalid or expired.');
      res.setHeader('Set-Cookie',[setCookie(RECOVERY_CHALLENGE,'',0),setCookie(RECOVERY_TICKET,ticket,600)]);
      return res.status(200).json({usernames:data.usernames});
    }
    if(body.action==='recover-reset') {
      const name=username(body.username);
      if(!validToken(jar[RECOVERY_TICKET])||!name||!passwordValid(body.password))return fail(res,400,'Choose an account and use a password of 12–128 characters.');
      const data=await bridge({action:'auth-recover-reset',ticket:jar[RECOVERY_TICKET],username:name,...hashFields(body.password)},30000);
      if(data.status!==200)return fail(res,data.status===401?401:503,'The reset link expired or the password could not be saved.');
      res.setHeader('Set-Cookie',setCookie(RECOVERY_TICKET,'',0));
      return res.status(200).json({username:data.username,message:'Password updated. Sign in with your username and new password.'});
    }
    return fail(res,400,'Unknown account action.');
  } catch(error) {console.error('NEST account action failed',{action:body.action,kind:error?.name||'Error'});return fail(res,503,'NEST accounts are temporarily unavailable.');}
}
