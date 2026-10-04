(() => {
  function show(data) {
    if(!data?.announcementReady||!Array.isArray(data.periods)||!data.periods.length)return;
    const best=Math.max(...data.periods.map(period=>period.average));
    if(!Number.isFinite(best)||best<=0)return;
    const winners=data.periods.filter(period=>Math.abs(period.average-best)<1e-8).map(period=>period.name);
    const key=`nest-doughnut-winner:${data.end}:${winners.join(',')}`;
    try {if(localStorage.getItem(key)==='acknowledged')return;} catch {}
    if(document.querySelector('.doughnut-winner-dialog'))return;

    const dialog=document.createElement('dialog');dialog.className='doughnut-winner-dialog';
    dialog.setAttribute('aria-labelledby','doughnut-winner-title');
    const confetti=document.createElement('div');confetti.className='doughnut-confetti';confetti.setAttribute('aria-hidden','true');
    for(let i=0;i<20;i++){const piece=document.createElement('span');confetti.append(piece);}
    const icon=document.createElement('div');icon.className='doughnut-winner-icon';icon.setAttribute('aria-hidden','true');icon.textContent='🍩';
    const title=document.createElement('h2');title.id='doughnut-winner-title';title.textContent=winners.length===1?`${winners[0]} wins the Doughnut Barometer!`:`${winners.join(' & ')} tie for the Doughnut Barometer!`;
    const detail=document.createElement('p');detail.textContent=`Highest average: ${best.toFixed(1)} out of 10. ${winners.length===1?'This period wins':'These periods win'} the doughnut party!`;
    const button=document.createElement('button');button.type='button';button.textContent='Got it — continue';
    button.addEventListener('click',()=>{try{localStorage.setItem(key,'acknowledged');}catch{}dialog.close();dialog.remove();});
    dialog.addEventListener('cancel',event=>event.preventDefault());
    dialog.append(confetti,icon,title,detail,button);document.body.append(dialog);dialog.showModal();button.focus();
  }
  window.DoughnutWinner={show};
})();
