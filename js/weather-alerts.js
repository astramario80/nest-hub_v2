(() => {
 if(window.NestWeatherAlerts||!window.NestAuth)return;
 let identity='',cursor='',eligible=false,polling=false,generation=0,timer,events=[],panel,presentedKey='',seen=new Set();
 const style=document.createElement('style');style.textContent=`.nest-weather-alert{position:fixed;inset:24px auto auto 50%;transform:translateX(-50%);margin:0;text-align:left;z-index:10020;max-width:680px;width:calc(100% - 32px);max-height:calc(100dvh - 48px);overflow:auto;box-sizing:border-box;padding:26px;background:#fff0c2;color:#412b12;border:4px solid #d87513;border-radius:16px;box-shadow:0 12px 60px #0009}.nest-weather-alert h2{font-size:1.45rem;margin:0 0 14px;color:#793600}.nest-weather-alert p{margin:12px 0;overflow-wrap:anywhere}.nest-weather-alert .nest-weather-alert-student{font-size:1.3rem;font-weight:700}.nest-weather-alert .nest-weather-alert-emotion{font-size:1.2rem;font-weight:700}.nest-weather-alert button,.nest-weather-alert a{display:inline-block;padding:10px 14px;margin:8px 8px 0 0;border:1px solid #8c4d15;border-radius:7px;background:#fff;color:#582800;text-decoration:none;font:inherit;font-weight:600}.nest-weather-alert .nest-weather-alert-call{background:#713b12;color:#fff}.nest-weather-alert:focus{outline:3px solid #793600}@media(max-width:600px){.nest-weather-alert{inset:12px auto auto 50%;padding:18px;max-height:calc(100dvh - 24px)}}`;document.head.append(style);
 const key=()=> 'nest-weather-alert-seen:'+identity;
 function persist(){try{localStorage.setItem(key(),JSON.stringify([...seen].slice(-500)));}catch{}}
 function render(){
  let dialogs;try{dialogs=[...document.querySelectorAll('dialog:modal')];}catch{dialogs=[];}if(!dialogs.length)dialogs=[...document.querySelectorAll('dialog[open]')];
  const host=dialogs.at(-1)||document.body,signature=events.map(x=>x.id).join('|');
  if(signature===presentedKey&&panel?.parentElement===host)return;presentedKey=signature;
  panel?.remove();panel=null;if(!events.length)return;const item=events[0];
  panel=document.createElement('section');panel.className='nest-weather-alert';panel.setAttribute('role','alert');panel.setAttribute('aria-label',item.test?'Test support alert':'Student support alert');
  const heading=document.createElement('h2');heading.textContent=item.test?'TEST — Support alert':'A student may welcome support';
  const content=document.createElement('p');content.className='nest-weather-alert-student';content.textContent='Student: '+item.student;
  const emotion=document.createElement('p');emotion.className='nest-weather-alert-emotion';emotion.textContent='Emotion: '+item.emotion;
  const division=document.createElement('p');division.textContent=item.period==='CTSO'?'CTSO':item.period==='Advisory'?'Advisory':'Division '+item.period;
  const time=document.createElement('p');time.textContent=new Date(item.at).toLocaleString()+(events.length>1?` · ${events.length} alerts waiting`:'');
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Acknowledge';dismiss.addEventListener('click',()=>{seen.add(item.id);persist();events.shift();render();});
  const link=document.createElement('a');link.href='/weather';link.textContent='Open weather reports';
  const counselor=document.createElement('a');const url=String(item.counselor?.url||'');counselor.href=/^https:\/\/(?:calendar\.google\.com|calendar\.app\.google|[a-z0-9-]+\.youcanbook\.me)\//i.test(url)?url:'https://gkhs.bethelsd.org/counseling-career-centers/counseling-centers';counselor.target='_blank';counselor.rel='noopener noreferrer';counselor.textContent=item.counselor&&!item.counselor.unmatched&&counselor.href===url?'Schedule with '+item.counselor.name:'Find counselor appointment';
  const phone=document.createElement('a');phone.className='nest-weather-alert-call';phone.href='tel:+12538006176';phone.textContent='Call counselor office: 253-800-6176 (x6176)';
  panel.append(heading,content,emotion,division,time,counselor,phone,dismiss,link);host.append(panel);
  // The top layer keeps alerts visible above announcements and resource dialogs.
  // Nest within an active modal so its inert background does not disable alert controls.
  if(typeof panel.showPopover==='function'){panel.setAttribute('popover','manual');try{panel.showPopover();}catch{panel.removeAttribute('popover');}}
 }
 async function request(operation,fields={}){const response=await fetch('/api/weather-native?'+new URLSearchParams({operation,...fields}),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(55000)});if(!response.ok)throw new Error('Support alerts unavailable');return response.json();}
 async function check(){
  if(polling||!eligible||document.visibilityState==='hidden')return;polling=true;const current=generation;
  try{const data=await request('alerts',{since:cursor});if(current!==generation)return;
   eligible=data.eligible===true;if(!eligible){events=[];render();return;}const known=new Set(events.map(x=>x.id));
   for(const event of data.events||[])if(!seen.has(event.id)&&!known.has(event.id)){events.push(event);known.add(event.id);}
   // Cursor advances only after all returned events have been queued. Data is never persisted locally.
   cursor=data.cursor||cursor;render();
  }catch{ /* Retain cursor and retry; do not dismiss an unread alert on a network failure. */ }
  finally{polling=false;clearTimeout(timer);if(eligible)timer=setTimeout(check,8000);}
 }
 async function load(){
  const current=++generation;clearTimeout(timer);eligible=false;cursor='';events=[];render();identity='';seen=new Set();
  if(!window.NestAuth.identity?.signedIn)return;
  identity=String(window.NestAuth.identity.email||window.NestAuth.identity.username||'');try{const saved=JSON.parse(localStorage.getItem(key())||'[]');if(Array.isArray(saved))seen=new Set(saved.filter(x=>typeof x==='string').slice(-500));}catch{}
  try{const data=await request('alert-access');if(current!==generation)return;eligible=data.eligible===true;if(eligible)check();}catch{if(current===generation)timer=setTimeout(load,30000);}
 }
 new MutationObserver(records=>{if(events.length&&records.some(record=>record.target.matches?.('dialog')||[...record.addedNodes,...record.removedNodes].some(node=>node.matches?.('dialog'))))render();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 window.NestWeatherAlerts={check};document.addEventListener('nest-auth-change',load);window.NestAuth.ready.then(load);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){clearTimeout(timer);check();}});
 window.addEventListener('storage',event=>{if(event.key!==key())return;try{seen=new Set(JSON.parse(event.newValue||'[]'));events=events.filter(x=>!seen.has(x.id));render();}catch{}});
})();
