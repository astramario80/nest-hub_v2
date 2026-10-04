(() => {
  function init(){
    const lookup=document.querySelector('.leadership-page');if(!lookup)return;
    const divisions=['1','2','3','4','5','7','CTSO'];
    const label=p=>p==='CTSO'?'NEST™ Robotics':'Division '+p;
    const button=document.createElement('button');button.type='button';button.className='group-email-launch';button.textContent='Email group';button.hidden=true;
    lookup.querySelector('.leadership-controls').append(button);
    const dialog=document.createElement('dialog');dialog.className='group-email-dialog';dialog.setAttribute('aria-labelledby','group-email-title');
    dialog.innerHTML=`<div class="group-email-heading"><h2 id="group-email-title">Email group</h2><button type="button" data-email-close aria-label="Close email window">×</button></div><div class="group-email-fields"><label>Division<select data-email-division>${divisions.map(p=>`<option value="${p}">${label(p)}</option>`).join('')}</select></label><label>Group<select data-email-group><option value="leadership">Division leadership team</option><option value="position">By leadership position</option><option value="members">All division members</option><option value="specific">Specific students</option></select></label><label data-email-position-label hidden>Position<select data-email-position></select></label></div><label>Find a recipient<input data-email-search type="search" placeholder="Search name or school email"></label><p data-email-count></p><div class="group-email-recipients" data-email-recipients></div><label class="group-email-subject">Subject<input data-email-subject maxlength="180" autocomplete="off"></label><div class="group-email-toolbar" role="group" aria-label="Message formatting"><button type="button" data-email-command="bold"><strong>Bold</strong></button><button type="button" data-email-command="italic"><em>Italic</em></button><button type="button" data-email-command="insertUnorderedList">Bullet points</button><button type="button" data-email-command="indent">Indent</button><button type="button" data-email-command="outdent">Outdent</button><button type="button" data-email-link>Insert hyperlink</button><select data-email-font aria-label="Font style"><option value="Arial">Arial</option><option value="Verdana">Verdana</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option></select><select data-email-size aria-label="Font size"><option value="2">Small</option><option value="3" selected>Normal</option><option value="4">Large</option><option value="5">Extra large</option></select></div><img class="group-email-banner" src="/assets/nest-email-banner.png" alt="NEST™ email banner"><div class="group-email-message" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Email message"></div><p class="group-email-notice">Your banner and formatting will be copied. Paste into the Gmail draft with Ctrl+V (⌘V on Mac), then review and send from your school account.</p><p data-email-status role="status" aria-live="polite"></p><div class="group-email-actions"><button type="button" data-email-open disabled>Copy formatted message and open Gmail</button><button type="button" data-email-copy disabled>Copy formatted message</button></div>`;
    document.body.append(dialog);
    const q=s=>dialog.querySelector(s),periodSelect=q('[data-email-division]'),group=q('[data-email-group]'),position=q('[data-email-position]'),recipients=q('[data-email-recipients]'),message=q('.group-email-message'),status=q('[data-email-status]');
    let data=null,period='',generation=0,selectedRange=null;
    const identity=()=>Boolean(window.NestAuth?.identity?.signedIn)&&(!window.NestDivisionHQ||window.NestDivisionHQ.allowed);
    const chosen=()=>[...recipients.querySelectorAll('input:checked')].map(el=>el.value);
    function count(){const n=chosen().length;q('[data-email-count]').textContent=n+' recipient'+(n===1?'':'s')+' selected';q('[data-email-open]').disabled=q('[data-email-copy]').disabled=!n||!data;}
    async function records(p){const r=await fetch('/api/group-email?period='+encodeURIComponent(p),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(90000)});const result=await r.json();if(!r.ok)throw new Error(result.error||'Email groups could not load.');return result;}
    function members(){if(!data)return [];let list=group.value==='members'||group.value==='specific'?data.members:data.leaders.filter(l=>group.value!=='position'||l.position===position.value);return [...new Map(list.map(m=>[m.email,m])).values()];}
    function render(preselected){
      q('[data-email-position-label]').hidden=group.value!=='position';recipients.replaceChildren();
      members().forEach(m=>{const row=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');box.type='checkbox';box.value=m.email;box.checked=preselected?preselected.has(m.email):group.value!=='specific';text.textContent=m.name+' · '+m.email;box.addEventListener('change',count);row.append(box,text);recipients.append(row);});count();search();
    }
    function search(){const term=q('[data-email-search]').value.trim().toLowerCase();recipients.querySelectorAll('label').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(term));}
    function resetAccess(){selectedRange=null;delete lookup.dataset.emailEnabled;generation++;data=null;button.hidden=true;recipients.replaceChildren();position.replaceChildren();message.replaceChildren();q('[data-email-subject]').value='';count();if(dialog.open)dialog.close();}
    async function check(p){
      if(!divisions.includes(p)||!identity()||(window.NestDivisionHQ&&window.NestDivisionHQ.active!=='lookup'&&!dialog.open))return;
      const own=++generation;period=p;periodSelect.value=p;delete lookup.dataset.emailEnabled;data=null;button.hidden=true;recipients.replaceChildren();count();status.textContent='Checking leadership email access…';
      try{const result=await records(p);if(own!==generation||!identity())return;data=result;lookup.dataset.emailEnabled='true';button.hidden=false;position.replaceChildren();[...new Set(result.leaders.map(l=>l.position))].sort().forEach(role=>{const option=document.createElement('option');option.value=option.textContent=role;position.append(option);});status.textContent='';render();}
      catch(error){if(own===generation){status.textContent=error.message;count();}}
    }
    function lookupPeriod(){const value=document.getElementById('leadership-division')?.value;return value==='NEST™ Robotics'?'CTSO':value?.replace('Division ','')||lookup.dataset.hqLookup||period;}
    button.addEventListener('click',()=>{
      if(!data||!identity())return;
      const selected=new Set([...lookup.querySelectorAll('[data-email-select]:checked')].map(box=>box.value));
      const role=document.getElementById('leadership-position')?.value;
      group.value=selected.size?'specific':role?'position':'leadership';if(role)position.value=role;
      render(selected.size?selected:undefined);dialog.showModal();q('[data-email-subject]').focus();
    });
    q('[data-email-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>button.focus());
    periodSelect.addEventListener('change',()=>check(periodSelect.value));group.addEventListener('change',()=>render());position.addEventListener('change',()=>render());q('[data-email-search]').addEventListener('input',search);
    document.getElementById('leadership-division')?.addEventListener('change',()=>check(lookupPeriod()));
    function remember(){const selection=window.getSelection();if(selection.rangeCount&&message.contains(selection.anchorNode))selectedRange=selection.getRangeAt(0).cloneRange();}
    message.addEventListener('keyup',remember);message.addEventListener('mouseup',remember);message.addEventListener('input',remember);
    function command(name,value){message.focus();if(selectedRange){const s=window.getSelection();s.removeAllRanges();s.addRange(selectedRange);}document.execCommand(name,false,value);remember();}
    q('.group-email-toolbar').addEventListener('mousedown',event=>{if(event.target.closest('button'))event.preventDefault();});
    dialog.querySelectorAll('[data-email-command]').forEach(el=>el.addEventListener('click',()=>command(el.dataset.emailCommand)));
    q('[data-email-font]').addEventListener('change',event=>command('fontName',event.target.value));q('[data-email-size]').addEventListener('change',event=>command('fontSize',event.target.value));
    q('[data-email-link]').addEventListener('click',()=>{const raw=window.prompt('Hyperlink address (https://…)');if(!raw)return;try{const u=new URL(raw);if(!['https:','http:','mailto:'].includes(u.protocol))throw new Error();command('createLink',u.href);}catch{status.textContent='Use an https, http, or email link.';}});
    function formatted(){
      const copy=document.createElement('div');copy.innerHTML=message.innerHTML;
      const allowed=new Set(['P','DIV','BR','B','STRONG','I','EM','UL','OL','LI','BLOCKQUOTE','A','SPAN','FONT']);
      const dangerous=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','IMG','FORM','INPUT']);
      [...copy.querySelectorAll('*')].reverse().forEach(el=>{if(dangerous.has(el.tagName)){el.remove();return;}if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return;}for(const attr of [...el.attributes]){if(!(el.tagName==='A'&&attr.name==='href')&&!(el.tagName==='FONT'&&['face','size'].includes(attr.name)))el.removeAttribute(attr.name);}if(el.tagName==='A'&&!/^(https?:|mailto:)/i.test(el.getAttribute('href')||''))el.removeAttribute('href');});
      return {html:'<div><img src="https://gknest.org/assets/nest-email-banner.png" alt="NEST™" width="640" style="max-width:100%;height:auto"><div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6">'+copy.innerHTML+'</div></div>',text:'NEST™\n'+message.textContent};
    }
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
    document.addEventListener('nest-auth-change',()=>{if(!identity())resetAccess();else check(lookupPeriod());});document.addEventListener('nest-hq-access-revoked',resetAccess);document.addEventListener('nest-hq-access-ready',()=>check(lookupPeriod()));
    document.addEventListener('nest-hq-tab-change',event=>{if(event.detail.tab==='lookup'&&!data)check(lookupPeriod());});
    window.NestAuth?.ready.then(()=>check(lookupPeriod()));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
