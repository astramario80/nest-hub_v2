import { COOKIE, cookies, validToken, bridge, districtEmail } from '../lib/nest-auth.mjs';
import { DIVISIONS } from '../lib/divisions.mjs';

// Only live leaders of the chosen division can retrieve its email groups.
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
  const period=String(req.query?.period||'');
  if(period!=='all'&&!Object.hasOwn(DIVISIONS,period))return res.status(400).json({error:'Choose a division.'});
  const session=cookies(req)[COOKIE];
  if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to email your team.'});
  try{
    const targets=period==='all'?Object.keys(DIVISIONS):[period];
    const access=await Promise.all(targets.map(async target=>({...await bridge({action:'auth-division-slides',operation:'access',session,period:target},45000),period:target})));
    if(access.some(a=>a.status===401))return res.status(401).json({error:'Your sign-in has expired.'});
    if(access.some(a=>![200,403].includes(a.status)))throw new Error('Division access unavailable');
    const included=access.filter(a=>a.status===200&&(a.isOwner===true||a.canManage===true||Array.isArray(a.roles)&&a.roles.some(role=>typeof role==='string'&&role.trim()))).map(a=>a.period);
    if(!included.length)return res.status(403).json({error:'Email groups are available only to the divisions where you are on the leadership team.'});
    const [directory,rosters]=await Promise.all([
      bridge({action:'auth-leadership-directory',session},25000),
      Promise.all(included.map(target=>bridge({action:'tracker',session,period:target},50000)))
    ]);
    if(directory.status!==200||!Array.isArray(directory.leaders)||rosters.some((r,i)=>r.status!==200||r.period!==included[i]||!Array.isArray(r.students)))throw new Error('Group records unavailable');
    const members=new Map(),leaders=[];
    rosters.forEach(roster=>{
      const current=roster.students.filter(s=>s.active!==false&&districtEmail(s.email)&&typeof s.name==='string');
      current.forEach(s=>members.set(districtEmail(s.email),{name:s.name,email:districtEmail(s.email)}));
      const emails=new Set(current.map(s=>districtEmail(s.email))),division=roster.period==='CTSO'?'NEST Robotics':'Period '+roster.period;
      directory.leaders.filter(l=>l.division===division&&emails.has(districtEmail(l.email))&&typeof l.position==='string').forEach(l=>leaders.push({name:[l.firstName,l.lastName].filter(Boolean).join(' '),email:districtEmail(l.email),position:l.position}));
    });
    return res.status(200).json({period,divisions:included,members:[...members.values()],leaders});
  }catch(error){console.error('Email group lookup failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Email groups could not load. Please try again.'});}
}
