(()=>{
 'use strict';
 const $=id=>document.getElementById('fabrication-'+id),manage=document.body.dataset.fabricationManage==='true';
 let page=0,rows=[],selected=null,dirty=false,busy=false,generation=0;
 const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
 const label=id=>id.slice(0,8).toUpperCase();
 const signedIn=()=>window.NestAuth?.identity?.signedIn;
 function history(node,updates){node.replaceChildren(...updates.slice().reverse().map(update=>{const li=text('li',update.status+(update.note?' · '+update.note:'')),time=text('time',new Date(update.time).toLocaleString());time.dateTime=update.time;li.append(time);return li;}));}
 function clear(){generation++;rows=[];selected=null;dirty=false;$('list').replaceChildren();if(manage){$('detail').hidden=true;$('fields').replaceChildren();$('requestor').textContent='';$('email-preview').textContent='';$('notes').value='';$('legacy-log').textContent='';$('history').replaceChildren();}$('workspace').hidden=true;}
 async function request(body){const response=await fetch('/api/fabrication'+(body?'':`?page=${page}${manage?'&manage=1':''}`),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Requests are unavailable.');return result;}
 function renderList(){
  const query=$('search').value.trim().toLowerCase(),status=$('filter').value;
  const matches=rows.filter(row=>(!status||row.status===status)&&(!query||[row.id,row.machine,manage?row.name:''].join(' ').toLowerCase().includes(query)));
  $('list').replaceChildren(...matches.map(row=>{
   if(manage){const button=document.createElement('button');button.type='button';button.className='fabrication-request';button.setAttribute('aria-pressed',String(selected?.id===row.id));button.append(text('strong',row.name),text('span',row.machine),text('span',row.status+' · '+label(row.id)));button.addEventListener('click',()=>{if(dirty&&!window.confirm('Discard unsaved changes?'))return;show(row);renderList();});return button;}
   const card=document.createElement('article');card.className='fabrication-public-card';card.id=row.id;card.append(text('h3','Request '+label(row.id)),text('p',row.machine),text('p',row.status));const log=document.createElement('ol');history(log,row.updates);card.append(log);return card;
  }));if(!matches.length)$('list').append(text('p','No requests match on this page.'));
 }
 function emailButton(){const allowed=selected&&selected.emailState==='unsent'&&selected.updates.length&&!dirty&&!busy;$('email').disabled=!allowed;$('email-state').textContent=dirty?'Save changes before sending.':selected?.emailState==='sent'?'The saved update was emailed.':['sending','unknown'].includes(selected?.emailState)?'An email was attempted. Check the sent-mail log before sending again.':selected?.emailState==='none'?'Save an update to enable email.':'The latest saved update has not been emailed.';}
 function show(row){
  selected=row;dirty=false;$('detail').hidden=false;$('title').textContent='Request '+label(row.id);$('requestor').textContent=row.name+' · '+row.email;
  $('fields').replaceChildren(...row.fields.flatMap(field=>{
   const dt=text('dt',field.label),dd=text('dd',field.value);
   if(/^https:\/\/[^\s]+$/i.test(field.value)){try{const url=new URL(field.value);if(['drive.google.com','docs.google.com'].includes(url.hostname)){const link=text('a','Open file');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';dd.replaceChildren(link);}}catch{}}
   return [dt,dd];
  }));$('status').value=row.status;$('notes').value=row.notes;$('public-note').value='';$('save').disabled=busy||!row.canUpdate;$('legacy-log').textContent=row.legacyLog||'No existing sheet history.';history($('history'),row.updates);
  const last=row.updates.at(-1);$('email-preview').textContent=last?'Email to '+row.email+': '+last.status+(last.note?' · '+last.note:''):'Updates will be emailed to '+row.email+'.';emailButton();
 }
 async function load(keep=true){
  if(manage&&!signedIn()){clear();$('message').textContent='Sign in with NEST to manage requests.';return;}
  if(dirty||busy)return;
  const current=++generation,old=keep?selected?.id:null;$('message').textContent='Loading requests…';
  try{const result=await request();if(current!==generation||(manage&&!signedIn()))return;rows=result.requests;
   if(!$('filter').dataset.loaded){result.statuses.forEach(status=>{const option=text('option',status);option.value=status;$('filter').append(option);if(manage){const edit=option.cloneNode(true);$('status').append(edit);}});$('filter').dataset.loaded='true';}
   $('workspace').hidden=false;$('prev').disabled=page===0;$('next').disabled=!result.hasMore;$('page').textContent='Page '+(page+1)+' · '+result.total+' requests';
   if(manage){const row=rows.find(row=>row.id===old);if(row)show(row);else{selected=null;$('detail').hidden=true;}}
   renderList();$('message').textContent='Updated '+new Date().toLocaleTimeString()+'.';
  }catch(error){if(current===generation){if(manage)clear();$('message').textContent=error.message;}}
 }
 $('search').addEventListener('input',renderList);$('filter').addEventListener('change',renderList);
 $('refresh').addEventListener('click',()=>{if(dirty&&!window.confirm('Discard unsaved changes and refresh?'))return;dirty=false;load();});
 for(const [id,step] of [['prev',-1],['next',1]])$(id).addEventListener('click',()=>{if(dirty&&!window.confirm('Discard unsaved changes?'))return;dirty=false;page=Math.max(0,page+step);load(false);});
 if(manage){
  $('signin').addEventListener('click',()=>window.NestAuth?.open());
  $('edit').addEventListener('input',()=>{dirty=true;emailButton();});
  $('edit').addEventListener('submit',async event=>{event.preventDefault();if(busy||!selected)return;const row=selected,authGeneration=generation;busy=true;$('save').disabled=true;emailButton();$('message').textContent='Saving update…';
   try{await request({action:'update',id:row.id,version:row.version,status:$('status').value,publicNote:$('public-note').value.trim(),notes:$('notes').value});if(authGeneration!==generation||!signedIn())return;dirty=false;busy=false;await load();$('message').textContent='Update saved. You can now email it to the requestor.';}catch(error){if(authGeneration===generation)$('message').textContent=error.message;}finally{busy=false;if(selected&&signedIn()){$('save').disabled=false;emailButton();}}
  });
  $('email').addEventListener('click',async()=>{if(busy||dirty||!selected)return;const row=selected,last=row.updates.at(-1),authGeneration=generation;busy=true;emailButton();$('message').textContent='Sending the saved update…';
   try{await request({action:'email',id:row.id,version:row.version,eventId:last.eventId});if(authGeneration!==generation||!signedIn())return;busy=false;await load();$('message').textContent='Update emailed to the requestor.';}catch(error){if(authGeneration===generation)$('message').textContent=error.message;}finally{busy=false;if(selected&&signedIn())emailButton();}
  });
  document.addEventListener('nest-auth-change',()=>{clear();load(false);});window.NestAuth?.ready.then(()=>load(false));
 }else{load(false);}
 setInterval(()=>{if(!document.hidden&&!dirty&&!busy&&(!manage||signedIn()))load();},30000);
})();
