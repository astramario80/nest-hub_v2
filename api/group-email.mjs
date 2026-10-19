import { withDiagnostics } from '../lib/diagnostics.mjs';
import { COOKIE, cookies, validToken, bridge, districtEmail } from '../lib/nest-auth.mjs';
import { DIVISIONS } from '../lib/divisions.mjs';

// Student recipients stay division-scoped; managers/executives may reach building leadership.
async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
  const period=String(req.query?.period||'');
  const audience=String(req.query?.audience||'division');
  if(!['division','leadership'].includes(audience)||audience==='leadership'&&period!=='all')return res.status(400).json({error:'Choose a supported email audience.'});
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
    const canReachBuildingLeadership=access.some(a=>a.status===200&&(a.isOwner===true||a.canManage===true||a.period==='CTSO'&&a.canManageRobotics===true||Array.isArray(a.roles)&&a.roles.some(role=>a.period==='CTSO'?/^(chief (executive|financial|operations|operating) officers?|executive vice-president)$/i.test(String(role).trim()):/^(division manager|assistant manager)$/i.test(String(role).trim()))));
    if(audience==='leadership'){
      if(!canReachBuildingLeadership)return res.status(403).json({error:'Building-wide leadership email is available to Division Managers, Assistant Managers, and NEST Robotics executives.'});
      const directory=await bridge({action:'auth-leadership-directory',session},25000);
      if(directory.status!==200||!Array.isArray(directory.leaders))throw new Error('Leadership directory unavailable');
      const leaders=directory.leaders.filter(l=>districtEmail(l.email)&&typeof l.position==='string'&&l.position.trim()&&/^(Period (1|2|3|4|5|7)|NEST Robotics)$/.test(l.division)).map(l=>({name:[l.firstName,l.lastName].filter(Boolean).join(' '),email:districtEmail(l.email),position:l.position,division:l.division}));
      return res.status(200).json({period,audience,divisions:included,canReachBuildingLeadership,members:[...new Map(leaders.map(l=>[l.email,{name:l.name,email:l.email}])).values()],leaders,gmailClientId:process.env.EMAIL_GOOGLE_CLIENT_ID||process.env.SERVICE_GOOGLE_CLIENT_ID||''});
    }
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
    return res.status(200).json({period,audience,divisions:included,canReachBuildingLeadership,members:[...members.values()],leaders,gmailClientId:process.env.EMAIL_GOOGLE_CLIENT_ID||process.env.SERVICE_GOOGLE_CLIENT_ID||''});
  }catch(error){console.error('Email group lookup failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Email groups could not load. Please try again.'});}
}

export default withDiagnostics('division',handler);
