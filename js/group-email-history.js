(() => {
 function init(){
  const host=document.querySelector('[data-hq-communications]'),composer=host?.querySelector('.group-email-inline');
  if(!host||!composer||host.dataset.emailHistoryInitialized)return;host.dataset.emailHistoryInitialized='true';
  const nav=document.createElement('div');nav.className='email-history-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Communications views');
  nav.innerHTML='<button type="button" role="tab" id="email-compose-tab" aria-selected="true" aria-controls="email-compose-panel">Compose</button><button type="button" role="tab" id="email-history-tab" aria-selected="false" aria-controls="email-history-panel" tabindex="-1">Sent history</button>';
  composer.id='email-compose-panel';composer.setAttribute('role','tabpanel');composer.setAttribute('aria-labelledby','email-compose-tab');
  const panel=document.createElement('section');panel.id='email-history-panel';panel.className='group-email-history';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','email-history-tab');
  panel.innerHTML='<div class="email-history-heading"><h2>Your sent emails</h2><button type="button" data-history-refresh>Refresh</button></div><p>New NEST messages are available here for 45 days. Only your own sent emails appear.</p><p class="email-history-note">Open rates are approximate. Tracking images may be blocked or loaded automatically, so an observed open is not proof that someone read the email.</p><p data-history-status role="status" aria-live="polite"></p><div class="email-history-layout"><div><div data-history-list></div><button type="button" data-history-more hidden>Load older emails</button></div><section data-history-detail aria-label="Selected email"></section></div>';
  host.prepend(nav);host.append(panel);
  const tabs=[...nav.querySelectorAll('button')],status=panel.querySelector('[data-history-status]'),list=panel.querySelector('[data-history-list]'),detail=panel.querySelector('[data-history-detail]'),more=panel.querySelector('[data-history-more]'),refresh=panel.querySelector('[data-history-refresh]');
  let generation=0,detailGeneration=0,nextOffset=0,loaded=false,loading=false,selected=false,seen=new Set();
  const identity=()=>window.NestAuth?.identity?.signedIn&&window.NestDivisionHQ?.allowed!==false;
  const date=value=>{const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toLocaleString():'';};
  async function records(query){const response=await fetch('/api/group-email-history?'+new URLSearchParams(query),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(90000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Your email history could not load.');return data;}
  function switchTab(index){selected=index===1;composer.hidden=selected;panel.hidden=!selected;tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});if(selected&&!loaded&&!loading)load(false);}
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>switchTab(index));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?1:1-index;switchTab(target);tabs[target].focus();});});
  async function load(append){
   if(!identity()||loading)return;const own=++generation;loading=true;refresh.disabled=more.disabled=true;status.textContent='Loading your sent emails…';
   if(!append){list.replaceChildren();detail.replaceChildren();seen=new Set();nextOffset=0;detailGeneration++;}
   try{
    const data=await records({offset:String(append?nextOffset:0)});if(own!==generation||!identity())return;
    for(const item of data.messages){
     if(seen.has(item.requestId))continue;seen.add(item.requestId);
     const button=document.createElement('button');button.type='button';button.className='email-history-item';
     const title=document.createElement('strong'),meta=document.createElement('span');title.textContent=item.subject;meta.textContent=date(item.sentAt)+(item.testing?' · Test email':'');button.append(title,meta);button.addEventListener('click',()=>show(item.requestId,button));list.append(button);
    }
    nextOffset=data.nextOffset;more.hidden=!data.hasMore;loaded=true;status.textContent=seen.size?seen.size+' sent message'+(seen.size===1?'':'s')+' shown. Select one to see its content and open activity.':'No NEST emails in your history yet. Messages sent from Gmail before this update are not included.';
   }catch(error){if(own===generation&&identity())status.textContent=error.message;}
   finally{if(own===generation){loading=false;refresh.disabled=more.disabled=false;}}
  }
  async function show(requestId,button){
   if(!identity())return;const own=++detailGeneration,epoch=generation;detail.textContent='Loading message and open activity…';list.querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
   try{
    const data=await records({requestId});if(own!==detailGeneration||epoch!==generation||!identity())return;
    detail.replaceChildren();const heading=document.createElement('h3');heading.textContent=data.subject;
    const sent=document.createElement('p');sent.textContent=date(data.sentAt)+(data.testing?' · Test email':'');
    const metrics=document.createElement('p');metrics.className='email-history-metrics';metrics.textContent=data.tracking?data.openRate+'% observed open rate · '+data.observedOpens+' of '+data.accepted+' recipients':'Open tracking was not enabled for this message.';
    const counts=document.createElement('p');counts.textContent=data.accepted+' recipient'+(data.accepted===1?'':'s')+' accepted by Postmark'+(data.selected>data.accepted?' out of '+data.selected+' selected':'')+'. Acceptance does not guarantee inbox delivery.';
    const recipients=document.createElement('ul');recipients.className='email-history-recipients';
    data.recipients.forEach(recipient=>{const item=document.createElement('li');item.textContent=recipient.email+' — '+(recipient.openedAt?'Observed open: '+date(recipient.openedAt):data.tracking?'No open detected':'Tracking unavailable');recipients.append(item);});
    const contentHeading=document.createElement('h4');contentHeading.textContent='Message content';
    const frame=document.createElement('iframe');frame.title='Sent email content';frame.setAttribute('sandbox','');frame.referrerPolicy='no-referrer';frame.className='email-history-content';
    frame.srcdoc='<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src \'none\'; base-uri \'none\'; form-action \'none\'"><style>body{font-family:Arial,sans-serif;line-height:1.6;overflow-wrap:anywhere;padding:12px;color:#172238}a{pointer-events:none}</style></head><body>'+data.html+'</body></html>';
    detail.append(heading,sent,metrics,counts,recipients,contentHeading,frame);
   }catch(error){if(own===detailGeneration&&epoch===generation&&identity()){detail.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.textContent='Try again';retry.addEventListener('click',()=>show(requestId,button));detail.append(document.createElement('br'),retry);}}
  }
  function reset(){generation++;detailGeneration++;loading=false;loaded=false;nextOffset=0;seen=new Set();list.replaceChildren();detail.replaceChildren();status.textContent='';more.hidden=true;refresh.disabled=false;more.disabled=false;}
  refresh.addEventListener('click',()=>load(false));more.addEventListener('click',()=>load(true));
  document.addEventListener('nest-hq-tab-change',event=>{if(event.detail?.tab==='communications')switchTab(0);});
  document.addEventListener('nest-email-sent',()=>{loaded=false;if(selected)load(false);});
  document.addEventListener('nest-auth-change',reset);document.addEventListener('nest-hq-access-revoked',reset);window.addEventListener('pagehide',reset);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
