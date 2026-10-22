import { withDiagnostics } from '../lib/diagnostics.mjs';
import { COOKIE, cookies, validToken, bridge, districtEmail } from '../lib/nest-auth.mjs';
import { DIVISIONS } from '../lib/divisions.mjs';
import { groupRecords } from '../lib/group-email-access.mjs';

// Student recipients stay division-scoped; all current leaders may reach building leadership.
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
    return res.status(200).json(await groupRecords(session,period,audience));
  }catch(error){if([401,403].includes(error.status))return res.status(error.status).json({error:error.message});console.error('Email group lookup failed',{kind:error?.name||'Error'});return res.status(503).json({error:'Email groups could not load. Please try again.'});}
}

export default withDiagnostics('division',handler);
