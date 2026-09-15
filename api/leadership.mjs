export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
  const endpoint=process.env.SPINNER_BRIDGE_URL,token=process.env.SPINNER_BRIDGE_TOKEN;
  try{
    if(!endpoint||!token)throw new Error('Service unavailable');
    const signal=AbortSignal.timeout(25000);
    let response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action:'leadership'}),redirect:'manual',signal});
    if([301,302,303].includes(response.status)){
      const target=new URL(response.headers.get('location'));
      if(target.protocol!=='https:'||target.hostname!=='script.googleusercontent.com')throw new Error('Invalid response');
      response=await fetch(target,{redirect:'error',signal});
    }
    if(!response.ok)throw new Error('Service unavailable');
    const data=await response.json();
    if(data.status!==200||!Array.isArray(data.leaders)||!data.leaders.length)throw new Error('Directory unavailable');
    const leaders=data.leaders.map(({division,position,firstName})=>({division,position,firstName}));
    return res.status(200).json({leaders});
  }catch(_){return res.status(503).json({error:'Leadership data is temporarily unavailable. Please try again.'});}
}
