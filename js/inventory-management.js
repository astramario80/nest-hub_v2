(()=>{
 'use strict';
 const hosted=Boolean(document.getElementById('purchase-equipment'));let opened=false;
 const $=id=>document.getElementById('equipment-'+id),names={kits:'EE Kit',drones:'Drone',laptops:'Laptop',usbs:'USB',radios:'Radio',computers:'Computer station',printers:'3D printer'};
 let catalogVersion='',idLabel='Equipment ID',serialLabel='Serial number',manageChange='add',total=0;
 let type='kits',page=0,records=[],choices={},selected=null,dirty=false,busy=false,loading=false,generation=0;
 const signedIn=()=>window.NestAuth?.identity?.signedIn;
 const node=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
 const message=value=>$('message').textContent=value;
 function clear(){generation++;catalogVersion='';closeManage();records=[];choices={};selected=null;dirty=false;loading=false;$('list').replaceChildren();$('fields').replaceChildren();$('edit').hidden=true;$('empty').hidden=false;$('workspace').hidden=true;}
 function confirmDiscard(){return !dirty||window.confirm('Discard unsaved assignment changes?');}
 function controls(){
  $('fields').disabled=busy||loading;
  $('add').disabled=busy||loading||!catalogVersion;$('details').disabled=busy||loading;$('remove').disabled=busy||loading||selected?.assigned===true;
  $('manage-fields').disabled=busy||loading;$('manage-save').disabled=busy||loading;$('manage-cancel').disabled=busy||loading;
  $('save').disabled=!dirty||busy||loading;$('reset').disabled=!dirty||busy||loading;
  $('sync').disabled=busy||loading;$('retry').disabled=busy||loading;$('refresh').disabled=busy||loading;$('prev').disabled=busy||loading||page===0;$('next').disabled=busy||loading||!$('next').dataset.more;
  document.querySelectorAll('[data-type]').forEach(b=>b.disabled=busy||loading);
  $('draft').textContent=busy?'Saving…':dirty?'Unsaved changes':'No changes';
 }
 async function request(body){
  const response=await fetch('/api/inventory'+(body?'':`?type=${type}&page=${page}`),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const result=await response.json();if(!response.ok){const error=new Error(result.error||'Equipment assignments are unavailable.');error.status=response.status;throw error;}return result;
 }
 function render(){
  const query=$('search').value.trim().toLowerCase(),matches=records.filter(r=>[r.number,r.serial||'',...r.cells.map(c=>c.value)].join(' ').toLowerCase().includes(query));
  $('list').replaceChildren(...matches.map(row=>{
   const button=node('button','');button.type='button';button.className='equipment-item';button.setAttribute('aria-pressed',String(selected?.id===row.id));
   button.append(node('strong',names[type]+' '+row.number));
   const summary=row.cells.filter(c=>c.value&&(!/note|serial/i.test(c.label))).map(c=>c.label+': '+c.value).slice(0,3).join(' · ');
   button.append(node('span',summary||(['computers','printers'].includes(type)?'Equipment record':'No assignment recorded')));if(row.serial)button.append(node('span','Serial: '+row.serial));
   button.addEventListener('click',()=>{if(busy||loading||!confirmDiscard())return;show(row);render();});return button;
  }));
  if(!matches.length)$('list').append(node('p',query?'No equipment matches on this page. Try another page or clear the search.':'No equipment is available in this category.'));
 }
 function changes(){return Array.from($('fields').querySelectorAll('[data-column]')).filter(el=>el.value!==selected.cells.find(c=>c.column===Number(el.dataset.column)).value).map(el=>({column:Number(el.dataset.column),value:el.value}));}
 function show(row){
  selected=row;dirty=false;$('remove').title=row.assigned?'Clear student assignments before removing this item.':'';$('empty').hidden=true;$('edit').hidden=false;$('title').textContent=names[type]+' '+row.number;
  $('fields').replaceChildren(...row.cells.map(field=>{
   const label=node('label','');label.className='equipment-field';label.append(node('span',field.label));let input;
   if(field.editable&&field.choices){
    input=document.createElement('select');input.append(new Option('Unassigned',''));
    const options=choices[field.choices]||[];
    if(field.value&&!options.includes(field.value)){const legacy=new Option(field.value+' (existing value)',field.value);legacy.disabled=true;input.append(legacy);}
    options.forEach(v=>input.append(new Option(v,v)));input.value=field.value;
   }else if(field.editable){input=document.createElement('textarea');input.rows=3;input.maxLength=2000;input.value=field.value;}
   else{input=node('div',field.value||'—');input.className='equipment-readonly';}
   if(field.editable)input.dataset.column=field.column;
   label.append(input);return label;
  }));controls();
 }
 async function load(keep=false){
  if(!signedIn()){clear();message('Use your NEST profile to sign in and manage equipment assignments.');return;}
  const current=++generation,old=keep?selected?.id:null;$('retry').hidden=true;loading=true;controls();message('Loading equipment assignments…');
  try{
   const result=await request();if(current!==generation||!signedIn())return;
   records=result.records;choices=result.choices;catalogVersion=result.catalogVersion||'';idLabel=result.idLabel||'Equipment ID';serialLabel=result.serialLabel||'Serial number';total=result.total;
   $('sync').hidden=['computers','printers'].includes(type);$('workspace').hidden=false;$('count').textContent=result.total+' items';$('page').textContent='Page '+(page+1);$('next').dataset.more=result.hasMore?'yes':'';
   $('category-title').textContent=document.querySelector(`[data-type="${type}"]`).textContent;
   const row=records.find(r=>r.id===old);if(row)show(row);else{selected=null;dirty=false;$('edit').hidden=true;$('fields').replaceChildren();$('empty').hidden=false;}
   render();message(result.unavailable?'This category’s sheet layout needs review before assignments can be edited.':'Assignments loaded · '+new Date().toLocaleTimeString());
  }catch(error){if(current===generation){clear();$('retry').hidden=false;message(error.message);controls();}}
  finally{if(current===generation){loading=false;controls();}}
 }
 function closeManage(){
  const dialog=$('manage-dialog');if(dialog.open){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
  $('number').value='';$('serial').value='';$('maker-serial').value='';$('manage-error').textContent='';
 }
 function openManage(change){
  if(busy||loading||!confirmDiscard())return;
  if(change!=='add'&&!selected)return;
  if(dirty){dirty=false;if(selected)show(selected);}
  manageChange=change;$('manage-error').textContent='';
  $('manage-title').textContent=change==='add'?'Add '+names[type].toLowerCase():change==='remove'?'Remove '+names[type].toLowerCase():'Edit equipment details';
  $('manage-save').textContent=change==='add'?'Add equipment':change==='remove'?'Remove equipment':'Save equipment details';
  $('number-label').textContent=idLabel;$('serial-label').textContent=serialLabel;
  $('number').value=change==='add'?'':selected.number;$('serial').value=change==='add'?'':selected.serial||'';$('serial').required=type==='computers';$('maker-field').hidden=type!=='printers';$('maker-serial').value=change==='add'?'':selected.makerSerial||'';
  $('manage-fields').hidden=change==='remove';
  $('manage-help').textContent=change==='remove'?'Remove '+selected.number+' from active equipment? Its saved details remain in the equipment history. Existing assignments must be cleared first.':change==='add'?'Add an item to this category, then select it to assign students or update its details.':'Update the equipment identifier or serial number. Existing student assignments stay with this item.';
  const dialog=$('manage-dialog');if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  if(change!=='remove')$('number').focus();else $('manage-cancel').focus();
 }
 $('add').addEventListener('click',()=>openManage('add'));
 $('details').addEventListener('click',()=>openManage('edit'));
 $('remove').addEventListener('click',()=>openManage('remove'));
 $('manage-cancel').addEventListener('click',()=>{if(!busy)closeManage();});
 $('manage-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 $('manage-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||loading||!catalogVersion)return;
  const current=generation,change=manageChange;
  const body={operation:'manage',type,change,...(change==='add'?{catalogVersion}:{id:selected.id,version:selected.version}),...(change==='remove'?{}:{number:$('number').value.trim(),serial:$('serial').value.trim(),...(type==='printers'?{makerSerial:$('maker-serial').value.trim()}:{})})};
  busy=true;controls();$('manage-error').textContent='';message('Saving equipment…');
  try{
   const result=await request(body);if(current!==generation||!signedIn())return;if(!result.saved)throw new Error('Equipment save could not be confirmed. Refresh to check the register.');
   closeManage();dirty=false;selected=result.id?{id:result.id}:null;page=change==='remove'?Math.min(page,Math.max(0,Math.ceil((total-1)/30)-1)):result.page||0;$('search').value='';busy=false;await load(true);
   if(signedIn())message((change==='add'?'Equipment added.':change==='remove'?'Equipment removed from active inventory; history retained.':'Equipment details saved.')+(result.mirrorSync==='pending'?' Public lookup sync is pending.':''));
  }catch(error){if(current===generation){if([401,403].includes(error.status))clear();else $('manage-error').textContent=error.message;message(error.message);}}
  finally{busy=false;controls();}
 });
 $('retry').addEventListener('click',()=>{if(!busy&&!loading&&confirmDiscard()){dirty=false;load(true);}});
 $('search').addEventListener('input',render);
 document.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{
  if(busy||loading||button.dataset.type===type||!confirmDiscard())return;
  type=button.dataset.type;page=0;dirty=false;$('search').value='';document.querySelectorAll('[data-type]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));load();
 }));
 $('sync').addEventListener('click',async()=>{
  if(busy||loading)return;const current=generation;busy=true;controls();message('Synchronizing saved assignments to public lookup…');
  try{const result=await request({operation:'sync',type});if(current===generation&&signedIn())message(result.mirrorSync==='updated'?'Public lookup synchronized. Google’s published view may take a moment to refresh.':'Public lookup sync is pending. Try again shortly.');}
  catch(error){if(current===generation){if([401,403].includes(error.status))clear();message(error.message);}}
  finally{busy=false;controls();if(current!==generation&&signedIn()&&!loading&&!selected&&!records.length)load();}
 });
 $('refresh').addEventListener('click',()=>{if(busy||loading||!confirmDiscard())return;dirty=false;load(true);});
 for(const [id,step] of [['prev',-1],['next',1]])$(id).addEventListener('click',()=>{if(busy||loading||!confirmDiscard())return;dirty=false;page=Math.max(0,page+step);load();});
 $('reset').addEventListener('click',()=>{if(selected&&!busy)show(selected);});
 $('fields').addEventListener('input',()=>{dirty=changes().length>0;controls();});
 $('fields').addEventListener('change',()=>{dirty=changes().length>0;controls();});
 $('edit').addEventListener('submit',async event=>{
  event.preventDefault();if(!selected||busy||loading||!dirty)return;
  const current=generation,body={type,id:selected.id,version:selected.version,changes:changes()};busy=true;controls();message('Saving assignment…');
  try{
   const result=await request(body);if(current!==generation||!signedIn())return;if(!result.saved)throw new Error('The save could not be confirmed. Refresh to check the assignment.');
   dirty=false;busy=false;await load(true);if(signedIn()&&selected)message(result.mirrorSync==='updated'?'Assignment saved. Public lookup synchronized; Google’s published view may take a moment to refresh.':'Assignment saved. Public lookup sync is pending; choose Sync public lookup to retry.');
  }catch(error){if(current===generation){if([401,403].includes(error.status))clear();message(error.message);}}
  finally{busy=false;controls();if(current!==generation&&signedIn()&&!loading&&!selected&&!records.length)load();}
 });
 document.addEventListener('nest-auth-change',()=>{clear();opened=false;if(!hosted&&!busy)load();});
 window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
 window.NestEquipment={open(){if(!opened){opened=true;load();}},clear(){opened=false;clear();}};
 window.NestAuth?.ready.then(()=>{if(!hosted)load();});
})();
