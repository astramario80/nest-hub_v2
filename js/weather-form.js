(() => {
 const $=id=>document.getElementById(id),form=$('weather-form');if(!form)return;
 let frozen=false,lensSvg,attemptedEmotion='',catalog=[],config,preview,confirmed='',draft=crypto.randomUUID(),busy=false,confirmationRequest=0,confirmedDraft='',submitted=false,identityKey='',loadVersion=0,counselorRequest=0;
 const status=$('weather-form-status'),confirmStatus=$('weather-confirm-status'),submitStatus=$('weather-submit-status');
 async function api(operation,fields={},write=false){
  const response=await fetch('/api/weather-native'+(write?'':'?'+new URLSearchParams({operation,...fields})),{method:write?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:write?{'Content-Type':'application/json'}:undefined,body:write?JSON.stringify({operation,...fields}):undefined,signal:AbortSignal.timeout(60000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Weather reports unavailable.');return data;
 }
 window.NestWeather={api,ready:null,config:null,view:'compose'};
 const periodLabel=p=>p==='CTSO'||p==='Advisory'?p:'Division '+p;
 const option=(value,label)=>{const node=document.createElement('option');node.value=value;node.textContent=label;return node;};
 function clearConfirmation(){confirmationRequest++;confirmed='';confirmedDraft='';draft=crypto.randomUUID();attemptedEmotion='';confirmStatus.textContent='';$('weather-counselor').hidden=true;}
 function select(item,point,explicit=false){
  if(explicit&&confirmed&&confirmed!==item.id)clearConfirmation();
  preview=item;if(!confirmed||explicit){$('weather-emotion-answer').value=item.answer;}
  $('weather-preview-status').textContent=(explicit?'Selected: ':'Preview: ')+item.answer;
  const svg=$('weather-wheel').querySelector('svg'),group=svg?.querySelector('[data-emotion="'+item.id+'"]');
  if(explicit&&group){svg.querySelectorAll('[data-emotion]').forEach(n=>n.setAttribute('tabindex',n===group?'0':'-1'));}
  svg?.querySelectorAll('.selected').forEach(n=>n.classList.remove('selected'));group?.classList.add('selected');
  if(svg&&group){if(!lensSvg){lensSvg=svg.cloneNode(true);lensSvg.removeAttribute('role');lensSvg.removeAttribute('aria-label');lensSvg.querySelectorAll('[tabindex]').forEach(n=>n.removeAttribute('tabindex'));lensSvg.querySelectorAll('.selected').forEach(n=>n.classList.remove('selected'));$('weather-lens').replaceChildren(lensSvg);}const lens=lensSvg;let x=1000,y=1000;
   const holder=$('weather-wheel'),rect=holder.getBoundingClientRect(),popup=$('weather-lens');
   popup.hidden=!point;
   if(point){popup.style.left=Math.max(0,Math.min(Math.max(0,rect.width-200),point.clientX-rect.left-100))+'px';popup.style.top=Math.max(0,Math.min(Math.max(0,rect.height-160),point.clientY-rect.top-80))+'px';}
   if(point){const matrix=svg.getScreenCTM?.();if(matrix){const p=svg.createSVGPoint();p.x=point.clientX;p.y=point.clientY;const local=p.matrixTransform(matrix.inverse());x=local.x;y=local.y;}}
   {const transform=group.querySelector('text')?.getAttribute('transform')||'',match=transform.match(/rotate\(([-\d.]+)\) translate\(([-\d.]+),/);if(match){const angle=Number(match[1])*Math.PI/180,radius=Number(match[2]);x=1000+radius*Math.cos(angle);y=1000+radius*Math.sin(angle);}}
   lens.setAttribute('viewBox',`${Math.max(0,Math.min(1880,x-60))} ${Math.max(0,Math.min(1904,y-48))} 120 96`);
  }
 }
 async function confirm(){
  if(busy||!preview)return;
  if(submitted){submitStatus.textContent='Start a new check-in before choosing another confirmed emotion.';return;}
  const item=preview,period=$('weather-period').value;if(!period){confirmStatus.textContent='Choose your period first.';return;}
  if(confirmed===item.id&&confirmedDraft){confirmStatus.textContent='This emotion is already confirmed.';return;}
  // Each deliberate changed confirmation receives a new ID; retries keep the same ID.
  if(attemptedEmotion&&attemptedEmotion!==item.id){draft=crypto.randomUUID();confirmed='';confirmedDraft='';}
  attemptedEmotion=item.id;const request=++confirmationRequest,before=draft;busy=true;$('weather-wheel').setAttribute('aria-busy','true');confirmStatus.textContent='Confirming your emotion…';
  try{
   const data=await api('confirm',{period,draft:before,emotion:item.id,previewSurname:config?.testMode?$('weather-preview-surname').value:undefined},true);if(request!==confirmationRequest)return;
   if(!data.confirmed)throw new Error('That confirmation was already used. Choose the emotion again.');confirmed=item.id;confirmedDraft=before;$('weather-emotion-answer').value=item.answer;
   confirmStatus.textContent=data.test?(data.alerted?'Test emotion confirmed. The support alert is visible only to you.':'Test emotion confirmed.'):data.alerted?'Emotion confirmed. A support alert is available to Mr. Penalver, your division manager, and partner liaison.':'Emotion confirmed.';
   if(item.charged&&data.counselor){$('weather-counselor').hidden=false;const link=$('weather-counselor-link');link.href=data.counselor.url;link.textContent=data.counselor.unmatched?'Find your counselor and appointment link':'Schedule with '+data.counselor.name;}
  }catch(error){if(request===confirmationRequest)confirmStatus.textContent=error.message;}
  finally{busy=false;$('weather-wheel').setAttribute('aria-busy','false');}
 }
 async function previewCounselor(){
  const request=++counselorRequest,version=loadVersion,link=$('weather-preview-counselor-link'),message=$('weather-preview-counselor-status');link.hidden=true;
  if(!config?.testMode||!$('weather-preview-surname').value)return;
  message.textContent='Finding the counselor for '+$('weather-preview-surname').value+'…';
  try{const data=await api('counselor',{period:$('weather-period').value,previewSurname:$('weather-preview-surname').value});if(request!==counselorRequest||version!==loadVersion)return;const counselor=data.counselor;
   message.textContent=counselor.unmatched?'No reliable counselor match; showing the school counseling directory.':'Assigned counselor: '+counselor.name;link.href=counselor.url;link.textContent=counselor.unmatched?'Open school counseling directory':'Schedule with '+counselor.name;link.hidden=false;
   if(!$('weather-counselor').hidden){$('weather-counselor-link').href=link.href;$('weather-counselor-link').textContent=link.textContent;}
  }catch(error){if(request===counselorRequest&&version===loadVersion)message.textContent=error.message;}
 }
 $('weather-preview-surname').addEventListener('change',previewCounselor);
 $('weather-period').addEventListener('change',()=>{clearConfirmation();previewCounselor();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(submitted){form.reset();$('weather-submit').formNoValidate=false;submitted=false;clearConfirmation();preview=null;$('weather-emotion-answer').value='';$('weather-submit').textContent=config?.testMode?'Complete administrator test':'Submit weather report';submitStatus.textContent=config?.testMode?'Ready for another administrator test.':'Ready for a new check-in.';return;}
  if(!form.reportValidity())return;
  if(!confirmed||!confirmedDraft){submitStatus.textContent='Click an emotion on the wheel to confirm it before submitting.';$('weather-wheel').querySelector('[tabindex="0"]')?.focus();return;}
  busy=true;$('weather-submit').disabled=true;submitStatus.textContent=config?.testMode?'Validating your administrator test…':'Saving your weather report…';const current=identityKey;
  try{const data=await api('submit',{draft:confirmedDraft,period:$('weather-period').value,emotion:confirmed,pacing:Number($('weather-pacing').value),challenge:Number($('weather-challenge').value),safety:Number($('weather-safety').value),working:$('weather-working').value,change:$('weather-change').value},true);if(current!==identityKey)return;
   if(data.saved){submitted=true;$('weather-submit').formNoValidate=true;submitStatus.textContent=data.test?'Administrator test completed. No student report was added; test support alerts are visible only to you.':'Your weather report has been saved. Thank you for checking in.';$('weather-submit').textContent=data.test?'Start another test':'Start another check-in';}
  }catch(error){if(current===identityKey)submitStatus.textContent=error.message;}
  finally{busy=false;$('weather-submit').disabled=false;}
 });
 const dialog=$('weather-builder');const builderFields=['feeling','when','need','request'];
 function statement(){const values=builderFields.map(k=>$('weather-builder-'+k).value.trim());return [values[0]?'I feel '+values[0]:'',values[1]?'when '+values[1]:'',values[2]?'because I need / value '+values[2]:''].filter(Boolean).join(' ')+(values[3]?'. It would help me if '+values[3]+'.':'.');}
 builderFields.forEach(k=>$('weather-builder-'+k).addEventListener('input',()=>{$('weather-builder-preview').textContent=statement();}));
 $('weather-builder-open').addEventListener('click',()=>{if(!$('weather-builder-feeling').value)$('weather-builder-feeling').value=(catalog.find(x=>x.id===confirmed)||preview)?.label.toLowerCase()||'';$('weather-builder-preview').textContent=statement();dialog.showModal();});
 $('weather-builder-close').addEventListener('click',()=>dialog.close());$('weather-builder-use').addEventListener('click',()=>{const text=statement();if(text==='.')return;const target=$('weather-change');target.value=[target.value.trim(),text].filter(Boolean).join('\n\n').slice(0,5000);dialog.close();target.focus();});
 function view(name){window.NestWeather.view=name;$('weather-compose').hidden=name!=='compose';$('weather-report-view').hidden=name==='compose';$('weather-admin-tools').hidden=name!=='admin';document.querySelectorAll('[data-weather-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.weatherTab===name)));document.dispatchEvent(new CustomEvent('nest-weather-view',{detail:{view:name}}));}
 document.querySelectorAll('[data-weather-tab]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.weatherTab==='admin'&&!config?.admin)return;view(button.dataset.weatherTab);}));
 $('weather-test-alert').addEventListener('click',async()=>{const button=$('weather-test-alert');button.disabled=true;$('weather-test-status').textContent='Creating a private test…';try{await api('test',{period:'1',emotion:catalog.find(x=>x.family==='Sad').id,draft:crypto.randomUUID()},true);$('weather-test-status').textContent='Test created. Your support-alert panel will display it on its next check.';window.NestWeatherAlerts?.check();}catch(error){$('weather-test-status').textContent=error.message;}finally{button.disabled=false;}});
 $('weather-refresh-counselors').addEventListener('click',async()=>{const button=$('weather-refresh-counselors');button.disabled=true;try{const data=await api('refresh-counselors',{},true);$('weather-counselor-health').textContent=data.error||'Directory checked '+new Date(data.checkedAt).toLocaleString();}catch(error){$('weather-counselor-health').textContent=error.message;}finally{button.disabled=false;}});
 $('weather-calendar-import').addEventListener('click',async()=>{const button=$('weather-calendar-import');button.disabled=true;$('weather-calendar-status').textContent='Reading school calendars…';try{const data=await api('import-calendar',{year:$('weather-calendar-year').value},true);['start','t1','t2','end'].forEach((key,i)=>$('weather-calendar-'+key).value=data.dates[i]);document.dispatchEvent(new CustomEvent('nest-weather-calendars'));$('weather-calendar-status').textContent='Imported and saved '+data.year+' trimester dates from the school calendar. Report results refreshed.';}catch(error){$('weather-calendar-status').textContent=error.message;}finally{button.disabled=false;}});
 $('weather-calendar-save').addEventListener('click',async()=>{const button=$('weather-calendar-save');button.disabled=true;try{await api('calendar',{year:$('weather-calendar-year').value,dates:['start','t1','t2','end'].map(k=>$('weather-calendar-'+k).value)},true);document.dispatchEvent(new CustomEvent('nest-weather-calendars'));$('weather-calendar-status').textContent='Dates saved. Report results refreshed.';}catch(error){$('weather-calendar-status').textContent=error.message;}finally{button.disabled=false;}});
 $('weather-export').addEventListener('click',async()=>{const button=$('weather-export'),status=$('weather-export-status');button.disabled=true;status.textContent='Preparing your private archive and charts…';try{const data=await api('export',{period:$('weather-division').value,year:$('weather-year').value,trimester:$('weather-trimester').value},true);status.textContent=data.count+' reports. '+data.note;for(const [key,label] of [['xlsx','Download spreadsheet'],['pdf','Download PDF'],['spreadsheet','Open private archive']]){const a=document.createElement('a');a.href=data[key];a.textContent=label;a.target='_blank';a.rel='noopener noreferrer';status.append(a);}}catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
 const wheelReady=Promise.all([fetch('/assets/weather-emotions.json').then(r=>{if(!r.ok)throw new Error('Emotion list unavailable.');return r.json();}),fetch('/assets/emotional-check-in.svg').then(r=>{if(!r.ok)throw new Error('Emotion wheel unavailable.');return r.text();})]).then(([items,source])=>{
  catalog=items;const parsed=new DOMParser().parseFromString(source,'image/svg+xml');if(parsed.querySelector('parsererror,script,foreignObject'))throw new Error('Emotion wheel could not load.');
  const svg=document.importNode(parsed.documentElement,true);$('weather-wheel').replaceChildren(svg);svg.setAttribute('role','group');const groups=[...svg.querySelectorAll('[data-emotion]')];groups[0]?.setAttribute('tabindex','0');
  svg.addEventListener('keydown',event=>{const group=event.target.closest('[data-emotion]');if(!group)return;let index=groups.indexOf(group);if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();index=event.key==='Home'?0:event.key==='End'?groups.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+groups.length)%groups.length;groups.forEach(n=>n.setAttribute('tabindex','-1'));groups[index].setAttribute('tabindex','0');groups[index].focus();select(items.find(x=>x.id===groups[index].dataset.emotion));}else if(event.key==='Enter'||event.key===' '){event.preventDefault();group.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
  svg.addEventListener('pointerover',event=>{const group=event.target.closest('[data-emotion]'),item=items.find(x=>x.id===group?.dataset.emotion);if(item&&!busy&&!frozen)select(item,event);});
  svg.addEventListener('pointermove',event=>{const group=event.target.closest('[data-emotion]');if(group&&preview?.id===group.dataset.emotion&&!busy&&!frozen)select(preview,event);});
  svg.addEventListener('pointerleave',()=>{frozen=false;$('weather-lens').hidden=true;});
  svg.addEventListener('click',event=>{const group=event.target.closest('[data-emotion]'),item=items.find(x=>x.id===group?.dataset.emotion);if(item&&!busy){select(item,event,true);frozen=true;$('weather-lens').hidden=true;if($('weather-fields').disabled){confirmStatus.textContent='Preview selected. Student check-ins require a matching enrolled-student account.';}else confirm();}});
 }).catch(error=>{status.textContent=error.message;throw error;});
 async function load(){
  const version=++loadVersion;identityKey=String(window.NestAuth?.identity?.email||'')+':'+String(window.NestAuth?.identity?.username||'');clearConfirmation();form.reset();preview=null;submitted=false;config=null;window.NestWeather.config=null;$('weather-fields').disabled=true;$('weather-admin-tab').hidden=true;$('weather-preview-counselor').hidden=true;counselorRequest++;view('compose');
  if(!window.NestAuth?.identity?.signedIn){status.textContent='Sign in to NEST to check in.';window.NestWeather.ready=Promise.resolve(null);return;}
  status.textContent='Loading your check-in…';const pending=api('bootstrap');window.NestWeather.ready=pending;
  try{const data=await pending;await wheelReady;if(version!==loadVersion)return;config=data;window.NestWeather.config=data;
   $('weather-admin-tab').hidden=!data.admin;const formPeriods=data.testMode?data.previewPeriods:data.studentPeriods;$('weather-period').replaceChildren(...formPeriods.map(p=>option(p,periodLabel(p))));$('weather-fields').disabled=!formPeriods.length;$('weather-submit').textContent=data.testMode?'Complete administrator test':'Submit weather report';
   $('weather-preview-counselor').hidden=!data.testMode;$('weather-preview-surname').replaceChildren(...(data.previewSurnames||[]).map(name=>option(name,name)));if(data.testMode)previewCounselor();
   status.textContent=data.testMode?'Administrator test mode: choose any division and try the complete form. Alerts are visible only to you. Completing this test does not add a student report.':data.studentPeriods.length?'Choose the emotion that fits how you feel today.':data.admin?'Your administrator account can review the archive and test support alerts. Student check-ins require a matching enrolled-student record.':'Your school email and period could not be matched to the enrolled-student directory. Ask Mr. Penalver to check your linked email and enrollment.';
   const currentYear=Object.keys(data.calendars||{}).sort().at(-1);if(currentYear){$('weather-calendar-year').value=currentYear;['start','t1','t2','end'].forEach((k,i)=>$('weather-calendar-'+k).value=data.calendars[currentYear][i]);}
   $('weather-counselor-health').textContent=data.counselorError|| (data.counselorCheckedAt?'Directory checked '+new Date(data.counselorCheckedAt).toLocaleString():'Directory has not been checked yet.');
   document.dispatchEvent(new CustomEvent('nest-weather-ready',{detail:data}));
  }catch(error){if(version===loadVersion)status.textContent=error.message;}
 }
 document.addEventListener('nest-auth-change',load);window.NestAuth?.ready.then(load);
})();
