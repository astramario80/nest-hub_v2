(() => {
 const root=document.querySelector('.home-film'),track=root?.querySelector('.home-film-track'),toggle=document.querySelector('.home-film-toggle');if(!root||!track||!toggle)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches,identity=null,controller=null,expiry=null,animation=0,last=0,offset=0,items=[],cursor=0,generation=0;
 const active=()=>Boolean(identity)&&!paused&&!document.hidden;
 function controls(){toggle.textContent=paused?'▶ Play NEST moments':'Ⅱ Pause NEST moments';toggle.setAttribute('aria-pressed',String(paused));}
 function playback(){const running=active();for(const video of track.querySelectorAll('video')){if(running&&video.dataset.visible==='true')video.play().catch(()=>{});else video.pause();}if(running&&!animation){last=0;animation=requestAnimationFrame(tick);}else if(!running){cancelAnimationFrame(animation);animation=0;}controls();}
 function clear(){generation++;identity=null;controller?.abort();controller=null;clearTimeout(expiry);cancelAnimationFrame(animation);animation=0;for(const video of track.querySelectorAll('video')){video.pause();video.removeAttribute('src');video.load();}track.replaceChildren();track.style.transform='';root.hidden=true;toggle.hidden=true;offset=0;items=[];}
 // Browser timers overflow above about 24.8 days; recheck long sessions in safe steps.
 function scheduleExpiry(){clearTimeout(expiry);if(!identity)return;const remaining=identity.expires-Date.now();if(remaining<=0){clear();return;}expiry=setTimeout(scheduleExpiry,Math.min(remaining,2147483647));}
 function frame(){
  const item=items[cursor++%items.length],figure=document.createElement('div');figure.className='home-film-frame';
  const media=document.createElement(item.type.startsWith('video/')?'video':'img');
  if(media.tagName==='VIDEO'){media.muted=true;media.defaultMuted=true;media.loop=true;media.playsInline=true;media.preload='none';media.setAttribute('muted','');}else{media.alt='';media.decoding='async';}
  media.dataset.src=item.url;media.addEventListener('error',()=>{figure.remove();if(items.length>1)items=items.filter(i=>i.url!==item.url);if(!track.children.length){root.hidden=true;toggle.hidden=true;}},{once:true});
  const label=document.createElement('span');label.textContent=item.division;figure.append(media,label);return figure;
 }
 function visible(){const width=innerWidth;for(const figure of track.children){const bounds=figure.getBoundingClientRect(),media=figure.firstElementChild,show=bounds.right>0&&bounds.left<width;media.dataset.visible=String(show);if(bounds.right>-100&&bounds.left<width+100&&!media.getAttribute('src'))media.src=media.dataset.src;if(media.tagName==='VIDEO'){if(show&&active()){if(media.paused)media.play().catch(()=>{});}else media.pause();}}}
 function tick(now){animation=0;if(!active())return;const dt=last?Math.min(now-last,64):0;last=now;offset+=dt*.025;const first=track.firstElementChild;if(first){const stride=first.getBoundingClientRect().width+18;if(offset>=stride){offset-=stride;const media=first.firstElementChild;if(media.tagName==='VIDEO'){media.pause();media.removeAttribute('src');media.load();}first.remove();track.append(frame());}}track.style.transform=`translate3d(${-offset}px,0,0)`;visible();animation=requestAnimationFrame(tick);}
 async function update(value){
  if(!value?.signedIn||value.expires<=Date.now()){clear();return;}
  if(identity?.username===value.username&&identity?.expires===value.expires)return;
  clear();identity=value;const version=generation;controller=new AbortController();scheduleExpiry();
  try{const response=await fetch('/api/marketing-film',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Media unavailable');const data=await response.json();if(version!==generation)return;items=(data.items||[]).filter(i=>typeof i.url==='string'&&i.url.startsWith('/api/marketing-film?file=')&&/^(image|video)\//.test(i.type));if(!items.length)return;cursor=Math.floor(Math.random()*items.length);for(let i=0;i<Math.ceil(innerWidth/260)+2;i++)track.append(frame());root.hidden=false;toggle.hidden=false;visible();playback();}catch{if(version===generation)clear();}
 }
 toggle.addEventListener('click',()=>{paused=!paused;playback();});
 reduced.addEventListener('change',()=>{paused=reduced.matches;playback();});document.addEventListener('visibilitychange',()=>{if(identity?.expires<=Date.now())clear();else{visible();playback();}});window.addEventListener('resize',visible);window.addEventListener('pagehide',clear);
 document.addEventListener('nest-auth-change',event=>update(event.detail));window.NestAuth?.ready.then(update);controls();
})();
