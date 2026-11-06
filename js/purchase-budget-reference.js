(()=>{
 'use strict';
 const $=id=>document.getElementById('purchase-budget-'+id),base=window.NestPurchasing,box=$('reference');
 const money=n=>Number.isFinite(n)?n.toLocaleString('en-US',{style:'currency',currency:'USD'}):'Unavailable',yearLabel=y=>/^\d{2}_\d{2}$/.test(y||'')?'20'+y.slice(0,2)+'–20'+y.slice(3):'Current school year';
 let access=null,budget=null,year='',financial=null,epoch=0,flight=null,revision='',chartReady=false;
 function exportsEnabled(enabled){chartReady=enabled;['copy','download'].forEach(id=>$(id).disabled=!enabled);}
 function clear(){epoch++;flight=null;access=null;budget=null;year='';financial=null;revision='';box.hidden=true;box.open=false;$('year').textContent='';$('balance').textContent='';$('status').textContent='';$('chart').hidden=true;$('totals').textContent='';$('source').replaceChildren();$('table').replaceChildren();$('export-status').textContent='';exportsEnabled(false);const canvas=$('canvas');canvas.getContext?.('2d')?.clearRect(0,0,canvas.width,canvas.height);}
 function render(data){
  access=data.access||null;budget=data.budget||null;year=budget?.year||data.schoolYear||'';
  box.hidden=!(access?.manager||access?.admin||access?.budgetReference);if(box.hidden){clear();return;}
  $('year').textContent=yearLabel(year);$('balance').textContent=Number.isFinite(budget?.balance)?money(budget.balance)+' remaining':'Open to view current balance';$('running').textContent=money(budget?.balance);$('school-year').textContent=yearLabel(year);
  $('chart-controls').hidden=!(access.admin||access.budgetReference);$('manager-note').hidden=!!(access.admin||access.budgetReference);
  const next=year+'|'+(budget?.revision||'unavailable');if(next!==revision){revision=next;epoch++;flight=null;financial=null;exportsEnabled(false);$('chart').hidden=true;$('totals').textContent='';$('source').replaceChildren();}
  if(data.budgetError)$('status').textContent='The current balance could not be verified. Refresh to try again.';
  else if(!financial)$('status').textContent=(access.admin||access.budgetReference)?'Open this reference to load the current year’s purchase chart.':'Balance from the current district budget.';
  if(box.open&&(access.admin||access.budgetReference))void load();
 }
 function grouped(rows,mode){
  const sums=new Map();for(const x of rows){if(!Number.isFinite(x.total)||!/^\d{4}-\d{2}-\d{2}$/.test(x.day)||!x.vendor)continue;const key=mode==='date'?x.day:x.vendor.trim();sums.set(key,(sums.get(key)||0)+Math.round(x.total*100));}
  let values=[...sums].map(([label,cents])=>({label,value:cents/100}));values.sort(mode==='date'?(a,b)=>b.label.localeCompare(a.label):(a,b)=>Math.abs(b.value)-Math.abs(a.value)||a.label.localeCompare(b.label));
  if(values.length>10){const rest=values.slice(10);values=[...values.slice(0,10),{label:mode==='date'?'Earlier purchase dates':'Other vendors',value:Math.round(rest.reduce((s,x)=>s+x.value,0)*100)/100}];}
  return values;
 }
 function paint(){
  exportsEnabled(false);if(!financial||financial.warning){$('chart').hidden=true;return;}
  const rows=financial.purchases||[],mode=$('group').value,values=grouped(rows,mode),total=Math.round(rows.reduce((n,x)=>n+(Number.isFinite(x.total)?x.total:0),0)*100)/100;
  $('chart').hidden=false;$('totals').textContent=rows.length+' ledger entries · '+money(total)+' net district charges';
  const canvas=$('canvas'),ctx=canvas.getContext('2d');if(!ctx){$('status').textContent='Chart drawing is unavailable in this browser.';return;}
  const width=1200,height=675;canvas.width=width;canvas.height=height;ctx.fillStyle='#17191d';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#f1f1f2';ctx.font='bold 28px Arial';ctx.fillText('NEST™ · '+yearLabel(year)+' purchases to date',42,52);
  ctx.fillStyle='#e2a567';ctx.font='bold 22px Arial';ctx.fillText('Running balance: '+money(budget?.balance),42,90);
  ctx.fillStyle='#bdc3cd';ctx.font='17px Arial';ctx.fillText((mode==='date'?'By purchase date':'By vendor')+' · Net district charges (including district tax formulas)',42,122);
  const min=Math.min(0,...values.map(x=>x.value)),max=Math.max(0,...values.map(x=>x.value)),span=max-min||1,left=510,right=1040,zero=left+(0-min)/span*(right-left),step=38;
  ctx.strokeStyle='#666b76';ctx.beginPath();ctx.moveTo(zero,150);ctx.lineTo(zero,150+Math.max(values.length,1)*step);ctx.stroke();
  const fit=(text,maxWidth)=>{let s=text;while(s.length&&ctx.measureText(s).width>maxWidth)s=s.slice(0,-1);return s===text?s:s.trimEnd()+'…';};
  values.forEach((x,i)=>{const y=163+i*step,end=left+(x.value-min)/span*(right-left);ctx.font='18px Arial';ctx.fillStyle='#e8e9ed';ctx.fillText(fit(x.label,440),42,y+12);ctx.fillStyle=x.value<0?'#76baa9':'#d78a42';ctx.fillRect(Math.min(zero,end),y-7,Math.max(Math.abs(end-zero),x.value===0?0:2),23);ctx.textAlign='right';ctx.fillStyle='#f1f1f2';ctx.fillText(money(x.value),1158,y+12);ctx.textAlign='left';});
  if(!values.length){ctx.fillStyle='#d4d8e0';ctx.font='22px Arial';ctx.fillText('No district purchase entries for this school year yet.',42,202);}
  ctx.fillStyle='#b8bec8';ctx.font='15px Arial';ctx.fillText('Returns reduce charges. Practice emails and pending requests are excluded.',42,603);
  ctx.fillText(mode==='date'?'Latest 10 purchase dates shown; older dates combined when needed.':'Top 10 vendors shown; other vendors combined when needed.',42,627);
  ctx.fillText('District budget snapshot · '+new Date().toLocaleDateString('en-US',{timeZone:'America/Los_Angeles'})+' · Food documentation may have $0 ledger impact.',42,651);
  canvas.setAttribute('aria-label',yearLabel(year)+' purchases '+(mode==='date'?'by date':'by vendor')+'. Net district charges '+money(total)+'. Running balance '+money(budget?.balance)+'.');
  const table=$('table');table.replaceChildren();for(const x of values){const row=document.createElement('tr'),label=document.createElement('th'),value=document.createElement('td');label.scope='row';label.textContent=x.label;value.textContent=money(x.value);row.append(label,value);table.append(row);}
  exportsEnabled(true);
 }
 async function load(force=false){
  if(!(access?.admin||access?.budgetReference))return;if(flight)return flight;if(financial&&!force){paint();return;}
  const current=epoch;exportsEnabled(false);$('status').textContent='Loading current-year district purchases…';
  const request=(async()=>{try{const result=await base.api({operation:'budget-reference'});if(current!==epoch)return;if(result.year!==year||!Array.isArray(result.purchases))throw Error('The current-year purchase chart could not be verified.');financial=result;if(Number.isFinite(result.balance)){budget={year:result.year,balance:result.balance,revision:result.revision};$('balance').textContent=money(budget.balance)+' remaining';$('running').textContent=money(budget.balance);$('school-year').textContent=yearLabel(result.year);}if(result.warning){$('status').textContent='The annual district sheet could not be verified. The chart is unavailable until it can be reconciled. Refresh to try again.';$('chart').hidden=true;return;}
   $('status').textContent='Current-year district ledger. Practice emails and pending requests are excluded.';$('source').replaceChildren();if(result.sourceUrl){const a=document.createElement('a');a.textContent='Open district budget ↗';a.href=result.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';$('source').append(a);}paint();
  }catch(e){if(current===epoch){$('status').textContent=e.message;financial=null;$('chart').hidden=true;exportsEnabled(false);}}finally{if(current===epoch)flight=null;}})();flight=request;return request;
 }
 const png=()=>new Promise((resolve,reject)=>$('canvas').toBlob(blob=>blob?resolve(blob):reject(Error('The chart image could not be created.')),'image/png'));
 $('copy').addEventListener('click',async()=>{if(!chartReady)return;try{if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error();await navigator.clipboard.write([new ClipboardItem({'image/png':png()})]);$('export-status').textContent='Chart copied. Open your leadership slide and paste (⌘V or Ctrl+V).';}catch{$('export-status').textContent='Copy is unavailable here. Save the PNG, then use Insert → Image in your leadership slide.';}});
 $('download').addEventListener('click',async()=>{if(!chartReady)return;try{const blob=await png(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='NEST-'+year+'-purchases-by-'+$('group').value+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('export-status').textContent='Chart saved. In your leadership slide, use Insert → Image → Upload from computer.';}catch{$('export-status').textContent='The chart could not be saved. Try Copy chart instead.';}});
 $('group').addEventListener('change',()=>{paint();$('export-status').textContent='';});
 $('refresh').addEventListener('click',async()=>{const current=epoch;await base.reload();if(current===epoch||access?.admin||access?.budgetReference)await load(true);});
 box.addEventListener('toggle',()=>{if(box.open&&(access?.admin||access?.budgetReference))void load();});
 window.NestBudgetReference={render,clear,grouped};
 const initial=base.state?.();if(initial?.access)render(initial);
})();
