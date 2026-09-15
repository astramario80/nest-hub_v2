import { parseLunchPdf } from '../lib/lunch-parser.mjs';
let cached=null;
export default async function handler(req,res) {
  if(req.method!=='GET') {res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const endpoint=process.env.LUNCH_BRIDGE_URL,token=process.env.LUNCH_BRIDGE_TOKEN;
  if(!endpoint || !token) return res.status(503).json({error:'Lunch assignments unavailable'});
  try {
    if(cached && Date.now()-cached.at<60000) return respond(res,cached.data);
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:AbortSignal.timeout(20000)});
    if(!response.ok) throw new Error('Bridge unavailable');
    const payload=await response.json();
    if(!payload.pdf || !payload.source?.name || payload.pdf.length>7*1024*1024) throw new Error('Invalid bridge response');
    const data={source:payload.source,...await parseLunchPdf(Buffer.from(payload.pdf,'base64'))};
    cached={at:Date.now(),data};return respond(res,data);
  } catch(error) {
    console.error('Lunch assignment update failed:',error.message);
    res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Lunch assignments temporarily unavailable'});
  }
}
function respond(res,data) {res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');return res.status(200).json(data);}
