(() => {
 const period=new URLSearchParams(location.search).get('division');
 if(!['1','2','3','4','5','7','CTSO'].includes(period))return;
 const label=period==='CTSO'?'NEST Robotics':'Division '+period;
 const back=document.querySelector('[data-division-back]');back.href='/divisions/'+period;back.textContent='Back to '+label;
 document.querySelector('main>p').textContent='Explore the leadership positions, then choose '+label+' in the application form.';
})();
