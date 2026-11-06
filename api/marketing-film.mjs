import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {cookies,validToken,COOKIE} from '../lib/nest-auth.mjs';
import {marketingReader} from '../lib/marketing-reader.mjs';
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{10,150}$/.test(value);
const mediaType=value=>/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(value||'');
export function createMarketingHandler(school=marketingReader,read=fetch){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
 const session=cookies(req)[COOKIE];if(!validToken(session))return res.status(401).json({error:'Sign in to view NEST moments.'});
 const id=req.query?.file,thumbnail=req.query?.thumbnail==='1';if(id!==undefined&&!validId(id))return res.status(400).end();
 const range=req.headers.range;if(range&&!/^bytes=(?:\d+-\d*|-\d+)$/.test(range))return res.status(416).end();
 try{
  const result=await school({action:'auth-marketing-film',session,...(id?{file:id,thumbnail}:{})},45000);
  if(result.status!==200)return res.status([400,401,403,404].includes(result.status)?result.status:503).end();
  if(!id)return res.status(200).json({items:(result.items||[]).filter(f=>validId(f.id)&&mediaType(f.type)).map(f=>({type:f.type,division:String(f.division||'NEST').slice(0,80),url:'/api/marketing-film?file='+encodeURIComponent(f.id)+(f.type.startsWith('image/')?'&thumbnail=1':'')}))});
  const file=result.file;if(file?.id!==id||!mediaType(file.type)||typeof result.readToken!=='string')throw Error('Invalid media metadata');
  let url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',isThumbnail=false;
  if(thumbnail&&file.type.startsWith('image/')&&file.thumbnail){const candidate=new URL(file.thumbnail);if(candidate.protocol==='https:'&&(/(^|\.)googleusercontent\.com$/.test(candidate.hostname))){url=candidate.href.replace(/=s\d+$/, '=s1280');isThumbnail=true;}}
  // Never forward the school bearer token to thumbnail hosts or the browser.
  const response=await read(url,{method:req.method,headers:{...(!isThumbnail?{Authorization:'Bearer '+result.readToken}:{}),...(!isThumbnail&&range?{Range:range}:{})},redirect:'error',signal:AbortSignal.timeout(45000)});
  if(!response.ok){if(response.status===416){const cr=response.headers.get('content-range');if(cr)res.setHeader('Content-Range',cr);}return res.status([403,404,416].includes(response.status)?response.status:503).end();}
  const type=isThumbnail?response.headers.get('content-type'):file.type;if(!mediaType(type))throw Error('Unsupported media response');
  res.setHeader('Content-Type',type);res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");if(!isThumbnail)res.setHeader('Accept-Ranges','bytes');
  for(const h of ['content-length','content-range']){const v=response.headers.get(h);if(v)res.setHeader(h,v);}
  res.status(response.status);if(req.method==='HEAD')return res.end();await pipeline(Readable.fromWeb(response.body),res);
 }catch(error){console.error('Marketing film unavailable',{name:error?.name||'Error'});if(!res.headersSent)return res.status(503).end();res.destroy?.();}
};}
export default createMarketingHandler();
