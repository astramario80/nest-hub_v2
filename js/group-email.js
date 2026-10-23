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
    dialog.innerHTML=`<div class="group-email-heading"><h2 id="group-email-title">Email group</h2><button type="button" data-email-close aria-label="Close email window">×</button></div><div class="group-email-fields group-email-audience"><label>Send to<select data-email-group><option value="">Choose an audience</option><option value="individual">Individual</option><option value="division">Division</option><option value="position">Position</option><option value="leadership">Leadership teams</option></select></label><label data-email-search-label hidden>Find a recipient<input data-email-search type="search" placeholder="Search any NEST member"></label><details class="group-email-picker" data-email-picker hidden><summary data-email-picker-summary>Choose options</summary><fieldset data-email-options><legend class="sr-only">Audience options</legend></fieldset></details><span data-email-count role="status" aria-live="polite"></span></div><div class="group-email-recipients" data-email-recipients hidden></div><details data-email-review hidden><summary>Review recipients</summary><div class="group-email-recipient-preview" data-email-preview></div></details><label class="group-email-subject">Subject (required)<input data-email-subject maxlength="180" autocomplete="off" required aria-required="true" aria-describedby="group-email-subject-error"><small id="group-email-subject-error" class="group-email-field-error" data-email-subject-error role="alert" hidden></small></label><div class="group-email-toolbar" role="group" aria-label="Message formatting"><button type="button" data-email-command="bold"><strong>Bold</strong></button><button type="button" data-email-command="italic"><em>Italic</em></button><button type="button" data-email-command="underline"><u>Underline</u></button><button type="button" data-email-command="strikeThrough"><s>Strike through</s></button><button type="button" data-email-command="insertUnorderedList">Bullet points</button><button type="button" data-email-command="insertOrderedList">Numbered list</button><button type="button" data-email-command="indent">Indent</button><button type="button" data-email-command="outdent">Outdent</button><button type="button" data-email-link>Insert hyperlink</button><select data-email-font aria-label="Font style"><option value="Arial">Arial</option><option value="Verdana">Verdana</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option></select><select data-email-size aria-label="Font size"><option value="2">Small</option><option value="3" selected>Normal</option><option value="4">Large</option><option value="5">Extra large</option></select><select data-email-block aria-label="Paragraph style"><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select><label class="group-email-color">Text color<input type="color" data-email-color value="#172238" aria-label="Text color"></label><label class="group-email-color">Highlight<input type="color" data-email-highlight value="#fff3a3" aria-label="Highlight color"></label><button type="button" data-email-command="justifyLeft">Align left</button><button type="button" data-email-command="justifyCenter">Center</button><button type="button" data-email-command="justifyRight">Align right</button><button type="button" data-email-command="removeFormat">Clear formatting</button><button type="button" data-email-command="unlink">Remove link</button><button type="button" data-email-command="undo">Undo</button><button type="button" data-email-command="redo">Redo</button></div><div class="group-email-message" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Email message"></div><p class="group-email-notice">For official NEST™ communications only. Review your recipients before sending. Replies go to your linked email address. <a href="/email-privacy" target="_blank" rel="noopener noreferrer">Email privacy policy</a>.</p><button type="button" data-email-error-copy hidden>Copy error details</button><div class="group-email-actions"><button type="button" data-email-send disabled>Send email</button><button type="button" data-email-test disabled>Send test to myself</button><button type="button" data-email-new hidden>New email</button></div><p class="group-email-send-status" data-email-status role="status" aria-live="polite" aria-atomic="true"></p><button type="button" data-email-check hidden>Check send status</button>`;
    (communicationPanel||document.body).append(dialog);
    const isOpen=()=>inline?window.NestDivisionHQ?.active===activeTab:dialog.open;
    const q=s=>dialog.querySelector(s),group=q('[data-email-group]'),recipients=q('[data-email-recipients]'),message=q('.group-email-message'),status=q('[data-email-status]');
    const selectedDivisions=new Set(),selectedRoles=new Set(),individuals=new Set();
    if(inline){q('[data-email-close]').hidden=true;q('h2').textContent='Compose an email';}
    let data=null,period='all',generation=0,selectedRange=null,leaveEditorOnTab=false;
    const newRequestId=()=>Array.from(window.crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const mail={sending:false,delivery:'draft',requestId:newRequestId()};
    let lastFailure=null,statusTimer=null,statusChecks=0;
    const stopStatusChecks=()=>{window.clearTimeout(statusTimer);statusTimer=null;statusChecks=0;q('[data-email-check]').hidden=true;q('[data-email-check]').disabled=false;};
    function mailControls(){
      q('[data-email-send]').disabled=!data?.emailService?.ready||!chosen().length||mail.sending||mail.delivery!=='draft';
      q('[data-email-test]').disabled=!data?.emailService?.ready||mail.sending||mail.delivery!=='draft';
      q('[data-email-send]').textContent=mail.sending?'Sending…':mail.delivery==='accepted'?'Email sent':mail.delivery==='draft'?'Send email':'Review send result';
      q('[data-email-new]').hidden=mail.delivery==='draft';q('[data-email-new]').disabled=mail.sending;
    }
    function clearFailure(){lastFailure=null;q('[data-email-error-copy]').hidden=true;}
    function clearSubjectError(){q('[data-email-subject]').removeAttribute('aria-invalid');q('[data-email-subject-error]').hidden=true;q('[data-email-subject-error]').textContent='';if(status.dataset.validation==='subject'){status.textContent='';delete status.dataset.state;delete status.dataset.validation;}}
    q('[data-email-subject]').addEventListener('input',()=>{if(q('[data-email-subject]').value.trim())clearSubjectError();});
    function failure(stage,statusCode,code){
      lastFailure={stage,status:Number(statusCode)||0,code:/^[a-z0-9_-]{1,60}$/i.test(code||'')?code:'unknown',requestId:mail.requestId,time:new Date().toISOString()};q('[data-email-error-copy]').hidden=false;
    }
    q('[data-email-error-copy]').addEventListener('click',async()=>{
      if(!lastFailure)return;const report='NEST™ team email\n'+Object.entries(lastFailure).map(([key,value])=>key+': '+value).join('\n')+'\nNo message text, recipients, or credentials included.';
      try{await navigator.clipboard.writeText(report);status.textContent='Error details copied. Your draft is still here.';}catch{status.textContent='Copying is unavailable. Error: '+lastFailure.code+' (HTTP '+lastFailure.status+'). Your draft is still here.';}
    });
    q('[data-email-new]').addEventListener('click',()=>{
      if(mail.sending)return;
      if(['unknown','pending','partial'].includes(mail.delivery)&&!window.confirm('Some recipients may already have received this message. Ask a NEST administrator to check the send before composing another. Start a new message?'))return;
      stopStatusChecks();clearSubjectError();mail.delivery='draft';mail.requestId=newRequestId();clearFailure();message.replaceChildren();selectedRange=null;q('[data-email-subject]').value='';status.textContent='';mailControls();q('[data-email-subject]').focus();
    });

    const identity=()=>Boolean(window.NestAuth?.identity?.signedIn)&&(!window.NestDivisionHQ||window.NestDivisionHQ.allowed);
    function members(){
      if(!data)return [];
      const addresses=group.value==='position'?new Set(data.leaders.filter(l=>selectedRoles.has(l.position)).map(l=>l.email)):group.value==='leadership'?new Set(data.leaders.map(l=>l.email)):null;
      return data.members.filter(m=>group.value==='individual'?individuals.has(m.email):group.value==='division'?(m.divisions||[]).some(p=>selectedDivisions.has(p)):addresses?.has(m.email));
    }
    const chosen=()=>members().map(m=>m.email);
    function count(){const n=chosen().length;q('[data-email-count]').textContent=n+' recipient'+(n===1?'':'s')+' selected';mailControls();}
    async function records(){const r=await fetch('/api/group-email?period=all&audience=nest&action=group-email-access',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(120000)});const result=await r.json();if(!r.ok)throw Object.assign(new Error(result.error||'Email groups could not load.'),{status:r.status});return result;}
    function search(){const term=q('[data-email-search]').value.trim().toLowerCase();recipients.querySelectorAll('label').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(term));}
    function renderRecipients(){
      const individual=group.value==='individual';recipients.hidden=!individual;recipients.replaceChildren();
      if(individual&&data)data.members.forEach(m=>{const row=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');box.type='checkbox';box.value=m.email;box.checked=individuals.has(m.email);box.disabled=mail.sending;box.addEventListener('change',()=>{if(box.checked)individuals.add(m.email);else individuals.delete(m.email);count();});text.textContent=m.name+' · '+m.email;row.append(box,text);recipients.append(row);});
      const selected=members();q('[data-email-review]').hidden=individual||!selected.length;q('[data-email-preview]').replaceChildren(...selected.map(m=>{const row=document.createElement('div');row.textContent=m.name+' · '+m.email;return row;}));count();search();
    }
    function render(){
      const mode=group.value,options=q('[data-email-options]'),picker=q('[data-email-picker]');q('[data-email-search-label]').hidden=mode!=='individual';picker.hidden=!['division','position'].includes(mode);options.replaceChildren();options.setAttribute('aria-label',mode==='division'?'Divisions':'Leadership positions');
      if(!picker.hidden){
        const choices=mode==='division'?(data?.divisions||[]).map(p=>({value:p,text:label(p)})):[...new Set((data?.leaders||[]).map(l=>l.position))].sort().map(role=>({value:role,text:role}));
        const selected=mode==='division'?selectedDivisions:selectedRoles;
        const add=(value,text,all=false)=>{const row=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.value=value;box.dataset.emailOption=all?'all':value;box.checked=all?choices.length>0&&choices.every(c=>selected.has(c.value)):selected.has(value);box.indeterminate=all&&selected.size>0&&!box.checked;box.disabled=mail.sending;box.addEventListener('change',()=>{if(all){selected.clear();if(box.checked)choices.forEach(c=>selected.add(c.value));}else if(box.checked)selected.add(value);else selected.delete(value);const opened=picker.open;render();picker.open=opened;[...options.querySelectorAll('input')].find(input=>input.value===value)?.focus();});row.append(box,document.createTextNode(text));options.append(row);};
        add('all',mode==='division'?'All divisions':'All positions',true);choices.forEach(choice=>add(choice.value,choice.text));
        q('[data-email-picker-summary]').textContent=selected.size?(choices.every(c=>selected.has(c.value))?'All '+(mode==='division'?'divisions':'positions'):selected.size+' '+(mode==='division'?'division':'position')+(selected.size===1?'':'s')+' selected'):'Choose '+(mode==='division'?'divisions':'positions');
      }
      renderRecipients();
    }
    function resetAccess(){stopStatusChecks();clearSubjectError();mail.sending=false;message.contentEditable='true';dialog.querySelectorAll('input,select,.group-email-toolbar button').forEach(el=>el.disabled=false);clearFailure();status.textContent='';delete status.dataset.state;mail.delivery='draft';mail.requestId=newRequestId();selectedRange=null;delete lookup.dataset.emailEnabled;generation++;data=null;button.hidden=true;recipients.replaceChildren();individuals.clear();selectedRoles.clear();selectedDivisions.clear();message.replaceChildren();q('[data-email-subject]').value='';render();if(!inline&&dialog.open)dialog.close();}
    async function check(p){
      if(!divisions.includes(p)||!identity()||(window.NestDivisionHQ&&window.NestDivisionHQ.active!==activeTab&&!isOpen()))return;
      const own=++generation;period='all';delete lookup.dataset.emailEnabled;data=null;button.hidden=true;render();status.textContent='Loading NEST recipients…';
      try{const result=await records();if(own!==generation||!identity())return;data=result;data.members.sort((a,b)=>a.name.localeCompare(b.name));if(!inline)lookup.dataset.emailEnabled='true';button.hidden=false;if(!selectedDivisions.size&&p!=='all')selectedDivisions.add(p);const valid=new Set(data.members.map(m=>m.email));for(const address of individuals)if(!valid.has(address))individuals.delete(address);status.textContent='';render();}
      catch(error){if(own===generation){status.textContent=error.message;count();}}
    }
    function lookupPeriod(){if(inline)return lookup.dataset.hqLookup||'all';const value=document.getElementById('leadership-division')?.value;return value==='NEST™ Robotics'?'CTSO':value?.replace('Division ','')||lookup.dataset.hqLookup||'all';}
    button.addEventListener('click',()=>{
      if(!data||!identity())return;
      const selected=[...lookup.querySelectorAll('[data-email-select]:checked')].map(box=>box.value),role=document.getElementById('leadership-position')?.value;
      if(selected.length){group.value='individual';individuals.clear();selected.forEach(email=>individuals.add(email));}else if(role){group.value='position';selectedRoles.clear();selectedRoles.add(role);}else group.value='leadership';
      render();dialog.showModal();mailControls();q('[data-email-subject]').focus();
    });
    if(!inline)q('[data-email-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>button.focus());
    document.addEventListener('click',event=>{const picker=q('[data-email-picker]');if(!picker.contains(event.target))picker.open=false;});
    q('[data-email-picker]').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();q('[data-email-picker]').open=false;q('[data-email-picker-summary]').focus();}});
    group.addEventListener('change',()=>{q('[data-email-picker]').open=false;render();});q('[data-email-search]').addEventListener('input',search);
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
      if(event.defaultPrevented||event.isComposing||mail.sending||message.contentEditable==='false')return;
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
    function scheduleStatusCheck(){
      q('[data-email-check]').hidden=false;
      if(statusTimer||statusChecks>=4)return;
      statusTimer=window.setTimeout(()=>{statusTimer=null;checkSendStatus();},[2000,5000,10000,20000][statusChecks++]);
    }
    function showSendResult(result,testing){
      mail.delivery=result.state;mail.testing=testing;clearFailure();
      if(result.state==='accepted'){
        stopStatusChecks();document.dispatchEvent(new Event('nest-email-sent'));
        status.dataset.state='success';status.textContent=testing?'Test email sent to your linked email address.':'Email sent to '+result.accepted+' recipient'+(result.accepted===1?'':'s')+'. Accepted for delivery at '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'. View it in Sent history.';
        if(testing){mail.delivery='draft';mail.requestId=newRequestId();}
      }else if(result.state==='partial'){
        document.dispatchEvent(new Event('nest-email-sent'));failure('send',200,'delivery-partial');status.dataset.state='error';
        status.textContent='Email sent to '+result.accepted+' recipients. '+(result.unconfirmed?result.unconfirmed+' remaining recipient'+(result.unconfirmed===1?' is':'s are')+' unconfirmed.':result.rejected+' recipient'+(result.rejected===1?' was':'s were')+' rejected and did not receive this send.')+' View Sent history. NEST will not resend automatically.';
        if(result.unconfirmed)scheduleStatusCheck();else stopStatusChecks();
      }else if(result.state==='rejected'){
        stopStatusChecks();failure('send',200,'provider-rejected');status.dataset.state='error';status.textContent='Postmark rejected the message. No recipients were accepted. Your draft is still here; contact a NEST administrator.';
      }else{
        failure('send',200,'delivery-'+result.state);status.dataset.state='error';status.textContent='Checking send confirmation. Some recipients may already have received this email. NEST will not resend automatically.';scheduleStatusCheck();
      }
      mailControls();
    }
    async function checkSendStatus(){
      const own=generation,requestId=mail.requestId,testing=mail.testing;
      if(!identity()||!['unknown','pending','partial'].includes(mail.delivery))return;
      q('[data-email-check]').disabled=true;
      try{
        const response=await fetch('/api/group-email-history?action=status&requestId='+encodeURIComponent(requestId),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000)});
        const result=await response.json();if(own!==generation||requestId!==mail.requestId||!identity())return;
        if(response.ok&&result.requestId===requestId&&['accepted','partial'].includes(result.state)&&Number.isInteger(result.accepted)&&result.accepted>0)showSendResult(result,testing);
      }catch{}finally{
        if(own===generation&&requestId===mail.requestId&&identity()){
          q('[data-email-check]').disabled=false;
          if(['unknown','pending'].includes(mail.delivery)||!q('[data-email-check]').hidden){
            if(statusChecks>=4&&['unknown','pending'].includes(mail.delivery))status.textContent='Send confirmation is still unavailable. Use Check send status or view Sent history. NEST will not resend automatically.';
            scheduleStatusCheck();
          }
        }
      }
    }
    q('[data-email-check]').addEventListener('click',()=>{window.clearTimeout(statusTimer);statusTimer=null;checkSendStatus();});
    async function sendEmail(testing=false){
      if(mail.sending||mail.delivery!=='draft'||!data?.emailService?.ready||!identity())return;
      const emails=chosen(),subject=q('[data-email-subject]').value.trim();
      if(!subject){
        clearFailure();const field=q('[data-email-subject]'),error=q('[data-email-subject-error]');
        error.textContent='Add a subject before sending your email.';error.hidden=false;field.setAttribute('aria-invalid','true');
        status.textContent=error.textContent;status.dataset.state='error';status.dataset.validation='subject';field.focus();field.scrollIntoView?.({block:'center',behavior:'smooth'});return;
      }
      clearSubjectError();
      if(!testing&&!emails.length){status.textContent='Choose at least one recipient before sending.';group.focus();group.scrollIntoView?.({block:'center'});return;}
      if(!message.textContent.trim()){status.textContent='Write a message before sending your email.';message.focus();message.scrollIntoView?.({block:'center'});return;}
      const own=generation,controls=[...dialog.querySelectorAll('input,select,.group-email-toolbar button')],disabled=controls.map(el=>el.disabled);
      const html=message.innerHTML,requestId=mail.requestId;
      mail.sending=true;controls.forEach(el=>el.disabled=true);message.contentEditable='false';mailControls();status.textContent='Sending… Checking your access and recipients. Please keep this window open.';status.dataset.state='sending';clearFailure();status.tabIndex=-1;status.focus({preventScroll:true});status.scrollIntoView?.({block:'nearest',behavior:'smooth'});
      const progress=window.setTimeout(()=>{if(mail.sending&&own===generation&&identity())status.textContent='Still sending… Waiting for school verification and email confirmation. This can take up to 90 seconds; NEST will then check the send status.';},12000);
      let attempted=false,httpStatus=0;const started=performance.now();
      try{
        attempted=true;
        const response=await fetch('/api/group-email-send',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({period,audience:'nest',recipients:testing?[]:emails,subject,html,requestId,testing}),signal:AbortSignal.timeout(90000)});
        httpStatus=response.status;const result=await response.json();if(own!==generation||!identity())return;
        if(!response.ok){attempted=false;failure('send',httpStatus,'nest-send-rejected');throw new Error(result.error||'NEST could not start sending. Your draft is still here.');}
        if(!['accepted','rejected','partial','pending','unknown'].includes(result.state))throw new Error('Send result could not be confirmed.');
        showSendResult(result,testing);
      }catch(error){
        if(own!==generation||!identity())return;
        if(attempted){showSendResult({state:'unknown',accepted:0,rejected:0},testing);}
        else status.textContent=error.message;
      }finally{
        window.clearTimeout(progress);if(lastFailure)status.dataset.state='error';
        if(own===generation&&identity()){mail.sending=false;controls.forEach((el,i)=>el.disabled=disabled[i]);message.contentEditable='true';count();try{window.NestAccessDiagnostics?.record?.(testing?'group-email-test-send':'group-email-send',lastFailure?(httpStatus||502):200,performance.now()-started);}catch{}}
      }
    }
    q('[data-email-send]').addEventListener('click',()=>sendEmail(false));q('[data-email-test]').addEventListener('click',()=>sendEmail(true));
    window.addEventListener('pagehide',resetAccess);
    document.addEventListener('nest-auth-change',()=>{resetAccess();if(identity())check(lookupPeriod());});document.addEventListener('nest-hq-access-revoked',resetAccess);document.addEventListener('nest-hq-access-ready',()=>check(lookupPeriod()));
    document.addEventListener('nest-hq-tab-change',event=>{if(event.detail.tab===activeTab&&!data)check(lookupPeriod());});
    window.NestAuth?.ready.then(()=>check(lookupPeriod()));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
