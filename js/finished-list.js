(() => {
  const host=document.getElementById('finished-list');if(!host)return;
  const q=selector=>host.querySelector(selector),status=q('#finished-status'),items=q('#finished-items'),form=q('#finished-form'),add=q('#finished-add'),refresh=q('#finished-refresh'),signIn=q('#finished-signin'),search=q('#finished-search'),filter=q('#finished-skill-filter'),modeFilter=q('#finished-mode-filter'),picker=q('#finished-skills'),file=q('#finished-icon-file'),preview=q('#finished-icon-preview');
  let entries=[],skills=[],generation=0,busy=false,pending=null,canAdd=false,canEdit=false,editing=null,icon='',iconGeneration=0,preparingIcon=false;
  const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  const selectedSkills=()=>[...picker.querySelectorAll('input:checked')].map(input=>input.value);
  function skillSummary(){q('#finished-skill-summary').textContent=selectedSkills().length?selectedSkills().length+' skills selected':'Choose 21st century skills';}
  function skillOptions(){
    const selected=selectedSkills(),choice=filter.value;picker.replaceChildren(node('legend','Choose one or more skills'));filter.replaceChildren(new Option('All skills',''));
    for(const skill of skills){
      const label=node('label'),input=node('input');input.type='checkbox';input.value=skill;input.checked=selected.includes(skill);input.addEventListener('change',skillSummary);label.append(input,node('span',skill));picker.append(label);
      const count=entries.filter(entry=>entry.skills?.includes(skill)).length;filter.append(new Option(skill+' ('+count+')',skill));
    }
    filter.value=skills.includes(choice)?choice:'';skillSummary();
  }
  const modeLabels={solo:'Solo',partner:'Partner',team:'Team'};
  const entryMode=entry=>modeLabels[entry.mode]?entry.mode:'solo';
  function render(){
    const term=search.value.trim().toLocaleLowerCase(),shown=entries.filter(entry=>(!modeFilter.value||entryMode(entry)===modeFilter.value)&&(!filter.value||entry.skills?.includes(filter.value))&&[entry.title,entry.description,modeLabels[entryMode(entry)],...(entry.skills||[])].join(' ').toLocaleLowerCase().includes(term));
    items.replaceChildren();
    for(const entry of shown){
      const card=node('article');card.className='finished-card';const heading=node('div');heading.className='finished-card-heading';
      if(entry.icon){const image=node('img');image.src=entry.icon;image.alt='';image.className='finished-tool-icon';image.loading='lazy';image.addEventListener('error',()=>image.hidden=true,{once:true});heading.append(image);}
      else{const fallback=node('span','↗');fallback.className='finished-icon-fallback';fallback.setAttribute('aria-hidden','true');heading.append(fallback);}
      heading.append(node('h3',entry.title));card.append(heading);
      const workStyle=node('div');workStyle.className='finished-work-style';const silhouette=node('img');silhouette.src='/assets/finished-list/work-'+entryMode(entry)+'.svg';silhouette.alt='';silhouette.width=24;silhouette.height=24;workStyle.append(silhouette,node('span',modeLabels[entryMode(entry)]));card.append(workStyle);
      const tags=node('div');tags.className='finished-tags';tags.setAttribute('aria-label','21st century skills');
      for(const skill of entry.skills||[]){const tag=node('button',skill);tag.type='button';tag.addEventListener('click',()=>{filter.value=skill;render();filter.focus();});tags.append(tag);}card.append(tags);
      const label=node('p','Learning purpose');label.className='finished-label';card.append(label,node('p',entry.description));
      if(entry.url){const link=node('a','Explore '+entry.title+' ↗');link.href=entry.url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Open '+entry.title);card.append(link);}
      else{const note=node('span','Offline project · follow the learning purpose');note.className='finished-offline';card.append(note);}
      if(canEdit){const edit=node('button','Edit resource');edit.type='button';edit.className='finished-edit';edit.setAttribute('aria-label','Edit '+entry.title);edit.addEventListener('click',()=>editEntry(entry));card.append(edit);}
      items.append(card);
    }
    q('#finished-category-title').textContent='Finished List · '+(filter.value||'All skills')+(modeFilter.value?' · '+modeLabels[modeFilter.value]:'');q('#finished-count').textContent=shown.length+' of '+entries.length+' activities';q('#finished-empty').hidden=shown.length!==0;
  }
  function controls(){add.hidden=!(canAdd||canEdit);signIn.hidden=Boolean(window.NestAuth?.identity);refresh.disabled=busy||preparingIcon;form.querySelectorAll('input,textarea,select,button').forEach(element=>element.disabled=busy||preparingIcon);host.querySelectorAll('.finished-edit').forEach(element=>element.disabled=busy||preparingIcon);}
  function iconPreview(){preview.hidden=!icon;if(icon)preview.src=icon;else preview.removeAttribute('src');q('#finished-icon-remove').hidden=!icon;}
  function resetEditor(){form.reset();editing=null;icon='';pending=null;iconGeneration++;preparingIcon=false;iconPreview();skillSummary();q('#finished-save').textContent='Add to Finished List';q('#finished-cancel').hidden=true;q('#finished-delete').hidden=true;form.elements.url.required=true;add.querySelector('summary').textContent='Add a learning resource';}
  function editEntry(entry){
    if(busy||preparingIcon)return;
    if(editing&&editing.id!==entry.id&&!window.confirm('Replace your current draft with this resource?'))return;
    resetEditor();editing={id:entry.id,version:entry.version};form.elements.title.value=entry.title;form.elements.url.value=entry.url;form.elements.url.required=Boolean(entry.url);form.elements.description.value=entry.description;form.elements.mode.value=entryMode(entry);
    picker.querySelectorAll('input').forEach(input=>input.checked=entry.skills?.includes(input.value));skillSummary();icon=entry.icon||'';iconPreview();q('#finished-save').textContent='Save changes';q('#finished-cancel').hidden=false;q('#finished-delete').hidden=false;add.querySelector('summary').textContent='Edit learning resource';add.open=true;add.scrollIntoView?.({block:'start',behavior:'smooth'});form.elements.title.focus();
  }
  async function request(options={}){
    const response=await fetch('/api/finished-list',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(55000),...options});
    let result;try{result=await response.json();}catch{throw new Error('The Finished List is unavailable. Your draft is kept.');}
    if(!response.ok)throw Object.assign(new Error(result.error||'Unable to open the Finished List.'),{status:response.status});return result;
  }
  function show(result){entries=result.entries;skills=result.skills||[];canAdd=result.canAdd===true;canEdit=result.canEdit===true;skillOptions();render();controls();}
  async function load(){
    if(busy||preparingIcon)return;const own=++generation;busy=true;controls();status.textContent='Opening the Finished List…';
    try{
      await window.NestAuth?.ready;if(own!==generation)return;
      const result=await request();if(own!==generation)return;show(result);status.textContent='';
      if(pending?.fields.operation==='delete'&&!entries.some(entry=>entry.id===pending.fields.id)){resetEditor();add.open=false;status.textContent='The tool was deleted from the Finished List.';}
      if(pending&&entries.some(entry=>entry.id===(pending.fields.id||pending.id)&&['title','description','url','icon','skills','mode'].every(key=>JSON.stringify(entry[key]||'')===JSON.stringify(pending.fields[key]||'')))){resetEditor();status.textContent='Your resource is saved in the Finished List.';}
    }catch(error){if(own===generation)status.textContent=error.message;}
    finally{if(own===generation){busy=false;controls();}}
  }
  file.addEventListener('change',async()=>{
    const imageFile=file.files?.[0];if(!imageFile)return;const own=++iconGeneration;preparingIcon=true;controls();status.textContent='Preparing icon…';
    try{
      if(!['image/png','image/jpeg','image/webp'].includes(imageFile.type)||imageFile.size>5*1024*1024)throw new Error('Choose a PNG, JPEG, or WebP smaller than 5 MB.');
      const bitmap=await createImageBitmap(imageFile);
      try{if(own!==iconGeneration)return;const scale=Math.min(1,128/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const value=canvas.toDataURL('image/webp',.85);if(value.length>44000)throw new Error('Choose a simpler or smaller icon.');icon=value;iconPreview();status.textContent='Icon ready. Save the resource to apply it.';}finally{bitmap.close();}
    }catch(error){if(own===iconGeneration)status.textContent=error.message||'This image could not be opened. Choose a different icon.';}
    finally{if(own===iconGeneration){preparingIcon=false;file.value='';controls();}}
  });
  q('#finished-icon-remove').addEventListener('click',()=>{icon='';iconGeneration++;iconPreview();});
  q('#finished-cancel').addEventListener('click',()=>{resetEditor();add.open=false;controls();status.textContent='Editing canceled.';});
  q('#finished-delete').addEventListener('click',async()=>{
    if(busy||preparingIcon||!canEdit||!editing)return;
    const title=entries.find(entry=>entry.id===editing.id)?.title||'this tool';
    if(!window.confirm('Delete “'+title+'” from the Finished List? This removes its link, description, icon, and skill tags for everyone. This cannot be undone.'))return;
    const fields={operation:'delete',...editing},key=JSON.stringify(fields);
    if(pending?.key!==key)pending={key,id:crypto.randomUUID(),fields};
    const own=++generation;busy=true;controls();status.textContent='Deleting tool…';
    try{
      const result=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,requestId:pending.id})});
      if(own!==generation)return;show(result);resetEditor();add.open=false;render();status.textContent='The tool was deleted from the Finished List.';
    }catch(error){if(own===generation){if([401,403].includes(error.status)){canAdd=false;canEdit=false;render();controls();}status.textContent=error.message;}}
    finally{if(own===generation){busy=false;controls();}}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||preparingIcon||!(editing?canEdit:canAdd)||!form.reportValidity())return;
    const fields={operation:editing?'update':'add',...(editing||{}),title:form.elements.title.value.trim(),url:form.elements.url.value.trim(),description:form.elements.description.value.trim(),skills:selectedSkills(),icon,mode:form.elements.mode.value};
    if(!fields.title||!fields.description||!fields.skills.length){status.textContent='Enter a title, a learning purpose, and at least one skill.';return;}
    const key=JSON.stringify(fields);if(pending?.key!==key)pending={key,id:crypto.randomUUID(),fields};
    const own=++generation;busy=true;controls();status.textContent=editing?'Saving resource changes…':'Adding your learning resource…';
    try{
      const updated=Boolean(editing),result=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,requestId:pending.id})});
      if(own!==generation)return;show(result);resetEditor();search.value='';filter.value='';modeFilter.value='';render();status.textContent=updated?'Your resource changes were saved.':'Your resource was added to the Finished List.';
    }catch(error){if(own===generation){if([401,403].includes(error.status)){canAdd=false;canEdit=false;render();controls();}status.textContent=error.message;}}
    finally{if(own===generation){busy=false;controls();}}
  });
  search.addEventListener('input',render);filter.addEventListener('change',render);modeFilter.addEventListener('change',render);refresh.addEventListener('click',load);signIn.addEventListener('click',()=>window.NestAuth?.open());
  let account=window.NestAuth?.identity?.username||window.NestAuth?.identity?.email||'';
  document.addEventListener('nest-auth-change',()=>{
    const next=window.NestAuth?.identity?.username||window.NestAuth?.identity?.email||'';generation++;busy=false;canAdd=false;canEdit=false;
    if(next!==account){resetEditor();add.open=false;account=next;}render();controls();load();
  });
  load();
})();
