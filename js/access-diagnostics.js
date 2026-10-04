(() => {
 const original=window.fetch.bind(window),areas={'/api/auth':'auth','/api/service-requests':'service','/api/hiring':'hiring','/api/spinner':'tracker','/api/signals':'signals','/api/division':'division','/api/leadership':'leadership','/api/fabrication':'fabrication','/api/lunch':'lunch','/api/account':'profile'};let queue=[],sending=false,timer;
 try{queue=JSON.parse(sessionStorage.getItem('nest-access-metadata')||'[]').slice(-100);}catch{}
 function stash(){try{sessionStorage.setItem('nest-access-metadata',JSON.stringify(queue));}catch{}}
 function add(event){queue.push(event);queue=queue.slice(-100);stash();clearTimeout(timer);timer=setTimeout(flush,2000);}
 async function flush(){
  if(sending||!queue.length||!window.NestAuth?.identity?.signedIn)return;
  queue=queue.filter(e=>!e.account||e.account===window.NestAuth.identity.username);stash();if(!queue.length)return;sending=true;const batch=queue.slice(0,20);
  try{const response=await original('/api/diagnostics',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch.map(({account,...event})=>event)}),signal:AbortSignal.timeout(12000)});if(response.ok){queue.splice(0,batch.length);stash();}}catch{}finally{sending=false;if(queue.length)timer=setTimeout(flush,30000);}
 }
 window.fetch=async(input,options)=>{
  let url;try{url=new URL(typeof input==='string'?input:input.url,location.href);}catch{return original(input,options);}
  const area=url.origin===location.origin&&areas[url.pathname];if(!area)return original(input,options);
  let operation=url.searchParams.get('operation')||url.searchParams.get('action')||url.searchParams.get('asset')||'access';
  // Only the action name is selected from JSON. Body contents are never recorded.
  if(typeof options?.body==='string')try{const value=JSON.parse(options.body);operation=value.action||value.operation||operation;}catch{}
  if(!/^[a-z][a-z0-9-]{0,39}$/.test(operation))operation='access';
  const started=performance.now();let status=0,requestId='';
  try{const response=await original(input,options);status=response.status;requestId=response.headers?.get('X-NEST-Request-ID')||'';return response;}finally{add({time:new Date().toISOString(),area,operation,status,requestId,account:window.NestAuth?.identity?.username||'',durationMs:Math.min(180000,Math.round(performance.now()-started))});}
 };
 document.addEventListener('nest-auth-change',()=>{clearTimeout(timer);if(!window.NestAuth?.identity?.signedIn){queue=[];stash();}else flush();});window.addEventListener('online',flush);
})();
