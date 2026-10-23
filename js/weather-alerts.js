(() => {
 if(window.NestWeatherAlerts||!window.NestAuth)return;
 let identity='',cursor='',eligible=false,polling=false,generation=0,timer,events=[],panel,seen=new Set();
 const style=document.createElement('style');style.textContent=`.nest-weather-alert{position:fixed;right:20px;bottom:20px;z-index:10020;max-width:430px;width:calc(100% - 40px);box-sizing:border-box;padding:22px;background:#17364b;color:#fff;border:2px solid #ffc069;border-radius:14px;box-shadow:0 12px 48px #0008}.nest-weather-alert h2{font-size:1.15rem;margin:0 0 10px}.nest-weather-alert p{margin:10px 0;overflow-wrap:anywhere}.nest-weather-alert button,.nest-weather-alert a{display:inline-block;padding:9px 14px;margin:8px 8px 0 0;border:1px solid #ffd49a;border-radius:7px;background:#fff;color:#152c3c;text-decoration:none;font:inherit}.nest-weather-alert:focus{outline:3px solid #fff}`;document.head.append(style);
 const key=()=> 'nest-weather-alert-seen:'+identity;
 function persist(){try{localStorage.setItem(key(),JSON.stringify([...seen].slice(-500)));}catch{}}
 function render(){
  panel?.remove();panel=null;if(!events.length)return;const item=events[0];
  panel=document.createElement('section');panel.className='nest-weather-alert';panel.setAttribute('role','alert');panel.setAttribute('aria-label',item.test?'Test support alert':'Student support alert');
  const heading=document.createElement('h2');heading.textContent=item.test?'TEST — Support alert':'A student may welcome support';
  const content=document.createElement('p');content.textContent=`${item.student} · ${item.period==='CTSO'?'CTSO':'Division '+item.period} · ${item.emotion}`;
  const time=document.createElement('p');time.textContent=new Date(item.at).toLocaleString()+(events.length>1?` · ${events.length} alerts waiting`:'');
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Acknowledge';dismiss.addEventListener('click',()=>{seen.add(item.id);persist();events.shift();render();});
  const link=document.createElement('a');link.href='/weather';link.textContent='Open weather reports';
  panel.append(heading,content,time,dismiss,link);document.body.append(panel);
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
 window.NestWeatherAlerts={check};document.addEventListener('nest-auth-change',load);window.NestAuth.ready.then(load);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){clearTimeout(timer);check();}});
 window.addEventListener('storage',event=>{if(event.key!==key())return;try{seen=new Set(JSON.parse(event.newValue||'[]'));events=events.filter(x=>!seen.has(x.id));render();}catch{}});
})();
