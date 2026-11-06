(() => {
 const sources=new Map();
 window.NestFlightTools={mount(root){for(const key of sources.keys())if(key.tagName==='IFRAME'&&!key.isConnected)sources.delete(key);for(const iframe of root.querySelectorAll('[data-flight-frame]')){const type=iframe.dataset.flightFrame,channel=crypto.randomUUID();iframe.src='/'+(type==='metar'?'metar':'notams')+'?'+new URLSearchParams({embedded:'1',return:channel});sources.set(iframe,{type,channel});}}};
 document.addEventListener('click',event=>{if(event.target.closest('[data-drone-lookup]')){const dialog=document.getElementById('safety-drone-dialog'),frame=document.getElementById('safety-drone-frame');if(!frame.getAttribute('src'))frame.src='/inventory?popup=drones';dialog.showModal();return;}const link=event.target.closest('[data-metar-popup],[data-notam-popup]');if(!link)return;const type=link.hasAttribute('data-metar-popup')?'metar':'notam',channel=crypto.randomUUID(),child=window.open('/'+(type==='metar'?'metar':'notams')+'?'+new URLSearchParams({return:channel}),'nest-'+type+'-lookup','popup,width=1180,height=880,resizable=yes,scrollbars=yes');if(child){event.preventDefault();sources.set(child,{type,channel});}});
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  let entry;for(const [source,value] of sources){if(event.source===(source.tagName==='IFRAME'?source.contentWindow:source)){entry=value;break;}}
  if(!entry||event.data?.type!=='nest-'+entry.type+'-picked'||event.data.channel!==entry.channel)return;
  const field=document.querySelector('#safety-flight-form [name="c'+(entry.type==='metar'?37:36)+'"]'),raw=event.data.raw,accepted=Boolean(field&&typeof raw==='string'&&raw.trim()&&raw.length<=3000);
  if(accepted){field.value=raw;document.getElementById('safety-form-status').textContent=(entry.type==='metar'?'METAR':'NOTAM findings')+' added to your weather answers.';}
  event.source.postMessage({type:'nest-'+entry.type+'-received',channel:entry.channel,accepted,message:'Open your Pre-Flight form, then try again.'},location.origin);
 });
 document.addEventListener('nest-auth-change',()=>{if(!window.NestAuth?.identity?.signedIn)sources.clear();});
})();
