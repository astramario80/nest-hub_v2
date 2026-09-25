import { COOKIE, cookies, validToken, bridge, originAllowed } from '../lib/nest-auth.mjs';

const periods=new Set(['1','2','3','4','5','7','CTSO','mine']);
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('Vary','Cookie');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='POST') {
    if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
    let body=req.body;
    try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid request.'});}
    if(!body||Array.isArray(body)||JSON.stringify(body).length>1024||body.action!=='assign'||!periods.has(body.period)||body.period==='mine'||!Number.isInteger(body.row)||body.row<3||body.row>20)return res.status(400).json({error:'Invalid assignment.'});
    const session=cookies(req)[COOKIE];
    if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to manage hiring.'});
    try{
      const data=await bridge({action:'auth-hiring-assign',session,period:body.period,row:body.row,position:body.position,expectedName:body.expectedName,expectedEmail:body.expectedEmail,studentEmail:body.studentEmail},30000);
      if(data.status===200)return res.status(200).json({name:data.name,email:data.email});
      if([400,401,403,404,409].includes(data.status))return res.status(data.status).json({error:data.status===409?'This team position or dropdown changed. Refresh before saving.':data.status===403?'Only this division’s managers may assign team members.':data.status===401?'Your sign-in has expired.':'This student or division is unavailable.'});
      throw new Error('Invalid assignment response');
    }catch(error){console.error('Hiring assignment request failed',{kind:error?.name||'Error'});return res.status(503).json({error:'The assignment could not be saved. Please try again.'});}
  }
  if(req.method!=='GET'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
  const session=cookies(req)[COOKIE],period=String(req.query?.period||'mine'),page=Number(req.query?.page??0);
  if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to review applications.'});
  if(!periods.has(period)||!Number.isInteger(page)||page<0||page>10)return res.status(400).json({error:'Invalid division or page.'});
  try {
    const data=await bridge({action:'auth-hiring-view',session,period,page},30000);
    if([401,403,404].includes(data.status))return res.status(data.status).json({error:data.status===403?'You do not have hiring access for this division.':data.status===404?'This division’s hiring workbook is not connected.':'Your sign-in has expired.'});
    if(period==='mine') {
      if(data.status!==200||!Array.isArray(data.periods)||!data.periods.every(value=>periods.has(value)&&value!=='mine'))throw new Error('Invalid hiring access list');
      return res.status(200).json({periods:data.periods});
    }
    if(data.status!==200||!Array.isArray(data.columns)||!Array.isArray(data.applications)||!Array.isArray(data.team)||!Array.isArray(data.candidates)||data.columns.length>8||data.applications.length>100||data.team.length>18||data.candidates.length>1000||!data.applications.every(row=>Array.isArray(row)&&row.length<=8)||!data.team.every(row=>Array.isArray(row)&&row.length<=3)||!data.candidates.every(item=>typeof item.name==='string'&&typeof item.email==='string'))throw new Error('Invalid hiring view');
    return res.status(200).json({division:data.division,canManage:data.canManage===true,columns:data.columns,applications:data.applications,team:data.team,candidates:data.canManage===true?data.candidates:[],page,hasMore:data.hasMore===true});
  }catch(error){console.error('Hiring view request failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Applications are temporarily unavailable.'});}
}
