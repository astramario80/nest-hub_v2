(() => {
  const link=document.getElementById('doughnut-menu-link');
  if(!link)return;
  const cacheKey='nest-doughnut-window-v1';
  const cacheLifetime=5*60*1000;
  let verifiedWindow=null;
  function validDate(value) {
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const date=new Date(value+'T12:00:00Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
  }
  function inWindow(data) {
    if(!data||!validDate(data.start)||!validDate(data.end)||data.start>data.end)return false;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    return today>=data.start&&today<=data.end;
  }
  function freshWindow(data) {
    const age=Date.now()-data?.checkedAt;
    return Number.isFinite(age)&&age>=0&&age<cacheLifetime&&inWindow(data);
  }
  function saveWindow(data) {
    verifiedWindow=data;
    try {
      if(data)localStorage.setItem(cacheKey,JSON.stringify(data));
      else localStorage.removeItem(cacheKey);
    } catch { /* The live check still works when browser storage is unavailable. */ }
  }
  try {
    const cached=JSON.parse(localStorage.getItem(cacheKey));
    if(freshWindow(cached))verifiedWindow=cached;
  } catch { /* Ignore missing or invalid cached dates. */ }
  link.hidden=!freshWindow(verifiedWindow);
  let updating=false;
  async function update() {
    if(updating)return;
    updating=true;
    link.hidden=!freshWindow(verifiedWindow);
    try {
      const response=await fetch('/api/doughnut-barometer');
      if(!response.ok)throw new Error('Unavailable');
      const data=await response.json();
      const active=data.active===true&&inWindow(data);
      saveWindow(active?{start:data.start,end:data.end,checkedAt:Date.now()}:null);
      link.hidden=!active;
      if(active)window.DoughnutWinner?.show(data);
    } catch { link.hidden=!freshWindow(verifiedWindow); }
    finally { updating=false; }
  }
  update();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
})();
