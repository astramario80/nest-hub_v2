import { withDiagnostics } from '../lib/diagnostics.mjs';
import { createHmac, pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { COOKIE, IDENTITY, RECOVERY_CHALLENGE, RECOVERY_TICKET, accountEmail, registrationEmail, districtEmail, username, token, validToken, cookies, setCookie, signedIdentity, originAllowed, bridge, bridgeFailure } from '../lib/nest-auth.mjs';

const owners = new Set(['mario@memberhq.net','mpenalver@bethelsd.org','astramario@gmail.com']);
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
async function handler(req,res) {
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
    if(['staff-list','staff-save'].includes(body.action)){
      const admin=await current(jar);
      if(!admin||!owners.has(admin.email))return fail(res,403,'Only the NEST owner can delegate staff access.');
      if(body.action==='staff-list'){
        const data=await bridge({action:'auth-staff-list',session:jar[COOKIE]},30000);
        return data.status===200?res.status(200).json({staff:data.staff}):fail(res,503,'Staff access is unavailable.');
      }
      const email=districtEmail(body.email),divisions=body.divisions;
      if(!email||!email.endsWith('@bethelsd.org')||owners.has(email)||!['basic','division','admin'].includes(body.level)||!divisions||typeof divisions!=='object'||Array.isArray(divisions)||Object.keys(divisions).some(period=>!periods.has(period)||!['viewer','manager'].includes(divisions[period]))||body.level!=='division'&&Object.keys(divisions).length||body.level==='division'&&!Object.keys(divisions).length)return fail(res,400,'Choose a district staff email and valid division access.');
      const data=await bridge({action:'auth-staff-save',session:jar[COOKIE],email,level:body.level,divisions},30000);
      return data.status===200?res.status(200).json({message:'Staff access saved. Existing sign-ins were revoked; the staff person should sign in again. '+(data.slidesQueued===true?'Google slide sharing will update through the existing division worker.':'Google slide sharing could not be queued. Save this access again to retry.'),slidesQueued:data.slidesQueued===true}):fail(res,data.status===400?400:503,'Staff access could not be saved.');
    }
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
    if(['admin-roster','admin-list','admin-directory','admin-notes','admin-registration-unlock','admin-edit','admin-remove'].includes(body.action)) {
      const admin=await current(jar);
      if(!admin||!owners.has(admin.email))return fail(res,403,'Only a NEST administrator can manage accounts.');
      if(body.action==='admin-roster') {
        if(!periods.has(body.period))return fail(res,400,'Choose a period.');
        const data=await bridge({action:'auth-admin-roster',session:jar[COOKIE],period:body.period},30000);
        return data.status===200?res.status(200).json({students:data.students}):fail(res,503,'The student list is unavailable.');
      }
      if(body.action==='admin-registration-unlock') {
        const email=registrationEmail(body.email);
        if(!email)return fail(res,400,'Enter an approved district email address.');
        const data=await bridge({action:'auth-admin-registration-unlock',session:jar[COOKIE],email},30000);
        if(data.status===409)return fail(res,409,'This email already has a NEST account. Use sign-in or account recovery.');
        if(data.status===404)return fail(res,404,'This email is not recognized in the current NEST roster or staff directory.');
        return data.status===200?res.status(200).json({message:'Signup attempts reset. This email can retry now, with a 10-minute exception to the shared-network limit. Email verification and the normal code-attempt limit still apply.',expires:data.expires}):fail(res,503,'Signup attempts could not be reset.');
      }
      if(body.action==='admin-directory') {
        const data=await bridge({action:'auth-admin-directory',session:jar[COOKIE]},30000);
        return data.status===200?res.status(200).json({accounts:data.accounts}):fail(res,503,'The account directory is unavailable.');
      }
      if(body.action==='admin-notes') {
        const key=accountEmail(body.accountKey);
        if(!key||typeof body.notes!=='string'||body.notes.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.notes))return fail(res,400,'Notes must contain at most 1,000 characters.');
        const data=await bridge({action:'auth-admin-notes',session:jar[COOKIE],accountKey:key,notes:body.notes},30000);
        return data.status===200?res.status(200).json({message:'Administrator note saved.'}):fail(res,data.status===404?404:503,'The note could not be saved.');
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
      const email=districtEmail(body.email)||(owners.has(String(body.email||'').trim().toLowerCase())?String(body.email).trim().toLowerCase():'');
      if(!email)return fail(res,400,'Enter the approved recovery email address on your NEST account.');
      const challenge=token(),code=String(randomInt(0,1000000)).padStart(6,'0');
      const data=await bridge({action:'auth-recover-request',email,challenge,code,ip:ipHash(req)},55000);
      if(data.status===429){const wait=Math.max(1,Math.min(3600,Number(data.retryAfter)||60));res.setHeader('Retry-After',String(wait));return fail(res,429,'Please wait '+(wait<60?wait+' seconds':Math.ceil(wait/60)+' minute'+(wait>60?'s':''))+' before requesting another recovery email.');}
      if(data.status!==200)return fail(res,503,'Recovery is temporarily unavailable.');
      res.setHeader('Set-Cookie',setCookie(RECOVERY_CHALLENGE,challenge,600));
      return res.status(200).json({message:'If this email has a NEST account, a recovery message is on its way. Haven’t created an account yet? Choose Create account below to set up your NEST username and password. If you already have an account but no message arrives, check your recovery email address or ask your teacher for help.'});
    }
    if(body.action==='recover-verify') {
      if(!validToken(jar[RECOVERY_CHALLENGE])||!/^\d{6}$/.test(body.code||''))return fail(res,401,'The code is invalid or expired.');
      const ticket=token();
      const data=await bridge({action:'auth-recover-verify',challenge:jar[RECOVERY_CHALLENGE],code:body.code,ticket},55000);
      if(data.status!==200)return fail(res,data.status===429?429:401,'The code is invalid or expired.');
      res.setHeader('Set-Cookie',[setCookie(RECOVERY_CHALLENGE,'',0),setCookie(RECOVERY_TICKET,ticket,600)]);
      return res.status(200).json({usernames:data.usernames});
    }
    if(body.action==='recover-reset') {
      const name=username(body.username);
      if(!validToken(jar[RECOVERY_TICKET])||!name||!passwordValid(body.password))return fail(res,400,'Choose an account and use a password of 12–128 characters.');
      const data=await bridge({action:'auth-recover-reset',ticket:jar[RECOVERY_TICKET],username:name,...hashFields(body.password)},55000);
      if(data.status!==200)return fail(res,data.status===401?401:503,'The reset link expired or the password could not be saved.');
      res.setHeader('Set-Cookie',setCookie(RECOVERY_TICKET,'',0));
      return res.status(200).json({username:data.username,message:'Password updated. Sign in with your username and new password.'});
    }
    return fail(res,400,'Unknown account action.');
  } catch(error) {console.error('NEST account action failed',{action:body.action,...bridgeFailure(error)});return fail(res,503,'NEST accounts are temporarily unavailable.');}
}

export default withDiagnostics('profile',handler);
