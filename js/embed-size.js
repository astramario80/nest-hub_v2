// Enlarge existing frames in place so their navigation and forms stay loaded.
(() => {
  if(window.NestEmbedSize)return;
  window.NestEmbedSize=true;
  const controls=new Map();let expanded=null;
  function restore(){
    if(!expanded)return;
    const {frame,container,button}=expanded;expanded=null;
    frame.classList.remove('nest-expanded-frame');container.classList.remove('nest-expanded-embed');
    button.classList.remove('nest-active-expand');button.textContent='Expand view';button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Expand '+(frame.title||'embedded content')+' view');
    document.body.classList.remove('nest-embed-expanded');
    if(button.isConnected)button.focus();
  }
  async function toggle(frame,button){
    if(expanded){
      if(document.fullscreenElement){try{await document.exitFullscreen();}catch{}}
      restore();return;
    }
    const container=frame.parentElement;
    expanded={frame,container,button};
    container.classList.add('nest-expanded-embed');frame.classList.add('nest-expanded-frame');
    button.classList.add('nest-active-expand');button.textContent='Restore view';button.setAttribute('aria-expanded','true');button.setAttribute('aria-label','Restore '+(frame.title||'embedded content')+' view');
    document.body.classList.add('nest-embed-expanded');button.focus();
    // Fullscreen also works inside modal dialogs and exits with the browser's Escape key.
    // The viewport layout remains available when fullscreen is unsupported or denied.
    try{await container.requestFullscreen?.();}catch{}
  }
  function scan(){
    if(!document?.body)return;
    if(expanded&&!expanded.frame.isConnected)restore();
    for(const [frame,button] of controls){if(!frame.isConnected){button.remove();controls.delete(frame);}}
    document.querySelectorAll('iframe').forEach(frame=>{
      if(controls.has(frame)||frame.closest('.resource-viewer'))return;
      const button=document.createElement('button');button.type='button';button.className='nest-embed-expand';
      button.textContent='Expand view';button.setAttribute('aria-label','Expand '+(frame.title||'embedded content')+' view');button.setAttribute('aria-expanded','false');
      button.addEventListener('click',()=>toggle(frame,button));
      frame.before(button);controls.set(frame,button);
    });
  }
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)restore();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&expanded&&!document.fullscreenElement){event.preventDefault();restore();}});
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  scan();
})();
