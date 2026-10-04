(() => {
  const link=document.getElementById('doughnut-menu-link');
  if(!link)return;
  async function update() {
    try {
      const response=await fetch('/api/doughnut-barometer',{cache:'no-store'});
      if(!response.ok)throw new Error('Unavailable');
      const data=await response.json();
      link.hidden=data.active!==true;
      window.DoughnutWinner?.show(data);
    } catch { link.hidden=true; }
  }
  update();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
})();
