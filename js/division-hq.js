(() => {
  const page=document.querySelector('main.division-page');if(!page)return;
  let active='tripometer',initialized=false;
  const scripts=new Map(),tabs=[...page.querySelectorAll('[data-hq-tab]')];
  const panel=key=>page.querySelector('#hq-panel-'+key);
  function loadScript(src){
    if(scripts.has(src))return scripts.get(src);
    const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{scripts.delete(src);script.remove();reject(new Error('This section could not load.'));};document.body.append(script);});
    scripts.set(src,promise);return promise;
  }
  function startTool(key){
    const src={tripometer:'/js/trip-o-meter.js',lookup:'/js/leadership.js',hiring:'/js/hiring.js'}[key];if(!src)return;
    const target=panel(key);target.querySelector('[data-tool-retry]')?.remove();
    loadScript(src).catch(()=>{
      const retry=document.createElement('button');retry.type='button';retry.dataset.toolRetry='';retry.textContent='Could not load this section. Try again';retry.addEventListener('click',()=>startTool(key),{once:true});target.append(retry);
    });
  }
  function select(key,updateURL=true){
    if(!window.NestDivisionHQ.allowed)return;
    const choice=tabs.find(tab=>tab.dataset.hqTab===key&&!tab.hidden);
    if(!choice||!panel(key))key='tripometer';
    active=key;
    tabs.forEach(tab=>{const selected=tab.dataset.hqTab===key&&!tab.hidden;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
    page.querySelectorAll('[role=tabpanel]').forEach(section=>section.hidden=section!==panel(key));
    if(updateURL)history.replaceState(null,'','#'+key);
    if(key==='employment'){const frame=panel(key).querySelector('[data-application-src]');if(!frame.getAttribute('src'))frame.src=frame.dataset.applicationSrc;}
    startTool(key);
    document.dispatchEvent(new CustomEvent('nest-hq-tab-change',{detail:{tab:key}}));
  }
  window.NestDivisionHQ={allowed:false,get active(){return active;},setAccess(canOpen,canManage=false){
    const wasAllowed=this.allowed;this.allowed=canOpen;
    const hiring=tabs.find(tab=>tab.dataset.hqTab==='hiring');hiring.hidden=!canOpen||!canManage||!panel('hiring');
    if(!canOpen){
      page.querySelectorAll('[role=tabpanel]').forEach(section=>section.hidden=true);
      tabs.forEach(tab=>{tab.setAttribute('aria-selected','false');tab.tabIndex=-1;});
      panel('employment').querySelector('iframe').removeAttribute('src');
      document.dispatchEvent(new Event('nest-hq-access-revoked'));return;
    }
    if(!initialized){active=location.hash.slice(1)||'tripometer';if(active==='manager-hiring')active='hiring';initialized=true;}
    select(active,false);
    if(!wasAllowed)document.dispatchEvent(new Event('nest-hq-access-ready'));
  }};
  tabs.forEach(tab=>{
    tab.addEventListener('click',()=>select(tab.dataset.hqTab));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
      const visible=tabs.filter(item=>!item.hidden),index=visible.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?visible.length-1:(index+(event.key==='ArrowRight'?1:-1)+visible.length)%visible.length;
      visible[next].focus();select(visible[next].dataset.hqTab);
    });
  });
  window.addEventListener('hashchange',()=>select(location.hash.slice(1),false));
})();
