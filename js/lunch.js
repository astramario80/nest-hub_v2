(() => {
  const panel = document.querySelector('.lunch-disclosure');
  const status = document.getElementById('lunch-status');
  const container = document.getElementById('lunch-table-container');
  let loadedAt = 0, loading = false;
  const cell = (tag, text) => { const el=document.createElement(tag); el.textContent=text; return el; };
  function table(caption, headers) {
    const wrap = document.createElement('div'); wrap.className='lunch-table-wrap';
    const el = document.createElement('table'); el.className='lunch-table';
    el.append(cell('caption',caption));
    const head=document.createElement('thead'), row=document.createElement('tr');
    headers.forEach(text=>{const th=cell('th',text);th.scope='col';row.append(th);});
    head.append(row);el.append(head); const body=document.createElement('tbody');el.append(body);wrap.append(el);container.append(wrap);return body;
  }
  panel.addEventListener('disclosureopen',async()=>{
    if (loading || Date.now()-loadedAt < 300000) return;
    loading=true;status.textContent='Loading current lunch assignments…';
    try {
      const response=await fetch('/api/lunch',{signal:AbortSignal.timeout(30000)});
      const data=await response.json();
      if(!response.ok || !Array.isArray(data.lunches) || data.lunches.length!==3) throw new Error('Unavailable');
      container.replaceChildren();
      const times=table('Lunch times by schedule',['Schedule',...data.lunches.map(l=>l.label)]);
      data.schedules.forEach(schedule=>{const row=document.createElement('tr');const th=cell('th',schedule.name);th.scope='row';row.append(th);schedule.times.forEach(time=>row.append(cell('td',time)));times.append(row);});
      const staff=table('Staff assignments',data.lunches.map(l=>l.label));
      const row=document.createElement('tr');
      data.lunches.forEach(lunch=>{const td=document.createElement('td'),list=document.createElement('ul');list.className='lunch-staff';lunch.staff.forEach(name=>list.append(cell('li',name)));td.append(list);row.append(td);});staff.append(row);
      container.append(cell('h3','Staff on planning period'),cell('p',data.planning.join(' · ')));
      status.textContent=`${data.source.name} · Updated ${new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:'America/Los_Angeles'}).format(new Date(data.source.modifiedTime))}`;
      loadedAt=Date.now();
    } catch(error) {
      container.replaceChildren();
      status.textContent='Lunch assignments are temporarily unavailable. Open the source folder below, or close and reopen this panel to retry.';
    } finally { loading=false; }
  });
})();
