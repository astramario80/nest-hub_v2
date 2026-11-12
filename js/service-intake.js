(()=>{'use strict';
 const $=id=>document.getElementById(id),request=$('service-code-request'),verify=$('service-code-verify'),form=$('service-intake-form');if(!request||!verify||!form)return;
 let signedIn=false,email='',lastEmail='',codeBusy=false,saveBusy=false,submission=null,saved=false,draftId=null,files=[],identityEpoch=0,staffLoaded=false,staffLoading=false;
 const ids={name:'intake-name',phone:'intake-phone',room:'intake-room',category:'intake-category',urgency:'intake-urgency',description:'intake-description',attachment:'intake-attachment'};
 async function api(operation,data){
  const response=await fetch('/api/service-requests',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,...data}),signal:AbortSignal.timeout(58000)});
  let result;try{result=await response.json();}catch{throw new Error('The response could not be confirmed. Try again using this same request.');}
  if(!response.ok){const error=new Error(result.error||'The service is temporarily unavailable.');error.status=response.status;throw error;}return result;
 }
 function render(){
  $('service-client-auth').hidden=signedIn;$('service-client-session').hidden=!signedIn;$('service-client-session-email').textContent=email?'Verified as '+email+'.':'';form.hidden=!signedIn||saved;
  $('service-intake-intro').textContent=signedIn?'Tell us where to find the issue and who the client is. The client email will receive updates; your verified identity stays recorded as the submitter.':'Verify your email above to load the service request form.';
  $('service-intake-email').textContent=email?'Submitting as '+email:'';
  $('service-intake-fields').disabled=saveBusy||Boolean(submission);$('service-intake-submit').disabled=saveBusy||!signedIn;
  const behalf=$('intake-on-behalf').value==='yes';$('intake-client-fields').hidden=!behalf;['intake-client-name','intake-client-email'].forEach(id=>$(id).required=behalf);
  $('service-intake-another').hidden=!saved;$('service-code-signout').disabled=saveBusy||codeBusy;
  $('service-code-send').disabled=codeBusy;$('service-code-confirm').disabled=codeBusy;$('service-code-change').disabled=codeBusy;
 }
 document.addEventListener('nest-service-client-state',event=>{
  const state=event.detail||{};signedIn=state.signedIn===true;email=signedIn?state.email:'';
  if(state.signedOut||signedIn&&lastEmail&&lastEmail!==email){identityEpoch++;staffLoaded=false;delete $('intake-client-staff').dataset.contacts;$('intake-client-staff').replaceChildren(new Option('Enter client details manually',''));submission=null;saved=false;draftId=null;files=[];$('service-selected-files').replaceChildren();form.reset();$('service-intake-status').textContent='';}
  if(signedIn){lastEmail=email;verify.reset();verify.hidden=true;request.hidden=false;$('service-code-status').textContent='';}
  render();
 });
 $('service-code-signout').addEventListener('click',()=>$('client-logout').click());
 request.addEventListener('submit',async event=>{
  event.preventDefault();if(codeBusy)return;codeBusy=true;render();$('service-code-status').textContent='Sending your verification code…';
  try{const result=await api('code-request',{email:$('service-code-email').value.trim()});request.hidden=true;verify.hidden=false;$('service-code-status').textContent=result.message;$('service-code').focus();}
  catch(error){$('service-code-status').textContent=error.message;}finally{codeBusy=false;render();}
 });
 verify.addEventListener('submit',async event=>{
  event.preventDefault();if(codeBusy)return;codeBusy=true;render();$('service-code-status').textContent='Verifying your code…';
  try{const result=await api('code-verify',{code:$('service-code').value.trim()});signedIn=true;email=result.email;
   if(lastEmail&&lastEmail!==email){identityEpoch++;form.reset();submission=null;saved=false;draftId=null;files=[];$('service-selected-files').replaceChildren();$('service-intake-status').textContent='';}lastEmail=email;render();
   document.dispatchEvent(new CustomEvent('nest-service-client-verified'));$('intake-name').focus();
  }catch(error){$('service-code-status').textContent=error.message;}finally{codeBusy=false;render();}
 });
 $('service-code-change').addEventListener('click',()=>{verify.hidden=true;request.hidden=false;verify.reset();$('service-code-status').textContent='';$('service-code-email').focus();});
 async function loadStaff(){if(!signedIn||staffLoaded||staffLoading)return;staffLoading=true;const epoch=identityEpoch;$('intake-client-directory-status').textContent='Loading staff contacts…';try{const response=await fetch('/api/service-requests?operation=directory',{credentials:'same-origin',cache:'no-store'}),result=await response.json();if(!response.ok)throw Error();if(epoch!==identityEpoch)return;staffLoaded=true;$('intake-client-staff').replaceChildren(new Option('Enter client details manually',''),...(result.staff||[]).map(p=>new Option(p.name+' · '+p.email,p.email)));$('intake-client-staff').dataset.contacts=JSON.stringify(result.staff||[]);$('intake-client-directory-status').textContent=result.staff?.length?'':'Enter the client name and email below.';}catch{if(epoch===identityEpoch)$('intake-client-directory-status').textContent='Staff contacts could not load. You can enter the client details below.';}finally{staffLoading=false;}}
 ['intake-client-name','intake-client-email'].forEach(id=>$(id).addEventListener('input',()=>{$('intake-client-staff').value='';}));
 $('intake-on-behalf').addEventListener('change',()=>{render();if($('intake-on-behalf').value==='yes')loadStaff();});
 $('intake-client-staff').addEventListener('change',()=>{const person=JSON.parse($('intake-client-staff').dataset.contacts||'[]').find(p=>p.email===$('intake-client-staff').value);if(person){$('intake-client-name').value=person.name;$('intake-client-email').value=person.email;$('intake-client-address').value='';}});
 $('intake-files').addEventListener('change',()=>{
  if(saveBusy||submission)return;
  try{if(!window.NestServiceUpload)throw Error('The upload tool has not loaded. Refresh before choosing files.');files=window.NestServiceUpload.selection($('intake-files').files);$('service-selected-files').replaceChildren(...files.map(({file})=>{const item=document.createElement('p');item.textContent=file.name+' · '+(file.size/1048576).toFixed(1)+' MB';return item;}));$('service-intake-status').textContent='';}
  catch(error){files=[];$('intake-files').value='';$('service-selected-files').replaceChildren();$('service-intake-status').textContent=error.message;}
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saveBusy||!signedIn||saved)return;
  if(!submission){const fields=Object.fromEntries(Object.entries(ids).map(([key,id])=>[key,$(id).value.trim()]));if($('intake-on-behalf').value==='yes')fields.client={name:$('intake-client-name').value.trim(),email:$('intake-client-email').value.trim(),address:$('intake-client-address').value.trim()};submission={id:draftId||(draftId=crypto.randomUUID()),fields};}
  const epoch=identityEpoch;saveBusy=true;render();$('service-intake-status').textContent='Saving your service request…';
  try{if(files.length){const ids=await window.NestServiceUpload.uploadFiles(files,submission.id,message=>{if(epoch===identityEpoch)$('service-intake-status').textContent=message;});if(epoch!==identityEpoch)return;submission.attachmentIds=ids;}$('service-intake-status').textContent='Saving your service request…';const result=await api('submit-request',submission);if(epoch!==identityEpoch)return;saved=true;$('service-intake-status').textContent='Request '+result.id.slice(0,8).toUpperCase()+' saved. You can follow its progress under My requests. The named client can verify their own email to view the ticket.';submission=null;files=[];draftId=null;$('service-selected-files').replaceChildren();form.reset();document.dispatchEvent(new CustomEvent('nest-service-request-created'));}
  catch(error){
   if(epoch!==identityEpoch)return;$('service-intake-status').textContent=error.message;
   if(error.status===400){submission=null;}else{$('service-intake-submit').textContent='Check / retry this submission';}
   if(error.status===401){signedIn=false;email='';request.hidden=false;verify.hidden=true;}
  }finally{saveBusy=false;render();}
 });
 $('service-intake-another').addEventListener('click',()=>{saved=false;submission=null;draftId=null;files=[];$('service-selected-files').replaceChildren();form.reset();$('service-intake-submit').textContent='Submit service request';$('service-intake-status').textContent='';render();$('intake-name').focus();});
 window.addEventListener('beforeunload',event=>{if(saveBusy||!saved&&(files.length||[...Object.values(ids),'intake-client-name','intake-client-email','intake-client-address'].some(id=>$(id).value.trim()))){event.preventDefault();event.returnValue='';}});
 if(window.NestServiceClient)document.dispatchEvent(new CustomEvent('nest-service-client-state',{detail:window.NestServiceClient}));
 render();
})();
