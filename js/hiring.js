(() => {
  const status=document.getElementById('hiring-status'),buttons=document.getElementById('hiring-divisions'),data=document.getElementById('hiring-data');
  const team=document.getElementById('hiring-team'),apps=document.getElementById('hiring-applications');
  const prev=document.getElementById('hiring-prev'),next=document.getElementById('hiring-next'),pageLabel=document.getElementById('hiring-page-label');
  const selectedFromLink=new URLSearchParams(location.search).get('period');
  let selected='',request=0,page=0,activeIdentity=Symbol('initial');
  const linkedPeriod=/^(1|2|3|4|5|7|CTSO)$/.test(selectedFromLink||'')?selectedFromLink:'';
  const label=period=>period==='CTSO'?'NEST Robotics':'Division '+period;
  async function get(period,pageNumber=0){
    const controller=new AbortController();
    let timer;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller.abort();reject(new Error('Hiring took too long to load. Please try again.'));},60000);
    });
    try {
      return await Promise.race([timeout,(async()=>{
        const response=await fetch('/api/hiring?period='+encodeURIComponent(period)+'&page='+pageNumber,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        let result;
        try{result=await response.json();}catch{throw new Error('Hiring is temporarily unavailable. Please try again.');}
        if(!response.ok)throw new Error(result.error||'Applications unavailable.');
        return result;
      })()]);
    }finally{clearTimeout(timer);}
  }
  function failed(error,retry){
    status.textContent=error.message||'Hiring is temporarily unavailable.';
    const button=document.createElement('button');
    button.type='button';button.textContent='Try again';
    button.addEventListener('click',retry,{once:true});
    status.append(' ',button);
  }
  function cells(row,tag){const tr=document.createElement('tr');row.forEach(value=>{const cell=document.createElement(tag);cell.textContent=String(value??'');tr.append(cell);});return tr;}
  async function saveChange(body){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    try{
      const response=await fetch('/api/hiring',{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      let result;try{result=await response.json();}catch{throw new Error('The change could not be confirmed. Reload before trying again.');}
      if(!response.ok)throw new Error(result.error||'The change could not be saved.');return result;
    }catch(error){if(error.name==='AbortError')throw new Error('Saving took too long. Reload before trying again.');throw error;}
    finally{clearTimeout(timer);}
  }
  let dirtyReviews=0,layout={},layoutKey='',viewGeneration=0;
  function studentSelect(position,candidates){
    const select=document.createElement('select');select.setAttribute('aria-label','Assign '+position);
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose student…';select.append(placeholder);
    candidates.forEach(candidate=>{const option=document.createElement('option');option.value=candidate.email;option.textContent=candidate.name+' · '+candidate.email;select.append(option);});return select;
  }
  function teamRow(row,index,period,candidates,partner=false){
    const position=String(row[0]||'');if(!position)return null;
    const currentName=String(row[1]||''),currentEmail=String(row[2]||'');
    const tr=cells([position,partner?'Share this position':currentName,partner?'':currentEmail],'td');
    const action=document.createElement('td'),select=studentSelect(position,candidates),save=document.createElement('button');
    select.value=partner?'':currentEmail;save.type='button';save.textContent=partner?'Add partner':'Save';
    save.addEventListener('click',async()=>{
      if(!select.value||(!partner&&select.value===currentEmail))return;
      if(dirtyReviews){status.textContent='Save or reset your interview changes before changing the team.';return;}
      const generation=viewGeneration;save.disabled=true;status.textContent='Saving '+position+'…';
      try{
        const result=await saveChange(partner?{action:'partner',period,position,studentEmail:select.value}:{action:'assign',period,row:index+3,position,expectedName:currentName,expectedEmail:currentEmail,studentEmail:select.value});
        if(generation!==viewGeneration)return;
        await show(period,page);status.textContent=result.sharingQueued===false?'Team saved. Slide access will be refreshed by the daily sharing update.':'Team saved. Slide access is updating in the background.';
      }catch(error){if(generation===viewGeneration){status.textContent=error.message;save.disabled=false;}}
    });action.append(select,save);tr.append(action);return tr;
  }
  const fit=document.getElementById('hiring-fit'),reload=document.getElementById('hiring-reload');
  function persistLayout(){try{localStorage.setItem(layoutKey,JSON.stringify(layout));}catch{}}
  function loadLayout(period){
    layoutKey='nest-hiring-layout:'+String(window.NestAuth?.identity?.username||window.NestAuth?.identity?.email||'')+':'+period;
    try{layout=JSON.parse(localStorage.getItem(layoutKey)||'{}');if(!layout||typeof layout!=='object')layout={};}catch{layout={};}
  }
  function sizeColumns(){
    const cols=[...apps.querySelectorAll('col')];
    if(Array.isArray(layout.widths)&&layout.widths.length===cols.length&&layout.widths.every(x=>Number.isFinite(x)&&x>=48&&x<=1500)){
      cols.forEach((col,i)=>col.style.width=layout.widths[i]+'px');apps.style.width=layout.widths.reduce((a,b)=>a+b,0)+'px';
    }else{apps.style.width='100%';cols.forEach((col,i)=>col.style.width=([6,10,5,8,10,10,10,11,5,5,5,5,5,9][i])+'%');}
  }
  function resizeHandle(handle,axis,read,write){
    handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation',axis==='x'?'vertical':'horizontal');
    handle.addEventListener('keydown',event=>{
      const less=axis==='x'?'ArrowLeft':'ArrowUp',more=axis==='x'?'ArrowRight':'ArrowDown';
      if(event.key!==less&&event.key!==more)return;event.preventDefault();write(read()+(event.key===more?16:-16));
    });
    handle.addEventListener('pointerdown',event=>{
      event.preventDefault();const start=axis==='x'?event.clientX:event.clientY,initial=read();
      const move=e=>write(initial+(axis==='x'?e.clientX:e.clientY)-start);
      const stop=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',stop);document.removeEventListener('pointercancel',stop);};
      document.addEventListener('pointermove',move);document.addEventListener('pointerup',stop,{once:true});document.addEventListener('pointercancel',stop,{once:true});
    });
  }
  function setRowHeight(tr,index,height){
    const bounded=Math.max(96,Math.min(900,height));tr.querySelectorAll('.application-cell').forEach(cell=>cell.style.height=bounded+'px');
    layout.heights=layout.heights||{};layout.heights[page+':'+index]=bounded;persistLayout();
  }
  function reviewRow(row,index,period,review,canManage){
    const tr=document.createElement('tr');
    const wrap=()=>{const td=document.createElement('td'),box=document.createElement('div');box.className='application-cell';td.append(box);tr.append(td);return box;};
    for(let i=0;i<7;i++){const box=wrap();box.textContent=i===2?String(row[i]||'').replace(/^Period\s+/i,''):String(row[i]||'');}
    const noteBox=wrap(),notes=document.createElement('textarea');notes.maxLength=5000;notes.value=review?.notes??String(row[7]||'');notes.setAttribute('aria-label','Interview notes for '+String(row[1]||'applicant'));notes.disabled=!canManage;noteBox.append(notes);
    const scores=Array.isArray(review?.scores)?[...review.scores]:[null,null,null,null],selectors=[];
    ['Role knowledge','Communication','Problem-solving','Teamwork'].forEach((criterion,i)=>{
      const box=wrap(),select=document.createElement('select');select.setAttribute('aria-label',criterion+' for '+String(row[1]||'applicant'));
      ['',1,2,3,4].forEach(value=>{const option=document.createElement('option');option.value=String(value);option.textContent=value===''?'—':String(value);select.append(option);});select.value=scores[i]===null?'':String(scores[i]);select.disabled=!canManage;selectors.push(select);box.append(select);
    });
    const total=wrap(),actions=wrap(),save=document.createElement('button'),reset=document.createElement('button'),message=document.createElement('span');
    save.type=reset.type='button';save.textContent='Save';reset.textContent='Reset';save.setAttribute('aria-label','Save interview review');reset.setAttribute('aria-label','Reset interview changes');message.className='review-save-status';message.setAttribute('role','status');
    const generation=viewGeneration;let revision=review?.revision,originalNotes=notes.value,originalScores=[...scores],dirty=false;
    function changed(){
      selectors.forEach((select,i)=>scores[i]=select.value?Number(select.value):null);
      const rated=scores.filter(x=>x!==null);total.textContent=rated.length===4?String(rated.reduce((a,b)=>a+b,0))+'/16':rated.reduce((a,b)=>a+b,0)+' ('+rated.length+'/4 rated)';
      const now=notes.value!==originalNotes||JSON.stringify(scores)!==JSON.stringify(originalScores);
      if(now!==dirty){dirtyReviews+=now?1:-1;dirty=now;}
      save.disabled=!canManage||!dirty;reset.disabled=!dirty;prev.disabled=dirtyReviews>0||page===0;next.disabled=dirtyReviews>0||!hasMore;reload.disabled=dirtyReviews>0;
      message.textContent=dirty?'Unsaved changes':'Saved';
    }
    notes.addEventListener('input',changed);selectors.forEach(select=>select.addEventListener('change',changed));
    reset.addEventListener('click',()=>{notes.value=originalNotes;selectors.forEach((select,i)=>select.value=originalScores[i]===null?'':String(originalScores[i]));changed();});
    save.addEventListener('click',async()=>{
      if(!review?.key||!revision)return;
      save.disabled=reset.disabled=true;notes.disabled=true;selectors.forEach(select=>select.disabled=true);message.textContent='Saving…';
      try{
        const result=await saveChange({action:'review',period,key:review.key,revision,notes:notes.value,scores});
        if(generation!==viewGeneration)return;revision=result.revision;originalNotes=notes.value;originalScores=[...scores];changed();message.textContent='Saved';
      }catch(error){if(generation!==viewGeneration)return;save.disabled=false;reset.disabled=false;message.textContent=error.message;}
      finally{if(generation===viewGeneration){notes.disabled=!canManage;selectors.forEach(select=>select.disabled=!canManage);}}
    });
    if(canManage)actions.append(save,reset,message);else actions.textContent='Review only';
    const handle=document.createElement('span');handle.className='application-row-resize';handle.setAttribute('aria-label','Resize application row '+(index+1));tr.children[1].append(handle);
    resizeHandle(handle,'y',()=>parseInt(tr.querySelector('.application-cell').style.height)||180,value=>setRowHeight(tr,index,value));
    const height=layout.heights?.[page+':'+index];tr.querySelectorAll('.application-cell').forEach(cell=>cell.style.height=(Number.isFinite(height)?Math.max(96,Math.min(900,height)):180)+'px');
    changed();return tr;
  }
  let hasMore=false;
  function renderApplications(result,period){
    const titles=['Date','Applicant','Div.','Position','Experience','Qualifications','Contribution','Notes','Role','Comms','Solve','Team','Total','Review'];
    const head=cells(titles,'th');apps.querySelector('colgroup').replaceChildren(...titles.map(()=>document.createElement('col')));
    [...head.children].forEach((th,index)=>{
      th.scope='col';th.title=index<8?result.columns[index]||titles[index]:['Role knowledge','Communication','Problem-solving','Teamwork','Total interview rating','Save notes and interview ratings'][index-8];const handle=document.createElement('span');handle.className='application-column-resize';handle.setAttribute('aria-label','Resize '+titles[index]+' column');
      resizeHandle(handle,'x',()=>Array.isArray(layout.widths)?layout.widths[index]:Math.max(48,th.getBoundingClientRect().width||120),value=>{
        if(!Array.isArray(layout.widths)||layout.widths.length!==titles.length)layout.widths=[...head.children].map(cell=>Math.max(48,cell.getBoundingClientRect().width||120));
        layout.widths[index]=Math.max(48,Math.min(1500,value));sizeColumns();persistLayout();
      });th.append(handle);
    });apps.querySelector('thead').replaceChildren(head);
    apps.querySelector('tbody').replaceChildren(...result.applications.map((row,index)=>reviewRow(row,index,period,result.reviews?.[index],result.canManage)));sizeColumns();
  }
  fit.addEventListener('click',()=>{delete layout.widths;sizeColumns();persistLayout();});
  reload.addEventListener('click',()=>{if(selected&&!dirtyReviews)show(selected,page);});
  function clear(){request++;viewGeneration++;dirtyReviews=0;selected='';buttons.replaceChildren();data.hidden=true;team.hidden=true;team.querySelector('tbody').replaceChildren();apps.querySelector('thead').replaceChildren();apps.querySelector('tbody').replaceChildren();}
  async function show(period,pageNumber=0){
    if(dirtyReviews){status.textContent='Save or reset your interview changes before switching pages.';return;}
    selected=period;viewGeneration++;
    const current=++request;
    status.textContent='Loading '+label(period)+'…';data.hidden=true;
    try{
      const result=(pageNumber===0?window.NestAuth?.takeHiringView?.(period):null)||await get(period,pageNumber);
      if(current!==request||!window.NestAuth?.identity?.signedIn)return;
      document.getElementById('hiring-division').textContent=result.division;
      team.hidden=!result.canManage;
      const teamRows=[];
      const positions=[...new Set([...(result.positions||[]),...result.team.map(row=>String(row[0]||'')).filter(Boolean)])];
      if(result.canManage)positions.forEach(position=>{result.team.forEach((row,index)=>{if(row[0]===position)teamRows.push(teamRow(row,index,period,result.candidates));});teamRows.push(teamRow([position],0,period,result.candidates,true));});
      team.querySelector('tbody').replaceChildren(...teamRows);
      page=pageNumber;hasMore=result.hasMore;dirtyReviews=0;loadLayout(period);renderApplications(result,period);
      prev.disabled=page===0;next.disabled=!result.hasMore;reload.disabled=false;
      pageLabel.textContent='Page '+(page+1);data.hidden=false;
      status.textContent=result.applications.length?`${result.applications.length} applications on this page.`:'No applications on this page.';
    }catch(error){if(current===request)failed(error,()=>show(period,pageNumber));}
  }
  async function load(){
    clear();
    if(!window.NestAuth?.identity?.signedIn){
      status.replaceChildren('Sign in to review applications. ');
      const sign=document.createElement('button');sign.type='button';sign.textContent='NEST sign in';
      sign.addEventListener('click',()=>window.NestAuth?.open());status.append(sign);return;
    }
    // The server checks the live role for this division. Do not enumerate every
    // division (and repeatedly resolve a manual account) before opening it.
    if(linkedPeriod){await show(linkedPeriod);return;}
    const current=request;
    status.textContent='Checking hiring access…';
    try{
      const result=await get('mine');
      if(current!==request||!window.NestAuth?.identity?.signedIn)return;
      buttons.replaceChildren();
      result.periods.forEach(period=>{
        const button=document.createElement('button');button.type='button';button.textContent=label(period);
        button.addEventListener('click',()=>show(period));buttons.append(button);
      });
      status.textContent=result.periods.length?'Choose a division to review.':'No hiring divisions are assigned to your NEST account.';
    }catch(error){if(current===request)failed(error,load);}
  }
  function authChanged(){
    const identity=window.NestAuth?.identity;
    if(identity===activeIdentity)return;
    activeIdentity=identity;
    load();
  }
  prev.addEventListener('click',()=>{if(selected&&page>0)show(selected,page-1);});
  next.addEventListener('click',()=>{if(selected)show(selected,page+1);});
  window.addEventListener('beforeunload',event=>{if(dirtyReviews){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',event=>{if(event.persisted)load();});
  document.addEventListener('nest-auth-change',authChanged);
  window.NestAuth?.ready.then(authChanged);
})();
