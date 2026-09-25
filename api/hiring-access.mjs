import { COOKIE, cookies, validToken, bridge } from '../lib/nest-auth.mjs';

const periods=new Set(['1','2','3','4','5','7','CTSO']);
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('Vary','Cookie');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
  const session=cookies(req)[COOKIE],period=String(req.query?.period||'');
  if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to manage hiring.'});
  if(!periods.has(period))return res.status(400).json({error:'Choose a division.'});
  try {
    const data=await bridge({action:'auth-hiring-access',session,period},25000);
    if(data.status===200)return res.status(200).json({authorized:true});
    if([401,403].includes(data.status))return res.status(data.status).json({error:data.status===403?'Only this division’s managers can manage hiring.':'Your sign-in has expired.'});
    throw new Error('Invalid hiring access response');
  }catch(error){console.error('Hiring access request failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Hiring access is temporarily unavailable.'});}
}
