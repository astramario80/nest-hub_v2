(()=>{
 'use strict';
 const $=id=>document.getElementById('purchase-'+id),form=$('admin-form'),requestForm=$('request-form'),money=n=>Number.isFinite(n)?n.toLocaleString('en-US',{style:'currency',currency:'USD'}):'Not estimated',division=p=>p==='CTSO'?'NEST™ Robotics':'Division '+p;
 let access=null,requests=[],discussionTeam=[],budget=null,options=null,selected=new Set(),links=[],busy=false,generation=0,preview=null,asbPreview=null,runId=crypto.randomUUID(),requestId=crypto.randomUUID(),attendanceGeneration=0,activeWorkspace='purchasing',listView='active',lastPanels={purchasing:'checkout',items:'requested'},navInitialized=false,submission=null,reviewOverflow='',choicesFlight=null,activeLoad=null,optionsApplied=false,receiptRead=0,descriptionEdits=0,lastReceiptDescription='',historyRuns=[],submissionUpdates=new Map(),schoolYear='';
 const signedIn=()=>window.NestAuth?.identity?.signedIn,node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;},message=text=>$('message').textContent=text;
 const field=(f,name)=>f.elements.namedItem(name);
 const estimate=x=>x.unitCost===null?null:Math.round((x.quantity*x.unitCost+x.shipping)*100)/100;
 function itemLink(parent,url){
  if(!url)return false;
  let valid=false;try{const saved=new URL(url),nest=['gknest.org','www.gknest.org',location.hostname].includes(saved.hostname),home=['/','/index','/index.html'].includes(saved.pathname.replace(/\/$/,'')||'/');valid=saved.protocol==='https:'&&!(nest&&home);}catch{}
  if(!valid){parent.append(node('p','Item link needs correction: the saved URL points to the NEST™ Menu or is not a valid product link. Use Edit item to add the product’s full URL.','purchase-warning'));return false;}
  const a=node('a','View item ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('data-external','');parent.append(a,node('p',url,'purchase-item-url'));return true;
 }
 function clearPreview(){preview=null;submission=null;if($('preview').open)$('preview').close();$('preview').hidden=true;$('preview-content').replaceChildren();$('submit-status').textContent='';$('submit-title').textContent='Ready for your confirmation';$('review-note').textContent='';$('status-check').hidden=true;document.body.style.overflow=reviewOverflow;}
 function submissionFeedback(state,title,text){$('submit-feedback').dataset.state=state;$('submit-feedback').setAttribute('aria-busy',String(state==='sending'));$('submit-title').textContent=title;$('submit-status').textContent=text;message(title+(text?' — '+text:''));}
 function renderPurchaseReview(p,d){
  const content=$('preview-content'),practice=p.type==='Practice Purchase — email preview only',asb=p.type==='ASB Purchase Request';
  const section=(title,cls='')=>{const box=node('section',undefined,'purchase-review-card '+cls);box.append(node('h3',title));return box;};
  const fact=(list,label,value)=>{list.append(node('dt',label),node('dd',value));};
  const hero=node('section',undefined,'purchase-review-hero'),summary=node('div'),meta=node('div',undefined,'purchase-review-meta');
  const day=/^\d{4}-\d{2}-\d{2}$/.test(d.day||'')?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(d.day+'T12:00:00')):d.day||'';
  meta.append(node('span',practice?'Practice preview':p.type,'purchase-review-badge'),node('span',day));summary.append(meta,node('h3',p.vendor),node('p',d.description||'','purchase-review-description'));
  const total=node('div',undefined,'purchase-review-total');total.append(node('span',asb?'Request total':'Receipt amount'),node('strong',money(asb&&p.asbTotal!==null?p.asbTotal:p.amount)));hero.append(summary,total);
  const metrics=node('div',undefined,'purchase-review-metrics');
  for(const [label,value] of [['Current CTE balance',p.balance],[practice?'Practice budget impact':'Estimated budget impact',p.estimatedImpact]]){const metric=node('div');metric.append(node('span',label),node('strong',money(value)));metrics.append(metric);}
  const grid=node('div',undefined,'purchase-review-grid'),delivery=section(practice?'Practice email':'Email & routing'),deliveryList=node('dl');
  if(practice){fact(deliveryList,'Sent only to','mpenalver@bethelsd.org');fact(deliveryList,'Would send to',p.recipient);delivery.append(node('p','The clerk receives nothing during practice.','purchase-review-caption'));}
  else fact(deliveryList,asb?'Final ASB route':'Send receipt to',p.recipient);
  delivery.append(deliveryList);
  if(asb)delivery.append(node('p','Creates the request; approval emails follow later.','purchase-review-caption'));
  const receipt=section('Receipt details','purchase-review-receipt'),receiptList=node('dl');fact(receiptList,'File name',p.receiptName);fact(receiptList,'Tax included',d.taxed||'—');fact(receiptList,'Shipping',money(d.shipping));
  if(p.attendeeCount>0)fact(receiptList,'Students fed',String(p.attendeeCount));receipt.append(receiptList);grid.append(delivery,receipt);
  content.replaceChildren(hero,metrics,node('p','District tax formulas determine the final balance.','purchase-review-caption'),grid);
  if(p.linked.length){const linked=node('details',undefined,'purchase-review-linked'),list=node('ul');linked.append(node('summary','Linked requests · '+p.linked.length));p.linked.forEach(title=>list.append(node('li',title)));linked.append(list);content.append(linked);}
  if(p.notice)content.append(node('p',p.notice,'purchase-warning purchase-review-caption'));
 }
 function openReview(d){
  submission=null;$('review-title').textContent='Review before submitting';$('review-cancel').textContent='Back to form';$('status-check').hidden=true;$('commit').hidden=false;
  $('review-note').textContent=d.type==='Practice Purchase — email preview only'?'Confirm to email the practice preview only to mpenalver@bethelsd.org. No purchase will be recorded.':d.type==='ASB Purchase Request'?'Confirm to create the ASB request. Approval emails are sent later through the signature workflow.':'Confirm to record this purchase and send its receipt email to the recipient shown above.';
  submissionFeedback('ready','Ready for your confirmation','Review the details above. Nothing has been sent.');
  reviewOverflow=document.body.style.overflow;document.body.style.overflow='hidden';$('preview').hidden=false;if(!$('preview').open)$('preview').showModal();$('review-title').focus({preventScroll:true});$('preview').scrollTop=0;
 }
 function finishSubmission(pending,result){
  if(submission!==pending)return;
  rememberSubmission(pending,result);
  const saved=result.saved===true;pending.phase=saved?'complete':'review';pending.message=result.message||'Check saved history before attempting another submission.';
  $('commit').hidden=true;$('review-cancel').textContent='Close';$('status-check').hidden=saved;
  if(saved){
   runId=crypto.randomUUID();
   if(!pending.practice){form.reset();links=[];selected.clear();setupAdmin();$('linked-status').textContent='';$('checkout-summary').textContent='';}
   const title=pending.practice?'Practice email sent':pending.type==='ASB Purchase Request'?'ASB request created':'Purchase recorded and receipt email sent';
   const text=pending.practice?'Sent to your district inbox only. No purchase was recorded.':pending.type==='ASB Purchase Request'?'The request is ready for the existing approval workflow. No approval email was sent at this step.':'Submitted to '+pending.recipient+'. Check your sent mail for the receipt email.';
   $('review-title').textContent='Submission complete';$('review-note').textContent=pending.practice?'Practice finished. No purchase was recorded.':'This submission is complete. You can close this window.';submissionFeedback('success',title,text+(pending.message.includes('refresh is pending')?' The budget display is still refreshing.':''));
  }else{
   $('review-title').textContent='Check submission status';$('review-note').textContent='Refreshing status checks the saved record without resending it.';const processing=result.state==='processing'||result.state==='practice-sending';submissionFeedback(processing?'sending':'review',processing?'Still processing…':'Submission needs review',pending.message+' Do not submit it again. Use Refresh submission status to check for an update.');
  }
 }
 async function checkSubmission(pending){
  if(submission!==pending)return;
  submissionFeedback('sending','Checking saved submission status…','This checks the saved record without resending it.');
  try{const data=await api({operation:'view'});if(submission!==pending)return;renderHistory(data.runs||[]);const saved=(data.runs||[]).find(x=>x.id===pending.id);
   if(saved)finishSubmission(pending,{saved:['complete','practice-complete'].includes(saved.state),state:saved.state,message:saved.message,run:saved});
   else finishSubmission(pending,{saved:false,message:'The saved result is not available yet. Refresh submission status or review recent website submissions before trying again.'});
  }catch(error){if(submission===pending)finishSubmission(pending,{saved:false,message:'Delivery could not be confirmed. '+error.message});}
 }
 $('review-cancel').addEventListener('click',()=>{if(submission?.phase==='sending')return;if($('preview').open)$('preview').close();document.body.style.overflow=reviewOverflow;if(!submission)clearPreview();$('preview-button').focus();});
 $('preview').addEventListener('cancel',event=>{if(submission?.phase==='sending'){event.preventDefault();return;}document.body.style.overflow=reviewOverflow;if(!submission)preview=null;});
 $('preview').addEventListener('close',()=>{document.body.style.overflow=reviewOverflow;if(submission&&submission.phase!=='sending')refreshAfterSubmission(submission);});
 $('status-check').addEventListener('click',()=>action(async()=>{if(submission)await checkSubmission(submission);}));
 async function api(body){
  const current=generation,response=await fetch('/api/purchasing',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(current!==generation||!signedIn())throw Error('Your sign-in changed.');if(!response.ok){if([401,403].includes(response.status))clear();throw Error(data.error||'Purchasing is unavailable.');}return data;
 }
 function controls(){document.querySelectorAll('.purchasing-page input,.purchasing-page select,.purchasing-page textarea').forEach(e=>{if(!e.closest('#purchase-equipment,#purchase-budget-reference'))e.disabled=busy||(!options&&!!e.closest('#purchase-admin-form'));});document.querySelectorAll('.purchasing-page button').forEach(b=>{if(b.id!=='purchase-detail-close'&&!b.closest('#purchase-equipment,#purchase-budget-reference'))b.disabled=busy||b.dataset.blocked==='true';});$('preview-button').disabled=busy||!options;$('review-cancel').disabled=submission?.phase==='sending';prepareState();window.NestPurchaseWorkspace?.controls();}
 async function action(work){if(busy)return;busy=true;controls();try{await work();}catch(error){message(error.message);}finally{busy=false;controls();}}
 function clear(){activeWorkspace='purchasing';listView='active';lastPanels={purchasing:'checkout',items:'requested'};navInitialized=false;document.querySelectorAll('[data-workspace]').forEach(e=>{const selected=e.dataset.workspace==='purchasing';e.setAttribute('aria-selected',String(selected));e.tabIndex=selected?0:-1;});document.querySelectorAll('[data-tab-group]').forEach(e=>e.hidden=e.dataset.tabGroup!=='purchasing');window.NestBudgetReference?.clear();window.NestSignatureDemo?.clear();window.NestPurchaseWorkspace?.clear();generation++;attendanceGeneration++;historyRuns=[];submissionUpdates.clear();schoolYear='';access=null;requests=[];discussionTeam=[];budget=null;options=null;optionsApplied=false;links=[];selected.clear();clearPreview();runId=crypto.randomUUID();requestId=crypto.randomUUID();$('workspace').hidden=true;document.querySelectorAll('.purchase-panel').forEach(e=>e.hidden=e.id!=='purchase-requested');document.querySelectorAll('[data-panel]').forEach(e=>{const selected=e.dataset.panel==='requested'||e.dataset.listView==='active';e.setAttribute('aria-pressed',String(selected));e.setAttribute('aria-selected',String(selected));e.tabIndex=selected?0:-1;});window.NestEquipment?.clear();window.NestPurchasingService?.clear();['board','requisition-list','balances','detail-body','submission-history','practice-submissions','vendors','original','division','asb-requests','asb-action-history','asb-preview-content'].forEach(id=>$(id).replaceChildren());asbPreview=null;$('asb-preview').hidden=true;form.reset();requestForm.reset();$('asb-items').replaceChildren();$('attendance-status').textContent='';$('receipt-amount-status').textContent='';$('form-options-status').textContent='';$('linked-status').textContent='';$('checkout-summary').textContent='';$('practice-history').open=false;$('practice-summary').textContent='Practice test emails';updateRequestEstimate();if($('detail').open)$('detail').close();document.querySelectorAll('[data-manager],[data-admin]').forEach(e=>e.hidden=true);message('Sign in with your NEST profile to open inventory and purchasing.');}
 function applyPurchaseChoices(){
  if(!access?.admin||!options||optionsApplied)return;
  setupAdmin();optionsApplied=true;$('form-options-status').hidden=true;$('form-options-status').textContent='';controls();
 }
 async function loadPurchaseChoices(current){
  if(options){applyPurchaseChoices();return;}
  if(choicesFlight?.generation===current)return choicesFlight.promise;
  const promise=(async()=>{
   $('form-options-status').hidden=false;$('form-options-status').textContent='Loading purchase choices…';controls();
   const result=await api({operation:'admin'});if(current!==generation)return;
   if(!Array.isArray(result.options?.foodTypes)||!result.options.foodTypes.length||!Array.isArray(result.options.vendors))throw Error('Purchase choices could not load. Use Refresh saved status to try again.');
   // The server authenticates this administrator response before the private form is shown.
   if(!access&&result.access?.admin===true){
    access=result.access;document.querySelectorAll('[data-manager]').forEach(e=>e.hidden=!access.manager);document.querySelectorAll('[data-admin]').forEach(e=>e.hidden=!access.admin);$('workspace').hidden=false;
    const route=location.hash.slice(1);showPanel(route==='equipment'?'equipment':route==='service'?'service':route==='items'?'requested':route==='history'?'history':'checkout');navInitialized=true;
    $('submission-history').textContent='Loading recent submissions…';
   }
   options=result.options;applyPurchaseChoices();message('Purchase form ready. Refreshing workspace details…');
  })();
  choicesFlight={generation:current,promise};try{return await promise;}finally{if(choicesFlight?.promise===promise)choicesFlight=null;}
 }
 function load(){
  if(activeLoad?.generation===generation)return activeLoad.promise;
  const current=generation,promise=loadWorkspace();activeLoad={generation:current,promise};
  promise.finally(()=>{if(activeLoad?.promise===promise)activeLoad=null;}).catch(()=>{});return promise;
 }
 async function loadWorkspace(){
  if(!signedIn()){clear();return;}
  const current=generation;message('Loading inventory and purchasing…');
  // Start the owner-only form read independently of roster, history, and budget reads.
  const earlyChoices=String(window.NestAuth?.identity?.email||'').toLowerCase()==='mpenalver@bethelsd.org'?loadPurchaseChoices(current).then(()=>({ok:true}),error=>({ok:false,error})):null;
  try{const data=await api();if(current!==generation)return;access=data.access;requests=data.requests;discussionTeam=data.discussionTeam||[];budget=data.budget;schoolYear=data.schoolYear||budget?.year||'';document.querySelectorAll('[data-manager]').forEach(e=>e.hidden=!access.manager);document.querySelectorAll('[data-admin]').forEach(e=>e.hidden=!access.admin);$('workspace').hidden=false;
   const previous=$('division').value;$('division').replaceChildren(...access.periods.map(p=>new Option(division(p),p)),new Option('All divisions','ALL'));if(previous==='ALL'||access.periods.includes(previous))$('division').value=previous;
   render();window.NestBudgetReference?.render(data);window.NestPurchaseWorkspace?.render(data);if(!navInitialized){navInitialized=true;const route=location.hash.slice(1);showPanel(route==='equipment'?'equipment':route==='service'?'service':route==='items'?'requested':route==='history'?'history':access.admin?'checkout':'requested');}window.NestPurchasingService?.refresh();renderHistory(data.runs||[]);renderAsb(data.asbRequests||[],data.asbActions||[]);message(data.budgetError||'Your workspace is up to date.');
   if(access.admin){if(earlyChoices){const outcome=await earlyChoices;if(current!==generation)return;if(!outcome.ok&&!options)throw outcome.error;}if(!options)await loadPurchaseChoices(current);applyPurchaseChoices();message(data.budgetError||'Your workspace is up to date.');}

  }catch(error){if(current===generation){if(earlyChoices)await earlyChoices;if(current!==generation)return;message(options&&access?.admin?'Purchase form is ready. Workspace details could not refresh; use Refresh saved status to try again.':error.message);}}finally{controls();}
 }
 function showPanel(name){
  if(!access||(name==='equipment'&&!access.manager)||(name==='requisitions'&&!access.canTriage&&!access.manager)||(name==='checkout'&&!access.admin))return;
  if(name==='purchase-archive')name='records';
  if(name==='discussion')name='requested';
  activeWorkspace=['lists','requested','stock','archive'].includes(name)?'items':['equipment','history','service'].includes(name)?name:'purchasing';
  if(['purchasing','items'].includes(activeWorkspace))lastPanels[activeWorkspace]=name;
  document.querySelectorAll('.purchase-panel').forEach(e=>e.hidden=e.id!=='purchase-'+name);
  document.querySelectorAll('[data-workspace]').forEach(e=>{const selected=e.dataset.workspace===activeWorkspace;e.setAttribute('aria-selected',String(selected));e.tabIndex=selected?0:-1;});
  document.querySelectorAll('[data-tab-group]').forEach(e=>e.hidden=e.dataset.tabGroup!==activeWorkspace);
  document.querySelectorAll('[data-panel]').forEach(e=>{const selected=e.dataset.panel===name&&(!e.dataset.listView||e.dataset.listView===listView);e.setAttribute('aria-pressed',String(selected));e.setAttribute('aria-selected',String(selected));e.tabIndex=selected?0:-1;});
  if(name==='lists'){$('lists').setAttribute('aria-labelledby',listView==='removed'?'purchase-tab-lists-closed':'purchase-tab-lists-active');window.NestPurchaseWorkspace?.setListFilter(listView);}
  if(name==='records')window.NestPurchaseWorkspace?.openArchive('purchases');
  if(name==='equipment')window.NestEquipment?.open();if(name==='service')window.NestPurchasingService?.open();
  const route=activeWorkspace==='items'?'items':activeWorkspace;if(location.hash!=='#'+route)history.replaceState(null,'','#'+route);
 }
 document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.listView)listView=b.dataset.listView;showPanel(b.dataset.panel);}));
 document.querySelectorAll('[data-workspace]').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.workspace==='items'?lastPanels.items:b.dataset.workspace==='purchasing'?(access?.admin?lastPanels.purchasing:'requisitions'):b.dataset.workspace)));
 document.querySelectorAll('[role="tablist"]').forEach(nav=>nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=[...nav.querySelectorAll('[role="tab"]')].filter(e=>!e.hidden&&!e.disabled),current=tabs.indexOf(document.activeElement);if(current<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();}));
 window.addEventListener('hashchange',()=>{const route=location.hash.slice(1);if(['equipment','service','history','items','purchasing'].includes(route))showPanel(route==='items'?lastPanels.items:route==='purchasing'?(access?.admin?lastPanels.purchasing:'requisitions'):route);});
 function requestCard(x,choose=false){
  const card=node('article',undefined,'purchase-card');card.append(node('span',x.stage,'purchase-stage'),node('h3',x.title),node('p',(x.allDivisions?'All divisions':x.divisions.map(division).join(' · '))+' · '+x.fund,'purchase-meta'),node('p',x.reason),node('p',x.quantity+' requested · '+(estimate(x)===null?'Price not yet estimated':money(x.unitCost)+' each · '+money(estimate(x))+' estimated before tax'),'purchase-meta'));
  if(x.purchaseState)card.append(node('p','Purchase processing: '+x.purchaseState,'purchase-meta'));
  const actions=node('div',undefined,'purchase-request-actions'),open=node('button','Open discussion');open.type='button';open.addEventListener('click',()=>detail(x));actions.append(open);
  if(choose&&access.admin&&['requisition','approved'].includes(x.stage)&&!['processing','review-required'].includes(x.purchaseState)){const label=node('label',undefined,'purchase-check'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=selected.has(x.id);checkbox.setAttribute('aria-label','Include '+x.title+' in purchase');checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(x.id):selected.delete(x.id);clearPreview();prepareState();});label.append(checkbox,document.createTextNode('Include in purchase'));actions.append(label);}
  card.append(actions);return card;
 }
 function render(){
  const query=$('search').value.toLowerCase().trim(),filtered=requests.filter(x=>x.stage!=='archived').filter(x=>[x.title,x.reason,x.stage,x.allDivisions?'All divisions':'',...x.divisions.map(division)].join(' ').toLowerCase().includes(query));
  $('board').replaceChildren(...filtered.map(x=>requestCard(x)));if(!filtered.length)$('board').append(node('p','No requests yet. Start a discussion for your division.','purchase-empty'));
  const reqs=requests.filter(x=>['requisition','approved','ordered','received'].includes(x.stage));$('requisition-list').replaceChildren(...reqs.map(x=>requestCard(x,true)));if(!reqs.length)$('requisition-list').append(node('p','Move requested items to the purchase list, then review their estimated prices.','purchase-empty'));
  const pending=reqs.filter(x=>['requisition','approved'].includes(x.stage)&&x.fund==='CTE'),known=pending.filter(x=>estimate(x)!==null).reduce((s,x)=>s+estimate(x),0),unknown=pending.filter(x=>estimate(x)===null).length;
  prepareState();
  $('balances').replaceChildren(...[['District CTE balance',budget?money(budget.balance):'Unavailable'],['Open CTE estimates · before tax',money(known)+(unknown?' + '+unknown+' unpriced':'')],['After estimated commitments',budget?money(budget.balance-known):'Unavailable']].map(([label,value])=>{const e=node('div',label,'purchase-metric');e.append(node('strong',value));return e;}));
  window.NestPurchaseWorkspace?.refreshRequests();
 }
 window.NestPurchasing={api,action,itemLink,reload:load,showPanel,detail:x=>detail(x),state:()=>({access,requests,busy,budget,schoolYear}),selected:id=>selected.has(id),toggleSelected:(id,value)=>{value?selected.add(id):selected.delete(id);clearPreview();prepareState();}};
 function detail(x){
  const body=$('detail-body');body.replaceChildren();const title=node('h2',x.title);title.id='purchase-detail-title';body.append(title,node('p',x.reason),node('p',x.author+' · '+(x.allDivisions?'All divisions':x.divisions.map(division).join(' · '))+' · '+x.stage,'purchase-meta'));
  if(x.allDivisions){const team=node('section');team.append(node('h3','All-divisions discussion team'),node('p','Current division managers, assistant managers, Robotics executives, and inventory directors participate here, along with the requester and administrator.'));const list=node('ul');discussionTeam.forEach(person=>list.append(node('li',person.name+' · '+person.roles.map(role=>division(role.period)+': '+role.position).join(' · '))));team.append(list);body.append(team);}
  itemLink(body,x.url);
  if(access.manager||access.admin||x.canEditItem){const linkForm=node('form',undefined,'purchase-form'),label=node('label','Item link (full https URL)'),input=node('input'),save=node('button','Save item link');input.type='url';input.pattern='https://.*';input.maxLength=500;input.value=x.url||'';input.name='itemUrl';label.append(input);save.type='submit';linkForm.append(label,save);linkForm.addEventListener('submit',event=>{event.preventDefault();action(async()=>{await api({operation:'item-link',id:x.id,revision:x.revision,url:input.value.trim()});$('detail').close();await load();const saved=requests.find(row=>row.id===x.id);if(saved)detail(saved);message('Item link updated.');});});body.append(linkForm);}

  if(access.manager&&x.stage!=='archived'){const edit=node('form',undefined,'purchase-form');edit.append(node('h3','Requisition planning'));
   const scopeLabel=node('label','Requesting divisions'),scope=node('select');scope.name='scope';scope.append(new Option(x.allDivisions?'All divisions':x.divisions.map(division).join(' · '),'CURRENT'));access.periods.forEach(p=>scope.append(new Option(division(p),p)));scope.append(new Option('All divisions','ALL'));scopeLabel.append(scope);edit.append(scopeLabel);
   for(const [name,label,value,type] of [['quantity','Quantity',x.quantity,'number'],['unitCost','Estimated unit cost ($)',x.unitCost??'','number'],['shipping','Estimated shipping ($)',x.shipping,'number']]){const l=node('label',label),input=node('input');input.name=name;input.type=type;input.value=value;input.required=name!=='unitCost';input.min=name==='quantity'?'1':'0';input.max=name==='quantity'?'10000':'1000000';input.step=name==='quantity'?'1':'.01';l.append(input);edit.append(l);}
   for(const [name,label,values,value] of [['fund','Funding source',['CTE','ASB'],x.fund],['stage','Status',['discussion','requisition',...(access.admin?['approved']:[]),...(x.stage==='ordered'?['ordered']:[]),'received',...(access.admin?['declined']:[])],x.stage]]){const l=node('label',label),select=node('select');select.name=name;values.forEach(v=>select.append(new Option(v,v)));if(!values.includes(value)){const opt=new Option(value,value);opt.disabled=true;select.append(opt);}select.value=value;l.append(select);edit.append(l);}
   const save=node('button','Save requisition');save.type='submit';edit.append(save);edit.addEventListener('submit',e=>{e.preventDefault();action(async()=>{await api({operation:'update',id:x.id,revision:x.revision,divisions:field(edit,'scope').value==='ALL'?['ALL']:field(edit,'scope').value==='CURRENT'?x.divisions:[field(edit,'scope').value],quantity:Number(field(edit,'quantity').value),unitCost:field(edit,'unitCost').value.trim()===''?null:Number(field(edit,'unitCost').value),shipping:Number(field(edit,'shipping').value),fund:field(edit,'fund').value,stage:field(edit,'stage').value});$('detail').close();await load();});});body.append(edit);
  }
  body.append(node('h3','Discussion'));x.comments.forEach(c=>{const e=node('div',undefined,'purchase-comment');e.append(node('strong',c.author),node('p',c.text),node('small',new Date(c.at).toLocaleString()));body.append(e);});
  const comment=node('form',undefined,'purchase-form'),label=node('label','Add to the discussion'),input=node('textarea');input.rows=3;input.required=true;input.maxLength=2000;label.append(input);const send=node('button','Post comment');send.type='submit';comment.append(label,send);let commentId=crypto.randomUUID();comment.addEventListener('submit',e=>{e.preventDefault();action(async()=>{await api({operation:'comment',id:x.id,revision:x.revision,commentId,text:input.value});$('detail').close();await load();});});if(x.stage!=='archived')body.append(comment);
  if(x.history.length){body.append(node('h3','Status history'));x.history.forEach(h=>body.append(node('p',h.stage+' · '+h.author+' · '+new Date(h.at).toLocaleString(),'purchase-meta')));}
  if(!$('detail').open)$('detail').showModal();
 }
 $('detail-close').addEventListener('click',()=>$('detail').close());$('search').addEventListener('input',render);
 function updateRequestEstimate(){const value=field(requestForm,'unitCost').value,quantity=Number(field(requestForm,'quantity').value),price=Number(value);$('request-estimate').textContent=value.trim()===''?'Enter a unit price to estimate the item total.':Number.isFinite(price)&&quantity>0?'Estimated item total: '+money(Math.round(quantity*price*100)/100)+' before tax and shipping.':'Enter a valid quantity and unit price.';}
 requestForm.addEventListener('input',updateRequestEstimate);
 function eligibleSelections(){return requests.filter(x=>selected.has(x.id)&&['requisition','approved'].includes(x.stage)&&!['processing','review-required'].includes(x.purchaseState)&&Number.isFinite(x.unitCost));}
 function prepareState(){const chosen=eligibleSelections(),mixed=chosen.some(x=>x.fund!==chosen[0]?.fund),button=$('prepare');button.textContent='Prepare selected requests ('+chosen.length+')';button.disabled=busy||!access?.admin||!options||!chosen.length||mixed;$('prepare-message').textContent=!chosen.length?(requests.some(x=>['requisition','approved'].includes(x.stage))?'Select one or more requisitions to prepare a purchase.':'No items are on the purchase list yet. Use Move to purchase list in Requested items.'):mixed?'Select requests from one funding source at a time.':!options?'Loading the administrator purchase form…':chosen.length+' selected · '+chosen[0].fund+' · '+money(chosen.reduce((sum,x)=>sum+(estimate(x)||0),0))+' estimated before tax.';}
 requestForm.addEventListener('submit',e=>{e.preventDefault();action(async()=>{await api({operation:'create',id:requestId,title:field(requestForm,'title').value,reason:field(requestForm,'reason').value,quantity:Number(field(requestForm,'quantity').value),fund:field(requestForm,'fund').value,divisions:[field(requestForm,'division').value],url:field(requestForm,'url').value.trim(),unitCost:field(requestForm,'unitCost').value.trim()===''?null:Number(field(requestForm,'unitCost').value)});requestId=crypto.randomUUID();requestForm.reset();updateRequestEstimate();await load();message('Your requested item has been added.');});});
 function updateVendorChoices(reset=false){
  if(!options)return;
  const menu=field(form,'vendor'),food=field(form,'foodType').value.startsWith('Yes'),prior=reset?'':menu.value;
  const vendors=options.vendors.filter(v=>/^🍕\s*/u.test(v)===food);
  menu.replaceChildren(new Option(food?'Choose a food vendor':'Choose a vendor',''),...vendors.map(v=>new Option(v.replace(/^🍕\s*/u,''),v)),new Option('Other vendor…','__OTHER_VENDOR__'));
  if([...menu.options].some(x=>x.value===prior))menu.value=prior;
  if(reset)field(form,'vendorOther').value='';
  const other=menu.value==='__OTHER_VENDOR__';$('other-vendor-field').hidden=!other;field(form,'vendorOther').required=other;
  $('vendor-label').textContent=food?'Food vendor':'Vendor';
 }
 function selectSavedVendor(value){
  const menu=field(form,'vendor'),normalize=v=>String(v||'').replace(/^🍕\s*/u,'').trim().toLowerCase(),match=[...menu.options].find(x=>x.value&&x.value!=='__OTHER_VENDOR__'&&normalize(x.value)===normalize(value));
  if(match)menu.value=match.value;else{menu.value='__OTHER_VENDOR__';field(form,'vendorOther').value=value;}
  updateVendorChoices();
 }
 function setupAdmin(){
  const selectedFood=field(form,'foodType').value;$('food-type').replaceChildren(...options.foodTypes.map(v=>new Option(v.startsWith('Yes')?v.replace('Yes:','Yes —'): 'No',v)));if(options.foodTypes.includes(selectedFood))field(form,'foodType').value=selectedFood;$('original').replaceChildren(new Option('Choose original purchase',''),...options.previous.map(v=>new Option(v,v)));
  if(!field(form,'day').value)field(form,'day').value=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(!$('receipt').files.length)$('receipt-amount-status').textContent='';if(!$('asb-items').children.length)addItem();mode();controls();
 }
 function addItem(value={description:'',price:''}){if($('asb-items').children.length>=10)return;const row=node('div',undefined,'purchase-asb-line'),label=node('label','Item description'),desc=node('input'),costLabel=node('label','Extended price ($)'),cost=node('input'),remove=node('button','Remove');desc.dataset.item='description';desc.value=value.description;desc.maxLength=300;cost.dataset.item='price';cost.type='number';cost.min='0';cost.step='.01';cost.max='1000000';cost.value=value.price;remove.type='button';remove.addEventListener('click',()=>{row.remove();clearPreview();});label.append(desc);costLabel.append(cost);row.append(label,costLabel,remove);$('asb-items').append(row);}
 $('add-item').addEventListener('click',()=>{addItem();clearPreview();});
 function mode(){updateVendorChoices();const type=field(form,'type').value,asb=type==='ASB Purchase Request',food=field(form,'foodType').value.startsWith('Yes');$('original-field').hidden=!['Updated Purchase','Return'].includes(type);field(form,'original').required=!$('original-field').hidden;$('asb').hidden=!asb;$('asb-approvals').hidden=!asb;$('receipt-field').hidden=asb;$('receipt').required=!asb;$('food').hidden=asb||!food;field(form,'attendees').required=!$('food').hidden;}
 async function attendance(){
  if(!access?.admin||$('food').hidden||!field(form,'day').value)return;const current=++attendanceGeneration,day=field(form,'day').value;
  $('attendance-status').textContent='Loading attendance for '+day+'…';field(form,'attendees').value='';
  try{const result=await api({operation:'attendance',day,group:field(form,'attendanceGroup').value});if(current!==attendanceGeneration)return;field(form,'attendees').value=result.names.join('\n');$('attendance-status').textContent=result.names.length?result.names.length+' students from '+result.source+' on '+day+'. Review the list before submitting.':result.needsReview?'The sign-in fields need review. Enter the verified list of students fed.':'No attendance entries were found for this date. Enter the verified students fed.';clearPreview();}catch(e){if(current===attendanceGeneration)$('attendance-status').textContent=e.message;}
 }
 $('original').addEventListener('change',()=>{const value=field(form,'original').value,parts=value.split('_'),date=parts[0]?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(date){field(form,'day').value=date[3]+'-'+date[1]+'-'+date[2];selectSavedVendor(parts.slice(1,-1).join('_'));const amount=parseFloat(parts.at(-1).replace('$',''));if(Number.isFinite(amount))field(form,'amount').value=amount.toFixed(2);}if(/\(FOOD\)\s*$/i.test(value)&&!field(form,'foodType').value.startsWith('Yes'))message('The original purchase was food. Choose its CTE or ASB food route to load the dated attendee list.');});
 $('attendance-load').addEventListener('click',attendance);
 form.addEventListener('input',clearPreview);form.addEventListener('change',e=>{clearPreview();if(e.target.name==='foodType'){attendanceGeneration++;updateVendorChoices(true);}mode();if(['foodType','day','type','attendanceGroup','original'].includes(e.target.name))attendance();});
 $('prepare').addEventListener('click',()=>{
  if(!access?.admin)return;const chosen=eligibleSelections();if(!chosen.length){prepareState();return;}if(chosen.some(x=>x.fund!==chosen[0].fund)){prepareState();return;}
  links=chosen.map(x=>({id:x.id,revision:x.revision}));clearPreview();runId=crypto.randomUUID();field(form,'description').value=chosen.map(x=>x.quantity+' × '+x.title+' ('+x.divisions.map(division).join(', ')+')').join('\n');field(form,'amount').value=chosen.reduce((s,x)=>s+(estimate(x)||0),0).toFixed(2);
  if(chosen[0].fund==='ASB'){field(form,'type').value='ASB Purchase Request';$('asb-items').replaceChildren();chosen.forEach(x=>addItem({description:x.quantity+' × '+x.title,price:estimate(x)??''}));}
  else{field(form,'type').value='New Purchase';const noFood=options?.foodTypes.find(v=>!v.startsWith('Yes'));if(noFood)field(form,'foodType').value=noFood;}
  $('linked-status').textContent=chosen.length+' requisition(s) selected. Check the vendor and replace estimates with the actual receipt amount.';$('checkout-summary').textContent='Preparing '+chosen.length+' selected '+chosen[0].fund+' request(s): '+chosen.map(x=>x.title).join('; ');mode();showPanel('checkout');$('checkout').scrollIntoView?.({behavior:'smooth',block:'start'});field(form,'vendor').focus({preventScroll:true});
 });
 function draft(){return {type:field(form,'type').value,day:field(form,'day').value,vendor:field(form,'vendor').value==='__OTHER_VENDOR__'?field(form,'vendorOther').value.trim():field(form,'vendor').value,description:field(form,'description').value,original:field(form,'original').value,amount:Number(field(form,'amount').value),shipping:Number(field(form,'shipping').value),taxed:field(form,'taxed').value,foodType:field(form,'foodType').value,attendees:field(form,'attendees').value.split('\n').map(v=>v.trim()).filter(Boolean),attendanceGroup:field(form,'attendanceGroup').value,links,items:[...$('asb-items').children].map(row=>({description:row.querySelector('[data-item="description"]').value,price:Number(row.querySelector('[data-item="price"]').value)})),vendorDetails:field(form,'vendorDetails').value};}
 function receiptFilenameAmount(name){
  const base=String(name||'').replace(/\.(pdf|png|jpe?g)$/i,'');
  const unique=values=>{const valid=[...new Set(values.map(v=>Number(v.replace(/,/g,''))).filter(v=>Number.isFinite(v)&&v>=0&&v<=1000000))];return valid.length===1?valid[0]:null;};
  const labelled=[...base.matchAll(/(?:^|[\s_-])(?:total|amount)\s*[:=_-]?\s*\$?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)(?![\d.,])/gi)].map(m=>m[1]);if(labelled.length)return unique(labelled);
  const dollars=[...base.matchAll(/\$\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)(?![\d.,])/g)].map(m=>m[1]);if(dollars.length)return unique(dollars);
  const canonical=base.match(/_\d{4}[.-](?:0[1-9]|1[0-2])_((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?:\s*\(\d+\))?$/);if(canonical)return unique([canonical[1]]);
  // Remove date-shaped portions before looking for a lone cents amount.
  const noDates=base.replace(/(?:^|[^\d])20\d{2}[._-](?:0?[1-9]|1[0-2])(?:[._-](?:0?[1-9]|[12]\d|3[01]))?(?!\d)/g,' ').replace(/(?:^|[^\d])\d{1,2}[._-]\d{1,2}[._-]20\d{2}(?!\d)/g,' ');
  return unique([...noDates.matchAll(/(?:^|[^\d.,])((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?![\d.,])/g)].map(m=>m[1]));
 }
 field(form,'description').addEventListener('input',()=>{descriptionEdits++;});
 form.addEventListener('reset',()=>{receiptRead++;descriptionEdits++;lastReceiptDescription='';$('receipt-description-status').textContent='';});
 async function fillReceiptDescription(file){
  const ticket=++receiptRead,current=generation,edits=descriptionEdits,description=field(form,'description'),before=description.value,status=$('receipt-description-status');
  clearPreview();status.textContent='';if(!file||!access?.admin)return;
  if(before.trim()&&before!==lastReceiptDescription){status.textContent='Your description was kept. Clear it and choose the receipt again to fill it from the invoice.';return;}
  if(before===lastReceiptDescription){description.value='';lastReceiptDescription='';}
  status.textContent='Reading receipt items…';
  try{
   const result=await window.NestPurchaseReceipt.describe(file);
   if(ticket!==receiptRead||current!==generation||!signedIn()||$('receipt').files[0]!==file)return;
   if(descriptionEdits!==edits||description.value.trim()||busy||preview){status.textContent='Your description was kept.';return;}
   if(result.description){description.value=result.description;lastReceiptDescription=result.description;clearPreview();}
   status.textContent=result.message;
  }catch{
   if(ticket===receiptRead&&current===generation)status.textContent='The receipt could not be read automatically. Enter the description manually.';
  }
 }
 $('receipt').addEventListener('change',()=>{
  void fillReceiptDescription($('receipt').files[0]);
  const file=$('receipt').files[0];if(!file){$('receipt-amount-status').textContent='';return;}
  const amount=receiptFilenameAmount(file.name);
  if(amount===null){$('receipt-amount-status').textContent='No single purchase total was found in the filename. Enter or confirm the Actual amount manually.';return;}
  field(form,'amount').value=amount.toFixed(2);clearPreview();$('receipt-amount-status').textContent='Actual amount filled from the filename: '+money(amount)+'. You can edit it before confirming.';
 });
 async function receipt(file){if(!file)return undefined;if(!['application/pdf','image/jpeg','image/png'].includes(file.type)||file.size>2*1024*1024)throw Error('Choose a PDF, JPEG, or PNG receipt under 2 MB.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({type:file.type,data:String(reader.result).split(',')[1]});reader.onerror=()=>reject(Error('The receipt could not be read.'));reader.readAsDataURL(file);});}
 form.addEventListener('submit',e=>{e.preventDefault();action(async()=>{const current=generation,d=draft(),file=$('receipt').files[0],upload=d.type==='ASB Purchase Request'?undefined:await receipt(file);if(current!==generation)return;message('Preparing the purchase preview…');const result=await api({operation:'preview',id:runId,draft:d,...(upload?{receipt:upload}:{})});preview=result.preview;
  $('commit').textContent=preview.type==='Practice Purchase — email preview only'?'Email practice preview to me':preview.type==='ASB Purchase Request'?'Confirm & create ASB request':'Confirm & send receipt email';renderPurchaseReview(preview,d);const content=$('preview-content');if(preview.foodDocument){const button=node('button','Preview receipt image & student names');button.type='button';button.addEventListener('click',()=>action(async()=>{if(!preview)return;const result=await api({operation:'food-document',id:preview.id});const link=node('a','Open generated food receipt document ↗');link.href=result.document;link.target='_blank';link.rel='noopener noreferrer';button.replaceWith(link);message('The food document preview uses the existing receipt renderer. No purchase or email was submitted.');}));content.append(button);}openReview(d);});});
 $('commit').addEventListener('click',()=>action(async()=>{
  if(!preview)return;
  const pending={id:preview.id,type:preview.type,vendor:preview.vendor,amount:preview.amount,receipt:preview.receipt,at:new Date().toISOString(),recipient:preview.recipient,practice:preview.type==='Practice Purchase — email preview only',phase:'sending'};
  submission=pending;preview=null;$('commit').hidden=true;$('status-check').hidden=true;$('review-cancel').disabled=true;$('review-title').textContent=pending.practice?'Sending your practice email':'Submitting your purchase';$('review-note').textContent='Confirmation received. Processing this submission once.';
  submissionFeedback('sending',pending.practice?'Sending practice email…':pending.type==='ASB Purchase Request'?'Creating ASB request…':'Recording purchase and sending receipt email…','Keep this window open. Please do not submit again.');
  const timer=setTimeout(()=>{if(submission===pending&&pending.phase==='sending')submissionFeedback('sending','Still processing…','The purchase workflow can take a minute. Waiting for confirmation; no second submission is needed.');},20000);
  try{const result=await api({operation:'commit',id:pending.id});if(submission!==pending)return;finishSubmission(pending,result);refreshAfterSubmission(pending);if(submission===pending)message($('submit-title').textContent+' — '+$('submit-status').textContent);}
  catch(error){if(submission===pending){pending.phase='review';await checkSubmission(pending);}}
  finally{clearTimeout(timer);}
 }));

 function refreshAfterSubmission(pending){void load().then(()=>{if(submission===pending&&pending.phase!=='sending')message($('submit-title').textContent+' — '+$('submit-status').textContent);},()=>{});}
 function rememberSubmission(pending,result){
  const state=result.saved===true?(pending.practice?'practice-complete':'complete'):result.state;
  if(!['complete','practice-complete','processing','practice-sending','review-required','practice-review-required'].includes(state))return;
  const entry={id:pending.id,type:pending.type,vendor:pending.vendor,amount:pending.amount,at:pending.at,state,message:result.message||'',...(pending.receipt?{receipt:pending.receipt}:{}),...(result.run||{})};
  submissionUpdates.set(pending.id,entry);
  // Bound session-only confirmations; the server remains the saved history source.
  if(submissionUpdates.size>60)submissionUpdates.delete(submissionUpdates.keys().next().value);
  renderHistory(historyRuns);
 }
 function renderHistory(runs){
  historyRuns=Array.isArray(runs)?runs:[];
  const combined=new Map(historyRuns.map(x=>[x.id,x]));
  for(const [id,confirmed] of submissionUpdates){const saved=combined.get(id);combined.set(id,saved&&['complete','practice-complete'].includes(saved.state)?{...confirmed,...saved}:{...saved,...confirmed});}
  runs=[...combined.values()].sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0));
  const isPractice=x=>/^Practice Purchase\b/i.test(x.type||'')||/^practice-/.test(x.state||'');
  const card=x=>{const e=node('article',undefined,'purchase-history-item');e.append(node('strong',x.vendor+' · '+x.type+' · '+money(x.amount)),node('p',x.state+' · '+new Date(x.at).toLocaleString()),node('p',x.message));if(x.receipt){const a=node('a','Open receipt ↗');a.href=x.receipt;a.target='_blank';a.rel='noopener noreferrer';e.append(a);}return e;};
  const purchases=runs.filter(x=>!isPractice(x)).slice(0,30),practice=runs.filter(isPractice).slice(0,30);
  $('submission-history').replaceChildren(...purchases.map(card));if(!purchases.length)$('submission-history').append(node('p','No purchase submissions this school year.','purchase-meta'));
  $('practice-submissions').replaceChildren(...practice.map(card));$('practice-summary').textContent='Practice test emails ('+practice.length+')';
  if(!practice.length)$('practice-submissions').append(node('p','No practice test emails this school year.','purchase-meta'));
 }

 function renderAsb(items,actions){
  $('asb-requests').replaceChildren(...items.map(x=>{const card=node('article',undefined,'purchase-card');card.append(node('h3',x.vendor+' · $'+x.total),node('p',x.action+' · '+x.status),node('p',x.day,'purchase-meta'));
   if(x.pdf){const link=node('a','Open current request PDF ↗');link.href=x.pdf;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}
   const f=node('form',undefined,'purchase-form'),label=node('label','Next action'),select=node('select');select.append(new Option('Choose action',''));x.choices.forEach(v=>select.append(new Option(v==='Approved'?'Approve & email existing PDF signature chain':v==='Send to ASB Director'?'Send signed request to ASB clerk':v,v)));select.required=true;label.append(select);
   const button=node('button','Preview ASB action');button.type='submit';f.append(label,button);f.addEventListener('submit',e=>{e.preventDefault();action(async()=>{const result=await api({operation:'asb-preview',id:x.id,revision:x.revision,change:select.value,ticket:crypto.randomUUID()});asbPreview=result.preview;$('asb-preview-content').replaceChildren(node('p',asbPreview.vendor+' · $'+asbPreview.total),node('p',asbPreview.change),node('p','Recipients: '+(asbPreview.recipients.join(', ')||'No email for this status change')));$('asb-preview').hidden=false;message('Review the ASB action and recipients before confirming.');});});card.append(f);return card;}));
  $('asb-action-history').replaceChildren(...actions.filter(x=>x.state!=='complete').map(x=>node('p',x.change+' · '+x.state+' · '+new Date(x.at).toLocaleString(),'purchase-warning')));
 }
 $('asb-commit').addEventListener('click',()=>action(async()=>{if(!asbPreview)return;const ticket=asbPreview.id;asbPreview=null;$('asb-preview').hidden=true;const result=await api({operation:'asb-commit',ticket});await load();message(result.message||'Refresh ASB status before retrying.');}));
 $('retry').addEventListener('click',()=>action(load));document.addEventListener('nest-auth-change',()=>{clear();if(signedIn())load();});
 if(window.NestAuth?.ready)window.NestAuth.ready.then(load);else clear();
})();
