(() => {
  const divisions=[['Advisory','Advisory'],['1','Period 1'],['2','Period 2'],['3','Period 3'],['4','Period 4'],['5','Period 5'],['CTSO','CTSO']];
  const status=document.getElementById('weather-status');
  const buttons=document.getElementById('weather-divisions');
  const section=document.getElementById('weather-data');
  const charts=document.getElementById('weather-charts');
  const trimesters=document.getElementById('weather-trimesters');
  const pages=document.getElementById('weather-pages');
  const prev=document.getElementById('weather-prev');
  const next=document.getElementById('weather-next');
  let selected='',currentPage=0,request=0,allowed=[];
  const svgNS='http://www.w3.org/2000/svg';
  const point=(score,radius)=>{const angle=Math.PI*(1-score/5);return [100+radius*Math.cos(angle),103-radius*Math.sin(angle)];};
  const svg=(tag,attributes)=>{const element=document.createElementNS(svgNS,tag);Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,String(value)));return element;};
  function arc(from,to,color){const start=point(from,78),end=point(to,78);return svg('path',{d:`M ${start[0]} ${start[1]} A 78 78 0 0 1 ${end[0]} ${end[1]}`,fill:'none',stroke:color,'stroke-width':12,'stroke-linecap':'round'});}
  function gauge(label,raw){
    const number=Number(raw),valid=String(raw).trim()!==''&&Number.isFinite(number)&&number>=0&&number<=5;
    const card=document.createElement('div');card.className='weather-gauge';
    const heading=document.createElement('h3');heading.textContent=label;card.append(heading);
    if(!valid){const empty=document.createElement('p');empty.textContent='No ratings yet';card.append(empty);return card;}
    const graphic=svg('svg',{viewBox:'0 0 200 132',role:'img','aria-label':`${label}: ${raw} out of 5`});
    graphic.append(arc(0,2,'#ec7950'),arc(2,4,'#f6b149'),arc(4,5,'#65ad6f'));
    const tip=point(number,62);
    graphic.append(svg('line',{x1:100,y1:103,x2:tip[0],y2:tip[1],stroke:'#f2f5f7','stroke-width':4,'stroke-linecap':'round'}));
    graphic.append(svg('circle',{cx:100,cy:103,r:6,fill:'#f2f5f7'}));
    const value=svg('text',{x:100,y:127,'text-anchor':'middle',fill:'#fff','font-size':20,'font-weight':700});value.textContent=`${raw} / 5`;graphic.append(value);
    card.append(graphic);return card;
  }
  function showSummary(summary){
    const headings=summary[0]||[];
    const current=[summary[1],summary[2],summary[3],summary[4]].find(row=>row&&row.slice(1).some(value=>String(value??'').trim()!==''))||[];
    charts.replaceChildren(...[1,2,3].map(index=>gauge(headings[index]||['','Pacing','Rigor','Safety'][index],current[index]||'')));
    const table=document.createElement('table');table.className='weather-summary-table';
    const caption=document.createElement('caption');caption.textContent='Ratings by trimester';table.append(caption);
    const header=document.createElement('tr');['Report period',...headings.slice(1,4)].forEach(value=>{const cell=document.createElement('th');cell.textContent=value;header.append(cell);});table.append(header);
    summary.slice(1).forEach(row=>{const tr=document.createElement('tr');row.slice(0,4).forEach(value=>{const cell=document.createElement('td');cell.textContent=value||'—';tr.append(cell);});table.append(tr);});
    trimesters.replaceChildren(table);
  }
  async function get(period,page=0){const response=await fetch('/api/weather?period='+encodeURIComponent(period)+'&page='+page,{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Weather reports unavailable.');return data;}
  function renderButtons(allowed){
    buttons.replaceChildren();
    divisions.forEach(([period,label])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=!allowed.includes(period);button.title=button.disabled?'Available to this division’s manager, assistant manager, and partner liaisons':'';button.setAttribute('aria-pressed',String(selected===period));button.addEventListener('click',()=>show(period));buttons.append(button);});
  }
  async function show(period,page=0){
    selected=period;currentPage=page;const current=++request;
    renderButtons(allowed);
    status.textContent='Loading '+(divisions.find(([key])=>key===period)?.[1]||period)+'…';section.hidden=true;
    try{
      const data=await get(period,page);if(current!==request)return;
      document.getElementById('weather-title').textContent=data.division;
      showSummary(data.summary);
      const head=document.createElement('tr');data.columns.forEach(value=>{const cell=document.createElement('th');cell.textContent=String(value);head.append(cell);});section.querySelector('thead').replaceChildren(head);
      const body=document.createDocumentFragment();data.rows.forEach(row=>{const tr=document.createElement('tr');data.columns.forEach((_,index)=>{const cell=document.createElement('td');cell.textContent=String(row[index]??'');tr.append(cell);});body.append(tr);});section.querySelector('tbody').replaceChildren(body);
      section.hidden=false;pages.hidden=false;prev.disabled=page===0;next.disabled=!data.hasMore;
      document.getElementById('weather-page-label').textContent='Page '+(page+1);
      status.textContent=data.rows.length?`${data.rows.length} responses on this page.`:'No responses on this page yet.';
    }catch(error){if(current===request)status.textContent=error.message;}
  }
  async function load(){
    request++;selected='';allowed=[];section.hidden=true;pages.hidden=true;renderButtons([]);
    if(!window.NestAuth?.identity?.signedIn){status.textContent='Sign in from Quick Access above to view your division’s report data.';return;}
    status.textContent='Checking division access…';
    try{const data=await get('mine');if(!window.NestAuth?.identity?.signedIn)return;allowed=data.periods;renderButtons(allowed);status.textContent=allowed.length?'Choose a division above to view its charts and responses.':'Your NEST account does not have weather report access.';}
    catch(error){status.textContent=error.message;}
  }
  prev.addEventListener('click',()=>{if(selected&&currentPage>0)show(selected,currentPage-1);});
  next.addEventListener('click',()=>{if(selected)show(selected,currentPage+1);});
  document.addEventListener('nest-auth-change',load);window.NestAuth?.ready.then(load);
})();
