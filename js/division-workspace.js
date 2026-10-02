(() => {
  const divisions={"1": {"folder": "1X7faoEUTi0dCNSOVi8EwFo4Z0fY6gEfG", "slides": "1gqZ-iyiFJy16NpoEtw4bFOoTl39778Gdy4DriRw0mI8", "sheet": 0}, "2": {"folder": "1SWRfcL8hT5C3CRu366rpoRCWXk6ObL7B", "slides": "1awp5Ge_Nhn4fow5pqIe9MnpOBodMzeXCNZYm_6TS_iU", "sheet": 726738533}, "3": {"folder": "16UJx1F6lStbayCUI41NOHGm5W0hKNFWX", "slides": "1jO2biUi392Ldf1lE43mQjSRKonOdVMMBwCqfYidF54Q", "sheet": 1651620119}, "4": {"folder": "1t1KwHPPQ3L-wv6RLlv8t2yZLXX_Vccv0", "slides": "1gka97wrtr1QeWpkzi2tK4ZxtNqlnxR3bVG_AXWKtxss", "sheet": 75640338}, "5": {"folder": "1diqsozFhlqdqgmu7rnfg3LzorBPzxBQh", "slides": "14C0Xd2EZExZUOyVhg8J6O0E5XjTbHDaM2zoCabytt1w", "sheet": 510218907}, "7": {"folder": "18zn5BYGBz8TyRnitb7arZFV7RIJDQ-VM", "slides": "1sT5PmcnbcaaC8kmNtz-FmQ4RIkUGhaYt8UQTReA8nt8", "sheet": 274321462}, "CTSO": {"folder": "15l5SwyCQim0rYQTxMqgr7u3LvqSd8E7n", "slides": "1I3M1LcUGbH8raqH3xwkIZY5TFs-tYpFOD1bEM9rBjb0", "sheet": 5696712}};
  const controlSheet='1GYT_Of3ioinTXbpzjVCLUjr1rxvnrjjCD_kYMVUfqto';
  const dialog=document.createElement('dialog');dialog.className='division-workspace';dialog.setAttribute('aria-labelledby','division-window-title');
  dialog.innerHTML=`<div class="division-window-layout"><div class="division-window-header"><div><h2 id="division-window-title"></h2><p>Division workspace</p></div><button type="button" data-close>Close ✕</button></div><div class="division-window-tabs" role="tablist" aria-label="Division screens"><button type="button" id="division-tab-folder" role="tab" data-screen="folder" aria-controls="division-window-panel">Folder</button><button type="button" id="division-tab-slides" role="tab" data-screen="slides" aria-controls="division-window-panel">Manager Slideshow</button><button type="button" id="division-tab-control" role="tab" data-screen="control" aria-controls="division-window-panel">Control Center</button></div><div class="division-window-controls"><button type="button" data-load disabled>Load division slides</button><p>Replace the slides after the title slide with the latest leadership slides from this division’s folder.</p></div><p class="division-window-status" role="status" aria-live="polite"></p><div class="division-window-stage" id="division-window-panel" role="tabpanel"></div><div class="division-window-footer"><small>Google keeps the original sharing rules. If a preview needs a Google sign-in, open it in a new tab.</small><button type="button" data-refresh>Refresh screen</button><a class="division-original" data-external target="_blank" rel="noopener noreferrer">Open in Google ↗</a></div></div>`;
  document.body.append(dialog);
  const status=dialog.querySelector('[role=status]'),loadButton=dialog.querySelector('[data-load]'),stage=dialog.querySelector('.division-window-stage'),original=dialog.querySelector('.division-original');
  const tabs=[...dialog.querySelectorAll('[data-screen]')];
  let period='',screen='folder',generation=0,opener,timer,canManage=false,job='',busy=false;
  const storageKey=p=>'nest-division-slides:'+p;
  function remember(value){try{if(value)sessionStorage.setItem(storageKey(period),value);else sessionStorage.removeItem(storageKey(period));}catch{}}
  function saved(){try{return sessionStorage.getItem(storageKey(period))||'';}catch{return '';}}
  function setBusy(value){busy=value;loadButton.disabled=value||!canManage;loadButton.textContent=value?'Updating slides…':'Load division slides';}
  async function request(method,extra={}){
    const url='/api/division?period='+encodeURIComponent(period)+(method==='GET'&&extra.job?'&job='+encodeURIComponent(extra.job):'');
    const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(55000),...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'load-slides',period,...extra})}:{})});
    let data;try{data=await response.json();}catch{throw new Error('The division workspace is temporarily unavailable. Please try again.');}
    if(!response.ok){const error=new Error(data.error||'The division workspace is unavailable.');error.status=response.status;throw error;}
    return data;
  }
  function render(){
    const config=divisions[period];if(!config)return;
    tabs.forEach(tab=>{const selected=tab.dataset.screen===screen;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
    stage.setAttribute('aria-labelledby','division-tab-'+screen);
    stage.replaceChildren();
    if(screen==='control'){
      const heading=document.createElement('h3');heading.textContent='Update this division’s manager slideshow';
      const text=document.createElement('p');text.textContent='Use “Load division slides” above to run the existing Control Center update. It keeps the title slide and loads the division’s leadership slides in their usual position order. The update also runs the existing template and sharing steps. Updates usually start within a minute. You can switch screens while it works.';
      stage.append(heading,text);original.href='https://docs.google.com/spreadsheets/d/'+controlSheet+'/edit#gid='+config.sheet;
    }else{
      const frame=document.createElement('iframe');frame.title=(period==='CTSO'?'NEST Robotics':'Division '+period)+(screen==='slides'?' manager slideshow':' folder');
      frame.src=screen==='slides'?'https://docs.google.com/presentation/d/'+config.slides+'/embed?start=false&loop=false':'https://drive.google.com/embeddedfolderview?id='+config.folder+'#list';
      frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';stage.append(frame);
      original.href=screen==='slides'?'https://docs.google.com/presentation/d/'+config.slides+'/edit':'https://drive.google.com/drive/folders/'+config.folder;
    }
  }
  function recover(message,retry){
    status.textContent=message;
    const button=document.createElement('button');button.type='button';button.textContent='Try again';button.addEventListener('click',retry,{once:true});status.append(' ',button);
  }
  async function poll(own){
    if(own!==generation||!dialog.open||!job)return;
    try{
      const result=await request('GET',{job});if(own!==generation||!dialog.open)return;
      if(result.state==='completed'){
        remember('');job='';setBusy(false);status.textContent='Division slides updated. The manager slideshow is ready.';
        if(screen==='slides')render();return;
      }
      if(result.state==='failed'){
        remember('');job='';setBusy(false);status.textContent='The update did not finish. You can load the division slides again.';return;
      }
      setBusy(true);status.textContent=result.state==='queued'?'Slide update queued. It usually starts within a minute.':'Loading the latest leadership slides into the manager slideshow…';
      timer=setTimeout(()=>poll(own),10000);
    }catch(error){
      if(own!==generation||!dialog.open)return;
      if(error.status===404){remember('');job='';setBusy(false);recover('The update has not started. Please try again.',start);return;}
      recover('Could not check the update yet. '+error.message,()=>poll(own));
    }
  }
  async function start(){
    if(!canManage||busy)return;
    const own=generation;job=crypto.randomUUID();remember(job);setBusy(true);status.textContent='Starting the division slide update…';
    try{await request('POST',{job});if(own===generation&&dialog.open)poll(own);}
    catch(error){if(own!==generation||!dialog.open)return;recover(error.message+' Check the update before starting another.',()=>poll(own));}
  }
  async function checkAccess(){
    const own=++generation;clearTimeout(timer);canManage=false;setBusy(false);
    if(!window.NestAuth?.identity?.signedIn){
      status.textContent='Sign in to NEST to load division slides.';const sign=document.createElement('button');sign.type='button';sign.textContent='NEST sign in';sign.addEventListener('click',()=>window.NestAuth?.open());status.append(' ',sign);return;
    }
    status.textContent='Checking slide update access…';
    try{
      const result=await request('GET');if(own!==generation||!dialog.open)return;
      canManage=result.canManage===true;job=canManage?saved():'';setBusy(Boolean(job));
      status.textContent=canManage?'Ready to load this division’s leadership slides.':'You can view this workspace. Only this division’s managers can load slides.';
      if(job)poll(own);
    }catch(error){if(own===generation&&dialog.open)recover(error.message,checkAccess);}
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[data-division-workspace]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=link.dataset.divisionWorkspace;if(!Object.hasOwn(divisions,target))return;
    event.preventDefault();period=target;screen=link.dataset.divisionScreen||'folder';opener=link;job='';
    dialog.querySelector('h2').textContent=period==='CTSO'?'NEST™ Robotics':'Division '+period;
    render();dialog.showModal();dialog.querySelector('[data-close]').focus();
    if(window.NestAuth?.identity!==null&&window.NestAuth?.identity!==undefined)checkAccess();
    else {status.textContent='Checking your NEST sign-in…';window.NestAuth?.ready.then(()=>{if(dialog.open&&status.textContent==='Checking your NEST sign-in…')checkAccess();});}
  });
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>{screen=tab.dataset.screen;render();});
    tab.addEventListener('keydown',event=>{
      let next=index;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
      else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
      event.preventDefault();screen=tabs[next].dataset.screen;render();tabs[next].focus();
    });
  });
  dialog.querySelector('[data-load]').addEventListener('click',start);
  dialog.querySelector('[data-refresh]').addEventListener('click',render);
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{generation++;clearTimeout(timer);stage.replaceChildren();canManage=false;job='';setBusy(false);opener?.focus();});
  document.addEventListener('nest-auth-change',()=>{if(dialog.open)checkAccess();});
})();
