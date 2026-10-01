// Reuse the homepage's current gear links for the eagle menu on every NEST page.
(() => {
  const wrapper=document.querySelector('header .logo-container'),home=wrapper?.querySelector('a');
  if(!home||wrapper.querySelector('.eagle-menu-toggle'))return;
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='/css/eagle-menu.css';document.head.append(stylesheet);
  const button=document.createElement('button');button.type='button';button.className='eagle-menu-toggle';
  button.setAttribute('aria-label','NEST™ menu');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','eagle-menu');
  button.append(...home.childNodes);home.replaceWith(button);
  const nav=document.createElement('nav');nav.id='eagle-menu';nav.className='eagle-menu';nav.setAttribute('aria-label','NEST™ gears');nav.hidden=true;
  const returnHome=document.createElement('a');returnHome.href='/';returnHome.className='eagle-menu-home';returnHome.textContent='NEST™ Menu';nav.append(returnHome);
  const gears=document.createElement('div');nav.append(gears);wrapper.append(nav);
  let pinned=false,closeTimer;
  function setOpen(open){clearTimeout(closeTimer);nav.hidden=!open;button.setAttribute('aria-expanded',String(open));}
  button.addEventListener('click',()=>{pinned=!pinned;setOpen(pinned);});
  wrapper.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')setOpen(true);});
  wrapper.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&!pinned)closeTimer=setTimeout(()=>{if(!pinned)setOpen(false);},250);});
  wrapper.addEventListener('focusin',()=>setOpen(true));
  wrapper.addEventListener('focusout',event=>{if(!pinned&&!wrapper.contains(event.relatedTarget))setOpen(false);});
  document.addEventListener('click',event=>{if(!wrapper.contains(event.target)){pinned=false;setOpen(false);}});
  // Clicks inside an embedded site do not bubble to the surrounding NEST page.
  window.addEventListener('blur',()=>setTimeout(()=>{
    if(document.activeElement?.tagName==='IFRAME'){pinned=false;setOpen(false);}
  },0));
  wrapper.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();pinned=false;button.focus();setOpen(false);}});
  function group(label,content){
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=label;
    details.append(summary,content);return details;
  }
  function populate(doc){
    const panels=doc.querySelectorAll('.home-dashboard > .gear-panel');if(panels.length!==4)throw new Error('Missing NEST gears');
    gears.replaceChildren();
    panels.forEach(panel=>{
      const content=panel.querySelector('.gear-links').cloneNode(true);
      content.removeAttribute('id');content.className='eagle-gear-links';
      content.querySelectorAll('.gear-group').forEach(nested=>{
        const links=nested.querySelector('.gear-group-links').cloneNode(true);links.className='eagle-submenu';
        const label=nested.querySelector('.gear-group-trigger').textContent.replace('▶','').trim();
        nested.replaceWith(group(label,links));
      });
      [content,...content.querySelectorAll('*')].forEach(node=>{node.removeAttribute('hidden');node.removeAttribute('inert');node.style.height='';node.style.overflow='';});
      content.querySelectorAll('a[href^="#"]').forEach(link=>link.setAttribute('href','/'+link.getAttribute('href')));
      content.querySelectorAll('img[src^="assets/"]').forEach(img=>img.setAttribute('src','/'+img.getAttribute('src')));
      gears.append(group('⚙️ '+panel.querySelector('.gear-label').textContent.trim(),content));
    });
  }
  // Keep navigation available even if the homepage cannot be fetched.
  ['SOAR','Tools','Resources','Command'].forEach((label,index)=>{
    const link=document.createElement('a');link.href='/#gear-'+index;link.textContent='⚙️ '+label;gears.append(link);
  });
  if(document.querySelector('.home-dashboard'))populate(document);
  else if(typeof fetch==='function')fetch('/index.html').then(response=>{
    if(!response.ok)throw new Error('Menu unavailable');return response.text();
  }).then(html=>populate(new DOMParser().parseFromString(html,'text/html'))).catch(()=>{});
})();
