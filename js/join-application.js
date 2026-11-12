(() => {
 const root=document.querySelector('[data-native-application]');if(!root)return;
 const kind=root.dataset.nativeApplication,robotics=kind==='robotics',endpoint=robotics?'/api/robotics-signup':'/api/employment-application';
 const q=s=>root.querySelector(s),status=q('[data-application-status]'),panel=q('[data-application-panel]'),form=q('[data-application-form]'),fieldsRoot=q('[data-application-fields]');
 let schema,verified=false,busy=false,submission=crypto.randomUUID(),generation=0,authEmail='',accountPrompt=null;
 const controls=new Map();
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
 async function request(body){
  let response;
  try{response=await fetch(endpoint,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(60000),...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});}catch{throw new Error('The service took too long to respond. Keep this page open and retry the same application.');}
  let result;try{result=await response.json();}catch{throw new Error('The application service is temporarily unavailable. Keep this page open and try again.');}if(!response.ok){const error=new Error(result.error||'The application is temporarily unavailable.');error.status=response.status;error.retryable=result.retryable===true;throw error;}return result;
 }
 async function run(task){if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);try{await task();}catch(e){message(e.message,true);if(e.status===401&&robotics&&!e.retryable){verified=false;q('[data-verification]').hidden=false;q('[data-email-form]').hidden=false;q('[data-code-form]').hidden=true;/* Keep answers available while email is verified again. */}}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 function showApplication(){if(!schema||!verified||robotics&&(!window.NestAuth?.identity?.signedIn||window.NestAuth.identity.email!==authEmail))return;accountPrompt?.remove();accountPrompt=null;panel.hidden=false;q('[data-verified-email]').textContent='Applying with '+authEmail;message('');if(robotics){q('[data-verification]').hidden=true;q('[data-step-verify]').removeAttribute('aria-current');q('[data-step-apply]').setAttribute('aria-current','step');}else q('[data-employment-login]').hidden=true;}
 function renderField(f,parent){
  const wrap=node('div');wrap.className='join-field';wrap.dataset.question=f.id;
  const label=node('label',f.label+(f.required?' *':''));label.className='join-field-label';const id='application-'+f.id;
  const inputs=[];let other=null;
  if(['MULTIPLE_CHOICE','CHECKBOX'].includes(f.type)){
   const group=node('fieldset'),legend=node('legend',f.label+(f.required?' *':''));legend.className='join-field-label';group.append(legend);
   for(const [index,value] of [...f.choices,...(f.other?['Other']:[])].entries()){
    const option=node('label');option.className='join-option';const input=node('input');input.type=f.type==='CHECKBOX'?'checkbox':'radio';input.name=f.id;input.value=value;input.id=id+'-'+index;if(f.required&&input.type==='radio')input.required=true;
    const text=node('span',value);option.append(input,text);group.append(option);inputs.push(input);
    if(f.other&&index===f.choices.length){input.dataset.other='';other=node('input');other.type='text';other.maxLength=2000;other.setAttribute('aria-label','Other: '+f.label);other.hidden=true;group.append(other);input.addEventListener('change',()=>{other.hidden=!input.checked;other.required=input.checked;if(input.checked)other.focus();});}
   }
   wrap.append(group);
  }else{
   const input=node(f.type==='PARAGRAPH_TEXT'?'textarea':f.type==='LIST'?'select':'input');input.name=f.id;input.id=id;input.required=f.required;
   if(f.type==='LIST'){const empty=node('option','Choose…');empty.value='';input.append(empty);f.choices.forEach(value=>{const option=node('option',value);option.value=value;input.append(option);});}
   else{input.maxLength=2000;if(input.tagName==='INPUT'){input.type=/phone|number/i.test(f.label)&&!/graduation/i.test(f.label)?'tel':'text';if(/FIRST Name/i.test(f.label))input.autocomplete='given-name';if(/LAST Name/i.test(f.label))input.autocomplete='family-name';}}
   label.htmlFor=id;wrap.append(label,input);inputs.push(input);
  }
  if(f.help){const help=node('p',f.help);help.className='join-field-help';help.id=id+'-help';wrap.append(help);inputs.forEach(input=>input.setAttribute('aria-describedby',help.id));}
  controls.set(f.id,{wrap,inputs,other,field:f});parent.append(wrap);
 }
 function relevant(){let stop=false;for(const f of schema.fields){const c=controls.get(f.id);c.wrap.hidden=stop;c.inputs.forEach(input=>input.disabled=stop);if(c.other){c.other.disabled=stop;const selected=c.inputs.some(input=>input.hasAttribute('data-other')&&input.checked);c.other.hidden=!selected;c.other.required=selected&&!stop;}if(robotics&&!stop&&f.section==='Our Community Agreements'&&c.inputs.some(input=>input.checked&&input.value==='I disagree'))stop=true;}
  const notice=q('[data-community-notice]');notice.hidden=!stop;notice.textContent=stop?schema.declineNotice:'';
 }
 function answers(){const result={};for(const [id,c] of controls){if(c.wrap.hidden)continue;const f=c.field;let value;if(f.type==='CHECKBOX'){value=c.inputs.filter(input=>input.checked).map(input=>input.hasAttribute('data-other')?c.other.value.trim():input.value);c.inputs[0]?.setCustomValidity(f.required&&!value.length?'Choose at least one option.':'');}
  else if(f.type==='MULTIPLE_CHOICE'){const selected=c.inputs.find(input=>input.checked);value=selected?.hasAttribute('data-other')?c.other.value.trim():selected?.value||'';}
  else value=c.inputs[0].value.trim();result[id]=value;}return result;}
 function prefillPeriod(){const period=new URLSearchParams(location.search).get('period')||new URLSearchParams(location.search).get('division');if(!robotics&&period){const c=controls.get('1636397509'),value=period==='CTSO'?'CTSO':'Period '+period;if(c?.field.choices.includes(value))c.inputs[0].value=value;}}
 async function load(){
  try{schema=(await request()).schema;if(!schema||!Array.isArray(schema.fields))throw Error('The application could not be loaded.');fieldsRoot.replaceChildren();let section='',parent=fieldsRoot;for(const f of schema.fields){const next=robotics?f.section:'';if(next&&next!==section){section=next;parent=node('fieldset');parent.append(node('legend',section));fieldsRoot.append(parent);}renderField(f,parent);}
   q('[data-form-description]').textContent=schema.description||'';prefillPeriod();
   message('');showApplication();
  }catch(e){message(e.message,true);const retry=node('button','Retry loading');retry.type='button';retry.addEventListener('click',()=>{retry.remove();load();},{once:true});status.append(' ',retry);}
 }
 form.addEventListener('change',()=>{if(schema){relevant();answers();}});
 form.addEventListener('submit',event=>{event.preventDefault();const values=answers();if(!form.reportValidity()||!verified)return;const own=generation;run(async()=>{message('Submitting your application…');const result=await request(robotics?{operation:'submit',revision:schema.revision,answers:values}:{submission,revision:schema.revision,answers:values});if(own!==generation)return;if(result.received!==true)throw Error('Receipt could not be confirmed. Retry the same application.');panel.hidden=true;const success=q('[data-application-success]');success.hidden=false;success.focus();message('');if(robotics){q('[data-step-apply]').removeAttribute('aria-current');q('[data-step-done]').setAttribute('aria-current','step');}});});
 if(robotics){
  q('[data-robotics-login]')?.addEventListener('click',()=>window.NestAuth?.open());
  q('[data-email-form]').addEventListener('submit',event=>{event.preventDefault();run(async()=>{authEmail=new FormData(event.target).get('email').trim();message('Sending your verification code…');await request({operation:'request',email:authEmail});q('[data-email-form]').hidden=true;q('[data-code-form]').hidden=false;q('[name=code]').value='';q('[name=code]').focus();message('Check '+authEmail+' for a code. It expires in 10 minutes.');});});
  q('[data-code-form]').addEventListener('submit',event=>{event.preventDefault();run(async()=>{message('Verifying your email…');const result=await request({operation:'verify',code:new FormData(event.target).get('code')});verified=true;authEmail=result.email;if(window.NestAuth?.identity?.signedIn&&window.NestAuth.identity.email===authEmail){showApplication();}else{const setup=await request({operation:'account-setup'});accountPrompt?.remove();accountPrompt=node('section');accountPrompt.append(node('h3',setup.needsAccount?'Create your NEST™ account':'Sign in to NEST™'),node('p',setup.needsAccount?'Your school email is verified. Choose your username and password to continue your Robotics application.':'Sign in with the NEST account for '+authEmail+' to continue.'));const button=node('button',setup.needsAccount?'Choose username and password':'Sign in to continue');button.type='button';button.addEventListener('click',()=>window.NestAuth?.open(setup.needsAccount?'register':'login'));accountPrompt.append(button);q('[data-verification]').append(accountPrompt);q('[data-code-form]').hidden=true;q('[data-email-form]').hidden=true;message('Email verified. Complete your NEST account step to continue.');}});});
  function continueSignedIn(){const identity=window.NestAuth?.identity;if(!identity?.signedIn){if(verified){panel.hidden=true;q('[data-verification]').hidden=false;message('Sign in to continue your Robotics application.');}return;}if(authEmail&&identity.email!==authEmail){generation++;form.reset();q('[data-application-success]').hidden=true;}run(async()=>{const result=await request({operation:'continue'});verified=true;authEmail=result.email;showApplication();});}
  document.addEventListener('nest-auth-change',continueSignedIn);Promise.resolve(window.NestAuth?.ready).then(continueSignedIn);
  q('[data-change-email]').addEventListener('click',()=>{q('[data-email-form]').hidden=false;q('[data-code-form]').hidden=true;q('[name=email]').focus();message('Enter your email to request a new code.');});
 }else{
  q('[data-application-login]').addEventListener('click',()=>window.NestAuth?.open());
  function identityChanged(){const identity=window.NestAuth?.identity,next=identity?.email||'';if(next!==authEmail){generation++;form.reset();prefillPeriod();submission=crypto.randomUUID();q('[data-application-success]').hidden=true;}authEmail=next;verified=!!identity?.signedIn;if(verified)showApplication();else{panel.hidden=true;q('[data-employment-login]').hidden=false;}}
  document.addEventListener('nest-auth-change',identityChanged);window.NestAuth?.ready.then(identityChanged);
 }
 load();
})();
