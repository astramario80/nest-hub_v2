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
  const responses=document.getElementById('weather-responses');
  let layout={},layoutKey='',stopResize;
  function saveLayout(){try{localStorage.setItem(layoutKey,JSON.stringify(layout));}catch{}}
  function readLayout(period){
    layoutKey='nest-weather-layout:'+String(window.NestAuth?.identity?.username||window.NestAuth?.identity?.email||'')+':'+period;
    try{layout=JSON.parse(localStorage.getItem(layoutKey)||'{}');if(!layout||typeof layout!=='object'||Array.isArray(layout))layout={};}catch{layout={};}
  }
  function sizeColumns(){
    const cols=[...responses.querySelectorAll('col')];
    if(Array.isArray(layout.widths)&&layout.widths.length===cols.length&&layout.widths.every(x=>Number.isFinite(x)&&x>=40&&x<=1500)){
      cols.forEach((col,i)=>col.style.width=layout.widths[i]+'px');responses.style.width=layout.widths.reduce((a,b)=>a+b,0)+'px';
    }else{responses.style.width='100%';cols.forEach(col=>col.style.width=(100/cols.length)+'%');}
  }
  function resizeHandle(handle,axis,read,write){
    handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation',axis==='x'?'vertical':'horizontal');
    handle.setAttribute('aria-valuemin',axis==='x'?'40':'56');handle.setAttribute('aria-valuemax',axis==='x'?'1500':'900');
    handle.setAttribute('aria-valuenow',String(Math.round(read())));
    const change=value=>{write(value);handle.setAttribute('aria-valuenow',String(Math.round(read())));};
    handle.addEventListener('keydown',event=>{
      const less=axis==='x'?'ArrowLeft':'ArrowUp',more=axis==='x'?'ArrowRight':'ArrowDown';
      if(event.key!==less&&event.key!==more)return;event.preventDefault();change(read()+(event.key===more?16:-16));saveLayout();
    });
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;event.preventDefault();stopResize?.();
      const start=axis==='x'?event.clientX:event.clientY,initial=read(),pointer=event.pointerId;
      const move=e=>{if(e.pointerId===pointer)change(initial+(axis==='x'?e.clientX:e.clientY)-start);};
      const stop=e=>{if(e&&e.pointerId!==pointer)return;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',stop);document.removeEventListener('pointercancel',stop);window.removeEventListener('blur',cancel);stopResize=null;saveLayout();};
      const cancel=()=>stop();stopResize=cancel;
      document.addEventListener('pointermove',move);document.addEventListener('pointerup',stop);document.addEventListener('pointercancel',stop);window.addEventListener('blur',cancel);
    });
  }
  function renderResponses(data,period,page){
    stopResize?.();readLayout(period);
    if(!Array.isArray(layout.widths)||layout.widths.length!==data.columns.length||!layout.widths.every(x=>Number.isFinite(x)&&x>=40&&x<=1500))delete layout.widths;
    const head=document.createElement('tr');
    responses.querySelector('colgroup').replaceChildren(...data.columns.map(()=>document.createElement('col')));
    data.columns.forEach(value=>{const cell=document.createElement('th');cell.scope='col';cell.textContent=String(value);head.append(cell);});
    responses.querySelector('thead').replaceChildren(head);sizeColumns();
    [...head.children].forEach((th,index)=>{
      const handle=document.createElement('span');handle.className='weather-column-resize';handle.setAttribute('aria-label','Resize '+data.columns[index]+' column');
      resizeHandle(handle,'x',()=>Array.isArray(layout.widths)?layout.widths[index]:Math.max(40,th.getBoundingClientRect().width||120),value=>{
        if(!Array.isArray(layout.widths)||layout.widths.length!==data.columns.length||!layout.widths.every(x=>Number.isFinite(x)&&x>=40&&x<=1500))layout.widths=[...head.children].map(cell=>Math.max(40,Math.min(1500,cell.getBoundingClientRect().width||120)));
        layout.widths[index]=Math.max(40,Math.min(1500,value));sizeColumns();
      });th.append(handle);
    });
    const body=document.createDocumentFragment();
    data.rows.forEach((row,index)=>{
      const tr=document.createElement('tr'),key=page+':'+index,height=layout.heights?.[key];
      data.columns.forEach((_,col)=>{const td=document.createElement('td'),box=document.createElement('div');box.className='weather-cell';box.textContent=String(row[col]??'');box.style.height=(Number.isFinite(height)?Math.max(56,Math.min(900,height)):144)+'px';td.append(box);tr.append(td);});
      if(tr.firstElementChild){
        const handle=document.createElement('span');handle.className='weather-row-resize';handle.setAttribute('aria-label','Resize response row '+(index+1));
        resizeHandle(handle,'y',()=>parseInt(tr.querySelector('.weather-cell').style.height)||144,value=>{
          const bounded=Math.max(56,Math.min(900,value));tr.querySelectorAll('.weather-cell').forEach(box=>box.style.height=bounded+'px');
          if(!layout.heights||typeof layout.heights!=='object'||Array.isArray(layout.heights))layout.heights={};layout.heights[key]=bounded;
        });tr.firstElementChild.append(handle);
      }
      body.append(tr);
    });responses.querySelector('tbody').replaceChildren(body);
  }
  document.getElementById('weather-fit').addEventListener('click',()=>{stopResize?.();delete layout.widths;sizeColumns();responses.querySelectorAll('.weather-column-resize').forEach(handle=>handle.setAttribute('aria-valuenow',String(Math.round(handle.parentElement.getBoundingClientRect().width))));saveLayout();});
  document.getElementById('weather-reset-rows').addEventListener('click',()=>{stopResize?.();delete layout.heights;responses.querySelectorAll('.weather-cell').forEach(box=>box.style.height='144px');responses.querySelectorAll('.weather-row-resize').forEach(handle=>handle.setAttribute('aria-valuenow','144'));saveLayout();});
  window.addEventListener('pagehide',()=>stopResize?.());
  let selected='',currentPage=0,request=0,allowed=[];
  const svgNS='http://www.w3.org/2000/svg';
  const point=(angle,radius)=>{const radians=angle*Math.PI/180;return [100+radius*Math.cos(radians),103-radius*Math.sin(radians)];};
  const svg=(tag,attributes)=>{const element=document.createElementNS(svgNS,tag);Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,String(value)));return element;};
  function arc(from,to,color){const start=point(from,78),end=point(to,78);return svg('path',{d:`M ${start[0]} ${start[1]} A 78 78 0 0 1 ${end[0]} ${end[1]}`,fill:'none',stroke:color,'stroke-width':12,'stroke-linecap':'round'});}
  function gauge(label,raw,bestAtMiddle){
    const number=Number(raw),valid=String(raw).trim()!==''&&Number.isFinite(number)&&number>=0&&number<=5;
    const card=document.createElement('div');card.className='weather-gauge';
    const heading=document.createElement('h3');heading.textContent=label;card.append(heading);
    if(!valid){const empty=document.createElement('p');empty.textContent='No ratings yet';card.append(empty);return card;}
    const graphic=svg('svg',{viewBox:'0 0 200 132',role:'img','aria-label':`${label}: ${raw} out of 5; best at ${bestAtMiddle?3:5}`});
    const bands=bestAtMiddle
      ? [[180,150,'#ec7950'],[150,120,'#f6b149'],[120,60,'#65ad6f'],[60,30,'#f6b149'],[30,0,'#ec7950']]
      : [[180,120,'#ec7950'],[120,60,'#f6b149'],[60,0,'#65ad6f']];
    graphic.append(...bands.map(([from,to,color])=>arc(from,to,color)));
    const tip=point((5-Math.max(1,number))*45,62);
    graphic.append(svg('line',{x1:100,y1:103,x2:tip[0],y2:tip[1],stroke:'#f2f5f7','stroke-width':4,'stroke-linecap':'round'}));
    graphic.append(svg('circle',{cx:100,cy:103,r:6,fill:'#f2f5f7'}));
    const value=svg('text',{x:100,y:127,'text-anchor':'middle',fill:'#fff','font-size':20,'font-weight':700});value.textContent=`${raw} / 5`;graphic.append(value);
    card.append(graphic);return card;
  }
  function showSummary(summary){
    const headings=summary[0]||[];
    const current=[summary[1],summary[2],summary[3],summary[4]].find(row=>row&&row.slice(1).some(value=>String(value??'').trim()!==''))||[];
    charts.replaceChildren(...[1,2,3].map(index=>gauge(headings[index]||['','Pacing','Rigor','Safety'][index],current[index]||'',index!==3)));
    const table=document.createElement('table');table.className='weather-summary-table';
    const caption=document.createElement('caption');caption.textContent='Ratings by trimester';table.append(caption);
    const header=document.createElement('tr');['Report period',...headings.slice(1,4)].forEach(value=>{const cell=document.createElement('th');cell.textContent=value;header.append(cell);});table.append(header);
    summary.slice(1).forEach(row=>{const tr=document.createElement('tr');row.slice(0,4).forEach(value=>{const cell=document.createElement('td');cell.textContent=value||'—';tr.append(cell);});table.append(tr);});
    trimesters.replaceChildren(table);
  }
  async function get(period,page=0){const response=await fetch('/api/weather?period='+encodeURIComponent(period)+'&page='+page,{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Weather reports unavailable.');return data;}
  function renderButtons(allowed){
    buttons.replaceChildren();
    divisions.forEach(([period,label])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=!allowed.includes(period);button.title=button.disabled?'Available to this division’s manager, assistant manager, partner liaison, and CTSO executives':'';button.setAttribute('aria-pressed',String(selected===period));button.addEventListener('click',()=>show(period));buttons.append(button);});
  }
  async function show(period,page=0){
    selected=period;currentPage=page;const current=++request;
    renderButtons(allowed);
    status.textContent='Loading '+(divisions.find(([key])=>key===period)?.[1]||period)+'…';section.hidden=true;
    try{
      const data=await get(period,page);if(current!==request)return;
      document.getElementById('weather-title').textContent=data.division;
      showSummary(data.summary);
      section.hidden=false;renderResponses(data,period,page);
      section.hidden=false;pages.hidden=false;prev.disabled=page===0;next.disabled=!data.hasMore;
      document.getElementById('weather-page-label').textContent='Page '+(page+1);
      status.textContent=data.rows.length?`${data.rows.length} current-trimester responses on this page.`:'No responses this trimester yet.';
    }catch(error){if(current===request)status.textContent=error.message;}
  }
  async function load(){
    stopResize?.();
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
