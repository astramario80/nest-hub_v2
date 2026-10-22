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
    dialog.innerHTML=`<div class="group-email-heading"><h2 id="group-email-title">Email group</h2><button type="button" data-email-close aria-label="Close email window">×</button></div><div class="group-email-fields"><label>Division<select data-email-division>${divisions.map(p=>`<option value="${p}">${label(p)}</option>`).join('')}</select></label><label>Group<select data-email-group><option value="leadership">Leadership teams</option><option value="position">By leadership position</option><option value="members">All members of selected divisions</option><option value="specific">Specific students</option></select></label><label data-email-position-label hidden>Position<select data-email-position></select></label></div><label>Find a recipient<input data-email-search type="search" placeholder="Search name or school email"></label><p data-email-count></p><div class="group-email-recipients" data-email-recipients></div><label class="group-email-subject">Subject<input data-email-subject maxlength="180" autocomplete="off"></label><div class="group-email-toolbar" role="group" aria-label="Message formatting"><button type="button" data-email-command="bold"><strong>Bold</strong></button><button type="button" data-email-command="italic"><em>Italic</em></button><button type="button" data-email-command="underline"><u>Underline</u></button><button type="button" data-email-command="strikeThrough"><s>Strike through</s></button><button type="button" data-email-command="insertUnorderedList">Bullet points</button><button type="button" data-email-command="insertOrderedList">Numbered list</button><button type="button" data-email-command="indent">Indent</button><button type="button" data-email-command="outdent">Outdent</button><button type="button" data-email-link>Insert hyperlink</button><select data-email-font aria-label="Font style"><option value="Arial">Arial</option><option value="Verdana">Verdana</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option></select><select data-email-size aria-label="Font size"><option value="2">Small</option><option value="3" selected>Normal</option><option value="4">Large</option><option value="5">Extra large</option></select><select data-email-block aria-label="Paragraph style"><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select><label class="group-email-color">Text color<input type="color" data-email-color value="#172238" aria-label="Text color"></label><label class="group-email-color">Highlight<input type="color" data-email-highlight value="#fff3a3" aria-label="Highlight color"></label><button type="button" data-email-command="justifyLeft">Align left</button><button type="button" data-email-command="justifyCenter">Center</button><button type="button" data-email-command="justifyRight">Align right</button><button type="button" data-email-command="removeFormat">Clear formatting</button><button type="button" data-email-command="unlink">Remove link</button><button type="button" data-email-command="undo">Undo</button><button type="button" data-email-command="redo">Redo</button></div><div class="group-email-message" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Email message"></div><p class="group-email-notice">For official NEST™ communications only. Review your recipients before sending. Replies go to your linked email address. <a href="/email-privacy" target="_blank" rel="noopener noreferrer">Email privacy policy</a>.</p><button type="button" data-email-error-copy hidden>Copy error details</button><div class="group-email-actions"><button type="button" data-email-send disabled>Send email</button><button type="button" data-email-test disabled>Send test to myself</button><button type="button" data-email-new hidden>New email</button></div><p class="group-email-send-status" data-email-status role="status" aria-live="polite" aria-atomic="true"></p>`;
    (communicationPanel||document.body).append(dialog);
    const isOpen=()=>inline?window.NestDivisionHQ?.active===activeTab:dialog.open;
    const q=s=>dialog.querySelector(s),periodSelect=q('[data-email-division]'),group=q('[data-email-group]'),position=q('[data-email-position]'),recipients=q('[data-email-recipients]'),message=q('.group-email-message'),status=q('[data-email-status]');
    const buildingOption=document.createElement('option');buildingOption.value='building-leadership';buildingOption.textContent='Leadership across NEST';buildingOption.hidden=true;buildingOption.disabled=true;group.append(buildingOption);
    if(inline){q('[data-email-close]').hidden=true;q('h2').textContent='Compose an email';}
    let data=null,period='',divisionPeriod='',generation=0,selectedRange=null,leaveEditorOnTab=false;
    const newRequestId=()=>Array.from(window.crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const mail={sending:false,delivery:'draft',requestId:newRequestId()};
    let lastFailure=null;
    function mailControls(){
      q('[data-email-send]').disabled=!data?.emailService?.ready||!chosen().length||mail.sending||mail.delivery!=='draft';
      q('[data-email-test]').disabled=!data?.emailService?.ready||mail.sending||mail.delivery!=='draft';
      q('[data-email-send]').textContent=mail.sending?'Sending…':mail.delivery==='accepted'?'Email sent':mail.delivery==='draft'?'Send email':'Review send result';
      q('[data-email-new]').hidden=mail.delivery==='draft';q('[data-email-new]').disabled=mail.sending;
    }
    function clearFailure(){lastFailure=null;q('[data-email-error-copy]').hidden=true;}
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
      mail.delivery='draft';mail.requestId=newRequestId();clearFailure();message.replaceChildren();selectedRange=null;q('[data-email-subject]').value='';status.textContent='';mailControls();q('[data-email-subject]').focus();
    });

    const identity=()=>Boolean(window.NestAuth?.identity?.signedIn)&&(!window.NestDivisionHQ||window.NestDivisionHQ.allowed);
    const chosen=()=>[...recipients.querySelectorAll('input:checked')].map(el=>el.value);
    function count(){const n=chosen().length;q('[data-email-count]').textContent=n+' recipient'+(n===1?'':'s')+' selected';mailControls();}
    async function records(p,audience=group.value==='building-leadership'?'leadership':'division'){const r=await fetch('/api/group-email?period='+encodeURIComponent(p)+'&audience='+audience+'&action=group-email-access',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(120000)});const result=await r.json();if(!r.ok)throw Object.assign(new Error(result.error||'Email groups could not load.'),{status:r.status});return result;}
    function members(){if(!data)return [];let list=group.value==='members'||group.value==='specific'?data.members:data.leaders.filter(l=>group.value!=='position'||l.position===position.value);return [...new Map(list.map(m=>[m.email,m])).values()];}
    function render(preselected){
      q('[data-email-position-label]').hidden=group.value!=='position';recipients.replaceChildren();
      members().forEach(m=>{const row=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');box.type='checkbox';box.value=m.email;box.checked=preselected?preselected.has(m.email):group.value!=='specific';text.textContent=m.name+' · '+m.email;box.addEventListener('change',count);row.append(box,text);recipients.append(row);});count();search();
    }
    function search(){const term=q('[data-email-search]').value.trim().toLowerCase();recipients.querySelectorAll('label').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(term));}
    function resetAccess(){mail.sending=false;message.contentEditable='true';dialog.querySelectorAll('input,select,.group-email-toolbar button').forEach(el=>el.disabled=false);clearFailure();status.textContent='';delete status.dataset.state;mail.delivery='draft';mail.requestId=newRequestId();selectedRange=null;delete lookup.dataset.emailEnabled;generation++;data=null;button.hidden=true;recipients.replaceChildren();position.replaceChildren();message.replaceChildren();q('[data-email-subject]').value='';buildingOption.hidden=buildingOption.disabled=true;count();if(!inline&&dialog.open)dialog.close();}
    async function check(p){
      if(group.value==='building-leadership')p='all';
      if(!divisions.includes(p)||!identity()||(window.NestDivisionHQ&&window.NestDivisionHQ.active!==activeTab&&!isOpen()))return;
      const selectedPosition=position.value,specificSelection=group.value==='specific'?new Set(chosen()):undefined;
      const own=++generation;period=p;periodSelect.value=p;periodSelect.disabled=group.value==='building-leadership';if(group.value!=='building-leadership')divisionPeriod=p;delete lookup.dataset.emailEnabled;data=null;button.hidden=true;recipients.replaceChildren();count();status.textContent='Checking leadership email access…';
      try{const result=await records(p);if(own!==generation||!identity())return;data=result;if(!inline)lookup.dataset.emailEnabled='true';button.hidden=false;buildingOption.hidden=buildingOption.disabled=!result.canReachBuildingLeadership;position.replaceChildren();[...new Set(result.leaders.map(l=>l.position))].sort().forEach(role=>{const option=document.createElement('option');option.value=option.textContent=role;position.append(option);});if([...position.options].some(option=>option.value===selectedPosition))position.value=selectedPosition;status.textContent=result.audience==='leadership'?'Leadership across all NEST divisions. Student groups remain limited to your own divisions.':p==='all'?'Included: '+(result.divisions||[]).map(label).join(', ')+'. Only divisions where you have leadership access are included.':'';render(specificSelection);mailControls();}
      catch(error){if(own===generation){status.textContent=error.message;count();}}
    }
    function lookupPeriod(){if(inline)return lookup.dataset.hqLookup||period;const value=document.getElementById('leadership-division')?.value;return value==='NEST™ Robotics'?'CTSO':value?.replace('Division ','')||lookup.dataset.hqLookup||period;}
    button.addEventListener('click',()=>{
      if(!data||!identity())return;
      const selected=new Set([...lookup.querySelectorAll('[data-email-select]:checked')].map(box=>box.value));
      const role=document.getElementById('leadership-position')?.value;
      group.value=selected.size?'specific':role?'position':'leadership';if(role)position.value=role;
      render(selected.size?selected:undefined);dialog.showModal();mailControls();q('[data-email-subject]').focus();
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
    async function sendEmail(testing=false){
      if(mail.sending||mail.delivery!=='draft'||!data?.emailService?.ready||!identity())return;
      const emails=chosen(),subject=q('[data-email-subject]').value.trim();
      if((!testing&&!emails.length)||!subject||!message.textContent.trim()){status.textContent='Choose recipients and add a subject and message.';return;}
      const own=generation,controls=[...dialog.querySelectorAll('input,select,.group-email-toolbar button')],disabled=controls.map(el=>el.disabled);
      const html=message.innerHTML,requestId=mail.requestId;
      mail.sending=true;controls.forEach(el=>el.disabled=true);message.contentEditable='false';mailControls();status.textContent='Sending… Checking your access and recipients. Please keep this window open.';status.dataset.state='sending';clearFailure();
      const progress=window.setTimeout(()=>{if(mail.sending&&own===generation&&identity())status.textContent='Still sending… School verification can take a little longer. Please keep this window open.';},12000);
      let attempted=false,httpStatus=0;const started=performance.now();
      try{
        attempted=true;
        const response=await fetch('/api/group-email-send',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({period,audience:group.value==='building-leadership'?'leadership':'division',recipients:testing?[]:emails,subject,html,requestId,testing}),signal:AbortSignal.timeout(180000)});
        httpStatus=response.status;const result=await response.json();if(own!==generation||!identity())return;
        if(!response.ok){attempted=false;failure('send',httpStatus,'nest-send-rejected');throw new Error(result.error||'NEST could not start sending. Your draft is still here.');}
        if(!['accepted','rejected','partial','pending','unknown'].includes(result.state))throw new Error('Send result could not be confirmed.');
        mail.delivery=result.state;
        if(result.state==='accepted'){
          document.dispatchEvent(new Event('nest-email-sent'));
          status.dataset.state='success';status.textContent=testing?'Test email sent to your linked email address.':'Email sent to '+result.accepted+' recipient'+(result.accepted===1?'':'s')+'. Accepted for delivery at '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'. View it in Sent history.';
          if(testing){mail.delivery='draft';mail.requestId=newRequestId();}
        }else if(result.state==='rejected'){failure('send',httpStatus,'provider-rejected');status.textContent='Postmark rejected the message. No recipients were accepted. Your draft is still here; contact a NEST administrator.';}
        else{failure('send',httpStatus,'delivery-'+result.state);status.textContent=result.state==='partial'?result.accepted+' emails accepted; '+result.rejected+' rejected. Contact a NEST administrator before sending again.':'Sending is pending or unconfirmed. Contact a NEST administrator to check the send. NEST will not resend automatically.';}
      }catch(error){
        if(own!==generation||!identity())return;
        if(attempted){mail.delivery='unknown';failure('send',httpStatus,'delivery-unconfirmed');status.textContent='Sending could not be confirmed. Contact a NEST administrator before sending again. NEST will not resend automatically.';}
        else status.textContent=error.message;
      }finally{
        window.clearTimeout(progress);if(lastFailure)status.dataset.state='error';
        if(own===generation&&identity()){window.NestAccessDiagnostics?.record(testing?'group-email-test-send':'group-email-send',lastFailure?(httpStatus||502):200,performance.now()-started);mail.sending=false;controls.forEach((el,i)=>el.disabled=disabled[i]);message.contentEditable='true';count();}
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
