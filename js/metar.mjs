import {decodeMetar,categories} from './metar-decoder.mjs';
const $=id=>document.getElementById('metar-'+id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const returnTarget=window.opener||(window.parent!==window?window.parent:null);if(new URLSearchParams(location.search).get('embedded')==='1')document.body.classList.add('metar-embedded');
const channel=new URLSearchParams(location.search).get('return')||'',canReturn=/^[a-f0-9-]{36}$/.test(channel)&&Boolean(returnTarget);
let current=null,sequence=0,pasted=false,returnTimer;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('metar-error',error);}
function render(report,{manual=false}={}){
 current=report;pasted=manual;$('report').hidden=false;$('report-title').textContent=report.station+(report.name?' · '+report.name:'');
 $('observed').textContent=(manual?'Pasted report · ':'Official AWC report · ')+new Date(report.observedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})+' Pacific';
 const age=Math.floor((Date.now()-Date.parse(report.observedAt))/60000);$('age').textContent=age>90?'This observation is '+age+' minutes old. Check the map for a newer report.':age < -10?'This observation time is in the future. Verify the date before using this report.':'';
 const map=new Map(categories.map(([key,label,color])=>[key,{label,color}]));
 $('raw').innerHTML=report.tokens.map(token=>`<span style="--metar-color:${map.get(token.key)?.color||'#8a9b91'}" title="${esc(map.get(token.key)?.label||'Report detail')}">${esc(token.text)}</span>`).join(' ');
 $('decoded').innerHTML=report.rows.map(row=>`<article class="metar-part" style="--metar-color:${row.color}"><h3>${esc(row.label)}</h3><code>${esc(row.code||'—')}</code><p>${esc(row.decoded)}</p></article>`).join('');
 $('other').textContent=report.other.length?'Other report details (shown without interpretation): '+report.other.join(' '):'';
 $('source').href='https://aviationweather.gov/data/metar/?ids='+encodeURIComponent(report.station);$('use').hidden=!canReturn;$('action-status').textContent='';
}
async function lookup(station){
 const seq=++sequence;$('station').value=station;$('report').hidden=true;current=null;$('decoded').replaceChildren();$('other').textContent='';status('Loading the latest METAR for '+station+'…');
 try{const response=await fetch('/api/metar?'+new URLSearchParams({station}),{cache:'no-cache',signal:AbortSignal.timeout(18000)}),report=await response.json();if(seq!==sequence)return;if(!response.ok)throw Error(report.error||'The weather report could not be loaded.');render(report);status('Report loaded. Select another station whenever you need.');}
 catch(error){if(seq===sequence)status(error.message,true);}
}
$('search').addEventListener('submit',event=>{event.preventDefault();const station=$('station').value.trim().toUpperCase();if(!/^[A-Z][A-Z0-9]{3}$/.test(station)){status('Enter a four-character station ID, such as KPLU.',true);return;}lookup(station);});
$('home').addEventListener('click',()=>lookup('KPLU'));
$('paste-form').addEventListener('submit',event=>{event.preventDefault();try{const decoded=decodeMetar($('pasted').value);sequence++;$('station').value=decoded.station;render(decoded,{manual:true});status('Pasted METAR decoded. Check its observation time before using it.');}catch(error){status(error.message,true);}});
$('copy').addEventListener('click',async()=>{if(!current)return;try{await navigator.clipboard.writeText(current.raw);$('action-status').textContent='METAR copied. Paste it into your pre-flight form.';}catch{$('action-status').textContent='Select the report text above and copy it with your keyboard.';}});
$('use').addEventListener('click',()=>{if(!current||!canReturn)return;$('use').disabled=true;returnTarget.postMessage({type:'nest-metar-picked',channel,raw:current.raw,station:current.station},location.origin);clearTimeout(returnTimer);returnTimer=setTimeout(()=>{$('use').disabled=false;$('action-status').textContent='The pre-flight form did not respond. Keep it open, or use Copy METAR to paste the report yourself.';},3000);});
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==returnTarget||event.data?.type!=='nest-metar-received'||event.data.channel!==channel)return;clearTimeout(returnTimer);$('use').disabled=false;$('action-status').textContent=event.data.accepted?'METAR added to your pre-flight form. You can return to the form now.':event.data.message||'Open your Pre-Flight form, then try again.';});
setInterval(()=>{if(!document.hidden&&current&&!pasted)lookup(current.station);},300000);
const initial=new URLSearchParams(location.search).get('station')?.toUpperCase();lookup(/^[A-Z][A-Z0-9]{3}$/.test(initial||'')?initial:'KPLU');
