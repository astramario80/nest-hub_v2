(() => {
  const host=document.getElementById('finished-list');if(!host)return;
  const q=selector=>host.querySelector(selector),status=q('#finished-status'),items=q('#finished-items'),form=q('#finished-form'),add=q('#finished-add'),refresh=q('#finished-refresh'),signIn=q('#finished-signin'),search=q('#finished-search');
  let entries=[],generation=0,busy=false,pending=null,canAdd=false;
  const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  function render(){
    const term=search.value.trim().toLocaleLowerCase(),shown=entries.filter(entry=>[entry.title,entry.description,entry.instructions].join(' ').toLocaleLowerCase().includes(term));
    items.replaceChildren();
    for(const entry of shown){
      const card=node('article');card.className='finished-card';card.append(node('h3',entry.title));
      const label=node('p','Learning purpose');label.className='finished-label';card.append(label,node('p',entry.description));
      if(entry.instructions){const details=node('details');details.append(node('summary','Original activity instructions'),node('p',entry.instructions));card.append(details);}
      if(entry.url){const link=node('a','Explore '+entry.title+' ↗');link.href=entry.url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Open '+entry.title);card.append(link);}
      else{const note=node('span','Project idea · see original instructions');note.className='finished-offline';card.append(note);}
      items.append(card);
    }
    q('#finished-count').textContent=shown.length+' of '+entries.length+' activities';q('#finished-empty').hidden=shown.length!==0;
  }
  function controls(){add.hidden=!canAdd;signIn.hidden=Boolean(window.NestAuth?.identity);refresh.disabled=busy;form.querySelectorAll('input,textarea,button').forEach(element=>element.disabled=busy);}
  async function request(options={}){
    const response=await fetch('/api/finished-list',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(55000),...options});
    let result;try{result=await response.json();}catch{throw new Error('The Finished List is unavailable. Your draft is kept.');}
    if(!response.ok)throw Object.assign(new Error(result.error||'Unable to open the Finished List.'),{status:response.status});return result;
  }
  function show(result){entries=result.entries;canAdd=result.canAdd===true;render();controls();}
  async function load(){
    if(busy)return;const own=++generation;busy=true;controls();status.textContent='Opening the Finished List…';
    try{
      await window.NestAuth?.ready;if(own!==generation)return;
      const result=await request();if(own!==generation)return;show(result);status.textContent='';
      if(pending&&entries.some(entry=>entry.id===pending.id)){form.reset();pending=null;status.textContent='Your resource is saved in the Finished List.';}
    }catch(error){if(own===generation)status.textContent=error.message;}
    finally{if(own===generation){busy=false;controls();}}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!canAdd||!form.reportValidity())return;
    const fields={title:form.elements.title.value.trim(),url:form.elements.url.value.trim(),description:form.elements.description.value.trim()};
    if(!fields.title||!fields.description){status.textContent='Enter a title and learning purpose.';return;}
    const key=JSON.stringify(fields);if(pending?.key!==key)pending={key,id:crypto.randomUUID()};
    const own=++generation;busy=true;controls();status.textContent='Adding your learning resource…';
    try{
      const result=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,requestId:pending.id})});
      if(own!==generation)return;show(result);form.reset();pending=null;search.value='';render();status.textContent='Your resource was added to the Finished List.';
    }catch(error){if(own===generation){if([401,403].includes(error.status)){canAdd=false;controls();}status.textContent=error.message;}}
    finally{if(own===generation){busy=false;controls();}}
  });
  search.addEventListener('input',render);refresh.addEventListener('click',load);signIn.addEventListener('click',()=>window.NestAuth?.open());
  let account=window.NestAuth?.identity?.username||window.NestAuth?.identity?.email||'';
  document.addEventListener('nest-auth-change',()=>{
    const next=window.NestAuth?.identity?.username||window.NestAuth?.identity?.email||'';
    generation++;busy=false;canAdd=false;
    if(next!==account){form.reset();pending=null;add.open=false;account=next;}
    controls();load();
  });
  load();
})();
