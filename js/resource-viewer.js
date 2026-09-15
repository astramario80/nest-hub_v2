// Display original resources without copying private data or changing sharing.
(() => {
  function resource(raw) {
    const original=new URL(raw,location.href);if(original.protocol!=='https:'||original.origin===location.origin)return null;
    const url=new URL(original),host=url.hostname;
    if(['app.smartpass.app','portal.bethelsd.org','mail.google.com','accounts.google.com'].includes(host)||host.startsWith('auth.')||/\/oauth2?\//i.test(url.pathname))return {original:original.href,blocked:true,host};
    if(host==='padlet.com'){
      const id=url.pathname.match(/(?:-|\/embed\/)([a-z0-9]{10,})\/?$/i)?.[1];
      if(id){url.pathname='/embed/'+id;url.search='';url.hash='';}
    }else if(host==='docs.google.com'){
      if(url.pathname.startsWith('/forms/'))url.searchParams.set('embedded','true');
      else if(/^\/document\/d\//.test(url.pathname)){url.pathname=url.pathname.replace(/\/(edit|view|preview).*$/,'/preview');url.search='';url.hash='';}
      else if(/^\/presentation\/d\//.test(url.pathname)){url.pathname=url.pathname.replace(/\/(edit|present|view|embed).*$/,'/embed');url.search='';url.hash='';}
      else if(/^\/spreadsheets\/d\//.test(url.pathname))url.pathname=url.pathname.replace(/\/(edit|view|preview).*$/,'/preview');
    }else if(host==='drive.google.com'){
      const folder=url.pathname.match(/\/folders\/([^/]+)/),file=url.pathname.match(/\/file\/d\/([^/]+)/);
      if(folder){url.pathname='/embeddedfolderview';url.search='?id='+encodeURIComponent(folder[1]);url.hash='list';}
      else if(file){url.pathname='/file/d/'+file[1]+'/preview';url.search='';url.hash='';}
    }else if(['www.youtube.com','youtube.com','youtu.be'].includes(host)){
      const id=host==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v');
      if(id&&/^[a-zA-Z0-9_-]+$/.test(id)){url.hostname='www.youtube-nocookie.com';url.pathname='/embed/'+id;url.search='';url.hash='';}
    }
    const previewOnly=host==='docs.google.com' && url.pathname.includes('/forms/d/e/1FAIpQLSd2gKo0xAsKn_by8MAWW9fqL-Rne3bxUQbPouL7FhJALGMfeA/');
    return {original:original.href,embed:url.href,host,previewOnly};
  }
  const dialog=document.createElement('dialog');dialog.className='resource-viewer';dialog.setAttribute('aria-labelledby','resource-title');
  dialog.innerHTML='<header class="resource-toolbar"><div><h2 id="resource-title"></h2><p data-provider></p></div><button type="button" data-refresh>Refresh content</button><a data-original target="_blank" rel="noopener noreferrer" data-external>Open in new tab ↗</a><button type="button" data-close aria-label="Close resource viewer">Close ✕</button></header><p class="resource-help" data-help></p><div class="resource-stage"></div>';
  document.body.append(dialog);
  const stage=dialog.querySelector('.resource-stage'),refresh=dialog.querySelector('[data-refresh]'),help=dialog.querySelector('[data-help]');let opener,active;
  function frame(){
    stage.replaceChildren();if(!active?.embed)return;
    const iframe=document.createElement('iframe');iframe.src=active.embed;iframe.title=dialog.querySelector('h2').textContent;
    iframe.setAttribute('allow','fullscreen');iframe.setAttribute('allowfullscreen','');iframe.referrerPolicy='strict-origin-when-cross-origin';
    // Known providers use their standard embed; sandbox generic external sites.
    if(!['padlet.com','docs.google.com','drive.google.com','www.youtube.com','youtube.com','youtu.be'].includes(active.host))iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-presentation');
    stage.append(iframe);
  }
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{stage.replaceChildren();document.body.classList.remove('resource-viewer-open');opener?.focus();active=null;});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
  refresh.addEventListener('click',frame);
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[href]');if(!link||link.closest('.resource-viewer')||link.hasAttribute('download')||link.hasAttribute('data-external'))return;
    let target;try{target=resource(link.href);}catch{return;}if(!target)return;
    event.preventDefault();opener=link;active=target;
    const label=link.textContent.trim()||link.querySelector('img')?.alt||target.host,page=document.querySelector('main h1')?.textContent.trim();
    dialog.querySelector('h2').textContent=target.host==='padlet.com'&&page?page+' — '+label:label;
    dialog.querySelector('[data-provider]').textContent=target.host;dialog.querySelector('[data-original]').href=target.original;
    refresh.hidden=Boolean(target.blocked);dialog.classList.toggle('resource-external-only',Boolean(target.blocked));
    help.textContent=target.blocked?'This service requires its own tab. Use “Open in new tab” above; NEST will stay here.':target.previewOnly?'Google provides a preview of this form here. Use “Open in new tab” to complete the form.':'This is live content from the original source. If it is blank or asks you to sign in, use “Open in new tab”.';
    document.body.classList.add('resource-viewer-open');dialog.showModal();frame();dialog.querySelector('[data-close]').focus();
  });
})();
