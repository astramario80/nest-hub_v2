import { COOKIE, cookies, validToken, bridge, originAllowed } from '../lib/nest-auth.mjs';
const types=new Set(['kits','drones','laptops','usbs','radios','computers','printers']);
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to manage equipment assignments.'});
 let payload;
 if(req.method==='GET'){
  const type=req.query?.type||'kits',page=Number(req.query?.page||0);
  if(!types.has(type)||!Number.isInteger(page)||page<0||page>166)return res.status(400).json({error:'Choose an equipment category and page.'});
  payload={action:'auth-inventory',operation:'view',session,type,page};
 }else{
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid request.'});}
  if(body?.operation==='manage'){
   if(!types.has(body.type)||!['add','edit','remove'].includes(body.change)||JSON.stringify(body).length>5000)return res.status(400).json({error:'Choose an equipment action.'});
   if(body.change==='add'?!validToken(body.catalogVersion):!validToken(body.id)||!validToken(body.version))return res.status(400).json({error:'Refresh equipment before continuing.'});
   if(body.change!=='remove'&&(typeof body.number!=='string'||body.number.length>80||typeof body.serial!=='string'||body.serial.length>100))return res.status(400).json({error:'Enter an equipment ID and serial number.'});
   if(body.type==='printers'&&body.change!=='remove'&&(typeof body.makerSerial!=='string'||body.makerSerial.length>100))return res.status(400).json({error:'Check the manufacturer serial number.'});
   payload={action:'auth-inventory',operation:'manage',session,type:body.type,change:body.change,id:body.id,version:body.version,catalogVersion:body.catalogVersion,number:body.number,serial:body.serial,makerSerial:body.makerSerial};
  }else if(body?.operation==='sync'){
   if(!types.has(body.type)||Object.keys(body).some(key=>!['operation','type'].includes(key)))return res.status(400).json({error:'Choose an equipment category.'});
   payload={action:'auth-inventory',operation:'sync',session,type:body.type};
  }else{
  if(!body||Array.isArray(body)||JSON.stringify(body).length>65000||!types.has(body.type)||!validToken(body.id)||!validToken(body.version)||!Array.isArray(body.changes)||!body.changes.length||body.changes.length>30||!body.changes.every(c=>c&&Number.isInteger(c.column)&&c.column>=0&&c.column<30&&typeof c.value==='string'&&c.value.length<=2000))return res.status(400).json({error:'Check the assignment fields before saving.'});
  payload={action:'auth-inventory',operation:'save',session,type:body.type,id:body.id,version:body.version,changes:body.changes.map(({column,value})=>({column,value}))};
  }
 }
 try{
  const data=await bridge(payload,50000);
  if(data.status!==200){const status=[400,401,403,409].includes(data.status)?data.status:503;return res.status(status).json({error:({400:'The dropdown choices changed or an entry is invalid. Refresh and check your selection.',401:'Your sign-in has expired. Sign in again.',403:'Equipment assignments are available to current Directors of Inventory and administrators.',409:'Equipment changed, an ID or serial is duplicated, or this item still has assignments. Check the register and clear assignments before removal.',503:'Equipment assignments are temporarily unavailable. Check the saved assignment before retrying.'})[status]});}
  if(payload.operation==='sync')return res.status(200).json({mirrorSync:data.mirrorSync==='updated'?'updated':'pending'});
  if(['save','manage'].includes(payload.operation))return res.status(200).json({saved:data.saved===true,mirrorSync:data.mirrorSync==='updated'?'updated':'pending',...(payload.operation==='manage'?{id:validToken(data.id)?data.id:null,page:Number.isInteger(data.page)&&data.page>=0&&data.page<=166?data.page:0}:{})});
  if(!Array.isArray(data.records)||data.records.length>30||!data.choices||!Number.isInteger(data.total))throw new Error('Invalid inventory response');
  return res.status(200).json({records:data.records,choices:data.choices,total:data.total,page:payload.page,hasMore:data.hasMore===true,unavailable:data.unavailable===true,catalogVersion:data.catalogVersion,idLabel:data.idLabel,serialLabel:data.serialLabel});
 }catch{return res.status(503).json({error:'Equipment assignments are temporarily unavailable. Check the saved assignment before retrying.'});}
}
