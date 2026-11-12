import {IDENTITY,IDENTITY_TTL,cookies,readIdentity,signedIdentity,setCookie,bridge,accountEmail} from './nest-auth.mjs';

// Reuse the same signed, session-bound five-minute identity used by NEST auth.
// Sending still verifies live leadership access and reserves against a live session.
export async function emailIdentity(req,res,session){
 const cached=readIdentity(session,cookies(req)[IDENTITY]);
 if(cached)return {status:200,...cached};
 let lastError;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const identity=await bridge({action:'auth-me',session},18000);
   if(identity.status===401)return identity;
   if(identity.status===200&&accountEmail(identity.email)){
    const signed=signedIdentity(session,identity);
    if(signed)res.setHeader('Set-Cookie',setCookie(IDENTITY,signed,IDENTITY_TTL));
    return identity;
   }
   lastError=new Error('School identity unavailable');
  }catch(error){lastError=error;}
 }
 throw lastError;
}
