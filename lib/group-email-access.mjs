import {bridge,districtEmail} from './nest-auth.mjs';
import {DIVISIONS} from './divisions.mjs';
export async function groupRecords(session,period,audience){
 const data=await bridge({action:'auth-group-email-access',session,period,audience},60000);
 if([401,403].includes(data.status))throw Object.assign(new Error(data.status===401?'Your sign-in has expired.':'Email groups are available only where you are on the leadership team.'),{status:data.status});
 if(data.status!==200||data.period!==period||data.audience!==audience||!Array.isArray(data.divisions)||!data.divisions.length||data.divisions.some(p=>!Object.hasOwn(DIVISIONS,p))||period!=='all'&&data.divisions.some(p=>p!==period)||!Array.isArray(data.members)||!Array.isArray(data.leaders)||data.members.length>7000||data.leaders.length>1000||data.members.some(m=>!districtEmail(m.email)||typeof m.name!=='string')||data.leaders.some(l=>!districtEmail(l.email)||typeof l.name!=='string'||typeof l.position!=='string'))throw new Error('Group records unavailable');
 return {period,audience,divisions:data.divisions,canReachBuildingLeadership:true,members:data.members.map(({name,email})=>({name,email})),leaders:data.leaders.map(({name,email,position,division})=>({name,email,position,...(audience==='leadership'?{division}:{})})),emailService:{ready:Boolean(process.env.POSTMARK_SERVER_TOKEN&&process.env.POSTMARK_FROM_EMAIL&&process.env.NEST_EMAIL_ENABLED==='true'),from:process.env.POSTMARK_FROM_EMAIL||'communications@gknest.org'}};
}
