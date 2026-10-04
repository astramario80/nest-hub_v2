import { COOKIE, cookies, validToken, bridge, districtEmail } from '../lib/nest-auth.mjs';
import { DIVISIONS } from '../lib/divisions.mjs';

// Only live leaders of the chosen division can retrieve its email groups.
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
  const period=String(req.query?.period||'');
  if(!Object.hasOwn(DIVISIONS,period))return res.status(400).json({error:'Choose a division.'});
  const session=cookies(req)[COOKIE];
  if(!validToken(session))return res.status(401).json({error:'Sign in to NEST to email your team.'});
  try{
    const access=await bridge({action:'auth-division-slides',operation:'access',session,period},45000);
    if(access.status===401)return res.status(401).json({error:'Your sign-in has expired.'});
    if(access.status!==200||!(access.isOwner===true||access.canManage===true||Array.isArray(access.roles)&&access.roles.some(role=>typeof role==='string'&&role.trim())))return res.status(access.status===503?503:403).json({error:'Email groups are available only to this division’s leadership team.'});
    const [directory,roster]=await Promise.all([
      bridge({action:'auth-leadership-directory',session},25000),
      bridge({action:'tracker',session,period},50000)
    ]);
    if(directory.status!==200||roster.status!==200||roster.period!==period||!Array.isArray(directory.leaders)||!Array.isArray(roster.students))throw new Error('Group records unavailable');
    const members=[...new Map(roster.students.filter(s=>s.active!==false&&districtEmail(s.email)&&typeof s.name==='string').map(s=>[districtEmail(s.email),{name:s.name,email:districtEmail(s.email)}])).values()];
    const emails=new Set(members.map(s=>s.email)),division=period==='CTSO'?'NEST Robotics':'Period '+period;
    const leaders=directory.leaders.filter(l=>l.division===division&&emails.has(districtEmail(l.email))&&typeof l.position==='string').map(l=>({name:[l.firstName,l.lastName].filter(Boolean).join(' '),email:districtEmail(l.email),position:l.position}));
    return res.status(200).json({period,members,leaders});
  }catch(error){console.error('Email group lookup failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Email groups could not load. Please try again.'});}
}
