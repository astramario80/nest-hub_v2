import { withDiagnostics } from '../lib/diagnostics.mjs';
import { COOKIE, cookies, validToken, bridge, originAllowed, verifiedIdentity } from '../lib/nest-auth.mjs';
const periods=new Set(['1','2','3','4','5','7','CTSO','mine']);
const ratings=value=>Array.isArray(value)&&value.length===4&&value.every(x=>x===null||(Number.isInteger(x)&&x>=1&&x<=4));
async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='POST') {
    if(!originAllowed(req))return res.status(403).json({error:'This action is unavailable.'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(400).json({error:'Invalid request.'});
    let body=req.body;
    try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid request.'});}
    if(!body||Array.isArray(body)||JSON.stringify(body).length>8192||!['assign','partner','review'].includes(body.action)||!periods.has(body.period)||body.period==='mine')return res.status(400).json({error:'Invalid request.'});
    if(body.action==='assign'&&(!Number.isInteger(body.row)||body.row<3||body.row>10000))return res.status(400).json({error:'Invalid assignment.'});
    if(body.action==='review'&&(!/^[a-f0-9]{64}$/.test(body.key||'')||!/^[a-f0-9]{64}$/.test(body.revision||'')||typeof body.notes!=='string'||body.notes.length>5000||!ratings(body.scores)))return res.status(400).json({error:'Use four ratings from 1 to 4 and notes up to 5,000 characters.'});
    const session=cookies(req)[COOKIE];
    if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to manage hiring.'});
    try{
      const payload=body.action==='review'?{key:body.key,revision:body.revision,notes:body.notes,scores:body.scores}:{row:body.row,position:body.position,expectedName:body.expectedName,expectedEmail:body.expectedEmail,studentEmail:body.studentEmail};
      const data=await bridge({action:'auth-hiring-'+body.action,session,period:body.period,...payload},45000);
      if(data.status===200)return res.status(200).json(body.action==='review'?{revision:data.revision}:{name:data.name,email:data.email,sharingQueued:data.sharingQueued===true});
      if([400,401,403,404,409].includes(data.status))return res.status(data.status).json({error:data.status===409?'This record changed. Reload applications before saving again.':data.status===403?'Only this division’s managers may change hiring records.':data.status===401?'Your sign-in has expired.':'This student, application or division is unavailable.'});
      throw new Error('Invalid hiring save response');
    }catch(error){console.error('Hiring save failed',{kind:error?.name||'Error'});return res.status(503).json({error:'The change could not be confirmed. Reload before trying again.'});}
  }
  if(req.method!=='GET'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
  const session=cookies(req)[COOKIE],period=String(req.query?.period||'mine'),page=Number(req.query?.page??0);
  if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to review applications.'});
  if(!periods.has(period)||!Number.isInteger(page)||page<0||page>10)return res.status(400).json({error:'Invalid division or page.'});
  try {
    const readStarted=Date.now();
    const data=await bridge({action:'auth-hiring-view',session,period,page},45000);
    res.setHeader('Server-Timing','school;dur='+(Date.now()-readStarted));
    if([401,403,404].includes(data.status))return res.status(data.status).json({error:data.status===403?'You do not have hiring access for this division.':data.status===404?'This division’s hiring workbook is not connected.':'Your sign-in has expired.'});
    if(period==='mine') {
      if(data.status!==200||!Array.isArray(data.periods)||!data.periods.every(value=>periods.has(value)&&value!=='mine'))throw new Error('Invalid hiring access list');
      return res.status(200).json({periods:data.periods});
    }
    if(data.status!==200||!Array.isArray(data.columns)||!Array.isArray(data.applications)||!Array.isArray(data.team)||!Array.isArray(data.candidates)||!Array.isArray(data.reviews)||!Array.isArray(data.positions)||data.positions.length>50||!data.positions.every(value=>typeof value==='string'&&value.length<=100)||data.columns.length>8||data.applications.length>100||data.team.length>10000||data.candidates.length>1000||!data.applications.every(row=>Array.isArray(row)&&row.length<=8)||!data.team.every(row=>Array.isArray(row)&&row.length<=3)||!data.candidates.every(item=>typeof item.name==='string'&&typeof item.email==='string')||data.reviews.length!==data.applications.length||!data.reviews.every(item=>/^[a-f0-9]{64}$/.test(item.key)&&/^[a-f0-9]{64}$/.test(item.revision)&&typeof item.notes==='string'&&ratings(item.scores)))throw new Error('Invalid hiring view');
    return res.status(200).json({identity:verifiedIdentity(data.identity),division:data.division,canManage:data.canManage===true,columns:data.columns,applications:data.applications,reviews:data.reviews,team:data.team,positions:data.positions,candidates:data.canManage===true?data.candidates:[],page,hasMore:data.hasMore===true});
  }catch(error){console.error('Hiring view request failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Applications are temporarily unavailable.'});}
}

export default withDiagnostics('hiring',handler);
