import {createHmac,timingSafeEqual} from 'node:crypto';
import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
const PATH='lab-requests/archive-v1.json';
export const labStorageKey=()=>process.env.SPINNER_BRIDGE_TOKEN?createHmac('sha256',process.env.SPINNER_BRIDGE_TOKEN).update('nest-private-lab-storage-v1').digest('hex'):'';
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const recordOK=r=>r&&typeof r==='object'&&!Array.isArray(r)&&typeof r.id==='string'&&/^[a-f0-9-]{36}$/i.test(r.id)&&Number.isInteger(r.revision)&&r.revision>0&&typeof r.day==='string'&&typeof r.name==='string'&&typeof r.email==='string'&&Array.isArray(r.events)&&JSON.stringify(r).length<50000&&!Object.hasOwn(r,'_row');
export function createStorageHandler(storage={get,put}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({status:405});}
  const expected=labStorageKey(),provided=String(req.headers.authorization||'').replace(/^Bearer /,'');if(!expected||!equal(provided,expected))return res.status(401).json({status:401});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({status:400});
  let input=req.body;try{if(typeof input==='string')input=JSON.parse(input);}catch{return res.status(400).json({status:400});}
  if(!input||typeof input!=='object'||!['read','save','migrate'].includes(input.operation)||JSON.stringify(input).length>4200000)return res.status(400).json({status:400});
  if(input.operation!=='read'&&(!Array.isArray(input.records)||input.records.length>10000||!input.records.every(recordOK)||new Set(input.records.map(r=>r.id)).size!==input.records.length))return res.status(400).json({status:400});
  try{
   const current=await storage.get(PATH,{access:'private',useCache:false}),version=current?.blob?.etag||null;
   const state=current?await new Response(current.stream).json():null;
   if(state&&(state.schema!==1||!Array.isArray(state.records)||!state.records.every(recordOK)))throw Error('Invalid archive');
   if(input.operation==='read')return state?res.status(200).json({status:200,version,records:state.records}):res.status(503).json({status:503,error:'Website archive has not been migrated.'});
   // Migration is retryable after an uncertain result, but can never replace a
   // changed website archive. The school lock protects the source during cutover.
   if(input.operation==='migrate'&&state){
    if(JSON.stringify(state.records)!==JSON.stringify(input.records))return res.status(409).json({status:409,error:'The website archive already contains different records.'});
    return res.status(200).json({status:200,version,count:state.records.length});
   }
   if(input.operation==='save'&&(!state||input.version!==version))return res.status(409).json({status:409,error:'The archive changed. Refresh before saving.'});
   const byId=new Map((state?.records||[]).map(r=>[r.id,r]));for(const record of input.records)byId.set(record.id,record);
   const records=[...byId.values()];if(records.length>10000)return res.status(503).json({status:503,error:'Archive maintenance is required.'});
   const body=JSON.stringify({schema:1,records});if(Buffer.byteLength(body)>4000000)return res.status(503).json({status:503,error:'Archive maintenance is required.'});
   const saved=await storage.put(PATH,body,{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:input.operation==='save',...(version?{ifMatch:version}:{}),cacheControlMaxAge:0});
   return res.status(200).json({status:200,version:saved.etag,count:records.length});
  }catch(error){console.error('Private lab storage failed',{name:error?.name,code:typeof error?.code==='string'?error.code:undefined});const conflict=error instanceof BlobPreconditionFailedError||error?.name==='BlobPreconditionFailedError'||error?.name==='BlobAlreadyExistsError';return res.status(conflict?409:503).json({status:conflict?409:503,error:conflict?'The archive changed. Refresh before saving.':'Private website storage is temporarily unavailable.'});}
 };
}
export default createStorageHandler();
