(() => {
  const host=document.getElementById('trip-app');if(!host)return;
  const q=s=>host.querySelector(s);let period='',data=null,busy=false,expiryTimer,version=0;
  const status=q('[data-status]'),login=q('[data-login]'),view=q('[data-view]');
  let scoreQueue=[],savingScores=false,saveError=false,queueTimer;
  const scoreKey=e=>e.student+':'+e.assignment;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  function clear(){data=null;clearTimeout(expiryTimer);view.replaceChildren();view.hidden=true;}
  function setBusy(value){busy=value;host.setAttribute('aria-busy',String(value));host.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);}
  async function api(action,extra={}){
    const response=await fetch('/api/spinner',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(55000),body:JSON.stringify({action,period,...extra})});
    let result;try{result=await response.json();}catch{throw new Error('Access is temporarily unavailable. Please try again.');}
    if(!response.ok)throw Object.assign(new Error(result.error||'Unable to complete this request.'),{status:response.status});return result;
  }
  function lock(message,needsLogin=!window.NestAuth?.identity){scoreQueue=[];saveError=false;clearTimeout(queueTimer);clear();login.hidden=!needsLogin;status.textContent=message||(needsLogin?'Sign in to NEST to open this period.':'Choose a period. NEST will check your access.');}
  function expired(){if(data&&Date.now()>=Math.min(data.expires,data.editExpires||data.expires)){lock('Your access to this period has ended. Choose the period to refresh.');return true;}return false;}
  function percentage(values){if(!Array.isArray(data.completionScores))return 'Pending scoring rule';if(!values.length)return '—';return Math.round(values.filter(v=>data.completionScores.includes(v)).length/values.length*100)+'%';}
  function render(result){
    clear();data=result;login.hidden=true;view.hidden=false;
    const canEdit=['administrator','manager','editor'].includes(data.role);
    status.textContent=`Period ${period} · ${canEdit?'Editing enabled':'View only'} · Access until ${new Date(data.expires).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
    expiryTimer=setTimeout(()=>lock('Your access to this period has ended. Choose the period to refresh.'),Math.max(0,Math.min(data.expires,data.editExpires||data.expires)-Date.now()));
    const toolbar=node('div');toolbar.className='trip-toolbar';
    const refresh=node('button','Refresh');refresh.type='button';refresh.addEventListener('click',load);toolbar.append(refresh);
    const signout=node('button','Sign out of NEST');signout.type='button';signout.addEventListener('click',async()=>{if(busy)return;await window.NestAuth.logout();if(!window.NestAuth.identity)lock('Signed out of NEST.');});toolbar.append(signout);
    const exportBar=node('div');exportBar.className='trip-export-bar';
    const exportTitle=node('strong','Download scores');exportBar.append(exportTitle);
    if(data.role==='administrator'){
      const select=node('select');select.setAttribute('aria-label','CSV period');
      ['1','2','3','4','5','7','CTSO'].forEach(p=>{const o=node('option',p==='CTSO'?'Robotics':'Period '+p);o.value=p;o.selected=p===period;select.append(o);});
      const exportButton=node('button','Download CSV');exportButton.type='button';exportButton.className='trip-export-button';exportButton.addEventListener('click',()=>download(select.value));exportBar.append(select,exportButton);
    }else exportBar.append(node('span','CSV downloads are available to NEST administrators.'));
    view.append(exportBar);
    view.append(toolbar);
    if(['administrator','manager'].includes(data.role)){
      const panel=node('details'),heading=node('summary','Temporary editing access');panel.append(heading);
      panel.append(node('p','Give someone editing access to this period for six hours. They must verify their own email here. They cannot grant access to others.'));
      const form=node('form'),email=node('input');email.type='email';email.required=true;email.maxLength=254;email.placeholder='Editor’s email';email.setAttribute('aria-label','Temporary editor email');
      const button=node('button','Grant six-hour access');button.type='submit';form.className='trip-toolbar';form.append(email,button);form.addEventListener('submit',event=>{event.preventDefault();save({type:'grant',email:email.value});});panel.append(form);
      (data.grants||[]).forEach(grant=>{const row=node('p',grant.email+' — until '+new Date(grant.expires).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+' ');const revoke=node('button','Revoke');revoke.type='button';revoke.setAttribute('aria-label','Revoke access for '+grant.email);revoke.addEventListener('click',()=>save({type:'revoke',email:grant.email}));row.append(revoke);panel.append(row);});view.append(panel);
    }
    const all=[];data.students.forEach(s=>data.assignments.forEach(a=>all.push(data.scores[s.id]?.[a.id]||'')));
    const summary=node('p',`${data.students.length} students · ${data.assignments.length} assignments · Overall completion: ${percentage(all)}`);summary.className='trip-summary';view.append(summary);
    const breakdown=node('details'),heading=node('summary','Score breakdown');breakdown.append(heading);
    const list=node('p',['4','3','2','1','NE'].map(score=>score+': '+all.filter(v=>v===score).length).join(' · '));breakdown.append(list);
    breakdown.append(node('p','Not scored: '+all.filter(v=>!v).length+' · Imported legacy values: '+all.filter(v=>v&&!['4','3','2','1','NE'].includes(v)).length+'. Only a score of 4 counts as completed.'));view.append(breakdown);
    if(canEdit){
      const form=node('form'),input=node('input');input.required=true;input.maxLength=100;input.placeholder='New assignment title';input.setAttribute('aria-label','New assignment title');
      const add=node('button','Add assignment');add.type='submit';form.append(input,add);form.className='trip-toolbar';form.addEventListener('submit',event=>{event.preventDefault();save({type:'assignment',title:input.value});});view.append(form);
    }
    const scroll=node('div');scroll.className='trip-table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Period '+period+' tracker. Scroll horizontally for assignments.');
    const table=node('table'),caption=node('caption','Period '+period+' assignments');table.append(caption);
    const head=node('thead'),tr=node('tr');const name=node('th','Student');name.scope='col';tr.append(name);
    data.assignments.forEach(a=>{
      const th=node('th');th.scope='col';const title=node('span',a.title);th.append(title);
      const rate=node('small',percentage(data.students.map(s=>data.scores[s.id]?.[a.id]||''))+' complete');th.append(rate);const counts=node('details'),label=node('summary','Scores');counts.append(label);counts.append(node('small',['4','3','2','1','NE'].map(score=>score+': '+data.students.filter(s=>data.scores[s.id]?.[a.id]===score).length).join(' · ')));th.append(counts);tr.append(th);
    });head.append(tr);table.append(head);const body=node('tbody');
    data.students.forEach(student=>{
      const row=node('tr'),name=node('th');name.scope='row';const link=node('a',student.name);link.href='mailto:'+student.email;link.title=student.email;name.append(link);row.append(name);
      data.assignments.forEach(a=>{
        const cell=node('td'),value=data.scores[student.id]?.[a.id]||'';
        if(canEdit){const select=node('select');select.dataset.student=student.id;select.dataset.assignment=a.id;select.setAttribute('aria-label',student.name+' — '+a.title);const options=['','4','3','2','1','NE'];if(value&&!options.includes(value))options.push(value);
          options.forEach(score=>{const option=node('option',score||'Not scored');option.value=score;if(score===value)option.selected=true;if(score&&!['4','3','2','1','NE'].includes(score))option.disabled=true;select.append(option);});
          select.addEventListener('change',()=>queueScore({student:student.id,assignment:a.id,score:select.value}));cell.append(select);
        }else cell.textContent=value||'—';row.append(cell);
      });body.append(row);
    });table.append(body);scroll.append(table);view.append(scroll);
    if(!data.assignments.length)view.append(node('p','No assignments have been added yet.'));
    if(!Array.isArray(data.completionScores))view.append(node('p','Completion percentages will appear once the scoring rule is configured. Imported Yes/No values are preserved.'));
  }
  function scoreControls(){
    const pending=scoreQueue.length>0;
    host.querySelectorAll('button,input,select').forEach(el=>{if(!el.matches('tbody select'))el.disabled=pending;});
    view.querySelectorAll('tbody select').forEach(el=>{
      const edit=[...scoreQueue].reverse().find(e=>e.student===el.dataset.student&&e.assignment===el.dataset.assignment);
      el.value=edit?edit.score:(data.scores[el.dataset.student]?.[el.dataset.assignment]||'');
      el.classList.toggle('score-pending',Boolean(edit));
      el.setAttribute('aria-description',edit?'Not saved yet':'Saved');
    });
    let notice=q('[data-save-notice]');if(!notice){notice=node('div');notice.dataset.saveNotice='';notice.setAttribute('role','status');view.prepend(notice);}
    notice.replaceChildren(node('span',saveError?'Some scores are not saved. Review the latest data before retrying. ':pending?`Saving ${scoreQueue.length} score change(s)… You can keep entering scores.`:'All scores saved.'));
    if(saveError){
      const retry=node('button','Retry unsaved scores');retry.type='button';retry.addEventListener('click',async()=>{
        if(savingScores)return;retry.disabled=true;
        try{data=await api('tracker');if(!['administrator','manager','editor'].includes(data.role)){lock('Editing access has ended.');return;}saveError=false;flushScores();}
        catch(e){if(e.status===401)lock();else{notice.firstChild.textContent=e.message+' ';retry.disabled=false;}}
      });notice.append(retry);
    }
  }
  function queueScore(edit){
    if(!data||expired())return;
    scoreQueue.push(edit);scoreControls();clearTimeout(queueTimer);queueTimer=setTimeout(flushScores,250);
  }
  async function flushScores(){
    if(savingScores||saveError||!scoreQueue.length||!data)return;
    if(expired())return;
    savingScores=true;const current=version,batch=scoreQueue.slice(0,8);
    try{
      const result=await api('tracker-update',{revision:data.revision,change:{type:'scores',edits:batch}});
      if(current!==version||!data)return;
      data=result;scoreQueue.splice(0,batch.length);scoreControls();
      // Update completion totals without replacing controls or moving keyboard focus.
      const all=[];data.students.forEach(s=>data.assignments.forEach(a=>all.push(data.scores[s.id]?.[a.id]||'')));
      q('.trip-summary').textContent=`${data.students.length} students · ${data.assignments.length} assignments · Overall completion: ${percentage(all)}`;
      view.querySelectorAll('thead th:not(:first-child)').forEach((th,index)=>{
        const a=data.assignments[index],values=data.students.map(s=>data.scores[s.id]?.[a.id]||'');
        th.querySelector('small').textContent=percentage(values)+' complete';
        th.querySelector('details small').textContent=['4','3','2','1','NE'].map(score=>score+': '+values.filter(v=>v===score).length).join(' · ');
      });
      const breakdown=[...view.querySelectorAll('details')].find(el=>el.querySelector('summary')?.textContent==='Score breakdown');
      if(breakdown){const ps=breakdown.querySelectorAll('p');ps[0].textContent=['4','3','2','1','NE'].map(score=>score+': '+all.filter(v=>v===score).length).join(' · ');ps[1].textContent='Not scored: '+all.filter(v=>!v).length+' · Imported legacy values: '+all.filter(v=>v&&!['4','3','2','1','NE'].includes(v)).length+'. Only a score of 4 counts as completed.';}
    }catch(e){if(current===version&&data){if(e.status===401||e.status===403)lock('Editing access has ended. Sign in again to continue.');else{saveError=true;scoreControls();status.textContent=e.message;}}}
    finally{savingScores=false;if(scoreQueue.length&&!saveError&&data)flushScores();}
  }
  window.addEventListener('beforeunload',event=>{if(scoreQueue.length){event.preventDefault();event.returnValue='';}});
  async function load(){if(busy||!period)return;const current=++version;clear();login.hidden=true;setBusy(true);status.textContent='Opening period '+period+'…';try{
    await window.NestAuth.ready;
    if(!window.NestAuth.identity){lock();return;}
    const result=await api('tracker');if(current===version)render(result);
  }catch(e){if(current!==version)return;
    if(e.status===401){
      try{await window.NestAuth.refresh();}catch{lock('NEST could not check your sign-in right now. Please try again.',false);return;}
      lock(window.NestAuth.identity?'NEST could not open this period. Choose it again to retry.':'Your NEST sign-in has ended. Sign in again to continue.');
    }else lock(e.status===403?'Your NEST account does not have access to this period.':e.message,false);
  }finally{if(current===version)setBusy(false);}}
  async function save(change){if(busy||!data||expired())return;setBusy(true);try{render(await api('tracker-update',{revision:data.revision,change}));}catch(e){if(e.status===401)lock();else {render(data);status.textContent=e.message;}}finally{setBusy(false);}}
  function csvCell(value){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
  async function download(target){if(!target||busy||scoreQueue.length||expired())return;setBusy(true);status.textContent='Preparing your CSV download…';try{
    const response=await fetch('/api/spinner',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(55000),body:JSON.stringify({action:'export',period:target})});const result=await response.json();if(!response.ok)throw new Error(result.error);
    const lines=[['Student','Email',...result.assignments.map(a=>a.title)],...result.students.map(s=>[s.name,s.email,...result.assignments.map(a=>result.scores[s.id]?.[a.id]||'')])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=node('a');link.href=url;link.download='NEST-Period-'+target+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='CSV downloaded for '+(target==='CTSO'?'Robotics':'Period '+target)+'.';
  }catch(e){status.textContent=e.message;}finally{setBusy(false);}}
  host.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>{if(busy)return;period=button.dataset.period;host.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));load();}));
  q('[data-open-login]').addEventListener('click',()=>window.NestAuth?.open());
  document.addEventListener('nest-auth-change',()=>{if(!window.NestAuth?.identity){lock();}else if(period&&!busy){load();}});
  document.addEventListener('visibilitychange',expired);window.addEventListener('pageshow',expired);
})();
