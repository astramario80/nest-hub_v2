(() => {
  const status=document.getElementById('doughnut-status');
  const content=document.getElementById('doughnut-content');
  const charts=document.getElementById('doughnut-charts');
  const comments=document.getElementById('doughnut-comments');
  const commentsSection=document.getElementById('doughnut-comments-section');
  const commentsPrompt=document.getElementById('doughnut-comments-prompt');
  let request=0;
  const dateLabel=value=>new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  function render(periods) {
    charts.replaceChildren();
    periods.forEach(({name,average})=>{
      const value=average.toFixed(1),score=average/10;
      const card=document.createElement('article');card.className='doughnut-card';
      const ring=document.createElement('div');ring.className='doughnut-ring';
      ring.style.setProperty('--score',`${score*100}%`);
      ring.setAttribute('role','img');ring.setAttribute('aria-label',`${name}: ${value} out of 10`);
      const center=document.createElement('span');center.textContent=value;ring.append(center);
      const heading=document.createElement('h2');heading.textContent=name;
      const detail=document.createElement('p');detail.textContent=average===0?'No ratings yet':'Average rating out of 10';
      card.append(ring,heading,detail);charts.append(card);
    });
  }
  function renderComments(notes) {
    comments.replaceChildren();
    if(!notes.length){const empty=document.createElement('p');empty.textContent='No comments yet for this reporting window.';comments.append(empty);return;}
    notes.forEach(({period,text})=>{
      const card=document.createElement('blockquote');card.className='doughnut-comment';
      const body=document.createElement('p');body.textContent=text;
      const caption=document.createElement('cite');caption.textContent=period;
      card.append(body,caption);comments.append(card);
    });
  }
  async function load() {
    const current=++request;
    comments.replaceChildren();commentsSection.hidden=true;commentsPrompt.hidden=true;
    try {
      const response=await fetch('/api/doughnut-barometer?comments=1',{credentials:'same-origin',cache:'no-store'});
      const data=await response.json();
      if(current!==request)return;
      if(!response.ok)throw new Error(data.error||'The Doughnut Barometer is unavailable.');
      if(!data.active){status.textContent='The Doughnut Barometer appears around an absence, from three days before through three days after.';content.hidden=true;return;}
      document.getElementById('doughnut-dates').textContent=`${dateLabel(data.start)} – ${dateLabel(data.end)}`;
      render(data.periods);content.hidden=false;status.textContent='Current division ratings';
      if(data.commentsAuthorized===true){renderComments(data.comments||[]);commentsSection.hidden=false;}
      else commentsPrompt.hidden=false;
      window.DoughnutWinner?.show(data);
    } catch(error){if(current===request){content.hidden=true;status.textContent=error.message;}}
  }
  document.getElementById('doughnut-sign-in').addEventListener('click',()=>window.NestAuth?.open());
  document.addEventListener('nest-auth-change',load);
  load();
})();
