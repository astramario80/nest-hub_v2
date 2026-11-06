import {decodeMetar} from '../js/metar-decoder.mjs';
export function createMetarHandler(fetcher=fetch){return async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use a GET request.'});}
 const station=String(req.query?.station||'KPLU').trim().toUpperCase();if(!/^[A-Z][A-Z0-9]{3}$/.test(station))return res.status(400).json({error:'Enter a four-character station ID, such as KPLU.'});
 try{
  const url=new URL('https://aviationweather.gov/api/data/metar');url.searchParams.set('ids',station);url.searchParams.set('format','json');
  const response=await fetcher(url,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(response.status===204)return res.status(404).json({error:'No current METAR is available for '+station+'. Choose another station on the map.'});
  if(!response.ok)throw Error('Weather source unavailable');
  const payload=await response.json(),report=Array.isArray(payload)?payload.find(row=>row.icaoId===station&&typeof row.rawOb==='string'):null;
  if(!report)return res.status(404).json({error:'No current METAR is available for '+station+'. Choose another station on the map.'});
  const observedAt=Number.isFinite(report.obsTime)?new Date(report.obsTime*1000).toISOString():report.reportTime;
  const decoded=decodeMetar(report.rawOb,{observedAt});
  if(decoded.station!==station)throw Error('Station mismatch');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=60');
  return res.status(200).json({...decoded,name:typeof report.name==='string'?report.name.slice(0,200):station,latitude:Number.isFinite(report.lat)?report.lat:null,longitude:Number.isFinite(report.lon)?report.lon:null,fetchedAt:new Date().toISOString(),source:'https://aviationweather.gov/data/metar/?ids='+station});
 }catch{return res.status(503).json({error:'The Aviation Weather Center report could not be loaded. Try again or copy a METAR from the map to decode it here.'});}
};}
export default createMetarHandler();
