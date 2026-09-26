import { COOKIE, cookies, validToken, bridge } from '../lib/nest-auth.mjs';

const periods = new Set(['Advisory','1','2','3','4','5','CTSO','mine']);
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('Vary','Cookie');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
  const session=cookies(req)[COOKIE],period=String(req.query?.period||'');
  if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to view weather reports.'});
  if(!periods.has(period))return res.status(400).json({error:'Choose a division.'});
  const page=Number(req.query?.page??0);
  if(!Number.isInteger(page)||page<0||page>100)return res.status(400).json({error:'Invalid page.'});
  try {
    const data=await bridge({action:'auth-weather',session,period,page},25000);
    if([401,403,404].includes(data.status))return res.status(data.status).json({error:data.status===403?'You do not have access to this division.':data.status===404?'This division’s weather tab is not connected yet.':'Your sign-in has expired.'});
    if(period==='mine') {
      if(data.status!==200||!Array.isArray(data.periods)||!data.periods.every(value=>periods.has(value)&&value!=='mine'))throw new Error('Invalid weather access');
      return res.status(200).json({periods:data.periods});
    }
    if(data.status!==200||!Array.isArray(data.summary)||data.summary.length>5||!data.summary.every(row=>Array.isArray(row)&&row.length<=4&&row.every(value=>typeof value==='string'&&value.length<=200))||!Array.isArray(data.columns)||!Array.isArray(data.rows)||data.columns.length>26||data.rows.length>100||!data.rows.every(row=>Array.isArray(row)&&row.length<=26))throw new Error('Invalid weather data');
    return res.status(200).json({division:data.division,summary:data.summary,columns:data.columns,rows:data.rows,page,hasMore:data.hasMore===true});
  } catch(error){console.error('Weather request failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Weather reports are temporarily unavailable.'});}
}
