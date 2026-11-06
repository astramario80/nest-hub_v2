const params=new URLSearchParams(location.search),channel=params.get('return')||'',target=window.opener||(window.parent!==window?window.parent:null);
if(params.get('embedded')==='1')document.body.classList.add('metar-embedded');
const text=document.getElementById('notam-text'),status=document.getElementById('notam-status');document.getElementById('notam-use').hidden=!target||!/^[a-f0-9-]{36}$/.test(channel);
document.getElementById('notam-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text.value);status.textContent='NOTAM findings copied.';}catch{status.textContent='Select your findings and copy them with your keyboard.';}});
document.getElementById('notam-selection').addEventListener('submit',event=>{event.preventDefault();if(target&&text.value.trim())target.postMessage({type:'nest-notam-picked',channel,raw:text.value.trim()},location.origin);});
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==target||event.data?.type!=='nest-notam-received'||event.data.channel!==channel)return;status.textContent=event.data.accepted?'NOTAM findings added to your pre-flight form.':event.data.message;});

document.getElementById('notam-launch').addEventListener('click',event=>{event.preventDefault();window.open(event.currentTarget.href,'nest-faa-notams','popup,width=1200,height=900,resizable=yes,scrollbars=yes,noopener');});
document.getElementById('notam-embedded-option').addEventListener('toggle',event=>{const frame=document.getElementById('notam-faa-frame');if(event.currentTarget.open&&!frame.getAttribute('src'))frame.src=frame.dataset.src;});
