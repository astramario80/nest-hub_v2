import {Readable} from 'node:stream';import {pipeline} from 'node:stream/promises';
import {get} from '@vercel/blob';
import {bridge,cookies,validToken,COOKIE} from '../lib/nest-auth.mjs';
import {CLIENT_COOKIE} from '../lib/service-google.mjs';import {mediaId,mediaFields,MEDIA_TYPES} from '../lib/service-media.mjs';
export function createAttachmentHandler(storage={get},school=bridge){return async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(!['GET','HEAD'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
 const jar=cookies(req);if(!validToken(jar[COOKIE])&&!validToken(jar[CLIENT_COOKIE]))return res.status(401).json({error:'Sign in to open this ticket attachment.'});
 const ticketId=req.query?.ticket,fileId=req.query?.file;if(!mediaId(ticketId)||!mediaId(fileId))return res.status(400).json({error:'Invalid attachment.'});
 try{
  const result=await school({action:'auth-service-attachment-read',session:jar[COOKIE],clientSession:jar[CLIENT_COOKIE],ticketId,fileId},45000);
  if(result.status!==200)return res.status([401,403,404].includes(result.status)?result.status:503).json({error:'This attachment is unavailable with your current ticket access.'});
  const file=mediaFields(result.file);if(!file||file.ticketId!==ticketId||file.fileId!==fileId||file.path!==result.file.path)throw Error('Invalid attachment metadata');
  const range=req.headers.range;
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2]||match.slice(1).some(value=>value&&!Number.isSafeInteger(Number(value)))||!match[1]&&Number(match[2])===0||match[1]&&Number(match[1])>=file.size||match[1]&&match[2]&&Number(match[2])<Number(match[1])){res.setHeader('Content-Range','bytes */'+file.size);return res.status(416).end();}}
  res.setHeader('Content-Type',file.type);res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
  let filename=file.name.replace(/[\\\/\u202a-\u202e\u2066-\u2069]/g,'_').replace(/^\.+/,'_');const extension=filename.split('.').pop().toLowerCase(),expected=MEDIA_TYPES[file.type];if(extension!==expected&&!(expected==='jpg'&&extension==='jpeg'))filename+='.'+expected;const name=filename.replace(/[^\x20-\x7e]|["]/g,'_');res.setHeader('Content-Disposition',(req.query?.download==='1'?'attachment':'inline')+'; filename="'+name+'"; filename*=UTF-8\'\''+encodeURIComponent(filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16)));
  if(req.method==='HEAD'){res.setHeader('Content-Length',String(file.size));return res.status(200).end();}
  if(file.storage==='drive'){if(typeof result.readToken!=='string'||result.readToken.length<20)throw Error('Drive read unavailable');const response=await (storage.fetch||fetch)('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.driveId)+'?alt=media',{headers:{Authorization:'Bearer '+result.readToken,...(range?{Range:range}: {})},redirect:'error'});if(!response.ok)return res.status([403,404,416].includes(response.status)?response.status:503).end();for(const header of ['content-range','content-length']){const value=response.headers.get(header);if(value)res.setHeader(header,value);}res.status(response.status);await pipeline(Readable.fromWeb(response.body),res);return;}
  const blob=await storage.get(file.path,{access:'private',useCache:false,...(range?{headers:{Range:range}}:{})});if(!blob?.stream)return res.status(404).end();
  const contentRange=blob.headers?.get('content-range'),length=blob.headers?.get('content-length');if(contentRange)res.setHeader('Content-Range',contentRange);if(length)res.setHeader('Content-Length',length);
  res.status(contentRange?206:200);await pipeline(Readable.fromWeb(blob.stream),res);
 }catch(error){console.error('Service attachment read failed',{name:error?.name||'Error'});if(!res.headersSent)return res.status(503).json({error:'The attachment could not load. Please try again.'});res.destroy?.();}
};}
export default createAttachmentHandler();
