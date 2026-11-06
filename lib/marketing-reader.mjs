import {bridge} from './nest-auth.mjs';
export function createMarketingReader(authorize=bridge,read=fetch){return async request=>{
 const access=await authorize({action:'auth-me',session:request.session},20000);
 if(access.status!==200)return {status:access.status===401?401:503};
 const endpoint=process.env.NEST_MARKETING_READER_URL,token=process.env.NEST_MARKETING_READER_TOKEN;
 if(!endpoint||!token)throw Error('Marketing reader not configured');
 const target=new URL(endpoint);if(target.protocol!=='https:'||target.hostname!=='script.google.com')throw Error('Invalid media bridge');
 const signal=AbortSignal.timeout(30000);
 let response=await read(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,...(request.file?{file:request.file,thumbnail:request.thumbnail}:{})}),redirect:'manual',signal});
 if([301,302,303].includes(response.status)){const next=new URL(response.headers.get('location'));if(next.protocol!=='https:'||next.hostname!=='script.googleusercontent.com')throw Error('Invalid media result host');response=await read(next,{redirect:'error',signal});}
 if(!response.ok)throw Error('Media reader unavailable');return response.json();
};}
export const marketingReader=createMarketingReader();
