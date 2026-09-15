(() => {
  const host=document.getElementById('trip-app');if(!host)return;
  const q=s=>host.querySelector(s);let period='',data=null,busy=false,expiryTimer,version=0;
  const status=q('[data-status]'),login=q('form'),view=q('[data-view]');
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  function clear(){data=null;clearTimeout(expiryTimer);view.replaceChildren();view.hidden=true;}
  function setBusy(value){busy=value;host.setAttribute('aria-busy',String(value));host.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);}
  async function api(action,extra={}){
    const response=await fetch('/api/spinner',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,period,...extra})});
    let result;try{result=await response.json();}catch{throw new Error('Access is temporarily unavailable. Please try again.');}
    if(!response.ok)throw Object.assign(new Error(result.error||'Unable to complete this request.'),{status:response.status});return result;
  }
  function lock(message){clear();login.hidden=false;status.textContent=message||'Verify your email to open this period. Your NEST sign-in also works in Magic Spinner.';}
  function expired(){if(data&&Date.now()>=data.expires){lock('Your six-hour access has ended. Verify again to continue.');return true;}return false;}
  function percentage(values){if(!Array.isArray(data.completionScores))return 'Pending scoring rule';if(!values.length)return '—';return Math.round(values.filter(v=>data.completionScores.includes(v)).length/values.length*100)+'%';}
  function render(result){
    clear();data=result;login.hidden=true;view.hidden=false;
    const canEdit=['administrator','manager','editor'].includes(data.role);
    status.textContent=`Period ${period} · ${canEdit?'Editing enabled':'View only'} · Access until ${new Date(data.expires).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
    expiryTimer=setTimeout(()=>lock('Your six-hour access has ended. Verify again to continue.'),Math.max(0,Math.min(data.expires,data.editExpires||data.expires)-Date.now()));
    const toolbar=node('div');toolbar.className='trip-toolbar';
    const refresh=node('button','Refresh');refresh.type='button';refresh.addEventListener('click',load);toolbar.append(refresh);
    const signout=node('button','Sign out of NEST');signout.type='button';signout.addEventListener('click',async()=>{if(busy)return;clear();setBusy(true);try{await api('logout');lock('Signed out of NEST.');}catch(e){lock(e.message);}finally{setBusy(false);}});toolbar.append(signout);
    if(data.role==='administrator'){
      const label=node('label','Download '),select=node('select');select.setAttribute('aria-label','Download period CSV');
      const empty=node('option','Choose a period…');empty.value='';select.append(empty);
      ['1','2','3','4','5','7','CTSO'].forEach(p=>{const o=node('option',(p==='CTSO'?'Robotics':'Period '+p)+' CSV');o.value=p;select.append(o);});
      select.addEventListener('change',()=>download(select.value));label.append(select);toolbar.append(label);
    }
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
        if(canEdit){const select=node('select');select.setAttribute('aria-label',student.name+' — '+a.title);const options=['','4','3','2','1','NE'];if(value&&!options.includes(value))options.push(value);
          options.forEach(score=>{const option=node('option',score||'Not scored');option.value=score;if(score===value)option.selected=true;if(score&&!['4','3','2','1','NE'].includes(score))option.disabled=true;select.append(option);});
          select.addEventListener('change',()=>save({type:'score',student:student.id,assignment:a.id,score:select.value}));cell.append(select);
        }else cell.textContent=value||'—';row.append(cell);
      });body.append(row);
    });table.append(body);scroll.append(table);view.append(scroll);
    if(!data.assignments.length)view.append(node('p','No assignments have been added yet.'));
    if(!Array.isArray(data.completionScores))view.append(node('p','Completion percentages will appear once the scoring rule is configured. Imported Yes/No values are preserved.'));
  }
  async function load(){if(busy||!period)return;const current=++version;clear();login.hidden=true;setBusy(true);status.textContent='Opening period '+period+'…';try{const result=await api('tracker');if(current===version)render(result);}catch(e){if(current===version)lock(e.status===401?undefined:e.message);}finally{if(current===version)setBusy(false);}}
  async function save(change){if(busy||!data||expired())return;setBusy(true);try{render(await api('tracker-update',{revision:data.revision,change}));}catch(e){if(e.status===401)lock();else {render(data);status.textContent=e.message;}}finally{setBusy(false);}}
  function csvCell(value){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
  async function download(target){if(!target||busy||expired())return;setBusy(true);try{
    const response=await fetch('/api/spinner',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'export',period:target})});const result=await response.json();if(!response.ok)throw new Error(result.error);
    const lines=[['Student','Email',...result.assignments.map(a=>a.title)],...result.students.map(s=>[s.name,s.email,...result.assignments.map(a=>result.scores[s.id]?.[a.id]||'')])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=node('a');link.href=url;link.download='NEST-Period-'+target+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){status.textContent=e.message;}finally{setBusy(false);}}
  host.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>{if(busy)return;period=button.dataset.period;host.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));login.reset();q('[data-code-row]').hidden=true;load();}));
  login.addEventListener('submit',async event=>{event.preventDefault();if(busy||!period)return;setBusy(true);try{const result=await api('request',{email:q('[type=email]').value});q('[data-code-row]').hidden=false;status.textContent=result.message;q('[data-code]').value='';}catch(e){status.textContent=e.message;}finally{setBusy(false);}});
  q('[data-verify]').addEventListener('click',async()=>{const code=q('[data-code]').value.trim();if(busy||!/^\d{6}$/.test(code)){status.textContent='Enter the six-digit code from your email.';return;}setBusy(true);try{await api('verify',{code});render(await api('tracker'));}catch(e){status.textContent=e.message;}finally{setBusy(false);}});
  q('[data-code]').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();q('[data-verify]').click();}});
  document.addEventListener('visibilitychange',expired);window.addEventListener('pageshow',expired);
  document.addEventListener('click',event=>{if(expired()){event.preventDefault();event.stopImmediatePropagation();}},true);
})();
