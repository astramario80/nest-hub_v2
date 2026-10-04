import { randomUUID } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { cookies,COOKIE,IDENTITY,readIdentity,username,bridge,validToken } from './nest-auth.mjs';
export const diagnosticOwners=new Set(['mario@memberhq.net','mpenalver@bethelsd.org','astramario@gmail.com']);
export const diagnosticAreas=new Set(['auth','service','hiring','tracker','signals','division','leadership','fabrication','lunch','profile']);
export function diagnosticOperation(req){
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{body=null;}
 const raw=body?.action||body?.operation||req.query?.operation||req.query?.action||req.query?.asset||'access';
 return /^[a-z][a-z0-9-]{0,39}$/.test(raw)?raw:'access';
}
export function diagnosticEvent(req,area,status,durationMs,requestId,data){
 const jar=cookies({headers:req.headers||{}}),identity=readIdentity(jar[COOKIE],jar[IDENTITY]);let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{body=null;}
 const login=area==='auth'&&diagnosticOperation(req)==='login';
 const verified=login?(Number(status)<400?username(data?.username):''):identity?.username||(area==='auth'&&data?.signedIn===true?username(data?.username):'');
 const attempted=area==='auth'&&diagnosticOperation(req)==='login'?username(body?.username):'';
 return {...(!login&&validToken(jar[COOKIE])?{_session:jar[COOKIE]}:{}),id:randomUUID(),requestId,time:new Date().toISOString(),area,operation:diagnosticOperation(req),phase:'server',status:Number(status)||500,durationMs:Math.min(180000,Math.max(0,Math.round(durationMs))),actor:verified||attempted||'anonymous',identity:verified?'verified':attempted?'attempted':'anonymous',code:Number(status)>=400?'http-'+status:'ok'};
}
let pending=[],flushTask=null;
export function queueDiagnostic(entry){
 if(process.env.VERCEL!=='1')return;
 pending.push(entry);if(pending.length>100)pending.shift();
 if(!flushTask){flushTask=(async()=>{await new Promise(resolve=>setTimeout(resolve,100));while(pending.length){const entries=pending.splice(0,20);try{const result=await bridge({action:'diagnostics-record',entries},8000);if(result.status!==200)console.error('Diagnostics storage unavailable',{status:result.status});}catch{console.error('Diagnostics storage unavailable');}}})().finally(()=>{flushTask=null;});}
 waitUntil(flushTask);
}
export function withDiagnostics(area,handler){return async(req,res)=>{
 const started=Date.now(),requestId=randomUUID();let status=200,recorded=false;const originalStatus=res.status.bind(res),originalJson=typeof res.json==='function'?res.json.bind(res):null;
 res.setHeader('X-NEST-Request-ID',requestId);
 res.status=value=>{status=value;return originalStatus(value);};
 const record=(code,data)=>{try{queueDiagnostic(diagnosticEvent(req,area,code,Date.now()-started,requestId,data));}catch{}};
 if(originalJson)res.json=data=>{if(!recorded){recorded=true;record(status,data);}return originalJson(data);};
 for(const method of ['send','end'])if(typeof res[method]==='function'){const original=res[method].bind(res);res[method]=(...args)=>{if(!recorded){recorded=true;record(status);}return original(...args);};}
 try{return await handler(req,res);}catch(error){if(!recorded)record(500);throw error;}
};}
export function browserDiagnostic(value,actor){
 if(!value||!diagnosticAreas.has(value.area)||!/^[a-z][a-z0-9-]{0,39}$/.test(value.operation||'')||!Number.isFinite(value.durationMs)||value.durationMs<0||value.durationMs>180000||!Number.isInteger(value.status)||value.status<0||value.status>599)return null;
 const occurred=Date.parse(value.time);
 return {id:randomUUID(),requestId:/^[a-f0-9-]{36}$/.test(value.requestId||'')?value.requestId:randomUUID(),time:Number.isFinite(occurred)&&occurred<=Date.now()+60000&&occurred>=Date.now()-86400000?new Date(occurred).toISOString():new Date().toISOString(),area:value.area,operation:value.operation,phase:'browser',durationMs:Math.round(value.durationMs),status:value.status,actor:actor.username,identity:'verified',code:value.status===0?'network':value.status>=400?'http-'+value.status:'ok'};
}
