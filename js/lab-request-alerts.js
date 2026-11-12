(() => {
 if(window.NestLabAlerts||!window.NestAuth)return;
 const owners=new Set(['mpenalver@bethelsd.org','mario@memberhq.net','astramario@gmail.com']);
 let identity='',generation=0,timer,panel,events=[],eligible=false,polling=false,busy=false,seen=new Set(),snoozed={},attempts=new Map(),message='',presentedKey='';
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const key=()=> 'nest-lab-alerts:'+identity;
 const style=node('style');style.textContent='.nest-lab-alert{position:fixed;inset:auto 20px 20px auto;max-width:420px;width:calc(100% - 40px);max-height:70dvh;overflow:auto;box-sizing:border-box;border:2px solid #c19a5e;border-radius:16px;background:#fffaf0;color:#203343;padding:24px;box-shadow:0 10px 55px #142b3540;z-index:10025;margin:0;text-align:left;font:15px/1.6 Montserrat,Arial,sans-serif}.nest-lab-alert h2{font-size:20px;margin:0 0 12px}.nest-lab-alert p{overflow-wrap:anywhere}.nest-lab-alert a,.nest-lab-alert button{display:inline-block;padding:10px 14px;border:1px solid #aab8bb;border-radius:8px;background:#fff;color:#203343;text-decoration:none;font:inherit;font-weight:600;margin:6px 8px 0 0;cursor:pointer}.nest-lab-alert button.primary{background:#203f4b;color:#fff}.nest-lab-alert button:disabled{opacity:.6}.nest-lab-alert :focus-visible{outline:3px solid #ad7627;outline-offset:3px}';document.head.append(style);
 function persist(){try{sessionStorage.setItem(key(),JSON.stringify({seen:[...seen].slice(-500),snoozed}));}catch{}}
 async function api(operation,fields={},write=false){const response=await fetch('/api/lab-requests'+(write?'':'?'+new URLSearchParams({operation,...fields})),{method:write?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:write?{'Content-Type':'application/json'}:undefined,body:write?JSON.stringify({operation,...fields}):undefined,signal:AbortSignal.timeout(60000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Refresh the request desk to confirm the pass status.');return data;}
 function render(){
  let dialogs;try{dialogs=[...document.querySelectorAll('dialog:modal')];}catch{dialogs=[];}if(!dialogs.length)dialogs=[...document.querySelectorAll('dialog[open]')];
  const host=dialogs.at(-1)||document.body,signature=JSON.stringify({eligible,busy,message,events});
  // Moving an alert into a modal must settle. The observer can see our own
  // insertion, and unchanged polls must not replace a focused control.
  if(signature===presentedKey&&panel?.isConnected&&panel.parentElement===host)return;
  presentedKey=signature;panel?.remove();panel=null;if(!eligible||!events.length)return;const item=events[0];
  panel=node('section');panel.className='nest-lab-alert';panel.setAttribute('role','region');panel.setAttribute('aria-label','NEST™ Request alert');
  const heading=node('h2',item.kind==='arrival'?'A NEST™ Lab visitor is due':item.kind==='teacher-denial'?'A teacher denied a NEST™ Request':'A new NEST™ Request'),status=node('p',message);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  panel.append(heading,node('p',item.name),node('p',item.day+' · '+item.time+' Pacific'+(events.length>1?' · '+events.length+' alerts waiting':'')));
  if(item.kind==='teacher-denial')panel.append(node('p',item.reason||'at incoming teacher’s request'));
  const link=node('a',item.kind==='arrival'?'View digital pass':'Review request');link.href='/lab-request?request='+encodeURIComponent(item.requestId);panel.append(link);
  if(item.kind==='arrival'){
   const checkin=node('button','Check in now');checkin.type='button';checkin.className='primary';checkin.disabled=busy;
   checkin.addEventListener('click',async()=>{
    if(busy)return;busy=true;message='Confirming arrival and notifying the teacher…';render();const current=generation;
    if(!attempts.has(item.id))attempts.set(item.id,crypto.randomUUID());
    try{const data=await api('decide',{id:item.requestId,revision:item.revision,eventId:attempts.get(item.id),state:'checked-in'},true);if(current!==generation)return;
     const mail=data.request.events.at(-1)?.emailState;events=events.filter(x=>x.id!==item.id);message='';
     if(mail!=='accepted'){const notice=node('p','Arrival saved. Email delivery needs review in the request desk.');notice.setAttribute('role','status');document.body.append(notice);setTimeout(()=>notice.remove(),15000);}
     document.dispatchEvent(new CustomEvent('nest-lab-checkin',{detail:{id:item.requestId}}));
    }catch(error){if(current===generation)message=error.message;}finally{if(current===generation){busy=false;render();}}
   });panel.append(checkin);
  }
  const dismiss=node('button',item.kind==='arrival'?'Remind me in 10 minutes':'Dismiss alert');dismiss.type='button';dismiss.disabled=busy;dismiss.addEventListener('click',()=>{if(item.kind==='arrival')snoozed[item.id]=Date.now()+600000;else seen.add(item.id);persist();events.shift();message='';render();});panel.append(dismiss,status);
  host.append(panel);
  if(typeof panel.showPopover==='function'){panel.setAttribute('popover','manual');try{panel.showPopover();}catch{panel.removeAttribute('popover');}}
 }
 async function check(){
  if(polling||busy||!eligible||document.visibilityState==='hidden')return;polling=true;const current=generation;
  try{const data=await api('alerts');if(current!==generation)return;eligible=data.eligible===true;events=eligible?(data.events||[]).filter(x=>x.kind==='arrival'?!(snoozed[x.id]>Date.now()):!seen.has(x.id)):[];render();}
  catch{/* Keep unread alerts and retry when the school service returns. */}
  finally{polling=false;clearTimeout(timer);if(eligible)timer=setTimeout(check,15000);}
 }
 function load(){
  generation++;clearTimeout(timer);eligible=false;busy=false;events=[];message='';presentedKey='';seen=new Set();snoozed={};attempts=new Map();panel?.remove();panel=null;
  identity=String(window.NestAuth.identity?.email||'').toLowerCase();if(!window.NestAuth.identity?.signedIn||!owners.has(identity))return;
  try{const saved=JSON.parse(sessionStorage.getItem(key())||'{}');if(Array.isArray(saved.seen))seen=new Set(saved.seen.filter(v=>typeof v==='string'));if(saved.snoozed&&typeof saved.snoozed==='object')snoozed=saved.snoozed;}catch{}
  eligible=true;check();
 }
 new MutationObserver(records=>{if(events.length&&records.some(r=>r.type==='attributes'&&r.target.matches?.('dialog')||r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(n=>n.matches?.('dialog')||n.querySelector?.('dialog'))))render();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 document.addEventListener('nest-auth-change',load);window.NestAuth.ready.then(load);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){clearTimeout(timer);check();}});window.addEventListener('pagehide',()=>clearTimeout(timer));window.NestLabAlerts={check};
})();
