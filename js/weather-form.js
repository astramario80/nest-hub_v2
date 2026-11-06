(() => {
 const $=id=>document.getElementById(id),form=$('weather-form');if(!form)return;
 let frozen=false,lensSvg,attemptedEmotion='',catalog=[],config,preview,confirmed='',draft=crypto.randomUUID(),busy=false,confirmationRequest=0,confirmedDraft='',submitted=false,identityKey='',loadVersion=0,counselorRequest=0,supportSent=false,supportAttempt=null;
 const status=$('weather-form-status'),confirmStatus=$('weather-confirm-status'),submitStatus=$('weather-submit-status');
 async function api(operation,fields={},write=false){
  const response=await fetch('/api/weather-native'+(write?'':'?'+new URLSearchParams({operation,...fields})),{method:write?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:write?{'Content-Type':'application/json'}:undefined,body:write?JSON.stringify({operation,...fields}):undefined,signal:AbortSignal.timeout(60000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Weather reports unavailable.');return data;
 }
 window.NestWeather={api,ready:null,config:null,view:'compose'};
 const periodLabel=p=>p==='CTSO'||p==='Advisory'?p:'Division '+p;
 const option=(value,label)=>{const node=document.createElement('option');node.value=value;node.textContent=label;return node;};
 function clearConfirmation(){confirmationRequest++;confirmed='';confirmedDraft='';draft=crypto.randomUUID();attemptedEmotion='';confirmStatus.textContent='';$('weather-counselor').hidden=true;closeNextSteps();$('weather-next-steps').hidden=true;$('weather-options-open').hidden=true;$('weather-support-panel').hidden=true;$('weather-support-open').setAttribute('aria-expanded','false');supportSent=false;supportAttempt=null;$('weather-support-choices').disabled=false;$('weather-request-support').disabled=false;document.querySelectorAll('[name=supportAudience]').forEach(node=>{node.checked=false;node.disabled=false;});$('weather-support-status').textContent='No one has been alerted.';}
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
   // Fit the enlarged, rotated label inside the oval instead of clipping it at a fixed zoom.
   const labelRect=group.querySelector('text')?.getBoundingClientRect(),svgRect=svg.getBoundingClientRect(),view=svg.getAttribute('viewBox').split(/\s+/).map(Number);
   const scale=svgRect.width>0?view[2]/svgRect.width:1;
   const lensWidth=Math.max(220,(labelRect?.width||0)*scale*1.55,(labelRect?.height||0)*scale*1.55*1.25),lensHeight=lensWidth*.8;
   lens.setAttribute('viewBox',`${x-lensWidth/2} ${y-lensHeight/2} ${lensWidth} ${lensHeight}`);
  }
 }
 async function confirm(){
  if(busy||!preview)return;
  if(submitted){submitStatus.textContent='Start a new check-in before choosing another confirmed emotion.';return;}
  const item=preview,period=$('weather-period').value;if(!period){confirmStatus.textContent='Choose your period first.';return;}
  if(confirmed===item.id&&confirmedDraft){confirmStatus.textContent='This emotion is already confirmed.';openNextSteps();return;}
  // Each deliberate changed confirmation receives a new ID; retries keep the same ID.
  if(attemptedEmotion&&attemptedEmotion!==item.id){draft=crypto.randomUUID();confirmed='';confirmedDraft='';}
  attemptedEmotion=item.id;const request=++confirmationRequest,before=draft;busy=true;$('weather-wheel').setAttribute('aria-busy','true');confirmStatus.textContent='Confirming your emotion…';
  try{
   const data=await api('confirm',{period,draft:before,emotion:item.id,previewSurname:config?.testMode?$('weather-preview-surname').value:undefined},true);if(request!==confirmationRequest)return;
   if(!data.confirmed)throw new Error('That confirmation was already used. Choose the emotion again.');confirmed=item.id;confirmedDraft=before;$('weather-emotion-answer').value=item.answer;
   confirmStatus.textContent=data.test?'Test emotion confirmed. No one has been alerted.':'Emotion confirmed. No one has been alerted.';
   showNextSteps(item,data.counselor);
  }catch(error){if(request===confirmationRequest)confirmStatus.textContent=error.message;}
  finally{busy=false;$('weather-wheel').setAttribute('aria-busy','false');}
 }
 const nextSteps={
  Happy:['Notice what is going well and take a moment to enjoy it.','Share appreciation with someone who helped.','Choose one small goal to carry this energy into your work.'],
  Sad:['Give yourself a short, quiet pause and check whether you need water or a break.','Try gentle movement or a familiar activity you enjoy, when class allows.','Name one small, manageable next step, or talk with someone you trust.'],
  Anger:['Pause before responding; try a few slow, comfortable breaths.','Give yourself a little space or take an approved movement break.','Name what you need and use an “I feel” statement when you are ready.'],
  Fear:['Pause and bring your attention to the room around you; breathe at a comfortable pace.','Separate what you know from what you are worried might happen.','Choose one manageable step or ask a trusted person to help you make a plan.'],
  Disgust:['Notice what feels uncomfortable and name the boundary or need behind it.','Take a short pause away from the situation, if you can do so safely.','Decide whether a respectful conversation or help from a trusted adult would be useful.'],
  Surprise:['Pause to notice whether the surprise feels welcome, unsettling, or mixed.','Ask a clarifying question before deciding what to do.','Give yourself time to adjust, then choose one small next step.']
 };
 const resources={breathing:'https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/',plan:'https://www.healthychildren.org/English/healthy-living/emotional-wellness/Building-Resilience/Pages/For-Teens-Creating-Your-Personal-Stress-Management-Plan.aspx',wellbeing:'https://www.cdc.gov/mental-health/living-with/index.html'};
 const cardChoices={
  Happy:[['Enjoy this moment','sun','wellbeing'],['Share appreciation','heart'],['Choose a small goal','steps','plan']],
  Sad:[['Take a gentle pause','wind','breathing'],['Move or recharge','walk','plan'],['One step at a time','steps']],
  Anger:[['Pause and breathe','wind','breathing'],['Give yourself space','walk'],['Put it into words','message','statement']],
  Fear:[['Ground yourself','compass','breathing'],['Sort out the worry','steps','plan'],['Make a small plan','message']],
  Disgust:[['Name what you need','message','statement'],['Take a short reset','walk','wellbeing'],['Talk it through','heart']],
  Surprise:[['Pause and notice','compass','breathing'],['Get some clarity','message'],['Choose your next step','steps','plan']]
 };
 const iconPaths={sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',wind:'M3 8h12a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3',walk:'m13 4 1 0m-1 4-3 5 4 3 1 5m-5-8-3 4-3 2m8-10 3 3 4 1M13 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0',steps:'m3 6 2 2 3-3m3 2h9M3 13l2 2 3-3m3 2h9M3 20h5m3 0h9',compass:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-6-3-2 4-4 2 2-4 4-2Z',message:'M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0ZM7 10h10M7 14h6',calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 10h2m4 0h2m-8 4h2',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M13 3a4 4 0 0 1 0 8M11 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'};
 function optionIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');path.setAttribute('d',iconPaths[name]||iconPaths.heart);svg.append(path);return svg;}

 function makeFlipCard(card){
  const title=card.querySelector('h3').textContent,inner=document.createElement('div'),front=document.createElement('button'),back=document.createElement('div'),label=document.createElement('span'),hint=document.createElement('span'),returnButton=document.createElement('button');
  card.classList.add('weather-flip-card');inner.className='weather-flip-inner';front.className='weather-card-front';front.type='button';front.setAttribute('aria-expanded','false');front.setAttribute('aria-label',title+' — show details');
  back.id='weather-card-'+crypto.randomUUID();back.className='weather-card-back';back.hidden=true;front.setAttribute('aria-controls',back.id);
  const symbol=card.querySelector('.weather-option-icon');if(symbol)front.append(symbol);label.className='weather-card-label';label.textContent=title;hint.className='weather-card-hint';hint.textContent='Hover or tap to explore';front.append(label,hint);
  while(card.firstChild)back.append(card.firstChild);
  returnButton.type='button';returnButton.className='weather-card-return';returnButton.textContent='↶ Back';returnButton.setAttribute('aria-label','Show front of '+title+' card');back.append(returnButton);inner.append(front,back);card.append(inner);
  let pinned=false;
  function flip(open){if(!open&&card.classList.contains('support-expanded'))return;card.classList.toggle('is-flipped',open);front.setAttribute('aria-expanded',String(open));front.setAttribute('aria-hidden',String(open));front.tabIndex=open?-1:0;back.hidden=!open;}
  front.addEventListener('click',()=>{pinned=true;flip(true);back.querySelector('a,button')?.focus();});
  returnButton.addEventListener('click',()=>{if(card.classList.contains('support-expanded')){closeSupportPanel();$('weather-support-open').focus();return;}pinned=false;flip(false);front.focus();});
  card.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')flip(true);});
  card.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&!pinned&&!back.contains(document.activeElement))flip(false);});
  card.addEventListener('focusout',event=>{if(!card.contains(event.relatedTarget)&&!card.matches(':hover')){pinned=false;flip(false);}});
  return card;
 }
 document.querySelectorAll('[data-weather-icon]').forEach(node=>node.replaceChildren(optionIcon(node.dataset.weatherIcon)));
 document.querySelectorAll('.weather-connection-grid .weather-option-card').forEach(makeFlipCard);
 function closeNextSteps(){closeSupportPanel();const popup=$('weather-next-steps');if(popup.open){if(typeof popup.close==='function')popup.close();else popup.removeAttribute('open');}}
 function openNextSteps(){const popup=$('weather-next-steps');if(!confirmed)return;popup.hidden=false;if(!popup.open){if(typeof popup.showModal==='function')popup.showModal();else popup.setAttribute('open','');}}
 $('weather-options-open').addEventListener('click',openNextSteps);
 $('weather-options-close').addEventListener('click',closeNextSteps);
 $('weather-options-continue').addEventListener('click',()=>{closeNextSteps();$('weather-pacing').focus();});
 function closeSupportPanel(){
  $('weather-support-panel').hidden=true;$('weather-support-card').classList.remove('support-expanded');$('weather-support-open').setAttribute('aria-expanded','false');
 }
 $('weather-support-open').addEventListener('click',()=>{
  const panel=$('weather-support-panel'),open=panel.hidden;
  if(!open){closeSupportPanel();return;}
  panel.hidden=false;$('weather-support-card').classList.add('support-expanded');$('weather-support-open').setAttribute('aria-expanded','true');$('weather-support-choices').querySelector('input').focus();
 });
 $('weather-next-steps').addEventListener('click',event=>{if(!$('weather-support-card').contains(event.target))closeSupportPanel();});
 $('weather-next-steps').addEventListener('cancel',event=>{if(!$('weather-support-panel').hidden){event.preventDefault();closeSupportPanel();$('weather-support-open').focus();}});
 $('weather-next-steps').addEventListener('close',closeSupportPanel);
 function showNextSteps(item,counselor){
  $('weather-next-title').textContent='What might help when you feel '+item.family.toLowerCase()+'?';
  $('weather-next-intro').textContent='Choose what fits. Try an idea, explore a resource, or connect with someone.';
  $('weather-suggestions').replaceChildren(...(nextSteps[item.family]||[]).map((text,index)=>{
   const [title,icon,resource]=(cardChoices[item.family]||[])[index],card=document.createElement('div'),symbol=document.createElement('span'),heading=document.createElement('h3'),description=document.createElement('p');
   card.className='weather-option-card';symbol.className='weather-option-icon';symbol.append(optionIcon(icon));heading.textContent=title;description.textContent=text;card.append(symbol,heading,description);
   if(resource){const action=document.createElement(resource==='statement'?'button':'a');if(resource==='statement'){action.type='button';action.textContent='Build an I/Me statement';action.addEventListener('click',()=>{closeNextSteps();openBuilder(true);});}else{action.href=resources[resource];action.target='_blank';action.rel='noopener noreferrer';action.textContent=resource==='breathing'?'Try a breathing exercise ↗':resource==='plan'?'Explore a teen coping plan ↗':'Explore well-being ideas ↗';}card.append(action);}else{const note=document.createElement('span');note.className='weather-option-note';note.textContent='Try this at your own pace';card.append(note);}return makeFlipCard(card);
  }));
  $('weather-counselor').hidden=!counselor;
  if(counselor){const link=$('weather-counselor-link');link.href=counselor.url;link.textContent=counselor.unmatched?'Find your counselor and appointment link ↗':'Schedule with '+counselor.name+' ↗';}
  $('weather-options-open').hidden=false;openNextSteps();
 }
 $('weather-request-support').addEventListener('click',async()=>{
  if(busy||supportSent||!confirmed||!confirmedDraft)return;
  const audience=supportAttempt||[...document.querySelectorAll('[name=supportAudience]:checked')].map(node=>node.value);
  if(!audience.length){$('weather-support-status').textContent='Choose at least one person first. No one has been alerted.';return;}
  supportAttempt=audience;const version=confirmationRequest,current=identityKey;busy=true;$('weather-support-choices').disabled=true;$('weather-support-status').textContent='Requesting support…';
  try{
   const data=await api('notify',{period:$('weather-period').value,draft:confirmedDraft,emotion:confirmed,audience,previewSurname:config?.testMode?$('weather-preview-surname').value:undefined},true);
   if(version!==confirmationRequest||current!==identityKey)return;
   if(!data.notified)throw new Error('Support request was not confirmed. Please try again.');
   supportSent=true;const names={owner:'Mr. Penalver',manager:'your division manager',assistant:'your assistant manager',liaison:'your partner liaison'};
   $('weather-support-status').textContent=data.test?'Test support requested. The alert is visible only to you.':'Support requested from '+audience.map(key=>names[key]).join(', ')+'. Their alert will appear when they are signed in.';
   if(data.test)window.NestWeatherAlerts?.check();
  }catch(error){if(version===confirmationRequest&&current===identityKey)$('weather-support-status').textContent=error.message+' Retry this request with the same selected people.';}
  finally{busy=false;if(version===confirmationRequest&&current===identityKey){$('weather-support-choices').disabled=false;document.querySelectorAll('[name=supportAudience]').forEach(node=>node.disabled=true);$('weather-request-support').disabled=supportSent;}}
 });
 async function previewCounselor(){
  const request=++counselorRequest,version=loadVersion,link=$('weather-preview-counselor-link'),message=$('weather-preview-counselor-status');link.hidden=true;
  if(!config?.testMode||!$('weather-preview-surname').value)return;
  message.textContent='Finding the counselor for '+$('weather-preview-surname').value+'…';
  try{const data=await api('counselor',{period:$('weather-period').value,previewSurname:$('weather-preview-surname').value});if(request!==counselorRequest||version!==loadVersion)return;const counselor=data.counselor;
   message.textContent=counselor.unmatched?'No reliable counselor match; showing the school counseling directory.':'Assigned counselor: '+counselor.name;link.href=counselor.url;link.textContent=counselor.unmatched?'Open school counseling directory':'Schedule with '+counselor.name;link.hidden=false;
   if(!$('weather-counselor').hidden){$('weather-counselor-link').href=link.href;$('weather-counselor-link').textContent=link.textContent;}
  }catch(error){if(request===counselorRequest&&version===loadVersion)message.textContent=error.message;}
 }
 $('weather-preview-surname').addEventListener('change',()=>{clearConfirmation();previewCounselor();});
 $('weather-period').addEventListener('change',()=>{clearConfirmation();previewCounselor();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(submitted){form.reset();$('weather-submit').formNoValidate=false;submitted=false;clearConfirmation();preview=null;$('weather-emotion-answer').value='';$('weather-submit').textContent=config?.testMode?'Complete administrator test':'Submit weather report';submitStatus.textContent=config?.testMode?'Ready for another administrator test.':'Ready for a new check-in.';return;}
  if(!form.reportValidity())return;
  if(!confirmed||!confirmedDraft){submitStatus.textContent='Click an emotion on the wheel to confirm it before submitting.';$('weather-wheel').querySelector('[tabindex="0"]')?.focus();return;}
  busy=true;$('weather-submit').disabled=true;submitStatus.textContent=config?.testMode?'Validating your administrator test…':'Saving your weather report…';const current=identityKey;
  try{const data=await api('submit',{draft:confirmedDraft,period:$('weather-period').value,emotion:confirmed,pacing:Number($('weather-pacing').value),challenge:Number($('weather-challenge').value),safety:Number($('weather-safety').value),working:$('weather-working').value,change:$('weather-change').value},true);if(current!==identityKey)return;
   if(data.saved){submitted=true;$('weather-submit').formNoValidate=true;submitStatus.textContent=data.test?'Administrator test completed. No student report was added.':'Your weather report has been saved. Thank you for checking in.';$('weather-submit').textContent=data.test?'Start another test':'Start another check-in';}
  }catch(error){if(current===identityKey)submitStatus.textContent=error.message;}
  finally{busy=false;$('weather-submit').disabled=false;}
 });
 const dialog=$('weather-builder');let builderFromOptions=false;const builderFields=['feeling','when','need','request'];
 // Suggestions are sentence starters, not interpretations of a student's experience.
 const builderIdeas={
  feeling:{
   'Happy, connected, or proud':['happy','grateful','proud','included','hopeful','excited'],
   'Calm or ready':['calm','comfortable','focused','curious','confident','relieved'],
   'Sad or disconnected':['sad','lonely','disappointed','left out','discouraged','hurt'],
   'Angry or frustrated':['frustrated','angry','annoyed','irritated','upset','impatient'],
   'Worried or overwhelmed':['worried','nervous','afraid','overwhelmed','uncertain','stressed'],
   'Uncomfortable or surprised':['uncomfortable','uneasy','confused','surprised','shocked','unsure']
  },
  when:{
   'Plans and instructions':['our plans change without warning','I am not sure what to do next','instructions move faster than I can follow','I receive different instructions from different people'],
   'Teamwork and belonging':['I do not get a turn to contribute','my ideas are interrupted','I am not included in a group decision','we listen to each other and work together'],
   'Workload and learning':['several tasks are due at the same time','I get stuck and do not know how to ask for help','I do not have enough time to finish','I notice that I am making progress'],
   'Space and boundaries':['the room gets too noisy for me to focus','my materials are used without asking','I need a break but do not know how to request one','someone respects a boundary I have shared'],
   'Feedback and recognition':['feedback is given before I can explain my thinking','I am unsure what I did well or could improve','my effort is noticed','I have a chance to try again']
  },
  need:{
   'Clarity and predictability':['clear instructions','time to understand what comes next','a plan I can refer back to','a clear idea of what success looks like'],
   'Belonging and respect':['a chance to be heard','respectful communication','to feel included','fair opportunities to contribute'],
   'Time and support':['enough time to think','help getting started','a manageable amount of work','a chance to ask questions'],
   'Space and choice':['a quieter space to focus','a short break to reset','my personal boundaries to be respected','some choice in how I approach a task'],
   'Growth and encouragement':['feedback I can use','encouragement while I practice','recognition of my effort','a chance to learn from mistakes']
  },
  request:{
   'Make a clear plan':['we could agree on the plan before starting','the steps could be written down','someone could show me an example','we could check that I understand the next step'],
   'Make room for everyone':['we could take turns sharing ideas','I could finish my thought before someone responds','I could have a clear role in the group','we could make the next decision together'],
   'Adjust the pace or workload':['we could break the task into smaller steps','I could have a little more time','we could decide which task to do first','someone could help me get started'],
   'Respect space and boundaries':['I could take an approved short break','I could work in a quieter spot when possible','people could ask before using my materials','we could agree on a respectful way to pause a conversation'],
   'Ask for a conversation':['we could talk privately about what happened','someone could check in with me later','we could discuss one change to try next time','we could notice what is working and keep doing it']
  }
 };
 function syncBuilderIdea(key){const field=$('weather-builder-'+key),ideas=$('weather-builder-'+key+'-ideas');ideas.value=[...ideas.options].some(option=>option.value===field.value)?field.value:'__custom__';}
 builderFields.forEach(key=>{
  const ideas=$('weather-builder-'+key+'-ideas'),field=$('weather-builder-'+key);
  ideas.append(option('','Choose an idea by theme…'),option('__custom__','Write my own…'));
  Object.entries(builderIdeas[key]).forEach(([theme,phrases])=>{const group=document.createElement('optgroup');group.label=theme;phrases.forEach(phrase=>group.append(option(phrase,phrase)));ideas.append(group);});
  ideas.addEventListener('change',()=>{if(ideas.value&&ideas.value!=='__custom__')field.value=ideas.value;field.focus();if(ideas.value==='__custom__')field.select();$('weather-builder-preview').textContent=statement();});
 });
 function statement(){const values=builderFields.map(k=>$('weather-builder-'+k).value.trim());return [values[0]?'I feel '+values[0]:'',values[1]?'when '+values[1]:'',values[2]?'because I '+$('weather-builder-need-verb').value+' '+values[2]:''].filter(Boolean).join(' ')+(values[3]?'. It would help me if '+values[3]+'.':'.');}
 builderFields.forEach(k=>$('weather-builder-'+k).addEventListener('input',()=>{syncBuilderIdea(k);$('weather-builder-preview').textContent=statement();}));
 $('weather-builder-need-verb').addEventListener('change',()=>{$('weather-builder-preview').textContent=statement();});
 function openBuilder(fromOptions=false){builderFromOptions=fromOptions;$('weather-builder-back').hidden=!confirmed;if(!$('weather-builder-feeling').value){const selected=(catalog.find(x=>x.id===confirmed)||preview)?.label.toLowerCase()||'';$('weather-builder-feeling').value=({anger:'angry',fear:'afraid',disgust:'uncomfortable',surprise:'surprised'})[selected]||selected;}builderFields.forEach(syncBuilderIdea);$('weather-builder-preview').textContent=statement();dialog.showModal();}
 $('weather-builder-open').addEventListener('click',()=>openBuilder());
 $('weather-builder-back').addEventListener('click',()=>{builderFromOptions=false;dialog.close();openNextSteps();});
 dialog.addEventListener('close',()=>{if(builderFromOptions){builderFromOptions=false;openNextSteps();}});
 $('weather-builder-close').addEventListener('click',()=>dialog.close());$('weather-builder-use').addEventListener('click',()=>{const text=statement();if(text==='.')return;const target=$('weather-change');target.value=[target.value.trim(),text].filter(Boolean).join('\n\n').slice(0,5000);builderFromOptions=false;dialog.close();target.focus();});
 function view(name){window.NestWeather.view=name;$('weather-compose').hidden=name!=='compose';$('weather-report-view').hidden=name==='compose';$('weather-admin-tools').hidden=name!=='admin';document.querySelectorAll('[data-weather-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.weatherTab===name)));document.dispatchEvent(new CustomEvent('nest-weather-view',{detail:{view:name}}));}
 document.querySelectorAll('[data-weather-tab]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.weatherTab==='admin'&&!config?.admin)return;view(button.dataset.weatherTab);}));
 $('weather-test-alert').addEventListener('click',async()=>{const button=$('weather-test-alert');button.disabled=true;$('weather-test-status').textContent='Creating a private test…';try{await api('test',{period:'1',emotion:catalog.find(x=>x.family==='Sad').id,draft:crypto.randomUUID()},true);$('weather-test-status').textContent='Test created. Your support-alert panel will display it on its next check.';window.NestWeatherAlerts?.check();}catch(error){$('weather-test-status').textContent=error.message;}finally{button.disabled=false;}});
 $('weather-refresh-counselors').addEventListener('click',async()=>{const button=$('weather-refresh-counselors');button.disabled=true;try{const data=await api('refresh-counselors',{},true);$('weather-counselor-health').textContent=data.error||'Directory checked '+new Date(data.checkedAt).toLocaleString();}catch(error){$('weather-counselor-health').textContent=error.message;}finally{button.disabled=false;}});
 $('weather-calendar-import').addEventListener('click',async()=>{const button=$('weather-calendar-import');button.disabled=true;$('weather-calendar-status').textContent='Reading school calendars…';try{const data=await api('import-calendar',{year:$('weather-calendar-year').value},true);['start','t1','t2','end'].forEach((key,i)=>$('weather-calendar-'+key).value=data.dates[i]);document.dispatchEvent(new CustomEvent('nest-weather-calendars'));$('weather-calendar-status').textContent='Imported and saved '+data.year+' trimester dates from the school calendar. Report results refreshed.';}catch(error){$('weather-calendar-status').textContent=error.message;}finally{button.disabled=false;}});
 $('weather-calendar-save').addEventListener('click',async()=>{const button=$('weather-calendar-save');button.disabled=true;try{await api('calendar',{year:$('weather-calendar-year').value,dates:['start','t1','t2','end'].map(k=>$('weather-calendar-'+k).value)},true);document.dispatchEvent(new CustomEvent('nest-weather-calendars'));$('weather-calendar-status').textContent='Dates saved. Report results refreshed.';}catch(error){$('weather-calendar-status').textContent=error.message;}finally{button.disabled=false;}});
 $('weather-export').addEventListener('click',async()=>{const button=$('weather-export'),status=$('weather-export-status');button.disabled=true;status.textContent='Preparing your private archive and charts…';try{const data=await api('export',{period:$('weather-division').value,year:$('weather-year').value,trimester:$('weather-trimester').value},true);status.textContent=data.count+' reports. '+data.note;for(const [key,label] of [['xlsx','Download spreadsheet'],['pdf','Download PDF'],['spreadsheet','Open private archive']]){const a=document.createElement('a');a.href=data[key];a.textContent=label;a.target='_blank';a.rel='noopener noreferrer';status.append(a);}}catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
 const wheelReady=Promise.all([fetch('/assets/weather-emotions.json').then(r=>{if(!r.ok)throw new Error('Emotion list unavailable.');return r.json();}),fetch('/assets/emotional-check-in.svg',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Emotion wheel unavailable.');return r.text();})]).then(([items,source])=>{
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
