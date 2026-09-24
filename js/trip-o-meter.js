(() => {
  const host=document.getElementById('trip-app');if(!host)return;
  const q=s=>host.querySelector(s);let period='',data=null,busy=false,expiryTimer,version=0;
  const status=q('[data-status]'),login=q('[data-login]'),view=q('[data-view]'),periodSelect=q('[data-period-select]'),refresh=q('[data-refresh]'),exportButton=q('[data-export]');
  let scoreQueue=[],savingScores=false,saveError=false,queueTimer,activeGesture=null,editingTitle=false;
  const scores=['4','3','2','1','A','NE','Yes','No'];
  let display={sort:'last',showRoles:true,nameWidth:190};
  const collator=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});
  function displayKey(){const user=String(window.NestAuth?.identity?.username||window.NestAuth?.identity?.email||'account').toLowerCase();return 'nest-tracker-display:'+user+':'+period;}
  function readDisplay(){try{const saved=JSON.parse(localStorage.getItem(displayKey())||'{}');return {sort:saved.sort==='first'?'first':'last',showRoles:saved.showRoles!==false,nameWidth:Number.isInteger(saved.nameWidth)&&saved.nameWidth>=130&&saved.nameWidth<=500?saved.nameWidth:190};}catch{return {sort:'last',showRoles:true,nameWidth:190};}}
  function saveDisplay(){try{localStorage.setItem(displayKey(),JSON.stringify(display));}catch{status.textContent='Display choices could not be saved in this browser.';}}
  function nameParts(value){const name=String(value||'').trim(),comma=name.indexOf(',');if(comma>=0)return {first:name.slice(comma+1).trim(),last:name.slice(0,comma).trim()};const words=name.split(/\s+/);return {first:words[0]||'',last:words.slice(1).join(' ')||words[0]||''};}
  function sortedStudents(){return [...data.students].sort((a,b)=>{const left=nameParts(a.name),right=nameParts(b.name),primary=display.sort==='first'?'first':'last',secondary=display.sort==='first'?'last':'first';return collator.compare(left[primary],right[primary])||collator.compare(left[secondary],right[secondary])||collator.compare(a.id,b.id);});}
  const scoreKey=e=>e.student+':'+e.assignment;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  function clear(){if(activeGesture)activeGesture();editingTitle=false;data=null;clearTimeout(expiryTimer);view.replaceChildren();view.hidden=true;exportButton.hidden=true;}
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
  function overview(values){const students=data.students.length,assignments=data.assignments.length;return ` · ${students} student${students===1?'':'s'} · ${assignments} assignment${assignments===1?'':'s'} · Overall completion: ${percentage(values)}`;}
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
  function resizeNames(event,handle,column,table){
    if(event.button!==0||!layoutReady())return;
    event.preventDefault();
    const initial=display.nameWidth,startX=event.clientX,tableWidth=parseInt(table.style.width,10),oldStatus=status.textContent;
    let width=initial;
    const preview=value=>{width=Math.max(130,Math.min(500,Math.round(value)));column.style.width=width+'px';table.style.width=tableWidth+width-initial+'px';};
    const cleanup=()=>{handle.classList.remove('trip-resizing');status.textContent=oldStatus;};
    pointerGesture(handle,event,move=>{preview(initial+move.clientX-startX);handle.classList.add('trip-resizing');status.textContent='Student name width: '+width+' pixels. Press Escape to cancel.';},()=>{
      cleanup();if(width!==initial){display.nameWidth=width;saveDisplay();}
    },()=>{preview(initial);cleanup();});
  }
  function rerenderDisplay(){if(!layoutReady())return;const result=data,scroll=q('.trip-table-scroll'),left=scroll?.scrollLeft||0,top=scroll?.scrollTop||0;render(result);const current=q('.trip-table-scroll');if(current){current.scrollLeft=left;current.scrollTop=top;}q('.trip-student-sort')?.focus();}
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
    status.textContent='';exportButton.hidden=data.role!=='administrator';
    scheduleExpiry();
    const all=[];data.students.forEach(s=>data.assignments.forEach(a=>all.push(data.scores[s.id]?.[a.id]||'')));
    const breakdown=node('details'),heading=node('summary');breakdown.className='trip-score-breakdown';heading.append(node('strong','Score breakdown'),node('span',overview(all)));breakdown.append(heading);
    const list=node('p',scores.map(score=>score+': '+all.filter(v=>v===score).length).join(' · '));breakdown.append(list);
    breakdown.append(node('p','Not scored: '+all.filter(v=>!v).length+' · Other imported values: '+all.filter(v=>v&&!scores.includes(v)).length+'. Only a score of 4 counts as completed.'));view.append(breakdown);
    if(canEdit){
      const form=node('form'),input=node('input');input.required=true;input.maxLength=100;input.placeholder='New assignment title';input.setAttribute('aria-label','New assignment title');
      const add=node('button','Add assignment');add.type='submit';form.append(input,add);form.className='trip-toolbar';form.addEventListener('submit',event=>{event.preventDefault();save({type:'assignment',title:input.value});});view.append(form);
    }
    const scroll=node('div');scroll.className='trip-table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Period '+period+' tracker. Scroll horizontally for assignments.');
    const table=node('table'),caption=node('caption','Period '+period+' assignments');table.append(caption);
    const columns=node('colgroup'),studentColumn=node('col');studentColumn.style.width=display.nameWidth+'px';columns.append(studentColumn);
    const assignmentColumns=data.assignments.map(a=>{const column=node('col');column.style.width=(a.width||180)+'px';columns.append(column);return column;});
    table.append(columns);table.style.width=(display.nameWidth+data.assignments.reduce((sum,a)=>sum+(a.width||180),0))+'px';
    const head=node('thead'),tr=node('tr');const name=node('th');name.scope='col';name.className='trip-name-header';name.append(node('strong','Student'));
    const sort=node('select');sort.className='trip-student-sort';sort.setAttribute('aria-label','Sort students by');for(const [value,label] of [['last','By last name'],['first','By first name']]){const option=node('option',label);option.value=value;sort.append(option);}sort.value=display.sort;sort.addEventListener('change',()=>{display.sort=sort.value;saveDisplay();rerenderDisplay();});name.append(sort);
    const toggle=node('button',display.showRoles?'Hide roles':'Show roles');toggle.type='button';toggle.className='trip-role-toggle';toggle.addEventListener('click',()=>{display.showRoles=!display.showRoles;saveDisplay();toggle.textContent=display.showRoles?'Hide roles':'Show roles';view.querySelectorAll('.trip-leadership-role').forEach(role=>role.hidden=!display.showRoles);});name.append(toggle);
    const nameGrip=node('button');nameGrip.type='button';nameGrip.className='trip-column-resize trip-name-resize';nameGrip.title='Drag this border to resize the student name column.';nameGrip.setAttribute('aria-label','Drag right edge to resize student name column');nameGrip.addEventListener('pointerdown',event=>resizeNames(event,nameGrip,studentColumn,table));name.append(nameGrip);tr.append(name);
    data.assignments.forEach(a=>{
      const th=node('th');th.scope='col';th.dataset.assignment=a.id;if(canEdit){
        th.className='trip-movable-column';
        const drag=node('button'),title=node('span',a.title);drag.type='button';drag.className='trip-column-drag';drag.title='Drag a column heading to move it, drag its right edge to resize it.';title.title='Double-click its name to rename it.';drag.setAttribute('aria-label','Drag '+a.title+' column to move. Double-click the name to rename.');drag.append(node('span','⠿'),title);drag.addEventListener('pointerdown',event=>dragColumn(event,drag,a,scroll,[...tr.querySelectorAll('th[data-assignment]')]));drag.addEventListener('dblclick',event=>editAssignmentTitle(event,drag,a));th.append(drag);
        const grip=node('button');grip.type='button';grip.className='trip-column-resize';grip.title='Drag a column heading to move it, drag its right edge to resize it.';grip.setAttribute('aria-label','Drag right edge to resize '+a.title+' column');grip.addEventListener('pointerdown',event=>resizeColumn(event,grip,a,assignmentColumns[data.assignments.indexOf(a)],table));th.append(grip);
      }else th.append(node('span',a.title));
      const rate=node('small',percentage(data.students.map(s=>data.scores[s.id]?.[a.id]||''))+' complete');th.append(rate);const counts=node('details'),label=node('summary','Scores');counts.append(label);counts.append(node('small',scores.map(score=>score+': '+data.students.filter(s=>data.scores[s.id]?.[a.id]===score).length).join(' · ')));th.append(counts);
      if(canEdit){
        const controls=node('details'),summary=node('summary','Column options');controls.className='trip-column-controls';controls.append(summary);
        const remove=node('button','Delete column');remove.type='button';remove.className='trip-column-delete';remove.setAttribute('aria-label','Delete '+a.title+' column');remove.addEventListener('click',()=>{const count=data.students.filter(s=>data.scores[s.id]?.[a.id]).length;if(window.confirm(`Delete “${a.title}” and ${count} saved score${count===1?'':'s'} from this period? This cannot be undone.`))save({type:'delete',assignment:a.id});});controls.append(remove);th.append(controls);
      }
      tr.append(th);
    });head.append(tr);table.append(head);const body=node('tbody');
    const visibleStudents=sortedStudents();visibleStudents.forEach(student=>{
      const row=node('tr'),name=node('th');name.scope='row';const link=node('a',student.name);link.href='mailto:'+student.email;link.title=student.email;name.append(link);row.append(name);
      if(student.leadershipRole){const role=node('small',student.leadershipRole);role.className='trip-leadership-role';role.hidden=!display.showRoles;name.append(role);}
      data.assignments.forEach(a=>{
        const cell=node('td'),value=data.scores[student.id]?.[a.id]||'';cell.dataset.score=value;
        if(canEdit){const select=node('select');select.dataset.student=student.id;select.dataset.assignment=a.id;select.setAttribute('aria-label',student.name+' — '+a.title);const options=['',...scores];if(value&&!options.includes(value))options.push(value);
          options.forEach(score=>{const option=node('option',score||'Not scored');option.value=score;if(score===value)option.selected=true;if(score&&!scores.includes(score))option.disabled=true;select.append(option);});
          select.addEventListener('change',()=>{cell.dataset.score=select.value;queueScore({student:student.id,assignment:a.id,score:select.value});});
          if(student===visibleStudents[0]){const group=node('div'),fill=node('button','↓');group.className='trip-first-score';fill.type='button';fill.className='trip-fill-column';fill.setAttribute('aria-label','Apply first score down '+a.title+' column');fill.title='Use the down arrow beside the first score in a column to fill its unscored cells. If the first score is Not scored, the arrow can clear that column after confirmation.';fill.addEventListener('click',()=>fillColumn(a,select.value,student.id));group.append(select,fill);cell.append(group);}else cell.append(select);
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
  function queueScores(edits){
    if(!data||expired())return;
    scoreQueue.push(...edits);scoreControls();clearTimeout(queueTimer);queueTimer=setTimeout(flushScores,250);
  }
  function queueScore(edit){queueScores([edit]);}
  function fillColumn(assignment,firstScore,firstStudentId){
    if(!layoutReady()||!data.students.length)return;
    if(firstScore&&!scores.includes(firstScore)){status.textContent='This imported score cannot be copied. Choose a standard score first.';return;}
    const clear=!firstScore;
    const targets=data.students.filter(student=>{
      const current=data.scores[student.id]?.[assignment.id]||'';
      return clear?Boolean(current):student.id!==firstStudentId&&!current;
    });
    if(!targets.length){status.textContent=clear?'This column is already clear.':'There are no unscored cells in this column.';return;}
    if(clear&&!window.confirm(`Clear all ${targets.length} saved score${targets.length===1?'':'s'} in “${assignment.title}”? This cannot be undone.`))return;
    queueScores(targets.map(student=>({student:student.id,assignment:assignment.id,score:clear?'':firstScore})));
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
      q('.trip-score-breakdown summary span').textContent=overview(all);
      view.querySelectorAll('thead th:not(:first-child)').forEach((th,index)=>{
        const a=data.assignments[index],values=data.students.map(s=>data.scores[s.id]?.[a.id]||'');
        th.querySelector('small').textContent=percentage(values)+' complete';
        th.querySelector('details small').textContent=scores.map(score=>score+': '+values.filter(v=>v===score).length).join(' · ');
      });
      const breakdown=q('.trip-score-breakdown');
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
  periodSelect.addEventListener('change',()=>{if(busy)return;period=periodSelect.value;display=readDisplay();refresh.disabled=!period;exportButton.hidden=true;if(period)load();else{clear();status.textContent='';}});
  refresh.addEventListener('click',load);
  exportButton.addEventListener('click',()=>download(period));
  q('[data-open-login]').addEventListener('click',()=>window.NestAuth?.open());
  document.addEventListener('nest-auth-change',()=>{if(!window.NestAuth?.identity){lock();}else if(period&&!busy){display=readDisplay();load();}});
  document.addEventListener('visibilitychange',expired);window.addEventListener('pageshow',expired);
})();
