import {readFile} from 'node:fs/promises';
import {COOKIE,cookies,validToken,originAllowed,bridge} from '../lib/nest-auth.mjs';
import {withDiagnostics} from '../lib/diagnostics.mjs';
async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to request fabrication.'});
 let payload={action:'auth-fabrication-intake',session,operation:'access'};
 if(req.method==='POST'){
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
  let b=req.body;try{if(typeof b==='string')b=JSON.parse(b);}catch{return res.status(400).json({error:'Invalid request.'});}
  if(!b||Array.isArray(b)||JSON.stringify(b).length>5000||!['upload','submit'].includes(b.operation)||!/^([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.test(b.submission||'')||!['1','2','3','4','5','7','CTSO','GUEST'].includes(b.period))return res.status(400).json({error:'Invalid request.'});
  payload={...payload,operation:b.operation,submission:b.submission,period:b.period,...(b.operation==='upload'?{slot:b.slot,file:b.file,restart:b.restart===true}:{answers:b.answers})};
 }
 if(req.method==='GET'&&req.query?.request){
  const id=req.query.request,slot=req.query.slot;if(!/^[a-f0-9]{64}$/.test(id)||!['stl','formatted','calculator','dxf'].includes(slot))return res.status(400).json({error:'Invalid attachment.'});
  try{let offset=0,total=1;while(offset<total){const part=await bridge({action:'auth-fabrication-intake',session,operation:'download',id,slot,offset},50000);if(part.status!==200){if(offset===0)return res.status([401,403,404].includes(part.status)?part.status:503).json({error:'This attachment is unavailable.'});throw Error('Download interrupted');}const bytes=Buffer.from(part.data,'base64');if(!Number.isSafeInteger(part.size)||part.size>104857600||bytes.length!==Math.min(2097152,part.size-offset))throw Error('Invalid attachment');if(offset===0){res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(String(part.name||'fabrication-file').replace(/[\r\n]/g,'')));}total=part.size;res.write(bytes);offset+=bytes.length;}return res.end();}catch{if(res.headersSent)return res.destroy();return res.status(503).json({error:'The attachment could not be downloaded.'});}
 }
 const media=req.query?.media;if(media&&!/^(file-upload-[1-4]|onshape-export|onshape-save|factory-prepare|factory-import|factory-warnings|factory-printer|factory-slice|factory-estimates|factory-download|factory-folder|factory-name)\.(gif|png)$/.test(media))return res.status(404).json({error:'Image not found.'});
 try{
  const data=await bridge(payload,50000);
  if(data.status!==200)return res.status([400,401,403,409,429].includes(data.status)?data.status:503).json({error:data.error||({401:'Your sign-in has expired.',403:'A current NEST roster identity is required.',409:'This request changed. Check your files before continuing.',429:'Please wait before starting another request.'}[data.status])||'Fabrication is temporarily unavailable. Your draft remains open.'});
  if(media){const bytes=await readFile(new URL('../lib/fabrication-media/'+media,import.meta.url));res.setHeader('Content-Type',media.endsWith('.gif')?'image/gif':'image/png');return res.status(200).send(bytes);}
  if(payload.operation==='access')return res.status(200).json({members:(data.members||[]).map(({period,name})=>({period,name})),pricing:data.pricing,machines:data.machines||[]});
  if(payload.operation==='upload')return res.status(200).json(data.complete?{complete:true}:{uploadUrl:data.uploadUrl,type:data.type});
  return res.status(200).json({received:data.received===true,id:data.id});
 }catch{return res.status(503).json({error:'Fabrication is temporarily unavailable. Keep this draft open and retry to check whether your request saved.'});}
}
export default withDiagnostics('fabrication',handler);
