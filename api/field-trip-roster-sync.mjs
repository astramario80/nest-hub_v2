import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {fieldTripKey,tripBridge,deliverBatch,mailFor} from './field-trips.mjs';
export function createRosterSyncHandler({key=fieldTripKey,school=tripBridge,send=deliverBatch,clock=Date.now}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 const token=key(),stamp=String(req.headers['x-nest-sync-time']||''),id=String(req.headers['x-nest-sync-id']||''),signature=String(req.headers['x-nest-sync-signature']||'');
 if(!/^[a-f0-9]{64}$/.test(token)||!/^\d{13}$/.test(stamp)||Math.abs(clock()-Number(stamp))>300000||!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9]{64}$/.test(signature))return res.status(401).json({error:'Unavailable.'});
 const digest=createHash('sha256').update(token).digest('hex'),expected=createHmac('sha256',digest).update('nest-trip-roster-sync-v1\n'+stamp+'\n'+id).digest();if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))return res.status(401).json({error:'Unavailable.'});
 try{const result=await school({operation:'roster-sync',service:true});if(result.status!==200)return res.status(503).json({error:'Roster synchronization is pending.'});const jobs=result._mailJobs||[],messages=jobs.map(mailFor),outcomes=messages.length?await send(messages):[],deliveries=jobs.map((j,i)=>({id:j.id,state:outcomes[i]?.state||'unknown',providerId:outcomes[i]?.providerId||'',errorCode:outcomes[i]?.errorCode??null,errorMessage:outcomes[i]?.errorMessage||''}));if(deliveries.length){const saved=await school({operation:'mail-results',service:true,results:deliveries});if(saved.status!==200)return res.status(503).json({error:'Delivery acknowledgment is pending; claimed invitations will not resend automatically.'});}return res.status(200).json({added:result.added||0,invitations:jobs.length});}catch{return res.status(503).json({error:'Roster synchronization could not be confirmed. Claimed invitations are not automatically resent.'});}
};}
export default createRosterSyncHandler();
