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
  async function assign(period,row,position,expectedName,expectedEmail,studentEmail){const response=await fetch('/api/hiring',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'assign',period,row,position,expectedName,expectedEmail,studentEmail})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Assignment could not be saved.');return result;}
  function teamRow(row,index,period,candidates){const position=String(row[0]||'');if(!position)return null;const currentName=String(row[1]||''),currentEmail=String(row[2]||'');const tr=cells([position,currentName,currentEmail],'td');const action=document.createElement('td'),select=document.createElement('select'),save=document.createElement('button');select.setAttribute('aria-label','Assign '+position);const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose student…';select.append(placeholder);candidates.forEach(candidate=>{const option=document.createElement('option');option.value=candidate.email;option.textContent=candidate.name+' · '+candidate.email;select.append(option);});select.value=currentEmail;save.type='button';save.textContent='Save';save.addEventListener('click',async()=>{if(!select.value||select.value===currentEmail)return;save.disabled=true;status.textContent='Saving '+position+'…';try{await assign(period,index+3,position,currentName,currentEmail,select.value);await show(period,page);status.textContent='Team assignment saved.';}catch(error){status.textContent=error.message;save.disabled=false;}});action.append(select,save);tr.append(action);return tr;}
  function clear(){request++;selected='';buttons.replaceChildren();data.hidden=true;team.hidden=true;team.querySelector('tbody').replaceChildren();apps.querySelector('thead').replaceChildren();apps.querySelector('tbody').replaceChildren();}
  async function show(period,pageNumber=0){
    selected=period;
    const current=++request;
    status.textContent='Loading '+label(period)+'…';data.hidden=true;
    try{
      const result=await get(period,pageNumber);
      if(current!==request||!window.NestAuth?.identity?.signedIn)return;
      document.getElementById('hiring-division').textContent=result.division;
      team.hidden=!result.canManage;
      team.querySelector('tbody').replaceChildren(...result.team.map((row,index)=>teamRow(row,index,period,result.candidates)).filter(Boolean));
      apps.querySelector('thead').replaceChildren(cells(result.columns,'th'));
      apps.querySelector('tbody').replaceChildren(...result.applications.map(row=>cells(result.columns.map((_,i)=>row[i]||''),'td')));
      page=pageNumber;prev.disabled=page===0;next.disabled=!result.hasMore;
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
  document.addEventListener('nest-auth-change',authChanged);
  window.NestAuth?.ready.then(authChanged);
})();
