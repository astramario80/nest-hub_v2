import { COOKIE, cookies, validToken, bridge, originAllowed } from '../lib/nest-auth.mjs';
const fields={'budget-reference':[],'service-lists':[],'purchase-history':['year'],'request-action':['id','revision','change','newId','day'],'request-edit':['id','revision','title','reason','quantity','unitCost','shipping','fund','url'],'list-create':['id','name','description','group'],'list-edit':['id','revision','name','description'],'list-remove':['id','revision'],'list-restore':['id','revision'],'list-item-add':['id','revision','itemId','title','reason','quantity','unitCost','url'],'list-item-edit':['id','revision','itemId','title','reason','quantity','unitCost','url'],'list-item-restore':['id','revision','itemId'],'list-item-remove':['id','revision','itemId'],view:[],admin:[],'food-document':['id'],'asb-preview':['id','revision','change','ticket','signaturesConfirmed'],'asb-commit':['ticket'],attendance:['day','group'],create:['id','title','reason','url','unitCost','quantity','divisions','fund'],'item-link':['id','revision','url'],comment:['id','revision','commentId','text'],update:['id','revision','divisions','quantity','unitCost','shipping','fund','stage'],preview:['id','draft','receipt'],commit:['id']};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in with your NEST profile to open purchasing.'});
 let body={operation:'view'};
 if(req.method==='POST'){
  if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
  try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid request.'});}
 }
 if(!body||Array.isArray(body)||!Object.hasOwn(fields,body.operation)||JSON.stringify(body).length>2900000||Object.keys(body).some(k=>k!=='operation'&&!fields[body.operation].includes(k)))return res.status(400).json({error:'Check the purchasing form.'});
 const payload={action:'auth-purchasing',session,operation:body.operation};for(const key of fields[body.operation])if(body[key]!==undefined)payload[key]=body[key];
 try{
  const data=await bridge(payload,50000);
  if(data.status!==200){const status=[400,401,403,404,409,429].includes(data.status)?data.status:503;return res.status(status).json({error:data.error||({400:'Check the required fields.',401:'Your sign-in expired.',403:'This purchasing action is unavailable for your role.',404:'Request not found.',409:'The record changed. Refresh before continuing.',429:'Please finish your open requests first.',503:'Purchasing is temporarily unavailable. Refresh the saved status before retrying.'})[status]});}
  const {status,...result}=data;return res.status(200).json(result);
 }catch{return res.status(503).json({error:'Purchasing could not be confirmed. Refresh purchase history before retrying. Your transaction may still be processing.'});}
}
