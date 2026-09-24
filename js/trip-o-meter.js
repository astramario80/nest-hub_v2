(() => {
  const host=document.getElementById('trip-app');if(!host)return;
  const q=s=>host.querySelector(s);let period='',data=null,busy=false,expiryTimer,version=0;
  const status=q('[data-status]'),login=q('[data-login]'),view=q('[data-view]');
  let scoreQueue=[],savingScores=false,saveError=false,queueTimer,activeGesture=null,editingTitle=false;
  const scores=['4','3','2','1','A','NE','Yes','No'];
  const scoreKey=e=>e.student+':'+e.assignment;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  function clear(){if(activeGesture)activeGesture();editingTitle=false;data=null;clearTimeout(expiryTimer);view.replaceChildren();view.hidden=true;}
  function setBusy(value){busy=value;host.setAttribute('aria-busy',String(value));host.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);}
  async function api(action,extra={}){
    const response=await fetch('/api/spinner',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(55000),body:JSON.stringify({action,period,...extra})});
    let result;try{result=await response.json();}catch{throw new Error('Access is temporarily unavailable. Please try again.');}
    if(!response.ok)throw Object.assign(new Error(result.error||'Unable to complete this request.'),{status:response.status});return result;
  }
  function lock(message,needsLogin=!window.NestAuth?.identity){scoreQueue=[];saveError=false;clearTimeout(queueTimer);clear();login.hidden=!needsLogin;status.textContent=message||(needsLogin?'Sign in to NEST to open this period.':'Choose a period. NEST will check your access.');}
  function expired(){if(data&&Date.now()>=Math.min(data.expires,data.editExpires||data.expires)){lock('Your access to this period has ended. Choose the period to refresh.');return true;}return false;}
  function scheduleExpiry(){
    if(!data)return;
    const remaining=Math.min(data.expires,data.editExpires||data.expires)-Date.now();
    if(remaining<=0){expired();return;}
    expiryTimer=setTimeout(scheduleExpiry,Math.min(remaining,2147483647));
  }
  function percentage(values){if(!Array.isArray(data.completionScores))return 'Pending scoring rule';if(!values.length)return '—';return Math.round(values.filter(v=>data.completionScores.includes(v)).length/values.length*100)+'%';}
  function layoutReady(){return data&&!busy&&!savingScores&&!scoreQueue.length&&!saveError&&!editingTitle&&!expired();}
  function pointerGesture(handle,start,onMove,onDrop,onCancel){
    if(activeGesture)activeGesture();
    const pointerId=start.pointerId;
    let done=false;
    const finish=commit=>{
      if(done)return;done=true;
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);
      if(handle.releasePointerCapture&&handle.hasPointerCapture?.(pointerId))handle.releasePointerCapture(pointerId);
      activeGesture=null;
      if(commit)onDrop();else onCancel();
    };
    const move=event=>{if(event.pointerId===pointerId)onMove(event);};
    const up=event=>{if(event.pointerId===pointerId)finish(true);};
    const cancel=event=>{if(event.pointerId===pointerId)finish(false);};
    const key=event=>{if(event.key==='Escape'){event.preventDefault();finish(false);}};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key);
    activeGesture=()=>finish(false);
    if(handle.setPointerCapture)handle.setPointerCapture(pointerId);
  }
  function dragColumn(event,handle,assignment,scroll,headers){
    if(event.button!==0||!layoutReady())return;
    const from=data.assignments.findIndex(item=>item.id===assignment.id),startX=event.clientX,oldStatus=status.textContent;
    let moved=false,slot=from;
    const mark=()=>{
      headers.forEach(th=>th.classList.remove('trip-drop-before','trip-drop-after'));
      const target=headers[Math.min(slot,headers.length-1)];
      if(target)target.classList.add(slot===headers.length?'trip-drop-after':'trip-drop-before');
    };
    const cleanup=()=>{handle.classList.remove('trip-dragging');headers.forEach(th=>th.classList.remove('trip-drop-before','trip-drop-after'));status.textContent=oldStatus;};
    pointerGesture(handle,event,move=>{
      if(Math.abs(move.clientX-startX)>5)moved=true;
      if(!moved)return;
      move.preventDefault();
      handle.classList.add('trip-dragging');
      const box=scroll.getBoundingClientRect();
      if(move.clientX>box.right-28)scroll.scrollLeft+=18;
      else if(move.clientX<box.left+28)scroll.scrollLeft-=18;
      slot=headers.filter(th=>move.clientX>th.getBoundingClientRect().left+th.getBoundingClientRect().width/2).length;
      mark();status.textContent='Release to move '+assignment.title+'. Press Escape to cancel.';
    },()=>{
      cleanup();if(!moved)return;
      const order=data.assignments.map(item=>item.id),[id]=order.splice(from,1),to=Math.max(0,Math.min(order.length,slot-(slot>from?1:0)));
      order.splice(to,0,id);if(to!==from)save({type:'reorder',order});
    },cleanup);
  }
  function resizeColumn(event,handle,assignment,column,table){
    if(event.button!==0||!layoutReady())return;
    event.preventDefault();
    const initial=assignment.width||180,startX=event.clientX,tableWidth=parseInt(table.style.width,10),oldStatus=status.textContent;
    let width=initial;
    const preview=value=>{width=Math.max(120,Math.min(600,Math.round(value)));column.style.width=width+'px';table.style.width=tableWidth+width-initial+'px';};
    const cleanup=()=>{handle.classList.remove('trip-resizing');status.textContent=oldStatus;};
    pointerGesture(handle,event,move=>{preview(initial+move.clientX-startX);handle.classList.add('trip-resizing');status.textContent=assignment.title+' width: '+width+' pixels. Press Escape to cancel.';},()=>{
      cleanup();if(width!==initial)save({type:'resize',assignment:assignment.id,width});
    },()=>{preview(initial);cleanup();});
  }
  function editAssignmentTitle(event,handle,assignment){
    if(!layoutReady())return;
    event.preventDefault();event.stopPropagation();editingTitle=true;
    const input=node('input');input.type='text';input.className='trip-inline-title';input.value=assignment.title;input.maxLength=100;input.setAttribute('aria-label','Assignment name for '+assignment.title);
    handle.hidden=true;handle.after(input);input.focus();input.select();
    let finished=false;
    const finish=commit=>{
      if(finished)return;finished=true;editingTitle=false;
      const title=input.value.trim();input.remove();handle.hidden=false;
      if(!commit){handle.focus();return;}
      if(!title){status.textContent='Assignment name cannot be empty.';handle.focus();return;}
      if(title!==assignment.title){status.textContent='Saving assignment name…';save({type:'rename',assignment:assignment.id,title});}
    };
    input.addEventListener('blur',()=>finish(true));
    input.addEventListener('keydown',key=>{if(key.key==='Enter'){key.preventDefault();finish(true);}else if(key.key==='Escape'){key.preventDefault();finish(false);}});
  }
  function render(result){
    clear();data=result;login.hidden=true;view.hidden=false;
    const canEdit=['administrator','manager','editor'].includes(data.role);
    status.textContent=`Period ${period} · ${canEdit?'Editing enabled':'View only'} · Access until ${new Date(data.expires).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
    scheduleExpiry();
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
    const list=node('p',scores.map(score=>score+': '+all.filter(v=>v===score).length).join(' · '));breakdown.append(list);
    breakdown.append(node('p','Not scored: '+all.filter(v=>!v).length+' · Other imported values: '+all.filter(v=>v&&!scores.includes(v)).length+'. Only a score of 4 counts as completed.'));view.append(breakdown);
    if(canEdit){
      const form=node('form'),input=node('input');input.required=true;input.maxLength=100;input.placeholder='New assignment title';input.setAttribute('aria-label','New assignment title');
      const add=node('button','Add assignment');add.type='submit';form.append(input,add);form.className='trip-toolbar';form.addEventListener('submit',event=>{event.preventDefault();save({type:'assignment',title:input.value});});view.append(form);
      const help=node('p','Drag a column heading to move it, drag its right edge to resize it, or double-click its name to rename it.');help.className='trip-layout-help';view.append(help);
    }
    const scroll=node('div');scroll.className='trip-table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Period '+period+' tracker. Scroll horizontally for assignments.');
    const table=node('table'),caption=node('caption','Period '+period+' assignments');table.append(caption);
    const columns=node('colgroup'),studentColumn=node('col');studentColumn.style.width='190px';columns.append(studentColumn);
    const assignmentColumns=data.assignments.map(a=>{const column=node('col');column.style.width=(a.width||180)+'px';columns.append(column);return column;});
    table.append(columns);table.style.width=(190+data.assignments.reduce((sum,a)=>sum+(a.width||180),0))+'px';
    const head=node('thead'),tr=node('tr');const name=node('th','Student');name.scope='col';tr.append(name);
    data.assignments.forEach(a=>{
      const th=node('th');th.scope='col';th.dataset.assignment=a.id;if(canEdit){
        th.className='trip-movable-column';
        const drag=node('button'),title=node('span',a.title);drag.type='button';drag.className='trip-column-drag';drag.title='Drag to move; double-click the name to rename';drag.setAttribute('aria-label','Drag '+a.title+' column to move. Double-click the name to rename.');drag.append(node('span','⠿'),title);drag.addEventListener('pointerdown',event=>dragColumn(event,drag,a,scroll,[...tr.querySelectorAll('th[data-assignment]')]));drag.addEventListener('dblclick',event=>editAssignmentTitle(event,drag,a));th.append(drag);
        const grip=node('button');grip.type='button';grip.className='trip-column-resize';grip.title='Drag to resize this column';grip.setAttribute('aria-label','Drag right edge to resize '+a.title+' column');grip.addEventListener('pointerdown',event=>resizeColumn(event,grip,a,assignmentColumns[data.assignments.indexOf(a)],table));th.append(grip);
      }else th.append(node('span',a.title));
      const rate=node('small',percentage(data.students.map(s=>data.scores[s.id]?.[a.id]||''))+' complete');th.append(rate);const counts=node('details'),label=node('summary','Scores');counts.append(label);counts.append(node('small',scores.map(score=>score+': '+data.students.filter(s=>data.scores[s.id]?.[a.id]===score).length).join(' · ')));th.append(counts);
      if(canEdit){
        const controls=node('details'),summary=node('summary','Column options');controls.className='trip-column-controls';controls.append(summary);
        const remove=node('button','Delete column');remove.type='button';remove.className='trip-column-delete';remove.setAttribute('aria-label','Delete '+a.title+' column');remove.addEventListener('click',()=>{const count=data.students.filter(s=>data.scores[s.id]?.[a.id]).length;if(window.confirm(`Delete “${a.title}” and ${count} saved score${count===1?'':'s'} from this period? This cannot be undone.`))save({type:'delete',assignment:a.id});});controls.append(remove);th.append(controls);
      }
      tr.append(th);
    });head.append(tr);table.append(head);const body=node('tbody');
    data.students.forEach(student=>{
      const row=node('tr'),name=node('th');name.scope='row';const link=node('a',student.name);link.href='mailto:'+student.email;link.title=student.email;name.append(link);row.append(name);
      data.assignments.forEach(a=>{
        const cell=node('td'),value=data.scores[student.id]?.[a.id]||'';cell.dataset.score=value;
        if(canEdit){const select=node('select');select.dataset.student=student.id;select.dataset.assignment=a.id;select.setAttribute('aria-label',student.name+' — '+a.title);const options=['',...scores];if(value&&!options.includes(value))options.push(value);
          options.forEach(score=>{const option=node('option',score||'Not scored');option.value=score;if(score===value)option.selected=true;if(score&&!scores.includes(score))option.disabled=true;select.append(option);});
          select.addEventListener('change',()=>{cell.dataset.score=select.value;queueScore({student:student.id,assignment:a.id,score:select.value});});cell.append(select);
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
      el.closest('td').dataset.score=el.value;
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
        th.querySelector('details small').textContent=scores.map(score=>score+': '+values.filter(v=>v===score).length).join(' · ');
      });
      const breakdown=[...view.querySelectorAll('details')].find(el=>el.querySelector('summary')?.textContent==='Score breakdown');
      if(breakdown){const ps=breakdown.querySelectorAll('p');ps[0].textContent=scores.map(score=>score+': '+all.filter(v=>v===score).length).join(' · ');ps[1].textContent='Not scored: '+all.filter(v=>!v).length+' · Other imported values: '+all.filter(v=>v&&!scores.includes(v)).length+'. Only a score of 4 counts as completed.';}
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
  async function save(change){if(busy||savingScores||scoreQueue.length||!data||expired())return;const previous=q('.trip-table-scroll'),left=previous?.scrollLeft||0,top=previous?.scrollTop||0;const show=result=>{render(result);const current=q('.trip-table-scroll');if(current){current.scrollLeft=left;current.scrollTop=top;}};setBusy(true);try{show(await api('tracker-update',{revision:data.revision,change}));}catch(e){if(e.status===401)lock();else {show(data);status.textContent=e.message;}}finally{setBusy(false);}}
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
