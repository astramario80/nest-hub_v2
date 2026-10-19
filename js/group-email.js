(() => {
  function init(){
    const lookup=document.querySelector('.leadership-page');if(!lookup)return;
    const communicationPanel=document.querySelector('[data-hq-communications]'),inline=Boolean(communicationPanel);
    const activeTab=inline?'communications':'lookup';
    const divisions=['all','1','2','3','4','5','7','CTSO'];
    const label=p=>p==='all'?'All divisions':p==='CTSO'?'NEST™ Robotics':'Division '+p;
    const button=document.createElement('button');button.type='button';button.className='group-email-launch';button.textContent='Email group';button.hidden=true;
    if(!inline)lookup.querySelector('.leadership-controls').append(button);
    const dialog=document.createElement(inline?'section':'dialog');dialog.className='group-email-dialog'+(inline?' group-email-inline':'');dialog.setAttribute('aria-labelledby','group-email-title');
    dialog.innerHTML=`<div class="group-email-heading"><h2 id="group-email-title">Email group</h2><button type="button" data-email-close aria-label="Close email window">×</button></div><div class="group-email-fields"><label>Division<select data-email-division>${divisions.map(p=>`<option value="${p}">${label(p)}</option>`).join('')}</select></label><label>Group<select data-email-group><option value="leadership">Leadership teams</option><option value="position">By leadership position</option><option value="members">All members of selected divisions</option><option value="specific">Specific students</option></select></label><label data-email-position-label hidden>Position<select data-email-position></select></label></div><label>Find a recipient<input data-email-search type="search" placeholder="Search name or school email"></label><p data-email-count></p><div class="group-email-recipients" data-email-recipients></div><label class="group-email-subject">Subject<input data-email-subject maxlength="180" autocomplete="off"></label><div class="group-email-toolbar" role="group" aria-label="Message formatting"><button type="button" data-email-command="bold"><strong>Bold</strong></button><button type="button" data-email-command="italic"><em>Italic</em></button><button type="button" data-email-command="underline"><u>Underline</u></button><button type="button" data-email-command="strikeThrough"><s>Strike through</s></button><button type="button" data-email-command="insertUnorderedList">Bullet points</button><button type="button" data-email-command="insertOrderedList">Numbered list</button><button type="button" data-email-command="indent">Indent</button><button type="button" data-email-command="outdent">Outdent</button><button type="button" data-email-link>Insert hyperlink</button><select data-email-font aria-label="Font style"><option value="Arial">Arial</option><option value="Verdana">Verdana</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option></select><select data-email-size aria-label="Font size"><option value="2">Small</option><option value="3" selected>Normal</option><option value="4">Large</option><option value="5">Extra large</option></select><select data-email-block aria-label="Paragraph style"><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select><label class="group-email-color">Text color<input type="color" data-email-color value="#172238" aria-label="Text color"></label><label class="group-email-color">Highlight<input type="color" data-email-highlight value="#fff3a3" aria-label="Highlight color"></label><button type="button" data-email-command="justifyLeft">Align left</button><button type="button" data-email-command="justifyCenter">Center</button><button type="button" data-email-command="justifyRight">Align right</button><button type="button" data-email-command="removeFormat">Clear formatting</button><button type="button" data-email-command="unlink">Remove link</button><button type="button" data-email-command="undo">Undo</button><button type="button" data-email-command="redo">Redo</button></div><div class="group-email-message" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Email message" aria-describedby="group-email-shortcuts"></div><p class="group-email-shortcuts" id="group-email-shortcuts">Indent: Tab or Cmd/Ctrl+]. Outdent: Shift+Tab or Cmd/Ctrl+[. Press Escape, then Tab to move out of the message.</p><p class="group-email-notice">Connect your Gmail account, review the recipients and send your formatted message directly here. <a href="/email-privacy" target="_blank" rel="noopener noreferrer">Gmail privacy</a>.</p><div class="group-email-connection"><button type="button" data-email-connect disabled>Connect Gmail</button><button type="button" data-email-disconnect hidden>Disconnect Gmail</button><span data-email-sender role="status" aria-live="polite">Gmail is not connected.</span></div><p class="group-email-banner-note">The NEST™ banner will be included in the email you send.</p><p data-email-status role="status" aria-live="polite"></p><button type="button" data-email-error-copy hidden>Copy error details</button><div class="group-email-actions"><button type="button" data-email-send disabled>Send email</button><button type="button" data-email-test disabled>Send test to myself</button><button type="button" data-email-new hidden>New email</button><button type="button" data-email-open disabled>Copy formatted message and open Gmail</button><button type="button" data-email-copy disabled>Copy formatted message</button></div>`;
    (communicationPanel||document.body).append(dialog);
    const isOpen=()=>inline?window.NestDivisionHQ?.active===activeTab:dialog.open;
    const q=s=>dialog.querySelector(s),periodSelect=q('[data-email-division]'),group=q('[data-email-group]'),position=q('[data-email-position]'),recipients=q('[data-email-recipients]'),message=q('.group-email-message'),status=q('[data-email-status]');
    const buildingOption=document.createElement('option');buildingOption.value='building-leadership';buildingOption.textContent='Leadership across NEST';buildingOption.hidden=true;buildingOption.disabled=true;group.append(buildingOption);
    if(inline){q('[data-email-close]').hidden=true;q('h2').textContent='Compose an email';q('.group-email-heading').after(status);}
    let data=null,period='',divisionPeriod='',generation=0,selectedRange=null,leaveEditorOnTab=false;
    const gmailScope='https://www.googleapis.com/auth/gmail.send',emailScope='https://www.googleapis.com/auth/userinfo.email';
    const gmail={client:null,clientId:'',token:'',email:'',expires:0,connecting:false,sending:false,delivery:'draft',epoch:0,timer:null};
    let googleLibrary=null,lastFailure=null,requestConsent=false;
    const connected=()=>Boolean(gmail.token)&&gmail.expires>Date.now()+15000;
    function gmailControls(){
      q('[data-email-send]').disabled=!data||!chosen().length||!connected()||gmail.sending||gmail.delivery!=='draft';
      q('[data-email-test]').disabled=!data||!connected()||gmail.sending||gmail.delivery!=='draft';
      q('[data-email-send]').textContent=gmail.sending?'Sending…':gmail.delivery==='sent'?'Email sent':gmail.delivery==='unknown'?'Check Sent folder':'Send email';
      q('[data-email-connect]').disabled=!gmail.client||!data||gmail.connecting||gmail.sending;
      q('[data-email-connect]').textContent=gmail.connecting?'Connecting…':connected()?'Change Gmail account':'Connect Gmail';
      q('[data-email-disconnect]').hidden=!connected();q('[data-email-disconnect]').disabled=gmail.sending;
      q('[data-email-new]').hidden=gmail.delivery==='draft';q('[data-email-new]').disabled=gmail.sending;
    }
    function disconnectGmail(){gmail.epoch++;clearTimeout(gmail.timer);gmail.token='';gmail.email='';gmail.expires=0;gmail.connecting=false;q('[data-email-sender]').textContent='Gmail is not connected.';gmailControls();}
    function googleError(code){return code==='popup_closed'?'Gmail connection was canceled.':code==='popup_failed_to_open'?'Allow the Google sign-in popup, then click Connect Gmail again.':'Google did not authorize Gmail sending. Try Connect Gmail again; if your school blocks access, contact your district administrator.';}
    function clearFailure(){lastFailure=null;q('[data-email-error-copy]').hidden=true;}
    function failure(stage,statusCode,code){
      lastFailure={stage,status:Number(statusCode)||0,code:/^[a-z0-9_-]{1,60}$/i.test(code||'')?code:'unknown',time:new Date().toISOString()};q('[data-email-error-copy]').hidden=false;
    }
    q('[data-email-error-copy]').addEventListener('click',async()=>{
      if(!lastFailure)return;const report='NEST™ team email\n'+Object.entries(lastFailure).map(([key,value])=>key+': '+value).join('\n')+'\nNo message text, recipients, or credentials included.';
      try{await navigator.clipboard.writeText(report);status.textContent='Error details copied. Your draft is still here.';}catch{status.textContent='Copying is unavailable. Error: '+lastFailure.code+' (HTTP '+lastFailure.status+'). Your draft is still here.';}
    });
    function gmailRejection(httpStatus,result){
      const reasons=[...(result?.error?.errors||[]).map(e=>e.reason),...(result?.error?.details||[]).map(e=>e.reason)].filter(v=>typeof v==='string');
      if(httpStatus===401)return {code:'gmail-expired',message:'Your Gmail connection expired. Connect again to send.',reconnect:true};
      if(reasons.some(r=>['accessNotConfigured','SERVICE_DISABLED'].includes(r)))return {code:'gmail-api-disabled',message:'The Gmail API is disabled for the NEST Google project. A NEST administrator must enable it before in-page sending can work. Your draft is still here.'};
      if(reasons.some(r=>['insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'].includes(r)))return {code:'gmail-send-permission',message:'Google has not granted permission to send email. Connect Gmail again and allow sending. Your draft is still here.',reconnect:true,consent:true};
      if(reasons.includes('domainPolicy'))return {code:'gmail-school-policy',message:'Your school Google policy blocks this app from sending email. A district Google administrator must approve NEST Gmail sending. Your draft is still here.'};
      if(httpStatus===429||reasons.some(r=>['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded'].includes(r)))return {code:'gmail-sending-limit',message:'Google’s sending limit was reached. Wait before trying again. Your draft is still here.'};
      return {code:'gmail-rejected-'+httpStatus,message:httpStatus===403?'Google blocked sending. Gmail may need school approval or Google setup. Your draft is still here. Use Copy error details to share the failure.':'Gmail rejected this email. Review the recipients and message before trying again.'};
    }
    function googleReady(){
      if(window.google?.accounts?.oauth2)return Promise.resolve();
      if(googleLibrary)return googleLibrary;
      googleLibrary=new Promise((resolve,reject)=>{
        const existing=document.querySelector('script[src="https://accounts.google.com/gsi/client"]'),script=existing||document.createElement('script');
        const timer=setTimeout(()=>{if(!existing)script.remove();reject(new Error('Google sign-in could not load. Check your connection and try again.'));},15000);
        const done=()=>{clearTimeout(timer);window.google?.accounts?.oauth2?resolve():reject(new Error('Google sign-in is unavailable. Try again.'));};
        script.addEventListener('load',done,{once:true});script.addEventListener('error',()=>{clearTimeout(timer);if(!existing)script.remove();reject(new Error('Google sign-in could not load. Check your connection and try again.'));},{once:true});
        if(!existing){script.src='https://accounts.google.com/gsi/client';script.async=true;document.head.append(script);}
      }).catch(error=>{googleLibrary=null;throw error;});return googleLibrary;
    }
    async function prepareGmail(clientId){
      if(!clientId){q('[data-email-sender]').textContent='Gmail connection is awaiting Google configuration.';return;}
      if(gmail.client&&gmail.clientId===clientId)return;
      const epoch=gmail.epoch;
      try{await googleReady();if(epoch!==gmail.epoch||!identity()||!data)return;
        gmail.clientId=clientId;
        gmail.client=window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:gmailScope+' '+emailScope,include_granted_scopes:false,callback:()=>{},error_callback:error=>{gmail.connecting=false;q('[data-email-sender]').textContent=googleError(error.type);gmailControls();}});
        gmailControls();
      }catch(error){q('[data-email-sender]').textContent=error.message;}
    }
    q('[data-email-connect]').addEventListener('click',()=>{
      if(!gmail.client||!identity()||!data||gmail.sending)return;
      disconnectGmail();gmail.connecting=true;const epoch=gmail.epoch;gmailControls();q('[data-email-sender]').textContent='Choose your Gmail account and allow sending.';
      gmail.client.callback=async response=>{
        if(epoch!==gmail.epoch||!identity()||!data)return;
        try{
          if(response.error||!response.access_token)throw new Error(googleError(response.error));
          if(!window.google.accounts.oauth2.hasGrantedAllScopes(response,gmailScope,emailScope)){requestConsent=true;throw new Error('Google did not authorize Gmail sending. Connect again and allow permission to send email.');}
          const r=await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{Authorization:'Bearer '+response.access_token},signal:AbortSignal.timeout(15000)});
          const profile=await r.json();if(epoch!==gmail.epoch||!identity())return;
          const email=String(profile.email||'').toLowerCase();
          if(!r.ok||profile.verified_email!==true||!/^[-a-z0-9.!#$%&'*+/=?^_`{|}~]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)||email.length>254)throw new Error('Google could not verify your sending account. Connect Gmail again.');
          const nestEmail=String(window.NestAuth.identity.email||'').toLowerCase();
          if(nestEmail&&!nestEmail.startsWith('manual:')&&email!==nestEmail)throw new Error('Connect the Gmail account you use for NEST sign-in: '+nestEmail+'.');
          const seconds=Number(response.expires_in);if(!Number.isFinite(seconds)||seconds<=30)throw new Error('Your Gmail connection expired. Connect again.');
          clearFailure();requestConsent=false;gmail.token=response.access_token;gmail.email=email;gmail.expires=Date.now()+seconds*1000;
          q('[data-email-sender]').textContent='Sending as '+email;
          gmail.timer=setTimeout(()=>{disconnectGmail();q('[data-email-sender]').textContent='Gmail connection expired. Connect again to send.';},Math.min(seconds*1000-15000,2147483647));
        }catch(error){if(epoch===gmail.epoch){disconnectGmail();failure('connect',0,'gmail-connect-failed');q('[data-email-sender]').textContent=error.message;}}
        finally{if(epoch===gmail.epoch){gmail.connecting=false;gmailControls();}}
      };
      try{gmail.client.requestAccessToken({prompt:requestConsent?'consent select_account':'select_account'});}catch{gmail.connecting=false;q('[data-email-sender]').textContent='Google sign-in could not open. Click Connect Gmail again.';gmailControls();}
    });
    q('[data-email-disconnect]').addEventListener('click',disconnectGmail);
    q('[data-email-new]').addEventListener('click',()=>{
      if(gmail.sending)return;
      if(gmail.delivery==='unknown'&&!window.confirm('Check your Gmail Sent folder before starting another email. Continue with a new message?'))return;
      gmail.delivery='draft';clearFailure();message.replaceChildren();selectedRange=null;q('[data-email-subject]').value='';status.textContent='';gmailControls();q('[data-email-subject]').focus();
    });

    const identity=()=>Boolean(window.NestAuth?.identity?.signedIn)&&(!window.NestDivisionHQ||window.NestDivisionHQ.allowed);
    const chosen=()=>[...recipients.querySelectorAll('input:checked')].map(el=>el.value);
    function count(){const n=chosen().length;q('[data-email-count]').textContent=n+' recipient'+(n===1?'':'s')+' selected';q('[data-email-open]').disabled=q('[data-email-copy]').disabled=!n||!data||gmail.sending;gmailControls();}
    async function records(p,audience=group.value==='building-leadership'?'leadership':'division'){const r=await fetch('/api/group-email?period='+encodeURIComponent(p)+'&audience='+audience+'&action=group-email-access',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(120000)});const result=await r.json();if(!r.ok)throw Object.assign(new Error(result.error||'Email groups could not load.'),{status:r.status});return result;}
    function members(){if(!data)return [];let list=group.value==='members'||group.value==='specific'?data.members:data.leaders.filter(l=>group.value!=='position'||l.position===position.value);return [...new Map(list.map(m=>[m.email,m])).values()];}
    function render(preselected){
      q('[data-email-position-label]').hidden=group.value!=='position';recipients.replaceChildren();
      members().forEach(m=>{const row=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');box.type='checkbox';box.value=m.email;box.checked=preselected?preselected.has(m.email):group.value!=='specific';text.textContent=m.name+' · '+m.email;box.addEventListener('change',count);row.append(box,text);recipients.append(row);});count();search();
    }
    function search(){const term=q('[data-email-search]').value.trim().toLowerCase();recipients.querySelectorAll('label').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(term));}
    function resetAccess(){clearFailure();disconnectGmail();gmail.client=null;gmail.delivery='draft';selectedRange=null;delete lookup.dataset.emailEnabled;generation++;data=null;button.hidden=true;recipients.replaceChildren();position.replaceChildren();message.replaceChildren();q('[data-email-subject]').value='';buildingOption.hidden=buildingOption.disabled=true;count();if(!inline&&dialog.open)dialog.close();}
    async function check(p){
      if(group.value==='building-leadership')p='all';
      if(!divisions.includes(p)||!identity()||(window.NestDivisionHQ&&window.NestDivisionHQ.active!==activeTab&&!isOpen()))return;
      const selectedPosition=position.value,specificSelection=group.value==='specific'?new Set(chosen()):undefined;
      const own=++generation;period=p;periodSelect.value=p;periodSelect.disabled=group.value==='building-leadership';if(group.value!=='building-leadership')divisionPeriod=p;delete lookup.dataset.emailEnabled;data=null;button.hidden=true;recipients.replaceChildren();count();status.textContent='Checking leadership email access…';
      try{const result=await records(p);if(own!==generation||!identity())return;data=result;if(!inline)lookup.dataset.emailEnabled='true';button.hidden=false;buildingOption.hidden=buildingOption.disabled=!result.canReachBuildingLeadership;position.replaceChildren();[...new Set(result.leaders.map(l=>l.position))].sort().forEach(role=>{const option=document.createElement('option');option.value=option.textContent=role;position.append(option);});if([...position.options].some(option=>option.value===selectedPosition))position.value=selectedPosition;status.textContent=result.audience==='leadership'?'Leadership across all NEST divisions. Student groups remain limited to your own divisions.':p==='all'?'Included: '+(result.divisions||[]).map(label).join(', ')+'. Only divisions where you have leadership access are included.':'';render(specificSelection);if(isOpen())prepareGmail(result.gmailClientId);}
      catch(error){if(own===generation){status.textContent=error.message;count();}}
    }
    function lookupPeriod(){if(inline)return lookup.dataset.hqLookup||period;const value=document.getElementById('leadership-division')?.value;return value==='NEST™ Robotics'?'CTSO':value?.replace('Division ','')||lookup.dataset.hqLookup||period;}
    button.addEventListener('click',()=>{
      if(!data||!identity())return;
      const selected=new Set([...lookup.querySelectorAll('[data-email-select]:checked')].map(box=>box.value));
      const role=document.getElementById('leadership-position')?.value;
      group.value=selected.size?'specific':role?'position':'leadership';if(role)position.value=role;
      render(selected.size?selected:undefined);dialog.showModal();prepareGmail(data.gmailClientId);q('[data-email-subject]').focus();
    });
    if(!inline)q('[data-email-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>button.focus());
    periodSelect.addEventListener('change',()=>check(periodSelect.value));group.addEventListener('change',()=>{if(group.value==='building-leadership')check('all');else if(data?.audience==='leadership'||periodSelect.disabled)check(divisionPeriod||lookupPeriod());else render();});position.addEventListener('change',()=>render());q('[data-email-search]').addEventListener('input',search);
    if(!inline)document.getElementById('leadership-division')?.addEventListener('change',()=>check(lookupPeriod()));
    function remember(){
      const selection=window.getSelection();
      if(selection.rangeCount&&message.contains(selection.anchorNode)&&message.contains(selection.focusNode))selectedRange=selection.getRangeAt(0).cloneRange();
    }
    document.addEventListener('selectionchange',remember);
    message.addEventListener('keyup',remember);message.addEventListener('mouseup',remember);message.addEventListener('input',remember);
    function indentation(name){
      const selection=window.getSelection();if(!selection.rangeCount)return;
      const range=selection.getRangeAt(0),collapsed=range.collapsed;if(!message.contains(range.commonAncestorContainer))return;
      // Bookmarks keep both ends intact while paragraphs and list items move.
      const start=document.createElement('span'),end=document.createElement('span');
      const finish=range.cloneRange();finish.collapse(false);finish.insertNode(end);
      const begin=range.cloneRange();begin.collapse(true);begin.insertNode(start);
      const blockTags=new Set(['P','DIV','UL','OL','LI','BLOCKQUOTE']);
      function paragraphs(container){
        let line=null;
        [...container.childNodes].forEach(node=>{
          if(node.nodeType===1&&blockTags.has(node.tagName)){line=null;if(node.tagName==='BLOCKQUOTE')paragraphs(node);return;}
          if(!line){line=document.createElement('div');container.insertBefore(line,node);}
          line.append(node);if(node.nodeName==='BR')line=null;
        });
      }
      paragraphs(message);
      const marked=document.createRange();marked.setStartAfter(start);marked.setEndBefore(end);
      const intersects=el=>{
        if(!marked.intersectsNode(el))return false;
        const part=document.createRange();part.selectNodeContents(el);
        if(marked.compareBoundaryPoints(window.Range.START_TO_START,part)>0)part.setStart(marked.startContainer,marked.startOffset);
        if(marked.compareBoundaryPoints(window.Range.END_TO_END,part)<0)part.setEnd(marked.endContainer,marked.endOffset);
        return !part.collapsed&&(part.toString().length>0||!el.textContent.trim());
      };
      let blocks=[...message.querySelectorAll('li,p,div')].filter(el=>{
        if(el.tagName!=='LI'&&el.closest('li'))return false;
        if(el.tagName==='LI'){
          const walker=document.createTreeWalker(el,window.NodeFilter.SHOW_TEXT);let ownSelected=false,node;
          while((node=walker.nextNode()))if(node.length&&node.parentElement.closest('li')===el&&intersects(node)){ownSelected=true;break;}
          return ownSelected||(!el.textContent.trim()&&intersects(el));
        }
        if(el.tagName!=='LI'&&el.querySelector('p,div,ul,ol,li,blockquote'))return false;
        return intersects(el);
      });
      if(collapsed){const el=start.closest('li,p,div');blocks=el&&el!==message?[el]:[];}
      // A selected parent item carries its nested list with it.
      blocks=blocks.filter(el=>!blocks.some(other=>other!==el&&other.contains(el)));
      const level=el=>Math.max(0,Math.min(20,Number(el.dataset.emailIndent)||0));
      function offset(el,amount){const next=Math.max(0,Math.min(20,level(el)+amount));if(next){el.dataset.emailIndent=String(next);el.style.marginLeft=(next*32)+'px';}else{delete el.dataset.emailIndent;el.style.removeProperty('margin-left');}}
      const lists=new Map();
      blocks.forEach(el=>{if(el.tagName==='LI'){const list=el.parentElement;if(!lists.has(list))lists.set(list,[]);lists.get(list).push(el);}else offset(el,name==='indent'?1:-1);});
      lists.forEach((items,list)=>{
        const parentItem=list.parentElement.closest('li');
        if(name==='indent'){
          // Nest under the preceding item; the first bullet still visibly moves.
          const previous=items[0].previousElementSibling;
          if(previous?.tagName==='LI'&&!items.some(level)){
            let nested=[...previous.children].find(el=>el.tagName===list.tagName);
            if(!nested){nested=document.createElement(list.tagName);previous.append(nested);}
            items.forEach(item=>nested.append(item));
          }else items.forEach(item=>offset(item,1));
        }else{
          const lifted=items.filter(item=>!level(item));items.filter(level).forEach(item=>offset(item,-1));
          if(parentItem&&lifted.length){
            // Keep unselected trailing children under the last lifted item.
            const tail=list.cloneNode(false);let next=lifted.at(-1).nextElementSibling;
            while(next){const following=next.nextElementSibling;tail.append(next);next=following;}
            if(tail.children.length)lifted.at(-1).append(tail);
            let after=parentItem;lifted.forEach(item=>{after.after(item);after=item;});
          }else if(!parentItem){
            lifted.forEach(item=>{
              const tail=list.cloneNode(false);let next=item.nextElementSibling;
              while(next){const following=next.nextElementSibling;tail.append(next);next=following;}
              const paragraph=document.createElement('div');paragraph.append(...item.childNodes);list.after(paragraph);if(tail.children.length)paragraph.after(tail);item.remove();if(!list.children.length)list.remove();
              // Subsequent selected items now belong to the split tail.
              list=tail.children.length?tail:list;
            });
          }
        }
        if(!list.children.length)list.remove();
      });
      const restored=document.createRange();restored.setStartAfter(start);restored.setEndBefore(end);start.remove();end.remove();if(collapsed)restored.collapse(true);
      selection.removeAllRanges();selection.addRange(restored);remember();
      message.dispatchEvent(new Event('input',{bubbles:true}));
    }
    function command(name,value){
      remember();message.focus();if(selectedRange&&message.contains(selectedRange.commonAncestorContainer)){const selection=window.getSelection();selection.removeAllRanges();selection.addRange(selectedRange);}
      if(name==='indent'||name==='outdent')indentation(name);else document.execCommand(name,false,value);remember();
    }
    message.addEventListener('keydown',event=>{
      if(event.defaultPrevented||event.isComposing||gmail.sending||message.contentEditable==='false')return;
      if(event.key==='Escape'){
        if(!leaveEditorOnTab){event.preventDefault();event.stopPropagation();leaveEditorOnTab=true;status.textContent='Press Tab to leave the message, or Escape again to close this window.';}
        return;
      }
      if(event.key==='Tab'&&leaveEditorOnTab){leaveEditorOnTab=false;return;}
      leaveEditorOnTab=false;
      const tab=event.key==='Tab'&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
      const bracket=(event.ctrlKey||event.metaKey)&&!event.altKey&&(['[',']'].includes(event.key)||['BracketLeft','BracketRight'].includes(event.code));
      if(!tab&&!bracket)return;
      event.preventDefault();event.stopPropagation();command(tab?(event.shiftKey?'outdent':'indent'):(event.key==='['||event.code==='BracketLeft'?'outdent':'indent'));
    });
    message.addEventListener('blur',()=>{leaveEditorOnTab=false;});
    q('[data-email-command="indent"]').setAttribute('aria-keyshortcuts','Tab Control+] Meta+]');
    q('[data-email-command="outdent"]').setAttribute('aria-keyshortcuts','Shift+Tab Control+[ Meta+[');
    q('.group-email-toolbar').addEventListener('mousedown',event=>{remember();if(event.target.closest('button'))event.preventDefault();});
    dialog.querySelectorAll('[data-email-command]').forEach(el=>el.addEventListener('click',()=>command(el.dataset.emailCommand)));
    q('[data-email-font]').addEventListener('change',event=>command('fontName',event.target.value));q('[data-email-size]').addEventListener('change',event=>command('fontSize',event.target.value));
    q('[data-email-block]').addEventListener('change',event=>command('formatBlock',event.target.value));
    q('[data-email-color]').addEventListener('input',event=>command('foreColor',event.target.value));
    q('[data-email-highlight]').addEventListener('input',event=>command('hiliteColor',event.target.value));
    q('[data-email-link]').addEventListener('click',()=>{const raw=window.prompt('Hyperlink address (https://…)');if(!raw)return;try{const u=new URL(raw);if(!['https:','http:','mailto:'].includes(u.protocol))throw new Error();command('createLink',u.href);}catch{status.textContent='Use an https, http, or email link.';}});
    function formatted(){
      const copy=document.createElement('div');copy.innerHTML=message.innerHTML;
      const allowed=new Set(['P','DIV','BR','B','STRONG','I','EM','UL','OL','LI','BLOCKQUOTE','A','SPAN','FONT','U','S','STRIKE','DEL','H1','H2','H3']);
      const dangerous=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','IMG','FORM','INPUT']);
      const color=value=>/^(?:#[0-9a-f]{3}(?:[0-9a-f]{3})?|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)|transparent|black|white|red|blue|green|yellow)$/i.test(value||'')?value:'';
      [...copy.querySelectorAll('*')].reverse().forEach(el=>{
        if(dangerous.has(el.tagName)){el.remove();return;}if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return;}
        const indent=Math.max(0,Math.min(20,Number(el.dataset.emailIndent)||0)),style=el.style;
        const preserved={color:color(style.color),backgroundColor:color(style.backgroundColor),textAlign:['left','center','right','justify'].includes(style.textAlign||el.getAttribute('align'))?(style.textAlign||el.getAttribute('align')):'',fontWeight:/^(normal|bold|[1-9]00)$/.test(style.fontWeight)?style.fontWeight:'',fontStyle:['normal','italic'].includes(style.fontStyle)?style.fontStyle:'',textDecoration:/^(underline|line-through)( (underline|line-through))?$/.test(style.textDecoration)?style.textDecoration:'',fontFamily:/^(Arial|Verdana|Georgia|Times New Roman|Courier New)(, ?(serif|sans-serif|monospace))?$/i.test(style.fontFamily.replace(/["']/g,''))?style.fontFamily:'',fontSize:/^(small|medium|large|x-large|[1-4][0-9]px)$/.test(style.fontSize)?style.fontSize:''};
        const font=el.tagName==='FONT'?{face:el.getAttribute('face'),size:el.getAttribute('size'),color:color(el.getAttribute('color'))}:null;
        const href=el.tagName==='A'&&/^(https?:|mailto:)/i.test(el.getAttribute('href')||'')?el.getAttribute('href'):'';
        for(const attr of [...el.attributes])el.removeAttribute(attr.name);
        if(href)el.setAttribute('href',href);
        if(font){if(/^(Arial|Verdana|Georgia|Times New Roman|Courier New)$/i.test(font.face||''))el.setAttribute('face',font.face);if(/^[1-7]$/.test(font.size||''))el.setAttribute('size',font.size);if(font.color)el.setAttribute('color',font.color);}
        for(const [key,value] of Object.entries(preserved))if(value)el.style[key]=value;
        if(indent&&['P','DIV','LI'].includes(el.tagName))el.style.marginLeft=(indent*32)+'px';
      });
      return {html:'<div style="width:100%"><a href="https://gknest.org/" style="display:block;width:100%" target="_blank" rel="noopener noreferrer"><img src="https://gknest.org/assets/nest-email-banner.png" alt="NEST™ — Visit our homepage" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border:0"></a><div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6">'+copy.innerHTML+'</div></div>',text:'NEST™\n'+(message.innerText||message.textContent)};
    }
    function base64(text){const bytes=new TextEncoder().encode(text);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return window.btoa(binary);}
    function mailMessage(emails,subject,draft,sender,testing=false){
      if(!(testing&&emails.length===1&&emails[0]===sender)&&emails.some(email=>!/^[^\s@,;<>]+@(students\.bethelsd\.org|bethelsd\.org)$/.test(email)||email.length>254))throw new Error('Choose valid school email recipients.');
      const id=window.crypto.randomUUID(),boundary='nest_'+id;
      const characters=Array.from(subject),words=[];for(let i=0;i<characters.length;i+=11)words.push('=?UTF-8?B?'+base64(characters.slice(i,i+11).join(''))+'?=');
      const body=text=>(base64(text).match(/.{1,76}/g)||[]).join('\r\n');
      const mime=['From: '+sender,'To: '+emails.join(',\r\n '),'Subject: '+words.join('\r\n '),'Date: '+new Date().toUTCString(),'Message-ID: <'+id+'@gknest.org>','MIME-Version: 1.0','Content-Type: multipart/alternative; boundary="'+boundary+'"','','--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',body(draft.text),'--'+boundary,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',body(draft.html),'--'+boundary+'--',''].join('\r\n');
      return base64(mime).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }
    async function sendEmail(testing=false){
      if(gmail.sending||gmail.delivery!=='draft'||!data||!identity())return;
      if(!connected()){disconnectGmail();status.textContent='Connect your Gmail account before sending.';return;}
      const emails=testing?[gmail.email]:chosen(),subject=q('[data-email-subject]').value.trim();if(!emails.length||!subject||!message.textContent.trim()){status.textContent='Choose recipients and add a subject and message.';return;}
      const own=generation,epoch=gmail.epoch,targetPeriod=period,draft=formatted(),sender=gmail.email,token=gmail.token;
      const controls=[...dialog.querySelectorAll('input,select,.group-email-toolbar button,[data-email-open],[data-email-copy]')],disabled=controls.map(el=>el.disabled);
      gmail.sending=true;controls.forEach(el=>el.disabled=true);message.contentEditable='false';gmailControls();status.textContent='Rechecking your team access…';
      let attempted=false,observedStatus=0;const started=performance.now();clearFailure();
      try{
        const fresh=await records(targetPeriod);
        if(own!==generation||epoch!==gmail.epoch||!identity())throw new Error('Access changed. Reconnect Gmail and reopen the email window.');
        const valid=new Set(fresh.members.map(m=>m.email));if(!(testing&&emails.length===1&&emails[0]===sender)&&emails.some(email=>!valid.has(email)))throw new Error('The group changed. Choose the recipients again.');
        if(!connected())throw new Error('Your Gmail connection expired. Connect again to send.');
        const raw=mailMessage(emails,testing?'[TEST] '+subject:subject,draft,sender,testing);status.textContent='Sending your email…';attempted=true;
        const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw}),credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(45000)});
        observedStatus=response.status;let result;try{result=await response.json();}catch{}
        if(own!==generation||!identity())return;
        // A clear rejection preserves the draft and may be corrected safely.
        if(response.status>=400&&response.status<500){
          attempted=false;const rejection=gmailRejection(response.status,result);failure('send',response.status,rejection.code);
          if(rejection.reconnect)disconnectGmail();if(rejection.consent)requestConsent=true;
          throw new Error(rejection.message);
        }
        if(own!==generation||!identity())return;if(!response.ok||typeof result?.id!=='string'||!result.id)throw new Error('Delivery could not be confirmed.');
        gmail.delivery=testing?'draft':'sent';if(epoch===gmail.epoch&&identity())status.textContent=testing?'Test email sent only to '+sender+'. Your team has not been emailed; your draft is ready to review.':'Email sent from '+sender+' to '+emails.length+' recipient'+(emails.length===1?'':'s')+'. You can find it in Gmail Sent.';
      }catch(error){
        if(attempted&&own===generation&&identity()){gmail.delivery='unknown';failure('send',0,'delivery-unconfirmed');if(identity())status.textContent='Delivery could not be confirmed. Check your Gmail Sent folder before sending another email. This message will not be sent again automatically.';}
        else if(own===generation&&identity()){if(!lastFailure)failure('access',error.status,'team-access-recheck');status.textContent=error.message;}
      }finally{if(own===generation&&identity())window.NestAccessDiagnostics?.record(testing?'group-email-test-send':'group-email-send',gmail.delivery==='sent'||testing&&!lastFailure?200:gmail.delivery==='unknown'?(observedStatus>=400?observedStatus:502):(observedStatus||lastFailure?.status||0),performance.now()-started);gmail.sending=false;controls.forEach((el,i)=>el.disabled=disabled[i]);message.contentEditable='true';count();}
    }
    q('[data-email-send]').addEventListener('click',()=>sendEmail(false));q('[data-email-test]').addEventListener('click',()=>sendEmail(true));
    async function handoff(open){
      const emails=chosen(),subject=q('[data-email-subject]').value.trim();if(!data||!emails.length||!identity())return;
      if(!subject||!message.textContent.trim()){status.textContent='Add a subject and message before opening your draft.';return;}
      const own=generation,targetPeriod=period,draft=formatted();
      q('[data-email-open]').disabled=q('[data-email-copy]').disabled=true;status.textContent='Rechecking your team access…';
      try{
        const fresh=await records(targetPeriod);if(own!==generation||!identity())throw new Error('Access changed. Reopen the email window.');
        const valid=new Set(fresh.members.map(m=>m.email));if(emails.some(email=>!valid.has(email)))throw new Error('The group changed. Choose the recipients again.');
        if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error('Formatted copying is unavailable in this browser. Use a current version of Chrome or Edge.');
        await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([draft.html],{type:'text/html'}),'text/plain':new Blob([draft.text],{type:'text/plain'})})]);
        if(open){const url='https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(emails.join(','))+'&su='+encodeURIComponent(subject);const tab=window.open(url,'_blank','noopener');if(!tab){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='Open Gmail draft';status.replaceChildren(a,document.createTextNode(' — then paste your formatted message.'));return;}}
        status.textContent=open?'Message copied. Paste it into the Gmail draft, review recipients and send from your school account.':'Banner and formatted message copied.';
      }catch(error){status.textContent=error.message;}finally{count();}
    }
    q('[data-email-open]').addEventListener('click',()=>handoff(true));q('[data-email-copy]').addEventListener('click',()=>handoff(false));
    window.addEventListener('pagehide',disconnectGmail);
    document.addEventListener('nest-auth-change',()=>{disconnectGmail();if(!identity())resetAccess();else check(lookupPeriod());});document.addEventListener('nest-hq-access-revoked',resetAccess);document.addEventListener('nest-hq-access-ready',()=>check(lookupPeriod()));
    document.addEventListener('nest-hq-tab-change',event=>{if(event.detail.tab===activeTab&&!data)check(lookupPeriod());});
    window.NestAuth?.ready.then(()=>check(lookupPeriod()));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
