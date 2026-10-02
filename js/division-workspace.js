(() => {
  const periods=['1','2','3','4','5','7','CTSO'];
  const dialog=document.createElement('dialog');dialog.className='division-workspace';dialog.setAttribute('aria-labelledby','division-window-title');
  dialog.innerHTML=`<div class="division-window-layout"><div class="division-window-header"><div><h2 id="division-window-title"></h2><p>Your division’s leadership slides</p></div><button type="button" data-close>Close ✕</button></div><nav class="division-window-positions" aria-label="Leadership slides"></nav><div class="division-window-controls" hidden><button type="button" data-load disabled>Load division slides</button><p>Update the manager slideshow with this division’s latest leadership slides.</p><button type="button" data-edit-manager hidden>Edit manager slide</button></div><p class="division-window-status" role="status" aria-live="polite"></p><div class="division-window-stage"></div><div class="division-window-footer" hidden><small>Select a position above to open its slide. Use your school Google account to view and edit.</small><button type="button" data-refresh>Refresh slideshow</button></div></div>`;
  const individual=document.createElement('dialog');individual.className='division-workspace division-individual';individual.setAttribute('aria-labelledby','division-slide-title');
  individual.innerHTML=`<div class="division-window-layout"><div class="division-window-header"><div><h2 id="division-slide-title"></h2><p data-mode></p></div><button type="button" data-back>Back to division</button></div><p class="division-window-status" role="status" aria-live="polite"></p><div class="division-window-stage"></div><div class="division-window-footer"><small>Editing uses your school Google account. Changes save automatically.</small><a class="division-original" data-external target="_blank" rel="noopener noreferrer" hidden>Open in Google ↗</a></div></div>`;
  document.body.append(dialog,individual);
  const status=dialog.querySelector('[role=status]'),loadButton=dialog.querySelector('[data-load]'),stage=dialog.querySelector('.division-window-stage'),positions=dialog.querySelector('.division-window-positions');
  let period='',generation=0,opener,timer,canManage=false,job='',busy=false,config=null,slideGeneration=0,slideOpener;
  const storageKey=p=>'nest-division-slides:'+p;
  function remember(value){try{if(value)sessionStorage.setItem(storageKey(period),value);else sessionStorage.removeItem(storageKey(period));}catch{}}
  function saved(){try{return sessionStorage.getItem(storageKey(period))||'';}catch{return '';}}
  function setBusy(value){busy=value;loadButton.disabled=value||!canManage;loadButton.textContent=value?'Updating slides…':'Load division slides';}
  async function request(method,extra={}){
    const url='/api/division?period='+encodeURIComponent(period)+(method==='GET'&&extra.job?'&job='+encodeURIComponent(extra.job):'');
    const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(55000),...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'load-slides',period,...extra})}:{})});
    let data;try{data=await response.json();}catch{throw new Error('The division window is temporarily unavailable. Please try again.');}
    if(!response.ok){const error=new Error(data.error||'The division window is unavailable.');error.status=response.status;throw error;}
    return data;
  }
  function frame(slide,edit=false){
    const iframe=document.createElement('iframe');iframe.title=(period==='CTSO'?'NEST Robotics':'Division '+period)+' — '+slide.role+(edit?' editor':' slideshow');
    iframe.src='https://docs.google.com/presentation/d/'+slide.id+(edit?'/edit':'/embed?start=false&loop=false');iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';return iframe;
  }
  function render(){if(config)stage.replaceChildren(frame(config.manager));}
  function clearAccess(){
    config=null;canManage=false;setBusy(false);positions.replaceChildren();stage.replaceChildren();
    dialog.querySelector('.division-window-controls').hidden=true;dialog.querySelector('.division-window-footer').hidden=true;
    if(individual.open)individual.close();
  }
  function showConfig(result){
    if(!result.manager||!Array.isArray(result.leaders))throw new Error('The leadership slides are unavailable.');
    config=result;canManage=result.canManage===true;positions.replaceChildren();
    for(const slide of result.leaders){
      const button=document.createElement('button');button.type='button';button.textContent=slide.role;
      const mode=document.createElement('small');mode.textContent=slide.canEdit?'Edit slide':'View slide';button.append(mode);button.addEventListener('click',()=>openSlide(slide.id,button));positions.append(button);
    }
    dialog.querySelector('.division-window-controls').hidden=false;loadButton.hidden=!canManage;
    dialog.querySelector('.division-window-controls p').textContent=canManage?'Update the manager slideshow with this division’s latest leadership slides.':'You can view all leadership slides in your division. Only your assigned positions allow editing.';
    dialog.querySelector('[data-edit-manager]').hidden=!result.manager.canEdit;
    dialog.querySelector('.division-window-footer').hidden=false;render();
  }
  async function openSlide(id,button){
    const own=++slideGeneration,current=generation;slideOpener=button;
    const panel=individual.querySelector('.division-window-stage'),notice=individual.querySelector('[role=status]'),external=individual.querySelector('a');
    panel.replaceChildren();external.hidden=true;external.removeAttribute('href');individual.querySelector('h2').textContent='Leadership slide';individual.querySelector('[data-mode]').textContent='';notice.textContent='Checking access…';individual.showModal();individual.querySelector('[data-back]').focus();
    try{
      const result=await request('GET');if(own!==slideGeneration||current!==generation||!individual.open)return;
      const slide=[result.manager,...result.leaders].find(slide=>slide.id===id);if(!slide)throw new Error('This leadership slide is no longer available.');
      individual.querySelector('h2').textContent=slide.role;individual.querySelector('[data-mode]').textContent=slide.canEdit?'Editing enabled':'View only · Assigned leaders and division managers can edit';
      notice.textContent='';panel.append(frame(slide,slide.canEdit===true));external.href='https://docs.google.com/presentation/d/'+slide.id+(slide.canEdit?'/edit':'/preview');external.hidden=false;
    }catch(error){if(own!==slideGeneration||current!==generation||!individual.open)return;notice.textContent=error.message;if([401,403].includes(error.status)){clearAccess();recover(error.message,checkAccess);}}
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
        render();return;
      }
      if(result.state==='failed'){
        remember('');job='';setBusy(false);status.textContent='The update did not finish. You can load the division slides again.';return;
      }
      setBusy(true);status.textContent=result.state==='queued'?'Slide update queued. It usually starts within a minute.':'Loading the latest leadership slides into the manager slideshow…';
      timer=setTimeout(()=>poll(own),10000);
    }catch(error){
      if(own!==generation||!dialog.open)return;
      if([401,403].includes(error.status)){clearAccess();recover(error.message,checkAccess);return;}
      if(error.status===404){remember('');job='';setBusy(false);recover('The update has not started. Please try again.',start);return;}
      recover('Could not check the update yet. '+error.message,()=>poll(own));
    }
  }
  async function start(){
    if(!canManage||busy)return;
    const own=generation;job=crypto.randomUUID();remember(job);setBusy(true);status.textContent='Starting the division slide update…';
    try{await request('POST',{job});if(own===generation&&dialog.open)poll(own);}
    catch(error){if(own!==generation||!dialog.open)return;if([401,403].includes(error.status)){clearAccess();recover(error.message,checkAccess);return;}recover(error.message+' Check the update before starting another.',()=>poll(own));}
  }
  async function checkAccess(){
    const own=++generation;clearTimeout(timer);clearAccess();
    if(window.NestAuth?.identity?.signedIn===false){
      status.textContent='Sign in to NEST to open your division’s leadership window.';const sign=document.createElement('button');sign.type='button';sign.textContent='NEST sign in';sign.addEventListener('click',()=>window.NestAuth?.open());status.append(' ',sign);return;
    }
    status.textContent='Checking division membership…';
    try{
      const result=await request('GET');if(own!==generation||!dialog.open)return;
      showConfig(result);job=canManage?saved():'';setBusy(Boolean(job));status.textContent='';if(job)poll(own);
    }catch(error){if(own===generation&&dialog.open)recover(error.message,checkAccess);}
  }
  function openDivision(target,link){
    if(!periods.includes(target))return;
    if(dialog.open)dialog.close();period=target;opener=link;job='';clearAccess();
    dialog.querySelector('h2').textContent=period==='CTSO'?'NEST™ Robotics':'Division '+period;
    dialog.showModal();dialog.querySelector('[data-close]').focus();checkAccess();
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[data-division-workspace]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    if(!periods.includes(link.dataset.divisionWorkspace))return;
    event.preventDefault();openDivision(link.dataset.divisionWorkspace,link);
  });
  dialog.querySelector('[data-load]').addEventListener('click',start);
  dialog.querySelector('[data-edit-manager]').addEventListener('click',event=>{if(config?.manager.canEdit)openSlide(config.manager.id,event.target);});
  dialog.querySelector('[data-refresh]').addEventListener('click',checkAccess);
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{generation++;clearTimeout(timer);clearAccess();job='';opener?.focus();});
  individual.querySelector('[data-back]').addEventListener('click',()=>individual.close());
  individual.addEventListener('close',()=>{slideGeneration++;individual.querySelector('.division-window-stage').replaceChildren();individual.querySelector('a').removeAttribute('href');slideOpener?.focus();});
  document.addEventListener('nest-auth-change',()=>{if(dialog.open)checkAccess();});
  const deepPeriod=new URLSearchParams(location.search).get('division');
  if(periods.includes(deepPeriod))openDivision(deepPeriod,null);
})();
