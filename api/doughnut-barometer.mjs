import { bridge, COOKIE, cookies, validToken } from '../lib/nest-auth.mjs';

const names=['Period 7','Period 1','Period 2','Period 3','Period 4','Period 5'];
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
  try {
    const requested=req.query?.comments==='1';
    const rawSession=cookies(req)[COOKIE];
    const session=requested&&validToken(rawSession)?rawSession:'';
    const data=await bridge(session?{action:'doughnut-barometer',session}:{action:'doughnut-barometer'},45000);
    if(data.status!==200||typeof data.active!=='boolean'){console.error('Barometer bridge response rejected',{status:data.status,activeType:typeof data.active});throw new Error('Invalid barometer response');}
    if(!data.active)return res.status(200).json({active:false});
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data.start)||!/^\d{4}-\d{2}-\d{2}$/.test(data.end)||
      !Array.isArray(data.periods)||data.periods.length!==names.length||
      !data.periods.every((item,index)=>item.name===names[index]&&typeof item.average==='number'&&Number.isFinite(item.average)&&item.average>=0&&item.average<=10))throw new Error('Invalid barometer summary');
    if(typeof data.announcementReady!=='boolean')throw new Error('Invalid barometer announcement');
    const commentsAuthorized=Boolean(session&&data.commentsAuthorized===true);
    let comments=[];
    if(commentsAuthorized) {
      if(!Array.isArray(data.comments)||data.comments.length>500||!data.comments.every(note=>names.includes(note.period)&&typeof note.text==='string'&&note.text.length>0&&note.text.length<=2000))throw new Error('Invalid barometer comments');
      comments=data.comments;
    }
    return res.status(200).json({active:true,start:data.start,end:data.end,periods:data.periods,commentsAuthorized,comments,announcementReady:data.announcementReady});
  } catch(error) {
    console.error('Doughnut Barometer request failed',{kind:error?.name||'Error',reason:error?.message});
    return res.status(503).json({error:'The Doughnut Barometer is temporarily unavailable.'});
  }
}
